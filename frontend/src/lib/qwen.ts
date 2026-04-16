/**
 * Shared Qwen (Alibaba DashScope, OpenAI-compatible) client with retry.
 *
 * - Uses qwen-plus chat completions with JSON mode.
 * - Retries up to 3x on transient errors (429, 500, 502, 503, 504)
 *   with exponential backoff (1s, 2s, 4s).
 * - Throws QwenParseError when content is not valid JSON.
 * - Throws QwenApiError on non-retryable HTTP failures or when retries are exhausted.
 * - Logs token usage.
 */

export const QWEN_URL =
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'

const QWEN_MODEL = 'qwen-plus'

/** Qwen-plus output hard cap ~ 8192 tokens. Keep safe margin. */
const DEFAULT_MAX_TOKENS = 8000
const DEFAULT_TEMPERATURE = 0.7

const RETRY_STATUS = new Set([429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3
const BACKOFF_MS = [1000, 2000, 4000]

export class QwenApiError extends Error {
  status?: number
  bodySnippet?: string
  constructor(message: string, status?: number, bodySnippet?: string) {
    super(message)
    this.name = 'QwenApiError'
    this.status = status
    this.bodySnippet = bodySnippet
  }
}

export class QwenParseError extends Error {
  rawSnippet: string
  constructor(message: string, rawSnippet: string) {
    super(message)
    this.name = 'QwenParseError'
    this.rawSnippet = rawSnippet
  }
}

export interface CallQwenOptions {
  system?: string
  user: string
  maxTokens?: number
  temperature?: number
}

function getApiKey(): string {
  const key = process.env.QWEN_API_KEY || ''
  if (!key) {
    throw new QwenApiError('QWEN_API_KEY mancante nelle environment variables')
  }
  return key
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Call Qwen-plus with JSON response mode and retries.
 * T is the expected parsed JSON shape — validation should be done by the caller (e.g. Zod).
 */
export async function callQwen<T = unknown>(
  opts: CallQwenOptions
): Promise<T> {
  const apiKey = getApiKey()

  const {
    system,
    user,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
  } = opts

  const messages: Array<{ role: 'system' | 'user'; content: string }> = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: user })

  const body = JSON.stringify({
    model: QWEN_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  })

  let lastError: unknown = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(
        `[qwen] attempt ${attempt}/${MAX_ATTEMPTS} — max_tokens=${maxTokens}, temperature=${temperature}`
      )

      const res = await fetch(QWEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      })

      console.log(`[qwen] response status: ${res.status}`)

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        const snippet = errText.slice(0, 500)
        console.error(
          `[qwen] HTTP ${res.status} on attempt ${attempt}: ${snippet}`
        )

        if (RETRY_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
          const wait = BACKOFF_MS[attempt - 1] ?? 4000
          console.warn(
            `[qwen] retryable status ${res.status}, sleeping ${wait}ms`
          )
          await sleep(wait)
          lastError = new QwenApiError(
            `Qwen HTTP ${res.status}`,
            res.status,
            snippet
          )
          continue
        }

        throw new QwenApiError(
          `Qwen API error ${res.status}: ${snippet.slice(0, 200)}`,
          res.status,
          snippet
        )
      }

      const aiData = await res.json()
      console.log(
        `[qwen] model=${aiData.model} usage=${JSON.stringify(aiData.usage)}`
      )

      const content = aiData?.choices?.[0]?.message?.content
      if (!content) {
        console.error(
          '[qwen] no content in response:',
          JSON.stringify(aiData).slice(0, 500)
        )
        throw new QwenParseError(
          'Qwen response has no choices[0].message.content',
          JSON.stringify(aiData).slice(0, 500)
        )
      }

      const raw = typeof content === 'string' ? content : JSON.stringify(content)

      let parsed: unknown
      try {
        parsed = typeof content === 'string' ? JSON.parse(content) : content
      } catch (e) {
        console.error(
          '[qwen] JSON.parse failed — raw (truncated):',
          raw.slice(0, 1000)
        )
        throw new QwenParseError(
          `Invalid JSON from Qwen: ${e instanceof Error ? e.message : String(e)}`,
          raw.slice(0, 1000)
        )
      }

      return parsed as T
    } catch (e) {
      // Non-retryable errors propagate immediately unless we still have retries
      // and the error is transient (network-level).
      lastError = e

      // If it's a QwenParseError or a QwenApiError with non-retryable status, rethrow.
      if (e instanceof QwenParseError) throw e
      if (e instanceof QwenApiError) {
        if (!e.status || !RETRY_STATUS.has(e.status) || attempt >= MAX_ATTEMPTS) {
          throw e
        }
        // otherwise loop continues (already slept above when status was retryable)
        continue
      }

      // Likely fetch / network error — retry if attempts remain.
      if (attempt < MAX_ATTEMPTS) {
        const wait = BACKOFF_MS[attempt - 1] ?? 4000
        console.warn(
          `[qwen] network error on attempt ${attempt}: ${
            e instanceof Error ? e.message : String(e)
          } — sleeping ${wait}ms`
        )
        await sleep(wait)
        continue
      }

      throw new QwenApiError(
        `Qwen network error after ${MAX_ATTEMPTS} attempts: ${
          e instanceof Error ? e.message : String(e)
        }`
      )
    }
  }

  // Should be unreachable, but satisfy TS:
  if (lastError instanceof Error) throw lastError
  throw new QwenApiError('Qwen call failed without a concrete error')
}

// Email domain verification via DNS MX lookup.
// Uses Node's built-in `dns/promises` module — works on Vercel's Node runtime.
// Optionally can be swapped for an n8n workflow (see N8N_WEBHOOK_VERIFY_EMAIL
// in n8n-workflows/README.md), but the default path is native DNS.

import { promises as dns } from 'dns'

export interface EmailVerifyResult {
  ok: boolean
  error?: string
}

const EMAIL_REGEX = /^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$/
const DNS_TIMEOUT_MS = 5000

function withTimeout<T>(p: Promise<T>, ms: number, label = 'dns'): Promise<T> {
  return Promise.race<T>([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_timeout`)), ms)
    ),
  ])
}

/**
 * Verify that an email address has a routable domain by looking up MX records.
 * - Basic regex syntax check first (cheap).
 * - Then `dns.resolveMx()` with a 5s timeout.
 * - Returns `{ ok: true }` if at least one MX record is returned.
 * - Returns `{ ok: false, error: 'no_mx' | 'invalid_syntax' | 'dns_error: <msg>' }`
 *   otherwise. Never throws.
 */
export async function verifyEmailDomain(email: string): Promise<EmailVerifyResult> {
  if (!email || typeof email !== 'string') {
    return { ok: false, error: 'invalid_syntax' }
  }

  const trimmed = email.trim()
  if (!EMAIL_REGEX.test(trimmed)) {
    return { ok: false, error: 'invalid_syntax' }
  }

  const domain = trimmed.split('@')[1]?.toLowerCase()
  if (!domain) {
    return { ok: false, error: 'invalid_syntax' }
  }

  try {
    const records = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS, 'mx')
    if (!records || records.length === 0) {
      return { ok: false, error: 'no_mx' }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Most DNS failures mean "no_mx" in practice (ENOTFOUND, ENODATA).
    if (/ENOTFOUND|ENODATA|NXDOMAIN/i.test(msg)) {
      return { ok: false, error: 'no_mx' }
    }
    return { ok: false, error: `dns_error: ${msg}` }
  }
}

/**
 * Bulk-verify a list of emails. Runs in parallel, dedupes by domain where
 * possible to avoid duplicate DNS queries.
 */
export async function batchVerifyEmails(
  emails: string[]
): Promise<Record<string, EmailVerifyResult>> {
  const out: Record<string, EmailVerifyResult> = {}
  const unique = Array.from(new Set(emails.filter(Boolean)))

  // Cache per-domain results so repeated emails at the same domain share one lookup.
  const domainCache = new Map<string, Promise<EmailVerifyResult>>()

  await Promise.all(
    unique.map(async (email) => {
      const domain = email.includes('@') ? email.split('@')[1]?.toLowerCase() : ''
      if (!domain) {
        out[email] = { ok: false, error: 'invalid_syntax' }
        return
      }
      let p = domainCache.get(domain)
      if (!p) {
        p = verifyEmailDomain(email)
        domainCache.set(domain, p)
      }
      // Still re-run syntax check per full address (the cache is domain-only).
      if (!EMAIL_REGEX.test(email.trim())) {
        out[email] = { ok: false, error: 'invalid_syntax' }
        return
      }
      out[email] = await p
    })
  )

  return out
}

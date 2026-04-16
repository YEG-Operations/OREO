import { NextRequest, NextResponse } from 'next/server'

/**
 * Assert that the request originates from the same origin as the app.
 * Allows:
 *  - dev mode (NODE_ENV !== 'production')
 *  - missing Origin header (same-origin fetch from Next.js server components / internal fetches)
 *  - exact host match with NEXT_PUBLIC_APP_URL
 *  - Vercel preview deployments sharing the same *.vercel.app root
 * Returns a 403 NextResponse when disallowed, or null when allowed.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null

  const origin = req.headers.get('origin')
  // Same-origin server-to-server or RSC fetches often have no Origin header.
  if (!origin) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    // If not configured, don't block — but log for visibility.
    console.warn('[api-helpers] NEXT_PUBLIC_APP_URL not set; skipping origin check')
    return null
  }

  try {
    const originHost = new URL(origin).host
    const appHost = new URL(appUrl).host

    if (originHost === appHost) return null

    // Allow Vercel preview deployments sharing the same project root.
    // e.g. app = oreo.vercel.app -> allow *-oreo-*.vercel.app or foo.vercel.app variants
    // of the same project. Simpler heuristic: both end with .vercel.app and share
    // the project slug as a suffix fragment.
    if (originHost.endsWith('.vercel.app') && appHost.endsWith('.vercel.app')) {
      const appRoot = appHost.split('.')[0] // e.g. "oreo"
      if (originHost.includes(appRoot)) return null
    }
  } catch {
    // Malformed origin — fall through to forbidden.
  }

  return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
}

/**
 * Standardized error logger with a consistent prefix so issues are greppable.
 */
export function logError(context: string, err: unknown): void {
  console.error(`[api-error] [${context}]`, err)
}

/**
 * Run a fire-and-forget background job in a way that Vercel keeps the
 * function alive until it resolves. Uses @vercel/functions `waitUntil` when
 * available; otherwise falls back to a detached promise with error logging.
 */
export function backgroundJob(fn: () => Promise<unknown>): void {
  try {
    // Dynamic import guarded so local dev/tests don't crash if package isn't installed yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@vercel/functions') as { waitUntil?: (p: Promise<unknown>) => void }
    if (mod && typeof mod.waitUntil === 'function') {
      mod.waitUntil(
        fn().catch((err) => logError('backgroundJob', err))
      )
      return
    }
  } catch {
    // @vercel/functions not resolvable — fall back below.
  }

  void fn().catch((err) => logError('backgroundJob', err))
}

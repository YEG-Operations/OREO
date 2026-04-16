// HMAC utilities for signing/verifying webhook payloads between Next.js and n8n.
// Uses Node's built-in `crypto` module — no external dependencies.

import crypto from 'crypto'

/**
 * Sign a raw payload string with HMAC-SHA256.
 * Returns a lowercase hex digest.
 */
export function signPayload(payload: string, secret: string): string {
  if (!secret) {
    throw new Error('signPayload: secret is required')
  }
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

/**
 * Verify a signature against the expected HMAC-SHA256 of `payload` + `secret`.
 * Uses constant-time comparison via `crypto.timingSafeEqual` to prevent
 * timing attacks. Returns `false` on any error (missing secret, length mismatch,
 * invalid hex, etc.) rather than throwing.
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!payload || !signature || !secret) return false

  let expected: string
  try {
    expected = signPayload(payload, secret)
  } catch {
    return false
  }

  // Accept either "sha256=<hex>" or bare "<hex>" format.
  const normalized = signature.startsWith('sha256=') ? signature.slice(7) : signature

  // Both must be the same length hex string, otherwise timingSafeEqual throws.
  if (normalized.length !== expected.length) return false

  try {
    const a = Buffer.from(normalized, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || a.length === 0) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Generate a random 16-character hex token, safe to embed in email subjects
 * (e.g. "[REF: 9f3a2c1b5e7d8604]"). 64 bits of entropy — enough to make
 * collisions astronomically unlikely for our use-case.
 */
export function generateThreadToken(): string {
  return crypto.randomBytes(8).toString('hex')
}

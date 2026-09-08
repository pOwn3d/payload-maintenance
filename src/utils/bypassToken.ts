/**
 * Bypass cookie: a signed, expiring proof instead of the literal string 'true'.
 *
 * The previous cookie value was `true`, so `curl -H 'Cookie:
 * maintenance-bypass=true'` walked through the whole maintenance mode — the
 * cookie's `httpOnly` flag stops JavaScript from READING it, never a client
 * from SENDING it.
 *
 * Uses Web Crypto only (`crypto.subtle`), because Next.js middleware runs on
 * the Edge runtime where `node:crypto` is unavailable.
 */

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Constant-time string comparison — never `===` on a secret or a signature. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  let diff = left.length ^ right.length
  const len = Math.max(left.length, right.length)
  for (let i = 0; i < len; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return diff === 0
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return base64url(new Uint8Array(signature))
}

/** `<expiry-ms>.<hmac>` — the expiry is signed, so it cannot be pushed forward. */
export async function signBypassToken(secret: string, expiresAt: number): Promise<string> {
  const exp = String(Math.floor(expiresAt))
  return `${exp}.${await hmac(secret, exp)}`
}

export async function verifyBypassToken(
  secret: string,
  token: string | undefined | null,
  now: number = Date.now(),
): Promise<boolean> {
  // No secret configured means no bypass cookie can ever be honoured.
  if (!secret || !token) return false
  const separator = token.indexOf('.')
  if (separator <= 0) return false

  const exp = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  if (!/^\d{1,15}$/.test(exp) || !signature) return false
  if (Number(exp) <= now) return false

  return timingSafeEqualString(await hmac(secret, exp), signature)
}

/** SHA-256 (hex) — used to keep raw auth tokens out of the middleware cache. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Resolve the client IP from proxy headers.
 *
 * `x-forwarded-for` is a list the client can seed: a conforming reverse proxy
 * APPENDS the peer address, so the FIRST element is whatever the caller sent
 * and the LAST one is the only entry the proxy vouches for. Reading
 * `split(',')[0]` therefore hands an anonymous visitor full control of the
 * value used for IP allow-listing and for rate-limit keys.
 *
 * The trusted value is the entry appended by the closest trusted proxy:
 * `parts[length - trustedProxyHops]`. With the default single proxy that is the
 * last element.
 */
export interface ClientIpOptions {
  /** Read `x-forwarded-for` / `x-real-ip` at all (default: true). */
  trustProxy?: boolean
  /** Number of reverse proxies that append to `x-forwarded-for` (default: 1). */
  trustedProxyHops?: number
  /** Peer address when the runtime exposes one. */
  directIp?: string
}

interface HeaderReader {
  get(name: string): string | null
}

/** Returns '' when no address can be trusted — callers must fail closed. */
export function resolveClientIP(headers: HeaderReader, opts: ClientIpOptions = {}): string {
  const trustProxy = opts.trustProxy !== false
  const hops = Math.max(1, Math.floor(opts.trustedProxyHops ?? 1))

  if (!trustProxy) return opts.directIp?.trim() || ''

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length > 0) {
      const index = parts.length - hops
      // Fewer entries than configured hops means the header did not travel
      // through the expected chain: trust nothing rather than fall back to the
      // caller-controlled first element.
      return index >= 0 ? (parts[index] ?? '') : ''
    }
  }

  // `x-real-ip` is set (and overwritten) by the proxy, so it is only consulted
  // when the chain header is absent.
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return opts.directIp?.trim() || ''
}

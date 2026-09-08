/**
 * Guards for URLs the SERVER is going to fetch (webhooks).
 *
 * A maintenance administrator can type any URL in the webhook field, and the
 * response body is persisted in the webhook-logs collection: without these
 * checks the plugin is a read/write SSRF proxy into the host's private network
 * (cloud instance metadata, internal Elasticsearch, localhost mail catchers…).
 */

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (parts.some((p) => Number.isNaN(p) || p > 255)) return null
  return ((parts[0]! * 256 + parts[1]!) * 256 + parts[2]!) * 256 + parts[3]!
}

/** [network, prefix length] pairs that must never be reached from a webhook. */
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // RFC1918
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12], // RFC1918
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // RFC1918
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
]

export function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip)
  if (value === null) return true // unparseable: fail closed
  for (const [network, bits] of BLOCKED_V4) {
    const base = ipv4ToInt(network)
    if (base === null) continue
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    if ((value & mask) >>> 0 === (base & mask) >>> 0) return true
  }
  return false
}

export function isBlockedIPv6(raw: string): boolean {
  let ip = raw.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  const zone = ip.indexOf('%')
  if (zone !== -1) ip = ip.slice(0, zone)

  // IPv4-mapped / IPv4-compatible / NAT64 forms: `::ffff:10.0.0.1` reaches the
  // very same host as `10.0.0.1`, so it is judged on its embedded v4 address.
  const embedded = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip)
  if (embedded) return isBlockedIPv4(embedded[1]!)

  const halves = ip.split('::')
  if (halves.length > 2) return true
  const head = halves[0] ? halves[0].split(':').filter(Boolean) : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':').filter(Boolean) : []
  if (halves.length === 1 && head.length !== 8) return true
  if (head.length + tail.length > 8) return true

  const groups: number[] = []
  for (const g of head) groups.push(parseInt(g, 16))
  for (let i = head.length + tail.length; i < 8; i++) groups.push(0)
  for (const g of tail) groups.push(parseInt(g, 16))
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return true

  const isAllZero = groups.every((g) => g === 0)
  if (isAllZero) return true // ::
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true // ::1
  if ((groups[0]! & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((groups[0]! & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((groups[0]! & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

/** True when the literal address must not be contacted by the server. */
export function isBlockedAddress(ip: string): boolean {
  const trimmed = ip.trim()
  if (!trimmed) return true
  if (trimmed.includes(':')) return isBlockedIPv6(trimmed)
  return isBlockedIPv4(trimmed)
}

/** True when the hostname is written as a bare IP literal. */
export function isIpLiteral(hostname: string): boolean {
  const h = hostname.replace(/^\[/, '').replace(/\]$/, '')
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')
}

export type UrlGuardResult = { ok: true; url: URL } | { ok: false; reason: string }

export interface UrlGuardOptions {
  /** Optional host allow-list. When set, only these hostnames are reachable. */
  allowedHosts?: string[]
  /** Injected in tests; defaults to `node:dns.lookup`. */
  lookup?: (hostname: string) => Promise<string[]>
  /**
   * Accept plaintext `http://` targets (default: false).
   *
   * The address check below resolves the name ITSELF, then `fetch` resolves it
   * AGAIN: a record with a 0s TTL that alternates between a public address and
   * 169.254.169.254 slips an internal address into the second resolution. The
   * socket cannot be pinned to the validated address here — Node's `fetch`
   * silently discards a caller-supplied `Host` header (verified), so rewriting
   * the URL to the IP would break virtual-hosted targets without fixing the
   * race, and `undici` is not a dependency of this package.
   *
   * Over `https:` the TLS handshake is the pin: a rebound internal service
   * cannot present a certificate valid for the attacker's hostname, so the
   * connection fails before a request body is sent or a response is persisted.
   * Plaintext `http:` has no such identity check, so it is refused by default.
   */
  allowPlaintextHttp?: boolean
}

async function defaultLookup(hostname: string): Promise<string[]> {
  const dns = await import('node:dns/promises')
  const records = await dns.lookup(hostname, { all: true, verbatim: true })
  return records.map((r) => r.address)
}

function hostMatches(hostname: string, allowed: string): boolean {
  const h = hostname.toLowerCase()
  const a = allowed.trim().toLowerCase().replace(/^\./, '')
  if (!a) return false
  return h === a || h.endsWith(`.${a}`)
}

/**
 * Validate a server-side fetch target. Every hop of a redirect chain must be
 * re-checked with this function: a first-party host answering 302 towards
 * 169.254.169.254 defeats a check done only on the initial URL.
 */
export async function assertPublicHttpUrl(
  rawUrl: string,
  opts: UrlGuardOptions = {},
): Promise<UrlGuardResult> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'invalid URL' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'URL must use http(s)' }
  }

  if (url.protocol === 'http:' && !opts.allowPlaintextHttp) {
    return {
      ok: false,
      reason: 'plaintext http:// target refused — use https:// (see allowPlaintextHttp)',
    }
  }

  const hostname = url.hostname.replace(/^\[/, '').replace(/\]$/, '')
  if (!hostname) return { ok: false, reason: 'URL has no host' }

  if (opts.allowedHosts && opts.allowedHosts.length > 0) {
    if (!opts.allowedHosts.some((a) => hostMatches(hostname, a))) {
      return { ok: false, reason: `host "${hostname}" is not in allowedWebhookHosts` }
    }
  }

  if (isIpLiteral(hostname)) {
    if (isBlockedAddress(hostname)) {
      return { ok: false, reason: `address ${hostname} is private, loopback or link-local` }
    }
    return { ok: true, url }
  }

  // `localhost` and friends never reach DNS on some resolvers.
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, reason: 'loopback host' }
  }

  let addresses: string[]
  try {
    addresses = await (opts.lookup ?? defaultLookup)(hostname)
  } catch (e) {
    return { ok: false, reason: `DNS lookup failed for "${hostname}"` }
  }

  if (!addresses.length) return { ok: false, reason: `no address for "${hostname}"` }
  const blocked = addresses.find((a) => isBlockedAddress(a))
  if (blocked) {
    return { ok: false, reason: `"${hostname}" resolves to the internal address ${blocked}` }
  }

  return { ok: true, url }
}

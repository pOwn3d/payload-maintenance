/**
 * IP anonymisation applied at the WRITE point, never at resolution time.
 *
 * `resolveClientIP` feeds two things: the rate-limit key and the value stored in
 * `maintenance-analytics`. Truncating at resolution would merge distinct
 * visitors into the same rate-limit bucket and break `/32` allow-lists, so the
 * truncation belongs here and is applied by the track handler only.
 *
 * Why truncate at all: an untruncated IP is personal data with no retention and
 * no consent on a page a visitor cannot opt out of. The CNIL "mesure d'audience"
 * exemption asks for a truncated address, a bounded retention and information —
 * this covers the first, `analyticsRetentionDays` the second.
 *
 * IPv4 -> /24 (last octet zeroed), IPv6 -> /48 (first three groups kept).
 */

/** How the analytics collection stores the caller address. */
export type AnalyticsIpMode = 'anonymized' | 'full' | 'none'

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
/** `::ffff:203.0.113.42` and friends: an IPv4 address wearing an IPv6 prefix. */
const IPV4_MAPPED = /^([0-9a-fA-F:]*:)((?:\d{1,3}\.){3}\d{1,3})$/

/**
 * Returns the address reduced to its network prefix.
 *
 * Anything that is not recognisable as an address becomes `'unknown'` — the
 * same sentinel the endpoints already use when no IP can be resolved — rather
 * than being stored verbatim.
 */
export function anonymizeIp(value: string | null | undefined): string {
  if (typeof value !== 'string') return 'unknown'
  // Drop an RFC 4007 zone index (`fe80::1%eth0`) before parsing.
  const raw = value.trim().split('%')[0] ?? ''
  if (!raw) return 'unknown'

  const v4 = raw.match(IPV4)
  if (v4) {
    const octets = [v4[1], v4[2], v4[3]].map((part) => Number(part))
    if (octets.some((n) => !Number.isFinite(n) || n > 255)) return 'unknown'
    return `${octets[0]}.${octets[1]}.${octets[2]}.0`
  }

  const mapped = raw.match(IPV4_MAPPED)
  if (mapped) {
    const inner = anonymizeIp(mapped[2])
    return inner === 'unknown' ? 'unknown' : `${mapped[1]}${inner}`
  }

  if (raw.includes(':')) return anonymizeIpv6(raw)

  return 'unknown'
}

/**
 * Keep the first three groups (/48) and re-compress the rest.
 *
 * `::` may stand for any number of zero groups, so the groups left of it are the
 * only ones guaranteed to be leading: when there are fewer than three, the
 * missing ones are zeros by definition and are written back explicitly.
 */
function anonymizeIpv6(raw: string): string {
  const compressedAt = raw.indexOf('::')
  const head = compressedAt === -1 ? raw : raw.slice(0, compressedAt)
  const groups = head.split(':').filter(Boolean)

  // No `::` and fewer than three groups is not an address we can read.
  if (compressedAt === -1 && groups.length < 3) return 'unknown'

  const kept: string[] = []
  for (let i = 0; i < 3; i++) {
    const group = groups[i] ?? '0'
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return 'unknown'
    kept.push(group.toLowerCase())
  }

  return `${kept.join(':')}::`
}

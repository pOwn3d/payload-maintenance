import { NextResponse, type NextRequest } from 'next/server'
import { checkScheduleState } from '../utils/schedule.js'
import { resolveClientIP } from '../utils/clientIp.js'
import {
  sha256Hex,
  signBypassToken,
  timingSafeEqualString,
  verifyBypassToken,
} from '../utils/bypassToken.js'

export interface MaintenanceMiddlewareConfig {
  /** Base URL of the Payload API (default: same origin) */
  apiUrl?: string

  /** Paths that should never be blocked (default: ['/admin', '/api']) */
  excludedPaths?: string[]

  /** Cache duration in seconds for maintenance status check (default: 10) */
  cacheDuration?: number

  /** Cookie name for bypass (default: 'maintenance-bypass') */
  bypassCookieName?: string

  /** Endpoint path to check maintenance status (default: '/api/maintenance/status') */
  statusEndpoint?: string

  /** Path to the standalone HTML maintenance page endpoint (default: '/api/maintenance/page') */
  maintenancePagePath?: string

  /** Enable auth bypass — logged-in users see real site (default: true) */
  authBypass?: boolean

  /** Payload auth cookie name (default: 'payload-token') */
  authCookieName?: string

  /** Collection queried to validate the auth cookie (default: 'users').
   *  Must be the collection Payload uses for the admin panel: Payload's
   *  `/api/<slug>/me` returns `{ user: null }` for a token issued by any other
   *  auth collection, which is what keeps customer accounts from bypassing
   *  maintenance mode. */
  usersCollectionSlug?: string

  /** Return HTTP 503 status instead of 200 for SEO (default: true) */
  return503?: boolean

  /** Bypass secret — when provided, visitors can add ?bypass=SECRET to get a 24h bypass cookie.
   *  This is configured server-side and never exposed via the public status API. */
  bypassSecret?: string

  /** Allowed IPs that bypass maintenance mode.
   *  Configured server-side and never exposed via the public status API. */
  allowedIPs?: string[]

  /** Trust proxy headers for IP detection (default: true).
   *  Set to false when not behind a trusted reverse proxy.
   *  Note that without a proxy that overwrites `x-forwarded-for`, `allowedIPs`
   *  is not a security control: the header is client-supplied. */
  trustProxy?: boolean

  /** Number of reverse proxies that append to `x-forwarded-for` (default: 1).
   *  The client IP is read as `parts[length - trustedProxyHops]`, because a
   *  conforming proxy APPENDS the peer address: the FIRST element of the header
   *  is the one the caller sent. Set 2 for CDN + load balancer, and so on. */
  trustedProxyHops?: number

  /** Lifetime of the bypass cookie in seconds (default: 86400). */
  bypassCookieMaxAge?: number
}

interface CachedStatus {
  enabled: boolean
  excludedRoutes: string[]
  authBypass: boolean
  isAuthenticated: boolean
  estimatedEnd: string | null
  timestamp: number
}

let cachedStatus: CachedStatus | null = null

/** Last-resort state when the status endpoint has never answered successfully. */
function coldStartStatus(now: number): CachedStatus {
  return {
    enabled: false,
    excludedRoutes: [],
    authBypass: true,
    isAuthenticated: false,
    estimatedEnd: null,
    timestamp: now,
  }
}

async function fetchMaintenanceStatus(
  origin: string,
  statusEndpoint: string,
  cacheDuration: number,
): Promise<CachedStatus> {
  const now = Date.now()
  if (cachedStatus && now - cachedStatus.timestamp < cacheDuration * 1000) {
    return cachedStatus
  }

  try {
    const res = await fetch(`${origin}${statusEndpoint}`, {
      cache: 'no-store',
    } as RequestInit)
    // A non-2xx answer (503 when the database is down, 429 under rate limiting)
    // still parses as JSON, so an unchecked res.json() used to be read as
    // "no maintenance" and let all traffic through at the worst moment.
    if (!res.ok) throw new Error(`status endpoint returned HTTP ${res.status}`)
    const data = await res.json()
    if (typeof data?.enabled !== 'boolean') {
      throw new Error('status endpoint returned no boolean "enabled" field')
    }

    // Check scheduled maintenance inline using shared utility
    const scheduledOverride = checkScheduleState({
      enabled: Boolean(data.enabled),
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      autoEnable: data.autoEnable,
      autoDisable: data.autoDisable,
      timezone: data.timezone,
    })

    cachedStatus = {
      enabled: scheduledOverride ?? Boolean(data.enabled),
      excludedRoutes: data.excludedRoutes || [],
      authBypass: data.authBypass !== false,
      isAuthenticated: Boolean(data.isAuthenticated),
      estimatedEnd: data.estimatedEnd || null,
      timestamp: now,
    }
    return cachedStatus
  } catch (error) {
    // Keep serving the last known state instead of fabricating a fresh
    // `enabled: false`, and say so — a silent fail-open here un-publishes the
    // 503 + X-Robots-Tag and lets crawlers index a broken site.
    // The stale entry is returned as-is (its timestamp is not refreshed), so the
    // next request retries the endpoint rather than caching the failure.
    console.warn(`[maintenance] Status check failed, keeping last known state: ${error}`)
    return cachedStatus ?? coldStartStatus(now)
  }
}

/**
 * Validate a Payload auth token by calling /api/users/me; results are cached
 * for 15 seconds to avoid excessive requests.
 *
 * Two zones, not one. A single Map evicted in insertion order let an anonymous
 * flood of unknown tokens push out the `valid: true` entries of signed-in
 * admins — every one of them went back to a `/me` round-trip on every page.
 * Negative results can only ever evict other negative results.
 */
const authPositiveCache = new Map<string, { valid: boolean; expiresAt: number }>()
const authNegativeCache = new Map<string, { valid: boolean; expiresAt: number }>()

/** Hard cap per zone. Without one, an anonymous visitor presenting a fresh
 *  random token per request grew this Map for the lifetime of the process:
 *  expired entries were only ever overwritten if the SAME token came back,
 *  which never happens with random values. */
const AUTH_CACHE_MAX_ENTRIES = 500

function evictTo(cache: Map<string, { valid: boolean; expiresAt: number }>, max: number): void {
  if (cache.size < max) return
  const now = Date.now()
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k)
  }
  // Still full of live entries: evict oldest first (Map keeps insertion order).
  while (cache.size >= max) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

function rememberAuthResult(key: string, valid: boolean, expiresAt: number): void {
  const cache = valid ? authPositiveCache : authNegativeCache
  const other = valid ? authNegativeCache : authPositiveCache
  // A token cannot be in both zones: drop the stale answer when it flips.
  other.delete(key)
  evictTo(cache, AUTH_CACHE_MAX_ENTRIES)
  cache.set(key, { valid, expiresAt })
}

function readAuthResult(key: string): { valid: boolean; expiresAt: number } | undefined {
  return authPositiveCache.get(key) ?? authNegativeCache.get(key)
}

/** Test hook: lets the suite assert that the cache stays bounded. */
export function __authTokenCacheSize(): number {
  return authPositiveCache.size + authNegativeCache.size
}

/** Test hook: positive entries must survive a flood of anonymous tokens. */
export function __authPositiveCacheSize(): number {
  return authPositiveCache.size
}

/** Payload issues a JWT in its auth cookie. Anything that is not shaped like
 *  one cannot be valid, so it is rejected without the `/me` round-trip that
 *  turned one anonymous request into two internal ones. */
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

/** `atob` is available on both the Edge runtime and Node — `Buffer` is not. */
function decodeJwtSegment(segment: string): Record<string, unknown> | null {
  if (!segment || segment.length > 1024) return null
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const parsed: unknown = JSON.parse(atob(padded))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Tolerance on `exp`; Payload signs the token in the same deployment, so any
 *  real skew is tiny, but a hard boundary would evict a token a second early. */
const JWT_EXP_SKEW_SECONDS = 60

/**
 * Cheap, network-free pre-check. It is deliberately conservative: it rejects
 * only what CANNOT be a live Payload session (wrong shape, header that is not
 * JSON with an `alg`, payload whose `exp` is already past). Anything it cannot
 * read is still sent to `/me` — Payload, not this filter, decides validity.
 */
export function looksLikeAuthToken(token: string, now: number = Date.now()): boolean {
  if (token.length > 4096 || !JWT_SHAPE.test(token)) return false

  const [header, body] = token.split('.')
  const decodedHeader = decodeJwtSegment(header!)
  if (!decodedHeader || typeof decodedHeader.alg !== 'string') return false

  const decodedBody = decodeJwtSegment(body!)
  if (decodedBody && typeof decodedBody.exp === 'number') {
    if (decodedBody.exp + JWT_EXP_SKEW_SECONDS < Math.floor(now / 1000)) return false
  }
  return true
}

async function validateAuthToken(
  origin: string,
  token: string,
  usersCollectionSlug: string,
  authCookieName: string,
  /** '' when no address can be attributed to the caller — see the throttle note. */
  clientIP: string,
): Promise<boolean> {
  if (!looksLikeAuthToken(token)) return false

  const now = Date.now()
  // The cache is keyed by a digest, never by the token itself: a middleware
  // process should not hold a pile of live session JWTs in memory.
  const cacheKey = `${usersCollectionSlug}:${await sha256Hex(token)}`
  const cached = readAuthResult(cacheKey)
  if (cached && now < cached.expiresAt) {
    return cached.valid
  }

  // Every cache miss becomes an internal `/me` call, so one anonymous request
  // becomes two. Only MISSES THAT TURNED OUT INVALID are counted, and only for
  // a caller we can actually attribute: an un-attributable bucket would be a
  // shared one, and a shared bucket is a lever an anonymous visitor can pull to
  // lock signed-in admins out. An admin already validated in the last 15s never
  // reaches this line — the positive cache answers first.
  if (clientIP && !attemptAllowed(`auth:${clientIP}`, AUTH_LOOKUP_FAILURE_MAX, 60_000)) {
    return false
  }

  try {
    // Payload's `me` operation returns `{ user: null }` when the token belongs
    // to another auth collection, so querying the admin collection here is what
    // stops a customer/member account from bypassing maintenance mode.
    // The cookie must be echoed back under its configured name: a host with a
    // custom cookiePrefix was silently losing the bypass.
    const meRes = await fetch(`${origin}/api/${usersCollectionSlug}/me`, {
      headers: { Cookie: `${authCookieName}=${token}` },
      cache: 'no-store',
    } as RequestInit)
    if (meRes.ok) {
      const meData = await meRes.json()
      const valid = Boolean(meData?.user)
      rememberAuthResult(cacheKey, valid, now + 15_000)
      if (!valid && clientIP) recordFailure(`auth:${clientIP}`, 60_000)
      return valid
    }
  } catch {
    // Network error: deny the bypass for this request, but do NOT cache it.
    // Caching here pinned the wrong answer for 15s, so one transient blip locked
    // a signed-in admin out of the site for the whole window. Returning early
    // lets the very next request retry.
    return false
  }
  // Reached only when Payload answered with a non-ok status (401/403): that is a
  // real negative and is worth caching.
  rememberAuthResult(cacheKey, false, now + 15_000)
  if (clientIP) recordFailure(`auth:${clientIP}`, 60_000)
  return false
}

/**
 * Failure counters, keyed by caller identity ONLY — never by a shared bucket.
 *
 * A global `__all__` counter was added here to slow `?bypass=` brute forcing and
 * became a denial-of-service switch instead: any anonymous visitor could burn
 * it and the operator's own correct link was then refused. A bucket an attacker
 * can fill on someone else's behalf is not a rate limit, it is a lever.
 *
 * The window never slides: `resetAt` is fixed on the first failure, so repeated
 * failures cannot extend a lockout indefinitely.
 */
const failureCounters = new Map<string, { count: number; resetAt: number }>()
const FAILURE_MAX_KEYS = 1000

/** Wrong `?bypass=` values tolerated per caller per minute. */
const BYPASS_FAILURE_MAX = 10
/** Unknown auth cookies tolerated per caller per minute before `/me` is skipped. */
const AUTH_LOOKUP_FAILURE_MAX = 30

function attemptAllowed(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = failureCounters.get(key)
  if (!entry || now > entry.resetAt) return true
  return entry.count < max
}

function recordFailure(key: string, windowMs: number): void {
  const now = Date.now()
  const entry = failureCounters.get(key)
  if (!entry || now > entry.resetAt) {
    if (failureCounters.size >= FAILURE_MAX_KEYS) {
      for (const [k, v] of failureCounters) {
        if (now > v.resetAt) failureCounters.delete(k)
      }
      while (failureCounters.size >= FAILURE_MAX_KEYS) {
        const oldest = failureCounters.keys().next()
        if (oldest.done) break
        failureCounters.delete(oldest.value)
      }
    }
    failureCounters.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  entry.count++
}

/**
 * Creates a Next.js middleware handler for maintenance mode.
 *
 * Features:
 * - HTTP 503 + Retry-After for SEO
 * - Auth bypass for logged-in Payload users
 * - Per-route exclusion
 * - IP whitelist
 * - Bypass cookie + secret
 * - Scheduled maintenance auto-toggle
 */
/**
 * Match a pathname against a route prefix on segment boundaries.
 *
 * `'/administration'.startsWith('/admin')` is true, which is why a raw prefix
 * test let unrelated routes escape maintenance mode. A prefix matches only when
 * the pathname IS that route or continues with `/`.
 */
export function matchesPathPrefix(pathname: string, prefix: string): boolean {
  if (!prefix) return false
  const normalized = prefix.length > 1 && prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  if (normalized === '/') return true
  return pathname === normalized || pathname.startsWith(`${normalized}/`)
}

export function createMaintenanceMiddleware(config: MaintenanceMiddlewareConfig = {}) {
  const excludedPaths = config.excludedPaths ?? ['/admin', '/api']
  const cacheDuration = config.cacheDuration ?? 10
  const bypassCookieName = config.bypassCookieName ?? 'maintenance-bypass'
  const statusEndpoint = config.statusEndpoint ?? '/api/maintenance/status'
  const maintenancePagePath = config.maintenancePagePath ?? '/api/maintenance/page'
  const enableAuthBypass = config.authBypass !== false
  const authCookieName = config.authCookieName ?? 'payload-token'
  const usersCollectionSlug = config.usersCollectionSlug ?? 'users'
  const return503 = config.return503 !== false
  const bypassSecret = config.bypassSecret || null
  const allowedIPs = config.allowedIPs || []
  const trustProxy = config.trustProxy !== false
  const trustedProxyHops = Math.max(1, Math.floor(config.trustedProxyHops ?? 1))
  const bypassCookieMaxAge = Math.max(60, Math.floor(config.bypassCookieMaxAge ?? 60 * 60 * 24))

  if (allowedIPs.length > 0 && !trustProxy) {
    console.warn(
      '[maintenance] allowedIPs is set but trustProxy is false: this runtime does not expose a ' +
        'peer address to Next.js middleware, so the allow-list will never match. Put the plugin ' +
        'behind a proxy that rewrites x-forwarded-for and set trustedProxyHops instead.',
    )
  }

  return async (request: NextRequest): Promise<NextResponse | null> => {
    const { pathname } = request.nextUrl

    // Never block excluded paths. Match on segment boundaries, not raw prefix:
    // a bare `startsWith('/admin')` also excluded `/administration-des-ventes`,
    // which then stayed online during maintenance.
    if (excludedPaths.some((p) => matchesPathPrefix(pathname, p))) {
      return null
    }

    // Never block static assets
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot|mp4|webm)$/)
    ) {
      return null
    }

    // Never block the maintenance page API endpoint itself
    if (pathname === maintenancePagePath) {
      return null
    }

    // Rewrite /maintenance to the API endpoint (so preview iframe and direct access work)
    if (pathname === '/maintenance') {
      const url = new URL(maintenancePagePath, request.nextUrl.origin)
      url.search = request.nextUrl.search // forward ?preview=true etc.
      return NextResponse.rewrite(url)
    }

    const origin = config.apiUrl || request.nextUrl.origin
    const status = await fetchMaintenanceStatus(origin, statusEndpoint, cacheDuration)

    if (!status.enabled) return null

    // One resolution of the caller's address for the whole request: the auth
    // throttle, the `?bypass=` throttle and the allow-list must not disagree on
    // who the caller is.
    const clientIP = resolveClientIP(request.headers, {
      trustProxy,
      trustedProxyHops,
      directIp: (request as { ip?: string }).ip,
    })

    // Auth bypass: validate token against Payload /api/users/me with caching
    if (enableAuthBypass && status.authBypass) {
      const authCookie = request.cookies.get(authCookieName)
      if (authCookie?.value) {
        const isValid = await validateAuthToken(
          origin,
          authCookie.value,
          usersCollectionSlug,
          authCookieName,
          clientIP,
        )
        if (isValid) return null
      }
    }

    // Check bypass cookie. The value used to be the literal string 'true', so
    // `curl -H 'Cookie: maintenance-bypass=true'` walked through the whole
    // maintenance mode — `httpOnly` stops JavaScript from READING the cookie,
    // never a client from SENDING it. It is now a signed, expiring proof, and
    // it is only ever honoured when a bypassSecret is configured.
    const bypassCookie = request.cookies.get(bypassCookieName)
    if (bypassSecret && bypassCookie?.value) {
      if (await verifyBypassToken(bypassSecret, bypassCookie.value)) return null
    }

    // Check bypass secret in query params (secret is configured server-side, never exposed via API)
    if (bypassSecret) {
      const bypassParam = request.nextUrl.searchParams.get('bypass')
      if (bypassParam) {
        // Throttle only a caller we can name. The previous version also
        // consulted a global bucket and fell back to a shared `'unknown'` key,
        // so any anonymous visitor could exhaust both and the operator's own
        // valid link was then refused — and counted as one more failure.
        const throttleKey = clientIP ? `bypass:${clientIP}` : null
        const throttled =
          throttleKey !== null && !attemptAllowed(throttleKey, BYPASS_FAILURE_MAX, 60_000)
        // Constant-time comparison: `===` on a secret leaks it one character at
        // a time to an attacker who can measure the answer.
        if (!throttled && timingSafeEqualString(bypassParam, bypassSecret)) {
          const expiresAt = Date.now() + bypassCookieMaxAge * 1000
          const response = NextResponse.redirect(request.nextUrl.origin + pathname)
          response.cookies.set(bypassCookieName, await signBypassToken(bypassSecret, expiresAt), {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: bypassCookieMaxAge,
          })
          return response
        }
        // Only a genuinely wrong secret is counted. A throttled attempt is not
        // re-counted: the window is fixed at the first failure and must not be
        // extendable by continuing to hammer it.
        if (!throttled && throttleKey !== null) recordFailure(throttleKey, 60_000)
      }
    }

    // Check allowed IPs (configured server-side, never exposed via API).
    // `clientIP` is the entry appended by the trusted proxy, not the first
    // element of x-forwarded-for: that one is whatever the caller sent, and
    // reading it let an anonymous visitor claim any whitelisted address.
    if (allowedIPs.length > 0 && clientIP && allowedIPs.includes(clientIP)) {
      return null
    }

    // Check excluded routes
    if (status.excludedRoutes.length > 0) {
      const isExcluded = status.excludedRoutes.some((route) => {
        if (route.endsWith('*')) {
          return pathname.startsWith(route.slice(0, -1))
        }
        return pathname === route
      })
      if (isExcluded) return null
    }

    // Fetch the standalone HTML maintenance page from the endpoint
    try {
      const pageUrl = `${origin}${maintenancePagePath}`
      const pageRes = await fetch(pageUrl, { cache: 'no-store' } as RequestInit)
      const html = await pageRes.text()

      const response = new NextResponse(html, {
        status: return503 ? 503 : 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Robots-Tag': 'noindex',
        },
      })

      // SEO: Retry-After header
      if (status.estimatedEnd) {
        const end = new Date(status.estimatedEnd)
        const seconds = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000))
        response.headers.set('Retry-After', String(seconds))
      } else {
        response.headers.set('Retry-After', '3600')
      }

      return response
    } catch {
      // Fallback: rewrite to /maintenance if the page endpoint fails
      const maintenanceUrl = new URL('/maintenance', request.nextUrl.origin)
      maintenanceUrl.searchParams.set('from', pathname)
      return NextResponse.rewrite(maintenanceUrl, {
        status: return503 ? 503 : undefined,
      })
    }
  }
}

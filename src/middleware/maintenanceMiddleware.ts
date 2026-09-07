import { NextResponse, type NextRequest } from 'next/server'
import { checkScheduleState } from '../utils/schedule.js'

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
   *  Set to false when not behind a trusted reverse proxy. */
  trustProxy?: boolean
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
 * Validate a Payload auth token by calling /api/users/me.
 * Results are cached for 15 seconds to avoid excessive requests.
 */
const authTokenCache = new Map<string, { valid: boolean; expiresAt: number }>()

async function validateAuthToken(
  origin: string,
  token: string,
  usersCollectionSlug: string,
  authCookieName: string,
): Promise<boolean> {
  const now = Date.now()
  const cached = authTokenCache.get(`${usersCollectionSlug}:${token}`)
  if (cached && now < cached.expiresAt) {
    return cached.valid
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
      authTokenCache.set(`${usersCollectionSlug}:${token}`, { valid, expiresAt: now + 15_000 })
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
  authTokenCache.set(`${usersCollectionSlug}:${token}`, { valid: false, expiresAt: now + 15_000 })
  return false
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

    // Auth bypass: validate token against Payload /api/users/me with caching
    if (enableAuthBypass && status.authBypass) {
      const authCookie = request.cookies.get(authCookieName)
      if (authCookie?.value) {
        const isValid = await validateAuthToken(
          origin,
          authCookie.value,
          usersCollectionSlug,
          authCookieName,
        )
        if (isValid) return null
      }
    }

    // Check bypass cookie
    const bypassCookie = request.cookies.get(bypassCookieName)
    if (bypassCookie?.value === 'true') return null

    // Check bypass secret in query params (secret is configured server-side, never exposed via API)
    if (bypassSecret) {
      const bypassParam = request.nextUrl.searchParams.get('bypass')
      if (bypassParam === bypassSecret) {
        const response = NextResponse.redirect(request.nextUrl.origin + pathname)
        response.cookies.set(bypassCookieName, 'true', {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24, // 24h
        })
        return response
      }
    }

    // Check allowed IPs (configured server-side, never exposed via API)
    if (allowedIPs.length > 0) {
      let clientIP: string
      if (trustProxy) {
        clientIP =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          ''
      } else {
        clientIP = (request as any).ip || ''
      }
      if (clientIP && allowedIPs.includes(clientIP)) {
        return null
      }
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

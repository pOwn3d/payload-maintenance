import { NextResponse, type NextRequest } from 'next/server'

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

  /** Enable auth bypass — logged-in users see real site (default: true) */
  authBypass?: boolean

  /** Payload auth cookie name (default: 'payload-token') */
  authCookieName?: string

  /** Return HTTP 503 status instead of 200 for SEO (default: true) */
  return503?: boolean
}

interface CachedStatus {
  enabled: boolean
  bypassSecret: string | null
  allowedIPs: string[]
  excludedRoutes: string[]
  authBypass: boolean
  estimatedEnd: string | null
  timestamp: number
}

let cachedStatus: CachedStatus | null = null

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
    const data = await res.json()

    // Check scheduled maintenance inline
    const scheduledEnabled = checkSchedule(data)

    cachedStatus = {
      enabled: scheduledEnabled ?? Boolean(data.enabled),
      bypassSecret: data.bypassSecret || null,
      allowedIPs: data.allowedIPs || [],
      excludedRoutes: data.excludedRoutes || [],
      authBypass: data.authBypass !== false,
      estimatedEnd: data.estimatedEnd || null,
      timestamp: now,
    }
    return cachedStatus
  } catch {
    return {
      enabled: false,
      bypassSecret: null,
      allowedIPs: [],
      excludedRoutes: [],
      authBypass: true,
      estimatedEnd: null,
      timestamp: now,
    }
  }
}

/**
 * Get current time in a given IANA timezone for comparison.
 * Returns a Date-like timestamp adjusted so that simple comparisons
 * with schedule dates (stored as local times) work correctly.
 */
function getNowInTimezone(timezone: string | null | undefined): Date {
  if (!timezone) return new Date()
  try {
    // Format current UTC time in the target timezone, then parse it back
    const nowStr = new Date().toLocaleString('en-US', { timeZone: timezone })
    return new Date(nowStr)
  } catch {
    // Invalid timezone — fall back to UTC
    return new Date()
  }
}

function checkSchedule(data: any): boolean | null {
  const now = getNowInTimezone(data.timezone)

  if (data.scheduledStart && data.autoEnable && !data.enabled) {
    const start = new Date(data.scheduledStart)
    if (now >= start) return true
  }

  if (data.scheduledEnd && data.autoDisable && data.enabled) {
    const end = new Date(data.scheduledEnd)
    if (now >= end) return false
  }

  return null
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
export function createMaintenanceMiddleware(config: MaintenanceMiddlewareConfig = {}) {
  const excludedPaths = config.excludedPaths ?? ['/admin', '/api']
  const cacheDuration = config.cacheDuration ?? 10
  const bypassCookieName = config.bypassCookieName ?? 'maintenance-bypass'
  const statusEndpoint = config.statusEndpoint ?? '/api/maintenance/status'
  const enableAuthBypass = config.authBypass !== false
  const authCookieName = config.authCookieName ?? 'payload-token'
  const return503 = config.return503 !== false

  return async (request: NextRequest): Promise<NextResponse | null> => {
    const { pathname } = request.nextUrl

    // Never block excluded paths
    if (excludedPaths.some((p) => pathname.startsWith(p))) {
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

    // Never block the maintenance page itself
    if (pathname === '/maintenance') {
      return null
    }

    const origin = config.apiUrl || request.nextUrl.origin
    const status = await fetchMaintenanceStatus(origin, statusEndpoint, cacheDuration)

    if (!status.enabled) return null

    // Auth bypass: logged-in Payload users see real site
    if (enableAuthBypass && status.authBypass) {
      const authCookie = request.cookies.get(authCookieName)
      if (authCookie?.value) return null
    }

    // Check bypass cookie
    const bypassCookie = request.cookies.get(bypassCookieName)
    if (bypassCookie?.value === 'true') return null

    // Check bypass secret in query params
    if (status.bypassSecret) {
      const bypassParam = request.nextUrl.searchParams.get('bypass')
      if (bypassParam === status.bypassSecret) {
        const response = NextResponse.redirect(request.nextUrl.origin + pathname)
        response.cookies.set(bypassCookieName, 'true', {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24, // 24h
        })
        return response
      }
    }

    // Check allowed IPs
    const clientIP =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      ''
    if (clientIP && status.allowedIPs.includes(clientIP)) {
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

    // Show maintenance page with proper SEO status
    const maintenanceUrl = new URL('/maintenance', request.nextUrl.origin)
    maintenanceUrl.searchParams.set('from', pathname)

    const response = NextResponse.rewrite(maintenanceUrl, {
      status: return503 ? 503 : undefined,
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
  }
}

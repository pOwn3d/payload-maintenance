import type { PayloadHandler } from 'payload'
import crypto from 'crypto'
import { rateLimit, rateLimitResponse } from '../utils/rateLimiter.js'
import { getEffectiveEnabled, checkScheduleState } from '../utils/schedule.js'

function resolveMediaUrl(media: any): string | null {
  if (!media) return null
  if (typeof media === 'string') return media
  return media.url || media.filename ? `/${media.filename}` : null
}

/** Extract client IP from request headers */
function getClientIP(req: any, trustProxy: boolean = true): string {
  if (trustProxy) {
    return (
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.ip ||
      'unknown'
    )
  }
  // When trustProxy is false, only use direct connection IP
  return req.ip || 'unknown'
}

/**
 * Public endpoint to check maintenance status (read-only, no side-effects).
 * Used by the Next.js middleware and the MaintenancePage component.
 *
 * Schedule-based auto-toggle has been moved to the POST schedule-check endpoint
 * to avoid side-effects in a GET handler.
 */
export function createStatusHandler(globalSlug: string, trustProxy: boolean = true): PayloadHandler {
  return async (req) => {
    // Rate limit: 60 requests per minute per IP
    const ip = getClientIP(req, trustProxy)
    const { allowed, retryAfter } = rateLimit(`status:${ip}`, 60, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    try {
      const maintenance = await req.payload.findGlobal({
        slug: globalSlug,
        overrideAccess: true,
        depth: 1,
      })

      // Read-only schedule check — compute effective state without mutating global
      const enabled = getEffectiveEnabled({
        enabled: Boolean(maintenance.enabled),
        scheduledStart: maintenance.scheduledStart as string | null,
        scheduledEnd: maintenance.scheduledEnd as string | null,
        autoEnable: Boolean(maintenance.autoEnable),
        autoDisable: Boolean(maintenance.autoDisable),
        timezone: maintenance.timezone as string | null,
      })

      const excludedRoutesRaw = (maintenance.excludedRoutes as string) || ''
      const excludedRoutes = excludedRoutesRaw
        .split('\n')
        .map((r: string) => r.trim())
        .filter(Boolean)

      return Response.json({
        enabled,
        isAuthenticated: Boolean(req.user),
        template: maintenance.template || 'minimal',
        maintenanceType: maintenance.maintenanceType || 'maintenance',
        messages: maintenance.messages || [],
        estimatedEnd: maintenance.estimatedEnd || null,
        excludedPaths: ['/admin', '/api'],
        excludedRoutes,
        authBypass: maintenance.authBypass !== false,
        // Media
        logoUrl: resolveMediaUrl(maintenance.logo) || null,
        backgroundImageUrl: resolveMediaUrl(maintenance.backgroundImage) || null,
        faviconUrl: resolveMediaUrl(maintenance.favicon) || null,
        splitImageUrl: resolveMediaUrl(maintenance.splitImage) || null,
        videoUrl: (maintenance.videoUrl as string) || null,
        // Design
        backgroundColor: maintenance.backgroundColor || '#0f172a',
        textColor: maintenance.textColor || '#f8fafc',
        accentColor: maintenance.accentColor || '#3b82f6',
        backgroundOverlayOpacity: maintenance.backgroundOverlayOpacity ?? 70,
        showProgressBar: Boolean(maintenance.showProgressBar),
        darkMode: maintenance.darkMode || 'dark',
        googleFont: maintenance.googleFont || null,
        lottieUrl: maintenance.lottieUrl || null,
        customCSS: maintenance.customCSS || null,
        customHTML: maintenance.customHTML || null,
        // Social & Contact
        socialLinks: maintenance.socialLinks || [],
        contactEmail: maintenance.contactEmail || null,
        showNewsletterForm: Boolean(maintenance.showNewsletterForm),
        newsletterPlaceholder: maintenance.newsletterPlaceholder || 'votre@email.com',
        newsletterButtonLabel: maintenance.newsletterButtonLabel || 'Me notifier',
        // Scheduling
        scheduledStart: maintenance.scheduledStart || null,
        scheduledEnd: maintenance.scheduledEnd || null,
        timezone: maintenance.timezone || null,
        // Admin UI
        showDashboardToggle: maintenance.showDashboardToggle !== false,
      })
    } catch (error) {
      return Response.json({
        enabled: false,
        template: 'minimal',
        messages: [],
        error: 'Failed to fetch maintenance status',
      })
    }
  }
}

/**
 * Toggle maintenance mode on/off (admin only).
 */
export function createToggleHandler(globalSlug: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const current = await req.payload.findGlobal({
        slug: globalSlug,
        overrideAccess: true,
      })

      const newState = !current.enabled

      await req.payload.updateGlobal({
        slug: globalSlug,
        data: { enabled: newState },
        overrideAccess: true,
      })

      return Response.json({
        enabled: newState,
        message: newState ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
      })
    } catch (error) {
      return Response.json(
        { error: 'Failed to toggle maintenance mode' },
        { status: 500 },
      )
    }
  }
}

/**
 * Newsletter signup handler — stores email in subscribers collection.
 * Requires GDPR consent field in request body.
 */
export function createNewsletterHandler(
  globalSlug: string,
  subscribersSlug: string = 'maintenance-subscribers',
  enableSubscribers: boolean = true,
): PayloadHandler {
  return async (req) => {
    // Rate limit: 5 requests per minute per IP
    const ip = getClientIP(req)
    const { allowed, retryAfter } = rateLimit(`newsletter:${ip}`, 5, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    try {
      const body = await req.json?.() as { email?: string; language?: string; consent?: boolean } | undefined
      const email = body?.email
      const language = body?.language
      const consent = body?.consent

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!email || !emailRegex.test(email)) {
        return Response.json({ error: 'Invalid email format' }, { status: 400 })
      }

      // GDPR consent is required
      if (!consent) {
        return Response.json({ error: 'Consent is required' }, { status: 400 })
      }

      if (enableSubscribers) {
        // Check for duplicate
        const existing = await req.payload.find({
          collection: subscribersSlug as any,
          where: { email: { equals: email } },
          limit: 1,
        })

        if (existing.totalDocs > 0) {
          return Response.json({ success: true, message: 'Already registered' })
        }

        await req.payload.create({
          collection: subscribersSlug as any,
          data: {
            email,
            language: language || 'unknown',
            subscribedAt: new Date().toISOString(),
            ip,
            userAgent: req.headers.get('user-agent') || '',
            consentAt: new Date().toISOString(),
            consentSource: 'maintenance-page',
            unsubscribeToken: crypto.randomUUID(),
          },
        })
      }

      req.payload.logger.info(`[maintenance] Newsletter signup: ${email}`)
      return Response.json({ success: true, message: 'Email registered' })
    } catch (error) {
      return Response.json({ error: 'Failed to register email' }, { status: 500 })
    }
  }
}

/**
 * CSV export of subscribers (admin only).
 */
export function createSubscribersExportHandler(
  subscribersSlug: string = 'maintenance-subscribers',
): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      // Paginated fetch to collect all subscribers without arbitrary limit
      const allDocs: any[] = []
      let page = 1
      while (true) {
        const result = await req.payload.find({
          collection: subscribersSlug as any,
          limit: 500,
          page,
          sort: '-subscribedAt',
        })
        allDocs.push(...result.docs)
        if (!result.hasNextPage) break
        page++
        if (page > 100) break // safety limit
      }

      const csvHeader = '\uFEFFemail,language,subscribedAt,ip\n'
      const csvRows = allDocs
        .map((s: any) => `${s.email},${s.language || ''},${s.subscribedAt || ''},${s.ip || ''}`)
        .join('\n')

      return new Response(csvHeader + csvRows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="maintenance-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    } catch (error) {
      return Response.json({ error: 'Failed to export subscribers' }, { status: 500 })
    }
  }
}

/**
 * Get subscribers count + recent history (admin only).
 */
export function createStatsHandler(
  subscribersSlug: string = 'maintenance-subscribers',
  historySlug: string = 'maintenance-history',
  enableSubscribers: boolean = true,
  enableHistory: boolean = true,
): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      let subscribersCount = 0
      if (enableSubscribers) {
        const subs = await req.payload.find({
          collection: subscribersSlug as any,
          limit: 0,
        })
        subscribersCount = subs.totalDocs
      }

      let recentHistory: any[] = []
      if (enableHistory) {
        const history = await req.payload.find({
          collection: historySlug as any,
          limit: 10,
          sort: '-timestamp',
        })
        recentHistory = history.docs
      }

      return Response.json({ subscribersCount, recentHistory })
    } catch (error) {
      return Response.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
  }
}

/**
 * Track a page view during maintenance mode (public, fire-and-forget).
 */
export function createTrackViewHandler(analyticsSlug: string = 'maintenance-analytics'): PayloadHandler {
  return async (req) => {
    // Rate limit: 30 requests per minute per IP
    const ip = getClientIP(req)
    const { allowed, retryAfter } = rateLimit(`track:${ip}`, 30, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    try {
      const body = await req.json?.() as { path?: string } | undefined
      const path = body?.path || '/'

      const userAgent = req.headers.get('user-agent') || ''
      const referer = req.headers.get('referer') || ''

      // Fire-and-forget insert — don't await
      req.payload.create({
        collection: analyticsSlug as any,
        data: {
          path,
          ip,
          userAgent,
          referer,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {})

      return Response.json({ tracked: true })
    } catch {
      return Response.json({ tracked: false })
    }
  }
}

/**
 * Get analytics stats for maintenance page views (admin only).
 */
export function createAnalyticsHandler(analyticsSlug: string = 'maintenance-analytics'): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      // Parse optional `since` query parameter (ISO date) to limit the period
      const url = new URL(req.url || '', 'http://localhost')
      const sinceParam = url.searchParams.get('since')
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))

      const where: Record<string, any> = {}
      if (sinceParam) {
        where.timestamp = { greater_than: sinceParam }
      }

      const allViews = await req.payload.find({
        collection: analyticsSlug as any,
        limit: 1000,
        page,
        sort: '-timestamp',
        where,
      })

      const docs = allViews.docs as any[]
      const totalViews = allViews.totalDocs

      // Unique IPs
      const uniqueIPs = new Set(docs.map((d) => d.ip).filter(Boolean)).size

      // Top paths
      const pathCounts: Record<string, number> = {}
      for (const doc of docs) {
        const p = doc.path || '/'
        pathCounts[p] = (pathCounts[p] || 0) + 1
      }
      const topPaths = Object.entries(pathCounts)
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Views by hour (last 24h)
      const now = Date.now()
      const last24h = docs.filter((d) => d.timestamp && (now - new Date(d.timestamp).getTime()) < 86400000)
      const hourCounts: Record<string, number> = {}
      for (const doc of last24h) {
        const hour = new Date(doc.timestamp).toISOString().slice(0, 13) + ':00'
        hourCounts[hour] = (hourCounts[hour] || 0) + 1
      }
      const viewsByHour = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour))

      // Top referers
      const refererCounts: Record<string, number> = {}
      for (const doc of docs) {
        const ref = doc.referer || ''
        if (!ref) continue
        refererCounts[ref] = (refererCounts[ref] || 0) + 1
      }
      const topReferers = Object.entries(refererCounts)
        .map(([referer, count]) => ({ referer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return Response.json({
        totalViews,
        uniqueIPs,
        topPaths,
        viewsByHour,
        topReferers,
        pagination: {
          page,
          totalPages: allViews.totalPages,
          hasNextPage: allViews.hasNextPage,
        },
      })
    } catch (error) {
      return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }
  }
}

/** Module-level flag to prevent concurrent schedule check updates */
let scheduleCheckInProgress = false

/**
 * Check scheduled maintenance and auto-toggle if needed (admin only).
 * Called by middleware or cron.
 */
export function createScheduleCheckHandler(globalSlug: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (scheduleCheckInProgress) {
      return Response.json({ message: 'Check already in progress' })
    }
    scheduleCheckInProgress = true

    try {
      const maintenance = await req.payload.findGlobal({
        slug: globalSlug,
        overrideAccess: true,
      })

      const currentState = Boolean(maintenance.enabled)
      const override = checkScheduleState({
        enabled: currentState,
        scheduledStart: maintenance.scheduledStart as string | null,
        scheduledEnd: maintenance.scheduledEnd as string | null,
        autoEnable: Boolean(maintenance.autoEnable),
        autoDisable: Boolean(maintenance.autoDisable),
        timezone: maintenance.timezone as string | null,
      })

      const changed = override !== null
      const newState = override ?? currentState

      if (changed) {
        await req.payload.updateGlobal({
          slug: globalSlug,
          data: { enabled: newState },
          overrideAccess: true,
        })
      }

      return Response.json({
        checked: true,
        changed,
        enabled: newState,
      })
    } catch (error) {
      return Response.json({ error: 'Schedule check failed' }, { status: 500 })
    } finally {
      scheduleCheckInProgress = false
    }
  }
}

/**
 * Unsubscribe handler — removes subscriber by token (public, GET).
 */
export function createUnsubscribeHandler(subscribersSlug: string, trustProxy: boolean = true): PayloadHandler {
  return async (req) => {
    // Rate limit: 10 requests per minute per IP to prevent DB enumeration
    const ip = getClientIP(req, trustProxy)
    const { allowed, retryAfter } = rateLimit(`unsubscribe:${ip}`, 10, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    const url = new URL(req.url || '', 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

    // Validate token format (UUID v4) to avoid unnecessary DB queries
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return Response.json({ error: 'Invalid token format' }, { status: 400 })
    }

    const result = await req.payload.find({
      collection: subscribersSlug as any,
      where: { unsubscribeToken: { equals: token } },
      limit: 1,
    })

    if (!result.docs.length) {
      return Response.json({ error: 'Invalid token' }, { status: 404 })
    }

    await req.payload.delete({
      collection: subscribersSlug as any,
      id: result.docs[0].id,
    })

    // Return a simple HTML page confirming unsubscription
    return new Response(
      '<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#f8fafc"><div style="text-align:center"><h1>&#10003;</h1><p>You have been unsubscribed.</p></div></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    )
  }
}

/**
 * Return plugin configuration slugs so client components can build
 * correct links without hardcoding collection/global slugs.
 */
export function createConfigHandler(opts: {
  globalSlug: string
  subscribersSlug: string
  historySlug: string
  basePath: string
}): PayloadHandler {
  // Config is static — compute the response once
  const body = JSON.stringify({
    globalSlug: opts.globalSlug,
    subscribersSlug: opts.subscribersSlug,
    historySlug: opts.historySlug,
    basePath: opts.basePath,
  })

  return async () => {
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }
}

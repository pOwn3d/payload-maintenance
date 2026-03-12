import type { PayloadHandler } from 'payload'
import crypto from 'crypto'
import { rateLimit, rateLimitResponse } from '../utils/rateLimiter.js'

/**
 * Get current time in a given IANA timezone for schedule comparison.
 */
function getNowInTimezone(timezone: string | null | undefined): Date {
  if (!timezone) return new Date()
  try {
    const nowStr = new Date().toLocaleString('en-US', { timeZone: timezone })
    return new Date(nowStr)
  } catch {
    return new Date()
  }
}

function resolveMediaUrl(media: any): string | null {
  if (!media) return null
  if (typeof media === 'string') return media
  return media.url || media.filename ? `/${media.filename}` : null
}

/** Extract client IP from request headers */
function getClientIP(req: any): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Public endpoint to check maintenance status.
 * Used by the Next.js middleware and the MaintenancePage component.
 */
export function createStatusHandler(globalSlug: string): PayloadHandler {
  return async (req) => {
    // Rate limit: 60 requests per minute per IP
    const ip = getClientIP(req)
    const { allowed, retryAfter } = rateLimit(`status:${ip}`, 60, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    try {
      const maintenance = await req.payload.findGlobal({
        slug: globalSlug,
        overrideAccess: true,
        depth: 1,
      })

      // Inline schedule check — auto-correct the global if schedule says so
      let enabled = Boolean(maintenance.enabled)
      const now = getNowInTimezone(maintenance.timezone as string | null | undefined)

      if (
        maintenance.autoEnable &&
        maintenance.scheduledStart &&
        !enabled
      ) {
        const start = new Date(maintenance.scheduledStart as string)
        if (now >= start) {
          enabled = true
          req.payload.updateGlobal({
            slug: globalSlug,
            data: { enabled: true },
            overrideAccess: true,
          }).catch(() => {})
        }
      }

      if (
        maintenance.autoDisable &&
        maintenance.scheduledEnd &&
        enabled
      ) {
        const end = new Date(maintenance.scheduledEnd as string)
        if (now >= end) {
          enabled = false
          req.payload.updateGlobal({
            slug: globalSlug,
            data: { enabled: false },
            overrideAccess: true,
          }).catch(() => {})
        }
      }

      const allowedIPsRaw = (maintenance.allowedIPs as string) || ''
      const allowedIPs = allowedIPsRaw
        .split('\n')
        .map((ip: string) => ip.trim())
        .filter(Boolean)

      const excludedRoutesRaw = (maintenance.excludedRoutes as string) || ''
      const excludedRoutes = excludedRoutesRaw
        .split('\n')
        .map((r: string) => r.trim())
        .filter(Boolean)

      return Response.json({
        enabled,
        template: maintenance.template || 'minimal',
        maintenanceType: maintenance.maintenanceType || 'maintenance',
        messages: maintenance.messages || [],
        estimatedEnd: maintenance.estimatedEnd || null,
        allowedIPs,
        bypassSecret: maintenance.bypassSecret || null,
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
      const subscribers = await req.payload.find({
        collection: subscribersSlug as any,
        limit: 10000,
        sort: '-subscribedAt',
      })

      const csvHeader = '\uFEFFemail,language,subscribedAt,ip\n'
      const csvRows = subscribers.docs
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
      // Fetch all views
      const allViews = await req.payload.find({
        collection: analyticsSlug as any,
        limit: 10000,
        sort: '-timestamp',
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
      })
    } catch (error) {
      return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }
  }
}

/**
 * Check scheduled maintenance and auto-toggle if needed (admin only).
 * Called by middleware or cron.
 */
export function createScheduleCheckHandler(globalSlug: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const maintenance = await req.payload.findGlobal({
        slug: globalSlug,
        overrideAccess: true,
      })

      const now = new Date()
      let changed = false
      let newState = Boolean(maintenance.enabled)

      // Auto-enable
      if (
        maintenance.autoEnable &&
        maintenance.scheduledStart &&
        !maintenance.enabled
      ) {
        const start = new Date(maintenance.scheduledStart as string)
        if (now >= start) {
          newState = true
          changed = true
        }
      }

      // Auto-disable
      if (
        maintenance.autoDisable &&
        maintenance.scheduledEnd &&
        maintenance.enabled
      ) {
        const end = new Date(maintenance.scheduledEnd as string)
        if (now >= end) {
          newState = false
          changed = true
        }
      }

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
    }
  }
}

/**
 * Unsubscribe handler — removes subscriber by token (public, GET).
 */
export function createUnsubscribeHandler(subscribersSlug: string): PayloadHandler {
  return async (req) => {
    const url = new URL(req.url || '', 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

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

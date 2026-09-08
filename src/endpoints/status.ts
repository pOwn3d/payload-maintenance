import type { PayloadHandler } from 'payload'
import crypto from 'crypto'
import { rateLimit, rateLimitResponse } from '../utils/rateLimiter.js'
import { getEffectiveEnabled, checkScheduleState } from '../utils/schedule.js'
import { isMaintenanceAdmin, unauthorizedResponse, type AdminAccessOptions } from '../utils/access.js'
import { resolveClientIP } from '../utils/clientIp.js'
import { anonymizeIp, type AnalyticsIpMode } from '../utils/anonymizeIp.js'
import { runRetentionPurge, type RetentionOptions } from '../utils/retention.js'

/**
 * Quote every CSV cell and neutralise spreadsheet formula injection.
 * Two exported columns (`language`, `ip`) originate from an anonymous request on
 * /newsletter, and Excel evaluates any cell starting with = + - @ (tab / CR too)
 * — including inside quotes — as soon as the admin opens the export.
 */
function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${guarded.replace(/"/g, '""')}"`
}

function resolveMediaUrl(media: any, mediaSlug: string): string | null {
  if (!media) return null
  // An unpopulated relation is a bare id — a string on Mongo, a number on
  // SQLite/Postgres. The numeric case already fell through to null, but the
  // string case was returned verbatim and rendered as <img src="65f1c2d3…">.
  // Accept a string only when it actually looks like a URL.
  if (typeof media === 'number') return null
  if (typeof media === 'string') return /^(https?:\/\/|\/)/.test(media) ? media : null
  // Operator precedence: `a || b ? x : null` parses as `(a || b) ? x : null`,
  // so the real URL served by Payload (or by the storage adapter) used to be
  // tested and then discarded in favour of a bare `/<filename>` path that 404s.
  if (media.url) return media.url as string
  return media.filename ? `/api/${mediaSlug}/file/${media.filename}` : null
}

/**
 * Extract the client IP from request headers.
 *
 * Reading `x-forwarded-for.split(',')[0]` handed the caller full control of the
 * value: a conforming proxy APPENDS the peer address, so the first element is
 * whatever the client sent. Rotating that header defeated every per-IP rate
 * limit here and poisoned the `ip` column stored on subscribers and analytics
 * rows — the very field these collections keep for GDPR traceability.
 */
function getClientIP(req: any, trustProxy: boolean = true, trustedProxyHops: number = 1): string {
  return (
    resolveClientIP(req.headers, { trustProxy, trustedProxyHops, directIp: req.ip }) || 'unknown'
  )
}

/**
 * Second limiter, not keyed on the caller-supplied IP: even a perfectly
 * resolved IP can be rotated behind a botnet, and these two endpoints write a
 * row per call. The per-IP limit stays the primary control; this one caps what
 * the whole endpoint can insert per minute.
 */
const GLOBAL_WRITE_LIMITS = { newsletter: 200, track: 600 } as const

/** Public free-text fields are persisted, so they must be bounded. */
function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

/**
 * `path` is written verbatim into the analytics collection. Anything that is
 * not a plausible pathname is recorded as '/' rather than stored: the field
 * accepted 100 KB of attacker-chosen text per anonymous request.
 */
export function normalizeTrackedPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/'
  if (trimmed.length > 512) return '/'
  // Control characters would land in the admin list view as-is.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return '/'
  return trimmed
}

/**
 * Public endpoint to check maintenance status (read-only, no side-effects).
 * Used by the Next.js middleware and the MaintenancePage component.
 *
 * Schedule-based auto-toggle has been moved to the POST schedule-check endpoint
 * to avoid side-effects in a GET handler.
 */
export function createStatusHandler(
  globalSlug: string,
  trustProxy: boolean = true,
  mediaSlug: string = 'media',
  excludedPaths: string[] = ['/admin', '/api'],
  trustedProxyHops: number = 1,
): PayloadHandler {
  return async (req) => {
    // Rate limit: 60 requests per minute per IP
    const ip = getClientIP(req, trustProxy, trustedProxyHops)
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
        excludedPaths,
        excludedRoutes,
        authBypass: maintenance.authBypass !== false,
        // Media
        logoUrl: resolveMediaUrl(maintenance.logo, mediaSlug) || null,
        backgroundImageUrl: resolveMediaUrl(maintenance.backgroundImage, mediaSlug) || null,
        faviconUrl: resolveMediaUrl(maintenance.favicon, mediaSlug) || null,
        splitImageUrl: resolveMediaUrl(maintenance.splitImage, mediaSlug) || null,
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
      // Fail closed, and loudly. Answering HTTP 200 `{enabled: false}` here told
      // every caller "no maintenance" at the exact moment the database was down,
      // which let the middleware serve a broken site (and let crawlers index it).
      // `enabled` is deliberately absent from the body so a caller that ignores
      // the status code cannot read a fabricated "false".
      req.payload.logger.error(`[maintenance] Status check failed: ${error}`)
      return Response.json(
        { error: 'Failed to fetch maintenance status' },
        { status: 503, headers: { 'Retry-After': '10' } },
      )
    }
  }
}

/**
 * Toggle maintenance mode on/off (admin only).
 */
export function createToggleHandler(
  globalSlug: string,
  adminOptions: AdminAccessOptions = {},
): PayloadHandler {
  return async (req) => {
    if (!(await isMaintenanceAdmin(req, adminOptions))) {
      return unauthorizedResponse()
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
 * Single acknowledgement for every newsletter outcome — see the enumeration
 * note below. Clients must not branch on this string.
 */
const NEWSLETTER_ACK = 'If this address is valid, you will be notified.'

/**
 * Newsletter signup handler — stores email in subscribers collection.
 * Requires GDPR consent field in request body.
 */
export function createNewsletterHandler(
  globalSlug: string,
  subscribersSlug: string = 'maintenance-subscribers',
  enableSubscribers: boolean = true,
  trustProxy: boolean = true,
  trustedProxyHops: number = 1,
): PayloadHandler {
  return async (req) => {
    // Rate limit: 5 requests per minute per IP. `trustProxy` was not forwarded
    // here, so a host that had explicitly disabled proxy trust was still rate
    // limited on a header the caller controls.
    const ip = getClientIP(req, trustProxy, trustedProxyHops)
    const { allowed, retryAfter } = rateLimit(`newsletter:${ip}`, 5, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)
    const global = rateLimit('newsletter:__all__', GLOBAL_WRITE_LIMITS.newsletter, 60_000)
    if (!global.allowed) return rateLimitResponse(global.retryAfter)

    try {
      const body = await req.json?.() as { email?: string; language?: string; consent?: boolean } | undefined
      const email = body?.email
      const language = body?.language
      const consent = body?.consent

      // Validate email format. The length bound comes FIRST and is not
      // negotiable: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is satisfied by two megabytes
      // of 'a' followed by '@x.fr', and Payload's own `email` validation does
      // not bound the length either — so an anonymous caller could write rows of
      // arbitrary size into a collection that has no retention. 254 is the
      // RFC 5321 maximum for a forward path.
      // Same 400 body in both cases: a distinct "too long" answer would tell the
      // caller something about the check, and the message must stay generic
      // exactly like the signup acknowledgement below.
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (typeof email !== 'string' || email.length > 254 || !emailRegex.test(email)) {
        return Response.json({ error: 'Invalid email format' }, { status: 400 })
      }

      // GDPR consent is required
      if (!consent) {
        return Response.json({ error: 'Consent is required' }, { status: 400 })
      }

      // The browser language ends up verbatim in the CSV export, so keep it to a
      // strict BCP-47 subset. An unexpected value is recorded as 'unknown'
      // rather than rejected: a signup must not fail on an exotic locale tag.
      const safeLanguage = language && /^[a-z]{2}(-[A-Z]{2})?$/.test(language) ? language : 'unknown'

      if (enableSubscribers) {
        // Check for duplicate
        const existing = await req.payload.find({
          collection: subscribersSlug as any,
          where: { email: { equals: email } },
          limit: 1,
        })

        // The answer must not tell the caller whether the address was already
        // known: the two distinct messages turned this public endpoint into an
        // email-enumeration oracle.
        if (existing.totalDocs > 0) {
          return Response.json({ success: true, message: NEWSLETTER_ACK })
        }

        await req.payload.create({
          collection: subscribersSlug as any,
          data: {
            email,
            language: safeLanguage,
            subscribedAt: new Date().toISOString(),
            ip,
            userAgent: clampText(req.headers.get('user-agent'), 512),
            consentAt: new Date().toISOString(),
            consentSource: 'maintenance-page',
            unsubscribeToken: crypto.randomUUID(),
          },
        })
      }

      req.payload.logger.info(`[maintenance] Newsletter signup: ${email}`)
      return Response.json({ success: true, message: NEWSLETTER_ACK })
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
  adminOptions: AdminAccessOptions = {},
): PayloadHandler {
  return async (req) => {
    if (!(await isMaintenanceAdmin(req, adminOptions))) {
      return unauthorizedResponse()
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
        .map((s: any) =>
          [csvCell(s.email), csvCell(s.language), csvCell(s.subscribedAt), csvCell(s.ip)].join(','),
        )
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
  adminOptions: AdminAccessOptions = {},
): PayloadHandler {
  return async (req) => {
    if (!(await isMaintenanceAdmin(req, adminOptions))) {
      return unauthorizedResponse()
    }

    try {
      let subscribersCount = 0
      if (enableSubscribers) {
        // `limit: 0` in Payload means "no pagination", not "no document": it
        // loaded and hydrated the whole subscribers table just to read an int.
        const subs = await req.payload.count({ collection: subscribersSlug as any })
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
export function createTrackViewHandler(
  analyticsSlug: string = 'maintenance-analytics',
  trustProxy: boolean = true,
  trustedProxyHops: number = 1,
  analyticsIpMode: AnalyticsIpMode = 'anonymized',
): PayloadHandler {
  return async (req) => {
    // Rate limit: 30 requests per minute per IP. `trustProxy` was not forwarded
    // here, so rotating X-Forwarded-For gave an anonymous caller an unlimited
    // number of buckets — and one analytics row per request.
    const ip = getClientIP(req, trustProxy, trustedProxyHops)
    const { allowed, retryAfter } = rateLimit(`track:${ip}`, 30, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)
    const global = rateLimit('track:__all__', GLOBAL_WRITE_LIMITS.track, 60_000)
    if (!global.allowed) return rateLimitResponse(global.retryAfter)

    try {
      const body = await req.json?.() as { path?: string } | undefined
      const path = normalizeTrackedPath(body?.path)

      const userAgent = clampText(req.headers.get('user-agent'), 512)
      const referer = clampText(req.headers.get('referer'), 512)

      // The rate-limit key above keeps the FULL address on purpose; only the
      // stored copy is reduced. 'none' omits the column entirely rather than
      // writing an empty string, so a host can prove nothing was collected.
      const storedIp =
        analyticsIpMode === 'full' ? ip : analyticsIpMode === 'none' ? null : anonymizeIp(ip)

      // Fire-and-forget insert — don't await
      req.payload.create({
        collection: analyticsSlug as any,
        data: {
          path,
          ...(storedIp === null ? {} : { ip: storedIp }),
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
export function createAnalyticsHandler(
  analyticsSlug: string = 'maintenance-analytics',
  adminOptions: AdminAccessOptions = {},
): PayloadHandler {
  return async (req) => {
    if (!(await isMaintenanceAdmin(req, adminOptions))) {
      return unauthorizedResponse()
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

/**
 * Retention purge (admin only).
 *
 * Deletes analytics rows — and subscribers, when `subscribersRetentionDays` is
 * configured — older than their retention. This is the MANUAL fallback: when
 * the host runs Payload Jobs, `plugin.ts` registers a task that calls the very
 * same `runRetentionPurge`, and this endpoint stays available for hosts that do
 * not (standalone builds, serverless without a scheduler, one-off cleanups).
 *
 * Gated exactly like `/toggle` and `/analytics`: the rows it deletes are the
 * only audience data the site has, so `!!req.user` is not enough.
 */
export function createRetentionPurgeHandler(
  retention: RetentionOptions,
  adminOptions: AdminAccessOptions = {},
): PayloadHandler {
  return async (req) => {
    if (!(await isMaintenanceAdmin(req, adminOptions))) {
      return unauthorizedResponse()
    }

    try {
      const report = await runRetentionPurge(req.payload, retention)
      return Response.json({ purged: true, ...report })
    } catch {
      return Response.json({ error: 'Retention purge failed' }, { status: 500 })
    }
  }
}

/** Module-level flag to prevent concurrent schedule check updates */
let scheduleCheckInProgress = false

/**
 * Check scheduled maintenance and auto-toggle if needed (admin only).
 * Called by middleware or cron.
 */
export function createScheduleCheckHandler(
  globalSlug: string,
  adminOptions: AdminAccessOptions = {},
): PayloadHandler {
  return async (req) => {
    if (!(await isMaintenanceAdmin(req, adminOptions))) {
      return unauthorizedResponse()
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
export function createUnsubscribeHandler(
  subscribersSlug: string,
  trustProxy: boolean = true,
  trustedProxyHops: number = 1,
): PayloadHandler {
  return async (req) => {
    // Rate limit: 10 requests per minute per IP to prevent DB enumeration
    const ip = getClientIP(req, trustProxy, trustedProxyHops)
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

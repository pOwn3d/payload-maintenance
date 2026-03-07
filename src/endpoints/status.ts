import type { PayloadHandler } from 'payload'

function resolveMediaUrl(media: any): string | null {
  if (!media) return null
  if (typeof media === 'string') return media
  return media.url || media.filename ? `/${media.filename}` : null
}

/**
 * Public endpoint to check maintenance status.
 * Used by the Next.js middleware and the MaintenancePage component.
 */
export function createStatusHandler(globalSlug: string): PayloadHandler {
  return async (req) => {
    try {
      const maintenance = await req.payload.findGlobal({
        slug: globalSlug,
        overrideAccess: true,
        depth: 1,
      })

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
        enabled: Boolean(maintenance.enabled),
        template: maintenance.template || 'minimal',
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
 */
export function createNewsletterHandler(
  globalSlug: string,
  subscribersSlug: string = 'maintenance-subscribers',
  enableSubscribers: boolean = true,
): PayloadHandler {
  return async (req) => {
    try {
      const body = await req.json?.() as { email?: string; language?: string } | undefined
      const email = body?.email
      const language = body?.language

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: 'Invalid email' }, { status: 400 })
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

        const ip =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          ''

        await req.payload.create({
          collection: subscribersSlug as any,
          data: {
            email,
            language: language || 'unknown',
            subscribedAt: new Date().toISOString(),
            ip,
            userAgent: req.headers.get('user-agent') || '',
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

      const csvHeader = 'email,language,subscribedAt,ip\n'
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
 * Check scheduled maintenance and auto-toggle if needed.
 * Called by middleware or cron.
 */
export function createScheduleCheckHandler(globalSlug: string): PayloadHandler {
  return async (req) => {
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

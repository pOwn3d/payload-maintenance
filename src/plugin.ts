/**
 * Payload CMS Maintenance Plugin.
 *
 * Full-featured maintenance mode for Payload + Next.js:
 * - Customizable maintenance page (8 templates)
 * - Multi-language with auto-detection (7+ languages)
 * - Admin panel always accessible
 * - IP whitelist, bypass secret, auth bypass
 * - Scheduled maintenance (auto on/off)
 * - Newsletter subscribers collection with CSV export
 * - History/audit log
 * - Webhooks (Slack, Discord, custom)
 * - HTTP 503 + Retry-After for SEO
 * - Dark/Light/Auto mode
 * - Google Fonts, Lottie animations
 * - Custom CSS/HTML support
 */

import type { Config, Plugin } from 'payload'
import { deepMergeSimple } from 'payload/shared'
import type { MaintenancePluginConfig } from './types.js'
import { createMaintenanceGlobal } from './globals/Maintenance.js'
import { createSubscribersCollection } from './collections/MaintenanceSubscribers.js'
import { createHistoryCollection } from './collections/MaintenanceHistory.js'
import { createAnalyticsCollection } from './collections/MaintenanceAnalytics.js'
import { createWebhookLogsCollection } from './collections/WebhookLogs.js'
import {
  createStatusHandler,
  createToggleHandler,
  createNewsletterHandler,
  createSubscribersExportHandler,
  createStatsHandler,
  createScheduleCheckHandler,
  createTrackViewHandler,
  createAnalyticsHandler,
  createUnsubscribeHandler,
  createConfigHandler,
} from './endpoints/status.js'
import { createMaintenancePageHandler } from './endpoints/page.js'
import { createPresetsListHandler, createApplyPresetHandler } from './endpoints/presets.js'
import { translations } from './translations/index.js'

export const maintenancePlugin =
  (pluginConfig: MaintenancePluginConfig = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }
    const globalSlug = pluginConfig.globalSlug ?? 'maintenance'
    const basePath = pluginConfig.endpointBasePath ?? '/maintenance'
    const addDashboardView = pluginConfig.addDashboardView !== false
    const enableSubscribers = pluginConfig.enableSubscribers !== false
    const subscribersSlug = pluginConfig.subscribersSlug ?? 'maintenance-subscribers'
    const enableHistory = pluginConfig.enableHistory !== false
    const historySlug = pluginConfig.historySlug ?? 'maintenance-history'
    const enableScheduling = pluginConfig.enableScheduling !== false
    const enableAnalytics = pluginConfig.enableAnalytics !== false
    const analyticsSlug = pluginConfig.analyticsSlug ?? 'maintenance-analytics'
    const webhookLogsSlug = pluginConfig.webhookLogsSlug ?? 'maintenance-webhook-logs'
    const mediaSlug = pluginConfig.mediaCollectionSlug ?? 'media'
    const excludedPaths = pluginConfig.excludedPaths ?? ['/admin', '/api']
    const adminOptions = {
      adminCollectionSlug: pluginConfig.adminCollectionSlug,
      adminAccess: pluginConfig.adminAccess,
    }

    // These options were documented but never read by the plugin: they are
    // middleware concerns and the middleware runs in another process, with no
    // access to this config. Warn instead of failing silently — an integrator
    // whitelisting their IP here would otherwise be locked out by their own
    // maintenance page without a single message.
    const middlewareOnlyOptions = [
      ['allowedIPs', pluginConfig.allowedIPs],
      ['bypassSecret', pluginConfig.bypassSecret],
      ['bypassCookieName', pluginConfig.bypassCookieName],
      ['authBypass', pluginConfig.authBypass],
      ['maintenancePageComponent', pluginConfig.maintenancePageComponent],
    ] as const
    for (const [name, value] of middlewareOnlyOptions) {
      if (value !== undefined) {
        console.warn(
          `[maintenance] Plugin option "${name}" is not read by the plugin and has no effect. ` +
            `Pass it to createMaintenanceMiddleware() in your middleware.ts instead.`,
        )
      }
    }

    // `usersCollectionSlug` is in the same family, but louder: it is the option
    // an existing install is most likely to have set (its only documented use
    // was the middleware bypass), so it must NOT be promoted into the admin
    // authorization gate — a value that is not the host's admin collection
    // would lock its own admins out of the global and answer 401 on /toggle.
    // The gate reads `adminCollectionSlug`, which defaults to `config.admin.user`.
    if (pluginConfig.usersCollectionSlug !== undefined) {
      const hostAdminCollection = (incomingConfig.admin?.user as string | undefined) ?? 'users'
      const differs = pluginConfig.usersCollectionSlug !== hostAdminCollection
      console.warn(
        `[maintenance] Plugin option "usersCollectionSlug" is not read by the plugin and has no ` +
          `effect. It only configures the Next.js middleware auth bypass: pass it to ` +
          `createMaintenanceMiddleware({ usersCollectionSlug }). The admin authorization gate ` +
          `uses "adminCollectionSlug" (default: config.admin.user = "${hostAdminCollection}")` +
          (differs
            ? ` — yours is "${pluginConfig.usersCollectionSlug}", which is NOT that collection, ` +
              `so set "adminCollectionSlug" explicitly if you meant to change who administers ` +
              `maintenance mode.`
            : `.`),
      )
    }

    // 1. Merge i18n translations
    config.i18n = {
      ...config.i18n,
      translations: deepMergeSimple(translations, config.i18n?.translations ?? {}),
    }

    // 2. Add the maintenance global
    config.globals = [
      ...(config.globals || []),
      createMaintenanceGlobal(pluginConfig),
    ]

    // 3. Add collections
    config.collections = config.collections || []

    if (enableSubscribers) {
      config.collections = [
        ...config.collections,
        createSubscribersCollection(subscribersSlug, adminOptions),
      ]
    }

    if (enableHistory) {
      config.collections = [
        ...config.collections,
        createHistoryCollection(historySlug, adminOptions),
      ]
    }

    if (enableAnalytics) {
      config.collections = [
        ...config.collections,
        createAnalyticsCollection(analyticsSlug, adminOptions),
      ]
    }

    // Always add webhook logs collection
    config.collections = [
      ...config.collections,
      createWebhookLogsCollection(webhookLogsSlug, adminOptions),
    ]

    // 4. Add API endpoints
    config.endpoints = [
      ...(config.endpoints || []),
      {
        path: `${basePath}/status`,
        method: 'get' as const,
        handler: createStatusHandler(
          globalSlug,
          pluginConfig.trustProxy,
          mediaSlug,
          excludedPaths,
          pluginConfig.trustedProxyHops,
        ),
      },
      {
        path: `${basePath}/toggle`,
        method: 'post' as const,
        handler: createToggleHandler(globalSlug, adminOptions),
      },
      {
        path: `${basePath}/newsletter`,
        method: 'post' as const,
        handler: createNewsletterHandler(
          globalSlug,
          subscribersSlug,
          enableSubscribers,
          pluginConfig.trustProxy,
          pluginConfig.trustedProxyHops,
        ),
      },
      {
        path: `${basePath}/stats`,
        method: 'get' as const,
        handler: createStatsHandler(subscribersSlug, historySlug, enableSubscribers, enableHistory, adminOptions),
      },
    ]

    if (enableSubscribers) {
      config.endpoints.push(
        {
          path: `${basePath}/subscribers/export`,
          method: 'get' as const,
          handler: createSubscribersExportHandler(subscribersSlug, adminOptions),
        },
        {
          path: `${basePath}/unsubscribe`,
          method: 'get' as const,
          handler: createUnsubscribeHandler(
            subscribersSlug,
            pluginConfig.trustProxy,
            pluginConfig.trustedProxyHops,
          ),
        },
      )
    }

    if (enableAnalytics) {
      config.endpoints.push(
        {
          path: `${basePath}/track`,
          method: 'post' as const,
          handler: createTrackViewHandler(
            analyticsSlug,
            pluginConfig.trustProxy,
            pluginConfig.trustedProxyHops,
          ),
        },
        {
          path: `${basePath}/analytics`,
          method: 'get' as const,
          handler: createAnalyticsHandler(analyticsSlug, adminOptions),
        },
      )
    }

    if (enableScheduling) {
      config.endpoints.push({
        path: `${basePath}/schedule-check`,
        method: 'post' as const,
        handler: createScheduleCheckHandler(globalSlug, adminOptions),
      })
    }

    // Plugin config endpoint (used by NavLink and Dashboard components)
    config.endpoints.push({
      path: `${basePath}/config`,
      method: 'get' as const,
      handler: createConfigHandler({
        globalSlug,
        subscribersSlug,
        historySlug,
        basePath,
      }),
    })

    // Standalone HTML maintenance page
    config.endpoints.push({
      path: `${basePath}/page`,
      method: 'get' as const,
      handler: createMaintenancePageHandler(basePath),
    })

    // Presets endpoints
    config.endpoints.push(
      {
        path: `${basePath}/presets`,
        method: 'get' as const,
        handler: createPresetsListHandler(),
      },
      {
        path: `${basePath}/presets/apply`,
        method: 'post' as const,
        handler: createApplyPresetHandler(globalSlug, adminOptions),
      },
    )

    // 5. Add admin dashboard view
    if (addDashboardView) {
      if (!config.admin) config.admin = {}
      if (!config.admin.components) config.admin.components = {}
      if (!config.admin.components.views) config.admin.components.views = {}

      ;(config.admin.components.views as Record<string, unknown>).maintenance = {
        Component: '@consilioweb/payload-maintenance/views#MaintenanceView',
        path: '/maintenance',
      }
    }

    if (!config.admin) config.admin = {}
    if (!config.admin.components) config.admin.components = {}

    // 6. Inject beforeDashboard toggle widget (configurable via showDashboardToggle)
    const showDashboardToggle = pluginConfig.showDashboardToggle !== false
    if (showDashboardToggle) {
      const existingBeforeDashboard = config.admin.components.beforeDashboard || []
      config.admin.components.beforeDashboard = [
        '@consilioweb/payload-maintenance/client#MaintenanceToggle',
        ...(Array.isArray(existingBeforeDashboard) ? existingBeforeDashboard : [existingBeforeDashboard]),
      ]
    }

    // 7. Inject sidebar nav group with icons (afterNavLinks)
    const navLinks = config.admin.components.afterNavLinks || []
    config.admin.components.afterNavLinks = [
      ...(Array.isArray(navLinks) ? navLinks : [navLinks]),
      '@consilioweb/payload-maintenance/client#MaintenanceNavLink',
    ]

    return config
  }

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
        createSubscribersCollection(subscribersSlug),
      ]
    }

    if (enableHistory) {
      config.collections = [
        ...config.collections,
        createHistoryCollection(historySlug),
      ]
    }

    if (enableAnalytics) {
      config.collections = [
        ...config.collections,
        createAnalyticsCollection(analyticsSlug),
      ]
    }

    // Always add webhook logs collection
    config.collections = [
      ...config.collections,
      createWebhookLogsCollection(webhookLogsSlug),
    ]

    // 4. Add API endpoints
    config.endpoints = [
      ...(config.endpoints || []),
      {
        path: `${basePath}/status`,
        method: 'get' as const,
        handler: createStatusHandler(globalSlug),
      },
      {
        path: `${basePath}/toggle`,
        method: 'post' as const,
        handler: createToggleHandler(globalSlug),
      },
      {
        path: `${basePath}/newsletter`,
        method: 'post' as const,
        handler: createNewsletterHandler(globalSlug, subscribersSlug, enableSubscribers),
      },
      {
        path: `${basePath}/stats`,
        method: 'get' as const,
        handler: createStatsHandler(subscribersSlug, historySlug, enableSubscribers, enableHistory),
      },
    ]

    if (enableSubscribers) {
      config.endpoints.push(
        {
          path: `${basePath}/subscribers/export`,
          method: 'get' as const,
          handler: createSubscribersExportHandler(subscribersSlug),
        },
        {
          path: `${basePath}/unsubscribe`,
          method: 'get' as const,
          handler: createUnsubscribeHandler(subscribersSlug),
        },
      )
    }

    if (enableAnalytics) {
      config.endpoints.push(
        {
          path: `${basePath}/track`,
          method: 'post' as const,
          handler: createTrackViewHandler(analyticsSlug),
        },
        {
          path: `${basePath}/analytics`,
          method: 'get' as const,
          handler: createAnalyticsHandler(analyticsSlug),
        },
      )
    }

    if (enableScheduling) {
      config.endpoints.push({
        path: `${basePath}/schedule-check`,
        method: 'get' as const,
        handler: createScheduleCheckHandler(globalSlug),
      })
    }

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
        handler: createApplyPresetHandler(globalSlug),
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

    // 6. Inject beforeDashboard toggle widget
    if (!config.admin) config.admin = {}
    if (!config.admin.components) config.admin.components = {}

    const existingBeforeDashboard = config.admin.components.beforeDashboard || []
    config.admin.components.beforeDashboard = [
      '@consilioweb/payload-maintenance/client#MaintenanceToggle',
      ...(Array.isArray(existingBeforeDashboard) ? existingBeforeDashboard : [existingBeforeDashboard]),
    ]

    return config
  }

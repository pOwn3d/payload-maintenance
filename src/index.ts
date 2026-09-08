// Server-side exports — plugin, types, globals, endpoints, collections
export { maintenancePlugin } from './plugin.js'
export { createMaintenanceGlobal } from './globals/Maintenance.js'
export { createSubscribersCollection } from './collections/MaintenanceSubscribers.js'
export { createHistoryCollection } from './collections/MaintenanceHistory.js'
export { createAnalyticsCollection } from './collections/MaintenanceAnalytics.js'
export { createWebhookLogsCollection } from './collections/WebhookLogs.js'
export {
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
export { createRetentionPurgeHandler } from './endpoints/status.js'
export { rateLimit, rateLimitResponse } from './utils/rateLimiter.js'
// Exported so a host that already runs its own scheduler can call the sweep
// directly instead of going through the HTTP endpoint.
export {
  runRetentionPurge,
  DEFAULT_ANALYTICS_RETENTION_DAYS,
} from './utils/retention.js'
export type { RetentionOptions, RetentionReport } from './utils/retention.js'
export { anonymizeIp } from './utils/anonymizeIp.js'
export type { AnalyticsIpMode } from './utils/anonymizeIp.js'
export { RETENTION_TASK_SLUG } from './plugin.js'
export { isMaintenanceAdmin } from './utils/access.js'
export type { AdminAccessCheck, AdminAccessOptions } from './utils/access.js'
export { getNowInTimezone } from './utils/timezone.js'
export { createPresetsListHandler, createApplyPresetHandler } from './endpoints/presets.js'
export { createMaintenancePageHandler } from './endpoints/page.js'
export { presets, getPreset, presetToPayloadData } from './presets/index.js'
export type { MaintenancePreset } from './presets/index.js'

// Types
export type {
  MaintenancePluginConfig,
  MaintenanceMessage,
  MaintenanceStatus,
  MaintenanceTemplate,
  MaintenanceType,
  SocialLink,
  WebhookConfig,
  ScheduleConfig,
} from './types.js'

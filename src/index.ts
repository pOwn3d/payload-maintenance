// Server-side exports — plugin, types, globals, endpoints, collections
export { maintenancePlugin } from './plugin.js'
export { createMaintenanceGlobal } from './globals/Maintenance.js'
export { createSubscribersCollection } from './collections/MaintenanceSubscribers.js'
export { createHistoryCollection } from './collections/MaintenanceHistory.js'
export {
  createStatusHandler,
  createToggleHandler,
  createNewsletterHandler,
  createSubscribersExportHandler,
  createStatsHandler,
  createScheduleCheckHandler,
} from './endpoints/status.js'
export { createPresetsListHandler, createApplyPresetHandler } from './endpoints/presets.js'
export { presets, getPreset, presetToPayloadData } from './presets/index.js'
export type { MaintenancePreset } from './presets/index.js'

// Types
export type {
  MaintenancePluginConfig,
  MaintenanceMessage,
  MaintenanceStatus,
  MaintenanceTemplate,
  SocialLink,
  WebhookConfig,
  ScheduleConfig,
} from './types.js'

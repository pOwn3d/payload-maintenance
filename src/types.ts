import type { AdminAccessCheck } from './utils/access.js'

export type { AdminAccessCheck }

export interface MaintenanceMessage {
  language: string
  title: string
  description: string
  buttonLabel?: string
  buttonUrl?: string
}

export interface SocialLink {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok' | 'github' | 'other'
  url: string
  label?: string
}

export type MaintenanceTemplate =
  | 'minimal'
  | 'countdown'
  | 'coming-soon'
  | 'custom'
  | 'glassmorphism'
  | 'gradient'
  | 'split-screen'
  | 'video-background'

export type MaintenanceType = 'maintenance' | 'coming-soon' | 'upgrade' | 'emergency'

export interface WebhookConfig {
  url: string
  type: 'slack' | 'discord' | 'custom'
  enabled: boolean
}

export interface ScheduleConfig {
  scheduledStart?: string | null
  scheduledEnd?: string | null
  autoEnable: boolean
  autoDisable: boolean
}

export interface MaintenancePluginConfig {
  /** Slug for the maintenance global (default: 'maintenance') */
  globalSlug?: string

  /** API endpoint base path (default: '/maintenance') */
  endpointBasePath?: string

  /** Languages available for the maintenance page (default: ['fr', 'en']) */
  languages?: { label: string; value: string }[]

  /** Paths reported as always accessible by GET /<basePath>/status
   *  (default: ['/admin', '/api']).
   *  The Next.js middleware has its own `excludedPaths` and does not read this
   *  one — keep both in sync. */
  excludedPaths?: string[]

  /** IP addresses that bypass maintenance mode.
   *  @deprecated Not read by the plugin: the IP check runs inside the Next.js
   *  middleware, which cannot read this config. Pass the list to
   *  `createMaintenanceMiddleware({ allowedIPs })` instead. Kept for one more
   *  minor so existing configs keep compiling; it will be removed. */
  allowedIPs?: string[]

  /** Secret query param to bypass maintenance (e.g. ?bypass=secret123).
   *  @deprecated Not read by the plugin: the bypass runs inside the Next.js
   *  middleware. Pass it to `createMaintenanceMiddleware({ bypassSecret })`. */
  bypassSecret?: string

  /** Custom component path for the maintenance page (overrides default).
   *  @deprecated Never implemented. The maintenance page is served by
   *  `GET /api<basePath>/page`; override it with the middleware option
   *  `maintenancePagePath`. */
  maintenancePageComponent?: string

  /** Add admin dashboard view (default: true) */
  addDashboardView?: boolean

  /** Cookie name for bypass (default: 'maintenance-bypass').
   *  @deprecated Not read by the plugin: the cookie is set and read by the
   *  Next.js middleware. Pass it to
   *  `createMaintenanceMiddleware({ bypassCookieName })`. */
  bypassCookieName?: string

  /** Media collection slug for uploads (default: 'media') */
  mediaCollectionSlug?: string

  /** Enable subscribers collection to store newsletter emails (default: true) */
  enableSubscribers?: boolean

  /** Slug for the subscribers collection (default: 'maintenance-subscribers') */
  subscribersSlug?: string

  /** Enable history/audit log collection (default: true) */
  enableHistory?: boolean

  /** Slug for the history collection (default: 'maintenance-history') */
  historySlug?: string

  /** Enable scheduled maintenance (auto on/off) (default: true) */
  enableScheduling?: boolean

  /** Allow logged-in Payload users to bypass maintenance (default: true).
   *  @deprecated Not read by the plugin. Use the `authBypass` checkbox on the
   *  maintenance global (which IS honoured by the middleware), or
   *  `createMaintenanceMiddleware({ authBypass })`. */
  authBypass?: boolean

  /** Collection queried by the middleware auth bypass.
   *  @deprecated Not read by the plugin: the auth bypass runs inside the
   *  Next.js middleware. Pass it to
   *  `createMaintenanceMiddleware({ usersCollectionSlug })`.
   *  It deliberately does NOT drive the admin authorization gate — use
   *  `adminCollectionSlug` for that. */
  usersCollectionSlug?: string

  /** Collection whose users may administer maintenance mode: toggle it, export
   *  subscribers, apply presets, read the global (default: the collection
   *  Payload uses for the admin panel, i.e. `config.admin.user`, so hosts that
   *  renamed `users` keep working without configuring anything). */
  adminCollectionSlug?: string

  /** Custom authorization check for the admin-only endpoints and for the
   *  maintenance global. Overrides `adminCollectionSlug` when provided — plug
   *  your own RBAC here (roles, tenants...). */
  adminAccess?: AdminAccessCheck

  /** Enable page view analytics during maintenance (default: true) */
  enableAnalytics?: boolean

  /** Slug for the analytics collection (default: 'maintenance-analytics') */
  analyticsSlug?: string

  /** Slug for the webhook logs collection (default: 'maintenance-webhook-logs') */
  webhookLogsSlug?: string

  /** Show maintenance toggle on the main admin dashboard (default: true) */
  showDashboardToggle?: boolean

  /** Trust proxy headers (x-forwarded-for, x-real-ip) for IP detection (default: true).
   *  Set to false when not behind a trusted reverse proxy to prevent IP spoofing. */
  trustProxy?: boolean
}

export interface MaintenanceStatus {
  enabled: boolean
  template: MaintenanceTemplate
  maintenanceType?: MaintenanceType
  messages: MaintenanceMessage[]
  estimatedEnd?: string | null
  isAuthenticated?: boolean
  excludedPaths?: string[]
  logoUrl?: string | null
  backgroundImageUrl?: string | null
  videoUrl?: string | null
  backgroundColor?: string
  textColor?: string
  accentColor?: string
  customCSS?: string | null
  socialLinks?: SocialLink[]
  contactEmail?: string | null
  showNewsletterForm?: boolean
  newsletterPlaceholder?: string | null
  newsletterButtonLabel?: string | null
  backgroundOverlayOpacity?: number
  showProgressBar?: boolean
  customHTML?: string | null
  favicon?: string | null
  darkMode?: 'auto' | 'light' | 'dark'
  googleFont?: string | null
  lottieUrl?: string | null
  splitImage?: string | null
  excludedRoutes?: string[]
  authBypass?: boolean
  scheduledStart?: string | null
  scheduledEnd?: string | null
}

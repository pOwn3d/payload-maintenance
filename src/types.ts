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

  /** Paths excluded from maintenance mode — always accessible (default: ['/admin', '/api']) */
  excludedPaths?: string[]

  /** IP addresses that bypass maintenance mode */
  allowedIPs?: string[]

  /** Secret query param to bypass maintenance (e.g. ?bypass=secret123) */
  bypassSecret?: string

  /** Custom component path for the maintenance page (overrides default) */
  maintenancePageComponent?: string

  /** Add admin dashboard view (default: true) */
  addDashboardView?: boolean

  /** Cookie name for bypass (default: 'maintenance-bypass') */
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

  /** Allow logged-in Payload users to bypass maintenance (default: true) */
  authBypass?: boolean

  /** Users collection slug for auth bypass (default: 'users') */
  usersCollectionSlug?: string

  /** Enable page view analytics during maintenance (default: true) */
  enableAnalytics?: boolean

  /** Slug for the analytics collection (default: 'maintenance-analytics') */
  analyticsSlug?: string

  /** Slug for the webhook logs collection (default: 'maintenance-webhook-logs') */
  webhookLogsSlug?: string
}

export interface MaintenanceStatus {
  enabled: boolean
  template: MaintenanceTemplate
  maintenanceType?: MaintenanceType
  messages: MaintenanceMessage[]
  estimatedEnd?: string | null
  allowedIPs?: string[]
  bypassSecret?: string | null
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
  // New features
  darkMode?: 'auto' | 'light' | 'dark'
  googleFont?: string | null
  lottieUrl?: string | null
  splitImage?: string | null
  excludedRoutes?: string[]
  authBypass?: boolean
  scheduledStart?: string | null
  scheduledEnd?: string | null
}

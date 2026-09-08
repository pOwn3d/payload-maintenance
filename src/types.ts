import type { AdminAccessCheck } from './utils/access.js'
import type { AnalyticsIpMode } from './utils/anonymizeIp.js'

export type { AdminAccessCheck, AnalyticsIpMode }

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
   *  @deprecated NOT WIRABLE — kept only so existing configs keep compiling.
   *  The IP check runs inside the Next.js middleware, which is a separate
   *  process with no access to this config. Seeding the global's `allowedIPs`
   *  textarea from here was considered and rejected: that field is itself inert
   *  (the middleware cannot read the global without exposing the list
   *  publicly), so it would give the option the appearance of an effect and
   *  none of the substance. Pass the list to
   *  `createMaintenanceMiddleware({ allowedIPs })` instead.
   *  Planned removal: v1.0.0, not before 2027-03-08. */
  allowedIPs?: string[]

  /** Secret query param to bypass maintenance (e.g. ?bypass=secret123).
   *  @deprecated NOT WIRABLE — and deliberately so. The bypass is decided by
   *  the Next.js middleware; the only way to hand it this value from here would
   *  be to serve the secret over an endpoint, which is the one thing a bypass
   *  secret must never be. Pass it to
   *  `createMaintenanceMiddleware({ bypassSecret })`.
   *  Planned removal: v1.0.0, not before 2027-03-08. */
  bypassSecret?: string

  /** Custom component path for the maintenance page (overrides default).
   *  @deprecated NOT WIRABLE — never implemented, and honouring it now would be
   *  a new feature (a second rendering path competing with the served page),
   *  not a fix. The maintenance page is served by `GET /api<basePath>/page`;
   *  override it with the middleware option `maintenancePagePath`.
   *  Planned removal: v1.0.0, not before 2027-03-08. */
  maintenancePageComponent?: string

  /** Add admin dashboard view (default: true) */
  addDashboardView?: boolean

  /** Cookie name for bypass (default: 'maintenance-bypass').
   *  @deprecated NOT WIRABLE — the cookie is set and read by the Next.js
   *  middleware, which is constructed with its own options and never reads this
   *  config. Publishing the name over `GET <basePath>/config` would not help:
   *  the middleware needs it before it decides whether to call the API at all.
   *  Pass it to `createMaintenanceMiddleware({ bypassCookieName })`.
   *  Planned removal: v1.0.0, not before 2027-03-08. */
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
   *
   *  No longer dead, and the only one of the six middleware-shaped options that
   *  could be revived: it now seeds the DEFAULT VALUE of the `authBypass` checkbox
   *  on the maintenance global, which `GET <basePath>/status` publishes and the
   *  middleware does honour. No secret is exposed and no new code path is
   *  introduced — the runtime decision stays where it always was.
   *
   *  Scope of the effect: `defaultValue` only applies to a global that has
   *  never been saved, so an existing install keeps the value stored in its
   *  database. Changing the behaviour of a live site is still done from the
   *  checkbox, or with `createMaintenanceMiddleware({ authBypass: false })`
   *  which overrides it for every visitor. */
  authBypass?: boolean

  /** Collection queried by the middleware auth bypass.
   *  @deprecated NOT WIRABLE — the auth bypass runs inside the Next.js
   *  middleware, which validates the session cookie against
   *  `/api/<slug>/me` before any plugin code runs. Pass it to
   *  `createMaintenanceMiddleware({ usersCollectionSlug })`.
   *  It deliberately does NOT drive the admin authorization gate — promoting it
   *  there would lock hosts out of their own global — use `adminCollectionSlug`
   *  for that.
   *  Planned removal: v1.0.0, not before 2027-03-08. */
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

  /** How the caller's address is stored in the analytics collection
   *  (default: `'anonymized'`).
   *
   *  - `'anonymized'` — IPv4 truncated to /24 (`203.0.113.42` -> `203.0.113.0`),
   *    IPv6 to /48 (`2001:db8:85a3:...` -> `2001:db8:85a3::`). This is what
   *    brings the collection inside the CNIL audience-measurement exemption, and
   *    it keeps `uniqueIPs` usable as an order of magnitude.
   *  - `'full'` — the whole address. You then need a lawful basis of your own
   *    and, in the EU, most likely consent: the visitor of a maintenance page
   *    has no alternative screen to go to, so "legitimate interest" is a hard
   *    argument to make. Choose it only for abuse investigation, and shorten
   *    `analyticsRetentionDays` accordingly.
   *  - `'none'` — the `ip` field is not written at all. Paths, referers and user
   *    agents are still recorded.
   *
   *  Only the STORED value is affected: rate limiting and the middleware
   *  allow-list keep using the full address, which never leaves the process. */
  analyticsIpMode?: AnalyticsIpMode

  /** Days of analytics kept by the retention purge (default: 395 — 13 months,
   *  the CNIL ceiling for audience measurement). Set a value >= 1; anything
   *  else disables the purge for this collection rather than deleting
   *  everything. Run it with `DELETE <basePath>/analytics/purge`, or let the
   *  Payload Jobs task registered by the plugin run it daily when the host has
   *  the job system configured. */
  analyticsRetentionDays?: number

  /** Days of newsletter subscribers kept by the retention purge (default:
   *  `undefined` — NO purge). Left off on purpose: a subscriber row is also the
   *  proof of their consent (`consentAt`, `consentSource`, `ip`), so deleting it
   *  on a timer weakens the file rather than improving it. Set it when the
   *  maintenance window is over and the list has served its purpose. */
  subscribersRetentionDays?: number

  /** Slug for the webhook logs collection (default: 'maintenance-webhook-logs') */
  webhookLogsSlug?: string

  /** Show maintenance toggle on the main admin dashboard (default: true) */
  showDashboardToggle?: boolean

  /** Trust proxy headers (x-forwarded-for, x-real-ip) for IP detection (default: true).
   *  Set to false when not behind a trusted reverse proxy to prevent IP spoofing. */
  trustProxy?: boolean

  /** Number of reverse proxies that append to `x-forwarded-for` before the
   *  request reaches the app (default: 1).
   *  The client IP is read as `parts[length - trustedProxyHops]`: a conforming
   *  proxy APPENDS the peer address, so the first element of the header is the
   *  one the caller sent and must never be trusted. Raise this only if you run
   *  several chained proxies (e.g. CDN + load balancer => 2). */
  trustedProxyHops?: number

  /** Optional allow-list of hostnames the webhook sender may contact
   *  (e.g. `['hooks.slack.com', 'discord.com']`). Sub-domains match.
   *  Private, loopback and link-local targets are refused regardless of this
   *  option; the allow-list narrows things further for hosts that only expect
   *  a known destination. */
  allowedWebhookHosts?: string[]
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

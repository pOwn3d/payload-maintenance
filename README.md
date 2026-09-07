# @consilioweb/payload-maintenance

> Maintenance mode for Payload CMS 3 + Next.js: a configurable public page, an admin toggle, scheduling, audit history and webhooks.

[![npm](https://img.shields.io/npm/v/@consilioweb/payload-maintenance.svg)](https://www.npmjs.com/package/@consilioweb/payload-maintenance)
[![license](https://img.shields.io/npm/l/@consilioweb/payload-maintenance.svg)](LICENSE)
[![Payload](https://img.shields.io/badge/Payload-3.x-0F172A.svg)](https://payloadcms.com)

## About

Taking a Payload site offline usually means hand-rolling a Next.js middleware, a static page and a way to turn it back on. This plugin ships all three: a maintenance global in the admin panel, a standalone HTML page served by the plugin itself (no route to create), and a middleware helper that returns HTTP 503 with `Retry-After` so crawlers do not de-index the site.

Around that core it adds what an incident actually needs: an audit trail of who took the site down and for how long, Slack/Discord webhooks with retry, a GDPR-compliant newsletter form with unsubscribe, page-view analytics, and scheduled windows.

Since 0.6.0 the plugin is admin-only and fails closed: the configuration global is no longer world-readable, the admin endpoints reject users from non-admin auth collections, and a database outage keeps the site in maintenance instead of silently reopening it.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Plugin Options](#plugin-options)
- [Middleware Options](#middleware-options)
- [Templates](#templates)
- [Presets](#presets)
- [API Endpoints](#api-endpoints)
- [Collections](#collections)
- [Bypass Maintenance](#bypass-maintenance)
- [Package Exports](#package-exports)
- [Requirements](#requirements)
- [Support](#support)
- [License](#license)

## Features

- **Self-contained maintenance page** — served as standalone HTML by `GET /api/maintenance/page`. No `/maintenance` route to create in your app.
- **12 page templates** — from `minimal` to canvas-based `particles`, plus a `custom` HTML template with `{{variables}}`.
- **12 one-click presets** — template + colors + fonts + messages, applied from the admin dashboard.
- **Multi-language page** — per-language title, description and CTA configured in the admin, with browser-language auto-detection and a switcher. The page chrome (countdown labels, contact and newsletter strings) ships in 10 languages: `fr`, `en`, `de`, `es`, `it`, `pt`, `nl`, `ja`, `ar`, `zh`.
- **Scheduled maintenance** — start/end dates with auto-enable and auto-disable, driven by `POST /api/maintenance/schedule-check` (wire it to a cron) and re-checked by the middleware.
- **Audit history** — every activation and deactivation is logged with who triggered it and how long the site was down, plus every webhook that exhausted its retries.
- **Webhooks** — Slack, Discord or custom JSON, fired on every toggle, with exponential backoff (3 attempts: 1s, 2s, 4s) and a log collection.
- **Newsletter with GDPR consent** — signup form on the page, `consent: true` required, `consentAt` / `consentSource` stored, unique unsubscribe token, duplicate prevention, admin CSV export.
- **Page-view analytics** — path, referer, user agent and IP recorded while maintenance is on, with top-paths and top-referers aggregation.
- **SEO** — HTTP 503 (configurable), `Retry-After` computed from the estimated end date, `X-Robots-Tag: noindex` and `<meta name="robots" content="noindex,nofollow">`.
- **Admin dashboard** at `/admin/maintenance` — toggle, live preview, subscriber count with CSV export, history timeline, preset gallery. Plus a toggle widget on the main dashboard and a sidebar nav link.
- **Design customization** — Google Fonts by name, Lottie animation by URL, dark/light/auto mode, custom CSS and HTML, logo, favicon, background image, background video, split image, social links (8 platforms), contact email.

### Security

- **Admin-only authorization** — the maintenance global and the six admin endpoints require a user of the Payload admin collection (`config.admin.user`), not merely `req.user`. Override with `adminCollectionSlug`, or plug your own RBAC with `adminAccess`.
- **Field-level guards** — `webhooks[].url`, `bypassSecret`, `allowedIPs` and `notifyEmail` carry their own `access.read`, so they stay hidden even if a host re-opens the global.
- **Rate limiting per IP** on the public endpoints: status 60/min, newsletter 5/min, track 30/min, unsubscribe 10/min.
- **Fail-closed status** — `GET /status` answers `503` instead of a fabricated `{ enabled: false }` when the global cannot be read, and the middleware keeps the last known state when `/status` fails.
- **Auth cookie validation** — the middleware validates the Payload token against `/api/<usersCollectionSlug>/me` (positive and negative answers cached 15s; transient failures are not cached).
- **Input validation** — email regex on signup, IANA timezone, schedule cross-field (end after start), custom CSS rejecting `script`/`iframe`, preset ID whitelist, UUID check on unsubscribe.
- **CSV export hardening** — every cell quoted, and formula-injection prefixes (`=`, `+`, `-`, `@`, tab, CR) neutralised.
- **`trustProxy`** — control whether `x-forwarded-for` / `x-real-ip` is trusted for IP resolution. The plugin option is wired to `GET /status` only; the newsletter, track and unsubscribe rate limits always read the header. The middleware has its own `trustProxy`, which governs the `allowedIPs` check.
- **Segment-boundary path matching** — `excludedPaths: ['/admin']` no longer leaves `/administration-des-ventes` online.

## Installation

```bash
pnpm add @consilioweb/payload-maintenance
```

Or with npm / yarn:

```bash
npm install @consilioweb/payload-maintenance
yarn add @consilioweb/payload-maintenance
```

### Peer Dependencies

| Package | Version | Required |
|---------|---------|----------|
| `payload` | `^3.0.0` | **Yes** |
| `@payloadcms/next` | `^3.0.0` | Optional (admin view) |
| `@payloadcms/ui` | `^3.0.0` | Optional (admin UI) |
| `@payloadcms/translations` | `^3.0.0` | Optional (i18n) |
| `next` | `^14.0.0 \|\| ^15.0.0 \|\| ^16.0.0` | Optional (middleware, admin view) |
| `react` | `^18.0.0 \|\| ^19.0.0` | Optional (client components) |
| `react-dom` | `^18.0.0 \|\| ^19.0.0` | Optional (client components) |

> [!IMPORTANT]
> **Next.js 16 + Turbopack — known issue.** With Next.js 16 and Turbopack (the default bundler) you may hit a `createContext is not a function` error during `next build`. This is a Payload CMS issue ([#15429](https://github.com/payloadcms/payload/issues/15429), [#14330](https://github.com/payloadcms/payload/discussions/14330)), not specific to this plugin.
>
> Workaround — add this to your admin page (`src/app/(payload)/admin/[[...segments]]/page.tsx`):
> ```ts
> export const dynamic = 'force-dynamic'
> ```
>
> And list the plugin in `transpilePackages` in `next.config.ts`:
> ```ts
> transpilePackages: ['@consilioweb/payload-maintenance'],
> ```
>
> Next.js 15 works without any workaround.

## Quick Start

### 1. Add the plugin

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { maintenancePlugin } from '@consilioweb/payload-maintenance'

export default buildConfig({
  plugins: [
    maintenancePlugin({
      languages: [
        { label: 'Francais', value: 'fr' },
        { label: 'English', value: 'en' },
      ],
    }),
  ],
  // ...rest of your config
})
```

### 2. Add the middleware

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createMaintenanceMiddleware } from '@consilioweb/payload-maintenance/middleware'

const maintenanceMiddleware = createMaintenanceMiddleware()

export async function middleware(request: NextRequest) {
  const maintenanceResponse = await maintenanceMiddleware(request)
  if (maintenanceResponse) return maintenanceResponse
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
```

### 3. Regenerate the importmap

```bash
pnpm generate:importmap
```

The plugin then adds:

- a **Maintenance** global (`maintenance`)
- up to **4 collections** — subscribers, history and analytics follow their `enable*` flags, webhook logs is always added
- **13 API endpoints**, including the standalone HTML page
- an admin **dashboard view** at `/admin/maintenance`
- a **toggle widget** on the main admin dashboard and a **sidebar nav link**

> The maintenance page is self-contained: the plugin serves it via `GET /api/maintenance/page`. You do not need to create a `/maintenance` route in your Next.js app.

## Plugin Options

Everything passed to `maintenancePlugin()`. The deprecated options below still compile and now log a warning at boot: they are middleware concerns and the plugin never reads them.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `globalSlug` | `string` | `'maintenance'` | Slug of the configuration global |
| `endpointBasePath` | `string` | `'/maintenance'` | Prefix for every API endpoint |
| `languages` | `{ label: string; value: string }[]` | `[{ Francais, fr }, { English, en }]` | Languages offered for the maintenance page messages |
| `excludedPaths` | `string[]` | `['/admin', '/api']` | Paths reported as always accessible by `GET /status`. The Next.js middleware has its own `excludedPaths` and does not read this one — keep both in sync |
| `addDashboardView` | `boolean` | `true` | Register the admin view at `/admin/maintenance` |
| `showDashboardToggle` | `boolean` | `true` | Show the toggle widget on the main admin dashboard |
| `mediaCollectionSlug` | `string` | `'media'` | Collection used for logo, favicon, background and split image uploads |
| `enableSubscribers` | `boolean` | `true` | Add the newsletter subscribers collection and its endpoints |
| `subscribersSlug` | `string` | `'maintenance-subscribers'` | Slug of the subscribers collection |
| `enableHistory` | `boolean` | `true` | Add the history / audit collection |
| `historySlug` | `string` | `'maintenance-history'` | Slug of the history collection |
| `enableAnalytics` | `boolean` | `true` | Add the analytics collection and its endpoints |
| `analyticsSlug` | `string` | `'maintenance-analytics'` | Slug of the analytics collection |
| `webhookLogsSlug` | `string` | `'maintenance-webhook-logs'` | Slug of the webhook logs collection (always added) |
| `enableScheduling` | `boolean` | `true` | Add scheduled maintenance and the `schedule-check` endpoint |
| `adminCollectionSlug` | `string` | Payload's admin collection (`config.admin.user`) | Collection whose users may administer maintenance mode: toggle, stats, export, analytics, presets, and read/update the global |
| `adminAccess` | `({ req }) => boolean \| Promise<boolean>` | `undefined` | Custom authorization check for the admin endpoints and the global. Overrides `adminCollectionSlug` — plug your own RBAC here |
| `trustProxy` | `boolean` | `true` | Trust `x-forwarded-for` / `x-real-ip` when resolving the client IP for the **`GET /status`** rate limit. Set `false` when not behind a trusted reverse proxy — note it does not reach the newsletter, track and unsubscribe rate limits, which still trust the header |
| ~~`allowedIPs`~~ | `string[]` | `[]` | **Deprecated — no effect.** The IP check runs in the Next.js middleware: pass it to `createMaintenanceMiddleware({ allowedIPs })` |
| ~~`bypassSecret`~~ | `string` | `undefined` | **Deprecated — no effect.** Pass it to `createMaintenanceMiddleware({ bypassSecret })` |
| ~~`bypassCookieName`~~ | `string` | `'maintenance-bypass'` | **Deprecated — no effect.** The cookie is set and read by the middleware: `createMaintenanceMiddleware({ bypassCookieName })` |
| ~~`authBypass`~~ | `boolean` | `true` | **Deprecated — no effect.** Use the `authBypass` checkbox on the global (which the middleware does honour), or `createMaintenanceMiddleware({ authBypass })` |
| ~~`usersCollectionSlug`~~ | `string` | `undefined` | **Deprecated — no effect.** It only ever configured the middleware auth bypass: `createMaintenanceMiddleware({ usersCollectionSlug })`. It does **not** drive the admin authorization gate — `adminCollectionSlug` does |
| ~~`maintenancePageComponent`~~ | `string` | `undefined` | **Deprecated — never implemented.** The page is served by `GET /api/maintenance/page`; override it with the middleware option `maintenancePagePath` |

## Middleware Options

Everything passed to `createMaintenanceMiddleware()`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | Request origin | Base URL of the Payload API |
| `excludedPaths` | `string[]` | `['/admin', '/api']` | Never-blocked paths, matched on segment boundaries |
| `cacheDuration` | `number` | `10` | Status cache, in seconds |
| `statusEndpoint` | `string` | `'/api/maintenance/status'` | Status endpoint to poll |
| `maintenancePagePath` | `string` | `'/api/maintenance/page'` | Standalone HTML page endpoint to serve |
| `return503` | `boolean` | `true` | Answer HTTP 503 instead of 200 |
| `authBypass` | `boolean` | `true` | Let logged-in admin users through |
| `authCookieName` | `string` | `'payload-token'` | Payload auth cookie name |
| `usersCollectionSlug` | `string` | `'users'` | Collection queried to validate the auth cookie — must be the Payload admin collection |
| `bypassCookieName` | `string` | `'maintenance-bypass'` | Bypass cookie name |
| `bypassSecret` | `string` | `undefined` | Enables `?bypass=SECRET`, which sets a 24h cookie. Server-side only, never exposed by the API |
| `allowedIPs` | `string[]` | `[]` | IPs that bypass maintenance. Server-side only, never exposed by the API |
| `trustProxy` | `boolean` | `true` | Trust `x-forwarded-for` / `x-real-ip` when resolving the client IP for the `allowedIPs` check. Distinct from the plugin option of the same name |

## Templates

Chosen from the `template` select on the maintenance global. All 12 are rendered by the standalone page endpoint, which is what visitors see.

| Template | Description |
|----------|-------------|
| `minimal` | Clean icon + message layout (default) |
| `countdown` | SVG circular ring countdown |
| `coming-soon` | Flip card countdown with separators |
| `glassmorphism` | Frosted glass card with floating orbs |
| `gradient` | Multi-color animated gradient background |
| `split-screen` | Content left, image right (responsive) |
| `video-background` | MP4 video with overlay |
| `aurora` | Northern lights: animated gradient layers, floating particles, SVG waves |
| `neon` | Cyberpunk: pulsing neon glow, grid background, scanline, corner brackets |
| `mesh` | Animated blobs with `mix-blend-mode` and noise texture |
| `particles` | Canvas particle system with mouse interaction |
| `custom` | Full custom HTML with `{{variables}}` |

> The exported React `MaintenancePage` component implements the first seven plus `custom`; `aurora`, `neon`, `mesh` and `particles` fall back to its default layout there. Use the served page (`/api/maintenance/page`, which the middleware fetches) for the full set.

## Presets

Template + colors + font + messages, applied in one click from the admin dashboard. Listed by `GET /api/maintenance/presets`, applied by `POST /api/maintenance/presets/apply`.

| Preset | Template | Style |
|--------|----------|-------|
| `corporate-blue` | countdown | Professional dark blue (Inter) |
| `startup-launch` | gradient | Purple/pink dynamic (Space Grotesk) |
| `minimal-elegant` | minimal | Clean dark (DM Sans) |
| `glass-premium` | glassmorphism | Luxurious purple (Outfit) |
| `coming-soon-creative` | coming-soon | Teal creative (Sora) |
| `light-clean` | minimal | Light mode (Plus Jakarta Sans) |
| `warm-gradient` | gradient | Warm orange tones (Poppins) |
| `tech-dark` | countdown | Cyan tech (JetBrains Mono) |
| `aurora-borealis` | aurora | Teal/violet northern lights (Space Grotesk) |
| `cyberpunk-neon` | neon | Magenta/cyan cyberpunk (Orbitron) |
| `mesh-modern` | mesh | Indigo/rose modern blobs (Geist) |
| `particles-cosmic` | particles | Deep space constellation (Inter) |

## API Endpoints

Paths are relative to `endpointBasePath` (default `/maintenance`) under Payload's `/api`. **Admin** means a user of the admin collection — see `adminCollectionSlug` and `adminAccess`; anything else answers `401`.

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/maintenance/status` | Public | Public status subset. Answers `503` with `Retry-After: 10` if the global cannot be read |
| `POST` | `/api/maintenance/toggle` | Admin | Turn maintenance on or off |
| `POST` | `/api/maintenance/newsletter` | Public | Newsletter signup — requires `{ email, consent: true }` |
| `GET` | `/api/maintenance/stats` | Admin | Subscriber count and recent history |
| `GET` | `/api/maintenance/subscribers/export` | Admin | CSV export (only when `enableSubscribers`) |
| `GET` | `/api/maintenance/unsubscribe` | Public | Unsubscribe by token (only when `enableSubscribers`) |
| `POST` | `/api/maintenance/track` | Public | Record a page view (only when `enableAnalytics`) |
| `GET` | `/api/maintenance/analytics` | Admin | Analytics data (only when `enableAnalytics`) |
| `POST` | `/api/maintenance/schedule-check` | Admin | Apply the scheduled window (only when `enableScheduling`) |
| `GET` | `/api/maintenance/config` | Public | Slugs and base path, used by the admin nav link and dashboard |
| `GET` | `/api/maintenance/page` | Public | Standalone HTML maintenance page |
| `GET` | `/api/maintenance/presets` | Public | List the available presets |
| `POST` | `/api/maintenance/presets/apply` | Admin | Apply a preset to the global |

## Collections

| Slug | Role | Read | Create | Update | Delete |
|------|------|------|--------|--------|--------|
| `maintenance-subscribers` | Newsletter signups | Authenticated | Authenticated | Authenticated | Authenticated |
| `maintenance-history` | Audit trail of every toggle | Authenticated | Authenticated | Never | Authenticated |
| `maintenance-analytics` | Page views during maintenance | Authenticated | Authenticated | Never | Authenticated |
| `maintenance-webhook-logs` | Webhook delivery attempts | Authenticated | Authenticated | Never | Authenticated |

Subscribers, history and analytics are only added when their `enable*` option is left on; webhook logs is always added. The plugin's own writes go through the Local API and are not subject to these rules — a public signup must call `POST /api/maintenance/newsletter`, which enforces the rate limit, the consent check and email validation.

### `maintenance-subscribers`

| Field | Type | Description |
|-------|------|-------------|
| `email` | email (unique) | Subscriber email |
| `language` | text | Browser language, normalised to `xx` / `xx-XX` or `unknown` |
| `subscribedAt` | date | Registration date |
| `ip` | text | IP address |
| `userAgent` | text | Browser user agent |
| `consentAt` | date | GDPR consent timestamp |
| `consentSource` | text | Consent origin (`maintenance-page`) |
| `unsubscribeToken` | text (unique) | Token for the unsubscribe link |

### `maintenance-history`

| Field | Type | Description |
|-------|------|-------------|
| `action` | select | `activated` / `deactivated` / `webhook-failed`. The schema also accepts `scheduled-start`, `scheduled-end` and `config-updated`, which nothing writes today — a scheduled window flips `enabled`, so it is logged as `activated` / `deactivated` |
| `triggeredBy` | text | User email, or `system` |
| `timestamp` | date | When it happened |
| `duration` | text | How long maintenance lasted (on deactivation) |
| `details` | json | Template and message count |

## Bypass Maintenance

| Method | How |
|--------|-----|
| **Bypass cookie** | Visit `?bypass=YOUR_SECRET`, which sets a 24h cookie. Requires `createMaintenanceMiddleware({ bypassSecret })` — the admin field alone is **not** read by the middleware |
| **IP whitelist** | Requires `createMaintenanceMiddleware({ allowedIPs })` — the admin field alone is **not** read by the middleware |
| **Auth bypass** | Logged-in users of the collection given by the middleware's `usersCollectionSlug` see the real site. Enabled by the `authBypass` checkbox on the global and the middleware's `authBypass` option |
| **Route exclusion** | List routes (`/pricing`, `/legal/*`) in the global's "Excluded routes" field |
| **Path exclusion** | The middleware's `excludedPaths` (default `/admin`, `/api`), matched on segment boundaries |

## Package Exports

| Sub-path | Exposes | Environment |
|----------|---------|-------------|
| `.` | Plugin, global, collection factories, endpoint handlers, presets, access helper, types | Server |
| `./client` | `MaintenancePage`, `MaintenanceToggle`, `MaintenanceViewClient`, `MaintenanceNavLink` | Client (`'use client'`) |
| `./views` | `MaintenanceView` — the admin view server component | Server (RSC) |
| `./middleware` | `createMaintenanceMiddleware`, `MaintenanceMiddlewareConfig` | Next.js middleware (edge) |

```ts
// Server
import {
  maintenancePlugin,
  createMaintenanceGlobal,
  createSubscribersCollection,
  createHistoryCollection,
  createAnalyticsCollection,
  createWebhookLogsCollection,
  createStatusHandler,
  createToggleHandler,
  createNewsletterHandler,
  createSubscribersExportHandler,
  createStatsHandler,
  createScheduleCheckHandler,
  createTrackViewHandler,
  createAnalyticsHandler,
  createUnsubscribeHandler,
  createPresetsListHandler,
  createApplyPresetHandler,
  createMaintenancePageHandler,
  isMaintenanceAdmin,
  rateLimit,
  rateLimitResponse,
  getNowInTimezone, // deprecated — display formatting only
  presets,
  getPreset,
  presetToPayloadData,
} from '@consilioweb/payload-maintenance'

import type {
  MaintenancePluginConfig,
  MaintenanceMessage,
  MaintenanceStatus,
  MaintenanceTemplate,
  MaintenanceType,
  ScheduleConfig,
  SocialLink,
  WebhookConfig,
  MaintenancePreset,
  AdminAccessCheck,
  AdminAccessOptions,
} from '@consilioweb/payload-maintenance'

// Client — React components
import {
  MaintenancePage,
  MaintenanceToggle,
  MaintenanceViewClient,
  MaintenanceNavLink,
} from '@consilioweb/payload-maintenance/client'

// Views — admin server component
import { MaintenanceView } from '@consilioweb/payload-maintenance/views'

// Middleware — Next.js helper
import { createMaintenanceMiddleware } from '@consilioweb/payload-maintenance/middleware'
import type { MaintenanceMiddlewareConfig } from '@consilioweb/payload-maintenance/middleware'
```

`isMaintenanceAdmin(req, { adminCollectionSlug, adminAccess })` is exported so you can gate endpoints of your own with the same rule the plugin uses.

`getNowInTimezone` is deprecated since 0.6.0 and kept only because it is part of the published API surface. It reparses a wall-clock string as server-local time, so never compare its result against a Payload date field — schedule comparisons use plain UTC instants. Safe for display formatting only.

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | `>=18` |
| Payload CMS | `^3.0.0` |
| Next.js | `^14.0.0 \|\| ^15.0.0 \|\| ^16.0.0` |
| React / React DOM | `^18.0.0 \|\| ^19.0.0` |
| Database | any Payload-supported adapter (SQLite, PostgreSQL, MongoDB) |

## Support

- Issues and feature requests: [github.com/pOwn3d/payload-maintenance/issues](https://github.com/pOwn3d/payload-maintenance/issues)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- If this plugin saves you time: [buy me a coffee](https://buymeacoffee.com/pown3d)

Made by [ConsilioWEB](https://consilioweb.fr).

## License

[MIT](LICENSE)

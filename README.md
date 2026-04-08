<!-- Header Banner -->
<div align="center">

  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&duration=3000&pause=1000&color=3B82F6&center=true&vCenter=true&width=700&lines=%40consilioweb%2Fpayload-maintenance;Payload+CMS+Maintenance+Mode;12+Templates+%7C+12+Presets;i18n+10+Languages+%7C+Webhooks;Scheduling+%7C+Newsletter+%7C+503+SEO" alt="Typing SVG" />
  </a>

  <br><br>

  <!-- Badges -->
  <a href="https://www.npmjs.com/package/@consilioweb/payload-maintenance"><img src="https://img.shields.io/npm/v/@consilioweb/payload-maintenance?style=for-the-badge&logo=npm&logoColor=white&color=CB3837" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@consilioweb/payload-maintenance"><img src="https://img.shields.io/npm/dw/@consilioweb/payload-maintenance?style=for-the-badge&logo=npm&logoColor=white&color=CB3837" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/Payload%20CMS-3.x-0F172A?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDdWMTdMMTIgMjJMMjAgMTdWN0wxMiAyWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=&logoColor=white" alt="Payload CMS 3">
  <img src="https://img.shields.io/badge/Templates-12-8B5CF6?style=for-the-badge" alt="12 Templates">
  <img src="https://img.shields.io/badge/i18n-10+Languages-F59E0B?style=for-the-badge&logo=translate&logoColor=white" alt="i18n">
  <a href="https://github.com/pOwn3d/payload-maintenance/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-7C3AED?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">

</div>

<p align="center">
  <a href="https://buymeacoffee.com/pown3d">
    <img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-☕-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy me a coffee" />
  </a>
</p>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

> [!IMPORTANT]
> ## ⚠️ Next.js 16 + Turbopack — Known Issue
>
> If you're using **Next.js 16** with Turbopack (default bundler), you may encounter a `createContext is not a function` error during `next build`. This is a **known Payload CMS issue** ([#15429](https://github.com/payloadcms/payload/issues/15429), [#14330](https://github.com/payloadcms/payload/discussions/14330)) — not specific to this plugin.
>
> **Workaround** — Add this to your admin page (`src/app/(payload)/admin/[[...segments]]/page.tsx`):
> ```ts
> export const dynamic = 'force-dynamic'
> ```
>
> And ensure all `@consilioweb/*` packages are in `transpilePackages` in your `next.config.ts`:
> ```ts
> transpilePackages: ['@consilioweb/seo-analyzer', '@consilioweb/admin-nav', /* ...other @consilioweb packages */],
> ```
>
> ✅ **Next.js 15** works without any workaround.

## About

> **@consilioweb/payload-maintenance** — A complete, production-ready maintenance mode plugin for Payload CMS 3 + Next.js. Includes 12 professional templates (Aurora, Neon, Mesh, Particles...), 12 one-click presets, i18n in 10 languages, scheduled maintenance, GDPR-compliant newsletter with unsubscribe, audit history, webhooks with retry (Slack/Discord), rate limiting, HTTP 503 SEO, and a full admin dashboard. **Self-contained** — no manual route needed.

<table>
  <tr>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/maintenance.png" width="50"/><br>
      <b>12 Templates</b><br>
      <sub>Aurora, Neon, Mesh, Particles...</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/language.png" width="50"/><br>
      <b>10 Languages</b><br>
      <sub>Auto-detect browser lang</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/calendar--v1.png" width="50"/><br>
      <b>Scheduling</b><br>
      <sub>Auto on/off by date</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/webhook.png" width="50"/><br>
      <b>Webhooks</b><br>
      <sub>Slack, Discord, Custom</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/newsletter.png" width="50"/><br>
      <b>Newsletter</b><br>
      <sub>DB storage + CSV export</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/seo-shield.png" width="50"/><br>
      <b>SEO Ready</b><br>
      <sub>HTTP 503 + Retry-After</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/paint-palette.png" width="50"/><br>
      <b>12 Presets</b><br>
      <sub>One-click apply</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/admin-settings-male.png" width="50"/><br>
      <b>Admin Dashboard</b><br>
      <sub>Toggle, preview, stats</sub>
    </td>
  </tr>
</table>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Templates](#templates)
- [Presets](#presets)
- [Plugin Options](#plugin-options)
- [Middleware Options](#middleware-options)
- [API Endpoints](#api-endpoints)
- [Collections](#collections)
- [Bypass Maintenance](#bypass-maintenance)
- [Package Exports](#package-exports)
- [Requirements](#requirements)
- [License](#license)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Features

### 12 Professional Templates

| Template | Description |
|----------|-------------|
| `minimal` | Clean icon + message layout |
| `countdown` | SVG circular ring countdown |
| `coming-soon` | Flip card countdown with separators |
| `glassmorphism` | Frosted glass card with floating orbs |
| `gradient` | Multi-color animated gradient background |
| `split-screen` | Content left, image right (responsive) |
| `video-background` | MP4 video with overlay |
| `aurora` | **NEW** Northern lights with animated gradient layers, floating particles, SVG waves |
| `neon` | **NEW** Cyberpunk with pulsing neon glow, grid background, scanline, corner brackets |
| `mesh` | **NEW** Apple-like animated blobs with mix-blend-mode and noise texture |
| `particles` | **NEW** Canvas-based interactive particle system with mouse interaction |
| `custom` | Full custom HTML with `{{variables}}` |

### 12 One-Click Presets

Pre-configured templates with colors, fonts, and messages — apply in one click from admin:

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
| `aurora-borealis` | aurora | **NEW** Teal/violet northern lights (Space Grotesk) |
| `cyberpunk-neon` | neon | **NEW** Magenta/cyan cyberpunk (Orbitron) |
| `mesh-modern` | mesh | **NEW** Indigo/rose modern blobs (Geist) |
| `particles-cosmic` | particles | **NEW** Deep space constellation (Inter) |

### Multi-Language (i18n)

- **10 languages** built-in: FR, EN, DE, ES, IT, PT, NL, JA, AR, ZH
- **Auto-detection** of browser language
- **Language switcher** on the maintenance page
- **Per-language messages** configurable from admin

### Scheduled Maintenance

- Set start and end dates
- Auto-enable and auto-disable toggles
- Schedule check endpoint for cron integration

### Newsletter Subscribers (GDPR-compliant)

- Email signup form on the maintenance page
- **GDPR consent** required (`consent: true` in POST body)
- `consentAt`, `consentSource` stored per subscriber
- **Unsubscribe endpoint** with unique token per subscriber
- Stored in a dedicated Payload collection
- Duplicate prevention
- CSV export endpoint for admin users
- Tracks language, IP, user-agent

### Security & Rate Limiting

- **Rate limiting** on all public endpoints (status: 60/min, newsletter: 5/min, track: 30/min per IP)
- **Auth check** on all admin endpoints (toggle, stats, export, analytics, schedule-check, presets apply)
- **JWT validation** — auth cookie verified via /api/users/me (cached 15s) (v0.5.0)
- **Email validation** with regex on newsletter signup
- **Webhook retry** with exponential backoff (3 attempts: 1s, 2s, 4s)
- **trustProxy option** — control IP source for rate limiting behind reverse proxies (v0.5.0)
- **Bypass secret protection** — no longer exposed in public API responses (v0.5.0)
- **Input validation** — timezone (IANA), schedule cross-field (end > start), custom CSS (no script/iframe), preset ID whitelist, UUID validation on unsubscribe (v0.5.0)

### Audit History

- Logs every activation/deactivation
- Records who triggered it and when
- Calculates maintenance duration
- Viewable in admin dashboard

### Webhooks & Notifications

- **Slack** — formatted message with emoji
- **Discord** — markdown formatted
- **Custom webhook** — JSON payload
- **Email notification** — via Payload email adapter
- Fires on every toggle

### SEO

- **HTTP 503** status code (configurable)
- **Retry-After** header (dynamic from estimated end date)
- `robots: noindex` on maintenance page

### Design Customization

- **Google Fonts** — dynamic loading by name
- **Lottie animations** — via URL
- **Dark / Light / Auto** mode (system preference detection)
- **Custom CSS** and **Custom HTML** support
- **Background image**, **video**, **split image** uploads
- **Logo** and **favicon** uploads
- **Social links** (8 platforms)
- **Contact email** display

### Admin Dashboard

- Quick toggle on/off from dashboard
- Live preview iframe
- Subscriber count with CSV export link
- Recent history timeline
- Visual preset gallery with one-click apply
- Link to full global configuration

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Installation

```bash
pnpm add @consilioweb/payload-maintenance
```

Or with npm/yarn:

```bash
npm install @consilioweb/payload-maintenance
yarn add @consilioweb/payload-maintenance
```

### Peer Dependencies

| Package | Version | Required |
|---------|---------|----------|
| `payload` | `^3.0.0` | **Yes** |
| `@payloadcms/next` | `^3.0.0` | Optional (admin views) |
| `@payloadcms/ui` | `^3.0.0` | Optional (admin UI) |
| `@payloadcms/translations` | `^3.0.0` | Optional (i18n) |
| `next` | `^14.0.0 \|\| ^15.0.0` | Optional |
| `react` | `^18.0.0 \|\| ^19.0.0` | Optional |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Quick Start

### 1. Add the plugin

```ts
// payload.config.ts
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

### 3. Regenerate importmap

```bash
pnpm generate:importmap
```

That's it! The plugin automatically adds:
- A **Maintenance** global in Settings
- **4 collections** (subscribers, history, analytics, webhook-logs)
- **13 API endpoints** (including standalone HTML page — no route needed!)
- An admin **dashboard view** at `/admin/maintenance`
- A **toggle widget** on the admin dashboard

> **Note**: The maintenance page is **self-contained** — the plugin serves a standalone HTML page via `/api/maintenance/page`. No need to create a `/maintenance` route in your Next.js app.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `globalSlug` | `string` | `'maintenance'` | Slug du global de configuration |
| `endpointBasePath` | `string` | `'/maintenance'` | Préfixe des endpoints API |
| `languages` | `{label, value}[]` | `[{fr}, {en}]` | Langues disponibles pour la page de maintenance |
| `excludedPaths` | `string[]` | `['/admin', '/api']` | Chemins toujours accessibles (jamais bloqués) |
| `allowedIPs` | `string[]` | `[]` | Adresses IP qui contournent le mode maintenance |
| `bypassSecret` | `string` | `undefined` | Paramètre query secret pour contourner la maintenance (ex: `?bypass=secret123`) |
| `maintenancePageComponent` | `string` | `undefined` | Chemin vers un composant custom pour la page de maintenance (remplace le défaut) |
| `addDashboardView` | `boolean` | `true` | Ajouter la vue admin à `/admin/maintenance` |
| `bypassCookieName` | `string` | `'maintenance-bypass'` | Nom du cookie de contournement |
| `mediaCollectionSlug` | `string` | `'media'` | Slug de la collection pour les uploads |
| `enableSubscribers` | `boolean` | `true` | Activer la collection d'abonnés newsletter |
| `subscribersSlug` | `string` | `'maintenance-subscribers'` | Slug de la collection abonnés |
| `enableHistory` | `boolean` | `true` | Activer la collection d'historique/audit |
| `historySlug` | `string` | `'maintenance-history'` | Slug de la collection historique |
| `enableScheduling` | `boolean` | `true` | Activer la maintenance planifiée (activation/désactivation auto) |
| `authBypass` | `boolean` | `true` | Les utilisateurs Payload connectés contournent la maintenance |
| `usersCollectionSlug` | `string` | `'users'` | Slug de la collection utilisateurs pour le contournement auth |
| `enableAnalytics` | `boolean` | `true` | Activer le suivi analytique des pages vues pendant la maintenance |
| `analyticsSlug` | `string` | `'maintenance-analytics'` | Slug de la collection analytique |
| `webhookLogsSlug` | `string` | `'maintenance-webhook-logs'` | Slug de la collection de logs webhook |
| `showDashboardToggle` | `boolean` | `true` | Show maintenance toggle on the main admin dashboard |
| `trustProxy` | `boolean` | `false` | Trust x-forwarded-for header for IP resolution (set `true` behind reverse proxy) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Middleware Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `excludedPaths` | `string[]` | `['/admin', '/api']` | Never-blocked paths |
| `cacheDuration` | `number` | `10` | Status cache (seconds) |
| `return503` | `boolean` | `true` | HTTP 503 for SEO |
| `authBypass` | `boolean` | `true` | Logged-in users bypass |
| `authCookieName` | `string` | `'payload-token'` | Payload auth cookie |
| `bypassCookieName` | `string` | `'maintenance-bypass'` | Bypass cookie |
| `apiUrl` | `string` | Same origin | Custom API URL |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/maintenance/status` | Public | Full maintenance status |
| `POST` | `/api/maintenance/toggle` | Admin | Toggle on/off |
| `POST` | `/api/maintenance/newsletter` | Public | Newsletter signup |
| `GET` | `/api/maintenance/stats` | Admin | Subscribers count + history |
| `GET` | `/api/maintenance/subscribers/export` | Admin | CSV export |
| `GET` | `/api/maintenance/presets` | Public | List available presets |
| `POST` | `/api/maintenance/presets/apply` | Admin | Apply a preset |
| `POST` | `/api/maintenance/schedule-check` | Admin | Check and apply scheduled dates (v0.5.0: moved from GET to POST) |
| `GET` | `/api/maintenance/page` | Public | Standalone HTML maintenance page |
| `POST` | `/api/maintenance/track` | Public | Analytics page view tracking |
| `GET` | `/api/maintenance/analytics` | Admin | Analytics data |
| `GET` | `/api/maintenance/unsubscribe` | Public | Unsubscribe by token |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Collections

The plugin automatically creates two collections:

### `maintenance-subscribers`

| Field | Type | Description |
|-------|------|-------------|
| `email` | email (unique) | Subscriber email |
| `language` | text | Browser language |
| `subscribedAt` | date | Registration date |
| `ip` | text | IP address |
| `userAgent` | text | Browser user agent |
| `consentAt` | date | GDPR consent timestamp |
| `consentSource` | text | Consent origin (maintenance-page) |
| `unsubscribeToken` | text (unique) | Token for unsubscribe link |

### `maintenance-history`

| Field | Type | Description |
|-------|------|-------------|
| `action` | select | activated / deactivated / scheduled-start / scheduled-end |
| `triggeredBy` | text | User email or "system" |
| `timestamp` | date | When it happened |
| `duration` | text | Maintenance duration (on deactivation) |
| `details` | json | Template, message count, etc. |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Bypass Maintenance

Multiple ways to bypass the maintenance page:

| Method | How |
|--------|-----|
| **Bypass cookie** | Visit `?bypass=YOUR_SECRET` — sets a 24h cookie |
| **IP whitelist** | Configure allowed IPs in admin (Access tab) |
| **Auth bypass** | Logged-in Payload admin users automatically see the real site |
| **Route exclusion** | Exclude specific routes (e.g. `/pricing`, `/legal/*`) in admin |
| **Path exclusion** | `/admin` and `/api` are always accessible |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Package Exports

```ts
// Server — plugin, types, globals, endpoints, collections, presets
import {
  maintenancePlugin,
  createMaintenanceGlobal,
  createSubscribersCollection,
  createHistoryCollection,
  presets,
  getPreset,
  presetToPayloadData,
} from '@consilioweb/payload-maintenance'

import type {
  MaintenancePluginConfig,
  MaintenanceMessage,
  MaintenanceStatus,
  MaintenanceTemplate,
  SocialLink,
  WebhookConfig,
  MaintenancePreset,
} from '@consilioweb/payload-maintenance'

// Client — React components
import {
  MaintenancePage,
  MaintenanceToggle,
  MaintenanceViewClient,
} from '@consilioweb/payload-maintenance/client'

// Views — server components for admin
import { MaintenanceView } from '@consilioweb/payload-maintenance/views'

// Middleware — Next.js middleware helper
import { createMaintenanceMiddleware } from '@consilioweb/payload-maintenance/middleware'
import type { MaintenanceMiddlewareConfig } from '@consilioweb/payload-maintenance/middleware'
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Requirements

- **Node.js** >= 18
- **Payload CMS** 3.x
- **Next.js** 14.x or 15.x
- **React** 18.x or 19.x
- **Database**: Any Payload-supported adapter (SQLite, PostgreSQL, MongoDB)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Uninstall

1. Remove the plugin from `payload.config.ts`
2. Remove the middleware from `src/middleware.ts`
3. Uninstall: `pnpm remove @consilioweb/payload-maintenance`
4. Regenerate importmap: `pnpm generate:importmap`

### Data cleanup (optional)

The plugin collections remain in your database. To remove them:

**SQLite:**
```sql
DROP TABLE IF EXISTS "maintenance-subscribers";
DROP TABLE IF EXISTS "maintenance-history";
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## ☕ Support

If this plugin saves you time, consider buying me a coffee!

<a href="https://buymeacoffee.com/pown3d">
  <img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=pown3d&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" />
</a>

## License

[MIT](LICENSE)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

<div align="center">

### Author

**Made with passion by [ConsilioWEB](https://consilioweb.fr)**

<a href="https://www.linkedin.com/in/christophe-lopez/">
  <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn">
</a>
<a href="https://github.com/pOwn3d">
  <img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
</a>
<a href="https://consilioweb.fr">
  <img src="https://img.shields.io/badge/Website-consilioweb.fr-3B82F6?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Website">
</a>

<br><br>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%"/>

</div>

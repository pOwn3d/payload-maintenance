# Changelog

All notable changes to `@consilioweb/payload-maintenance` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-09-07

_Maintenance mode becomes admin-only and fails closed: the configuration global is no longer world-readable, the admin endpoints stop trusting "any logged-in user", and a database outage can no longer un-publish the maintenance page._

### Breaking

- **The maintenance global is no longer public.** `access.read` on the `maintenance` global (`globalSlug`) went from `() => true` to a check that the caller belongs to the Payload admin collection, and `access.update` from "any authenticated user" to that same check. A front-end that read `GET /api/globals/maintenance` directly is now refused. Read `GET /api/maintenance/status` instead: it returns the curated public subset and never contained the credentials. To let another collection administer maintenance mode, set `adminCollectionSlug`; for a role-based rule, set `adminAccess`.
- **The six admin endpoints reject authenticated users from other collections.** `POST /api/maintenance/toggle`, `GET /api/maintenance/stats`, `GET /api/maintenance/subscribers/export`, `GET /api/maintenance/analytics`, `POST /api/maintenance/schedule-check` and `POST /api/maintenance/presets/apply` used to accept anyone with `req.user` set — which Payload populates for a member of *any* auth-enabled collection (customers, members, partners). They now answer `401` unless the caller belongs to the admin collection (`config.admin.user` by default). Touched: sites with a second auth collection whose scripts or integrations authenticated as such a user. Fix: authenticate as an admin-panel user, or widen the gate with `adminAccess: ({ req }) => ...`.
- **`GET /api/maintenance/status` fails closed.** When the global cannot be read it answers `503` with `{ error: 'Failed to fetch maintenance status' }` and `Retry-After: 10`, instead of `200 { enabled: false, ... }`. `enabled` is deliberately absent from the error body, so a caller that ignores the status code cannot read a fabricated `false`. Any consumer must now check `res.ok` before parsing — the bundled middleware, dashboard, toggle widget and both page renderers do.
- **The Next.js middleware keeps the last known state when `/status` fails.** A non-2xx answer, a network error, or a body without a boolean `enabled` is now treated as a failure: the previous status is reused (its timestamp is not refreshed, so the next request retries) and a warning is logged, instead of a fresh `enabled: false` that let all traffic through at the exact moment maintenance mode exists for. Consequence: a site in maintenance stays in maintenance while the API is down. On a cold start with nothing cached, traffic still passes, as before.
- **`excludedPaths` in the middleware matches on segment boundaries.** `createMaintenanceMiddleware({ excludedPaths })` used a raw `startsWith`, so `/admin` also excluded `/administration-des-ventes`, which stayed online during maintenance. A prefix now matches the path itself and its `/`-separated children only. One case widens instead: a trailing slash is trimmed off the prefix, so `excludedPaths: ['/admin/']` now excludes `/admin` itself, which `startsWith` did not (`'/'` still excludes everything). If you relied on the loose match, list the real paths.
- **Media URLs returned by `/status` changed shape.** `logoUrl`, `faviconUrl`, `backgroundImageUrl` and `splitImageUrl` now return the URL Payload (or your storage adapter) actually serves, falling back to `/api/<mediaCollectionSlug>/file/<filename>`, instead of `/<filename>` (see Fixed). If you worked around the broken paths by serving those files from the web root, drop the workaround.

### Security

- **The maintenance global was readable by anyone, unauthenticated.** `GET /api/globals/maintenance` returned the whole document to the open internet, including every `webhooks[].url` (Slack/Discord webhook URLs are bearer credentials: whoever reads one can post in the client's internal channels), `bypassSecret`, the `allowedIPs` whitelist and `notifyEmail`. The global is admin-only from this release, and those four fields carry an additional field-level `access.read` so they stay hidden even if a host re-opens the document. Rotate any webhook URL and bypass secret that was stored on a publicly reachable install.
- **The four plugin collections accepted anonymous writes.** `create` was `() => true` on `maintenance-history`, `maintenance-subscribers`, `maintenance-analytics` and `maintenance-webhook-logs`, and Payload exposes it as `POST /api/<slug>`: anyone could forge entries in the only trail that records who took the site offline, insert subscribers past the newsletter endpoint's rate limit, consent check and email validation, and grow four tables without bound. `create` now requires an authenticated user; the plugin's own writes go through the Local API and are unaffected. A custom signup form posting straight to the subscribers collection must call `POST /api/maintenance/newsletter` instead.
- **Any authenticated user could administer maintenance mode** (see Breaking). On a site with a customer area, a customer account could take the site offline, export every subscriber's email and IP address, or rewrite the `customHTML` served to all visitors.
- **CSV export hardened against spreadsheet formula injection.** `GET /api/maintenance/subscribers/export` concatenated raw values, two of which (`language`, `ip`) originate from an anonymous request on `/api/maintenance/newsletter`. Every cell is now quoted with internal quotes doubled, and a cell starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'` so the spreadsheet keeps it as text. `language` is also normalised at signup: a value that is not `xx` or `xx-XX` is stored as `unknown`. Note the format change — every field of the export is now quoted.

### Added

- `adminCollectionSlug` plugin option — collection whose users may administer maintenance mode. Defaults to the collection Payload uses for its admin panel (`config.admin.user`), so hosts that renamed `users` need no configuration.
- `adminAccess` plugin option — custom authorization check `({ req }) => boolean | Promise<boolean>` applied to the admin endpoints and to the global; overrides `adminCollectionSlug`. Plug your own RBAC here.
- `isMaintenanceAdmin(req, options)` is exported, with the `AdminAccessCheck` and `AdminAccessOptions` types, for hosts that add endpoints of their own.
- `usersCollectionSlug` option on `createMaintenanceMiddleware()` — the collection queried to validate the auth cookie (default `users`, previously hard-coded). Hosts whose admin collection is named otherwise can finally make the logged-in bypass work.
- Optional trailing arguments on the exported handler factories (`createStatusHandler`, `createToggleHandler`, `createStatsHandler`, `createSubscribersExportHandler`, `createAnalyticsHandler`, `createScheduleCheckHandler`, `createApplyPresetHandler`) for callers that wire the endpoints by hand; existing call sites keep compiling.
- Degraded state on the admin dashboard: when `/status` is unavailable it states what failed and offers a Retry button, instead of a "Loading..." that never resolves.
- Test suite — 83 vitest tests (`pnpm test`) covering the admin access gate, the schedule, the rate limiter, the status endpoint and the middleware.
- Release workflow (`.github/workflows/publish.yml`, triggered by a `v*` tag): typecheck, tests and build on Node 20, then `pnpm publish --provenance`, so the package ships with npm provenance.
- CI workflow (`.github/workflows/ci.yml`): the same typecheck, tests and build on Node 20 and 22 for every push and pull request. It publishes nothing — Node 22 is covered by CI, not by the release job.

### Changed

- `excludedPaths` reported by `GET /api/maintenance/status` now reflects the plugin option instead of a hard-coded `['/admin', '/api']`. The Next.js middleware still has its own `excludedPaths` and does not read this one — keep both in sync.
- The middleware echoes the auth cookie back under the name configured by `authCookieName` (was a hard-coded `payload-token`) and queries `/api/<usersCollectionSlug>/me`. On a host with a custom cookie prefix, the logged-in bypass goes from silently broken to working.
- The dashboard toggle widget hides itself when `/status` is unreachable, instead of showing a green "Site online".
- The admin dashboard now stays in French on a browser whose language is neither French nor English, where it used to fall back to English: French is what the server renders, and the post-hydration detection (see Fixed) only switches away from it for a language the dashboard actually translates. The nav link and the toggle widget still fall back to English. Both dashboard and toggle ship `fr` and `en` only.

### Deprecated

- Options the plugin never read are marked `@deprecated` and warn at boot when set: `allowedIPs`, `bypassSecret`, `bypassCookieName`, `authBypass`, `maintenancePageComponent` and `usersCollectionSlug`. Nothing is removed and your config still compiles, but these are middleware concerns: pass them to `createMaintenanceMiddleware()` to have any effect. The "Allowed IPs" and "Bypass secret" admin fields now carry the same warning in their description. `usersCollectionSlug` gets a louder warning: it does **not** drive the admin authorization gate — `adminCollectionSlug` does.
- `getNowInTimezone()` is deprecated. It is still exported and safe for display formatting, but must not be used for schedule comparisons (see Fixed).

### Fixed

- **Logo, favicon, background and split image were 404 on every default install.** `resolveMediaUrl` computed `media.url || media.filename ? '/' + media.filename : null`, which parses as `(url || filename) ? ... : null`: the real URL was tested, then discarded in favour of a bare `/<filename>`. The four media fields of the public maintenance page — the only page visitors see during an incident — now resolve, and an unpopulated relation stored as a string id yields `null` instead of `<img src="65f1c2d3...">` (a numeric id, as on SQLite and Postgres, already yielded `null`).
- **A finished maintenance window re-enabled itself indefinitely.** `checkScheduleState` had no upper bound on its auto-enable branch: as soon as `scheduledStart` was in the past, maintenance switched itself back on and the admin toggle stayed inoperative until the field was cleared by hand. Auto-enable now requires the current instant to be inside `[scheduledStart, scheduledEnd)`.
- **Scheduled windows fired at the wrong time as soon as a timezone was set.** "Now" was shifted into the configured zone and compared against Payload date fields, which are absolute UTC instants: on a UTC server with `Europe/Paris`, maintenance started and lifted two hours early, reopening the site mid-operation. Comparisons are instant-to-instant and the timezone is display-only. If you compensated by shifting your scheduled dates, remove that offset. Unparseable dates are now ignored rather than compared as `Invalid Date`.
- `GET /api/maintenance/stats` loaded and hydrated the whole subscribers table to produce a single integer (`find({ limit: 0 })` means "no pagination" in Payload, not "no document"). It uses `payload.count()` now — the dashboard hits this endpoint on mount and after every toggle.
- **Hydration mismatch (React error #418) on admin page load, for every browser language.** `MaintenanceNavLink`, `MaintenanceToggle` and `MaintenanceDashboard` read `navigator.language` during render, so the server rendered one language and the client another. Which users were hit depended on the component's server-side fallback: `MaintenanceNavLink` fell back to `'en'` and mismatched for French browsers, while `MaintenanceToggle` and `MaintenanceDashboard` fell back to `'fr'` and mismatched for every non-French browser — so an admin page load threw on at least one component whatever the language. Detection moved into an effect, after hydration.
- The toggle no longer takes its state from a failed write. A `401` or a `500` on `POST /api/maintenance/toggle` still returns a JSON body, whose `enabled` is `undefined`, and `Boolean(undefined)` used to flip both the dashboard and the widget to a green "Site online" while the site was still down. Both now report the failure and leave the displayed state untouched.
- A network blip while validating the auth cookie is no longer cached as a denial for 15 seconds — a single transient failure used to lock a signed-in admin out of the site for the whole window. Only a real negative answer from Payload is cached.
- The standalone maintenance page (`GET /api/maintenance/page`) and the `MaintenancePage` component treat a non-2xx `/status` as a failure and render their safe fallback, instead of building a page from an error payload.
- README: `trustProxy` was documented with a default of `false` while the code has always defaulted to `true` (the `x-forwarded-for` header is trusted). Set `trustProxy: false` when the app is not behind a trusted reverse proxy. The middleware option table also lists `bypassSecret`, `allowedIPs`, `usersCollectionSlug`, `trustProxy`, `statusEndpoint` and `maintenancePagePath`, which existed but were undocumented.

## [0.5.0] - 2026-04-08

### Added
- `trustProxy` option to control IP source (x-forwarded-for vs direct)
- `getNowInTimezone` utility (deduplicated from 2 locations)
- `checkScheduleState` utility (deduplicated from 3 locations)
- Analytics pagination with `since` parameter
- Export CSV with proper pagination (replaces limit:10000)
- Schedule-check race condition guard
- Timezone validation (IANA format)
- Schedule cross-field validation (end must be after start)
- Custom CSS validation (rejects script/iframe injection)
- Bypass cookie with `path: '/'`
- NavLink uses dynamic slugs from config endpoint
- Dashboard uses dynamic API base path
- Preset ID validation against whitelist
- Unsubscribe handler rate limiting + UUID validation
- Auth token JWT validation via /api/users/me (cached 15s)

### Changed
- GET /status no longer has side-effects (schedule auto-toggle moved to POST schedule-check)
- bypassSecret and allowedIPs removed from public response
- Rate limiter timer uses .unref()
- Catch blocks in dashboard log warnings

### Security
- Bypass secret no longer exposed in public API
- Auth cookie validated via JWT, not just presence check

## [0.3.1] - 2026-03-12

### Fixed
- **Double menu fix** — Collections (Subscribers, History) and global (Maintenance Mode) now hidden from Payload's default nav (`admin.hidden: true`) to avoid duplication when used with `@consilioweb/payload-admin-nav`
- All 4 collections (`maintenance-subscribers`, `maintenance-history`, `maintenance-analytics`, `maintenance-webhook-logs`) are now `admin.hidden: true`
- Global `maintenance` set to `admin.hidden: true` (removed "Settings" group)

### Note
- Navigation is handled exclusively by `MaintenanceNavLink` (afterNavLinks): Dashboard, Abonnés, Historique, Configuration
- Direct URL access to collections and global edit pages still works

## [0.3.0] - 2026-03-12

### Added
- **Sidebar nav group with icons** — `MaintenanceNavLink` component injected via `afterNavLinks`, matching SEO plugin's design pattern (Dashboard, Subscribers, History, Settings)
- Webhook logs collection (`maintenance-webhook-logs`) with delivery tracking
- Analytics and webhook-logs collections hidden from default nav

## [0.2.0] - 2026-03-12

### Added
- **4 new page templates** (2026 design): `aurora` (Northern Lights with animated gradient layers, floating particles, SVG waves), `neon` (Cyberpunk with pulsing glow, grid background, scanline, corner brackets), `mesh` (Apple-like animated blobs with mix-blend-mode), `particles` (Canvas-based interactive particle system with mouse interaction)
- **4 new presets**: `aurora-borealis`, `cyberpunk-neon`, `mesh-modern`, `particles-cosmic`
- **Standalone maintenance page endpoint** (`GET /api/maintenance/page`) — serves self-contained HTML, no React/Next.js route needed
- **GDPR newsletter compliance**: `consent` field required in POST body, `consentAt`/`consentSource`/`unsubscribeToken` stored per subscriber
- **Unsubscribe endpoint** (`GET /api/maintenance/unsubscribe?token=...`) — removes subscriber and shows confirmation page
- **Rate limiting** on public endpoints: `status` (60/min), `newsletter` (5/min), `track` (30/min) per IP
- **Auth check** added on `schedule-check` endpoint
- `src/utils/rateLimiter.ts` — shared in-memory rate limiter with auto-cleanup

### Changed
- Middleware now fetches HTML from `/api/maintenance/page` endpoint instead of rewriting to `/maintenance` route (plugin is fully self-contained)
- Countdown available on all 12 templates (was only 4)
- Newsletter POST body now requires `consent: true` (returns 400 otherwise)
- Email validation with regex on newsletter endpoint

### Fixed
- Maintenance mode now blocks properly without manual `/maintenance` route in host project

## [0.1.1] - 2026-03-11

### Fixed
- CSP `unsafe-eval` compatibility in development mode
- Middleware integration with Next.js

## [0.1.0] - 2026-03-10

### Added
- Initial release
- 8 page templates: minimal, countdown, coming-soon, glassmorphism, gradient, split-screen, video-background, custom
- 8 one-click presets (Corporate Blue, Startup Launch, Minimal Elegant, Glass Premium, Coming Soon Creative, Light Mode Clean, Warm Gradient, Tech Dark)
- Multi-language with auto-detection (10 languages: FR, EN, DE, ES, IT, PT, NL, JA, AR, ZH)
- Admin dashboard view with toggle, status, analytics
- Newsletter subscribers collection with CSV export
- Scheduled maintenance (auto on/off by datetime with timezone)
- IP whitelist, bypass secret, auth bypass for logged-in users
- Webhooks (Slack, Discord, custom HTTP) with delivery logs and retry
- Analytics tracking (page views during maintenance)
- HTTP 503 + Retry-After for SEO
- Dark/Light/Auto mode
- Google Fonts, Lottie animations, custom CSS/HTML support
- Favicon customization
- Social links (7 platforms)
- History/audit log collection
- `createMaintenanceMiddleware()` for Next.js middleware integration
- TypeScript strict mode, full type exports

[0.6.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.5.2...v0.6.0
[0.5.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.3.1...v0.5.0
[0.3.1]: https://github.com/pOwn3d/payload-maintenance/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pOwn3d/payload-maintenance/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pOwn3d/payload-maintenance/releases/tag/v0.1.0

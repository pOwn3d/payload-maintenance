# Changelog

All notable changes to `@consilioweb/payload-maintenance` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.5.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.3.1...v0.5.0
[0.3.1]: https://github.com/pOwn3d/payload-maintenance/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pOwn3d/payload-maintenance/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pOwn3d/payload-maintenance/releases/tag/v0.1.0

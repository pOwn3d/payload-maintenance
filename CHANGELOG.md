# Changelog

All notable changes to `@consilioweb/payload-maintenance` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-09-08

_Security release. Every version up to and including 0.6.0 carries the flaws closed here: an anonymous visitor could walk through maintenance mode with a forged cookie or a forged proxy header, four collections holding subscriber emails, visitor IPs and Slack/Discord webhook URLs answered to any logged-in user of any auth collection, the public maintenance page executed markup written by whoever may edit the global, and the webhook sender was a usable SSRF proxy into the host's network. Upgrading is enough to close them — but read `### Changed`, several of these hardenings are visible from the outside._

### Security

- **The four plugin collections answered to any authenticated user, from any auth collection.** `read`, `create` and `delete` (plus `update` on subscribers) were `!!req.user` on `maintenance-subscribers`, `maintenance-history`, `maintenance-analytics` and `maintenance-webhook-logs` — and Payload sets `req.user` for a member of *any* auth-enabled collection of the host app, publishes every collection at `/api/<slug>`, and `admin.custom.navHidden` only hides the nav entry. On a site with a customer area, a logged-in customer could therefore read the subscriber file (email, IP, user-agent, consent date, unsubscribe token), the IP and referer recorded for every visitor of the maintenance page, and the webhook logs — which store the **full Slack/Discord webhook URL**, a bearer credential, together with up to 2000 bytes of each response body — then delete rows from `maintenance-history`, the only trail recording who took the site offline. The four collections now run the same admin gate the global has had since 0.6.0 (`adminCollectionSlug`, or your `adminAccess`), which had never been propagated to them. If your install has a second auth collection, treat those webhook URLs as disclosed and rotate them. **For you:** a non-admin account — and any integration authenticating as one — is now refused on those four REST endpoints; the plugin's own writes go through the Local API and are unaffected.

- **The bypass cookie was the literal string `true`.** Anyone could set `maintenance-bypass=true` themselves — the name is the documented default — and browse the real site during maintenance with no secret, no allow-listed IP and no account. `httpOnly` stops JavaScript from *reading* a cookie, never a client from *sending* one, so this defeated the whole point of maintenance mode: unpublished content, pre-launch pages and application routes were reachable by an anonymous visitor, leaving nothing behind but an analytics row. The cookie now carries `<expiry>.<HMAC-SHA256 of that expiry>` signed with `bypassSecret`, is rejected once expired, and is only honoured when a `bypassSecret` is actually configured. **For you:** cookies issued by earlier versions are refused — visit `?bypass=YOUR_SECRET` once more; and an install that never set `bypassSecret` no longer has any cookie bypass.

- **`?bypass=` was compared with `===` and could be tried without limit.** The secret was compared in non-constant time and the middleware kept no failure counter at all. Comparison is constant-time now, and a caller gets 10 wrong values per minute — counted per resolved client IP only, never in a global or shared bucket, because a bucket an anonymous visitor can fill on someone else's behalf is a lever to lock the operator out of their own bypass link rather than a rate limit. **For you:** a caller whose address cannot be resolved (no `x-forwarded-for`, no `x-real-ip`) is deliberately *not* throttled on this path — set `trustProxy` / `trustedProxyHops` correctly and use a high-entropy secret.

- **`allowedIPs` in the middleware read the first element of `x-forwarded-for`, which the caller writes.** A conforming reverse proxy *appends* the peer address, so the first entry of that header is exactly what the client sent: any anonymous visitor who knew a whitelisted address — an office IP is often visible in DNS/MX records or in mail headers — could claim it and bypass maintenance. The client IP is now read as the entry the closest trusted proxy appended (`parts[length - trustedProxyHops]`, default 1 hop), and nothing is trusted when the chain is shorter than declared. **For you:** behind a CDN *and* a load balancer, set `trustedProxyHops: 2`, otherwise the allow-list stops matching.

- **`POST /newsletter`, `POST /track` and `GET /unsubscribe` ignored `trustProxy` and keyed their rate limit on a header the caller controls.** `plugin.ts` forwarded the option to `GET /status` only, so a host that had explicitly turned proxy trust off was still limited on a spoofable value. Rotating the header gave an anonymous caller an unlimited number of buckets — one subscriber or one analytics row per request — and full control of the `ip` column those collections keep for GDPR traceability and hand back in the CSV export, which made that column worthless as evidence. `trustProxy` and the new `trustedProxyHops` now reach all four public endpoints.

- **Public free-text fields were written to the database unbounded.** `path` on `/track` was stored verbatim with no length or shape check, `email` on `/newsletter` was checked only against a format regex that a multi-megabyte local part satisfies (Payload's own `email` validation does not bound length either), and `user-agent` / `referer` were stored whole. An anonymous caller could grow `maintenance-analytics` and `maintenance-subscribers` — neither of which has any retention — until the disk filled, and make the CSV export and the admin list views unusable. Now: `path` must look like a pathname (starts with a single `/`, at most 512 characters, no control characters) or is recorded as `/`; an `email` over 254 characters (RFC 5321) is a `400`; `user-agent` and `referer` are truncated at 512. A second ceiling caps what each endpoint can insert per minute across all callers (200 newsletter signups, 600 tracked views), so rotating addresses is no longer free.

- **Stored XSS on the maintenance page, reachable by any account allowed to edit the global.** The page visitors actually see is the one served by `GET /api/maintenance/page`, and that renderer assigned `customHTML` straight to `innerHTML` and concatenated `customCSS` into the same HTML string; the React `MaintenancePage` did carry a regex sanitizer, but it only stripped `on*` handlers preceded by whitespace and was never on the public path. Even without `customHTML`, its `esc()` escaped `&`, `<` and `>` but not the double quote, so every editor-supplied value interpolated into a quoted attribute (`socialLinks[].url`, `messages[].buttonUrl`, `logoUrl`, `lottieUrl`, `contactEmail`, the background and split image URLs) could break out of that attribute, and `accentColor` was concatenated raw into inline `onmouseenter` handlers. Since the plugin explicitly invites hosts to widen who edits the global through `adminAccess` — an editor or communications role — this is script running on the site's own origin in front of every visitor and of the admin previewing the page: a session-stealing escalation from a role that should only be able to change a sentence. Now: quotes and apostrophes are escaped; a value must be `http(s)`, site-relative, or `mailto:` for the contact link to reach an `href`/`src`, otherwise it is dropped; colours must be colour literals; the hover effect is a CSS rule instead of an inline handler; `customCSS` is applied through a `<style>` node's `textContent`; and `customHTML` + `customCSS` are rendered inside an `<iframe sandbox="">` — an opaque origin with scripting disabled — on both renderers.

- **The webhook sender was a read/write SSRF proxy into the host's network.** `fireWebhook` checked only that the URL's protocol was http(s), then fetched it from inside the private network and persisted up to 2000 bytes of the answer in `maintenance-webhook-logs`, which the first entry above made readable by any logged-in user. An account able to edit the global — again, possibly a delegated role — could aim it at loopback services, RFC1918 hosts or the cloud instance metadata address and read the answers back; the 3-attempt retry loop turned it into a repeatable relay. Targets resolving into loopback, RFC1918, CGNAT, link-local, multicast or reserved space — including the IPv4-mapped IPv6 spelling of the same host — are now refused before anything leaves the process, `localhost` is refused by name, redirects are never followed (an allowed host answering 3xx towards an internal address would otherwise walk straight past a check done on the initial URL), and the target is re-resolved before *every* retry instead of once for the whole loop. Two knock-on rules: a webhook URL must now be **`https://`**, because the TLS certificate is what prevents a short-TTL DNS record from swapping in an internal address between the guard's resolution and `fetch`'s own; and the new `allowedWebhookHosts` — the only control here that does not depend on that reasoning — should be set whenever the destinations are known. **For you:** an existing `http://` webhook stops firing and is recorded as refused in `maintenance-webhook-logs`; switch it to `https://`.

- **The middleware's auth-token cache was unbounded, held raw session JWTs, and doubled the traffic to Payload.** Every unseen value of the auth cookie triggered a server-side call to `/api/<usersCollectionSlug>/me` — throttled by nothing — and inserted an entry into a module-level `Map` that was never purged: an expired entry was only overwritten if the *same* token came back, which never happens with random values. An anonymous loop therefore grew the Next process's memory until OOM while turning each incoming request into two internal ones, at the exact moment the infrastructure is declared fragile. A token is now rejected with no network call unless it really looks like a live Payload JWT (three base64url segments, a header that decodes to JSON carrying `alg`, an `exp` that is not already past); the cache is keyed by a SHA-256 digest, so live session JWTs no longer sit in middleware memory; positive and negative answers live in two separate zones of 500 entries, so a flood of unknown cookies cannot evict signed-in admins; and unknown-token lookups are capped at 30 per minute per resolved client IP. **For you:** behind a shared egress address, once 30 unknown cookies have been rejected within a minute, an admin whose session is not already cached is served the maintenance page until the window rolls.

- **`POST /newsletter` told an anonymous caller whether an address was already a subscriber.** `Already registered` versus `Email registered` turned the endpoint into an email-enumeration oracle against the subscriber list, at no practical cost given the spoofable rate-limit key above. Both outcomes now return the same acknowledgement, and a rejected address returns the same `400` body whether it is malformed or too long. **For you:** clients must not branch on `message`.

### Changed

- The newsletter endpoint answers `If this address is valid, you will be notified.` for both a new and an existing address (was `Email registered` / `Already registered`).
- `template: 'custom'` is rendered inside a sandboxed iframe on both renderers: scripts inside `customHTML` no longer run, it can no longer read or restyle the surrounding page, forms and top-level navigation from inside it are blocked, and `customCSS` applies inside the frame only. `{{title}}`, `{{description}}`, `{{estimatedEnd}}` and `{{logoUrl}}` are HTML-escaped before substitution, so markup typed into those fields is displayed as text.
- `backgroundColor`, `textColor` and `accentColor` must be colour literals — hex (3/4/6/8 digits), `rgb()`/`rgba()`/`hsl()`/`hsla()`, or a bare colour keyword. Anything else (a `var(--token)`, an `oklch()`, a gradient) falls back to the default instead of being concatenated into the page.
- URL fields must be absolute `http(s)` or site-relative to be rendered: a protocol-relative `//cdn.example.com/logo.png` is dropped, and a background or split image URL containing a quote, a parenthesis, a semicolon or whitespace is dropped rather than allowed to break out of its `url()`. `googleFont` is stripped of everything outside letters, digits, spaces and hyphens.
- On `GET /api/maintenance/page`, the social-link hover is a CSS rule fed by a `--m-accent` custom property; the accent colour used to be injected into inline `onmouseenter` / `onmouseleave` handlers. Same visual result.
- With `trustProxy: false` on a runtime that exposes no peer address, every public caller now resolves to the same `unknown` key: `/newsletter` (5/min), `/track` (30/min) and `/unsubscribe` (10/min) share a single budget for the whole site, where each caller previously got their own — spoofable — bucket. Prefer `trustProxy: true` with a correct `trustedProxyHops`.
- The middleware warns at boot when `allowedIPs` is set together with `trustProxy: false`: Next.js middleware exposes no peer address, so that allow-list could never match.
- The webhook URL field in the admin now documents the `https://` requirement (en/fr).
- GitHub Actions in `ci.yml` and `publish.yml` are pinned to commit SHAs instead of floating tags.

### Added

- `trustedProxyHops` — plugin option *and* middleware option, default `1`: how many reverse proxies append to `x-forwarded-for`. The client IP is read as `parts[length - trustedProxyHops]`; use `2` for CDN + load balancer.
- `allowedWebhookHosts` plugin option — allow-list of hostnames the webhook sender may contact (sub-domains match). Recommended: it is the only SSRF control here that does not depend on DNS timing.
- `bypassCookieMaxAge` middleware option — lifetime of the signed bypass cookie in seconds (default `86400`, floor `60`).
- `.github/workflows/security.yml` — `pnpm audit --audit-level high`, gitleaks over the full history and CodeQL `security-extended`, on every push and pull request plus a weekly run, because a dependency that was clean at merge time can become vulnerable later.
- `.github/dependabot.yml` — weekly npm updates (grouped) and monthly action updates, with major bumps of the `payload`, `react`, `react-dom` and `next` peers deliberately ignored: peer ranges are the package's public contract.
- Tests: 152 vitest tests over 10 files (83 in 0.6.0), covering the collection access gate, the signed bypass cookie, `x-forwarded-for` hop resolution, the SSRF guard and its refusal of redirects, the escaping of the served HTML page, and the bounds on the public write endpoints.

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

[0.7.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.5.2...v0.6.0
[0.5.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.3.1...v0.5.0
[0.3.1]: https://github.com/pOwn3d/payload-maintenance/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pOwn3d/payload-maintenance/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pOwn3d/payload-maintenance/releases/tag/v0.1.0

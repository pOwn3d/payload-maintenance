# Changelog

All notable changes to `@consilioweb/payload-maintenance` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-09-08

_Quality, accessibility and compliance — **not** a security release. No flaw is closed here, nothing in 0.8.0 becomes unsafe by waiting, and there is no reason to rush this one out. It settles what an audit left open and the angles that audit never looked at: the visitor IPs this plugin writes are truncated before they reach the database and finally have a retention, the components it injects into the admin can no longer take the whole Payload panel down with them, the newsletter field is usable with a screen reader and a keyboard, and uninstalling the plugin now takes its data with it. **No schema change, no migration to generate, and no breaking change** — the API only grows._

### Fixed

- **The only form control this plugin renders had no accessible name and no focus indicator — four defects, one field, both renderers.** The newsletter `<input type="email">` carried a `placeholder` and nothing else. A placeholder is not an accessible name: it is not exposed as one, and it disappears on the first keystroke — so the single interactive element of the page a visitor is *forced* onto announced as an unlabelled edit box. It now carries an `aria-label`, translated into the ten languages both renderers already shipped (`emailLabel`, fr/en/de/es/it/pt/nl/ja/ar/zh). `aria-label` rather than `useId()` + `htmlFor`: the plugin ships no `<label>` anywhere to point at, and the design is a single inline field with no room for a visible one. The focus indicator was suppressed twice and had to be restored twice, because the two renderers suppress it differently. On the React renderer, `outline: 'none'` sat in an **inline** style — which no `:focus` rule can ever override — leaving a 1px border-colour change on a translucent field as the only feedback; the declaration is dropped, so the browser default comes back. On the HTML page served by `GET /api/maintenance/page`, `outline:none` sat in the `.m-newsletter input` rule with nothing put back; CSS can carry a real replacement, so that one gets a designed ring: `.m-newsletter input:focus-visible{outline:2px solid currentColor;outline-offset:2px}`, where `currentColor` follows the configured text colour and is therefore readable on the configured background by construction. WCAG 2.4.7 and 4.1.2 / RGAA 10.7 and 11.1, on a public-facing screen — which is what puts it in EAA scope.

- **The rest of the accessibility checklist was verified, not assumed, and does not apply here.** Stated because "no finding" and "not looked at" are indistinguishable in a changelog: this plugin renders no tab list and no live region, so there is no ARIA tabs pattern to implement; every `onClick` in `MaintenanceNavLink`, `MaintenanceToggle`, `MaintenanceDashboard` and `MaintenancePage` is already on a real `<button>`, so there is no non-interactive element to convert; and its single `<form>` contains exactly one `type="submit"`, so there is no implicit-submission button to pin down with `type="button"`. The one button added in this release (the boundary's retry, below) carries `type="button"` and `role="alert"` on its panel.

- **An exception in the sidebar link crashed every page of the admin panel, not just the maintenance link.** That is the radius that matters: `MaintenanceNavLink` is injected into `config.admin.components.afterNavLinks`, which Payload renders in the sidebar of **every** admin page — a malformed answer from `GET /api/maintenance/config`, a Payload release that changes `usePathname`, any throw at all — and it took the panel with it. `MaintenanceToggle` (`beforeDashboard`) has a smaller radius, the admin home only, and `/admin/maintenance` is the third mount point. All three now sit behind the new `MaintenanceErrorBoundary`.
  - **The boundary lives inside each module, not around the mount point.** Payload mounts these components straight from the import map, so the plugin never becomes their parent and has nowhere else to put an ancestor. `MaintenanceNavLink` and `MaintenanceToggle` are each now a thin wrapper around a renamed `…Inner`.
  - **The fallback differs per mount point, deliberately.** `fallback={null}` for the nav link and the dashboard widget: a red error panel wedged into the sidebar of every single admin page would be a worse outcome than a missing shortcut. The `/admin/maintenance` view keeps the visible panel — it has nothing else to show, and silence there would read as a blank screen.
  - **No server component is guarded by a try/catch here, and none needed to be.** The plugin has one server component, `MaintenanceView`, and it reaches the boundary through the package's `./client` entrypoint (`MaintenanceViewClient.tsx` re-exports `MaintenanceErrorBoundary` alongside `MaintenanceViewClient`) — importing `../components/ErrorBoundary.js` directly would inline a React **class** component into the RSC bundle, where class components are not allowed. Its authorization gate already `redirect()`s rather than throwing, so the boundary only has to cover the client subtree, which it does.
  - The boundary itself is a hardened copy of the one shipped by `payload-support`, and each difference fixes a real defect of that original: retrying **remounts** the subtree (the attempt counter is used as a `key`) instead of merely clearing the flag, which would re-render the element that just threw with the same props and throw again; `resetKeys` clears the error on its own when the inputs change; `fallback` is honoured with `!== undefined`, so `fallback={null}` really renders nothing instead of falling through to the default panel; the error **message** never reaches the screen (only `console.error`), because a server-side message can carry a path; `role="alert"` announces the swap; colours are Payload theme tokens instead of hard-coded hex, so the panel is readable in dark mode; strings are fr/en like the rest of the plugin. It does not catch async rejections or event-handler throws — no React boundary does.

### Added

- **A retention purge, with one implementation and three callers.** `runRetentionPurge(payload, options)` deletes rows older than their retention and reports the cutoff it used, so a caller can tell "nothing configured" (`null`) from "purged zero rows" (`{ deleted: 0 }`).
  - `DELETE /api/maintenance/analytics/purge` — the manual path, gated exactly like `/toggle` and `/analytics` (the admin collection, or your `adminAccess`; the endpoint count in the README goes from six to seven). It is registered **unconditionally**, including with `enableAnalytics: false`, because `subscribersRetentionDays` can be set on its own and would otherwise have no trigger at all.
  - A Payload Jobs task, slug `maintenance-retention-purge`, scheduled daily at 03:00 (`0 0 3 * * *`) — registered **only when your config already carries a `jobs` key**. Adding that key ourselves would materialise the `payload-jobs` collection, which is a schema change, on installs that never asked for one. A host already declaring a task under that slug keeps theirs untouched, since two tasks with the same slug is a Payload boot error. And note what Payload requires beyond registration: a scheduled task only fires if the host has autorun or a cron hitting `/api/payload-jobs/run` — check yours, or the endpoint is your only mechanism.
  - Deliberately **not** a `setInterval`: an in-process timer does not survive a serverless deploy and runs once per instance behind a load balancer — the two failure modes the plugin already had to fix for its rate-limit counters.
  - Defaults: analytics **395 days** (13 months, the CNIL ceiling for audience measurement), subscribers **off**. Subscribers are off on purpose — a subscriber row is also the proof of their consent (`consentAt`, `consentSource`, `ip`), so deleting it on a timer weakens the file instead of improving it. A retention below `1` disables the sweep for that collection rather than deleting everything, so a typo in a scheduled task cannot empty the table.
  - Exported for hosts running their own scheduler: `runRetentionPurge`, `DEFAULT_ANALYTICS_RETENTION_DAYS`, `RETENTION_TASK_SLUG`, `createRetentionPurgeHandler`, and the `RetentionOptions` / `RetentionReport` types.

- **`analyticsIpMode`** — `'anonymized'` (default), `'full'` or `'none'`, plus the `anonymizeIp` helper and its `AnalyticsIpMode` type. Truncation is applied at the **write** point, never in `resolveClientIP`: doing it at resolution would merge the 256 addresses of a `/24` into one rate-limit bucket — one visitor exhausting the limit for their whole neighbourhood — and break `/32` allow-lists. A test pins that separation. `'none'` omits the `ip` field entirely rather than writing an empty string, so a host can demonstrate nothing was collected.

- **`analyticsRetentionDays`** (default `395`) and **`subscribersRetentionDays`** (default `undefined`, no purge) plugin options.

- **`MaintenanceErrorBoundary`** and its `MaintenanceErrorBoundaryProps` type, exported from `@consilioweb/payload-maintenance/client` for hosts wrapping their own admin components.

- **`npx maintenance-uninstall`** — a `bin` shipped with the package, and the reason it exists is specific: removing the plugin by hand leaves `maintenance-analytics` in your database — IP addresses, user agents, referers, with no retention — while deleting the only interface able to read or erase them. Worst of both worlds, and silent. It reports every source file referencing the package but **does not rewrite them** (a regex edit inside your `plugins` array is how a `payload.config.ts` gets silently corrupted — remove the `maintenancePlugin()` call yourself), deletes the documents of the four collections through the **Payload Local API** via `payload run` so it works on SQLite, PostgreSQL and MongoDB alike and honours custom slugs, then removes the package and regenerates the import map. A detection gate stands in front of the destructive step: it runs only when a source file references the package or `package.json` declares it, or with `--force-data`. `--dry-run` counts without deleting, `--keep-data` skips the data step, `--slugs a,b,c` covers renamed collections. It never drops a table — Payload owns the schema, and a plugin dropping tables from under it is how a database drifts from the migration ledger — so it prints the statements for the three adapters instead and tells you to run `payload migrate:create` afterwards.

- **README: four new sections.** *Upgrading* (0.8.x → 0.9.0 and 0.6.x → 0.8.0, each stating whether the schema moves), *Personal data and retention* (a per-collection table of what is stored, who writes it, a possible lawful basis and the default retention, written to be copied into a record of processing activities), *Database and updates*, and *Uninstall*.

- **A `Database and updates` block that states the plugin's relationship to your schema**, because the question comes up on every install: this plugin *adds* collections and a global to your config, it does not own your schema — your app does; **Payload does not let a plugin ship migrations**, since `payload migrate` reads exactly one directory, the host's `payload.db.migrationDir` resolved against your `cwd`, so a migration file inside an npm package is never discovered. Hence the host-side workflow: `push` in development, `payload migrate:create` then `payload migrate` in production (never `push`, which Payload skips under `NODE_ENV=production` and which triggers its data-loss warning when mixed with migrations). Every release states in its *Upgrading* section whether it changes the schema; none has since 0.6.0.

- Tests: **204 vitest tests over 14 files** (161 over 11 in 0.8.0). The 43 new ones: 11 on the anonymiser and the purge (IPv4 `/24`, IPv6 `/48` with re-compression, the IPv4-mapped form, zone indices, an unreadable value stored as `unknown` rather than verbatim, the `subscribedAt` vs `timestamp` fields, a retention of `0` refused); 10 on the boundary (`fallback={null}` rendering nothing, the remount-on-retry, `resetKeys`, the error message never reaching the tree, and that both mount points wrap themselves); 9 on the uninstaller (the detection gate's five outcomes, the real-tree scan ignoring `node_modules`, the drop statements covering the global too); 6 on the plugin wiring (the purge endpoint's admin gate, its survival with analytics off, the Jobs task registered only with a `jobs` key and yielding to a host's own, the `authBypass` seeding); 5 on `/track` (the three IP modes, and that the rate-limit key stays the full address); 2 on the served page's accessibility (the focus rule, and the accessible name in all ten languages).

### Changed

- **Visitor IPs in `maintenance-analytics` are truncated before they are written** — IPv4 to `/24` (`203.0.113.42` → `203.0.113.0`), IPv6 to `/48` (`2001:db8:85a3:8d3::1` → `2001:db8:85a3::`). This is the one behaviour change to read before upgrading. It is a **default flip**, chosen that way because the plugin collects on a page the visitor cannot opt out of, so the safe default has to be the one that needs no lawful basis of its own: truncation plus a bounded retention is what brings the collection inside the CNIL audience-measurement exemption, and a consent banner would not help — a visitor with no alternative screen cannot give a free consent. `uniqueIPs` stays usable as an order of magnitude. **For you:** rows already stored keep their full address, only new writes change; `analyticsIpMode: 'full'` restores the previous behaviour, and it is a real decision rather than a knob — a full IP identifies a household, you take on the lawful basis, the information duty and the access/erasure requests, so shorten `analyticsRetentionDays` if you choose it. Rate limiting and the middleware allow-list are untouched: they always used, and still use, the full address, which never leaves the process.

- **`authBypass` stopped being a no-op.** It was one of six middleware-shaped plugin options that the plugin warned about and ignored; on re-examination it is the only one that can be honoured without either publishing a secret or adding an endpoint the middleware would have to call before deciding anything. It now seeds the **default value** of the `authBypass` checkbox on the maintenance global, which `GET /status` publishes and the middleware already honours — no new code path, no secret exposed, the runtime decision stays exactly where it was. The boot warning is kept but corrected: it no longer claims the option has no effect, it states the real scope. **For you:** `defaultValue` only applies to a global that has never been saved, so an existing install keeps its stored value — change it from the admin panel, or override it for every visitor with `createMaintenanceMiddleware({ authBypass: false })`. A fresh install with `authBypass: false` now starts with the checkbox off, where it previously started on.

- **The five remaining deprecated options now carry a removal date instead of an open threat: v1.0.0, not before 2027-03-08.** They are *not* removed here — dropping them would break the build of every consumer that passes one. Each was re-examined rather than assumed dead, and the JSDoc now says why it cannot be wired instead of only that it is not: `bypassSecret` would have to be served over an endpoint, which is the one thing a bypass secret must never be; `allowedIPs`, `bypassCookieName` and `usersCollectionSlug` are needed by the middleware *before* it decides whether to call the API at all (and seeding the global's inert `allowedIPs` textarea was considered and rejected — it would give the option the appearance of an effect and none of the substance); `maintenancePageComponent` was never implemented, and honouring it now would be a new feature — a second rendering path competing with the served page — not a fix.

- **`notifyEmail` on the global no longer describes a feature that does not exist.** Its admin description claimed "Receive an email when maintenance mode changes (uses Payload email adapter)"; nothing in the plugin reads that address, verified across the whole source. It now says so in both languages, points to a webhook for a real notification, and the field is kept only so a value already saved is not lost. Removal or implementation is planned for v1.0.0.

- **The `country` field on `maintenance-analytics` is labelled as unused, and stays that way on purpose.** No code path resolves a country; filling it would mean geolocating the caller's IP — one more personal datum, most likely through a third party, in the very collection whose footprint this release reduces. It is relabelled "Country (unused)" with an explicit description rather than dropped, because dropping a column is a schema change and this release has none; it waits for v1.0.0.

- **`vitest.config.ts` also collects `scripts/**/*.test.mjs`**, so the uninstaller binary — plain ESM, outside `tsconfig`'s `rootDir` — is covered by the same `pnpm test`. `package.json` gains the `bin` entry and ships `scripts/` in `files`.

- README: the collections table says **Admin** where it used to say *Authenticated*, which is what it has actually meant since 0.7.0; the features list states that analytics are anonymised by default and that a purge exists; and the security list gains the isolated admin components.

## [0.8.0] - 2026-09-08

_Security release, one flaw deep. 0.7.0 closed the endpoints, the collections and the public page, but left the admin **view** open: Payload deliberately skips its own `canAccessAdmin` redirect for custom admin views and delegates the decision to the component, and this component only checked `req.user` — as it had since 0.1.0. On a site with a second auth-enabled collection (a customer area, a members space), any account in it could open `/admin/maintenance` and land inside the admin panel. Upgrade now if that describes your install. The Payload peer floor also moves to `^3.79.1`, which is a breaking install change._

### Security

- **`/admin/maintenance` was reachable by a member of any auth collection of your app.** `@payloadcms/next` guards the panel with `if (!permissions.canAccessAdmin && !isPublicAdminRoute(...) && !isCustomAdminView(...))`, and `isCustomAdminView()` only compares a URL path against the registered custom views — it tests no visibility or access flag, so matching is enough to skip the redirect and authorization is delegated entirely to the view component. `MaintenanceView` checked `!!req.user` and nothing else, from 0.1.0 through **0.7.0 included** — and Payload populates `req.user` from a single `payload-token` cookie for a member of *any* auth-enabled collection of the host app (customers, members, partners). Such an account is refused everywhere else in `/admin` (`canAccessAdmin === false`), yet walked straight into this route and had Payload's admin layout rendered around it: the panel shell, the navigation built from `visibleEntities`, and the client-side config the admin hands every rendered page. The privileged calls behind the dashboard (`/toggle`, `/stats`, `/presets/apply`) have answered `401` to a non-admin since 0.6.0, so what this exposed is the admin panel itself, not the maintenance switch. The view now requires **both** Payload's own `canAccessAdmin` verdict *and* the same `isMaintenanceAdmin` gate as the endpoints (`adminCollectionSlug`, or your `adminAccess`), and redirects to `<adminRoute>/unauthorized` otherwise. **For you:** if your app has a second auth collection, assume every account in it could open that page, and grep your access logs for `/admin/maintenance`. Then check your *other* custom admin views: this exemption is Payload's behaviour for the whole `admin.components.views` map, not something specific to this plugin, so every custom view you or another plugin registers has to run its own check.

- **The peer range allowed a Payload vulnerable to a pre-authentication account takeover.** `peerDependencies.payload` was `^3.0.0`, which resolves happily to versions affected by [GHSA-hp5w-3hxx-vmwf](https://github.com/payloadcms/payload/security/advisories/GHSA-hp5w-3hxx-vmwf) (pre-auth account takeover) and by an SQL injection. Nothing in this plugin needs an API newer than Payload 3.0 — `^3.79.1` is purely a security floor, and the `@payloadcms/*` packages ship in lockstep with `payload`, so they carry the same one. **For you:** the range never blocked those versions and this release cannot uninstall one for you — read the version actually resolved in your app (`pnpm list payload` / `npm ls payload`) rather than trusting the range, and upgrade Payload itself.

### Breaking

- **The peer floor moves to Payload `^3.79.1`, and Next 14 / React 18 are dropped.** `payload`, `@payloadcms/next`, `@payloadcms/ui` and `@payloadcms/translations` go from `^3.0.0` to `^3.79.1`; `next` from `^14.0.0 || ^15.0.0 || ^16.0.0` to `^15.0.0 || ^16.0.0`; `react` and `react-dom` from `^18.0.0 || ^19.0.0` to `^19.0.0`. Payload `>= 3.79.1` itself requires Next 15+ and React 19, so the previous ranges advertised a combination that could not be installed in the first place. Installing on an older stack now reports an unmet peer dependency — an outright failure under a strict peer setting — instead of resolving in silence. Fix: upgrade Payload, which you want regardless (see Security).

- **`/admin/maintenance` now refuses accounts it used to let in.** Three cases change, all deliberate: a member of any collection other than `config.admin.user` is redirected to `<adminRoute>/unauthorized`; an account *of* the admin collection that the host's own `access.admin` turns down (deactivated account, "no panel" role) is refused there too, where it previously got in; and an `adminAccess` granting maintenance to a collection outside `config.admin.user` still opens the endpoints and the global, but no longer this page — the view also demands `canAccessAdmin`, and Payload refuses that account everywhere else in `/admin` anyway. If you need such a role to reach a maintenance UI in the panel, give it access to the admin panel proper.

### Fixed

- **The redirects ignored a renamed admin route.** The unauthenticated case was hard-coded to `/admin/login`, so a host that set `routes.admin` to `/back-office` sent its visitors to a 404. Both redirects now read `config.routes.admin` and fall back to `/admin`.

### Changed

- The view is registered as `{ path, exportName, serverProps }` instead of the `'@consilioweb/payload-maintenance/views#MaintenanceView'` shorthand — that object is how it receives `adminCollectionSlug` and `adminAccess`, which a custom admin view has no other way to read. **The import-map identity (`path#exportName`) is deliberately unchanged, so an `importMap.js` already generated in your app keeps resolving the view: no regeneration needed.** A test pins that identity.
- `MaintenanceView` is now an `async` server component, because the authorization gate is awaited. Nothing to do if you only register the plugin; a host importing the view directly must render it as one.
- The authorization check is `permissions.canAccessAdmin !== false` rather than `=== true`, so the view keeps working should a future Payload version stop populating `permissions` for a custom view — the plugin's own gate still runs in that case.
- README: the peer table and the requirements table state the `3.79.1` security floor and why it exists, the security section documents the view gate, and the `adminAccess` row spells out that the admin *view* additionally requires `canAccessAdmin`.

### Added

- Tests: 161 vitest tests over 11 files (152 over 10 in 0.7.0). The 9 new ones cover the view gate — a foreign auth collection refused, an admin let through, an unauthenticated visitor sent to login, an admin-collection account with `canAccessAdmin: false` refused, a renamed admin collection followed, a custom `adminAccess` honoured inside the panel and overruled outside it, a renamed admin route respected — plus the plugin wiring that hands the options to the view without moving its import-map identity.

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

[0.9.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.5.2...v0.6.0
[0.5.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.3.1...v0.5.0
[0.3.1]: https://github.com/pOwn3d/payload-maintenance/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pOwn3d/payload-maintenance/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pOwn3d/payload-maintenance/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pOwn3d/payload-maintenance/releases/tag/v0.1.0

---

title: "Overview — the portal's home page"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-26
verified_against: [code]
owner: harshil
related_code:
- src/pages/dashboard/index.astro
- src/components/dashboard/overview/Overview.tsx
- src/components/dashboard/overview/OverviewCharts.tsx
- src/components/dashboard/overview/format.ts
- src/components/dashboard/overview/motion.ts
- src/styles/pages/overview.css
- src/pages/api/dashboard/overview.ts
- src/lib/overview/sections.ts
- src/lib/dal/OverviewRepository.ts
- src/lib/analytics/providers/index.ts
- src/lib/visible-poll.ts
- src/lib/analytics/providers/cloudflare.ts
- src/lib/analytics/providers/external.ts
related_docs:
- SYSTEM-HEALTH.md
- GSC-AUTO-HEALING-AND-VALIDATION-ENGINE.md
- ../records/reports/2026-10-26-overview-redesign.md
- ../records/reports/2026-10-26-overview-glass.md
- ../specs/2026-10-26-overview-glass-look.md
- ../operations/OPERATIONS.md
tags: [feature, dashboard, overview, analytics, cloudflare, supabase]
---

# Overview — the portal's home page

> **TL;DR (non-technical):** The first page after signing in. It says what needs you, who is at
> the hotel, whether the platform is working, and what changed, each part only for people who may
> open the page it comes from. Every number is read from the hotel's own records; nothing is made
> up.

> **Rewritten 2026-10-26** for the redesign (change record (private)),
> and the same day again in frosted glass, with figures that count up and a chart to switch
> (change record (private), the look in
> [the spec](../specs/2026-10-26-overview-glass-look.md)). The page it replaced (a deck of four
> cards, some with invented values, and five tabs of raw server numbers) is described in the first
> record and in git.

**Scope:** the `/dashboard` home page, its one data route, and the analytics provider layer whose
snapshot its website figure and chart and the Cloud Services pages read.

---

## 0. What the page shows

`src/pages/dashboard/index.astro` mounts one island, `Overview` (`client:load`), on a soft
backdrop of its own (`.ov-scene`, four blurred colour blobs) with translucent "frosted glass"
panels over it (`src/styles/pages/overview.css`, warm in the light theme, violet and blue in the
dark; [the look](../specs/2026-10-26-overview-glass-look.md)). The island makes one call,
`GET /api/dashboard/overview?day=<the viewer's date>`, on opening, every 5 minutes while the tab
is on screen (`src/lib/visible-poll.ts`) and on the refresh button. While it waits, glass outlines
of the cards shimmer in their places; then the cards rise in one after another, the figures count
up from 0, the chart's line draws itself, the health ring sweeps round and the backup strip fills
from the left. On a refresh the figures run from the old value to the new one. A device set to
reduce motion gets none of this movement.

From the top, in this order on a phone. On a wide screen the chart row moves up to second place,
under the figures:

| Part | What it shows | Shown to someone who may open | Read from |
|---|---|---|---|
| Greeting | The first name's initial, today's date, Good morning / afternoon / evening and the first name; one sentence ("2 things need you. 1 pet is staying tonight, the next arrival is Wednesday 29 Oct and the last backup finished 9 h ago."); a "2 need you" button that jumps to the list; when it was read and a refresh button; on a wide screen a "Find a page" box that opens the sidebar's page search (Ctrl K) | everyone | the sections below |
| Figures | Up to six cards: pets staying tonight (how many leave tomorrow, pets in and out today); arrivals in the next 7 days (the first day); bookings made on the website in the last 30 days against the 30 before (▲ or ▼ and by how many); emails delivered in 30 days (how many failed, the share delivered); health checks passing out of all (failing or to look at, how many are not set up or not run); website requests in 24 hours (the share served from cache, threats blocked). Each opens its page | Bookings (the first three), Email, System health, Analytics → Website traffic (Cloud Services → Cloudflare until 2026-10-28) | as the sections below; the bookings made are two counts on Supabase `bookings.created_at`, cancelled ones included |
| Needs you | One line per source that holds something, most urgent first: open System health problems and checks failing or to look at; a failed latest backup; website bookings of the last 7 days that did not go through; open privacy (ARCO) requests and their deadlines; changes waiting for the viewer's approval; access requests the viewer decides; new inquiries. "All clear" when there is nothing | each line: the page it opens (System health, Backups, Bookings, ARCO, Users, Users, Inquiries) | health-state row and `platform_alerts`; `backup_runs`; `booking_attempts`; Supabase `legal_requests` (`computeSla`); `approvals:pending`; `admin_access_requests`; Supabase `contact_messages` |
| Next arrivals | The next 4 arrivals as "Ana L. · 2 pets", service, nights, leaving day and how soon | Bookings | Supabase `bookings` and `booking_pets`, minus those deleted or cancelled in `admin_booking_state` |
| Backups | A tile that stands out of the glass: how long ago the last good backup finished, its kind and size, whether the latest run failed, the last 14 runs as a strip, and how many of the runs that had work backed up | Backups | `backup_runs` (kind `backup`, the console's check runs left out) |
| The chart | A sideways row to switch between emails delivered each day for 30 days (with the ones not delivered as a second line, and System health's own sentences on the queue and Brevo under it), pets staying each night for the next 14 nights, and website requests each hour for 24 hours (with the top countries). Touch or hover to read a point on the chart | Email, Bookings, Analytics → Website traffic (each choice; Cloud Services → Cloudflare until 2026-10-28) | Supabase `email_audit_logs` by the UTC day it was logged; the stays above; the analytics snapshot (below) |
| Platform health | A ring of all System health checks (passing, to look at, failing, not set up or not run) with the number passing in the middle, then the six groups, each with its state word and one small bar per day for 14 days | System health | the health-state row ([`SYSTEM-HEALTH.md`](SYSTEM-HEALTH.md) §6) |
| Recent activity | The last 6 things people did in the portal, in plain words, a run of the same thing as one line with a count | Audit Log | `admin_audit_log`, without the log's own evidence entries (`*_mutation_attempt`, `audit_seal`, `view`) |
| Latest changes | The newest commit in each of the six repositories, with its Workers Builds state | GitHub | the GitHub snapshot in KV ([`GITHUB.md`](GITHUB.md)) |
| Jump bar | A bar that floats at the bottom of the screen with the page's own parts (Today, Needs you, Arrivals, Backups, Trends, Health, Activity, Changes, as the viewer has them); the part on screen is marked, and it scrolls sideways when it does not fit. It is part of the page, not a second menu: the sidebar stays the way to other pages | everyone with three parts or more | — |

"May open" is decided as the sidebar decides: `decideAccess` on the person's access map and the
page's floor (`pageFloorOpens`), plus `denyHealth` for Platform and `canViewGitHub` for Latest
changes. A section the person may not open is left out of the answer, not sent empty.

"Today" is the viewer's own date, sent by the browser, because the hotel has no time-zone setting;
a date that is not within a day of UTC is ignored and the UTC date is used. A night counts a pet
from its check-in date up to the night before its check-out date.

### 0.1 Every value is read

The old page showed values that were not measurements (a literal `99.8% Delivery`, `100.0%` and
`1.2 ms` fallbacks, an invented "Isolate Health" index, a literal SEO card; SH-8). None of them
exist on this page. A source that cannot be read shows its own sentence ("The bookings could not
be read just now. Refresh in a minute.") in place of its numbers, and the other sections still
show; "Needs you" names any source it could not check. A guest's full name never reaches the page:
the route cuts it to a first name and an initial.

### 0.2 How the data gets there

`GET /api/dashboard/overview` (`src/pages/api/dashboard/overview.ts`) reads everything side by
side (`Promise.allSettled`), each Supabase call with a 4-second limit
(`src/lib/dal/OverviewRepository.ts`), and turns it into words and numbers with the pure
functions in `src/lib/overview/sections.ts`; the figures' words are `kpiList` in
`src/components/dashboard/overview/format.ts`. It writes nothing. For an Owner it costs about six
D1 reads, seven Supabase reads (the two counts of bookings made are head requests that return no
rows) and two KV reads; the analytics and GitHub snapshots are refreshed
after the response when they are old, as before.

The website figure and chart read the analytics snapshot through `fetchAllAnalytics()`, which:

1. reads **one** KV key (`telemetry_metrics_cache_stale_v2`) from the `SESSION`
   namespace, the last good snapshot, and returns it when its own `timestamp`
   is less than 5 minutes old (`METRICS_CACHE_TTL_MS`);
2. when the snapshot is older, returns it **at once**, marked `refreshing`, and
   fans out to the eight providers in the request's `waitUntil`, writing that one
   key back on success (one background refresh per isolate per 30 seconds);
3. only when there is no snapshot at all does the request wait for the providers.

The Service Control pages (`/dashboard/control-plane`) read the same snapshot the same way. Since
2026-10-26 the old Overview's detailed views live there, on the owner's choice: the Workers list
(`WidgetEdgeCompute`) on Cloud Services → Cloudflare (removed 2026-10-28 with that tab, which
moved to Configuration; Analytics' Reliability part lists each Worker), the database details
(`WidgetPostgresCluster`) on Cloud Services → Supabase, both drawn from the snapshot the page
already reads; and Google's readiness report (`GscValidationWidget`) on the SEO page.

*History:* until 2026-10-26 the island was `DashboardController.tsx` and it called
`GET /api/dashboard/metrics` (both removed 2026-10-26). The poll went from every 60 seconds,
hidden tabs included, to every 5 minutes while visible on 2026-10-04, and a stale snapshot stopped
making the page wait on 2026-10-10. On a Cloudflare-provider failure the last snapshot is kept and
served with its own `timestamp`.

---

## Analytics Provider Architecture

### Provider design

The analytics system uses **8 parallel providers**. Each returns a typed result
object with an optional `_unconfigured` flag. When a token is missing or a fetch
fails, the flag is set instead of throwing. All eight run under
`Promise.allSettled`, so one crashing never affects the others.

### Provider descriptions

1. **Zone HTTP Metrics** — zone-level HTTP analytics from Cloudflare GraphQL (requests, cached, bandwidth, threats, status codes, WAF actions, top countries). Also queries D1 analytics for read/write stats.

2. **Worker Invocation Analytics** — account-level Worker invocation data from Cloudflare GraphQL. CPU/wall times are converted from microseconds to milliseconds. Both worker scripts always appear in output, even with 0 invocations (`WORKER_SCRIPTS` in `src/lib/analytics/providers/cloudflare.ts`).

3. **R2 Bucket Usage** — object count and uploaded bytes from the R2 REST API.

4. **Queue Info** — queue metadata **plus backlog and dead-letter metrics**: consumer count, `backlog_count`, `backlog_bytes`, and the same figures for the `-dlq` queue. *Corrected 2026-09-19: this said "name, consumer count".*

5. **Supabase PostgreSQL Metrics** — Prometheus metrics from Supabase (18+ metrics including tuple activity, cache hit ratio, deadlocks, WAL, disk utilisation).

6. **Supabase Auth Metrics** — total registered users, MAU (derived from `last_sign_in_at`), recent signups (7d), and auth provider breakdown via the Supabase Admin API. These reflect users in Supabase's `auth.users` table (used for DB access); portal authentication itself is Cloudflare Zero Trust.

7. **Sentry** — fetches the **5 most frequent unresolved issues** (`?query=is:unresolved&limit=5&sort=freq`) and sums their **lifetime** `count`. *Corrected 2026-09-19: this said "fetches error event counts", which reads as a windowed count. It is neither windowed nor complete.*

8. **Email Stats** — reads the **latest 100 events** from Brevo (`api.brevo.com/v3/smtp/statistics/events?limit=100`, `src/lib/analytics/providers/external.ts`) and counts `sent`/`delivered` and the bounce variants among them. *(Corrected 2026-08-13 — this said Resend; cf-admin has no Resend call path. See `RULESAd.md` §17.)* *Corrected 2026-09-19: because only 100 events are read, the "Monthly Usage" bar rendered as `{sent} / 9,000` can never exceed 100 and is not a monthly total.*

---

## Bug History — GraphQL Filter Field Names

> **Critical pattern:** Cloudflare GraphQL filter objects use **snake_case field names**, not camelCase. Using the wrong casing causes the filter to be silently ignored, and the query either returns no results or GraphQL returns an errors array (HTTP 200 with errors). Always check for errors after parsing the response body.

**Workers analytics bug:** originally used camelCase filter fields which were silently ignored. Fixed to snake_case datetime filter fields.

**D1 analytics bug:** originally missing the datetime filter entirely — could return all-time data or error. Fixed to include proper datetime scope.

Both providers now also check for GraphQL errors before attempting to read data.

---

## Required Configuration

### API token permissions

A Cloudflare API Token is required with the following permission scopes:

| Permission | Scope | Reason |
|-----------|-------|--------|
| Zone Analytics: Read | Target Zone | HTTP request/bandwidth/threat metrics |
| Workers Scripts: Read | Account | Worker invocation analytics |
| R2 Storage: Object Read | Account | R2 bucket object count & size |
| Queues: Read | Account | Queue consumers, backlog and DLQ metrics |
| Account Analytics: Read | Account | D1 analytics, read through the GraphQL analytics API |

*Corrected 2026-09-19: "Workers KV Storage: Read" was listed for "KV namespace
metadata". No provider calls a KV API — the only KV use on this path is the
telemetry cache, through the binding. The D1 analytics row said "Analytics Engine:
Read"; those figures come from the GraphQL analytics API, not an AE SQL query. The
exact scope name Cloudflare requires for that query has not been re-derived — treat
the last row as indicative.*

### Production secrets

All analytics-related secrets are deployed via Wrangler secret management: the
Cloudflare API token, Supabase keys, Sentry (`SENTRY_AUTH_TOKEN`,
`SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`) and `BREVO_API_KEY`.

---

## Architecture Decisions

### `_unconfigured` flag pattern

Every analytics provider returns a typed object with an optional `_unconfigured`
field. When the API token is missing or a fetch fails, this flag is set instead of
throwing, keeping the distinction between **zero** (real data, no activity) and
**unknown** (no credentials or unreachable endpoint) explicit in the type system.

The Overview's website figure and chart read it: an unconfigured zone shows a sentence, never zeros
(`websiteView` in `src/lib/overview/sections.ts`). *Until 2026-10-26* the old KPI deck did not
read the flag and fell back to invented values.

### Parallel provider settlement

All 8 providers run in parallel. A single provider failing (network error, 401,
wrong token scope) returns its typed fallback and the rest of the dashboard
continues unaffected.

### GraphQL error checking

After every Cloudflare GraphQL response, the code checks for errors before reading
data. Cloudflare returns HTTP 200 with an errors array when a query is malformed
or a filter field name is wrong — not a non-200 status. Skipping this check causes
silent data loss.

### One call, sections as data

The Overview asks one route, which answers each section as `{ ok: true, data }` or
`{ ok: false, message }`, so the island only draws and one slow source costs one card.

### No new dependencies

The 2026-10-26 redesign added none: its charts (a line, bars, a ring and day bars) are
hand-drawn SVG (`OverviewCharts.tsx`), the glass is CSS `backdrop-filter`, the counting numbers
are `requestAnimationFrame` (`motion.ts`), its icons are `lucide-preact`, and native `fetch` makes
its one call. No
third-party chart library — `uplot` is **not** in `package.json` and is not used.

---

## Known Limitations

1. **KV operation counts** — Cloudflare does not expose KV reads/writes via any REST or GraphQL API, so they are not shown rather than shown as permanently N/A.

2. **Supabase Auth API limitations** — we fetch `per_page=1000` to do localised counts for provider breakdown, MAU and recent signups. Above 1,000 users this would need pagination or the dedicated Analytics API.

3. **D1 Analytics lag** — Cloudflare's analytics ingest D1 data with roughly a 2-minute lag, so recent write counts are near-real-time, not real-time.

4. **Workers script name matching** — the analytics API returns every script on the account; the provider filters client-side to `WORKER_SCRIPTS`. Renaming a worker in the Cloudflare dashboard requires updating that list.

5. **Supabase Prometheus endpoint** — the privileged metrics endpoint is a non-public API in early/internal use. Supabase could change or restrict it without notice, so the string-parsing logic must fail safely.

6. **Website visitors are not shown.** The zone query sums requests per hour and has no unique-visitor count; a sum of hourly uniques would count a visitor once per hour, so the card shows requests instead.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-28 | **Scope-limited to the website card.** The Figures and chart rows' access column and the detailed-views paragraph against `SECTION_PAGE` and `sees.website` in `src/pages/api/dashboard/overview.ts` (now `denyAnalytics(user, 'traffic')`), `format.ts`'s card link and the removed `WidgetEdgeCompute`; `test/overview.test.ts` passes | The rest of the document; `last_verified` left as it was |
| 2026-10-26 | §0 rewritten for the glass page, against `src/pages/dashboard/index.astro`, `src/components/dashboard/overview/` (`Overview.tsx`, `OverviewCharts.tsx`, `format.ts`, `motion.ts`), `src/styles/pages/overview.css`, `src/lib/overview/sections.ts` and `src/lib/dal/OverviewRepository.ts`, with `test/overview.test.ts`; `bookings.created_at` and `email_audit_logs.created_at` read live through the Supabase connector (1 booking made in the last 30 days and 5 in the 30 before; emails on 25 of the last 30 days) | The page in a phone browser, the motion and both themes (the owner's test) |
| 2026-10-26 | §0 to §0.2 rewritten for the redesign, against `src/pages/dashboard/index.astro`, `src/components/dashboard/overview/`, `src/pages/api/dashboard/overview.ts`, `src/lib/overview/sections.ts` and `src/lib/dal/OverviewRepository.ts`, with `test/overview.test.ts`; the live tables it reads (`bookings`, `booking_pets`, `contact_messages`, `legal_requests`, `email_audit_logs` in Supabase; `booking_attempts`, `backup_runs`, `admin_audit_log`, `admin_booking_state` in D1) through the Supabase and Cloudflare connectors, read only; the Architecture Decisions and Known Limitations edits | The provider sections and token scopes (unchanged); the page in a phone browser (the owner's test) |
| 2026-10-17 | §0.1's values re-read in `DashboardController.tsx` (the `'100.0'` and `'1.2'` fallbacks, the `99.8% Delivery` literal), `ServiceStatusStrip.tsx` and `GscValidationWidget.tsx` (the literal SEO strings), the tab labels, `WORKER_SCRIPTS` (two scripts) in `cloudflare.ts`, the Sentry and Brevo windows in `external.ts`. All still as described | Token scopes; the D1 analytics lag; the screen in a phone browser |
| 2026-10-17 | §0's opening paragraph and Overview row for the System health card, against `src/pages/dashboard/index.astro`, `DashboardController.tsx` and `ServiceStatusStrip.tsx`, with `test/system-health.test.ts` and `test/system-health-board.test.ts`; §0.1's claim that its values are logged in `MAINTENANCE.md`, which was not true (now SH-8) | Everything else on the page; §0.1's values were not re-read |
| 2026-10-10 | The KV-cache steps and the provider-failure paragraph, against `src/lib/analytics/providers/index.ts`, `src/pages/api/dashboard/metrics.ts` and `DashboardController.tsx` (both removed 2026-10-26), with `test/analytics-cache.test.ts` (three stale-while-revalidate tests) | Everything else on the page; the live timing after deploy |
| 2026-10-04 | The polling and KV-cache paragraphs, against `DashboardController.tsx`, `src/lib/visible-poll.ts` and `src/lib/analytics/providers/index.ts`, with `test/visible-poll.test.ts` and `test/analytics-cache.test.ts` | Everything else on the page |
| 2026-09-19 | `DashboardController.tsx` (KPI fallbacks, 60 s poll, tab ids), `ServiceStatusStrip.tsx` (the static `seo` card), `GscValidationWidget.tsx` (the static badge), `src/pages/api/dashboard/metrics.ts`, `src/lib/analytics/providers/index.ts` (KV cache + stale copy + timestamp rewrite), `external.ts` (Sentry top-5 lifetime sum, Brevo 100-event window), `cloudflare.ts` (queue backlog/DLQ). §0.1 and §0.2 added; the v4.5 historical sections removed; provider, token-scope and `_unconfigured` claims corrected. | The exact Cloudflare token-scope name the GraphQL D1 query needs; the D1 analytics lag figure; the Supabase Prometheus endpoint's stability |
| 2026-09-14 | `DashboardController.tsx`, every file under `src/components/dashboard/widgets/`, `src/pages/dashboard/index.astro`, the provider layer (8 providers, `Promise.allSettled`, `_unconfigured`, snake-case GraphQL filters, `WORKER_SCRIPTS`), `wrangler.toml` crons, `package.json` (no `uplot`) | API-token permission scopes; D1 Analytics lag; Supabase Prometheus endpoint stability |

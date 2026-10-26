---
title: "Analytics — how the website and the platform are doing, from every source"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-10-26
verified_against: [code, infra]
owner: harshil
related_code:
- src/pages/dashboard/analytics/index.astro
- src/pages/dashboard/analytics/[part].astro
- src/pages/api/analytics/[part].ts
- src/components/dashboard/analytics/Analytics.tsx
- src/components/dashboard/analytics/AnalyticsBlocks.tsx
- src/components/dashboard/analytics/AnalyticsCharts.tsx
- src/components/dashboard/analytics/format.ts
- src/styles/pages/analytics.css
- src/lib/analytics/report/load.ts
- src/lib/analytics/report/parts.ts
- src/lib/analytics/report/email.ts
- src/lib/analytics/report/reliability.ts
- src/lib/analytics/report/queries.ts
- src/lib/analytics/report/sources.ts
- src/lib/analytics/report/range.ts
- src/lib/analytics/report/names.ts
- src/lib/analytics/report/csv.ts
- src/lib/analytics/report/types.ts
- src/lib/dal/AnalyticsRepository.ts
- src/lib/auth/surface-guards.ts
- src/lib/gsc/client.ts
- src/lib/control-plane/sentry-admin.ts
- migrations/0077_analytics_page.sql
- migrations/0078_analytics_email_reliability.sql
- test/analytics.test.ts
- test/analytics-round2.test.ts
related_docs:
- DASHBOARD.md
- SYSTEM-HEALTH.md
- SEARCH-CONSOLE-SYNC.md
- GSC-AUTO-HEALING-AND-VALIDATION-ENGINE.md
- ../architecture/PERMISSIONS-SYSTEM.md
- ../security/SECURITY.md
- ../security/RoPA.md
- ../operations/OPERATIONS.md
- ../specs/2026-10-26-analytics-page.md
- ../specs/2026-10-26-analytics-colours-and-layout.md
- ../records/reports/2026-10-26-analytics-page.md
- ../records/reports/2026-10-26-analytics-round-2.md
tags: [feature, analytics, posthog, cloudflare, search-console, sentry, supabase, d1]
---

# Analytics — how the website and the platform are doing, from every source

> **TL;DR (non-technical):** One page in the sidebar, **Analytics**, that reads what the
> platform's services already collect (PostHog, Cloudflare, Google Search Console, PageSpeed,
> Sentry, System health and the hotel's own booking and email records) and turns it into
> figures, charts and plain sentences about what stands out. It has a Summary and seven parts in
> a sideways row: Visitors, Booking journey, Google search, Speed and experience, Website
> traffic, Email and Reliability. Each part is its own permission, as are Download and Refresh,
> and each has its own colours. Every number is read from a live source; when a source does not
> answer, the page asks it again by itself, and if it still cannot be read its cards say so in a
> sentence instead of showing a guess.

Asked for by Harshil on 2026-10-26: "we have ton of data auto collected but no way to process
it, or get an insight into it". The second round the same day added Email and Reliability, more
from every source, the per-part colours, a packed layout without blank space and the automatic
retry. The look is in the [design spec](../specs/2026-10-26-analytics-page.md) and its
[second round](../specs/2026-10-26-analytics-colours-and-layout.md); what shipped and how it was
checked is in the change records of the first (private)
and the second round (private).

## 1. The parts

The page lives at `/dashboard/analytics` (the Summary) and `/dashboard/analytics/{part}`. The
row of parts is `RegistryTabs`, so a person sees only the parts they may open. Every part has
a period of **7, 30 or 90 days** (30 by default, remembered in the browser), compares each
figure with the same number of days just before, and counts days and hours in the viewer's own
time zone (the hotel has no time-zone setting).

| Part | Path | What it shows | Read from |
|---|---|---|---|
| **Summary** | `/dashboard/analytics` | Each allowed part's lead figure with a sparkline linking to it, the day-by-day lines, what stands out (the two strongest sentences of every part, Visitors first, each in its part's colour), and which sources answered | the parts below |
| **Visitors** | `/visitors` | Visitors, page views, visits, pages per visit, the share who left after one page, time on the website; where they are (countries, states, cities), what they use (devices, browsers, systems, languages), busiest weekday and hour, where they come from (channels, websites, campaign tags, AI assistants), first and last pages, cookie choices; how far people read each page (how far down half of them scrolled and how long half stayed), the links they tap (WhatsApp, phone, maps, social and the website's own pages), new and returning visitors, and how long visits last | PostHog (`events`: `$pageview`, `$pageleave`, `$autocapture`; `sessions`), Supabase `consent_records` |
| **Booking journey** | `/bookings` | The booking form step by step (visit, booking page, form started, pet, owner, sent) with the biggest drop named; the share who finished; bookings made, pets, nights per stay, days booked ahead; what people book (service, pets, transport) and when (ahead, length, arrival day); every booking send (went through, refused by the checks, failed); inquiries by service; **how people reach out**: the booking form beside taps on WhatsApp, Google Maps, social media, phone and email, counted in people | PostHog funnel and link taps, Supabase `bookings` and `booking_pets`, `contact_messages`, D1 `booking_attempts` |
| **Google search** | `/search` | Clicks, times shown, click rate, average position, by day; top searches, top pages, who clicks (device, country); **where the site ranks** (times shown at positions 1 to 3, 4 to 10, page 2 and further); which pages are in Google's index and when Google last read them | Search Console search analytics (250 searches for the ranks, 25 listed), D1 `gsc_index_log` (`url_inspect`) |
| **Speed and experience** | `/experience` | Core Web Vitals from real visitors at 3 in 4 visits, each as a dial against Google's good and poor limits, split good / needs work / poor; speed by page; taps that did nothing and quick repeated taps; errors in browsers; Google's PageSpeed score per page | PostHog (`$web_vitals`, `$dead_click`, `$rageclick`, `$dead_swipe`, `$exception`), D1 `gsc_index_log` (`performance_check`) |
| **Website traffic** | `/traffic` | Everything Cloudflare served: requests, visitors by address, page views, the share served from cache, data sent, threats stopped, **data sent from the cache and the share over HTTPS**, by day; each day's requests from the cache or the server; how the website answered (2xx to 5xx); who was asking (people, search engines, monitors, known abusers); HTTP and TLS versions; where threats came from; countries, kinds of file, browsers, pages and devices | Cloudflare GraphQL Analytics (`httpRequests1dGroups` with its `clientHTTPVersionMap`, `clientSSLMap`, `ipClassMap` and `countryMap`; `httpRequestsAdaptiveGroups`) |
| **Email** | `/email` | Emails sent, the share that arrived, the share opened (of those that arrived), bounced or refused, how fast they arrived and how soon they were read, by day; each kind of email and how it did; how they ended; who sent them (the website or the portal); arrival times in bands; when emails are opened, by weekday and hour | Supabase `email_audit_logs` (the send ledger cf-email-consumer writes) |
| **Reliability** | `/reliability` | Health checks all clear each day, errors Sentry recorded, open issues, requests the platform's Workers handled, their errors and their CPU time per request against the free plan's 10 ms; what Sentry did with errors; where errors happen; each Worker; requests and errors each day | D1 `health-state` (System health's day record), Sentry (error counts per day and open issues), Cloudflare GraphQL Analytics (`workersInvocationsAdaptive`, the platform's own Workers only) |

**What the numbers mean.** PostHog loads on the public website only after a visitor allows
analytics cookies, so Visitors, the booking funnel and the speed readings count those visitors
only; the Visitors part says how many declined. Cloudflare counts every request at the edge,
people, search engines and bots alike, which is why Website traffic is larger. Cloudflare keeps
its detailed data (pages and devices, and each Worker's counts) 30 days on the free plan, so on
a 90-day choice those cards cover the last 30 days and the part says so; if Cloudflare refuses
the period before, the daily totals show this period without a comparison. Sentry keeps its
counts 90 days, so on 90 days Reliability's errors have no period before. An email counts as
opened at its first `unique_opened` report; the provider's proxy opens (a mail app opening it to
check for images) are not counted. Reliability lists only the platform's own Workers
(`OWN_WORKERS`), never the other Workers in the account.

**Sentences.** Each part writes its own "what stands out" lines from the numbers it read (a
figure that rose or fell, the busiest hour, the step where the form loses most people, more
people reaching out on WhatsApp than through the form, a page people leave before reading, a
search shown often but rarely clicked, a page where taps do nothing, a bounced email, a Worker
near its CPU limit). Each has a weight; a part shows its own, the Summary the two heaviest of
each part the viewer may open, in the order of the parts.

## 2. How a part is read

`GET /api/analytics/{part}?range=7d|30d|90d&tz=<zone>` answers one part as JSON, built by
`loadPart` (`src/lib/analytics/report/load.ts`). `summary` loads every part the viewer may open
and condenses them (`summaryView`).

- **Each source is read side by side**, and a failure costs only its own cards: the reader's
  error becomes a sentence (`SourceError`), and the part still answers with whatever else was
  read. A missing key or refused permission is marked as a setup step, so the page can say what
  to give the key.
- **Asked again when a source does not answer.** PostHog's question is asked a second and last
  time 2.5 seconds after no answer, a 429 or a 5xx, never after a refusal (`hogql`,
  `RETRY_AFTER_MS`). The page itself, when a part comes back with a source that failed for a
  reason a retry can fix, says so in a line under the heading and reads the part again with
  `retry=1` after 8 seconds, at most twice (`RETRY_MS`, `RETRIES` in `Analytics.tsx`). Pressing
  Try again starts the count over.
- **Kept ten minutes.** Each answer is stored in the Worker's edge cache (the Cache API,
  `caches.default`, no binding) for 600 seconds, keyed by part, range and time zone
  (`https://analytics.cache.invalid/v2/…`); one with a failed source is kept only 60 seconds so
  the next look retries. The copy holds counts, page addresses and link addresses only.
  `fresh=1` (the Refresh button) skips it; `retry=1` skips only a kept answer in which a source
  failed for a reason a retry can fix, so it needs no permission of its own.
- **Download.** `?format=csv` answers the same part as a spreadsheet file: header rows, the
  figures with the period before, the sentences, the day-by-day lines and every card (rings with
  their shares, columns with one row per label, reading with the scroll share, time and views).
  A cell that starts with `=`, `+`, `-` or `@` is prefixed with `'` so a spreadsheet does not
  run it.
- **Subrequests.** Google search makes 8 calls, the Summary at most 32 when PostHog has to be
  asked twice for each of its four questions, inside the free plan's 50 per request; the runtime
  queues past six at once.
- **Nothing a person typed reaches a query.** The range is one of three values, the time zone is
  checked by `safeTimeZone` (no quote or space) and times are built from dates.

The HogQL queries are in `queries.ts`: each part is one call, a `UNION ALL` of small breakdowns
with the same six columns, every number cast to `Float`. The booking funnel uses PostHog's
`windowFunnel` over a week; a returning visitor is one seen in the 365 days before the period
(`RETURN_LOOKBACK_DAYS`). Supabase reads use the service-role client with a 4-second timeout and
select no names, emails or phone numbers; the email ledger is read for its source, kind, status,
time and delivery events, of which only the first delivered and first opened times are kept (the
provider's reason is dropped in the Worker, at most 2,000 rows). A booking the team later
deleted or cancelled in the portal (`hiddenBookingIds`) still counts on the day it was made, and
the figure says how many were later cancelled.

## 3. Permissions

Every path is a row in `admin_pages` (migrations `0077` and `0078`), so the Access page can give
or refuse each one per person. The page row existed since before `0067` as an inactive
placeholder; `0077` switched it on and moved it to the sidebar's daily group, and `0078` added
Email and Reliability.

| Key | Gives | Default |
|---|---|---|
| `/dashboard/analytics` | the page and its Summary | Manager (`admin`) and above |
| `/dashboard/analytics/visitors` … `/reliability` | each of the seven parts, and its place in the row and on the Summary | Manager and above |
| `/dashboard/analytics#export` | the Download button and `?format=csv` | Manager and above |
| `/dashboard/analytics#refresh` | the Refresh button and `?fresh=1` | Manager and above |

The pages and the route check the same keys through `denyAnalytics` in
`src/lib/auth/surface-guards.ts` (`placRequireGrant`, so an unknown key fails closed); the
route is mapped to `/dashboard/analytics` in `API_PAGE_MAPPING`. The Owner and Developer roles
pass every check, as everywhere. [`PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md)
owns the model.

## 4. What each source needs

No new key, variable, table or service: the page uses the keys the portal already holds
([`OPERATIONS.md`](../operations/OPERATIONS.md) §1 is their registry).

| Source | Key | Permission it needs | If it is missing |
|---|---|---|---|
| PostHog | `POSTHOG_PERSONAL_API_KEY`, project `POSTHOG_PROJECT_ID` or `PUBLIC_POSTHOG_PROJECT_ID` | **Query: Read** on the project (the control-plane reads use other scopes, so this one is not proven by them) | "PostHog refused the portal's key: give the key the Query: Read permission" |
| Cloudflare, the zone | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` | **Zone Analytics: Read** (the Overview's traffic card already uses it) | "Cloudflare refused the portal's token: it needs Zone Analytics: Read" |
| Cloudflare, the account | `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID` | **Account Analytics: Read** (System health's "Errors and CPU limits" check asks the same dataset every hour) | "Cloudflare refused the portal's token: it needs Account Analytics: Read" |
| Search Console | `GSC_SERVICE_ACCOUNT_JSON` | the service account as a user of the property (the indexing job already uses it for URL inspection) | "Search Console refused the portal's service account: add it as a user of the property" |
| Sentry | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG` | `org:read` (`getSentryUsage` and `getOrgIssues`, which the control plane and System health already call) | "Sentry refused the portal's token: it needs org:read" |
| Supabase, D1 | the bindings | none beyond what the portal has | the card says it could not be read |

Whether PostHog's Query: Read, Search Console's search analytics and some of the newer
Cloudflare and Sentry questions answer the portal's keys could not be checked from a development
session; `MAINTENANCE.md` (private) AN-1 to AN-6 track them.

## 5. Tests

`test/analytics.test.ts`: the window, the queries (no typed text, casts, the funnel), the names,
every part builder against real-shaped rows, the Summary, the CSV (formula guard), the format
helpers, the guards and route mapping, the D1 repository, and the route (401, 404, 403 per part,
the Download and Refresh keys, the cache, the Summary limited to allowed parts).
`test/analytics-round2.test.ts`: the new queries, the round-2 cards of Visitors, Booking
journey, Google search and Website traffic, the Email and Reliability builders (only the
platform's own Workers, failures isolated), the Summary's order, the CSV of the new card kinds,
the colour folding and card widths, PostHog's retry (a 503 then an answer, a 403 not retried, no
answer twice), the email ledger read (the reason dropped, the columns asked for), System health's
day record, and the route (the two new keys, and a retry after a source came back).
`test/action-keys-enforced.test.ts` checks that `#export` and `#refresh` are enforced.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-26 | Written with the code: every section against the files in `related_code`; the PostHog events and properties against the live project (PostHog connector), the D1 `gsc_index_log`, `booking_attempts` and `admin_pages` rows and the Supabase `bookings`, `booking_pets`, `contact_messages` and `consent_records` columns against the live databases (Cloudflare and Supabase connectors); `test/analytics.test.ts` passes | The portal's PostHog key's Query: Read scope, the Cloudflare `httpRequests1dGroups` answer for this zone and Search Console's search analytics for the service account: none can be called with the portal's own keys from here |
| 2026-10-26 | Round 2 against the code: §1's Visitors, Booking journey, Google search, Website traffic, Email and Reliability rows, §2's retry, cache key and subrequests, §3's keys after `0078`, §4's account and Sentry rows. Live: `$pageleave` with the page, scroll and time properties and `$autocapture` link taps exist in the last 30 days (124 and 80, PostHog connector); `email_audit_logs` rows carry `delivery_events` arrays of `event`, `timestamp` and `reason` only, with `delivered`, `unique_opened`, `unique_proxy_open` and bounce events (Supabase connector); the `health-state` row and its `worker_errors` check passing every day since 2026-10-17 (D1 connector); `test/analytics.test.ts` and `test/analytics-round2.test.ts` pass (56) | The `date` dimension and CPU quantiles of `workersInvocationsAdaptive`, Sentry's daily error counts over 14, 60 and 90 days, and `httpRequests1dGroups`' newer fields with the portal's keys (MAINTENANCE AN-4 to AN-6); the page in a phone browser |

---
title: "Analytics — how the website is doing, from every source"
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
- src/components/dashboard/analytics/format.ts
- src/styles/pages/analytics.css
- src/lib/analytics/report/load.ts
- src/lib/analytics/report/parts.ts
- src/lib/analytics/report/queries.ts
- src/lib/analytics/report/sources.ts
- src/lib/analytics/report/range.ts
- src/lib/analytics/report/names.ts
- src/lib/analytics/report/csv.ts
- src/lib/analytics/report/types.ts
- src/lib/dal/AnalyticsRepository.ts
- src/lib/auth/surface-guards.ts
- src/lib/gsc/client.ts
- migrations/0077_analytics_page.sql
- test/analytics.test.ts
related_docs:
- DASHBOARD.md
- SEARCH-CONSOLE-SYNC.md
- GSC-AUTO-HEALING-AND-VALIDATION-ENGINE.md
- ../architecture/PERMISSIONS-SYSTEM.md
- ../security/SECURITY.md
- ../security/RoPA.md
- ../operations/OPERATIONS.md
- ../specs/2026-10-26-analytics-page.md
- ../records/reports/2026-10-26-analytics-page.md
tags: [feature, analytics, posthog, cloudflare, search-console, supabase, d1]
---

# Analytics — how the website is doing, from every source

> **TL;DR (non-technical):** One page in the sidebar, **Analytics**, that reads what the
> platform's services already collect about the website (PostHog, Cloudflare, Google Search
> Console, PageSpeed and the hotel's own booking records) and turns it into figures, charts and
> plain sentences about what stands out. It has a Summary and five parts in a sideways row:
> Visitors, Booking journey, Google search, Speed and experience, and Website traffic. Each part
> is its own permission, as are Download and Refresh. Every number is read from a live source;
> when a source cannot be read, its cards say so in a sentence instead of showing a guess.

Asked for by Harshil on 2026-10-26: "we have ton of data auto collected but no way to process
it, or get an insight into it". The look is in the
[design spec](../specs/2026-10-26-analytics-page.md); what shipped and how it was checked is in
the change record (private).

## 1. The parts

The page lives at `/dashboard/analytics` (the Summary) and `/dashboard/analytics/{part}`. The
row of parts is `RegistryTabs`, so a person sees only the parts they may open. Every part has
a period of **7, 30 or 90 days** (30 by default, remembered in the browser), compares each
figure with the same number of days just before, and counts days and hours in the viewer's own
time zone (the hotel has no time-zone setting).

| Part | Path | What it shows | Read from |
|---|---|---|---|
| **Summary** | `/dashboard/analytics` | Each allowed part's lead figure with a sparkline linking to it, the day-by-day lines, the six strongest sentences across the parts, and which sources answered | the parts below |
| **Visitors** | `/visitors` | Visitors, page views, visits, pages per visit, the share who left after one page, time on the website; where they are (countries, states, cities), what they use (devices, browsers, systems, languages), busiest weekday and hour, where they come from (channels, websites, campaign tags, AI assistants), first and last pages, cookie choices | PostHog (`events`, `sessions`), Supabase `consent_records` |
| **Booking journey** | `/bookings` | The booking form step by step (visit, booking page, form started, pet, owner, sent) with the biggest drop named; the share who finished; bookings made, pets, nights per stay, days booked ahead; what people book (service, pets, transport) and when (ahead, length, arrival day); every booking send (went through, refused by the checks, failed); inquiries by service | PostHog funnel, Supabase `bookings` and `booking_pets`, `contact_messages`, D1 `booking_attempts` |
| **Google search** | `/search` | Clicks, times shown, click rate, average position, by day; top searches, top pages, who clicks (device, country); which pages are in Google's index and when Google last read them | Search Console search analytics, D1 `gsc_index_log` (`url_inspect`) |
| **Speed and experience** | `/experience` | Core Web Vitals from real visitors (main content shown, reacts to taps, layout stays still, first thing shown) at 3 in 4 visits, split good / needs work / poor; speed by page; taps that did nothing and quick repeated taps; errors in browsers; Google's PageSpeed score per page | PostHog (`$web_vitals`, `$dead_click`, `$rageclick`, `$dead_swipe`, `$exception`), D1 `gsc_index_log` (`performance_check`) |
| **Website traffic** | `/traffic` | Everything Cloudflare served: requests, visitors by address, page views, the share served from cache, data sent, threats stopped, by day; countries, answers (status codes), kinds of file, browsers, pages and devices | Cloudflare GraphQL Analytics (`httpRequests1dGroups`, `httpRequestsAdaptiveGroups`) |

**What the numbers mean.** PostHog loads on the public website only after a visitor allows
analytics cookies, so Visitors, the booking funnel and the speed readings count those visitors
only; the Visitors part says how many declined. Cloudflare counts every request at the edge,
people, search engines and bots alike, which is why Website traffic is larger. Cloudflare keeps
its detailed data (pages and devices) 30 days on the free plan, so on a 90-day choice those two
lists cover the last 30 days and the part says so; if Cloudflare refuses the period before, the
daily totals show this period without a comparison.

**Sentences.** Each part writes its own "what stands out" lines from the numbers it read (a
figure that rose or fell, the busiest hour, the step where the form loses most people, a search
shown often but rarely clicked, a page where taps do nothing, failed booking sends). Each has a
weight; a part shows its own, the Summary the six heaviest across the parts the viewer may open.

## 2. How a part is read

`GET /api/analytics/{part}?range=7d|30d|90d&tz=<zone>` answers one part as JSON, built by
`loadPart` (`src/lib/analytics/report/load.ts`). `summary` loads every part the viewer may open
and condenses them (`summaryView`).

- **Each source is read side by side**, and a failure costs only its own cards: the reader's
  error becomes a sentence (`SourceError`), and the part still answers with whatever else was
  read. A missing key or refused permission is marked as a setup step, so the page can say what
  to give the key.
- **Kept ten minutes.** Each answer is stored in the Worker's edge cache (the Cache API,
  `caches.default`, no binding) for 600 seconds, keyed by part, range and time zone; one with a
  failed source is kept only 60 seconds so the next look retries. The copy holds counts and page
  addresses only. `fresh=1` (the Refresh button) skips it.
- **Download.** `?format=csv` answers the same part as a spreadsheet file: header rows, the
  figures with the period before, the sentences, the day-by-day lines and every card. A cell that
  starts with `=`, `+`, `-` or `@` is prefixed with `'` so a spreadsheet does not run it.
- **Subrequests.** Google search makes 7 calls, the Summary at most 22, inside the free plan's
  50 per request; the runtime queues past six at once.
- **Nothing a person typed reaches a query.** The range is one of three values, the time zone is
  checked by `safeTimeZone` (no quote or space) and times are built from dates.

The HogQL queries are in `queries.ts`: each part is one call, a `UNION ALL` of small breakdowns
with the same six columns, every number cast to `Float`. The booking funnel uses PostHog's
`windowFunnel` over a week. Supabase reads use the service-role client with a 4-second timeout
and select no names, emails or phone numbers. A booking the team later deleted or cancelled in
the portal (`hiddenBookingIds`) still counts on the day it was made, and the figure says how
many were later cancelled.

## 3. Permissions

Every path is a row in `admin_pages` (migration `0077`), so the Access page can give or refuse
each one per person. The page row existed since before `0067` as an inactive placeholder; `0077`
switched it on and moved it to the sidebar's daily group.

| Key | Gives | Default |
|---|---|---|
| `/dashboard/analytics` | the page and its Summary | Manager (`admin`) and above |
| `/dashboard/analytics/visitors` … `/traffic` | each part, and its place in the row and on the Summary | Manager and above |
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
| Cloudflare | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` | **Zone Analytics: Read** (the Overview's traffic card already uses it) | "Cloudflare refused the portal's token" |
| Search Console | `GSC_SERVICE_ACCOUNT_JSON` | the service account as a user of the property (the indexing job already uses it for URL inspection) | "Search Console refused the portal's service account: add it as a user of the property" |
| Supabase, D1 | the bindings | none beyond what the portal has | the card says it could not be read |

Whether PostHog's Query: Read and Search Console's search analytics answer the portal's keys
could not be checked from a development session; `MAINTENANCE.md` (private) tracks it.

## 5. Tests

`test/analytics.test.ts`: the window, the queries (no typed text, casts, the funnel), the names,
every part builder against real-shaped rows, the Summary, the CSV (formula guard), the format
helpers, the guards and route mapping, the D1 repository, and the route (401, 404, 403 per part,
the Download and Refresh keys, the cache, the Summary limited to allowed parts).
`test/action-keys-enforced.test.ts` checks that `#export` and `#refresh` are enforced.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-26 | Written with the code: every section against the files in `related_code`; the PostHog events and properties against the live project (PostHog connector), the D1 `gsc_index_log`, `booking_attempts` and `admin_pages` rows and the Supabase `bookings`, `booking_pets`, `contact_messages` and `consent_records` columns against the live databases (Cloudflare and Supabase connectors); `test/analytics.test.ts` passes | The portal's PostHog key's Query: Read scope, the Cloudflare `httpRequests1dGroups` answer for this zone and Search Console's search analytics for the service account: none can be called with the portal's own keys from here |

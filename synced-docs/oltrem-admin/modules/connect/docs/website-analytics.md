---
title: "@oltrem/connect: website analytics"
status: living
owner: vendor
last_verified: 2026-11-27
sources: [modules/connect/src/web.ts, oneclick.ts, module.ts, types.ts]
---

# @oltrem/connect: website analytics

> Part of [the @oltrem/connect README](../README.md).

## Website analytics

Each connection is a providers instance of kind `analytics` (`@oltrem/providers`,
`src/definitions/analytics.ts`): its key sealed by the registry, its address built only from fields
pinned to the app's own shape. Email's pages neither list nor count one. `src/web.ts` reads each
app into one `WebReport`: visitors, visits, page views, bounce share, average visit, the window
before, each day, top pages, sources, countries, devices, browsers, the app's events and people on
the site now. Since 2026-11-27 a report may also hold events, goals, errors, stuck taps and
recordings among its figures; entry and exit pages, regions, cities, systems, campaigns and goals
among its lists; visits by weekday and hour on the company's clock (`hours`, `zone`); kinds of
source with their bounce and visit length (`channels`); page speed per device at 3 visits in 4
(`speed`); pages where visitors got stuck (`trouble`); right now (`now`); and the app's own page
for each part (`links`). PostHog adds the five recordings worth watching (`recordings`: most
errors, then most clicks) and the five errors met most (`issues`), each opening itself in PostHog,
and a funnel (`funnel`) from two to five steps picked on the Reports page, and the window before
day for day (`previousDaily`, the chart's dashed line). A figure an app does not keep is left out,
never estimated.

**PostHog** is asked four HogQL questions, two at a time (it answers three at once per project):
the figures (which must answer), where visitors came from, where they are and what they use with
the hours, and speed with stuck taps, right now, recordings, errors and the funnel. Right now is
also asked on its own, one question (`web.live`), for an app's full view every 30 seconds; a
refusal there answers null and the page keeps the last one. Its recordings are two more questions
side by side (`web.recordings`): the latest `RECORDINGS_MAX` (50) visits of the window from
`session_replay_events`, each joined with its events (pages, stuck taps, device, country, the
funnel's first and last step), narrowed by errors, stuck taps, a minute active, a phone or a funnel
left unfinished; and one visit's first 200 events (`VISIT_ID` checks its id) told as steps, a
stuck or repeated tap folded into the tap it marks. A funnel step is
a page path (a trailing `*` takes every page under it) or an event name (`WEB_STEP`, no quote, so
it is safe in the question), kept on the connection as the providers option `steps` and counted
with `windowFunnel` (each step within a day of the one before). A question it does not answer is named in
`missing` and the rest of the report stands. A key's check asks the figures alone. The company's
time zone (Settings) is written into the hours question only when the runtime knows it (`clockOf`),
else UTC.

**Cloudflare's domain** (`src/edge.ts`, 2026-11-27): beside Web Analytics' site tag, or alone,
a Cloudflare connection reads its website's domain (`zone`, else the token's only domain, found
with `GET /zones`; a token made for Web Analytics alone is left quiet). `edge` holds every request
Cloudflare answered, people and bots alike: requests, data, the cache's share, threats, HTTPS,
distinct visitors, each against the window before, and each day (`httpRequests1dGroups`, a year
kept), status codes, countries with threats, content types, HTTP and TLS versions; then, over the
last 30 days at most (`httpRequestsAdaptiveGroups`), subdomains, pages, how the cache answered and
the pages that failed. Its security over the same days (`edgeSecurityQuery`): what each
protection did (`securityAction` and `securitySource`, allowed and logged requests left out), the
pages and countries it acted on most, verified bots by kind, and the latest 10 events
(`firewallEventsAdaptive`) with their rule; `ipClassMap` says what Cloudflare knows of the
addresses. Over the same days, its DNS lookups (`edgeMoreQuery`: all, by name, kind of record and
answer) and the mail Email Routing handled (by what happened, and SPF, DKIM and DMARC passes); and
the account's Turnstile checks on the domain and its subdomains over the last week at most
(`turnstileQuery`, the free plan's widest span; left quiet when the token lacks Account Analytics
Read). No visitor's address or browser string is asked for. The domain alone fills the board's
figures too (distinct visitors, HTML pages), and the board's "In plain words" gains the domain's
sentences (`edgeReading`). Six calls: the zone, its year question, then its detail, its security,
DNS and mail, and Turnstile side by side.

**The other six apps** fill the same parts where their APIs allow (the table below). A report's
calls are shared: `WEB_CALLS` (40 of the 50 a free-plan request may make) split evenly between the
apps connected (`how.calls`). Each app asks its first answer, then its other parts in order of
worth (channels, the hours, where visits start, right now, regions, systems, campaigns, where
visits end, cities) while its share lasts, so four apps get fewer parts than one. A part the app's
version does not know (400, 404) is left out quietly; any other failure is named in `missing`.
Hours an app keeps on its own clock (Plausible, Google Analytics, Fathom) carry no `zone`, and the
page says they are on the clock set in the app. Each part opens the app's own report where it has
one (`links`, `linksOf` in `web.ts`).

| App | Asked through | Other parts | Not given |
|---|---|---|---|
| PostHog | Four HogQL questions, `POST /api/projects/<id>/query/` (Query Read key) | All of them, with recordings, errors and the funnel | Goals (its events stand in) |
| Plausible | Stats API v2, `POST /api/v2/query`, 10 calls, then one per part | Channels, hours (site's clock), entry and exit pages, right now, regions, cities, systems, campaigns | Speed, stuck taps, minutes |
| Umami | `stats`, `pageviews`, `metrics`, `active`, then `metrics/expanded`, `sessions/weekly` (Cloud under `api.umami.is/v1`; older servers read too) | Channels, hours (company clock), entry and exit pages, right now with minutes, regions, cities, systems, campaigns | Speed, stuck taps |
| Cloudflare Web Analytics | GraphQL `rumPageloadEventsAdaptiveGroups`, then `rumWebVitalsEventsAdaptiveGroups` (Account Analytics Read); the domain's `httpRequests1dGroups`, `httpRequestsAdaptiveGroups`, `firewallEventsAdaptive`, `dnsAnalyticsAdaptiveGroups` and `emailRoutingAdaptiveGroups` (Zone Read, Zone Analytics Read); `turnstileAdaptiveGroups` | Hours (company clock), systems, speed (microseconds), right now with minutes, the domain's part (`edge`) with its security, bots, DNS, routed mail and Turnstile | Visitors (from Web Analytics), bounce, average visit, events, channels, places below country |
| Google Analytics 4 | Data API `batchRunReports` twice and `runRealtimeReport`, then two batches and two realtime reports, with a token for the service account's JSON key signed in the Worker (`analytics.readonly`; the account a Viewer) | Channels, hours (property's clock), landing pages, goals (`keyEvents`), regions, cities, systems, campaigns, right now with minutes | Exit pages, speed; its built-in events and `(not set)` left out |
| Matomo | One `API.getBulkRequest` POST with all reports, the token in the body; a part switched off leaves only itself out | Channels, entry and exit pages, goals, regions, cities, systems, campaigns, all in the same request | Visitors over a range unless turned on, hours, speed, right now |
| Fathom | `/aggregations` and `/current_visitors?detailed=true`, nine calls in turns of `FATHOM_AT_ONCE` (5), then one per part | Hours over 7 days or less (site's clock), entry and exit pages, right now, regions, cities, systems, campaigns | Visits apart from visitors, events, channels, speed |

An answer past `ANSWER_MAX` (2 MB) is refused unread. A report is kept in the Cache API, keyed by
connection, window, clock and the key's last change; nothing goes to KV. It is fresh for
`WEB_CACHE_SECONDS` (10 minutes) and kept `WEB_KEEP_SECONDS` (a day) as the fallback: past its ten
minutes, a caller that hands in `waitUntil` gets it at once while a new one is read behind it; when
the app does not answer, the copy is answered with `kept` (why), which the page says. A refusal
with no copy is said in plain words, with the connection's page as the fix when a key fixes it.
`connect.web(env, tenantId, days, how)` (`WEB_DAYS`: 7, 30, 90; `how`: the company's `zone` and
`waitUntil`; the module adds each app's `calls`) answers at most `WEB_MAX` (4) connections for the Analytics page.
`connect.webApps(env, tenantId)` lists them, each with its logo (`mark`);
`connect.webApp(env, tenantId, id, days, how)` answers one of them with every call of the request
(`WEB_CALLS`), its kind (`service`) and the apps to move between, for its full view on Reports;
`connect.webLive(env, tenantId, id)` its right now and `connect.webRecordings(env, tenantId, id, ask)`
its recordings (PostHog only; a refusal answers `{ok: false}` with the fix), and
`connect.webReplay(env, tenantId, id, visit, run?)` one recording for the player: without `run`
its blocks (`web.replayBlocks`: PostHog's `snapshots?blob_v2=true`, at most `REPLAY_BLOCKS`, 500),
with `run` (`from`, `to`, at most `REPLAY_RUN`, 20, blocks) PostHog's answer itself (`web.replayRun`,
`REPLAY_TIMEOUT_MS`, 25 s), which the route streams on. It needs Session recording Read (a key) or
`session_recording:read` (a sign-in); a refusal names that fix. `connect.webList(env, tenantId, id, {days, of})`
(`web.list`, 2026-11-27) is one HogQL question for `errors` (`$exception` by issue, `LIST_MAX` 50) or
`events` (each event in these days and the same days before, `EVENTS_MAX` 100), two side by side for
`visitors` (the latest 50 by person, then everyone and those first seen before); it asks for no name,
address, email or id but the latest visit's. For Cloudflare (2026-11-28) it is `security`
(`edgeEventsQuery`: the latest 100 events, counts by action and host from the domain's requests, as
the free plan keeps no grouped security events) or `workers` (`workersQuery`: each Worker, these days
beside the days before; needs the account ID and Account Analytics Read), 30 days at most;
`LISTS_OF` says which lists each kind keeps. All answer null for an id that
is not one of the company's apps. The routes mount only with `registry`.

| Route (`/api/connect`) | |
|---|---|
| `GET /analytics` | The apps, fields, steps, `signIn` where set up, and connections with their last check; fields a sign-in fills never listed |
| `POST /analytics` | Connect one (`definitionId`, `fields`, `label`), then a first check; the same site twice is `KIT-E-0422`; a token, refresh token or client typed in is refused |
| `GET /analytics/:id` | Its fields that are no secret and its last check |
| `GET /analytics/:id/report?days=` | Its report (7 by default), a kept one answered at once past its ten minutes |
| `POST /analytics/:id/credential` | A new key or field (left out keeps what is saved), checked at once; a signed-in connection's site or region changes only with a key (`KIT-E-0422`) |
| `POST /analytics/:id/check` | The last day; again within 30 s, the last answer |
| `POST /analytics/:id/steps` | PostHog's funnel: `steps`, two to five, or none to take it away; another app or one step is `KIT-E-0422` |
| `DELETE /analytics/:id` | The connection and its sealed key; the app is not touched |
| `POST /analytics/signin` | After signing in: `held` and `site`; saves (new, again, or that site's) and checks; answers `{id, again, check}` |

`GET /links` also answers `analytics` (or `null` without the permission) in one D1 batch, so the
Apps page stays inside its 10 queries. Home's Needs you (a module part) lists failing
connections, "PostHog stopped answering", for `connect.analytics.manage`. The registry audits
`providers.create`, `.probe`, `.credential`, `.remove`.

## Signing in with PostHog or Google Analytics

Through the same relay (entries `posthog`, `google-analytics`), the key folded under "Or connect
with a key". PostHog needs no app registered (its client id is the relay's `/client/posthog`), so
the portal renews itself; Google reuses the Vendor's app with offline access, renewed through the
relay's `/renew/google-analytics`, which adds the secret.

1. **Continue with <app>** posts `/connect/start`; the person allows read-only access.
2. **The sites.** The portal checks the tokens (a lifetime past a day, such as the 7 days PostHog
   gives an app like this one, is kept as a day and renewed then), then reads PostHog in the
   region that issued the token (`region`, else US then EU; only a 401 tries the other) by what the
   person allowed, as PostHog's scoping requires: chosen projects each by its own address
   (`/api/projects/<id>/`, a list is refused for them), a whole organization by its list
   (`/api/organizations/<id>/projects/`), everything by `/api/projects/`; or Google's GA4
   properties (`accountSummaries`): at most `SITES_MAX` (12), names cut to 48. How a trip ended
   (`?trip=`) is said once: the frame drops it from the address, so a reload never repeats it.
3. **Pick one.** Tokens and sites wait in a sealed 10-minute row (`HELD_ROW`); Connect posts
   `/analytics/signin`, which opens it on the server, so no token reaches the page.
4. **Saved** as a new connection, the one signed in again, or that site's, its tokens replacing a
   key (`setCredential` with `replace`); then a first check.

A renewal happens just before a read, from `RENEW_EARLY_MS` (5 minutes) before the end; of two at
once, the loser reuses the winner's tokens. A refused renewal or read says "PostHog asked you to
sign in again. Press Reconnect on the connection." A pasted key drops the tokens; signing in drops
the key.

**The check** (`connect.analytics-check`, every 3 hours, "Check the analytics apps" on Scheduled
jobs): up to `DAILY_AT_ONCE` (3) connections unchecked for 20 hours, oldest first, one at a time. A
change of state is logged once; otherwise only the check's time is written.

**Words.** Buttons say "Continue with <app>" and "Reconnect", never "Sign in with": Safe Browsing
flagged a portal as phishing for a logo beside sign-in words and a key box. No page shows a
company's logo with sign-in words and a key box together; a key box is `SecretInput` (hidden
typing, not a password box).

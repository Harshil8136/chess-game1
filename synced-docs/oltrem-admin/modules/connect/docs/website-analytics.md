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
for each part (`links`). A figure an app does not keep is left out, never estimated.

**PostHog** is asked four HogQL questions, two at a time (it answers three at once per project):
the figures (which must answer), where visitors came from, where they are and what they use with
the hours, and speed with stuck taps and right now. A question it does not answer is named in
`missing` and the rest of the report stands. A key's check asks the figures alone. The company's
time zone (Settings) is written into the hours question only when the runtime knows it (`clockOf`),
else UTC.

| App | Asked through | Not given |
|---|---|---|
| PostHog | Four HogQL questions, `POST /api/projects/<id>/query/` (Query Read key) | Goals (its events stand in) |
| Plausible | Stats API v2, `POST /api/v2/query`, at most 10 calls | Nothing; events are its goals |
| Umami | `stats`, `pageviews`, `metrics`, `active` (Cloud under `api.umami.is/v1`; older servers read too) | Nothing |
| Cloudflare Web Analytics | GraphQL `rumPageloadEventsAdaptiveGroups` (Account Analytics Read) | Visitors, bounce, average visit, events, people now |
| Google Analytics 4 | Data API `batchRunReports` twice and `runRealtimeReport`, with a token for the service account's JSON key signed in the Worker (`analytics.readonly`; the account a Viewer) | Nothing; its built-in events left out |
| Matomo | One `API.getBulkRequest` POST with all reports, the token in the body; a part switched off leaves its figure out | Visitors over a range unless turned on |
| Fathom | `/aggregations` and `/current_visitors`, nine calls in turns of `FATHOM_AT_ONCE` (5) | Visits apart from visitors, events |

An answer past `ANSWER_MAX` (2 MB) is refused unread. A report is kept in the Cache API, keyed by
connection, window, clock and the key's last change; nothing goes to KV. It is fresh for
`WEB_CACHE_SECONDS` (10 minutes) and kept `WEB_KEEP_SECONDS` (a day) as the fallback: past its ten
minutes, a caller that hands in `waitUntil` gets it at once while a new one is read behind it; when
the app does not answer, the copy is answered with `kept` (why), which the page says. A refusal
with no copy is said in plain words, with the connection's page as the fix when a key fixes it.
`connect.web(env, tenantId, days, how)` (`WEB_DAYS`: 7, 30, 90; `how`: the company's `zone` and
`waitUntil`) answers at most `WEB_MAX` (4) connections for the Analytics page. The routes mount
only with `registry`.

| Route (`/api/connect`) | |
|---|---|
| `GET /analytics` | The apps, fields, steps, `signIn` where set up, and connections with their last check; fields a sign-in fills never listed |
| `POST /analytics` | Connect one (`definitionId`, `fields`, `label`), then a first check; the same site twice is `KIT-E-0422`; a token, refresh token or client typed in is refused |
| `GET /analytics/:id` | Its fields that are no secret and its last check |
| `GET /analytics/:id/report?days=` | Its report (7 by default), a kept one answered at once past its ten minutes |
| `POST /analytics/:id/credential` | A new key or field (left out keeps what is saved), checked at once; a signed-in connection's site or region changes only with a key (`KIT-E-0422`) |
| `POST /analytics/:id/check` | The last day; again within 30 s, the last answer |
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

---
title: "@oltrem/connect: Website analytics"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/connect/src; split from modules/connect/README.md]
---

# @oltrem/connect: Website analytics

> Part of [the @oltrem/connect README](../README.md).

## Website analytics

Added 2026-11-26, the owner's ask: "PostHog and the best ones, with all possible features". Each
connection is a providers instance of the kind `analytics` (`@oltrem/providers`, its definitions
in `src/definitions/analytics.ts`): its key sealed by the registry, its address built only from
fields a pattern pins to the app's own shape, so a key is never sent elsewhere. The email
providers' pages neither list nor count one. `src/web.ts` reads each app into one report,
`WebReport` (`src/types.ts`): the window's visitors, visits, page views, the share that left after
one page, the average visit, the same window before it, each day, the top pages, sources,
countries, devices, browsers and the app's own events, and the people on the site now. A figure
an app does not keep is left out, never estimated.

| App | Asked through | What it does not give |
|---|---|---|
| PostHog | one HogQL query, `POST /api/projects/<id>/query/`, a personal key with Query Read | nothing |
| Plausible | the Stats API v2, `POST /api/v2/query`, at most 10 calls (its limit is 600 an hour) | nothing; events are its goals |
| Umami | `stats`, `pageviews`, `metrics`, `active` (Cloud under `api.umami.is/v1`; an older server's answers and its `url` page list read too) | nothing |
| Cloudflare Web Analytics | GraphQL `rumPageloadEventsAdaptiveGroups`, a token with Account Analytics Read | visitors, the share that left, the average visit, events, people on the site now |
| Google Analytics 4 | the Data API, `batchRunReports` twice and `runRealtimeReport` (the last five minutes), with a token Google gives for the service account's JSON key, signed in the Worker with WebCrypto (scope `analytics.readonly`); the account a Viewer of the property | nothing; its own events (`page_view`, `session_start`, `first_visit`, `user_engagement`) left out of the list |
| Matomo | one `API.getBulkRequest` POST carrying all 13 reports, the token in its body (a token limited to POST works); a part switched off, such as Events or Live, leaves only its figure out | visitors over a range where its owner has not turned that on |
| Fathom | `/aggregations` and `/current_visitors`, nine calls in turns of five, the most an account may run at once | visits apart from visitors, events |

An answer past 2 MB is refused as not a report before it is read whole (`ANSWER_MAX`): a week's
report is a few kilobytes, and the daily check calls addresses people typed. A report is kept ten minutes in the Cache API, keyed by the connection, the window and the key's
last change, so a page opened again calls no one and a new key is read at once; nothing is
written to KV. A refusal is said in plain words ("Plausible refused the key. Make a new key and
paste it here."), with the connection's page as the fix when a new key or a changed field fixes
it. `connect.web(env, tenantId, days)` (7, 30 or 90) answers one report per connection, at most
four (`WEB_MAX`), for the Analytics page, which calls it only after its own check. The template
hands in `registry: providers.registry`, without which these routes are not mounted, and passes
`connect.web` to the analytics module as its `web` option.

| Route | |
|---|---|
| `GET /api/connect/analytics` | the apps, their fields and steps, `signIn` where signing in is set up, and the connections made to each with their last check; the fields a sign-in fills are never listed |
| `POST /api/connect/analytics` | connect one (`definitionId`, `fields`, optional `label`), then a first check; the same app and site twice is `KIT-E-0422`; a token, refresh token or client typed in is refused, and PostHog or Google Analytics without a key says to paste one or sign in |
| `GET /api/connect/analytics/:id` | one connection: its fields that are no secret and its last check |
| `GET /api/connect/analytics/:id/report?days=` | its report (7 when left out), kept ten minutes |
| `POST /api/connect/analytics/:id/credential` | a new key or a changed field (a field left out keeps what is saved), checked at once; a signed-in connection's site or region changes only with a key, else it is refused (`KIT-E-0422`): its sign-in may reach other sites the person can see |
| `POST /api/connect/analytics/:id/check` | the last day asked for; asked again within 30 seconds, the last answer |
| `DELETE /api/connect/analytics/:id` | the connection and its sealed key; the app and its figures are not touched |
| `POST /api/connect/analytics/signin` | after Sign in with PostHog or Google: `held` (the sealed cookie) and `site`, one of those it lists; saves the connection (new, signed in again, or the one of that site) and checks it; answers `{id, again, check}` |
| `GET /api/connect/todo` | Home's Needs you: the failing analytics connections |

The Apps page reads the connections with the person's links: `GET /api/connect/links` answers
`analytics` (each connection, as `GET /api/connect/analytics/:id` does) for someone who holds the
permission at the company, `null` for someone who does not, read in one D1 batch with the links,
so the page stays inside its 10 queries.

The registry audits each as `providers.create`, `providers.probe`, `providers.credential` and
`providers.remove`.

### Sign in with PostHog or Google Analytics

Added 2026-11-26, the owner's ask: "1 Sign In which is modern, smart, smooth and easy to setup and
2nd is manual with API key". PostHog and Google Analytics connect by signing in, through the same
relay as one-click (`packages/relay`, its entries `posthog` and `google-analytics`), and the key
stays as the second way, folded under "Or connect with a key". PostHog needs no app registered:
its client id is the relay's own document (`/client/posthog`), so the portal renews its tokens
itself; Google Analytics reuses the Vendor's Google app with `analytics.readonly` and offline
access, renewed through the relay's `/renew/google-analytics`.

1. **Sign in.** "Sign in with PostHog" posts `/connect/start` with the app; the trip goes the same
   way as one-click, the person allows read-only access on the app's own page.
2. **Find the sites.** On the way back the portal checks the tokens (a token, a refresh token,
   when it ends, and for PostHog the relay's client id), then lists what the account can see:
   PostHog's projects in the US region and then the EU one (a 401 or 403 tries the other),
   narrowed to the projects the person allowed; Google's GA4 properties
   (`accountSummaries`). At most 12, each name cut to 48 characters. None is "nosites", said in
   plain words.
3. **Pick one.** The tokens and the sites wait in a sealed cookie (`HELD_ROW`, ten minutes); the
   page "Signed in to PostHog." lists the sites, each with Connect (the main button when there is
   one). Connect posts `POST /api/connect/analytics/signin`, which opens the cookie on the
   server, so a token never reaches the page; `/oneclick/held` refuses to hand one back.
4. **Saved.** A new connection named after the site, or the one being signed in again, or one
   already connected to the same site, its tokens replacing what was kept (`setCredential` with
   `replace`, so an old key is dropped); then a first check.

| Way | What is kept (sealed) | Renewed |
|---|---|---|
| Sign in with PostHog | the access token (an hour), the refresh token, when it ends, the client id | by the portal at PostHog's token endpoint with the client id, from five minutes before it ends |
| Sign in with Google | the access token (an hour), the refresh token, when it ends | through the relay (`/renew/google-analytics`), which adds the app's secret; Google keeps the refresh token |
| A key | the key, as before | never needed |

A renewal is done just before a read, a check or a report, never on a schedule of its own. Two
requests renewing at once: the one that loses reopens the connection and uses the tokens the
other kept. A refused renewal (400 or 401) or a refused read under a sign-in says "PostHog asked
you to sign in again. Press Reconnect on the connection." Pasting a key into a
signed-in connection drops its tokens; signing in again drops a key.

**The daily check** (`connect.analytics-check`, every three hours, listed on Scheduled jobs as
"Check the analytics apps"): up to three connections whose last check is older than 20 hours,
the oldest first, one after another, so a run stays far inside the 50 calls a Worker may make. A
change of state (working to failing or back) is logged once; a run that changes nothing writes
only the check's time. **Home** (Needs you, `GET /api/connect/todo`, for someone with
`connect.analytics.manage`): "PostHog stopped answering" for each failing connection, opening its
page, where Reconnect sits at the top when the last check failed.

**The words on the screen.** The buttons say "Continue with PostHog" and "Reconnect", never "Sign in
with": Google Safe Browsing flagged the owner's portal as phishing the day Sign in with PostHog
shipped, and a company's logo beside "Sign in" and a password box is what a fake login page looks
like. So no page or pop-up shows a company's logo with sign-in words and a key box together, and a
key box is `SecretInput` (typing hidden, no password box). This document still calls the way Sign in
with PostHog.

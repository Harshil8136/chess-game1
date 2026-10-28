---
title: "Sentry in Control Plane's place: the plan"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-28
verified_against: [code, infra, docs]
owner: harshil
related_code: [src/pages/dashboard/control-plane/index.astro, src/lib/control-plane/sentry-admin.ts, src/lib/control-plane/config-schema.ts, src/pages/api/sentry/settings.ts, src/lib/health/logscan.ts, src/workers/cf-entry.ts]
related_docs: [../features/SENTRY.md, ../records/reports/2026-10-28-sentry-page.md, ../features/CONTROL-PLANE.md, ../features/CONTROL-PLANE-CONNECTORS.md, ../features/SYSTEM-HEALTH.md, ../features/POSTHOG.md, 2026-10-28-posthog-page.md, ../architecture/PERMISSIONS-SYSTEM.md]
tags: [sentry, control-plane, logs, errors, permissions, limits, plan]
---

# Sentry in Control Plane's place: the plan

> **In one minute (for everyone)**
>
> - **What changes:** Control Plane ("Cloud Services" in the sidebar) becomes a **Sentry** page:
>   errors, logs, speed, trends, the website's up-time check, alerts, and Sentry's settings, each
>   part with its own permission.
> - **Nothing is lost:** Control Plane's four other tools move to the page that already owns
>   their subject (your choice 1, §11). Its old addresses lead to the new places.
> - **Logs:** Sentry has room for every log we write (5 GB a month free; we use well under 1%).
>   The catch: on Cloudflare's free plan, Cloudflare cannot copy its logs to Sentry. The page
>   can still show **all** of Cloudflare's logs by reading them from Cloudflare when you open it
>   (your choice 2, §11).
> - **Cost:** nothing to pay with the recommended choices. No new table, setting, library or
>   service.
> - **Decided (2026-10-28):** Harshil chose both recommendations (§11). Stage 1 shipped the same
>   day ([`SENTRY.md`](../features/SENTRY.md), change record (private)).

## 1. What was asked

Harshil on 2026-10-28: "we cant send those logs to PostHog as it only have limit from 1million
Events month and we generate more then 10k Observability logs in Cloudflare on a normal day. We
do have Sentry so maybe we can completely scrap
`/dashboard/control-plane` and put sentry systems there! for logs, analytics, trends, info,
errors, permission based config changes and updates available and many more!"

How the request is read:

- **"Logs, errors, trends, analytics, info":** Sentry's own tools (issues, logs, traces, charts),
  read through Sentry's API and drawn in the portal.
- **"Permission based config changes":** the Sentry settings Control Plane already changes
  (how much is sampled, which errors are ignored, filters, limits), plus the ones it does not
  yet (alerts on or off), each behind a permission on the Access page.
- **"Updates available":** read as Sentry's own update suggestions for each Worker (a newer
  Sentry library) and which release of each Worker Sentry last saw. If you meant something else
  by it, say so and the plan changes.
- **"Completely scrap Control Plane":** the page goes, but what it does that is not Sentry moves
  rather than disappears (§2).

## 2. What Control Plane does today, and where each part goes

Read from the code and the live database on 2026-10-28. Control Plane is eight rows on the
Access page (the page, four tabs, three permissions), Admin and above, with no person given or
refused it individually.

| Part today | What it does | Where it goes (recommended) |
|---|---|---|
| Overview: six figures (requests, cache, errors, users, queue, database size) | a snapshot | dropped: the Overview and Analytics pages show all six |
| Overview: the settings editor, 25 settings | sampling for Sentry and PostHog, the website's request limits, two read-only Cloudflare flags | split by subject: Sentry's 12 to the Sentry page, PostHog's 5 to the PostHog page, the 6 request limits and the 2 Cloudflare flags to Configuration |
| Overview: drift check and change history | which settings differ from their defaults; the last 15 changes | each moved setting keeps its history; the check runs where the setting now lives |
| Sentry tab | error counts, top issues, resolve or ignore, filters, key limits, spike protection | the Sentry page (all of it, and more: §5) |
| Cloudflare tab | the account's Workers, storage and queues; empty the website's cache; the site's security level | Configuration, as a "Cloudflare" section (Owner for the two changes, as today) |
| PostHog tab | session recording on or off and its share | the PostHog page, as a Settings part (its stage 3) |
| Supabase tab | Supabase's advice; never set up (its key was never added) | dropped: System health already shows Supabase's advice |

The website keeps reading its settings from the database whatever page edits them, so no move
changes what the website does. Old Control Plane addresses lead to the new places.

## 3. What Sentry already has for us

Read through the Sentry connector on 2026-10-28 (counts only, no text of any error or log).

| | Last 30 days | Free allowance a month | Used |
|---|---|---|---|
| Errors kept | 473 (365 more thrown away by our filters, mostly the browser's security reports) | 5,000 on the free plan | about 10% |
| Logs kept | about 580 lines (cf-admin 545, cf-astro 35) | 5 GB | well under 1% |
| Spans kept (timings of requests) | about 19,400 | 5 million | under 1% |
| Up-time checks | 1 monitor: the website, every minute | 1 | full |
| Scheduled-job checks | 1 monitor: the server's heartbeat, every 5 minutes | 1 | full |
| Alerts | 3 rules (high-priority issues; two set up by Sentry) | | |

Projects: cf-admin (the portal), cf-astro (the website), cf-vps (the server). Open issues today: 3.
Which Sentry plan the account is on could not be read from here; the free plan's numbers are
shown, and the page's Overview will read the real ones.

Why logs are so few: the portal sends its own log lines from page visits only, the website
sends only warnings and errors, and the scheduled jobs (the 5-minute ticks, the checks, the
sweeps) send none, on purpose: every line copied to Sentry costs CPU inside the free plan's
10 ms (`src/workers/cf-entry.ts`, `lightSentry`). Those jobs write most of Cloudflare's 10,000+
lines a day.

## 4. The logs question

- **PostHog** counts each log line against its 1 million events a month, which 10,000+ lines a
  day would use up a third of. You chose "not now" for that.
- **Sentry** keeps logs by size, not count: 5 GB a month free. 10,000 to 20,000 lines a day is
  roughly 0.3 to 0.6 GB a month at about 1 KB a line. It fits easily.
- **The catch:** Cloudflare's automatic copy of logs to another service (its OpenTelemetry
  export) is **not available on the Workers free plan**: "Workers Free: Not available"
  (Cloudflare's "Exporting OpenTelemetry Data" page, read 2026-10-28). On the $5-a-month Workers
  plan it includes 10 million log lines a month.

So there are three ways to get every log onto the Sentry page:

1. **Read Cloudflare's logs when the page is opened (recommended, free).** The page asks
   Cloudflare's log search for the lines you are looking at (Worker, level, words, time), and
   Sentry for the lines it keeps, and shows both in one list, each marked with where it came
   from. Nothing is copied anywhere. It needs one step from you that is already waiting: add the
   "Workers Observability: Edit" permission to the portal's existing Cloudflare token
   (MAINTENANCE LS-1; System health's log scan is refused until then). *Corrected 2026-10-28:*
   this plan first said Read, as LS-1 did; Cloudflare's API reference lists Workers
   Observability Write as the query's only permission. Cloudflare keeps logs 3
   days on the free plan (7 days from 1 December 2026).
2. **The $5-a-month Workers plan.** Cloudflare then copies every line into Sentry by itself;
   Sentry can search them 7 days back on its free plan (14 or 30 on paid ones). It also lifts the 10 ms
   limit. A billing decision, so yours.
3. **Only what our Workers send Sentry themselves.** Free and simple, but that is errors and
   warnings mostly, not "all the logs".

## 5. The Sentry page

One page, **Sentry**, in Control Plane's place in the sidebar, with a row of parts across the
top like the PostHog page. Everything shown is read live from Sentry (and Cloudflare for logs),
kept a short while so opening it again does not ask again.

| Part | What you see | What you can change (permission) |
|---|---|---|
| **Overview** | for each Worker: open issues, new today, errors in 24 hours with a 14-day line; this month's allowance per kind (errors, logs, spans) with a month-end estimate; what Sentry threw away and why; the website's up-time and the server's heartbeat; a check of the portal's Sentry key against each Sentry tool | nothing |
| **Issues** | every issue of the three Workers, by status (open, for review, regressed, resolved, archived), Worker, level and time; one issue: how often and for whom, its latest stack trace with our own code first, tags (page, browser, release), the steps before it, its trace, Copy for AI, Open in Sentry | resolve, resolve in the next release, archive (for a day, until it gets worse, for ever), reopen, add a note (`#triage`) |
| **Logs** | one list of log lines from Sentry and Cloudflare, newest first, by Worker, level, words and time; a chart of lines by level; one line opens its details and the request it belongs to; a live mode that asks again every 30 seconds while the screen is on | nothing |
| **Speed** | the slowest pages and API routes (typical and worst times, how many, how many failed), the outside services we call and how fast they answer, cache hits; one request drawn as a timeline | nothing |
| **Trends** | errors, new issues, log lines and requests per day for each Worker, this period against the one before | nothing |
| **Monitors and alerts** | the website's up-time checks (up or down, response time, the last failures), the server's heartbeat check-ins, the alert rules; Sentry's update suggestions and the release of each Worker it last saw | turn an alert or monitor on or off (`#provider-write`) |
| **Settings** | Sentry's settings per Worker, moved from Control Plane: how much is sampled, the per-page rules, ignored errors, the on/off switch; Sentry's own filters, key limits and spike protection; the history of every change and the drift check | sampling and rules (`#sampling`); Sentry's own project settings (`#provider-write`) |

Each part opens from the row of parts and is its own permission on the Access page.

## 6. Permissions

New rows on the Access page, one migration that only adds rows. Defaults follow Control Plane's
today, so no one gains or loses access on the day it ships; each can be changed on the Access
page.

| Row | Who has it by default | Why |
|---|---|---|
| The page, and each of its seven parts | Admin and above | the same as Control Plane today |
| `#triage`: resolve, archive, reopen, note | Admin and above | it changes Sentry, but nothing on the website |
| `#sampling`: Sentry sampling and rules | Admin and above | replaces Control Plane's "Change sampling rates" |
| `#provider-write`: Sentry's own settings, alerts, monitors | Owner | replaces Control Plane's "Change provider settings" |
| `#refresh`: ask again instead of the kept copy | Admin and above | each ask counts against Sentry's limits |
| `#details`: see log and error text without masking | Owner | lines can carry a guest's or a colleague's email; everyone else sees it masked |

Every change is checked twice (the page and the route), written to the portal's audit log with
who, what, before and after, and refused if the person lacks the permission.

## 7. Staying inside the limits

| Limit | What it is | How the page stays inside it |
|---|---|---|
| Worker CPU | 10 ms per request on the free plan | Sentry and Cloudflare count and sort; the Worker passes at most 100 rows a call and trims stack traces before sending them; charts are drawn by the phone |
| Outbound calls | 6 at once per request; 50 per request on the free plan | at most 2 calls at once per part, 3 for the Overview |
| Requests | 100,000 a day on the free plan | a few per opening; kept copies answer repeat openings |
| Sentry's API | limits per caller and per endpoint, plus a limit on calls at once (Sentry's "Rate Limits" page) | kept copies (lists 1 minute, the Overview 5, an issue 2, live logs 30 seconds); when Sentry says wait, the page waits and says so |
| Cloudflare's API | 1,200 calls per 5 minutes per user (Cloudflare's general API limit) | logs are asked for only when the Logs part is open, never on a timer in the background |
| Sentry's allowance | errors, logs and spans sent to it | reading never counts; only sending does. The page sends nothing |

## 8. Stages

1. **Overview, Issues (with triage), Logs from Sentry, Settings moved.** Control Plane's other
   parts move per choice 1; its addresses redirect. Cloudflare's logs join the Logs part as soon
   as the token step is done (choice 2). *As built:* stage 1 shipped in two parts. The first
   (2026-10-28) is the Overview, Issues with Resolve, Reopen and Archive until it gets worse, and
   Logs from both sources (Cloudflare's side waits on the token step); the note, "resolve in the
   next release" and the other archive lengths were left for later. The second (2026-10-28,
   migration `0081`) moved Sentry's settings and controls to a Settings part
   ([SENTRY.md](../features/SENTRY.md) §6): the website's rows, the rules per page, the ignored
   errors, Sentry's own spike protection, filters and key limits, the list of changes, and the
   drift check as "which settings differ from their defaults" with a way to put them back. The
   portal's three rows are shown but not offered until stage 3. The third (2026-10-28, migration
   `0082`) moved PostHog's settings and its recording switch to a Settings part on the PostHog
   page ([POSTHOG.md](../features/POSTHOG.md) §3), on the same setting rows, now shared by both
   pages; its share of visits recorded changes PostHog's own `session_recording_sample_rate`
   (§10). The fourth (2026-10-28, migration `0083`) moved the website's request limits and the
   Cloudflare tools to the Configuration page
   ([SETTINGS-AND-CONFIGURATION.md](../features/SETTINGS-AND-CONFIGURATION.md)), with Cloudflare's
   changes behind their own key, Change Cloudflare settings; Control Plane's Cloudflare address
   forwards there, and its Workers list was dropped, since Analytics' Reliability part lists each
   Worker. The fifth (2026-10-28) retired Control Plane: its overview and Sentry addresses lead to
   this page, its PostHog address to the PostHog page's Settings, its Supabase address to System
   health, and its routes and code were removed
   ([CONTROL-PLANE.md](../features/CONTROL-PLANE.md)). The sixth (2026-10-28, migration `0084`),
   once that was live, switched off its eight registry rows and the two unused Cloudflare
   settings rows.
2. **Speed, Trends, Monitors and alerts.** *As built (2026-10-28, migration `0085`):* three
   parts ([SENTRY.md](../features/SENTRY.md) §7 to §9). Speed: the pages and routes timed on our
   Workers or in visitors' browsers, the outside services and the website's cache reads, by
   period and project, and a route's slowest request step by step. Trends: errors, new issues,
   log lines, speed samples, requests and failed requests each day of the last 7 or 14 days
   against the days before, per project and per Worker (Cloudflare's counts for the requests).
   Monitors and alerts: Sentry's up-time checks, heartbeats and alerts as they stand, each
   switched on or off by a person who holds Change Sentry's own settings; who is told stays in
   Sentry and is never read. The releases and Sentry's update suggestions moved to stage 3, since
   both belong to what the portal sends; the cache card cannot show its found share until the
   website tells Sentry (MAINTENANCE SE-9).
3. **What the portal itself sends:** the portal's three Sentry settings that nothing reads today
   (§10) start working, the releases each project has sent, and Sentry's update suggestions.
   *As built so far (2026-10-28, migration `0086`):* the Releases and updates part
   ([SENTRY.md](../features/SENTRY.md) §10): each project's newest releases with when each was
   first and last seen and the issues first seen in it, and the changes Sentry suggests to the
   library each project used in the last day (a newer version, an integration to turn on, another
   library), as words with Sentry's page, since an update is a change made in that project's own
   repository. The portal's three settings wait on Harshil's choice: wiring them changes what the
   portal sends today.

Each stage ships on its own, with its tests, documents and a change record.

## 9. What could go wrong, and what is not kept

- **The Sentry key may lack a permission** a part needs (for example `event:write` to resolve,
  `alerts:write` for alerts). The Overview's check names it. Sentry's personal keys cannot gain a
  permission later, so that would mean a new key under the same name: your step, nothing new.
- **Sentry's free plan searches logs back 7 days only;** Cloudflare's logs go back 3 days on the
  free plan. The page says how far back each source reaches.
- **The six snapshot figures and the Supabase tab are not kept** (§2): both exist elsewhere or
  never worked.

## 10. Found along the way

- **The website throws away 3 in 10 of its errors before Sentry sees them:**
  `sentry.cf_astro.error_sample_rate` is 0.7 (set 2026-06-05). With 10% of the free allowance
  used, all could be kept. Changing it is one setting, `#sampling`, once it is on the Sentry page.
- **The portal's own three Sentry settings do nothing:** `sentry.cf_admin.traces` reads 0.3 on
  the page, but the code uses 0.1, and the on/off switch is read by nothing (already written in
  [CONTROL-PLANE.md](../features/CONTROL-PLANE.md) §4.5). Stage 3 makes them work, or removes them.
- **The PostHog plan's logs recommendation** (Cloudflare's export to PostHog) would not have
  worked on the free plan either; noted in its §10.
- **Control Plane's PostHog share never took effect:** it writes `session_replay_config`, which
  PostHog does not sample by, and nothing on the website uses its own
  `posthog.session_recording.sample_rate` row (`cf-astro/src/scripts/analytics-loader.ts`). Found
  2026-10-28 while moving PostHog's settings; MAINTENANCE PH-2 and PH-3.
- **Two of the limits and Cloudflare rows do nothing:** the privacy request limit is read by no
  website route (the form uses a limit built into the website), and Control Plane's two read-only
  Cloudflare rows are read by nothing, one of them wrong. Found 2026-10-28 while moving them;
  MAINTENANCE SE-6 and SE-7.
- **System health's log scan is still refused** by Cloudflare (live row read 2026-10-28 04:35 UTC):
  the same token step as choice 2.

## 11. Choices that are yours

1. **Where Control Plane's non-Sentry tools go.** Recommended: each to the page that owns its
   subject (PostHog's settings to the PostHog page; the website's request limits and the
   Cloudflare tools to Configuration). Or: keep a small "Cloud services" page for them beside
   the Sentry page. Or: put them as extra parts inside the Sentry page.
2. **How the Sentry page gets all of Cloudflare's logs.** Recommended: read them from Cloudflare
   when the page is opened (free; your token step). Or: the $5-a-month Workers plan, which copies
   every line into Sentry. Or: only what our Workers send Sentry themselves.

### Harshil's answers (2026-10-28, 04:59 UTC)

1. "Each to the page that owns it": Sentry's settings to the Sentry page, PostHog's to the PostHog
   page, the request limits and the Cloudflare tools to Configuration; the Supabase tab is
   dropped; Control Plane's old addresses lead to the new places. With his first message
   ("completely scrap"), this is his yes to retire Control Plane once every tool has moved.
2. "Read them live from Cloudflare".

## 12. Decided against

- **Sentry's site inside the portal (an iframe):** it needs a Sentry sign-in and skips the
  portal's permissions.
- **Copying Sentry's data into our database:** a new table and a second copy of personal data
  (RULE #0.9); short kept copies at the edge are enough.
- **Another log service** (Axiom, Grafana and others): a new outside service, and Sentry is
  already here.
- **Sending the scheduled jobs' lines through the Sentry library:** free, but every line costs
  CPU inside the 10 ms in the jobs that already run closest to it.

## Sources

- Sentry pricing and quotas: Sentry's "Pricing & Billing" documentation (all plans include 5 GB
  of logs) and pricing page, read 2026-10-28.
- Sentry logs search window by plan: Sentry's "Logs" documentation (Developer 7 days, Team 14,
  Business 30).
- Sentry's API: "Query Explore Events in Table Format" (datasets errors, logs, spans,
  uptime results; 100 rows), "Rate Limits", "Permissions & Scopes".
- Cloudflare: "Exporting OpenTelemetry Data" (not available on Workers Free; 10 million log
  events included on Workers Paid).
- Live: Sentry connector (projects, counts, monitors, alert rules, open issues); Cloudflare D1
  connector (Control Plane's rows, the 25 settings, no per-person grants, the log scan row).

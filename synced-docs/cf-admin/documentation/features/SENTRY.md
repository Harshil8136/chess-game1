---
title: "Sentry — errors, logs and Sentry's own tools in the portal"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-10-28
verified_against: [code, infra]
owner: harshil
related_code:
- src/pages/dashboard/sentry/index.astro
- src/pages/dashboard/sentry/[part].astro
- src/pages/api/sentry/[part].ts
- src/components/dashboard/sentry/Sentry.tsx
- src/components/dashboard/sentry/Issues.tsx
- src/components/dashboard/sentry/Logs.tsx
- src/components/dashboard/sentry/Settings.tsx
- src/components/dashboard/sentry/Speed.tsx
- src/components/dashboard/sentry/Trends.tsx
- src/components/dashboard/sentry/Monitors.tsx
- src/components/dashboard/sentry/Releases.tsx
- src/components/dashboard/sentry/frame.tsx
- src/components/admin/control-plane/useConfigEdit.ts
- src/components/admin/control-plane/SettingRows.tsx
- src/lib/control-plane/settings-rows.ts
- src/lib/control-plane/settings-routes.ts
- src/styles/components/setting-rows.css
- src/components/dashboard/sentry/parts.tsx
- src/components/dashboard/sentry/format.ts
- src/components/dashboard/posthog/shared.tsx
- src/styles/pages/sentry.css
- src/lib/sentry/client.ts
- src/lib/sentry/privacy.ts
- src/lib/sentry/issues.ts
- src/lib/sentry/logs.ts
- src/lib/sentry/cloudflare.ts
- src/lib/sentry/overview.ts
- src/lib/sentry/settings.ts
- src/lib/sentry/speed.ts
- src/lib/sentry/trends.ts
- src/lib/sentry/monitors.ts
- src/lib/sentry/releases.ts
- src/lib/sentry-config.ts
- src/workers/cf-entry.ts
- sentry.client.config.ts
- src/layouts/AdminLayout.astro
- src/pages/api/sentry/settings.ts
- src/lib/dal/ServiceConfigRepository.ts
- src/lib/control-plane/config-schema.ts
- src/lib/sentry/types.ts
- src/lib/health/workers.ts
- src/lib/auth/surface-guards.ts
- src/lib/schemas/operations.ts
- migrations/0080_sentry_page.sql
- migrations/0081_sentry_settings.sql
- migrations/0085_sentry_speed_trends_monitors.sql
- migrations/0086_sentry_releases.sql
- test/sentry.test.ts
- test/sentry-settings.test.ts
- test/sentry-stage2.test.ts
- test/sentry-stage3.test.ts
- test/sentry-config.test.ts
- test/sentry-console.test.ts
- test/sentry-console-look.test.ts
related_docs:
- POSTHOG.md
- CONTROL-PLANE.md
- SYSTEM-HEALTH.md
- ../specs/2026-10-28-sentry-page.md
- ../records/reports/2026-10-28-sentry-page.md
- ../records/reports/2026-10-28-sentry-speed-trends-monitors.md
- ../records/reports/2026-10-28-sentry-releases-updates.md
- ../records/reports/2026-10-28-portal-sentry-settings.md
- ../specs/2026-10-29-sentry-console-look.md
- ../records/reports/2026-10-29-sentry-console-look.md
- ../architecture/PERMISSIONS-SYSTEM.md
- ../security/SECURITY.md
- ../security/RoPA.md
- ../operations/OPERATIONS.md
tags: [feature, sentry, errors, issues, logs, speed, trends, monitors, alerts, releases, updates, cloudflare, permissions]
---

# Sentry — errors, logs and Sentry's own tools in the portal

> **TL;DR (non-technical):** A page in the sidebar, **Sentry**, that shows the errors of the
> portal, the website and the server without signing in to Sentry: how many are open, which are
> new or getting worse, this month's use of Sentry's free plan, and every log line our Workers
> wrote, read live from Cloudflare. An Admin can mark an issue fixed or archive it from the
> portal; the change is kept in the audit log. Email addresses, IP addresses and long tokens in
> any text are hidden unless you hold "See full details". Its Settings part holds how much the
> website sends to Sentry and Sentry's own filters, limits and spike protection, moved here from
> Control Plane with every change kept. Speed shows how long each page and route takes, Trends
> each day against the days before, and Monitors and alerts Sentry's up-time checks, heartbeats
> and alerts, each of which the owner can switch on or off from here. Releases and updates shows
> the versions each project sent to Sentry with the new issues each brought, and the updates
> Sentry suggests for the library each project uses. The portal's own three Sentry settings (on
> or off, the share of errors kept, the share timed) work since 2026-10-28, at the 10% timed it
> used before. Since 2026-10-29 the page is drawn as a console on plain panels, its lists as
> tables, and the issue lists show Sentry's real counts (they read 0 before).

Asked for by Harshil on 2026-10-28: "completely scrap `/dashboard/control-plane` and put sentry
systems there! for logs, analytics, trends, info, errors, permission based config changes and
updates available". His choices the same day: Cloudflare's logs are read live from Cloudflare
(its free plan cannot copy them to Sentry), and each of Control Plane's other tools moves to the
page that owns its subject. The plan, its stages and those choices are in the
[plan](../specs/2026-10-28-sentry-page.md); what shipped and how it was checked is in the
change record (private). This document describes stage 1:
the page, its permissions, the Overview, Issues (with resolving and archiving) and Logs; the
Settings part, which took over Control Plane's Sentry settings the same day (§6); and stage 2,
Speed, Trends, and Monitors and alerts (§7 to §9; its
change record (private)); and from stage 3,
Releases and updates (§10; its
change record (private)) and the portal's own
Sentry settings working (§6; its
change record (private)).

**How it is drawn** (2026-10-29, Harshil: every part "looks horrendous", the glass "not good for
this type of work"): the console look of its [design](../specs/2026-10-29-sentry-console-look.md),
built from `frame.tsx` and `src/styles/pages/sentry.css` (its
change record (private)). Each part is a slim
header, one toolbar (the search, then every option group in one row: sideways on a phone, wrapped
when wide) and a grid of solid panels, three, two or one across, none spanning rows. Lists are
tables with column heads once their panel is wide enough; narrower, each row's figures fold into a
line under its name. Sentry's icon in the sidebar is a bug.

## 1. Who may do what

| Key | Name | Default | What it allows |
|---|---|---|---|
| `/dashboard/sentry` | Sentry | Admin (`super_admin`) | the page and its Overview |
| `/dashboard/sentry/issues` | Issues | Admin | the Issues part |
| `/dashboard/sentry/logs` | Logs | Admin | the Logs part |
| `/dashboard/sentry/monitors` | Monitors and alerts | Admin | the Monitors and alerts part: every one shown, none switched |
| `/dashboard/sentry/releases` | Releases and updates | Admin | the Releases and updates part (it only reads) |
| `/dashboard/sentry/speed` | Speed | Admin | the Speed part |
| `/dashboard/sentry/trends` | Trends | Admin | the Trends part |
| `/dashboard/sentry/settings` | Settings | Admin | the Settings part: every setting shown, none changed |
| `/dashboard/sentry#triage` | Resolve and archive issues | Admin | the Resolve, Reopen and Archive buttons on an issue (needs the Issues part too) |
| `/dashboard/sentry#refresh` | Refresh Sentry now | Admin | the Refresh button: ask Sentry and Cloudflare again instead of the kept copy |
| `/dashboard/sentry#sampling` | Change what is sent to Sentry | Admin | change the website's rows, the rules per page and the list of ignored errors, and put them back to their defaults (needs the Settings part too) |
| `/dashboard/sentry#provider-write` | Change Sentry's own settings | Owner | spike protection, the filters and the client keys' limits, in Sentry itself (needs the Settings part too); with the Monitors part, switching an up-time check, a heartbeat or an alert on or off |
| `/dashboard/sentry#details` | See full details | Owner | error text, addresses and log lines unmasked (§13) |

The defaults are Control Plane's, so no one gains or loses access the day it ships.
`denySentry(user, part?, action?)` in `src/lib/auth/surface-guards.ts` asks for the page, then the
part, then the action, each exactly with `placRequireGrant` (fail-closed: a key not in a person's
map is refused, never inherited). The pages check it before any HTML is made, and the route
checks it again. `sentryCan(user)` tells the page which parts and buttons to offer, so it never
shows one the route would refuse. The rows are migrations `0080`, `0081` (Settings), `0085`
(Speed, Trends, Monitors and alerts) and `0086` (Releases and updates); the parts share Logs'
sort order, so the tabs read Issues, Logs, Monitors and alerts, Releases and updates, Speed,
Trends, Settings; the
[permissions model](../architecture/PERMISSIONS-SYSTEM.md) owns the rules.

## 2. Setting it up

The page uses what the portal already holds: `SENTRY_AUTH_TOKEN` against the organisation in
`SENTRY_ORG_SLUG`, and `CLOUDFLARE_API_TOKEN` with `CF_ACCOUNT_ID` for Cloudflare's logs. No
binding, secret or variable was added ([OPERATIONS.md](../operations/OPERATIONS.md) §5).

| Needs | For |
|---|---|
| Sentry `event:read` | the open issues, the Issues part, Sentry's log lines |
| Sentry `org:read` | this month's use (`stats_v2`), the project list the filters ask by, and the updates Sentry suggests (`sdk-updates`) |
| Sentry `event:write` | resolving, reopening and archiving |
| Sentry `project:read` | Settings: a project's spike protection, filters and keys, and turning spike protection on or off; Releases and updates: the releases |
| Sentry `project:write` | Settings: turning a filter on or off and setting a key's limit (the part says when the token lacks it) |
| Sentry `alerts:read` | Monitors and alerts: the up-time checks, heartbeats and alerts |
| Sentry `alerts:write` (or `project:write`) | Monitors and alerts: switching one on or off (the part says when the token holds neither) |
| Cloudflare "Workers Observability: Edit" | Cloudflare's log lines (Cloudflare's query accepts no lesser permission) |
| Cloudflare "Account Analytics: Read" | Trends: requests and failed requests per Worker (the question the Analytics page asks) |

The Overview's "What the portal's tokens can reach" card reads the Sentry token's own permissions
(only `auth.scopes` of Sentry's answer about the token, §13) and tries each read, and names any
permission still missing in Sentry's or Cloudflare's own words. A Sentry token cannot gain a
permission later: one that lacks `event:write` is replaced by a new token saved under the same
name. Without the Sentry token or organisation the page says "Sentry is not connected" instead of
failing; without the Cloudflare permission the Logs part and the Overview's log card say which
permission to add and the rest works (MAINTENANCE (private) SE-1, SE-2).

## 3. The Overview

`/dashboard/sentry`. A strip of six figures: open issues (seen in the last 90 days), new today
(issues that began in the last 24 hours), getting worse (Sentry's "escalating"), not caught by our
code, Cloudflare's error lines and Sentry's log lines in the last 24 hours. A figure opens its part
when the person holds it; one that could not be read keeps its place with a dash and says why
("needs a permission" or "could not be read"). Then:

- **Errors each day:** the errors Sentry kept and turned away each of the last 14 days, and why
  any were turned away this month (filtered by a project's settings, over a limit or the quota,
  dropped by the app before sending, and Sentry's other reasons). The chart's key gives each
  total with its span ("in the last 14 days"), and the line under it names the day it reads,
  the busiest until a day is pointed at.
- **Open issues by project:** cf-admin (the portal), cf-astro (the website) and cf-vps (the
  server), each with its new and not-caught counts, opening the Issues part on that project.
- **Log lines, last 24 hours:** a table per source (Cloudflare per Worker, Sentry per project) of
  errors, warnings and the rest.
- **This month's use:** errors, spans and logs (by size) kept this month against the free plan's
  amounts (5,000 errors, 5 million spans, 5 GB of logs; Sentry's pricing page, read 2026-10-28),
  with any other kind Sentry counted this month; within it, near it (over 80%) or over it, in a
  glyph and a word. The page cannot read which plan the organisation is on, so the free plan's
  amounts are a mark to read the use against.
- **What the portal's tokens can reach** (§2). The parts this person may open are the row of
  tabs; the card that listed them again was removed on 2026-10-29.

## 4. Issues

`/dashboard/sentry/issues`. Every issue of the three projects seen in the last 24 hours, 14 days
(the default), 30 or 90 days; open (the default), resolved, archived or all; one project or
every one; last seen (the default), most often, newest or most people first; and words, searched
as one phrase. 25 at a time with "Show older issues" (Sentry's cursor), and how many match. A
table: the issue (its title, where in the code, the level, the project, Sentry's short id, "Not
caught", and the state when it is worth saying), a small chart of its errors over the period
(Sentry's own slices, `groupStatsPeriod=auto`), how many times and to how many people in the
period, how long since it was last seen, and its age (from when it began, `lifetime.firstSeen`).
The lists ask Sentry to collapse only `filtered`: until 2026-10-29 they also collapsed `stats`,
and Sentry then leaves out each issue's counts and times, so every row read 0 times and 0 people
and the Overview's "new today" stayed at 0.

Opening one (`?i=<id>`, so Back closes it): beside what happened (first on a phone, kept in view
on a wide screen) its state, level, counts, first and last seen and the releases, the changes and
"Open in Sentry"; **the latest time it happened**: the error and its message, when, whether our code
caught it, the request, release, environment, runtime, browser and system and Sentry's SDK, where
in the code (at most 12 frames, our own code first, newest call first, with our own code's line),
and the tags worth showing (environment, release, transaction, page, handled, mechanism, level,
runtime, browser, system, device, server); **what happened before**, the last 20 steps Sentry
kept. "Open in Sentry" is offered only for an address on `*.sentry.io`.

**Changing an issue** (`#triage`): Resolve (Sentry opens it again if it happens again), Reopen,
or Archive until it gets worse (hidden until Sentry sees it happen much more often than before),
offered by its state. One `PUT` to Sentry's issue (`{status, substatus}`), at most 20 changes a
minute per person, kept in the audit log as `provider_write` with the issue's id, the change and
Sentry's new state. The page shows the new state at once; the lists catch up within a minute.

## 5. Logs

`/dashboard/sentry/logs`. Log lines newest first, 50 at a time with "Show older lines", from
either source (a sideways row):

- **Cloudflare** (the default): every line our Workers wrote to Cloudflare's Workers Logs, read
  live from Cloudflare's Workers Observability query API when the part is open (Harshil's choice
  of 2026-10-28). Nothing is copied or stored, and Cloudflare keeps three days. Only the platform's
  own Workers (`OWN_WORKERS` in `src/lib/health/workers.ts`) are asked about: the client's Workers
  on the account are filtered out by Cloudflare, and anything else that comes back is dropped. A
  line shows its Worker, level, message (with the error, when one was thrown), what started it
  (method and path, or the cron or queue), the answer's status, and CPU and total time. The
  question is sent with `dry: true`, so it is never saved in the account. Not yet seen working
  live: it waits on the token step (§2; MAINTENANCE (private) SE-1).
- **Sentry:** the lines our Workers send to Sentry Logs (the portal's from requests, the
  website's warnings and errors), with their project and trace.

By the last hour, 24 hours (the default) or 3 days; errors, warnings and everything else (any
number on; errors and warnings by default, and a thrown error counts as an error at any level);
one Worker or project, or every one; and words. While the list is on screen and no older page is
open it asks again every minute.

## 6. Settings

`/dashboard/sentry/settings`. Moved from Control Plane on Harshil's choice of 2026-10-28 ("each to
the page that owns it"). One optional box at the top, "Why you are changing something", is kept
with each change in the list of changes. A setting, the reason box and the list of changes are
the shared setting rows (`src/components/admin/control-plane/SettingRows.tsx`, with
`src/lib/control-plane/settings-rows.ts` and `settings-routes.ts`), which the PostHog page's
Settings part uses too ([POSTHOG.md](POSTHOG.md) §3).

- **What the website sends:** the website's eight Sentry rows of `service_config` (on or off,
  the share of errors kept, the speed samples of bookings, of the API, of other pages and of the
  server, and the two screen-recording shares), each with a sideways On and Off or a share from
  0 to 100% in steps of 5, its bounds and its default. The website re-reads them within a minute.
  A speed share that a rule per page overrides says so: on 2026-10-28 the live rules set 90% for
  bookings and 50% for the API, so the rows of those two do not apply to those pages
  (MAINTENANCE (private) SE-4).
- **Sentry's own settings**, one project at a time (Website, Portal or Server, a sideways row),
  read from Sentry when the card opens and never kept: spike protection, each inbound filter
  (the old-browsers one says how many of Sentry's eight kinds it covers, and On turns all eight
  on), and each client key's limit (none, 100 a minute, 1,000 an hour or 10,000 a day; a limit
  set in Sentry to anything else shows as it is). Of a key only its id, name, state and limit
  are read; its secret, its addresses and the project's security token never leave the Worker.
- **Rules per page** and **Errors the website ignores:** Control Plane's two editors, saved the
  same way. The list of ignored errors has no row in the database on 2026-10-28, so the website
  uses the list built into its own code and the card says so (SE-5).
- **What the portal sends:** cf-admin's three Sentry rows, changed like the website's
  (`#sampling`): **Send to Sentry** (off sends nothing at all: errors, speed samples or log
  lines, from the server or a browser), **Errors kept** (Sentry's `sampleRate`) and **Speed
  samples** (Sentry's `tracesSampleRate` for its requests and page loads; its scheduled jobs are
  never timed). Since 2026-10-28 the portal follows them (`src/lib/sentry-config.ts`): Sentry's
  options are made at the start of each invocation, before the database can be read, so each copy
  of the Worker holds the values it last read and reads them again in the background at most
  once a minute (on a request, a scheduled run or a queue batch). Until a copy's first read it
  uses the values the portal used before (on, every error, 10%); a read that fails or finds none
  of the rows keeps what it held. Each page carries the values its server held in a meta tag
  (`cf-admin-sentry`), which the browser's Sentry reads when the page opens, so a page already
  open keeps what it had. On the owner's choice the saved share timed was put back from 30% to
  the 10% the portal used, before it took effect (kept in the list of changes, 2026-10-28).
- **Changes:** which settings differ from their defaults, the last 20 changes of Sentry's rows
  (who, when, why), and "Put them back to the defaults" behind a confirmation. Putting back
  touches only Sentry's rows, and a second time changes nothing.

`GET /api/sentry/settings` reads the rows with `getConfigByService('sentry')` and their history;
`?project=` reads one project's own settings from Sentry (two questions at a time, the token's
permissions from their kept copy, §11). `PATCH` changes one row: only Sentry's rows, the bounds
and types of `src/lib/control-plane/config-schema.ts`, and the row's `version`, so a change made
elsewhere in between is refused (409) and the screen reads the latest. `POST` puts the rows back
(`#sampling`) or changes one of Sentry's own settings (`#provider-write`). Every change is in
the audit log (`config_change` or `provider_write`), at most 20 a minute per person, and a row
change asks the website to re-read its settings. Control Plane's Sentry tab keeps working until
its pages lead here (§12).

## 7. Speed

`/dashboard/sentry/speed`. How long things take, from Sentry's speed samples: the share of
requests the website and the portal time (the shares in Settings, §6). Sentry estimates the
counts from that share, and the part says so.

- **Timed in** (a sideways row in the header): **our Workers** (the default: the requests they
  answered, Sentry's `http.server`) or **visitors' browsers** (page loads and moves between
  pages, `pageload` and `navigation`).
- In the last 24 hours, 7 days (the default) or 14 days; one project or every one; slowest (the
  default), busiest or most failed first.
- **Pages and routes:** up to 50, the busiest Sentry timed, each with its typical time (half
  took less), its slow time (one in twenty took longer), about how many requests and the share
  that failed. A slow time of half a second or more shows as needing work and a second or more as
  poor, each with a glyph and a word.
- **Outside services** (our Workers only): how fast what they call answers, by domain, up to 30,
  named in words (Supabase, Brevo, Resend, PostHog, Cloudflare Access, Cloudflare's API, Google,
  Sentry, our own sites) and otherwise as Sentry groups it.
- **Cache reads** (our Workers only): the website's page-cache reads (`cache.get`), up to 30. The
  share that found the page shows only where Sentry is told (`cache.hit`); on 2026-10-28 the
  website does not tell it, and the card says so (MAINTENANCE (private) SE-9).
- **A route's slowest request** (`?route=&rp=`, so Back closes it): its total time, when and
  where, and each step Sentry timed (the database, outside calls, cache reads) as a bar on a
  timeline, in the order they started and indented under the step that began them, at most 100;
  and how much of the request no step covers (our own code, or work Sentry was not asked to
  time).

A route name must be 1 to 200 characters with no quote, backslash or control character, and its
project one of ours, or the route answers 400 before a question is built. Without See full
details a route's name and a step's text are masked like any other text (§13).

## 8. Trends

`/dashboard/sentry/trends`. The last 7 days (the default) or 14 against the same number of days
before them, each a whole day in UTC (today is still filling in):

| Card | From | More is |
|---|---|---|
| Errors | Sentry's usage numbers (`stats_v2`, kept errors), per project | worse |
| New issues | Sentry's issue search, the issues first seen each day, per project (up to 100; more says "at least") | worse |
| Failed requests | Cloudflare's own counts (`workersInvocationsAdaptive`), per Worker of ours | worse |
| Requests | the same, per Worker of ours | neither |
| Log lines sent to Sentry | Sentry's usage numbers, per project | neither |
| Speed samples | Sentry's usage numbers (kept spans), per project | neither |

Each card has this period's total and its change in words (good or bad news only where more is
worse), a chart of every day of both periods (the days before in one colour, the last days in
another, with a legend of each period's total) and a table per project or Worker. A source that
could not be read says so once. Cloudflare keeps 30 days of these counts, so no longer period is
offered. The Analytics page's Reliability shows the platform's totals; Trends adds them per
project and Worker, against the days before.

## 9. Monitors and alerts

`/dashboard/sentry/monitors`. Sentry's own checks, as they stand in Sentry:

- **Up-time checks** (up to 5): Sentry asks an address every minute or so from around the world.
  Each shows whether it is up, down or off now, how often it asks and how long it waits, how many
  failures in a row count as down and how many answers as up again, the share of the last 24
  hours and of the last 7 days it was up (rounded down, so a site that was down at all never
  shows 100%) with its average answer, and its last 20 checks, newest first.
- **Heartbeats** (up to 50): a job tells Sentry it ran, and Sentry raises an issue when it misses
  or fails. Each shows its schedule, how late counts as missed, whether its notices are muted,
  and each place it checks in from with its state, last check-in and next.
- **Alerts** (up to 50): what sets each off, how it tells (email, Slack, and Sentry's other kinds),
  at most how often, when it was last set off and how many monitors or projects it listens to.

A person who holds the part and Change Sentry's own settings (`#provider-write`, Owner by
default) switches each on or off with a sideways On and Off: one `PUT` to Sentry (an up-time
check's or a heartbeat's `status`, an alert's `enabled`), at most 20 a minute per person, kept in
the audit log as `provider_write` (`sentry_monitor`, `sentry:{kind}:{id}`). Everything else about
them, who is told among it, is changed in Sentry.

Never read or passed on: an up-time check's headers and body (they can hold a key), an owner (it
can be an email address) and an alert's targets (the addresses and channels it tells). The
address a check asks shows by its path only without See full details.

## 10. Releases and updates

`/dashboard/sentry/releases`. It only reads:

- **Releases** (the newest 30 across the projects): the versions each project sent to Sentry,
  grouped by project with the newest 5 of each shown and the newest marked. Each shows its short
  name (the part after the last `@`, so `cf-admin@3c850ec` shows `3c850ec`), when Sentry first
  and last saw an event from it, and how many issues were first seen in it ("No new issues" in
  good news, a count in bad).
- **Updates Sentry suggests**: Sentry's `sdk-updates` for the library each project used with
  Sentry in the last day: a newer minor or major version of it ("Update … to …"; Sentry
  suggests no patch versions), an integration to turn on ("Turn on …"), or another library to
  use instead ("Use … instead"), with Sentry's page about it when that is an `https` address.
  An update is a change to that project's code, made and tested in its own repository, so the
  part says so instead of offering a button.

Never read or passed on: a release's authors, its owner, its last commit and its data (any of
them can name a person or quote a commit message).

## 11. Where each part reads from, and staying inside the limits

The route is `GET /api/sentry/{part}` (`overview`, `issues`, `logs`, `speed`, `trends`,
`monitors`, `releases`), with `fresh=1` for Refresh now, `POST /api/sentry/issues` for a change to an issue
and `POST /api/sentry/monitors` for a switch; [SECURITY.md](../security/SECURITY.md) §6a holds
their rows.

| Part | Read from |
|---|---|
| Overview | Sentry: the token itself (`GET /api/0/`, for its permissions), the open issues (`/organizations/{org}/issues/`, up to 100, with `X-Hits` for more), this month's use (`stats_v2`, 31 days by category and outcome), Sentry's log lines counted by project and severity (`events/?dataset=logs`); Cloudflare: the last 24 hours counted by Worker and level (the query API's `calculations` view) |
| Issues | the list (`/organizations/{org}/issues/`), one issue (`…/issues/{id}/`) and its latest event (`…/issues/{id}/events/latest/`) side by side; the project ids (`/organizations/{org}/projects/`, kept an hour) when a project is chosen |
| Logs | Cloudflare's query API (`events` view) or Sentry's `events/?dataset=logs` |
| Speed | Sentry's spans (`events/?dataset=spans`): the routes, the outside calls and the cache reads, three questions; a route's slowest request, then its steps |
| Trends | Sentry's `stats_v2` (both periods by project and kind) and its issues first seen in both periods; Cloudflare's GraphQL (`workersInvocationsAdaptive` by Worker and day) |
| Monitors and alerts | Sentry's `/organizations/{org}/uptime/`, `uptime-summary/` (both periods, every check in one question each), each check's `checks/`, `/organizations/{org}/monitors/` and `/organizations/{org}/workflows/` |
| Releases and updates | Sentry's `/organizations/{org}/releases/` (every project, newest 30) and `/organizations/{org}/sdk-updates/` (every project), with the project list to name a project by its id |

- **One way to Sentry** (`src/lib/sentry/client.ts`). Every call has 9 seconds. A 5xx, a dropped
  connection, or a 429 asking for at most 2 seconds is asked once more in the Worker; a longer
  wait goes back to the page, which asks again by itself. A refusal names the permission to give
  the token in Sentry's own words. A question Sentry refuses as malformed (400) is logged with
  Sentry's reason, since it is usually this code's fault. Cloudflare's query has the same 9
  seconds, and a refusal says which permission to add.
- **Nothing a person sends can change a question.** An issue id must be a number (anything else
  is a 400 before a question is built); a cursor must be shaped as Sentry's, or as a Cloudflare
  line id of word characters; a period, state, order, source, range or level that is not one of
  its listed values falls back to the default; a project or Worker that is not ours is dropped;
  typed words lose quotes, backslashes and line breaks and are searched as one quoted phrase.
- **Few questions at once.** The Overview's five questions go at most three at a time; Issues
  asks two at once for one issue; Speed, Trends, Monitors and alerts, and Releases and updates
  two at a time (the up-time checks' own questions after the others); inside the Worker's six open connections.
- **Short copies** in the Worker's own edge cache (the PostHog page's Cache API helper, no
  binding, nothing in D1): log lines for 30 seconds, a list, Speed and Monitors and alerts for a
  minute, one issue and a route's slowest request for five, the Overview, Trends and Releases and
  updates for ten, the
  token's permissions and the project list for an hour. A read that failed is kept 20 seconds,
  and one Sentry asked us to wait on is not kept. Each copy is kept apart for readers with and
  without See full details. A change drops that issue's copies, and a switch the part's.
- **CPU.** Sentry and Cloudflare count, sort and search; the Worker checks values, builds the
  question and reshapes at most 100 rows. Reading never counts against Sentry's allowance: only
  sending does, and this page sends nothing to it.

## 12. Control Plane: what moved where

Control Plane ("Cloud Services" in the sidebar) was retired on 2026-10-28, once every tool had
moved: its addresses lead to the new places, its routes and code were removed, and migration
`0084` switched its rows off in the next push ([plan](../specs/2026-10-28-sentry-page.md) §2 and §8;
[CONTROL-PLANE.md](CONTROL-PLANE.md)):

| Control Plane | Went to | Its old address leads to |
|---|---|---|
| The overview | this page, in the same sidebar group | `/dashboard/sentry` |
| Sentry tab: counts, top issues, resolve or ignore | this page's Overview and Issues (stage 1) | `/dashboard/sentry` |
| Sentry's settings and controls (sampling, rules, filters, key limits, spike protection) | the Settings part (§6; `#sampling` Admin, `#provider-write` Owner) | `/dashboard/sentry` |
| PostHog tab: the website's PostHog settings, session recording on or off | the PostHog page's Settings part | `/dashboard/posthog/settings` |
| The website's request limits; Cloudflare's cache purge and security level | Configuration | `/dashboard/configuration#cloudflare` |
| The overview's six figures; the Supabase tab | dropped: the Overview, Analytics and System health show them | `/dashboard/health` (the Supabase tab) |

## 13. Privacy

An error's message, a breadcrumb or a log line can quote what a person typed or who they are: a
guest's email on a booking, a staff member's address, an IP address, a token in an address
(`src/lib/sentry/privacy.ts`). Unless the reader holds See full details:

- email addresses and phone numbers become "[email]" and "[phone]" (the PostHog page's masking),
  IP addresses "[ip]", and anything shaped like a key or session id (24 or more letters and
  digits with both in it) "[token]";
- addresses keep only their path, never what follows `?` or `#`; a file name in a stack frame
  keeps its path but not its query.

With or without it, Sentry's `user` of an event is never read, nor an up-time check's headers, body
or owner, nor an alert's targets (§9), nor a release's authors, owner, last commit or data (§10),
nor anything but `auth.scopes` of Sentry's answer about the
token (which also names the token's owner); a library's line of code is not passed on, only our
own; and texts are cut at 2,000 characters. Nothing is stored: answers live 30 seconds to an hour
in the edge cache (§11) and in the browser while the page is open. The [record of
processing](../security/RoPA.md) has the Sentry and Cloudflare rows.

## 14. Tests

`test/sentry.test.ts`: the guards (the page, then the part, then the switch, each exactly; the
change needs the Issues part as well as `#triage`) and the route mapping; the value checks (issue
ids, cursors, line ids, typed words, the organisation); the masking and paths; the questions
(filters as parameters, Cloudflare asked only about our Workers and with `dry: true`, a thrown
error counted as an error); every builder (issues, the latest event with our own code first,
tags without `user`, open issue counts, this month's use, log counts, Cloudflare's lines and
counts, an answer in another shape said to be one); the client (refusals naming the permission,
Sentry's next page, the copies kept apart per reader); the page's words and addresses; and the
route with a fetch stub (401, 404, 403 for a part not given, 400 for an id or change that is not
one, 405, Refresh now behind its key, masking without See full details, the token's email never
passed on, Cloudflare's refusal naming Edit, a project asked by its id, a change sent to Sentry
and its audit row). `test/sentry-settings.test.ts`: the Settings part's guards and checks (a filter or key id
that is not one is refused), what is read of a project (no key secret, address or security
token), the change each setting asks Sentry for, the rows, defaults and history, the words of
every row, and the route with a fetch stub (401, 403, 400 for a project not ours, only Sentry's
rows read and changed, a value out of bounds and a stale version refused, putting back twice,
Sentry's own settings behind `#provider-write` and audited, a refusal naming `project:write`).
`test/sentry-stage2.test.ts`: switching a monitor needs the Monitors part and `#provider-write`;
a route name, a switch and a project Sentry would not name refused; the questions of Speed,
Trends and Monitors and alerts; every builder (routes masked, outside services named, a cache
read's found share only where Sentry is told, a request's steps by depth and the time none
covers, both periods per project and Worker, a Worker not ours left out, an up-time check without
its headers, body or owner, a heartbeat by its guid, an alert without its targets); the switch
each kind asks Sentry for; the words (a site that was down never at 100%); and the route with a
fetch stub (403, 400, a project asked by its id, nothing secret in the monitors' answer, a switch
sent to Sentry and its audit row, 405). `test/sentry-config.test.ts`: the portal's three
settings (their defaults the schema's, a value missing or out of bounds keeping what was held,
the browser's tag read back, read again at most once a minute and never twice at once, a failed
read keeping the values) and, over file text, that the Worker, the browser's Sentry and every
page shell use them. `test/sentry-stage3.test.ts`: the Releases and updates
part's key and route mapping; its two questions; a release read without its authors, owner, last
commit or data; a suggestion's kind, its project named by slug and its page kept only when
`https`; the words and the grouping by project; and the route with a fetch stub (403 before any
question, nothing of a person in the answer, only `GET`s sent). `test/sentry-console.test.ts`:
no list collapses `stats`, slices asked only by the Issues list, an issue's counts, age and slices
read, new today by when an issue began, the Overview's six figures in a fixed order with a dash and
its reason and links only to parts held, and the short ages. `test/sentry-console-look.test.ts`
(over file text): no glass, circles or blur; every `se-` class the parts use defined in
`sentry.css`; the tones in both themes; motion only on loading rows; no menu and one row of
options; the touch sizes; three, two or one columns without row spans; table heads only with
room; long lists the width of the page; Sentry, Server and Developer Tools drawn differently in
the sidebar, and `0087` as written. `test/action-keys-enforced.test.ts` checks that
`#triage`, `#refresh`, `#details`, `#sampling` and `#provider-write` are enforced.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-29 | The intro, §3, §4 and §14 for the console look and the counts, against `frame.tsx`, every part, `sentry.css`, both `.astro` pages, `issues.ts`, `overview.ts`, `trends.ts` and `NavIcon.tsx`; Sentry's issue search leaving out the seen stats when `stats` is collapsed, from Sentry's own serializer code; the `admin_pages` rows holding `bug` and `terminal` read through the D1 connector, and `0087` applied and read back; `test/sentry-console.test.ts` and `test/sentry-console-look.test.ts` pass | The page in a phone browser; the counts against a live answer from Sentry (the portal's token is not this session's); the rest of the document; `last_verified` left as it was |
| 2026-10-28 | The intro, §6's "What the portal sends" and §14 for the portal's own settings, against `src/lib/sentry-config.ts`, `src/workers/cf-entry.ts`, `sentry.client.config.ts`, the five page shells and `Settings.tsx`; `@sentry/cloudflare` 10.73.0's own code (`withSentry` makes the options from the callback on each invocation); the three rows read live through the D1 connector, and `sentry.cf_admin.traces` set from 0.3 to 0.1 with its history row (20:50 UTC) and read back; `test/sentry-config.test.ts` passes | The settings changed from the phone and seen in Sentry; the rest of the document |
| 2026-10-28 | §1, §2, §10, §11, §13 and §14 for Releases and updates, against the files in `related_code`; the sections after §9 renumbered (the old §10 to §13 are now §11 to §14, so the rows below name the old numbers). Sentry's releases and `sdk-updates` calls and their answers' shapes from Sentry's own source code (its endpoints and serializers); the `admin_pages` row read back after `0086` (D1 connector); `test/sentry-stage3.test.ts` passes | The part against a live answer from Sentry (the portal's token is not this session's; a reader in another shape says so, MAINTENANCE SE-10); the part in a phone browser |
| 2026-10-28 | §1, §2, §7 to §10, §12 and §13 for stage 2 (Speed, Trends, Monitors and alerts), against the files in `related_code`; the sections after §6 renumbered (the old §7 to §10 are now §10 to §13, so the rows below name the old numbers). Sentry's spans, `stats_v2`, issue search, up-time, heartbeat and alert calls and their answers' shapes from Sentry's own source code (its API endpoints and serializers); the website's `cache.get` span read in `cf-astro/src/middleware.ts` (no `cache.hit`); the three `admin_pages` rows read back after `0085` (D1 connector); `test/sentry-stage2.test.ts` passes | The three parts against a live answer from Sentry (the portal's token is not this session's; a reader in another shape says so); whether the token holds `alerts:read` and `alerts:write`; the parts in a phone browser |
| 2026-10-28 | §8's sentence on Control Plane's rows, against migration `0084` and its rows read back | The rest of the document; `last_verified` left as it was |
| 2026-10-28 | §8 after Control Plane was retired, against the five forwards in `src/pages/dashboard/control-plane/` and `test/control-plane-retired.test.ts` | The rest of the document; `last_verified` left as it was |
| 2026-10-28 | Written with the code: every section against the files in `related_code`. Live through the Sentry connector (counts only, no text of an error or log, no user value): the three projects, the open issues, the 30-day usage by category and outcome, the logs dataset counted by project and severity, `is:ignored` and `is:archived` both accepted; the six `admin_pages` rows read back after `0080` (D1 connector); `test/sentry.test.ts` passes. Cloudflare's query API's shapes and its Write permission from Cloudflare's API reference and SDK | Cloudflare's query live (refused until the token step, MAINTENANCE SE-1); the portal's own Sentry token's permissions (the Overview's check will say, SE-2); the page in a phone browser |
| 2026-10-28 | §1, §2, §6, §8 and §10 for the Settings part, against its files. Live: Sentry's rows of `service_config` read through the D1 connector (the ignored-errors row is missing, the rules per page set 90% and 50%), the three `admin_pages` rows read back after `0081`; Sentry's project, filter, key and spike-protection calls from Sentry's API reference; `test/sentry-settings.test.ts` passes | A change sent to Sentry live (the portal's token's `project:write` unknown, SE-2); the part in a phone browser |
| 2026-10-28 | §6's opening and `related_code` for the shared setting rows, against `SettingRows.tsx`, `settings-rows.ts`, `settings-routes.ts` and `src/pages/api/sentry/settings.ts` after they were split out for the PostHog page; `test/sentry-settings.test.ts` passes unchanged in what it checks | The rest of the document |

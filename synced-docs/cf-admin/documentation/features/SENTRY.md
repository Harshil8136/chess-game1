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
- src/components/admin/control-plane/useConfigEdit.ts
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
- src/pages/api/sentry/settings.ts
- src/lib/dal/ServiceConfigRepository.ts
- src/lib/control-plane/config-schema.ts
- src/lib/sentry/types.ts
- src/lib/health/workers.ts
- src/lib/auth/surface-guards.ts
- src/lib/schemas/operations.ts
- migrations/0080_sentry_page.sql
- migrations/0081_sentry_settings.sql
- test/sentry.test.ts
- test/sentry-settings.test.ts
related_docs:
- POSTHOG.md
- CONTROL-PLANE.md
- SYSTEM-HEALTH.md
- ../specs/2026-10-28-sentry-page.md
- ../records/reports/2026-10-28-sentry-page.md
- ../architecture/PERMISSIONS-SYSTEM.md
- ../security/SECURITY.md
- ../security/RoPA.md
- ../operations/OPERATIONS.md
tags: [feature, sentry, errors, issues, logs, cloudflare, permissions]
---

# Sentry — errors, logs and Sentry's own tools in the portal

> **TL;DR (non-technical):** A page in the sidebar, **Sentry**, that shows the errors of the
> portal, the website and the server without signing in to Sentry: how many are open, which are
> new or getting worse, this month's use of Sentry's free plan, and every log line our Workers
> wrote, read live from Cloudflare. An Admin can mark an issue fixed or archive it from the
> portal; the change is kept in the audit log. Email addresses, IP addresses and long tokens in
> any text are hidden unless you hold "See full details". Its Settings part holds how much the
> website sends to Sentry and Sentry's own filters, limits and spike protection, moved here from
> Control Plane with every change kept. Control Plane stays until its other tools have moved to
> their own pages.

Asked for by Harshil on 2026-10-28: "completely scrap `/dashboard/control-plane` and put sentry
systems there! for logs, analytics, trends, info, errors, permission based config changes and
updates available". His choices the same day: Cloudflare's logs are read live from Cloudflare
(its free plan cannot copy them to Sentry), and each of Control Plane's other tools moves to the
page that owns its subject. The plan, its stages and those choices are in the
[plan](../specs/2026-10-28-sentry-page.md); what shipped and how it was checked is in the
change record (private). This document describes stage 1:
the page, its permissions, the Overview, Issues (with resolving and archiving) and Logs; and the
Settings part, which took over Control Plane's Sentry settings the same day (§6). Speed, Trends,
Monitors and alerts are later stages (§8).

## 1. Who may do what

| Key | Name | Default | What it allows |
|---|---|---|---|
| `/dashboard/sentry` | Sentry | Admin (`super_admin`) | the page and its Overview |
| `/dashboard/sentry/issues` | Issues | Admin | the Issues part |
| `/dashboard/sentry/logs` | Logs | Admin | the Logs part |
| `/dashboard/sentry/settings` | Settings | Admin | the Settings part: every setting shown, none changed |
| `/dashboard/sentry#triage` | Resolve and archive issues | Admin | the Resolve, Reopen and Archive buttons on an issue (needs the Issues part too) |
| `/dashboard/sentry#refresh` | Refresh Sentry now | Admin | the Refresh button: ask Sentry and Cloudflare again instead of the kept copy |
| `/dashboard/sentry#sampling` | Change what is sent to Sentry | Admin | change the website's rows, the rules per page and the list of ignored errors, and put them back to their defaults (needs the Settings part too) |
| `/dashboard/sentry#provider-write` | Change Sentry's own settings | Owner | spike protection, the filters and the client keys' limits, in Sentry itself (needs the Settings part too) |
| `/dashboard/sentry#details` | See full details | Owner | error text, addresses and log lines unmasked (§9) |

The defaults are Control Plane's, so no one gains or loses access the day it ships.
`denySentry(user, part?, action?)` in `src/lib/auth/surface-guards.ts` asks for the page, then the
part, then the action, each exactly with `placRequireGrant` (fail-closed: a key not in a person's
map is refused, never inherited). The pages check it before any HTML is made, and the route
checks it again. `sentryCan(user)` tells the page which parts and buttons to offer, so it never
shows one the route would refuse. The rows are migrations `0080` and `0081` (Settings); the
[permissions model](../architecture/PERMISSIONS-SYSTEM.md) owns the rules.

## 2. Setting it up

The page uses what the portal already holds: `SENTRY_AUTH_TOKEN` against the organisation in
`SENTRY_ORG_SLUG`, and `CLOUDFLARE_API_TOKEN` with `CF_ACCOUNT_ID` for Cloudflare's logs. No
binding, secret or variable was added ([OPERATIONS.md](../operations/OPERATIONS.md) §5).

| Needs | For |
|---|---|
| Sentry `event:read` | the open issues, the Issues part, Sentry's log lines |
| Sentry `org:read` | this month's use (`stats_v2`) and the project list the filters ask by |
| Sentry `event:write` | resolving, reopening and archiving |
| Sentry `project:read` | Settings: a project's spike protection, filters and keys, and turning spike protection on or off |
| Sentry `project:write` | Settings: turning a filter on or off and setting a key's limit (the part says when the token lacks it) |
| Cloudflare "Workers Observability: Edit" | Cloudflare's log lines (Cloudflare's query accepts no lesser permission) |

The Overview's "What the portal's tokens can reach" card reads the Sentry token's own permissions
(only `auth.scopes` of Sentry's answer about the token, §9) and tries each read, and names any
permission still missing in Sentry's or Cloudflare's own words. A Sentry token cannot gain a
permission later: one that lacks `event:write` is replaced by a new token saved under the same
name. Without the Sentry token or organisation the page says "Sentry is not connected" instead of
failing; without the Cloudflare permission the Logs part and the Overview's log card say which
permission to add and the rest works (MAINTENANCE (private) SE-1, SE-2).

## 3. The Overview

`/dashboard/sentry`. In numbers: open issues (seen in the last 90 days), new today, getting worse
(Sentry's "escalating"), not caught by our code, Cloudflare's error lines and Sentry's log lines in
the last 24 hours; a figure opens its part when the person holds it. Then:

- **Errors each day:** the errors Sentry kept and turned away each of the last 14 days, and why
  any were turned away this month (filtered by a project's settings, over a limit or the quota,
  dropped by the app before sending, and Sentry's other reasons).
- **Open issues by project:** cf-admin (the portal), cf-astro (the website) and cf-vps (the
  server), each with its new and not-caught counts, opening the Issues part on that project.
- **Log lines, last 24 hours:** a table per source (Cloudflare per Worker, Sentry per project) of
  errors, warnings and the rest.
- **This month's use:** errors, spans and logs (by size) kept this month against the free plan's
  amounts (5,000 errors, 5 million spans, 5 GB of logs; Sentry's pricing page, read 2026-10-28),
  with any other kind Sentry counted this month; within it, near it (over 80%) or over it, in a
  glyph and a word. The page cannot read which plan the organisation is on, so the free plan's
  amounts are a mark to read the use against.
- **What the portal's tokens can reach** (§2), and **the parts open to you**.

## 4. Issues

`/dashboard/sentry/issues`. Every issue of the three projects seen in the last 24 hours, 14 days
(the default), 30 or 90 days; open (the default), resolved, archived or all; one project or
every one; last seen (the default), most often, newest or most people first; and words, searched
as one phrase. 25 at a time with "Show older issues" (Sentry's cursor), and how many match. Each
row: how many times, the title and where in the code, the project, the level, "Not caught", the
state when it is worth saying, how many people, when last seen, and Sentry's short id.

Opening one (`?i=<id>`, so Back closes it): its state, level, counts, first and last seen and the
releases; **the latest time it happened**: the error and its message, when, whether our code
caught it, the request, release, environment, runtime, browser and system and Sentry's SDK, where
in the code (at most 12 frames, our own code first, newest call first, with our own code's line),
and the tags worth showing (environment, release, transaction, page, handled, mechanism, level,
runtime, browser, system, device, server); **what happened before**, the last 20 steps Sentry
kept; and "Open in Sentry" (only an address on `*.sentry.io`).

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
with each change in the list of changes.

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
- **What the portal sends:** cf-admin's three Sentry rows, shown but not offered, since nothing
  in the portal reads them yet (a later stage).
- **Changes:** which settings differ from their defaults, the last 20 changes of Sentry's rows
  (who, when, why), and "Put them back to the defaults" behind a confirmation. Putting back
  touches only Sentry's rows, and a second time changes nothing.

`GET /api/sentry/settings` reads the rows with `getConfigByService('sentry')` and their history;
`?project=` reads one project's own settings from Sentry (two questions at a time, the token's
permissions from their kept copy, §7). `PATCH` changes one row: only Sentry's rows, the bounds
and types of `src/lib/control-plane/config-schema.ts`, and the row's `version`, so a change made
elsewhere in between is refused (409) and the screen reads the latest. `POST` puts the rows back
(`#sampling`) or changes one of Sentry's own settings (`#provider-write`). Every change is in
the audit log (`config_change` or `provider_write`), at most 20 a minute per person, and a row
change asks the website to re-read its settings. Control Plane's Sentry tab keeps working until
its pages lead here (§8).

## 7. Where each part reads from, and staying inside the limits

The route is `GET /api/sentry/{part}` (`overview`, `issues`, `logs`), with `fresh=1` for Refresh
now, and `POST /api/sentry/issues` for a change; [SECURITY.md](../security/SECURITY.md) §6a holds
their rows.

| Part | Read from |
|---|---|
| Overview | Sentry: the token itself (`GET /api/0/`, for its permissions), the open issues (`/organizations/{org}/issues/`, up to 100, with `X-Hits` for more), this month's use (`stats_v2`, 31 days by category and outcome), Sentry's log lines counted by project and severity (`events/?dataset=logs`); Cloudflare: the last 24 hours counted by Worker and level (the query API's `calculations` view) |
| Issues | the list (`/organizations/{org}/issues/`), one issue (`…/issues/{id}/`) and its latest event (`…/issues/{id}/events/latest/`) side by side; the project ids (`/organizations/{org}/projects/`, kept an hour) when a project is chosen |
| Logs | Cloudflare's query API (`events` view) or Sentry's `events/?dataset=logs` |

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
  asks two at once for one issue; inside the Worker's six open connections.
- **Short copies** in the Worker's own edge cache (the PostHog page's Cache API helper, no
  binding, nothing in D1): log lines for 30 seconds, a list for a minute, one issue for five, the
  Overview for ten, the token's permissions and the project list for an hour. A read that failed
  is kept 20 seconds, and one Sentry asked us to wait on is not kept. Each copy is kept apart for
  readers with and without See full details. A change drops that issue's copies.
- **CPU.** Sentry and Cloudflare count, sort and search; the Worker checks values, builds the
  question and reshapes at most 100 rows. Reading never counts against Sentry's allowance: only
  sending does, and this page sends nothing to it.

## 8. Control Plane: what moves where

Control Plane ("Cloud Services" in the sidebar) stays as it is until its tools have moved, then
its pages lead to the new places and, in a later push, its rows are switched off
([plan](../specs/2026-10-28-sentry-page.md) §2 and §8):

| Control Plane today | Goes to | State |
|---|---|---|
| Sentry tab: counts, top issues, resolve or ignore | this page's Overview and Issues | shipped (stage 1) |
| Sentry's settings and controls (sampling, rules, filters, key limits, spike protection) | the Settings part (§6; `#sampling` Admin, `#provider-write` Owner) | shipped (2026-10-28) |
| PostHog tab: session recording on or off | the PostHog page | next |
| The website's request limits; Cloudflare's cache purge and security level | Configuration | next |
| The Overview's six figures; the Supabase tab | dropped: the Overview, Analytics and System health show them | with the move |

## 9. Privacy

An error's message, a breadcrumb or a log line can quote what a person typed or who they are: a
guest's email on a booking, a staff member's address, an IP address, a token in an address
(`src/lib/sentry/privacy.ts`). Unless the reader holds See full details:

- email addresses and phone numbers become "[email]" and "[phone]" (the PostHog page's masking),
  IP addresses "[ip]", and anything shaped like a key or session id (24 or more letters and
  digits with both in it) "[token]";
- addresses keep only their path, never what follows `?` or `#`; a file name in a stack frame
  keeps its path but not its query.

With or without it, Sentry's `user` of an event is never read, nor anything but `auth.scopes` of
Sentry's answer about the token (which also names the token's owner); a library's line of code
is not passed on, only our own; and texts are cut at 2,000 characters. Nothing is stored: answers
live 30 seconds to an hour in the edge cache (§7) and in the browser while the page is open. The
[record of processing](../security/RoPA.md) has the Sentry and Cloudflare rows.

## 10. Tests

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
`test/action-keys-enforced.test.ts` checks that `#triage`, `#refresh`, `#details`, `#sampling`
and `#provider-write` are enforced.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-28 | Written with the code: every section against the files in `related_code`. Live through the Sentry connector (counts only, no text of an error or log, no user value): the three projects, the open issues, the 30-day usage by category and outcome, the logs dataset counted by project and severity, `is:ignored` and `is:archived` both accepted; the six `admin_pages` rows read back after `0080` (D1 connector); `test/sentry.test.ts` passes. Cloudflare's query API's shapes and its Write permission from Cloudflare's API reference and SDK | Cloudflare's query live (refused until the token step, MAINTENANCE SE-1); the portal's own Sentry token's permissions (the Overview's check will say, SE-2); the page in a phone browser |
| 2026-10-28 | §1, §2, §6, §8 and §10 for the Settings part, against its files. Live: Sentry's rows of `service_config` read through the D1 connector (the ignored-errors row is missing, the rules per page set 90% and 50%), the three `admin_pages` rows read back after `0081`; Sentry's project, filter, key and spike-protection calls from Sentry's API reference; `test/sentry-settings.test.ts` passes | A change sent to Sentry live (the portal's token's `project:write` unknown, SE-2); the part in a phone browser |

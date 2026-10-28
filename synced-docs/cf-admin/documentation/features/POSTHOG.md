---
title: "PostHog — PostHog's own tools in the portal"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-10-28
verified_against: [code, infra]
owner: harshil
related_code:
- src/pages/dashboard/posthog/index.astro
- src/pages/dashboard/posthog/[part].astro
- src/pages/api/posthog/[part].ts
- src/components/dashboard/posthog/PostHog.tsx
- src/components/dashboard/posthog/Recordings.tsx
- src/components/dashboard/posthog/Errors.tsx
- src/components/dashboard/posthog/People.tsx
- src/components/dashboard/posthog/shared.tsx
- src/components/dashboard/posthog/format.ts
- src/styles/pages/posthog.css
- src/lib/posthog/client.ts
- src/lib/posthog/cache.ts
- src/lib/posthog/sql.ts
- src/lib/posthog/privacy.ts
- src/lib/posthog/names.ts
- src/lib/posthog/overview.ts
- src/lib/posthog/recordings.ts
- src/lib/posthog/errors.ts
- src/lib/posthog/people.ts
- src/lib/posthog/types.ts
- src/lib/auth/surface-guards.ts
- migrations/0079_posthog_page.sql
- test/posthog.test.ts
related_docs:
- ANALYTICS.md
- ../specs/2026-10-28-posthog-page.md
- ../records/reports/2026-10-28-posthog-page.md
- ../architecture/PERMISSIONS-SYSTEM.md
- ../security/SECURITY.md
- ../security/RoPA.md
- ../operations/OPERATIONS.md
tags: [feature, posthog, recordings, errors, events, permissions]
---

# PostHog — PostHog's own tools in the portal

> **TL;DR (non-technical):** A page in the sidebar, **PostHog**, that shows what PostHog collects
> about the website without signing in to PostHog: every recorded visit and what happened in it,
> the errors visitors hit and where in the code, everything visitors do as it arrives, every
> visitor, and how much of PostHog's free allowance this month has used. Each part is a
> permission of its own. Visitors show as short made-up names ("Visitor 3f2a9c") unless you hold
> "See who visitors are", and email addresses and phone numbers are hidden in any text the page
> shows. Everything is read live from PostHog and kept for a minute or two, so opening a page
> twice costs PostHog nothing the second time.

Asked for by Harshil on 2026-10-28: "a page like PostHog where everything from PostHog is
accessed by API like session recording, features, DOM manipulation, logs, analytics", within
Cloudflare's and PostHog's limits, with permissions, sub-pages and information. The plan, its
stages and Harshil's choices are in the [plan](../specs/2026-10-28-posthog-page.md); what shipped
and how it was checked is in the change record (private).
This document describes stage 1: the page, its permissions, the Overview, Recordings (the list and
one recording's moments), Errors (read only) and Events and people. Playing a recording inside the
portal, heatmaps, flags, experiments, surveys, insights and activity are later stages; Harshil
chose on 2026-10-28 not to send logs to PostHog, so there is no Logs part.

## 1. Who may do what

| Key | Name | Default | What it allows |
|---|---|---|---|
| `/dashboard/posthog` | PostHog | Manager (`admin`) | the page and its Overview |
| `/dashboard/posthog/recordings` | Recordings | Admin (`super_admin`) | the Recordings part; a recording shows the text a guest saw, their own details on the booking summary included |
| `/dashboard/posthog/errors` | Errors | Manager | the Errors part |
| `/dashboard/posthog/people` | Events and people | Manager | the Events and people part |
| `/dashboard/posthog#people` | See who visitors are | Owner | PostHog's own id for a visitor (a guest's email after a booking) instead of the made-up name, everywhere on the page |
| `/dashboard/posthog#refresh` | Refresh PostHog now | Manager | the Refresh button: ask PostHog again instead of the kept copy |

`denyPostHog(user, part?, action?)` in `src/lib/auth/surface-guards.ts` asks for the page, then
the part, then the action, each exactly with `placRequireGrant` (fail-closed: a key not in a
person's map is refused, never inherited). The pages check it before any HTML is made, and
`GET /api/posthog/{part}` checks it again. `posthogCan(user)` tells the page which parts and
switches to offer, so it never shows a link or button the route would refuse. The rows are
migration `0079`; the [permissions model](../architecture/PERMISSIONS-SYSTEM.md) owns the rules.

## 2. Setting it up

The page uses the key the portal already holds, `POSTHOG_PERSONAL_API_KEY`, against the project
in `POSTHOG_PROJECT_ID` (else `PUBLIC_POSTHOG_PROJECT_ID`), on PostHog's US app host. Every number
and list needs the key's **Query: Read** permission; the free allowance needs **Billing: Read**
and the organisation (`POSTHOG_ORG_ID`, else the one PostHog names for the project, which needs
**Project: Read**). The Overview's "What the portal's key can reach" card tries each product with
its cheapest read and names any permission still missing in PostHog's own words (Session
recording, Error tracking, Feature flag, Experiment, Survey, Insight, Activity log: Read); those
are for later stages and nothing in stage 1 fails without them. Without the key or the project the
page says "PostHog is not connected" instead of failing.

## 3. The parts

**Overview** (`/dashboard/posthog`). The last 30 days in numbers: events, visitors, visits,
recordings, open error groups, and how many feature flags, experiments and surveys are set up in
PostHog; a figure opens its part when the person holds it. The free allowance this month: each
product PostHog bills by (events, recordings, errors, flag requests, survey answers, logs) as used
against its free amount, with PostHog's projection for the month as a thin mark and the state in
a glyph and a word (within it, heading over it, over it). What the portal's key can reach (§2).
The parts this person may open.

**Recordings** (`/dashboard/posthog/recordings`). Every recorded visit of the last 24 hours, 7
days (the default) or 30 days, newest first, 50 at a time with "Show older recordings": when,
how long and how long active, the page it started on and how many more, the device, browser and
country, the visitor, and marks for errors, stuck taps (quick repeated taps, or taps and swipes
that did nothing), reaching booking and having said who they are. Switches in a sideways row keep
only visits with errors, with stuck taps, over a minute active, on a phone, or that reached
booking; any number may be on. Opening one (`?r=<id>`, so Back closes it and a link from Errors or
Events opens it) shows the visit's facts and **what happened, in order**: every page, tap, stuck
tap, booking step, error, speed reading and console message at its place in the recording, at
most 500, with a sideways row to show only pages, taps, problems or the console. "Play it in
PostHog" opens the recording on PostHog's site with the viewer's own PostHog sign-in; playing it
inside the portal waits on Harshil's choice of player (the plan's §10). What a visitor types in a
form is hidden in the recording itself (`maskAllInputs` in cf-astro's PostHog setup).

**Errors** (`/dashboard/posthog/errors`). PostHog's error groups, open (the default), marked
fixed, ignored or all, each with its count in the sideways row; for the last 30 (default), 90 or
180 days, how many times each happened, to how many people, and when last; seen most recently
first, the ones not seen in the period after. Opening one (`?e=<id>`) shows its state and counts,
a link to it in PostHog, and its latest 8 occurrences: when, the page, device, browser and system,
the visitor, the message, and where in the code it broke, newest call first, the website's own
code marked; "Watch this visit" opens the visit's recording when PostHog still keeps one and the
person holds Recordings. Changing an error's state from the portal is stage 3.

**Events and people** (`/dashboard/posthog/people`). Two tabs. **Live events**: everything
visitors did in the last 30 days, newest first, 100 at a time, by kind (everything, pages, taps,
stuck taps, booking, errors) with each kind's 30-day count; while the tab is on screen and no
older page is open it asks again every minute. A row's camera button opens the visit's recording
for a person who holds Recordings. **Visitors** (`?tab=visitors`): how many visited in the last 30
days and how many have said who they are, then every visitor, last seen first, 50 at a time, with
their visits, events, first and last visit, country and device.

When PostHog asks to wait (§5), the part says so and asks again by itself once, after that wait
(at most 10 seconds); a read that failed for another reason offers "Try again"; a missing
permission says which one to add.

## 4. Where each part reads from

Every read is one HogQL question to PostHog's query API (`POST /api/projects/{id}/query/`) unless
named otherwise; the tables were confirmed through the PostHog connector on 2026-10-28.

| Part | Read from |
|---|---|
| Overview | one question over `events`, `session_replay_events` and PostHog's `system.error_tracking_issues`, `system.feature_flags`, `system.experiments` and `system.surveys`; the project (`/api/projects/{id}/`); the organisation's billing (`/api/organizations/{org}/billing/`); one `?limit=1` read per product for the key check |
| Recordings | `session_replay_events` grouped per recording, joined to the visit's `events` for device, browser, country, pages, stuck taps and booking; one recording's moments from `events` and `console_logs_log_entries` in one question |
| Errors | `system.error_tracking_issues` joined to the period's `$exception` events; the occurrences from `$exception` events, with whether `session_replay_events` still holds the visit |
| Events and people | `events`, for the list and for the counts per kind; visitors grouped by person from `events` |

Nothing a person sends can change a question (`src/lib/posthog/sql.ts`): a recording, visit or
error id must be a UUID (anything else is a 400 before a question is built), a time to page from
must hold only a time's characters and parse as a date, and a range, filter, kind, state or tab
that is not one of its listed values falls back to the default. Lists page by time (the last
row's time as `before`), never by offset.

## 5. Staying inside the limits

The route is `GET /api/posthog/{part}` (`overview`, `recordings`, `errors`, `people`), with
`fresh=1` for Refresh now; [SECURITY.md](../security/SECURITY.md) §6a holds its row.

- **One way to PostHog** (`src/lib/posthog/client.ts`). Every call has 9 seconds. A 5xx, a dropped
  connection, or a 429 asking for at most 2 seconds is asked once more in the Worker; a longer
  wait (PostHog's `Retry-After`, 1 to 60 seconds) goes back to the page, which asks again by itself.
  A question PostHog refuses as malformed (400) is logged with PostHog's reason, since it is this
  code's fault.
- **Few questions at once.** A part sends at most two questions in parallel (PostHog allows three
  at once per project for its query API, and 240 a minute, 2,400 an hour); the Overview's product
  checks run four at a time, beside its two first reads, inside the Worker's six open connections.
- **Short copies** (`src/lib/posthog/cache.ts`) in the Worker's own edge cache (the Cache API, no
  binding, nothing in D1): a list for a minute; the Overview for ten minutes; the product checks
  for an hour; one recording for a minute, then a day once it is a day old and PostHog no longer
  changes it; one error for five minutes. A read that failed is kept 20 seconds, and one PostHog
  asked us to wait on is not kept. Each copy is kept separately for readers with and without See
  who visitors are, so a copy that names visitors is never handed to someone who may not see them.
  With the copies and the live list's one-minute pace, the page's use of PostHog's allowance stays
  a few questions a minute however many people watch.
- **CPU.** The Worker only checks values, builds the question text and reshapes at most 501 rows;
  the counting is PostHog's. Nothing is read whole: a recording's snapshots are never fetched.

## 6. Privacy

The website tells PostHog a guest's email when they book, so PostHog's id for a visitor and some
of its text can name a person (`src/lib/posthog/privacy.ts`):

- Unless the reader holds See who visitors are, the question does not ask PostHog for its id for
  a visitor at all; each visitor is named by a short name made from PostHog's own person id
  ("Visitor 3f2a9c"), the same in every part, so one visitor can be followed without being named.
  Whether they have said who they are is computed inside PostHog and passed on as yes or no.
- Every text the page passes on (a tapped button's words, an error message, a console message)
  has email addresses and phone numbers replaced by "[email]" and "[phone]".
- Addresses keep only their path, never what follows `?` or `#`.
- Nothing is stored: answers live a minute to a day in the edge cache (§5) and in the browser
  while the page is open. The [record of processing](../security/RoPA.md) has the PostHog row.

## 7. Tests

`test/posthog.test.ts`: the guards (the page, then the part, then the switch, each exactly) and
the route mapping; the value checks and quoting; the visitor names, masking and paths; the
questions (PostHog's id for a visitor asked for only with `#people`, paging by time, the
switches, quoted ids); every builder (recordings, moments, error groups and frames, events,
visitors, the counts, the allowance and the product checks); the client (what to set, the
permission a refusal names, a second try after a 5xx, a long wait handed back); the page's words;
and the route with a fetch stub (401, 404, 403 for a part not given, 400 for an id that is not an
id, Refresh now behind its key, the id for a visitor only for a reader who may see it, the short
copy answering a second look and Refresh asking again, "not connected" without the key).
`test/action-keys-enforced.test.ts` checks that `#people` and `#refresh` are enforced.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-28 | Written with the code: every section against the files in `related_code`. Live through the PostHog connector, counts and lengths only (no person-level value read): the Overview's question (1,146 events, 64 visitors, 90 visits and 71 recordings in the last 30 days, 7 open error groups, no flags, experiments or surveys), the recordings list and moments questions, the error groups (10 returned) and occurrences questions, the events (49 stuck taps), kinds and visitors (51 rows, 64 and 2) questions all run; the six `admin_pages` rows read back after `0079` (D1 connector); `test/posthog.test.ts` passes | The portal's own key's permissions (only Query: Read is proven, by the Analytics page; the Overview's checks will say); the page in a phone browser |

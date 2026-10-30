---
title: "PostHog — PostHog's own tools in the portal"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-10-29
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
- src/components/dashboard/posthog/Settings.tsx
- src/components/dashboard/posthog/shared.tsx
- src/components/dashboard/posthog/frame.tsx
- src/components/dashboard/posthog/charts.tsx
- src/components/dashboard/posthog/now.tsx
- src/components/dashboard/posthog/insights.tsx
- src/components/dashboard/posthog/story.ts
- src/components/dashboard/posthog/metrics.ts
- src/components/dashboard/posthog/replay/Player.tsx
- src/components/dashboard/posthog/replay/buffer.ts
- src/components/dashboard/posthog/replay/events.ts
- src/components/dashboard/posthog/format.ts
- src/styles/pages/posthog.css
- src/lib/posthog/client.ts
- src/lib/posthog/cache.ts
- src/lib/posthog/sql.ts
- src/lib/posthog/privacy.ts
- src/lib/posthog/names.ts
- src/lib/posthog/overview.ts
- src/lib/posthog/board.ts
- src/lib/posthog/replay.ts
- src/pages/api/posthog/replay.ts
- src/lib/posthog/recordings.ts
- src/lib/posthog/errors.ts
- src/lib/posthog/people.ts
- src/lib/posthog/types.ts
- src/lib/posthog/settings.ts
- src/pages/api/posthog/settings.ts
- src/lib/control-plane/settings-rows.ts
- src/lib/control-plane/settings-routes.ts
- src/components/admin/control-plane/SettingRows.tsx
- src/styles/components/setting-rows.css
- src/lib/auth/surface-guards.ts
- migrations/0079_posthog_page.sql
- migrations/0082_posthog_settings.sql
- test/posthog.test.ts
- test/posthog-settings.test.ts
- test/posthog-lab.test.ts
- test/posthog-lab-look.test.ts
- test/posthog-replay.test.ts
related_docs:
- ANALYTICS.md
- ../specs/2026-10-28-posthog-page.md
- ../specs/2026-10-29-posthog-lab.md
- ../specs/2026-10-30-posthog-insights.md
- ../records/reports/2026-10-29-posthog-lab.md
- ../records/reports/2026-10-30-posthog-insights.md
- ../records/reports/2026-10-28-posthog-page.md
- ../records/reports/2026-10-28-posthog-settings.md
- CONTROL-PLANE.md
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
> twice costs PostHog nothing the second time. Since 2026-10-29 the page is an analytics lab:
> each figure has its change against the 30 days before and a chart of its days, and a recorded
> visit plays inside the portal, loading while it plays like a video. Its **Settings** part, moved from Control Plane,
> says what the website sends to PostHog and whether PostHog records visits, and lets the people
> who hold its switches change them.

Asked for by Harshil on 2026-10-28: "a page like PostHog where everything from PostHog is
accessed by API like session recording, features, DOM manipulation, logs, analytics", within
Cloudflare's and PostHog's limits, with permissions, sub-pages and information. The plan, its
stages and Harshil's choices are in the [plan](../specs/2026-10-28-posthog-page.md); what shipped
and how it was checked is in the change record (private).
This document describes stage 1: the page, its permissions, the Overview, Recordings (the list and
one recording's moments), Errors (read only) and Events and people. It also describes Settings, which
Harshil moved here from Control Plane on 2026-10-28 ("each to the page that owns it"; the
[Sentry page's plan](../specs/2026-10-28-sentry-page.md) §8, and the
change record (private)). On 2026-10-29 every part was
redrawn and recordings play inside the portal, Harshil's answer to the plan's player question
("REAL video buffering inside browser"): the look, the charts, the board and the player are the
[analytics lab](../specs/2026-10-29-posthog-lab.md), and the
change record (private) says what shipped. Heatmaps, flags,
experiments, surveys, insights and activity are later stages; Harshil chose on 2026-10-28 not to
send logs to PostHog, so there is no Logs part.

## 1. Who may do what

| Key | Name | Default | What it allows |
|---|---|---|---|
| `/dashboard/posthog` | PostHog | Manager (`admin`) | the page and its Overview |
| `/dashboard/posthog/recordings` | Recordings | Admin (`super_admin`) | the Recordings part; a recording shows the text a guest saw, their own details on the booking summary included |
| `/dashboard/posthog/errors` | Errors | Manager | the Errors part |
| `/dashboard/posthog/people` | Events and people | Manager | the Events and people part |
| `/dashboard/posthog/settings` | Settings | Admin (`super_admin`) | the Settings part: what the website sends to PostHog, PostHog's own recording setting, the last changes |
| `/dashboard/posthog#people` | See who visitors are | Owner | PostHog's own id for a visitor (a guest's email after a booking) instead of the made-up name, everywhere on the page |
| `/dashboard/posthog#refresh` | Refresh PostHog now | Manager | the Refresh button: ask PostHog again instead of the kept copy |
| `/dashboard/posthog#sampling` | Change what is sent to PostHog | Admin | change the website's PostHog settings, and put them back to their defaults |
| `/dashboard/posthog#provider-write` | Change PostHog's own settings | Owner | turn PostHog's recordings on or off and set the share of visits it records, in PostHog |

`denyPostHog(user, part?, action?)` in `src/lib/auth/surface-guards.ts` asks for the page, then
the part, then the action, each exactly with `placRequireGrant` (fail-closed: a key not in a
person's map is refused, never inherited). The pages check it before any HTML is made, and
`GET /api/posthog/{part}` checks it again. `posthogCan(user)` tells the page which parts and
switches to offer, so it never shows a link or button the route would refuse. The rows are
migrations `0079` and `0082` (Settings and its two switches, which take over Control Plane's
"Change sampling rates" and "Change provider settings" for PostHog); the
[permissions model](../architecture/PERMISSIONS-SYSTEM.md) owns the rules.

## 2. Setting it up

The page uses the key the portal already holds, `POSTHOG_PERSONAL_API_KEY`, against the project
in `POSTHOG_PROJECT_ID` (else `PUBLIC_POSTHOG_PROJECT_ID`), on PostHog's US app host. Every number
and list needs the key's **Query: Read** permission; the free allowance needs **Billing: Read**
and the organisation (`POSTHOG_ORG_ID`, else the one PostHog names for the project, which needs
**Project: Read**). The Overview's "What the portal's key can reach" card tries each product with
its cheapest read and names any permission still missing in PostHog's own words (Session
recording, Error tracking, Feature flag, Experiment, Survey, Insight, Activity log: Read); those
are for later stages, except Session recording: Read, which playing a recording needs (since
2026-10-29; without it Play says so and the rest of the page works). Settings reads PostHog's own
recording setting with **Project: Read** and changes it only with **Project: Write**; without it,
a change is refused with that permission's name and nothing else on the part stops working.
Without the key or the project the page says "PostHog is not connected" instead of failing.

## 3. The parts

**Overview** (`/dashboard/posthog`), the board ([the lab](../specs/2026-10-29-posthog-lab.md) §4;
what it says, [the insights](../specs/2026-10-30-posthog-insights.md) §3), its days and hours
counted in the viewer's own time zone. Ten figures for the last 30 days: visitors, visits, page
views, visit length, the share of visits that left at once (one page, nothing tapped, under 10
seconds), visits that opened booking, bookings sent, recordings, errors and events, each
counting up to its value, with its change against the 30 days before (in points for the share;
a rise in errors or in leaving at once in red, other rises in green, always with an arrow and a
word) and a small line of its days; a figure opens its part when the person holds it. **In
plain words**: up to eleven sentences made from the board's numbers (who came and how many more
or fewer, from where, how long they stayed, the booking form's steps and the one that loses the
most people, stuck taps, errors, where visitors went after the top page, phone speed, the phone
share and the busiest time), each with a state mark and, when the person holds the part, a link
to the recordings or errors behind it; its tab **What the figures mean** explains every figure in
a sentence and says only visitors who allowed analytics cookies are counted. **Right now**:
events each minute of the last 30 minutes and visitors in the last 5, the last 24 hours in a
sentence, when a page was last opened, and the pages opened in the last 30 minutes, asked again
every 30 seconds while the page is on screen. A large chart of any figure, chosen in a row above
it, day by day with the 30 days before as a dashed line, a readout on touch, hover or the arrow
keys, and "Table" for every day in numbers. **From visit to booking**: people who reached each
of the booking form's six steps (the Analytics page's own steps), with "Watch visits that opened
booking and did not send". **Where visitors go next**: for each of the top pages, the share that left the
website from it and the pages opened next; "Whole visits", the most common ways through the
website, four pages at most. **How visitors found the website**, by kind of source (with each
kind's share that left at once and its visit length) or by website. **When visitors come**:
visits by weekday and hour, the busiest named. Devices by kind, browser or system; the top pages
with how far down half their readers scrolled; **where visitors got stuck** (taps that did
nothing, and errors, by page, with a link to those recordings); **what visitors tap**, by the
words on the button or link; **where visitors are**, by country (with flags) or by state; **how
fast pages are**, per kind of device, four speed readings at 3 in 4 visits, each marked good,
needs work or slow against Google's limits; and the top events, each with what it is. The free
allowance this month: each product PostHog bills by (events, recordings, errors, flag requests,
survey answers, logs) as used against its free amount, with PostHog's projection for the month
as a thin mark and the state in a glyph and a word (within it, heading over it, over it). What
the portal's key can reach (§2), with how many error groups are open and how many flags,
experiments and surveys are set up in PostHog now.

**Recordings** (`/dashboard/posthog/recordings`). Seven figures for the list shown (recordings,
average length, the share of time active, how many had errors, stuck taps or reached booking,
and how many of those sent a booking), a line on how to find the visits worth watching first,
then every recorded visit of the last 24 hours, 7
days (the default) or 30 days, newest first, 50 at a time with "Show older recordings": when,
how long and how long active, the page it started on and how many more, what the visitor did in
a sentence ("Opened 3 pages, tapped 12 times and typed in a form; opened booking but did not
send it", since 2026-10-30), the device, browser and country, the visitor, and marks for
errors, stuck taps (quick repeated taps, or taps and swipes that did nothing), booking sent or
not sent, and having said who they are. Switches in a sideways row keep
only visits with errors, with stuck taps, over a minute active, on a phone, that reached
booking, or that opened booking and did not send it ("Booking not sent", since 2026-10-30); any
number may be on. Opening one (`?r=<id>`, so Back closes it and a link from Errors or
Events opens it) shows the visit in that sentence, its facts (booking among them: not opened,
opened and not sent, or sent) and **what happened, in order**: every page, tap, stuck
tap, booking step, error, speed reading and console message at its place in the recording, at
most 500, with a sideways row to show only pages, taps, problems or the console. **The
recording plays on the page** (since 2026-10-29; [the lab](../specs/2026-10-29-posthog-lab.md)
§5): Play loads the player and the recording together, it starts with its first picture, the
rest loads while it plays (at most three minutes ahead), and it waits with a spinner when it
catches up with what has loaded, then goes on by itself. The timeline shows what has played,
what has loaded and a mark for each error, stuck tap, page and booking step; speeds 1×, 2×, 4×
and 8×; idle time skipped unless "Skip idle time" is switched off; full screen where the
browser allows it. What happened sits beside the
player as tall as it (under it on a phone), the moment on screen lit; tapping one jumps there.
`&at=<time>` in the address opens the recording at that moment. "In PostHog" still opens it on
PostHog's site with the viewer's own sign-in. What a visitor types in a
form is hidden in the recording itself (`maskAllInputs` in cf-astro's PostHog setup).

**Errors** (`/dashboard/posthog/errors`). **In plain words** (since 2026-10-30): how many errors
happened in the period and of how many kinds, whether more or fewer happened in its second half
than its first, the most common one with how many times and to how many people, and how many
groups are open. A chart of every group's errors over the period in 30
bars (a day each over 30 days, three over 90, six over 180) with the total, the groups seen and
the busiest bar. PostHog's error groups, open (the default), marked
fixed, ignored or all, each with its count in the sideways row and what the state means, as
PostHog documents it (a group marked fixed opens again by itself when it happens again; PostHog
drops new errors of an ignored group); for the last 30 (default), 90 or
180 days, how many times each happened, to how many people, and when last, with a small line of
its 30 bars; seen most recently
first, the ones not seen in the period after. Opening one (`?e=<id>`) shows its state and counts,
a link to it in PostHog, and its latest 8 occurrences, summed up in a sentence (on what devices,
and on which page and in which browser most), then each: when, the page, device, browser and system,
the visitor, the message, and where in the code it broke, newest call first, the website's own
code marked; "Watch this moment" opens the visit's recording at the time of that occurrence when
PostHog still keeps one and the person holds Recordings. Changing an error's state from the portal is stage 3.

**Events and people** (`/dashboard/posthog/people`). Two tabs. **Live events**: Right now (as on
the Overview), then everything
visitors did in the last 30 days, newest first, 100 at a time, by kind (everything, pages, taps,
stuck taps, booking, errors) with each kind's 30-day count and a line on what the kind is; while
the tab is on screen and no
older page is open it asks again every minute. A row's camera button opens the visit's recording at that
event for a person who holds Recordings. **Visitors** (`?tab=visitors`): how many visited in the last 30
days, their visits together and on average, how many came back more than once and how many have
said who they are, the same in plain sentences, then every visitor, last seen first, 50 at a time, with
their visits, events, first and last visit, country and device.

**Settings** (`/dashboard/posthog/settings`). Three cards, the same setting rows as the Sentry
page's Settings ([SENTRY.md](SENTRY.md) §6), with a box for why a change is made, kept with it:

- **What the website sends**: PostHog's rows in `service_config`, which the website reads from the
  shared database within a minute (and at once, since the portal asks it to read them again after
  a change): send to PostHog at all, count page visits, count taps and forms, and record visits.
  Each is on or off in a sideways row, with its default beside it. The website's own "share of
  visits recorded" row (`posthog.session_recording.sample_rate`) is shown and never offered: the
  website reads it into its settings but nothing there uses it; whether a visit is recorded
  follows the on/off row or a rule per page (`cf-astro/src/scripts/analytics-loader.ts` and
  `cf-astro/src/lib/route-policy.ts`, read on its `main`, 53b1bd7, on 2026-10-28), so the share
  that counts is PostHog's own, in the next card. A rule per
  page on the Sentry page's Settings can count visits, taps or recordings differently for its pages.
- **PostHog's own recording setting**, read from the project when the part opens and never kept:
  whether PostHog keeps recordings (`session_recording_opt_in`) and the share of visits it records
  (`session_recording_sample_rate`, "0.01" to "1.00", none meaning every visit), as two sideways
  rows (10, 25, 50, 80 or 100%, and the current share when it is none of these). Changing either
  sends exactly those two fields to PostHog and is kept in the audit log (`provider_write`). On
  2026-10-28 PostHog kept recordings, of every visit. Control Plane's PostHog tab, removed the same
  day, set its share in `session_replay_config` instead, which PostHog does not sample by, and
  found its project by taking the first one the key could list; this part uses the configured
  project and PostHog's own field (formerly MAINTENANCE PH-2 and DOC-2, closed with Control
  Plane's retirement, [CONTROL-PLANE.md](CONTROL-PLANE.md)).
- **What differs from the defaults, and the last 20 changes**, with who made each and why, and
  "Put PostHog's settings back", which asks first in a dialog and changes only PostHog's rows.

When PostHog asks to wait (§5), the part says so and asks again by itself once, after that wait
(at most 10 seconds); a read that failed for another reason offers "Try again"; a missing
permission says which one to add.

## 4. Where each part reads from

Every read is one HogQL question to PostHog's query API (`POST /api/projects/{id}/query/`) unless
named otherwise; the tables were confirmed through the PostHog connector on 2026-10-28.

| Part | Read from |
|---|---|
| Overview | one question over `events`, `session_replay_events` and PostHog's `system.error_tracking_issues`, `system.feature_flags`, `system.experiments` and `system.surveys`; the project (`/api/projects/{id}/`); the organisation's billing (`/api/organizations/{org}/billing/`); one `?limit=1` read per product for the key check; the board, two questions asked one after the other (`src/lib/posthog/board.ts`): the counts over `events`, `sessions` and `session_replay_events` in 15 parts (`boardQuery`), then the paths over `events` in 6 parts (`PATHS_QUERY`: the booking steps by `windowFunnel`, each visit's pages in order, stuck taps and errors per page, tapped words, speed readings); right now, one question over the last 30 minutes, the last day and the last 7 days of `events` |
| Recordings | `session_replay_events` grouped per recording, joined to the visit's `events` for device, browser, country, pages, stuck taps and booking; one recording's moments from `events` and `console_logs_log_entries` in one question; playing it, PostHog's snapshot API (`GET /api/environments/{id}/session_recordings/{recording}/snapshots`: the list of its blocks with `blob_v2=true`, then runs of at most 20 blocks with `source=blob_v2&start_blob_key=&end_blob_key=`) |
| Errors | `system.error_tracking_issues` joined to the period's `$exception` events, and each group's `$exception` events by day for the charts; the occurrences from `$exception` events, with whether `session_replay_events` still holds the visit |
| Events and people | `events`, for the list and for the counts per kind; visitors grouped by person from `events`, and their totals (visitors, those who said who they are, those with more than one visit, all their visits) from the same grouping |
| Settings | D1 `service_config` and `service_config_history`, PostHog's rows; the project (`GET` and `PATCH /api/projects/{id}/`), of whose answer only the two recording fields are read |

Nothing a person sends can change a question (`src/lib/posthog/sql.ts`): a recording, visit or
error id must be a UUID (anything else is a 400 before a question is built), a time to page from
must hold only a time's characters and parse as a date, and a range, filter, kind, state or tab
that is not one of its listed values falls back to the default. Lists page by time (the last
row's time as `before`), never by offset.

## 5. Staying inside the limits

The route is `GET /api/posthog/{part}` (`overview`, with `view=board&tz=<zone>` for the board and
`view=live` for right now; `recordings`, `errors`, `people`), with
`fresh=1` for Refresh now; `GET /api/posthog/replay` (`?id=` the list of a recording's blocks,
`&from=&to=` a run of them; 60 asks a minute per person); and `/api/posthog/settings` (`GET`, `?own=1` for PostHog's own recording
setting, `PATCH` for one row, `POST` to put the rows back or change PostHog's setting, at most 20
changes a minute per person); [SECURITY.md](../security/SECURITY.md) §6a holds their rows.

- **One way to PostHog** (`src/lib/posthog/client.ts`). Every call has 9 seconds. A 5xx, a dropped
  connection, or a 429 asking for at most 2 seconds is asked once more in the Worker; a longer
  wait (PostHog's `Retry-After`, 1 to 60 seconds) goes back to the page, which asks again by itself.
  A question PostHog refuses as malformed (400) is logged with PostHog's reason, since it is this
  code's fault.
- **Few questions at once.** A read sends at most three questions to the query API at once
  (PostHog allows three at once per project, and 240 a minute, 2,400 an hour): Errors' list asks
  for its groups, their states and their days together, and the Overview's three reads (the board,
  right now, the totals) ask one each at a time: the board's two questions go one after the
  other, since one with every part was too heavy for PostHog to answer in time (2026-10-30). A
  question over PostHog's limit is answered with a wait, which the first bullet handles. The Overview's product checks run four at a time, beside its two
  first reads, inside the Worker's six open connections.
- **Short copies** (`src/lib/posthog/cache.ts`) in the Worker's own edge cache (the Cache API, no
  binding, nothing in D1): a list for a minute; the Overview for ten minutes, and its board ten
  minutes per time zone; right now for 20 seconds; the product checks for an hour; one recording,
  and the list of its blocks, for a minute, then a day once it is a day old and PostHog no longer
  changes it; one error for five minutes. A run of a recording's blocks is never kept
  (`private, no-store`). A read that failed is kept 20 seconds, and one PostHog
  asked us to wait on is not kept. Each copy is kept separately for readers with and without See
  who visitors are, so a copy that names visitors is never handed to someone who may not see them.
  With the copies and the live list's one-minute pace, the page's use of PostHog's allowance stays
  a few questions a minute however many people watch. A recording played asks for its list once
  and then a run at a time, the runs growing to 20 blocks and only up to three minutes ahead, well
  inside PostHog's 240 a minute and 1,200 an hour for recordings.
- **CPU.** The Worker only checks values, builds the question text and reshapes at most 501 rows;
  the counting is PostHog's. A recording's blocks are passed from PostHog to the browser
  untouched, their encoding kept, so the Worker never unpacks or reads them; the browser unpacks
  and plays them ([the lab](../specs/2026-10-29-posthog-lab.md) §5).

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
- A recording played on the page shows the pages as the visitor saw them, their own details on
  the booking summary included, which is why Recordings is an Admin's by default (§1). Its content
  passes through the Worker untouched and is never kept; it plays in a frame that runs no script
  (rrweb's `sandbox="allow-same-origin"`), and the viewer's browser asks the website for the
  pictures and fonts on the recorded pages, as PostHog's own player does.
- The board asks for nothing that names a visitor: visitors are counted by PostHog's person id
  and visits by its visit id, pages are paths, masked as above, a tapped thing is its first words
  on one line (at most 48 characters, masked as above), and a place is a country or state that
  PostHog reads from the internet address, which is never asked for.
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
`test/posthog-settings.test.ts`: Settings' guards (the page, then Settings, then each switch) and
the route mapping; a change on its way in (a whole share from 1 to 100, nothing it does not
know); PostHog's recording setting read from the two fields (none as every visit) and refused in
any other shape, and asked for as PostHog keeps it; the part's words for every one of PostHog's
rows; and the route against the test database and a PostHog stub (401 and 403, PostHog's rows only,
a change behind `#sampling` kept in the history and the audit log, another service's row and a
stale version refused, a reset of PostHog's rows alone, PostHog's own setting read without the
rest of the project, a change to it only behind `#provider-write` and audited, and a refusal that
names "Project: Write"). `test/action-keys-enforced.test.ts` checks that `#people`, `#refresh`,
`#sampling` and `#provider-write` are enforced.
`test/posthog-lab.test.ts` (2026-10-29, grown 2026-10-30): the board's two questions (their 15
and 6 parts and their columns, the booking steps asked as the Analytics page asks them, the
limits, the time zone quoted, nothing asked about who a visitor is) and their answer (60 days,
the two periods with visit length and leaving at once, recordings, hours, names masked, the
booking steps, the next pages and ways, stuck pages, tapped words, speed readings, kinds of
source, how far pages were read), the sentences of In plain words with and without the parts'
links, days across a clock change, right now with its pages, last day and last page, the error
trends in 30 bars and their labels, the figures' changes (in points for a share), slots and
meanings, the axis steps, the "Booking not sent" filter, the list's figures, the other parts'
sentences (a recorded visit, a period's errors and one error's occurrences, the visitors, what
each kind of event and each error state is), the moment on screen and a jump's place, and the route's two views (a bad time zone falls back to UTC;
Refresh now behind its key). `test/posthog-replay.test.ts`: the list of
blocks, a run's limits, PostHog's snapshot addresses, the route (401, 403 without Recordings, 400
for an id or run that is not one, Refresh now behind its key, the copy answering a second look, a
run passed on untouched with its encoding and never kept, a refusal in words with PostHog's
wait), reading streamed lines, unpacking packed parts, leaving out copies, a screen size from the
device, and the loading and waiting rules. `test/posthog-lab-look.test.ts` (Node): every class the
parts use is defined, the same gap between every section of a part, tones and slots in both themes, motion only when allowed, no menus, touch
sizes, the grid and strips, long lists on their own row, the moments as tall as the player, a
legend or table for every chart, and the player's library loaded only on Play.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-30 | The other parts in plain words: §3's Recordings, Errors and Events and people, §4's Events and people row and §7's lab test, against the files in `related_code`; the states' meanings against PostHog's "Manage and resolve issues" page (through the PostHog connector's documentation search); the visitor totals question run live (counts only); `test/posthog.test.ts` and `test/posthog-lab.test.ts` pass | The parts in a phone browser; the rest of the document |
| 2026-10-30 | The insights: §3's Overview and Recordings' switches, §4's Overview row, §5's "Few questions at once", §6's board bullet and §7's two lab tests, each against the files in `related_code`. Live through the PostHog connector, counts and sums only: both board questions and right now as the code builds them answer; `test/posthog-lab.test.ts` and `test/posthog-lab-look.test.ts` pass | The page in a phone browser; the rest of the document; `last_verified` left as it was |
| 2026-10-29 | The analytics lab: §2's Session recording note, §3's Overview, Recordings (the player), Errors (the chart, "Watch this moment") and Events and people, §4's board, right now, error days and snapshot rows, §5's routes, questions at once, copies and CPU, §6's playing and board bullets and §7's three new test files, each against the files in `related_code`; `test/posthog-lab.test.ts`, `test/posthog-lab-look.test.ts` and `test/posthog-replay.test.ts` pass | The page and the player in a phone browser; PostHog's live snapshot API and whether the portal's key holds Session recording: Read (the Overview's key card will say); the Settings part beyond its new layout |
| 2026-10-28 | §3's note on Control Plane's PostHog tab, after it was removed: `src/pages/dashboard/control-plane/posthog.astro` forwards to `/dashboard/posthog/settings`, and `src/lib/posthog/client.ts` reads `POSTHOG_PROJECT_ID`, else `PUBLIC_POSTHOG_PROJECT_ID` | The rest of the document; `last_verified` left as it was |
| 2026-10-28 | Written with the code: every section against the files in `related_code`. Live through the PostHog connector, counts and lengths only (no person-level value read): the Overview's question (1,146 events, 64 visitors, 90 visits and 71 recordings in the last 30 days, 7 open error groups, no flags, experiments or surveys), the recordings list and moments questions, the error groups (10 returned) and occurrences questions, the events (49 stuck taps), kinds and visitors (51 rows, 64 and 2) questions all run; the six `admin_pages` rows read back after `0079` (D1 connector); `test/posthog.test.ts` passes | The portal's own key's permissions (only Query: Read is proven, by the Analytics page; the Overview's checks will say); the page in a phone browser |
| 2026-10-28 | Settings (§1 to §5, §7), written with the code: the project's two recording fields and their live values (on, every visit; `session_replay_config` empty) through the PostHog connector; that the website uses PostHog's `enabled`, `capture_pageview`, `autocapture` and `session_recording.enabled` rows and nothing uses its `sample_rate` row (cf-astro `main`, 53b1bd7: `cf-astro/src/scripts/analytics-loader.ts`, `cf-astro/src/scripts/runtime-config-client.ts`, `cf-astro/src/lib/route-policy.ts` and `cf-astro/src/lib/service-config.ts`); the three `admin_pages` rows read back after `0082` (D1 connector); `test/posthog-settings.test.ts` passes | Whether the portal's key holds Project: Write (the part will say on the first change); the part in a phone browser |

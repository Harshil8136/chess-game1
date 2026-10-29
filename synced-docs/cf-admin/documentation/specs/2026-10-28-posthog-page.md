---
title: "PostHog in the portal: the plan"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-28
verified_against: [code, infra, docs]
owner: harshil
related_code: [src/lib/posthog/client.ts, src/pages/api/posthog/[part].ts, src/components/dashboard/posthog/PostHog.tsx, src/lib/auth/surface-guards.ts, migrations/0079_posthog_page.sql]
related_docs: [2026-10-29-posthog-lab.md, ../features/POSTHOG.md, ../features/ANALYTICS.md, 2026-10-26-analytics-page.md, ../security/RoPA.md, ../architecture/PERMISSIONS-SYSTEM.md, ../records/reports/2026-10-28-posthog-page.md]
tags: [posthog, analytics, recordings, errors, permissions, limits, plan]
---

# PostHog in the portal: the plan

> **TL;DR (non-technical):** A new page, **PostHog**, brings what PostHog collects about the
> website into the portal: recordings of visits, errors visitors hit, every event and visitor,
> and later the on and off switches (flags), tests and surveys. It is built in stages,
> starting with the parts that only read. Every part is a page of its own that can be given or
> kept back on the Access page, who a visitor is stays hidden unless you allow it, and every
> part is built to stay inside Cloudflare's and PostHog's free limits.

## 1. Why

Harshil on 2026-10-28: "can we have a page like PostHog where everything from PostHog is
accessed by API like session recording, features, DOM manipulation, logs, analytics ... keep in
mind about Cloudflare 10ms CPU limit, worker invocation limitations, PostHog API limits,
allowance. Not to break system and provide all features and options! add access permissions,
sub-sections, sub-pages, info, logs and everything!"

How the request is read:

- **"Features"** are PostHog's feature flags: switches that turn a part of the website on or off,
  or on for some visitors only.
- **"DOM manipulation"** is PostHog's no-code web experiments: a test that changes a headline, a
  button's words or a colour on the live website for some visitors and measures which version
  works better. It is the only PostHog product that changes the website's page itself.
- **"Analytics"** is what PostHog itself shows: events, people, saved insights and dashboards.
  The portal's own [Analytics page](../features/ANALYTICS.md) stays as it is; this page does not
  copy its parts.

## 2. What is there today

Read live through the PostHog connector on 2026-10-28 (counts only, no visitor's details):

| Product | Today |
|---|---|
| Recordings | 71 in the last 30 days, 40 MB in all, the largest 4.4 MB; 9 with a console error |
| Console messages in recordings | 37 warnings and 16 errors in 30 days, readable as a table |
| Error tracking | 10 error groups: 7 active, 3 resolved |
| People | 431 visitor profiles, 20 identified (guests who booked), 3 with an email property |
| Saved insights and dashboards | 30 insights, 3 dashboards |
| Feature flags, experiments, surveys | none yet |
| Logs | none yet: nothing sends logs to PostHog |

The portal already holds one PostHog personal API key. It is proven to read queries (the
Analytics page uses it) and to change the project's recording switch (Cloud Services, PostHog).
Its other permissions are not known, and PostHog has no way to ask a key for its own permissions
(an open request on PostHog's tracker, March 2026), so the page tries each product with a cheap
read and says which permission is missing (§7).

The website records with every typed field hidden (`maskAllInputs: true` in cf-astro's PostHog
setup), but text the page itself shows is recorded, which includes a guest's own details on the
last booking step. Booking guests are identified to PostHog by their email.

## 3. The page and its parts

`/dashboard/posthog`, called **PostHog**, in the sidebar's Daily group after Analytics. Each part
is a registry page with the page as its parent, shown in the sideways row of tabs
(`RegistryTabs`), so it can be given or refused alone. Parts arrive in stages (§9); a part's row
is added in the stage that builds it, so the row of tabs never shows a part that does not work.

| Part | Path | What it shows | Stage |
|---|---|---|---|
| Overview | `/dashboard/posthog` | whether each product answers the portal's key, this month's use of every free allowance, the last 30 days in numbers, a line per part | 1 |
| Recordings | `/recordings` | every recording with its length, active time, first page, taps, typing and errors; filters in a row; one recording's events, taps, pages and console messages in order | 1 (list and detail), 2 (playing it) |
| Errors | `/errors` | each error group with how often, how many people and visits, first and last seen, status; one group's latest occurrences, where in the code, and the recordings of those visits | 1 (read), 3 (change status) |
| Events and people | `/people` | the newest events as they arrive, every kind of event with its 30-day count, and visitors with first and last visit, visits, country and device | 1 |
| Heatmaps | `/heatmaps` | where visitors tap, tap repeatedly and how far they scroll, per page, over PostHog's saved screenshot | 2 |
| Flags | `/flags` | every switch, who it is on for, its history; create, change, turn off | 3 |
| Experiments | `/experiments` | every test and its result; page tests (no-code) where allowed (§10) | 3 |
| Surveys | `/surveys` | every survey and its answers; start and stop | 3 |
| Logs | `/logs` | not built: Harshil chose not to send logs to PostHog (§10, 2026-10-28) | none |
| Insights | `/insights` | the saved insights and dashboards, drawn | 4 |
| Activity | `/activity` | what changed in PostHog and who changed it, beside the portal's own record of changes made from this page | 4 |

## 4. Where each part reads from

Most reads are one HogQL question to PostHog's query API, which the key is proven to use. The
tables were confirmed on 2026-10-28 through the PostHog connector.

| Part | Read from |
|---|---|
| Overview | the query API (30-day counts), the organisation's billing (`/api/organizations/{org}/billing/`, already read by Cloud Services), one cheap read per product (§7) |
| Recordings | `session_replay_events` grouped per recording; device, browser and country from the recording's first event; one recording's events from `events` and its console messages from `console_logs_log_entries`, in one question |
| Errors | `system.error_tracking_issues` for name, status and description; `$exception` events for counts, people, visits and the latest occurrences |
| Events and people | `events` and `persons` |
| Heatmaps | the heatmaps API and saved heatmap screenshots |
| Flags, experiments, surveys | `system.feature_flags`, `system.experiments`, `system.surveys` to read; their REST endpoints to change |
| Logs | the logs query |
| Insights | `system.insights` and `system.dashboards`; each insight's last result |
| Activity | `/api/projects/{id}/activity_log/` and D1 `admin_audit_log` |

Every value put into a question is checked against a strict shape first (a recording or error
id is a UUID, a page address is letters, digits and `/ - _ .`), so nothing a person types can
change the question.

## 5. Who may do what

Defaults below; anyone can be given or refused any of them on the Access page. Stored role names
in brackets.

| Key | What it allows | Default holders |
|---|---|---|
| `/dashboard/posthog` | open the page and its Overview | Manager [admin] and above |
| `/dashboard/posthog/recordings` | list and open recordings, and later play them | Admin [super_admin] and above: a recording shows what the guest saw, their own details on the booking summary included |
| `/dashboard/posthog/errors` | read errors | Manager and above |
| `/dashboard/posthog/people` | read events and visitors, with who they are hidden | Manager and above |
| `/dashboard/posthog#people` | see who a visitor is: their PostHog id, which is a guest's email after a booking | Owner [owner] |
| `/dashboard/posthog#refresh` | read PostHog again instead of the copy kept a short while | Manager and above |
| later stages | one key per kind of change: flags, experiments, surveys, error status, deleting a recording, project settings | Owner |

The page key, then the part's key, then the action's key, each asked for exactly, on the page and
again on its API route (`denyPostHog`, modelled on `denyAnalytics`). Every change sent to PostHog
from the portal is written to the audit log with who, what and the answer.

## 6. Staying inside the limits

### Cloudflare (Workers Free)

| Limit | How the page stays under it |
|---|---|
| 10 ms of CPU per request | the Worker only asks and passes answers on; it parses at most a few hundred rows per request. Waiting for PostHog does not count as CPU. A recording (stage 2) is passed through as it comes, never read or unpacked by the Worker: the browser unpacks it |
| 6 outside connections waiting at once, 50 outside requests per request | at most 4 questions to PostHog at once; the Overview's product checks are the most, 9 calls, and are kept an hour |
| 100,000 requests a day | a part costs one page load and one or two API calls; nothing refreshes by itself faster than once a minute, and only while the tab is visible |
| memory (128 MB) | lists are capped (50 recordings, 100 events, 50 errors a page) and paged by time, never all at once |

### PostHog

Limits per personal key, from PostHog's API documentation (re-read 2026-10-28): the query API
240 a minute and 2,400 an hour, 3 questions running at once per project, 10 s each; other reads
and changes 480 a minute and 4,800 an hour; recordings and people's endpoints 240 a minute and
1,200 an hour. The Analytics page shares the same key.

| Rule | Why |
|---|---|
| a part asks at most two HogQL questions, one after the other, and joins what it can into one | stays under the 3-at-once limit even with the Analytics page open beside it |
| a copy of each answer is kept in the Worker's edge cache: lists 60 s, the Overview 10 minutes, the product checks an hour, a recording older than a day a day (PostHog no longer changes it) | the same view opened twice costs nothing the second time |
| no OFFSET paging: the next page starts after the last row's time | PostHog's API documentation asks for paging by time, and it is cheaper |
| a 429 shows "PostHog asked us to wait N seconds", and the page asks once more after that wait, at most 10 seconds | never a blank part, never a retry storm |
| Refresh now (`#refresh`) is the only way to skip the copy | a click cannot run up the hour's allowance by accident |

### PostHog's free allowance

The Overview shows each product's use this month against its free amount, read from PostHog's
billing, so nobody has to guess. Free amounts per month, from PostHog's pricing page
(2026-10-28): 1 million events, 5,000 recordings, 1 million flag requests, 100,000 exceptions,
1,500 survey answers. Reading data through the API costs no allowance; only what the website
sends does.

## 7. Does each product answer the portal's key?

The Overview tries one cheap read per product (recordings, error tracking, flags, experiments,
surveys, insights, logs, activity, billing) and shows each as **Works**, **Needs permission** with
the exact permission to add to the key in PostHog (for example "Feature flags: Read"), or **Could
not check**. A change (stage 3 on) cannot be tried without changing something, so the first
refused change says which write permission to add, in the same words. The checks are kept an
hour.

## 8. Privacy

- **Who a visitor is stays hidden by default.** The Worker replaces every PostHog id with a short
  name made from it ("Visitor 3f2a"; the same visitor always gets the same name) and hides
  anything shaped like an email address or a phone number in any text it passes on (page
  addresses, error messages, console messages). Only a holder of `#people` gets the real values,
  and the kept copy for them is kept apart from everyone else's.
- **Recordings need their own key** (§5), because the text on the screen is recorded.
- **Nothing new is stored.** The portal keeps no copy of PostHog data beyond the short edge cache
  (§6). The [record of processing](../security/RoPA.md) gets the PostHog page's reads in the stage
  1 commit.

## 9. Stages

| Stage | What | Needs |
|---|---|---|
| 1 | the page, its keys (migration `0079`), the shared PostHog client, Overview, Recordings (list and detail), Errors (read), Events and people | nothing new |
| 2 | playing a recording in the portal (shipped 2026-10-29 with the page's [analytics lab](2026-10-29-posthog-lab.md)), heatmaps | Harshil's choice on the player (§10: answered) |
| 3 | flags, experiments (page tests where allowed), surveys, error status, deleting a recording | write permissions on the key (Harshil, in PostHog); the website change for page tests if allowed |
| 4 | insights and dashboards drawn, activity (no logs: §10) | nothing new |

## 10. Choices that are Harshil's

Asked on 2026-10-28, each with a recommendation; the answers are recorded here when given.

1. **Playing recordings.** Recommended: the portal's own player, which adds one free, open-source
   library (rrweb, MIT licence) loaded only when Play is pressed; recordings stay private. Other
   choices: a button that opens the recording on PostHog's site (no library, needs a PostHog
   sign-in), or PostHog's share links (plays in the portal without a library, but makes each
   opened recording watchable by anyone with its address: not recommended).
   **Answered 2026-10-29: the portal's own player.** Harshil: "I was really hoping to have REAL
   video buffering inside browser. Cant we do that?" Built with `@rrweb/replay` 2.1.7 (MIT),
   loaded only when Play is pressed and listed in RULESAd §7.3; how it loads, waits and plays is
   the [analytics lab](2026-10-29-posthog-lab.md) §5. Recordings stay private: they pass through
   the portal to the viewer's browser and are never kept.
2. **Page tests on the website.** Recommended: allowed, but never on booking pages. PostHog's
   page tests are off on the website today; allowing them is a small change to the website's
   PostHog setup that keeps them off on every booking address.
3. **Logs.** Recommended: send the portal's and the website's Worker logs to PostHog Logs through
   Cloudflare's OpenTelemetry export, keeping Cloudflare's own copy too. It needs one destination
   added in the Cloudflare dashboard (his step) and one setting per Worker. It is a new copy of
   the logs at PostHog, which already receives the website's visits; the record of processing
   gets a row.
   **Answered 2026-10-28: not now.** No log is sent to PostHog, so stage 4 has no Logs part; the
   portal's logs stay where they are (Cloudflare, Sentry, the System health page).
   *Found after the answer:* Cloudflare's OpenTelemetry export is not available on the Workers
   Free plan (Cloudflare's "Exporting OpenTelemetry Data" page, read 2026-10-28), so this
   recommendation could not have been carried out on the current plan.

## 11. Decided against

- **A copy of PostHog's whole app inside the portal (an iframe):** it would need a PostHog sign-in
  for everyone and would bypass the portal's permissions.
- **Keeping PostHog data in D1:** a new table and a second copy of personal data, against RULE
  #0.9; the short edge cache is enough.
- **Reading recordings in the Worker to cut them down:** a 4 MB recording parsed in the Worker
  would pass the 10 ms CPU limit; the browser does that work.
- **Merging this page into Analytics:** Analytics answers "how is the website doing" from five
  sources for the staff; this page is PostHog's own tools, with changes and identities behind
  stricter keys.

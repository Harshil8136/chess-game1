---
title: "System health (checks, problems and test alerts)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-17
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/dashboard/health.astro, src/components/admin/health/, src/styles/pages/health.css, src/lib/health/, src/lib/health/readings.ts, src/lib/health/probes.ts, src/lib/dal/HealthReadsRepository.ts, src/workers/scheduled-health-checks.ts, src/lib/email-console.ts, src/lib/dal/HealthResultsRepository.ts, src/lib/dal/PlatformAlertsRepository.ts, src/lib/schemas/health.ts, src/pages/api/system-health/, src/lib/auth/surface-guards.ts, src/lib/alert-gate.ts, src/lib/ai/telemetry.ts, migrations/0072_system_health.sql, test/system-health.test.ts, test/system-health-state.test.ts, test/system-health-readings.test.ts, test/system-health-checks.test.ts, test/health-checks-job.test.ts, test/jobs-budget.test.ts, test/system-health-board.test.ts, test/system-health-look.test.ts, test/debug-access.test.ts, test/action-keys-enforced.test.ts, test/hot-query-plans.test.ts, test/ai-telemetry.test.ts]
related_docs: [CRON-CONTROL.md, ../records/reports/2026-10-17-health-checks-on-their-own.md, ../records/reports/2026-10-17-health-checks-rebuilt.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../operations/DEV-TOOLS.md, ../reference/schema-change-ledger.md, ../records/reports/2026-10-17-system-health.md, ../specs/2026-10-17-system-health-look.md, ../records/reports/2026-10-17-system-health-look.md]
tags: [health, alerts, diagnostics, monitoring, permissions, ui]
---

# System health

> **TL;DR (non-technical):** One page answers "is everything working?". It checks the website,
> email, the data and backups, security, the server and scheduled jobs, and the portal itself on
> its own, day and night, 27 checks each as often as it needs, opens a problem after two failures in a row and closes it after two passes, lists every
> problem those checks and the
> website have filed, says in plain words what each check proves and how to fix it when it
> fails, and lets you send a test alert to prove an alert would reach someone. It replaced two
> older pages, Diagnostics and Alerts, on 2026-10-17. Who may see the technical details, run the
> checks, close problems or send a test alert is set per person on the Access page.

The page is at `/dashboard/health`, in the sidebar's System group. The two old addresses forward
to it: `/dashboard/alerts` opens the Problems tab and `/dashboard/debug/diagnostics` the Checks tab
(that one only for someone who holds Developer Tools, which its folder still asks for first).
The Alerts page's two registry rows were switched off by migration `0073` the same day, so the
sidebar no longer lists Alerts.

## 1. Who may do what

The page and each action are rows in the page registry (migration `0072`), so each can be given to
or taken from one person on their Access page. The server checks every one of them; the page only
hides what the server would refuse (`denyHealth` and `healthCan` in `src/lib/auth/surface-guards.ts`).

| Switch | Key | Who has it by default | What it allows |
|---|---|---|---|
| System health | `/dashboard/health` | Manager and above | Open the page: every check's state, the problems, the history |
| See technical details | `/dashboard/health#details` | Admin and above | Error text, response times, raw check output, what each problem said, and the compliance records |
| Test again | `/dashboard/health#run` | Manager and above | Run one check, or every check, now |
| Resolve problems | `/dashboard/health#resolve` | Manager and above | Close a problem, with a reason |
| Resolve while still failing | `/dashboard/health#resolve-anyway` | Owner and above | Close a health check's problem while its check still fails |
| Send a test alert | `/dashboard/health#simulate` | Vendor support | Send a marked test through the real alert channels |

A switch opens nothing without the page key. The Owner and Vendor support pass every switch, as
everywhere in the portal. Until 2026-10-17 Diagnostics asked for Developer Tools (Vendor support)
and Alerts for its own page (Manager), whose "Scan" ran the same tests past the Developer Tools key.

## 2. The five tabs

The page has a look of its own, a patient monitor (the [design](../specs/2026-10-17-system-health-look.md)).
A monitor band sits above the tabs on every tab: the page's name, when it last checked, and three
readouts (Failing, Needs a look, Open), each a button to the list behind it. The five tabs are one
row, all visible on a phone.

| Tab | What it shows |
|---|---|
| Overview | The band in full: a state word (All working, Needs a look, Something is failing, Not checked yet), one sentence, and a pulse line of the last 30 days, a beat per day at its worst state across the six areas, a dashed line on a day nothing ran. Then what needs someone now (failing checks and the top open problems) and each area with a tick per day |
| Problems | A triage board: lanes by level (Urgent "Look now", Soon "Look today", FYI "When there is time"), open before closed, each problem a ticket that says who filed it, how many times it came, first and last seen, and once closed who closed it and why. Open, Closed or All, and a level. Opening one shows its chart: its check's latest result, last 24 results and how to fix it, Test again, each time it came and each close, by day, and the form that closes it |
| Checks | Every check by area: its state, its last 24 results as ticks, and, opened, what it proves, how to fix it when it fails, and Test again |
| Tests | Check everything now, and Send a test alert with the path its channels take |
| History | Every run of the checks that is kept, by day, each with its state words and a bar of how it went; one run's results; the way to closed problems; the compliance records |

**Counts are per problem.** The open counts on the band, the Problems tab and the level buttons
count each open problem once, however many times it came, at its level. A problem's level is the
worst level it was filed at, and the level filter picks problems by that level, so a problem shows
under one level only. Until 2026-10-17 the counts added up every report and the filter picked
reports, so one problem filed 12 times counted 12 and could show under two levels.

**The address keeps the view.** The tab, and on Problems the status and level, are kept in the
address (`?tab=problems&status=closed&level=critical`), so a link opens that view.

Opening the page runs nothing: it reads what the checks found, and reads it again every minute
while the page is on screen (never in a hidden tab). Each check's latest result comes from the
state row the checks job keeps (§6), so it is never older than the check's interval; the 30-day
strips come from the same row. When that re-read finds the open counts
changed, Problems reads its first page again. Until 2026-10-17 opening Diagnostics ran every
test, and three of them wrote test data.

## 3. The checks

Twenty-seven checks, defined in `src/lib/health/catalog.ts`, each beside the code that runs it
with what it proves, how to fix it, how urgent a failure is and how often it runs on its own. The
rules that turn what a check read into Working, Needs a look or Failing live apart, in
`src/lib/health/readings.ts`; how a check asks a page, DNS or Cloudflare's analytics is in
`src/lib/health/probes.ts`, and what it reads from other features' tables in
`src/lib/dal/HealthReadsRepository.ts`. Every check only reads.

| Check | Area | Level | Runs on its own | What it proves |
|---|---|---|---|---|
| Website and booking pages | Website and booking | Urgent | every 5 minutes | The home page and the booking page open in Spanish and English through the website's private connection and show what guests see: the page in its language, its main content, the booking form's first step. A page is read only until those are found, and never past 1 MB |
| Website's booking and consent systems | Website and booking | Urgent | every 15 minutes | The website's own health report, booking and consent queues included, says nothing is wrong. A report that names a problem, such as bookings that stopped retrying, is a failure |
| Booking and consent heartbeat | Website and booking | Soon | every 15 minutes | The website's hourly heartbeat ran within its window and found nothing wrong |
| Website updates | Website and booking | Soon | every 15 minutes | Changes made in the portal reach the website: none waiting over an hour, none given up in the last 24 hours |
| Website chat assistant | Website and booking | Soon | every 15 minutes | The chat assistant answers its health question |
| Email queue | Email | Urgent | every 5 minutes | Emails leave the queue: how many wait and how long the oldest has waited, a warning at 5 minutes and a failure at 15 |
| Email service: stuck and failed mail | Email | Soon | every 15 minutes | The email service's own count: no email stuck over 10 minutes, none that failed every retry in the last 24 hours |
| Brevo, the main email sender | Email | Soon | hourly | Brevo accepts the portal's key, and today's sends are not nearly used up (300 a day on the free plan, a warning at 80%) |
| Resend, the backup email sender | Email | Soon | hourly | Resend accepts the portal's own key, and its daily and monthly allowance is not nearly used up |
| Email domain records | Email | Soon | daily | The records that keep hotel mail out of spam: one SPF record, Brevo's ownership and signing records, DMARC, and Resend's signing and return-address records |
| Shared database | Data | Urgent | every 5 minutes | The shared Cloudflare D1 database answers, how fast, and how full it is of its 500 MB |
| Database's daily allowance | Data | Soon | hourly | Today's rows read and written against the free plan, as the hourly usage check last measured: a warning where jobs that can wait are held back, a failure at 90% |
| Database tables | Data | Urgent | hourly | The tables the portal cannot work without exist |
| Supabase | Data | Urgent | every 5 minutes | Supabase answers |
| File storage and sign-in sessions | Data | Soon | every 15 minutes | The image storage, the staff file storage and the session store answer, read only |
| Backups are fresh | Data | Soon | hourly | The backup console's own rule: a good full backup within its limit (8 days unless set otherwise), and a good backup within 36 hours when the schedule backs up every day |
| Portal is not public | Security | Urgent | every 15 minutes | A visitor who is not signed in is sent to this portal's Cloudflare sign-in, at its exact address |
| Supabase security advisor | Security | Urgent | daily | Supabase's own security advisor finds nothing serious |
| Website's protective headers | Security | Soon | hourly | The public website sends its HTTPS-only and file-type headers, and its content and referrer rules |
| Activity log | Security | Soon | hourly | The activity log is still being written (it counts up to 100 entries of the last week, shown as "100+") |
| Activity log seal | Security | Urgent | daily | The newest sealed day of the activity log still matches its seal, follows on from the seal before it, and has its copy in storage; and the day's seal, due at 14:00 UTC, was written |
| Server is alive | Server and jobs | Soon | every 15 minutes | The server ran its hourly job recently. When the portal had to run it instead, the server missed it |
| Scheduled jobs on time | Server and jobs | Soon | every 15 minutes | No portal job failed twice in a row since it last ran, and every five-minute job reported within the last 70 minutes (from Analytics Engine, as the Scheduled jobs page reads it) |
| Errors and CPU limits | Server and jobs | Soon | hourly | Cloudflare's own count of our seven Workers' last hour: none stopped at a limit (CPU time, memory or requests), and none with 10 errors or more that are also 5% of its requests (fewer errors are a warning). Other Workers in the account are not asked about |
| Request limits | Portal | Soon | hourly | Every one-minute request limit is connected |
| Analytics recording | Portal | FYI | hourly | The analytics store is connected (checked without writing) |
| Sentry, the error tracker | Portal | Soon | hourly | Sentry accepts the portal's key |

**Running on their own.** The `health-checks` job in the five-minute scheduler
(`src/workers/scheduled-health-checks.ts`; [`CRON-CONTROL.md`](CRON-CONTROL.md) §3e) runs each
check at its interval, at most eight in one run. The checks average just under eight a run (four
every five minutes, nine every 15, eleven hourly, three daily), so where each one first runs
matters: its first run after release places every check on the run that keeps the busiest run of
the day at eight (`placeNew` in `src/lib/health/state.ts`), and a check a later release adds is
placed the same way around the checks already running. Each check then keeps its place: a run
moves its next due time on by whole intervals, so a check that had to wait a run, or the checks
after a pause, go back to their places instead of drifting. When a run has more due than eight,
the five-minute checks go first, then the most overdue; after a pause of two hours, every check has
run again within five runs. It can be paused on the Scheduled jobs page like any job; while it is
paused, checks run only when someone presses Test again. Until 2026-10-17 that was the only way a
check ran.

A result is one of four: Working, Needs a look, Failing, or Not set up (a key or binding the check
needs is missing here, so it says nothing either way). The portal's own security headers are not
checked at run time: they are fixed in code and pinned by `test/csp.test.ts`.

**Levels.** Urgent means guests cannot book, data is at risk or the portal is exposed; Soon means
it will hurt within hours or days; FYI is shown only.

**What a failure does.** A problem opens when an Urgent or Soon check fails twice in a row and no
problem is open for it (`src/lib/health/run.ts`, the rules in `src/lib/health/state.ts`): an
urgent problem goes to the problem list, Sentry and the alert email; a soon one to the problem
list and Sentry. One failure is not enough, as one dropped answer is not a problem: a five-minute
check opens one about ten minutes after something breaks. A check that keeps failing files nothing
more while its problem is open. A warning resets the count; Not set up leaves it as it was. Test
again counts the same way as the job: a failure right after the job's failure opens the problem.

**Closing by itself.** The problem closes itself after the check passes twice in a row, signed
"System health" with the reason "Fixed itself: the check passed twice in a row." When it comes back
the same day, the new problem says how many times it opened today, and the ticket shows each time.

**Unstable checks.** A check that keeps failing and recovering files one problem that says so,
instead of one per failure (the Nagios rule: the share of changes between failing and not in its
last 21 results, newer ones weighing more, reaches 30%). While it is unstable the check opens and
closes nothing; the problem closes itself when the share falls to 15% or below ("Steady again"). A
check that moves between Working and Needs a look is not unstable, as a warning never opens a
problem. FYI checks never open a problem.

**Limits.** Test again runs one check at most once a minute, and Check everything now at most once
every two minutes; the stored results are the clock, so a check the job just kept counts too. At
most six checks run at a time, each stops waiting after ten seconds, and in the job and Test again
a failure is tried once more before it counts. Check everything now tries each check once: 27
checks each tried twice could pass the 50 outside requests a Worker may make on the free plan. A
person's run leaves the checks' places in the schedule as they were. The waiting does not count
towards the Worker's CPU time.

## 4. Problems

Problems are rows in `platform_alerts`. They come from three places: the health checks (source
`health`), the portal itself (today the AI writing tools' daily allowance, `workers-ai`), and the
website, which files under its route names (for example `api_booking`, `api_consent`,
`api_webhooks_brevo`, `brevo_webhook`). Each is named in plain words (`src/lib/health/view.ts`);
what it said, which can hold addresses and request details, is under "See technical details".

**Closing one.** A close records who closed it, when and why (the `resolved_by` and `resolution`
columns, migration `0072`). It closes the repeats that were open when the person opened the
problem, so the number the button promises is the number it closes; a repeat filed after that
stays open. A health check's problem closes only once its check passes, unless the person holds
"Resolve while still failing"; closed while its check still fails, it opens again on the check's
next run. It also closes by itself after two passes in a row (§3). Closing is limited to ten a minute per person and recorded in the
activity log as `health_resolve`, with the reason.

**What is never a problem.** The website's ARCO records (`arco_get_document`, each identity
document from a privacy request handed out, and to whom) are compliance records: they are listed
under History, need "See technical details" because they name staff and requests, and cannot be
closed or deleted here. Test alerts are closed the moment they are filed and listed nowhere.

**The AI allowance.** The portal warns when the day's AI spend crosses 80% of the allocation, and
files an urgent problem when it reaches the line where new AI writing is refused for the day
(`alertOnNeuronThreshold` in `src/lib/ai/telemetry.ts`). Until 2026-10-17 the urgent one could
never fire: it waited for the full allocation, which the portal's reserve keeps it from reaching.

## 5. Send a test alert

Sends a clearly marked test through the same channels a real problem uses and says what each one
did: the Worker log, the problem list (closed at once), Sentry, and, for a test like an Urgent
problem, the alert email, which goes to the email service's queue and from there to the hotel's
alert inbox. A test like a Soon problem sends no email, and the answer says so. Three a minute per
person, recorded as `health_test_alert`. Until 2026-10-17 the test left an open alert naming the
person who sent it, and its pop-up called a queued email "delivered".

## 6. What is stored, and for how long

| Where | What | Kept |
|---|---|---|
| D1 `system_test_results` | A check's result: the run, the check, its level, status, time taken, the plain summary, the technical part as JSON, and the id of the person who ran it (`system` for the job, whose runs are `auto-…`). Kept: every result someone ran, and from the job every change of state plus one an hour per check, about 600 rows a day with 27 checks | 30 days; the job deletes older results on its first run after 03:00 UTC |
| D1 `admin_portal_settings` row `health-state` | What System health remembers between runs (`src/lib/health/state.ts`): each check's latest state and words, when it ran and when it is next due, its failures and passes in a row, its last 21 states, and per day its worst state and how many results, for 30 days. About 25 KB with 27 checks, written by every run (compare-and-swap, so the job and Test again never lose each other's results) | Replaced on each run; the days older than 30 drop out |
| D1 `platform_alerts` | Problems, compliance records and test alerts; who closed a problem and why | No automatic clean-up yet |
| D1 `admin_audit_log` | `health_run`, `health_resolve`, `health_test_alert` | The activity log's own rules |

No new table, binding, secret or cron trigger: the results table is the one Diagnostics wrote, the
problems table the one Alerts read, and the state is one row of the settings table. The checks
use what the portal already had: `RESEND_API_KEY` and `BREVO_API_KEY`, the `ASTRO_SERVICE`,
`EMAIL_CONSOLE` and `EMAIL_QUEUE` bindings, and the Cloudflare token and account the Scheduled
jobs page and the dashboard already use. The email service answers its counts on a route of its
own Console (cf-email-consumer `docs/features/EMAIL-API.md`). Results
written by Diagnostics before 2026-10-17 stay until the clean-up removes them, and History does
not list them.

## 7. Not built yet

The rest of parts 2 and 3 of the plan of 2026-10-17, which the owner approved: other services'
problems fed in, the website's repeated problems grouped, a check that the checks themselves ran, acknowledging and snoozing (`#ack`), settings (`#configure`), heavier
tests (`#run-heavy`), the test alert sent only to the person who pressed it, and a strip on the
home page. Until snoozing exists, closing a problem whose check still fails opens it again on the
next run.

## 8. Verification log

| Date | What was checked | What was not |
|---|---|---|
| 2026-10-17 | The 27 checks of part 2B: §3's table, the placing and keeping of places, the limits, §6 and §7 against `src/lib/health/catalog.ts`, `src/lib/health/readings.ts`, `src/lib/health/probes.ts`, `src/lib/dal/HealthReadsRepository.ts`, `src/lib/health/state.ts`, `src/lib/health/run.ts` and `src/workers/scheduled-health-checks.ts`; the rules pinned by `test/system-health-readings.test.ts`, the checks against stand-in services by `test/system-health-checks.test.ts`, the placing by `test/system-health-state.test.ts` (from the live state's last runs, and after pauses), the cost by `test/jobs-budget.test.ts`; the domain's mail records, the Brevo and Resend answers, the live tables' sizes and the website's pages read before writing | A live run of the new checks: written before the push; whether the queue binding reports its size, whether Cloudflare's analytics take the list of our Workers and whether the booking pages open through the binding are read from the first live results |
| 2026-10-17 | The checks on their own: §3 (the intervals, running on their own, what a failure does, closing by itself, unstable checks, the limits), §4's closing, §6 and §7 against `src/workers/scheduled-health-checks.ts`, `src/lib/health/state.ts`, `src/lib/health/run.ts`, `src/lib/health/catalog.ts` and `src/pages/api/system-health/`; pinned by `test/system-health-state.test.ts`, `test/health-checks-job.test.ts` and `test/system-health.test.ts`; the result rows a day counted from the code | A live run: written before the push; the owner's phone test follows |
| 2026-10-17 | §2 for the new look: the tabs, the band, the per-problem counts, the level filter and the address, against `src/components/admin/health/`, `src/styles/pages/health.css` and the two repositories; the counts and the filter by `test/system-health.test.ts`, the pieces by `test/system-health-board.test.ts` and `test/system-health-look.test.ts` | The rest of the page, unchanged since the rows below; the look on a phone, which the owner tests after the push |
| 2026-10-17 | The `0073` sentence: the two Alerts rows read back switched off through the Cloudflare D1 connector after it was applied | The rest of the page, unchanged since the row below |
| 2026-10-17 | Written with the code: every claim above against `src/lib/health/`, `src/pages/api/system-health/`, `src/components/admin/health/`, the two repositories and `migrations/0072_system_health.sql`; the live tables read through the Cloudflare D1 connector before the migration (`platform_alerts`: 35 rows from the website, none open; `system_test_results`: 68 rows from four Diagnostics runs; the one Developer Tools grant belongs to an Owner, who passes the new key anyway); `test/system-health.test.ts` and the updated tests | The page on a phone, which the owner tests after the push |

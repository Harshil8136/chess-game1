---
title: "System health (checks, problems and test alerts)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-17
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/dashboard/health.astro, src/pages/dashboard/index.astro, src/lib/overview/sections.ts, src/components/admin/health/, src/styles/pages/health.css, src/lib/health/, src/lib/health/readings.ts, src/lib/health/probes.ts, src/lib/dal/HealthReadsRepository.ts, src/lib/vps-proxy.ts, src/workers/scheduled-health-checks.ts, src/workers/scheduled-log-scan.ts, src/lib/email-console.ts, src/lib/dal/HealthResultsRepository.ts, src/lib/dal/PlatformAlertsRepository.ts, src/lib/schemas/health.ts, src/pages/api/system-health/, src/lib/health/heavy.ts, src/lib/dal/EmailAuditLogRepository.ts, src/lib/auth/surface-guards.ts, src/lib/alert-gate.ts, src/lib/email-console.ts, src/lib/ai/telemetry.ts, migrations/0072_system_health.sql, migrations/0074_health_ack_snooze.sql, migrations/0075_health_run_heavy.sql, migrations/0076_health_configure.sql, test/system-health.test.ts, test/system-health-settings.test.ts, test/system-health-heavy.test.ts, test/system-health-ack.test.ts, test/system-health-state.test.ts, test/system-health-readings.test.ts, test/system-health-checks.test.ts, test/vps-proxy.test.ts, test/health-checks-job.test.ts, test/jobs-budget.test.ts, test/system-health-board.test.ts, test/system-health-look.test.ts, test/debug-access.test.ts, test/action-keys-enforced.test.ts, test/hot-query-plans.test.ts, test/ai-telemetry.test.ts]
related_docs: [CRON-CONTROL.md, VPS-CONSOLE.md, ../records/reports/2026-10-17-health-part-3.md, ../records/reports/2026-10-17-health-snooze-repeats-watcher.md, ../records/reports/2026-10-17-health-checks-on-their-own.md, ../records/reports/2026-10-17-health-checks-rebuilt.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../operations/DEV-TOOLS.md, ../reference/schema-change-ledger.md, ../records/reports/2026-10-17-system-health.md, ../specs/2026-10-17-system-health-look.md, ../records/reports/2026-10-17-system-health-look.md]
tags: [health, alerts, diagnostics, monitoring, permissions, ui]
---

# System health

> **TL;DR (non-technical):** One page answers "is everything working?". It checks the website,
> email, the data and backups, security, the server and scheduled jobs, and the portal itself on
> its own, day and night, 29 checks each as often as it needs, opens a problem after two failures in a row and closes it after two passes, lists every
> problem those checks and the
> website have filed, says in plain words what each check proves and how to fix it when it
> fails, and, when the service it depends on reports a problem on its own status page, says so. It lets you send a test alert to prove an alert would reach someone, and the Owner run
> two heavier tests: a write to the portal's storage, and a real test email to themselves. It replaced two
> older pages, Diagnostics and Alerts, on 2026-10-17. Someone can say "I'm on it" on a problem, or
> quiet it for a few hours with a reason. The Owner can pause a check while something is known to
> be down, set quiet hours for planned work, and choose after how many failures a problem opens.
> Since 2026-10-24 a Logs tab counts every error and warning our Workers write to Cloudflare's
> logs, grouped by what they say, with a one-tap brief to hand to an AI assistant.
> Who may see the technical details, run the checks, take or quiet a problem, close problems, send a
> test alert, run the heavy tests or change the settings is set per person on the Access page.

The page is at `/dashboard/health`, in the sidebar's System group. The two old addresses forward
to it: `/dashboard/alerts` opens the Problems tab and `/dashboard/debug/diagnostics` the Checks tab
(that one only for someone who holds Developer Tools, which its folder still asks for first).
The Alerts page's two registry rows were switched off by migration `0073` the same day, so the
sidebar no longer lists Alerts.

## 1. Who may do what

The page and each action are rows in the page registry (migrations `0072`, `0074`, `0075` and `0076`), so each can be given to
or taken from one person on their Access page. The server checks every one of them; the page only
hides what the server would refuse (`denyHealth` and `healthCan` in `src/lib/auth/surface-guards.ts`).

| Switch | Key | Who has it by default | What it allows |
|---|---|---|---|
| System health | `/dashboard/health` | Manager and above | Open the page: every check's state, the problems, the history |
| See technical details | `/dashboard/health#details` | Admin and above | Error text, response times, raw check output, what each problem said, the compliance records, and the log messages and Copy for AI on the Logs tab |
| Test again | `/dashboard/health#run` | Manager and above | Run one check, or every check, now; Scan now on the Logs tab |
| Acknowledge and snooze | `/dashboard/health#ack` | Manager and above | Say "I'm on it" on a problem, or snooze it for 1, 4 or 24 hours with a reason (migration `0074`) |
| Resolve problems | `/dashboard/health#resolve` | Manager and above | Close a problem, with a reason |
| Resolve while still failing | `/dashboard/health#resolve-anyway` | Owner and above | Close a health check's problem while its check still fails |
| Send a test alert | `/dashboard/health#simulate` | Vendor support | Send a marked test through the real alert channels |
| Run heavy tests | `/dashboard/health#run-heavy` | Owner and above | Run the storage write test, and send a test email to yourself (migration `0075`) |
| Change settings | `/dashboard/health#configure` | Owner and above | Pause a check, add or end a quiet window, set when a problem opens and closes (migration `0076`), and how often the logs are scanned |

A switch opens nothing without the page key. The Owner and Vendor support pass every switch, as
everywhere in the portal. Until 2026-10-17 Diagnostics asked for Developer Tools (Vendor support)
and Alerts for its own page (Manager), whose "Scan" ran the same tests past the Developer Tools key.

## 2. The seven tabs

The page has a look of its own, a patient monitor (the [design](../specs/2026-10-17-system-health-look.md)).
A monitor band sits above the tabs on every tab: the page's name, when it last checked (and, during
a quiet window, until when it is quiet), and three readouts (Failing, Needs a look, Open), each a
button to the list behind it. The seven tabs are one row that scrolls sideways on a narrow phone.

| Tab | What it shows |
|---|---|
| Overview | The band in full: a state word (All working, Needs a look, Something is failing, Not checked yet), one sentence, and a pulse line of the last 30 days, a beat per day at its worst state across the six areas, a dashed line on a day nothing ran. Then what needs someone now (failing checks and the top open problems) and each area with a tick per day |
| Problems | A triage board: lanes by level (Urgent "Look now", Soon "Look today", FYI "When there is time"), open before closed, each problem a ticket that says who filed it, how many times it came, first and last seen, who is on it, and once closed who closed it and why. Open problems someone snoozed wait in a Snoozed lane between the open and the closed ones. Open, Closed or All, and a level. Opening one shows its chart: who is on it and its snooze with the buttons that set them, its check's latest result, last 24 results and how to fix it, Test again, each time it came and each close, by day, and the form that closes it |
| Checks | Every check by area: its state, its last 24 results as ticks, and, opened, what it proves, how to fix it when it fails, and Test again. A paused check says until when and why; a failing check whose provider reports a problem says what its status page reports, with a link to it |
| Logs | The Cloudflare log scan (§3a): where it stands, Scan now, how often it runs, the owner's steps when Cloudflare refuses the token, Errors or Warnings and one Worker on a sideways row, and one card per message with its counts today and in seven days, its likely cause and Copy for AI; below, Sentry's unresolved issues, each with Copy for AI and its link |
| Tests | Check everything now, Send a test alert with the path its channels take, and the heavy tests (§5) |
| History | Every run of the checks that is kept, by day, each with its state words and a bar of how it went; one run's results; the way to closed problems; the compliance records |
| Settings | The paused checks, the quiet windows under way and planned, when a problem opens and closes (§3, "Settings"), and how often the logs are scanned (§3a). Everyone with the page sees them; changing them needs Change settings |

**Counts are per problem.** The open counts on the band, the Problems tab and the level buttons
count each open problem once, however many times it came, at its level. A snoozed problem is not
counted at its level: the band's Open readout and the page's sentence name how many are snoozed. A problem's level is the
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

**On the home page.** For anyone who may open this page, the Overview (redesigned 2026-10-26,
[`DASHBOARD.md`](DASHBOARD.md)) shows a Platform card: the six groups of §3, each with its worst
check's state and sentence and one mark per day for 14 days, and a "Needs you" line when problems
are open or checks fail or need a look. Its Email card quotes the *Email queue* and *Brevo, the
main email sender* checks. All of it comes from the same state row and open counts this page
reads, through `GET /api/dashboard/overview`, which asks `denyHealth` before it reads them. The
home page's status strip and its `GET /api/system-health?summary=1` view were removed with the
old Overview.

## 3. The checks

Twenty-nine checks, defined in `src/lib/health/catalog.ts`, each beside the code that runs it
with what it proves, how to fix it, how urgent a failure is and how often it runs on its own. The
rules that turn what a check read into Working, Needs a look or Failing live apart, in
`src/lib/health/readings.ts`; how a check asks a page, DNS or Cloudflare's analytics is in
`src/lib/health/probes.ts`, and what it reads from other features' tables in
`src/lib/dal/HealthReadsRepository.ts`. Every check only reads. The last two were added on
2026-10-17 (part 3D): the server's site checks and the providers' status pages.

| Check | Area | Level | Runs on its own | What it proves |
|---|---|---|---|---|
| Website and booking pages | Website and booking | Urgent | every 5 minutes | The home page and the booking page open in Spanish and English through the website's private connection and show what guests see: the page in its language, its main content, the booking form's first step. A page is read only until those are found, and never past 1 MB |
| Website's booking and consent systems | Website and booking | Urgent | every 15 minutes | The website's own health report, booking and consent queues included, says nothing is wrong. A report that names a problem, such as bookings that stopped retrying, is a failure |
| Booking and consent heartbeat | Website and booking | Soon | every 15 minutes | The website's hourly heartbeat ran within its window and found nothing wrong |
| Website updates | Website and booking | Soon | every 15 minutes | Changes made in the portal reach the website: none waiting over an hour, none given up in the last 24 hours |
| Website chat assistant | Website and booking | Soon | every 15 minutes | The chat assistant answers its health question |
| Email queue | Email | Urgent | every 5 minutes | Emails leave the queue: how many wait and how long the oldest has waited (from Cloudflare's Queues API), a warning at 5 minutes and a failure at 15 |
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
| Server's site checks | Server and jobs | Soon | every 15 minutes | The server's own checks of the website's and the portal's public addresses and certificates, run every 5 minutes from outside Cloudflare, all pass. A check the server calls down (failing twice in a row) fails here; a first failure, results over 15 minutes old or a server console that does not answer are warnings (*Server is alive* says whether the server is up) |
| Errors and CPU limits | Server and jobs | Soon | hourly | Cloudflare's own count of our seven Workers' last hour: none stopped at a limit (CPU time, memory or requests), and none with 10 errors or more that are also 5% of its requests (fewer errors are a warning). Other Workers in the account are not asked about |
| Request limits | Portal | Soon | hourly | Every one-minute request limit is connected |
| Analytics recording | Portal | FYI | hourly | The analytics store is connected (checked without writing) |
| Sentry, the error tracker | Portal | Soon | hourly | Sentry accepts the portal's key |
| Providers' status pages | Portal | FYI | hourly | Cloudflare, Supabase, Brevo, Resend and Sentry report no outage on their public status pages. Only a major or critical report is a warning; a minor one is named in a pass, as Cloudflare's page names a minor issue somewhere in its network most days |

**Running on their own.** The `health-checks` job in the five-minute scheduler
(`src/workers/scheduled-health-checks.ts`; [`CRON-CONTROL.md`](CRON-CONTROL.md) §3e) runs each
check at its interval, at most nine in one run. The checks average just over eight a run (four
every five minutes, ten every 15, twelve hourly, three daily: 2,403 a day over 288 runs), so where
each one first runs matters: its first run after release places every check on the run that keeps
the busiest run of the day at nine (`placeNew` in `src/lib/health/state.ts`), and a check a later release adds is
placed the same way around the checks already running. Each check then keeps its place: a run
moves its next due time on by whole intervals, so a check that had to wait a run, or the checks
after a pause, go back to their places instead of drifting. When a run has more due than nine,
the five-minute checks go first, then the most overdue; after a pause of two hours, every check has
run again within five runs. It can be paused on the Scheduled jobs page like any job; while it is
paused, checks run only when someone presses Test again. Until 2026-10-17 that was the only way a
check ran. The most was eight until part 3D: eight a run hold 2,304 checks a day, fewer than the
2,403 the two new checks bring, and ten 15-minute checks fill some runs to eight on their own.

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
A recovery asks to close once, on the run whose passes in a row reach the number, so a threshold
lowered in Settings during a recovery still closes it on the next pass.

**Unstable checks.** A check that keeps failing and recovering files one problem that says so,
instead of one per failure (the Nagios rule: the share of changes between failing and not in its
last 21 results, newer ones weighing more, reaches 30%). While it is unstable the check opens and
closes nothing; the problem closes itself when the share falls to 15% or below ("Steady again"). A
check that moves between Working and Needs a look is not unstable, as a warning never opens a
problem. FYI checks never open a problem.

**Settings.** Three things on the Settings tab change these rules, kept in one row
(`health-config`, `src/lib/health/config.ts`) and changed through `POST /api/system-health/settings`,
ten changes a minute per person, each recorded as `health_configure` with what changed. Two people
changing them at once never overwrite each other (compare-and-swap).

- **Pause a check** for 1 hour, 4 hours, 1 day, 3 days or 7 days, with a reason. A paused check
  does not run on its own and files no problem until the pause ends, then runs on the job's next
  run; Test again still runs it and shows the result. It is for something known to be down or
  being changed, so its failures are not reported over and over. Resume ends a pause early.
- **Quiet windows** for planned work: from now or a time up to 30 days ahead, for 1, 2, 4, 8 or
  24 hours, with a reason, at most ten at once. During one, problems are still filed and listed,
  but quietly: their row and the Worker log, no Sentry event and no alert email, from the portal's
  checks and from the website, whose alert gate reads the same row
  (`cf-astro/src/lib/alert-gate.ts`). A problem filed quietly keeps the window's end in what it said.
  End now or Remove ends one.
- **When a problem opens and closes:** after how many failures in a row a problem opens, and after
  how many passes it closes by itself, each from 1 to 5. Both start at 2.

**Limits.** Test again runs one check at most once a minute, and Check everything now at most once
every two minutes; the stored results are the clock, so a check the job just kept counts too. At
most six checks run at a time, each stops waiting after ten seconds, and in the job and Test again
a failure is tried once more before it counts, one at a time once every check has run. The job
itself starts only once the five-minute tick's other jobs have finished (`runLast`,
[CRON-CONTROL.md](./CRON-CONTROL.md) §5). Both since 2026-10-21, so the checks do not queue
behind the other jobs' requests: the tick, every job it calls and every Worker those reach share
six requests that may wait for an answer at once (Cloudflare's simultaneous connections limit).

**A website timeout is cross-checked (the owner's choice, 2026-10-22).** For a few minutes at a
time, several times a day, the portal's private connections to our other Workers (the website,
the chat assistant, the server console, the email service) stop answering the portal's
scheduled runs, all together, while guests are served and the server's checks from outside
pass. Each time, *Website and booking pages* and *Website's booking and consent systems* timed
out, filed a critical problem and emailed. The cause is inside Cloudflare and is not found yet
(MAINTENANCE.md (private) SH-10). Now, in the job, a failure of either of those two
checks that is only a timeout becomes a warning, with no problem and no email, when the
server's own site checks from outside (*Server's site checks*) passed within the last hour;
warnings at the end of its readings (the server console, behind the same kind of connection,
did not answer either: three runs in a row on 2026-10-22) are read past to the pass before them
(`crossCheck` in `src/lib/health/run.ts`). A timeout is recognised by its error's name or, as it
arrives in production, by its message. When the server console did
not answer either, so there is no recent outside reading (2026-10-22 14:16 UTC, after it went
unread run after run), both stalling at once points at the portal's own connections rather than
the website: the timeout is a warning while the check itself passed within the last hour, and a
failure once it has not passed for over an hour (the owner's second choice that day). Failing
from outside, or with the console answering but no recent pass, it stays a failure. The same hour
applies to *Email queue*, which reads Cloudflare's own Queues API over the internet: a reading
that only timed out is a warning while the queue last read fine within the hour (2026-10-22, 15:36
to 16:01 UTC, during a Cloudflare outage, it could not be read three times while it held nothing
before and after, and filed a critical problem). So does *Website chat assistant* and *Email
service: stuck and failed mail*, read through the portal's private connections to them, which
stall for minutes at a time (MAINTENANCE SH-10): on 2026-10-23 both timed out in the same runs and
passed the run after, and each filed a problem for failing and recovering. A wrong answer (an error status, a missing part of
a page, a report that names a problem) is never softened, and Test again and Check everything now
show the raw result. Check everything now tries each check once: 29
checks each tried twice could pass the 50 requests a Worker invocation may make on the free plan,
a limit calls to our other Workers count towards as well. Tried once, they made 24 outside requests
and 8 calls to our other Workers in the test that pins it (`test/system-health-checks.test.ts`). A
person's run leaves the checks' places in the schedule as they were. The waiting does not count
towards the Worker's CPU time.

**Providers' status pages.** The *Providers' status pages* check reads each provider's public
status page at its `api/v2/status.json` address (the Statuspage format all five answer, under a kilobyte; an answer far larger
is not parsed): five requests an hour, with no key. Sixteen checks name the provider they depend on
(`provider` in the catalog): Cloudflare for the website's pages and systems, the email queue and
email service, the database, its allowance and tables, storage, the portal's Cloudflare sign-in,
the scheduled jobs and the Workers' errors; Brevo, Resend, Supabase (two checks) and Sentry for
their own. When one of them fails or needs a look and the newest providers result, at most two
hours old, says its provider reports anything but "none", the Checks tab says what that status
page reports, with a link to the page from the portal's own list, never one the page sent
(`providerTrouble` in `src/lib/health/view.ts`). The note is on the page only (§7).

**The server's site checks.** The server checks the website's and the portal's public addresses
and certificates every 5 minutes from outside Cloudflare, and reports a check that goes down or a
certificate close to running out to Sentry itself (`cf-vps/host/72-probes/apply.sh`). The
*Server's site checks* check reads that report through the server console as the `health-checks`
job: a GET of the console's diagnostics with a `system` actor (`vpsSystemRead` in
`src/lib/vps-proxy.ts`), which cf-vps answers with that one read and refuses every other
([VPS-CONSOLE](VPS-CONSOLE.md) §3). Which addresses are checked, and how many days a certificate
must have left, are the server's settings. The words name what failed ("the Spanish website",
"the portal's certificate"); the addresses are in the technical part only.

**Who watches the checks.** If the portal's scheduler stops, the checks stop with it and nothing on this page can say so. So
each run of the checks job stamps the state row with when it ran (`tick`; a person's Test again
leaves it alone), and the website's hourly heartbeat, which the server runs, reads it
(`cf-astro/src/lib/heartbeat.ts`). When the job last ran more than 30 minutes ago, the heartbeat's
answer fails with a line saying so: the server's heartbeat job fails, and the server reports a
failed job to Sentry. The heartbeat's own record (`heartbeat-last-run`) keeps only its booking and
consent verdict, so the *Booking and consent heartbeat* check does not blame the website once the
portal is back. A state row without a stamp (before 2026-10-17) is only a notice.

## 3a. The Cloudflare log scan (Logs tab, 2026-10-24)

Every error and warning our Workers write to Cloudflare's Workers Logs, counted and grouped by
what it says, so a fault shows here without someone reading the log list line by line. Asked for
on 2026-10-24 after 47 errors were found by hand in the dashboard; the plan was the owner's pick
"Scanner + Issues", of which this is the first part (§7).

**What it reads.** The job `log-scan` ([`CRON-CONTROL.md`](CRON-CONTROL.md) §3f) asks Cloudflare's
Workers Observability query API one question per window: count the events of our Workers (the
portal, the website, the email sender and API, the backup and server consoles, the chat
assistant) whose level is error or warn, or that carry an error, grouped by Worker, level, message
and error. Cloudflare does the counting, so every event of the window is counted however many
there are. The client's Workers on the account are never asked about. Each scan reads from where
the last ended to two minutes ago, so every minute is read once; at most six questions a scan, in
slices of up to six hours, and a slice Cloudflare answered from a sample is split and asked again.
Cloudflare keeps the logs three days, so after a longer pause the scan starts three days back and
the tab names the stretch it could not read. It uses the Cloudflare token and account the
dashboard already uses; the token needs the **Workers Observability: Read** permission (newer
dashboards call it "Metadata Read-Only" under Workers), and until it has it Cloudflare refuses and
the tab says so.

**What it keeps.** One group is one Worker, one level and one message with its changing parts
masked: addresses, IP addresses, ids, long tokens and numbers (an HTTP status stays, since 500 and
503 are different faults). So the same fault with another id is one group, and nothing personal is
stored. Each group keeps a count per UTC day for seven days, at most 60 groups, the most recent
first, in the row `log-scan-state` (§6). A count Cloudflare estimated from sampled logs says
"estimated": the website keeps one request in five (its `head_sampling_rate`).

**What the tab shows.** Where the scan stands (read up to when, the last scan, or why it stopped),
Scan now (Test again, at most once every two minutes, recorded as `health_run` on `log-scan`), and
the groups. With Details each card shows the masked message, a likely cause when the message
matches one this platform has met (CPU or memory limit, too many outside calls, a hung request, a
D1 fault, a timeout, a network fault, text that is not JSON, refused credentials, a rate limit), and
**Copy for AI**: a plain-text brief with the Worker, its repository, the counts per day, the
likely cause and four steps for an assistant to start on it. Copy all for AI copies the briefs of
the cards shown, and Sentry's below. How often it scans is on the Logs tab and on Settings (the
same setting, changing it needs Change settings): every 15 minutes, hourly (the default), every 4
or 6 hours, or off; each scan starts where the last ended, so scanning less often skips nothing.
When Cloudflare refused the token, the tab shows the owner's five steps to add the permission to
that same token (`MAINTENANCE.md` LS-1).

**Sentry issues.** Below the groups, the tab lists Sentry's unresolved issues of every project
(the portal, the website, the server), the ten most frequent of the last 14 days, read with one
call to Sentry's organisation issues API each time the tab opens and never stored
(`getOrgIssues` in `src/lib/control-plane/sentry-admin.ts`, the dashboard's existing Sentry
token). Each card shows the level, the issue's short id, its events, the people it reached and
when it was last seen; with Details also its title, where it happened, **Copy for AI** (a brief
with the project, its repository, the counts and the link, built by `sentryBrief` in
`src/lib/health/logscan.ts`) and Open in Sentry. Without a Sentry token the list says it is not
set up; when Sentry refuses or does not answer, it says so and the log scan still shows.

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

**Who is on it.** "I'm on it" puts the person's email address on the problem's open rows (`acked_by`,
`acked_at`, migration `0074`), so everyone sees on the ticket and in its chart who has taken it.
It ends when those rows close; a problem that opens again starts with nobody on it. Pressing it
again moves it to whoever pressed last.

**Snoozing.** A snooze quiets a problem for 1, 4 or 24 hours and needs a reason (3 to 200
characters). It is written on the open rows (`snoozed_until`, `snooze_reason`) and belongs to the
problem: the latest end among its rows counts. The snoozer is also on it, unless someone already
is. While it lasts, the problem waits in the Snoozed lane and is counted apart, and a health
check that opens the problem again files it quietly: its row and the Worker log, with no Sentry
event and no alert email, the snooze's end in its context (`fireAlert` with `quiet` in
`src/lib/alert-gate.ts`, `src/lib/health/run.ts`). "End the snooze" stops it at once. When it
ends, the problem is counted and alerted as before. The website reads the snooze too before it
alerts: while one lasts, a problem it files again goes only to its row and its own log
(`cf-astro/src/lib/alert-gate.ts`).

Saying "I'm on it", snoozing and ending a snooze share a limit of ten a minute per person, refuse
compliance records and test alerts, answer 409 when nothing is open (or nothing is snoozed), and
are recorded as `health_ack`, `health_snooze` (with the reason and the end) and
`health_unsnooze` (PATCH `/api/system-health/problems`).

**Repeats on one row.** A row can stand for several times a problem came (`repeats`, and
`last_seen_at` for the last time, migration `0074`): a problem's count adds its rows' repeats up,
its last time is the latest of them, and its chart counts each time on the day it last came. The
website adds them (`cf-astro/src/lib/alert-gate.ts`, since 2026-10-17): a problem it files again
while a row at the same level is still open adds one to that row and sends no second email.
Sentry still gets each time, the ARCO records below are never folded, and without the columns or
without D1 the website files and emails every time, as before.

**What is never a problem.** The website's ARCO records (`arco_get_document`, each identity
document from a privacy request handed out, and to whom) are compliance records: they are listed
under History, need "See technical details" because they name staff and requests, and cannot be
closed or deleted here. Test alerts are closed the moment they are filed and listed nowhere.

**The AI allowance.** The portal warns when the day's AI spend crosses 80% of the allocation, and
files an urgent problem when it reaches the line where new AI writing is refused for the day
(`alertOnNeuronThreshold` in `src/lib/ai/telemetry.ts`). Until 2026-10-17 the urgent one could
never fire: it waited for the full allocation, which the portal's reserve keeps it from reaching.

## 5. Send a test alert, and the heavy tests

Send a test alert sends a clearly marked test through the same channels a real problem uses and says what each one
did: the Worker log, the problem list (closed at once), Sentry, and, for a test like an Urgent
problem, the alert email. That email goes only to the person who pressed it, marked as a test,
never to the hotel's alert inbox: the email service sends it at most once an hour per person
(cf-email-consumer `handlePlatformAlert`, `test: true`). Before sending, the route asks the email
service whether alert emails are on (`GET /admin/health`, as the checks job does): when they are
off, no email is queued and the answer says "Not sent: alert emails are off", since a real problem
would not be emailed either; when the service cannot say, the email is queued and the answer says
it could not tell. A test like a Soon problem sends no email, and the answer says so. Three a minute per
person, recorded as `health_test_alert`. Until 2026-10-17 the test left an open alert naming the
person who sent it, and its pop-up called a queued email "delivered"; until the same day's part 3,
an urgent test's email went to the alert inbox like a real alert.

**The heavy tests** (Run heavy tests, `POST /api/system-health/heavy`, `src/lib/health/heavy.ts`)
are the two that write or spend an allowance, so the checks never run them on their own; the
background *File storage and sign-in sessions* check only reads.

- **Test storage writes** writes one small item to the sign-in session store (KV) and the staff
  file storage (R2), reads it back and deletes it, and says for each how it went, how long it took
  and, when it failed, which step: the write, the read back or the delete. The session store's
  item also expires on its own after a minute. It never touches the public image storage.
- **Email me a test** sends one real email to the address of the person who pressed it, never
  anyone else, through the email queue and the email service like every portal email, with its
  row in the email ledger (`email_audit_logs`, source `system-health`). Its pop-up then follows
  that row every three seconds for at most 90 seconds (`GET ?email=`, which answers only for an
  email sent to the person asking): queued, then sent and by which provider, read from the message
  id the email service records (Brevo's relay ids, Resend's ids), and how long after queueing; then
  delivered once Brevo reports it. A bounce, spam or a failure shows as failed, its reason only
  with "See technical details". When no delivery report comes within the 90 seconds, it says so
  and asks the person to look in their inbox. It spends one of Brevo's 300 sends a day.

Three heavy tests a minute per person, and thirty looks a minute while following the email. Each
test is recorded as `health_heavy_test`, with how each store did or the email's tracking id.

## 6. What is stored, and for how long

| Where | What | Kept |
|---|---|---|
| D1 `system_test_results` | A check's result: the run, the check, its level, status, time taken, the plain summary, the technical part as JSON, and the id of the person who ran it (`system` for the job, whose runs are `auto-…`). Kept: every result someone ran, and from the job every change of state plus one an hour per check, about 630 rows a day with 29 checks | 30 days; the job deletes older results on its first run after 03:00 UTC |
| D1 `admin_portal_settings` row `health-config` | System health's settings (§3, "Settings"): each paused check's end, reason and the email address of the person who paused it; each quiet window's start, end, reason and the address of the person who added it; the two thresholds; and how often the logs are scanned. Read by the checks job with the state in one query, by Test again, and by the website's alert gate | A pause or window is dropped from the row by the next change after it ends |
| D1 `admin_portal_settings` row `health-state` | What System health remembers between runs (`src/lib/health/state.ts`): each check's latest state and words, when it ran and when it is next due, its failures and passes in a row, its last 21 states, and per day its worst state and how many results, for 30 days; and when the job last ran on its own (`tick`), which the website's hourly heartbeat reads (§3). About 27 KB with 29 checks, written by every run (compare-and-swap, so the job and Test again never lose each other's results) | Replaced on each run; the days older than 30 drop out |
| D1 `admin_portal_settings` row `log-scan-state` | The log scan (§3a): where the last scan ended, when it ran, whether Cloudflare refused, a stretch it could not read, and up to 60 groups, each a Worker, a level, the message with ids, addresses, IP addresses, tokens and numbers masked, and a count per day. No full log line and nothing personal | Days older than seven drop out at each scan; written once a scan, compare-and-swap |
| D1 `platform_alerts` | Problems, compliance records and test alerts; who closed a problem and why; since `0074` who is on it and since when, a snooze's end and reason, and a row's repeats and when it last came | No automatic clean-up yet |
| D1 `admin_audit_log` | `health_run`, `health_resolve`, `health_test_alert`, `health_ack`, `health_snooze`, `health_unsnooze`, `health_heavy_test`, `health_configure` | The activity log's own rules |
| Supabase `email_audit_logs` | The test email's ledger row: the presser's address, the subject and body, source `system-health`, and what the email service and Brevo record about it | The email ledger's own rules |

No new table, binding, secret or cron trigger: the results table is the one Diagnostics wrote, the
problems table the one Alerts read, and the state, the settings and the log scan are three rows of the settings table. The checks
use what the portal already had: `RESEND_API_KEY` and `BREVO_API_KEY`, the `ASTRO_SERVICE`,
`EMAIL_CONSOLE` and `VPS` bindings, and the Cloudflare token and account the Scheduled jobs page and the
dashboard already use. The five public status pages need no key; reading them was approved with
the plan (item 37). The email queue's size comes from Cloudflare's Queues API with that token,
as the dashboard reads it, not from the `EMAIL_QUEUE` binding: Sentry's wrapper around a queue
binding breaks its `metrics()` (MAINTENANCE SH-7). The email service answers its counts on a route of its
own Console (cf-email-consumer `docs/features/EMAIL-API.md`). Results
written by Diagnostics before 2026-10-17 stay until the clean-up removes them, and History does
not list them.

## 7. Not built yet

Nothing of the plan of 2026-10-17 is left to build. Of the log scan plan of 2026-10-24 (§3a), the
scanner, the Logs tab, Copy for AI and Sentry's issues beside Cloudflare's are built; still to
build: a problem filed for a new error that repeats or a fault across several Workers at once, and
Cloudflare's own grouping of errors (Workers Issues) in each repository. The providers' notes are on the Checks tab
only: a problem and its alert email do not say what a provider's status page reported. Other services'
problems reach the list through the checks that watch them: *Scheduled jobs on time*, *Backup is
fresh*, *Server is alive*, the email service's stuck emails and the booking and consent
heartbeat (§3).

## 8. Verification log

| Date | What was checked | What was not |
|---|---|---|
| 2026-10-24 | §3a (new), §1's three rows, §2's tab table, §6's two rows and §7 against `src/lib/health/logscan.ts`, `src/workers/scheduled-log-scan.ts`, `src/pages/api/system-health/logs.ts`, `src/lib/health/config.ts` (`logScanMinutes`), `LogsPanel.tsx` and `SettingsPanel.tsx`; `test/log-scan.test.ts` (masking, causes, the answer's shape, windows, the job, the route's access and limit, the setting, the brief) passes; Cloudflare's request and answer shapes from its API SDK (cloudflare 7.3.0, `workers/observability/telemetry`) | A live scan: the token lacks the permission when written, so the answer's shape is checked by the code at run time, not against a real answer. The rest of the document not re-read |
| 2026-10-24 | §3a's Sentry issues, the interval row and the token steps on the Logs tab, §2's Logs row and §7, against `getOrgIssues` in `src/lib/control-plane/sentry-admin.ts`, `sentryBrief` in `src/lib/health/logscan.ts`, `src/pages/api/system-health/logs.ts` and `LogsPanel.tsx`; `test/log-scan.test.ts` (23, two new for the Sentry list) passes; the live issue list read through the Sentry connector (three projects, one unresolved issue) | The portal's own call to Sentry's organisation issues API live: the same token reads project issues for the Cloud Services page, but this endpoint was not called with it. The rest of the document not re-read |
| 2026-10-23 | §3's hour of grace for *Website chat assistant* and *Email service: stuck and failed mail* against `READ_TIMEOUT_GRACE` and `crossCheck` in `src/lib/health/run.ts`, `isTimeout` in `src/lib/health/readings.ts` and the email service check in `src/lib/health/catalog.ts`, pinned by `test/system-health-checks.test.ts`; both checks' readings read live through the Cloudflare D1 connector (`health-state`) and Sentry CF-ADMIN-2C, 2H and 2J (timeouts) | Why the connections stall (SH-10). The rest of the document not re-read |
| 2026-10-22 | §3's hour of grace for *Email queue* against `READ_TIMEOUT_GRACE` and `crossCheck` in `src/lib/health/run.ts` and the check in `src/lib/health/catalog.ts`, pinned by `test/system-health-checks.test.ts`; the case read live through the Cloudflare D1 connector (`system_test_results` and `platform_alerts`, 15:36 to 16:30 UTC) | Whether Cloudflare's Queues API slowed for the outage or for another reason. The rest of the document not re-read |
| 2026-10-22 | §3's cross-check when the server console did not answer either, against `crossCheck`, `lastPassAt` and `SERVER_UNANSWERED` in `src/lib/health/run.ts` and `src/lib/health/catalog.ts`, pinned by `test/system-health-checks.test.ts`; the case read live through the Cloudflare D1 connector (`health-state` and `system_test_results`, 2026-10-22 14:17 UTC) | Whether it holds through the next stalled hours. The rest of the document not re-read |
| 2026-10-22 | The cross-check after its first live morning (D1 connector): 4 critical problems still filed from 09:02 UTC, because the timeouts reached `attempt` without the `TimeoutError` name and the server console went unread for three runs in a row; now matched on the message, and the outside reading may be an hour old with trailing warnings read past; pinned by `test/system-health-checks.test.ts` | Whether it holds through the next busy hours |
| 2026-10-22 | §3's cross-check paragraph against `crossCheck` and `outsidePassAt` in `src/lib/health/run.ts` and its call in `src/workers/scheduled-health-checks.ts`, pinned by `test/system-health-checks.test.ts`; the 2026-10-21 row below corrected: the 21:00 UTC run after `runLast` timed out the same way, and so did a 20:45 run with one check alone (read through the Cloudflare D1 connector), so the queue was not the cause | Whether the false emails stop: read from the results after the push. The rest of the document not re-read |
| 2026-10-21 | §3's limits: the retry after the run in `src/lib/health/run.ts` and `runLast` in `src/lib/jobs/dispatch.ts`, pinned by `test/system-health-checks.test.ts` and `test/jobs-cron-dispatch.test.ts`; the cause read in production through the Cloudflare D1 connector (`system_test_results` of the last 8 hours: every timeout of `website`, `website_pages`, `chatbot` and `server_probes` fell on a tick that ran 5 to 9 checks, and the same checks passed 5 minutes later; `platform_alerts`: the critical problems of 2026-10-19 to 21 were `website` and `website_pages`, each "The operation was aborted due to timeout" or "keeps failing and recovering") and Cloudflare's limits page (connections are counted from the top-level request, Workers reached through service bindings share them) | Whether the alerts stop: read from the results of the hours after the push. The rest of the document not re-read |
| 2026-10-17 | Part 3D live, read back through the Cloudflare D1 connector after the push: the job placed both new checks; *Providers' status pages* ran at 10:20 UTC and read all five pages (Cloudflare's reported a major incident, so it needed a look); *Server's site checks* ran at 10:30 UTC and passed, all 7 of the server's checks, the soonest certificate 76 days away | The blue note on a phone |
| 2026-10-17 | Part 3D: the TL;DR, §2's Checks row, §3's count, table, running on their own (nine a run), limits, providers' status pages and the server's site checks, §6 and §7 against `src/lib/health/catalog.ts`, `src/lib/health/probes.ts` (`STATUS_PAGES`, `askStatusPage`), `src/lib/health/readings.ts` (`readProviders`, `readServerProbes`), `src/lib/health/state.ts` (`MAX_PER_TICK`), `src/lib/health/view.ts` (`providerTrouble`), `src/pages/api/system-health/index.ts`, `src/lib/vps-proxy.ts` (`vpsSystemRead`) and `src/components/admin/health/ChecksPanel.tsx`; pinned by `test/system-health-readings.test.ts`, `test/system-health-checks.test.ts` (the 24 and 8 requests), `test/system-health.test.ts`, `test/system-health-state.test.ts`, `test/vps-proxy.test.ts` and `test/jobs-budget.test.ts`. The five status pages read before writing: each answered `status.indicator` and `status.description`. The cf-vps side live in cf-vps `3f52d9a`, against `cf-vps/contract/capabilities.ts` and `cf-vps/src/http/router.ts`. The state row's 27 KB is scaled from 25 KB for 27 checks, not measured | A live run of the two checks and the note on a phone: written before the push |
| 2026-10-17 | Settings (migration `0076`, applied live first and read back through the Cloudflare D1 connector: the `#configure` row, owner): the TL;DR, §1's row, §2's band, Checks and Settings rows, §3's closing and "Settings", §6 and §7 against `src/lib/health/config.ts`, `src/lib/health/state.ts`, `src/lib/health/run.ts`, `src/workers/scheduled-health-checks.ts`, `src/pages/api/system-health/settings.ts`, `src/pages/api/system-health/index.ts` and `src/components/admin/health/SettingsPanel.tsx`; pinned by `test/system-health-settings.test.ts`, `test/system-health.test.ts` and `test/action-keys-enforced.test.ts`. The website's side against `cf-astro/src/lib/alert-gate.ts` | The tab on a phone, which the owner tests after the push |
| 2026-10-17 | The test alert's email to the presser (§5) against `src/pages/api/system-health/test-alert.ts`, `fireAlert` in `src/lib/alert-gate.ts` (`testEmailTo`), `emailServiceHealth` in `src/lib/email-console.ts` and `cf-email-consumer/src/handlers.ts` (`handlePlatformAlert`, live in cf-email-consumer `0cd6915`); pinned by `test/system-health.test.ts` | A live urgent test, which the owner sends on a phone after the push |
| 2026-10-17 | The heavy tests (migration `0075`, applied live first and read back through the Cloudflare D1 connector: the `#run-heavy` row, owner): §1's row, §2's Tests row, §5's heavy tests, §6 and §7 against `src/pages/api/system-health/heavy.ts`, `src/lib/health/heavy.ts`, `src/components/admin/health/HeavyTests.tsx` and `src/lib/dal/EmailAuditLogRepository.ts`; the status words against `cf-email-consumer/src/handlers.ts`, `cf-email-consumer/src/index.ts` and `cf-email-consumer/src/dlq.ts` and the Brevo webhook (`src/pages/api/emails/webhook.ts`); pinned by `test/system-health-heavy.test.ts`, `test/system-health.test.ts` and `test/action-keys-enforced.test.ts` | A live test email and storage write, which the owner runs on a phone after the push |
| 2026-10-17 | The home page's card (§2 "On the home page") against `src/pages/api/system-health/index.ts`, `healthGlance` in `src/lib/health/view.ts`, `glanceWords` in `src/components/admin/health/health-model.ts`, `src/components/dashboard/widgets/ServiceStatusStrip.tsx` (removed 2026-10-26), `DashboardController.tsx` and `src/pages/dashboard/index.astro`; pinned by `test/system-health.test.ts` and `test/system-health-board.test.ts`. The website's side of §4, live in cf-astro `5d3b5ee`, against `cf-astro/src/lib/alert-gate.ts`. The run stamp read live through the Cloudflare D1 connector: `tick` written at 07:55:42 UTC, the first run after cf-admin `950b899`; *Scheduled jobs on time* passed twice and no health problem is open. §7 re-read against the plan | The card on a phone, which the owner tests after the push; a live repeat and a stale stamp, which wait for the website to file one and for a stopped scheduler |
| 2026-10-17 | Acknowledge and snooze, and repeats on one row (migration `0074`, applied live first and read back through the Cloudflare D1 connector: the six columns and the `#ack` registry row): §1's row, §2, §4's new paragraphs, §6 and §7 against `src/pages/api/system-health/problems.ts`, `src/lib/dal/PlatformAlertsRepository.ts`, `src/lib/health/run.ts`, `src/lib/alert-gate.ts`, `src/lib/health/view.ts` and `src/components/admin/health/`; pinned by `test/system-health-ack.test.ts`, `test/system-health-board.test.ts` and `test/action-keys-enforced.test.ts`; §3's last paragraph and §6's `tick` against `applyResults` and `parseState` in `src/lib/health/state.ts`, pinned by `test/system-health-state.test.ts`. The fix of the row below, read live: *Email queue* passed at 07:15 UTC and its problem closed itself at 07:20; *Scheduled jobs on time* passed at 07:25 ("All 17 scheduled jobs are running") | The buttons on a phone, which the owner tests after the push; the website's side of repeats and snoozes, not built yet |
| 2026-10-17 | The first live results of part 2B, read through the Cloudflare D1 connector (`system_test_results`, `platform_alerts`): 21 checks passed; *Email queue* failed with "Illegal invocation" (Sentry's queue wrapper, `@sentry/cloudflare` 10.73.0 `instrumentQueueProducer.js`) and *Scheduled jobs on time* could not read Analytics Engine. §3's queue row and §6 against the fix (`askQueue` in `src/lib/health/probes.ts`; the failures question keeps the column name `timestamp`, as `src/lib/jobs/history.ts` does), pinned by `test/system-health-checks.test.ts` | Why Analytics Engine refused the aliased question: the check now shows its answer, read from the next live result |
| 2026-10-17 | The 27 checks of part 2B: §3's table, the placing and keeping of places, the limits, §6 and §7 against `src/lib/health/catalog.ts`, `src/lib/health/readings.ts`, `src/lib/health/probes.ts`, `src/lib/dal/HealthReadsRepository.ts`, `src/lib/health/state.ts`, `src/lib/health/run.ts` and `src/workers/scheduled-health-checks.ts`; the rules pinned by `test/system-health-readings.test.ts`, the checks against stand-in services by `test/system-health-checks.test.ts`, the placing by `test/system-health-state.test.ts` (from the live state's last runs, and after pauses), the cost by `test/jobs-budget.test.ts`; the domain's mail records, the Brevo and Resend answers, the live tables' sizes and the website's pages read before writing | A live run of the new checks: written before the push; whether the queue binding reports its size, whether Cloudflare's analytics take the list of our Workers and whether the booking pages open through the binding are read from the first live results |
| 2026-10-17 | The checks on their own: §3 (the intervals, running on their own, what a failure does, closing by itself, unstable checks, the limits), §4's closing, §6 and §7 against `src/workers/scheduled-health-checks.ts`, `src/lib/health/state.ts`, `src/lib/health/run.ts`, `src/lib/health/catalog.ts` and `src/pages/api/system-health/`; pinned by `test/system-health-state.test.ts`, `test/health-checks-job.test.ts` and `test/system-health.test.ts`; the result rows a day counted from the code | A live run: written before the push; the owner's phone test follows |
| 2026-10-17 | §2 for the new look: the tabs, the band, the per-problem counts, the level filter and the address, against `src/components/admin/health/`, `src/styles/pages/health.css` and the two repositories; the counts and the filter by `test/system-health.test.ts`, the pieces by `test/system-health-board.test.ts` and `test/system-health-look.test.ts` | The rest of the page, unchanged since the rows below; the look on a phone, which the owner tests after the push |
| 2026-10-17 | The `0073` sentence: the two Alerts rows read back switched off through the Cloudflare D1 connector after it was applied | The rest of the page, unchanged since the row below |
| 2026-10-17 | Written with the code: every claim above against `src/lib/health/`, `src/pages/api/system-health/`, `src/components/admin/health/`, the two repositories and `migrations/0072_system_health.sql`; the live tables read through the Cloudflare D1 connector before the migration (`platform_alerts`: 35 rows from the website, none open; `system_test_results`: 68 rows from four Diagnostics runs; the one Developer Tools grant belongs to an Owner, who passes the new key anyway); `test/system-health.test.ts` and the updated tests | The page on a phone, which the owner tests after the push |

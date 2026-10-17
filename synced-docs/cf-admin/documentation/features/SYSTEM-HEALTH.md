---
title: "System health (checks, problems and test alerts)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-17
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/dashboard/health.astro, src/components/admin/health/, src/styles/pages/health.css, src/lib/health/, src/lib/dal/HealthResultsRepository.ts, src/lib/dal/PlatformAlertsRepository.ts, src/lib/schemas/health.ts, src/pages/api/system-health/, src/lib/auth/surface-guards.ts, src/lib/alert-gate.ts, src/lib/ai/telemetry.ts, migrations/0072_system_health.sql, test/system-health.test.ts, test/system-health-board.test.ts, test/system-health-look.test.ts, test/debug-access.test.ts, test/action-keys-enforced.test.ts, test/hot-query-plans.test.ts, test/ai-telemetry.test.ts]
related_docs: [../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../operations/DEV-TOOLS.md, ../reference/schema-change-ledger.md, ../records/reports/2026-10-17-system-health.md, ../specs/2026-10-17-system-health-look.md, ../records/reports/2026-10-17-system-health-look.md]
tags: [health, alerts, diagnostics, monitoring, permissions, ui]
---

# System health

> **TL;DR (non-technical):** One page answers "is everything working?". It checks the website,
> email, the data, security and the portal itself, lists every problem those checks and the
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
| Overview | The band in full: a state word (All working, Needs a look, Something is failing, Not checked yet), one sentence, and a pulse line of the last 30 days, a beat per day at its worst state across the five areas, a dashed line on a day nothing ran. Then what needs someone now (failing checks and the top open problems) and each area with a tick per day |
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

Opening the page runs nothing: it reads the stored results, and reads them again every minute
while the page is on screen (never in a hidden tab). When that re-read finds the open counts
changed, Problems reads its first page again. Until 2026-10-17 opening Diagnostics ran every
test, and three of them wrote test data.

## 3. The checks

Fifteen checks, defined in `src/lib/health/catalog.ts`, each beside the code that runs it with
what it proves, how to fix it and how urgent a failure is. Every check only reads.

| Check | Group | Level | What it proves |
|---|---|---|---|
| Website and booking systems | Website | Urgent | The website answers through its private connection and its own health report, booking and consent queues included, says nothing is wrong |
| Website chat assistant | Website | Soon | The chat assistant answers its health question |
| Brevo, the main email sender | Email | Soon | Brevo accepts the portal's key and the account is active |
| Resend, the backup email sender | Email | Soon | Resend accepts the portal's own key (the email service holds its own, which this does not check) |
| Shared database | Data | Urgent | The shared Cloudflare D1 database answers, and how fast |
| Database tables | Data | Urgent | The tables the portal cannot work without exist |
| Supabase | Data | Urgent | Supabase answers |
| File storage and sign-in sessions | Data | Soon | The image storage, the staff file storage and the session store answer, read only |
| Portal is not public | Security | Urgent | A visitor who is not signed in is sent to this portal's Cloudflare sign-in, at its exact address |
| Supabase security advisor | Security | Urgent | Supabase's own security advisor finds nothing serious |
| Website's protective headers | Security | Soon | The public website sends its HTTPS-only and file-type headers, and its content and referrer rules |
| Activity log | Security | Soon | The activity log is still being written |
| Request limits | Portal | Soon | Every one-minute request limit is connected |
| Analytics recording | Portal | FYI | The analytics store is connected (checked without writing) |
| Sentry, the error tracker | Portal | Soon | Sentry accepts the portal's key |

A result is one of four: Working, Needs a look, Failing, or Not set up (a key or binding the check
needs is missing here, so it says nothing either way). The portal's own security headers are not
checked at run time: they are fixed in code and pinned by `test/csp.test.ts`.

**Levels.** Urgent means guests cannot book, data is at risk or the portal is exposed; Soon means
it will hurt within hours or days; FYI is shown only.

**What a failure does.** When a run finds an Urgent or Soon check failing and no problem is open
for it yet, it files one (`src/lib/health/run.ts`): an urgent problem goes to the problem list,
Sentry and the alert email; a soon one to the problem list and Sentry. A check that keeps failing
files nothing more until its problem is closed.

**Limits.** One check runs at most once a minute and Check everything now at most once every two
minutes; the stored results are the clock. At most six checks run at once, each stops waiting
after ten seconds, and a failure is tried once more before it counts. The waiting does not count
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
"Resolve while still failing". Closing is limited to ten a minute per person and recorded in the
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
| D1 `system_test_results` | Each check's result: the run, the check, its level, status, time taken, the plain summary, the technical part as JSON, and the id of the person who ran it | 30 days; each run removes older results |
| D1 `platform_alerts` | Problems, compliance records and test alerts; who closed a problem and why | No automatic clean-up yet |
| D1 `admin_audit_log` | `health_run`, `health_resolve`, `health_test_alert` | The activity log's own rules |

No new table, binding, secret or setting: the results table is the one Diagnostics wrote, and the
problems table the one Alerts read. The Resend check reads the existing `RESEND_API_KEY`. Results
written by Diagnostics before 2026-10-17 stay until the clean-up removes them, and History does
not list them.

## 7. Not built yet

Parts 2 and 3 of the plan of 2026-10-17, which the owner approved: checks that run on their own in
the five-minute job, more checks, other services' problems fed in, a problem that opens after two
failures and closes itself, acknowledging and snoozing (`#ack`), settings (`#configure`), heavier
tests (`#run-heavy`), and a strip on the home page. The 30-day strip reads the results table
directly, which suits checks that run only when someone asks; background checks will need a daily
summary instead.

## 8. Verification log

| Date | What was checked | What was not |
|---|---|---|
| 2026-10-17 | §2 for the new look: the tabs, the band, the per-problem counts, the level filter and the address, against `src/components/admin/health/`, `src/styles/pages/health.css` and the two repositories; the counts and the filter by `test/system-health.test.ts`, the pieces by `test/system-health-board.test.ts` and `test/system-health-look.test.ts` | The rest of the page, unchanged since the rows below; the look on a phone, which the owner tests after the push |
| 2026-10-17 | The `0073` sentence: the two Alerts rows read back switched off through the Cloudflare D1 connector after it was applied | The rest of the page, unchanged since the row below |
| 2026-10-17 | Written with the code: every claim above against `src/lib/health/`, `src/pages/api/system-health/`, `src/components/admin/health/`, the two repositories and `migrations/0072_system_health.sql`; the live tables read through the Cloudflare D1 connector before the migration (`platform_alerts`: 35 rows from the website, none open; `system_test_results`: 68 rows from four Diagnostics runs; the one Developer Tools grant belongs to an Owner, who passes the new key anyway); `test/system-health.test.ts` and the updated tests | The page on a phone, which the owner tests after the push |

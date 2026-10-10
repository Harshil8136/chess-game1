---

title: "Cron Control Plane"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-09
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/jobs/dispatch.ts, src/workers/job-runner.ts, src/lib/jobs/control.ts, src/lib/jobs/job-log.ts, src/lib/jobs/tiers.ts, src/lib/jobs/registry.ts, src/lib/jobs/runJob.ts, src/lib/jobs/read-model.ts, src/lib/jobs/cron-expr.ts, src/lib/jobs/schedule.ts, src/lib/jobs/check.ts, src/lib/jobs/health.ts, src/lib/jobs/history.ts, src/lib/dal/CronControlRepository.ts, src/workers/scheduled-usage-probe.ts, src/lib/auth/surface-guards.ts, src/lib/auth/guard.ts, src/pages/api/cron/index.ts, src/pages/api/cron/state.ts, src/pages/api/cron/config.ts, src/pages/api/cron/sync.ts, src/pages/api/cron/jobs/[id]/check.ts, src/pages/api/cron/jobs/[id]/history.ts, src/pages/api/cron/jobs/[id]/stream.ts, src/components/admin/cron/CronDashboard.tsx, src/components/admin/cron/Overview.tsx, src/components/admin/cron/JobCard.tsx, src/components/admin/cron/JobDrawer.tsx, src/components/admin/cron/JobHistory.tsx, src/components/admin/cron/ManageForm.tsx, src/components/admin/cron/RunPrecheck.tsx, src/components/admin/cron/AccessSummary.tsx, src/components/admin/cron/JobFilter.tsx, src/components/admin/cron/RunConsole.tsx, src/components/admin/cron/status.ts, src/pages/dashboard/cron/index.astro, migrations/0056_cron_action_roles.sql, src/workers/scheduled-backup-tick.ts, src/workers/scheduled-heartbeat-watchdog.ts, src/lib/blog/publish-scheduled.ts]
related_docs: [../records/reports/2026-10-09-scheduled-jobs-page-rebuild.md, ../operations/OPERATIONS.md, ../operations/incidents/2026-09-26-cron-exceeded-cpu.md, ../architecture/PERMISSIONS-SYSTEM.md, ../MAINTENANCE.md, ../specs/2026-09-16-cron-control-plane-design.md, ../specs/2026-09-20-cron-control-improvement-plan.md, ../records/reports/2026-10-04-resource-usage-optimisation.md, ../records/reports/2026-10-07-heartbeat-watchdog.md]
tags: [cron, jobs, control-plane, plac, operations]
---

# Cron Control Plane

> **TL;DR (non-technical):** The portal runs a set of background jobs on a timer.
> This page is where you stop one, slow one down, check whether it has work
> without running it, run one by hand to see what it does, and see how each has
> done hour by hour. It also stands non-essential jobs down by itself if the free
> database allowance ever comes under pressure, and puts them back when it
> passes. Since 2026-10-09 everything it says about a job (its name, what it
> does, when it next runs) is read from the code that is deployed, so a new or
> changed job shows correctly on the deploy that brings it.

**Where:** `/dashboard/cron`, titled **Scheduled Jobs**. It appears in the sidebar for
anyone who can open it.

This document owns the job list, the tiers and the permission matrix.
[`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) links here rather than
restating them — one fact, one home.

## 1. What can be controlled

| Control | What it does | Permission |
|---|---|---|
| **Check** | Asks, without running anything, what would happen if the job ran now: whether the scheduler would let it, whether its own check finds work, and whether a run already holds its lock. `GET /api/cron/jobs/[id]/check`. It only reads (the control document, the job's own check, its lock row) and writes nothing, not even an audit row. *Added 2026-10-09.* | *page access only* |
| **History** | The job's last seven days, day by day, and its newest runs one by one. `GET /api/cron/jobs/[id]/history`: two Analytics Engine statements, fetched only when the History tab is opened. *Added 2026-10-09.* | *page access only* |
| **Manage** (pause, resume, throttle) | The Settings tab of a job's details, with one **Save**. Pausing needs a reason and may take an expiry; the throttle runs a job at most every N minutes, from "every time" (the reset) to 24 hours. Nothing commits until you save. | `#pause` |
| **Run** | Opens the run console, which checks the job first (the same read-only Check) and lists what the job touches. **Start run** executes: it streams telemetry and a per-query trace, takes an optional reason, and bypasses the control document but not the job's own gate. | `#trigger` |
| **Measure now** | Forces a live probe of Cloudflare's D1 analytics instead of waiting for the hourly one. Refused within 60 s of the last reading. Called **Sync telemetry** until 2026-10-09. | `#trigger` |
| **Refresh** and **Live** | Refresh re-reads this page's own data: one D1 row and one Analytics Engine query, side by side (a second query only if the first is refused, §7); it probes nothing. Until 2026-10-09 it read a second D1 row, the job catalog. Live, on by default since 2026-10-09 and remembered per browser, does the same once just after each tick, only while the tab is in view and not while a run is being watched: about 12 times an hour. | *page access only* |
| **Limits and halt**: thresholds | The D1 usage figures above which deferrable jobs stand down. | `#configure` |
| **Limits and halt**: halt | Stops every job, essential ones included. Requires a reason, and may be given an expiry. | `#configure` |

> **The throttle is a first-class control as of 2026-09-20.** Each row has a
> **Throttle** button behind `#pause`, and `POST /api/cron/state` accepts an
> interval-only body — no `state` means "leave the switch where it is", so
> throttling a paused job does not require the browser to restate a pause reason
> it did not author. An interval-only change audits as `config_change`, never as
> `cron_pause`: "who stopped this job" has to stay answerable from the action
> alone. *Updated 2026-10-04:* this said only `cron-usage-probe` carried one.
> The live document (read-only D1 query, rev 459) now throttles seven jobs: 15
> minutes for `cf-access-audit-poll`, `booking-email-retry`,
> `booking-outbox-poke` and `blog-scheduled-publish`; 60 minutes for
> `cf-access-reconcile`, `cron-usage-probe` and `storage-notifications`. Each
> carries its reason in the document.
>
> *Two things about it were wrong before that.* There was no UI at all
> (*corrected 2026-09-19*), and the route rebuilt each control entry from the
> request body while carrying over only `lastRunAt` — so one pause and resume
> through the page silently dropped any interval set through the API or the seed
> script. It merges into the stored entry now, pinned by `test/cron-api.test.ts`.
> *Fixed 2026-09-20.*

> **Sync telemetry costs a Cloudflare call, and is now floored and audited.**
> The header button calls `POST /api/cron/sync`, which runs the usage probe with
> `force=true` — one Cloudflare GraphQL call plus a control-row read and a
> compare-and-swap write. Added by `a9dd974` (2026-09-17). *Added 2026-09-19.*
>
> *Corrected and fixed 2026-09-20.* As shipped it had no rate limit, wrote no
> audit row, stamped `updated_by: cron-usage-probe-manual` rather than the
> actor, and rendered its button for everyone while the route required
> `#trigger` — so a canonical Admin met "Sync failed (403)", with no plain
> refresh left because `a9dd974` had replaced it. Today the button is gated on
> `#trigger` with a permission-free **Refresh** beside it; a second forced probe
> within 60 s of the last reading is refused and the page says so rather than
> calling Cloudflare again; the write records the actor's email; and a probe
> that actually happens writes a `cron_sync` audit row. A throttled click
> writes nothing and is deliberately not audited. This note also claimed the
> defect was "logged for triage in `MAINTENANCE.md`" — no such row was ever
> written, and
> [`../specs/2026-09-20-cron-control-improvement-plan.md`](../specs/2026-09-20-cron-control-improvement-plan.md)
> is the triage record.

## 2. Permissions

Four `admin_pages` rows (migrations `0054` and `0055`). Stored role values are
shown, because the database still holds the pre-rename vocabulary.

| Path | Stored role | vendor_support | owner | admin | manager | staff |
|---|---|---|---|---|---|---|
| `/dashboard/cron` | `super_admin` | bypass | bypass | **allow** | deny | deny |
| `/dashboard/cron#pause` | `owner` | bypass | bypass | deny | deny | deny |
| `/dashboard/cron#trigger` | `owner` | bypass | bypass | deny | deny | deny |
| `/dashboard/cron#configure` | `owner` | bypass | bypass | deny | deny | deny |

> **`#trigger` and `#configure` moved from `dev` to `owner` in migration
> `0056` (2026-09-20), and no role's access changed.** Gate D in
> The page gates (`src/lib/access-center/page-gates.ts`) refuse a grant when
> `ROLE_LEVEL[actor] > ROLE_LEVEL[page.required_role]`. `dev` normalises to
> `vendor_support`, level 0, and the owner is level 1 — so while those rows
> stored `dev`, `1 > 0` refused **every grant the owner attempted**, and only
> vendor support could delegate either action. The baseline comparison
> `userLevel <= requiredLevel` denies an admin (level 2) against both values
> alike, so the change grants nobody anything; it only lets the owner delegate,
> which is what the next paragraph has always claimed.

Three things about this are easy to get wrong and are worth stating plainly.

**The owner cannot be restricted here.** `requirePageAccess()` returns
immediately for `vendor_support` and `owner`, so these baselines bind admin and
below. That is ADR-0002 answer 2 — a self-inflicted lockout of the customer's top
tier is judged the worse failure — not a gap.

**Any tier below owner can be granted one action without the others.** An
individual admin can be given `#pause` through `admin_page_overrides` while still
being refused `#trigger`. Deny always beats grant. This is what makes the model
multi-level rather than a fixed ladder. *True of `#pause` since it shipped and of
all three since migration `0056` — see the note above.*

**A missing registry row now refuses the action instead of opening it.**
`resolveAccess` answers `unknown` for a key `admin_pages` does not define, and
`requirePageAccess` refuses an explicit deny only, so a fragment whose row is
absent or `is_active = 0` used to permit every role that could open the page —
the state migration `0054` actually shipped. `denyCron` goes through
`placRequireGrant` (`src/lib/auth/guard.ts`), which requires an explicit
**allow** on the action key, and the page's capability flags resolve the same
way. The four rows are asserted in `test/migrations-replay.test.ts`, so losing
one is a failing build rather than a silent opening. *Added 2026-09-20.*

**A deny on the page does not automatically deny the actions.** Ancestor matching
in `resolveAccess` is `startsWith(key + '/')`, and `#pause` supplies no `/`. Every
cron API route therefore checks the page key *and* its action key, through
`src/lib/auth/surface-guards.ts`. Gap **D-5** in
[`../MAINTENANCE.md`](../MAINTENANCE.md) is this same mistake made once already
elsewhere — in the sessions routes, three of whose four sub-permissions were fixed
alongside this doc and now share that module (`#export` has no server route and is
left unmapped). *Corrected 2026-09-19: this said "D-4 in PERMISSIONS-SYSTEM.md";
D-4 is the separate "two page keys for one route family" gap, and both live in
MAINTENANCE.md.*

Every mutation writes a Ghost Audit row naming the actor:

| Action | Written by | Carries |
|---|---|---|
| `cron_pause` / `cron_resume` | `POST /api/cron/state` with a `state` | the reason (required on a pause) and the expiry |
| `config_change` | `POST /api/cron/config`, and `POST /api/cron/state` for a throttle-only change | the mode, the halt expiry and the thresholds, or the new interval |
| `cron_trigger` | `POST /api/cron/jobs/:id/stream` | an optional free-text reason, since 2026-09-20 |
| `cron_sync` | `POST /api/cron/sync`, only when a probe actually happened | the previous and new `checkedAt` |

*Corrected 2026-09-19, and again 2026-09-20.* Two gaps named here are closed:
`cron_trigger` had no reason field (the run dialog now asks, and does not
require — a mandatory field on an urgent action is a field that gets filled with
"x"), and `POST /api/cron/sync` wrote **no audit row at all** while mutating the
control document. A click that the 60-second floor refuses changes nothing and is
deliberately not audited.

One gap remains, and it is historical: the two jobs paused in production were
switched off by `scripts/seed_cron_control.mjs`, so **no `cron_pause` row exists
for either of them** and the audit table cannot say who stopped `gsc-sync`. The
script now stamps `--actor=` onto the settings row, which is the provenance it
was missing. It deliberately does not write an audit row: `admin_audit_log`
requires `user_id`, `user_email` and `user_role` NOT NULL, a script has no
session to resolve them from, and a fabricated actor in the audit trail is worse
than a gap in it.

## 3. Tiers

There are **13 registered jobs** (`src/lib/jobs/registry.ts`): 11 on the
`*/5 * * * *` tick and 2 more on the Sunday `0 2 * * SUN` tick (`asset-cleanup`
and `staff-storage-reconcile`, both dispatched through the same `dispatchCronJobs`,
each due job in its own invocation — §5). `redis-ttl-hygiene`, the third Sunday
job, was removed on 2026-10-04 when cf-admin stopped using Upstash
([`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §3.6).
`heartbeat-watchdog`, the eleventh five-minute job, was added on 2026-10-07 (§3a).

Tiers live in **code** (`src/lib/jobs/tiers.ts`), not in the control document, so
a corrupt or hand-edited row cannot mark a security job as sheddable.

| Tier | Jobs | Automatic shedding |
|---|---|---|
| `essential` | `cf-access-audit-poll`, `cf-access-reconcile`, `booking-email-retry`, `booking-outbox-poke`, `cron-usage-probe`, `backup-tick`, `heartbeat-watchdog` | never |
| `deferrable` | `storage-notifications`, `blog-scheduled-publish`, `asset-cleanup`, `staff-storage-reconcile` | yes |
| `idle` | `gsc-sync`, `pagespeed-sync` | yes |

> **A missing tier is not a compile error.** `JobDefinition.id` is typed `string`,
> so `JobId` widens to `string` and `Record<JobId, JobTier>` demands nothing. A job
> added to the registry without a `JOB_TIERS` entry compiles, and its tier reads
> `undefined` at runtime. Keeping the two lists in step is a review duty, not a
> guarantee the type system makes. *Corrected 2026-09-19.*

The two Cloudflare Access jobs are security controls; the two booking jobs are
the customer money path, and a traffic surge is exactly when bookings are most
likely to be happening. `cron-usage-probe` is essential for a mechanical reason:
if shedding could stop the probe, the usage reading would go stale, staleness
would lift the shed, the probe would run, and shedding would re-engage.

`backup-tick` (added 2026-09-23, chunk CB-2) is essential for a different
reason: it costs this Worker no D1 rows, so shedding it relieves nothing, and a
shed tick silently skips a scheduled backup and holds back failure alerts. It
is also the one job whose work happens in another Worker — see
[`BACKUP-CONSOLE.md`](BACKUP-CONSOLE.md).

`heartbeat-watchdog` (added 2026-10-07) is essential for the same kind of
reason: its idle cost here is the two settings rows its gate reads, so shedding
it relieves nothing, and it only ever works when the usual heartbeat runners
have already failed — a shed watchdog then means a stranded booking or a broken
consent write path goes unnoticed. §3a describes it.

**A human pause can stop anything, including an essential job.** That is a
deliberate, audited act. Automatic shedding is not, so it never touches them.

## 3a. The heartbeat watchdog (2026-10-07)

**Why it exists.** cf-astro has an hourly consent & booking heartbeat: one call,
`GET /api/health/?probe=heartbeat`, proves the consent write path with a
rolled-back insert and audits the consent and booking outboxes, and the runner
then drains both replay outboxes. It ran on GitHub Actions, whose hourly
schedule skips most runs. The VPS job platform (cf-vps) now runs it every hour,
GitHub stays as a second runner, and `heartbeat-watchdog` is the third: the
portal runs the heartbeat itself **only when nobody else has run it recently**.
It rides the five-minute tick because every account cron slot is taken, and it
adds no trigger, variable, table or secret.

**How it knows.** cf-astro records every heartbeat run, whoever asked for it, in
the `admin_portal_settings` row `heartbeat-last-run` (global, JSON
`{ at, runner, verdict }`, `updated_by` `cf-astro:heartbeat`; the runner is
`vps`, `cf-admin`, `github` or `manual`). The job's gate (`heartbeatDue`,
`src/workers/scheduled-heartbeat-watchdog.ts`) runs it only when that row is
missing, unreadable, more than a minute in the future, or older than the
threshold, less the same minute of slack every Cron Control gate allows (§4a).
Both rows are the job's gate keys, so the decision costs the one small
gate-key query the job's invocation already makes (§5) and nothing else.

**Its setting.** `heartbeat-watchdog-stale-minutes` (global) is the threshold:
default **70** (an hourly runner plus ten minutes), clamped to **30..1440**; a
value that is not a number reads as 70. Like the other gate bounds it is a code
default, not a stored row, so changing it is an `INSERT`, not an `UPDATE`
([`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §1, the idle-tick
gates). It has no screen, like the other job bounds.

**What it does when it runs**, in the GitHub workflow's order, through the
`ASTRO_SERVICE` binding (or `PUBLIC_ASTRO_URL` where the binding is absent) with
the shared `REVALIDATION_SECRET` (`HEALTH_CHECK_SECRET` as fallback), exactly as
`booking-outbox-poke` calls cf-astro:

1. `GET /api/health/?probe=heartbeat&runner=cf-admin`. An answer other than 200
   or 207, one without a `heartbeat` object, or no answer at all is a failed run;
2. `POST /api/consent/replay/` and `POST /api/booking/replay/` with
   `{"limit":200}`, **even when step 1 failed** — stranded records are exactly
   when a drain matters.

**What it reports**, through `reportOnceCooled` (every occurrence reaches
Workers Observability; Sentry is cooled per key):

| Signal | Cooldown key | Cooldown | When |
|---|---|---|---|
| The fallback ran | `heartbeat-watchdog:fallback` | 6 hours | every run: the VPS job and GitHub both missed the heartbeat, and somebody should find out why |
| A human is needed | `heartbeat-watchdog:failure` | 1 hour | a `fail` verdict (with the heartbeat's own error text), a failed run, a failed drain, or a drain reporting `permanent` or `exhausted` records |

A `warn` verdict is logged, not reported, as the workflow treated its warnings.
The handler never throws: a failure is logged and reported, and the job still
counts as `ran`.

**It sleeps after a run.** The handler reports the threshold from its start as
its next due time, which the dispatcher caps at an hour (§4a). While cf-astro
records each run that changes nothing, because the gate holds for the threshold
anyway. It matters when a run is *not* recorded — a cf-astro without the
heartbeat mode, a failed write, an outage — which would otherwise run the
heartbeat, and its audit queries in cf-astro, on every five-minute tick. So the
fallback runs at most hourly, like the workflow it replaces.

**Release order.** cf-astro's heartbeat mode must be live first: against a
cf-astro without it, every run is a failed run (no `heartbeat` object) and is
reported hourly.

## 4. How shedding decides

`cron-usage-probe` reads Cloudflare's own account-wide D1 analytics once an hour
and caches the figure into the control document. Every tick then compares against
an already-cached number at no extra cost.

It is account-wide on purpose: the D1 daily limit is enforced per account and
shared with cf-astro, so metering only cf-admin's own queries would watch a slice
and miss what actually exhausts the quota.

A reading older than **three hours is treated as unknown, and unknown is not
pressure** — shedding switches off rather than standing jobs down on evidence
nobody can confirm. Shedding also self-restores as soon as a later reading falls
below the threshold, and the allowance resets at UTC midnight.

Since `a9dd974` (2026-09-17) the probe also stores the **raw** `rowsRead` /
`rowsWritten` alongside the percentages, plus per-database `dbRowsRead` /
`dbRowsWritten`, so the usage cards show real row counts rather than figures
derived back from a percentage, with a "Portal DB: N rows" footer when the
portal's own share differs from the account total. The same commit made
`src/lib/jobs/metered-d1.ts` meter `.first()` calls, which it previously did not —
so per-job rows-read history recorded **before 2026-09-17 undercounts** every
`.first()` query. *Added 2026-09-19.*

**Current headroom, measured 2026-09-16:** 0.18% of the daily read allowance and
0.18% of writes. The 70% default thresholds have never been approached; treat
shedding as insurance, not as something that fires routinely.

## 4a. When a job runs: intervals, next due times and wakes (2026-10-04)

Being on the five-minute tick does not mean running every five minutes. After
halt, pause and shedding (§4), `decideJobRun` (`src/lib/jobs/control.ts`) holds a
job back for two more reasons, and the page shows each:

| Reason | Where it comes from | Shown as |
|---|---|---|
| `interval` | The throttle (§1): at most every N minutes, measured from `lastRunAt` | **Throttled** (**Standby** until 2026-10-09) |
| `sleeping` | The job itself said when it next has work (`nextDueAt`), and that time has not come | **Sleeping until HH:MM** |

**Which jobs sleep.** A job's handler may return `{ nextDueAt }`; three do.
`backup-tick` passes on cf-backup's `nextTickAt` (Contract A in
[`../program/cf-backup/02-admin-integration-contract.md`](../program/cf-backup/02-admin-integration-contract.md)):
every five minutes while a backup is running, otherwise the next slot, chore or
hour. `blog-scheduled-publish` reports the earliest scheduled post, or an hour
from now when none is scheduled. `heartbeat-watchdog` (2026-10-07) reports its
threshold from the start of a run, so it sleeps an hour after each run (§3a). The page shows a
sleeping job as **Sleeping until HH:MM**, and gives the time it wakes as its next run (§7).
Until 2026-10-09 a seeded catalog row (`scripts/lib/cron-catalog.mjs`, now deleted) said this
in prose, which had to be re-seeded whenever it changed.

**The rules, all in `control.ts`:**

- **A sleep never lasts more than an hour** (`MAX_SLEEP_MS`) after the run that
  reported it, whatever the job said. A due time no more than five minutes away
  (`MIN_SLEEP_MS`) is not stored at all: the next tick runs the job anyway.
- **A minute early counts as due** (`DUE_EARLY_MS`), for sleeps and intervals
  alike. Ticks fire some seconds into their minute, so two ticks are never
  exactly N minutes apart. Without the slack a 15-minute throttle ran every 20
  minutes, which the live document showed on 2026-10-04.
- **The clock is the moment the tick began**, not the moment it wrote. The next
  tick compares its own start against it.
- **`skipped` stamps the clock too.** A job whose own gate found nothing to do
  has still looked. Until 2026-10-04 only `ran` was stamped, so a job that
  usually skips (`booking-outbox-poke`, `storage-notifications`) was invoked on
  every tick whatever its interval said; the live document showed
  `booking-outbox-poke` with an interval and no `lastRunAt` at all.
  `failed`, a held lease and a held-back job leave the clocks alone, so the job
  is tried on the next tick.
- **A job's own time gate measures the same way.** `storage-notifications`'
  gate (`storageNotifyDue`) and `cron-usage-probe`'s backstop
  (`USAGE_PROBE_INTERVAL_MIN`) allow the same minute of slack, and
  `storage-notify-last-run` holds the run's start, not its end. Cron Control
  holds both jobs to 60 minutes too, and stamps a `skipped` outcome, so an own
  gate even a second stricter than Cron Control turns every hourly invocation
  away and the job works every two hours (found in review on 2026-10-07, before
  release). Likewise `blog-scheduled-publish` reports its next post's time
  plus `DUE_EARLY_MS`, so the slack cannot wake it a tick before the post is
  ready. Pinned by a day of simulated ticks in `test/jobs-gates.test.ts`.
- **A wake.** `wakeJob` (`src/lib/dal/CronControlRepository.ts`) clears a job's
  sleep, sets `wokenAt` and moves `clockRev`, so the next tick runs it (subject to
  its interval) and a tick already in flight cannot put it back to sleep with
  an answer computed before the change. It leaves `rev` alone, so a pause or
  halt from a Cron Control page loaded before the wake still lands (§5). The backup console gateway wakes
  `backup-tick` after every change (any method but `GET` and `HEAD`); the blog
  API wakes `blog-scheduled-publish` when a post is scheduled, moved,
  unscheduled or deleted. A wake that cannot land is logged and changes nothing
  else: the job still runs within its hour.

A job held back for either reason costs no invocation and is recorded as
`disabled` in the 24-hour figures, like a paused one.

Every doubt means "run": no document, an unreadable due time, a last run in the
future, a failed read of the next post, or a backup tick that left an alert
unsettled. Pinned by `test/cron-next-due.test.ts`,
`test/cron-control-decide.test.ts`, `test/backup-tick.test.ts`,
`test/backup-gateway.test.ts` and `test/cron-blog-publish.test.ts`.

## 5. What it costs

The control document is one JSON row in `admin_portal_settings`. No new table, no
new environment variable.

*Corrected 2026-09-19 — this section previously claimed the document was read as
"the 13th key of a batched settings query the tick already makes: +1 row read per
tick, no extra query". It is not. `readControl` issues its own `SELECT`
(`src/lib/dal/CronControlRepository.ts`), separate from the batched gate-key read.
The real per-tick cost is:*

- **one single-row read per tick** from `dispatchCronJobs`
  (`src/lib/jobs/dispatch.ts`), plus one from `cron-usage-probe` on each tick it
  is invoked, where it re-reads the document before checking its own 60-minute
  clock (hourly with the live interval; on every tick only if the document is
  unreadable). *Corrected 2026-10-07: this said the probe re-read on every tick,
  which stopped once its 60-minute throttle held;*
- **one write per hour** from the probe, plus one write per tick in which a
  clock moved (`stampIntervalClocks`, a single write for the whole tick): a
  throttled job ran or was skipped by its own gate, or a job reported a new
  sleep. With the live intervals of 2026-10-04 that is **at least 96 a day**,
  if every throttled job runs on the same ticks, and at most one a tick (288)
  plus a retry after each of the probe's 24 writes. Nothing keeps the jobs on
  the same ticks: each keeps the phase of its own last run, and the sleeping
  jobs wake at their own times, so the real figure lies between; [`MAINTENANCE.md`](../MAINTENANCE.md)
  RU-9 measures it. Each is one row. A conflict (another writer moved `rev` or
  `clockRev` in between) is re-read and retried once. *Corrected 2026-10-07:
  this gave "about 96" as the figure.*

*The same false claim was repeated in code comments at `src/lib/jobs/runJob.ts`
and `src/lib/jobs/control.ts`; both were corrected on 2026-09-20.*

**The clock write does not consume a revision.** `stampIntervalClocks` writes the
document back with `rev` unchanged, comparing-and-swapping against the current
value. `rev` is the token the dashboard captures on load and returns with a pause
or a configuration change, and while the stamp bumped it, an hourly machine write
invalidated every open tab — the live document had reached **rev 179** by
2026-09-20, every increment written by `cron-tick`. A human write landing between
a tick's read and its stamp still wins; a human write landing just after
overwrites a clock the next tick re-stamps, which is the tolerance this path
already had. *Added 2026-09-20.*

**`clockRev`, the machine writes' own revision.** The clock stamp moves
`clockRev` instead of `rev`, and so does a wake (§4a). Both compare `clockRev`
as well as `rev`, so a wake landing while a tick is in flight makes that tick's
stamp conflict, re-read and see the wake, and a stamp landing while a wake is
being written makes the wake re-read and keep the stamp. Operator writes and the
usage probe compare `rev` alone, as before, so neither machine write can turn an
open tab's next pause into a 409. The one window left: a wake landing in the
milliseconds between an operator save's (or the probe's) read and its write is
overwritten, and the job then wakes at its own due time or the hour cap. An
absent `clockRev` counts as 0, so older documents need no change. *Added
2026-10-07, in review before release: the first version of the wake moved
`rev`, which every backup console action and blog schedule change would have
turned into exactly that 409.*

A paused job still costs those reads, but nothing more: the gate runs before the
job's own logic, so the job itself never reaches D1.

**Each due job is its own invocation (2026-09-27).** `dispatchCronJobs` runs
`decideJobRun` for every job in the scheduled invocation. A job it holds back
(paused, off, shed, throttled) is recorded as `disabled` or `shed` right there,
with no invocation and no query of its own. Every other job is called through
the Worker's own `JobRunner` entrypoint (`src/workers/job-runner.ts`, reached
through `ctx.exports`), with the control document the tick already read passed
along. Each job gets a binding of its own, carrying its id as `ctx.props`.
Props belong to one invocation, so no two jobs can share one budget. So a job gets its own 10 ms of Workers Free CPU, and a job that still
overruns fails alone. Inside that invocation `runOneJob` reads only that job's
`gateKeys` and then calls `runJob`, so the gate, lease, meter and telemetry
are unchanged. Two costs moved:

- **Gate keys are read per job.** The batched read of all jobs' keys became one
  small `SELECT` per job that declares keys. The rows read stay the same,
  because no two running jobs share a key (`gsc-sync` and `pagespeed-sync` do,
  but both are off). D1 Free meters rows, not queries.
- **Invocations per tick** are 1 plus the number of due jobs. With the live
  document on 2026-09-27 (rev 303: `gsc-sync` and `pagespeed-sync` off,
  `cron-usage-probe` throttled to 60 minutes), that is 8 on most five-minute
  ticks, 9 once an hour, and 3 on Sunday. Service Binding calls are not billed
  as requests, and one invocation may make up to 32 of them.

*Updated 2026-10-04.* With the live intervals and the two sleeping jobs, a
quiet day costs about 410 job invocations instead of about 2,040 (seven jobs
on all 288 ticks plus the hourly probe): 96 each for the three 15-minute jobs,
24 each for the three hourly ones, and about 24 each for `backup-tick` and
`blog-scheduled-publish` while nothing is due. A running backup adds a
`backup-tick` call every five minutes for its duration. The scheduled
invocation itself still fires 288 times a day. These are estimates from the
rules above, not a measurement; the change record names how to read the real
figure after a week.

*Added 2026-10-07.* `heartbeat-watchdog` adds about **288 invocations a day**
while it only checks: it has no interval, and its gate decides inside its own
invocation, after one gate-key query of at most two rows (at most about 576
rows read a day). It writes nothing while it skips. A run adds the fallback
report's cooldown claim and one clock write for its sleep; while the VPS job
runs the heartbeat, it never runs. It is deliberately left without a Cron
Control interval: a throttle would cut the invocations, but a throttled job's
clock moves on every `skipped` outcome (§4a), trading cheap reads for writes,
the scarcer resource. These are figures from the rules above, not a
measurement.

Why: until 2026-09-26 all ten jobs shared the scheduled invocation's 10 ms. The
tick measured 22 ms on 2026-09-16, and from 22:45 UTC on 2026-09-26 Cloudflare
ended every run at the limit — see
[`../operations/incidents/2026-09-26-cron-exceeded-cpu.md`](../operations/incidents/2026-09-26-cron-exceeded-cpu.md).

**What the page itself costs (2026-10-09).** None of it touches the tick, and
each figure is per open tab:

- **Opening the page, Refresh and each Live reload:** one D1 row (the control
  document) and one Analytics Engine query for every job's last 24 hours, made
  side by side. Live reloads once just after each tick, only while the tab is in
  view: about 12 times an hour, so about 12 D1 rows an hour for a tab left open.
  Until 2026-10-09 each load also read the catalog row.
- **Check:** one control-document row, the job's gate keys (one small query, for
  the jobs that declare any) and, for `booking-outbox-poke`, its one-row probe;
  the lease row for the two jobs that take one. No write of any kind.
- **History:** two Analytics Engine statements for one job, each time its
  History tab is opened, and at no other time.
- **Run** and **Measure now** cost what they did before (§1).

These are counts from the code, not measurements.

## 6. Failure behaviour

**Everything fails open.** A missing control row, malformed JSON, an unknown
schema version, or a failed read all mean *every job runs*, exactly as before the
control plane existed. The jobs being gated include the Access whitelist sync and
the booking email retrier, so a configuration bug must never become a silent
outage of a security control.

The dashboard says so explicitly when no document is stored, rather than showing
an empty table.

## 7. Reading the page

*Rebuilt 2026-10-09.* The page was redesigned as cards with a details panel, and
everything it says about a job is now worked out from the deployed code and live
data. The change record,
[`../records/reports/2026-10-09-scheduled-jobs-page-rebuild.md`](../records/reports/2026-10-09-scheduled-jobs-page-rebuild.md),
has the before and after. The bullets below describe the page as it is; the
older layouts they replaced (the grid row of 2026-09-21, the catalog prose, the
"Standby" and "Paused (Quota)" labels) are in this section's history in git.

- **Nothing about a job is stored as prose any more.** Its name, what it does,
  what happens if it is switched off, its area and what it touches (sends
  email, deletes, publishes, changes access, calls outside services) are
  the job's `about` in `src/lib/jobs/registry.ts`, beside its handler, and the
  type makes them required. `test/cron-contract.test.ts` holds every job to
  plain words (no "cron", "D1", "lease", "tick" and the like) and unique titles,
  and checks that the jobs that delete, send email, change access or publish say
  so. A new job appears described on the
  deploy that adds it; nothing needs re-seeding. Until 2026-10-09 the words came
  from the `cron-job-catalog` row, written by `scripts/seed_cron_control.mjs`,
  so a job added since the last seed showed as a bare id.
- **The schedules are read from the code, in words.** `TRIGGERS`
  (`src/lib/jobs/registry.ts`) lists each trigger with its jobs, and
  `test/worker-entry-contract.test.ts` pins it to `wrangler.toml`.
  `src/lib/jobs/cron-expr.ts` reads any five-field expression (lists, ranges,
  steps, day and month names, both day fields as cron ORs them) and says it in
  words ("Every 5 minutes", "Sundays at 02:00 UTC"). It replaced `nextTickAt`,
  which understood only the two expressions this Worker declared.
- **"Next" is when the dispatcher will really invoke the job**, not the next
  tick. `nextInvocation` (`src/lib/jobs/schedule.ts`) walks the job's trigger
  forward through the same `decideJobRun` the dispatcher uses, so a throttled
  job gives the tick after its interval, a sleeping job the tick it wakes on,
  and a timed pause the tick after it lifts. When no time can be given, it says
  what the job waits for instead: someone resuming it, database use falling, or
  no trigger in this build. A job with its own check reads "Looks for work in
  …", because an invocation of it is not work. `test/cron-schedule.test.ts`
  checks the projection against `decideJobRun` itself.
- **"Last" keeps work apart from looking.** Analytics Engine's last time of each
  outcome is kept separately (`lastAt` in `src/lib/jobs/health.ts`), so a card
  reads "Last did its work 2h ago, looked 3m ago". Until 2026-10-09 one "last
  seen" covered every outcome, and the dispatcher records a held job on every
  tick, so a paused or sleeping five-minute job always read "last 3m ago".
  Times also used to leave the server as Analytics Engine's
  `YYYY-MM-DD HH:MM:SS`, which is UTC and which a browser reads as local time;
  they now leave as epoch milliseconds, and the page shows them in the viewer's
  clock.
- **Each card has an hour-by-hour strip of its last 24 hours.** One cell per
  UTC hour, coloured by the most important thing in it: a failure, then work
  done, then a look that found nothing, then a held tick. Beside it the day in
  words ("12 worked", "276 looked", "1 failed"). The strip comes from the same
  single query as the totals, grouped by hour as well. Should that form ever be
  refused, the page falls back to the 24-hour totals it read before (reported
  once to Sentry) and leaves the strip out rather than drawing it empty.
- **When the history cannot be read, the page says so.** The card reads "Run
  history could not be read just now" and the overview says unavailable; it
  never shows a zero, because a zero reads as "this job has stopped" (RULE
  #0.5). `runBreakdown` (`src/components/admin/cron/status.ts`) still separates
  what ran from what the control plane stopped, so a paused job no longer
  advertises about 288 "runs" a day (*fixed 2026-09-20*).
- **The status pill says why a job is idle, in this order:** **Halted**,
  **Paused** (with when it resumes, or "until someone resumes it"),
  **Failing** (its latest work failed; an older failure followed by a good run
  does not count), **Held back** (stood down because the database is busy),
  **Throttled** (at most once every N minutes), **Sleeping until HH:MM**, and
  **Active**. `jobStatus` decides it and `test/cron-status-view.test.ts` pins
  the order.
- **The overview** has four tiles: how many jobs are running, paused or need a
  look; the last 24 hours across all jobs (work done, looks, failures, runs by
  hand); the next tick with a live countdown; and database use today against the
  account's free daily allowance, with the shedding limits in words. **Measure
  now** sits in that last tile for those with `#trigger`.
- **Needs a look** filters to the jobs that failed in the last 24 hours, are
  held back for the database or are halted; a job a person paused is not flagged. **Paused**
  and **Running** filter the rest, and a search box matches names, ids,
  descriptions and areas. Cards are grouped by trigger, each with its schedule in words
  and a countdown to its next tick.
- **Check** asks what would happen if the job ran now, and shows the answer on
  the card: what the scheduler would decide and why, what the job's own check
  found and how many rows it read, and whether its lock is held. It ends "Nothing
  was run or changed." (`src/lib/jobs/check.ts`, `checkVerdict` in
  `status.ts`). It is offered to anyone who can open the page, because it only
  reads; `test/cron-api.test.ts` shows a check on a paused job writes no audit
  row and leaves the document's revision unchanged.
- **Details** opens a side panel with three tabs. **About**: what the job does,
  a Check, what happens if it is switched off, what it touches, how it is
  scheduled (schedule, next, throttle, whether it looks first, whether it runs
  one at a time, priority, its quiet-tick database budget and its id) and its
  last 24 hours. **History**: the last seven days as a stacked bar per day, and
  the newest runs that did something (work, a failure, a held lock or a run by
  hand), fetched only when the tab is opened. **Settings**: pause, resume and
  throttle. `?job=<id>` opens the panel on that job and highlights its card.
- **What you may not do is said in words, once**, naming the key that would
  grant it, rather than rendered as a row of disabled buttons on every job. The
  header line appears only when something **is** missing — four ticks shown to
  someone who holds all four is a line that says nothing. The principle is
  unchanged from 2026-09-20: a capability that is simply absent teaches nobody
  it exists, and an access review cannot be run against a page that silently
  omits what it is hiding. *Reworded 2026-09-21.* Without `#pause`, the
  Settings tab says which key it needs.
- **Pause and throttle are one form with one Save**, in the Settings tab. They
  are the same decision from an operator's side and share one PLAC key, and one
  request carries the switch, the reason, the expiry and the throttle, so they
  cannot disagree half way through and one save writes one audit row. *Changed
  2026-09-21.* Pausing an essential job warns that the automatic hold for a busy
  database never stops it, but a pause by hand does.
- **Live** is on by default (*changed 2026-10-09; it was an opt-in
  auto-refresh*). It reloads the page once just after each tick, only while the
  tab is in view, and never while a run console is open; a tab that comes back
  into view after a minute or more catches up at once. Each reload costs what
  Refresh costs (§5). The page allows for the viewer's clock being off by
  using the server's time from each load.
- **The run console shows a trace only once there is a run.** Before that it is
  the confirm panel and nothing else. *Fixed 2026-09-21: the trace section
  rendered unconditionally and its "streaming" state keyed off the absence of
  data, so an open dialog claimed to be streaming from the worker indefinitely,
  before any request had been made. Found from a screenshot; no test would have
  caught it, because the component was never rendered in one.* Since
  2026-10-09 the confirm panel runs a Check by itself, lists what the job
  touches, and warns when an essential job with no lock could overlap a
  scheduled run.
- **Run** opens the console; **Start run** executes. The dialog used to run
  the job the instant it opened, so a misclick ran production work — a bucket
  cleaner, in one case — with nowhere to record intent; both `cron_trigger` rows
  in production are unexplained. The reason it asks for is optional and rides
  into the audit row. *Changed 2026-09-20; the confirm was renamed 2026-09-21,
  because "Run now" opening a dialog whose button said "Run it now" is two
  buttons with one verb and two meanings.* It bypasses the control document deliberately, so
  you can test a job you have just paused, and it does **not** bypass the job's
  own gate: Run now on `gsc-sync` still does nothing while `gsc-sync-enabled` is
  `false`.
- **Only `asset-cleanup` and `staff-storage-reconcile` take a lease.** Both
  declare `leaseSeconds: 900`, because both delete and
  a manual run bypasses the control document by design — two deleters walking the
  same bucket is the one overlap worth a D1 write. (`redis-ttl-hygiene`, which
  took none, was removed on 2026-10-04: [`../MAINTENANCE.md`](../MAINTENANCE.md)
  R-1, RU-2, RU-8.) The eleven five-minute jobs
  declare none: a lease is a write, writes are the scarcer resource, and 288
  writes a day each to protect idempotent work is the wrong trade. So a manual
  trigger *can* still overlap a scheduled tick for those eleven. The Run-now route
  is an SSE stream: it returns 200 and reports `leaseHeld` in its `done` event —
  there is no 409 path. *Corrected 2026-09-19: this section previously promised
  that Run now "still honours the lease … you get a 409 rather than a duplicate
  run", and the code comment in `src/pages/api/cron/jobs/[id]/stream.ts` made the
  same claim. Leases added and that comment corrected 2026-09-20.*

> **The run dialog shows what the job said, as well as what it read.** A
> handler's own output is streamed into the trace, interleaved with the D1
> statements in the order they happened, and labelled `INFO` / `WARN` / `ERROR`
> in text as well as colour. *Added 2026-09-21, closing the gap this section
> recorded from 2026-09-19.*
>
> Jobs narrate through `JobContext.log` (`src/lib/jobs/job-log.ts`), never
> `console.*`. That is a security boundary, not a style preference: patching the
> global `console` for the duration of a run — the obvious way to do this — would
> capture whatever else is running in the same Workers isolate, so another
> request's output would render into this dialog and into any screenshot of it.
> A sink passed down the call stack can only carry this job's own lines. Every
> line still reaches Workers Observability exactly as before, whether or not
> anyone is watching.
>
> **Known limitations.** The trigger expressions cannot be changed from this
> page: they live in `wrangler.toml` and changing one is a deploy. A handler that
> still calls `console.*` directly is invisible here — the six scheduled job
> files carry none, and ratchet metric **A4** holds the line at the count they
> left behind.

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-10-09 | claude | Page rebuilt: `src/lib/jobs/registry.ts` (`about`, `TRIGGERS`), `cron-expr.ts`, `schedule.ts`, `check.ts`, `health.ts`, `history.ts`, `read-model.ts`, the two new routes and `src/components/admin/cron/`; Cloudflare's Analytics Engine SQL reference read for `toStartOfInterval` and `_sample_interval`; `test/cron-expr.test.ts`, `cron-schedule.test.ts`, `cron-health-history.test.ts`, `cron-status-view.test.ts`, `cron-api.test.ts`, `cron-contract.test.ts`; `npm run verify` | §1: Check, History, Live, Measure now, Refresh's cost. §4a: Throttled, the catalog sentence. §5: the page's own cost. §7 rewritten for the cards, the details panel, the hour strip, next from `decideJobRun`, last per outcome, UTC times. Not checked: the new hourly and seven-day Analytics Engine statements against the live dataset (no token in this session; the hourly one falls back to the old query if refused), and the page in a browser. Not re-checked: §2, §3, §3a, §4, §6 |
| 2026-10-07 | claude | `heartbeat-watchdog` added: `src/workers/scheduled-heartbeat-watchdog.ts`, `src/lib/jobs/registry.ts`, `tiers.ts`, `budgets.ts`, `scripts/lib/cron-catalog.mjs` (deleted 2026-10-09); cf-astro's heartbeat module read (its src/lib/heartbeat.ts, uncommitted, built in parallel) for the `heartbeat-last-run` row it writes; `test/heartbeat-watchdog.test.ts`, `test/jobs-budget.test.ts`; `npm run verify` | §3: 13 jobs (11+2), the tier table and the reason it is essential; §3a added; §4a: three jobs sleep; §5: its invocation and read cost; §7: eleven five-minute jobs without a lease. The catalog entry reaches the page only after a re-seed (`node scripts/seed_cron_control.mjs --apply --remote`). Not re-checked: §1, §2, §4, §6, the rest of §7; not checked live (nothing deployed) |
| 2026-10-07 | claude | Review of the unreleased 2026-10-04 change: `src/lib/jobs/control.ts`, `runJob.ts`, `CronControlRepository.ts`, `src/workers/scheduled-storage-notifications.ts`, `scheduled-usage-probe.ts`, `src/lib/blog/publish-scheduled.ts`, `src/pages/api/cron/state.ts` and `config.ts`; `npm run verify` | §4a: the own-gate bullet and the wake's `clockRev`. §5: the read and write figures corrected (writes a range, not "about 96"), the `clockRev` paragraph added. §7's lease note no longer describes `redis-ttl-hygiene` as current. Not re-checked: §1 to §4, §6, the rest of §7 |
| 2026-10-04 | claude | Read-only D1 query of the live `cron-control` row (rev 459 and earlier rev 455); `src/lib/jobs/control.ts`, `runJob.ts`, `dispatch.ts`, `registry.ts`; `npm run verify` | §4a added (next due times, sleeps, wakes, the minute of slack, the tick-start stamp, `skipped` stamped). §1's live-throttle note, §3's job count (12) and tier table, and §5's write and invocation figures updated. Found live: `lastRunAt` stamped 47 s into the minute and a 15-minute throttle running every 20 minutes; `booking-outbox-poke` throttled with no `lastRunAt`. Not re-checked: §2, §4, §6, §7 |
| 2026-09-27 | claude | Trigger events pasted by the owner (`*/5` and Sunday both `exceededCpu`, `cpuTimeMs` 10); live `cron-control` row (rev 303) and `cf-audit-last-synced` / `backup:status.lastTickAt`, both stopped at 2026-09-26 22:45 UTC; `npm run verify` | Each due job now runs in its own invocation through `JobRunner` (§5); held-back jobs cost no invocation. `runCronBatch` removed; the §3 and §5 references now name `dispatchCronJobs`. Not re-checked: §1, §2, §4, §7 |
| 2026-09-23 | claude | Chunk CB-2: `backup-tick` registered (`src/lib/jobs/registry.ts`), tier `essential`, budget 10/10 measured 0 queries on the configured path (`test/jobs-budget.test.ts`); catalog entry added to `scripts/lib/cron-catalog.mjs` — **reaches the page only after the owner re-seeds** (`node scripts/seed_cron_control.mjs --apply --remote`) | 12 jobs (10+2). Until the re-seed, the row shows the job by id |
| 2026-09-21 | claude | **First pass made against the page as it actually renders.** The components were mounted in headless Chromium with a fixture payload and the real stylesheet, and read at 1440px and 390px | Found what three rounds of source review had not: ~1200px of dead space in every row, a red 82%-full bar on a healthy system, a card headlining its own configuration, section descriptions stranded at the far right, a status pill stretched to the width of a text input, and failure counts invisible on mobile. All fixed. Note for anyone repeating this: the page needs no server — a Vite build with `@tailwindcss/vite`, an alias for `@`, and a stubbed `fetch` on `/api/cron` renders the real components faithfully |
| 2026-09-21 | claude | Run-console defects found from an owner's screenshot, verified by `npm run verify` (1075/1075) | The trace panel rendered before any run existed, so the dialog sat permanently at "Streaming execution trace from worker…" — a request that had not been made. It now appears only once a run starts, and its empty states key off running/finished. The catalog title **Failed sign-in monitor** was ambiguous (it reads as a monitor that has failed) and is now **Rejected sign-in monitor** — a re-seed is needed for that to reach production |
| 2026-09-21 | claude | UI and interaction pass after the owner reported the page confusing **on screen**, verified by `npm run verify` (1075/1075) | Row collapses to name/status/failures with detail behind a disclosure; pause and throttle merge into one Manage panel with one Save; three per-row buttons become one, with what the viewer lacks stated in words; the access line appears only when something is missing; auto-refresh moves beside the freshness it governs; the run dialog's confirm reads **Start run**. Still unverified in a browser at the time of writing |
| 2026-09-21 | claude | Closed CR-1, verified by `npm run verify` (1075/1075 tests) | Jobs log through `JobContext.log` instead of `console.*`: 46 call sites migrated across the six `scheduled-*.ts` handlers, ratchet A4 fell 420 → 374 by exactly that count. The manual-run console interleaves those lines with the D1 trace in arrival order. `console` is never patched — the reasoning is in `src/lib/jobs/job-log.ts` |
| 2026-09-20 | claude | Phases 2 and 3 of the improvement plan, verified by `npm run verify` (1071/1071 tests) | Run counts split into ticks/ran/failed; failures badged, bannered and filterable; the real cron expression carried from the registry and pinned against `wrangler.toml`; last-run and next-tick per row; freshness line, permission-free Refresh and opt-in auto-refresh; controls disabled-with-reason plus a "Your access" summary; a per-job throttle UI; a halt that can expire; a job filter and `?job=` deep link; and Run now confirms with an optional reason. No browser check — program principle 11 |
| 2026-09-20 | claude | Phase 1 of the improvement plan, verified by `npm run verify` (1047/1047 tests) | A pause/resume no longer erases `intervalMinutes`; `stampIntervalClocks` keeps `rev` so the dashboard's compare-and-swap token survives an hourly stamp; forced probes are floored at 60 s, audited as `cron_sync` and attributed to the actor; `GET /api/cron` and `POST /api/cron/sync` now share one read model; `asset-cleanup` and `staff-storage-reconcile` take a 900 s lease; the stale cost, lease and "compile error" comments are corrected and the empty `FIFTEEN_MIN_JOBS` export is gone |
| 2026-09-20 | claude | Phase 0 of the improvement plan: live D1 re-read of `admin_pages`, `admin_page_overrides` and `admin_audit_log`; Gate D traced through `src/pages/api/users/access.ts` | `#trigger`/`#configure` were ungrantable by the owner and are moved to the `owner` baseline by `0056`; `denyCron` and the page's capability flags now fail closed on a missing registry row; the Sync button is gated on `#trigger` with a permission-free Refresh beside it. Live: 4 registry rows active, **no cron override exists**, and the audit table holds 2 `cron_trigger` rows and no `cron_pause`/`cron_resume`/`config_change` at all — the two live pauses were written by the seed script and have no provenance |
| 2026-09-19 | claude | Re-derived the whole document against HEAD `a9dd974` and the live control row | `a9dd974` (2026-09-17) shipped a query-trace console, skeleton loading, `POST /api/cron/sync` and raw/per-database usage counts with no doc update; the lease, cost, interval, label and D-4 claims were all wrong and are corrected above. Live control row: `gsc-sync` off, `pagespeed-sync` off, **`blog-scheduled-publish` on**, `cron-usage-probe` on with `intervalMinutes 60` |
| 2026-09-16 | claude | Seeded the control document in production, then read `madagascar_analytics` across the seed boundary | `gsc-sync`, `pagespeed-sync` and `blog-scheduled-publish` moved from `ran` to `disabled`; every essential job continued to run; `cron-usage-probe` began reporting. *(Corrected 2026-09-19: `blog-scheduled-publish` was later resumed and is `on` in the live control row — only the two `idle` jobs remain paused.)* |
| 2026-09-16 | claude | D1 query on `admin_portal_settings` | Control document at rev 2, `updated_by: cron-usage-probe`, usage 0.176% reads / 0.179% writes at 13:05:20Z |
| 2026-09-16 | claude | D1 query on `admin_pages` | Four rows at `sort_order` 85-88 with the intended roles, icons and `parent_path` |
| 2026-09-16 | claude | D1 query on the control document after the interval fix | `rev` 3, `updated_by: cron-tick`, `cron-usage-probe.lastRunAt` written — the clock `decideJobRun` throttles against. Before this fix nothing wrote it, so `intervalMinutes` rendered as configurable and could never fire; found from production telemetry, not from a test |
| — | owner | Browser check at `/dashboard/cron` | **Pending** — the agent does not open browsers (program principle 11) |

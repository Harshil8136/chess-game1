---

title: "Cron Control Plane"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-09-20
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/jobs/control.ts, src/lib/jobs/job-log.ts, src/lib/jobs/tiers.ts, src/lib/jobs/registry.ts, src/lib/jobs/runJob.ts, src/lib/jobs/read-model.ts, src/lib/dal/CronControlRepository.ts, src/workers/scheduled-usage-probe.ts, src/lib/auth/surface-guards.ts, src/lib/auth/guard.ts, src/pages/api/cron/index.ts, src/pages/api/cron/state.ts, src/pages/api/cron/config.ts, src/pages/api/cron/sync.ts, src/components/admin/cron/CronDashboard.tsx, src/components/admin/cron/JobRow.tsx, src/components/admin/cron/TelemetryDeck.tsx, src/components/admin/cron/AccessSummary.tsx, src/components/admin/cron/JobFilter.tsx, src/components/admin/cron/RunConsole.tsx, src/components/admin/cron/status.ts, src/pages/dashboard/cron/index.astro, migrations/0056_cron_action_roles.sql]
related_docs: [../operations/OPERATIONS.md, ../architecture/PERMISSIONS-SYSTEM.md, ../MAINTENANCE.md, ../specs/2026-09-16-cron-control-plane-design.md, ../specs/2026-09-20-cron-control-improvement-plan.md]
tags: [cron, jobs, control-plane, plac, operations]
---

# Cron Control Plane

> **TL;DR (non-technical):** The portal runs a set of background jobs on a timer.
> This page is where you stop one, slow one down, run one by hand to see what it
> does, and check whether each is healthy. It also stands non-essential jobs down
> by itself if the free database allowance ever comes under pressure, and puts
> them back when it passes.

**Where:** `/dashboard/cron`, titled **Scheduled Jobs**. It appears in the sidebar for
anyone who can open it.

This document owns the job list, the tiers and the permission matrix.
[`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) links here rather than
restating them — one fact, one home.

## 1. What can be controlled

| Control | What it does | Permission |
|---|---|---|
| **Manage** (pause, resume, throttle) | One panel per job with one **Save**. Pausing needs a reason and may take an expiry; the throttle runs a job at most every N minutes, from "every time" (the reset) to 24 hours. Nothing commits until you save. | `#pause` |
| **Run now** | Opens the run console. **Start run** executes: it streams telemetry and a per-query trace, takes an optional reason, and bypasses the control document but not the job's own gate. | `#trigger` |
| **Sync telemetry** | Forces a live probe of Cloudflare's D1 analytics instead of waiting for the hourly one. Refused within 60 s of the last reading. | `#trigger` |
| **Refresh** | Re-reads this page's own data. Costs two D1 rows and an Analytics Engine query; probes nothing. | *page access only* |
| **Thresholds** | The D1 usage figures above which deferrable jobs stand down. | `#configure` |
| **Halt** | Stops every job, essential ones included. Requires a reason, and may be given an expiry. | `#configure` |

> **The throttle is a first-class control as of 2026-09-20.** Each row has a
> **Throttle** button behind `#pause`, and `POST /api/cron/state` accepts an
> interval-only body — no `state` means "leave the switch where it is", so
> throttling a paused job does not require the browser to restate a pause reason
> it did not author. An interval-only change audits as `config_change`, never as
> `cron_pause`: "who stopped this job" has to stay answerable from the action
> alone. Live today, only `cron-usage-probe` carries one (60 minutes).
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
> `src/pages/api/users/access.ts` refuses a grant when
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

There are **12 registered jobs** (`src/lib/jobs/registry.ts`): 10 on the
`*/5 * * * *` tick and 2 more on the Sunday `0 2 * * SUN` tick (`asset-cleanup`
and `staff-storage-reconcile`, both dispatched through the same `runCronBatch`).

Tiers live in **code** (`src/lib/jobs/tiers.ts`), not in the control document, so
a corrupt or hand-edited row cannot mark a security job as sheddable.

| Tier | Jobs | Automatic shedding |
|---|---|---|
| `essential` | `cf-access-audit-poll`, `cf-access-reconcile`, `booking-email-retry`, `booking-outbox-poke`, `cron-usage-probe`, `backup-tick` | never |
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

**A human pause can stop anything, including an essential job.** That is a
deliberate, audited act. Automatic shedding is not, so it never touches them.

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

## 5. What it costs

The control document is one JSON row in `admin_portal_settings`. No new table, no
new environment variable.

*Corrected 2026-09-19 — this section previously claimed the document was read as
"the 13th key of a batched settings query the tick already makes: +1 row read per
tick, no extra query". It is not. `readControl` issues its own `SELECT`
(`src/lib/dal/CronControlRepository.ts`), separate from the batched gate-key read.
The real per-tick cost is:*

- **two single-row reads per tick** — one from `runCronBatch`
  (`src/lib/jobs/runJob.ts`) and one from `cron-usage-probe`, which is essential
  and ungated and so re-reads the document on every tick before checking its own
  60-minute clock;
- **one write per hour** from the probe, plus one write per tick in which an
  interval-gated job actually ran (`stampIntervalClocks`, a single write for the
  whole tick).

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

A paused job still costs those reads, but nothing more: the gate runs before the
job's own logic, so the job itself never reaches D1.

## 6. Failure behaviour

**Everything fails open.** A missing control row, malformed JSON, an unknown
schema version, or a failed read all mean *every job runs*, exactly as before the
control plane existed. The jobs being gated include the Access whitelist sync and
the booking email retrier, so a configuration bug must never become a silent
outage of a security control.

The dashboard says so explicitly when no document is stored, rather than showing
an empty table.

## 7. Reading the page

- **Ticks / ran / failed, rows read, average duration** come from Analytics
  Engine, which records every tick's outcome. When that query cannot be made the
  chip reads "24h history unavailable" — it never shows a zero, because a zero
  run count reads as "this job has stopped". *Corrected 2026-09-19, fixed
  2026-09-20:* the chip used to show `totalRuns`, which counts **every** recorded
  outcome including `disabled` and `shed`, so a paused job on the five-minute
  tick advertised about 288 "runs". It now reads "288 ticks · 0 ran", with
  failures counted separately and called out in red; `runBreakdown`
  (`src/components/admin/cron/status.ts`) does the split and
  `test/cron-status-view.test.ts` pins it.
- **The row is a grid, and its columns are the numbers you scan.** Name, status,
  the last 24 hours, and when it next runs — so the eye can run down one column
  instead of zig-zagging. *Rebuilt 2026-09-21: at 1440px the row was a name on
  the left and two buttons on the right with roughly 1200px of nothing between
  them, eleven times over. Below 900px the columns stack and the 24-hour figures
  move under the name; "next run" is the one thing dropped, because it is not
  why anyone opens this page.*
- **A failing job does not look like a healthy one.** It carries a red left
  border and a tinted row. Before this, one job with three failures was
  distinguishable from ten healthy ones only by a small pill.
- **The cards report measurements, not settings.** *Corrected 2026-09-21.* "Job
  Health" showed `9/11` over a bar filled 82% in **red** — which reads as "most
  of this is on fire" for a system that was entirely healthy bar one job. The
  bar now tracks the share of jobs running, so a full bar is always the good
  outcome, and the failure count becomes the headline when there is one. "D1
  Quota Protection" led with `70% / 70%`, the configured threshold — a headline
  that reported the page's own settings back and never moved. It now leads with
  measured peak usage against that threshold.
- **Failures are surfaced, not buried.** A job with any `failed` outcome in 24 h
  carries a badge, appears in a banner at the top of the page naming it, and is
  reachable through the **Failing** filter chip. Raw handler `console` output is
  still only in Workers Observability.
- **The schedule shown comes from code.** `FIVE_MIN_CRON` and `SUNDAY_CRON` are
  declared once in `src/lib/jobs/registry.ts`; `cf-entry.ts` dispatches on them,
  the read model carries each job's expression, and
  `test/worker-entry-contract.test.ts` pins both against `wrangler.toml`. The
  plain-English line beside it is still the seeded catalog text, which is prose
  and can drift; the expression cannot.
- **Last run and next tick** are shown per row — the first from Analytics
  Engine's `lastSeen`, the second computed from the job's own trigger.
  `nextTickAt` understands only the two expressions this Worker declares and
  returns null for anything else rather than guessing.
- **The page says how old it is** ("Data as of …"), has a **Refresh** that needs
  no action permission, and offers auto-refresh as an opt-in remembered per
  browser. It is off by default: each refresh is two D1 row reads plus an
  Analytics Engine query, per open tab, for as long as the tab is open.
- **A row collapses to one question: is this job all right?** Name, what it will
  do next, and whether it has failed — plus the reason it is paused, when it is.
  Schedule, 24-hour counts, timing, database cost and the consequence of
  switching it off are one disclosure away, because they are what you read after
  something looks wrong, not while scanning eleven rows for the one that is.
  *Restructured 2026-09-21, after the page was called confusing on screen: the
  row carried up to nine competing chips and three buttons.*
- **What you may not do is said in words, once**, naming the key that would
  grant it, rather than rendered as a row of disabled buttons on every job. The
  header line appears only when something **is** missing — four ticks shown to
  someone who holds all four is a line that says nothing. The principle is
  unchanged from 2026-09-20: a capability that is simply absent teaches nobody
  it exists, and an access review cannot be run against a page that silently
  omits what it is hiding. *Reworded 2026-09-21.*
- **Pause and throttle are one panel with one Save.** They are the same decision
  from an operator's side and share one PLAC key, but they used to be two
  identical-looking drawers with opposite commit rules — a throttle applied the
  moment you touched a preset, a pause waited for a reason and a confirm. One
  request now carries the switch, the reason, the expiry and the throttle, so
  they cannot disagree half way through and one visit to the drawer writes one
  audit row. *Changed 2026-09-21.*
- **The status label** tells you why a job is idle. The current wording
  (`src/components/admin/cron/status.ts`) is **Active** / **Paused** /
  **Paused (Quota)** for an automatic shed / **Standby** while an interval window
  is open / **System Halted** / **Inactive**. Tier headings read
  "Essential Tasks", "Standard Tasks" and "Disabled / Inactive Tasks".
  *Corrected 2026-09-19 — the earlier wording quoted labels that no longer exist.*
- **The run console shows a trace only once there is a run.** Before that it is
  the confirm panel and nothing else. *Fixed 2026-09-21: the trace section
  rendered unconditionally and its "streaming" state keyed off the absence of
  data, so an open dialog claimed to be streaming from the worker indefinitely,
  before any request had been made. Found from a screenshot; no test would have
  caught it, because the component was never rendered in one.*
- **Run now** opens the console; **Start run** executes. The dialog used to run
  the job the instant it opened, so a misclick ran production work — a bucket
  cleaner, in one case — with nowhere to record intent; both `cron_trigger` rows
  in production are unexplained. The reason it asks for is optional and rides
  into the audit row. *Changed 2026-09-20; the confirm was renamed 2026-09-21,
  because "Run now" opening a dialog whose button said "Run it now" is two
  buttons with one verb and two meanings.* It bypasses the control document deliberately, so
  you can test a job you have just paused, and it does **not** bypass the job's
  own gate: Run now on `gsc-sync` still does nothing while `gsc-sync-enabled` is
  `false`.
- **Only the two weekly jobs take a lease.** `asset-cleanup` and
  `staff-storage-reconcile` declare `leaseSeconds: 900`, because both delete and
  a manual run bypasses the control document by design — two deleters walking the
  same bucket is the one overlap worth a D1 write. The ten five-minute jobs
  declare none: a lease is a write, writes are the scarcer resource, and 288
  writes a day each to protect idempotent work is the wrong trade. So a manual
  trigger *can* still overlap a scheduled tick for those ten. The Run-now route
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

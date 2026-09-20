---

title: "Cron Control Plane"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-09-20
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/jobs/control.ts, src/lib/jobs/tiers.ts, src/lib/jobs/registry.ts, src/lib/jobs/runJob.ts, src/lib/dal/CronControlRepository.ts, src/workers/scheduled-usage-probe.ts, src/lib/auth/surface-guards.ts, src/pages/api/cron/index.ts, src/pages/api/cron/state.ts, src/pages/api/cron/config.ts, src/pages/api/cron/sync.ts, src/components/admin/cron/CronDashboard.tsx, src/pages/dashboard/cron/index.astro]
related_docs: [../operations/OPERATIONS.md, ../architecture/PERMISSIONS-SYSTEM.md, ../MAINTENANCE.md, ../specs/2026-09-16-cron-control-plane-design.md]
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
| **Pause / resume** | Stops a job dispatching at all. Takes a required reason and an optional expiry. | `#pause` |
| **Interval** | Runs a job at most every N minutes instead of every tick. **No UI exists for this** — see the warning below. | `#pause` |
| **Run now** | Runs one job immediately and streams its telemetry and per-query trace. Bypasses the control document, but not the job's own gate. | `#trigger` |
| **Sync telemetry** | Forces a live probe of Cloudflare's D1 analytics instead of waiting for the hourly one. | `#trigger` |
| **Thresholds** | The D1 usage figures above which deferrable jobs stand down. | `#configure` |
| **Halt** | Stops every job, essential ones included. Requires a reason. | `#configure` |

> **The interval control still has no user interface, but pausing no longer
> erases it.** `POST /api/cron/state` accepts `intervalMinutes`; the dashboard
> never sends it (`src/components/admin/cron/CronDashboard.tsx`) and no row
> renders an input for it, so intervals remain API-and-seed-only until the UI
> ships (phase 3 of the improvement plan). Live today, only `cron-usage-probe`
> has one (60 minutes). *Corrected 2026-09-19; second half fixed 2026-09-20 —
> the route rebuilt each entry from the request body and carried over only
> `lastRunAt`, so one pause and resume through the page silently dropped any
> interval set through the API or the seed script. It merges into the stored
> entry now, pinned by `test/cron-api.test.ts`.*

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

Every pause, resume, trigger and configuration change writes a Ghost Audit row
(`cron_pause`, `cron_resume`, `cron_trigger`, `config_change`) naming the actor.
A pause or a halt also records its reason; a `cron_trigger` row carries no reason
field, and **`POST /api/cron/sync` writes no audit row at all** even though it
mutates the control document. *Corrected 2026-09-19.*

## 3. Tiers

There are **11 registered jobs** (`src/lib/jobs/registry.ts`): 9 on the
`*/5 * * * *` tick and 2 more on the Sunday `0 2 * * SUN` tick (`asset-cleanup`
and `staff-storage-reconcile`, both dispatched through the same `runCronBatch`).

Tiers live in **code** (`src/lib/jobs/tiers.ts`), not in the control document, so
a corrupt or hand-edited row cannot mark a security job as sheddable.

| Tier | Jobs | Automatic shedding |
|---|---|---|
| `essential` | `cf-access-audit-poll`, `cf-access-reconcile`, `booking-email-retry`, `booking-outbox-poke`, `cron-usage-probe` | never |
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

- **Runs / 24h, rows read, average duration** come from Analytics Engine, which
  records every tick's outcome. When that query cannot be made the chip reads
  "24h history unavailable" — it never shows a zero, because a zero run count
  reads as "this job has stopped". Note that the count is *every* recorded
  outcome, `disabled` and `shed` included, so a paused job on the five-minute
  tick still shows about 288 "runs". *Corrected 2026-09-19.*
- **The status label** tells you why a job is idle. The current wording
  (`src/components/admin/cron/status.ts`) is **Active** / **Paused** /
  **Paused (Quota)** for an automatic shed / **Standby** while an interval window
  is open / **System Halted** / **Inactive**. Tier headings read
  "Essential Tasks", "Standard Tasks" and "Disabled / Inactive Tasks".
  *Corrected 2026-09-19 — the earlier wording quoted labels that no longer exist.*
- **Run now** bypasses the control document deliberately, so you can test a job
  you have just paused. It does **not** bypass the job's own gate: Run now on
  `gsc-sync` still does nothing while `gsc-sync-enabled` is `false`.
- **Only the two weekly jobs take a lease.** `asset-cleanup` and
  `staff-storage-reconcile` declare `leaseSeconds: 900`, because both delete and
  a manual run bypasses the control document by design — two deleters walking the
  same bucket is the one overlap worth a D1 write. The nine five-minute jobs
  declare none: a lease is a write, writes are the scarcer resource, and 288
  writes a day each to protect idempotent work is the wrong trade. So a manual
  trigger *can* still overlap a scheduled tick for those nine. The Run-now route
  is an SSE stream: it returns 200 and reports `leaseHeld` in its `done` event —
  there is no 409 path. *Corrected 2026-09-19: this section previously promised
  that Run now "still honours the lease … you get a 409 rather than a duplicate
  run", and the code comment in `src/pages/api/cron/jobs/[id]/stream.ts` made the
  same claim. Leases added and that comment corrected 2026-09-20.*

> **Known limitations.** The run dialog now streams a per-query database trace
> (statement, table, rows and latency) alongside the structured job telemetry, and
> the page renders a skeleton while the first load is in flight — both added by
> `a9dd974`. Raw `console` output from inside a handler is still not captured
> there; it is in Workers Observability. Routing job-path `console.*` through the
> observability helper would close that, and it is not done yet.

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-20 | claude | Phase 1 of the improvement plan, verified by `npm run verify` (1047/1047 tests) | A pause/resume no longer erases `intervalMinutes`; `stampIntervalClocks` keeps `rev` so the dashboard's compare-and-swap token survives an hourly stamp; forced probes are floored at 60 s, audited as `cron_sync` and attributed to the actor; `GET /api/cron` and `POST /api/cron/sync` now share one read model; `asset-cleanup` and `staff-storage-reconcile` take a 900 s lease; the stale cost, lease and "compile error" comments are corrected and the empty `FIFTEEN_MIN_JOBS` export is gone |
| 2026-09-20 | claude | Phase 0 of the improvement plan: live D1 re-read of `admin_pages`, `admin_page_overrides` and `admin_audit_log`; Gate D traced through `src/pages/api/users/access.ts` | `#trigger`/`#configure` were ungrantable by the owner and are moved to the `owner` baseline by `0056`; `denyCron` and the page's capability flags now fail closed on a missing registry row; the Sync button is gated on `#trigger` with a permission-free Refresh beside it. Live: 4 registry rows active, **no cron override exists**, and the audit table holds 2 `cron_trigger` rows and no `cron_pause`/`cron_resume`/`config_change` at all — the two live pauses were written by the seed script and have no provenance |
| 2026-09-19 | claude | Re-derived the whole document against HEAD `a9dd974` and the live control row | `a9dd974` (2026-09-17) shipped a query-trace console, skeleton loading, `POST /api/cron/sync` and raw/per-database usage counts with no doc update; the lease, cost, interval, label and D-4 claims were all wrong and are corrected above. Live control row: `gsc-sync` off, `pagespeed-sync` off, **`blog-scheduled-publish` on**, `cron-usage-probe` on with `intervalMinutes 60` |
| 2026-09-16 | claude | Seeded the control document in production, then read `madagascar_analytics` across the seed boundary | `gsc-sync`, `pagespeed-sync` and `blog-scheduled-publish` moved from `ran` to `disabled`; every essential job continued to run; `cron-usage-probe` began reporting. *(Corrected 2026-09-19: `blog-scheduled-publish` was later resumed and is `on` in the live control row — only the two `idle` jobs remain paused.)* |
| 2026-09-16 | claude | D1 query on `admin_portal_settings` | Control document at rev 2, `updated_by: cron-usage-probe`, usage 0.176% reads / 0.179% writes at 13:05:20Z |
| 2026-09-16 | claude | D1 query on `admin_pages` | Four rows at `sort_order` 85-88 with the intended roles, icons and `parent_path` |
| 2026-09-16 | claude | D1 query on the control document after the interval fix | `rev` 3, `updated_by: cron-tick`, `cron-usage-probe.lastRunAt` written — the clock `decideJobRun` throttles against. Before this fix nothing wrote it, so `intervalMinutes` rendered as configurable and could never fire; found from production telemetry, not from a test |
| — | owner | Browser check at `/dashboard/cron` | **Pending** — the agent does not open browsers (program principle 11) |

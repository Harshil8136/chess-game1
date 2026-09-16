---

title: "Cron Control Plane"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-09-16
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/jobs/control.ts, src/lib/jobs/tiers.ts, src/lib/jobs/runJob.ts, src/lib/dal/CronControlRepository.ts, src/workers/scheduled-usage-probe.ts, src/lib/auth/surface-guards.ts, src/pages/dashboard/cron/index.astro]
related_docs: [../operations/OPERATIONS.md, ../architecture/PERMISSIONS-SYSTEM.md, ../specs/2026-09-16-cron-control-plane-design.md, ../program/ROADMAP.md]
tags: [cron, jobs, control-plane, plac, operations]
---

# Cron Control Plane

> **TL;DR (non-technical):** The portal runs a set of background jobs on a timer.
> This page is where you stop one, slow one down, run one by hand to see what it
> does, and check whether each is healthy. It also stands non-essential jobs down
> by itself if the free database allowance ever comes under pressure, and puts
> them back when it passes.

**Where:** `/dashboard/cron`. It appears in the sidebar for anyone who can open it.

This document owns the job list, the tiers and the permission matrix.
[`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) links here rather than
restating them — one fact, one home.

## 1. What can be controlled

| Control | What it does | Permission |
|---|---|---|
| **Pause / resume** | Stops a job dispatching at all. Takes a required reason and an optional expiry. | `#pause` |
| **Interval** | Runs a job at most every N minutes instead of every tick, without a deploy. The tick records `lastRunAt` for interval-gated jobs in one write per tick, which is what the throttle measures against. | `#pause` |
| **Run now** | Runs one job immediately and shows its telemetry. Works on a paused job. | `#trigger` |
| **Thresholds** | The D1 usage figures above which deferrable jobs stand down. | `#configure` |
| **Halt** | Stops every job, essential ones included. Requires a reason. | `#configure` |

## 2. Permissions

Four `admin_pages` rows (migrations `0054` and `0055`). Stored role values are
shown, because the database still holds the pre-rename vocabulary.

| Path | Stored role | vendor_support | owner | admin | manager | staff |
|---|---|---|---|---|---|---|
| `/dashboard/cron` | `super_admin` | bypass | bypass | **allow** | deny | deny |
| `/dashboard/cron#pause` | `owner` | bypass | bypass | deny | deny | deny |
| `/dashboard/cron#trigger` | `dev` | bypass | bypass | deny | deny | deny |
| `/dashboard/cron#configure` | `dev` | bypass | bypass | deny | deny | deny |

Three things about this are easy to get wrong and are worth stating plainly.

**The owner cannot be restricted here.** `requirePageAccess()` returns
immediately for `vendor_support` and `owner`, so these baselines bind admin and
below. That is ADR-0002 answer 2 — a self-inflicted lockout of the customer's top
tier is judged the worse failure — not a gap.

**Any tier below owner can be granted one action without the others.** An
individual admin can be given `#pause` through `admin_page_overrides` while still
being refused `#trigger`. Deny always beats grant. This is what makes the model
multi-level rather than a fixed ladder.

**A deny on the page does not automatically deny the actions.** Ancestor matching
in `resolveAccess` is `startsWith(key + '/')`, and `#pause` supplies no `/`. Every
cron API route therefore checks the page key *and* its action key, through
`src/lib/auth/surface-guards.ts`. Gap D-4 in
[`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md)
is this same mistake made once already elsewhere — in the sessions routes, whose four
sub-permissions were fixed alongside this doc and now share that module.

Every pause, resume, trigger and configuration change writes a Ghost Audit row
(`cron_pause`, `cron_resume`, `cron_trigger`, `config_change`) with the actor and
the reason.

## 3. Tiers

Tiers live in **code** (`src/lib/jobs/tiers.ts`), not in the control document, so
a corrupt or hand-edited row cannot mark a security job as sheddable. Adding a
job to the registry without a tier is a compile error.

| Tier | Jobs | Automatic shedding |
|---|---|---|
| `essential` | `cf-access-audit-poll`, `cf-access-reconcile`, `booking-email-retry`, `booking-outbox-poke`, `cron-usage-probe` | never |
| `deferrable` | `storage-notifications`, `blog-scheduled-publish`, `asset-cleanup`, `staff-storage-reconcile` | yes |
| `idle` | `gsc-sync`, `pagespeed-sync` | yes |

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

**Current headroom, measured 2026-09-16:** 0.18% of the daily read allowance and
0.18% of writes. The 70% default thresholds have never been approached; treat
shedding as insurance, not as something that fires routinely.

## 5. What it costs

The control document is one JSON row in `admin_portal_settings`, read as the 13th
key of a batched settings query the tick already makes — **+1 row read per tick,
no extra query**, however many jobs are registered. No new table, no new
environment variable.

A paused job costs nothing beyond that single read: the gate runs before the
job's own logic, so it never reaches D1.

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
  already records every run. When that query cannot be made the page says
  "History unavailable" — it never shows a zero, because a zero run count reads
  as "this job has stopped".
- **"Runs on the next tick"** versus a reason (`Paused`, `Shed`, `Waiting for its
  interval`, `Halted`) tells you why a job is idle.
- **Run now** bypasses the control document deliberately, so you can test a job
  you have just paused. It still honours the lease, so it cannot race a scheduled
  tick; if one is already running you get a 409 rather than a duplicate run.

> **Known limitation.** The run dialog shows structured job telemetry. Raw
> `console` output from inside a handler is not captured there — it is in Workers
> Observability. Routing job-path `console.*` through the observability helper
> would close this; it is not done yet.

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-16 | claude | Seeded the control document in production, then read `madagascar_analytics` across the seed boundary | `gsc-sync`, `pagespeed-sync` and `blog-scheduled-publish` moved from `ran` to `disabled`; every essential job continued to run; `cron-usage-probe` began reporting |
| 2026-09-16 | claude | D1 query on `admin_portal_settings` | Control document at rev 2, `updated_by: cron-usage-probe`, usage 0.176% reads / 0.179% writes at 13:05:20Z |
| 2026-09-16 | claude | D1 query on `admin_pages` | Four rows at `sort_order` 85-88 with the intended roles, icons and `parent_path` |
| 2026-09-16 | claude | D1 query on the control document after the interval fix | `rev` 3, `updated_by: cron-tick`, `cron-usage-probe.lastRunAt` written — the clock `decideJobRun` throttles against. Before this fix nothing wrote it, so `intervalMinutes` rendered as configurable and could never fire; found from production telemetry, not from a test |
| — | owner | Browser check at `/dashboard/cron` | **Pending** — the agent does not open browsers (program principle 11) |

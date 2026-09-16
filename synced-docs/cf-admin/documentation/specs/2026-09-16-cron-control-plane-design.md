---

title: "Cron Control Plane — Design"
status: draft
audience: [ai, technical, owner, operator]
last_verified: 2026-09-16
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/jobs/registry.ts, src/lib/jobs/runJob.ts, src/lib/jobs/budgets.ts, src/lib/jobs/telemetry.ts, src/lib/dal/PortalSettingsRepository.ts, src/lib/auth/routes.ts, src/workers/cf-entry.ts]
related_docs: [../program/ROADMAP.md, ../program/DEBT-REGISTRY.md, ../operations/OPERATIONS.md, ../architecture/PERMISSIONS-SYSTEM.md, ./2026-09-10-d1-and-worker-resource-optimization-design.md, ../../RULESAd.md]
tags: [cron, jobs, control-plane, plac, observability, design]
---

<!-- docs-check: proposed-paths -->
<!-- This is a design. It names files the implementation will create; the
     code-path check is opted out here and enforced on the chunk records once
     each stage ships. -->

# Cron Control Plane — Design

> **TL;DR (non-technical):** The portal runs ten background jobs on a timer. Today
> there is no way to stop one, test one, or see how one is doing without editing
> code and deploying — which takes minutes and touches production. This adds a
> dashboard page where the right people can pause a job, run one on demand and
> watch the result, and see whether each job is healthy. It also lets the system
> stand down its own non-essential jobs automatically if the free-tier database
> budget ever comes under pressure, and puts it all back when the pressure passes.

## 1. Why

### 1.1 What was measured (2026-09-16, live)

Every figure below came from the Analytics Engine SQL API and the Cloudflare
GraphQL API on 2026-09-16, not from another document.

| Job | Runs / 24 h | D1 rows read | Avg ms | Note |
|---|---:|---:|---:|---|
| `cf-access-audit-poll` | 288 ran | 69 | 1408 | slowest; external CF API every tick |
| `booking-email-retry` | 287 ran | 1435 | 146 | largest D1 consumer, **no gate** |
| `cf-access-reconcile` | 289 ran | 6 | 461 | |
| `blog-scheduled-publish` | 287 ran | 0 | 143 | **no-op every run** |
| `gsc-sync` | 288 ran | 0 | 0 | **no-op every run** (disabled 2026-08-26) |
| `pagespeed-sync` | 288 ran | 0 | 0 | **no-op every run** (disabled 2026-08-22) |
| `booking-outbox-poke` | 287 skipped | 0 | 142 | chunk 8 gate working |
| `storage-notifications` | 22 ran / 265 skipped | 285 | 1255 | chunk 8 gate working |

**2,301 job executions per day, of which 863 do nothing at all** (zero rows read,
zero written). One live cron tick was captured with `wrangler tail`: 1 invocation,
**10 log events**, wallTime 1327 ms, cpuTime 22 ms.

### 1.2 What this is, and is not, for

The prompting observation was 22,644 log events in Workers Observability in 24
hours. **That number is account-wide and is mostly cf-astro**, which served 4,523
requests against cf-admin's 548 in the same window. cf-admin's crons account for
roughly 288 × 11 ≈ **3,200 events/day, about 14%**.

This design is therefore **not** primarily a log-volume fix, and must not be sold
as one. Cutting the account-wide figure is a separate piece of work whose levers
are `head_sampling_rate` and cf-astro's own logging. What this design is for:

1. There is no way to stop a misbehaving job without a deploy.
2. 863 dispatches/day do nothing but still cost telemetry, logs and CPU.
3. There is no manual trigger, so testing a job means waiting up to five minutes
   or deploying.
4. Budget breaches surface only as recurring Sentry noise after the fact —
   `CF-ADMIN-1Q` ran for days, `CF-ADMIN-1S` likewise.

### 1.3 Headroom — stated plainly so the urgency is not overstated

Account-wide D1 usage, last 7 days:

| Date | Rows read | % of 5 M | Rows written | % of 100 k |
|---|---:|---:|---:|---:|
| 2026-09-15 | 50,031 | 1.00 % | 536 | 0.5 % |
| 2026-09-12 | 52,663 | 1.05 % | 873 | 0.9 % |
| 2026-09-10 | 180,281 | 3.61 % | 15,039 | **15.0 %** |

There is ~99 % headroom on reads. Auto-shedding is **cheap insurance against a
surge, not a fire being fought.** It matters because D1 free-tier daily limits
became *enforced* on 2026-09-01 — queries now fail account-wide until UTC
midnight — and the limit is shared with cf-astro.

### 1.4 Why not manage the cron triggers themselves

Cloudflare's own documentation states that when a Worker is managed with Wrangler,
Cron Triggers "should be exclusively managed through the Wrangler configuration
file", and that trigger changes take **up to 15 minutes to propagate**. An
API-level pause would therefore be too slow for a surge, would fight
`wrangler.toml`, and would be silently reverted by the next deploy. **Gating in
code is the correct mechanism.** Trigger manipulation is explicitly out of scope.

## 2. Owner decisions (2026-09-16)

| Decision | Answer |
|---|---|
| Surge response | **Auto-pause with manual override** — the system sheds non-essential jobs at a usage threshold and self-restores; a human can always override |
| Placement & access | **Own page `/dashboard/cron` with split PLAC permissions** — not `/dashboard/debug`, which requires stored role `dev` and so excludes the owner |
| Criticality tiers | **Security and booking jobs are essential and never auto-shed**; everything else is deferrable or idle |
| Storage | **One JSON control row in `admin_portal_settings`**, folded into the tick's existing batched read |

## 3. Rule compliance (program principle 5 — written proof, not assertion)

- **RULE #0.6 (reuse before creation).** `admin_portal_settings` already stores
  every operational toggle in this repo and is already read once per tick by
  `runCronBatch` → `collectGateKeys` → `readSettings`. The control state is
  configuration keyed by a string — exactly what this table exists for. No new
  store is needed.
- **RULE #0.8 (env var cap).** No new environment variable. Thresholds, per-job
  state and intervals are all dynamic config in D1, which is what this rule
  requires.
- **RULE #0.9 (migration-minimal).** No new table. The only migration is four
  `admin_pages` rows for the PLAC entries, which is data in an existing table,
  not schema. Run history needs no table either: `writeAnalytics` already records
  every job run to the `madagascar_analytics` Analytics Engine dataset, and that
  dataset is queryable through the Analytics Engine SQL API (verified working
  2026-09-16).

## 4. Data model

One row: `setting_key = 'cron-control'`, `scope_type = 'global'`, `scope_id = ''`,
`setting_type = 'json'`, `category = 'system'`.

```jsonc
{
  "v": 1,                  // schema version; a reader that does not know v is fail-open
  "rev": 42,               // monotonic; the compare-and-swap token
  "mode": "normal",        // "normal" | "halt"   (manual only)
  "jobs": {
    "gsc-sync":             { "state": "off", "reason": "disabled 2026-08-22", "until": null, "by": "owner@…" },
    "storage-notifications":{ "state": "on", "intervalMinutes": 60 }
  },
  "usage":      { "checkedAt": "2026-09-16T04:00:00Z", "rowsReadPct": 1.0, "rowsWrittenPct": 0.5 },
  "thresholds": { "shedAtReadPct": 70, "shedAtWritePct": 70 }
}
```

A job absent from `jobs` is on with no interval. That keeps the row small and
makes "on" the default that survives data loss.

### 4.1 Tiers live in code, deliberately

```ts
export const JOB_TIERS: Record<JobId, JobTier> = { … };
```

Tiers are **not** in the JSON row. If they were data, a corrupt or hand-edited row
could mark `cf-access-reconcile` — the access-whitelist sync — as sheddable. A
security control silently standing down is the one failure this system must never
cause. Code is the safe default, and `Record<JobId, …>` makes omission a compile
error (§8).

| Tier | Jobs | Auto-shed? |
|---|---|---|
| `essential` | `cf-access-audit-poll`, `cf-access-reconcile`, `booking-email-retry`, `booking-outbox-poke` | never |
| `deferrable` | `storage-notifications`, `blog-scheduled-publish`, `asset-cleanup`, `staff-storage-reconcile` | yes |
| `idle` | `gsc-sync`, `pagespeed-sync` | yes |
| `essential` | `cron-usage-probe` (§6) | never — see below |

Manual pause can still stop anything, including `essential` jobs — that is a
deliberate, audited, human act, unlike automatic shedding.

One threshold governs both `deferrable` and `idle`; there is no separate
lower bound for `idle`, because idle jobs are already switched off and a
second threshold would be a knob with nothing behind it.

### 4.2 Concurrency

Writes use compare-and-swap on `rev`:

```sql
UPDATE admin_portal_settings
   SET setting_value = ?new, updated_at = CURRENT_TIMESTAMP, updated_by = ?actor
 WHERE setting_key = 'cron-control' AND scope_type = 'global' AND scope_id = ''
   AND json_extract(setting_value, '$.rev') = ?expectedRev
```

Zero rows changed means someone else wrote first; the caller re-reads and retries
once, then reports a conflict to the UI. One row means "pause everything" is a
single atomic write — during an incident, a half-applied pause is the worst
possible outcome.

## 5. Control flow

`collectGateKeys` already batches 12 keys into **one** query per tick.
`cron-control` becomes the 13th key.

> **Cost: +1 row read per tick, zero extra queries.** 288 extra row reads/day
> against a 5,000,000/day limit. This is cheaper than a per-job key scheme
> (+10 rows/tick) and cheaper than a KV round-trip, which would add a subrequest
> and latency to a query that is already happening.

A pure function decides, before the existing `shouldRun` gate:

```ts
export function decideJobRun(input: {
  jobId: JobId; tier: JobTier; control: CronControl | null; now: number;
}): { run: true } | { run: false; reason: 'halted' | 'paused' | 'shed' | 'interval' }
```

Order of evaluation:

1. `control === null` → **run** (fail open).
2. `mode === 'halt'` → skip, `halted`.
3. `jobs[id].state === 'off'` → if `until` is set and `now > until`, treat as on
   (the pause has expired) and let the next write clean it up; otherwise skip,
   `paused`.
4. `tier !== 'essential'` and `usage` exceeds `thresholds` → skip, `shed`.
5. `intervalMinutes` set and not elapsed → skip, `interval`.
6. Otherwise run, and the existing `shouldRun` gate applies unchanged.

### 5.1 Fail-open is mandatory

A missing row, malformed JSON, an unknown `v`, or a failed read **must** result in
every job running exactly as it does today. This matches the doctrine already
written into `runJob.ts` ("Every step fails OPEN"). It is not a stylistic choice:
the jobs being gated include the access-control sync and the booking email
retrier, and a config bug must never be able to stop them silently.

### 5.2 Pause expiry

Every pause takes an optional `until`. Without it, the predictable failure is a
job paused during an incident and forgotten for a month. The UI defaults the
picker to a bounded value and requires an explicit choice to pause indefinitely.

### 5.3 New outcomes

`JobOutcome['outcome']` gains `'disabled'` and `'shed'` beside `ran`, `skipped`,
`failed`, `lease-held`. These already flow into `blob2` of the Analytics Engine
data point, so history and the health view get them at no extra cost.

### 5.4 Log volume

`reportJobOutcome` currently emits one Observability line per job per tick —
2,301/day. After this change, `disabled`, `shed` and `skipped` outcomes write the
Analytics Engine data point (not a log event) and **do not** emit an Observability
line; `ran` and `failed` still do. Combined with turning off the three no-op jobs,
cron log events fall from roughly 3,200/day to roughly 1,000/day.

## 6. Auto-shed signal

A new hourly job, `cron-usage-probe`, queries Cloudflare's
`d1AnalyticsAdaptiveGroups` GraphQL dataset and writes the result into `usage` on
the same control row. Every tick then reads an already-cached number at zero
marginal cost.

It queries **account-wide** usage deliberately: the D1 daily limit is account-wide
and shared with cf-astro, so self-metering would only ever see cf-admin's own
slice and would miss the actual threat. Self-metering would also cost a D1 *write*
every tick, and writes are the scarcer resource (15 % peak vs 3.6 % for reads).

> **The probe is `essential` and must never be shed.** If shedding could stop the
> probe, `usage` would go stale, staleness would lift the shed, the probe would
> run, and shedding would re-engage — an oscillation. Making the probe essential
> removes the loop entirely.

> **Its interval defaults in code, not only in the control row.** Fail-open means
> a missing control row runs every job every tick; for the probe that would be 288
> Cloudflare API calls a day instead of 24. Its 60-minute interval therefore has a
> hardcoded default that the control row can tune but not accidentally remove.

Cost: 24 subrequests and 24 writes per day. Uses the existing
`CLOUDFLARE_API_TOKEN` secret — no new env var. If the probe fails, `usage` goes
stale; a `checkedAt` older than 3 hours is treated as "unknown" and **disables
shedding** rather than assuming pressure.

Shedding self-restores as soon as a later probe reads below the threshold, and
resets naturally at UTC midnight. There is no sticky state to clear.

## 7. Permissions

Four `admin_pages` rows, following the established pseudo-path pattern already
used by `/dashboard/logs#export` and `/dashboard/alerts#resolve`. Stored role
values are shown because the database still holds the pre-rename vocabulary;
writes must go through `toStoredRole()`.

| Path | Stored role | Canonical | Grants |
|---|---|---|---|
| `/dashboard/cron` | `super_admin` | admin (2) | view, health, history |
| `/dashboard/cron#pause` | `owner` | owner (1) | pause, resume, set interval |
| `/dashboard/cron#trigger` | `dev` | vendor_support (0) | manual run |
| `/dashboard/cron#configure` | `dev` | vendor_support (0) | thresholds, halt |

`src/lib/auth/routes.ts` gains `'/api/cron': '/dashboard/cron'` so SEC-07's
`resolveApiAuthz` resolves the API surface; the sub-permissions are checked
explicitly in each handler.

> **Why not `/dashboard/debug`.** That page requires stored role `dev`
> (canonical `vendor_support`, level 0), so the owner cannot open it. Putting the
> emergency pause switch behind it would mean the person who owns the business
> cannot stop a runaway job.

> **Corrected 2026-09-16, before implementation.** The table above reads as
> though `#trigger` and `#configure` exclude the owner. They do not.
> `requirePageAccess()` (`src/lib/auth/guard.ts`) returns immediately for
> **both** `vendor_support` and `owner`, so PLAC restricts levels 2-5 only and
> the owner passes every one of these keys. That is ADR-0002 answer 2 — a
> self-inflicted lockout of the customer's top tier is the worse failure — not a
> gap to close. The `required_role` column still matters, because it sets the
> baseline for admin and below, and any of those tiers can be granted a row
> individually through `admin_page_overrides`.
>
> Two further facts the implementation depends on, both verified in code:
> `isExplicitlyDenied` treats a key the registry does not define as **allowed**,
> so these rows are load-bearing rather than cosmetic; and ancestor matching is
> `startsWith(key + '/')`, so `/dashboard/cron#pause` does **not** inherit a deny
> on `/dashboard/cron` — handlers must check both keys.

Every mutating action writes a Ghost Audit row (`module: 'system'`,
`action: 'pause' | 'resume' | 'trigger' | 'configure'`) with the actor, the job
and the supplied reason.

## 8. Enforcement — types first, documentation second

The requirement is that no future cron can be added without passing through this
system. The strongest available mechanism is the type checker, not a convention:

1. `export type JobId = (typeof ALL_JOBS)[number]['id']` — derived from the
   registry, so it cannot drift from it.
2. `JOB_TIERS: Record<JobId, JobTier>` — **adding a job without a tier fails
   `npm run typecheck`.**
3. `JOB_BUDGETS` is retyped from `Record<string, JobBudget>` to
   `Record<JobId, JobBudget>`. **This closes a live latent bug:** today a missing
   or mistyped id yields `undefined`, and `runJob` computes
   `overBudget: budget ? … : false` — so a job with no budget entry is *silently
   never monitored*. That is the same blind spot that produced `CF-ADMIN-1S` and
   `CF-ADMIN-1Q`.
4. `test/cron-contract.test.ts` — every registry job has a budget, a tier and a
   row in the docs table; every `crons` entry in `wrangler.toml` is dispatched by
   `cf-entry.ts`.
5. A `scripts/rules_check.py` rule so CI fails when a cron expression appears in
   `wrangler.toml` without a matching registry dispatch.
6. A planned `documentation/features/CRON-CONTROL.md` (created in stage C) becomes
   the owner document. `operations/OPERATIONS.md` § "Scheduled triggers" links to it rather than
   restating the job list — one fact, one home.

## 9. Manual trigger

`POST /api/cron/jobs/[id]/run`, gated on `/dashboard/cron#trigger`.

- **Bypasses the control state on purpose** — the point is to test a paused job.
- **Honours the lease**, so it cannot race a real tick; if the lease is held it
  reports that rather than forcing.
- Returns outcome, meter (rows read/written, query count), duration, declared
  budget vs actual, and captured log lines.
- Writes a Ghost Audit row before running.

> **Known limitation, stated up front.** Structured logs routed through
> `logToObservability` are captured cleanly. Raw `console.*` inside a handler
> cannot be intercepted per-invocation in workerd without patching the global
> console, which is unsafe under concurrency. The fix is to route job-path
> `console.*` through the observability helper — work the log-volume goal wants
> regardless (ratchet A4 counts 423 `console.*` calls under `src/`). Capture
> becomes complete as a side effect. Until then the UI labels the log panel as
> structured events only, rather than implying completeness.

## 10. Health view

Sourced from the Analytics Engine SQL API — no new storage, and the query is the
one already verified working on 2026-09-16.

Per job: runs by outcome over 24 h and 7 d, average duration, rows read/written,
last seen, current control state, and budget headroom. Plus two checks that catch
problems nothing else does:

- **Expected vs actual run count** — a job that silently stopped firing shows as a
  deficit. Nothing detects this today.
- **Schedule drift** — live cron schedules read from the Cloudflare API compared
  against `wrangler.toml`. `OPERATIONS.md` already warns that config is what
  *should* be deployed, not what is.

## 11. What this deliberately does not do

- It does not create, delete or modify Cloudflare cron triggers (§1.4).
- It does not auto-delete anything. Retention stays manual, per ADR-0001.
- It does not reduce the 22,644 account-wide log figure meaningfully (§1.2).
- It does not stop the Worker being *invoked* by the cron trigger. A paused job
  skips its work; the invocation and the single batched settings read still
  happen. Eliminating invocations requires removing the trigger, which §1.4 rules
  out.

## 12. Rollout

Expand/contract, per program principle 6. Three separate pushes to `main`, each
green on `npm run verify` before the next.

| Stage | Contents | Behaviour change |
|---|---|---|
| A | `src/lib/jobs/control.ts` (types, `decideJobRun`, CAS read/write), `JobId`/`JOB_TIERS`, `JOB_BUDGETS` retyping, contract test, unit tests | **None.** No control row exists, so every path fails open to today's behaviour. |
| B | Wire `decideJobRun` into `runJob`/`runCronBatch`, new outcomes, log-volume change, seed the control row, turn off the three no-op jobs, `cron-usage-probe` | 863 no-op dispatches/day → ~0; cron log events ~3,200 → ~1,000/day |
| C | `/dashboard/cron` page + islands, `/api/cron/*` routes, `admin_pages` migration `0053`, health view, manual trigger, the planned `CRON-CONTROL.md` + index row | New surface; owner browser check per principle 11 |

Migration `0053` respects RULE #0.7b (cf-admin owns `0033`+; `0052` is the highest
applied) and carries its three RULE #0.7 artifacts including a ledger row.

## 13. Open items for the owner

| Ref | Item |
|---|---|
| C-1 | Initial `shedAtReadPct` / `shedAtWritePct` of 70 is a starting value, not a measured one. With 99 % headroom it has never been approached; revisit after the first month of probe data. |
| C-2 | Stage C ends with a manual browser check (principle 11 — the agent does not open a browser). |
| C-3 | `[observability.traces] enabled = true` will begin consuming the 200,000/day free log quota from **2026-10-01**, when trace spans start counting as observability events. Decide before that date whether to keep traces on. |

## 14. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-16 | claude | Analytics Engine SQL API, Cloudflare GraphQL (`workersInvocationsAdaptive`, `d1AnalyticsAdaptiveGroups`), `wrangler tail` on production, Cloudflare docs MCP, live D1 and Supabase queries | Design written against measured figures; §1.1, §1.3 and the 10-events-per-tick measurement are live readings, not estimates |

---

title: "Cron Control Plane — Implementation Plan"
status: draft
audience: [ai, technical, owner]
last_verified: 2026-09-16
verified_against: [code]
owner: harshil
related_code: [src/lib/jobs/registry.ts, src/lib/jobs/runJob.ts, src/lib/jobs/budgets.ts, src/lib/jobs/telemetry.ts, src/lib/auth/routes.ts, src/lib/auth/guard.ts, src/lib/auth/decide-access.ts, src/lib/dal/PortalSettingsRepository.ts]
related_docs: [./2026-09-16-cron-control-plane-design.md, ../architecture/PERMISSIONS-SYSTEM.md, ../program/ROADMAP.md, ../operations/OPERATIONS.md, ../../RULESAd.md]
tags: [cron, jobs, control-plane, plac, permissions, plan]
---

<!-- docs-check: proposed-paths -->
<!-- This is a plan. It names files each task will create; the code-path check
     is opted out here and enforced on the chunk records once each stage ships. -->

# Cron Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the ten scheduled jobs a control plane — pause, resume, per-job interval, manual trigger with captured telemetry, health, and automatic shedding under D1 pressure — reachable from `/dashboard/cron` under multi-level PLAC permissions.

**Architecture:** One JSON row (`cron-control`) in `admin_portal_settings`, read as the 13th key of the tick's existing batched settings query, so gating costs +1 row read and no extra query. A pure `decideJobRun()` runs before the existing `shouldRun` gate and fails open on every error path. Criticality tiers live in code as `Record<JobId, JobTier>`, so a job cannot ship without one. Permissions use the established hash-fragment pattern in `admin_pages`, with handlers checking both the page key and the fragment key.

**Tech Stack:** Astro 7 SSR, Preact 10 islands, TypeScript strict, D1 via the DAL repository pattern, Vitest under `@cloudflare/vitest-pool-workers`.

**Spec:** [`2026-09-16-cron-control-plane-design.md`](./2026-09-16-cron-control-plane-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **RULE #0.5** — no mock data, no placeholder UI. Every figure rendered comes from a real query.
- **RULE #0.6 / #0.8 / #0.9** — no new D1 table, no new KV namespace, no new environment variable. Control state lives in `admin_portal_settings`; run history is already in Analytics Engine.
- **RULE #0.7 / #0.7b** — the only migration is `0054` (cf-admin owns `0033`+; `0053` is the highest applied). Three artifacts: the DDL file, the applied migration, a ledger row. Additive only. Freeze it with `node scripts/migrations_manifest.mjs` and regenerate `database/schema.snapshot.sql`.
- **SEC-03** — API handlers must use a DAL repository. No raw `.prepare(` or `.batch(` in `src/pages/api/**`.
- **SEC-05** — use `getEnv(context)`; there is no `process.env` in workerd.
- **SEC-06 / SEC-07** — every API handler gates on `requireAuth()` / `placDenyResponse()`, and every `/api/*` route must resolve through `API_PAGE_MAPPING`. `test/api-authz-inventory.test.ts` fails CI otherwise.
- **Ratchet** — `A6` inline `style={` and `A7` raw hex outside `src/styles/` may only fall: use design tokens and component CSS. `A14` files over 600 lines may only fall. `A19` every catch on a job path either reports through `reportNonFatal`/`reportOnceCooled` or carries `// silent-ok: <reason>`.
- **RULESAd §7.8** — any modal uses `<dialog>` + `dialogRef.current?.showModal()` with inline `style={{}}` for width. Never `<dialog open>`, never a `fixed inset-0` div.
- **Fail open** — every control-plane error path runs the job. The jobs being gated include the access-control sync.
- **No new dependencies.** `lucide-preact` for icons, nothing else added.
- **Every stage ends green** on `npm run verify` and is pushed to `main` alone.

## Permission facts this plan is built on

Verified against code on 2026-09-16. Getting these wrong is the main risk in the whole plan.

| Fact | Source | Consequence for this plan |
|---|---|---|
| `requirePageAccess()` returns immediately for **`vendor_support` AND `owner`** | `src/lib/auth/guard.ts` | PLAC cannot restrict the owner. Sub-permissions restrict levels 2–5 only. The spec's "trigger is vendor-support-only" was wrong and is corrected here. |
| `isExplicitlyDenied` treats an **unknown key as allowed** | `src/lib/auth/decide-access.ts` | A handler checking `/dashboard/cron#trigger` is a **no-op for every role** until that row exists in `admin_pages`. The migration is load-bearing, not cosmetic. |
| Ancestor matching is `normalized.startsWith(key + '/')` | `src/lib/auth/decide-access.ts` | `/dashboard/cron#pause` does **not** inherit a deny on `/dashboard/cron`. Handlers must check **both** keys. This is how gap D-4 happened; this plan does not repeat it. |
| `admin_pages.required_role` CHECK admits only `('dev','owner','super_admin','admin','staff')` | live D1, `PERMISSIONS-SYSTEM.md` §4.1 | Seed rows use stored values. `manager` and `viewer` cannot be persisted. |
| Only depth-2 paths render as sidebar items | `computeNavItems`, `PERMISSIONS-SYSTEM.md` §5 | `/dashboard/cron` renders; the `#` rows do not, by design. |
| Both the pipeline mapping **and** the handler guard must pass | `PERMISSIONS-SYSTEM.md` §9 | `/api/cron` maps to `/dashboard/cron` (coarse); handlers add the fragment (fine). |

### The permission matrix this plan produces

| Path | Stored role | Level | vendor_support (0) | owner (1) | admin (2) | manager (3) | staff (4) |
|---|---|---:|---|---|---|---|---|
| `/dashboard/cron` | `super_admin` | 2 | bypass | bypass | allow | deny | deny |
| `/dashboard/cron#pause` | `owner` | 1 | bypass | bypass | deny | deny | deny |
| `/dashboard/cron#trigger` | `dev` | 0 | bypass | bypass | deny | deny | deny |
| `/dashboard/cron#configure` | `dev` | 0 | bypass | bypass | deny | deny | deny |

"bypass" is not a weakness to fix — it is ADR-0002 answer 2, chosen because a self-inflicted lockout of the customer's top tier is the worse failure. Any tier below owner can still be *granted* a row through `admin_page_overrides`, which is what makes this multi-level rather than a fixed ladder.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/jobs/tiers.ts` | `JobId`, `JobTier`, `JOB_TIERS`. Separate from `registry.ts` to avoid an import cycle (`registry` → `tiers` only). |
| `src/lib/jobs/control.ts` | `CronControl` type, `parseControl`, `decideJobRun`. Pure; no I/O, no D1 import. |
| `src/lib/dal/CronControlRepository.ts` | The only place that reads/writes the `cron-control` row. Compare-and-swap on `rev`. SEC-03 compliance. |
| `src/workers/scheduled-usage-probe.ts` | The hourly account-wide D1 usage probe. |
| `src/pages/api/cron/index.ts` | `GET` — control state + per-job health. |
| `src/pages/api/cron/state.ts` | `POST` — pause/resume/interval. Gated on `#pause`. |
| `src/pages/api/cron/config.ts` | `POST` — thresholds, halt. Gated on `#configure`. |
| `src/pages/api/cron/jobs/[id]/run.ts` | `POST` — manual trigger. Gated on `#trigger`. |
| `src/pages/dashboard/cron/index.astro` | SSR entry, `requireAuth`, passes initial state to the island. |
| `src/components/admin/cron/CronDashboard.tsx` | Orchestrator island. |
| `src/components/admin/cron/JobRow.tsx` | One job: state, tier, health, actions. |
| `src/components/admin/cron/RunResultDialog.tsx` | Manual-trigger result, `showModal()` per RULESAd §7.8. |
| `src/styles/cron.css` | Component CSS — keeps ratchet A6/A7 falling, not rising. |
| `migrations/0054_cron_control_plane_pages.sql` | Four `admin_pages` rows. |
| `documentation/features/CRON-CONTROL.md` | Owner document. |

**Modified**

| File | Change |
|---|---|
| `src/lib/jobs/registry.ts` | Export `ALL_JOBS`; add `cron-usage-probe`; gate the three no-op jobs. |
| `src/lib/jobs/budgets.ts` | Retype to `Record<JobId, JobBudget>`; add the probe's budget. |
| `src/lib/jobs/runJob.ts` | Call `decideJobRun` before `shouldRun`; add `disabled`/`shed` outcomes. |
| `src/lib/jobs/telemetry.ts` | Non-working outcomes write Analytics Engine but not an Observability line. |
| `src/lib/auth/routes.ts` | `'/api/cron': '/dashboard/cron'`. |
| `documentation/operations/OPERATIONS.md` | Link the new owner doc from § Scheduled triggers. |
| `documentation/program/ROADMAP.md` | Add the chunk rows. |

---

## Stage A — control core (no behaviour change)

### Task 1: Job identity and tiers

**Files:**
- Create: `src/lib/jobs/tiers.ts`
- Modify: `src/lib/jobs/registry.ts`, `src/lib/jobs/budgets.ts`
- Test: `test/cron-contract.test.ts`

**Interfaces:**
- Consumes: `FIVE_MIN_JOBS`, `SUNDAY_JOBS` from `src/lib/jobs/registry.ts`
- Produces: `type JobId`, `type JobTier = 'essential' | 'deferrable' | 'idle'`, `JOB_TIERS: Record<JobId, JobTier>`, `ALL_JOBS: JobDefinition[]`

- [ ] **Step 1: Export the combined job list from the registry**

In `src/lib/jobs/registry.ts`, after `SUNDAY_JOBS`:

```ts
/** Every registered job. `JobId` derives from this, so the type cannot drift from the registry. */
export const ALL_JOBS = [...FIVE_MIN_JOBS, ...SUNDAY_JOBS] as const;
```

- [ ] **Step 2: Write the failing contract test**

Create `test/cron-contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ALL_JOBS } from '../src/lib/jobs/registry';
import { JOB_TIERS } from '../src/lib/jobs/tiers';
import { JOB_BUDGETS } from '../src/lib/jobs/budgets';

describe('cron registry contract', () => {
  it('gives every job a tier', () => {
    for (const job of ALL_JOBS) {
      expect(JOB_TIERS[job.id as keyof typeof JOB_TIERS], `${job.id} has no tier`).toBeDefined();
    }
  });

  it('gives every job a budget', () => {
    for (const job of ALL_JOBS) {
      expect(JOB_BUDGETS[job.id as keyof typeof JOB_BUDGETS], `${job.id} has no budget`).toBeDefined();
    }
  });

  it('declares no tier for a job that does not exist', () => {
    const ids = new Set(ALL_JOBS.map((j) => j.id));
    for (const id of Object.keys(JOB_TIERS)) {
      expect(ids.has(id), `JOB_TIERS names ${id}, which is not a registered job`).toBe(true);
    }
  });

  it('protects the security and booking jobs from automatic shedding', () => {
    // Pinned deliberately: if someone re-tiers one of these, that must be a
    // visible decision, not a silent edit. cf-access-* are security controls;
    // booking-* are the customer money path.
    expect(JOB_TIERS['cf-access-audit-poll']).toBe('essential');
    expect(JOB_TIERS['cf-access-reconcile']).toBe('essential');
    expect(JOB_TIERS['booking-email-retry']).toBe('essential');
    expect(JOB_TIERS['booking-outbox-poke']).toBe('essential');
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run test/cron-contract.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/jobs/tiers'`

- [ ] **Step 4: Create the tiers module**

Create `src/lib/jobs/tiers.ts`:

```ts
// src/lib/jobs/tiers.ts
/**
 * Criticality tiers, in CODE rather than in the control row.
 *
 * If tiers were data, a corrupt or hand-edited `cron-control` row could mark
 * `cf-access-reconcile` — the access-whitelist sync — as sheddable. A security
 * control standing down silently is the one failure this system must never
 * cause, so the safe default lives where it cannot be edited at runtime.
 *
 * `Record<JobId, JobTier>` is the enforcement: a job added to the registry
 * without a tier here fails `npm run typecheck`.
 */
import { ALL_JOBS } from './registry';

export type JobId = (typeof ALL_JOBS)[number]['id'];

/** `essential` never auto-sheds. `deferrable` and `idle` shed at the same threshold. */
export type JobTier = 'essential' | 'deferrable' | 'idle';

export const JOB_TIERS: Record<JobId, JobTier> = {
  // Security: failed-login detection and the Access whitelist sync.
  'cf-access-audit-poll': 'essential',
  'cf-access-reconcile': 'essential',
  // Customer money path: booking confirmation emails and the replay to cf-astro.
  'booking-email-retry': 'essential',
  'booking-outbox-poke': 'essential',
  // The shed decision itself. If shedding could stop the probe, `usage` would go
  // stale, staleness would lift the shed, the probe would run, and shedding
  // would re-engage — an oscillation. Essential removes the loop.
  'cron-usage-probe': 'essential',
  // Cooldowns absorb delay: quota warnings are 7-day, share expiry 24-hour.
  'storage-notifications': 'deferrable',
  'blog-scheduled-publish': 'deferrable',
  'asset-cleanup': 'deferrable',
  'staff-storage-reconcile': 'deferrable',
  // Switched off at source since 2026-08-22 / 2026-08-26.
  'gsc-sync': 'idle',
  'pagespeed-sync': 'idle',
};
```

> Note: `cron-usage-probe` is listed here but is not added to the registry until Task 5. Until then `Record<JobId, …>` will reject it. Implement Task 5's registry entry first if you are running tasks out of order, or temporarily omit the line and restore it in Task 5.

- [ ] **Step 5: Retype the budgets**

In `src/lib/jobs/budgets.ts`, change the export signature:

```ts
import type { JobId } from './tiers';

export const JOB_BUDGETS: Record<JobId, JobBudget> = {
```

Add a sentence to the file header explaining why:

```
 * Keyed on `JobId`, not `string`. With a string key a missing or mistyped id
 * yields `undefined`, and `runJob` computes `overBudget: budget ? … : false` —
 * so the job is silently never monitored. That is the blind spot that produced
 * CF-ADMIN-1S and CF-ADMIN-1Q.
```

- [ ] **Step 6: Run the test and the type checker**

Run: `npx vitest run test/cron-contract.test.ts && npm run typecheck`
Expected: tests PASS, typecheck 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/jobs/tiers.ts src/lib/jobs/registry.ts src/lib/jobs/budgets.ts test/cron-contract.test.ts
git commit -m "feat(jobs): derive JobId from the registry and require a tier per job"
```

---

### Task 2: The control document and the decision function

**Files:**
- Create: `src/lib/jobs/control.ts`
- Test: `test/cron-control-decide.test.ts`

**Interfaces:**
- Consumes: `JobId`, `JobTier` from `src/lib/jobs/tiers.ts`
- Produces: `CRON_CONTROL_KEY`, `type CronControl`, `type JobDecision`, `parseControl(raw: string | undefined): CronControl | null`, `decideJobRun(input): JobDecision`

- [ ] **Step 1: Write the failing tests**

Create `test/cron-control-decide.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseControl, decideJobRun, type CronControl } from '../src/lib/jobs/control';

const NOW = 1_800_000_000_000;
const base: CronControl = { v: 1, rev: 1, mode: 'normal', jobs: {}, usage: null, thresholds: { shedAtReadPct: 70, shedAtWritePct: 70 } };

describe('decideJobRun — fail open', () => {
  it('runs when there is no control document at all', () => {
    expect(decideJobRun({ jobId: 'gsc-sync', tier: 'idle', control: null, now: NOW })).toEqual({ run: true });
  });

  it('runs when the document is a version this build does not understand', () => {
    const future = parseControl(JSON.stringify({ ...base, v: 99 }));
    expect(future).toBeNull();
    expect(decideJobRun({ jobId: 'gsc-sync', tier: 'idle', control: future, now: NOW })).toEqual({ run: true });
  });

  it('runs when the document is not valid JSON', () => {
    expect(parseControl('{not json')).toBeNull();
  });
});

describe('decideJobRun — manual state', () => {
  it('skips a job switched off', () => {
    const c = { ...base, jobs: { 'gsc-sync': { state: 'off' as const } } };
    expect(decideJobRun({ jobId: 'gsc-sync', tier: 'idle', control: c, now: NOW })).toEqual({ run: false, reason: 'paused' });
  });

  it('auto-resumes once the pause has expired', () => {
    const c = { ...base, jobs: { 'gsc-sync': { state: 'off' as const, until: NOW - 1 } } };
    expect(decideJobRun({ jobId: 'gsc-sync', tier: 'idle', control: c, now: NOW })).toEqual({ run: true });
  });

  it('halt stops everything, including essential jobs', () => {
    const c = { ...base, mode: 'halt' as const };
    expect(decideJobRun({ jobId: 'cf-access-reconcile', tier: 'essential', control: c, now: NOW })).toEqual({ run: false, reason: 'halted' });
  });
});

describe('decideJobRun — shedding', () => {
  const pressured = { ...base, usage: { checkedAt: NOW, rowsReadPct: 85, rowsWrittenPct: 1 } };

  it('sheds a deferrable job over the threshold', () => {
    expect(decideJobRun({ jobId: 'blog-scheduled-publish', tier: 'deferrable', control: pressured, now: NOW }))
      .toEqual({ run: false, reason: 'shed' });
  });

  it('never sheds an essential job', () => {
    expect(decideJobRun({ jobId: 'cf-access-reconcile', tier: 'essential', control: pressured, now: NOW })).toEqual({ run: true });
  });

  it('does not shed on a stale reading — unknown pressure is not pressure', () => {
    const stale = { ...base, usage: { checkedAt: NOW - 4 * 3600_000, rowsReadPct: 85, rowsWrittenPct: 1 } };
    expect(decideJobRun({ jobId: 'blog-scheduled-publish', tier: 'deferrable', control: stale, now: NOW })).toEqual({ run: true });
  });
});

describe('decideJobRun — interval', () => {
  it('skips inside the interval and runs once it has elapsed', () => {
    const inside = { ...base, jobs: { 'gsc-sync': { state: 'on' as const, intervalMinutes: 60, lastRunAt: NOW - 10 * 60_000 } } };
    expect(decideJobRun({ jobId: 'gsc-sync', tier: 'idle', control: inside, now: NOW })).toEqual({ run: false, reason: 'interval' });

    const elapsed = { ...base, jobs: { 'gsc-sync': { state: 'on' as const, intervalMinutes: 60, lastRunAt: NOW - 61 * 60_000 } } };
    expect(decideJobRun({ jobId: 'gsc-sync', tier: 'idle', control: elapsed, now: NOW })).toEqual({ run: true });
  });

  it('treats an interval of 0 as every tick — the rollback lever', () => {
    const c = { ...base, jobs: { 'gsc-sync': { state: 'on' as const, intervalMinutes: 0, lastRunAt: NOW - 1000 } } };
    expect(decideJobRun({ jobId: 'gsc-sync', tier: 'idle', control: c, now: NOW })).toEqual({ run: true });
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/cron-control-decide.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/jobs/control'`

- [ ] **Step 3: Implement the module**

Create `src/lib/jobs/control.ts`:

```ts
// src/lib/jobs/control.ts
/**
 * The cron control document and the one function that decides whether a job
 * runs this tick.
 *
 * Pure by design — no D1 import, no clock read except the `now` passed in — so
 * every branch is unit-testable without a binding. The repository
 * (src/lib/dal/CronControlRepository.ts) is the only thing that touches D1.
 *
 * EVERY failure path returns `{ run: true }`. A missing row, malformed JSON, an
 * unknown schema version or a stale usage reading must never stop a job: the
 * jobs being gated include the Cloudflare Access whitelist sync and the booking
 * email retrier. This mirrors runJob.ts's existing doctrine that every step
 * fails OPEN.
 */
import type { JobId, JobTier } from './tiers';

export const CRON_CONTROL_KEY = 'cron-control';

/** The schema version this build understands. A document with any other `v` is ignored. */
export const CRON_CONTROL_VERSION = 1;

/** A usage reading older than this is treated as unknown, and unknown is not pressure. */
export const USAGE_STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export interface JobControl {
  state: 'on' | 'off';
  /** Epoch ms after which an `off` state lapses back to `on`. */
  until?: number | null;
  /** Free text recorded by whoever changed it; shown in the UI and the audit row. */
  reason?: string;
  /** Minimum minutes between runs. 0 means every tick. */
  intervalMinutes?: number;
  /** Epoch ms of the last run, stamped by the tick that ran it. */
  lastRunAt?: number;
}

export interface CronUsage {
  checkedAt: number;
  rowsReadPct: number;
  rowsWrittenPct: number;
}

export interface CronControl {
  v: number;
  rev: number;
  mode: 'normal' | 'halt';
  jobs: Partial<Record<JobId, JobControl>>;
  usage: CronUsage | null;
  thresholds: { shedAtReadPct: number; shedAtWritePct: number };
}

export type JobDecision = { run: true } | { run: false; reason: 'halted' | 'paused' | 'shed' | 'interval' };

/** The document a fresh install starts from. Every job on, nothing shed. */
export function defaultControl(): CronControl {
  return {
    v: CRON_CONTROL_VERSION,
    rev: 0,
    mode: 'normal',
    jobs: {},
    usage: null,
    thresholds: { shedAtReadPct: 70, shedAtWritePct: 70 },
  };
}

/** Returns null for anything this build cannot safely act on. Null means fail open. */
export function parseControl(raw: string | undefined | null): CronControl | null {
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as Partial<CronControl>;
    if (!doc || typeof doc !== 'object') return null;
    if (doc.v !== CRON_CONTROL_VERSION) return null;
    if (doc.mode !== 'normal' && doc.mode !== 'halt') return null;
    return {
      v: CRON_CONTROL_VERSION,
      rev: typeof doc.rev === 'number' ? doc.rev : 0,
      mode: doc.mode,
      jobs: doc.jobs && typeof doc.jobs === 'object' ? doc.jobs : {},
      usage: doc.usage && typeof doc.usage.checkedAt === 'number' ? doc.usage : null,
      thresholds: {
        shedAtReadPct: doc.thresholds?.shedAtReadPct ?? 70,
        shedAtWritePct: doc.thresholds?.shedAtWritePct ?? 70,
      },
    };
  } catch {
    // silent-ok: a malformed control row must not stop the cron. Returning null
    // makes every caller fail open, which is the documented contract above.
    return null;
  }
}

function underPressure(control: CronControl, now: number): boolean {
  const u = control.usage;
  if (!u) return false;
  if (now - u.checkedAt > USAGE_STALE_AFTER_MS) return false;
  return u.rowsReadPct >= control.thresholds.shedAtReadPct || u.rowsWrittenPct >= control.thresholds.shedAtWritePct;
}

export function decideJobRun(input: {
  jobId: JobId;
  tier: JobTier;
  control: CronControl | null;
  now: number;
}): JobDecision {
  const { jobId, tier, control, now } = input;
  if (!control) return { run: true };

  if (control.mode === 'halt') return { run: false, reason: 'halted' };

  const job = control.jobs[jobId];

  if (job?.state === 'off') {
    const lapsed = typeof job.until === 'number' && now > job.until;
    if (!lapsed) return { run: false, reason: 'paused' };
  }

  if (tier !== 'essential' && underPressure(control, now)) return { run: false, reason: 'shed' };

  const interval = job?.intervalMinutes ?? 0;
  if (interval > 0 && typeof job?.lastRunAt === 'number' && now - job.lastRunAt < interval * 60_000) {
    return { run: false, reason: 'interval' };
  }

  return { run: true };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/cron-control-decide.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jobs/control.ts test/cron-control-decide.test.ts
git commit -m "feat(jobs): cron control document and fail-open decision function"
```

---

### Task 3: The control repository

**Files:**
- Create: `src/lib/dal/CronControlRepository.ts`
- Test: `test/cron-control-repository.test.ts`

**Interfaces:**
- Consumes: `CRON_CONTROL_KEY`, `CronControl`, `parseControl`, `defaultControl` from `src/lib/jobs/control.ts`
- Produces: `readControl(db): Promise<CronControl | null>`, `writeControl(db, next: CronControl, expectedRev: number, actor: string): Promise<'ok' | 'conflict'>`

- [ ] **Step 1: Write the failing tests**

Create `test/cron-control-repository.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from './fixtures/env';
import { readControl, writeControl } from '../src/lib/dal/CronControlRepository';
import { defaultControl, CRON_CONTROL_KEY } from '../src/lib/jobs/control';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM admin_portal_settings WHERE setting_key = ?').bind(CRON_CONTROL_KEY).run();
});

describe('CronControlRepository', () => {
  it('returns null when no row exists, so callers fail open', async () => {
    expect(await readControl(env.DB)).toBeNull();
  });

  it('writes then reads back the document', async () => {
    const doc = { ...defaultControl(), rev: 1, jobs: { 'gsc-sync': { state: 'off' as const } } };
    expect(await writeControl(env.DB, doc, 0, 'tester@test.local')).toBe('ok');

    const read = await readControl(env.DB);
    expect(read?.rev).toBe(1);
    expect(read?.jobs['gsc-sync']?.state).toBe('off');
  });

  it('refuses a write whose expected revision is stale', async () => {
    await writeControl(env.DB, { ...defaultControl(), rev: 1 }, 0, 'first@test.local');

    // Second writer still believes rev 0 — the row moved under it.
    const result = await writeControl(env.DB, { ...defaultControl(), rev: 1, mode: 'halt' }, 0, 'second@test.local');
    expect(result).toBe('conflict');

    const read = await readControl(env.DB);
    expect(read?.mode).toBe('normal');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/cron-control-repository.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repository**

Create `src/lib/dal/CronControlRepository.ts`:

```ts
// src/lib/dal/CronControlRepository.ts
/**
 * The only place that reads or writes the `cron-control` row.
 *
 * SEC-03: API handlers must never touch D1 directly, so every route and the
 * cron tick go through here.
 *
 * Writes are compare-and-swap on `rev`. One row means "pause everything" is a
 * single atomic write — during an incident a half-applied pause is the worst
 * possible outcome — but it also means two admins editing at once would
 * otherwise silently clobber each other. Zero rows changed means someone got
 * there first; the caller re-reads and decides.
 */
import { CRON_CONTROL_KEY, parseControl, type CronControl } from '../jobs/control';

export async function readControl(db: D1Database): Promise<CronControl | null> {
  try {
    const row = await db
      .prepare(
        `SELECT setting_value FROM admin_portal_settings
          WHERE setting_key = ?1 AND scope_type = 'global' AND scope_id = ''`,
      )
      .bind(CRON_CONTROL_KEY)
      .first<{ setting_value: string }>();
    return parseControl(row?.setting_value);
  } catch {
    // silent-ok: an unreadable control row must fail open (control.ts contract).
    // The tick's own telemetry records that the job ran; nothing is hidden.
    return null;
  }
}

export async function writeControl(
  db: D1Database,
  next: CronControl,
  expectedRev: number,
  actor: string,
): Promise<'ok' | 'conflict'> {
  const value = JSON.stringify(next);

  // INSERT covers the first write, when no row exists to compare against.
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO admin_portal_settings
         (setting_key, scope_type, scope_id, setting_value, setting_type, category, updated_by)
       VALUES (?1, 'global', '', ?2, 'json', 'system', ?3)`,
    )
    .bind(CRON_CONTROL_KEY, value, actor)
    .run();
  if ((inserted.meta?.changes ?? 0) > 0) return 'ok';

  const updated = await db
    .prepare(
      `UPDATE admin_portal_settings
          SET setting_value = ?2, updated_by = ?3, updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = ?1 AND scope_type = 'global' AND scope_id = ''
          AND CAST(json_extract(setting_value, '$.rev') AS INTEGER) = ?4`,
    )
    .bind(CRON_CONTROL_KEY, value, actor, expectedRev)
    .run();

  return (updated.meta?.changes ?? 0) > 0 ? 'ok' : 'conflict';
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/cron-control-repository.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full gate and commit**

Run: `npm run verify`
Expected: green. If the ratchet reports A15 rising, run `python scripts/ratchet.py --update --reason "cron control core: tiers, control document, repository"` and include `.ratchet.json`.

```bash
git add src/lib/dal/CronControlRepository.ts test/cron-control-repository.test.ts .ratchet.json
git commit -m "feat(jobs): cron control repository with compare-and-swap writes"
```

**Stage A is now complete and shippable.** No control row exists yet, so `readControl` returns null, `decideJobRun` returns `{ run: true }`, and production behaviour is identical. Push to `main` and confirm the Workers Builds run is green before starting Stage B.

---

## Stage B — wire the gate

### Task 4: Gate the tick, and stop logging non-work

**Files:**
- Modify: `src/lib/jobs/runJob.ts`, `src/lib/jobs/telemetry.ts`
- Test: `test/cron-control-gate.test.ts`

**Interfaces:**
- Consumes: `decideJobRun`, `readControl`, `JOB_TIERS`
- Produces: `JobOutcome['outcome']` extended with `'disabled' | 'shed'`

- [ ] **Step 1: Write the failing tests**

Create `test/cron-control-gate.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from './fixtures/env';
import { runJob } from '../src/lib/jobs/runJob';
import { FIVE_MIN_JOBS } from '../src/lib/jobs/registry';
import { writeControl } from '../src/lib/dal/CronControlRepository';
import { defaultControl, CRON_CONTROL_KEY } from '../src/lib/jobs/control';

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
const cfEnv = env as unknown as CfEnv;
const job = (id: string) => {
  const def = FIVE_MIN_JOBS.find((j) => j.id === id);
  if (!def) throw new Error(`no job ${id}`);
  return def;
};

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM admin_portal_settings WHERE setting_key = ?').bind(CRON_CONTROL_KEY).run();
});

describe('control gate in runJob', () => {
  it('reports `disabled` for a paused job and does no work', async () => {
    await writeControl(env.DB, { ...defaultControl(), rev: 1, jobs: { 'blog-scheduled-publish': { state: 'off' } } }, 0, 'tester');

    const out = await runJob(job('blog-scheduled-publish'), cfEnv, ctx, new Map(), '*/5 * * * *');

    expect(out.outcome).toBe('disabled');
    expect(out.meter.queryCount).toBe(0);
  });

  it('never sheds an essential job, whatever the usage says', async () => {
    await writeControl(env.DB, {
      ...defaultControl(), rev: 1,
      usage: { checkedAt: Date.now(), rowsReadPct: 99, rowsWrittenPct: 99 },
    }, 0, 'tester');

    const out = await runJob(job('booking-outbox-poke'), cfEnv, ctx, new Map(), '*/5 * * * *');
    expect(out.outcome).not.toBe('shed');
  });

  it('runs everything when the control row is absent', async () => {
    const out = await runJob(job('blog-scheduled-publish'), cfEnv, ctx, new Map(), '*/5 * * * *');
    expect(out.outcome).toBe('ran');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/cron-control-gate.test.ts`
Expected: FAIL — outcome is `'ran'`, not `'disabled'`.

- [ ] **Step 3: Extend the outcome type**

In `src/lib/jobs/runJob.ts`:

```ts
  outcome: 'ran' | 'skipped' | 'lease-held' | 'failed' | 'disabled' | 'shed';
```

- [ ] **Step 4: Read the control document once per tick**

In `runCronBatch`, after the settings read, add:

```ts
  const control = env.DB ? await readControl(env.DB) : null;
```

and pass it into each `runJob` call. Change `runJob`'s signature to take `control: CronControl | null` as its last parameter.

> The control row is read here, not per job, so a tick costs one read regardless of how many jobs are registered.

- [ ] **Step 5: Apply the decision before the existing gate**

In `runJob`, immediately before the `def.shouldRun` block:

```ts
  // Control plane decides before the job's own gate. Fails open: decideJobRun
  // returns { run: true } for a null or unparseable document.
  const decision = decideJobRun({
    jobId: def.id as JobId,
    tier: JOB_TIERS[def.id as JobId],
    control,
    now: started,
  });
  if (!decision.run) {
    return finish(decision.reason === 'shed' ? 'shed' : 'disabled');
  }
```

- [ ] **Step 6: Stop emitting a log line for non-work**

In `src/lib/jobs/telemetry.ts`, wrap the `logToObservability` call:

```ts
  // Analytics Engine takes every run — it is free and not a log event. The
  // Observability line is reserved for runs that did work or failed, because a
  // structured line per job per tick was 2,301 events a day to say "nothing
  // happened". Workers Free allows 200,000 log events a day, and from
  // 2026-10-01 trace spans count against the same quota.
  const didWork = outcome.outcome === 'ran' || outcome.outcome === 'failed';
  if (didWork || outcome.overBudget) {
    logToObservability('info', `jobs.${id}`, `job ${outcome.outcome}`, { /* unchanged */ });
  }
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/cron-control-gate.test.ts test/jobs-budget.test.ts test/jobs-gates.test.ts`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/jobs/runJob.ts src/lib/jobs/telemetry.ts test/cron-control-gate.test.ts
git commit -m "feat(jobs): control-plane gate in runJob, and no log line for non-work"
```

---

### Task 5: The usage probe

**Files:**
- Create: `src/workers/scheduled-usage-probe.ts`
- Modify: `src/lib/jobs/registry.ts`, `src/lib/jobs/budgets.ts`
- Test: `test/cron-usage-probe.test.ts`

**Interfaces:**
- Consumes: `readControl`, `writeControl`, `CronControl`
- Produces: `probeD1Usage(env, db, now): Promise<void>`, `USAGE_PROBE_INTERVAL_MIN`

- [ ] **Step 1: Write the failing tests**

Create `test/cron-usage-probe.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { env } from './fixtures/env';
import { withFetch, jsonResponse } from './fixtures/outbound';
import { probeD1Usage, USAGE_PROBE_INTERVAL_MIN } from '../src/workers/scheduled-usage-probe';
import { readControl, writeControl } from '../src/lib/dal/CronControlRepository';
import { defaultControl, CRON_CONTROL_KEY } from '../src/lib/jobs/control';

let restore: (() => void) | null = null;
const cfEnv = { ...(env as unknown as CfEnv), CLOUDFLARE_API_TOKEN: 'tok', CF_ACCOUNT_ID: 'acct' } as CfEnv;

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM admin_portal_settings WHERE setting_key = ?').bind(CRON_CONTROL_KEY).run();
});
afterEach(() => { restore?.(); restore = null; });

describe('cron-usage-probe', () => {
  it('runs hourly, not every tick, so a fail-open document cannot cost 288 API calls a day', () => {
    expect(USAGE_PROBE_INTERVAL_MIN).toBe(60);
  });

  it('records the account-wide percentages into the control row', async () => {
    await writeControl(env.DB, { ...defaultControl(), rev: 1 }, 0, 'tester');
    const stub = withFetch(() => jsonResponse({
      data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [
        { sum: { rowsRead: 2_500_000, rowsWritten: 50_000 }, dimensions: { date: '2026-09-16' } },
      ] }] } },
    }));
    restore = stub.restore;

    await probeD1Usage(cfEnv, env.DB, Date.now());

    const control = await readControl(env.DB);
    expect(control?.usage?.rowsReadPct).toBeCloseTo(50, 1);
    expect(control?.usage?.rowsWrittenPct).toBeCloseTo(50, 1);
  });

  it('leaves the previous reading alone when the API fails', async () => {
    await writeControl(env.DB, {
      ...defaultControl(), rev: 1,
      usage: { checkedAt: 111, rowsReadPct: 12, rowsWrittenPct: 3 },
    }, 0, 'tester');
    const stub = withFetch(() => new Response('nope', { status: 500 }));
    restore = stub.restore;

    await probeD1Usage(cfEnv, env.DB, Date.now());

    const control = await readControl(env.DB);
    expect(control?.usage?.rowsReadPct).toBe(12);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/cron-usage-probe.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the probe**

Create `src/workers/scheduled-usage-probe.ts`:

```ts
// src/workers/scheduled-usage-probe.ts
/**
 * Caches account-wide D1 usage into the cron control row, once an hour.
 *
 * Account-wide on purpose: the D1 daily limit is enforced per account and shared
 * with cf-astro, so metering only cf-admin's own queries would miss the actual
 * threat. Self-metering would also cost a D1 write every tick, and writes are
 * the scarcer resource (peak 15% of the daily allowance vs 3.6% for reads).
 *
 * The interval is declared here, in code, as well as in the control row: a
 * missing control row runs every job every tick, and for this job that would be
 * 288 Cloudflare API calls a day instead of 24.
 */
import { reportNonFatal } from '../lib/observability';
import { readControl, writeControl } from '../lib/dal/CronControlRepository';
import { defaultControl } from '../lib/jobs/control';

export const USAGE_PROBE_INTERVAL_MIN = 60;

/** Workers Free daily D1 allowances. */
const DAILY_ROWS_READ = 5_000_000;
const DAILY_ROWS_WRITTEN = 100_000;

export async function probeD1Usage(env: CfEnv, db: D1Database, now: number): Promise<void> {
  const token = env.CLOUDFLARE_API_TOKEN;
  const account = env.CF_ACCOUNT_ID;
  if (!token || !account) return;

  const today = new Date(now).toISOString().slice(0, 10);
  const query = `query { viewer { accounts(filter: { accountTag: "${account}" }) {
    d1AnalyticsAdaptiveGroups(limit: 50, filter: { date: "${today}" }) {
      sum { rowsRead rowsWritten } dimensions { date }
    } } } }`;

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      reportNonFatal('jobs.usage-probe', new Error(`GraphQL ${res.status}`), { job: 'cron-usage-probe' });
      return;
    }
    const body = (await res.json()) as {
      data?: { viewer?: { accounts?: { d1AnalyticsAdaptiveGroups?: { sum: { rowsRead: number; rowsWritten: number } }[] }[] } };
    };
    const groups = body.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups ?? [];
    if (groups.length === 0) return;

    const rowsRead = groups.reduce((n, g) => n + (g.sum?.rowsRead ?? 0), 0);
    const rowsWritten = groups.reduce((n, g) => n + (g.sum?.rowsWritten ?? 0), 0);

    const current = (await readControl(db)) ?? defaultControl();
    const next = {
      ...current,
      rev: current.rev + 1,
      usage: {
        checkedAt: now,
        rowsReadPct: (rowsRead / DAILY_ROWS_READ) * 100,
        rowsWrittenPct: (rowsWritten / DAILY_ROWS_WRITTEN) * 100,
      },
    };
    await writeControl(db, next, current.rev, 'cron-usage-probe');
  } catch (err) {
    reportNonFatal('jobs.usage-probe', err, { job: 'cron-usage-probe' });
  }
}
```

- [ ] **Step 4: Register it**

In `src/lib/jobs/registry.ts`, append to `FIVE_MIN_JOBS`:

```ts
  {
    id: 'cron-usage-probe',
    // Its 60-minute interval is enforced by the control document AND by the
    // code default, so a fail-open tick cannot turn this into 288 API calls/day.
    handler: async ({ env, db }) => { await probeD1Usage(env, db, Date.now()); },
  },
```

In `src/lib/jobs/budgets.ts`:

```ts
  'cron-usage-probe': {
    idleRowsRead: 10,
    idleRowsWritten: 10,
    reason:
      'Reads the control row (1) and writes it back (1). Formula floor of 10 on both. ' +
      'Re-measure after the first production run and reapply the formula.',
  },
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/cron-usage-probe.test.ts test/cron-contract.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/workers/scheduled-usage-probe.ts src/lib/jobs/registry.ts src/lib/jobs/budgets.ts test/cron-usage-probe.test.ts
git commit -m "feat(jobs): hourly account-wide D1 usage probe for the shed decision"
```

---

### Task 6: Seed the control row and stop the no-op jobs

**Files:**
- Create: `scripts/seed_cron_control.mjs`
- Test: `test/cron-control-seed.test.ts`

**Interfaces:**
- Consumes: `defaultControl`, `writeControl`
- Produces: the live `cron-control` row

- [ ] **Step 1: Write the failing test**

Create `test/cron-control-seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSeedControl } from '../scripts/lib/cron-seed.mjs';

describe('cron control seed', () => {
  it('switches off the three jobs measured doing nothing, and nothing else', () => {
    const seed = buildSeedControl();
    expect(seed.jobs['gsc-sync'].state).toBe('off');
    expect(seed.jobs['pagespeed-sync'].state).toBe('off');
    expect(seed.jobs['blog-scheduled-publish'].state).toBe('off');
    expect(seed.jobs['cf-access-reconcile']).toBeUndefined();
    expect(seed.jobs['booking-email-retry']).toBeUndefined();
  });

  it('gives the usage probe its hourly interval', () => {
    expect(buildSeedControl().jobs['cron-usage-probe'].intervalMinutes).toBe(60);
  });

  it('leaves every pause open-ended but reasoned', () => {
    const seed = buildSeedControl();
    expect(seed.jobs['gsc-sync'].reason).toMatch(/2026-08-26/);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/cron-control-seed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the seed builder**

Create `scripts/lib/cron-seed.mjs`:

```js
/**
 * The control document a first deploy writes.
 *
 * The three jobs switched off here were measured on 2026-09-16 running 287-288
 * times a day and reading and writing zero rows. gsc-sync and pagespeed-sync
 * are already disabled by their own settings; blog-scheduled-publish has no
 * scheduled posts. Switching them off at the control plane stops the dispatch
 * itself rather than paying for a job that returns immediately.
 */
export function buildSeedControl() {
  return {
    v: 1,
    rev: 1,
    mode: 'normal',
    jobs: {
      'gsc-sync': { state: 'off', until: null, reason: 'gsc-sync-enabled false since 2026-08-26; 288 no-op runs/day' },
      'pagespeed-sync': { state: 'off', until: null, reason: 'pagespeed-check-enabled false since 2026-08-22; 288 no-op runs/day' },
      'blog-scheduled-publish': { state: 'off', until: null, reason: 'no scheduled posts; 287 no-op runs/day. Re-enable when the blog schedules again.' },
      'cron-usage-probe': { state: 'on', intervalMinutes: 60 },
    },
    usage: null,
    thresholds: { shedAtReadPct: 70, shedAtWritePct: 70 },
  };
}
```

- [ ] **Step 4: Write the apply script**

Create `scripts/seed_cron_control.mjs` — reads `buildSeedControl()`, prints the JSON, and writes it with `wrangler d1 execute madagascar-db --remote --command`. Print the SQL and require `--apply` to run it, so a dry run is the default.

- [ ] **Step 5: Run the tests, then seed**

Run: `npx vitest run test/cron-control-seed.test.ts`
Expected: PASS.

Then dry-run, inspect, and apply:

```bash
node scripts/seed_cron_control.mjs           # prints the SQL, changes nothing
node scripts/seed_cron_control.mjs --apply   # writes the row
```

- [ ] **Step 6: Verify against production**

```bash
npx wrangler d1 execute madagascar-db --remote \
  --command="SELECT setting_value FROM admin_portal_settings WHERE setting_key='cron-control'"
```

Then wait for one `*/5` tick and confirm with the Analytics Engine query in the design doc §1.1 that `gsc-sync`, `pagespeed-sync` and `blog-scheduled-publish` now report `disabled` rather than `ran`.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/cron-seed.mjs scripts/seed_cron_control.mjs test/cron-control-seed.test.ts
git commit -m "feat(jobs): seed the cron control row and stop the three no-op dispatches"
```

**Stage B is now complete.** Expected measured effect: 863 no-op dispatches/day → ~0, cron log events ~3,200/day → ~1,000. Record both in `DEBT-REGISTRY.md` with the command that produced them before starting Stage C.

---

## Stage C — permissions, API and UI

### Task 7: The permission rows and the route mapping

**Files:**
- Create: `migrations/0054_cron_control_plane_pages.sql`
- Modify: `src/lib/auth/routes.ts`, `documentation/reference/schema-change-ledger.md`, `database/migrations.manifest.json`, `database/schema.snapshot.sql`
- Test: `test/cron-permissions.test.ts`

**Interfaces:**
- Produces: four `admin_pages` rows; `API_PAGE_MAPPING['/api/cron']`

- [ ] **Step 1: Write the failing tests**

Create `test/cron-permissions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveApiAuthz, API_PAGE_MAPPING } from '../src/lib/auth/routes';
import { resolveAccess } from '../src/lib/auth/decide-access';

describe('cron API authorization', () => {
  it('maps every /api/cron route to the cron page', () => {
    expect(API_PAGE_MAPPING['/api/cron']).toBe('/dashboard/cron');
    expect(resolveApiAuthz('/api/cron/jobs/gsc-sync/run')).not.toBeNull();
  });
});

describe('cron page-level resolution', () => {
  // The map a level-2 admin gets from the seeded rows: the page allowed by
  // baseline, the three actions denied by baseline.
  const adminMap = {
    '/dashboard/cron': true,
    '/dashboard/cron#pause': false,
    '/dashboard/cron#trigger': false,
    '/dashboard/cron#configure': false,
  };

  it('lets an admin view but not act', () => {
    expect(resolveAccess(adminMap, '/dashboard/cron', 'admin')).toBe('allow');
    expect(resolveAccess(adminMap, '/dashboard/cron#pause', 'admin')).toBe('deny');
    expect(resolveAccess(adminMap, '/dashboard/cron#trigger', 'admin')).toBe('deny');
  });

  it('honours an explicit grant on one action without opening the others', () => {
    const granted = { ...adminMap, '/dashboard/cron#pause': true };
    expect(resolveAccess(granted, '/dashboard/cron#pause', 'admin')).toBe('allow');
    expect(resolveAccess(granted, '/dashboard/cron#trigger', 'admin')).toBe('deny');
  });

  it('does NOT inherit a page deny to the hash actions — the reason handlers check both keys', () => {
    // resolveAccess ancestor matching is `startsWith(key + '/')`, so '#pause'
    // is not a descendant of the page. This test pins the surprise so nobody
    // "simplifies" the handlers to a single check.
    const deniedPage = { '/dashboard/cron': false };
    expect(resolveAccess(deniedPage, '/dashboard/cron', 'admin')).toBe('deny');
    expect(resolveAccess(deniedPage, '/dashboard/cron#pause', 'admin')).toBe('unknown');
  });

  it('lets owner and vendor_support through everything, by design (ADR-0002)', () => {
    const allDenied = { '/dashboard/cron': false, '/dashboard/cron#trigger': false };
    expect(resolveAccess(allDenied, '/dashboard/cron#trigger', 'owner')).toBe('allow');
    expect(resolveAccess(allDenied, '/dashboard/cron#trigger', 'vendor_support')).toBe('allow');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/cron-permissions.test.ts`
Expected: FAIL — `API_PAGE_MAPPING['/api/cron']` is undefined.

- [ ] **Step 3: Add the route mapping**

In `src/lib/auth/routes.ts`, inside `API_PAGE_MAPPING`, beside the other dashboard entries:

```ts
  // Coarse default-deny for the whole surface. The fine-grained sub-actions
  // (#pause, #trigger, #configure) are checked in each handler, because a hash
  // key is not a path descendant and therefore does not inherit this one.
  '/api/cron': '/dashboard/cron',
```

- [ ] **Step 4: Write the migration**

Create `migrations/0054_cron_control_plane_pages.sql`:

```sql
-- Migration: 0054_cron_control_plane_pages.sql
-- Description: Registry rows for the cron control plane — one page and three
--              hash-fragment sub-permissions. Data only; no schema change.
--              Numbering per RULE #0.7b: cf-admin owns 0033+, 0054 is next
--              above 0053.
--
-- Stored role vocabulary, not canonical: admin_pages.required_role still carries
-- a CHECK constraint admitting only ('dev','owner','super_admin','admin','staff')
-- and toStoredRole() throws for 'manager'/'viewer' (RULESAd RULE #3,
-- PERMISSIONS-SYSTEM.md 4.1). 'super_admin' here means canonical admin (level 2);
-- 'dev' means canonical vendor_support (level 0).
--
-- These rows are load-bearing, not cosmetic: isExplicitlyDenied() treats a key
-- the registry does not define as ALLOWED, so placDenyResponse(user,
-- '/dashboard/cron#trigger') is a no-op for every role until this row exists.
--
-- Only depth-2 paths render as sidebar items (computeNavItems), so
-- /dashboard/cron appears in the nav and the three '#' rows deliberately do not.

INSERT OR IGNORE INTO admin_pages
  (path, label, icon, required_role, description, sort_order, is_active, category, parent_path)
VALUES
  ('/dashboard/cron', 'Cron Control', 'clock', 'super_admin',
   'Scheduled job control plane: state, health, history and manual runs.',
   85, 1, 'system', NULL),

  ('/dashboard/cron#pause', 'Pause / Resume Jobs', NULL, 'owner',
   'Switch a scheduled job off or on, set a per-job interval, and set a pause expiry.',
   86, 1, 'system', '/dashboard/cron'),

  ('/dashboard/cron#trigger', 'Manual Job Trigger', NULL, 'dev',
   'Run a scheduled job on demand and read its full telemetry. Bypasses the control state by design.',
   87, 1, 'system', '/dashboard/cron'),

  ('/dashboard/cron#configure', 'Cron Configuration', NULL, 'dev',
   'Shed thresholds and the global halt switch.',
   88, 1, 'system', '/dashboard/cron');
```

- [ ] **Step 5: Apply, freeze, snapshot, ledger**

```bash
npx wrangler d1 migrations apply madagascar-db --local
npx wrangler d1 migrations apply madagascar-db --remote
node scripts/migrations_manifest.mjs
node scripts/d1_schema_snapshot.mjs
```

Then add a row to `documentation/reference/schema-change-ledger.md` naming the file, the date, who applied it, and the four paths.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/cron-permissions.test.ts test/api-authz-inventory.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add migrations/0054_cron_control_plane_pages.sql src/lib/auth/routes.ts test/cron-permissions.test.ts \
        documentation/reference/schema-change-ledger.md database/migrations.manifest.json database/schema.snapshot.sql
git commit -m "feat(cron): PLAC registry rows and API route mapping for the control plane"
```

---

### Task 8: The API routes

**Files:**
- Create: `src/pages/api/cron/index.ts`, `src/pages/api/cron/state.ts`, `src/pages/api/cron/config.ts`, `src/pages/api/cron/jobs/[id]/run.ts`
- Test: `test/cron-api.test.ts`

**Interfaces:**
- Consumes: `readControl`, `writeControl`, `runJob`, `ALL_JOBS`, `JOB_TIERS`, `placDenyResponse`, `requireAuth`, `createAuditLogger`
- Produces: the four endpoints

- [ ] **Step 1: Write the shared guard helper**

Every cron handler checks **two** keys. Create `src/pages/api/cron/_guard.ts`:

```ts
// src/pages/api/cron/_guard.ts
/**
 * Both keys, every time.
 *
 * `resolveAccess` matches ancestors with `startsWith(key + '/')`, so
 * '/dashboard/cron#pause' is NOT a descendant of '/dashboard/cron' and does not
 * inherit its deny. Checking only the fragment would let a user denied the whole
 * page still call the action; checking only the page would ignore the
 * fine-grained grant. Gap D-4 in PERMISSIONS-SYSTEM.md is the same mistake made
 * once already.
 */
import { placDenyResponse } from '@/lib/auth/guard';
import type { AdminUser } from '@/lib/auth/types';

export const CRON_PAGE = '/dashboard/cron';

export function denyCron(
  user: Pick<AdminUser, 'role' | 'accessMap'>,
  action?: 'pause' | 'trigger' | 'configure',
): Response | null {
  const page = placDenyResponse(user, CRON_PAGE);
  if (page) return page;
  if (!action) return null;
  return placDenyResponse(user, `${CRON_PAGE}#${action}`);
}
```

- [ ] **Step 2: Write the failing API tests**

Create `test/cron-api.test.ts` with cases asserting, for a level-2 admin session: `GET /api/cron` → 200; `POST /api/cron/state` → 403; `POST /api/cron/jobs/gsc-sync/run` → 403; and for an owner session all four → 200. Use the existing pipeline fixtures in `test/fixtures/pipeline.ts` for session construction.

- [ ] **Step 3: Run and watch it fail**

Run: `npx vitest run test/cron-api.test.ts`
Expected: FAIL — routes do not exist.

- [ ] **Step 4: Implement `GET /api/cron/index.ts`**

Returns `{ control, jobs: [{ id, tier, state, budget, health }] }`. Health comes from the Analytics Engine SQL API using `CLOUDFLARE_API_TOKEN`; on failure the field is `null` and the UI shows "unavailable" rather than a zero (RULE #0.5 — never render a fabricated number).

- [ ] **Step 5: Implement `POST /api/cron/state.ts`**

Body: `{ jobId, state: 'on'|'off', untilMinutes?: number, intervalMinutes?: number, reason: string, expectedRev: number }`.
Guard: `denyCron(user, 'pause')`. Validate `jobId` against `ALL_JOBS` — never trust the body. Write via `writeControl`; on `'conflict'` return 409 with the current document so the UI can re-render rather than silently overwrite. Audit with `action: 'pause'|'resume'`.

- [ ] **Step 6: Implement `POST /api/cron/config.ts`**

Body: `{ thresholds?: {...}, mode?: 'normal'|'halt', expectedRev: number }`. Guard: `denyCron(user, 'configure')`. Audit with `action: 'configure'`. A `mode: 'halt'` write also emits `reportNonFatal` so a global halt is visible in Sentry and Observability, not only in the audit table.

- [ ] **Step 7: Implement `POST /api/cron/jobs/[id]/run.ts`**

Guard: `denyCron(user, 'trigger')`. Resolve the job from `ALL_JOBS` by id (404 if unknown). Audit **before** running. Call `runJob(def, env, ctx, settings, 'manual', null)` — passing `null` as the control document is what makes a manual run bypass the pause, which is the entire point of being able to test a paused job. The lease is still honoured, so a manual run cannot race a real tick; if the outcome is `lease-held`, return 409.

- [ ] **Step 8: Run the tests and the inventory gate**

Run: `npx vitest run test/cron-api.test.ts test/api-authz-inventory.test.ts && python scripts/rules_check.py`
Expected: PASS, and rules_check reports 0 violations (SEC-03/06/07).

- [ ] **Step 9: Commit**

```bash
git add src/pages/api/cron/ test/cron-api.test.ts
git commit -m "feat(cron): control-plane API with page-and-fragment PLAC checks"
```

---

### Task 9: The dashboard page

**Files:**
- Create: `src/pages/dashboard/cron/index.astro`, `src/components/admin/cron/CronDashboard.tsx`, `src/components/admin/cron/JobRow.tsx`, `src/components/admin/cron/RunResultDialog.tsx`, `src/styles/cron.css`
- Test: manual browser check by the owner

- [ ] **Step 1: Build the SSR entry**

`index.astro` calls `requireAuth(Astro)`, fetches the initial state server-side through the repository, and passes it to `<CronDashboard client:load initial={...} />`. Wrap in `<AdminLayout title="Cron Control">` per RULESAd §7.7.

- [ ] **Step 2: Build `CronDashboard.tsx`**

Renders one `JobRow` per job, grouped by tier, with the global mode and usage reading in a header strip. Capability flags (`canPause`, `canTrigger`, `canConfigure`) are computed **server-side** in the `.astro` file from the user's access map and passed as props — the island never decides its own permissions, it only hides controls the server already said no to. The server check remains authoritative.

- [ ] **Step 3: Build `RunResultDialog.tsx`**

Follow RULESAd §7.8 exactly: `<dialog>` + `showModal()`, inline `style={{ width: '100%', maxWidth: '672px', … }}`, `::backdrop` via a `<style>` tag with a unique id, `cancel` handler, backdrop-click handler, inner `onClick={e => e.stopPropagation()}`.

- [ ] **Step 4: Styles**

All layout in `src/styles/cron.css` using existing design tokens. No inline `style={` except the dialog's mandated ones, and no raw hex — ratchet A6 and A7 may only fall.

- [ ] **Step 5: Verify the gates**

Run: `npm run verify`
Expected: green, including `a11y_check`.

- [ ] **Step 6: Owner browser check**

The agent does not open a browser (program principle 11). Ask the owner to confirm at `https://secure.madagascarhotelags.com/dashboard/cron`: the page appears in the sidebar; pausing a job persists across a reload; a manual trigger shows real telemetry; and a second browser tab editing simultaneously produces the 409 conflict message rather than a silent overwrite.

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard/cron/ src/components/admin/cron/ src/styles/cron.css
git commit -m "feat(cron): control plane dashboard"
```

---

### Task 10: Documentation

**Files:**
- Create: `documentation/features/CRON-CONTROL.md`
- Modify: `documentation/README.md`, `documentation/operations/OPERATIONS.md`, `documentation/program/ROADMAP.md`, `documentation/specs/2026-09-16-cron-control-plane-design.md`

- [ ] **Step 1: Write the owner document**

The planned `CRON-CONTROL.md` owns: the job list with tiers, the permission matrix from this plan, how to pause and what a pause expiry does, what shedding is and when it triggers, and how to read the health view. It is the single home for those facts; `OPERATIONS.md` links to it rather than restating the job list.

- [ ] **Step 2: Correct the design doc**

The spec's §7 table implies `#trigger` excludes the owner. It does not — `requirePageAccess` returns early for `owner`. Correct that row and add the "bypass is ADR-0002, not a gap" note.

- [ ] **Step 3: Index and roadmap**

Add the index row in `documentation/README.md` (CI enforces parity) and flip the roadmap rows to their shipped status with the measured before/after numbers.

- [ ] **Step 4: Run and commit**

Run: `python scripts/docs_check.py && npm run lint:md`

```bash
git add documentation/
git commit -m "docs(cron): owner document, permission matrix and roadmap status"
```

## Self-review notes

- **Spec coverage.** Data model → Task 2/3. Control flow → Task 4. Auto-shed → Task 5. Permissions → Task 7. Manual trigger → Task 8. Health → Task 8. Enforcement → Task 1. Rollout → stage boundaries. Every spec section maps to a task.
- **Correction carried in.** The spec's permission table said `#trigger` was vendor-support-only; `requirePageAccess` returns early for `owner` too. Task 7's tests pin the real behaviour and Task 10 step 2 fixes the spec.
- **The `cron-usage-probe` ordering trap** is called out in Task 1 step 4: it appears in `JOB_TIERS` before Task 5 registers it, so `Record<JobId, …>` will reject it if the tasks are run out of order.
- **Type consistency.** `decideJobRun` takes `{ jobId, tier, control, now }` in Tasks 2 and 4. `writeControl(db, next, expectedRev, actor)` is the same signature in Tasks 3, 5 and 8. `denyCron(user, action?)` is the same in Task 8's four handlers.

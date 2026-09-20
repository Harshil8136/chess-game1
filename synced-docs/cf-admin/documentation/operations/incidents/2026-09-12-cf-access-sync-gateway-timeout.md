---
title: "Incident Post-Mortem — CF Access Sync Gateway Timeout (504)"
status: historical
audience: [ai, technical, operator, owner]
last_verified: 2026-09-19
verified_against: [code, infra, live-mcp]
owner: harshil
related_docs: [../OPERATIONS.md, ../../architecture/ARCHITECTURE.md, ../../security/RoPA.md]
tags: [incident, post-mortem, sentry, cloudflare-workers, supabase, gateway-timeout]
---

# Incident Post-Mortem — CF Access Sync Gateway Timeout (504)

> **TL;DR (non-technical):** On September 12, 2026, the 5-minute background synchronization job between the admin portal user list and Cloudflare Zero Trust logged periodic "Gateway Timeout" errors. No service was blocked, no administrators lost access, and no data was lost because Cloudflare Zero Trust evaluates access policies cached directly at the network edge. The issue was caused by transient timeouts from Supabase's PostgREST endpoint cascading into secondary write attempts and uncooled Sentry alerts. This has been remediated with automated retries, alert cooldowns, and failure short-circuiting.

---

## 1. Incident Overview

| Attribute | Details |
|---|---|
| **Incident Date** | 2026-09-12 |
| **Service Affected** | `cf-admin-madagascar` (Cloudflare Worker) |
| **Trigger Origin** | Scheduled Cron (`*/5 * * * *`) |
| **Severity** | Low (Telemetry noise; no end-user service outage) |
| **Related Sentry Issues** | `CF-ADMIN-1N`, `CF-ADMIN-1P`, `CF-ADMIN-1M`, `CF-ADMIN-1Q` — **all four resolved** (1M last seen 2026-09-11, the other three 2026-09-12; statuses re-read 2026-09-19). A fifth, `CF-ADMIN-1S` (`storage-notifications` over its D1 budget, 11 events), was opened and resolved after them |
| **Customer Impact** | Zero (Zero Trust policies remained active at the edge) |
| **Status** | Remediated 2026-09-13 — **but the failure class recurred; see §7** |

---

## 2. Event Log & Timestamps

The following recurring error events were observed in Cloudflare Worker Observability (`cf-admin-madagascar` production deployment `22bf205f` / `74e2c57b`):

| Timestamp (EDT) | Execution ID / Request ID | Trigger | Message |
|---|---|---|---|
| 2026-09-12 00:56:05.842 | `[CF_HEX_ID]` | `*/5 * * * *` | `Gateway Timeout` |
| 2026-09-12 01:30:15.840 | `[CF_HEX_ID]` | `*/5 * * * *` | `Gateway Timeout` |
| 2026-09-12 01:50:16.207 | `[CF_HEX_ID]` | `*/5 * * * *` | `Gateway Timeout` |
| 2026-09-12 02:00:18.165 | `[CF_HEX_ID]` | `*/5 * * * *` | `Gateway Timeout` |
| 2026-09-12 02:15:16.157 | `[CF_HEX_ID]` | `*/5 * * * *` | `Gateway Timeout` |
| 2026-09-12 12:56:06.840 | `[CF_HEX_ID]` | `*/5 * * * *` | `Gateway Timeout` |
| 2026-09-12 20:41:06.198 | `[CF_HEX_ID]` | `*/5 * * * *` | `Gateway Timeout` |

---

## 3. Root Cause Analysis (RCA)

Investigation revealed a **3-stage cascading failure** triggered by intermittent HTTP 504 responses from upstream Supabase PostgREST:

### Stage 1: Transient Upstream Timeout (`CF-ADMIN-1N`)
- Every 5 minutes, `cf-entry.ts` executes `runJob` for `cf-access-reconcile` (`src/lib/auth/cf-access-reconcile.ts`).
- To compute a hash of authorized users, it called `fetchAuthorizedUserEmails(env)` in `src/lib/auth/cf-access-sync.ts`.
- Supabase PostgREST experienced momentary cold starts or edge network latency, returning `HTTP 504 Gateway Timeout`.
- `fetchAuthorizedUserEmails` had **no retry loop**. It caught the error on attempt 1, immediately logged to console, and reported uncooled messages to Sentry.

### Stage 2: Redundant Retries to Failing Service
- When `fetchAuthorizedUserEmails` returned an error, `reconcileCfAccessGroup` fell back to `syncCfAccessGroup(env)`.
- `syncCfAccessGroup(env)` immediately attempted to fetch from the failing Supabase endpoint a second time within milliseconds, which predictably failed again with 504.

### Stage 3: Secondary Mutation against Unreachable DB (`CF-ADMIN-1P`)
- `reconcileCfAccessGroup` then invoked `recordCfSyncOutcome` (`src/lib/auth/cf-access-sync-log.ts`) to log the failure.
- Although `recordCfSyncOutcome` successfully wrote the failure row to Cloudflare D1 (`cf_access_sync_log`), it unconditionally attempted to sweep `admin_authorized_users` in Supabase:

  ```typescript
  await adminClient.from('admin_authorized_users').update({
    cf_sync_status: 'failed',
    cf_sync_error: result.error,
    cf_sync_at: nowIso,
  }).eq('is_active', true);
  ```

- Because Supabase was actively timing out, this second request also timed out with HTTP 504, throwing an unhandled rejection at `cf-access-sync-log.ts:100` (`CF-ADMIN-1P`) and logging an uncaught error in Cloudflare Observability.

---

## 4. Impact & Blast Radius Assessment

### Did it block any service?
**NO.**
- **Authentication Resilience:** Cloudflare Zero Trust Access evaluates authentication policies and group membership entirely at the Cloudflare edge. The Zero Trust Access Group (`Admin Portal Authorized Users`) retains its existing list of allowed email addresses until a successful update is received.
- **Session Continuity:** Existing sessions stored in Cloudflare KV (`ADMIN_SESSION`) were not affected.
- **Edge Availability:** Cloudflare Workers scheduled handlers execute out-of-band via `waitUntil`. A cron timeout does not block or degrade inbound HTTP traffic to the Admin Portal UI or API endpoints.

### Any big issue or failure of service?
**NO.**
- Zero data corruption.
- Zero customer downtime.
- The sole side effect was that if an administrator added a *new* authorized user to Supabase during the 504 window, that specific new user's edge access propagation was postponed until the next successful cron cycle (5–10 minutes later).

---

## 5. Remediations Implemented

### 1. Retry in `fetchAuthorizedUserEmails`
- Added a retry loop targeting transient network/gateway errors (`504`, `502`, `503`, `TimeoutError`).
- *Corrected 2026-09-19:* `maxRetries = 2` means **one retry**, and the delay is
  `initialDelayMs * attempt` — **linear**, 500 ms. With a single retry there is
  no curve for "exponential backoff" to describe.
- A transient 504 on attempt 1 is **usually** absorbed by attempt 2. It is not
  guaranteed to be, and §7 records a recurrence in which it was not.

### 2. Alert Cooldown Protection (`reportOnceCooled`)
- Converted bare error reports in `fetchAuthorizedUserEmails` and `syncCfAccessGroup` to `reportOnceCooled(db, 'cf-sync:...', 3600000, ...)` with a 1-hour cooldown.
- Prevents Sentry quota exhaustion (Design Principle 8) while preserving full event fidelity in Cloudflare Observability.

### 3. Cascading Failure Elimination (`skipSupabaseSweep`)
- In `reconcileCfAccessGroup`, if the Supabase user whitelist cannot be retrieved after retries, the function records the failure directly to D1 with `skipSupabaseSweep: true` and exits immediately.
- It no longer redundantly invokes `syncCfAccessGroup` or sends update queries to an unreachable Supabase instance.
- In `recordCfSyncOutcome`, the Supabase update is skipped when `skipSupabaseSweep: true`, completely eliminating `CF-ADMIN-1P`.

### 4. Cloudflare Access API Timeout Expansion (`CF-ADMIN-1M`)
- Increased `CF_API_TIMEOUT_MS` from 8s to 12s in `src/lib/auth/cf-access-sync.ts`.
- Switched `syncCfAccessGroup` error reporting to `reportOnceCooled` to prevent transient Cloudflare API latency spikes from flooding Sentry.

### 5. Job Budget Calibration (`CF-ADMIN-1Q`)
- Recalibrated `staff-storage-reconcile` D1 budget in `src/lib/jobs/budgets.ts` (`idleRowsRead: 30`, `idleRowsWritten: 15`).
- Accommodates live production storage rows and telemetry without raising false budget warnings.

---

## 6. Verification Evidence (snapshot, 2026-09-13 — not a standing claim)

The block below is what the gates reported **on 2026-09-13**, frozen. It is
not the current state and should not be read as one: the repository now holds
83 `test/**/*.test.ts` files and the mirror publishes 111 documents. Re-run the
commands rather than citing these numbers.

```bash
# 1. Full cf-admin verification pipeline
npm run verify
# Results:
# - Typecheck: 0 errors, 0 warnings (655 files)
# - Ratchet: All metrics within locked baseline (.ratchet.json)
# - Tests: 855 passed across 64 test suites
# - Gates: 21 passed
# - Rules: 11 rules passed (0 violations)
# - Docs Check: 0 errors
# - Markdown Lint: 124 files, 0 issues
# - A11y Check: 0 findings
# - Audit Gate: 0 unexcepted advisories

# 2. AG Kit validation suite
python .agents/scripts/checklist.py cf-admin
# Results: 8 passed, 0 failed, 2 skipped (runtime URLs)
```

---

## 7. Addendum 2026-09-19 — the class recurred

**`CF-ADMIN-1R` — "Error: Gateway Timeout", culprit `fetchAuthorizedUserEmails`
— is unresolved today**: 5 events, first and last seen ~2026-09-14, i.e. *after*
the 2026-09-13 remediation commit. It is the only unresolved issue in the
Sentry project. Evidence: Sentry issue search on
`pet-hotel-madagascar`, `is:unresolved`, re-run 2026-09-19.

What this changes about §5:

- The remediations are real and they worked as designed — the four original
  issues are resolved and stayed resolved. What did **not** hold is §5.1's
  original promise that "attempt 2 succeeds without error"; one retry at 500 ms
  does not cover an upstream that is slow for longer than that.
- The cooldown (§5.2) is doing its job: 5 events rather than one per tick.
- **Open question for whoever picks this up:** whether to widen the retry
  (more attempts, real exponential spacing, or a longer `CF_API_TIMEOUT_MS`
  than the current 12 s) or to accept 1R as expected upstream noise and mute
  it deliberately. Accepting it is a legitimate answer — but it has to be
  recorded as a decision, not left as a permanently unresolved issue.

A `historical` post-mortem that declares a failure class closed needs this
note; without it the document reads as evidence that the class is gone.

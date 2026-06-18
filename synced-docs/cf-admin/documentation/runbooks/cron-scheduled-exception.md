---
title: "Cron Scheduled-Handler Exception (CF Access Audit Poller)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-06-07
verified_against: [code, infra]
owner: harshil
related_code:

- src/workers/cf-entry.ts
- src/workers/scheduled-log-sync.ts
- src/workers/scheduled-asset-cleanup.ts
- src/lib/auth/security-logging.ts
- sentry.server.config.ts
related_docs:
- ../operations/OPERATIONS.md
- ../security/login-forensics.md
- ../architecture/ARCHITECTURE.md
tags: [runbook, cron, workers, observability, sentry]

---

# Cron Scheduled-Handler Exception (CF Access Audit Poller)

> **TL;DR (non-technical):** Every 5 minutes a background job checks Cloudflare for
> blocked/failed admin logins. It occasionally shows up in Cloudflare's monitoring as
> an "exception," and because the job isn't wired into our error tracker (Sentry), we
> never see *why*. This runbook explains the cause and the fix: make the job
> crash-proof and make its failures visible.

> **Status:** Diagnosed & remediated 2026-06-07 (Phases 1–3 implemented — see §5)
> **Surface:** Cloudflare Worker `cf-admin-madagascar`, cron trigger `*/5 * * * *`

---

## 1. Symptom

Cloudflare Workers Observability emits an invocation record for the 5-minute cron with:

```json
{ "$workers": { "event": { "cron": "*/5 * * * *" }, "outcome": "exception",
  "eventType": "cron", "wallTimeMs": 0, "cpuTimeMs": 0 } }
```

The log `message`/`error` is just the cron expression (`*/5 * * * *`) — that is
Cloudflare's default label for a failed cron invocation, **not** the real error. There
is no stack trace attached, and nothing corresponding appears in Sentry.

`wallTimeMs: 0` / `cpuTimeMs: 0` means the throw happened **before the handler did any
real work** — consistent with a near-empty run that only touches KV.

---

## 2. What the cron does

`*/5 * * * *` → `src/workers/cf-entry.ts` `scheduled()` → `handleScheduled()` in
`src/workers/scheduled-log-sync.ts`. It polls the **CF Access Audit-Log API** for login
events that never reached the Worker (CF rejected the user pre-Worker), and writes
`LOGIN_BLOCKED` / `LOGIN_FAILED` rows to D1 `admin_login_logs` (+ capped security-alert
emails). Successful logins are logged **inline by middleware**, not by this cron. See
[login-forensics.md](../security/login-forensics.md).

On a typical run there are **no failed entries**, so the handler does little more than
read/update one KV key (`cf-audit-last-synced`) and return.

---

## 3. Root cause

Two compounding issues:

### 3.1 The cron is not crash-proof

Neither `cf-entry.ts` `scheduled()` nor `handleScheduled()` has a **top-level
try/catch**. The only statements in the common (empty-batch) path that are *not* already
guarded are KV/date operations:

| Location | Statement | Fails when |
|----------|-----------|-----------|
| `scheduled-log-sync.ts:90` | `await kv.get('cf-audit-last-synced')` | transient KV I/O error |
| `scheduled-log-sync.ts:95` | `lastSynced.toISOString()` | the stored value is unparseable → `RangeError: Invalid time value` (persistent — KV never advances past the throw) |
| `scheduled-log-sync.ts:176` / `:212` | `await kv.put('cf-audit-last-synced', …)` | transient KV I/O error |

The CF Access API fetch path is wrapped in try/catch and returns cleanly, and
`logLoginAttempt` / `sendSecurityAlertEmail` (`src/lib/auth/security-logging.ts`)
**swallow their own errors**, so the `ctx.waitUntil` tasks are *not* the source. That
leaves the unguarded KV `get`/`put` (intermittent) or `toISOString()` on a bad value
(persistent) as the only uncaught-throw sites — either bubbles out as a cron
`outcome: exception`.

### 3.2 The cron is an observability blind spot

`sentry.server.config.ts` only instruments Astro's **fetch/SSR** path. The hand-rolled
`scheduled` export is **never wrapped by Sentry**, and nothing calls `Sentry.flush()` in
the cron's `waitUntil`. Result (verified via Sentry MCP on the `cf-admin` project):

- **0** cron-related issues (only an unrelated CSP report + a 10-day-old SSR error).
- **0** `[CRON]` log entries in 24h, despite `enableLogs: true`.
- The SSR path *is* captured — confirming only the cron path is blind.

So the failure can only be seen in Cloudflare Observability, never in Sentry.

---

## 4. Evidence (live, 2026-06-07)

- D1 `admin_login_logs`: 79 `LOGIN_SUCCESS` (all inline/middleware), **1** `LOGIN_BLOCKED`
  (2026-05-04), **1** `LOGIN_FAILED` (2026-04-22) — i.e. the cron almost never has work
  to do, matching the `0ms/0ms` empty-run profile.
- Bindings all present: `DB` (D1 `madagascar-db`), `SESSION` (KV) — **not** a
  missing-binding crash.
- Sentry `cf-admin`: no cron issues/logs (see §3.2).

> Note: the KV value `cf-audit-last-synced` could not be read from here (the Cloudflare
> MCP exposes KV namespace metadata + D1 queries, but no "get KV key value"), so
> *intermittent KV error* vs *persistent bad-timestamp* can't be fully separated
> remotely. The §5 fixes resolve both.

---

## 5. Remediation

> All three phases below are implemented. The `updateWatermark()` / `safeKv` reference
> is the non-throwing KV-write helper added in `scheduled-log-sync.ts`.

### Phase 1 — make the cron crash-proof (stops the exception) ✅ implemented

- Wrap the entire `scheduled()` body in `cf-entry.ts` in `try/catch`; a failed cron run
  should log and no-op until the next tick (crons are idempotent/retryable), never
  surface as a worker exception.
- In `scheduled-log-sync.ts`, guard the I/O: wrap `kv.get`/`kv.put` in try/catch (or a
  small `safeKv` helper), and validate the timestamp
  (`isNaN(lastSynced.getTime())` → fall back to the default window) **before**
  `toISOString()`.

### Phase 2 — fix the observability gap ✅ implemented

- In the `scheduled` catch, `Sentry.captureException(err, { tags: { cron, handler } })`
  and **`ctx.waitUntil(Promise.resolve(Sentry.flush(2000)))`** (flush is mandatory in
  Workers or events are dropped; `flush` returns a `PromiseLike`, hence the
  `Promise.resolve` wrap for `waitUntil`).
- Still optional: Sentry **cron check-ins** (`Sentry.captureCheckIn`) so *missed* runs
  alert — not yet added.

### Phase 3 — correctness hardening ✅ implemented (dedupe)

- **Idempotency:** because the watermark write is best-effort, a prior run may have
  logged some failures while failing to advance the watermark, and the overlapping
  `since` window re-surfaces them. The cron now queries `admin_login_logs` for the
  batch's `cf_ray_id`s and skips any already present (CF assigns each audit entry a
  unique ray_id) — no schema migration, no global UNIQUE constraint on the shared
  inline-login path. Dedupe failure falls through to logging everything (at worst one
  duplicate row).
- `scheduled-asset-cleanup.ts` already wraps its body in try/catch; the new
  `cf-entry.ts` top-level guard covers it as defense-in-depth.

**Files:** `src/workers/cf-entry.ts`, `src/workers/scheduled-log-sync.ts`,
`src/workers/scheduled-asset-cleanup.ts`.

---

## 6. Verification

- `npm run check` / `astro check` clean.
- Deploy, trigger the cron (`wrangler`), and confirm CF Observability shows
  `outcome: ok`.
- Force an error and confirm it now appears as a **Sentry issue** (proves
  instrumentation) instead of a bare CF exception; re-query Sentry logs for `[CRON]` and
  confirm entries now flush.

---

## 7. Related

- [OPERATIONS.md](../operations/OPERATIONS.md) — cron triggers, bindings, secrets registry
- [login-forensics.md](../security/login-forensics.md) — the login-forensics subsystem this cron feeds
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — Worker entry point + request/cron lifecycle
</content>

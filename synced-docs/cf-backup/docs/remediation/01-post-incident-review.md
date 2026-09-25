---
title: "cf-backup remediation — 01 Post-incident review (six runs, no recovery point)"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [.github/workflows/db-backup.yml, scripts/backup/lib/commands.ts, scripts/backup/lib/context.ts, scripts/backup/lib/d1-backup.ts, scripts/backup/lib/pg-backup.ts, scripts/backup/lib/seal.ts, scripts/backup/lib/verdict.ts]
related_docs: [README.md, 02-root-cause-analysis.md, 04-defect-register.md, 06-remediation-plan.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, incident, post-incident-review]
---

# 01 — Post-incident review: six runs, no recovery point

> **TL;DR (non-technical):** Between 2026-09-24 and 2026-09-25 the Primary Pipeline ran six
> times and failed every time; one run was even reported as a success. No recovery point has ever
> reached the archive bucket. No data was lost, but the Supabase database has no copy anywhere,
> and the schedule is still starting runs that can only fail. This review lists every run, the
> exact log line that stopped it, the impact, and what fails next if nothing changes.

Terms follow [11](11-terminology-standard.md). Log lines are quoted exactly, so they show the
code's own stage names (`doctor` = pre-flight diagnostics, `seal` = finalization).

---

## 1. Incident summary

| Attribute | Details |
|---|---|
| **Period** | 2026-09-24 04:00 UTC → 2026-09-25 09:27 UTC (runs 1 to 6) |
| **Service affected** | The Primary Pipeline: `.github/workflows/db-backup.yml` on GitHub Actions |
| **Started by** | A person (runs 1 to 5); **the Scheduler** (run 6) |
| **Severity** | **High.** No verified recovery point exists for any store. Supabase has no other copy (the Free plan provides no platform backups) |
| **Data lost** | None. No run modified production data; this is an exposure, not a loss |
| **Business impact** | None today. After a disaster, Supabase data and its 6 authentication records could not be restored |
| **Status** | **Open.** The schedule is still enabled and fails daily. Remediation: [06](06-remediation-plan.md) |

---

## 2. Event log

Times are UTC. The `backup_runs` values were read from D1 on 2026-09-25.

| # | Requested | GitHub run | Run type, scope | Started by | Recorded status / `error_code` | First failure |
|---|---|---|---|---|---|---|
| 1 | 09-24 04:00 | 35953834471 | live restore test, full | person | `lost` / `no_manifest` | Configuration incomplete: token refused, secret and key missing, every R2 upload 403 |
| 2 | 09-24 05:12 | 35958942742 | live restore test, full | person | `failed` / `doctor_failed` | No archive encryption key (`BACKUP_AGE_RECIPIENT` not set) |
| — | 09-24 | (Worker change, not a run) | — | — | — | Vault reads through Hyperdrive hung on the transaction pooler; moved to the session pooler |
| 3 | 09-25 03:17 | 36089730779 | pre-flight run, full | person | `warning` / — | **Reported as passed; actually failed.** Pre-flight diagnostics crashed on `d1_ok`, and the verdict did not detect it |
| 4 | 09-25 03:25 | 36090273258 | backup run, full | person | `failed` / `drill_failed` | Pre-flight diagnostics crashed on `d1_ok`; no export ran |
| 5 | 09-25 03:59 | 36092596416 | backup run, full | person | `failed` / `drill_failed` | Three missing output directories, and a D1 query limit |
| 6 | 09-25 09:25 | 36118407196 | backup run, Supabase | **Scheduler** (slot `2026-09-25T09:17Z/supabase`) | `failed` / `drill_failed` | The missing `plain/postgres/` directory, again |

Every row has `data_bytes` of 0 or empty. Each run billed 1 or 2 GitHub minutes.

---

## 3. Run analysis

Log lines are quoted exactly, except that identifiers are shortened and paths abbreviated to
`…/cf-backup/` (the runner's temporary directory).

### 3.1 Run 1 — 09-24 04:00, live restore test

```
plan WARN backup_runs … not moved to running: Authentication error
doctor secret:SUPABASE_DB_URL: fail — not set
doctor variable:BACKUP_AGE_RECIPIENT: fail — not set
doctor d1:madagascar-db: fail — D1 query failed: Authentication error
doctor r2: fail — the token cannot read <the backup bucket>
seal WARN upload failed for verify/source-counts.json: R2 put … failed: 403 AccessDenied
manifest WARN upload failed for manifest.json: R2 put … failed: 403 AccessDenied
```

**Cause:** the run started before configuration was complete. The Cloudflare token could not use
D1 or R2, `SUPABASE_DB_URL` was not set, and no archive encryption key existed. Pre-flight
diagnostics reported all of it correctly, but finalization still attempted 17 uploads, all
refused, so no manifest was written and the console recorded the run as lost. **Not a code
defect, but there was no configuration gate before a production run** (L15 in
[04](04-defect-register.md)).

### 3.2 Run 2 — 09-24 05:12, live restore test

```
doctor variable:BACKUP_AGE_RECIPIENT: fail — not set
doctor age-recipient: fail — BACKUP_AGE_RECIPIENT is not set
```

**Cause:** no archive encryption key yet; the Owner created it on 09-25 at 03:19 UTC. The `d1_ok`
defect (run 4) was already present, masked because pre-flight diagnostics stopped first.

### 3.3 Run 3 — 09-25 03:17, pre-flight run

GitHub marked the run **successful** and the console showed a warning (no key). The log shows a
failure:

```
doctor ERROR doctor failed: bad step output d1_ok
##[error]Process completed with exit code 1.
seal a runner test: doctor only, no export; writing only manifest.json, evidence/doctor.json, evidence/run.log.gz
```

**Cause:** the pre-flight step has `continue-on-error: true` (`db-backup.yml:113`), and the
pre-flight verdict (`scripts/backup/lib/verdict.ts:483-492`) reads the diagnostics report file,
written before the crash, never the step's exit code. **The run intended to prove readiness passed
while pre-flight diagnostics were broken.** Eight minutes later run 4 failed on that defect
(T4 / L5).

### 3.4 Run 4 — 09-25 03:25, backup run

```
doctor ERROR doctor failed: bad step output d1_ok
seal ##[error]d1:madagascar-db: no backup was taken (the D1 step did not run)
seal ##[error]postgres: no backup was taken (the Postgres step did not run)
```

**Cause:** `scripts/backup/lib/github.ts` accepted step-output names only if they matched
`/^[a-z_]+$/`. `d1_ok` contains a digit, so pre-flight diagnostics threw while writing outputs, and
the per-store gates (`d1_ok`, `pg_ok`) never worked on GitHub. **Resolved** in `cf50a5c` (now
`/^[a-z][a-z0-9_]*$/`, `github.ts:33-35`); run 6 confirms the gate opens (T3).

### 3.5 Run 5 — 09-25 03:59, backup run

Pre-flight diagnostics passed all 20 checks. Every export then failed.

**D1, `madagascar-db`:**

```
d1:madagascar-db:export $ node …/wrangler.js d1 export madagascar-db --remote --skip-confirmation --output …/cf-backup/plain/d1/madagascar-db.sql
d1:madagascar-db:export [err] ✘ [ERROR] A file or directory could not be found.
d1:madagascar-db:export [err]   Missing file or directory: …/cf-backup/plain/d1/madagascar-db.sql
d1:madagascar-db:export madagascar-db: 32 tables, 0 rows, exported by wrangler-export in ? s
```

- **Cause 1: the directory `plain/d1/` did not exist** (T1). The path is built in
  `scripts/backup/lib/context.ts:68`; the D1 command creates only `wrangler-cwd/`; wrangler's
  `--output` does not create directories. The download itself completed; only the write failed.
- Execution order masked it for the other two databases. `chatbot-kb` contains a full-text
  (virtual) table, so it uses the pipeline's own query exporter, which writes with `writeText` and
  does create directories (`scripts/backup/sys/fs.ts:42-49`). It succeeded ("5 tables, 87 rows")
  and created `plain/d1/` as a side effect, so `whatsapp-chatbot` then succeeded too.
- **Cause 2: "0 rows".** The row-count query failed silently. `evidence/source-counts.json` holds
  `"d1:madagascar-db": {"before": {}, "after": {}}`. The same query shape, run read-only on the
  live database, returns `too many terms in compound SELECT: SQLITE_ERROR` (code 7500): D1 accepts
  at most 5 `UNION ALL` terms and the query has one per table, 32 here (T2 / L2). **This database
  would have failed even with the directory present.**

**PostgreSQL:**

```
postgres:dump WARN postgres: auth.users is not readable by the dump role, so its data is not in this backup (estimated rows: 6)
postgres:dump postgres: left out 37 unreadable table(s): auth.audit_log_entries, …
postgres:dump $ supabase db dump --db-url *** -f …/cf-backup/plain/postgres/roles.sql --role-only
postgres:dump [err] failed to open dump file: NotFound: FileSystem.writeFile (…/cf-backup/plain/postgres/roles.sql)
postgres:dump postgres: 0 tables, 0 rows in the dump, 1.1 s
```

- **Cause: the directory `plain/postgres/` did not exist** (T1; `context.ts:69`,
  `pg-backup.ts:169-183`). The first of five exports failed, so the rest never ran.
- **Also reported:** 37 tables in `auth`, `storage`, `realtime` and `vault` are unreadable by the
  read-only export role, including `auth.users` (6 authentication records) and `auth.identities`
  (12) (T6).
- The next PostgreSQL defect was never reached: the Supabase CLI switches to the `postgres` role,
  which the export role is not permitted to do (T5 / L1).

**Finalization (encryption):**

```
seal $ …/tools/age/age -r <recipient> -o …/cf-backup/out/2026-09-25_full_gh36092596416a1/data/d1-chatbot-kb.sql.gz.age …/cf-backup/plain/d1/chatbot-kb.sql.gz
seal [err] age: error: failed to write header: open …/out/2026-09-25_full_gh36092596416a1/data/d1-chatbot-kb.sql.gz.age: no such file or directory
```

- Four occurrences: the full and schema files of the two exported databases.
- **Cause: the directory `out/<run key>/data/` did not exist** (T1). The encryption loop
  (`seal.ts:296-316`) calls `age -o` (`age.ts:87`), and age does not create directories. Evidence
  files written later in the same stage use `writeBytes`, which does, so the run folder held
  evidence and no data.

**What the report stated:** `report.md` printed `integrity: pass` ("PRAGMA integrity_check ok;
Postgres restored with ON_ERROR_STOP"), `row-count: pass` and `fingerprints: pass` for a run in
which PostgreSQL was never exported and one D1 database was never exported. The overall verdict,
FAILED, was correct; three of its lines were false (L6 / N2).

### 3.6 Run 6 — 09-25 09:25, scheduled Supabase run

Dispatched by the Scheduler for slot `2026-09-25T09:17Z/supabase`, after the first analysis was
published and while the schedule was intended to be paused.

```
doctor pre-flight policy: halt            (all checks passed above this line)
postgres:dump $ supabase db dump --db-url *** -f …/cf-backup/plain/postgres/roles.sql --role-only
postgres:dump [err] failed to open dump file: NotFound: FileSystem.writeFile (…/plain/postgres/roles.sql)
postgres:dump postgres: 0 tables, 0 rows in the dump, 0.9 s
seal ##[error]postgres: restore into public.ecr.aws/supabase/postgres:17.6.1.104@… failed (no dump to drill)
seal ##[error]4 expected file(s) missing: data/postgres-roles.sql.gz.age, …
```

- **Cause:** T1 again; no new defect.
- **What it established:** the Scheduler's dispatch works (L13 was partly wrong), and **every
  scheduled run will fail the same way until T1 is fixed**.
- **The recorded error code is wrong:** `drill_failed`, although the export failed, not the
  restore verification (N1 in [04](04-defect-register.md)).

---

## 4. Components confirmed working

- Pre-flight diagnostics' 20 checks, including a real R2 PUT, HEAD and DELETE from the runner and
  a real age encryption to the archive encryption key.
- wrangler's D1 export and download (`whatsapp-chatbot`, about 1 s).
- The query exporter on a full-text database (`chatbot-kb`).
- Local D1 restore verification (`node:sqlite`) on the two databases that were exported.
- The Scheduler's dispatch (run 6) and the per-store gates (run 6).

## 5. Contribution of the storage-layout change

None. The layout change (`f1ac864`, 2026-09-24) renamed the encrypted files (`data/d1/<db>…` became
`data/d1-<db>…`). The code before it had the same gap: `git show f1ac864^` creates no directories in
`seal.ts` or `d1-backup.ts`, and the `plain/` paths are unchanged. All three directory defects date
from the first runner commits (2026-09-23); no earlier run progressed far enough to reach them.

## 6. Impact and exposure (2026-09-25)

| Asset | Copies outside the primary | Current protection |
|---|---|---|
| Supabase: application data (17 MB, 20 tables) and 6 authentication records | **0** | None. The Free plan provides no platform backups |
| D1: `madagascar-db` (2.5 MB), `chatbot-kb`, `whatsapp-chatbot` | **0 off-site** | Time Travel: 7 days of point-in-time restore on the Free plan, within the same account. It restores in place and is not documented to survive database deletion or account loss |
| Archive encryption key | Supabase Vault, plus an **unconfirmed** offline recovery key | The key registry shows 0 recovery-key confirmations and 0 reveals ([02](02-root-cause-analysis.md) §3) |

## 7. Forecast if no action is taken

| When (UTC) | Started by | Expected result |
|---|---|---|
| Sat 09-26 09:17 | Scheduler, Supabase slot | Fails at T1, as run 6 |
| Sun 09-27 09:17 | Scheduler, full slot | Fails at T1, T2 and, behind them, T5 |
| Sun 09-27 09:17 | cf-admin's legacy export workflow (N8) | Fails at its pre-flight: cf-admin holds none of its secrets |
| Mon 09-28 12:43 | The fallback schedule (D-5) | Starts a full run **regardless of the schedule settings**, and fails |
| Daily | The Scheduler's staleness alerts | Continue. They are correct and cannot be disabled |

Containment steps: [06](06-remediation-plan.md) §3 (Stage 0).

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | `gh run view --log` for runs 1 to 5; the 14-day artifact of run 5 (`evidence/`, `report.md`) | §3.1 to §3.5 |
| 2026-09-25 | claude | GitHub job log of run 6 (job 108017839304) | §3.6 |
| 2026-09-25 | claude | D1 read-only: `backup_runs` (all 6 rows), `backup:config` schedule | §2, §7 |
| 2026-09-25 | claude | D1 read-only: `SELECT 1 UNION ALL … SELECT 6` on `madagascar-db` | Code 7500, `too many terms in compound SELECT` |
| 2026-09-25 | claude | D1 API: database list | `madagascar-db` file 2.5 MB. *Corrected: an earlier draft stated 16.5 MB, which was the step's network counter* |
| 2026-09-25 | claude | Re-check at 16:00 UTC: `backup_runs`, schedule flags, workflow state, key registry | Unchanged: 6 runs, schedule enabled, both workflows active, 0 confirmations |
| 2026-09-25 | claude | Code read at `da38ddf` | File and line references as cited |

## 9. Related

- [02-root-cause-analysis.md](02-root-cause-analysis.md): why it happened.
- [04-defect-register.md](04-defect-register.md): every defect by ID, with its remediation.
- [06-remediation-plan.md](06-remediation-plan.md): the remediation plan.

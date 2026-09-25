---
title: "cf-backup recovery — 01 Incident post-mortem (six runs, zero backups)"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [.github/workflows/db-backup.yml, scripts/backup/lib/commands.ts, scripts/backup/lib/context.ts, scripts/backup/lib/d1-backup.ts, scripts/backup/lib/pg-backup.ts, scripts/backup/lib/seal.ts, scripts/backup/lib/verdict.ts]
related_docs: [README.md, 02-root-causes.md, 04-defect-register.md, 06-plan.md]
tags: [cf-backup, recovery, incident, post-mortem, backups]
---

# 01 — Incident post-mortem: six runs, zero backups

> **TL;DR (non-technical):** Between 2026-09-24 and 2026-09-25, cf-backup tried to back up the
> platform six times and failed every time. One of the six was even reported as a pass. No
> backup file has ever reached the backup bucket. No data was lost, but the Supabase database
> has no copy anywhere, and the daily schedule is still starting runs that can only fail. This
> page lists every run, the exact log line that stopped it, and what that means.

---

## 1. Incident overview

| Attribute | Details |
|---|---|
| **Period** | 2026-09-24 04:00 UTC → 2026-09-25 09:27 UTC (runs 1 to 6) |
| **Service affected** | cf-backup's backup pipeline: `.github/workflows/db-backup.yml` on GitHub Actions |
| **Started by** | A person (runs 1 to 5); **the schedule** (run 6) |
| **Severity** | **High.** No restorable backup of any store exists. Supabase has no other copy (the Free plan takes no backups) |
| **Data lost** | None. No run touched production data; this is an exposure, not a loss |
| **Customer impact** | None today. After a disaster, the business could not restore Supabase data or its 6 sign-in accounts |
| **Status** | **Open.** The schedule is still on and fails once a day. The plan is [06](06-plan.md) |

---

## 2. Event log

Times are UTC. The `backup_runs` columns are read from D1 on 2026-09-25.

| # | Requested | GitHub run | Mode, scope | Started by | `backup_runs` status / `error_code` | First thing that stopped it |
|---|---|---|---|---|---|---|
| 1 | 09-24 04:00 | 35953834471 | drill, full | person | `lost` / `no_manifest` | Setup incomplete: token refused, secret and key missing, every R2 upload 403 |
| 2 | 09-24 05:12 | 35958942742 | drill, full | person | `failed` / `doctor_failed` | No backup key yet (`BACKUP_AGE_RECIPIENT` not set) |
| — | 09-24 | (a Worker fix, not a run) | — | — | — | Vault reads through Hyperdrive hung on the transaction pooler; moved to the session pooler |
| 3 | 09-25 03:17 | 36089730779 | preflight, full | person | `warning` / — | **Reported a pass; actually failed.** The doctor crashed on `d1_ok`, and the verdict did not notice |
| 4 | 09-25 03:25 | 36090273258 | backup, full | person | `failed` / `drill_failed` | The doctor crashed on `d1_ok`; no store ran |
| 5 | 09-25 03:59 | 36092596416 | backup, full | person | `failed` / `drill_failed` | Three missing output folders, and a D1 query limit |
| 6 | 09-25 09:25 | 36118407196 | backup, supabase | **schedule** (slot `2026-09-25T09:17Z/supabase`) | `failed` / `drill_failed` | The missing `plain/postgres/` folder, again |

Every row has `data_bytes` of 0 or empty. Billed minutes: 1 or 2 per run.

---

## 3. Run by run

Log lines are quoted exactly, except that ids are cut and paths are shortened to `…/cf-backup/`
(the runner's temporary folder).

### 3.1 Run 1 — 09-24 04:00, drill

```
plan WARN backup_runs … not moved to running: Authentication error
doctor secret:SUPABASE_DB_URL: fail — not set
doctor variable:BACKUP_AGE_RECIPIENT: fail — not set
doctor d1:madagascar-db: fail — D1 query failed: Authentication error
doctor r2: fail — the token cannot read <the backup bucket>
seal WARN upload failed for verify/source-counts.json: R2 put … failed: 403 AccessDenied
manifest WARN upload failed for manifest.json: R2 put … failed: 403 AccessDenied
```

**Cause:** the run started before setup was finished. The Cloudflare token could not use D1 or
R2, `SUPABASE_DB_URL` was not set, and no backup key existed. The doctor reported all of it
correctly, but seal still tried 17 uploads, all refused, so no manifest was written and the
console recorded the run as lost. **Not a code defect, but there was no "setup is complete"
gate before a real run** (L15 in [04](04-defect-register.md)).

### 3.2 Run 2 — 09-24 05:12, drill

```
doctor variable:BACKUP_AGE_RECIPIENT: fail — not set
doctor age-recipient: fail — BACKUP_AGE_RECIPIENT is not set
```

**Cause:** no backup key yet. The owner created the first key on 09-25 at 03:19 UTC. The
`d1_ok` defect (run 4) was already in the code, hidden because the doctor stopped first.

### 3.3 Run 3 — 09-25 03:17, preflight ("runner test")

GitHub marked this run **success**, and the console showed a warning (no key). The log says
otherwise:

```
doctor ERROR doctor failed: bad step output d1_ok
##[error]Process completed with exit code 1.
seal a runner test: doctor only, no export; writing only manifest.json, evidence/doctor.json, evidence/run.log.gz
```

**Cause:** the doctor step has `continue-on-error: true` (`db-backup.yml:113`), and the
runner-test verdict (`scripts/backup/lib/verdict.ts:483-492`) reads the doctor's report file,
written before the crash, never the step's exit code. **The one run meant to prove the runner
was ready passed while the doctor was broken.** Eight minutes later, run 4 failed on exactly
that defect (T4 / L5).

### 3.4 Run 4 — 09-25 03:25, full backup

```
doctor ERROR doctor failed: bad step output d1_ok
seal ##[error]d1:madagascar-db: no backup was taken (the D1 step did not run)
seal ##[error]postgres: no backup was taken (the Postgres step did not run)
```

**Cause:** `scripts/backup/lib/github.ts` accepted step-output names only if they matched
`/^[a-z_]+$/`, a rule in place since the first runner commit. `d1_ok` contains a digit, so the
doctor threw while writing its outputs, and the per-store gates (`d1_ok`, `pg_ok`) never worked
on GitHub. **Fixed** in `cf50a5c` (the rule is now `/^[a-z][a-z0-9_]*$/`, `github.ts:33-35`); run 6
proves the gate opens (T3).

### 3.5 Run 5 — 09-25 03:59, full backup

The doctor passed all 20 checks. Then every store failed.

**D1, `madagascar-db`:**

```
d1:madagascar-db:export $ node …/wrangler.js d1 export madagascar-db --remote --skip-confirmation --output …/cf-backup/plain/d1/madagascar-db.sql
d1:madagascar-db:export [err] ✘ [ERROR] A file or directory could not be found.
d1:madagascar-db:export [err]   Missing file or directory: …/cf-backup/plain/d1/madagascar-db.sql
d1:madagascar-db:export madagascar-db: 32 tables, 0 rows, exported by wrangler-export in ? s
```

- **Cause 1: the folder `plain/d1/` did not exist** (T1). The path is built in
  `scripts/backup/lib/context.ts:68`; the D1 command creates only `wrangler-cwd/`; wrangler's
  `--output` does not create folders. The download itself had finished; only the write failed.
- The order hid it for the other two databases. `chatbot-kb` has a full-text (virtual) table, so
  it goes through our own query exporter, which writes with `writeText`. That creates the folder
  (`scripts/backup/sys/fs.ts:42-49`), so `chatbot-kb` succeeded ("5 tables, 87 rows") and made
  `plain/d1/` as a side effect. `whatsapp-chatbot`, exported by wrangler after it, then worked too.
- **Cause 2: "0 rows".** The row-count query failed without a word in the log.
  `evidence/source-counts.json` holds `"d1:madagascar-db": {"before": {}, "after": {}}`. The same
  query shape, run read-only on the live database, returns
  `too many terms in compound SELECT: SQLITE_ERROR` (code 7500): D1 allows at most 5 `UNION ALL`
  parts, and the query has one per table, 32 here (T2 / L2). **This database would have failed
  even with the folder fixed.**

**Postgres:**

```
postgres:dump WARN postgres: auth.users is not readable by the dump role, so its data is not in this backup (estimated rows: 6)
postgres:dump postgres: left out 37 unreadable table(s): auth.audit_log_entries, …
postgres:dump $ supabase db dump --db-url *** -f …/cf-backup/plain/postgres/roles.sql --role-only
postgres:dump [err] failed to open dump file: NotFound: FileSystem.writeFile (…/cf-backup/plain/postgres/roles.sql)
postgres:dump postgres: 0 tables, 0 rows in the dump, 1.1 s
```

- **Cause: the folder `plain/postgres/` did not exist** (T1; `context.ts:69`,
  `pg-backup.ts:169-183`). The first of the five dumps failed, so the rest never ran.
- **Also reported:** 37 tables in `auth`, `storage`, `realtime` and `vault` are unreadable by the
  backup role, `auth.users` (6 sign-in accounts) and `auth.identities` (12) among them (T6).
- The next Postgres defect was never reached: the Supabase CLI switches to the `postgres` role,
  which the backup role may not do (T5 / L1).

**Seal (encryption):**

```
seal $ …/tools/age/age -r <recipient> -o …/cf-backup/out/2026-09-25_full_gh36092596416a1/data/d1-chatbot-kb.sql.gz.age …/cf-backup/plain/d1/chatbot-kb.sql.gz
seal [err] age: error: failed to write header: open …/out/2026-09-25_full_gh36092596416a1/data/d1-chatbot-kb.sql.gz.age: no such file or directory
```

- ×4: the full and schema files of the two databases that had been exported.
- **Cause: the folder `out/<run key>/data/` did not exist** (T1). Seal's encrypt loop
  (`seal.ts:296-316`) calls `age -o` (`age.ts:87`), and age does not create folders. Evidence
  files written later in the same step use `writeBytes`, which does, so the run folder ended up
  holding evidence and no data.

**What the report said:** `report.md` printed `integrity: pass` ("PRAGMA integrity_check ok;
Postgres restored with ON_ERROR_STOP"), `row-count: pass` and `fingerprints: pass`, for a run in
which Postgres was never dumped and one D1 database was never exported. The overall verdict,
FAILED, was right; three of its lines were false (L6 / N2).

### 3.6 Run 6 — 09-25 09:25, scheduled Supabase backup

Started by cf-admin's tick for slot `2026-09-25T09:17Z/supabase`, after the first analysis was
written and while the schedule was meant to be paused.

```
doctor pre-flight policy: halt            (all checks passed above this line)
postgres:dump $ supabase db dump --db-url *** -f …/cf-backup/plain/postgres/roles.sql --role-only
postgres:dump [err] failed to open dump file: NotFound: FileSystem.writeFile (…/plain/postgres/roles.sql)
postgres:dump postgres: 0 tables, 0 rows in the dump, 0.9 s
seal ##[error]postgres: restore into public.ecr.aws/supabase/postgres:17.6.1.104@… failed (no dump to drill)
seal ##[error]4 expected file(s) missing: data/postgres-roles.sql.gz.age, …
```

- **Cause:** T1 again. Nothing new as a defect.
- **Two things it proved:** the tick's dispatch works (L13 was partly wrong), and **every
  scheduled run will fail the same way until T1 is fixed**.
- **The error code is wrong.** The row reads `drill_failed`, but the dump failed, not the drill
  (N1 in [04](04-defect-register.md)).

---

## 4. What worked, for the record

Real evidence that parts of the pipeline work:

- the doctor's 20 checks, including a real R2 PUT, HEAD and DELETE from the runner, and a real
  age encryption to the backup key;
- wrangler's D1 export and download (`whatsapp-chatbot`, about 1 s);
- the query exporter on a full-text database (`chatbot-kb`);
- the local D1 restore drill (`node:sqlite`) on the two databases that were exported;
- the tick's scheduled dispatch (run 6) and the per-store gates (run 6).

## 5. Was the storage-layout change to blame?

No. The layout change (`f1ac864`, 2026-09-24) renamed the encrypted files (`data/d1/<db>…` became
`data/d1-<db>…`). The code before it had the same gap: `git show f1ac864^` has no folder creation
in `seal.ts` or `d1-backup.ts`, and the `plain/` paths are unchanged. All three folder defects
date from the first runner commits (2026-09-23). No earlier run got far enough to hit them.

## 6. Impact and exposure (2026-09-25)

| What | Copies outside the primary | What protects it today |
|---|---|---|
| Supabase: the app's data (17 MB, 20 tables) and 6 sign-in accounts | **0** | Nothing. The Free plan has no platform backups |
| D1: `madagascar-db` (2.5 MB), `chatbot-kb`, `whatsapp-chatbot` | **0 off-site** | Time Travel: 7 days of point-in-time restore on the Free plan, inside the same account. It restores in place and is not documented to survive a deleted database or a lost account |
| The backup key | Supabase Vault, plus an **unconfirmed** recovery kit | The key registry shows 0 kit confirmations and 0 reveals ([02](02-root-causes.md) §3) |

## 7. What happens next if nothing changes

| When (UTC) | Started by | What it will do |
|---|---|---|
| Sat 09-26 09:17 | cf-backup's tick, Supabase slot | Fail at T1, like run 6 |
| Sun 09-27 09:17 | cf-backup's tick, full slot | Fail at T1, T2 and, behind them, T5 |
| Sun 09-27 09:17 | cf-admin's own `backups.yml` (N8) | Fail in its pre-flight: cf-admin holds none of its secrets |
| Mon 09-28 12:43 | `db-backup.yml`'s fallback cron (D-5) | Start a full backup **whatever the schedule settings say**, and fail |
| Every day | the tick's stale-backup alerts | Keep firing. They are correct and cannot be switched off |

How to stop them safely is [06](06-plan.md) §3 (Stage 0).

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | `gh run view --log` for runs 1 to 5; the 14-day artifact of run 5 (`evidence/`, `report.md`) | As in §3.1 to §3.5 |
| 2026-09-25 | claude | GitHub job log of run 6 (job 108017839304) | As in §3.6 |
| 2026-09-25 | claude | D1 read-only: `backup_runs` (all 6 rows), `backup:config` schedule | As in §2 and §7 |
| 2026-09-25 | claude | D1 read-only: `SELECT 1 UNION ALL … SELECT 6` on `madagascar-db` | Code 7500, `too many terms in compound SELECT` |
| 2026-09-25 | claude | D1 API: database list | `madagascar-db` file 2.5 MB. *Corrected: an earlier draft said 16.5 MB, which was the step's network counter* |
| 2026-09-25 | claude | Code read at `da38ddf` | File and line references as cited |

## 9. Related

- [02-root-causes.md](02-root-causes.md): why this happened, technically and in the process.
- [04-defect-register.md](04-defect-register.md): every defect by ID, with its fix.
- [06-plan.md](06-plan.md): the plan.

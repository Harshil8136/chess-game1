---
title: "cf-backup recovery — 04 Defect register (every known defect, its evidence and its fix)"
status: active
audience: [ai, technical, owner]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [.github/workflows/db-backup.yml, scripts/backup/lib/commands.ts, scripts/backup/lib/context.ts, scripts/backup/lib/d1-backup.ts, scripts/backup/lib/d1-schema.ts, scripts/backup/lib/doctor.ts, scripts/backup/lib/pg-backup.ts, scripts/backup/lib/seal.ts, scripts/backup/lib/verdict.ts, scripts/backup/lib/plan.ts, scripts/backup/lib/workflow-guards.ts]
related_docs: [README.md, 01-incident-postmortem.md, 02-root-causes.md, 03-reality-check.md, 06-plan.md]
tags: [cf-backup, recovery, defects, register]
---

# 04 — Defect register

> **TL;DR (non-technical):** Every known problem in the backup pipeline, in one list, with the
> proof and the fix for each. Until now, problems came out one real run at a time. This list
> finds the rest in advance. Six of them stop a backup on their own; others make the results
> untrustworthy; and some parts of the pipeline have simply never run for real, so they should be
> expected to hold problems nobody has seen yet.

The review read the runner (`scripts/backup/**`, `.github/workflows/db-backup.yml`) at `da38ddf`,
the tests' fakes, the Supabase CLI and drill-image sources at the pinned versions, and ran
read-only live checks. Two independent code audits cross-checked it.

**IDs.** `T` = a technical root cause that already failed or is proven ([02](02-root-causes.md)
§1). `L` = found by the first review. `N` = found by the second review. Where two IDs name the
same defect, they share a row.

**Confidence:**

- **Certain**: proven by a live check, the tool's source or a real log.
- **Likely**: strong evidence; the rehearsal job must confirm it.
- **Unproven**: the path has never run for real, so its defects are unknown.
- **Fixed**: with the commit.

**Stage** is where [06](06-plan.md) fixes it.

## A. Stops the next backup

| # | Defect | Where | Confidence | Fix | Stage |
|---|---|---|---|---|---|
| T1 | **Output folders are never created** before wrangler, the Supabase CLI and age write into them: `plain/d1/`, `plain/postgres/`, `out/<run key>/data/` | Built at `context.ts:68,69,77`; written at `wrangler.ts:21`, `pg-backup.ts:181`, `age.ts:87`. The only `ensureDir` calls are `commands.ts:103,274,300,333`. `plain/` is deleted at `commands.ts:164` and `seal.ts:163`, so nothing can create it by accident | Certain (runs 5, 6) | One `ensureDir` in the command that owns each path. Fakes stop creating folders | 2 |
| T2, L2, N3 | **D1 counts and fingerprints use a compound `SELECT` with one part per table**; D1 allows 5. `madagascar-db` has 32 tables; `chatbot-kb` has exactly 5, so one more table breaks it too | `countsSql` `d1-schema.ts:123-125`, `fingerprintSql` `:128-140`. **Three** remote call sites: `d1-backup.ts:122`, `:177`, and `:298` (the monthly real-path drill; missed by the first review). `:232` runs on local SQLite and is fine | Certain (live test) | One `SELECT` with a scalar subquery per table (no compound at all), or groups of at most 5. The fake D1 becomes Miniflare, which enforces the limit | 2 |
| T5, L1 | **Every Postgres dump will fail: the Supabase CLI switches to `postgres`** (`SET ROLE`), which the backup role may not do | `pg-backup.ts:169-183` runs `supabase db dump` five times; also the unverified `.temp/postgres-version` trick at `:154-160` | Certain (CLI source; live grants) | Drop the Supabase CLI. Run `pg_dump` in the pinned `supabase/postgres` 17 image with explicit schemas (`public`, `supabase_migrations`) and no `--role`, exactly as the lifeboat does ([09](09-lifeboat-spec.md)) | 2 |
| L3 | **The Postgres drill will stop at `auth.jwt()`**, and at any `storage` data | `pg-backup.ts:313-316` restores into a bare image with `ON_ERROR_STOP=1` | Certain in code; the failure itself Likely | A drill shim that defines `auth.jwt()`; dump only `public` and `supabase_migrations`, so `storage` never appears | 2 |
| L4, L16 | **`pg_dump` may be refused locks in schemas the role cannot use**; the CLI's data dump would also pull `cron.job` data | The CLI's schema list; `pg-backup.ts:172` excludes table data, not locks | Likely, only if the CLI were kept | L1's fix (explicit schemas) removes both | 2 |
| N4 | **The D1 backup depends on the Supabase CLI download.** The `supabase cli` step has no `continue-on-error`, and the `d1` and `postgres` conditions carry an implicit `success()` | `db-backup.yml:104-108,121,137` | Certain in code | L1's fix removes the step | 2 |

## B. Makes results untrustworthy

| # | Defect | Where | Confidence | Fix | Stage |
|---|---|---|---|---|---|
| T4, L5 | **A step that crashes does not fail a runner test** | `continue-on-error` at `db-backup.yml:101,113`; `evaluateRunnerTest` never reads exit codes (`verdict.ts:483-492`). `cf50a5c` records a doctor crash as `crashed` (`commands.ts:481-499`), for the doctor only | Certain (run 3) | Pass every step's `${{ steps.<id>.outcome }}` into seal's env; any `failure` fails the run. *Corrected 2026-09-25: the first review proposed reading `steps.jsonl`, which would not have caught runs 3 and 4 (the doctor's step record is written with exit 0 before the crash, `log.ts:242-254`, `commands.ts:242`). `JOB_STATUS` does not help either: under `continue-on-error` it always reads `success`* | 2 |
| L6, N2 | **Checks with nothing to check print "pass"** | `checkIntegrity` passes whenever a drill object exists (`verdict.ts:78-79,168-179`), and every command writes one even when nothing was restored (`commands.ts:288,354`; `d1-backup.ts:203-205`; `pg-backup.ts:269-271`). `checkRowCounts` and `checkFingerprints` turn "pass" with text naming Postgres after one D1 drill | Certain (runs 5 and 6) | Each check lists what it covered per store; a store with no data reads "skipped", or "failed" when expected. Test: a run without a Postgres dump never prints a Postgres pass | 2 |
| N1 | **The error code blames the wrong step.** A failed dump still produces a drill result (`{ok:false, problems:['no dump to drill']}`), so the verdict's "export failed" branch is never reached and the first finding maps to `drill_failed`. The real cause survives only in the manifest | `pg-backup.ts:269-271`; `commands.ts:351-354`; `verdict.ts:150-153`; `seal.ts:99-112`. Tested only with a hand-built `drill: null` (`test/runner/seal.test.ts:480-500`) | Certain (runs 4 to 6) | Skip the drill when there is nothing to drill; branch on "no files", not "no drill". Test with the object production really produces | 2 |
| T7, L7 | **Export errors are silent until the verdict**; the summary line says "0 rows" as if normal | `d1-backup.ts:115-117,123-125,151-153,168-170,180-182`, summary `:187`; `pg-backup.ts:108-120,190-192`, summary `:246`. The logger logs only thrown errors (`log.ts:232-237`) | Certain (run 5: the D1 limit error appears nowhere in the log) | Log every problem at `error` when recorded; the summary says "counts failed", not a number | 2 |
| L8 | **The doctor proves reachability, not the ability to back up** | `doctor.ts:327-340` (the D1 check is `SELECT 1`) | Certain | Three real checks costing seconds: write and delete a file in each work folder; export one small table; `pg_dump --schema-only` of one table through the dump's image and URL | 2 |

## C. Never run for real (unknown defects)

By the record of six runs, each of these should be expected to hold at least one defect until the
rehearsal job or the lifeboat runs it.

| # | Path | Where | What could break (examples) | Confidence | Stage |
|---|---|---|---|---|---|
| L9 | The Postgres drill end to end | `pg-backup.ts:267-351` | The readiness loop; `docker cp` of the dumps; `roles.sql` naming a role the image already has; the restored-fingerprint queries | Unproven | 2 |
| L10 | Seal's data upload, checksums and manifest with real data | `seal.ts:296-316` onwards | Metadata limits; content types; upload order when a file is missing. *The 17 evidence uploads of run 6 worked; the data path has never run* | Unproven (partly proven) | 2 |
| L11 | The monthly real-path D1 drill (`mode=drill`) | `d1-backup.ts` `realPathDrill`; `commands.ts:295-322` | Creating and deleting a D1 database through the API; `wrangler d1 execute --file` on the export; the always-delete; **and N3's count query (certain)** | Unproven, one Certain | 4 |
| L12 | `mode=check` | `plan.ts:189`; seal's evidence-only path | Never dispatched | Unproven | 4 |
| L13 | The schedule | cf-admin's tick; the `db-backup.yml` fallback cron | *Partly disproved: run 6 shows the tick's dispatch works.* The Monday fallback has never fired | Unproven (fallback only) | 5 |
| L14 | A restore by a person, from the bucket, with the recovery kit | `docs/RESTORE.md` | Never done; key custody and the steps are untested | Unproven | 5 |

## D. Setup and operations

| # | Defect | Where | Confidence | Fix | Stage |
|---|---|---|---|---|---|
| T3 | The step-output name rule rejected `d1_ok` | `github.ts:33-35` | **Fixed** in `cf50a5c`; run 6's gate opened | — | — |
| T6 | **Sign-in accounts (`auth.users`, 6; `auth.identities`, 12) are in no backup** | `sql/supabase/01_backup_reader.sql:43-49` (its own comment says the grant does not take) | Certain | Owner decision RD-1; meanwhile the manual backup ([10](10-manual-backup-runbook.md)) includes them | 0, 3 |
| N9 | **No confirmed copy of the backup key outside Supabase.** The registry shows 0 kit confirmations and 0 reveals; the Vendor has no kit | `backup:key-registry` | Certain | Owner and Vendor confirm their kits | 0 |
| N6 | **The schedule and the fallback are live**, so every scheduled run fails | `backup:config.schedule`; `db-backup.yml` cron `43 12 * * 1` | Certain (run 6) | Flags off, then disable the workflow, in that order. *Commenting out the cron would fail CI (`workflow-guards.ts:195-198`); the fallback ignores the flags (`plan.ts:57`)* | 0 |
| N8 | **cf-admin's older `backups.yml` is still scheduled** (Sundays 09:17 UTC, the same minute as cf-backup's full backup) and holds no secrets | cf-admin `.github/workflows/backups.yml` | Certain (both its runs failed at the pre-flight) | Disable now; retire after the lifeboat is green (RD-8) | 0, 1 |
| L15 | **No setup gate.** Runs 1 and 2 started with missing secrets and no key | A Worker pre-flight runs before dispatch (`src/backups/start.ts:38`) and there is no backup without a key (`src/tick/schedule.ts:321`), but nothing requires a passed runner test | Certain (partly mitigated) | The console refuses a real backup until the latest runner test passed with the same settings | 2 |
| N5 | **One failed check stops every store.** The default pre-flight policy is `halt` | `doctor.ts:599,707-716`; contradicts `db-backup.yml:8-10` | Certain | Owner decision RD-13 (default: per store) | 2 |
| N7 | **The runner's own `pg_dump` is version 16**; the server is 17 | GitHub's `ubuntu-24.04` image | Certain | Always run `pg_dump` from the pinned 17 image, never `/usr/bin` | 1, 2 |
| L17 | **Minutes:** a rehearsal on every push would use the Actions budget | — | Design | Run it only when runner paths change, plus weekly; ceiling RD-7 | 2 |

## E. Summary

| Effect | Count | IDs |
|---|---|---|
| Stops the next backup | 6 rows | T1; T2, L2, N3; T5, L1; L3; L4, L16; N4 |
| Untrustworthy results | 5 rows | T4, L5; L6, N2; N1; T7, L7; L8 |
| Never run for real | 6 rows | L9 to L14 |
| Setup and operations | 9 rows (1 fixed) | T3; T6; N9; N6; N8; L15; N5; N7; L17 |

## F. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | First code review of the runner and fakes | L1 to L17 |
| 2026-09-25 | claude | Second, independent code audit at `da38ddf`, every claim re-read with current line numbers | L1 to L17 confirmed or corrected as marked; N1 to N8 added |
| 2026-09-25 | claude | D1 and Supabase read-only checks; run 6 log | T2, T5, T6, N6, N9 |
| 2026-09-25 | claude | cf-admin `backups.yml` and its runs | N8 |

## G. Related

- [01-incident-postmortem.md](01-incident-postmortem.md): the runs where these showed up.
- [06-plan.md](06-plan.md): the stages that fix them.
- [09-lifeboat-spec.md](09-lifeboat-spec.md): the commands the main runner converges on.

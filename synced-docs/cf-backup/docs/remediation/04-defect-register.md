---
title: "cf-backup remediation — 04 Defect register (every known defect, its evidence and remediation)"
status: active
audience: [ai, technical, owner]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [.github/workflows/db-backup.yml, scripts/backup/lib/commands.ts, scripts/backup/lib/context.ts, scripts/backup/lib/d1-backup.ts, scripts/backup/lib/d1-schema.ts, scripts/backup/lib/doctor.ts, scripts/backup/lib/pg-backup.ts, scripts/backup/lib/seal.ts, scripts/backup/lib/verdict.ts, scripts/backup/lib/plan.ts, scripts/backup/lib/workflow-guards.ts]
related_docs: [README.md, 01-post-incident-review.md, 02-root-cause-analysis.md, 03-dependency-assessment.md, 06-remediation-plan.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, defects, register]
---

# 04 — Defect register

> **TL;DR (non-technical):** Every known defect in the Primary Pipeline, in one register, with the
> evidence and the remediation for each. Until now, defects surfaced one production run at a time;
> this register identifies the rest in advance. Six rows each prevent a recovery point on their own;
> others make the results unreliable; and some parts of the pipeline have never executed for real,
> so they should be expected to contain defects not yet observed.

The review covered the runner (`scripts/backup/**`, `.github/workflows/db-backup.yml`) at
`da38ddf`, the unit tests' test doubles, the Supabase CLI and restore-image sources at the pinned
versions, and read-only live checks. Two independent code audits cross-checked it. Code stage names
are quoted as they appear (`doctor` = pre-flight diagnostics, `seal` = finalization;
[11](11-terminology-standard.md)).

**Identifiers.** `T` = a technical root cause that has already failed or is proven
([02](02-root-cause-analysis.md) §1). `L` = identified by the first review. `N` = identified by the
second review. Identifiers that describe the same defect share a row.

**Confidence:**

- **Certain**: proven by a live check, the tool's source or a production log.
- **Likely**: strong evidence; Pre-production Validation must confirm it.
- **Unproven**: the path has never executed for real, so its defects are unknown.
- **Resolved**: with the commit.

**Stage** refers to [06](06-remediation-plan.md).

## A. Prevents the next recovery point

| # | Defect | Location | Confidence | Remediation | Stage |
|---|---|---|---|---|---|
| T1 | **Output directories are never created** before wrangler, the Supabase CLI and age write into them: `plain/d1/`, `plain/postgres/`, `out/<run key>/data/` | Built at `context.ts:68,69,77`; written at `wrangler.ts:21`, `pg-backup.ts:181`, `age.ts:87`. The only `ensureDir` calls are `commands.ts:103,274,300,333`. `plain/` is deleted at `commands.ts:164` and `seal.ts:163`, so nothing creates it incidentally | Certain (runs 5, 6) | One `ensureDir` in the command that owns each path; test doubles stop creating directories | 2 |
| T2, L2, N3 | **D1 row counts and fingerprints use a compound `SELECT` with one term per table**; D1 allows 5. `madagascar-db` has 32 tables; `chatbot-kb` has exactly 5, so one more table breaks it as well | `countsSql` `d1-schema.ts:123-125`, `fingerprintSql` `:128-140`. **Three** remote call sites: `d1-backup.ts:122`, `:177`, and `:298` (the monthly live restore test; missed by the first review). `:232` runs on local SQLite and is unaffected | Certain (live test) | A single `SELECT` with one scalar subquery per table (no compound), or batches of at most 5. The D1 test double becomes Miniflare, which enforces the limit | 2 |
| T5, L1 | **Every PostgreSQL export will fail: the Supabase CLI switches to `postgres`** (`SET ROLE`), which the read-only export role is not permitted to do | `pg-backup.ts:169-183` runs `supabase db dump` five times; also the unverified `.temp/postgres-version` workaround at `:154-160` | Certain (CLI source; live grants) | Remove the Supabase CLI. Run `pg_dump` in the pinned `supabase/postgres` 17 image with explicit schemas (`public`, `supabase_migrations`) and no `--role`, identical to the Secondary Pipeline ([09](09-secondary-pipeline-specification.md)) | 2 |
| L3 | **PostgreSQL restore verification will stop at `auth.jwt()`**, and at any `storage` data | `pg-backup.ts:313-316` restores into a bare image with `ON_ERROR_STOP=1` | Certain in code; the failure itself Likely | A compatibility shim defining `auth.jwt()`; export only `public` and `supabase_migrations`, so `storage` never appears | 2 |
| L4, L16 | **`pg_dump` may be refused locks in schemas the role cannot use**; the CLI's data export would also include `cron.job` data | The CLI's schema list; `pg-backup.ts:172` excludes table data, not locks | Likely, only if the CLI were retained | L1's remediation (explicit schemas) removes both | 2 |
| N4 | **The D1 export depends on the Supabase CLI installation.** The `supabase cli` step has no `continue-on-error`, and the `d1` and `postgres` conditions carry an implicit `success()` | `db-backup.yml:104-108,121,137` | Certain in code | L1's remediation removes the step | 2 |

## B. Makes results unreliable

| # | Defect | Location | Confidence | Remediation | Stage |
|---|---|---|---|---|---|
| T4, L5 | **A failed step does not fail a pre-flight run** | `continue-on-error` at `db-backup.yml:101,113`; `evaluateRunnerTest` never reads exit codes (`verdict.ts:483-492`). `cf50a5c` records a pre-flight crash as `crashed` (`commands.ts:481-499`), for pre-flight diagnostics only | Certain (run 3) | Pass every step's `${{ steps.<id>.outcome }}` to the finalization stage; any `failure` fails the run. *Corrected 2026-09-25: the first review proposed reading `steps.jsonl`, which would not have detected runs 3 and 4 (the step record is written with exit 0 before the crash, `log.ts:242-254`, `commands.ts:242`). `JOB_STATUS` is no alternative: under `continue-on-error` it always reads `success`* | 2 |
| L6, N2 | **Checks with nothing to check report "pass"** | `checkIntegrity` passes whenever a restore-verification object exists (`verdict.ts:78-79,168-179`), and every command writes one even when nothing was restored (`commands.ts:288,354`; `d1-backup.ts:203-205`; `pg-backup.ts:269-271`). `checkRowCounts` and `checkFingerprints` report "pass", with text naming PostgreSQL, after a single D1 verification | Certain (runs 5 and 6) | Each check lists what it covered per store; a store without data reads "skipped", or "failed" where expected. Test: a run without a PostgreSQL export never reports a PostgreSQL pass | 2 |
| N1 | **The error code identifies the wrong stage.** A failed export still yields a restore-verification result (`{ok:false, problems:['no dump to drill']}`), so the verdict's "export failed" branch is unreachable and the first finding maps to `drill_failed`. The actual cause survives only in the manifest | `pg-backup.ts:269-271`; `commands.ts:351-354`; `verdict.ts:150-153`; `seal.ts:99-112`. Tested only with a hand-built `drill: null` (`test/runner/seal.test.ts:480-500`) | Certain (runs 4 to 6) | Skip restore verification when there is nothing to verify; branch on "no files", not "no verification object". Test with the object production actually produces | 2 |
| T7, L7 | **Export errors are silent until the verdict**; the summary line reports "0 rows" as normal | `d1-backup.ts:115-117,123-125,151-153,168-170,180-182`, summary `:187`; `pg-backup.ts:108-120,190-192`, summary `:246`. The logger records only thrown errors (`log.ts:232-237`) | Certain (run 5: the D1 limit error appears nowhere in the log) | Log every problem at `error` level when recorded; the summary reads "counts failed", not a number | 2 |
| L8 | **Pre-flight diagnostics verify reachability, not capability** | `doctor.ts:327-340` (the D1 check is `SELECT 1`) | Certain | Three real checks, seconds each: write and delete a file in each working directory; export one small table; `pg_dump --schema-only` of one table through the export's image and connection | 2 |

## C. Never executed for real (unknown defects)

On the record of six runs, each should be expected to contain at least one defect until
Pre-production Validation or the Secondary Pipeline exercises it.

| # | Path | Location | Potential failures (examples) | Confidence | Stage |
|---|---|---|---|---|---|
| L9 | PostgreSQL restore verification end to end | `pg-backup.ts:267-351` | The readiness loop; `docker cp` of the exports; `roles.sql` naming a role the image already has; the restored-fingerprint queries | Unproven | 2 |
| L10 | Finalization's data upload, checksums and manifest with real data | `seal.ts:296-316` onwards | Metadata limits; content types; upload ordering when a file is missing. *Run 6's 17 evidence uploads worked; the data path has never run* | Unproven (partly proven) | 2 |
| L11 | The monthly live restore test (`mode=drill`) | `d1-backup.ts` `realPathDrill`; `commands.ts:295-322` | Creating and deleting a D1 database through the API; `wrangler d1 execute --file` on the export; guaranteed deletion; **and N3's count query (certain)** | Unproven, one Certain | 4 |
| L12 | Verification runs (`mode=check`) | `plan.ts:189`; finalization's evidence-only path | Never dispatched | Unproven | 4 |
| L13 | Scheduling | cf-admin's Scheduler; the fallback schedule in `db-backup.yml` | *Partly disproved: run 6 shows the Scheduler's dispatch works.* The fallback schedule has never fired | Unproven (fallback only) | 5 |
| L14 | A recovery test by a person, from the archive bucket, with the offline recovery key | `docs/RESTORE.md` | Never performed; key custody and the procedure are untested | Unproven | 5 |

## D. Configuration and operations

| # | Defect | Location | Confidence | Remediation | Stage |
|---|---|---|---|---|---|
| T3 | The step-output name rule rejected `d1_ok` | `github.ts:33-35` | **Resolved** in `cf50a5c`; run 6's gate opened | — | — |
| T6 | **Authentication records (`auth.users`, 6; `auth.identities`, 12) are in no recovery point** | `sql/supabase/01_backup_reader.sql:43-49` (its own comment notes the grant does not take effect) | Certain | Owner decision RD-1; until then the manual baseline export ([10](10-sop-manual-baseline-export.md)) includes them | 0, 3 |
| N9 | **No confirmed copy of the archive encryption key outside Supabase.** The registry shows 0 offline-recovery-key confirmations and 0 reveals; the Vendor holds no copy | `backup:key-registry` | Certain | Owner and Vendor confirm their offline recovery keys | 0 |
| N6 | **The schedule and the fallback schedule are active**, so every scheduled run fails | `backup:config.schedule`; `db-backup.yml` cron `43 12 * * 1` | Certain (run 6) | Disable the schedule settings, then disable the workflow, in that order. *Commenting out the cron would fail CI (`workflow-guards.ts:195-198`); the fallback ignores the settings (`plan.ts:57`)* | 0 |
| N8 | **cf-admin's legacy export workflow is still scheduled** (Sundays 09:17 UTC, the same minute as cf-backup's full run) and holds no secrets | cf-admin `.github/workflows/backups.yml` | Certain (both its runs failed at the pre-flight) | Disable now; retire after the Secondary Pipeline passes (RD-8) | 0, 1 |
| L15 | **No configuration gate.** Runs 1 and 2 started with missing secrets and no key | A Worker pre-flight runs before dispatch (`src/backups/start.ts:38`), and no run is dispatched without a key (`src/tick/schedule.ts:321`), but nothing requires a passed pre-flight run | Certain (partly mitigated) | The console refuses a production run until the latest pre-flight run passed with the same configuration | 2 |
| N5 | **One failed check stops every store.** The default pre-flight policy is `halt` | `doctor.ts:599,707-716`; contradicts `db-backup.yml:8-10` | Certain | Owner decision RD-13 (default: per store) | 2 |
| N7 | **The runner's own `pg_dump` is version 16**; the server is 17 | GitHub's `ubuntu-24.04` image | Certain | Always run `pg_dump` from the pinned 17 image, never `/usr/bin` | 1, 2 |
| L17 | **GitHub minutes:** Pre-production Validation on every push would consume the Actions budget | — | Design | Run it only on runner changes, plus weekly; ceiling RD-7 | 2 |
| N10 | **Informal identifiers in code, console and evidence** (`doctor`, `seal`, `drill`, `tick`, "Runner test") | `scripts/backup/lib/pipeline.ts`; `src/ui/**`; `backup_runs.kind`, `error_code` | Certain | Nomenclature alignment (RD-14), after the Primary Pipeline passes and before the stabilization period | 2 |

## E. Summary

| Effect | Rows | Identifiers |
|---|---|---|
| Prevents the next recovery point | 6 | T1; T2, L2, N3; T5, L1; L3; L4, L16; N4 |
| Unreliable results | 5 | T4, L5; L6, N2; N1; T7, L7; L8 |
| Never executed for real | 6 | L9 to L14 |
| Configuration and operations | 10 (1 resolved) | T3; T6; N9; N6; N8; L15; N5; N7; L17; N10 |

## F. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | First code review of the runner and test doubles | L1 to L17 |
| 2026-09-25 | claude | Second, independent code audit at `da38ddf`; every claim re-read with current line numbers | L1 to L17 confirmed or corrected as marked; N1 to N8 added |
| 2026-09-25 | claude | D1 and Supabase read-only checks; run 6 log | T2, T5, T6, N6, N9 |
| 2026-09-25 | claude | cf-admin `backups.yml` and its runs | N8 |
| 2026-09-25 | claude | Terminology review ([11](11-terminology-standard.md)) | N10 added |

## G. Related

- [01-post-incident-review.md](01-post-incident-review.md): the runs in which these surfaced.
- [06-remediation-plan.md](06-remediation-plan.md): the stages that resolve them.
- [09-secondary-pipeline-specification.md](09-secondary-pipeline-specification.md): the export commands the Primary Pipeline converges on.

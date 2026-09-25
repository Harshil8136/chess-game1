---
title: "cf-backup remediation — 02 Root-cause analysis (technical, process, and definition of done)"
status: active
audience: [owner, ai, technical]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [.github/workflows/ci.yml, .github/workflows/db-backup.yml, scripts/backup/lib/doctor.ts, scripts/backup/lib/verdict.ts, test/runner/fakes.ts]
related_docs: [README.md, 01-post-incident-review.md, 04-defect-register.md, 05-options-analysis.md, 06-remediation-plan.md, 08-industry-practice-review.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, root-cause-analysis, process]
---

# 02 — Root-cause analysis

> **TL;DR (non-technical):** The code contains a small number of simple defects, such as never
> creating the directories it writes into, and they are straightforward to fix. The real question
> is how they reached production. Every test replaced the external tools with test doubles that
> were more permissive than the real tools, and nothing ran the real pipeline before production.
> One level deeper, work was accepted when its tests passed, never when a restorable recovery
> point existed. In ten days two export pipelines were built, and neither produced one.

## 1. Technical root causes

Each of these stopped a real run, or would stop the next one on its own. Evidence, remediation and
all other defects are in [04](04-defect-register.md).

| # | Defect | Location | Introduced | Detected by |
|---|---|---|---|---|
| T1 | Output directories are never created before external tools write into them: `plain/d1/`, `plain/postgres/`, `out/<run key>/data/` | Paths built at `scripts/backup/lib/context.ts:68,69,77`; the only `ensureDir` calls are `commands.ts:103,274,300,333` | First runner commits, 2026-09-23 | Runs 5 and 6 |
| T2 | D1 rejects a compound `SELECT` of more than 5 terms; the row-count and fingerprint queries use one term per table | `d1-schema.ts:123-125` and `:128-140`, called at `d1-backup.ts:122,177,298` | 2026-09-23 | Live test, 2026-09-25 |
| T3 | The step-output name rule rejected `d1_ok` | `github.ts:33-35` | 2026-09-23 | Run 4. **Resolved** in `cf50a5c` |
| T4 | A failed step does not fail a pre-flight run: `continue-on-error` plus a verdict that reads report files, not exit codes | `db-backup.yml:101,113`; `verdict.ts:483-492` | 2026-09-24 | Run 3, retrospectively |
| T5 | The Supabase CLI's export always issues `SET ROLE postgres`, which the read-only export role cannot | `pg-backup.ts:169-183` calls the CLI | 2026-09-23 | CLI source at v2.117.0; live grant check |
| T6 | The read-only export role cannot use schema `auth`, so authentication records are excluded | `sql/supabase/01_backup_reader.sql:43-49` | 2026-09-24 | Run 5 warnings; live check |
| T7 | Export errors are collected silently, and a summary line reports "0 rows" as normal | `d1-backup.ts:115-187`; `pg-backup.ts:108-120,190-192,246` | 2026-09-23 | Run 5 |

T1, T2 and T5 each prevent a recovery point on their own. T1 and T2 are proven in production or
live; T5 is proven by the CLI's source and the live grants, and has not failed yet only because T1
stops the export first.

## 2. Process root causes

### 2.1 P1 — Test doubles were more permissive than the real tools

Every external tool is replaced in unit tests by a test double written in this repository, and
each double does something the real tool does not:

| Test double | Behaviour | Real tool |
|---|---|---|
| wrangler (`test/runner/d1-backup.test.ts:20-23`) | Writes its export with `writeText`, which creates missing directories | `wrangler d1 export --output` does not |
| age (`test/runner/seal.test.ts:64`) | Same | `age -o` does not |
| Supabase CLI (`test/runner/pg.test.ts:107`) | Same; tests assert only the command line passed in (`:132-140`) | The CLI adds `--role postgres` inside its own script, invisible to the tests |
| D1 (`test/runner/fakes.ts:115`) | Plain SQLite, which allows 500 compound terms | D1 allows 5 |
| A failed export (`test/runner/seal.test.ts:480-500`) | A hand-built `drill: null` | Production never produces it (N1) |

As a result, 3,286 tests (`npm run verify`, 2026-09-25) passed on code that could not write a
single file on a real runner. A test that uses a test double proves only that the code matches the
double. No contract test checked the doubles against the real tools.

### 2.2 P2 — Production was the first integration test

- CI (`.github/workflows/ci.yml`) runs `npm run verify`: type checking, unit tests, build, audit. No
  job runs `scripts/backup/cli.ts` with the real wrangler, docker, `pg_dump` or age.
- There is no staging environment (owner decision, $0), and nothing replaced it.
- Each production run was therefore the first time a layer met reality. It failed on the first
  defect in that layer, and that failure masked the next: run 2 masked T3, T3 masked T1, and T1
  masks T2 and T5.

### 2.3 P3 — Pre-flight diagnostics check reachability, not capability

Pre-flight diagnostics passed in runs 5 and 6: "d1: reachable", "supabase: reachable",
"tools: ok", "disk-space: pass". The D1 check is `SELECT 1` (`doctor.ts:327-340`). None exports a
table, runs a real export, or writes into the directories the run will use.

### 2.4 P4 — Reviews examined diffs, not executions

Every task in the build ledger closes with "review Approved". Reviews compared code with the
specification. None executed the pipeline, so none could observe a real tool's behaviour with a
missing directory.

### 2.5 P5 — Features were built on an unproven core

Before the first attempted production run, effort went into the console, the diagnostics
screens, a pre-flight mode and a storage-layout change (84 files in one commit). Each touched the
runner without any means of executing it for real, which widened the untested surface.

### 2.6 P6 — Complexity out of proportion to the data

| Component | Size |
|---|---|
| Runner (`scripts/backup/**`) | 8,662 lines of code, 51 files |
| Worker and API (`src/**`, excluding UI) | about 25,300 lines |
| Console (`src/ui/**`) | about 17,500 lines, including CSS |
| Tests (`test/**`) | about 35,400 lines, 164 files |
| External programs invoked by the runner | wrangler, the Supabase CLI, docker, `psql` and `pg_dump` in docker, age, plus `tar`, `apt-get`, `npm ci` |
| **Data under protection** | **17 MB of PostgreSQL and 2.8 MB of D1** |

Comparable teams protect this volume with a workflow of 30 to 120 lines
([08](08-industry-practice-review.md) §2). The Supabase CLI alone adds a hidden `SET ROLE`, its own
image pull and its own file handling, and provides nothing that `pg_dump` in the pinned image does
not.

### 2.7 P7 — Failures reported as successes

Run 3 was reported as successful with crashed pre-flight diagnostics (T4). Run 5's report printed
three "pass" lines for checks with nothing to check, and run 6's printed "Postgres restored" with
no export (L6 / N2). Runs 4 to 6 are recorded as `drill_failed` when the export failed (N1). A
pipeline that can report success for a run that did nothing cannot be trusted when it works.

### 2.8 P8 — No gate between configuration and production

Runs 1 and 2 started while the token, the database secret and the key were missing. Pre-flight
diagnostics detected it, but because a production run could start at all, those runs count as
failures.

## 3. Underlying cause: the definition of done

P1 to P8 are accurate, and all are symptoms of one condition:

1. **Two export pipelines in ten days, no recovery point.**
   - cf-admin's legacy export workflow (`backups.yml`) was built on 09-15 and rebuilt on 09-22. It
     is soundly designed and already avoids T1, T5 and the restore-target gap: it creates its
     directories, runs `pg_dump` directly on `public`, and stubs `auth.jwt()` for its restore
     verification. **It never ran successfully, because its secrets were never configured in
     cf-admin** (both runs failed at its pre-flight).
   - cf-backup was built from 09-23 to 09-25, and has failed six times.
2. **"Done" meant code, not a recovery point.** Every task in both builds closed on "tests pass,
   review approved". None closed on "an encrypted recovery point is in the archive bucket and
   restores". The one outcome that proves a data-protection system works was never an acceptance
   criterion.
3. **The first production run came last**, after tens of thousands of lines. A successful run
   requires about 15 stages to be correct the first time they meet real tools. That is big-bang
   integration, and it fails exactly this way: one layer at a time, each failure masking the next.
4. **The highest-impact risk was not checked.** The key registry shows 0 offline-recovery-key
   confirmations and 0 reveals. If the Owner did not save the key when it was displayed once, its
   only copy is in Supabase Vault, inside the database the recovery points exist to protect.

The remediation is therefore not only "test the pipeline against real tools". It is: **produce one
real, verified, off-site recovery point first, by the smallest proven means, keep producing it, and
build everything else on top of a pipeline that already works.** The literature calls this a
minimum viable pipeline, termed a "walking skeleton" in the cited literature ([08](08-industry-practice-review.md) §4).

## 4. Corrective principles

| # | Principle | Addresses | Implemented in ([06](06-remediation-plan.md)) |
|---|---|---|---|
| 1 | A recovery point exists only once it is archived and has passed restore verification. Tests and reviews are not evidence of one | §3 | §2, principle 1 |
| 2 | A verified recovery point exists first, by the smallest proven path; features wait | §3, P5 | Stages 0 and 1; feature freeze (RD-4) |
| 3 | Every runner change is exercised by the real tools before production: Pre-production Validation | P1, P2, P4 | Stage 2 |
| 4 | Test doubles fail the way the real tools fail, proven by contract tests | P1 | Stage 2 |
| 5 | Fewer external programs: `pg_dump` in the pinned image instead of the Supabase CLI | P6, T5 | Stage 2 |
| 6 | Pre-flight diagnostics test capability: a real write, a real one-table export, a real one-table dump | P3 | Stage 2 |
| 7 | Accurate results: a failed step fails the run; no pass without something checked; the error code identifies the failing stage | P7, T4 | Stage 2 |
| 8 | A configuration gate: no production run until the latest pre-flight run passed | P8 | Stage 2 |
| 9 | The archive encryption key is verified before anything else | §3 item 4 | Stage 0 |

## 5. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Code read at `da38ddf`, two independent audits | T1 to T7 and the test doubles as cited |
| 2026-09-25 | claude | `npm run verify` | 142 test files, 3,286 tests, all passing on code that cannot produce a recovery point |
| 2026-09-25 | claude | Line counts (`wc -l`) of `scripts/backup/**`, `src/**`, `test/**` | §2.6 |
| 2026-09-25 | claude | cf-admin `backups.yml` read in full; its two runs (35012389113, 35580420378) | Both failed at the pre-flight: secrets not configured |
| 2026-09-25 | claude | D1 read-only: `backup:key-registry` | 1 key; `reveals` empty; `kitConfirmations` empty |

## 6. Related

- [01-post-incident-review.md](01-post-incident-review.md): the runs.
- [04-defect-register.md](04-defect-register.md): every defect, with its remediation.
- [08-industry-practice-review.md](08-industry-practice-review.md): the practices behind §4.

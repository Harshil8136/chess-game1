---
title: "cf-backup recovery — 02 Root causes (technical, process, and what \"done\" meant)"
status: active
audience: [owner, ai, technical]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [.github/workflows/ci.yml, .github/workflows/db-backup.yml, scripts/backup/lib/doctor.ts, scripts/backup/lib/verdict.ts, test/runner/fakes.ts]
related_docs: [README.md, 01-incident-postmortem.md, 04-defect-register.md, 05-options.md, 06-plan.md, 08-how-others-do-it.md]
tags: [cf-backup, recovery, root-cause, process]
---

# 02 — Root causes

> **TL;DR (non-technical):** The code had a handful of simple mistakes, such as never creating
> the folders it writes into. Those are easy to fix. The real problem is how they got through:
> every test used stand-ins for the outside tools that were more forgiving than the real ones,
> and nothing ran the real pipeline before production did. One level deeper, work was counted
> as done when its tests passed, never when a backup file existed that could be restored. In ten
> days, two backup systems were built and neither produced one file.

## 1. Technical root causes

Each of these stopped a real run, or would stop the next one on its own. Full detail, fixes
and the rest of the defects are in [04](04-defect-register.md).

| # | Defect | Where | Since | Found by |
|---|---|---|---|---|
| T1 | Output folders are never created before outside tools write into them: `plain/d1/`, `plain/postgres/`, `out/<run key>/data/` | Paths built at `scripts/backup/lib/context.ts:68,69,77`; the only `ensureDir` calls are `commands.ts:103,274,300,333` | First runner commits, 2026-09-23 | Runs 5 and 6 |
| T2 | D1 rejects a `UNION ALL` of more than 5 parts; the count and fingerprint queries use one part per table | `d1-schema.ts:123-125` and `:128-140`, called at `d1-backup.ts:122,177,298` | 2026-09-23 | Live test, 2026-09-25 |
| T3 | The step-output name rule rejected `d1_ok` | `github.ts:33-35` | 2026-09-23 | Run 4. **Fixed** in `cf50a5c` |
| T4 | A crashed step does not fail a runner test: `continue-on-error` plus a verdict that reads report files, not exit codes | `db-backup.yml:101,113`; `verdict.ts:483-492` | 2026-09-24 | Run 3, in hindsight |
| T5 | The Supabase CLI's dump always runs `SET ROLE postgres`; the backup role cannot | `pg-backup.ts:169-183` calls the CLI | 2026-09-23 | CLI source at v2.117.0; live role check |
| T6 | The backup role cannot use schema `auth`, so sign-in accounts are skipped | `sql/supabase/01_backup_reader.sql:43-49` | 2026-09-24 | Run 5 warnings; live check |
| T7 | Export errors are collected silently, and a summary line reports "0 rows" as if normal | `d1-backup.ts:115-187`; `pg-backup.ts:108-120,190-192,246` | 2026-09-23 | Run 5 |

T1, T2 and T5 each stop a real backup on their own. T1 and T2 are proven in production or live.
T5 is proven by the CLI's source and the live grants; it has not failed yet only because T1
stops the dump first.

## 2. Process root causes

### 2.1 P1 — The fakes are kinder than the real tools

Every outside tool is replaced in tests by a fake written in this repository, and each fake
does something the real tool does not:

| Fake | Does | The real tool |
|---|---|---|
| wrangler (`test/runner/d1-backup.test.ts:20-23`) | writes its export with our own `writeText`, which creates missing folders | `wrangler d1 export --output` does not |
| age (`test/runner/seal.test.ts:64`) | the same | `age -o` does not |
| Supabase CLI (`test/runner/pg.test.ts:107`) | the same, and the tests check only the command line we pass (`:132-140`) | the CLI adds `--role postgres` inside its own script, where no test can see it |
| D1 (`test/runner/fakes.ts:115`) | plain SQLite, which allows 500 `UNION ALL` parts | D1 allows 5 |
| A failed dump (`test/runner/seal.test.ts:480-500`) | a hand-built `drill: null` | production never produces it (N1) |

So 3,286 tests (in `npm run verify`, 2026-09-25) passed on code that could not write one file on a
real runner. A test that uses a fake proves only that our code matches the fake.

### 2.2 P2 — Production was the first integration test

- CI (`.github/workflows/ci.yml`) runs `npm run verify`: typecheck, unit tests, build, audit. No
  job runs `scripts/backup/cli.ts` with real wrangler, docker, `pg_dump` or age.
- There is no staging (owner decision, $0), and nothing replaced it.
- So each real run was the first time a layer met reality. It failed on the first defect in that
  layer, and that failure hid the next: run 2 hid T3, T3 hid T1, and T1 hides T2 and T5.

### 2.3 P3 — The doctor checks reachability, not the ability to back up

The doctor's checks passed in runs 5 and 6: "d1: reachable", "supabase: reachable", "tools: ok",
"disk-space: pass". The D1 check is `SELECT 1` (`doctor.ts:327-340`). None of them exports one
table, runs one real dump, or writes into the folders the run will use.

### 2.4 P4 — Reviews read diffs, not runs

Every task in the build ledger ends "review Approved". The reviews compared code with the spec.
None ran the pipeline, and none could have seen what a real tool does with a missing folder.

### 2.5 P5 — Features were built on a core that had never worked

In the days before the first attempted backup, the effort went into the console, the
diagnostics screens, a runner-test mode and a storage-layout change (84 files in one commit).
Each touched the runner without any way to run it for real, which widened the untested surface.

### 2.6 P6 — Too many moving parts for the job

| Part | Size |
|---|---|
| Runner (`scripts/backup/**`) | 8,662 lines of code, 51 files |
| Worker and API (`src/**`, not UI) | about 25,300 lines |
| Console (`src/ui/**`) | about 17,500 lines, CSS included |
| Tests (`test/**`) | about 35,400 lines, 164 files |
| Outside programs the runner starts | wrangler, the Supabase CLI, docker, `psql`/`pg_dump` in docker, age, plus `tar`, `apt-get`, `npm ci` |
| **The data being protected** | **17 MB of Postgres and 2.8 MB of D1** |

Small teams protect that much data with a workflow of 30 to 120 lines
([08](08-how-others-do-it.md) §2). The Supabase CLI alone adds a hidden `SET ROLE`, its own image
pull and its own file handling, and gives nothing `pg_dump` in the pinned image cannot.

### 2.7 P7 — Failures that look like passes

Run 3 was reported as a success with a crashed doctor (T4). Run 5's report printed three "pass"
lines for checks with nothing to check, and run 6's printed "Postgres restored" with no dump
(L6 / N2). Runs 4 to 6 are recorded as `drill_failed` when the export or dump failed (N1). A
pipeline that can report a pass for a run that did nothing cannot be trusted on the days it works.

### 2.8 P8 — No gate between "being set up" and "running for real"

Runs 1 and 2 started while the token, the database secret and the key were missing. The doctor
caught it, but because a real run could start at all, those runs count as failures.

## 3. The deeper cause: what "done" meant

P1 to P8 are true, and all of them are symptoms of one thing. The record shows it:

1. **Two backup systems in ten days, zero backup files.**
   - cf-admin's `backups.yml` was built on 09-15 and rebuilt on 09-22. It is well designed and it
     already avoids T1, T5 and the drill-image problem: it creates its folders, runs `pg_dump`
     directly on `public`, and stubs `auth.jwt()` for its drill. **It never ran, because its
     secrets were never added to cf-admin** (both runs failed at its pre-flight).
   - cf-backup was built from 09-23 to 09-25, and it has failed six times.
2. **"Done" meant code, not a backup.** Every task in both builds closed on "tests pass, review
   approved". None closed on "an encrypted file is in the bucket, and it restores". The one thing
   that proves a backup system works was never an acceptance test for any task.
3. **The first real run came last**, after tens of thousands of lines. A green run needs about 15
   stages to be right the first time they meet real tools. That is big-bang integration, and it
   fails exactly this way: one layer at a time, each failure hiding the next.
4. **The riskiest thing was not checked.** The key registry shows 0 recovery-kit confirmations
   and 0 reveals. If the owner did not save the key when it was shown once, its only copy is in
   Supabase Vault, inside the database the backups exist to protect.

The fix is therefore not only "test the pipeline for real". It is: **make one real, restorable,
off-site backup exist first, by the smallest proven means, keep it running, and build everything
else on top of a backup that already works.** Practitioners call that a walking skeleton
([08](08-how-others-do-it.md) §4).

## 4. What must change so this does not repeat

| # | Rule | Answers | Where the plan does it |
|---|---|---|---|
| 1 | A backup exists only as a file in storage that has been restored. Tests and reviews are not evidence that one exists | §3 | [06](06-plan.md) §2, rule 1 |
| 2 | A real backup exists first, by the smallest proven path; features wait | §3, P5 | Stages 0 and 1; freeze (RD-4) |
| 3 | The real tools see every runner change before production: a rehearsal job | P1, P2, P4 | Stage 2 |
| 4 | Fakes fail the way the real tools fail, and a contract test proves it | P1 | Stage 2 |
| 5 | Fewer programs: `pg_dump` in the pinned image instead of the Supabase CLI | P6, T5 | Stage 2 |
| 6 | The doctor does the work: a real write, a real one-table export, a real one-table dump | P3 | Stage 2 |
| 7 | Results tell the truth: a failed step fails the run; no pass without something checked; the error code names the step | P7, T4 | Stage 2 |
| 8 | A setup gate: no real run until the latest runner test passed | P8 | Stage 2 |
| 9 | The key is checked before anything else | §3 item 4 | Stage 0 |

## 5. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Code read at `da38ddf`, two independent audits | T1 to T7 and the fakes as cited |
| 2026-09-25 | claude | `npm run verify` | 142 test files, 3,286 tests, all green on code that cannot back up |
| 2026-09-25 | claude | Line counts (`wc -l`) of `scripts/backup/**`, `src/**`, `test/**` | As in §2.6 |
| 2026-09-25 | claude | cf-admin `backups.yml` read in full; its two runs (35012389113, 35580420378) | Both failed at the pre-flight: secrets not set |
| 2026-09-25 | claude | D1 read-only: `backup:key-registry` | 1 key; `reveals` empty; `kitConfirmations` empty |

## 6. Related

- [01-incident-postmortem.md](01-incident-postmortem.md): the runs.
- [04-defect-register.md](04-defect-register.md): every defect, with its fix.
- [08-how-others-do-it.md](08-how-others-do-it.md): the practices behind §4.

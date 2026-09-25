# 02: Root causes

Two kinds: the technical causes of each failure, and the process causes that let those defects
reach production and come out one run at a time. No excuses are offered here. Each cause
names the evidence.

## Technical root causes

| # | Defect | Where | Since | Found by |
|---|---|---|---|---|
| T1 | Output folders are never created before outside tools write into them: `plain/d1/`, `plain/postgres/`, `out/<run key>/data/` | `context.ts:68-77` builds the paths; nothing calls `ensureDir` on them (`commands.ts` creates only `root`, `wrangler-cwd`, `supabase-cwd`) | first runner commits, 2026-09-23 | run 5 |
| T2 | D1 rejects a `UNION ALL` of more than 5 parts; the count and fingerprint queries use one part per table | `d1-schema.ts:123-125`, `:128-139` | 2026-09-23 | read-only live test, 2026-09-25 |
| T3 | Step-output name rule rejected `d1_ok` | `github.ts:34` (fixed in cf50a5c) | 2026-09-23 | run 4 |
| T4 | A crashed step does not fail a runner test: `continue-on-error` plus a verdict that reads report files, not exit codes | `db-backup.yml:101,113`; `verdict.ts:483-491` | 2026-09-24 | run 3 (in hindsight) |
| T5 | The Supabase CLI's dump always runs `SET ROLE postgres`; the backup role cannot | `pg-backup.ts:169-181` calls the CLI; see [03](03-reality-check.md) | 2026-09-23 | CLI source + live role check, 2026-09-25 |
| T6 | The backup role cannot use schema `auth`, so sign-in accounts are skipped | `sql/supabase/01_backup_reader.sql:44-49` | 2026-09-24 | run 5 warnings |
| T7 | Errors from the export are collected silently and a summary line reports "0 rows" as if normal | `d1-backup.ts:116-152`, `:187` | 2026-09-23 | run 5 |

T1, T2 and T5 each stop a real backup on their own. T1 and T2 have been proven in production or
live. T5 is proven by the CLI's source and the live role grants. It has not failed yet only
because T1 stopped the dump first.

## Process root causes

### P1. The fakes are kinder than the real tools

Every external tool is replaced in tests by a fake written in this repository, and each fake does
something the real tool does not:

- The fake wrangler writes its export with our own `writeText`, which creates missing folders
  (`test/runner/d1-backup.test.ts:20-23`). The real `wrangler d1 export --output` does not.
- The fake age writes its output the same way (`test/runner/seal.test.ts:64`). The real
  `age -o` does not.
- The fake Supabase CLI writes the `-f` file the same way (`test/runner/pg.test.ts:107`). The real
  CLI does not.
- The fake D1 is plain SQLite (`test/runner/fakes.ts:115`), which allows 500 `UNION ALL` parts.
  The real D1 allows 5.
- The Supabase CLI tests check the command line we pass (`pg.test.ts:132-140`), never what the CLI
  does with it. The CLI adds `--role postgres` inside its own script, where no test can see it.

So about 3,300 tests (437 in the runner alone) passed on code that could not write one file on a
real runner. A test that uses a fake shows only that our code matches the fake. Nothing checked
that the fakes matched the real tools.

### P2. Production was the first integration test

- CI (`.github/workflows/ci.yml`) runs `npm run verify`: typecheck, unit tests, build, audit. No
  job runs `scripts/backup/cli.ts` with real wrangler, the real Supabase CLI, docker or age.
- There is no staging environment (owner decision, $0). Nothing replaced it.
- So each real run was the first time a layer of code met reality. It failed on the first defect
  in that layer, and that failure hid the next layer: run 2 hid T3, T3 hid T1, and T1 hid T2 and
  T5. The owner saw this as a new bug on every run, and it was: the defects were all there
  from the start and came out one at a time.

### P3. The doctor checks that things are reachable, not that the work can be done

The doctor's 20 checks passed in run 5: "d1: reachable", "supabase: reachable", "tools: ok",
"disk-space: pass". None of them exports one table to disk, runs one real dump, or writes into the
folders the run will use. A green doctor meant the credentials worked. It did not mean a backup
could be made, yet it read as if it did.

### P4. Reviews read diffs, not runs

Every task in the build ledger ends "review Approved". The reviews compared code with the spec.
None ran the pipeline, and none could have seen what a real tool does with a missing folder or what
D1 does with 32 `UNION ALL` parts. Reviewing a diff cannot find defects that only exist where the
code meets another program.

### P5. Work went into features while the core had never worked

In the days before the first attempted backup, the effort went into the console, the diagnostics
screens, a runner test mode and a storage-layout change (Stage 4: 84 files changed in one commit),
plus integrating another tool's uncommitted UI work. All of it sits on a pipeline that had never
produced one backup. Each of those changes touched the runner (paths, layout, verdicts) without any
way to run it for real, which widened the untested surface.

### P6. Too many moving parts for the job

About 8,900 lines of runner code (`scripts/backup/**`), five outside programs (wrangler, the
Supabase CLI, docker, psql, age), a hand-written S3 signer, a heartbeat daemon, live log shipping
and a usage meter. The job is to back up three small D1 databases (the largest is about 16 MB) and
one 17 MB Postgres database. Each extra part is one more place to meet reality for the first time.
The Supabase CLI alone adds a hidden `SET ROLE`, its own docker image pull and its own file
handling, and gives nothing that `pg_dump` from the image we already pull cannot do.

### P7. Failures that look like passes

Run 3 was reported as success with a crashed doctor (T4). Run 5's report printed three "pass"
lines for checks that had nothing to check (L6 in [04](04-latent-defects.md)). A pipeline that can
report a pass for a run that did nothing cannot be trusted, even on the days it really works.

### P8. No gate between "being set up" and "running for real"

Runs 1 and 2 were started while the token, the database secret and the key were missing. The
doctor caught this. But because a real run could be started at all, those runs count as failures
and add noise to the record.

## What must change so this does not repeat

1. **Real tools in CI:** a rehearsal job that runs the real commands with the real programs
   against test resources, on every change to the runner (answers P1, P2, P4).
2. **Fewer programs:** drop the Supabase CLI from the backup path and call `pg_dump` directly
   (answers P6 and T5).
3. **The doctor does the work:** a small real write into each folder, one real table export and a
   one-table dump, not only reachability checks (answers P3).
4. **Truthful results:** any step that exits with an error fails the run; a check with nothing to
   check reads "skipped", never "pass" (answers P7, T4).
5. **A freeze:** no feature work on cf-backup until the definition of done in
   [06](06-plan.md) is met (answers P5).

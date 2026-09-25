# 06: The plan

> **Replaced where they differ by [10-robust-plan.md](10-robust-plan.md)** (second review,
> 2026-09-25). Its rehearsal job and fixes carry on inside 10's Stage 2.

Recommended path D from [05](05-options.md). Every phase ends with evidence (a run link or a file
in the bucket), never with "the tests pass".

## Ground rules for all phases

1. **No real backup is dispatched until Phase 1's rehearsal is green.** The Monday fallback cron
   and the cf-admin daily dispatch stay paused until then (the fallback cron is commented out in
   the same commit as Phase 0).
2. **Every change to the runner lands only with a green rehearsal run** linked in the commit
   message.
3. **Feature freeze on cf-backup** (console, diagnostics, layout) until "done" is met, subject to
   decision 4 in [07](07-decisions-for-owner.md).
4. **Fakes must fail like the real thing.** Any fake touched in these phases is changed to refuse
   what the real program refuses: a missing folder, more than 5 `UNION ALL` parts on D1, a `--role`
   the connecting role cannot take.
5. A failure found by the rehearsal is fixed there. It does not count against production.

## Phase 0: the rehearsal job (1 to 2 days)

**Tasks**

1. Create the test resources (decision 2): a test D1 database, a test bucket with no locks, and
   repository secrets and variables for them. No production secret is used by the rehearsal.
2. Add `.github/workflows/backup-rehearsal.yml`. One job on ubuntu-24.04. It runs on changes to
   `scripts/backup/**`, `src/backups/**`, `sql/supabase/**` and `db-backup.yml`, weekly, and by
   hand.
3. The job seeds the test D1 database (more than 5 tables, a full-text table, some rows), starts
   the pinned `supabase/postgres` container and loads the schema-only fixture of the live `public`
   schema plus sample rows, and creates a throwaway age key pair.
4. It runs the **same commands as production** (`plan`, `tools`, `doctor`, `d1`, `postgres`,
   `seal`), with the targets swapped by environment only.
5. Then it checks what production never checked: the bucket holds every expected data file; each
   file **decrypts** with the throwaway key; a restore of the decrypted files (node:sqlite for D1, a
   fresh container for Postgres) matches the manifest's row counts.
6. It fails if any step exits with an error (it does not rely on the pipeline's own verdict).

**Acceptance:** the rehearsal runs and is **red for the known defects** (the missing folders, L1,
L2, L3). A rehearsal that passes on today's code would prove the rehearsal is wrong.

**Owner checkpoint 0:** decisions 2 and 4 made; the test resources exist.

## Phase 1: first real backup (about 1 day after Phase 0)

**Tasks**, each landing with a rehearsal run:

1. Create `plain/d1/`, `plain/postgres/` and `out/<run key>/data/` before use (one `ensureDir`
   each, in the command that owns the path). The fakes stop creating folders.
2. D1 counts and fingerprints in groups of at most 5 (L2). The fake D1 enforces the limit.
3. Postgres without the Supabase CLI (L1, L4): `pg_dump` and `pg_dumpall --roles-only` in the
   pinned image, with explicit schemas and no `--role`. Remove the `supabase cli` step from
   `db-backup.yml` and update `docs/OWNER-SETUP.md`.
4. A drill shim for `auth.jwt()` and whatever else the rehearsal finds missing in the bare image
   (L3).
5. Truthful verdicts (L5, L6), errors logged as they happen (L7), and the doctor's three real
   checks (L8).
6. Resume dispatching: owner runs **one runner test**, then **one full backup** by hand.

**Acceptance:**

- Rehearsal green twice in a row on `main`.
- One real full backup with verdict *ok* or *warning*. The only warning allowed is "auth.users
  not in this backup" until Phase 2.
- The bucket holds the run's 10 data files, the manifest and the checksums. The artifact copy
  exists.
- The run's report has no "pass" for a store that did not run.

**Owner checkpoint 1:** the owner opens the run in the console and sees the files in the bucket.
From here, the daily schedule is on.

## Phase 2: sign-in accounts (half a day plus one SQL run by the owner)

**Tasks** (for the default in decision 1):

1. `sql/supabase/04_backup_auth_export.sql`: a schema `backup_export` owned by `postgres`, with
   read-only views over `auth.users` and `auth.identities` (and any other `auth` table the owner
   chooses). `SELECT` on them goes to the backup role only. The Vault stays refused; the doctor
   keeps proving it.
2. The Postgres step exports those views as `COPY` data into a fourth plain file
   (`auth-export.sql`), encrypted like the others.
3. The drill and the rehearsal restore that file into the base `auth.users` and `auth.identities`
   of a Supabase-shaped target. The restore guide gains a section on loading it into a new
   Supabase project (after its Auth service has created the tables).

**Acceptance:** the rehearsal restores sign-in accounts. The next real backup has no `auth.users`
warning, and its manifest shows 6 users (or today's number).

**Owner checkpoint 2:** the owner runs the SQL file once in the SQL editor.

## Phase 3: the drill leaves the backup run (1 to 2 days)

**Tasks**

1. The daily run keeps only: plan, tools, doctor, D1 export, Postgres dump, seal (encrypt, upload,
   manifest). No container is started on a daily run.
2. A weekly drill run (a new `mode`, or `drill` redefined) **downloads the latest full backup from
   the bucket**, checks every file against the manifest and checksums, and restores it (D1 into
   node:sqlite, Postgres into the pinned image with the shim). With decision 3's default, the
   restore uses the plain files re-exported in the same run, and the downloaded ciphertext is
   verified by header, size and checksum. With the drill key option, it decrypts the downloaded
   files.
3. The monthly real-path D1 drill (a throwaway D1 database) moves into the weekly drill's first run
   of each month.

**Acceptance:** one green weekly drill, one green `check` run and one green monthly real-path
drill, all started by the schedule where they have one.

## Phase 4: soak and the human restore (30 calendar days, about 1 hour of owner time)

1. The daily schedule runs untouched. Any red run is fixed first in the rehearsal, then in
   production. The count of consecutive greens starts again.
2. After 7 consecutive scheduled green daily backups, the owner does **one real restore by hand**,
   following `docs/RESTORE.md` with the recovery kit, on a machine other than the runner. The
   target is a scratch place (local SQLite files for D1, a local Postgres container). The row
   counts must match the manifest for all four stores, sign-in accounts included. Any step in the
   guide that is wrong or unclear is fixed the same day.

## Definition of done

All true at the same time:

1. The rehearsal job is a required check on the runner paths and is green.
2. 7 consecutive **scheduled** daily backups green (not started by hand).
3. One weekly drill, one `check` run and one monthly real-path D1 drill green.
4. One real human restore from the bucket, with the recovery kit, matching the manifest, sign-in
   accounts included.
5. 30 days without a missed scheduled backup (the dead-man workflow, `tick-deadman.yml`, stays
   silent).
6. `docs/RESTORE.md` and `docs/OWNER-SETUP.md` updated to what was actually done.

After done, the feature freeze lifts. The rehearsal stays a required check permanently.

## Cost check (GitHub minutes a month, estimates to be replaced by measured values)

| Item | Runs | Minutes each | Total |
|---|---|---|---|
| Daily backup (no drill) | 30 | 3 | 90 |
| Weekly drill | 4 to 5 | 5 | 25 |
| Rehearsal (runner changes plus weekly) | 20 to 30 | 5 | 100 to 150 |
| Fallback, runner tests, check | about 6 | 2 | 12 |
| **Total** | | | **about 230 to 280 of the 2,000 shared** |

The console's usage screen already records runner minutes. Phase 1 compares this table with the
measured figures, and the plan is changed if the total goes over 400.

## Reporting progress

- One line per phase in the **Status** table below, with the run links. It is updated in the same
  commit that completes the phase, and published with this folder.
- A red rehearsal or a red real run gets an entry in the build log
  (`docs/DIAGNOSTICS-PREFLIGHT-STORAGE.md`): the log line, the cause, the fix commit.
- Nothing is reported as fixed without a green run link.

## Status

| Phase | State | Evidence |
|---|---|---|
| 0 Rehearsal job | not started | |
| 1 First real backup | not started | |
| 2 Sign-in accounts | waiting on decision 1 | |
| 3 Drill separated | not started | |
| 4 Soak and human restore | not started | |

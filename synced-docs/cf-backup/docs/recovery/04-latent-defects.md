# 04: Latent defects (found by review, not yet failed in a run)

Until now, defects came out one real run at a time. This list finds the rest now. It comes from
reading the runner (`scripts/backup/**`, `.github/workflows/db-backup.yml`), the tests' fakes,
the Supabase CLI and drill image sources at the pinned versions, and read-only live checks.

**Confidence:** *Certain* means proven by a live check, source code or a real log. *Likely* means
strong evidence, but it needs the rehearsal job to confirm. *Unproven* means the code path has
never run for real, so its defects are unknown.

## Blocks the next backup even after the three folder fixes

### L1. Every Postgres dump will fail: the Supabase CLI switches to `postgres`. Certain.

- **Where:** `scripts/backup/lib/pg-backup.ts:169-181` runs `supabase db dump` five times.
- **Why:** the CLI's scripts run `pg_dump … --role "postgres"` (and `pg_dumpall … --role
  "postgres"` for roles). After connecting, `pg_dump` runs `SET ROLE postgres`. The backup role is
  not a member of `postgres` (live check), so the first dump fails with "permission denied to set
  role". The tests never see this, because the fake CLI receives our command line and never runs
  the CLI's script.
- **Fix:** drop the Supabase CLI from the backup path. Run `pg_dump` and `pg_dumpall --roles-only`
  directly in the pinned `supabase/postgres` image that tools already pulls (the doctor already
  runs `psql` this way). Pass no `--role`, list schemas explicitly (`--schema public --schema
  supabase_migrations`), and keep `--quote-all-identifiers`, the data-only `--use-copy` equivalent
  (the default COPY format), and the `session_replication_role = replica` header. This also removes
  the CLI's own image pull and the unverified `.temp/postgres-version` trick
  (`pg-backup.ts:153-159`).

### L2. D1 counts and fingerprints fail for any database with more than 5 tables. Certain.

- **Where:** `scripts/backup/lib/d1-schema.ts:123-125` (`countsSql`) and `:128-139`
  (`fingerprintSql`), used by `d1-backup.ts:122` and `:177`.
- **Why:** D1 allows at most 5 `UNION ALL` parts (live check). `madagascar-db` has 32 tables.
  `chatbot-kb` has exactly 5 today, so one new table there breaks it too.
- **Fix:** send the queries in groups of at most 5 parts (or one query per table, still cheap at
  this size). Add a test with a fake D1 that enforces the 5-part limit.

### L3. The Postgres drill will stop at `auth.jwt()`, and at any `storage` data. Likely.

- **Where:** `scripts/backup/lib/pg-backup.ts:303-327` restores `schema.sql` and `data.sql`
  into a bare `supabase/postgres` container with `ON_ERROR_STOP=1`.
- **Why:** one live public policy uses `auth.jwt()`, which the bare image does not define (it
  defines only `auth.uid()`, `auth.role()` and `auth.email()`). `CREATE POLICY` needs the function
  to exist, so the schema restore stops there. Any `COPY storage.*` block fails as well, because
  the image creates no storage tables. With the CLI's data dump, `storage.buckets` and
  `storage.objects` are included (both empty, but `pg_dump` still writes a `COPY` block).
- **Fix:** before `schema.sql`, the drill loads a small "platform shim" kept in the repository
  (`CREATE FUNCTION auth.jwt() …` returning the claim JSON, plus any other missing Supabase
  objects the rehearsal finds). Dump only `public` and `supabase_migrations` (L1's fix), so
  `storage` never appears. Sign-in accounts get their own restore check (Phase 2).

### L4. `pg_dump` may be refused table locks in schemas the role cannot use. Likely, if the CLI were kept.

- **Where:** the CLI's data dump includes `auth`, `storage` and `cron`. The runner passes `-x`
  (exclude table *data*) for the 37 unreadable tables (`pg-backup.ts:172`).
- **Why:** `pg_dump` takes a share lock on every table in the schemas it covers. `-x` drops only
  the data, not the lock. Locking needs a privilege on the table and `USAGE` on its schema, which
  the role lacks for `auth`. The 4 unreadable sequences can fail the same way.
- **Fix:** L1's fix (explicit `--schema public --schema supabase_migrations`) avoids this
  entirely. The rehearsal job proves it.

## Makes results untrustworthy

### L5. A step that crashes does not fail a runner test. Certain (run 3).

- **Where:** `db-backup.yml:101,113` (`continue-on-error: true` on tools and doctor);
  `scripts/backup/lib/verdict.ts:483-491` (`evaluateRunnerTest` never reads step exit codes).
- **Fix:** seal reads `steps.jsonl` (it already records `exitCode` for every step), and any step
  that ended with an error is a *failed* finding in every mode.

### L6. Checks with nothing to check print "pass". Certain (run 5 report).

- **Where:** `verdict.ts:168-179` (`checkIntegrity` prints "Postgres restored with ON_ERROR_STOP"
  whenever *any* D1 drill ran); `checkRowCounts` (`:181`) and `checkFingerprints` (`:225`) pass
  when their input is empty.
- **Fix:** each check lists what it covered per store. A store with no data reads *skipped* (or
  *failed* when the store was expected). Add a test: a run with no Postgres dump must never print
  a Postgres pass.

### L7. Export errors are silent until the verdict. Certain.

- **Where:** `d1-backup.ts:116-184` pushes errors into `problems[]` without logging them; the
  summary line at `:187` reports "0 rows" as if normal. `pg-backup.ts` does the same.
- **Why it matters:** the D1 5-part error (L2) appears nowhere in run 5's log.
- **Fix:** log every problem at `error` level the moment it is recorded; the summary line says
  "counts failed" instead of a number when counts are missing.

### L8. The doctor proves reachability, not the ability to back up. Certain.

- **Where:** `scripts/backup/lib/doctor.ts` (the `d1:*`, `supabase`, `tools` and `disk-space`
  checks).
- **Fix:** add three real checks that cost seconds: write and delete a file in each work folder;
  export one small D1 table through the real API path; `pg_dump --schema-only` one table through
  the same image and URL the dump uses.

## Never run for real: unknown defects

None of these paths has ever run on a real runner against real data. By the evidence of the last
five runs, each one should be expected to hold at least one defect until the rehearsal job runs it.

| # | Path | Where | What could break (examples, not a full list) |
|---|---|---|---|
| L9 | The Postgres drill end to end | `pg-backup.ts:267-351` | the container readiness loop; `docker cp` of the dump files; `roles.sql` from `pg_dumpall` hitting a role the image already has; the restored-fingerprint queries |
| L10 | Seal's data upload, checksums and manifest with real data files | `seal.ts:298-770` | object metadata limits; content types; the upload order when a data file is missing |
| L11 | The monthly real-path D1 drill (`mode=drill`) | `d1-backup.ts` `realPathDrill`; `commands.ts:295-322` | creating and deleting a D1 database through the API; `wrangler d1 execute --file` on a 16 MB export; the always-delete on failure |
| L12 | `mode=check` | `plan.ts:189`, `seal.ts` evidence-only path | never dispatched |
| L13 | The schedule: cf-admin's tick dispatching the daily backup, and the Monday fallback cron | `db-backup.yml` `schedule`; cf-admin tick | every real run so far was started by hand |
| L14 | A restore by a person, from the bucket, with the recovery kit | `docs/RESTORE.md` | never done; the age private key custody and the steps are untested |

## Setup and operations

- **L15. No setup gate.** Runs 1 and 2 were dispatched with missing secrets and no key. *Fix:*
  the console refuses to dispatch a real backup until the latest runner test (with L5 fixed) passed
  with the same configuration.
- **L16. The data dump would include `cron.job` and `cron.job_run_details`** (readable, 0 jobs
  today) if the CLI were kept. With L1's explicit schemas they are out. If `pg_cron` jobs start to
  matter, they are schema-level objects to record separately.
- **L17. Minutes.** A rehearsal on every push to `main` would use the Actions budget quickly. *Fix:*
  run it only when runner paths change (`scripts/backup/**`, `src/backups/**`,
  `.github/workflows/db-backup.yml`, `sql/supabase/**`), plus once a week.

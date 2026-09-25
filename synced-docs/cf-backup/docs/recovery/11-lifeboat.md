# 11: The lifeboat workflow (specification)

Stage 1 of [10](10-robust-plan.md). A small, separate workflow that makes a real, encrypted,
off-site, restore-checked backup every day, **while the main pipeline is being repaired**, and
after that as a second path (decision D11).

This is a specification, not code. The commands below are the defaults. The first real runs
prove or correct them, and the file records what was proven.

## Goals

1. Every day: Postgres (`public` and `supabase_migrations`) and all three D1 databases, dumped
   with the vendors' own tools.
2. A restore check in the same run: every table's row count after restore equals the source.
3. Only ciphertext leaves the runner, encrypted to the backup key the owner already holds.
4. Two copies: R2 (read back and checked) and a GitHub artifact.
5. Red on any failure, with the failure email going to a person.

## Not goals (hard limits)

- **No shared code with the main runner.** No `scripts/backup/**`, no TypeScript, no Supabase CLI.
  A defect in the main runner must not be able to stop the lifeboat.
- **No console link.** No `backup_runs` row, no heartbeat, no settings. It is visible in GitHub
  Actions and in the bucket, and nowhere else.
- **One file, under 250 lines** including comments. If it needs more, the design is wrong.
- **No new secret** (D9's ping URL is the one allowed addition, and only if the owner agrees).
- Sign-in accounts (`auth.*`) come only after Stage 3. Until then, the owner's weekly manual copy
  ([12](12-manual-backup-today.md)) covers them.

## Shape

| Item | Value |
|---|---|
| File | `.github/workflows/lifeboat.yml` |
| Triggers | `schedule: '41 8 * * *'` (08:41 UTC, 02:41 in Aguascalientes: quiet, away from the hour and from 09:17) and `workflow_dispatch` with no inputs |
| Runner | `ubuntu-24.04`, one job, `timeout-minutes: 20`, a timeout on every step |
| Permissions | `permissions: {}` at the top; the job gets `contents: read` |
| Concurrency | its own group, `lifeboat`, `cancel-in-progress: false` |
| Actions | only `checkout`, `setup-node` (no npm cache) and `upload-artifact`, pinned by the same commit SHAs as `db-backup.yml` |
| Secrets | `CLOUDFLARE_API_TOKEN` (D1 export and R2 write, already granted) and `SUPABASE_DB_URL` (the read-only backup role, session pooler). Each is in the `env` of only the steps that use it |
| Variables | `CLOUDFLARE_ACCOUNT_ID`, `BACKUP_AGE_RECIPIENT` |
| Tools | `pg_dump` and `psql` from the pinned `supabase/postgres` 17.6.1.104 image (the same reference as `scripts/backup/lib/pins.ts`; a test holds them equal); `wrangler` from `npm ci` (pinned by the lockfile); `age` v1.3.2 from its release, checked against the SHA-256 in `pins.ts`; Node 24's built-in `node:sqlite` for the D1 check |

The repository's workflow rules apply as they do to every other workflow: no `${{ }}` inside a
`run:` block (values reach the shell through `env:` only), `persist-credentials: false`, and no
workflow-level `env`.

## Steps

### 1. Pre-flight

Fail at once, naming what is missing, if any of the two secrets or two variables is empty.
`mkdir -p out/plain out/sealed out/check` here, once, **before any tool writes** (the lesson of
T1: `wrangler` and `age` do not create folders).

### 2. Postgres: two dumps, as Supabase's own restore guide expects

Run inside the pinned image. **Never use the runner's `/usr/bin/pg_dump`**: it is version 16 and
refuses a 17 server (08, N7).

```bash
run_pg() { docker run --rm -i -e PG_URL --entrypoint sh "$PG_IMAGE" -c "$1"; }
run_pg 'exec pg_dump "$PG_URL" --schema-only --quote-all-identifiers --schema=public --schema=supabase_migrations' > out/plain/postgres-schema.sql
run_pg 'exec pg_dump "$PG_URL" --data-only  --quote-all-identifiers --schema=public --schema=supabase_migrations' > out/plain/postgres-data.sql
```

- **No `--role`.** The backup role reads all 21 tables in those schemas and has `BYPASSRLS`
  (checked live, [08](08-second-review.md)), which `pg_dump` needs when row security is on.
- **Source counts:** exact `count(*)` for every table in the two schemas, taken with `psql` in the
  same image **before and after** the dumps. A table whose counts differ was written to during the
  dump. The check then accepts a restored count between the two.
- `set -o pipefail` everywhere, so a failed `docker run` is never hidden by the redirect.

### 3. Postgres restore check

Start the same image as a local server, then load the dump the way Supabase's guide restores into a
new project:

`shim.sql`, kept next to the workflow:

```sql
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
```

```bash
# once the container answers pg_isready (give up after 90 s):
psql … -v ON_ERROR_STOP=1 -f shim.sql
psql … -v ON_ERROR_STOP=1 --single-transaction \
       -f postgres-schema.sql -c 'SET session_replication_role = replica' -f postgres-data.sql
```

- The `auth.jwt()` shim is needed because the bare image does not define it and one live policy
  uses it (L3).
- `session_replication_role = replica` lets rows that point at `auth.users` load without the
  (empty) sign-in table. The real restore into a new project does the same.
- Then count every table and compare with step 2. **Any error or any mismatch fails the run.**
- The superuser to connect as inside the container is proven on the first run and written here.
- If the schema file creates something the target already has (a `CREATE SCHEMA`, say), the fix
  is the rewrite the Supabase CLI itself makes (`CREATE SCHEMA IF NOT EXISTS`), recorded here.

### 4. D1: three databases

```bash
npx wrangler d1 export madagascar-db    --remote --skip-confirmation --output out/plain/d1-madagascar-db.sql
npx wrangler d1 export whatsapp-chatbot --remote --skip-confirmation --output out/plain/d1-whatsapp-chatbot.sql
```

- **`chatbot-kb` cannot be exported whole**: it has a full-text (virtual) table, `kb_search`, and D1
  refuses to export a database that has one. Its real tables are `bot_config`, `d1_migrations`,
  `knowledge_base`, `model_registry` and `system_prompts`. `kb_search` is an external-content index
  over `knowledge_base`, so it is rebuilt, not backed up.
  - Try first: `wrangler d1 export chatbot-kb --remote --table <each real table> …`.
  - If D1 refuses that too, read each real table with
    `wrangler d1 execute chatbot-kb --remote --json --command 'SELECT * FROM <table>'`, and the
    schema from `sqlite_master`. A short inline Node script then writes one SQL file: the tables,
    the rows, the `kb_search` table and its three triggers, and
    `INSERT INTO kb_search(kb_search) VALUES('rebuild')`.
  - The first run decides which one, and this file records it.
- **Source counts: one query per database, with no `UNION`:**
  `SELECT (SELECT count(*) FROM "t1") AS "t1", (SELECT count(*) FROM "t2") AS "t2", …`.
  A compound `SELECT` of more than 5 parts is refused by D1 (T2). This form has none. The table
  list comes from `sqlite_master`, leaving out `sqlite_%`, `_cf_%`, virtual tables and their
  shadow tables.

### 5. D1 restore check

For each SQL file: load it into an in-memory `node:sqlite` database, run
`PRAGMA integrity_check`, count every table, and compare with step 4. The main runner's drill did
exactly this for two real exports in run 5. If `node:sqlite` cannot rebuild the full-text index,
the check skips that one derived table and says so.

### 6. Seal

```bash
for f in out/plain/*.sql; do
  gzip -9 "$f"
  age -r "$BACKUP_AGE_RECIPIENT" -o "out/sealed/$(basename "$f").gz.age" "$f.gz"
done
```

Then write `out/sealed/counts.json`: for every table, its source count and its restored count, and
the tool versions. It holds no personal data, only table names and numbers. Last:

```bash
(cd out/sealed && sha256sum *.age counts.json > SHA256SUMS)
```

### 7. Upload and read back

```bash
prefix="lifeboat/$(date -u +%F)/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
for f in out/sealed/*; do
  npx wrangler r2 object put "madagascar-backups/$prefix/$(basename "$f")" --remote --file "$f"
  npx wrangler r2 object get "madagascar-backups/$prefix/$(basename "$f")" --remote --file "out/check/$(basename "$f")"
done
(cd out/check && sha256sum -c ../sealed/SHA256SUMS)
```

- `wrangler` uses the API token directly, so there are no S3 keys and no aws-cli checksum trap.
- The run id and attempt in the path make every object's name new. That matters under a bucket
  lock, which refuses overwrites.
- `lifeboat/` is outside every existing lock rule and outside everything the Worker deletes. The
  owner adds its own lock and lifecycle rules (D12).

### 8. Second copy

`upload-artifact` of `out/sealed/` (ciphertext only), `retention-days: 30`. The artifact storage
quota for private repositories on GitHub Free is 500 MB. The lifeboat uses a few MB a day.

### 9. Verdict and cleanup

- A table in `$GITHUB_STEP_SUMMARY`: for each store, whether it was dumped, restored and matched,
  its size, and the seconds it took.
- The job fails unless **every** store was dumped, restore-checked, sealed, uploaded and read back.
  There is no `continue-on-error` except where a later step must still run (seal, the summary,
  cleanup), and the verdict reads each step's `outcome`, never `job.status`.
- `if: always()`: remove the drill container and `out/plain/`. The runner's disk is thrown away
  anyway; this only makes it explicit.
- With D9: on success, one `curl` to the dead-man's ping URL.

## Acceptance

The acceptance list in [10](10-robust-plan.md), Stage 1. The first green run also records here:
its minutes, its sizes, the `chatbot-kb` method (step 4) and the drill superuser (step 3).

## How to restore from a lifeboat backup

1. `npx wrangler r2 object get madagascar-backups/lifeboat/<date>/<run>/<file> --remote --file <file>`
   for each file, then `sha256sum -c SHA256SUMS`.
2. `age -d -i key.txt -o <file>.gz <file>.gz.age`, then `gunzip`.
3. **Postgres into a new Supabase project** (session pooler connection string of its `postgres`
   user in `$NEW_DB`), as Supabase's guide does:
   `psql "$NEW_DB" -v ON_ERROR_STOP=1 --single-transaction -f postgres-schema.sql -c 'SET session_replication_role = replica' -f postgres-data.sql`.
   Then recreate the backup roles with `sql/supabase/01` to `03`, and restore sign-in accounts from
   the newest manual copy ([12](12-manual-backup-today.md)) until Stage 3.
4. **D1:** `npx wrangler d1 create <name>`, then
   `npx wrangler d1 execute <name> --remote --file d1-<name>.sql`. Point the Workers' bindings at it.
   Or, within 7 days of a mistake and while the database still exists, use Time Travel instead.

## Changes the repository needs with it

- `scripts/backup/lib/workflow-guards.ts`: `lifeboat.yml` in `DOCUMENTED_SECRETS`, the common
  checks applied to it, and a test that its image reference equals `pins.ts`.
- `RULES.md` rule 7 and `main.md`: the lifeboat as the second scheduled workflow (D12).
- `docs/RESTORE.md`: a short section pointing to "How to restore" above.

## Status

| Item | State |
|---|---|
| Workflow written | not started |
| First green manual run | not started |
| First green scheduled run | not started |
| `chatbot-kb` method | to be proven |
| Drill superuser | to be proven |
| Measured minutes per run | to be measured |

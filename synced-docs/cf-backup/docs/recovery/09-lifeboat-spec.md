---
title: "cf-backup recovery — 09 Lifeboat workflow (specification)"
status: draft
audience: [ai, technical, owner]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [scripts/backup/lib/pins.ts, scripts/backup/lib/workflow-guards.ts, .github/workflows/db-backup.yml]
related_docs: [README.md, 05-options.md, 06-plan.md, 07-decisions.md, 10-manual-backup-runbook.md]
tags: [cf-backup, recovery, lifeboat, github-actions, specification]
---

<!-- docs-check: proposed-paths -->
<!-- A specification: .github/workflows/lifeboat.yml and shim.sql do not exist yet. -->

# 09 — Lifeboat workflow (specification)

> **TL;DR (non-technical):** A small, separate workflow that makes a real, encrypted, off-site
> backup every day, checks that it restores, and fails loudly if anything is wrong. It exists so
> the business is protected **while** the main backup system is repaired, and afterwards as a
> second, independent path. It uses only the vendors' own tools and the secrets that already
> exist, and it stays deliberately small.

> **Status: specification, not built.** The commands below are the defaults. The first real runs
> prove or correct them, and §7 records what was proven. Stage 1 of [06](06-plan.md).

## 1. Goals

1. Every day: Postgres (`public` and `supabase_migrations`) and all three D1 databases, dumped with
   the vendors' own tools.
2. A restore check in the same run: every table's row count after restore equals the source.
3. Only ciphertext leaves the runner, encrypted to the backup key the owner already holds.
4. Two copies: R2 (read back and checked) and a GitHub artifact.
5. Red on any failure, with the failure email going to a person.

## 2. Not goals (hard limits)

- **No shared code with the main runner**: no `scripts/backup/**`, no TypeScript, no Supabase CLI.
  A defect in the main runner must not be able to stop the lifeboat.
- **No console link**: no `backup_runs` row, no heartbeat, no settings. It is visible in GitHub
  Actions and in the bucket, nowhere else.
- **One file, under 250 lines** including comments. If it needs more, the design is wrong.
- **No new secret**, except RD-9's ping URL if the owner accepts it.
- Sign-in accounts (`auth.*`) only after Stage 3. Until then the owner's weekly manual copy
  ([10](10-manual-backup-runbook.md)) covers them.

## 3. How it works

### 3.1 Shape

| Item | Value |
|---|---|
| File | `.github/workflows/lifeboat.yml` |
| Triggers | `schedule: '41 8 * * *'` (08:41 UTC, 02:41 in Aguascalientes: quiet, away from the hour and from 09:17) and `workflow_dispatch` with no inputs |
| Runner | `ubuntu-24.04`; one job, `timeout-minutes: 20`; a timeout on every step |
| Permissions | `permissions: {}` at the top; the job gets `contents: read` |
| Concurrency | Its own group, `lifeboat`, `cancel-in-progress: false` |
| Actions | Only `checkout`, `setup-node` (no npm cache) and `upload-artifact`, pinned by the same commit SHAs as `db-backup.yml` |
| Tools | `pg_dump` and `psql` from the pinned `supabase/postgres` 17.6.1.104 image (the same reference as `scripts/backup/lib/pins.ts`; a test holds them equal); `wrangler` from `npm ci` (pinned by the lockfile); `age` v1.3.2 from its release, checked against the SHA-256 in `pins.ts`; Node 24's built-in `node:sqlite` for the D1 check |

The repository's workflow rules apply as for every workflow: no `${{ }}` inside a `run:` block
(values reach the shell through `env:` only), `persist-credentials: false`, no workflow-level
`env`, and `set -euo pipefail` in every step.

### 3.2 Steps

**Step 1 — Pre-flight.** Fail at once, naming what is missing, if any of the two secrets or two
variables is empty. Run `mkdir -p out/plain out/sealed out/check` here, once, **before any tool
writes** (the lesson of T1: `wrangler` and `age` do not create folders).

**Step 2 — Postgres: two dumps, as Supabase's own restore guide expects.** Inside the pinned
image; **never the runner's `/usr/bin/pg_dump`**, which is version 16 and refuses a 17 server (N7).

```bash
run_pg() { docker run --rm -i -e PG_URL --entrypoint sh "$PG_IMAGE" -c "$1"; }
run_pg 'exec pg_dump "$PG_URL" --schema-only --quote-all-identifiers --schema=public --schema=supabase_migrations' > out/plain/postgres-schema.sql
run_pg 'exec pg_dump "$PG_URL" --data-only  --quote-all-identifiers --schema=public --schema=supabase_migrations' > out/plain/postgres-data.sql
```

- **No `--role`.** The backup role reads all 21 tables in those schemas and has `BYPASSRLS`
  (checked live, [03](03-reality-check.md) C5), which `pg_dump` needs when row security is on.
- **Source counts:** exact `count(*)` for every table in the two schemas, with `psql` in the same
  image, **before and after** the dumps. A table whose counts differ was written to during the
  dump; the check then accepts a restored count between the two.

**Step 3 — Postgres restore check.** Start the same image as a local server and load the dump the
way Supabase's guide restores into a new project. `shim.sql`, kept next to the workflow:

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

- The shim is needed because the bare image lacks `auth.jwt()` and one live policy uses it (L3).
- `session_replication_role = replica` lets rows that point at `auth.users` load without the
  (empty) sign-in table. The real restore into a new project does the same.
- Then count every table and compare with step 2. **Any error or any mismatch fails the run.**
- The superuser to connect as inside the container is proven on the first run and recorded in §7.
- If the schema file creates something the target already has (a `CREATE SCHEMA`, say), the fix
  is the rewrite the Supabase CLI itself makes (`CREATE SCHEMA IF NOT EXISTS`), recorded in §7.

**Step 4 — D1: three databases.**

```bash
npx wrangler d1 export madagascar-db    --remote --skip-confirmation --output out/plain/d1-madagascar-db.sql
npx wrangler d1 export whatsapp-chatbot --remote --skip-confirmation --output out/plain/d1-whatsapp-chatbot.sql
```

- **`chatbot-kb` cannot be exported whole**: it has a full-text table, `kb_search`, and D1 refuses
  to export a database that has one. Its real tables are `bot_config`, `d1_migrations`,
  `knowledge_base`, `model_registry` and `system_prompts`. `kb_search` is an external-content
  index over `knowledge_base`, so it is rebuilt, not backed up.
  - Try first: `wrangler d1 export chatbot-kb --remote --table <each real table> …`.
  - If D1 refuses that too: read each real table with
    `wrangler d1 execute chatbot-kb --remote --json --command 'SELECT * FROM <table>'`, and the schema
    from `sqlite_master`. A short inline Node script writes one SQL file: the tables, the rows,
    `kb_search` with its three triggers, and `INSERT INTO kb_search(kb_search) VALUES('rebuild')`.
  - The first run decides which one; §7 records it.
- **Source counts: one query per database, with no compound `SELECT`:**
  `SELECT (SELECT count(*) FROM "t1") AS "t1", (SELECT count(*) FROM "t2") AS "t2", …`. D1 refuses
  a compound `SELECT` of more than 5 parts (T2); this form has none. The table list comes from
  `sqlite_master`, leaving out `sqlite_%`, `_cf_%`, virtual tables and their shadow tables.

**Step 5 — D1 restore check.** For each SQL file: load it into an in-memory `node:sqlite`
database, run `PRAGMA integrity_check`, count every table, compare with step 4. The main runner's
drill did exactly this for two real exports in run 5. If `node:sqlite` cannot rebuild the
full-text index, the check skips that one derived table and says so.

**Step 6 — Seal.**

```bash
for f in out/plain/*.sql; do
  gzip -9 "$f"
  age -r "$BACKUP_AGE_RECIPIENT" -o "out/sealed/$(basename "$f").gz.age" "$f.gz"
done
```

Then write `out/sealed/counts.json` (for every table: source count, restored count; plus the tool
versions; no personal data), and last:

```bash
(cd out/sealed && sha256sum *.age counts.json > SHA256SUMS)
```

**Step 7 — Upload and read back.**

```bash
prefix="lifeboat/$(date -u +%F)/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
for f in out/sealed/*; do
  npx wrangler r2 object put "madagascar-backups/$prefix/$(basename "$f")" --remote --file "$f"
  npx wrangler r2 object get "madagascar-backups/$prefix/$(basename "$f")" --remote --file "out/check/$(basename "$f")"
done
(cd out/check && sha256sum -c ../sealed/SHA256SUMS)
```

- `wrangler` uses the API token directly: no S3 keys, no aws-cli checksum trap.
- The run id and attempt in the path make every object name new, which matters under a bucket
  lock (it refuses overwrites).
- `lifeboat/` is outside every existing lock rule and everything the Worker deletes. The owner
  adds its own lock and lifecycle rules (RD-12).

**Step 8 — Second copy.** `upload-artifact` of `out/sealed/` (ciphertext only),
`retention-days: 30`. GitHub Free's artifact quota for private repositories is 500 MB; the lifeboat
uses a few MB a day.

**Step 9 — Verdict and cleanup.**

- A table in `$GITHUB_STEP_SUMMARY`: per store, whether it was dumped, restored and matched, its
  size, and the seconds it took.
- The job fails unless **every** store was dumped, restore-checked, sealed, uploaded and read back.
  No `continue-on-error` except where a later step must still run (seal, summary, cleanup); the
  verdict reads each step's `outcome`, never `job.status`.
- `if: always()`: remove the drill container and `out/plain/`.
- With RD-9: on success, one `curl` to the dead-man's ping URL.

## 4. Configuration

Secret and variable **names only**:

| Name | Kind | Used by | Notes |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret (key 1) | Steps 4, 7 | D1 export and R2 write, already granted |
| `SUPABASE_DB_URL` | Secret (key 2) | Step 2 | The read-only backup role, session pooler |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | Steps 4, 7 | |
| `BACKUP_AGE_RECIPIENT` | Variable | Step 6 | The public key only |
| The dead-man's ping URL | Secret, only with RD-9 | Step 9 | Outside the four keys |

## 5. Operational notes

- **A red run:** GitHub emails the person who started it; for a scheduled run, the person who
  last changed its cron line. The step summary names the store and the step.
- **A missed run:** GitHub can delay or drop scheduled runs at busy times. Daily cadence plus the
  dead-man (RD-9) cover it.
- **Restore from a lifeboat backup:**
  1. `npx wrangler r2 object get madagascar-backups/lifeboat/<date>/<run>/<file> --remote --file <file>`
     for each file, then `sha256sum -c SHA256SUMS`.
  2. `age -d -i key.txt -o <file>.gz <file>.gz.age`, then `gunzip`.
  3. **Postgres into a new Supabase project** (its `postgres` session pooler connection string in
     `$NEW_DB`), as Supabase's guide does:
     `psql "$NEW_DB" -v ON_ERROR_STOP=1 --single-transaction -f postgres-schema.sql -c 'SET session_replication_role = replica' -f postgres-data.sql`.
     Then recreate the backup roles with `sql/supabase/01_backup_reader.sql` to
     `sql/supabase/03_backup_keyholder.sql`, and restore sign-in accounts from the newest manual copy
     ([10](10-manual-backup-runbook.md)) until Stage 3.
  4. **D1:** `npx wrangler d1 create <name>`, then
     `npx wrangler d1 execute <name> --remote --file d1-<name>.sql`, and point the Workers' bindings
     at it. Within 7 days of a mistake, while the database still exists, Time Travel is faster.

## 6. Changes the repository needs with it

- `scripts/backup/lib/workflow-guards.ts`: `lifeboat.yml` in `DOCUMENTED_SECRETS`, the common checks
  applied to it, and a test that its image reference equals `pins.ts`.
- `RULES.md` rule 7 and `main.md`: the lifeboat as the second scheduled workflow (RD-12).
- `docs/RESTORE.md`: a short section pointing to §5.

## 7. Status and what the first runs proved

| Item | State |
|---|---|
| Workflow written | not started |
| First green manual run | not started |
| First green scheduled run | not started |
| `chatbot-kb` method (step 4) | to be proven |
| Drill superuser (step 3) | to be proven |
| Measured minutes and sizes per run | to be measured |

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Live: backup role's table grants and `BYPASSRLS`; `chatbot-kb` `sqlite_master`; R2 lock rules in `src/files/layout.ts:524-531` | Steps 2, 4 and 7 rest on these |
| 2026-09-25 | claude | Code read: `pins.ts` (image, age), `workflow-guards.ts` (rules every workflow must pass) | §3.1, §6 |
| 2026-09-25 | claude | Vendor docs: Supabase restore guide, wrangler D1 export and R2 upload, GitHub schedule notes | §3.2, §5 |

## 9. Related

- [06-plan.md](06-plan.md) §4: Stage 1 tasks and exit.
- [07-decisions.md](07-decisions.md): RD-9, RD-11, RD-12.
- [10-manual-backup-runbook.md](10-manual-backup-runbook.md): the same job by hand.

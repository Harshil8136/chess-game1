---
title: "cf-backup remediation — 09 Secondary Pipeline specification"
status: active
audience: [ai, technical, owner]
last_verified: 2026-09-26
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [.github/workflows/secondary-pipeline.yml, scripts/secondary-pipeline/verify.ts, scripts/backup/lib/pins.ts, scripts/backup/lib/workflow-guards.ts]
related_docs: [README.md, 05-options-analysis.md, 06-remediation-plan.md, 07-decision-log.md, 10-sop-manual-baseline-export.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, secondary-pipeline, github-actions, specification]
---

# 09 — Secondary Pipeline specification

> **TL;DR (non-technical):** A small, independent workflow that produces an encrypted, off-site
> recovery point every day, verifies that it restores, and fails visibly if anything is wrong. It
> protects the business **while** the Primary Pipeline is remediated, and afterwards serves as a
> second, independent path. It uses only vendor tools and the secrets already configured, and it is
> deliberately kept small.

> **Status (2026-09-26): implemented and commissioned.** Two manual runs passed; the first
> scheduled run is at 08:41 UTC on 2026-09-27. §3 is the design; §7 records the commissioning
> results and where the implementation differs from the design. Stage 1 of
> [06](06-remediation-plan.md). Terms: [11](11-terminology-standard.md).

## 1. Objectives

1. Daily: PostgreSQL (`public` and `supabase_migrations`) and all three D1 databases, exported with
   the vendors' own tools.
2. Restore verification in the same run: every table's row count after restore equals the source.
3. Only ciphertext leaves the runner, encrypted to the archive encryption key the Owner already
   holds.
4. Two copies: R2 (read back and verified) and a GitHub artifact.
5. Failure on any error, with the notification reaching a person.

## 2. Constraints (hard limits)

- **No shared code with the Primary Pipeline**: nothing under `scripts/backup/**` runs, and no
  Supabase CLI. Shell calls the vendors' tools; a small helper,
  `scripts/secondary-pipeline/verify.ts`, uses Node built-ins only and imports nothing from the
  Primary Pipeline. A Primary Pipeline defect must not be able to stop the Secondary Pipeline. The
  workflow guard (`checkSecondaryPipelineWorkflow` in `scripts/backup/lib/workflow-guards.ts`)
  fails CI if the workflow ever runs anything under `scripts/backup/`.
- **No console integration**: no `backup_runs` row, no heartbeat, no settings. It is visible in
  GitHub Actions and in the archive bucket only.
- **Small and reviewable:** the workflow stays under 300 lines including comments, and the helper under 400. If either needs
  more, the design is wrong.
- **No new secret**, except RD-9's ping URL if the Owner approves it.
- Authentication records (`auth.*`) only after Stage 3. Until then the Owner's weekly manual baseline
  export ([10](10-sop-manual-baseline-export.md)) covers them.

## 3. Design

### 3.1 Workflow definition

| Item | Value |
|---|---|
| File | `.github/workflows/secondary-pipeline.yml` |
| Triggers | `schedule: '41 8 * * *'` (08:41 UTC, 02:41 in Aguascalientes: low traffic, away from the hour and from 09:17) and `workflow_dispatch` without inputs |
| Runner | `ubuntu-24.04`; one job, `timeout-minutes: 30`; a timeout on every step |
| Permissions | `permissions: {}` at the top level; the job receives `contents: read` |
| Concurrency | Its own group, `secondary-pipeline`, `cancel-in-progress: false` |
| Actions | Only `checkout`, `setup-node` (no npm cache) and `upload-artifact`, pinned to the same commit SHAs as `db-backup.yml` |
| Tools | `pg_dump` and `psql` from the pinned `supabase/postgres` 17.6.1.104 image (the same reference as `scripts/backup/lib/pins.ts`; a test enforces equality); `wrangler` from `npm ci` (pinned by the lockfile); `age` v1.3.2 from its release, checked against the SHA-256 in `pins.ts`; Node 24's built-in `node:sqlite` for D1 verification |

The repository's workflow rules apply: no `${{ }}` inside a `run:` block (values reach the shell
through `env:` only), `persist-credentials: false`, no workflow-level `env`, and
`set -euo pipefail` in every step.

### 3.2 Steps

**Step 1 — Pre-flight.** Fail immediately, naming what is missing, if either secret or either
variable is empty. Run `mkdir -p out/plain out/encrypted out/check` once, **before any tool writes**
(the lesson of T1: `wrangler` and `age` do not create directories).

**Step 2 — PostgreSQL export, in the two files Supabase's restore procedure expects.** Inside the
pinned image; **never the runner's `/usr/bin/pg_dump`**, which is version 16 and refuses a 17 server
(N7).

```bash
run_pg() { docker run --rm -i -e PG_URL --entrypoint sh "$PG_IMAGE" -c "$1"; }
run_pg 'exec pg_dump "$PG_URL" --schema-only --quote-all-identifiers --schema=public --schema=supabase_migrations' > out/plain/postgres-schema.sql
run_pg 'exec pg_dump "$PG_URL" --data-only  --quote-all-identifiers --schema=public --schema=supabase_migrations' > out/plain/postgres-data.sql
```

- **No `--role`.** The read-only export role reads all 21 tables in those schemas and has
  `BYPASSRLS` (verified live, [03](03-dependency-assessment.md) C5), which `pg_dump` requires when
  row-level security is enabled.
- **Source counts:** exact `count(*)` for every table in both schemas, with `psql` in the same
  image, **before and after** the export. A table whose counts differ was written during the
  export; verification then accepts a restored count between the two.

**Step 3 — PostgreSQL restore verification.** Start the same image as a local server and load the
export as Supabase's procedure restores into a new project. The compatibility shim
(`scripts/secondary-pipeline/auth-jwt-shim.sql`):

```sql
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
```

```bash
# once the container answers pg_isready (timeout 90 s):
psql … -v ON_ERROR_STOP=1 -f auth-jwt-shim.sql
psql … -v ON_ERROR_STOP=1 --single-transaction \
       -f postgres-schema.sql -c 'SET session_replication_role = replica' -f postgres-data.sql
```

- The shim is required because the bare image lacks `auth.jwt()` and one live policy uses it (L3).
- `session_replication_role = replica` allows rows referencing `auth.users` to load without the
  (empty) authentication table; a real restore into a new project does the same.
- Then count every table and compare with step 2. **Any error or mismatch fails the run.**
- The superuser used inside the container is confirmed by the commissioning runs and recorded in §7.
- If the schema file creates an object the target already has (for example a `CREATE SCHEMA`), the
  correction is the rewrite the Supabase CLI itself applies (`CREATE SCHEMA IF NOT EXISTS`),
  recorded in §7.

**Step 4 — D1 export, three databases.**

```bash
npx wrangler d1 export madagascar-db    --remote --skip-confirmation --output out/plain/d1-madagascar-db.sql
npx wrangler d1 export whatsapp-chatbot --remote --skip-confirmation --output out/plain/d1-whatsapp-chatbot.sql
```

- **`chatbot-kb` cannot be exported whole**: it contains a full-text table, `kb_search`, and D1
  refuses to export a database containing one. Its base tables are `bot_config`, `d1_migrations`,
  `knowledge_base`, `model_registry` and `system_prompts`. `kb_search` is an external-content index
  over `knowledge_base`, so it is rebuilt, not exported.
  - First method: `wrangler d1 export chatbot-kb --remote --table <each base table> …`.
  - If D1 also refuses that: read each base table with
    `wrangler d1 execute chatbot-kb --remote --json --command 'SELECT * FROM <table>'`, and the schema
    from `sqlite_master`. A short inline Node script writes one SQL file: the tables, the rows,
    `kb_search` with its three triggers, and `INSERT INTO kb_search(kb_search) VALUES('rebuild')`.
  - The commissioning runs determine the method; §7 records it.
- **Source counts: one query per database, with no compound `SELECT`:**
  `SELECT (SELECT count(*) FROM "t1") AS "t1", (SELECT count(*) FROM "t2") AS "t2", …`. D1 rejects a
  compound `SELECT` of more than 5 terms (T2); this form has none. The table list comes from
  `sqlite_master`, excluding `sqlite_%`, `_cf_%`, virtual tables and their shadow tables.

**Step 5 — D1 restore verification.** For each SQL file: load it into an in-memory `node:sqlite`
database, run `PRAGMA integrity_check`, count every table, and compare with step 4. The Primary
Pipeline's restore verification did exactly this for two production exports in run 5. If
`node:sqlite` cannot rebuild the full-text index, verification skips that derived table and records
it.

**Step 6 — Encryption.**

```bash
for f in out/plain/*.sql; do
  gzip -9 "$f"
  age -r "$BACKUP_AGE_RECIPIENT" -o "out/encrypted/$(basename "$f").gz.age" "$f.gz"
done
```

Then write `out/encrypted/counts.json` (per table: source count and restored count; plus tool
versions; no personal data), and finally:

```bash
(cd out/encrypted && sha256sum *.age counts.json > SHA256SUMS)
```

**Step 7 — Upload and read-back verification.**

```bash
prefix="secondary/pipeline/$(date -u +%F)/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
for f in out/encrypted/*; do
  npx wrangler r2 object put "madagascar-backups/$prefix/$(basename "$f")" --remote --file "$f"
  npx wrangler r2 object get "madagascar-backups/$prefix/$(basename "$f")" --remote --file "out/check/$(basename "$f")"
done
(cd out/check && sha256sum -c ../encrypted/SHA256SUMS)
```

- `wrangler` authenticates with the API token directly: no S3 credentials, no aws-cli checksum
  issue.
- The run id and attempt in the path make every object name unique, which matters under a bucket
  lock (it refuses overwrites).
- `secondary/` is outside every existing lock rule and every path the Worker deletes. The Owner adds
  its own lock and lifecycle rules (RD-12).

**Step 8 — Second copy.** `upload-artifact` of `out/encrypted/` (ciphertext only),
`retention-days: 14`, the repository's maximum. GitHub Free's artifact quota for private repositories is 500 MB; the Secondary
Pipeline uses a few MB a day.

**Step 9 — Verdict and cleanup.**

- A table in `$GITHUB_STEP_SUMMARY`: per store, whether it was exported, restored and matched, its
  size, and its duration.
- The job fails unless **every** store was exported, restore-verified, encrypted, uploaded and read
  back. No `continue-on-error` except where a later step must still run (encryption, summary,
  cleanup); the verdict reads each step's `outcome`, never `job.status`.
- `if: always()`: remove the restore container and `out/plain/`.
- With RD-9: on success, one `curl` to the external heartbeat monitor's ping URL.

## 4. Configuration

Secret and variable **names only**:

| Name | Type | Used in | Notes |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret (key 1) | Steps 4, 7 | D1 export and R2 write, already granted |
| `SUPABASE_DB_URL` | Secret (key 2) | Step 2 | The read-only export role, session pooler |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | Steps 4, 7 | |
| `BACKUP_AGE_RECIPIENT` | Variable | Step 6 | The public key only |
| External heartbeat ping URL | Secret, only with RD-9 | Step 9 | Outside the four-secret limit |

## 5. Operational notes

- **A failed run:** GitHub notifies the person who started it; for a scheduled run, the person who
  last changed its cron line. The step summary identifies the store and the step.
- **A missed run:** GitHub may delay or drop scheduled runs under load. Daily cadence and the
  external heartbeat monitor (RD-9) cover it.
- **Restoring from a Secondary Pipeline recovery point:**
  1. `npx wrangler r2 object get madagascar-backups/secondary/pipeline/<date>/<run>/<file> --remote --file <file>`
     for each file, then `sha256sum -c SHA256SUMS`.
  2. `age -d -i key.txt -o <file>.gz <file>.gz.age`, then `gunzip`.
  3. **PostgreSQL into a new Supabase project** (its `postgres` session pooler connection string in
     `$NEW_DB`), following Supabase's procedure:
     `psql "$NEW_DB" -v ON_ERROR_STOP=1 --single-transaction -f postgres-schema.sql -c 'SET session_replication_role = replica' -f postgres-data.sql`.
     Then recreate the roles with `sql/supabase/01_backup_reader.sql` to
     `sql/supabase/03_backup_keyholder.sql`, and restore authentication records from the latest manual
     baseline export ([10](10-sop-manual-baseline-export.md)) until Stage 3.
  4. **D1:** `npx wrangler d1 create <name>`, then
     `npx wrangler d1 execute <name> --remote --file d1-<name>.sql`, and update the Workers' bindings.
     Within 7 days of an error, while the database still exists, Time Travel is faster.

## 6. Repository changes required

All three are done (2026-09-26).

- `scripts/backup/lib/workflow-guards.ts`: `secondary-pipeline.yml` in `DOCUMENTED_SECRETS`, the
  common checks applied to it, and a test that its image reference equals `pins.ts`
  (`checkSecondaryPipelineWorkflow`, which also enforces the independence rule of §2).
- `RULES.md` rule 7 and `main.md`: the Secondary Pipeline as the second scheduled workflow (RD-12).
- `docs/RESTORE.md`: a short section referring to §5.

## 7. Status and commissioning results

| Item | State | Evidence |
|---|---|---|
| Workflow implemented | **done** | `secondary-pipeline.yml` (267 lines) and `scripts/secondary-pipeline/verify.ts` (356 lines), commits `3abadc8` and `027feda`; `npm run verify` passing |
| First passing manual run | **done**, 2026-09-26 | Runs 36269275118 and 36269595781 |
| First verified recovery point | **done**, 2026-09-26 20:29 UTC | `madagascar-backups/secondary/pipeline/2026-09-26/36269595781-1/`: seven objects written and read back; all six checksums in `SHA256SUMS` matched |
| First passing scheduled run | pending | Due 2026-09-27 08:41 UTC |
| One file decrypted by the Owner | pending | Task 1.3 in [06](06-remediation-plan.md) |
| Failure notification reaching a person | pending | Proven by the first failed run, or by a deliberate one |

### 7.1 What the commissioning runs established

| Question left open by §3 | Answer |
|---|---|
| `chatbot-kb` method (step 4) | **Row reads and rebuild** (the second method). The workflow selects it for any database with a virtual table; `--table` was not tried. The rebuilt file restores with `kb_search` rebuilt and FTS5 `integrity-check` passing |
| Restore-target superuser (step 3) | `supabase_admin` creates the referenced roles and the `auth.jwt()` shim; the export itself restores **as `postgres`**, as it would into a new Supabase project |
| Readiness of the restore container | The workflow waits for two consecutive successful queries over TCP as `supabase_admin` (up to 3 minutes), not a single `pg_isready`, so the restore never starts against a server that is still initializing |
| Roles the dump references | The schema file grants privileges to roles by name. Before the restore, the helper lists every role the file names and creates any the image lacks |
| Supabase CLI rewrites | Applied, as the Supabase CLI applies them to these schemas: `CREATE SCHEMA IF NOT EXISTS`, and `\restrict`, `ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"`, `CREATE PUBLICATION "supabase_realtime…"` and `SET transaction_timeout` commented out (`scripts/secondary-pipeline/pg-dump-filter.sed`). With them the schema file restores without error |
| `wrangler d1 export` output | It prints a one-hour signed link to the **plaintext** export. The workflow writes the command's output to a file and prints it, with links removed, only on failure (fixed in `027feda`; run 2's log contains no signed link) |
| Artifact retention | The repository caps artifacts at **14 days**; a request for 30 was lowered with a warning. The workflow asks for 14 |
| Minutes per run | About **2 minutes** (run 2: 20:27:37 to 20:29:37 UTC); the longest steps are pre-flight (29 s), D1 export (28 s), upload and read-back (23 s) and PostgreSQL export (19 s) |
| Sizes per run | Plaintext: PostgreSQL schema 77 KB and data 1.9 MB; D1 2.2 MB in three files (`madagascar-db` 2.0 MB). Ciphertext, gzip then age: 0.9 MB in total |

### 7.2 Restore verification results (run 36269595781)

Every table's restored row count equalled its source count, before and after the export.

| Store | Tables | Rows restored |
|---|---|---|
| PostgreSQL (`public`, `supabase_migrations`) | 21 | 2,201 |
| D1 `madagascar-db` | 32 | 2,574 |
| D1 `whatsapp-chatbot` | 4 | 106 |
| D1 `chatbot-kb` (`kb_search` rebuilt, not counted) | 5 | 87 |

Independent check, the same evening, with read-only queries outside the workflow: PostgreSQL 21
tables and 2,201 rows; `chatbot-kb` 87 rows.

### 7.3 Where the implementation differs from §3

- Working files live under `$RUNNER_TEMP/secondary/`, not `out/`, so nothing is written inside the
  checkout. The manifest is `manifest.json` (schema `cf-backup/secondary-manifest@1`: each store's
  result and per-table row counts; no personal data), not `counts.json`.
- Only files whose restore verification passed are encrypted and archived. A store that fails does
  not stop the others, and the verdict step then fails the run.
- Encryption, upload and the verdict run without `continue-on-error`; only the four export and
  verification steps use it, so that each store reaches the verdict.

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Live: the export role's table grants and `BYPASSRLS`; `chatbot-kb` `sqlite_master`; R2 lock rules in `src/files/layout.ts:524-531` | Steps 2, 4 and 7 rest on these |
| 2026-09-25 | claude | Code read: `pins.ts` (image, age), `workflow-guards.ts` (rules every workflow must satisfy) | §3.1, §6 |
| 2026-09-25 | claude | Vendor documentation: Supabase restore procedure, wrangler D1 export and R2 upload, GitHub schedule notes | §3.2, §5 |
| 2026-09-26 | claude | Commissioning runs 36269275118 and 36269595781 (job logs, step timings, artifact size); live read-only counts from Supabase and D1 | §7 |

## 9. Related

- [06-remediation-plan.md](06-remediation-plan.md) §4: Stage 1 tasks and exit criteria.
- [07-decision-log.md](07-decision-log.md): RD-9, RD-11, RD-12.
- [10-sop-manual-baseline-export.md](10-sop-manual-baseline-export.md): the same procedure, performed manually.

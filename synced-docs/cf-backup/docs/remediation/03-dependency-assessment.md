---
title: "cf-backup remediation — 03 Dependency assessment (each external service: assumed vs actual)"
status: active
audience: [ai, technical, owner]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp, research]
owner: harshil
related_code: [scripts/backup/lib/pins.ts, scripts/backup/lib/d1-schema.ts, scripts/backup/lib/pg-backup.ts, sql/supabase/01_backup_reader.sql]
related_docs: [README.md, 04-defect-register.md, 08-industry-practice-review.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, dependencies, d1, r2, supabase, github-actions, age]
---

# 03 — Dependency assessment

> **TL;DR (non-technical):** For each external service the pipelines depend on, this assessment
> records what the design assumed and what is actually true. Most assumptions hold. Those that do
> not are specific: D1 has an undocumented query limit, the Supabase export tool switches to an
> account the read-only export role may not use, the PostgreSQL restore target lacks parts of
> Supabase, and none of the tools create missing directories.

Each row carries a status:

- **Confirmed**: observed in a production run's log, a read-only live check on 2026-09-25, or the
  tool's source at the pinned version.
- **To verify**: plausible and material, not yet proven; the plan assigns it a stage.

## A. Cloudflare D1

| # | Design assumption | Actual behaviour | Status | Evidence |
|---|---|---|---|---|
| A1 | The D1 query API accepts any SQL that SQLite accepts | **D1 rejects a compound `SELECT` of more than 5 terms** (`too many terms in compound SELECT`, code 7500). Plain SQLite allows 500. The limit is set in Cloudflare's runtime and **is not documented on the D1 limits page** | Confirmed | Live: a 6-term `SELECT 1 UNION ALL …` fails on `madagascar-db`; workerd source ([08](08-industry-practice-review.md) §1.2) |
| A2 | `wrangler d1 export --output <path>` writes the file | It creates the export, polls, downloads from a signed URL valid for one hour, then writes `<path>`. **It does not create the parent directory** | Confirmed | Run 5 |
| A3 | Export supports every table | Not virtual tables, **nor any database containing one**. `chatbot-kb` has `kb_search` (full-text), an external-content index over `knowledge_base`, so it can be rebuilt rather than exported | Confirmed | Cloudflare documentation; live `sqlite_master`; run 5 used the query exporter |
| A4 | Size and duration are not constraints | `madagascar-db` is **2.5 MB** (32 tables), `chatbot-kb` 0.2 MB, `whatsapp-chatbot` 0.08 MB; an export takes about one second. *Corrected 2026-09-25: an earlier draft stated 16.5 MB, which was a network counter* | Confirmed | D1 API database list |
| A5 | (not in the design) | **Time Travel provides 7 days of point-in-time restore on the Free plan** (30 on Paid). It restores in place, within the same account: a safety net during remediation, not an off-site recovery point | Confirmed | Cloudflare Time Travel documentation |
| A6 | A temporary database for the monthly live restore test | The Free plan allows 10 D1 databases per account; 3 are in use | Confirmed | D1 limits; live list |

## B. Cloudflare R2 (S3 API from a GitHub runner)

| # | Design assumption | Actual behaviour | Status | Evidence |
|---|---|---|---|---|
| B1 | S3 credentials are derived from the API token at run time | Works: the access key is the token id, the secret the SHA-256 of the token | Confirmed | Pre-flight diagnostics' canary PUT, HEAD and DELETE passed in runs 3 to 6 |
| B2 | Uploads are inexpensive | Class A operations are free up to 1 million a month; storage up to 10 GB-month | Confirmed | R2 pricing |
| B3 | Bucket locks protect production recovery points | Lock rules cover `backups/full/` (90 days), `backups/daily/` (30 days) and `ops/` (90 days), plus the `v1/` equivalents. **Pre-production Validation must never write under them**; it needs its own bucket or an unlocked prefix. The proposed `secondary/` prefix is outside every rule | Confirmed | `src/files/layout.ts:524-531`; layout documentation |
| B4 | (Secondary Pipeline) Uploading with `wrangler r2 object put` | Authenticates with the API token directly (no S3 credentials); up to 315 MB per object | Confirmed | Cloudflare R2 upload documentation |

## C. Supabase (Free plan)

| # | Design assumption | Actual behaviour | Status | Evidence |
|---|---|---|---|---|
| C1 | Supabase maintains its own backups | **The Free plan has no platform backups.** Supabase advises Free projects to export with the CLI and keep off-site copies | Confirmed | Supabase backups documentation |
| C2 | Connect through the session pooler, port 5432 | Correct. The direct connection is IPv6-only, and GitHub runners have no IPv6. The transaction pooler (6543) is unsuitable for `pg_dump` | Confirmed | Supabase connection documentation |
| C3 | `supabase db dump --db-url <export role>` exports what that role can read | **All three export scripts pass `--role "postgres"`**, so `pg_dump` issues `SET ROLE postgres` after connecting. The read-only export role is **not** a member of `postgres` (`pg_has_role` = false). Every export will fail with "permission denied to set role" | Confirmed | CLI source at v2.117.0 (`dump_schema.sh`, `dump_data.sh`, `dump_role.sh`); live check |
| C4 | The data export covers the application tables | The CLI's data export includes `auth`, `storage` and `cron`, which the export role cannot fully read | Confirmed | CLI `dump.go` |
| C5 | The export role can be granted what it needs | It reads **all 21 tables** in `public` and `supabase_migrations` and has `BYPASSRLS`. It has **no `USAGE` on schema `auth`**, which `postgres` cannot grant. `postgres` can read `auth.users`. The Vault is refused, by design | Confirmed | Live `has_table_privilege`, `has_schema_privilege`; run 6 (`42501` on `vault`) |
| C6 | Size and composition | 17 MB; PostgreSQL 17.6; 20 tables in `public`, about 1,900 rows; extensions `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `pg_cron` (0 jobs), `supabase_vault`; schemas include `backup_private` (the key functions) | Confirmed | Live |
| C7 | The restore-verification image is "Supabase PostgreSQL", so an export restores into it | The `supabase/postgres` 17.6.1.104 image creates only **5 of the 27 `auth` tables** and the functions `auth.uid()`, `auth.role()`, `auth.email()`; `storage` has no tables. **One live policy uses `auth.jwt()`**, and 24 foreign keys reference `auth` | Confirmed | Image source; live `pg_policies` |
| C8 | Authentication records can be exported | Options: read them as `postgres`; a view owned by `postgres` that the export role may read; or the Auth Admin API, which **does not return password hashes** | Confirmed | Supabase Auth documentation; [07](07-decision-log.md) RD-1 |
| C9 | A spare project is available for restore tests | **None.** The organisation already has two projects, and the Free plan allows two active free projects | Confirmed | Live project list |

## D. GitHub Actions (`ubuntu-24.04`, private repository)

| # | Design assumption | Actual behaviour | Status | Evidence |
|---|---|---|---|---|
| D1 | Docker, disk and memory are sufficient | 2 CPUs, 7.9 GB RAM, about 11 GB free disk, Docker 28 | Confirmed | `evidence/tools.json`, runs 5 and 6 |
| D2 | Minutes are affordable | 2,000 Linux minutes a month on GitHub Free, shared by the account's private repositories; each job is rounded up to a whole minute. A failing run bills 1 to 2 | Confirmed | GitHub billing documentation; `backup_runs.billed_minutes` |
| D3 | The runner's own PostgreSQL client | **Version 16.** `pg_dump` refuses a newer server, and the server is 17. Not an issue today (the runner uses the 17 image in docker); material for any simpler workflow | Confirmed | Ubuntu 24.04 image readme |
| D4 | Scheduled runs start on time | They "can be delayed during periods of high loads … some queued jobs may be dropped". The first scheduled run here started 5 h 38 min late | Confirmed | GitHub documentation; plan-of-record P-17 |
| D5 | Someone is notified when a scheduled run fails | GitHub notifies **"the user who last modified the cron syntax in the workflow file"** | Confirmed | GitHub documentation |
| D6 | `ubuntu-latest` | Pinned to `ubuntu-24.04` intentionally; `ubuntu-latest` moves to a new release in October–November 2026 | Confirmed | `db-backup.yml` header |

## E. age

| # | Design assumption | Actual behaviour | Status | Evidence |
|---|---|---|---|---|
| E1 | `age -r <recipient> -o <file>` writes the file | It does, but **does not create the parent directory** | Confirmed | Run 5: `failed to write header … no such file or directory` |
| E2 | The archive encryption key works | Pre-flight diagnostics' trial encryption to the key passed in runs 5 and 6 (age v1.3.2) | Confirmed | Runs 5 and 6 |
| E3 | The offline recovery key is safe and usable | **Unproven.** No recovery point has ever been decrypted with an offline recovery key, and the registry shows no confirmation | To verify | Stages 0 and 5 of [06](06-remediation-plan.md) |

## F. Design elements confirmed sound

The session pooler; the pinned runner and restore-verification images; the query exporter for
full-text tables; R2 credential derivation; refusing the Vault to the runner; and a local D1 restore
verification that really restored two production exports. **The architecture is workable.** The
failures come from paths never executed, one hidden `SET ROLE`, an undocumented D1 limit, and the
missing parts of a bare restore image.

## G. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | D1 API and read-only queries (all three databases) | A1, A3, A4, A6 |
| 2026-09-25 | claude | Supabase read-only SQL: roles, grants, catalog, size | C3, C5, C6, C7 |
| 2026-09-25 | claude | Supabase CLI source at tag v2.117.0; `supabase/postgres` image source at 17.6.1.104 | C3, C4, C7 |
| 2026-09-25 | claude | GitHub job logs, runs 5 and 6 | A2, B1, D1, E1, E2 |
| 2026-09-25 | claude | Vendor documentation, read the same day ([08](08-industry-practice-review.md)) | A5, B2, B4, C1, C2, D2 to D5 |

## H. Related

- [04-defect-register.md](04-defect-register.md): the defects these facts cause.
- [08-industry-practice-review.md](08-industry-practice-review.md): sources, with links.

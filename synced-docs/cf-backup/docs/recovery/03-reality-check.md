---
title: "cf-backup recovery — 03 Reality check (each outside service: assumed vs true)"
status: active
audience: [ai, technical, owner]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp, research]
owner: harshil
related_code: [scripts/backup/lib/pins.ts, scripts/backup/lib/d1-schema.ts, scripts/backup/lib/pg-backup.ts, sql/supabase/01_backup_reader.sql]
related_docs: [README.md, 04-defect-register.md, 08-how-others-do-it.md]
tags: [cf-backup, recovery, d1, r2, supabase, github-actions, age]
---

# 03 — Reality check of each outside service

> **TL;DR (non-technical):** For every outside service the backup depends on, this page lists
> what the design assumed and what is actually true. Most assumptions held. The ones that did not
> are specific: D1 has an undocumented query limit, the Supabase tool switches to an account our
> backup role may not use, the Postgres test image is missing pieces of Supabase, and none of the
> tools create missing folders.

Every row has a status:

- **Confirmed**: seen in a real run's log, a read-only live check on 2026-09-25, or the tool's
  source at the version we pin.
- **To verify**: plausible and material, not yet proven; the plan assigns it a stage.

## A. Cloudflare D1

| # | The design assumes | Reality | Status | Evidence |
|---|---|---|---|---|
| A1 | The D1 query API accepts any SQL that SQLite accepts | **D1 rejects a compound `SELECT` of more than 5 parts** (`too many terms in compound SELECT`, code 7500). Plain SQLite allows 500. The limit is set in Cloudflare's runtime and is **not on the D1 limits page** | Confirmed | Live: a 6-part `SELECT 1 UNION ALL …` fails on `madagascar-db`; workerd source ([08](08-how-others-do-it.md) §1.2) |
| A2 | `wrangler d1 export --output <path>` writes the file | It creates the export, polls, downloads from a signed URL valid for an hour, then writes `<path>`. **It does not create the parent folder** | Confirmed | Run 5 |
| A3 | Export handles every table | Not virtual tables, **nor any database that has one**. `chatbot-kb` has `kb_search` (full-text), an external-content index over `knowledge_base`, so it can be rebuilt instead of exported | Confirmed | Cloudflare docs; live `sqlite_master`; run 5 used the query exporter |
| A4 | Size and time are not a concern | `madagascar-db` is **2.5 MB** (32 tables), `chatbot-kb` 0.2 MB, `whatsapp-chatbot` 0.08 MB. An export takes about a second. *Corrected 2026-09-25: an earlier draft said 16.5 MB, which was a network counter* | Confirmed | D1 API database list |
| A5 | (not in the design) | **Time Travel gives 7 days of point-in-time restore on the Free plan** (30 on Paid). It restores in place, in the same account. A safety net while cf-backup is fixed, not an off-site backup | Confirmed | Cloudflare Time Travel docs |
| A6 | A throwaway database for the monthly real-path drill | The Free plan allows 10 D1 databases per account; 3 are in use | Confirmed | D1 limits; live list |

## B. Cloudflare R2 (S3 API from a GitHub runner)

| # | The design assumes | Reality | Status | Evidence |
|---|---|---|---|---|
| B1 | S3 keys are derived from the API token at run time | Works: the access key is the token id, the secret the SHA-256 of the token | Confirmed | The doctor's canary PUT, HEAD and DELETE passed in runs 3 to 6 |
| B2 | Uploads are cheap | Class A operations are free up to 1 million a month; storage up to 10 GB-month | Confirmed | R2 pricing |
| B3 | Bucket locks protect real backups | Lock rules cover `backups/full/` (90 days), `backups/daily/` (30 days) and `ops/` (90 days), plus the `v1/` equivalents. **A rehearsal must never write under them**; it needs its own bucket or an unlocked prefix. `lifeboat/` is outside every rule | Confirmed | `src/files/layout.ts:524-531`; layout doc |
| B4 | (for the lifeboat) Uploading with `wrangler r2 object put` | Uses the API token directly (no S3 keys); up to 315 MB per object | Confirmed | Cloudflare R2 upload docs |

## C. Supabase (Free plan)

| # | The design assumes | Reality | Status | Evidence |
|---|---|---|---|---|
| C1 | Supabase keeps its own backups | **The Free plan has no platform backups.** Supabase tells Free projects to export with the CLI and keep off-site copies | Confirmed | Supabase backups docs |
| C2 | Connect through the session pooler, port 5432 | Correct. The direct connection is IPv6-only, and GitHub runners have no IPv6. The transaction pooler (6543) does not suit `pg_dump` | Confirmed | Supabase connection docs |
| C3 | `supabase db dump --db-url <backup role>` dumps what that role can read | **All three dump scripts pass `--role "postgres"`**, so `pg_dump` runs `SET ROLE postgres` after connecting. The backup role is **not** a member of `postgres` (`pg_has_role` = false). Every dump will fail with "permission denied to set role" | Confirmed | CLI source at v2.117.0 (`dump_schema.sh`, `dump_data.sh`, `dump_role.sh`); live check |
| C4 | The data dump covers the user tables | The CLI's data dump includes `auth`, `storage` and `cron`, which the backup role cannot fully read | Confirmed | CLI `dump.go` |
| C5 | The backup role can be granted what it needs | It reads **all 21 tables** in `public` and `supabase_migrations` and has `BYPASSRLS`. It has **no `USAGE` on schema `auth`**, and `postgres` cannot grant that. `postgres` can read `auth.users`. The Vault is refused, as designed | Confirmed | Live: `has_table_privilege`, `has_schema_privilege`; run 6 (`42501` on `vault`) |
| C6 | Size | 17 MB; Postgres 17.6; 20 tables in `public`, about 1,900 rows; extensions `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `pg_cron` (0 jobs), `supabase_vault`; schemas include `backup_private` (the key functions) | Confirmed | Live |
| C7 | The drill image is "Supabase Postgres", so a dump restores into it | The `supabase/postgres` 17.6.1.104 image creates only **5 of the 27 `auth` tables** and the functions `auth.uid()`, `auth.role()`, `auth.email()`; `storage` has no tables. **One live policy uses `auth.jwt()`**, and 24 foreign keys point into `auth` | Confirmed | Image source; live `pg_policies` |
| C8 | Sign-in accounts can be exported somehow | Routes: read them as `postgres`; a view owned by `postgres` that the backup role may read; or the Auth Admin API, which **does not return password hashes** | Confirmed | Supabase Auth docs; [07](07-decisions.md) RD-1 |
| C9 | A spare project for restore tests | **None.** The organisation already has two projects, and the Free plan allows two active free projects | Confirmed | Live project list |

## D. GitHub Actions (`ubuntu-24.04`, private repository)

| # | The design assumes | Reality | Status | Evidence |
|---|---|---|---|---|
| D1 | Docker, disk and memory are enough | 2 CPUs, 7.9 GB RAM, about 11 GB free disk, Docker 28 | Confirmed | `evidence/tools.json`, runs 5 and 6 |
| D2 | Minutes are affordable | 2,000 Linux minutes a month on GitHub Free, shared by the account's private repositories; every job rounds up to a whole minute. A failing run bills 1 to 2 | Confirmed | GitHub billing docs; `backup_runs.billed_minutes` |
| D3 | The runner's own Postgres tools | **Version 16.** `pg_dump` refuses a newer server, and the server is 17. Harmless today (the runner uses the 17 image in docker); it matters for any simpler workflow | Confirmed | Ubuntu 24.04 image readme |
| D4 | Scheduled runs happen on time | They "can be delayed during periods of high loads … some queued jobs may be dropped". The first scheduled run here started 5 h 38 min late | Confirmed | GitHub docs; plan-of-record P-17 |
| D5 | Someone is told when a scheduled run fails | GitHub emails **"the user who last modified the cron syntax in the workflow file"** | Confirmed | GitHub docs |
| D6 | `ubuntu-latest` | Pinned to `ubuntu-24.04` on purpose; `ubuntu-latest` moves to a new release in Oct–Nov 2026 | Confirmed | `db-backup.yml` header |

## E. age

| # | The design assumes | Reality | Status | Evidence |
|---|---|---|---|---|
| E1 | `age -r <recipient> -o <file>` writes the file | It does, but **it does not create the parent folder** | Confirmed | Run 5: `failed to write header … no such file or directory` |
| E2 | The key works | The doctor's trial encryption to the backup key passed in runs 5 and 6 (age v1.3.2) | Confirmed | Runs 5 and 6 |
| E3 | The private key is safe and usable | **Unproven.** No backup has ever been decrypted with a recovery kit, and the registry shows no kit confirmation | To verify | Stage 0.1 and Stage 5 of [06](06-plan.md) |

## F. What the design got right

The session pooler; the pinned runner image and drill image; the query exporter for full-text
tables; the R2 key derivation; refusing the Vault to the runner; and a local D1 drill that really
restored two real exports. **The architecture is workable.** The failures come from paths that were
never run, one hidden `SET ROLE`, an undocumented D1 limit, and the missing parts of a bare
drill image.

## G. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | D1 API and read-only queries (all three databases) | A1, A3, A4, A6 |
| 2026-09-25 | claude | Supabase read-only SQL: roles, grants, catalog, size | C3, C5, C6, C7 |
| 2026-09-25 | claude | Supabase CLI source at tag v2.117.0; `supabase/postgres` image source at 17.6.1.104 | C3, C4, C7 |
| 2026-09-25 | claude | GitHub job logs, runs 5 and 6 | A2, B1, D1, E1, E2 |
| 2026-09-25 | claude | Vendor docs, read the same day ([08](08-how-others-do-it.md)) | A5, B2, B4, C1, C2, D2 to D5 |

## H. Related

- [04-defect-register.md](04-defect-register.md): the defects these facts cause.
- [08-how-others-do-it.md](08-how-others-do-it.md): the sources, with links.

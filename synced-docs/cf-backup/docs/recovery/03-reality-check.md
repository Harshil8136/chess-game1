# 03: Reality check of each outside service

For each service: what the current design assumes, what is actually true, and how that was
checked. "Observed" means seen in a real run's log. "Live check" means a read-only query on
2026-09-25. "Source" means the tool's published source code at the version we pin.

## Cloudflare D1

| Design assumes | Reality | Evidence |
|---|---|---|
| The D1 query API accepts any SQL that SQLite accepts | **D1 rejects a `UNION ALL` with more than 5 parts** (`too many terms in compound SELECT`, code 7500). Plain SQLite allows 500. | Live check: a 6-part `SELECT 1 UNION ALL …` fails; the runner's 32-part count query on `madagascar-db` fails |
| `wrangler d1 export --output <path>` writes the file | It creates the export, polls, and downloads from a signed URL valid for **one hour**, then writes to `<path>`. **It does not create the parent folder.** | Observed, run 5 |
| Export handles every table | Virtual tables (full-text search) are not supported by the export; the runner's own query exporter covers them | [Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/); observed: `chatbot-kb` went through the query exporter |
| Time and size are not a concern | `madagascar-db` is about 16.5 MB; its export was created and downloaded in about 1 s | Observed, run 5 (step network counter) |
| (not part of the design) | **D1 Time Travel gives 7 days of point-in-time restore on the Free plan.** This is a native safety net for D1 while cf-backup is being fixed. It does not survive deleting the database or the account, so it is not an off-site backup. | [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) |
| A throwaway database for the monthly real-path drill | The Free plan allows 10 D1 databases per account; 3 are in use | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |

## Cloudflare R2 (S3 API from a GitHub runner)

| Design assumes | Reality | Evidence |
|---|---|---|
| S3 keys are derived from the API token at run time | Works: the access key is the token id and the secret is the SHA-256 of the token | [R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/); observed: the doctor's canary PUT, HEAD and DELETE passed in runs 3 to 5 |
| Uploads are cheap | They are. Class A operations are free up to 1 million a month, and storage is free up to 10 GB-month | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Object locks protect real backups | Lock rules cover the `backups/` and `ops/` prefixes. **So a rehearsal must never write under them**; it needs its own bucket or an unlocked prefix | Build ledger, 2026-09-25 (Stage 4 step 1-2) |

## Supabase (Free plan)

| Design assumes | Reality | Evidence |
|---|---|---|
| Supabase keeps its own backups | **The Free plan has no platform backups.** Supabase tells Free projects to export with the CLI and keep off-site copies | [Database backups](https://supabase.com/docs/guides/platform/backups) |
| Connect through the session pooler, port 5432 | Correct. The direct connection is IPv6-only unless a paid IPv4 add-on is bought, and GitHub-hosted runners have no IPv6. The transaction pooler (6543) does not suit `pg_dump`, which needs a whole session | [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres); [runner-images issue 668](https://github.com/actions/runner-images/issues/668) |
| `supabase db dump --db-url <backup role>` dumps what that role can read | **All three dump scripts in the CLI run `pg_dump`/`pg_dumpall --role "postgres"`**, which issues `SET ROLE postgres` after connecting. The backup role is **not** a member of `postgres` (`pg_has_role(…, 'MEMBER')` = false). Every dump will fail with "permission denied to set role". | Source: `apps/cli-go/pkg/migration/scripts/dump_{schema,data,role}.sh` at tag v2.117.0, copied word for word into the TypeScript CLI (`apps/cli/src/command-internal/legacy-pg-dump.scripts.ts`); live check |
| The data dump covers user tables | The CLI's data dump uses `--schema '*'` and excludes a list that leaves in **`auth`, `storage` and `cron`**. So it asks for tables the backup role cannot read | Source: `apps/cli-go/pkg/migration/dump.go`, `excludedSchemas` |
| The backup role can be granted what it needs | The role has `SELECT` on the `auth` tables but **no `USAGE` on schema `auth`**, and `postgres` cannot grant that. `postgres` itself can read `auth.users`, and holds `SELECT … WITH GRANT OPTION` on it. The role reads `storage.buckets` and `storage.objects` (both empty) but not the other 6 storage tables. 4 sequences are unreadable (`auth.refresh_tokens_id_seq`, `realtime.subscription_id_seq`, `cron.jobid_seq`, `cron.runid_seq`). The role has `BYPASSRLS`. The Vault is refused (as designed). | Live check; `sql/supabase/01_backup_reader.sql:44-49` |
| Size | The database is 17 MB; Postgres 17.6; extensions: pgcrypto, uuid-ossp, pg_stat_statements, pg_cron, supabase_vault | Live check |
| The drill image is "Supabase Postgres", so a dump restores into it | The image (`supabase/postgres` 17.6.1.104) creates only the **base** `auth` tables (`users`, `refresh_tokens`, `instances`, `audit_log_entries`, `schema_migrations`) and the functions `auth.uid()`, `auth.role()`, `auth.email()`. It creates the `storage` schema with **no tables**. Newer `auth` tables and `auth.jwt()` come from the Auth service's own migrations, which a bare `docker run` never runs. **One public policy on the live database uses `auth.jwt()`**, and 24 foreign keys point into `auth`. | Source: `migrations/db/init-scripts/0000000000000{1,2}-*.sql` at tag 17.6.1.104; live check |
| Sign-in accounts can be exported somehow | Three real routes: (a) read them as a role that can use `auth` (`postgres`), (b) a view or function owned by `postgres` that the backup role may read, (c) the Auth Admin API. **The Admin API does not return password hashes**, so restored users would all have to reset their passwords | [Admin: list users](https://supabase.com/docs/reference/javascript/auth-admin-listusers) |

## GitHub Actions (ubuntu-24.04, private repository)

| Design assumes | Reality | Evidence |
|---|---|---|
| Docker, disk and memory are enough | 2 CPUs, 7.9 GB RAM, about 11.6 GB free disk, Docker 28.0.4 | Observed: `evidence/tools.json`, run 5 |
| Minutes are affordable | Private repositories on the Free plan get **2,000 Linux minutes a month**, and each job is rounded up to a whole minute. The budget is shared by 3 repositories. A failing run took 1.5 min; a passing full run with both drills is estimated at 4 to 6 min | [Billing for GitHub Actions](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions) |
| IPv6 | Not available on hosted runners (the reason the session pooler is required) | [runner-images issue 668](https://github.com/actions/runner-images/issues/668) |
| `ubuntu-latest` | Pinned to `ubuntu-24.04` on purpose; `ubuntu-latest` moves to a new release in Oct-Nov 2026 | `db-backup.yml` header |

## age

| Design assumes | Reality | Evidence |
|---|---|---|
| `age -r <recipient> -o <file>` writes the file | It does, but **it does not create the parent folder** | Observed, run 5: `failed to write header: open …: no such file or directory` |
| The key works | The doctor's trial encryption (32 random bytes, header checked) passed in run 5, with age v1.3.2 | Observed |
| The private key is safe and usable | Not tested yet: no restore has ever decrypted a real backup with the owner's recovery kit | Nothing to show; this is Phase 4 of the plan |

## What the design got right

- The session pooler, the pinned runner image, the pinned drill image, the D1 query exporter for
  full-text tables, the R2 key derivation, the refusal of the Vault, and a local D1 drill that
  really restored two real exports.
- Stated plainly: the architecture is workable. The failures come from paths that were never run,
  one hidden `SET ROLE`, a D1 limit, and the missing parts of a bare drill image.

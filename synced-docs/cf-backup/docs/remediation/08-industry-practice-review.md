---
title: "cf-backup remediation — 08 Industry practice review (vendor guidance, reference implementations, established practices)"
status: active
audience: [owner, ai, technical]
last_verified: 2026-09-25
verified_against: [research, code]
owner: harshil
related_docs: [README.md, 02-root-cause-analysis.md, 03-dependency-assessment.md, 05-options-analysis.md, 06-remediation-plan.md, 09-secondary-pipeline-specification.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, research, best-practice, supabase, d1, r2, github-actions]
---

# 08 — Industry practice review

> **TL;DR (non-technical):** What Supabase, Cloudflare and GitHub recommend, what comparable teams
> actually run, where those setups fail, and the practices that prevent a data-protection system
> from failing as this one did. In short: most teams run a scheduled job of 30 to 120 lines, most
> never test a restore, and the ones that remain safe keep the pipeline small and restore from it
> regularly.

Sources were read on 2026-09-25. Each finding is marked **Confirmed** (read at the primary source)
or **Unconfirmed**.

## 1. Vendor guidance

### 1.1 Supabase (Free plan)

| # | Finding | Status | Source |
|---|---|---|---|
| 1 | **No platform backups on Free.** "We automatically back up all Pro, Team, and Enterprise Plan projects on a daily basis." Point-in-time recovery is a paid add-on. For Free: "We recommend that free tier plan projects regularly export their data using the Supabase CLI `db dump` command and maintain off-site backups." | Confirmed | [Database backups](https://supabase.com/docs/guides/platform/backups) |
| 2 | **The official off-site method** is three CLI exports as the `postgres` user through the session pooler: `db dump -f roles.sql --role-only`; `db dump -f schema.sql`; `db dump -f data.sql --use-copy --data-only`. Restore with `psql --single-transaction`, with `SET session_replication_role = replica` before the data | Confirmed | [Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) |
| 3 | **Supabase's own GitHub Actions example** runs the same three exports on a schedule and commits them to the repository, unencrypted | Confirmed | [Automated backups using GitHub Actions](https://supabase.com/docs/guides/deployment/ci/backups) |
| 4 | **The CLI cannot operate with a restricted role.** All three export scripts pass `--role "postgres"`; per the `pg_dump` manual this "causes pg_dump to issue a `SET ROLE` rolename command after connecting". A project cannot grant membership in `postgres` | Confirmed | [supabase/cli scripts at v2.117.0](https://github.com/supabase/cli/tree/v2.117.0/apps/cli-go/pkg/migration/scripts), [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) |
| 5 | **Connectivity.** Free's direct connection is IPv6-only; GitHub runners have no IPv6. Use the **session pooler** (5432) for `pg_dump`; the transaction pooler (6543) is unsuitable | Confirmed | [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [Migrating to Supabase](https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres) |
| 6 | **Authentication records.** Since 2025-04-21 projects are restricted in the `auth`, `storage` and `realtime` schemas; `postgres` can read `auth.users` but cannot grant a custom role `USAGE` on `auth`. Users and password hashes can be migrated to a new project, and "users do not need to reset" | Confirmed | [Changelog 34270](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025), [Migrating auth users](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects) |
| 7 | On PostgreSQL 16+, `postgres` holds `pg_read_all_data` with the admin option and could grant it to the export role. It reads every schema, `auth` included, and probably the Vault | Unconfirmed (source read, not tested) | Supabase image migrations; RD-10 |
| 8 | **The restore image is not a complete Supabase.** `supabase/postgres` creates only 5 `auth` tables; the rest come from the Auth service's migrations at start-up. Authentication records restore only into a full stack or a real project | Confirmed | Image and Auth sources |

### 1.2 Cloudflare D1

| # | Finding | Status | Source |
|---|---|---|---|
| 1 | `wrangler d1 export`: "Export is not supported for virtual tables, including databases with virtual tables"; "a running export will block other database requests"; `--remote` is required in Wrangler v4 | Confirmed | [Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/) |
| 2 | The export API is polled until it returns a signed URL; an unpolled export is cancelled | Confirmed | [D1 export API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/) |
| 3 | **Cloudflare's reference implementation** is a scheduled Workflow that streams the export into R2. The page describes it as simplified: no verification, no encryption | Confirmed | [Export and save D1 database](https://developers.cloudflare.com/workflows/examples/backup-d1/) |
| 4 | **Time Travel:** "30 days (Workers Paid) / 7 days (Free)"; restores in place, within the same account. Survival after database deletion is not documented | Confirmed | [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) |
| 5 | **The 5-term compound `SELECT` limit** is set in the runtime (`sqlite3_limit(db, SQLITE_LIMIT_COMPOUND_SELECT, 5)` in workerd) and is not on the limits page. Miniflare applies the same limit; plain SQLite allows 500 | Confirmed (source) | [workerd sqlite.c++](https://github.com/cloudflare/workerd/blob/main/src/workerd/util/sqlite.c%2B%2B), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |

### 1.3 Cloudflare R2

| # | Finding | Status | Source |
|---|---|---|---|
| 1 | Uploads from Actions use `aws s3 cp --endpoint-url …`, `rclone`, or `wrangler r2 object put` (up to 315 MB, one object at a time) | Confirmed | [Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/) |
| 2 | **aws-cli compatibility:** since January 2025 aws-cli sends new checksum headers by default, which R2 refused for a period. Safe setting: `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`. Whether current aws-cli still requires it | Unconfirmed | [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/) |
| 3 | **Bucket locks** prevent deletion and overwrite under a prefix for a set period, even with a valid token, and override lifecycle rules | Confirmed | [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/) |

### 1.4 GitHub Actions

| # | Finding | Status | Source |
|---|---|---|---|
| 1 | "The `schedule` event can be delayed during periods of high loads … some queued jobs may be dropped." Avoid the start of the hour | Confirmed | [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) |
| 2 | "Notifications for scheduled workflows are sent to the user who last modified the cron syntax in the workflow file." | Confirmed | Same page |
| 3 | The 60-day automatic disablement applies to **public** repositories only (cf-backup is private) | Confirmed | Same page |
| 4 | `ubuntu-24.04` ships the PostgreSQL **16** client; "pg_dump cannot dump from PostgreSQL servers newer than its own major version". A public workflow found that installing 17 was insufficient: the default `pg_dump` still resolved to 16 | Confirmed | [Ubuntu 24.04 image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) |
| 5 | GitHub Free: 2,000 Linux minutes a month for private repositories; each job is rounded up to a whole minute | Confirmed | [Billing for GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |

## 2. Reference implementations

Public implementations of "export Supabase from GitHub Actions", surveyed on 2026-09-25:

| Implementation | Method | Size | Encrypted | Restore tested |
|---|---|---|---|---|
| [Supabase's own guide](https://supabase.com/docs/guides/deployment/ci/backups) | CLI trio; committed to the repository | ~30 lines | No | No |
| [cucoleadan/supabase-to-r2-backup](https://github.com/cucoleadan/supabase-to-r2-backup) | CLI trio; zip; `aws s3 cp` to R2 | 54 lines | No | No |
| [omerkaracay/supabase-to-r2-backup](https://github.com/omerkaracay/supabase-to-r2-backup) | Same pattern, to R2 | 55 lines | No | No |
| [Skywt2003/supabase-backup](https://github.com/Skywt2003/supabase-backup) | CLI trio; tar; `openssl` AES; committed to the repository | ~85 lines | Yes (passphrase) | No |
| [freegyes/project-ContemPlace](https://github.com/freegyes/project-ContemPlace) `backup.yml` | CLI, `public` schema; private repository; chat alert on failure | ~120 lines | No | Content checks only |
| [backupdrill/cli](https://github.com/backupdrill/cli) | `pg_dump` with a version check; checksums; S3 or R2 | a CLI | No | **Yes**, into a temporary PostgreSQL |
| cf-admin's legacy export workflow (ours, never run) | `pg_dump` of `public`; `wrangler d1 export`; gpg; artifacts | 260 lines | Yes | **Yes**, both stores |

Observations:

- **The norm is small**: a scheduled job of 30 to 120 lines that exports, compresses, uploads and
  alerts on failure. Every implementation runs the CLI as `postgres`.
- **The norm is also weak**: most do not encrypt, almost none test a restore, and none combines
  encryption, R2 and automated restore verification. cf-backup's objectives are correct, and
  above the norm.
- **The robust implementations remain small**: backupdrill and cf-admin's legacy workflow add
  restore verification in a few dozen lines.

## 3. Documented failure modes

| Failure mode | Documented case | Exposure here |
|---|---|---|
| **The export tool is older than the server** | GitLab, 2017-01-31: "the backup procedure was using `pg_dump` 9.2, while our database is running PostgreSQL 9.6". Their backups were empty, undetected ([post-mortem](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/)) | The runner's `/usr/bin/pg_dump` is 16; the server is 17 (N7) |
| **Failure alerts are not delivered** | GitLab: the failure emails were rejected by DMARC | cf-backup's alerts depend on cf-admin's Scheduler; scheduled GitHub failures notify only the last editor of the cron line |
| **No owner for restores** | GitLab: "Why was the backup procedure not tested on a regular basis? - Because there was no ownership." | No restore has ever been performed here |
| **Hidden tool behaviour** | The Supabase CLI's `SET ROLE postgres` | T5 / L1 |
| **An undocumented platform limit** | D1's 5-term limit ([emdash issue 895](https://github.com/emdash-cms/emdash/issues/895) encountered the same) | T2 |
| **A missing directory, file or secret** | cf-admin's legacy workflow (no secrets); runs 1, 2, 5 and 6 here | T1, N8 |

## 4. Established practices

### 4.1 Restores, not backups

- Google SRE book, chapter 26: "No one really wants to make backups; what people really want are
  restores." And: "you only know that you can recover your recent state if you actually do so."
  Automate restore tests and "run them continuously"; "set up alerts that fire when a recovery
  process fails to provide a heartbeat." **Confirmed.**
  [Data Integrity](https://sre.google/sre-book/data-integrity/)
- **3-2-1 rule:** three copies, on two types of media, one off-site. **Confirmed.**
  [CISA, Data Backup Options](https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf)

### 4.2 Minimum viable pipeline first

- Before features, a minimal version of the whole system that runs end to end in its real
  environment, so every later change lands on something proven to work. Freeman and Pryce,
  *Growing Object-Oriented Software, Guided by Tests*, ch. 4, where it is called a "walking
  skeleton" (Alistair Cockburn's term). For a data-protection system, it is one encrypted recovery
  point in the archive that has been restored once.
  [GOOS contents](https://growing-object-oriented-software.com/toc.html)

### 4.3 Testing against real tools

- **Only mock types you own:** a test double of a third-party tool proves only that the code
  matches the double (GOOS, ch. 8).
  [Summary](https://enterprisecraftsmanship.com/posts/growing-object-oriented-software-guided-by-tests-without-mocks/)
- **Contract tests:** "testing against a double always raises the question of whether the double
  is indeed an accurate representation"; separate tests check the double against the real service.
  [Martin Fowler, ContractTest](https://martinfowler.com/bliki/ContractTest.html)
- **Real services in CI:** Testcontainers; GitHub Actions service containers.
  [Testcontainers](https://testcontainers.com/guides/introducing-testcontainers/),
  [PostgreSQL service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)
- **Application here:** D1 SQL tested against Miniflare (which enforces the real limit and ships in
  the `wrangler` package already in this repository), not plain SQLite; the PostgreSQL export tested
  inside the real `supabase/postgres` image; every test double fails as its real tool fails.

### 4.4 Detecting a missed recovery point

- **Heartbeat monitoring** outside the monitored system: an alert fires when an expected success
  ping does not arrive. Free tiers: healthchecks.io (20 checks), Cronitor (5), Better Stack (10).
  **Confirmed** (pricing pages). cf-backup already monitors its Scheduler this way
  (`tick-deadman.yml`).
- **Measure Recovery Point Actual:** the age of the newest verified recovery point, not "the job
  succeeded". Google's checklist asks: "Are your backups valid and complete, or are they empty?"

### 4.5 Key management

- `age` accepts multiple recipients (`-r` repeated); any one can decrypt. Keep the public key in CI
  and at least two private copies offline, and test that each decrypts. A lost private key means
  unrecoverable archives. **Confirmed.** [age](https://github.com/FiloSottile/age)
- age does not authenticate the sender: anyone with the public key can produce a valid-looking
  file. Keep checksums or a manifest separately, and lock the bucket prefix.
  [Filippo Valsorda, age and authentication](https://words.filippo.io/age-authentication/)

## 5. Gap analysis for cf-backup

| Practice | cf-backup today | Remediation ([06](06-remediation-plan.md)) |
|---|---|---|
| A verified recovery point exists before features are built | No: none after 6 runs | Stages 0 and 1 |
| Restores tested regularly | Never | Stage 1 (every Secondary Pipeline run); Stage 5 (by a person) |
| 3-2-1 | 1 copy (the primary) for Supabase | Stage 0 (manual baseline export); Stage 1 (R2 plus a GitHub artifact) |
| Test doubles match the real tools | They do not (P1) | Stage 2: Pre-production Validation and contract tests |
| Two offline key copies, each tested | 0 confirmed | Stage 0; Stage 5 |
| Export tool matches the server | Yes in docker (17); no on the runner (16) | Both pipelines use the pinned 17 image |
| Missed-run alerting outside the system | For the Scheduler, not for recovery points | Stage 1 (GitHub notification); RD-9 (external heartbeat monitor) |
| A small core | 8,662 runner lines; 5 external programs | Stage 2 removes the Supabase CLI; RD-11 decides the Primary Pipeline's shape |
| Professional, consistent naming | Informal identifiers in code and console | [11](11-terminology-standard.md); RD-14 |

## 6. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Vendor documentation read (Supabase, Cloudflare, GitHub, PostgreSQL) | §1 |
| 2026-09-25 | claude | Source read: Supabase CLI v2.117.0, `supabase/postgres` 17.6.1.104, workerd, runner-images | §1.1 items 4, 7, 8; §1.2 item 5; §1.4 item 4 |
| 2026-09-25 | claude | Public repositories reviewed | §2 |
| 2026-09-25 | claude | GitLab post-mortem, SRE book ch. 26, CISA, GOOS, Fowler, Testcontainers | §3, §4 |

## 7. Related

- [02-root-cause-analysis.md](02-root-cause-analysis.md) §3: why a verified recovery point comes first.
- [05-options-analysis.md](05-options-analysis.md): how these practices shaped the selected approach.
- [09-secondary-pipeline-specification.md](09-secondary-pipeline-specification.md): the minimum viable pipeline for this system.

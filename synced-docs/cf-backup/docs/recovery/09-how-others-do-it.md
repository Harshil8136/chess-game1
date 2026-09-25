# 09: How others do it

What the vendors recommend, what small teams actually run, where those setups fail, and the
engineering practices that stop a backup system from failing the way this one did. Sources were
read on 2026-09-25. Each item says whether it was checked at the primary source (**confirmed**)
or not (**unconfirmed**).

## 1. What the vendors say

### Supabase (Free plan)

- **No platform backups on Free.** "We automatically back up all Pro, Team, and Enterprise Plan
  projects on a daily basis." Point-in-time recovery is a paid add-on. For Free projects, Supabase
  says: "We recommend that free tier plan projects regularly export their data using the Supabase
  CLI `db dump` command and maintain off-site backups." **Confirmed.**
  [Database backups](https://supabase.com/docs/guides/platform/backups)
- **The official off-site method** is three dumps (roles, schema, data) made with the CLI **as the
  `postgres` user**, through the session pooler. **Confirmed.**
  [Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

  ```
  supabase db dump --db-url [CONNECTION_STRING] -f roles.sql --role-only
  supabase db dump --db-url [CONNECTION_STRING] -f schema.sql
  supabase db dump --db-url [CONNECTION_STRING] -f data.sql --use-copy --data-only
  ```

- **Supabase's own GitHub Actions example** runs the same three dumps on a schedule and commits
  them to the repository, with no encryption. **Confirmed.**
  [Automated backups using GitHub Actions](https://supabase.com/docs/guides/deployment/ci/backups)
- **Why the CLI cannot work with a restricted role.** All three of the CLI's dump scripts pass
  `--role "postgres"` (source at tag v2.117.0: `apps/cli-go/pkg/migration/scripts/dump_schema.sh`,
  `dump_data.sh`, `dump_role.sh`). `pg_dump`'s manual: this option "causes pg_dump to issue a
  `SET ROLE` rolename command after connecting." A role that is not a member of `postgres` fails
  there, and a project cannot grant membership in `postgres`. **Confirmed.**
  [supabase/cli](https://github.com/supabase/cli/tree/v2.117.0/apps/cli-go/pkg/migration/scripts),
  [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- **Connections.** On Free, the direct connection is IPv6-only, and GitHub-hosted runners have no
  IPv6. Supabase recommends the **session pooler** (port 5432) for `pg_dump`. The transaction pooler
  (6543) is unsuitable. **Confirmed.**
  [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres),
  [Migrating to Supabase](https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres)
- **Sign-in accounts.** Since 2025-04-21, Supabase restricts what projects may do in the `auth`,
  `storage` and `realtime` schemas. `postgres` can read `auth.users`, but it cannot give a custom
  role `USAGE` on schema `auth`. Users and their password hashes can be moved to a new project,
  and "users do not need to reset". **Confirmed.**
  [Changelog 34270](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025),
  [Migrating auth users](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)
- **One more route, not tested:** on Postgres 16 and later, Supabase grants `pg_read_all_data` to
  `postgres` with the admin option, so `postgres` could grant it to the backup role. It gives read
  access to every schema, `auth` included, and **probably the Vault too**, which the design refuses.
  It is **unconfirmed** and rejected unless a test shows the Vault stays closed
  ([10](10-robust-plan.md), decision D10).
- **The drill image is not a whole Supabase.** The `supabase/postgres` image creates only 5 `auth`
  tables. The others (identities, sessions, MFA and more) come from the Auth service's own
  migrations when it starts. Sign-in data can only be restored into a full stack
  (`supabase start`) or into a real project. **Confirmed** (image and Auth sources).

### Cloudflare D1

- **`wrangler d1 export`** writes schema and data as SQL. "Export is not supported for virtual
  tables, including databases with virtual tables", and "a running export will block other
  database requests." `--remote` is required in Wrangler v4. **Confirmed.**
  [Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- **The export API** (`POST …/d1/database/{id}/export`) is polled until it returns a signed URL.
  An export that is not polled is cancelled. **Confirmed.**
  [D1 export API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/)
- **Cloudflare's own backup tutorial** is a scheduled Workflow that calls that API and streams the
  file into R2. The page calls it simplified: it has no verification and no encryption.
  **Confirmed.** [Export and save D1 database](https://developers.cloudflare.com/workflows/examples/backup-d1/)
- **Time Travel:** "30 days (Workers Paid) / 7 days (Free)". It restores in place, and it lives in
  the same account. Whether it survives deleting the database is **not documented**. It is a safety
  net, not an off-site backup. **Confirmed.**
  [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- **The 5-part `UNION ALL` limit** is set in Cloudflare's runtime (`sqlite3_limit(db,
  SQLITE_LIMIT_COMPOUND_SELECT, 5)` in workerd) and is not on D1's limits page. Miniflare, the local
  simulator, has the same limit. Plain SQLite allows 500. **Confirmed** (source).
  [workerd sqlite.c++](https://github.com/cloudflare/workerd/blob/main/src/workerd/util/sqlite.c%2B%2B),
  [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

### Cloudflare R2

- Uploads from Actions are usually done with `aws s3 cp --endpoint-url …`, `rclone`, or
  `wrangler r2 object put` (up to 315 MB per object, one object at a time). **Confirmed.**
  [Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/)
- **aws-cli trap:** since January 2025, aws-cli and the AWS SDKs send new checksum headers by
  default, and R2 refused some of them for a while. The safe setting is
  `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`. Whether today's aws-cli works without it is
  **unconfirmed**. [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- **Bucket locks** stop deletion and overwrite under a prefix for a set time, even with a valid
  token. They override lifecycle rules. **Confirmed.**
  [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)

### GitHub Actions

- **Scheduled runs can be late or dropped:** "The `schedule` event can be delayed during periods of
  high loads … If the load is sufficiently high enough, some queued jobs may be dropped." Avoid the
  start of the hour. **Confirmed.**
- **Who is told when a scheduled run fails:** "Notifications for scheduled workflows are sent to
  the user who last modified the cron syntax in the workflow file." **Confirmed.**
- The 60-day automatic disable applies to **public** repositories only (cf-backup is private).
  **Confirmed.**
  [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- **The runner's own Postgres tools are version 16.** `ubuntu-24.04` ships the PostgreSQL 16
  client, and "pg_dump cannot dump from PostgreSQL servers newer than its own major version".
  At least one public workflow found that installing version 17 was not enough: the default
  `pg_dump` still resolved to 16. **Confirmed.**
  [Ubuntu 24.04 image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
- **Minutes:** private repositories on GitHub Free get 2,000 Linux minutes a month, and every job
  is rounded up to a whole minute. **Confirmed.**
  [Billing for GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## 2. What small teams actually run

Public examples of "back up Supabase from GitHub Actions" found on 2026-09-25:

| Example | Method | Size | Encrypted | Restore tested |
|---|---|---|---|---|
| [Supabase's own guide](https://supabase.com/docs/guides/deployment/ci/backups) | CLI trio; commits to the repo | ~30 lines | No | No |
| [cucoleadan/supabase-to-r2-backup](https://github.com/cucoleadan/supabase-to-r2-backup) | CLI trio; zip; `aws s3 cp` to R2 | 54 lines | No | No |
| [omerkaracay/supabase-to-r2-backup](https://github.com/omerkaracay/supabase-to-r2-backup) | Same pattern, to R2 | 55 lines | No | No |
| [Skywt2003/supabase-backup](https://github.com/Skywt2003/supabase-backup) | CLI trio; tar; `openssl` AES; commits to the repo | ~85 lines | Yes (passphrase) | No |
| [freegyes/project-ContemPlace](https://github.com/freegyes/project-ContemPlace) `backup.yml` | CLI, public schema; private repo; chat alert on failure | ~120 lines | No | Content checks only |
| [backupdrill/cli](https://github.com/backupdrill/cli) | `pg_dump` with a version check; checksums; S3 or R2 | a CLI | No | **Yes**, into a throwaway Postgres |
| cf-admin's `backups.yml` (ours, never run) | `pg_dump` of `public`; `wrangler d1 export`; gpg; artifacts | 260 lines | Yes | **Yes**, both stores |

What this shows:

- **The norm is small.** A scheduled job of 30 to 120 lines: dump, compress, upload, and alert on
  failure. Every example runs the CLI as `postgres`.
- **The norm is also weak.** Most do not encrypt, and almost none test a restore. None of the
  examples found combines encryption, R2 and an automated restore check. cf-backup's goals
  (encrypted, off-site, restore-tested, with evidence) are right, and they are above the norm.
- **The strong setups stay small.** backupdrill and our own cf-admin workflow add a restore check
  in a few dozen lines. A restore test does not need a large system.

## 3. Where these setups fail in practice

| Failure | Real case | Our exposure |
|---|---|---|
| **The dump tool is older than the server** | GitLab, 2017-01-31: "the backup procedure was using `pg_dump` 9.2, while our database is running PostgreSQL 9.6". Their backups had been empty, and nobody knew. [Postmortem](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/) | The runner's `/usr/bin/pg_dump` is 16 and the server is 17 (08, N7) |
| **Failure alerts never arrive** | GitLab again: the failure emails were rejected by DMARC | cf-backup's alerts ride cf-admin's tick. Failed scheduled GitHub runs email only the last person to edit the cron line |
| **Nobody owns the restore** | GitLab: "Why was the backup procedure not tested on a regular basis? - Because there was no ownership." | No restore has ever been done here, by hand or in CI |
| **A tool does something hidden** | The Supabase CLI's `SET ROLE postgres` | L1 in [04](04-latent-defects.md) |
| **An undocumented platform limit** | D1's 5-part `UNION ALL` limit ([emdash issue 895](https://github.com/emdash-cms/emdash/issues/895) hit the same wall) | T2 |
| **A missing folder, file or secret** | cf-admin's bridge (no secrets); runs 1, 2, 5 and 6 here | T1, and the setup gap |

## 4. The practices that prevent this

### Restores, not backups

- Google SRE book, chapter 26: "No one really wants to make backups; what people really want are
  restores." And: "you only know that you can recover your recent state if you actually do so."
  It says to automate restore tests and "run them continuously", and to "set up alerts that fire
  when a recovery process fails to provide a heartbeat." **Confirmed.**
  [Data Integrity](https://sre.google/sre-book/data-integrity/)
- **3-2-1:** three copies, on two kinds of media, one of them off-site. **Confirmed.**
  [CISA, Data Backup Options](https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf)

### Build the smallest real thing first

- **Walking skeleton.** Before building features, build a tiny version of the whole system that
  really runs end to end, in its real environment. Every later change then lands on something
  proven to work. This is Freeman and Pryce's approach in *Growing Object-Oriented Software,
  Guided by Tests* (ch. 4); the term is Alistair Cockburn's. For a backup system, the skeleton is
  one real encrypted file in the bucket that has been restored once.
  [GOOS table of contents](https://growing-object-oriented-software.com/toc.html)

### Test against the real tools

- **Only mock types you own.** A fake of someone else's tool shows only that the code matches
  the fake (GOOS, ch. 8). [Summary](https://enterprisecraftsmanship.com/posts/growing-object-oriented-software-guided-by-tests-without-mocks/)
- **Contract tests.** "testing against a double always raises the question of whether the double
  is indeed an accurate representation"; so run separate contract tests that check the double
  against the real thing. Martin Fowler. [ContractTest](https://martinfowler.com/bliki/ContractTest.html)
- **Real services in CI**: Testcontainers, and GitHub Actions service containers.
  [Testcontainers](https://testcontainers.com/guides/introducing-testcontainers/),
  [Postgres service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)
- **Applied here:** test D1 SQL against Miniflare (which enforces the real limit, and ships inside
  the `wrangler` package already in this repository), not plain SQLite. Test the Postgres dump
  inside the real `supabase/postgres` image. Make every fake fail the way the real tool fails.

### Detect a backup that did not happen

- **A dead-man's switch** outside the system being watched: a service that alerts when an expected
  "I ran" ping does not arrive. Free options: healthchecks.io (20 checks), Cronitor (5), Better Stack
  (10). **Confirmed** (pricing pages). cf-backup already has one for its tick (`tick-deadman.yml`),
  which uses GitHub's own failure email.
- **Measure one number:** the age of the newest backup that has been restored. Not "the job
  succeeded". Google's checklist asks: "Are your backups valid and complete, or are they empty?"

### Keys

- `age` accepts several recipients (`-r` more than once), and any one of them can decrypt. Keep the
  public key in CI and at least two private copies offline, and test that each one decrypts. A lost
  private key means the backups are lost. **Confirmed.** [age](https://github.com/FiloSottile/age)
- age does not sign. Anyone with the public key can make a valid-looking file. So store checksums
  or a manifest separately, and lock the bucket prefix. Filippo Valsorda.
  [age and authentication](https://words.filippo.io/age-authentication/)

## 5. What this means for cf-backup

| Practice | cf-backup today | Where the plan fixes it |
|---|---|---|
| A real backup exists before features are built | No: 0 files after 6 runs | [10](10-robust-plan.md), Stages 0 and 1 |
| Restore tested regularly | Never | Stage 1 (automatic, every run) and Stage 5 (by a person) |
| 3-2-1 | 1 copy (the primary) for Supabase | Stage 0 (a manual copy), Stage 1 (R2 plus a GitHub artifact) |
| Fakes match the real tools | They do not (02, P1) | Stage 2: rehearsal and contract tests |
| Keys: two offline copies, each tested | 0 confirmed | Stage 0, step 1; Stage 5 |
| Dump tool matches the server | Yes in docker (17); no on the runner (16) | The lifeboat and the main runner both use the pinned 17 image |
| Missed-backup alarm outside the system | Yes for the tick; not for the backups | Stage 1 (GitHub failure email), decision D9 (an outside dead-man) |
| Keep the core small | 8,700 lines in the runner; 5 outside programs | Stage 2 removes the Supabase CLI; D11 decides the runner's future |

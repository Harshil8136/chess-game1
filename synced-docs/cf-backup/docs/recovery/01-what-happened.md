# 01: What happened, run by run

Sources: `gh run view <id> --log` for every run of `db-backup.yml`, and the 14-day artifact of the
last run (its `evidence/` and `report.md`). Times are UTC. Log lines are quoted exactly, except
that ids are cut and paths shortened to `…/cf-backup/` (the runner's temp folder).

## Summary

| # | When | GitHub run | Mode | Result | First thing that stopped it |
|---|---|---|---|---|---|
| 1 | 09-24 04:00 | 35953834471 | drill | failed, run lost | Setup incomplete: token refused, secret and key missing, every R2 upload 403 |
| 2 | 09-24 05:12 | 35958942742 | drill | failed | No backup key yet (`BACKUP_AGE_RECIPIENT` not set) |
| - | 09-24 | (Worker, not a run) | - | fixed | Vault reads through Hyperdrive hung on the transaction pooler; moved to the session pooler |
| 3 | 09-25 03:17 | 36089730779 | preflight | **reported success; actually failed** | doctor crashed on `d1_ok`; the verdict did not notice |
| 4 | 09-25 03:25 | 36090273258 | backup | failed | doctor crashed on `d1_ok`; no store ran |
| 5 | 09-25 03:59 | 36092596416 | backup | failed | Three missing-folder defects, and a D1 query limit |

## Run 1: 09-24 04:00, drill (35953834471)

Evidence (the log of this older workflow has one step):

```
plan WARN backup_runs … not moved to running: Authentication error
doctor secret:SUPABASE_DB_URL: fail — not set
doctor variable:BACKUP_AGE_RECIPIENT: fail — not set
doctor d1:madagascar-db: fail — D1 query failed: Authentication error
doctor r2: fail — the token cannot read <the backup bucket>
seal WARN upload failed for verify/source-counts.json: R2 put … failed: 403 AccessDenied
manifest WARN upload failed for manifest.json: R2 put … failed: 403 AccessDenied
```

**Cause:** the run was started before setup was finished. The Cloudflare token in the repository
could not use D1 or R2, `SUPABASE_DB_URL` was not set and no backup key existed. The doctor
reported all of it correctly. Seal still tried 17 uploads, and all of them were refused, so no
manifest was written and the console recorded the run as lost. **Nothing here is a code defect,
but there was no "setup is complete" gate before a real run could be started.**

## Run 2: 09-24 05:12, drill (35958942742)

```
doctor variable:BACKUP_AGE_RECIPIENT: fail — not set
doctor age-recipient: fail — BACKUP_AGE_RECIPIENT is not set
```

**Cause:** no backup key yet. The owner created the first key on 09-25 at about 03:45. The `d1_ok`
defect (run 4) was already in the code; it was hidden because the doctor stopped first.

## Run 3: 09-25 03:17, preflight "runner test" (36089730779)

GitHub marked this run **success**, and the console showed a warning (no key). The log shows
something else:

```
doctor ERROR doctor failed: bad step output d1_ok
##[error]Process completed with exit code 1.
seal a runner test: doctor only, no export; writing only manifest.json, evidence/doctor.json, evidence/run.log.gz
```

**Cause:** the doctor step has `continue-on-error: true` (`.github/workflows/db-backup.yml:113`).
The runner-test verdict (`scripts/backup/lib/verdict.ts:483-491`) reads the doctor's report file,
which was written before the crash, and never reads the step's exit code. **The one run meant to
prove the runner was ready passed while the doctor was broken.** Eight minutes later, run 4 failed
on exactly that defect.

## Run 4: 09-25 03:25, full backup (36090273258)

```
doctor ERROR doctor failed: bad step output d1_ok
seal ##[error]d1:madagascar-db: no backup was taken (the D1 step did not run)
seal ##[error]postgres: no backup was taken (the Postgres step did not run)
```

**Cause:** `scripts/backup/lib/github.ts` accepted step-output names only if they matched
`/^[a-z_]+$/`, a rule in place since the first runner commit (2026-09-23). `d1_ok` contains a
digit, so the doctor threw while writing its outputs, and the per-store gates (`d1_ok`, `pg_ok`)
never worked on GitHub. Fixed in cf50a5c (the rule is now `/^[a-z][a-z0-9_]*$/`, line 34).

## Run 5: 09-25 03:59, full backup (36092596416)

The doctor passed all 20 checks. Then every store failed.

### D1: `madagascar-db` export

```
d1:madagascar-db:export $ node …/wrangler.js d1 export madagascar-db --remote --skip-confirmation --output …/cf-backup/plain/d1/madagascar-db.sql
d1:madagascar-db:export [out] ├ Downloading SQL to …/cf-backup/plain/d1/madagascar-db.sql
d1:madagascar-db:export [err] ✘ [ERROR] A file or directory could not be found.
d1:madagascar-db:export [err]   Missing file or directory: …/cf-backup/plain/d1/madagascar-db.sql
d1:madagascar-db:export madagascar-db: 32 tables, 0 rows, exported by wrangler-export in ? s
```

**Cause 1: the folder `plain/d1/` did not exist.** The path is built in
`scripts/backup/lib/context.ts:68`. The D1 command (`scripts/backup/lib/commands.ts:269-274`)
creates only `wrangler-cwd/`, and `backupD1Database` (`scripts/backup/lib/d1-backup.ts:128-139`)
passes the path straight to `wrangler d1 export --output`, which does not create folders. The
download had already finished (16.5 MB received in the step), and only the file write failed.

The other two databases show how the order hid this defect. `chatbot-kb` has a full-text (virtual)
table, so it goes through our own query exporter. That exporter writes with `writeText`, which
*does* create the folder (`scripts/backup/sys/fs.ts:42-45`), so it succeeded ("5 tables, 87 rows")
and created `plain/d1/` as a side effect. `whatsapp-chatbot`, exported by wrangler after that,
then succeeded too.

**Cause 2: "0 rows".** For `madagascar-db` the row-count query failed without a word in the log;
`evidence/source-counts.json` holds `"d1:madagascar-db": {"before": {}, "after": {}}`, and the run
meter has no `counts:before` query for that database. Running the same query shape read-only
against the live database on 2026-09-25 returns:

```
too many terms in compound SELECT: SQLITE_ERROR   (code 7500)
```

D1 rejects a `UNION ALL` with 6 parts (a 6-part `SELECT 1 UNION ALL … SELECT 6` fails too). The
counts query (`scripts/backup/lib/d1-schema.ts:123-125`) and the fingerprint query (`:128-139`) use
one part per table: 32 for `madagascar-db`. **This database would have failed even with the folder
fixed.** The error went into `problems[]` and was never logged (see L7 in
[04](04-latent-defects.md)).

### Postgres dump

```
postgres:dump WARN postgres: auth.users is not readable by the dump role, so its data is not in this backup (estimated rows: 6)
postgres:dump postgres: left out 37 unreadable table(s): auth.audit_log_entries, …
postgres:dump $ supabase db dump --db-url *** -f …/cf-backup/plain/postgres/roles.sql --role-only
postgres:dump [err] failed to open dump file: NotFound: FileSystem.writeFile (…/cf-backup/plain/postgres/roles.sql)
postgres:dump postgres: 0 tables, 0 rows in the dump, 1.1 s
```

**Cause: the folder `plain/postgres/` did not exist.** The path is built in
`scripts/backup/lib/context.ts:69` and used in `scripts/backup/lib/pg-backup.ts:163-181`. The
Postgres command creates only `supabase-cwd/` (`scripts/backup/lib/commands.ts:333`). The first of
the five dumps failed, so the other four never ran.

**Also reported:** 37 tables in `auth`, `storage`, `realtime` and `vault` are unreadable by the
backup role, among them `auth.users` (6 sign-in accounts) and `auth.identities` (12). Run 5 never
reached the next Postgres defect (L1 in [04](04-latent-defects.md)).

### Seal (encryption)

```
seal $ …/tools/age/age -r <recipient> -o …/cf-backup/out/2026-09-25_full_gh36092596416a1/data/d1-chatbot-kb.sql.gz.age …/cf-backup/plain/d1/chatbot-kb.sql.gz
seal [err] age: error: failed to write header: open …/out/2026-09-25_full_gh36092596416a1/data/d1-chatbot-kb.sql.gz.age: no such file or directory
```

(×4: the full and schema files of `chatbot-kb` and `whatsapp-chatbot`, the only two exports on
disk.)

**Cause: the folder `out/<run key>/data/` did not exist.** Seal's encrypt loop
(`scripts/backup/lib/seal.ts:298-305`) calls `age -o <folder>/data/…`
(`scripts/backup/lib/age.ts:86-88`). age does not create folders, and nothing creates `data/`
first. The evidence files written later in the same step use `writeBytes`, which creates its folder,
so the run folder ended up holding evidence and no data.

### What the report said

`report.md` in the artifact shows `integrity: pass` ("PRAGMA integrity_check ok; **Postgres
restored with ON_ERROR_STOP**"), `row-count: pass` and `fingerprints: pass`. That is a run where
Postgres was never dumped and one D1 database was never exported. The verdict was FAILED overall,
which is correct, but three of its lines were false (L6 in [04](04-latent-defects.md)).

### What worked in run 5, for the record

Real evidence that parts of the pipeline work: the doctor's 20 checks, including a real R2 PUT,
HEAD and DELETE from the runner and a real age encryption; wrangler's D1 export and download
(whatsapp-chatbot, about 1 s); the query exporter on a full-text database; and **the local D1
restore drill (node:sqlite) on the two databases that were exported**. The drill named only
`madagascar-db` as failing.

## Was the Stage 4 layout change to blame?

No. The layout change (f1ac864, 2026-09-24) renamed the encrypted files (`data/d1/<db>…` became
`data/d1-<db>…`). The code before it had the same gap: `git show f1ac864^` has no folder creation
in `seal.ts` or `d1-backup.ts`, and the `plain/` paths are unchanged. All three folder defects
date from the first runner commits (2026-09-23). No earlier real run got far enough to hit them.

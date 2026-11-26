---
title: "@oltrem/backup: settings and secrets, the table, error codes, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/backup/src/backup.ts, errors.ts, migrations]
---

# @oltrem/backup: settings and secrets, the table, error codes, tests

> Part of [the @oltrem/backup README](../README.md).

## Settings and secrets

| Name | Kind | What it is |
|---|---|---|
| `backup.account_id` | setting, system layer, vendor only, sensitive | the Cloudflare account the database lives in |
| `backup.database_id` | setting, system layer, vendor only, sensitive | the client's one D1 database |
| `backup.copy_database` | setting, system layer, owner | whether a run copies the database when it is not told; on |
| `backup.copy_files` | setting, system layer, owner | whether a run copies the files when it is not told; off |
| `backup.outside_store` | setting, system layer, owner | the storage connection a second copy of each database copy goes to; empty for none |
| `KIT_OPS_TOKEN` | Worker secret | an account token with two permissions, Account, D1, Edit for the export and Account, Account Analytics, Read for Status's budgets: the only Cloudflare token inside the Worker; its recipe is `@oltrem/core-health`'s |
| `BACKUP_PUBLIC_KEY` | Worker secret | the age public key every copy is encrypted to; its private half stays offline with the vendor |

The two settings exist only once the account and the database do: `oltrem backup setup`, run
once after the first deploy, writes them, puts a bucket lock on `backups/` (no copy can be
deleted or overwritten for 35 days) and a lifecycle rule that deletes a copy 90 days after it
was written (`@oltrem/cli`'s README). The two secrets' key recipes are on the module's
manifest, so they appear on the client's generated Key recipes page. Opening a copy needs the free `age` tool and the private key:

```sh
npx wrangler r2 object get <bucket>/backups/d1/<copy>.sql.age --remote --file copy.sql.age
age -d -i oltrem-backup-key.txt copy.sql.age > copy.sql
```

## The table and the error codes

| Migration | Adds to `backup_runs` |
|---|---|
| `0012_backup.sql` | id (the instance, or the drill's), kind (`export`, `drill`), who asked, status (`running`, `ok`, `failed`, `skipped`), start, end, object key, sizes, bookmark, recipient, error |
| `0066_backup_progress.sql` | `parts`, `step`, `verified`, `files`, `file_bytes`, `files_after`, `beat` |

| Code | Name | Status | When |
|---|---|---|---|
| `KIT-E-1601` | `NOT_SET_UP` | 409 | a setting or a secret the export needs is missing; the detail names it. A state to fix, not a fault, so no alert opens for a press of Back up now; the Backups page lists each with its fix |
| `KIT-E-1602` | `CLOUDFLARE_REFUSED` | 502 | Cloudflare's database API answered with an error, or the export did not finish |
| `KIT-E-1603` | `RUNNING` | 409 | an export started less than half an hour ago still runs |
| `KIT-E-1604` | `COPY_FAILED` | 502 | the dump could not be downloaded or stored |
| `KIT-E-1605` | `NOT_VERIFIED` | 502 | a stored copy did not have the size or checksum the run sent |
| `KIT-E-1606` | `NOTHING_CHOSEN` | 422 | a backup was asked for with neither the database nor the files ticked |

A public key that is not an `age1` recipient is `KIT-E-1307` (`@oltrem/core-crypto`).

## Not built yet

- How much CPU encrypting a large dump takes is measured on the sandbox.
- After a real restore from a copy in the SQLite tool's format, a search index such as Mail's is
  empty: it is made again from its definition, not from the copy, and is filled again by the
  module that owns it.
- The cache (KV) and the Worker's secrets are not copied: the cache fills itself again, and the
  secrets are made again from the Key recipes page.

## Tests

`test/backup.test.ts`, inside the Workers runtime on the real migrations, Cloudflare's API and the
signed address scripted and the Workflow a stand-in: a backup by hand audited, exported, polled,
encrypted (equal to the age format's own output) and streamed; a dump without its length; a
replayed instance; the capabilities; one export at a time; each refusal without the token or
address; the bookmark; both checks' thresholds; the parts and the refusal of none; files in steps,
never twice, again once changed; a copy reading back wrong; a second copy outside Cloudflare; an
FTS5 database exported in the SQLite tool's format.

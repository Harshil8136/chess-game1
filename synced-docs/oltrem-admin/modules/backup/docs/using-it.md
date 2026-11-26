---
title: "@oltrem/backup: using it, a run, routes, health, the drill"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/backup/src/backup.ts, cloudflare.ts]
---

# @oltrem/backup: using it, a run, routes, health, the drill

> Part of [the @oltrem/backup README](../README.md).

## Using it

```ts
import { createConfig } from '@oltrem/core-config';
import { createFlows } from '@oltrem/core-jobs';
import { createBackup } from '@oltrem/backup';

const backup = createBackup<Env>({
  bindings: (env) => ({ db: env.DB, files: env.FILES, jobs: env.JOBS }),
  target: async (env) => {
    const config = await settingsFor(env); // the client's createConfig, ensured
    return {
      accountId: config.get<string>('backup.account_id'),
      databaseId: config.get<string>('backup.database_id'),
    };
  },
  secrets: (env) => ({ opsToken: env.KIT_OPS_TOKEN, publicKey: env.BACKUP_PUBLIC_KEY }),
  // What a run copies when it was not told: the two settings below, read by the client.
  choice: async (env) => {
    const config = await settingsFor(env);
    return [
      ...(config.get<boolean>('backup.copy_database') ? (['database'] as const) : []),
      ...(config.get<boolean>('backup.copy_files') ? (['files'] as const) : []),
    ];
  },
});

// The Workflow class hands every instance to the flows of the mounted modules.
const flows = createFlows({ modules: [iam.module, backup.module] });
```

Mount `backup.module` beside IAM. The tick starts due flows (`flows.startDue`), `backup.export` at
`DEFAULT_SCHEDULE` (`0 3 * * *`) unless `schedule` says otherwise. The age format needs the
`nodejs_compat` flag.

## What a run does

| Step | What happens |
|---|---|
| `choose` | The parts it was started with (`POST /runs`), else `choice(env)`, else the database |
| `claim` | A `running` row for the instance; another export under `RUNNING_MS` (30 minutes) old makes it `skipped` with `KIT-E-1603`; a replayed instance finds its row |
| `export and copy` | The export asked with `KIT_OPS_TOKEN`, polled each second up to 300 times for a signed address; the dump downloaded without the token and encrypted to `BACKUP_PUBLIC_KEY`, streamed when its length is known, else held in memory. Tried three times, within fifteen minutes each |
| `verify` | The bucket's size and MD5 must equal what the run sent, else `KIT-E-1605`; opening is the drill's job |
| `copy outside` | Only with a second copy chosen: read back and kept, still encrypted, in that storage connection, checked by size; a failure is reported (an alert) but never fails the run |
| `files start`, `files 1`, … | Only with files: from where the last run stopped (`files_after`), `FILES_PAGE` (100) files a step, at most `FILE_STEPS` (100) steps; out of steps, it records where it stopped |
| `record` | `ok` with the key, sizes before and after encryption, bookmark, recipient, the check, files copied |
| `record the failure` | `failed` with code, detail and what was copied; the error goes on to the flow runner, which reports it once |
| `clear the alerts` | After an ok database copy, `cleared(env, parts)` resolves the alerts failed runs opened (the template's: errors of `flow backup.export`, unless files are ticked and this run skipped them); a failing clear never fails the run |

While running, `step` says where it is in words and `beat` when; the page refreshes every five
seconds. A beat older than 30 minutes is closed as failed by the next run. Only a run that copied
the database counts as a copy (for `backup.fresh`, Home, Get started, the drill).

**A search index.** Cloudflare refuses a database with a virtual table (Mail's FTS5 `mail_search`)
unless asked for the SQLite tool's format. The run reads `sqlite_master` first; with one, it asks
`dump_options.compatibility: 'sqlite3_cli_only'` and marks the copy `dump: sqlite3_cli_only`, which
`oltrem backup drill` prepares before loading.

The key is the run's start, `backups/d1/2026-10-21T03-00-00Z.sql.age`, never overwritten, with the
run id, bookmark and format as metadata. No error carries the token or the signed address.

## The files

A file is copied as it is (already in the bucket) to `backups/files/<key>~<etag>`, so a changed file
is a new copy. Only what is not copied whole yet is copied; each read pins the etag and each copy is
checked by size and checksum (by size for a multipart upload, counted). A file changed mid-run is
left for later. Nothing under `backups/` or the data module's `data/changes/` (`NOT_COPIED`) is
copied. File copies share the lock (35 days) and lifecycle (90 days) and take room in the same
bucket, which is why files start unticked.

## A second copy outside Cloudflare

Every copy above lives in the client's one account. With `outside` (the template passes Files'
storage connections, an S3 service of the client's own), an Owner picks one and each database copy
is kept there too (`backup.outside_store`, empty for none): the same encrypted bytes, opened only
with the Vendor's key. Files are not copied there.

## The nightly backup is an extra

`backup.nightly` starts off on a new portal, with the drill reminder (`backup.drill`). While off,
the schedule starts nothing, `backup.first` waits and `backup.fresh` is not run; a copy by hand,
the drill and restores work, and `nightly(env)` tells Home. Switched on, `backup.first` (every 15
minutes, idle six hours) starts the first copy once settings and keys exist, as the instance
`FIRST_COPY` (`backup-first-copy`), so it never starts twice. Get started shows "Make the first
backup copy" (with Make it now) or, while off with no copy, "Switch on backups"; the drill step
appears once a copy exists.

## Routes

Under `/api/backup`.

| Route | Needs | What it does |
|---|---|---|
| `GET /runs` | `backup.read` | The newest thirty: when, who, outcome, copy and size, parts, step, check, a failure's fix |
| `GET /status` | `backup.read` | `ready` and what is missing, nightly on and its schedule, `choice`, the run now |
| `GET /outside` | `backup.run` | With `outside`: `chosen` and the connections to pick |
| `POST /runs` | `backup.run` at the company | `{ parts }` or the ticked choice: none `KIT-E-1606`, database without its setup `KIT-E-1601` (files alone need nothing), running `KIT-E-1603`; else `202 { id }`, audited `backup.run` |
| `GET /time-travel` | `backup.read` | The bookmark now, for `wrangler d1 time-travel restore` |

Home's card (a module part) says how long ago the newest copy started and how it ended, or a quiet
Off while the nightly backup is off.

## Health

| Check (lane `backup`) | OK | Warn | Fail |
|---|---|---|---|
| `backup.fresh` | Newest copy within `FRESH_HOURS` (26) | To `STALE_HOURS` (50), no copy yet, or fresh after a failure | Past 50 hours, or no copy and the last run failed |
| `backup.drill` | A passed drill within `DRILL_DAYS` (35) | None yet, or older | The last failed |

The daily `backup.prune` removes run records past `RUNS_KEPT_DAYS` (365), keeping running ones and
the newest of each kind and outcome. Copies go after 90 days by the bucket's rule.

## The restore drill

Monthly, the vendor runs `oltrem backup drill --key <file>` from a signed-in wrangler: it downloads
the newest copy, opens it with age and the private key, loads it into a scratch database, finds
every table and row, deletes the scratch database and opened copy, and records a `drill` row. The
key never leaves the vendor's machine; the client's database is only read.

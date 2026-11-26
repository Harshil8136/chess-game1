---
title: "@oltrem/backup: Using it; What a run does; Routes; Health; The restore drill"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/backup/src; split from modules/backup/README.md]
---

# @oltrem/backup: Using it; What a run does; Routes; Health; The restore drill

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

Mount `backup.module` beside the IAM module. The tick starts the flows whose schedule fell due
(`flows.startDue` of `@oltrem/core-jobs`), `0 3 * * *` unless `schedule` says otherwise, on the
tick's own cron trigger. The Worker needs the `nodejs_compat` flag for the age format
(`@oltrem/core-crypto/age`).

## What a run does

| Step | What happens |
|---|---|
| `choose` | What this run copies: the parts it was started with (`POST /runs`), else `choice(env)`, else the database |
| `claim` | One row in `backup_runs` for the instance, `running`; when another export started less than thirty minutes ago and still runs, the row is `skipped` with `KIT-E-1603` and the run ends. A replayed instance finds its own row and does not run twice |
| `export and copy` | The export is asked for with `KIT_OPS_TOKEN` and polled once a second, up to 300 times, until Cloudflare hands back a signed address; the dump is downloaded from it, without the token, and encrypted to `BACKUP_PUBLIC_KEY` in the age format. A dump that comes with its length is streamed into the bucket and never whole in memory; one without is held in memory. The step is tried three times, a minute apart and then two, within fifteen minutes each |
| `verify` | The stored copy is checked: the size and MD5 checksum the bucket computed from what it received must be the size and checksum of what the run sent, or the run fails with `KIT-E-1605`. It proves the copy was stored whole; opening it is the restore drill's job |
| `copy outside` | Only when a second copy is chosen (below). The stored copy is read back from the bucket and kept again, still encrypted, under the same key in that storage connection, then checked there by its size. A failure never fails the run: the run says so in what its check found and the error is reported, so an alert opens |
| `files start`, `files 1`, … | Only when the files were chosen. The copy starts where the last files run stopped (`files_after`), else at the bucket's start. Each step checks 100 files (`FILES_PAGE`) and copies the ones not copied whole yet, at most 100 steps (`FILE_STEPS`) a run; a run that runs out of steps records where it stopped, and the next one goes on from there |
| `record` | The row is `ok`, with the object key, the size before and after encryption, the export's bookmark, the recipient, what the check found and how many files were copied |
| `record the failure` | The row is `failed`, with the code and the detail, and whatever the run had copied before it stopped; the error is thrown on to the flow runner, which reports it once (reporting it here too opened two alerts for one failure, seen live on 2026-11-14), and the instance fails |
| `clear the alerts` | After a run that copied the database and was recorded ok, `cleared(env, parts)`, which the client hands in, resolves the alerts failed runs opened (outside the run's failure path, so a clear that fails is reported and never marks the good run failed); the client template resolves the server errors of the area `flow backup.export`, where the flow runner reports a failed run, unless the files are ticked and this run did not copy them; the module's own errors (an audit or progress write) stay open |

While it runs, the row's `step` says where it is in words ("Waiting for Cloudflare to export
the database", "Copying files: 240 checked, 12 copied so far") and its `beat` when it last said
so; the Backups page shows the step and refreshes every five seconds. A run is taken as running
while its beat is under half an hour old. The next run to start closes one older than that as
`failed` ("the run stopped without finishing"), instead of leaving it running for ever. Only a run
that copied the database counts as a copy for `backup.fresh`, Home's Last backup, Get started
and the drill: files alone are not a database backup.

**A database with a search index.** Cloudflare's export refuses a database that holds a virtual
table (an FTS5 search index, such as Mail's `mail_search`) unless it is asked for the SQLite
tool's format (`dump_options.compatibility: 'sqlite3_cli_only'`, since 2026-11-12). Before each
export the run reads `sqlite_master` once: with a virtual table, every poll asks for that format
and the copy carries `dump: sqlite3_cli_only` as metadata; without one, nothing changes. A copy
in that format does not load into D1 as it is; `oltrem backup drill` prepares it first (below).

**The files.** A file is copied as it is, not encrypted (it is already in the same bucket), to
`backups/files/<key>~<etag>`, so a file changed since is a new copy and the old one stays until
the lifecycle rule deletes it. A run first looks for that copy and copies only what is not there,
so after the first run only new and changed files are copied. Each copy is read with the
original's etag pinned (a file changed half way is not copied wrong), and checked once written:
its size and checksum against the original's; a file uploaded in parts has no checksum as its
etag, so its copy is checked by size and the run says how many were. A file found already copied
counts only when the copy is the original's size and checksum. A file changed between the list and
the copy is counted and left for a later run. Nothing under `backups/` is ever copied, nor the data module's kept changes under `data/changes/` (`NOT_COPIED`): they are a client's rows, kept 30 days for Undo, and a locked copy would outlive that. The copies
are under the bucket lock and the lifecycle rule like the database copies: kept at least 35 days,
deleted after 90, after which the next run copies the file again. They take room in the same
bucket, which is why the files are not ticked on a new portal.

**A second copy outside Cloudflare**. Every copy above lives in the client's one Cloudflare account,
so losing the account loses them too. With `outside` given (the client template passes the storage
connections of Files, `@oltrem/files`, buckets at an S3 service of the client's own), an Owner picks
one on the Backups page and each database copy is kept there too (`backup.outside_store`, empty on a
new portal: no second copy, no step). The copy is the same encrypted bytes, so the storage never
sees the data, and opening it still needs the Vendor's private key. The files are not copied there.
`GET /outside` lists the choice for the page. Tests: "a second copy outside Cloudflare" in
`test/backup.test.ts`.

**The nightly backup is an extra** (`backup.nightly` on the Features page, since 2026-11-12), and a
new portal starts with it switched off, with the restore drill reminder (`backup.drill`): the
owner's decision that work on the timer is switched on, not found running. While it is off the
schedule starts no copy, `backup.first` waits and `backup.fresh` is not run; the page, a copy by
hand (`POST /runs`), the drill and a restore all work. `nightly(env)`, which the client hands in,
tells Home's card and step to say so. A portal whose list of modules was saved before keeps its
nightly copy.

With the nightly backup on, a new portal does not wait for the night: the job `backup.first` (every
fifteen minutes until the first copy exists, then every six hours, answering `'idle'`) starts the
first copy as soon as the settings and both keys are there, once. The instance is named
`backup-first-copy` (`FIRST_COPY`), so Workflows refuses a second start under it, and its run keeps
the name, so a start after Workflows forgot it finds the run and stops; once any export is in
`backup_runs` the job reads one row and does nothing. Home's Get started step "Make the first backup
copy" says it starts by itself, with a Make it now button (`POST /runs`) once backups are set up,
and who it waits for before then. While no copy exists and the nightly backup is off, Get started
shows one step instead, "Switch on backups", which opens System's Settings tab, where the switch
sits; the drill step appears only once a copy exists, since there is nothing to bring back before.

The object key is the run's start time, `backups/d1/2026-10-21T03-00-00Z.sql.age`, so a copy is
never written over. The object carries the run's id, the bookmark and the format as metadata. An
error never carries the token or the signed address.

## Routes

Under `/api/backup`, through the IAM module's sessions and check.

| Route | Capability | What it does |
|---|---|---|
| `GET /runs` | `backup.read` | The newest thirty runs: when, who, the outcome, the copy and its size, what was copied, where a running run is, what its check found, and the fix of a failed one's code |
| `GET /status` | `backup.read` | One read for the Backups page: whether the database can be copied (`ready`) and what is missing, whether the nightly backup is on and its schedule, what is ticked (`choice`), and the run going on now, if any |
| `GET /outside` | `backup.run` | Only with `outside` given: the storage connection a second copy goes to (`chosen`, '' for none) and the company's connections to choose from |
| `POST /runs` | `backup.run` at the company | Makes a backup now, of `{ parts: ['database', 'files'] }` or the ticked choice when the body names none: refused with `KIT-E-1606` when nothing is chosen, with `KIT-E-1601` when the database is chosen and something is missing (the files alone need nothing), and with `KIT-E-1603` while an export runs; otherwise the flow starts and the answer is `202 { id }`. Audited as `backup.run`, with the parts |
| `GET /time-travel` | `backup.read` | The database's Time Travel bookmark now, to note before a risky step and restore to with `wrangler d1 time-travel restore` |
| `GET /home` | `backup.read` | The Home card: how long ago the newest copy started, and how it ended; a quiet Off (`state: 'off'`) while the nightly backup is switched off, whatever the runs before did |

## Health

`backup.fresh`, in the `backup` lane: **ok** while the newest copy is at most 26 hours old,
**warn** up to 50 hours, and while there is no copy yet; **fail** beyond 50 hours, and when there
is no copy and the last run failed. A fresh copy after a failed run warns, with the failure, so it
is looked at before the next night.

`backup.drill`, in the same lane: **ok** while the last restore drill passed within 35 days,
**warn** when there is none yet or the last one passed longer ago, **fail** when the last one
failed.

The daily job `backup.prune` removes the records of runs older than a year (`RUNS_KEPT_DAYS`); a run
still running stays, and so does the newest of each kind and outcome, so a failed run never removes
the last good one, and both checks always have one to read. The copies themselves go after 90 days
by the bucket's own lifecycle rule, set by `oltrem backup setup`.

## The restore drill

A copy is only proven by opening it. Once a month the vendor runs `oltrem backup drill --key
<file>` (`@oltrem/cli`) from a signed-in wrangler: it downloads the newest copy, opens it with the
age tool and the private key, loads it into a scratch database, finds every table and row of the
copy there, deletes the scratch database and the opened copy, and records a `drill` row. The
private key never leaves the vendor's machine, and the client's database is only read.

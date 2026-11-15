# @oltrem/backup

Backups as the kit makes them (plan sections 4.4 and 9.3). Every night a flow in the client's one
Workflow asks Cloudflare to export the database, waits for the dump, encrypts it to the vendor's
age key on its way through the Worker and keeps it under `backups/d1/` in the files bucket. The
Worker holds only the public half of that key, so it can make a copy and can never open one. Each
run is a row the backup page lists, and a check on System status says how old the newest copy is.
Time Travel, D1's own restore to any minute of the last seven days, stays the first answer; the
copies cover what it does not: a deleted database, an account lost, a mistake found too late.

Since 2026-11-14 a run copies what was chosen: the **database**, the **files** of the files
bucket, or both. Each run says where it is while it runs, and checks every copy it stored
before it calls itself done. The Backups page (`@oltrem/screens`) is where the choice is ticked
and Back up now pressed.

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
the copy is counted and left for a later run. Nothing under `backups/` is ever copied. The copies
are under the bucket lock and the lifecycle rule like the database copies: kept at least 35 days,
deleted after 90, after which the next run copies the file again. They take room in the same
bucket, which is why the files are not ticked on a new portal.

**The nightly backup is an extra** (`backup.nightly` on the Modules page, since 2026-11-12), and a
new portal starts with it switched off, with the restore drill reminder (`backup.drill`): the
owner's decision that work on the timer is switched on, not found running. While it is off the
schedule starts no copy, `backup.first` waits and `backup.fresh` is not run; the page, a copy by
hand (`POST /runs`), the drill and a restore all work. `nightly(env)`, which the client hands in,
tells Home's card and step to say so. A portal whose list of modules was saved before keeps its
nightly copy.

With the nightly backup on, a new portal does not wait for the night: the job `backup.first`
(every fifteen minutes until the first copy exists, then every six hours, answering `'idle'`) starts
the first copy as soon as the settings and both keys are there, once. The instance is named
`backup-first-copy` (`FIRST_COPY`), so Workflows refuses a second start under it, and its run keeps
the name, so a start after Workflows forgot it finds the run and stops; once any export is in
`backup_runs` the job reads one row and does nothing. Home's Get started step "Make the first
backup copy" says it starts by itself, with a Make it now button (`POST /runs`) once backups are
set up, and who it waits for before then. While no copy exists and the nightly backup is off, Get
started shows one step instead, "Switch on backups", which opens the Backups page; the drill step
appears only once a copy exists, since there is nothing to bring back before.

The object key is the run's start time, `backups/d1/2026-10-21T03-00-00Z.sql.age`, so a copy is
never written over. The object carries the run's id, the bookmark and the format as metadata. An
error never carries the token or the signed address.

## Routes

Under `/api/backup`, through the IAM module's sessions and check.

| Route | Capability | What it does |
|---|---|---|
| `GET /runs` | `backup.read` | The newest thirty runs: when, who, the outcome, the copy and its size, what was copied, where a running run is, what its check found, and the fix of a failed one's code |
| `GET /status` | `backup.read` | One read for the Backups page: whether the database can be copied (`ready`) and what is missing, whether the nightly backup is on and its schedule, what is ticked (`choice`), and the run going on now, if any |
| `POST /runs` | `backup.run` | Makes a backup now, of `{ parts: ['database', 'files'] }` or the ticked choice when the body names none: refused with `KIT-E-1606` when nothing is chosen, with `KIT-E-1601` when the database is chosen and something is missing (the files alone need nothing), and with `KIT-E-1603` while an export runs; otherwise the flow starts and the answer is `202 { id }`. Audited as `backup.run`, with the parts |
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

## The restore drill

A copy is only proven by opening it. Once a month the vendor runs `oltrem backup drill --key
<file>` (`@oltrem/cli`) from a signed-in wrangler: it downloads the newest copy, opens it with the
age tool and the private key, loads it into a scratch database, finds every table and row of the
copy there, deletes the scratch database and the opened copy, and records a `drill` row. The
private key never leaves the vendor's machine, and the client's database is only read.

## Settings and secrets

| Name | Kind | What it is |
|---|---|---|
| `backup.account_id` | setting, system layer, vendor only, sensitive | the Cloudflare account the database lives in |
| `backup.database_id` | setting, system layer, vendor only, sensitive | the client's one D1 database |
| `backup.copy_database` | setting, system layer, owner | whether a run copies the database when it is not told; on |
| `backup.copy_files` | setting, system layer, owner | whether a run copies the files when it is not told; off |
| `KIT_OPS_TOKEN` | Worker secret | an account token with two permissions, Account, D1, Edit for the export and Account, Account Analytics, Read for System status's budgets: the only Cloudflare token inside the Worker; its recipe is `@oltrem/core-health`'s |
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

## Not here yet

- How much CPU encrypting a large dump takes is measured on the sandbox.
- After a real restore from a copy in the SQLite tool's format, a search index such as Mail's is
  empty: it is made again from its definition, not from the copy, and is filled again by the
  module that owns it.
- The cache (KV) and the Worker's secrets are not copied: the cache fills itself again, and the
  secrets are made again from the Key recipes page.

## The table and the error codes

`backup_runs` (migration `0012_backup.sql`): the id (the Workflow instance, or the drill's own),
the kind (`export` or `drill`), who asked (none for the nightly run), the status (`running`, `ok`, `failed`,
`skipped`), when it started and ended, the object key, the sizes, the bookmark, the recipient and
the error. Migration `0066_backup_progress.sql` adds what the run copies (`parts`, comma
separated), where a running run is (`step`), what its check found (`verified`) and how many files
it copied and their size (`files`, `file_bytes`), where its files copy stopped when its steps ran
out (`files_after`), and when it last said where it is (`beat`).

| Code | Name | Status | When |
|---|---|---|---|
| `KIT-E-1601` | `NOT_SET_UP` | 503 | a setting or a secret the export needs is missing; the detail names it |
| `KIT-E-1602` | `CLOUDFLARE_REFUSED` | 502 | Cloudflare's database API answered with an error, or the export did not finish |
| `KIT-E-1603` | `RUNNING` | 409 | an export started less than half an hour ago still runs |
| `KIT-E-1604` | `COPY_FAILED` | 502 | the dump could not be downloaded or stored |
| `KIT-E-1605` | `NOT_VERIFIED` | 502 | a stored copy did not have the size or checksum the run sent |
| `KIT-E-1606` | `NOTHING_CHOSEN` | 422 | a backup was asked for with neither the database nor the files ticked |

A public key that is not an `age1` recipient is `KIT-E-1307` (`@oltrem/core-crypto`).

## Tests

Inside the Workers runtime against the real migrations, with Cloudflare's API and the signed
address as a scripted fetch and the Workflow as a stand-in: a backup asked for by hand, audited,
exported, polled, encrypted and kept, the copy equal to the age format's own output and streamed;
a dump without its length held in memory, to the same bytes; a replayed instance; the
capabilities; one export at a time; each refusal on its run without the token or the signed
address; the bookmark; both checks' thresholds; the choice of parts and the refusal of none; the
files copied in steps, never twice, and again once changed, without Cloudflare; a copy that reads
back wrong failing with its fix; and a database with an FTS5 table exported in the SQLite tool's
format.

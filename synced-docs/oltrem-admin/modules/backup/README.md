# @oltrem/backup

Backups as the kit makes them (plan sections 4.4 and 9.3). Every night a flow in the client's one
Workflow asks Cloudflare to export the database, waits for the dump, encrypts it to the vendor's
age key on its way through the Worker and keeps it under `backups/d1/` in the files bucket. The
Worker holds only the public half of that key, so it can make a copy and can never open one. Each
run is a row the backup page lists, and a check on System health says how old the newest copy is.
Time Travel, D1's own restore to any minute of the last seven days, stays the first answer; the
copies cover what it does not: a deleted database, an account lost, a mistake found too late.

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
| `claim` | One row in `backup_runs` for the instance, `running`; when another export started less than thirty minutes ago and still runs, the row is `skipped` with `KIT-E-1603` and the run ends. A replayed instance finds its own row and does not run twice |
| `export and copy` | The export is asked for with `KIT_OPS_TOKEN` and polled once a second, up to 300 times, until Cloudflare hands back a signed address; the dump is downloaded from it, without the token, and encrypted to `BACKUP_PUBLIC_KEY` in the age format. A dump that comes with its length is streamed into the bucket and never whole in memory; one without is held in memory. The step is tried three times, a minute apart and then two, within fifteen minutes each |
| `record` | The row is `ok`, with the object key, the size before and after encryption, the export's bookmark and the recipient |
| `record the failure` | The row is `failed`, with the code and the detail; the error is reported and the instance fails |

The object key is the run's start time, `backups/d1/2026-10-21T03-00-00Z.sql.age`, so a copy is
never written over. The object carries the run's id, the bookmark and the format as metadata. An
error never carries the token or the signed address.

## Routes

Under `/api/backup`, through the IAM module's sessions and check.

| Route | Capability | What it does |
|---|---|---|
| `GET /runs` | `backup.read` | The newest thirty runs: when, who, the outcome, the copy and its size |
| `POST /runs` | `backup.run` | Makes a backup now: refused with `KIT-E-1601` when something is missing and with `KIT-E-1603` while an export runs; otherwise the flow starts and the answer is `202 { id }`. Audited as `backup.run` |
| `GET /time-travel` | `backup.read` | The database's Time Travel bookmark now, to note before a risky step and restore to with `wrangler d1 time-travel restore` |
| `GET /home` | `backup.read` | The Home card: how long ago the newest copy started, and how it ended |

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
| `KIT_OPS_TOKEN` | Worker secret | an account token with two permissions, Account, D1, Edit for the export and Account, Account Analytics, Read for System health's budgets: the only Cloudflare token inside the Worker; its recipe is `@oltrem/core-health`'s |
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

- The backup page comes with the screens.
- How much CPU encrypting a large dump takes is measured on the sandbox.

## The table and the error codes

`backup_runs` (migration `0012_backup.sql`): the id (the Workflow instance, or the drill's own),
the kind (`export` or `drill`), who asked (none for the nightly run), the status (`running`, `ok`, `failed`,
`skipped`), when it started and ended, the object key, the sizes, the bookmark, the recipient and
the error.

| Code | Name | Status | When |
|---|---|---|---|
| `KIT-E-1601` | `NOT_SET_UP` | 503 | a setting or a secret the export needs is missing; the detail names it |
| `KIT-E-1602` | `CLOUDFLARE_REFUSED` | 502 | Cloudflare's database API answered with an error, or the export did not finish |
| `KIT-E-1603` | `RUNNING` | 409 | an export started less than half an hour ago still runs |
| `KIT-E-1604` | `COPY_FAILED` | 502 | the dump could not be downloaded or stored |

A public key that is not an `age1` recipient is `KIT-E-1307` (`@oltrem/core-crypto`).

## Tests

Inside the Workers runtime against the real migrations, with Cloudflare's API and the signed
address as a scripted fetch and the Workflow as a stand-in: a backup asked for by hand, audited,
exported, polled, encrypted and kept, the copy equal to the age format's own output and streamed;
a dump without its length held in memory, to the same bytes; a replayed instance; the
capabilities; one export at a time; each refusal on its run without the token or the signed
address; the bookmark; and both checks' thresholds.

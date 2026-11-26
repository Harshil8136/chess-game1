---
title: "@oltrem/cli: `oltrem backup setup [dir]` and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src; split from packages/cli/README.md]
---

# @oltrem/cli: `oltrem backup setup [dir]` and more

> Part of [the @oltrem/cli README](../README.md).

## `oltrem backup setup [dir]`

Run once, from a computer with wrangler signed in to the client's account, after the first deploy
has made the database and the bucket (plan 9.3, 11). Each step looks first and only adds, so
running it again changes nothing:

| Step | What happens |
|---|---|
| The account | `CLOUDFLARE_ACCOUNT_ID`, or the one account `wrangler whoami --json` reaches; with several and no variable it stops |
| The database id | `wrangler d1 info <database_name> --json`, for the name `wrangler.jsonc` declares |
| The two settings | `backup.account_id` and `backup.database_id` are written into the settings store, each only while it is empty, the way the Worker's own save writes one: a new configuration version, the row and its history row, by `vendor`. A setting that holds another value is left as it is and reported |
| The cached copy | after a write, `wrangler kv key delete cfg:snapshot --binding <kv> --remote`, so the Worker rereads its settings from D1 within a minute |
| The bucket lock | the rule `oltrem-backups-lock` on `backups/`: no copy can be deleted or overwritten for 35 days |
| The expiry | the lifecycle rule `oltrem-backups-expire` on `backups/`: a copy is deleted 90 days after it was written |

A rule is looked for by its name in `wrangler r2 bucket lock|lifecycle list` and added with
`add ... --force` when missing; a rule already there, and any rule of another name, is left as
it is. Exit `0` when everything is in place, `1` when a setting holds another value or a step
failed, `3` when it could not start: no account, a configuration without one D1 database, one KV
namespace and one R2 bucket, or a database wrangler cannot find or read.

## `oltrem backup drill [dir] --key <file>`

The restore drill (plan 9.3), run by the vendor once a month from a signed-in wrangler, with the
private age key the backups are encrypted to (`--key`, the file `age-keygen` wrote) and the
`age` tool installed. It proves the newest backup copy can be restored, without touching the
client's database:

| Step | What happens |
|---|---|
| The newest copy | read from `backup_runs` in the database `wrangler.jsonc` declares: the newest export that finished ok |
| Download and open | `wrangler r2 object get` from the one bucket into a private temporary folder, then `age -d` with the key; each size must be the one the run recorded |
| Prepare | a copy in the SQLite tool's format (the export of a database with a search index, since 2026-11-14) is made loadable first: its transaction, its writes straight into the schema and the tables the index keeps itself in are left out, and each virtual table is made again from its `CREATE VIRTUAL TABLE` line at the end, empty, and the steps say which; a copy in D1's own format loads as it is |
| Read the copy | its tables and the rows it inserts into each; the migrations table and `backup_runs` must be there, or it is not this client's database |
| Load | a scratch database, `<database>-drill-<date>-<time>`, made with `wrangler d1 create` and loaded with `wrangler d1 execute --file` |
| Check | every table of the copy has exactly its rows in the scratch database |
| Clean up | the scratch database is deleted and the temporary folder with the opened copy removed, whatever happened; a scratch database that could not be deleted is named with the command to delete it |
| Record | one `drill` row in `backup_runs`, `ok` or `failed` with the reason, which the backup page lists and the `backup.drill` health check reads |

Exit `0` when the drill passed and was recorded, `1` when it failed or something could not be
cleaned up or recorded, `3` when it could not start: no key, no `age` tool, or a configuration
without exactly one D1 database and one R2 bucket. `--json` prints the steps and problems as
data, with `ok` true when the copy opened and loaded. The scratch database counts against the
account's databases for the minutes it exists.

## `oltrem github report [dir] --outcome <success|failure|cancelled>`

The last step of a client's deploy workflow on main (plan 4.4), run whatever happened before it
with `job.status` as the outcome. It writes one row about the run into `github_runs` with
`wrangler d1 execute <binding> --remote`, using the deploy token the workflow already holds, so
the GitHub module needs no GitHub token (plan 9.2). The row holds the repository, the commit,
the branch, the outcome and the link to the run, read from GitHub's own variables
(`GITHUB_REPOSITORY`, `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`,
`GITHUB_SERVER_URL`); the kit version installed in `node_modules` (`@oltrem/core-http`); and the
newest published one, from `pnpm view @oltrem/core-http version`. A version it cannot learn is
recorded as unknown.

`oltrem deploy` and `oltrem fleet` write a row of the same shape after their health check
(`deployRunSql`), so Deployments shows what production runs however it was put up: its ref is
`npm run deploy` or `fleet`, its repository and link are empty, its commit is the repository's
`HEAD` (empty for the fleet), and the newest published kit is not asked. A portal without the
GitHub module has no such table; the write fails quietly.

Exit `0` when the row is written, `1` when the write failed, `3` when it could not start: an
outcome it does not know, a run outside GitHub Actions, or a configuration without exactly one
D1 database. The workflow step carries `continue-on-error`, so a report never fails a deploy.

## `oltrem vendor set <email> [dir]`

Run once, from a computer with wrangler signed in to the client's account, after the first deploy
has applied the IAM migrations (plan 7.4). Migration `0004` makes the Vendor's row with no
address, so nobody can sign in until this runs; the address goes into that row and into no file
(R-04). It reads the row with `wrangler d1 execute <binding> --remote --json`, then writes the
address only when the row has none. The same address again changes nothing; another one is
refused, since changing the Vendor's address is not this command's to do.

Exit `0` when the address is written or already the same, `1` when another one is set or the
write failed, `3` when it could not start: no address, an address with a quote or a space, a
configuration without exactly one D1 database, a database wrangler cannot read, or one with no
Vendor row yet.

## The door and settings from this computer (`src/door.ts`, `src/settings-write.ts`)

The deploy's helpers for the door, which it sets once with Cloudflare's `cf` and its sign-in, and
which nothing keeps in step afterwards: anyone may ask for a code, and the portal lets in only its
own people (`@oltrem/iam`, "The door, and who gets in"). The portal's key has no Access permission
since 2026-11-05: `OPS_TOKEN_PERMISSIONS` is `d1` edit and `account_analytics` read, and
`opsTokenForm()` is the account-token form opened with them chosen.

| Export | What it does |
|---|---|
| `cfRunner(dir, log?)` | Runs the repository's own cf as `node <its script>` (`toolArgv`), as wrangler is: its JSON on success, its error when it fails; a labelled call with `log` shows the kit's look |
| `cfSignedIn(cf)`, `cfSignIn(cf, { again? })` | `cf auth whoami`, and `cf auth login` (cf's device flow: a link and a code, the browser opened on them; `--force` with `again`), stopped after `CF_SIGN_IN_MS`; the deploy tries it again 10 seconds after a failure |
| `setDoor(cf, workerId, host?)` | Reads each part and writes only what differs: the Zero Trust organization (`no-zero-trust` without one), the One-time PIN login (`DOOR_LOGIN_NAME`), the reusable policy `DOOR_POLICY_NAME` that includes everyone, and the application whose destination is this Worker: only that login, straight to it, only that policy, `DOOR_OPEN_PATHS` public. An application the dashboard made is edited, never replaced, so its audience stays. Never throws: `ok`, `signed-out`, `no-zero-trust`, `refused` (403) or `cloudflare`, each said in `DOOR_ANSWERS`, with what changed and any other application on `host` |
| `zeroTrustReady(cf)` | Whether the account has a Zero Trust organization (a team name) |
| `doorFromOutside(fetch, url)` | `{ on, open }`: the address sends people to the Access sign-in, and `/healthz` answers 200 without one |
| `workerIdOf(fetch, signInToken, account, name)` | The Worker's id, which Access names, read with wrangler's own sign-in token |
| `writeSetupPeople(dir, run, people)` | Writes `iam.setup_people` (`address owner\|staff\|team` for each person step 2 named, lower case, each once), which the Users page invites in one press |
| `zeroTrustSteps(account)`, `doorManualSteps({ account, worker, host })` | The one step a person does per account (team name, Free plan), and the door by hand when cf cannot set it: One-time PIN, Everyone (never "Cloudflare account" members), and the open paths as an application of their own with a Bypass policy |

`writeSettings(dir, run, writes, { reason })` (and `writeSetting` for one) writes live settings
the way the Worker's own save does: per setting, `oltrem_meta`'s `config_version` moves up, the row
takes that version and a history row records who (`vendor`) and why; then the settings snapshot
(`cfg:snapshot` in KV) is removed, so the Worker reads them within a minute. Keys are checked
against the setting key shape and values are JSON, quoted for SQLite, so nothing else reaches the
SQL. `readSettingState(dir, run, key)` reads one back as `{ read, value? }`, so a caller that
writes only over an unset value (the deploy's alert recipients) can tell unset from unreadable.
Tested in `test/door.test.ts`: the door against an in-memory Zero Trust answering as cf prints, and
the settings against SQLite holding the real settings migration.

## `oltrem parts list [dir]`, `set <ids...>`, `preset everything|email [dir]`

Which parts of the portal (its modules) are switched off: the live setting `settings.parts_off`
of `@oltrem/core-config`, which the Vendor also changes on the portal's Features page. `list` prints
each kit part `on`, `off` or `always on` with what it needs; `set` switches off exactly the parts
named, every other one on, in the repository here; `preset email` keeps email, its integrations,
Deployments and the core (Backups among it: always on), `preset everything` switches every part on. The deploy calls the same exports from
`src/parts.ts`:

| Export | What it is |
|---|---|
| `PARTS: PartChoice[]` | the catalogue, `{ id, label, description, core, requires, features }` per kit part (`features`: its optional extras, switched on the portal's page only), a copy of `KIT_PARTS` held equal by `test/parts.test.ts` |
| `ADD_ONS`, `BASE_PARTS`, `partsHere(dir)` | the parts a repository has only when it installed them (`mail`: `@oltrem/mail`), the parts every one has, and this repository's: Mail's switch only where `src/mail.ts` wires it in. `list`, `set` and the deploy's question go by `partsHere` |
| `PART_PRESETS` | `{ id: 'everything' \| 'email', label, off: string[] }` |
| `PARTS_KEY` | `'settings.parts_off'` |
| `partsRefusal(off)` | why a list cannot be written (a bad name, a core part, a part one left on needs), or null |
| `readParts(dir, run)` | `{ off?: string[], problem?: string }`, through `wrangler d1 execute --remote --json`; before anything is written, the extras a new portal starts with switched off (`EXTRAS_OFF_AT_FIRST`, the kit's default for the setting), so the first list written keeps them off |
| `writeParts(dir, off, run, now?)` | `{ ran, written, off, steps, problems }`: refused before any read when the rule says no; the optional extras already stored (ids with a dot) are kept; nothing written when the list is already stored; otherwise `writeSetting` (above: the version moves up, a history row, the cached settings cleared) |
| `partsLines(off)` | the lines `list` prints |
| `partsQuestion(off)` | the deploy's question: `{ items, off, presets }`, each item the catalogue's row with its sidebar `group` (`partGroup(id)`, kept here since the catalogue is held equal to core-config's and has none; a client's own part that is off shows under `OWN_GROUP`), the presets `everything`, `email` and `core` |
| `switchPart(items, off, id, on)` | the list after one switch: on with what the part needs, off with what needs it; a core part never moves |
| `partsTyped(question, off, typed)` / `partsQuestionLines(question, off)` | the terminal's side: a typed line applied (numbers, names, a preset), and the numbered lines it prints |

Exit `0` when written or already so, `1` when a write failed, `3` when it could not run (a list
the rule refuses, a database wrangler cannot read).

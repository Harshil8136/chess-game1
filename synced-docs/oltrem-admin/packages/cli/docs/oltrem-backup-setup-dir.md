---
title: "@oltrem/cli: backup setup and drill, github report, vendor set, the door, parts"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src/backup-setup.ts, drill.ts, github-report.ts, vendor.ts, door.ts, settings-write.ts, parts.ts]
---

# @oltrem/cli: backup setup and drill, github report, vendor set, the door, parts

> Part of [the @oltrem/cli README](../README.md). Each command runs with wrangler signed in to the
> client's account; exit `3` means it could not start (named in each).

## `oltrem backup setup [dir]`

Once, after the first deploy made the database and bucket. Each step looks first and only adds.

| Step | What happens |
|---|---|
| Account | `CLOUDFLARE_ACCOUNT_ID`, or the one account `wrangler whoami --json` reaches |
| Database id | `wrangler d1 info <database_name> --json` |
| Settings | `backup.account_id` and `backup.database_id`, each only while empty, as `writeSettings` writes (below); another value is left and reported |
| Cache | after a write, `cfg:snapshot` is deleted from KV, so the Worker rereads within a minute |
| Lock | rule `oltrem-backups-lock` on `backups/`: no delete or overwrite for 35 days (`LOCK_DAYS`) |
| Expiry | rule `oltrem-backups-expire` on `backups/`: deleted after 90 days (`EXPIRE_DAYS`) |

A rule is found by name and added with `--force` when missing; other rules are left alone. Exit
`0` all in place, `1` a setting holds another value or a step failed, `3` no account, not one each
of D1, KV and R2, or an unreadable database.

## `oltrem backup drill [dir] --key <file>`

The monthly restore drill, with the private age key (`--key`) and `age` installed. It proves the
newest copy restores, without touching the client's database.

1. **Pick:** the newest ok export in `backup_runs`.
2. **Open:** `wrangler r2 object get` into a private temporary folder, `age -d`; each size must
   match the run's record.
3. **Prepare:** an SQLite-format copy (from a database with a search index) drops its
   transaction, schema writes and the index's own tables, and makes each virtual table again,
   empty, from its `CREATE VIRTUAL TABLE` line. A D1-format copy loads as it is.
4. **Read:** the tables and row counts; the migrations table and `backup_runs` must be there.
5. **Load** into `<database>-drill-<date>-<time>` (`wrangler d1 create`, `d1 execute --file`) and
   **check** every table has exactly its rows.
6. **Clean up** whatever happened: the scratch database and the opened copy; one that cannot be
   deleted is named with its command.
7. **Record** a `drill` row in `backup_runs`, read by the backup page and the `backup.drill` check.

Exit `0` passed and recorded, `1` failed or not cleaned up or recorded, `3` no key, no `age`, not
one D1 and one R2.

## `oltrem github report [dir] --outcome <success|failure|cancelled>`

The last step of a client's deploy workflow (`continue-on-error`, so it never fails a deploy).
It writes a `github_runs` row with `wrangler d1 execute --remote` on the deploy token, so the
GitHub module needs no GitHub token: repository, commit, branch, outcome and link from `GITHUB_*`
variables, the installed `@oltrem/core-http` version and the newest (`pnpm view`), unknown when
unreadable. `oltrem deploy` and `oltrem fleet` write the same shape after their health check
(`deployRunSql`; ref `npm run deploy` or `fleet`). Without the GitHub module the write fails
quietly. Exit `0` written, `1` failed, `3` unknown outcome, outside GitHub Actions, not one D1.

## `oltrem vendor set <email> [dir]`

After the first deploy: migration `0004` makes the Vendor's row with no address, so nobody signs
in until this writes it (into the row, never a file: R-04). Only an empty row is written; the same
address again changes nothing, another is refused. Exit `0` written or same, `1` another set or
failed, `3` a bad address, not one D1, unreadable, or no Vendor row.

## The door and settings (`src/door.ts`, `src/settings-write.ts`)

The deploy sets the door once with Cloudflare's `cf`; nothing keeps it in step. Anyone may ask
for a code and the portal lets in only its own people (`@oltrem/iam`). The portal's key has no
Access right: `OPS_TOKEN_PERMISSIONS` is D1 edit and Account Analytics read, and `opsTokenForm()`
opens the token form with them chosen.

| Export | What it does |
|---|---|
| `cfRunner(dir, log?)` | Runs the repository's cf as `node <script>` (`toolArgv`): JSON on success, its error on failure |
| `cfSignedIn`, `cfSignIn(cf, { again? })` | `cf auth whoami`; `cf auth login`'s device flow (`--force` with `again`), stopped after `CF_SIGN_IN_MS` |
| `setDoor(cf, workerId, host?)` | Writes only what differs: Zero Trust, the One-time PIN login (`DOOR_LOGIN_NAME`), the policy `DOOR_POLICY_NAME` for everyone, and this Worker's application with `DOOR_OPEN_PATHS` public. A dashboard-made application is edited, never replaced. Never throws: `ok`, `signed-out`, `no-zero-trust`, `refused`, `cloudflare` (`DOOR_ANSWERS`) |
| `zeroTrustReady(cf)` | Whether the account has a Zero Trust team |
| `doorFromOutside(fetch, url)` | `{ on, open }`: the address goes to Access and `/healthz` answers 200 |
| `workerIdOf(…)` | The Worker's id, with wrangler's sign-in token |
| `writeSetupPeople(dir, run, people)` | Writes `iam.setup_people` (`address owner\|staff\|team`), which the Users page invites in one press |
| `zeroTrustSteps`, `doorManualSteps` | The one step per account (team name, Free plan), and the door by hand: One-time PIN, Everyone, the open paths with a Bypass policy |

`writeSettings(dir, run, writes, { reason })` (`writeSetting` for one) writes as the Worker's save
does: `config_version` in `oltrem_meta` moves up, the row takes it, a history row records `vendor`
and why, then `cfg:snapshot` is cleared. Keys are checked against the key shape and values are
JSON, quoted for SQLite. `readSettingState(dir, run, key)` returns `{ read, value? }`, telling
unset from unreadable. Tested in `test/door.test.ts`.

## `oltrem parts list [dir]`, `set <ids...>`, `preset everything|email [dir]`

Which modules are off: `settings.parts_off`, also changed on the portal's Features page. `list`
prints each part `on`, `off` or `always on` with its needs; `set` switches off exactly those
named; `preset email` keeps email, its integrations, Deployments and the core; `preset
everything` switches all on. Backups is always on. `src/parts.ts` exports:

| Export | What it is |
|---|---|
| `PARTS` | `{ id, label, description, core, requires, features }` per kit part, equal to `KIT_PARTS` (`test/parts.test.ts`) |
| `ADD_ONS`, `BASE_PARTS`, `partsHere(dir)` | Parts only an install brings (`mail`), parts every portal has, and this repository's (Mail only where `src/mail.ts` wires it) |
| `PART_PRESETS`, `PARTS_KEY` | The presets; `'settings.parts_off'` |
| `partsRefusal(off)` | Why a list cannot be written (a bad name, a core part, a need left on), or null |
| `readParts(dir, run)` | `{ off?, problem? }`; before any write, `EXTRAS_OFF_AT_FIRST` |
| `writeParts(dir, off, run, now?)` | Refused by the rule before any read; keeps stored extras (ids with a dot); writes nothing when already so; else `writeSetting` |
| `partsQuestion(off)` | The deploy's question: items with their sidebar group (`partGroup`, `OWN_GROUP` for a client's own), presets `everything`, `email`, `core` |
| `switchPart(items, off, id, on)` | One switch: on with its needs, off with what needs it; core never moves |
| `partsLines`, `partsTyped`, `partsQuestionLines` | The terminal's lines and its typed answers (numbers, names, a preset) |

Exit `0` written or already so, `1` a write failed, `3` a refused list or an unreadable database.

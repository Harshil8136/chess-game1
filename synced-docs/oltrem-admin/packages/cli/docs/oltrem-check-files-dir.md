---
title: "@oltrem/cli: `oltrem check files [dir]` and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src; split from packages/cli/README.md]
---

# @oltrem/cli: `oltrem check files [dir]` and more

> Part of [the @oltrem/cli README](../README.md).

## `oltrem check files [dir]`

The kit's own files in a client repository (research 18, check 1): the deploy workflow,
`src/index.ts`, the kit's tests and configuration, `ai.md`, the pointer files and the Claude Code
settings, each equal by checksum to the copy of the kit version installed. The list travels with
the tool as `kit-files.json`, which the kit's `pnpm docs:build` generates from its client
template. A missing or changed kit file is refused: the change belongs in a module under
`modules/` or in `oltrem.config.ts`, and an upgrade rewrites the kit's files whole. The
template's `.claude/settings.json` denies Claude Code an edit of the same files. The packed kit in
`kit/` is held too: every `file:./kit/` that `package.json` names (a dependency or an override) is
there, and every file there is one it names. Exit `0`, `1` on a problem, `3` when there is no
`oltrem.manifest.json`.

## `oltrem check modules [dir]`

A client's own modules, each within its walls (research 18, checks 3 and 4):

- each folder under `modules/` has a module name that is not a kit module's, and its
  `src/module.ts` declares that id; `src/modules.ts` and `test/pages-types.ts` are exactly what
  `new module` writes for them; each module's bit plane is its own, from 100;
- a module's files import nothing outside its folder, only packages `package.json` lists, and a
  kit package only through an entry point its `exports` names;
- its error codes sit in one hundred of its own, from `KIT-E-5000`;
- each client migration (`5000` and up) is named for a module (`<number>_<module>.sql`, or with
  more after a dash), is in that module's manifest, and only adds to tables named for the module:
  `CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`, `ALTER TABLE … ADD
  COLUMN` that is nullable or has a default (never a key or unique), and `INSERT OR IGNORE`.

Any other statement is refused unless its file carries a `-- contract: <why>` line; such a file
is reported as a removal step, which waits for the owner and ships in a later release than the
code that stops using what it removes, so the previous code still runs on the new database. Exit
`0`, `1` on a problem, `3` when there is no `oltrem.manifest.json`.

## `oltrem check packages [dir]`

Every package `package.json` names (dependencies of every kind) is a kit package (`@oltrem/…`) or
one the kit registered with its reason in its dependency registry (research 18, check 6). The list
travels with the tool in `kit-files.json`. Any other package is refused: the owner adds it to the
kit's registry, with its reason, in a kit release. Exit `0`, `1` on a problem, `3` when there is
no `oltrem.manifest.json`.

## `oltrem check secrets [dir]`

No key or id is written into a file Git would commit (research 18, check 8): a UUID, 32 or more
hex characters, a Cloudflare account token, a GitHub, AWS, Slack or Stripe key, an age or other
private key. A Worker's resources are found by their names and its keys are secrets, so each of
these is a mistake. Files Git ignores (the keys file, `.dev.vars`) are left alone; outside a Git
repository the plain names `.gitignore` lists are. Lockfiles and files over 1 MiB or holding a
null byte are not read. Exit `0`, `1` on a problem, `3` when there is no `oltrem.manifest.json`.

## `oltrem check budgets [dir]`

The upgrade's size and startup measure on every change (research 18, check 7): wrangler's
dry-run build, its size without source maps, and its startup time from `wrangler check startup`,
against the limits the upgrade uses. Past 70 % of either it warns; past either it refuses. The
client template's `verify` runs it in place of a plain dry-run build. Exit `0` (warnings
included), `1` past a limit, `3` when there is no `oltrem.manifest.json`.

## `oltrem release [dir]`

The client template's deploy workflow runs it on `main` after its checks and `verify` (research
18 §3.4); no person types it. In order:

1. **A restore point:** the database's Time Travel bookmark, printed in the run's log. A restore
   to it is never automatic: it waits for the owner's yes, then runs from the operations menu
   (`operate`).
2. **The version running now**, from `wrangler deployments status`: the one carrying most traffic.
3. **The migrations**, as `migrations apply` runs them (the database created on the first deploy).
   A failed migration stops the release: no new code deploys.
4. **The deploy.** When the account refuses a binding the portal can run without, the release takes
   that binding out of its copy of the configuration, deploys again once, and says in the log what
   waits: an account without Analytics Engine stopped every fleet update for a day.
5. **The health check:** `/healthz` on the portal's address (`PUBLIC_HOST`, or the workers.dev
   address wrangler printed), up to six reads five seconds apart. The Worker answers it before its
   own sign-in check; the door must let the path through, as it does `/hooks` (`oltrem deploy`
   prints the step).
6. **The step back:** when the new version never answers `ok`, `wrangler rollback` returns to the
   version noted in step 2, at once. The database is left as it is, which is safe because a
   client's migrations only add (`check modules`).

Steps 2, 5 and 6 are exported for `oltrem deploy`, which runs them after its own deploy:
`versionNow(run)`, `watchHealth(host, fetch, sleep)` and `stepBack(run, version, after)`.

When the door or a bot challenge answers in the Worker's place (a redirect to the door's sign-in,
or a `cf-mitigated` header), the release cannot see the Worker: it keeps the new version and says
how to let `/healthz` through. The token is the workflow's `CLOUDFLARE_API_TOKEN`, whose Workers
Scripts and D1 permissions cover every step. Exit `0` when the release is live (or could not be
seen), `1` when it stopped or stepped back, `3` when there is no wrangler configuration.

## `oltrem fleet [--check]`

The deploy command of the kit's one Workers Builds connection, in the Vendor's own Cloudflare
account ([the fleet](../../../docs/reference/fleet.md) has the why and the one-time setup). It runs
in the kit repository, with the key in `OLTREM_FLEET_TOKEN` (or `CLOUDFLARE_API_TOKEN`):

1. **The portals:** every account the key opens is read for a D1 database `<worker>-db` whose
   Worker has `CLIENT_ID` `<worker>`.
2. **Their choices** (`src/choices.ts`): the `build_choices` row of the portal's `oltrem_meta`,
   which `oltrem deploy` writes after its health check; without it, the running Worker's
   `PUBLIC_HOST` and Oltrem Mail's `send_email` binding. A choice never made is the default.
3. **The order:** the Workers in `OLTREM_FLEET_FIRST` first; one of them failing, or missing,
   holds every other portal.
4. **Each portal:** skipped when its `fleet_fingerprint` (the kit folders' git trees and the
   choices) is current, or its `autoUpdate` is false (set by hand in the row, which a deploy
   keeps until it is set back to true there; or recorded false by a deploy, with `ownModules`, when the repository has modules of its
   own, which the template the fleet builds from does not have; the report names them); otherwise the client template is copied to
   `.fleet/<worker>` beside `templates/` (its packages linked in), the choices written in, and
   `oltrem release` run on the portal's account, without Workers Builds' own `WRANGLER_CI_*`
   variables (they would point wrangler at the Vendor's Worker). A good release records the
   choices and the fingerprint.
5. **The report:** a line per portal; with `OLTREM_FLEET_GITHUB_TOKEN` and `OLTREM_FLEET_REPO`, an
   issue `Fleet: <worker> did not update` per portal that failed or was held, closed once it
   updates.

`--check` finds the portals and says what it would do, changing nothing. Exit `0` when every
portal is current or updated, `1` when one failed or was held or an account could not be read,
`3` without a key or outside the kit.

## `oltrem live [--portal <worker>] [--yes]`

A client's real portal on this computer, on production, for visual work in an editor or with an AI
agent. From the kit's root it is `npm run live`, which builds the tool first; on the start page it
is **Which data: Production**, beside **Local** (a new portal with its own data, `npm run dev`).

1. **Signs in.** It takes wrangler's key (`wrangler auth token`); with none, it runs
   `wrangler login`, which opens Cloudflare's page in the browser. A saved sign-in Cloudflare
   refuses (it ran out or was taken back) is renewed once by itself. `CLOUDFLARE_API_TOKEN`,
   when set, is used instead.
2. **Asks which portal**, found the way `fleet` finds them: every account the login reaches,
   each portal with the choices its last deploy recorded. It always asks, even for one, and the
   list ends with **Another Cloudflare login**: `wrangler logout`, Cloudflare's sign-in page, and
   the search again, so a computer signed in to one client's account is never stuck on it.
   `--portal <worker>` names one instead.
3. **Builds its folder** in `.live/<worker>` beside `templates/` (ignored by git): the client
   template with those choices written in, answering on localhost rather than the portal's
   address. A folder an earlier, still running portal holds (Windows keeps its files open) is
   said with its fix: close that window or press Stop.
4. **Connects it to production.** It refuses while the live portal's database is behind this
   kit's migrations (its pages would expect columns it lacks: push first, and the fleet updates
   it), then asks for a typed `yes` (`--yes` gives it; the start page's choice says what it does).
   The database, files and cache are the live ones (wrangler's remote bindings, their ids written
   only into `.live/`), and events go to the live queue.
5. **Runs it** with the template's `scripts/dev.mjs --connected`. Sign in on its page with your
   own address: your real roles apply, and every save, delete or send is real. From a terminal or
   `live-windows.cmd` the browser opens on the portal by itself; on the start page, **Open** does.

**Never a copy.** No production data is copied to a computer; the copy this command made on
2026-11-25 is gone. Kept on this computer: no queue consumer (a send leaves from the live portal,
with its own keys), no cron tick (the live portal runs its own) and no KEK, so nothing is sealed
with a key the live portal could not open (pasting a provider's key fails here instead). Key-value
writes count against the account's daily allowance.

**Cloudflare Access.** wrangler links to the live resources through a preview Worker on the
account's `workers.dev` address. On an account whose Access guards every Worker address, that link
passes only after a sign-in through Access, which wrangler runs with `cloudflared` when it believes
a person is at the keyboard: the dev script tells it so (`TTY_PRELOAD`), so a browser page opens and
the person signs in with their own Cloudflare login (a member of the account). Without
`cloudflared`, the first start installs it (`winget` on Windows, `brew` on macOS) and tries once
more; elsewhere it names the download. Nothing is added to the account. A start waits up to six
minutes for that sign-in.

Exit `1` when it could not sign in, find the portal or connect, each said with its fix; otherwise
the exit of the portal's own run.

## `oltrem operate <operation> [dir] [--target X] [--confirm X]`

One job of the operations menu (research 18 §3.5). The client template's operations workflow runs
it with the release key, from `main` only, and offers exactly these five as its choices; no person
types it. Each operation is fixed: there is no free command against production.

| Operation | What it does | Target |
|---|---|---|
| `check the setup` | Only reads: the version running, the five latest versions (the ids a step back takes), the database's restore point now, any migration waiting, the required secrets set, `/healthz` on `PUBLIC_HOST` | none |
| `apply waiting migrations` | Runs the migrations not yet applied, as `migrations apply` does, without a deploy | none |
| `replace a Worker secret` | Sets one of the Worker's `secrets.required` to a new value, handed to wrangler on standard input, never as an argument. The workflow reads the value from a repository secret of the same name, which the owner adds first and deletes after | the secret's name |
| `step back the code` | `wrangler rollback` to the version given, or the one before; the database is left as it is | a version id, or none |
| `restore the database` | Time Travel restore to a bookmark (from a release's log) or a time (RFC 3339, or seconds since 1970); prints the bookmark that undoes it | the restore point |

The last two replace what runs. They start only after the owner's yes in the thread, and refuse to
run unless `--confirm` repeats the operation's name, which the workflow asks for in its
confirmation box. A failed step says what still runs. Exit `0` when the job is done, `1` on a
problem, `3` when it was refused before it ran (an unknown operation, a missing target or
confirmation, no wrangler configuration).

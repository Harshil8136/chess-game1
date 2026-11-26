---
title: "@oltrem/cli: the client checks, release, fleet, live and operate"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src/checks.ts, client-modules.ts, client-secrets.ts, upgrade.ts, release.ts, fleet.ts, choices.ts, live.ts, operations.ts]
---

# @oltrem/cli: the client checks, release, fleet, live and operate

> Part of [the @oltrem/cli README](../README.md).

## The client checks

Each runs in a client repository; exit `0` passes, `1` a problem, `3` no `oltrem.manifest.json`.

| Command | What it holds |
|---|---|
| `oltrem check files [dir]` | The kit's own files (the deploy workflow, `src/index.ts`, the kit's tests and configuration, `ai.md`, the pointer files, the Claude Code settings) equal by checksum to the installed kit's, listed in `kit-files.json` (built by the kit's `pnpm docs:build`). A change belongs in a module or `oltrem.config.ts`; the template's `.claude/settings.json` denies Claude Code those edits. Also: every `file:./kit/` in `package.json` exists, and every file in `kit/` is named. |
| `oltrem check modules [dir]` | Each folder under `modules/` declares its own id (not a kit module's); `src/modules.ts` and `test/pages-types.ts` are what `new module` writes; each bit plane is its own, from 100. A module imports only its own folder, listed packages and a kit package's `exports`. Its error codes keep to one hundred from `KIT-E-5000`. Each client migration (5000 up) is named `<number>_<module>.sql`, is in its manifest, and only adds to the module's tables (`CREATE … IF NOT EXISTS`, a nullable or defaulted `ADD COLUMN`, `INSERT OR IGNORE`). Anything else needs a `-- contract: <why>` line and ships in a later release than the code that stops using it. |
| `oltrem check packages [dir]` | Every package named is `@oltrem/…` or in the kit's dependency registry (carried in `kit-files.json`); another needs a kit release. |
| `oltrem check secrets [dir]` | No UUID, 32+ hex characters, Cloudflare token, GitHub, AWS, Slack or Stripe key, or private key in a file Git would commit. Ignored files (the keys file, `.dev.vars`), lockfiles and files over 1 MiB or with a null byte are skipped. |
| `oltrem check budgets [dir]` | wrangler's dry-run build size (no source maps) and `wrangler check startup` time against the upgrade's limits: warns past 70 %, refuses past either (exit `1`). The template's `verify` runs it instead of a plain dry run. |

## `oltrem release [dir]`

Run by the client template's deploy workflow on `main` after its checks; no person types it.

1. **A restore point:** the database's Time Travel bookmark, printed in the log. Restoring to it
   waits for the owner's yes (`operate`).
2. **The version now** (`versionNow`): the one carrying most traffic in `wrangler deployments
   status`.
3. **The migrations**, as `migrations apply`. A failure stops the release.
4. **The deploy.** A binding the account refuses and the portal can run without is taken out of
   the release's copy, deployed again once, and named in the log.
5. **The health check** (`watchHealth`): `/healthz` on `PUBLIC_HOST` or the workers.dev address,
   six reads 5 s apart. The door must let `/healthz` through.
6. **The step back** (`stepBack`): no `ok`, and `wrangler rollback` returns to step 2's version.
   The database stays; client migrations only add.

`oltrem deploy` reuses steps 2, 5 and 6. When the door or a bot challenge answers instead (a
redirect to sign-in, a `cf-mitigated` header) the release keeps the new version and says how to
let `/healthz` through. It uses the workflow's `CLOUDFLARE_API_TOKEN`. Exit `0` live or unseen,
`1` stopped or stepped back, `3` no wrangler configuration.

## `oltrem fleet [--check]`

The deploy command of the kit's one Workers Builds connection ([the
fleet](../../../docs/reference/fleet.md) has the why and setup), with `OLTREM_FLEET_TOKEN` (or
`CLOUDFLARE_API_TOKEN`).

1. **Find the portals:** in every account the key opens, a D1 database `<worker>-db` whose Worker
   has `CLIENT_ID` `<worker>`.
2. **Read the choices** (`src/choices.ts`): the `build_choices` row of `oltrem_meta`, written by
   `oltrem deploy`; else the Worker's `PUBLIC_HOST` and Mail's `send_email` binding.
3. **Order:** `OLTREM_FLEET_FIRST` first; one failing or missing holds the rest.
4. **Each portal:** skipped when `fleet_fingerprint` (the kit's git trees and the choices) is
   current or `autoUpdate` is false (set by hand, or by a deploy with `ownModules` when the
   repository has its own modules). Otherwise the template is copied to `.fleet/<worker>`, the
   choices written in, and `oltrem release` run on its account without `WRANGLER_CI_*`.
5. **Report:** a line each; with `OLTREM_FLEET_GITHUB_TOKEN` and `OLTREM_FLEET_REPO`, an issue
   `Fleet: <worker> did not update`, closed once it updates.

`--check` changes nothing. Exit `0` all current or updated, `1` one failed, held or unreadable, `3`
no key or outside the kit.

## `oltrem live [--portal <worker>] [--yes]`

A client's real portal on this computer, on production data, for visual work (`npm run live`; on
the start page, **Production** beside **Local**).

1. **Sign in:** wrangler's key (`wrangler auth token`), else `wrangler login`; a refused saved
   sign-in is renewed once. `CLOUDFLARE_API_TOKEN` wins when set.
2. **Pick the portal**, found as `fleet` finds them. It always asks; the list ends with **Another
   Cloudflare login**. `--portal` names one.
3. **Build** `.live/<worker>` (git-ignored) from the template with its choices, on localhost. A
   folder a running portal still holds is named with its fix.
4. **Connect:** refused while the live database is behind this kit's migrations; then a typed
   `yes` (`--yes`). The database, files, cache and queue are the live ones (remote bindings, ids
   only in `.live/`).
5. **Run** `scripts/dev.mjs --connected`. Sign in with your own address: your roles apply and
   every change is real.

Nothing is copied to the computer. There is no queue consumer, cron tick or KEK here, so nothing
is sealed with a key the live portal cannot open. KV writes count against the daily allowance.
Where Access guards every Worker address, wrangler signs in through `cloudflared` (the dev script
sets `TTY_PRELOAD`; a missing `cloudflared` is installed with `winget` or `brew`, or its download
named), waiting up to six minutes. Exit `1` with the fix when it cannot sign in, find or connect;
otherwise the portal's own exit.

## `oltrem operate <operation> [dir] [--target X] [--confirm X]`

One job of the client template's operations workflow, from `main` with the release key; no free
command against production.

| Operation | What it does | Target |
|---|---|---|
| `check the setup` | Reads only: the version running, the five latest, the restore point now, waiting migrations, the required secrets, `/healthz` | none |
| `apply waiting migrations` | As `migrations apply`, without a deploy | none |
| `replace a Worker secret` | Sets one of `secrets.required` from the repository secret of the same name, on standard input; the owner adds that secret first and deletes it after | the name |
| `step back the code` | `wrangler rollback` to the version given or the one before | a version, or none |
| `restore the database` | Time Travel to a bookmark or time (RFC 3339 or epoch seconds); prints the bookmark that undoes it | the point |

The last two need the owner's yes and `--confirm` repeating the operation's name. Exit `0` done,
`1` a problem, `3` refused before it ran.

---
title: "@oltrem/cli: setup, new client, new module, docs, check agents and tokens"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src/setup.ts, new-client.ts, new-module.ts, docs.ts, agents.ts, tokens.ts, scripts/client-repo-check.mjs]
---

# @oltrem/cli: setup, new client, new module, docs, check agents and tokens

> Part of [the @oltrem/cli README](../README.md). Every command here takes `--json`, which prints
> its outcome as data.

## `oltrem setup [dir]`

The steps a client repository needs that need no account, safe to run again: copy the kit's
migrations (as `migrations sync`), check `.github/workflows/deploy.yml` is there, print the token
template (Workers Scripts, D1, Workers KV Storage, Workers R2 Storage and Queues, all Edit, on the
one account) and the two `gh secret set` commands, write `AGENTS.md` and `CLAUDE.md` where missing
or different, write the generated reference (as `docs`), then run the doctor. The token is made by
hand: a token cannot make itself. Exit: the doctor's, `1` for a migrations problem, `3` when the
kit packages are not installed.

## `oltrem new client <dir> [--name "Acme Ltd"] [--kit <folder>] [--mail] [--git]`

A new client repository in an empty folder (or one with only `.git`): the client template without
`node_modules` or builds, and the kit **vendored** into `kit/` as `oltrem-<name>-<version>.tgz`
files, so it installs with no registry or token, locally and in GitHub Actions.

| Part | What it does |
|---|---|
| `--kit <folder>` | The packed kit, as `pnpm kit:pack` writes it (`.oltrem/kit`). Without it, run from the kit, the tool packs every package first (a minute or two). Every package must be there once (`kit-files.json`); a missing or doubled one is refused before anything is written. |
| `package.json` | `workspace:*` becomes `file:./kit/<file>`, and `pnpm.overrides` sends every kit package there; `catalog:` becomes the catalog's version (carried in `kit-files.json`). The lockfile holds each file's checksum, so a changed file stops a `--frozen-lockfile` install. |
| `--name` | Writes the names as the first deploy does (`namingOf` in `src/deploy.ts`): `Acme Ltd` gives `acme-ltd-portal`, `acme-ltd-portal-db` and the rest. Without it the first deploy asks. |
| Setup | The pointer files, kit migrations and generated reference, as `oltrem setup`. From a packed tool they come with the template and `pnpm exec oltrem setup` checks them after `pnpm install`. |
| `--mail` | Wires Oltrem Mail in, as [`oltrem mail add`](oltrem-mail.md#oltrem-mail). Without it Mail's file is still in kit/ and in the overrides, so adding it later needs no download. |
| `--git` | `git init -b main`. |

It prints the next steps: `pnpm install` (commit the lockfile), `pnpm verify`, `npm run deploy`, a
commit, then a private GitHub repository with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
added **before** the first push (every push to `main` deploys). Exit `0` written, `1` a package
missing or not packed, `3` the folder is not empty or the name is not one. `oltrem check files`
holds `kit/` to `package.json` both ways.

**`pnpm check:client-repo [--keep]`** (in the kit, `scripts/client-repo-check.mjs`) proves the
path with no registry: packs the kit, runs the packed tool's `new client --name "Acme Ltd"
--kit`, `pnpm install --offline`, then inside it `oltrem setup`, `oltrem new module pet-food`,
`pnpm verify`, Mail in and out with a verify after each, and `oltrem doctor`, each timed. About
2.5 minutes on four cores, so not a gate: run it after a change to packing or the template.

## `oltrem new module <name> [dir]`

A complete module from the kit's `templates/module`, the name written as id (`pet-food`), table
prefix (`pet_food`) and title (`Pet food`): two capabilities, two routes, a sidebar page, a daily
job, a health check, a migration, a setting, an error code, a test and its README.

- **Numbers.** Capabilities on the next free bit plane from 100 (`PLANE_FLOOR`; the kit's are
  below), so the Owner holds them from the next start. The migration takes the next free number
  from 5000 in `migrations/`; error codes the next free hundred from 5000 (`KIT-E-5001`, then
  `KIT-E-5101`).
- **Wiring.** `src/modules.ts` is rewritten to list every module under `modules/` (never edited
  by hand), and `test/pages-types.ts` to hold each module's page types; pages reach the Worker
  through `#modules/*/pages` in `package.json`. The reference is refreshed. It deploys with no
  edits.
- **Names.** Lower-case letters and digits joined by single dashes; a kit module id or an existing
  folder is refused. Generating `sample-notes` reproduces `templates/module` byte for byte, so
  the kit tests what the generator writes.

Exit `0` written, `1` the name is refused, `3` not a client repository or no template.

## `oltrem docs [dir] [--check]`

Writes the generated reference to `docs/_generated/` from the repository's own files (R-06):

| Page | From |
|---|---|
| Resources | `oltrem.manifest.json` and the wrangler file: bindings, queues, classes, crons, vars, secret names, cap exceptions |
| Migrations | `migrations/` and its `kit.json`: the kit's files with checksums, the client's own, the ledger |
| Tokens | `tokens.registry.json`, one table per credential, by name |
| Modules, `capabilities.json` | `src/modules.ts`: each client module's capabilities, routes, jobs, checks, migrations, settings, errors; the planes as data |
| Key recipes | `src/index.ts`'s `modules`: each Worker secret, how to make, test and rotate it, and what happens without it |
| Repository map | the files that exist |

The Modules and Key recipes pages import `src/modules.ts` and `src/index.ts` in a child Node
process with type stripping and read the manifests; nothing runs. `cloudflare:workers` and
`@oltrem/screens` are stood in for, so a module must load in Node (no Workers-only global at
module scope). A file that fails to load is named with its first error and nothing is written.

**The capabilities gate.** The Worker registers a module's capabilities once per version
(`@oltrem/iam`), so a change under the same version would never land. A plane or capability
changed without a version bump is refused, naming the module; a new module needs no bump. A
`capabilities.json` the command did not write is reported with the repair (delete it, run again).

`--check` compares in memory and names each missing, changed or stray file with the command to
run; without it, stale pages are written and strays removed. The registry is checked first (every
field, upper snake case names, a known status, no duplicate). Exit `0` current, `1` stale, stray,
a capability change without a bump or a bad registry, `3` no manifest or wrangler file. The
template's `verify` runs `oltrem docs --check`.

## `oltrem check agents [dir]`

The instruction files (R-08): `ai.md` under 8 KB; `AGENTS.md` and `CLAUDE.md` exactly the tool's
template; the always-loaded files under 24 KB together; no copied fact (a count beside table,
migration, route or binding, a UUID shape, a hostname). With a `rules.md` (under 32 KB), every
`R-NN` in ai.md has a heading there and every heading a line in ai.md. Exit `0`, `1` a problem,
`3` no ai.md.

## `oltrem check tokens [dir]`

The token registry (R-05): every row complete, and every secret name used has a row: the Worker's
`secrets.required`, a workflow's `secrets.NAME`, a `wrangler secret put` in any text file
(`node_modules`, `dist`, `.wrangler` and `docs/_generated` aside). A missing row names where the
name is used. Exit `0`, `1` a problem, `3` no registry.

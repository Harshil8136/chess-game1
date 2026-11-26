---
title: "@oltrem/cli: `oltrem setup [dir]` and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src; split from packages/cli/README.md]
---

# @oltrem/cli: `oltrem setup [dir]` and more

> Part of [the @oltrem/cli README](../README.md).

## `oltrem setup [dir]`

The steps a new client repository needs that need no account, in one idempotent command: copy
the kit's migrations (as `migrations sync` does), confirm the deploy workflow
`.github/workflows/deploy.yml` is in place, print the template for the one Cloudflare API token
and the two `gh secret set` commands that store it and the account id as repository secrets,
write the pointer files `AGENTS.md` and `CLAUDE.md` where they are missing or differ, write the
generated reference (as `docs` does), and run the doctor. The token itself is created by hand in the client's dashboard, since a token
cannot create itself; its scopes are the five the deploy needs, on that account only. Exit
codes are the doctor's, or `1` when the migrations folder has a problem and `3` when the kit
packages are not installed.

## `oltrem new client <dir> [--name "Acme Ltd"] [--kit <folder>] [--mail] [--git]`

A new client repository, one per client, in an empty folder (or one holding only `.git`, such as a
fresh clone of an empty private repository). It copies the client template (`templates/client` in
the kit; the copy the tool's package carries once packed) without `node_modules`, builds or anything
local to a machine, and **vendors the kit**: every kit package, packed as
`oltrem-<name>-<version>.tgz`, goes into the repository's `kit/` folder, so it installs with no
registry and no token, on a computer and in GitHub Actions alike.

- **Where the packed kit comes from.** `--kit <folder>` names a folder of them, as
  `pnpm kit:pack` writes in the kit (`.oltrem/kit` by default). Without it, run from the kit, the
  tool packs every package itself first, each one built (a minute or two). Every kit package must
  be in the folder, one file each; the names come with the tool (`kit-files.json`). A missing or
  doubled one is refused before anything is written.
- **`package.json`.** Each kit package (`workspace:*` in the template) becomes
  `file:./kit/<its file>`, and `pnpm.overrides` sends every kit package, including the ones the
  packages name among themselves, to its file. Each third-party package (`catalog:`) becomes the
  catalog's one version, which `kit-files.json` carries since the catalog itself stays in the kit.
  The lockfile `pnpm install` writes records each packed file's checksum, so a changed file stops
  a `--frozen-lockfile` install.
- **`--name`.** The client's names, written as the first deploy writes them (the same function,
  `namingOf` in `src/deploy.ts`): the client file's id and name, and every resource in
  `wrangler.jsonc` and `oltrem.manifest.json` (`Acme Ltd` is `acme-ltd-portal`,
  `acme-ltd-portal-db` and the rest). Without it the template's names stay and the first deploy
  asks "What is this client called?", as it always has.
- **The setup steps that need no account**, as `oltrem setup` runs them: the pointer files, the
  kit migrations and the generated reference. The last two read the installed kit packages; run
  from the kit, the kit template's stand in for a moment (a link that is removed again); from a
  packed tool, they came with the template and `pnpm exec oltrem setup` checks them after
  `pnpm install`.
- **Oltrem Mail.** kit/ always holds its packed file and `pnpm.overrides` names it, so adding it
  later needs no download. Without `--mail`, `package.json` does not name `@oltrem/mail`, its
  migrations stay out of `migrations/`, and the portal sends through its providers (today's
  email). `--mail` wires it in from the start, as [`oltrem mail add`](oltrem-mail.md#oltrem-mail) does.
- **`--git`** runs `git init -b main`.

It prints the next steps: `pnpm install` (commit `pnpm-lock.yaml` with the rest), `pnpm verify`,
`npm run deploy` first (it ends with the files it changed), a commit of everything, then a private
GitHub repository with its `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets added before
the first push, since every push to `main` deploys; a push before the portal exists ended red. `--json` prints
`{ ok, exitCode, dir, ran, written, problems, notes, worker }`. Exit `0` when written, `1` on a
problem (a package missing from the kit, one that did not pack), `3` when the folder is not empty
or the name is not one.

`kit/README.md` is one of the kit's files. `oltrem check files` also holds `kit/` to
`package.json`: each `file:./kit/` it names is there, and every file there is one it names.

### Proving it: `pnpm check:client-repo`

In the kit, `pnpm check:client-repo [--keep]` (`scripts/client-repo-check.mjs`) proves the whole
path with no registry: it packs every kit package into a scratch folder, unpacks the packed tool
on its own and runs its `oltrem new client --name "Acme Ltd" --kit`, installs the new repository
with `pnpm install --offline`, then runs inside it `oltrem setup`, `oltrem new module pet-food`
(the module template the installed tool carries), its own `pnpm verify` (the type check, the
tests, the client checks, the generated reference and a dry-run build with its budgets), then
Oltrem Mail in and out again (`oltrem mail add`, `pnpm verify`, `oltrem mail status`,
`oltrem mail remove --confirm remove`, `pnpm verify`), and `oltrem doctor`. Each step is timed and
the size of `kit/` printed. It takes about two and a half
minutes on four cores, most of it the packing and the client's own tests, so it is not a gate of
`pnpm verify`; run it after a change to how the packages are built or packed, or to the template.

## `oltrem new module <name> [dir]`

Writes a complete module into the client repository in `dir` (the current directory by default),
copied from the kit's module template (`templates/module` in the kit; the copy the tool's package
carries once packed) with the name written in wherever it goes: as the id (`pet-food`), as a table prefix
(`pet_food`) and as a title (`Pet food`). The module gets one of each part the manifest knows: two
capabilities, two routes, a page in the sidebar, a daily job, a health check, a migration, a
setting and an error code, plus its own test and its how-to (`modules/<name>/README.md`). Its
capabilities sit on the next free bit plane from 100 (the kit's own modules take the planes
below), so the permission model knows them and the Owner holds them from the next start. The migration is written into the client's
`migrations/` folder at the next free number of the client's own series (5000 and up), and the
module's error codes take the next free hundred from 5000 (`KIT-E-5001`, then `KIT-E-5101` for
the second module), read from the modules already there. Then `src/modules.ts` is rewritten to
list every module under `modules/` in name order, each joined to its pages (the client template's
Worker mounts that list beside the kit's modules, so the file is never edited by hand), and
`test/pages-types.ts` to hold each module's page types to its pages; the pages reach the Worker
through the `#modules/*/pages` import in the client's `package.json`. The generated reference is
refreshed, as `docs` does. The new module deploys with no edits: `pnpm verify` type-checks it,
runs its test inside the Workers runtime and finds the reference current.

A name is lower-case letters and digits, words joined by single dashes; the kit's own module ids
(`iam`, `users`, `health`, `email` and the rest of plan 4.4) are refused, as is a name whose
folder exists. The generator is deterministic, and the kit's own test holds the template to it:
generating `sample-notes` reproduces `templates/module` byte for byte, so what the generator
writes is the code the kit type-checks and tests on every verify. `--json` prints
`{ ok, exitCode, ran, written, problems }`. Exit `0` when written, `1` when the name is refused,
`3` when `dir` is not a client repository or the template is not installed.

## `oltrem docs [dir] [--check]`

Writes the generated reference of the client repository in `dir` (the current directory by
default) to `docs/_generated/`, from the repository's own files and never by hand (R-06): an
index, **Resources** from `oltrem.manifest.json` and the wrangler file (every binding, queue,
class, cron, var and secret name, and any exception to the caps), **Migrations** from
`migrations/` and its `kit.json` (the kit's files with their checksums, the client's own, the
ledger table), **Tokens** from `tokens.registry.json` (one small table per credential, by name
only, sorted), **Modules** from `src/modules.ts` (for each of the client's own modules: its
capabilities, routes with their capability, jobs, checks, migrations, settings with their
defaults and errors with their text), **`capabilities.json`**, the same modules' bit plane and
capabilities as data under their version, **Key recipes** from `src/index.ts` (every Worker secret
the mounted modules need, the kit's included: its purpose, how to make, test and rotate it, and
what the portal does without it), and a **Repository map** of the files that exist.

The Modules and Key recipes pages are read from the code: the command imports `src/modules.ts`
and `src/index.ts` (its `modules` export is every module the Worker mounts) in a child Node
process with type stripping and takes each manifest as data; no handler, job or check runs. A
module and the Worker file must therefore load in Node, which means no Workers-only global or
import at module scope; the kit's own packages respect this. Two imports are stood in for while
the files load: `cloudflare:workers`, whose classes a Worker file extends, and `@oltrem/screens`,
whose pages are JSX, which Node does not strip; neither is ever run there. A file Node cannot load is reported
as a problem that names it and its first error, and nothing is written. A client without
`src/modules.ts` has no module yet; a `src/index.ts` with no `modules` export leaves the Key
recipes page saying so.

`capabilities.json` is also a gate. The Worker registers a module's capabilities once per version
(`@oltrem/iam`), so a capability added, removed or changed under the same version would never
reach the permission model. On every run the command compares each module's bit plane and
capabilities with the committed file and refuses a change under an unchanged version, naming the
module and the bump to make; nothing is written until the version moves. A module the file does
not know is new and needs no bump. A file that is not the list the command writes is reported with
the repair: delete it and run `oltrem docs`.

`--check` renders in memory and compares: a file whose committed copy is missing or differs, or
a stray `.md` or `.json` file in the folder, is reported with the command to run, and nothing is
written.
Without `--check`, the stale pages are written and a stray file is removed. The registry is
validated first, by the kit's own rules (every field present, the name in upper snake case, a
known status, no duplicate): a bad row is refused with its row number and nothing is written.
`--json` prints `{ ok, exitCode, ran, written, stale, problems }`.

Exit `0` when the files are current (or were just written), `1` when `--check` found a stale or
stray file, a module changed its capabilities under the same version, or the registry is missing
or invalid, `3` when there is no manifest or no wrangler
file to generate from. The client template's `verify` runs `oltrem docs --check`, and the kit's
own tests hold the template's committed copy to what the command renders.

## `oltrem check agents [dir]`

The instruction files of a client repository (plan 15.1, R-08): `ai.md` exists and is under
8 KB; the pointer files `AGENTS.md` and `CLAUDE.md` match the tool's template byte for byte
(`setup` writes them); the always-loaded files together stay under 24 KB so no tool truncates;
and no instruction file carries a copied fact (a count next to table, migration, route or
binding, a UUID shape, a hostname), which belongs in the generated reference. When the
repository has a `rules.md` (under 32 KB), every `R-NN` named in ai.md has a heading there and
every heading is summarised in ai.md; without one, the rule lines refer to the kit's rules and
the check says so. Exit `0`, `1` on a problem, `3` when there is no ai.md.

## `oltrem check tokens [dir]`

The token registry of a client repository (plan 9.4, R-05): every row of `tokens.registry.json`
is complete (the fields, the name in upper snake case, a known status, no duplicate), and every
secret name the repository uses has a row: the Worker's `secrets.required`, a workflow's
`secrets.NAME`, and a `wrangler secret put` command naming it in any text file (`node_modules`,
`dist`, `.wrangler` and `docs/_generated` excepted). A missing row is reported with where the
name is used and the rule: read the registry, reuse or widen a row, or add one with its reason.
Exit `0`, `1` on a problem, `3` when there is no registry. `--json` prints the outcome as data
for every `check` command.

---
title: "Versions and release notes"
status: living
owner: vendor
last_verified: 2026-11-01
sources: [the plan, sections 4.1, 14.3 and 15.7; .changeset/config.json; scripts/package.mjs; scripts/kit-pack.mjs; scripts/client-repo-check.mjs]
---

# Versions and release notes

> **In plain words.** Every change to a kit package carries a short note for the people who use
> it. When the kit is released, those notes become each package's change log and its new
> version number. A client's upgrade reads them to show what changed for that client.

## The versions

| Packages | How they are versioned |
|---|---|
| `@oltrem/core-*` | together, one version for all of them: the kit's version, which the GitHub module reads from `@oltrem/core-http` |
| each module under `modules/` | on its own |
| `@oltrem/cli` | on its own |
| `@oltrem/screens` | on its own |
| the client and module templates | never released; `oltrem setup` and `oltrem new module` copy them |

What each kind of change is (plan 14.3):

| Bump | When |
|---|---|
| major | a migration that is not purely additive, or a change the client must make to its configuration |
| minor | a new module or a new feature |
| patch | a fix |

A module that depends on a core package that moves is bumped by a patch with it.
`.changeset/config.json` holds these rules.

## Writing the note

1. Run `pnpm changeset` with the change in the working tree.
2. Pick the packages the change touches and the bump for each.
3. Write the note for a client's reader, in plain words: what changes for them and what they must
   do, if anything.
4. Commit the file it writes under `.changeset/` with the change.

A change that no package's user can see, such as a test, a document or a gate of this
repository, needs no note.

## The kit's floor

`@oltrem/core-http`, the package whose version is the kit's, says what a client needs to run
it: `engines.node`, and in its `oltrem` field the lowest wrangler and the earliest
`compatibility_date`. A test holds these equal to the workspace's Node, the catalog's wrangler
and the client template's date, so they move together. `oltrem upgrade` checks a client against
them.

## Releasing

`pnpm changeset version` turns the waiting notes into version bumps and each package's
`CHANGELOG.md`, and deletes the notes. Then `pnpm changeset status` shows no package to bump.

## How a client repository gets the kit

Each client has its own private repository, made with `oltrem new client` (`packages/cli/README.md`).
Nothing of the kit is published: every package stays `private`. The repository carries the kit
itself instead, in its `kit/` folder:

1. Each kit package builds its `src/` to JavaScript and declarations in `dist/`
   (`scripts/package.mjs`). Node does not strip types from files under `node_modules`, and
   `oltrem docs` and the doctor load a client's modules in Node, so a packed package carries
   built files. In this repository every package is still read from `src/`; only the packed
   `package.json` points at `dist/`, through its `publishConfig.exports`.
2. `pnpm kit:pack [folder]` packs every kit package into one file each,
   `oltrem-<name>-<version>.tgz` (`.oltrem/kit` by default). `pnpm pack` swaps `workspace:` and
   `catalog:` for exact versions, and the tool's file carries the two templates.
3. `oltrem new client <dir>` copies those files into the new repository's `kit/` and points every
   `@oltrem` dependency at them (`file:./kit/<file>`, with an override for the packages that
   depend on each other). `pnpm install` then needs no token and no registry, on a computer or in
   GitHub Actions, and the lockfile holds each file's checksum.
4. `kit/` is the kit's: never edited, replaced only by an upgrade. `oltrem check files` refuses a
   dependency that names a missing file, or a file in `kit/` that no dependency names.

A client repository's `kit/` holds about 1.4 MB (40 files, measured 2026-11-01). Every upgrade
adds the changed files to the repository's history.

`pnpm check:client-repo` proves the whole path: it packs the kit, makes a client repository from
it, installs it offline, adds a module, and runs the client's `pnpm verify` and the doctor. It
takes about two and a half minutes, so it is run by hand, not by `pnpm verify`.

## What is built and what is not yet

- **Taking a release in a client.** `oltrem upgrade --from <folder>` replaces the files in
  `kit/` with the ones packed in that folder and points the dependencies at them; then
  `pnpm install`, and `oltrem upgrade` checks first, copies the new kit migrations, writes the
  reference and prints the notes since the last upgrade (`packages/cli/README.md`). It does not
  yet replace the client's kit-owned files (ai.md, the tests, the pointer files) with the new
  template's.
- **Publishing.** Not now, and possibly much later: a registry, and an organisation to publish
  under, are the owner's call. If it comes, the built `dist/` and the packed files are already
  what a registry takes, and a client repository would name versions instead of `kit/` files.
  Until then every package stays `private` and at `0.0.0`.
- **Dependabot** opening an upgrade has nothing to watch while the kit is vendored.

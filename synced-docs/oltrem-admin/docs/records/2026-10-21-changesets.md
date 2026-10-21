---
title: "Phase 6: versions and release notes with Changesets (2026-10-21)"
status: record
owner: vendor
last_verified: 2026-10-21
sources: [the plan, sections 4.1, 14.3 and 15.7; the pinned Changesets' configuration schema; this repository]
---

# Phase 6: versions and release notes with Changesets

> **In plain words.** Phase 6 is about releasing the kit and upgrading a client to a new release.
> Its first part is the habit every release depends on: each change to a kit package carries a
> short note for its users. When the kit is released, the notes become version numbers and change
> logs. Publishing the packages waits on the `oltrem` GitHub organisation.

## What changed

- **`@changesets/cli`** is a tool dependency, pinned in the catalog with its reason in
  `dependencies.registry.json`. `pnpm changeset` runs it.
- **`.changeset/config.json`**:
  - the core packages, `@oltrem/core-*`, are one fixed group with one version: the kit's version;
  - each module and the command-line tool are versioned on their own;
  - the two templates are never released;
  - private packages are versioned and not tagged, since nothing is published yet.
- **[docs/release.md](../release.md)** says which packages share a version, what a major, minor
  and patch change is, how to write a note, and what releasing does.
- **ai.md** sends a change to what a package does for its users to a note. To stay under its
  budget, two lines of its commands section were shortened.
- **docs/README.md** has a table for phase 6. The records now have their own two-column table,
  which made room for it under the size budget.

## Decisions

- **Changesets, as the plan names it.** The plan's release design (14.3), rewritten on the
  owner's answers to the release cards (15.7), versions the packages with Changesets. No other
  tool was weighed again.
- **Notes now, publishing later.** Notes written from today become the first release's change
  log. The publishing workflow needs the organisation that owns the `@oltrem` scope on GitHub
  Packages, and it would spend Actions minutes on every push to main. It waits for the
  organisation.
- **No gate that demands a note.** Work goes straight to `main`, so there is no pull request to
  compare against. A gate would have to guess which commits a note covers. ai.md asks for the
  note, and the release shows any package that changed without one.
- **The formatter is the repository's.** Changesets detects Prettier, so its notes and change
  logs pass the format gate as written.

## Found on the way

- **A published package cannot ship only TypeScript.** Node refuses to strip types from files
  under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, checked on Node 22.22.0).
  `oltrem docs` and the doctor load a client's modules in Node. In this repository the packages
  are workspace links outside `node_modules`, so they load. Published, they would not. The
  publishing step must build JavaScript for each package. docs/release.md lists it.

## Not done here

- `oltrem upgrade`, the next part.
- Publishing, Dependabot on the sandbox and previews on a branch. They wait on the organisation
  and the sandbox.

## How it was verified

- The twelve gates pass locally, the dependency gate with the new row.
- `pnpm changeset status --verbose` with a trial note asking a minor bump of one core package
  and a patch of one module:
  - all ten core packages moved together to 0.1.0;
  - the modules that depend on them moved by a patch;
  - the note's own module moved by its patch;
  - the templates did not move.

  The trial note was deleted afterwards.
- `pnpm changeset status` with no note lists no package to bump.
- A one-file check on Node 22.22.0 confirmed the type-stripping refusal under `node_modules`.

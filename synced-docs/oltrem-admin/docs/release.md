---
title: "Versions and release notes"
status: living
owner: vendor
last_verified: 2026-10-21
sources: [the plan, sections 4.1, 14.3 and 15.7; .changeset/config.json]
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

What is built and what is not yet:

- **Publishing.** It waits on the `oltrem` GitHub organisation. Its release workflow will publish
  to GitHub Packages with its own token (plan 15.7). Until then every package stays `private`
  and at `0.0.0`.
- **Taking a release in a client.** `oltrem upgrade` is built: after the client installs the new
  version, it checks first, then copies the new kit migrations, writes the reference and prints
  the notes since the last upgrade (`packages/cli/README.md`). Dependabot opening that change is
  set up with the sandbox.
- **Built JavaScript in the published packages.** Node does not strip types from files under
  `node_modules`, so a published package cannot ship only `.ts` source. `oltrem docs` and the
  doctor load a client's modules in Node. This is part of the publishing step.

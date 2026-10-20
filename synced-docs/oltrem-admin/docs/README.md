---
title: "Documentation index, and where things stand"
status: living
owner: vendor
last_verified: 2026-10-19
sources: [this repository]
---

# Documentation: index and where things stand

> **In plain words.** This folder is the written side of the kit, kept so the owner can follow
> the work on a phone as it happens. This page says where the work stands, lists every
> document and says which fact each one owns. The plan the work follows lives elsewhere and is
> linked below.

## Where things stand

The kit is in **phase 1, the core runtime**, since 2026-10-19, when the owner said to continue.
The plan's open decisions still wait on him (they are listed in the plan). Phase 0, set up and
measure, has these parts:

| Part | State |
|---|---|
| This repository, with the contract every agent reads first (ai.md, rules.md, the generated pointer files) | **done** 2026-10-19 |
| The token registry with reuse before create, and the gate that enforces it | **done** 2026-10-19: nine names from the plan, none created yet |
| The verify chain skeleton with the scan for copied names and identifier shapes | **done** 2026-10-19: five gates then, ten today ([what verify runs](reference/verify.md)), run locally and on every push |
| The public docs mirror: this folder, the root `.md` files and LICENSE copied to the mirror after every green verify on `main` | **done** 2026-10-19 |
| A client template repository and a sandbox client repository | not started |
| A fresh Cloudflare account for the sandbox client | not started: the owner creates it |
| The CPU measurement of three sample screens in the sandbox | not started: needs the sandbox |
| The first week's open questions (the configuration layers, encryption in the Worker, the test runner on GitHub, the secrets cap) | not started |

Phase 1, the core runtime, has these parts so far:

| Part | State |
|---|---|
| The toolchain: TypeScript, tests inside the Workers runtime, the linter with the module-boundary rules, the formatter, and the dependency registry with its gate | **done** 2026-10-19: [the phase 1 record](records/2026-10-19-phase-1-toolchain-and-core-config.md) |
| `@oltrem/core-config`: the settings registry, the four configuration layers and the fast read path (memory, one KV snapshot, D1 as the truth) | **done** 2026-10-19: its tests pass inside the Workers runtime; it runs in no Worker yet |
| The command-line tool (`setup`, `doctor`, `dev`, `manifest check`) | not started |
| The other core packages the plan names for phase 1 | not started |

Anything deployed, measured or connected to an account is still to come: the sandbox client needs
the fresh Cloudflare account, the owner's step.

## The plan

The plan, its research and the owner's decisions are kept in the first client's documentation
and published on the public docs mirror:
[the platform-kit folder on the mirror](https://github.com/Harshil8136/chess-game1/tree/main/synced-docs/cf-admin/documentation/program/platform-kit).
Its plan document is the authority on the design; this repository follows it and records here
what was built.

## Where these documents are published

After every push to `main`, once `pnpm verify` is green on GitHub, the `mirror-docs` job of
the verify workflow copies this folder, every `.md` file at the repository root, each package's
and module's README and LICENSE to the public docs mirror, under
[synced-docs/oltrem-admin](https://github.com/Harshil8136/chess-game1/tree/main/synced-docs/oltrem-admin),
and writes a provenance file there with the source commit. The folder on the mirror is rebuilt
from the commit each time. Nothing is redacted on the way: the identifiers gate is the scanner,
and everything in this repository is written as if public (R-04). The job signs in with the
`PERSONAL_PAT` secret, whose row is in the [token registry](reference/tokens.md).

## Index

| Document | Owns | Kind |
|---|---|---|
| [ai.md](../ai.md) | the session-start procedure, the rules in one line each, the commands, what to read and what to update | written |
| [rules.md](../rules.md) | every rule in full: reason, scope and enforcement | written |
| [The licence in plain words](licence.md) | what the Oltrem Licence allows, what needs permission, and how to ask | written |
| [Token registry](reference/tokens.md) | every credential by name, its scopes, where it is stored and why it exists | generated from `tokens.registry.json` |
| [What verify runs](reference/verify.md) | the gates, their order and what each refuses | generated from `scripts/lib/gates.mjs` |
| [Dependencies](reference/dependencies.md) | every third-party package, its one pinned version, who uses it and why | generated from `dependencies.registry.json` and the catalog |
| [@oltrem/core-config](../packages/core-config/README.md) | the four configuration layers, the settings registry, the read path and the storage the package owns | written, beside the code |
| [Phase 0: the repository basics](records/2026-10-19-phase-0-repository-basics.md) | what the first commit set up, why, and how it was verified | record, frozen |
| [Phase 1: the toolchain and the configuration layers](records/2026-10-19-phase-1-toolchain-and-core-config.md) | what the toolchain and the first core package are, the decisions taken, and how it was verified | record, frozen |
| [The licence change](records/2026-10-20-licence-change.md) | why Apache-2.0 was replaced by the Oltrem Licence, the terms chosen, and what still needs a lawyer | record, frozen |

## How this folder is checked

`pnpm docs:check`, one of the gates of `pnpm verify`, refuses a document without front matter,
a document missing from the table above, a document over its size budget, a relative link that
points nowhere, and a generated document that differs from its source. Records are frozen: a
later change is a new record, not an edit.

## How to read this on a phone

Every document opens with a short summary in plain words. Tables are kept narrow; the generated
token page gives each credential its own small table instead of one wide one.

## Verification log

| Date | What was checked | What was not |
|---|---|---|
| 2026-10-19 | Every document listed exists and is indexed; `pnpm verify` passes on the first commit with its five gates; the plan link opens on the public mirror | Nothing has been deployed or measured; every state above is the state of this repository, not of a live system |
| 2026-10-19 | The mirror job added to the verify workflow, gated on a green verify and a push to `main`; its token registered; a test asserts both gates | Whether the first mirror run succeeds is known only after the push; the result is in the thread and in the provenance file on the mirror |
| 2026-10-19 | The ten gates pass locally, the package tests inside the Workers runtime included; every dependency has a row and a pin; the new pages are indexed and their links resolve; the GitHub run of the same gates and the mirror job passed on the phase 1 commit | Nothing runs in a deployed Worker yet, so the read path's timings are from the local test runtime only |
| 2026-10-19 | The mirror job now copies each package's README too, so the index's link to `@oltrem/core-config` resolves on the mirror; a test asserts the copy | Whether the link opens on the mirror is known after this push |
| 2026-10-20 | The licence replaced in `LICENSE`, both package files and the README; a test asserts all three agree; the plain-words page and the record indexed | The licence text has not been read by a lawyer |

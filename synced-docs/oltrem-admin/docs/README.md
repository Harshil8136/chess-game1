---
title: "Documentation index, and where things stand"
status: living
owner: vendor
last_verified: 2026-10-20
sources: [this repository]
---

# Documentation: index and where things stand

> **In plain words.** This folder is the written side of the kit, kept so the owner can follow
> the work on a phone as it happens. This page says where the work stands, lists every
> document and says which fact each one owns. The plan the work follows lives elsewhere and is
> linked below.

## Where things stand

The kit is in **phase 2, permissions and users**, since 2026-10-20, when phase 1's list of
parts was built; phase 1's acceptance (the first deploy) still waits on the sandbox repository.
The plan's open decisions still wait on the owner (they are listed in the plan). Phase 0, set up
and measure, has these parts:

| Part | State |
|---|---|
| This repository, with the contract every agent reads first (ai.md, rules.md, the generated pointer files) | **done** 2026-10-19 |
| The token registry with reuse before create, and the gate that enforces it | **done** 2026-10-19: nine names from the plan, none created yet |
| The verify chain skeleton with the scan for copied names and identifier shapes | **done** 2026-10-19: five gates then, ten today ([what verify runs](reference/verify.md)), run locally and on every push |
| The public docs mirror: this folder, the root `.md` files and LICENSE copied to the mirror after every green verify on `main` | **done** 2026-10-19 |
| A client template repository and a sandbox client repository | **template done** 2026-10-20, as `templates/client` in this repository ([the record](records/2026-10-20-client-template-and-setup.md)); the sandbox repository waits on the owner |
| A fresh Cloudflare account for the sandbox client | not started: the owner creates it |
| The CPU measurement of three sample screens in the sandbox | not started: needs the sandbox |
| The first week's open questions (the configuration layers, encryption in the Worker, the test runner on GitHub, the secrets cap) | not started |

Phase 1, the core runtime, has these parts so far:

| Part | State |
|---|---|
| The toolchain: TypeScript, tests inside the Workers runtime, the linter with the module-boundary rules, the formatter, and the dependency registry with its gate | **done** 2026-10-19: [the phase 1 record](records/2026-10-19-phase-1-toolchain-and-core-config.md) |
| `@oltrem/core-config`: the settings registry, the four configuration layers and the fast read path (memory, one KV snapshot, D1 as the truth) | **done** 2026-10-19: its tests pass inside the Workers runtime; it runs in no Worker yet |
| `@oltrem/cli`, the command-line tool: `oltrem manifest check` (the resource manifest gate), `migrations sync` and `migrations apply`, `setup`, `docs`, `check agents`, `check tokens` and `oltrem doctor` with eight checks | **done** 2026-10-20: [the first record](records/2026-10-20-cli-manifest-check-and-doctor.md), [the second](records/2026-10-20-client-template-and-setup.md), [the third](records/2026-10-20-cli-docs-command.md) and [the fourth](records/2026-10-20-cli-check-commands.md); the plan's list for phase 1 is complete |
| The core runtime: `@oltrem/core-errors`, `core-module`, `core-http`, `core-outbox` and `core-audit` (errors as data, the module contract, the one pipeline and the three Worker handlers, the outbox with replay, the hashed audit log) | **done** 2026-10-20: [the record](records/2026-10-20-core-runtime-packages.md); every package's tests pass inside the Workers runtime; no Worker is built from them yet |
| `@oltrem/core-ui`: the token list as a Tailwind theme, the phone-first primitives on native elements, and the three widgets on Zag.js | **done** 2026-10-20: [the primitives record](records/2026-10-20-core-ui-tokens-and-primitives.md) and [the widgets record](records/2026-10-20-core-ui-widgets.md); the gallery page and the screen gates wait on an Astro app |
| The client template and `oltrem setup`: the model of a client repository, resources by name, the kit's migrations copied with checksums, the one deploy workflow | **done** 2026-10-20: [the record](records/2026-10-20-client-template-and-setup.md); the first deploy waits on the sandbox repository and the fresh account |
| `oltrem docs`: the generated reference of a client repository, checked current on every verify | **done** 2026-10-20: [the record](records/2026-10-20-cli-docs-command.md); the client template carries its five pages |
| `oltrem check agents` and `check tokens`: the instruction files and the token registry of a client repository, checked on every verify | **done** 2026-10-20: [the record](records/2026-10-20-cli-check-commands.md) |
| The phase's acceptance: a blank client repository deploys from GitHub with no hand-pasted id and one stored token, the doctor green, a red push not deployed | not started: needs the sandbox repository and the fresh account, the owner's steps |

Phase 2, permissions and users, has these parts so far:

| Part | State |
|---|---|
| `@oltrem/iam`, the model and the check: the tables, the capability registry, the compiler and `can()` | **done** 2026-10-20: [the record](records/2026-10-20-iam-model-and-check.md); it runs in no Worker yet |
| Sessions and the authorizer: the map inside a session, a revoke visible on the next request | **done** 2026-10-20: [the record](records/2026-10-20-iam-sessions-and-authorizer.md); it runs in no Worker yet |
| Governance: the writes and their rules (grant only what you hold, below your position), expiring grants, access requests, reviews | **done** 2026-10-20: [the record](records/2026-10-20-iam-governance.md); it runs in no Worker yet |
| The Vendor and the handover: tenant creation, the first Owner's invitation, Vendor access settings | **done** 2026-10-20: [the record](records/2026-10-20-iam-vendor-and-handover.md); it runs in no Worker yet |
| The routes: the JSON side of the model under `/api/iam`, the acceptance of an invitation open to any identity | **done** 2026-10-20: [the record](records/2026-10-20-iam-routes.md); it runs in no Worker yet |
| The phone screens | not started: waits on the owner's call, build them in Astro now or after the sandbox measures a screen's cost |

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
the verify workflow copies this folder, every `.md` file at the repository root, each package's,
module's and template's README and LICENSE to the public docs mirror, under
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
| [@oltrem/cli](../packages/cli/README.md) | the `oltrem` tool: the manifest check, its caps and the manifest format, the doctor's checks and exit codes | written, beside the code |
| [@oltrem/core-errors](../packages/core-errors/README.md) | how an error is defined, the code blocks, and the problem document every failure answers with | written, beside the code |
| [@oltrem/core-module](../packages/core-module/README.md) | the module contract: routes, capabilities, schemas, event types, what it refuses | written, beside the code |
| [@oltrem/core-http](../packages/core-http/README.md) | the request pipeline, the same-origin rule, the identity headers and the token's claims, the session hook, the three Worker handlers | written, beside the code |
| [@oltrem/core-outbox](../packages/core-outbox/README.md) | the outbox: how a row moves, the backoff ladder, replay, and the table it owns | written, beside the code |
| [@oltrem/core-audit](../packages/core-audit/README.md) | the audit log: the fields and their rules, what is refused, hashing and verify, and the table it owns | written, beside the code |
| [@oltrem/core-ui](../packages/core-ui/README.md) | the token list, the brand variables, light and dark, every primitive with the rule it keeps, and the three widgets | written, beside the code |
| [@oltrem/iam](../modules/iam/README.md) | the permission model: capabilities and their bits, roles, scopes, groups, bindings, overrides, the compiled map, the check's order and reasons, the session record and when it is written, the authorizer, the governance rules and the approvals, the Vendor, invitations and the handover, the tables and the error codes | written, beside the code |
| [The client template](../templates/client/README.md) | what a client repository is made of: the client file, the manifest, the kit's migrations, the one workflow, the two secret names | written, beside the code |
| [Phase 0: the repository basics](records/2026-10-19-phase-0-repository-basics.md) | what the first commit set up, why, and how it was verified | record, frozen |
| [Phase 1: the toolchain and the configuration layers](records/2026-10-19-phase-1-toolchain-and-core-config.md) | what the toolchain and the first core package are, the decisions taken, and how it was verified | record, frozen |
| [The licence change](records/2026-10-20-licence-change.md) | why Apache-2.0 was replaced by the Oltrem Licence, the terms chosen, and what still needs a lawyer | record, frozen |
| [Phase 1: the command-line tool](records/2026-10-20-cli-manifest-check-and-doctor.md) | what the manifest check and the doctor are, the decisions taken, and how it was verified | record, frozen |
| [Phase 1: the core runtime](records/2026-10-20-core-runtime-packages.md) | what the five runtime packages are, the decisions taken, and how it was verified | record, frozen |
| [Phase 1: the design kit](records/2026-10-20-core-ui-tokens-and-primitives.md) | what the theme and the primitives are, the decisions taken, and how it was verified | record, frozen |
| [Phase 1: the client template and the setup command](records/2026-10-20-client-template-and-setup.md) | what the template and the migration and setup commands are, the decisions taken, and how it was verified | record, frozen |
| [Phase 1: the three widgets](records/2026-10-20-core-ui-widgets.md) | what the combobox, the menu and the date range are, the decisions taken, and how it was verified | record, frozen |
| [Phase 1: the generated reference](records/2026-10-20-cli-docs-command.md) | what `oltrem docs` writes in a client repository, the decisions taken, and how it was verified | record, frozen |
| [Phase 1: the two check commands](records/2026-10-20-cli-check-commands.md) | what `oltrem check agents` and `check tokens` refuse in a client repository, the decisions taken, and how it was verified | record, frozen |
| [Phase 2: the permission model and the check](records/2026-10-20-iam-model-and-check.md) | what the IAM module's tables, registry, compiler and check are, the decisions taken, and how it was verified | record, frozen |
| [Phase 2: sessions and the authorizer](records/2026-10-20-iam-sessions-and-authorizer.md) | how the compiled map travels in one KV record per person, the pipeline's session hook and authorizer, the decisions taken, and how it was verified | record, frozen |
| [Phase 2: governance](records/2026-10-20-iam-governance.md) | the writes that change who may do what and the rules each is refused by, the second person, requests and reviews, the decisions taken, and how it was verified | record, frozen |
| [Phase 2: the Vendor and the handover](records/2026-10-20-iam-vendor-and-handover.md) | how the Vendor creates the one company and invites its first Owner, what the handover changes, how the company lets the Vendor in, the decisions taken, and how it was verified | record, frozen |
| [Phase 2: the routes](records/2026-10-20-iam-routes.md) | the fifty-four JSON routes of the IAM module, the one route open to any identity and the pipeline change behind it, the capability every account holds, the decisions taken, and how it was verified | record, frozen |

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
| 2026-10-20 | The twelve gates pass locally, the new `build` and `manifest` gates included; the tool's tests pass on Node and the configuration package's inside the Workers runtime; the new dependency has its row and pin; the tool's README and the record are indexed and their links resolve | Nothing has run in a client repository yet: the manifest check has only the kit's own test Worker to check, and the doctor's other checks wait on one |
| 2026-10-20 | The twelve gates pass locally with the `manifest` gate on three test Workers; the five new packages' tests pass inside the Workers runtime; hono has its row and pin; the five READMEs and the record are indexed and their links resolve | No Worker is built from the packages yet, so the pipeline's CPU cost and the outbox's behaviour against a real queue are unmeasured; the audit seal is still to come |
| 2026-10-20 | The twelve gates pass locally; the design kit's tests pass on Node (every primitive's markup, no inline style, the theme compiled, the contrast ratios); the five new dependencies have rows and pins; the README and the record are indexed and their links resolve | No screen has been rendered in a browser or on a phone: the look is unseen until the sandbox client exists, and the screen gates of plan 12.6 wait on it |
| 2026-10-20 | The twelve gates pass locally, the manifest gate now on the client template too; the tool's tests on Node (fake kit packages, a fake wrangler) and the template's inside the Workers runtime; the dry-run deploy bundles the template with no id anywhere; `oltrem migrations apply` run by hand reached wrangler and was refused for lack of a token, as designed; wrangler has its row and pin; the template README and the record are indexed and their links resolve | Nothing has deployed: the first real deploy, the creation of the resources by name and the workflow itself are untested until the sandbox repository and the fresh account exist |
| 2026-10-20 | The twelve gates pass locally; the design kit's tests on Node cover the three widgets rendered closed (no inline style, the roles, the hidden values, the locale); the five new dependencies have rows and pins; the record is indexed and its links resolve | No widget has been opened in a browser or on a phone: the machines' behaviour once hydrated is unseen until the sandbox client exists |
| 2026-10-20 | The twelve gates pass locally; the tool's tests on Node cover `oltrem docs` (the five pages, a stale page, a stray file, a bad registry row, the exit codes, the doctor's `DOCS-01`) and hold the client template's committed reference to what the command renders; the tool's README, the template's and the record are indexed and their links resolve | Nothing has run in a real client repository: the pages exist for the template and the test fixture only, until the sandbox repository exists |
| 2026-10-20 | The twelve gates pass locally; the tool's tests on Node cover the two `check` commands (budgets, pointer files, the rules cross-check, copied facts, names used without a row, a bad or missing registry, the exit codes) and the doctor's `AGENTS-01`; both commands pass on the client template and the fixture; the tool's README, the template's files and the record are indexed and their links resolve | The checks have run on the template and the fixture only; the kit repository keeps its own script versions of the same two gates until a later clean-up folds them onto the tool |
| 2026-10-20 | The twelve gates pass locally, the manifest gate now on the IAM module's test Worker too; the module's eleven tests pass inside the Workers runtime against migration 0004, the 320-case table among them; the module's README and the record are indexed and their links resolve | No Worker runs the module: nothing is measured on a request, and the check's timing budget waits for the sandbox |
| 2026-10-20 | The twelve gates pass locally, the manifest gate on the IAM module's test Worker with its KV binding; the pipeline's twenty tests and the module's twenty pass inside the Workers runtime, the KV writes counted; the two READMEs and the record are indexed and their links resolve | No Worker runs the sessions: the KV read's latency on a request and the write count over a real day are unmeasured until the sandbox |
| 2026-10-20 | The twelve gates pass locally; the IAM module's thirty-eight tests pass inside the Workers runtime against migrations 0003 to 0005, the eighteen governance tests among them, each rule refused and then obeyed; the module's README and the record are indexed and their links resolve | No Worker runs the governance: no route calls it yet, the emailed notices of plan 7.3 wait for phase 4, and the quarterly review's schedule waits for the module manifest |
| 2026-10-20 | The twelve gates pass locally; the IAM module's forty-seven tests pass inside the Workers runtime against migrations 0003 to 0006, the nine handover tests among them, from an empty portal to the three Vendor access modes; the module's README and the record are indexed and their links resolve | No Worker runs the handover: the invitation link is not sent (phase 4) and no route accepts it yet (the screens step); the Owners are not yet emailed on a Vendor action |
| 2026-10-20 | The twelve gates pass locally; the IAM module's fifty-five tests pass inside the Workers runtime, the eight route tests among them, end to end through the pipeline from an empty portal; the pipeline's and the contract's tests cover the route open to any identity; the three READMEs and the record are indexed and their links resolve | No Worker serves the routes: the problem shapes and the capability refusals are seen in tests only, and the time a route costs on a request is unmeasured until the sandbox |

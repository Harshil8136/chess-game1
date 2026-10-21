---
title: "Documentation index, and where things stand"
status: living
owner: vendor
last_verified: 2026-10-21
sources: [this repository]
---

# Documentation: index and where things stand

> **In plain words.** This folder is the written side of the kit, kept so the owner can follow
> the work on a phone as it happens. This page says where the work stands, lists every
> document and says which fact each one owns. The plan the work follows lives elsewhere and is
> linked below.

## Where things stand

The kit is in **phase 6, release pipeline and upgrade**, since 2026-10-21; phases 3 to 5
were built the same day but for the parts their tables name as waiting. The first screens run on
the owner's computer since 2026-10-21, with two commands; their cost on Cloudflare is measured
with the sandbox, and every phase's acceptance waits on the sandbox repository.
The plan's open decisions still wait on the owner (they are listed in the plan). Phase 0, set up
and measure, has these parts:

| Part | State |
|---|---|
| This repository, with the contract every agent reads first (ai.md, rules.md, the generated pointer files) | **done** 2026-10-19 |
| The token registry with reuse before create, and the gate that enforces it | **done** 2026-10-19: nine names from the plan, none created yet |
| The verify chain skeleton with the scan for copied names and identifier shapes | **done** 2026-10-19: five gates then ([what verify runs](reference/verify.md)), run locally and on every push |
| The public docs mirror: this folder, the root `.md` files and LICENSE copied to the mirror after every green verify on `main` | **done** 2026-10-19 |
| A client template repository and a sandbox client repository | **template done** 2026-10-20, as `templates/client` in this repository ([the record](records/2026-10-20-client-template-and-setup.md)); the sandbox repository waits on the owner |
| A fresh Cloudflare account for the sandbox client | not started: the owner creates it |
| The CPU measurement of three sample screens in the sandbox | not started: needs the sandbox |
| The first week's open questions (the configuration layers, encryption in the Worker, the test runner on GitHub, the secrets cap) | not started |
| Working on Windows: LF line endings on every checkout, and `pnpm verify` and the tool starting pnpm and wrangler without a shell | **done** 2026-10-21, from the owner's run on a Windows computer: [the record](records/2026-10-21-windows.md) |
| `pnpm dev`, and the second Windows run: paths written with `/`, the `oltrem` command linked before the first build, no install-script prompt | **done** 2026-10-21: [the record](records/2026-10-21-windows-second-run.md) |
| Two commands with npm alone, `npm install` then `npm run dev`: the portal and its screens on the owner's computer, behind a sign-in only `localhost` has | **done** 2026-10-21: [the record](records/2026-10-21-screens-and-npm.md) |

Phase 1, the core runtime, has these parts so far:

| Part | State |
|---|---|
| The toolchain: TypeScript, tests inside the Workers runtime, the linter with the module-boundary rules, the formatter, and the dependency registry with its gate | **done** 2026-10-19: [the phase 1 record](records/2026-10-19-phase-1-toolchain-and-core-config.md) |
| `@oltrem/core-config`: the settings registry, the four configuration layers and the fast read path (memory, one KV snapshot, D1 as the truth) | **done** 2026-10-19: the client template's Worker reads its settings through it |
| `@oltrem/cli`, the command-line tool: `oltrem manifest check` (the resource manifest gate), `migrations sync` and `migrations apply`, `setup`, `docs`, `check agents`, `check tokens` and `oltrem doctor` | **done** 2026-10-20: [the first record](records/2026-10-20-cli-manifest-check-and-doctor.md), [the second](records/2026-10-20-client-template-and-setup.md), [the third](records/2026-10-20-cli-docs-command.md) and [the fourth](records/2026-10-20-cli-check-commands.md); the plan's list for phase 1 is complete |
| The core runtime: `@oltrem/core-errors`, `core-module`, `core-http`, `core-outbox` and `core-audit` (errors as data, the module contract, the one pipeline and the three Worker handlers, the outbox with replay, the hashed audit log) | **done** 2026-10-20: [the record](records/2026-10-20-core-runtime-packages.md); the client template's Worker is built from them |
| `@oltrem/core-ui`: the token list as a Tailwind theme, the phone-first primitives on native elements, and the three widgets on Zag.js | **done** 2026-10-20: [the primitives record](records/2026-10-20-core-ui-tokens-and-primitives.md) and [the widgets record](records/2026-10-20-core-ui-widgets.md); the gallery page and the screen gates wait on an Astro app |
| The client template and `oltrem setup`: the model of a client repository, resources by name, the kit's migrations copied with checksums, the one deploy workflow | **done** 2026-10-20: [the record](records/2026-10-20-client-template-and-setup.md); the first deploy waits on the sandbox repository and the fresh account |
| `oltrem docs`: the generated reference of a client repository, checked current on every verify | **done** 2026-10-20: [the record](records/2026-10-20-cli-docs-command.md); the client template carries its five pages |
| `oltrem check agents` and `check tokens`: the instruction files and the token registry of a client repository, checked on every verify | **done** 2026-10-20: [the record](records/2026-10-20-cli-check-commands.md) |
| The phase's acceptance: a blank client repository deploys from GitHub with no hand-pasted id and one stored token, the doctor green, a red push not deployed | not started: needs the sandbox repository and the fresh account, the owner's steps |

Phase 2, permissions and users, has these parts so far:

| Part | State |
|---|---|
| `@oltrem/iam`, the model and the check: the tables, the capability registry, the compiler and `can()` | **done** 2026-10-20: [the record](records/2026-10-20-iam-model-and-check.md); the client template runs it |
| Sessions and the authorizer: the map inside a session, a revoke visible on the next request | **done** 2026-10-20: [the record](records/2026-10-20-iam-sessions-and-authorizer.md); the client template runs it |
| Governance: the writes and their rules (grant only what you hold, below your position), expiring grants, access requests, reviews | **done** 2026-10-20: [the record](records/2026-10-20-iam-governance.md); the client template runs it |
| The Vendor and the handover: tenant creation, the first Owner's invitation, Vendor access settings | **done** 2026-10-20: [the record](records/2026-10-20-iam-vendor-and-handover.md); the client template runs it |
| The routes: the JSON side of the model under `/api/iam`, the acceptance of an invitation open to any identity | **done** 2026-10-20: [the record](records/2026-10-20-iam-routes.md); the client template runs it |
| `@oltrem/users`: the directory with profiles, switching accounts off and on under the standing rules, its routes | **done** 2026-10-21: [the record](records/2026-10-21-users-module.md); service accounts and the door's group sync come later |
| The client template mounts IAM and users: `ACCESS_AUD` as a required Worker secret read on each request, the Vendor let in, no account refused | **done** 2026-10-21: [the record](records/2026-10-21-template-mounts-iam.md); the Vendor's address is written after the first deploy by `oltrem vendor set`: [the record](records/2026-10-21-vendor-address.md) |
| The phone screens | **first screens done** 2026-10-21: [the record](records/2026-10-21-screens-and-npm.md); people and access forms: [the record](records/2026-10-21-people-and-access-screens.md); their cost is measured in the sandbox |

Phase 3, the module system, has these parts so far:

| Part | State |
|---|---|
| The manifest declares a module's capabilities on its bit plane; the Worker registers them at its start, once per module version, and the check reads the new ones at once | **done** 2026-10-21: [the record](records/2026-10-21-module-capabilities.md); the client template runs it |
| Jobs on the manifest and the one tick (`@oltrem/core-jobs`): each run leased, recorded, and tried again at its next time | **done** 2026-10-21: [the record](records/2026-10-21-jobs-and-the-tick.md); the client template runs it on its five-minute cron; no module declares a job yet |
| Health on the manifest and its runner (`@oltrem/core-health`): the checks run as a job on the tick, the last result kept per check, a problem opened after two failures in a row; migrations, settings and errors declared on the manifest and checked against their owner | **done** 2026-10-21: [the record](records/2026-10-21-health-and-manifest-fields.md); the client template mounts it |
| The generator `oltrem new module` and the module template it copies, proven on every verify: a complete module (route, job, check, migration, setting, error, test, how-to) that a client's verify passes with no edits, with its own contract test | **done** 2026-10-21: [the record](records/2026-10-21-the-module-generator.md); no page, no capabilities and the setting read as its default until the kit has them |
| The generated reference of a client reads its modules: `oltrem docs` imports `src/modules.ts` in a child Node process and writes a Modules page (capabilities, routes, jobs, checks, migrations, settings, errors) that a client's verify holds current | **done** 2026-10-21: [the record](records/2026-10-21-generated-references.md); the kit's own modules are documented in the kit |
| The capability version gate: a client's `oltrem docs` keeps `capabilities.json`, each module's capabilities under its version, and refuses a change made under the same version, since the Worker registers them once per version | **done** 2026-10-21: [the record](records/2026-10-21-capability-version-gate.md) |
| The page fields of the manifest (pages, i18n, docs) and the contract tests generated from manifests | wait on the renderer, after the sandbox measurement |
| Alerts and the key recipes on the reference | the key recipes **done** 2026-10-21 in phase 4: [the record](records/2026-10-21-key-recipes.md); alerts come with the providers of phase 4 |
| The migration ledger check at the Worker's start | not started |

Phase 4, providers and email, has these parts so far:

| Part | State |
|---|---|
| Envelope encryption (`@oltrem/core-crypto`): one key-encryption key as the Worker secret, a data key per tenant wrapped by it, each credential sealed to its tenant and row, rotation under the one secret name | **done** 2026-10-21: [the record](records/2026-10-21-envelope-encryption.md); no credential is stored yet |
| The providers module (`@oltrem/providers`): the definition contract, seven email providers as data, per-tenant instances with their sealed credential, the failover order, the routes | **done** 2026-10-21: [the record](records/2026-10-21-providers-as-data.md); nothing speaks to a provider yet |
| The HTTP template engine, the SMTP client and the auth schemes behind the two email adapters | **done** 2026-10-21: [the record](records/2026-10-21-email-adapters.md); no request has reached a real provider yet |
| The five webhook signature verifiers and the field map to the nine event kinds | **done** 2026-10-21: [the record](records/2026-10-21-webhook-verifiers.md) |
| Detection of a domain's provider by DNS over HTTPS, with evidence, and the daily re-fingerprint | **done** 2026-10-21: [the record](records/2026-10-21-provider-detection.md); the fingerprints are confirmed on the sandbox domain |
| The email module: the outbox consumer, the idempotency lease, failover, templates compiled at build time, the canary send, alerts | **done** 2026-10-21: [the record](records/2026-10-21-email-module.md); the delivery reports' public address, on the owner's yes: [the record](records/2026-10-21-delivery-reports.md) |
| Key recipes, the generated `secrets.required` block and the doctor checks; the Setup page waits with the screens | **done** 2026-10-21: [the record](records/2026-10-21-key-recipes.md); the live secret check and the provider probes come with the sandbox and the Setup page |
| The client template mounts providers and email, with the KEK secret and the sending address as a setting | **done** 2026-10-21: [the record](records/2026-10-21-template-mounts-email.md) |
| The phase's acceptance: two providers as rows with test accounts, detection on the sandbox domain, a canary and a delivery webhook round trip, failover by disabling the active row | not started: needs the sandbox and the owner's test accounts |

Phase 5, backup, GitHub, home and health, has these parts so far:

| Part | State |
|---|---|
| The age format a backup copy is written in (`@oltrem/core-crypto/age`): standard age to one X25519 recipient, streamed in 64 KiB chunks, its size known in advance | **done** 2026-10-21: [the record](records/2026-10-21-age-format.md); nothing is backed up yet |
| The backup module: the nightly export as a flow in the one Workflow, encrypted on its way into the bucket, the run records, a run by hand, the Time Travel bookmark, the freshness check | **done** 2026-10-21: [the record](records/2026-10-21-backup-module.md); the client template runs it; `oltrem backup setup` sets it up: [the record](records/2026-10-21-backup-setup.md) |
| The restore drill (`oltrem backup drill`): the newest copy opened with the private key on the vendor's computer, loaded into a scratch database, every row found, everything deleted, the outcome recorded; the drill check on System health | **done** 2026-10-21: [the record](records/2026-10-21-restore-drill.md); no drill has run against a real account |
| The GitHub module: each deploy run reported into the database by the workflow with no GitHub token, the kit version production runs, whether a newer one is published, the deploy check | **done** 2026-10-21: [the record](records/2026-10-21-github-module.md); the client template runs it, and its workflow reports every run on main |
| The free-plan budgets on System health: measured every fifteen minutes, warned and failed on their lines, the other jobs paused while one they spend is nearly gone | **done** 2026-10-21: [the record](records/2026-10-21-free-plan-budgets.md); the client template measures them; the Actions minutes are in `oltrem doctor`: [the record](records/2026-10-21-actions-minutes.md) |
| The client template mounts backup, GitHub and the budgets, with the one Workflow and the deploy's report step | **done** 2026-10-21: [the record](records/2026-10-21-template-mounts-backup.md) |
| The home module | a home screen with a card per module **done** 2026-10-21 ([the record](records/2026-10-21-screens-and-npm.md)); the module itself is not built |
| The phase's acceptance: a nightly export of the sandbox under the bucket lock, a restore drill, the kit version, every budget on System health | not started: needs the sandbox |

Anything deployed, measured or connected to an account is still to come: the sandbox client needs
the fresh Cloudflare account, the owner's step.

Phase 6 has these parts so far:

| Part | State |
|---|---|
| Versions and release notes (Changesets) | **done** 2026-10-21: [the record](records/2026-10-21-changesets.md), [how it works](release.md) |
| `oltrem upgrade` | **done** 2026-10-21: [the record](records/2026-10-21-oltrem-upgrade.md) |
| Publishing to GitHub Packages, Dependabot on the sandbox, previews on a branch | waits on the `oltrem` organisation and the sandbox |

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
| [Versions and release notes](release.md) | how packages are versioned and how a change's note is written | living |
| [Verification log](verification-log.md) | one row per change: what was checked before the push and what was not | living |
| [Token registry](reference/tokens.md) | every credential by name, its scopes, where it is stored and why it exists | generated from `tokens.registry.json` |
| [What verify runs](reference/verify.md) | the gates, their order and what each refuses | generated from `scripts/lib/gates.mjs` |
| [Dependencies](reference/dependencies.md) | every third-party package, its one pinned version, who uses it and why | generated from `dependencies.registry.json` and the catalog |
| [@oltrem/core-config](../packages/core-config/README.md) | the four configuration layers, the settings registry, the read path and the storage the package owns | written, beside the code |
| [@oltrem/cli](../packages/cli/README.md) | the `oltrem` tool: the manifest check, its caps and the manifest format, `new module`, the restore drill, the run report, the doctor's checks and exit codes | written, beside the code |
| [@oltrem/core-errors](../packages/core-errors/README.md) | how an error is defined, the code blocks, and the problem document every failure answers with | written, beside the code |
| [@oltrem/core-module](../packages/core-module/README.md) | the module contract: routes, capabilities, schemas, event types, jobs, flows, health checks, migrations, settings, errors, what it refuses | written, beside the code |
| [@oltrem/core-http](../packages/core-http/README.md) | the request pipeline, the same-origin rule, the identity headers and the token's claims, the startup hook, the session hook, the three Worker handlers | written, beside the code |
| [@oltrem/core-outbox](../packages/core-outbox/README.md) | the outbox: how a row moves, the backoff ladder, replay, and the table it owns | written, beside the code |
| [@oltrem/core-audit](../packages/core-audit/README.md) | the audit log: the fields and their rules, what is refused, hashing and verify, and the table it owns | written, beside the code |
| [@oltrem/core-jobs](../packages/core-jobs/README.md) | the one tick: how a job is declared, how it is leased, run and recorded, and the table it owns; the one Workflow: how a flow is started and run step by step | written, beside the code |
| [@oltrem/core-health](../packages/core-health/README.md) | system health: how a module declares its checks, how the health job runs them on the tick and opens a problem after two failures in a row, and the table it owns | written, beside the code |
| [@oltrem/core-crypto](../packages/core-crypto/README.md) | envelope encryption for stored credentials: the one key-encryption key, a data key per tenant, each value sealed to its row, and how the key rotates under one secret name | written, beside the code |
| [@oltrem/core-ui](../packages/core-ui/README.md) | the token list, the brand variables, light and dark, every primitive with the rule it keeps, and the three widgets | written, beside the code |
| [@oltrem/iam](../modules/iam/README.md) | the permission model: capabilities and their bits, roles, scopes, groups, bindings, overrides, the compiled map, the check's order and reasons, the session record and when it is written, the authorizer, the governance rules and the approvals, the Vendor, invitations and the handover, the tables and the error codes | written, beside the code |
| [@oltrem/users](../modules/users/README.md) | the people: the directory and the profile, the rules of switching an account off and on, the routes, the table and the error codes | written, beside the code |
| [@oltrem/providers](../modules/providers/README.md) | providers as data: the definition contract and the kit's seven email definitions, instances with their sealed credentials, the failover order, the routes, the tables and the error codes | written, beside the code |
| [@oltrem/email](../modules/email/README.md) | email as the kit sends it: typed templates and the escaping `html` tag, sending through the outbox, the lease per message key, failover, the held messages, the canary and messages routes, the health check, the table and the error codes | written, beside the code |
| [@oltrem/backup](../modules/backup/README.md) | backups as the kit makes them: the export flow step by step, one export at a time, the routes, the freshness and drill checks, the restore drill, the settings and secrets, how to open a copy, the table and the error codes | written, beside the code |
| [@oltrem/github](../modules/github/README.md) | the repository as the portal sees it: the run report the deploy workflow writes, the status and runs routes, the deploy check, the table | written, beside the code |
| [@oltrem/screens](../packages/screens/README.md) | the portal's screens: the frame and its row, each page and the API it reads, the first run, the stylesheet | written, beside the code |
| [The client template](../templates/client/README.md) | what a client repository is made of: the client file, the manifest, the kit's migrations, the one workflow, the two secret names | written, beside the code |
| [The module template](../templates/module/README.md) | the `sample-notes` module `oltrem new module` copies into a client repository, written as the how-to the client keeps: its parts, what to change, what is not there yet | written, beside the code; copied by the generator |

The records, each dated and frozen once written; each also gives the decisions it took and how it
was verified:

| Record | What it tells |
|---|---|
| [Phase 0: the repository basics](records/2026-10-19-phase-0-repository-basics.md) | what the first commit set up, why |
| [Phase 1: the toolchain and the configuration layers](records/2026-10-19-phase-1-toolchain-and-core-config.md) | what the toolchain and the first core package are |
| [The licence change](records/2026-10-20-licence-change.md) | why Apache-2.0 was replaced by the Oltrem Licence, the terms chosen, and what still needs a lawyer |
| [Phase 1: the command-line tool](records/2026-10-20-cli-manifest-check-and-doctor.md) | what the manifest check and the doctor are |
| [Phase 1: the core runtime](records/2026-10-20-core-runtime-packages.md) | what the five runtime packages are |
| [Phase 1: the design kit](records/2026-10-20-core-ui-tokens-and-primitives.md) | what the theme and the primitives are |
| [Phase 1: the client template and the setup command](records/2026-10-20-client-template-and-setup.md) | what the template and the migration and setup commands are |
| [Phase 1: the three widgets](records/2026-10-20-core-ui-widgets.md) | what the combobox, the menu and the date range are |
| [Phase 1: the generated reference](records/2026-10-20-cli-docs-command.md) | what `oltrem docs` writes in a client repository |
| [Phase 1: the two check commands](records/2026-10-20-cli-check-commands.md) | what `oltrem check agents` and `check tokens` refuse in a client repository |
| [Phase 2: the permission model and the check](records/2026-10-20-iam-model-and-check.md) | what the IAM module's tables, registry, compiler and check are |
| [Phase 2: sessions and the authorizer](records/2026-10-20-iam-sessions-and-authorizer.md) | how the compiled map travels in one KV record per person, the pipeline's session hook and authorizer |
| [Phase 2: governance](records/2026-10-20-iam-governance.md) | the writes that change who may do what and the rules each is refused by, the second person, requests and reviews |
| [Phase 2: the Vendor and the handover](records/2026-10-20-iam-vendor-and-handover.md) | how the Vendor creates the one company and invites its first Owner, what the handover changes, how the company lets the Vendor in |
| [Phase 2: the routes](records/2026-10-20-iam-routes.md) | the fifty-four JSON routes of the IAM module, the one route open to any identity and the pipeline change behind it, the capability every account holds |
| [Phase 2: the users module](records/2026-10-21-users-module.md) | the second module: the directory and the profile, the switch and its rules, how a module stands on the IAM module |
| [Phase 2 in the client template](records/2026-10-21-template-mounts-iam.md) | how the template's Worker came to run IAM and users, the Access audience secret, what is still owed |
| [The Vendor's address](records/2026-10-21-vendor-address.md) | the command that writes the Vendor's address after the first deploy, why it is in no file |
| [Phase 3: capabilities on the manifest](records/2026-10-21-module-capabilities.md) | how a module declares what its routes check, how the Worker registers it at its start and keeps the check current |
| [Phase 3: jobs and the tick](records/2026-10-21-jobs-and-the-tick.md) | how a module declares its periodic work, how the one tick runs it under a lease and records it |
| [Phase 3: health and the manifest's last data fields](records/2026-10-21-health-and-manifest-fields.md) | how a module declares its health checks, migrations, settings and errors, how the health job runs the checks and opens a problem |
| [Phase 3: the module generator](records/2026-10-21-the-module-generator.md) | how `oltrem new module` writes a complete module from the proven template, how the client Worker finds it |
| [Phase 3: the generated references](records/2026-10-21-generated-references.md) | how a client's reference reads its modules by importing them in Node, what the Modules page shows |
| [Phase 3: the capability version gate](records/2026-10-21-capability-version-gate.md) | why a module's version must move with its capabilities, how `oltrem docs` refuses a change made under the same version |
| [Phase 4: envelope encryption](records/2026-10-21-envelope-encryption.md) | how a stored credential is sealed to its row under a data key wrapped by the one key-encryption key, how the key rotates under one secret name |
| [Phase 4: providers as data](records/2026-10-21-providers-as-data.md) | how a provider is a definition and never an adapter, what the kit's seven email definitions carry, how an instance holds its sealed credential and its place in the failover order |
| [Phase 4: the email adapters](records/2026-10-21-email-adapters.md) | how one HTTP adapter and one SMTP client send through every email definition, the auth schemes with AWS SigV4, the probe route, what keeps a credential out of the clear and out of an error |
| [Phase 4: the webhook verifiers](records/2026-10-21-webhook-verifiers.md) | how a provider's delivery report is checked by its own signature scheme, which key each reads, how a report becomes the kit's delivery events, checked against signatures made outside the kit |
| [Phase 4: provider detection](records/2026-10-21-provider-detection.md) | how a domain's public DNS suggests the providers it already uses, strong and weak evidence, why a suggestion never sends by itself, the daily re-check and its drift warning |
| [Phase 4: the email module](records/2026-10-21-email-module.md) | how a message is checked when it is asked for, held while no provider is ready, sent once under the kit's own lease through the active instance or a failover, the canary, the health check |
| [Phase 4: the delivery reports' address](records/2026-10-21-delivery-reports.md) | why one public path skips the sign-in door, how a report is checked by a secret token and the provider's signature, how each event is kept on its message |
| [Phase 4: key recipes](records/2026-10-21-key-recipes.md) | how a module declares the Worker secrets it needs with their instructions, the KEK's recipe, the generated Key recipes page, the check that the required secrets match |
| [Phase 5: the age format](records/2026-10-21-age-format.md) | how a backup copy is locked in the standard age format with the runtime's own cipher and no package, why the private key never reaches the Worker, checked by the real age tool |
| [Phase 5: the backup module](records/2026-10-21-backup-module.md) | how the nightly copy is asked of Cloudflare, encrypted on its way into the bucket and recorded, the one Workflow that runs it step by step |
| [Phase 5: the restore drill](records/2026-10-21-restore-drill.md) | how the newest backup copy is proven to open and load on the vendor's computer, why the key never reaches the Worker, what is checked and what is deleted |
| [Phase 5: the GitHub module](records/2026-10-21-github-module.md) | how the portal learns its kit version, a newer release and its last deploy without a GitHub token |
| [Phase 5: the free plan's budgets](records/2026-10-21-free-plan-budgets.md) | what System health measures against the free plan, how the jobs pause, the token widened |
| [Phase 4 in the client template](records/2026-10-21-template-mounts-email.md) | the template's providers and email, the sending address, the rule that keeps kit code loadable in Node |
| [Phase 5 in the client template](records/2026-10-21-template-mounts-backup.md) | the template's backup, deploy report and budgets, the Workflow and its schedules, the runtime stand-in for Node |
| [Phase 5: the backup's setup](records/2026-10-21-backup-setup.md) | the backup's settings and bucket rules, set once after the first deploy |
| [Phase 5: the Actions minutes](records/2026-10-21-actions-minutes.md) | how `oltrem doctor` reads the month's GitHub Actions minutes |
| [Working on Windows](records/2026-10-21-windows.md) | why `npm install` cannot install the kit, why `pnpm verify` failed on Windows and how it was fixed, the line endings |
| [Working on Windows: the second run and pnpm dev](records/2026-10-21-windows-second-run.md) | the two tests and two install warnings of the second Windows run, what `pnpm dev` runs and shows |
| [Phase 6: oltrem upgrade](records/2026-10-21-oltrem-upgrade.md) | what an upgrade checks before it writes |
| [Verification log, 19 and 20 October](records/2026-10-19-to-20-verification-log.md) | the log's first rows, moved there unchanged |
| [The screens and two commands](records/2026-10-21-screens-and-npm.md) | how `npm install` and `npm run dev` bring up the portal and its screens, the local sign-in and its two locks, why the screens render in the Worker for now |
| [The people and access screens](records/2026-10-21-people-and-access-screens.md) | the forms that invite, give and end roles, switch accounts, make roles and add places, and how a form travels through the API |
| [Phase 6: versions and release notes](records/2026-10-21-changesets.md) | why Changesets, the version groups, what publishing still needs |

## How this folder is checked

`pnpm docs:check`, one of the gates of `pnpm verify`, refuses a document without front matter,
a document missing from the tables above, a document over its size budget, a relative link that
points nowhere, and a generated document that differs from its source. Records are frozen: a
later change is a new record, not an edit.

## How to read this on a phone

Every document opens with a short summary in plain words. Tables are kept narrow; the generated
token page gives each credential its own small table instead of one wide one.

## Verification log

What was checked before each push, and what was not, is one row per change in
[the verification log](verification-log.md); a change adds its row there in the same commit.

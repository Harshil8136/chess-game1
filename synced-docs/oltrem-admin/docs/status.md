---
title: "Where things stand, phase by phase"
status: living
owner: vendor
last_verified: 2026-10-27
sources: [this repository, its records]
---

# Where things stand, phase by phase

> **In plain words.** One table per phase of the plan, one row per part, each with its state and
> the record that says how it was built. What comes next, and why, is in
> [the roadmap](roadmap.md).

The kit is in **phase 6, release pipeline and upgrade**, since 2026-10-21; phases 3 to 5
were built the same day but for the parts their tables name as waiting. The first screens run on
the owner's computer since 2026-10-21, with two commands; their cost on Cloudflare is measured
with the sandbox, and every phase's acceptance waits on the sandbox repository.
The plan's open decisions still wait on the owner. Phase 0, set up
and measure, has these parts:

| Part | State |
|---|---|
| This repository, with the contract every agent reads first (ai.md, rules.md, the generated pointer files) | **done** 2026-10-19 |
| The token registry with reuse before create, and the gate that enforces it | **done** 2026-10-19: nine names from the plan, none created yet |
| The verify chain skeleton with the scan for copied names and identifier shapes | **done** 2026-10-19: five gates then ([what verify runs](reference/verify.md)), run locally and on every push |
| The public docs mirror, described below | **done** 2026-10-19 |
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
| `@oltrem/cli`, the command-line tool: `manifest check`, `migrations sync` and `apply`, `setup`, `docs`, `check agents`, `check tokens`, `doctor` | **done** 2026-10-20: records [one](records/2026-10-20-cli-manifest-check-and-doctor.md), [two](records/2026-10-20-client-template-and-setup.md), [three](records/2026-10-20-cli-docs-command.md), [four](records/2026-10-20-cli-check-commands.md) |
| The core runtime: `@oltrem/core-errors`, `core-module`, `core-http`, `core-outbox` and `core-audit` (errors as data, the module contract, the one pipeline and the three Worker handlers, the outbox with replay, the hashed audit log) | **done** 2026-10-20: [the record](records/2026-10-20-core-runtime-packages.md); the client template's Worker is built from them |
| `@oltrem/core-ui`: the token list as a Tailwind theme, the phone-first primitives on native elements, and the three widgets on Zag.js | **done** 2026-10-20: [the primitives record](records/2026-10-20-core-ui-tokens-and-primitives.md) and [the widgets record](records/2026-10-20-core-ui-widgets.md); the gallery page and the screen gates wait on an Astro app |
| The client template and `oltrem setup`: the model of a client repository, resources by name, the kit's migrations copied with checksums, the one deploy workflow | **done** 2026-10-20: [the record](records/2026-10-20-client-template-and-setup.md); `npm run deploy` [built](records/2026-10-21-one-command-deploy.md), first run on the sandbox |
| `oltrem docs`: a client repository's generated reference, checked on every verify | **done** 2026-10-20: [the record](records/2026-10-20-cli-docs-command.md); the template carries its five pages |
| `oltrem check agents` and `check tokens`: a client repository's instruction files and token registry, checked on every verify | **done** 2026-10-20: [the record](records/2026-10-20-cli-check-commands.md) |
| The phase's acceptance: a blank client repository deploys from GitHub with no hand-pasted id and one stored token, the doctor green, a red push not deployed | not started: needs the sandbox repository and the fresh account, the owner's steps |

Phase 2, permissions and users, has these parts so far:

| Part | State |
|---|---|
| `@oltrem/iam`, the model and the check: the tables, the capability registry, the compiler and `can()` | **done** 2026-10-20: [the record](records/2026-10-20-iam-model-and-check.md); the template runs it |
| Sessions and the authorizer: the map inside a session, a revoke visible on the next request | **done** 2026-10-20: [the record](records/2026-10-20-iam-sessions-and-authorizer.md); the template runs it |
| Governance: the writes and their rules (grant only what you hold, below your position), expiring grants, access requests, reviews | **done** 2026-10-20: [the record](records/2026-10-20-iam-governance.md); the template runs it |
| The Vendor and the handover: tenant creation, the first Owner's invitation, Vendor access settings | **done** 2026-10-20: [the record](records/2026-10-20-iam-vendor-and-handover.md); the template runs it |
| The routes: the JSON side of the model under `/api/iam`, the acceptance of an invitation open to any identity | **done** 2026-10-20: [the record](records/2026-10-20-iam-routes.md); the template runs it |
| `@oltrem/users`: the directory with profiles, switching accounts off and on under the standing rules, its routes | **done** 2026-10-21: [the record](records/2026-10-21-users-module.md); service accounts and the door's group sync come later |
| The client template mounts IAM and users: `ACCESS_AUD` as a required Worker secret read on each request, the Vendor let in, no account refused | **done** 2026-10-21: [the record](records/2026-10-21-template-mounts-iam.md); [the Vendor's address](records/2026-10-21-vendor-address.md) after the first deploy |
| The phone screens | **first screens done** 2026-10-21: [the record](records/2026-10-21-screens-and-npm.md); [forms that change things](records/2026-10-21-people-and-access-screens.md); [Home widgets](records/2026-10-21-home-widgets.md); cost measured in the sandbox |

Phase 3, the module system, has these parts so far:

| Part | State |
|---|---|
| The manifest declares a module's capabilities on its bit plane; the Worker registers them at its start, once per module version, and the check reads the new ones at once | **done** 2026-10-21: [the record](records/2026-10-21-module-capabilities.md); the template runs it |
| Jobs on the manifest and the one tick (`@oltrem/core-jobs`): each run leased, recorded, and tried again at its next time | **done** 2026-10-21: [the record](records/2026-10-21-jobs-and-the-tick.md); the template runs it on its five-minute cron; no module declares a job yet |
| Health on the manifest and its runner (`@oltrem/core-health`), run as a job on the tick; migrations, settings and errors declared on the manifest | **done** 2026-10-21: [the record](records/2026-10-21-health-and-manifest-fields.md); the client template mounts it |
| The generator `oltrem new module` and the module template it copies, proven on every verify: a complete module that a client's verify passes unedited | **done** 2026-10-21: [the record](records/2026-10-21-the-module-generator.md); no page, no capabilities and the setting read as its default until the kit has them |
| The generated reference of a client reads its modules: `oltrem docs` writes a Modules page that a client's verify holds current | **done** 2026-10-21: [the record](records/2026-10-21-generated-references.md); the kit's own modules are documented in the kit |
| The capability version gate: a client's `oltrem docs` keeps `capabilities.json`, each module's capabilities under its version, and refuses a change made under the same version, since the Worker registers them once per version | **done** 2026-10-21: [the record](records/2026-10-21-capability-version-gate.md) |
| The page fields of the manifest (pages, i18n, docs) and the contract tests generated from manifests | wait on the renderer, after the sandbox measurement |
| Alerts, the key recipes, the audit page and seal | **done** 2026-10-21: [key recipes](records/2026-10-21-key-recipes.md), [alerts](records/2026-10-21-alerts.md), [audit](records/2026-10-21-audit-seal-and-export.md) |
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
| The backup module: the nightly export in the one Workflow, encrypted into the bucket, the run records, a run by hand, the Time Travel bookmark, the freshness check | **done** 2026-10-21: [the record](records/2026-10-21-backup-module.md); the template runs it; `oltrem backup setup` sets it up: [the record](records/2026-10-21-backup-setup.md) |
| The restore drill (`oltrem backup drill`): the newest copy opened on the vendor's computer into a scratch database, every row found, the outcome recorded; the drill check on System status | **done** 2026-10-21: [the record](records/2026-10-21-restore-drill.md); no drill has run against a real account |
| The GitHub module: each deploy run reported into the database with no GitHub token, the kit version production runs, whether a newer one is published, the deploy check | **done** 2026-10-21: [the record](records/2026-10-21-github-module.md); the template runs it, and its workflow reports every run on main |
| The free-plan budgets on System status: measured every fifteen minutes, warned and failed on their lines, other jobs paused while one is nearly spent | **done** 2026-10-21: [the record](records/2026-10-21-free-plan-budgets.md); the client template measures them; the Actions minutes are in `oltrem doctor`: [the record](records/2026-10-21-actions-minutes.md) |
| The client template mounts backup, GitHub and the budgets, with the one Workflow and the deploy's report step | **done** 2026-10-21: [the record](records/2026-10-21-template-mounts-backup.md) |
| The home module | a home screen with a card per module **done** 2026-10-21 ([the record](records/2026-10-21-screens-and-npm.md)); the module itself is not built |
| The phase's acceptance: a nightly export of the sandbox under the bucket lock, a restore drill, the kit version, every budget on System status | not started: needs the sandbox |

Anything deployed, measured or connected to an account is still to come: the sandbox client needs
the fresh Cloudflare account, the owner's step.

Phase 6 has these parts so far:

| Part | State |
|---|---|
| Versions and release notes (Changesets) | **done** 2026-10-21: [the record](records/2026-10-21-changesets.md), [how it works](release.md) |
| `oltrem upgrade` | **done** 2026-10-21: [the record](records/2026-10-21-oltrem-upgrade.md) |
| Checks on a client's code | **done** 2026-10-24: records [one](records/2026-10-24-client-code-checks.md), [two](records/2026-10-24-client-code-checks-part-two.md) |
| The automatic release, with its health check and step back | **done** 2026-10-24: [the record](records/2026-10-24-automatic-release.md) |
| The operations menu: fixed jobs on the live portal, from `main` | **done** 2026-10-24: [the record](records/2026-10-24-operations-menu.md) |
| Publishing to GitHub Packages, previews on a branch | waits on the `oltrem` organisation and the sandbox |

Features for any business, the owner's picks, **done** 2026-10-22: [your own records](records/2026-10-22-your-own-records.md), [forms and inbox](records/2026-10-22-forms-and-inbox.md).

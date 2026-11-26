---
title: "Where things stand, phase by phase"
status: living
owner: vendor
last_verified: 2026-11-20
sources: [this repository, its records]
---

# Where things stand, phase by phase

> **In plain words.** One table per phase of the plan, one row per part, each with its state and
> the record that says how it was built. What comes next, and why, is in
> [the roadmap](roadmap.md). The products built on the kit, and their phases, are in
> [the product plan](product-plan.md); the kit's own weak points, ranked, in
> [the kit review](reference/kit-review.md).

The kit's six phases are built but for the parts their tables name as waiting, and since
2026-10-27 the work has been the modules and screens of the [roadmap](roadmap.md) and the rounds
listed [at the end of this page](#since-2026-10-27). Each client has a private repository of its
own with the kit inside it (2026-11-01). Every phase's acceptance still waits on the sandbox
client: a fresh Cloudflare account and a private client repository, the owner's steps (K3 of the
kit review). The phone tests owed are listed in [one place](phone-tests.md). Phase 0, set up
and measure, has these parts:

| Part | State |
|---|---|
| This repository, with the contract every agent reads first (ai.md, rules.md, the generated pointer files) | **done** 2026-10-19 |
| The token registry with reuse before create, and the gate that enforces it | **done** 2026-10-19: nine names from the plan, none created yet |
| The verify chain skeleton with the scan for copied names and identifier shapes | **done** 2026-10-19: five gates then ([what verify runs](reference/verify.md)), run locally before every push (GitHub runs it on pull requests, weekly and by hand, not on a push since 2026-10-25) |
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
| `@oltrem/core-ui`: the token list as a Tailwind theme, the phone-first primitives on native elements, and the three widgets on Zag.js | **done** 2026-10-20: [the primitives record](records/2026-10-20-core-ui-tokens-and-primitives.md) and [the widgets record](records/2026-10-20-core-ui-widgets.md); the gallery page is not built; the screens are rendered with Preact by the screens package, and every page's names, labels and viewport are checked on each verify |
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
| Jobs on the manifest and the one tick (`@oltrem/core-jobs`): each run leased, recorded, and tried again at its next time | **done** 2026-10-21: [the record](records/2026-10-21-jobs-and-the-tick.md); the template runs it on its minute cron; most modules declare jobs now |
| Health on the manifest and its runner (`@oltrem/core-health`), run as a job on the tick; migrations, settings and errors declared on the manifest | **done** 2026-10-21: [the record](records/2026-10-21-health-and-manifest-fields.md); the client template mounts it |
| The generator `oltrem new module` and the module template it copies, proven on every verify: a complete module that a client's verify passes unedited | **done** 2026-10-21: [the record](records/2026-10-21-the-module-generator.md); the template has its capabilities and a page since |
| The generated reference of a client reads its modules: `oltrem docs` writes a Features page that a client's verify holds current | **done** 2026-10-21: [the record](records/2026-10-21-generated-references.md); the kit's own modules are documented in the kit |
| The capability version gate: a client's `oltrem docs` keeps `capabilities.json`, each module's capabilities under its version, and refuses a change made under the same version, since the Worker registers them once per version | **done** 2026-10-21: [the record](records/2026-10-21-capability-version-gate.md) |
| The page fields of the manifest (pages, i18n, docs) and the contract tests generated from manifests | pages **done** (`pages`, `home`, `hooks` on the manifest); words in other languages, per-module docs and generated contract tests not started |
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
| The restore drill (`oltrem backup drill`): the newest copy opened on the vendor's computer into a scratch database, every row found, the outcome recorded; the drill check on Status | **done** 2026-10-21: [the record](records/2026-10-21-restore-drill.md); no drill has run against a real account |
| The GitHub module: each deploy run reported into the database with no GitHub token, the kit version production runs, whether a newer one is published, the deploy check | **done** 2026-10-21: [the record](records/2026-10-21-github-module.md); the template runs it, and its workflow reports every run on main |
| The free-plan budgets on Status: measured every fifteen minutes, warned and failed on their lines, other jobs paused while one is nearly spent | **done** 2026-10-21: [the record](records/2026-10-21-free-plan-budgets.md); the client template measures them; the Actions minutes are in `oltrem doctor`: [the record](records/2026-10-21-actions-minutes.md) |
| The client template mounts backup, GitHub and the budgets, with the one Workflow and the deploy's report step | **done** 2026-10-21: [the record](records/2026-10-21-template-mounts-backup.md) |
| The home module | a home screen with a card per module **done** 2026-10-21 ([the record](records/2026-10-21-screens-and-npm.md)); the module itself is not built |
| The phase's acceptance: a nightly export of the sandbox under the bucket lock, a restore drill, the kit version, every budget on Status | not started: needs the sandbox |

Live portals run since 2026-11-04. Since 2026-11-11 every push to `main` updates every client's
portal by itself through [the fleet](reference/fleet.md), with no verify of its own: the local
`pnpm verify` is the only gate before it (the codebase review of 2026-11-20 proposes one).

Phase 6 has these parts so far:

| Part | State |
|---|---|
| Versions and release notes (Changesets) | **done** 2026-10-21: [the record](records/2026-10-21-changesets.md), [how it works](release.md) |
| `oltrem upgrade` | **done** 2026-10-21: [the record](records/2026-10-21-oltrem-upgrade.md) |
| Checks on a client's code | **done** 2026-10-24: records [one](records/2026-10-24-client-code-checks.md), [two](records/2026-10-24-client-code-checks-part-two.md) |
| The automatic release, with its health check and step back | **done** 2026-10-24: [the record](records/2026-10-24-automatic-release.md) |
| The operations menu: fixed jobs on the live portal, from `main` | **done** 2026-10-24: [the record](records/2026-10-24-operations-menu.md) |
| Publishing to GitHub Packages, previews on a branch | not planned for now: the owner chose on 2026-11-01 that Oltrem stays private, with no organisation and no registry until the owner calls it finished; each client repository carries the kit inside it instead ([the record](records/2026-11-01-one-repo-per-client.md)) |

Features for any business, the owner's picks, **done** 2026-10-22: [your own records](records/2026-10-22-your-own-records.md), [forms and inbox](records/2026-10-22-forms-and-inbox.md).

## Since 2026-10-27

The rounds after the phases, each with its record. The modules themselves are on
[the roadmap](roadmap.md).

| Round | State |
|---|---|
| Setup in one press: a start file per kind of computer, the setup page, the door (Cloudflare Access) kept by the portal, parts of the portal switched off without a deploy | **done** 2026-10-28 to 2026-10-31: records [one-click setup](records/2026-10-28-one-click-setup.md), [setup help](records/2026-10-28-setup-help-and-repair.md), [setup remade](records/2026-10-31-setup-door-parts.md) |
| The free plan's CPU: each page and each tick inside 10 ms, the sign-in trusted only as Cloudflare checked it, a key sent only to its own service, a deploy that steps back on its own | **done** 2026-11-01: [CPU](records/2026-11-01-cpu-budget.md), [core hardening](records/2026-11-01-core-hardening.md) |
| One private repository per client, the kit inside it, nothing published | **done** 2026-11-01: [the record](records/2026-11-01-one-repo-per-client.md) |
| Email and campaigns moved to Oltrem Mail, its own private repository, and kept here packed in `vendor/mail/`; the Mail add-on chosen, added and removed by the tool | **done** 2026-11-02: [moved out](records/2026-11-02-mail-moved-out.md), [in the tool](records/2026-11-02-oltrem-mail-in-the-tool.md), [the inbox](records/2026-11-02-oltrem-mail-inbox.md) |
| The kit review's findings: the error log, the size gate, one list of phone tests, the check of every page's names and labels | **done** 2026-11-03: [error log](records/2026-11-03-error-log.md), [size gate](records/2026-11-03-size-gate.md), [phone checks](records/2026-11-03-phone-a11y-check.md); the rest, ranked, in [the kit review](reference/kit-review.md) |
| Everyday features from open-source ideas: Get started on Home, saved views, bulk actions, notifications, optional extras | **done** 2026-11-03: [get started](records/2026-11-03-get-started.md), [saved views](records/2026-11-03-saved-views.md), [bulk actions](records/2026-11-03-bulk-actions.md), [notifications](records/2026-11-03-notifications.md), [extras](records/2026-11-03-optional-extras.md) |
| Look 2: every notice in the corner, smaller buttons under a mouse, the role matrix, 24 colour sets and 7 backgrounds each person picks | **done** 2026-11-03: [look 2](records/2026-11-03-look-2.md), [role matrix](records/2026-11-03-role-matrix.md), [looks](records/2026-11-03-looks.md) |
| The feature plan's first batch, safer and calmer: sign-in alerts and unusual sign-ins, Signed in today, file kinds and room, passcodes on links, the jobs' last day, What changed, read and unread, Service status | **done** 2026-11-21: [the record](records/2026-11-21-safer-and-calmer.md); batches 2 to 4 of the plan wait for the owner's yes |
| A fuller audit log: from where on every row, To what by name, from → to, Needs you for whoever looks after access | **done** 2026-11-22: [the record](records/2026-11-22-audit-log-fuller.md) |
| Apps: chat alerts to Slack, Teams, Discord and Google Chat, a calendar link, live spreadsheet links, Make, Zapier and n8n, with the services' logos | **done** 2026-11-22: [the record](records/2026-11-22-connect-apps.md); one-click sign-in for Slack and Discord next |
| A lighter database and a health watch: records kept to an age, the audit log's older days in the bucket, email services and web addresses checked from Status | **done** 2026-11-22: [the record](records/2026-11-22-lighter-database.md); Connected data and the connect relay next |
| Starting setup and imports: Set up for your business in one press, customers imported from a spreadsheet, invitations from a file, the Monday summary (off at first) | **done** 2026-11-22: [the record](records/2026-11-22-starting-setup-and-imports.md) |
| Each section's own Settings tab: options and settings with the section they change, the Settings page kept to the company-wide; Users and access in four tabs and Settings | **done** 2026-11-22: [the record](records/2026-11-22-section-settings.md); permissions (batch 3) next |
| The portal's mail in each person's main inbox: a Gmail filter file, a contact card and a test on Notifications; sign-in notices, invitations and alerts point to it | **done** 2026-11-22: [the record](records/2026-11-22-main-inbox-step.md); each person takes the step once |
| Connected data: a client's own Turso, Neon, Supabase, Airtable and Upstash Redis read from the portal, and changed where a manager turns editing on | **started** 2026-11-22: read through the Data pages, with sign-in for Supabase and Airtable and an hourly check ([the README](../modules/data/README.md), its records from 2026-11-22, P386-P434); 2026-11-23 rows of Supabase, Neon and Turso changed, deleted (an Owner alone) and undone for 30 days ([the record](records/2026-11-23-connected-data-edits.md), P435-P442); 2026-11-23 questions in SQL on Neon and Turso ([record](records/2026-11-23-connected-data-questions.md), P443-P446); hidden and masked columns ([record](records/2026-11-23-connected-data-hidden-columns.md), P460-P462), the end of phase 3; 2026-11-24 a question's answer as a CSV download and every kept change reachable (P520-P522); saved questions and an ended sign-in shown as Signed out (P570-P573); 2026-11-25 the rows grid (P670-P672) and a Supabase project's users, storage and health (P680-P683), then with an access token its logs, functions, advisors, requests, backups and questions in SQL (P700-P704); Sign in with Supabase giving that token, renewed through the relay (P755-P756); a Neon or Turso database's usage with an optional API key (P757-P759); the database page remade so a phone shows the tables first (P761-P762); the tables as coloured cards by schema with a Supabase project's rows, sizes, row security and state (P817-P818); a Supabase project's Usage tab, its allowance against its plan (P819-P820); the rows view and a row's page remade, a card a column (P830-P832); Storage, Functions, Logs and Advisors as cards and figures, a bucket used in Files in one tap (P833-P836); a Settings tab with the services' health, sign-in, SSL, who may connect and the extensions (P837-P838); Neon's branches as cards and a Turso account's use against its plan (P839-P840); 2026-11-26 an Upstash Redis database's Usage tab with an optional account email and API key (P886-P888) |
| Permissions anyone can follow: levels, one page per person, rank, names and Policy JSON (batch 3 of the access review) | **done** 2026-11-22: [the record](records/2026-11-22-permissions.md); first run, Home and Access requests in Needs you (batch 4) next |
| First run and Home: which of these do you use, Same access as when inviting, every Home line to the exact tab (batch 4 of the design anyone can follow) | **done** 2026-11-22: [the record](records/2026-11-22-first-run-and-home.md); the page-by-page audit next, with every empty list's sentence and button |
| Email settings in reach, Compose like Gmail, Inherit/Allow/Deny fixed, permission names on every row, the role page in three tabs (the owner's review of the live portal) | **done** 2026-11-22: [the record](records/2026-11-22-email-settings-compose-role-editor.md); the page-by-page audit next |
| The access pages checked against the locked layout (24 November) | **done** 2026-11-24: [the record](records/2026-11-24-access-pages-review.md); the gaps it found and what to build next are in the record |
| A locked page layout, the user page remade, editable Policy JSON, the line under the portal's name (the owner's review of 23 November) | **done** 2026-11-23: [the record](records/2026-11-23-locked-layout-user-page-policy-editor.md); the page-by-page audit next |
| Report a sign-in that was not you: one press on My access ends every sign-in and raises a critical alert for whoever looks after access; the sign-in alert points to it | **done** 2026-11-24: [the record](records/2026-11-24-report-a-sign-in.md) |
| Sign-in alerts on for everyone (the owner's pick): on from the start, and switched on where they were off only by default | **done** 2026-11-24: [the record](records/2026-11-24-sign-in-alerts-on.md) |
| A sign-in used from another country or browser: the person emailed, an alert for whoever looks after access; sign-in emails in local time | **done** 2026-11-25: [the record](records/2026-11-25-sign-in-used-elsewhere.md) |
| Your sign-ins and Sessions show where else a sign-in was used; Sign out on one browser from My access | **done** 2026-11-25: [the record](records/2026-11-25-sign-in-used-elsewhere.md) |

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

The kit is in **phase 6, release pipeline and upgrade**, with the first features for any business
built beside it. Each phase's parts and their state are on [the status page](status.md); what
comes next, and why it sells, is in [the roadmap](roadmap.md). A person or an agent new to the
repository reads [the architecture guide](architecture.md) after ai.md.

## The plan

The plan, its research and the owner's decisions are kept in the first client's documentation
and published on the public docs mirror:
[the platform-kit folder on the mirror](https://github.com/Harshil8136/chess-game1/tree/main/synced-docs/cf-admin/documentation/program/platform-kit).
Its plan document is the authority on the design; this repository follows it and records here
what was built.

## Where these documents are published

On every push to `main` the verify workflow's `mirror-docs` job runs the identifiers gate, then
copies this folder, the root `.md` files, every package, module and template README and
LICENSE to the public docs mirror, under
[synced-docs/oltrem-admin](https://github.com/Harshil8136/chess-game1/tree/main/synced-docs/oltrem-admin),
with a provenance file. Nothing is redacted: the gate is the scanner,
and everything here is written as if public (R-04). It signs in with `PERSONAL_PAT`
([registry](reference/tokens.md)).

## Index

| Document | Owns | Kind |
|---|---|---|
| [Where things stand](status.md) | each phase's parts, their state and the record of each | living |
| [Roadmap](roadmap.md) | what buyers pay for, the editions, each module's state, what comes next and why | living |
| [Architecture guide](architecture.md) | the parts on one page, how a request and a job travel, what a module is, the numbers taken, where a change goes | living |
| [ai.md](../ai.md) | the session-start procedure, the rules in one line each, the commands, what to read and what to update | written |
| [rules.md](../rules.md) | every rule in full: reason, scope and enforcement | written |
| [The licence in plain words](licence.md) | what the Oltrem Licence allows, what needs permission, and how to ask | written |
| [Versions and release notes](release.md) | how packages are versioned and how a change's note is written | living |
| [Verification log](verification-log.md) | one row per change: what was checked before the push and what was not | living |
| [Token registry](reference/tokens.md) | every credential by name, its scopes, where it is stored and why it exists | generated from `tokens.registry.json` |
| [What verify runs](reference/verify.md) | the gates, their order and what each refuses | generated from `scripts/lib/gates.mjs` |
| [Dependencies](reference/dependencies.md) | every third-party package, its one pinned version, who uses it and why | generated from `dependencies.registry.json` and the catalog |
| [@oltrem/core-config](../packages/core-config/README.md) | the four configuration layers, the settings registry, the read path and the storage the package owns | written, beside the code |
| [@oltrem/cli](../packages/cli/README.md) | the `oltrem` tool: the manifest check and format, `new module`, `deploy`, the restore drill, the run report, the doctor's checks, exit codes | written, beside the code |
| [@oltrem/core-errors](../packages/core-errors/README.md) | how an error is defined, the code blocks, and the problem document every failure answers with | written, beside the code |
| [@oltrem/core-module](../packages/core-module/README.md) | the module contract: routes, capabilities, schemas, event types, jobs, flows, health checks, migrations, settings, errors, what it refuses | written, beside the code |
| [@oltrem/core-http](../packages/core-http/README.md) | the request pipeline, the same-origin rule, the identity headers and the token's claims, the startup hook, the session hook, the three Worker handlers | written, beside the code |
| [@oltrem/core-outbox](../packages/core-outbox/README.md) | the outbox: how a row moves, the backoff ladder, replay, and the table it owns | written, beside the code |
| [@oltrem/core-audit](../packages/core-audit/README.md) | the audit log: the fields and their rules, hashing and verify; the module with its page's routes, the export and the daily seal | written, beside the code |
| [@oltrem/core-jobs](../packages/core-jobs/README.md) | the one tick: how a job is declared, how it is leased, run and recorded, and the table it owns; the one Workflow: how a flow is started and run step by step | written, beside the code |
| [@oltrem/core-health](../packages/core-health/README.md) | system health: how a module declares its checks, how the health job runs them on the tick and opens a problem after two failures in a row, and the table it owns | written, beside the code |
| [@oltrem/core-crypto](../packages/core-crypto/README.md) | envelope encryption for stored credentials: the one key-encryption key, a data key per tenant, each value sealed to its row, and how the key rotates under one secret name | written, beside the code |
| [@oltrem/core-ui](../packages/core-ui/README.md) | the token list, the brand variables, light and dark, every primitive with the rule it keeps, and the three widgets | written, beside the code |
| [@oltrem/iam](../modules/iam/README.md) | the permission model: capabilities, roles, scopes, groups, bindings, overrides, the compiled map, the check and its reasons, sessions, the authorizer, governance and approvals, the Vendor and the handover, "see it as", tables, errors | written, beside the code |
| [@oltrem/users](../modules/users/README.md) | the people: the directory and the profile, the rules of switching an account off and on, the routes, the table and the error codes | written, beside the code |
| [@oltrem/records](../modules/records/README.md) | the company's own lists: places and the four capabilities, the kinds of field, search, the CSV, routes, tables, errors | written, beside the code |
| [@oltrem/files](../modules/files/README.md) | the company's files: a drive per place opened by the roles held there, folders and names, uploads, links that end, the trash, the pages, routes, tables, settings, errors | written, beside the code |
| [@oltrem/automations](../modules/automations/README.md) | automations: an event or a schedule, one action, how the tick runs them within its budget, the kit's two actions and how a client adds one, the pages, routes, tables, errors | written, beside the code |
| [@oltrem/analytics](../modules/analytics/README.md) | analytics: the audit log counted by day in SQL, the figures against the period before, the charts, the CSV, the route and the tables | written, beside the code |
| [@oltrem/privacy](../modules/privacy/README.md) | privacy requests: the due day and its setting, the search through every module's `personal` and the audit log, the identity check, the copy, the routes and the table | written, beside the code |
| [@oltrem/tasks](../modules/tasks/README.md) | tasks: who sees, gives and does them at a place, the email when given, the automations' task, the routes and the table | written, beside the code |
| [@oltrem/approvals](../modules/approvals/README.md) | approvals: who asks and who answers at a place, never one's own, the email with the answer, the routes and the table | written, beside the code |
| [@oltrem/campaigns](../modules/campaigns/README.md) | bulk email: a list from a CSV file, merge fields, a test, chunks within a daily limit, one-click unsubscribe, the suppression list, the pages, routes, tables, settings, errors | written, beside the code |
| [@oltrem/developer](../modules/developer/README.md) | developer tools: the jobs page with run soon and pause, outgoing webhooks fed by the audit log with their signing, retries and delivery log, the API reference, the pages, routes, tables, errors | written, beside the code |
| [@oltrem/providers](../modules/providers/README.md) | providers as data: the definition contract and the kit's seven email definitions, instances with their sealed credentials, the failover order, the routes, the tables and the error codes | written, beside the code |
| [@oltrem/email](../modules/email/README.md) | email as the kit sends it: typed templates and the escaping `html` tag, sending through the outbox, the lease per message key, failover, the held messages, the canary and messages routes, the health check, the table and the error codes | written, beside the code |
| [@oltrem/backup](../modules/backup/README.md) | backups as the kit makes them: the export flow step by step, one export at a time, the routes, the freshness and drill checks, the restore drill, the settings and secrets, how to open a copy, the table and the error codes | written, beside the code |
| [@oltrem/github](../modules/github/README.md) | the repository as the portal sees it: the run report the deploy workflow writes, the status and runs routes, the deploy check, the table | written, beside the code |
| [@oltrem/alerts](../modules/alerts/README.md) | platform alerts: raised once per key, the quiet hours, what became of the email, the settings, the routes, the table | written, beside the code |
| [@oltrem/screens](../packages/screens/README.md) | the portal's screens: the frame and its row, each page and the API it reads, the first run, the stylesheet | written, beside the code |
| [The client template](../templates/client/README.md) | what a client repository is made of: the client file, the manifest, the kit's migrations, the one workflow, the two secret names | written, beside the code |
| [The module template](../templates/module/README.md) | the `sample-notes` module `oltrem new module` copies into a client repository, written as the how-to the client keeps: its parts, what to change, what is not there yet | written, beside the code; copied by the generator |

The records, each dated and frozen once written, with its decisions and how it was verified:

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
| [Phase 2: governance](records/2026-10-20-iam-governance.md) | who may change access, and the second person |
| [Phase 2: the Vendor and the handover](records/2026-10-20-iam-vendor-and-handover.md) | the one company, its first Owner, the handover |
| [Phase 2: the routes](records/2026-10-20-iam-routes.md) | the IAM module's JSON routes |
| [Phase 2: the users module](records/2026-10-21-users-module.md) | the second module: the directory and the profile, the switch and its rules, how a module stands on the IAM module |
| [Phase 2 in the client template](records/2026-10-21-template-mounts-iam.md) | the template's Worker runs IAM and users; the Access audience secret |
| [The Vendor's address](records/2026-10-21-vendor-address.md) | the command that writes the Vendor's address after the first deploy, why it is in no file |
| [Phase 3: capabilities on the manifest](records/2026-10-21-module-capabilities.md) | how a module declares what its routes check, how the Worker registers it at its start and keeps the check current |
| [Phase 3: jobs and the tick](records/2026-10-21-jobs-and-the-tick.md) | how a module declares its periodic work, how the one tick runs it under a lease and records it |
| [Phase 3: health and the manifest's last data fields](records/2026-10-21-health-and-manifest-fields.md) | how a module declares its health checks, migrations, settings and errors, how the health job runs them and opens a problem |
| [Phase 3: the module generator](records/2026-10-21-the-module-generator.md) | how `oltrem new module` writes a module |
| [Phase 3: the generated references](records/2026-10-21-generated-references.md) | how a client's reference reads its modules by importing them in Node, what the Modules page shows |
| [Phase 3: the capability version gate](records/2026-10-21-capability-version-gate.md) | why a module's version must move with its capabilities, how `oltrem docs` refuses a change made under the same version |
| [Phase 4: envelope encryption](records/2026-10-21-envelope-encryption.md) | how a stored credential is sealed and its key rotated |
| [Phase 4: providers as data](records/2026-10-21-providers-as-data.md) | a provider as a definition, never an adapter; the seven email definitions; an instance's sealed key and failover place |
| [Phase 4: the email adapters](records/2026-10-21-email-adapters.md) | how one HTTP adapter and one SMTP client send through every email definition, the auth schemes, the probe route |
| [Phase 4: the webhook verifiers](records/2026-10-21-webhook-verifiers.md) | how a provider's delivery report is checked by its own signature scheme and becomes the kit's delivery events |
| [Phase 4: provider detection](records/2026-10-21-provider-detection.md) | how a domain's public DNS suggests the providers it already uses, why a suggestion never sends by itself |
| [Phase 4: the email module](records/2026-10-21-email-module.md) | how a message is checked, held while no provider is ready, and sent once through the active instance or a failover |
| [Phase 4: the delivery reports' address](records/2026-10-21-delivery-reports.md) | why one public path skips the door, how a report is checked |
| [Phase 4: key recipes](records/2026-10-21-key-recipes.md) | how a module declares the Worker secrets it needs, the KEK's recipe, the Key recipes page, the check |
| [Phase 5: the age format](records/2026-10-21-age-format.md) | how a backup copy is locked in the standard age format with no package, why the private key never reaches the Worker |
| [Phase 5: the backup module](records/2026-10-21-backup-module.md) | how the nightly copy is asked of Cloudflare, encrypted on its way into the bucket and recorded, the one Workflow that runs it step by step |
| [Phase 5: the restore drill](records/2026-10-21-restore-drill.md) | how the newest backup is proven to open and load |
| [Phase 5: the GitHub module](records/2026-10-21-github-module.md) | how the portal learns its kit version, a newer release and its last deploy without a GitHub token |
| [Phase 5: the free plan's budgets](records/2026-10-21-free-plan-budgets.md) | what System health measures against the free plan, how the jobs pause, the token widened |
| [Phase 4 in the client template](records/2026-10-21-template-mounts-email.md) | the template's providers and email, the sending address |
| [Phase 5 in the client template](records/2026-10-21-template-mounts-backup.md) | the template's backup, deploy report and budgets, the Workflow and its schedules, the runtime stand-in for Node |
| [Phase 5: the backup's setup](records/2026-10-21-backup-setup.md) | the backup's settings and bucket rules, set once after the first deploy |
| [Phase 5: the Actions minutes](records/2026-10-21-actions-minutes.md) | how `oltrem doctor` reads the month's GitHub Actions minutes |
| [Working on Windows](records/2026-10-21-windows.md) | why `npm install` cannot install the kit, the Windows fixes, the line endings |
| [Working on Windows: the second run and pnpm dev](records/2026-10-21-windows-second-run.md) | the second Windows run's fixes, what `pnpm dev` shows |
| [Phase 6: oltrem upgrade](records/2026-10-21-oltrem-upgrade.md) | what an upgrade checks before it writes |
| [Verification log, 19 and 20 October](records/2026-10-19-to-20-verification-log.md) | the log's first rows, moved there unchanged |
| [Verification log, 21 October](records/2026-10-21-verification-log.md) | its first rows, moved |
| [Verification log, 21 to 24 October](records/2026-10-21-to-24-verification-log.md) | the rest of 21 October and 22 to 24 October, moved |
| [The screens and two commands](records/2026-10-21-screens-and-npm.md) | `npm install`, `npm run dev`, the local sign-in, why the Worker renders the screens |
| [The screens that change things](records/2026-10-21-people-and-access-screens.md) | the forms for people, roles, places, email providers and settings, and how a form travels |
| [Phase 3: alerts](records/2026-10-21-alerts.md) | how a lasting problem is emailed once, held in the quiet hours, acknowledged and resolved |
| [Phase 3: Home widgets](records/2026-10-21-home-widgets.md) | how each module gives Home one card, and who sees it |
| [Audit page and seal](records/2026-10-21-audit-seal-and-export.md) | the log read, exported, sealed nightly |
| [See it as](records/2026-10-21-see-it-as.md) | one person's access shown, read only |
| [One command deploy](records/2026-10-21-one-command-deploy.md) | `npm run deploy` |
| [Deploy, first run](records/2026-10-21-deploy-first-run.md) | fixes |
| [Deploy screen](records/2026-10-21-deploy-screen.md) | questions explained |
| [Door, nothing copied](records/2026-10-21-door-without-copying.md) | Access on the Worker |
| [Portal frame](records/2026-10-22-portal-frame.md) | sidebar, theme, sign-in email |
| [Every page, phone menu](records/2026-10-22-every-page-and-phone-menu.md) | tiles, filters, drawer |
| [Your own records](records/2026-10-22-your-own-records.md) | lists, fields, permissions by place |
| [Forms and inbox](records/2026-10-22-forms-and-inbox.md) | website forms, inbox, replies |
| [Phase 6: versions and release notes](records/2026-10-21-changesets.md) | why Changesets, the version groups, what publishing still needs |
| [Client code checks](records/2026-10-24-client-code-checks.md), [two](records/2026-10-24-client-code-checks-part-two.md) | kit files, modules, packages, keys, size |
| [Automatic release](records/2026-10-24-automatic-release.md) | restore point, health, step back |
| [Operations menu](records/2026-10-24-operations-menu.md) | five jobs, no command line |
| [Actions minutes](records/2026-10-25-actions-minutes.md) | verify off push |
| [Automatic audit](records/2026-10-27-automatic-audit.md) | every change recorded by the pipeline, the audit page's filters |
| [Module pages](records/2026-10-27-module-pages.md) | a module brings its own pages and sidebar sections |
| [Portal makeover](records/2026-10-27-portal-makeover.md) | the new look, page-to-page motion, pages fetched ahead |
| [Files module](records/2026-10-27-files-module.md) | a drive per place opened by the roles there, links that end, the trash |
| [Campaigns module](records/2026-10-27-campaigns-module.md) | bulk email from a CSV file in chunks, one-click unsubscribe, suppression |
| [Developer module](records/2026-10-27-developer-module.md) | the jobs page, signed webhooks from the audit log, the API reference |
| [Automations module](records/2026-10-27-automations-module.md) | when something happens or on a schedule, an email or an alert; website answers audited |
| [Analytics module](records/2026-10-27-analytics-module.md) | the portal's activity by day, area and action, from the audit log, in charts and a CSV |
| [Access screens](records/2026-10-27-access-screens.md) | My access, requests and approvals, access reviews on the phone; expiry emails and the review check |
| [Needs you](records/2026-10-27-needs-you.md) | Home opens with what waits for the person signed in, from each module |
| [Privacy module](records/2026-10-27-privacy-module.md) | privacy requests answered on time: one search for a person's data across the portal, a copy once their identity is checked |
| [Tasks module](records/2026-10-27-tasks-module.md) | work given to people at a place, by a day, on Home and by email; automations make them too |
| [Approvals module](records/2026-10-27-approvals-module.md) | ask for a yes at a place; whoever decides there answers, never their own, a no with its reason |
| [Generated module pages](records/2026-10-27-module-generator-pages.md) | a client's new module has its own permissions and a page in the sidebar from its first deploy |

## How this folder is checked

`pnpm docs:check`, one of the gates of `pnpm verify`, refuses a document without front matter,
a document missing from the tables above, a document over its size budget, a relative link that
points nowhere, and a generated document that differs from its source. Records are frozen: a
later change is a new record, not an edit.

## How to read this on a phone

Every document opens with a short summary in plain words. Tables are kept narrow.

## Verification log

What was checked before each push, and what was not, is one row per change in
[the verification log](verification-log.md); a change adds its row there in the same commit.

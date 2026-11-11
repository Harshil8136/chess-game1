---
title: "Documentation index, and where things stand"
status: living
owner: vendor
last_verified: 2026-11-03
sources: [this repository]
---

# Documentation: index and where things stand

> **In plain words.** This folder is the written side of the kit, kept so the owner can follow
> the work on a phone. This page says where the work stands, lists every document and the fact
> each one owns. The plan the work follows lives elsewhere and is
> linked below.

## Where things stand

The kit is in **phase 6, release pipeline and upgrade**, with the first features for any business
built beside it. Each phase's parts and their state are on [the status page](status.md); what
comes next, and why it sells, is in [the roadmap](roadmap.md). A person or an agent new to the
repository reads [the architecture guide](architecture.md) after ai.md. Every Oltrem product
(the Portal, Mail, the shared Server, and later the Console and the Website), its modules and the
five phases of work across them are in [the product plan](product-plan.md); what keeps the kit
at "fine" rather than "best", and the order of fixes, is in [the kit review](reference/kit-review.md).

## The plan

The plan, its research and the owner's decisions are kept in the first client's documentation
and published on the public docs mirror:
[the platform-kit folder on the mirror](https://github.com/Harshil8136/chess-game1/tree/main/synced-docs/cf-admin/documentation/program/platform-kit).
Its plan document is the authority on the design.

## Where these documents are published

On every push to `main` the verify workflow's `mirror-docs` job runs the identifiers gate, then
copies this folder, the root `.md` files, each package, module and template README and LICENSE
to [synced-docs/oltrem-admin](https://github.com/Harshil8136/chess-game1/tree/main/synced-docs/oltrem-admin)
on the docs mirror, and every Oltrem Mail document (`vendor/mail/published/`, in each
pack) to `synced-docs/oltrem-mail`, each with a provenance file. Nothing is redacted: the gate
is the scanner, and all of it is written as if public (R-04). It signs in with
`PERSONAL_PAT` ([registry](reference/tokens.md)).

## Index

| Document | Owns | Kind |
|---|---|---|
| [Where things stand](status.md) | each phase's parts, their state and the record of each | living |
| [Product plan](product-plan.md) | the product line, the products, their modules, the five phases across them and the owner's open decisions | proposed |
| [Roadmap](roadmap.md) | what buyers pay for, the editions, module states, what comes next | living |
| [Architecture guide](architecture.md) | the parts, how a request and a job travel, what a module is, the numbers taken, where a change goes | living |
| [ai.md](../ai.md) | the session-start procedure, the rules in one line each, the commands, what to read and what to update | written |
| [rules.md](../rules.md) | every rule in full: reason, scope and enforcement | written |
| [The licence in plain words](licence.md) | what the Oltrem Licence allows, what needs permission, and how to ask | written |
| [Versions and release notes](release.md) | how packages are versioned and how a change's note is written | living |
| [The fleet](reference/fleet.md) | every push to the kit updates every client's portal: how, the one-time setup, the key | living |
| [Verification log](verification-log.md) | one row per change: what was checked before the push and what was not | living |
| [Phone tests owed](phone-tests.md) | every phone test still owed, by page, with what to see; passed and failed ones | living |
| [Phone tests owed: Email and Mail](phone-tests-email.md) | the phone tests owed on the Email pages and the Mail setup, split from the list above | living |
| [Token registry](reference/tokens.md) | every credential by name, its scopes, where it is stored and why it exists | generated from `tokens.registry.json` |
| [What verify runs](reference/verify.md) | the gates, their order and what each refuses | generated from `scripts/lib/gates.mjs` |
| [Open-source ideas](reference/open-source-ideas.md) | 30 ranked open-source ideas | proposed |
| [Browser caching](reference/browser-caching.md) | browser storage, versioned reads, instant updates | proposed |
| [Private mail Worker](reference/private-mail-worker.md) | Mailflare, Cloudflare email, a mail Worker | proposed |
| [Mail projects](reference/mail-projects.md) | 35 projects compared; a mail repo | proposed |
| [Kit review](reference/kit-review.md) | what keeps the kit at fine rather than best: the findings of 2026-11-03, their evidence and the order of fixes | proposed |
| [The shared server](reference/shared-server.md) | one vendor server, a key and limit per client | proposed |
| [Adding a module to the kit](reference/kit-module.md) | the steps, files, numbers, mounting, tests and documents of a new kit module | living |
| [Dependencies](reference/dependencies.md) | every third-party package, its pinned version, who uses it, why | generated from `dependencies.registry.json` and the catalog |
| [@oltrem/core-config](../packages/core-config/README.md) | the four configuration layers, the settings registry, the read path and the storage the package owns | written, beside the code |
| [@oltrem/cli](../packages/cli/README.md) | the `oltrem` tool: the manifest check and format, `new module`, `deploy`, the restore drill, the run report, the doctor's checks, exit codes | written, beside the code |
| [@oltrem/core-errors](../packages/core-errors/README.md) | how an error is defined, the code blocks, and the problem document every failure answers with | written, beside the code |
| [@oltrem/core-module](../packages/core-module/README.md) | the module contract: routes, capabilities, schemas, event types, jobs, flows, health checks, migrations, settings, errors, what it refuses | written, beside the code |
| [@oltrem/core-http](../packages/core-http/README.md) | the request pipeline, the same-origin rule, the identity headers and the token's claims, the startup hook, the session hook, the three Worker handlers | written, beside the code |
| [@oltrem/core-outbox](../packages/core-outbox/README.md) | the outbox: how a row moves, the backoff ladder, replay, and the table it owns | written, beside the code |
| [@oltrem/core-audit](../packages/core-audit/README.md) | the audit log: the fields and their rules, hashing and verify; the module with its page's routes, the export and the daily seal | written, beside the code |
| [@oltrem/core-jobs](../packages/core-jobs/README.md) | the one tick: how a job is declared, how it is leased, run and recorded, and the table it owns; the one Workflow: how a flow is started and run step by step | written, beside the code |
| [@oltrem/core-health](../packages/core-health/README.md) | system health: how a module declares its checks, how the tick runs them and opens a problem after two failures, and the table it owns | written, beside the code |
| [@oltrem/core-crypto](../packages/core-crypto/README.md) | envelope encryption for stored credentials: the one key-encryption key, a data key per tenant, each value sealed to its row, key rotation | written, beside the code |
| [@oltrem/core-ui](../packages/core-ui/README.md) | the token list, the brand variables, light and dark, every primitive with the rule it keeps, and the three widgets | written, beside the code |
| [@oltrem/iam](../modules/iam/README.md) | the permission model: capabilities, roles, scopes, groups, bindings, overrides, the check, sessions, governance, the Vendor and the handover, the door, tables, errors | written, beside the code |
| [@oltrem/users](../modules/users/README.md) | the people: the directory and the profile, the rules of switching an account off and on, the routes, the table and the error codes | written, beside the code |
| [@oltrem/records](../modules/records/README.md) | the company's own lists: places and the four capabilities, the kinds of field, search, the CSV, routes, tables, errors | written, beside the code |
| [@oltrem/files](../modules/files/README.md) | the company's files: a drive per place opened by the roles held there, folders, uploads, links that end, the trash, pages, routes, tables, settings, errors | written, beside the code |
| [@oltrem/automations](../modules/automations/README.md) | automations: an event or a schedule, one action, run within the tick's budget, the kit's two actions and how to add one, the pages, routes, tables, errors | written, beside the code |
| [@oltrem/analytics](../modules/analytics/README.md) | analytics: the audit log counted by day in SQL, the figures against the period before, the charts, the CSV, the route and the tables | written, beside the code |
| [@oltrem/privacy](../modules/privacy/README.md) | privacy requests: the due day and its setting, the search through every module's `personal` and the audit log, the identity check, the copy, routes, table | written, beside the code |
| [@oltrem/tasks](../modules/tasks/README.md) | tasks: who sees, gives and does them at a place, the email when given, the automations' task, the routes and the table | written, beside the code |
| [@oltrem/announcements](../modules/announcements/README.md) | announcements: who posts and who reads at a place, read and confirmed, who has read what, the routes and the tables | written, beside the code |
| [@oltrem/bookings](../modules/bookings/README.md) | bookings: who books and who manages at a place, the company's clock, never twice at once, cancelling and removing, the routes and the tables | written, beside the code |
| [@oltrem/timeoff](../modules/timeoff/README.md) | time off: who asks and who answers at a place, never one's own, vacation days a year, the reason kept private, the routes and the table | written, beside the code |
| [@oltrem/expenses](../modules/expenses/README.md) | expense claims: who claims and who answers and pays at a place, never one's own, the month's CSV, the routes and the table | written, beside the code |
| [@oltrem/assets](../modules/assets/README.md) | equipment: who sees and manages it at a place, one tag one item, handed over with every move kept, retired when nobody holds it, the routes and the tables | written, beside the code |
| [@oltrem/customers](../modules/customers/README.md) | customers: the door at /account past Access, the email code, OpenID Connect, who manages customers, the routes and the tables | written, beside the code |
| [@oltrem/quotes](../modules/quotes/README.md) | quotes: who sees and who makes them at a place, drafts until sent, lines and total in the company's currency, the customer's answer once, the routes and the table | written, beside the code |
| [@oltrem/invoices](../modules/invoices/README.md) | invoices: who sees and who makes them at a place, drafts until sent, from an accepted quote, paid once, overdue in Needs you, voided, the routes and the table | written, beside the code |
| [@oltrem/shifts](../modules/shifts/README.md) | shifts: who plans and who sees at a place, drafts until published, an email each, open shifts taken once, one shift at a time a person, the routes and the table | written, beside the code |
| [@oltrem/timeclock](../modules/timeclock/README.md) | time clock: who clocks in and who manages at a place, the payroll CSV, the routes and the table | written, beside the code |
| [@oltrem/approvals](../modules/approvals/README.md) | approvals: who asks and who answers at a place, never one's own, the email with the answer, the routes and the table | written, beside the code |
| [@oltrem/developer](../modules/developer/README.md) | developer tools: the jobs page with run soon and pause, outgoing webhooks, signed and retried, the API reference, the pages, routes, tables, errors | written, beside the code |
| [@oltrem/providers](../modules/providers/README.md) | providers as data: the definition contract, the email definitions, sealed credentials, the failover order, the routes, the tables and the error codes | written, beside the code |
| [@oltrem/email, campaigns and mail](../vendor/mail/README.md) | email, bulk mail and the Oltrem Mail add-on, from oltrem-mail, kept here packed; their READMEs are inside | packed copy |
| [@oltrem/backup](../modules/backup/README.md) | backups as the kit makes them: the export flow, one at a time, the routes, checks, settings, secrets, errors | written, beside the code |
| [@oltrem/github](../modules/github/README.md) | the repository as the portal sees it: the run report the deploy workflow writes, the status and runs routes, the deploy check, the table | written, beside the code |
| [@oltrem/alerts](../modules/alerts/README.md) | platform alerts: raised once per key, the quiet hours, what became of the email, the settings, the routes, the table | written, beside the code |
| [@oltrem/screens](../packages/screens/README.md) | the portal's screens: the frame and its row, each page and the API it reads, the first run, the stylesheet | written, beside the code |
| [The client template](../templates/client/README.md) | what a client repository is made of: the client file, the manifest, the kit's migrations, the one workflow, the two secret names | written, beside the code |
| [The module template](../templates/module/README.md) | the `sample-notes` module `oltrem new module` copies, written as the client's how-to | written, beside the code; copied by the generator |

The records, each dated and frozen once written, with what changed and how it was verified, are
listed in [the records index](records/README.md).

## How this folder is checked

`pnpm docs:check`, one of the gates of `pnpm verify`, refuses a document without front matter,
a document missing from the tables above (a record: missing from [the records index](records/README.md)), a document over its size budget, a relative link that
points nowhere, and a generated document that differs from its source. Records are frozen: a
later change is a new record, not an edit.

## How to read this on a phone

Every document opens with a short summary in plain words. Tables are kept narrow.

## Verification log

What was checked before each push, and what was not, is one row per change in
[the verification log](verification-log.md); a change adds its row there in the same commit.

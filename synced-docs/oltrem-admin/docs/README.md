---
title: "Documentation index, and where things stand"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [this repository]
---

# Documentation: index and where things stand

> **In plain words.** The written side of the kit, kept so the owner can follow the work on a
> phone: where the work stands, every document and the fact each one owns.

## Where things stand

The kit is in **phase 6, release pipeline and upgrade**, with the first features for any business
built beside it. What waits is on [the status page](status.md); what comes next, in
[the roadmap](roadmap.md). Someone new reads [the architecture guide](architecture.md) after ai.md.
Decided or built proposals are frozen in [archive/proposals](../archive/proposals/README.md); the
records (dated, frozen) are kept out of this folder so no agent loads them for a task:
[the records index](../archive/records/README.md).

The plan, its research and the owner's decisions live in the first client's documentation, on
[the public docs mirror](https://github.com/Harshil8136/chess-game1/tree/main/synced-docs/cf-admin/documentation/program/platform-kit);
its plan document is the authority on the design.

**Published.** On every push to `main`, the verify workflow's `mirror-docs` job runs the
identifiers gate, then copies this folder, `archive/`, the root `.md` files, every package, module
and template README and LICENSE to
[synced-docs/oltrem-admin](https://github.com/Harshil8136/chess-game1/tree/main/synced-docs/oltrem-admin),
and Oltrem Mail's documents (`vendor/mail/published/`) to `synced-docs/oltrem-mail`, each with a
provenance file, signing in with `PERSONAL_PAT` ([registry](reference/tokens.md)). Nothing is
redacted: all of it is written as if public (R-04).

## Index

| Document | Owns |
|---|---|
| [ai.md](../ai.md), [rules.md](../rules.md) | The session start, the rules in one line each, the commands; every rule in full |
| [Where things stand](status.md) | The parts still waiting, and on whom |
| [Roadmap](roadmap.md) | What buyers pay for, the editions, what is started or later |
| [Architecture guide](architecture.md) | The parts, how a request and a job travel, what a module is, the numbers taken |
| [The licence in plain words](licence.md) | What the Oltrem Licence allows and how to ask for more |
| [Versions and release notes](release.md) | Versioning and how a change's note is written |
| [The fleet](reference/fleet.md) | How every kit push updates every client's portal |
| [How documents are written and sized](reference/doc-policy.md) | The caps, the budget and its allowances, the shape of a document and a record |
| [Adding a module to the kit](reference/kit-module.md) | Steps, files, numbers, mounting, tests and documents of a new module |
| [Token registry](reference/tokens.md) | Every credential by name (generated from `tokens.registry.json`) |
| [What verify runs](reference/verify.md) | The gates and what each refuses (generated from `scripts/lib/gates.mjs`) |
| [Dependencies](reference/dependencies.md) | Every third-party package and why (generated from `dependencies.registry.json`) |

**Phone tests owed**, by page, with what to see: [the main list](phone-tests.md),
[Email and Mail](phone-tests-email.md), [Users and access](phone-tests-users.md),
[Connected data](phone-tests-data.md), [Apps](phone-tests-apps.md),
[Home and the frame](phone-tests-frame.md), [Files](phone-tests-files.md),
[Reports](phone-tests-reports.md), [Backups and Status](phone-tests-system.md), and
[the flows fixed on 15 November](phone-tests-flows.md).

**Packages**, each README beside its code: [core-module](../packages/core-module/README.md) (the
module contract), [core-http](../packages/core-http/README.md) (the pipeline),
[core-config](../packages/core-config/README.md) (settings, parts),
[core-errors](../packages/core-errors/README.md), [core-outbox](../packages/core-outbox/README.md),
[core-audit](../packages/core-audit/README.md), [core-jobs](../packages/core-jobs/README.md) (the
tick, the Workflow), [core-health](../packages/core-health/README.md),
[core-crypto](../packages/core-crypto/README.md), [core-ui](../packages/core-ui/README.md) (tokens,
primitives), [screens](../packages/screens/README.md) (the frame and pages),
[cli](../packages/cli/README.md) (the `oltrem` tool), [relay](../packages/relay/README.md) (one-click
sign-in).

**Modules**: Core [iam](../modules/iam/README.md) (the permission model),
[users](../modules/users/README.md), [privacy](../modules/privacy/README.md),
[alerts](../modules/alerts/README.md), [jobs](../modules/jobs/README.md),
[backup](../modules/backup/README.md), [github](../modules/github/README.md); Work
[records](../modules/records/README.md), [forms](../modules/forms/README.md),
[files](../modules/files/README.md), [tasks](../modules/tasks/README.md),
[approvals](../modules/approvals/README.md), [announcements](../modules/announcements/README.md),
[bookings](../modules/bookings/README.md), [timeoff](../modules/timeoff/README.md),
[expenses](../modules/expenses/README.md), [assets](../modules/assets/README.md),
[timeclock](../modules/timeclock/README.md), [shifts](../modules/shifts/README.md),
[quotes](../modules/quotes/README.md), [invoices](../modules/invoices/README.md),
[customers](../modules/customers/README.md), [automations](../modules/automations/README.md),
[analytics](../modules/analytics/README.md), [connect](../modules/connect/README.md); Admin
[data](../modules/data/README.md); Messages [providers](../modules/providers/README.md) and Oltrem
Mail's [email, campaigns and mail](../vendor/mail/README.md) (a packed copy); Developer
[developer](../modules/developer/README.md).

**Templates**: [the client template](../templates/client/README.md) (a client repository) and
[the module template](../templates/module/README.md) (what `oltrem new module` copies).

`pnpm docs:check` holds every document to [the doc policy](reference/doc-policy.md). Every
document opens with a short summary in plain words, and tables are kept narrow.

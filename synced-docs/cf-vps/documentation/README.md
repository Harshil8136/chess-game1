---
title: "Documentation Index and Map"
status: active
audience: [non-technical, ai, technical]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_docs: [CONTRIBUTING-DOCS.md, ../README.md, ../main.md]
tags: [meta, index]
---

# cf-vps Documentation

> **TL;DR (non-technical):** This is the map of all cf-vps documentation. cf-vps is the
> private service that lets approved people look after the project's server from inside the
> admin portal. Each entry says what a document is for. Start with the architecture
> overview, then read what your task needs.

Single index for every document under `documentation/`. Conventions (folders, front-matter,
what is published) are in [`CONTRIBUTING-DOCS.md`](CONTRIBUTING-DOCS.md). A test fails if a
living document is missing from this index.

**Published or private.** Documents marked **P** are copied to the public docs mirror and
contain no identifiers. Everything else is private, so links to it do not resolve on the mirror.

## Start here

| If you want | Read |
|---|---|
| How the parts fit and where trust changes | [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md) **P** |
| Who can do what | [`security/PERMISSIONS.md`](security/PERMISSIONS.md) **P** |
| What is recorded and alerted | [`security/AUDIT-PIPELINE.md`](security/AUDIT-PIPELINE.md) **P** |
| What to resume, current state | [`program/HANDOFF.md`](program/HANDOFF.md) |
| How to ship a change | [`operations/DEPLOY.md`](operations/DEPLOY.md) **P** |
| What to do when it breaks | [`runbooks/README.md`](runbooks/README.md) |

## Architecture

| Doc | What it is |
|---|---|
| [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md) **P** | Components, request path, trust boundaries, data stores |

## Security

| Doc | What it is |
|---|---|
| [`security/PERMISSIONS.md`](security/PERMISSIONS.md) **P** | The capability catalog, roles, floors, per-person grants, fresh sign-in |
| [`security/AUDIT-PIPELINE.md`](security/AUDIT-PIPELINE.md) **P** | Sources, classes, local record, R2 copy, redaction, what reaches Sentry |

## Features

| Doc | What it is |
|---|---|
| [`features/CONSOLE.md`](features/CONSOLE.md) **P** | Every console page and the capability it needs |
| [`features/ACTIONS.md`](features/ACTIONS.md) **P** | The controlled actions and the four-layer enforcement chain |
| [`features/LOG-STORAGE.md`](features/LOG-STORAGE.md) **P** | Retention per kind, preview and delete, compression |

## Operations

| Doc | What it is |
|---|---|
| [`operations/DEPLOY.md`](operations/DEPLOY.md) **P** | How the Worker, agent and host modules deploy; order and rollback |
| [`operations/HOST-MODULES.md`](operations/HOST-MODULES.md) **P** | Every `host/NN-*` module and its steps |
| [`operations/OWNER-SETUP.md`](operations/OWNER-SETUP.md) | Steps only the owner can do (consoles, tokens, keys) |

## Reference

| Doc | What it is |
|---|---|
| [`reference/API-ROUTES.md`](reference/API-ROUTES.md) **P** | The agent route table with the capability for each route |
| [`reference/HOST-LAYOUT.md`](reference/HOST-LAYOUT.md) | Where everything lives on the server and in R2, and where something new goes |

## Program

| Doc | What it is |
|---|---|
| [`program/HANDOFF.md`](program/HANDOFF.md) | Current status by phase, what is open, what to do next |

## Runbooks

| Doc | What it is |
|---|---|
| [`runbooks/README.md`](runbooks/README.md) | Symptom to runbook table |
| [`runbooks/break-glass.md`](runbooks/break-glass.md) | SSH does not work |
| [`runbooks/disk-full.md`](runbooks/disk-full.md) | The audit disk or system disk is full and sudo refuses |
| [`runbooks/tunnel-down.md`](runbooks/tunnel-down.md) | The console says the agent did not answer |
| [`runbooks/restore-app-database.md`](runbooks/restore-app-database.md) | Restore an app database from the local or the encrypted off-box dump |
| [`runbooks/agent-rollback.md`](runbooks/agent-rollback.md) | A new agent release misbehaves |
| [`runbooks/audit-rule-change.md`](runbooks/audit-rule-change.md) | Changing audit rules after the lock |
| [`runbooks/compromise.md`](runbooks/compromise.md) | Suspected compromise |
| [`runbooks/rebuild.md`](runbooks/rebuild.md) | Rebuild the server |
| [`runbooks/key-rotation.md`](runbooks/key-rotation.md) | Replace a key or token |
| [`runbooks/ubuntu-26.04-upgrade.md`](runbooks/ubuntu-26.04-upgrade.md) | The Ubuntu 26.04 upgrade, with findings |

## Specs (dated design)

| Doc | What it is | Status |
|---|---|---|
| [`specs/2026-09-29-cf-vps-design.md`](specs/2026-09-29-cf-vps-design.md) | The plan of record: architecture, phases P0 to P7, capabilities | active |
| [`specs/2026-09-30-log-storage-design.md`](specs/2026-09-30-log-storage-design.md) | Log storage design; shipped, summarised in `features/LOG-STORAGE.md` | historical |

## Records (dated, frozen)

| Doc | What it is |
|---|---|
| [`records/2026-09-29-owner-rulings.md`](records/2026-09-29-owner-rulings.md) | Owner rulings that amend the design |
| [`records/2026-09-29-oci-setup.md`](records/2026-09-29-oci-setup.md) | How the cloud instance was created from the CLI |
| [`records/2026-09-30-antigravity-visual-transformation.md`](records/2026-09-30-antigravity-visual-transformation.md) | The console's visual redesign |
| [`records/2026-10-02-p7-extras-decisions.md`](records/2026-10-02-p7-extras-decisions.md) | P7 extras: off-box dumps built, Netdata replaced, Cockpit and per-person accounts not built, and why |
| [`records/2026-09-29-superseded-draft/README.md`](records/2026-09-29-superseded-draft/README.md) | The first draft of the plan, superseded; seven parts, indexed in its README |
| [`records/plans/2026-09-29-dev-preview.md`](records/plans/2026-09-29-dev-preview.md) | Plan: the local dev preview |
| [`records/plans/2026-09-30-p1-forensic-logging.md`](records/plans/2026-09-30-p1-forensic-logging.md) | Plan: P1 forensic logging |
| [`records/plans/2026-09-30-p3-app-platform.md`](records/plans/2026-09-30-p3-app-platform.md) | Plan: P3 app platform |
| [`records/plans/2026-09-30-p4-console.md`](records/plans/2026-09-30-p4-console.md) | Plan: P4 console |
| [`records/plans/2026-09-30-p6-terminal.md`](records/plans/2026-09-30-p6-terminal.md) | Plan: P6 browser terminal |
| [`records/plans/2026-09-30-log-storage.md`](records/plans/2026-09-30-log-storage.md) | Plan: log storage |

## Meta

| Doc | What it is |
|---|---|
| [`CONTRIBUTING-DOCS.md`](CONTRIBUTING-DOCS.md) | Folder map, naming, front-matter, publishing rules |
| [`_templates/doc-template.md`](_templates/doc-template.md) | The template to copy for a new doc |

## Status legend

`active` is current and maintained. `historical` is a dated snapshot kept for the record.
`draft` is in progress. `deprecated` is superseded and waiting to be removed.

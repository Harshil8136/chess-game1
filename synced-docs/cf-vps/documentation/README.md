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
| [`features/JOBS.md`](features/JOBS.md) | Server jobs: the busy gate every job waits on, the queue, a job's manifest and secrets, jobs with staged input, the Jobs page |
| [`features/RESTORE-TESTS.md`](features/RESTORE-TESTS.md) | Backup restore tests: a cf-backup copy staged, unlocked, rebuilt and checked in a sealed container; who may run one, the checks and score, resources, the lab key, testing PostgreSQL by hand |
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
| [`reference/DESIGN-SYSTEM.md`](reference/DESIGN-SYSTEM.md) | The console's design system: tokens, building blocks, the shell, and the rules that keep every page on it |

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
| [`specs/2026-10-08-console-redesign-design.md`](specs/2026-10-08-console-redesign-design.md) | The console redesign: one design system, three layers per page (Now, Work, About), phone first, emoji banned; delivered in waves 0 to 4 | active |
| [`specs/2026-10-08-job-controls-and-jobs-page-design.md`](specs/2026-10-08-job-controls-and-jobs-page-design.md) | Job controls (Stop, Restart, Pause, Resume, Block, limits, schedule) on the Apps and Jobs pages, and the rebuilt Jobs page; built, summarised in `features/JOBS.md` | historical |
| [`specs/2026-10-07-jobs-and-admission-queue-design.md`](specs/2026-10-07-jobs-and-admission-queue-design.md) | Scheduled jobs (`kind = "job"`) and the shared admission queue, drafted in parallel with the runner that shipped the same day; superseded by [JOBS](features/JOBS.md), kept for its reasoning | superseded |

## Records (dated, frozen)

| Doc | What it is |
|---|---|
| [`records/2026-09-29-owner-rulings.md`](records/2026-09-29-owner-rulings.md) | Owner rulings that amend the design |
| [`records/2026-09-29-oci-setup.md`](records/2026-09-29-oci-setup.md) | How the cloud instance was created from the CLI |
| [`records/2026-09-30-antigravity-visual-transformation.md`](records/2026-09-30-antigravity-visual-transformation.md) | The console's visual redesign |
| [`records/2026-10-02-p7-extras-decisions.md`](records/2026-10-02-p7-extras-decisions.md) | P7 extras: off-box dumps built, Netdata replaced, Cockpit and per-person accounts not built, and why |
| [`records/2026-09-29-superseded-draft/README.md`](records/2026-09-29-superseded-draft/README.md) | The first draft of the plan, superseded; seven parts, indexed in its README |
| [`records/incidents/2026-10-02-reboot-terminal-502s.md`](records/incidents/2026-10-02-reboot-terminal-502s.md) | Incident: 502s on terminal input and health during the planned kernel reboot; the agent now ends terminals with a reason on shutdown |
| [`records/plans/2026-09-29-dev-preview.md`](records/plans/2026-09-29-dev-preview.md) | Plan: the local dev preview |
| [`records/plans/2026-09-30-p1-forensic-logging.md`](records/plans/2026-09-30-p1-forensic-logging.md) | Plan: P1 forensic logging |
| [`records/plans/2026-09-30-p3-app-platform.md`](records/plans/2026-09-30-p3-app-platform.md) | Plan: P3 app platform |
| [`records/plans/2026-09-30-p4-console.md`](records/plans/2026-09-30-p4-console.md) | Plan: P4 console |
| [`records/plans/2026-09-30-p6-terminal.md`](records/plans/2026-09-30-p6-terminal.md) | Plan: P6 browser terminal |
| [`records/plans/2026-09-30-log-storage.md`](records/plans/2026-09-30-log-storage.md) | Plan: log storage |
| [`records/plans/2026-10-02-vps-metrics-consolidation.md`](records/plans/2026-10-02-vps-metrics-consolidation.md) | Plan: one Metrics page instead of History and Metrics (moved from the repository root on 2026-10-04) |
| [`records/plans/2026-10-02-vps-metrics-modernization.md`](records/plans/2026-10-02-vps-metrics-modernization.md) | Plan: the Metrics page redesign (moved from the repository root on 2026-10-04) |
| [`records/2026-10-04-agent-contract-alignment.md`](records/2026-10-04-agent-contract-alignment.md) | Change record: `main.md` becomes the contract every agent follows; `CLAUDE.md` and the Antigravity rule load it; change records begin |
| [`records/2026-10-04-console-hidden-tab-stream.md`](records/2026-10-04-console-hidden-tab-stream.md) | Change record: the console closes its live metrics feed and health check while its tab is hidden, and reopens the feed at once on return |
| [`records/2026-10-08-console-design-system.md`](records/2026-10-08-console-design-system.md) | Change record: the console gets one design system, a new top bar with page groups and Needs attention, no emoji, and four fixes (Packages, Diagnostics, Overview, Apps) |
| [`records/2026-10-09-console-redesign.md`](records/2026-10-09-console-redesign.md) | Change record: every console page rebuilt on the design system, one stylesheet, the theme follows cf-admin, and the reboot armed only when updates need it |
| [`records/2026-10-07-app-controls.md`](records/2026-10-07-app-controls.md) | Change record: apps can be started, stopped, paused, resumed, blocked and re-sized from the console, under `apps.control` and `apps.manage` |
| [`records/2026-10-07-jobs-and-the-heartbeat.md`](records/2026-10-07-jobs-and-the-heartbeat.md) | Change record: server jobs with one busy gate for the whole server, and the public site's hourly heartbeat moved off GitHub Actions onto it |
| [`records/2026-10-08-restore-test-rulings.md`](records/2026-10-08-restore-test-rulings.md) | Owner rulings on restore tests: the plan approved, permission-based settings, resources per test, no key to paste, and backup copies on the server only during a test |
| [`records/2026-10-08-restore-tests.md`](records/2026-10-08-restore-tests.md) | Change record: restore tests, a backup copy unlocked, rebuilt and checked in a sealed container on the server, with jobs that take staged input |
| [`records/2026-10-08-job-controls.md`](records/2026-10-08-job-controls.md) | Change record: server jobs can be stopped, restarted, paused, resumed, blocked and re-sized or re-scheduled from the Apps and Jobs pages, and the Jobs page is rebuilt for a phone |
| [`records/plans/2026-10-08-job-controls.md`](records/plans/2026-10-08-job-controls.md) | Plan: job controls and the rebuilt Jobs page, with the rulings made while executing it |
| [`records/plans/2026-10-08-console-redesign-wave-0.md`](records/plans/2026-10-08-console-redesign-wave-0.md) | Plan: the console redesign's Wave 0 (tokens, building blocks, shell, emoji purge, four fixes), with the rulings made while executing it |

## Meta

| Doc | What it is |
|---|---|
| [`CONTRIBUTING-DOCS.md`](CONTRIBUTING-DOCS.md) | Folder map, naming, front-matter, publishing rules |
| [`_templates/doc-template.md`](_templates/doc-template.md) | The template to copy for a new doc |
| [`_templates/change-record.md`](_templates/change-record.md) | The template for the dated record every big change gets (`main.md` §4) |

## Status legend

`active` is current and maintained. `historical` is a dated snapshot kept for the record.
`draft` is in progress. `superseded` was replaced by something that shipped and is kept for
its reasoning, with a pointer at the top. `deprecated` is superseded and waiting to be removed.

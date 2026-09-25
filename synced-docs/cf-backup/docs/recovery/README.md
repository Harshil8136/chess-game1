---
title: "cf-backup recovery — overview, reading order and status"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp, research]
owner: harshil
related_code: [.github/workflows/db-backup.yml, scripts/backup/cli.ts]
related_docs: [01-incident-postmortem.md, 02-root-causes.md, 03-reality-check.md, 04-defect-register.md, 05-options.md, 06-plan.md, 07-decisions.md, 08-how-others-do-it.md, 09-lifeboat-spec.md, 10-manual-backup-runbook.md]
tags: [cf-backup, recovery, backups, index]
---

# cf-backup recovery — overview

> **TL;DR (non-technical):** cf-backup has never produced a backup. Six real attempts, six
> failures, and no backup file anywhere. The Supabase database has no copy at all, and no one has
> yet confirmed a saved copy of the key that opens the backups. This folder explains why, lists
> every problem with its proof, and sets out a plan that makes a real backup exist **today**,
> automates it within a day or two with a small separate workflow, and only then repairs the main
> system.

> **Status (2026-09-25): open.** The schedule is still on, and every scheduled run fails. The
> first action is Stage 0 of the plan ([06](06-plan.md) §3), about an hour of the owner's time.

## 1. What happened, in one paragraph

Between 2026-09-24 and 2026-09-25, `db-backup.yml` ran six times: five started by a person, one by
the schedule. Every run failed, and one was reported as a pass. The pipeline never creates the
folders its tools write into, D1 refuses the row-count query it sends, and the Supabase tool it uses
switches to an account the backup role may not use. None of this was caught before production
because every test used stand-ins that were kinder than the real tools, and nothing ran the real
pipeline first. One level deeper: in ten days two backup systems were built, cf-admin's and this
one, and neither has produced a file. Work was judged done when its tests passed, never when a
restorable file existed.

## 2. Reading order

| # | Document | Answers |
|---|---|---|
| 1 | [01-incident-postmortem.md](01-incident-postmortem.md) | Every run, the exact log line that stopped it, the impact, and what fails next if nothing changes |
| 2 | [02-root-causes.md](02-root-causes.md) | The technical causes (T1–T7), the process causes (P1–P8), and the deeper one: what "done" meant |
| 3 | [03-reality-check.md](03-reality-check.md) | Each outside service (D1, R2, Supabase, GitHub Actions, age): what the design assumed, what is true |
| 4 | [04-defect-register.md](04-defect-register.md) | Every known defect by ID, with evidence, confidence, fix and plan stage |
| 5 | [05-options.md](05-options.md) | The five ways forward, and why the plan combines three |
| 6 | [06-plan.md](06-plan.md) | **The plan:** stages 0–5, tasks, exit criteria, definition of done, budget, risks, status |
| 7 | [07-decisions.md](07-decisions.md) | The owner's decisions RD-1 to RD-13, each with a default |
| 8 | [08-how-others-do-it.md](08-how-others-do-it.md) | Vendor guidance, real examples, known failure modes and proven practices, with sources |
| 9 | [09-lifeboat-spec.md](09-lifeboat-spec.md) | The small, separate daily backup workflow, step by step |
| 10 | [10-manual-backup-runbook.md](10-manual-backup-runbook.md) | **Start here if you are the owner today:** the manual backup, step by step |

## 3. Where to start

| You are | Read |
|---|---|
| The owner, today | [06](06-plan.md) §3 (Stage 0), then [10](10-manual-backup-runbook.md) |
| Deciding | [07](07-decisions.md) (RD-1 to RD-13) |
| The engineer | [04](04-defect-register.md), [06](06-plan.md), [09](09-lifeboat-spec.md) |
| Asking "why did this happen?" | [01](01-incident-postmortem.md), [02](02-root-causes.md), [08](08-how-others-do-it.md) |

## 4. Exposure today

| What | Copies outside the primary | What protects it |
|---|---|---|
| Supabase: the app's data (17 MB) and 6 sign-in accounts | **0** | Nothing. The Free plan has no platform backups |
| D1: `madagascar-db` (2.5 MB), `chatbot-kb`, `whatsapp-chatbot` | **0 off-site** | Time Travel: 7 days, in place, same account |
| The backup key | Supabase Vault, plus an **unconfirmed** recovery kit | 0 kit confirmations, 0 reveals in the key registry |

## 5. The plan at a glance

| Stage | What | Done when |
|---|---|---|
| 0 (today) | Confirm the recovery kits; stop the runs that can only fail; **one backup by hand**, sign-in accounts included | Two kit confirmations; no new failing runs; encrypted files in the bucket and a second place; one decrypted |
| 1 (days 1–2) | **The lifeboat:** a small separate daily workflow that dumps, checks a restore, encrypts and uploads | A scheduled run green; files in the bucket; row counts matched; one file decrypted by the owner |
| 2 (days 2–6) | Repair the main pipeline behind a **rehearsal job** with the real tools, plus contract tests for the fakes | Rehearsal green; one real full backup green |
| 3 | Back up sign-in accounts (RD-1) | Accounts restored in the monthly full-stack rehearsal |
| 4 | The restore drill leaves the daily run; a weekly drill restores from the bucket | Weekly drill green |
| 5 (30 days) | Soak; one restore by hand from the bucket; the day-30 decision | [06](06-plan.md) §9, definition of done |

## 6. Status

| Item | State | Evidence |
|---|---|---|
| Real backup files in the bucket | **none** | `backup_runs`: 6 rows, `data_bytes` 0 or empty |
| Stage 0 | not started | |
| Stage 1 (lifeboat) | not started | |
| Stages 2 to 5 | not started | |

The detailed, per-stage table is [06](06-plan.md) §12.

## 7. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | First analysis: run logs 1 to 5, the runner code, the Supabase CLI and drill-image sources, read-only live checks | Root causes and latent defects |
| 2026-09-25 | claude | Second review: run 6; `backup_runs`, `backup:config`, `backup:key-registry`; Supabase grants and catalog; two independent code audits; web research | Corrections, new defects N1–N9, Stages 0 and 1 |
| 2026-09-25 | claude | Rewritten in cf-admin's documentation format (front-matter, TL;DR, numbered sections, verification logs); the two review layers merged into one set | This folder |

## 8. Related

- [RESTORE.md](../RESTORE.md): restoring from a cf-backup run.
- [DIAGNOSTICS-PREFLIGHT-STORAGE.md](../DIAGNOSTICS-PREFLIGHT-STORAGE.md): the build log where red runs are recorded.

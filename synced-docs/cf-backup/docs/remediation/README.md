---
title: "cf-backup remediation — program overview, reading order and status"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp, research]
owner: harshil
related_code: [.github/workflows/db-backup.yml, scripts/backup/cli.ts]
related_docs: [01-post-incident-review.md, 02-root-cause-analysis.md, 03-dependency-assessment.md, 04-defect-register.md, 05-options-analysis.md, 06-remediation-plan.md, 07-decision-log.md, 08-industry-practice-review.md, 09-secondary-pipeline-specification.md, 10-sop-manual-baseline-export.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, data-protection, index]
---

# cf-backup data protection remediation — overview

> **TL;DR (non-technical):** cf-backup has not yet produced a recovery point: six production runs,
> six failures, and no archived copy of any database. The Supabase database has no copy at all, and
> no one has yet confirmed a saved copy of the key that decrypts the archive. This program sets out
> why, lists every defect with its evidence, and defines a plan that produces a verified recovery
> point **today**, automates it within one to two days through a small, independent Secondary
> Pipeline, and only then remediates the Primary Pipeline.

> **Status (2026-09-25, 16:00 UTC): open.** The schedule remains enabled and every scheduled run
> fails. The first action is Stage 0, Containment ([06](06-remediation-plan.md) §3): about one hour
> of the Owner's time. Terms follow [11](11-terminology-standard.md).

## 1. Summary

Between 2026-09-24 and 2026-09-25, the Primary Pipeline (`db-backup.yml`) ran six times: five
started manually, one by the Scheduler. Every run failed, and one was reported as successful. The
pipeline never creates the directories its tools write into, D1 rejects the row-count query it
sends, and the Supabase export tool switches to an account the read-only export role may not use.
None of this was detected before production because every unit test used test doubles more
permissive than the real tools, and nothing executed the real pipeline first. The underlying cause:
in ten days two export pipelines were built (cf-admin's and this one), and neither produced a
recovery point. Work was accepted when its tests passed, never when a restorable recovery point
existed.

## 2. Document index

| # | Document | Content |
|---|---|---|
| 1 | [01-post-incident-review.md](01-post-incident-review.md) | Every run, the log line that stopped it, the impact, and the forecast if no action is taken |
| 2 | [02-root-cause-analysis.md](02-root-cause-analysis.md) | Technical causes (T1–T7), process causes (P1–P8), and the underlying cause: the definition of done |
| 3 | [03-dependency-assessment.md](03-dependency-assessment.md) | Each external service (D1, R2, Supabase, GitHub Actions, age): design assumption versus actual behaviour |
| 4 | [04-defect-register.md](04-defect-register.md) | Every known defect by identifier, with evidence, confidence, remediation and stage |
| 5 | [05-options-analysis.md](05-options-analysis.md) | The five courses of action assessed, and the selected approach |
| 6 | [06-remediation-plan.md](06-remediation-plan.md) | **The remediation plan:** Stages 0–5, tasks, exit criteria, acceptance criteria, budget, risks, status |
| 7 | [07-decision-log.md](07-decision-log.md) | The Owner's decisions RD-1 to RD-14, each with a default |
| 8 | [08-industry-practice-review.md](08-industry-practice-review.md) | Vendor guidance, reference implementations, documented failure modes and established practices, with sources |
| 9 | [09-secondary-pipeline-specification.md](09-secondary-pipeline-specification.md) | The independent daily export pipeline, step by step |
| 10 | [10-sop-manual-baseline-export.md](10-sop-manual-baseline-export.md) | **For the Owner today:** the manual baseline export procedure |
| 11 | [11-terminology-standard.md](11-terminology-standard.md) | The terminology and naming standard, with the mapping from code identifiers |

## 3. Reading paths

| Role | Read |
|---|---|
| Owner, today | [06](06-remediation-plan.md) §3 (Stage 0), then [10](10-sop-manual-baseline-export.md) |
| Decision-maker | [07](07-decision-log.md) (RD-1 to RD-14) |
| Engineering | [04](04-defect-register.md), [06](06-remediation-plan.md), [09](09-secondary-pipeline-specification.md), [11](11-terminology-standard.md) |
| Review of causes | [01](01-post-incident-review.md), [02](02-root-cause-analysis.md), [08](08-industry-practice-review.md) |

## 4. Current exposure

| Asset | Copies outside the primary | Current protection |
|---|---|---|
| Supabase: application data (17 MB) and 6 authentication records | **0** | None. The Free plan provides no platform backups |
| D1: `madagascar-db` (2.5 MB), `chatbot-kb`, `whatsapp-chatbot` | **0 off-site** | Time Travel: 7 days, in place, same account |
| Archive encryption key | Supabase Vault, plus an **unconfirmed** offline recovery key | 0 confirmations and 0 reveals in the key registry |

## 5. Plan summary

| Stage | Scope | Exit criteria |
|---|---|---|
| 0 Containment (today) | Confirm the offline recovery keys; stop the scheduled runs; **one manual baseline export**, authentication records included | Two confirmations; no new failed runs; encrypted files in the archive bucket and a second location; one file decrypted |
| 1 Interim protection (days 1–2) | **Secondary Pipeline:** an independent daily workflow that exports, verifies a restore, encrypts and uploads | A scheduled run passes; files archived; row counts matched; one file decrypted by the Owner |
| 2 Primary Pipeline remediation (days 2–7) | Remediation behind **Pre-production Validation** with the real tools; contract tests for the test doubles; nomenclature alignment | Validation passing; one production full run passing |
| 3 Authentication record coverage | Include `auth.users` and `auth.identities` (RD-1) | Authentication records restored in the monthly full-stack validation |
| 4 Restore verification decoupling | Restore verification leaves the daily run; a weekly verification restores from the archive bucket | Weekly verification passing |
| 5 Stabilization and acceptance (30 days) | Unattended operation; one recovery test by a person; the day-30 decision | [06](06-remediation-plan.md) §9 acceptance criteria |

## 6. Status

| Item | State | Evidence |
|---|---|---|
| Recovery points in the archive bucket | **none** | `backup_runs`: 6 rows, `data_bytes` 0 or empty |
| Stage 0 Containment | not started | Re-checked 2026-09-25 16:00 UTC: schedule enabled; both workflows active; 0 key confirmations |
| Stage 1 Interim protection | not started | |
| Stages 2 to 5 | not started | |

Per-stage detail: [06](06-remediation-plan.md) §12.

## 7. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | First analysis: run logs 1 to 5, the runner code, the Supabase CLI and restore-image sources, read-only live checks | Root causes and latent defects |
| 2026-09-25 | claude | Second review: run 6; `backup_runs`, `backup:config`, `backup:key-registry`; Supabase grants and catalog; two independent code audits; industry research | Corrections, defects N1–N9, Stages 0 and 1 |
| 2026-09-25 | claude | Rewritten in cf-admin's documentation format; review layers consolidated into one set | This folder |
| 2026-09-25 | claude | Terminology standard applied; folder renamed from `docs/recovery/` to `docs/remediation/`; live status re-checked at 16:00 UTC | [11](11-terminology-standard.md); §6 |

## 8. Related

- [RESTORE.md](../RESTORE.md): restoring from a cf-backup run.
- [DIAGNOSTICS-PREFLIGHT-STORAGE.md](../DIAGNOSTICS-PREFLIGHT-STORAGE.md): the build log where failed runs are recorded.

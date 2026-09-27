---
title: "cf-backup remediation — program overview, reading order and status"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-09-26
verified_against: [code, infra, live-mcp, research]
owner: harshil
related_code: [.github/workflows/db-backup.yml, scripts/backup/cli.ts, .github/workflows/secondary-pipeline.yml]
related_docs: [01-post-incident-review.md, 02-root-cause-analysis.md, 03-dependency-assessment.md, 04-defect-register.md, 05-options-analysis.md, 06-remediation-plan.md, 07-decision-log.md, 08-industry-practice-review.md, 09-secondary-pipeline-specification.md, 10-sop-manual-baseline-export.md, 11-terminology-standard.md, 12-open-source-tool-assessment.md]
tags: [cf-backup, remediation, data-protection, index]
---

# cf-backup data protection remediation — overview

> **TL;DR (non-technical):** cf-backup's Primary Pipeline has not yet produced a recovery point:
> seven production runs, seven failures. On the evening of 2026-09-26 a small, independent
> **Secondary Pipeline** produced the first ones: the Supabase data, its sign-in accounts
> (authentication records) and all three D1 databases, exported, restored into a scratch copy and
> checked table by table, then encrypted and stored off-site. It runs every day from 2026-09-27.
> One gap remains: no one has yet confirmed a saved copy of the key that decrypts the archive
> (§7). This program sets out why the Primary Pipeline failed, lists every defect with its
> evidence, and defines how it is remediated.

> **Status (2026-09-26, 22:50 UTC): open.** Stage 1 is built and commissioned, and Stage 3's
> authentication records are in the Secondary Pipeline ([09](09-secondary-pipeline-specification.md)
> §7). Stage 0, Containment ([06](06-remediation-plan.md) §3), has not started: the Primary
> Pipeline's schedule remains enabled and every scheduled run fails. The Owner's remaining tasks are
> in §7. Terms follow [11](11-terminology-standard.md).

## 1. Summary

Between 2026-09-24 and 2026-09-26, the Primary Pipeline (`db-backup.yml`) ran seven times: five
started manually, two by the Scheduler. Every run failed, and one was reported as successful. The
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
| 12 | [12-open-source-tool-assessment.md](12-open-source-tool-assessment.md) | *(draft, 2026-09-26)* Open-source tools for Supabase and D1 exports, assessed against this program's requirements; build or adopt; proposed RD-15 |

## 3. Reading paths

| Role | Read |
|---|---|
| Owner, today | [06](06-remediation-plan.md) §3 (Stage 0), then [10](10-sop-manual-baseline-export.md) |
| Decision-maker | [07](07-decision-log.md) (RD-1 to RD-14), then [12](12-open-source-tool-assessment.md) §6 to §7 (proposed RD-15) |
| Engineering | [04](04-defect-register.md), [06](06-remediation-plan.md), [09](09-secondary-pipeline-specification.md), [11](11-terminology-standard.md) |
| Review of causes | [01](01-post-incident-review.md), [02](02-root-cause-analysis.md), [08](08-industry-practice-review.md) |

## 4. Current exposure

| Asset | Copies outside the primary | Current protection |
|---|---|---|
| Supabase: application data (`public`, `supabase_migrations`) | **1 a day**, from 2026-09-26 | Secondary Pipeline: restore-verified, encrypted, in the archive bucket and a 14-day GitHub artifact |
| Supabase: authentication records (6 accounts, 12 identities) | **1 a day**, from 2026-09-26 22:49 UTC | Secondary Pipeline, as above (store `postgres-auth`). The Free plan provides no platform backups |
| D1: `madagascar-db` (2.5 MB), `chatbot-kb`, `whatsapp-chatbot` | **1 a day off-site**, from 2026-09-26 | Secondary Pipeline, as above; plus Time Travel: 7 days, in place, same account |
| Archive encryption key | Supabase Vault, plus an **unconfirmed** offline recovery key | The Vault's key matches the recipient every file is encrypted to (weekly key check, 2026-09-25); 0 confirmations and 0 reveals of the offline copy |

## 5. Plan summary

| Stage | Scope | Exit criteria |
|---|---|---|
| 0 Containment (today) | Confirm the offline recovery keys; stop the scheduled runs; ~~one manual baseline export~~ (superseded on 2026-09-26 by the Secondary Pipeline) | Two confirmations; no new failed runs; one file decrypted |
| 1 Interim protection (days 1–2) | **Secondary Pipeline:** an independent daily workflow that exports, verifies a restore, encrypts and uploads | A scheduled run passes; files archived; row counts matched; one file decrypted by the Owner |
| 2 Primary Pipeline remediation (days 2–7) | Remediation behind **Pre-production Validation** with the real tools; contract tests for the test doubles; nomenclature alignment | Validation passing; one production full run passing |
| 3 Authentication record coverage | Include `auth.users` and `auth.identities` (RD-1) | Authentication records restored in the monthly full-stack validation |
| 4 Restore verification decoupling | Restore verification leaves the daily run; a weekly verification restores from the archive bucket | Weekly verification passing |
| 5 Stabilization and acceptance (30 days) | Unattended operation; one recovery test by a person; the day-30 decision | [06](06-remediation-plan.md) §9 acceptance criteria |

## 6. Status

| Item | State | Evidence |
|---|---|---|
| Verified recovery points | **2**, the newest 2026-09-26 22:49 UTC (Secondary Pipeline) | `secondary/pipeline/2026-09-26/36277447136-1/`, authentication records included; every table's restored count matched ([09](09-secondary-pipeline-specification.md) §7) |
| Primary Pipeline recovery points | **none** | `backup_runs`: 7 rows, `data_bytes` 0 or empty; the seventh failed on 2026-09-26 at 09:20 UTC |
| Stage 0 Containment | not started | Re-checked 2026-09-26 20:35 UTC: schedule enabled; both workflows active; 0 key confirmations |
| Stage 1 Interim protection | **in progress**: built and commissioned | Pending: the first scheduled run (2026-09-27 08:41 UTC), the Owner's decryption of one file, the bucket rules on `secondary/`, a proven failure notification |
| Stage 3 Authentication record coverage | **in progress**: Secondary Pipeline done | RD-1 applied on 2026-09-26; the Primary Pipeline follows in Stage 2; the monthly full-stack restore (3.4) is pending |
| Stages 2, 4 and 5 | not started | |

Per-stage detail: [06](06-remediation-plan.md) §12.

## 7. Owner action list

Everything the Owner still has to do, in order. Defaults apply to any decision not taken.

| # | Task | Why it cannot be done for the Owner | Phone? | Time |
|---|---|---|---|---|
| 0 | **Urgent: cf-admin's 5-minute jobs stopped on 2026-09-26 at 22:45 UTC** (all of them: the backup Scheduler, the failed sign-in monitor, booking email retry and replay, access-list sync, storage notices, scheduled blog posts). The Sunday jobs still ran at 02:00 UTC, so the Worker is up; only the `*/5 * * * *` trigger's runs stopped, with nothing reported to Sentry. Cloudflare → Workers & Pages → `cf-admin-madagascar` → Settings → Trigger events → **View events**: no recent `*/5` runs means the trigger is gone (add `*/5 * * * *` back there); runs with an error such as exceeded CPU mean the batch outgrew the Free plan's 10 ms per run. Copy what it shows into the session | Cloudflare's trigger list and event log are not reachable with the tools used here | Yes, in the browser | 2 min |
| 1 | **Stop the failing Primary Pipeline runs** ([06](06-remediation-plan.md) 0.3), in this order: (a) ~~console schedule~~ **done**: full backup turned off in the console on 2026-09-26 at 23:48 UTC; Supabase-only turned off on 2026-09-27 at 01:34 UTC at the Owner's request, written directly to the settings row with a notice alert queued (in the console: Backups → Settings → the Schedule card → **Edit** → untick **Enabled** under each schedule → reason → **Review changes** → **Save**; the switches appear only after Edit, and only for the Owner and Vendor-support roles); (b) GitHub → cf-backup → Actions → `db-backup` → ⋯ → **Disable workflow** (its fallback schedule, Mondays 12:43 UTC, ignores the console); (c) GitHub → cf-admin → Actions → `backups` → **Disable workflow** (Sundays 09:17 UTC). Leave `secondary-pipeline` enabled | The GitHub connector used here cannot disable workflows | Yes, in the browser (GitHub may need "desktop site") | 3 min |
| 2 | **Turn on GitHub's failure emails** for the account that starts the scheduled runs (`mascotasmadagascar-cmd`): GitHub → Settings → Notifications → Actions → failed workflows | A personal setting | Yes | 1 min |
| 3 | **Add two rules on the archive bucket** ([06](06-remediation-plan.md) 1.4, RD-12): Cloudflare → R2 → `madagascar-backups` → Settings: a bucket lock rule on prefix `secondary/` for 30 days, and an object lifecycle rule deleting `secondary/` objects after 35 days | No connector tool manages bucket rules, and the pipeline's token must not change bucket policy | Yes, in the browser | 5 min |
| 4 | **Confirm the offline recovery key by decrypting one file** ([06](06-remediation-plan.md) 0.1 and 1.3): download the artifact of any `secondary-pipeline` run, then `age -d -i key.txt -o f.sql.gz d1-whatsapp-chatbot.sql.gz.age`, `gunzip f.sql.gz`, and record the confirmation on the console's Keys screen. Then the Vendor does the same (0.2) | Only the Owner and the Vendor hold the offline key. Done for the Owner: the recipient every file is encrypted to equals the active key, and the Vault holds its private half | No: needs a computer with `age` | 15 min |
| 5 | **Decisions RD-2, RD-4 and RD-15** ([07](07-decision-log.md), [12](12-open-source-tool-assessment.md) §7) | The Owner's call | Yes | 10 min |
| 6 | **For Stage 2, later:** a Cloudflare API token scoped to the validation database and bucket only (RD-2), stored as a GitHub secret | Tokens are created by an account owner | Yes, in the browser | 10 min |

Removed from the list on 2026-09-26: the weekly manual baseline export (0.4–0.5, superseded by the
Secondary Pipeline's authentication records) and running the Stage 3 SQL file (3.2, applied through
the Supabase connector).

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | First analysis: run logs 1 to 5, the runner code, the Supabase CLI and restore-image sources, read-only live checks | Root causes and latent defects |
| 2026-09-25 | claude | Second review: run 6; `backup_runs`, `backup:config`, `backup:key-registry`; Supabase grants and catalog; two independent code audits; industry research | Corrections, defects N1–N9, Stages 0 and 1 |
| 2026-09-25 | claude | Rewritten in cf-admin's documentation format; review layers consolidated into one set | This folder |
| 2026-09-25 | claude | Terminology standard applied; folder renamed from `docs/recovery/` to `docs/remediation/`; live status re-checked at 16:00 UTC | [11](11-terminology-standard.md); §6 |
| 2026-09-26 | claude | Open-source tool survey and the case for build or adopt; no live checks | [12](12-open-source-tool-assessment.md) (draft) |
| 2026-09-26 | claude | Secondary Pipeline commissioning runs 36269275118 and 36269595781; live re-check of `backup_runs`, the schedule, the key registry and workflow states at 20:35 UTC | §4, §6 |
| 2026-09-26 | claude | Authentication records added (run 36277447136); the pipeline's recipient compared with the key registry's active key; the weekly key check's last result read from `backup:status` | §4, §6, §7 |

## 9. Related

- [RESTORE.md](../RESTORE.md): restoring from a cf-backup run.
- [DIAGNOSTICS-PREFLIGHT-STORAGE.md](../DIAGNOSTICS-PREFLIGHT-STORAGE.md): the build log where failed runs are recorded.

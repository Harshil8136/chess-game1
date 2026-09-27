---
title: "cf-backup remediation — program overview, reading order and status"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-09-27
verified_against: [code, infra, live-mcp, research]
owner: harshil
related_code: [.github/workflows/secondary-pipeline.yml, scripts/secondary-pipeline/verify.ts, .github/workflows/db-backup.yml]
related_docs: [01-post-incident-review.md, 02-root-cause-analysis.md, 03-dependency-assessment.md, 04-defect-register.md, 05-options-analysis.md, 06-remediation-plan.md, 07-decision-log.md, 08-industry-practice-review.md, 09-secondary-pipeline-specification.md, 10-sop-manual-baseline-export.md, 11-terminology-standard.md, 12-open-source-tool-assessment.md, 13-engine-consolidation-plan.md]
tags: [cf-backup, remediation, data-protection, index]
---

# cf-backup data protection remediation — overview

> **TL;DR (non-technical):** cf-backup's Primary Pipeline has not yet produced a recovery point:
> seven production runs, seven failures. On the evening of 2026-09-26 a small, independent
> **Secondary Pipeline** produced the first ones: the Supabase data, its sign-in accounts
> (authentication records) and all three D1 databases, exported, restored into a scratch copy and
> checked table by table, then encrypted and stored off-site. It runs every day from 2026-09-27.
> **On 2026-09-27 the Owner settled every open decision ([07](07-decision-log.md) §0): the
> Secondary Pipeline becomes the permanent engine, the console is pointed at it, and the Primary
> Pipeline is retired instead of repaired ([13](13-engine-consolidation-plan.md)).** One gap
> remains: no one has yet confirmed a saved copy of the key that decrypts the archive (§7).

> **Status (2026-09-27, 09:30 UTC): open.** Containment is done: both schedule settings are off and
> both old workflows are disabled. The Secondary Pipeline is commissioned; its first scheduled run
> is due, and GitHub starts this repository's scheduled runs 4 to 5 hours late. The plan of record
> from here is [13](13-engine-consolidation-plan.md), which replaces [06](06-remediation-plan.md)
> Stages 2 to 5. The Owner's remaining tasks are in §7. Terms follow
> [11](11-terminology-standard.md).

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
| 7 | [07-decision-log.md](07-decision-log.md) | The Owner's decisions RD-1 to RD-15; **all settled on 2026-09-27 (§0)** |
| 8 | [08-industry-practice-review.md](08-industry-practice-review.md) | Vendor guidance, reference implementations, documented failure modes and established practices, with sources |
| 9 | [09-secondary-pipeline-specification.md](09-secondary-pipeline-specification.md) | The independent daily export pipeline, step by step |
| 10 | [10-sop-manual-baseline-export.md](10-sop-manual-baseline-export.md) | **For the Owner today:** the manual baseline export procedure |
| 11 | [11-terminology-standard.md](11-terminology-standard.md) | The terminology and naming standard, with the mapping from code identifiers |
| 12 | [12-open-source-tool-assessment.md](12-open-source-tool-assessment.md) | Open-source tools for Supabase and D1 exports, assessed against this program's requirements; build or adopt; RD-15 (decided: option B) |
| 13 | [13-engine-consolidation-plan.md](13-engine-consolidation-plan.md) | **The plan of record from 2026-09-27:** the Secondary Pipeline as the only engine, the console pointed at it, the Primary Pipeline retired; steps B0 to B5, acceptance criteria, status |

## 3. Reading paths

| Role | Read |
|---|---|
| Owner, today | §7 below, then [13](13-engine-consolidation-plan.md) §1 |
| Decision-maker | [07](07-decision-log.md) §0 (every decision, settled), then [12](12-open-source-tool-assessment.md) §6 (why option B) |
| Engineering | [13](13-engine-consolidation-plan.md), [09](09-secondary-pipeline-specification.md), [04](04-defect-register.md), [11](11-terminology-standard.md) |
| Review of causes | [01](01-post-incident-review.md), [02](02-root-cause-analysis.md), [08](08-industry-practice-review.md) |

## 4. Current exposure

| Asset | Copies outside the primary | Current protection |
|---|---|---|
| Supabase: application data (`public`, `supabase_migrations`) | **1 a day**, from 2026-09-26 | Secondary Pipeline: restore-verified, encrypted, in the archive bucket and a 14-day GitHub artifact |
| Supabase: authentication records (6 accounts, 12 identities) | **1 a day**, from 2026-09-26 22:49 UTC | Secondary Pipeline, as above (store `postgres-auth`). The Free plan provides no platform backups |
| D1: `madagascar-db` (2.5 MB), `chatbot-kb`, `whatsapp-chatbot` | **1 a day off-site**, from 2026-09-26 | Secondary Pipeline, as above; plus Time Travel: 7 days, in place, same account |
| Archive encryption key | Supabase Vault, plus an **unconfirmed** offline recovery key | The Vault's key matches the recipient every file is encrypted to (weekly key check, 2026-09-25); 0 confirmations and 0 reveals of the offline copy |

## 5. Plan summary

Stages 0 and 1 are [06](06-remediation-plan.md) §3 and §4. From 2026-09-27, Stages 2 to 5 are
replaced by the steps of [13](13-engine-consolidation-plan.md) (RD-15, option B).

| Step | Scope | Exit criteria |
|---|---|---|
| 0 Containment | Stop the scheduled runs; confirm the offline recovery keys | Both workflows disabled and both schedules off (**done**); two key confirmations |
| 1 Interim protection | **Secondary Pipeline:** an independent daily workflow that exports, verifies a restore, encrypts and uploads | A scheduled run passes; files archived; row counts matched; one file decrypted by the Owner |
| B0 Prove the engine | Stage 1's exit criteria, the bucket rules, the external heartbeat monitor (RD-9) | As Stage 1, plus a heartbeat received |
| B1–B3 Point the console at it | Run records, freshness and staleness alerts, and "Run now" and the Scheduler, all for the Secondary Pipeline | The console lists its runs; no staleness alert while its recovery points are fresh; a dispatch from the console runs it |
| B4 Acceptance (30 days) | Unattended daily runs; one recovery test by a person | [13](13-engine-consolidation-plan.md) §4 |
| B5 Retirement | Move the few shared files out of `scripts/backup/`, then delete the Primary Pipeline's runner and its dead console screens | `npm run verify` passes; no dead screens |

## 6. Status

| Item | State | Evidence |
|---|---|---|
| Verified recovery points | **2**, the newest 2026-09-26 22:49 UTC (Secondary Pipeline) | `secondary/pipeline/2026-09-26/36277447136-1/`, authentication records included; every table's restored count matched ([09](09-secondary-pipeline-specification.md) §7) |
| Primary Pipeline recovery points | **none**; the runner is to be retired (RD-15) | `backup_runs`: 7 rows, `data_bytes` 0 or empty; none since 2026-09-26 09:20 UTC |
| Stage 0 Containment | **done** except the key confirmations | 2026-09-27: `backup:config` rev 4, both schedules off (01:34 UTC); `db-backup.yml` and cf-admin's `backups.yml` `disabled_manually` (about 02:00 UTC); key registry: 0 confirmations, 0 reveals |
| Stage 1 Interim protection | **in progress**: built and commissioned | Pending: the first scheduled run (due 08:41 UTC on 2026-09-27; not started at 09:30, as GitHub runs this repository's schedules 4 to 5 hours late), the Owner's decryption of one file, the bucket rules on `secondary/`, a proven failure notification |
| Authentication record coverage | **done** in the Secondary Pipeline | RD-1 applied on 2026-09-26; 6 users and 12 identities restored in every run since |
| Decisions | **all settled** 2026-09-27 | [07](07-decision-log.md) §0 |
| B1 Run records | **built** 2026-09-27: the console records every Secondary Pipeline run | [13](13-engine-consolidation-plan.md) §3 B1 |
| B2 to B5 | not started | [13](13-engine-consolidation-plan.md) §8 |

Per-step detail: [13](13-engine-consolidation-plan.md) §8.

## 7. Owner action list

Everything the Owner still has to do, in order. *Rewritten 2026-09-27 for the decisions in
[07](07-decision-log.md) §0.*

| # | Task | Why it cannot be done for the Owner | Phone? | Time |
|---|---|---|---|---|
| 0 | ~~**Urgent: cf-admin's 5-minute jobs stopped on 2026-09-26 at 22:45 UTC**~~ **Fixed on the free plan, 2026-09-27** (cf-admin `009c523`). Every cron run was ending `exceededCpu` at 10 ms, the Workers Free limit per invocation, because all ten jobs shared one run that measured 22 ms. Each due job now runs in its own invocation with its own 10 ms, at no cost, and the Workers Paid upgrade suggested here earlier is no longer needed. Record: cf-admin `documentation/operations/incidents/2026-09-26-cron-exceeded-cpu.md`. **Verified 2026-09-27:** steady state 2 ms for the tick and 1–3 ms per job (Cloudflare trigger events, 04:10 UTC); Diagnostics at 04:21 UTC shows 0 failures, with `tick.age` and `alerts.delivery` passing. **Optional for the Owner:** run `asset-cleanup` and `staff-storage-reconcile` from `/dashboard/cron` with **Run now**, since the 2026-09-27 Sunday run was missed; otherwise they run on 2026-10-04 | Optional | Yes | 2 min |
| 1 | ~~**Stop the failing Primary Pipeline runs**~~ **Done** 2026-09-27: both schedule settings off in the console (full at 23:48 UTC on 09-26, Supabase-only at 01:34 UTC); `db-backup.yml` and cf-admin's `backups.yml` disabled on GitHub (about 02:00 UTC). Leave `secondary-pipeline` enabled | — | — | — |
| 2 | **Turn on GitHub's failure emails** for the account that starts the scheduled runs (`mascotasmadagascar-cmd`): GitHub → Settings → Notifications → Actions → failed workflows | A personal setting | Yes | 1 min |
| 3 | **Add two rules on the archive bucket** ([06](06-remediation-plan.md) 1.4, RD-12): Cloudflare → R2 → `madagascar-backups` → Settings: a bucket lock rule on prefix `secondary/` for 30 days, and an object lifecycle rule deleting `secondary/` objects after 35 days | No connector tool manages bucket rules, and the pipeline's token must not change bucket policy | Yes, in the browser | 5 min |
| 4 | **Create the external heartbeat monitor** (RD-9): at healthchecks.io (free), add a check with period **1 day** and grace **8 hours**, and set its email alert. Copy the ping URL, then GitHub → cf-backup → Settings → Secrets and variables → Actions → **New repository secret** named `HEARTBEAT_PING_URL` with that URL. The pipeline pings it after every passing run; until the secret exists, the step is skipped | Creating an account and a secret needs the Owner | Yes, in the browser | 10 min |
| 5 | **Confirm the offline recovery key by decrypting one file** ([06](06-remediation-plan.md) 0.1 and 1.3): download the artifact of any `secondary-pipeline` run, then `age -d -i key.txt -o f.sql.gz d1-whatsapp-chatbot.sql.gz.age`, `gunzip f.sql.gz`, and record the confirmation on the console's Keys screen. Then the Vendor does the same (0.2). Required before the Primary Pipeline is deleted ([13](13-engine-consolidation-plan.md) B5) | Only the Owner and the Vendor hold the offline key | No: needs a computer with `age` | 15 min |
| 6 | **At acceptance:** one recovery test from the archive bucket with the offline recovery key, following `docs/RESTORE.md` ([13](13-engine-consolidation-plan.md) B4) | A person must prove the whole path | No: needs a computer | 1 hour |

Removed on 2026-09-27: the decisions (all settled, [07](07-decision-log.md) §0) and the Stage 2
validation token (not needed, RD-2). Removed on 2026-09-26: the weekly manual baseline export
(0.4–0.5, superseded by the Secondary Pipeline's authentication records) and running the Stage 3 SQL
file (3.2, applied through the Supabase connector).

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
| 2026-09-27 | claude | Every open decision settled at the Owner's request; live re-check at 09:30 UTC of both repositories' workflow states, `backup:config`, `backup_runs`, the key registry, Supabase Storage, and the start times of this repository's scheduled runs | §5, §6, §7; [07](07-decision-log.md) §0; [13](13-engine-consolidation-plan.md) |

## 9. Related

- [RESTORE.md](../RESTORE.md): restoring from a cf-backup run.
- [DIAGNOSTICS-PREFLIGHT-STORAGE.md](../DIAGNOSTICS-PREFLIGHT-STORAGE.md): the build log where failed runs are recorded.

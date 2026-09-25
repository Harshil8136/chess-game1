---
title: "cf-backup remediation — 11 Terminology and naming standard"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-09-25
verified_against: [code]
owner: harshil
related_code: [scripts/backup/lib/pipeline.ts, .github/workflows/db-backup.yml, .github/workflows/tick-deadman.yml]
related_docs: [README.md, 06-remediation-plan.md, 07-decision-log.md]
tags: [cf-backup, remediation, terminology, naming, glossary]
---

<!-- docs-check: proposed-paths -->
<!-- Names proposed files (secondary-pipeline.yml, preprod-validation.yml, 04_auth_export_views.sql),
     a retired proposal (04_backup_auth_export.sql) and cf-admin's .github/workflows/backups.yml. -->

# 11 — Terminology and naming standard

> **TL;DR (non-technical):** The remediation documents use standard incident-management and
> disaster-recovery vocabulary, not internal nicknames. This page lists every term, what it means,
> and the older informal name it replaces. Some old names still exist inside the code, the console
> and the run logs. They are listed here so each can be matched to its professional name until the
> code itself is renamed (decision RD-14).

## 1. Rules

1. **Standard vocabulary first.** Where incident management (post-incident review, root-cause
   analysis, containment, remediation) or disaster recovery (recovery point, RPO, RTO, restore
   verification) has an established term, it is used.
2. **Descriptive names for new components.** A new workflow, stage, file or prefix is named for
   what it does (`secondary-pipeline.yml`, `preprod-validation.yml`), never with a metaphor.
3. **Code identifiers are quoted exactly.** Log lines, file names, step ids, table names and
   settings keys are evidence, so they appear as they are (for example `seal`, `doctor`,
   `drill_failed`), always paired with their professional name on first use in a document.
4. **"Backup" is precise, not generic.** In prose, the artifact is a **recovery point**, producing
   it is an **export**, storing it encrypted is **archiving**, and the domain is **data
   protection**. The word "backup" remains only in proper names and identifiers: the product
   `cf-backup`, `db-backup.yml`, `backup_runs`, `backup_reader`, `backup-tick`,
   `BACKUP_AGE_RECIPIENT` and the bucket `madagascar-backups`.
5. **Living documents follow the code.** Documents that describe the built system
   (`docs/RESTORE.md`, `docs/OWNER-SETUP.md`, the console) keep the code's names until the code is
   renamed (RD-14), so they never disagree with what the system shows. Dated records
   (`docs/plans/`, `docs/specs/`, `docs/records/`) are frozen and are not rewritten, as in
   cf-admin's documentation conventions.

## 2. Components and workflows

| Professional name | Meaning | Replaces (informal) | Identifier today |
|---|---|---|---|
| **Primary Pipeline** | cf-backup's scheduled export, verification and archiving pipeline | "the main pipeline" | `.github/workflows/db-backup.yml`, `scripts/backup/cli.ts` |
| **Secondary Pipeline** | A small, independent export pipeline that shares no code with the Primary Pipeline: interim protection now, a second path later | "lifeboat" | proposed `.github/workflows/secondary-pipeline.yml` |
| **Pre-production Validation (PPV)** | A CI workflow that runs the Primary Pipeline's real commands and tools against test resources before any change reaches production; cf-backup's staging environment | "rehearsal", "rehearsal job", "staging in a box" | proposed `.github/workflows/preprod-validation.yml` |
| **Scheduler** | cf-admin's five-minute job that dispatches scheduled runs and raises alerts | "the tick" | `backup-tick`, `POST /internal/tick` |
| **Fallback schedule** | The weekly `schedule:` line that starts a full run if no good one exists (design D-5) | "fallback cron" | `db-backup.yml` cron `43 12 * * 1` |
| **Scheduler heartbeat monitor** | A daily check that fails when the Scheduler has stopped | "dead-man's switch" | `.github/workflows/tick-deadman.yml` |
| **External heartbeat monitor** | A third-party check that alerts when a successful run does not report in (RD-9) | "outside dead-man" | proposed |
| **Legacy export workflow** | cf-admin's older, never-completed backup workflow | "the bridge" | cf-admin `.github/workflows/backups.yml` |

## 3. Primary Pipeline stages

| Professional name | What it does | Code identifier |
|---|---|---|
| Run planning | Validates inputs, reserves the run record, decides whether to proceed | `plan` |
| Toolchain provisioning | Installs and verifies the external tools | `tools` |
| **Pre-flight diagnostics** | Checks secrets, reachability and the encryption key before any export | `doctor` |
| D1 export | Exports the D1 databases | `d1` |
| PostgreSQL export | Exports the Supabase database | `postgres` |
| **Finalization** | Encrypts, uploads, writes the manifest and checksums, and records the verdict | `seal` |
| Cleanup | Removes containers and temporary files | `cleanup` |

## 4. Run types

| Professional name | Meaning | Code identifier |
|---|---|---|
| Backup run | A run that produces and archives a recovery point | `mode=backup` |
| **Pre-flight run** | Pre-flight diagnostics only; no data | `mode=preflight`; console label "Runner test (no data)" |
| **Verification run** | Every export and restore verification, nothing archived | `mode=check` |
| **Restore verification** | Restoring an export into a scratch target and comparing row counts | "drill"; `drill` objects, `drill_failed` |
| **Live restore test** | The monthly restore into a temporary D1 database through the real API | "real-path drill"; `mode=drill`, `d1-real-drill` |
| Recovery test | A person restores from the archive with the offline recovery key | "human restore" |

## 5. Data protection terms

| Professional name | Meaning | Replaces (informal) |
|---|---|---|
| **Recovery point** | An encrypted, archived copy of a store at one moment, from which it can be restored | "a backup", "backup file" |
| **Verified recovery point** | A recovery point whose restore verification passed | "a good backup" |
| **Recovery Point Actual (RPA)** | The age of the newest verified recovery point, per store, compared with the RPO | "the one number" |
| **RPO / RTO** | Recovery point objective (24 h for Supabase; 7 days for D1, with Time Travel) / recovery time objective | — |
| **Archive bucket** | The R2 bucket that holds recovery points (`madagascar-backups`) | "the backup bucket" |
| **Archive encryption key** | The age X25519 key pair; the runner holds only its public recipient | "the backup key" |
| **Offline recovery key** | The private half of the archive encryption key, held by the Owner and the Vendor in their password managers; the console calls it the "recovery kit" | "recovery kit" |
| **Read-only export role** | The Postgres role the pipelines connect as (`backup_reader`) | "the backup role" |
| **Authentication records** | Supabase `auth.users` and `auth.identities` | "sign-in accounts" |
| **Manual baseline export** | A recovery point produced by the Owner by hand, following the SOP | "manual backup", "backup by hand" |

## 6. Process terms

| Professional name | Meaning | Replaces (informal) |
|---|---|---|
| **Post-incident review (PIR)** | The factual record of what happened | "post-mortem", "what happened" |
| **Root-cause analysis (RCA)** | Why it happened, technically and in the process | "root causes" |
| **Dependency assessment** | Each external service: what the design assumed and what is true | "reality check" |
| **Containment** | Stopping further failures and securing what exists, before any repair | "stop the bleeding", "stop the runs that can only fail" |
| **Remediation** | Fixing the defects | "repair" |
| **Stabilization period** | 30 days of unattended scheduled operation before acceptance | "soak" |
| **Acceptance criteria / definition of done** | The evidence that closes the program | "done when" |
| **Test double** | A stand-in for an external tool in unit tests | "fake" |
| **Contract test** | A test that checks a test double behaves like the real tool | — |
| **Standard operating procedure (SOP)** | A step-by-step procedure a person follows | "runbook" (for the manual export) |
| **Minimum viable pipeline** | The smallest pipeline that really works end to end, built first ("walking skeleton" in the cited literature) | "walking skeleton" |
| **Feature freeze** | No new features until acceptance | "freeze" |

## 7. Renamed documents and paths

| Old | New |
|---|---|
| `docs/recovery/` | `docs/remediation/` |
| `01-incident-postmortem.md` | `01-post-incident-review.md` |
| `02-root-causes.md` | `02-root-cause-analysis.md` |
| `03-reality-check.md` | `03-dependency-assessment.md` |
| `05-options.md` | `05-options-analysis.md` |
| `06-plan.md` | `06-remediation-plan.md` |
| `07-decisions.md` | `07-decision-log.md` |
| `08-how-others-do-it.md` | `08-industry-practice-review.md` |
| `09-lifeboat-spec.md` | `09-secondary-pipeline-specification.md` |
| `10-manual-backup-runbook.md` | `10-sop-manual-baseline-export.md` |
| Proposed `lifeboat.yml` | Proposed `secondary-pipeline.yml` |
| Proposed `backup-rehearsal.yml` | Proposed `preprod-validation.yml` |
| Proposed R2 prefix `lifeboat/` | Proposed R2 prefix `secondary/` (`secondary/pipeline/…` and `secondary/manual/…`) |
| Proposed `sql/supabase/04_backup_auth_export.sql`, schema `backup_export` | Proposed `sql/supabase/04_auth_export_views.sql`, schema `auth_export` |

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Stage and mode identifiers read from `scripts/backup/lib/pipeline.ts` and `db-backup.yml`; console label from `src/ui` | §3, §4 |
| 2026-09-25 | claude | Every remediation document reviewed against this standard | Applied throughout `docs/remediation/` |

## 9. Related

- [06-remediation-plan.md](06-remediation-plan.md) §5.4: renaming the code identifiers.
- [07-decision-log.md](07-decision-log.md): RD-14.

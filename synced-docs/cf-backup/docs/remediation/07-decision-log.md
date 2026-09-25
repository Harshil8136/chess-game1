---
title: "cf-backup remediation — 07 Decision log (RD-1 to RD-14)"
status: draft
audience: [owner, ai, technical]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_docs: [README.md, 05-options-analysis.md, 06-remediation-plan.md, 09-secondary-pipeline-specification.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, decisions, owner]
---

# 07 — Decision log

> **TL;DR (non-technical):** Fourteen decisions that only the Owner can make. Each has a
> recommended default, and work proceeds on the default unless the Owner decides otherwise. Three
> are needed now: how to include authentication records (RD-1), the test resources for
> Pre-production Validation (RD-2), and a feature freeze until the recovery points are proven
> (RD-4). Every default can be revised later.

## 1. Decision register (defaults: reversible at review)

| ID | Decision | Default (applies unless the Owner decides otherwise) | Alternative | Required by |
|---|---|---|---|---|
| RD-1 | How to include authentication records (`auth.users`, `auth.identities`) | **Read-only views owned by `postgres`** that only the read-only export role may read; the Vault remains refused. See §2 | Export as `postgres`; the Auth Admin API; accept the gap | Stage 3 |
| RD-2 | Test resources for Pre-production Validation | **A 4th D1 database and a second, small R2 bucket without locks**, with a test token scoped to those two only. PostgreSQL runs in a container on the runner | An unlocked prefix in the archive bucket: cheaper, but the validation token could reach production recovery points | Stage 2 |
| RD-3 | May a decryption key reside in GitHub? | **No.** Weekly restore verification checks the downloaded ciphertext (header, size, checksum) and restores the plain exports produced in the same run. A person proves decryption with the offline recovery key: monthly for 3 months, then quarterly | A second "verification" key in GitHub: stronger weekly assurance, but whoever holds it with bucket read access can read recovery points | Stage 4 |
| RD-4 | Feature freeze on cf-backup | **Yes.** No new console, diagnostics or layout work until acceptance ([06](06-remediation-plan.md) §9). Only defects that prevent a recovery point are fixed. May lift after 7 passing scheduled days, with stabilization continuing | No freeze | All stages |
| RD-5 | Suspend the schedules until the Primary Pipeline is remediated | **Yes**: disable the schedule settings, **then** disable `db-backup.yml` in GitHub. *Corrected 2026-09-25: the first plan proposed commenting out the fallback schedule, which fails CI* | Continue the failing runs | Stage 0 |
| RD-6 | Pre-production Validation as staging | **Pre-production Validation serves as cf-backup's staging environment** (the Owner previously decided against a separate staging environment). It uses test resources at no cost | A dedicated staging environment | — |
| RD-7 | GitHub Actions budget for cf-backup | **A ceiling of 400 minutes a month** (estimate 330 to 380, falling to 250 to 300; [06](06-remediation-plan.md) §10). Above it: validation drops its weekly run, then runs only on runner changes | No ceiling | — |
| RD-8 | cf-admin's legacy export workflow (`backups.yml`) | **Disable now; delete it in a cf-admin commit once the Secondary Pipeline passes.** Contingency: if Stage 1 exceeds 48 hours, configure its four secrets in cf-admin and run it as is | Retain it | Stage 0 |
| RD-9 | External heartbeat monitor, independent of GitHub and Cloudflare | **Yes:** a free healthchecks.io check, pinged by the Secondary Pipeline (later also the Primary Pipeline) on success; it alerts if a day passes without a ping. Adds one secret (the ping URL), outside the four-secret limit | Rely on GitHub's failure notification and the Scheduler's staleness alerts | Stage 1 |
| RD-10 | `pg_read_all_data` for the read-only export role, to read `auth` | **No**, unless a test in the restore image shows the Vault remains refused | Grant it | — |
| RD-11 | Day 30: the future of the two pipelines | **Retain both; the Secondary Pipeline moves to weekly** (about 12 minutes a month) as an independent second path | Consolidate: the Primary Pipeline's export stages call the Secondary Pipeline's commands and the rest is removed; or retire the Secondary Pipeline | Stage 5 |
| RD-12 | The Secondary Pipeline as a second scheduled workflow | **Approve**, recorded in `RULES.md` rule 7 as an exception until RD-11. The `secondary/` prefix receives a 30-day bucket lock and a 35-day lifecycle rule | Keep "the only schedule is the fallback" | Stage 1 |
| RD-13 | Pre-flight policy (N5) | **Per store:** a store-specific failed check stops that store only; checks every store depends on (the key, R2) still stop all | `halt` (current): one failed check stops every store | Stage 2 |
| RD-14 | Nomenclature alignment in code, console and living documents ([11](11-terminology-standard.md)) | **Yes, once**, after the first passing production run and before the stabilization period ([06](06-remediation-plan.md) §5.4). Persisted values (`backup_runs.kind`, `error_code`, R2 layout, settings keys) stay unchanged; the console maps them to the new labels | Also migrate persisted values (needs a cf-admin migration: `backup_runs.kind` is constrained to `'backup','drill','prune'`); or rename during remediation (widens the change surface while the pipeline is unproven); or keep the code names | Stage 2 |

## 2. RD-1 in detail: authentication records

Today 6 accounts and 12 identities are in **no** recovery point. After a disaster, every
administrator would need to be re-invited. Until Stage 3, the Owner's weekly manual baseline export
([10](10-sop-manual-baseline-export.md)) is their only copy.

| Option | Description | Preserves passwords? | Vault remains refused? | Owner effort |
|---|---|---|---|---|
| **a. Read-only views owned by `postgres` (default)** | A small schema of views over `auth.users` and `auth.identities`, readable only by the export role | Yes (password hashes included) | Yes | Run one SQL file once |
| b. Export as `postgres` | Store the `postgres` connection string in GitHub | Yes | **No**: the runner could read the Vault | Change one secret |
| c. Auth Admin API | The runner lists users with the service key | **No**: every user resets their password | Yes, but a service key is stored in GitHub | Add one secret |
| d. `pg_read_all_data` (RD-10) | Grant the built-in read-all role | Yes | **Probably not**; untested | One SQL statement |
| e. Accept the gap | Re-invite every user after a disaster | — | Yes | None |

The views include password hashes, so the recovery points do as well. They are encrypted like
everything else.

## 3. RD-2 and RD-6 in detail: validation targets

Pre-production Validation needs targets that are not production. The default adds a 4th D1 database
(free; 10 allowed) and a second bucket (free up to 10 GB-month in total; validation uses
kilobytes), reached through a test token scoped to those two only. It is not a replica of
production; it is the only place the Primary Pipeline executes for real before production.

## 4. RD-8 in detail: retiring cf-admin's legacy export workflow

Its design is sound (it already avoids T1, T5 and L3), and its shape carries forward into the
Secondary Pipeline. Running it, however, requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` in cf-admin: production secrets where the plan of record
specifies none, plus a fifth secret. It also covers only `madagascar-db` and retains only GitHub
artifacts. The Secondary Pipeline performs the same function in cf-backup with the secrets already
configured.

## 5. RD-14 in detail: scope of nomenclature alignment

| In scope | Out of scope unless approved |
|---|---|
| Stage names and step ids (`doctor`, `seal` and others per [11](11-terminology-standard.md) §3) | `backup_runs.kind` values and their check constraint (cf-admin migration) |
| Run-type labels and the console's "Runner test" label | Existing `error_code` values in stored rows |
| Log prefixes and report wording | R2 object layout and evidence file names already written (bucket-locked) |
| Living documents: `docs/RESTORE.md`, `docs/OWNER-SETUP.md`, `README.md`, `main.md` | Dated records: `docs/plans/`, `docs/specs/`, `docs/records/` (frozen by convention) |

## 6. Owner actions (not decisions)

| When | Action | Time |
|---|---|---|
| Today | Verify the offline recovery key; ask the Vendor to do the same ([06](06-remediation-plan.md) 0.1, 0.2). **Nothing else in this plan compensates for a lost key** | 20 min |
| Today | Stop the scheduled runs, in order ([06](06-remediation-plan.md) 0.3) | 5 min |
| Today, then weekly | The manual baseline export ([10](10-sop-manual-baseline-export.md)) | 45 min |
| Stage 1 | Decrypt one Secondary Pipeline file; add the lock and lifecycle rules | 15 min |
| Stage 2 | Create the test resources; re-enable the workflow; one pre-flight run and one full run | 20 min |
| Stage 3 | Run one SQL file in the Supabase SQL editor | 5 min |
| Stage 5 | One recovery test from the archive bucket with the offline recovery key | 1 hour |

## 7. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | First review: RD-1 to RD-7 drafted | Defaults as in §1 |
| 2026-09-25 | claude | Second review: live schedule, key registry, cf-admin's legacy export workflow, workflow guards, pre-flight policy | RD-5 corrected; RD-8 to RD-13 added |
| 2026-09-25 | claude | Live Supabase grants and project list; cf-admin migration `0057` constraint on `backup_runs.kind` | RD-1 options; no spare project; RD-14 scope |

## 8. Related

- [05-options-analysis.md](05-options-analysis.md): the basis for these choices.
- [06-remediation-plan.md](06-remediation-plan.md): where each decision applies.
- [11-terminology-standard.md](11-terminology-standard.md): the naming RD-14 applies.

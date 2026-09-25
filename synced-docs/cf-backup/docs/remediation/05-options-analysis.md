---
title: "cf-backup remediation — 05 Options analysis (alternatives considered, and the selected approach)"
status: active
audience: [owner, ai, technical]
last_verified: 2026-09-25
verified_against: [code, infra, research]
owner: harshil
related_docs: [README.md, 02-root-cause-analysis.md, 06-remediation-plan.md, 07-decision-log.md, 08-industry-practice-review.md, 09-secondary-pipeline-specification.md, 11-terminology-standard.md]
tags: [cf-backup, remediation, options, decision]
---

# 05 — Options analysis

> **TL;DR (non-technical):** Five courses of action were assessed, from "fix and retry" to
> "rebuild from scratch". The selected approach combines three: **first a small, independent
> export pipeline that works (the Secondary Pipeline)**, then remediation of the main pipeline
> only behind Pre-production Validation that uses the real tools, then simplification of its core.
> The business is protected every day while the larger system is repaired, at no cost, and the
> "one new defect per production run" pattern ends.

## 1. Constraints

- **$0**: Workers Free, Supabase Free, and GitHub Actions' 2,000 free Linux minutes a month.
- **No staging environment** (owner decision).
- **Time to protection**: Supabase has no copy today, so every day of remediation is a day of
  exposure.
- **The four-secret limit** (`RULES.md` rule 3): no new secret without a decision.

## 2. Options

### 2.1 Option A — Fix and retry

Fix the three directories, the D1 limit and the CLI role problem, then dispatch another production
run.

| | |
|---|---|
| Resolves | The known defects |
| Cost, effort | $0; half a day |
| Risk | **High.** This is the cycle that failed six times. The next layer (the restore image, restore verification, finalization's data upload, the fallback schedule) is discovered in production, one run at a time |
| Assessment | **Rejected as a complete approach.** Its fixes remain necessary, within Stage 2 |

### 2.2 Option B — Pre-production Validation

A second workflow runs the Primary Pipeline's **real** commands (`scripts/backup/cli.ts`), in
order, with the real programs, on a GitHub runner, against test resources:

- **D1:** a dedicated test database (the 4th of 10 free), seeded with more than 5 tables, a
  full-text table and a few hundred rows.
- **PostgreSQL:** a local `supabase/postgres` container at the pinned version, seeded from a
  schema-only copy of the live `public` schema, including the `auth.jwt()` policy and the foreign
  keys into `auth`.
- **R2:** a separate test bucket without locks, so validation can never touch production
  recovery points.
- **age:** a temporary key pair; the job **decrypts** what it uploaded and compares row counts.

| | |
|---|---|
| Resolves | P1, P2 and P4 ([02](02-root-cause-analysis.md)); detects every defect in [04](04-defect-register.md) §A to §C before production |
| Cost, effort | $0; about 5 minutes per run; 1 to 2 days to build |
| Risk | Low. Only the production configuration (secrets, variables) remains untested; the capability checks in pre-flight diagnostics (L8) cover it |
| Assessment | **Selected**, as Stage 2 |

### 2.3 Option C — Simplify the core

1. PostgreSQL without the Supabase CLI: `pg_dump` in the pinned image, explicit schemas, no
   `--role`.
2. Restore verification leaves the daily run and becomes a weekly run that **downloads from the
   archive bucket**, so it tests what a real restore does.
3. Accurate, explicit results (L5, L6, L7, N1).
4. Feature freeze on the auxiliary components (heartbeat, live logs, meters, console) until
   acceptance.

| | |
|---|---|
| Resolves | T5, L1, L3, L4, L5 to L7, N1, N4; reduces the surface for future defects |
| Cost, effort | $0, fewer minutes; 1 to 2 days on top of B |
| Risk | Medium, as it changes code paths; low when each change lands with passing Pre-production Validation |
| Assessment | **Selected**, within Stages 2 and 4 |

### 2.4 Option D — Secondary Pipeline first *(added by the second review, 2026-09-25)*

B and C take days, during which Supabase has no copy. So first, a **small, independent export
pipeline** that uses only vendor tools and shell: `pg_dump` in the pinned image,
`wrangler d1 export`, `age`, and `wrangler r2 object put`. It verifies a restore in the same run and
fails explicitly. It shares no code with the Primary Pipeline and has no console integration.
Specification: [09](09-secondary-pipeline-specification.md).

| | |
|---|---|
| Resolves | The exposure itself: a daily, encrypted, restore-verified, off-site recovery point within 1 to 2 days, while B and C proceed |
| Precedent | The standard approach for teams of this size ([08](08-industry-practice-review.md) §2), plus restore verification. cf-admin's legacy export workflow already has this shape and avoided T1, T5 and L3; it lacked only its secrets |
| Cost, effort | $0; about 3 minutes per run; about one day to build; uses the existing two secrets and two variables |
| Risk | Low. The risk is scope growth into a second large system; the specification sets hard limits (one file, under 250 lines, no TypeScript, no console integration) |
| Assessment | **Selected**, as Stage 1, preceded the same day by a manual baseline export (Stage 0) |

### 2.5 Option E — Considered and rejected

| Option | Reason for rejection |
|---|---|
| Supabase Pro ($25/month) for platform backups | Violates the $0 constraint; its copies also remain inside Supabase (not off-site) |
| Export as the `postgres` role in CI | The simplest way to include `auth.users`, but the runner's secret could then read the Vault, which holds the key functions. Refused by design (plan of record doc 12 §5) |
| `pg_read_all_data` for the read-only export role | Opens every schema, probably the Vault as well. Rejected unless a test shows the Vault remains refused (RD-10) |
| A second free Supabase project as a restore target | No free slot: the organisation already has two projects. A local container provides the same assurance |
| `supabase start` (the full local stack) for daily restore verification | Pulls about ten images per run. Used monthly only, for authentication records (Stage 3) |
| Configure cf-admin's legacy export workflow with its four secrets | Fastest of all, but places production secrets in cf-admin (the plan of record prohibits it), adds a fifth secret, and covers only `madagascar-db` with GitHub artifacts. **Retained as the contingency** if Stage 1 exceeds 48 hours (RD-8) |
| Remove PostgreSQL restore verification | An unverified recovery point is an assumption, not a recovery point |
| Rebuild from scratch | The components that executed for real largely worked (pre-flight diagnostics, R2, age, D1 export, D1 restore verification). A rebuild reintroduces the same untested-path risk |

## 3. Selected approach

**D, then B, then C, in small verified steps, followed by a stabilization period.** In order: a
manual baseline export today; the Secondary Pipeline within 1 to 2 days; Pre-production
Validation; C's changes one at a time, each with passing validation; one production full run;
then 30 days of stabilization and a recovery test by a person. Stages, acceptance criteria and
owner checkpoints are in [06](06-remediation-plan.md).

*History: the first review (2026-09-25 morning) recommended B then C. The second review the same
afternoon placed D first, because B and C leave Supabase without a copy for days, and because two
export pipelines had already been built without producing a recovery point
([02](02-root-cause-analysis.md) §3).*

## 4. Subsidiary decision: may a decryption key reside in CI?

Weekly restore verification from the archive bucket (C.2) would need a private key to decrypt in
CI, and the design keeps the archive encryption key offline.

| Choice | Mechanism | Risk |
|---|---|---|
| **(ii) No — default** | Verification checks the ciphertext (header, size, checksum against the manifest) and restores the plain exports produced in the same run. A person proves decryption with the offline recovery key | Decryption is proven by a person, not weekly |
| (i) Yes | Each recovery point is also encrypted to a second "verification" key whose private half is a GitHub secret | Anyone holding that secret with read access to the bucket can read recovery points |

Recorded as RD-3 in [07](07-decision-log.md).

## 5. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Options A to C and E assessed against the defect register and the constraints | B then C recommended |
| 2026-09-25 | claude | Second review: exposure, cf-admin's legacy export workflow, public examples ([08](08-industry-practice-review.md)) | D placed first |

## 6. Related

- [06-remediation-plan.md](06-remediation-plan.md): the selected approach as stages.
- [07-decision-log.md](07-decision-log.md): the owner's decisions.
- [09-secondary-pipeline-specification.md](09-secondary-pipeline-specification.md): option D in detail.

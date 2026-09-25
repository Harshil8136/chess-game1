---
title: "cf-backup recovery — 05 Options (what was considered, and the choice)"
status: active
audience: [owner, ai, technical]
last_verified: 2026-09-25
verified_against: [code, infra, research]
owner: harshil
related_docs: [README.md, 02-root-causes.md, 06-plan.md, 07-decisions.md, 08-how-others-do-it.md, 09-lifeboat-spec.md]
tags: [cf-backup, recovery, options, decision]
---

# 05 — Options

> **TL;DR (non-technical):** There were five ways forward, from "patch it and try again" to
> "rewrite everything". The choice is to combine three: **first make a small, separate backup
> that works (the "lifeboat")**, then fix the main system only behind a rehearsal that uses the
> real tools, then simplify its core. This keeps the business protected every day while the
> bigger system is repaired, costs $0, and stops the "one new bug per run" pattern.

## 1. Constraints

- **$0**: Workers Free, Supabase Free, and GitHub Actions' 2,000 free Linux minutes a month.
- **No staging environment** (owner decision).
- **Speed**: Supabase has no copy today, so every day of repair is a day of exposure.
- **The four-key cap** (RULES.md rule 3): no new secret without a decision.

## 2. The options

### 2.1 A — Patch and run again

Fix the three folders, the D1 limit and the CLI role problem, then dispatch another real backup.

| | |
|---|---|
| Fixes | The known defects |
| Cost, effort | $0; half a day |
| Risk | **High.** This is the loop that failed six times. The next layer (the drill image, the drill, seal's data upload, the fallback) is found in production, one run at a time |
| Verdict | **Rejected as the whole answer.** Its fixes are still needed, inside Stage 2 |

### 2.2 B — A rehearsal job ("staging in a box")

A second workflow runs the **real** `scripts/backup/cli.ts` commands, in order, with the real
programs, on a GitHub runner, against test resources:

- **D1:** a dedicated test database (the 4th of 10 free), seeded with more than 5 tables, a
  full-text table and a few hundred rows.
- **Postgres:** a local `supabase/postgres` container at the pinned version, seeded from a
  schema-only copy of the live `public` schema, with the `auth.jwt()` policy and foreign keys
  into `auth`.
- **R2:** a separate test bucket with no locks, so it can never touch real backups.
- **age:** a throwaway key pair; the job **decrypts** what it uploaded and compares row counts.

| | |
|---|---|
| Fixes | P1, P2, P4 ([02](02-root-causes.md)); finds every defect in [04](04-defect-register.md) §A to §C before production |
| Cost, effort | $0; about 5 minutes a run; 1 to 2 days to build |
| Risk | Low. Only the production targets (secrets, variables) stay untested; the doctor's real checks (L8) cover them |
| Verdict | **Adopted**, as Stage 2 |

### 2.3 C — Simplify the core

1. Postgres without the Supabase CLI: `pg_dump` in the pinned image, explicit schemas, no `--role`.
2. The restore drill leaves the daily run and becomes a weekly run that **downloads from the
   bucket**, so it tests what a real restore does.
3. Fail loudly and truthfully (L5, L6, L7, N1).
4. Freeze the add-ons (heartbeat, live logs, meters, console) until done.

| | |
|---|---|
| Fixes | T5, L1, L3, L4, L5 to L7, N1, N4; shrinks the surface for future defects |
| Cost, effort | $0, fewer minutes; 1 to 2 days on top of B |
| Risk | Medium, because it changes code paths; low when each change lands with a green rehearsal |
| Verdict | **Adopted**, inside Stages 2 and 4 |

### 2.4 D — The lifeboat first *(added by the second review, 2026-09-25)*

B and C take days, and Supabase has no copy in the meantime. So first, a **small separate
workflow** that uses only the vendors' tools and shell: `pg_dump` in the pinned image,
`wrangler d1 export`, `age`, and `wrangler r2 object put`. It checks a restore in the same run and
fails loudly. It shares no code with the main runner and has no console link. Specification:
[09](09-lifeboat-spec.md).

| | |
|---|---|
| Fixes | The exposure itself: a daily, encrypted, restore-checked, off-site backup within 1 to 2 days, while B and C proceed |
| Precedent | It is what small teams run ([08](08-how-others-do-it.md) §2), plus a restore check. cf-admin's `backups.yml` is already this shape and avoided T1, T5 and L3; it only lacked secrets |
| Cost, effort | $0; about 3 minutes a run; about a day to build. Uses the existing two secrets and two variables |
| Risk | Low. The risk is it growing into a second big system; the specification sets hard limits (one file, under 250 lines, no TypeScript, no console) |
| Verdict | **Adopted**, as Stage 1. Before it, a manual backup by hand the same day (Stage 0) |

### 2.5 E — Considered and rejected

| Option | Why not |
|---|---|
| Supabase Pro ($25/month) for platform backups | Breaks the $0 rule. Its backups also stay inside Supabase (not off-site) |
| Back up as the `postgres` role in CI | Simplest way to include `auth.users`, but the runner's secret could then read the Vault, which holds the key machinery. Refused by design (plan of record doc 12 §5) |
| `pg_read_all_data` for the backup role | Opens every schema, probably the Vault too. Rejected unless a test shows the Vault stays closed (RD-10) |
| A second free Supabase project as a restore target | No free slot: the organisation already has two projects. A local container gives the same proof |
| `supabase start` (the full local stack) as the daily drill | It pulls about ten images every run. Used monthly only, for sign-in accounts (Stage 3) |
| Add the four secrets to cf-admin and run its `backups.yml` | Fastest of all, but puts production secrets in cf-admin (the plan of record forbids it) plus a fifth secret, and covers only `madagascar-db` and GitHub artifacts. **Kept as the fallback** if Stage 1 slips past 48 hours (RD-8) |
| Drop Postgres drills | A backup never restored is a hope, not a backup |
| Rewrite everything from scratch | The pieces that ran for real mostly worked (doctor, R2, age, D1 export, D1 drill). A rewrite brings back the same untested-path risk |

## 3. Decision

**D, then B, then C, in small verified steps, then soak.** In order: a manual backup today; the
lifeboat within 1 to 2 days; the rehearsal; C's fixes one at a time, each with a green
rehearsal; one real full backup; then 30 days of soak and a restore by hand. The stages,
acceptance criteria and owner checkpoints are in [06](06-plan.md).

*History: the first review (2026-09-25 morning) recommended B then C. The second review the same
afternoon added D in front, because B and C leave Supabase with no copy for days, and because two
backup systems had already been built without producing one file ([02](02-root-causes.md) §3).*

## 4. Sub-decision: may a key that decrypts backups live in CI?

The weekly drill from the bucket (C.2) would need a private key to decrypt in CI, and the design
keeps the backup key offline.

| Choice | How | Risk |
|---|---|---|
| **(ii) No, default** | The drill checks the ciphertext (header, size, checksum against the manifest) and restores the plain files exported in the same run. A person proves decryption with the recovery kit | Decryption is proven by a person, not every week |
| (i) Yes | Each backup is also encrypted to a second "drill" key whose private half is a GitHub secret | Anyone with that secret and read access to the bucket can read backups |

Recorded as RD-3 in [07](07-decisions.md).

## 5. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Options A to C and E weighed against the defect register and the constraints | B then C recommended |
| 2026-09-25 | claude | Second review: exposure, cf-admin's `backups.yml`, public examples ([08](08-how-others-do-it.md)) | D added in front |

## 6. Related

- [06-plan.md](06-plan.md): the chosen path as stages.
- [07-decisions.md](07-decisions.md): the decisions the owner makes.
- [09-lifeboat-spec.md](09-lifeboat-spec.md): option D in detail.

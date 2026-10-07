---
title: "cf-backup remediation — 07 Decision log (RD-1 to RD-15)"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-07
verified_against: [code, infra, live-mcp]
owner: harshil
related_docs: [README.md, 05-options-analysis.md, 06-remediation-plan.md, 09-secondary-pipeline-specification.md, 11-terminology-standard.md, 12-open-source-tool-assessment.md, 13-engine-consolidation-plan.md]
tags: [cf-backup, remediation, decisions, owner]
---

# 07 — Decision log

> **TL;DR (non-technical):** Fifteen decisions that only the Owner can make. **On 2026-09-27 the
> Owner asked for the best option on every open one; §0 records the outcome.** The central one is
> RD-15: the small Secondary Pipeline becomes the permanent backup engine, and the large Primary
> Pipeline is retired once the new arrangement is proven, instead of being repaired. Several other
> decisions existed only to support that repair, and fall away with it. The work that follows is
> [13](13-engine-consolidation-plan.md). Every decision can be revised later. §0.1 records the
> same afternoon's decisions on how the engine is started.

## 0. Decisions of 2026-09-27

The Owner instructed: "Select all best options." Each open decision was settled on the option below.
Where it differs from the §1 default, the reason is given. §1 keeps the original register as the
record of what was proposed.

| ID | Decided | Reason |
|---|---|---|
| RD-1 | **As applied** 2026-09-26: two functions owned by `postgres` (§2) | Already in production; the Secondary Pipeline restores the records daily |
| RD-2 | **Not needed.** No test resources are created | They served Pre-production Validation of the Primary Pipeline, which is retired instead of repaired (RD-15) |
| RD-3 | **Default: no decryption key in GitHub.** A person decrypts a real recovery point with an offline recovery key monthly for 3 months, then quarterly | Unchanged: a key in GitHub plus bucket read access would expose every recovery point |
| RD-4 | **Default, scoped: freeze on.** Allowed: defects that stop a recovery point, and the consolidation work in [13](13-engine-consolidation-plan.md). Lifts after 7 consecutive passing scheduled Secondary Pipeline runs | The consolidation *is* the recovery path now, so it cannot be frozen |
| RD-5 | **Applied** 2026-09-27: both schedule settings off (01:34 UTC); `db-backup.yml` and cf-admin's `backups.yml` disabled (about 02:00 UTC) | The schedule returns in [13](13-engine-consolidation-plan.md) B3, dispatching the Secondary Pipeline |
| RD-6 | **Superseded.** No Pre-production Validation. A change to the Secondary Pipeline's workflow or scripts is proven by a manual run the same day | The Secondary Pipeline verifies its own output on every run: a real restore, row counts against the source, and a checksum read-back from R2 |
| RD-7 | **Default: 400-minute ceiling** | Measured need is far below it: about 2 minutes a run, about 60 to 90 minutes a month ([13](13-engine-consolidation-plan.md) §6) |
| RD-8 | **Default:** delete cf-admin's `backups.yml` in a cf-admin commit once a **scheduled** Secondary Pipeline run passes. **Done** 2026-09-27 (cf-admin `cb331e5`), after the first GitHub-scheduled run (36325294293) and the first Scheduler-started run (36333172477) passed | Disabled since 2026-09-27; nothing depends on it |
| RD-9 | **Default, yes:** a free healthchecks.io check, pinged by the Secondary Pipeline after a passing verdict. Period 1 day, **grace 8 hours**, because GitHub starts this repository's scheduled runs 4 to 5 hours late | It is the only alarm that works when GitHub or Cloudflare itself is the problem. One secret, the ping URL; the step is skipped while the secret is absent |
| RD-10 | **Default: no** `pg_read_all_data` | RD-1 already covers the authentication records without it |
| RD-11 | **Superseded by RD-15: consolidate.** One engine, the Secondary Pipeline | See RD-15 |
| RD-12 | **Approved, and permanent.** The Secondary Pipeline's own schedule stays as the fallback once the Scheduler dispatches it ([13](13-engine-consolidation-plan.md) B3). The bucket lock and lifecycle rules on `secondary/` remain an Owner task | It is now the only engine, not an interim exception |
| RD-13 | **Moot.** | The Secondary Pipeline already isolates stores: one store's failure never stops the others. The Primary Pipeline's pre-flight policy leaves with it |
| RD-14 | **Narrowed:** rename only what survives the retirement: console labels and living documents. Code that [13](13-engine-consolidation-plan.md) B5 deletes is not renamed. Persisted values stay as they are | Renaming code about to be deleted is wasted work and risk |
| RD-15 | **Option B (default): no third-party engine; the Secondary Pipeline is the permanent engine; the Primary Pipeline's runner is retired after acceptance.** Not option (c) | The smallest proven path ([12](12-open-source-tool-assessment.md) §6): about 300 lines against about 44,000, no new secrets, already producing verified recovery points daily |

**Open questions from [12](12-open-source-tool-assessment.md) §8, answered the same day:**

| Question | Answer |
|---|---|
| Does anything use Supabase Storage (files)? | **No.** Live check 2026-09-27: 0 buckets, 0 objects. Nothing outside the database needs a copy. Revisit if files ever move there |
| A copy outside the Cloudflare account? | **The 14-day GitHub artifact is that copy** (encrypted, the repository's maximum retention). A third location would need an account and two secrets; not now |
| How often? | **Daily** (RPO 24 hours). About 60 minutes a month; every 6 hours would use about 240 |

## 0.1 Decisions of 2026-09-27 afternoon: the Worker starts the engine

The Owner reported backups "still completely failing" and asked for a permanent fix. The engine was
working; what failed was **starting** it. Its only trigger was GitHub's schedule: the first scheduled
run, due 08:41 UTC, started at 14:16 UTC (5 h 35 min late), and GitHub documents that scheduled runs
may also be dropped. The console's "Run now" and Scheduler could start only the retired Primary
Pipeline. The Owner approved the plan below and answered its three questions.

| Item | Decided | Reason |
|---|---|---|
| Primary trigger | **The Worker's Scheduler dispatches `secondary-pipeline.yml` daily at 09:17 UTC** (03:17 in Aguascalientes; Owner's choice), grace 2 hours; "Run now" starts it too | cf-admin's five-minute Cloudflare cron runs on time (verified 2026-09-27 after the CPU fix) |
| Fallback trigger | **GitHub's own schedule stays, moved to 11:41 UTC.** Its first step, the `fallback guard`, stands the run down when a run has already succeeded that UTC day, and fails open | Two independent triggers, each able to back up alone. Recorded as `skipped` (`fallback_not_needed`), never a failure |
| B0.1 | **Met** by run 36325294293 (GitHub's schedule, 14:16 UTC). B3 adds its own proof: a run the Scheduler dispatched passes | The schedule is no longer the primary trigger, so it is not the acceptance test |
| Workflow size | **320 lines** (09 §2 said 300) | The guard step and the heartbeat step; still small enough to read in one sitting. The guard enforces it |
| Correlation | **One optional input, `request_id`, used only in `run-name`** | The Worker finds the run it dispatched by the id in the run's name, whether or not GitHub returns the run id |
| Heartbeat (RD-9, B0.4) | **Built now**: the `heartbeat` step pings `HEARTBEAT_PING_URL` after a passing verdict; nothing while the secret is unset | The Owner creates the healthchecks.io check (period 1 day, grace 8 hours) and the secret |
| Today's recovery point | **A manual run now** (Owner's choice): run 36327225356, passed 14:50 UTC | A verified recovery point for today regardless of the schedule |
| Live settings | **Claude applies them** directly to the `backup:config` row, with a notice alert, as on 2026-09-27 01:34 UTC (Owner's choice) | The change is made and verified in the same session as the code that uses it |

## 0.2 Decision of 2026-10-07: one exception to RD-4, a console export of a whole Supabase project

The Owner asked for the console to find every active Supabase and D1 database and export a chosen
one, so the legacy Supabase project could be copied and then paused. Building a general database
list into the engine is feature work that RD-4 still freezes (the fallback run failed on
2026-10-05, so the 7 passing days restart). The Owner chose the narrow exception below, in the
thread that did the work.

| Item | Decided | Reason |
|---|---|---|
| Scope | **Run now → Export a Supabase project**, now. The full Supabase and D1 database list waits for the freeze to lift | Copying the legacy project is the only thing blocked; the rest is not urgent |
| Engine | **Untouched.** A separate workflow, `supabase-project-export.yml`, runs the existing full export tool | A change here cannot stop a recovery point |
| Key | **A temporary fifth key**, `SUPABASE_ACCESS_TOKEN` (a GitHub secret): created to expire after one day, deleted after each export, absent otherwise (`RULES.md` rule 3) | The export needs the Supabase Management API; the account token reaches every project, so it must not stay |
| The live project | **Refused**: the export stops when the project holds the backup key | The engine already copies it daily, and the account token must never copy the key |
| Storage | The encrypted file in the backups bucket under `project-exports/`, not bucket-locked | A one-off copy, never a backup or a recovery point |

## 1. Decision register (defaults: reversible at review)

| ID | Decision | Default (applies unless the Owner decides otherwise) | Alternative | Required by |
|---|---|---|---|---|
| RD-1 | How to include authentication records (`auth.users`, `auth.identities`) | **Read-only access owned by `postgres`** that only the read-only export role may use; the Vault remains refused. **Applied 2026-09-26** as two functions rather than views (§2) | Export as `postgres`; the Auth Admin API; accept the gap | Stage 3 |
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

The exports include password hashes, so the recovery points do as well. They are encrypted like
everything else.

**As applied (2026-09-26).** Option a, with one refinement: two `SECURITY DEFINER` functions,
`auth_export.users()` and `auth_export.identities()`, owned by `postgres`, with an empty
`search_path`, executable by the read-only export role only (`sql/supabase/04_auth_export.sql`,
migration `cf_backup_auth_export`). A view over `auth.users` records a dependency on each column it
reads, and PostgreSQL then refuses to drop or retype those columns ("cannot alter type of a column
used by a view or rule"), so a view could make a Supabase Auth upgrade fail. A function whose body
is plain SQL records no such dependency. Both behaviours were reproduced locally before the change.
Live checks afterwards: only the export role may call the functions (`anon`, `authenticated`,
`service_role` and `cf_astro_writer` may not), and the export role still has no access to the
Vault. The Secondary Pipeline exports both tables daily as the store `postgres-auth`
([09](09-secondary-pipeline-specification.md)).

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

*Updated 2026-09-27 for the decisions in §0. The current, ordered list is [README](README.md) §7.*

| When | Action | Time |
|---|---|---|
| Now | Verify the offline recovery key by decrypting one Secondary Pipeline file; ask the Vendor to do the same ([06](06-remediation-plan.md) 0.1, 0.2, 1.3). **Nothing else in this plan compensates for a lost key** | 20 min |
| ~~Today~~ | ~~Stop the scheduled runs, in order ([06](06-remediation-plan.md) 0.3)~~ Done 2026-09-27 | — |
| ~~Today, then weekly~~ | ~~The manual baseline export ([10](10-sop-manual-baseline-export.md))~~ Superseded 2026-09-26 by the Secondary Pipeline | — |
| Now | Add the lock and lifecycle rules on `secondary/` (RD-12) | 5 min |
| Now | Create the healthchecks.io check and store its ping URL as a GitHub secret (RD-9; [13](13-engine-consolidation-plan.md) B0) | 10 min |
| ~~Stage 2~~ | ~~Create the test resources; re-enable the workflow; one pre-flight run and one full run~~ Not needed: RD-2, RD-15 | — |
| ~~Stage 3~~ | ~~Run one SQL file in the Supabase SQL editor~~ Done for the Owner on 2026-09-26 through the Supabase connector | 0 min |
| Acceptance | One recovery test from the archive bucket with the offline recovery key ([13](13-engine-consolidation-plan.md) B4) | 1 hour |

## 7. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | First review: RD-1 to RD-7 drafted | Defaults as in §1 |
| 2026-09-25 | claude | Second review: live schedule, key registry, cf-admin's legacy export workflow, workflow guards, pre-flight policy | RD-5 corrected; RD-8 to RD-13 added |
| 2026-09-25 | claude | Live Supabase grants and project list; cf-admin migration `0057` constraint on `backup_runs.kind` | RD-1 options; no spare project; RD-14 scope |
| 2026-09-26 | claude | RD-1 applied: views and functions compared against Auth-style column changes on a local PostgreSQL 16 with Supabase's privileges reproduced; live privilege checks after the migration | §1, §2 |
| 2026-09-27 | claude | The Owner's instruction to settle every open decision on its best option; live checks: both workflows `disabled_manually`, `backup:config` rev 4 with both schedules off, Supabase Storage empty (0 buckets, 0 objects), the `tick-deadman` schedule's start times (4 to 5 hours late) | §0 |
| 2026-10-07 | claude | The Owner's choice on a decision card in the resource-usage thread ("Old project now"); the engine workflow and its guard unchanged in the same commit | §0.2 |

## 8. Related

- [05-options-analysis.md](05-options-analysis.md): the basis for these choices.
- [06-remediation-plan.md](06-remediation-plan.md): where each decision applies.
- [11-terminology-standard.md](11-terminology-standard.md): the naming RD-14 applies.
- [12-open-source-tool-assessment.md](12-open-source-tool-assessment.md): the basis for RD-15.
- [13-engine-consolidation-plan.md](13-engine-consolidation-plan.md): the work RD-15 starts.

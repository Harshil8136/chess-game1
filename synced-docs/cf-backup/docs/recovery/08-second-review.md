# 08: Second review (2026-09-25, afternoon)

A second, independent pass over [01](01-what-happened.md) to [07](07-decisions-for-owner.md),
done the same day, against the live systems and not only the documents:

- the GitHub Actions logs of every backup run, in cf-backup and in cf-admin;
- the `backup_runs` table and the `backup:*` settings rows in D1;
- the D1 databases, and the backups bucket;
- the Supabase roles, grants and catalog (read-only queries);
- the runner code at `da38ddf`, read by two separate code audits;
- a web research pass on how other teams do this, summarised in [09](09-how-others-do-it.md).

**Verdict on 01 to 07:** the technical defects they list are real and correctly explained. But
they miss four things. **A sixth run failed after they were written**, because the schedule is
still live. **Four more scheduled runs will fail within four days.** There are **three more
truthfulness defects** and three factual errors. And the biggest risk was never checked: **no one
has confirmed a copy of the backup key outside Supabase.**

## In short

1. Six real runs, six failures, **zero backup files**, and a seventh failure is due tomorrow.
2. The daily schedule and the Monday fallback are still on. 06's ground rule 1 ("no real backup
   is dispatched until the rehearsal is green") was never put into effect.
3. The key registry shows **0 recovery-kit confirmations and 0 reveals**. If the owner did not
   save the key when it was created, the only copy is in Supabase Vault, inside the database the
   backups are meant to protect.
4. The root cause goes one level deeper than "nothing ran the real pipeline". **In ten days, two
   backup systems were built and neither has produced one file.** Work was judged done when its
   tests and reviews passed, never when a restorable file existed.
5. The fix is to make one real, restorable, off-site backup exist first, by the simplest means,
   and then repair the larger system around it. That is [10](10-robust-plan.md).

## New since 01 was written: run 6

| # | When (UTC) | GitHub run | Started by | Result | Cause |
|---|---|---|---|---|---|
| 6 | 09-25 09:26 | 36118407196 | **the schedule** (slot `2026-09-25T09:17Z/supabase`) | failed | T1 again: `plain/postgres/` did not exist |

Evidence (job log):

```
doctor pre-flight policy: halt            (all 20 checks passed before this line)
postgres:dump $ supabase db dump --db-url *** -f …/cf-backup/plain/postgres/roles.sql --role-only
postgres:dump [err] failed to open dump file: NotFound: FileSystem.writeFile (…/plain/postgres/roles.sql)
postgres:dump postgres: 0 tables, 0 rows in the dump, 0.9 s
seal ##[error]postgres: restore into public.ecr.aws/supabase/postgres:17.6.1.104@… failed (no dump to drill)
seal ##[error]4 expected file(s) missing: data/postgres-roles.sql.gz.age, …
```

The `backup_runs` row reads `status failed`, `error_code drill_failed`, `data_bytes 0`,
`billed_minutes 2`. **The error code is wrong:** the dump failed, not the drill (N1 below).

Nothing in run 6 is new as a defect. It matters because it shows that **the schedule is live, and
every scheduled run will fail the same way until T1 is fixed.**

## What will run next if nothing changes

The schedule in the `backup:config` settings row: full backup on Sundays, Supabase-only Monday to
Saturday, both at 09:17 UTC, both enabled.

| When (UTC) | What starts it | What it will do |
|---|---|---|
| Sat 09-26 09:17 | cf-backup's tick, Supabase slot | Fail at T1, like run 6 |
| Sun 09-27 09:17 | cf-backup's tick, full slot | Fail at T1, T2 and, behind them, L1 |
| Sun 09-27 09:17 | cf-admin's own `backups.yml` (see N8) | Fail in its pre-flight: cf-admin has none of the secrets it needs |
| Mon 09-28 12:43 | `db-backup.yml`'s fallback cron (D-5) | Start a full backup **whatever the schedule settings say**, and fail |
| Every day | the tick's stale-backup alerts | Keep firing. They are correct, and they cannot be switched off |

**06 said to comment out the fallback cron. That would fail CI**: the workflow guard requires the
`schedule:` trigger (`scripts/backup/lib/workflow-guards.ts:195-198`). The fallback ignores the
schedule flags (`scripts/backup/lib/plan.ts:57`). It stands down only when there is no active key
or when a good full backup is under 8 days old (`run-records.ts:96-98,227-237`). The working way to
stop everything is in [10](10-robust-plan.md), Stage 0: turn the schedule flags off first, then
disable the workflow in GitHub, in that order. The other order makes every tick's dispatch fail
with an alert.

## The biggest unchecked risk: the backup key

Backups are encrypted with `age` to a public key. The private key is kept in Supabase Vault. By
design (plan of record doc 09, K-5), it is **shown once at creation**, and the Owner and the
Vendor each save it in their own password manager: the "recovery kit". The kit is the only way to
open the backups if the Supabase project is lost.

The `backup:key-registry` settings row, read on 2026-09-25:

| Field | Value |
|---|---|
| Keys | 1, active, created 2026-09-25 03:19 UTC by the Owner |
| `reveals` | **none** (the Vendor has never revealed the key, so the Vendor has no kit) |
| `kitConfirmations` | **none** |
| `restoreProofs` | none |

So at most one offline copy exists: the Owner's, if it was saved when the key was shown. **If it
was not, every backup cf-backup ever makes will be unreadable in the one disaster it exists for**
(losing the Supabase project). Supabase is also the store with no other copy at all. The first
analysis mentions this in one line at the end of [07](07-decisions-for-owner.md). It belongs at
the top, and it is Stage 0, step 1 of the new plan.

## Checked again, and confirmed

| Claim | Re-checked by | Result |
|---|---|---|
| T1: three output folders are never created | Code audit; run 6 | **Confirmed.** Paths are built at `context.ts:68,69,77`. The only `ensureDir` calls are `commands.ts:103,274,300,333`. The tools write at `wrangler.ts:21`, `pg-backup.ts:181` and `age.ts:87` |
| T2: D1 allows at most 5 `UNION ALL` parts | Live query, 2026-09-25 | **Confirmed.** `SELECT 1 UNION ALL … SELECT 6` on `madagascar-db` gives `too many terms in compound SELECT` (code 7500). The limit is set in Cloudflare's runtime (`SQLITE_LIMIT_COMPOUND_SELECT, 5`) and is **not on D1's limits page** ([09](09-how-others-do-it.md)) |
| `madagascar-db` has 32 tables | Live query | **Confirmed** (32, no virtual tables) |
| T3: step-output names | Code; run 6 | **Fixed** in cf50a5c; run 6's `pg_ok` gate opened |
| T5: the Supabase CLI runs `SET ROLE postgres` | CLI source at tag v2.117.0 | **Confirmed.** `dump_schema.sh`, `dump_data.sh` and `dump_role.sh` all pass `--role "postgres"` |
| The backup role cannot become `postgres` | Live: `pg_has_role(…,'postgres','MEMBER')` | **Confirmed**: false |
| T6: no `USAGE` on schema `auth` | Live: `has_schema_privilege` | **Confirmed**: false. 6 sign-in accounts are outside every backup |
| The role can read every table it should | Live: `has_table_privilege` | **Confirmed**: 21 of 21 tables in `public` and `supabase_migrations`; no sequences there; the role has `BYPASSRLS` |
| The Vault is refused | Run 6's doctor | **Confirmed**: `42501 permission denied for schema vault` |
| L3: the drill image lacks `auth.jwt()` | Live: 1 policy uses it; image source | **Confirmed.** The bare image also creates only 5 of the 27 `auth` tables on the live database, so sign-in data cannot be restored into it either ([09](09-how-others-do-it.md)) |
| L7: export errors are collected silently | Code audit | **Confirmed**: `d1-backup.ts:115-182` and `pg-backup.ts:108-120,190-192` never log them |
| L8: the doctor proves reachability only | Code audit | **Confirmed**: the D1 check is `SELECT 1` (`doctor.ts:327-340`) |

## Corrections to 01 to 07

1. **Size.** 01 and 03 say `madagascar-db` is "about 16.5 MB". The D1 API reports its file as
   **2.5 MB** (2026-09-25). The 16.5 MB was the step's network counter, not the export. The three
   D1 databases hold about **2.8 MB** together, and the Postgres database is **17 MB** (20 tables
   in `public`, about 1,900 rows by the planner's estimate).
2. **L5's fix would not have caught runs 3 and 4.** 04 says seal should read `steps.jsonl`. But
   the doctor's step record is written with exit code 0 when its body returns
   (`log.ts:242-254`), and the crash came afterwards, while it wrote its outputs
   (`commands.ts:242`). **The fix that works:** pass each step's `${{ steps.<id>.outcome }}` into
   seal's environment, and fail the run on any `failure`. (`JOB_STATUS` does not help: with
   `continue-on-error` it always reads `success`. Seal uses it only to detect a cancel,
   `commands.ts:408`.)
3. **L6 is worse than 04 says.** `checkIntegrity` passes whenever a drill object exists
   (`verdict.ts:78-79,168-179`). Every command writes a drill object, even when nothing was
   restored (`commands.ts:288,354`; `d1-backup.ts:203-205`; `pg-backup.ts:269-271`). Run 6 was
   Postgres-only and had no dump, and its report still printed "Postgres restored with
   ON_ERROR_STOP".
4. **L2 misses a third call site:** `d1-backup.ts:298`, the monthly real-path drill's row counts.
   Fixing only `:122` and `:177` leaves that drill broken on `madagascar-db`.
5. **L13 is partly wrong.** The tick's dispatch works: it started run 6. The fallback cron has
   never fired.
6. **Decision 5's method does not work** (see above). The intent is right; the mechanism changes.

## New defects

| # | Defect | Where | Effect |
|---|---|---|---|
| N1 | **The error code blames the wrong step.** A failed dump still produces a drill result (`{ok:false, problems:['no dump to drill']}`), so the verdict's "export failed" branch is never reached, and the first finding maps to `drill_failed`. The real cause survives only inside the manifest. | `pg-backup.ts:269-271`; `commands.ts:351-354`; `verdict.ts:150-153`; `seal.ts:99-112` | Every failed dump reads as a failed drill. The tests that cover this use a hand-built `drill: null` that production never produces (`test/runner/seal.test.ts:480-500`): the P1 pattern from 02 again |
| N2 | **"Integrity pass" printed for stores that never ran** | See correction 3 | A report can say Postgres restored when nothing was dumped |
| N3 | **The real-path drill's count query has the same 5-part problem** | `d1-backup.ts:298` | The monthly D1 drill fails on `madagascar-db` |
| N4 | **D1 depends on the Supabase CLI download.** The `supabase cli` step has no `continue-on-error`, and the `d1` and `postgres` conditions carry an implicit `success()` | `db-backup.yml:104-108,121,137` | A failed CLI install skips the D1 backup too |
| N5 | **One failed check stops every store.** The default pre-flight policy is `halt` | `doctor.ts:599,707-716` | "Supabase unreachable" also stops D1. That contradicts the workflow's own header (`db-backup.yml:8-10`). It is an owner decision, not a bug |
| N6 | **The live schedule and fallback** | See above | A failed run a day, and a failure alert each time |
| N7 | **The runner's own `pg_dump` is version 16.** GitHub's `ubuntu-24.04` image ships PostgreSQL 16 client tools, and `pg_dump` refuses a newer server | Runner image | Harmless today (the runner uses the pinned 17 image in docker). It matters for any simpler workflow: `pg_dump` must run from the 17 image, never from `/usr/bin` |
| N8 | **An older backup workflow is still scheduled, in cf-admin.** `.github/workflows/backups.yml` (the "bridge", built 2026-09-15, rebuilt 2026-09-22) runs on Sundays at 09:17 UTC, the same minute as cf-backup's full backup | cf-admin repo | Both of its runs failed at the pre-flight: the secrets were never added to cf-admin. It will fail again on Sunday |

## The root cause, one level deeper

01 and 02 say the root cause is that **nothing ran the real pipeline before production did.** That
is true, and their process causes (P1 to P8) stand. But it is a symptom of something larger. The
record shows it:

- **Two backup systems in ten days, zero backup files.** cf-admin's `backups.yml` was built on
  09-15 and rebuilt on 09-22. It is well designed and it avoids T1, T5 and L3: it creates its
  folders, runs `pg_dump` directly with an explicit schema, and stubs `auth.jwt()` for its drill.
  **It never ran, because its secrets were never added.** Then cf-backup was built from 09-23 to
  09-25, and it has failed six times.
- **"Done" meant code, not a backup.** Every task in both builds closed on "tests pass, review
  approved". None closed on "an encrypted file is in the bucket, and it restores". The one thing
  that proves a backup system works was never an acceptance test for any task.
- **The first real run came last.** It came after about 25,000 lines of Worker code, 17,500 lines of
  console and 8,700 lines of runner (with about 35,000 lines of tests). A green run needs about 15
  stages to be right the first time they meet real tools. Each failure hides the next (02, P2).
  In the industry this is called big-bang integration. It is known to fail this way.
- **What is being protected:** 17 MB of Postgres and 2.8 MB of D1. Small teams protect that with a
  workflow of 30 to 120 lines ([09](09-how-others-do-it.md)). That is not a reason to throw
  cf-backup away: its console, alerts and evidence have real value. It is a reason to **have a
  backup first**, and to build everything else on top of one that already works.

So the plan must do more than 06's "test the pipeline for real". **It must make a restorable,
off-site, encrypted backup exist within a day, by the smallest proven means, and keep it running
while the main pipeline is repaired.** Practitioners call that the walking skeleton
([09](09-how-others-do-it.md)).

## Exposure today (2026-09-25)

| What | Copies outside the primary | What protects it today |
|---|---|---|
| Supabase: the app's data and 6 sign-in accounts | **0** | Nothing. The Free plan has no platform backups |
| D1: `madagascar-db`, `chatbot-kb`, `whatsapp-chatbot` | **0 off-site** | Time Travel: 7 days of point-in-time restore on the Free plan, inside the same account. It restores in place. It is not documented to survive a deleted database or a lost account |
| The backup key | Vault, plus an unconfirmed kit | Nothing confirmed |

## Sources for this review

- GitHub Actions: runs 35953834471, 35958942742, 36089730779, 36090273258, 36092596416,
  36118407196 (cf-backup); 35012389113, 35580420378 (cf-admin `backups.yml`).
- D1 (read-only): `backup_runs`; the settings rows `backup:config`, `backup:status` and
  `backup:key-registry`; `sqlite_master` of all three databases; the 6-part `UNION ALL` test.
- Supabase (read-only): `pg_roles`, `pg_has_role`, `has_schema_privilege`, `has_table_privilege`,
  `pg_policies`, `pg_database_size`, `pg_namespace`, `pg_extension`.
- Code: cf-backup at `da38ddf`; cf-admin `.github/workflows/backups.yml` at the head of `main`.
- The outside facts (the Supabase CLI source, the D1 runtime limit, the runner image) are cited in
  [09](09-how-others-do-it.md).

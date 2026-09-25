# Backup recovery: root cause and plan (2026-09-25)

**Status: cf-backup has never produced a backup.** Five real runs so far; all five failed
(one of them was reported as a pass even though it had failed). Nothing encrypted has ever reached
the backup bucket. The D1 databases still have Cloudflare's own 7-day Time Travel. The Supabase
database has no copy anywhere: Supabase takes no backups on the Free plan.

This folder is the investigation and the plan. Each claim is backed by a log line, a line of code,
a read-only live check or an official document, and is cited where it is made.

## What is broken, in plain words

1. **The pipeline never creates the folders it writes into.** The D1 export, the Postgres dump
   and the encryption step each hand an output path to an outside tool (wrangler, the Supabase
   CLI, age). Those tools do not create missing folders, and nothing in our code creates them
   first. Every real run that reached those steps would fail. The last one did, in all three
   places ([01](01-what-happened.md)).
2. **The Postgres dump cannot work with the role we gave it, even after the folder fix.** The
   Supabase CLI's dump always switches to the `postgres` role inside the session. Our read-only
   backup role is not allowed to do that (checked on the live database). All five dump commands
   would fail on the next run ([04](04-latent-defects.md), L1).
3. **The D1 row counts fail on the main database.** D1 allows at most 5 parts in one `UNION ALL`
   query (tested live). Our count and fingerprint queries join one part per table, and
   `madagascar-db` has 32 tables. That database would still fail after the folder fix (L2).
4. **The restore drill for Postgres restores into an image that lacks parts of Supabase.** One of
   our security policies uses `auth.jwt()`, and the bare drill image does not have that function
   (L3).
5. **Sign-in accounts (`auth.users`) are not backed up.** The backup role cannot open the `auth`
   schema, and Supabase does not let us grant that access
   ([07](07-decisions-for-owner.md), decision 1).

## Why this kept happening (the real root cause)

**Nothing ever ran the real pipeline before production did.** Every test replaces the outside
tools with fakes. The fakes are more forgiving than the real tools: the fake wrangler, the fake age
and the fake Supabase CLI all create missing folders, and the fake D1 is plain SQLite with no
5-part limit. About 3,300 tests passed on code that could not write one real file. No CI job runs
the real tools, there is no staging, and reviews read diffs rather than runs. So each real run
found exactly one new layer of defects and stopped there, hiding the next layer. Meanwhile the
week's effort went into the console, diagnostics and a storage-layout change, all built on a
pipeline that had never worked once ([02](02-root-causes.md)).

## The recommended plan

**Prove it in rehearsal first, then in production.** Details are in [06](06-plan.md).

| Phase | What | Done when |
|---|---|---|
| 0 | Stop dispatching real backups. Build a **rehearsal job**: the real commands and real tools on a GitHub runner, against a test D1 database, a local Supabase Postgres image, a separate test bucket and a test age key. | The rehearsal job runs on every runner change and is red today for the known defects. |
| 1 | Fix the known defects (folders, D1 5-part limit, `pg_dump` run directly instead of through the Supabase CLI, a drill shim for `auth.jwt()`, truthful verdicts). | Rehearsal green; then **one real full backup green**, with its files in the bucket. |
| 2 | Back up sign-in accounts (the owner's choice, decision 1). | `auth.users` rows are in the backup and restore in rehearsal. |
| 3 | Take the restore drill out of the backup run: the daily backup only exports, encrypts and uploads. A separate weekly drill downloads from the bucket and restores. | The weekly drill restores from the bucket, using the real download and decrypt path. |
| 4 | Soak, then a real restore by hand. | See "Done" below. |

## What the owner must decide or do

Seven decisions, each with a recommended default, are in [07](07-decisions-for-owner.md). The ones
that block work:

- **Decision 1:** how to back up sign-in accounts (default: read-only views owned by `postgres`,
  which keep the Vault refused).
- **Decision 2:** the test resources for the rehearsal job (default: a 4th D1 database and a
  second bucket, both free).
- **Decision 4:** a feature freeze on cf-backup until "Done" is met (default: yes).

Owner actions later: run one SQL file in the Supabase SQL editor (Phase 2), and follow the restore
guide once by hand (Phase 4).

## How "done" will be proven

All of the following, with links recorded in [06](06-plan.md):

1. The rehearsal job is a required check and is green on every runner change.
2. The first real full backup is green, and its encrypted files and manifest are in the bucket.
3. **7 consecutive scheduled daily backups are green**, started by the schedule, not by hand.
4. One weekly drill, one `check` run and one monthly real-path D1 drill are green.
5. **A real restore from the bucket, done by hand with the recovery kit** on a machine other
   than the runner. It must reproduce the row counts in the manifest for all three D1 databases
   and for Postgres, including `auth.users`.
6. 30 days with no missed scheduled backup (the dead-man alert stays silent).

## Files

- [01-what-happened.md](01-what-happened.md): every real run, the exact evidence line and the cause.
- [02-root-causes.md](02-root-causes.md): technical and process root causes.
- [03-reality-check.md](03-reality-check.md): each outside service, what we assumed and what is true.
- [04-latent-defects.md](04-latent-defects.md): defects that have not failed yet, with file:line and fix.
- [05-options.md](05-options.md): the options, including a redesign, and the recommendation.
- [06-plan.md](06-plan.md): phases, tasks, acceptance criteria, owner checkpoints, reporting.
- [07-decisions-for-owner.md](07-decisions-for-owner.md): decisions only the owner can make.

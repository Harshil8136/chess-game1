# Backup recovery: root cause and plan (2026-09-25)

**Status: cf-backup has never produced a backup.** Six real runs so far; all six failed (one of
them was reported as a pass even though it had failed). The sixth was started by the schedule on
2026-09-25 at 09:26 UTC, after the first analysis was written: **the schedule is still on, and every
scheduled run fails.** Nothing encrypted has ever reached the backup bucket. The D1 databases still
have Cloudflare's own 7-day Time Travel. The Supabase database has no copy anywhere: Supabase takes
no backups on the Free plan. And no one has yet confirmed a copy of the backup key outside Supabase.

This folder is the investigation and the plan. Each claim is backed by a log line, a line of code,
a read-only live check or an official document, and is cited where it is made. Files 01 to 07 are
the first analysis. Files 08 to 12 are a second review done the same afternoon, research on how
other teams do this, and **the current plan, [10](10-robust-plan.md)**, which replaces
[06](06-plan.md) where they differ.

## Start here

| You are | Read |
|---|---|
| The owner, today | [10](10-robust-plan.md), Stage 0, then [12](12-manual-backup-today.md) |
| Deciding | [10](10-robust-plan.md) (decisions D8 to D13) and [07](07-decisions-for-owner.md) (decisions 1 to 7) |
| The engineer | [08](08-second-review.md), [10](10-robust-plan.md), [11](11-lifeboat.md), then [04](04-latent-defects.md) |
| Asking "why did this happen?" | [08](08-second-review.md) (root cause), [02](02-root-causes.md), [09](09-how-others-do-it.md) |

## What is broken, in plain words

1. **The pipeline never creates the folders it writes into.** The D1 export, the Postgres dump
   and the encryption step each hand an output path to an outside tool (wrangler, the Supabase
   CLI, age). Those tools do not create missing folders, and nothing in our code creates them
   first. Runs 5 and 6 failed on this ([01](01-what-happened.md), [08](08-second-review.md)).
2. **The Postgres dump cannot work with the role we gave it, even after the folder fix.** The
   Supabase CLI's dump always switches to the `postgres` role inside the session. Our read-only
   backup role is not allowed to do that (checked on the live database). All five dump commands
   would fail on the next run ([04](04-latent-defects.md), L1).
3. **The D1 row counts fail on the main database.** D1 allows at most 5 parts in one `UNION ALL`
   query (tested live twice). Our count and fingerprint queries join one part per table, and
   `madagascar-db` has 32 tables. That database would still fail after the folder fix (L2, N3).
4. **The restore drill for Postgres restores into an image that lacks parts of Supabase.** One of
   our security policies uses `auth.jwt()`, and the bare drill image does not have that function
   (L3).
5. **Sign-in accounts (`auth.users`) are not backed up.** The backup role cannot open the `auth`
   schema, and Supabase does not let us grant that access
   ([07](07-decisions-for-owner.md), decision 1).
6. **The results do not tell the truth.** A crashed step can still pass a runner test; a report
   can print "pass" for a store that never ran; and a failed dump is recorded as a failed drill
   (L5, L6, N1, N2 in [08](08-second-review.md)).

## Why this kept happening (the real root cause)

**Nothing ever ran the real pipeline before production did** ([02](02-root-causes.md)). Every test
replaces the outside tools with fakes that are kinder than the real tools. There is no CI job with
the real tools and no staging, and reviews read diffs, not runs.

One level deeper ([08](08-second-review.md)): **in ten days, two backup systems were built and
neither has produced one file.** cf-admin's own backup workflow never ran because its secrets were
never added. cf-backup has failed six times. Work was judged done when its tests and reviews
passed, never when a restorable file existed. The real run came last, after tens of thousands of
lines, so every layer met reality at once and each failure hid the next.

## The plan (details in [10](10-robust-plan.md))

**From today on, there is never a day with zero copies of the data.**

| Stage | What | Done when |
|---|---|---|
| 0 (today) | Secure the backup key (two confirmed recovery kits). Stop the runs that can only fail. Take **one backup by hand**, sign-in accounts included ([12](12-manual-backup-today.md)) | Kits confirmed; no new failing runs; encrypted files in the bucket and a second place; one file decrypted |
| 1 (days 1-2) | **The lifeboat:** a small, separate daily workflow that dumps, checks a restore, encrypts and uploads ([11](11-lifeboat.md)) | A scheduled run green, its files in the bucket, row counts matched, one file decrypted by the owner |
| 2 (days 2-6) | Repair the main pipeline behind a **rehearsal job** with the real tools, and contract tests for the fakes | Rehearsal green; one real full backup green |
| 3 | Back up sign-in accounts (decision 1) | Accounts restored in the monthly full-stack rehearsal |
| 4 | The restore drill leaves the daily run; a weekly drill restores from the bucket | Weekly drill green |
| 5 (30 days) | Soak; one restore by hand from the bucket; the day-30 decision on the two paths | See "Done" |

## How "done" will be proven

All of the following, with links recorded in [10](10-robust-plan.md):

1. The newest restore-checked backup is under 26 hours old for Supabase and under 8 days old for D1,
   on both paths.
2. 7 consecutive scheduled main backups green, and 30 days with no missed scheduled run.
3. The rehearsal job is a required check and green.
4. **A real restore from the bucket, done by hand with a recovery kit**, matching the manifest for
   all four stores, sign-in accounts included.
5. Two confirmed recovery kits, each proven by decrypting a real backup.
6. One weekly drill and one monthly real-path D1 drill green.

## Files

- [01-what-happened.md](01-what-happened.md): runs 1 to 5, the exact evidence line and the cause.
- [02-root-causes.md](02-root-causes.md): technical and process root causes.
- [03-reality-check.md](03-reality-check.md): each outside service, what we assumed and what is true.
- [04-latent-defects.md](04-latent-defects.md): defects that have not failed yet, with file:line and fix.
- [05-options.md](05-options.md): the options, including a redesign, and the recommendation.
- [06-plan.md](06-plan.md): the first plan (replaced by 10 where they differ).
- [07-decisions-for-owner.md](07-decisions-for-owner.md): decisions 1 to 7.
- [08-second-review.md](08-second-review.md): run 6, what was re-checked live, corrections, new
  defects, the deeper root cause, and today's exposure.
- [09-how-others-do-it.md](09-how-others-do-it.md): vendor guidance, real examples, known failure
  modes and proven practices, with sources.
- [10-robust-plan.md](10-robust-plan.md): **the current plan**: stages, acceptance, decisions D8 to
  D13, timeline, cost, risks and status.
- [11-lifeboat.md](11-lifeboat.md): the specification of the small, separate backup workflow.
- [12-manual-backup-today.md](12-manual-backup-today.md): the owner's step-by-step manual backup.

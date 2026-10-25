---
title: "GitHub Actions minutes: where they go, and the rules that keep them low"
status: active
audience: [owner, non-technical, technical, ai, operator]
last_verified: 2026-10-25
verified_against: [code, infra]
owner: harshil
related_code: [.github/workflows/quality.yml, .github/workflows/sync-docs.yml]
related_docs: [OPERATIONS.md, ../runbooks/release-and-rollback.md, ../program/cf-backup/10-free-tier-feasibility.md, ../records/reports/2026-10-25-actions-minutes.md, ../records/reports/2026-10-18-ci-on-schedule.md]
tags: [operations, github-actions, cost, free-tier]
---

# GitHub Actions minutes: where they go, and the rules that keep them low

> **TL;DR (for everyone):** GitHub gives each account 2,000 free minutes a month to run
> jobs for private repositories, and that is a hard limit for us. Most of the minutes were
> being spent re-running checks that had already passed on the computer that pushed, or
> that Cloudflare runs again before it deploys. Since 2026-10-18 and 2026-10-25 the checks
> run on pull requests, once a week and by hand instead of after every push. What still
> runs on its own is the backups, the docs mirror and a few small daily checks. This page
> owns the measured numbers, the rules every repository follows, and the ideas not done yet.

This page covers every repository of the platform (cf-admin, cf-astro, cf-backup, cf-vps,
cf-graph, cf-email-consumer) and the Oltrem kit (`oltrem-admin`), which sits on a separate
GitHub account and so a separate pool. The cf-backup budget line by line stays in its plan
of record, [10 Free-tier feasibility](../program/cf-backup/10-free-tier-feasibility.md) §2.

## 1. The allowance

- **2,000 minutes a month for private repositories, per account** (GitHub Free). The six
  platform repositories share the `mascotasmadagascar-cmd` pool; `oltrem-admin` uses the
  owner's personal account's pool. Public repositories do not count.
- **Every job is billed rounded up to a whole minute.** A job that runs for 10 seconds
  costs 1 minute; a workflow with two jobs costs at least 2.
- **A job with no `timeout-minutes` may run up to GitHub's default of 6 hours** if it hangs,
  and is billed for all of it.
- **A re-run is billed again**, in full, and so is a run that is cancelled after it started.
- The owner's target for the platform pool is **under 1,000 a month**, half the allowance
  (plan of record 10).

## 2. Where the minutes went (measured 2026-10-25)

Read through the GitHub Actions API on 2026-10-25 at about 13:45 UTC: every run created from
2026-10-01, each job's start and end, rounded up per job the way GitHub bills. 689 runs:
611 on the platform pool, 78 on the Oltrem pool. None was a re-run.

### 2.1 The platform pool, 1 to 25 October

| Repository | Workflow, trigger | Runs | Minutes |
|---|---|---:|---:|
| cf-admin | `quality.yml` on push (stopped 2026-10-18) | 129 | 714 |
| cf-admin | `sync-docs.yml` on push (docs mirror) | 140 | 141 |
| cf-backup | `ci.yml` on push (stopped 2026-10-25) | 59 | 133 |
| cf-astro | `ci.yml` on push (stopped 2026-10-18) | 24 | 130 |
| cf-astro | `consent-heartbeat.yml` hourly (by hand only since 2026-10-10) | 40 | 67 |
| cf-vps | `sync-docs.yml` on push | 36 | 36 |
| cf-email-consumer | `ci.yml` on push (stopped 2026-10-25) | 29 | 29 |
| cf-graph | `latency.yml` daily | 25 | 25 |
| cf-astro | `security.yml` on push (stopped 2026-10-18) | 24 | 24 |
| cf-backup | `secondary-pipeline.yml` started by the tick or by hand (the backups) | 12 | 24 |
| cf-admin | `quality.yml` weekly | 3 | 21 |
| cf-astro | `sync-docs.yml` on push | 21 | 21 |
| cf-backup | `sync-docs.yml` on push | 20 | 20 |
| cf-backup | `tick-deadman.yml` daily | 20 | 20 |
| cf-backup | `secondary-pipeline.yml` daily fallback | 19 | 19 |
| everything else | weekly checks, exports by hand, Dependabot | 10 | 18 |
| **Total** | | **611** | **1,442** |

**1,368 of the 1,442 minutes were spent before 2026-10-18 17:00 UTC**, most of them by checks
on every push. In the 6.9 days after it, the pool spent **74 minutes**, a pace of about 320 a
month.

### 2.2 The Oltrem pool, 19 to 24 October

| Repository | Workflow, trigger | Runs | Minutes |
|---|---|---:|---:|
| oltrem-admin | `verify.yml` on push: the full `pnpm verify` (about 2 to 3 minutes) plus the docs mirror (1 minute) | 78 | 291 |

That is a pace of about **1,450 minutes a month**, three quarters of that account's allowance,
spent repeating a `pnpm verify` that its rule R-02 already runs before every push.

## 3. What runs, and why (since 2026-10-25)

| Repository | What runs on GitHub | When | About, a month |
|---|---|---|---:|
| cf-admin | `quality` (the full check) | weekly, pull requests, by hand | 30 |
| cf-admin | docs mirror | each push that changes a published document | 90 |
| cf-astro | `CI` and `security` | weekly, pull requests, by hand | 30 |
| cf-backup | `ci` (the full check) | weekly, pull requests, by hand | 13 |
| cf-backup | the backups (`secondary-pipeline`) and the dead man's check | the schedule, the fallback, a second try after a failure, by hand | 60 to 90 |
| cf-backup, cf-vps, cf-astro | docs mirror | each push that changes a published document | 30 to 60 |
| cf-email-consumer | `ci` (the full check) | weekly, pull requests, by hand | 4 |
| cf-graph | `ci`, `latency` | each push, daily | 30 |
| oltrem-admin | `verify` (the full check) | weekly, pull requests, by hand | 13 |
| oltrem-admin | docs mirror, behind the identifiers gate | each push to main | 1 a push |

Before every push, the full `npm run verify` (Oltrem: `pnpm verify`) runs on the machine that
pushes: every repository's contract makes it the gate. After the push, Cloudflare Workers
Builds runs it again before deploying in cf-backup, cf-vps and cf-email-consumer (the
consumer's build), and only builds in cf-admin, cf-astro and cf-graph. So a GitHub check on
every push was the second or third run of the same command on the same commit.

## 4. The rules every repository follows

1. **No check workflow on push.** `npm run verify` already ran before the push, and in some
   repositories Workers Builds runs it again before the deploy. Checks run on pull requests,
   weekly and by hand. The weekly run catches drift, such as a new `npm audit` advisory.
   cf-backup's `checkCiWorkflow` guard (`cf-backup/scripts/backup/lib/workflow-guards.ts`), `cf-email-consumer/test/docs-tooling.test.ts`,
   `cf-astro/test/workflow-minutes.test.ts` and `oltrem-admin/scripts/workflows.test.mjs`
   fail the build if a push trigger comes back.
2. **Every job has `timeout-minutes`**, sized to a few times its normal length.
3. **Every check workflow has `concurrency` with `cancel-in-progress: true`**, so a newer
   push or pull request update replaces the older run.
4. **One job where one will do.** Each job is rounded up on its own, and each sets itself up
   again (checkout, Node, install).
5. **Never re-run a failed run to see whether it passes.** Read the log, fix the cause, push.
   The one designed exception is cf-backup's automatic second try of a failed scheduled
   backup (one more run, about 3 minutes, only on a day a backup failed).
6. **Documentation-only changes skip the checks** (`paths-ignore`), and docs mirrors trigger
   only on the paths they publish.
7. **Anything a Worker can do costs no minutes.** Prefer a Worker's scheduled job or the
   admin portal's tick to a GitHub schedule.
8. **Before adding a workflow, a job or a trigger, write its minutes a month in the commit
   message**, and get the owner's yes for anything that runs on its own.

## 5. Ideas not done yet (the owner's choice)

| # | Idea | Saves, a month | What it costs |
|---|---|---:|---|
| S1 | **Docs mirrors once a day** instead of on each push (cf-admin, cf-astro, cf-backup, cf-vps, Oltrem) | about 90 on the platform pool; about 390 on the Oltrem pool at last week's pace | the public copy of the documents is up to a day behind |
| S2 | **cf-graph's latency probe weekly** instead of daily | about 25 | the published response times are up to a week old |
| S3 | **cf-graph's `ci` off push**, like the others | about 2 (one run in October) | none worth it today; do it if cf-graph gets busy |
| S4 | **Oltrem client repositories** run their tests before each deploy by design; when they live on an account's pool, each client's pushes count there | depends on the client | a decision for the Oltrem delivery design, not here |

Kept on purpose: cf-backup's daily dead man's check and daily fallback (about 20 a month each)
and its backups, because they are how a stopped tick or a missed backup is noticed.

## 6. How to check the numbers

- **GitHub:** the account's Settings, then Billing and plans, then Usage, shows the month's
  minutes per repository.
- **Oltrem:** `oltrem doctor` reads the month's Actions minutes.
- **Re-measure:** list the runs through the GitHub Actions API (`/repos/{repo}/actions/runs`,
  then each run's `/jobs`), round each job's length up to a minute and sum. GitHub's own
  billing field on a run returns 0 (measured, [plan of record 10](../program/cf-backup/10-free-tier-feasibility.md)
  §2.4), so the sum is computed from job start and end times.

## Verification log

| Date | Who | What was checked | Result |
|---|---|---|---|
| 2026-10-25 | claude | Every run since 2026-10-01 on the seven repositories, through the GitHub Actions API (per job, rounded up); every workflow file's triggers, timeouts and concurrency in all seven repositories; which Workers Builds connections run `npm run verify`, from each repository's own contract and deploy documents (the Cloudflare dashboard was not read). Not checked: the billing page itself, which a connector cannot read | pass |

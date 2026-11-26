---
title: "Phase 5: the month's GitHub Actions minutes in the doctor (2026-10-21)"
status: record
owner: vendor
last_verified: 2026-10-21
sources: [the plan, sections 10 and 14.1; GitHub's REST documentation for billing usage, read 2026-10-21; this repository]
---

# Phase 5: the month's GitHub Actions minutes in the doctor

> **In plain words.** Every client's deploys run on GitHub Actions, and all clients share one
> pool of 2,000 free minutes a month. The plan wants that number visible before it runs out.
> `oltrem doctor` now shows how many minutes the account has used this month. It warns from
> 70 % and fails from 90 %, the same lines System health uses for the Cloudflare budgets.

## What changed

- **A tenth doctor check, `GH-MIN-01`** (`packages/cli/src/checks.ts`):
  1. it reads the account that owns the repository from the `origin` remote;
  2. it asks the GitHub CLI whether that account is a user or an organization;
  3. it asks GitHub's usage summary for the month's Actions usage, and adds up every line whose
     unit is minutes.
- It passes under 70 % of 2,000, warns from 70 % and fails from 90 %. The fix it prints names the
  plan's three controls: a self-hosted runner, public client repositories, or paid minutes.
- It is skipped, with what to do, when there is no GitHub remote, no signed-in `gh`, or no
  billing access.
- **`@oltrem/cli`'s README** lists the check. It also corrects the count of the doctor's checks:
  the README said eight, and there are ten now.

## Decisions

- **The doctor, not System health.** The plan (14.1) puts the minutes in `oltrem doctor`. Reading
  them needs a GitHub sign-in with billing access, which the Worker must not hold (plan 9.2). The
  vendor's own computer has one.
- **The GitHub CLI, not a new token.** `gh` is the vendor's existing sign-in. No token is added to
  the registry (R-05), and the check reads nothing when `gh` is absent.
- **The free figure, 2,000.** The kit is planned on the free plan first. An account on a paid plan
  has more minutes and sees a warning earlier than it needs to. That is the safe side.
- **Every runner's minutes together.** The kit's workflows run on Linux only. The sum still counts
  any Windows or macOS minutes the account spends, since they draw on the same pool.

## Not done here

- The check has not run against a real account. Which sign-in scope GitHub asks for on this
  endpoint is taken from its documentation, not from a run. The sandbox repository is that run.
- The usage summary endpoint is in public preview at GitHub. If it changes, the check is skipped
  rather than wrong, because an answer that is not a number is a skip.

## How it was verified

- The twelve gates pass locally.
- The doctor's tests, with a stand-in for the commands:
  - 412.5 minutes passes as 413 of 2000 (21 %), and the call names the user's usage summary;
  - 1,500 warns and 1,900 fails with the three controls;
  - an organization is asked through its own path;
  - a missing answer, a missing `gh` and a remote outside GitHub each skip with what to do.
- The registry and `--list-checks` lists include the new check: the tool's 92 tests pass.
- `oltrem doctor --only GH-MIN-01` in this repository skips, because `gh` is not signed in here.

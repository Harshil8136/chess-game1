---
title: "GitHub page"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-07
verified_against: [code, local-test]
owner: harshil
related_code: [src/pages/dashboard/github.astro, src/components/admin/github/RepoCard.astro, src/lib/github/config.ts, src/lib/github/client.ts, src/lib/github/snapshot.ts, src/lib/github/cache.ts, src/lib/github/view.ts, src/lib/auth/surface-guards.ts, src/lib/auth/page-floors.ts, migrations/0066_github_page.sql]
related_docs: [../specs/2026-10-07-github-page-design.md, ../architecture/PERMISSIONS-SYSTEM.md, ../operations/OPERATIONS.md, ../security/RoPA.md, ../records/reports/2026-10-07-github-page.md, ../MAINTENANCE.md]
tags: [github, plac, operations, resource-usage]
---

# GitHub page

> **TL;DR (non-technical):** one page that shows, for each of the platform's code repositories,
> when it last changed, what the latest changes were and the notes written with them, the
> latest release, and whether GitHub's automatic checks passed. It only reads; it changes
> nothing on GitHub.

**Where:** `/dashboard/github`, titled **GitHub**, in the sidebar's Management section for anyone
who can open it.

## Who can open it

The owner and vendor support. Anyone else at admin or above needs it granted on their Access
page. Below admin nobody gets in, whatever a grant says. The page asks for its own key exactly
(`canViewGitHub` in `src/lib/auth/surface-guards.ts`), so a person whose access map predates
migration `0066` is refused until it refreshes (within an hour, or at once after signing in
again). The floor lives in `src/lib/auth/page-floors.ts`, which the sidebar reads too, so below
admin the link is greyed like any page a person cannot open.
[PERMISSIONS-SYSTEM.md](../architecture/PERMISSIONS-SYSTEM.md) §5 owns the model.

## What it shows

**Overview strip:** repositories (and the newest push), commits in the last 7 days, how many
repositories have a failed workflow, open pull requests, and open Dependabot alerts.

**Per repository:**

- a health badge from each workflow's newest run: **Failing**, **Running**, **Healthy**, **Quiet**
  (no runs) or **Unknown** (GitHub did not answer);
- a **Deploy** chip from the Workers Builds check on the default branch's newest commit, and one
  chip per workflow with its newest result;
- last push, commits in 7 days and on the default branch, branches, open pull requests, size;
- commits per day for 14 days (a bar chart; "+" when the fortnight held more than 100 commits);
- the main languages as one bar;
- the latest commit and its notes (the message body, trailers removed, up to 2,000 characters),
  and the 4 before it;
- open pull requests (up to 5), drafts marked;
- the latest release, or else the latest tag and how many tags there are;
- open Dependabot alerts;
- the last 10 GitHub Actions runs, each with its result, trigger, branch, age and duration.

**Page-wide:** **Newest first** or **Configured order**, when GitHub was last read, a **Refresh**
link, the token's expiry when it is within 14 days or past, which parts the token may not read,
and GitHub's remaining GraphQL allowance.

The repositories and their order are the `admin_portal_settings` row `github_repos` (a JSON
array, at most 12, seeded by `0066`). There is no editor yet: change the row with a D1 update. A
missing or broken row falls back to the five repositories in `src/lib/github/config.ts`.

## How it reads GitHub

One fine-grained token, `GITHUB_READ_TOKEN`, an optional Worker secret
([OPERATIONS.md](../operations/OPERATIONS.md)). It is made by the account that owns the
repositories, with read-only Actions, Contents, Issues and Pull requests. A token made by a
collaborator account cannot read them. Two parts are optional: **Dependabot alerts** needs the
"Dependabot alerts" read permission, and the **Deploy** chip needs GitHub to let the token read the
commit's checks and statuses. When GitHub refuses either, the card and the page footer say which,
and everything else still shows.

A refresh is one GraphQL call for all repositories plus one Actions call for each. The result is
kept in KV (`SESSION`, key `github:snapshot:v1`, 7 days). It is served as it is for 10 minutes,
then served while a refresh runs after the response. A Refresh asked for within a minute of the
last read is ignored. Nobody looking means no calls at all. The
[design](../specs/2026-10-07-github-page-design.md) §5 has the cost table.

Deploy results come from the commit's check summary in GraphQL (`statusCheckRollup`), not the
Checks API, which fine-grained tokens cannot call. Whether GitHub grants that summary to a
fine-grained token is confirmed on the live page ([MAINTENANCE.md](../MAINTENANCE.md) GH-1).

## When something is wrong

| You see | Meaning | Do |
|---|---|---|
| "GitHub is not connected" | No token on the Worker | Create the token and set `GITHUB_READ_TOKEN` |
| "GitHub refused the token" | Expired or revoked | Create a new token and set it again |
| A card: "GitHub did not return this repository: …" | Not in the token, renamed, deleted, or a permission is missing | Read GitHub's reason on the card; fix the token or `github_repos` |
| A card: "Actions history unavailable" | That repository's Actions call failed | Refresh later |
| "Showing what was read N ago" | GitHub failed; this is the last good read | Nothing; it tries again after 10 minutes, or tap Refresh after 1 minute. A failure is reported at most once an hour |

## Verification log

| Date | Who | Checked | Not checked |
|---|---|---|---|
| 2026-10-07 | claude | Unit and source-contract tests (`test/github-*.test.ts`, 99 cases), `astro check`, `npm run build` | Production render with the real token, CPU per view (recorded here once the token is set) |
| 2026-10-07 | claude | v2 (overview, health, deploy chip, activity, languages, pull requests, tags, Dependabot alerts, durations): the GraphQL query run against GitHub's live schema with a collaborator's classic token (no errors, cost 1 point, all five repositories); unit and source-contract tests (124 cases); `astro check`; `npm run build`; the live snapshot in KV after the token was set (five repositories, no errors) | Which optional parts the fine-grained token may read (confirmed on the first live refresh); CPU per view |

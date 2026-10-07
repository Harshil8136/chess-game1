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

Per repository: private or public, archived, language, size; last push; commits in the last 7
days and on the default branch; open issues and pull requests; the 5 latest commits, with the
newest one's notes (the commit message body, trailers removed, up to 2,000 characters); the
latest release and its notes; the last 10 GitHub Actions runs with a pass/fail summary.

Page-wide: when GitHub was last read, a **Refresh** link, the token's expiry when it is within 14
days or past, and GitHub's remaining rate limit.

The repositories and their order are the `admin_portal_settings` row `github_repos` (a JSON
array, at most 12, seeded by `0066`). There is no editor yet: change the row with a D1 update. A
missing or broken row falls back to the five repositories in `src/lib/github/config.ts`.

## How it reads GitHub

One fine-grained token, `GITHUB_READ_TOKEN`, an optional Worker secret
([OPERATIONS.md](../operations/OPERATIONS.md)). It is made by the account that owns the
repositories, with read-only Actions, Contents, Issues and Pull requests. A token made by a
collaborator account cannot read them.

A refresh is one GraphQL call for all repositories plus one Actions call for each. The result is
kept in KV (`SESSION`, key `github:snapshot:v1`, 7 days). It is served as it is for 10 minutes,
then served while a refresh runs after the response. A Refresh asked for within a minute of the
last read is ignored. Nobody looking means no calls at all. The
[design](../specs/2026-10-07-github-page-design.md) §5 has the cost table.

Not shown: Workers Builds deploy results. They reach GitHub as check runs, and fine-grained
tokens cannot read the Checks API ([MAINTENANCE.md](../MAINTENANCE.md)).

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

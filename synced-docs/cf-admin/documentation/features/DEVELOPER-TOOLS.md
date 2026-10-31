---
title: "Developer Tools: migrations, switches, documents, deploys, keys, private links and Copy for Claude"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-31
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/dashboard/debug/index.astro, src/pages/dashboard/debug/migrations.astro, src/pages/dashboard/debug/switches.astro, src/pages/dashboard/debug/documents.astro, src/pages/dashboard/debug/deploys.astro, src/pages/dashboard/debug/keys.astro, src/pages/dashboard/debug/links.astro, src/pages/api/debug/handoff.ts, src/components/admin/debug/tools/, src/lib/devtools/, src/lib/dal/DevToolsRepository.ts, src/lib/auth/surface-guards.ts, src/lib/auth/routes.ts, scripts/lib/docs-freshness.mjs, src/styles/pages/devtools.css, migrations/0091_developer_tools.sql, migrations/0092_developer_tools_wave2.sql, test/devtools.test.ts, test/devtools-docs-plugin.test.ts, test/devtools-wave2.test.ts, test/devtools-keys.test.ts]
related_docs: [../records/reports/2026-10-31-developer-tools-look.md, ../operations/DEV-TOOLS.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../reference/schema-change-ledger.md, SYSTEM-HEALTH.md, CRON-CONTROL.md, GITHUB.md, ../operations/OPERATIONS.md, ../records/reports/2026-10-31-developer-tools.md, ../records/reports/2026-10-31-developer-tools-wave2.md]
tags: [developer-tools, debug, migrations, settings, documentation, permissions, ui]
---

# Developer Tools

> **TL;DR (non-technical):** Developer Tools (`/dashboard/debug`) is vendor support's corner of
> the portal. Besides Page Registry it now has six read-only pages and one button. Migrations
> shows every change ever made to the shared database and the next free number for a new one.
> Switches lists every on/off switch of the platform in one place, each with a link to the page
> that changes it. Documents lists the documents that will stop every push because nobody has
> checked them for 45 days, and those about to. Copy for Claude copies a short report of where
> the platform stands, with no names or addresses in it, to paste into a Claude thread. Deploys
> says, for each of our Workers, whether the newest push is live. Keys and tokens lists every
> secret the portal needs, by name only, set or missing, and when the tokens expire. Private
> links shows how long the portal's connections to our other Workers take, and when they stall.
> Nothing on these pages changes anything. They are the eight ideas the owner picked on
> 2026-10-31, built in two waves the same day; Deploys answers two of them (live versions, and
> did my push deploy?).

## 1. Where it is and who opens it

- **The hub** is `/dashboard/debug`, labelled Developer Tools in the sidebar. Its sideways row
  (`RegistryTabs`, read from the registry) reads Overview, Page Registry, Migrations, Switches,
  Documents, Deploys, Keys and tokens, Private links. Under its head the hub shows four figures
  (this deploy's commit, its newest migration, needed secrets missing, documents due), each a
  link to its tool, then one list of the tools the viewer may open in three groups (What runs,
  How it is set, Access and health), System health among them for someone it opens for.
- **The keys** (migrations `0091` and `0092`, all stored role `dev`): `/dashboard/debug/migrations`,
  `/dashboard/debug/switches`, `/dashboard/debug/documents`, `/dashboard/debug/deploys`,
  `/dashboard/debug/keys`, `/dashboard/debug/links` and the action `/dashboard/debug#handoff`. `denyDebug` asks for the hub key, then the part or the action, each
  by exact key, so holding Developer Tools alone opens none of them. The owner and vendor support
  pass every key; anyone else needs a grant from the Access page. Unlike Page Registry, they are
  not grant-only. [`PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) owns the model.
- Every page is read only. Since 2026-10-31 every page is drawn as Page Registry is, at the
  owner's ask: the console kit (`console.css`, hue violet), a head with when the page was read,
  a Refresh and Copy for Claude (`ToolHead.astro`), figures as tiles with an icon
  (`ToolTile.astro`), and lists as rows with an icon chip, a name, the lines under it and a badge
  (`ToolRow.astro`). `devtools.css` holds only what the kit has no class for. On a phone a row
  keeps its icon, name and badge, and drops only the detail beside the badge (a document's
  checked date, also in its badge's wording).

## 2. Migrations (`/dashboard/debug/migrations`)

One read of the shared database's migration ledger (`d1_migrations`, about 130 rows), set
beside the migration files this deploy carries, which the build reads from
`database/migrations.manifest.json` (`src/lib/devtools/migrations.ts`).

| It shows | Worked out as |
|---|---|
| Applied | every ledger row, from all three series (cf-astro, cf-admin and the older files) |
| Latest | the newest row by id, with when it ran (UTC) |
| Next free number | one above the highest number among the ledger and this deploy's files, never below `0033` (cf-admin's first, RULE #0.7b) |
| Never ran | a file this deploy carries that the ledger has not recorded: a red notice, since the deploy runs pending migrations before the code goes live |
| The latest 12 | newest first, each marked cf-admin (`0033` and up) or cf-astro and the older series |
| Numbers used more than once | folded; history from before the number split, not a fault |
| Ran here with no file in this repository | folded; cf-astro's files and the older series |

## 3. Switches (`/dashboard/debug/switches`)

Every stored on/off switch in one list, grouped by where it lives, with a row of jump links and
a count of how many are off. Each group links to the page that changes it; nothing is switched
here.

| Group | Read from | Changed on |
|---|---|---|
| Portal settings | `admin_portal_settings`, global rows whose value is `true` or `false`; known keys get a plain name, an unknown one shows its key | Configuration, or SEO for the search and review switches |
| Sentry and PostHog | `service_config` rows marked as switches, named website or portal | Sentry settings, PostHog settings |
| Scheduled jobs | the cron-control row ([`CRON-CONTROL.md`](CRON-CONTROL.md)): each job on or paused, with its reason; a pause whose end has passed counts as on; a stop of every job shows as a banner | Scheduled jobs |
| Hotel emails | the email service's template switches, through the Email API page's own access and a four-second limit | Email API |
| Pages and actions switched off | registry rows with `is_active = 0` | Page Registry |

A group that cannot be read says so and the others still show. Numbers that are not switches
(sampling rates, limits) are not listed.

## 4. Documents (`/dashboard/debug/documents`)

The same arithmetic as `scripts/docs_check.py`: an active document whose `last_verified` is more
than 45 days old fails `npm run verify`, and so every push. The page lists those, then the ones
that cross the limit within 14 days, soonest first, with tiles for each count and how many are
counted and how many are marked exempt.

The dates are the ones in this deploy: the build reads every active document's front-matter
(`scripts/lib/docs-freshness.mjs`, the `virtual:docs-freshness` module), and the page works out
the ages on the day it opens (`src/lib/devtools/docs.ts`). It reads no database.
`test/devtools-docs-plugin.test.ts` compares the build's list with `docs_check.py --upcoming 14`
over the real documents, so the two cannot drift.

## 5. Copy for Claude (`/dashboard/debug#handoff`)

A small button in the head of every Developer Tools page, for someone the action's key opens
for. A press opens a pop-up (the portal's `Dialog`), calls `GET /api/debug/handoff`, copies the
answer to the clipboard and shows it in the pop-up with Copy and Make it again, for a phone that
refuses the clipboard. Until 2026-10-31 it was a panel in the middle of the hub; the owner found
it took too much room. The report, in
plain text:

- the deploy it came from and when;
- health checks not passing on their last run, and open problems (title, severity, count, last seen);
- paused jobs, or a stop of every job;
- the migration ledger: how many applied, the latest, the next free number, any never run;
- documents blocking pushes now and those within 14 days;
- the last 24 hours of changes, as counts by area and kind.

It carries no person, email or IP address: free-text messages pass through `scrubString`, and
the changes are counts only. Each copy writes one audit row (`view`, module `debug`, target
`handoff`). The route's row is in the table of [`SECURITY.md`](../security/SECURITY.md).

## 6. Deploys (`/dashboard/debug/deploys`)

For each of our eight Workers (`SERVICES` in `src/lib/devtools/deploys.ts`; the account's other
Workers belong to someone else and are never read): the version Cloudflare serves now, the newest
commit on its repository's main branch, and one answer to "did my push deploy?".

- **The live version:** the Worker's newest deployment from Cloudflare (`/workers/scripts/<name>/deployments`,
  `CLOUDFLARE_API_TOKEN`, "Workers Scripts: Read"), with when, how (wrangler, the dashboard…),
  why when it was not a plain deployment (a rollback), and the split of a gradual one. The reads
  go six at a time, the free plan's limit of open connections. Who deployed is dropped.
- **The newest commit and its build:** from the GitHub page's saved snapshot
  ([`GITHUB.md`](GITHUB.md)), never a GitHub call of its own: the commit, its first line and its
  Workers Builds check. This half shows only for someone the GitHub page opens for.
- **The answer:** exact for the portal, which knows the commit it was built from. For the
  others, a failed or running build check is believed first; otherwise a version deployed after
  the commit was made counts as live, one older is behind, and a commit under ten minutes old is
  still on its way. A commit made long before it was pushed can make an older deploy look current;
  the build check, when GitHub has one, settles it.

## 7. Keys and tokens (`/dashboard/debug/keys`)

Every secret the portal reads, by name only (`src/lib/devtools/keys.ts`): the 22 that
`wrangler.toml`'s `[secrets] required` names, without which a deploy refuses to go out, and the 8
optional ones `src/env.d.ts` declares. For each: what it is for, and set or not set on this
Worker. Only whether a value is there is read; it is never shown, logged or sent.
`test/devtools-keys.test.ts` fails when either list changes and the page does not.

Two tokens also say when they expire. The Cloudflare token is asked through its own verify address
(the account's, then the user's), which needs no permission. The GitHub token's date is the header
GitHub sent with the GitHub page's last read; GitHub sends it only for a token that expires, so
none is not proof of "never". Where a secret is set or replaced is in
[`OPERATIONS.md`](../operations/OPERATIONS.md) §5.

## 8. Private links (`/dashboard/debug/links`)

How long the portal's private connections (service bindings) to our other Workers took to answer
over the last 7 days, from the results System health already stores for the checks that use one:
those given the private time limit in `src/lib/health/catalog.ts` (Website, Chat assistant, Email
service and Server's site checks today). For each: how many answers were timed, the usual (middle)
and slow (95th of 100) answer, the slowest, the stalls (5 seconds or more) and the runs not
passing; then the stalls by hour of the day (UTC) and the ten slowest answers. It is the question
of MAINTENANCE SH-10 ([`SYSTEM-HEALTH.md`](SYSTEM-HEALTH.md) §3). One batch of indexed reads, no
call to another Worker.

## 9. Cost

Each page is one small read or a batch of a few, well under the 10 ms CPU budget; Documents
reads none. Copy for Claude makes five reads in parallel. Deploys makes eight Cloudflare calls in
two groups and reads the saved GitHub snapshot; Keys and tokens makes one or two. No new table,
setting, variable, binding or outside service.

## 10. Limits

Tracked in `MAINTENANCE.md` (private), "Developer Tools follow-ups".

- Deploys and the Cloudflare token's date depend on what `CLOUDFLARE_API_TOKEN` may read; a
  refusal shows Cloudflare's own words on the row.
- Switches does not show the email service's own alert switch: the portal's system caller may
  read it only for the health checks.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-31 | §1 and §5 after the makeover: the seven pages under `src/pages/dashboard/debug/` (all but `pages.astro`), `ToolHead.astro`, `ToolTile.astro`, `ToolRow.astro`, `HandoffCopy.tsx` and `devtools.css`; `npm run build` builds them; the data each page reads is unchanged | The pages in a phone browser (the owner's test) |
| 2026-10-31 | Wave 2 (§1, §6 to §10) with its code: the three pages, `src/lib/devtools/deploys.ts`, `keys.ts`, `links.ts`, `cloudflare.ts` and `readCheckLatencies`; `test/devtools-wave2.test.ts` and `test/devtools-keys.test.ts` pass; migration `0092` applied and its three rows and ledger row (id 128) read back through the D1 connector; the eight Workers' names and the private checks' recent timings read live | The pages in a phone browser; the Cloudflare token's permissions (its value cannot be read from here) |
| 2026-10-31 | Written with the code: the pages, `denyDebug`, the route and `src/lib/devtools/`; `test/devtools.test.ts` (20) and `test/devtools-docs-plugin.test.ts` (3) pass; `npm run build` builds the pages; migration `0091` applied and its four rows and ledger row read back through the D1 connector | The pages in a phone browser (the owner's test) |

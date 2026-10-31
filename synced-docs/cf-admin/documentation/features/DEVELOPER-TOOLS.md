---
title: "Developer Tools: the migration ledger, switches, documents and Copy for Claude"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-31
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/dashboard/debug/index.astro, src/pages/dashboard/debug/migrations.astro, src/pages/dashboard/debug/switches.astro, src/pages/dashboard/debug/documents.astro, src/pages/api/debug/handoff.ts, src/components/admin/debug/tools/, src/lib/devtools/, src/lib/dal/DevToolsRepository.ts, src/lib/auth/surface-guards.ts, src/lib/auth/routes.ts, scripts/lib/docs-freshness.mjs, src/styles/pages/devtools.css, migrations/0091_developer_tools.sql, test/devtools.test.ts, test/devtools-docs-plugin.test.ts]
related_docs: [../operations/DEV-TOOLS.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../reference/schema-change-ledger.md, SYSTEM-HEALTH.md, CRON-CONTROL.md, ../records/reports/2026-10-31-developer-tools.md]
tags: [developer-tools, debug, migrations, settings, documentation, permissions, ui]
---

# Developer Tools

> **TL;DR (non-technical):** Developer Tools (`/dashboard/debug`) is vendor support's corner of
> the portal. Besides Page Registry it now has three read-only pages and one button. Migrations
> shows every change ever made to the shared database and the next free number for a new one.
> Switches lists every on/off switch of the platform in one place, each with a link to the page
> that changes it. Documents lists the documents that will stop every push because nobody has
> checked them for 45 days, and those about to. Copy for Claude copies a short report of where
> the platform stands, with no names or addresses in it, to paste into a Claude thread. Nothing
> on these pages changes anything. They are the first four of the eight ideas the owner picked
> on 2026-10-31; the other four come next (§7).

## 1. Where it is and who opens it

- **The hub** is `/dashboard/debug`, labelled Developer Tools in the sidebar. Its sideways row
  (`RegistryTabs`, read from the registry) reads Overview, Page Registry, Migrations, Switches,
  Documents. The hub shows Copy for Claude, then one card per tool the viewer may open, and the
  System health card for someone it opens for.
- **The keys** (migration `0091`, all stored role `dev`): `/dashboard/debug/migrations`,
  `/dashboard/debug/switches`, `/dashboard/debug/documents` and the action
  `/dashboard/debug#handoff`. `denyDebug` asks for the hub key, then the part or the action, each
  by exact key, so holding Developer Tools alone opens none of them. The owner and vendor support
  pass every key; anyone else needs a grant from the Access page. Unlike Page Registry, they are
  not grant-only. [`PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) owns the model.
- Every page is read only. The look is the console kit (`console.css`, hue rose) with
  `devtools.css` for the hub's cards and the report box; tables stack on a phone.

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

A button on the hub. It calls `GET /api/debug/handoff`, copies the answer to the clipboard and
shows it in a box with a Copy button, for a phone that refuses the clipboard. The report, in
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

## 6. Cost

Each page is one small read or a batch of three, well under the 10 ms CPU budget; Documents
reads none. Copy for Claude makes five reads in parallel. No new table, setting, variable,
binding or outside service.

## 7. What comes next, and limits

- **Wave 2** of the owner's pick: Live versions, Did my push deploy?, Keys and tokens checklist
  (names only, never values) and Private-link timer. Tracked in
  `MAINTENANCE.md` (private).
- Switches does not show the email service's own alert switch: the portal's system caller may
  read it only for the health checks.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-31 | Written with the code: the pages, `denyDebug`, the route and `src/lib/devtools/`; `test/devtools.test.ts` (20) and `test/devtools-docs-plugin.test.ts` (3) pass; `npm run build` builds the pages; migration `0091` applied and its four rows and ledger row read back through the D1 connector | The pages in a phone browser (the owner's test) |

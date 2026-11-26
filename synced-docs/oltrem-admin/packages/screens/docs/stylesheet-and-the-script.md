---
title: "@oltrem/screens: The stylesheet and the script; Not here yet; Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; packages/screens/test; templates/client/test/screens.test.ts]
---

# @oltrem/screens: The stylesheet and the script; Not here yet; Tests

> Part of [the @oltrem/screens README](../README.md).

## The stylesheet and the script

| File | What it is |
|---|---|
| `/ui/app.css` | The one stylesheet, compiled by Tailwind from `@oltrem/core-ui`'s theme and the classes of the pages, primitives and every module's `src/*.tsx`, under the size `test/css.test.ts` allows (204 KiB). A colour with an opacity (`bg-primary/10`) is written once, as its `color-mix()` |
| `/ui/app.js` | The orb's engine and the frame's script (`src/client/frame.js`), shrunk by esbuild; the build checks each part still compiles |
| `/ui/inter.woff2` | Inter Variable, Latin letters only (SIL Open Font License 1.1, its notice in the generated file), from `@fontsource-variable/inter` at build time, its `@font-face` at the top of the stylesheet, preloaded under `APP_FONT_VERSION`, `font-display: swap`; a brand font (`--brand-font`) comes first |
| `/ui/mark/:file` | The icon, named by its contents, kept for good, with its own type and `nosniff`; anything else is 404 |

**Served by the Worker, never as static assets.** They are strings in `src/generated/assets.ts`,
served by `publicRoutes` before the door, cached for good under the version every page links
(`src/generated/versions.ts`), `no-cache` without it. A Worker with static assets runs behind
Cloudflare's asset router, which does not hand it the Access sign-in, so every page would refuse
everyone with `KIT-E-0401`; `oltrem deploy` and `oltrem upgrade` take an `assets` line out, and the
deploy refuses any other. After changing a class or the script, run `pnpm ui:build`; a test fails
while a committed file differs from the build. Never edit the generated files (R-06).

## Not here yet

- **Other forms**: profiles, a setting that is not text, a number or a switch, a provider's
  delivery-report address and the client's own definitions are API only.
- **The kit's pages from manifests**: a module's own pages mount from its manifest; the kit's first
  pages are still the fixed list in `src/layout.tsx`, moving one at a time.
- **Astro**: the plan names it; these are Preact components the Worker renders with no second build,
  and they move under Astro if the sandbox measurement favours it.
- **Spanish**: every word is English until the i18n fields exist.

## Tests

`test/`, one file per subject, named by what it holds: the stylesheet against its build (`css`),
marks and the tab icon (`marks`), the frame script (`frame`, `warm-frame`), a module's pages mounted
on Node (`module-pages`), section Settings tabs (`section-settings`), the first run and core pages
(`first-run`, `start`, `get-started`, `home`), people and access (`people-access`, `same-access`,
`copy-access`, `role-pages`, `role-rank`, `policy`, `api-keys`), the sidebar and room (`one-sidebar`,
`five-groups`, `no-wasted-room`, `go-list`, `paths`, `names`, `looks`), and one file each for alerts
and deploys, the audit log, backups, the checkup, settings, switches, sign-out, provider tiles, the
main-inbox step and the mail trend.

The client template's `test/screens.test.ts` runs the journeys inside the Workers runtime:

1. **First run**: the Vendor signs in on this computer, creates the company, the Owner accepts,
   every page answers with its words and Home shows every card; a stranger has no account; behind
   Access the local door does not exist; Users and access asks for the company first.
2. **People and access**: a role and location; an invitation accepted; roles ended, given, refused
   twice, changed and back; deactivate and reactivate; allow and deny overrides (the denied page
   refused, Home showing only readable cards); an invitation withdrawn; a cross-site form refused;
   two invited at once; a role request approved (not by the asker); an access review; a group with a
   role turned on for an hour; a Vendor window; a CSV list import with a bad row; an invitation file;
   **Set up for your business** as Shop within 30 queries, twice making nothing new.
3. **A provider**: Resend connected with stood-in answers: key checked, test refused without a
   sending address, address saved, test sent, made the sender, refused removal while sending,
   taken out of use, key pasted again, removed.
4. **An alert**: a recipient named, a failed deploy report failing twice on the tick, the alert
   emailed and on Alerts and Home, acknowledged, resolved when the check passes.
5. **Queries**: once the journeys fill the tables, Home within 40 and every sidebar page within 10 of
   the free plan's 50, each page over its share named.

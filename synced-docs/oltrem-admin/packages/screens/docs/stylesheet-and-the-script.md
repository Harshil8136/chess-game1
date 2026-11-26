---
title: "@oltrem/screens: The stylesheet and the script; Not here yet; Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: The stylesheet and the script; Not here yet; Tests

> Part of [the @oltrem/screens README](../README.md).

## The stylesheet and the script

`/ui/app.css` is the one stylesheet, compiled by Tailwind from `@oltrem/core-ui`'s theme and the
classes the pages, the primitives and every module's `src/*.tsx` use, under the 80 KiB a test allows
(64 until the colour pass of 2026-11-04, by the owner's yes). A colour with an opacity
(`bg-primary/10`) is written once, as its `color-mix()`: Tailwind's second copy for browsers without
it, about a tenth of the file, is left out , as the theme's own rules use the mix bare. `/ui/app.js`
is the orb's engine and the frame's script (`src/client/frame.js`), each shrunk by esbuild, 88 KiB
where the copy without comment lines was 131 KiB; the build checks that each part still compiles.

**The font**: Inter Variable, Latin letters only (English first, Spanish's accents ready), 47 KiB,
from `@fontsource-variable/inter` at build time (SIL Open Font License 1.1, its notice in the
generated file). The build puts its `@font-face` at the top of `/ui/app.css`, and the Worker serves
it at `/ui/inter.woff2` under its version (`APP_FONT_VERSION`), kept for good and preloaded by every
page; the device's own font shows until it arrives (`font-display: swap`). It is decoded once per
copy of the Worker with a plain loop. A brand font (`--brand-font`) still comes first. **The icon**
is served at `/ui/mark/:file`, a name made of its contents, kept for good, with its own type and
`nosniff`; anything else is 404.

**Served by the Worker, never as static assets.** The stylesheet, the script and the font are strings in
`src/generated/assets.ts`, served by `publicRoutes` before the door, cached for good under the
version every page links (`src/generated/versions.ts`) and `no-cache` without it. From 2026-11-03
to 2026-11-04 they were Cloudflare static assets: a Worker with static assets runs behind
Cloudflare's asset router, which does not hand it the Access sign-in (`ctx.access`), so every page
of a live portal refused everyone with KIT-E-0401 ([the record](../../../archive/records/2026-11-04-sign-in-and-static-files.md)).
`oltrem deploy` and `oltrem upgrade` take that `assets` line out, and the deploy refuses any other.
After changing a class in a page or a primitive, or the script, run `pnpm ui:build`; a test fails
while a committed file differs from what the build writes. The two files are generated: never
edit them by hand (R-06).

## Not here yet

- **The other forms.** Profiles, a setting whose value is not text, a number or a switch, a
  provider's delivery-report address and the client's own provider definitions: still the API
  until their forms come.
- **The kit's own pages from the manifest.** A module's own pages mount from its manifest; the
  kit's first pages are still the fixed list in `src/layout.tsx`, and move onto their modules'
  manifests one at a time. The i18n fields come later.
- **Astro.** The plan names Astro for the screens. These are Preact components rendered by the
  Worker itself, so the kit's two commands run them with no second build; the same components
  move under Astro when its renderer is built, if the sandbox measurement favours it.
- **Spanish.** Every word is English until the i18n fields exist.

## Tests

`test/css.test.ts` holds the committed stylesheet to its build; `test/marks.test.ts` holds what a
mark setting names, a picture icon read from its own bytes and never large, and the tab's icon;
`test/frame.test.ts` the frame script's moves, the page alone with its frame key among them;
`test/module-pages.test.ts` mounts a module's pages on Node: the sidebar entry in its group, the
page in the frame, a form back by its redirect and another site's refused;
`test/section-settings.test.ts` holds which sections get a Settings tab, last in their row, a single
row folding into one, what stays on the Settings page, and a page under a tab marking it and found
by the search box; `test/same-access.test.ts` holds who Same access as offers and with which role;
`test/people-access.test.ts` holds the invitation to the roles the person may give and the Users and
access row to the pages each person may use and the addresses read from an invitation file and put
back in the box; `test/start.test.ts` holds Set up for your business: what each kind switches off
with the extras kept, the modules ticked for a kind and the ticks saved with what a ticked one
needs, Home's first-run question, and the plan's words, the roles left to whoever manages them when
they cannot be read; `test/first-run.test.ts` the first run and the core pages on Node: more than
fifty addresses refused in words, a refused company keeping what was typed, an accepted invitation
said on Home and a dead one offering sign-out, Settings trying every changed row, the Owner role
asked first, invitations queued with Copy and Send again, several members added, and stuck mail with
its last error. The client template's `test/screens.test.ts` runs the whole first run inside the
Workers runtime: the Vendor signs in on this computer, creates the company, the Owner accepts, every
page answers with its words and Home shows every module's card; a stranger is told there is no
account; behind Access the local door does not exist. Before that, the Vendor finds every Users and
access page asking for the company first, with no action that would fail. A second test creates a
role and a location, invites someone who accepts, ends and gives their role, is refused the same
role at the same location again (and is not offered it), changes the role to another and back in one
step, deactivates and reactivates the user, allows one thing and denies another as permission
overrides, picked by module and then permission (the person is then refused the denied page and
shown the allowed one, and Home shows them only the cards they may read), ends the deny and then the
other, withdraws an invitation, and sees a refusal and a cross-site form refused; later the Owner
invites two people at once with their links emailed, their own address refused, and a member asks
for a role, the Owner approves it (the member is refused deciding it themselves), then opens an
access review at the company, keeps every grant and closes it; then the Owner makes a group, adds
the member ticked from the people with an account (an unknown typed address refused), gives the
group a role used only when switched on, which the member turns on for an hour, ends it, is refused
removing the group, and opens and closes a window for the Vendor; and the Owner adds two suppliers
to a list from a CSV file after a file with a bad address is refused with its row; the Owner then
chooses a spreadsheet file, sees its address in the box with nobody invited, and invites it from
there, a blank file and one over 128 KB refused; and, on Set up for your business, with Records
switched off first, picks Shop: one press within 30 queries switches the modules, makes Admin above
Member and the Products list, a second press makes nothing twice, Something else leaves the modules
as they are and a kind that is not there is refused. A third connects Resend, with the provider's
answers stood in for: a missing key refused, the key checked, a test message refused for want of a
sending address, the address refused when malformed and saved on the Settings page, the test message
then sent, the provider made the one that sends, refused removal while it sends, taken out of use,
its key pasted again, and removed. A fourth names an alert recipient on the Settings page, lets a
failed deploy report fail its check twice on the tick, and sees the alert emailed, on the Alerts
page and on Home, acknowledges it, and sees it resolved once the check passes. The last counts the
database queries of Home and of every page in the sidebar once the journeys have filled the tables:
Home within 40 and every other page within 10 of the Free plan's 50 an invocation, each page over
its share named.

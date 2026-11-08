---
title: "Colour themes: built-in palettes, your own colours, shared themes — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-11-08
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/themes/catalog.ts, src/styles/themes/bridge.css, src/lib/themes/colour.ts, src/lib/themes/derive.ts, src/lib/themes/contrast.ts, src/lib/themes/look.ts, src/lib/themes/schema.ts, src/lib/themes/shared.ts, src/lib/theme-client.ts, public/scripts/theme-init.js, src/layouts/AdminLayout.astro, src/components/admin/settings/ColourThemesPanel.tsx, src/pages/api/settings/user.ts, src/pages/api/settings/themes.ts, src/lib/dal/UserSettingsRepository.ts, migrations/0099_colour_themes.sql, test/theme-engine.test.ts, test/api-settings-themes.test.ts, test/api-settings-user.test.ts]
related_docs: [../reference/DESIGN-SYSTEM.md, ../features/SETTINGS-AND-CONFIGURATION.md, ../architecture/PERMISSIONS-SYSTEM.md, 2026-10-27-portal-frame-look.md, ../records/reports/2026-11-08-colour-themes.md]
tags: [design, ui, theming, accessibility, settings, permissions]
---

# Colour themes: built-in palettes, your own colours, shared themes — design

> **TL;DR (non-technical):** Everyone can now choose how the portal looks, not only light or
> dark. There are seven built-in colour themes (Slate, today's look, stays the default), and
> each one has a light and a dark version. A person who needs different colours, for example
> because of low vision or colour blindness, can set their own nine colours by hex code; the
> page changes as they type and warns them about any pair that is hard to read. The owner, or
> anyone given the permission, can save new themes for everyone from Settings without any code
> change. A manager can set the colours of the people below them. None of it costs anything on
> Cloudflare: it is a few kilobytes of code and one existing database row.

## Context

On 2026-11-08 Harshil asked, after the Dashboard V22 video review:

1. multiple themes and palettes, with the default themes in the code ("Palette preview first":
   he picked the palettes on a preview page the same night and asked for all of them as
   built-in themes, with motion as smooth as the preview or better, and expects to try many
   more themes soon);
2. a personal palette by hex code for a person with a visual disability, as an accessibility
   feature ("ADA 2.1 etc.");
3. shared themes added on Settings only by authorized people, the owner and vendor support
   always;
4. higher-ranked people configuring it for those below them;
5. something better for the long run and easier to code.

## Decisions

### A theme is nine seed colours per mode

`src/lib/themes/catalog.ts`: background, cards, text, accent, a second accent for charts, and
good, warning, bad and information. Everything else the portal paints with (five surface steps,
four text strengths, borders, glass, the accent's tints, the words on a button, the frame's
`--nav-*` colours) is worked out from those nine by `deriveTokens` in `derive.ts`, which mirrors
how Slate's hand-made values relate: surfaces a few per cent towards the text, quieter words a
share of the way to the background, lines and tints as the text or the accent at a low opacity.

Why: one theme is then nine lines of data, not seventy tokens, so a new built-in theme is one
entry in `PALETTES`, a shared theme is nine colours a person picks, and every theme is checked by
the same test. Radix Colors and Material 3's dynamic colour work the same way (a few seeds, a
derived scale).

Kept out of a theme on purpose: the sidebar's group colours (`--nav-hue-*`, `--theme-violet` and
the other section colours). They are how people find a group, and the 2026-10-27 frame design
keeps them the same everywhere. A theme may set its own only where Slate's would not suit; the
colour-blind safe theme does.

### Built-in themes

Slate (default), Forest, Ocean, Sunset, Lavender, Graphite (high contrast) and Colour-blind safe
(Okabe and Ito colours, so good and bad never rely on red against green). Slate is not derived:
its colours stay in `src/styles/themes/dark.css` and `light.css`, so the default look is exactly
what it was, and choosing Slate removes every override. Its seeds in the catalog are only the
starting point of a personal palette and the swatches of its chip.

### Mode and palette are separate

`data-theme` stays `light` or `dark` (and the `cf_admin_theme` cookie still holds light, dark or
system); the palette is a second attribute, `data-palette`. Every palette has both modes, so the
top bar's light/dark button works the same with any of them.

### How a theme reaches the page

| Step | Where |
|---|---|
| The choice is stored | D1 `admin_user_settings.preferences.look` (`{ palette }`, plus the eighteen colours for "custom"); `preferences.lookSetBy` names who chose it when that was someone else |
| A copy for speed | the `cf_admin_look` cookie: the id, and for a custom or shared theme its eighteen colours packed as hex (108 characters) |
| First paint | `AdminLayout.astro` decodes the cookie (`decodeLookCookie`: anything it did not write is refused) and writes the theme's CSS, both modes, into `<style id="cf-look">` in the head, with `data-palette` and the browser bar's colours on `<html>`. No database read on any page |
| A change on Settings | `showLook` in `theme-client.ts` swaps the same `<style>` and attributes in place and sets the cookie; the server saves D1 and sends the cookie back |
| Another device, or a manager's change | once a tab, after the page is idle, `syncLookOnce` asks `GET /api/settings/user` for `lookCookie` and repaints if it differs |

The CSS is built only from colours that matched `#rrggbb` and an id that matched
`LOOK_ID_RE`, so a crafted cookie cannot inject anything (`test/theme-engine.test.ts`).

### Motion

Changing a theme, and since this design the light/dark switch too, runs inside
`document.startViewTransition` when the browser has it (Chrome, Edge, Safari 18 and Firefox 144
onwards). Pressing the light/dark button (top bar or account menu) or a theme chip on Settings
gives the circular reveal Harshil asked for from the Dashboard V22 clip: the new colours grow as a
circle from the press until they cover the screen, over the old page (`withTransition` with a
`RevealFrom` point, a clip-path animation on `::view-transition-new(root)`, 560 ms). Anything
else, such as a colour typed in the editor or a sync from another device, is one cross-fade of
the whole page. A person who asked their device for less motion (`prefers-reduced-motion`) gets
the change at once. No animation library is added.

### The old Tailwind colour classes: a bridge, not a rewrite

About 3,600 classes such as `text-slate-400`, `bg-blue-500/10` and `border-rose-800`, most of
them in Emails, SEO, Storage and Inquiries, were written before the tokens. Tailwind 4 paints each
from a variable (`--color-slate-400`), so `src/styles/themes/bridge.css` points those variables at
the theme's tokens under `:root[data-palette]` and `:root[data-theme='light']`: the grey families
become the text strengths and the surfaces, and each colour family follows one token (blue the
accent, emerald good, amber warning, rose bad, cyan information, violet the second accent). Slate
in dark has neither attribute and keeps Tailwind's colours, which its tokens were made from, so
the default look does not move; the light mode, which was wrong in those areas, now follows its
tokens too. Rewriting the classes one by one was rejected: thousands of changed lines for the
same result, and every later page would need the same care. New code still paints with the
tokens.

### Contrast rules

`src/lib/themes/contrast.ts`, WCAG 2.1 AA: 4.5:1 for words (1.4.3), 3:1 for shapes a person
must see (1.4.11). Checked pairs: text on the background and on cards, secondary and quiet text
on cards and raised cards, hints (3:1), the words on the accent and on bad, the accent as a link,
the highlight (3:1), and good, warning, bad and information as words on cards, plus a theme's own
group colours (3:1).

- Built-in themes must pass every rule in both modes; the test fails otherwise.
- A shared theme must pass them all; Settings will not offer to save it and the server refuses it
  with the failing pairs (422).
- A personal palette is shown the same list as warnings and may still be saved. WCAG 1.4.8
  (AAA) asks that a person can choose their own foreground and background colours, and some
  people need low contrast (for example with light sensitivity), so the portal does not overrule
  them.

Slate's light status colours failed 1.4.3 as words (Tailwind's 500 and 600 steps, 2.5 to
3.7:1). They are now the 700 steps (`#15803d`, `#b45309`, `#dc2626`, `#1d4ed8`), so the default
passes too.

On the legal side: the DOJ's 2024 ADA Title II rule adopts WCAG 2.1 AA for state and local
governments, with compliance dates later moved to 2027 and 2028; private businesses have no
federal rule that names a standard. These themes help meet WCAG 2.1 AA, and this document makes
no claim that the portal "complies with the ADA".

### Who may do what

| Action | Permission | Default |
|---|---|---|
| Pick a theme, make your own colours | the Settings page | every role |
| Add, change or delete a shared theme | `/dashboard/settings#themes` | Owner (and Vendor support); grantable to anyone |
| Set someone else's colours | `/dashboard/settings#colours`, and only for a person below your own role (Vendor support: anyone) | the Admin tier and above |

Both keys are checked by exact key (`placRequireGrant`), so a session whose page map has no row
for them is refused. Light or dark stays each person's own choice; a manager sets colours only.
Every change is audited (module `settings`).

### Storage, and why no new table

- A person's colours: the existing `preferences` JSON of `admin_user_settings`, which existed for
  exactly this ("extensibility for future settings without schema changes"). Theme-only saves
  used to write `{}` over it; `upsertUserSettings` now keeps it, and `saveLook` writes only its
  key with `json_set`.
- Shared themes: one existing-table row, `admin_portal_settings` `themes:shared`, a JSON list of
  at most 24, written by compare-and-swap (`swapGlobalSetting`) so two saves never overwrite each
  other.
- Permissions: two rows in `admin_pages` (migration `0099`).

No new table, KV namespace, environment variable, binding or package (RULE #0.6, #0.8, #0.9).

### Cost

$0 a month. The cookie adds about 120 bytes to each request for a person on a custom or shared
theme. The head's `<style>` is about 3 KB for a non-Slate theme. One extra D1 read a tab
(`syncLookOnce`) and one on Settings. No KV writes.

## What this does not do yet

- **Fixed colours in page CSS.** About 900 hex and rgba values in page stylesheets do not follow
  any theme yet; they move onto tokens area by area (MAINTENANCE (private)).
- **The consoles** (Backups, Server, Email API) follow light and dark, not the palette.
- **The Dashboard V22 look** (bento cards, count-up numbers, the circular reveal) is a separate
  piece of work on the Overview.

## Verification

- `test/theme-engine.test.ts`: every built-in theme passes every rule in both modes; the
  derivation sets every token Slate's stylesheets define (section colours excepted); the cookie
  codec round-trips and refuses anything else; the layout paints from the cookie; the change
  honours reduced motion.
- `test/api-settings-user.test.ts` and `test/api-settings-themes.test.ts`: saving, merging,
  the two permissions, the role ceiling, the contrast refusal, the limit of 24, the audit, and
  migration `0099`.
- Migration `0099` applied to production through the Cloudflare D1 connector before the push
  and read back ([schema change ledger](../reference/schema-change-ledger.md)).

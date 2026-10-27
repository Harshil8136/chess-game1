---
title: "The portal's frame: sidebar, top bar and phone menu — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-27
verified_against: [code]
owner: harshil
related_code: [src/styles/components/shell.css, src/lib/access-center/categories.ts, src/layouts/AdminLayout.astro, src/layouts/AdminLayout.css, src/components/navigation/Sidebar/index.tsx, src/components/navigation/Sidebar/SidebarHeader.tsx, src/components/navigation/Sidebar/SidebarMenu.tsx, src/components/navigation/Sidebar/SidebarProfile.tsx, src/components/navigation/TopBar.tsx, src/components/navigation/CommandPalette.tsx, src/components/navigation/ThemeToggle.tsx, src/components/navigation/RegistryTabs.astro, src/lib/theme-client.ts, public/scripts/theme-init.js, src/components/ui/Dialog.css, test/shell-look.test.ts]
related_docs: [../reference/DESIGN-SYSTEM.md, 2026-10-26-overview-glass-look.md, ../records/reports/2026-10-27-portal-frame.md, ../records/reports/2026-10-27-portal-frame-seamless.md]
tags: [design, ui, navigation, sidebar, mobile, accessibility]
---

# The portal's frame: sidebar, top bar and phone menu — design

> **TL;DR (non-technical):** The part of the portal that stays on screen around every page runs
> edge to edge: the list of pages down the left edge, a bar along the top, the page in the rest,
> and one thin line between them, with no gaps or rounded corners. All of its colours come from
> one small set made for it, so the background, the words, the icons, the lines and the mark on
> the page you are on always match each other, in both themes. Each group of pages has its own
> colour, made a shade lighter for the dark theme and a shade deeper for the light one so it reads
> well in both: its icons, a dot beside its name, and the mark on the page you are on. On a phone the top bar holds four things (the menu, the page's name, search and
> reload) with buttons big enough for a thumb, and the menu is the same sidebar sliding in from
> the left. Your account has one place, at the foot of the menu.

## 1. Why

On 2026-10-27 Harshil asked to "do the core theme like sidebar, header options, mobile etc",
after the Overview and Analytics had been redrawn in glass. Reading every part of the frame
turned up faults besides its look, fixed in the first version (commit `314cb55`, its
record (private)):

- **Two account menus:** the sidebar ended with "Log out", the top bar had a menu with "Sign out".
- **Pop-ups that were not real pop-ups:** the phone menu and the page search were hand-made
  overlays a keyboard could leave, and the search stayed dark in the light theme.
- **A crowded phone bar** of six things, most under 44 px; ⌘K and Ctrl K on the same screen;
  "Force Page Revalidation" as a button's name.
- **A moving background** of drifting circles and a full-screen texture, which a phone redraws
  on every frame; a white phone browser bar; no room for a notch or a home bar.

That first version drew the sidebar as a pane of frosted glass with a margin round it, beside
the page on a rounded panel of its own, over a still blur of colour. Harshil turned it down the
same morning: "I dont like that theres edges left on all sides and space in between, it should
be seamless and also can we take a bit different approach compare to existing one thats more
suitable for sidebar system design types! cuz we also have to sync bg color, icon/svg color and
all!" This document describes the design that replaced it (its
record (private)); the faults above stay fixed.

That version also drew every icon in the colour of its words, so the sidebar had no colour left.
Harshil chose it as the look that evening, and in the same minute wrote "You made sidebar
completely color less! Thats terrible!": "sync icon/svg color" had meant keeping the colours and
linking them to the theme, not dropping them. Each group's colour came back as a pair of the
frame's own tokens, one for each theme (§4).

## 2. How sidebar systems do it

The approach follows what established design systems publish for their navigation:

- **IBM Carbon's UI shell:** the left panel "spans the full height of the browser and is fixed to
  the left edge of the window". A link's text is `$text-secondary` and its icon
  `$icon-secondary`; on hover and when selected both turn primary together, and a selected link
  adds `$background-selected` and a 4 px `$border-interactive` edge.
- **shadcn/ui's Sidebar:** the default `sidebar` variant is flush (`floating` and `inset` are the
  boxed variants), themed by its own tokens: `--sidebar`, `--sidebar-foreground`,
  `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring`.
- **Material 3's navigation drawer:** one token set for the container, the inactive icon and
  label (both `on-surface-variant`) and the active indicator, with the active icon and label in
  one colour.

What they share, and this frame takes: the frame sits flush against the screen's edges; it has
its own small set of colours, each set for each theme; the page on screen is marked by a tint,
a shape and stronger words, never by colour alone. Where it parts from them: their icons take
the colour of their words, while here each group keeps a colour of its own, on Harshil's word.
The colour stays a token of the frame's set, checked against each theme's surface, so it still
changes with the theme.

## 3. The pieces

| Piece | Where | What it is |
|---|---|---|
| Sidebar | `.sh-pane` | 240 px open, 64 px closed, the full height, on `--nav-bg`. Its dividing line is a shadow (`inset -1px 0 0`), so it takes no width: 64 px less 12 px of padding each side leaves a 40 px row with its icon in the middle |
| Name row | `.sh-brandrow`, `SidebarHeader.tsx` | 56 px, with a line under it: the same height as the top bar, so the two lines read as one across the screen. The hotel's round badge as it is drawn, with a faint ring, beside "Madagascar" over "Admin portal" |
| Groups | `data-nav-hue` on each group (`SidebarMenu.tsx`), from `hue` in `src/lib/access-center/categories.ts` | Sets `--nav-hue` to the group's colour for the theme on screen; a row outside a group (search, the account) keeps `--nav-icon` |
| Rows | `.sh-row` | 40 px. Words in `--nav-fg-2`, the icon in its group's `--nav-hue`; touched, the words turn `--nav-fg` on `--nav-hover` |
| The page on screen | `.sh-row[aria-current='page']` | Its group's colour as a tint (`--nav-hue` at `--nav-tint`) and a 3 px bar on its left, with bold words in `--nav-current-fg` |
| Group names | `.sh-group`, `.sh-group__dot` | Small capitals in `--nav-fg-3` after a dot in the group's colour |
| Account | `.sh-account`, `SidebarProfile.tsx` | Initials on `--nav-fg` with a dot in the role's colour (the frame's one colour of its own, because it names a role), name and role; pressed, it opens above itself: email, the theme, Settings, Sign out |
| Top bar | `.sh-topbar`, `TopBar.tsx` | 56 px on `--nav-bar` with a `--nav-line` under it. Buttons have no box until touched. Wide: the breadcrumbs, a "Search pages" field with its shortcut, reload, theme. Phone: menu, the page's name, search, reload, each 44 px |
| Phone menu | `.sh-drawer` on the shared Dialog, `layout="side"` | The same sidebar from the left edge, square, on `--nav-bg`, up to 19rem and never more than 86 % of the screen; its name row lines up with the top bar's line |
| Page search | `.sh-palette` on the shared Dialog | A field over a list of pages, each drawn like a sidebar row, with its icon on a tile tinted in its group's colour (`data-nav-hue` in `CommandPalette.tsx`): the chosen one has the same tint and marker, and its tile turns plain (`--nav-bg`) so the icon is not on two tints |
| Sub-page row | `RegistryTabs.astro` | A pill row whose current tab takes `--nav-current` and `--nav-current-fg` |
| A name beside the closed sidebar | `.sh-tip` | The frame's colours turned round: `--nav-bg` words on `--nav-fg` |

## 4. Colour

Every colour of the frame is a `--nav-*` token in `src/styles/components/shell.css`, set on
`:root` for the dark theme and under `:root[data-theme='light']` for the light one. No rule after
the two token blocks writes a colour of its own, and the frame's components carry no Tailwind
colour classes (`test/shell-look.test.ts` checks both).

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--nav-bg` | the theme's `--theme-bg`, `#080e1a` | the theme's `--theme-bg`, `#f8fafc` | the sidebar and the phone menu |
| `--nav-bar` | `--nav-bg` | `--nav-bg` | the top bar, and the phone browser's bar |
| `--nav-line` | slate at 14 % | slate-900 at 9 % | every line of the frame |
| `--nav-fg`, `-2`, `-3` | `#f1f5f9`, `#cbd5e1`, `#94a3b8` | `#0f172a`, `#475569`, `#5b6475` | names, rows, group names and hints |
| `--nav-icon` | `#94a3b8` | `#64748b` | an icon outside a group: the sidebar's buttons, the search row, the account |
| `--nav-hover`, `--nav-control` | slate at 10 % and 6 % | slate-900 at 5 % and 3 % | a touched row; the search fields |
| `--nav-hue-*` | Tailwind's 400 step | the 600 step (700 for amber) | each group's colour, in the table below |
| `--nav-tint` | 16 % | 12 % | how much of the group's colour tints the page on screen and a search tile |
| `--nav-current`, `-fg` | blue at 18 %, white | blue at 10 %, `#0f172a` | the words of the page on screen; the sub-page row's current tab |
| `--nav-danger` | `#fda4af` | `#be123c` | Sign out, a count badge |
| `--nav-ring` | the theme's `--theme-accent` | the theme's `--theme-accent` | the keyboard's focus ring |

Each group's colour (`hue` in `src/lib/access-center/categories.ts`, a `data-nav-hue` that sets
`--nav-hue`):

| Group | Colour | Dark | Light |
|---|---|---|---|
| Daily work | cyan | `#22d3ee` | `#0891b2` |
| Website | emerald | `#34d399` | `#059669` |
| Communication | indigo | `#818cf8` | `#4f46e5` |
| People and access | amber | `#fbbf24` | `#b45309` |
| Privacy and records | rose | `#fb7185` | `#e11d48` |
| System | blue | `#60a5fa` | `#2563eb` |
| Developer | red | `#f87171` | `#dc2626` |
| A group not in the list | slate | `#94a3b8` | `#64748b` |

The light theme takes a deeper step than the dark one because the 400 and 500 steps fall under
3:1 on its pale surface, as do the light theme's own `--theme-cyan` (2.7:1) and
`--theme-emerald` (2.4:1), which is why the frame has its own. The frame's surfaces are the theme's own `--theme-bg`, so the frame
and the page are one colour and change with the theme together. The sub-page rows mark their
current tab in the portal's own blue, the blue of its buttons and focus rings.

**Contrast**, worked out by `test/shell-look.test.ts` from the token values, the lowest of each
on the sidebar and on a touched row: dark `--nav-fg` 15.4:1, `-2` 11.4:1, `-3` 6.6:1, danger
8.9:1; light 15.4:1, 6.6:1, 5.2:1 and 5.4:1. The page on screen's words on its group's tint:
14.3:1 dark and 14.2:1 light on the sidebar, 12.8:1 and 14.8:1 in the page search; on a
sub-page tab, 14.2:1 and 14.9:1. Shapes need 3:1 (WCAG 1.4.11): a group's colour (its icons, its
dot, the marker) is at least 5.2:1 in the dark theme (indigo on its own tint) and 3.1:1 in the
light one (cyan on its own tint), and 3.2:1 on a search tile; the plain icon 6.6:1 and 4.1:1.

**The phone browser's bar** is `--nav-bar` of the theme on screen (`THEME_COLOR` in
`src/lib/theme-client.ts`): the server writes it from the cookie and
`public/scripts/theme-init.js` follows every later change, so the browser's bar and the top bar
read as one band.

## 5. Other looks, as token values

Harshil was shown two more versions on 2026-10-27 beside this one: the sidebar and top bar in
one shade with the page in another ("Frame and page"), and the frame near-black in both themes
with the paw's green from the logo marking the page on screen ("Dark frame"). Either is a change
of the `--nav-*` values and of `THEME_COLOR` only; no component would change. He chose this one,
"One colour", on 2026-10-27, with the group colours back (§1).

## 6. Speed and motion

- No backdrop, no blur and no texture in the frame: nothing under it has to be redrawn.
- The only motion: the menu slides in from the left, the search fades up, the sidebar's width
  when it opens or closes (200 ms), and the reload icon turning while the page loads. All of it
  stops for a phone set to reduce motion.

## 7. Phones

- `viewport-fit=cover`, with every inset kept clear: the top bar starts under the clock and the
  notch (`calc(3.5rem + env(safe-area-inset-top))`), the page's sides when the phone is turned,
  the main content's bottom, the phone menu, the toasts and the Dialog's sheets.
- Every button in the top bar is 44 px on a touch screen, as is every row in the phone menu.
- The page's name in the top bar is 16 px; the parent pages show from 640 px wide.
- No keyboard shortcut shows on a touch screen. The search field is 16 px, so a phone does not
  zoom in when it is touched.
- The page scrolls inside the frame, so a phone has no pull to refresh: the reload button stays
  on the phone's top bar for that reason.

## 8. What was decided against

- **A pane and a panel with space around them** (the first version): turned down by Harshil for
  its edges and gaps.
- **Every icon in its words' colour**, as the sidebar systems above draw them (the edge-to-edge
  version's first colouring): it left the sidebar with no colour, and Harshil turned it down.
- **The old group colours** (`SECTION_ACCENT`, Tailwind classes: the 500 step at 80 % in the
  light theme, the 400 step at 90 % in the dark one): faded that way, six of the eight light ones
  fell under 3:1 (amber at 1.8:1). The colours are the same family, now a pair of the frame's
  tokens per group.
- **A backdrop behind the frame:** with the frame on the theme's colour there is nothing for it
  to show through, and page text never has to be read over it.
- **A second account menu in the phone's top bar:** one place keeps "Sign out" in one spot.
- **Rows as links inside the search's list:** the list is a `listbox` of options, the pattern a
  screen reader announces as the arrows move.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-27 (third) | §1, §2, §3 (groups, rows, page on screen, group names, page search), §4 (the tokens and the group colours, contrast), §5 and §8 rewritten for the group colours as built: `shell.css` (`--nav-hue-*`, `--nav-tint`, `[data-nav-hue]`), `categories.ts` (`hue`, `categoryHue`), `SidebarMenu.tsx`, `CommandPalette.tsx`; the contrast figures from the token values (`test/shell-look.test.ts` and a one-off script over the same values) | The look on a phone and on a computer in both themes (the owner's test) |
| 2026-10-27 (second) | Rewritten for the edge-to-edge frame from the code as built: `shell.css` (the `--nav-*` tokens and every rule), `AdminLayout.astro`/`.css`, `Sidebar/index.tsx` (64 px), `SidebarHeader.tsx`, `SidebarMenu.tsx`, `CommandPalette.tsx`, `RegistryTabs.astro`, `theme-client.ts`; the contrast figures from the token values (`test/shell-look.test.ts` and a one-off script over the same values); Carbon's left-panel specification, shadcn's Sidebar theming and Material 3's navigation drawer specification, read on their sites | The look on a phone and on a computer in both themes (the owner's test) |
| 2026-10-27 | Written from the first version as built (the glass pane) | The look on a phone |

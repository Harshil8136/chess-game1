---
title: "The portal's frame: sidebar, top bar and phone menu — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-27
verified_against: [code]
owner: harshil
related_code: [src/styles/components/shell.css, src/layouts/AdminLayout.astro, src/layouts/AdminLayout.css, src/components/navigation/Sidebar/index.tsx, src/components/navigation/Sidebar/SidebarHeader.tsx, src/components/navigation/Sidebar/SidebarMenu.tsx, src/components/navigation/Sidebar/SidebarProfile.tsx, src/components/navigation/TopBar.tsx, src/components/navigation/CommandPalette.tsx, src/components/navigation/ThemeToggle.tsx, src/lib/theme-client.ts, public/scripts/theme-init.js, src/components/ui/Dialog.css, test/shell-look.test.ts]
related_docs: [../reference/DESIGN-SYSTEM.md, 2026-10-26-overview-glass-look.md, ../records/reports/2026-10-27-portal-frame.md]
tags: [design, ui, navigation, sidebar, mobile, accessibility]
---

# The portal's frame: sidebar, top bar and phone menu — design

> **TL;DR (non-technical):** The part of the portal that stays on screen around every page was
> redrawn in the Overview's frosted-glass style. On a computer the sidebar is a pane of glass over
> a still blur of colour and the page sits beside it on its own panel. On a phone the top bar holds
> four things (the menu, the page's name, search and reload) with buttons big enough for a thumb,
> and the menu slides in from the left with the same glass. Your account has one place, at the
> foot of the menu, where you also switch the theme, open Settings and sign out. The phone
> browser's bar takes the portal's colour instead of staying white.

## 1. Why

On 2026-10-27 Harshil asked to "do the core theme like sidebar, header options, mobile etc",
after the Overview and Analytics had been redrawn in glass. The frame they sit in was older and
had its own problems, found by reading every part of it:

- **Two account menus.** The sidebar ended with your name and "Log out"; the top bar had an
  avatar menu with your name, email, Settings and "Sign out".
- **Pop-ups that were not real pop-ups.** The phone menu and the page search were hand-made
  overlays: a keyboard's Tab walked out of them into the page behind, and their parts were
  marked as buttons that were not buttons. The search was always dark, even in the light theme.
- **A crowded phone bar:** menu, name, search, reload, theme and an avatar with an arrow, most
  under 44 px.
- **Mixed words:** ⌘K in the top bar and Ctrl K in the sidebar on the same screen; "Force Page
  Revalidation" as the reload button's name.
- **A moving background.** Three blurred circles drifted behind frosted panels for ever, and a
  full-screen texture layer was blended over the whole page: both make a phone redraw the glass on
  every frame, for an effect at 3 % to 15 % strength.
- **A white phone browser bar** over the dark portal, and no room kept for a phone's notch or home
  bar.

## 2. The pieces

| Piece | Where | What it is |
|---|---|---|
| Backdrop | `.sh-backdrop`, `--sh-scene` | Four soft circles of colour at the screen's corners over a base colour, wide screens only. It never moves |
| Sidebar pane | `.sh-pane` | Frosted glass (`backdrop-filter: blur(24px) saturate(160%)`) with a light top edge, an 8 px margin and a 20 px radius; a solid colour where the browser has no blur |
| Page panel | `.admin-content-area` (`AdminLayout.css`) | Beside the pane on a wide screen, with the same margin and radius, painted the theme's plain `--theme-bg`; the whole screen on a phone |
| Rows | `.sh-row` | Page names in `--sh-text-2`; the page on screen a pill in the ink colour; group names a quiet neutral; a group's colour is its icons' |
| Account | `.sh-account`, `SidebarProfile.tsx` | Initials with a dot in the role's colour, name, role; pressed, it opens above itself: email, the theme switch, Settings, Sign out |
| Top bar | `.sh-topbar`, `TopBar.tsx` | 56 px. Wide: the breadcrumbs, "Search pages" with its shortcut, reload, theme. Phone: menu, the page's name, search, reload |
| Phone menu | `.sh-drawer` on the shared Dialog, `layout="side"` | The sidebar's header, list and account from the left, up to 19rem and never more than 86 % of the screen, painted with the backdrop's colour under its glass |
| Page search | `.sh-palette` on the shared Dialog | Near the top, so a phone's keyboard leaves it in view. A field over a list of pages; arrows move, Enter opens |
| Sub-page row | `RegistryTabs.astro` | A pill row whose current tab is in the ink colour, matching the sidebar and the Overview's switches |

## 3. Colour

Every colour of the frame is a `--sh-*` token on `:root`, set once for the dark theme and once
under `:root[data-theme='light']` (`src/styles/components/shell.css`). Pages keep the Midnight
Slate tokens ([DESIGN-SYSTEM](../reference/DESIGN-SYSTEM.md) §2): only the sidebar sits on the
backdrop's colour, so no page text has to be readable over it.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--sh-base` | `#070a13` | `#e6e9f2` | under the circles |
| `--sh-blob-1..4` | violet, blue, deep violet, orange, 20 % to 55 % | indigo, sky, violet, peach, 80 % to 90 % | the four circles |
| `--sh-glass` | white at 5.5 % | white at 55 % | the pane, and the phone menu over its own circles |
| `--sh-text`, `-2`, `-3` | `#f5f3ff`, `#d4d0e6`, `#bab5d2` | `#14121c`, `#3f3b4d`, `#585369` | names from strongest to quietest |
| `--sh-ink`, `--sh-ink-text` | `#f5f3ff`, `#0b0d17` | `#16131f`, white | the page on screen, the avatar, the chosen tab |
| `--sh-danger` | `#fda4af` | `#be123c` | Sign out, a count badge |

**Contrast.** Each text colour is checked against the pane where it sits over the strongest point
of each circle, and over a hovered row there, by `test/shell-look.test.ts`, which reads the
tokens from the stylesheet. The lowest figures: dark `--sh-text` 8.7:1, `-2` 6.3:1, `-3` 4.8:1,
danger 5.0:1; light 13.9:1, 8.1:1, 5.5:1 and 4.7:1; ink text on ink 17.7:1 and 18.3:1. The first
quiet grey tried, `#aaa5c4`, fell to 4.0:1 over a hovered row on the blue circle and was lightened.
The light theme's group names had been teal and cyan at about 3.7:1 on white; they are now the
neutral `--sh-text-3`.

The phone browser's bar is `--theme-bg` of the theme on screen (`THEME_COLOR` in
`src/lib/theme-client.ts`): the server writes it from the cookie and `public/scripts/theme-init.js`
follows every later change of theme, so the bar and the top bar read as one surface.

## 4. Speed and motion

- The backdrop is still. A moving one makes every glass pane above it re-blur on every frame,
  which a phone pays for in battery and smoothness; the Overview's own spec rejected moving
  circles for the same reason. The texture layer, blended over the whole screen, went too.
- The circles are plain gradients, not blurred shapes, so they cost one paint.
- On a phone there is no backdrop at all: the page panel covers the screen, and the phone menu
  paints its colour under a flat tint, with no `backdrop-filter`.
- The only motion: the menu slides in from the left, the search fades up, the sidebar's width
  when it opens or closes (200 ms), and the reload icon turning while the page loads. All of it
  stops for a phone set to reduce motion.

## 5. Phones

- `viewport-fit=cover`, so the portal reaches the screen's edges, and every inset is kept clear:
  the top bar's top, the panel's sides when the phone is turned, the main content's bottom, the
  phone menu, the toasts and the Dialog's sheets. Before this, every `env(safe-area-inset-*)` in
  the code read 0.
- Every button in the top bar is 44 px on a touch screen, as is every row in the phone menu.
- The page's name in the top bar is 16 px; the parent pages show from 640 px wide.
- No keyboard shortcut shows on a touch screen.
- The search field is 16 px, so a phone does not zoom in when it is touched.
- The page scrolls inside the frame, so a phone has no pull to refresh: the reload button stays
  on the phone's top bar for that reason.

## 6. What was decided against

- **The backdrop behind the pages.** Page text sits directly on the page colour in many places;
  over coloured circles the light theme's quiet text (`#71717a`, 4.6:1 on its own background)
  would drop below 4.5:1 almost at once. The page panel keeps every page exactly as readable as
  it was.
- **A second account menu in the phone's top bar.** One place for the account, in the menu, keeps
  "Sign out" in one spot; the bar keeps its room for the page's name.
- **Moving the theme switch out of the wide top bar.** It stays there as a shortcut, as well as
  in the account menu; on a phone it is in the menu only.
- **Rows as links inside the search's list.** The list is a `listbox` of options, the pattern a
  screen reader announces as the arrows move; links inside options are read inconsistently.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-27 | Written from the code as built: `shell.css` (tokens, pieces, sizes), `AdminLayout.astro`/`.css`, the Sidebar files, `TopBar.tsx`, `CommandPalette.tsx`, `ThemeToggle.tsx`, `theme-client.ts`, `theme-init.js`, `Dialog.css` (`side`); the contrast figures computed from the token values by `test/shell-look.test.ts` and a one-off script over the same values | The look on a phone and on a computer in both themes (the owner's test) |

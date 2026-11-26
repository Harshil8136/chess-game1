---
title: "@oltrem/core-ui: the tokens"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-ui/src/theme.css, ink.ts]
---

# @oltrem/core-ui: the tokens

> Part of [the @oltrem/core-ui README](../README.md).

## The tokens

`src/theme.css` is the whole vocabulary, kept short. Tailwind's default palette, type scale, radii
and shadows are reset (`bg-blue-500` does not exist; a test proves it).

| Group | Names |
|---|---|
| Colours | `bg`, `surface`, `surface-raised`, `border`, `fg`, `fg-muted`, `primary`, `accent`, `ok`, `attention`, `danger`, `info`, `focus`, each with a `-fg`; `fill`, `fill-fg` (main button, a switch on, a count); `field` (a text box) |
| Brand (the client's generated `/theme.css`) | `--brand-primary`, `--brand-primary-dark`, `--brand-accent`, `--brand-radius`, `--brand-font`, falling back to the kit's |
| Spacing | Tailwind's 4 px scale, plus `gutter` 16, `row-h` 44, `row-h-form` 56, `touch` 44 |
| Radius | `sm` 4, `md` the brand radius (10), `lg` 12, `full` |
| Type | `xs` 12/16 to `2xl` 24/32; weights 400, 500, 600; `tabular-nums` for data |
| Shadows, motion | `sm`, `md`; `fast` 120 ms, `base` 200 ms, one `ease-out` |
| Group colours | `--ui-hue-blue`, `green`, `amber`, `rose`, `cyan`, `violet`, `teal`, `slate`, each 3:1 or better in both themes; `data-hue` sets the element's `--hue` (`ui-hue-tile`, `ui-hue-card`) |
| Surfaces | `ui-canvas` (the plain page), `ui-glass` (a solid bar), `ui-page` (the content a page change moves, a size container for `@xl:`; full width beside the sidebar with a 16, 24 (1024 px) or 32 px (1536 px) gutter; `data-kind="form"` 64 rem under a full-width head, `"door"` 40 rem), `ui-head` (`-row`, `-text`, `-tools`, `-tile`, `-set`) and `ui-crumbs`. Below 1024 px a head with `data-bar` drops its tile and line under `ui-phone-bar`. `scrollbar-gutter: stable` |
| The frame | `ui-frame` (`data-side` open or closed), `ui-side` (`-head`, `-search`, `-nav`, `-group`, `-row`, `-foot`, `-me`, `-menu`, `-themes`, `-tip`), `ui-side-drawer`, `ui-wait` and `ui-orb` (loading); 18 px icons on one column, a 64 px rail when closed |

Light and dark share names; dark follows `prefers-color-scheme` unless `<html data-theme>` says
otherwise. Every text-on-colour pair reads at 4.5:1 in both, computed by a test from the OKLCH
values. Dialogs, popovers and toasts use the top layer; only the frame carries a z-index.

**Motion.** Page to page is one 150 ms fade (the frame's view transition, or `@view-transition`
without the script); nothing on a page slides or grows in by itself, and there is no
`backdrop-filter`. The marked tab glides on a `ui-mark`; sidebar groups fold through a `0fr` grid
track; drawers slide; a dialog's shade fades both ways (`@starting-style`, `allow-discrete`); folds
drop in (`ui-unfold`); buttons press to 96%. None of it runs under reduced motion.

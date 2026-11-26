---
title: "@oltrem/core-ui: The tokens"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-ui/src; split from packages/core-ui/README.md]
---

# @oltrem/core-ui: The tokens

> Part of [the @oltrem/core-ui README](../README.md).

## The tokens

`src/theme.css` is the whole vocabulary, and it is deliberately short so an agent holds it in
its head. Tailwind's default palette, type scale, radii and shadows are reset: `bg-blue-500`
does not exist here, and a test proves it.

| Group | Names | Utilities |
|---|---|---|
| Colours | `bg`, `surface`, `surface-raised`, `border`, `fg`, `fg-muted`, `primary`, `accent`, `ok`, `attention`, `danger`, `info`, `focus`; each colour text sits on has a `-fg`; `fill` and `fill-fg` for a main button, a switch that is on and a count (in dark, the primary at 52% lightness with white text), `field` for a text box | `bg-primary`, `text-primary-fg`, `bg-fill`, `border-danger` |
| Brand (from the client's generated `/theme.css`) | `--brand-primary`, `--brand-primary-dark`, `--brand-accent`, `--brand-radius`, `--brand-font` | fall back to the kit's values when unset |
| Spacing | Tailwind's 4 px scale, plus `gutter` 16, `row-h` 44, `row-h-form` 56, `touch` 44 | `p-gutter`, `min-h-row-h`, `size-touch` |
| Radius | `sm` 4, `md` the brand radius (10), `lg` 12, `full` | `rounded-md` |
| Type | `xs` 12/16 to `2xl` 24/32; weights 400, 500, 600; `tabular-nums` for data | `text-sm`, `font-semibold` |
| Shadows | `sm`, `md` | `shadow-md` |
| Motion | `fast` 120 ms, `base` 200 ms, one `ease-out`; enter and exit through `@starting-style`; from page to page a view transition | `duration-(--duration-fast)` |
| Group colours | `--ui-hue-blue`, `green`, `amber`, `rose`, `cyan`, `violet`, `teal`, `slate`: one per group of sections, each at 3:1 or better on the page and the surface in both themes; `data-hue="green"` makes one the element's `--hue` | `data-hue`, `ui-hue-tile`, `ui-hue-card` (a bordered card on one flat tint of its hue, 2026-11-12) |
| Surfaces | `ui-canvas` (the page's background: plain, Calm and modern; it had two soft washes of the brand's colours), `ui-glass` (a bar over the canvas, solid: a blur behind it was redrawn on every frame of a scroll), `ui-page` (the content a page change moves, and a size container, so `@xl:` and `@3xl:` follow the page's width rather than the window's; it also lays the page out; the owner's no-wasted-room rule, it runs the full width beside the sidebar with a 16 px gutter on a phone, 24 px from 1024 px and 32 px from 1536 px, `data-kind="form"` keeping the content to 64 rem under a full-width head, `data-kind="door"` a 40 rem column), `ui-head` and its parts (`-row`, `-text`, `-tools`, `-tile`, `-set`) and `ui-crumbs`: the page's head, drawn by `@oltrem/screens` (since 2026-11-11 the row centres the heading and its actions, which stay beside a short heading and go under a long one); below 1024 px a head marked `data-bar` keeps its heading and actions but drops its icon tile and line, under the phone's bar along the top (`ui-phone-bar`, 2026-11-11; Look 3's bottom bar is gone), with 16 px between its parts and nothing along the foot. A head sits on the page itself, with no band and no line under it; `ActionRow` and `CommandRow` buttons are 36 px under a finger and 32 under a mouse, the head's command centred on its line. The document keeps the scrollbar's room (`scrollbar-gutter: stable`), so pages of any height start at the same place | classes |
| The frame | `ui-frame` (with `data-side` open or closed), `ui-side` and its parts (`-head`, `-search`, `-nav`, `-group`, `-row`, `-foot`, `-me`, `-menu`, `-themes`, `-tip`), `ui-side-drawer`, `ui-wait` and `ui-orb` (the loading orb): the portal's sidebar, drawn by `@oltrem/screens`. Every row, the bell's too, sits on one column with 18 px icons; closed to a 64 px rail, the icons are on its centre line, the portal's mark stays at the top with the open button over it on hover, the unread count is a badge on the bell, and the list has no scroll bar but fades where more is hidden | classes |

Light and dark are the same names with different values; dark follows the system
(`prefers-color-scheme`) unless `<html data-theme="light">` or `dark` says otherwise. Every
text-on-colour pair reads at 4.5:1 or better in both, and a test computes the ratios from the
OKLCH values rather than trusting the author's eye. Dialogs, popovers and toasts use the
browser's top layer; only the frame (the sidebar, its account menu, the label beside the closed
rail and the loading line) carries a z-index.

From one page to the next, the frame's script (`@oltrem/screens`) swaps only the page's content and
fades it in with a view transition; with no script, the browser does the same across a load
(`@view-transition`, a cross-document view transition), and a browser without either just shows the
page. That is one fade of 150 ms and nothing else: no part of a page sharpens, rises, slides or
grows in on its own, and the frame's bars are solid, with no `backdrop-filter` anywhere. The marked
tab, segment and section draw their look on a `ui-mark` the frame's script adds, so it can glide; a
sidebar group's rows glide shut and open (a grid track to `0fr`, then hidden), the phone's folders
and section drawer slide out as they came, a dialog's shade fades both ways (`@starting-style` and
`allow-discrete`), a fold's contents drop in (`ui-unfold`) and a sidebar row gives to 98 % under a
press. None of it runs under reduced motion. Buttons press in a little when tapped (to 96 %, since
2026-11-08).

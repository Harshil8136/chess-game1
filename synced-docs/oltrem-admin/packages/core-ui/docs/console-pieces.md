---
title: "@oltrem/core-ui: console pieces, charts, daisyUI, the Email pieces, the three widgets"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-ui/src/console.tsx, charts.tsx, mail.tsx, widgets, theme.css]
---

# @oltrem/core-ui: console pieces, charts, daisyUI, the Email pieces, the three widgets

> Part of [the @oltrem/core-ui README](../README.md).

## The console pieces

`src/console.tsx`: solid panes on hairlines, one row of options on top, dense rows with a state at
their edge, numbers in a strip. A tone colour marks a state only, beside a glyph or word; a hue
marks identity only.

| Piece | Rule it keeps |
|---|---|
| `Toolbar`, `Segmented` | The page's options in one sideways row on a phone, wrapping when wide; current marked, with counts |
| `PaneGrid`, `Pane` | One column on a phone, two from 44 rem, three when asked from 60 rem; `span="all"`, or `"wide"` for two of three columns (a chart with a pane beside it); a pane is a size container with its own heading, icon and tools, its head wrapping |
| `PaneStacks` | Up to twelve panes, each with a `size` (its height guessed from its rows), put in the shortest of three columns from 60 rem so no pane leaves a gap beside a tall one; two columns from 44 rem, and one in their order on a phone. Never CSS columns (2026-11-24) |
| `Figures` | A `<dl>` row: label, number, note (no note on a phone); a tone colours the number; `href` links the whole figure; `current` underlines the one a chart below draws |
| `Rows`, `Row` | A lead, a one-line title, a line, an aside, a tone bar; a row's buttons outside its link; rows on the page sit on a card |
| `Avatar`, `initialsOf`, `hueFor` | Two letters on the hue the address always picks |
| `Timeline` | Each step an icon, state, time and detail |
| `Meter` | `<meter>`: green under 70%, amber to 90%, red above, with the figures in words |
| `CopyField` | The value whole and selectable; a `data-copy` button naming what it copies |
| `Facts` | Label above value, side by side from 26 rem |
| `ColumnChart` | An SVG sized by attributes, stacked columns by series, a key with totals, a table for a screen reader |

The report charts (`src/charts.tsx`) are drawn on the server, sized by attributes, every figure
said on hover and to a screen reader, a fixed height, in their pane's `data-hue` or the primary.

| Piece | Shows |
|---|---|
| `TrendChart` | A line a day over a fill fading from its hue, the period before dashed, a three-step scale (`niceTop`), 176 px high; `events` as dotted lines, listed under it. No browser titles: the readout is the one pop-up. Explorable ([the frame](../../screens/docs/frame-3.md)): `data-chart`, focus, the dashed line's key as a switch; `iso` with `open` (a day's page) and `zoom` (the page on days dragged across) |
| `Delta`, `moved` | `↑50%`, `↓25%`, `new`; green the good way, red the bad (`good: 'down'`), quiet when unmoved, full words for a screen reader |
| `Heatmap` | Rows by columns in five shades from the busiest, a key from Less to More |
| `SplitBar` | One bar in parts, each named with figure and share (a link when it has a page) |
| `BarList` | Names over bars of their share of the largest, an optional `Spark`, the figure (or `shown`) and its `Delta`; long names end in an ellipsis |

## daisyUI

A few daisyUI components run as a Tailwind plugin at build time only; no script reaches the
browser. `theme.css` names them (checkbox, radio, toggle, the text fields, progress) and fills its
one theme, `oltrem`, from the kit's tokens (`base-100` surface, `base-200` page, `base-300`
border, `primary` fill), so every look and dark mode reach it. daisyUI sits in a layer inside
`utilities`, so a kit rule that must beat it goes in `@layer utilities`, never `components`; a kit
piece never takes a daisyUI name (`hero`, `fab`, `filter`).

## The Email pieces

`src/mail.tsx` draws Email's screens the way Gmail and Outlook do; what each does is the page's.

| Piece | What it draws |
|---|---|
| `MailShell` | Folders with Compose and counts, the list, and the conversation beside it from 1024 px. Folders take a `group` (`main`, `more`, `labels`, `tools`): More folds, Labels with dots and `labels.add`, tools after a line; `apart`, `ownTabs`, `wide`; `meters` (`MailMeter`) drawn by `MeterLine` in `meterTone` colours. Inside the screens' frame it leaves its menu in the `SideMenu` slot (`SideMenuData`) and the frame draws it with `PageMenu` (`data-in-side`); alone, it draws its 13 rem pane and a phone drawer. Marked `data-preload` (`data-preload-skip` on Compose and +) |
| `SideMenu`, `PageMenu` | The slot, and the row under the page's head: Compose (round on a phone), a `ui-chip-row` of main folders and labels with counts, **More** (other folders, tools, New label, meters), a Settings chip when passed, the foot; gives way to an open email or Compose on a phone |
| `MailBar` | Tick-all, the commands for ticked rows and `end`; menus are `details.ui-menu`, a bottom sheet on a phone only here and in Write's Send bar (others open under their icon); `details.ui-drop` options `ui-drop-opt`, `ui-drop-check`, `ui-drop-chev` |
| `LABEL_COLORS`, `labelColor` | Nine label colours, `gray` first and the fallback |
| `ConversationRow` | Who, when, subject, first words, bold unread; a tick, a star form, hover buttons, `RowLabel` chips, a paperclip; `data-optimistic-row`, the star turning at once (`data-optimistic`) |
| `ComposeSheet` | A dialog docked bottom right from 640 px, full screen on a phone; a plain head, `aside` for a status; `mode="page"` in the flow with `ui-compose-grow`; `back` puts Menu (`PORTAL_MENU`) and Close in its head on a phone |
| `SidePanel` | A drawer `Dialog` from the side |
| `ProblemCard` | What stops the work and the one thing to do; an alert only with `tone="danger"` |
| `SaveBar` | Save and Discard for a form by id, rising once it changes |
| `UndoToast` | What a change did, with Undo as its own form, inside `Toasts` |

## The three widgets

Zag.js state machines through `@zag-js/preact`, for what native elements cannot do well. The kit
owns markup and look; the machine owns keyboard, focus and announcements. Each is a Preact island
rendered closed, so the HTML has no inline style; the popup mounts only while open.

| Widget | Rules it keeps |
|---|---|
| `Combobox` | A filtered list (`multiple` allowed); one hidden input per value, never the typed text; filters by label, case-insensitive; no clear button when required; words `triggerLabel`, `clearLabel`, `emptyLabel` |
| `Menu` | Commands with submenus, a link when it has `href`; destructive last; typeahead and arrows; `label` names trigger and menu |
| `DateRange` | Two typed dates and one calendar; quick ranges as chips; the form gets `<name>_start` and `<name>_end` as ISO dates; 44 px cells; locale week and names; `min`, `max`; `words` (`open`, `previous`, `next`, `clear`, `chooseMonth`, `chooseYear`) |

Not built yet: the primitives gallery page, and axe, 390 px screenshots and a CSP smoke test.
Every page's names, labels and viewport are checked on each verify.

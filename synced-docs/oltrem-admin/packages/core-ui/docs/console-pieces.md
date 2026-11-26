---
title: "@oltrem/core-ui: The console pieces; daisyUI and the Email pieces (Look 3); The three widgets"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-ui/src; split from packages/core-ui/README.md]
---

# @oltrem/core-ui: The console pieces; daisyUI and the Email pieces (Look 3); The three widgets

> Part of [the @oltrem/core-ui README](../README.md).

## The console pieces

Since 2026-10-31 (`src/console.tsx`) the kit has the pieces an operations console is made of: a
page reads as solid panes on hairlines, one row of options at the top, dense rows with a state at
their edge, and numbers in a strip. A tone colour marks a state only, always beside a glyph or a
word; a group's hue marks identity only. The pages of the email module are the first built from
them ([the record](../../../archive/records/2026-10-31-email-console-remake.md)).

| Piece | Built on | Rule it keeps |
|---|---|---|
| `Toolbar`, `Segmented` | a `role="group"` row; a `<nav>` of links | the page's options in one sideways row on a phone, wrapping on a wide page; the current option marked for the browser, each with its count |
| `PaneGrid`, `Pane` | a grid; a `<section>` with a heading, a line, an icon on a group's hue and its own tools | one column on a phone, two from 44 rem of page, three when asked from 60 rem; `span="all"` takes the row; a pane is a size container too; its head wraps, so a long title keeps whole words and its tools go under it |
| `Figures` | a `<dl>` of figures in a row | the label first, then the number and the note (the note is left out on a phone); a tone colours the number in its state's colour, an untoned number is in the text colour; an `href` makes the whole figure the link |
| `Rows`, `Row` | a `<ul>` under an optional heading; each row a link or a block | a lead (an avatar or a badge), a title on one line, a line under it, an aside, a tone bar at the edge; a row's own buttons sit outside its link; rows standing on the page rather than in a pane sit on a card of their own (Look 3) |
| `Avatar`, `initialsOf`, `hueFor` | `<span aria-hidden>` | two letters from the name or the address, on the hue the address always picks |
| `Timeline` | `<ol>` | each step an icon and its state, its time and its detail |
| `Meter` | the browser's own `<meter>` | green under 70 %, amber to 90 %, red above; the figures in words beside it, so the bar is never the only telling |
| `CopyField` | `<code>` and a button with `data-copy` | the value shown whole and selectable; the button names what it copies |
| `Facts` | `<dl>` | label above value on a narrow pane, side by side from 26 rem |
| `ColumnChart` | an SVG whose sizes are attributes, a key, a caption and a table for a screen reader | stacked columns by series, each column named on hover, each series keyed with its total; no inline style |

The report charts (`src/charts.tsx`, 2026-11-26, the Reports page remade) follow the same rules:
drawn on the server, sized by attributes and classes (never a style attribute), every figure said
on hover and to a screen reader, a fixed height whatever the data, and the hue of their pane
(`data-hue`), else the primary.

| Piece | Shows | Rule it keeps |
|---|---|---|
| `TrendChart` | a figure each day as a filled line, the period before as a dashed line, a scale of three steps (`niceTop`), the first, middle and last day | 176 px high; each day's figure and the same day before in a title; the key totals both periods |
| `Delta`, `moved` | how a figure moved: `↑50%`, `↓25%`, `new` | green the good way, red the bad way (`good: 'down'` for refusals), quiet when nothing moved; the full words for a screen reader |
| `Heatmap` | a grid of shades, rows by columns (a week of hours) | five steps from the busiest cell; each cell's figure in a title; a key from Less to More |
| `SplitBar` | one bar split into its parts, and the parts named under it with their figure and share | a part with a page and a count is a link |
| `BarList` | names over faint bars of their share of the largest, with an optional `Spark`, the figure and its `Delta` | a row a link; long names end in an ellipsis, never push the figures off the card |

## daisyUI and the Email pieces (Look 3)

Since 2026-11-08 the stylesheet also carries a few of daisyUI's components as a Tailwind plugin, run
only when the stylesheet is built: no script reaches the browser. `theme.css` names the ones taken
(checkbox, radio, toggle, the text fields and progress; buttons, badge, kbd, skeleton, loading, join
and tooltip, which no piece wears, left the list on 2026-11-20: with two rules for attributes
nothing sets, 820 bytes of stylesheet) and fills daisyUI's one theme, `oltrem`, from the kit's own
tokens, so `looks.ts` stays the one colour list and every look and dark mode reach daisyUI too:
`base-100` is the surface, `base-200` the page, `base-300` the border, `primary` the fill. `Switch`
is daisyUI's `toggle`, `Checkbox` and `Radio` its `checkbox` and `radio`, and the text fields carry
`input`, `select` and `textarea` beside the kit's own classes.

Two rules keep the two apart. daisyUI's rules sit in a layer inside Tailwind's `utilities`
layer, so a kit rule that must beat one goes in `@layer utilities` (the Look 3 block at the end
of `theme.css`), never in `components`. And daisyUI owns the class names it ships: a kit piece
never takes a name such as `hero`, `fab` or `filter`.

`src/mail.tsx` draws the pieces Email's screens are built from, the way Gmail and Outlook draw
theirs; what each one does is the page's.

| Piece | What it draws |
|---|---|
| `MailShell` | the folders with Compose on top and their counts, the list, and the open conversation beside it from 1024 px; on a phone (in place of the sideways row of chips) a button over the list names the folder on screen and opens the same pane as a drawer from the left (a popover, with its close, so it works without the script), Compose the round button at the bottom right, and an open conversation the whole screen with Back; a folder with `apart` sits after a line; `ownTabs` leaves out the page's tabs row when the folders hold the whole set; `wide` draws no list, the page (Compose) taking the room beside the folders; each folder may name its `group` (`main`, `more`, `labels`, `tools`), drawn as Gmail's: More folded and open by itself when it holds the current folder, Labels with a coloured dot each and `labels.add` as a plain + icon in the heading's row, then the tools after a line; `meters` (`MailMeter`: label, value, share, href) are drawn at the pane's foot by `MeterLine`, coloured by `meterTone` (green, amber from 70%, red from 90%, grey when unknown); the pane is 13rem wide, as wide as its longest name; the pane is marked `data-preload` so the frame keeps its pages in memory, Compose and the + marked `data-preload-skip`; a `MailShell` inside the screens' frame draws no pane and no phone folder button of its own: it leaves its folders, Compose, labels, meters and foot in the `SideMenu` context's slot (`SideMenuData`) and the frame draws them as a row under the page's head with `PageMenu`; the list and the reader take the room (`data-in-side`). Outside a frame (a test, a page drawn alone) the pane is drawn as before, its phone drawer headed by the set's name and a close button |
| `SideMenu`, `PageMenu` | the slot a page's own menu is left in while the frame renders the page (a Preact context holding `{ menu?: SideMenuData }`), and that menu drawn as a row under the page's head: Compose (from 1024 px; the round button on a phone), then one sideways `ui-chip-row` of the main folders and the labels (a coloured dot each) as chips with their counts, bold while unread; **More**, a menu that opens over the page with the other folders, the tools, New label and the meters, marked when it holds the page on screen; then, when the frame passes the set's Settings tab (`settings`), a Settings chip, never folded into More; the foot last, from 1024 px; the folder on screen `aria-current="page"`; marked `data-preload`; on a phone it gives way to an open email or Compose, which keep the whole screen under their own head |
| `MailBar` | the list's top bar: the box that ticks every row of the page's form, what shows while nothing is ticked, the commands for the ticked rows, and its `end` (the range), hidden on a phone while rows are ticked; its menus are `details.ui-menu`, a sheet from the bottom on a phone, closed by a press elsewhere or Escape; only a menu in this bar or Write's Send bar is a sheet, and any other `details.ui-menu` (a page head's More) opens under its icon on a phone too, growing from it as it fades in and fading out as it closes (`@starting-style`, `::details-content`), still under `prefers-reduced-motion`; `details.ui-drop` is a dropdown of one choice under its line instead, on a phone too: its options `ui-drop-opt` (48 px, tinted when chosen, a `ui-drop-check` tick), its arrow `ui-drop-chev` |
| `LABEL_COLORS`, `labelColor` | the nine label colours, `gray` first, and one read back from what a person chose, `gray` when it is none of them |
| `ConversationRow` | who, when, the subject and the first words, bold while unread; a tick for the page's bulk form, a star as a small form, buttons over the row's end under a mouse; its labels as coloured chips (`RowLabel`) and a paperclip for a file; the row is `data-optimistic-row` and its star turns at once (`data-optimistic`, the screens' frame) |
| `ComposeSheet` | a dialog docked to the bottom-right corner from 640 px and the whole screen on a phone; the body is the page's own; its head is plain, with the title and a line under it (like Gmail's; the brand's tint and the pen before), and `aside` puts a short status at its end (Email keeps its ready check in the Send bar since then); `mode="page"` the same card in the flow, as tall as the screen and edge to edge on a phone, its body's `ui-compose-grow` parts stretching the message down to the Send bar; `back` puts, on a phone, Menu (the portal's drawer, `PORTAL_MENU`) at the head's start and Close (to `back`) at its end, and below 1024 px the page's own head and the mail Back line give way to it: the card meets the top bar and the screen's edges, the Ready chip shrinks to its icon and the Send bar stays at the foot in one row |
| `SidePanel` | a drawer `Dialog` from the side |
| `ProblemCard` | what stops the work, calmly, with the one thing to do; an alert only with `tone="danger"` |
| `SaveBar` | Save and Discard for a form named by id, rising once the form has changes (the frame's script), always showing without it |
| `UndoToast` | what a change did with Undo as a small form of its own, inside `Toasts` |

## The three widgets

Three controls are too hard to build well on native elements alone: a filtered list, a menu with
submenus, and a date range on one calendar. The plan (12.3, the owner's choice) puts them on
Zag.js state machines through Zag's Preact adapter; the kit owns the markup and the look, the
machine owns the keyboard, the focus and the screen-reader announcements. Each is a Preact
island: the server renders it closed, so the HTML carries no inline style (the machine positions
the popup in the browser, through the style object, which the content security policy allows),
and the popup is mounted only while open.

| Widget | What it is | The rules it keeps |
|---|---|---|
| `Combobox` | an input with a filtered list; `multiple` for several values | the label is wired to the input; the form receives one hidden input per selected value, never the typed text; the list filters by label, case-insensitively; a disabled item is not selectable; the clear button is absent on a required field; the empty sentence is the caller's |
| `Menu` | a button that opens a list of commands, with submenus one level or more deep; a command is a link when it has an `href` | destructive commands last (rule 5); typeahead and arrow keys from the machine; the trigger names the menu |
| `DateRange` | two typed dates and one calendar in range mode, with optional quick ranges as a chip row, day, month and year views | the inputs show the client's locale; the form receives `<name>_start` and `<name>_end` as ISO dates; cells are 44 px; the week starts and the day names follow the locale; `min` and `max` bound the pick |

Words are the caller's, as everywhere in the kit: the combobox takes `triggerLabel`,
`clearLabel` and `emptyLabel`; the date range takes a `words` object (`open`, `previous`, `next`,
`clear`, `chooseMonth`, `chooseYear`); the menu's `label` is both the trigger's text and the
menu's accessible name. The day cells are announced with the date in the locale.

Still to come from the plan's list: the primitives gallery page, and of the quality gates of plan
12.6 axe, screenshots at 390 px and the CSP smoke test. Every page's names, labels and viewport
are checked on each verify ([the phone and accessibility check](../../../archive/records/2026-11-03-phone-a11y-check.md)).

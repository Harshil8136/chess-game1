# @oltrem/core-ui

The design kit of every client portal (plan section 12): a short token list as a Tailwind v4
theme, and the phone-first primitives as Preact components on native elements. One look across
every client; a client's brand comes in through four variables, never through a rebuild.

## The tokens

`src/theme.css` is the whole vocabulary, and it is deliberately short so an agent holds it in
its head. Tailwind's default palette, type scale, radii and shadows are reset: `bg-blue-500`
does not exist here, and a test proves it.

| Group | Names | Utilities |
|---|---|---|
| Colours | `bg`, `surface`, `surface-raised`, `border`, `fg`, `fg-muted`, `primary`, `accent`, `ok`, `attention`, `danger`, `info`, `focus`; each colour text sits on has a `-fg`; `fill` and `fill-fg` for a main button, a switch that is on and a count (in dark, the primary at 52% lightness with white text), `field` for a text box | `bg-primary`, `text-primary-fg`, `bg-fill`, `border-danger` |
| Brand (from the client's generated `/theme.css`) | `--brand-primary`, `--brand-primary-dark`, `--brand-accent`, `--brand-radius`, `--brand-font` | fall back to the kit's values when unset |
| Spacing | Tailwind's 4 px scale, plus `gutter` 16, `row-h` 44, `row-h-form` 56, `touch` 44 | `p-gutter`, `min-h-row-h`, `size-touch` |
| Radius | `sm` 4, `md` the brand radius (10), `lg` 12 (since 2026-11-01: cards, panes and figures share it), `full` | `rounded-md` |
| Type | `xs` 12/16 to `2xl` 24/32; weights 400, 500, 600; `tabular-nums` for data | `text-sm`, `font-semibold` |
| Shadows | `sm`, `md` | `shadow-md` |
| Motion | `fast` 120 ms, `base` 200 ms, one `ease-out`; enter and exit through `@starting-style`; from page to page a view transition | `duration-(--duration-fast)` |
| Group colours | `--ui-hue-blue`, `green`, `amber`, `rose`, `cyan`, `violet`, `teal`, `slate`: one per group of sections, each at 3:1 or better on the page and the surface in both themes; `data-hue="green"` makes one the element's `--hue` | `data-hue`, `ui-hue-tile`, `ui-hue-card` (a bordered card on one flat tint of its hue, 2026-11-12) |
| Surfaces | `ui-canvas` (the background with two soft washes of the brand's colours), `ui-glass` (a bar over the canvas, blurred behind), `ui-page` (the content a page change moves, and a size container, so `@xl:` and `@3xl:` follow the page's width rather than the window's; since 2026-11-01 it also lays the page out; since 2026-11-12, the owner's no-wasted-room rule, it runs the full width beside the sidebar with a 16 px gutter on a phone, 24 px from 1024 px and 32 px from 1536 px, `data-kind="form"` keeping the content to 64 rem under a full-width head, `data-kind="door"` a 40 rem column), `ui-head` and its parts (`-row`, `-text`, `-tools`, `-tile`, `-set`) and `ui-crumbs`: the page's head, drawn by `@oltrem/screens` (since 2026-11-11 the row centres the heading and its actions, which stay beside a short heading and go under a long one); below 1024 px a head marked `data-bar` keeps its heading and actions but drops its icon tile and line, under the phone's bar along the top (`ui-phone-bar`, 2026-11-11; Look 3's bottom bar is gone), with 16 px between its parts and nothing along the foot. The document keeps the scrollbar's room (`scrollbar-gutter: stable`), so pages of any height start at the same place | classes |
| The frame | `ui-frame` (with `data-side` open or closed), `ui-side` and its parts (`-head`, `-search`, `-nav`, `-group`, `-row`, `-foot`, `-me`, `-menu`, `-themes`, `-tip`), `ui-side-drawer`, `ui-progress`: the portal's sidebar, drawn by `@oltrem/screens`. Every row, the bell's too, sits on one column with 18 px icons; closed to a 64 px rail, the icons are on its centre line, the portal's mark stays at the top with the open button over it on hover, the unread count is a badge on the bell, and the list has no scroll bar but fades where more is hidden (2026-11-11) | classes |

Light and dark are the same names with different values; dark follows the system
(`prefers-color-scheme`) unless `<html data-theme="light">` or `dark` says otherwise. Every
text-on-colour pair reads at 4.5:1 or better in both, and a test computes the ratios from the
OKLCH values rather than trusting the author's eye. Dialogs, popovers and toasts use the
browser's top layer; only the frame (the sidebar, its account menu, the label beside the closed
rail and the loading line) carries a z-index.

From one page to the next, the frame's script (`@oltrem/screens`) swaps only the page's content
and fades it in with a view transition; with no script, the browser does the same across a load
(`@view-transition`, a cross-document view transition), and a browser without either just shows
the page. Inside a page that arrives, a `PaneGrid`'s panes and each figure's words sharpen in turn
from a light blur (`ui-sharpen`), and a `ColumnChart`'s columns grow from their base (`ui-grow`);
the marked tab, segment and section draw their look on a `ui-mark` the frame's script adds, so it
can glide (2026-11-11). Since 2026-11-13 the content slides sideways when the frame's script says
which way a page went (`html[data-dir='next' | 'back']`), a sidebar group's rows glide shut and
open (a grid track to `0fr`, then hidden), the phone's folders and section drawer slide out as they
came, a dialog's shade fades both ways (`@starting-style` and `allow-discrete`), a fold's contents
drop in (`ui-unfold`) and a sidebar row gives to 98 % under a press. None of it runs under reduced
motion. Buttons press in a little when tapped (to 96 %, since 2026-11-08).

## The primitives

All on native elements, server-rendered by Astro, with a script only where the browser has
no built-in behaviour. None emits a `style` attribute, so the hash-based content security policy
holds (plan 12.1); a test renders every one and checks.

| Primitive | Built on | Rule it keeps |
|---|---|---|
| `Button`, `IconButton`, `LinkButton` | `<button>`; `LinkButton` is an `<a>` in a button's look, for a page's tools | four looks, two heights (40, 44 under a finger; 36, 40 under a mouse since 2026-11-03; 14 px semibold words), never a fixed width; an icon button refuses an empty label |
| `ChipRow`, `CommandRow` | `<nav>` with a list of links or buttons in the `.ui-chip-row` scroller | the sideways navigation: every option visible, the current one marked for the browser and the scroller; `CommandRow`'s commands are quiet bordered buttons, never chips, so an action never looks like a filter (2026-11-03); a destructive command last and red. The scroller reaches into the gutter on both sides, so its first chip lines up with the text above and the fades sit in the gutter; it needs a parent with the gutter's padding (the page, a dialog, a card) |
| `ChoiceChips` | `<fieldset>` of native radios inside chips, in the `.ui-chip-row` scroller | a choice of one with every option visible, never a dropdown alone; posts without a script; the chosen chip tinted |
| `CheckChips` | `<fieldset>` of native checkboxes inside chips, in the `.ui-chip-row` scroller | a choice of several with every option visible; each ticked option posts `name-value` as `1`, since a page's form keeps one value per name |
| `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Radio` | the native controls; a switch is a checkbox with the switch role | one column, 44 px controls with 16 px text under a finger (a phone zooms in on smaller), 40 px with 14 px under a mouse, 44 px choice rows, right `type` and `autocomplete` are the caller's |
| `Dropdown` (2026-11-12) | a `details.ui-drop` with `data-pick`: the picked option in its line, a card of radios under it (`ui-menu-pop`), each with an optional hint and a face for the line | the one pick of one for a list too long for chips, made the default: posts without a script; `field` draws it as a form field (a FormField's label names it through `<id>-label`); `wide` spans the nearest placed box (a whole line, a toolbar); `fit` keeps it its own width in a row of tools; `submitWith` posts its form on a pick; `cmd` runs a composer command and is never posted; under its line on a phone too, never a sheet |
| `SearchField` | a search `<input>` with the magnifier in front and the submit button inside its end | one field's room, no separate Find button; its label is read and shown as the placeholder; `data-filter` passes on for the frame script |
| `FormField`, `FormErrors` | `<label>`, the control, `<p>` hint and error; a `role="alert"` summary | the control carries `aria-describedby` and `aria-invalid`; the summary links to each field |
| `InfoTip`, `FormField` `info` (2026-11-10) | a small round button beside a label (`ui-info`) and a tinted note under it (`ui-info-tip`, the popover API, fading in, placed under the button where the browser can) | the button is named "About {label}"; a tap opens it, a pointer resting on it too where the browser has `interestfor`; Escape or a tap elsewhere closes it; the note is `role="note"` |
| `Dialog`, `DialogButton`, `DialogClose`, `ConfirmDialog` | `<dialog>` with `closedby="any"`, opened and closed by the browser's `command` attributes | a bottom sheet on a phone, centred from 640 px; one system, never a dialog in a dialog; the confirm dialog names the object and the consequence, focuses cancel, puts the red button last, and can demand a typed word |
| `Popover` | the popover API, anchored to its trigger | dismissed by a tap outside; no script |
| `Tabs`, `Pagination` | `<nav>` with links | the current page marked; tabs on an underline (`ui-tabs`), the marked one in its group's colour (`hue`) and never bold, a `count` beside a tab when given, sideways on a phone, arrow keys with the frame script; `rel="prev"` and `rel="next"`; the ends disabled |
| `Table` | `<table>` from 640 px, a card list under it, from one column definition | one title, at most three data points and one status on a card; numbers right-aligned in tabular figures; the empty state in place of no rows, in a calm box with its words centred, one line high since 2026-11-13 (`ui-table-empty`); a data column with no header (a command) sits below the named ones on a card, full width; with `select`, a named 44 px tick on each row and card for a `BulkBar`, and one in the header for every row on the page |
| `BulkBar` | a `<form>` posting to the screens' `/do/bulk`, with a `Dialog` for each destructive action | the ticks of a `Table` with `select` join it by its id wherever they sit; it says how many are ticked and its buttons wait for one (frame script); a destructive action asks first and is red; without the script every part still posts |
| `Badge`, `StatusPill` | `<span>` | four health states only, always an icon and a word; the pill is a soft tint of the state's colour with the word in the text colour, so it reads in both themes |
| `Checklist` | `<ul>` with a label | checks one under another, each an icon and its state in words for a screen reader, what was found, and for one that did not pass, what to do, a soft box to press where it is done (Look 3) |
| `Skeleton`, `EmptyState` | `<div aria-hidden>`; `<section>` | shimmer off under reduced motion; one icon, two lines, one action, three kinds; compact since 2026-11-03 (a 40 px icon disc, a plain heading, a short line); inside a dashed box, a pane or the mail list it draws no border of its own (2026-11-11), so a box never sits in a box |

The page building blocks (`Panel`, `Section`, `Notice`, `Toasts`, `Stats`, `ActionRow`,
`ProblemNotice`, `Loaded`, `Done` and `when`) are the ones every portal page is made of, here so a
module's own pages look like the kit's: a page that read an API answer shows it with `Loaded`, its
problem with `ProblemNotice`, a change's outcome with `Done`.

**Chips and toasts (look 2, 2026-11-03, the owner's ask).** A chip is one named rule,
`.ui-chip` (`CHIP_BASE`; `CHIP_CURRENT` is `ui-chip-on`): a soft, compact tag, 32 px under a mouse
and 36 under a finger, tinted with the primary when it is the current one or its radio or box is
ticked, in place of the outlined pills; since 2026-11-11 a bordered pill on the surface, the
same look as the mail folders, so a chip that is not chosen never reads as switched off. Every outcome is a toast: `Done` and `ProblemNotice`
render their notice inside `Toasts`, a region fixed to the bottom-right corner of a computer and
the foot of a phone, over the page and never in its flow, and the screens put a page's flash
there too. A notice there is a card with its tone on its edge and a close button; the frame
script takes one that went well (ok, info) away after six seconds, waiting while the pointer or
the focus is on it, and leaves a refusal until it is closed; a notice with `keep` (a link or a
secret shown once) stays until closed too. A `Notice` placed in a page is a
quiet callout tinted by its tone (`.ui-note`), for a state of things rather than an outcome. The
popover `Toast` and `ToastRegion`, which nothing used, are gone.

**A page's toolbar (look 2, step 2; one wrapping row since 2026-11-12).** `ChipRow` marks its
`<nav>` `ui-filters`; `CommandRow` and `ActionRow` mark theirs `ui-cmds`. The page is a wrapping
flex row: the head and the command row after it share the first line (on a phone too, when they
fit), and a search (`form[role=search]`) and each row of filters sit side by side under it, so the
page's own content starts within the top fifth of the screen. Everything else takes a full line.
`Stats` draws its figures with `Figures` (below), so every page's numbers look the same; a `Stat`
takes a `tone`.

**The bold look and even lists (2026-11-12).** A page's `main.ui-page` carries its sidebar
group's `data-hue`: a soft wash at its top, its picked chips, table heads and row hovers take the
colour. `ui-go` with `ui-go-head` and `ui-go-row` is the search box's list of pages, in the top layer; `ui-recent` Home's Jump back in row. Home (2026-11-14): `ui-welcome` is the band (one hue, light to deep), `ui-dials` > `ui-dial` its links with a `ui-dial-ring` (`ui-ring`, `ui-ring-fill` drawn by `ui-ring` on arrival), `ui-home-grid` and `ui-home-col` its columns, `ui-home-row` a row of Needs you or Get started, `ui-glance` > `ui-glance-row` At a glance's lined-up rows (a subgrid); `ui-head-bell` is the bell at the right of a page's head. `EmptyState` draws `ui-empty-icon` on a flat tile of the colour (no ring or glow since 2026-11-13) and `ui-empty-title`; `Table`
is `ui-table`, its phone cards `ui-table-card`. Scrollbars are slim and in the element's `--hue`
(or the brand) mixed with the border, set on every element. `ui-rlist` with `ui-rrow` is an even
list of rows (a role: `-name`, `-perms` with a meter, `-held`, `-go`); `ui-presets` a slim line
of start buttons; `ui-spec` with `ui-spec-group`, `-head`, `-row` and `-needs` a list of
permissions with tags and a box; `ui-role-top`, `ui-role-note` and `ui-role-tools` the role
editor's band. In `ui-parts` a `ui-chip-row` is one segmented control, and each card is as tall as
its own content. A sidebar group's heading is a button with `data-fold`; `data-folded` on the
group hides its rows, except in a sidebar closed to icons.

**Colour cards (2026-11-12).** `ui-tgrid` lays out as many 16.5 rem columns as fit. `ui-tcard` is
a plain card whose hue (`data-hue` sets `--hue`) shows only in its tile (2026-11-13): a 40 px tile (`ui-hue-tile` or
`ui-logo`), `ui-tcard-title` (with `ui-tcard-go` the whole card is its link), `ui-tcard-sub`
and `ui-tcard-foot` for `ui-tag` pills; `ui-tcard-link` is a second link on the card, above the card's own. `ui-mlist` with
`ui-mrow` (`-name`, `-text`, `-needs`, `-box`, extras `ui-mrow-sub`, `ui-mrow-warn`) is the even
list of modules, its columns lined up from 52 rem, an unticked row's tile grey; `ui-scard` with
`ui-scard-head` is a settings section; `ui-parts` a list of module cards, two columns on a wide
page; `ui-settings-cols` two columns of sections from 84 rem; `ui-footbar` a full-width save bar
stuck to the foot; `ui-tgroup` a group heading with a dot in its hue. `ui-logo` is a white 40 px
tile for a brand's mark. An open `Dropdown` lifts the clipping of every box around it on the
page or in a dialog, so its list is never cut at a card's edge.

## The console pieces

Since 2026-10-31 (`src/console.tsx`) the kit has the pieces an operations console is made of: a
page reads as solid panes on hairlines, one row of options at the top, dense rows with a state at
their edge, and numbers in a strip. A tone colour marks a state only, always beside a glyph or a
word; a group's hue marks identity only. The pages of the email module are the first built from
them ([the record](../../docs/records/2026-10-31-email-console-remake.md)).

| Piece | Built on | Rule it keeps |
|---|---|---|
| `Toolbar`, `Segmented` | a `role="group"` row; a `<nav>` of links | the page's options in one sideways row on a phone, wrapping on a wide page; the current option marked for the browser, each with its count |
| `PaneGrid`, `Pane` | a grid; a `<section>` with a heading, a line, an icon on a group's hue and its own tools | one column on a phone, two from 44 rem of page, three when asked from 60 rem; `span="all"` takes the row; a pane is a size container too; its head wraps (2026-11-11), so a long title keeps whole words and its tools go under it |
| `Figures` | a `<dl>` of slim pills in a row (2026-11-12) | the number first in its colour, then the label and the note (the note is left out on a phone); a tone tints the pill in its state's colour, and untoned figures take the portal's colours in turn; an `href` makes the whole figure the link |
| `Rows`, `Row` | a `<ul>` under an optional heading; each row a link or a block | a lead (an avatar or a badge), a title on one line, a line under it, an aside, a tone bar at the edge; a row's own buttons sit outside its link; rows standing on the page rather than in a pane sit on a card of their own (Look 3) |
| `Avatar`, `initialsOf`, `hueFor` | `<span aria-hidden>` | two letters from the name or the address, on the hue the address always picks |
| `Timeline` | `<ol>` | each step an icon and its state, its time and its detail |
| `Meter` | the browser's own `<meter>` | green under 70 %, amber to 90 %, red above; the figures in words beside it, so the bar is never the only telling |
| `CopyField` | `<code>` and a button with `data-copy` | the value shown whole and selectable; the button names what it copies |
| `Facts` | `<dl>` | label above value on a narrow pane, side by side from 26 rem |
| `ColumnChart` | an SVG whose sizes are attributes, a key, a caption and a table for a screen reader | stacked columns by series, each column named on hover, each series keyed with its total; no inline style |

## daisyUI and the Email pieces (Look 3)

Since 2026-11-08 (the owner's choice, [the record](../../docs/records/2026-11-08-look-3-foundation.md))
the stylesheet also carries a few of daisyUI's components as a Tailwind plugin, run only when
the stylesheet is built: no script reaches the browser. `theme.css` names the ones taken
(buttons, checkbox, radio, toggle, the text fields, badge, kbd, skeleton, loading, join,
swap, tooltip, progress) and fills daisyUI's one theme, `oltrem`, from the kit's own
tokens, so `looks.ts` stays the one colour list and every look and dark mode reach daisyUI too:
`base-100` is the surface, `base-200` the page, `base-300` the border, `primary` the fill.
`Switch` is daisyUI's `toggle`, `Checkbox` and `Radio` its `checkbox` and `radio`, and the text
fields carry `input`, `select` and `textarea` beside the kit's own classes.

Two rules keep the two apart. daisyUI's rules sit in a layer inside Tailwind's `utilities`
layer, so a kit rule that must beat one goes in `@layer utilities` (the Look 3 block at the end
of `theme.css`), never in `components`. And daisyUI owns the class names it ships: a kit piece
never takes a name such as `hero`, `fab` or `filter`.

`src/mail.tsx` draws the pieces Email's screens are built from, the way Gmail and Outlook draw
theirs; what each one does is the page's.

| Piece | What it draws |
|---|---|
| `MailShell` | the folders with Compose on top and their counts, the list, and the open conversation beside it from 1024 px; on a phone (2026-11-12, in place of the sideways row of chips) a button over the list names the folder on screen and opens the same pane as a drawer from the left (a popover, with its close, so it works without the script), Compose the round button at the bottom right, and an open conversation the whole screen with Back; a folder with `apart` sits after a line; `ownTabs` leaves out the page's tabs row when the folders hold the whole set; `wide` draws no list, the page (Compose) taking the room beside the folders; since 2026-11-11 each folder may name its `group` (`main`, `more`, `labels`, `tools`), drawn as Gmail's: More folded and open by itself when it holds the current folder, Labels with a coloured dot each and `labels.add` as a plain + icon in the heading's row, then the tools after a line; `meters` (`MailMeter`: label, value, share, href) are drawn at the pane's foot by `MeterLine`, coloured by `meterTone` (green, amber from 70%, red from 90%, grey when unknown); the pane is 13rem wide since 2026-11-12, as wide as its longest name; the pane is marked `data-preload` so the frame keeps its pages in memory, Compose and the + marked `data-preload-skip`; since 2026-11-13 the pane is also the phone's menu (`data-section-menu`: the phone bar's Menu opens it), with `AllSections` at its head (closes it and opens the portal's menu, `PORTAL_MENU`) and a slot (`data-here-slot`) that the frame's script fills with the section's other pages, Email settings and Campaigns; the slot and the screens' section menu (`ui-here`) are a phone's only |
| `MailBar` | the list's top bar: the box that ticks every row of the page's form, what shows while nothing is ticked, the commands for the ticked rows, and its `end` (the range), hidden on a phone while rows are ticked; its menus are `details.ui-menu`, a sheet from the bottom on a phone; `details.ui-drop` (2026-11-11) is a dropdown of one choice under its line instead, on a phone too: its options `ui-drop-opt` (48 px, tinted when chosen, a `ui-drop-check` tick), its arrow `ui-drop-chev` |
| `LABEL_COLORS`, `labelColor` | the nine label colours, `gray` first, and one read back from what a person chose, `gray` when it is none of them |
| `ConversationRow` | who, when, the subject and the first words, bold while unread; a tick for the page's bulk form, a star as a small form, buttons over the row's end under a mouse; since 2026-11-11 its labels as coloured chips (`RowLabel`) and a paperclip for a file; since 2026-11-13 the row is `data-optimistic-row` and its star turns at once (`data-optimistic`, the screens' frame) |
| `ComposeSheet` | a dialog docked to the bottom-right corner from 640 px and the whole screen on a phone; the body is the page's own; its head is tinted in the brand's colour with the pen, and `aside` puts a short status at its end (Email's Ready to send chip, a `ui-status`); `mode="page"` the same card in the flow, as tall as the screen and edge to edge on a phone, its body's `ui-compose-grow` parts stretching the message down to the Send bar (2026-11-11); `back` (2026-11-11) puts a Back arrow at the head's start, and below 1024 px the page's own head and the mail Back line give way to it: the card meets the top bar and the screen's edges, the Ready chip shrinks to its icon and the Send bar stays at the foot in one row |
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

Still to come from the plan's list: the primitives gallery page and the quality gates of plan
12.6 (axe, screenshots at 390 px, the sideways-scroll and target-size check, the CSP smoke test)
once there is an Astro app to run them against.

## Using it

```ts
// a client's global stylesheet
@import '@oltrem/core-ui/theme.css';
```

```tsx
import { Button, ChipRow, FormField, Input } from '@oltrem/core-ui';

<ChipRow label="Modules" chips={modules.map((m) => ({ label: m.name, href: m.href, current: m.id === current }))} />
<FormField id="email" label="Email" error={errors.email}>
  <Input type="email" name="email" autocomplete="email" />
</FormField>
<Button type="submit" variant="primary" size="form">Save</Button>
```

Labels, words and sentences are the caller's, in the page's language; the primitives carry no
text of their own.

**Class names (2026-11-12).** `cn()` joins class names and drops what is false (`clsx`); `cx` is
the same function under its first name. There is no class merger: tailwind-merge cost 8.4 KB and
about 18 ms of CPU on a first page, past the free plan's 10 ms, so a caller never passes a class
that fights one a primitive sets. A primitive's looks are a `cva` table instead, such as
`buttonVariants({ variant, size })` for a link or label in a button's look. The rules for a new
screen are the repository's skills, `.claude/skills/ui-design-system` and
`.claude/skills/preact-ui`.

## Tests

On Node: every primitive rendered to HTML with `preact-render-to-string` and its markup read
back (roles, ids, the command attributes, the order of buttons, the card list and the table);
the theme compiled with Tailwind's Node API (the semantic utilities exist, the defaults do
not); the contrast of every text-on-colour pair in light and in dark; and the three widgets
rendered closed (no inline style, the roles, the hidden values, the locale's date format); and the Email pieces (`test/mail.test.tsx`).

---
title: "@oltrem/core-ui: The primitives"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-ui/src; split from packages/core-ui/README.md]
---

# @oltrem/core-ui: The primitives

> Part of [the @oltrem/core-ui README](../README.md).

## The primitives

All on native elements, server-rendered with Preact by the screens package, with a script only where the browser has
no built-in behaviour. None emits a `style` attribute, so the hash-based content security policy
holds (plan 12.1); a test renders every one and checks.

| Primitive | Built on | Rule it keeps |
|---|---|---|
| `Button`, `IconButton`, `LinkButton` | `<button>`; `LinkButton` is an `<a>` in a button's look, for a page's tools | four looks, three heights (40, 44 under a finger; 36, 40 under a mouse; `chip`, as tall as a chip, 36 and 32, for a command beside a page's heading; 14 px words, medium; the filled look flat and the bordered look without a shadow, Calm and modern), never a fixed width; an icon button refuses an empty label |
| `ChipRow`, `CommandRow` | `<nav>` with a list of links or buttons in the `.ui-chip-row` scroller | the sideways navigation: every option visible, the current one marked for the browser and the scroller; a chip's `count` is a badge after its label, and a page's filter row is a tray from 640 px; `CommandRow`'s commands are quiet bordered buttons, never chips, so an action never looks like a filter; a destructive command last and red. The scroller reaches into the gutter on both sides, so its first chip lines up with the text above and the fades sit in the gutter; it needs a parent with the gutter's padding (the page, a dialog, a card) |
| `ChoiceChips` | `<fieldset>` of native radios inside chips, in the `.ui-chip-row` scroller | a choice of one with every option visible, never a dropdown alone; posts without a script; the chosen chip tinted |
| `CheckChips` | `<fieldset>` of native checkboxes inside chips, in the `.ui-chip-row` scroller | a choice of several with every option visible; each ticked option posts `name-value` as `1`, since a page's form keeps one value per name |
| `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Radio` | the native controls; a switch is a checkbox with the switch role; a text box's `value` is written as its text | one column, 44 px controls with 16 px text under a finger (a phone zooms in on smaller), 40 px with 14 px under a mouse, 44 px choice rows, right `type` and `autocomplete` are the caller's |
| `Dropdown` | a `details.ui-drop` with `data-pick`: the picked option in its line, a card of radios under it (`ui-menu-pop`), each with an optional hint and a face for the line | the one pick of one for a list too long for chips, made the default: posts without a script; `field` draws it as a form field (a FormField's label names it through `<id>-label`); `wide` spans the nearest placed box (a whole line, a toolbar); `fit` keeps it its own width in a row of tools; `submitWith` posts its form on a pick; `cmd` runs a composer command and is never posted; under its line on a phone too, never a sheet |
| `SearchField` | a search `<input>` with the magnifier in front and the submit button inside its end | one field's room, no separate Find button; its label is read and shown as the placeholder; `data-filter` passes on for the frame script |
| `SecretInput` | a text `<input>` whose typing is hidden (`ui-secret`), `autocomplete="off"` | a key or secret box that is no password box; no password manager offers to save it |
| `FormField`, `FormErrors` | `<label>`, the control, `<p>` hint and error; a `role="alert"` summary | the control carries `aria-describedby` and `aria-invalid`; the summary links to each field; a `Textarea` with `maxLength` gets a counter under it (`ui-count`, read with the box, kept current by the browser script, red from nine tenths) |
| `FieldGrid` | a `<div>` grid | short fields side by side where the room allows (two in a dialog), one under the other on a phone |
| `InfoTip`, `FormField` `info` | a small round button beside a label (`ui-info`) and a tinted note under it (`ui-info-tip`, the popover API, fading in, placed under the button where the browser can) | the button is named "About {label}"; a tap opens it, a pointer resting on it too where the browser has `interestfor`; Escape or a tap elsewhere closes it; the note is `role="note"` |
| `Dialog`, `DialogButton`, `DialogClose`, `ConfirmDialog`, `DialogSection` | `<dialog>` with `closedby="any"`, opened and closed by the browser's `command` attributes | a bottom sheet on a phone, centred from 640 px (36 rem, `wide` 46 rem); three bands: a head with a coloured icon tile (`icon`, the section's colour or `hue`, red with `danger`), the title, one line and a close button; a body that alone scrolls and is the form when `form` is given; a foot that stays with Cancel and the main button (`submit`); `DialogSection` splits a long form under small headings; one system, never a dialog in a dialog; the confirm dialog names the object and the consequence, focuses cancel, puts the red button last, and can demand a typed word; with `form`, the foot holds a hidden "Discard what you typed?" (`ui-dialog-discard`) that the browser script shows instead of closing on a tap outside or Escape once a field has changed, and the main button answers Ctrl or Cmd with Enter (`aria-keyshortcuts`) |
| `Popover` | the popover API; the frame script opens it at its trigger | dismissed by a tap outside; centred without the script |
| `Tabs`, `Pagination` | `<nav>` with links | the current page marked; tabs on an underline (`ui-tabs`), the marked one in its group's colour (`hue`) and never bold, an `icon` before a tab's label, a `count` beside a tab when given, sideways on a phone, arrow keys with the frame script; `rel="prev"` and `rel="next"`; the ends disabled |
| `Table` | `<table>` from 640 px, a card list under it, from one column definition | one title, at most three data points and one status on a card; numbers right-aligned in tabular figures; the empty state in place of no rows, in a calm box with its words centred, one line high (`ui-table-empty`); a data column with no header (a command) sits below the named ones on a card, full width; with `select`, a named 44 px tick on each row and card for a `BulkBar`, and one in the header for every row on the page |
| `BulkBar` | a `<form>` posting to the screens' `/do/bulk`, with a `Dialog` for each destructive action | the ticks of a `Table` with `select` join it by its id wherever they sit; it says how many are ticked and its buttons wait for one (frame script); a destructive action asks first and is red; without the script every part still posts |
| `Badge`, `StatusPill` | `<span>` | four health states only, always a mark and a word; (Calm and modern) the pill is a dot in the state's colour and the word in the text colour, with no box round it |
| `Checklist` | `<ul>` with a label | checks one under another, each an icon and its state in words for a screen reader, what was found, and for one that did not pass, what to do, a soft box to press where it is done (Look 3) |
| `Skeleton`, `EmptyState` | `<div aria-hidden>`; `<section>` | shimmer off under reduced motion; one icon, two lines, one action, three kinds; compact (a 40 px icon disc, a plain heading, a short line); inside a dashed box, a pane or the mail list it draws no border of its own, so a box never sits in a box |

The page building blocks (`Panel`, `Section`, `Notice`, `Toasts`, `Stats`, `ActionRow`,
`ProblemNotice`, `Loaded`, `Done` and `when`) are the ones every portal page is made of, here so a
module's own pages look like the kit's: a page that read an API answer shows it with `Loaded`, its
problem with `ProblemNotice`, a change's outcome with `Done`. A `Section`'s heading has a mark in
the page's colour and its `count`, when given, as a badge.

**Chips and toasts (look 2, 2026-11-03, the owner's ask).** A chip is one named rule, `.ui-chip`
(`CHIP_BASE`; `CHIP_CURRENT` is `ui-chip-on`): a soft, compact tag, 32 px under a mouse and 36 under
a finger, tinted with the primary when it is the current one or its radio or box is ticked, in place
of the outlined pills; bordered on the surface, the same look as the mail folders, so a chip that is
not chosen never reads as switched off; since 2026-11-22 (Calm and modern) a rounded square (8 px
corners, 13 px words), not a pill. Every outcome is a toast: `Done` and `ProblemNotice` render their
notice inside `Toasts`, a region fixed to the bottom-right corner of a computer and the foot of a
phone (a refusal at the top of a phone, clear of the form's buttons), over the page and never in its
flow, and the screens put a page's flash there too. `ProblemNotice` marks its region `data-refused`
(`Toasts refused`), by which the page script refills the refused form. A notice there is a card with
its tone on its edge and a close button; the frame script takes one that went well (ok, info) away
after six seconds, waiting while the pointer or the focus is on it, and leaves a refusal until it is
closed; a notice with `keep` (a link or a secret shown once) stays until closed too. A `Notice`
placed in a page is a quiet callout tinted by its tone (`.ui-note`), for a state of things rather
than an outcome.

**A page's toolbar (look 2, step 2; one wrapping row).** `ChipRow` marks its `<nav>` `ui-filters`;
`CommandRow` and `ActionRow` mark theirs `ui-cmds`. The page is a wrapping flex row: the head and
the command row after it share the first line (on a phone too, when they fit), and a search
(`form[role=search]`) and each row of filters sit side by side under it, so the page's own content
starts within the top fifth of the screen. Everything else takes a full line. `Stats` draws its
figures with `Figures` (below), so every page's numbers look the same; a `Stat` takes a `tone`.

**The bold look and even lists.** A page's `main.ui-page` carries its sidebar group's `data-hue`: a
soft wash at its top, its picked chips, table heads and row hovers take the colour. `ui-go` with
`ui-go-head` and `ui-go-row` is the search box's list of pages, in the top layer; `ui-recent` Home's
Jump back in row. Home: `ui-welcome` is the band (one hue, light to deep), `ui-dials` > `ui-dial`
its links with a `ui-dial-ring` (`ui-ring`, `ui-ring-fill` drawn by `ui-ring` on arrival),
`ui-home-grid` and `ui-home-col` its columns, `ui-home-row` a row of Needs you or Get started,
`ui-glance` > `ui-glance-row` At a glance's lined-up rows (a subgrid); `ui-head-bell` is the bell at
the right of a page's head. `EmptyState` draws `ui-empty-icon` on a flat tile of the colour and
`ui-empty-title`; `Table` is `ui-table`, its phone cards `ui-table-card`. Scrollbars are slim and in
the element's `--hue` (or the brand) mixed with the border, set on every element. `ui-rlist` with
`ui-rrow` is an even list of rows (a role: `-name`, `-perms` with a meter, `-held`, `-go`);
`ui-presets` a slim line of start buttons; `ui-spec` with `ui-spec-group`, `-head`, `-row` and
`-needs` a list of permissions with tags and a box; `ui-role-top`, `ui-role-note` and
`ui-role-tools` the role editor's band. In `ui-parts` a `ui-chip-row` is one segmented control, and
each card is as tall as its own content. A sidebar group's heading is a button with `data-fold`;
`data-folded` on the group hides its rows, except in a sidebar closed to icons.

**Colour cards.** `ui-tgrid` lays out as many 16.5 rem columns as fit. `ui-tcard` is a plain card
whose hue (`data-hue` sets `--hue`) shows only in its tile: a 40 px tile (`ui-hue-tile` or
`ui-logo`), `ui-tcard-title` (with `ui-tcard-go` the whole card is its link), `ui-tcard-sub` and
`ui-tcard-foot` for `ui-tag` pills; `ui-tcard-link` is a second link on the card, above the card's
own. `ui-mlist` with `ui-mrow` (`-name`, `-text`, `-needs`, `-box`, extras `ui-mrow-sub`,
`ui-mrow-warn`) is the even list of modules, its columns lined up from 52 rem, an unticked row's
tile grey; `ui-scard` with `ui-scard-head` is a settings section; `ui-parts` a list of module cards,
two columns on a wide page; `ui-settings-cols` two columns of sections from 84 rem; `ui-footbar` a
full-width save bar stuck to the foot; `ui-tgroup` a group heading with a dot in its hue. `ui-logo`
is a 40 px tile for a brand's mark, white in the light theme and clear in the dark one, so it never
glares; `inkOf(colour)` gives the mark's `style` when its brand colour is too dark to see there (the
text colour in dark, its own in light). `ui-brand` is the Apps page's tile: a service's mark in
white (`--ui-on-brand`) on its own colour (`--brand`), 44 px, 48 px from 640 px, where a card stands
its tile on top and gives its name the whole line; a card stays plain. `ui-steps` is an `ol` of
numbered steps joined by a line, in `--hue`, a step holding what it needs (a button, a field). Every
card lifts under the pointer, a button card as well as a link card, except for someone who asked for
less motion, and the whole card shows the keyboard's focus. An open `Dropdown` lifts the clipping of
every box around it on the page or in a dialog, so its list is never cut at a card's edge.

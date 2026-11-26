---
title: "@oltrem/core-ui: the primitives"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-ui/src/primitives, page.tsx, theme.css]
---

# @oltrem/core-ui: the primitives

> Part of [the @oltrem/core-ui README](../README.md).

## The primitives

Native elements, rendered on the server, a script only where the browser has no behaviour. None
emits a `style` attribute, so the hash-based CSP holds; a test renders each and checks.

| Primitive | Built on | Rule it keeps |
|---|---|---|
| `Button`, `IconButton`, `LinkButton` | `<button>`; `<a>` for a page's tools | Four looks; heights 40/44 (mouse/finger), `chip` 32/36 beside a heading; 14 px medium; flat fill, no shadow; never a fixed width; an icon button refuses an empty label |
| `ChipRow`, `CommandRow` | `<nav>` in the `.ui-chip-row` scroller | Every option visible, the current marked, `count` as a badge; filters a tray from 640 px; commands are quiet bordered buttons, never chips, destructive last and red. The scroller reaches into the gutter, so it needs a parent with the gutter's padding |
| `ChoiceChips`, `CheckChips` | `<fieldset>` of radios or checkboxes in chips | Every option visible, posts without a script; a ticked check posts `name-value` as `1` |
| `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Radio` | The native controls (daisyUI's `toggle`, `checkbox`, `radio`, `input`) | One column; 44 px with 16 px text under a finger (no phone zoom), 40/14 under a mouse |
| `Dropdown` | `details.ui-drop` with `data-pick`, radios in `ui-menu-pop` | The pick of one for a list too long for chips; posts without a script; `field`, `wide`, `fit`, `submitWith`, `cmd`; under its line on a phone too; an open one lifts the clipping of the boxes round it |
| `SearchField` | A search `<input>`, magnifier first, submit inside | Its label as the placeholder; `data-filter` for the frame script |
| `SecretInput` | A text `<input>`, typing hidden (`ui-secret`), `autocomplete="off"` | A key box that is no password box |
| `FormField`, `FormErrors`, `FieldGrid` | `<label>`, control, hint, error; a `role="alert"` summary; a grid | `aria-describedby`, `aria-invalid`; the summary links each field; a `Textarea` with `maxLength` gets a counter (`ui-count`, red from nine tenths); short fields side by side where room allows |
| `InfoTip`, `FormField` `info` | A round button (`ui-info`) and a popover note (`ui-info-tip`) | Named "About {label}"; tap, or `interestfor` hover; `role="note"` |
| `Dialog`, `DialogButton`, `DialogClose`, `ConfirmDialog`, `DialogSection` | `<dialog closedby="any">` with `command` attributes | A bottom sheet on a phone, centred from 640 px (36 rem, `wide` 46); head with an icon tile (red with `danger`), title, line and close; only the body scrolls; a foot with Cancel and `submit`. One system, never nested. Confirm names the object and consequence, focuses Cancel, red last, may demand a typed word. With `form`: "Discard what you typed?" (`ui-dialog-discard`) once a field changed, and Ctrl or Cmd with Enter submits |
| `Popover` | The popover API | Dismissed by a tap outside; centred without the script |
| `Tabs`, `Pagination` | `<nav>` of links | Tabs on an underline (`ui-tabs`), the marked one in its `hue`, never bold, with `icon` and `count`; arrow keys; `rel="prev"`/`"next"`, ends disabled |
| `Table` | `<table>` from 640 px, cards under it | A card: one title, three data points, one status; numbers right in tabular figures; the empty state one line (`ui-table-empty`); with `select`, a 44 px tick per row for a `BulkBar` |
| `BulkBar` | A `<form>` to the screens' `/do/bulk` | Counts the ticks and waits for one; a destructive action asks and is red; posts without the script |
| `Badge`, `StatusPill` | `<span>` | Four health states, always a dot and a word |
| `Checklist` | `<ul>` | Each check an icon, its state in words, what was found, and what to do |
| `Skeleton`, `EmptyState` | `<div aria-hidden>`; `<section>` | No shimmer under reduced motion; one icon, two lines, one action; no border inside a box |

**Page blocks.** `Panel`, `Section` (heading mark and `count`), `Notice` (a quiet `.ui-note`
callout for a state), `Toasts`, `Stats` (drawn with `Figures`), `ActionRow`, `ProblemNotice`,
`Loaded`, `Done` and `when`: a page shows an API answer with `Loaded`, a problem with
`ProblemNotice`, an outcome with `Done`.

**Chips and toasts.** A chip is `.ui-chip` (`CHIP_BASE`, current `CHIP_CURRENT` = `ui-chip-on`): a
bordered rounded square, 8 px corners, 13 px words, 32/36 px, tinted when current or ticked. Every
outcome is a toast in `Toasts`, bottom right on a computer, the foot of a phone (a refusal at the
top): a card with its tone on its edge and a close; ok and info leave after six seconds unless
hovered or focused; a refusal or `keep` stays. `ProblemNotice` marks `data-refused`, by which the
script refills the refused form.

**The toolbar.** `ChipRow` is `ui-filters`, `CommandRow` and `ActionRow` `ui-cmds`. The page is a
wrapping row: the head and commands share the first line, search and filters side by side under
it, so content starts in the top fifth.

**Classes the screens wear.** `main.ui-page` carries its group's `data-hue` (a soft wash, picked
chips, table heads, hovers). Search: `ui-go`, `ui-go-head`, `ui-go-row`. Home: `ui-recent`,
`ui-welcome`, `ui-dials` > `ui-dial` with `ui-dial-ring` (`ui-ring`, `ui-ring-fill`),
`ui-home-grid`, `ui-home-col`, `ui-home-row`, `ui-glance` > `ui-glance-row`, `ui-head-bell`. Lists:
`ui-rlist` > `ui-rrow` (`-name`, `-perms`, `-held`, `-go`), `ui-mlist` > `ui-mrow` (`-name`,
`-text`, `-needs`, `-box`, `ui-mrow-sub`, `ui-mrow-warn`), `ui-spec` (`-group`, `-head`, `-row`,
`-needs`), `ui-presets`, `ui-role-top`, `ui-role-note`, `ui-role-tools`. Cards: `ui-tgrid` (16.5
rem columns), `ui-tcard` (`-title`, `-go`, `-sub`, `-foot`, `-link`) with its tile, `ui-tag`,
`ui-scard` (`-head`), `ui-parts` (a chip row there is one segmented control), `ui-settings-cols`
(from 84 rem), `ui-footbar` (a save bar at the foot), `ui-steps` (numbered steps on a line).
Logos: `ui-logo` (40 px, white in light, clear in dark; `inkOf(colour)` for a mark too dark there)
and `ui-brand` (the Apps tile, the mark in `--ui-on-brand` on `--brand`). Cards lift under the
pointer, not under reduced motion. Scrollbars are slim in the element's `--hue`. A sidebar group's
heading folds it (`data-fold`, `data-folded`).

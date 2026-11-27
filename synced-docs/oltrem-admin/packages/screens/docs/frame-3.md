---
title: "@oltrem/screens: the frame: compose boxes, the composer, exploring a chart, what the script leaves alone"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: the frame (3 of 3)

> Part of [the @oltrem/screens README](../README.md). Before: [2 of 3](frame-2.md). Without the
> script every control here is a plain box, line, select or button, and the form posts as usual.

## Compose boxes

| Attribute | What the frame script does |
|---|---|
| `data-chips` | Each address typed or pasted becomes a chip (class from the value; not an address: `data-bad`); a hidden input of the same name posts them comma-separated. Reads lists split by commas, semicolons, tabs or lines, `Name <address>`, `Name (address)` and `mailto:`; skips duplicates; a bare address the box's `list` knows takes its name. |
| `data-keep-typed` | Once typed in, leaving by a link or closing the tab asks first; sending or saving leaves freely. `="unsaved"` counts it typed from the start. |
| `data-keep-draft="<address>"` | Saves there 3 s after the last change and before leaving or hiding the tab. The JSON answer `{ id, url }` fills the `draft` field and the address bar, forgets the kept copies of this page and of `data-keep-draft-forget`'s; `[data-keep-draft-state]` says Saving, Saved or Not saved yet; `data-keep-draft-hide` nodes hide. A failed save asks before leaving; Send waits for a save under way. |
| `details[data-pick]` | A dropdown of radios (core-ui's `Dropdown`): a change shows the option's `[data-pick-face]` in the summary; a press closes it; arrows move the choice; Enter closes instead of sending; Escape or a click elsewhere closes. |
| `data-fold` / `data-unfold` | An empty line folds behind the button whose `data-unfold` lists it (several ids allowed: Write's Cc/Bcc), shown while all are empty. |
| `data-mark` | `strong`, `em`, `list` or `link` around the selection in the box `aria-controls` names; `data-marks-of` draws that box's words with their marks (`data-list-class` for a list). |
| `data-send-key`, `data-send` | Ctrl or Cmd with Enter presses the `data-send` button. |
| `data-submit-with` | A select, file input or radio presses the (hidden) button it names when it changes. |
| `data-upload` | Each file chosen goes straight to that address as the body, with its `name` and the fields named in `data-upload-with` on the address, then opens `data-upload-done`; a refusal shows on the input. Mail's files over 10 MB, up to 95 MB. |
| `data-drop-file` | Takes a file dropped on its form (outlined while over) or pasted with no words, as a choice would. |
| `data-file-peek` | Shows the chosen CSV before sending: name, size, rows (`data-rows`, `{n}`), headings (`data-cols`, `{list}`), and one warning: `data-no-email`, `data-big` (over `data-max` bytes) or `data-unread`. Reads the first 51 rows by cell, counts the rest by line. |
| `data-csv` | Reads a CSV of any size in the browser; past 30 columns keeps the address, name, files and `data-csv-need` columns first. Sends parts of about 600,000 characters, each with its heading, the first to `data-csv` (with `total`) and the rest to `data-csv-more`, with `data-csv-with` fields; progress in `data-csv-progress`; then opens `data-csv-done` with `added`. Campaigns' list upload. |

## The composer

Oltrem Mail's Write page. A block with `data-rich` naming a textarea shows (it starts `hidden`) and
the textarea hides; its `[contenteditable]` takes the textarea's words with their marks as HTML,
or its HTML with `data-rich-html`. Controls with `data-rich-cmd` run that editing command (`quote`
toggles a blockquote; `link`, or Ctrl/Cmd K, opens `data-rich-link` with `data-rich-link-add` and
`data-rich-link-close`). A paste keeps only the composer's tags. Pasted HTML code (a chat's fenced
block, a long run typed at once, or text that opens and closes with tags) with `data-rich-code`
sets the `format` radio to `html` and puts the code in the textarea as it is, with a notice;
without it, the plain text goes in and the notice says why. On a send the composer writes its HTML
into the textarea and adds a hidden `editor=rich`. `data-rich-hide` nodes hide and
`data-rich-show` nodes show. Choosing `html` hands the textarea back as code; going back shows the
code as the composer's lines. A block with no `format` radios (a signature) gives pasted code to
the textarea and steps aside. The server cleans the HTML again.

## Exploring a chart

A `TrendChart` (`@oltrem/core-ui`) carries its figures in `data-chart`; the script reads them.

- **Pointer:** a line on the nearest day, its dots, and a readout beside it: the day, its figure,
  the same day of the period before with the move, what happened that day. The readout stays
  inside the chart, and it is the only pop-up: the chart carries no browser titles.
- **Tap or click:** keeps the readout, with **Open this day** (the page's `open`, `day=` added)
  and, over more than seven days, **Zoom to the week around it** (`zoom`, `from=` and `to=`). The
  click a tap makes on the readout it just opened opens nothing. A press elsewhere lets it go.
- **Drag:** a finger moved sideways moves the kept readout day by day; a mouse dragged across days
  draws a band and opens the page on those days. Up and down still scroll (`touch-action: pan-y`).
- **Keys:** the chart takes focus; the arrows, Home and End step; Enter opens the first link;
  Escape lets go.
- **Key:** the dashed line's key is a switch (`aria-pressed`) that hides that line and its words.

A cell of a week of hours (`Heatmap`) tapped says its figure where the shades' key was, for a
phone has no hover; tapped again, the key comes back.

## What the script leaves to the browser

Another site, a new tab, a download, the API, the hooks, `/ui/*` (public files), `/do/*` (the
screens' actions), the local door and the invitation link (`NATIVE` in the script), and an answer
that is not a page. When the sidebar changed (the `data-frame` key differs) it draws the new one
and keeps its scroll. When a form's change gets no answer it says so instead of sending twice.

The screens' actions (colour, theme, sidebar, saved views, bulk, Get started) sit under `/do/`,
behind the door on every portal; only public files sit under `/ui/`, which answers GET alone
(`test/paths.test.ts`).

An address that answers nothing, opened in a browser (a `GET` accepting HTML, outside `/api/`), is
the **Not found** page in the frame with a way home, still with status 404. A page's own 404 is
kept, and `/api/` keeps its problem answer.

---
title: "@oltrem/screens: The frame: Compose boxes, The composer"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: The frame: Compose boxes, The composer

> Part of [the @oltrem/screens README](../README.md).

## The frame, continued

**Compose boxes**. An input with `data-chips` turns each address typed into a chip (its class is the
attribute's value; a chip that is not an address gets `data-bad`), while a hidden input of the same
name posts them comma-separated as before. Since 2026-11-11 the box reads addresses out of whatever
it is given, typed or pasted: a list split by commas, semicolons, tabs or lines, `Name <address>`,
`Name (address)`, `mailto:` links, a name and an address on one line; an address already there is
not added again, and a bare address the box's suggestions know (its `list`) takes their name. A form
with `data-keep-typed` (Email's Write), once typed in, is not left by a link or a closed tab without
the browser asking first; sending it, or saving it, leaves freely; `data-keep-typed="unsaved"`
counts it as typed from the start (a page drawn again with what was typed). A form with
`data-keep-draft="<address>"` saves itself there three seconds after the last change and before the
page is left in place or the tab hidden: the JSON answer `{ id, url }` fills its `draft` field and
the address bar, drops the kept copies of the page and of `data-keep-draft-forget`'s pages, and its
`[data-keep-draft-state]` says Saving, Saved or Not saved yet; `data-keep-draft-hide` nodes hide.
Such a form, once saved, leaves freely; one whose save failed asks first, and a Send waits for a
save under way. A `details[data-pick]` (Write's From, 2026-11-11) is a dropdown of radios: a change
shows the chosen option's `[data-pick-face]` in its summary's, a press on an option (the one already
chosen too) closes it, the arrow keys only move the choice, Enter closes it instead of sending the
form, and a click elsewhere or Escape closes it; core-ui's `Dropdown` draws it. A line marked
`data-fold` with an empty input folds behind the button whose `data-unfold` names it; since
2026-11-12 `data-unfold` may list several ids (Write's one Cc/Bcc button), shown while all are
empty. A button with `data-mark` (`strong`, `em`, `list`, `link`) puts that mark around the
selection in the box its `aria-controls` names; a block with `data-marks-of` draws that box's words
with their marks as they are typed (a list takes `data-list-class`). Ctrl or Cmd with Enter in a
form with `data-send-key` presses its `data-send` button, and a select, a file input or (since
2026-11-12) a radio with `data-submit-with` presses the button it names when it changes, that button
hidden (a file input: since 2026-11-08, Write's Attach a file). A file input with `data-upload`
sends each file chosen straight to that address as the body, with its `name` and the values of the
form's fields named in `data-upload-with` added to the address, then opens `data-upload-done`; a
refusal's words show on the input itself. A large file so never passes through a page's form (Mail's
files over 10 MB, up to 95 MB). A file input with `data-drop-file` (Write's paper clip) takes a file
dropped anywhere on its form, which is outlined while one is over it, or pasted into it with no
words (a screenshot), and sends it as a choice would. A file input with `data-file-peek` (Lists' Add
contacts) shows the chosen CSV in the block it names before anything is sent: the name and size, how
many rows (`data-rows`, `{n}`), the headings (`data-cols`, `{list}`), and one warning line:
`data-no-email` when no heading or column holds addresses, `data-big` (the file unread) when it is
over `data-max` bytes, `data-unread` when it cannot be read as text. Only the first 51 rows are read
cell by cell; the rest are counted by their lines. A file input with `data-csv` reads a CSV list of
any size in the browser: past 30 columns it keeps the address, the name, the files and the columns
named in `data-csv-need`, then the rest in order; it sends the rows in parts of about 600,000
characters, each with its heading, the first to `data-csv` and the rest to `data-csv-more`, with the
form's fields named in `data-csv-with` on the address (and `total`, the people of the whole file, on
the first), says which part goes in the element `data-csv-progress` names, then opens
`data-csv-done` with `added` (the people taken in). Campaigns' list upload uses it. Without the
script each is a plain box, line, select and button, and the form posts the file.

**The composer** (Oltrem Mail's Write page, 2026-11-08). A block with `data-rich` naming a textarea
shows (it starts `hidden`) and the textarea hides. Its `[contenteditable]` takes the textarea's
words with their marks made HTML, or its HTML when the block has `data-rich-html`. Buttons, selects
and colour inputs with `data-rich-cmd` run the browser's editing command of that name (`quote`
toggles a blockquote; `link` opens the block's `data-rich-link` line, whose `data-rich-link-add` and
`data-rich-link-close` buttons add the link or close it; Ctrl or Cmd K opens it too). A paste keeps
only the composer's tags and looks; a paste whose plain text is HTML code (it opens with a tag, ends
with one and closes one) instead checks the form's `format` radio set to `html` and puts the code in
the textarea as it is, when the block has `data-rich-code`, with an info notice; without
`data-rich-code` it goes in as words from the plain text, and the notice says why. The composer
writes its HTML into the textarea on a send only while it is on, so code in the textarea is what
goes. The textarea holds the composer's HTML and the form gains a hidden `editor=rich`. Nodes marked
`data-rich-hide` hide and those marked `data-rich-show` show; a `format` radio set to `html` hands
the textarea back as code, and another choice takes it into the composer again. Since 2026-11-12 (a
coded email went as its own code shown as words) the code is read wherever it comes from: a chat's
answer with words and a fenced html block (the code alone is taken), a long run put in at once
without a paste (a phone keyboard's clipboard); choosing `html` with code in the composer hands the
textarea the code itself, not the composer's lines of it; going back with code in the textarea shows
it as the composer's lines, which the server reads as the code. A block with no `format` radios (an
address's signature) gives pasted code the textarea as it is and steps aside. The server cleans the
HTML again; without the script the textarea works as before.

What the script leaves to the browser: another site, a new tab, a download, the API, the hooks,
`/ui/*` (the frame's public files), `/do/*` (the screens' own actions), the local door and the invitation link (`NATIVE` in the script), and an answer that is
not a page. When the sidebar itself changed (a section given or taken away, another account: the
frame's `data-frame` key), it draws the new sidebar and keeps where it was scrolled. When a form's
change gets no answer, it says so on the page instead of sending it twice. With no script at all,
every link and form works as a plain load.

The screens' own actions (the colour, the theme, the sidebar, saved views, bulk, Get started) sit
under `/do/`, and only the public files sit under `/ui/`, which answers GET alone
(`test/paths.test.ts`). Until 2026-11-12 the actions sat under `/ui/` too: a portal whose Access
was set before 2026-11-11 still leaves all of `/ui/*` open, so they reached the Worker with no one
signed in and were refused with KIT-E-0401, and the fleet, which cannot change Access, never closed
it. Under `/do/` they are behind the door on every portal, whatever its Access says.

An address that answers nothing, opened in a browser (a `GET` that accepts HTML, outside
`/api/`), is the **Not found** page in the frame, with a way to the home page, still with the 404
status. Only the API's problem answer is replaced: a page's own 404 is kept, and `/api/` keeps
the problem.

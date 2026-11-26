---
title: "@oltrem/cli: `oltrem deploy [dir]`: `oltrem deploy [dir] --page`, Copy the details, Keep … on, The start page, Who may open it, Clear and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src; split from packages/cli/README.md]
---

# @oltrem/cli: `oltrem deploy [dir]`: `oltrem deploy [dir] --page`, Copy the details, Keep … on, The start page, Who may open it, Clear and more

> Part of [the @oltrem/cli README](../README.md).

## `oltrem deploy [dir]`, continued

### `oltrem deploy [dir] --page`

The same seven steps, with their questions and their progress in a page in the browser (`npm run
setup` at the kit's root; `npm run deploy -- --page` in a client repository). The page is drawn in
the portal's look, from `@oltrem/core-ui`'s theme tokens (a test fails when the two differ), light
and dark, as an app shell: on a computer (960 px and wider) a sidebar of sections, the seven steps
under **Put it on Cloudflare** each with its state (waiting, in progress, needs you, done, stopped),
and a main area up to 1200 px; on a phone the sidebar is a sideways row of chips under the top bar.
All seven steps show from the start (their names are the deploy's own titles; a test compares them
with `deploy.ts`), with a band over them: a ring of the steps done (blue while running, amber when
it needs you, green when done, red when stopped), the step's name and a bar of seven. It has the
portal's Look 3 feel: a translucent top bar, an icon on each section, the steps joined by a line
with the running step's number pulsing softly, questions in a soft amber card, answers in a soft
green one, and what appears rising 6 px out of a 4 px blur in 320 ms (nothing moves with reduce
motion on).

A `Step n of 7: …` title line starts a step, and every later line, question and tool run belongs
to it, sorted into parts: what it is (`text` lines), **What to do** (`do` lines, a numbered
checklist to tick), the **Question** and then its answer, **What happened** (`ok`, warnings, each
tool's run with a spinner, what it says right now and the time it took), **What went wrong**
(`cause` lines: the deploy's plain-words diagnosis of a failed tool, also a warning in the
terminal) and **Tool output**, a console of everything the tools printed, folded until a tool
fails. On a wide screen what it is and what to do sit beside the question and what happened. A
finished step folds to its title and time; a stop is a callout in its step with **Try again** and
**Copy the details**. When a step starts, a question appears or a run stops, the page scrolls to
it (the step's top too when both fit) and puts the cursor in the question's first field, unless
the person scrolled by hand in the last eight seconds: then a **Jump to the current step** button
appears instead. An `https` address (or this computer's own) is a link; nothing else in a line is
turned into a control, and every text is put in the page as text. When wrangler's sign-in does not
open the browser by itself, the step shows a button to its sign-in page. The terminal shows the
same steps in the kit's look and says where the page is, in case the browser did not open.

Step 7's question is a dashboard as wide as the step: how many parts are on (always on, switched
on, off) with a bar, the presets as chips that fill the switches, filter chips (All, On, Off) and
a search, then the parts under their sidebar groups as tiles (one column on a phone, two or three
on a computer), each with its name, its line, an On/Off switch or "Always on", and "Needs …".
Switching a part on switches on what it needs and says so on its tile; switching off a part that
parts still on need asks first, on its tile, with **Switch both off** (or all of them) and
**Keep … on**. Nothing is sent until **Use these parts**, in a bar that stays in view. The page's
switching rule is the tool's (`switchPart`), held equal by `test/setup-page.test.ts`, which also
draws the dashboard on a stand-in page and presses its switches.

Two processes (`src/setup-page.ts`), because the deploy's tools hold their process while they
run: this one serves the page on `127.0.0.1` and stays free to answer it, and a second one, the
same command with `--from-page`, runs the deploy and sends each line, question and tool run as an
event over Node's IPC channel. The page reads the events as a stream of JSON lines (a page opened
again gets every event so far) and sends each answer back. Only this computer reaches it: the
server refuses any other `Host`, every call but the page itself needs the key that follows the `#`
in the address the terminal opens (so it is never in a request line or a `Referer`), and the page's
policy allows only its own script and style. A pasted secret goes to the deploy and nowhere else:
the page's record of the answer is empty. The run starts when the page first opens; the command
ends when the deploy has ended well, after ten minutes without the page ever opening, or when the
page has been closed for a minute while the deploy waits on it (never in the middle of a tool's
run). The second process's own output is in `.oltrem/setup.log`, wrangler's in
`.oltrem/deploy.log`.

A question with choices (the account, the domain) is a grid of cards, label and hint, the one
given before (`value`) or the first chosen already, arrow keys between them; a question may carry
`value` (the answer filled in) and `help` (more lines under it). A question with `list`
(`{ placeholder?, min?, roles?: { value, label }[] }`) takes several entries: one row each, with a
role to pick per row when it has `roles` (a row of chips under the address, wrapping on a computer
and scrolling sideways on a phone, never a dropdown), a remove button and **Add another**; Enter adds a row and
Enter on an empty row sends it, pasted lines become one row each, and it is not sent with fewer than
`min` entries or one entry twice. It starts from `value` (one entry per line, `entry<TAB>role`) and
answers the same way: the filled rows, one per line, the role after a tab when there are roles.
The page's rules for these are plain functions (`SETUP_PAGE_RULES`) the tests run in Node.
The key's box has a **Paste** button (Ctrl+V still works when the browser refuses it); the door's question says it is
checking by itself, and is marked "Noticed by itself" when it is. When the page closes while a
question waits, the browser is opened on it again once. When the page cannot start at all (no free
port, a refused socket), the same deploy runs in the terminal instead.

### The start page

`servePage(null, { menu, status })` serves the same page as a dashboard instead of one run (since
2026-10-29): `status` (`StartStatus`) is what the start made ready (the kit's commit, what an
update brought in or why it was held, Node, the doctor's checks, where the portal is set up to
live), sent first to every page that connects, before the choices; a `status` event from a run
(**Check again**, `run.mjs check`) replaces it. Its sections (since 2026-11-26,
[record](../../../archive/records/2026-11-26-start-page-remade.md)): **Run the portal** first (the
checks' warning with **See what to fix**; **Local** or **Production** as two big choices, Local's
**Who may open it** as a sideways row, Start; while it runs, one panel with the address, how long,
what it says now, **Open the portal**, **Copy**, **Stop**, and **Answer it** when a question
waits; a portal that served and then ended with an error, not by Stop, is started again through
`/again` after `RETRY_SECONDS`, at most three times per press of Start), **This computer**
(the kit: its state, commit, day, latest change, Node, what an update brought in; beside it the
checks: each one that needs a look with its title, summary and fix, a fix that is a command, or a
few joined by "or", a box with **Copy**; **Check again** in the section's corner); in **Run the
portal**, when the kit carries Oltrem Mail, a **With Oltrem Mail** tick, which Start sends only when it changes: the template's dev script then runs `oltrem
mail add` or `oltrem mail remove --confirm remove` before the portal starts, and its `mail` event
updates the page. While Mail is ticked in, an update that only Mail's files hold back takes Mail
out, comes in, and puts Mail back: `MAIL_FILES` in `scripts/run.mjs`), **Put it on Cloudflare** (where the portal
lives, **Put it live** or **Update it**, and the seven steps as above), **More** (any other choice,
a card each) and **Help & details**. A choice runs as a second process whose lines come over IPC
as the deploy's do (the kit's look sends them when `OLTREM_PAGE` is set and the process has an IPC
channel), drawn in its own section as a card with one part per title line, cleared with
**Clear**; wrangler's error lines (`✘ [ERROR]`, `[wrangler:error]`) gather in their own console in
that card, an error seen again counted (×6) rather than repeated. The template's dev script sends a
`serving` event with its address. The sidebar marks each section's state (the checks, the portal
running, Cloudflare live, working, needing you or stopped) and the section being read. The page was
remade compact on 2026-10-31 ([record](../../../archive/records/2026-10-31-start-page-remake.md)), then
as an app shell the same day.
A choice marked stoppable (the portal on this computer) has a **Stop** button, which
asks the process over IPC to stop what it started, then ends it three seconds later, with every
process it started (`stopTree` in the look: `taskkill /T` on Windows, where a plain kill would leave
wrangler's runtime holding the port). The kit's root runs it as `npm start` and from its one-click
files; see the root README.

A running step shows what its tool says right now under its label: the look sends a task's
progress as an event when it changes, a few times a second at most. When a run stops with a
problem, the server writes its details to the `reportFile` it was given (`.oltrem/report.txt`),
names that file in the page and the terminal, and serves the same text at `/report` (with the
key) for the page's **Copy the details** button; when the browser refuses the clipboard, the text
is shown selected for Ctrl+C. The details (`reportText`) carry what ran, the computer (system,
version, Node), the `about` lines the caller gives (the kit's commit, the folder), every line the
page showed with each task's last progress, and the last 80 lines of each of the run's logs, all
passed through `redact`, which hides an age secret key, a sign-in address's query, a value named
like a key and any long run of letters and digits that holds both.

With `runsDir` (the start page and `oltrem deploy --page` give `.oltrem/runs/`), each run writes
every event as it happens to a file of its own (`newRunLog`: its time and choice in the name, the
newest `RUNS_KEPT`, 20, kept): a header with what ran, the computer and the Mail tick, then one
line per event with its ISO time (`logLine`: every progress line, where the portal serves, each
link, through `redact`). A `runlog` event names the file to the page and the terminal, and the
details say where it is. The server answers `GET /ping` (with the key) so a page that lost its
stream can tell the start window is still there and reload, and writes `{"t":"beat"}` on an open
stream every 15 seconds so nothing on the way ends it for being quiet. The page skips an event it
cannot draw (said in the browser's console) instead of ending its stream.

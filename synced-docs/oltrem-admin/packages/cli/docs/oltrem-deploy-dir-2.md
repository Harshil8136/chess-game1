---
title: "@oltrem/cli: `oltrem deploy --page` and the start page"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src/setup-page.ts, setup-page-html.ts, parts.ts, scripts/run.mjs]
---

# @oltrem/cli: `oltrem deploy --page` and the start page

> Part of [the @oltrem/cli README](../README.md). The steps themselves:
> [`oltrem deploy [dir]`](oltrem-deploy-dir.md).

## `oltrem deploy [dir] --page`

The same seven steps in a browser page (`npm run setup` at the kit's root, `npm run deploy --
--page` in a client repository), drawn from `@oltrem/core-ui`'s theme tokens, light and dark (a
test fails when they differ). From 960 px a sidebar lists the steps with their state; on a phone
they are a sideways row of chips. A band shows a ring of steps done, the step's name and a bar of
seven. The step names are the deploy's own titles (a test compares them with `deploy.ts`).

| Part | What it does |
|---|---|
| A step | Starts at a `Step n of 7: …` line. Its lines sort into what it is, **What to do** (a checklist), the **Question** and its answer, **What happened** (each tool's run, what it says now, its time), **What went wrong** (the deploy's diagnosis) and **Tool output** (folded until a tool fails). A finished step folds; a stop shows **Try again** and **Copy the details**. |
| Scrolling | The page scrolls to a new step, question or stop and focuses the first field, unless the person scrolled in the last 8 s: then **Jump to the current step** shows. |
| Questions | Choices are cards (arrow keys move). `value` fills the answer, `help` adds lines. `list` (`{ placeholder?, min?, roles? }`) takes one row per entry, roles as a sideways row of chips, **Add another**, pasted lines one row each; never fewer than `min` or a repeat. It answers one entry per line, `entry<TAB>role`. The rules are `SETUP_PAGE_RULES`, run by the tests in Node. The key's box has **Paste**; the door's question is marked "Noticed by itself" when it is. |
| Step 7 | A dashboard: counts and a bar, the presets as chips, All, On and Off filters, a search, then each part as a tile under its group with a switch or "Always on" and "Needs …". Switching on takes what it needs; switching off a part others need asks (**Switch both off**). Nothing is sent until **Use these parts**. The rule is `switchPart`, held equal by `test/setup-page.test.ts`. |

**How it runs.** Two processes (`src/setup-page.ts`): this one serves the page on `127.0.0.1`,
and the same command with `--from-page` runs the deploy and sends every line, question and tool
run over Node's IPC channel. The page reads them as a stream of JSON lines (a page opened again
gets them all) and posts each answer back.

- **Only this computer.** Any other `Host` is refused; every call but the page needs the key after
  the `#` in the address (never in a request line or `Referer`); the page's policy allows only its
  own script and style. A pasted secret goes to the deploy only; the page keeps no copy.
- **When it ends.** When the deploy ends; after 10 minutes if the page never opened; or after the
  page has been closed 90 s while a question waits or nothing runs (never during a tool's run). A
  question waiting on a closed page reopens the browser once, after 15 s. A page that cannot start
  (no free port) runs the deploy in the terminal instead.
- **Logs.** The second process writes `.oltrem/setup.log`, wrangler `.oltrem/deploy.log`.

## The start page

`servePage(null, { menu, status })` serves the page as a dashboard. `status` (`StartStatus`: the
kit's commit, what an update brought or why it was held, Node, the doctor's checks, where the
portal lives) goes first to every page that connects; **Check again** (`run.mjs check`) replaces
it. The kit's root runs it as `npm start` and from its one-click files (the root README).

| Section | What it holds |
|---|---|
| Run the portal | The checks' warning with **See what to fix**; **Local** or **Production**; Local's **Who may open it** as a sideways row; Start. While it runs: the address, time, what it says, **Open the portal**, **Copy**, **Stop**, **Answer it**. A portal that ends with an error is started again through `/again` after `RETRY_SECONDS` (5, 10, 20), three times a press. With Mail in kit/, a **With Oltrem Mail** tick runs `oltrem mail add` or `oltrem mail remove` before the start; an update held back only by Mail's files (`MAIL_FILES` in `scripts/run.mjs`) takes Mail out, comes in and puts it back. |
| This computer | The kit (state, commit, latest change, Node, what an update brought) and each check that needs a look, a command fix in a box with **Copy**. |
| Put it on Cloudflare | Where the portal lives, **Put it live** or **Update it**, and the seven steps. |
| More, Help & details | Any other choice as a card; help. |

A choice runs as a second process whose lines come over IPC (the look sends them when
`OLTREM_PAGE` is set), drawn as a card cleared with **Clear**; wrangler's error lines gather in
their own console, a repeat counted (×6). The dev script sends `serving` with its address.
**Stop** asks over IPC, then ends the process and all it started 3 s later (`stopTree`:
`taskkill /T` on Windows). The sidebar marks each section's state.

## Reports and run logs

- **Copy the details.** A run that stops writes `reportText` to `reportFile`
  (`.oltrem/report.txt`), named in the page and the terminal and served at `/report` (with the
  key). It holds what ran, the system, Node, the caller's `about` lines, every line shown and the
  last 80 lines of each log, all through `redact` (age keys, sign-in queries, values named like
  keys, long mixed runs of letters and digits).
- **Run logs.** With `runsDir` (`.oltrem/runs/`), each run writes every event with its ISO time to
  its own file (`newRunLog`, `logLine`, through `redact`), the newest `RUNS_KEPT` (20) kept; a
  `runlog` event names it.
- **Keeping the stream.** `GET /ping` (with the key) tells a page that lost its stream the window
  is still there; an open stream gets `{"t":"beat"}` every 15 s. An event the page cannot draw is
  skipped and said in the browser's console.

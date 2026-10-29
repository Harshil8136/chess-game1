---
title: "The Sentry page's console look — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-29
verified_against: [code]
owner: harshil
related_code:
- src/components/dashboard/sentry/frame.tsx
- src/components/dashboard/sentry/Sentry.tsx
- src/components/dashboard/sentry/Issues.tsx
- src/components/dashboard/sentry/Logs.tsx
- src/components/dashboard/sentry/Speed.tsx
- src/components/dashboard/sentry/Trends.tsx
- src/components/dashboard/sentry/Monitors.tsx
- src/components/dashboard/sentry/Releases.tsx
- src/components/dashboard/sentry/Settings.tsx
- src/components/dashboard/sentry/format.ts
- src/styles/pages/sentry.css
- src/pages/dashboard/sentry/index.astro
- src/pages/dashboard/sentry/[part].astro
- src/lib/sentry/issues.ts
- src/lib/sentry/overview.ts
- src/lib/sentry/trends.ts
- src/components/navigation/Sidebar/NavIcon.tsx
- migrations/0087_page_icons.sql
- test/sentry-console.test.ts
- test/sentry-console-look.test.ts
related_docs:
- ../features/SENTRY.md
- 2026-10-28-sentry-page.md
- 2026-10-26-overview-glass-look.md
- ../reference/DESIGN-SYSTEM.md
- ../records/reports/2026-10-29-sentry-console-look.md
tags: [sentry, design, ui, layout, accessibility, dataviz, mobile]
---

# The Sentry page's console look — design

> **TL;DR (non-technical):** The Sentry page now looks like a work tool, not a poster. Each part
> opens with one slim line for its name, then one row of options, then its contents on plain,
> solid panels that line up with no holes between them. Lists are proper tables with column
> names on a wide screen; on a phone each row shows its numbers in one short line under its name.
> Each issue has a small chart of when it happened. The numbers that read 0 (times, people, new
> today) now show Sentry's real counts: the page was asking Sentry in a way that left them out.
> And Sentry has its own icon in the sidebar, a bug, instead of the Server's.

This replaces, on the Sentry page only, the frosted glass the page took from the Overview
([its look](2026-10-26-overview-glass-look.md)). What each part shows is in the
[feature document](../features/SENTRY.md); the change record (private)
says what shipped and how it was checked.

## 1. Why

Harshil on 2026-10-29, with screenshots of the Overview, Issues and Logs: "whole system, each and
every part looks horrendous. see blank space, broken ui/ux, issues, visual gaps, wasted space on
all aspects. I feel like this theme pattern is not good for this type of work." The screenshots
showed these faults:

| Fault | Cause |
|---|---|
| Each part opened with a tall glass card repeating the tab's name | every part drew the Analytics page's hero |
| Three option rows stacked, then a search box as wide as the page | each group of options was its own row (`Seg`, chips), and the search its own bar |
| A hole under the first card of each part | the first card spanned two rows (`.ph-grid > :first-child`), so a short card left glass below it |
| Issues and log lines as loose cards, their numbers ragged | rows were laid out one by one, not as a table with columns |
| "0 times", "0 people", no last seen, "0 new today", an empty New issues trend | the issue lists asked Sentry with `collapse=stats`, and Sentry then leaves out each issue's counts and times (§6) |
| The chart's key gave totals with no time span, beside a number for an unnamed day | the key and the readout did not say what they counted |
| A card listing the parts this person may open | the row of tabs above already lists them |
| Blurred circles moving behind dense text | the glass is meant for a page to glance at; behind a list it costs contrast and attention |

## 2. The approach

Three ways were weighed. Tidying the glass would have fixed the holes and the rows but kept the
backdrop behind dense lists. Copying Sentry's own screens would have brought its look but not
this portal's rules (phone first, options on screen, a word with every state colour). The choice:
**a console look on the portal's own theme**, the way the cf-backup and cf-vps consoles and the
portal's console kit already draw (`src/styles/components/console.css`), with the lessons that
monitoring tools share: dense data on solid surfaces, tables once a list is longer than a dozen
rows, navigation that recedes, and the columns Sentry's own issue list uses (a trend, events,
users, last seen, age).

## 3. The frame

`src/components/dashboard/sentry/frame.tsx`, styled by `src/styles/pages/sentry.css` on
`.se-scene`. Every part is built from the same pieces:

- **Header:** the part's icon in Sentry's purple, its name, one line on what it shows, and its
  tools (Refresh now; a way back on an issue or a request). One line on a wide screen.
- **Toolbar:** the search box, then every option group in one row. Each group is a segmented row
  with its name in front ("Seen in", "Show", "Project", "Order"; Logs adds "From", "In the last",
  "Levels" and "Worker"). On a phone the row scrolls sideways under the search; on a wide page the
  groups wrap beside the search, so nothing hides past the edge. Nothing is a menu.
- **Grid:** three columns on a wide page, two from 44rem, one on a phone, measured on the page's
  own width (the sidebar counts). A panel takes one column, two, or the whole row; none spans
  rows, and the panels in a row are as tall as each other. Settings uses at most two columns.
  A long list (monitors, releases, routes, issues, log lines) always takes the whole row, so it
  never stands beside a shorter panel.
- **Panel:** a solid surface with a hairline edge; its title, the line under it, and tools on the
  right. A table inside runs to the panel's edges.
- **Table:** column heads once the panel is wide enough (34rem for releases, 44rem for issues,
  routes and log lines; the projects' four short columns always). Narrower, the heads go and each
  row's figures fold into a line under its name, each with its word ("42 times · 7 people · 5 h
  since last seen · 3 d old"). A screen reader hears the word in both.
- **Figures strip** (the Overview): six figures in a hairline grid, two, three or six to a row;
  one that could not be read keeps its place with a dash and says why, so the strip never moves.
- **Charts:** the days as stacked columns with a 2px gap between parts; the key says each total
  *and* its span ("in the last 14 days"); the line under the chart names the day it reads,
  "Busiest, 24 Oct" until a day is pointed at; a table of every day for a screen reader. Each
  issue's row has a small chart of its errors over the period, from Sentry's own slices.
- **States:** a read that did not answer says so in its place, with Try again when asking again
  can help; loading shows grey rows.

## 4. Each part

| Part | Layout |
|---|---|
| Overview | the figures strip; then errors each day (two columns) beside open issues by project; then this month's use, the day's log lines and what the tokens can reach, three across |
| Issues | the toolbar; one table: the issue (title, where in the code, level, project, short id, "Not caught", its state when worth saying), its chart, times, people, last seen, age |
| One issue | the facts, the changes and "Open in Sentry" on the right (first on a phone), kept in view while scrolling; the latest time it happened and what happened before on the left |
| Logs | the toolbar; one table: time, level, Worker or project, the line and its details |
| Speed | the toolbar; routes, outside services and cache reads, each a table the width of the page |
| Trends | the comparison period; six panels, three across, each a headline, a chart and a table |
| Monitors and alerts | up-time checks, heartbeats and alerts, each the width of the page |
| Releases and updates | releases grouped by project, then the suggested updates, each the width of the page |
| Settings | the reason box; what the website sends beside what the portal sends; Sentry's own settings the whole row; rules per page beside the errors the website ignores; the list of changes |

## 5. Colours and sizes

- **Neutrals carry the screen:** the theme's own surfaces (`--theme-bg`, `--theme-surface`,
  `--theme-surface-raised`) and borders, so the page follows the portal's dark and light themes.
- **Sentry's purple** marks the page (the header's icon) and what is chosen (a selected option, a
  link, focus); never a state.
- **States** (good, warn, bad, info) always sit beside a glyph or a word. Every state and accent
  colour is 4.5:1 or more against the page, a panel and a raised row in both themes (WCAG formula,
  2026-10-29); in the dark theme, for example, red `#f87171` and amber `#fbbf24` on the panel's
  `#0f172a`.
- **The chart's slots** are the Analytics page's validated pair (blue and orange); they pass the
  dataviz validator on this page's panels in both themes. The "before" grey of Trends is lighter
  here (`#a1a1aa`), because the Analytics grey sat too close to the blue on a solid dark panel.
- **Controls** are 2rem tall with a mouse and 2.75rem on a touch screen (`--g-touch`).
- **Motion:** none on arrival, no counting up. Only the refresh icon turns while it asks, and the
  loading rows pulse, both only for those who have not asked their device for less.

## 6. The counts Sentry left out

Sentry's issue search drops an issue's count, people, first and last seen when the question
collapses `stats` (its serializer skips the "seen stats" then; its own site asks for them in a
second question). The page asked that way to save Sentry work, so every row read 0 times and 0
people, and the Overview's "new today" and the Trends' new issues were empty. The lists now
collapse only `filtered`. The Issues list asks for `groupStatsPeriod=auto` (about 30 slices of
the period, drawn in each row); the Overview and Trends ask for none. An issue's age, and whether
it is new today, is read from `lifetime.firstSeen` (when it began), not its first time in the
period asked for.

## 7. The sidebar's icons

`NavIcon.tsx` drew `bug` (Sentry) and `terminal` (Server) as the same terminal prompt, and
Developer Tools also held `bug`. `bug` is now Lucide's bug, and migration `0087` moves Developer
Tools to `code-xml`, drawn as `</>`, so the three are each their own.

## 8. Decided against

- **Keeping the glass for the Overview only:** the parts would look like two products.
- **Packing cards of any height into the grid** (the Analytics page's packed wall): it fills holes
  but scatters reading order; here a long list takes the whole row instead.
- **Menus for the many options** (projects, periods): Harshil's rule is every option on screen.
- **A chart in every panel:** only where days or a period are what the panel is about.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-29 | Written with the code: every section against the files in `related_code`; the colours with the WCAG formula and the dataviz validator; `test/sentry-console.test.ts` and `test/sentry-console-look.test.ts` pass | The page in a phone browser (Harshil's test); the counts against a live answer from Sentry (the portal's token is not this session's) |

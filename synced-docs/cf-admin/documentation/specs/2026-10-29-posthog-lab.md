---
title: "The PostHog page's analytics lab — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-29
verified_against: [code, docs]
owner: harshil
related_code:
- src/components/dashboard/posthog/frame.tsx
- src/components/dashboard/posthog/charts.tsx
- src/components/dashboard/posthog/now.tsx
- src/components/dashboard/posthog/PostHog.tsx
- src/components/dashboard/posthog/Recordings.tsx
- src/components/dashboard/posthog/Errors.tsx
- src/components/dashboard/posthog/People.tsx
- src/components/dashboard/posthog/Settings.tsx
- src/components/dashboard/posthog/shared.tsx
- src/components/dashboard/posthog/format.ts
- src/components/dashboard/posthog/replay/Player.tsx
- src/components/dashboard/posthog/replay/buffer.ts
- src/components/dashboard/posthog/replay/events.ts
- src/styles/pages/posthog.css
- src/pages/dashboard/posthog/index.astro
- src/pages/dashboard/posthog/[part].astro
- src/lib/posthog/board.ts
- src/lib/posthog/replay.ts
- src/lib/posthog/errors.ts
- src/pages/api/posthog/[part].ts
- src/pages/api/posthog/replay.ts
- src/lib/security/csp.ts
- test/posthog-lab.test.ts
- test/posthog-lab-look.test.ts
- test/posthog-replay.test.ts
related_docs:
- ../features/POSTHOG.md
- 2026-10-28-posthog-page.md
- 2026-10-29-sentry-console-look.md
- ../reference/DESIGN-SYSTEM.md
- ../records/reports/2026-10-29-posthog-lab.md
tags: [posthog, design, ui, dataviz, recordings, player, animation, mobile]
---

# The PostHog page's analytics lab — design

> **TL;DR (non-technical):** The PostHog page now looks like an analytics tool. The Overview
> opens with seven figures, each with its change against the 30 days before and a small chart of
> its days, then a large chart of any of them day by day, what is happening right now (updated
> every 30 seconds), when visitors come by weekday and hour, and the top pages, sources,
> countries, devices and events. Charts draw themselves in and figures count up, unless the
> phone is set to reduce motion. And a recording now plays **inside the portal**, like a video:
> it starts as soon as its first part arrives, loads the rest while it plays, shows on its
> timeline how much has loaded, and waits with a spinner if it catches up. Tapping a moment in
> the list beside it jumps there.

This replaces, on the PostHog page only, the frosted glass the page took from the Overview
([its look](2026-10-26-overview-glass-look.md)). What each part shows is in the
[feature document](../features/POSTHOG.md); the
change record (private) says what shipped and how it was
checked. The Sentry page was redrawn the same day in another direction, a quiet console
([its look](2026-10-29-sentry-console-look.md)).

## 1. Why

Harshil on 2026-10-29, after asking for the Sentry page's makeover: "same with posthog but in a
completely different direction more towards analytics, animation, PostHog type style but
analytical processing. Also I was really hoping to have REAL video buffering inside browser.
Cant we do that? … like complete makeover of repo."

How it is read: every part of the PostHog page redrawn (not only the Overview); the look closer
to PostHog's own tool than to the Sentry console; more charts and more worked-out numbers
(changes, shares, busiest times); motion where it helps the eye; and the answer to the plan's
player question ([§10](2026-10-28-posthog-page.md)), the portal's own player.

The old page had the Sentry page's faults (a tall hero card per part, glass behind dense lists,
holes in the grid, a card listing the parts the tabs already list), and its numbers had no
change, no chart of their days and no busiest time. "Play it in PostHog" was the only way to
watch a visit.

## 2. The approach

- **Warm, solid surfaces.** Near-black and warm-grey panels in the dark theme, off-white in the
  light one, with one orange accent for what is chosen, the way PostHog's own app is drawn. No
  backdrop, no blur: dense numbers read on solid ground.
- **Buttons with a ledge.** A button has a darker edge under it and moves down onto it when
  pressed (`--ph-shade`), PostHog's own touch; the press is instant when motion is reduced.
- **Charts first.** Every figure has its change and its days; every list that has a time has a
  chart of it. The charts follow the dataviz method (§3).
- **Motion that serves reading.** Panels rise in, lines draw from left to right, bars grow,
  figures count up, the live dot breathes. All of it sits inside
  `@media (prefers-reduced-motion: no-preference)`; with less motion asked for, the page arrives
  still.
- **The portal's own rules kept:** phone first, every option on screen in a row that scrolls
  sideways (never a menu), a word beside every state colour, controls a finger can hit.

All of it is scoped to `.ph-scene` in `src/styles/pages/posthog.css`, on the portal's `--g-*`
tokens plus the page's own `--ph-*`, so no other page changes. "Show older" (`.ph-older`) stays
outside the scene because the Sentry page shares it.

## 3. The charts

`src/components/dashboard/posthog/charts.tsx`, SVG and CSS by hand like the Overview's charts:

| Chart | Where | How it reads |
|---|---|---|
| Trend | the Overview's large chart | the last 30 days as a line with its area, the 30 before as a dashed grey line on the same axis; a crosshair and a readout on touch, hover and the arrow keys; a legend row naming both and their totals; "Show as Table" gives every day in a table |
| Spark | each figure, each error group | the figure's days as a small line in its colour |
| Bars | top pages, sources, countries, events | ranked bars, each with its name and number in text colours; countries with their flag |
| Share | devices | one bar split in parts with a 2px gap, and a legend with each share in words |
| Heat | when visitors come | weekdays by hours, one blue ramp from few visits to many, the busiest hour named in a sentence |
| Columns | right now, the error trend | a small column per minute, or per bar of days, with its words under the axis |

- **Colour by the job.** A series keeps its slot in a fixed order (`--ph-c1` to `--ph-c8`:
  visitors 1, visits 2, page views 3, events 4, recordings 5, booking visits 6, errors 8), never
  cycled and never by rank; magnitude is one blue ramp (`--ph-seq-0` to `--ph-seq-6`); state
  colours (good, warn, bad) only for states, always with a glyph or a word.
- **The palette was run through the dataviz validator** on the panel's colour in both themes
  (2026-10-29). Dark (`#1a1a19`): every check passes, the closest pair for colour-blind eyes
  ΔE 8.4. Light (`#fcfcfb`): every check passes, but three slots (green, amber, pink) sit under
  3:1 against the panel, so they never carry meaning alone: every chart has a legend or its
  numbers beside it, and the trend has its table.
- **Text in text colours**, never a series colour; every text pair is 4.5:1 or more in both
  themes (WCAG formula).
- **One axis** per chart; thin marks with rounded ends; a sentence for screen readers on each
  chart (`role="img"` with its label) and the readout announced politely.

## 4. The board

The Overview's numbers are one HogQL question (`boardQuery` in `src/lib/posthog/board.ts`): nine
legs joined by `UNION ALL`, each naming its kind in the first column and giving the same nine
columns (`kind, a, b, n, u, s, v, x, k`, the numbers as floats), so PostHog is asked once for
the whole board:

| Leg | What |
|---|---|
| `day` | each of the last 60 days: events, visitors, visits, page views, errors, visits that opened booking |
| `total` | the same six for the last 30 days and the 30 before |
| `hour` | visits and events by weekday and hour, the last 30 days |
| `event`, `page`, `device`, `country`, `source` | the top 8 (devices 6) of the last 30 days |
| `rec` | recordings each day, from `session_replay_events` |

- **Days in the viewer's time zone.** The page sends its browser's zone (`?view=board&tz=`); the
  route takes it through `safeTimeZone`, else UTC, and the question counts days and hours with
  `toTimeZone`. The copy is kept ten minutes per zone.
- **Right now** is its own small question (`LIVE_QUERY`, `?view=live`): events and visitors each
  minute of the last 30 minutes, and visitors in the last 5. It is kept 20 seconds, and the page
  asks again every 30 seconds while it is on screen (it stops when the tab is hidden).
- **Nothing that names a visitor is asked for.** Visitors are counted by PostHog's person id;
  pages are paths, with anything shaped like an email address or a phone number hidden.
- **The Overview** draws, in a grid of three, two or one columns by the page's width: the
  figures strip; the trend (two columns) beside right now; when visitors come (two columns)
  beside devices; top pages, sources, countries and events; then the free allowance beside what
  the portal's key can reach, with a line on what is set up in PostHog now (open error groups,
  flags, experiments, surveys). A figure opens its part when the person holds it.

The Errors part's chart is a second small question (`daysQuery` in `src/lib/posthog/errors.ts`):
each group's errors by day, folded into 30 bars whatever the period (a day over 30 days, three
over 90, six over 180), for the list's chart and each group's spark.

## 5. The player

Harshil's answer to the plan's player question, the portal's own player, built on rrweb's
(`@rrweb/replay` 2.1.7, MIT, RULESAd §7.3). The library is imported with `import()` when Play
is pressed, so the page never loads it otherwise; its two style rules (the frame, the pointer)
are written fresh in `posthog.css`.

**Where the recording comes from.** PostHog keeps a recording as numbered blocks. The page asks
`GET /api/posthog/replay?id=` for the list of them (a key, a start and an end each; kept a
minute, then a day once the recording is a day old), then for runs of blocks
(`&from=&to=`, at most 20 a call, PostHog's limit for a personal key). A run's body is
PostHog's, passed on untouched with its encoding, so the Worker never unpacks it and its CPU
stays far under the 10 ms limit; it is `private, no-store` and never kept.

**In the browser** (`replay/events.ts`): each run is read as it streams in, line by line; the
parts PostHog's recorder packed (a page's first picture, its changes, stylesheet rules; gzip in a
string) are unpacked with the browser's own `DecompressionStream`; a copy of an event already
read is left out; an event that cannot be unpacked is left out, as PostHog's player does. A
recording without a screen size gets one from its device, just before its first picture.

**How it loads, waits and plays** (`replay/buffer.ts`), the rules of a video player:

| Rule | Value |
|---|---|
| The first run | 2 blocks, so the first picture comes quickly; then 4, 8, 16, then 20 a run |
| Loading ahead | only while less than 3 minutes is loaded ahead of what is on screen (or of where the person moved to) |
| Waiting | playing stops, with a spinner, when less than 1.5 seconds is loaded ahead |
| Going on | once 4 seconds is loaded ahead, or everything is; the gap keeps it from stopping on every block |
| Speed | 1×, 2×, 4× or 8×; every time above is on screen, so at 4× four times as much is needed |
| Skip idle time | on by default: stretches where the visitor did nothing pass quickly |
| A run that fails | tried up to 3 times when trying again can help (a dropped connection, or PostHog asking to wait, at most 10 seconds); otherwise the recording plays up to there and says part of it could not be read |

The timeline shows what has played, what has loaded, and a mark for each error, stuck tap, page
and booking step. Beside the player (under it on a phone) is **what happened, in order**: the
moment on screen is lit and kept in view; tapping one jumps the player there. An address with
`&at=<time>` opens the recording at that moment: Errors' "Watch this moment" and the camera
button on a live event use it.

**Safety.** The recording plays in rrweb's frame, `sandbox="allow-same-origin"` and no
`allow-scripts`, so nothing on a recorded page runs (read from rrweb's code; `UNSAFE_replayCanvas`
is not used). What a visitor typed in a form was already hidden by PostHog's recorder. Pictures
and fonts on the recorded pages are asked of the website by the viewer's browser, as PostHog's
own player does; the portal's `font-src` names the website so that this sends no reports to
Sentry, though the website serves its fonts only to its own pages
(MAINTENANCE (private) PH-4). PostHog says its snapshot API "was never built for
public use": a change on its side shows as the player's message, and "In PostHog" still opens
the recording there (PH-5).

## 6. Each part

| Part | Layout |
|---|---|
| Overview | §4 |
| Recordings | the period and "Only" switches in one row; six figures (recordings, average length, time active, with errors, with stuck taps, reached booking); one panel the width of the page with a row per visit: a play mark, where it started, its tags, when, and how busy it was |
| One recording | the player (two thirds) beside what happened (one third), as tall as each other, the list scrolling inside; then the visit's facts, the width of the page |
| Errors | the period and the state, with counts, in one row; the trend of every group's errors with its figures; then the groups, each with its count, words, tags and spark |
| One error | its facts the width of the page; then its latest times, each with where in the code it broke and "Watch this moment" |
| Events and people | the tab and the kinds, with counts, in one row; right now; then the live events, or the visitors with their figures, each list the width of the page |
| Settings | the reason box; what the website sends beside PostHog's own recording setting; then the changes |

## 7. Decided against

- **PostHog's own player in a frame**, or its share links: a PostHog sign-in for everyone, or a
  recording anyone with its address could watch (the plan's §10).
- **Unpacking recordings in the Worker:** a long recording would pass the 10 ms CPU limit; the
  browser unpacks.
- **Keeping recordings in R2 or KV for faster replays:** a stored copy of what guests saw, and a
  new store; PostHog keeps them already.
- **Reading a whole recording before playing:** an hour-long visit would be read in full to
  watch its first minute.
- **The Sentry console's look:** Harshil asked for "a completely different direction".
- **A chart library:** the charts are a few hundred lines by hand, like the Overview's, and no
  library is in the whitelist for them.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-29 | Written with the code: every section against the files in `related_code`; the categorical palette with the dataviz validator in both themes and the text pairs with the WCAG formula; rrweb's frame sandbox in `node_modules/@rrweb/replay/dist/replay.js`; `test/posthog-lab.test.ts`, `test/posthog-lab-look.test.ts` and `test/posthog-replay.test.ts` pass | The page and the player in a phone browser (Harshil's test); a recording played against PostHog's live snapshot API (the portal's key is not this session's) |

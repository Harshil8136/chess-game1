---
title: "The Analytics page, round 2 — colours per part and a packed layout"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-26
verified_against: [code]
owner: harshil
related_code: [src/styles/pages/analytics.css, src/components/dashboard/analytics/Analytics.tsx, src/components/dashboard/analytics/AnalyticsBlocks.tsx, src/components/dashboard/analytics/AnalyticsCharts.tsx, src/components/dashboard/analytics/format.ts, src/pages/dashboard/analytics/index.astro, src/pages/dashboard/analytics/[part].astro]
related_docs: [2026-10-26-analytics-page.md, 2026-10-26-overview-glass-look.md, ../features/ANALYTICS.md, ../reference/DESIGN-SYSTEM.md, ../records/reports/2026-10-26-analytics-round-2.md]
tags: [analytics, design, ui, accessibility, colour, contrast, layout, motion, dataviz]
---

# The Analytics page, round 2 — colours per part and a packed layout

> **TL;DR (non-technical):** Each part of Analytics now has its own colours, taken from the
> service behind it and mixed with others, with five soft circles that drift and fade slowly
> behind the glass. Every colour was measured so text stays easy to read on its brightest
> circle, in the light and the dark theme. The cards now pack together like bricks, so no column
> ends in empty glass; the heading is one compact row; the figures always come first; and the
> Summary's "what stands out" is a wall of tiles, two from every part, each in its part's colour.
> Four new kinds of chart joined: rings with a middle total, columns, dials for speed, and a
> "how far people read" sheet per page.

This extends the [first design](2026-10-26-analytics-page.md), which still holds for everything
not named here. What each part reads is in the [feature document](../features/ANALYTICS.md).

## 1. Why

Harshil's second look on 2026-10-26, on his phone and a wide screen:

- "check image1 see blank space on bottom … do something about 'What stands out'": the Summary's
  sentences sat in one tall card beside short ones, and the grid left a hole under every short
  card. "ALL pages and sections have that blank space issue."
- "each section have this part wasting 25% of page": the heading (badge, title, read time,
  Refresh, the sentence, then the period and Download on their own row) took a quarter of a
  phone's screen before the first number.
- "we are using limited amount of color palatte … can we have unique ones for each page based on
  service provider … maybe not 100% dependent onto it and keep on changing color and animation
  pallete": every part wore the Overview's purple, blue and orange.
- "put number stats on top for 'Website traffic'": on a wide screen the Overview's stylesheet
  orders its figures after the cards (`.ov-kpis { order: 1 }` from 64 rem).

## 2. Colour

### 2.1 Each part's backdrop and hue

`data-part` on `.an-scene` (set by the two Astro pages) chooses the part's five backdrop circles
(`--g-blob-1` to `--g-blob-5` with their opacities `--g-o1` to `--g-o5`) and its accent
(`--g-accent`, its text form `--g-accent-ink`, and `--g-accent-soft`). Each part starts from the
colours of the service behind it and adds one or two that are not, so no page is one brand's
colour:

| Part | Drawn from | Accent, dark / light |
|---|---|---|
| Summary | the Overview's purple and blue, with orange and teal | `#ff8a4c` / `#c2410c` |
| Visitors | PostHog's blue and orange, with amber | `#5b9df0` / `#2a6fc9` |
| Booking journey | the hotel's warm rose and green, with orange | `#f08350` / `#c2410c` |
| Google search | Google's blue, green, red and yellow | `#22b07d` / `#13865c` |
| Speed and experience | violet and pink, with cyan | `#a197f0` / `#6250d6` |
| Website traffic | Cloudflare's orange, with deep blue | `#e89a1c` / `#a86200` |
| Email | greens, with blue | `#34c27a` / `#15803d` |
| Reliability | Sentry's purple and pink, with teal | `#ec7aa3` / `#b8326a` |

Every part's hue also exists as `--p-<part>` and `--p-<part>-ink` on `.an-scene`, so the Summary
can show each part in its own colour: `data-p` on a figure tile or a sentence sets `--an-hue` and
`--an-hue-ink` from them (a top edge on the tile, a left edge on the sentence, the sparkline, the
icon). The light theme redefines each part's base and accents under `:root[data-theme='light']`.

### 2.2 How the colours were checked

The text on a panel is the quietest case: the glass panel over the backdrop's brightest circle.
Each part was modelled as the theme's base, then its brightest circle at its opacity, then the
glass's white at its alpha, and measured with the WCAG contrast formula: the third text colour
(`--g-text-3`) and the accent's ink must reach **4.5:1**, the accent as a mark **3:1**. Every
part passes in both themes; the lowest results were the third text on Google search's dark
backdrop at 4.63:1, the accent of Google search on dark at 3.03:1 and of Visitors at 3.16:1.
Because the Summary shows each part's ink and hue on its own backdrop, every part's colours were
also measured on the Summary's backdrop: all pass (lowest ink 4.67:1, lowest mark 3.16:1).

### 2.3 Kinds side by side: the categorical slots

Rings and stacked columns show kinds that are not a state or a quantity (who sent the emails,
new and returning, each way people reach out). They take five fixed slots, `--g-c1` to `--g-c5`
plus `--g-c-other`, always in that order (`data-slot`), never cycled. The slots are the
validated reference palette's steps, run through the dataviz palette validator:

| Theme | Slots | Result |
|---|---|---|
| Dark (surface `#1a1a19`) | `#3987e5`, `#d95926`, `#199e70`, `#c98500`, `#d55181` | all checks pass; worst neighbouring pair for colour-blind readers ΔE 8.4 |
| Light (surface `#fcfcfb`) | `#2a78d6`, `#eb6834`, `#1baf7a`, `#eda100`, `#e87ba4` | passes; three slots are below 3:1 on the surface, so every ring and column carries a key with the label and the count, and Download gives the same numbers as a table |

More than five kinds fold into "Other" (`foldSlices`: up to five kept, otherwise the first four
and Other), so no two kinds share a colour.

The part hues of §2.1 are not a categorical palette and fail its brightness band and
colour-blind checks against each other. They never stand alone: every place a part's hue marks
something also writes the part's name beside it, so the hue is a second signal, never the only
one.

States keep the Overview's rule: `--g-good`, `--g-warn` and `--g-bad` only for a state, with a
word or a glyph.

## 3. Layout without blank space

| Piece | Before | Now |
|---|---|---|
| Heading (`.an-hero`) | the Overview's hero, then the period and Download as a second card | one glass row: the badge, the title and one sentence (three lines at most), and on the right the period pill, Download and Refresh as round buttons. On a phone the tools take a second line inside the same card. When the numbers were read moved to the sources card's heading, beside "kept for ten minutes" |
| Figures (`.an-kpis`) | after the cards on a wide screen | always first (`.an-page .ov-kpis { order: 0 }`), two to a row under 30 rem |
| Cards (`.an-grid`) | a grid of rows, each as tall as its tallest card | a packed wall: one column on a phone, two from 40 rem and three from 66 rem of the board's own width (container queries on `.ov-board`, so the sidebar counts). With more than one column, `usePack` sets each card's height in 4 px rows (`grid-row-end: span n`) and the grid fills every hole with the next card that fits (`grid-auto-flow: row dense`); it re-measures when a card or the board changes size |
| Card widths | a fixed list of wide card kinds | each card asks for a width by what it holds (`widthOf`): speed readings the whole row; the busiest-times grid, the funnel, reading and day-by-day columns two columns; a table of four or more columns the whole row, of three or with text two; everything else one |
| What stands out | one card, up to six sentences | on a part, a card like the others; on the Summary, the whole row as a wall of tiles (`.an-insights--all`, each at least 16.5 rem), the two strongest sentences of every part in the parts' order, Visitors first, each with its part's colour on its left edge |
| Day by day, sources | one card each | the whole row on the Summary, two columns on a part |

Dense packing can place a later, smaller card beside an earlier one. The cards are independent
of each other, so their order on screen carries no meaning; the reading and tab order stays the
order of the page.

## 4. The new cards

| Card | What it shows | How it is drawn |
|---|---|---|
| Ring (`.an-donut`) | a whole in a few kinds: new and returning, who sent the emails, who was asking, how people reach out, where errors happen | an SVG ring with 3-unit gaps between slices in the categorical slots; the middle holds the total and what it counts, or the share and name of the slice picked; a key of buttons (label, count, share) picks a slice (`aria-pressed`) |
| Columns (`.an-cols`) | counts by day or by band: visit lengths, where the site ranks, arrival times, cache or server each day, health checks each day, requests and errors each day | SVG columns sized to the card (`useWidth`), stacked with a 2 px gap, the top rounded; labels under each column when there are eight or fewer, otherwise ticks; a readout (`aria-live`) names the column picked; a key when there are two series |
| Dial (`.an-dial`) | each Core Web Vital at 3 in 4 visits | a half circle in three zones from Google's good and poor limits, a needle at the reading, the value and its word in text |
| Reading (`.an-read`) | how far half of the people scrolled each page and how long they stayed | a small page sheet per page filled from the top as far as half its readers got, with the share, the time and the views in words |

## 5. Motion

Still only under `prefers-reduced-motion: no-preference`, and only opacity and transform. The
backdrop's first two circles drift for 46 and 58 seconds, the third breathes for 34, and the
fifth fades in and out over 28 seconds while it moves, so the page's colours shift slowly and
never repeat in step. Reading sheets fill from the top (`an-fill`). Everything else is the first
design's.

## 6. Decided against

- **A colour library or generated hues**: every colour is a token checked by hand above; a
  generated hue would not have been measured.
- **A separate page per service** ("unique ones for each page based on service provider"): the
  parts already follow the services, so each part's colours follow its main source instead.
- **Masonry in CSS alone** (`grid-template-rows: masonry`): not in the browsers the hotel uses;
  the 4 px rows with `dense` work everywhere, and until the page's script has measured the cards they sit in plain rows.
- **Hiding cards to fill holes**: every card stays; packing moves them instead.

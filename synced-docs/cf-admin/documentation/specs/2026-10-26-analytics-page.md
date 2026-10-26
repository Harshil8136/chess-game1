---
title: "The Analytics page — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-26
verified_against: [code]
owner: harshil
related_code: [src/pages/dashboard/analytics/index.astro, src/pages/dashboard/analytics/[part].astro, src/components/dashboard/analytics/Analytics.tsx, src/components/dashboard/analytics/AnalyticsBlocks.tsx, src/components/dashboard/analytics/format.ts, src/styles/pages/analytics.css, src/lib/analytics/report/parts.ts]
related_docs: [../features/ANALYTICS.md, 2026-10-26-overview-glass-look.md, ../reference/DESIGN-SYSTEM.md, ../records/reports/2026-10-26-analytics-page.md]
tags: [analytics, design, ui, accessibility, motion, dataviz]
---

# The Analytics page — design

> **TL;DR (non-technical):** Analytics wears the Overview's frosted glass. Each part opens with
> a heading that says in one sentence what the period looked like, a row of figures that count
> up with how each compares with the period before, the day-by-day line, the sentences that
> stand out, and then cards: bars with tabs, the booking journey step by step, a weekday-by-hour
> grid, speed readings split into good, needs work and poor, tables and rings. Every card says
> where its numbers come from. Nothing moves for someone who has asked their phone for less
> motion, and no state is shown by colour alone.

## 1. Why

Harshil asked on 2026-10-26 for an Analytics page that a client will see, "amazingly designed",
with as many sections as the data supports. The Overview had just been redrawn in glass and he
liked it, so Analytics reuses that look rather than starting a second one: the backdrop, glass
panels, `--g-*` tokens, figure cards, the line chart and the ring are the Overview's
([its spec](2026-10-26-overview-glass-look.md)), and `analytics.css` adds only what the
Overview has no piece for. What each part reads is in the
[feature document](../features/ANALYTICS.md).

## 2. The page, top to bottom

| Piece | Class | What it is |
|---|---|---|
| Parts row | `.an-tabs` | The registry's sideways row (`RegistryTabs`), restyled on glass; the open part is in the ink colour with an accent icon. A person sees only the parts they may open |
| Heading | `.ov-hero` | An icon badge, the part's name, when it was read, Refresh (only with `#refresh`), one sentence from the figures (`summaryLine`) or the part's description |
| Period and Download | `.an-controls` | 7, 30 or 90 days as the Overview's sideways pill, and Download (only with `#export`) |
| Figures | `.an-kpis` | Glass figure cards that wrap (smallest 9.5 rem): the value counting up, a pill with the change against the period before (▲ / ▼ and the percent, "pts" for a share, "new" when there was none before). A pill is green or red only when the figure has a better direction; on the Summary each card links to its part with a sparkline |
| Day by day | the Overview's `LineChart` | One line at a time, switched with a pill; the line draws itself |
| What stands out | `.an-says` | The part's sentences (six at most on the Summary), each with the Overview's glyph for its tone (● good, ▲ needs a look, ✕ bad, ◆ information, ○ nothing to say); on the Summary each carries a chip to its part |
| Cards | `.an-grid` | One column on a phone, two from 48 rem, three from 80 rem; the booking journey, the busiest-times grid, tables and speed readings take a whole row |
| Sources | `.an-srcs` | Each source with "Answered" or the sentence it gave, so a missing card is explained in one place |

## 3. The cards

The forms follow what each set of numbers is for: a ranking is bars, a sequence is a funnel, a
week of hours is a grid, a reading against thresholds is a stacked strip, a part of a whole is a
ring, and anything with several measures per row is a table. No pie of many slices, no second
axis, no 3D.

| Card | What it shows | How it is drawn |
|---|---|---|
| Bars (`.an-bars`) | a ranking: countries, devices, sources, pages, searches | horizontal bars in the accent with the count and the share; tabs switch the breakdown; the top 8 show (10 rows in a table), "Show all" opens the rest |
| Booking journey (`.an-funnel`) | each step of the booking form | a numbered list with a bar per step relative to the first, the share kept from the step before, and the step that loses most people marked with a warn edge and the words "biggest drop" |
| Busiest times (`.an-heat`) | page views by weekday and hour, Monday first | a 7 × 24 grid of accent cells whose opacity follows the count (`--an-a`), a key of four steps, and a readout of the cell picked or the busiest one, so the value is always in words too |
| Speed readings (`.an-vitals`) | each Core Web Vital at 3 in 4 visits | the value large, a sentence of what it measures, and a stacked strip of good, needs work and poor in the state colours with the counts written under it |
| Tables (`.an-table`) | searches and pages with several measures, the index, speed by page, stuck taps | the page's name over its address in small text, numbers right-aligned in tabular figures; the table scrolls sideways inside its card on a phone |
| Ring (`.an-split`) | cookie choices, booking sends | the Overview's ring with a key of label and count |
| Not read (`.an-unread`) | a card whose source failed | the card's title and the source's sentence, never an empty chart |

Colour: the accent marks quantity (bars, cells, lines), never a state. The state colours
(`--g-good`, `--g-warn`, `--g-bad`) appear only beside a word or a glyph: the change pills, the
sentence glyphs, the vitals' strips and the funnel's drop. Labels and
values are in the text tokens; the tokens' contrast is the Overview's (spec §3).

## 4. Motion

Only under `prefers-reduced-motion: no-preference`, and only opacity and transform: bars and the
funnel grow from the left one after another (`.an-grow`, 50 to 60 ms apart), sentences, steps
and readings slide in (`an-slide`), the grid and the rings fade in (`.an-fade`); the figures
count up and the line draws itself as on the Overview. While a new period is read, the cards dim
(`.an-busy`) instead of disappearing.

## 5. Phone

Phone first, as every portal page: one column; the parts row and the period pill scroll
sideways, never a dropdown; tables scroll inside their card; figure cards wrap two to a row on a
phone; the tabs, the period pill and the buttons are 2.75 rem (44 px) tall, and the small part
chips under the Summary's sentences 2 rem, above the 24 px minimum. The busiest-times grid keeps all 24 hours on a phone
with cells narrower than a finger, so tapping a cell is a convenience: the readout under it
always names the busiest time in words.

## 6. Decided against

- **A dropdown for the parts or the period**: the owner's rule is a sideways row.
- **Charts from a library**: the Overview's own SVG pieces and CSS bars cover every form here,
  and a charting library would be a new dependency outside the whitelist.
- **A world map**: a map's colours carry the count only by colour and are hard to read on a
  phone; the countries, states and cities are a ranked list instead.
- **Live updates while open**: the sources change slowly and every read costs calls; the page
  reads on opening, on a period change and on Refresh.

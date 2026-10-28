---
title: "Speed and experience as a board of its own — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-28
verified_against: [code, infra]
owner: harshil
related_code: [src/components/dashboard/analytics/Experience.tsx, src/components/dashboard/analytics/experience.ts, src/components/dashboard/analytics/AnalyticsBlocks.tsx, src/components/dashboard/analytics/AnalyticsCharts.tsx, src/components/dashboard/analytics/Analytics.tsx, src/styles/pages/analytics.css, src/lib/analytics/report/parts.ts, src/lib/analytics/report/names.ts, test/analytics-experience.test.ts, test/experience-look.test.ts]
related_docs: [2026-10-26-analytics-page.md, 2026-10-26-analytics-colours-and-layout.md, ../features/ANALYTICS.md, ../reference/DESIGN-SYSTEM.md, ../records/reports/2026-10-28-speed-and-experience-board.md]
tags: [analytics, design, ui, accessibility, layout, dataviz, web-vitals]
---

# Speed and experience as a board of its own — design

> **TL;DR (non-technical):** The Speed and experience part of Analytics now reads from top to
> bottom like a report. First one sentence says how fast the website feels to visitors, beside
> Google's 0 to 100 score in a ring. Then Google's four speed readings, each once, drawn the way
> Google's own PageSpeed page draws them: the time, a word (good, needs work, poor) and a bar
> showing how many visits were good, with a mark where "3 in 4 visits" falls. Then what stands
> out, beside where visitors got stuck (taps on things that did nothing, quick repeated taps,
> errors). Then every page once, slowest first, with its speed for real visitors beside Google's
> test of it. The row of seven tiles at the top, the dials and the empty hole are gone.

This replaces, for this part only, the packed wall of the
[second round](2026-10-26-analytics-colours-and-layout.md) and its dials. The other parts keep
both designs. What the part reads is in the [feature document](../features/ANALYTICS.md) §1.

## 1. Why

Harshil on 2026-10-28, with a screenshot of the part on a wide screen: "looks very broken,
makeover it and change approach to better!". The screenshot showed four faults, all from
drawing this part like the others:

| Fault | Cause |
|---|---|
| Seven tiles at the top, four of them the same four readings shown again further down | every part opens with its figures; this part's figures are the readings |
| "What stands out" alone in the left third, a hole beside it | the packed wall fills holes with the next card that fits, and the next card (the readings) asks for the whole row; this part has no day-by-day card to sit beside it |
| "How fast it feels" as dials | a half circle with a needle shows one value against two limits, but not how the visits split, which is what Google rates |
| Speed by page and Google's test as two tables | the same pages twice, on different cards, in different orders |

## 2. The board

`ExperienceBoard` (Experience.tsx) draws the part in this order, in one column; no packing.

| # | Card | What it shows |
|---|---|---|
| 1 | Verdict | an eyebrow ("How the website feels to visitors"), one title and one sentence from the four readings (`verdictOf`: the worst reading decides, and the sentence names the readings that are poor or need work, in quotes), and Google's score in a ring when PageSpeed has tested pages |
| 2 | Google's four readings | the four readings as tiles (§3), or the sentence of the source that could not be read |
| 3 | What stands out, beside where visitors get stuck | the part's sentences; three counts (taps that did nothing, quick repeated taps, errors in browsers) and each place with its kind, times and people as a bar, most first, six then "Show all" |
| 4 | Each page, slowest first | every page once (`pageRows`): visitors' main content time at 3 in 4 visits and how many readings, beside Google's score and its main content time on a test phone |
| 5 | Where these numbers come from | unchanged |

Cards 3's two halves sit side by side once the board is 48rem wide and both are there
(`.ex-pair:has(> :nth-child(2))`), stretched to the same height so neither leaves a hole; below
that, and when PostHog did not answer, they stack. The row of figures is not drawn for this part:
the verdict and the tiles say the same, once.

**The verdict's words.** All good: "Fast for most visitors". Some need work: "Mostly fast, with
room to improve". Any poor: "Slow for many visitors". No readings: "Not enough visits measured
yet". A reading with no visits in the period is counted in the sentence ("One reading has no
visits yet"), never rated.

**Google's score.** The average of the newest PageSpeed run of each page (the part's `lab`
figure), in a ring in PageSpeed's own bands: 90 and above good, 50 to 89 needs work, under 50
poor (`scoreTone`), with the word beside it and "Out of 100, average of N pages, phone test".

## 3. The four readings, as PageSpeed draws them

Each tile (`.an-vital` in AnalyticsBlocks.tsx) has, top to bottom:

- the reading's name and its state as a glyph and a word (`ov-state`);
- the value at 3 in 4 visits, large, with "3 in 4 visits" beside it, and a sentence of what it
  measures;
- one bar split into good, needs work and poor in the state colours, each part as wide as its
  share of the readings, with a 2px gap of the card between parts, and a mark at 75% labelled
  "3 in 4": the colour under the mark is the rating, which is how PageSpeed's field data reads;
- the three shares in words with their glyphs, and "Good up to X, poor past Y · N readings".

One column on a phone, two from 30rem, four from 66rem. The whole tile is one `aria-label`
sentence; its parts are hidden from a screen reader so it is read once.

## 4. Every page once

`pageRows` (experience.ts) joins the "pages" table (PostHog) and the "lab" table (PageSpeed, D1
`gsc_index_log`) on the address, without its last slash and in lower case, so `/es/booking` and
`/es/booking/` are one page. The order: pages rated for visitors, slowest first; then pages with
fewer than five readings (`FEW_READINGS`), which are shown but not rated, since one slow visit is
not a slow page (on 2026-10-28 one page had four readings and a p75 of 162.6 s); then pages only
Google tested, lowest score first.

On a phone each page is a block: its name over its address, then "Visitors" and "Google's test"
side by side, each with its own small label. From 44rem it is a list with a header row (Page,
Visitors, Google's test) and the labels move into it. Each value carries its state glyph in the
state colour; the number itself stays in the text colour. Eight pages, then "Show all". Each row
is one `aria-label` sentence ("Booking · ES (/es/booking/): visitors see its main content in
3.1 s for 3 in 4 visits (30 readings, needs work); Google's test scores it 79 out of 100, main
content in 3.9 s.").

## 5. What stays the same

The API, the part's figures, insights, blocks and notes, the CSV file and the Summary's line for
this part are unchanged: the board reads the same `PartView` (experienceView in
`src/lib/analytics/report/parts.ts`). The backdrop and the hue of the part stay the second
round's (violet and pink, `--p-experience`). The state colours, the glyphs and the motion rules
are the first design's.

## 6. Decided against

- **Keeping the packed wall and adding a card to fill the hole:** a filler card is the "hiding
  cards to fill holes" the second round turned down in reverse, and the readings would still
  have been shown twice.
- **Keeping the dials:** they show the value against the limits but hide the split of the visits,
  and four half circles take the height of a whole screen on a phone.
- **A table for the pages with sideways scrolling on a phone:** the block per page reads without
  scrolling sideways and keeps both measures in view.
- **Rating a page with one to four readings:** it would put one unusual visit at the top of the
  list as the slowest page.
- **A new colour for the part:** the screenshot's strong purple is the part's backdrop from the
  second round; changing it is a separate choice for Harshil.

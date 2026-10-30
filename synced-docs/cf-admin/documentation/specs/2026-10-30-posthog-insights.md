---
title: "The PostHog page's Overview in plain words, with the paths through the website — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-30
verified_against: [code, infra]
owner: harshil
related_code:
- src/components/dashboard/posthog/PostHog.tsx
- src/components/dashboard/posthog/insights.tsx
- src/components/dashboard/posthog/story.ts
- src/components/dashboard/posthog/metrics.ts
- src/components/dashboard/posthog/now.tsx
- src/components/dashboard/posthog/frame.tsx
- src/components/dashboard/posthog/charts.tsx
- src/styles/pages/posthog.css
- src/lib/posthog/board.ts
- src/lib/posthog/names.ts
- src/lib/posthog/recordings.ts
- src/lib/posthog/types.ts
- src/lib/analytics/report/queries.ts
- test/posthog-lab.test.ts
- test/posthog-lab-look.test.ts
related_docs:
- ../features/POSTHOG.md
- ../features/ANALYTICS.md
- 2026-10-29-posthog-lab.md
- ../records/reports/2026-10-30-posthog-insights.md
tags: [posthog, design, ui, dataviz, analytics, funnel, paths, web-vitals]
---

# The PostHog page's Overview in plain words, with the paths through the website — design

> **TL;DR (non-technical):** The PostHog page's Overview now explains itself. It opens with a
> few sentences saying what happened on the website in the last 30 days (how many people came,
> from where, how long they stayed, how many reached the booking form and where they gave up,
> where taps did nothing, how fast pages were), and a tab that says what every figure means.
> Below it: the booking form step by step, where visitors went after each page and the most
> common ways through the website, how they found it, where they got stuck, what they tapped,
> how fast pages were on phones and computers, and where visitors are, down to the state. The
> gap missing between the figures at the top and the panels under them is back.

This builds on [the analytics lab](2026-10-29-posthog-lab.md), which drew the page; this note
changes what the Overview says, not how it is drawn. What each part shows is in the
[feature document](../features/POSTHOG.md) §3; the
change record (private) says what shipped and how it
was checked.

## 1. Why

Harshil on 2026-10-30, with a picture of the Overview: "color palatte, design are good but not
matching perfectly. see there is a ZERO gap between top mini boxes and "Visitors each day" +
"Right now" part. same thing has happened at many places … Other pages, sections, parts are
also very bland, not interesting, difficult to process, understand to someone completely new.
not enough data, metrics, info presented. NOW posthog have TON of things see what we can use
here. TAKE AS LONG AS NEEDED, THINK DEEP, RESEARCH EXTENSIVELY! dont hold back. research other
repos that do same thing".

How it is read, in two stages:

- **Stage A, the Overview** (this note): the gap fixed everywhere it is missing; more of what
  PostHog collects turned into answers; every figure and panel explained for someone new.
- **Stage B, the other parts** (Recordings, Errors, Events and people): the same treatment, in a
  later note.

## 2. The gap

The Overview's figures and its grid of panels sat inside a plain `<div>` that only dimmed them
while a new answer loaded. The page's own gap (`.ph-scene .ph-page`, 0.75 rem) spaces its
direct children; a plain wrapper is one child, so the figures touched the panels. The other
parts put their sections straight into the page or into `.ph-detail`, a grid with the same gap,
which is why only the Overview showed it. The wrapper is now `.ph-stack`, a grid with the same
gap, and `test/posthog-lab-look.test.ts` fails on a plain dimming wrapper anywhere in the parts.

## 3. What the Overview says now

In this order, so the answer comes before the detail:

1. **Ten figures** for the last 30 days against the 30 before: visitors, visits, page views,
   visit length, the share of visits that left at once, visits that opened booking, bookings
   sent, recordings, errors and events (`metrics.ts`). A share's change is counted in points
   ("+5 points"), not in percent of itself. Each figure has a sentence saying what it counts.
2. **In plain words** (`storyOf` in `story.ts`): up to eleven sentences made only from the
   board's numbers, most important first, each with a state mark (good, worth a look, bad), and
   a link to the recordings or errors behind it when the person may open that part. A part with
   nothing to say says nothing; with no visitors at all, one sentence says so. Its second tab,
   **What the figures mean**, lists every figure's sentence and says that only visitors who
   allowed analytics cookies are counted.
3. **Right now**, with the last 24 hours in a sentence, when a page was last opened, and the
   pages opened in the last 30 minutes.
4. **The trend** of any figure, as before.
5. **From visit to booking**: people who reached each of the six steps of the booking form, the
   same steps and the same rule as the Analytics page's funnel (one question shape, shared
   through `FUNNEL_CONDITIONS` and `FUNNEL_EVENTS`), with the step that loses the most people
   named and "Watch visits that opened booking and did not send" opening the matching recordings.
6. **Where visitors go next**: a row of the top pages; for the one chosen, the share that left
   the website from it and the pages opened next. "Whole visits" shows the most common ways
   through the website, up to four pages each, with how many went further.
7. **How visitors found the website**: by kind of source (search engines, typed or saved
   address, other websites, social media, AI assistants, emails, ads), each with how many of
   its visits left at once and how long they stayed, or by website.
8. **When visitors come**, as before.
9. **Devices**: by kind, browser or system.
10. **Top pages**, each with how far down half of its readers scrolled.
11. **Where visitors got stuck**: pages ranked by taps that did nothing (PostHog's dead clicks,
    rage clicks and dead swipes) and errors, with a link to the recordings with stuck taps.
12. **What visitors tap**: the words on the buttons and links tapped most.
13. **Where visitors are**: countries, or states and regions.
14. **How fast pages are**: per kind of device, the time until the main content shows, the delay
    after a tap, how much the page jumps while loading and the first thing shown, each at 3 in
    4 visits and marked good, needs work or slow against Google's limits (the same limits as the
    Analytics page, `VITALS`).
15. **What PostHog notes**: the top events, each with a sentence saying what it is.

The free allowance and the key's checks follow, as before. Every option is a tab in a row that
scrolls sideways; no panel has a menu.

## 4. The two questions

The board was one HogQL question; with the paths it became too heavy for PostHog to answer in
time (tried on the live project, 2026-10-30). It is now two, each a UNION ALL of legs that share
the same eleven columns (kind, two labels, eight numbers):

- **The counts** (`boardQuery`, 15 legs): days and totals; visits from PostHog's `sessions`
  table (`$session_duration`, and `$is_bounce`: one page, nothing tapped, under 10 seconds,
  PostHog's own bounce rule); hours; events; pages and how far they were read
  (`$prev_pageview_max_scroll_percentage` on `$pageleave`); devices, browsers, systems,
  countries, states (`$geoip_subdivision_1_name`), sites and kinds of source
  (`$channel_type`); recordings.
- **The paths** (`PATHS_QUERY`, 6 legs): the booking steps (`windowFunnel` over 7 days, per
  person, in each 30-day half); each visit's pages in order with repeats removed, paired with
  the next page ("" for leaving); the most common first four pages; stuck taps and errors per
  page; the first words on what was tapped; each vital's 75th percentile per device, with how
  many readings each had (a jump of 0 is a reading, not a missing one).

They are asked one after the other, so the Overview never has more than three questions with
PostHog at once (the board, right now and the totals; PostHog allows three per project). The
copy is kept ten minutes per time zone, as before. Right now gained three small legs (pages in
the half hour, the last day, the last page opened), still kept 20 seconds.

## 5. What other tools do, and what was taken

Looked at on 2026-10-30: PostHog's own web analytics and its query tools (through the PostHog
connector, since posthog.com is not reachable from this session), and the open-source
analytics tools Plausible, Rybbit and OpenPanel.

- **Plausible** keeps to a few figures with their change and plain lists; taken: the change on
  every figure, "visit length" and "left at once" beside the counts.
- **PostHog web analytics** adds the kind of source, the bounce rule and the web vitals per
  page; taken: `$channel_type`, `$is_bounce` and the vitals per device against Google's limits.
- **Rybbit and OpenPanel** add funnels and the ways visitors move through a site; taken: the
  next page after each page, the ways through the website, and the booking steps with the worst
  step named.
- **The sentences** of "In plain words" are this page's own: a newcomer reads an answer before
  the numbers behind it.
- **Not taken:** the plain web numbers the [Analytics page](../features/ANALYTICS.md) already
  shows in full (its own funnel, campaigns, search terms, reviews); the PostHog page keeps to
  what only PostHog can link to a recording.

## 6. Privacy

Nothing new names a visitor: visitors are counted by PostHog's person id and visits by its
visit id; a page is its path only; a tapped thing is its first words, on one line, at most 48
characters, with email addresses and phone numbers masked (`tapWords`); a state is a name
PostHog reads from the internet address, and the address itself is never asked for. The
[record of processing](../security/RoPA.md) has the PostHog row.

## 7. Decided against

- **One question for the whole board:** PostHog did not answer it within its time on the live
  project.
- **The two questions at once:** with right now and the totals, four questions would be with
  PostHog at once, over its limit of three per project.
- **PostHog's Paths insight** (`query-paths`): its answer is shaped for PostHog's own chart; the
  pairs of pages are a small part of one question.
- **Heatmaps on the page:** they need the page drawn behind them, which only PostHog's toolbar
  has.
- **A sentence written by a model:** every sentence is made from the numbers by plain code, so
  it can be tested and is never wrong in a new way.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-30 | Written with the code: every section against the files in `related_code`. Live through the PostHog connector, counts and sums only (no page, tap or visitor value read): both board questions and right now, as built by the code, answer (the paths: 12 funnel, 37 next-page, 6 way, 5 stuck, 8 tap and 2 speed rows; the counts: 87 visits in 5 kinds of source, 54 days of visits); `test/posthog-lab.test.ts` and `test/posthog-lab-look.test.ts` pass | The page in a phone browser (Harshil's test); stage B |

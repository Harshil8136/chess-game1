---
title: "Loading screens on the dashboard pages — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-11-03
verified_against: [code, infra]
owner: harshil
related_code:
- src/styles/components/skeleton.css
- src/components/dashboard/posthog/shared.tsx
- src/components/dashboard/posthog/frame.tsx
- src/components/dashboard/sentry/frame.tsx
- src/components/dashboard/analytics/Analytics.tsx
- src/components/dashboard/analytics/AnalyticsCharts.tsx
- src/components/dashboard/overview/Overview.tsx
- src/components/dashboard/overview/format.ts
- src/components/navigation/NativeNavigationState.astro
- src/styles/pages/overview.css
related_docs:
- ../features/ANALYTICS.md
- ../features/POSTHOG.md
- ../features/SENTRY.md
- ../features/DASHBOARD.md
- ../reference/DESIGN-SYSTEM.md
- 2026-10-26-overview-glass-look.md
- 2026-10-29-posthog-lab.md
- 2026-10-29-sentry-console-look.md
- ../records/reports/2026-11-03-loading-screens.md
tags: [design, loading, motion, analytics, posthog, sentry, overview]
---

# Loading screens on the dashboard pages — design

> **TL;DR (non-technical):** on 2026-11-03 Harshil asked for the loading on Analytics, PostHog,
> Sentry and the other pages to be reviewed, because "loading is weird". Each page now shows its
> title and options at once, then grey shapes in the places the figures and panels will take,
> and only when the answer takes longer than a quarter of a second, so a quick answer never
> flashes them. A refreshed answer changes the page in place instead of drawing it again, the
> greeting and the date no longer change a moment after the page opens, the coloured backdrop
> blooms once instead of on every page, and on a phone the row of tabs stays where it was. The
> Analytics summary, the slowest page (5 seconds at the middle, 14 at the slowest), now has its
> parts read side by side first, so they no longer wait in line behind each other.

## 1. What was weird, and why

Every finding below was read in the code, and the times were measured in Sentry's traces of
the portal (30 days to 2026-11-03, Sentry connector).

| # | What a person saw | The cause |
|---|---|---|
| L-1 | On PostHog, Sentry and the Blog studio, a blank gap, then the title and options popping in, then grey bars | The parts read the address (`useAddress`) only in the browser: on the server it was `null`, and every part returned its placeholder alone, without its header, until the browser took over |
| L-2 | Grey boxes that looked nothing like what replaced them | PostHog's placeholder was three tall breathing rows on every part; Sentry's one to four equal panels; neither had the strip of figures or the panels' real widths |
| L-3 | A flash of grey even when the answer came straight away | A kept copy answers in 12 to 32 ms (Sentry traces of `/api/analytics/{part}`), and the placeholder showed for that one frame |
| L-4 | Analytics drawing itself from nothing again on a refresh, a range change or an automatic retry | The board carried a `key` of the range and the answer's time, so every answer threw it away: the cards rose in again and the numbers counted up from zero, though they were made to count on from the old values |
| L-5 | The range buttons appearing late on Analytics and pushing Refresh along | The range buttons were drawn only once the browser knew the range, Download only once the answer came |
| L-6 | The cards of an Analytics part jumping into a wall a moment after they appeared | The wall was packed in the frame after the first one (`usePack`, `useEffect` and `requestAnimationFrame`) |
| L-7 | The Overview's greeting changing ("Good evening" to "Good afternoon"), the date changing near midnight, and the round letter changing from H to the person's initial | The server drew the greeting on its own clock (UTC) and without the name; the browser then redrew it on the viewer's clock, and the name came with the figures |
| L-8 | On the glass pages, the coloured backdrop fading out and blooming in again on every page | The bloom ran on every page the browser swapped in, not only when the portal opened |
| L-9 | On a phone, the row of tabs (Analytics, PostHog, Sentry, Content) jumping back to its start on each tab, the chosen one off screen | Each page arrived with its row scrolled to the start |
| L-10 | Content rising in slowly after the placeholder | The glass pages' cards rose for 0.7 s each, one after another up to 0.78 s apart: a second and a half before the last was still |
| L-11 | The Analytics summary waiting 5 s at the middle and 14 s at the slowest (50 requests) | The summary reads every part in one request, and one request opens at most six connections at once; its 20 to 30 questions to Cloudflare, PostHog, Google, Sentry and Supabase wait in line |

## 2. The rules

These hold for every page that loads its figures after it opens. They extend the motion rules
of the three looks ([glass](2026-10-26-overview-glass-look.md),
[PostHog lab](2026-10-29-posthog-lab.md), [Sentry console](2026-10-29-sentry-console-look.md)).

1. **The frame first.** The page's title, its one line and its options are drawn by the server,
   with the address the page was asked with, so nothing above the placeholder moves when the
   browser takes over. The PostHog and Sentry islands get it as `search={Astro.url.search}` and
   hand it down (`AddressProvider`); `useAddress` is never `null`.
2. **A placeholder waits a quarter of a second.** `.sk-wait` keeps it out of sight for 0.25 s,
   then shows it: at once, or with a 0.2 s fade for those who have not asked for less motion.
   Sentry's console look keeps it at once in every case (no arrival motion).
3. **A placeholder has the page's shape.** The strip of figures as many as the page shows, then
   the panels at their real widths, in the same grid: PostHog's `Loading({ kpis, figs, panels,
   cols })`, Sentry's `Loading({ stats, panels, rows, cols })`, the Overview's skeleton with all
   three rows. A placeholder inside a panel is `Pending`.
4. **Placeholder bars take their colour from the text around them** (`.sk-bar`,
   `src/styles/components/skeleton.css`), so one rule fits every page in both themes; a sheen
   crosses them only for those who want motion. Sentry keeps its own pulsing bars.
5. **A new answer changes the page in place.** No `key` that changes with the answer: the
   numbers count on from the old ones, and nothing rises in again. Only the first answer of a
   page rises in.
6. **What the browser must decide holds its place.** A control that waits for the browser (the
   Analytics range, read from the address or the last choice in this browser) is drawn hidden in
   its place (`.an-wait`) until then, never left out.
7. **Layout is settled before the first paint.** Anything that measures and moves the page
   (the Analytics wall) does so in `useLayoutEffect`.
8. **The server draws times in the viewer's zone.** The Overview's greeting and date use the
   zone Cloudflare places the viewer in (`request.cf.timezone`) on the server and the browser's
   own clock in the browser (`clockIn` in `overview/format.ts`): the same hour unless the device
   is set to another zone than the place it is in.
9. **The backdrop blooms once per tab.** After the first page swap the page carries
   `data-swapped` (`NativeNavigationState.astro`), and the glass backdrop stays still.
10. **A row of tabs keeps its place.** On a swap to a page with the same row it keeps where it
    was scrolled to, and the tab on screen is brought into view, on the first page too.
11. **The glass rises quickly.** 0.5 s for a card, 30 ms between cards, the last at 0.42 s:
    under a second for the whole board.

## 3. The Analytics summary's parts, side by side

Before the summary, the page asks for each part this person may open, one request each, at the
same time (`warmParts` in `Analytics.tsx`). Each part's request is its own run of the Worker,
with its own six connections, and leaves its copy in the edge cache for ten minutes; the summary
then reads those copies. Rules:

- Not again within nine minutes in the same browser tab for the same range and zone
  (`shouldWarm`, `WARM_MS`, kept in `sessionStorage`), while the copies are still kept.
- Refresh now asks the parts with `fresh=1` and then the summary without it, unless a part did
  not answer; a retry asks the summary alone with `retry=1`, which reads again only the parts
  whose source failed.
- The page reads no part's answer, only whether it came (`res.ok`); the summary itself still
  checks every key, so the parts change nothing about who sees what.

Measured before: the parts asked alone (from their copies mostly) answered in 12 to 32 ms at
the middle, 2 s at the slowest; the summary in 5 s at the middle and 14 s at the slowest. The
time after is to be read in Sentry once people have used it
(MAINTENANCE (private) LS-1).

## 4. Left as it is

- The console kit's `ck-skeleton` (dialogs and lists in the kit) and the 25 older pages that
  still pulse with Tailwind's `animate-pulse`: not part of this pass (LS-3).
- How long PostHog itself takes to answer (`/api/posthog/overview` 0.7 s at the middle, 9 s at
  the slowest) and the Configuration page's Cloudflare read (4.6 s at the middle): the sources'
  own time, not the page's (LS-2).

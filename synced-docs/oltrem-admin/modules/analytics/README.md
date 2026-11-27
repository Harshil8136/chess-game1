# @oltrem/analytics

Reports (`/analytics`): the portal's activity in numbers and charts, read from the audit log, so
every module that audits is counted with no code of its own and a quiet day shows zero; the
company's website visitors from its connected analytics apps; and each module's own report section.

## Using it

```ts
import { createAnalytics } from '@oltrem/analytics';
import { pages as analyticsPages } from '@oltrem/analytics/pages';
import { withPages } from '@oltrem/core-module';

const analytics = createAnalytics<Env>({ bindings: (env) => ({ db: env.DB }) });
const modules = [iam.module, /* ... */ withPages(analytics.module, analyticsPages)];
```

`createAnalytics` returns the `store` and the module, on IAM and the audit log, adding no binding,
secret or variable.

| Option | What it hands in |
|---|---|
| `timeZone` | The company's zone for the week of hours (UTC without it) |
| `web` | The website reports from the Apps page (`WebReport`, `src/types.ts`); the page's call hands in the company's clock and `waitUntil` |
| `modules` | The modules whose `report` sections are listed and whose money and steps the summary reads |
| `events` | More marks on the trend (the template: each day a version went live) |
| `alerts` | Where the morning check raises an unusual day |
| `send` | An email sender (template `analytics.message`); without it, no Monday summary and no job |
| `report` | Where a failure of `web`, `events` or a summary section goes |

One capability, bit plane `16`: `analytics.read`, held at the company itself.

## How it counts

`analytics.rollup` (every five minutes, idle fifteen) adds the audit rows since its cursor
(`oltrem_meta` `analytics.seq`) to daily counts in SQL, `LIMITS.chunk` (5,000) rows a statement,
`chunksPerRun` (4) a run, each statement and the cursor in one transaction; the first run starts
from the log's first row.

| Counted | By |
|---|---|
| Actions | Every row, by UTC day, action, outcome and kind of actor |
| Done automatically | Rows whose actor is the system |
| People active | Persons with a row that day, each once |
| Areas | The action's name before its first dot (`files.upload` is `files`) |
| Hours | Every row by UTC day, hour and kind of actor, on its own cursor (`analytics.hours_seq`), caught up a chunk at a time on an older portal; read on the company's clock by today's offset |

`analytics.prune` removes counts past `keptDays` (455: a year and ninety days to compare). The log
is untouched; removing the cursors and rows rebuilds the counts.

## The Monday summary

An extra (`analytics.summary`) that starts off (migration `0074_parts_summary_off.sql` for saved
lists). The daily job counts the last full week (Monday to Sunday, UTC) against the week before and
emails each Owner (active, holding the top role at the company directly or by group, not blocked,
`summaryTo` 5 at most) "Last week at" the company: a line per `SUMMARY_LINES` work done in either
week, people's changes (the portal's own left out), people who used it, the money sections against
the week before, the steps from visit to payment, each website app's last 7 days, and how to switch
it off. Sections are read in-process once, as the first Owner, after their routes' own check; a
failing one is reported and left out. It sends from Monday 01:00 UTC on the first run that finds the
week unsent (`analytics.summary_week`), each message keyed by week and Owner, the week marked sent
only once all went. A week with nothing sends nothing; a failed send fails the job and is made up
the next day.

## Unusual days

An extra (`analytics.unusual`) that starts off (migration `0103_parts_unusual_off.sql`). With
`alerts`, the daily job compares yesterday's actions, and each website app's visitors (or page
views), with the same weekday's average over the four weeks before (`UNUSUAL.samples`, three at
least): a move of `share` (half) or more from a usual day of `least` (10) or more raises one
warning (`analytics.unusual`, "Tuesday 2026-12-08 had 75% fewer actions in the portal than a usual
Tuesday"); a usual day resolves it. The page shows the same for the period's last full day.

## The page

| Path | Shows |
|---|---|
| `/analytics` | Tabs: **Activity**, **Website** when `web` is wired, and **Money**, **Customers**, **Work**, **Email**, **Services** where a module brings a section; an empty tab opens Activity. A period row for every tab (`PERIODS` 7, 30, 90, and **Custom**: any 1 to 90 days of the last year against as many before, without audit links or website apps) |
| Activity | Whose work (`WHO`: everyone, people, automatic, vendor); six figures with their moves; **Each day**, one trend of the picked figure with the period before dashed and `MARKS` (campaigns out, invoices sent) and `events` as dotted lines, the days as a table; **What stands out** in sentences, with an unusual last day; **Who did the work** as split bars; **When work happens** in shades; **By area** with trends, **Most frequent** in words, **People** (new, came back, busiest), **Work done**, **Refused or failed**, each linked into the audit log. Empty parts left out |
| Website | A board per app (`src/website.tsx`, 2026-11-27): figures and moves (events, goals, errors, stuck taps and recordings where counted, each linked to the app), "In plain words" sentences from the figures, a visitors trend, when visitors come (weekday by hour, on the company clock or the one set in the app), right now, how visitors found the site (kinds of source with bounce and visit length, websites, campaigns), pages (top, where visits start and end), where visitors are, what they use, how fast pages are (each reading graded against Google's limits: Good, Needs improvement, Poor), where visitors got stuck, PostHog's funnel (steps picked in its Funnel steps pop-up, which posts to this page and saves them on the connection through `POST /api/connect/analytics/:id/steps`), the recordings worth watching and the errors visitors met (each row opening it in PostHog), and events and goals, then Cloudflare's part for the domain (`src/edge.tsx`: every request with the window before and each day, how Cloudflare answered with the pages that failed, its cache, subdomains and pages, countries with threats, security (what each protection did, pages and countries, the latest events, never an address), bots and kinds of addresses, content and connections, each opening Cloudflare); each part shows only when the app counts it and opens the app's own page for it. A kept copy says when it was read and why, with a link to the connection; a part the app did not give is named; a failed report says why with a fix on Apps; with none connected, how to connect one |
| Module tabs | The open tab's sections from `GET /api/<module>/report` as the person, side by side: figures with moves, a daily line with the period before, lists linking their pages, amounts in their currency; a 403 is left out, a failure said. Money opens with **From visit to paid**: visitors, form answers, quotes sent, accepted, invoices paid, each with its count, move and carry-on share (two steps at least) |
| `/analytics/csv` | The period's days: day, actions, automatic, vendor, people, sign-ins, refused, failed |

The charts are the kit's report charts (`@oltrem/core-ui`). Days are UTC; hours on the company's
clock. Whose work narrows actions; people figures are everyone's.

## The routes

| Route | Needs | What it answers |
|---|---|---|
| `GET /activity` (`days` 1 to 90, default 30; `to` within the last year; `who`) | `analytics.read` | `range` with `to`, the marks, an unusual last day, both periods' totals and days, areas (`trended` 8) with moves and daily counts, the `top` (10) actions, the `problems` (6) refused or failed most, people (`busiest` 8), the week of hours, the named work, how far the counts reach and rows waiting |
| `GET /web` (`days`) | `analytics.read` | `wired`, each app's report, `failed` |
| `GET /parts` | `analytics.read` | The modules' sections (module, title, tab), whether `web` is wired, and today (UTC) |

## Tables, errors

`0024_analytics.sql`: `analytics_daily` (day, action, outcome, kind, count) and `analytics_people`
(day, person id, count); `0097_analytics_hours.sql`: `analytics_hours` (day, hour, kind, count).
Counts and ids the log already holds, never what changed. No errors of its own: another period is
`KIT-E-0422`, the company check `KIT-E-0403`.

## Not built yet

- Website visitors without an analytics app (would belong to the website edition, with a privacy
  choice).
- Days in the company's zone (the hours already are).

## Tests

| File | What it proves |
|---|---|
| `test/analytics.test.ts` | The manifest; nothing before the first run; the log counted from its first row in chunks, once; quiet days at zero, the period before, areas and actions; the company check; pruning; whose work, the hours on a clock ahead of UTC and caught up; people, refusals, named work; the Monday summary (timing, the week, the Owners and who is not one, never twice, a failed send made up with the same keys, money, steps and website read once) |
| `test/unusual.test.ts` | An unusual day, a range with its marks and last full day, the alert raised and resolved |
| `test/pages.test.ts` | Areas and actions in words linked to the log, what stands out, option rows keeping each other, the chart's figure, the Website part hidden, empty, filled or failed, the board's every part with its words, grades, links, kept copy and missing part, the funnel, recordings and errors, the steps saved or refused, Cloudflare's part with its security and bots, the marks, the unusual line, Custom, the CSV |

The template's screens test opens the page before any count, then reads it after a tick and
downloads the CSV.

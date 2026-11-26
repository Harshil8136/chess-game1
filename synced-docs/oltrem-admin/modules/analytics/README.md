# @oltrem/analytics

Analytics: the portal's activity in numbers and charts. How much was done each day, by how many
people, how much the portal did on its own, what was refused or failed, which areas and actions were
busiest, who did the most, when in the week work happens, and how all of it compares with the period
before; and, when the Apps page hands them in, the company's website visitors from its connected
analytics apps. Read from the audit log, so every module that audits its changes is counted with no
code of its own, and nothing is made up: a day without activity shows zero.

## Using it

```ts
import { createAnalytics } from '@oltrem/analytics';
import { pages as analyticsPages } from '@oltrem/analytics/pages';
import { withPages } from '@oltrem/core-module';

const analytics = createAnalytics<Env>({ bindings: (env) => ({ db: env.DB }) });
const modules = [iam.module, /* ... */ withPages(analytics.module, analyticsPages)];
```

`createAnalytics` returns the `store` (the counting and the reading) and the module manifest. It
stands on the IAM module (sessions, the authorizer) and the audit log, and adds no binding, secret
or variable. Its other options: `timeZone`, the company's time zone, which the hours of the week are
read in (UTC without it; the client template passes the company clock's setting); `web`, which
hands in the website reports (below); `parts`, the sections the portal's modules bring to Reports
(below; the client template lists every module that is on and has a `report`); and `report`,
where a failure of `web` is reported.

With `send`, a function that emails one message (the client template passes the portal's email
module, with the template `analytics.message`), the module also has the Monday summary below.
Without it there is no summary and no job for it.

## Who may do what

One capability on bit plane `16`: `analytics.read` sees the counts. It is read at the company
itself, since the counts are the whole company's; someone who holds it only at a place is refused.

## How it counts

The job `analytics.rollup`, every five minutes while the log grows and every fifteen while a run
finds nothing new (it answers `'idle'`), adds the audit rows written since its last run
(`oltrem_meta` key `analytics.seq`) to two tables of daily counts, in SQL, so the Worker spends no
CPU time on them however many there are: 5000 rows a statement, four statements a run. Its first
run starts from the log's first row, so a portal sees its history from the day the module is
mounted. Each statement and the cursor move in one transaction, so a row is counted once.

| Counted | By |
|---|---|
| Actions | every audit row, by UTC day, action, outcome (`ok`, `refused`, `failed`) and kind of actor |
| Done automatically | the rows whose actor is the system: jobs, automations, website answers |
| People active | the people (actor kind `person`) with at least one row that day, each once |
| Areas | the part of an action's name before its first dot: `files.upload` is `files` |
| Hours | every audit row, by UTC day, hour and kind of actor, for the week of hours |

The hours have their own cursor (`analytics.hours_seq`): on a portal that counted by day before
they were kept, the job first counts the whole log by hour, a chunk at a time within the same four
statements a run, then moves the hours with the days in the same transaction. The week of hours is
read on the company's clock, shifted by its offset today (a zone that changes its clocks reads the
weeks before the change an hour off).

The job `analytics.prune` removes the counts older than 455 days: a year, and a period of ninety
days before it to compare with. The audit log itself is untouched; the counts can be rebuilt from
it by removing the two cursors and the three tables' rows.

## The Monday summary

An extra of Analytics, **Monday summary** (`analytics.summary`), off on a new portal and on every
portal that had saved its modules before it (migration `0074_parts_summary_off.sql`); the Owner
switches it on under Reports on the Features page. While it is on, the daily job
`analytics.summary` counts the last full week, Monday to Sunday (UTC), against the week before,
from the daily counts of successful audit rows, and emails each Owner (an active person holding
the top role at the company, themselves or through a group, not blocked, five at most) one plain
message, "Last week at" the company: a line for each named piece of work done in either week
(answers to the website forms, customers added and customer imports, quotes sent and accepted,
invoices sent and paid, bookings, tasks done, records added, time off and expenses asked for,
approvals asked for), the changes people made (the portal's own work left out), the people who
used it, and how to switch it off. It sends from Monday 01:00 UTC, once Sunday's last changes are
counted, on the first run that finds the week not sent (`oltrem_meta` key
`analytics.summary_week`), so a run that drifted past Monday, waited for the free plan's budget or
failed is made up the day after. Each message carries the week and the Owner's id as its key, so
a retry sends nobody theirs twice; the week is marked sent only once every Owner's went. A week
with nothing done in either week sends nothing. A send that fails is counted and the job fails
with the first cause, so the Jobs page shows it.

## The page

| Path | Shows |
|---|---|
| `/analytics` | tabs in a sideways row ([the record](../../archive/records/2026-11-26-reports-every-part.md)): **Activity** (below), **Website** when the portal hands website reports in, and **Money**, **Customers**, **Work** and **Email** when a module brings a section there (below); a tab with nothing under it opens Activity. Activity, remade 2026-11-26 ([the record](../../archive/records/2026-11-26-reports-remade.md)): a row of periods (7, 30 or 90 days, today included) and one of whose work (Everyone, People, Automatic, Vendor); six figures (actions, people active, sign-ins, the share done automatically, the share that went through, refused or failed), each with its move against the period before; **Each day**, one trend of the figure picked above it (actions, people, sign-ins, automatic, refused or failed) with the period before as a dashed line, the days as a table and the CSV; **What stands out**, the figures as sentences (busier or quieter, the busiest day, the busiest hour, the area that grew most, the people and how many a day, the portal's own share, what was refused most); **Who did the work** and how it went, as split bars; **When work happens**, a week of hours in shades on the company's clock; **By area** with a trend each, **Most frequent** actions in words (`Tasks: create`), **People** (active, new, came back, a day, who did the most), **Work done** (the summary's named work) and **Refused or failed**, each row with its move and a link into the audit log narrowed to it. A part with nothing to show is left out. The period row is every tab's; whose work is Activity's alone |
| `/analytics/csv` | the period's days as a CSV file (the same whose work): day, actions, automatic, vendor, people, sign-ins, refused, failed; numbers and dates only |

The charts are the kit's report charts (`@oltrem/core-ui`, its README), SVG drawn on the server
with nothing running in the browser, each a fixed height so nothing moves. Days are UTC, as every
time the portal keeps; the hours are on the company's clock. Whose work narrows the actions; the
people figures are always everyone's.

### Website

The Apps page fetches each connected website analytics app (PostHog, Plausible, Umami Cloud,
Cloudflare Web Analytics first, then Google Analytics) and hands its reports in through `web`
(`WebReport` in `src/types.ts`, the contract agreed with that work on 2026-11-26: totals, the
period before, live visitors, each day, and lists of pages, sources, countries, devices, browsers
and events, each optional). Each report is a pane: its figures with their moves, a trend of its
visitors (or page views), its lists, how many are on the site now and a link to the app's own
dashboard; a report that could not be made says why with a link to fix it on Apps. Without `web`
the part is not shown; with it and no app connected, it says how to connect one; when the call
fails it is reported and the part says so. The Apps page caches each report (the Cache API, never
KV), so a page view asks no app.

### The modules' sections

Each module that declares `report` (`@oltrem/core-module`, its README) brings a section to one of
the tabs Money, Customers, Work or Email: invoices, quotes and expenses under Money; customers and
form answers under Customers; tasks and bookings under Work; email and campaigns under Email. The page asks `GET /parts` for the list
and today's date, then only the open tab's sections, each from its own module's
`GET /api/<module>/report` as the person and side by side. A section is a pane: its figures with
their moves against the period before (none when the period before cannot be known), one line a
day with the period before dashed, and its lists, each row opening its page. Amounts are shown in
their currency. A section the person may not see (403) is left out; one that could not be read
says so; a tab where none is left says so.

The Money tab opens with **From visit to paid**: the website's visitors (the first connected app
that counts them), then the steps the parts count (`steps`): form answers, quotes sent, quotes
accepted, invoices paid. Each step shows its count, its move against the period before and the
share of the step before that carried on; a step the person may not see, or that nothing counts,
is left out, and with fewer than two steps nothing is drawn. No single app holds more than one
step, so Money also reads the website and the form answers for it.

## The routes

| Route | Capability | What it answers |
|---|---|---|
| `GET /activity` (`days` 7, 30 or 90, 30 when left out; `who` people, automatic or vendor) | `analytics.read` | the period's totals and those of the period before, every day of both, the areas with their move and each day's count (the eight busiest), the ten most frequent actions and the six refused or failed most with their moves, the people (new, back, the eight busiest by address), the week of hours on the company's clock, the named work, when the counts reach and how many rows wait for the next run |
| `GET /web` (`days`) | `analytics.read` | whether the portal hands website reports in (`wired`), each connected app's report, and `failed` when they could not be read |
| `GET /parts` | `analytics.read` | the sections the portal's modules bring to Reports (module, title, tab), whether `web` is wired, and today (UTC) as the day to read them to; the same list for everyone, since each section checks the person itself |

## Tables

Migration `0024_analytics.sql`, additive and idempotent: `analytics_daily` (a day, an action, an
outcome, a kind of actor, a count) and `analytics_people` (a day, a person's id, a count). Migration
`0097_analytics_hours.sql`: `analytics_hours` (a day, an hour, a kind of actor, a count). They hold
counts and the ids the audit log already holds, never what was changed.

## Errors

None of its own: another period is refused by the route's schema (`KIT-E-0422`), and the company
check answers `KIT-E-0403`.

## Not here yet

- Website visitors without an analytics app: counting the portal's own website would belong to
  the website edition, with a privacy choice of its own.
- Email, services and the money funnel as sections: the next batches of the plan of 2026-11-26.
- Days in the company's own time zone (the hours are on its clock).

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; nothing
counted before the first run, with the rows waiting; the log counted from its first row in chunks,
each row once, the people by day; a period with its quiet days at zero, the period before, the areas
and the most frequent actions, the rows waiting and then counted; the capability read at the company
and another period refused; pruning. The client template's screens test opens the page before any
count, then after a tick reads its figures, charts and areas, and downloads the CSV. Also whose
work, the week of hours on a company clock ahead of UTC, and the hours caught up for a portal that
counted by day first; the people (new, back, the busiest), the refused or failed most and the named
work. The page, against answers of the API (`test/pages.test.ts`): every area and action in words
and linked to the audit log, the refused or failed figure linked to it, what stands out in words,
the rows of options keeping each other, the figure the chart draws, the Website part hidden, empty,
filled or failed, and the CSV. The Monday summary (`test/analytics.test.ts`): nothing before Monday
01:00 or on a quiet week, the last full week against the week before with its named lines and the
portal's own work left out, the Owners (through a group too; not switched off, blocked, ended, not
started, at a place only or a service account), nothing twice later that day or on Tuesday, and a
failed send failing the job and made up the next day with the same keys.

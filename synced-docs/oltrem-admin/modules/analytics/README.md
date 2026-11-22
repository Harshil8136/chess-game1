# @oltrem/analytics

Analytics (the owner's request of 2026-10-27 for "an analytics system"): the portal's activity in
numbers and charts. How much was done each day, by how many people, how much the portal did on
its own, what was refused or failed, which areas and actions were busiest, and how all of it
compares with the period before. Read from the audit log, so every module that audits its changes
is counted with no code of its own, and nothing is made up: a day without activity shows zero.

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
or variable.

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

The job `analytics.prune` removes the counts older than 455 days: a year, and a period of ninety
days before it to compare with. The audit log itself is untouched; the counts can be rebuilt from
it by removing the cursor and the two tables' rows.

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
| `/analytics` | a row of periods (7, 30 or 90 days, today included); the four figures (actions, people active, done automatically, refused or failed), each against the period before; a bar chart of the actions and one of the people active each day, every bar's day and figure on hover; the days as a table; the busiest areas with a bar each, by their names; the ten most frequent actions in words (`Tasks: create`), never their codes; when the newest change counted was made. The refused or failed figure opens the audit log narrowed to them |
| `/analytics/csv` | the period's days as a CSV file: day, actions, automatic, people, refused, failed; numbers and dates only |

The charts are SVG drawn on the server: one hue, the busiest day as the top of the scale, nothing
running in the browser. Days are UTC, as every time the portal keeps.

## The routes

| Route | Capability | What it answers |
|---|---|---|
| `GET /activity` (`days` 7, 30 or 90; 30 when left out) | `analytics.read` | the period's totals and those of the period before, every day, the areas, the ten most frequent actions, when the counts reach and how many rows wait for the next run |

## Tables

Migration `0024_analytics.sql`, additive and idempotent: `analytics_daily` (a day, an action, an
outcome, a kind of actor, a count) and `analytics_people` (a day, a person's id, a count). They
hold counts and the ids the audit log already holds, never what was changed.

## Errors

None of its own: another period is refused by the route's schema (`KIT-E-0422`), and the company
check answers `KIT-E-0403`.

## Not here yet

- Website visitors (page views, sources): that analytics belongs to the website edition, with a
  privacy choice of its own.
- Figures a module counts itself (emails delivered, files stored): the audit log counts what was
  done; a module's own series would need a small contract in core-module.
- Days in the company's own time zone.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; nothing
counted before the first run, with the rows waiting; the log counted from its first row in chunks,
each row once, the people by day; a period with its quiet days at zero, the period before, the
areas and the most frequent actions, the rows waiting and then counted; the capability read at the
company and another period refused; pruning. The client template's screens test opens the page
before any count, then after a tick reads its figures, charts and areas, and downloads the CSV.
The page, against answers of the API (`test/pages.test.ts`): every area and action in words, and
the refused or failed figure linked to the audit log. The Monday summary
(`test/analytics.test.ts`): nothing before Monday 01:00 or on a quiet week, the last full week
against the week before with its named lines and the portal's own work left out, the Owners
(through a group too; not switched off, blocked, ended, not started, at a place only or a
service account), nothing twice later that day or on Tuesday, and a failed send failing the job
and made up the next day with the same keys.

---
title: "@oltrem/core-health: The Cloudflare plan's budgets; Service status; Web addresses to watch; Table"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-health/src; split from packages/core-health/README.md]
---

# @oltrem/core-health: The Cloudflare plan's budgets; Service status; Web addresses to watch; Table

> Part of [the @oltrem/core-health README](../README.md).

## The Cloudflare plan's budgets

```ts
const health = createHealth<Env>({
  bindings: (env) => ({ db: env.DB }),
  modules,
  budgets: {
    // `accountId` is the client's own reader of the account setting the backup module keeps too.
    account: (env) => accountId(env),
    token: (env) => env.KIT_OPS_TOKEN,
    plan: async (env) => (await settingsFor(env)).get<CloudflarePlan>('health.cloudflare_plan'),
    queue: (env) => env.EVENTS,
    // Named in the key's steps, and what the key needs beyond the recipe's two permissions.
    worker: () => 'acme-portal',
    permissions: addon ? [{ key: 'dns', type: 'edit' }] : [],
  },
});
const scheduler = createScheduler<Env>({
  bindings,
  modules,
  pause: health.pause,
  queryBudget: async (env) => PLAN_LIMITS[await health.plan(env)].jobQueries,
});
```

### The plan, and what one run may do

A client stays on Cloudflare's free plan or moves to Workers Paid; the kit follows. The module
carries one setting, `health.cloudflare_plan` (`free` or `paid`, default `free`, system layer, the
Owner changes it, at once), read through `plan`. A plan that cannot be read counts as free, the
stricter of the two. `PLAN_LIMITS` holds what one invocation may do on each, from Cloudflare's
Workers and D1 limits, and the run sizes follow it: the tick's `queryBudget` above, and bulk
mail's slices (the campaigns module).

| One run may make | Workers Free | Workers Paid |
|---|---|---|
| D1 queries | 50 | 1,000 |
| of them, the tick's jobs (`jobQueries`) | 45 | 900 |
| Calls to other services | 50 | 10,000 |
| CPU time | 10 ms | 30 s |

### The free plan

Given `budgets`, the module adds a job, a check and a key recipe (plan 10). On the free plan:

| Budget | Free plan limit | Warns from | Pauses the jobs |
|---|---|---|---|
| D1 rows read today | 5,000,000 | 70% | from 90% |
| D1 rows written today | 100,000 | 70% | from 90% |
| Database size | 500 MB | 60% (the plan's 300 MB alarm) | from 90% |
| KV writes today | 1,000 | 70% | from 90% |
| Queue operations today | 10,000 | 70% | from 90% |
| Worker requests today | 100,000 | 70% | from 90% |
| Worker CPU time of a typical request today (median) | 10 ms | 70% | never: no job spends it |
| Worker CPU time per request, 95th percentile today | shown, not judged | never | never |
| Requests Cloudflare stopped today for going over a limit | 10 | the first one | never |
| R2 storage kept | 10 GB | 80% | never |
| R2 Class A operations this month (writes, lists) | 1,000,000 | 70% | never |
| R2 Class B operations this month (reads) | 10,000,000 | 70% | never |

The three R2 budgets are the free allowance every plan includes, so they are measured on the paid
plan as well; a month's operations count from the first of the month (UTC), the storage is the
newest day's size of each bucket. Deletes and aborted uploads are free and not counted. Files,
Storage shows them beside the other budgets.

**CPU time is judged by what Cloudflare does with it**. Cloudflare's limits page says an isolate has
some flexibility for a Worker that runs over the 10 ms now and then, and that one which hits the
limit consistently is stopped. A portal has little traffic, so its slowest requests are the first
ones of a fresh copy of the Worker, which run several times over a warm one's time (measured on this
computer: Home 56 ms cold, 8 ms warm); a live portal failed this check at 434% for days with nothing
stopped. So the typical request (`workers.cpu_p50`) is held to the 10 ms, the requests Cloudflare
stopped (`workers.stopped`: the invocations whose status begins `exceeded`, for CPU time or memory)
warn from the first and fail from nine, and the 95th percentile (`informs` on its definition) keeps
its row with the figure alone and a note when it is over, so a rise is still seen. `health.budgets`
says a stopped request in words: "Cloudflare stopped 3 requests today for going over a limit (CPU
time or memory)".

- **`health.measure`**, every fifteen minutes, runs before `health.run`. The size is the one D1
  reports after any query. Everything else comes from one call to Cloudflare's GraphQL Analytics API
  with `KIT_OPS_TOKEN`: the account's totals since midnight UTC, which are the client's, since each
  client has its own account (the invocations asked for twice in that one call: whole, and split by
  how each ended). One batch writes a row per budget; a budget it cannot measure keeps its last
  figure and records why (the token or the account not set, the call's error, never the token). A
  key Cloudflare cannot read or does not know (a 401, or Cloudflare's codes 6003, 6111, 9106, 9109,
  10000 or 10001, which come on a 400 as often) is named with its fix: make a new token with Account
  Analytics Read and set it as `KIT_OPS_TOKEN`.
- **`health.budgets`**, lane `budget`, fails when a budget is at or past 90% of its limit and warns
  from its warning line, or when a figure is missing or could not be refreshed. A daily figure
  counts only on the UTC day it was taken, since the limits reset at midnight UTC. A budget measured
  without a problem late the day before, under 75 minutes ago (`NEW_PERIOD_GRACE_MS`: the measure's
  idle hour and a tick), is not a warning while it waits for the day's first figure: its `note` says
  so. Missing past that, it warns again: the measure has stopped. A measure that failed keeps its
  problem and warns at once. The message names each budget past its line with its figure, then each
  problem once with the budgets it left unmeasured.
- **`pause`**, for the scheduler: while a budget the jobs spend is at or past 90%, every job but
  `health.run` and `health.measure` waits. Nightly flows run as Workflows, not jobs, so the backup
  still runs.
- **`shed(env)`**, for the public hooks (`@oltrem/core-http`'s `shed`): on the free plan, while D1
  rows read, D1 rows written or Worker requests (`SHED_BUDGETS`) is at its fail line, it gives
  `SHED_DETAIL`, which says the public addresses rest until midnight UTC; otherwise null. Cloudflare
  refuses every D1 query past the free limit until midnight UTC, so the hooks rest first and the
  signed-in pages keep the rest. The answer is kept a minute per isolate (`SHED_MEMO_MS`), so a
  flood reads the budgets once a minute; a read that fails gives null.
- **`budgets(env)`** gives each budget's figure, share, status, when it was measured and its
  problem, for the page.
- **`OPS_TOKEN_RECIPE`** lives here and the backup module declares the same one: the token needs
  Account, D1, Edit for the backup and Account, Account Analytics, Read for the budgets.
- **The key's steps**, for an owner who only has a phone: when the last measure found no key, a key
  Cloudflare refuses or one without Account Analytics Read (`keyStateOf`), `GET /api/health/budgets`
  adds `key`: its `state` (`missing`, `refused` or `lacks`), `form` (Cloudflare's account-token form
  opened with `OPS_TOKEN_PERMISSIONS` and the client's `permissions` chosen, `opsTokenForm`, the URL
  the command-line tool's deploy prints), `workers` (the dashboard's Workers and Pages,
  `WORKERS_PAGE`) and `worker` (the name the client gives). Status shows them above its checks as
  three steps: make the key, set it in the Worker's Variables and Secrets, press Check again now,
  which measures the budgets before it runs the checks. Once a measure succeeds, `key` is null and
  the steps go.

### Workers Paid

On Workers Paid the job measures the month, from the 1st at 00:00 UTC to now (Cloudflare counts
what is included from the billing date, which the 1st approximates), against what the plan
includes. Use beyond it is billed, not refused, so these warn from 70% and fail from 90% without
pausing anything; only the size, a cap per database, pauses.

| Budget | Included a month | Pauses the jobs |
|---|---|---|
| D1 rows read | 25 billion | never: billed beyond |
| D1 rows written | 50 million | never: billed beyond |
| Database size | 10 GB per database | from 90% |
| KV writes | 1 million | never: billed beyond |
| Queue operations | 1 million | never: billed beyond |
| Worker requests | 10 million | never: billed beyond |

Workers CPU time is billed by the month's total, which the analytics call does not give: it is
not measured here, and Cloudflare's billing page shows it. A row keeps the period it counts
(`YYYY-MM-DD` or `YYYY-MM` in `day`), so after a change of plan the other plan's figures count for
nothing until the next measure, fifteen minutes later at most.

### The events queue

Given `queue`, Status asks Cloudflare for the queue's backlog when the page opens
(`queue(env)`: how many events wait, their size, since when the oldest waits) and adds one check,
**`health.queue`**, lane `budget`: it warns when the oldest event has waited 15 minutes and fails
from an hour, since the consumer is then not taking them; a backlog that cannot be read warns.

Not measured here yet: GitHub Actions minutes, which `oltrem doctor` is to show (plan 10). Owed to
the sandbox: the `actionType` value of a KV write and the unit of the CPU quantile, taken from
Cloudflare's documentation.

## Service status

Given `statusPages`, a `pages(env)` function and, for tests, a `fetch`, the health module declares
one more check (the feature plan's provider status): `health.status-pages`, lane `services`, every
30 minutes (`STATUS_PAGES_EVERY`). It reads the public status page of each service the portal leans
on, side by side, at `<page>/api/v2/status.json`, the common format those pages answer in, each
within 3 seconds (`STATUS_PAGE_MS`), at that address only (a move elsewhere is said, not followed)
and 16 KB of its answer at most. The client template names Cloudflare's page and the page of each
email service set to send (the active one and its failovers) whose provider definition names one
(`status`, `@oltrem/providers`).

Only a major or critical outage warns, naming the service first; a minor problem somewhere in a
large network is reported most days and changes nothing for the portal, so it is OK, said in the
page's own words. A page that does not answer, answers an error or answers another shape is said
so and stays OK: the check never fails, so it never opens an alert. An outside page's words are
kept to letters, digits and plain punctuation, 80 characters each. It is an extra of the System
status part that starts off (`health.status-pages`, `@oltrem/core-config`): off, it is neither
run nor listed, and no page is asked.

## Web addresses to watch

Given `watched`, an `addresses(env)` function and, for tests, a `fetch`, the health module declares
the check `health.addresses`, lane `services`, every 15 minutes (`WATCHED_EVERY`), and the setting
`health.watched_addresses` (`WATCHED_SETTING`, Settings, Company, editable by an Owner). The setting
holds up to 10 lines (`WATCHED_MAX`), each an `https://` address, optionally followed by ` | ` and a
few words its page must hold (`https://shop.example.com | Add to cart`). The client template hands
the setting's lines in.

Every address is read side by side, each within 4 seconds (`WATCH_WAIT_MS`, inside the check's
own 5). An answer outside 2xx, no answer in time, an address that cannot be reached (the cause is
named) or the words not found in the first 64 KB of the page (`WATCH_BYTES_MAX`, case ignored)
fails, naming each address that failed first. Two runs in a row open one problem, which System
status raises as an alert. An address that answers but takes longer than 2 seconds
(`WATCH_SLOW_MS`) only warns, and so does one that moves (3xx): a move is not followed, since it
could lead anywhere, and the message names where it goes so the Owner watches that address. With
no lines, the check is OK and asks nothing. The words name no times, so a quiet list writes its
row only when what it found changes, as for every check; Status shows how long it took.

Only public addresses are taken (`publicAddress`, the same rule as a webhook's address in the
developer module): `https://`, no user or password, a name with a dot, not a number and not a
name kept for inside networks (`.local`, `.internal`, `.corp` and the like). The setting refuses
the rest, and the check refuses again any line handed in another way. A message shows an
address's host and path, never its query, which can carry a key: it reaches Status and
the alert email.

## Table

Migration `0009`, `oltrem_health`: `id`, `module_id`, `lane`, `status`, `message`, `checked_at`,
`ms`, `failures`, `open_since`. One row per check, written by the job when the check's result
changes, and the row `~checked`, whose `message` holds when each check last ran and the time it
took, as JSON; `list` answers each check with those two. Nothing else writes the table.

Migration `0014`, `oltrem_budgets`: `id`, `used`, `day`, `measured_at`, `tried_at`, `problem`. One
row per budget, written by `health.measure`; nothing else writes it.

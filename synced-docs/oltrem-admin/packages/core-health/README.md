# @oltrem/core-health

System health of a client Worker (plan sections 4.3 and 10): every module declares its checks on
its manifest, one job on the tick runs them all, and one table keeps the last result per check.
A problem opens only after two failures in a row (two-fails-open), so one bad minute never pages
anyone. The health page, acknowledging and snoozing come with the health module of phase 5; the
alerts with the providers of phase 4, through `onOpen` and `onClose`.

## Declaring a check

```ts
export const notes = defineModule({
  id: 'notes',
  version: '1.0.0',
  health: [
    {
      id: 'notes.store',
      lane: 'storage',
      summary: 'The notes table answers',
      run: async (env) => {
        await env.DB.prepare('SELECT 1 FROM notes LIMIT 1').first();
        return { status: 'ok' };
      },
    },
  ],
});
```

| Field | Rule |
|---|---|
| `id` | `<module>.<name>`, stable: the key of its row |
| `lane` | the group the page shows it under, lower-case letters, digits and dashes: `storage`, `email`, `access` |
| `summary` | a few words the health page shows |
| `run(env, ctx)` | answers `{ status: 'ok' \| 'warn' \| 'fail', message? }`; a throw, no answer within the timeout (five seconds) or an answer of another shape is a failure with the reason |

The contract (`@oltrem/core-module`) refuses a bad id, lane or summary when the module loads.

## Running the checks

```ts
const health = createHealth<Env>({ bindings: (env) => ({ db: env.DB }), modules, report });
modules.push(health.module);
const scheduler = createScheduler<Env>({ bindings: (env) => ({ db: env.DB }), modules, report });
```

`createHealth` returns the runner and the `health` module, with one job, `health.run`, every
five minutes, and two routes for System health, each checked against `health.read` (bit plane 6,
a read): `GET /api/health/checks` (every row `list` returns) and `GET /api/health/budgets` (each
budget's reading as `items`, an empty list when the budgets are not measured, with the `plan`,
what one run may do on it as `limits`, and the events queue's backlog asked live as `queue`), and the Home card's
`GET /api/health/home` (how many checks fail or need a look). The tick runs the job like
any other job, so a client gets system health by mounting the module, with no cron of its own.
On each run, every declared check is run in manifest order, with the time it took, and its row
written: the status, the message (its first 400 characters), when, how many failures in a row,
and since when the problem is open. The count of failures in a row resets on any pass or
warning. From the second failure in a row the problem is open: `onOpen(row, env)` is called
once, when it opens, and `onClose(row, env)` once, when the check passes again; a failure of
either hook is reported through `report(error, checkId)` and the run goes on.

`run(env, ctx)` returns the ids by status and the ids opened and closed on that run. `list(env)`
returns every row by lane then id, with `declared` false for the row of a check no mounted module
declares any more; the row is kept.

Given `off` (the parts switched off on the Parts page, `@oltrem/core-config`), a switched-off
module's checks are not run and its rows are left out of `list`, so of the page, Home's card and
their counts; a problem of theirs that was open is closed through `onClose`, so its alert
resolves, and so is one of a check no mounted module declares any more. Switched back on, its
checks run again on the next tick (`test/parts.test.ts`).

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
| Worker CPU time per request, 95th percentile today | 10 ms | 70% | never: no job spends it |

- **`health.measure`**, every fifteen minutes, runs before `health.run`. The size is the one D1
  reports after any query. Everything else comes from one call to Cloudflare's GraphQL Analytics
  API with `KIT_OPS_TOKEN`: the account's totals since midnight UTC, which are the client's, since
  each client has its own account. One batch writes a row per budget; a budget it cannot measure
  keeps its last figure and records why (the token or the account not set, the call's error,
  never the token).
- **`health.budgets`**, lane `budget`, fails when a budget is at or past 90% of its limit and
  warns from its warning line, or when a figure is missing or could not be refreshed. A daily
  figure counts only on the UTC day it was taken, since the limits reset at midnight UTC. The
  message names each budget past its line with its figure, then each problem once with the
  budgets it left unmeasured.
- **`pause`**, for the scheduler: while a budget the jobs spend is at or past 90%, every job but
  `health.run` and `health.measure` waits. Nightly flows run as Workflows, not jobs, so the backup
  still runs.
- **`budgets(env)`** gives each budget's figure, share, status, when it was measured and its
  problem, for the page.
- **`OPS_TOKEN_RECIPE`** lives here and the backup module declares the same one: the token needs
  Account, D1, Edit for the backup and Account, Account Analytics, Read for the budgets.

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

Given `queue`, System health asks Cloudflare for the queue's backlog when the page opens
(`queue(env)`: how many events wait, their size, since when the oldest waits) and adds one check,
**`health.queue`**, lane `budget`: it warns when the oldest event has waited 15 minutes and fails
from an hour, since the consumer is then not taking them; a backlog that cannot be read warns.

Not measured here yet: GitHub Actions minutes, which `oltrem doctor` is to show (plan 10). Owed to
the sandbox: the `actionType` value of a KV write and the unit of the CPU quantile, taken from
Cloudflare's documentation.

## Table

Migration `0009`, `oltrem_health`: `id`, `module_id`, `lane`, `status`, `message`, `checked_at`,
`ms`, `failures`, `open_since`. One row per check, written by the job; nothing else writes it.

Migration `0014`, `oltrem_budgets`: `id`, `used`, `day`, `measured_at`, `tried_at`, `problem`. One
row per budget, written by `health.measure`; nothing else writes it.

## Tests

Inside the Workers runtime against migrations 0008 and 0009: two checks run and their rows
written; a problem opened on the second failure in a row and not the first, `onOpen` called once,
closed on the next pass with `onClose`, the failure count reset by a warning; a check that throws,
one that does not answer in time and one that answers nonsense recorded as failures with the
reason; the rows listed by lane with an undeclared one kept; the tick running the checks through
the health job beside the scheduler; and the contract's refusals of a bad check, migration,
setting or error. The budgets, with a stand-in for Cloudflare's API: nothing added without the
option; one call with the token and the UTC day, every figure read, only KV writes counted, the
CPU time in milliseconds and the size from D1; the check warning at 75% and failing at 95%; the
other jobs paused through the scheduler while the health jobs run, and running again after
midnight UTC; a 403 keeping the last figure with the reason; a missing token named once for the
budgets it leaves unmeasured; the token in no reading; and the analytics errors named. Workers
Paid: the month asked from the 1st, the budgets it includes, 96% failing without a pause, the
month's figures not counting once back on the free plan; a plan that cannot be read taken as
free; and the queue's backlog read live, warning at 20 minutes, failing at 90, and a backlog that
cannot be read warning.

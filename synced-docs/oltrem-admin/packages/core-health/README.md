# @oltrem/core-health

System status of a client Worker (plan sections 4.3 and 10): every module declares its checks on
its manifest, one job on the tick runs them, each at its own pace, and one table keeps the last
result per check.
A problem opens only after two failures in a row (two-fails-open), so one bad minute never pages
anyone. The System status page, acknowledging and snoozing come with the health module of phase 5; the
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
| `summary` | a few words the System status page shows |
| `every` | optional: how often it runs, as a job's interval (`5m`, `1h`); `15m` (`CHECK_EVERY`) when left out. A check that failed last time runs on every run of the job until it passes |
| `run(env, ctx)` | answers `{ status: 'ok' \| 'warn' \| 'fail', message? }`; a throw, no answer within the timeout (five seconds) or an answer of another shape is a failure with the reason |

The contract (`@oltrem/core-module`) refuses a bad id, lane, interval or summary when the module
loads.

## Running the checks

```ts
const health = createHealth<Env>({ bindings: (env) => ({ db: env.DB }), modules, report });
modules.push(health.module);
const scheduler = createScheduler<Env>({ bindings: (env) => ({ db: env.DB }), modules, report });
```

`createHealth` returns the runner and the `health` module, with one job, `health.run`, every
five minutes, and two routes for System status, each checked against `health.read` (bit plane 6,
a read): `GET /api/health/checks` (every row `list` returns) and `GET /api/health/budgets` (each
budget's reading as `items`, an empty list when the budgets are not measured, with the `plan`,
what one run may do on it as `limits`, the events queue's backlog asked live as `queue`, and, while
the key is why the budgets go unmeasured, the steps to fix it as `key`), and the Home card's
`GET /api/health/home` (how many checks fail or need a look). The tick runs the job like
any other job, so a client gets system health by mounting the module, with no cron of its own.
Each run of the job takes the checks whose time has come, so it fits in the tick's 45 queries
(the Free plan's 50 an invocation) beside the other jobs: a check never run, one that failed last
time and waits to be confirmed, and one whose `every` has passed since it last ran (five minutes
at least, less half a run of slack); the ones to confirm first, then the ones never run, then the
longest overdue, twelve at most a run (`CHECKS_PER_RUN`), and the job comes back five minutes
later for the rest.

The job sleeps while all is well (2026-11-12): a run that leaves no failure to confirm and no
check waiting answers `'idle'`, and the next run is half an hour away (`HEALTH_IDLE`) instead of
five minutes. A first failure brings the job back five minutes later to confirm it, so a problem
opens within about 35 minutes of starting, where it was 10; a run by hand (the jobs page's Run
now) checks at once. A run used to cost a row written per check, every five minutes, whatever it
found: about 1,600 rows a day on a portal with nothing wrong. Now a check's row is written only
when its status, message or count of failures changed, and when each check last ran, with the
time it took, is kept together in one row of the same table (id `~checked`, never listed), one
write a run.

The checks taken run in manifest order, each with the time it took, and the rows that changed are
written in one batch with the row of last runs: the status, the message (its first 400
characters), how many failures in a row, and since when the problem is open. The count of failures in a row resets on any pass or
warning. From the second failure in a row the problem is open: `onOpen(row, env)` is called
once, when it opens, and `onClose(row, env)` once, when the check passes again, after the rows
are written; a failure of either hook is reported through `report(error, checkId)` and the run
goes on.

`run(env, ctx)` runs every declared check at once, whatever its pace, and returns the ids by
status and the ids opened and closed on that run. `list(env)`
returns the declared checks' rows by lane then id. The row of a check no mounted module declares
any more is kept in the table but left out of `list`, so of the page, the report and Home's card:
before 2026-11-12 a check taken out of the kit (`iam.door`) showed its last answer for ever.

Given `off` (the parts switched off on the Modules page, `@oltrem/core-config`), a switched-off
module's checks are not run and its rows are left out of `list`, so of the page, Home's card and
their counts; a problem of theirs that was open is closed through `onClose`, so its alert
resolves, and so is one of a check no mounted module declares any more. Switched back on, its
checks run again on the next tick (`test/parts.test.ts`). A check whose own id is in the set (an
optional extra switched off, such as `audit.sealed`) is treated the same way, alone.

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
| Worker CPU time per request, 95th percentile today | 10 ms | 70% | never: no job spends it |

- **`health.measure`**, every fifteen minutes, runs before `health.run`. The size is the one D1
  reports after any query. Everything else comes from one call to Cloudflare's GraphQL Analytics
  API with `KIT_OPS_TOKEN`: the account's totals since midnight UTC, which are the client's, since
  each client has its own account. One batch writes a row per budget; a budget it cannot measure
  keeps its last figure and records why (the token or the account not set, the call's error,
  never the token). A key Cloudflare cannot read or does not know (a 401, or Cloudflare's codes
  6003, 6111, 9106, 9109, 10000 or 10001, which come on a 400 as often) is named with its fix:
  make a new token with Account Analytics Read and set it as `KIT_OPS_TOKEN` (2026-11-12).
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
- **The key's steps** (2026-11-13), for an owner who only has a phone: when the last measure
  found no key, a key Cloudflare refuses or one without Account Analytics Read (`keyStateOf`),
  `GET /api/health/budgets` adds `key`: its `state` (`missing`, `refused` or `lacks`), `form`
  (Cloudflare's account-token form opened with `OPS_TOKEN_PERMISSIONS` and the client's
  `permissions` chosen, `opsTokenForm`, the URL the command-line tool's deploy prints),
  `workers` (the dashboard's Workers and Pages, `WORKERS_PAGE`) and `worker` (the name the client
  gives). System status shows them above its checks as three steps: make the key, set it in the
  Worker's Variables and Secrets, press Check again now, which measures the budgets before it runs
  the checks. Once a measure succeeds, `key` is null and the steps go.

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

Given `queue`, System status asks Cloudflare for the queue's backlog when the page opens
(`queue(env)`: how many events wait, their size, since when the oldest waits) and adds one check,
**`health.queue`**, lane `budget`: it warns when the oldest event has waited 15 minutes and fails
from an hour, since the consumer is then not taking them; a backlog that cannot be read warns.

Not measured here yet: GitHub Actions minutes, which `oltrem doctor` is to show (plan 10). Owed to
the sandbox: the `actionType` value of a KV write and the unit of the CPU quantile, taken from
Cloudflare's documentation.

## Table

Migration `0009`, `oltrem_health`: `id`, `module_id`, `lane`, `status`, `message`, `checked_at`,
`ms`, `failures`, `open_since`. One row per check, written by the job when the check's result
changes, and the row `~checked`, whose `message` holds when each check last ran and the time it
took, as JSON; `list` answers each check with those two. Nothing else writes the table.

Migration `0014`, `oltrem_budgets`: `id`, `used`, `day`, `measured_at`, `tried_at`, `problem`. One
row per budget, written by `health.measure`; nothing else writes it.

## Tests

Inside the Workers runtime against migrations 0008 and 0009: two checks run and their rows
written; a problem opened on the second failure in a row and not the first, `onOpen` called once,
closed on the next pass with `onClose`, the failure count reset by a warning; a check that throws,
one that does not answer in time and one that answers nonsense recorded as failures with the
reason; the rows listed by lane with an undeclared one left out; the tick running the checks through
the health job beside the scheduler; the job running the checks whose time has come, writing a
row only when a result changed, sleeping unless a failure waits to be confirmed, and taking twelve
checks at most a run; and the contract's refusals of a bad check, migration, setting or error. The budgets, with a stand-in for Cloudflare's API: nothing added without the
option; one call with the token and the UTC day, every figure read, only KV writes counted, the
CPU time in milliseconds and the size from D1; the check warning at 75% and failing at 95%; the
other jobs paused through the scheduler while the health jobs run, and running again after
midnight UTC; a 403 keeping the last figure with the reason; a key Cloudflare refuses on a 400
named with its fix; a missing token named once for the
budgets it leaves unmeasured; the token in no reading; the analytics errors named; and the key's
steps for a refused, narrow or missing key, the form with the recipe's permissions and the
client's, gone once Cloudflare takes the key. Workers
Paid: the month asked from the 1st, the budgets it includes, 96% failing without a pause, the
month's figures not counting once back on the free plan; a plan that cannot be read taken as
free; and the queue's backlog read live, warning at 20 minutes, failing at 90, and a backlog that
cannot be read warning.

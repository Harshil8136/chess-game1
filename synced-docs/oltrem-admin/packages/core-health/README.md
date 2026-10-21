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
budget's reading, an empty list when the budgets are not measured). The tick runs the job like
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

## The free plan's budgets

```ts
const health = createHealth<Env>({
  bindings: (env) => ({ db: env.DB }),
  modules,
  // `accountId` is the client's own reader of the account setting the backup module keeps too.
  budgets: { account: (env) => accountId(env), token: (env) => env.KIT_OPS_TOKEN },
});
const scheduler = createScheduler<Env>({ bindings, modules, pause: health.pause });
```

Given `budgets`, the module adds a job, a check and a key recipe (plan 10):

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
budgets it leaves unmeasured; the token in no reading; and the analytics errors named.

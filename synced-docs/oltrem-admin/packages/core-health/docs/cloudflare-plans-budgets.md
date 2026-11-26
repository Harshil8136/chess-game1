---
title: "@oltrem/core-health: the Cloudflare plan's budgets"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-health/src/budgets.ts, health.ts]
---

# @oltrem/core-health: the Cloudflare plan's budgets

> Part of [the @oltrem/core-health README](../README.md).

## Wiring

```ts
const health = createHealth<Env>({
  bindings: (env) => ({ db: env.DB }),
  modules,
  budgets: {
    account: (env) => accountId(env), // the account setting the backup module keeps too
    token: (env) => env.KIT_OPS_TOKEN,
    plan: async (env) => (await settingsFor(env)).get<CloudflarePlan>('health.cloudflare_plan'),
    queue: (env) => env.EVENTS,
    worker: () => 'acme-portal', // named in the key's steps
    permissions: addon ? [{ key: 'dns', type: 'edit' }] : [], // beyond the recipe's two
  },
});
const scheduler = createScheduler<Env>({
  bindings, modules, pause: health.pause,
  queryBudget: async (env) => PLAN_LIMITS[await health.plan(env)].jobQueries,
});
```

## The plan and what one run may do

The setting `health.cloudflare_plan` (`PLAN_SETTING`: `free` or `paid`, default `free`, system
layer, the Owner's) is read through `plan`; unreadable counts as free. `PLAN_LIMITS` sizes the
tick's `queryBudget` and bulk mail's slices.

| One run may make | Workers Free | Workers Paid |
|---|---|---|
| D1 queries (`queries`) | 50 | 1,000 |
| of them, the tick's jobs (`jobQueries`) | 45 | 900 |
| Calls to other services (`external`) | 50 | 10,000 |
| CPU time (`cpuMs`) | 10 ms | 30 s |

## The free plan's budgets

Daily figures count since midnight UTC; R2's are the free allowance every plan includes, so they
are measured on Paid too (operations from the 1st of the month, storage the newest day's size;
deletes and aborted uploads are free). A budget that pauses stops every job but `health.run` and
`health.measure` from `FAIL_AT` (90%); nightly flows are Workflows, so the backup still runs.

| Budget | Limit | Warns from | Pauses |
|---|---|---|---|
| `d1.rows_read` | 5,000,000 | 70% | Yes |
| `d1.rows_written` | 100,000 | 70% | Yes |
| `d1.size` | 500 MB | 60% | Yes |
| `kv.writes` | 1,000 | 70% | Yes |
| `queues.operations` | 10,000 | 70% | Yes |
| `workers.requests` | 100,000 | 70% | Yes |
| `workers.cpu_p50` (typical request) | 10 ms | 70% | No |
| `workers.cpu_p95` | shown, not judged (`informs`) | Never | No |
| `workers.stopped` (status begins `exceeded`) | `STOPPED_FAIL` (10): fails from 9 | The first | No |
| `r2.storage` | 10 GB | 80% | No |
| `r2.class_a` (writes, lists, a month) | 1,000,000 | 70% | No |
| `r2.class_b` (reads, a month) | 10,000,000 | 70% | No |

**CPU is judged by what Cloudflare does with it.** A quiet portal's slowest requests are a fresh
copy's first ones (Home 56 ms cold, 8 ms warm), and Cloudflare stops only a Worker that runs over
consistently. So the median is held to 10 ms, stopped requests warn ("Cloudflare stopped 3
requests today for going over a limit (CPU time or memory)") and the 95th percentile is shown with
a note (`COLD_START_NOTE`).

| Part | What it does |
|---|---|
| `health.measure` | `MEASURE_EVERY` (15m), sleeping `MEASURE_IDLE` (1h) while no pausing budget is past `BUSY_SHARE` (25%). The size from D1; the rest in one GraphQL Analytics call with `KIT_OPS_TOKEN` (`ANALYTICS_TIMEOUT_MS`, 10 s). One batch writes a row per budget; one it cannot measure keeps its last figure and the reason, never the token. A 401 or codes 6003, 6111, 9106, 9109, 10000, 10001 name the fix: a token with Account Analytics Read |
| `health.budgets` (lane `budget`) | Fails at 90%, warns from the warning line or a missing or stale figure; a figure counts only on its UTC day. Within `NEW_PERIOD_GRACE_MS` (75 minutes) of midnight a budget measured late the day before is only noted |
| `pause` | For the scheduler, as above |
| `shed(env)` | For the public hooks (`@oltrem/core-http`): on Free, while a `SHED_BUDGETS` budget (rows read, rows written, requests) fails, it gives `SHED_DETAIL` (the public addresses rest until midnight UTC), so signed-in pages keep the rest; kept `SHED_MEMO_MS` (1 minute) per isolate; a failed read gives null |
| `budgets(env)` | Each figure, share, status, time and problem, for the page |
| `OPS_TOKEN_RECIPE` | Also declared by backup: Account, D1, Edit (backup) and Account, Account Analytics, Read (budgets) |
| The key's steps | While a measure found the key missing, refused or lacking (`keyStateOf`), `GET /budgets` adds `key`: `state`, `form` (`opsTokenForm` with `OPS_TOKEN_PERMISSIONS` and the client's `permissions`), `workers` (`WORKERS_PAGE`) and `worker`. Status shows three steps: make the key, set it, **Check again now** (which measures first) |

## Workers Paid

The month from the 1st at 00:00 UTC against what the plan includes; use beyond is billed, so these
warn from 70% and fail from 90% without pausing, except the size. A row keeps its period (`day` as
`YYYY-MM-DD` or `YYYY-MM`), so after a plan change the other plan's figures count for nothing until
the next measure. CPU time is billed monthly and not in the analytics call, so it is not measured.

| Budget | Included a month | Pauses |
|---|---|---|
| D1 rows read | 25 billion | No |
| D1 rows written | 50 million | No |
| Database size | 10 GB a database | From 90% |
| KV writes, queue operations | 1 million each | No |
| Worker requests | 10 million | No |

## The events queue

Given `queue`, Status reads the backlog live (`queue(env)`: how many, their size, the oldest's
wait) and the check `health.queue` (lane `budget`) warns at `QUEUE_WARN_MINUTES` (15) and fails at
`QUEUE_FAIL_MINUTES` (60); an unreadable backlog warns.

## Request figures

The template writes one point per request to the Analytics Engine dataset `oltrem_requests`
(`REQUESTS_DATASET`), read back kept `REQUESTS_MEMO_MS` (5 minutes) per isolate:

- `GET /api/health/requests`: the last day by hour (requests, 500s, 95th percentile) and the five
  slowest routes as declared, never an address.
- `GET /api/health/requests/key/:subject`: one API key's calls over seven days by day (how many
  refused or failed) and the latest `KEY_CALLS_LISTED` (50) one by one.

Without `budgets`, both answer empty with why. Not measured yet: GitHub Actions minutes.

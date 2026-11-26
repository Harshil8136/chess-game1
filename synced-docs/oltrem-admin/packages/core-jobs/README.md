# @oltrem/core-jobs

The one tick of a client Worker: modules declare periodic work as jobs on their manifests, and the
cron runs one tick that reads one table (`oltrem_jobs`), leases each due job, runs it and writes
what happened. One cron, one table, one writer; a module never registers a cron. Longer work is a
flow on the one Workflow.

## Declaring a job

```ts
jobs: [
  { id: 'notes.digest', every: '1h', summary: 'Send the hourly digest', run: (env) => sendDigest(env) },
  { id: 'notes.send', every: '5m', idle: '6h', summary: 'Send what waits',
    run: async (env) => ((await sendWaiting(env)) ? undefined : 'idle') },
],
```

| Field | Rule |
|---|---|
| `id` | `<module>.<name>`, stable: its row's key |
| `every` | `15m`, `6h`, `1d`; a minute at least. The tick's cron (every minute in the client template) is the floor |
| `idle` | Optional, longer than `every`: the pace after the job answers `'idle'` |
| `summary` | A few words for the jobs page |
| `run(env, ctx)` | The work; throws to fail, may answer `'idle'` |
| `check(env)` | Optional: what waits now, in one sentence, a few reads and no write (**Check for work**) |

`@oltrem/core-module` refuses a bad id, interval or summary, or an `idle` not longer than `every`,
when the module loads.

**Sleeping until there is work.** Every run writes three rows whatever it found (D1's free plan
gives 100,000 a day), so a job that mostly finds nothing declares `idle`. Whatever gives it work
wakes it, in the same batch where it can: `wakeJobs(db, ids)` or `wakeJobsStatement(db, ids)`
(`@oltrem/core-module`) make jobs due now, write nothing for one already due, and a wake while it
runs is kept. A job never wakes itself; a lost wake is found within `idle`.

## Running the tick

```ts
const scheduler = createScheduler<Env>({ bindings: (env) => ({ db: env.DB }), modules, report });
export default createWorker({ app, modules, tick: scheduler.tick });
```

| Step | What happens |
|---|---|
| Read | The rows due, through the index on `next_run_at`: nothing due reads and writes nothing. On the first tick and every `SETTLE_EVERY_SECONDS` (1 h), every row: a row made for each new job (it runs this tick), a changed interval written, the next run brought sooner if due |
| Lease | The due jobs, longest waiting first (manifest order on a tie), in one batch of conditional writes (`DEFAULT_LEASE_SECONDS`, 600); one another tick holds is `held`. A lapsed lease is taken by the next tick |
| Choose | At most `MAX_JOBS_PER_TICK` (3, `maxJobsPerTick`), so each run stays within 10 ms of CPU; at most one daily job (`SPREAD_FROM_SECONDS`, a day or more), the rest `deferred` |
| Fit the queries | An invocation may make 50 D1 queries on the free plan (a batch is one). Each job's env counts its queries (`countQueries`, kept as `last_queries`), and a job starts only while the tick's count, its last run's (`FIRST_RUN_QUERIES` 10 before its first) and the last batch stay within `queryBudget` (`DEFAULT_QUERY_BUDGET` 45; or a function of env, such as `PLAN_LIMITS[plan].jobQueries`: 45 free, 900 Paid). A job due every `EVERY_TICK_SECONDS` (300) or less always runs when due; a longer one also leaves room for those. The first job starts whatever it costs. The rest are `deferred` and go first next tick |
| Run and record | One after another; a last batch writes each outcome (`ok`, or `failed` with `ERROR_MAX` 400 characters), time, queries, counts and next run (tick time plus `every`, or `idle` after `'idle'`; a time set while it ran is kept), and gives back unused leases. Three queries of the tick's own. A failure goes to `report(error, jobId)`; the others run, and it runs again at its next time |

The client template's worker test ticks a fresh portal until every job has run (one tick per job
not due every tick, plus one), and a day of one-minute ticks keeps each five-minute job at most six
minutes apart within 45 queries.

| Hold | What it does |
|---|---|
| `pause` (Status's, `@oltrem/core-health`) | Asked once by a tick with a due job; while it gives a reason every due job but the `exempt` (System health's own) is `paused`, kept due. One that cannot be read is reported (`'pause'`) and jobs run |
| `off` (Features, `@oltrem/core-config`) | A switched-off module's due jobs wait, listed in `switchedOff`; so does a job whose own id is off (an extra such as `audit.seal`) |
| A pause by hand | `setPaused(env, id, by, until?)` makes it `stopped`, kept due; `until` ends it on the first tick past, listing it in `resumed` |

| Function | What it does |
|---|---|
| `runSoon(env, id)` | Due now: the next tick runs it |
| `runNow(env, ctx, id)` | Runs it in the request under the tick's lease and write, schedule kept; answers `ok`, `idle`, `failed`, or `busy` while leased, with time and queries |
| `list(env)` | Every row; `declared` false for a job no module declares any more (its row kept) |
| `standDown(env)` | The pause's reason while due jobs wait, or null |
| `markDay`, `dayMarks(line, at)` | The last 24 hours in the row (`last_day`, `<hour>\|<24 marks>`): went through, idle or failed (a failure wins its hour), written with each run, read oldest first, null for an hour without a run, empty after a day |

The setters write the declared rows first, so they work before the first tick; for an undeclared
job `runSoon` and `setPaused` answer false, `runNow` null. A module's `scheduled` hook still runs
after the jobs on every tick, for the rare module that needs the raw tick.

## Flows: the one Workflow

Work longer than a tick, or of many steps, is a flow on a manifest, run by the client's one
Workflow (`JOBS`):

```ts
const flows = createFlows<Env>({ modules, report });
export class KitJobs extends WorkflowEntrypoint<Env> {
  run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    return flows.run(event, step, this.env);
  }
}
```

| Start | What runs |
|---|---|
| `flows.startDue(env.JOBS, now, off?)` from the tick | A schedule due in the `DUE_WINDOW_MINUTES` (5) up to now, UTC: one instance per schedule and minute, named after both so a second tick starts none, running each flow on that cron in module order (the free plan refuses `schedules` on the binding); none when every flow is off |
| `startFlow(env.JOBS, kind, params, id?)` | That one flow with its params; given `id`, Workflows refuses a second start under it |
| Nothing matches | Reported with the schedule or kind |

Steps are named after their flow (`backup.export: claim`). A flow that throws is reported and the
others run; the instance then fails. Each step has its own retries, timeout and 10 ms of CPU; state
is kept three days. A switched-off module's flows are skipped; a flow whose own id is off
(`backup.export`) does not start on its schedule, but still runs when started by hand.

## Table and tests

| Migration | Adds to `oltrem_jobs` |
|---|---|
| `0008` | `id`, `module_id`, `every_seconds`, `next_run_at`, `lease_until`, `last_run_at`, `last_ms`, `last_outcome`, `last_error`, `runs`, `failures`, an index on `next_run_at` |
| `0021` | `paused_at`, `paused_by` |
| `0031` | `last_queries` |
| `0069` | `last_day` |
| `0094` | `paused_until` |

| File | Covers |
|---|---|
| `test/jobs.test.ts` | Rows made; due and not before; a failure reported while another runs; leases held and taken over; a changed interval; an undeclared row kept; the budgets' pause, exempt jobs, an unreadable pause; pauses by hand, `runSoon`, before the first tick; queries counted through a batch, a deferred job first next tick; `'idle'`, `wakeJobs`, a wake while running; due rows only, every row hourly; the contract's refusals; the day line; `standDown` |
| `test/parts.test.ts` | Switched-off modules and extras, for jobs and flows |
| `test/flows.test.ts` | A schedule's flows in module order with named steps, a start by hand, a failed flow reported, no match |

# @oltrem/core-jobs

The one tick of a client Worker (plan sections 4.3 and 10): every module declares its periodic
work as jobs on its manifest, and the cron handler runs one tick that reads one table, takes a
short lease on each job whose time has come, runs it and writes what happened. One cron, one
table, one writer; a module never registers a cron of its own.

## Declaring a job

```ts
export const notes = defineModule({
  id: 'notes',
  version: '1.0.0',
  jobs: [
    { id: 'notes.digest', every: '1h', summary: 'Send the hourly digest', run: (env) => sendDigest(env) },
    { id: 'notes.purge', every: '1d', summary: 'Drop notes past their keep time', run: (env) => purge(env) },
  ],
});
```

| Field | Rule |
|---|---|
| `id` | `<module>.<name>`, stable: the key of its row |
| `every` | a count and a unit, `15m`, `6h`, `1d`; a minute at least. The tick's own cron (five minutes in the client template) is the floor: a job runs on the first tick after its time |
| `summary` | a few words the jobs page shows |
| `run(env, ctx)` | the work; it throws to fail |

The contract (`@oltrem/core-module`) refuses a bad id, interval or summary when the module loads.

## Running the tick

```ts
const scheduler = createScheduler<Env>({ bindings: (env) => ({ db: env.DB }), modules, report });
export default createWorker({ app, modules, tick: scheduler.tick });
```

On each tick: one read of `oltrem_jobs`; a row is made for every declared job without one (its
first run is this tick), and a changed interval is written, the next run brought forward when the
new interval makes it sooner. Then, for each declared job whose time has passed, the longest
waiting first (in manifest order when they wait as long): the lease is taken with one conditional write (`lease_until`, ten minutes by default);
when another tick holds it the job is `held`; otherwise the job runs, and one write records the
outcome (`ok`, or `failed` with the error's first 400 characters), the time it took, the database
queries it made, the counts, and the next run at the tick's time plus the interval. A failure is reported through
`report(error, jobId)` and the other jobs still run; the job runs again at its next time, never in
a tight loop. A lease that lapses without a write (a job that died with its isolate) is taken by
the next tick.

With `pause` (System health's, from `@oltrem/core-health`), a tick that has a due job asks it once
why jobs should wait. While it gives a reason, every due job but the `exempt` ones (System
health's own, which measure and judge the budgets) is `paused`: it is not run and stays due, so it
runs on the first tick after the reason is gone. A pause that cannot be read is reported through
`report(error, 'pause')` and the jobs run, as if nothing were spent.

A job paused by hand (`setPaused(env, id, by)`, from the jobs page of `@oltrem/developer`) is
`stopped` instead: due, not run, and kept due until `setPaused(env, id, null)` resumes it, when
the next tick runs it. `runSoon(env, id)` makes a job due now, so the next tick (within five
minutes) runs it. Both write the rows of the declared jobs first, so they work before the first
tick, and answer false for a job no mounted module declares.

`list(env)` returns every row, with `declared` false for the row of a job no mounted module
declares any more; the row and its history are kept.

### The queries of one tick

Every job of a tick runs in the cron's one invocation, and an invocation may make 50 D1 queries
on the Free plan (a `batch` counts as one); past that, every query fails with `Too many API
requests by single Worker invocation`. A fresh client portal's first tick, with every job due at
once, made 99 when it was measured on 2026-10-27, `health.run` 33 of them. So the tick hands the
jobs an env whose databases count each query (`countQueries`, exported for a client's own tests;
nothing else about them changes),
keeps what each run made (`last_queries`), and starts a job only when the queries so far, its
lease and outcome writes (two) and what its last run made (ten before its first) stay within
`queryBudget`: 45 by default, the 50 less a few for the cron's other work. The first job of a tick
starts whatever it costs. A job that does not fit is `deferred`: it stays due, so it is the
longest waiting on the next tick and goes first. `queryBudget` may also be a function of the env,
asked once a tick, so it follows the client's Cloudflare plan: the client template hands in
`PLAN_LIMITS[plan].jobQueries` from `@oltrem/core-health` (45 on the free plan, 900 on Workers
Paid, of 1,000 an invocation). A function that throws is reported and the default is used.

A module may still have a `scheduled` hook, which the Worker calls on every tick after the jobs,
for the rare module that needs the raw tick. Work that should be seen, counted and tried again is
a job.

## Flows: the one Workflow

Work that takes longer than a tick, or many steps, is a flow on a module's manifest
(`@oltrem/core-module`), run by the client's one Workflow (`JOBS`, plan 9.1) instead of the
tick. The Worker exports one Workflow class, and its `run` hands every instance to the flows:

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
| The tick finds a schedule due (`flows.startDue(env.JOBS, now)`, in the five minutes up to now, UTC) | one instance per schedule and minute, named after both, so a second tick finds it and starts none; it runs every flow whose `schedule` is that cron, in module order. The free plan refuses `schedules` on a Workflow binding, so none is set there |
| `startFlow(env.JOBS, kind, params)` | the one flow with that id, with the params; it returns the instance id |
| Neither matches a mounted flow | nothing; it is reported with the schedule or the kind |

Each step a flow takes is named after it (`backup.export: claim`), so two flows on one schedule
never share a cached step. A flow that throws is reported with its id and the others still run;
the instance then fails, so the Workflow's own record shows it. Each step has its own retries,
timeout and CPU budget (ten milliseconds of CPU per step on the free plan), and the instance's
state is kept three days.

## Table

Migration `0008`, `oltrem_jobs`: `id`, `module_id`, `every_seconds`, `next_run_at`,
`lease_until`, `last_run_at`, `last_ms`, `last_outcome`, `last_error`, `runs`, `failures`, and an
index on `next_run_at`. Migration `0021` adds `paused_at` and `paused_by`, a pause by hand;
`0031` adds `last_queries`, the database queries the last run made. Tiers
(plan 4.3) come later; the budgets' pause above needs no column.

## Tests

Inside the Workers runtime against the real migration: rows made for the declared jobs; a job
run when due and not before, the outcome and the next run written; a failure recorded and reported
while the other job runs; a lease another tick holds respected and taken over once it lapses; a
changed interval written and the next run brought forward; a removed job's row kept as
undeclared; due jobs held by a pause while an exempt one runs, then run once it lifts, the pause
not asked when nothing is due; a pause that cannot be read reported once and the jobs run; a job
paused by hand stopped until it is resumed, one made due now run on the next tick, and a pause
before the first tick; the queries a run makes counted through a batch, a job that does not fit
left for the next tick where it goes first, and more jobs fitting once their queries are known;
and the contract's refusals. The client template's worker test ticks a fresh portal until every
job has run, which takes more than one tick, each run's queries recorded. With a stand-in step: a schedule running its flows in
module order with their steps named after them, a start by hand with its params, a failed flow
reported while the other runs, and an instance no flow matches.

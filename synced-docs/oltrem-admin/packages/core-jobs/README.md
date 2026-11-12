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
| `every` | a count and a unit, `15m`, `6h`, `1d`; a minute at least. The tick's own cron (every minute in the client template, since 2026-11-10) is the floor: a job runs on the first tick after its time, or soon after when the tick is full (below) |
| `idle` | optional: a slower pace, longer than `every`, for a job that mostly finds nothing to do (below) |
| `summary` | a few words the jobs page shows |
| `run(env, ctx)` | the work; it throws to fail, and may answer `'idle'` |

The contract (`@oltrem/core-module`) refuses a bad id, interval or summary when the module loads,
and an `idle` that is not longer than `every`.

### A job that sleeps until there is work

Every run costs three rows written (the lease, and the outcome with its place in the index),
whether it found work or not, and D1's free plan gives 100,000 a day. So a job that mostly finds
nothing declares `idle` and answers `'idle'` when nothing waits for it: its next run is then
`idle` away instead of `every`. Whatever gives it work wakes it, in the same write where it can:

```ts
import { wakeJobs, wakeJobsStatement } from '@oltrem/core-module';

{ id: 'notes.send', every: '5m', idle: '6h', summary: 'Send what waits', run: async (env) =>
    (await sendWaiting(env)) ? undefined : 'idle' }

// where a note is left waiting:
await db.batch([insertNote, wakeJobsStatement(db, ['notes.send'])]);
```

`wakeJobs(db, ids)` makes those jobs due now; it writes nothing for a job already due, and a wake
made while the job runs is kept, so the job runs again on the next tick. A job must not wake
itself from its own run. The slow pace is the safety net: a wake that was lost is found within
`idle`. A job that keeps answering nothing (`void`) runs at `every`, as before.


## Running the tick

```ts
const scheduler = createScheduler<Env>({ bindings: (env) => ({ db: env.DB }), modules, report });
export default createWorker({ app, modules, tick: scheduler.tick });
```

On each tick: one read of the rows of `oltrem_jobs` whose time has come, through the index on
`next_run_at`, so a tick with nothing due reads no row and writes none. On a scheduler's first
tick, and once an hour after (`SETTLE_EVERY_SECONDS`), every row is read instead: a row is made
for every declared job without one (its first run is this tick), and a changed interval is
written, the next run brought forward when the new interval makes it sooner. So a job added by a
deploy has its row on the new Worker's first tick. Then the declared jobs whose time has passed, the longest waiting
first (in manifest order when they wait as long), are leased in one batch of conditional writes
(`lease_until`, ten minutes by default); a job whose lease another tick holds is `held`. The
leased jobs run one after another, and a last batch records every outcome (`ok`, or `failed` with
the error's first 400 characters), the time each took, the database queries it made, the counts,
and the next run at the tick's time plus the interval (the `idle` one when the job answered
`'idle'`; a time set while it ran, by a wake or Run now, is kept), and gives back the lease of a
job that did not fit (below). So a tick makes three queries of its own, not two a job. A failure is reported
through `report(error, jobId)` and the other jobs still run; the job runs again at its next time,
never in a tight loop. A lease that lapses without a write (a job that died with its isolate, or a
tick that died before its last batch) is taken by the next tick.

At most one daily job (an interval of a day or more) starts a tick; the others are `deferred` and
go first on the next ticks, so the day's work is spread over a few ticks instead of landing on one.

With `pause` (System status's, from `@oltrem/core-health`), a tick that has a due job asks it once
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
keeps what each run made (`last_queries`), and starts a job only when the queries so far, what its
last run made (ten before its first) and the tick's last batch stay within `queryBudget`: 45 by
default, the 50 less a few for the cron's other work. A job due every five minutes or less
(`EVERY_TICK_SECONDS`, the portal's steady work) runs whenever it is due: a longer job starts only when it also leaves room
for the ones due every tick that are still to run. The first job of a tick starts whatever it
costs. A job that does not fit is `deferred`: it stays due, so it is the longest waiting on the
next tick and goes first. So every tick after a new portal's first starts at least one job that
had not run, and its jobs have all run within one tick per job not due every tick, plus one: the
client template's tick test holds that bound, reading the period from `EVERY_TICK_SECONDS`
(exported). A tick also runs at most `MAX_JOBS_PER_TICK`
(3) jobs, the longest waiting first, so the jobs due every five minutes spread over the one-minute
ticks instead of all landing on one: each run stays within the free plan's 10 ms of CPU (measured
2026-11-10 at 1 to 3 ms a job; the [record](../../docs/records/2026-11-10-reads-cpu-and-campaigns.md)).
`maxJobsPerTick` changes it. In the client template a day of one-minute ticks runs every five-minute job
about every five minutes, never more than six apart, each tick within 45 queries (`templates/client/test/worker.test.ts`). `queryBudget` may also be a function of the env,
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
| `startFlow(env.JOBS, kind, params, id?)` | the one flow with that id, with the params; it returns the instance id. Given `id`, the instance takes that name, so Workflows refuses a second start under it: a flow started once, however often it is asked (the backup's first copy) |
| Neither matches a mounted flow | nothing; it is reported with the schedule or the kind |

Each step a flow takes is named after it (`backup.export: claim`), so two flows on one schedule
never share a cached step. A flow that throws is reported with its id and the others still run;
the instance then fails, so the Workflow's own record shows it. Each step has its own retries,
timeout and CPU budget (ten milliseconds of CPU per step on the free plan), and the instance's
state is kept three days.

## Parts switched off

Given `off` (the parts switched off on the Modules page, `@oltrem/core-config`), a due job of a
switched-off module waits untouched, still due, listed in the tick's `switchedOff`, and runs on
the first tick after the module is back on; an instance of the Workflow skips that module's flows
(a flow's module is its id's first segment), and `startDue(workflow, at, off)` starts no instance
for a schedule whose every flow is off (`test/parts.test.ts`). A job whose own id is in the set (an
optional extra switched off, such as `audit.seal`) waits the same way while its module's other
jobs run. A flow whose own id is in the set (the nightly backup's `backup.export`) no longer
starts on its schedule, and an instance its schedule started before the switch does nothing;
started by hand (`startFlow`), it still runs.

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
a job that answers `'idle'` run at its idle pace, woken by `wakeJobs`, a wake made while it ran
kept; a tick reading only the due rows through the index, every row on the first tick and once an
hour; and the contract's refusals. The client template's worker test ticks a fresh portal until every
job has run, which takes more than one tick, each run's queries recorded. With a stand-in step: a schedule running its flows in
module order with their steps named after them, a start by hand with its params, a failed flow
reported while the other runs, and an instance no flow matches.

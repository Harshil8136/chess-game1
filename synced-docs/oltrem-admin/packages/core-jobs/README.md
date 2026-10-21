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
new interval makes it sooner. Then, for each declared job whose time has passed, in manifest
order: the lease is taken with one conditional write (`lease_until`, ten minutes by default);
when another tick holds it the job is `held`; otherwise the job runs, and one write records the
outcome (`ok`, or `failed` with the error's first 400 characters), the time it took, the counts,
and the next run at the tick's time plus the interval. A failure is reported through
`report(error, jobId)` and the other jobs still run; the job runs again at its next time, never in
a tight loop. A lease that lapses without a write (a job that died with its isolate) is taken by
the next tick.

`list(env)` returns every row, with `declared` false for the row of a job no mounted module
declares any more; the row and its history are kept.

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
| A schedule on the Workflow binding fires | every flow whose `schedule` is that cron, in module order; `flows.schedules` is the list the binding names, and none of them spends a cron trigger |
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
index on `next_run_at`. Pausing and tiers (plan 4.3) come with the jobs page.

## Tests

Inside the Workers runtime against the real migration: rows made for the declared jobs; a job
run when due and not before, the outcome and the next run written; a failure recorded and reported
while the other job runs; a lease another tick holds respected and taken over once it lapses; a
changed interval written and the next run brought forward; a removed job's row kept as
undeclared; and the contract's refusals. With a stand-in step: a schedule running its flows in
module order with their steps named after them, a start by hand with its params, a failed flow
reported while the other runs, and an instance no flow matches.

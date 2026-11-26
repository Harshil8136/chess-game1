---
title: "@oltrem/core-health: Declaring a check; Running the checks"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-health/src; split from packages/core-health/README.md]
---

# @oltrem/core-health: Declaring a check; Running the checks

> Part of [the @oltrem/core-health README](../README.md).

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
| `summary` | a few words the Status page shows |
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

`createHealth` returns the runner and the `health` module, with one job, `health.run`, every five
minutes, and two routes for Status, each checked against `health.read` (bit plane 6, a read): `GET
/api/health/checks` (every row `list` returns) and `GET /api/health/budgets` (each budget's reading
as `items`, an empty list when the budgets are not measured, with the `plan`, what one run may do on
it as `limits`, the events queue's backlog asked live as `queue`, and, while the key is why the
budgets go unmeasured, the steps to fix it as `key`), `GET /api/health/requests` , `GET
/api/health/requests/key/:subject`, and the Home card's `GET /api/health/home` (how many checks fail
or need a look). The tick runs the job like any other job, so a client gets system health by
mounting the module, with no cron of its own. Each run of the job takes the checks whose time has
come, so it fits in the tick's 45 queries (the Free plan's 50 an invocation) beside the other jobs:
a check never run, one that failed last time and waits to be confirmed, and one whose `every` has
passed since it last ran (five minutes at least, less half a run of slack); the ones to confirm
first, then the ones never run, then the longest overdue, twelve at most a run (`CHECKS_PER_RUN`),
and the job comes back five minutes later for the rest.

The job sleeps while all is well: a run that leaves no failure to confirm and no check waiting
answers `'idle'`, and the next run is half an hour away (`HEALTH_IDLE`) instead of five minutes. A
first failure brings the job back five minutes later to confirm it, so a problem opens within about
35 minutes of starting, where it was 10; a run by hand (the jobs page's Run now) checks at once. A
run used to cost a row written per check, every five minutes, whatever it found: about 1,600 rows a
day on a portal with nothing wrong. Now a check's row is written only when its status, message or
count of failures changed, and when each check last ran, with the time it took, is kept together in
one row of the same table (id `~checked`, never listed), one write a run.

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

Given `off` (the parts switched off on the Features page, `@oltrem/core-config`), a switched-off
module's checks are not run and its rows are left out of `list`, so of the page, Home's card and
their counts; a problem of theirs that was open is closed through `onClose`, so its alert
resolves, and so is one of a check no mounted module declares any more. Switched back on, its
checks run again on the next tick (`test/parts.test.ts`). A check whose own id is in the set (an
optional extra switched off, such as `audit.sealed`) is treated the same way, alone.

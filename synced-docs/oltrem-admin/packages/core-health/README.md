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

`createHealth` returns the runner and the `health` module, which declares no route yet and one
job, `health.run`, every five minutes: the tick runs it like any other job, so a client gets
system health by mounting the module, with no cron of its own. On each run, every declared check
is run in manifest order, with the time it took, and its row written: the status, the message
(its first 400 characters), when, how many failures in a row, and since when the problem is open.
The count of failures in a row resets on any pass or warning. From the second failure in a row
the problem is open: `onOpen(row, env)` is called once, when it opens, and `onClose(row, env)`
once, when the check passes again; a failure of either hook is reported through
`report(error, checkId)` and the run goes on.

`run(env, ctx)` returns the ids by status and the ids opened and closed on that run. `list(env)`
returns every row by lane then id, with `declared` false for the row of a check no mounted module
declares any more; the row is kept.

## Table

Migration `0009`, `oltrem_health`: `id`, `module_id`, `lane`, `status`, `message`, `checked_at`,
`ms`, `failures`, `open_since`. One row per check, written by the job; nothing else writes it.

## Tests

Inside the Workers runtime against migrations 0008 and 0009: two checks run and their rows
written; a problem opened on the second failure in a row and not the first, `onOpen` called once,
closed on the next pass with `onClose`, the failure count reset by a warning; a check that throws,
one that does not answer in time and one that answers nonsense recorded as failures with the
reason; the rows listed by lane with an undeclared one kept; the tick running the checks through
the health job beside the scheduler; and the contract's refusals of a bad check, migration,
setting or error.

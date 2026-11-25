# @oltrem/jobs

Scheduled jobs (the owner's request of 2026-11-25: a page to watch every scheduled job the portal
has now and any added later, as good as the Scheduled jobs page of the portal the owner holds up as the model, and well permissioned).
One section of the sidebar under Admin, **Scheduled jobs**, always on: switching a part off never
hides the jobs, it marks that part's jobs **Off**.

There is no list of jobs to keep. Every module declares its jobs on its manifest
(`jobs: [{ id, every, summary, run, idle?, check?, title? }]`, `@oltrem/core-module`), the one
scheduler (`@oltrem/core-jobs`) runs them on the minute's tick, and this module reads the same
manifests and the scheduler's table. A module mounted tomorrow, the kit's, Oltrem Mail's or a
client's own made with `oltrem new module`, shows on the page the moment it is deployed. A job's
name is its `title` when the module gives one, else its summary's first clause.

## Using it

```ts
import { createJobsModule } from '@oltrem/jobs';
import { pages as jobsPages } from '@oltrem/jobs/pages';
import { withPages } from '@oltrem/core-module';

const scheduledJobs = createJobsModule<Env>({
  bindings: (env) => ({ db: env.DB }),
  scheduler: () => scheduler, // made after the modules it reads
  modules: () => modules, // every mounted module, a switched-off part's too
  off: partsOff, // the parts and extras switched off on the Features page
});
const modules = [iam.module, /* ... */ withPages(scheduledJobs.module, jobsPages)];
const scheduler = createScheduler<Env>({ bindings: (env) => ({ db: env.DB }), modules });
```

It stands on the IAM module (sessions, the authorizer, the audit wrapper) and the scheduler's
`list`, `runSoon`, `setPaused` and `standDown`; it adds no binding, secret, variable, table or job.

## Who may do what

Two capabilities on bit plane `33`, both read at the company itself (a role held at a place below
it is not enough, because every job works for the whole company):

| Capability | Lets a person |
|---|---|
| `jobs.read` (read) | open the page and each job's page, and **Check for work** (it only reads) |
| `jobs.manage` (admin, asks for a fresh sign-in) | **Run soon**, **Pause** and **Resume**, and System status's **Check again now** |

The Owner and the Vendor hold both by their floors. Whoever holds only `jobs.read` is told once,
in words, which permission running and pausing need, rather than shown buttons that refuse.

## The pages

After the model portal's Scheduled jobs page, written in the kit's own look (one title size, words that do
not wrap, status as a dot and a word, no boxes round small facts, filters as chips with a dot of
their state's colour).

| Path | Shows |
|---|---|
| `/jobs` | a search box and the filters **All**, **Needs a look** (failed last, or held back by the free plan), **Paused** (by hand, or the part off) and **Active**, each with its count; the figures (active, needs a look, paused, the last 24 hours, the next tick with why the jobs wait); then the jobs by schedule, most frequent first, each schedule in words with its count and when its next job runs; each row the job's name (its page) and part, its status, last run ("Worked 3 min ago", "Failed 2 h ago" in red, "Looked 4 min ago"), next run ("in 4 min", or what it waits for) and the last 24 hours as one bar an hour; the Workflow's flows after them. The figures and rows refresh every minute while the page is open (`data-live`), never while a dialog is open or someone types |
| `/jobs/:id` | the job's name, its status and why, its part and schedule, then four tabs (`?tab=`): **Overview** (a paused note, next and last run with its time and queries, runs, failures and the share that went through, the last 24 hours with the key, the last failure's words, **Check for work** where it has a check); **Activity** (the hours it ran in, newest first, and the changes made to it by hand from the audit log); **Settings** (**Run soon**, **Pause** or **Resume**, each confirmed in a dialog, or the permission they need); **How it works** (what it does, its schedule, what it does with nothing to do, whether it has a check, its part, the last run's cost, its id and a link to copy) |

The status, in the order that says why a job is not working: **Off** (its part switched off),
**Paused**, **Failing** (its last run failed), **Held back** (due while a free-plan budget is past
its pause line), **Running**, **Sleeping** (a job that declares `idle` and found nothing), and
**Active**. `src/words.ts` words every cell, and the tests pin each sentence.

## The routes

Under `/api/jobs`:

| Routes | Capability | What they do |
|---|---|---|
| `GET /` | `jobs.read` | every declared job (part, name, schedule, idle pace, last run, its last 24 hours, paused or off, whether it has a check), the flows, why the jobs wait (`standDown`), the server's time and whether the person may run and pause |
| `GET /:id` | `jobs.read` | one job and the newest twenty changes made to it by hand, read from the audit log |
| `GET /:id/check` | `jobs.read` | what waits for a job that declares a check, as `waiting`; nothing is run; `KIT-E-0404` for a job with none |
| `POST /:id/run`, `/pause`, `/resume` | `jobs.manage` | made due now (the next tick, within a minute or two, runs it; refused with `KIT-E-4201` while its part is off), paused, resumed |

Each change is audited: `jobs.run`, `jobs.pause`, `jobs.resume`, the job's id as the target. A
job's Activity reads those rows (through the audit log's index on target), and the Developer
part's `developer.job-run`, `.job-pause` and `.job-resume` from before 2026-11-25, so no history
is lost and nothing new is written to show it.

## What it costs

The list is one read of the scheduler's table and the Features page's switches, the same as the
Developer page made before; a job's page adds one indexed read of the audit log. A page open with
its live rows refreshes once a minute, as the tick runs. Nothing is written by looking.

## Health

In the `jobs` lane: `jobs.runs` **warns** naming the jobs whose last run failed and the ones paused
by hand, passing by a job whose part or extra is switched off, which does not run anyway.
`developer.jobs` until 2026-11-25.

## Errors

The module owns the `4200` to `4299` block: `KIT-E-4201` the job is switched off.

## Not here yet

The model page has three things this one does not, because the kit's scheduler has none of them:
a throttle (at most once every N minutes), a pause that ends by itself, and a run that starts at
once with its log streamed to the page. Here **Run soon** makes the job due and the next tick, a
minute away, runs it within the free plan's 10 ms; its result shows on the page when the rows
refresh.

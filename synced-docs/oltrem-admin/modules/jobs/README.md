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
`list`, `runSoon`, `runNow`, `setPaused` and `standDown`; it adds no binding, secret, variable,
table or job (migration `0094` gives the scheduler's own table one column, `paused_until`).

## Who may do what

Three capabilities on bit plane `33`, all read at the company itself (a role held at a place below
it is not enough, because every job works for the whole company):

| Capability | Lets a person |
|---|---|
| `jobs.read` (read) | open every view and each job's page, and **Check for work** (it only reads) |
| `jobs.run` (operate) | **Run now**, **Run soon**, and System status's **Check again now** |
| `jobs.manage` (admin, asks for a fresh sign-in) | **Pause** (for an hour, a day, a week or until resumed) and **Resume** |

The Owner and the Vendor hold all three by their floors. Whoever lacks one is told once, in
words, which permission the missing buttons need, rather than shown buttons that refuse; a job's
**Access** tab lists the three with whether the person holds each.

## The pages

| Path | Shows |
|---|---|
| `/jobs` | the health first: "All 31 jobs are fine" or how many need a look, the next tick and the hours of work today, one bar segment a job in its state's colour, and the three counts as links. Then four views (`?view=`): **Overview** (**Needs you**: failing, held back or paused jobs, each with Run now or Resume in place; **Up next**; **Just ran**, with each run's time and queries); **All jobs** (search, the filters **All**, **Needs a look**, **Paused or off**, **Active** as chips with counts, then a section a part in that part's colour, a row a job: name and schedule, status, last run, next run, the last 24 hours; the Workflow's flows after them); **Timeline** (every job's last 24 hours as one grid, a cell an hour); **History** (the newest 50 changes by hand to any job). The health and the views refresh every minute while the page is open (`data-live`), never while a dialog is open or someone types |
| `/jobs/:id` | the job's name, status and why, part and schedule, then its actions (**Run now**, **Check for work**, **Pause** or **Resume**, each confirmed in a dialog) and five tabs (`?tab=`): **Overview** (next and last run, the last run's cost, runs and the share that went through, the last 24 hours, the last failure's words); **Runs** (its changes by hand and the hours it ran in); **Schedule** (the schedule, the next five runs, what it does with nothing to do, the pause, and **Run soon** for the next tick); **Access** (the three permissions and whether the person holds each); **About** (what it does, its part, its id and a link to copy) |

The status, in the order that says why a job is not working: **Off** (its part switched off),
**Paused** (and when it resumes by itself), **Failing** (its last run failed), **Held back** (due
while a free-plan budget is past its pause line), **Running**, **Sleeping** (a job that declares
`idle` and found nothing), and **Active**. `src/words.ts` words every cell, and the tests pin each
sentence.

## The routes

Under `/api/jobs`:

| Routes | Capability | What they do |
|---|---|---|
| `GET /` | `jobs.read` | every declared job (part, name, schedule, idle pace, last run, its last 24 hours, paused and until when, or off, whether it has a check), the flows, why the jobs wait (`standDown`), the server's time and whether the person may run and pause |
| `GET /history` | `jobs.read` | the newest 50 changes by hand to any job, read from the audit log |
| `GET /:id` | `jobs.read` | one job and the newest twenty changes made to it by hand |
| `GET /:id/check` | `jobs.read` | what waits for a job that declares a check, as `waiting`; nothing is run; `KIT-E-0404` for a job with none |
| `POST /:id/run-now` | `jobs.run` | runs the job now, inside the request, under the tick's own lease (`busy` while a tick holds it), keeping its schedule; answers the outcome, its time and its queries |
| `POST /:id/run` | `jobs.run` | made due now: the next tick, within a minute or two, runs it |
| `POST /:id/pause`, `/resume` | `jobs.manage` | paused (`for`: `1h`, `1d` or `7d`, else until resumed; the first tick after the end resumes it), resumed |

A run or a run soon is refused with `KIT-E-4201` while its part is off. Each change is audited:
`jobs.run-now` (with its outcome, time and queries), `jobs.run`, `jobs.pause`, `jobs.resume`, the
job's id as the target. A job's Runs tab and the History view read those rows through the audit
log's indexes, and the Developer part's `developer.job-run`, `.job-pause` and `.job-resume` from
before 2026-11-25, so no history is lost and nothing new is written to show it.

## What it costs

The list is one read of the scheduler's table and the Features page's switches, the same as the
Developer page made before; a job's page adds one indexed read of the audit log. A page open with
its live rows refreshes once a minute, as the tick runs; History is one more indexed read. Nothing is written by looking.

## Health

In the `jobs` lane: `jobs.runs` **warns** naming the jobs whose last run failed and the ones paused
by hand, passing by a job whose part or extra is switched off, which does not run anyway.
`developer.jobs` until 2026-11-25.

## Errors

The module owns the `4200` to `4299` block: `KIT-E-4201` the job is switched off.

## Not here yet

The model page has a throttle (at most once every N minutes) and a run whose log streams to the
page; the kit's scheduler has neither. **Run now** answers once the run ends, within the free
plan's CPU, with what it did, how long it took and how many queries it made.

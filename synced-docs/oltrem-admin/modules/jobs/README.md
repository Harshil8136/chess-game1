# @oltrem/jobs

Scheduled jobs, under Admin in the sidebar, always on: a switched-off part's jobs show as **Off**.
There is no list to keep: modules declare jobs on their manifests (`jobs: [{ id, every, summary,
run, idle?, check?, title? }]`), `@oltrem/core-jobs` runs them on the tick, and this module reads
the same manifests and the scheduler's table, so a new module's jobs show the moment it deploys. A
job's name is its `title`, else its summary's first clause.

## Using it

```ts
const scheduledJobs = createJobsModule<Env>({
  bindings: (env) => ({ db: env.DB }),
  scheduler: () => scheduler, // made after the modules it reads
  modules: () => modules, // every mounted module, a switched-off part's too
  off: partsOff, // the Features page's switches
});
const modules = [iam.module, /* ... */ withPages(scheduledJobs.module, jobsPages)];
const scheduler = createScheduler<Env>({ bindings: (env) => ({ db: env.DB }), modules });
```

It stands on IAM and the scheduler's `list`, `runSoon`, `runNow`, `setPaused` and `standDown`, and
adds no binding, secret, variable, table or job (migration `0094` adds `paused_until` to the
scheduler's table).

Three capabilities on bit plane 33, read at the company: `jobs.read` (every view, **Check for
work**), `jobs.run` (**Run now**, **Run soon**, Status's **Check again now**) and `jobs.manage`
(admin, fresh sign-in: **Pause** for an hour, a day, a week or until resumed, **Resume**). Owner and
Vendor hold all three by their floors. Missing buttons are explained once, in words; a job's
**Access** tab lists the three.

## The pages

| Path | Shows |
|---|---|
| `/jobs` | Tiles: **Jobs** (active, paused or off, needing a look), **Last 24 hours** (worked, idle, failed), **Next tick** (counting down, `data-count-to`), **Plan allowance** (Normal or Holding back with why). Views (`?view=`): **Overview** (Needs you with Run now or Resume in place, Up next, Just ran with time and queries), **All jobs** (search; chips All, Needs a look, Paused or off, Active; a pane per part in its colour, each row with schedule, last and next run and a 24-hour strip; then the Workflow's flows), **Timeline** (an hour a cell), **History** (the newest `HISTORY_ROWS` 50 changes by hand). Managers get **Pause all** and **Resume all (N)**, asked in a dialog with an optional Why. A row opens the job in a side panel (whole screen on a phone; K and J or arrows for next and previous; **Open as a page**). Refreshes every minute (`data-live`), never while a dialog is open or someone types |
| `/jobs/:id` | A card in its part's colour: status, part, schedule, why, **Run now**, **Check for work**, **Pause** or **Resume** (confirmed; Run now and Pause ask an optional Why, shown as "Why:"). Tabs (`?tab=`): **Overview** (next run counting down within the hour, last run and cost, runs, share through, last 24 hours, last failure, coming up, what it does), **Runs** (changes by hand and hours it ran), **Schedule** (next five runs, what it does idle, the pause, **Run soon**), **Access**, **About** (part, id, copy link) |

Statuses, in order: **Off** (part off), **Paused** (and when it resumes), **Failing**, **Held back**
(due while a free-plan budget is past its pause line), **Running**, **Sleeping** (idle), **Active**.
`src/words.ts` words every cell, and the tests pin each sentence.

## The routes

Under `/api/jobs`:

| Route | Needs | What it does |
|---|---|---|
| `GET /` | `jobs.read` | Every job (part, name, schedule, idle pace, last run, 24 hours, paused until or off, has a check), the flows, `standDown`, the server's time, whether the person may run and pause |
| `GET /history` | `jobs.read` | The newest 50 changes by hand, from the audit log |
| `GET /:id` | `jobs.read` | One job and its newest `ACTIVITY_ROWS` (20) changes |
| `GET /:id/check` | `jobs.read` | What waits, as `waiting`, running nothing; `KIT-E-0404` without a check |
| `POST /:id/run-now` | `jobs.run` | Runs it in the request under the tick's lease (`busy` while held), schedule kept; answers outcome, time, queries |
| `POST /:id/run` | `jobs.run` | Due now: the next tick runs it |
| `POST /:id/pause`, `/resume` | `jobs.manage` | `for` `1h`, `1d` or `7d`, else until resumed (the first tick past the end resumes it) |
| `POST /pause-all`, `/resume-all` | `jobs.manage` | Every running job paused (`paused`), or every paused one resumed (`resumed`), each audited alone |

Each takes an optional `note` (`NOTE_LENGTH` 200, longer refused) kept in the audit row. A run is
refused with `KIT-E-4201` (block `4200`–`4299`) while its part is off. Audited: `jobs.run-now` (with
outcome, time, queries), `jobs.run`, `jobs.pause`, `jobs.resume`, the job's id as target; history
also reads the older `developer.job-run`, `.job-pause`, `.job-resume` rows.

**Cost.** The list is one read of the scheduler's table and the switches; a job's page and History
add one indexed audit read each; nothing is written by looking. **Health**: `jobs.runs` (lane
`jobs`) warns for jobs whose last run failed and jobs paused by hand, skipping switched-off ones.

Not built: a throttle and a run whose log streams to the page; **Run now** answers once the run
ends, within the free plan's CPU.

## Tests

| File | Covers |
|---|---|
| `test/jobs.test.ts` | The manifest; capabilities at the company; every job listed by part; a failed run, run soon, pause and resume read back as activity; run now and its permission; a timed pause ending; notes, pause all and resume all; a switched-off part; check for work; the status order, last and next run, schedules in words |
| `test/pages.test.ts` | Overview tiles and Needs you; all jobs by part with filter and search; timeline and history; a reader told once; a job's actions and five tabs; its forms; the Why notes |

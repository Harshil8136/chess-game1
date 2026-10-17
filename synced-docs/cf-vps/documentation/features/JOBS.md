---
title: "Server Jobs"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-16
verified_against: [code]
owner: harshil
related_code: [contract/jobs.ts, contract/actions.ts, contract/capabilities.ts, agent/src/jobs, agent/src/cli/jobs.ts, host/65-actions, host/66-jobs, src/ui/screens/Jobs.tsx, src/ui/components/jobs.tsx, src/ui/jobs.ts, scripts/setup/job-secret.mjs, agent/src/jobs/stage.ts]
related_docs: [RESTORE-TESTS.md, ACTIONS.md, CONSOLE.md, ../security/PERMISSIONS.md, ../security/AUDIT-PIPELINE.md, ../operations/HOST-MODULES.md, ../reference/HOST-LAYOUT.md]
tags: [feature, jobs, queue, containers, podman, systemd]
---

# Server Jobs

> **TL;DR (non-technical):** A job is a small piece of work the server does on its own — for
> example the hourly check that the public site's booking and consent pipeline is healthy. Each
> job runs in its own container, which starts, does the work, writes down what it found and
> disappears. Before a job starts it looks at how busy the server is: if the server has been
> busy for the last ten seconds the job waits its turn in line, so a job can never slow the
> website down. The Jobs page in the console shows whether every job is healthy, what is waiting
> and why, and the result of every run. People given the permission can run, stop, restart,
> pause, resume and block each job from there or from the Apps page, and change its limits and
> schedule; everyone else who can open the page only looks.

## Scope

This covers run-to-completion work: it starts, finishes and leaves nothing behind. Long-running
services are **apps** (`vps app`, [CONSOLE](CONSOLE.md)), which keep running and have their own
address; they are not jobs. Both share the same server, and the gate below exists so they never
fight over it.

The first job is `astro_heartbeat`, the public site's hourly heartbeat, moved here from GitHub
Actions on 2026-10-07 (change record `documentation/records/2026-10-07-jobs-and-the-heartbeat.md`,
private). The second is `restore_test`, the first `heavy` job and the first that takes input: a
backup copy staged from the console, unlocked, rebuilt and checked
([RESTORE-TESTS](RESTORE-TESTS.md)). The third is `selftest`, the platform's own daily check
(below). The controls and the rebuilt page came on 2026-10-08 (change record
`documentation/records/2026-10-08-job-controls.md`, private).

## The busy gate: the rule every job follows

The owner's rule of 2026-10-07: **when the server is busy for more than ten seconds, the job
queues and goes next in line; never overload the server.** It is one function,
`gateDecision` in `contract/jobs.ts`, and every job passes through it. A job waits while any
of these is true:

| Reading | Waits when | Why this measure |
|---|---|---|
| Processor | above `cpu_pct` (60%) in **every** one-second sample of the last `window_seconds` (10) | A spike is not a busy server; ten seconds of sustained load is |
| Disk | tasks stalled on the disk more than `io_pressure_pct` (60%) of the last 10 s (`/proc/pressure/io`, `some avg10`) | Processor use says nothing about a disk that is saturated |
| Memory pressure | tasks waited for memory more than `mem_pressure_pct` (10%) of the last 10 s (`/proc/pressure/memory`) | Pressure appears before memory runs out |
| Memory headroom | what is in use **plus the run's own memory limit** would pass `mem_ceiling_pct` (75%) of the total | What is free now is not what will be free once the job runs |
| Jobs running | `max_parallel` (2) already run, of any job | One rule for the whole server, not per job |
| Heavy jobs | the job is `heavy` and another `heavy` one runs | A restore test or a big build runs alone |
| Its place in line | another run is ahead of it | Light jobs first, then oldest first (`entryKey`) |

It **fails safe**: a reading it cannot take, or a window it has not finished measuring, means
wait. A job never starts on a guess. The processor's very first reading has nothing earlier to
compare with, so it only primes the counter: the window is the ten readings after it.

The numbers live in `/etc/vps/jobs.conf` (installed by `host/66-jobs`). An unknown key, a bad
number, or one outside the limits in `CONF_LIMITS` is ignored, the default is kept, and the
Jobs page shows the problem — a typo can never loosen the gate.

A job that has waited longer than its own `max_wait` is marked **missed** rather than run late,
and that raises an alert.

## What a job is

A root-owned manifest, `/etc/vps/jobs/<name>.toml` (`parseJobManifest`):

| Key | Meaning |
|---|---|
| `name` | Lower-case letters, digits and `_` (no `-`: systemd escapes it in a unit instance). Must match the file name |
| `description` | One line, shown on the Jobs page |
| `image` | Built on the server (`localhost/…`) or pulled from a named registry, always with a tag or digest |
| `class` | `light` (default, first in line) or `heavy` (one at a time) |
| `memory` | 16M to 3G. The container's hard limit, and what the gate counts before starting it |
| `cpus` | Cores, default `0.5`, at most 4 |
| `timeout` | 10s to 4h. The container is stopped and the run failed after it |
| `max_wait` | 30s to 4h. Marked missed after waiting this long in line |
| `retry`, `retry_delay` | 0 to 2 extra attempts, 10s to 1h apart |
| `network` | Whether the container may reach the internet. `false` by default |
| `input` | `true`: the job runs only with input staged for it from its own console page, never by Run now or a timer (see [Jobs with input](#jobs-with-input)). `false` by default |
| `workspace` | A memory-only folder at `/work` of this size, counted inside `memory`, which must leave 512M beside it. None by default |
| `memory_max`, `cpus_max`, `workspace_max`, `timeout_max`, `max_wait_max` | Ceilings a single run may ask for instead of the values above; a resource without one is fixed. Each is at least its base value; `memory_max` at most 3G, the times at most 4h |
| `quiet_after` | Optional, 10m to 7d. A scheduled job with no success for this long alerts once (`job_quiet`) |

The bounds for memory, processor, time and wait limits and retries live in `contract/jobs.ts`
(`limitProblems`), so the console, the Worker, the root CLI and this manifest check them alike.

The limits bound a single run to 26 hours at the very worst, under the unit's 27-hour backstop.

**Secrets are never in the manifest.** Each one is a systemd credential named
`job-<name>.<ENV_NAME>`, encrypted with the server's own host key in
`/etc/credstore.encrypted`, stored by `node scripts/setup/job-secret.mjs <job> <NAME>` (typed
at a prompt, never echoed, never on a command line). `vps-job@<name>.service` imports
`job-<name>.*` for the run, and the runner passes each one to the container by name
(`--env=NAME`), so no value ever appears in a command line, a log or a run record. The one
exception to `job-secret.mjs` is `restore_test`'s lab key, which `scripts/setup/lab-key.mjs`
makes on the server so that no person ever sees it ([RESTORE-TESTS](RESTORE-TESTS.md#the-lab-key)).

## How a run works

1. **Something starts the unit.** `vps-job-<name>.timer` on its schedule, or a person's
   **Run now** (the `job.run` action, [ACTIONS](ACTIONS.md)), or a start with staged input
   (`restore.start`), or an operator on the server.
   The run records which (`trigger`): `console` when Run now left its mark, `timer` when the
   timer fired in the last two minutes (`LastTriggerUSec`), and `server` otherwise (an operator,
   or `66-jobs test`). A timer start of a paused job ends at once with one `SKIPPED (paused)`
   line and no run.
   systemd runs one `vps-job@<name>.service` at a time, so a start while that job already
   waits or runs merges into the run in flight.
2. **The runner takes its place in line.** `agent/src/jobs/run.ts`, as root: it writes the run's
   folder and a queue entry under `/var/lib/vps/jobs/queue`, changed only under a `mkdir` lock.
   An entry whose process is gone is dropped, so a crash cannot block the line.
3. **It waits on the gate**, sampling the server once a second and writing the reason it waits
   (which the Jobs page reads) whenever that reason changes.
4. **The container runs** inside the unit's own cgroup (`podman --cgroups=split`, `Delegate=yes`),
   so stopping the unit stops the container and its usage counts against `vps-jobs.slice`. It
   gets the app platform's hardening: its own user namespace (`--userns=auto`), a read-only
   root, no capabilities, `no-new-privileges`, a process limit, its memory and processor caps
   (memory and swap equal, so it never swaps), no network unless the manifest asks for one, and
   one writable folder — the run's own `out/` — plus, for a job with input, its stage at `/in`
   (read-only) and its memory-only `/work`.
5. **The job reports on itself.** It writes `/out/result.json`:
   `{ ok, summary, steps: [{ name, ok, detail }] }`. A run counts as succeeded only when the
   container exits 0 **and** the report says `ok` with at least one step, every step passed
   (`parseReport`). A job that exits 0 having checked nothing is a failure, not a pass.
6. **The result is kept and alerted.** The run's folder holds `record.json` (with the limits
   and image it ran with and the names, never the values, of the secrets it was given),
   `output.log` (up to 5 MiB) and `out/`; the day's `runs.jsonl` gets one line for the run, so
   the history never opens every record. Day folders older than `retention_days` (30) are
   deleted when that job next finishes a run.

A run ends `succeeded`, `failed`, `missed`, or `cancelled` when a person stopped it from the
console (Stop, Restart, Block, or Cancel test for a job with input): `vps job` (or
`vps-act-jobstop`, for Cancel test) leaves `/run/vps-jobs/cancel-<name>` before it stops the
unit, and the runner, stopped, finds the mark. A cancelled run is recorded and never
alerted, and never retried. A stop nobody asked for (a reboot, the unit killed) stays `failed`
and alerts. `vps job` removes its mark as soon as the stop is over (systemctl waits for it), so
a mark can only apply to the run it stopped; a runner that finds a mark older than two minutes
as it starts (left by a crash in between) removes it, and leaves a fresh one for a Stop pressed
while that very run was starting.

A job may also print `@@step {"name":…,"status":…,"detail":…,"seconds":…}` lines while it
runs. The runner keeps the latest state of each step (at most 60) in the run's `progress.json`,
which the `jobs/progress` route serves, so a long job shows its steps live. If the job writes
`/out/report.json` (valid JSON, at most 256 KiB), the runner keeps a copy beside the record for
the `jobs/report` route; the job's own `result.json` still decides whether the run passed.

## Jobs with input

A job whose manifest says `input = true` runs on files a person stages for it. Today that is
only `restore_test` ([RESTORE-TESTS](RESTORE-TESTS.md)).

1. **Staging.** The console uploads the files through the agent's `restore/stage` route, in
   chunks, into `/var/lib/vps/jobs-stage/<job>/<stage>/`, where `<stage>` is 16 random hex
   characters (`STAGE_ID`). The folder is the agent's own state folder (mode 0700). A stage
   holds at most 512 MiB, must leave 2 GiB free, and is deleted two hours after its last change
   if no run took it (`agent/src/jobs/stage.ts`).
2. **Start.** The start action names `<job>:<stage>`. `vps-act-job` refuses a job with input
   started bare, a job without input started with a stage, a stage that is not there or has no
   `request.json`, a blocked job, and a second start while that job waits or runs. It writes the
   stage id into the run's console mark, which the runner reads.
3. **The runner takes the stage.** It moves the folder into the run's `in/` (outside every
   folder the agent can write) and reads `request.json`'s `resources`. `resolveRunResources`
   (`contract/jobs.ts`) checks them against the manifest's ceilings and floors (memory at least
   1024 MiB, work space at most the memory less 512 MiB); a refusal fails the run before it
   waits. The run then waits on the gate with **its own** memory counted, and runs with its own
   memory, processor, work space, time limit and wait limit.
4. **What it may print.** A line shaped like an email address or an international phone number
   is not kept in `output.log`; a marker replaces it and `record.withheldLines` counts it
   (`PERSONAL_SHAPE`).
5. **Cleanup, proven.** When the run ends, whatever happened, the runner deletes `in/`, then
   checks that `in/` is gone and that the container no longer exists, and records `cleanedUp`.
   If either check fails the run fails with `CLEANUP FAILED`, which alerts.

A run that waits or runs, of any job, can be stopped with the Jobs page's Stop (`job.stop`). A
job with input can also be cancelled from its own page (`restore.cancel`, which runs
`vps-act-jobstop`); that script refuses a job without input. Either way the run ends
`cancelled` and the cleanup above still runs and is still proven: a cleanup that fails turns
the run into a failed one, which alerts.

## Where a run is kept

```text
/var/lib/vps/jobs/queue/<key>.json                      waiting, running or between attempts
/var/lib/vps/jobs/runs/<job>/<YYYY-MM-DD>/<run>/record.json   the run (RunRecord)
                                                        /output.log    everything it printed
                                                        /out/          its only writable folder
                                                        /progress.json its live steps
                                                        /report.json   its report for the consoles
                                                        /in/           a job with input: its stage, deleted at the end
/var/lib/vps/jobs-stage/<job>/<stage>/                  input staged by the console, not yet started
/var/lib/vps/jobs/runs/<job>/<YYYY-MM-DD>/runs.jsonl    one line per finished run (RunSummary)
/var/lib/vps/jobs/control/<job>.json                    { paused, since }: a person paused it
/etc/vps/jobs/overrides/<job>.toml                      limits set from the console
/etc/systemd/system/vps-job-<job>.timer.d/50-console.conf   a schedule set from the console
```

A run id is its UTC start plus six random characters (`20261007T220700Z-a1b2c3`): sortable, and
safe as a folder name. `/var/lib/vps/jobs` is `root:vps-agent`, mode 2750, so the console's
agent can read every run and change none of it.

## Controls

Every control is an action ([ACTIONS](ACTIONS.md)): the same checks in each layer, the same
signed ticket, and on the server `vps job <verb>` as root, which checks the job, its state and
the bounds again. Run now has its own unit (`vps-act-job@`), and so does Cancel test
(`vps-act-jobstop@`); the others share `vps-act-jobctl@<verb>:<target>`, one at a time under one
lock.

| Control | Shown when | Needs | What happens on the server | Journal line |
|---|---|---|---|---|
| Run now | nothing waits or runs, and the job is not blocked and takes no input | `jobs.run` | the job's unit starts; the run waits its turn | `QUEUED … (console)` |
| Stop | a run waits or runs (also for a job with input) | `jobs.run` | the cancel mark, then the unit stops (10 s for the container) | `CANCELLED …` |
| Restart | a run waits or runs, and the job takes no input | `jobs.run` | Stop, then Run now | `CANCELLED …`, `QUEUED …` |
| Pause | it has a schedule | `jobs.run` | the control file says paused; the timer is disabled and stopped | `PAUSED …` |
| Resume | paused | `jobs.run` | the control file goes; the timer is enabled and started (not while blocked) | `RESUMED …` |
| Block | not blocked | `jobs.manage`, typed name | the cancel mark, `systemctl mask --now` on the run unit, the timer off | `BLOCKED …` |
| Unblock | blocked | `jobs.manage` | unmask; the timer starts again unless paused | `UNBLOCKED …` |
| Change limits | it has a manifest that parses | `jobs.manage` | the override is written after the merged manifest is checked; used from the next run; Reset removes it | `LIMITS …` |
| Change schedule | it has a schedule | `jobs.manage` | `systemd-analyze calendar` checks the pattern, the drop-in is written, the timer restarts; Reset goes back to the repository's | `SCHEDULE …` |

The run and schedule controls are on the job's card; Block and Unblock are in its Inspect sheet,
with the two forms, which only someone holding `jobs.manage` sees. A button the person lacks the
capability for is shown locked, with the capability it needs.

**Pause is the schedule only** (like Kubernetes' `suspend`): a run in flight finishes and Run
now still works. **Block is everything**: no timer, Run now, re-install or reboot starts the
job. Neither is undone by applying `66-jobs` again: `enable` skips a paused or blocked job, and
`install` never writes into `overrides/` or `control/`.

**Changes from the console never edit the repository's manifest.** The limits sit in an
override beside it and the schedule in a timer drop-in, so a re-install cannot lose them
silently, and Reset returns to the repository's values. An override that stops fitting (the
repository lowered a bound, say) is ignored and named on the job's card, and the job runs on
the repository's values. Schedules are only these patterns, never free text, and never more
often than every 5 minutes: every 5, 10, 15, 20 or 30 minutes; hourly at a minute; every 2, 3,
4, 6, 8 or 12 hours at a minute; daily or weekly at a time (UTC).

A job's standing, as the console shows it: **scheduled** (its timer runs), **Run now only** (no
timer), **paused**, **blocked**, or **schedule off** (it has a timer that is not running and
nobody paused or blocked it; `66-jobs enable`, or Pause then Resume, switches it on).

## Who may see, run and change jobs

What a person may do is their list of capabilities ([PERMISSIONS](../security/PERMISSIONS.md)).
These are the code's defaults; the owner can change a role's list or one person's.

| To | Capability | Held by default |
|---|---|---|
| Open the Jobs page: every job, the line, the live busy rule, the history, a run's steps, live progress and report | `host.view` | Owner, Vendor support, Admin |
| Read a run's output | `logs.view` | Owner, Vendor support, Admin |
| Run now, Stop, Restart, Pause, Resume | `jobs.run` | Owner, Vendor support |
| Block, Unblock, Change limits, Change schedule | `jobs.manage` | Owner, Vendor support |

- **Not floors.** Neither `jobs.run` nor `jobs.manage` is kept for the Owner and Vendor support
  alone, so either can be granted to one person, asked for in cf-admin for a while (it then ends
  by itself), or handed on by someone who holds it to people below them on the role ladder.
- **Confirmations.** Block asks for the job's name, typed. No job control asks for a recent
  sign-in.
- **A power taken away stops at once.** Every control reads the stored access policy itself
  instead of the Worker's 30-second copy, so the next press after a capability is removed is
  refused. Reading the page stops within 30 seconds.
- **In front of the console.** cf-admin's gateway opens it only for someone whose page access
  allows the Server page and who has accepted the server access notice in this sign-in; it
  refuses every change from a read-only account (Viewer), and refuses any change made before
  the notice is accepted.
- **Behind it.** The Worker refuses a missing capability before it signs anything, the agent
  checks again from what the Worker signed, and the root unit runs only with the Worker's
  one-time ticket for that exact unit ([ACTIONS](ACTIONS.md#enforcement-chain)).

The restore test has its own floor capability, `restore.test`, for staging, starting and
cancelling a test; see [RESTORE-TESTS](RESTORE-TESTS.md#who-may-run-one).

## In the console

The **Jobs** page (`host.view`, `src/ui/screens/Jobs.tsx`) is built for a phone, top to bottom:

1. One line: every job healthy, or which job is failing or needs a look; chips for the jobs by
   standing, the last 24 hours, the next run and the line.
2. **Running and waiting now** (only while something is): the live reason a run waits, or its
   time against its limit, with Stop.
3. A card per job (`src/ui/components/jobs.tsx`, the same card the Apps page shows): its
   standing, its schedule in words and the next run, the last run, a strip of its latest 24
   results, its limits, its last success, and the controls its state allows. Inspect opens
   everything about it. A job with input has no Run now: its card links to its own page
   (**Restore tests** for `restore_test`).
4. **History**: every finished run of today, the last 7 or the last 30 days (`jobs/history`),
   filtered by result, job and what started it, with each job's success rate, typical and
   slowest run, longest wait and a timeline.
5. **Could a job start now?** The busy rule read live from the agent's own one-second readings
   (`gate` in the `jobs` answer): the last five minutes of processor use against the mark,
   memory against the ceiling, disk and memory pressure, and the slots in use. It is a preview;
   each run still measures for itself.

**Run now** is the `job.run` action: it starts the run and returns at once. The run still waits
its turn, and the page says so.

Opening a run shows how long it waited and ran, what started it, its attempt and exit code, the
image and limits it ran with, the secrets it was given (names), its steps, and with `logs.view`
its output: searchable, copyable, downloadable, and followed live while the run goes. Links:
`?job=<name>` filters the history and `?run=<job>/<run>` opens a run.

The **Apps** page shows the same job cards under the apps, and alone under its **Jobs** filter.
Its status line ends with whether a job could start now, and its About sheet notes that
starting, resuming or deploying an app while the server is busy adds to the load.

On a server whose agent is older than the job runner, the agent answers the page with a 404.
The page then says, in one card, that the server has not been updated for jobs yet and what
installs it, instead of three "Data Unavailable" boxes, and keeps checking so it loads by itself
once the agent is updated (`agentLacksJobs`, `src/ui/jobs.ts`).

A run started from the console is recorded as `trigger: console`; who started it is in
cf-admin's activity log (verb `vps_job_run`) and in the journal, never in the run record. The
other controls reach the activity log as `vps_job_control` (Stop, Restart, Pause, Resume) and
`vps_job_manage` (Block, Unblock, limits, schedule).

## Alerts

The runner's journal lines carry `SyslogIdentifier=vps-jobrun`; the quiet check's come from the
agent (`vps-agent`). Vector classes them as `probe` (the same evidence class as the site probes)
and raises three alerts ([AUDIT-PIPELINE](../security/AUDIT-PIPELINE.md)):

| Line | Alert | Sentry level |
|---|---|---|
| `job <name> FAILED run <id>: …` | `job_failed`, keyed `job:<name>` | error |
| `job <name> MISSED run <id>: …` | `job_missed`, keyed `job:<name>` | warning |
| `job <name> QUIET: …` (from the agent) | `job_quiet`, keyed `job:<name>` | warning |

A failed attempt that will be retried logs `RETRY`, not `FAILED`: only the end of a run alerts.
`QUEUED`, `WAITING`, `STARTED`, `SUCCEEDED`, `CANCELLED`, `SKIPPED` and the controls' lines
(`PAUSED`, `RESUMED`, `BLOCKED`, `UNBLOCKED`, `LIMITS`, `SCHEDULE`) are recorded and never alert.

**Quiet jobs.** Every 5 minutes the agent looks at each scheduled job: one whose schedule is
off though nobody paused or blocked it, or (with `quiet_after`) whose last success, or the time
its schedule was switched on, is older than that, gets one `QUIET` line when it turns quiet,
and one "no longer quiet" line when it recovers. A paused, blocked or Run-now-only job is never
quiet.

## The first job: `astro_heartbeat`

Hourly, at seven past (with a random delay of up to two minutes), `light`, 128M, 0.25 cores,
5-minute timeout, 20-minute wait limit, one retry after 5 minutes, network on. It asks the
public site for its heartbeat (`GET /api/health/?probe=heartbeat&runner=vps`, which runs the
live consent probe, both audit queries and the pass/fail rules inside cf-astro's Worker), then
drains the consent and booking replay outboxes, and checks every answer. Both drains run even
when the check fails: a stranded record is when they matter most. It needs one secret,
`HEALTH_CHECK_SECRET`.

It has `quiet_after = "3h"`: three hours without a success alerts once, on top of each failed
run's own alert.

Independence comes from having several runners rather than several credentials in one runner:
this job is the primary, and cf-admin's `heartbeat-watchdog` job runs the same check whenever
nobody has for 70 minutes. cf-astro's GitHub workflow runs only by hand since 2026-10-10:
Cloudflare's bot protection challenges GitHub's runners, so its scheduled runs failed without
reaching the site, and a hand run meets the same challenge. To run the heartbeat now, use
**Run now** on the Jobs page. Each runner reports its own failures, so the same hour is never
alerted twice.

## The self-test: `selftest`

Daily at 04:30 UTC (up to 5 minutes later), `light`, 32M, 0.1 cores, no network and no
secret. It works for 20 seconds, long enough to press Stop, then reports one step; a stop ends
it at once (its script traps the signal). Its daily run proves the runner works end to end,
and `quiet_after = "50h"` alerts if two days pass without it. `66-jobs test` and the phone test
use it to prove every control without stopping or blocking a real job.

## Adding a job

1. Write the manifest in `host/66-jobs/files/etc/vps/jobs/<name>.toml` and, for an image built
   here, `host/66-jobs/files/opt/vps/jobs/<name>/Containerfile` beside the script it runs.
2. Give it a timer, `host/66-jobs/files/etc/systemd/system/vps-job-<name>.timer`, with
   `Unit=vps-job@<name>.service`. A job with no timer runs only on **Run now**.
3. Make the job report on itself: write `/out/result.json` with a step per thing it checked, and
   exit non-zero when any of them failed.
4. Apply it: `bash host/push.sh`, then `install`, `image`, each job's secrets, then `enable`
   ([HOST-MODULES](../operations/HOST-MODULES.md), [DEPLOY](../operations/DEPLOY.md)).
5. `test/host-units.test.ts` then checks the manifest parses and that an image built here has
   its Containerfile; no code change is needed for a new job.

## Key code paths

- the gate, the settings and the run record -> `contract/jobs.ts` (`gateDecision`, `parseJobsConf`)
- limits, schedules, stats and a run's resources -> `contract/jobs.ts` (`parseJobLimits`, `scheduleToCalendar`, `describeSchedule`, `jobStats`, `resolveRunResources`)
- the quiet rule -> `contract/jobs.ts` (`quietReason`); the check every 5 minutes -> `agent/src/main.ts`
- the manifest and the console's limits over it -> `agent/src/jobs/manifest.ts` (`parseJobManifest`, `loadJobManifest`, `renderOverride`)
- the readings -> `agent/src/jobs/sample.ts` (`createGateSampler`)
- one run, the line and the lock -> `agent/src/jobs/run.ts` (`runJob`, `containerArgs`, `parseReport`)
- the unit's entry point, the trigger, the pause guard and the secrets -> `agent/src/jobs/main.ts` (`readSecrets`), `agent/src/jobs/state.ts` (`detectTrigger`, the paths)
- the Jobs page's data, the history and the live gate -> `agent/src/jobs/view.ts` (`readJobsView`, `readJobHistory`, `readJobLog`, `readJobProgress`, `readJobReport`, `readJobFit`), `agent/src/jobs/gate.ts` (`gatePreview`)
- staged input -> `agent/src/jobs/stage.ts` (`stageChunk`, `sweepStages`)
- who may do what -> `contract/capabilities.ts` (`jobs.run`, `jobs.manage`, `FRESH_POLICY_ROUTES`)
- the controls -> `contract/actions.ts` (`job.*`), `agent/src/cli/jobs.ts` (`vps job`), `host/65-actions/files/etc/systemd/system/vps-act-jobctl@.service`
- Run now and a start with input -> `contract/actions.ts` (`job.run`, `restore.start`), `host/65-actions/files/opt/vps/bin/vps-act-job`; Cancel test -> `restore.cancel`, `vps-act-jobstop`
- the page and the card -> `src/ui/screens/Jobs.tsx`, `src/ui/components/jobs.tsx`, `src/ui/jobs.ts` (`jobControls`, `jobBadge`, `jobsHeadline`)
- the units, the slice, the gate settings and the self-test -> `host/66-jobs/`

## Operations

- **Every control without the console:** `sudo vps job list`, then
  `sudo vps job run|stop|restart|pause|resume|block|unblock <name>`,
  `sudo vps job limits <name>:<memory>:<cpus>:<timeout>:<max_wait>:<retry>` (or `<name>:reset`)
  and `sudo vps job schedule <name>:<pattern>` (or `<name>:repo`); `sudo vps job` alone lists
  them and the patterns.
- **Nothing runs:** check the timer (`systemctl list-timers 'vps-job-*'`) and
  `sudo bash /tmp/vps-host/66-jobs/apply.sh status`, which starts with each job's state. A paused or
  blocked job is that on purpose: Resume or Unblock it. The Jobs page shows a job whose manifest
  is broken, with the problem, rather than hiding it.
- **A run waits for a long time:** the reason is on the Jobs page and in the journal
  (`WAITING`). If the server is genuinely busy that is the rule working; if it never clears,
  look at what is using the server (Processes, Metrics) rather than raising the limits.
- **A job keeps failing:** its steps say which one failed, and its output is on the page. A job
  that fails every attempt alerts once per run. For `astro_heartbeat`, a 401 means the job's
  `HEALTH_CHECK_SECRET` does not match the site's, and a 403 means Cloudflare refused or
  challenged the server before the request reached the site.
- **A run has no report:** the job wrote no `/out/result.json`, so it is failed by design.
- **`66-jobs test` skips a job with input:** it can run only with what its page stages; test it
  from there.
- **Changing the busy rule's numbers:** edit `/etc/vps/jobs.conf` in the repository
  (`host/66-jobs`) and apply the module, not by hand on the server. A job's own limits are
  changed from its card (Change limits) or with `vps job limits`.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-16 | The whole document against the code, read-only: the busy rule, its settings and bounds, and the run record (`contract/jobs.ts`, `host/66-jobs/files/etc/vps/jobs.conf`); the three manifests and timers, the units and the slice (`host/66-jobs/`); the runner, its line, cancel mark, cleanup check, quiet check and retention (`agent/src/jobs/`, `agent/src/main.ts`); `vps job` (`agent/src/cli/jobs.ts`); the actions, their capabilities, confirmations and fresh sign-in, and the units `vps-act-job@`, `vps-act-jobctl@` and `vps-act-jobstop@` (`contract/actions.ts`, `host/65-actions/`); the capabilities, role defaults, floors and fresh policy reads (`contract/capabilities.ts`, `src/http/router.ts`); the Jobs page, the card and which controls show (`src/ui/`); the alert lines and their levels (Vector configuration in `host/`); in cf-admin, the gateway's page access, Viewer refusal and access notice, the activity-log verbs and the `heartbeat-watchdog` job; in cf-astro, that its heartbeat workflow runs only by hand. Added who may see, run and change jobs; corrected Stop (it works for every job, not only a job with input), the controls' conditions, the page's order and its history ranges, the number of alerts (three) and the root needed by `apply.sh status`; private documents are named, not linked, for the public docs mirror. | The live server: which jobs, images, timers and overrides are installed, and any job's runs. Live Cloudflare and GitHub state. No job or control was run. |

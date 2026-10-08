---
title: "Controlled Actions"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-08
verified_against: [code]
owner: harshil
related_code: [contract/actions.ts, contract/logstore.ts, contract/jobs.ts, src/agent/proxy.ts, agent/src/server.ts, agent/src/actions.ts, host/65-actions, src/ui/components/actions.tsx]
related_docs: [../security/PERMISSIONS.md, LOG-STORAGE.md, JOBS.md, RESTORE-TESTS.md, ../architecture/OVERVIEW.md, ../operations/HOST-MODULES.md]
tags: [feature, actions, polkit, systemd, enforcement]
---

# Controlled Actions

> **TL;DR (non-technical):** The console can change the server in only a handful of fixed
> ways, such as restarting a service, installing updates or rebooting. Each one is a named
> action with its own permission. The request is checked four times on its way to the server,
> and risky ones ask you to type a confirmation word first.

## The actions

Defined once in `contract/actions.ts` (`ACTIONS`). The ids are also the words cf-admin's
activity log uses. **Fresh** means a cf-admin sign-in from the last 10 minutes.

| Action | Capability | Target | Typed confirmation | Fresh | What it does |
|---|---|---|---|---|---|
| `service.restart` | `services.control` | A service unit | none | no | Restart an allow-listed service |
| `service.start` | `services.control` | A service unit | none | no | Start an allow-listed service |
| `service.stop` | `services.control` | A service unit | the unit name | no | Stop an allow-listed service |
| `packages.update` | `packages.update` | none | none | no | Refresh package lists (`apt-get update`) |
| `packages.upgrade` | `packages.update` | none | `upgrade` | no | Install updates; no removals, config files kept |
| `host.reboot` | `host.reboot` | none | `reboot` | no | Reboot in one minute; cancellable on the host |
| `app.deploy` | `apps.deploy` | An app name | none | no | Regenerate the app's unit and site from its manifest, restart, health-check |
| `app.start` | `apps.control` | An app name | none | no | Start the app's container unit |
| `app.stop` | `apps.control` | An app name | the app name | no | Stop it; it stays stopped until started again or the server reboots |
| `app.restart` | `apps.control` | An app name | none | no | Restart the app's container unit |
| `app.pause` | `apps.control` | An app name | none | no | Freeze its processes in place (systemd's freezer): memory kept, no CPU, no answers |
| `app.resume` | `apps.control` | An app name | none | no | Unfreeze a paused app |
| `app.block` | `apps.manage` | An app name | the app name | no | Stop it and mask its unit, so nothing starts it (a start, a deploy, a reboot or an image update) until it is unblocked |
| `app.unblock` | `apps.manage` | An app name | none | no | Unmask and start it |
| `app.resources` | `apps.manage` | `<app>:<memory>:<cpu %>:<weight>` | none | no | New memory cap, CPU cap (a share of the whole server) and CPU weight; applied live without a restart, and written to the manifest and unit |
| `logs.purge` | `logs.purge` | Dates and kinds | `delete` | yes | Delete stored log files for past days |
| `logs.vacuum` | `logs.purge` | Days | `delete` | yes | Delete journal files (and recordings in them) older than N days |
| `retention.set` | `retention.manage` | Key and days | none | yes | Change how long one kind of log is kept |
| `job.run` | `jobs.run` | A job name | none | no | Start a server job now; it waits its turn like any run ([JOBS](JOBS.md)) |
| `restore.start` | `restore.test` | `restore_test:<stage>` | `restore` | yes | Start a restore test of the copy staged under `<stage>`, with the resources its request asks for; it waits its turn while the server is busy ([RESTORE-TESTS](RESTORE-TESTS.md)) |
| `restore.cancel` | `restore.test` | `restore_test` | none | no | Stop the restore test waiting or running; its container, work space and staged files are removed |
| `job.stop` | `jobs.run` | A job name | none | no | Stop the run that waits or runs; it is recorded as `cancelled`, never alerted |
| `job.restart` | `jobs.run` | A job name | none | no | Stop the run in flight, then start a new one |
| `job.pause` | `jobs.run` | A job name | none | no | Stop the job's schedule; a run in flight finishes and Run now still works |
| `job.resume` | `jobs.run` | A job name | none | no | Start the job's schedule again |
| `job.block` | `jobs.manage` | A job name | the job name | no | Stop it, mask its run unit and switch its timer off, so nothing starts it until it is unblocked |
| `job.unblock` | `jobs.manage` | A job name | none | no | Unmask it; its timer starts again unless it is paused |
| `job.limits` | `jobs.manage` | `<job>:<memory>:<cpus>:<timeout>:<max_wait>:<retry>` or `<job>:reset` | none | no | Limits for its next run, kept as an override beside the repository's manifest |
| `job.schedule` | `jobs.manage` | `<job>:<pattern>` or `<job>:repo` | none | no | A schedule from the fixed patterns (never more often than every 5 minutes), kept as a timer drop-in |

Target shapes (checked by `checkActionRequest`): a unit is `[A-Za-z0-9@._:-]` ending in
`.service`, at most 120 characters; an app is lowercase letters, digits and hyphens; a job is
lowercase letters, digits and underscores (`JOB_NAME`, no hyphen, so no unit escaping);
`restore.start` is `restore_test:` and 16 lowercase hex characters (`parseRestoreTarget`,
`STAGE_ID`), and `restore.cancel` is exactly `restore_test`;
`job.limits` is checked by `parseJobLimits` against the manifest's own bounds (memory 16M to 3G,
up to 4 cores, time 10s to 4h, wait 30s to 4h, retries 0 to 2) and `job.schedule` by
`parseScheduleTarget` (every 5, 10, 15, 20 or 30 minutes; hourly at a minute; every 2, 3, 4, 6, 8
or 12 hours at a minute; daily or weekly at a time, UTC);
`app.resources` is `<app>:<memory>:<cpu %>:<weight>` (`parseAppResources`: memory 32M to 6G,
CPU cap 5 to 100 percent of the whole server where 100 is no cap, weight 1 to 10000);
`logs.purge` is `YYYYMMDD:YYYYMMDD:kind.kind` (real dates, from before to, never today, at
most 400 days, known kinds without repeats); `logs.vacuum` is 1 to 3650 days; `retention.set`
is `<key>:<days>` within that key's limits. An action that takes no target refuses one.
Errors: `unknown_action`, `bad_target`, `protected`, `confirm_required`, `includes_today`,
`range_too_long`, `out_of_range`.

Protected units are refused whatever the allow-list says: SSH, auditd, Vector, the agent,
the terminal signer, the tunnel connector, dbus, polkit, `systemd-*`, user and getty
instances, and the action units themselves (`isProtectedUnit`).

## Enforcement chain

| # | Where | What it checks |
|---|---|---|
| 1 | Console | Hides or disables the button without the capability; asks for the typed word |
| 2 | Worker (`proxyToAgent`) | The route needs `host.view`; `checkActionRequest` validates the action, target and confirmation; the action's own capability is in the person's list; fresh sign-in where required. Then it signs the body hash, so the agent runs exactly this body |
| 3 | Agent (`actions/run`) | Verifies the signature and nonce, repeats `checkActionRequest` and the capability check, then starts the unit with `systemctl start --no-block` as its own unprivileged user. The job id is the systemd invocation id |
| 4 | polkit rule | Lets only the agent user start units named `vps-act-*` (fixed oneshot units, and templated ones with a restricted instance name). Any other verb, unit or polkit action is denied |
| 5 | Root oneshot unit | Runs a fixed script that validates its target once more. `vps-act-svc` allows a unit only if it is an app unit created by the platform or is listed in a root-owned allow-list file, and never if it is protected. The app controls run `vps act <verb>:<target>` from `vps-act-app@.service`, which accepts only the eight app verbs, a valid app name and resources within the bounds, and refuses to start, restart, pause or deploy a blocked app |

A caller who skips the console still meets checks 2 to 5. A caller who skips the Worker still
meets 3 to 5, because the agent trusts only the signed capability list.

## Action tickets (the host trusts the Worker, not the agent)

polkit lets the agent account start every action unit, so the units do not trust the agent.
For each console action the Worker signs a ticket (`contract/action-ticket.ts`): it is valid for
60 seconds, can be used once, and names the exact unit, the person and the request. The agent
writes it to its own runtime folder and starts the unit. Every action unit runs
`vps-act-ticket.mjs` as root first (`ExecStartPre`), which checks the following:

- the signature, against the Worker's production key only (never the laptop dev key);
- the unit, which must match the ticket;
- the time;
- the nonce.

When the ticket passes, it logs who asked. Otherwise it stops the unit before anything runs.
The server holds no signing key, so even a compromised agent cannot delete logs, change
retention, reboot, upgrade or touch services by itself. The module's live test proves both
refusals: an action with no ticket, and an action with a ticket signed by another key.

## Jobs and the audit trail

- `actions/run` returns `{ unit, job }`. `actions/job` with that pair returns the job's state
  (`running`, `succeeded`, `failed`, `superseded`, `unknown`), its exit status and the unit's
  journal lines for that invocation. Only `vps-act-*` units can be read.
- The agent logs every request to the journal with the person's email, and sets an
  `x-vps-audit` response header: the action id, `target=` and `job=` tokens. The Worker passes
  that header through, and cf-admin turns it into an activity-log row.
- Purge and retention scripts also write journal lines that Vector classes as `security`
  and raises as a `log_purge` alert; see [AUDIT-PIPELINE](../security/AUDIT-PIPELINE.md).

## Host side (`65-actions`)

The module installs the root scripts, the oneshot units (`vps-act-<verb>` and templated
`vps-act-<verb>@` forms), the service allow-list and the polkit rule. `vps-act-job` is the
one script that starts something and does not wait for it: it checks the job exists, marks the
run as a person's, and starts `vps-job@<name>.service` with `--no-block` (the run then waits on
the busy gate, [JOBS](JOBS.md)); a Run now while that job already waits or runs starts nothing
new. Its instance is either `<name>` (Run now) or `<name>:<stage>` (`restore.start`): a job
whose manifest says `input = true` starts only the second way, only when the stage exists with
its `request.json`, and a second start while it waits or runs is refused. `vps-act-jobstop@<name>`
(`restore.cancel`) stops the job's unit, and only for a job that takes input; like every console stop it
leaves the cancel mark, so the run ends `cancelled` and raises no alert. Run now refuses a blocked
job, with the way out. The other job controls share one template,
`vps-act-jobctl@<verb>:<target>`, which runs `vps job act` as root under one lock
(`flock /run/lock/vps-jobctl.lock`), so two people's presses are served one after the other;
its lines sit with the job runner's in the journal. Its `test` step runs
the scripts on scratch trees. A unit-template test (`test/host-units.test.ts`) checks that
every templated unit passes the unescaped instance (`%I`) to its script, because the Worker
escapes unit names the way `systemd-escape` does (`escapeUnitInstance`).

## Not in this list

File changes (`files.write`) and the terminal (`terminal.ops`, `terminal.admin`) are separate
change routes with their own checks; see [API-ROUTES](../reference/API-ROUTES.md) and
[PERMISSIONS](../security/PERMISSIONS.md).

---
title: "Controlled Actions"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_code: [contract/actions.ts, contract/logstore.ts, src/agent/proxy.ts, agent/src/server.ts, agent/src/actions.ts, host/65-actions, src/ui/components/actions.tsx]
related_docs: [../security/PERMISSIONS.md, LOG-STORAGE.md, ../architecture/OVERVIEW.md, ../operations/HOST-MODULES.md]
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
| `app.restart` | `apps.deploy` | An app name | none | no | Restart the app's container unit |
| `logs.purge` | `logs.purge` | Dates and kinds | `delete` | yes | Delete stored log files for past days |
| `logs.vacuum` | `logs.purge` | Days | `delete` | yes | Delete journal files (and recordings in them) older than N days |
| `retention.set` | `retention.manage` | Key and days | none | yes | Change how long one kind of log is kept |

Target shapes (checked by `checkActionRequest`): a unit is `[A-Za-z0-9@._:-]` ending in
`.service`, at most 120 characters; an app is lowercase letters, digits and hyphens;
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
| 5 | Root oneshot unit | Runs a fixed script that validates its target once more. `vps-act-svc` allows a unit only if it is an app unit created by the platform or is listed in a root-owned allow-list file, and never if it is protected |

A caller who skips the console still meets checks 2 to 5. A caller who skips the Worker still
meets 3 to 5, because the agent trusts only the signed capability list.

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
`vps-act-<verb>@` forms), the service allow-list and the polkit rule. Its `test` step runs
the scripts on scratch trees. A unit-template test (`test/host-units.test.ts`) checks that
every templated unit passes the unescaped instance (`%I`) to its script, because the Worker
escapes unit names the way `systemd-escape` does (`escapeUnitInstance`).

## Not in this list

File changes (`files.write`) and the terminal (`terminal.ops`, `terminal.admin`) are separate
change routes with their own checks; see [API-ROUTES](../reference/API-ROUTES.md) and
[PERMISSIONS](../security/PERMISSIONS.md).

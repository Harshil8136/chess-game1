---
title: "Agent Route Table"
status: active
audience: [ai, technical]
last_verified: 2026-10-16
verified_against: [code]
owner: harshil
related_code: [contract/capabilities.ts, contract/bridge.ts, contract/actions.ts, contract/metrics-history.ts, contract/jobs.ts, contract/restore.ts, src/agent/proxy.ts, src/http/router.ts, agent/src/server.ts]
related_docs: [../security/PERMISSIONS.md, ../features/ACTIONS.md, ../features/JOBS.md, ../features/RESTORE-TESTS.md, ../architecture/OVERVIEW.md]
tags: [reference, api, routes, capabilities]
---

# Agent Route Table

> **TL;DR (non-technical):** This is the complete list of things the console can ask the
> server's agent to do, and the permission each one needs. A request for anything not on the
> list is refused before it leaves the private service.

## How to read it

The table is `AGENT_ROUTE_CAPS` in `contract/capabilities.ts`, shared by the Worker, the agent
and the console. A route is reached in two forms:

| Form | Path |
|---|---|
| Browser to Worker | `/dashboard/vps/app/api/<route>` |
| Worker to agent | `/v1/<route>`, signed |

- **GET** routes read. **POST** routes (`CHANGE_ROUTES`) change something and carry a signed
  body hash; the body is limited to 16 KiB, or 1 MiB for `files/upload` and `restore/stage`,
  257 KiB for `apps/bridge`, and 1 MiB and 16 KiB for `actions/run`, which may carry an app's
  package for `app.release` (`contract/releases.ts`).
  Anything else is 405.
- **Stream** routes stay open (`STREAM_ROUTES`); every other route is a bounded request.
- **Wait** is how long the Worker waits for the agent's response headers (`timeoutFor`): 60
  seconds for the slow reads, 15 seconds otherwise, no limit for streams. A timeout is 504.
- The Worker refuses a missing capability with 403 and `need: <capability>` before it signs
  anything. The agent re-checks it from the signed list.
- The Worker decides on its 30-second copy of the access policy, except for 15 routes that read
  the stored row first (`FRESH_POLICY_ROUTES`): every change except typing into, resizing or
  closing a terminal already open (`restore/stage`, the four `files/` changes, `actions/run`,
  `apps/bridge`, `terminal/open`), and the reads a floor guards (`audit/days`, `audit/events`, `audit/event`,
  `audit/sessions`, `audit/recordings`, `audit/recording`, `logstore/preview`). A power taken
  away stops those at once ([PERMISSIONS](../security/PERMISSIONS.md#stored-policy-and-per-person-grants)).
- A route missing from this table is 404 on the Worker and on the agent.
- `ROUTE_TABLE_ID` is a fingerprint of the table. `GET /api/me` returns the Worker's; the
  console compares it with its own and warns about a version mismatch.

## Host

| Route | Type | Capability | Wait |
|---|---|---|---|
| `health` | GET | none (unsigned) | 15 s |
| `system` | GET | `host.view` | 15 s |
| `metrics/snapshot` | GET | `host.view` | 15 s |
| `metrics/stream` | stream | `host.view` | open |
| `metrics/history` | GET | `host.view` | 15 s |
| `services` | GET | `host.view` | 15 s |
| `services/detail` | GET | `host.view` | 15 s |
| `packages` | GET | `host.view` | 60 s |
| `packages/installed` | GET | `host.view` | 60 s |
| `packages/info` | GET | `host.view` | 60 s |
| `processes` | GET | `host.view` | 15 s |
| `apps` | GET | `host.view` (also cf-admin's `lab-update` job: `SYSTEM_JOB_READS`) | 15 s |
| `jobs` | GET | `host.view` | 60 s |
| `jobs/log` | GET | `logs.view` | 60 s |
| `jobs/progress` | GET | `host.view` | 15 s |
| `jobs/report` | GET | `host.view` | 15 s |
| `jobs/fit` | GET | `host.view` | 15 s |
| `jobs/history` | GET | `host.view` | 15 s |
| `timers` | GET | `host.view` | 15 s |
| `storage` | GET | `host.view` | 15 s |
| `network` | GET | `host.view` | 15 s |
| `history` | GET | `host.view` | 60 s |
| `diagnostics` | GET | `host.view` (also cf-admin's `health-checks` job: `SYSTEM_JOB_READS`) | 15 s |

`jobs` is the Jobs page's whole answer (`JobsView` in `contract/jobs.ts`): the gate settings and
any problem with them, every installed job with its standing (scheduled, Run now only, paused,
blocked or off), its schedule, limits, last run, latest results and whether it has gone quiet,
what waits or runs now with the reason it waits, the latest finished runs, and the busy gate as
it stands this second (`gate`, read from the agent's own one-second readings; the agent caches
the answer for 2 s). `jobs/log` takes `job` and `run` and returns the last 256 KiB of that run's
output with the run's record; anything that is not a job name and a run id is 400 `bad_run`,
and a run that does not exist is 404. `jobs/history` takes an optional `job` and `days` (1 to 31,
7 when absent; a value outside is clamped) and returns every finished run of those days, newest
first, with each job's counts and timings (`JobHistory`); a `job` that is not a job name is 400
`bad_job`, and the answer is cached for 15 s. `jobs/progress` and `jobs/report` take the same two parameters, with the same
errors: the first returns the run's record and its live steps (the job's `@@step` lines), the
second the record and the report the job left (404 when it left none). Both hold names, counts
and timings only, never the data a job worked on. `jobs/fit` takes `job` and, optionally,
`memory` (MiB), `cpus` (hundredths of a core), `workspace` (MiB), `timeout` and `max_wait`
(seconds), each up to six digits (otherwise 400 `bad_<name>`); it answers whether a run with
those resources is within the job's ceilings, what the busy gate would decide now with that
memory counted, whether it could ever fit, and what is running (`JobFit` in
`contract/jobs.ts`), or 404 for a job that is not installed. See [JOBS](../features/JOBS.md).

## Restore tests

| Route | Type | Capability | Wait |
|---|---|---|---|
| `restore/info` | GET | `host.view` | 15 s |
| `restore/stage` | POST | `restore.test` | 15 s |

`restore/info` returns the `restore_test` job's image, its resource ceilings and the lab key's
public half (`RestoreInfo`; the key is `null` until it is made), or 404 when the job is not
installed. `restore/stage` writes one chunk of one staged file: `{ stage, file, offset, b64,
final }`, where `stage` is 16 hex characters, `file` a plain name, `offset` the bytes already
received and `final` true on the last chunk. It also needs a cf-admin sign-in from the last 10
minutes (the Worker and the agent check it). A chunk out of order, a bad name, a stage past its size cap or
one that would leave too little disk free is refused. See
[RESTORE-TESTS](../features/RESTORE-TESTS.md).

`metrics/history` takes one query parameter, `range`: `1h`, `24h`, `7d` or `30d`, and `24h`
when it is absent. Any other value, including an empty one or a different case, is 400
`bad_range`. The answer (`MetricsHistory` in `contract/metrics-history.ts`) is at most 720
buckets: `from` and `stepS` place them, `n` counts the minutes in each (0 is a gap, with every
series null there), `series` holds one array per value, and `recorder` says whether the agent
is recording and what it has stored. See [Metrics history](../features/CONSOLE.md#metrics-history).

## Logs and files

| Route | Type | Capability | Wait |
|---|---|---|---|
| `logs` | GET | `logs.view` | 60 s |
| `logs/stream` | stream | `logs.view` | open |
| `files/list` | GET | `files.view` | 15 s |
| `files/read` | GET | `files.view` | 15 s |
| `files/download` | GET | `files.download` | 60 s |
| `files/mkdir` | POST | `files.write` | 15 s |
| `files/upload` | POST | `files.write` | 15 s |
| `files/rename` | POST | `files.write` | 15 s |
| `files/delete` | POST | `files.write` | 15 s |

Logs from the login and sudo sources also need `security.view` (the agent checks it).
`files/delete` also needs a cf-admin sign-in from the last 10 minutes (`FRESH_SIGN_IN_ROUTES`;
the Worker and the agent check it), and deleting a folder with its contents needs its name typed.

## Audit, security and log storage

| Route | Type | Capability | Wait |
|---|---|---|---|
| `audit/days` | GET | `audit.view` | 60 s |
| `audit/events` | GET | `audit.view` | 60 s |
| `audit/event` | GET | `audit.view` | 15 s |
| `audit/sessions` | GET | `audit.view` | 60 s |
| `audit/alerts` | GET | `security.view` | 60 s |
| `audit/recordings` | GET | `sessions.replay` | 60 s |
| `audit/recording` | GET | `sessions.replay` | 60 s |
| `security/posture` | GET | `security.view` | 60 s |
| `security/sessions` | GET | `security.view` | 15 s |
| `security/integrity` | GET | `security.view` | 15 s |
| `logstore/usage` | GET | `security.view` | 15 s |
| `logstore/preview` | GET | `logs.purge` | 15 s |

## The admin bridge

Added 2026-11-04 (`contract/bridge.ts`). It lets the console, and through cf-admin an app's own
section there, reach a private app's admin port without the app having any address. The agent
forwards the call on loopback to the member's `admin_port` (published on `127.0.0.1` only), with
the method, the exact path and query, the Worker's signature headers as they arrived, and the
body. The app verifies the Worker's signature itself, so it trusts nobody on the way.

| Route | Type | Capability | Wait | Audited |
|---|---|---|---|---|
| `apps/bridge/view` | GET | `apps.bridge.view` (also cf-admin's `bot-flags` job, for the WhatsApp records' `record/urgent` only, and its `bot-weekly` job for their `record/week` only: `SYSTEM_JOB_BRIDGE`) | 60 s | no |
| `apps/bridge` | POST | `apps.bridge.operate`, or `apps.bridge.admin` and a fresh sign-in for level `admin` | 60 s | yes |

- The view query is `app`, an optional `member` and `path`; any other parameter is the app's.
  The change body is `{ app, member?, level, path, body? }` with `level` `operate` or `admin`.
- `app` is an app group's name, `member` one of its members (or none, when only one member has
  an admin port). `path` is lowercase segments of letters, digits, `-` and `_` joined by `/`, at
  most 128 characters: no dots, no query. What a path means is the app's business.
- The Worker refuses a bad query or body with 400 `bad_request` (`bad_app`, `bad_path` or
  `bad_level`) and a missing level capability with 403 before it signs anything; the agent checks
  both again.
- The agent answers 404 `no_bridge` when the app has no admin port, and 502 `bridge_unreachable`,
  504 `bridge_timeout` (55 seconds), 502 `bridge_too_large` (over 2 MiB) or 502 `bridge_not_json`.
  Otherwise the app's own status and JSON body come back, with nothing else of its response.
- An operate or admin call carries `x-vps-audit: app.bridge app=<group>.<member> level=<level>
  path=<path> status=<status>` when the app answers below 400, and the agent logs the same line
  with the person's email. Reads are not audited, and the agent logs a bridge call without its
  query, which may hold a person's search words.

## Actions and terminal

The route needs only `host.view`; the request body then decides the real capability.

| Route | Type | Route capability | Also needs |
|---|---|---|---|
| `actions/run` | POST | `host.view` | The action's own capability, from `ACTIONS`; a fresh sign-in for the actions marked `fresh` (`host.reboot`, `packages.upgrade`, `service.stop`, `logs.purge`, `logs.vacuum`, `retention.set`, `restore.start`, `app.image`, `app.secret`, `app.release`); for `host.reboot`, the owner or vendor support role and the hourly limit (checked by the agent). A cf-admin system job may start only the actions `SYSTEM_JOB_ACTIONS` lists for it (`lab-update`: `app.release`), with no fresh sign-in; the Worker and the agent refuse it any other |
| `actions/job` | GET | `host.view` (also cf-admin's `lab-update` job) | Nothing more; only `vps-act-*` units can be read |
| `terminal/open` | POST | `host.view` | `terminal.ops` or `terminal.admin` for the requested account; admin also needs a fresh sign-in, and (checked by the agent) the owner or vendor support role and the hourly limit |
| `terminal/socket` | stream (WebSocket) | `host.view` | `terminal.ops` or `terminal.admin` (Worker and agent); own session only; a GET with `Upgrade: websocket`, else 400 at the Worker and 426 at the agent |
| `terminal/stream` | stream | `host.view` | `terminal.ops` or `terminal.admin` (checked by the agent); own session only |
| `terminal/input` | POST | `host.view` | `terminal.ops` or `terminal.admin`; own session only |
| `terminal/resize` | POST | `host.view` | Same |
| `terminal/close` | POST | `host.view` | Same |
| `terminal/list` | GET | `host.view` | `terminal.ops` or `terminal.admin`; lists only the person's sessions |

`terminal/socket` is a session's live connection, added 2026-10-16; `terminal/stream`,
`input` and `resize` are its fallback. The query is `id` (the session) and `from` (the last
output sequence received). The agent answers 101 and the Worker returns that answer, socket
included, without reading the messages. A refusal is an ordinary answer: 403 with
`need: terminal.ops` (Worker) or `own_session` (agent), 404 for an unknown session. The
message format is in `contract/terminal.ts` and
[CONSOLE](../features/CONSOLE.md#how-the-terminal-connects).

See [ACTIONS](../features/ACTIONS.md) for the action ids and [PERMISSIONS](../security/PERMISSIONS.md)
for the capabilities, the fresh sign-in, the red lines and the hourly limits.

## Routes served by the Worker itself

These are under the same `/dashboard/vps/app/api/` prefix and never reach the agent.

| Route | Method | Capability | What it does |
|---|---|---|---|
| `me` | GET | none | The person's email and role, `caps` (what the console shows) and `agentCaps` (what the agent will accept; the same outside the local preview), `preview`, `policyStored`, the catalog, whether signing and the agent are configured, and `routes` (`ROUTE_TABLE_ID`) |
| `releases` | GET | `apps.manage` (also cf-admin's `lab-update` job) | The app packages this Worker was built with, read from its own assets (`/_releases/index.json`): `{ app, version, sha256, chars }` for each, `[]` when there are none. For `app.release`, the Worker also reads the package itself and adds it to the action's body ([ACTIONS](../features/ACTIONS.md#installing-an-update-apprelease-2026-11-07)) |
| `access` | GET | `access.view` | The whole access policy and whether it is stored |
| `access` | POST | `access.manage` | Save the policy (compare-and-swap on its revision; up to 64 KiB) |
| `access/person` | GET | `access.view`, or `access.delegate` for a person cf-admin names in `x-vps-target` whom the caller outranks | One person's role defaults, grant and effective capabilities, and what the caller may change |
| `access/person` | POST | `access.manage`, or `access.delegate` under the delegation rules; both read from the stored policy | Replace or remove one person's grant (up to 16 KiB) ([Delegation](../security/PERMISSIONS.md#delegation)) |
| `access/role` | POST | `access.manage` | Move one capability's default to a minimum role, keeping every other default and every personal grant (up to 16 KiB; audit line ends in `via=role`) |
| `access/catalog` | GET | none (a person, not a system job) | Every capability with its class and floor flag, each role's level and defaults, and what the caller holds and may delegate |

## Error shapes

Worker errors are `{ ok: false, code, message }` with `code` one of `bad_actor` (400),
`bad_signature` (400: the console signing key is set and cf-admin's signature is missing, older
than 60 seconds or wrong), `bad_request` (400), `forbidden` (403), `not_found` (404), `method_not_allowed` (405),
`conflict` (409), `actor_version_mismatch` (409), `internal` (500), `upstream_error` (502),
`not_configured` (503) and `upstream_timeout` (504). The Worker never answers 401: only
cf-admin decides a person is signed out. The agent answers 401 for an unsigned, stale,
replayed or badly signed request. Its own refusals are `{ ok: false, error, need }`, with a
plain-words `message` for its own checks: 403 `forbidden` with `need` the capability,
`fresh_sign_in`, `owner_role`, `own_ticket` (a terminal ticket made for someone else) or
`own_session`, and 429 `too_many` with `need: hourly_limit`. A body or ticket it cannot use is
400 with `error` `bad_json` or `bad_ticket`.

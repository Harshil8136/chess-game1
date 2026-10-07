---
title: "Server Console Pages"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_code: [src/ui/pages.ts, src/ui/App.tsx, src/ui/hooks.ts, src/ui/api.ts, src/ui/status.ts, src/ui/screens, src/ui/me.ts, src/http/router.ts, contract/metrics-history.ts, agent/src/recorder.ts, agent/src/history-store.ts, agent/src/collectors/metrics-history.ts]
related_docs: [../security/PERMISSIONS.md, ACTIONS.md, LOG-STORAGE.md, ../reference/API-ROUTES.md]
tags: [feature, console, ui, pages]
---

# Server Console Pages

> **TL;DR (non-technical):** The Server page in the admin portal is a console with one tab
> per job: see how the server is doing, read its logs, browse files, open a terminal, review
> the security record, and manage who may do what. Each person sees only the tabs their
> permissions allow.

## How the console behaves

- It runs inside the portal's Server page. The portal frames the console and decides who may
  open the page at all; the console decides what each person may do inside it.
- A toolbar under the portal header holds a launcher (the current page; opens every page by
  group), the pages as icon groups (groups that do not fit move to the launcher) and host status.
- `GET /api/me` returns the person's capabilities, the capability catalog and the route-table
  fingerprint. The toolbar lists a page only when the person holds its capability
  (`groupedPages`). A button without its capability is disabled and says why.
- If the console is newer than its Worker (a stale deploy or an old local preview), the
  fingerprint differs and the console says so, instead of answering 404 on every new view.
- After each navigation the console posts `{ type: 'cf-vps:route', v: 1, path, label }` to the
  portal so the address bar and tab title follow. A page lives at `/dashboard/vps/<page>`;
  Overview is `/dashboard/vps`.
- **Live data stops while the tab is hidden.** The header's status and the Overview come from
  a live stream that delivers one sample a second. While the tab is hidden (another tab, a
  minimised window, a locked phone) the console closes that stream, and it stops the health
  check it otherwise sends every 5 seconds while samples are late. When the tab is shown again
  it reopens the stream at once and fetches the last five minutes again. When that fetch
  answers, the charts start from it instead of joining the samples on either side of the hidden
  spell; if it fails, the old samples stay and the new ones follow them, as after any outage.
  The health check resumes too, with its first ask 5 seconds after the return, so the reopened
  stream can answer first. While the tab is visible the stream reconnects as before: a dropped
  connection is retried by the browser, and an error answer is retried after 2 seconds,
  doubling to at most 30. The pages that refresh on a timer (Processes, Metrics, Apps,
  Recordings) skip refreshes while the tab is hidden. The Logs live tail and the Terminal stay
  connected.

## Pages

Twenty pages, in sidebar order (`PAGES` in `src/ui/pages.ts`). The capability opens the
page; the Worker and agent enforce it again on every call.

| Page | Group | Needs | Shows |
|---|---|---|---|
| Overview | Host | `host.view` | Live meters, charts and host facts |
| Metrics | Host | `host.view` | CPU, memory, load, disk space, disk I/O, network and processes over 1 hour, 24 hours, 7 days or 30 days, recorded by the agent once a minute; see [Metrics history](#metrics-history) |
| Processes | System | `host.view` | Every process with its CPU and memory |
| Services | System | `host.view` | systemd services, state and logs; a service's detail page offers Restart, Start, Stop (needs `services.control`; protected services show no buttons) |
| Apps | System | `host.view` | Hosted apps: state (running, paused, blocked, stopped), memory against its cap, CPU now as a share of the server with its cap and weight, health, restarts. Controls follow the state: Start, Restart, Pause, Resume and Stop need `apps.control`; Block, Unblock and the inspector's Change Allocation form (memory cap, CPU cap, CPU weight) need `apps.manage`; Deploy needs `apps.deploy`. Buttons the person does not hold stay visible but locked |
| Timers | System | `host.view` | Scheduled jobs: next and last run |
| Packages | System | `host.view` | Available updates, installed packages, dependencies; Update lists and Upgrade need `packages.update` |
| Storage | Resources | `host.view` | Filesystems, space and inodes |
| Network | Resources | `host.view` | Interfaces, listening ports, the tunnel |
| Logs | Operations | `logs.view` | The system journal and a live tail; login and sudo sources also need `security.view`; shows how long the journal is kept |
| Terminal | Operations | `terminal.ops` | A recorded shell through a 60-second certificate; the sudo-capable account needs `terminal.admin` and a sign-in from the last 10 minutes |
| Files | Operations | `files.view` | The server as a folder browser; download needs `files.download`; create, upload, rename and delete need `files.write` |
| Timeline | Security | `audit.view` | Sessions, commands, sudo and config changes; shows retention |
| Recordings | Security | `sessions.replay` | Replay recorded terminal sessions; shows retention |
| Alerts | Security | `security.view` | What the audit pipeline flagged |
| Posture | Security | `security.view` | Accounts, SSH settings, exposure, who is logged in, hardening and integrity results |
| Log storage | Security | `security.view` | Space used, growth, retention per kind, delete by date, size or kind; see [LOG-STORAGE](LOG-STORAGE.md) |
| Diagnostics | Admin | `host.view` | Agent, tunnel, audit pipeline, clock, external site checks; Reboot needs `host.reboot` |
| API | Admin | `api.raw` | The raw read-only JSON explorer |
| Access | Admin | `access.view` | Who holds which capabilities; editing needs `access.manage` |

## Notes by area

- **Files.** The agent refuses secrets, re-checks symlinks after resolving them, and
  limits writes to app source and config folders and the share folder.
  Downloads are capped at 200 MB; uploads go in chunks of about 512 KiB.
- **Terminal.** Opening a session asks the Worker to mint a 30-second ticket; the server's
  signer turns it into a 60-second SSH certificate for one account. Only the person who opened
  a session can see it or type into it. Sessions are recorded and replayable under Recordings.
- **Logs and recordings** read the system journal; the audit record behind Timeline is a
  separate store (see [AUDIT-PIPELINE](../security/AUDIT-PIPELINE.md)).
- **Access.** Role defaults, per-person grants with an optional end date and a note. The
  rules are in [PERMISSIONS](../security/PERMISSIONS.md).

## Metrics history

The Overview shows the last five minutes, held in the agent's memory. The Metrics page shows
up to 30 days, which the agent records itself. It is the design's "long history" extra, built
into the agent instead of a separate collector: such a collector is not in the Ubuntu archive,
runs root and system-user plugins, and starts processes, and the audit rules record every
process a service account or root daemon starts.

**Recording.** Once a minute, on the minute, the agent reads `/proc` and `statfs`. It starts
no process and has no extra dependency. Each sample holds:

| Value | How |
|---|---|
| CPU busy % | Delta of `/proc/stat` over the minute |
| Load (1 minute) | `/proc/loadavg` |
| Memory used and available, swap used | `/proc/meminfo` (used = total minus available) |
| Used % of `/` and of the audit disk | `statfs`, as `df` computes it |
| Disk read and write, bytes per second | Delta of `/proc/diskstats` for the whole disks |
| Network in and out, bytes per second | Delta of `/proc/net/dev` per interface, loopback excluded |
| Processes | Numeric entries in `/proc` |

Rates and CPU come from the difference between this minute's counters and the last minute's,
measured on a monotonic clock. A counter that went backwards (a reboot, an interface
recreated) gives no value for that minute, never 0. An interface that appeared or vanished
during the minute is left out of it. The first sample after a start waits until its baseline
is at least 10 seconds old.

**Storage.** One file per UTC day, `YYYY-MM-DD.jsonl`, one JSON line per minute, in
`/var/lib/vps/metrics`: the agent's systemd `StateDirectory`, owned by the agent's
account, mode 0700. A deploy replaces the release folder, not this one, so history survives
restarts and deploys. Files are append-only. Today and the 30 days before it are kept, and
older day files are deleted when the day changes and at start.

| Bound | Value |
|---|---|
| Line | At most 256 bytes; the longest possible line is about 230, a typical one about 150 |
| Day file | At most 384 KiB (1,440 lines of the longest kind fit); typically about 220 KB |
| Total | 31 files: at most 12 MiB, typically about 7 MB |

A restart never writes a minute twice: the writer reads the day's newest minute first. A file
that ends mid-line after a crash gets the next sample on a new line. The reader skips any line
it cannot use, so a torn or damaged line costs that one minute. If the agent cannot write (for
example the unit's `StateDirectory` is missing), it logs one line to the journal, keeps
serving everything else, and the page says it is not recording.

**Gaps.** When the agent was not running there is no sample. The answer marks such a bucket
with a count of 0 and no values, and the chart leaves the line broken and shades the bucket.
Nothing is interpolated.

**The answer.** `GET metrics/history?range=1h|24h|7d|30d` (see
[API-ROUTES](../reference/API-ROUTES.md)) returns at most 720 buckets aligned to whole steps:

| Range | Bucket | Buckets |
|---|---|---|
| `1h` | 1 minute | 60 |
| `24h` | 2 minutes | 720 |
| `7d` | 14 minutes | 720 |
| `30d` | 1 hour | 720 |

Each bucket has its sample count and the average of every value. CPU, memory used, disk I/O
and network also carry the bucket's highest minute, which the chart draws dashed, since an
average flattens a short spike. The answer is about 70 KB before compression. The agent reads
each range from disk at most every 20 seconds, one day file at a time.

There is no separate History page any more: the one that read sysstat's 10-minute samples was
folded into Metrics, and `/dashboard/vps/history` opens Metrics.

## Local preview

`npm run dev` opens an SSH forward to the agent and serves the console on a local port. It
signs with a dev key limited to `read`-class capabilities, so everything can be looked at and
nothing changed: downloads, file changes, actions and the terminal work only in the portal.

Every page and control still shows in the preview, the Terminal and the Access editor
included, so they can be designed there. `/api/me` answers `preview: true`, `caps` (everything
the dev actor holds: what the console shows) and `agentCaps` (the reads the agent accepts from
a laptop). Pressing a control that changes the server gets the Worker's refusal, which the
screen shows. Access edits save to the local test database on the PC, never the real one. A
"Preview" banner, or a muted look for controls outside `agentCaps`, can key off those fields.

## Key code paths

- Page list, groups, icons, capability per page: `src/ui/pages.ts`
- Capability gating and the route-table check: `src/ui/App.tsx`, `src/ui/me.ts`
- The live stream and its reconnects: `openStream` in `src/ui/api.ts`, opened with the snapshot
  by `openMetrics`; the health check while samples are late: `pollHealth` (same file); the
  Overview's history: `withSnapshot` and `withSample` in `src/ui/status.ts`; the hidden-tab
  rule: `useInterval` (timers) and `whileVisible` (open connections) in `src/ui/hooks.ts`
- One screen per page: `src/ui/screens/*.tsx`
- The `/api/me`, access and proxy routes: `src/http/router.ts`
- Metrics history: the ranges and answer in `contract/metrics-history.ts`; the recorder in
  `agent/src/recorder.ts`; the day files in `agent/src/history-store.ts`; downsampling in
  `agent/src/collectors/metrics-history.ts`; the page in `src/ui/screens/Metrics.tsx`

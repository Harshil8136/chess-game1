---
title: "Server Console Pages"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-09
verified_against: [code]
owner: harshil
related_code: [src/ui/pages.ts, src/ui/screens, src/ui/shell, src/ui/theme.ts, src/ui/restore.ts, src/ui/App.tsx, src/ui/hooks.ts, src/ui/api.ts, src/ui/status.ts, src/ui/me.ts, src/http/router.ts, contract/metrics-history.ts, agent/src/recorder.ts, agent/src/history-store.ts, agent/src/collectors/metrics-history.ts]
related_docs: [../security/PERMISSIONS.md, ACTIONS.md, JOBS.md, RESTORE-TESTS.md, LOG-STORAGE.md, ../reference/API-ROUTES.md]
tags: [feature, console, ui, pages]
---

# Server Console Pages

> **TL;DR (non-technical):** The Server page in the admin portal is a console with one page
> per job: see how the server is doing, read its logs, browse files, open a terminal, review
> the security record, and manage who may do what. Each person sees only the pages their
> permissions allow. Every page opens with one sentence saying how it stands; explanations
> are one tap away in an About sheet.

## How the console behaves

- It runs inside the portal's Server page. The portal frames the console and decides who may
  open the page at all; the console decides what each person may do inside it.
- A bar under the portal header (`src/ui/shell/`) holds the launcher (the current page;
  opens every page as tiles in their groups, with a search box, Enter opening the first match,
  and the last five pages visited in this browser); from 1024 px the pages as icons in their
  groups, each with a tooltip (groups that do not fit are left to the launcher); a count of
  things that need a person, which opens their list (Needs attention); and the live status as
  a dot and its words. Under 1024 px the current group's pages are one tap each (group tabs)
  instead of the icons. The look and the building blocks are the
  [design system](../reference/DESIGN-SYSTEM.md).
- **The console follows the portal's theme.** It is framed same-origin by the portal, so it
  reads the portal's `data-theme` (dark or light, set by the portal's theme toggle) when it
  opens and keeps in step when the toggle is flipped. Opened on its own, or if the portal's
  page cannot be read, it stays dark (`followParentTheme` in `src/ui/theme.ts`, tested in
  `test/ui-theme.test.ts`). The terminal screen and the recording player stay dark in both
  themes.
- **Pages load on first visit.** Only the Overview is in the first script; every other page
  is fetched the first time it is opened, behind a quiet "Opening the page" line, and the
  terminal pages alone carry the terminal library. A page already opened shows at once.
- **Needs attention** counts what the console already loads: failed services, a reboot the
  server asks for (`/var/run/reboot-required`) and security updates waiting, each linking to
  its page. The console reads `services` and `packages` once on opening and again every 10
  minutes while the tab is visible; data not loaded yet, or an agent that did not answer, adds
  nothing (the live status already says when the agent is down).
- `GET /api/me` returns the person's capabilities, the capability catalog and the route-table
  fingerprint. The console lists a page only when the person holds its capability
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
  doubling to at most 30. The pages that refresh on a timer (Processes, Metrics, Apps, Jobs,
  Timers, Restore tests, Recordings) skip refreshes while the tab is hidden. The Logs live tail
  and the Terminal stay connected.

## Pages

Twenty-two pages in five groups, by how often they are used (`PAGES` in `src/ui/pages.ts`). The
capability opens the page; the Worker and agent enforce it again on every call.

Every page has the same three layers (see the [design system](../reference/DESIGN-SYSTEM.md)):

- **Status** is one sentence under the title that says how the page stands. Its logic is a pure
  function in the page's view module (`src/ui/<page>-view.ts`), tested in a `test/ui-*.test.ts`.
- **Main** is the list, table, charts or form the page is for.
- **About** is a sheet opened by the info button in the header. It holds what the page and its
  numbers mean, written once for someone new. A person who knows the page never has to open it.

| Page | Group | Needs | Answers |
|---|---|---|---|
| Overview | Monitor | `host.view` | Is the server healthy right now? |
| Metrics | Monitor | `host.view` | How has it behaved over the last hour to 30 days? |
| Apps | Monitor | `host.view` | Are the apps and jobs healthy, and can I act on them? |
| Jobs | Monitor | `host.view` | Are the server jobs healthy, and when does each run next? |
| Services | Monitor | `host.view` | What has failed, and what runs? |
| Processes | Monitor | `host.view` | What is using the machine? |
| Packages | Maintain | `host.view` | Are updates or a reboot waiting? |
| Storage | Maintain | `host.view` | Is any mount filling? |
| Network | Maintain | `host.view` | Is the tunnel up, and what listens? |
| Timers | Maintain | `host.view` | What runs on a schedule, and when next? |
| Logs | Maintain | `logs.view` | What did the journal say? |
| Restore tests | Maintain | `host.view` | Do backups restore on the server? |
| Terminal | Operate | `terminal.ops` | A recorded shell |
| Files | Operate | `files.view` | Browse and change files |
| Alerts | Security | `security.view` | What did the audit pipeline flag? |
| Timeline | Security | `audit.view` | Who did what? |
| Recordings | Security | `sessions.replay` | Replay recorded terminal sessions |
| Posture | Security | `security.view` | Is the host hardened? |
| Log storage | Security | `security.view` | How much space do logs take, and how long are they kept? |
| Diagnostics | Admin | `host.view` | Is the plumbing healthy? |
| Access | Admin | `access.view` | Who may do what? |
| API | Admin | `api.raw` | Raw read-only JSON |

### Monitor

**Overview**

- Status: Live, with the uptime (which keeps counting) and the three load averages; or Stale,
  with the age of the last sample; or waiting for the first sample.
- Main: CPU, memory, disk and network in as four figures with five-minute sparklines (marked
  High from 70% and Very high from 90%, with an icon and words), then CPU and memory, disk read
  and write, and network in and out as three fixed-height charts on a fixed 300-sample window,
  so the newest sample sits at the right edge and the line never rescales. Values sit in
  fixed-width slots, so a new digit moves nothing.
- About: the host facts the agent reports (host name, operating system, kernel, architecture,
  CPUs, shape and region when known, agent version, uptime), available memory, swap and free
  disk, what each number means, and how it is measured.

**Metrics** (see [Metrics history](#metrics-history))

- Status: the range and the CPU and memory peaks in it.
- Main: range chips (1 h, 24 h, 7 d, 30 d); the recorder's own note as a banner when it is not
  healthy; then seven charts (CPU, memory, load average, disk space, disk I/O, network,
  processes) in a two-column grid from 1024 px, each with the range's numbers under it. Disk
  I/O and network show the peak of both directions. The page re-reads every minute.
- About: what is recorded, the recorder's status and coverage, storage used, retention, the
  width of a point per range, and how to read the charts.

**Apps**

- Status: how many apps run, whether any has issues, how the rest stand (paused, blocked,
  stopped), a job that needs attention, and the busy rule's verdict for jobs.
- Main: filter chips (All, Running, Issues, Public, Private, Jobs) with counts, and a search
  box. The Apps panel lists status, name, address, health, memory against its cap, CPU,
  restarts and the first problem, apps with issues first. The Jobs panel shows a card per job
  with the same controls as the Jobs page. A row opens the inspector sheet: controls, banners,
  unit, network, health check, resources and the allocation form.
- Controls follow the state. Start, Restart, Pause, Resume and Stop need `apps.control`; Block,
  Unblock and the inspector's Change allocation form (memory cap, CPU cap, CPU weight) need
  `apps.manage`; Deploy needs `apps.deploy`. Buttons the person does not hold stay visible but
  locked. A job card has the controls listed under Jobs.
- About: how to add an app (the deploy guide), what the status words mean, limits, public and
  private access, the busy rule, and who can do what.

**Jobs** (see [JOBS](JOBS.md))

- Status: whether every job is healthy, with four chips: the jobs by standing, the last 24
  hours, the next run, and what is in line now.
- Main: the runs that are running or waiting, with a live output link and Stop; a card per job
  (state, schedule in words and the next run, last run, the latest 24 results, limits, last
  success) with its controls; a history (today, 7 or 30 days) filtered by result, job and what started
  it, with each job's success rate, timings and a timeline; and "Could a job start now?", the
  busy rule read live (the last minutes of processor use against the mark, memory, pressure,
  slots). Opening a job or a run shows a sheet; a run shows its timing, steps, the secrets it
  was given (names) and its output, live while it runs.
- Run now, Stop, Restart, Pause and Resume need `jobs.run`; Block, Unblock and the inspector's
  Change limits and Change schedule need `jobs.manage`; a run's output needs `logs.view`. A job
  that takes input (the restore test) has no Run now: its card links to the Restore tests page.
  `?job=<name>` filters the history and `?run=<job>/<run>` opens a run.
- About: what a job is, how a run goes and ends, the busy rule with its numbers, a job's
  standing, the controls and their capabilities, limits and schedules, and what raises alerts.

**Services**

- Status: "All N services running", or the running, failed, restarting and not-running counts,
  which add up to the total.
- Main: failed services in their own panel, then every unit in a table with Failed, Running and
  All chips and a search box. A unit opens a sheet with its state, live properties,
  dependencies, journal and copyable commands. Restart, Start and Stop need `services.control`;
  protected units show none.
- About: what each unit state means, who may control, what protected means, and where the logs
  come from.

**Processes**

- Status: the process count with zombies and disk waits flagged, the busiest process and its
  share of one core, and the totals for CPU and memory. It says when updates are paused.
- Main: the top three by CPU and by memory, then a sortable, searchable table (command, user,
  PID, CPU, memory, state) with filter chips (Programs, Kernel threads, over 10% CPU, over
  50 MiB, Stuck, All), a user filter, list and tree views and a pause button. A row opens a
  sheet with every detail (parent, threads, start, full command with copy) and notices when
  the process ends. It re-reads every 5 seconds.
- About: the columns, the states, the filters and the tree.

### Maintain

**Packages**

- Status: the security updates and other updates waiting (security in amber), or that
  everything is up to date; whether a reboot is needed; when the agent last checked.
- Main: a Reboot required banner when the server asks for one; four counts (Installed,
  Security updates, Other updates, System); Refresh package lists and Upgrade every package for
  people with `packages.update`; then an Updates tab (security updates first, in their own
  group; name, from, to, a Security badge) and an Installed tab (a searchable table, loaded
  only when opened). Any package opens an inspector sheet (description, facts, depends on,
  required by, files) with back navigation.
- About: where the counts come from, what a security update is, what each button does, the
  reboot flag, and that the agent reports nothing about automatic updates.

**Storage**

- Status: names the fullest mount, on the worse of space or inodes (amber from 80%, red from
  90%), and says how many mounts are at those levels.
- Main: a meter for the fullest mount (and one for inodes when a mount reaches 80%), then every
  mount in one sortable table with space and inode bars, used, free, size, device, filesystem
  and options. Chips choose All, Partitions, Shared with /, or Memory.
- About: the limits, how usage is measured, inodes, mount options, and what the usual mounts
  hold.

**Network**

- Status: whether the tunnel is connected (red when down), then what listens beyond this
  server. SSH (22/tcp, reached through the tunnel) and the DHCP client (68/udp) are expected
  and named. Any other port listening beyond loopback is a warning that names each port: the
  cloud firewall, which the console cannot see, decides whether it is reachable.
- Main: a warning banner with a Show these ports button when such ports exist; then tabs for
  Interfaces (kind, state, addresses with copy, MTU, MAC), Listening ports (reach, protocol,
  address, usual use, owner; filters All, Public, Local, TCP, UDP; search) and Tunnel details.
- About: what the tunnel is for, what a public address means, how to read the tables, and how
  the data is collected.

**Timers**

- Status: how many timers there are, and which runs next ("due now" once a run has passed).
- Main: the next three in a compact panel, then every timer in a sortable, filterable table
  (timer, the unit it starts, next run, last run), each time with the exact time on hover. The
  list re-reads every minute so the relative times stay true.
- About: what a timer is, next and last run, what it starts, and how to read a calendar
  schedule.

**Logs**

- Status: what is shown (window, unit, priority, search, line count, "limit reached") or the
  live state: following, paused with the lines waiting, connecting, or stream closed.
- Main: a Live toggle and a refresh in the header; a search box, unit, priority and time window
  in a compact grid, with More filters (common units, line limit up to 2,000). Entries are one
  mono line each (time, priority in words, source, message); each opens a sheet with its own
  `journalctl` command, cursor and raw record. Export and Copy command stay. Login and sudo
  sources need `security.view`.
- About: the filters, Live, priorities, which sources need `security.view`, common units, how
  long entries are kept, and export.

**Restore tests** (see [RESTORE-TESTS](RESTORE-TESTS.md))

- Status: the running test's step, or the last result: passed (with its score), passed with
  notes, usable, not trustworthy, failed (with the failed gates), missed or cancelled; also
  something left behind on the server, a lab key not made, or the container not installed.
- Main: the running or last test as a step checklist with Cancel test (needs `restore.test`);
  past tests as a list, each opening its report in a sheet; and the test lab (container, lab
  key with its public half and a copy button, resource ceilings) in one panel that moves to the
  top when something is missing. A run's output needs `logs.view`. Tests are started from the
  backup console.
- About: what a test proves, the flow, steps A to J, the gates and scores, where the key must
  match, and the limits.

### Operate

**Terminal**

- Status: Live with the account and how long ago it opened, reconnecting, opening, ended, or
  no session open. People without a terminal capability see a note instead.
- Main: Open session or End session in the header; the account choice under it when the person
  holds more than one; the dark terminal in a framed panel with its state badge; open sessions
  to reattach (reattaching clears the screen first, and ending is guarded while the session
  runs). The sudo-capable account needs `terminal.admin` and a sign-in from the last 10
  minutes.
- About: certificates, recording, accounts, limits, reconnects, reattaching and colours.

**Files**

- Status: the breadcrumb of the folder.
- Main: a Places menu, parent folder, copy path, type a path, and a filter by name; the write
  bar in a folder where writing is allowed; and the folder as a sortable list. Tapping a file
  opens the Inspector sheet with its preview, find, download and the write actions the person
  holds. Download needs `files.download`; create, upload, rename and delete need `files.write`.
- About: what the page does, where changes are allowed, what is always refused, the limits and
  the keyboard shortcuts.

### Security

**Alerts**

- Status: "No alerts" for the day, or the count by severity (critical, warnings, notices).
- Main: a day picker and a searchable table, newest first (severity, kind, message, time); each
  alert opens the shared event sheet.
- About: every alert kind and where alerts come from.

**Timeline**

- Status: how many events, for which day, view, session and search word.
- Main: the day picker, view chips (Everything a person did, Commands, sudo, Config changes,
  Security, Logins, Service commands, Exits), search, and the event list with commands in mono.
  The session list sits behind a button. An event opens the shared event sheet.
- About: what the page shows, the event classes, retention, SSH sessions and sudo.

**Recordings**

- Status: how many sessions were recorded in the range, and when the latest started.
- Main: range chips (24 hours, 7 days, 30 days, 90 days), an account filter, and the session
  table (started, account, length, chunks, Replay). Opening a session shows the player at full
  width with a back button: the terminal (always dark), a range slider with a time readout,
  play, skips, speeds, skip idle, a taller terminal, exports, copy ID and keyboard shortcuts.
  The list stops polling while a recording is open.
- About: how sessions are recorded, the columns, replaying, retention, and who may replay.

**Posture**

- Status: how many checks pass and how many need a look, naming up to three.
- Main: counts, a Needs a look panel, then four tabs of scored checks (pass, warn or fail, each
  with its evidence): Baseline (SSH rules, updates, reboot, auth failures), Integrity (Lynis,
  AIDE, debsums), Accounts (login accounts, user ID 0, groups, sudoers, sessions) and Exposure
  (listeners; SSH is expected because it is reached through the tunnel). A tab shows how many
  of its checks need a look.
- About: how a check is scored, the SSH settings, where the data comes from, and the integrity
  tools.

**Log storage** (see [LOG-STORAGE](LOG-STORAGE.md))

- Status: the space logs use on the audit disk, the growth per day and the days to full (amber
  at 70% or under 30 days, red at 90% or under 7).
- Main: a meter for the disk; a table per kind of log with the retention ("Kept for") that can
  be edited (shortening asks for the typed word); a stored-per-day panel; and a closed Delete
  logs section (by date, by space, journal vacuum, each with a preview and the typed
  confirmation). The calls and capabilities are unchanged: `logs.purge`, `logs.vacuum` and
  `retention.set`.
- About: the audit disk, amber and red, growth, retention, where logs are stored, deleting,
  preview, vacuum, and what is recorded.

### Admin

**Diagnostics**

- Status: "All N checks pass", or which checks fail or need attention.
- Main: every check in one list under Platform (agent, Worker signing, tunnel, clock, audit
  pipeline, audit storage), External checks (each probe and certificate, with a filter and
  search) and Services (the platform units), failures first, each with a Pass, Warning or Fail
  badge and its evidence. A Reboot required banner shows only while the server reports it.
  Reboot sits in the closed Host controls section at the end and needs `host.reboot`. It is
  armed only while installed updates wait on a restart; otherwise it is greyed out and says why.
- About: what each check proves, how external checks decide, and the Host controls.

**Access**

- Status: personal grants (or expired ones that need a decision), and how many of the
  capabilities the signed-in person holds.
- Main: tabs for People (personal grants as a list, and the editor), Roles (a matrix that reads
  the saved policy's defaults) and Capabilities (by class; one opens a sheet with who holds it
  and what it unlocks). Editing needs `access.manage`. The rules are in
  [PERMISSIONS](../security/PERMISSIONS.md).
- About: capabilities and classes, roles, floors, personal grants, saving, and who enforces
  what.

**API**

- Status: read-only; pick a route.
- Main: a route picker grouped by the capability each route needs, a query box, Run, Copy, and
  the JSON in a framed block with its status, time and size. Routes that only change things
  are left out, because the Worker refuses a GET on them.
- About: what it does, what it cannot do, capabilities, the query, and the copy and time
  limits.

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
- One screen per page: `src/ui/screens/*.tsx`. What a page says and lists is a pure function in
  `src/ui/<page>-view.ts` (the status sentence, counts, filters, ordering), tested in
  a matching `test/ui-*.test.ts`; the screen only draws what it returns. Alerts and Timeline
  share `audit-view.ts`; Restore tests use `restore.ts`.
- The shell (top bar, group tabs, launcher, Needs attention): `src/ui/shell/`,
  `src/ui/attention.ts`; the theme: `src/ui/theme.ts`
- The `/api/me`, access and proxy routes: `src/http/router.ts`
- Metrics history: the ranges and answer in `contract/metrics-history.ts`; the recorder in
  `agent/src/recorder.ts`; the day files in `agent/src/history-store.ts`; downsampling in
  `agent/src/collectors/metrics-history.ts`; the page in `src/ui/screens/Metrics.tsx`

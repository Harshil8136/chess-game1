---
title: "Server Console Pages"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_code: [src/ui/pages.ts, src/ui/App.tsx, src/ui/screens, src/ui/me.ts, src/http/router.ts]
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

## Pages

Twenty pages, in sidebar order (`PAGES` in `src/ui/pages.ts`). The capability opens the
page; the Worker and agent enforce it again on every call.

| Page | Group | Needs | Shows |
|---|---|---|---|
| Overview | Host | `host.view` | Live meters, charts and host facts |
| Processes | System | `host.view` | Every process with its CPU and memory |
| Services | System | `host.view` | systemd services, state and logs; a service's detail page offers Restart, Start, Stop (needs `services.control`; protected services show no buttons) |
| Apps | System | `host.view` | Hosted apps: state, memory, health, restarts; Deploy and Restart need `apps.deploy` |
| Timers | System | `host.view` | Scheduled jobs: next and last run |
| Packages | System | `host.view` | Available updates, installed packages, dependencies; Update lists and Upgrade need `packages.update` |
| Storage | Resources | `host.view` | Filesystems, space and inodes |
| Network | Resources | `host.view` | Interfaces, listening ports, the tunnel |
| History | Resources | `host.view` | 24-hour and 7-day trends; the idle-reclaim check |
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

## Local preview

`npm run dev` opens an SSH forward to the agent and serves the console on a local port. It
signs with a dev key limited to `read`-class capabilities, so everything can be looked at and
nothing changed: downloads, file changes, actions and the terminal work only in the portal.
The preview offers only those capabilities, so the toolbar hides what the dev key cannot do.

## Key code paths

- Page list, groups, icons, capability per page: `src/ui/pages.ts`
- Capability gating and the route-table check: `src/ui/App.tsx`, `src/ui/me.ts`
- One screen per page: `src/ui/screens/*.tsx`
- The `/api/me`, access and proxy routes: `src/http/router.ts`

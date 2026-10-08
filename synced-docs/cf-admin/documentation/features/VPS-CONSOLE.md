---
title: "VPS Console (cf-vps, embedded)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-08
verified_against: [code]
owner: harshil
related_code: [src/lib/vps-proxy.ts, src/lib/vps-audit.ts, src/lib/vps-section.ts, src/pages/dashboard/vps/[...section].astro, src/lib/security/csp.ts, src/lib/audit.ts, migrations/0059_vps_console_page.sql, src/components/admin/users/access-editor/, src/lib/access-center/, src/lib/dal/VpsAccessRepository.ts, test/vps-gateway.test.ts, test/vps-chain.test.ts, test/vps-access.test.ts, test/access-center-api.test.ts]
related_docs: [BACKUP-CONSOLE.md, ACCESS-CENTER.md, ../program/cf-backup/15-restore-tests.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../operations/OPERATIONS.md]
tags: [vps, cf-vps, gateway, websocket, terminal, audit, csp]
---

# VPS Console

> **TL;DR (non-technical):** The Server page in the admin portal shows the
> server's own console inside the page: services, packages, apps, files, who
> may do what, and a terminal in the browser. The console runs in a separate,
> private service (cf-vps) with no public address; the portal is the only way
> to reach it, checks who you are first, and records every change anyone makes
> and every terminal anyone opens.

## 1. What it is

`/dashboard/vps` is the admin layout plus one frame. The frame loads
`/dashboard/vps/app/`, which is served by the cf-vps Worker **through
cf-admin**: cf-admin is the gateway, cf-vps is the app. It is built the same
way as the [Backup Console](BACKUP-CONSOLE.md), in its own files, so neither
integration can break the other. cf-vps owns every screen inside the frame and
decides what each person may do there; cf-admin decides who may open the page
at all, and passes cf-vps a trustworthy statement of who is asking.

Every console section has its own address: `/dashboard/vps/services` frames
`/dashboard/vps/app/services`. The page,
`src/pages/dashboard/vps/[...section].astro`, knows only the path *shape*
(`src/lib/vps-section.ts`): a section of lowercase letters and hyphens, and at
most one more segment. Anything else is a 404 inside the admin layout. The
`/app` prefix is internal; the address bar never shows it.

After each navigation the console posts `{ type: 'cf-vps:route', v: 1, path,
label }` to the page. The page accepts it only from its own frame and origin,
and only for a path of that shape, then updates the address bar with
`history.replaceState` and the tab title ("Services · Server").

**Restore tests** (`/dashboard/vps/restore`, since 2026-10-08, built and not yet
run) is one of these sections: it shows the server's lab key, its resource
ceilings, a test's live steps, its report and its server log. A test is started
from cf-backup's Restore tests section, which stages the copy here and starts the
`restore_test` job, a sealed container with no network that is deleted when the
test ends. Staging and starting need cf-vps's `restore.test` capability (a floor:
Owner and Vendor support only) and a sign-in from the last 10 minutes. The design
is cf-backup's plan of record [15](../program/cf-backup/15-restore-tests.md).

When the deployment has no `VPS` binding (local development), the page says
"cf-vps is not connected" instead of showing a dead frame.

## 2. The gateway contract

Every request under `/dashboard/vps/app/` passes the normal auth pipeline
(Access, session, role re-check, PLAC) and then the gateway,
`src/pages/dashboard/vps/app/[...path].ts`, which:

| Rule | What happens |
|---|---|
| Page access | The person must hold the `/dashboard/vps` key itself (§4) |
| Path | Only a plain path under `/dashboard/vps/app/`: a doubled slash, a backslash, or an encoded slash, backslash or dot is a 404 and never reaches cf-vps |
| Query string | Forwarded exactly as received (cf-vps signs the query it passes on, so it must not change); the path rules above apply to the path only |
| Headers | Only `Accept`, `Accept-Language`, `Content-Type`, `Range` and `If-None-Match` are forwarded (plus the handshake headers of a terminal, §5). The session cookie, `Authorization`, the Access assertion and any `X-Vps-*` the browser sent never reach cf-vps |
| Identity | The gateway adds `x-vps-actor` (§3) and `x-vps-request-id`, built from the session |
| Same origin | Every change (POST, PUT, PATCH, DELETE) must come from this site; so must every terminal (§5) |
| Read-only | A read-only role is refused every change and every terminal |
| Body | Buffered, at most 1 MiB. **An upload larger than that must be sent in parts**; a larger request is refused with 413 before anything reaches cf-vps |
| Time | cf-vps has 65 s to send the answer's headers (cf-vps gives the host up to 60 s on its slowest reads and answers 504 itself after that). After that nothing is timed: the body streams for as long as it takes, so the live metrics and log streams (`text/event-stream`) stay open, and a download (up to 200 MB) is never buffered |
| Failure | A missing binding, a timeout or an unreachable cf-vps gets a small "Server console unavailable" page, or the console's JSON error (`{ ok: false, code, message }`) on its API; the rest of the portal is unaffected. The browser is told fixed words, never the runtime's error |
| Answer | Passed through, status, body and headers, minus `Set-Cookie` and `x-vps-audit` — including a download's `Content-Type`, `Content-Disposition` (`filename*=UTF-8''…`) and `Content-Length`, and cf-vps's own capability refusal (`403 { code: 'forbidden', need: '<capability>' }`) |
| Audit | One `admin_audit_log` row per change and per terminal (§6) |

`src/lib/vps-proxy.ts` is the only code that calls the binding. It has no HTTP
fallback and no shared secret, because cf-vps must never have a public
address. `Last-Event-ID` is not forwarded: a stream that needs to resume says
where in its query string.

## 3. The actor header

`x-vps-actor` is unpadded base64url of UTF-8 JSON, the same version-1 schema
the backup console receives, with two optional fields appended:

| Field | Meaning |
|---|---|
| `v` | `1` |
| `kind` | `"user"` |
| `userId`, `email`, `role` | From the session; the email is lower-cased, the role is the canonical role |
| `signedInAt` | The time Cloudflare Access issued the sign-in (its `iat`), as ISO 8601 — not the session's creation time, so a console can ask for a fresh sign-in before a dangerous action |
| `requestId` | A new UUID per request; also `x-vps-request-id` and the audit row's correlation id |
| `country` | Optional. Cloudflare's two-character country code for the request (`cf-ipcountry`); left out when absent or malformed |
| `ipHash` | Optional. The session's HMAC-SHA256 IP hash, the same value the portal's audit rows carry, so a cf-vps record and a portal row can be matched. It is computed once at sign-in, so it describes the sign-in address, not necessarily this request's. Left out when the session has none |

cf-vps reads the seven version-1 fields and ignores any other key, so
`country` and `ipHash` are inert until cf-vps chooses to read them; there is
no `sessionId`.

cf-vps may trust this header **only** because the `VPS` service binding is the
only way to reach it. The gateway builds the outgoing headers from nothing, so
a header of the same name sent by a browser is dropped, never forwarded.

## 4. Permissions and the page row

Migration `migrations/0059_vps_console_page.sql` adds the registry row:
`/dashboard/vps`, label **Server**, icon `terminal`, stored role
`super_admin` (the canonical admin tier: admins and above), category `system`,
sort 90 — right after Backups in the same sidebar section. It can be granted to
or denied from any person on the Users page like any other page, and a grant
reaches a signed-in person within about a minute.

The gateway and the page do **not** use the ordinary inherited page decision.
PLAC resolves an absent key through its longest ancestor, and `/dashboard` is a
staff-level row, so a person whose access map was computed before `0059` was
applied would otherwise inherit "allow" for a root console. Both ask
`mayUseConsole` (`src/lib/vps-proxy.ts`) instead: the `/dashboard/vps` key
itself must be in the person's map and be allowed, or the person must be the
owner or vendor support, who pass as everywhere in PLAC. So while the
migration is not applied, and for up to an hour after it (until each map
refreshes), only the owner and vendor support can open the console. That is
deliberate: it fails closed.

A read-only role never gets a change or a terminal through, even with the page
granted. What each permitted person may do inside the console is cf-vps's own
model, enforced there.

### Inside the console: capabilities on the Users page

cf-vps divides the console into capabilities (host views, logs, files, audit,
terminal, actions, access). Its policy is one row in this portal's D1,
`admin_portal_settings` key `vps:access`: what each role holds by default, plus
personal grants and denies keyed by email, each optionally with an end date and
a reason. Owner and vendor support hold everything; a few capabilities (audit,
session replay, reboot, admin terminal, managing access) can never be granted
to anyone else.

The policy is managed in two places. cf-vps checks and stores every change
(floors, the one-year limit, the rule that someone must keep the right to manage
access) and each change becomes an activity-log row:

- the console's own **Access** page (every role and person at once), through
  the gateway;
- the **Access Center**, a person's Access page on the Users page
  ([ACCESS-CENTER](ACCESS-CENTER.md)), which replaced the separate Server
  console section on 2026-10-02 and became one editor for every system on
  2026-10-03. Its Server console card lists each capability with its default
  role and the reason it is on or off; a switch per capability, and the grant's
  end date and note, are saved with the person's other changes after a review. A holder of `access.manage` may change anything
  but a floor; since 2026-10-02 a holder of the new `access.delegate` (owner,
  vendor support and admin by default) may hand out or take away what they hold
  themselves, for people strictly below them. These calls do not go through the
  gateway: cf-admin's server calls cf-vps over the binding with the actor and an
  `x-vps-target` header naming the person, with the role from this portal's
  database, and the gateway never forwards that header from a browser. The
  Access Center writes its own activity-log row for each save;
- the **page registry** (`/dashboard/debug/pages`, vendor support), which lists
  every capability under the Server page and can move one capability's default
  role (`POST /api/access/role`: that role and every role above it hold it,
  personal grants kept, floors never).

Changing someone's role changes their console capabilities at once, because
cf-vps reads the role from each request. Deleting a user removes their personal
grant in the same step as their page overrides
(`src/lib/dal/VpsAccessRepository.ts`), and bumps the policy revision so an
Access editor opened before the deletion cannot save it back. An address
invited again later starts from its role.

## 5. The terminal

cf-vps runs its terminal over ordinary requests. Nothing depends on WebSockets passing through Workers VPC:

- `POST …/api/terminal/open` starts a session. It is audited as `terminal.open`.
- `GET …/api/terminal/stream` streams the output as server-sent events.
- `POST …/api/terminal/input`, `/resize` and `/close` carry keystrokes, window sizes and the end of the session.

Those three are still changes: same-origin, and refused for read-only roles. They write **no** audit row each (`UNAUDITED` in the gateway): the session was audited when it opened, and everything typed in it is recorded on the server.

The gateway also accepts a WebSocket handshake, for a future WebSocket transport: a GET carrying a GET carrying
`Upgrade: websocket`. The gateway accepts one **only** under
`/dashboard/vps/app/api/terminal/`; anywhere else it is refused with 400
(`upgrade_refused`) and nothing is sent. An upgrade is treated as a change:

1. **Origin.** The pipeline's CSRF check skips GET, and any web page can start
   a handshake, so the gateway requires an `Origin` header equal to the
   request's own origin; a missing or foreign one is refused with 403.
2. **Read-only** roles are refused with 403.
3. **Audit.** Every terminal opened writes a `terminal.open` row (§6), whether
   cf-vps accepted it or not; the row carries cf-vps's status.
4. **Handshake headers.** Only for a terminal, `Upgrade`, `Connection`,
   `Sec-WebSocket-Key`, `Sec-WebSocket-Version`, `Sec-WebSocket-Protocol` and
   `Sec-WebSocket-Extensions` are forwarded as well.
5. **Passthrough.** When cf-vps answers `101`, the gateway returns a `101`
   carrying cf-vps's own socket, which the runtime connects to the browser.
   The security-header middleware (`src/lib/security/csp.ts`) returns a `101`
   untouched, because rebuilding it would drop the socket. A refusal from
   cf-vps (any other status) is passed through as an ordinary answer. A `101`
   answering a request that asked for no upgrade is treated as a bad answer.

The 65-second limit covers the handshake only; an open terminal is not timed
by cf-admin.

## 6. Audit

cf-vps answers every change with a one-line `x-vps-audit` summary: an action
and `key=value` fields. The gateway maps the action onto a cf-admin verb, module
`vps`, target type `vps_console` (`src/lib/vps-audit.ts`):

| cf-vps action | Audit verb |
|---|---|
| `service.restart`, `service.start`, `service.stop` | `vps_service_control` |
| `packages.update`, `packages.upgrade` | `vps_package_update` |
| `host.reboot` | `vps_host_reboot` |
| `app.deploy`, `app.restart`, `app.rollback` | `vps_app_deploy` |
| `app.start`, `app.stop`, `app.pause`, `app.resume` | `vps_app_control` |
| `app.block`, `app.unblock` | `vps_app_block` |
| `app.resources` (target `<app>:<memory>:<cpu %>:<weight>`) | `vps_app_resources` |
| `job.run` | `vps_job_run` |
| `job.stop`, `job.restart`, `job.pause`, `job.resume` | `vps_job_control` |
| `job.block`, `job.unblock`, `job.limits` (target `<job>:<limits>` or `<job>:reset`), `job.schedule` (target `<job>:<pattern>` or `<job>:repo`) | `vps_job_manage` |
| `restore.stage`, `restore.start`, `restore.cancel` | `vps_restore_test` |
| `files.upload`, `files.mkdir`, `files.rename`, `files.delete` | `vps_file_change` |
| `access.save` | `vps_access_change` |
| `terminal.open` | `vps_terminal_open` |
| `logs.purge`, `logs.vacuum` | `vps_logs_purge` |
| `retention.set` | `vps_retention_change` |

Restore tests have a verb of their own: staging a backup copy's files on the
server (`restore.stage`), starting the test (`restore.start`) and cancelling it
(`restore.cancel`) are all `vps_restore_test`, so every step that put a backup
copy on the server is one filter. cf-backup's side of the same test is
`backup_restore_test` ([Backup Console](BACKUP-CONSOLE.md) §4).

For a terminal the gateway supplies `terminal.open` itself when cf-vps sends no
header. The row holds the person, method, path (no query string), status,
request id (also the row's correlation id), the session's IP hash and the
summary — never the request body, and never the value of a sensitive field
(`token`, `password`, `api_key` and the like are stored as `[REDACTED]`). A
missing or unknown action is recorded as `vps_change` with the summary
"unrecognised action" and raises a Sentry warning at most once an hour per
action.

Reads are not audited here, and a file download is a read (a GET). If a
download should leave a portal row, cf-vps must make it a POST, as the backup
console does.

When cf-admin itself failed the request, the row's `delivered` field says what
is known: `false` ("not delivered") only when the request certainly never left
cf-admin (no binding, body over the cap, a refused path or upgrade, or the
browser disconnected before the body was read); `'unknown'` ("outcome
unknown") when cf-vps may have received it (a timeout, a dropped connection,
an answer cf-admin could not use). The auth pipeline also writes its usual
`page_mutation_attempt` row for a POST, PUT, PATCH or DELETE, so each of those
leaves two rows; a terminal, being a GET, leaves one.

## 7. Framing

The portal refuses to be framed everywhere else (`X-Frame-Options: DENY`,
`frame-ancestors 'none'`). Responses under `/dashboard/vps/app/` — like those
under `/dashboard/backup/app/`, and only those — carry `SAMEORIGIN` and
`frame-ancestors 'self'` (`FRAMEABLE_PREFIXES` in `src/lib/security/csp.ts`).
A policy cf-vps sets is kept alongside the portal's, so it can only narrow what
is allowed. `test/csp.test.ts` fails if any other path loses `DENY`.

## 8. Failure behaviour

| Situation | What people see | Where it is recorded |
|---|---|---|
| No `VPS` binding | Page: "cf-vps is not connected" | — |
| Page key not in the person's map | Page: "You do not have access to the server console" (403); gateway: 403 | — |
| cf-vps slow (> 65 s to answer) | "Server console unavailable" (504) inside the frame | Observability every time, Sentry once per isolate |
| cf-vps unreachable | Same, 502 | Same |
| cf-vps refuses (e.g. a missing capability: `403`, `need`) | cf-vps's own answer, unchanged | cf-vps; for a change or a terminal, the audit row carries the status |
| Terminal from another site, or by a read-only role | 403, nothing sent | Observability warning |

## 9. Operator steps

1. Deploy cf-vps **before** any cf-admin deploy that carries the `VPS` binding
   — a deploy that binds a Worker that does not exist fails. Every push to
   cf-admin's `main` deploys, so merge this only after cf-vps exists.
2. Release cf-admin with `npm run release`, which applies migration `0059`
   before the code (see [release-and-rollback](../runbooks/release-and-rollback.md)).
   A push alone deploys the code without the migration; the console then stays
   closed to everyone but the owner and vendor support (§4) until it is applied.
3. Open `/dashboard/vps` once and confirm the console loads, then open the
   terminal and confirm one `vps_terminal_open` row in the audit log.

Admins see the page within an hour of the release (their access maps refresh
hourly); the owner and vendor support see it at once.

## 10. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-10-08 | claude | §6's verb table against `src/lib/vps-audit.ts` (`VPS_AUDIT_VERBS`, 36 actions with the job controls of 92d42dc; `test/vps-audit.test.ts` passes); §1's Restore tests paragraph against cf-vps's `contract/capabilities.ts`, `contract/actions.ts`, its page list and its Worker proxy (the fresh sign-in on `restore/stage`) | §6 and the Restore tests paragraph match. Not re-checked: every other section. Restore tests have not run on the server |
| 2026-09-30 | claude | Built in the `feat/vps-console` worktree: `npm run verify`, `npm run types:check`, `node scripts/migrations_manifest.mjs --check`; the gateway, proxy, audit, section, page and full-middleware-chain suites (`test/vps-*.test.ts`) run in workerd, where the 101 and its WebSocket are the real runtime objects. Checked against cf-vps at `c4e2664`: its actor parser (`x-vps-actor`, v1, extra keys ignored), its base path, and the contract items for query strings, downloads, event streams, `/dashboard/vps/app/api/me` and capability refusals, each pinned by a test here. Live D1 read of `admin_pages` for the sort order and the `/dashboard` row | Matches this document. Not deployed; no browser check yet (owner step); the console's own screens are cf-vps's |

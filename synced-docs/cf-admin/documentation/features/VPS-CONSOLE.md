---
title: "VPS Console (cf-vps, embedded)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-16
verified_against: [code]
owner: harshil
related_code: [src/lib/vps-proxy.ts, src/pages/dashboard/vps/app/[...path].ts, src/lib/access-changes/notify.ts, src/lib/users/manage-apply.ts, src/lib/approvals/retention.ts, test/two-person-rule.test.ts, src/lib/vps-audit.ts, src/lib/vps-section.ts, src/lib/vps-notice.ts, src/lib/vps-notice-record.ts, src/components/admin/vps/ServerNotice.tsx, src/pages/api/vps/notice.ts, test/vps-notice.test.ts, src/pages/dashboard/vps/[...section].astro, src/lib/security/csp.ts, src/lib/audit.ts, migrations/0059_vps_console_page.sql, src/components/admin/users/access-editor/, src/lib/access-center/, src/lib/dal/VpsAccessRepository.ts, test/vps-gateway.test.ts, test/vps-chain.test.ts, test/vps-access.test.ts, test/access-center-api.test.ts]
related_docs: [../specs/2026-10-11-server-access-notice.md, ../specs/2026-10-16-two-person-rule.md, BACKUP-CONSOLE.md, ACCESS-CENTER.md, ../program/cf-backup/15-restore-tests.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../operations/OPERATIONS.md]
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

The frame is allowed three browser features and no others
(`allow="fullscreen; clipboard-read; clipboard-write"`): the console's Terminal
uses them for its full screen mode and its Copy and Paste buttons.

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

**The access notice** (since 2026-10-11). The first time a person opens the
Server page in a sign-in, a pop-up headed "Authorized access only" says who owns
and pays for the server (on a card with his email address), that only people the vendor authorized may use it,
that activity is monitored and recorded, and that unauthorized use may lead to
legal action. The console's frame is not rendered until they choose **I agree**;
**Leave** goes to the Overview. Both answers go to `POST /api/vps/notice`, which
writes one Audit Log row (§6) and, for an acceptance, keeps the notice's version
in the session, so it lasts until the session ends. The words live in
`src/lib/vps-notice.ts`; a change to them is a new version, which everyone
accepts again. The gateway holds the console too (§2). Why each sentence says
what it says, and the limits:
[the notice's design](../specs/2026-10-11-server-access-notice.md).

## 2. The gateway contract

Every request under `/dashboard/vps/app/` passes the normal auth pipeline
(Access, session, role re-check, PLAC) and then the gateway,
`src/pages/dashboard/vps/app/[...path].ts`, which:

| Rule | What happens |
|---|---|
| Page access | The person must hold the `/dashboard/vps` key itself (§4) |
| Access notice | A request that opens the console itself (a GET whose `Sec-Fetch-Dest` is `document`, `iframe` or `frame`) needs a session that accepted the current access notice (§1). Without it a frame gets a short "accept the notice" page (403, `notice_required`) and a tab is sent to the matching Server page (303), which shows the notice. The console's own reads and files are not held. *Since 2026-10-16 (permissions item #38)* every change and every terminal is held too, with 403 `notice_required` as JSON, so a change made without opening the console, or from a console left open past a new sign-in, does nothing until the notice is accepted |
| Path | Only a plain path under `/dashboard/vps/app/`: a doubled slash, a backslash, or an encoded slash, backslash or dot is a 404 and never reaches cf-vps |
| Query string | Forwarded exactly as received (cf-vps signs the query it passes on, so it must not change); the path rules above apply to the path only |
| Headers | Only `Accept`, `Accept-Language`, `Content-Type`, `Range` and `If-None-Match` are forwarded (plus the handshake headers of a terminal, §5). The session cookie, `Authorization`, the Access assertion and any `X-Vps-*` the browser sent never reach cf-vps |
| Identity | The gateway adds `x-vps-actor` (§3) and `x-vps-request-id`, built from the session. Once `CONSOLE_SIGNING_KEY` is set (permissions item #33), it also adds `x-vps-signature` over those headers (and over `x-vps-target`, which only the Access Center sends, §4), and cf-vps with the same key answers nothing without it, the terminal's WebSocket included ([CONSOLE-SIGNATURE](CONSOLE-SIGNATURE.md)) |
| Same origin | Every change (POST, PUT, PATCH, DELETE) must come from this site; so must every terminal (§5) |
| Read-only | A read-only role (Viewer) is refused every change and every terminal with 403 `read_only`, before anything is sent |
| Second person | *Since 2026-10-16 (permissions item #36).* A `retention.set` (how long the server keeps a log) from someone cf-vps gives `retention.manage` is held here when another active Owner or Vendor support could approve it: after a recent sign-in (else 403 with `need: 'fresh_sign_in'`), it waits on the Users page and the console gets `202 { ok: false, code: 'second_person', message }`, which Log storage shows as a notice. It reaches cf-vps only once approved, sent as the approver. A body the hold cannot read, or a person without the capability, passes on as before, and cf-vps refuses it itself ([USER-MANAGEMENT](USER-MANAGEMENT.md) §6.3) |
| Body | Buffered, at most 1 MiB. **An upload larger than that must be sent in parts**; a larger request is refused with 413 before anything reaches cf-vps |
| Time | cf-vps has 65 s to send the answer's headers (cf-vps gives the host up to 60 s on its slowest reads and answers 504 itself after that). After that nothing is timed: the body streams for as long as it takes, so the live metrics and log streams (`text/event-stream`) stay open, and a download (up to 200 MB) is never buffered. A live stream that cf-vps breaks off (the agent restarted, the tunnel reconnected) ends as a finished stream, which the console reopens by itself, and is logged once as the warning `vps.gateway.stream_lost` with how long it lived; it used to be logged as the request's error, "Network connection lost." (2026-10-08). A download that breaks off still fails, so a truncated file never looks whole |
| Failure | A missing binding, a timeout or an unreachable cf-vps gets a small "Server console unavailable" page, or the console's JSON error (`{ ok: false, code, message }`) on its API; the rest of the portal is unaffected. The browser is told fixed words, never the runtime's error |
| Answer | Passed through, status, body and headers, minus `Set-Cookie` and `x-vps-audit` — including a download's `Content-Type`, `Content-Disposition` (`filename*=UTF-8''…`) and `Content-Length`, and cf-vps's own capability refusal (`403 { code: 'forbidden', need: '<capability>' }`) |
| Audit | One `admin_audit_log` row per change and per terminal opened (§6); a terminal's typing, resizing, closing and live socket write none (§5) |

`src/lib/vps-proxy.ts` is the only code that calls the binding. It has no HTTP
fallback, because cf-vps must never have a public address. Its one shared
secret is the optional signing key, which proves the actor came from this
portal rather than from another Worker given a binding to cf-vps. `Last-Event-ID` is not forwarded: a stream that needs to resume says
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

cf-vps divides the console into capabilities (host views, logs, files, security
and audit, services, packages, apps and jobs, restore tests, log storage, the
terminal, and access), listed in `cf-vps/contract/capabilities.ts`. Its policy is
one row in this portal's D1, `admin_portal_settings` key `vps:access`: what each
role holds by default, plus personal grants and denies keyed by email, each
optionally with an end date (at most a year) and a note. Owner and vendor support
hold everything by default. Eight capabilities are **floors** (`FLOOR_CAPABILITIES`):
the audit timeline (`audit.view`), session replay (`sessions.replay`), reboot
(`host.reboot`), the admin terminal (`terminal.admin`), managing access
(`access.manage`), log retention (`retention.manage`), deleting logs
(`logs.purge`) and restore tests (`restore.test`). Only Owner and Vendor support
ever hold a floor; it can never be granted to anyone else, even for a while.

- **A grant belongs to one account** (since 2026-10-16, permissions item #35). A
  grant saved from the Access Center carries the person's account id, and
  cf-vps counts it for nobody else (`grantFor` in `cf-vps/src/access/policy.ts`):
  a later account with the same email starts from its role. A grant saved from
  the console's own Access page keeps the id it has; one never saved through the
  Access Center follows the email.
- **Powers given for a while** (since 2026-10-16, permissions item #22, cf-vps
  `14b2d7a`). A person can ask for one capability on Settings → Your access, and
  it is decided on Users → Access requests
  ([PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §10.3). An
  approved one is kept in their grant as `temporary`, one `{ until, note? }` per
  capability, at most 90 days ahead: it counts until its own end whatever the
  grant's end date, a deny still beats it, and a floor can never be one.

The policy is managed in the places below. cf-vps checks and stores every change
(floors, the one-year and 90-day limits, the rule that Owner or Vendor support
must keep the right to manage access, and that the person saving does not lock
themselves out of it) and each change becomes an activity-log row:

- the console's own **Access** page (every role and person at once), through
  the gateway. Since 2026-10-15 (permissions item #18) the gateway also emails
  each `access.save` that changed something to the sign-in alert list, after the
  answer, with its number of changes but not whose
  (`noteAccessChanges` in `src/lib/access-changes/notify.ts`); the alert policy
  can make that one summary a day or nothing
  ([PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §10.4);
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
  database and (since 2026-10-16) their account id, to which cf-vps binds the
  grant it saves; the gateway never forwards that header from a browser. The
  Access Center writes its own activity-log row for each save;
- the **page registry** (`/dashboard/debug/pages`, vendor support), which lists
  every capability under the Server page and can move one capability's default
  role (`POST /api/access/role`: that role and every role above it hold it,
  personal grants kept, floors never).

Changing someone's role changes their console capabilities at once, because
cf-vps reads the role from each request. Removing a person on Users (which waits
for a second person when another Owner or Vendor support could approve it,
[USER-MANAGEMENT](USER-MANAGEMENT.md) §6.3) removes their server-console grant
and, since 2026-10-15, their backup-console grant, along with their page
overrides (`removeVpsGrant` and `removeBackupGrant` in
`src/lib/dal/VpsAccessRepository.ts`, called from `src/lib/users/manage-apply.ts`).
Each removal bumps that policy's revision, so an Access editor opened before the
removal cannot save the grant back, and an address invited again later starts
from its role. The same step blocks the Email API tokens the person made
([EMAIL-API-ACCESS](EMAIL-API-ACCESS.md) §3).

## 5. The terminal

A terminal session has one live connection, a WebSocket, and a fallback over
ordinary requests (cf-vps's own Console document describes both):

- `POST …/api/terminal/open` starts a session. It is audited as `terminal.open`.
- `GET …/api/terminal/socket` with `Upgrade: websocket` is the session's live
  connection: output, typing and window sizes all travel on it.
- The fallback, when the socket cannot open: `GET …/api/terminal/stream` streams
  the output as server-sent events, and `POST …/api/terminal/input`, `/resize`
  and `/close` carry keystrokes, window sizes and the end of the session.

`socket`, `input`, `resize` and `close` are still changes: same-origin, and
refused for read-only roles. They write **no** audit row each (`UNAUDITED` in the
gateway): the session was audited when it opened, everything typed in it is
recorded on the server, and the socket is opened again on every reconnect.

The gateway accepts a WebSocket handshake (a GET carrying
`Upgrade: websocket`) **only** under
`/dashboard/vps/app/api/terminal/`; anywhere else it is refused with 400
(`upgrade_refused`) and nothing is sent. An upgrade is treated as a change:

1. **Origin.** The pipeline's CSRF check skips GET, and any web page can start
   a handshake, so the gateway requires an `Origin` header equal to the
   request's own origin; a missing or foreign one is refused with 403.
2. **Read-only** roles are refused with 403.
3. **Audit.** An upgrade to any other terminal path writes a `terminal.open`
   row (§6), whether cf-vps accepted it or not; the row carries cf-vps's
   status. The `socket` upgrade writes none, as above.
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

The gateway writes one activity-log row for every change it passes on (or tries
to) and every terminal it opens; a terminal's typing, resizing, closing and live
socket write none (§5). cf-vps answers each change it made with a one-line
`x-vps-audit` summary: an action and `key=value` fields. The gateway maps the
action onto a cf-admin verb, module `vps`, target type `vps_console`
(`src/lib/vps-audit.ts`):

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
(`token`, `password`, `api_key` and the like are stored as `[REDACTED]`).

cf-vps stamps the header only on a change it made. An error answer with no
header is recorded as `vps_change` with the summary `refused: HTTP <status>`
(a 4xx: bad input, a missing capability, a fresh sign-in, a conflict) or
`failed: HTTP <status>` (a 5xx), and a 5xx also raises a Sentry warning
(`vps.gateway.change_failed`) at most once an hour per status. A success with
no header, or any header naming an action cf-admin does not know, is recorded
as `vps_change` with the summary "unrecognised action" and raises a Sentry
warning (`vps.gateway.unrecognised_audit`) at most once an hour per action.
Until 2026-10-08 every refusal was reported as unrecognised (Sentry
CF-ADMIN-1V).

The access notice (§1) has two verbs of its own, written by cf-admin rather
than mapped from cf-vps: `vps_notice_accept` and `vps_notice_leave`, target
type `vps_notice`, target id the notice's version. Each row keeps the version
and a fingerprint of the words, the page, the session's start and sign-in
times, Cloudflare's reading of the place and network, a keyed hash of the
address (never the address), and the device; the fields are listed in the
[notice's design](../specs/2026-10-11-server-access-notice.md) §5.

A `retention.set` made through the second person (§2) is recorded by cf-admin when the approver
approves it, with the same verb, the approver as the person, the summary ending "(asked by …,
approved by …)" and `secondPerson: { approvalId, askedBy, approvedBy }` in the row's context. One
made at once because nobody else could approve it carries `secondPerson: 'none available'`. The
waiting and the decision have rows of their own (`second_person`, module `vps`).

Reads are not recorded here, and a file download is a read (a GET), so it leaves
no portal row. The backup gateway records the two reads cf-backup marks with its
audit header ([Backup Console](BACKUP-CONSOLE.md) §4); this gateway records none.

When cf-admin itself failed the request, the row's `delivered` field says what
is known: `false` ("not delivered") only when the request certainly never left
cf-admin (no binding, body over the cap, a refused path or upgrade, or the
browser disconnected before the body was read); `'unknown'` ("outcome
unknown") when cf-vps may have received it (a timeout, a dropped connection,
an answer cf-admin could not use). The auth pipeline also writes its usual
`page_mutation_attempt` row for a POST, PUT, PATCH or DELETE, so each of those
leaves two rows; a terminal upgrade, being a GET, leaves at most one (§5).

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
| Access notice not accepted in this sign-in | Page: the notice; gateway: "Accept the server access notice" (403) in a frame, or a redirect to the Server page in a tab | The answer, when given: `vps_notice_accept` or `vps_notice_leave` |
| A read-only role with the page granted | The notice, whose answer the portal refuses (read-only roles make no changes), so the console stays shut | `viewer_write_blocked` |
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
| 2026-10-16 | claude | §2's Identity, Read-only and Audit rows against the gateway (`src/pages/dashboard/vps/app/[...path].ts`: `isReadOnly`, `UNAUDITED`, the `access.save` email); §4 against `cf-vps/contract/capabilities.ts` (`CAPABILITIES`, `FLOOR_CAPABILITIES`), `cf-vps/src/access/policy.ts` (`temporary`, `grantFor`, `can`), `cf-vps/src/access/save.ts` (the one-year and 90-day limits, the two lock-out rules), `src/lib/access-changes/notify.ts` (`consoleScreenChange`), `src/lib/users/manage-apply.ts` and `src/lib/dal/VpsAccessRepository.ts`; §6's opening and reads paragraph against the gateway and cf-vps's Files screen (a download is a GET link) | The floors were five and are eight; §4 now says a grant is bound to an account, what a power given for a while is, that an Access page save is emailed and that removing a person also removes the backup grant and blocks their Email API tokens. Not re-checked: §1, §3, §5, §7 to §9; no test run (shared checkout) |
| 2026-10-16 | claude | §2's Identity row and the paragraph after the table against `src/lib/console-signature.ts` and `vpsBinding` (`src/lib/vps-proxy.ts`), and `cf-vps/src/gateway/signature.ts` (checked before the actor, so before a terminal upgrade); `test/console-signature.test.ts` and `cf-vps/test/signature.test.ts` pass | Not re-checked: every other section; a signed request in production (the key is not set yet) |
| 2026-10-16 | claude | §2's Access notice row (#38: changes and terminals held) against the gateway (`isChange && !vpsNoticeAccepted`) and the new case in `test/vps-gateway.test.ts`; `test/vps-chain.test.ts` passes with a session that accepted the notice | Not re-checked: every other section |
| 2026-10-16 | claude | §2's Second person row and §6's paragraph on approved retention changes (permissions item #36) against the gateway (`src/pages/dashboard/vps/app/[...path].ts`), `src/lib/approvals/retention.ts` (`retentionAsked`, `holdRetention`, `runRetention`) and cf-vps's Log storage screen (`retentionRefusal`); `test/two-person-rule.test.ts`, `test/vps-gateway.test.ts` and `test/vps-chain.test.ts` pass | Not re-checked: every other section; not yet seen on a phone |
| 2026-10-16 | claude | §4's `x-vps-target` sentence against `consoleTarget` (`src/lib/access-center/profile.ts`) and `cf-vps/src/gateway/target.ts` and `cf-vps/src/access/policy.ts` (`grantFor`); `test/access-center-api.test.ts` asserts the id is sent | Not re-checked: every other section |
| 2026-10-16 | claude | §1's frame features against the iframe in `src/pages/dashboard/vps/[...section].astro` (pinned by `test/vps-page.test.ts`); §5 against the gateway's `UNAUDITED` (now with `socket`) and cf-vps's live terminal connection (`cf-vps/src/agent/proxy.ts`, `cf-vps/agent/src/server.ts`); the new case in `test/vps-gateway.test.ts` passes | §5 matches. Not re-checked: every other section; the live connection not yet seen on a phone |
| 2026-10-11 | claude | §1's access notice paragraph, §2's Access notice row, §6's notice verbs and §8's two new rows, written with the code: `src/pages/dashboard/vps/[...section].astro`, the gateway, `src/pages/api/vps/notice.ts`, `src/lib/vps-notice-record.ts`; `test/vps-notice.test.ts`, `test/vps-gateway.test.ts` and `test/vps-page.test.ts` pass | Those parts match. Not re-checked: every other section; not yet seen on a phone |
| 2026-10-12 | claude | §1's access notice paragraph against `src/lib/vps-notice.ts` and `src/components/admin/vps/ServerNotice.tsx` after the notice's rewrite (version `2026-10-12`) | Heading and owner card updated. Not re-checked: every other section |
| 2026-10-08 | claude | §2's Time row against `endStreamCleanly` in `src/lib/vps-proxy.ts` (event streams only; a download still fails) and the cf-vps agent's stream intervals (`agent/src/main.ts`: a sample a second, a ping every 15 s); the new cases in `test/vps-proxy.test.ts` | The Time row matches. Not re-checked: every other section |
| 2026-10-08 | claude | §6's paragraph on error answers against the gateway (`answered()`, the `vps.gateway.change_failed` report) and cf-vps's agent (`written()` and `actions/run` stamp `x-vps-audit` only on success); the new cases in `test/vps-gateway.test.ts` | §6 matches. Not re-checked: every other section |
| 2026-10-08 | claude | §6's verb table against `src/lib/vps-audit.ts` (`VPS_AUDIT_VERBS`, 36 actions with the job controls of 92d42dc; `test/vps-audit.test.ts` passes); §1's Restore tests paragraph against cf-vps's `contract/capabilities.ts`, `contract/actions.ts`, its page list and its Worker proxy (the fresh sign-in on `restore/stage`) | §6 and the Restore tests paragraph match. Not re-checked: every other section. Restore tests have not run on the server |
| 2026-09-30 | claude | Built in the `feat/vps-console` worktree: `npm run verify`, `npm run types:check`, `node scripts/migrations_manifest.mjs --check`; the gateway, proxy, audit, section, page and full-middleware-chain suites (`test/vps-*.test.ts`) run in workerd, where the 101 and its WebSocket are the real runtime objects. Checked against cf-vps at `c4e2664`: its actor parser (`x-vps-actor`, v1, extra keys ignored), its base path, and the contract items for query strings, downloads, event streams, `/dashboard/vps/app/api/me` and capability refusals, each pinned by a test here. Live D1 read of `admin_pages` for the sort order and the `/dashboard` row | Matches this document. Not deployed; no browser check yet (owner step); the console's own screens are cf-vps's |

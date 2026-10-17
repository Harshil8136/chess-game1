---
title: "Backup Console (cf-backup, embedded)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-08
verified_against: [code]
owner: harshil
related_code: [src/lib/backup-proxy.ts, src/lib/backup-audit.ts, src/pages/dashboard/backup/app/[...path].ts, src/lib/access-changes/notify.ts, src/lib/dal/VpsAccessRepository.ts, src/pages/dashboard/backup/[...section].astro, src/lib/backup-section.ts, src/workers/scheduled-backup-tick.ts, src/lib/security/csp.ts, src/lib/jobs/registry.ts, src/lib/jobs/tiers.ts, src/lib/jobs/budgets.ts, src/lib/audit.ts, src/lib/auth/stages/bootstrap.ts, migrations/0057_backup_runs.sql]
related_docs: [CRON-CONTROL.md, VPS-CONSOLE.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../operations/OPERATIONS.md, ../program/cf-backup/02-admin-integration-contract.md, ../program/cf-backup/13-access-control.md, ../program/cf-backup/15-restore-tests.md]
tags: [backups, cf-backup, gateway, cron, audit, csp]
---

# Backup Console

> **TL;DR (non-technical):** The Backups page in the admin portal shows the
> backup system's own console inside the page. The backup system (cf-backup) is
> a separate, private service with no public address; the portal is the only way
> to reach it, checks who you are first, and records every change anyone makes
> and every backup file anyone opens to read. The portal also nudges it on a timer, so scheduled backups start on time and
> its alerts are emailed to the alert recipients set in the console (Settings →
> Alerts), with each email's delivery reported back. Since 2026-10-04 the nudge
> comes when the backup system says it next has work: every five minutes while
> a backup runs, at least once an hour otherwise, and within five minutes of
> any change made in the console.

## 1. What it is

`/dashboard/backup` is the admin layout plus one frame. The frame loads
`/dashboard/backup/app/`, which is served by the cf-backup Worker **through
cf-admin**: cf-admin is the gateway, cf-backup is the app (plan of record
[02](../program/cf-backup/02-admin-integration-contract.md)). cf-backup owns
every screen inside the frame and decides what each person may do there
([13](../program/cf-backup/13-access-control.md)); cf-admin decides who may open
the page at all.

Every console section has its own address. `/dashboard/backup/runs` frames
`/dashboard/backup/app/runs`, and `/dashboard/backup/runs/<ref>` opens that run,
where `<ref>` is its run key or, for a run that never got one, its `backup_runs`
id. `/dashboard/backup/files/<folder>` opens one folder of the backups bucket,
encoded into that one segment by cf-backup. So a section can be bookmarked,
reloaded or opened in a new tab. The page,
`src/pages/dashboard/backup/[...section].astro`, knows only the path *shape*
(`src/lib/backup-section.ts`): a section of lowercase letters and hyphens, and
at most one more segment. Anything else is a 404 inside the admin layout. The
`/app` prefix is internal; the address bar never shows it.

After each navigation the console posts `{ type: 'cf-backup:route', v: 1, path,
label }` to the page. The page accepts it only from its own frame and origin,
and only for a path of that shape, then updates the address bar with
`history.replaceState` and the tab title ("Runs · Backups"). The frame's own
history carries Back and Forward.

**Restore tests** (`/dashboard/backup/restore`, since 2026-10-08, built and not yet
run) is one of these sections: it rebuilds a chosen backup copy on the cf-vps
server in a sealed container and checks it. Its page talks to both consoles from
the phone, cf-backup's and cf-vps's ([VPS Console](VPS-CONSOLE.md)), each through
its own gateway; cf-admin adds nothing but the two audit verbs (§4). The design is
plan of record [15](../program/cf-backup/15-restore-tests.md).

When the deployment has no `BACKUP` binding (local development), the page says
"cf-backup is not connected" instead of showing a dead frame.

## 2. The request path

Every request under `/dashboard/backup/app/` passes the normal auth pipeline
(Access, session, role re-check, PLAC) and then the gateway,
`src/pages/dashboard/backup/app/[...path].ts`, which:

| Rule | What happens |
|---|---|
| Page access | The `/dashboard/backup` key itself must be allowed for the person (`mayUseBackupConsole`, `src/lib/backup-proxy.ts`), or the answer is 403 `forbidden`: nested paths inherit it, and a key missing from their access map is a deny, never decided by the staff-level `/dashboard` row (2026-10-15; until then it was). The Access Center, access requests and the role preview ask the same check (`CONSOLES.backup.mayOpen`, 2026-10-16; `test/console-doors.test.ts`) |
| Path | Only a plain path under `/dashboard/backup/app/` (`isConsolePath`): a doubled slash, a backslash, or an encoded slash, backslash or dot is a 404 and never reaches cf-backup |
| Headers | Only `Accept`, `Accept-Language`, `Content-Type`, `Range` and `If-None-Match` are forwarded. The session cookie, `Authorization`, the Access assertion and any `X-Backup-*` the browser sent never reach cf-backup |
| Identity | The gateway adds `x-backup-actor` (who, their role, and when they last signed in) and `x-backup-request-id`, built from the session. Once `CONSOLE_SIGNING_KEY` is set (permissions item #33), it also adds `x-backup-signature`, and cf-backup with the same key answers nothing without it ([CONSOLE-SIGNATURE](CONSOLE-SIGNATURE.md)) |
| Read-only | A read-only role (Viewer) is refused every change with 403 `read_only`, before anything is sent; it can still look |
| Same origin | Every change (POST, PUT, PATCH, DELETE) must come from this site, or it is refused with 403 `cross_origin` |
| Body | Buffered, at most 1 MiB; a larger request is refused with 413 before anything reaches cf-backup |
| Time | cf-backup has 10 s to start answering; after that the answer streams for as long as it takes (downloads are never buffered) |
| Failure | A missing binding, a timeout or an unreachable cf-backup gets a small "Backup console unavailable" page, or the console's JSON error on its API; the rest of the portal is unaffected |
| Answer | Passed through, minus any `Set-Cookie` and cf-backup's `x-backup-audit` |
| Audit | One `admin_audit_log` row per change, and per read that hands over a file's contents (§4) |

`src/lib/backup-proxy.ts` is the only code that calls the binding. It has no
HTTP fallback, because cf-backup must never have a public address. Its one
shared secret is the optional signing key, which proves the actor came from this
portal rather than from another Worker given a binding to cf-backup.

## 3. Identity and "fresh sign-in"

The actor carries `signedInAt`: the time Cloudflare Access issued the sign-in
assertion (its `iat`), recorded when the session is created
(`src/lib/auth/stages/bootstrap.ts`). It is deliberately **not** the session's
creation time: cf-admin can re-create a session from an assertion that is hours
old without anyone signing in again. cf-backup refuses key actions, downloads of
backup data, and preparing, unlocking or configuring a restore test unless that
sign-in is at most 10 minutes old (`reauth_required`), and asks the person to
sign out and back in — signing out also ends the Access session, so the next
sign-in is a real one. A session without that time falls back to its creation
time. Since 2026-10-17, while Vendor support holds a testing pass, cf-admin sends
the current time instead, so these checks pass for that session until the pass
ends; nothing changed in cf-backup
([PERMISSIONS-SYSTEM §10.5](../architecture/PERMISSIONS-SYSTEM.md)).

**Per-person access from the Users page (2026-10-03).** A person's backup
capabilities are also shown and changed in the Access Center on their Access
page ([ACCESS-CENTER](ACCESS-CENTER.md)), and the page registry
(`/dashboard/debug/pages`) lists every backup capability under the Backups page,
where vendor support can move one capability's default role (cf-admin's
`PATCH /api/system/console-features`, which calls cf-backup's `access/role`).
Those calls do not go through this
gateway: cf-admin's server calls cf-backup over the binding with the actor and an
`x-backup-target` header naming the person, with the role from this portal's
database and (since 2026-10-16, permissions item #35) their account id, to which
cf-backup binds the grant it saves (`grantFor` in `cf-backup/src/access/policy.ts`):
a later account with the same email starts from its role. The gateway never
forwards that header from a browser. An owner or
vendor can change anything but a floor; an admin with cf-backup's
`access.delegate` can hand out what it holds to people below it. Each save writes
a `backup_config_change` activity-log row marked as made through the Access
Center.

**Asking for a permission** (since 2026-10-16, permissions item #22). Someone who
needs one backup capability can ask for it on Settings → Your access; the request
is decided on Users → Access requests, like a request for a page. An approval
always ends, at most 90 days ahead. cf-admin writes it to cf-backup over the
binding as the person deciding, and cf-backup keeps it in the person's grant as a
power given for a while (`temporary`, one `{ until, note? }` per capability): it
counts until its own end, a deny still beats it, and a floor can never be one. The
rules for who may ask and decide are in
[PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §10.3.

**Removing a person** on Users also removes their backup grant
(`removeBackupGrant`, `src/lib/dal/VpsAccessRepository.ts`, since 2026-10-15) and
bumps the policy's revision, so an address invited again later starts from its
role and an Access editor opened before the removal cannot save the grant back.

## 4. Audit

cf-backup answers every change with a one-line `x-backup-audit` summary; the
gateway maps its action onto a cf-admin verb, module `backup`
(`src/lib/backup-audit.ts`):

| cf-backup action | Audit verb |
|---|---|
| `run.dispatch`, `run.drill`, `run.bypass-cooldown`, `diagnostics.run` | `backup_run` |
| `run.cancel` | `backup_cancel` |
| `schedule.edit`, `config.edit`, `access.edit`, `secrets-calendar.edit`, `alerts.dismiss` | `backup_config_change` |
| `keys.rotate`, `keys.reveal` | `backup_key_action` |
| `run.download`, `activity.export`, `run.annotate` | `backup_data_access` |
| `runs.prune` | `backup_prune` |
| `restore.test` (`op=prepare`, `op=unlock`, `op=sample`, `op=file`, `op=download`) | `backup_restore_test` |

Actions without a verb of their own reuse one, so they never raise the
"unrecognised action" warning: confirming a recovery kit and recording a
restore proof are `keys.rotate` (`op=confirm-kit`, `op=restore-proof`), a
download from the Files section is `run.download` with `via=files`, and a
check run (Run now → Check only) is `run.drill`. Restore tests (since
2026-10-08, built, not yet run) have a verb of their own, so "who unlocked which
backup copy, and when" is one filter: preparing a test, unlocking its copy with
the Vault key (or recording a recovery-kit unlock, `key=kit`), taking the live
sample and filing the report are all `restore.test`; their settings and pinning
the server's lab key are `config.edit` with `op=restore-tests` or `op=lab-key`.

**Reads that hand over content** (since 2026-10-16, permissions item #20). Two
reads stamp the same header from their handlers, and the gateway records them
like a change: a file preview from the Files section (`run.download via=preview`,
`backup_data_access`) and fetching one of a restore test's encrypted files
(`restore.test op=download`, `backup_restore_test`). On a read the gateway
accepts only those two actions (`RECORDED_READS`); any other header on a read is
ignored and raises no warning. Every other read writes nothing.

**Access changes are emailed** (since 2026-10-15, permissions item #18). When
cf-backup accepts an `access.edit` through the gateway (a save on the console's
own Access screen), the gateway also tells the sign-in alert list, after the
answer (`noteAccessChanges` in `src/lib/access-changes/notify.ts`). cf-backup's
audit line says how the change was made, not whose or which, so the email names
the Backup console and points to the activity log. The alert policy chooses one
email per save, one summary a day, or none
([PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §10.4). Saves made
through the Access Center or an approved request (§3) are emailed by those paths
instead, when they give the person something they did not hold.

The row holds the person, method, path (no query string), status, request id
(also the row's correlation id) and the summary — never the request body, and
never the value of a sensitive field. A missing or unknown action is recorded
as `backup_run` with the summary "unrecognised action" and raises a Sentry
warning.

When cf-admin itself failed the request, the row's `delivered` field says what
is actually known: `false` ("not delivered") only when the request certainly
never left cf-admin — the `BACKUP` binding was unbound, the body was over the
size cap, the path was refused, or the browser disconnected before the body
could be read. Every other failure — a timeout waiting for cf-backup, or
cf-backup answering with something cf-admin could not use — is recorded as
`'unknown'` ("outcome unknown"), because cf-backup may have received the
request and acted on it even though cf-admin never saw a usable answer. A
delivered change records `true`. The auth pipeline also writes its usual
`page_mutation_attempt` row, so each change leaves two rows.

## 5. Framing

The portal refuses to be framed everywhere else (`X-Frame-Options: DENY`,
`frame-ancestors 'none'`). Responses under `/dashboard/backup/app/` — and only
those — carry `SAMEORIGIN` and `frame-ancestors 'self'`
(`FRAMEABLE_PREFIX` in `src/lib/security/csp.ts`). cf-backup's own security
policy is kept alongside the portal's, so it can only narrow what is allowed.
`test/csp.test.ts` fails if any other path loses `DENY`.

## 6. The backup scheduler job

The account's five scheduled triggers are all in use, so cf-backup has none of
its own. The `backup-tick` job rides the portal's five-minute tick
(`src/workers/scheduled-backup-tick.ts`), but since 2026-10-04 is not invoked on
every one (Contract A, [`../program/cf-backup/02-admin-integration-contract.md`](../program/cf-backup/02-admin-integration-contract.md)):
each tick answer carries cf-backup's `nextTickAt`, the job reports it as its
next due time, and Cron Control skips the call until then, never for more than
an hour ([`CRON-CONTROL.md`](CRON-CONTROL.md) §4a). The page shows it as
**Sleeping until HH:MM**. Any change made through the console (every method but
`GET` and `HEAD` through the gateway) wakes the job, so the next five-minute
tick calls. A missing or malformed `nextTickAt`, or a tick that left an alert or
a delivery report unsettled, means a call on the next tick, as before. When it
runs:

1. it calls cf-backup's internal tick as the `backup-tick` system actor (25 s);
2. cf-backup starts any scheduled backup that is due, checks running ones and
   returns the alerts it wants sent;
3. the job writes each alert's `email_audit_logs` row (status `queued`, so it
   shows in the Email Portal's queue logs like any other send), puts the alert
   on the email queue and acknowledges the ones that were queued. An alert that
   is not acknowledged is offered again on the next tick, and the email
   consumer drops a repeat, so a warning is sent at least once and not twice.
   The sender is cf-backup's configured alert sender (an address on
   madagascarhotelags.com, checked again here) or the consumer's default;
4. on a later tick, for the acknowledged alerts cf-backup asks about, the job
   reads their `email_audit_logs` rows and reports each delivery back
   (`POST /internal/alerts/delivery`), so the console's Alerts section shows
   delivered, bounced or failed instead of "queued".

Who gets what is cf-backup's settings, not cf-admin's: the recipients (Settings
→ Alerts; none by default, so alerts wait until someone is added) and, per kind,
an email at once, a daily digest, or the dashboard only (Settings →
Notifications). Notices of key actions and data downloads go to the same
recipients.

It is tier `essential` (never shed automatically) and costs this Worker no
database rows when it succeeds. It never throws: failures are logged and
reported to Sentry at most once an hour. It appears on `/dashboard/cron` like
every job — it can be paused, throttled or run by hand. If it stops, a weekly
safety net in GitHub still runs a full backup on Mondays when none has
succeeded for eight days (never while no backup key exists), and a daily
workflow in cf-backup's repository (`tick-deadman.yml`) fails when the tick has
not run for an hour (since 2026-10-04 it allows for a tick resting until its
stored `nextTickAt`, per cf-backup's own record), so GitHub's own
failed-workflow email warns through a path the tick does not own.

## 7. The `backup_runs` table

cf-backup keeps one row per backup, restore drill or prune attempt in
`backup_runs` (`migrations/0057_backup_runs.sql`). **Owner decision
2026-09-23: exactly one new table was accepted for cf-backup.** The migration's
header records why no existing store fits (an atomic single-active-run lock,
unique schedule slots, and per-person history cannot live in one settings row).
cf-admin's own code never reads or writes it; cf-backup and its runner do.

## 8. Failure behaviour

| Situation | What people see | Where it is recorded |
|---|---|---|
| No `BACKUP` binding | Page: "cf-backup is not connected"; job: skipped | Job log |
| cf-backup slow (> 10 s to answer) | "Backup console unavailable" (504) inside the frame | Observability every time, Sentry once per isolate |
| cf-backup unreachable | Same, 502 | Same |
| cf-backup refuses (e.g. already running) | cf-backup's own message | cf-backup; the audit row carries the status |
| Tick fails | Nothing in the page; the next tick retries | Job log; Sentry once an hour |
| Email queue missing or refusing | Alerts held; offered again next tick | Job log; Sentry once an hour |
| An alert email bounces or fails at the provider | The console's Alerts section shows it failed, after the next delivery report | `email_audit_logs` (the Email Portal) |

## 9. Operator steps

1. Deploy cf-backup **before** any cf-admin deploy that carries the `BACKUP`
   binding — a deploy that binds a Worker that does not exist fails.
2. Release cf-admin with `npm run release`, which applies migration `0057`
   before the code (see [release-and-rollback](../runbooks/release-and-rollback.md)).
3. After the release, regenerate `database/schema.snapshot.sql`
   (`node scripts/d1_schema_snapshot.mjs`) and commit it.
4. Nothing to re-seed for `/dashboard/cron`: since 2026-10-09 the job's description is
   its `about` in `src/lib/jobs/registry.ts` and reaches the page with the deploy
   ([`CRON-CONTROL.md`](CRON-CONTROL.md) §7). Until then this step re-seeded the job catalog.
5. Open `/dashboard/backup` once and confirm the console loads.

Admins see the page within an hour of the release (their access maps refresh
hourly); the owner and vendor support see it at once.

## 10. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-10-17 | claude | §3's testing pass sentence against `userActor` in `src/lib/backup-proxy.ts` and `confirmedAt` in `src/lib/auth/fresh-sign-in.ts`; `test/testing-pass.test.ts` passes | The sentence. The rest of the document not re-read |
| 2026-10-16 | claude | §2 against the gateway `src/pages/dashboard/backup/app/[...path].ts` and `src/lib/backup-proxy.ts` (`isConsolePath`, `isReadOnly`, `MAX_REQUEST_BYTES`); §3 against `cf-backup/src/lib/fresh.ts` and its callers, `cf-backup/src/access/policy.ts` (`temporary`, `grantFor`, `can`), `src/lib/access-center/registry.ts` and `src/lib/users/manage-apply.ts` with `src/lib/dal/VpsAccessRepository.ts`; §4 against `src/lib/backup-audit.ts`, `src/lib/access-changes/notify.ts` and cf-backup's `access.edit` stamps (`cf-backup/src/api/access.ts`, `access-person.ts`) | Added the Path, Read-only (403 `read_only`) and Body rows; §3 now names every fresh-sign-in step, asking for a permission (#22) and what removing a person removes; §4 says an `access.edit` is emailed (#18). The TL;DR names the recorded reads. The Page access row names the Access Center's door check, which used the inherited page decision until this pass (`src/lib/access-center/consoles.ts`; `test/console-doors.test.ts` passes). Not re-checked: §1, §5 to §9; a signed request in production |
| 2026-10-16 | claude | §2's Identity row and the paragraph after the table against `src/lib/console-signature.ts` and `backupBinding` (`src/lib/backup-proxy.ts`), and `cf-backup/src/gateway/signature.ts`; `test/console-signature.test.ts` and `cf-backup/test/signature.test.ts` pass | Not re-checked: every other section; a signed request in production (the key is not set yet) |
| 2026-10-16 | claude | §3's `x-backup-target` sentence against `consoleTarget` (`src/lib/access-center/profile.ts`) and `cf-backup/src/gateway/target.ts` and `cf-backup/src/access/policy.ts` (`grantFor`); `test/access-center-api.test.ts` asserts the id is sent | Not re-checked: every other section |
| 2026-10-16 | claude | §4's recorded reads against `src/pages/dashboard/backup/app/[...path].ts` (`RECORDED_READS`) and `cf-backup/src/api/files.ts` (`previewFile`) and `cf-backup/src/api/restore-tests.ts` (`getRestoreTestFile`); `test/backup-gateway.test.ts`, `cf-backup/test/files-api.test.ts` and `cf-backup/test/restore-tests.test.ts` pass | Not re-checked: every other section |
| 2026-10-15 | claude | §2's page-access rule against `src/lib/backup-proxy.ts` (`mayUseBackupConsole`) and `src/pages/dashboard/backup/app/[...path].ts`; `test/backup-gateway.test.ts` refuses staff on a map without the Backups key | Not re-checked: every other section |
| 2026-10-09 | claude | §9 step 4 against `src/lib/jobs/registry.ts` and `src/lib/jobs/read-model.ts` after the Scheduled Jobs rebuild; `scripts/lib/cron-catalog.mjs` deleted | Step 4 no longer re-seeds; the catalog path left `related_code`. Not re-checked: every other section |
| 2026-10-08 | claude | §4's verb table against `src/lib/backup-audit.ts` (`BACKUP_AUDIT_VERBS`, 17 actions; `test/backup-audit.test.ts` passes), and added the two actions the table had been missing (`diagnostics.run`, `alerts.dismiss`); §1's Restore tests paragraph against cf-backup's uncommitted routing and `restore-tests` routes | §4 and the Restore tests paragraph match. Not re-checked: every other section. Restore tests have not run in production |
| 2026-10-04 | claude | `src/workers/scheduled-backup-tick.ts` (`nextTickDue`, the settled-tick rule), `src/pages/dashboard/backup/app/[...path].ts` (rule 8, the wake), `src/lib/jobs/control.ts`; `test/backup-tick.test.ts`, `test/backup-gateway.test.ts`; cf-backup's record `docs/records/2026-10-04-resource-usage-tick.md` for its side | The TL;DR and §6 describe Contract A. Not re-checked: every other section, and cf-backup's dead-man script itself |
| 2026-09-23 | claude | Built and verified in the `feat/cf-backup-console` worktree (chunk CB-2): `npm run verify`, `npm run types:check`, `node scripts/migrations_manifest.mjs --check` | See the CB-2 chunk record §11. Not yet deployed; no browser check yet (owner step) |
| 2026-09-24 | claude | On `main` and pushed (Workers Builds deploys every push; cf-backup first, then cf-admin), with the section page, the alert sender, migration `0058` (applied by the release pipeline) and the delivery reports since. Re-read against the code at this commit: `src/lib/backup-section.ts` (path shape), `src/lib/backup-audit.ts` (the verb map), `src/workers/scheduled-backup-tick.ts` (steps 1–4 of §6) | Matches. The console's own screens are cf-backup's (its repository); a browser pass over them stays an owner step |

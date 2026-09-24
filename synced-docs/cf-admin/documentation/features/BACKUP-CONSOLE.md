---
title: "Backup Console (cf-backup, embedded)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-09-24
verified_against: [code]
owner: harshil
related_code: [src/lib/backup-proxy.ts, src/lib/backup-audit.ts, src/pages/dashboard/backup/[...section].astro, src/lib/backup-section.ts, src/workers/scheduled-backup-tick.ts, src/lib/security/csp.ts, src/lib/jobs/registry.ts, src/lib/jobs/tiers.ts, src/lib/jobs/budgets.ts, src/lib/audit.ts, src/lib/auth/stages/bootstrap.ts, migrations/0057_backup_runs.sql, scripts/lib/cron-catalog.mjs]
related_docs: [CRON-CONTROL.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../operations/OPERATIONS.md, ../program/cf-backup/02-admin-integration-contract.md, ../program/cf-backup/13-access-control.md]
tags: [backups, cf-backup, gateway, cron, audit, csp]
---

# Backup Console

> **TL;DR (non-technical):** The Backups page in the admin portal shows the
> backup system's own console inside the page. The backup system (cf-backup) is
> a separate, private service with no public address; the portal is the only way
> to reach it, checks who you are first, and records every change anyone makes.
> Every five minutes the portal also nudges it, so scheduled backups start on
> time and its alerts are emailed to the alert recipients set in the console
> (Settings → Alerts), with each email's delivery reported back.

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

When the deployment has no `BACKUP` binding (local development), the page says
"cf-backup is not connected" instead of showing a dead frame.

## 2. The request path

Every request under `/dashboard/backup/app/` passes the normal auth pipeline
(Access, session, role re-check, PLAC) and then the gateway,
`src/pages/dashboard/backup/app/[...path].ts`, which:

| Rule | What happens |
|---|---|
| Page access | `/dashboard/backup` must be allowed for the person — nested paths inherit it; an unknown key is a deny |
| Headers | Only `Accept`, `Accept-Language`, `Content-Type`, `Range` and `If-None-Match` are forwarded. The session cookie, `Authorization`, the Access assertion and any `X-Backup-*` the browser sent never reach cf-backup |
| Identity | The gateway adds `x-backup-actor` (who, their role, and when they last signed in) and `x-backup-request-id`, built from the session |
| Same origin | Every change (POST, PUT, PATCH, DELETE) must come from this site |
| Time | cf-backup has 10 s to start answering; after that the answer streams for as long as it takes (downloads are never buffered) |
| Failure | A missing binding, a timeout or an unreachable cf-backup gets a small "Backup console unavailable" page, or the console's JSON error on its API; the rest of the portal is unaffected |
| Answer | Passed through, minus any `Set-Cookie` |
| Audit | One `admin_audit_log` row per change (§4) |

`src/lib/backup-proxy.ts` is the only code that calls the binding. It has no
HTTP fallback and no shared secret, because cf-backup must never have a public
address.

## 3. Identity and "fresh sign-in"

The actor carries `signedInAt`: the time Cloudflare Access issued the sign-in
assertion (its `iat`), recorded when the session is created
(`src/lib/auth/stages/bootstrap.ts`). It is deliberately **not** the session's
creation time: cf-admin can re-create a session from an assertion that is hours
old without anyone signing in again. cf-backup refuses key actions and
encrypted downloads unless that sign-in is at most 10 minutes old, and asks the
person to sign out and back in — signing out also ends the Access session, so
the next sign-in is a real one. Sessions created before 2026-09-23 fall back to
their creation time until they expire (24 h).

## 4. Audit

cf-backup answers every change with a one-line `x-backup-audit` summary; the
gateway maps its action onto a cf-admin verb, module `backup`
(`src/lib/backup-audit.ts`):

| cf-backup action | Audit verb |
|---|---|
| `run.dispatch`, `run.drill`, `run.bypass-cooldown` | `backup_run` |
| `run.cancel` | `backup_cancel` |
| `schedule.edit`, `config.edit`, `access.edit`, `secrets-calendar.edit` | `backup_config_change` |
| `keys.rotate`, `keys.reveal` | `backup_key_action` |
| `run.download`, `activity.export`, `run.annotate` | `backup_data_access` |
| `runs.prune` | `backup_prune` |

Actions without a verb of their own reuse one, so they never raise the
"unrecognised action" warning: confirming a recovery kit and recording a
restore proof are `keys.rotate` (`op=confirm-kit`, `op=restore-proof`), a
download from the Files section is `run.download` with `via=files`, and a
check run (Run now → Check only) is `run.drill`.

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
(`src/workers/scheduled-backup-tick.ts`):

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
not run for an hour, so GitHub's own failed-workflow email warns through a
path the tick does not own.

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
4. Re-seed the cron catalog so `/dashboard/cron` shows the job's description:
   `node scripts/seed_cron_control.mjs --apply --remote --actor=<your sign-in email>`.
5. Open `/dashboard/backup` once and confirm the console loads.

Admins see the page within an hour of the release (their access maps refresh
hourly); the owner and vendor support see it at once.

## 10. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-23 | claude | Built and verified in the `feat/cf-backup-console` worktree (chunk CB-2): `npm run verify`, `npm run types:check`, `node scripts/migrations_manifest.mjs --check` | See the CB-2 chunk record §11. Not yet deployed; no browser check yet (owner step) |
| 2026-09-24 | claude | On `main` and pushed (Workers Builds deploys every push; cf-backup first, then cf-admin), with the section page, the alert sender, migration `0058` (applied by the release pipeline) and the delivery reports since. Re-read against the code at this commit: `src/lib/backup-section.ts` (path shape), `src/lib/backup-audit.ts` (the verb map), `src/workers/scheduled-backup-tick.ts` (steps 1–4 of §6) | Matches. The console's own screens are cf-backup's (its repository); a browser pass over them stays an owner step |

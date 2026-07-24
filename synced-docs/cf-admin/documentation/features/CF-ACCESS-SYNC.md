---

title: "CF Access Group Sync — Architecture, Root-Cause Fix & Hardening"
status: active
audience: [ai, technical, operator]
last_verified: 2026-07-24
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/auth/cf-access-sync.ts, src/lib/auth/cf-access-sync-log.ts, src/lib/auth/cf-access-reconcile.ts, src/pages/api/users/manage.ts, src/pages/api/users/cf-resync.ts, src/pages/api/users/cf-access-audit.ts, src/workers/cf-entry.ts]
related_docs: [USER-MANAGEMENT.md, ../reference/SYNC-SYSTEM-REVIEW.md, ../operations/OPERATIONS.md]
tags: [cf-access, zero-trust, whitelist, sync, incident, runbook]
---

# CF Access Group Sync — Architecture, Root-Cause Fix & Hardening

> **TL;DR (non-technical):** When someone is added or removed in the Users tab,
> the app also has to tell Cloudflare's Zero Trust login gate about it, so
> Cloudflare blocks anyone not on the list. A bug meant that could silently
> fail — Cloudflare would reject the update, but the app reported success
> anyway, with no error shown anywhere. This document explains the bug, the
> fix, and the safety net now in place so a failure is always visible and
> self-corrects within 5 minutes.

## Context / Scope

This document covers the **Supabase → Cloudflare Access Group synchronization
system** that keeps the CF Zero Trust edge whitelist in sync with the admin
portal's `admin_authorized_users` table. It does **not** cover:
- The RBAC role hierarchy or user CRUD lifecycle itself — see
  [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md).
- The generic CMS/Astro revalidation outbox pattern this system's durability
  layer is modeled on — see [`../reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md).
- CF Access JWT verification for inbound requests (`cloudflare-access.ts`) —
  that is identity verification, unrelated to this write-path sync.

## Incident Summary (2026-07-24)

A user reported: adding an entry in the Users tab did not reliably appear in
the Cloudflare Zero Trust whitelist, **and the app gave no error, warning, or
flag when this happened**, despite `CF_API_TOKEN_ZT_WRITE` being correctly
configured. A full investigation (code read + live Supabase/D1 queries)
found the root cause and several structural gaps, detailed below.

### Root cause

`syncCfAccessGroup()` (`src/lib/auth/cf-access-sync.ts`) called the Cloudflare
Access Groups API and checked **only the HTTP status** (`res.ok`) on every
request. Cloudflare's API frequently returns **HTTP 200 with a body of
`{"success": false, "errors": [...]}`** — name collisions, malformed `include`
rules, plan/entitlement limits. The old code logged `"Successfully updated
access group"` and returned `{success: true}` in this exact scenario, without
ever parsing the response body. This is the precise failure mode that
produced "no error, but the whitelist didn't actually update."

A secondary bug compounded it: the "does our group already exist" list call
had no pagination, so on an account with more than one page of Access Groups
the existing group could be missed, triggering an accidental duplicate-create
attempt — whose rejection was then also swallowed by the primary bug.

### Why no warning appeared, even though a warning path existed

`manage.ts` already had a `warning` field in its response, and the frontend
(`InviteUserModal.tsx`, `UsersTable.tsx`) already checked for it and called
`pushToast('warning', ...)`. That plumbing was correct — it simply never
fired, because `syncCfAccessGroup()` never told it there was a failure to
report. Fixing the detection bug alone makes this pre-existing warning path
work correctly.

## Architecture / How it works

### The whole-group sync model

`syncCfAccessGroup(env)` (`src/lib/auth/cf-access-sync.ts`) does **not** send
a per-user delta to Cloudflare. On every call it:
1. Reads **all** `is_active = true` rows from Supabase `admin_authorized_users`.
2. Builds a full `include` rule list (`{ email: { email } }` per user).
3. Finds the Access Group named `"Admin Portal Authorized Users"` (paginated
   lookup — see `findSyncGroup()`).
4. `PUT`s (or `POST`s, if the group doesn't exist yet) the **entire** email
   list to that group.

This means a single sync attempt's success/failure applies to *every* active
user at once, not just the one who triggered it — important context for how
the durability layer (below) records outcomes.

### Response validation (the fix)

Every Cloudflare API call now goes through `parseCfResponse()`, which:
- Treats non-2xx HTTP status as failure (as before).
- **Parses the JSON body and requires `success === true`** — the actual fix.
  A `200` with `success: false` is now correctly treated as a failure, with
  the Cloudflare `errors[].message` surfaced.
- After a successful write, verifies the response's `result.include.length`
  matches what was sent — catches silent truncation/partial-accept.

`findSyncGroup()` paginates the `GET /access/groups` list (`page`/`per_page`,
following `result_info.total_count`) so an existing group is never missed
regardless of how many groups exist in the account.

On every failure branch, `Sentry.captureMessage`/`captureException` (via the
workerd-safe `src/lib/sentry.ts` facade) reports the failure, so it reaches
the existing Sentry pipeline instead of only an ephemeral `console.error`
(Cloudflare Workers console output is not queryable after the fact except via
live `wrangler tail`).

### Durability layer — logging + cron self-heal (no new infrastructure)

Every call to `syncCfAccessGroup()` from `manage.ts` (POST/PATCH/DELETE) and
from the cron reconciler now goes through
`recordCfSyncOutcome()` (`src/lib/auth/cf-access-sync-log.ts`), which:
1. Inserts one row into the new D1 table `cf_access_sync_log` (durable,
   queryable history — see schema below).
2. Sweeps `cf_sync_status` / `cf_sync_error` / `cf_sync_at` across **every**
   currently-active `admin_authorized_users` row (since the sync is
   whole-group, a single outcome is accurate for all active users at once).

A **5-minute cron reconciliation pass** (`reconcileCfAccessGroup()` in
`src/lib/auth/cf-access-reconcile.ts`, wired into the existing `"*/5 * * * *"`
branch of `src/workers/cf-entry.ts`'s `scheduled()` handler) unconditionally
re-runs `syncCfAccessGroup()` and records the outcome the same way. This is
the actual self-healing mechanism: even if an inline sync from `manage.ts`
fails, or the Cloudflare dashboard-side Policy needed a fresh push after being
stale, the next cron tick (within 5 minutes) corrects it without any manual
action.

> **Deliberately not implemented: a Cloudflare Queue-based faster retry.**
> The codebase has a proven outbox+queue+DLQ pattern for exactly this kind of
> problem (`sync_outbox` D1 table + `SYNC_QUEUE`/DLQ + `sync-revalidate-consumer.ts`,
> used for CMS/Astro revalidation — see `../reference/SYNC-SYSTEM-REVIEW.md`).
> A `madagascar-cf-access-sync` queue was designed to mirror it (30s/2m/8m
> backoff instead of a flat 5-minute cron), but the queue does not exist in
> the Cloudflare account yet, and Wrangler hard-fails `wrangler deploy` if
> `wrangler.toml` references a queue binding that doesn't exist. **To add it:**
> run `wrangler queues create madagascar-cf-access-sync` and
> `wrangler queues create madagascar-cf-access-sync-dlq`, then wire a
> `[[queues.producers/consumers]]` block (mirroring the `SYNC_QUEUE` block
> already in `wrangler.toml`) and a consumer module mirroring
> `sync-revalidate-consumer.ts`. The 5-minute cron is a complete durability
> layer on its own in the meantime — the queue would only shorten recovery
> time for a failure that would otherwise wait up to 5 minutes.

### Visibility — Users tab + audit panel

- **Per-user status pill** (`UserTableRow.tsx`, `UserCardStack.tsx`): green
  "CF Synced" / amber "CF Sync Pending" / red "CF Sync Failed", sourced from
  `admin_authorized_users.cf_sync_status`. On failure, the tooltip shows the
  exact Cloudflare error text and the last-attempt relative time.
- **Force Re-sync** (`RegistryToolbar.tsx` button, owner+): calls
  `POST /api/users/cf-resync`, which runs `syncCfAccessGroup()` immediately
  and reports the result — for when an admin doesn't want to wait for the
  next cron tick.
- **Live Group-membership diff** (`GET /api/users/cf-access-audit`): now also
  fetches the *actual* Access Group's current `include` list
  (`findSyncGroup()`, reused from the sync module) and diffs it directly
  against the active Supabase whitelist, returned as `groupMembershipDrift:
  { groupFound, groupEmailCount, inSupabaseNotInGroup, inGroupNotInSupabase }`.
  **This is the check that would have caught the original bug** — the
  pre-existing audit only compared against CF's `/access/users` list (people
  who have ever logged in), which cannot detect "the group update silently
  failed," since a user can still log in via CF Access even if the Group's
  membership is stale (see "Known limitation" below).

## Key code paths

- Root-cause fix (body validation, pagination, Sentry) → `src/lib/auth/cf-access-sync.ts:syncCfAccessGroup`, `parseCfResponse`, `findSyncGroup`
- Sync-outcome logging + per-user status sweep → `src/lib/auth/cf-access-sync-log.ts:recordCfSyncOutcome`
- 5-minute cron self-heal → `src/lib/auth/cf-access-reconcile.ts:reconcileCfAccessGroup`, wired in `src/workers/cf-entry.ts` (`scheduled()`, `"*/5 * * * *"` branch)
- Inline call sites (create/update/delete) → `src/pages/api/users/manage.ts` (`POST`, `PATCH`, `DELETE` handlers)
- Manual force-resync → `src/pages/api/users/cf-resync.ts`
- Live drift detection → `src/pages/api/users/cf-access-audit.ts` (`groupMembershipDrift`)
- Regression test for the fixed bug → `test/cf-access-sync.test.ts`
- Per-user status pill → `src/components/admin/users/UserTableRow.tsx`, `UserCardStack.tsx`
- Force Re-sync button → `src/components/admin/users/RegistryToolbar.tsx`
- `AuthorizedUser` type fields (`cfSyncStatus`, `cfSyncError`, `cfSyncAt`) → `src/components/admin/users/types.ts`

## Configuration / Bindings

- `CF_ACCOUNT_ID` — plain `[vars]` in `wrangler.toml`.
- `CF_API_TOKEN_ZT_WRITE` — secret, Zero Trust: Edit scope. Required for
  every write; if missing, `syncCfAccessGroup()` short-circuits with
  `{success: false}` and logs a warning (does not throw).
- D1 binding `DB` — used for `cf_access_sync_log` reads/writes.
- No Cloudflare Queue binding exists for this system (see "Deliberately not
  implemented" above).
- CF Access Group name is a hardcoded constant, `CF_SYNC_GROUP_NAME =
  "Admin Portal Authorized Users"`, in `cf-access-sync.ts` — matching this
  exact name in the Cloudflare dashboard is what makes the wiring below work.

### D1 schema — `cf_access_sync_log`

```sql
CREATE TABLE IF NOT EXISTS cf_access_sync_log (
  id                    TEXT PRIMARY KEY,
  triggered_by_user_id  TEXT,
  triggered_by_email    TEXT NOT NULL,
  target_email          TEXT,
  action                TEXT NOT NULL,   -- 'create' | 'update' | 'delete' | 'cron_reconcile' | 'manual_resync'
  status                TEXT NOT NULL DEFAULT 'pending',  -- 'success' | 'failed' in practice today
  attempts              INTEGER NOT NULL DEFAULT 0,
  last_error            TEXT,
  email_count           INTEGER,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
```
Migration: `migrations/0002_create_cf_access_sync_log.sql`. Applied directly
to production via the Cloudflare API on 2026-07-24.

### Supabase schema — `admin_authorized_users` additions

```sql
ALTER TABLE admin_authorized_users
  ADD COLUMN IF NOT EXISTS cf_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (cf_sync_status IN ('pending', 'synced', 'failed')),
  ADD COLUMN IF NOT EXISTS cf_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS cf_sync_at TIMESTAMPTZ;
```
Migration: `supabase/migrations/20260724000000_add_cf_sync_status_columns.sql`.
Applied to the production Supabase project (`zlvmrepvypucvbyfbpjj`) on
2026-07-24.

## Operational notes / Runbook

**A user reports they can't log in / aren't seeing expected access:**
1. Check their row's `cf_sync_status` in the Users tab pill. If `failed`,
   read the tooltip for the exact Cloudflare error.
2. Click **Force Re-sync** (owner+) to retry immediately rather than waiting
   for the next cron tick.
3. If it keeps failing, query `cf_access_sync_log` (D1) ordered by
   `created_at DESC` for the full error history and attempt count.
4. Open `GET /api/users/cf-access-audit` and check `groupMembershipDrift` —
   if `groupFound: false`, the Access Group itself is missing or misnamed in
   Cloudflare (see "Known limitation" below); if `inSupabaseNotInGroup` is
   non-empty, those specific emails are not currently in the live Group.

**Common Cloudflare-side failure causes** (all correctly surfaced now):
- `CF_API_TOKEN_ZT_WRITE` expired/rotated/wrong scope → check-presence
  short-circuit or a 401/403 from the API.
- Access Group name collision (two groups somehow named identically) →
  surfaced as a body-level `success: false` error.
- Plan/entitlement limits on Access Group size → surfaced the same way.

**Known limitation — this cannot be fixed by code, requires manual
Cloudflare dashboard verification:** `syncCfAccessGroup()` only manages the
Access **Group**'s membership (`/access/groups`). Whether that Group actually
gates login depends on the CF Zero Trust **Access Application**'s **Policy**
having an "Include: Access Group = Admin Portal Authorized Users" rule — that
wiring lives only in the Cloudflare dashboard and is not verifiable by any
tool available to this codebase's automation. If the Policy references a
different/duplicate group, or literal emails instead of this group, this
entire sync system has zero effect on actual edge access even when it
reports success. **To verify:** Zero Trust → Access → Applications → the
admin portal's application → Policies → confirm the Include rule says
`Access Groups → Admin Portal Authorized Users`, and Zero Trust → Access →
Access Groups → confirm only **one** group exists with that exact name.

## Verification log

| Date       | Checked by | Method                                             | Result |
|------------|-----------|-----------------------------------------------------|--------|
| 2026-07-24 | claude    | Code read (full trace: modal → API → sync → CF API) + live Supabase/D1 queries via MCP | Root cause confirmed: HTTP-status-only check, no body validation |
| 2026-07-24 | claude    | `npx tsc --noEmit` + `npx vitest run` (66/66, incl. 8 new regression tests) after fix | pass |
| 2026-07-24 | claude    | D1 `cf_access_sync_log` table + indexes verified live via `sqlite_master` query after migration | pass |
| 2026-07-24 | claude    | Supabase `cf_sync_status`/`cf_sync_error`/`cf_sync_at` columns verified live via `information_schema.columns` | pass |
| 2026-07-24 | pending   | Manual CF dashboard Policy→Group wiring check (see "Known limitation") | **not yet verified — operator action required** |

## Related

- [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md) §11 — CF Zero Trust ↔ Supabase
  visibility suite this sync system is part of.
- [`../reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md) —
  the outbox/queue/DLQ durability pattern this system's cron layer is modeled
  on (and could be upgraded to use, per "Deliberately not implemented" above).
- [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) — secrets
  registry, including `CF_API_TOKEN_ZT_WRITE`.

---

title: "CF Access Group Sync — Architecture, Root-Cause Fix & Hardening"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/auth/cf-access-sync.ts, src/lib/auth/cf-access-sync-log.ts, src/lib/auth/cf-access-reconcile.ts, src/lib/jobs/registry.ts, src/lib/jobs/tiers.ts, src/pages/api/users/manage.ts, src/pages/api/users/cf-resync.ts, src/pages/api/users/cf-access-audit.ts, src/pages/api/sessions/active-sessions.ts, src/workers/cf-entry.ts, test/cf-access-sync.test.ts, test/cf-access-reconcile-gate.test.ts]
related_docs: [USER-MANAGEMENT.md, CRON-CONTROL.md, CFZT-EDGE-AUTHENTICATION.md, ../reference/SYNC-SYSTEM-REVIEW.md, ../operations/OPERATIONS.md, ../operations/incidents/2026-09-12-cf-access-sync-gateway-timeout.md]
tags: [cf-access, zero-trust, whitelist, sync, incident, runbook]
---

# CF Access Group Sync — Architecture, Root-Cause Fix & Hardening

> **TL;DR (non-technical):** When someone is added or removed in the Users tab,
> the app also has to tell Cloudflare's Zero Trust login gate about it, so
> Cloudflare blocks anyone not on the list. A bug meant that could silently
> fail — Cloudflare would reject the update, but the app reported success
> anyway, with no error shown anywhere. This document explains the bug, the
> fix, and the safety net now in place so a failure is always visible and
> retried automatically.
>
> **Two recovery times, not one.** A change you make in the Users tab, or a
> sync that failed, is retried on the next 5-minute tick. Drift caused
> *outside* the app — someone editing the Access Group by hand in the
> Cloudflare dashboard — is only re-pushed once the last successful sync is
> more than 24 hours old, because the cron now compares a hash of the
> whitelist before calling Cloudflare at all. *Corrected 2026-09-19 — this
> said "self-corrects within 5 minutes" for every case.*

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

**When the whitelist is empty**, Cloudflare still requires at least one
`include` rule, so `syncCfAccessGroup()` pushes a single placeholder rule for a
non-existent address (`dummy_no_access@…`). It is load-bearing: deleting it by
hand in the dashboard makes the next `PUT` fail its rule-count verification.
*Documented 2026-09-19.*

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

Every failure branch reports through `reportOnceCooled()`
(`src/lib/observability.ts`, called from `cf-access-sync.ts`), which writes a
`platform_alerts` row and raises **one** Sentry event per hour per fingerprint
— `cf-sync:list_groups_failed`, `cf-sync:write_failed:<label>`,
`cf-sync:count_mismatch`, `cf-sync:supabase_fetch_failed`,
`cf-sync:unexpected_error:<step>`. The cooldown was added on 2026-09-12 after a
tick-rate Supabase timeout produced four Sentry issues; see the
[post-mortem](../operations/incidents/2026-09-12-cf-access-sync-gateway-timeout.md).

**One branch reports nothing:** a missing `CF_ACCOUNT_ID` or
`CF_API_TOKEN_ZT_WRITE` only `console.warn`s and returns `{success: false}`. In
Workers, console output is not queryable after the fact except via live
`wrangler tail`, so a rotated-away token is visible in the Users-tab pill and
`cf_access_sync_log` but **not** in Sentry. *Corrected 2026-09-19 — this said
every failure branch reaches Sentry.*

### Durability layer — logging + cron self-heal (no new infrastructure)

Calls to `syncCfAccessGroup()` from `manage.ts` (POST/PATCH/DELETE) and from
the cron reconciler go through `recordCfSyncOutcome()`
(`src/lib/auth/cf-access-sync-log.ts`), which:
1. Inserts one row into the D1 table `cf_access_sync_log` (durable, queryable
   history — see schema below).
2. Sweeps `cf_sync_status` / `cf_sync_error` / `cf_sync_at` across **every**
   currently-active `admin_authorized_users` row (since the sync is
   whole-group, a single outcome is accurate for all active users at once).

#### The 5-minute reconcile, and its hash-or-age gate

`reconcileCfAccessGroup()` (`src/lib/auth/cf-access-reconcile.ts`) runs on the
`"*/5 * * * *"` trigger. It is registered as the `cf-access-reconcile` job in
`src/lib/jobs/registry.ts` and dispatched by `runCronBatch(FIVE_MIN_JOBS, …)`
in `src/workers/cf-entry.ts` — not by an `if` branch inside `cf-entry.ts`, as
this section said before.

Since `996c829` (2026-09-12) the pass is **gated**, not unconditional. Each
tick it reads the active email list from Supabase, hashes it (SHA-256 over the
sorted, lower-cased addresses) and compares against two
`admin_portal_settings` rows:

| Setting | Default | Meaning |
|---|---|---|
| `cf-access-sync:last-hash` | — | hash of the whitelist at the last **successful** push |
| `cf-access-sync:last-synced-at` | — | epoch ms of that push |
| `cf-access-reconcile-max-staleness-hours` | `24` | how old a successful push may get before a re-push is forced |

The Cloudflare API is called only when the hash differs **or** the last success
is older than the staleness window. That removes ~99.6% of the outbound calls
and log rows, and it changes the recovery guarantee:

| Cause of drift | Corrected within |
|---|---|
| Whitelist changed in the Users tab, inline sync failed | **5 minutes** — the hash differs from the stored one, so the next tick pushes |
| Any failed push | **5 minutes** — the hash is stored *only* on success, so a failure retries every tick |
| Out-of-band edit to the Access Group in the Cloudflare dashboard | **up to 24 hours** — the whitelist is unchanged, so only the staleness timer forces a re-push |

Setting `cf-access-reconcile-max-staleness-hours` to `0` restores the old
unconditional behaviour without a deploy. *Corrected 2026-09-19 — this section
said the cron "unconditionally re-runs `syncCfAccessGroup()`" and that any
stale dashboard-side state "is corrected on the next tick".*

#### Three tick outcomes, and what each one records

| Tick outcome | `cf_access_sync_log` row | Users-tab pill |
|---|---|---|
| **Gated (skipped)** — hash matches and the last success is fresh | none | unchanged |
| **Supabase fetch failed** — after two attempts (retried on `timeout`/`502`/`503`/`504`/`gateway`; `CF_API_TIMEOUT_MS` is 12 s) | `status: failed`, written with `skipSupabaseSweep: true` | **not** updated — Supabase is the thing that is unreachable |
| **Executed** — hash changed or staleness expired | `status: success` or `failed`, with the sweep | updated for every active user |

So "every cron call records an outcome and sweeps every active user" is no
longer true of the gated and Supabase-failure paths. *Corrected 2026-09-19.*

#### It can be paused

`cf-access-reconcile` runs under the cron control plane
([`CRON-CONTROL.md`](./CRON-CONTROL.md)): an operator can halt the whole
scheduler, pause this job, or give it a longer interval from
`/dashboard/cron`. Its tier is `essential` (`src/lib/jobs/tiers.ts`), which
means the *automatic* shed path under D1 pressure will never stand it down —
but a deliberate, audited human pause still can. If the whitelist looks stale,
check `/dashboard/cron` before anything else.

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
> `sync-revalidate-consumer.ts`. The gated 5-minute cron is a complete
> durability layer on its own in the meantime — the queue would only shorten
> recovery time for a failure that would otherwise wait up to 5 minutes. It
> would not help with out-of-band dashboard drift, which is bounded by the
> staleness window rather than by retry speed.

### Visibility — Users tab + audit panel

- **Per-user status pill** (`UserTableRow.tsx`, `UserCardStack.tsx`), sourced
  from `admin_authorized_users.cf_sync_status`. *Corrected 2026-09-19 — the
  labels and colours here were wrong.*

  | `cf_sync_status` | Pill label | Colour |
  |---|---|---|
  | `synced` | **CF** | sky |
  | `failed` | **CF Fail** | amber |
  | `pending` | **CF Pending** | slate |

  On failure, the tooltip shows the exact Cloudflare error text and the
  last-attempt relative time; on success it also says whether the identity has
  been linked by a first SSO login.
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
- Gated 5-minute cron self-heal → `src/lib/auth/cf-access-reconcile.ts:reconcileCfAccessGroup`
- Job registration and dispatch → `src/lib/jobs/registry.ts` (job id `cf-access-reconcile`, `gateKeys: CF_ACCESS_RECONCILE_KEYS`), run by `runCronBatch(FIVE_MIN_JOBS, …)` in `src/workers/cf-entry.ts`; criticality in `src/lib/jobs/tiers.ts`
- Inline call sites (create/update/delete) → `src/pages/api/users/manage.ts` (`POST`, `PATCH`, `DELETE` handlers)
- Inline call site (account block) → `src/pages/api/sessions/active-sessions.ts` (`block_account`): deactivates the user and calls `syncCfAccessGroup()`, but **not** `recordCfSyncOutcome()`, so it writes no `cf_access_sync_log` row and leaves the pill on its previous value until the next executed cron tick. *Documented 2026-09-19 — wire it through `recordCfSyncOutcome` to close this.*
- Manual force-resync → `src/pages/api/users/cf-resync.ts`
- Live drift detection → `src/pages/api/users/cf-access-audit.ts` (`groupMembershipDrift`)
- Regression test for the fixed bug → `test/cf-access-sync.test.ts`
- Gate behaviour test → `test/cf-access-reconcile-gate.test.ts`
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
Applied to the production Supabase project (`[SUPABASE_PROJECT_REF]`) on
2026-07-24.

## Operational notes / Runbook

**A user reports they can't log in / aren't seeing expected access:**
1. Check their row's `cf_sync_status` in the Users tab pill. If `failed`,
   read the tooltip for the exact Cloudflare error.
2. Click **Force Re-sync** (owner+) to retry immediately. This bypasses the
   hash-or-age gate entirely, so it is also the right lever when you suspect
   the Access Group was edited outside the app and do not want to wait out the
   24-hour staleness window.
3. Check `/dashboard/cron` — if the scheduler is halted or
   `cf-access-reconcile` is paused, no tick is running at all.
4. If it keeps failing, query `cf_access_sync_log` (D1) ordered by
   `created_at DESC` for the full error history and attempt count. Remember
   that gated (skipped) ticks write nothing, so a gap in this table is normal.
5. Open `GET /api/users/cf-access-audit` and check `groupMembershipDrift` —
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

> **Status of that check: still open, since 2026-07-24.** It is the one claim
> in this system nothing in the repo can settle. `CFZT-EDGE-AUTHENTICATION.md`
> §3 used to state the Policy→Group wiring as configured fact; as of
> 2026-09-19 it points here instead, so the two documents no longer disagree.
> Record the result in the verification log below when an operator does it.

## Verification log

| Date       | Checked by | Method                                             | Result |
|------------|-----------|-----------------------------------------------------|--------|
| 2026-07-24 | claude    | Code read (full trace: modal → API → sync → CF API) + live Supabase/D1 queries via MCP | Root cause confirmed: HTTP-status-only check, no body validation |
| 2026-07-24 | claude    | `npx tsc --noEmit` + `npx vitest run` (66/66, incl. 8 new regression tests) after fix | pass |
| 2026-07-24 | claude    | D1 `cf_access_sync_log` table + indexes verified live via `sqlite_master` query after migration | pass |
| 2026-07-24 | claude    | Supabase `cf_sync_status`/`cf_sync_error`/`cf_sync_at` columns verified live via `information_schema.columns` | pass |
| 2026-07-24 | pending   | Manual CF dashboard Policy→Group wiring check (see "Known limitation") | **not yet verified — operator action required** |
| 2026-09-08 | claude    | Re-verification for the 45-day staleness gate. All 7 `related_code` paths present; every named symbol still exported (`syncCfAccessGroup`, `parseCfResponse`, `findSyncGroup`, `recordCfSyncOutcome`, `reconcileCfAccessGroup`, `groupMembershipDrift`); `CF_SYNC_GROUP_NAME` still `"Admin Portal Authorized Users"`; cron still wired at `*/5 * * * *` in `cf-entry.ts`; `CF_ACCOUNT_ID` still a `[vars]` entry and `CF_API_TOKEN_ZT_WRITE` still in `[secrets] required`; `cf_access_sync_log` live via `--remote` | pass at the time. Live row count **12,999**, up from 11,418 on 2026-09-02 (~264/day) — the unbounded growth chunk 8 was scoped to fix. **Superseded: see the 2026-09-19 row** |
| 2026-09-19 | claude    | Re-derived the whole document against HEAD and the live D1. Read `cf-access-reconcile.ts` (hash-or-age gate, the three tick outcomes, hash stored on success only), `cf-access-sync.ts` (`reportOnceCooled` fingerprints, the console-only missing-token branch, the empty-whitelist placeholder rule, `CF_API_TIMEOUT_MS = 12000`, `fetchAuthorizedUserEmails` 2 attempts), `jobs/registry.ts` + `jobs/tiers.ts` + `jobs/control.ts` (dispatch, `essential`, halt/pause/interval), `UserTableRow.tsx` (pill labels), `active-sessions.ts` (`block_account`) | pass after the corrections above. Live `cf_access_sync_log` **607 rows**, not 12,999: rows now arrive at ~1/day (2026-09-15..19: 1, 5, 1, 1, 1) because gated ticks write nothing, and older success rows were pruned. The growth problem is closed |

## Related

- [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md) §11 — CF Zero Trust ↔ Supabase
  visibility suite this sync system is part of.
- [`../reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md) —
  the outbox/queue/DLQ durability pattern this system's cron layer is modeled
  on (and could be upgraded to use, per "Deliberately not implemented" above).
- [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) — secrets
  registry, including `CF_API_TOKEN_ZT_WRITE`, and the idle-tick gate summary.
- [`CRON-CONTROL.md`](CRON-CONTROL.md) — the scheduler this job runs under:
  halt, pause, per-job interval, tiers and the shed path.
- [`../operations/incidents/2026-09-12-cf-access-sync-gateway-timeout.md`](../operations/incidents/2026-09-12-cf-access-sync-gateway-timeout.md)
  — the 504 post-mortem that produced the Supabase retries, the 12 s timeout
  and the Sentry cooldown.
- [`CFZT-EDGE-AUTHENTICATION.md`](CFZT-EDGE-AUTHENTICATION.md) — the sign-in
  side of the same Access application.

---
title: "Access Revocation Remediation — Design"
status: draft
audience: [ai, technical, owner]
last_verified: 2026-09-16
verified_against: [code, production-kv, production-d1, supabase]
owner: harshil
related_code: [src/lib/auth/plac.ts, src/lib/auth/session.ts, src/lib/auth/stages/session-stage.ts, src/lib/auth/stages/refresh-role.ts, src/lib/auth/stages/bootstrap.ts, src/lib/auth/cf-access-reconcile.ts, src/pages/api/users/manage.ts, src/pages/api/users/access.ts, src/pages/api/users/force-kick.ts, src/pages/api/sessions/active-sessions.ts, src/pages/api/sessions/active-revocations.ts, src/pages/api/system/pages.ts, src/pages/index.astro]
related_docs: [./2026-09-16-access-revocation-remediation-implementation-plan.md, ../architecture/PERMISSIONS-SYSTEM.md, ../features/SESSION-MANAGEMENT.md, ../features/USER-MANAGEMENT.md, ../program/ROADMAP.md]
tags: [auth, sessions, revocation, plac, incident, design]
---

<!-- docs-check: proposed-paths -->
<!-- This is a design. It names modules the plan will create; the code-path
     check is opted out here and enforced on the chunk records once each stage ships. -->

# Access Revocation Remediation — Design

**One line:** a permission change must never lock anyone out, a lockout must
never be invisible, and there must be exactly one way to keep someone out.

## 1. The incident (2026-09-16, verified live)

The only Owner account (`mascotasmadagascar@gmail.com`, id `1ba300dd-…`) could
not sign in for more than 14 hours and saw `/?error=access_revoked`. Neither the
Users page nor the Sessions page showed any block.

| Time (UTC) | Event | Source |
| --- | --- | --- |
| 04:25:50 | Owner `LOGIN_SUCCESS` | `admin_login_logs` |
| 04:26:16 | Vendor support approves the Owner's access request for `/dashboard/debug` | `admin_audit_log` (`grant_access`, "Approved via Pending Access Requests") |
| 04:26:16 | The approval handler calls `forceLogoutUser`, which writes `revoked:<ownerId>` for 24 h | `src/pages/api/audit/requests/[id]/resolve.ts` |
| 04:26:41 → 18:32:35 | Every Owner sign-in refused: `LOGIN_FAILED`, `revocation_block_active` (13 attempts) | `admin_login_logs` |
| 14:51:33 | Vendor deactivates the Owner. `forceLogoutUser` rewrites the flag, **resetting its expiry to 2026-09-17 14:51:33** | audit log; KV `expiration` 1789656693 |
| 14:51:52 | Vendor reactivates the Owner. The deployed build did not yet clear the flag on reactivation | audit log |
| 18:30:15 | Deploy of `5d3ea31` ("stale-revocation unblocking") | `wrangler deployments list` |
| 18:31, 18:32 | Owner still refused | `admin_login_logs` |

What did **not** cause it, checked directly: the Supabase row is `role=owner,
is_active=true, cf_sub_id` set; Cloudflare Access admits the user (the refused
requests carry a valid, verified Access assertion, so they got past Access and
were refused by the Worker); only one `revoked:*` key exists in KV.

Two further facts made it worse:

- The approval could never have worked. `/dashboard/debug` checks
  `isDev()` in page code, and an Owner already bypasses page-level access
  control (ADR-0002 answer 2). A page permission cannot open that page for an
  Owner, so the approval did nothing except lock the account.
- The block was invisible. The Sessions page loads edge blocks only when the
  **Active Edge Blocks** tab is clicked; until then the KPI tile reads
  "Edge Blocks 0 · No active blocks" and the tab reads "(0)". The Users page has
  no notion of a block at all.

## 2. Confirmed defects

Every row was verified in code on `5d3ea31`; rows marked *live* were also
verified against production.

| # | Defect | Where | Effect |
| --- | --- | --- | --- |
| D1 | `forceLogoutUser` always writes a 24 h `revoked:<userId>` sign-in block, and is called for **permission refreshes**: access-request approval, single-page revoke, role change, page-role change | `plac.ts:403`; callers `resolve.ts:104`, `access.ts:191`, `manage.ts:363`, `system/pages.ts:264` | Granting or removing one page, or changing a role, locks the whole portal for 24 h. *Live.* |
| D2 | The block is invisible: Sessions KPI and tab count read an empty array until the tab is opened; Users page has no block indicator; the error card has no reason or expiry | `[SUPABASE_PROJECT_REF].tsx` (`fetchRevocations` only on tab), `EdgeBlocksPanel.tsx` | Operators conclude "no block" while one exists. *Live.* |
| D3 | The `5d3ea31` cron purge deletes the `revoked:` key of **every active user**, but only when the reconcile actually syncs (email-hash change or 24 h staleness) | `cf-access-reconcile.ts:85-101` | Does not clear the Owner's block for about 11 h (last sync 05:35:49, hash unchanged) *(live)*; and silently undoes a deliberate force-kick of an active user. |
| D4 | A Supabase error during the 30-minute re-check is treated as "row missing" and writes the 24 h block | `refresh-role.ts:28-38`; pinned by `test/pipeline-session.test.ts` | A directory blip locks valid users out for a day. |
| D5 | Page-role tightening compares **unnormalised stored user roles** against canonical levels (`super_admin` → undefined → 99; `admin`, which means manager → 2) | `system/pages.ts` `computeImpact`, `forceLogoutAffectedUsers` | Wrong impact preview; wrong users evicted, each with a 24 h block. |
| D6 | Force-kick checks `/dashboard/users` but not the Owner-only `/dashboard/users#force-kick` fragment (gap D-4 class) | `force-kick.ts:16`; registry row verified live | An Admin can force-kick managers and staff. |
| D7 | `block_account` ignores the Supabase update error, reports success, allows equal-clearance targets and self-targeting (UI-only guard) | `active-sessions.ts:102-117` | "Blocked" when nothing was deactivated; hierarchy inconsistent with `manage.ts`. |
| D8 | "Revoke device session" calls Cloudflare's organisation-wide `revoke_user` with `devices: true` | `plac.ts:467` | Signs the user out of Access on every device. Cloudflare Access has no per-device revocation (verified in Access session-management docs), and without it the device silently re-bootstraps from its Access cookie. |
| D9 | The landing page calls `/cdn-cgi/access/logout` on **any** `?error=` | `index.astro:304-307` | Transient errors also end the Access session; any `/?error=x` link signs a visitor out. |
| D10 | Lifting an edge block leaves a deactivated account deactivated with no hint | `active-revocations.ts:120`, `EdgeBlocksPanel.tsx` | "Lift Block" appears to do nothing. |
| D11 | Access requests can be filed and approved for pages page-level access cannot open (Owner/vendor requesters; `vendor_support`-only pages) | `api/access-requests/index.ts`, `resolve.ts` | The request that started this incident. |
| D12 | A Supabase error at sign-in shows "not authorized" (`access_denied`) | `bootstrap.ts:48-66` | Misleading card; logged as `not_whitelisted`. |
| D13 | Two TTL sources for the same flag (hard-coded `86400` vs `SESSION_MAX_LIFETIME_MS`); a `revoked:` delete for a brand-new UUID that cannot exist | `plac.ts:403`, `session.ts:330`, `manage.ts:155` | Drift and dead code. |
| D14 | Nothing stops the last active Owner being deactivated, deleted or demoted | `manage.ts` PATCH/DELETE | The situation that stranded the customer today. |

## 3. Decisions

The owner declined to decide these during planning and asked for the plan to
proceed; the recommended option is used as the **default**. Each can be reversed
at review before its stage starts.

| ID | Decision | Default | Alternative |
| --- | --- | --- | --- |
| OD-1 | What keeps someone out | **Deactivation is the only lockout.** Retire the user-level `revoked:<userId>` block. | Keep a timed sign-in pause, chosen explicitly in a dialog with duration and reason, shown in Users and Sessions. |
| OD-2 | Supabase unreachable during the periodic re-check | **Grace of one interval** (the session keeps working and retries each request while the last good check is under 2× the interval old), then end with "Verification unavailable". Never writes a block. A re-check forced by an administrator's change gets no grace. | End the session immediately. |
| OD-3 | Last active Owner | **Refuse** deactivating, deleting or demoting it, for every actor including vendor support. | Allow vendor support as break-glass. |
| OD-4 | "Revoke this device" | **Merge into "Sign out everywhere"**, which says what actually happens. | Keep a per-device button with an explicit "signs them out of Cloudflare Access on every device" label. |
| OD-5 | Who may act on whom | **One rule** for every user-targeting action: never yourself (except editing your own display name); vendor support may act on anyone else; everyone else only on strictly lower clearance. This keeps `manage.ts`'s existing rule and applies it to force-kick, sign-out, page access and approvals, so an Owner can no longer force-kick vendor support. | Let an Owner sign out (not deactivate) vendor support. |

## 4. Target model

### 4.1 KV keys

| Key | Written by | Read by | TTL | Meaning |
| --- | --- | --- | --- | --- |
| `session:<sid>`, `user-session:<uid>:<sid>` | unchanged | unchanged | session lifetime | unchanged |
| `revoked-session:<sid>` | sign out everywhere (one per live session), deactivate, delete | session stage | session lifetime | This one session is over. Not a sign-in block. |
| `authz-changed:<uid>` **(new)** | every change to a user's role, active state, page access, or display name; a page-registry change marks every active user | session stage (same bulk read) | session lifetime | Value is a random mark. A live session whose stored `authzMark` differs re-verifies role and page map against the source of truth on its next request, then stores the mark. |
| `revoked:<uid>` | **nothing** after stage 2 | **nothing** after stage 2 | — | Retired (OD-1). Remaining keys expire within 24 h; a sweep is part of the rollout. |

Why a random mark and not a timestamp: comparing values needs no clock
agreement between the Worker that records the change and the Worker serving the
user. The mark is read **before** the directory lookup, so a check that stores
mark M began after M was written, which happens only after the database change
committed. A stale KV read can only make a session re-verify once more, never
skip a change.

### 4.2 Cost

KV bulk reads are billed per key (Cloudflare Workers pricing, verified
2026-09-16). Warm-path reads today: session record + 2 flag keys. Stage 1:
session record + 3 keys in one bulk read. Stage 2: session record + 2 keys, back
to today's count. At the measured ~550 cf-admin requests/day, stage 1 adds about
550 reads/day against the 100,000/day free limit. Each administrative change
costs one KV write per affected user (1,000 writes/day free); a page-registry
change writes one per active user. A forced re-check costs one Supabase read and
one D1 query, once per live session, once per change.

### 4.3 What each administrative action does

| Action | Directory | Live sessions | Next sign-in | Cloudflare Access |
| --- | --- | --- | --- | --- |
| Grant, revoke or reset a page; approve an access request | override row | re-verify on next request (no sign-out) | unaffected | untouched |
| Change role | role (overrides reset) | re-verify on next request | unaffected | untouched |
| Change a page's required role or active state | `admin_pages` | every active user re-verifies | unaffected | untouched |
| Sign out everywhere (Users: force-kick; Sessions: row action) | — | all ended | allowed at once | tokens revoked on all devices, so they must re-authenticate |
| Deactivate (Users toggle, Sessions "Lock Out User", Sessions "Deactivate") | `is_active=false` | all ended | refused, `account_inactive` | removed from the Access group; tokens revoked |
| Reactivate | `is_active=true` | — | allowed | re-added to the Access group |
| Delete | row removed | all ended | refused, `access_denied` | removed from the Access group; tokens revoked |

### 4.4 Refusals a signed-in user can meet

| Situation | Page | API |
| --- | --- | --- |
| Row missing on re-check | `/?error=access_denied` | 403 `Access denied` |
| Row inactive on re-check | `/?error=account_inactive` | 403 `Account inactive` |
| Stored role untranslatable | `/?error=role_unrecognised` | 403 `Account role not recognised` |
| Directory unreachable, past grace or forced | `/?error=recheck_failed` | 503 `Verification unavailable` |
| Directory unreachable at sign-in | `/?error=directory_unavailable` **(new card)** | 503 `Directory unavailable` |
| Session ended by an administrator | `/?error=session_revoked` | 403 `Session revoked` |

Every refusal destroys the session record and sends `Clear-Site-Data` on the
API. None writes a sign-in block. The `access_revoked` card is deleted in stage
2 because nothing can emit it any more. `test/error-code-contract.test.ts`
enforces both directions, and it matches only **literal** `?error=<code>`
strings, so codes must never be built with a template.

### 4.5 The one rule for acting on another user (OD-3, OD-5)

A pure function, `decideTargetAction`, used by every route that targets a user:

1. The actor is the target → refuse (400), except `edit_profile`.
2. The actor is not vendor support and does not outrank the target → refuse (403).
3. The action is deactivate, delete, or a role change away from Owner, the
   target is an active Owner, and it is the only one → refuse (409).

### 4.6 Access requests (D11)

Refused both when filed and when approved, with a message saying why, when:
the requester is Owner or vendor support (page permissions cannot change what
they can open), or the page's required role is `vendor_support`. The Access
Denied view hides **Request Access** for Owner and vendor support.

## 5. Rollout

| Stage | Ships | Removes the risk of |
| --- | --- | --- |
| 0 (done by the owner, 2026-09-16) | Lift the Owner's block: vendor account → Sessions → **Active Edge Blocks** tab (the count is wrong until opened) → Lift Block | the current lockout |
| 1 — stop the lockouts | `authz-changed` signal; re-check without blocks and with outage grace; permission changes signal instead of kicking; page-registry vocabulary fix; purge removed; `directory_unavailable`; no automatic Access logout | D1, D3, D4, D5, D9, D12, D13 (dead delete) |
| 2 — one lockout, visible | `signOutEverywhere` without a user flag; `revoked:` retired from every reader; one target rule with last-Owner guard; force-kick fragment enforced; Edge Blocks surface, unblock route and `#unblock` permission retired; block becomes deactivate; device revoke merged | D2, D6, D7, D8, D10, D13, D14 |
| 3 — requests that can be granted | refusal of ungrantable access requests | D11 |

Each stage passes `npm run verify`, deploys through Workers Builds, and gets a
chunk record under `documentation/program/chunks/`. Stage 1 is the priority.

## 6. Acceptance

- Revoking a page for a signed-in user: their next request is served with the
  new map, their session survives, and `revoked:<id>` does not exist
  (route test and pipeline test).
- Approving an access request: same (route test).
- A Supabase 500 during the periodic re-check within grace: request served, no
  KV block, session intact (pipeline test).
- After stage 2, no file under `src/` contains `forceLogoutUser` or writes a
  `revoked:` user key (source guard test).
- Deactivating the only active Owner as vendor support returns 409 (pure test).
- The Sessions page shows no count it has not loaded (manual check by the owner
  in the browser; no edge-block tile remains after stage 2).

## 7. Out of scope

- Moving identity from Supabase to D1 (roadmap D-11, after chunk 12). The
  PGRST116 distinction made here is the minimum; the identity repository in
  chunk 12 remains the home for a result contract.
- The duplicated `/dashboard/users/sessions*` registry rows.
- Roadmap 13.3 (users + sessions + access-requests vertical migration) still
  applies; this remediation is an incident fix that lands first and shrinks it.

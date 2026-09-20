---

title: "Manage Users & RBAC Architecture"
status: active
audience: [ai, technical]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/api/users/manage.ts, src/pages/api/users/force-kick.ts, src/pages/api/users/resend-invite.ts, src/lib/auth/plac.ts, src/lib/auth/rbac.ts, src/lib/auth/authz-signal.ts, src/lib/auth/cf-access-reconcile.ts, src/lib/auth/routes.ts]
related_docs: [CF-ACCESS-SYNC.md, SESSION-MANAGEMENT.md, ../architecture/PERMISSIONS-SYSTEM.md]
tags: [users, rbac, plac, cloudflare-access, sessions, lifecycle]
---

# Manage Users & RBAC Architecture

> **Scope note (2026-08-23, restated 2026-09-19).** This document covers the
> account lifecycle and the admin UI. The permission model it rests on — roles,
> PLAC, the provisioning gates, the helper semantics — is owned by
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md)
> and that document wins on any disagreement; the tables reproduced below in §2
> are a convenience copy. Everything about the **Sessions console** — the tabs, the
> edge-block list, the fragment enforcement — belongs to
> [`SESSION-MANAGEMENT.md`](SESSION-MANAGEMENT.md).
> The banner below calls `plac-and-audit.md` "authoritative"; that predates the
> split and is no longer accurate for the model itself, only for the audit side.


> [!IMPORTANT]
> **Role names changed on 2026-07-27.** The ladder is now
> `vendor_support > owner > admin > manager > staff > viewer` (six tiers,
> including a read-only Viewer). The database still holds the previous values
> and they are translated in code, so `super_admin` in a stored row means
> **Admin** (level 2) and `admin` in a stored row means **Manager** (level 3).
> The body of this document was brought in line with the current model on
> 2026-08-12 (role table, helper-function references, route/enforcement
> tables, Hidden Accounts visibility, filter tabs). See
> `architecture/plac-and-audit.md` §1.1-1.2, which remains the authoritative
> reference and covers the collision this rename creates.

> **TL;DR (non-technical):** How admin users are managed: the six role tiers, how accounts are invited/changed/removed, how higher-privilege accounts are protected, and how active sessions are controlled.

> **Component:** CF-Admin Role-Based Access Control (RBAC) System
> **Framework:** Astro 7 + Preact + Cloudflare Workers *(corrected 2026-09-19 — this said Astro 6; the pinned version is 7.3.2)*
> **Auth Provider:** Cloudflare Zero Trust Access (identity) + Supabase authorization whitelist (access control)
> **Last Updated:** 2026-09-19 (corrections pass — see §12). Previously 2026-08-12 (docs-consistency pass: role table, helper-function references, enforcement/route tables, and Hidden Accounts visibility rewritten to match the 2026-07-27 role rename and the 2026-07-26 removal of DEV/Owner list-hiding — no code changes, documentation only. Previously 2026-07-24 v4.8: CF Access Group sync hardened — root-cause fix for a silent-failure bug in `syncCfAccessGroup`'s response validation, durable per-attempt logging, 5-minute cron self-heal, per-user sync-status pill, Force Re-sync action, and live Group-membership drift detection; see `CF-ACCESS-SYNC.md`. Previously v4.7: PLAC enforcement now applied to all `/api/users/*` routes via `placDenyResponse(actor, '/dashboard/users')`; rate limits added on revoke/unblock/cf-access-audit; `users/access` PLAC-gates the actor before running the existing 5-gate hierarchy)

This document details the exact flow and architecture for managing administrative access within the internal admin portal (`cf-admin`).

## 1. System Overview & Security Posture

The CF-Admin portal enforces a strict separation between **identity** (who you are) and **authorization** (what you can do):

- **Identity — Cloudflare Zero Trust Access:** CF Access validates the user's identity at the edge (Google/GitHub/OTP). No login form, no magic links, no client-side secrets. The Worker receives `CF-Access-Authenticated-User-Email` + `CF-Access-JWT-Assertion` headers on every authenticated request — CF handles the entire OAuth flow.
- **Authorization — Supabase Whitelist:** Only emails in `admin_authorized_users` (Supabase PostgreSQL) with `is_active = true` can create a KV session. CF authenticating a user does NOT grant them access — the whitelist check is the second gate.
- **Service-Role Isolation:** All Supabase operations (whitelist reads/writes, bookings, chatbot, consent) use `SUPABASE_SERVICE_ROLE_KEY`, accessed only server-side — bypasses RLS entirely, never exposed to the client.
- **No GoTrue:** `auth.admin.createUser()`, `auth.admin.deleteUser()`, `supabase.auth.signInWithOtp()`, and the `admin_sessions` table have been fully removed from all code paths.
- **CSRF Protection:** All mutation requests are validated via stateless Origin + Referer header checking, applied globally by middleware.
- **Error Sanitization:** All API error responses return generic messages — no internal stack traces, SQL errors, or schema details leak to the client.
- **Ghost Protection (3-Layer Force-Kick):** Deactivation, deletion, force-kick and the Sessions page's block action trigger a synchronous security cascade across KV + CF API to prevent privilege persistence via stale sessions. *Corrected 2026-09-19: this said "role mutations trigger" the cascade, which contradicted §3.1 and §8 of this same document. Since `46b8f4d` (2026-09-16) a **role change** instead resets the user's page overrides and writes an `authz-changed` mark — each live session re-reads its role and page map on its next request, and nobody is signed out.*

### Technical Interaction Model (Authorize a New User)

1. **Admin Actor** initiates `POST /api/users/manage`.
2. **Admin API (Worker)** validates CSRF tokens and internal RBAC clearance.
3. **Supabase `admin_authorized_users`** is INSERT'd with email, display_name, role, is_active.
4. **Returned UUID** (`id`) is used to write any initial page overrides to D1 `admin_page_overrides`.
5. **Audit Engine** records the event via Ghost Audit Engine (`waitUntil`) and the API returns a sanitized 201 Created response.
6. **On next login:** CF Access authenticates the user → Worker sees their email in whitelist → creates KV session → writes `cf_sub_id` to Supabase idempotently.

## 2. Role Hierarchy (6-Tier)

Access levels operate dynamically based on strict numeric permissions (lower number = higher clearance). Defined centrally in the RBAC module (`src/lib/auth/rbac.ts`). Renamed 2026-07-27 from the previous 5-tier `dev > owner > super_admin > admin > staff` ladder — the database still stores the old values and `normalizeRole()`/`toStoredRole()` translate at the boundary; see the disclosure banner at the top of this document and `architecture/plac-and-audit.md` §1.2 for the full translation table and the naming collision it warns about.

| Level | Role | Capabilities |
|:-----:|:-----|:------------|
| **0** | **Vendor Support** ⚡ | Our support tier — database prunes, raw log access, edits to other privileged accounts. Not assignable via the invite/role picker (`ASSIGNABLE_ROLES` excludes it), but no longer hidden: as of 2026-07-26 it appears in the user list and access-review export like any other account. |
| **1** | **Owner** 💎 | The customer's account holder. Full access including user administration. Protected from modification by every tier below. |
| **2** | **Admin** 👑 | Second in command. Full operational control, including platform settings and users at or below their level. |
| **3** | **Manager** 🛡️ | Runs day-to-day operations — bookings, content, customers, generalized audit logs. No user or platform administration. |
| **4** | **Staff** 👤 | Works in their own area. Cannot change settings or other people. |
| **5** | **Viewer** | Read-only. Refused on every mutating request regardless of page grants (enforced in `src/lib/auth/stages/decide.ts`, not merely absent from the UI). **Not currently assignable.** *Added 2026-09-19:* while `ROLE_VOCABULARY = 'legacy'` (`src/lib/auth/rbac.ts`) the database has no stored value for Viewer, so `toStoredRole` cannot persist it and `manage.ts` refuses it — but `ASSIGNABLE_ROLES` in the invite pill grid still offers it, so an admin can pick a role the server will reject. Tracked as C-11 in [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md). |

### Color Hierarchy: Thermal Gradient

The badge colors follow a **thermal gradient** designed for maximum readability on dark UI surfaces — progressing from Red (Vendor Support) through Emerald (Owner), Amber (Admin), Violet (Manager), Blue (Staff), to Slate (Viewer, read-only).

### Hierarchy Logic Gate

Permission checks are performed using an integer-based comparison of the `ROLE_LEVEL` map.

- **Logic**: `ROLE_LEVEL[userRole] <= ROLE_LEVEL[requiredRole]`
- **Implementation**: `src/lib/auth/rbac.ts`

> [!IMPORTANT]
> **No Hardcoded Strings:** You must **never** use hardcoded string comparisons (e.g., `user.role === 'vendor_support'`) for authorization checks in Astro pages or API routes. Always use the hierarchical helper functions (`isVendorSupport`, `isOwnerOrVendor`, `isAdminOrAbove`, `isManagerOrAbove`, etc.) to ensure that new roles are automatically accounted for without causing unexpected `unauthorized` errors.

| Function | Logic | Purpose |
|----------|-------|---------|
| `hasPermission` | `userLvl <= reqLvl` | Core O(1) gatekeeper (internal) |
| `isVendorSupport` | `role === 'vendor_support'` | Exact Vendor Support check — lock critical system internals |
| `isOwnerOrVendor` | `userLvl <= 1` | Vendor Support or Owner — privileged-account edit protection |
| `isAdminOrAbove` | `userLvl <= 2` | Admin or higher — user management clearance |
| `isManagerOrAbove` | `userLvl <= 3` | Manager or higher — content & bookings clearance |
| `isReadOnly` | `role === 'viewer'` | Refused on every mutating request regardless of page grants |
| `canManageUser` | `ROLE_LEVEL[actor] < ROLE_LEVEL[target]` | May `actor` edit/delete/re-role `target`? (Vendor Support exempt) |

> **Deprecated aliases (still live — 70 pre-rename call sites across 50 files, measured 2026-09-19; this said ~200):**
> `isDev` = `isVendorSupport`, `isOwnerOrDev` = `isOwnerOrVendor`,
> `isSuperAdmin` = `isAdminOrAbove` (still level 2, now named Admin),
> `isAdmin` = `isManagerOrAbove` (still level 3, now named Manager). New code
> should call the canonical names above; the table in §2.1 below shows which
> of these each route currently calls.

### 2.1 Enforcement Coverage

All server-side authorization gates (API routes and Astro SSR pages) **must** use the helpers above. The following files have been fully migrated. Routes marked **+PLAC** also call `placDenyResponse(actor, '/dashboard/<page>')` so an explicit page-level deny blocks the underlying API call too.

> **Vocabulary note:** the parenthetical role labels below (e.g. `(admin+)`, `(owner+)`) use
> the current canonical names. Where a file literally calls a deprecated alias
> (`isDev`/`isOwnerOrDev`/`isSuperAdmin`) rather than the canonical function, this table says
> so — both spellings gate the identical level (see the alias table in §2 above).

| File | Helper(s) Used | Gate Purpose | +PLAC |
|------|---------------|--------------|:---:|
| `src/pages/api/users/manage.ts` | `isVendorSupport` | Role mutation, privileged-account edit protection | ✅ `/dashboard/users` |
| `src/pages/api/users/access.ts` | `isVendorSupport`, `isOwnerOrVendor` | PLAC provisioning | ✅ `/dashboard/users` (2026-05-26) |
| `src/pages/api/users/force-kick.ts` | `isOwnerOrVendor` — **target protection only** | Session termination | ✅ `/dashboard/users` |
| `src/pages/api/users/index.ts` | `requireAuth()` + PLAC (no role floor) | User registry list — every account returned, including hidden/Vendor Support (2026-07-26, see §4) | ✅ `/dashboard/users` (2026-05-26) |
| `src/pages/api/users/pages.ts` | `requireAuth()` + PLAC (no role floor) | Page registry for InviteModal | ✅ `/dashboard/users` (2026-05-26) |
| `src/pages/api/users/probes.ts` | `requireAuth(context, 'owner')` | Unauthorized-access probe roll-up | ✅ `/dashboard/users` (2026-05-26) |
| `src/pages/api/users/cf-access-audit.ts` | `requireAuth(context, 'owner')` | CF Access ↔ Supabase whitelist diff | ✅ `/dashboard/users` (2026-05-26) + 10/min RL |
| `src/pages/api/sessions/active-sessions.ts` | `denySessions` | KV active session list + revoke | ✅ `/dashboard/sessions`, **plus `#revoke` on DELETE**; 30/min RL |
| `src/pages/api/sessions/active-revocations.ts` | `denySessions` | KV revocation block list + unblock | ✅ `/dashboard/sessions`, **plus `#unblock` on DELETE**; 30/min RL |
| `src/pages/api/sessions/flush-sessions.ts` | `denySessions` + `isOwnerOrDev` | Bulk session flush — **Owner/Vendor only** | ✅ `/dashboard/sessions`, plus `#flush` |
| `src/pages/api/users/access-data.ts` | `isVendorSupport`, `isOwnerOrVendor` | Per-user PLAC matrix (ghost-protected) | ✅ `/dashboard/users` |
| `src/pages/api/users/[id]/session-status.ts` | `requireAuth()` + PLAC; `isOwnerOrVendor` gates only the ghost-target sub-case | Session telemetry + per-session revocation (ghost-protected) | ✅ `/dashboard/sessions` |

> *Corrected 2026-09-19.* The three `src/pages/api/sessions/` rows said "(admin+)"
> with PLAC on **`/dashboard/users`**, and `session-status.ts` was described as
> having an "effective gate" of `/dashboard/users` reached through a deactivated
> page key. Both changed on 2026-09-16 (gaps **D-3** and **D-4** in
> [`../MAINTENANCE.md`](../MAINTENANCE.md)): every one of them now gates on
> `/dashboard/sessions`, the mutating routes additionally check their action
> fragment through `src/lib/auth/surface-guards.ts`, and `flush-sessions` is
> Owner/Vendor only rather than admin+. The Sessions console is documented in
> [`SESSION-MANAGEMENT.md`](SESSION-MANAGEMENT.md), which owns these rows.

> **Spec gap D6 — `#force-kick` is enforced nowhere.** The `admin_pages` row
> `/dashboard/users#force-kick` exists live with an Owner baseline, and the access
> UI offers it, but a grep of `src/` finds no reference to the string. What the
> route actually enforces is `/dashboard/users` plus a *target* check: a canonical
> **Admin** with page access can force-kick any manager or staff account, and
> `isOwnerOrVendor` only protects owner and vendor_support targets from them.
> Every kick also writes a 24-hour `revoked:` sign-in block — see §5.4. Open; see
> `documentation/specs/2026-09-16-access-revocation-remediation-design.md`.
> *Added 2026-09-19.*
| `src/pages/api/features/toggle.ts` | `isDev` (deprecated alias for `isVendorSupport`) | Feature flag mutation | (role-only — Vendor Support is PLAC-exempt) |
| `src/pages/api/audit/consent.ts` | `isOwnerOrDev` (deprecated alias for `isOwnerOrVendor`) | Consent record deletion | ✅ `/dashboard/logs` |
| `src/pages/api/audit/logs.ts` | `isOwnerOrDev` (deprecated alias for `isOwnerOrVendor`) | Audit log deletion | ✅ `/dashboard/logs` |
| `src/pages/api/audit/emails.ts` | `isOwnerOrDev` (deprecated alias for `isOwnerOrVendor`) | Email log deletion | ✅ `/dashboard/logs` |
| `src/pages/api/audit/stats.ts` | (admin+ for stats; owner+ for the `#security` tab, via `ROLE_LEVEL`) | Audit summary stats | ✅ `/dashboard/logs` |
| `src/pages/api/audit/login-logs.ts` | role-or-grant | Login forensics (PII) | ✅ `/dashboard/logs` parent-deny propagation (2026-05-26) |
| `src/pages/api/audit/export.ts` | role-or-grant | CSV export | ✅ `/dashboard/logs` parent-deny propagation (2026-05-26) |
| `src/pages/api/audit/prune.ts` | `isDev` (deprecated alias for `isVendorSupport`) | Log pruning | ✅ `/dashboard/logs` |
| `src/pages/dashboard/logs/index.astro` | `isDev`, `isOwnerOrDev` (deprecated aliases) | Feature flag computation | (page-level — uses middleware PLAC) |
| `src/pages/dashboard/users/[id]/access.astro` | `isVendorSupport`, `isOwnerOrVendor` | Hidden account visibility, privilege gate | (page-level — uses middleware PLAC) |

> [!NOTE]
> **Client-side Preact components** (e.g., `DangerZone.tsx`, `ExpandedRow.tsx`, `UsersRegistry.tsx`) use `ROLE_LEVEL` from the shared `types.ts` for UI-only display hints (ghost protection badges, filter tabs). These are **not** security boundaries — all actual enforcement happens server-side in the routes above.

### 3.1 Session Revocation Workflow (3-Layer Ghost Sweep)

**Changed 2026-09-16.** A role change no longer triggers this cascade, and neither does granting, revoking or resetting a page or approving an access request. Those write an `authz-changed:{userId}` mark; each of the user's live sessions re-reads its role and page map on its next request and nobody is signed out ([`../specs/2026-09-16-access-revocation-remediation-design.md`](../specs/2026-09-16-access-revocation-remediation-design.md), D1). The cascade below still runs for deactivation, deletion, force-kick and the Sessions page's block action; stage 2 of that remediation retires Layer 2.

When an account is deactivated, deleted or force-kicked, the system triggers a **3-Layer Security Cascade** to prevent stale sessions from retaining access at any layer:

1. **Verification**: The actor's clearance is verified against the target's role (note: "Manager" is now also a specific role name at level 3 — this step is a generic clearance check, not a literal Manager-role gate).
2. **Whitelist Update**: Supabase `admin_authorized_users` is updated with the new role/status.
3. **Override Purge**: `resetUserOverrides(env.DB, userId)` deletes all D1 page overrides → clean RBAC state. *Corrected 2026-09-19: this runs on a **role change** and on **deletion** only. Deactivation and force-kick leave the user's overrides in place.*
4. **Layer 1 — KV Session Deletion**: LISTS `user-session:{userId}:*` (reverse-index pattern, O(k)) → deletes all matching session keys. User's KV session is gone.
5. **Layer 2 — KV Revocation Flag**: Writes `revoked:{userId}` → `'1'` to KV with 24h TTL. Middleware checks this flag before any new session bootstrap — prevents the "CF Access cookie still valid → auto-bootstrap" gap. It is written **first**, before the session deletion, so no re-bootstrap window opens between the two operations.
6. **Layer 3 — CF Access API Revocation**: `POST /accounts/{accountId}/access/organizations/revoke_user` with a body of `{ email?, user_uid?, devices: true }` (`src/lib/auth/plac.ts`). *Corrected 2026-09-19: this said `DELETE …/access/users/{cfSubId}/active_sessions`.* The difference matters — `devices: true` revokes the user's tokens across **every device**, not one session, and the call is made by email as well as `user_uid`, so it works even for an account that has never linked a `cf_sub_id`. The user's next request is intercepted by CF Access → redirect to login. `cfSubId` and email are read from the KV sessions first and fall back to `admin_authorized_users`. The call is fire-and-forget through `waitUntil` when an execution context is available, and a failure is logged, not surfaced.

**Reverse-Index KV Pattern:**
Secondary index `user-session:{userId}:{sessionId}: '1'` allows targeted `LIST` for O(k) deletion instead of O(total_sessions) full-namespace scan.

## 4. Hidden Accounts System

A flag allowing accounts to be marked for covert operations or monitoring. **Its scope was narrowed on 2026-07-26** — see the [!WARNING] callout below.

| Aspect | Detail |
|--------|--------|
| **Storage** | A boolean flag (`is_hidden`) in the authorized users table marks accounts as hidden |
| **Creation** | Vendor Support-only — via the user management API with hidden flag enabled (`isVendorSupport(session.role)` gates it in `manage.ts`) |
| **Visibility (current, 2026-07-26+)** | `GET /api/users` returns **every** account, hidden or not, Vendor Support or not, to any actor with `/dashboard/users` PLAC access — deliberately: concealing a supplier account (or any account) from the customer's own user list and access-review export was the finding a security review would fail on. The `is_hidden` flag and the Vendor Support role still gate a narrower, per-user "ghost" check (`isOwnerOrVendor`) on endpoints like `session-status`, which 404s a hidden/Vendor-Support target for anyone below Owner. |
| **Anti-Enumeration** | Unauthorized single-record queries (e.g. a non-existent or ghost-protected user ID) receive an identical 404 response shape whether or not the account exists. This no longer extends to the main list/export/revocation views — see Visibility above. |

> [!WARNING]
> **This table previously said hidden accounts were excluded from the user list, counts,
> and access-review export for non-DEV/Owner actors.** That was true before 2026-07-26 and
> is **no longer true** — see `architecture/plac-and-audit.md` §2.5 Gate B and
> `src/pages/api/users/index.ts`'s own in-code comment: *"Every account is listed, including
> ours... If an account should not be there, remove the account. Do not hide it."* The
> `is_hidden` flag is retained for the narrower per-user ghost-protection check described
> above, not for list-level concealment.

## 5. User Lifecycle Management (API Architecture)

The user management API endpoint securely bridges Supabase GoTrue logic. All mutations are gated by CSRF validation and RBAC hierarchy checks.

### 5.1 Inviting/Authorizing a New User

When an authorized admin adds a new member from the dashboard:

1. **Frontend Request:** UI validates inputs (Email, Role, Display Name) via the Invite Modal (Preact island).
2. **Page Access Fetch:** Modal lazy-fetches the page registry on the **first modal open** (not on component mount) — live page list from D1, zero hardcoding. Cached after first load; full error state and retry button shown on failure.
3. **CSRF Validation:** Middleware verifies Origin/Referer headers match the site URL.
4. **Endpoint Validation:** Endpoint verifies the requesting user has sufficient rank and prevents privilege elevation.
5. **Whitelist Insertion:** `INSERT INTO admin_authorized_users (email, display_name, role, is_active, is_hidden)` via Supabase admin client. Returns the new UUID (`id`) via `.select('id').single()`.
6. **Page Override Batch Write:** If the admin customised page access during creation, D1 overrides are batch-inserted (`INSERT OR REPLACE INTO admin_page_overrides`) using the new user's Supabase UUID. Batch is capped at 50 overrides.
7. **Audit Log:** Mutation is logged via Ghost Audit Engine (`waitUntil`).
8. **CF Access whitelist (Automated):** The CF Access Group ("Admin Portal Authorized Users") is automatically synchronized with the Supabase whitelist via a background task (`cf-access-sync.ts`) hooked into the Worker API. No manual intervention is needed in the Cloudflare dashboard.

> **Non-fatal override writes:** If the batch override write fails, user creation still succeeds. The admin can set page permissions manually via the Page Access Manager after creation.
> **No GoTrue:** There is no call to `auth.admin.createUser()`.
> **The Worker does send an invitation email.** *Corrected 2026-09-19: this said "The user receives no invitation email from the Worker. CF Access sends its own authentication email/redirect when the user first tries to access `admin.madagascarhotelags.com`."* `POST /api/users/manage` enqueues an invite onto `EMAIL_QUEUE` with `purpose: 'custom_email'` and the tag `admin_invite`, and `src/pages/api/users/resend-invite.ts` exists to send it again. CF Access does also send its own OTP/redirect on first access, but that is in addition. The portal host is **`secure.madagascarhotelags.com`**, not `admin.…`.

### 5.2 Role Selection UI (Invite Modal)

The Invite Modal renders a "Command Console" two-panel dialog:

**Left panel — Identity:**

- **Role Pill Selector**: a two-column pill grid (`grid-cols-2`) over the five assignable roles, with role-specific colours. Roles at or above the actor's level are greyed-out/disabled (the server enforces this too). *Corrected 2026-09-19: described as "2×2" — five roles do not fit a 2×2, and one of the five (Viewer) cannot currently be persisted at all.*
- **Hidden Account Toggle**: Ghost-mode toggle only rendered for Vendor Support and Owner actors.
- Email + Display Name inputs, Grant Access + Cancel buttons.

**Right panel — Page Access:**

- **Page Chip Grid**: Live page list fetched lazily on first modal open. Grouped by section (MAIN / CONTENT / TOOLS / MANAGEMENT). Error state with retry button displayed if fetch fails.
- Chips have four states:
  - `default_on` (●) — role naturally has access, no override written
  - `default_off` (○) — role has no natural access, no override written
  - `force_grant` (+) — click to grant above role baseline (override written)
  - `force_deny` (✕) — click to deny despite role baseline (override written)
- Click once to force-override; click again to revert to role default.
- Override count badge shown when customisations are active.

### 5.3 Restoring / Enabling Access

Access is managed via the active flag in the authorization table. When set to true, the login portal accepts the user's JWT.

### 5.4 Revoking / Locking Access

If a user needs immediate revocation:

1. **Soft Lock:** PATCH `/api/users/manage` with `is_active: false`. The 3-layer force-kick fires on the PATCH itself, and the PATCH writes an `authz-changed` mark, so any session the kick misses re-verifies on its next request and ends with `account_inactive`. The re-check writes no sign-in block.
2. **Hard Lock (Force Logout via `/api/users/force-kick`):** Triggers `forceLogoutUser()` directly — all 3 layers (KV revocation flag + KV session delete + CF API org-wide revoke). User is ejected within seconds.

   > ### How to get someone back in after a kick
   >
   > *Added 2026-09-19. This is the failure class that locked the Owner out on
   > 2026-09-16, and it was not written down anywhere.*
   >
   > Every path above writes **Layer 2**: a `revoked:{userId}` key in KV with a
   > **24-hour TTL**. Until it is gone, the user cannot bootstrap a new session even
   > with a perfectly valid CF Access cookie — they will simply be refused, with no
   > UI explaining why.
   >
   > - **Deactivation (option 1) is self-healing.** Re-activating the account with
   >   `PATCH /api/users/manage` `is_active: true` explicitly deletes the
   >   `revoked:` key.
   > - **A force-kick (option 2) is not.** Nothing clears the flag. It can only be
   >   lifted from **Security → Sessions → Active Edge Blocks** (`#unblock`), or by
   >   waiting out the 24 hours. And that tab shows `0` with a green "No active
   >   blocks" until it is clicked — see
   >   [`SESSION-MANAGEMENT.md`](SESSION-MANAGEMENT.md).
   >
   > So: if a user reports being locked out after any administrative action, open
   > the Active Edge Blocks **tab** before concluding there is no block. Stage 2 of
   > the access-revocation remediation retires this flag; it has not shipped.
3. **Full Delete:** Fetches `targetUser.id` from whitelist, runs 3-layer force-kick, `resetUserOverrides(env.DB, id)` clears D1 PLAC data, then `DELETE FROM admin_authorized_users WHERE email = ?` removes the whitelist entry. **No `auth.admin.deleteUser()` call** — GoTrue is not involved.
4. **CF Access policy (manual):** For permanent revocation, also remove the user from the CF Zero Trust application policy in the Cloudflare Dashboard to prevent CF Access from ever authenticating them again.

## 6. UI Implementation (Manage Users Dashboard)

The interface is composed of multiple Preact islands:

| Component | File | Purpose |
|-----------|------|---------|
| **Users Manager** | | Main orchestrator — user list, search, role filtering. Dispatches events to open invite modal |
| **User Card** | | Individual user card with role badge, actions, permission display |
| **Page Access Manager** | | Per-user PLAC override toggle grid (for existing users) |
| **Invite User Modal** | | Two-panel "Command Console" Preact island |
| **Role Pill Selector** | `src/components/admin/users/invite/RolePillSelector.tsx` | Atomic: two-column role pill grid with RBAC-gated availability |
| **Hidden Account Toggle** | | Atomic: ghost-mode toggle (Vendor Support/Owner only) |
| **Page Chip Grid** | | Atomic: interactive chip grid grouped by section, 4 chip states |
| **Session Forensics Drawer** | `SessionForensicsDrawer.tsx` | Premium HUD slide-in panel: device identity (browser/OS via zero-dep UA parser), connection telemetry (IP, geo, Ray ID), live 24h session countdown, per-session revocation |

### Event Bus (Cross-Island Communication)

The modal uses CustomEvents for decoupled island-to-island messaging:

| Event | Direction | Purpose |
|-------|-----------|---------|
| Modal open | Users Manager → Invite Modal | Opens the creation dialog |
| User invited | Invite Modal → Users Manager | Triggers user list refresh |

### Filter Tabs

| Tab | Shows |
|-----|-------|
| **All** | Every account returned by `GET /api/users` — no hidden-account exclusion since 2026-07-26 (see §4) |
| **Admins** | `ROLE_LEVEL[u.role] <= ROLE_LEVEL['manager']` — Vendor Support, Owner, Admin, and Manager (levels 0–3) |
| **Staff** | `u.role === 'staff'` only (level 4; Viewer, level 5, appears only under **All**) |

## 7. Security Boilerplates & Error Flow

All actions within the API routes return specific error states handled by the UI:

- `401 Unauthorized` → Render standard "Session Expired" overlay
- `403 Forbidden` → Render "Insufficient Permissions / Action Locked" message
- `405 Method Not Allowed` → Block manual HTTP verb injections
- `400 Bad Request` → Return sanitized error (no internal details)

### Auth Error Propagation

The auth guard throws a typed error with explicit HTTP status (401 or 403) so callers can return the correct status instead of a generic 500. API route catch blocks check for this specific error type before falling back to generic 500 handling.

### Local Dev CSRF

The site URL **must** be set in the local development environment. If absent, the middleware falls back to the production URL and every mutation fails with 403.

## 8. Page-Level Access Control (PLAC) System

For detailed PLAC documentation, see the dedicated [PLAC-AND-AUDIT.md](../architecture/plac-and-audit.md).

**Key integration with User Management:**

- The Page Access Manager renders a toggle grid showing all pages and their access state for a target user.
- Changes save immediately via optimistic UI with toast confirmation.
- Pages the actor cannot modify are shown locked (grayed out with lock icon).
- **Role Mutation Pipeline (Ghost Protection Invalidation):** Changing a user's role is a high-risk event. Any role update triggers a synchronous security cascade:
  1. `resetUserOverrides`: Purges all historical custom page overrides, returning the user to a clean RBAC state.
  2. `markAuthzChanged` (`src/lib/auth/authz-signal.ts`): each live session re-reads role and page map on its next request. Until 2026-09-16 this step was `forceLogoutUser`, whose 24-hour sign-in block locked the changed user out of the portal.

## 9. API Data Contracts

All administrative user management actions are performed via `POST`, `PATCH`, and `DELETE` methods on the `/api/users/manage` endpoint.

### 9.1 POST /api/users/manage (Invite User)

Accepts email, display name, role, hidden status, and any initial page overrides. Returns a sanitized success/error message without exposing internal stack traces.

### 9.2 PATCH /api/users/manage (Modify User)

Accepts updates for active status, display name, and role. Mutates the Supabase whitelist, writes an `authz-changed` mark for every change, and runs the force-kick cascade only on deactivation.

## 10. Operational Resilience & Failure Modes

The system is designed to "fail-closed" across various infrastructure disruptions.

| Failure Event | System Impact | Mitigation / Fallback |
|---------------|---------------|-----------------------|
| **KV Read Timeout** | Session cannot be verified | Request is rejected (401). Prevents unauthorized access on cache failure. |
| **D1 Write Failure** | Permission change not saved | API returns 500. UI shows error, no state change occurs. |
| **KV Write Failure** | Force-logout or `authz-changed` mark not written | A missed mark after a **role or active-state** change is caught by the next 30-minute re-check. A missed mark after an **override-only** change is not — that re-check recomputes the page map only on a role change or a forced check, so the correction arrives with the 1-hour access-map refresh instead. Audit log preserves the attempt. *Corrected 2026-09-19.* |
| **Supabase outage during a re-check** | Identity row cannot be read | The session keeps working for up to two re-check intervals since the last good check, then ends with `recheck_failed`. No sign-in block is written. |
| **Supabase outage during an invite or role change** | The mutation fails | The API returns 500 and **no whitelist mutation is made**, so the user stays at their previous access level. *Corrected 2026-09-19: this row said "whitelisting is rolled back atomically to prevent orphaned records", while the duplicate table below said "no whitelist mutation" — there was nothing to roll back, because the write never lands.* |
| **Layer 1 KV kick fails** | Sessions not deleted | Layer 2's revocation flag still blocks re-bootstrap; Layer 3 blocks at the CF edge. |
| **Layer 3 CF API fails** | The CF_Authorization cookie stays valid | Layer 2's revocation flag prevents a new session. On natural expiry (≤24 h) the user is fully locked out. |

*The second, near-duplicate "Failure Modes" table that used to sit below the
timing matrix was merged into this one on 2026-09-19; the two disagreed about the
Supabase-outage case.*

### Session Timing Matrix

| Component | Duration | How Enforced |
|-----------|----------|--------------|
| **CF Access cookie** | 24 Hours | CF Dashboard → App Session Duration (must be set manually) |
| **Global CF session** | 24 Hours | CF Dashboard → Settings → Auth → Global Session Timeout |
| **KV TTL** | 24 Hours | `expirationTtl: 86400` on KV session write |
| **Hard expiry guard** | 24 Hours | `createdAt` check in middleware fast-path (defense-in-depth) |
| **Role re-check** | 30 Minutes | `lastRoleCheckedAt` → **Supabase** re-fetch of `admin_authorized_users` (`src/lib/auth/stages/refresh-role.ts`). *Corrected 2026-09-19: this said "D1 re-fetch"; the whitelist has lived in Supabase since GoTrue was removed.* |
| **CF JWT assertion** | ~1 Minute | Auto-refreshed by CF edge — Worker does not manage this |
| **Force-kick propagation** | Immediate | 3-layer: KV revocation flag (24 h) + KV session delete + CF API org-wide `revoke_user` |

---

## 11. CF Zero Trust ↔ Supabase Visibility Suite

### 11.1 Architecture Overview (Automated Access Group Model)

> **See [`CF-ACCESS-SYNC.md`](CF-ACCESS-SYNC.md) for the full architecture,**
> **a 2026-07-24 root-cause fix (a silent-failure bug in the sync's response**
> **validation), and the durability/visibility hardening now in place**
> **(sync-attempt logging, 5-minute cron self-heal, per-user status pill,**
> **Force Re-sync, live Group-membership drift detection). This section is a**
> **summary only — that document is the source of truth going forward.**

The admin portal integrates **CF Zero Trust with an automated Access Group**. The Worker API synchronizes the Supabase `admin_authorized_users` whitelist with a Cloudflare Access Group named "Admin Portal Authorized Users" on every user create/update/delete, **and on a 5-minute cron reconciliation pass** (not purely event-driven — see `CF-ACCESS-SYNC.md`). This means unauthorized emails are intended to be blocked at the Cloudflare edge *before* they reach the Worker middleware — **contingent on the CF Access Application's Policy actually including this Group**, which is dashboard-side configuration this codebase cannot verify automatically (see `CF-ACCESS-SYNC.md`'s "Known limitation").

```
Admin Portal Add/Update/Delete User 
  → Worker API (`manage.ts`) + `syncCfAccessGroup`
  → CF Access Group ("Admin Portal Authorized Users") is updated
  → outcome logged to D1 `cf_access_sync_log` + swept to `cf_sync_status` on every active user

Self-heal: `reconcileCfAccessGroup()` is evaluated on every 5-minute tick, but
since chunk 8 it is hash-or-age gated — it only calls Cloudflare when the active
whitelist's hash has changed, or the last successful sync is older than the
max-staleness window (`cf-access-reconcile-max-staleness-hours`, default 24 h).
*Corrected 2026-09-19: this said it "unconditionally re-runs the sync regardless
of whether the last inline attempt succeeded".* Out-of-band drift is still
self-healed, just within a day rather than within five minutes.

Login Flow:
CF Access → (checks Access Group, if the Policy is wired to it) 
  → user NOT in group → BLOCKED AT EDGE (Worker never sees it) ❌
  → user IN group → Authenticated by CF → Worker middleware
  → checks Supabase admin_authorized_users AND is_active = true → KV session created ✅
```

**Implication:** By automating the Cloudflare Access Group, we guarantee that no unauthorized user can even reach the Worker to receive an OTP or probe the application — **when the Policy is correctly wired to this Group**. This provides a strict dual-gate security model without any double-entry management, backed by a durable attempt log and a self-healing cron pass rather than a single best-effort call.

### 11.2 The cfLinked Boolean

Each `admin_authorized_users` row has a `cf_sub_id` column — the CF Access internal UUID for the user (`sub` claim from the CF JWT). This is written idempotently on the user's **first** successful login.

- `cf_sub_id IS NOT NULL` → **CF Linked**: user has authenticated via CF ZT at least once; their CF identity is bound; Layer 3 force-kick (CF API session revocation) is available.
- `cf_sub_id IS NULL` → **CF Pending**: user was invited in Supabase but has never logged in; only Layers 1 + 2 of force-kick are available.

**Security:** `cf_sub_id` UUID is **never returned to the client** in any API response. The server derives a `cfLinked: boolean` and strips the UUID before serialization.

### 11.3 CF ZT Visibility — New API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/users` | PLAC (`/dashboard/users`); no role floor beyond authentication — see §2.1 | Returns `cfLinked: boolean` per user (cf_sub_id IS NOT NULL) |
| `GET /api/users/[id]/session-status` | PLAC `/dashboard/sessions` (D-3, resolved 2026-09-16); `isOwnerOrVendor` gates the ghost-target sub-case only — see §2.1 | Live KV session telemetry — IP, User-Agent, geolocation, Ray ID, lastActiveAt, countdown; Ghost Protection at DB boundary |
| `GET /api/users/[id]/login-history` | owner+ | Last 15 login events from `admin_login_logs` with CF ZT metadata |
| `GET /api/users/probes` | owner+ | Unauthorized access attempts (is_authorized_email = 0), grouped by email |
| `GET /api/users/cf-access-audit` | owner+ | Live cross-reference: CF Access users list vs Supabase whitelist, plus `groupMembershipDrift` (live Access Group membership vs whitelist — see `CF-ACCESS-SYNC.md`) |
| `POST /api/users/cf-resync` | owner+ | Force an immediate whitelist → CF Access Group resync (see `CF-ACCESS-SYNC.md`) |

### 11.4 Login Intelligence Panel (ExpandedRow)

When an admin expands a user row in the User Registry, the bottom of the expanded panel shows a "Login Intelligence" section (Owner+ only, on-demand fetch). It displays the last 15 login events from `admin_login_logs` with:

| Column | Source | Notes |
|--------|--------|-------|
| Outcome | `event_type` + `success` | SUCCESS (emerald) / FAILED / BLOCKED (red) |
| Method | `cf_access_method` or `login_method` | OTP (sky) / Google (blue) / GitHub |
| Location | `geo_location` + `colo` | "City, Country (CF data center)" |
| Bot Score | `cf_bot_score` | CF bot management score; emerald < 20, amber 20–49, red ≥ 50 |
| CF Ray | `cf_ray_id` | First 10 chars of CF Ray ID (full value in tooltip) |
| IP | `ip_address` | Masked to `X.X.***.***` **server-side** for non-Vendor-Support actors; full IP for Vendor Support. (The live-sessions APIs behave differently — see §11.8.) |
| Date | `created_at` | Relative ("2h ago") with absolute ISO tooltip |

The `summary` shows total login count, success count, and failure count across all time for this email.

**Check Active Sessions:** The ExpandedRow also renders a "Check Active Sessions" button (admin+) which opens the `SessionForensicsDrawer` — a side-panel HUD providing real-time session telemetry (device identity, connection metadata, live 24h countdown) with per-session revocation controls. See §6 UI Implementation table for component details.

### 11.5 Access Probe Feed

The `AccessProbePanel` component (rendered below the User Registry for Owner+ only, `client:idle`) surfaces emails that successfully authenticated via CF OTP but were blocked by the Supabase whitelist gate.

> **Note on Edge Blocking:** Since the system now uses automated Cloudflare Access Group synchronization (blocking unauthorized emails at the CF Edge), the Worker middleware will rarely see unauthorized attempts, meaning the Access Probe Feed will likely remain empty unless the CFZT policy is temporarily changed to OTP-Open.

Each probe row shows: email | attempt count | last seen | CF access method | bot score | geo location. A "+ Whitelist" button pre-fills the InviteUserModal with the probed email for immediate onboarding.

### 11.6 CF Access Audit Cross-Reference

The "CF Audit" button in the Registry Toolbar (Owner+ only) opens `CfAuditDrawer`, which fetches live data from the CF Access users API and cross-references with the Supabase whitelist:

| Tab | Description |
|-----|-------------|
| **Linked** | In Supabase whitelist AND have a CF sub_id linked. Layer 3 kick available. |
| **Awaiting Login** | In Supabase whitelist but have never logged in via CF. No CF sub_id yet. |
| **CF Orphans** | Authenticated via CF but NOT in Supabase whitelist. Were blocked at middleware. |

The CF Orphans tab is automatically selected if any orphans exist (highest-priority signal).

### 11.7 DB Indexes

Two indexes support these queries:

```sql
-- D1 (database/legacy_migrations/0022_login_logs_probe_index.sql)
CREATE INDEX IF NOT EXISTS idx_login_logs_unauthorized
  ON admin_login_logs(is_authorized_email, created_at DESC)
  WHERE is_authorized_email = 0;

-- Supabase (migrations/supabase_0002_cf_status_index.sql)
CREATE INDEX IF NOT EXISTS idx_authorized_users_cf_sub_id
  ON admin_authorized_users(cf_sub_id)
  WHERE cf_sub_id IS NOT NULL;
```

### 11.8 Security Constraints Summary

| Data | Exposure | Rationale |
|------|----------|-----------|
| `cf_sub_id` UUID | Server-only | Used for CF API revocation — leaking enables targeted session enumeration |
| Session IDs | Server-only | KV key names never returned to client. **Note:** session *metadata* (IP, User-Agent, geolocation, Ray ID, lastActiveAt) is returned via the `session-status` API to any actor with **`/dashboard/sessions`** PLAC access (ghost-protected targets require Owner+ — see §2.1) — only the session ID itself remains server-only. |
| Full IP addresses — **login history** | Vendor Support actor only | `GET /api/users/[id]/login-history` masks to `X.X.***.***` server-side for everyone below Vendor Support. |
| Full IP addresses — **live sessions** | **Any canonical Admin** | *Corrected 2026-09-19: the single row here said "Vendor Support actor only", which is true of login history and false of live sessions.* `GET /api/sessions/active-sessions` and `GET /api/users/[id]/session-status` return the unmasked `ipAddress` of every session to anyone holding `/dashboard/sessions`. The masking those screens show is applied in the browser (`maskIp`), so it is a display convention, not an access boundary. See [`SESSION-MANAGEMENT.md`](SESSION-MANAGEMENT.md); logged in [`../MAINTENANCE.md`](../MAINTENANCE.md). |
| `cf_ray_id` | Owner+ via Login Intelligence | Non-sensitive; useful for CF dashboard cross-reference |
| Probe emails | Owner+ only | Reveals who is probing the system |
| CF audit cross-reference | Owner+ only | Reveals CF Access org-level user list |

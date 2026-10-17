---

title: "Manage Users & RBAC Architecture"
status: active
audience: [ai, technical]
last_verified: 2026-10-17
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/api/users/manage.ts, src/pages/api/users/approvals.ts, src/lib/approvals/handlers.ts, src/lib/users/manage-apply.ts, src/components/admin/users/SecondPersonPanel.tsx, src/lib/auth/stages/decide.ts, supabase/migrations/20261016000000_role_check_add_viewer.sql, src/components/admin/users/UsersConsole.tsx, src/components/admin/users/PersonDrawer.tsx, src/components/admin/users/people.ts, src/pages/api/users/access-data.ts, src/lib/access-center/counts.ts, src/lib/access-review/handlers.ts, src/components/admin/users/AccessReviewPanel.tsx, src/lib/unused-accounts.ts, src/workers/scheduled-unused-accounts.ts, src/pages/api/settings/user.ts, src/pages/api/users/force-kick.ts, src/pages/api/users/resend-invite.ts, src/lib/access-requests/handlers.ts, src/lib/access-requests/keys.ts, src/components/admin/settings/AskForPermission.tsx, src/lib/auth/plac.ts, src/lib/auth/rbac.ts, src/lib/auth/authz-signal.ts, src/lib/auth/cf-access-reconcile.ts, src/lib/auth/routes.ts]
related_docs: [CF-ACCESS-SYNC.md, SESSION-MANAGEMENT.md, ../architecture/PERMISSIONS-SYSTEM.md]
tags: [users, rbac, plac, cloudflare-access, sessions, lifecycle]
---

# Manage Users & RBAC Architecture

> **TL;DR (non-technical):** How admin users are managed: the six role tiers, how accounts are
> invited, changed and removed, how higher-privilege accounts are protected, which changes wait
> for a second person, and how active sessions are controlled.

> **Scope.** This document covers the account lifecycle and the Users screen. The permission
> model it rests on (roles, PLAC, the provisioning gates, the helper semantics) is owned by
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md), which wins
> on any disagreement; the tables in §2 are a convenience copy. Everything about the **Sessions
> console** (the tabs, the edge-block list, the fragment enforcement) belongs to
> [`SESSION-MANAGEMENT.md`](SESSION-MANAGEMENT.md).

> [!IMPORTANT]
> **Stored role names differ from the labels.** The ladder is
> `vendor_support > owner > admin > manager > staff > viewer` (six tiers, including a read-only
> Viewer). The database still holds the names from before the 2026-07-27 rename and they are
> translated in code, so `super_admin` in a stored row means **Admin** (level 2) and `admin` in a
> stored row means **Manager** (level 3). Viewer is stored as `viewer`. The translation table and
> the collision it avoids: [PERMISSIONS-SYSTEM §4](../architecture/PERMISSIONS-SYSTEM.md).

> **Component:** CF-Admin Role-Based Access Control (RBAC) System
> **Framework:** Astro 7 + Preact + Cloudflare Workers
> **Auth Provider:** Cloudflare Zero Trust Access (identity) + Supabase authorization whitelist (access control)

This document details the exact flow and architecture for managing administrative access within the internal admin portal (`cf-admin`).

## 1. System Overview & Security Posture

The CF-Admin portal enforces a strict separation between **identity** (who you are) and **authorization** (what you can do):

- **Identity — Cloudflare Zero Trust Access:** CF Access validates the user's identity at the edge (Google/GitHub/OTP). No login form, no magic links, no client-side secrets. The Worker receives `CF-Access-Authenticated-User-Email` + `CF-Access-JWT-Assertion` headers on every authenticated request — CF handles the entire OAuth flow.
- **Authorization — Supabase Whitelist:** Only emails in `admin_authorized_users` (Supabase PostgreSQL) with `is_active = true` can create a KV session. CF authenticating a user does NOT grant them access — the whitelist check is the second gate.
- **Service-Role Isolation:** All Supabase operations (whitelist reads/writes, bookings, chatbot, consent) use `SUPABASE_SERVICE_ROLE_KEY`, accessed only server-side — bypasses RLS entirely, never exposed to the client.
- **No GoTrue:** `auth.admin.createUser()`, `auth.admin.deleteUser()`, `supabase.auth.signInWithOtp()`, and the `admin_sessions` table have been fully removed from all code paths.
- **CSRF Protection:** All mutation requests are validated via stateless Origin + Referer header checking, applied globally by middleware.
- **Error Sanitization:** All API error responses return generic messages — no internal stack traces, SQL errors, or schema details leak to the client.
- **Ghost Protection (3-Layer Force-Kick):** Deactivation, deletion, force-kick and the Sessions page's block action trigger a synchronous security cascade across KV + CF API to prevent privilege persistence via stale sessions. A **role change** does not: since 2026-09-16 it resets the user's page overrides and writes an `authz-changed` mark, so each live session re-reads its role and page map on its next request, and nobody is signed out (§3.1, §8).

### Technical Interaction Model (Authorize a New User)

1. **Admin Actor** initiates `POST /api/users/manage`.
2. **Admin API (Worker)** validates CSRF tokens and internal RBAC clearance.
3. **Supabase `admin_authorized_users`** is INSERT'd with email, display_name, role, is_active.
4. **Returned UUID** (`id`) is used to write any initial page overrides to D1 `admin_page_overrides`.
5. **Audit Engine** records the event via Ghost Audit Engine (`waitUntil`) and the API returns a sanitized 201 Created response.
6. **On next login:** CF Access authenticates the user → Worker sees their email in whitelist → creates KV session → writes `cf_sub_id` to Supabase idempotently.

## 2. Role Hierarchy (6-Tier)

Access levels operate dynamically based on strict numeric permissions (lower number = higher clearance). Defined centrally in the RBAC module (`src/lib/auth/rbac.ts`). Renamed 2026-07-27 from the previous 5-tier `dev > owner > super_admin > admin > staff` ladder — the database still stores the old values and `normalizeRole()`/`toStoredRole()` translate at the boundary; see the banner at the top of this document and [PERMISSIONS-SYSTEM §4](../architecture/PERMISSIONS-SYSTEM.md) for the full translation table and the naming collision it warns about.

| Level | Role | Capabilities |
|:-----:|:-----|:------------|
| **0** | **Vendor Support** ⚡ | Our support tier — database prunes, raw log access, edits to other privileged accounts. Not assignable via the invite/role picker (`ASSIGNABLE_ROLES` excludes it), but no longer hidden: as of 2026-07-26 it appears in the user list and access-review export like any other account. |
| **1** | **Owner** 💎 | The customer's account holder. Full access including user administration. Protected from modification by every tier below. |
| **2** | **Admin** 👑 | Second in command. Full operational control, including platform settings and users at or below their level. |
| **3** | **Manager** 🛡️ | Runs day-to-day operations — bookings, content, customers, generalized audit logs. No user or platform administration. |
| **4** | **Staff** 👤 | Works in their own area. Cannot change settings or other people. |
| **5** | **Viewer** | Read-only. Opens the home page (Overview) and only the pages given to them with a personal setting; no page can have Viewer as its default (`canBePageDefault`). Refused on every mutating request regardless of page grants, except asking for access (enforced in `src/lib/auth/stages/decide.ts`, not merely absent from the UI). **Can be given since 2026-10-16** (permissions #30): the invite grid and the role dialog offer it (`PICKABLE_ROLES`), and it is stored as `viewer`, which the Supabase role check admits (`supabase/migrations/20261016000000_role_check_add_viewer.sql`). |

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

> **Deprecated aliases (still live; the ratchet counter `E1` in `.ratchet.json` holds the current
> number of call sites):**
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
| `src/pages/api/users/manage.ts` (`src/lib/users/manage-apply.ts`) | `isVendorSupport` and `ROLE_LEVEL` comparisons | Invite, role change, suspend, delete; privileged-account edit protection; the two-person rule (`src/lib/approvals/ask.ts`, §6.3) | ✅ `/dashboard/users`; 10/h RL |
| `src/pages/api/users/access-center.ts` (`src/lib/access-center/handlers.ts`) | `isVendorSupport`, `isOwnerOrVendor` (in `page-gates.ts`), `canManageUser`, `isReadOnly` (in `src/lib/access-center/`) | The Access Center: one person's access in every system, pages and both consoles in one save ([ACCESS-CENTER](ACCESS-CENTER.md); `/api/users/access` was retired 2026-10-03) | ✅ `/dashboard/users`; a console change also needs that console's page (`/dashboard/vps`, `/dashboard/backup`); 5/min RL shared with access-request decisions and Page Registry's personal settings |
| `src/pages/api/users/force-kick.ts` | `denyForceKick`, `isOwnerOrVendor`, `canManageUser` | Session termination: below the owner and vendor support, only with a grant of `#force-kick` (*changed 2026-10-15*) and a strict outrank (*changed 2026-10-14*; until then target protection only) | ✅ `/dashboard/users`, **plus an explicit grant of `#force-kick`** |
| `src/pages/api/users/index.ts` | `requireAuth()` + PLAC (no role floor) | User registry list — every account returned, including hidden/Vendor Support (2026-07-26, see §4) | ✅ `/dashboard/users` (2026-05-26) |
| `src/pages/api/users/pages.ts` | `requireAuth()` + PLAC (no role floor) | Page registry for InviteModal | ✅ `/dashboard/users` (2026-05-26) |
| `src/pages/api/users/probes.ts` | `requireAuth(context, 'owner')` | Unauthorized-access probe roll-up | ✅ `/dashboard/users` (2026-05-26) |
| `src/pages/api/users/cf-access-audit.ts` | `requireAuth(context, 'owner')` | CF Access ↔ Supabase whitelist diff | ✅ `/dashboard/users` (2026-05-26) + 10/min RL |
| `src/pages/api/sessions/active-sessions.ts` | `denySessions`, `canManageUser` | KV active session list + revoke and block; below the owner and vendor support, another person's sessions only with a strict outrank, and never your own account's block (*changed 2026-10-14*) | ✅ `/dashboard/sessions`, **plus `#revoke` on DELETE**; 30/min RL |
| `src/pages/api/sessions/active-revocations.ts` | `denySessions` | KV revocation block list + unblock | ✅ `/dashboard/sessions`, **plus `#unblock` on DELETE**; 30/min RL |
| `src/pages/api/sessions/flush-sessions.ts` | `denySessions` + `isOwnerOrDev` | Bulk session flush — **Owner/Vendor only** | ✅ `/dashboard/sessions`, plus `#flush` |
| `src/pages/api/sessions/sign-in-alerts.ts` (`src/lib/login-alerts/handlers.ts`) | `denySignInAlerts` | The caller's own sign-in alert settings: pause, trusted areas (added 2026-10-03) | ✅ `/dashboard/sessions`, plus an explicit grant of `#alerts` |
| `src/pages/api/users/access-data.ts` | `isVendorSupport`, `isOwnerOrVendor` | How much of the portal one person opens: switched-on pages and actions, each answered by the enforced rules (`personOpens`, in `src/lib/access-center/counts.ts`), and their personal settings in force. Ghost-protected. *Since 2026-10-16* it sends only these counts; until then it sent the whole page table and the person's raw settings | ✅ `/dashboard/users` |
| `src/pages/api/users/[id]/session-status.ts` | `requireAuth()` + PLAC; `isOwnerOrVendor` gates only the ghost-target sub-case | Session telemetry + per-session revocation (ghost-protected) | ✅ `/dashboard/sessions` |
| `src/pages/api/audit/consent.ts` | `isOwnerOrDev` (deprecated alias for `isOwnerOrVendor`) | Consent record deletion | ✅ `/dashboard/logs` |
| `src/pages/api/audit/logs.ts` | role-or-grant | The activity log (read only: its `DELETE` was removed on 2026-10-16) | ✅ `/dashboard/logs` |
| `src/pages/api/audit/seals.ts` | `isOwnerOrVendor` | The daily seals, checked (2026-10-16, [plac-and-audit](../architecture/plac-and-audit.md) §3.6) | ✅ `/dashboard/logs` |
| `src/pages/api/audit/emails.ts` | `isOwnerOrDev` (deprecated alias for `isOwnerOrVendor`) | Email log deletion | ✅ `/dashboard/logs` |
| `src/pages/api/audit/stats.ts` | (admin+ for stats; owner+ for the `#security` tab, via `ROLE_LEVEL`) | Audit summary stats | ✅ `/dashboard/logs` |
| `src/pages/api/audit/login-logs.ts` | role-or-grant | Login forensics (PII) | ✅ `/dashboard/logs` parent-deny propagation (2026-05-26) |
| `src/pages/api/audit/export.ts` | role-or-grant | CSV export | ✅ `/dashboard/logs` parent-deny propagation (2026-05-26) |
| `src/pages/dashboard/logs/index.astro` | `isOwnerOrDev` (deprecated alias for `isOwnerOrVendor`), `isOwnerOrVendor`, `isAdminOrAbove` | Feature flag computation (export, delete, the security tab, the seals, the AI tab) | (page-level — uses middleware PLAC) |
| `src/pages/dashboard/users/[id]/access.astro` | `isVendorSupport`, `isOwnerOrVendor`, `canManageUser` | Hidden account visibility, privilege gate | (page-level — uses middleware PLAC) |

> **The Sessions rows.** The three `src/pages/api/sessions/` rows and `session-status.ts` gate
> on `/dashboard/sessions` since 2026-09-16 (gaps **D-3** and **D-4** in
> `../MAINTENANCE.md` (private)), and the mutating routes also check their action
> fragment through `src/lib/auth/surface-guards.ts`. The Sessions console is documented in
> [`SESSION-MANAGEMENT.md`](SESSION-MANAGEMENT.md), which owns these rows.

> **Signing someone out (`#force-kick`).** Since 2026-10-15 (spec gap D6, closed) the route and
> the Users page ask `denyForceKick` (`src/lib/auth/surface-guards.ts`): the page, then a grant
> of `/dashboard/users#force-kick` (default Owner). Below the Owner and Vendor support nobody
> signs anyone out without that grant, and then only someone they strictly outrank
> (`canManageUser`, since 2026-10-14), so an Admin can sign out a Manager or Staff account and
> never another Admin; `test/session-rank.test.ts`. Without the grant the Users page switches
> **Sign out everywhere** off with its reason. Suspending an account still ends its sessions and
> follows the page and the rank rule, not this key. Every kick also writes a 24-hour `revoked:`
> sign-in block (§5.4).

> [!NOTE]
> **Client-side Preact components** (on Users, `people.ts`, which `UsersConsole.tsx` and `PersonDrawer.tsx` read) use `ROLE_LEVEL` from the shared `types.ts` for UI-only display hints (which controls show switched off, and why; the filters). These are **not** security boundaries — all actual enforcement happens server-side in the routes above.

### 3.1 Session Revocation Workflow (3-Layer Ghost Sweep)

**Changed 2026-09-16.** A role change no longer triggers this cascade, and neither does granting, revoking or resetting a page or approving an access request. Those write an `authz-changed:{userId}` mark; each of the user's live sessions re-reads its role and page map on its next request and nobody is signed out (`../specs/2026-09-16-access-revocation-remediation-design.md` (private), D1). The cascade below still runs for deactivation, deletion, force-kick and the Sessions page's block action; stage 2 of that remediation retires Layer 2.

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
8. **CF Access whitelist (Automated):** Before it answers, the route pushes the whole whitelist to the CF Access Group ("Admin Portal Authorized Users", `syncCfAccessGroup` in `src/lib/auth/cf-access-sync.ts`) and records the outcome ([CF-ACCESS-SYNC](CF-ACCESS-SYNC.md)). No manual intervention is needed in the Cloudflare dashboard. When the push fails, the person is still added, the answer carries a warning, the hourly Access list sync job tries again (§11.1), and the invitation email below is **not** sent: send it from the person's drawer with **Send the invitation again**.

> **Non-fatal override writes:** If the batch override write fails, user creation still succeeds. The admin can set page permissions manually via the Page Access Manager after creation.
> **No GoTrue:** There is no call to `auth.admin.createUser()`.
> **The Worker does send an invitation email.** *Corrected 2026-09-19: this said "The user receives no invitation email from the Worker. CF Access sends its own authentication email/redirect when the user first tries to access `admin.madagascarhotelags.com`."* `POST /api/users/manage` enqueues an invite onto `EMAIL_QUEUE` with `purpose: 'custom_email'` and the tag `admin_invite`, and `src/pages/api/users/resend-invite.ts` exists to send it again. *Since 2026-10-10 the re-send goes onto the same queue (`src/lib/email/queue-mail.ts`), with the role's label, and answers 503 when it could not be queued; until then it called Resend directly, sent the stored role id, and logged the email as `sent` before anything had been sent.* CF Access does also send its own OTP/redirect on first access, but that is in addition. The portal host is **`secure.madagascarhotelags.com`**, not `admin.…`.

### 5.2 Role Selection UI (Invite Modal)

The Invite Modal renders a "Command Console" two-panel dialog, on the shared Dialog
(`src/components/ui/Dialog.tsx`, `size="xl"`) since 2026-10-10: the panels sit side by side
on a wide screen and stack on a phone, and only the dialog's body scrolls.

**Left panel — Identity:**

- **Role Pill Selector**: a two-column pill grid (`grid-cols-2`) over the five pickable roles (`PICKABLE_ROLES`: Owner, Admin, Manager, Staff and, since 2026-10-16, Viewer), with role-specific colours. Roles at or above the actor's level are greyed-out/disabled (the server enforces this too); Vendor Support may pick any of them.
- **Hidden Account Toggle**: Ghost-mode toggle only rendered for Vendor Support and Owner actors. The server honours it only for Vendor Support (`manage.ts`, §4): an Owner who switches it on invites an ordinary, visible account.
- Email + Display Name inputs. Grant Access and Cancel sit in the dialog's footer, under both panels (2026-10-10).

**Right panel — Page Access:**

- **Access Policy** (`invite/PageAccessMatrix.tsx` on the shared `AccessPolicyGrid.tsx`): the live page list (`GET /api/users/pages`), fetched lazily on first modal open, with an error state and **Retry** if the fetch fails. One switch per page, grouped by registry category as the sidebar groups them, each page's `#` features under it; each row says **Active** or **Restricted** for the chosen role.
- A switch starts at the role's answer. Flipping it writes a personal setting the other way (a grant above the role, or a close the role would open), marked **Override**; flipping it back removes the setting.
- The header counts the pages that open and, when there are any, the overrides.
- *Since 2026-10-16* the server checks each setting with the gates a later change on the
  person's Access page meets: you hold the page, you may give it, and a grant clears the page's
  floor for the new role (`inviteSettingRefusals` in `src/lib/access-center/page-gates.ts`). One
  refused setting refuses the whole invitation (403, nobody is invited) and the message names up
  to three of them. The grid still offers every page; until then such settings were written
  unchecked (MAINTENANCE AC-10).

### 5.3 Restoring / Enabling Access

Access is managed via the active flag in the authorization table. When set to true, the login portal accepts the user's JWT.

### 5.4 Revoking / Locking Access

If a user needs immediate revocation:

1. **Soft Lock:** PATCH `/api/users/manage` with `is_active: false` (**Suspend account** in the person's drawer; it needs a recent sign-in, §9.2, and suspending the last active Owner waits for a second person, §6.3). The 3-layer force-kick fires on the PATCH itself, and the PATCH writes an `authz-changed` mark, so any session the kick misses re-verifies on its next request and ends with `account_inactive`. The re-check writes no sign-in block.
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
3. **Full Delete:** *Since 2026-10-16* it needs a recent sign-in (§9.2) and waits for a second person, and nothing below runs until one approves ([PERMISSIONS-SYSTEM §10.7](../architecture/PERMISSIONS-SYSTEM.md), §6.3); suspend the person to cut off their access meanwhile. Then `applyUserDelete` (`src/lib/users/manage-apply.ts`, the same code for a delete made at once and one approved later) removes:
   - their sessions: the 3-layer force-kick (§3.1);
   - their personal page settings: `resetUserOverrides(env.DB, id)` clears their D1 PLAC rows;
   - their Server and Backups console powers: their entries in `vps:access` and `backup:access` (`src/lib/dal/VpsAccessRepository.ts`), so an address invited again starts from its role (the backup entry since 2026-10-15; until then an address invited again got its old backup powers back);
   - the Email API tokens they made, which are blocked (*since 2026-10-16*, permissions item #39: cf-email-consumer `POST /admin/tokens/block-by-creator`, asked as the person removing them with their own Email API permissions; an app that should keep its token is unblocked on Email API → Tokens; [`EMAIL-API-ACCESS.md`](EMAIL-API-ACCESS.md));
   - their settings row (D1 `admin_user_settings`) and their sign-in alert settings, which can hold an approximate location;
   - their whitelist entry: `DELETE FROM admin_authorized_users WHERE email = ?`. **No `auth.admin.deleteUser()` call** — GoTrue is not involved.

   Then the activity-log row, the access-change email (§6.1) and the Cloudflare Access sync. A sync that fails, or tokens that could not be blocked, are a warning on the answer, never a stop: the person is removed either way, and the warning says what to do.
4. **CF Access policy (manual):** The delete's own sync takes the person out of the Access group (§11.1). If the CF Zero Trust application policy also names them in any other way (an email rule, another group), remove that in the Cloudflare Dashboard too, so CF Access never authenticates them again.

### 5.5 Accounts nobody uses

*Added 2026-10-16 (permissions item #17).* An active account nobody uses is switched off on
its own, following CIS Controls v8 safeguard 5.3 (disable an account unused for 45 days). The
rule lives in `src/lib/unused-accounts.ts`; the Users list and the daily job both decide
through it.

- **When an account counts as unused.** From the latest of: its last successful sign-in (the
  sign-in log, or the older stored `last_login_at`, as §9.0), its invitation (`created_at`) and
  the last change made to it on Users (`updated_at`, which §9.2 writes on every change). So a
  person invited but never signed in counts from the invitation, and restoring a suspended
  person starts the count again.
- **At 45 days** the person's card on Users shows a **Not used for N days** badge, and their
  drawer says since when and what happens next (an amber **Unused N d** badge and the expanded
  row until 2026-10-16). The sign-in alert list hears about it
  once: one email, **Accounts nobody uses**, naming each account newly past 45 days.
- **At 90 days** the account is suspended at the next daily check (14:00 UTC, 08:00 in
  Aguascalientes), exactly as a suspension on Users: `is_active` off, the three-layer force-kick
  (§3.1), the permission mark, and one activity-log row "Suspended automatically: not used for
  N days" by `system`. Unlike a suspension on Users, it does not push the Cloudflare Access
  group itself: the group follows on the next run of the hourly Access list sync job (§11.1),
  which sees the list of active emails change; until then the portal refuses the person on its
  own. The email that day names it as suspended. Restore it on Users as any suspended person
  (§5.3).
- **Never suspended automatically:** the Owner, Vendor support, and an account whose stored role
  cannot be read. They are still flagged and emailed.
- **The switch** is the alert policy's **Accounts nobody uses** row (Security → Sessions →
  Alert policy, [SESSION-MANAGEMENT](SESSION-MANAGEMENT.md)): flag at 45 days and suspend at 90
  (the default), flag at 45 days only, or off. Off hides the badge and stops the check.
- **The daily check** runs inside the `access-change-summary` job, only in the hour after
  14:00 UTC (`src/workers/scheduled-unused-accounts.ts`; cost in
  [CRON-CONTROL](CRON-CONTROL.md)). A `notify` row per account (target type `unused_account`,
  labelled with the date its count starts) keeps the same stretch from being emailed twice; a
  send that fails is tried again the next day, and a suspension stands either way.

## 6. UI Implementation (Manage Users Dashboard)

The interface is composed of multiple Preact islands:

| Component | File | Purpose |
|-----------|------|---------|
| **Users console** | `src/components/admin/users/UsersConsole.tsx` | The page since 2026-10-16 (permissions item #29), on the console kit ([DESIGN-SYSTEM](../reference/DESIGN-SYSTEM.md) §9.9): header with Refresh, **Invite someone**, and for the Owner and Vendor support **Check Cloudflare list** and **Re-send to Cloudflare**; four tiles (Active, Signed in now, Not used lately, Suspended) that pick a filter; the filters below; one card per person (role, suspended, devices signed in, unused days, a Cloudflare list problem, hidden, you; last sign-in and added). A card opens the person's drawer. One read of `GET /api/users` on open, on Refresh, after an invitation and after a change |
| **Person drawer** | `src/components/admin/users/PersonDrawer.tsx` | One person's account on the shared Dialog's drawer: Account (email, account ID, added, last sign-in, Cloudflare sign-in and list), Role and access (the counts from `GET /api/users/access-data`, **Change role**, **Open their Access page**), Sessions (**See their sessions**, **Sign out everywhere**), Recent sign-ins (§11.4) and Account actions (**Send the invitation again**, **Suspend account** or **Reactivate account**, **Remove account**). Every action asks first; removing asks for the part of the email before the @. A control the viewer may not use shows switched off with the reason |
| **Role dialog** | `src/components/admin/users/RoleDialog.tsx` | The roles the viewer may give as one row of chips, the preview of what the change does (§9.2), then **Change role** |
| **Waiting for a second person** | `src/components/admin/users/SecondPersonPanel.tsx` | The changes waiting for a second person (§6.3), with Approve and Decline, or Cancel for your own; hidden when nothing waits |
| **Users rules** | `src/components/admin/users/people.ts` | Pure: the filters and counts, why a control is switched off (in the routes' words), the roles to offer. `test/users-console.test.ts` |
| **Page Access Manager** | `src/components/admin/users/access-editor/UserAccessEditor.tsx` | A person's Access page (`/dashboard/users/[id]/access`): their pages, actions and console powers ([ACCESS-CENTER](ACCESS-CENTER.md)) |
| **Invite User Modal** | `src/components/admin/users/InviteUserModal.tsx` | Two-panel "Command Console" Preact island (§5.2) |
| **Role Pill Selector** | `src/components/admin/users/invite/RolePillSelector.tsx` | Atomic: two-column role pill grid with RBAC-gated availability |
| **Hidden Account Toggle** | `src/components/admin/users/invite/HiddenAccountToggle.tsx` | Atomic: ghost-mode toggle (shown to Vendor Support and the Owner; honoured for Vendor Support only) |
| **Access Policy** | `src/components/admin/users/invite/PageAccessMatrix.tsx` | The invitation's page switches, grouped by category, on `src/components/admin/users/shared/AccessPolicyGrid.tsx` |
| **Session drawer** | `src/components/admin/users/sessions/SessionForensicsDrawer.tsx` | One person's sessions on the shared Dialog's drawer (2026-10-10): device, place, sign-in method, times, when each ends by itself, address and Ray ID, and **End session** for every session but the one you are using. It reads session handles, never session IDs ([SESSION-MANAGEMENT.md](SESSION-MANAGEMENT.md)) |

### Event Bus (Cross-Island Communication)

The modal uses CustomEvents for decoupled island-to-island messaging:

| Event | Direction | Purpose |
|-------|-----------|---------|
| Modal open (`modal:open-invite`) | Users console → Invite Modal | Opens the creation dialog |
| User invited (`user:invited`) | Invite Modal → Users console | Reads the list again |
| Cloudflare check (`cf-audit:open`) | Users console → CF Access audit drawer | Opens the cross-reference (§11.6), Owner and Vendor support |
| A change waits (`second-person:changed`) | Person drawer, role dialog → the second-person panel | Reads the waiting list again (§6.3) |

### Filters

*Since 2026-10-16* (permissions item #29; until then three tabs: All, Admins, Staff). Two rows
of chips that scroll sideways, and a search; `filterPeople` in `people.ts` decides.

| Row | Choices |
|-----|---------|
| **Show** | **Everyone** (every account `GET /api/users` returns, hidden ones included since 2026-07-26, §4), **Active**, **Signed in now** (active, with at least one device), **Not used lately** (§5.5), **Suspended**; each with its count |
| **Role** | **Any role**, then each role someone on the list holds, in ladder order. An account whose stored role cannot be read appears only under **Any role** |
| **Search** | Name, email or role name. It is kept in the address as `?search=`, and an address that names one person's exact email opens their drawer (the links in the access request and review emails) |

The list is sorted active first, then by role from the top of the ladder, then by name.

### 6.1 Access requests

*Rebuilt 2026-10-15 (permissions items #2, #3, #6, #19 and #22; open item D11 in the
access-revocation design (private)).*

**Asking.** Someone who reaches a page they cannot open sees the Access denied card
(`src/components/ui/AccessDeniedView.astro`) with **Request access**
(`src/components/ui/RequestAccess.tsx`). The card first asks the server whether the page can be
asked for at all. It cannot when no request could open it, and the card says why instead of
offering a button: a page with a floor (GitHub: only the roles the floor names can ever open
it), Page Registry (only Vendor support gives it, since 2026-10-17, so the card says to ask
Vendor support), a page switched off in Page Registry (named as such since 2026-10-16), an
address that is no page, a page the person can already open, or an Owner or Vendor support (they
open every page already). *Since 2026-10-16 (#25)* the card also says why the page is closed to
them, from their own setting on it: closed for them personally (with the day), a grant whose end
date has passed (with that date), or their role, with the role the page opens for. When none of
those closes it, their access changed a moment ago and the card offers only a Reload. Otherwise the person picks how long they need
it (2 hours, 1 day, 1 week or 30 days, or nothing) and may write why (at most 500 characters).
The request goes to everyone on the sign-in alert list as an email with a button to this page;
the card says whether that email left, so nobody is told "an administrator has been notified"
when none was. A second request for the same page while one waits is refused, and a person may
send at most 5 requests an hour. Once decided, the card shows the decision, the note, and the
end date.

**Deciding.** The **Access requests** panel sits below the list of people, under **Waiting for a
second person** (§6.3), and hides itself when nothing waits
(`src/components/admin/users/AccessRequestsPanel.tsx`). It lists what waits, with the reason and
the length asked for, and the decisions of the last 14 days underneath. The Owner and Vendor
support decide every request. Anyone else with this page decides the requests from the roles
below theirs, and approves only pages they may give; a card they may not approve says why and
still lets them decline. **Approve** opens a pop-up with how long the access lasts (the length
asked for, else 30 days; 2 hours, 1 day, 1 week, 30 days, 90 days, or no end) and a note.
**Decline** opens one with a note. The person gets an email either way and reads the note on
their card. Approving a request for an Owner-level page (one whose default role is Owner or
Vendor support) needs a sign-in from the last 10 minutes when it writes a new grant
([PERMISSIONS-SYSTEM §10.5](../architecture/PERMISSIONS-SYSTEM.md)). Decisions share the Access
Center's limit of 5 access changes a minute.

**What an approval writes.** A personal page switch in `admin_page_overrides` with the end date
picked, and the decision, in one D1 batch, both only if the request is still waiting, so two
people deciding at once cannot both win. If the person already holds that page for longer (or
with no end), that switch is kept, not shortened. The person's open sessions pick the change up
on their next request (`authz-changed`, [PERMISSIONS-SYSTEM §11](../architecture/PERMISSIONS-SYSTEM.md)).
The activity log gets one row per decision (`grant_access` for an approval, `update` for a
decline, surface `access-request`), with the request's id as its correlation id. The four new
columns (reason, length, note, end) are migration `0071`.

**Console permissions** (since 2026-10-16, permissions item #22). Settings → Your access lists,
under Backups and Server, an **Ask for a permission** button: a pop-up with every permission the
person may ask for in each console they can open, as chips, how long they need it (2 hours to 30
days, a day picked to start) and why. The list is the console's own answer to them: nothing they
already hold, nothing their role gives that a personal setting closes, no Owner and Vendor
support permission; the server checks the same again before storing it. The request is stored
like a page request, with `requested_path` set to `console:<console>:<permission>` (for example
`console:backup:runs.run`; `src/lib/access-requests/keys.ts`), so it reuses the table, the
emails, the sidebar badge and this panel. Approving one has no **No end**: the permission is
given **for a while**, kept by the console beside the person's grant (`temporary` in cf-backup
and cf-vps), and counted only until its end, whatever the grant's own end. The approval reads the
person from the console as the decider, refuses a floor and a permission a personal setting
closes (it would open nothing), keeps a longer hold already there, and is checked by the same
delegation rules as an Access Center save: an Admin gives only what they hold in that console.
The request is marked approved first and put back to waiting if the console refuses, so two
people deciding at once never both give it; when the console does not answer, the request stays
approved and the activity log says the outcome is unknown. The console's own audit line becomes
the activity-log row (module `backup` or `vps`, surface `access-request`), with the request's id
as its correlation id.

| Route | Who | What |
|---|---|---|
| `GET /api/access-requests?path=` | anyone signed in | whether this page can be asked for, and their latest request for it |
| `POST /api/access-requests` | anyone signed in | ask: `{ requestedPath, reason?, wantedHours? }`, or for a console permission `{ console, capability, reason?, wantedHours? }` |
| `GET /api/access-requests?view=decide` | this page | the requests this person may decide, and what they may do with each |
| `POST /api/access-requests/[id]` | this page, then the page gates, or for a console permission the console's delegation rules | `{ decision: 'approve', hours?, note? }` (a console permission always has hours) or `{ decision: 'decline', note? }` |

The routes are mapped to the Overview (`/dashboard`), which everyone has, so someone shut out of
a page can still ask for it; until 2026-10-15 they were mapped to Inquiries. The old
`POST /api/audit/requests/[id]/resolve` is gone. Server side: `src/lib/access-requests/`.
Tests: `test/access-requests.test.ts`, and for console permissions
`test/access-console-requests.test.ts`.

**Access changes are emailed** (2026-10-15, item #18). On this page: adding someone, changing a
role, suspending, restoring or deleting someone (`src/lib/users/manage-apply.ts`, also when a
second person approves the change), approving a request for an Owner-level page, and approving
a console permission request. A name change, a declined request and an approved request for
any other page are not emailed (the activity log has each). Each
emails the sign-in alert list after the save: one email per save, or one summary a day, or none,
as the alert policy says (`src/lib/access-changes/notify.ts`). Every change that counts, across
the portal, and the summary: [PERMISSIONS-SYSTEM §10.4](../architecture/PERMISSIONS-SYSTEM.md).
Tests: `test/access-changes.test.ts`.

### 6.2 Quarterly access review

*Added 2026-10-16 (permissions item #24).* Every 90 days the Owner or Vendor support confirms
who can still do what. The **Access review** panel on this page is shown to them only (its API
refuses everyone else), because Page Registry, where the suggestion first put it, is Vendor
support only since 2026-10-15. Panel: `src/components/admin/users/AccessReviewPanel.tsx`; rules:
`src/lib/access-review/rules.ts`; server: `src/lib/access-review/`.

- **When it is due.** 90 days after the last sign-off, or now when none is on record. The panel's
  badge says **Due now**, **N days overdue** or **Next due** with the date, and opens by itself
  while it is due or when the page is opened at `#access-review` (the reminder's link).
- **The walk-through.** Every active account, hidden ones included, one at a time, highest role
  first. For each: their last successful sign-in (the sign-in log, as §9.0), and their last
  recorded action in the Server and Backups consoles, read from the activity log. A refused
  request is not a use, an access change made from the Access Center or Page Registry is about
  someone else, and looking at a console is not recorded, so "no recorded action" can still mean
  they look.
- **The lines, each Keep or Remove.** The account itself (Remove is **Suspend**), each page or
  action someone gave them personally, and each Backups or Server power given to them
  personally. What their role gives is listed under **What their role gives** for reference:
  only the role gives it, so it is kept or removed with the account. A line the reviewer may not
  change (their own account, someone at or above their role, a power they do not hold) offers
  Keep only, with the reason. A system the review could not read is named, so the review is
  known to be incomplete for it.
- **Removing.** Moving on from a person with a line marked Remove asks first, then removes it at
  once through the same routes as the rest of this page: one `POST /api/users/access-center`
  save (a page setting is reset; a console grant is sent again without the removed powers, or
  removed when nothing is left), then `PATCH /api/users/manage` to suspend. Every rule, record
  and email of those routes applies, the recent sign-in for a suspension (§9.2) included.
- **Sign-off.** After the last person, **Sign off the review**, with an optional note. It must
  cover every active account, so someone added during the review is refused back to the screen
  by name. It writes one activity-log row: action `access_review`, module `users`, target
  `access_review` / `quarterly`, with each person's email, role, how many lines were kept, what
  was removed and whether they were suspended. That row is the review's only record, and the next
  due date counts from it. The log keeps 180 days.
- **The reminder.** While the review is due, the sign-in alert list gets **Access review due**,
  then again every 7 days until someone signs off. It is sent by the `access-change-summary` job
  in the hour after 14:00 UTC (`src/workers/scheduled-access-review.ts`; cost in
  [CRON-CONTROL](CRON-CONTROL.md)), and each email leaves a `notify` row (target
  `access_review` / `reminder`, labelled with the due date).

| Route | Who | What |
|---|---|---|
| `GET /api/users/access-review` | Owner and Vendor support | when it is due, the last sign-off, every active account with its last sign-in and console use |
| `POST /api/users/access-review` | Owner and Vendor support | the sign-off: `{ people: [{ userId, kept, removed, suspended }], note? }`; 409 names any active account left out |

Tests: `test/access-review.test.ts`.

### 6.3 Changes that need a second person

*Added 2026-10-16 (permissions item #36).* Four changes wait for a second person instead of
happening at once, among them making someone Owner or Vendor support and removing a person. The
rule, its reasons and its limits are owned by
[PERMISSIONS-SYSTEM §10.7](../architecture/PERMISSIONS-SYSTEM.md); the decisions behind it are
in the [design](../specs/2026-10-16-two-person-rule.md). This section is the screen.

| The change | Where it is asked |
|---|---|
| Making someone Owner or Vendor support | the person's drawer, **Change role** |
| Removing a person | the person's drawer, **Remove account** |
| Removing the last active Owner (a role change or a suspension) | the Owner's drawer; or **Lock out** on Security → Sessions, which is a suspension too ([SESSION-MANAGEMENT](SESSION-MANAGEMENT.md)) |
| Changing how long the server keeps a log | Server → Log storage (the portal's gateway holds it, [VPS-CONSOLE](VPS-CONSOLE.md) §2) |

- **Asking.** The usual checks run first, the recent sign-in included (§9.2). Then the route
  answers `202` with `{ success: false, pending: true, error }`, and the drawer or dialog shows
  the message as a notice: why it waits, until when, and that nothing has changed. A removal's
  message adds that suspending cuts off access now. Asking again for the same change returns the
  one already waiting. A request that changes something else too (a name with a role) is refused
  with 400: make the listed change on its own. At most 20 changes wait at once across the portal
  (`MAX_WAITING`, `src/lib/approvals/rules.ts`); a 21st is refused with 409 until one is decided
  or cancelled.
- **Who is told.** Every active Owner and Vendor support but the asker is emailed **Needs a
  second person**, with a link to `/dashboard/users#second-person`.
- **The panel.** **Waiting for a second person** sits above Access requests. The Owner and
  Vendor support see every waiting change and may approve or decline the ones they did not ask
  for; anyone else with this page sees only their own and may cancel it. Each card says what the
  change is, why it needs a second person, who asked and when, and until when it waits (3 days).
- **Deciding.** Approve and Decline ask first, with an optional note of up to 200 characters for
  the person who asked. Approving needs a sign-in from the last 10 minutes; it checks the change
  again as the person who asked, makes it as the approver, and reloads the people list. When a
  check fails nothing changes and the change stops waiting. Either way the asker is emailed the
  outcome.
- **Invitations.** Inviting someone straight in as Owner or Vendor support is refused while
  someone else could approve (§9.1).
- **Alone.** When nobody else could approve, the change is made at once and its activity row says
  it had no second person.

| Route | Who | What |
|---|---|---|
| `GET /api/users/approvals` | anyone with this page | the waiting changes: all of them for the Owner and Vendor support, your own for anyone else |
| `POST /api/users/approvals` | the Owner and Vendor support who did not ask; the asker, to cancel | `{ id, decision: 'approve' \| 'decline' \| 'cancel', note? }`; 404 when it no longer waits, 409 when someone decided it first or a check failed, 429 past 10 decisions a minute |

Every step writes one activity-log row, action `second_person`, beside the change's own row.
Tests: `test/two-person-rule.test.ts`.

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

- A person's Access page (the Access Center, [ACCESS-CENTER](ACCESS-CENTER.md)) lists every page, page action and console permission with this person's state and why.
- Switches change a draft; the changes are reviewed and saved together in one `POST /api/users/access-center`.
- A switch the viewer may not use is disabled, with the reason.
- **Role Mutation Pipeline (Ghost Protection Invalidation):** Changing a user's role is a high-risk event. Any role update triggers a synchronous security cascade:
  1. `resetUserOverrides`: Purges all historical custom page overrides, returning the user to a clean RBAC state.
  2. `markAuthzChanged` (`src/lib/auth/authz-signal.ts`): each live session re-reads role and page map on its next request. Until 2026-09-16 this step was `forceLogoutUser`, whose 24-hour sign-in block locked the changed user out of the portal.

## 9. API Data Contracts

All administrative user management actions are performed via `POST`, `PATCH`, and `DELETE` methods on the `/api/users/manage` endpoint.

### 9.1 POST /api/users/manage (Invite User)

Accepts email, display name, role, hidden status, and any initial page overrides. Returns a sanitized success/error message without exposing internal stack traces.

*Since 2026-10-16 (permissions item #36)* an invitation as Owner or Vendor support is refused
with 403 while another active Owner or Vendor support could approve: invite with another role,
then change it, which waits for a second person (§6.3). When nobody else could, as when Vendor
support makes a new portal's first Owner, it goes ahead and its activity row says so.

### 9.2 PATCH /api/users/manage (Modify User)

Accepts updates for active status, display name, and role. Mutates the Supabase whitelist, writes an `authz-changed` mark for every change, and runs the force-kick cascade only on deactivation. *Since 2026-10-15* the Users page shows the route's refusal in words when a role change, suspension or deletion fails; until then it went only to the browser console and the role menu snapped back. *Since 2026-10-16 (permissions item #29)* every change starts from the person's drawer and asks first, suspending included (until then Suspend acted on one tap), and a refusal shows in the drawer as well as in a toast.

*Since 2026-10-16 (permissions items #8 and #27)* a role change asks `GET /api/users/role-preview?userId=&role=` what it does before anything is saved. **Change role** in the person's drawer opens `RoleDialog.tsx`: the roles the viewer may give sit in a row of chips (the current one switched off, marked "(now)"), and picking one shows the answer below it (`RoleChangePreview.tsx`): the pages it opens and closes, the actions gained and lost, the personal page settings it deletes (each with "given" or "closed" and its end date, and a count of those that no longer apply), and, for each console the viewer can open, the permissions gained and lost there; console grants stay. Nothing is saved until **Change role** is pressed; Cancel or closing the dialog leaves the role as it was, and the card shows the new role only once it is saved. A preview the server refuses (the same refusals as this route) is shown in the dialog and **Change role** stays off; a preview that fails to load still lets the change go ahead, with what every role change does. A suspended account's role cannot be changed until it is reactivated. Until then a role change saved at once and deleted the settings without a word.

*Since 2026-10-16 (permissions item #14)* changing a role, suspending a person (`is_active` from on to off) and deleting one (`DELETE`) need a sign-in from the last 10 minutes; so does signing someone out with `/api/users/force-kick`. Otherwise the route refuses with 403 and nothing changes, and the page opens **Confirm it's you**, which signs the viewer out and back in and returns them to Users. A name change or restoring a person does not ask. The rule and its full list of actions: [PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §10.5.

*Since 2026-10-16 (permissions item #36)* making someone Owner or Vendor support, deleting a
person and suspending or demoting the last active Owner answer `202` and wait for a second
person instead (§6.3). Suspending anyone else stays immediate.

*Since 2026-10-16 (permissions item #17)* every change also writes `updated_at`, which the
check of accounts nobody uses (§5.5) reads as the last time the account was used. The column
existed but nothing wrote it.

### 9.0 GET /api/users (the list)

*Corrected 2026-10-15.* "Last sign-in" is the newer of `admin_authorized_users.last_login_at`
and the person's newest successful sign-in in `admin_login_logs` (one grouped read,
`LoginLogRepository.getLastSuccessByEmail`). This app never writes `last_login_at`; only an
older system did, so on its own it was empty for four of five accounts and months old for the
fifth (live, 2026-10-15). The sign-in log keeps a year.

*Since 2026-10-16* each active person also carries `unused`: null, or since when the account
has gone unused, for how many days, and the day it is suspended (null when it never is), as
§5.5 decides with the alert policy's setting.

### 9.3 POST /api/settings/user (a name, from Settings)

*Added 2026-10-10.* Settings → Other people changes only another person's display name, for
someone holding `/dashboard/settings#others` (checked by exact key; Admin and above by default,
migration `0068`) whose role is above the target's (vendor support: anyone). It writes the same
Supabase column as 9.2, audits the change and writes an `authz-changed` mark so the person's
sessions show the new name on their next request. Theme and every other field stay the person's
own.

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

> **[`CF-ACCESS-SYNC.md`](CF-ACCESS-SYNC.md) is the source of truth** for this system: the
> architecture, the 2026-07-24 root-cause fix (a silent-failure bug in the sync's response
> validation), the sync-attempt log, the hourly reconcile, the per-person state on Users,
> **Re-send to Cloudflare**, and live Group-membership drift detection. This section is a
> summary only.

The admin portal integrates **CF Zero Trust with an automated Access Group**. The Worker pushes the whole Supabase `admin_authorized_users` whitelist to a Cloudflare Access Group named "Admin Portal Authorized Users" whenever someone is invited, changed or removed on Users (`manage.ts`, and `src/lib/users/manage-apply.ts` for changes, including those a second person approves) and when someone is locked out on Sessions, **and on a reconciliation pass** that runs hourly (the `cf-access-reconcile` job: it rides the five-minute trigger, and its Cron Control interval has been 60 minutes since 2026-10-04). The daily suspension of accounts nobody uses (§5.5) does not push the group itself; that pass catches it. This means unauthorized emails are intended to be blocked at the Cloudflare edge *before* they reach the Worker middleware — **contingent on the CF Access Application's Policy actually including this Group**, which is dashboard-side configuration this codebase cannot verify automatically (see `CF-ACCESS-SYNC.md`'s "Known limitation").

```text
Invite / change / remove on Users, Lock out on Sessions
  → syncCfAccessGroup (manage.ts, manage-apply.ts, active-sessions.ts)
  → CF Access Group ("Admin Portal Authorized Users") is updated
  → outcome logged to D1 cf_access_sync_log + swept to cf_sync_status on every active user
    (Users only; the Sessions lock-out records no outcome)

Self-heal: reconcileCfAccessGroup(), hourly. It is hash-or-age gated: it calls
Cloudflare only when the active whitelist's hash differs from the one stored at
its last successful push, or that push is older than the max-staleness window
(cf-access-reconcile-max-staleness-hours, default 24 h). A failed inline push is
caught within the hour; out-of-band drift in the Cloudflare dashboard within a day.

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
| `GET /api/users/[id]/login-history` | owner+ | Last 15 login events from `admin_login_logs` with CF ZT metadata. Since 2026-10-16 each open writes one `view` row (module `users`, target the person), through `recordView` (`src/lib/audit-views.ts`; permissions item #20) |
| `GET /api/users/probes` | owner+ | Unauthorized access attempts (is_authorized_email = 0), grouped by email |
| `GET /api/users/cf-access-audit` | owner+ | Live cross-reference: CF Access users list vs Supabase whitelist, plus `groupMembershipDrift` (live Access Group membership vs whitelist — see `CF-ACCESS-SYNC.md`) |
| `POST /api/users/cf-resync` | owner+; 10/h RL | **Re-send to Cloudflare** in the Users header: an immediate whitelist → CF Access Group push, past the reconcile's gate (see `CF-ACCESS-SYNC.md`) |

### 11.4 Recent sign-ins (the person drawer)

*Since 2026-10-16 (permissions item #29)* in the person's drawer (§6); until then in the
expanded table row. For the Owner and Vendor support only, as its route
(`GET /api/users/{id}/login-history`, `requireAuth(context, 'owner')`); anyone else sees a line
saying so. **Show recent sign-ins** reads the last 15 sign-in events from `admin_login_logs`, and
the read is recorded as a view (`recordView`). Each row shows:

| Shown | Source | Notes |
|--------|--------|-------|
| When | `created_at` | Date and time, and how long ago |
| Outcome | `event_type` + `success` | "Signed in", or the refusal (Failed, Blocked) |
| Method | `cf_access_method` or `login_method` | Google, GitHub, an email code, or unknown |
| Place | `geo_location` + `colo` | "City, Country (Cloudflare data centre)", or "Place not recorded" |
| Address | `ip_address` | Masked to `X.X.***.***` **server-side** for anyone but Vendor Support. (The live-sessions APIs behave differently — see §11.8.) |
| Bot score | `cf_bot_score` | Cloudflare's bot score, when recorded |
| Ray | `cf_ray_id` | The full Cloudflare Ray ID |

Above the rows, the `summary`: how many sign-ins worked and how many were refused, of all on
record for this email.

**See their sessions** in the same drawer opens `SessionForensicsDrawer`: one person's sessions,
with device, place, times, when each ends by itself and **End session** (on the shared Dialog
since 2026-10-10). See §6 for the component.

### 11.5 Access Probe Feed

The `AccessProbePanel` component (rendered below the User Registry for Owner+ only, `client:idle`) surfaces emails that successfully authenticated via CF OTP but were blocked by the Supabase whitelist gate.

> **Note on Edge Blocking:** Since the system now uses automated Cloudflare Access Group synchronization (blocking unauthorized emails at the CF Edge), the Worker middleware will rarely see unauthorized attempts, meaning the Access Probe Feed will likely remain empty unless the CFZT policy is temporarily changed to OTP-Open.

Each probe row shows: email | attempt count | last seen | CF access method | bot score | geo location. A "+ Whitelist" button pre-fills the InviteUserModal with the probed email for immediate onboarding.

### 11.6 CF Access Audit Cross-Reference

**Check Cloudflare list** in the Users page's header ("CF Audit" in the toolbar until 2026-10-16; Owner+ only) opens `CfAuditDrawer`, which fetches live data from the CF Access users API and cross-references with the Supabase whitelist:

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
| Session IDs | Server-only | KV key names never returned to client. *Corrected 2026-10-10: until then `active-sessions` and `session-status` did return each session's ID, which is its cookie; both now send a one-way handle (`sessionRef`, [SESSION-MANAGEMENT.md](SESSION-MANAGEMENT.md)).* **Note:** session *metadata* (IP, User-Agent, geolocation, Ray ID, lastActiveAt) is returned via the `session-status` API to any actor with **`/dashboard/sessions`** PLAC access (ghost-protected targets require Owner+ — see §2.1) — only the session ID itself remains server-only. |
| Full IP addresses — **login history** | Vendor Support actor only | `GET /api/users/[id]/login-history` masks to `X.X.***.***` server-side for everyone below Vendor Support. |
| Full IP addresses — **live sessions** | **Any canonical Admin** | *Corrected 2026-09-19: the single row here said "Vendor Support actor only", which is true of login history and false of live sessions.* `GET /api/sessions/active-sessions` and `GET /api/users/[id]/session-status` return the unmasked `ipAddress` of every session to anyone holding `/dashboard/sessions`. The masking those screens show is applied in the browser (`maskIp`), so it is a display convention, not an access boundary. See [`SESSION-MANAGEMENT.md`](SESSION-MANAGEMENT.md); logged in `../MAINTENANCE.md` (private). |
| `cf_ray_id` | Owner+ via Login Intelligence | Non-sensitive; useful for CF dashboard cross-reference |
| Probe emails | Owner+ only | Reveals who is probing the system |
| CF audit cross-reference | Owner+ only | Reveals CF Access org-level user list |

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-17 | The Access denied card's list of pages that cannot be asked for, against `checkAsk` in `src/lib/access-requests/rules.ts` (Page Registry refused since that day); `test/access-requests.test.ts` passes | Everything else; the card in a phone browser |
| 2026-10-16 | **Accuracy and GitHub pass (`claude`).** §2.1's table rebuilt so every row renders (its two notes moved below it, the duplicate Access Center row merged, `manage.ts`, `logs/index.astro` and `access.astro` helper names corrected against `src/lib/auth/rbac.ts` and each file); §2's Viewer row cut to what is true now; the top banners trimmed; §5.1's sync step (pushed before the answer, and a failed push skips the invitation email) against `manage.ts`; §5.2's hidden toggle and right panel against `InviteUserModal.tsx`, `HiddenAccountToggle.tsx`, `PageAccessMatrix.tsx` and `AccessPolicyGrid.tsx`; §5.4's delete against `applyUserDelete` and `blockEmailTokens` in `src/lib/users/manage-apply.ts`; §5.5's Access group (no inline push) against `src/workers/scheduled-unused-accounts.ts`; §6.1's panel place, Owner-level approval sign-in and emailed actions against `src/pages/dashboard/users/index.astro`, `src/lib/access-requests/handlers.ts` and `src/lib/access-changes/notify.ts`; §6.3's Lock out, `MAX_WAITING` and decision limit against `src/lib/approvals/` and `active-sessions.ts`; §8's editor; §11.1 and §11.3 against `cf-access-reconcile.ts`, `cf-resync.ts`, `UsersConsole.tsx` and the live `cron-control` row (D1 connector: `cf-access-reconcile` on, 60 minutes) | No test run (shared checkout); §3, §4, §7, §9 to §10 and §11.4 to §11.8 not re-derived; the screens in a phone browser |
| 2026-10-16 | **Scope-limited to §5.4's delete step (email API tokens blocked, permissions item #39).** `src/lib/users/manage-apply.ts` (`applyUserDelete`, `blockEmailTokens`, `syncWarning`), `src/lib/email-console.ts` (`blockTokensByCreator`) and cf-email-consumer's `api/src/console.ts` (`tokens.block_by_creator`); `test/two-person-rule.test.ts` passes | The live email service; every other section |
| 2026-10-16 | **Scope-limited to the second person (permissions item #36):** §5.4's delete step, §6's panel and event rows, §6.3, new, and the sentences in §9.1 and §9.2, against `src/pages/api/users/manage.ts`, `src/pages/api/users/approvals.ts`, `src/lib/approvals/` (`ask.ts`, `handlers.ts`, `mail.ts`, `rules.ts`), `SecondPersonPanel.tsx`, `PersonDrawer.tsx`, `RoleDialog.tsx` and `src/pages/dashboard/users/index.astro`; `test/two-person-rule.test.ts` (22 tests) passes | The panel in a phone browser (the owner's test); every other section |
| 2026-10-16 | **Scope-limited to Viewer (permissions item #30): the role-names callout, §2's Viewer row and §6's pill grid.** `src/lib/auth/rbac.ts` (`LEGACY_TO_CANONICAL`, `CANONICAL_TO_LEGACY`, `canBePageDefault`, `PICKABLE_ROLES`), `stages/decide.ts` (the read-only rule and its one exception), `plac.ts` (the home page); `test/rbac-roles.test.ts`, `test/plac.test.ts`, `test/pipeline-decision.test.ts`, `test/users-console.test.ts` pass. Live: the Supabase role check after `20261016000000_role_check_add_viewer` (read back through the Supabase connector) | Giving someone Viewer in a phone browser (the owner's test) |
| 2026-10-16 | **Scope-limited to §6.1's console permissions paragraph and route rows (permissions item #22).** Read `src/lib/access-requests/handlers.ts` (`askForPower`, `decidePower`, `powerDecideView`), `rules.ts` (`checkPowerAsk`, `powerApproval`), `keys.ts`, `AccessRequestRepository.reopenApproval`, `AskForPermission.tsx` and `AccessRequestsPanel.tsx`; `test/access-console-requests.test.ts` (21 tests) | The rest of §6.1 and the document |
| 2026-10-16 | **Scope-limited to §2's audit route rows (permissions item #21).** `src/pages/api/audit/logs.ts` (role-or-grant, no `DELETE`), `seals.ts` (`isOwnerOrVendor`, then the page check); `src/pages/api/audit/prune.ts` deleted, so its row went | The other rows of §2 |
| 2026-10-16 | **Scope-limited to the Users page rebuild (permissions item #29):** §2.1's `access-data` row and the client-side note, §5.5's badge, §6 (components, events, filters), §9.2's drawer and role dialog, §11.4 and §11.6's button, against `UsersConsole.tsx`, `PersonDrawer.tsx`, `RoleDialog.tsx`, `people.ts`, `src/pages/dashboard/users/index.astro`, `src/pages/api/users/access-data.ts`, `src/lib/access-center/counts.ts` and `src/pages/api/users/[id]/login-history.ts`; `test/users-console.test.ts` passes (the counts agree with `computeAccessMap` and the page gate over the test D1) | The page in a phone browser (the owner's test); every other section |
| 2026-10-16 | **Scope-limited to §6.2 (new).** `src/lib/access-review/` (`rules.ts`, `store.ts`, `handlers.ts`), `src/pages/api/users/access-review.ts`, `src/workers/scheduled-access-review.ts`, the `access-change-summary` handler in `src/lib/jobs/registry.ts`, `AuditLogRepository.ts` (`getLatestTargetRow`, `getLastConsoleUse`), `AccessReviewPanel.tsx`, `src/pages/dashboard/users/index.astro`; `test/access-review.test.ts` passes. Live: the console-use query against `madagascar-db` through the D1 connector (two people with Server rows, none with Backups rows) | The panel, the removals and the reminder email in a phone browser and a real inbox (the owner's test) |
| 2026-10-16 | **Scope-limited to §11.3's login-history row.** `src/pages/api/users/[id]/login-history.ts`, `src/lib/audit-views.ts`; `test/sensitive-views.test.ts` passes | The rest of §11 |
| 2026-10-16 | **Scope-limited to §5.5 (new) and the #17 notes in §9.0 and §9.2.** `src/lib/unused-accounts.ts`, `src/workers/scheduled-unused-accounts.ts`, the `access-change-summary` handler in `src/lib/jobs/registry.ts`, `AuthorizedUserRepository.ts` (`listActiveWithDates`, `suspendIfActive`), `api/users/index.ts`, `manage.ts` (PATCH `updated_at`), `UnusedBadge.tsx`; `test/unused-accounts.test.ts` passes. Live: each active account's last successful sign-in (D1 connector) | The badge and the email in a phone browser and a real inbox (the owner's test) |
| 2026-10-16 | **Scope-limited to §9.2's recent sign-in paragraph.** `src/pages/api/users/manage.ts` (PATCH, DELETE), `force-kick.ts`, `src/lib/auth/fresh-sign-in.ts`; `test/fresh-sign-in.test.ts` and `test/session-rank.test.ts` pass | The dialog and the return after signing in again in a phone browser (the owner's test) |
| 2026-10-16 | **Scope-limited to §9.2's role change confirmation.** `UsersTable.tsx` (`handleRoleChange`, `fetchRolePreview`), `InlineRoleSelector.tsx`, `RoleChangePreview.tsx` (server-rendered with sample data), `src/lib/access-center/role-preview.ts`; `test/role-preview.test.ts` passes | The dialog in a phone browser (the owner's test) |
| 2026-10-16 | **Scope-limited to the invitation's page settings (§5's right panel) and §6.1's asking paragraph.** `src/pages/api/users/manage.ts` (POST), `page-gates.ts` (`inviteSettingRefusals`), `src/lib/access-requests/rules.ts` (`whyClosed`, `checkAsk`), `handlers.ts`, `RequestAccess.tsx`; `test/access-why.test.ts` passes | The rest of the document; the card and the invitation in a phone browser (the owner's test) |
| 2026-10-15 | **Scope-limited to §6.1's access-change paragraph.** `src/pages/api/users/manage.ts` (POST, PATCH, DELETE) and `src/lib/access-requests/handlers.ts` against `src/lib/access-changes/notify.ts`; `test/access-changes.test.ts` | Whether the email arrives in a real inbox (the owner's phone test) |
| 2026-10-15 | **Scope-limited to §6.1, new.** Access requests against `src/lib/access-requests/` (`rules.ts`, `handlers.ts`, `mail.ts`), `AccessRequestRepository.ts`, `RequestAccess.tsx`, `AccessRequestsPanel.tsx`, `src/lib/auth/routes.ts` and `test/access-requests.test.ts`; the live `admin_access_requests` columns after `0071` (D1 connector) | Whether the request email arrives in a real inbox (the owner's phone test) |
| 2026-10-15 | **Scope-limited.** §2's Viewer row and §6's pill grid against `rbac.ts` (`PICKABLE_ROLES`), `InlineRoleSelector.tsx` and `RolePillSelector.tsx`; §5's full delete against `manage.ts` and `VpsAccessRepository.ts`; §9.0 against `api/users/index.ts`, `LoginLogRepository.ts` and the live `admin_login_logs` and `admin_authorized_users` rows (D1 and Supabase connectors); `test/users-last-sign-in.test.ts`, `test/vps-access.test.ts`, `test/rbac-roles.test.ts` | Every other section (last fully re-derived 2026-09-19) |

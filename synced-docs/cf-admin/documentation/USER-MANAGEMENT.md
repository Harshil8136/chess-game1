{% raw %}
# Manage Users & RBAC Architecture

> **Component:** CF-Admin Role-Based Access Control (RBAC) System
> **Framework:** Astro 6 + Preact + Cloudflare Workers
> **Auth Provider:** Cloudflare Zero Trust Access (identity) + Supabase authorization whitelist (access control)
> **Last Updated:** 2026-05-02 (v4.5: documentation audit pass; content verified against live codebase)

This document details the exact flow and architecture for managing administrative access within the internal admin portal (`cf-admin`).

## 1. System Overview & Security Posture

The CF-Admin portal enforces a strict separation between **identity** (who you are) and **authorization** (what you can do):

- **Identity — Cloudflare Zero Trust Access:** CF Access validates the user's identity at the edge (Google/GitHub/OTP). No login form, no magic links, no client-side secrets. The Worker receives `CF-Access-Authenticated-User-Email` + `CF-Access-JWT-Assertion` headers on every authenticated request — CF handles the entire OAuth flow.
- **Authorization — Supabase Whitelist:** Only emails in `admin_authorized_users` (Supabase PostgreSQL) with `is_active = true` can create a KV session. CF authenticating a user does NOT grant them access — the whitelist check is the second gate.
- **Service-Role Isolation:** All Supabase operations (whitelist reads/writes, bookings, chatbot, consent) use `SUPABASE_SERVICE_ROLE_KEY`, accessed only server-side — bypasses RLS entirely, never exposed to the client.
- **No GoTrue:** `auth.admin.createUser()`, `auth.admin.deleteUser()`, `supabase.auth.signInWithOtp()`, and the `admin_sessions` table have been fully removed from all code paths.
- **CSRF Protection:** All mutation requests are validated via stateless Origin + Referer header checking, applied globally by middleware.
- **Error Sanitization:** All API error responses return generic messages — no internal stack traces, SQL errors, or schema details leak to the client.
- **Ghost Protection (3-Layer Force-Kick):** Role mutations trigger a synchronous security cascade across KV + CF API to prevent privilege persistence via stale sessions.

### Technical Interaction Model (Authorize a New User)

1. **Admin Actor** initiates `POST /api/users/manage`.
2. **Admin API (Worker)** validates CSRF tokens and internal RBAC clearance.
3. **Supabase `admin_authorized_users`** is INSERT'd with email, display_name, role, is_active.
4. **Returned UUID** (`id`) is used to write any initial page overrides to D1 `admin_page_overrides`.
5. **Audit Engine** records the event via Ghost Audit Engine (`waitUntil`) and the API returns a sanitized 201 Created response.
6. **On next login:** CF Access authenticates the user → Worker sees their email in whitelist → creates KV session → writes `cf_sub_id` to Supabase idempotently.

## 2. Role Hierarchy (5-Tier)

Access levels operate dynamically based on strict numeric permissions (lower number = higher clearance). Defined centrally in the RBAC module:

| Level | Role | Capabilities |
|:-----:|:-----|:------------|
| **0** | **DEV** ⚡ | Absolute system access + hidden account creation + dev tools + DB admin |
| **1** | **Owner** 💎 | Project ownership + billing + API keys + view hidden accounts |
| **2** | **SuperAdmin** 👑 | Full access + user management + settings (cannot see hidden accounts) |
| **3** | **Admin** 🛡️ | Content management + bookings + reports. Cannot manage users. |
| **4** | **Staff** 👤 | Standard entry level, read-only metrics, minimal interaction. |

### Color Hierarchy: Thermal Gradient

The badge colors follow a **thermal gradient** designed for maximum readability on dark UI surfaces — progressing from Red (danger/system) through Emerald (ownership), Amber (authority), Purple (management), to Blue (operations).

### Hierarchy Logic Gate

Permission checks are performed using an integer-based comparison of the `ROLE_LEVEL` map.
- **Logic**: `ROLE_LEVEL[userRole] <= ROLE_LEVEL[requiredRole]`
- **Implementation**: `src/lib/auth/rbac.ts`

> [!IMPORTANT]
> **No Hardcoded Strings:** You must **never** use hardcoded string comparisons (e.g., `user.role === 'dev'`) for authorization checks in Astro pages or API routes. Always use the hierarchical helper functions (`isDev`, `isOwner`, `isAdmin`, etc.) to ensure that new roles are automatically accounted for without causing unexpected `unauthorized` errors.

| Function | Logic | Purpose |
|----------|-------|---------|
| `hasPermission` | `userLvl <= reqLvl` | Core O(1) gatekeeper |
| `isDev` | `role === 'dev'` | Lock critical system internals |
| `isOwner` | `userLvl <= 1` | Billing and Ownership clearance |
| `isOwnerOrDev` | `userLvl <= 1` | Access to hidden/ghost account visibility |
| `isSuperAdmin` | `userLvl <= 2` | User Management clearance |
| `isAdmin` | `userLvl <= 3` | Content & Bookings clearance |

### 2.1 Enforcement Coverage

All server-side authorization gates (API routes and Astro SSR pages) **must** use the helpers above. The following files have been fully migrated:

| File | Helper(s) Used | Gate Purpose |
|------|---------------|--------------|
| `src/pages/api/users/manage.ts` | `isDev`, `isOwnerOrDev` | Role mutation, ghost protection |
| `src/pages/api/users/access.ts` | `isDev`, `isOwnerOrDev` | PLAC provisioning |
| `src/pages/api/users/force-kick.ts` | `isOwnerOrDev` | Session termination |
| `src/pages/api/users/activity.ts` | `isOwnerOrDev` | Ghost protection on activity logs |
| `src/pages/api/features/toggle.ts` | `isDev` | Feature flag mutation |
| `src/pages/api/diagnostics/ping.ts` | `isDev` | System diagnostics |
| `src/pages/api/audit/consent.ts` | `isOwnerOrDev` | Consent record deletion |
| `src/pages/api/audit/logs.ts` | `isOwnerOrDev` | Audit log deletion |
| `src/pages/api/audit/emails.ts` | `isOwnerOrDev` | Email log deletion |
| `src/pages/api/audit/prune.ts` | `isDev` | Log pruning |
| `src/pages/dashboard/logs/index.astro` | `isDev`, `isOwnerOrDev` | Feature flag computation |
| `src/pages/dashboard/users/[id]/access.astro` | `isDev`, `isOwnerOrDev` | Hidden account visibility, privilege gate |

> [!NOTE]
> **Client-side Preact components** (e.g., `DangerZone.tsx`, `ExpandedRow.tsx`, `UsersRegistry.tsx`) use `ROLE_LEVEL` from the shared `types.ts` for UI-only display hints (ghost protection badges, filter tabs). These are **not** security boundaries — all actual enforcement happens server-side in the routes above.

### 3.1 Session Revocation Workflow (3-Layer Ghost Sweep)

When a user's role is changed or their account is deactivated, the system triggers a **3-Layer Security Cascade** to prevent stale sessions from retaining high-privilege access at any layer:

1. **Verification**: Manager privilege clearance is verified.
2. **Whitelist Update**: Supabase `admin_authorized_users` is updated with the new role/status.
3. **Override Purge**: `resetUserOverrides(env.DB, userId)` deletes all D1 page overrides → clean RBAC state.
4. **Layer 1 — KV Session Deletion**: LISTS `user-session:{userId}:*` (reverse-index pattern, O(k)) → deletes all matching session keys. User's KV session is gone.
5. **Layer 2 — KV Revocation Flag**: Writes `revoked:{userId}` → `'1'` to KV with 24h TTL. Middleware checks this flag before any new session bootstrap — prevents the "CF Access cookie still valid → auto-bootstrap" gap.
6. **Layer 3 — CF Access API Revocation**: `DELETE /accounts/{accountId}/access/users/{cfSubId}/active_sessions` — invalidates the CF_Authorization cookie at the CF edge immediately. User's next request is intercepted by CF Access → redirect to login. `cfSubId` read from KV session; falls back to `admin_authorized_users.cf_sub_id` if no active session.

**Reverse-Index KV Pattern:**
Secondary index `user-session:{userId}:{sessionId}: '1'` allows targeted `LIST` for O(k) deletion instead of O(total_sessions) full-namespace scan.

## 4. Hidden Accounts System

A special feature allowing **completely invisible** admin accounts for covert operations or monitoring.

| Aspect | Detail |
|--------|--------|
| **Storage** | A boolean flag in the authorized users table marks accounts as hidden |
| **Creation** | DEV-only — via the user management API with hidden flag enabled |
| **Visibility** | Only DEV and Owner see hidden accounts in user listings |
| **Anti-Enumeration** | Hidden accounts are excluded from user counts shown to lower roles. Unauthorized queries receive an identical 404 response shape whether or not the account exists. |

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
8. **CF Access whitelist (manual):** The new user must also be added to the CF Access policy (Emails allowed list) in the Cloudflare Zero Trust dashboard if not covered by a wildcard policy. **This is a manual step — the Worker API only manages the Supabase whitelist.**

> **Non-fatal override writes:** If the batch override write fails, user creation still succeeds. The admin can set page permissions manually via the Page Access Manager after creation.
> **No GoTrue:** There is no call to `auth.admin.createUser()`. The user receives no invitation email from the Worker. CF Access sends its own authentication email/redirect when the user first tries to access `admin.madagascarhotelags.com`.

### 5.2 Role Selection UI (Invite Modal)
The Invite Modal renders a "Command Console" two-panel dialog:

**Left panel — Identity:**
- **Role Pill Selector**: 2×2 pill grid with role-specific colors. Roles at or above actor's level are greyed-out/disabled (server enforces this too).
- **Hidden Account Toggle**: Ghost-mode toggle only rendered for DEV and Owner actors.
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
1. **Soft Lock:** PATCH `/api/users/manage` with `is_active: false`. The middleware `lastRoleCheckedAt` 30-min re-check detects `is_active = false` → destroys session. 3-layer force-kick fires immediately on the PATCH itself to kick all active sessions right away (not waiting for the 30-min refresh window).
2. **Hard Lock (Force Logout via `/api/users/force-kick`):** Triggers `forceLogoutUser()` directly — all 3 layers (KV delete + KV revocation flag + CF API session DELETE). User is ejected within seconds.
3. **Full Delete:** Fetches `targetUser.id` from whitelist, runs 3-layer force-kick, `resetUserOverrides(env.DB, id)` clears D1 PLAC data, then `DELETE FROM admin_authorized_users WHERE email = ?` removes the whitelist entry. **No `auth.admin.deleteUser()` call** — GoTrue is not involved.
4. **CF Access policy (manual):** For permanent revocation, also remove the user from the CF Zero Trust application policy in the Cloudflare Dashboard to prevent CF Access from ever authenticating them again.

## 6. UI Implementation (Manage Users Dashboard)

The interface is composed of multiple Preact islands:

| Component | Purpose |
|-----------|---------|
| **Users Manager** | Main orchestrator — user list, search, role filtering. Dispatches events to open invite modal |
| **User Card** | Individual user card with role badge, actions, permission display |
| **Page Access Manager** | Per-user PLAC override toggle grid (for existing users) |
| **Invite User Modal** | Two-panel "Command Console" Preact island |
| **Role Pill Selector** | Atomic: 2×2 role pill grid with RBAC-gated availability |
| **Hidden Account Toggle** | Atomic: ghost-mode toggle (DEV/Owner only) |
| **Page Chip Grid** | Atomic: interactive chip grid grouped by section, 4 chip states |

### Event Bus (Cross-Island Communication)
The modal uses CustomEvents for decoupled island-to-island messaging:

| Event | Direction | Purpose |
|-------|-----------|---------|
| Modal open | Users Manager → Invite Modal | Opens the creation dialog |
| User invited | Invite Modal → Users Manager | Triggers user list refresh |

### Filter Tabs
| Tab | Shows |
|-----|-------|
| **All** | All visible users (excluding hidden unless DEV/Owner) |
| **Admins** | Users with high-privilege roles (dev, owner, super_admin) |
| **Staff** | Users with operational roles (admin, staff) |

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

For detailed PLAC documentation, see the dedicated [PLAC-AND-AUDIT.md](./PLAC-AND-AUDIT.md).

**Key integration with User Management:**
- The Page Access Manager renders a toggle grid showing all pages and their access state for a target user.
- Changes save immediately via optimistic UI with toast confirmation.
- Pages the actor cannot modify are shown locked (grayed out with lock icon).
- **Role Mutation Pipeline (Ghost Protection Invalidation):** Changing a user's role is a high-risk event. Any role update triggers a synchronous security cascade:
  1. `resetUserOverrides`: Purges all historical custom page overrides, returning the user to a clean RBAC state.
  2. `forceLogoutUser`: Immediately destroys the user's active KV session to prevent privilege escalation via stale tokens.

## 9. API Data Contracts

All administrative user management actions are performed via `POST`, `PATCH`, and `DELETE` methods on the `/api/users/manage` endpoint.

### 9.1 POST /api/users/manage (Invite User)
Accepts email, display name, role, hidden status, and any initial page overrides. Returns a sanitized success/error message without exposing internal stack traces.

### 9.2 PATCH /api/users/manage (Modify User)
Accepts updates for active status, display name, and role. Mutates the D1 whitelist and triggers the synchronous session invalidation cascade if roles change.

## 10. Operational Resilience & Failure Modes

The system is designed to "fail-closed" across various infrastructure disruptions.

| Failure Event | System Impact | Mitigation / Fallback |
|---------------|---------------|-----------------------|
| **KV Read Timeout** | Session cannot be verified | Request is rejected (401). Prevents unauthorized access on cache failure. |
| **D1 Write Failure** | Permission change not saved | API returns 500. UI shows error, no state change occurs. |
| **KV Write Failure** | Force-logout command fails | User remains logged in until next 30m JWT refresh, where role mismatch is detected. Audit log preserves the attempt. |
| **Supabase Outage** | Invitation/Auth fails | Whitelisting is rolled back atomically to prevent orphaned records. |

### Session Timing Matrix

| Component | Duration | How Enforced |
|-----------|----------|--------------|
| **CF Access cookie** | 24 Hours | CF Dashboard → App Session Duration (must be set manually) |
| **Global CF session** | 24 Hours | CF Dashboard → Settings → Auth → Global Session Timeout |
| **KV TTL** | 24 Hours | `expirationTtl: 86400` on KV session write |
| **Hard expiry guard** | 24 Hours | `createdAt` check in middleware fast-path (defense-in-depth) |
| **Role re-check** | 30 Minutes | `lastRoleCheckedAt` → D1 re-fetch of `admin_authorized_users` |
| **CF JWT assertion** | ~1 Minute | Auto-refreshed by CF edge — Worker does not manage this |
| **Force-kick propagation** | Immediate | 3-layer: CF API DELETE + KV revocation flag + KV session delete |

### Failure Modes

| Failure Event | System Impact | Mitigation |
|---------------|---------------|------------|
| **KV Read Timeout** | Session cannot be verified | Request rejected (401). Fail-closed — no unauthorized access on cache failure. |
| **D1 Write Failure** | Permission change not saved | API returns 500. No state change. |
| **Layer 1 KV Kick Fails** | Sessions not deleted | Layer 2 revocation flag still blocks re-bootstrap. Layer 3 blocks at CF edge. |
| **Layer 3 CF API Fails** | CF_Authorization cookie remains valid | Layer 2 revocation flag prevents new session. On natural expiry (≤24h), fully locked out. |
| **Supabase Outage** | Invitation/role change fails | API returns 500. No whitelist mutation. User remains at previous access level. |

---

## 11. CF Zero Trust ↔ Supabase Visibility Suite

### 11.1 Architecture Overview (OTP-Open Model)

The admin portal uses **CF Zero Trust with an OTP-open policy** — any email address can authenticate via OTP, Google, or GitHub. CF Access handles identity verification only; it does NOT restrict which emails can proceed. The Supabase whitelist is the single authorization gate.

```
CF Access OTP/OAuth → (any email authenticates) → Worker middleware
  → email in admin_authorized_users AND is_active = true → KV session created ✅
  → email NOT in whitelist → LOGIN_FAILED logged → 403 Forbidden ❌
```

**Implication:** "Syncing" CF Access and Supabase does not mean maintaining an email allowlist in CF. It means maintaining visibility into the gap between who has authenticated via CF (anyone) and who is authorized in Supabase (whitelisted only).

### 11.2 The cfLinked Boolean

Each `admin_authorized_users` row has a `cf_sub_id` column — the CF Access internal UUID for the user (`sub` claim from the CF JWT). This is written idempotently on the user's **first** successful login.

- `cf_sub_id IS NOT NULL` → **CF Linked**: user has authenticated via CF ZT at least once; their CF identity is bound; Layer 3 force-kick (CF API session revocation) is available.
- `cf_sub_id IS NULL` → **CF Pending**: user was invited in Supabase but has never logged in; only Layers 1 + 2 of force-kick are available.

**Security:** `cf_sub_id` UUID is **never returned to the client** in any API response. The server derives a `cfLinked: boolean` and strips the UUID before serialization.

### 11.3 CF ZT Visibility — New API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/users` | super_admin+ | Returns `cfLinked: boolean` per user (cf_sub_id IS NOT NULL) |
| `GET /api/users/[id]/session-status` | owner+ | Live KV session count + method/age per session |
| `GET /api/users/[id]/login-history` | owner+ | Last 15 login events from `admin_login_logs` with CF ZT metadata |
| `GET /api/users/probes` | owner+ | Unauthorized access attempts (is_authorized_email = 0), grouped by email |
| `GET /api/users/cf-access-audit` | owner+ | Live cross-reference: CF Access users list vs Supabase whitelist |

### 11.4 Login Intelligence Panel (ExpandedRow)

When an admin expands a user row in the User Registry, the bottom of the expanded panel shows a "Login Intelligence" section (Owner+ only, on-demand fetch). It displays the last 15 login events from `admin_login_logs` with:

| Column | Source | Notes |
|--------|--------|-------|
| Outcome | `event_type` + `success` | SUCCESS (emerald) / FAILED / BLOCKED (red) |
| Method | `cf_access_method` or `login_method` | OTP (sky) / Google (blue) / GitHub |
| Location | `geo_location` + `colo` | "City, Country (CF data center)" |
| Bot Score | `cf_bot_score` | CF bot management score; emerald < 20, amber 20–49, red ≥ 50 |
| CF Ray | `cf_ray_id` | First 10 chars of CF Ray ID (full value in tooltip) |
| IP | `ip_address` | Masked to `X.X.***.***` for non-dev actors; full IP for DEV |
| Date | `created_at` | Relative ("2h ago") with absolute ISO tooltip |

The `summary` shows total login count, success count, and failure count across all time for this email.

### 11.5 Access Probe Feed

The `AccessProbePanel` component (rendered below the User Registry for Owner+ only, `client:idle`) surfaces emails that successfully authenticated via CF OTP but were blocked by the Supabase whitelist gate. These are genuine CF-authenticated users who don't have access — the most actionable security signal in an OTP-open deployment.

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
-- D1 (migrations/0022_login_logs_probe_index.sql)
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
| Session IDs | Server-only | KV key names never returned to client |
| Full IP addresses | DEV actor only | PII — other actors see masked `X.X.***.***` |
| `cf_ray_id` | Owner+ via Login Intelligence | Non-sensitive; useful for CF dashboard cross-reference |
| Probe emails | Owner+ only | Reveals who is probing the system |
| CF audit cross-reference | Owner+ only | Reveals CF Access org-level user list |

{% endraw %}

# Manage Users & RBAC Architecture

> **Component:** CF-Admin Role-Based Access Control (RBAC) System
> **Framework:** Astro 6 + Preact + Cloudflare Workers
> **Auth Provider:** Supabase GoTrue (Admin API / Service Role)
> **Last Updated:** 2026-04-14 (Bug-fix pass: CSRF dev fix, AuthError propagation, force-kick on lock, O(1) DELETE, lazy page fetch)

This document details the exact flow and architecture for managing administrative access within the internal Madagascar Pet Hotel admin portal (`cf-admin`).

## 1. System Overview & Security Posture

The CF-Admin portal operates under strict zero-trust principles optimized for Cloudflare's serverless environment:
- **Signups Disabled:** General signups are completely disabled in the Supabase GoTrue dashboard. Nobody can randomly create an account.
- **Whitelist-Driven Authentication:** Application access is heavily gated by a custom Supabase PostgreSQL `admin_authorized_users` whitelist table.
- **Service-Role Isolation:** Magic links, User Creations, and Roles are managed exclusively via the `service_role_key` accessed *only* server-side within the Cloudflare Worker running Astro.
- **CSRF Protection:** All mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) are validated via stateless Origin + Referer header checking in `src/lib/csrf.ts`, applied globally by `middleware.ts`.
- **Error Sanitization:** All API error responses use generic messages — no internal stack traces, SQL errors, or schema details leak to the client.

## 2. Role Hierarchy (5-Tier)

Access levels operate dynamically based on strict numeric permissions (lower number = higher clearance). Defined centrally in `src/lib/auth/rbac.ts`:

| Level | Role | Identifier | Badge | Color | Hex | Permissions |
|:-----:|:-----|:-----------|:-----:|:------|:----|:------------|
| **0** | **DEV** | `dev` | ⚡ | Red | `#ef4444` | Absolute system access + hidden account creation + dev tools + DB admin |
| **1** | **Owner** | `owner` | 💎 | Emerald | `#10b981` | Project ownership + billing + API keys + view hidden accounts |
| **2** | **SuperAdmin** | `super_admin` | 👑 | Amber | `#f59e0b` | Full access + user management + settings (cannot see hidden accounts) |
| **3** | **Admin** | `admin` | 🛡️ | Purple | `#8b5cf6` | Content management + bookings + reports. Cannot manage users. |
| **4** | **Staff** | `staff` | 👤 | Blue | `#3b82f6` | Standard entry level, read-only metrics, minimal interaction. |

### Color Hierarchy: Thermal Gradient

The badge colors follow a **thermal gradient** designed for maximum readability on dark UI surfaces:

```
🔴 Red (danger/system) → 💚 Emerald (ownership) → 🟠 Amber (authority)
→ 🟣 Purple (management) → 🔵 Blue (operations)
```

### Helper Functions (`rbac.ts`)

| Function | Returns | Description |
|----------|---------|-------------|
| `hasPermission(userRole, requiredRole)` | `boolean` | `ROLE_LEVEL[user] <= ROLE_LEVEL[required]` — O(1) integer comparison |
| `isDev(role)` | `boolean` | Is role exactly DEV |
| `isOwner(role)` | `boolean` | Is role Owner-level or higher (DEV or Owner) |
| `isOwnerOrDev(role)` | `boolean` | Specific check for hidden account visibility |
| `isSuperAdmin(role)` | `boolean` | Is role SuperAdmin-level or higher |
| `isAdmin(role)` | `boolean` | Is role Admin-level or higher |
| `isValidRole(value)` | `value is Role` | Type guard validating string against known roles |

## 3. Ghost Protection (DEV + Owner Isolation)

To ensure operational security, users with `DEV` and `Owner` roles receive special protection within the application interface.

### DEV Ghost Rules
- 🚫 **Not visible** in user lists for SuperAdmin or lower queries — filtered server-side in `GET /api/users`
- 🚫 SuperAdmin/Admin/Staff **cannot** see, modify, revoke, or delete DEV access
- ✅ Only a logged-in DEV can see and manage other DEV users

### Owner Protection Rules
- 🚫 SuperAdmin/Admin/Staff **cannot** modify or delete Owner accounts
- ✅ Only DEV can manage Owner accounts (role changes, deletion, etc.)
- ✅ Owner accounts can view hidden accounts alongside DEV accounts

This is enforced via server-side Astro API endpoints by reading the active requester's session role and applying hierarchy checks before any mutation:

```typescript
// Guard in manage.ts — prevents escalation
if (ROLE_LEVEL[actorRole] >= ROLE_LEVEL[targetRole]) {
  return error(403, 'Insufficient privileges');
}
```

## 4. Hidden Accounts System

A special feature allowing **completely invisible** admin accounts for covert operations or monitoring.

| Aspect | Detail |
|--------|--------|
| **Database Field** | `is_hidden BOOLEAN NOT NULL DEFAULT FALSE` in `admin_authorized_users` (Supabase) |
| **Creation** | DEV-only — `POST /api/users/manage` with `is_hidden: true` in request body |
| **Visibility** | Only DEV and Owner see hidden accounts in `GET /api/users` |
| **Anti-Enumeration** | Hidden accounts are excluded from user counts shown to lower roles. Unauthorized queries receive an identical 404 response shape whether or not the account exists. |

## 5. User Lifecycle Management (API Architecture)

The `/api/users/manage` Astro SSR endpoint securely bridges Supabase GoTrue logic. All mutations are gated by CSRF validation and RBAC hierarchy checks.

### 5.1 Inviting/Authorizing a New User
When an authorized admin adds a new member from the dashboard:
1. **Frontend Request:** UI validates inputs (Email, Role, Display Name) via `InviteUserModal.tsx` (Preact island).
2. **Page Access Fetch:** Modal lazy-fetches `GET /api/users/pages` on the **first modal open** (not on component mount) — live page registry from D1, zero hardcoding. Cached after first load via `pagesLoadedRef`; full error state and retry button shown on failure.
3. **CSRF Validation:** Middleware verifies Origin/Referer headers match `SITE_URL`.
4. **Endpoint Validation:** Endpoint verifies the requesting user has sufficient rank and prevents privilege elevation.
5. **Whitelist Insertion:** User details are inserted into the `admin_authorized_users` table with `is_active = true`.
6. **GoTrue Admin Creation:** The Worker calls the Supabase Admin API to register the user:
   ```typescript
   // Create Auth user via service_role bypassing signup blocks
   const { data } = await adminClient.auth.admin.createUser({
     email, email_confirm: true, user_metadata: { role }
   });
   ```
7. **Page Override Batch Write:** If the admin customised page access during creation, overrides are batch-inserted into `admin_page_overrides` using the new user's GoTrue UUID:
   ```typescript
   // Batch insert via D1 prepared statement (capped at 50 overrides)
   const batch = pageOverrides.map(ov =>
     stmt.bind(newUserId, ov.pagePath, ov.granted ? 1 : 0, session.userId, session.email, 'Set at account creation')
   );
   await env.DB.batch(batch);
   ```
8. **Audit Log:** Mutation is logged via Ghost Audit Engine.

> **Non-fatal override writes:** If the batch override write fails (e.g. GoTrue returned an existing-user result and no UUID was captured), user creation still succeeds. The admin can set page permissions manually via `PageAccessManager` after creation.

### 5.2 Role Selection UI (InviteUserModal)
The `InviteUserModal.tsx` Preact island renders a "Command Console" two-panel dialog:

**Left panel — Identity:**
- **RolePillSelector**: 2×2 pill grid with ROLE_META colors. Roles at or above actor's level are greyed-out/disabled (server enforces this too)
- **HiddenAccountToggle**: Ghost-mode toggle only rendered for DEV and Owner actors (mirrors `isOwnerOrDev()` from `rbac.ts`)
- Email + Display Name inputs, Grant Access + Cancel buttons

**Right panel — Page Access:**
- **PageChipGrid**: Live page list fetched from `GET /api/users/pages` lazily on **first modal open** (not on page load). Grouped by section (MAIN / CONTENT / TOOLS / MANAGEMENT). Error state with retry button displayed if fetch fails.
- Chips have four states:
  - `default_on` (●) — role naturally has access, no override written
  - `default_off` (○) — role has no natural access, no override written
  - `force_grant` (+) — click to grant above role baseline (override written)
  - `force_deny` (✕) — click to deny despite role baseline (override written)
- Click once to force-override; click again to revert to role default
- Override count badge shown when customisations are active

### 5.3 Restoring / Enabling Access
Access is managed via the `is_active` flag inside `admin_authorized_users`.
- When set to `true`, the login portal accepts the JWT created by Supabase.

### 5.4 Revoking / Locking Access
If a user needs immediate revocation:
1. **Soft Lock:** `PATCH /api/users/manage` with `is_active: false`. The middleware guard immediately rejects future requests. The GoTrue UUID is resolved via `auth.users` schema query, then `forceLogoutUser()` destroys active KV sessions immediately — no waiting for the next middleware check.
2. **Hard Lock (Force Logout):** `DELETE /api/users/force-kick` uses the reverse-index KV pattern (`user-session:{userId}:{sessionId}`) for O(k) session destruction rather than O(n) full KV scan.
3. **Full Nuke:** `DELETE /api/users/manage?email=…` resolves the GoTrue UUID via `auth.users` schema query (O(1) — no 1000-user listUsers scan), force-kicks all KV sessions, then calls `adminClient.auth.admin.deleteUser(uid)` and removes the whitelist row.

## 6. UI Implementation (Manage Users Dashboard)

Housed within `/dashboard/users/index.astro`. The interface is composed of multiple Preact islands:

| Component | File | Purpose |
|-----------|------|---------|
| **UsersManager** | `src/components/admin/users/UsersManager.tsx` | Main orchestrator — user list, search, role filtering. Dispatches `modal:open-invite` CustomEvent |
| **UserCard** | `src/components/admin/users/UserCard.tsx` | Individual user card with role badge, actions, permission display |
| **PageAccessManager** | `src/components/admin/users/PageAccessManager.tsx` | Per-user PLAC override toggle grid (for existing users) |
| **InviteUserModal** | `src/components/admin/users/InviteUserModal.tsx` | Two-panel "Command Console" Preact island — replaces old `.astro` modal |
| **RolePillSelector** | `src/components/admin/users/invite/RolePillSelector.tsx` | Atomic: 2×2 role pill grid with RBAC-gated availability |
| **HiddenAccountToggle** | `src/components/admin/users/invite/HiddenAccountToggle.tsx` | Atomic: ghost-mode toggle (DEV/Owner only) |
| **PageChipGrid** | `src/components/admin/users/invite/PageChipGrid.tsx` | Atomic: interactive chip grid grouped by section, 4 chip states |

### Event Bus (Cross-Island Communication)
The modal uses CustomEvents for decoupled island-to-island messaging:

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `modal:open-invite` | UsersManager → InviteUserModal | none | Opens the creation dialog |
| `user:invited` | InviteUserModal → UsersManager | none | Triggers user list refresh |

### Filter Tabs in UsersManager
| Tab | Shows |
|-----|-------|
| **All** | All visible users (excluding hidden unless DEV/Owner) |
| **Admins** | Users with roles: `dev`, `owner`, `super_admin` |
| **Staff** | Users with roles: `admin`, `staff` |

## 7. Security Boilerplates & Error Flow

All actions within the API routes return specific error states handled by the UI:
- `401 Unauthorized` → Render standard "Session Expired" overlay
- `403 Forbidden` → Render "Insufficient Permissions / Action Locked" when a user attempts an impossible action
- `405 Method Not Allowed` → Block manual HTTP verb injections
- `400 Bad Request` → Return `{ success: false, error: '...' }` (sanitized — no internal details)

### Auth Error Propagation (`guard.ts`)

`requireAuth()` throws a typed `AuthError(status, message)` (not a plain `Error`) so callers can
return the correct HTTP status instead of a generic 500:

```typescript
// guard.ts
export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) { ... }
}

// API route catch block
catch (err) {
  if (err instanceof AuthError) return jsonErr(err.status, err.message);
  ...
}
```

### Local Dev CSRF

`SITE_URL` **must** be set in `.dev.vars` for local development. If absent, the middleware falls
back to the production URL from `wrangler.toml [vars]` and every mutation fails with 403.

```
# .dev.vars — required for local dev
SITE_URL="http://localhost:4321"
```

## 8. Page-Level Access Control (PLAC) System

For detailed PLAC documentation, see [PLAC_AND_AUDIT.md](./PLAC_AND_AUDIT.md).

**Key integration with User Management:**
- The `PageAccessManager.tsx` island renders a toggle grid showing all pages and their access state for a target user
- Changes save immediately via optimistic UI with toast confirmation
- Pages the actor cannot modify are shown locked (grayed out with lock icon)
- Role changes trigger automatic override reset (`DELETE FROM admin_page_overrides WHERE user_id = ?`)

## 9. Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/auth/rbac.ts` | Role hierarchy, permission helpers, role metadata, thermal gradient colors |
| `src/lib/auth/guard.ts` | Server-side auth gate — validates session + minimum role requirement |
| `src/lib/auth/session.ts` | KV-backed sessions with `__Host-` cookie prefix, 30min refresh, 24h expiry |
| `src/lib/auth/plac.ts` | Page-Level Access Control — compute, cache, check access maps |
| `src/lib/csrf.ts` | Stateless CSRF protection via Origin + Referer validation |
| `src/lib/audit.ts` | Ghost Audit Engine — fire-and-forget D1 logging |
| `src/middleware.ts` | Global auth gate — CSRF check + session validation + PLAC access check + X-Request-ID |
| `src/pages/api/users/manage.ts` | User CRUD — invite, update role, toggle active, delete |
| `src/pages/api/users/index.ts` | User list — hidden account filtering, anti-enumeration |
| `src/pages/api/users/access.ts` | PLAC provisioning — grant/revoke/reset per-user page overrides |
| `src/pages/api/users/force-kick.ts` | Force logout — reverse-index KV session destruction |
| `src/pages/api/users/access-data.ts` | PLAC data fetcher for PageAccessManager UI (existing users, requires `userId`) |
| `src/pages/api/users/pages.ts` | Page registry endpoint — all active `admin_pages` rows without userId (lazy-fetched by InviteUserModal on first open) |
| `src/components/admin/users/invite/` | Atomic sub-components for the InviteUserModal: RolePillSelector, HiddenAccountToggle, PageChipGrid |

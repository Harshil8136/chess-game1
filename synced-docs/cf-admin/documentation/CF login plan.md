# CF-Admin: Supabase GoTrue → Cloudflare Zero Trust Migration

## Context
The admin portal currently uses Supabase GoTrue for authentication (Magic Link + Google + GitHub + Facebook OAuth). This causes: (1) Google consent screen shows "Sign in to continue to [project].supabase.co" — unfixable without paying Supabase Pro ($25/month); (2) no MFA; (3) client-side anon key exposure; (4) magic links are phishable. Cloudflare Zero Trust Access (free, 50 users) fixes all of these structurally. Auth moves to the CF edge — the Worker gets `CF-Access-Authenticated-User-Email` + `CF-Access-JWT-Assertion` headers on every authenticated request. RBAC, PLAC, KV sessions, Ghost Audit Engine, and all dashboard code remain untouched.

**Login Forensics strategy:** Successful logins logged inline in middleware (same CF Tier 1 data — IP, geo, ray ID, etc.). Failed/rejected logins captured via CF Access Audit Log API polled by a Cloudflare Cron Trigger every 5 minutes, written to the same D1 table. Resend email alert fires on every event. No new DB tables — only schema migration of existing `admin_login_logs`.

---

## Session Lifecycle Design (CRITICAL — Read First)

### The Dual-Session Problem
With CF Zero Trust, there are TWO independent sessions that must both be managed:

| Session | Owner | Location | Controlled by |
|---------|-------|----------|---------------|
| **CF Access cookie** (`CF_Authorization`) | Cloudflare | User's browser | CF edge — set in CF Dashboard |
| **Your KV session** (`__Host-admin_session`) | Your Worker | Cloudflare KV | Your middleware |

**The gap:** If you only delete the KV session (current `forceLogoutUser()`), the CF Access cookie is still valid. On the user's next request, CF Access sees the valid cookie → injects CF-Access headers → your middleware sees no KV session → **bootstraps a brand new session automatically**. The user is never actually kicked. This must be solved with the 3-layer approach below.

---

### A. 24-Hour Hard Session Expiry

Two enforced simultaneously:

**CF Side (manual — Phase 0 step):**
- CF Zero Trust Dashboard → Access → Applications → your app → Settings → **Application Session Duration: 24 hours**
- CF Zero Trust Dashboard → Settings → Authentication → **Global Session Timeout: 24 hours**
- After 24h, CF stops issuing valid CF_Authorization cookies. No valid cookie → CF redirects to login. Your Worker never receives CF-Access headers.

**Worker Side (code):**
- KV `expirationTtl: 86400` (unchanged — already implemented)
- Add `createdAt` guard in middleware (defense-in-depth): `if (Date.now() - session.createdAt > 86400000) → destroySession() + return 401`
- Sessions are FIXED DURATION from creation — no rolling extension. A session created at 09:00 expires at 09:00 the next day regardless of activity.

---

### B. Role Refresh Cadence — 30 Minutes

**CF-Access-JWT-Assertion** is a short-lived JWT (~1 min) that CF automatically re-generates on every request as long as the CF_Authorization session cookie is valid. You do NOT manage this refresh — CF does it automatically.

**Role propagation** (equivalent to the current 30-min Supabase JWT refresh that ensured role changes propagated):
- Add `lastRoleCheckedAt: number` (Unix ms) to the `AdminSession` interface
- In middleware fast-path (KV session found): check `Date.now() - session.lastRoleCheckedAt > 1800000` (30 min)
- If stale: re-fetch user row from D1 `admin_authorized_users`
  - If `is_active = false` → `destroySession()` → Layer 2+3 kick → redirect
  - If role changed → update KV session with new role → re-compute PLAC map → update `lastRoleCheckedAt`
  - If unchanged → just update `lastRoleCheckedAt` → continue
- Cost: one D1 read per user per 30 minutes — negligible within free tier budget

---

### C. Force-Kicking Active Sessions (3 Layers)

When an admin triggers a force-logout (role change, deactivation, manual kick), three layers fire in sequence. All three must succeed for a complete and permanent kick.

**Layer 1 — KV Session Deletion (EXISTING — no code change):**
`forceLogoutUser(userId)` in `src/lib/auth/plac.ts` already LISTs `user-session:{userId}:*` and deletes all matching KV keys via reverse-index. Keep exactly as-is.

**Layer 2 — KV Revocation Flag (NEW):**
- In `forceLogoutUser()`: **additionally** write `revoked:{userId}` → `'1'` to KV with `expirationTtl: 86400`
- In middleware bootstrap section (when CF-Access headers present but no KV session): **before** creating new session, check `await env.SESSION.get('revoked:' + userId)`. If truthy → return 403 with generic "Access has been revoked" — do NOT bootstrap. User sees error even though CF Access cookie is technically valid.
- Revocation flag auto-expires after 24h (by which point the CF Access session also naturally expires)

**Layer 3 — CF Access API Hard Revocation (NEW — nuclear, immediate):**
- In `forceLogoutUser()`: call CF API to delete the CF Access session server-side:
  ```
  DELETE https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/access/users/{cfSubId}/active_sessions
  Authorization: Bearer {CF_API_TOKEN_ZT_WRITE}
  ```
- This invalidates the `CF_Authorization` cookie at the CF edge. On the user's very next request, CF Access sees no valid session → redirects to login page. They cannot even reach your Worker.
- `cfSubId` = the `sub` claim from the CF-Access-JWT-Assertion (CF's internal user UUID). Store this in the KV session at creation time.
- Fires via `ctx.waitUntil()` — zero latency on the actor's response

**Required new secret:** `CF_API_TOKEN_ZT_WRITE` — Create a scoped CF API token: **Zero Trust: Edit** permission only, Account scope only. (Separate from the read-only audit log token.)

**Updated `AdminSession` interface (session.ts):**
```typescript
interface AdminSession {
  userId: string;              // D1 admin_authorized_users UUID
  cfSubId: string;             // CF Access user UUID (JWT `sub` claim) — for Layer 3 revocation
  email: string;
  displayName: string;
  role: Role;
  loginMethod: 'google' | 'github' | 'otp';
  createdAt: number;           // Unix ms — 24h hard expiry anchor
  lastRoleCheckedAt: number;   // Unix ms — 30-min role re-check anchor
  accessMap?: PageAccessMap;
  auditSilenced?: boolean;
  // REMOVED: accessToken, refreshToken, lastRefreshedAt (all Supabase-specific)
}
```

---

---

## Files to DELETE (6 files, ~1,113 lines removed)

| File | Lines | Reason |
|------|-------|--------|
| `src/pages/api/auth/magic-link.ts` | 195 | CF Access handles OTP — no magic link endpoint needed |
| `src/pages/api/auth/onetap.ts` | 148 | Google One Tap uses Supabase `signInWithIdToken` — deleted |
| `src/pages/auth/callback.astro` | 230 | CF Access handles OAuth callback — no custom callback needed |
| `src/components/auth/LoginForm.tsx` | 398 | No login form — CF Access shows its own login UI |
| `src/components/auth/OneTapLogin.tsx` | 142 | One Tap is Supabase-specific |
| `src/layouts/AuthLayout.astro` | ~50 | Login page layout — no longer needed |

**Keep:** `src/pages/api/auth/logout.ts` (simplified), `src/components/auth/SessionWatchdog.tsx` (KV sessions still expire)

**Also modify (not listed above):** `src/lib/auth/plac.ts` — update `forceLogoutUser()` to execute all 3 kick layers (see Session Lifecycle §C above)

---

## Files to MODIFY (13 files)

### 1. `src/middleware.ts` — Core auth gate
**Change:** Replace lines 83–106 (Supabase JWT refresh block) with CF Zero Trust bootstrap + session lifecycle logic.

New flow:
```
1. Public route? → pass (GET/HEAD only as now)
2. CSRF on mutations? → validate (unchanged)
3. Get KV session by cookie
4. KV session found?
   a. createdAt > 24h? → destroySession() → 401 (hard expiry)
   b. lastRoleCheckedAt > 30min? → re-fetch role from D1
      - isActive=false? → destroySession() + Layer 2+3 kick → 401
      - role changed? → update session + re-compute PLAC
      - unchanged? → update lastRoleCheckedAt only
   c. Session valid → fast path, continue to PLAC check (existing lines 108+)
5. No KV session, but CF-Access-JWT-Assertion header present?
   a. verifyZeroTrustJwt(jwt, CF_ACCESS_AUD) → verify RS256 signature
   b. Check KV revocation flag: revoked:{userId} → if exists → 403 "Access revoked"
   c. Lookup email in D1 admin_authorized_users → get userId, role, cfSubId
   d. Not in whitelist or isActive=false? → 403 (CF Access allowed them, we don't)
   e. createSession({ userId, cfSubId, email, role, loginMethod from JWT claims... })
   f. computeAccessMap() → embed PLAC in session
   g. logLoginAttempt() + sendSecurityAlertEmail() via waitUntil()
   h. Continue to page render
6. No KV session, no CF headers → 401 (defense-in-depth; CF Access should have blocked)
```
Everything from line 108 onward (PLAC check, access check, Ghost audit) stays identical.

### 2. `src/lib/auth/session.ts`
- **Delete** `refreshSession()` (~33 lines) — CF handles JWT freshness; role refresh is now inline in middleware
- **Modify** `AdminSession` interface — see updated interface in Session Lifecycle section above
- **Modify** `createSession()` — accept `cfSubId` from JWT `sub` claim; set `lastRoleCheckedAt: Date.now()`; remove Supabase token fields
- **Modify** `destroySession()`:
  - Remove all Supabase `signOut()` / `admin.signOut()` calls
  - Keep: KV session deletion, reverse-index deletion, cookie clear
  - Change redirect target to CF logout URL: `https://{CF_TEAM_NAME}.cloudflareaccess.com/cdn-cgi/access/logout` — this clears the CF_Authorization cookie so user is fully signed out at both layers
- **Add** `writeRevocationFlag(userId, env)` helper — writes `revoked:{userId}` to KV with 24h TTL (called from `forceLogoutUser()` in plac.ts)

### 3. `src/lib/supabase.ts`
- **Delete** `createPublicClient()` entirely — client-side Supabase auth is gone
- **Keep** `createAdminClient()` — still needed for D1-equivalent Supabase PG queries (bookings, chatbot, consent records, RLS operations)
- **Note:** `@supabase/supabase-js` package stays in package.json (still used for DB). `@supabase/ssr` package removed.

### 4. `src/lib/auth/security-logging.ts` — SIGNIFICANT UPDATE
**Remove from `SecurityLogData` interface (Tier 2 — no login form):**
- `cores`, `ramGb`, `screenRes`, `colorDepth`, `platform`, `browserTime`
- `isWebdriver`, `wasPasted`, `keystrokeAvgIkiMs`, `keystrokeEntropy`
- `emailSentAt`, `emailLatencyMs` (no OTP dispatch to measure)
- `clientOrigin`, `serverEnv`

**Add to `SecurityLogData` interface (CF Zero Trust data):**
- `cfRayId?: string` — from `CF-RAY` header (links to CF dashboard trace)
- `cfAccessMethod?: string` — IdP name from CF JWT claims (google / github / otp)
- `cfIdentityProvider?: string` — full IdP descriptor from CF JWT
- `cfJwtTail?: string` — last 16 chars of JWT assertion (audit reference without storing full token)
- `cfBotScore?: number | null` — from `request.cf.botManagementScore` if available

**Updated event types:**
- Keep: `LOGIN_SUCCESS`, `LOGIN_FAILED`
- Remove: `MAGIC_LINK_REQUESTED`, `MAGIC_LINK_SENT`
- Add: `LOGIN_BLOCKED` (for CF Access denied events from cron poll)

**Update `sendSecurityAlertEmail()`** HTML template:
- Remove: Browser/device section, OTP latency section, paste/keystroke section
- Add: CF Access Method row, Ray ID row, Identity Provider row
- Subject format stays the same

### 5. `src/pages/api/audit/login-logs.ts`
- Update TypeScript `LoginLog` interface to match new DB schema (remove Tier 2 columns, add CF fields)
- Update filter options: remove `is_webdriver` / `was_pasted` filters; add `cfAccessMethod` filter
- Method filter values: `google`, `github`, `otp` (was: `magic_link`, `google`, `github`)

### 6. `src/pages/api/audit/stats.ts`
- Remove `MAGIC_LINK_REQUESTED` / `MAGIC_LINK_SENT` from any event type filtering
- Event counts now count `LOGIN_SUCCESS` and `LOGIN_FAILED` / `LOGIN_BLOCKED`

### 7. `src/pages/api/auth/logout.ts`
- After `destroySession()`, redirect to `https://{CF_TEAM_NAME}.cloudflareaccess.com/cdn-cgi/access/logout` instead of `/`
- This clears both the KV session AND the CF Access cookie so user is fully logged out

### 8. `src/pages/index.astro` — Login page → Auth landing
- Remove entire `LoginForm` + `OneTapLogin` island imports
- Remove `AuthLayout` import
- New behavior: If KV session exists → `Astro.redirect('/dashboard')`. If no session → CF Access already intercepted this request before reaching Worker (CF Access is configured to protect `/`). Simplify to a minimal redirect page.

### 9. `src/components/admin/logs/ActivityCenter.tsx` — Login Forensics panel TOTAL REBUILD
- Remove `LoginLog` Tier 2 fields from interface
- Add CF-specific fields to interface
- **4-section forensic detail panel becomes 3-section:**
  - Section 1 — IDENTITY & AUTH: email, event type, method (now shows CF IdP name with icon), outcome, CF Ray ID, JWT tail
  - Section 2 — NETWORK ORIGIN (Tier 1 unchanged): IP, city, region, country, lat/lng, timezone, postal, ISP/ASN, data center (colo), protocol, RTT
  - Section 3 — CF ZERO TRUST CONTEXT (replaces Device Telemetry): CF Access method, identity provider, bot score (if available), auth source
- Remove: entire behavioral/hardware telemetry display block
- Update filter dropdown: remove device filters, method values updated to `google` / `github` / `otp`
- Row badges: `LOGIN_BLOCKED` → gets amber left border (previously `MAGIC_LINK_REQUESTED`)

### 10. `src/pages/dashboard/logs/index.astro`
- Update `canViewSecurity` PLAC check — no changes needed (still DEV/Owner or `#security` grant)
- Remove any reference to `MAGIC_LINK_REQUESTED` / `MAGIC_LINK_SENT` event types in SSR data

### 11. `src/styles/pages/audit.css`
- Remove `.lf-device-*` and `.lf-behavioral-*` CSS classes (Tier 2 panels gone)
- Add `.lf-cf-context-*` classes for the new CF Zero Trust context panel
- Add `.lf-method-otp`, `.lf-method-google`, `.lf-method-github` badge styles (already have google/github, just clean up magic_link)

### 12. `wrangler.toml`
**Remove vars:**
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_TURNSTILE_SITE_KEY` (zero code references found — safe to remove)

**Remove secrets (also run `wrangler secret delete`):**
- `TURNSTILE_SECRET_KEY` (zero code references — unused)

**Keep:** `SUPABASE_SERVICE_ROLE_KEY` (still used for DB), `PUBLIC_SUPABASE_URL` (keep as server var for DB)

**Add vars:**
- `CF_TEAM_NAME` — your Zero Trust team name (for logout redirect URL construction)
- `CF_ACCESS_AUD` — CF Access Application Audience tag (from CF Access app settings, needed for RS256 JWT verification)

**Add secrets (via `wrangler secret put`):**
- `CF_API_TOKEN_READ_LOGS` — Zero Trust Read permission (for audit log cron polling)
- `CF_API_TOKEN_ZT_WRITE` — Zero Trust Edit permission (for Layer 3 session revocation via CF API)

**Add cron trigger:**
```toml
[triggers]
crons = ["*/5 * * * *"]
```

### 13. `package.json`
- **Remove:** `@supabase/ssr` (SSR auth helpers — no longer used after deleting callback/magic-link)
- **Keep:** `@supabase/supabase-js` (still used for DB operations on all other tables)

---

## Files to CREATE (3 files)

### 1. `src/lib/auth/cloudflare-access.ts` — NEW (core JWT verifier)
```typescript
// Fetches CF Access public keys from JWKS endpoint, verifies RS256 JWT
// Caches keys in memory for 1 hour (Workers are ephemeral — cache per isolate lifecycle)
// Exports:
export async function verifyZeroTrustJwt(jwt: string, audience: string): Promise<CFAccessClaims | null>
export function extractCFHeaders(request: Request): { email: string | null; jwt: string | null; rayId: string | null }

interface CFAccessClaims {
  email: string;          // user's email
  aud: string[];          // audience (your app)
  iss: string;            // https://{team}.cloudflareaccess.com
  iat: number;            // issued at
  exp: number;            // expiry
  identity_nonce: string; // unique nonce
  sub: string;            // CF user ID
  // CF adds IdP info in custom claims:
  idp?: { id: string; type: string }; // e.g. { type: "google" }
}
```
JWKS endpoint: `https://{team}.cloudflareaccess.com/cdn-cgi/access/certs`

### 2. `src/workers/scheduled-log-sync.ts` — NEW (CF Audit Log poller)
Attached to existing worker via wrangler cron trigger. On every 5-minute fire:
1. Read `kv:cf-audit-last-synced` timestamp from KV
2. Call CF API: `GET /accounts/{CF_ACCOUNT_ID}/access/logs/access-requests?since={lastSynced}&limit=100`
3. For each new event:
   - Map CF Access log fields → `SecurityLogData` shape
   - INSERT to D1 `admin_login_logs` (only `LOGIN_FAILED` / `LOGIN_BLOCKED` events — successes already logged inline)
   - Fire `sendSecurityAlertEmail()` for each failed event via Resend
4. Update `kv:cf-audit-last-synced` to `now()`

Required new secrets:
- `CF_ACCOUNT_ID` — Cloudflare account ID (already used for analytics: `320d1ebab5143958d2acd481ea465f52`)
- `CF_API_TOKEN_READ_LOGS` — a scoped CF API token with `Zero Trust Read` permission (read-only, minimum scope)

### 3. `migrations/0020_cf_zero_trust_schema.sql` — NEW
```sql
-- Drop Tier 2 columns (no longer collected post-CF ZT migration)
ALTER TABLE admin_login_logs DROP COLUMN cores;
ALTER TABLE admin_login_logs DROP COLUMN ram_gb;
ALTER TABLE admin_login_logs DROP COLUMN screen_res;
ALTER TABLE admin_login_logs DROP COLUMN color_depth;
ALTER TABLE admin_login_logs DROP COLUMN platform;
ALTER TABLE admin_login_logs DROP COLUMN browser_time;
ALTER TABLE admin_login_logs DROP COLUMN is_webdriver;
ALTER TABLE admin_login_logs DROP COLUMN was_pasted;
ALTER TABLE admin_login_logs DROP COLUMN keystroke_avg_iki_ms;
ALTER TABLE admin_login_logs DROP COLUMN keystroke_entropy;
ALTER TABLE admin_login_logs DROP COLUMN email_sent_at;
ALTER TABLE admin_login_logs DROP COLUMN email_latency_ms;
ALTER TABLE admin_login_logs DROP COLUMN client_origin;
ALTER TABLE admin_login_logs DROP COLUMN server_env;

-- Add CF Zero Trust specific columns
ALTER TABLE admin_login_logs ADD COLUMN cf_ray_id TEXT;
ALTER TABLE admin_login_logs ADD COLUMN cf_access_method TEXT;   -- google / github / otp
ALTER TABLE admin_login_logs ADD COLUMN cf_identity_provider TEXT; -- full IdP descriptor from JWT
ALTER TABLE admin_login_logs ADD COLUMN cf_jwt_tail TEXT;        -- last 16 chars of JWT (audit ref)
ALTER TABLE admin_login_logs ADD COLUMN cf_bot_score INTEGER;    -- CF bot management score if available

-- Update event_type CHECK constraint to remove old types
-- (D1/SQLite: recreate index for performance)
CREATE INDEX IF NOT EXISTS idx_login_logs_cf_method ON admin_login_logs(cf_access_method);
CREATE INDEX IF NOT EXISTS idx_login_logs_cf_ray ON admin_login_logs(cf_ray_id);
```

---

## Execution Order (8 Phases)

### Phase 0 — Manual CF Dashboard Setup (YOU DO THIS — before any code)

**A. Cloudflare Zero Trust Application (dashboard.cloudflare.com → Zero Trust)**
1. Zero Trust → Access → Applications → **Add an Application** → Self-Hosted
2. Application name: `Madagascar Pet Hotel — Admin Portal`
3. Session Duration: **24 hours** ← critical
4. Application domain: `admin.madagascarhotelags.com` with path `/*`
5. Identity providers: enable **Google**, **GitHub**, **One-Time PIN** only
6. Add Policy: name `Admin Whitelist` → Action: Allow → Rule: Emails in `[harshil.8136@gmail.com, team@madagascarhotelags.com, ...]`
7. Save → note down the **Application Audience (AUD)** tag shown after saving — paste into `wrangler.toml` as `CF_ACCESS_AUD`
8. Note your **Team Name** from Zero Trust → Settings → Custom Pages (shown in team domain URL e.g. `mascotas.cloudflareaccess.com`) → paste into `wrangler.toml` as `CF_TEAM_NAME`

**B. Global Session Timeout (Zero Trust → Settings → Authentication)**
- Global Session Timeout: **24 hours** ← must match application session duration

**C. Google Cloud Console (console.cloud.google.com → APIs & Services → Credentials)**
1. Open your existing OAuth 2.0 Client for cf-admin
2. Authorized redirect URIs → **Add**: `https://{your-team-name}.cloudflareaccess.com/cdn-cgi/access/callback`
3. Remove any old Supabase redirect URIs (`https://[project].supabase.co/auth/v1/callback`)
4. OAuth consent screen → App name: **`Madagascar Pet Hotel — Admin`** (this is what users see)
5. Note: Authorized JavaScript origins — remove `supabase.co`, no new entry needed (CF handles redirect)

**D. GitHub OAuth App (github.com → Settings → Developer settings → OAuth Apps)**
1. Open your existing OAuth app
2. Authorization callback URL → change to: `https://{your-team-name}.cloudflareaccess.com/cdn-cgi/access/callback`
3. Homepage URL: `https://admin.madagascarhotelags.com`

**E. Create CF API Tokens (dash.cloudflare.com → My Profile → API Tokens)**
- Token 1 — `CF_API_TOKEN_READ_LOGS`:
  - Template: Custom token
  - Permissions: `Account` → `Zero Trust` → **Read**
  - Account Resources: Your account only
- Token 2 — `CF_API_TOKEN_ZT_WRITE`:
  - Template: Custom token
  - Permissions: `Account` → `Zero Trust` → **Edit**
  - Account Resources: Your account only
  - ⚠️ Keep this token extremely private — it can revoke any user's session

### Phase 1 — Create New Auth Library
- Create `src/lib/auth/cloudflare-access.ts` (JWT verifier + header extractor)
- Test locally with a mock CF-Access header (set `CF_LOCAL_DEV_EMAIL=harshil.8136@gmail.com` in `.dev.vars` for local bypass)

### Phase 2 — DB Migration (run first, before code changes go live)
- Run `migrations/0020_cf_zero_trust_schema.sql` via `wrangler d1 execute madagascar-db --file=... --remote`
- Verify with `wrangler d1 execute madagascar-db --command="SELECT * FROM admin_login_logs LIMIT 1" --remote`

### Phase 3 — Middleware + Session Rewrite
- Modify `src/middleware.ts` (replace Supabase refresh with CF ZT bootstrap inline)
- Modify `src/lib/auth/session.ts` (delete refreshSession, simplify destroySession)
- Add local dev fallback: `if (!SITE_URL || SITE_URL.includes('localhost')) { use X-Dev-User-Email header }`

### Phase 4 — Security Logging System Update
- Modify `src/lib/auth/security-logging.ts` (new interface, new email template)
- Modify `src/pages/api/auth/logout.ts` (CF logout URL)
- Modify `src/pages/index.astro` (simplify to redirect)

### Phase 5 — Delete Removed Auth Files
- Delete: `magic-link.ts`, `onetap.ts`, `callback.astro`, `LoginForm.tsx`, `OneTapLogin.tsx`, `AuthLayout.astro`
- Run `astro check` to catch any dangling imports

### Phase 6 — Cron Log Sync Worker
- Create `src/workers/scheduled-log-sync.ts`
- Add `[triggers] crons = ["*/5 * * * *"]` to `wrangler.toml`
- Add `CF_API_TOKEN_READ_LOGS` and `CF_ACCOUNT_ID` as wrangler secrets
- Add `CF_TEAM_NAME` and `CF_ACCESS_AUD` as wrangler vars

### Phase 7 — Login Forensics UI Rebuild
- Modify `src/components/admin/logs/ActivityCenter.tsx` (interface + 3-section panel)
- Modify `src/pages/api/audit/login-logs.ts` + `stats.ts`
- Modify `src/styles/pages/audit.css`
- Modify `src/pages/dashboard/logs/index.astro`

### Phase 8 — Cleanup + Verification
- Remove `@supabase/ssr` from `package.json` → `npm install`
- Delete `TURNSTILE_SECRET_KEY` + `PUBLIC_SUPABASE_ANON_KEY` from wrangler secrets
- Remove `PUBLIC_TURNSTILE_SITE_KEY` from `wrangler.toml` vars
- Modify `src/lib/supabase.ts` (delete createPublicClient)
- Run `astro check` (TypeScript clean)
- Run `wrangler deploy` to staging
- Verify: Google login → consent screen shows "Madagascar Pet Hotel — Admin" ✓
- Verify: Login log appears in D1 with CF fields ✓
- Verify: Resend alert email received on login ✓
- Verify: Cron trigger fires; failed attempts logged within 5 min ✓
- Verify: Login Forensics tab shows new 3-section panel ✓
- Verify: Logout → clears CF Access cookie (no auto re-login) ✓

---

## Local Development Bypass
CF Access requires a live domain. For local dev (`npm run dev`):
- Add to `src/middleware.ts` at the top: If `env.SITE_URL` includes `localhost`, read email from `X-Dev-User-Email` header or fall back to `env.LOCAL_DEV_ADMIN_EMAIL`
- Add to `.dev.vars`: `LOCAL_DEV_ADMIN_EMAIL=harshil.8136@gmail.com`
- This creates a real KV session for that email — all RBAC/PLAC/audit works normally in dev

---

## Critical Files (quick reference)

| File | Status | Priority | Session Lifecycle Touch |
|------|--------|----------|------------------------|
| `src/middleware.ts` | MODIFY | 🔴 Core | 24h expiry + 30min role refresh + bootstrap |
| `src/lib/auth/cloudflare-access.ts` | CREATE | 🔴 Core | JWT verify, cfSubId extraction |
| `src/lib/auth/session.ts` | MODIFY | 🔴 Core | New interface, destroySession→CF logout, revocation flag helper |
| `src/lib/auth/plac.ts` | MODIFY | 🔴 Core | forceLogoutUser → Layer 2 (KV flag) + Layer 3 (CF API) |
| `src/lib/auth/security-logging.ts` | MODIFY | 🔴 Core | New interface + email template |
| `migrations/0020_cf_zero_trust_schema.sql` | CREATE | 🔴 Run first | Drop Tier 2, add CF columns |
| `src/workers/scheduled-log-sync.ts` | CREATE | 🟠 High | Cron: failed login polling |
| `src/components/admin/logs/ActivityCenter.tsx` | MODIFY | 🟠 High | 3-panel rebuild |
| `src/pages/api/audit/login-logs.ts` | MODIFY | 🟠 High | New schema mapping |
| `src/pages/api/auth/logout.ts` | MODIFY | 🟡 Medium | CF logout URL redirect |
| `src/pages/index.astro` | MODIFY | 🟡 Medium | Simplify to redirect |
| 6× auth files | DELETE | 🟡 Phase 5 | — |
| `wrangler.toml` | MODIFY | 🟡 Medium | New vars + secrets + cron |
| `package.json` | MODIFY | 🟢 Low | Remove @supabase/ssr |

---

## Session Timing Matrix (Final)

| Component | Duration | How enforced |
|-----------|----------|--------------|
| CF Access cookie | **24 hours** | Set in CF Dashboard → App Session Duration |
| KV session TTL | **24 hours** | `expirationTtl: 86400` (unchanged) |
| Hard expiry guard | **24 hours** | `createdAt` check in middleware (defense-in-depth) |
| Role re-check | **30 minutes** | `lastRoleCheckedAt` check in middleware fast-path |
| CF JWT assertion | **~1 minute** | Auto-refreshed by CF edge on every request (no code) |
| Force-kick propagation | **Immediate** | Layer 3 (CF API) + Layer 2 (KV flag) + Layer 1 (KV delete) |

---

## Net Code Delta
- **Deleted:** ~1,113 lines across 6 files
- **Created:** ~280 lines across 3 files
- **Modified:** ~450 lines across 14 files (added plac.ts)
- **Net: ~830 lines REMOVED. Smaller, simpler, more secure codebase.**

{% raw %}
# Security Architecture — CF-Admin

> **Status:** Production Active
> **Last Updated:** 2026-04-29 (v4.1: Deep RLS & ACL lockdown — anon role fully stripped)
> **Scope:** Auth, CSRF, Sessions, HTTP Headers, RLS, Defense-in-Depth, Ghost Protection, Error Sanitization

---

## 1. Auth Architecture

CF-Admin uses **Cloudflare Zero Trust Access** for identity (who you are) and a custom **Supabase authorization whitelist** for access decisions (what you're allowed to do). Supabase GoTrue has been fully removed — no magic links, no OAuth callbacks, no anon key on the client.

### 1.1 Identity Layer — Cloudflare Zero Trust

- **CF Access Application** protects all routes at the CF edge, before any request reaches the Worker
- **Identity providers:** Google, GitHub, One-Time PIN (OTP)
- **CF injects on every authenticated request:**
  - `CF-Access-Authenticated-User-Email` — verified user email
  - `CF-Access-JWT-Assertion` — short-lived RS256 JWT (~1 min) with `sub` (CF user UUID), `iat`, `exp`, IdP info
  - `CF-RAY` — Cloudflare Ray ID (links to CF dashboard trace)
- **JWKS verification:** Worker verifies JWT signature via public keys fetched from `https://{team}.cloudflareaccess.com/cdn-cgi/access/certs`, cached in memory for 1h per isolate lifecycle
- **No client-side secrets:** CF Access cookie (`CF_Authorization`) is managed entirely by the CF edge. No anon key, no OAuth credentials ever reach the browser.

### 1.2 Authorization Layer — Supabase Whitelist

- **Whitelist-only entry:** Only emails present in `admin_authorized_users` (Supabase PostgreSQL) with `is_active = true` can create a KV session
- **Service-role isolation:** All Supabase queries use `SUPABASE_SERVICE_ROLE_KEY`, accessed only server-side — bypasses RLS entirely, never exposed to the client
- **Break-glass admin:** `harshil.8136@gmail.com` and `team@madagascarhotelags.com` are hardcoded in `BREAK_GLASS_EMAILS` (`src/lib/auth/rbac.ts`). If D1 or Supabase is unreachable, these emails are force-granted access. `isBreakGlassAdmin()` logs a `console.warn` every invocation. (Legacy alias: `isHardcodedSuperAdmin` = deprecated, still exported for backwards compatibility.)

### 1.3 Session Design

Sessions are stored in **Cloudflare KV** with a dual-key pattern:

- Primary: `session:{uuid}` → JSON `AdminSession` object
- Reverse index: `user-session:{userId}:{sessionId}` → `'1'` (enables O(k) force-logout without scanning the full KV namespace)

**`AdminSession` interface (`src/lib/auth/session.ts`):**
```typescript
interface AdminSession {
  userId: string;           // admin_authorized_users UUID (D1/Supabase)
  cfSubId: string;          // CF Access user UUID (JWT sub claim) — needed for Layer 3 revocation
  email: string;
  displayName: string;
  role: Role;
  loginMethod: 'google' | 'github' | 'otp';
  createdAt: number;        // Unix ms — 24h hard expiry anchor
  lastRoleCheckedAt: number;// Unix ms — 30-min D1 role re-check anchor
  accessMap?: PageAccessMap;
  auditSilenced?: boolean;
}
```

**`cfSubId` persistence:** Stored in `admin_authorized_users.cf_sub_id` (TEXT column, Supabase migration `supabase_0001_add_cf_sub_id`). Written idempotently on first CF ZT login via `waitUntil()`. Enables Layer 3 revocation even when no active KV session exists (natural expiry edge case).

### 1.4 Session Timing Matrix

| Component | Duration | How Enforced |
|-----------|----------|--------------|
| CF Access cookie (`CF_Authorization`) | **24 hours** | CF Dashboard → App Session Duration |
| Global CF session | **24 hours** | CF Dashboard → Settings → Authentication → Global Session Timeout |
| KV session TTL | **24 hours** | `expirationTtl: 86400` on `SESSION.put()` |
| Hard expiry guard | **24 hours** | `createdAt` check in middleware fast-path (defense-in-depth) |
| Role re-check | **30 minutes** | `lastRoleCheckedAt` check → D1 re-fetch of `admin_authorized_users` |
| CF JWT assertion | **~1 minute** | Auto-refreshed by CF edge on every request — Worker does not manage this |
| Force-kick propagation | **Immediate** | 3-layer revocation (see §5) |

Sessions are **fixed-duration from creation** — no rolling extension. A session created at 09:00 expires at 09:00 next day regardless of activity.

### Astro Sessions API

Session cookies use the `__Host-` prefix in production (enforces `Secure`, host-bound, `path=/`). In local dev, plain cookie name is used without the prefix.

> **⚠️ Fail-Secure Local Dev Detection (v4.1):** The `isLocalDev` check in `middleware.ts`, `dev-login.ts`, and `index.astro` uses `!!siteUrl && (siteUrl.includes('localhost') || ...)` — if `SITE_URL` is missing or misconfigured, the system defaults to **production mode** (fail-secure), never to dev mode. This prevents a missing env var from accidentally bypassing Cloudflare Zero Trust authentication.

### Local Development Bypass

CF Access requires a live domain. For local dev (`npm run dev`): middleware reads email from `X-Dev-User-Email` header or falls back to `env.LOCAL_DEV_ADMIN_EMAIL` in `.dev.vars`. Creates a real KV session — all RBAC/PLAC/audit works normally in dev.

---

## 2. Route Protection

Every non-public route is gated by `src/middleware.ts`. Public routes are restricted to `GET`/`HEAD` only:

| Public Route | Method Restriction | Notes |
|---|---|---|
| `/privacy`, `/terms` | GET, HEAD only | Static legal pages |

`/` (root) and `/auth/*` routes are protected by CF Access at the edge — they never reach the Worker unauthenticated. `index.astro` at `/` only redirects to `/dashboard` once a KV session exists.

Any mutation method on public routes returns `405 Method Not Allowed`. Everything else requires a valid KV session + PLAC access check.

---

## 3. CSRF Protection

Stateless CSRF via `src/lib/csrf.ts` — Origin + Referer header validation. No tokens, no cookies, no client JS required. Applied globally by `middleware.ts` to all mutation methods (POST, PUT, PATCH, DELETE).

| Step | Check | Action |
|------|-------|--------|
| 1 | Method is GET, HEAD, or OPTIONS | Skip — safe methods don't mutate state |
| 2 | `Origin` header matches `SITE_URL` | ✅ Allow |
| 3 | `Origin` doesn't match | ❌ Deny — origin mismatch |
| 4 | No `Origin`, but `Referer` starts with `SITE_URL` | ✅ Allow (fallback) |
| 5 | Neither header present | ❌ Deny — fail-closed |

**Performance:** <0.05ms CPU, 0 KV reads, 0 bytes client JS.

**Local dev:** When `SITE_URL` is not set, CSRF validation is skipped entirely (fail-open for developer convenience). If `SITE_URL` is misconfigured in `.dev.vars`, every mutation will fail with 403 — check this first when debugging.

---

## 4. Edge-Injected Security Headers

Applied globally at the Cloudflare Edge via Astro's `sequence` middleware. The response is safely cloned before header attachment to avoid immutable header exceptions.

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer leakage |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | 1-year HSTS |
| `Content-Security-Policy` | `'self'`, `'unsafe-inline'` styles (Tailwind v4), `'unsafe-inline'`/`'unsafe-eval'` scripts (Preact hydration + Sentry) | Resource restriction |

### Data-Attribute Driven CSS
Although CSP allows `'unsafe-inline'` styles for Tailwind v4 compatibility, dynamic UI state is controlled exclusively via data attributes (`data-state="expanded"`, `data-active="true"`) — never inline `style={{...}}` properties. This keeps CSS architecture clean and predictable.

---

## 5. Ghost Protection — 3-Layer Force-Kick

Role mutations, account deactivation, and PLAC changes trigger a 3-layer security cascade that immediately revokes access at every layer of the stack. Implemented in `src/lib/auth/plac.ts` → `forceLogoutUser()`.

**Trigger events:** role change, account deactivation, PLAC override modification, manual force-kick

**Layer 1 — KV Session Deletion (O(k)):**
- LISTs `user-session:{userId}:*` in the reverse index → deletes all matching KV session keys
- Also deletes the reverse-index pointers
- **Reverse-index KV pattern:** Sessions indexed at `user-session:{userId}:{sessionId}: '1'` — targeted LIST is O(sessions_per_user), not O(total_sessions)

**Layer 2 — KV Revocation Flag:**
- Writes `revoked:{userId}` → `'1'` to KV with `expirationTtl: 86400` (24h auto-expiry)
- Middleware checks this flag on every bootstrap attempt (no active KV session but CF headers present)
- If flag exists → returns 403 immediately, refuses to create a new session
- Prevents the "CF Access cookie still valid → Worker auto-bootstraps new session" gap

**Layer 3 — CF Access API Hard Revocation (nuclear, immediate):**
- Calls CF API: `DELETE /accounts/{CF_ACCOUNT_ID}/access/users/{cfSubId}/active_sessions`
- Invalidates the `CF_Authorization` cookie at the CF edge
- User's next request is intercepted by CF Access → redirected to login — Worker never receives it
- `cfSubId` sourced from active KV session; falls back to reading `cf_sub_id` from Supabase `admin_authorized_users` if no active session exists
- Requires `CF_API_TOKEN_ZT_WRITE` secret (Zero Trust: Edit permission — account scope only)
- Fired via `ctx.waitUntil()` — zero latency on the actor's response

**Cascade sequence (role change or deactivation):**
1. `resetUserOverrides(env.DB, targetUser.id)` — purges all PLAC overrides → clean RBAC baseline
2. `forceLogoutUser(env.SESSION, targetUser.id, env)` — all 3 layers above

**Failure mode:** If KV write fails during Layer 1, Layer 2 still blocks re-bootstrap. If Layer 3 CF API call fails (non-fatal, logged), the CF Access cookie remains valid but Layer 2 revocation flag prevents session creation. On CF session natural expiry (max 24h), the user is fully locked out.

---

## 6. Input Validation & Error Sanitization

- All form inputs validated server-side before processing
- Parameterized D1 queries only — never string concatenation
- `VALID_ROLES` application-level allowlist rejects invalid role values before DB insertion
- Cloudflare Turnstile on magic link request form
- **All API error responses return generic messages** — no stack traces, SQL errors, schema details, or internal paths leak to the client
- Hidden accounts return identical 404 response shape whether they exist or not — prevents enumeration

---

## 7. Request Tracing

Every request receives a unique `X-Request-ID` header generated via `crypto.randomUUID()`. This ID can be correlated with audit log entries in `admin_audit_log` to trace the full lifecycle of any request from ingress → mutation → audit write.

---

## 8. CF Zero Trust Middleware Bootstrap Hardening

| Protection | Implementation |
|-----------|----------------|
| JWT signature verification | RS256 via JWKS from `https://{team}.cloudflareaccess.com/cdn-cgi/access/certs` |
| Audience validation | `aud` claim matched against `CF_ACCESS_AUD` env var (app-specific tag) |
| Whitelist check | Email verified against `admin_authorized_users` (Supabase) before session creation |
| Revocation check | `revoked:{userId}` KV flag checked before any new session bootstrap |
| Active status check | `is_active = false` → 403 even for CF-authenticated users |
| Session binding | Session bound to userId, cfSubId, email, role, loginMethod, createdAt |
| Idempotent cfSubId | `cf_sub_id` written to Supabase on first login with `.is('cf_sub_id', null)` guard |

---

## 9. Required Production Secrets & Vars

Secrets via `wrangler secret put <KEY>`. Vars in `wrangler.toml` `[vars]`.

### Secrets (never committed)

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase DB operations (no GoTrue — authorization whitelist + bookings/chatbot/RLS) |
| `REVALIDATION_SECRET` | Authenticates ISR webhooks (cf-admin → cf-astro) |
| `SITE_URL` | CSRF Origin validation + cookie prefix decision |
| `UPSTASH_REDIS_REST_URL` | Redis connection for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `CF_API_TOKEN` | Cloudflare GraphQL analytics access |
| `CF_API_TOKEN_ZT_WRITE` | Zero Trust: Edit — Layer 3 force-kick (DELETE active sessions via CF API) |
| `CF_API_TOKEN_READ_LOGS` | Zero Trust: Read — audit log cron polling (5-min failed-login sync) |
| `CF_ZONE_ID` | Specific CF zone for HTTP metrics |
| `RESEND_API_KEY` | Outgoing emails + dashboard metrics |
| `SENTRY_AUTH_TOKEN` | Sentry API for error feed |
| `IP_HASH_SECRET` | Privacy-safe IP hashing for login forensics |
| `CHATBOT_WORKER_URL` | cf-chatbot Worker endpoint |
| `CHATBOT_ADMIN_API_KEY` | 64-character key securing cf-chatbot access |

### Vars (in wrangler.toml)

| Var | Purpose |
|-----|---------|
| `PUBLIC_SUPABASE_URL` | Supabase project URL (DB queries — not auth) |
| `CF_TEAM_NAME` | Zero Trust team name (e.g. `mascotas`) for logout redirect URL construction |
| `CF_ACCESS_AUD` | CF Access Application Audience tag — required for RS256 JWT audience check |
| `CF_ACCOUNT_ID` | Cloudflare account ID (already used for analytics; also needed for audit log cron + Layer 3) |

**Removed secrets (no longer in codebase):**
- `PUBLIC_SUPABASE_ANON_KEY` — GoTrue client-side auth removed
- `TURNSTILE_SECRET_KEY` — Turnstile CAPTCHA removed (no login form)

---

## 10. Supabase RLS Policy Reference

> **Last Audited:** 2026-04-29 (via Supabase Advisor API — 0 security warnings)
> **Database:** `zlvmrepvypucvbyfbpjj` (shared with cf-astro)

### 10.1 Design Principles

**Zero Anon Access:** The `anon` role has **zero table-level grants**, **zero RLS policies**, and **zero function EXECUTE privileges** across the entire `public` schema. Default privileges are also revoked so future tables inherit this lockdown.

**Service-Role Exclusive:** All 3 applications (`cf-admin`, `cf-chatbot`, `cf-astro`) access the database via either `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) or direct `DATABASE_URL` PostgreSQL connection (bypasses PostgREST). No application code uses the Supabase anon key.

**Defense-in-Depth:** Even though `service_role` bypasses RLS (via `bypassrls = true`), every table has an explicit `service_role`-only RLS policy. This creates a documented deny-by-default posture for `anon`/`authenticated` roles and prevents accidental exposure if a new code path is added.

---

### 10.2 Table Policy Matrix

All 17 public tables have RLS **enabled** and a single `"Service role full access"` policy restricted to `TO service_role`. No table has any policy granting access to `anon` or `authenticated`.

#### Admin & Session Tables

| Table | Policy | Roles | Notes |
|-------|--------|-------|-------|
| `admin_authorized_users` | ALL | service_role | Authorization whitelist — `cf_sub_id` for Layer 3 revocation |
| `admin_sessions` | ALL | service_role | Session metadata (KV is primary store) |
| `email_audit_logs` | ALL | service_role | Email dispatch audit; CASCADE on booking delete |

#### Chatbot & Analytics Tables (PII — customer data)

| Table | Policy | Roles | Notes |
|-------|--------|-------|-------|
| `contacts` | ALL | service_role | Customer PII (names, emails, phones) |
| `conversations` | ALL | service_role | Chat history linked to contacts |
| `messages` | ALL | service_role | Message content |
| `chat_analytics` | ALL | service_role | Aggregate analytics |
| `conversation_metrics` | ALL | service_role | Performance metrics |
| `feedback_events` | ALL | service_role | User feedback signals |
| `intent_events` | ALL | service_role | Intent classification data |
| `kb_gaps` | ALL | service_role | Knowledge base gap analysis |

#### Booking & Compliance Tables

| Table | Policy | Roles | Notes |
|-------|--------|-------|-------|
| `bookings` | ALL + UPDATE | service_role | Pet boarding reservations |
| `booking_pets` | ALL | service_role | Pets linked to bookings |
| `booking_quality_metadata` | ALL | service_role | Booking quality signals |
| `consent_records` | ALL | service_role | GDPR/LFPDPPP consent receipts |
| `legal_requests` | ALL + SELECT | service_role | ARCO rights requests |
| `privacy_requests` | ALL | service_role | Privacy deletion requests |

> **Historical note (removed 2026-04-29):** Tables `bookings`, `booking_pets`, `booking_quality_metadata`, `consent_records`, `privacy_requests`, and `legal_requests` previously had `anon` INSERT policies for public forms. These were vestigial — GoTrue auth was removed, and no application uses the anon key. All anon policies have been dropped.

---

### 10.3 Function Security

All public functions have `SET search_path = public` to prevent search-path hijacking, and EXECUTE has been **revoked from `anon`, `authenticated`, and `PUBLIC`**. Only `service_role` and `postgres` retain execution privileges.

| Function | Signature | search_path | EXECUTE Revoked From |
|----------|-----------|-------------|---------------------|
| `get_command_center_analytics` | `(p_days integer)` | `public` | anon, authenticated, PUBLIC |
| `get_kb_clusters` | `(p_resolved boolean)` | `public` | anon, authenticated, PUBLIC |
| `get_usage_metrics` | `(p_days_ago integer)` | `public` | anon, authenticated, PUBLIC |
| `increment_conversation_metrics` | `(uuid, text, bool, int, numeric)` | `public` | anon, authenticated, PUBLIC |
| `increment_conversation_metrics` | `(uuid, text, bool, int, numeric, text)` | `public` | anon, authenticated, PUBLIC |
| `rls_auto_enable` | (trigger) | `pg_catalog` | anon, authenticated, PUBLIC |

---

### 10.4 Table-Level Grant Lockdown

**All DML privileges have been revoked from `anon` on all public tables:**

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
```

This means even if an RLS policy is accidentally misconfigured in the future, `anon` won't have the underlying table privilege to exploit it.

---

### 10.5 Index Coverage

All foreign keys have covering indexes to prevent sequential scans during JOINs and CASCADE operations.

| Table | Column | Index | Added |
|-------|--------|-------|-------|
| `booking_pets` | `booking_id` | `idx_booking_pets_booking_id` | 2026-04-29 |
| `chat_analytics` | `contact_id` | `idx_chat_analytics_contact_id` | 2026-04-29 |
| `chat_analytics` | `conversation_id` | `idx_chat_analytics_conversation_id` | 2026-04-21 |
| `email_audit_logs` | `booking_id` | `idx_email_audit_logs_booking_id` | 2026-04-21 |
| `feedback_events` | `contact_id` | `idx_feedback_events_contact_id` | 2026-04-29 |
| `feedback_events` | `message_id` | `idx_feedback_events_message_id` | 2026-04-29 |
| `feedback_events` | `conversation_id` | `idx_feedback_events_conversation_id` | 2026-04-29 |
| `intent_events` | `contact_id` | `idx_intent_events_contact_id` | 2026-04-29 |
| `intent_events` | `message_id` | `idx_intent_events_message_id` | 2026-04-29 |
| `intent_events` | `conversation_id` | `idx_intent_events_conversation_id` | 2026-04-29 |
| `kb_gaps` | `contact_id` | `idx_kb_gaps_contact_id` | 2026-04-29 |
| `kb_gaps` | `conversation_id` | `idx_kb_gaps_conversation_id` | 2026-04-29 |

Removed: 20+ unused indexes dropped to save Free Tier storage (2026-04-29). Duplicate `idx_consent_records_consent_id` removed (2026-04-21).

---

### 10.6 Required Manual Actions (Phase 0 — CF Dashboard Setup)

> These are one-time setup steps required before the CF Zero Trust auth flow goes live. They cannot be automated — they require manual actions in CF and Google/GitHub dashboards.

**Cloudflare Zero Trust Application:**
1. Zero Trust → Access → Applications → Add Self-Hosted App
2. Application domain: `admin.madagascarhotelags.com` with path `/*`
3. Session Duration: **24 hours** (must match KV TTL)
4. Identity providers: Google, GitHub, One-Time Pin only
5. Note the **Application Audience (AUD)** tag → add to `wrangler.toml` as `CF_ACCESS_AUD`

**Global Session Timeout:**
- Zero Trust → Settings → Authentication → Global Session Timeout: **24 hours**

**CF API Tokens (dash.cloudflare.com → My Profile → API Tokens):**
- `CF_API_TOKEN_READ_LOGS`: Account → Zero Trust → **Read** permission only
- `CF_API_TOKEN_ZT_WRITE`: Account → Zero Trust → **Edit** permission only

**Google Cloud Console — OAuth Redirect:**
- Add: `https://{team}.cloudflareaccess.com/cdn-cgi/access/callback`
- Remove: old Supabase redirect URIs

**GitHub OAuth App:**
- Authorization callback URL: `https://{team}.cloudflareaccess.com/cdn-cgi/access/callback`

---

## 11. Defense-in-Depth Architecture

The Supabase database is protected by **three independent layers**. Even if one layer is compromised or misconfigured, the other two prevent unauthorized PII access.

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: TABLE-LEVEL GRANTS                             │
│  anon has ZERO grants on any table in public schema      │
│  Default privileges revoked for future tables             │
│  → PostgREST returns 404 for anon on any table           │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: ROW-LEVEL SECURITY (RLS)                       │
│  All 19 policies restricted to service_role only          │
│  No policy matches anon or authenticated                  │
│  → Even with grants, RLS would deny all rows             │
├─────────────────────────────────────────────────────────┤
│  LAYER 3: FUNCTION ACLs                                  │
│  EXECUTE revoked from anon, authenticated, PUBLIC         │
│  All functions have pinned search_path                    │
│  → RPC calls via PostgREST return permission denied       │
└─────────────────────────────────────────────────────────┘
```

---

## 12. Hardening Migrations Applied

### Phase 1 (2026-04-21)

| Migration | Description |
|-----------|-------------|
| `harden_chatbot_tables_rls` | Replaced `USING(true)` with service_role on 4 chatbot tables |
| `harden_bookings_and_email_audit_rls` | Locked bookings UPDATE + added email_audit_logs policy |
| `fix_rls_initplan_performance` | Wrapped `auth.role()` in subquery for 3 admin tables |
| `fix_function_search_path` | Pinned search_path on `get_usage_metrics()` |
| `add_fk_indexes_drop_duplicate` | 3 FK indexes added, 1 duplicate dropped |

### Phase 2 (2026-04-29) — Deep Lockdown

| Migration | Description |
|-----------|-------------|
| `lock_down_rls_policies` | Restricted 9 tables' RLS from PUBLIC→service_role; removed 6 vestigial anon INSERT policies; added 6 replacement service_role policies |
| `revoke_anon_function_and_table_access` | Revoked EXECUTE on 4 functions (5 overloads) from anon/authenticated/PUBLIC; revoked ALL table grants from anon; locked default privileges |
| `add_remaining_fk_indexes` | Added 6 covering indexes for remaining unindexed foreign keys |

{% endraw %}

{% raw %}
# Security Architecture — CF-Admin

> **Status:** Production Active
> **Last Updated:** 2026-05-25 (deep-review fixes — see §14: PLAC verified-role gates, CSRF Referer anchored, audit silence self-protection, cron pattern fix, JWKS cleanup, `placDenyResponse` helper applied to audit + users API routes)
> **Scope:** Auth, CSRF, Sessions, HTTP Headers, RLS, Defense-in-Depth, Ghost Protection, Error Sanitization, IDOR Prevention, Rate Limiting, Input Validation

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
- **No hardcoded bypass accounts:** The break-glass mechanism (`BREAK_GLASS_EMAILS`, `isBreakGlassAdmin`, `isHardcodedSuperAdmin`) was intentionally removed. All access is gated exclusively through the `admin_authorized_users` whitelist — there are zero hardcoded emails or fallback grants in the codebase.

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
| 2 | `Origin` header matches `SITE_URL` (or `SITE_URL` without trailing `/`) | ✅ Allow |
| 3 | `Origin` doesn't match | ❌ Deny — origin mismatch |
| 4 | No `Origin`, but `Referer` is **exactly** `SITE_URL` (no trailing slash) OR begins with `SITE_URL + "/"` | ✅ Allow (fallback) |
| 5 | Neither header present | ❌ Deny — fail-closed |

> **Referer match is boundary-anchored (2026-05-25 hardening — see §14 H-1).** Earlier versions used a plain `referer.startsWith(siteUrl)`, which would accept `https://secure.example.com.attacker.com/...` when `SITE_URL` was `https://secure.example.com`. Modern browsers send Origin on cross-origin mutations so the exposure was narrow (some webviews / older clients strip Origin on same-origin redirects), but the check is now hardened: an exact equality to the normalized URL, or a prefix followed by `/`.

**Performance:** <0.05ms CPU, 0 KV reads, 0 bytes client JS.

**Local dev:** When `SITE_URL` is not set, CSRF validation is skipped entirely (fail-open for developer convenience). If `SITE_URL` is misconfigured in `.dev.vars`, every mutation will fail with 403 — check this first when debugging.

---

## 4. Edge-Injected Security Headers

Applied globally at the Cloudflare Edge via Astro's `sequence` middleware (`securityHeaders` → `authMiddleware`). Headers are written to a mutable `new Headers(response.headers)` copy to avoid immutable-header exceptions on the Workers runtime.

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking (legacy; `frame-ancestors` in CSP is primary) |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaks only origin on cross-origin navigation |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | 1-year HSTS with preload eligibility |
| `Permissions-Policy` | `camera=(), microphone=(), payment=(), geolocation=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()` | Disables all browser hardware APIs not used by the admin portal |
| `Content-Security-Policy` | See enforced policy below | Resource restriction; `unsafe-inline`/`unsafe-eval` retained in Phase 1 (see §13) |
| `Content-Security-Policy-Report-Only` | Hardened policy without `unsafe-inline`/`unsafe-eval` + Sentry `report-uri` | Violation collection for Phase 2 promotion; zero enforcement risk |

### Enforced CSP (Phase 1 — 2026-05-24)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval'
           https://browser.sentry-cdn.com
           https://static.cloudflareinsights.com
           https://cdn.jsdelivr.net;
style-src  'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src    'self' data: blob: https:;
font-src   'self' data: https://fonts.gstatic.com;
connect-src 'self' https: wss:;
frame-ancestors 'none';
base-uri   'self';
object-src 'none';
form-action 'self';
upgrade-insecure-requests
```

**Why `unsafe-inline` is still present (accurate root causes — not Tailwind):**

- **`script-src unsafe-inline`:** The `@sentry/astro` v10 integration injects an inline initialization script into `<head>` during SSR. This cannot currently receive a nonce via Astro 6 without a custom build hook. The hero.astro `<script>` block is bundled by Vite into an external file (not inline). The two `<script is:inline src="...">` tags in AdminLayout load external files via `src` (not inline content) — they do NOT need `unsafe-inline`.
- **`script-src unsafe-eval`:** Retained pending verification that Sentry v10 does not use `eval()` for stack trace symbolication in Workers. Source maps are uploaded (`sentry.server.config.ts`) which normally eliminates the need. Investigate after Report-Only data is collected.
- **`style-src unsafe-inline`:** Preact's SSR renderer emits `style="..."` attributes directly in the initial HTML for all components using `style={{ }}` props (dynamic gradients, animations, colors). These appear in the HTML document, not in JavaScript. Approximately 20 instances across `ExpandedRow.tsx`, `SystemDiagnosticsHistory.tsx`, `AccessPolicyGrid.tsx`, and others require conversion to CSS utility classes before this can be removed.

### Report-Only CSP (Phase 2 target — collecting violations since 2026-05-24)

The `Content-Security-Policy-Report-Only` header runs the hardened policy (no `unsafe-inline`, no `unsafe-eval`, tightened `connect-src`) and sends all violations to Sentry. Review reports at **Sentry → Security → CSP Reports**.

**Promotion checklist** (before enforcing the Report-Only policy):
- [ ] Zero `script-src` violations for ≥ 2 weeks of real admin usage
- [ ] Zero `style-src` violations for ≥ 2 weeks
- [ ] All `connect-src` violations in the tightened explicit-origin list resolved
- [ ] Sentry `@sentry/astro` inline init script handled (nonce via build hook, or SHA-256 hash)
- [ ] ~20 Preact `style={{ }}` props converted to CSS classes (`unsafe-inline` style-src removal)
- [ ] `unsafe-eval` confirmed not needed by Sentry v10 in Workers environment

### Data-Attribute Driven CSS
Dynamic UI state is controlled via data attributes (`data-state="expanded"`, `data-active="true"`) wherever possible — `style={{ }}` props are only used for values that cannot be expressed as static CSS (runtime-computed gradients, role-specific color tokens). Remaining inline-style props are the primary blocker for `style-src unsafe-inline` removal.

---

## 5. Ghost Protection — 3-Layer Force-Kick

Role mutations, account deactivation, and PLAC changes trigger a 3-layer security cascade that immediately revokes access at every layer of the stack. Implemented in `src/lib/auth/plac.ts` → `forceLogoutUser()`.

**Trigger events:** role change, account deactivation, PLAC override modification, manual force-kick, per-session revocation via Session Forensics Drawer

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
- **All API error responses return generic messages** — no stack traces, SQL errors, schema details, or internal paths leak to the client. Never do `return jsonError(500, error.message)` — always use a static string.
- Hidden accounts return identical 404 response shape whether they exist or not — prevents enumeration

---

## 6a. API Route Access Control — IDOR Prevention

Every API route that returns user data, PII, or privileged records **must** both capture and enforce a minimum role from `requireAuth`. Discarding the return value is a bug.

**Correct pattern:**
```typescript
// Captures user AND enforces 'admin' minimum role — 403 if below
try {
  await requireAuth(context, 'admin');
} catch (err) {
  if (err instanceof AuthError) return jsonError(err.status, err.message);
  return jsonError(401, 'Unauthorized');
}
```

**Wrong pattern (IDOR vulnerability):**
```typescript
try {
  await requireAuth(context);  // ❌ result discarded, no role check
} catch {
  return jsonError(401, 'Unauthorized');
}
```

| Route | Minimum Role | Reason |
|-------|-------------|--------|
| `GET /api/bookings/[id]` | `admin` | Returns consent records, email audit logs, quality metadata (PII) |
| `GET /api/bookings` | authenticated | Booking list |
| `GET /api/media/gallery` | `admin` | Gallery management |
| `POST /api/media/gallery` | `admin` | Gallery mutations; CDN URL whitelist enforced on image src |
| `GET /api/users` | `super_admin` | Full user list |
| `POST /api/audit/silence` | `dev` | Modifies audit suppression |
| `POST /api/features/toggle` | `dev` | Feature flag mutations |
| `GET /api/diagnostics/ping` | `dev` | Infrastructure probe |
| `GET /api/users/[id]/session-status` | `super_admin` | Returns session telemetry (IP, UA, geo, Ray ID, lastActiveAt) — PII; Ghost Protection at DB boundary |

### Page-Level Access Control on API routes (`placDenyResponse`)

Astro middleware deliberately skips PLAC for `/api/*` (each route picks its own auth posture; see §6 of `plac-and-audit.md`). To make sure an explicit PLAC deny on a dashboard page also blocks the underlying API calls, sensitive routes opt in via the `placDenyResponse(actor, pagePath)` helper from `src/lib/auth/guard.ts`. The helper:

- Returns `null` (allow) for any DEV actor — DEV is the break-glass tier; PLAC denies on DEV are meaningless.
- Returns `null` when the actor has no PLAC map (defensive — falls back to the role check the route already performed).
- Honors the same resolution rules as page navigation: exact-match wins, then longest-prefix-match. An explicit `false` denies; any other state allows.
- Returns a fully-formed `403` JSON `Response` when denied (no-store / nosniff headers included) so callers can early-return: `const denied = placDenyResponse(actor, '/dashboard/logs'); if (denied) return denied;`

**Routes wired in PR #2 (2026-05-25):**

| Route | Page check | Notes |
|---|---|---|
| `GET /api/audit/emails` (+ `DELETE`) | `/dashboard/logs` | Replaces the prior inline `accessMap[]` check; consistent across the audit endpoints. |
| `GET /api/audit/sessions` | `/dashboard/logs` | |
| `GET /api/audit/stats` | `/dashboard/logs` | |
| `GET /api/audit/logs` (+ `DELETE`) | `/dashboard/logs` | |
| `GET /api/audit/consent` (+ `DELETE`) | `/dashboard/logs` | |
| `GET /api/audit/receipts` | `/dashboard/privacy` | Privacy dashboard surface. |
| `DELETE /api/audit/prune` | `/dashboard/logs` | DEV-only + PLAC. |
| `POST /api/audit/silence` | DEV-only role check + self-silencing forbidden | No PLAC check — DEV is exempt anyway; the self-silence forbid is the meaningful guard. |
| `POST/PATCH/DELETE /api/users/manage` | `/dashboard/users` | |
| `DELETE /api/users/force-kick` | `/dashboard/users` | |
| `GET /api/users/access-data` | `/dashboard/users` | Also adds ghost protection — non-DEV actors cannot enumerate a DEV/Owner PLAC matrix via this endpoint. |

**Routes pending (tracked in `PENDING_PHASES.md`):** `settings/portal`, `content/*`, `media/*`, `users/{probes, cf-access-audit, active-sessions, active-revocations}`. Each has its own role gate; PLAC wiring is mechanical.

---

## 6b. Input Validation & Rate Limit Coverage

### Rate-Limited API Routes

| Route | Limit | Identifier | Key |
|-------|-------|-----------|-----|
| `GET /api/bookings/[id]` | 60/min | `bookings-detail` | `user.userId` |
| `GET /api/users` | 30/min | `users-list` | `session.userId` |
| `POST /api/system/preview` | 20/min | `system-preview` | `actor.userId` |
| `POST /api/system/pages` (PATCH) | 3/min | `registry` | `actor.userId` |
| `POST/PATCH/DELETE /api/users/manage` | 10/h | `users-manage` | `session.userId` |
| `POST /api/content/reviews` | 30/h | `content-reviews` | `user.userId` |
| `POST /api/content/services` | 30/h | `content-services` | `user.userId` |
| `POST /api/audit/export` | 5/h | `audit-export` | `session.userId` |
| `POST /api/media/upload` | 20/min | `media-upload` | `user.userId` |
| `POST /api/users/access` | 5/min | `plac` | `session.userId` |

Rate limiting uses Upstash Redis sliding-window via `src/lib/ratelimit.ts`. Falls back to allow-all in local dev (missing Upstash credentials).

### Zod Schema Validation

| Route | Schema | Validates |
|-------|--------|----------|
| `POST /api/content/reviews` | `ReviewsSchema` | `Array<{ id, name, text: string; rating: int 1-5 }>`, max 50 items |
| `POST /api/content/services` | `ServicesBodySchema` | `{ dogs?, cats?, daycare?: string(max 100); currency?: string(max 10) }` |

The `services.ts` POST no longer spreads `rawBody` directly — only validated fields are written to D1.

### Email Format Validation

`POST/PATCH/DELETE /api/users/manage` — all three verbs validate the email parameter with `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` before any DB lookup.

### Bounded Queries

- `GET /api/users` — Supabase query is bounded with `.limit(200)` to prevent unbounded scans.
- `PageRegistryRepository.updatePage` — `required_role` validation uses `!== undefined` check so empty strings (`''`) are correctly rejected instead of silently bypassing the allowlist.

### Analytics Provider Timeouts

All 8 analytics providers in `src/lib/analytics/providers.ts` use `AbortSignal.timeout(5000)` on every external `fetch()`. This prevents a slow upstream (Cloudflare GraphQL, Supabase metrics, Sentry, Resend) from consuming the entire 10 ms CPU budget on a Workers free-tier request.

---

## 7. Request Tracing

Every request receives a unique `X-Request-ID` header generated via `crypto.randomUUID()`. This ID can be correlated with audit log entries in `admin_audit_log` to trace the full lifecycle of any request from ingress → mutation → audit write.

---

## 8. CF Zero Trust Middleware Bootstrap Hardening

| Protection | Implementation |
|-----------|----------------|
| JWT absence → 401 | **Fail-close**: absent `CF-Access-JWT-Assertion` returns 401 immediately — no session bootstrap possible without the JWT |
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

---

## 13. Security Audit Log — 2026-05-24 Deep Review

Full report: [`documentation/SECURITY-REVIEW-2026-05-24.md`](./SECURITY-REVIEW-2026-05-24.md)

### Vulnerabilities Patched

| Severity | File | Vulnerability | Fix |
|----------|------|--------------|-----|
| 🔴 Critical | `src/components/admin/logs/shared.tsx` | **Stored XSS** — `JSON.stringify` does not HTML-escape `<>& `; raw data passed to `dangerouslySetInnerHTML` in JSONViewer. Exploitable via crafted URL paths stored in audit log. | Added `escapeHtml()` applied per matched regex token before `<span>` insertion |
| 🔴 High | `src/lib/auth/security-logging.ts` | **HTML injection in security alert emails** — `userAgent`, `email`, `geoLocation`, `cfIdentityProvider`, `failureReason` interpolated raw into HTML email. Unauthenticated attacker can inject HTML via `User-Agent` header. | Added `escHtml()` helper; applied to all 5 user-controlled fields |
| 🔴 High | `src/lib/cms.ts` | **MIME type bypass** — `file.type` (client-controlled multipart header) trusted without verifying actual file bytes. Attacker could upload HTML/SVG as `image/jpeg`. | Added `validateImageMagicBytes()` (JPEG/PNG/WebP/AVIF signatures); replaced filename-based extension with hardcoded `MIME_TO_EXT` map |
| 🟠 Medium | `src/pages/api/bookings/index.ts` | **PostgREST filter injection** — `search` param interpolated raw into `.or()` filter string | Added `sanitizeSearchTerm()` stripping PostgREST operator chars |
| 🟠 Medium | `src/pages/api/users/force-kick.ts` | **Supabase filter injection** — `.or(`id.eq.${userId}`)` with attacker-controlled `userId` | Replaced with `.eq('id', userId).limit(1)` |
| 🟠 Medium | `src/lib/auth/session.ts` | **Session cookie `SameSite: lax`** — Admin cookie sent on cross-origin top-level navigation | Changed to `SameSite: strict` on both `createSession` and `destroySession` |
| 🟠 Medium | `src/lib/auth/session.ts` | **patchSession resets KV TTL** — every 30-min role recheck extended KV entry lifetime to now+24h | Now uses `remainingMs = maxLifetime − (now − session.createdAt)` with 60s floor |
| 🟡 Low | `src/pages/api/users/manage.ts` | **No `displayName` length limit** — unbounded string stored in D1 + audit log | Added 120-char limit |
| 🟡 Low | `src/pages/api/settings/user.ts` | **Theme cookie missing `Secure` attribute** | Added `Secure` to both set and clear `Set-Cookie` headers |
| 🟡 Low | `src/pages/api/auth/logout.ts` | **No rate limit on logout** — KV delete + audit write unbounded | Added 10 req/min per IP via `getRateLimiter` |
| 🟡 Low | `wrangler.toml` | **Developer email in committed `[vars]`** — `LOCAL_DEV_ADMIN_EMAIL` should be in gitignored `.dev.vars` | Removed from `[vars]`; replaced with comment pointing to `.dev.vars` |
| 🟡 Low | `documentation/SECURITY.md` | **Stale break-glass docs** — referenced `BREAK_GLASS_EMAILS` / `isBreakGlassAdmin()` that no longer exist | Replaced with accurate statement that no hardcoded bypasses exist |

### Items Resolved After Initial Audit

| Item | Resolution | Date |
|------|-----------|------|
| Security docs synced to public repo via `sync-docs.yml` | **✅ Final approach 2026-05-24.** All `.md` docs are synced — they are the architecture baseline for AI IDE agents (Claude Code, Cursor, Copilot) and must be complete for accurate AI-assisted development. Only non-`.md` files (scripts, binaries) are excluded. **PII redaction** step added: personal developer email addresses (`harshil.*@*`) are replaced with `[DEVELOPER_EMAIL]` before push. Secret scan warns on credential patterns. Architecture content (resource IDs, security design, RBAC/PLAC internals, operational runbooks) is preserved intact — it is essential for AI context and contains no actionable secrets (IDs without API tokens are inert). | 2026-05-24 |
| `Content-Security-Policy` — Phase 1 hardening | **✅ Partially done 2026-05-24.** Enforced CSP updated: (1) `https://*.sentry-cdn.com` wildcard replaced with explicit `https://browser.sentry-cdn.com`; (2) `frame-ancestors 'none'` added; (3) `base-uri 'self'` added; (4) `object-src 'none'` added; (5) `form-action 'self'` added; (6) `upgrade-insecure-requests` added; (7) `Permissions-Policy` header added disabling camera/mic/payment/geo/USB/sensors. `Content-Security-Policy-Report-Only` deployed with hardened policy (no `unsafe-inline`/`unsafe-eval`) reporting violations to Sentry. | 2026-05-24 |

### Items Remaining (Require Phase 2 Work — Tracked in §4)

| Item | Root Cause | Required Work |
|------|-----------|--------------|
| `script-src 'unsafe-inline'` | `@sentry/astro` v10 injects an inline init script into `<head>` that cannot currently receive an Astro-managed nonce | Implement nonce generation in Workers middleware → pass via `Astro.locals.cspNonce` → apply to Sentry's build hook. Alternatively: compute SHA-256 hash of Sentry's static init script and add as `'sha256-{hash}'` to CSP |
| `script-src 'unsafe-eval'` | Retained pending verification Sentry v10 doesn't use `eval()` for stack trace processing in Workers | After collecting ≥ 2 weeks of Report-Only data with no `unsafe-eval` violations: remove it from enforced CSP. If violations appear: upgrade Sentry or disable the offending integration |
| `style-src 'unsafe-inline'` | Preact SSR emits `style="..."` attributes in HTML for ~20 components using dynamic `style={{ }}` props (`ExpandedRow.tsx`, `SystemDiagnosticsHistory.tsx`, `AccessPolicyGrid.tsx`, and others) | Convert ~20 `style={{ }}` prop usages to Tailwind utility classes or CSS custom properties. Many use runtime-computed role colors — those need CSS variable injection instead |
| Chart.js CDN — no SRI hash | `cdn.jsdelivr.net/npm/chart.js@4.4.7` lacks `integrity` attribute | Compute: `curl -s https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js \| openssl dgst -sha384 -binary \| openssl base64 -A` then add `integrity="sha384-{hash}"` to `usage.astro:8`. Or move chart.js to `package.json` and bundle it via Vite (eliminates CDN dependency) |

---

## 14. Security Audit Log — 2026-05-25 Deep Review

Full report: [`documentation/SECURITY-REVIEW-2026-05-25.md`](./SECURITY-REVIEW-2026-05-25.md)
Shipped on `main` via PR #2 (merge commit `3f8cd78`) as 7 atomic commits.

### Vulnerabilities Patched

| Severity | File | Vulnerability | Fix |
|----------|------|--------------|-----|
| 🔴 Critical | `src/pages/api/users/access.ts` | **PLAC bypass via spoofed `targetUserRole`** — Hierarchy Gates A (rank) and B (ghost) read `targetUserRole` from the request body. An admin (level 3) could send `{ targetUserId: <super_admin_id>, targetUserRole: "staff", action: "revoke" }` to lockout a super_admin from a dashboard page; a user with a PLAC deny could self-grant within their own clearance. | Fetch verified role + email from `admin_authorized_users` on every call; use DB values for all gates and audit payload. Forbid `actor.userId === targetUserId` — denies must not be self-removable. `body.targetUserRole` treated as informational only. |
| 🔴 Critical | `src/workers/cf-entry.ts` | **Weekly asset-cleanup cron never ran** — wrangler.toml triggers `"0 2 * * SUN"` (CF rejects the numeric `0` form), but the dispatcher only matched `"0 2 * * 0"`. CF echoes the original pattern back, so the equality failed and R2 grew unbounded. | Dispatcher accepts both `"0 2 * * SUN"` and `"0 2 * * 0"`. |
| 🟠 High | `src/lib/csrf.ts` | **CSRF Referer prefix bypass** — `referer.startsWith(siteUrl)` accepted `https://secure.example.com.attacker.com/...`. Modern browsers send Origin so exposure was narrow, but the bypass was real. | Anchored match: exact equality to normalized SITE_URL, or prefix followed by `/`. |
| 🟠 High | `src/pages/api/settings/user.ts` | **Cross-user settings edit ignored target hierarchy** — POST checked editor was admin+ but never the target's role. An admin could rewrite a super_admin's `display_name`, enabling visual impersonation in any UI surface that renders display_name. | When editing another user, fetch target role and reject unless editor strictly outranks target. DEV exempt. |
| 🟠 High | `src/pages/api/audit/silence.ts` | **DEV self-silence + KV TTL rejuvenation** — DEV could mute their own audit trail by passing their own userId. `propagateAuditSilence` also rewrote every active session with `expirationTtl = SESSION_MAX_LIFETIME` (same bug previously fixed in `patchSession`). | Reject `targetUserId === session.userId` (requires a second DEV). Compute remaining TTL from `session.createdAt`, floor at 60s; read `SESSION_MAX_LIFETIME_MS` from env. |
| 🟠 High | `src/lib/auth/guard.ts` + 10 routes | **Most API routes bypass PLAC entirely** — Middleware skips PLAC for `/api/*`; many data routes ignored explicit denies on the corresponding page. A super_admin denied `/dashboard/users` could still call `/api/users/manage` etc. | Added `requirePageAccess()` + `placDenyResponse()` helpers. Wired into highest-risk routes (all `/api/audit/*` data endpoints, `audit/prune`, `users/{manage, force-kick, access-data}`). See §6a above. |
| 🟠 High | `src/lib/auth/cloudflare-access.ts` | **JWKS cache double-fetch on rotation** — Bust-and-retry path fetched fresh keys into an unused variable then fell through to a third `fetchPublicKeys()` call. Functionally correct but confusing — next reviewer would misread as "use stale key". | Single reassignable variable; behavior identical. |

### Additional fixes bundled with the PLAC PR

- `access-data.ts` ghost-protection: non-DEV actors get 403 when querying a DEV/Owner's PLAC matrix (was a back door around the `/api/users` ghost-hiding).
- `audit/prune.ts` `days` parameter: NaN-safe and bounded to 1–3650. Previous `Math.max(1, parseInt('abc'))` produced silent SQL no-ops.

### Items Remaining (Tracked in `PENDING_PHASES.md`)

14 Medium + 14 Low findings. Highlights:

| Area | Finding |
|---|---|
| Validation | `bookings/[id]/state.ts` `operational_status` accepts arbitrary strings (enum allowlist needed). `content/reviews.ts` GET crashes on corrupted JSON row. `audit/prune` days bound applied; remaining endpoints need similar bounding. |
| API hardening | Apply `placDenyResponse` to `settings/portal`, `content/*`, `media/*`, remaining `users/*` routes. `chatbot/[...path]` default minRole fail-closed. |
| DB / data lifecycle | `cms_content_history` missing the cleanup trigger its own comment promises. `writeRevocationFlag` TTL hardcoded in two places — consolidate and read `SESSION_MAX_LIFETIME_MS`. Supabase: 28 unused indexes flagged. |
| Workers | `scheduled-log-sync` sends one alert email per failed login (amplification risk). |
| Frontend | `ModelsCatalog` numeric-only `dangerouslySetInnerHTML` — structurally fragile. `hero.astro` `statusEl.innerHTML` — currently safe but fragile. |
| Dependencies | `npm audit`: 16 vulns (3 high, 12 moderate, 1 low). Direct: `astro <6.1.10` (XSS), `@astrojs/cloudflare <13.1.10` (SSRF). Transitive: `vite`, `devalue`, `fast-uri`, `postcss`, `yaml`, `ws`, `brace-expansion`. Fix path: `npm update astro @astrojs/cloudflare wrangler && npm audit fix`. |
| Supabase advisor | `auth_leaked_password_protection` disabled — not relevant for cf-admin (uses CF Access) but worth enabling for any sibling project that uses Supabase Auth. |


{% endraw %}

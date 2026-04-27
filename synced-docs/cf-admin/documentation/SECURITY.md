{% raw %}
# Security Architecture — CF-Admin

> **Status:** Production Active
> **Last Updated:** 2026-04-25 (v3: edge headers hardening)
> **Scope:** Auth, CSRF, Sessions, HTTP Headers, RLS, Ghost Protection, Error Sanitization

---

## 1. Auth Architecture

- **Signups disabled** in Supabase GoTrue dashboard — no self-registration possible
- **Whitelist-driven:** Only emails in `admin_authorized_users` (D1) can authenticate
- **Service-role isolation:** Magic links, user creation, and role mutations use `SUPABASE_SERVICE_ROLE_KEY`, accessed only server-side in the Cloudflare Worker — never exposed to the client
- **OAuth provider validation:** Provider string validated against allowlist (`google`, `github`, `facebook`, `email`) at callback
- **Hardcoded emergency fallback:** `harshil.8136@gmail.com` and `team@madagascarhotelags.com` are force-granted super_admin properties at JWT mint, bypassing D1 — prevents total lockout if D1 fails

### Session Timing Matrix

| Component | Duration | Logic |
|-----------|----------|-------|
| JWT validity | 30 minutes | High-pulse refresh ensures role changes propagate quickly |
| Hard expiry | 24 hours | All sessions must re-authenticate daily via Magic Link / SSO |
| KV TTL | 24 hours | Session keys set with `expirationTtl` matching max lifetime |

### Astro Sessions API

Session cookies use the `__Host-` prefix in production (enforces `Secure`, host-bound, `path=/`). In local dev (no `SITE_URL`), plain cookie name is used without the prefix.

---

## 2. Route Protection

Every non-public route is gated by `src/middleware.ts`. Public routes are restricted to `GET`/`HEAD` only:

| Public Route | Method Restriction |
|---|---|
| `/` (login) | GET, HEAD only |
| `/auth/callback` | GET, HEAD only |
| `/privacy`, `/terms` | GET, HEAD only |

Any other method on these routes returns `405 Method Not Allowed`. Everything else requires a valid session + PLAC access check.

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

## 5. Ghost Protection — Session Sweeps

Role mutations and permission changes trigger a synchronous security cascade that prevents privilege escalation via stale tokens.

**Trigger events:** role change, account deactivation, PLAC override modification

**Cascade sequence:**
1. `resetUserOverrides` — purges all historical PLAC overrides, returning user to clean RBAC baseline
2. `forceLogoutUser` — immediately destroys all active KV sessions for the target user

**Reverse-index KV pattern:** Sessions are indexed at `user-session:{userId}:{sessionId}: '1'`. Force-logout uses a targeted LIST on this prefix for O(k) deletion (O(sessions_per_user)) instead of scanning the full KV namespace (O(total_sessions)).

**Failure mode:** If KV write fails during force-logout, the user remains logged in until their next 30-minute JWT refresh, at which point the role mismatch is detected and they are ejected. The audit log preserves the attempted logout.

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

## 8. Auth Callback Hardening

| Protection | Implementation |
|-----------|----------------|
| Provider validation | OAuth provider validated against allowlist before processing |
| Whitelist check | Email verified against `admin_authorized_users` (D1) before session creation |
| Session binding | Session bound to user ID, email, role, and creation timestamp |

---

## 9. Required Production Secrets

All must be deployed as Worker secrets via `wrangler secret put <KEY>`:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin operations |
| `PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase auth flows |
| `REVALIDATION_SECRET` | Authenticates ISR webhooks (cf-admin → cf-astro) |
| `SITE_URL` | CSRF Origin validation + cookie prefix decision |
| `UPSTASH_REDIS_REST_URL` | Redis connection for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile captcha verification |
| `CF_API_TOKEN` | Cloudflare GraphQL analytics access |
| `CF_ZONE_ID` | Specific CF zone for HTTP metrics |
| `RESEND_API_KEY` | Outgoing emails + dashboard metrics |
| `SENTRY_AUTH_TOKEN` | Sentry API for error feed |
| `IP_HASH_SECRET` | Privacy-safe IP hashing for login forensics |
| `CHATBOT_WORKER_URL` | cf-chatbot Worker endpoint |
| `CHATBOT_ADMIN_API_KEY` | 64-character key securing cf-chatbot access |

---

## 10. Supabase RLS Policy Reference

> **Last Audited:** 2026-04-21 (via Supabase Advisor API)
> **Database:** `zlvmrepvypucvbyfbpjj` (shared with cf-astro)

### 10.1 Design Principles

**Service-Role Pattern:** All admin and backend operations use `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. The anon key is exposed to the frontend for auth flows only.

**`(select auth.role())` optimization:** Always wrap `auth.role()` in a subquery. Without it, PostgreSQL evaluates per-row (O(n) InitPlan). The subquery forces a single evaluation per query — critical on large tables.

**Public INSERT pattern:** Tables that accept anonymous form submissions retain permissive INSERT for the anon role. All reads are gated behind `service_role`.

---

### 10.2 Table Policy Matrix

#### Admin Tables (service_role only)

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `admin_authorized_users` | service_role | service_role | service_role | service_role | Whitelist — foundation of auth |
| `admin_sessions` | service_role | service_role | service_role | service_role | KV-backed session metadata |
| `email_audit_logs` | service_role | service_role | service_role | service_role | Email dispatch audit; CASCADE on booking delete |

#### Chatbot Tables (service_role only — hardened 2026-04-21)

Previously had `USING(true)` — publicly-exposed anon key could read ALL chatbot data including customer contacts and conversation history. Fixed.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `chat_analytics` | service_role | service_role | — | — |
| `contacts` | service_role | service_role | service_role | service_role |
| `conversations` | service_role | service_role | service_role | service_role |
| `messages` | service_role | service_role | service_role | service_role |

#### Public-Facing Tables (anon INSERT + service_role read)

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `bookings` | service_role | anon (public form) | service_role | service_role | Pet boarding reservations |
| `booking_pets` | service_role | anon (public form) | — | — | Pets linked to bookings |
| `booking_quality_metadata` | service_role | anon (public form) | — | — | Booking quality signals |
| `consent_records` | service_role | anon (cookie banner) | — | — | GDPR/LFPDPPP consent receipts |
| `legal_requests` | service_role | anon (legal form) | — | — | ARCO rights requests |
| `privacy_requests` | service_role | anon (privacy form) | — | — | Privacy deletion requests |

> **Note on bookings UPDATE:** Previously had `USING(true)/WITH CHECK(true)` for anon — anyone with the anon key could modify any booking field. Fixed 2026-04-21 to service_role only.

---

### 10.3 Function Security

**`public.get_usage_metrics()`** — hardened 2026-04-21 with `SET search_path = public`.

Without an explicit `search_path`, a poisoned schema could inject a function with the same name. Pinning eliminates this vector.

---

### 10.4 Index Coverage

All foreign keys have covering indexes to prevent sequential scans during JOINs and CASCADE operations.

| Table | Column | Index | Added |
|-------|--------|-------|-------|
| `chat_analytics` | `conversation_id` | `idx_chat_analytics_conversation_id` | 2026-04-21 |
| `email_audit_logs` | `booking_id` | `idx_email_audit_logs_booking_id` | 2026-04-21 |
| `email_audit_logs` | `template_id` | `idx_email_audit_logs_template_id` | 2026-04-21 |

Duplicate removed: `idx_consent_records_consent_id` (superseded by the UNIQUE constraint's implicit index).

---

### 10.5 Accepted Risk Advisories

| Advisory | Table | Rationale |
|----------|-------|-----------|
| `rls_policy_always_true` INSERT | `bookings`, `booking_pets`, `booking_quality_metadata` | Public booking form requires anon INSERT |
| `rls_policy_always_true` INSERT | `consent_records`, `legal_requests`, `privacy_requests` | Public site forms |

### 10.6 Pending Manual Action

> **Enable Leaked Password Protection:**
> Supabase Dashboard → Authentication → Password Security → Enable "Check passwords against HaveIBeenPwned"
> URL: `https://supabase.com/dashboard/project/zlvmrepvypucvbyfbpjj/auth/settings`

---

## 11. Hardening Migrations Applied (2026-04-21)

| Migration | Description |
|-----------|-------------|
| `harden_chatbot_tables_rls` | Replaced `USING(true)` with service_role on 4 chatbot tables |
| `harden_bookings_and_email_audit_rls` | Locked bookings UPDATE + added email_audit_logs policy |
| `fix_rls_initplan_performance` | Wrapped `auth.role()` in subquery for 3 admin tables |
| `fix_function_search_path` | Pinned search_path on `get_usage_metrics()` |
| `add_fk_indexes_drop_duplicate` | 3 FK indexes added, 1 duplicate dropped |

{% endraw %}

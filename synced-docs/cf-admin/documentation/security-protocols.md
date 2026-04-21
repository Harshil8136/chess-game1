{% raw %}
# Security Protocols
<!-- Last reviewed: 2026-04-21 -->

## 1. Secrets Management
- Local dev secrets in `.dev.vars` (gitignored)
- Production secrets via `wrangler secret put <KEY>`
- Never commit secrets; `.dev.vars` is in `.gitignore`
- Required production secrets: `SUPABASE_SERVICE_ROLE_KEY`, `REVALIDATION_SECRET`, `SITE_URL`

## 2. Auth Architecture
- Signup is **DISABLED** in Supabase dashboard
- Only `admin_authorized_users` whitelist members can authenticate
- Server-side whitelist check on every auth callback
- OAuth provider validated against whitelist (`google`, `github`, `facebook`, `email`)
- JWT validation + refresh via Supabase client
- Session cookies use `__Host-` prefix in production (prevents subdomain fixation)
- Sessions stored in KV with 24-hour hard expiry

## 3. Route Protection
- Astro middleware checks session on EVERY non-public route
- Public routes: `/` (login), `/auth/callback` — restricted to `GET`/`HEAD` only
- Everything else requires valid session + role check
- Failed auth → redirect to login with error message
- **X-Request-ID** header injected on every request via `crypto.randomUUID()` for audit correlation

## 4. CSRF Protection
- **Stateless CSRF** via `src/lib/csrf.ts` — Origin + Referer header validation
- Applied globally by `middleware.ts` to all mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`)
- Fail-closed: if both Origin and Referer headers are missing, the request is denied
- Cost: <0.05ms CPU, 0 KV reads, 0 client-side JavaScript
- Fail-open in development only (when `SITE_URL` is not configured)

## 5. Input Validation
- All form inputs validated server-side before processing
- Parameterized queries only — never string concatenation
- All API error messages are sanitized — no internal stack traces or schema details leak to the client
- Turnstile protection on login form (magic link)
- Application-level role allowlist (`VALID_ROLES`) rejects invalid role values before DB insertion

## 6. Database Security (Supabase RLS)
- **All tables have RLS enabled** — no table is accessible without a policy
- Admin tables (`admin_authorized_users`, `admin_sessions`, `email_audit_logs`) and chatbot tables (`chat_analytics`, `contacts`, `conversations`, `messages`) are locked to `service_role` only
- Public-facing tables allow anon INSERT for form submissions but restrict all other operations to `service_role`
- RLS policies use `(select auth.role())` subquery pattern for single-evaluation-per-query performance
- RPC functions have explicit `SET search_path = public` to prevent search_path injection
- All foreign keys have covering indexes to prevent sequential scans during CASCADE operations
- **Full policy matrix:** [`documentation/database-rls-policy.md`](./database-rls-policy.md)

## 7. Audit Integrity
- Every audit operation runs in `ctx.waitUntil()` to avoid blocking the user flow and maintain sub-10ms logic paths.
- The system aggregates metrics dynamically via parallel D1 and Supabase calls in `/api/audit/stats` without slowing down individual worker tasks.
- For maximum operational scaling, granular permissions (sub-features like `/dashboard/logs#export`) map securely under routing strings cleanly without impacting schema constraints.
- The `admin_audit_log` table has NO `DELETE` or `UPDATE` endpoints exposed at the application layer.

## 8. Security Headers
Defined in `public/_headers` (hardened 2026-04-10):
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-XSS-Protection: 0` — disabled (CSP supersedes it; `1; mode=block` leaks data)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin` — isolates browsing context
- `Cross-Origin-Resource-Policy: same-origin` — blocks cross-origin data reads
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — 2-year HSTS
- `Content-Security-Policy` — `'unsafe-eval'` and `'unsafe-inline'` completely removed. Fully secured via Astro 6 native CSP nonces (`data-astro-csp` and `security.csp` config).

{% endraw %}

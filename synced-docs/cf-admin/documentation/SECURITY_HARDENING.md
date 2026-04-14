# 🔐 Security Hardening Architecture

> **Status:** Production Ready
> **Last Updated:** April 2026
> **Scope:** CSRF, Cookie Security, Error Sanitization, Request Tracing, Input Validation

This document details the security hardening measures applied across the `cf-admin` portal, covering every layer from transport to application.

---

## 1. Defense Layers Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                   LAYER 5: AUDIT INTEGRITY                       │
│  All context-critical mutations tracked (admin_audit_log)        │
│  Fire-and-forget execution via ctx.waitUntil                     │
├──────────────────────────────────────────────────────────────────┤
│                   LAYER 4: ERROR SANITIZATION                    │
│  All API endpoints return generic error messages                 │
│  No stack traces, SQL errors, or schema details leak             │
├──────────────────────────────────────────────────────────────────┤
│                   LAYER 3: CSRF PROTECTION                       │
│  Stateless Origin + Referer validation (src/lib/csrf.ts)         │
│  Applied globally to POST/PUT/PATCH/DELETE via middleware         │
├──────────────────────────────────────────────────────────────────┤
│                   LAYER 2: SESSION SECURITY                      │
│  __Host- cookie prefix (production) — prevents fixation          │
│  30min JWT refresh + 24h hard expiry                             │
│  Reverse-index KV session mapping for O(k) force-logout          │
├──────────────────────────────────────────────────────────────────┤
│                   LAYER 1: TRANSPORT SECURITY                    │
│  HSTS (2-year preload) + DENY framing + strict CSP              │
│  X-Request-ID for audit correlation (crypto.randomUUID)          │
│  HTTP method restriction on public routes (GET/HEAD only)        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. CSRF Protection

**File:** `src/lib/csrf.ts`

### How It Works

Stateless CSRF validation using the browser's automatic Origin and Referer header behavior. No tokens, no cookies, no client JavaScript required.

| Step | Check | Action |
|------|-------|--------|
| 1 | Method is `GET`, `HEAD`, or `OPTIONS` | Skip — safe methods don't mutate state |
| 2 | `Origin` header matches `SITE_URL` | ✅ Allow |
| 3 | `Origin` header doesn't match | ❌ Deny — "CSRF: Origin mismatch" |
| 4 | No `Origin`, but `Referer` starts with `SITE_URL` | ✅ Allow (fallback) |
| 5 | No `Referer` either | ❌ Deny — "CSRF: Missing origin headers" (fail-closed) |

### Integration

The `validateCsrf()` function is called in `middleware.ts` for every incoming request before reaching any API route. If CSRF check fails, middleware returns `403 Forbidden` immediately.

### Development Mode

When `SITE_URL` is not configured (local dev with `.dev.vars` omitting it), CSRF validation is skipped entirely (fail-open for developer convenience).

### Performance

- **CPU cost:** <0.05ms (two string comparisons)
- **KV reads:** 0
- **Client JavaScript:** 0 bytes
- **No token management, no cookie overhead**

---

## 3. Cookie Security

**File:** `src/lib/auth/session.ts`

### `__Host-` Cookie Prefix

In production, session cookies use the `__Host-admin_session` name. The `__Host-` prefix is a browser-enforced security mechanism:

- ✅ Cookie must be set with `Secure` flag
- ✅ Cookie must be set from the host (not a subdomain)
- ✅ Cookie path must be `/`
- ✅ Cookie cannot be set by a subdomain of the same top-level domain

This prevents **subdomain fixation attacks** where an attacker on `evil.madagascarhotelags.com` attempts to inject a session cookie for `secure.madagascarhotelags.com`.

In development (`SITE_URL` absent), a plain `admin_session` name is used without the prefix.

---

## 4. HTTP Method Restriction

**File:** `src/middleware.ts`

Public routes (`/`, `/auth/callback`) are restricted to `GET` and `HEAD` methods only:

```typescript
const PUBLIC_ROUTES = ['/', '/auth/callback'];
const method = context.request.method.toUpperCase();

if (PUBLIC_ROUTES.includes(pathname) && method !== 'GET' && method !== 'HEAD') {
  return new Response('Method Not Allowed', { status: 405 });
}
```

This prevents direct POST/DELETE attacks against auth endpoints.

---

## 5. Request Tracing

**File:** `src/middleware.ts`

Every request receives a unique `X-Request-ID` header generated via `crypto.randomUUID()`:

```typescript
response.headers.set('X-Request-ID', crypto.randomUUID());
```

This ID can be correlated with audit log entries to trace the lifecycle of any request from ingress through mutation to audit write.

---

## 6. Error Sanitization

All API endpoints follow a strict error response policy:

### Rules
1. **Never expose** `error.message` from caught exceptions — it may contain SQL errors, file paths, or internal state
2. **Always return** generic error messages: `"Failed to process request"`, `"Insufficient privileges"`, etc.
3. **Log the real error** server-side via `console.error` for Sentry/Cloudflare observability
4. **Uniform 404 shape** for hidden account queries — whether the account exists or not, unauthorized roles see the same response

### Example Pattern (Every API Route)

```typescript
try {
  // ... business logic
} catch (err) {
  console.error('[API:module] Operation failed:', err);
  return new Response(
    JSON.stringify({ error: 'Failed to process request' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
```

---

## 7. Auth Callback Hardening

**File:** `src/pages/auth/callback.astro`

The OAuth callback endpoint (`/auth/callback`) includes multiple security layers:

| Protection | Implementation |
|-----------|----------------|
| **Provider Validation** | OAuth provider string is validated against a whitelist (`google`, `github`, `facebook`, `email`) |
| **Whitelist Check** | Email is verified against `admin_authorized_users` before session creation |
| **Session Binding** | Session is bound to user ID, email, role, and creation timestamp |

---

## 8. Security Headers

**File:** `public/_headers`

Applied globally by Cloudflare:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-XSS-Protection` | `0` | Disabled (CSP supersedes; `1; mode=block` leaks data) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information leakage |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browsing context |
| `Cross-Origin-Resource-Policy` | `same-origin` | Blocks cross-origin data reads |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()` | Disables unnecessary APIs |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | 2-year HSTS |
| `Content-Security-Policy` | Nonce-based via Astro 6 | No `unsafe-eval` or `unsafe-inline` |

---

## 9. Key Files Reference

| File | Security Function |
|------|-------------------|
| `src/lib/csrf.ts` | CSRF validation — Origin + Referer checking |
| `src/lib/audit.ts` | Audit engine for secure logging in `ctx.waitUntil` |
| `src/lib/auth/rbac.ts` | 5-tier role hierarchy + permission helpers |
| `src/lib/auth/session.ts` | `__Host-` cookie prefix + session lifecycle |
| `src/lib/auth/guard.ts` | Server-side auth gate + role enforcement |
| `src/middleware.ts` | CSRF gate + method restriction + X-Request-ID + PLAC check |
| `src/pages/auth/callback.astro` | Provider validation + whitelist check |
| `public/_headers` | Security headers (HSTS, CSP, frame protection) |

---

## 10. Required Production Secrets

All must be deployed via `wrangler secret put <KEY>`:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin operations |
| `PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase auth flows |
| `REVALIDATION_SECRET` | Authenticates ISR webhooks from cf-admin to cf-astro |
| `SITE_URL` | Used for CSRF Origin validation + `__Host-` cookie decision |
| `UPSTASH_REDIS_REST_URL` | Redis connection for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile captcha verification |
| `CLOUDFLARE_API_TOKEN` | Cloudflare GraphQL analytics access |
| `CLOUDFLARE_ZONE_ID` | Specific CF zone for Dashboard HTTP metrics |
| `RESEND_API_KEY` | Resend API for outgoing emails & dashboard metrics |
| `SENTRY_AUTH_TOKEN` | Sentry API token for dashboard error feed |

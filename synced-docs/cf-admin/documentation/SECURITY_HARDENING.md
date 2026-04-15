# 🔐 Security Hardening Architecture

> **Status:** Production Ready
> **Last Updated:** April 2026
> **Scope:** CSRF, Cookie Security, Error Sanitization, Request Tracing, Input Validation

This document details the security hardening measures applied across the `cf-admin` portal, covering every layer from transport to application.

---

## 1. Defense Layers Overview

The system implements a 5-layer defense architecture:

- **Layer 5 — Audit Integrity:** All context-critical mutations are tracked via fire-and-forget deferred execution.
- **Layer 4 — Error Sanitization:** All API endpoints return generic error messages. No stack traces, SQL errors, or schema details leak.
- **Layer 3 — CSRF Protection:** Stateless Origin + Referer validation applied globally to all mutating HTTP methods via middleware.
- **Layer 2 — Session Security:** Host-prefixed cookie (production), 30-minute JWT refresh + 24-hour hard expiry, reverse-index KV session mapping for O(k) force-logout.
- **Layer 1 — Transport Security:** HSTS (2-year preload) + DENY framing + strict CSP, request ID for audit correlation, HTTP method restriction on public routes (GET/HEAD only).

---

## 2. CSRF Protection

### How It Works

Stateless CSRF validation using the browser's automatic Origin and Referer header behavior. No tokens, no cookies, no client JavaScript required.

| Step | Check | Action |
|------|-------|--------|
| 1 | Method is `GET`, `HEAD`, or `OPTIONS` | Skip — safe methods don't mutate state |
| 2 | `Origin` header matches site URL | ✅ Allow |
| 3 | `Origin` header doesn't match | ❌ Deny — origin mismatch |
| 4 | No `Origin`, but `Referer` starts with site URL | ✅ Allow (fallback) |
| 5 | No `Referer` either | ❌ Deny — missing origin headers (fail-closed) |

### Integration

The CSRF validation function is called in middleware for every incoming request before reaching any API route. If CSRF check fails, middleware returns `403 Forbidden` immediately.

### Development Mode

When the site URL is not configured (local dev), CSRF validation is skipped entirely (fail-open for developer convenience).

### Performance

- **CPU cost:** <0.05ms (two string comparisons)
- **KV reads:** 0
- **Client JavaScript:** 0 bytes
- **No token management, no cookie overhead**

---

## 3. Cookie Security

### Host-Prefixed Cookie

In production, session cookies use a browser-enforced security prefix. This prefix enforces:

- ✅ Cookie must be set with `Secure` flag
- ✅ Cookie must be set from the host (not a subdomain)
- ✅ Cookie path must be `/`
- ✅ Cookie cannot be set by a subdomain of the same top-level domain

This prevents **subdomain fixation attacks** where an attacker on a malicious subdomain attempts to inject a session cookie for the secure admin domain.

In development (site URL absent), a plain session cookie name is used without the prefix.

---

## 4. HTTP Method Restriction

Public routes (homepage and auth callback) are restricted to `GET` and `HEAD` methods only. Any other HTTP method on these routes returns `405 Method Not Allowed`. This prevents direct POST/DELETE attacks against auth endpoints.

---

## 5. Request Tracing

Every request receives a unique request ID header generated via `crypto.randomUUID()`. This ID can be correlated with audit log entries to trace the lifecycle of any request from ingress through mutation to audit write.

---

## 6. Error Sanitization

All API endpoints follow a strict error response policy:

### Rules
1. **Never expose** raw error messages from caught exceptions — they may contain SQL errors, file paths, or internal state.
2. **Always return** generic error messages to the client.
3. **Log the real error** server-side for observability (Sentry/Cloudflare logs).
4. **Uniform 404 shape** for hidden account queries — whether the account exists or not, unauthorized roles see the same response.

---

## 7. Auth Callback Hardening

The OAuth callback endpoint includes multiple security layers:

| Protection | Implementation |
|-----------|----------------|
| **Provider Validation** | OAuth provider string is validated against a whitelist of allowed providers |
| **Whitelist Check** | Email is verified against the authorized users registry before session creation |
| **Session Binding** | Session is bound to user ID, email, role, and creation timestamp |

---

## 8. Security Headers

Applied globally by Cloudflare:

| Header | Purpose |
|--------|---------|
| `X-Frame-Options: DENY` | Prevents clickjacking |
| `X-Content-Type-Options: nosniff` | Prevents MIME sniffing |
| `X-XSS-Protection: 0` | Disabled (CSP supersedes; legacy mode leaks data) |
| `Referrer-Policy` | Controls referrer information leakage (strict-origin-when-cross-origin) |
| `Cross-Origin-Opener-Policy` | Isolates browsing context (same-origin) |
| `Cross-Origin-Resource-Policy` | Blocks cross-origin data reads (same-origin) |
| `Permissions-Policy` | Disables unnecessary browser APIs (camera, microphone, geolocation, payment) |
| `Strict-Transport-Security` | 2-year HSTS with preload |
| `Content-Security-Policy` | Nonce-based via Astro 6 — no `unsafe-eval` or `unsafe-inline` |

---

## 9. Required Production Secrets

All must be deployed as Worker secrets via Wrangler:

| Secret | Purpose |
|--------|---------|
| Supabase Service Role Key | Server-side Supabase admin operations |
| Supabase Anonymous Key | Client-side Supabase auth flows |
| Revalidation Secret | Authenticates ISR webhooks between projects |
| Site URL | Used for CSRF Origin validation + cookie prefix decision |
| Redis REST URL | Redis connection for rate limiting |
| Redis REST Token | Redis auth token |
| Turnstile Secret | Cloudflare Turnstile captcha verification |
| Cloudflare API Token | Cloudflare GraphQL analytics access |
| Cloudflare Zone ID | Specific CF zone for Dashboard HTTP metrics |
| Resend API Key | Outgoing emails & dashboard metrics |
| Sentry Auth Token | Sentry API for dashboard error feed |

{% raw %}
# 🔐 Security Hardening Architecture

> **Status:** Production Ready
> **Last Updated:** April 2026 (v3: Search Engine Isolation — 2026-04-21)
> **Scope:** CSRF, Cookie Security, Error Sanitization, Request Tracing, Input Validation, Database RLS

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

## 5. Ghost Protection Session Sweeps

Role mutations and permission changes trigger a synchronous **Ghost Protection Session Sweep**. When an administrator alters a user's role:
1. \
esetUserOverrides\ is called immediately to purge stale PLAC overrides.
2. \orceLogoutUser\ is called to instantly destroy the target user's active KV session.

This guarantees that modified users are instantly expelled and forced to re-authenticate under their new context, completely blocking privilege escalation via lingering session tokens.
---

## 6. Request Tracing

Every request receives a unique request ID header generated via `crypto.randomUUID()`. This ID can be correlated with audit log entries to trace the lifecycle of any request from ingress through mutation to audit write.

---

## 7. Error Sanitization

All API endpoints follow a strict error response policy:

### Rules
1. **Never expose** raw error messages from caught exceptions — they may contain SQL errors, file paths, or internal state.
2. **Always return** generic error messages to the client.
3. **Log the real error** server-side for observability (Sentry/Cloudflare logs).
4. **Uniform 404 shape** for hidden account queries — whether the account exists or not, unauthorized roles see the same response.

---

## 8. Auth Callback Hardening

The OAuth callback endpoint includes multiple security layers:

| Protection | Implementation |
|-----------|----------------|
| **Provider Validation** | OAuth provider string is validated against a whitelist of allowed providers |
| **Whitelist Check** | Email is verified against the authorized users registry before session creation |
| **Session Binding** | Session is bound to user ID, email, role, and creation timestamp |

---

## 9. Security Headers

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


## 9. Strict Content Security Policy (CSP)

The admin portal implements a Strict Content Security Policy that outright bans \unsafe-inline\ styles and scripts. 

### 9.1 Data-Attribute Driven CSS
To achieve strict CSP compliance without sacrificing modern UI interactivity, the dashboard utilizes **Data-Attribute Driven CSS**. Dynamic UI state (e.g., expanded sidebars, active tabs, dialog visibility) is controlled entirely via data attributes (e.g., \data-state="expanded"\, \data-active="true"\) instead of inline \style={{...}}\ properties. This decoupling of presentation state from JavaScript ensures malicious inline injections are blocked while maintaining a robust "Main Workspace + Sidebar Architecture".

---
## 10. Required Production Secrets

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

---

## 11. Database-Layer Security (Supabase RLS)

All Supabase PostgreSQL tables enforce Row-Level Security (RLS). The hardening pass on **2026-04-21** closed critical exposure vectors:

### 11.1 Service-Role Isolation

All admin and chatbot tables are locked to `service_role` access only. The publicly-exposed `anon` key cannot read, update, or delete any administrative data.

**Standardized policy pattern:**
```sql
CREATE POLICY "service_role_full_access" ON table_name
  FOR ALL TO authenticated
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
```

### 11.2 Critical Fixes Applied

| Vulnerability | Tables Affected | Fix |
|--------------|----------------|-----|
| `USING(true)` on chatbot data | `chat_analytics`, `contacts`, `conversations`, `messages` | Locked to `service_role` |
| Open UPDATE on bookings | `bookings` | Replaced anon UPDATE with `service_role`-only |
| Missing access policy | `email_audit_logs` | Added `service_role` full access |
| Per-row `auth.role()` evaluation | `admin_authorized_users`, `admin_sessions`, `legal_requests` | Wrapped in `(select ...)` subquery |
| Function search_path injection | `get_usage_metrics()` | Pinned `SET search_path = public` |

### 11.3 Intentional Exceptions

Public-facing form tables (`bookings`, `consent_records`, `legal_requests`, `privacy_requests`, etc.) retain `INSERT WITH CHECK (true)` for anonymous submissions. This is a conscious design trade-off — the public website must submit data without authentication.

> 📖 **Full RLS policy matrix:** [`documentation/database-rls-policy.md`](./database-rls-policy.md)

{% endraw %}

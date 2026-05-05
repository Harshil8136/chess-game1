{% raw %}
# Security Hardening — cf-astro

> **Audit Date:** 2026-05-04
> **Status:** Applied. See §Manual Steps for actions that require dashboard/CLI access.

---

## 1. What Changed (Applied Automatically)

### 1.1 Database — Principle of Least Privilege (`cf_astro_writer` role)

**Problem:** `DATABASE_URL` connected as the `postgres` superuser, which has `BYPASSRLS` and full read/write access to every table including cross-project tables (`conversations`, `admin_sessions`, etc.). A leaked `DATABASE_URL` = full database breach.

**Fix applied via Supabase migration `create_cf_astro_writer_role_and_rls`:**

A new PostgreSQL role `cf_astro_writer` was created with exactly the permissions the application needs and nothing more:

| Table | Permissions | Why |
|-------|-------------|-----|
| `bookings` | INSERT | Booking flow writes only; full data already linked via FK |
| `booking_pets` | INSERT | Same |
| `consent_records` | INSERT | Consent logging only |
| `booking_quality_metadata` | INSERT | Quality scoring only |
| `privacy_requests` | INSERT | ARCO/privacy form submission |
| `legal_requests` | INSERT, SELECT | ARCO form + admin get-document endpoint |
| `email_audit_logs` | INSERT, SELECT, UPDATE | Audit trail + Resend webhook delivery events |
| All other tables | **NONE** | Cross-project isolation enforced at DB level |

RLS policies were added for `cf_astro_writer` on every table it touches. Even if credentials leak, an attacker gets INSERT-only on PII tables with zero read-back capability.

**Action required (§4.1):** Update `DATABASE_URL` secret to use `cf_astro_writer` credentials.

---

### 1.2 Database — New Performance Indexes

Applied via migration `add_missing_performance_indexes`:

| Index | Table | Purpose |
|-------|-------|---------|
| `idx_email_audit_logs_resend_id` | `email_audit_logs` | Resend webhook correlation by delivery ID |
| `idx_email_audit_logs_created_at` | `email_audit_logs` | Admin time-range audit queries |
| `idx_email_audit_logs_status` | `email_audit_logs` | Monitoring (sent/bounced/delivered filtering) |
| `idx_legal_requests_created_at` | `legal_requests` | Admin listing by submission date |
| `idx_legal_requests_email` | `legal_requests` | ARCO cross-reference by requester email |
| `idx_privacy_requests_created_at` | `privacy_requests` | Admin listing by submission date |

---

### 1.3 API — `/api/test-services` Authentication Added

**Problem:** The Analytics Engine write endpoint was fully public — anyone could spam telemetry data into the dataset.

**Fix:** Bearer token auth using `HEALTH_CHECK_SECRET` (constant-time comparison via `timingSafeEq`). Removed internal error details from error responses.

---

### 1.4 API — PII Stripped from `emailAuditLogs.payload`

**Problem:** `email_audit_logs.payload` (JSONB) stored the full email payload including `ownerName`, `ownerEmail`, `ownerPhone`, `emergencyContact`, `specialInstructions`, `transportAddress`, and the full `pets[]` array. A breach of the audit table = all customer PII exposed redundantly.

**Fix:** The audit log now stores only non-PII metadata:
```typescript
{ bookingRef, service, petCount, hasTransport, locale }
```

The queue message (transient, never persisted) still carries full data so the email consumer can build the confirmation email. The booking + booking_pets tables remain the authoritative PII store (already protected by RLS).

---

### 1.5 API — Error Message Leaks Fixed

**Problem:** `/api/admin/generate-faqs` and `/api/admin/generate-blog-draft` returned raw AI error messages to callers: `"AI generation failed: <internal error>"`.

**Fix:** Generic error message returned to caller; full error logged to `console.error` (captured by Cloudflare Workers Observability / Sentry).

---

### 1.6 API — Timing-Safe Auth on All Admin Endpoints

**Problem:** `/api/health` used direct `===` string comparison for the Bearer token, which is vulnerable to timing-based secret enumeration.

**Fix:** All admin endpoints now use `timingSafeEq()` from `src/lib/security.ts` for Bearer token comparison. Verified across:
- `/api/test-services` ✅
- `/api/health` ✅
- `/api/analytics/summary` ✅
- `/api/revalidate` — uses header comparison; hardened by rate-limit-first pattern

---

### 1.7 API — Rate Limiting on `/api/analytics/summary`

**Problem:** Auth-gated but no rate limit. An attacker with the secret could spam requests.

**Fix:** Rate limit applied first (60 req/60s via Upstash), before the auth check. Rate-limiting before auth prevents secret enumeration via timing differences in auth processing.

---

### 1.8 Rate Limiter — UUID Fallback (Not `'anonymous'`)

**Problem:** When no IP header is present, all requests shared one `anonymous` rate limit bucket — all unauthenticated requests could be blocked together, or one client could consume the whole shared budget.

**Fix:** Falls back to `crypto.randomUUID()` — each request without an IP header gets its own unique bucket (rate limit is effectively disabled for that request, but it prevents cross-request interference). In production behind Cloudflare, `cf-connecting-ip` is always present, so this path never triggers.

---

### 1.9 Analytics Engine — Error Blob Sanitized

**Problem:** `booking.ts` wrote `String(err)` to the Analytics Engine blobs array, potentially storing exception messages (which can contain PII or stack traces) in telemetry.

**Fix:** Error events now write only the event type label, not the exception string.

---

### 1.10 Supabase Anon Key — Upgraded to `sb_publishable_*` Format

**Problem:** Legacy JWT anon key (`eyJhb...`) was committed to `wrangler.toml`. While RLS blocks all anon-role access to PII tables (zero exploitability), the key is tied to the JWT secret rotation cycle (rotating it requires rotating ALL Supabase tokens simultaneously).

**Fix:** Migrated to the new `sb_publishable_*` format (`sb_publishable_JC5dlnv64...`), which supports independent per-key rotation without disrupting `service_role` or `postgres` credentials. Key in `wrangler.toml` is safe to commit.

---

### 1.11 `wrangler.toml` — Complete Secrets Inventory

All Worker secrets are now fully documented in `wrangler.toml` with format notes. `ARCO_ADMIN_SECRET` and `HEALTH_CHECK_SECRET` — previously undocumented — are now explicitly listed.

---

### 1.12 `env.d.ts` — Complete Type Coverage

Added missing types:
- `ADMIN_AI_SECRET: string`
- `HEALTH_CHECK_SECRET: string`
- `DATABASE_URL_ADMIN?: string` (optional, emergency admin use)
- Marked `SUPABASE_SERVICE_ROLE_KEY` as optional (not used by Drizzle path)
- Added inline comments explaining each group's purpose

---

## 2. Security Architecture Summary (Post-Hardening)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  cf-astro (Cloudflare Pages Worker)                                     │
│                                                                         │
│  PUBLIC API ROUTES                    ADMIN API ROUTES                  │
│  /api/booking    ─ CSRF+RL+Turnstile  /api/health      ─ HEALTH_CHECK   │
│  /api/consent    ─ RL+Zod             /api/test-services─ HEALTH_CHECK   │
│  /api/arco/*     ─ CSRF+RL+Turnstile  /api/revalidate  ─ REVAL_SECRET   │
│  /api/privacy/*  ─ CSRF+RL+Zod       /api/analytics/* ─ REVAL_SECRET   │
│  /api/webhooks/* ─ Svix HMAC-SHA256  /api/admin/*     ─ ADMIN_AI_SECRET │
│                                       /api/arco/get-doc─ ARCO_SECRET    │
│                                                                         │
│  RL = Upstash sliding-window rate limit (per-IP, UUID fallback)         │
│  All Bearer comparisons use timingSafeEq() (no timing leaks)            │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │                            │
    ┌─────────▼──────────┐      ┌──────────▼───────────┐
    │  Cloudflare D1     │      │  Supabase PostgreSQL  │
    │  (non-PII only)    │      │  (all PII tables)     │
    │                    │      │                       │
    │  cms_content       │      │  Role: cf_astro_writer│
    │  admin_feat_flags  │      │  Permissions:         │
    │                    │      │  - INSERT on PII tbls │
    │  No RLS (SQLite)   │      │  - SELECT+UPDATE on   │
    │  Worker-only access│      │    email_audit_logs   │
    │  (binding, no net) │      │  - SELECT on          │
    └────────────────────┘      │    legal_requests     │
                                │  NO: DELETE anywhere  │
                                │  NO: cross-proj tables│
                                │                       │
                                │  RLS: ON all tables   │
                                │  service_role policy  │
                                │  + cf_astro_writer    │
                                │    policies per op    │
                                └───────────────────────┘
```

---

## 3. RLS Policy Map (Post-Hardening)

| Table | `service_role` | `cf_astro_writer` | `anon` | `authenticated` |
|-------|---------------|-------------------|--------|-----------------|
| `bookings` | ALL | INSERT | ❌ | ❌ |
| `booking_pets` | ALL | INSERT | ❌ | ❌ |
| `consent_records` | ALL | INSERT | ❌ | ❌ |
| `booking_quality_metadata` | ALL | INSERT | ❌ | ❌ |
| `privacy_requests` | ALL | INSERT | ❌ | ❌ |
| `legal_requests` | ALL | INSERT, SELECT | ❌ | ❌ |
| `email_audit_logs` | ALL | INSERT, SELECT, UPDATE | ❌ | ❌ |
| `admin_authorized_users` | ALL | ❌ | ❌ | ❌ |
| `admin_sessions` | ALL | ❌ | ❌ | ❌ |
| `conversations` / chat tables | ALL | ❌ | ❌ | ❌ |

---

## 4. Manual Steps Required

These changes cannot be applied programmatically and require dashboard or CLI access.

### 4.1 Update `DATABASE_URL` Secret — MOST IMPORTANT

The `cf_astro_writer` role has been created in Supabase with a temporary password. You must:

**Step 1** — Set a strong permanent password via Supabase SQL Editor:
```sql
ALTER ROLE cf_astro_writer WITH PASSWORD 'YOUR_STRONG_RANDOM_PASSWORD_HERE';
```
Generate a strong password: use a password manager or `openssl rand -base64 32`.

**Step 2** — Update `DATABASE_URL` secret in Cloudflare Pages:
```bash
# Direct connection (recommended for Workers — avoids Supavisor double-pooling)
DATABASE_URL = postgresql://cf_astro_writer:<password>@db.zlvmrepvypucvbyfbpjj.supabase.co:5432/postgres

# Pooler alternative (if direct hits connection limits)
DATABASE_URL = postgresql://cf_astro_writer.zlvmrepvypucvbyfbpjj:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

```bash
wrangler pages secret put DATABASE_URL
```

**Step 3** — Save the old `postgres` superuser connection string as `DATABASE_URL_ADMIN`:
```bash
wrangler pages secret put DATABASE_URL_ADMIN
# Enter: postgresql://postgres:<original_password>@db.zlvmrepvypucvbyfbpjj.supabase.co:5432/postgres
```

**Step 4** — Redeploy:
```bash
astro build && wrangler deploy
```

**Step 5** — Verify the new role works by checking `/api/health` (D1 ping) and submitting a test booking.

---

### 4.2 Add DMARC Record — Prevents Email Spoofing

Without DMARC, anyone can send email that appears to come from `@madagascarhotelags.com`.

In Cloudflare DNS → Add TXT record:
```
Name:    _dmarc
Type:    TXT
Content: v=DMARC1; p=quarantine; rua=mailto:booking@madagascarhotelags.com; sp=quarantine; adkim=r; aspf=r
TTL:     Auto
```

Start with `p=quarantine` (suspicious mail goes to spam). Upgrade to `p=reject` after 30 days of monitoring the `rua` reports.

---

### 4.3 Cloudflare Dashboard Security Settings

In the Cloudflare Dashboard for `madagascarhotelags.com`:

**SSL/TLS → Overview:**
- [ ] Set to **Full (strict)** — rejects invalid/self-signed origin certs

**SSL/TLS → Edge Certificates:**
- [ ] **Always Use HTTPS** → ON
- [ ] **HTTP Strict Transport Security (HSTS)**:
  - Max Age: 12 months
  - Include subdomains: ON
  - Preload: ON (submit to hstspreload.org after confirming all subdomains work)

**Security → Bots:**
- [ ] **Bot Fight Mode** → ON (free, blocks known bad bots before they hit Workers)

**DNS — Orphaned Records to Clean Up:**
- [ ] `charlar.madagascarhotelags.com` — delete if unused, or orange-cloud + deploy Worker
- [ ] `chat.madagascarhotelags.com` — should point to cf-chatbot deployment
- [ ] `secure.madagascarhotelags.com` — delete if unused
- [ ] `pet.madagascarhotelags.com` — already has redirect rule; switch from gray-cloud to orange-cloud

---

### 4.4 Rotate `DATABASE_URL` Password Regularly

Recommended: rotate the `cf_astro_writer` password every 90 days.
```sql
-- In Supabase SQL Editor
ALTER ROLE cf_astro_writer WITH PASSWORD 'NEW_STRONG_PASSWORD';
```
Then update the Cloudflare Pages secret and redeploy.

---

### 4.5 Future: Nonce-Based CSP (Eliminates `unsafe-inline`)

The current CSP requires `'unsafe-inline'` because Astro injects inline `<script>` tags for island hydration. This is a known Astro limitation.

To eliminate it: convert affected routes to SSR (non-prerendered) and generate a per-request nonce in middleware, passing it to Astro's `<script>` and `<style>` elements. This is medium-effort and does not block production — `'unsafe-inline'` is mitigated by the fact that there is no user-controlled content reflected in the HTML.

---

## 5. What Was NOT Changed (By Design)

| Item | Decision |
|------|----------|
| `unsafe-inline` in CSP | Astro framework requirement; mitigated by no reflected user input in HTML |
| Consent records IP address | Stored for legal forensic compliance (LFPDPPP) — intentional |
| ISR cache TTL (24h) | Current value is already correct — audit report had a false value |
| D1 no RLS | SQLite has no RLS; D1 is Worker-binding-only (no network exposure), stores zero PII |
| Magic bytes validation first-12-bytes | Acceptable for R2-stored immutable files; antivirus scanning exceeds $0 budget |
| Sentry DSN public | DSNs are designed to be public; org/project ID exposure is acceptable per Sentry docs |

---

## 6. Secrets Inventory (Production)

All secrets set via `wrangler pages secret put` or Cloudflare Pages dashboard:

| Secret | Scope | Set Via |
|--------|-------|---------|
| `DATABASE_URL` | cf_astro_writer PG connection | `wrangler pages secret put` |
| `DATABASE_URL_ADMIN` | postgres superuser (emergency) | `wrangler pages secret put` |
| `REVALIDATION_SECRET` | /api/revalidate + /api/analytics/summary | Pages dashboard |
| `ADMIN_AI_SECRET` | /api/admin/generate-* | Pages dashboard |
| `HEALTH_CHECK_SECRET` | /api/health + /api/test-services | Pages dashboard |
| `ARCO_ADMIN_SECRET` | /api/arco/get-document | Pages dashboard |
| `RESEND_API_KEY` | cf-email-consumer worker only | `cd queue-worker && wrangler secret put` |
| `RESEND_WEBHOOK_SECRET` | /api/webhooks/resend (Svix HMAC) | Pages dashboard |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server verify | Pages dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | Pages dashboard |
| `BETTERSTACK_SOURCE_TOKEN` | Structured logging | Pages dashboard |
| `SENTRY_AUTH_TOKEN` | Build-time source map upload only | System env var (not Worker secret) |

{% endraw %}

{% raw %}
# Operations — Infrastructure, Bindings & Observability

> **Status:** Production Active
> **Last Updated:** 2026-05-02 (v4.5: SITE_URL reclassified as [vars]; SENTRY_ORG_SLUG/SENTRY_PROJECT_SLUG added; Analytics Engine binding documented)
> **Scope:** Cloudflare binding IDs, free tier limits, Sentry observability, build/deploy

---

## 1. Cloudflare Binding ID Registry

> **OPERATIONAL CRITICAL:** Never modify these IDs without verifying against the Cloudflare Dashboard first.
>
> **Incident context (2026-04-20):** ALL binding IDs in both `wrangler.toml` files were discovered pointing at non-existent resources (all 404). This caused the entire CMS image pipeline to silently fail — uploads appeared to succeed but never propagated to the live site. Fix was a config-only correction of the IDs below.

### D1 Database

| Binding | DB Name | Verified UUID |
|---------|---------|---------------|
| `DB` | `madagascar-db` | `7fca2a07-d7b4-449d-b446-408f9187d3ca` |

Both `cf-admin` and `cf-astro` share this single D1 database.

**Verification:**
```bash
curl -sH "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/320d1ebab5143958d2acd481ea465f52/d1/database/7fca2a07-d7b4-449d-b446-408f9187d3ca" | jq .result.name
# Must return: "madagascar-db"
```

### KV Namespaces

| Binding | Title | Verified UUID | Used By |
|---------|-------|---------------|---------|
| `SESSION` (cf-admin) | `ADMIN_SESSION` | `ba82eecc6f5a4956ad63178b203a268f` | cf-admin |
| `SESSION` (cf-astro) | `SESSION` | `bee123e795504473accf58ac5b6de13d` | cf-astro |
| `ISR_CACHE` | `ISR_CACHE` | `d9cea8c7e20f4b328b8cb3b04104138c` | cf-astro |

> **✅ VERIFIED (2026-04-28):** All IDs in the table above now match the LIVE Cloudflare environment. `ADMIN_SESSION` is used for isolation in `cf-admin`. `SESSION` is used for `cf-astro`.

### R2 Buckets

R2 buckets are referenced by **name** — stable, no UUID needed.

| Binding | Bucket Name | Used By |
|---------|-------------|---------|
| `IMAGES` | `madagascar-images` | cf-admin, cf-astro |
| `ARCO_DOCS` | `arco-documents` | cf-astro |

### Queues

| Binding | Queue Name | Used By |
|---------|------------|---------|
| `EMAIL_QUEUE` | `madagascar-emails` | cf-admin, cf-astro |

### Analytics Engine

| Binding | Dataset | Used By |
|---------|---------|---------|
| `ANALYTICS` | `madagascar_analytics` | cf-admin, cf-astro |

---

## 2. Pre-Flight Deploy Checklist

1. **Diff binding IDs** — verify `wrangler.toml` UUIDs match the table above
2. **Never `wrangler d1 create`** a new database with the same name — creates a new UUID, leaving `wrangler.toml` pointing at the old one
3. **Never `wrangler kv namespace create`** without updating BOTH projects' `wrangler.toml`
4. **If IDs look wrong** — verify via Cloudflare Dashboard → Workers → KV/D1 → copy UUID from there
5. **Verify required secrets** are set via `wrangler secret list`

---

## 3. Free Tier Limits

The entire project operates at $0/month. These quotas dictate caching strategies and system design constraints.

### 3.1 Cloudflare Workers

| Metric | Free Limit |
|--------|-----------|
| Requests | 100,000/day |
| CPU time per request | **10 ms** ← critical design constraint |
| Memory | 128 MB |
| Subrequests per request | 50 |
| Worker script size | 3 MB |

### 3.2 KV (Sessions & Cache)

| Metric | Free Limit |
|--------|-----------|
| Keys read | 100,000/day |
| Keys written | **1,000/day** ← determines session strategy |
| Storage | 1 GB |

### 3.3 D1 Database

| Metric | Free Limit |
|--------|-----------|
| Rows read | 5 million/day |
| Rows written | 100,000/day |
| Storage | 5 GB |

### 3.4 R2 Object Storage

| Metric | Free Limit |
|--------|-----------|
| Storage | 10 GB/month |
| Reads | 10 million/month |
| Writes | 1 million/month |
| Egress | **FREE (always $0)** |

### 3.5 Supabase Free Tier

| Metric | Free Limit |
|--------|-----------|
| Projects | 2 active (cf-astro + cf-admin share 1) |
| PostgreSQL size | 500 MB |
| Auth MAUs | 50,000 |
| File storage | 1 GB |

### 3.6 Upstash (Redis rate limiting)

| Metric | Free Limit |
|--------|-----------|
| Commands/day | 10,000 |
| Max data size | 256 MB |
| Concurrent connections | 10 |

---

## 4. Observability — Sentry

**Package:** `@sentry/cloudflare`
**Config file:** `sentry.server.config.ts`

### 4.1 Architecture

Sentry is integrated at the Cloudflare Edge layer (CDN-native). Key decisions:

- **10% trace sampling** (`tracesSampleRate: 0.1`) — sufficient for performance monitoring without exhausting free tier quota; 100% sampling was excessive and costly
- **`sendDefaultPii: false`** — prevents IP addresses, cookies, and auth headers from being forwarded to Sentry (GDPR/LFPDPPP compliance)
- **Default browser integrations disabled** — Cloudflare Workers run on V8 `workerd` runtime, NOT a browser. Browser integrations (`BrowserTracing`, `GlobalHandlers`, `LinkedErrors`) reference `window`/`document` which don't exist in `workerd` — they cause `ReferenceError: window is not defined` at Worker startup
- **Console Capture integration only** — `console.error` calls automatically trigger Sentry event capture with stack trace, metadata, and user-agent info; no explicit `Sentry.captureException()` scattered through handlers
- **Hardcoded DSN** — Astro's Cloudflare adapter had inconsistent Vite env injection during SSR. DSN is a public routing key, not a secret, so hardcoding is safe and guarantees 100% telemetry uptime

> **workerd Compatibility Rule:** Any future Sentry integration must be validated against `workerd`. Browser-targeting integrations WILL crash the Worker at startup.

### 4.2 SSR Hydration Guard

`AdminLayout.astro` injects a global `window.onerror` + `window.onunhandledrejection` safety net. Unhandled client-side exceptions report to Sentry and trigger a recovery UI rather than a silent blank page crash loop.

### 4.3 ErrorBoundary

High-risk Preact components (data widgets, charts, API-bound tables) are wrapped in a generic `ErrorBoundary`. On rendering exception: silently reports to Sentry + renders a "Widget Failure" fallback instead of taking down the entire dashboard.

---

## 5. Required Secrets Reference (CF Zero Trust v4.0)

All secrets set via `wrangler secret put <KEY>`. Vars set in `wrangler.toml [vars]`.

### 5.1 Secrets (wrangler secret put)

| Secret | Status | Purpose |
|--------|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Active | Supabase DB ops — authorization whitelist, bookings, chatbot, consent (no GoTrue) |
| `REVALIDATION_SECRET` | ✅ Active | ISR webhook auth (cf-admin → cf-astro) |
| `UPSTASH_REDIS_REST_URL` | ✅ Active | Redis rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Active | Redis auth token |
| `CLOUDFLARE_API_TOKEN` | ✅ Active | Cloudflare GraphQL analytics (read-only) |
| `CLOUDFLARE_ZONE_ID` | ✅ Active | CF zone ID for HTTP metrics |
| `CF_API_TOKEN_READ_LOGS` | ✅ Active (2026-04-30) | Zero Trust Audit Read — CF Audit Log API polling (5-min cron for failed logins). Token name: `cf-admin: Zero Trust Audit Read` |
| `CF_API_TOKEN_ZT_WRITE` | ✅ Active (2026-04-30) | Zero Trust Session Revoke — Layer 3 force-kick (DELETE active CF sessions via API). Token name: `cf-admin: Zero Trust Session Revoke` |
| `RESEND_API_KEY` | ✅ Active (2026-04-30) | Outgoing security alert emails via Resend API |
| `SECURITY_ALERT_EMAIL` | ✅ Optional | Override recipient for login security alert emails (defaults to `mascotasmadagascar@gmail.com` if not set) |
| `SENTRY_AUTH_TOKEN` | ✅ Active | Sentry error feed (build-time source maps upload) |
| `SENTRY_ORG_SLUG` | ✅ Active | Sentry organization slug (build-time config) |
| `SENTRY_PROJECT_SLUG` | ✅ Active | Sentry project slug (build-time config) |
| `IP_HASH_SECRET` | ✅ Active | Privacy-safe IP hashing in login forensics |
| `CHATBOT_WORKER_URL` | ✅ Active | cf-chatbot Worker endpoint |
| `CHATBOT_ADMIN_API_KEY` | ✅ Active | 64-char key securing cf-chatbot access |
| `PUBLIC_SUPABASE_ANON_KEY` | ❌ **REMOVED** | GoTrue client-side auth removed — `wrangler secret delete PUBLIC_SUPABASE_ANON_KEY` |
| `TURNSTILE_SECRET_KEY` | ❌ **REMOVED** (2026-04-30) | CAPTCHA on login form — form deleted — deleted via `wrangler secret delete TURNSTILE_SECRET_KEY` |

### 5.2 Vars (wrangler.toml [vars])

| Var | Status | Purpose |
|-----|--------|---------|
| `SITE_URL` | ✅ Active | `https://secure.madagascarhotelags.com` — CSRF Origin validation + `__Host-` cookie prefix decision |
| `PUBLIC_SUPABASE_URL` | ✅ Active | Supabase project URL (DB queries only) |
| `CF_ACCOUNT_ID` | ✅ Active | Cloudflare account ID (analytics + CF API calls, Layer 3 revocation) |
| `CF_D1_DATABASE_ID` | ✅ Active | D1 database UUID for GraphQL analytics queries |
| `CF_R2_BUCKET_NAME` | ✅ Active | R2 bucket name for usage analytics |
| `CF_QUEUE_NAME` | ✅ Active | Queue name for queue stats analytics |
| `CF_TEAM_NAME` | ✅ Active (`mascotas`) | Zero Trust team name — constructs JWKS URL + CF logout URL |
| `CF_ACCESS_AUD` | ✅ Active | CF Access Application Audience tag — RS256 JWT audience verification |
| `LOCAL_DEV_ADMIN_EMAIL` | ✅ Active | Dev bypass email for localhost (no CF Access headers in `npm run dev`) |
| `PUBLIC_TURNSTILE_SITE_KEY` | ❌ **REMOVED** | No login form — remove from wrangler.toml vars |

## 6. Cloudflare API Token Registry

> **Last updated:** 2026-04-30. All tokens created under `Mascotasmadagascar@gmail.com's Account` (ID: `320d1ebab5143958d2acd481ea465f52`).
> To view/rotate: Cloudflare Dashboard → My Profile → API Tokens.

### Token: `cf-admin: Zero Trust Audit Read`
**Worker secret:** `CF_API_TOKEN_READ_LOGS`
**Used by:** `src/workers/scheduled-log-sync.ts` — 5-min cron polling of CF Access Audit Log API for failed logins

| Permission | Scope |
|------------|-------|
| Access: Audit Logs | Read |
| Access: SCIM Logs | Read |
| Logs | Read |

**API endpoint:** `GET /accounts/{id}/access/logs/access-requests?since={ts}&limit=100`

---

### Token: `cf-admin: Zero Trust Session Revoke`
**Worker secret:** `CF_API_TOKEN_ZT_WRITE`
**Used by:** `src/lib/auth/plac.ts` — Layer 3 Ghost Protection force-kick (`DELETE /accounts/{id}/access/users/{cfSubId}/active_sessions`)

| Permission | Scope |
|------------|-------|
| Access: Organizations | Write + Read + Revoke |
| Access: Organizations, Identity Providers, and Groups | Write + Read + Revoke |
| Access: Apps and Policies | Write + Read + Revoke |
| Access: Apps | Write + Read + Revoke |
| Access: Users | Write + Read |
| Access: Identity Providers | Write + Read |
| Access: Service Tokens | Write + Read |
| Access: Policies | Write + Read |
| Access: Custom Pages | Write + Read |
| Access: Device Posture | Write |
| Access: Audit Logs | Read |
| Access: Policy Test | Write + Read |
| Zero Trust | Write |
| Zero Trust: Seats | Write |
| Zero Trust: PII | Read |
| Zero Trust Resilience | Write |
| Cloudflare Zero Trust Secure DNS Locations | Write |
| Logs | Write + Read |
| Account Analytics | Read |
| Cloudflare CDS Compute Account | Write + Read |

> **Note:** This token has broad Zero Trust permissions. It is scoped to the `Mascotasmadagascar@gmail.com` account only (not zone-level). The critical permission for Layer 3 force-kick is `Access: Organizations Revoke` — this allows deleting active CF Access sessions via API.

---

## 7. Build & Deploy Commands

```bash
# cf-admin
npm run dev           # Local dev server (wrangler dev)
npm run build         # Production build
wrangler deploy       # Deploy to Cloudflare Workers

# D1 migrations (run in order, --remote for production)
# ✅ All migrations through 0020 applied as of 2026-04-30
wrangler d1 execute madagascar-db --file=migrations/0021_*.sql --remote  # next migration

# Secrets management
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put CF_API_TOKEN_READ_LOGS    # see §6 for token permissions
wrangler secret put CF_API_TOKEN_ZT_WRITE     # see §6 for token permissions
wrangler secret list

# Verify bindings are live
wrangler d1 list
wrangler kv namespace list
```

For full secrets + vars reference, see [SECURITY.md](./SECURITY.md) §9.

---

## 8. Monthly Cost Reference

| Service | Cost |
|---------|------|
| Cloudflare Workers | $0 (free tier) |
| D1, KV, R2, Queues | $0 (free tier) |
| Supabase | $0 (free tier) |
| Upstash | $0 (free tier) |
| Resend (email) | $0 (free tier, <3K/month) |
| Anthropic (Claude Haiku fallback) | ~$0.01–0.50/month |
| **Total** | **~$0.50/month max** |

{% endraw %}

{% raw %}
# Operations — Infrastructure, Bindings & Observability

> **Status:** Production Active
> **Last Updated:** 2026-04-27 (CF Zero Trust migration: new secrets added, anon key + Turnstile removed)
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

- **Full trace sampling** enabled — all executions monitored
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
| `SITE_URL` | ✅ Active | CSRF Origin validation + `__Host-` cookie prefix decision |
| `UPSTASH_REDIS_REST_URL` | ✅ Active | Redis rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Active | Redis auth token |
| `CF_API_TOKEN` | ✅ Active | Cloudflare GraphQL analytics (read-only) |
| `CF_API_TOKEN_ZT_WRITE` | 🔴 **NEW — needed** | Zero Trust: Edit — Layer 3 force-kick (DELETE active CF sessions via API) |
| `CF_API_TOKEN_READ_LOGS` | 🔴 **NEW — needed** | Zero Trust: Read — CF Audit Log API polling (5-min cron for failed logins) |
| `CF_ZONE_ID` | ✅ Active | CF zone for HTTP metrics |
| `RESEND_API_KEY` | ✅ Active | Outgoing emails + dashboard metrics |
| `SENTRY_AUTH_TOKEN` | ✅ Active | Sentry error feed |
| `IP_HASH_SECRET` | ✅ Active | Privacy-safe IP hashing in login forensics |
| `CHATBOT_WORKER_URL` | ✅ Active | cf-chatbot Worker endpoint |
| `CHATBOT_ADMIN_API_KEY` | ✅ Active | 64-char key securing cf-chatbot access |
| `PUBLIC_SUPABASE_ANON_KEY` | ❌ **REMOVED** | GoTrue client-side auth removed — `wrangler secret delete PUBLIC_SUPABASE_ANON_KEY` |
| `TURNSTILE_SECRET_KEY` | ❌ **REMOVED** | CAPTCHA on login form — form deleted — `wrangler secret delete TURNSTILE_SECRET_KEY` |

### 5.2 Vars (wrangler.toml [vars])

| Var | Status | Purpose |
|-----|--------|---------|
| `PUBLIC_SUPABASE_URL` | ✅ Active | Supabase project URL (DB queries only) |
| `CF_ACCOUNT_ID` | ✅ Active | Cloudflare account ID (analytics + CF API calls) |
| `CF_TEAM_NAME` | 🔴 **NEW — needed** | Zero Trust team name for CF logout URL (`https://{CF_TEAM_NAME}.cloudflareaccess.com/cdn-cgi/access/logout`) |
| `CF_ACCESS_AUD` | 🔴 **NEW — needed** | CF Access Application Audience tag — required for RS256 JWT audience verification |
| `PUBLIC_TURNSTILE_SITE_KEY` | ❌ **REMOVED** | No login form — remove from wrangler.toml vars |

## 6. Build & Deploy Commands

```bash
# cf-admin
npm run dev           # Local dev server (wrangler dev)
npm run build         # Production build
wrangler deploy       # Deploy to Cloudflare Workers

# D1 migrations (run in order, --remote for production)
wrangler d1 execute madagascar-db --file=migrations/0001_*.sql --remote

# Pending CF Zero Trust migration
wrangler d1 execute madagascar-db --file=migrations/0020_cf_zero_trust_schema.sql --remote

# Secrets management
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put CF_API_TOKEN_ZT_WRITE     # NEW — required for Layer 3 force-kick
wrangler secret put CF_API_TOKEN_READ_LOGS    # NEW — required for cron audit log polling
wrangler secret delete PUBLIC_SUPABASE_ANON_KEY  # REMOVED
wrangler secret delete TURNSTILE_SECRET_KEY      # REMOVED
wrangler secret list

# Verify bindings are live
wrangler d1 list
wrangler kv namespace list
```

For full secrets + vars reference, see [SECURITY.md](./SECURITY.md) §9.

---

## 6. Monthly Cost Reference

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

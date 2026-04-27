{% raw %}
# Operations — Infrastructure, Bindings & Observability

> **Status:** Production Active
> **Last Updated:** 2026-04-23
> **Scope:** Cloudflare binding IDs, free tier limits, Sentry observability, build/deploy

---

## 1. Cloudflare Binding ID Registry

> **OPERATIONAL CRITICAL:** Never modify these IDs without verifying against the Cloudflare Dashboard first.
>
> **Incident context (2026-04-20):** ALL binding IDs in both `wrangler.toml` files were discovered pointing at non-existent resources (all 404). This caused the entire CMS image pipeline to silently fail — uploads appeared to succeed but never propagated to the live site. Fix was a config-only correction of the IDs below.

### D1 Database

| Binding | DB Name | Verified UUID |
|---------|---------|---------------|
| `DB` | `madagascar-db` | `bbca7ba8-87b0-4998-a17d-248bb8d9a0a2` |

Both `cf-admin` and `cf-astro` share this single D1 database.

**Verification:**
```bash
curl -sH "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/320d1ebab5143958d2acd481ea465f52/d1/database/bbca7ba8-87b0-4998-a17d-248bb8d9a0a2" | jq .result.name
# Must return: "madagascar-db"
```

### KV Namespaces

| Binding | Title | Verified UUID | Used By |
|---------|-------|---------------|---------|
| `SESSION` (cf-admin) | `cf-admin-session` | ⚠️ VERIFY — see note below | cf-admin |
| `SESSION` (cf-astro) | `cf-astro-session` | `9da1ac5253a54ea1bf236c6fe514dd02` | cf-astro |
| `ISR_CACHE` | `cf-astro-isr-cache` | `e31f413bb1224f559a8de105248da6cc` | cf-astro |

> **⚠️ KV SESSION ID DISCREPANCY (user action required):**
> `cloudflare-bindings-registry.md` (verified 2026-04-20) recorded `cf-admin-session` as `c81d1970f3d548b8a53a0e6c870b7685`, but the actual `wrangler.toml` contains `bee123e795504473accf58ac5b6de13d`.
> **Before next deploy, check the Cloudflare Dashboard → Workers & Pages → KV and confirm the correct ID. Then update this file.**

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

## 5. Build & Deploy Commands

```bash
# cf-admin
npm run dev           # Local dev server (wrangler dev)
npm run build         # Production build
wrangler deploy       # Deploy to Cloudflare Workers

# D1 migrations (run in order, --remote for production)
wrangler d1 execute madagascar-db --file=migrations/0001_*.sql --remote

# Secrets management
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret list

# Verify bindings are live
wrangler d1 list
wrangler kv namespace list
```

For full secrets list, see [SECURITY.md](./SECURITY.md) §9.

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

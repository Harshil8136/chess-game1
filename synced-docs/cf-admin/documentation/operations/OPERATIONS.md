---

title: "Operations — Infrastructure, Bindings & Observability"
status: active
audience: [ai, technical, operator]
last_verified: 2026-08-23
verified_against: [code, infra]
owner: harshil
tags: [operations, bindings, cloudflare]
---

# Operations — Infrastructure, Bindings & Observability

> **TL;DR (non-technical):** The operations runbook: the exact Cloudflare resource IDs, the free-tier limits that shape the design, the required secrets, and how to build and deploy.

> **Status:** Production Active
> **Scope:** Cloudflare binding IDs, free tier limits, Sentry observability, build/deploy
>
> **§1 is the single source of truth for production bindings** (`../RULESAd.md` §12).
> If it disagrees with any other document, §1 wins — and if it disagrees with
> `wrangler.toml`, `wrangler.toml` wins and §1 is the bug. Regenerate it with the
> commands in §1 → "Re-deriving this section" rather than editing from memory.

---

## Verification log

| Date | Method | Result |
|------|--------|--------|
| 2026-08-13 | `wrangler.toml` + `src/env.d.ts` re-read | §1 rebuilt — `SYNC_QUEUE`, the sync DLQ, `CHATBOT_SERVICE`, `ASTRO_SERVICE` and the `AI` binding were all missing from this registry despite being live; cron triggers and the custom-domain route added |
| 2026-08-13 | Cloudflare MCP `d1_database_query` on `sqlite_master` | `madagascar-db` holds **30** application tables |
| 2026-08-13 | Supabase MCP `list_tables` | project `[SUPABASE_PROJECT_REF]` `public` schema holds **20** tables, RLS enabled on all |
| 2026-06-06 | Cloudflare MCP `kv_namespaces_list` | `ADMIN_SESSION` `ba82…`, cf-astro `SESSION` `bee1…`, `ISR_CACHE` `d9ce…` — all match ✅ |
| 2026-06-06 | Cloudflare MCP `d1_databases_list` | `madagascar-db` `[D1_MADAGASCAR_DB_ID]` — match ✅ |
| 2026-06-06 | Supabase MCP `list_projects` | project `[SUPABASE_PROJECT_REF]` ACTIVE_HEALTHY — match ✅ |
| 2026-06-06 | Cloudflare MCP `r2_buckets_list` | not verified — analytics token lacks R2:List scope (R2 referenced by name, no UUID needed) |

---

## 1. Cloudflare Binding ID Registry

> **OPERATIONAL CRITICAL:** Never modify these IDs without verifying against the Cloudflare Dashboard first.
>
> **Incident context (2026-04-20):** ALL binding IDs in both `wrangler.toml` files were discovered pointing at non-existent resources (all 404). This caused the entire CMS image pipeline to silently fail — uploads appeared to succeed but never propagated to the live site. Fix was a config-only correction of the IDs below.

### D1 Database

| Binding | DB Name | Verified UUID |
|---------|---------|---------------|
| `DB` | `madagascar-db` | `[D1_MADAGASCAR_DB_ID]` |

Both `cf-admin` and `cf-astro` share this single D1 database.

**Verification:**

```bash
curl -sH "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/[CF_ACCOUNT_ID]/d1/database/[D1_MADAGASCAR_DB_ID]" | jq .result.name
# Must return: "madagascar-db"
```

### KV Namespaces

| Binding | Title | Verified UUID | Used By |
|---------|-------|---------------|---------|
| `SESSION` (cf-admin) | `ADMIN_SESSION` | `[KV_ADMIN_SESSION_ID]` | cf-admin |
| `SESSION` (cf-astro) | `SESSION` | `[KV_ASTRO_SESSION_ID]` | cf-astro |
| `ISR_CACHE` | `ISR_CACHE` | `[KV_ISR_CACHE_ID]` | cf-astro |

> **✅ VERIFIED (2026-04-28):** All IDs in the table above now match the LIVE Cloudflare environment. `ADMIN_SESSION` is used for isolation in `cf-admin`. `SESSION` is used for `cf-astro`.

### R2 Buckets

R2 buckets are referenced by **name** — stable, no UUID needed.

| Binding | Bucket Name | Used By |
|---------|-------------|---------|
| `IMAGES` | `madagascar-images` | cf-admin, cf-astro |
| `ARCO_DOCS` | `arco-documents` | cf-astro |
| `STAFF_STORAGE` | `madagascar-staff-storage` | cf-admin (created 2026-08-05) — **private, no CDN custom domain** (unlike `IMAGES`). Staff Managed Storage file drive; access only via Worker-issued presigned PUT (aws4fetch, `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` secrets scoped to this bucket only) and Worker-proxied GET. See [`features/STAFF-MANAGED-STORAGE.md`](../features/STAFF-MANAGED-STORAGE.md). |

### Queues

| Binding | Queue Name | Role | Used By |
|---------|------------|------|---------|
| `EMAIL_QUEUE` | `madagascar-emails` | producer | cf-admin, cf-astro |
| `SYNC_QUEUE` | `madagascar-sync-revalidate` | producer **and** consumer | cf-admin |
| — | `madagascar-sync-revalidate-dlq` | consumer (dead-letter) | cf-admin |

`EMAIL_QUEUE` is the producer side of the async email pipeline; the Email Portal
(`/dashboard/emails`) enqueues custom sends onto it and the external
`cf-astro-email-consumer` worker drains it. See
[`../features/EMAIL-PORTAL.md`](../features/EMAIL-PORTAL.md).

`SYNC_QUEUE` carries ISR revalidation redrive jobs. This Worker is both its
producer and its consumer (`max_batch_size = 10`, `max_retries = 4`), with
failures spilling into `madagascar-sync-revalidate-dlq`, which this Worker also
consumes (`max_retries = 1`). Provisioned 2026-06-10 — see
[`../reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md).

> Both queues must exist **before** the first deploy: `wrangler deploy`
> hard-fails on a consumer that references a non-existent queue. If this Worker
> is ever recreated from scratch, run `wrangler queues create` for
> `madagascar-sync-revalidate` and its `-dlq` first.

### Service Bindings

| Binding | Target Worker | Purpose |
|---------|---------------|---------|
| `CHATBOT_SERVICE` | `cf-chatbot` | Worker-to-Worker calls to the chatbot admin surface, without a public round trip |
| `ASTRO_SERVICE` | `cf-astro` | Worker-to-Worker calls to the public site (ISR revalidation, edge sync probes) |

### Workers AI

| Binding | Config | Used By |
|---------|--------|---------|
| `AI` | `remote = true` | cf-admin — blog generation and RAG context retrieval |

### Analytics Engine

| Binding | Dataset | Used By |
|---------|---------|---------|
| `ANALYTICS` | `madagascar_analytics` | cf-admin, cf-astro |

### Scheduled triggers

Three cron expressions on this Worker (`[triggers]` in `wrangler.toml`), fired
through the custom entrypoint `src/workers/cf-entry.ts`:

| Cron | Purpose |
|------|---------|
| `*/5 * * * *` | CF Access audit-log polling (captures failed login attempts) |
| `0 2 * * SUN` | Orphaned R2 asset cleanup |
| `*/15 * * * *` | Promote matured `scheduled` blog posts to `published` |

> This is the 3rd of 3 cron triggers allowed on the Workers Free plan — there is
> **no headroom left** for another cron on this Worker without upgrading.

### Re-deriving this section

This registry is the single source of truth named by `../RULESAd.md` §12, so it
must be regenerated from config rather than edited from memory:

```bash
# Bindings, queues, services, crons, routes — the authoritative declaration
grep -nE '^\[|binding|queue|service|pattern|crons' wrangler.toml

# The typed view the code actually sees (bindings + secrets)
grep -oE '^\s+[A-Z][A-Z0-9_]+' src/env.d.ts | sort -u

# What is really set in production
wrangler secret list
```

---

## 2. Pre-Flight Deploy Checklist

1. **Diff binding IDs** — verify `wrangler.toml` UUIDs match the table above
2. **Never `wrangler d1 create`** a new database with the same name — creates a new UUID, leaving `wrangler.toml` pointing at the old one
3. **Never `wrangler kv namespace create`** without updating BOTH projects' `wrangler.toml`
4. **If IDs look wrong** — verify via Cloudflare Dashboard → Workers → KV/D1 → copy UUID from there
5. **Verify required secrets** are set via `wrangler secret list`

---

## 3. Free Tier Limits

Every service below is on its free tier, so direct spend is ~$0.50/month (§8 —
which is *not* the cost-to-serve figure; read the note there). These quotas
dictate caching strategies and system design constraints.

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

`AdminLayout.astro` injects a global `window.onerror` + `window.[SUPABASE_PROJECT_REF]` safety net. Unhandled client-side exceptions report to Sentry and trigger a recovery UI rather than a silent blank page crash loop.

### 4.3 ErrorBoundary

High-risk Preact components (data widgets, charts, API-bound tables) are wrapped in a generic `ErrorBoundary`. On rendering exception: silently reports to Sentry + renders a "Widget Failure" fallback instead of taking down the entire dashboard.

---

## 5. Required Secrets Reference (CF Zero Trust v4.0)

All secrets set via `wrangler secret put <KEY>`. Vars set in `wrangler.toml [vars]`.

> **RULE #0.8 — env var cap, hard stop.** cf-admin is verified at **40 env vars**
> (17 `[vars]` + 23 secrets, live-counted 2026-08-12 against `wrangler.toml` — see
> `../2026-08-06-data-infrastructure-audit-and-reuse-policy.md` §0). We are not
> adding more as a default move. New feature config belongs in
> `admin_portal_settings` (`PortalSettingsRepository.ts`) or KV — a new env var is
> the last option, not the first. Note: the tables below (§5.1/§5.2) predate several
> entries that already exist in `wrangler.toml` (Control Plane connector secrets,
> `PUBLIC_ASTRO_URL`/`PUBLIC_CDN_URL`/`PUBLIC_SENTRY_DSN`, session timing vars,
> `API_DENY_MODE`) — treat `wrangler.toml`'s own comment block as authoritative
> for the full current list until this section is reconciled.

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
| `RESEND_API_KEY` | ✅ Active (2026-04-30) | Resend API key — login security-alert emails, Email Portal scheduled-send cancellation, and DEV-only local send emulation (production custom sends are dispatched by the queue consumer). See [`../features/EMAIL-PORTAL.md`](../features/EMAIL-PORTAL.md) |
| `SECURITY_ALERT_EMAIL` | ✅ Optional | Override recipient for login security alert emails (defaults to `mascotasmadagascar@gmail.com` if not set) |
| `SENTRY_AUTH_TOKEN` | ✅ Active | Sentry error feed (build-time source maps upload) |
| `SENTRY_ORG_SLUG` | ✅ Active | Sentry organization slug (build-time config) |
| `SENTRY_PROJECT_SLUG` | ✅ Active | Sentry project slug (build-time config) |
| `IP_HASH_SECRET` | ✅ Active | Privacy-safe IP hashing in login forensics |
| `CHATBOT_WORKER_URL` | ✅ Active | cf-chatbot Worker endpoint |
| `CHATBOT_ADMIN_API_KEY` | ✅ Active | 64-char key securing cf-chatbot access |
| `R2_ACCESS_KEY_ID` | ✅ Active (confirmed via live audit-log evidence 2026-08-12 — was mismarked 🟡 pending here; uploads have succeeded since 2026-08-06) | R2 S3-compatible credential, scoped ONLY to `madagascar-staff-storage`. Used by `aws4fetch` to sign presigned upload PUT URLs for the Staff Managed Storage feature. Structurally different from `CLOUDFLARE_API_TOKEN` (Bearer format) — S3 SigV4 signing requires this credential shape, no substitute. Create via Cloudflare dashboard → R2 → Manage API Tokens, scoped to this bucket only. |
| `R2_SECRET_ACCESS_KEY` | ✅ Active (confirmed via live audit-log evidence 2026-08-12 — see note above) | Paired secret for `R2_ACCESS_KEY_ID` above. |
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
| `STAFF_STORAGE_BUCKET_NAME` | ✅ Active | R2 bucket name (`madagascar-staff-storage`) for the Staff Managed Storage presign flow — see [`../features/STAFF-MANAGED-STORAGE.md`](../features/STAFF-MANAGED-STORAGE.md) |
| `CF_QUEUE_NAME` | ✅ Active | Queue name for queue stats analytics |
| `CF_TEAM_NAME` | ✅ Active (`mascotas`) | Zero Trust team name — constructs JWKS URL + CF logout URL |
| `CF_ACCESS_AUD` | ✅ Active | CF Access Application Audience tag — RS256 JWT audience verification |
| `LOCAL_DEV_ADMIN_EMAIL` | ✅ Active | Dev bypass email for localhost (no CF Access headers in `npm run dev`) |
| `PUBLIC_TURNSTILE_SITE_KEY` | ❌ **REMOVED** | No login form — remove from wrangler.toml vars |

## 6. Cloudflare API Token Registry

> **Last updated:** 2026-04-30. All tokens created under `[CF_ACCOUNT_EMAIL]'s Account` (ID: `[CF_ACCOUNT_ID]`).
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

**Email fan-out (2026-05-26 hardening):** For every batch returned by the audit poll, only the first **5 failed-login entries** trigger a Resend `sendSecurityAlertEmail` call; the 5th email appends a digest line noting how many additional failures were suppressed (with a pointer to D1 `admin_login_logs` for the complete set). All failures still write to D1 via `logLoginAttempt` regardless of email-cap state. This prevents a misconfigured IdP or password-spraying bot from amplifying one batch into 100+ alert emails and burning the Resend free-tier quota.

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

> **Note:** This token has broad Zero Trust permissions. It is scoped to the `[CF_ACCOUNT_EMAIL]` account only (not zone-level). The critical permission for Layer 3 force-kick is `Access: Organizations Revoke` — this allows deleting active CF Access sessions via API.

---

## 7. Build & Deploy Commands

```bash
# cf-admin
npm run dev           # Local dev server (wrangler dev)
npm run build         # Production build
wrangler deploy       # Deploy to Cloudflare Workers

# D1 migrations — apply individually with `d1 execute`, NOT `d1 migrations apply`.
# The `d1_migrations` bookkeeping table in this database tracks cf-astro's
# migration history, so `wrangler d1 migrations apply` would misjudge what has
# already run here. See MAINTENANCE.md and features/EMAIL-PORTAL.md.
#
# State as of 2026-08-13: migrations/ holds 28 files spanning 0000–0050 (the
# numbering is sparse — 45 older files were moved to database/legacy_migrations/
# and are already applied). The highest applied is 0050.
wrangler d1 execute madagascar-db --file=migrations/0051_<name>.sql --remote

# List what is actually in the directory before assuming a number is free:
ls migrations/

# Secrets management
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put CF_API_TOKEN_READ_LOGS    # see §6 for token permissions
wrangler secret put CF_API_TOKEN_ZT_WRITE     # see §6 for token permissions
wrangler secret list

# Verify bindings are live
wrangler d1 list
wrangler kv namespace list
```

### ⚠️ Migration numbering has two colliding series

`migrations/` (0000–0050, 28 `.sql` files — `0002` appears twice and 0009–0032
are unused) and `database/legacy_migrations/` (0001–0043, 44 `.sql` files plus a
README — `0021` appears twice) are **independent numbering series that overlap on 19
numbers** — 0001–0008 and 0033–0043. `migrations/0033_create_blog_and_taxonomy_tables.sql`
and `database/legacy_migrations/0033_create_sync_outbox.sql` are entirely
different migrations that share a prefix.

Consequences to keep in mind:

- **A bare number is ambiguous.** Never write "migration 0033" in a doc, commit
  message or conversation — always give the directory and full filename.
- `migrations/` also contains a **live duplicate**: two files both prefixed
  `0002` (`0002_create_cf_access_sync_log.sql` and `0002_promote_sessions_page.sql`).
- Both series are already applied to `madagascar-db`; `legacy_migrations/` is
  history, not a queue.

For full secrets + vars reference, see [SECURITY.md](../security/SECURITY.md) §9.

---

## 8. Monthly Cost Reference

**Direct infrastructure spend for this single deployment** — every service below
sits inside its free tier today:

| Service | Cost |
|---------|------|
| Cloudflare Workers | $0 (free tier) |
| D1, KV, R2, Queues, Workers AI | $0 (free tier) |
| Supabase | $0 (free tier) |
| Upstash | $0 (free tier) |
| Brevo / Resend (email) | $0 (free tier) |
| Anthropic (Claude Haiku fallback) | ~$0.01–0.50/month |
| **Total, direct spend** | **~$0.50/month** |

> **This is not the cost-to-serve, and the two must not be quoted
> interchangeably.** The fully-loaded figure — which adds the paid tiers a real
> client deployment needs, plus operational time — is **~$30–36/client/month**,
> derived with its assumptions in
> [`../2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md).
> That document is the owner of the cost model; quote it, not this table, in any
> commercial context. The "$0.00/month" figure that appeared in `RULESAd.md` §15
> was this table's direct-spend number rounded down, and it was being read as a
> cost-to-serve claim.

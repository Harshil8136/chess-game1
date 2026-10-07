{% raw %}
# System Architecture & Technical Operations Manual

This document provides a comprehensive, production-grade technical reference for the **cf-astro** application (Hotel para Mascotas Madagascar). It covers high-level business context, system architecture, database design, API routing, edge feature flags, asynchronous email pipelines, deployment configurations, and runtime resource limits.

---

## 1. Business Context & Migration Rationale

**Hotel para Mascotas Madagascar** is a luxury pet hotel and boarding business located in Aguascalientes, Mexico. The application (`madagascarhotelags.com`) serves both as a public marketing presence and a fully bilingual (ES/EN) customer booking platform.

Originally constructed with Next.js on Vercel, the application was systematically migrated to **Astro 7** deployed on **Cloudflare Workers** (`wrangler deploy` — migrated off Cloudflare Pages in July 2026, see `Documentation/SEO-OPERATIONS.md` §3) to achieve three fundamental business goals:

- **Zero-Cost Edge Infrastructure**: Fully utilizes Cloudflare's free tiers for static CDNs, serverless Workers, D1 SQL databases, R2 media storage, and KV namespaces.
- **Flawless SXO (Search Experience Optimization)**: Achieves instantaneous loads and a 100/100 Core Web Vitals score by defaulting to zero client-side JavaScript for marketing pages, utilizing Astro's component framework to prerender optimized HTML at build time.
- **Ultra-Fast Global Execution**: Serving all static content from Cloudflare's CDN and dynamic API endpoints from low-latency edge Workers located physically close to users in Mexico.

---

## 2. High-Level Architecture & Technical Stack

The entire application runs distributed at the network edge on the Cloudflare Edge network:

```mermaid
graph TD
    User([User Browser]) -->|HTTPS request| CF_Edge[Cloudflare Edge Network]

    subgraph Cloudflare Workers Compute
        CF_Edge -->|Prerendered HTML / CSS| Static_CDN[Static Pages CDN]
        CF_Edge -->|SSR / API Routes| Edge_Worker[Serverless Worker Entrypoint]
    end

    subgraph Cloudflare Serverless Bindings
        Edge_Worker -->|SQLite queries| D1_DB[(D1 Database)]
        Edge_Worker -->|Media / Docs| R2_Bucket[(R2 Object Storage)]
        Edge_Worker -->|JSON / Cache / Flags| KV_Cache[(KV Namespace Cache)]
        Edge_Worker -->|Async Payload| Email_Queue[Cloudflare Email Queue]
    end

    subgraph External Infrastructure
        Edge_Worker -->|Secure transaction| Supabase_Postgres[(Supabase PostgreSQL)]
        Edge_Worker -->|Analytics proxy| PostHog[PostHog Analytics]
        Edge_Worker -->|Error tracking| Sentry[Sentry Observability]
        Email_Queue -->|Async Worker Consumer| Sidecar_Worker[cf-astro-email-consumer Worker]
        Sidecar_Worker -->|Primary, all projects| Brevo[Brevo Email API]
        Sidecar_Worker -->|Failover if Brevo throws| Resend[Resend Email API]
    end
```

### Technical Stack Mapping

- **Framework**: Astro 7.1+ configured with the official `@astrojs/cloudflare` adapter.
- **Rendering Strategy**: Static-first Hybrid model (`output: 'static'`). Pages are precompiled to pure HTML unless explicitly marked with `export const prerender = false` (which triggers edge SSR).
- **Styling**: Tailwind CSS v4 utilizing the high-performance `@tailwindcss/vite` compiler plugin for lightning-fast builds.
- **Hydration Core**: Preact 10+ islands (`@astrojs/preact` configured with Vite `compat: true` for React ecosystem interoperability).
- **Validation Engine**: Zod ^3.25.0 for strict, typed, runtime parsing of client inputs and config variables.

---

## 3. Configuration Profiles & Edge Bindings

The application maps runtime environments, variables, and resources via three primary configuration artifacts:

### 3.1 `astro.config.ts`

Establishes the core compilation rules, [SUPABASE_PROJECT_REF] routing, and build plugins:

- **`trailingSlash: 'always'`**: Enforces trailing slashes on all routes to prevent duplicate indexation and split canonical authority in search engines.
- **`i18n`**: Configured with `defaultLocale: 'es'` (Spanish) and `locales: ['es', 'en']` (English) with `prefixDefaultLocale: true` (ensuring URLs always start with explicit locale slugs, e.g., `/es/` or `/en/`).
- **`passthroughImageService()`**: Disables Astro's CPU-heavy local image optimization. Optimization is handled dynamically at the edge by Cloudflare Images/R2 custom domains.
- **`__BUILD_ID__` & `__LAST_UPDATED__`**: Injected at compile time to scope ISR cache layers and provide precise sitemap modified metadata.

### 3.2 `wrangler.toml`

Defines the Cloudflare Workers environment, build directory (`./dist`), compatibility flags (`compatibility_flags = ["nodejs_compat"]`), and system bindings:

- **`DB` (D1 Database)**: Binds the local SQLite engine for fast content delivery and dead-letter queue audits.
- **`ISR_CACHE` (KV Namespace)**: Caches HTML page structures and CMS content blocks. _(Note: standard static assets like images and fonts bypass KV entirely and are cached natively by Cloudflare's CDN using `public, max-age=31536000, immutable`)._ Its key families (2026-10-04):

  | Prefix                             | Written by                                          | Expiry | Notes                                                                                                                                       |
  | ---------------------------------- | --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
  | `isr:<path>#<build>`               | `src/middleware.ts` (`isr-cache-key.ts`)            | 24 h   | Only a 200 HTML page is stored. `?page=<n>` is part of the key on `/es/blog` and `/en/blog` only; everywhere else query params are ignored. |
  | `cms:<key>`                        | `/api/revalidate` (cf-admin publish)                | 24 h   | Allowlisted and sanitized (`SECURITY.md` §8). Was 1 h until 2026-10-04.                                                                     |
  | `feed:<path>#<build>`              | `src/lib/feed-cache.ts`                             | 6 h    | The three sitemaps and two RSS feeds. A degraded (fallback) render is never stored. Cleared by every path revalidation.                     |
  | `rl:<endpoint>:<ip>`, `burst:<ip>` | `src/lib/rate-limit.ts`                             | 60 s   | Fallback counters only, used when a rate-limit binding is missing or throws.                                                                |
  | `ping`, `analytics:weekly_digest`  | read only (`/api/health`, `/api/analytics/summary`) | n/a    | cf-astro never writes these.                                                                                                                |

- **`RL_PER_MIN_<n>` (Workers Rate Limiting bindings, since 2026-10-04)**: ten bindings, one per step of the ladder 3, 5, 10, 20, 30, 60, 100, 200, 500, 1000 requests a minute. A rate limit uses the smallest binding at or above it; the KV counters above are the fallback, and the request is allowed when both fail (`SECURITY.md` §4, AGENTS.md invariant #3). They replaced Upstash Redis and need no secret.
- **`[observability]`**: Workers Logs persisted at a 20% head-sampling rate and traces persisted at 5%, since 2026-10-04 (both were 100%). A sampled-out request keeps no console line in Cloudflare; errors a route captures still reach Sentry in full and `log.warn`/`log.error` still reach BetterStack. The server-side Sentry tracer samples 10% of page and API requests and none for probe paths (`/.env`, `/wp-…`), bots (by user agent) or 404s (`src/lib/server-trace-sampling.ts`).
- **`SESSION` (KV Namespace)**: Stores transient session ids and validation state.
- **`EMAIL_QUEUE` (Queue)**: Handles async email payloads to protect the user from booking timeouts.

---

## 4. Edge API Routes & Data Pipelines

### 4.1 System API Reference

| Endpoint                | Method | Prerender | Security                                                        | Purpose                                                                                                  |
| ----------------------- | ------ | --------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/api/booking`          | `POST` | `false`   | CSRF + Rate Limit binding (fail-open) + D1 dead-letter audit    | Processes atomic booking transaction across D1 and Supabase.                                             |
| `/api/booking/replay`   | `POST` | `false`   | Bearer Token (`verifyBearerAuth` constant-time candidate array) | Drains booking outbox records from D1 into Supabase. Poked by `cf-admin` 5-min cron via `ASTRO_SERVICE`. |
| `/api/consent`          | `POST` | `false`   | Zod + Rate Limit                                                | Hashes and logs GDPR/LFPDPPP privacy agreements.                                                         |
| `/api/consent/replay`   | `POST` | `false`   | Bearer Token (`verifyBearerAuth` constant-time candidate array) | Drains consent outbox records from D1 into Supabase.                                                     |
| `/api/health`           | `GET`  | `false`   | Bearer Token (`verifyBearerAuth` constant-time candidate array) | Health check diagnostics verifying D1, KV, and external dependencies.                                    |
| `/api/revalidate`       | `POST` | `false`   | Bearer Token (Constant-Time comparison)                         | Purges KV Cache and updates CMS data blocks.                                                             |
| `/api/ingest/[...path]` | `ALL`  | `false`   | Transparent Proxy                                               | Obfuscates PostHog analytical calls to prevent ad-blocker drops.                                         |
| `/api/arco/submit`      | `POST` | `false`   | CSRF + Turnstile + Rate Limit                                   | Handles Mexican LFPDPPP ARCO identity-document + rights requests.                                        |

### 4.2 The Atomic Booking Transaction

The booking submission flow is designed with extreme resilience to avoid losing customer data under high-load conditions or database outages:

```
[BookingWizard (Preact Island)]
               │
               ▼  (POST JSON Payload)
   [/api/booking (Worker SSR)]
               │
               ├─► [1. CSRF Validate] (Fails closed)
               │
               ├─► [2. Write Attempt to D1 `booking_attempts`] (Dead-Letter Logger)
               │
               ├─► [3. Execute Supabase PG Transaction]
               │         ├─► Insert into `bookings` (Generates PK)
               │         ├─► Insert into `consent_records` (Foreign Key linked)
               │         ├─► Insert into `booking_pets` (Multi-relations mapped)
               │         └─► Log email audit queue record
               │
               ├─► [4. Push JSON paylods to `env.EMAIL_QUEUE`]
               │
               ▼  (Return 200 OK + bookingRef)
        [Confirmation UI]
```

### 4.3 3-Tier CMS Content Fallback Strategy

Marketing page texts, service pricing tables, and blog posts are loaded via a robust 3-tier fallback matrix inside Astro component frontmatter to guarantee that the site renders even if the database is completely offline:

1. **`ISR_CACHE` KV (`cms:<key>`)**: The primary high-speed layer. Injected directly by the CMS revalidation webhook, with a 24-hour expiry since 2026-10-04 (1 hour before). `getPricing`, `getTestimonials` and `getAboutStats` are also memoised **per request** (`src/lib/request-memo.ts`, wired by the middleware), so a page that shows the same block in three components reads KV, and on a miss D1, once.
2. **D1 SQL Database (`cms_content`)**: The local edge database. Queried via `getJsonBlock(db, group, key)` if KV returns null.
3. **Static Locale files (`es.json` / `en.json`)**: Code-level fallbacks. Hardcoded dictionary texts that ensure standard structures render instantly if all databases are unreachable.

---

## 5. Edge Feature Routing & Configuration

> **Corrected 2026-09-10 — this section described a system that does not exist.**
> It previously specified a three-step pipeline: `admin_feature_flags` read from
> D1, cached in KV under `features:global` with a 60-second TTL, and hydrated
> into `Astro.locals.features`. None of it is in `src/`. There is no
> `admin_feature_flags` read, no `features:global` key, and no `locals.features`
> anywhere in this repo — verified by grep on 2026-09-10. The D1 table exists
> (2 rows) but this repo has never read it.
>
> **It was also a latent cost bug.** A 60-second KV TTL means a KV _write_ every
> 60 seconds to refresh the entry — 1,440 writes/day against a Cloudflare free
> tier limit of **1,000 KV writes/day**. Had it been built as written, it would
> have exhausted the daily KV write budget on its own. If edge feature flags are
> ever wanted here, the TTL has to be minutes, not seconds, and the design needs
> to be costed against that 1,000/day ceiling first.

What actually exists at the edge today:

1. **Service configuration**, read from D1 `service_config` by
   [`src/lib/service-config.ts`](../src/lib/service-config.ts) — currently a full
   table scan on every call (~279 calls/day, ~6,420 rows read/day as of
   2026-09-10). Moving it behind KV is Stage 4 of
   `cf-admin/documentation/specs/2026-09-10-d1-and-worker-resource-optimization-design.md`.
2. **ISR HTML caching**, in `src/middleware.ts`, keyed by `__BUILD_ID__` with a
   24-hour TTL — one KV write per unique path per deploy.
3. **CMS content blocks**, injected into `ISR_CACHE` under `cms:<key>` by
   `src/pages/api/revalidate.ts` with a 24-hour TTL (1 hour until 2026-10-04).
4. **Sitemaps and RSS feeds**, cached in `ISR_CACHE` under `feed:<path>#<build>`
   for 6 hours (`src/lib/feed-cache.ts`, since 2026-10-04). They select only the
   columns they print, not whole post bodies.
5. **The browser's runtime config** (`/api/runtime-config/`, PostHog and Sentry
   settings): one shared request per page, kept in `sessionStorage`
   (`mada_runtime_config`) for 10 minutes and only when the answer was good
   (`src/scripts/runtime-config-client.ts`, since 2026-10-04).

---

## 6. Email Infrastructure & Async Queue Pipeline

To prevent slow third-party API networks from causing booking timeouts, the email infrastructure is fully decoupled:

### 6.1 Queue Producer (`cf-astro`)

The booking API route constructs two email payloads (one for customer confirmation, one for admin alerts) and pushes them to `env.EMAIL_QUEUE`. The booking route returns `200 OK` instantly, bypassing synchronous wait states.

### 6.2 Queue Consumer (`cf-astro-email-consumer`)

An isolated, lightweight worker sidecar consumes the queue on behalf of **both** cf-astro and cf-admin (one shared worker, one shared queue — `madagascar-emails`):

- **Absolute Code Isolation**: The consumer worker is completely decoupled from `cf-astro`. It must never import Drizzle ORM schemas or Astro layouts to prevent cyclic compilation failures.
- **Email Assembly**: Uses the high-performance **Eta** template engine to format elegant HTML layouts.
- **Hybrid-SMTP Provider, not project-routed**: The consumer calls **Brevo's API first for every send**, regardless of `projectSource` (cf-astro or cf-admin). **Resend is wired in only as an automatic same-request failover** if the Brevo call throws — there is no per-project routing split; `RESEND_API_KEY` lives in this worker's own secrets.

### 6.3 Delivery Webhooks & Observability

- **Webhook Endpoint**: `POST /api/webhooks/brevo` (cf-astro) captures delivery, bounces, and complaints from the primary provider. This lives in cf-astro itself, not the consumer worker — `cf-astro-email-consumer` is queue-only (no `fetch()` handler), so it cannot receive inbound HTTP webhooks at all.
- **Security**: Brevo does not sign webhook payloads by default, so this is **not** signature/HMAC verification — it's a constant-time shared-secret comparison (`timingSafeEq`, `src/lib/security.ts`) against `BREVO_WEBHOOK_SECRET` (a cf-astro secret), checked from either the `Authorization` header or a `?secret=`/`?token=` query param. Never log the raw query string unredacted.
- **Audit Log**: Verified webhook events are pushed into the `email_audit_logs` Supabase table inside a JSONB `delivery_events` array for auditing.

---

## 7. Operations, Provisioning & Local Development

### 7.1 Local Development Commands

```bash
# 1. Install precise dependencies
npm install

# 2. Run local Astro dev server with HMR
npm run dev

# 3. Clean Vite caches and start dev server
npm run dev:clean

# 4. Preview build locally with full Cloudflare proxy bindings (D1, KV, R2)
npm run cf:dev

# 5. Compile production build
npm run build

# 6. Apply database migrations to local D1 instance
npm run db:migrate

# 7. Apply database migrations to production D1 instance
npm run db:migrate:remote
```

### 7.2 Manual Provisioning Guide

If deploying the infrastructure from scratch on a new Cloudflare account, execute these steps in order:

```bash
# 1. Create the D1 Database
npx wrangler d1 create madagascar-db

# 2. Apply initial schemas to production D1
npx wrangler d1 migrations apply madagascar-db --remote

# 3. Create the KV cache namespaces
npx wrangler kv:namespace create ISR_CACHE
npx wrangler kv:namespace create SESSION

# 4. Bind Secrets to the Worker
npx wrangler secret put DATABASE_URL        # Supabase postgres:// URL
# Note: BREVO_API_KEY (primary) and RESEND_API_KEY (failover) are secrets on
# the shared cf-astro-email-consumer worker, not on cf-astro itself.
npx wrangler secret put BREVO_WEBHOOK_SECRET # Verifies inbound Brevo delivery-status
                                              # webhook (/api/webhooks/brevo) — this
                                              # ONE Brevo secret lives on cf-astro
                                              # itself, unlike BREVO_API_KEY above.
                                              # Must match the token/header value
                                              # configured in the Brevo dashboard's
                                              # webhook settings exactly.
npx wrangler secret put REVALIDATION_SECRET  # Webhook bearer key
npx wrangler secret put SENTRY_AUTH_TOKEN    # Sentry source map uploader token
```

---

## 8. Domain Routing & DNS Setup

Cross-domain redirection (forcing `www.madagascarhotelags.com` and
`pet.madagascarhotelags.com` to the apex `madagascarhotelags.com`) **cannot**
be handled via the static `public/_redirects` file — Workers `_redirects`
only supports relative URLs (see the comment block at the top of that file).
Two layers exist:

1. **Primary, code-level (`src/middleware.ts`, lines 20-46):** on every
   on-demand request, a `LEGACY_HOSTS` check (`www.*`, `pet.*`) plus an
   `isHttp` check issue a single-hop 301 straight to
   `https://madagascarhotelags.com`, normalizing root path and trailing
   slash in the same response. This is the code's own defense — it does not
   depend on any Cloudflare dashboard configuration.
2. **Secondary, dashboard-level (defense-in-depth):** zone-level **Redirect
   Rules** (Domain Zone → **Rules** → **Redirect Rules**) for the same three
   hosts (`www.*`, `pet.*`, `cf-astro.pages.dev`) → apex, 301, preserving the
   query string. See `Documentation/SEO-OPERATIONS.md` §1.6.

> **Known issue, live as of 2026-08-10 — not yet resolved despite the code
> above being correct:** production traffic on `www.*` and `pet.*` is
> observed 301-redirecting to _itself_ (an infinite loop), which the current
> `middleware.ts` logic cannot produce if it is actually executing for those
> requests. This points to a Cloudflare **account-configuration** issue —
> most likely `www`/`pet` are still bound as Custom Domains on a stale,
> no-longer-deployed Cloudflare Pages project from before the July 2026
> migration to a plain Worker, rather than on the current `cf-astro` Worker
> alongside the apex domain. See the fix plan for the full live diagnosis
> and dashboard remediation steps; this note should be removed once the
> live curl checks there come back clean.

---

## 9. Operations, Free Tier Limits & Resource Budgets

The system operates strictly inside Cloudflare's free tier quotas, ensuring monthly operational cost is exactly **$0 USD**. The **Source** column says where each figure comes from; "estimate" means worked out from the code, not read from a dashboard.

| Resource                               | Current Usage                                                                                          | Free Tier Limit                                                                              | Source                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Workers Builds**                     | ~30 / month                                                                                            | 3,000 build minutes / month, 1 concurrent (Free — `workers/ci-cd/builds/limits-and-pricing`) | earlier estimate                                                                              |
| **Worker Requests**                    | ~1,200 / day                                                                                           | 100,000 / day                                                                                | earlier estimate, never measured: the Cloudflare connector has no per-Worker analytics        |
| **D1 Rows Read**                       | ~70,000 / day, **account-wide** (all Workers and databases)                                            | 5,000,000 / day                                                                              | measured 2026-10-04 from cf-admin's D1 usage probe (Cloudflare D1 analytics)                  |
| **D1 Rows Written**                    | ~650 / day, account-wide                                                                               | 100,000 / day                                                                                | measured 2026-10-04, same probe                                                               |
| **KV writes (`ISR_CACHE`)**            | about one per page per deploy, ~20 / day for feeds, one per CMS block per publish                      | 1,000 / day (shared by every writer of the namespace)                                        | estimate. Rate-limit counters write KV only when a binding fails                              |
| **KV reads (`ISR_CACHE`)**             | one per on-demand page render, plus `cms:` blocks on a page-cache miss                                 | 100,000 / day                                                                                | estimate                                                                                      |
| **KV Storage Capacity**                | ~2 MB                                                                                                  | 1 GB                                                                                         | earlier estimate                                                                              |
| **Workers Logs events**                | 20% of invocations since 2026-10-04 (was 100%)                                                         | 200,000 / day                                                                                | `wrangler.toml` `[observability]`; event counts not measurable here                           |
| **Rate Limiting binding**              | one call per contact post or limited API call; two per booking or consent post (burst guard + limit)   | included in Workers; Free-plan allowance not re-verified on 2026-10-04                       | the code: `src/lib/rate-limit.ts`, `booking.ts`, `consent.ts`                                 |
| **Sentry spans**                       | 10% of human page and API requests; none for probes, bots or 404s since 2026-10-04                     | 10M / month (Free)                                                                           | `src/lib/server-trace-sampling.ts`                                                            |
| **GitHub Actions (consent heartbeat)** | at most 24 runs / day, each billed as one job (≥ 1 minute) since 2026-10-04; it was two jobs (≥ 2 min) | 2,000 minutes / month, shared by every private repository                                    | the workflow; GitHub ran it 579 times by 2026-10-04, about every 3–4 hours rather than hourly |
| **R2 Storage Capacity**                | ~450 MB                                                                                                | 10 GB                                                                                        | earlier estimate                                                                              |

### 9.1 What one request costs (2026-10-04)

- **A prerendered page, an image or a font** is served from static assets and never wakes the Worker.
- **An on-demand page** is one Worker invocation and one KV read on a cache hit. On a miss it renders, reads each `cms:` block once (the per-request memo, §4.3) and, if the page is a 200, writes one KV entry for 24 hours.
- **An unknown blog tag, an invalid `?page=` or a page past the last one** is rewritten to `/404/` (with the slash, or the middleware would answer a 308) and answers a 404 that is not cached, so a random value costs no KV write. While D1 is failing, a page past 1 is a 503, also not cached. `?page=` only counts on `/es/blog/` and `/en/blog/`.
- **A sitemap or RSS feed** is served from `feed:` KV for 6 hours; a miss queries D1 for the listed columns only.
- **The browser's `/api/runtime-config/` call** happens at most once per page and, after a good answer, not again for 10 minutes in that tab.
- **A form post** costs one rate-limit binding call for contact, two for a booking or a consent post (the burst guard on `RL_PER_MIN_30`, then the endpoint's limit), with no outbound HTTPS call and no KV write. The plan put form posts at about 50 a day on Upstash.

The change record for this work is [`records/2026-10-04-resource-usage.md`](./records/2026-10-04-resource-usage.md).

---

## 10. AI & Human Extension Guide (Invariants)

To ensure this codebase remains perfectly editable, maintainable, and robust for both human teams and future AI coding models, strictly follow these structural guidelines:

> [!WARNING]
> **System Architectural Invariants**
>
> 1. **Do Not Introduce Local Image Processors**: Never replace `passthroughImageService()` with `@astrojs/image` or standard Sharp compilation. Doing so will break static SSR execution limits on Cloudflare Workers (1MB container limit).
> 2. **Never Import Database Schemas in Email Consumer**: The `cf-astro-email-consumer` worker must remain 100% decoupled from `cf-astro/src/db` and Drizzle schemas. Any imports between them will break build cycles and cause module resolution crashes during bundle packaging.
> 3. **Preserve `trailingSlash: 'always'`**: All page-level generation logic, routing hooks, and canonical calculations rely on trailing slashes. Changing this parameter will immediately throw 404/301 loops in production.

{% endraw %}

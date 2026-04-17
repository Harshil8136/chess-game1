# CF-ASTRO PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Last Updated:** 2026-04-13
> **Research Sources:** Cloudflare Docs MCP, Perplexity MCP, Cloudflare Bindings MCP, Official Documentation

---

## 🏢 PROJECT MISSION — COMMERCIAL-GRADE, $0 INFRASTRUCTURE

**cf-astro is a production-ready, commercial-grade pet hotel website built entirely on FREE tier services.** This is not a demo, prototype, or hobby project — it is a real business application designed to:

- ✅ Handle real customer bookings with email confirmations
- ✅ Process GDPR/ARCO privacy requests with legal compliance
- ✅ Serve optimized images globally via CDN with zero egress cost
- ✅ Provide admin data management with auth-gated access
- ✅ Run 24/7 at **$0/month** total infrastructure cost
- ✅ Scale to **hundreds of daily visitors** without hitting any free tier ceiling
- ✅ Deliver Lighthouse 95+ performance on mobile
- ✅ Meet professional SEO, accessibility, and security standards

**Every architectural decision in this project optimizes for one goal: maximum professional quality at exactly ZERO ongoing cost.** We achieve this by strategically combining Cloudflare's generous free tier (Workers, D1, R2, KV, Pages, Turnstile) with Resend, Supabase, Upstash, PostHog, and Sentry free tiers.

---

## 🚨 RULE #0 — THE ABSOLUTE LAW (NEVER VIOLATE)

**cf-astro is the Cloudflare-native version of nextjs-app. We can deeply review, understand how everything looks, works, and is designed in nextjs-app — however, WE NEVER, like NEVER, copy any single file or code from there.**

This is the **STRICTEST** rule and MUST be followed at ALL times:

- ✅ **ALLOWED:** Reference nextjs-app to understand features, flows, UX patterns, business logic concepts
- ✅ **ALLOWED:** Use MCP tools (Cloudflare Docs, Perplexity, Cloudflare Bindings) and SKILLs (astro, cloudflare, brainstorming) to find the best Cloudflare-native approach
- ✅ **ALLOWED:** Build equivalent functionality from scratch using Cloudflare-optimized patterns
- ❌ **FORBIDDEN:** Copy-pasting any file, component, function, hook, schema, or code block from nextjs-app
- ❌ **FORBIDDEN:** Duplicating CSS, translations, or configuration verbatim from nextjs-app
- ❌ **FORBIDDEN:** Using nextjs-app files as templates with "find and replace" modifications

**Every line of code in cf-astro must be written fresh, optimized for the Cloudflare + Astro + Preact stack.**

---

## 1. PROJECT IDENTITY

| Property | Value |
|----------|-------|
| **Name** | cf-astro (Madagascar Pet Hotel — Cloudflare Edition) |
| **Purpose** | Cloudflare-native pet hotel website equivalent to nextjs-app |
| **Framework** | Astro 6.0+ with `@astrojs/cloudflare` adapter |
| **UI Islands** | Preact (3KB, React-compatible) for interactive components |
| **Hosting** | Cloudflare Pages (unlimited bandwidth, free) |
| **Database** | Cloudflare D1 (SQLite) + Supabase PostgreSQL (via Hyperdrive) |
| **Cache** | Cloudflare KV + Upstash Redis |
| **Storage** | Cloudflare R2 (images/assets) + Supabase Storage (private/auth-gated) |
| **Email** | Resend HTTP API (via `resend` SDK or `fetch()`) |
| **Bot Protection** | Cloudflare Turnstile (free, unlimited challenges) |
| **Analytics** | PostHog (reverse-proxied) + Cloudflare Web Analytics |
| **Error Tracking** | Sentry (browser SDK) |
| **Logging** | BetterStack (to be added last) |
| **i18n** | Astro built-in (es/en with prefix routing) |
| **CSS** | Tailwind CSS v4 via `@tailwindcss/vite` |

---

## 2. CLOUDFLARE FREE TIER — EXACT LIMITS & QUOTAS

> All data verified against official Cloudflare documentation (March 2026). Free limits reset daily at 00:00 UTC unless stated as monthly.

### 2.1 Workers (Compute)

| Metric | Free Limit |
|--------|-----------|
| Requests | **100,000/day** |
| CPU time per request | **10 ms** |
| Memory | 128 MB |
| Subrequests per request | 50 |
| Worker script size | 3 MB |
| Number of Workers | 100 per account |
| Cron Triggers | 5 per account |
| Static Asset files per Worker | 20,000 (25 MiB each) |
| Environment variables | 64 per Worker (5 KB each) |
| Startup time | 1 second |
| Build minutes (Workers Builds) | 3,000/month |
| Concurrent builds | 1 |

### 2.2 D1 Database (SQLite)

| Metric | Free Limit |
|--------|-----------|
| Rows read | **5 million/day** |
| Rows written | **100,000/day** |
| Storage (total across all DBs) | **5 GB** |
| Max database size | 10 GB (per DB) |
| Databases per account | 10 |
| Time Travel (point-in-time restore) | 7 days |
| Queries per Worker invocation | 50 |
| Egress/bandwidth | **FREE (no charges)** |
| Read replication cost | **FREE (no extra charges)** |

### 2.3 R2 Object Storage

| Metric | Free Limit |
|--------|-----------|
| Storage | **10 GB-month/month** |
| Class A operations (writes) | **1 million/month** |
| Class B operations (reads) | **10 million/month** |
| Egress (data transfer) | **FREE (always $0)** |
| Delete operations | **FREE** |

### 2.4 KV Namespace (Key-Value)

| Metric | Free Limit |
|--------|-----------|
| Keys read | **100,000/day** |
| Keys written | **1,000/day** |
| Keys deleted | **1,000/day** |
| List requests | **1,000/day** |
| Storage per account | **1 GB** |
| Namespaces per account | 1,000 |
| Keys per namespace | Unlimited |
| Key size | 512 bytes |
| Value size | 25 MiB |
| Key metadata | 1,024 bytes |

### 2.5 Hyperdrive (Connection Pooling)

| Metric | Free Limit |
|--------|-----------|
| Availability | **Included in Workers Free plan** (since April 2025) |
| Connection pooling | Global connection pools to PostgreSQL/MySQL |
| Cost | **FREE** |
| Minimum connections | 5 per configuration |

### 2.6 Pages (Static Hosting)

| Metric | Free Limit |
|--------|-----------|
| Builds per month | **500** |
| Files per site | **20,000** |
| File size | 25 MiB each |
| Custom domains | 500 per account |
| Bandwidth | **Unlimited** |
| Sites/Projects | Unlimited |

### 2.7 Durable Objects

| Metric | Free Limit |
|--------|-----------|
| Requests | **100,000/day** |
| Duration (compute) | **13,000 GB-s/day** |
| Storage per account | 5 GB (SQLite-backed) |
| Storage per Durable Object | 10 GB max |
| Max classes per account | 100 |
| WebSocket message size | 32 MiB |
| CPU per request | 30 seconds |
| Storage backend | **SQLite only** on Free plan |

### 2.8 Queues (Message Queue)

| Metric | Free Limit |
|--------|-----------|
| Operations per day | **10,000** (reads + writes + deletes) |
| Maximum queues | 10,000 |
| Message retention | **24 hours** (vs 14 days on Paid) |
| Event subscriptions | Unlimited |

### 2.9 Workers AI

| Metric | Free Limit |
|--------|-----------|
| Neurons per day | **10,000** |
| Cost beyond free | N/A on Free plan (upgrade needed) |
| Models available | All public models |

### 2.10 Vectorize (Vector Database)

| Metric | Free Limit |
|--------|-----------|
| Queried vector dimensions | **30 million/month** |
| Stored vector dimensions | **5 million** |
| Indexes per account | 100 |
| Max vectors per index | 10,000,000 |
| Max dimensions | 1,536 (32-bit precision) |

### 2.11 Turnstile (Bot Protection / CAPTCHA Alternative)

| Metric | Free Limit |
|--------|-----------|
| Challenges/verifications | **Unlimited** |
| Widgets | Up to 20 |
| Hostnames per widget | 10 |
| Analytics lookback | 7 days |
| WCAG compliance | AAA |
| Widget types | Non-interactive, Managed, Invisible |

### 2.12 Web Analytics

| Metric | Free Limit |
|--------|-----------|
| Sites/domains | Unlimited |
| Events | Included (no sampling) |
| Cost | **FREE** |
| Client-side JS required | Yes (lightweight ~15KB) |

### 2.13 Email Routing

| Metric | Free Limit |
|--------|-----------|
| Destination addresses | 200 |
| Rules | Multiple per zone |
| Cost | **FREE** |

### 2.15 Resend (Transactional Email Service)

| Metric | Free Limit |
|--------|------------|
| Transactional emails | **3,000/month** |
| Daily sending limit | **100/day** |
| Custom domains | 1 |
| API keys | Unlimited |
| Webhooks | ✅ |
| Email templates (React) | ✅ |
| Batch sending | ✅ |
| SMTP fallback | Available (but use HTTP API on Workers) |
| NPM package | `resend` |
| Cloudflare Workers compatible | ✅ (official tutorial) |

### 2.14 Other Free Services

| Service | Free? | Notes |
|---------|-------|-------|
| SSL/TLS | ✅ | Universal SSL, automatic HTTPS |
| DDoS Protection | ✅ | Enterprise-grade, unmetered |
| CDN (300+ cities) | ✅ | Global edge network |
| DNS | ✅ | Authoritative DNS, fast |
| Page Rules | ✅ | 3 free rules |
| Firewall Rules | ✅ | 5 free rules |
| Browser Rendering | ✅ | 10 min/day, 3 concurrent |
| Analytics Engine | ✅ | Custom metrics from Workers |
| Cloudflare Tunnel | ✅ | Expose local services |
| Zero Trust (50 users) | ✅ | Identity-aware proxy |

---

## 3. SUPABASE FREE TIER — EXACT LIMITS

> For secured PostgreSQL with RLS, Realtime, Auth, and Storage.

| Metric | Free Limit |
|--------|-----------|
| Projects | **2 active** (pause after 7 days inactivity) |
| PostgreSQL database size | **500 MB** |
| Auth MAUs (monthly active users) | **50,000** |
| File storage | **1 GB** |
| Edge Functions invocations | **500,000/month** |
| Database egress | **5 GB/month** |
| Storage egress | **5 GB/month** |
| Realtime messages | **2 million/month** |
| Realtime concurrent connections | ~200 |
| RLS policies | **Unlimited** |
| API requests | Unlimited |

### Supabase Use Cases in cf-astro

| Use Case | Why Supabase (not D1) |
|----------|----------------------|
| User authentication | Supabase Auth with JWT, social logins, magic links |
| Row Level Security | Built-in PostgreSQL RLS for multi-tenant data |
| Realtime subscriptions | Live booking status updates via WebSockets |
| Complex relational queries | JOINs, CTEs, full-text search (PostgreSQL) |
| Private file storage | Auth-gated uploads with signed URLs |
| Admin panel data | Complex admin queries with auth context |

---

## 4. UPSTASH FREE TIER — EXACT LIMITS

> For Redis caching, rate limiting, and session management.

| Metric | Free Limit |
|--------|-----------|
| Commands per day | **10,000** |
| Max data size | **256 MB** |
| Concurrent connections | 10 |
| Databases | 1 |
| Regions | 1 (single region) |
| Persistence | Yes (disk-backed) |

### Upstash Use Cases in cf-astro

| Use Case | Why Upstash (not KV) |
|----------|---------------------|
| API rate limiting | Sliding window counters with TTL |
| Session tokens | Short-lived session state with auto-expiry |
| Form submission dedup | Idempotency keys for double-submit prevention |
| Cache warming | Pre-computed data with TTL invalidation |

### When to Use KV vs Upstash

| Feature | Cloudflare KV | Upstash Redis |
|---------|---------------|---------------|
| Read latency | Ultra-low (edge) | Low (~5ms) |
| Write consistency | Eventually consistent | Strongly consistent |
| Data structures | Key-value only | Sorted sets, lists, hashes, pub/sub |
| TTL support | Yes | Yes (more granular) |
| Free reads/day | 100,000 | 10,000 commands total |
| Best for | Config, feature flags, cached pages | Rate limiting, sessions, counters |

---

## 5. ARCHITECTURE — DUAL DATABASE STRATEGY

### D1 + Supabase Coexistence

```
┌──────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE EDGE                          │
│                                                              │
│  Astro Pages (SSG) ──→ CDN (zero compute)                   │
│                                                              │
│  Workers (SSR/API) ──→ D1 (fast edge queries)               │
│                    ──→ Hyperdrive ──→ Supabase PG (complex)  │
│                    ──→ KV (edge cache)                       │
│                    ──→ R2 (images/files)                     │
│                    ──→ Upstash Redis (rate limit/sessions)   │
│                    ──→ Queues (async email/notifications)    │
│                    ──→ Durable Objects (realtime/websocket)  │
└──────────────────────────────────────────────────────────────┘
```

### Database Responsibility Matrix

| Data | Store | Rationale |
|------|-------|-----------|
| Bookings (core) | **Supabase** | Contains PII (name, email, phone) — RLS-protected |
| Booking pets | **Supabase** | Linked to bookings, RLS-protected FK |
| Consent records | **Supabase** | Legal compliance, PII-adjacent, RLS-protected |
| Privacy/ARCO requests | **Supabase** | Contains PII (name, email), RLS-protected |
| Booking quality metadata | **Supabase** | Linked to bookings, RLS-protected |
| Site settings | **D1** | KV-like settings cache, no PII |
| User accounts/profiles | **Supabase** | Auth + RLS required |
| Admin users | **Supabase** | Auth + role-based access |
| Gallery metadata | **Supabase** | Complex queries, admin CRUD |
| Testimonials | **Supabase** | Admin-managed, moderation |
| Analytics aggregates | **Supabase** | Complex time-series queries |
| Audit logs | **Supabase** | RLS-protected, retention policies |

> **PII Security Rule:** Any table containing personally identifiable information (name, email, phone, address) MUST be stored in Supabase with RLS enabled. D1 is reserved for non-PII operational data only.

### Storage Responsibility Matrix

| Content | Store | Rationale |
|---------|-------|-----------|
| Pet photos (public gallery) | **R2** | Zero egress, CDN-served, 10 GB free |
| Hero/marketing images | **R2** | Public, high-read volume |
| Icons, fonts, static assets | **R2 / Pages public/** | Build-time bundled |
| Private medical documents | **Supabase Storage** | Auth-gated signed URLs |
| Admin-uploaded files | **Supabase Storage** | RLS-controlled access |

### 5.1 Dynamic CMS & ISG/ISR Integration

To support realtime CMS updates from `cf-admin` while keeping the "lightning fast" performance of Static Generation:
- **Data Source**: D1 (`cms_content` table) runs the core text, pricing, reviews, and service blocks. R2 (`IMAGES` Bucket) runs the gallery/hero assets.
- **ISG/ISR Mechanism**: By default, Astro is set to `output: 'static'` to ensure maximum performance and zero compute where possible. To enable dynamic ISR, target routes (e.g. `src/pages/[locale]/index.astro`) MUST explicitly use `export const prerender = false;`. This opts the route into edge-side SSR, which is then intercepted by our custom Middleware (`src/middleware.ts`).
  - The middleware intercepts GET requests and checks the `ISR_CACHE` KV Binding with a **deployment-scoped** key: `isr:{__BUILD_ID__}:{pathname}`.
  - **Hit**: Return cached HTML instantly (< 10ms).
  - **Miss**: Render the Astro SSR tree, serve it, and save to KV via `waitUntil()`.
- **Instant Revalidation**: When changes occur in `cf-admin`, it calls a unified `revalidateAstro(env, ['/'])` helper which:
  1. **Auto-expands** base paths to include all locale variants (`'/'` → `['/', '/en', '/es']`).
  2. Fires `POST {PUBLIC_ASTRO_URL}/api/revalidate` with `Authorization: Bearer {REVALIDATION_SECRET}`.
  3. cf-astro's `/api/revalidate` endpoint verifies the secret and deletes the matching `isr:{__BUILD_ID__}:*` keys from `ISR_CACHE` KV.
  4. The next visitor triggers a fresh SSR build, which is then cached again.

> ⚠️ **Key env vars for sync**: `REVALIDATION_SECRET` must be identical in both `cf-admin` and `cf-astro` `.dev.vars` / production secrets. `PUBLIC_ASTRO_URL` in cf-admin must point to the live cf-astro deployment (no trailing slash).

#### 🚨 ISR Cache Safety — `__BUILD_ID__` Scoping (CRITICAL — NEVER REMOVE)

Every ISR cache key **MUST** be scoped by a unique per-build identifier (`__BUILD_ID__`). This is injected at compile time via Vite `define` in `astro.config.ts`:

```typescript
// astro.config.ts → vite.define
__BUILD_ID__: JSON.stringify(Date.now().toString(36))
```

**Why this exists:** Astro uses content-hashed filenames for assets (e.g., `SchemaMarkup.Dlp8g64a.css`). Each build produces NEW hashes, and old assets are deleted. If ISR-cached HTML from Build N survives into Build N+1, the HTML references **deleted assets** → every `/_astro/*.css` and `/_astro/*.js` returns **404** → the site renders as raw unstyled HTML.

**The invariant:** `__BUILD_ID__` in the cache key guarantees that cached HTML from a previous deployment is never served. Old keys expire naturally via the 30-day KV TTL.

> 🚨 **NEVER replace `__BUILD_ID__` with a runtime env var like `CF_PAGES_COMMIT_SHA`.** That variable is a Cloudflare Pages-only feature and is ALWAYS undefined in Workers deployments. This was the exact cause of a critical production outage (April 2026). The build-time constant approach is the only reliable solution.

### 5.2 Shared Cloudflare Infrastructure Requirements

To ensure the sync pipeline functions correctly between `cf-admin` (the writer) and `cf-astro` (the reader), the underlying Cloudflare binding infrastructure MUST be strictly mapped:

> 🚨 **CRITICAL INFRASTRUCTURE RULE**: `cf-admin` and `cf-astro` MUST point to the EXACT same physical D1 database ID and R2 bucket names in their respective `wrangler.toml` files.

1. **D1 (`madagascar-db`)**: Both apps must use the exact same `database_id` allocated on the production account. `cf-admin` writes to `cms_content`, and `cf-astro` reads from it during SSR.
2. **R2 (`madagascar-images`)**: Both apps must point to the same bucket name. `cf-admin` uploads images via API, and `cf-astro` reads to generate CDN URLs.
3. **Account Consistency**: Both applications must be deployed to the **same Cloudflare Account ID** to share access to D1 and R2. Using different accounts will result in 404/Authentication errors during execution.

---

## 6. TECHNOLOGY STACK DECISIONS

> 🚨 **THE WHITELIST ARCHITECTURE POLICY:** We employ a strict "whitelisting" approach to technology additions. Anything not explicitly listed in this document is considered **BLACKLISTED** by default to protect our <50KB "Lean Edge" budget. If an AI agent or developer wishes to introduce a new library (e.g., React 19, Recharts, shadcn/ui, Hono), it must be explicitly proposed with a strong "why it's needed" justification. The new dependency can ONLY be used if the USER explicitly approves the proposal.

### 6.1 Framework: Astro 6.0+ (NOT Next.js)

- `output: 'static'` by default (zero JS marketing pages)
- Individual routes opt into SSR with `export const prerender = false`
- Island Architecture: Only interactive components ship JS
- Native Cloudflare adapter with binding access via `import { env } from "cloudflare:workers"`
- Content uses Astro 6 `glob()` loaders in `src/content.config.ts`, rendered via `await render(post)`

### 6.2 Interactive UI: Astro Island Architecture — Framework Options

Astro supports **multiple UI frameworks as islands** — interactive components that hydrate independently on an otherwise static page. Each island ships only its own framework runtime. You can even mix frameworks on the same page.

#### Official Astro Integrations (All Cloudflare Workers/Pages Compatible)

| Framework | Package | Min Bundle Size | Hydration Speed | Edge Rating | Best For |
|-----------|---------|----------------|-----------------|-------------|----------|
| **Preact** ⭐ | `@astrojs/preact` | ~10-15 KB | Fast | ⭐⭐⭐⭐⭐ | React-like islands, forms, wizards |
| **Solid** | `@astrojs/solid-js` | ~8-12 KB | Very fast (fine-grained) | ⭐⭐⭐⭐⭐ | High-perf reactive UIs, dashboards |
| **Svelte** | `@astrojs/svelte` | ~5-10 KB (compiled) | Fastest (no runtime) | ⭐⭐⭐⭐⭐ | Compiled output, animations, transitions |
| **Lit** | `@astrojs/lit` | ~5-8 KB | Very fast (web standards) | ⭐⭐⭐⭐⭐ | Web Components, design systems |
| **React** | `@astrojs/react` | ~40-60 KB (React 19) | Medium (virtual DOM) | ⭐⭐⭐ | Complex ecosystem libs (only if needed) |
| **Vue** | `@astrojs/vue` | ~30-50 KB (Vue 3) | Fast (reactive) | ⭐⭐⭐ | Vue ecosystem, Nuxt migration |
| **Alpine.js** | No integration needed | ~10-20 KB (script tag) | Instant (no hydration) | ⭐⭐⭐⭐⭐ | Simple toggles, dropdowns, declarative |
| **HTMX** | No integration needed | ~14 KB (script tag) | Instant | ⭐⭐⭐⭐⭐ | Server-driven HTML, form enhancements |

#### Primary Choice: **Preact** (Default Island Framework)

- 3KB gzipped vs 45KB+ for React runtime
- Full React API compatibility via `preact/compat`
- `@astrojs/preact` integration with `{ compat: true }`
- Use for: Booking wizard, contact form, interactive galleries, any complex state

#### Secondary Choice: **Alpine.js** (Lightweight Enhancement)

- Zero build step — add via `<script src>` in Astro layouts
- Perfect for simple toggles (mobile menu, FAQ accordion, modals)
- Declarative via HTML attributes (`x-data`, `x-show`, `x-on:click`)
- Can coexist alongside Preact islands on the same page

#### When to Use Which Framework

| Scenario | Use | Why |
|----------|-----|-----|
| Multi-step booking wizard | **Preact** (`client:idle`) | Complex form state, validation |
| Date picker / calendar | **Preact** (`client:visible`) | Rich interaction, keyboard nav |
| Mobile hamburger menu | **Alpine.js** | Simple toggle, ~0 KB island overhead |
| FAQ accordion | **Alpine.js** | Declarative expand/collapse |
| Cookie consent banner | **Preact** (`client:idle`) | Consent state management |
| Image gallery lightbox | **Preact** (`client:visible`) | Touch gestures, lazy load |
| Language switcher | **Alpine.js** | Simple dropdown |
| Real-time availability | **Preact** (`client:only="preact"`) | WebSocket + state |

#### Hydration Directives (Critical for Performance)

| Directive | When JS Loads | Use For |
|-----------|--------------|----------|
| `client:load` | Immediately | Above-fold critical interactivity |
| `client:idle` | After page idle | Below-fold forms, wizards |
| `client:visible` | When scrolled into view | Galleries, maps, carousels |
| `client:media` | When media query matches | Mobile-only components |
| `client:only="preact"` | Client-only (no SSR) | WebSocket, localStorage-dependent |

### 6.3 CSS: Tailwind CSS v4

- Tailwind CSS v4 runs via `@tailwindcss/vite` as a Vite plugin inside `astro.config.ts`
- Uses `@theme extend` in `src/styles/global.css` for design tokens
- When styling scoped Astro components in `<style>`, MUST import theme variables via `@reference "../../styles/global.css";`

### 6.4 Validation: Zod v3 (NOT v4)

- Zod v4 conflicts with Astro's internal Zod v3 dependency
- Pin to `^3.25.0` in package.json

### 6.5 Email: Native Fetch + Eta Templates via Queue (NOT React-Email/Resend SDK)

- Cloudflare Workers cannot open raw TCP/SMTP sockets.
- The `resend` Node.js SDK and `@react-email/components` packages are **FORBIDDEN** due to massive bundle bloat.
- We use direct `fetch()` calls to the Resend REST API (`https://api.resend.com/emails`).
- For templates, we use **Eta** (`eta` package, ~2.5KB) for extremely lightweight, fast HTML generation natively on the Edge.
- Official documentation for Resend API: https://resend.com/docs/api-reference/emails/send-email
- Store `RESEND_API_KEY` in `.dev.vars` (local) and `wrangler secret put RESEND_API_KEY` (production)
- Free tier: **3,000 emails/month**, **100 emails/day**
- **Brevo is NOT used in this project** — Resend is the only email provider

> ⚠️ **QUEUE-FIRST DELIVERY (Active):** All transactional emails are sent **asynchronously via Cloudflare Queues**, NOT inline in API routes. API routes push a typed message to `env.EMAIL_QUEUE`; the sidecar `cf-astro-email-consumer` Worker processes the queue and calls Resend. See **Section 6.13** for full architecture.
>
> **If you modify email templates, Resend config, or add new email types:**
> 1. Update `src/lib/email/queue-types.ts` (message type definitions)
> 2. Update `queue-worker/src/index.ts` (consumer logic + email HTML builders)
> 3. Redeploy the consumer worker: `cd queue-worker && npx wrangler deploy`

### 6.6 Image Processing: Passthrough (NOT Sharp)

- Workers cannot run `sharp` (Node.js native module)
- Use `image: { service: passthroughImageService() }` in `astro.config.ts`
- **Crucial:** Using `passthroughImageService()` explicitly resolves `ASSETS` binding namespace collisions during Astro's internal prerendering phase.
- Pre-optimize images before R2 upload (use squoosh/tinypng)

### 6.7 Database & Service Access from Workers

Always import `env` directly. `Astro.locals.runtime.env` is deprecated and causes type conflicts.

```typescript
import { env } from "cloudflare:workers";

// Usage:
env.DB             // Cloudflare D1 (non-PII only)
env.IMAGES         // Cloudflare R2
env.ARCO_DOCS      // Cloudflare R2 (ARCO identity docs)
env.KV             // Cloudflare KV
env.EMAIL_QUEUE    // Cloudflare Queue (producer — pushes messages)
```

Supabase (PG):  Drizzle ORM + `pg` driver via Hyperdrive binding
Upstash Redis:  `@upstash/redis` with REST API (no TCP needed)
Resend Email:   Direct `fetch` API + Eta Templates (consumer worker only)

> ⚠️ **Email is NOT called directly from API routes.** API routes push to `env.EMAIL_QUEUE`. The `cf-astro-email-consumer` worker (in `queue-worker/`) reads from the queue and calls Resend. See **Section 6.13**.

### 6.12 Supabase Project Configuration

| Property | Value |
|----------|-------|
| **Project ID** | `zlvmrepvypucvbyfbpjj` |
| **Project Name** | cf-astro |
| **Region** | us-east-1 |
| **Database Host** | `db.zlvmrepvypucvbyfbpjj.supabase.co` |
| **REST API** | `https://zlvmrepvypucvbyfbpjj.supabase.co/rest/v1/` |
| **RLS Enabled** | ✅ On ALL public tables |
| **PII Storage** | Bookings, pets, consent, privacy requests |

### 6.8 Cloudflare Framework Support Comparison (Why Astro Won)

The following frameworks have official or community Cloudflare deployment support:

| Framework | Official CF Adapter? | Deployment Target | Node.js Needed? | Best For | CF Rating |
|-----------|---------------------|-------------------|-----------------|----------|----------|
| **Astro** ⭐ | ✅ Official (`@astrojs/cloudflare`) | Pages + Workers | No (edge-native) | Content sites, islands, hybrid SSG/SSR | ⭐⭐⭐⭐⭐ |
| **SvelteKit** | ✅ Official | Pages | No | Full-stack apps, compiled output | ⭐⭐⭐⭐ |
| **Remix** | ✅ Official | Pages | No | Data-heavy apps, nested layouts | ⭐⭐⭐⭐ |
| **Next.js** | ❌ Community (`@opennextjs/cloudflare`) | Pages/Workers | Partial (Node compat layer) | Complex React apps (better on Vercel) | ⭐⭐ |
| **Nuxt** | ❌ Community | Pages | Partial | Vue ecosystem apps | ⭐⭐ |
| **Qwik** | ⚠️ Partial | Workers | No (resumable) | Performance-critical SPAs | ⭐⭐⭐ |
| **Hono** | ✅ Native (built for Workers) | Workers | No | API backends, microservices | ⭐⭐⭐⭐⭐ |

#### Why NOT Next.js on Cloudflare?

- No official adapter — relies on community `@opennextjs/cloudflare`
- Workers use a **Node.js-compatible subset**, not full Node.js (no `fs`, no long-running processes)
- Cold start overhead is higher with React SSR on edge
- Feature parity gaps: ISR, middleware, Image Optimization all behave differently
- **Verdict:** Next.js runs best on Vercel; Cloudflare's native choice is Astro

#### Why Astro is the #1 Choice for Cloudflare (2026)

- Cloudflare **acquired Astro** in January 2026 — deepest integration of any framework
- Zero-JS by default means most pages are pure static (CDN-served, no Worker compute)
- Island architecture = ship JS only for interactive parts (Preact islands)
- Full access to all Cloudflare bindings (D1, R2, KV, Queues, DO) via adapter
- `workerd` runtime parity between dev and production
- Astro 6 (March 2026) further optimizes Cloudflare edge deploys

### 6.9 Backend API Framework: Hono (Optional)

[Hono](https://hono.dev) is an ultra-fast web framework built specifically for Cloudflare Workers.

- Native Workers support (built for `workerd` runtime)
- ~14 KB ultra-lightweight
- Express-like API with middleware support
- Built-in helpers: JWT validation, CORS, rate limiting, OpenAPI
- Can be used alongside Astro API routes for complex backend logic

**When to use Hono:** If API route logic in Astro becomes too complex, extract into a dedicated Hono Worker as a microservice. For simple API routes (booking submission, email send), Astro's built-in API routes are sufficient.

### 6.10 Node.js Compatibility in Cloudflare Workers

- Workers provide a **Node.js-compatible subset** (expanded greatly in 2025)
- Hundreds of native Node APIs implemented in TypeScript/C++ (not polyfills)
- Compatible: `crypto`, `Buffer`, `URL`, `TextEncoder`, `streams`, npm packages using `fetch`
- NOT compatible: `fs`, `path` (filesystem), `child_process`, `net` (TCP sockets), `cluster`
- Enable via `node_compat = true` in wrangler.toml (already configured)
- **Rule:** Always test npm packages in Workers before assuming compatibility

### 6.11 ORM: Drizzle ORM (Required for Database Setups)

- **Standard ORM**: All database interactions (whether D1 or Supabase PostgreSQL via Hyperdrive) **must** use **Drizzle ORM**.
- **Why Drizzle over Prisma/Others**:
  - Extremely lightweight and edge-compatible (perfect for Cloudflare Workers/Pages).
  - No Rust engines or heavy binaries; runs natively on V8 isolates.
  - SQL-like syntax gives full control over performance-critical edge queries.
  - Excellent TypeScript support, schema management, and type safety.
- **D1 Migrations**: Use `drizzle-kit` to generate raw SQL migrations, which are then applied using `wrangler d1 execute`.

### 6.13 Cloudflare Queues & Webhook Email Architecture (Active)

> **Status:** ✅ Implemented and deployed (April 2026)
> 📖 **Full documentation:** [`../cf-email-consumer/README.md`](../cf-email-consumer/README.md)

#### Overview

All transactional emails are delivered **asynchronously** via a Cloudflare Queue + sidecar consumer worker. No API route in the main Astro project calls Resend directly. The consumer worker (`cf-email-consumer`) is **completely isolated** from `cf-astro`, possessing its own `db.ts` to prevent cross-project dependency fragility. Furthermore, Resend webhooks post delivery events back to `/api/webhooks/resend`, closing the observability loop by mapping JSONB `deliveryEvents` natively into the `email_audit_logs` Supabase table.

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN PROJECT (cf-astro — Cloudflare Pages)                     │
│                                                                 │
│  /api/booking.ts ──→ Supabase Insert ──→ env.EMAIL_QUEUE.send() │
│  /api/arco/submit.ts ──→ R2 + Supabase ──→ env.EMAIL_QUEUE.send()│
│                                                                 │
│  Response returns immediately (no email wait)                   │
│                                                                 │
│  /api/webhooks/resend ◄── HMAC-SHA256 ◄── Resend Events         │
│         │                                                       │
│         └─→ Update Supabase email_audit_logs                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE QUEUE: madagascar-emails                            │
│  Free tier: 10,000 operations/day                               │
│  Retention: 24 hours (free plan)                                │
└────────────────────────┬────────────────────────────────────────┘
                         │ push consumer (auto-batched)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SIDECAR WORKER: cf-email-consumer (Fully Isolated)             │
│                                                                 │
│  Receives MessageBatch → for each message:                      │
│    ├─ booking_confirmation → 2 emails (admin + customer)        │
│    └─ arco_admin_notification → 1 email (admin only)            │
│                                                                 │
│  Success → msg.ack()                                            │
│  Failure → msg.retry() (up to 3 retries)                        │
│  Max retries exceeded → Dead Letter Queue (madagascar-emails-dlq)│
│                                                                 │
│  Secret: RESEND_API_KEY (set via wrangler secret put)           │
└─────────────────────────────────────────────────────────────────┘
```

#### File Map

| File | Role | When to Modify |
|------|------|----------------|
| `src/lib/email/queue-types.ts` | **Message contract** (discriminated union) | Adding new email types |
| `src/pages/api/booking.ts` | **Producer** — pushes `booking_confirmation` | Changing booking data shape |
| `src/pages/api/arco/submit.ts` | **Producer** — pushes `arco_admin_notification` | Changing ARCO data shape |
| `../cf-email-consumer/src/index.ts` | **Consumer** — builds HTML + calls Resend | Changing templates, adding types |
| `../cf-email-consumer/wrangler.toml` | Consumer config (batch size, retries, DLQ) | Changing retry/batch behavior |
| `wrangler.toml` (root) | Producer binding (`EMAIL_QUEUE`) | Never (already configured) |
| `env.d.ts` | TypeScript type for `EMAIL_QUEUE` binding | Adding new message types |

#### Message Types

```typescript
type EmailQueueMessage =
  | { type: 'booking_confirmation'; data: BookingEmailPayload }
  | { type: 'arco_admin_notification'; data: ArcoEmailPayload };
```

To add a new email type (e.g., `password_reset`, `admin_weekly_report`):
1. Add the new variant to `EmailQueueMessage` in `src/lib/email/queue-types.ts`
2. Add a matching `case` in the consumer's `switch` block in `queue-worker/src/index.ts`
3. Mirror the type in the consumer (types are duplicated to keep the worker dependency-free)
4. Push from the relevant API route: `env.EMAIL_QUEUE.send({ type: 'new_type', data: {...} })`

#### Queue Configuration

| Setting | Value | Why |
|---------|-------|-----|
| Queue name | `madagascar-emails` | Single queue for all email types |
| Max batch size | 10 | Process up to 10 messages per invocation |
| Max retries | 3 | Handles transient Resend failures |
| Dead letter queue | `madagascar-emails-dlq` | Failed messages after 3 retries are preserved |
| Consumer worker | `cf-astro-email-consumer` | Deployed from `queue-worker/` directory |

#### ⚠️ Cross-Reference Warnings

> **ANY change to the following sections MUST consider the queue system:**
>
> | Section Changed | Queue Impact | Action Required |
> |----------------|---------------|-----------------|
> | **6.5** (Resend/Email config) | Consumer uses Resend SDK | Update consumer if API key format, sender domain, or SDK version changes |
> | **6.7** (Service bindings) | `EMAIL_QUEUE` binding name | If binding name changes, update `env.d.ts`, all producers, and `wrangler.toml` |
> | **6.12** (Supabase config) | Consumer does NOT access Supabase | No impact — but if email status tracking is needed later, consumer would need DB access |
> | **9.1** (Secrets) | Consumer needs `RESEND_API_KEY` | Must be set separately: `cd queue-worker && wrangler secret put RESEND_API_KEY` |
> | **9.4** (CSP) | No impact | Queue is server-to-server, no browser CSP involvement |
> | **11** (Deployment) | Two separate deployments | Main site AND consumer worker must be deployed when email logic changes |
> | API route changes | Producer payloads | If booking/ARCO data shape changes, update `queue-types.ts` AND consumer |
> | New API routes with emails | New producer | Add new message type to union, add consumer case, push from new route |

---

## 7. INTEGRATION PLAN — SERVICES TO ADD

### Phase 1: Core (Complete ✅)
- [x] Astro + Cloudflare adapter
- [x] D1 database + schema
- [x] R2 bucket binding
- [x] KV namespace binding
- [x] Resend email (HTTP API via `resend` SDK)
- [x] i18n (es/en)
- [x] PostHog reverse proxy
- [x] Security headers

### Phase 2: Enhanced Data Layer (Complete ✅)
- [x] **Supabase PostgreSQL** via Hyperdrive
  - Hyperdrive connection pooling bound directly in `wrangler.toml` (Worker-mode support)
  - Drizzle ORM + `pg` driver with Hyperdrive connection pooling
- [ ] **Supabase Auth**
  - JWT validation in Workers (no Supabase SDK needed server-side)
  - Client-side `@supabase/supabase-js` for auth flows
- [ ] **Supabase RLS**
  - Policies on all user-facing tables
  - Admin role escalation via custom claims

### Phase 3: Performance & Reliability (Partially Complete)
- [x] **Upstash Redis**
  - `@upstash/redis` REST client (works in Workers)
  - Sliding window rate limiting on all 3 API routes (booking, ARCO, privacy)
- [x] **Cloudflare Queues** ← See **Section 6.13** for full architecture
  - `madagascar-emails` queue with sidecar consumer worker
  - Async email delivery (booking confirmation + ARCO admin notification)
  - 3 retries + dead-letter queue for failed messages
- [ ] **Cloudflare Durable Objects**
  - Real-time booking availability (WebSocket)
  - Admin live dashboard (if needed)

### Phase 4: Intelligence (Optional)
- [ ] **Workers AI** (10,000 neurons/day free)
  - Auto-translate booking confirmations
  - AI-powered FAQ responses
- [ ] **Vectorize**
  - Semantic search across FAQ/content
  - Pet breed recommendations

### Phase 5: Observability (Added Last)
- [ ] **PostHog** — Full client-side analytics
- [ ] **Sentry** — Browser error tracking (`@sentry/browser`)
- [ ] **BetterStack** — Log aggregation and uptime monitoring

---

## 8. CODE QUALITY RULES

### 8.1 Zero-Comment Code
Code must be self-documenting via clear naming. If logic is complex, create a sidecar `.md` file in the same directory.

### 8.2 Strict TypeScript
- Use `interface` and `type` explicitly
- `any` type is **FORBIDDEN** (unless bypassing an upstream type bug, thoroughly documented)
- All environment bindings typed via `src/worker-configuration.d.ts` (generated by `wrangler types` / `npm run cf-typegen`)

### 8.3 File Naming
All file names must be unique and descriptive across the project:
- ✅ `BookingWizard.tsx`, `HeroSection.astro`, `ContactForm.tsx`
- ❌ `Form.tsx` (ambiguous), `index.tsx` (without context)

### 8.4 Component Architecture
- **Astro components** (`.astro`) for static sections (zero JS shipped)
- **Preact islands** (`.tsx`) only for interactive UI (forms, wizards, toggles)
- Use `client:idle` for below-fold interactivity
- Use `client:visible` for lazy-loaded sections
- Use `client:only="preact"` for client-only components

### 8.5 Error Handling
- Never show white screens; use Astro error pages
- API routes return structured JSON errors with proper HTTP status codes
- Errors logged silently to Sentry/PostHog; users see friendly messages

---

## 9. SECURITY RULES

### 9.1 Secrets Management
- Local dev secrets in `.dev.vars` (gitignored)
- Production secrets via `wrangler secret put <KEY>`
- Never commit secrets; `.dev.vars` is in `.gitignore`
- Required secrets: `RESEND_API_KEY`, `ADMIN_EMAIL`, `SENDER_EMAIL`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`

### 9.2 Input Validation
- All API endpoints validate with Zod schemas before processing
- Sanitize user input before D1/Supabase queries
- Use parameterized queries (prepared statements) — never string concatenation

### 9.3 Bot Protection
- Cloudflare Turnstile on all forms (booking, contact, ARCO)
- Server-side token verification via Turnstile Siteverify API
- Rate limiting via Upstash Redis on all API endpoints

### 9.4 Content Security Policy
Defined in `public/_headers` for all origins:
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' *.posthog.com challenges.cloudflare.com`
- `connect-src 'self' *.posthog.com *.ingest.us.sentry.io *.supabase.co api.resend.com api.indexnow.org`
- `img-src 'self' blob: data: *.r2.dev cdn.madagascarhotelags.com`

**Critical**: `cdn.madagascarhotelags.com` (custom R2 CDN domain) MUST stay in `img-src`. Removing it silently blocks all R2-served images in the browser. Any new image domain (R2 aliases, external CDNs) must be added here before deployment. See Issue #12 in [10-TROUBLESHOOTING-LOG.md](./Documentation/10-TROUBLESHOOTING-LOG.md).

**Additional cross-origin headers** (added 2026-04-13):
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: unsafe-none`
- `Cross-Origin-Resource-Policy: same-site`

**Sitemap Architecture Note**: Custom TypeScript endpoints (`src/pages/sitemap-*.xml.ts`) replace `@astrojs/sitemap`. They emit `xhtml:link` hreflang per URL, dynamic lastmod, and Google Image sitemap format. Do NOT re-add `@astrojs/sitemap` to `astro.config.ts` — it cannot produce per-URL hreflang annotations.

### 9.5 Auth Architecture
- Supabase Auth for user identity (JWT-based)
- JWT validation in Workers without Supabase SDK (verify with public key)
- RLS on all Supabase tables - no admin bypass in client code
- Admin routes protected server-side before rendering

---

## 10. PERFORMANCE BUDGET

### Targets
| Metric | Target |
|--------|--------|
| Lighthouse Performance (Mobile) | ≥ 95 |
| First Contentful Paint | < 1.0s |
| Largest Contentful Paint | < 1.5s |
| Total Blocking Time | < 50ms |
| Cumulative Layout Shift | < 0.05 |
| Marketing pages JS shipped | **0 KB** (Astro static) |
| Interactive pages JS (booking) | < 50 KB (Preact island) |

### Free Tier Budget (Daily)
| Resource | Budget | Headroom |
|----------|--------|----------|
| Workers requests | 100,000/day | ~3,000 visits/day at ~30 req/visit |
| D1 reads | 5,000,000/day | ~50,000 complex queries/day |
| D1 writes | 100,000/day | ~500 bookings/day |
| KV reads | 100,000/day | Config/cache lookups |
| R2 reads | 333,000/day (~10M/month) | All image serving |
| Upstash commands | 10,000/day | Rate limiting + sessions |

---

## 11. DEPLOYMENT RULES

### Build & Deploy
```bash
# Development
astro dev                          # Starts with local D1/R2/KV bindings

# Build
astro build                        # Outputs to ./dist

# Deploy (Main Astro Site)
# Project uses standard workers pipeline, mapped natively with wrangler.toml
astro build && wrangler deploy

# Deploy (Email Queue Consumer Worker — separate deployment)
cd queue-worker && npx wrangler deploy

# D1 Migrations
wrangler d1 execute madagascar-db --local --file=./db/migrations/XXXX.sql
wrangler d1 execute madagascar-db --remote --file=./db/migrations/XXXX.sql
```

> ⚠️ **Two deployments required:** The main Astro site and the `queue-worker` are deployed **independently**. If you change email templates or add new email types, you MUST also redeploy `queue-worker`. Use `npx wrangler tail cf-astro-email-consumer` to monitor queue processing in real-time.

### 11.1 ISR Cache Safety Checklist (MANDATORY)

> 🚨 **PRODUCTION OUTAGE PREVENTION** — These checks exist because a cache-poisoning bug caused a full production outage in April 2026. **Never skip them.**

Before EVERY deployment, verify:

1. **`astro.config.ts`** contains `__BUILD_ID__: JSON.stringify(Date.now().toString(36))` in `vite.define` — this ensures each build auto-scopes ISR cache keys.
2. **`src/middleware.ts`** uses `__BUILD_ID__` (NOT `env.CF_PAGES_COMMIT_SHA`) for the `deployHash` variable.
3. **`src/pages/api/revalidate.ts`** uses the same `__BUILD_ID__` pattern for cache key construction.
4. **`env.d.ts`** declares `declare const __BUILD_ID__: string;`.
5. After `astro build`, verify the compiled middleware contains a **hardcoded string** (e.g., `deployHash = "mnwdkora"`) — NOT a runtime variable lookup.

**Red flags that indicate regression:**
- Any reference to `CF_PAGES_COMMIT_SHA` in `src/` → ❌ This is a Pages-only var, always undefined in Workers.
- Cache key format `isr:v1:` or `isr:dev:` in production → ❌ Means `__BUILD_ID__` injection is broken.
- The string `'v1'` as a fallback for deploy hash → ❌ This was the exact bug that caused the outage.

### Environment
- `wrangler.toml` — All bindings (D1, R2, KV, Hyperdrive, Queues producer)
- `queue-worker/wrangler.toml` — Consumer worker bindings (Queue consumer)
- `.dev.vars` — Local secrets (gitignored): `RESEND_API_KEY`, `ADMIN_EMAIL`, `SENDER_EMAIL`, Supabase keys
- `wrangler secret put <KEY>` — Production secrets (main project)
- `cd queue-worker && wrangler secret put RESEND_API_KEY` — Consumer worker secrets

### Dashboard Bindings (Cannot Be Set in wrangler.toml for Pages)
- **Hyperdrive** — Must be bound via Cloudflare Dashboard → Pages → Settings → Bindings
- **EMAIL_QUEUE** — Must be bound via Cloudflare Dashboard → Pages → Settings → Bindings → Queue

### Git Workflow
> 🚨 **CRITICAL: See `../../GITHUB_RULES.md` for all Git deployment commands.**
> You must ALWAYS verify your directory with `git remote -v` and push directly to `origin main`. Do not create branches.

---

## 12. FUTURE CONSIDERATIONS

### Cloudflare Services to Evaluate Later
| Service | Use Case | Free? |
|---------|----------|-------|
| Email Workers | Inbound email processing | ✅ |
| Analytics Engine | Custom high-cardinality metrics | ✅ |
| Cloudflare Tunnel | Expose local dev to team | ✅ |
| Zero Trust (50 users) | Admin panel access control | ✅ |
| Browser Rendering | Screenshot generation | ✅ (10 min/day) |
| Containers | Heavy compute jobs | ❌ (Paid only) |

### Scaling Path (If Free Tier Exceeded)
1. **Workers Paid ($5/month):** Unlimited requests, 5 min CPU, 500 Workers
2. **D1 Paid:** 25 billion reads/month, 50M writes/month included
3. **R2 Paid:** $0.015/GB/month storage, zero egress always

---

## 13. MCP & SKILL USAGE GUIDE

When working on cf-astro, always use these resources BEFORE writing code:

### 13.1 Active & Available MCP Tools

We have an extensive list of MCP tools available to assist with development. 
> **⚠️ 100-Tool Limit constraint:** Due to a hard limit of 100 maximum tools per session, some of the MCPs listed below (or specific tools within them) might be temporarily disabled. If you need a specific MCP tool that is not currently visible, **ask the user to activate it** (they can easily switch another off to make room).

| MCP Name | Cost | When to Use |
|----------|------|-------------|
| `@mcp:tavily` | **FREE (Generous Tier)** | **[HIGH PRIORITY]** Web searches, deep research, and data extraction. Preferred over Perplexity for open-web deep dives. |
| `@mcp:resend` | **FREE** | Managing, sending, and previewing transactional emails/broadcasts directly during development. |
| `@mcp:cloudflare-docs` | **FREE** | API signatures, platform limits, Cloudflare product features. |
| `@mcp:cloudflare-bindings` | **FREE** | Runtime binding access patterns, env types for Workers/Pages. |
| `@mcp:posthog` | **FREE** | Querying PostHog analytics, exploring events/funnels, or consulting docs via context. |
| `@mcp:sentry` | **FREE** | Error tracking setup, fetching context on recent errors. |
| `@mcp:supabase-mcp-server` | **FREE** | Database schema, RLS policies, Auth setup, project config. |
| `@mcp:upstash` | **FREE** | Redis database management, key inspection, rate-limit config, and cache operations. Use for setting up/debugging Upstash Redis instances, verifying stored keys, and managing TTLs. |

*Upcoming Addition: We may soon add an MCP for **BetterStack** to manage centralized logging and uptime monitoring.*

### 13.2 Core & Specialized Skills (Trigger Based on Requirements)

Always refer to the appropriate skill guidelines to ensure high-quality and consistent implementations:

| Skill Path | Purpose & When to Trigger |
|------------|----------------------------|
| `@[.agents/skills/astro/SKILL.md]` | Astro configuration, CLI commands, project structure, and adapters |
| `@[.agents/skills/cloudflare/SKILL.md]` | Cloudflare product selection, D1/R2/KV integrations, pricing limits |
| `@[.agents/skills/seo-geo/SKILL.md]` | SEO/GEO optimizations, schema markup, and AI engine indexing tasks |
| `@[.agents/skills/colorize/SKILL.md]` | Making designs pop and vibrant; fixing dull interfaces, adding aesthetic warmth |
| `@[.agents/skills/systematic-debugging/SKILL.md]` | First-response framework to ANY bugs, test failures, or unexpected behaviors |
| `@[nextjs-app/.agents/skills/web-design-guidelines/SKILL.md]` | High-level visual identity (colors, typography) and premium feel requirements |
| `@[nextjs-app/.agents/skills/frontend-design/SKILL.md]` | Structural frontend practices (mobile-first, accessibility, layout patterns) |
| `@[admin-app/.agent/skills/security-best-practices/SKILL.md]` | Auth/Authz implementation, RLS, middleware, and secure data handling |
| `@[nextjs-app/.agents/skills/brainstorming/SKILL.md]` | Design process (brainstorm → plan → build) |

### 13.3 ⚠️ Perplexity MCP — PAID SERVICE (Use Sparingly)

`@mcp:perplexity-ask` is a **PAID service** that costs real money per query. It must be used with extreme discipline:

#### ✅ ALLOWED — Use Perplexity ONLY when:
- Researching **new Cloudflare features** or limits that Cloudflare Docs MCP cannot answer
- Verifying **breaking changes** or deprecations in dependencies (Astro, Preact, Resend, etc.)
- Investigating **complex architectural decisions** with no clear documentation
- The user **explicitly requests** Perplexity research (e.g., "use Perplexity to find...")
- Debugging an issue that **all other free MCP tools (like Tavily) and web search have failed** to resolve

#### ❌ FORBIDDEN — NEVER use Perplexity for:
- Questions answerable by `@mcp:tavily` or `@mcp:cloudflare-docs` (use those first!)
- Simple API syntax or configuration lookups (use docs or Tavily search)
- General coding patterns (use pre-trained knowledge)
- Anything documented in RULES.md, SKILL.md files, or project documentation
- Routine development tasks (component building, CSS, TypeScript types)
- Questions already answered in this conversation

#### 🔄 Priority Order (Always follow this cascade):
1. **RULES.md** — Check this file first
2. **SKILL.md files** — See Section 13.2 for the full list of specialized skills
3. **`@mcp:cloudflare-docs`** — Official Cloudflare documentation (free)
4. **`@mcp:cloudflare-bindings`** — Binding patterns and types (free)
5. **`@mcp:tavily` / `search_web`** — General web search, generous tier (free)
6. **Pre-trained knowledge** — For common patterns (free)
7. **`@mcp:perplexity-ask`** — LAST RESORT only (💰 paid)

**Remember: Prefer free retrieval tools over Perplexity. Every Perplexity call costs money.**

---

## 14. TOTAL MONTHLY COST BREAKDOWN — $0 COMMERCIAL PROJECT

> Proof that a professional, production-grade application can run at exactly **$0/month**.

| Service | What We Use | Free Tier | Monthly Cost |
|---------|------------|-----------|-------------|
| **Cloudflare Pages** | Hosting + CDN + SSL | Unlimited bandwidth, 500 builds | **$0** |
| **Cloudflare Workers** | SSR + API routes | 100K req/day | **$0** |
| **Cloudflare D1** | Primary database | 5M reads + 100K writes/day, 5 GB | **$0** |
| **Cloudflare R2** | Image/asset storage | 10 GB, 10M reads/month, $0 egress | **$0** |
| **Cloudflare KV** | Edge cache | 100K reads/day, 1 GB | **$0** |
| **Cloudflare Turnstile** | Bot protection | Unlimited challenges | **$0** |
| **Cloudflare Web Analytics** | Traffic analytics | Unlimited | **$0** |
| **Cloudflare Hyperdrive** | DB connection pooling | Included free | **$0** |
| **Cloudflare Queues** | Async email delivery | 10K ops/day | **$0** |
| **Cloudflare DNS** | Domain resolution | Unlimited | **$0** |
| **Cloudflare SSL** | HTTPS certificates | Universal SSL | **$0** |
| **Cloudflare DDoS** | Attack protection | Enterprise-grade, unmetered | **$0** |
| **Resend** | Transactional email (sole email provider) | 3,000/month, 100/day | **$0** |
| **Supabase** | Auth + PostgreSQL + Storage | 500 MB DB, 1 GB storage, 50K MAUs | **$0** |
| **Upstash** | Redis (rate limiting) | 10K commands/day, 256 MB | **$0** |
| **PostHog** | Product analytics | 1M events/month | **$0** |
| **Sentry** | Error tracking | 5K errors/month | **$0** |
| **GitHub** | Source control + CI | Unlimited private repos | **$0** |
| | | **TOTAL MONTHLY COST** | **$0.00** |

### Only Paid Service in Our Stack

| Service | Cost | Mitigation |
|---------|------|------------|
| **Domain name** | ~$10-15/year | One-time, unavoidable for any real business |
| **Perplexity MCP** (dev tool) | Per-query | Minimize usage — see Section 13.2 |

**Bottom line:** A fully functional, SEO-optimized, legally compliant, multi-language commercial website running on enterprise-grade infrastructure for the cost of a domain name.

---
*Dev=harshil.8136@gmail.com*
*End of Rules. These constraints must be acknowledged and followed for every task in cf-astro.*

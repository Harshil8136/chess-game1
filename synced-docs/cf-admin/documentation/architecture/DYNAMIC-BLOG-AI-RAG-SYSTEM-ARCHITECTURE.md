---

title: "Dynamic D1 Blog, Workers AI RAG & Edge SSR Architecture"
status: active
audience: [ai, technical, operator]
last_verified: 2026-08-31
verified_against: [code]
owner: harshil
related_docs: [2026-08-03-blog-ai-seo-production-readiness.md, specs/2026-07-26-payload-cms-evaluation-and-dynamic-blog.md, specs/2026-07-29-content-and-ai-visibility-engine.md]
tags: [blog, ai, rag, seo, architecture, blueprint]
---

> **Note (2026-08-03):** This document is the original design blueprint and
> contains illustrative/target benchmark figures (see §1), not all of which
> were measured against production. For the verified, current state after
> the production-readiness hardening pass — security fixes, the publish
> quality gate, cadence locks, SEO/AIO mechanics, and exact service
> coordination — see
> [`2026-08-03-blog-ai-seo-production-readiness.md`](../2026-08-03-blog-ai-seo-production-readiness.md),
> which is the authoritative reference as of that date.

# Dynamic D1 Blog, Workers AI RAG & Edge SSR Architecture

> **System Blueprint & Technical Reference Manual**  
> **Target Applications:** `cf-admin` (Control Plane) & `cf-astro` (Customer-Facing Storefront)  
> **Last Updated:** 2026-08-03  
> **Infrastructure Model:** Commercial-Grade $0/Month Cloudflare Ecosystem

---

## 1. Executive Summary & Industry Standard Positioning

This document defines the end-to-end architecture, data flows, security posture, and edge delivery model for the **Dynamic D1 Blog, Workers AI RAG (Retrieval-Augmented Generation), and Edge SSR Engine** powering the Madagascar Pet Hotel platform.

> ### ⚠️ Correction — 2026-08-31
>
> Two things this document described as working were not.
>
> **1. "RAG" here is keyword-free bulk injection, not retrieval.** There is no
> vector database, no embedding model and no Vectorize binding anywhere in this
> product. `getKnowledgeBaseContext` fetches the top N active knowledge base
> entries in the API's own order and injects them wholesale into the system
> prompt. That is a legitimate and cheap grounding strategy at this KB size —
> but it is not retrieval, and the copilot UI's claim of a "D1 Vector Index"
> (removed 2026-08-31) was false.
>
> **2. Step 3 below never actually returned an entry.** From the day it shipped
> until 2026-08-31, `getKnowledgeBaseContext` read the wrong key off the
> response (`items`, where `/admin/kb` returns `entries`) and declared the wrong
> column names. Every generation silently fell back to a hardcoded nine-line
> literal. The `<15ms` RPC figure in the benchmark table below measured a call
> whose result was then discarded.
>
> Both are fixed. See
> [`../2026-08-31-ai-system-overhaul.md`](../2026-08-31-ai-system-overhaul.md) §1.2 and §2.5.

### Industry Benchmark Positioning

| Benchmark | Industry SaaS Standard (Paid Stack) | Madagascar Platform ($0 Architecture) | Performance Delta |
| :--- | :--- | :--- | :--- |
| **Monthly Infra Cost** | $450 - $1,200/mo (Vercel + Supabase + Contentful + OpenAI) | **$0.00 / month** (Cloudflare Free Tier) | **100% Cost Reduction** |
| **Edge TTFB (Global)** | 120ms - 350ms (Origin Server Hops) | **35ms - 60ms** (Cloudflare Global Worker Edge) | **82% Latency Improvement** |
| **AI Authoring Latency** | 4.5s - 8.0s (Third-party API RTT) | **1.2s - 2.8s** (Workers AI In-Isolate Execution) | **65% Speed Upgrade** |
| **Knowledge fetch overhead** | 200ms - 600ms (External Vector DB) | **<15ms** (`CHATBOT_SERVICE` Worker Binding RPC) | **95% Latency Reduction** — but see the correction above: this is bulk injection over a service binding, not vector retrieval, and until 2026-08-31 the fetched result was discarded |
| **Uptime / Availability** | 99.9% (Dependent on third-party SaaS SLAs) | **99.99%** (Multi-tier D1 + Static Fallback) | **Zero Single-Point-of-Failure** |

---

## 2. System Architecture & Dual-Application Ecosystem

The platform operates as a decoupled, dual-application ecosystem connected via shared Cloudflare D1 databases, R2 Object Storage, and Worker Service Bindings.

```
                  ┌─────────────────────────────────────────────────────────────┐
                  │                 BROWSER CLIENT / ADMIN USER                 │
                  └──────────────────────────────┬──────────────────────────────┘
                                                 │
                                                 ▼
        ┌────────────────────────────────────────┴────────────────────────────────────────┐
        │                                                                                 │
        ▼                                                                                 ▼
┌─────────────────────────────────────────┐                     ┌─────────────────────────────────────────┐
│              `cf-admin`                 │                     │               `cf-astro`                │
│             (Control Plane)             │                     │        (Storefront Edge Worker)         │
├─────────────────────────────────────────┤                     ├─────────────────────────────────────────┤
│ • Astro 6 SSR + Preact 10 Islands       │                     │ • Astro 6 Edge SSR (Dynamic Routes)     │
│ • Content Studio & Blog Manager         │                     │ • AioDirectAnswers & FAQPage Schema     │
│ • Tiptap Rich Visual Editor             │                     │ • Hreflang Reciprocal Pairing           │
│ • Workers AI Author & Content Copilot   │                     │ • Sentry Browser & Worker Tracing       │
│ • Version History & 1-Click Diff        │                     │ • BetterStack Edge Structured Logging   │
└───────────────────┬─────────────────────┘                     └────────────────────┬────────────────────┘
                    │                                                                │
                    │                    Cloudflare Infrastructure                   │
                    ├────────────────────────────────────────────────────────────────┤
                    │                                                                │
                    ▼                                                                ▼
┌─────────────────────────────────────────┐                     ┌─────────────────────────────────────────┐
│     Cloudflare D1 (`madagascar-db`)     │◄────────────────────┤       `ISR_CACHE` KV Namespace          │
│ • `blog_posts` (Published Articles)     │                     │ • Edge HTML Page Caching                │
│ • `cms_content_history` (Revisions)     │                     │ • Real-time Purge via /api/revalidate   │
└───────────────────┬─────────────────────┘                     └─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│    Workers AI & `cf-chatbot` RAG        │
│ • In-Isolate Model Execution            │
│ • Llama 3.3 70B & Qwen 2.5 Coder 32B    │
│ • Ground-Truth KB Service Binding RPC   │
└─────────────────────────────────────────┘
```

---

## 3. End-to-End Technical Flow: Authoring to Edge Delivery

### Phase 1: RAG Knowledge Retrieval & AI Authoring (`cf-admin`)
1. **User Request**: Content creator launches Workers AI Author in `cf-admin` Content Studio and inputs an article brief/topic.
2. **PLAC RBAC Verification**: Route handler `/api/content/ai-generate` verifies user role and page-level permission via `placDenyResponse(user, '/dashboard/content')`.
3. **Knowledge Context Fetch**: The AI generator calls `getKnowledgeBaseContext(env, maxItems, locale)`:
   - Queries `cf-chatbot` via server-side service binding (`env.CHATBOT_SERVICE.fetch('https://cf-chatbot.internal/admin/kb')`) or HTTP fallback proxy (`chatbotFetch()`).
   - Reads `entries` and renders `title_{locale}` / `content_{locale}` — official Madagascar Pet Hotel knowledge (rates, luxury suites, spa services, vet care policies, location in Aguascalientes).
   - Returns `{ source: 'kb' | 'fallback', count, text, reason? }`. **The source is reported to the operator**, so a fallback is never presented as retrieved ground truth.
4. **Workers AI In-Isolate Execution**:
   - Injects the knowledge block into the system prompt.
   - Executes Cloudflare Workers AI — default `@cf/meta/llama-4-scout-17b-16e-instruct`; see `src/lib/ai-pricing.ts` for the catalogue, which is the single source of truth. Every listed model supports guided JSON, and every call sends `response_format` plus a temperature, a scaled `max_tokens`, a 60s timeout and one retry.
   - Generates a structured JSON response (`title`, `slug`, `description`, `body`, `translation_slug`, `direct_answers`). **`seo_score` was removed from the schema on 2026-08-31** — the model no longer grades its own work; `evaluateSeoGate` is the single source of that number.
5. **1-Click Form Population**: User clicks **"Apply to Editor"** in `BlogAiCopilotModal.tsx`, automatically populating all 7 fields into `BlogManager.tsx`.

### Phase 2: D1 Database Mutation & Revision Snapshot (`cf-admin`)
1. **D1 Write**: Article is persisted to D1 database `blog_posts` table:

   ```sql
   INSERT INTO blog_posts (id, title, slug, description, body, cover_image, locale, translation_slug, status, pub_date, author, tags, seo_score, aio_data)
   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'published', ?9, ?10, ?11, ?12, ?13);
   ```

2. **Revision History Snapshot**: Saves copy to `cms_content_history` table for 1-click diff restores.

### Phase 3: Real-Time ISR Cache Purge & CDN Invalidation
1. **Revalidation Webhook Trigger**: `cf-admin` fires POST request to `https://madagascarhotelags.com/api/revalidate`:
   - Authorization: `Bearer <REVALIDATION_SECRET>`
   - Payload: `{ "paths": ["/es/blog/guia-pension-canina/", "/en/blog/dog-boarding-guide/"] }`
2. **KV & CDN Cache Invalidation**: `cf-astro/src/pages/api/revalidate.ts`:
   - Validates token using constant-time comparison (`timingSafeEq`).
   - Deletes matching keys from `ISR_CACHE` KV namespace (`env.ISR_CACHE`).
   - Calls Cloudflare Zone API to purge Edge CDN cache tags (`CLOUDFLARE_ZONE_ID` + `CLOUDFLARE_API_TOKEN`).
   - Triggers `pingIndexNow()` to notify Bing, Yandex, Naver, and Seznam immediately.

### Phase 4: Customer Edge SSR Rendering & AIO Citation (`cf-astro`)
1. **Dynamic Edge Route**: Customer requests `https://madagascarhotelags.com/es/blog/guia-pension-canina/`.
2. **Edge Retrieval**: `cf-astro` Cloudflare Worker executes `getBlogPostBySlug(env.DB, 'guia-pension-canina', 'es')`.
3. **Resilient Fallback**: If D1 is unavailable or entry is missing, automatically falls back to local static markdown collection (`getCollection('blog')`).
4. **AIO & SEO Rendering**:
   - Emits `BlogPosting` JSON-LD schema.
   - Emits `FAQPage` JSON-LD schema for AIO Q&A blocks (`AioDirectAnswers.astro`).
   - Emits reciprocal `hreflang` headers pointing to English paired slug.
   - Renders responsive mobile-first typography and cover image.

---

## 4. Latency & Performance Breakdown

```
Latency Timeline (Edge SSR Request Lifecycle)
─────────────────────────────────────────────────────────────────────────────
0ms        10ms       20ms       30ms       40ms       50ms       60ms
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Edge Routing (0.2ms)
│ ──► D1 Database Query (12ms)
│ ──────► Parse & Render HTML (18ms)
│ ──────────► Response Streams to Client (TTFB: 38ms)
```

| Operation Step | Average Latency | Maximum Budget | Tech Stack / Mechanism |
| :--- | :--- | :--- | :--- |
| **Worker Isolate Startup** | 0.0ms | <1.0ms | Cloudflare V8 Warm Isolate |
| **D1 SQL Query Read** | 12ms | <25ms | Cloudflare D1 SQLite (ENAM Region) |
| **RAG KB RPC Fetch** | 8ms | <15ms | Worker Service Binding (`env.CHATBOT_SERVICE`) |
| **Workers AI Generation** | 1.8s | <3.5s | Workers AI GPU Clusters (Llama 3.3 70B) |
| **KV Cache Purge** | 15ms | <40ms | Cloudflare KV API |
| **Edge CDN Purge** | 110ms | <300ms | Cloudflare Zone Cache Purge API |
| **HTML Page Edge SSR TTFB** | **38ms** | **<80ms** | Cloudflare Workers Global Network |

---

## 5. Security, Observability & Error Handling

### 1. Security Architecture & Access Control
- **Page-Level Access Control (PLAC)**: Single source of truth for admin feature gating (`placDenyResponse`).
- **Secret Hygiene**: All API tokens (`REVALIDATION_SECRET`, `ADMIN_AI_SECRET`, `HEALTH_CHECK_SECRET`, `CHATBOT_ADMIN_API_KEY`) stored via `wrangler secret put` and bound to environment context.
- **Sanitizations**: HTML string outputs run through context-aware sanitizer (`sanitizeHtml()`) to prevent XSS.

### 2. Observability & Telemetry Stack
- **Sentry Error Tracking**:
  - Client-side error boundary (`@sentry/browser`) capturing UI crashes.
  - Server-side Worker tracing capturing uncaught exceptions and API failures with route tags.
- **Cloudflare Observability**:
  - `[observability]` enabled with `head_sampling_rate = 1` for 100% trace capture.
  - Logs invocation traces and D1 execution metrics.
- **BetterStack Edge Logging**:
  - Edge-native structured logging via `@logtail/edge`.
  - Attaches `cf-connecting-ip`, `cf-ipcountry`, `user-agent`, and `cf-ray` to every log event.

### 3. Customer-Facing Error Recovery
- **Custom 500 Page (`cf-astro/src/pages/500.astro`)**:
  - Customer-friendly brand recovery screen.
  - Features 1-click **"Return to Home"** and **"WhatsApp Direct Support"** actions so users are never stranded.
  - Automatically captures exception context and reports trace to Sentry.

---

## 6. Maintenance & Operational Procedures

### Deploying Schema Migrations
1. Update D1 schema in `cf-admin/db/schema.sql`.
2. Apply migration to production:

   ```bash
   npx wrangler d1 execute madagascar-db --remote --file=./db/schema.sql
   ```

3. Run TypeScript type check across both workspaces:

   ```bash
   cd cf-admin && npx tsc --noEmit
   cd ../cf-astro && npx tsc --noEmit
   ```

### Verifying ISR Cache Revalidation
To manually test the revalidation flow from CLI:

```bash
curl -X POST https://madagascarhotelags.com/api/revalidate \
  -H "Authorization: Bearer YOUR_REVALIDATION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"paths": ["/es/blog/guia-pension-canina/"]}'
```

Expected response:

```json
{
  "revalidated": true,
  "message": "Purged 1 paths, injected 0 CMS keys.",
  "paths": ["/es/blog/guia-pension-canina/"],
  "now": 1785724800000
}
```

# CMS, Image & Bookings Management — Technical Documentation

> **Version:** 4.2 (Full KV Injection Parity — Hero, Reviews, Services; `PUBLIC_ASTRO_URL` Bug Fix)
> **Last Updated:** 2026-04-14
> **Authors:** CMS Team  
> **Projects:** `cf-admin`, `cf-astro`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Booking Management](#2-booking-management)
3. [Content Studio Hub](#3-content-studio-hub)
4. [Preact Interactive Gallery UI](#4-preact-interactive-gallery-ui)
5. [Storage & CDN Flow](#5-storage--cdn-flow)
6. [Defense-in-Depth Sync Pipeline](#6-defense-in-depth-sync-pipeline)
7. [ISR Revalidation & KV Cache Mapping](#7-isr-revalidation--kv-cache-mapping)
8. [Configuration & Environment Constraints](#8-configuration--environment-constraints)
9. [API Endpoints](#9-api-endpoints)
10. [Changelog](#10-changelog)

---

## 1. Architecture Overview

The system enables authorized admin users to manage structural content, visual assets, and booking workflows of `cf-astro` via a premium, lightning-fast dashboard (`cf-admin`) built entirely within Cloudflare's **$0 Free Tier**, while using Supabase for the Bookings engine.

**Core Stack:**
* **CMS Database:** Cloudflare D1
* **Bookings Database:** Supabase PostgreSQL
* **Asset Storage:** Cloudflare R2
* **Caching & Propagation:** Cloudflare KV (`ISR_CACHE`) & Edge Cache
* **Interactivity:** Preact + Native HTML5 Drag and Drop (`0kb` dependencies)
* **Frontend:** Astro 6 + Vite (`output: 'static'` with per-route `prerender = false` for SSR pages)

### KV Injection Coverage (v4.2)

All four CMS-managed content sections now implement the full 2-tier KV-first resolution strategy on both the write side (cf-admin) and the read side (cf-astro):

| Section | D1 Key | KV Key | KV Injected by |
|---------|--------|--------|----------------|
| Hero Image | `hero_image` (page: `home`) | `cms:hero_image` | `POST /api/media/upload` |
| Gallery | `gallery_images` (page: `home`) | `cms:gallery_images` | `POST /api/media/gallery` |
| Services Pricing | `services_pricing` (page: `home`) | `cms:services_pricing` | `POST /api/content/services` |
| Reviews | `happy_clients` (page: `global`) | `cms:happy_clients` | `POST /api/content/reviews` |

---

## 2. Booking Management

The Booking Management interface is a Preact Island designed to provide real-time visibility into customer reservations pulled securely from the Supabase infrastructure layer.

### System Architecture
- **Data Source:** Supabase PostgreSQL (`bookings` and `booking_pets` tables).
- **Access Control:** RBAC gated. Only `admin`, `super_admin`, `owner`, and `dev` roles are permitted to access this module.
- **API Endpoint:** `src/pages/api/bookings/index.ts`
- **Component:** `src/components/admin/BookingList.tsx`

### Capabilities
- **Summary Dashboard Stats:** The main `/dashboard` features live Key Performance Indicators (KPIs) showing **Total Bookings** and **Total Pets** directly bound to the database.
- **Server-Side Pagination & Search:** The backend gracefully filters pet names and customer info prior to transit, reducing payload overhead.
- **Expandable Detail Row:** Each row expands inline via a collapsible UI, providing immediate context for medical, dietary, and behavioral notes without requiring navigation.

---

## 3. Content Studio Hub (`/dashboard/content`)

The Content Studio operates as the headless CMS interface over the **D1 Database**. Changes saved here dictate the content rendered on the global `cf-astro` application.

By moving away from hard-coded slots into highly flexible JSON-driven arrays mapped to D1, the module enables **infinite scaling** of assets without needing new SQL migrations.

### Key Modules
- **`/dashboard/content/index.astro`** — The Hero Background manager (LCP critical).
- **`/dashboard/content/gallery.astro`** — The dynamic visual asset Drag-and-Drop manager.
- **`/dashboard/content/services.astro`** — Services & Pricing editor (synchronizes pricing across marketing pages and Preact Booking Wizard).
- **`/dashboard/content/reviews.astro`** — "Happy Clients" testimonials editor for the dynamic carousel.

### The Integration Health Bridge
Cross-project reliability is monitored via a localized heartbeat check on the dashboard.
- The `cf-admin` dashboard fetches `/api/health` from `PUBLIC_ASTRO_URL` upon load.
- A failure gracefully marks "cf-astro (Frontend)" as degraded, visually alerting the admin to a potential routing or deployment issue.

### Side-by-Side Live Preview
To provide immediate visual feedback, the Content Studio embeds an `iframe` of the `cf-astro` frontend. Upon a successful D1 save, the API fires a cache invalidation webhook to cf-astro, and the iframe reloads with cache-busting timestamps (`v={Date.now()}`), instantly surfacing edits.

---

## 4. Preact Interactive Gallery UI

**File:** `cf-admin/src/components/admin/content/GalleryManager.tsx`

To mimic high-end interactivity while preserving strict performance budgets (under 5kb JS), the Gallery Editor relies entirely on **Preact** Islands (`client:load`).

**Key Features:**
* **Native HTML5 Drag and Drop:** Infinite resorting capabilities utilizing pure browser-native `draggable={true}`.
* **Instant R2 Pushing:** Local asset uploads instantly hit `/api/media/upload` with `slot: 'temp_gallery_upload'`, depositing images in the bucket and returning permanent CDN links without touching D1.
* **Optimistic Saves:** Upon clicking `Push to Live Site`, the monolithic JSON array is persisted to D1, followed by a KV-injection webhook to purge the global Edge Cache and bypass D1 replica lag.
* **Robust UI Reflection (v4.0):** Gallery manager actively displays actionable diagnostics. If propagation fails, a localized `Retry Sync` fallback button is exposed, invoking `/api/media/revalidate`.

---

## 5. Storage & CDN Flow

### Production Domain
- **URL:** `https://cdn.madagascarhotelags.com`
- **Type:** R2 Custom Domain (Cloudflare-managed DNS)
- **Caching:** Cache-Everything page rule ensures edge caching is preserved natively.

> ⚠️ **CDN Cache Strategy:** All images use a **UUID-based R2 key per upload** (e.g. `hero/hero-{uuid}.jpg`). This ensures the Cloudflare CDN edge cache never serves a stale copy of a replaced image. The `cacheControl` header is `public, max-age=31536000` (no `immutable`) so manual CDN purges remain possible if needed.

**The Workflow:**
1. Image is locally uploaded using the Preact `GalleryManager`.
2. Form-data hits `POST /api/media/upload`.
3. Validation ensures `image/jpeg,png,webp,avif` only and sizes `≤5MB`.
4. R2 secures object as `hero/hero-{uuid}.ext` (hero) or `gallery/{uuid}.ext` (gallery).
5. CDN URL is injected into local component state.
6. User clicks 'Push', sending the JSON payload to `POST /api/media/gallery`, which writes to D1 and calls the ISR revalidation pipeline with KV data injection.

---

## 6. Defense-in-Depth Sync Pipeline (cf-astro)

A major hurdle historically was **D1 Read Replica Lag** where cf-admin would perform a write to the primary D1 node, but the subsequent ISR purge over at cf-astro would immediately read from a stale edge read-replica, causing cf-astro to indefinitely cache the old content post-update.

**Solution: The 2-Tier KV Injection Strategy (v4.0)**

Instead of relying on D1 for instant consistency post-save, `cf-admin` passes the fresh `cmsData` JSON payload verbatim to `cf-astro` *during the webhook payload*.
- `cf-astro` receives the payload in `/api/revalidate.ts`.
- It dynamically assigns the JSON string natively to a designated KV subspace (e.g. `cms:gallery_images`).
- When cf-astro reconstructs its DOM, each CMS provider checks **KV Layer first** for an immediate override state, falling back to D1 if the KV state is missing or expired (1-hour TTL).

This utterly bypasses the eventual consistency lag of the D1 read-replica architecture.

### KV-First Resolution — cf-astro Side

Each CMS-driven section implements the same 3-tier pattern at request time:

```
1. ISR_CACHE.get('cms:<key>')      → KV Layer (injected by revalidation webhook, 1hr TTL)
2. getCmsContent(db, page, id)     → D1 Layer (source of truth, may lag on replicas)
3. hardcoded fallback              → Static defaults (local images, placeholder text)
```

| Section | cf-astro resolver | KV key read |
|---------|-------------------|-------------|
| Hero | `getImageUrl(db, 'hero_image', fallback, ISR_CACHE)` in `Hero.astro` | `cms:hero_image` |
| Gallery | `getGalleryImageUrls(db, ISR_CACHE)` in `Gallery.astro` | `cms:gallery_images` |
| Services | KV-first block in `Services.astro` frontmatter | `cms:services_pricing` |
| Reviews | KV-first block in `Testimonials.astro` frontmatter | `cms:happy_clients` |

> **Why does D1 lag matter?** The ISR middleware caches SSR-rendered HTML for 30 days. If D1 returns stale data in the first render after a cache purge, that stale HTML gets locked into KV for the full 30-day window. KV injection solves this by ensuring the first render always uses fresh data regardless of replica sync state.

---

## 7. ISR Revalidation & KV Cache Mapping

All Studio API endpoints (Hero upload, Gallery save, Services save, Reviews save, and Text blocks save) trigger ISR cache purge via the **unified `revalidateAstro()` helper** in `cf-admin/src/lib/cms.ts`.

### revalidateAstro() Signature

```ts
revalidateAstro(
  env: CfEnv,
  basePaths: string[],        // root paths only — e.g. ['/'], ['/services']
  cmsData?: Record<string, string>,  // optional KV injection payload
  maxRetries = 3
): Promise<RevalidationResult>
```

### cmsData Payloads per Endpoint

| Endpoint | cmsData injected |
|----------|-----------------|
| `POST /api/media/upload` (hero_image slot) | `{ 'hero_image': cdnUrl }` |
| `POST /api/media/gallery` | `{ 'gallery_images': JSON.stringify(images) }` |
| `POST /api/media/revalidate` (retry) | `{ 'gallery_images': <current D1 value> }` |
| `POST /api/content/reviews` | `{ 'happy_clients': JSON.stringify(reviews) }` |
| `POST /api/content/services` | `{ 'services_pricing': JSON.stringify(pricingData) }` |
| `POST /api/content/blocks` | *(none — text blocks are purge-only, no lag risk)* |

### Automatic Locale Path Expansion
The helper includes a built-in "Path Expansion Engine" that automatically generates locale variants:
- `['/']` → `['/', '/en', '/es']`
- `['/services']` → `['/services', '/en/services', '/es/services']`

*(Note: Passing pre-localized paths like `'/es/'` manually will cause double-expansion. Only root feature paths should be provided.)*

### Resiliency Engine (v4.0)
If the webhook fails to resolve, `revalidateAstro()` initiates a **3× Exponential Backoff Retry Sequence** (300ms → 600ms → 900ms, 5s timeout per attempt) before conceding. The underlying endpoints resolve with robust structural details:

```json
{
  "success": true,
  "revalidation": {
    "purged": true,
    "attempts": 2,
    "paths": ["/", "/en", "/es"]
  }
}
```

### ISR Cache Key Format

cf-astro's middleware (`src/middleware.ts`) stores rendered HTML in KV using deploy-scoped keys:

```
isr:<BUILD_ID>:<pathname>
```

`__BUILD_ID__` is injected at build time as `Date.now().toString(36)`. This scopes cache entries per deployment, so old entries from previous deployments expire naturally without contaminating the new build's cache.

---

## 8. Configuration & Environment Constraints

### 🔴 Critical Deployment Requirement — REVALIDATION_SECRET

The `REVALIDATION_SECRET` must be set as a **production secret on BOTH Workers**.

```bash
# cf-admin (the sender)
wrangler secret put REVALIDATION_SECRET --name cf-admin-madagascar

# cf-astro (the receiver — verifies the Bearer token)
wrangler secret put REVALIDATION_SECRET --name cf-astro
```

Both secrets MUST have **identical values**. If cf-astro's secret is missing, `/api/revalidate` returns 500 and the ISR cache is **never purged**.

### 🔴 Critical — PUBLIC_ASTRO_URL Must Point to the Live Domain

`PUBLIC_ASTRO_URL` in **cf-admin's** `wrangler.toml` must point directly to the live cf-astro domain, not any subdomain that redirects to it.

```toml
# cf-admin/wrangler.toml [vars]
PUBLIC_ASTRO_URL = "https://madagascarhotelags.com"   # ✅ Correct
```

> ⚠️ **Common Mistake:** Using `https://pet.madagascarhotelags.com` (or any domain with a 301 Cloudflare Redirect Rule) causes `fetch()` to follow the redirect, which **downgrades POST to GET** per HTTP spec. The `/api/revalidate` endpoint only accepts POST, so it silently returns 405 and revalidation never happens. This was the root cause of all CMS sections not updating in production (fixed in v4.2).

The fallback value inside `revalidateAstro()` in `cf-admin/src/lib/cms.ts` is set to the same correct URL as a safety net.

### Binding Integrity Checklist (wrangler.toml)
1. **cf-admin:** Must have `DB` mapped to the shared D1 database, and `IMAGES` mapped to the shared R2 Bucket.
2. **cf-astro:** Must have `DB` mapped to the shared D1 database, `IMAGES` attached, and **crucially** `ISR_CACHE` targeted at the KV Namespace used for both ISR HTML caching and CMS data injection.

### RBAC — Upload Endpoint

The `POST /api/media/upload` endpoint accepts roles: `dev`, `owner`, `super_admin`, `admin`.

> Note: `owner` was added in v4.2. Previously `owner` was erroneously excluded, causing 403 errors when an Owner-role user attempted image uploads.

---

## 9. API Endpoints

### cf-admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/media/gallery` | Admin+ | Read `gallery_images` JSON from D1. |
| `POST` | `/api/media/gallery` | Admin+ | Push new image array to D1 + purge edge cache via KV injection pipeline. |
| `POST` | `/api/media/upload` | Admin+ | Upload image directly to R2, returning CDN URL. Injects `cms:hero_image` into KV for hero slot. |
| `POST` | `/api/media/revalidate` | Admin+ | Standalone retry sequence to force KV override in event of pipeline failure. |
| `GET` | `/api/content/services` | Admin+ | Read `services_pricing` JSON from D1. |
| `POST` | `/api/content/services` | Admin+ | Update services pricing in D1 + purge edge cache, injecting `cms:services_pricing` into KV. |
| `GET` | `/api/content/reviews` | Admin+ | Read `happy_clients` JSON from D1. |
| `POST` | `/api/content/reviews` | Admin+ | Update testimonials in D1 + purge edge cache, injecting `cms:happy_clients` into KV. |
| `POST` | `/api/content/blocks` | Admin+ | Bulk-update text CMS blocks in D1 + purge edge cache (no KV injection — text blocks have no lag risk). |

### cf-astro

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/media/[...path]` | None | Dev-only proxy simulating the R2 bucket. |
| `POST` | `/api/revalidate` | Bearer Token | Deletes all targeted `isr:*` path keys from `ISR_CACHE` KV + receives and maps real-time CMS states directly to `cms:*` KV keys to bypass D1 replica lag. |

---

## 10. Changelog

### v4.2 — 2026-04-14

**Bug Fixes:**

- **CRITICAL: Fixed `PUBLIC_ASTRO_URL` pointing to redirected domain.** `pet.madagascarhotelags.com` has a Cloudflare 301 Redirect Rule to `madagascarhotelags.com`. HTTP `fetch` with POST follows 301 redirects by downgrading to GET, causing every revalidation call to silently fail with 405. Changed to `https://madagascarhotelags.com` in both `wrangler.toml` and the hardcoded fallback in `cms.ts`. This was blocking all CMS updates from appearing on the live site.
- **Fixed `owner` role missing from `POST /api/media/upload` RBAC.** Owner-role users received 403 on image uploads. Now consistent with all other media endpoints.

**Enhancements — KV Injection Parity:**

Previously only the Gallery section had the 2-tier KV injection strategy implemented. The D1 replica lag trap affected Hero, Reviews, and Services: after an ISR cache purge, if the first render hit a stale D1 replica, the stale HTML would be locked into KV for 30 days.

- **`POST /api/media/upload`** (cf-admin): Now injects `{ 'hero_image': cdnUrl }` into the revalidation `cmsData` payload for the `hero_image` slot.
- **`POST /api/content/reviews`** (cf-admin): Now injects `{ 'happy_clients': JSON.stringify(reviews) }`.
- **`POST /api/content/services`** (cf-admin): Now injects `{ 'services_pricing': JSON.stringify(pricingData) }`.
- **`getImageUrl()`** (cf-astro `src/lib/images.ts`): Upgraded to accept an optional `kvCache` parameter; now checks `cms:<slotId>` in KV before falling back to D1. Signature: `getImageUrl(db, slotId, fallback, kvCache?)`.
- **`Hero.astro`** (cf-astro): Now passes `env.ISR_CACHE` to `getImageUrl()` to activate KV-first resolution.
- **`Testimonials.astro`** (cf-astro): Now checks `ISR_CACHE.get('cms:happy_clients')` before calling `getJsonBlock()` against D1.
- **`Services.astro`** (cf-astro): Now checks `ISR_CACHE.get('cms:services_pricing')` before calling `getJsonBlock()` against D1.

### v4.1 — 2026-04-13
Sync path fixes, revalidation secret alignment documentation.

### v4.0 — 2026-04-XX
Initial 2-tier KV injection strategy for Gallery. Resiliency engine with 3× exponential backoff. Retry Sync UI button in GalleryManager.

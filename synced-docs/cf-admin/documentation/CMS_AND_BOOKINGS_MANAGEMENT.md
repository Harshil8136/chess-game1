# CMS, Image & Bookings Management — Technical Documentation

> **Version:** 4.1 (Sync Path Fixes, Secret Alignment)
> **Last Updated:** 2026-04-13
> **Authors:** CMS Team  
> **Projects:** `cf-admin`, `cf-astro`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Booking Management (`/dashboard/bookings`)](#2-booking-management-dashboardbookings)
3. [Content Studio Hub (`/dashboard/content`)](#3-content-studio-hub-dashboardcontent)
4. [Preact Interactive Gallery UI](#4-preact-interactive-gallery-ui)
5. [Storage & CDN Flow](#5-storage--cdn-flow)
6. [Defense-in-Depth Sync Pipeline (cf-astro)](#6-defense-in-depth-sync-pipeline-cf-astro)
7. [ISR Revalidation & KV Cache Mapping](#7-isr-revalidation--kv-cache-mapping)
8. [Configuration & Environment Constraints](#8-configuration--environment-constraints)
9. [API Endpoints](#9-api-endpoints)

---

## 1. Architecture Overview

The system enables authorized admin users to manage structural content, visual assets, and booking workflows of `cf-astro` via a premium, lightning-fast dashboard (`cf-admin`) built entirely within Cloudflare's **$0 Free Tier**, while using Supabase for the Bookings engine.

**Core Stack:**
* **CMS Database:** Cloudflare D1
* **Bookings Database:** Supabase PostgreSQL
* **Asset Storage:** Cloudflare R2
* **Caching & Propagation:** Cloudflare KV (`ISR_CACHE`) & Edge Cache
* **Interactivity:** Preact + Native HTML5 Drag and Drop (`0kb` dependencies) 
* **Frontend:** Astro 6 + Vite

---

## 2. Booking Management (`/dashboard/bookings`)

The Booking Management interface is a Preact Island designed to provide real-time visibility into customer reservations pulled securely from the Supabase infrastructure layer.

### System Architecture
- **Data Source:** Supabase PostgreSQL (`bookings` and `booking_pets` tables).
- **Access Control:** RBAC gated. Only `admin`, `super_admin`, `owner`, and `dev` roles are permitted to access this module.
- **API Endpoint:** `/api/bookings/index.ts`
- **Component:** `src/components/admin/BookingList.tsx`

### Capabilities
- **Summary Dashboard Stats:** The main `/dashboard` features live Key Performance Indicators (KPIs) showing **Total Bookings** and **Total Pets** directly bound to the database.
- **Server-Side Pagination & Search:** The backend gracefully filters pet names and customer info prior to transit, reducing payload overhead.
- **Expandable Detail Row:** Each row expands inline via a collapsible UI, providing immediate context for medical, dietary, and behavioral notes without requiring navigation.

---

## 3. Content Studio Hub (`/dashboard/content`)

The Content Studio operates as the headless CMS interface over the **D1 Database**. Changes saved here dictate the content rendered on the global `cf-astro` application.

By moving away from hard-coded slots into highly flexible JSON-driven arrays mapped to D1, the module enables **infinite scaling** of assets without needing new SQL migrations.

### Key Components
- **`/dashboard/content/index.astro`** — The Hero Background manager (LCP critical).
- **`/dashboard/content/gallery.astro`** — The dynamic visual asset Drag-and-Drop manager.
- **`/dashboard/content/services.astro`** — Services & Pricing editor (synchronizes pricing across marketing pages and Preact Booking Wizard).
- **`/dashboard/content/reviews.astro`** — "Happy Clients" testimonials editor for the dynamic carousel.

### The Integration Health Bridge
Cross-project reliability is monitored via a localized heartbeat check on the dashboard.
- The `cf-admin` dashboard fetches `/api/health` from `PUBLIC_ASTRO_URL` upon load.
- A failure gracefully marks "cf-astro (Frontend)" as degraded, visually alerting the admin to a potential routing or deployment issue.

### Side-by-Side Live Preview
To provide immediate visual feedback, the Content Studio embeds an `iframe` of the `cf-astro` frontend utilizing the `?preview=true` parameter. Upon a successful D1 save, the API fires a cache invalidation webhook to cf-astro, and the iframe reloads with cache-busting timestamps (`v={Date.now()}`), instantly surfacing edits.

---

## 4. Preact Interactive Gallery UI

**File:** `cf-admin/src/components/admin/content/GalleryManager.tsx`

To mimic high-end interactivity while preserving strict performance budgets (under 5kb JS), the Gallery Editor relies entirely on **Preact** Islands (`client:load`).

**Key Features:**
* **Native HTML5 Drag and Drop:** Infinite resorting capabilities utilizing pure browser-native `draggable={true}`.
* **Instant R2 Pushing:** Local asset uploads instantly hit `/api/media/upload`, depositing images in the bucket and returning permanent CDN links.
* **Optimistic Saves:** Upon clicking `Push to Live Site`, the monolithic JSON array is persisted to D1, followed by a webhook firing to purge the global Edge Cache.
* **Robust UI Reflection (v4.0 Feature):** Gallery manager actively displays actionable diagnostics. If propagation fails, a localized `Retry Sync` fallback button is exposed, invoking the `/api/media/revalidate` endpoint.

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
6. User clicks 'Push', sending the JSON payload to `POST /api/media/gallery`, which writes to D1 and calls the ISR revalidation pipeline.

---

## 6. Defense-in-Depth Sync Pipeline (cf-astro)

A major hurdle historically was **D1 Read Replica Lag** where cf-admin would perform a write to the primary D1 node, but the subsequent ISR purge over at cf-astro would immediately read from a stale edge read-replica, causing cf-astro to indefinitely cache the old images post-update.

**Solution: The 2-Tier KV Injection Strategy (v4.0)**
Instead of relying on D1 for instant consistency post-save, `cf-admin` passes the fresh `cmsData` JSON payload verbatim to `cf-astro` *during the webhook payload*. 
- `cf-astro` receives the payload in `/api/revalidate.ts`.
- It dynamically assigns the JSON string natively to a designated KV subspace (`cms:gallery_images`).
- When cf-astro reconstructs its DOM, the `images.ts` provider checks **KV Layer first** for an immediate override state, falling back to D1 if the KV state is missing/expired.

This utterly bypasses the eventual consistency lag of the D1 read-replica architecture.

---

## 7. ISR Revalidation & KV Cache Mapping

All Studio API endpoints (Hero upload, Gallery save, Services save, Reviews save, and Text blocks save) trigger ISR cache purge via the **unified revalidateAstro() helper** in `src/lib/cms.ts`.

### Automatic Locale Path Expansion
The helper includes a built-in "Path Expansion Engine" that automatically generates locale variants:
- `['/']` → `['/', '/en', '/es']`
- `['/services']` → `['/services', '/en/services', '/es/services']`
*(Note: Passing pre-localized paths like `'/es/'` manually will cause double-expansion. Only root feature paths should be provided).*

### Resiliency Engine (v4.0)
If the webhook fails to resolve, the `revalidateAstro()` tool initiates a **3x Exponential Backoff Retry Sequence** before conceding. The underlying endpoints now resolve with robust structural details:
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

### Binding Integrity Checklist (wrangler.toml)
1. **cf-admin:** Must have `DB` mapped to the shared D1 database, and `IMAGES` mapped to the shared R2 Bucket.
2. **cf-astro:** Must have `DB` mapped to the shared D1 database, `IMAGES` attached, and **CRUCIALLY** `ISR_CACHE` targeted at the cache KV Namespace.

---

## 9. API Endpoints

### cf-admin 

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/media/gallery` | Admin+ | Read `gallery_images` json from D1. |
| `POST` | `/api/media/gallery` | Admin+ | Push new array to D1 `gallery_images` + Purge edge cache via KV Injection pipeline. |
| `POST` | `/api/media/upload` | Admin+ | Upload image direct to R2 returning CDN url link. |
| `POST` | `/api/media/revalidate`| Admin+ | Standalone isolated retry sequence to force KV overrides in event of pipeline failure. |

### cf-astro 

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/media/[...path]` | None | Dev-only proxy simulating the R2 bucket. |
| `POST` | `/api/revalidate` | Bearer Token | Deletes all targeted `isr:*` path keys from KV cache + receives and maps real-time UI states directly targeting `cms:*` KV strings to bypass D1 replica lags. |

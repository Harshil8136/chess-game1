# CMS, Image & Bookings Management

> **Version:** 4.6
> **Last Updated:** 2026-05-13 (FAQ + About/Stats CMS sections live; Media Library browser; KV resilience audit; Promise.allSettled fix)
> **Projects:** `cf-admin` (writes), `cf-astro` (reads)

---

## 1. Architecture Overview

cf-admin is the headless CMS for the Madagascar Hotel public site (cf-astro). All content changes flow from this portal.

**Core Stack:**
- **CMS Database:** Cloudflare D1 (`cms_content` table, shared with cf-astro)
- **Bookings Database:** Supabase PostgreSQL
- **Asset Storage:** Cloudflare R2 (`madagascar-images`, served via `cdn.madagascarhotelags.com`)
- **Caching & Propagation:** Cloudflare KV (`ISR_CACHE`) + ISR revalidation webhook
- **Interactivity:** Preact islands + Native HTML5 Drag & Drop (0 KB extra dependencies)

### KV Injection Coverage

All six CMS sections use the full 3-tier KV-first resolution strategy:

| Section | D1 id (page) | KV Key | Writer Endpoint | cf-astro Reader |
|---------|-------------|--------|-----------------|-----------------|
| Hero Image | `hero_image` (`home`) | `cms:hero_image` | `POST /api/media/upload` | `Hero.astro` |
| Gallery | `gallery_images` (`home`) | `cms:gallery_images` | `POST /api/media/gallery` | `Gallery.astro` |
| Services Pricing | `services_pricing` (`home`) | `cms:services_pricing` | `POST /api/content/services` | `Services.astro` via `pricing.ts` |
| Reviews | `happy_clients` (`global`) | `cms:happy_clients` | `POST /api/content/reviews` | `Testimonials.astro` |
| FAQ | `faq_items` (`global`) | `cms:faqs` | `POST /api/content/faqs` | `FAQ.astro` |
| About / Stats | `about_stats` (`global`) | `cms:about` | `POST /api/content/stats` | `About.astro` |

> **Key naming note (FAQ & About):** The D1 record `id` and the KV key differ by design — D1 uses descriptive ids (`faq_items`, `about_stats`) while KV uses short namespace keys (`faqs`, `about`). Both layers are correct; `revalidateAstro()` auto-prefixes KV keys with `cms:`. This is intentional and documented here to prevent confusion during debugging.

---

## 2. Booking Management

**Components:** `src/components/admin/bookings/BookingDashboard.tsx` (list + search) + `BookingSlideDrawer.tsx` (detail orchestrator)
**API:** `src/pages/api/bookings/index.ts`
**Data Source:** Supabase PostgreSQL (`bookings` + `booking_pets` tables)
**Access:** Admin+ (admin, super_admin, owner, dev)

**Features:**
- **Live KPIs** on the main dashboard — Total Bookings, Total Pets
- **Server-side pagination & search** — filters pet names and customer info before transit
- **Slide drawer** — `BookingSlideDrawer.tsx` orchestrates 5 section components (`BookingCustomerSection`, `BookingPetSection`, `BookingOperationsSection`, `BookingAuditSection`, `BookingDangerZoneSection`)
- **Atomic hard wipes** — DEV-only. Schema uses `ON DELETE CASCADE` on `email_audit_logs.booking_id`, so all trace data is destroyed atomically

> **Note:** `BookingList.tsx` was deleted during Phase 3 refactoring and replaced by the `BookingDashboard.tsx` + `BookingSlideDrawer.tsx` architecture.

---

## 3. Content Studio Hub (`/dashboard/content`)

Four modules, all backed by D1. Changes propagate to cf-astro via the ISR revalidation webhook + KV injection.

| Module | Route | Purpose |
|--------|-------|---------|
| Hero | `/dashboard/content` | Hero background image (LCP critical) |
| Gallery | `/dashboard/content/gallery` | Drag-and-drop visual asset manager |
| Services | `/dashboard/content/services` | Pricing editor — syncs marketing pages + booking wizard |
| Reviews | `/dashboard/content/reviews` | "Happy Clients" testimonials carousel |

**Integration Health Bridge:** The dashboard fetches `/api/health` from `PUBLIC_ASTRO_URL` on load. Failure marks cf-astro as degraded in the health bar.

**Live Preview:** Content Studio embeds an `iframe` of cf-astro. After a successful D1 save, the iframe reloads with `?v={Date.now()}` cache-busting, instantly surfacing changes.

---

## 4. Preact Gallery UI

**File:** `src/components/admin/content/GalleryManager.tsx`

- **Native HTML5 Drag & Drop** — pure `draggable={true}`, zero dependencies
- **Instant R2 Push** — uploads hit `POST /api/media/upload` with `slot: 'temp_gallery_upload'`, returning CDN URLs without touching D1
- **Optimistic save** — "Push to Live Site" persists the JSON array to D1, then fires KV-injection webhook to bypass D1 replica lag
- **Retry UI** — if propagation fails, a `Retry Sync` button is exposed, calling `POST /api/media/revalidate`

---

## 5. Storage & CDN Flow

- **CDN URL:** `https://cdn.madagascarhotelags.com` (R2 Custom Domain, Cloudflare-managed DNS)
- **Cache rule:** Cache-Everything page rule + CDN native edge caching
- **Key strategy:** UUID-based R2 keys per upload (`hero/hero-{uuid}.jpg`, `gallery/{uuid}.ext`) — CDN never serves stale replaced images
- **Cache-Control:** `public, max-age=31536000` (no `immutable` — allows manual CDN purges if needed)

**Upload flow:**
1. Image selected in GalleryManager → `POST /api/media/upload`
2. Validated: `image/jpeg,png,webp,avif`, ≤5MB
3. Stored as `gallery/{uuid}.ext` in R2
4. CDN URL injected into component state
5. User clicks "Push" → JSON payload written to D1 → ISR revalidation + KV injection

---

## 6. Defense-in-Depth Sync Pipeline — 3-Tier Cache Strategy

**The problem:** D1 read replica lag. cf-admin writes to the primary D1 node. If cf-astro immediately renders after a cache purge, it may hit a stale replica — locking that stale HTML into the cache.

**The solution (v4.5+):** cf-astro now uses a **3-Tier Defense-in-Depth** caching strategy. cf-admin passes the fresh `cmsData` payload to cf-astro *inside the webhook body*. cf-astro writes it directly to a `cms:*` KV key and then issues a Cloudflare API **Cache-Tag** purge.

On render, each CMS section resolves data in this order:

```
1. Cloudflare Tiered Cache   → Edge Layer (24hr TTL via s-maxage=86400, purged by Cache-Tag)
2. ISR_CACHE.get('cms:<key>')→ KV Layer (Fallback if Edge drops, prevents D1 replica lag)
3. getCmsContent(db)         → D1 Layer (Ultimate source of truth, may lag)
4. hardcoded fallback        → Static defaults
```

**cf-astro resolvers:**

| Section | Resolver | KV Key Read | Cache-Tag Purged |
|---------|----------|-------------|------------------|
| Hero | `getImageUrl(db, ...)` in `Hero.astro` | `cms:hero_image` | `page-/` |
| Gallery | `getGalleryImageUrls(db)` in `Gallery.astro` | `cms:gallery_images` | `page-/` |
| Services | KV-first block in `Services.astro` | `cms:services_pricing` | `page-/` |
| Reviews | KV-first block in `Testimonials.astro` | `cms:happy_clients` | `page-/` |

> **cf-astro requirement:** Target pages MUST have `export const prerender = false`. We rely entirely on `Cache-Control: public, s-maxage=86400, stale-while-revalidate=86400` headers injected by Astro middleware.

---

## 7. ISR Revalidation Helper

**File:** `cf-admin/src/lib/cms.ts`

```typescript
revalidateAstro(
  env: CfEnv,
  basePaths: string[],                    // root paths only — e.g. ['/'], ['/services']
  cmsData?: Record<string, string>,        // optional KV injection payload
  maxRetries = 3
): Promise<RevalidationResult>
```

**Path expansion:** Automatically generates locale variants.
- `['/']` → `['/', '/en', '/es']`
- `['/services']` → `['/services', '/en/services', '/es/services']`

> To add a new locale (e.g., French), update only the `SITE_LOCALES` array in `cms.ts`. No API route changes.

> ⚠️ Never pass pre-localized paths (e.g. `'/es/'`) — causes double-expansion.

**cmsData payloads per endpoint:**

| Endpoint | cmsData injected |
|----------|-----------------|
| `POST /api/media/upload` (hero slot) | `{ 'hero_image': cdnUrl }` |
| `POST /api/media/gallery` | `{ 'gallery_images': JSON.stringify(images) }` |
| `POST /api/media/revalidate` | `{ 'gallery_images': <current D1 value> }` |
| `POST /api/content/reviews` | `{ 'happy_clients': JSON.stringify(reviews) }` |
| `POST /api/content/services` | `{ 'services_pricing': JSON.stringify(pricingData) }` |
| `POST /api/content/blocks` | *(none — text blocks are purge-only, no lag risk)* |

**Resiliency:** 3× exponential backoff (300ms → 600ms → 900ms, 5s timeout per attempt) before conceding.

**ISR cache key format:** `isr:<BUILD_ID>:<pathname>` — scoped per deployment, so old entries expire naturally without contaminating new builds.

---

## 8. Configuration & Environment Constraints

### 🔴 REVALIDATION_SECRET — Must Match on Both Workers

```bash
wrangler secret put REVALIDATION_SECRET --name cf-admin-madagascar
wrangler secret put REVALIDATION_SECRET --name cf-astro  # or cf pages equivalent
```

Values must be **identical**. If cf-astro's secret is missing, `/api/revalidate` returns 500 and ISR cache is never purged.

### 🔴 PUBLIC_ASTRO_URL — Point to Live Domain, Not a Redirect

```toml
# cf-admin/wrangler.toml
PUBLIC_ASTRO_URL = "https://madagascarhotelags.com"   # ✅ correct
```

> `pet.madagascarhotelags.com` has a 301 Redirect Rule. HTTP `fetch` POST follows 301 redirects by downgrading to GET — causes silent 405 on `/api/revalidate`. This was the root cause of all CMS sections not updating in production (fixed v4.2).

### 🔴 Never Set PUBLIC_ASTRO_URL in `.dev.vars`

cf-admin local dev runs via pure Vite (no Miniflare). If `PUBLIC_ASTRO_URL` is in `.dev.vars`, it overrides the `wrangler.toml` value and all revalidation calls loop back to cf-admin's own CSRF protection → 403 Forbidden.

`cms.ts` has a hardcoded production fallback AND a self-reference guard that detects when `PUBLIC_ASTRO_URL` equals `SITE_URL` and fails immediately with a clear error.

### 🟡 Image Uploads Require `npm run cf:dev`

`npm run dev` (Vite-only, no Miniflare) has no R2 binding. Any upload attempt immediately returns:
> *"R2 IMAGES binding not available. Run `npm run cf:dev` instead."*

For CMS work involving uploads: `npm run cf:dev` (full Workers runtime with local R2 simulation).

---

## 9. API Endpoints

### cf-admin

| Method | Path | Auth | Description | Revalidation response field |
|--------|------|------|-------------|----------------------------|
| `GET` | `/api/media/gallery` | Admin+ | Read gallery_images from D1 | — |
| `POST` | `/api/media/gallery` | Admin+ | Write gallery array to D1 + KV injection | — |
| `POST` | `/api/media/upload` | Admin+ | Upload to R2, inject hero_image to KV | `revalidation.purged` |
| `POST` | `/api/media/revalidate` | Admin+ | Force KV injection retry | — |
| `GET` | `/api/media/library` | Admin+ | List all R2 assets (gallery/ + hero/ prefixes) | — |
| `DELETE` | `/api/media/library` | Owner/Dev | Delete R2 asset by key | — |
| `GET` | `/api/content/services` | Admin+ | Read services_pricing from D1 | — |
| `POST` | `/api/content/services` | Admin+ | Write pricing to D1 + KV injection | `revalidated` |
| `GET` | `/api/content/reviews` | Admin+ | Read happy_clients from D1 | — |
| `POST` | `/api/content/reviews` | Admin+ | Write testimonials to D1 + KV injection | `revalidated` + `message` |
| `GET` | `/api/content/faqs` | Admin+ | Read faq_items from D1 | — |
| `POST` | `/api/content/faqs` | Admin+ | Write bilingual FAQs to D1 + KV injection | `revalidated` + `message` |
| `GET` | `/api/content/stats` | Admin+ | Read about_stats from D1 | — |
| `POST` | `/api/content/stats` | Admin+ | Write homepage stats to D1 + KV injection | — |
| `POST` | `/api/content/blocks` | Admin+ | Update text blocks in D1 + purge (no KV inject) | — |

> **Revalidation response transparency:** Endpoints that include `revalidated` in their response let the admin UI distinguish between "saved to D1" and "edge cache also purged". A `revalidated: false` response means D1 has the new data but the KV/edge cache wasn't updated — the public site will serve the new content once the KV TTL expires (≤1 hour) via D1 fallback.

### cf-astro

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/media/[...path]` | None | Dev-only R2 proxy |
| `POST` | `/api/revalidate` | Bearer token | Delete `isr:*` keys from KV + write `cms:*` injection keys |

---

## 10. Cross-References

- **Binding IDs (D1/KV/R2 UUIDs)** → See [OPERATIONS.md](./OPERATIONS.md) §1
- **RBAC gates** → See [USER-MANAGEMENT.md](./USER-MANAGEMENT.md)
- **ISR_CACHE KV binding** → See [OPERATIONS.md](./OPERATIONS.md) §1 (KV Namespaces table)
- **KV quota limits, exhaustion behaviour & fallback chain** → See [KV-RESILIENCE.md](./KV-RESILIENCE.md)

---

## 11. Content Section Fallback Chain

Every CMS-driven section on cf-astro resolves data in exactly this order. The site **never crashes** regardless of which layers fail.

```
Request arrives at cf-astro
│
├─ Layer 1: ISR_CACHE.get('cms:<key>')          ← KV edge read (10M reads/day)
│  Hit → serve immediately, no D1 query
│  Miss or error → fall through (error is caught and logged, never thrown)
│
├─ Layer 2: D1 query (cms_content table)         ← always has latest data (written first)
│  Hit → serve, log source
│  Miss → fall through
│
└─ Layer 3: Hardcoded / i18n defaults            ← always succeeds
   Used on first deploy before any CMS content is saved
```

### Per-Section Fallback Details

| Section | KV Key | D1 id / page | Layer 3 Default |
|---------|--------|--------------|-----------------|
| Hero Image | `cms:hero_image` | `hero_image` / `home` | Hardcoded local image |
| Gallery | `cms:gallery_images` | `gallery_images` / `home` | Empty grid |
| Services | `cms:services_pricing` | `services_pricing` / `home` | Hardcoded pricing tiers |
| Testimonials | `cms:happy_clients` | `happy_clients` / `global` | i18n `Testimonials.items` (6 real reviews) |
| FAQ | `cms:faqs` | `faq_items` / `global` | i18n `FAQ.items` (5 static entries) |
| About Stats | `cms:about` | `about_stats` / `global` | Hardcoded: `30+` / `5000+` / `24/7` / `100%` |

### First-Deploy Behaviour

On a fresh production deploy with an empty D1, all sections fall to Layer 3. The site is fully functional with placeholder/i18n content. To activate CMS control:

1. Go to each admin editor page
2. Save content once → D1 is written, KV is injected, edge cache is purged
3. All subsequent renders are KV-first

---

## 12. KV Quota & Resilience

> Full deep-dive → [KV-RESILIENCE.md](./KV-RESILIENCE.md)

### Write Budget Per Publish

One content publish triggers `revalidateAstro()` which calls `POST /api/revalidate` on cf-astro. That endpoint performs:

- `n` ISR key deletes (one per cached path variant — typically 3: `/`, `/en`, `/es`)
- 1 CMS data write (`cms:<key>`)

**Total: ~4 KV write operations per publish.**

| Tier | Daily write limit | Publishes before limit |
|------|------------------|----------------------|
| Workers Free | 1,000 writes/day | ~250 publishes/day |
| Workers Paid ($5/mo) | ~33,000 writes/day (1M/month) | ~8,000 publishes/day |

A hotel CMS performing 250 content publishes in a single day is not a realistic scenario. **The limit is effectively not a concern in production.**

### What Happens If KV Writes Exhaust

```
Admin clicks Save
│
├─ D1 write ──── SUCCEEDS (always runs first, independently)
│
└─ revalidateAstro() → POST /api/revalidate → ISR_CACHE.put() THROWS
   │
   ├─ Promise.allSettled() catches per-promise failure (does NOT abort batch)
   ├─ Error logged to BetterStack
   ├─ All 3 retries in revalidateAstro() fail
   └─ Returns { success: false, message: "..." }
      │
      ├─ reviews.ts / faqs.ts → Response includes { revalidated: false, message: "..." }
      │  Admin sees: "Saved to database, but edge cache sync failed"
      └─ services.ts / upload.ts → Response includes { revalidated: false }
         Admin sees sync failure flag in UI
```

**Public site impact when KV writes are exhausted:**

| KV state | Public site behaviour |
|----------|-----------------------|
| KV key still warm (within 1hr TTL) | Serves **stale** KV content |
| KV key expired (TTL elapsed) | Falls to D1 → serves **correct** content |
| KV completely down (reads + writes) | Falls to D1 → serves correct content |
| D1 also down | Falls to hardcoded defaults → **site stays up** |

**Maximum stale window: 1 hour** (KV TTL on `cms:*` keys is `expirationTtl: 3600`).

### Bugs Fixed (2026-05-13)

| File | Bug | Fix |
|------|-----|-----|
| `cf-astro/api/revalidate.ts` | `Promise.all()` — one KV failure aborted entire batch | Changed to `Promise.allSettled()` with per-promise `.catch()` |
| `cf-admin/api/content/reviews.ts` | Revalidation failure silently swallowed → misleading HTTP 200 | Now returns `{ revalidated: bool, message: string }` |
| `cf-admin/api/content/faqs.ts` | Same as reviews.ts | Same fix |
| `cf-astro/api/revalidate.ts` | `happy_clients` and `hero_image` missing from KV allowlist | Added to `CMS_KEY_ALLOWLIST` |

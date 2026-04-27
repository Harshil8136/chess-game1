{% raw %}
# CMS, Image & Bookings Management

> **Version:** 4.2 (Full KV Injection Parity — Hero, Reviews, Services)
> **Last Updated:** 2026-04-14
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

All four CMS sections use the full 2-tier KV-first resolution strategy:

| Section | D1 Key | KV Key | Injected by |
|---------|--------|--------|-------------|
| Hero Image | `hero_image` (page: `home`) | `cms:hero_image` | `POST /api/media/upload` |
| Gallery | `gallery_images` (page: `home`) | `cms:gallery_images` | `POST /api/media/gallery` |
| Services Pricing | `services_pricing` (page: `home`) | `cms:services_pricing` | `POST /api/content/services` |
| Reviews | `happy_clients` (page: `global`) | `cms:happy_clients` | `POST /api/content/reviews` |

---

## 2. Booking Management

**Component:** `src/components/admin/BookingList.tsx`
**API:** `src/pages/api/bookings/index.ts`
**Data Source:** Supabase PostgreSQL (`bookings` + `booking_pets` tables)
**Access:** Admin+ (admin, super_admin, owner, dev)

**Features:**
- **Live KPIs** on the main dashboard — Total Bookings, Total Pets
- **Server-side pagination & search** — filters pet names and customer info before transit
- **Expandable detail rows** — medical, dietary, behavioral notes inline without navigation
- **Atomic hard wipes** — DEV-only. Schema uses `ON DELETE CASCADE` on `email_audit_logs.booking_id`, so all trace data is destroyed atomically

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

## 6. Defense-in-Depth Sync Pipeline — 2-Tier KV Strategy

**The problem:** D1 read replica lag. cf-admin writes to the primary D1 node. If cf-astro immediately renders after an ISR cache purge, it may hit a stale replica — locking that stale HTML into KV for 30 days.

**The solution (v4.0+):** cf-admin passes the fresh `cmsData` payload to cf-astro *inside the webhook body*. cf-astro writes it directly to a `cms:*` KV key. On render, each CMS section checks KV first:

```
1. ISR_CACHE.get('cms:<key>')    → KV Layer (1hr TTL, injected by cf-admin webhook)
2. getCmsContent(db, page, id)   → D1 Layer (source of truth, may lag)
3. hardcoded fallback            → Static defaults
```

**cf-astro resolvers:**

| Section | Resolver | KV Key Read |
|---------|----------|-------------|
| Hero | `getImageUrl(db, 'hero_image', fallback, ISR_CACHE)` in `Hero.astro` | `cms:hero_image` |
| Gallery | `getGalleryImageUrls(db, ISR_CACHE)` in `Gallery.astro` | `cms:gallery_images` |
| Services | KV-first block in `Services.astro` frontmatter | `cms:services_pricing` |
| Reviews | KV-first block in `Testimonials.astro` frontmatter | `cms:happy_clients` |

> **cf-astro requirement:** Target pages (e.g. `index.astro`) MUST have `export const prerender = false`. Without this, the ISR middleware never runs — the webhook succeeds but the site serves static files and never picks up the new data.

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

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/media/gallery` | Admin+ | Read gallery_images from D1 |
| `POST` | `/api/media/gallery` | Admin+ | Write gallery array to D1 + KV injection |
| `POST` | `/api/media/upload` | Admin+ | Upload to R2, inject hero_image to KV |
| `POST` | `/api/media/revalidate` | Admin+ | Force KV injection retry |
| `GET` | `/api/content/services` | Admin+ | Read services_pricing from D1 |
| `POST` | `/api/content/services` | Admin+ | Write pricing to D1 + KV injection |
| `GET` | `/api/content/reviews` | Admin+ | Read happy_clients from D1 |
| `POST` | `/api/content/reviews` | Admin+ | Write testimonials to D1 + KV injection |
| `POST` | `/api/content/blocks` | Admin+ | Update text blocks in D1 + purge (no KV inject) |

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

{% endraw %}

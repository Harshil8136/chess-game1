{% raw %}
# CMS Image Management Architecture

This document outlines the architecture, constraints, and operational behavior of the Madagascar Pet Hotel Image Pipeline, serving both the `cf-admin` dashboard and the public `cf-astro` site.

## 1. Overview
The image pipeline is designed to be highly resilient, extremely fast, and $0 cost using Cloudflare's ecosystem.
Instead of a rigid 1-6 slot model, the gallery uses a dynamic JSON array of unlimited images. 

### Key Components
- **Storage:** R2 Bucket (`madagascar-images`)
- **Optimization:** Cloudflare Image Transformations (`/cdn-cgi/image/`)
- **Persistence:** Cloudflare D1 (`cms_content` table)
- **Delivery Cache:** Cloudflare KV (`cf-astro-isr-cache`)
- **Sync Mechanism:** Revalidation Webhook (`/api/revalidate` on `cf-astro`)

---

## 2. Dynamic Array Gallery
The legacy system used hardcoded slots (`gallery_1` to `gallery_6`). This was refactored to an unbounded JSON array stored in D1.

- **Data Structure:** The gallery payload is a single stringified JSON array of image URLs.
- **Ordering:** The array inherently preserves order, supporting drag-and-drop reordering in the admin panel.
- **Validation:** The `GalleryManager` explicitly blocks persisting temporary `blob:` or `data:` URIs, ensuring only valid CDN links are saved.

---

## 3. Cloudflare Image Transformations
To eliminate CLS (Cumulative Layout Shift), optimize bandwidth, and deliver next-gen formats (WebP/AVIF), we utilize Cloudflare Image Transformations.

All image URLs rendered on the frontend are wrapped in a transformer utility (`transformImageUrl` in `src/lib/images.ts`).

### Transformation Presets
- `hero`: Large background images (e.g., width 1920, optimized for LCP)
- `gallery`: Carousel items (e.g., width 800)
- `lightbox`: Full-screen modal items (e.g., width 1600)
- `thumbnail`: Admin panel thumbnails (e.g., width 300)

**Important:** Transformations must be enabled in the Cloudflare Dashboard for the zone.

---

## 4. Resilience and Fallbacks

### Frontend Fallbacks
If a transformed image fails to load (e.g., 404 or temporary CDN issue):
1. **Fallback 1:** The `transformImageUrl` utility allows reverting to the raw origin URL.
2. **Fallback 2:** React/Preact components utilize `onError` handlers to gracefully hide broken images or show a placeholder, preventing broken UI states.

### KV Cache Durability
The `cf-astro-isr-cache` KV namespace stores the rendered HTML and data.
- **TTL:** Increased to **7 days**.
- **Reason:** Protects against premature cache eviction. In the event of a D1 read-replica lag or temporary downtime, the site remains fully operational for a week based on the last known good state.

---

## 5. Security Guardrails

### Revalidation Secret
The `REVALIDATION_SECRET` ensures that only authorized calls from `cf-admin` can trigger an ISR cache purge on `cf-astro`.
If this secret is missing or mismatched:
- The `/api/revalidate` endpoint will return a 500 error.
- The `cf-astro` site will continue serving stale (cached) content until the TTL expires.

### Blob/Data URI Rejection
To prevent temporary browser state from corrupting the database, the API endpoint (`/api/media/gallery.ts`) performs strict regex validation, rejecting any payload containing `blob:` or `data:` URLs.

---

## 6. Deployment Checklist
When deploying or updating the image pipeline:
1. Ensure Cloudflare Image Transformations are **enabled** in the Cloudflare Dashboard for the zone.
2. Ensure the R2 bucket (`madagascar-images`) is correctly bound in `wrangler.toml`.
3. Ensure `REVALIDATION_SECRET` is set on both the `cf-admin` and `cf-astro` Workers.
4. Test a full upload cycle: Upload Image -> Save Changes -> Verify Webhook Success -> Verify `cdn-cgi` Transform on Frontend.
5. **⚠ BINDING IDS:** Verify ALL D1/KV binding IDs in `wrangler.toml` match the real Cloudflare resources. See [`cloudflare-bindings-registry.md`](./cloudflare-bindings-registry.md) for the canonical verified IDs and `curl` verification commands. A mismatch caused a full CMS pipeline outage in April 2026.


### Key Files

| File | Project | Purpose |
|------|---------|----------|
| `src/lib/cms.ts` | cf-admin | Upload to R2, write D1, **unified revalidation helper** |
| `src/pages/api/media/upload.ts` | cf-admin | Image upload API endpoint |
| `src/pages/api/media/gallery.ts` | cf-admin | Gallery JSON array CRUD + revalidation |
| `src/pages/api/content/blocks.ts` | cf-admin | Text block CMS updates + revalidation |
| `src/pages/api/content/services.ts` | cf-admin | Services/pricing JSON updates + revalidation |
| `src/pages/api/content/reviews.ts` | cf-admin | Happy clients reviews JSON + revalidation |
| `src/pages/dashboard/content/` | cf-admin | Content Studio UI (Hero, Gallery, Services, Reviews tabs) |
| `src/lib/images.ts` | cf-astro | Dynamic image URL resolver |
| `src/components/sections/Hero.astro` | cf-astro | Dynamic hero background |
| `src/components/sections/Gallery.astro` | cf-astro | Dynamic gallery carousel |
| `src/pages/api/revalidate.ts` | cf-astro | ISR cache purge webhook (receives calls from cf-admin) |

### ⚠️ Critical Deployment Rules (DO NOT SKIP)

1. **`REVALIDATION_SECRET` must be deployed on BOTH Workers.** The secret is the shared key that authenticates the revalidation webhook from cf-admin to cf-astro. If missing from cf-astro, the `/api/revalidate` endpoint returns 500, revalidation silently fails, and the live site serves stale HTML indefinitely.
   ```bash
   wrangler secret put REVALIDATION_SECRET --name cf-admin-madagascar  # sender
   wrangler secret put REVALIDATION_SECRET --name cf-astro              # receiver
   ```

2. **Image Transformations must be ENABLED in Cloudflare Dashboard.** Without this feature enabled for the zone, the /cdn-cgi/image/ requests will result in 404 or 403 errors. Free tier supports 5,000 unique transformations/month.

> 📖 **Full documentation:** [`documentation/CMS_IMAGE_MANAGEMENT.md`](./documentation/CMS_IMAGE_MANAGEMENT.md)

---

{% endraw %}

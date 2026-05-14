{% raw %}
# CMS Integration — cf-astro Reader Side

> **Version:** 1.0
> **Last Updated:** 2026-05-13
> **Counterpart:** `cf-admin/Documentation/CMS.md` (writer side)
> **Deep-dive on resilience:** `cf-admin/Documentation/KV-RESILIENCE.md`

---

## 1. How cf-astro Consumes CMS Data

cf-astro is a **read-only** consumer of CMS content. It never writes to D1 or KV directly (except via the `/api/revalidate` webhook which is called by cf-admin). All section components resolve data in the same 3-tier order:

```
1. ISR_CACHE KV  →  cms:<key>         (fastest, injected at publish time, 1hr TTL)
2. D1 Database   →  cms_content table  (authoritative, always has latest data)
3. Hardcoded     →  i18n / defaults    (never fails, site always renders)
```

Every KV and D1 read is wrapped in `try/catch`. A failure at any layer silently falls through to the next. **The site cannot crash due to a CMS failure.**

---

## 2. Section-by-Section Integration

### Hero Image — `src/components/sections/Hero.astro`

| Layer | Lookup |
|-------|--------|
| KV | `ISR_CACHE.get('cms:hero_image')` via `getImageUrl()` in `src/lib/images.ts` |
| D1 | `cms_content WHERE id='hero_image' AND page='home'` |
| Default | Local bundled fallback image |

Written by: `cf-admin POST /api/media/upload` (slot: `hero_image`)

---

### Gallery — `src/components/sections/Gallery.astro`

| Layer | Lookup |
|-------|--------|
| KV | `ISR_CACHE.get('cms:gallery_images')` |
| D1 | `getJsonBlock(db, 'home', 'gallery_images')` |
| Default | Empty grid (no images shown) |

Written by: `cf-admin POST /api/media/gallery`

---

### Services / Pricing — `src/components/sections/Services.astro` via `src/lib/pricing.ts`

| Layer | Lookup |
|-------|--------|
| KV | `ISR_CACHE.get('cms:services_pricing')` |
| D1 | `getJsonBlock(db, 'home', 'services_pricing')` |
| Default | Hardcoded pricing tiers (defined in `pricing.ts`) |

Written by: `cf-admin POST /api/content/services`

---

### Testimonials — `src/components/sections/Testimonials.astro`

| Layer | Lookup |
|-------|--------|
| KV | `ISR_CACHE.get('cms:happy_clients')` |
| D1 | `getJsonBlock(db, 'global', 'happy_clients')` |
| Default | `messages.Testimonials.items` from `i18n/translations/en.json` (6 real reviews pre-loaded) |

Written by: `cf-admin POST /api/content/reviews`

**Note:** The i18n fallback already contains real customer reviews, so the testimonials section looks correct on first deploy with no CMS content saved.

---

### FAQ — `src/components/sections/FAQ.astro`

| Layer | Lookup |
|-------|--------|
| KV | `ISR_CACHE.get('cms:faqs')` |
| D1 | `getJsonBlock(db, 'global', 'faq_items')` |
| Default | `messages.FAQ.items` from i18n (5 static entries in EN + ES) |

Written by: `cf-admin POST /api/content/faqs`

**Bilingual:** CMS FAQ items carry `question_en`, `answer_en`, `question_es`, `answer_es`. The component picks the correct pair based on `locale`. The i18n fallback is also locale-aware.

---

### About / Stats — `src/components/sections/About.astro`

| Layer | Lookup |
|-------|--------|
| KV | `ISR_CACHE.get('cms:about')` — parsed as `StatItem[]` |
| D1 | `cms_content WHERE id='about_stats' AND page='global'` |
| Default | Hardcoded: `30+` years / `5000+` pets / `24/7` care / `100%` satisfaction |

Written by: `cf-admin POST /api/content/stats`

**StatItem schema:** `{ key: string, value: string }` where key is one of `yearsExperience`, `happyPets`, `careAvailable`, `satisfaction`.

---

## 3. The Revalidation Endpoint — `src/pages/api/revalidate.ts`

This is the only endpoint in cf-astro that receives writes. It is called exclusively by cf-admin's `revalidateAstro()` helper.

### What it does

1. Verifies `Authorization: Bearer <REVALIDATION_SECRET>`
2. Deletes all `isr:<path>#*` KV keys matching the provided paths (purges page HTML cache)
3. Writes `cms:<key>` KV entries with `expirationTtl: 3600` (fresh CMS data injection)
4. Purges Cloudflare edge cache via Cache-Tag API (`page-<path>`)
5. Pings IndexNow (Bing/Yandex SEO) via `waitUntil`

### KV write resilience

Each operation runs independently via `Promise.allSettled()`. A single failed delete or write does not abort the rest of the batch. All failures are logged to BetterStack.

### CMS key allowlist

Only keys in `CMS_KEY_ALLOWLIST` are accepted for KV injection:

```
hero, hero_image, services, services_pricing, pricing,
gallery, gallery_images, testimonials, happy_clients,
faqs, faq_draft, about, contact, franchise,
blog_index, seo_home, seo_services, seo_booking
```

Plus `blog_draft_[a-z0-9_-]+` prefix pattern.

---

## 4. Shared Bindings

Both cf-admin and cf-astro connect to the same infrastructure:

| Resource | Binding name | ID / Name |
|----------|-------------|-----------|
| D1 Database | `DB` | `7fca2a07-d7b4-449d-b446-408f9187d3ca` (`madagascar-db`) |
| R2 Bucket | `IMAGES` | `madagascar-images` |
| KV Namespace | `ISR_CACHE` (cf-astro only) | `d9cea8c7e20f4b328b8cb3b04104138c` |

cf-admin does **not** have a direct `ISR_CACHE` binding. It writes to KV indirectly by calling `POST /api/revalidate` on cf-astro.

---

## 5. First-Deploy Checklist

After deploying both projects to production for the first time:

- [ ] Verify `REVALIDATION_SECRET` matches on both workers (`wrangler secret list`)
- [ ] Verify `PUBLIC_ASTRO_URL` in cf-admin points to `https://madagascarhotelags.com` (not the admin URL)
- [ ] Open cf-admin → `/dashboard/content/reviews` → save real testimonials → Publish
- [ ] Open cf-admin → `/dashboard/content/faq` → add FAQ items → Save
- [ ] Open cf-admin → `/dashboard/content/about` → verify stats → Save Metrics
- [ ] Open cf-admin → `/dashboard/content` → upload hero image
- [ ] Check public site sections render CMS content (not i18n defaults)

Until those saves happen, the public site shows i18n/hardcoded defaults — it is functional but not CMS-driven.

---

## 6. getJsonBlock Utility — `src/lib/cms.ts`

```typescript
export async function getJsonBlock<T = unknown>(
  db: D1Database,
  page: string,
  id: string
): Promise<T | null>
```

Generic helper used by FAQ.astro, Services pricing.ts, and others. Reads `cms_content WHERE id=? AND page=?`, parses JSON, returns typed result or `null` on any failure.

---

## 7. Cross-References

- **Writer-side CMS docs** → `cf-admin/Documentation/CMS.md`
- **KV quota & failure scenarios** → `cf-admin/Documentation/KV-RESILIENCE.md`
- **ISR_CACHE KV namespace ID** → `cf-admin/Documentation/OPERATIONS.md` §1
- **Revalidation secret setup** → `cf-admin/Documentation/CMS.md` §8

{% endraw %}

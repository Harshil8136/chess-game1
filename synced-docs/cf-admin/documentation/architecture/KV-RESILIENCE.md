---

title: "KV Resilience & Fallback Chain"
status: active
audience: [ai, technical]
last_verified: 2026-06-06
verified_against: [code]
owner: harshil
tags: []
---

# KV Resilience & Fallback Chain

> **TL;DR (non-technical):** How the portal stays fast and stays up when Cloudflare KV (its high-speed cache) is slow or hits free-tier write limits. Describes the caching strategy and the fail-safe fallbacks so the dashboard never breaks.

> **Version:** 1.0
> **Last Updated:** 2026-05-13
> **Projects:** `cf-admin` (writer), `cf-astro` (reader)
> **Namespace:** `ISR_CACHE` — ID `d9cea8c7e20f4b328b8cb3b04104138c`

---

## 1. What Uses ISR_CACHE KV

The `ISR_CACHE` KV namespace serves two distinct purposes:

| Key pattern | Purpose | Written by | Read by | TTL |
|-------------|---------|-----------|---------|-----|
| `isr:<path>#<buildId>` | Full rendered HTML page cache | cf-astro middleware (on render) | cf-astro middleware | Set per-page, typically 24h |
| `cms:<key>` | Fresh CMS data injected at publish time | `cf-astro/api/revalidate` (called by cf-admin) | Each `.astro` section component | 3600s (1 hour) |

These are separate concerns. A `cms:*` write failure does not affect ISR page cache behaviour, and vice versa.

---

## 2. KV Quota Facts

Cloudflare KV limits (as of 2026):

| Operation | Free tier | Paid (Workers Bundled $5/mo) |
|-----------|-----------|------------------------------|
| Reads | 10,000,000 / day | 10,000,000 / day (then $0.50/M) |
| Writes | 1,000 / day | ~33,000 / day (1M/month included) |
| Deletes | counted as writes | counted as writes |
| Storage | 1 GB | 1 GB (then $0.50/GB-month) |

### Writes per CMS Publish

One admin content publish calls `revalidateAstro()` → `POST cf-astro/api/revalidate`. That endpoint:

1. Lists and deletes ISR keys with prefix `isr:<path>#` for each expanded path
   - Base paths like `['/']` expand to `['/', '/en', '/es']` → up to 3 delete operations (more if cached build variants exist)
2. Writes 1 `cms:<key>` entry per CMS data payload

**Approximate total: 4 KV write operations per publish.**

| Tier | Daily budget | Required publishes to exhaust |
|------|-------------|-------------------------------|
| Free | 1,000 | **~250 publishes/day** |
| Paid | ~33,000 | ~8,000 publishes/day |

For a hotel CMS, 250 publishes in one day is not a realistic scenario. The quota is effectively unlimited for this use case.

---

## 3. Full Failure Cascade

### 3a. KV Writes Exhaust or KV Write Endpoint Fails

```
Admin clicks "Save" (e.g. reviews, faqs, stats, hero upload)
│
│  STEP 1 — D1 Write (always first, independent)
├─ db.prepare(INSERT ... ON CONFLICT DO UPDATE).run()
│  → Succeeds. D1 now has the authoritative new data.
│
│  STEP 2 — Edge Revalidation
└─ revalidateAstro(env, ['/'], { '<key>': JSON.stringify(data) })
   │
   │  Attempt 1 of 3: POST https://madagascarhotelags.com/api/revalidate
   │  → cf-astro endpoint runs Promise.allSettled([
   │       ISR_CACHE.delete('isr:/...'),   ← may throw if quota exhausted
   │       ISR_CACHE.delete('isr:/en...'), ← each failure caught individually
   │       ISR_CACHE.delete('isr:/es...'), ← does NOT abort remaining ops
   │       ISR_CACHE.put('cms:<key>', ...) ← may throw if quota exhausted
   │    ])
   │  → If all put/delete fail: endpoint returns HTTP 500
   │
   │  Attempt 2 (300ms later): same, fails again
   │  Attempt 3 (600ms later): same, fails again
   │
   └─ revalidateAstro() returns { success: false, message: "Failed after 3 attempts..." }
      │
      ├─ Sentry alert fired (cms.ts line ~305)
      │
      └─ Calling endpoint response:
         reviews.ts → { success: true, revalidated: false, message: "Reviews saved to database, but edge cache sync failed: ..." }
         faqs.ts    → { success: true, revalidated: false, message: "FAQs saved to database, but edge cache sync failed: ..." }
         services.ts → { ..., revalidated: false }
         upload.ts  → { ..., revalidation: { purged: false, message: "..." } }
```

**Admin experience:** HTTP 200 with a visible `revalidated: false` flag and human-readable message. The admin knows D1 was saved but the edge cache wasn't purged.

### 3b. Public Site Resolution When KV Is Degraded

```
User visits https://madagascarhotelags.com/
│
│  Layer 1: ISR page cache (isr:* keys)
├─ If page cache key exists in KV → serve cached HTML instantly
│  (This cache may be stale if ISR delete failed)
│
│  Layer 1b: If no page cache → render fresh
│
│  During fresh render, each section resolves independently:
│
│  ┌─ Testimonials.astro
│  │  1. ISR_CACHE.get('cms:happy_clients') → try/catch, miss or error → fall through
│  │  2. getJsonBlock(db, 'global', 'happy_clients') → D1 has latest data ✅
│  │  3. Hardcoded i18n Testimonials.items (6 real reviews) ← never reached if D1 ok
│  │
│  ├─ FAQ.astro
│  │  1. ISR_CACHE.get('cms:faqs') → miss → fall through
│  │  2. getJsonBlock(db, 'global', 'faq_items') → D1 has latest data ✅
│  │  3. i18n FAQ.items (5 static entries) ← fallback of last resort
│  │
│  ├─ About.astro
│  │  1. ISR_CACHE.get('cms:about') → miss → fall through
│  │  2. db.prepare('SELECT content FROM cms_content WHERE id=? AND page=?').bind('about_stats','global') → D1 ✅
│  │  3. Hardcoded: 30+ / 5000+ / 24/7 / 100%
│  │
│  ├─ Services.astro (via pricing.ts)
│  │  1. ISR_CACHE.get('cms:services_pricing') → miss → fall through
│  │  2. getJsonBlock(db, 'home', 'services_pricing') → D1 ✅
│  │  3. Hardcoded pricing tiers
│  │
│  └─ Hero.astro
│     1. getImageUrl(db, 'hero_image', fallback, ISR_CACHE) → KV → D1 → local fallback
```

**Result: The site always renders correct content.** D1 is written before revalidation is attempted, so it is always the source of truth. KV is only a performance optimization (avoid D1 query on render).

### 3c. Worst Case: Both KV and D1 Are Down

```
ISR_CACHE.get() throws → caught, logged
D1 query throws → outer try/catch catches, logs
Component falls through to hardcoded defaults
Page renders with placeholder/i18n content
HTTP 200 returned — site does NOT crash
```

---

## 4. Maximum Stale Window

If a CMS publish fails to update KV (writes exhausted, network error, etc.):

- The **old** `cms:*` KV value remains until its TTL expires
- `cms:*` keys have `expirationTtl: 3600` (1 hour)
- After expiry, the next render misses KV → reads D1 → serves correct content
- **Maximum stale window: 1 hour**

ISR page cache (`isr:*` keys) may also be stale if the delete operations failed:

- ISR page cache TTL depends on `Cache-Control: s-maxage` headers
- cf-astro injects `s-maxage=86400` (24 hours) on SSR pages
- Stale HTML could persist up to 24 hours if ISR delete AND Cloudflare Cache-Tag purge both fail
- The Cache-Tag purge (via Cloudflare API) is independent of KV — it can succeed even if KV writes fail

---

## 5. The Promise.allSettled Fix

**Before (bug):** `revalidate.ts` used `Promise.all(promises)` with no per-promise `.catch()`.

```typescript
// BEFORE — one KV failure aborts ALL remaining operations
await Promise.all(promises);
```

If `ISR_CACHE.delete('isr:/en#...')` threw, `Promise.all` rejected immediately. The remaining deletes and the `cms:*` write were all abandoned. This meant a partial KV state: some ISR paths purged, others not, and CMS data not injected.

**After (fix):** Each promise has its own `.catch()`, and the batch uses `Promise.allSettled()`.

```typescript
// AFTER — each operation is independent; failures are logged, rest of batch continues
promises.push(
  ISR_CACHE.delete(keyObj.name)
    .then(() => { log.info('Deleted ISR key', { key: keyObj.name }); })
    .catch((err) => { log.error('Failed to delete ISR key', { key: keyObj.name, error: err }); })
);
// ...
await Promise.allSettled(promises);
```

This ensures:

- A single delete failure doesn't block the CMS data write
- All operations that can succeed do succeed
- All failures are individually logged to BetterStack

---

## 6. KV Allowlist — Complete List

`cf-astro/src/pages/api/revalidate.ts` validates every incoming CMS key against an allowlist before writing to KV. This prevents arbitrary cache injection if the `REVALIDATION_SECRET` is ever compromised.

```typescript
const CMS_KEY_ALLOWLIST = new Set([
  'hero', 'hero_image',                    // Hero section
  'services', 'services_pricing',          // Services/pricing section
  'pricing',                               // Legacy alias
  'gallery', 'gallery_images',             // Gallery section
  'testimonials', 'happy_clients',         // Testimonials/reviews section
  'faqs', 'faq_draft',                     // FAQ section
  'about',                                 // About/stats section
  'contact', 'franchise',                  // Other pages
  'blog_index',                            // Blog listing
  'seo_home', 'seo_services', 'seo_booking', // SEO overrides
]);
// Also accepts: blog_draft_[a-z0-9_-]+ (regex pattern)
```

Any key not in this list is rejected with a `log.warn` and silently skipped. The endpoint still returns 200 for the allowed keys in the same request.

---

## 7. Monitoring & Alerting

| Event | Where it's logged |
|-------|------------------|
| KV write failure in revalidate.ts | BetterStack via `log.error` |
| All 3 revalidation retries exhausted | Sentry via `captureMessage` (cms.ts) + BetterStack |
| Rejected disallowed CMS key | BetterStack via `log.warn` |
| Successful CMS key write | BetterStack via `log.info` |
| Admin endpoint revalidation failure | HTTP response body `{ revalidated: false, message }` |

To check current KV namespace status: Cloudflare Dashboard → Workers & Pages → KV → `ISR_CACHE`.

---

## 8. Cross-References

- **CMS architecture overview** → [CMS.md](../features/CMS.md)
- **ISR_CACHE binding ID** → [OPERATIONS.md](../operations/OPERATIONS.md) §1
- **Revalidation secret config** → [CMS.md §8](../features/CMS.md#8-configuration--environment-constraints)
- **cf-astro revalidate endpoint** → `cf-astro/src/pages/api/revalidate.ts`
- **revalidateAstro() helper** → `cf-admin/src/lib/cms.ts` — `revalidateAstro()`

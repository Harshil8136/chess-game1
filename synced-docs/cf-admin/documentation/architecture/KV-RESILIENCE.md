---

title: "KV Resilience & Fallback Chain"
status: active
audience: [ai, technical]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/cms/revalidate.ts, src/lib/cms-status.ts, src/lib/sync-outbox.ts, src/workers/sync-revalidate-consumer.ts]
related_docs: [../features/CMS.md, ../operations/OPERATIONS.md, GLOBAL-CONFIG.md]
tags: [architecture, kv, cms, isr, resilience, cache]
---

# KV Resilience & Fallback Chain

> **TL;DR (non-technical):** How the public site stays correct when Cloudflare KV
> (its high-speed cache) is slow or hits free-tier write limits. Describes the
> caching strategy and the fail-safe fallbacks so the site never shows the wrong
> thing.

> **Scope:** the `ISR_CACHE` namespace, which is the **cf-astro** edge cache for
> rendered pages and CMS blocks. cf-admin *triggers* revalidation; it has no
> `ISR_CACHE` binding — its only KV binding is `SESSION`. *Corrected 2026-09-19:
> the header here read "`cf-admin` (writer), `cf-astro` (reader)", which is
> backwards and contradicted this document's own §1 table.*
>
> cf-admin's own session KV is **out of scope** and is covered by
> [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §13–§14. One consequence worth
> stating here, because the title promises it: when the account's KV write quota is
> exhausted, `createSession` rethrows and **sign-in fails**. The 1,000 writes/day
> budget is account-wide, so the publish traffic described below and the portal's
> sessions compete for the same allowance.

---

## 1. What Uses ISR_CACHE KV

The `ISR_CACHE` KV namespace serves two distinct purposes:

| Key pattern | Purpose | Written by | Read by | TTL |
|-------------|---------|-----------|---------|-----|
| `isr:<path>#<buildId>` | Full rendered HTML page cache | cf-astro middleware (on render) | cf-astro middleware | Set per-page, typically 24h |
| `cms:<key>` | Fresh CMS data injected at publish time | `cf-astro/api/revalidate` (called by cf-admin) | Each `.astro` section component | 3600s (1 hour) |

These are separate concerns. A `cms:*` write failure does not affect ISR page cache behaviour, and vice versa.

---

## 2. KV quota facts

**Owned by [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §3.2.**

> *Corrected 2026-09-19.* The table that stood here was wrong in three ways that
> matter for the arithmetic below: it gave the **free** read allowance as
> 10,000,000/day (it is **100,000/day** — 10 M is the *paid monthly* figure), it
> said deletes are "counted as writes" (deletes and lists each have their **own**
> quota), and it named the paid tier "Workers Bundled", a plan name Cloudflare
> retired. It also contradicted the owner document and
> [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §13.3, which both say 100,000.

The two facts this document depends on: **writes are 1,000/day on the free plan**,
and **every KV quota is account-wide**, shared between cf-astro's `ISR_CACHE` and
cf-admin's `SESSION`.

### Operations per CMS publish

One admin content publish calls `revalidateAstro()` → `POST /api/revalidate` on
cf-astro. That endpoint:

1. **Lists** ISR keys with prefix `isr:<path>#` for each expanded path — one *list*
   operation per path. Base paths like `['/']` expand to `['/', '/en', '/es']`.
2. **Deletes** each key it found — one *delete* operation each, three or more.
3. **Writes** one `cms:<key>` entry per CMS data payload — one *put* each.

*Corrected 2026-09-19: the old summary, "approximately 4 KV write operations per
publish … the quota is effectively unlimited for this use case", conflated three
separately-metered operation types into one and then budgeted against the write
quota alone.* Stated per quota, a publish costs roughly: **1 write** per CMS key,
**3+ deletes**, **1 list** per path.

The write quota is therefore not what a publish burns through first — but it is the
one shared with session creation, and it is the one that fails sign-in when it runs
out. "Effectively unlimited" is the wrong frame: a hotel CMS will not publish 250
times a day, but the 1,000 writes are spent mostly elsewhere, on cf-admin sessions
and on cf-astro's rate-limit fallback, which writes one KV key per booking and per
consent POST. See [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §13.3 for the
combined budget.

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
   │  Attempt 1 of 3, 5s timeout: POST /api/revalidate
   │    · via the ASTRO_SERVICE binding (https://internal/api/revalidate)
   │      — Worker to Worker, no public round trip
   │    · public URL only as the fallback when the binding is absent
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
   └─ revalidateAstroOnce() returns { success: false, message: "Failed after 3 attempts..." }
      │
      ├─ THE PUBLISH IS NOT DROPPED (Phase 1.1):
      │    · persisted to D1 sync_outbox (src/lib/sync-outbox.ts)
      │    · a redrive job is enqueued on SYNC_QUEUE
      │    · src/workers/sync-revalidate-consumer.ts retries it, or the job
      │      lands visibly in the dead-letter state
      │    · skipped only when attempts === 0 (dev bypass / missing secret),
      │      where a redrive in the same environment would fail identically
      │
      ├─ Sentry: captureMessage("[CMS Sync Error] Edge purge failed —
      │    queued for redrive", level: warning) from src/lib/cms/revalidate.ts
      │
      └─ Calling endpoint response:
         reviews.ts → { success: true, revalidated: false, message: "Reviews saved to database, but edge cache sync failed: ..." }
         faqs.ts    → { success: true, revalidated: false, message: "FAQs saved to database, but edge cache sync failed: ..." }
         services.ts → { ..., revalidated: false }
         upload.ts  → { ..., revalidation: { purged: false, message: "..." } }
```

**Admin experience:** HTTP 200 with a visible `revalidated: false` flag and
human-readable message. The admin knows D1 was saved but the edge cache was not
purged *on this attempt*; the queued redrive may still succeed afterwards.

*Corrected 2026-09-19: this cascade ended at "returns success: false" and a Sentry
alert attributed to a `cms.ts` that does not exist. The durable outbox and the
`SYNC_QUEUE` redrive were added before this document's own 2026-09-14
re-verification, which noted the changed Sentry message in §9 while leaving the
body describing the old flow.*

**On success**, `revalidateAstro` also reads the published bytes back from cf-astro
(`verifyCmsLive`, `src/lib/cms-status.ts`) to confirm the keys are actually live
rather than merely that the webhook returned 200. That check is best-effort: a
verification failure annotates the result and never flips a successful publish to a
failure.

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
│  │  2. getJsonBlock(db, 'global', 'about_stats') → D1 ✅
│  │     (via cf-astro/src/lib/about-stats.ts, not inline SQL —
│  │      corrected 2026-09-19; Testimonials likewise goes through
│  │      cf-astro/src/lib/testimonials.ts)
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
- **Upper bound on the `cms:*` stale window: 1 hour**

*Qualified 2026-09-19: TTL is the **ceiling**, not the expected case. Since the
durable outbox shipped, an exhausted publish is retried by the `SYNC_QUEUE`
consumer, so the realistic stale window is bounded by the redrive — typically far
shorter than an hour — and the TTL is the backstop for a redrive that also fails.*

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

`cf-astro/src/pages/api/revalidate.ts` validates every incoming CMS key against an allowlist before writing to KV. Since the Phase 3 sync contract the list itself lives in `cf-astro/src/lib/sync-contract.ts` (`CMS_KEY_ALLOWLIST`, an `as const` array the endpoint wraps in a `Set`); the contents below are unchanged and were re-compared on 2026-09-14. This prevents arbitrary cache injection if the `REVALIDATION_SECRET` is ever compromised.

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
| All 3 revalidation retries exhausted | Sentry via `captureMessage` ("Edge purge failed — queued for redrive", `src/lib/cms/revalidate.ts`) + BetterStack |
| Rejected disallowed CMS key | BetterStack via `log.warn` |
| Successful CMS key write | BetterStack via `log.info` |
| Admin endpoint revalidation failure | HTTP response body `{ revalidated: false, message }` |

To check current KV namespace status: Cloudflare Dashboard → Workers & Pages → KV → `ISR_CACHE`.

---

## 8. Cross-References

- **CMS architecture overview** → [CMS.md](../features/CMS.md)
- **ISR_CACHE binding ID** → [OPERATIONS.md](../operations/OPERATIONS.md) §1
- **KV free-tier quotas** → [OPERATIONS.md](../operations/OPERATIONS.md) §3.2 — the owner
- **Revalidation secret config** → [CMS.md](../features/CMS.md) §4 *(corrected 2026-09-19: the link here pointed at a `#8-configuration--environment-constraints` anchor; CMS.md has sections 1–7 and no such heading)*
- **cf-astro revalidate endpoint** → `cf-astro/src/pages/api/revalidate.ts`
- **revalidateAstro() helper** → `cf-admin/src/lib/cms/revalidate.ts` — `revalidateAstro()`
- **Same KV+D1 pattern proposed for system-wide settings** → [`GLOBAL-CONFIG.md`](GLOBAL-CONFIG.md) (research reference, not implemented)

---

## 9. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | Re-derived the quota table against `../operations/OPERATIONS.md` §3.2 and the Cloudflare pricing page (free reads are 100,000/day, and deletes and lists are separately metered); re-read `src/lib/cms/revalidate.ts` end to end, including `revalidateAstro`'s outbox + `SYNC_QUEUE` fallback and the `verifyCmsLive` read-back; confirmed cf-admin has no `ISR_CACHE` binding in `wrangler.toml`; checked the `CMS.md` anchor. §2, §3a, §4, §7 and §8 corrected; scope note added for cf-admin's own `SESSION` KV | Live KV key state (the connector has no key-level read); §3b's cf-astro resolvers were corrected from the 2026-09-14 reading, not re-read today |
| 2026-09-14 | `cf-astro/src/pages/api/revalidate.ts`: `Promise.allSettled` batch with per-promise `.catch()` (§5), `expirationTtl: 3600` on `cms:*` writes (§4), `log.warn('Rejected disallowed CMS key')` (§6/§7), BetterStack logger is `@logtail/edge` in `cf-astro/src/lib/logger.ts`; the 18-key allowlist plus the `blog_draft_*` regex against `sync-contract.ts`; `s-maxage=86400` set in `cf-astro/src/middleware.ts`; `cf-admin/src/lib/cms/revalidate.ts`: 3 attempts, 5 s timeout, `Sentry.captureMessage` on exhausted retries (§7 — the message is now "Edge purge failed — queued for redrive", because exhausted retries hand off to the queue consumer rather than giving up). | Live KV key state (the connector has no key-level read); the failure walk-through in §3 was not re-induced |

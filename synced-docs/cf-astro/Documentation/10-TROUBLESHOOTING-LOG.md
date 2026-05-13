{% raw %}
# 10 — Troubleshooting Log

Chronological record of every bug, build error, and resolution encountered during development.

---

## Issue #1: Zod v4 vs Astro Internal Zod v3 Conflict

**Date**: 2026-03-17  
**Severity**: 🔴 Build blocker  
**Phase**: Phase 1 — Project Scaffolding

### Symptoms

`npx astro build` failed with internal errors related to Zod schema validation during Astro's content sync phase. The error messages were cryptic and occurred inside Astro's node_modules.

### Root Cause

The project installed `zod@^4.0.0` (latest), but Astro v5 internally depends on and bundles `zod@^3.x`. Having two incompatible Zod versions caused type conflicts during build.

### Resolution

Downgraded Zod to v3 in `package.json`:

```diff
- "zod": "^4.0.0"
+ "zod": "^3.25.0"
```

Then ran `npm install` to update the lockfile.

### Files Changed

- `package.json` — Version change
- `package-lock.json` — Regenerated

---

## Issue #2: `output: 'hybrid'` Deprecated in Astro v5

**Date**: 2026-03-17  
**Severity**: 🟡 Build warning (would become error)  
**Phase**: Phase 1 — Project Scaffolding

### Symptoms

Astro build output a deprecation warning:
```
[WARN] The `output: 'hybrid'` option is deprecated in Astro 5.
```

### Root Cause

Astro v5 merged `hybrid` and `server` output modes. The `static` output now supports per-route SSR via `export const prerender = false`.

### Resolution

Changed `astro.config.ts`:

```diff
- output: 'hybrid',
+ output: 'static',
```

API routes that need SSR already had `export const prerender = false`, so no other changes were needed.

### Files Changed

- `astro.config.ts` — Output mode change

---

## Issue #3: Cloudflare Adapter `imageService` API Change

**Date**: 2026-03-17  
**Severity**: 🟡 Build warning  
**Phase**: Phase 1 — Project Scaffolding

### Symptoms

Build warning:
```
[WARN] The `imageService` option in the Cloudflare adapter is deprecated.
Use `image: { service: passthroughImageService() }` in the top-level Astro config instead.
```

### Root Cause

The `@astrojs/cloudflare` adapter v12 moved image service configuration from the adapter options to Astro's top-level config.

### Resolution

```diff
  import { defineConfig, passthroughImageService } from 'astro/config';

  adapter: cloudflare({
-   imageService: 'passthrough',
    platformProxy: { enabled: true },
  }),
+ image: {
+   service: passthroughImageService()
+ },
```

### Files Changed

- `astro.config.ts` — Moved image service config

---

## Issue #4: Tailwind CSS v4 `@tailwindcss/vite` Build Crash

**Date**: 2026-03-17  
**Severity**: 🔴 Build blocker — CRITICAL  
**Phase**: Phase 1 → Phase 2  

### Symptoms

`npx astro build` would crash silently during Vite's CSS processing phase. The build would:
1. Start normally (content sync, type gen)
2. Begin building server entrypoints
3. **Crash with no meaningful error** during Vite transform
4. Sometimes show `TypeError: Cannot use 'in' operator to search for 'name' in undefined`
5. Sometimes show PostCSS configuration errors about missing `@tailwindcss/postcss`

The build worked fine when the `@tailwindcss/vite` plugin was removed from `astro.config.ts`, but then all styling was lost.

### Root Cause

**Tailwind CSS v4's `@tailwindcss/vite` Vite plugin is incompatible with Astro 5's SSR build pipeline**, specifically when the Cloudflare adapter is configured. The plugin intercepts CSS processing in a way that conflicts with:
- Astro's internal Vite CSS handling in SSR bundles
- The Cloudflare adapter's Worker bundling
- Astro's hydration engine

This is a known emerging issue in the Astro + Tailwind v4 ecosystem (as of March 2026).

### Investigation Steps

1. Captured verbose build output to `debug_build.txt` (213KB)
2. Captured error output to `build_error.txt` (5.7KB)
3. Examined `node_modules/astro/dist/core/build/index.js` for error context
4. Examined `node_modules/astro/dist/core/sync/index.js` for content scan errors
5. Tested build without `@tailwindcss/vite` — succeeded (confirming the plugin as cause)
6. Tested build with `@tailwindcss/vite` but minimal CSS — still crashed
7. Researched via Perplexity: confirmed Tailwind v4 + Astro SSR incompatibility

### Resolution

Created a formal design doc at `docs/plans/2026-03-17-tailwind-build-crash-resolution.md` and executed the recommended approach:

1. **Uninstalled** Tailwind v4 and the Vite plugin:
   ```bash
   npm uninstall tailwindcss @tailwindcss/vite
   ```

2. **Installed** Tailwind v3 with the official Astro integration:
   ```bash
   npm install tailwindcss@^3.4.19 @astrojs/tailwind@^6.0.2
   ```

3. **Updated `astro.config.ts`**:
   ```diff
   - import tailwindcss from '@tailwindcss/vite';
   + import tailwind from '@astrojs/tailwind';

     integrations: [
   +   tailwind(),
       sitemap({ ... }),
     ],

     vite: {
   -   plugins: [tailwindcss()],
       ssr: { ... },
     },
   ```

4. **Created `tailwind.config.mjs`** — Standard Tailwind v3 config mapping CSS variables to utility classes

5. **Refactored `src/styles/global.css`**:
   ```diff
   - @import "tailwindcss";
   + @tailwind base;
   + @tailwind components;
   + @tailwind utilities;
   
   - :root { /* tokens */ }
   - @theme { /* Tailwind v4 theme block */ }
   + @layer base {
   +   :root { /* tokens */ }
   + }
   ```

### Files Changed

- `package.json` — Dependency swap
- `astro.config.ts` — Integration + plugin changes
- `tailwind.config.mjs` — New file
- `src/styles/global.css` — CSS syntax rewrite
- `docs/plans/2026-03-17-tailwind-build-crash-resolution.md` — Design doc

### Verification

Build succeeded with zero errors:
```
[build] Complete!
Exit code: 0
```

---

## Issue #5: Missing i18n Translation Keys

**Date**: 2026-03-17  
**Severity**: 🟡 Build warning (non-fatal)  
**Phase**: Phase 1

### Symptoms

Build warnings during pre-rendering:
```
[i18n] Missing translation: Services.items.transport.name
[i18n] Missing translation: Services.items.transport.price
```

### Root Cause

The `transport` service item in the translation JSON files was initially created with only `name` and `description` fields, missing the `price` field that `Services.astro` references.

Additionally, during an attempted fix, the `name` key was accidentally renamed to `title`, while the component still referenced `name`.

### Resolution

1. Added `price` field to `transport` in both `es.json` and `en.json`
2. Ensured `name` key (not `title`) was used to match the component's `t(messages, 'Services.items.${svc.id}.name')` pattern

**Final state in `es.json`**:
```json
"transport": {
  "name": "Transporte a Casa",
  "description": "Servicio de transporte seguro puerta a puerta para tu mascota.",
  "price": "Cotizar"
}
```

### Files Changed

- `src/i18n/translations/es.json` — Added `price`, fixed `name` key
- `src/i18n/translations/en.json` — Added `price`, fixed `name` key

### Verification

Build completed with zero i18n warnings.

---

## Issue #6: Root Path `/` Returns 404 in Dev Server

**Date**: 2026-03-17  
**Severity**: 🟡 Dev-only issue  
**Phase**: Phase 5 — Marketing Homepage

### Symptoms

Visiting `http://localhost:4321/` returns `404: Not found`. The browser console also shows:
```
Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
```

### Root Cause

The site only has pages at `/es/` and `/en/`. The root `/` → `/es/` redirect was configured in `public/_redirects`, but this file is a **Cloudflare Pages feature** and is ignored by Astro's dev server.

### Resolution

Created `src/pages/index.astro` with SSR-enabled redirect:

```astro
---
export const prerender = false;
return Astro.redirect('/es/', 301);
---
```

The `prerender = false` is required because the project uses `output: 'static'`, and `Astro.redirect()` needs server-side execution.

### Files Changed

- `src/pages/index.astro` — New file (root redirect)

### Verification

- `http://localhost:4321/` now redirects to `http://localhost:4321/es/`
- Production deployment still uses `public/_redirects` (both mechanisms work)

---

## Issue #7: Services.astro Syntax Error

**Date**: 2026-03-28  
**Severity**: 🔴 Build blocker  
**Phase**: Phase 5 — Marketing Homepage (Services refactor)

### Symptoms

Astro build failed with a JSX parser error:
```
Expected ">" but found "class"
sections/Services.astro:126:17
```

### Root Cause

During the refactor of `Services.astro` from simple 3-card layout to a tabbed AutoTabs system, a malformed HTML tag was introduced where a closing angle bracket was missing before a `class` attribute. The JSX/Astro parser could not recover from this syntax error.

### Resolution

Rewrote the entire `Services.astro` component (now 18KB, 364 lines) with:
1. Server-rendered HTML for all 3 tab contents (Services, Requirements, Pricing)
2. Vanilla JS `<script>` for tab switching, auto-rotation, and progress bar
3. Proper JSX-compatible markup throughout
4. `flatKey()` helper function for accessing dot-notation translation keys

### Files Changed

- `src/components/sections/Services.astro` — Complete rewrite (2.5KB → 18KB)

### Verification

Build completed with zero parser errors. All 3 tabs render and switch correctly.

---

## Issue #8: Contact Section Renders Completely Blank

**Date**: 2026-03-28  
**Severity**: 🔴 Critical UI bug  
**Phase**: Phase 5 — Marketing Homepage (Contact section)

### Symptoms

The entire Contact section on the homepage was invisible — a blank white gap appeared where the section should be. No content was visible at all, despite the section's HTML being present in the DOM (confirmed via browser DevTools).

### Root Cause

The `scroll-reveal.ts` animation system sets all `[data-animate]` elements to `opacity: 0` and applies transform offsets via CSS initially. The `.is-visible` class (added by the IntersectionObserver) triggers the transition to `opacity: 1`. 

The original Contact section's markup structure was incompatible with the animation system — elements were either missing proper `data-animate` attributes or were structured in a way that prevented the IntersectionObserver from observing them correctly (e.g., nested inside non-intersecting containers).

### Resolution

Completely rebuilt `Contact.astro` (now 12KB, 142 lines) with:
1. Proper `data-animate="slide-up"` attributes on all visible elements
2. Staggered `data-delay` values (100ms–600ms) for cascading reveal
3. Premium glassmorphism design with Formspree contact form
4. Dual Google Maps iframe embeds for both hotel locations
5. WhatsApp/phone/email contact row

### Files Changed

- `src/components/sections/Contact.astro` — Complete rewrite
- `src/i18n/translations/es.json` — Added `Contact.locations.*`, `Contact.form.*` namespaces
- `src/i18n/translations/en.json` — Added `Contact.locations.*`, `Contact.form.*` namespaces

### Verification

Contact section renders fully with staggered scroll-reveal animations. Formspree form submits successfully. Both Google Maps iframes load correctly.

---

## Issue #9: Header Scroll Transition White Line Flash

**Date**: 2026-03-28  
**Severity**: 🟡 Visual glitch  
**Phase**: Phase 4 — Header refactor

### Symptoms

During the 300ms scroll transition between the transparent and white header states, a thin 1px bright white horizontal line would flash across the full width of the header. The flash was most noticeable on dark hero backgrounds.

### Root Cause

The `<header>` element had `transition-all duration-300` applied, which means **all** CSS properties transition smoothly — including `border-color`.

In the **default state**, the header had no `border-b` class. When the user scrolled past 50px, the JS added both `border-b` and `border-gray-100` classes simultaneously.

The problem: when `border-b` is first applied, CSS needs a starting `border-color` value to transition from. Since none was explicitly set, the browser fell back to the CSS default: `currentColor`. At the top of the page, `currentColor` resolved to `#ffffff` (white text color), so the browser animated:

```
border-color: #ffffff (currentColor) → #f3f4f6 (gray-100)
               ↑ bright white flash!
```

This created a visible 1px white line for the full 300ms transition duration.

### Resolution

Added `border-b border-transparent` to the default `<header>` element:

```diff
  <header
    id="site-header"
-   class="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-black/20 backdrop-blur-sm"
+   class="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-black/20 backdrop-blur-sm border-b border-transparent"
  >
```

And updated the JS to toggle `border-transparent` ↔ `border-gray-100` instead of adding/removing `border-b`:

```diff
  // Scrolled state
- header.classList.add('border-b', 'border-gray-100');
+ header.classList.remove('border-transparent');
+ header.classList.add('border-gray-100');

  // Default state
- header.classList.remove('border-b', 'border-gray-100');
+ header.classList.add('border-transparent');
+ header.classList.remove('border-gray-100');
```

This gives the CSS engine a stable interpolation path: `transparent → gray-100`, which is invisible to the eye.

### Files Changed

- `src/components/layout/Header.astro` — Added `border-b border-transparent` default, updated JS toggle logic

### Verification

Header transition is now perfectly smooth with zero visible flash. The `border-transparent` ensures the interpolation stays invisible throughout the full 300ms duration.

---

## Issue #10: Duplicate/Wrong PetStore Schema in MarketingLayout

**Date**: 2026-04-13  
**Severity**: 🔴 SEO data quality (wrong business phone emitted to Google)  
**Phase**: Phase 11 — SEO

### Symptoms

Google Rich Results Test showed a PetStore schema with phone `+524491234567` — a placeholder/wrong number. The real business phone is `+52-449-448-5486`. Additionally, a BreadcrumbList schema was emitted twice per page (once from MarketingLayout, once from SchemaMarkup.astro), causing a schema conflict.

### Root Cause

An inline `<script type="application/ld+json">` block was left in `MarketingLayout.astro` from an early development iteration. It contained:
1. A `PetStore` schema (wrong type — should be `Hotel`/`LodgingBusiness`) with a placeholder phone number `+524491234567`
2. A `BreadcrumbList` schema that conflicted with SchemaMarkup.astro's BreadcrumbList emitted on the same page

### Resolution

Removed the entire inline schema block from `MarketingLayout.astro`. All structured data is now exclusively handled by the dedicated SEO components injected via `slot="head"`:
- `SchemaMarkup.astro` — homepages
- `ServicePageSchema.astro` — services pages
- `BlogPostSchema.astro` — blog posts

### Files Changed

- `src/layouts/MarketingLayout.astro` — Removed entire inline `<script type="application/ld+json">` block; added new SEO prop passthrough

---

## Issue #11: Hreflang URL Builder Fragile String Replace

**Date**: 2026-04-13  
**Severity**: 🟡 SEO correctness (wrong alternate URLs for certain paths)  
**Phase**: Phase 11 — SEO

### Symptoms

Hreflang alternate URLs were incorrectly generated for any page whose path contains the locale string in a position other than the locale prefix segment. For example, `/en/blog/essential-pet-en-route-tips` would produce a malformed alternate URL.

### Root Cause

The old URL swapping code used a naive `string.replace()`:

```typescript
// Fragile — replaces FIRST occurrence of locale string anywhere in URL
const altUrl = canonicalUrl.replace(`/${locale}`, `/${altLocale}`);
```

If the URL is `/en/blog/essential-pet-en-route-tips`, the `en` in `essential-pet-en-route-tips` would also be replaced, producing `/es/blog/essential-pet-es-route-tips` — a broken URL.

### Resolution

Replaced with a regex that anchors to the host/locale boundary:

```typescript
// Correct — only replaces the locale path segment immediately after the host
const altUrl = canonicalUrl.replace(
  new RegExp(`^(https?://[^/]+)/${locale}(/|$)`),
  `$1/${altLocale}$2`
);
```

The capture group `$1` preserves the host, and `$2` preserves any trailing slash, making the substitution precise.

### Files Changed

- `src/layouts/BaseLayout.astro` — Replaced string.replace with regex replace in hreflang generation

---

## Issue #12: CSP Blocking R2 Images from CDN Subdomain

**Date**: 2026-04-13  
**Severity**: 🔴 Production blocker (images blocked in browser)  
**Phase**: Phase 14 — Security headers

### Symptoms

After setting up `cdn.madagascarhotelags.com` as the custom domain for the R2 bucket, images served from that subdomain were blocked by the browser with a CSP violation:

```
Refused to load the image 'https://cdn.madagascarhotelags.com/images/boarding.jpg'
because it violates the following Content Security Policy directive: "img-src 'self' blob: data: *.r2.dev"
```

### Root Cause

The `img-src` directive in `public/_headers` only allowed `*.r2.dev` (the default R2 public URL). When the custom CDN domain `cdn.madagascarhotelags.com` was added, it wasn't in the allowlist.

The original entry also referenced `pet.madagascarhotelags.com` — the old staging subdomain — which was no longer relevant.

### Resolution

Updated `public/_headers` `img-src` directive:

```diff
- img-src 'self' blob: data: *.r2.dev
+ img-src 'self' blob: data: *.r2.dev cdn.madagascarhotelags.com
```

**Rule for future**: Any new domain that serves images (R2 CDN, external image host) MUST be added to `img-src` in `_headers`. See [RULES.md Section 9.4](../RULES.md#94-content-security-policy) for the current allowlist.

### Files Changed

- `public/_headers` — Added `cdn.madagascarhotelags.com` to `img-src`; removed obsolete `pet.madagascarhotelags.com`

---

## Issue #13: CMS Updates Never Appeared on Live Site

**Date**: 2026-04-14
**Severity**: 🔴 Production blocker — ALL CMS sections (Hero, Gallery, Services, Reviews)
**Phase**: Post-launch CMS operations

### Symptoms

Admin saves changes in cf-admin (hero image upload, gallery push, services pricing, reviews) but the live site at `madagascarhotelags.com` never reflects the updates. The Gallery Manager UI showed "Saved to database, but live sync failed" on every save. D1 and R2 received the data correctly; the site just kept serving stale content indefinitely.

### Root Cause — Primary (Blocked ALL sections)

`PUBLIC_ASTRO_URL` in `cf-admin/wrangler.toml` was set to `https://pet.madagascarhotelags.com`:

```toml
PUBLIC_ASTRO_URL = "https://pet.madagascarhotelags.com"  # ← Wrong
```

`pet.madagascarhotelags.com` has a Cloudflare Redirect Rule (301) pointing to `madagascarhotelags.com`. When `revalidateAstro()` sends a `POST` to this URL:

1. Cloudflare edge fires the redirect rule → returns **301**
2. `fetch()` follows the redirect — but **HTTP spec (RFC 7231) mandates POST + 301 → downgraded to GET**
3. A `GET /api/revalidate` reaches cf-astro — the endpoint only exports `POST`, so Astro returns **405**
4. `revalidateAstro()` logs the failure, retries 3×, returns `{ success: false }`
5. ISR cache is **never purged**, `cms:*` KV keys are **never injected**
6. The live site serves the 30-day-cached stale HTML forever

The same hardcoded fallback URL inside `revalidateAstro()` in `cms.ts` had the same wrong value, so the bug persisted even if the env var was missing.

### Root Cause — Secondary (D1 replica lag trap)

Even with the primary bug fixed, Hero, Reviews, and Services were still vulnerable: they called `revalidateAstro()` without a `cmsData` payload. This meant:
1. ISR cache purged correctly
2. First render after purge hits D1 — which may return **stale data** for several seconds due to read-replica lag
3. The stale HTML is **re-cached in KV for 30 days**
4. All requests serve the stale content until the next admin change

Gallery was the only section with KV injection already implemented (introduced in v4.0). Hero, Reviews, and Services were missing it.

### Resolution

**Primary fix** — `cf-admin/wrangler.toml` and `cf-admin/src/lib/cms.ts`:
```diff
- PUBLIC_ASTRO_URL = "https://pet.madagascarhotelags.com"
+ PUBLIC_ASTRO_URL = "https://madagascarhotelags.com"

- const astroUrl = env.PUBLIC_ASTRO_URL || 'https://pet.madagascarhotelags.com';
+ const astroUrl = env.PUBLIC_ASTRO_URL || 'https://madagascarhotelags.com';
```

**Secondary fix** — Added KV injection to all missing sections:

- `cf-admin/src/pages/api/media/upload.ts`: injects `{ 'hero_image': cdnUrl }` for hero slot
- `cf-admin/src/pages/api/content/reviews.ts`: injects `{ 'happy_clients': JSON.stringify(reviews) }`
- `cf-admin/src/pages/api/content/services.ts`: injects `{ 'services_pricing': JSON.stringify(pricingData) }`
- `cf-astro/src/lib/images.ts`: `getImageUrl()` upgraded with optional `kvCache` param — checks `cms:<slotId>` in KV before D1
- `cf-astro/src/components/sections/Hero.astro`: passes `env.ISR_CACHE` to `getImageUrl()`
- `cf-astro/src/components/sections/Testimonials.astro`: KV-first block before `getJsonBlock()` D1 call
- `cf-astro/src/components/sections/Services.astro`: KV-first block before `getJsonBlock()` D1 call

**Bonus fix** — `cf-admin/src/pages/api/media/upload.ts`: Added `owner` role to RBAC check (was missing, causing 403 for Owner-role users on image uploads).

### Files Changed

**cf-admin:**
- `wrangler.toml` — Fixed `PUBLIC_ASTRO_URL`
- `src/lib/cms.ts` — Fixed hardcoded fallback URL
- `src/pages/api/media/upload.ts` — Added KV injection for hero; fixed `owner` RBAC
- `src/pages/api/content/reviews.ts` — Added KV injection
- `src/pages/api/content/services.ts` — Added KV injection

**cf-astro:**
- `src/lib/images.ts` — `getImageUrl()` upgraded to KV-first
- `src/components/sections/Hero.astro` — Passes `ISR_CACHE` to image resolver
- `src/components/sections/Testimonials.astro` — KV-first resolution before D1
- `src/components/sections/Services.astro` — KV-first resolution before D1

### Rule for Future

> **Never use a domain that has a Cloudflare Redirect Rule as a webhook target.** 301/302 redirects silently downgrade POST to GET, breaking any endpoint that only accepts POST. Always point `PUBLIC_ASTRO_URL` directly at the canonical production domain of cf-astro (`https://madagascarhotelags.com`), not any alias or subdomain with a redirect.

> **All CMS write endpoints must inject `cmsData` into `revalidateAstro()`.** Purging the ISR cache without injecting fresh data into KV creates a D1 replica lag window where stale HTML can be re-cached for up to 30 days. See `CMS_AND_BOOKINGS_MANAGEMENT.md` Section 6 for the full KV injection coverage table.

---

## Issue #14: Gallery Infinite Render Loop & Browser Freeze

**Date**: 2026-05-05
**Severity**: 🔴 Production blocker (Browser crash)
**Phase**: Production

### Symptoms

When clicking an image in the gallery, the browser tab would become completely unresponsive and eventually crash. The main thread was blocked due to an infinite render loop in Preact hydration.

### Root Cause

The `InfiniteGalleryIsland` was generating a new `imgRefCallback` reference on every render. This triggered a `handleImgLoad` call on every cycle. The `handleImgLoad` function unconditionally updated state with a `new Set()`, which caused another render, creating an infinite loop. Additionally, tracking loaded state by array index was fragile and susceptible to bugs if the parent array mutated. Lastly, `LightboxIsland.tsx` had a memory leak where `document.body.style.overflow = "hidden"` was not reliably cleared.

### Resolution

1. **Ref Caching**: Introduced `useRef(new Map())` to memoize ref callbacks in `InfiniteGalleryIsland`, ensuring `ref` triggers only happen when the DOM element is initially attached.
2. **State Bailout**: Implemented `if (prev.has(src)) return prev;` in all state updaters to force render aborts when state hasn't changed.
3. **Immutable Tracking**: Refactored state tracking from array indices to exact image `src` URL strings. This ensures the gallery remains stable even if the parent component filters or sorts the image array at runtime.
4. **Memory Leak Fix**: Fixed the race condition in `LightboxIsland.tsx` by correcting the cleanup logic in the `useEffect` hook to ensure body scroll is restored.

### Files Changed

- `src/components/islands/InfiniteGalleryIsland.tsx`
- `src/components/islands/LightboxIsland.tsx`

### Rule for Future

> **Always memoize ref callbacks and implement state bailouts in list-rendering components.** When passing inline arrow functions to `ref` attributes in Preact/React, a new function is created on every render, triggering the ref callback again. Combining this with an unconditional state update creates an infinite loop. Always bail out if the new state matches the previous state.

---

## Issue #15: Booking FK Constraint Failure — 100% Booking Outage

**Date**: 2026-05-13 (discovered; active since ~April 26)
**Severity**: 🔴🔴 CRITICAL — Business-blocking (17 days of silent failure)
**Phase**: Production

### Symptoms

Every booking submission at `madagascarhotelags.com/es/booking/` returned:
```
Internal server error. Please try again or contact us via WhatsApp.
```

Chrome console showed:
```
POST https://madagascarhotelags.com/api/booking 500 (Internal Server Error)
```

Sentry captured 3 errors related to the booking endpoint. All booking attempts for approximately 17 days failed silently with a 500 response.

### Root Cause

The `POST /api/booking` handler inserted `consent_records` **before** `bookings`. The Supabase PostgreSQL schema has a Foreign Key constraint:

```
consent_records.booking_ref → bookings.booking_ref
```

This FK requires the referenced `bookings.booking_ref` to exist **before** a `consent_records` row can reference it. The handler was doing:

```typescript
// ❌ WRONG ORDER — FK violation on every request
await db.insert(schema.consentRecords).values({ bookingRef, ... }); // FK target doesn't exist yet!
await db.insert(schema.bookings).values({ bookingRef, ... });       // Too late — consent already failed
```

**Why it went undetected for 17 days:**
1. `wrangler.toml` had `head_sampling_rate = 0.05` (5% observability sampling)
2. At ~50 requests/day, 95% of error evidence was silently dropped
3. The Supabase error message was a generic FK violation, not surfaced to any dashboard
4. No D1 audit trail existed to catch the gap

### Resolution

**4 files changed:**

1. **`src/pages/api/booking.ts`** (complete rewrite):
   - Wrapped ALL inserts in a single `db.transaction()` for atomicity
   - **Reversed insert order**: booking FIRST, then consent (satisfies FK)
   - Added D1 `booking_attempts` audit table writes before and after Supabase operations
   - Status progression: `attempt` → `validated` → `db_success` → `complete` (or error states)

2. **`src/lib/db/client.ts`**:
   - Added `createRawClient()` export for manual transaction control
   - Fixed `prepare: false` detection for Supavisor pooler connections (port 6543)

3. **`src/scripts/analytics-loader.ts`**:
   - Fixed PostHog bridge: replaced `onFeatureFlags()` (NOT stubbed) with `onSessionId()` (IS stubbed)
   - Added polling fallback for edge cases
   - Fixes Sentry issues CF-ASTRO-5 and CF-ASTRO-6

4. **`wrangler.toml`**:
   - Raised `head_sampling_rate` from `0.05` → `1.0` (100% observability)
   - Added `[observability.traces]` section with `persist = true`

**D1 Migration applied:**
```sql
-- db/migrations/0005_booking_attempts.sql
CREATE TABLE IF NOT EXISTS booking_attempts (
  id TEXT PRIMARY KEY,
  booking_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'attempt',
  owner_email TEXT,
  service TEXT,
  pet_count INTEGER DEFAULT 0,
  request_ip TEXT,
  user_agent TEXT,
  request_body TEXT,
  error_code TEXT,
  error_message TEXT,
  error_stack TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ba_status ON booking_attempts(status);
CREATE INDEX IF NOT EXISTS idx_ba_created ON booking_attempts(created_at);
```

### Files Changed

- `src/pages/api/booking.ts` — Atomic transaction, correct FK order, D1 audit
- `src/lib/db/client.ts` — Added `createRawClient()`, fixed pooler detection
- `src/scripts/analytics-loader.ts` — Fixed PostHog bridge TypeError
- `wrangler.toml` — 100% observability sampling
- `db/migrations/0005_booking_attempts.sql` — New D1 audit table

### Rules for Future

> **NEVER insert consent_records before bookings.** The FK `consent_records.booking_ref → bookings.booking_ref` requires the booking to exist first. Always follow the insert order documented in RULES.md §5.3.

> **NEVER lower `head_sampling_rate` below `1.0` on a low-traffic site (<1000 req/day).** At 5% sampling, a bug that fires on every request can go undetected for weeks. 100% sampling is well within free tier limits.

> **ALL business-critical endpoints MUST have D1 audit tables.** D1 is local to the Worker (zero network hop) and survives external DB outages. Booking, contact, and consent endpoints should all have dead-letter audit trails.

> **Wrap ALL multi-table inserts in a single `db.transaction()`.** Individual inserts without transaction wrapping leave the database in an inconsistent state if any insert fails mid-sequence.

---

## Issue #16: PostHog Bridge TypeError — `onFeatureFlags is not a function`

**Date**: 2026-05-13
**Severity**: 🟡 Non-blocking (diagnostic noise in Sentry)
**Phase**: Production

### Symptoms

Sentry captured recurring `TypeError: window.posthog.onFeatureFlags is not a function` errors (issues CF-ASTRO-5 and CF-ASTRO-6). The errors appeared in the browser console but did not affect site functionality.

### Root Cause

The `bridgePostHogToSentry()` function in `analytics-loader.ts` called `posthog.onFeatureFlags()`. However, `onFeatureFlags` is **not** in the PostHog stub's method list — it only exists on the fully-loaded SDK. When the bridge fires before the real SDK loads (which is the common case with `requestIdleCallback` loading), the stub object throws a TypeError.

### Resolution

Replaced `onFeatureFlags()` with `onSessionId()`, which **IS** in the PostHog stub's method list. Added a polling fallback for edge cases where even `onSessionId` is unavailable:

```typescript
// ✅ CORRECT — onSessionId IS in the stub
ph.onSessionId((_sessionId: string) => {
  const distinctId = ph.get_distinct_id?.();
  if (distinctId) setTag('posthog_id', distinctId);
});
```

### Files Changed

- `src/scripts/analytics-loader.ts` — Replaced `onFeatureFlags` with `onSessionId` + polling fallback

### Rule for Future

> **Only call PostHog stub methods that are in the stub's method list.** The PostHog snippet creates a stub object with a fixed set of methods (listed in the `o` variable in the snippet). Any method NOT in that list will throw TypeError when called before the real SDK loads. Always verify against the snippet's method list before adding new PostHog API calls.

---

## Issue #17: Premature Validation Errors on Booking Wizard Step 3

**Date**: 2026-05-13
**Severity**: 🟡 UX Regression
**Phase**: Production

### Symptoms

Users navigating to Step 3 of the `BookingWizard` immediately saw a "wall of red errors" (validation messages) before they even interacted with any inputs.

### Root Cause

1. **Ghost-Clicks/Rapid Navigation**: The `onSubmit` handler for Step 3 was firing immediately upon mount if the user double-clicked the "Next" button on Step 2 or if a fast navigation event bubbled up before the component was fully hydrated. 
2. **Strict Typing Violations**: Event handlers in `Step2Pet.tsx` and `Step3Owner.tsx` were using `any` types for events, which bypassed TypeScript's strict checks and allowed uncontrolled event propagation.

### Resolution

1. **Mount Safety Lock**: Implemented a 500ms `isMounted` state lock in `Step3Owner.tsx`. Submissions are ignored if `!isMounted`, effectively discarding any ghost-clicks from the previous step.
2. **Strict Event Typing**: Replaced all `any` event types with `(e: Event)` and cast targets properly (e.g., `const target = e.currentTarget as HTMLInputElement;`).
3. **Isolated Validation**: Ensured that the wizard components (`Step2` and `Step3`) validate only their local state during interactions, rather than relying on the global schema too early.

### Files Changed

- `src/components/booking/Step2Pet.tsx` — Fixed event typing.
- `src/components/booking/Step3Owner.tsx` — Added mount safety lock and fixed event typing.

### Rule for Future

> **Implement mount safety locks on multi-step forms.** Always add a short debounce or `isMounted` lock (e.g., 500ms) on wizard steps to prevent ghost-clicks or rapid navigation from triggering premature validation errors when the component first renders. Ensure all event handlers use strict generic typing to maintain component integrity.


{% endraw %}

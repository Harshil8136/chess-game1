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


{% endraw %}

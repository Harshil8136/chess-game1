# Changelog

Chronological record of feature additions, design refactors, and improvements to the `cf-astro` project. For bug fixes, see [10-TROUBLESHOOTING-LOG.md](./10-TROUBLESHOOTING-LOG.md).

---

## 2026-04-13 — Full SEO/AEO/GEO/SXO/AIO Production Overhaul

**Overview**: Complete search and AI optimization overhaul for production launch on `madagascarhotelags.com`. Replaced `@astrojs/sitemap` with a custom 4-file sitemap system, implemented full JSON-LD schema graph, rewrote `BaseLayout.astro` with all meta disciplines, created `llms.txt` AI context files, and configured domain migration redirects.

**New Files Created**:
- `src/pages/sitemap-index.xml.ts` — Master sitemap index (replaces @astrojs/sitemap)
- `src/pages/sitemap-es.xml.ts` — Spanish sitemap with `xhtml:link` hreflang per URL
- `src/pages/sitemap-en.xml.ts` — English sitemap with hreflang
- `src/pages/sitemap-images.xml.ts` — Google Image Search sitemap
- `src/components/seo/ServicePageSchema.astro` — ItemList + PriceSpecification schema for services page
- `src/components/seo/BlogPostSchema.astro` — BlogPosting + BreadcrumbList schema for blog posts
- `public/llms.txt` — Concise AI context file (GEO/AIO 2026 standard)
- `public/llms-full.txt` — Extended AI context (~5000 words, all services/FAQs/pricing)
- `public/.well-known/security.txt` — RFC 9116 security disclosure
- `public/opensearch.xml` — Browser address bar search integration

**Files Modified**:
- `src/layouts/BaseLayout.astro` — Complete rewrite: geo meta, fixed hreflang (regex), full OG/Twitter/Article tags, resource hints, Apple PWA meta, Search Console tags, LCP preload, non-blocking fonts
- `src/layouts/MarketingLayout.astro` — Removed all inline schema (duplicate PetStore + BreadcrumbList), added new SEO props passthrough
- `src/components/seo/SchemaMarkup.astro` — Upgraded to 6-schema @graph: WebSite + WebPage + Hotel + Organization + FAQPage + BreadcrumbList (with speakable, amenityFeature, 3 reviews, 7 Q&As)
- `public/_headers` — Fixed CSP: `cdn.madagascarhotelags.com` in `img-src`; added COOP/CORP headers; added per-path cache rules for SEO files
- `public/_redirects` — Added www + pet subdomain 301 redirects + pages.dev suppression
- `public/manifest.webmanifest` — Added `id`, shortcuts (Reservar/Servicios/WhatsApp), screenshots, categories
- `wrangler.toml` — Routes section updated to `madagascarhotelags.com/*`
- `astro.config.ts` — Removed `@astrojs/sitemap` integration (package retained, just not used)
- `src/pages/robots.txt.ts` — 30+ AI bots explicitly allowed, `Host:` directive, llms.txt references, Crawl-delay for SEO tools
- `src/pages/es/services.astro` + `en/services.astro` — ServicePageSchema wired in + locale keywords + LCP preload
- `src/pages/es/blog/[slug].astro` + `en/blog/[slug].astro` — BlogPostSchema wired in, ogType=article, preloadImage

**Bugs Fixed**:
- Removed duplicate/wrong PetStore schema (wrong phone `+524491234567`) from MarketingLayout
- Removed duplicate BreadcrumbList from MarketingLayout (conflicted with SchemaMarkup)
- Fixed hreflang URL builder (was fragile `string.replace`, now uses regex with capture group)
- Fixed CSP `img-src` missing `cdn.madagascarhotelags.com` (R2 images were being blocked)

**Pending Manual Steps** (see [13-SEO-AND-SEARCH-OPTIMIZATION.md](./13-SEO-AND-SEARCH-OPTIMIZATION.md)):
1. Google Search Console: Add Domain property, verify via DNS, submit sitemap-index.xml
2. Google Search Console: Change of Address from pet.madagascarhotelags.com
3. Bing Webmaster: Import from GSC, submit sitemap
4. Add Bing `msvalidate.01` meta tag to BaseLayout
5. Set up IndexNow key
6. Update Google Business Profile URL
7. Cloudflare Dashboard: Add custom domain + 3 Redirect Rules

---

## 2026-04-08 — LFPDPPP Consent System Implementation

**Overview**: Full implementation of a privacy-first, zero-cost cookie consent system enforcing LFPDPPP/GDPR compliance by strictly gating analytics.

**Features**:
- **Strict Opt-In Analytics**: Created `analytics-loader.ts` to dynamically inject Cloudflare Web Analytics and PostHog ONLY if `mada_consent` validation passes.
- **Preact Consent Island**: Developed `ConsentBanner.tsx` utilizing `useRef` metrics tracking to avoid costly React re-renders on scroll/mouse movement.
- **Supabase Forensics Pipeline**: Added `api/consent.ts` to capture native fingerprints (`crypto.subtle.digest` SHA-256 texts, Cloudflare IP geo-headers) directly to `consent_records`.
- **System Audit**: Created comprehensive report in [Consent_System_Audit.md](./Consent_System_Audit.md).

---

## 2026-03-28 — Solid Canvas UI/UX Refactor

### Phase 2 & 3: Global Component Styling

**Before**: Components used high-contrast gradients and hardcoded colors across sections.
**After**: Standardized on a semantic color system providing a "Solid Canvas" look mirroring the Next.js app.

Changes:
- **Global CSS**: Unified typography and color tokens mapped correctly to the Nature Light palette (primary, secondary, muted, accent, card, border).
- **Hero & About**: Refactored away from harsh gradients to deep-layered, solid neutral backgrounds with subtle shadow-depth.
- **SpecializedCare**: Replaced hardcoded stone/emerald with `bg-card` and `border-border`.
- **Testimonials**: Applied Solid Canvas aesthetics to the infinite marquee cards for improved text readability.
- **FAQ**: Modernized the accordion UI with semantic background and border classes over legacy gradients.
- **Contact**: Completely overhauled contact form and location cards replacing hardcoded stone with semantic tokens.
- **Header & Footer**: Refactored layout components to synchronize seamlessly with semantic background and foreground colors.
- **Animations**: Standardized `data-animate` attributes and stagger delays for consistent page entry.

Files changed:
- `tailwind.config.mjs`
- `src/styles/global.css`
- `src/components/layout/Header.astro` & `Footer.astro`
- `src/components/sections/Hero.astro`, `About.astro`, `Services.astro`, `SpecializedCare.astro`, `Testimonials.astro`, `FAQ.astro`, `Contact.astro`

---

## 2026-03-28 — UI Refactor: Contact, Services, Header

### Contact Section — Complete Rebuild

**Before**: Minimal section with WhatsApp link, booking CTA, and basic contact info.  
**After**: Premium glassmorphism layout (12KB, 142 lines).

Changes:
- Added **Formspree contact form** (`https://formspree.io/f/xbjnrvnq`) with 5 fields: name, email, phone, service selector, and message
- Integrated **dual Google Maps iframe embeds** — Dog Hotel (Héroes) and Cat Hotel (Jardines del Sol)
- Designed glassmorphism contact card (`bg-white/80 backdrop-blur-xl rounded-3xl`)
- Added WhatsApp button, phone link, and email link in responsive contact row
- Implemented `data-animate="slide-up"` staggered scroll-reveal (100ms–600ms delays)
- Added decorative radial gradient overlays (emerald top-right, teal bottom-left)
- Expanded i18n: new `Contact.locations.*`, `Contact.form.*` translation namespaces

Files changed:
- `src/components/sections/Contact.astro` — Complete rewrite
- `src/i18n/translations/es.json` — Contact namespace expansion
- `src/i18n/translations/en.json` — Contact namespace expansion

### Services Section — Tabbed AutoTabs Architecture

**Before**: Simple 3-card grid layout (2.5KB).  
**After**: 3-tab interactive system with auto-rotation (18KB, 364 lines).

Changes:
- Added 3 tabs: **Services** (hotel/daycare/transport cards), **Requirements** (health/vaccines/behavior checklists), **Pricing** (tiered rate cards)
- Implemented vanilla JS tab switching with auto-rotation (8-second interval) and animated progress bar
- Added `flatKey()` helper for accessing dot-notation translation keys within nested JSON
- Service cards now include highlight items with emoji icons
- Auto-rotation pauses on hover, resumes on mouseleave

Files changed:
- `src/components/sections/Services.astro` — Complete rewrite

### Header — Slim Profile & Glassmorphism Scroll

**Before**: Standard height nav with dark glassmorphism scroll effect (4.5KB).  
**After**: Slim `h-14` profile with transparent → white glassmorphism transition (15KB, 360 lines).

Changes:
- Reduced header height to `h-14` (matches `nextjs-app` Navbar)
- Changed scroll target from `bg-black/80 backdrop-blur-md` to `bg-white/95 backdrop-blur-md`
- Added `border-b border-transparent` default to eliminate CSS transition flash (Issue #9)
- Redesigned language switcher with dynamic border styling
- Replaced booking CTA button with phone CTA link
- Added `data-track-id` analytics attributes to all nav links
- Mobile menu now syncs header colors on open regardless of scroll position

Files changed:
- `src/components/layout/Header.astro` — Complete rewrite

---

## 2026-03-17 — Initial Project Scaffold

- Project initialized with Astro 5.7, Cloudflare adapter, Tailwind CSS 3.4
- Design system established: "Solid Canvas" with semantic color variables
- i18n system implemented with ES (default) + EN locales
- All marketing homepage sections scaffolded (Hero, About, Services, SpecializedCare, Testimonials, Gallery, FAQ, Contact)
- Layout components created (Header, Footer, BaseLayout, MarketingLayout)
- D1 database schema and migration scripts completed
- Booking system (wizard UI + API route + D1 logging) implemented
- Email integration via Brevo HTTP Transactional API
- PostHog analytics proxy configured
- SEO: JSON-LD structured data, meta tags, sitemap, robots.txt
- Privacy: Cookie consent banner, terms of service, privacy policy pages
- Deployment: Cloudflare Pages with Wrangler CLI

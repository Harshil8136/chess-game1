# 03 — File Inventory

Complete listing of every file in the `cf-astro/` project with its purpose, status, and key details.

> **Legend**: ✅ Complete | 🔨 In Progress | ⏳ Planned | 🐛 Had Issues (resolved)

---

## Root Configuration Files

| File | Size | Status | Purpose |
|---|---|---|---|
| `astro.config.ts` | 1.1KB | ✅🐛 | Astro framework config: Cloudflare adapter, Tailwind v4 via `@tailwindcss/vite`, i18n. `@astrojs/sitemap` removed — replaced by custom endpoints |
| `package.json` | 1.0KB | ✅🐛 | NPM dependencies and scripts |
| `tailwind.config.mjs` | 809B | ✅ | Tailwind v4 theme config with design token CSS variables |
| `tsconfig.json` | 472B | ✅ | TypeScript strict config with path aliases |
| `wrangler.toml` | 1.5KB | ✅ | Cloudflare bindings config (D1, R2, KV, vars); routes set to `madagascarhotelags.com/*` |
| `env.d.ts` | 473B | ✅ | TypeScript type declarations for Cloudflare runtime env |
| `.dev.vars` | 478B | ✅ | Local development secrets (Resend, PostHog, Sentry) |
| `.gitignore` | 235B | ✅ | Standard Astro + Cloudflare gitignore |

---

## Source Files (`src/`)

### Styles

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/styles/global.css` | 4.6KB | ✅🐛 | Global CSS: Tailwind directives, design tokens, base styles, animations |

### Internationalization (`src/i18n/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/i18n/config.ts` | 1.8KB | ✅ | Locale definitions, `t()` helper, translation loader, URL helpers |
| `src/i18n/translations/es.json` | ~10KB | ✅🐛 | Spanish translations (all sections, nav, footer, SEO metadata) |
| `src/i18n/translations/en.json` | ~10KB | ✅🐛 | English translations (all sections, nav, footer, SEO metadata) |

### Layouts (`src/layouts/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/layouts/BaseLayout.astro` | ~6KB | ✅ | HTML shell: full SEO/OG/Twitter/Article meta, hreflang (regex), geo meta, Apple PWA, resource hints, LCP preload, non-blocking fonts, Search Console tags, OpenSearch link, named `head` slot |
| `src/layouts/MarketingLayout.astro` | ~700B | ✅ | Wraps BaseLayout with Header + Footer; passes ogImage, ogType, preloadImage, keywords, articlePublishedTime, articleModifiedTime props |

### Layout Components (`src/components/layout/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/components/layout/Header.astro` | 15KB | ✅🐛 | Slim `h-14` nav bar with vanilla JS scroll transition (transparent → white glassmorphism), logo, desktop nav, language switcher, phone CTA, mobile menu with full color-swap |
| `src/components/layout/Footer.astro` | 5.6KB | ✅ | Site footer: brand, quick links, legal, contact info, WhatsApp |

### Section Components (`src/components/sections/`)

| File | Status | Purpose |
|---|---|---|
| `src/components/sections/Hero.astro` | ✅ | Full-screen hero: gradient overlay, background image, CTA buttons, trust badges, scroll indicator |
| `src/components/sections/About.astro` | ✅ | "Why choose us" section with feature list and stats grid |
| `src/components/sections/Services.astro` | ✅🐛 | 3-tab AutoTabs system (Services cards, Requirements checklist, Pricing table) with vanilla JS tab switching, auto-rotation, and progress bar (18KB) |
| `src/components/sections/SpecializedCare.astro` | ✅ | Add-on services: medication admin, transport, special diets |
| `src/components/sections/Testimonials.astro` | ✅ | Customer reviews/testimonials section |
| `src/components/sections/Gallery.astro` | ✅ | Image gallery section |
| `src/components/sections/FAQ.astro` | ✅ | Accordion FAQ items |
| `src/components/sections/Contact.astro` | ✅🐛 | Premium glassmorphism section with Formspree contact form, dual Google Maps iframes (Dog Hotel + Cat Hotel), WhatsApp/phone/email row, `data-animate` scroll reveal (12KB) |

### Island Components (`src/components/islands/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/components/islands/AutoTabs.tsx` | 9.5KB | ✅ | Preact island for tabbed UI with auto-rotation and progress indicator (currently unused — Services.astro uses vanilla JS equivalent) |

### Scripts (`src/scripts/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/scripts/scroll-reveal.ts` | 2.5KB | ✅ | IntersectionObserver engine: reveals `[data-animate]` elements on scroll with staggered `data-delay` support. Loaded in `MarketingLayout.astro` |

### SEO Components (`src/components/seo/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/components/seo/SchemaMarkup.astro` | ~8KB | ✅ | Homepage JSON-LD @graph: WebSite (SearchAction), WebPage (speakable), Hotel (2 locations, 3 reviews, amenityFeature), Organization (contactPoint[], knowsAbout, foundingDate 1994), FAQPage (7 Q&As, speakable), BreadcrumbList — all linked via @id anchors |
| `src/components/seo/ServicePageSchema.astro` | ~4KB | ✅ | Services page JSON-LD: WebPage + ItemList (8 services) + Offer/UnitPriceSpecification + areaServed chain |
| `src/components/seo/BlogPostSchema.astro` | ~3KB | ✅ | Blog post JSON-LD: BlogPosting (author, publisher, speakable, keywords) + BreadcrumbList (3 levels) |

### Pages (`src/pages/`)

| File | Status | Purpose |
|---|---|---|
| `src/pages/index.astro` | ✅ | Root `/` → `/es/` SSR redirect (works in dev + production Workers) |
| `src/pages/es/index.astro` | ✅ | Spanish homepage — assembles all section components |
| `src/pages/en/index.astro` | ✅ | English homepage — same structure, different locale |
| `src/pages/es/services.astro` | ✅ | Spanish services page — ServicePageSchema + keywords + LCP preload |
| `src/pages/en/services.astro` | ✅ | English services page — ServicePageSchema + keywords + LCP preload |
| `src/pages/es/blog/[slug].astro` | ✅ | Spanish blog post — BlogPostSchema, ogType=article, preloadImage |
| `src/pages/en/blog/[slug].astro` | ✅ | English blog post — BlogPostSchema, ogType=article, preloadImage |
| `src/pages/robots.txt.ts` | ✅ | Dynamic robots.txt: 30+ bots, AI crawlers allowed, SEO tools throttled, `Host:` directive, sitemap pointer |
| `src/pages/sitemap-index.xml.ts` | ✅ | Sitemap master index — dynamic lastmod from blog collection |
| `src/pages/sitemap-es.xml.ts` | ✅ | Spanish sitemap — all pages + blog posts + `xhtml:link` hreflang per URL |
| `src/pages/sitemap-en.xml.ts` | ✅ | English sitemap — mirror of ES with reduced priorities |
| `src/pages/sitemap-images.xml.ts` | ✅ | Image sitemap — 12 images with `image:image` extension + geo_location |

### API Routes (`src/pages/api/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/pages/api/booking.ts` | 5.5KB | ✅ | POST handler: Zod validation → D1 insert → Brevo email → WhatsApp fallback |
| `src/pages/api/ingest/[...path].ts` | 1.3KB | ✅ | PostHog reverse proxy (ad-blocker bypass) |
| `src/pages/api/privacy/arco.ts` | 1.7KB | ✅ | ARCO privacy data request handler (Mexican data protection law) |

### Library Utilities (`src/lib/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `src/lib/schemas/booking.ts` | 1.9KB | ✅ | Zod schemas: `petSchema`, `bookingSchema`, `generateBookingRef()` |
| `src/lib/email/send-email.ts` | 1.7KB | ✅ | Resend HTTP API email sender (via Cloudflare Queue producer) |
| `src/lib/email/templates.ts` | 6.6KB | ✅ | HTML email templates: staff notification + customer receipt |

---

## Public Assets (`public/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `public/_headers` | ~1.2KB | ✅ | Cloudflare Pages security headers: CSP (with `cdn.madagascarhotelags.com` in img-src), COOP, CORP, HSTS; per-path cache rules for SEO files |
| `public/_redirects` | ~200B | ✅ | Domain redirects: `/` → `/es/`, www + pet subdomain + pages.dev → apex domain (301) |
| `public/manifest.webmanifest` | ~1.5KB | ✅ | Enhanced PWA manifest: `id`, shortcuts (Reservar/Servicios/WhatsApp), screenshots, categories |
| `public/sw.js` | 1.5KB | ✅ | Service worker: cache-first static, network-only API, offline fallback |
| `public/llms.txt` | ~500w | ✅ | Concise AI context file (GEO/AIO 2026 standard) for LLM crawlers |
| `public/llms-full.txt` | ~5000w | ✅ | Extended AI context: all services, facilities, pricing, FAQs, certifications |
| `public/.well-known/security.txt` | ~200B | ✅ | RFC 9116 security disclosure (contact, expiry, languages) |
| `public/opensearch.xml` | ~300B | ✅ | Browser address bar search integration |
| `public/images/` | Dir | ⏳ | Image assets (to be populated from R2 or copied from nextjs-app) |

---

## Database (`db/`)

| File | Size | Status | Purpose |
|---|---|---|---|
| `db/migrations/0001_initial_schema.sql` | 3.3KB | ✅ | Full D1 schema: bookings, booking_pets, quality_metadata, consent_records, privacy_requests, site_settings + indexes |

---

## Documentation (`docs/`)

| File | Status | Purpose |
|---|---|---|
| `docs/plans/2026-03-17-tailwind-build-crash-resolution.md` | ✅ | Design doc: Astro 5 + Tailwind v4 crash analysis & resolution plan |

---

## Build Artifacts (not committed)

| Path | Purpose |
|---|---|
| `dist/` | Astro build output (Pages deployment bundle) |
| `.astro/` | Astro internal type generation |
| `.wrangler/` | Wrangler local state (D1 database, R2 data) |
| `node_modules/` | NPM packages |

---

## Debug Files (temporary, can be deleted)

| File | Size | Purpose |
|---|---|---|
| `build_error.txt` | 5.7KB | Captured output from a failed build for debugging |
| `debug_build.txt` | 213KB | Verbose build log captured during Tailwind v4 crash investigation |

# 13 — SEO, AEO, GEO, SXO, AIO — Complete Optimization Guide

> **Last Updated:** 2026-04-13  
> **Status:** Production-ready — deployed to `madagascarhotelags.com`

This document covers every search and AI engine optimization implemented in cf-astro: classical SEO, Answer Engine Optimization (AEO), Generative Engine Optimization (GEO), Search Experience Optimization (SXO), AI Indexing Optimization (AIO), and Local SEO (LSEO).

---

## 1. Optimization Disciplines Overview

| Discipline | What It Targets | Key Implementation |
|---|---|---|
| **SEO** | Google/Bing indexing & ranking | Canonical, hreflang, meta, structured data, sitemaps |
| **AEO** | Featured snippets, voice search | FAQPage schema, speakable, Q&A structure |
| **GEO** | Generative AI summaries (SGE, Perplexity) | Entity-rich schema, llms.txt, clear content structure |
| **SXO** | Core Web Vitals, user experience | LCP preload, non-blocking fonts, resource hints |
| **AIO** | LLM crawlers, AI agent indexing | llms.txt + llms-full.txt, AI bot access in robots.txt |
| **LSEO** | Google Maps, local pack | Geo meta, LocalBusiness schema, GBP signals |

---

## 2. Schema.org JSON-LD Graph Architecture

All structured data uses a **linked graph** — entities reference each other via `@id` anchors. This produces a single coherent knowledge graph per page.

### 2.1 Homepage Schema Graph (`SchemaMarkup.astro`)

Used only on homepage (`/es/` and `/en/`). Emits 6 schema types linked by @id:

```
https://madagascarhotelags.com/#website
  ↓ (potentialAction → SearchAction)
https://madagascarhotelags.com/#hotel
  ↓ (brand → #organization)
https://madagascarhotelags.com/#organization
  ↓ (contactPoint → ContactPoint[])
https://madagascarhotelags.com/#faq
  ↓ (speakable → cssSelector)
https://madagascarhotelags.com/#breadcrumb
https://madagascarhotelags.com/#webpage
  ↓ (speakable → cssSelector)
```

**Schema Types**:

| @id | Type | Key Fields |
|---|---|---|
| `/#website` | WebSite | name, url, potentialAction (SearchAction) |
| `/#webpage` | WebPage | breadcrumb ref, speakable, inLanguage |
| `/#hotel` | Hotel + LodgingBusiness | name, address (2 locations), telephone, amenityFeature, hasMap, reviews, brand ref |
| `/#organization` | Organization | name, foundingDate (1994), contactPoint[], knowsAbout[], sameAs (social links) |
| `/#faq` | FAQPage | 7 Q&A pairs, speakable cssSelector `#faq-section` |
| `/#breadcrumb` | BreadcrumbList | itemListElement[] |

### 2.2 Services Page Schema (`ServicePageSchema.astro`)

Used on `/es/services` and `/en/services`. Emits 3 schema types:

| Type | Key Fields |
|---|---|
| WebPage | name, description, inLanguage, breadcrumb |
| ItemList | 8 services with ListItem entries |
| Service (×8) | name, description, provider ref, areaServed, Offer with UnitPriceSpecification |

**Pricing in Schema**:
```json
{
  "@type": "Offer",
  "priceSpecification": {
    "@type": "UnitPriceSpecification",
    "price": 286,
    "priceCurrency": "MXN",
    "unitText": "night"
  }
}
```

### 2.3 Blog Post Schema (`BlogPostSchema.astro`)

Used on every blog post (`/es/blog/[slug]` and `/en/blog/[slug]`). Emits 2 schema types:

| Type | Key Fields |
|---|---|
| BlogPosting | headline, description, author (Organization @id ref), publisher, image (ImageObject), speakable, keywords array, datePublished, dateModified |
| BreadcrumbList | 3 levels: Home → Blog → Post Title |

**Props accepted**:
```typescript
interface Props {
  locale: 'es' | 'en';
  title: string;
  description: string;
  publishedDate: Date;
  modifiedDate?: Date;
  author?: string;
  coverImage?: string;
  slug: string;
  tags?: string[];
}
```

### 2.4 @id Anchor System

Maintain these anchors **consistently** across all schema components:

| Anchor | Component | Schema Type |
|---|---|---|
| `/#website` | SchemaMarkup.astro | WebSite |
| `/#hotel` | SchemaMarkup.astro | Hotel |
| `/#organization` | SchemaMarkup.astro | Organization |
| `/#faq` | SchemaMarkup.astro | FAQPage |
| `/#breadcrumb` | SchemaMarkup.astro | BreadcrumbList |
| `/[lang]/blog/[slug]#article` | BlogPostSchema.astro | BlogPosting |
| `/[lang]/services#webpage` | ServicePageSchema.astro | WebPage |

**Critical Rule**: Never emit two schema nodes with the same @id on the same page. SchemaMarkup.astro is only used on homepages — ServicePageSchema and BlogPostSchema handle all other pages.

---

## 3. Meta Tags System (`BaseLayout.astro`)

### 3.1 Core SEO Meta

```astro
<title>{title} — Hotel para Mascotas Madagascar</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonicalUrl} />
{keywords && <meta name="keywords" content={keywords} />}
{noIndex && <meta name="robots" content="noindex, nofollow" />}
```

### 3.2 Hreflang Implementation

**Critical**: Uses regex-based URL swapping to prevent false matches when locale string appears in content paths.

```typescript
// Correct (regex, captures host + trailing slash)
const altUrl = canonicalUrl.replace(
  new RegExp(`^(https?://[^/]+)/${locale}(/|$)`),
  `$1/${altLocale}$2`
);

// Wrong (fragile — would break /en/services if path contains locale string)
// const altUrl = canonicalUrl.replace(`/${locale}`, `/${altLocale}`);
```

**Output**:
```html
<link rel="alternate" hreflang="es-MX" href="https://madagascarhotelags.com/es/" />
<link rel="alternate" hreflang="en-US" href="https://madagascarhotelags.com/en/" />
<link rel="alternate" hreflang="x-default" href="https://madagascarhotelags.com/es/" />
```

`x-default` always points to the Spanish version (primary market).

### 3.3 Open Graph (Full Implementation)

```html
<!-- Core OG -->
<meta property="og:type" content={ogType} />  <!-- website | article | product -->
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalUrl} />
<meta property="og:site_name" content="Hotel para Mascotas Madagascar" />
<meta property="og:locale" content={locale === 'es' ? 'es_MX' : 'en_US'} />
<meta property="og:locale:alternate" content={locale === 'es' ? 'en_US' : 'es_MX'} />

<!-- OG Image (full spec) -->
<meta property="og:image" content={ogImageAbsUrl} />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content={title} />
<meta property="og:updated_time" content={new Date().toISOString()} />

<!-- Article OG (conditional on ogType === 'article') -->
<meta property="article:published_time" content={articlePublishedTime} />
<meta property="article:modified_time" content={articleModifiedTime} />
<meta property="article:author" content="Hotel para Mascotas Madagascar" />
```

### 3.4 Twitter Cards

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@hotelmadagascar" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={ogImageAbsUrl} />
<meta name="twitter:image:alt" content={title} />
```

### 3.5 Local SEO Geo Meta

```html
<meta name="geo.region" content="MX-AGS" />
<meta name="geo.placename" content="Aguascalientes, Mexico" />
<meta name="geo.position" content="21.8853;-102.2916" />
<meta name="ICBM" content="21.8853, -102.2916" />
```

### 3.6 Apple PWA Meta

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Madagascar" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

### 3.7 Search Console Verification Tags

```html
<meta name="google-site-verification" content="[REAL_KEY_IN_BaseLayout.astro]" />
<!-- Bing: uncomment and add key after GSC import -->
<!-- <meta name="msvalidate.01" content="[BING_KEY]" /> -->
<!-- IndexNow: uncomment after setting up key -->
<!-- <meta name="indexnow-verification" content="[INDEXNOW_KEY]" /> -->
```

### 3.8 Resource Hints (SXO)

```html
<!-- Preconnect (critical path) -->
<link rel="preconnect" href="https://cdn.madagascarhotelags.com" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

<!-- DNS Prefetch (non-critical third-parties) -->
<link rel="dns-prefetch" href="https://us.i.posthog.com" />
<link rel="dns-prefetch" href="https://static.cloudflareinsights.com" />
<link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
<link rel="dns-prefetch" href="https://o4506980.ingest.us.sentry.io" />
```

### 3.9 LCP Preload (SXO)

When `preloadImage` prop is provided, a high-priority `<link rel="preload">` is injected:

```html
<link rel="preload" as="image" href={preloadImage} fetchpriority="high" />
```

Pages that pass `preloadImage`:
- `/es/` and `/en/` — hero image
- `/es/services` and `/en/services` — `"/images/boarding.jpg"`
- Blog posts — `post.data.coverImage`

### 3.10 Non-Blocking Google Fonts (SXO)

```html
<!-- Load as print first, switch to all on load (no render blocking) -->
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
  media="print"
  onload="this.media='all'"
/>
<!-- Fallback for users with JS disabled -->
<noscript>
  <link rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
  />
</noscript>
```

---

## 4. Sitemap Architecture

### 4.1 Why Custom Sitemaps (Not @astrojs/sitemap)

`@astrojs/sitemap` cannot emit `xhtml:link` hreflang annotations **inside** each `<url>` element. It only supports sitemap-level i18n config, which is insufficient for proper bilingual SEO. The integration was removed from `astro.config.ts`.

### 4.2 Custom Sitemap Endpoints

All sitemaps are TypeScript API endpoints that render XML at build time (`prerender = true`).

| File | URL | Purpose |
|---|---|---|
| `src/pages/sitemap-index.xml.ts` | `/sitemap-index.xml` | Master index pointing to all sub-sitemaps |
| `src/pages/sitemap-es.xml.ts` | `/sitemap-es.xml` | Spanish pages with xhtml:link hreflang per URL |
| `src/pages/sitemap-en.xml.ts` | `/sitemap-en.xml` | English pages with xhtml:link hreflang per URL |
| `src/pages/sitemap-images.xml.ts` | `/sitemap-images.xml` | Google Image Search sitemap |

### 4.3 Sitemap Index Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://madagascarhotelags.com/sitemap-es.xml</loc>
    <lastmod>2026-04-13</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://madagascarhotelags.com/sitemap-en.xml</loc>
    <lastmod>2026-04-13</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://madagascarhotelags.com/sitemap-images.xml</loc>
    <lastmod>2026-04-13</lastmod>
  </sitemap>
</sitemapindex>
```

### 4.4 Per-Language Sitemap Format (with Hreflang)

```xml
<url>
  <loc>https://madagascarhotelags.com/es/</loc>
  <lastmod>2026-04-13</lastmod>
  <changefreq>monthly</changefreq>
  <priority>1.0</priority>
  <xhtml:link rel="alternate" hreflang="es-MX"
    href="https://madagascarhotelags.com/es/" />
  <xhtml:link rel="alternate" hreflang="en-US"
    href="https://madagascarhotelags.com/en/" />
  <xhtml:link rel="alternate" hreflang="x-default"
    href="https://madagascarhotelags.com/es/" />
</url>
```

Required XML namespace:
```xml
xmlns:xhtml="http://www.w3.org/1999/xhtml"
```

### 4.5 Page Priority Scheme

| Page | ES Priority | EN Priority |
|---|---|---|
| Homepage | 1.0 | 0.9 |
| Services | 0.9 | 0.8 |
| Booking | 0.9 | 0.8 |
| Blog index | 0.7 | 0.6 |
| Blog posts | 0.6 (dynamic) | 0.5 (dynamic) |
| Franchise | 0.6 | 0.5 |

### 4.6 Image Sitemap Format

```xml
<url>
  <loc>https://madagascarhotelags.com/es/</loc>
  <image:image>
    <image:loc>https://cdn.madagascarhotelags.com/images/boarding.jpg</image:loc>
    <image:title>Pensión canina — Hotel para Mascotas Madagascar</image:title>
    <image:caption>Instalaciones de pensión canina con todo incluido en Aguascalientes</image:caption>
    <image:geo_location>Aguascalientes, México</image:geo_location>
    <image:license>https://madagascarhotelags.com/es/</image:license>
  </image:image>
</url>
```

Required namespace: `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`

---

## 5. Robots.txt Strategy

`robots.txt` is a **dynamic TypeScript endpoint** at `src/pages/robots.txt.ts` (not a static `public/robots.txt`). This allows conditional logic and easier maintenance.

### 5.1 General Bot Policy

```
User-agent: *
Disallow: /api/
Disallow: /_astro/
Allow: /
Sitemap: https://madagascarhotelags.com/sitemap-index.xml
Host: https://madagascarhotelags.com
```

`Host:` directive helps Yandex and some crawlers resolve canonical domain during migration.

### 5.2 AI Bot Access Policy (AIO)

**All major AI/LLM crawlers are explicitly ALLOWED** to ensure AI systems can index content for generative responses:

| Bot | Company | Policy |
|---|---|---|
| GPTBot | OpenAI | ✅ Allow |
| ChatGPT-User | OpenAI | ✅ Allow |
| ClaudeBot | Anthropic | ✅ Allow |
| Claude-Web | Anthropic | ✅ Allow |
| PerplexityBot | Perplexity | ✅ Allow |
| Grok | xAI / Twitter | ✅ Allow |
| xAI-Bot | xAI | ✅ Allow |
| DeepSeekBot | DeepSeek | ✅ Allow |
| Meta-ExternalAgent | Meta | ✅ Allow |
| GeminiBot | Google | ✅ Allow |
| YouBot | You.com | ✅ Allow |
| PhindBot | Phind | ✅ Allow |

### 5.3 SEO Tool Throttling

```
User-agent: AhrefsBot
User-agent: SemrushBot
User-agent: MJ12bot
User-agent: DotBot
Crawl-delay: 10
```

### 5.4 Data Collection Blocking

```
User-agent: CCBot
User-agent: Common Crawl Bot
User-agent: DataForSeoBot
User-agent: BLEXBot
Disallow: /
```

### 5.5 llms.txt References

The robots.txt includes comments pointing AI crawlers to the llms.txt files:
```
# AI Context Files:
# https://madagascarhotelags.com/llms.txt
# https://madagascarhotelags.com/llms-full.txt
```

---

## 6. LLMs.txt — AI Context Files (AIO/GEO)

Two files serve AI crawlers and language models:

### 6.1 `/llms.txt` — Concise Summary

Located at `public/llms.txt`. ~500 words. Format follows the 2026 llms.txt standard (similar to Anthropic's specification).

Content:
- Business summary (1 paragraph)
- Quick reference table: services, prices, location
- Key differentiators (30+ years, bilingual, 24/7 vet, 2 locations)
- Links to all major pages (es + en versions)
- Reference to llms-full.txt for extended information

### 6.2 `/llms-full.txt` — Extended Context

Located at `public/llms-full.txt`. ~5000 words. Plain Markdown.

Content:
- All 8 services fully described (boarding canino/felino, guardería, transporte, etc.)
- Facilities details (solarium catio, multi-level rooms, etc.)
- Entry requirements (vaccines, health certificate)
- Full pricing table (MXN)
- 20+ FAQs
- Geographic service area (Aguascalientes metro)
- Certifications and competitive advantages
- Contact information and hours

### 6.3 Why llms.txt Matters (2026)

LLMs and AI search engines (Perplexity, ChatGPT with web search, Google AI Overviews) crawl websites and synthesize answers. Without llms.txt:
- AI systems guess at business details, often incorrectly
- Competitors with llms.txt appear in AI-generated answers first
- Complex websites are summarized poorly

With llms.txt, the business explicitly provides AI-optimized context that LLMs prefer over parsing unstructured HTML.

---

## 7. Domain Migration Setup

### 7.1 Target State

| Incoming URL | Destination | Method |
|---|---|---|
| `https://www.madagascarhotelags.com/*` | `https://madagascarhotelags.com/:splat` | 301 |
| `https://pet.madagascarhotelags.com/*` | `https://madagascarhotelags.com/:splat` | 301 |
| `https://cf-astro.pages.dev/*` | `https://madagascarhotelags.com/:splat` | 301 |
| `https://madagascarhotelags.com/` | `https://madagascarhotelags.com/es/` | 301 |

### 7.2 `public/_redirects` (Worker-level)

```
/   /es/  301
```

Only the root locale redirect is here. This project deploys as a **Cloudflare Worker** via `wrangler deploy`, and Workers `_redirects` only supports relative URLs. Absolute `https://` cross-domain redirects are rejected at deploy time (error code 10021).

The www/pet/pages.dev → apex redirects **must** be configured in the Cloudflare Dashboard as Redirect Rules (see section 7.4).

### 7.3 `wrangler.toml` — No Routes Block Needed

For Cloudflare **Pages** projects, custom domains are set in the Dashboard only. The `[[routes]]` section in `wrangler.toml` is for plain Workers — it does not apply to Pages and will cause a deploy error if used with wildcards or `custom_domain = true`.

The `wrangler.toml` contains only a comment documenting the required Dashboard steps.

### 7.4 Required Cloudflare Dashboard Steps (Manual — Cannot Automate)

1. **Add custom domain** in Pages project settings → `madagascarhotelags.com`
2. **Create Redirect Rule #1**: `pet.madagascarhotelags.com/*` → `https://madagascarhotelags.com/${path}` (301)
3. **Create Redirect Rule #2**: `www.madagascarhotelags.com/*` → `https://madagascarhotelags.com/${path}` (301)
4. **Create Redirect Rule #3**: `cf-astro.pages.dev/*` → `https://madagascarhotelags.com/${path}` (301)

Use **Redirect Rules** (not deprecated Page Rules). Go to: Cloudflare Dashboard → Domain → Rules → Redirect Rules.

---

## 8. Search Console Setup

### 8.1 Google Search Console

1. Add **Domain property** (not URL prefix) for `madagascarhotelags.com`
2. Verify via DNS TXT record (Cloudflare: Zone DNS → Add TXT record)
3. Submit sitemap: `https://madagascarhotelags.com/sitemap-index.xml`
4. On old `pet.madagascarhotelags.com` property → Settings → Change of Address → select new property

### 8.2 Bing Webmaster Tools

1. Go to [bing.com/webmasters](https://bing.com/webmasters)
2. **Import from Google Search Console** (auto-verifies via GSC connection — fastest path)
3. Submit sitemap: `https://madagascarhotelags.com/sitemap-index.xml`
4. Get Bing verification meta tag, add to `BaseLayout.astro`:
   ```html
   <meta name="msvalidate.01" content="[YOUR_KEY]" />
   ```
   (Currently commented out in BaseLayout — just uncomment and fill the key)

### 8.3 IndexNow

IndexNow instantly submits URLs to Bing/Yandex when content changes. Full setup:

1. Generate a key (any random UUID)
2. Place key file at: `public/[key].txt` (contents: the key)
3. Uncomment and fill in BaseLayout:
   ```html
   <meta name="indexnow-verification" content="[KEY]" />
   ```
4. In `/api/revalidate.ts` (CMS invalidation endpoint), add after KV cache clear:
   ```typescript
   await fetch(`https://api.indexnow.org/indexnow`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       host: 'madagascarhotelags.com',
       key: env.INDEXNOW_KEY,
       keyLocation: `https://madagascarhotelags.com/${env.INDEXNOW_KEY}.txt`,
       urlList: [updatedUrl]
     })
   });
   ```

### 8.4 Google Business Profile

Update GBP website URL from old subdomain to:
`https://madagascarhotelags.com`

---

## 9. PWA Manifest Enhancements

`public/manifest.webmanifest` was enhanced for better installability and search integration:

### 9.1 Key Fields Added

```json
{
  "id": "/?source=pwa",
  "start_url": "/es/?source=pwa",
  "scope": "/",
  "categories": ["lifestyle", "business", "health"],
  "prefer_related_applications": false
}
```

### 9.2 Shortcuts (App Install UX)

```json
"shortcuts": [
  {
    "name": "Reservar Ahora",
    "url": "/es/booking",
    "icons": [{"src": "/icons/icon-96.png", "sizes": "96x96"}]
  },
  {
    "name": "Servicios y Precios",
    "url": "/es/services",
    "icons": [{"src": "/icons/icon-96.png", "sizes": "96x96"}]
  },
  {
    "name": "WhatsApp",
    "url": "https://wa.me/524494485486",
    "icons": [{"src": "/icons/icon-96.png", "sizes": "96x96"}]
  }
]
```

### 9.3 Screenshots (Rich Install Prompt)

```json
"screenshots": [
  {
    "src": "/images/boarding.jpg",
    "sizes": "1280x720",
    "type": "image/jpeg",
    "form_factor": "wide",
    "label": "Pensión canina con todo incluido"
  },
  {
    "src": "/images/gallery1.jpg",
    "sizes": "390x844",
    "type": "image/jpeg",
    "form_factor": "narrow",
    "label": "Hotel para Mascotas Madagascar"
  }
]
```

---

## 10. Security.txt

Located at `public/.well-known/security.txt`. Standard RFC 9116 format:

```
Contact: mailto:admin@madagascarhotelags.com
Expires: 2027-04-13T00:00:00.000Z
Preferred-Languages: es, en
Canonical: https://madagascarhotelags.com/.well-known/security.txt
```

---

## 11. OpenSearch Integration

Located at `public/opensearch.xml`. Enables browser address bar search integration (Firefox, Chrome search shortcuts):

```xml
<OpenSearchDescription>
  <ShortName>Madagascar Mascotas</ShortName>
  <Description>Buscar servicios y precios de Hotel para Mascotas Madagascar</Description>
  <Url type="text/html" template="https://madagascarhotelags.com/{language}/services?q={searchTerms}" />
</OpenSearchDescription>
```

Referenced in `BaseLayout.astro`:
```html
<link rel="search" type="application/opensearchdescription+xml"
  title="Madagascar Mascotas"
  href="/opensearch.xml" />
```

---

## 12. Content Security Policy

Defined in `public/_headers`. Key `img-src` directive:

```
img-src 'self' blob: data: *.r2.dev cdn.madagascarhotelags.com
```

**Critical**: `cdn.madagascarhotelags.com` (CDN subdomain for R2 images) must be in `img-src`. If missing, R2-served images will be blocked by browser CSP even though they load from your own CDN.

`connect-src` includes `api.indexnow.org` for client-side IndexNow calls.

Additional headers added in 2026-04-13 update:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: unsafe-none
Cross-Origin-Resource-Policy: same-site
```

---

## 13. Core Web Vitals Targets (SXO)

| Metric | Target | Current Implementation |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | `fetchpriority="high"` preload on hero/boarding images |
| INP (Interaction to Next Paint) | < 200ms | Minimal JS, Preact islands, no main-thread blocking |
| CLS (Cumulative Layout Shift) | < 0.1 | Explicit image dimensions, non-blocking fonts |
| TTFB (Time to First Byte) | < 600ms | Static pages from CDN edge (300+ cities) |
| FID → INP | < 200ms | No heavy event listeners on initial load |

---

## 14. Validation & Testing Checklist

After deploy, verify:

- [ ] `https://madagascarhotelags.com/sitemap-index.xml` — returns valid XML
- [ ] `https://madagascarhotelags.com/sitemap-es.xml` — contains `xhtml:link` hreflang tags
- [ ] `https://madagascarhotelags.com/sitemap-images.xml` — contains `image:image` entries
- [ ] `https://madagascarhotelags.com/robots.txt` — shows AI bot `Allow:` directives
- [ ] `https://madagascarhotelags.com/llms.txt` — returns Markdown content
- [ ] `https://madagascarhotelags.com/llms-full.txt` — returns extended Markdown content
- [ ] `https://madagascarhotelags.com/.well-known/security.txt` — returns contact info
- [ ] `https://madagascarhotelags.com/opensearch.xml` — returns OpenSearch XML
- [ ] Homepage `<head>` — contains `<script type="application/ld+json">` with @graph
- [ ] Services page — contains ServicePageSchema JSON-LD
- [ ] Blog post — contains BlogPostSchema JSON-LD with BlogPosting type
- [ ] Hreflang tags present in `<head>` on all pages
- [ ] OG image meta tags present (use [opengraph.xyz](https://opengraph.xyz) to test)
- [ ] Twitter Card meta tags present
- [ ] Geo meta tags present (`geo.region`, `geo.placename`)
- [ ] [Google Rich Results Test](https://search.google.com/test/rich-results) — passes for Hotel, FAQ, Breadcrumb, BlogPosting
- [ ] [Schema.org Validator](https://validator.schema.org) — no errors on @graph
- [ ] Lighthouse SEO score ≥ 95
- [ ] `robots.txt` 301 redirects (pet.→apex, www.→apex) working

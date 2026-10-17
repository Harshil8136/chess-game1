{% raw %}
# Frontend UI, PWA & Search Engine Optimization Manual

This manual serves as the comprehensive visual and search architecture handbook for the **cf-astro** project. It details the nature-inspired design system, Tailwind CSS v4 setup, component hydration, scroll-reveal animation engine, PWA caching, multi-dimensional search optimization (classical, maps, voice, AI search), custom sitemap endpoints, and client-side Sentry error budget configurations.

---

## 1. Design System & Brand Identity

The interface for **Hotel para Mascotas Madagascar** features a modern, premium, nature-inspired visual design tailored to promote pet comfort, luxury, and professional security.

### 1.1 Typography

- **Body font**: DM Sans, a self-hosted variable font (`/fonts/dm-sans-variable-latin.woff2`, `font-display: swap`).
- **Heading font**: Outfit, also self-hosted (`/fonts/outfit-variable-latin.woff2`).
- **CSS tokens**: `--font-sans: 'DM Sans', sans-serif;` and `--font-heading: 'Outfit', sans-serif;`. No Google Fonts request is made.

### 1.2 Theme Palette & Tailwind CSS v4 Setup

The styling system was upgraded to **Tailwind CSS v4** utilizing `@tailwindcss/vite`. Design tokens are defined natively as CSS custom properties inside `src/styles/global.css`:

| Token               | Value     | Tailwind Class                    | Semantic Context                                            |
| ------------------- | --------- | --------------------------------- | ----------------------------------------------------------- |
| `--color-primary`   | `#4a8000` | `bg-primary` / `text-primary`     | Main CTA buttons and brand marks (4.73:1 on white, WCAG AA) |
| `--color-secondary` | `#0ea5e9` | `bg-secondary` / `text-secondary` | Ocean blue accents                                          |
| `--color-accent`    | `#0d9488` | `bg-accent` / `text-accent`       | Teal highlights                                             |
| `--color-muted`     | `#f8fafc` | `bg-muted`                        | Light surfaces and card backgrounds                         |

The full "Obsidian & Lime" palette, including the dark surface tokens, is the `@theme` block
of `src/styles/global.css`.

### 1.3 Glassmorphism UI Patterns

Premium glass overlays are implemented using Tailwind's backdrop filters to produce a premium visual experience:

- **Transparent Base Header**: `bg-black/20 backdrop-blur-sm border-transparent`
- **Active Scrolled Header**: `bg-white/95 backdrop-blur-md border-gray-100 shadow-sm`

> [!TIP]
> **CSS Interpolation Transition Flash Prevention**
> When constructing CSS transitions that modify borders on scroll, always declare `border-transparent` on the initial transparent element. If omitted, browsers default to interpolating from `currentColor` (which is often white or black), resulting in a bright 1px flashing line during scroll transitions.

---

## 2. Component Hydration & Island Architecture

The frontend follows Astro's **island architecture** model to deliver near-zero client JS. Dynamic Preact islands are loaded selectively where rich state manipulation is mandatory:

```
┌──────────────────────────────────────────────────────────────┐
│  MarketingLayout (prerendered HTML)                          │
│                                                              │
│  [Header]           static HTML, small scroll script         │
│  [Hero]             zero JS, preloaded LCP image             │
│  [AutoTabs]         Preact island, client:idle               │
│  [InfiniteGallery]  Preact island, client:visible            │
│  [BookingWizard]    Preact island, client:load (/booking)    │
│  [ConsentBanner]    Preact island, client:idle (BaseLayout)  │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 Preact Island Inventory

| Island                | Hydration        | Where                                                            |
| --------------------- | ---------------- | ---------------------------------------------------------------- |
| `BookingWizard`       | `client:load`    | `/es/booking/`, `/en/booking/`, inside `SentryErrorBoundary`     |
| `SentryErrorBoundary` | `client:load`    | wraps the booking wizard                                         |
| `ConsentBanner`       | `client:idle`    | every page (`BaseLayout.astro`); blocks analytics until accepted |
| `AutoTabs`            | `client:idle`    | the services section                                             |
| `InfiniteGallery`     | `client:visible` | the gallery section, when CMS images exist                       |
| `ArcoForm`            | `client:load`    | `/es/legal/arco/`, `/en/legal/arco/` (Turnstile)                 |
| `FranchiseClient`     | `client:load`    | `/es/franchise/`, `/en/franchise/`                               |

---

## 3. Interaction, Motion & PWAs

### 3.1 Interaction Scroll-Reveal Engine

Animations are powered by a unified Intersection Observer engine defined in `src/scripts/scroll-reveal.ts`:

- **Syntax**: Elements are tagged with `data-animate="slide-up"`, `data-delay="200"`, etc.
- **Performance**: Vanilla JS sets the active state once inside a `requestAnimationFrame` loop, guaranteeing zero layout thrashing.
- **Accessibility**: Motion transitions are automatically suppressed if the user has requested reduced motion (`@media (prefers-reduced-motion: reduce)`).

### 3.2 Progressive Web App (PWA) Capabilities

- **`public/manifest.webmanifest`**: Configures the app to run in `standalone` display mode, mapping corporate colors, splash vectors, and custom launch shortcuts.
- **`public/sw.js`**: Custom Service Worker: **network-first** for HTML pages, **cache-first** for hashed `/_astro/*` assets, **stale-while-revalidate** for images and fonts, and **network-only** for `/api/*` and analytics. Non-GET requests are never touched.

---

## 4. Multi-Dimensional Search Optimization (SEO / SXO / AIO)

The site is optimized to satisfy traditional crawler bots, local pack maps, and generative AI search agents:

### 4.1 Linked JSON-LD Knowledge Graphs

All structured schema graphs (`src/components/seo/`) are generated using linked `@id` hashes so search engines understand the relationships between the entities:

```
[WebSite] ──► (@id: "#website")
   │
   ├─► [Organization] ──► (@id: "#organization")
   │
   └─► [WebPage] ──► (@id: "#webpage")
          │
          ├─► [LocalBusiness] ──► (@id: "#business")
          │
          └─► [BreadcrumbList] ──► (Nav hierarchy)
```

> [!IMPORTANT]
> **Technical SEO GSC Corrective Actions**
>
> 0. **No FAQPage markup**: Google retired FAQ rich results, so FAQ content stays in the HTML (AI engines quote it) but no component emits `FAQPage` JSON-LD (`SEO-OPERATIONS.md` §9).
> 1. **Schema Sitelinks Searchbox Removal**: The literal Google SearchAction template containing `?q={search_term_string}` was completely removed from `SchemaMarkup.astro`. Since this local business site does not have a dynamic internal search bar, this prevents Googlebot from crawling syntax error placeholders, clearing GSC redirects/404 reports.
> 2. **Legal Pages Re-indexation**: The `noIndex={true}` directive was removed from the frontmatter of all core Spanish and English terms, privacy, and ARCO pages. Indexing these documents signals corporate trust, improving the site's overall E-E-A-T domain validation score.
> 3. **Non-HTML Asset Control**: Added strict `X-Robots-Tag: noindex` headers inside `public/_headers` for static system endpoints like `manifest.webmanifest` and `favicon.ico` to preserve crawl budget.

### 4.2 Dynamic Bilingual Sitemap API

Because the default `@astrojs/sitemap` integration cannot embed crucial locale references inside XML nodes, the sitemaps are custom endpoints, rendered on demand by the Worker (`export const prerender = false`) so a new blog post appears without a deploy:

- `/sitemap-index.xml`: Main index file referencing the language-specific sitemaps.
- `/sitemap-es.xml` / `/sitemap-en.xml`: Emits exact bilingual `<url>` nodes featuring nested `<xhtml:link rel="alternate" hreflang="..." href="...">` elements for precise SEO routing.

**What a blog sitemap lists (since 2026-10-10).** Each post once, in the version that is served (D1 wins over the bundled Markdown copy on a slug). Its tags come from that version only, so the raw tags of a Markdown post that cf-admin has re-published (`pensión`, `high season`) are no longer listed; their tag pages are 404s. An `hreflang` alternate is listed only when the other locale publishes the `translation_slug`, the same check the post page makes before emitting its `<link rel="alternate">` (`src/lib/blog-sitemap.ts`, [record](records/2026-10-10-blog-seo-audit-fixes.md)).

**BlogPosting entities (since 2026-10-10).** A byline that names the business resolves to the `#organization` node with the home page's name; any other byline is a `Person`. `publisher` carries the name and logo on the post itself (`src/lib/blog-schema.ts`).

**Feed cache (since 2026-10-04).** The three sitemaps and the two RSS feeds (`/es/rss.xml`, `/en/rss.xml`) are kept in KV `ISR_CACHE` under `feed:<path>#<build>` for 6 hours (`src/lib/feed-cache.ts`; the response carries `X-Feed-Cache: HIT` or `MISS`). A miss reads only the post columns the feed prints, not whole post bodies. A render that fell back to the bundled posts because D1 failed is served but never stored, and every revalidation from cf-admin clears the `feed:` entries, so a publish shows up on the next crawl. `/llms.txt` and `/llms-full.txt` are static files in `public/`; an unused on-demand `llms.txt` route that the static file had always shadowed was removed the same day.

**Blog 404s (since 2026-10-04).** `/es/blog/tag/<tag>/` for a tag no post carries, and `/es/blog/?page=<n>` for a page number that is not a whole number from 1 to 9999 or is past the last page, render the 404 page with status 404 and are not cached (the same for `/en/`). A tag or page is still served when the database lookup failed, so a D1 outage never turns a real page into a 404 (AGENTS.md invariant #7).

> An image sitemap (`/sitemap-images.xml`) does not exist. It is intentionally
> deferred until real facility photos exist (see `SEO-OPERATIONS.md` §8), and
> `sitemap-index.xml` does not reference one in the meantime.

### 4.3 Generative Engine Optimization (GEO / AIO)

- **AI Crawler Allowances**: `robots.txt.ts` explicitly grants crawling permissions to AI agent engines (such as GPTBot, ClaudeBot, Applebot-Extended, and PerplexityBot).
- **`llms.txt` & `llms-full.txt`**: Plaintext summaries served from `/public` that provide concise system context, services, pricing grids, and legal information specifically designed for LLMs to scrape.
- **Quick answers on a post** (`components/blog/AioDirectAnswers.astro`): a cf-admin post's `aio_data.direct_answers` render as a light "Quick answers" / "Preguntas frecuentes" section after the article, an `<h2>` with one `<h3>` per question, targeted by the BlogPosting `speakable` selector `.article-direct-answers`. An answer that only repeats the post's meta description is not shown (`parseBlogPostRow`, `src/lib/blog.ts`). Restyled 2026-10-10 from a dark purple panel.
- **A moved post** answers with a 301 to its `blog_redirects` target, cached for one hour
  (`[SUPABASE_PROJECT_REF]` in `src/lib/blog.ts`), only when no published post has that slug.
  Without the max-age a browser kept the 301 for good: a post brought back stayed unreachable on
  any phone that had seen it archived.
- **An archived post** answers 410 Gone with the 404 page's content, also cached for an hour
  (`resolveMissingPost` and `blogGoneResponse`). So does an older archive recorded as a redirect
  to the bare blog index: a 301 to the index read as a soft 404 to Google, while a 410 tells it
  the post was removed on purpose.
- **Leaked AI JSON in a post body** is stripped at render (`src/lib/blog-body-envelope.ts`, reported once per post as `blog.body_envelope_repaired`). cf-admin repairs and blocks such bodies at save; this guard covers rows stored before that. The `<blockquote class="cms-callout">` "Key takeaway" box the AI writer emits is styled in `global.css`.

---

## 5. Client-Side Sentry Observability

Client-side logging is implemented manually to guarantee performance isolation:

- **Zero-Hydration Interference**: Initialized inside a `requestIdleCallback` boundary in `src/scripts/sentry.ts`. This prevents Sentry from blocking main thread loading or causing DOM hydration mismatch errors in Astro.
- **Error Budget Management**: a custom `tracesSampler` rates each page load by its path
  (`sampledPath` in `src/lib/sentry-shared.ts`, the span `name` Sentry v8+ passes). The rates
  are the `sentry.cf_astro.*` rows of D1 `service_config`, served by `/api/runtime-config`, so
  they change without a deploy. Until 2026-10-10 the sampler read the removed
  `transactionContext` and threw on every page load, so no browser trace reached Sentry.
- **DSN**: one public constant in `src/lib/sentry-shared.ts`, read by the browser and by the
  Worker (`src/middleware.ts`). The Worker also sends `console.warn` and `console.error` lines to
  Sentry Logs, with emails and phone numbers masked (`scrubLogText`).
- **Quota Protection**: Session Replay is off by default: its rates are `0` unless the `sentry.cf_astro.replay.*` rows turn it on, and only then is the replay integration loaded. Errors themselves are sampled by `sentry.cf_astro.error_sample_rate` (default `1.0`).

---

## 6. AI & Human Extension Guide (UI & SEO Invariants)

To safely maintain and scale the frontend and SEO layers without breaking critical compliance, follow these strict rules:

> [!WARNING]
> **SEO & Schema Invariants**
>
> 1. **No Duplicate `@id` Declarations**: When adding new schema blocks to blog templates or landing pages, never reuse existing `#website`, `#organization`, or `#business` anchors unless you are explicitly building a linked relation graph. Duplicate IDs invalidate the JSON-LD parser.
> 2. **Never Block AI Bots in wrangler or robots**: Keep AI crawlers allowed. Blocking GPT/Claude bots will immediately remove the pet hotel from ChatGPT Search and Perplexity Local pack results, reducing organic traffic.
> 3. **Inline JSON-LD Scripts**: When rendering JSON-LD scripts inside Astro components, always declare the script tag with `type="application/ld+json"`. The script block will be treated by Astro as an static inline element, preserving compile-time schema rendering.

{% endraw %}

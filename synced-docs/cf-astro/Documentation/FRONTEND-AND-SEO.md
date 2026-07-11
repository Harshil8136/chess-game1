{% raw %}
# Frontend UI, PWA & Search Engine Optimization Manual

This manual serves as the comprehensive visual and search architecture handbook for the **cf-astro** project. It details the nature-inspired design system, Tailwind CSS v4 setup, component hydration, scroll-reveal animation engine, PWA caching, multi-dimensional search optimization (classical, maps, voice, AI search), custom sitemap endpoints, and client-side Sentry error budget configurations.

---

## 1. Design System & Brand Identity

The interface for **Hotel para Mascotas Madagascar** features a modern, premium, nature-inspired visual design tailored to promote pet comfort, luxury, and professional security.

### 1.1 Typography

- **Primary Font**: Inter (loaded dynamically via Google Fonts with `display=swap`).
- **Secondary Font**: Outfit (used on hero sections and large headers to establish a premium corporate voice).
- **CSS Token**: `--font-sans: 'Inter', system-ui, -apple-system, sans-serif;`

### 1.2 Theme Palette & Tailwind CSS v4 Setup

The styling system was upgraded to **Tailwind CSS v4** utilizing `@tailwindcss/vite`. Design tokens are defined natively as CSS custom properties inside `src/styles/global.css`:

| Token               | HSL / Hex Value                  | Tailwind Class                    | Semantic Context                                             |
| ------------------- | -------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| `--color-primary`   | `hsl(142, 71%, 29%)` / `#166534` | `bg-primary` / `text-primary`     | Main CTA buttons, premium brand markings (Emerald-800)       |
| `--color-secondary` | `hsl(172, 66%, 50%)` / `#0d9488` | `bg-secondary` / `text-secondary` | Accent borders, interactive highlights, gradients (Teal-600) |
| `--color-accent`    | `hsl(142, 69%, 58%)` / `#4ade80` | `bg-accent` / `text-accent`       | Subtle tag backgrounds, highlighted keywords (Green-400)     |
| `--color-neutral`   | `hsl(210, 40%, 98%)` / `#f8fafc` | `bg-neutral` / `text-neutral`     | Background overlays, card containers                         |

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
┌────────────────────────────────────────────────────────┐
│               MarketingLayout (Prerendered HTML)       │
│                                                        │
│  [Header Component]  (Static CSS/HTML, Scroll JS)      │
│                                                        │
│  [Hero Component]    (Zero JS, Preloaded High LCP)     │
│                                                        │
│  [AutoTabs Section]  (Zero JS, Vanilla CSS Tab Switch)  │
│                                                        │
│  [BookingWizard]     (Preact Island - hydrated client) │
│                      (Activated on /booking pages only)│
│                                                        │
│  [ConsentBanner]     (Preact Island - idle hydrated)   │
│                      (Blocks cookies until accepted)   │
└────────────────────────────────────────────────────────┘
```

### 2.1 Preact Island Inventory

- **`BookingWizard.tsx`**: A multi-step form wizard using Preact hook states and Zod validators. Hydrated immediately on load (`client:load`) on all `/booking` routes.
- **`ConsentBanner.tsx`**: A legally compliant banner managing tracking opt-in flags. Hydrates during browser idle cycles (`client:idle`) to protect performance scores.

---

## 3. Interaction, Motion & PWAs

### 3.1 Interaction Scroll-Reveal Engine

Animations are powered by a unified Intersection Observer engine defined in `src/scripts/scroll-reveal.ts`:

- **Syntax**: Elements are tagged with `data-animate="slide-up"`, `data-delay="200"`, etc.
- **Performance**: Vanilla JS sets the active state once inside a `requestAnimationFrame` loop, guaranteeing zero layout thrashing.
- **Accessibility**: Motion transitions are automatically suppressed if the user has requested reduced motion (`@media (prefers-reduced-motion: reduce)`).

### 3.2 Progressive Web App (PWA) Capabilities

- **`public/manifest.webmanifest`**: Configures the app to run in `standalone` display mode, mapping corporate colors, splash vectors, and custom launch shortcuts.
- **`public/sw.js`**: Custom Service Worker using a **Cache-First** strategy for media, stylesheets, and layouts to ensure ultra-fast load times. Integrates a **Network-Only** fallback for dynamic API endpoints (`/api/booking`).

---

## 4. Multi-Dimensional Search Optimization (SEO / SXO / AIO)

The site is optimized to satisfy traditional crawler bots, local pack maps, and generative AI search agents:

### 4.1 Linked JSON-LD Knowledge Graphs

All structured schema graphs are generated using linked `@id` hashes so search engines understand the relationships between the entities:

```
[WebSite] ──► (@id: "#website")
   │
   ├─► [Organization] ──► (@id: "#organization")
   │
   └─► [WebPage] ──► (@id: "#webpage")
          │
          ├─► [Hotel / LodgingBusiness] ──► (@id: "#hotel")
          │
          ├─► [FAQPage] ──► (Dynamic Q&A markup)
          │
          └─► [BreadcrumbList] ──► (Nav hierarchy)
```

> [!IMPORTANT]
> **Technical SEO GSC Corrective Actions**
>
> 1. **Schema Sitelinks Searchbox Removal**: The literal Google SearchAction template containing `?q={search_term_string}` was completely removed from `SchemaMarkup.astro`. Since this local business site does not have a dynamic internal search bar, this prevents Googlebot from crawling syntax error placeholders, clearing GSC redirects/404 reports.
> 2. **Legal Pages Re-indexation**: The `noIndex={true}` directive was removed from the frontmatter of all core Spanish and English terms, privacy, and ARCO pages. Indexing these documents signals corporate trust, improving the site's overall E-E-A-T domain validation score.
> 3. **Non-HTML Asset Control**: Added strict `X-Robots-Tag: noindex` headers inside `public/_headers` for static system endpoints like `manifest.webmanifest` and `favicon.ico` to preserve crawl budget.

### 4.2 Dynamic Bilingual Sitemap API

Because the default `@astrojs/sitemap` integration cannot embed crucial locale references inside XML nodes, the sitemaps are custom rendered at build time:

- `/sitemap-index.xml`: Main index file referencing language and image files.
- `/sitemap-es.xml` / `/sitemap-en.xml`: Emits exact bilingual `<url>` nodes featuring nested `<xhtml:link rel="alternate" hreflang="..." href="...">` elements for precise SEO routing.
- `/sitemap-images.xml`: Indexes optimized hero assets and boarding gallery photos.

### 4.3 Generative Engine Optimization (GEO / AIO)

- **AI Crawler Allowances**: `robots.txt.ts` explicitly grants crawling permissions to AI agent engines (such as GPTBot, ClaudeBot, Applebot-Extended, and PerplexityBot).
- **`llms.txt` & `llms-full.txt`**: Plaintext summaries served from `/public` that provide concise system context, services, pricing grids, and legal information specifically designed for LLMs to scrape.

---

## 5. Client-Side Sentry Observability

Client-side logging is implemented manually to guarantee performance isolation:

- **Zero-Hydration Interference**: Initialized inside a `requestIdleCallback` boundary in `src/scripts/sentry.ts`. This prevents Sentry from blocking main thread loading or causing DOM hydration mismatch errors in Astro.
- **Error Budget Management**: Implements a custom `tracesSampler` to filter metrics:
  - 50% traces on `/booking` wizards and dynamic booking transactions.
  - 10% traces on `/api` routes.
  - 0% traces on static marketing routes and legal pages.
- **Quota Protection**: Session Replay and DOM profiling are fully disabled to stay safely within free-tier limits.

---

## 6. AI & Human Extension Guide (UI & SEO Invariants)

To safely maintain and scale the frontend and SEO layers without breaking critical compliance, follow these strict rules:

> [!WARNING]
> **SEO & Schema Invariants**
>
> 1. **No Duplicate `@id` Declarations**: When adding new schema blocks to blog templates or landing pages, never reuse existing `#website`, `#organization`, or `#hotel` anchors unless you are explicitly building a linked relation graph. Duplicate IDs invalidate the JSON-LD parser.
> 2. **Never Block AI Bots in wrangler or robots**: Keep AI crawlers allowed. Blocking GPT/Claude bots will immediately remove the pet hotel from ChatGPT Search and Perplexity Local pack results, reducing organic traffic.
> 3. **Inline JSON-LD Scripts**: When rendering JSON-LD scripts inside Astro components, always declare the script tag with `type="application/ld+json"`. The script block will be treated by Astro as an static inline element, preserving compile-time schema rendering.

{% endraw %}

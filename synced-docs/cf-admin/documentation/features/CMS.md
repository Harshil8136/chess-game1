---

title: "CMS, Image, Blog & Bookings Management"
status: active
audience: [ai, technical]
last_verified: 2026-08-13
verified_against: [code]
owner: harshil
tags: [cms, blog, ai, rag, d1]
---

# CMS, Image, Blog & Bookings Management

> **TL;DR (non-technical):** How staff edit the public website's content (hero, gallery, reviews, services, dynamic blog articles) from the admin portal, generate ground-truth AI articles via Workers AI, and how those edits appear on the live site within seconds.

> **Version:** 5.0  
> **Last Updated:** 2026-08-03 (Added Dynamic D1 Blog Manager, Workers AI Author & RAG Knowledge Base Context integration via `cf-chatbot` Service Binding)  
> **Projects:** `cf-admin` (writes & AI authoring), `cf-astro` (edge SSR reads & AIO/GEO citation)

---

## 1. Architecture Overview

cf-admin is the headless CMS for the Madagascar Hotel public site (cf-astro). All content changes flow from this portal.

**Core Stack:**

- **CMS Database:** Cloudflare D1 (`cms_content`, `blog_posts`, `cms_version_history` tables, shared with cf-astro)
- **Bookings Database:** Supabase PostgreSQL
- **Asset Storage:** Cloudflare R2 (`madagascar-images`, served via `cdn.madagascarhotelags.com`)
- **Caching & Propagation:** Cloudflare KV (`ISR_CACHE`) + ISR revalidation webhook + IndexNow protocol
- **Interactivity:** Preact islands + Tiptap Rich Visual Editor + Native HTML5 Drag & Drop

### KV Injection & Edge Routing Coverage

| Section | D1 id / Table | KV Key | Writer Endpoint | cf-astro Reader |
|---------|-------------|--------|-----------------|-----------------|
| Hero Image | `hero_image` (`home`) | `cms:hero_image` | `POST /api/media/upload` | `Hero.astro` |
| Gallery | `gallery_images` (`home`) | `cms:gallery_images` | `POST /api/media/gallery` | `Gallery.astro` |
| Services Pricing | `services_pricing` (`home`) | `cms:services_pricing` | `POST /api/content/services` | `Services.astro` via `pricing.ts` |
| Reviews | `happy_clients` (`global`) | `cms:happy_clients` | `POST /api/content/reviews` | `Testimonials.astro` |
| FAQ | `faq_items` (`global`) | `cms:faqs` | `POST /api/content/faqs` | `FAQ.astro` |
| About / Stats | `about_stats` (`global`) | `cms:about` | `POST /api/content/stats` | `About.astro` |
| **Dynamic Blog Posts** | `blog_posts` table | Purged via ISR path | `POST /api/content/blog` | `[slug].astro` via `getBlogPostBySlug()` |

---

## 2. Booking Management

**Components:** `src/components/admin/bookings/BookingDashboard.tsx` + `BookingSlideDrawer.tsx`  
**API:** `src/pages/api/bookings/index.ts`  
**Data Source:** Supabase PostgreSQL (`bookings` + `booking_pets` tables)  
**Access:** **Manager or above** — canonical `manager`/`admin`/`owner`/`vendor_support`; stored as `admin`/`super_admin`/`owner`/`dev`. See `architecture/plac-and-audit.md` §1.2.

---

## 3. Content Studio Hub (`/dashboard/content`)

Five core modules, all backed by Cloudflare D1:

| Module | Route | Purpose |
|--------|-------|---------|
| Hero | `/dashboard/content` | Hero background image (LCP critical) |
| Gallery | `/dashboard/content/gallery` | Drag-and-drop visual asset manager |
| Services | `/dashboard/content/services` | Pricing editor — syncs marketing pages + booking wizard |
| Reviews | `/dashboard/content/reviews` | "Happy Clients" testimonials carousel |
| **Blog Studio** | `/dashboard/content/blog` | Dynamic D1 Blog Manager & Workers AI Copilot |

### 3.1 Publish Quality Gate & PLAC Bypass Capability
- **Quality Gate**: Server-side 10-check SEO/content audit (`evaluateSeoGate`).
- **PLAC Capability**: `/dashboard/content/blog#bypass-quality-audit` (registered in D1 `admin_pages` with `required_role = 'admin'`).
- **Enforcement**: Users with this PLAC permission (or Owner / Vendor Support) can override failing quality gate checks and publish articles. Every bypass is audited with `qualityGateBypassed: true`.


---

## 4. Workers AI Author & RAG Knowledge Base Integration

**File:** `src/components/admin/content/BlogAiCopilotModal.tsx` & `src/pages/api/content/ai-generate.ts`

### 1. Ground-Truth RAG Pipeline & Prompt Customization Studio
- The AI content generator calls `getKnowledgeBaseContext(env)` in `src/lib/ai-knowledge.ts` to retrieve ground-truth facts from `cf-chatbot`.
- Staff can open **"System Prompt & Style Studio"** in the Copilot modal to inspect the **full system prompt in detail**, view live interpolated prompt previews, insert variable chips (`{topic}`, `{tone}`, `{locale}`, `{target_words}`, `{knowledge_base}`), and select style presets (*Deep-Dive Educational Guide*, *Commercial Comparison & Review*, *Local Services Spotlight*).
- System prompts strictly enforce semantic HTML wrapping (`<h2>`, `<h3>`, `<p>`, `<ul>`, `<li>`, `<blockquote class="cms-callout">`), eliminating unformatted plain text lines.
- Custom prompts persist in D1 `admin_portal_settings` (`blog_ai_system_prompt_override`) and are gated via PLAC capability `/dashboard/content/blog#edit-ai-prompts`.

### 2. Structured 7-Field JSON Output
The AI model returns a validated JSON payload containing:
1. `title` (SEO Headline)
2. `slug` (URL-friendly kebab-case string)
3. `description` (1-2 sentence meta description)
4. `body` (Rich HTML with `<h2>`, `<h3>`, `<p>`, `<ul>`, `<blockquote class="cms-callout">`)
5. `translation_slug` (Suggested English/Spanish paired slug)
6. `seo_score` (Target visibility estimate)
7. `direct_answers` (Q&A blocks for AI Overview / ChatGPT / Perplexity citations)

### 3. 1-Click Form Population
Clicking **"Apply to Editor"** populates all 7 fields into `BlogManager.tsx`.

---

## 5. Storage & CDN Flow

- **CDN URL:** `https://cdn.madagascarhotelags.com` (R2 Custom Domain)
- **Key strategy:** UUID-based R2 keys per upload (`hero/hero-{uuid}.jpg`, `gallery/{uuid}.ext`)
- **Cache-Control:** `public, max-age=31536000`

---

## 6. Cross-References

- **Master System Architecture** → [`architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md`](../architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md)
- **Binding IDs (D1/KV/R2 UUIDs)** → See [OPERATIONS.md](../operations/OPERATIONS.md) §1
- **RBAC gates** → See [USER-MANAGEMENT.md](./USER-MANAGEMENT.md)

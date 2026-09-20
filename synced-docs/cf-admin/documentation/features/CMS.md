---

title: "CMS, Image, Blog & Bookings Management"
status: active
audience: [ai, technical]
last_verified: 2026-09-14
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/cms/revalidate.ts, src/lib/cms/storage.ts, src/lib/blog/article-schema.ts, src/lib/blog/seo-gate.ts, src/lib/blog/ai-prompt-template.ts, src/lib/ai-knowledge.ts, src/pages/api/bookings/index.ts, src/components/admin/content/BlogAiCopilotModal.tsx]
related_docs: [USER-MANAGEMENT.md, ../architecture/PERMISSIONS-SYSTEM.md, ../architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md, ../reference/SYNC-SYSTEM-REVIEW.md, ../operations/OPERATIONS.md]
tags: [cms, blog, ai, rag, d1]
---

# CMS, Image, Blog & Bookings Management

> **TL;DR (non-technical):** How staff edit the public website's content (hero, gallery, reviews, services, dynamic blog articles) from the admin portal, generate ground-truth AI articles via Workers AI, and how those edits appear on the live site within seconds.

> **Last Updated:** 2026-09-19 — §1 propagation, §2 access floor and §4 AI output corrected (see §7). The 2026-08-03 entry ("Added Dynamic D1 Blog Manager, Workers AI Author & RAG Knowledge Base Context integration via the `cf-chatbot` service binding") is when the feature set described here landed.  
> **Projects:** `cf-admin` (writes & AI authoring), `cf-astro` (edge SSR reads & AIO/GEO citation)

---

## 1. Architecture Overview

cf-admin is the headless CMS for the Madagascar Hotel public site (cf-astro). All content changes flow from this portal.

**Core Stack:**

- **CMS Database:** Cloudflare D1 (`cms_content`, `blog_posts`, `cms_content_history` tables, shared with cf-astro)
- **Bookings Database:** Supabase PostgreSQL
- **Asset Storage:** Cloudflare R2 (`madagascar-images`, bound in cf-admin as `IMAGES`, served via `cdn.madagascarhotelags.com`)
- **Caching & Propagation:** cf-astro's `ISR_CACHE` KV namespace, written **by cf-astro**, not by cf-admin — see below
- **Interactivity:** Preact islands + an in-house rich editor (`src/components/admin/content/TiptapRichEditor.tsx` — Preact and `contenteditable`; despite its name the `@tiptap` packages are **not** a dependency and are not on the `RULESAd.md` §7.3 whitelist) + native HTML5 drag and drop

### How a publish reaches the edge

*Added 2026-09-19. The previous text named "Cloudflare KV (`ISR_CACHE`)" as if
cf-admin wrote it. It does not: `ISR_CACHE` is a **cf-astro** binding and
`grep -rn ISR_CACHE src` finds nothing in cf-admin, whose only KV binding is
`SESSION`.*

1. A writer endpoint commits to D1 and calls `revalidateAstro()`
   (`src/lib/cms/revalidate.ts`) with the paths to purge and a `cmsData` map.
2. Transport is the **`ASTRO_SERVICE` service binding**
   (`https://internal/api/revalidate`, no public hop), falling back to
   `PUBLIC_ASTRO_URL` when the binding is absent. Either way the call carries a
   Bearer `REVALIDATION_SECRET`. Three attempts, 5 s timeout each.
3. cf-astro's `/api/revalidate` purges the listed ISR paths and writes each
   entry as `cms:<key>` into `ISR_CACHE` with a **1-hour TTL**.
4. cf-admin then reads the published bytes back (`verifyCmsLive`) to confirm
   they are actually live, not merely that the webhook returned 200. A failed
   read-back never flips a successful publish to failed; it is reported.
5. If delivery genuinely fails (attempts > 0), the publish is persisted to the
   `sync_outbox` D1 table and redriven through `SYNC_QUEUE` by
   `src/workers/sync-revalidate-consumer.ts`, so it either reaches the edge or
   lands visibly in the dead-letter state. See
   [`../reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md).

### KV Injection & Edge Routing Coverage

| Section | D1 id / Table | KV Key | Writer Endpoint | cf-astro Reader |
|---------|-------------|--------|-----------------|-----------------|
| Hero Image | `hero_image` (`home`) | `cms:hero_image` | `POST /api/media/upload` | `Hero.astro` |
| Gallery | `gallery_images` (`home`) | `cms:gallery_images` | `POST /api/media/gallery` | `Gallery.astro` |
| Services Pricing | `services_pricing` (`home`) | `cms:services_pricing` | `POST /api/content/services` | `Services.astro` via `pricing.ts` |
| Reviews | `happy_clients` (`global`) | `cms:happy_clients` | `POST /api/content/reviews` | `Testimonials.astro` |
| FAQ | `faq_items` (`global`) | `cms:faqs` | `POST /api/content/faqs` | `FAQ.astro` |
| About / Stats | `about_stats` (`global`) | `cms:about` | `POST /api/content/stats` | `About.astro` |
| **Dynamic Blog Posts** | `blog_posts` table | Purged via ISR path | `POST /api/content/blog` | the blog post page via `getBlogPostBySlug()` — four call sites, two each in `src/pages/en/blog/[slug].astro` and `src/pages/es/blog/[slug].astro` (the post itself, then the translation check). *Corrected 2026-09-19: this said three.* |

KV keys in the table are the `cms:` names cf-astro writes; they were read from
the writer and reader source, not from a live KV listing (the connector exposes
no key-level read).

---

## 2. Booking Management

**Components:** `src/components/admin/bookings/BookingDashboard.tsx` + `BookingSlideDrawer.tsx`  
**API:** `src/pages/api/bookings/index.ts`  
**Data Source:** Supabase PostgreSQL (`bookings` + `booking_pets` tables)  
**Access:** **Staff and above**, then PLAC. The live `admin_pages` row for `/dashboard/bookings` carries `required_role = 'staff'`, and `src/pages/api/bookings/index.ts` calls `requireAuth(context)` with **no** role floor plus `placDenyResponse(actor, '/dashboard/bookings')`. Only the single-booking detail route, `src/pages/api/bookings/[id].ts`, requires canonical admin. *Corrected 2026-09-19 — this said "Manager or above", which would have led an operator to assume staff could not read booking data.* The model is owned by [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).

---

## 3. Content Studio Hub (`/dashboard/content`)

Nine pages under `src/pages/dashboard/content/` (re-listed 2026-09-14 — this
table said "five core modules" and omitted four of them), all backed by
Cloudflare D1:

| Module | Route | Purpose |
|--------|-------|---------|
| Hub | `/dashboard/content` | Content Studio entry page |
| Hero | `/dashboard/content/hero` | Hero background image (LCP critical) |
| Gallery | `/dashboard/content/gallery` | Drag-and-drop visual asset manager |
| Services | `/dashboard/content/services` | Pricing editor — syncs marketing pages + booking wizard |
| Reviews | `/dashboard/content/reviews` | "Happy Clients" testimonials carousel |
| FAQ | `/dashboard/content/faq` | FAQ items (`faq_items`) |
| About / Stats | `/dashboard/content/about` | About block and stats (`about_stats`) |
| Media | `/dashboard/content/media` | R2 media library |
| **Blog Studio** | `/dashboard/content/blog` | Dynamic D1 Blog Manager & Workers AI Copilot |

### 3.1 Publish Quality Gate & PLAC Bypass Capability
- **Quality Gate**: Server-side 10-check SEO/content audit (`evaluateSeoGate`).
- **PLAC Capability**: `/dashboard/content/blog#bypass-quality-audit` (registered in D1 `admin_pages` with `required_role = 'admin'`; live and active on 2026-09-14, alongside `#edit-ai-prompts` and `#review-suggestions`, both `admin`).
- **Enforcement**: Users with this PLAC permission (or Owner / Vendor Support) can override failing quality gate checks and publish articles. Every bypass is audited with `qualityGateBypassed: true`.


---

## 4. Workers AI Author & RAG Knowledge Base Integration

**Files:** `src/components/admin/content/BlogAiCopilotModal.tsx` → `src/pages/api/content/ai-generate-stream.ts`, with the schema in `src/lib/blog/article-schema.ts`.

*Corrected 2026-09-19 — this named `src/pages/api/content/ai-generate.ts`. The modal calls the **streaming** route; `ai-generate.ts` has no in-app caller.*

### 1. Ground-Truth RAG Pipeline & Prompt Customization Studio
- The AI content generator calls `getKnowledgeBaseContext(env)` in `src/lib/ai-knowledge.ts` to retrieve ground-truth facts from `cf-chatbot`.
- Staff can open **"System Prompt & Style Studio"** in the Copilot modal to inspect the **full system prompt in detail**, view live interpolated prompt previews, insert variable chips (`{topic}`, `{tone}`, `{locale}`, `{target_words}`, `{knowledge_base}`), and select style presets (*Deep-Dive Educational Guide*, *Commercial Review & Comparison*, *Local Services & Pet Care Spotlight* — `src/lib/blog/ai-prompt-template.ts`). *Preset names corrected 2026-09-19.*
- System prompts strictly enforce semantic HTML wrapping (`<h2>`, `<h3>`, `<p>`, `<ul>`, `<li>`, `<blockquote class="cms-callout">`), eliminating unformatted plain text lines.
- Custom prompts persist in D1 `admin_portal_settings` (`blog_ai_system_prompt_override`) and are gated via PLAC capability `/dashboard/content/blog#edit-ai-prompts`.

### 2. Structured JSON Output

`ARTICLE_JSON_SCHEMA` (`src/lib/blog/article-schema.ts`) constrains every
generation to **eight** properties, **six** of them required:

| Field | Required | Meaning |
|---|:---:|---|
| `title` | ✅ | SEO headline |
| `slug` | ✅ | URL-friendly kebab-case string |
| `description` | ✅ | 1–2 sentence meta description |
| `body` | ✅ | Rich HTML (`<h2>`, `<h3>`, `<p>`, `<ul>`, `<blockquote class="cms-callout">`) |
| `translation_slug` | ✅ | Paired English/Spanish slug |
| `direct_answers` | ✅ | Q&A blocks for AI Overview / ChatGPT / Perplexity citations |
| `category` | — | Optional category |
| `tags` | — | Optional string array |

*Corrected 2026-09-19 — this was a "Structured 7-Field JSON Output" list that
included **`seo_score`** and omitted `category` and `tags`. `seo_score` is not
in the schema: asking a model to grade its own SEO produced a number nothing
measured. The score now comes from `evaluateSeoGate()`
(`src/lib/blog/seo-gate.ts`) at publish time. `cover_image_alt` is deliberately
absent for the same reason — the model has no cover image to describe.*

### 3. 1-Click Form Population
Clicking **"Apply to Editor"** populates the returned fields into `BlogManager.tsx`.

---

## 5. Storage & CDN Flow

- **CDN URL:** `https://cdn.madagascarhotelags.com` (R2 Custom Domain)
- **Key strategy:** UUID-based R2 keys per upload (`hero/hero-{uuid}.jpg`, `gallery/{uuid}.ext`)
- **Cache-Control:** `public, max-age=31536000`

---

## 6. Cross-References

- **Master System Architecture** → [`architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md`](../architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md)
- **Binding IDs (D1/KV/R2 UUIDs)** → See [OPERATIONS.md](../operations/OPERATIONS.md) §1
- **RBAC and PLAC gates** → [PERMISSIONS-SYSTEM.md](../architecture/PERMISSIONS-SYSTEM.md), the owner of the permission model. *Corrected 2026-09-19 — this pointed at USER-MANAGEMENT.md, which covers the user lifecycle rather than the gates.*
- **User lifecycle (invite, deactivate, CF Access sync)** → [USER-MANAGEMENT.md](./USER-MANAGEMENT.md)
- **Revalidation durability (outbox, queue, DLQ)** → [SYNC-SYSTEM-REVIEW.md](../reference/SYNC-SYSTEM-REVIEW.md)

## 7. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | `src/lib/cms/revalidate.ts` (service binding, Bearer secret, read-back, outbox fallback) and cf-astro's `/api/revalidate` (`cms:<key>`, 1 h TTL, `ISR_CACHE`); `grep -rn ISR_CACHE src` in cf-admin (no hits); `src/lib/blog/article-schema.ts` (8 properties / 6 required, no `seo_score`); `BlogAiCopilotModal.tsx` (calls `ai-generate-stream`); `src/lib/blog/ai-prompt-template.ts` preset names; `src/pages/api/bookings/index.ts` and `[id].ts`; live `admin_pages` → `/dashboard/bookings` = `staff`; `getBlogPostBySlug` call sites in cf-astro; `src/lib/cms/storage.ts` `Cache-Control` | The `evaluateSeoGate` check count ("10-check" carried forward, not recounted); the D1 ids in §1 against the live `cms_content` rows; a live AI generation end to end |
| 2026-09-14 | The nine content pages on disk; every writer endpoint in §1 mounted (`docs_check` route check); `src/lib/blog/seo-gate.ts` and `src/lib/ai-knowledge.ts` present; the prompt-override setting key referenced in six places; the CDN `Cache-Control` value at `src/lib/cms/storage.ts`; the three blog PLAC rows live in `admin_pages` (Cloudflare MCP); every cf-astro reader file in §1 present in the sibling checkout; the editor is in-house, not the `@tiptap` packages | The KV key names in §1 against a live KV read (the connector has no key-level read); the AI output schema in §4 against a live generation |

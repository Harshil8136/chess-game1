---

title: "CMS, Image, Blog & Bookings Management"
status: active
audience: [ai, technical]
last_verified: 2026-10-30
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/content/sections.ts, src/lib/content/studio.ts, src/lib/content/overview.ts, src/pages/api/content/sections/[id].ts, src/pages/api/content/overview.ts, src/components/dashboard/content/Content.tsx, src/workers/scheduled-asset-cleanup.ts, src/lib/cms/revalidate.ts, src/lib/blog/revalidation-paths.ts, src/lib/blog/publish-scheduled.ts, src/lib/blog/spread-schedule.ts, src/pages/api/content/blog/schedule.ts, src/lib/cms/storage.ts, src/lib/blog/article-schema.ts, src/lib/blog/seo-gate.ts, src/lib/blog/ai-prompt-template.ts, src/lib/ai-knowledge.ts, src/pages/api/bookings/index.ts, src/components/admin/content/BlogAiCopilotModal.tsx]
related_docs: [USER-MANAGEMENT.md, ../architecture/PERMISSIONS-SYSTEM.md, ../architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md, ../reference/SYNC-SYSTEM-REVIEW.md, ../operations/OPERATIONS.md]
tags: [cms, blog, ai, rag, d1]
---

# CMS, Image, Blog & Bookings Management

> **TL;DR (non-technical):** How staff edit the public website's content (hero, gallery, reviews, services, dynamic blog articles) from the admin portal, generate ground-truth AI articles via Workers AI, and how those edits appear on the live site within seconds.

> **Last Updated:** 2026-10-30 — Website Content rebuilt: one route for the six sections, versions for every section, the website's own reading of each, and the section pages in the console look (§1, §3.0, §5; [the spec](../specs/2026-10-30-content-studio.md)). 2026-10-17 — the KV TTL, the quality-gate count and the cf-astro call sites corrected (see §7). The 2026-08-03 entry ("Added Dynamic D1 Blog Manager, Workers AI Author & RAG Knowledge Base Context integration via the `cf-chatbot` service binding") is when the feature set described here landed.  
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
   entry as `cms:<key>` into `ISR_CACHE` with a **24-hour TTL** (cf-astro's
   `CMS_KV_TTL_SECONDS`; it was one hour until 2026-10-04).
4. cf-admin then reads the published bytes back (`verifyCmsLive`) to confirm
   they are actually live, not merely that the webhook returned 200. A failed
   read-back never flips a successful publish to failed; it is reported.
5. If delivery genuinely fails (attempts > 0), the publish is persisted to the
   `sync_outbox` D1 table and redriven through `SYNC_QUEUE` by
   `src/workers/sync-revalidate-consumer.ts`, so it either reaches the edge or
   lands visibly in the dead-letter state. See
   [`../reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md).

### KV Injection & Edge Routing Coverage

Since 2026-10-30 every section is written by one route, `POST /api/content/sections/[id]`
(§3.0), and the section, its row and its key are named once, in `src/lib/content/sections.ts`.
Until then six routes wrote them, two of which sent the website a key it does not read on a
restore.

| Section (`[id]`) | D1 id (`page`) | KV Key | Refreshes | cf-astro Reader |
|---------|-------------|--------|-----------|-----------------|
| Home banner (`hero`) | `hero_image` (`home`) | `cms:hero_image` | the home page | `Hero.astro` |
| Gallery (`gallery`) | `gallery_images` (`home`) | `cms:gallery_images` | the home page | `Gallery.astro` |
| Prices (`prices`) | `services_pricing` (`home`) | `cms:services_pricing` | every page in the two sitemaps | `pricing.ts`, read by the home page's Services, the services, booking, service and area pages, the structured data and `BaseLayout.astro` (every page) |
| Reviews (`reviews`) | `happy_clients` (`global`) | `cms:happy_clients` | the home page and each area's page | `testimonials.ts`, read by `Testimonials.astro` and each area's rating |
| Questions (`questions`) | `faq_items` (`global`) | `cms:faqs` | the home page | `FAQ.astro` |
| About figures (`about`) | `about_stats` (`global`) | `cms:about` | the home page | `about-stats.ts`, read by `About.astro` and the bar under the banner |
| **Dynamic Blog Posts** | `blog_posts` table | Purged via ISR path | `POST /api/content/blog` | the blog post page via `getBlogPostBySlug()` — one call site in each of `src/pages/en/blog/[slug].astro` and `src/pages/es/blog/[slug].astro`; the translation check there uses `getPublishedSlugs()`. *Corrected 2026-10-17: this said four call sites, two per page.* |

KV keys in the table are the `cms:` names cf-astro writes; they were read from
the writer and reader source, not from a live KV listing (the connector exposes
no key-level read).

**What a blog save purges and announces (since 2026-10-10).** `blogPublishEffects`
(`src/lib/blog/revalidation-paths.ts`) decides it for both `POST /api/content/blog` and the
scheduled-publish job. Nothing happens for a post that is not and was not live. Otherwise
the blog index and the live post are purged; an archived, unpublished or renamed post also
has its old URL purged and sent to IndexNow, so what the site now answers there is served at
once (a 301 for a rename, 410 Gone for an archive);
and the post's tag pages and its translation (whose hreflang link is decided at render
time) are purged when the post goes live or leaves, or when its tags or pairing change. A
routine edit of a live post purges only the index and the post, as before. The live URL is
sent to IndexNow and Search Console on every publish, scheduled ones included.

**Redirect rows (since 2026-10-11).** `BlogRepository` records a `blog_redirects` row only when
a published post's slug or locale changes; an archive records none, because cf-astro answers an
archived post's URL with 410 Gone (`resolveMissingPost`). A post that is published at a slug,
created or saved, deletes that slug's own redirect row, so a row left by an earlier archive or
rename can never send its visitors away.

---

## 2. Booking Management

**Components:** `src/components/admin/bookings/BookingDashboard.tsx` + `BookingSlideDrawer.tsx`  
**API:** `src/pages/api/bookings/index.ts`  
**Data Source:** Supabase PostgreSQL (`bookings` + `booking_pets` tables)  
**Access:** **Staff and above**, then PLAC. The live `admin_pages` row for `/dashboard/bookings` carries `required_role = 'staff'`, and `src/pages/api/bookings/index.ts` calls `requireAuth(context)` with **no** role floor plus `placDenyResponse(actor, '/dashboard/bookings')`. Only the single-booking detail route, `src/pages/api/bookings/[id].ts`, requires canonical admin. *Corrected 2026-09-19 — this said "Manager or above", which would have led an operator to assume staff could not read booking data.* The model is owned by [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).

---

## 3. Website Content (`/dashboard/content`)

Nine pages, each a page-registry row (`admin_pages`) of its own, so each can be given or kept
back alone. The tab row (`src/components/navigation/RegistryTabs.astro`) lists only the pages
this person may open. The names below are the registry's since migration `0090`.

| Page | Route | What it edits |
|--------|-------|---------|
| Overview | `/dashboard/content` | Nothing: each section as the website shows it now, and the blog in figures |
| Home banner | `/dashboard/content/hero` | The photo behind the home page's headline |
| Gallery | `/dashboard/content/gallery` | The home page's gallery photos, each described in Spanish and English |
| Prices | `/dashboard/content/services` | The three "from" prices a day (dogs, cats, daycare) |
| Reviews | `/dashboard/content/reviews` | The home page's reviews, in Spanish and English, and the rating worked out from them |
| Questions | `/dashboard/content/faq` | The home page's questions and answers, in Spanish and English |
| About figures | `/dashboard/content/about` | The four figures of "Why choose us" |
| Media | `/dashboard/content/media` | R2 media library |
| **Blog Studio** | `/dashboard/content/blog` | Dynamic D1 Blog Manager & Workers AI Copilot |

### 3.0 The Overview and the six section pages (2026-10-30)

The Overview and the six sections are one Preact island
(`src/components/dashboard/content/Content.tsx`, a section in `Section.tsx`, its editor in
`editors.tsx`) in the Sentry page's console look, drawn in the Website group's emerald
(`src/styles/pages/content.css`). The six section pages are one Astro file,
`src/pages/dashboard/content/[section].astro`; the Blog and Media pages are their own files.

**The Overview** (`GET /api/content/overview`) shows, for each section this person holds: what is
saved, in counts ("8 reviews, average 5.0"), never anyone's words; when it was saved; whether the
website shows it; and what it still needs (a photo without a real or an English description, a
review without English, an About figure the website's fact sheet does not back). Its strip of
figures counts the sections the website shows, the ones it shows an older copy of, and what needs
attention, then the blog: articles live, scheduled (with the next date), and live or scheduled
without a cover. The Blog panel names the next article to go live, and warns when it has no
cover. The blog figures show only to a person who holds the Blog page.

**A section page** (`GET` and `POST /api/content/sections/[id]`) shows four facts (on the website,
last saved, earlier versions, needs attention), the editor, where on the website the section
shows and which pages a save refreshes, and the ten newest versions. Nothing changes on the
website until **Save**, which a bar at the foot of the screen offers while there are unsaved
changes; leaving the page with unsaved changes asks first, through the portal's dialog. Lists
(photos, reviews, questions) move with Earlier and Later buttons, so they work the same with a
finger, a mouse or a keyboard; the star rating and a review's service are rows of choices.

**What a change does** (`src/lib/content/studio.ts`):

- **Save** checks the value against its section's shape (`sections.ts`; an error names the item,
  counted from one), refuses a photo that was not uploaded here (`PUBLIC_CDN_URL`), and saves only
  over the version the editor read: `saveCmsBlock` (`src/lib/cms/storage.ts`) updates the row
  `WHERE updated_at IS` that version, so a save someone made in the meantime is answered 409 and
  the page offers to load theirs. `updated_at` carries milliseconds. A save that changes nothing
  sends nothing.
- **Versions.** Every save keeps the text it replaced in `cms_content_history` (the ten newest per
  section). A row saved before versions existed is kept as the first version, under the time it
  was saved. **Restore** makes an earlier version the saved one; what was saved stays in the list.
- **Send again** sends what is saved to the website once more, for when it shows an older copy.
- **Delivery.** The saved text goes to cf-astro with the pages that carry it (the table in §1):
  for Prices, every page the website lists in `/sitemap-es.xml` and `/sitemap-en.xml`, read
  through `ASTRO_SERVICE` (at most 150); for Reviews, the home page and each area's page. When
  the sitemaps cannot be read, the home page is refreshed at once and the answer says the other
  pages follow within a day (cf-astro keeps each page that long). A failed delivery is queued in
  `sync_outbox` as before (§1).
- **"On the website"** is read back, never assumed: cf-astro's `/api/cms-status` answers the hash
  of the copy it holds for each key, compared with the saved text as cf-astro stores it
  (`websiteCopyOf` in `src/lib/cms-status.ts`: JSON re-serialised, `<` escaped). A key it holds no
  copy of is read from D1, so that is live too. The states are *On the website*, *Website shows
  an older version*, *Website shows its own text* (nothing saved) and *Could not ask the
  website*.
- **The audit log** keeps each change by its counts and field names (`changeSummary`): items
  added, removed, changed, reordered, never a review's or an answer's words.

**Who may do what.** Each section route asks for its section's page key exactly (`denyContent`
in `src/lib/auth/surface-guards.ts`; the owner and vendor support bypass), and the Overview for
its own; both routes are mapped to `/dashboard` in the middleware, so a section does not need the
Overview. Until 2026-10-30 the section routes checked the hub's key or a key no page registers,
which every role passed. Thirty changes an hour per person.

**The rows 0090 saved.** Until 2026-10-30 D1 held no row for the reviews, the questions or the
About figures, so the website showed its built-in text while the editors opened empty, and a first
save would have replaced the eight reviews and five questions with whatever was typed. Migration
`0090` copied the website's own text into `cms_content`, in the shape cf-astro reads since
cf-astro `acb81d9` (both languages, and a review's service). The About figures "5,000+ happy pets"
and "100% satisfaction" are the website's built-in words, not in its fact sheet; the page flags
them until the hotel confirms them.

### 3.1 Publish Quality Gate & PLAC Bypass Capability
- **Quality Gate**: Server-side 11-check SEO/content audit (`evaluateSeoGate`, `src/lib/blog/seo-gate.ts`; the eleventh, `body-not-json`, was added on 2026-10-10).
- **PLAC Capability**: `/dashboard/content/blog#bypass-quality-audit` (registered in D1 `admin_pages` with `required_role = 'admin'`; live and active on 2026-09-14, alongside `#edit-ai-prompts` and `#review-suggestions`, both `admin`).
- **Enforcement**: Users with this PLAC permission (or Owner / Vendor Support) can override failing quality gate checks and publish articles. Every bypass is audited with `qualityGateBypassed: true`.

### 3.2 Spreading articles out, and taking them down (2026-10-29)

**Spread out.** The Blog Studio's list has a **Spread out** button. It opens a dialog
(`BlogSpreadScheduleDialog.tsx`) where an editor picks drafts, articles in review or scheduled
articles, a first day and a gap (3 to 6 days, 1 to 2 weeks, 2 to 3 weeks, 3 to 5 weeks, or any
range from 1 to 90 days), and previews the dates. The server draws each gap at random within the
range and each time at random between 09:00 and 19:00 Aguascalientes time (UTC−6 all year), gives
an article and its translation one date when both are picked, and moves a date later, a day at a
time, while the scheduled-publish job would hold it back: that job publishes at most 2 articles a
day and 4 per language in 30 days (`publish-scheduled.ts`), counting what is already published
and scheduled. **Schedule** saves the previewed dates as `scheduled`, after checking them again
and running the quality gate on each article; a failing article needs `#bypass-quality-audit`
(never for a body of raw AI JSON), and each article's change is audited with `spread: true`. The
planner is `src/lib/blog/spread-schedule.ts`, the route `POST /api/content/blog/schedule`, tested
in `test/blog-spread-schedule.test.ts`. Published and archived articles are never moved by it.

**Taking an article down.** A scheduled article has an **Unschedule** button: it goes back to
draft and will not go out. A published article's **Archive** answers 410 Gone on the website,
leaves the blog list, the sitemaps, the feeds and `/llms.txt`, and is announced to IndexNow when that is switched on. Until
2026-10-29 that did not hold for the fourteen articles first written as Markdown in cf-astro: the
website served a bundled copy whenever D1 had no *published* row, so archiving or unpublishing
one of them changed nothing. cf-astro now uses a bundled copy only for an article D1 has never
had, or while D1 cannot be asked (`cf-astro/src/lib/blog.ts`, `getD1KnownSlugs`).

### 3.3 Suggested edits waiting for review (2026-10-29)

A suggested edit is a `blog_posts_history` row with `entry_type = 'ai_suggestion'` and
`status = 'pending'` (§4). Until 2026-10-29 the Studio showed one only right after **Suggest
Edits** made it; a suggestion stored any other way could not be reached. Now:

- **The list** shows "N suggested edits" under an article's status. `getPosts` counts the pending
  suggestions of each post in the same query (`pending_suggestions`).
- **The editor** asks `GET /api/content/blog/suggest?postId=` when an article opens and, when one
  is waiting, shows "N suggested edits waiting" with **Review**, which opens the review dialog
  (`BlogSuggestionModal.tsx`) for the newest one.
- **The review dialog** shows the body as the passages that change: each removed paragraph, list
  item, table row or heading struck through, the new one under it, and how many unchanged
  passages lie between (`src/lib/blog/text-diff.ts`, `diffPassages`). The full before and after
  stay below it. Every rationale line for a field is shown, not only the first, and the neuron
  count only when one was spent.

Accepting still goes through `PATCH /api/content/blog/suggest` (needs `#review-suggestions`),
refuses a suggestion the article has moved past (409 `STALE_SUGGESTION`) and records a revision,
so an accepted edit can be reverted from the history drawer. Tested in
`test/blog-text-diff.test.ts`.

**The 2026-10-29 fact check.** Every published article (15) was checked against cf-astro's fact
sheet (`cf-astro/src/data/canonical-facts.ts`) and its service pages, and one suggestion per
article was stored this way, signed "Claude (fact check)". They fix prices quoted per night (the
hotel charges per day), check-in at 2 PM and check-out at 11 AM (arrival is any time in opening
hours, pickup from 9:00), the two branches described as north and south (they are split by
species: dogs in Col. Héroes, cats in Jardines del Sol), vaccines and deworming called required
(they are recommended), and claims the fact sheet does not back, such as three meals, a daily
veterinary health check or an after-hours emergency line. Nothing changes on the website until
someone accepts a suggestion. The record is
2026-10-29-blog-fact-check (private).


---

## 4. Workers AI Author & RAG Knowledge Base Integration

**Files:** `src/components/admin/content/BlogAiCopilotModal.tsx` → `src/pages/api/content/ai-generate-stream.ts`, with the schema in `src/lib/blog/article-schema.ts`.

*Corrected 2026-09-19 — this named `src/pages/api/content/ai-generate.ts`. The modal calls the **streaming** route; `ai-generate.ts`, which had no in-app caller, was removed on 2026-10-30.*

### 1. Ground-Truth RAG Pipeline & Prompt Customization Studio
- The AI content generator calls `getKnowledgeBaseContext(env)` in `src/lib/ai-knowledge.ts` to retrieve ground-truth facts from `cf-chatbot`.
- Staff can open **"System Prompt & Style Studio"** in the Copilot modal to inspect the **full system prompt in detail**, view live interpolated prompt previews, insert variable chips (`{topic}`, `{tone}`, `{locale}`, `{target_words}`, `{knowledge_base}`), and select style presets (*Deep-Dive Educational Guide*, *Commercial Review & Comparison*, *Local Services & Pet Care Spotlight* — `src/lib/blog/ai-prompt-template.ts`). *Preset names corrected 2026-09-19.*
- System prompts strictly enforce semantic HTML wrapping (`<h2>`, `<h3>`, `<p>`, `<ul>`, `<li>`, `<blockquote class='cms-callout'>`, single-quoted so the body needs no escaped quotes inside the JSON), eliminating unformatted plain text lines.
- Since 2026-10-10 the default prompt allows facts about the hotel only from the knowledge base (no "luxury", no invented statistics or quotes), asks for a 120–155 character description and 3–5 self-contained direct answers, and no longer asks for `cover_image_alt`. The built-in fallback knowledge base holds only what the public site states.
- Custom prompts persist in D1 `admin_portal_settings` (`blog_ai_system_prompt_override`, at most 12,000 characters) and are gated via PLAC capability `/dashboard/content/blog#edit-ai-prompts`. An unsaved template sent from the copilot is used only for holders of that capability; anyone else gets the saved one.

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
Clicking **"Apply to Editor"** populates the returned fields into `BlogManager.tsx`. The slug of an already published post is kept, so Apply never moves a live URL.

### 4. AI JSON in a body, and answer checks (2026-10-10)

The live post `/en/blog/why-chose-us/` was saved in August with the model's whole JSON response as its body. Three guards now share `src/lib/blog/body-envelope.ts`:

- `sanitizeAiBody` un-wraps any leaked envelope (wrapped in `<p>`, double-encoded, escaped, or only its trailing fields).
- The save route (`/api/content/blog`) repairs the body before sanitising it.
- The quality gate's blocking `body-not-json` check fails on anything left; unlike the other blocking checks, `#bypass-quality-audit` cannot override it. The Studio's gate panel shows the same check.

Direct answers from the writer, from the visibility audit and on every save pass `normalizeDirectAnswers` (`src/lib/blog/direct-answers.ts`): string question and answer, 8–200 and 20–1,000 characters, not just the meta description, no repeats, at most six. cf-astro strips a leaked envelope at render for rows saved before this.

### 5. Inference limits (2026-10-10)

- `runGuidedInference` reads Qwen3's chat-completion shape (`choices[0].message.content`, without a `<think>` block); the visibility audit, which runs on Qwen3, now goes through it. It had returned no answers since the 2026-08-31 model switch.
- The timeout scales with the requested tokens (60–180 s, `timeoutForTokens`) and is not retried: a timed-out call is still billed. An unmet JSON schema is not retried either.
- A failed generation is charged to the day's neuron budget: the full estimate for a timeout, the real usage for an unparseable answer. `AI_NEURON_RESERVE` is 1,900, the cost of the longest article on Llama 3.3 70B.
- A body suggestion is refused for an article over 12,000 characters, and its answer budget grows with the body, so a rewrite can no longer come back truncated.
- The Studio's date picker shows local time and stores UTC; the Author field is saved on edit, and a translation slug with no published partner shows a warning.

---

## 5. Storage & CDN Flow

- **CDN URL:** `https://cdn.madagascarhotelags.com` (R2 Custom Domain)
- **Key strategy:** UUID-based R2 keys per upload (`hero/hero-{uuid}.{ext}`, `gallery/{uuid}.{ext}`, `blog/covers/blog-{uuid}.{ext}`), the extension taken from the upload's MIME type (`src/lib/cms/storage.ts`)
- **Cache-Control:** `public, max-age=31536000`
- **An upload saves nothing (2026-10-30).** `POST /api/media/upload` stores the photo and answers
  its address; the section, or the article, saves it. Until then a banner upload replaced the live
  banner at once, with no version kept. The route asks for the key of the page the photo is for
  (`hero_image`: the Home banner, `temp_gallery_upload`: the Gallery, `blog-cover`: the Blog), and
  the middleware maps it to `/dashboard`, so a person with only the Home banner can upload one.
- **The Sunday clean-up** (`src/workers/scheduled-asset-cleanup.ts`) deletes an upload nothing
  names any more. What names one: `cms_content` and its versions in `cms_content_history`, blog
  articles (cover and body) and their versions in `blog_posts_history`, email drafts and sent
  emails. Only the portal's own folders are considered (`hero/`, `gallery/`, `blog/`), only an
  upload older than a week (one may be waiting to be saved), and a failed read of any of those
  tables deletes nothing that run. Until 2026-10-30 it read `cms_content` alone, so a blog cover
  was deleted the Sunday after it was uploaded, and an earlier version's photos before anyone
  could restore them.

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
| 2026-10-30 | §1's section table, §3, §3.0 and §5 against `src/lib/content/{sections,studio,overview}.ts`, `src/pages/api/content/sections/[id].ts`, `overview.ts`, `src/pages/api/media/upload.ts`, `src/lib/cms/storage.ts`, `src/lib/cms-status.ts` and `src/workers/scheduled-asset-cleanup.ts`, with `test/content-studio.test.ts`; in the cf-astro sibling, the readers named in §1, its two sitemaps and `/api/cms-status`; the live `cms_content` rows and `admin_pages` content rows (Cloudflare D1 connector) | The pages on a phone (the owner's test); §2, §3.1 to §3.3 and §4 were not re-checked |
| 2026-10-29 | §3.3 against `src/lib/blog/text-diff.ts`, `BlogSuggestionModal.tsx`, `BlogManager.tsx` and `BlogRepository.getPosts` with `test/blog-text-diff.test.ts`; the 15 pending fact-check rows in live `blog_posts_history` (Cloudflare D1 connector: one per published post, each `base_updated_at` equal to its post's `updated_at`, valid JSON) | The dialog on a phone (the owner's test) |
| 2026-10-29 | §3.2 against `src/lib/blog/spread-schedule.ts`, `src/pages/api/content/blog/schedule.ts`, `BlogSpreadScheduleDialog.tsx` and `BlogManager.tsx` with `test/blog-spread-schedule.test.ts`; the live `blog_posts` rows (Cloudflare D1 connector: 15 published, all 14 bundled cf-astro slugs present in D1) | The rest of the page; the dialog on a phone (the owner's test) |
| 2026-10-17 | The whole page against the code: the nine pages under `src/pages/dashboard/content/`; each writer endpoint's D1 id and `cmsData` key (`services.ts`, `reviews.ts`, `faqs.ts`, `stats.ts`, `media/upload.ts`, `media/gallery.ts`); `src/lib/cms/revalidate.ts` (3 attempts, 5 s, service binding, read-back, outbox); `evaluateSeoGate` (11 checks, corrected from 10); `src/lib/cms/storage.ts` key shapes and `Cache-Control`; `AI_NEURON_RESERVE` and `timeoutForTokens`; the bookings guards; in the cf-astro sibling, `CMS_KV_TTL_SECONDS` (24 h, corrected from 1 h) and the `getBlogPostBySlug` call sites (two, corrected from four) | Live KV, D1 and a live AI generation (no connector used in this pass) |
| 2026-10-11 | The redirect-rows paragraph in §1 against `src/lib/dal/BlogRepository.ts` (`updatePost`, `createPost`, `clearOwnRedirect`) with `test/blog-locale-and-redirects.test.ts`; the live `blog_redirects` rows (Cloudflare D1 connector, 1 row left: `welcome`/es) | The rest of the page |
| 2026-10-10 | §4.1, §4.3, §4.4 and §4.5 against `src/lib/blog/body-envelope.ts`, `direct-answers.ts`, `pub-date.ts`, `ai-prompt-template.ts`, `src/lib/ai/inference.ts`, `src/pages/api/content/blog.ts`, `ai-generate-stream.ts`, `ai-visibility.ts` and `blog/suggest.ts`, with `test/blog-body-envelope.test.ts`, `test/blog-direct-answers.test.ts` and `test/ai-inference.test.ts` | The live D1 row of why-chose-us and a live Workers AI call (no Cloudflare connector in the session) |
| 2026-10-10 | The blog purge and announce paragraph in §1 against `src/pages/api/content/blog.ts`, `src/lib/blog/publish-scheduled.ts` and `src/lib/blog/revalidation-paths.ts`, with `test/blog-publish-effects.test.ts` | The rest of the page; the purge against a live cf-astro (no Cloudflare connector in the session) |
| 2026-09-19 | `src/lib/cms/revalidate.ts` (service binding, Bearer secret, read-back, outbox fallback) and cf-astro's `/api/revalidate` (`cms:<key>`, 1 h TTL, `ISR_CACHE`); `grep -rn ISR_CACHE src` in cf-admin (no hits); `src/lib/blog/article-schema.ts` (8 properties / 6 required, no `seo_score`); `BlogAiCopilotModal.tsx` (calls `ai-generate-stream`); `src/lib/blog/ai-prompt-template.ts` preset names; `src/pages/api/bookings/index.ts` and `[id].ts`; live `admin_pages` → `/dashboard/bookings` = `staff`; `getBlogPostBySlug` call sites in cf-astro; `src/lib/cms/storage.ts` `Cache-Control` | The `evaluateSeoGate` check count ("10-check" carried forward, not recounted); the D1 ids in §1 against the live `cms_content` rows; a live AI generation end to end |
| 2026-09-14 | The nine content pages on disk; every writer endpoint in §1 mounted (`docs_check` route check); `src/lib/blog/seo-gate.ts` and `src/lib/ai-knowledge.ts` present; the prompt-override setting key referenced in six places; the CDN `Cache-Control` value at `src/lib/cms/storage.ts`; the three blog PLAC rows live in `admin_pages` (Cloudflare MCP); every cf-astro reader file in §1 present in the sibling checkout; the editor is in-house, not the `@tiptap` packages | The KV key names in §1 against a live KV read (the connector has no key-level read); the AI output schema in §4 against a live generation |

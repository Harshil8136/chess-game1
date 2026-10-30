---
title: "Website Content and the blog, remade — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-30
verified_against: [code, infra]
owner: harshil
related_code:
- src/lib/content/sections.ts
- src/pages/api/content/sections/[id].ts
- src/pages/api/content/overview.ts
- src/components/dashboard/content/Content.tsx
- src/styles/pages/content.css
- migrations/0090_content_studio.sql
- cf-astro/src/lib/testimonials.ts
- cf-astro/src/lib/images.ts
related_docs:
- ../features/CMS.md
- 2026-10-29-sentry-console-look.md
- ../reference/SYNC-SYSTEM-REVIEW.md
- ../architecture/PERMISSIONS-SYSTEM.md
tags: [cms, content, blog, design, cf-astro, sync]
---

# Website Content and the blog, remade — design

> **TL;DR (non-technical):** Harshil asked for every page of Website Content and the blog to be
> rebuilt from scratch, each feature checked against the live systems. The check found that two
> pages showed nothing of what the website shows (the reviews and the questions: the website uses
> its own built-in text, and the first save from the portal would have replaced all of it), that
> the overview page printed made-up numbers, that no section kept earlier versions, and that the
> blog has had six page views in ninety days. The new pages start from exactly what visitors see,
> keep every earlier version with a way back, say whether each change reached the website, check
> each section's own permission, and share one console look. The blog gets a planner, a calendar,
> article pairs in both languages, each article's real visits and searches, and a better article
> page on the website. It ships in stages, each one checked before it goes live.

## 1. The ask

Harshil, 2026-10-30: "COMPLETLY REMAKE ALL PAGES, all sections, all parts. verify if each and
every feature is real in production and working. if not block whole feature and if you can make
it! … as this is a sync between cf-admin cf-astro and other repos, multiple services I would like
you to be very careful! … Also blog system is not to the extent I wanted it to be … cf-astro blog
system is also not well designed and so isnt cf-admin."

## 2. What production showed (2026-10-30)

Read through the Cloudflare D1 connector (row counts, lengths, timestamps and the website's own
text only), PostHog (page views by address), Sentry (issues) and the code of both repositories.
The website itself could not be fetched from the cloud session.

| Feature | What is live | Real and working? | What the remake does |
|---|---|---|---|
| Overview (`/dashboard/content`) | Cards with "5 items • 2 locales", "5 features • 4 stats", a price "$25/d" and a review text that no row holds; gallery thumbnails read `url` while the rows hold `src`, so none showed | No: invented text | Rebuilt from the rows and the blog: what each section shows now, when it last changed, whether it reached the website, what needs attention |
| Home banner | One photo in D1 (saved 2026-04-21), uploaded to R2, the website reads it | Yes | Kept; earlier versions and a way back; the upload checks the banner's own permission |
| Gallery | Three photos (2026-04-26), each with the alt text "Nuevo activo de galería" | Works; the descriptions are placeholders | Kept; a real description is required, in Spanish and English |
| Prices | Three "from" prices (dogs, cats, daycare: 286, 286, 200 MXN) | Works; labelled "per night" though the hotel charges per day; the change log's "before" was read after the save, so it was always empty | Prices per day, said honestly as the "from" prices; where each appears on the website; the weight tiers stay in the website's fact sheet (§6) |
| Reviews | No row in D1. The website shows its own eight reviews, in Spanish and in English | No: the editor opened empty, and its first save would have replaced the eight | The eight copied into D1 as they are, in both languages (migration `0090`), so the editor holds what visitors see |
| Questions (FAQ) | No row. The website shows its own five questions | No: same trap | The five copied into D1 in both languages (`0090`) |
| About | No row. The website shows its defaults (30+ years, 5,000+ happy pets, 24/7, 100%). The portal's page listed five "features" that are not the website's | Stats: works; features: invented | The four figures copied into D1 (`0090`) and editable; the features shown as the website's fixed text, not as an editor. "5,000+" and "100%" are not in the website's fact sheet (asked of the client, MAINTENANCE CS-1) |
| Media | Lists `gallery/` and `hero/` in R2; delete for the Owner and Developer with no record and no check that a photo is in use | Partly: blog covers missing, a live photo could be deleted | Every folder the portal writes; where each photo is used; a photo in use cannot be deleted; each delete recorded |
| Earlier versions | `cms_content_history` has 0 rows; `/api/content/history` has no screen; restoring the questions or About sent the wrong key to the website | No | Every save keeps a version; every section has Earlier versions with Restore, sending the website's own key |
| Permissions | The reviews, questions, About and prices routes checked `/dashboard/content`; uploads checked the Media page | Mismatched: a person refused one section could still change it through another key | Each route checks the section's own page key |
| Unused routes | `/api/content/blocks` and `/api/content/ai-generate` have no caller | Dead | Removed |
| Blog articles | 15 published, 8 scheduled (four pairs, 5 to 27 November). None has a cover; one has direct answers and a category; none has the `embedding` or `related_ids` the table was built for | Works; covers, answers and categories unused | Kept, with every article pair and what it lacks in view (§5) |
| Writing assistant (Workers AI) | No `ai_inference` row has ever been recorded (the record starts 2026-09-20); the last AI suggestion is from 2026-09-11 | Not shown working since September | Kept, with its last success shown; the phone test runs it once |
| Blog readers | PostHog: 6 views of blog pages in 90 days (visitors who allowed it) | The articles are not read | Each article's visits and searches in the Studio; a better article page on the website (§5.3) |

## 3. The look

The console look the Sentry page has used since 2026-10-29
([its design](2026-10-29-sentry-console-look.md)): a slim header, one row of options that scrolls
sideways on a phone, solid panels in a grid with no holes, tables that fold into a line on a phone.
The pieces are reused from `src/components/dashboard/sentry/frame.tsx` and its stylesheet, with the
Website group's emerald as the accent (`src/styles/pages/content.css` sets the tokens). Every
section keeps its own page in the registry, so the sidebar, the row of tabs and every permission
stay where they are.

## 4. The website sections

### 4.1 One list of sections

`src/lib/content/sections.ts` names each section once: its D1 row (`cms_content` id and page),
the key the website reads it by (`cms:<key>` in cf-astro's `ISR_CACHE`), its page key, its shape
(a Zod schema), its name, and where it shows on the website. Before this, each fact lived in two
to four route files and they disagreed (the questions' row is `faq_items`, its website key
`faqs`).

| Section | D1 row | Website key | Page key |
|---|---|---|---|
| Home banner | `home/hero_image` | `hero_image` | `/dashboard/content/hero` |
| Gallery | `home/gallery_images` | `gallery_images` | `/dashboard/content/gallery` |
| Prices | `home/services_pricing` | `services_pricing` | `/dashboard/content/services` |
| Reviews | `global/happy_clients` | `happy_clients` | `/dashboard/content/reviews` |
| Questions | `global/faq_items` | `faqs` | `/dashboard/content/faq` |
| About figures | `global/about_stats` | `about` | `/dashboard/content/about` |

### 4.2 One route

`GET /api/content/sections/[id]` answers the section's value, when it last changed, its earlier
versions and whether the website holds the same bytes (cf-astro's `/api/cms-status`, through the
service binding). `POST` takes `{ action: 'save', value, base }`, `{ action: 'restore', version,
base }` or `{ action: 'resend' }`. A save:

1. checks the person's key for that section, exactly (the middleware maps
   `/api/content/sections` to `/dashboard`, so a section does not need the Overview's key);
2. refuses with 409 when `base` is not the row's `updated_at`, so two people cannot overwrite each
   other unseen; the write itself is conditional on it too (`saveCmsBlock`);
3. writes the row and keeps the text it replaced as a version, keeping the ten newest per section
   (the existing `cms_content_history` retention);
4. sends the value to the website under its website key (`revalidateAstro`, which falls back to
   the outbox) with every page that carries it: the home page for most sections, each area's page
   too for the reviews, and every page in the two sitemaps for the prices, which `BaseLayout`
   puts on every page (when the sitemaps cannot be read, the home page now and the rest within
   the day cf-astro keeps a page);
5. records the change by its counts and field names, never a review's or an answer's words.

The four routes it replaces (`services`, `reviews`, `faqs`, `stats`), `history`, `blocks`,
`ai-generate` (no caller) and the `gallery` and `revalidate` media routes are removed. The banner
and gallery photos still upload through `/api/media/upload`, which no longer writes D1 or the
website: it checks the key of the page the photo is for and answers its address, and the section
saves it. The middleware maps it to `/dashboard`, so it does not need the Media page.

Found while building this, and fixed in the same push: the Sunday asset clean-up read only
`cms_content`, so it deleted blog covers and the photos of earlier versions. It now reads every
table that names a photo, considers only the portal's own folders and keeps an upload for a week.

### 4.3 The shapes

- **Reviews** gain both languages: `{ id, name, rating, text: { es, en }, service?, source? }`.
  cf-astro's `getTestimonials` reads this shape and the old one (`text` as one string), choosing
  the visitor's language and falling back to the other; `service` (dogs, cats, daycare) becomes
  the website's own label for each language. cf-astro ships the reader first (§7).
- **Gallery** photos gain `alt_en` beside `alt`; cf-astro's gallery uses it on the English pages.
- **Questions**, **About figures**, **Prices** and the **banner** keep their shapes.

### 4.4 Migration `0090` (rows only)

`INSERT OR IGNORE` of `happy_clients`, `faq_items` and `about_stats` with exactly what the
website shows today (copied from cf-astro's `src/i18n/translations/{es,en}.json` and
`cf-astro/src/lib/about-stats.ts`), so nothing changes for visitors and an existing row is never touched.
It also corrects the banner's registry description ("its headline" was never editable).

## 5. The blog

### 5.1 What stays

Everything the Mexico visibility thread built on 2026-10-29 keeps working unchanged: Spread out
(`planSpread`, random gaps, 09:00 to 19:00 Aguascalientes time, at most 2 a day and 4 per language
in 30 days), Unschedule, the take-down that really takes a post down, the suggested-edits count,
banner and passage diff, the 15 fact-check suggestions waiting for review, the 8 scheduled pairs
(never moved without the owner's yes) and migration `0088`'s index. The API routes stay
(`/api/content/blog`, `blog/schedule`, `blog/suggest`, `edge-verify`, `ai-generate-stream`,
`ai-prompt`, `ai-visibility`).

### 5.2 The Studio

One page, its views in a sideways row:

- **Articles:** one row per article *pair* (Spanish and English joined by `translation_slug`),
  each language's state beside it, and what each lacks: a cover, a translation, direct answers,
  a passing quality check, a waiting suggestion. Filters in one row: state, language, needs
  attention. A scheduled article without a cover says so with its date.
- **Calendar:** the month's published and scheduled articles, the day and language limits the
  publishing job keeps, and Spread out.
- **Editor:** a full page instead of a dialog: Write (with the website's own text style as the
  preview), Details, Search and answers, Cover, Publish, Versions and Suggestions in one row.
- **Visits and searches:** each published article's requests (Cloudflare), views (PostHog) and
  Search Console impressions, clicks and position, read with the tokens the Analytics page uses.

### 5.3 The website

The article page gains a list of its sections (from its headings, no script), the short answers
at the top where an article has them, a booking box with the website's real prices and links,
plain share links and the hotel as the author. The blog index gains the newest article first,
topics as a sideways row, and covers drawn from the article's own words where no photo exists
(the site ships no stock photos). The bundled Markdown copies of the first fourteen articles are
refreshed from D1 once the fact-check suggestions are decided.

## 6. Limits, said in the pages

- The weight tiers (286, 390 and 490 MXN for dogs; 200, 300 and 400 for daycare) and the add-ons
  are written in cf-astro's fact sheet (`cf-astro/src/data/canonical-facts.ts`), which the
  articles, the service pages and the assistant answers are checked against. The Prices section
  edits the three "from" prices only and says so.
- The home banner's headline is the website's text, not a CMS field.
- The About section's five features are the website's text.

## 7. Order and stages

Each stage is its own push, after `npm run verify` in its repository, and has its own change
record.

| Stage | Repository | What | Before it |
|---|---|---|---|
| 1a | cf-astro | Reviews in both languages, gallery `alt_en` (shipped 2026-10-30, `acb81d9`) | none |
| 1b | cf-admin | The sections, the route, the Overview and six section pages, `0090` (shipped 2026-10-30, `2b2c489`) | 1a live; `0090` applied first |
| 2 | cf-admin | Photos: every folder, where used, safe delete, pick from the library (shipped 2026-10-30, its record (private)) | 1b |
| 3 | cf-admin | The Blog Studio (its writing-assistant routes are still mapped to the Overview's key; the editor's inline photo upload sends a slot the upload route refuses) | 1b |
| 4 | cf-astro | The blog's pages | 3 |

A stage that fails its checks does not ship; the pages before it keep working.

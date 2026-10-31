---
title: "Get the articles found — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-31
verified_against: [code, infra]
owner: harshil
related_code:
- src/lib/blog/link-ideas.ts
- src/lib/blog/photo-alt.ts
- src/lib/blog/studio.ts
- src/lib/blog/revalidation-paths.ts
- src/lib/ai/inference.ts
- src/pages/api/content/blog/describe-photo.ts
- src/pages/api/content/blog.ts
- src/components/dashboard/content/ArticleText.tsx
- src/components/dashboard/content/BlogEditor.tsx
- src/components/dashboard/content/BlogGaps.tsx
- src/components/dashboard/content/Blog.tsx
- cf-astro/src/components/blog/FromTheBlog.astro
- cf-astro/src/data/servicePages.ts
related_docs:
- ../features/CMS.md
- 2026-10-30-content-studio.md
- ../security/SECURITY.md
- ../security/RoPA.md
tags: [cms, blog, seo, design, cf-astro, workers-ai]
---

# Get the articles found — design

> **TL;DR (non-technical):** on 2026-10-31 Harshil picked "Get the articles found" from the
> ideas for the blog. The live check behind it: 6 visits to the blog in 90 days, no article
> linking to another, no article with a cover photo, only one with short answers for AI search,
> and the service pages people land on from Google never pointing at an article. So the website
> now shows three articles on the home page and on each service page, the editor offers links to
> related articles and the service pages, and one list shows every article's gaps with a button
> that starts the writing assistant's draft there, including a description of the cover photo
> drawn from the photo itself. Nothing is saved without a person reading it and saving.

## 1. What production showed (2026-10-30, counts only)

From the Cloudflare D1 connector and PostHog, recorded in the ideas document of 2026-10-30:

- 23 articles (15 live, 8 scheduled); **0** with a cover photo; **0** that link to another
  article; **1** with short answers for AI search (`aio_data.direct_answers`).
- 6 page views of the blog in 90 days, 1 of them an article.
- The service pages (cf-astro `ServiceLanding.astro`) and the home page did not link to the blog;
  the blog was reached from the menu and the footer only.

On 2026-10-31 the live published articles' topics were counted per service page (tag counts
only): every service page has at least one live article sharing one of its topics in each
language.

## 2. The four parts

### 2.1 "From our blog" on the website (cf-astro, `c5023f4`)

Up to three published articles in the page's language, after the questions, on the home page
(the newest) and on each service page (only articles sharing one of the page's topics,
`blogTags` in `servicePages.ts`, most shared first). One D1 read of at most 20 rows without
their text; with nothing to show or D1 unavailable, the row is left out. cf-astro
`Documentation/FRONTEND-AND-SEO.md` §4.5 owns the website side.

**Freshness.** The pages are kept 24 hours in the website's cache, so `blogPublishEffects`
(`src/lib/blog/revalidation-paths.ts`) now also refreshes the home page and the service pages of
the languages an article was and is live in when it goes live (a save or the publishing job),
comes down, changes language, or changes its title, cover or topics. A text edit does not: the
row shows none of the text. `showcasePaths` takes the paths from `SITE_STATIC_URLS`, without the
services list, which shows no articles.

### 2.2 Link ideas in the editor

`linkIdeas` (`src/lib/blog/link-ideas.ts`) offers the live articles of the same language that
share a topic (two points each) or a title word of five letters or more (one point each), best
first, at most six, then the language's four service pages; each marked when the text already
links to it, by path, with or without the site's address. Only live articles are offered: a
link to a scheduled one would lead nowhere until it goes live. The service paths are the ones
the website refreshes (`test/blog-articles-found.test.ts` holds the two lists equal).

**Link ideas** in the text's tool row opens the list in the portal's dialog. With words
selected, the link goes on them; with none, the page's title goes in as a link at the cursor, or
at the end when the cursor is not in the text. The Studio counts each article's links to other
articles (`blogLinkCount`) and lists "links to no other article" as an improvement.

### 2.3 Fill the gaps

A fourth view of the Blog Studio (`BlogGaps.tsx`): every article not taken down that lacks
short answers, links to other articles, a cover photo, or its cover's description, live first,
then the next to go live, then drafts; filters for the gap and the language in one row. Each gap
has one button that opens the article at its part and starts the work there (`EditorStart.act`):

| Gap | Opens | Starts |
|---|---|---|
| Short answers | Search and answers | the assistant's draft (`ai-visibility`, unchanged) |
| Links | Write | the link ideas |
| Cover photo | Cover | nothing; a person chooses the photo |
| Photo description | Cover | the assistant's description (§2.4) |

A draft only fills the editor's fields. **The save is the approval**, and it goes through the
same quality check and `base` check as any save. A live article without a cover is refused by
the quality check unless the person holds `#bypass-quality-audit` (the owner does; the bypass
is recorded), so a person without it adds the cover first.

### 2.4 The cover photo's description

`POST /api/content/blog/describe-photo` sends the cover photo to Llama 4 Scout, the article
model, which Cloudflare lists with vision, and answers one sentence in the article's language,
at most 200 characters, for the editor's field. Decisions:

- **Only the portal's own photos.** The address must be `https` on `PUBLIC_CDN_URL`'s origin and
  not a resizing address; anything else is refused before any fetch, so the route cannot be
  pointed at another server.
- **Made small first.** The photo is fetched with Cloudflare's resizing on the request
  (`cf.image`: 640 pixels at most, JPEG, quality 70) and refused over 1.5 MB, which keeps the
  Worker's work on the bytes small.
- **Sent as a data address.** The Workers AI binding's own types for Llama 4 Scout say the photo
  must be a `data:image/…;base64,` address and that an http address is not accepted
  (`@cloudflare/workers-types` 5.20260804.1, read 2026-10-31). `runGuidedInference` gained an
  optional `image`, sent as an `image_url` part beside the text.
- **The same guards as every assistant route:** the Blog page's key exactly, ten a minute for
  anyone but the owner and vendor support, the daily Workers AI budget, and each run recorded
  by outcome and cost (`recordAiGeneration`, route `content/blog/describe-photo`), never the
  photo or the words. The Studio's "writing assistant" figure counts these runs too.

Rejected: describing photos inside the article's text in this change (that dialog already asks
for a description before a photo goes in); a new image library or service (none needed);
storing the description anywhere but the article (it is a draft until saved).

## 3. What was not verified live

No live run of the photo description was made from the session: no article has a cover yet,
and the session cannot call the portal as a person. The first tap of **Describe it with the
assistant** on a phone is its first live run; if it fails, the route answers 502, records the
failure, and the activity log shows it. The website's row was checked by its tests and the live
topic counts, not in a browser.

## 4. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-31 | The design against the code it names, `test/blog-articles-found.test.ts`, `test/blog-publish-effects.test.ts` and `test/content-blog-studio.test.ts`; the live topic counts (Cloudflare D1 connector, tag counts only); the image input format in `@cloudflare/workers-types` and Cloudflare's model page (docs connector) | A live photo description; the pages on a phone (the owner's test) |

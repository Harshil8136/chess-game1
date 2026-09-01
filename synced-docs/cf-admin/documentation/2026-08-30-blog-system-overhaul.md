---

title: 'Blog System Overhaul — Visibility, Integrity and Human-Reviewed AI'
status: active
audience: [ai, technical, operator]
last_verified: 2026-08-30
verified_against: [code, infra]
owner: harshil
related_docs:
  [
    ./architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md,
    ./2026-08-03-blog-ai-seo-production-readiness.md,
    ./reference/schema-change-ledger.md,
    ../main.md,
  ]
tags: [blog, ai, seo, d1, content, remediation]
---

# Blog System Overhaul — 2026-08-30

> **TL;DR (non-technical):** The Blog Studio showed "No articles found" while the
> site had a blog. Four separate defaults all assumed Spanish, so the only
> article in the database — an English one — was invisible, and the editor had
> no language field to explain why. Fixing that uncovered something worse: that
> article was not written by anyone. An AI route had invented it when the model
> failed, and it had been published and pushed to five search engines. This
> change makes every article visible and editable, imports the 14 articles that
> only existed as files, removes the code that fabricates content, and adds an
> AI "suggest edits" feature where a person approves every change.

## Context / Scope

Covers the 2026-08-30 remediation of the blog system across both repositories:
`cf-admin-madagascar` (authoring, AI, SEO automation) and `cf-astro` (public
rendering, sitemaps, feeds). It documents what was broken, what changed, and
what the numbers were before and after.

**Not covered:** the SEO/GSC automation surface (see
[`features/SEARCH-CONSOLE-SYNC.md`](./features/SEARCH-CONSOLE-SYNC.md)), and the
`cms_content` block system, which shares the revalidation transport but is a
separate feature.

---

## 1. What was actually wrong

Fifteen distinct defects, all verified against production D1 or the source
before any change was made. Ordered by consequence.

### 1.1 The Studio showed no articles (the reported symptom)

`blog_posts` held exactly one row: `why-chose-us`, `locale='en'`. Four
independent defaults each chose Spanish:

| Layer                | Behaviour                                            |
| -------------------- | ---------------------------------------------------- |
| `BlogManager.tsx`    | `localeFilter` initialised to `'es'`                  |
| `BlogManager.tsx`    | the only list query was `?locale=${localeFilter}`     |
| `api/content/blog.ts`| a missing `locale` param defaulted to `'es'`          |
| `BlogRepository`     | turned that into `WHERE locale = 'es'`                |

The result was "No articles found for locale ES" over a database that contained
an English post. There was no "All" option, and — the deeper omission — **no
language field anywhere in the editor**. A post's locale was written only by
`handleCreateNew` (from the list filter) or by the AI copilot's own locale
picker, which could flip it with nothing on screen to show what had happened.

### 1.2 The only published article was fabricated

`ai-generate-stream.ts` synthesised a complete article whenever the model's JSON
failed to parse: title, slug, description, category, tags, alt text, translation
slug, a canned Q&A and a hardcoded `seo_score: 90`. The live row matched that
fallback field for field. Its stored `body` was:

```html
<p>{
  "title": "Madagascar Pet Hotel: Luxury Pet Care",
  "slug": "why-choose-madagascar-pet-hotel",
  ...
```

— the model's raw JSON envelope wrapped in a `<p>` tag. A guard existed that
should have caught it: `sanitizeAiBody` unwraps a leaked JSON envelope, matching
`/^\{\s*"title"\s*:\s*"/`. It failed purely on **ordering** — the fallback
wrapped the text in `<p>` before the sanitizer ran, moving the `{` behind a tag.

The post was `published`, and `runOnPublishSync` + `broadcastIndexNow` had
pushed the URL to Google and four other engines.

### 1.3 Public tag pages listed every article

Commit `39150fd` replaced `BlogPageContent.astro`'s merge guard with an
unconditional merge, deleting the comment that explained it. The guard
distinguished `undefined` ("no D1 data — fall back to the static collection")
from `[]` ("these ARE the results"). Tag routes pass `posts={d1Posts}`, which is
empty whenever no post carries the tag, so `/blog/tag/<anything>/` — including
tags that do not exist — rendered the entire static collection. Those pages are
submitted in the sitemaps.

### 1.4 SSR responses shipped with no CSP

The security policy lived only in `public/_headers`, which the Workers Static
Assets layer applies to **asset** responses. Every blog route is
`prerender = false`, and `grep -rn "Content-Security-Policy" src/` returned
nothing. The ISR cache-HIT path compounded it by constructing a fresh `Response`
with five headers, so even an upstream header would be dropped on every hit —
at a 24h TTL, nearly every request. This is the one route that injects
operator-authored D1 HTML through `set:html`.

### 1.5 The rest

| #    | Defect                                                                                                                                                                          | Where                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1.5a | `recordRedirect` used the **pre-edit** locale for a redirect's target path, so a locale change produced a redirect pointing into the locale the post had left. Production carried `/es/blog/welcome/` → `/es/blog/why-chose-us/` for a post living at `/en/`. A locale-only change recorded no redirect at all. | `BlogRepository.updatePost`                  |
| 1.5b | Migration `0034` declared two columns in its description and never created them. It worked only because cf-astro's `0011` ran four hours earlier (ledger ids 73 vs 64). Reversed, it fails and wrangler aborts the batch, silently skipping every later migration. | `migrations/0034_*.sql`                       |
| 1.5c | The AIO direct-answers feature had **never rendered**. cf-admin stores `{"direct_answers":[…]}`; the reader assigned the parse result straight to a `DirectAnswer[]` and gated on `aioData.length > 0`. `.length` on an object is `undefined`. | `cf-astro/src/lib/blog.ts`                    |
| 1.5d | Tag URLs went into sitemap `<loc>` elements unencoded. Static Markdown tags are raw (`cat boarding`, `pensión`, `estrés`), producing literal spaces and accents — invalid per spec. Tag entries also claimed a cross-locale alternate at the same tag string, but the vocabularies are disjoint (`dogs` vs `perros`), so every alternate and `x-default` 404'd. | `sitemap-{en,es}.xml.ts`                      |
| 1.5e | Sitemaps performed no XML escaping at all; one `&` in a slug or tag would invalidate the whole document.                                                                          | `sitemap-{en,es}.xml.ts`                      |
| 1.5f | The ISR cache key ignored the query string, so `/en/blog/`, `?page=2` and `?page=3` shared one entry — page 2 served page 1's body under a canonical claiming page 2.             | `cf-astro/src/middleware.ts`                  |
| 1.5g | `/en/rss.xml` was prerendered and read only the static collection, so a D1-authored English post could never appear — while its own comment claimed it mirrored the sitemap. `/es/rss.xml` replaced rather than merged. `sitemap-index.xml` was prerendered, freezing `lastmod` at build time. | `cf-astro/src/pages/**`                       |
| 1.5h | "Restore version" copied three fields into local state and toasted "Restored version vN" — a completed-write message over an unpersisted change, so the rollback was lost on navigation. `restoreVersion` in the DAL was dead code. | `BlogManager.tsx`                             |
| 1.5i | "Sync Cache" POSTed the whole post through the create/update path, writing a history revision and re-running the quality gate on every click of a cache-purge button.             | `BlogManager.tsx`                             |
| 1.5j | `recordHistory` derived version numbers from `COUNT(*)`, which raced on concurrent saves.                                                                                          | `BlogRepository`                              |
| 1.5k | `getPosts` swallowed every error and returned an empty list with a `console.error` — a schema drift was indistinguishable from "no posts", which is precisely what hid 1.1.       | `BlogRepository`                              |
| 1.5l | `ai-visibility` had no rate limit, no neuron accounting, no `max_tokens` and no global quota check; reported a hardcoded `75 (+10 +10)` as an "AI Score"; fabricated a Q&A on parse failure; and wrote to a live published post with no history, audit or revalidation. | `api/content/ai-visibility.ts`                |
| 1.5m | Both AI generation routes gated on `/dashboard/content`, the parent hub, so denying a user the Blog Studio still let them generate blog articles through it.                       | `api/content/ai-generate*.ts`                 |
| 1.5n | 14 articles (7 EN + 7 ES) existed only as Markdown files with no D1 row, so the Studio could not list, open or edit any of them. No import path existed in either repo.            | `cf-astro/src/content/blog/**`                |
| 1.5o | The blog had one inbound link site-wide (a single footer link) and no header nav entry.                                                                                            | `cf-astro/src/components/layout/Header.astro` |

---

## 2. What changed

Six commits, each independently revertable, in dependency order.

| Phase | Repo      | Change                                                                       |
| ----- | --------- | ---------------------------------------------------------------------------- |
| 0a    | (data)    | Archived the fabricated post; repaired both redirect rows                     |
| 0     | admin     | Migration `0051`; `0033` made order-independent; RULE #0.7b                   |
| 1     | admin     | Locale visibility, the missing language field, redirect and history integrity |
| 2     | astro     | Tag guard, CSP on SSR, tag/XML encoding, ISR key, feeds, sanitizer, CWV       |
| 3     | admin     | Legacy import of the 14 Markdown articles                                     |
| 5     | admin     | AI fabrication removed; quotas, PLAC and purge corrected                      |
| 4     | admin     | Suggestional Edit                                                             |
| 6     | both      | Lighthouse CI, documentation                                                  |

### 2.1 Schema — one migration, no new tables

`migrations/0051_blog_suggestions_and_schema_ownership.sql` adds `entry_type`
and `status` discriminators to `blog_posts_history`, plus a supporting index and
one PLAC capability row.

**RULE #0.9 reuse-check.** A suggestion *is* a proposed snapshot — the same
shape as a revision. `blog_posts_history` already carried `snapshot_json`,
`changed_by`, `created_at` and a `post_id` FK that cascades on delete. Only
"has this been applied yet" was missing. This follows migration `0050`, where
`gsc_index_log` absorbed PageSpeed, IndexNow and local-3pack rows behind a
`service` column rather than growing three tables. **Net new tables: 0.**

**RULE #0.8.** Both feature toggles (`blog-suggestions-enabled`,
`blog-suggestions-max-pending`) live in `admin_portal_settings`. **Net new
environment variables: 0.**

The `0034` hazard is fixed by declaring the two columns in `0033`'s
`CREATE TABLE IF NOT EXISTS` rather than as an `ALTER` in `0034`. The CREATE
no-ops when cf-astro got there first and produces the complete table when
cf-admin did, so the apply order stops mattering. An `ALTER` cannot do that —
SQLite has no `ADD COLUMN IF NOT EXISTS`. The rule is recorded as **RULE #0.7b**
in `main.md` and mirrored in `cf-astro/db/README.md`.

### 2.2 Suggestional Edit — the design constraint

There is **no code path from generation to `blog_posts`**. `POST
/api/content/blog/suggest` can only insert a `blog_posts_history` row with
`entry_type='ai_suggestion'`. The single route into the live post is `PATCH`
with `action:'accept'`, which a person triggers and which goes through
`updatePost` — so an accepted suggestion records its own revision and stays
revertible from the version-history drawer.

That separation is structural, not procedural. An agent that can write directly
to published content has no review step by construction, however careful its
prompt is — and §1.2 is what that costs in practice.

Enforced properties, each covered by a test:

- Generation never writes to `blog_posts`.
- Accepting compares `base_updated_at` against the post's live `updated_at` and
  returns **409** if the post moved. Applying a stale suggestion would silently
  revert the intervening edit.
- Only the fields the reviewer selected are written; review is field-by-field,
  because an all-or-nothing control pushes reviewers into discarding an
  otherwise-good suggestion over one bad field.
- The model may propose only `title`, `description`, `body`, `tags` and
  `cover_image_alt` — never `slug`, `locale` or `status`, which change a post's
  URL or visibility.
- Fields outside the requested scope are dropped server-side.
- Body HTML is sanitized at the boundary, even though a human reviews it later.
- An unparseable response returns **502** and stores nothing. No fallback.
- Suggestions carry `version_number = 0` and are excluded from
  `getPostHistory`, so an unreviewed proposal can never appear as a restorable
  "version".

Resolving is gated on a **separate** PLAC capability
(`#review-suggestions`): an operator can be trusted to request proposals
without being trusted to merge them into a published article.

### 2.3 Legacy import

`scripts/import_legacy_blog_posts.py` converts the 14 Markdown articles to the
HTML shape the authoring pipeline produces and emits `INSERT OR IGNORE`
statements. Row ids are **UUIDv5 over (locale, slug)**, not random — so a re-run
computes the same ids and no-ops. That matters more than avoiding duplicates: a
re-run can never overwrite an edit made in the Studio after the first import.

Two decisions worth recording:

- **Tags are slugified** through the same transform as `seo-gate.ts`. The files
  carry raw tags (`cat boarding`, `pensión`); importing them unslugified would
  have left two tag vocabularies in one table. This is what resolves §1.5d at
  the source rather than only at render time.
- **Markdown tables became real `<table>` markup.** 8 of the 14 articles contain
  pipe tables, several of them the pricing comparisons the SEO strategy is built
  around. Verified that both the write-side `HTMLRewriter` sanitizer and the
  read-side pass preserve table markup unchanged.

The Markdown files stay on disk as a cold fallback: `[slug].astro` prefers D1
and falls back to the collection, and `BlogPageContent` merges with D1 winning
by slug, so public output is unchanged.

---

## 3. Metrics — before and after

Measured against production D1 and the two test suites on 2026-08-30.

### 3.1 Content and editability

| Metric                                | Before | After | Note                                       |
| ------------------------------------- | -----: | ----: | ------------------------------------------ |
| `blog_posts` rows                     |      1 |    15 | 14 imported                                |
| Published EN / ES                     |  1 / 0 | 7 / 7 | the 1 was the fabricated post, now archived |
| **Articles visible in the Studio**    |  **0** | **15** | the single row was behind a locale filter |
| Articles editable in the Studio       |      0 |    15 |                                            |
| Broken hreflang pairings              |      1 |     0 | verified by join                           |
| `blog_redirects` rows pointing at 404 |      1 |     0 |                                            |
| Fabricated articles published         |      1 |     0 |                                            |

### 3.2 Tests

| Suite                     | Before | After | New                     |
| ------------------------- | -----: | ----: | ----------------------- |
| cf-admin (files / tests)  | 31 / 508 | 33 / 529 | suggestions, locale, redirects |
| cf-astro (files / tests)  | 20 / 180 | 21 / 200 | tags, sanitizer, CSP, AIO shape |
| **Blog-specific tests**   |  **~1** | **~40** | cf-astro had zero       |

### 3.3 Resource utilisation

| Path                                    | Before                                                       | After                                       | Effect |
| --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- | ------ |
| `getRelatedBlogPosts` per article render | `SELECT *` × up to 20 candidates, incl. full body (avg 5.8 KB) | 9 explicit columns, body excluded            | **~81 KB → ~2 KB** of row data per render |
| `ai-visibility` neuron accounting        | untracked                                                     | tracked                                     | the 10k/day budget was under-counted. **Correction (2026-08-31): "now accurate" was wrong.** The tracking added here fed a price table that under-priced output by up to 11.9x, and split a single token total 70/30 into invented prompt/completion figures. Corrected the next day — see [2026-08-31-ai-system-overhaul.md](./2026-08-31-ai-system-overhaul.md). |
| `ai-visibility` D1 writes                | 1 write per audit click, unversioned                          | 0                                           | removes a silent write to production |
| "Sync Cache" click                       | full upsert + 1 history row + gate re-run                     | revalidate only                             | removes a spurious revision per click |
| ISR KV keys                              | 1 per path                                                    | 1 per (path, `page`)                        | bounded by a 1-key allowlist; `utm_*` cannot fragment it |
| ISR purge KV list ops                    | 1 prefix per path                                             | 2 prefixes per path                         | required, or paginated pages become un-purgeable |
| AI call sites                            | 3                                                             | 4 (+`suggest`)                              | gated at 5/min + the global 9,950-neuron cap |
| New D1 tables                            | —                                                             | 0                                           | RULE #0.9 |
| New env vars                             | —                                                             | 0                                           | RULE #0.8 |

`embedding` is `NULL` on all 15 rows today, so the `SELECT *` saving above is
body-driven, not vector-driven. It will grow if embeddings are ever populated.

### 3.4 Not measured

Live HTTP verification (CSP headers, sitemap validity, rendered tag pages) could
not be performed from the session environment — the egress proxy blocks
`madagascarhotelags.com`. The tag-page and fallback behaviour was verified
against a local dev server instead. §5 lists the checks to run against
production.

---

## 4. Key code paths

- Locale filtering → `src/lib/dal/BlogRepository.ts:getPosts` (accepts `'all'`)
- Language field → `src/components/admin/content/BlogManager.tsx` (Publishing Controls card)
- Redirect integrity → `src/lib/dal/BlogRepository.ts:updatePost`
- Revision numbering → `src/lib/dal/BlogRepository.ts:recordHistory` (`MAX(version_number)`, scoped to `entry_type='revision'`)
- Suggestion lifecycle → `src/lib/dal/BlogRepository.ts:createSuggestion` / `acceptSuggestion`
- Suggestion API → `src/pages/api/content/blog/suggest.ts`
- Review UI → `src/components/admin/content/BlogSuggestionModal.tsx`
- Legacy import → `scripts/import_legacy_blog_posts.py`
- Publish fan-out (unchanged) → `src/pages/api/content/blog.ts` → `revalidateAstro` → `runOnPublishSync` + `broadcastIndexNow`
- Public merge contract → `cf-astro/src/components/sections/BlogPageContent.astro`
- SSR security headers → `cf-astro/src/lib/security-headers.ts`, applied in `cf-astro/src/middleware.ts`

## 5. Operational notes / runbook

**Verify against production** (needs unrestricted network):

```bash
curl -sSI https://madagascarhotelags.com/es/blog/guia-pension-canina/ \
  | grep -iE 'content-security|strict-transport|x-frame|referrer'   # expect all present
curl -s https://madagascarhotelags.com/sitemap-en.xml | xmllint --noout -   # expect valid
curl -sI https://madagascarhotelags.com/en/blog/why-chose-us/                # expect 301 → /en/blog/
```

Then: `/en/blog/tag/dogs/` lists only dog-tagged articles; `/en/blog/?page=2`
differs from page 1; `/en/rss.xml` contains D1 posts.

**The 14 imported articles have no cover image.** They are genuinely published
so they imported as `published`, but `cover-image-present` is a *blocking*
quality-gate check — re-publishing one from the Studio requires uploading a real
cover first. That is the gate working as designed. **Do not weaken the gate to
route around it**; treat it as a content backlog item.

**Re-running the import is safe.** UUIDv5 ids plus `INSERT OR IGNORE` make it a
no-op, and it cannot overwrite later edits.

**If the AI copilot starts showing errors** where it previously produced
articles, that is the intended new behaviour (§1.2): the model returned
unparseable output and the route no longer invents a replacement. Retry, or
switch model in the picker.

## 6. Future suggestions

Ordered by value, not effort.

1. **Cover images for the 14 imported articles.** The single largest remaining
   content gap: it blocks re-publishing, weakens OG cards, and leaves
   `sitemap-images.xml` unrestorable.
2. **Retire the static Markdown collection** once a full crawl confirms all 14
   URLs serve from D1. Until then it is a free safety net; afterwards it is
   dead weight and a second source of truth.
3. **Nonce-based CSP.** The policy still carries `'unsafe-inline'` in
   `script-src`. Now that the header is actually applied to SSR responses, this
   is worth staging — cf-admin's `csp.ts` already has the report-only canary
   pattern to copy.
4. **Populate `embedding`.** The column, `related_ids` and the whole RAG design
   in `DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md` are unused; related posts are
   ranked in JS by tag overlap. Either implement it or delete the column.
5. **Promote Lighthouse `performance` to `error`** once the numbers have been
   observed to be stable, and reconsider whether a preview-server harness can be
   made to work (§`lighthouserc.json` explains why it currently cannot).
6. **`blog_categories` is written but never read** — `[SUPABASE_PROJECT_REF]`
   creates rows nothing queries, and `getCategories` is dead code. Wire it up or
   drop it.
7. **Extract `BlogManager.tsx`.** At ~1,400 lines it is well past the 500-line
   bound. A pure move of the list table and editor form into two components
   would bring it back, but do it in isolation — it makes every other diff
   harder to review.

## Verification log

| Date       | Checked by | Method                                                     | Result |
| ---------- | ---------- | ---------------------------------------------------------- | ------ |
| 2026-08-30 | claude     | Live D1 via Cloudflare MCP; both `npm run verify` suites; local dev-server render checks | pass — live HTTP checks in §5 still outstanding |

## Related

- [`architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md`](./architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md) — the target design; note §6.4 above on the unimplemented RAG half.
- [`2026-08-03-blog-ai-seo-production-readiness.md`](./2026-08-03-blog-ai-seo-production-readiness.md) — the prior readiness assessment this supersedes on the AI-safety points.
- [`reference/schema-change-ledger.md`](./reference/schema-change-ledger.md) — migration `0051` and the three out-of-band data corrections.

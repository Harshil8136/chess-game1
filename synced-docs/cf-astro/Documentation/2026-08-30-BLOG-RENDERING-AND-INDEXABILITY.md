{% raw %}
# Blog Rendering, Indexability & Security — 2026-08-30

> **TL;DR:** Tag pages were listing every article regardless of tag, SSR blog
> responses were shipping with no CSP, the AIO direct-answer block had never
> once rendered, and paginated pages were serving page 1's body under a page-2
> canonical. This records what was wrong on the public side, what changed, and
> what still needs checking against production.

The authoring half of this work — the admin Blog Studio, the AI pipeline and
the legacy import — is documented in the sibling repo at
`cf-admin-madagascar/documentation/2026-08-30-blog-system-overhaul.md`. This
document covers only what cf-astro renders and serves.

---

## 1. What was wrong

### 1.1 Tag pages listed every article (worst SEO defect)

`BlogPageContent.astro` merges D1 posts with the static Markdown collection.
The merge used to distinguish two states:

- `posts === undefined` → "no D1 data, fall back to the static collection"
- `posts === []` → "these ARE the results; show nothing"

Commit `39150fd` replaced that with an unconditional merge and deleted the
comment explaining it. The tag routes pass `posts={d1Posts}`, which is empty
whenever no post carries the tag — so **`/blog/tag/<anything>/` rendered the
entire static collection**, including for tags that do not exist. Those URLs are
submitted in the sitemaps, which made it a doorway-page pattern aimed at Google.
The same merge re-injected every static post into every paginated page.

The guard and its comment are restored, and `test/blog-hardening.test.ts` now
pins the contract. Verified against a local dev server: `/en/blog/` still shows
7 posts via the fallback, while `/en/blog/tag/nonexistent-tag/` shows
"No posts published yet" instead of all 7.

### 1.2 SSR responses had no CSP

`grep -rn "Content-Security-Policy" src/` returned nothing. The policy lived
only in `public/_headers`, which the Workers Static Assets layer applies to
**asset** responses — and every blog route is `prerender = false`, i.e.
Worker-generated.

The ISR cache-HIT path made it worse: it constructs a brand-new `Response` with
five headers (content-type plus four cache headers), so even a header set
upstream would be dropped on every cache hit. At a 24-hour TTL that is nearly
every request. This is the one route that injects operator-authored HTML from
D1 through `set:html`.

`src/lib/security-headers.ts` now holds the same policy and is applied on both
the HIT and MISS paths. A test asserts it stays byte-identical to
`public/_headers`, because two sources of truth are unavoidable here — one
static file the assets layer reads, one runtime module for Worker responses —
and the only thing that keeps them honest is a check.

The policy itself is **unchanged**. This fixes it being absent, not its
contents; removing `'unsafe-inline'` is tracked separately in `ToDo.md` and
needs staged testing.

### 1.3 The AIO direct-answers block had never rendered

cf-admin stores `aio_data` as an object:

```json
{ "direct_answers": [ … ], "schema": { … }, "analyzed_at": "…" }
```

`parseBlogPostRow` assigned the parse result straight to a `DirectAnswer[]`, and
both `[slug].astro` routes gate on `aioData.length > 0`. `.length` on an object
is `undefined`, and `undefined > 0` is `false` — so `<AioDirectAnswers>` never
rendered for a single D1-authored post. The whole point of the column was dead
from the day it shipped.

The parser now unwraps the envelope, still accepts a bare array, and drops
malformed entries. Tested against the verbatim production value.

### 1.4 The rest

| Defect                                                                                                                                                                                                                                                                                                                                                                                             | Fix                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag URLs interpolated raw into sitemap `<loc>` elements. Static tags include `cat boarding`, `pensión`, `estrés`, so entries carried literal spaces and accents — invalid per spec, rejected by Search Console.                                                                                                                                                                                    | All tag URLs route through `tagPath()` in `src/lib/blog.ts`, which encodes.                                                                                                                                                                                                                              |
| Every tag entry claimed a cross-locale alternate at the _same_ tag string, but the vocabularies are disjoint (`dogs` vs `perros`), so each alternate and `x-default` pointed at an empty page.                                                                                                                                                                                                     | `altSlug` dropped for tag entries. No hreflang beats a wrong one.                                                                                                                                                                                                                                        |
| Sitemaps did no XML escaping at all; one `&` in a slug would invalidate the whole document.                                                                                                                                                                                                                                                                                                        | Reuses `escapeXml` from `src/lib/rss.ts` (RULE #0.6 — it already existed).                                                                                                                                                                                                                               |
| ISR cache key ignored the query string, so `/en/blog/`, `?page=2` and `?page=3` shared one entry and page 2 served page 1's body under a self-canonical claiming page 2.                                                                                                                                                                                                                           | Key includes an allowlist (`page` only) — keying on the whole query string would fragment the cache on every `utm_*` and hand out a cache-flooding lever. **`revalidate.ts` purges both key forms**; missing that would have left paginated pages permanently un-purgeable, worse than the original bug. |
| `Cache-Tag` used the raw path, which can hold spaces and accents on tag pages. Invalid tags are rejected silently, so exactly those pages could not be purged.                                                                                                                                                                                                                                     | Encoded.                                                                                                                                                                                                                                                                                                 |
| `/en/rss.xml` was `prerender = true` and read only the static collection, so a D1-authored English post could never appear — while its own header comment claimed it mirrored the sitemap. `/es/rss.xml` replaced rather than merged, so one ES post in D1 would have dropped all 7 static ES posts.                                                                                               | Both use one shared `getMergedBlogPosts` helper (`src/lib/blog-sources.ts`).                                                                                                                                                                                                                             |
| `sitemap-index.xml` was prerendered, freezing `lastmod` at build time — publishing never freshened the file Google polls first.                                                                                                                                                                                                                                                                    | SSR, derived from both sources.                                                                                                                                                                                                                                                                          |
| `[slug].astro` was the only collection consumer not filtering drafts, so a `draft: true` post returned 200 with `index, follow` at its own URL.                                                                                                                                                                                                                                                    | Filtered.                                                                                                                                                                                                                                                                                                |
| `sanitizeHtml` let entity-encoded schemes through (`&#106;avascript:` reassembles in the browser), did not strip `<style>` or inline `style=`, and missed slash-separated handlers (`<a/onclick=>`). It also ran an **unanchored** `javascript:` → `about:` replace over the whole document, silently rewriting visible prose — an article discussing `javascript:` URLs had its own text altered. | Entity decoding in attribute positions only, `<style>` and `style=` stripped, `[\s/]on\w+` widened, and the scheme rewrite anchored to attributes.                                                                                                                                                       |
| `getRelatedBlogPosts` used `SELECT *`, pulling the full body (avg 5.8 KB) for up to 20 candidates on every article render, all discarded after JS ranking.                                                                                                                                                                                                                                         | Explicit column list. ~81 KB → ~2 KB of row data per render.                                                                                                                                                                                                                                             |
| The hero image had no intrinsic size, making it both the LCP element and the page's only layout shift. It also used the title as `alt`, discarding the `cover_image_alt` D1 stores and the quality gate requires.                                                                                                                                                                                  | `width`/`height`/`loading`/`fetchpriority` added; `coverImageAlt` threaded through and preferred.                                                                                                                                                                                                        |
| The blog had one inbound link site-wide (a single footer link) and no header nav entry, leaving every article two clicks deep.                                                                                                                                                                                                                                                                     | Added to the header nav in both locales.                                                                                                                                                                                                                                                                 |

---

## 2. Lighthouse CI

`lighthouserc.json` audited **only the homepage**, against the **dev server**,
with **every assertion set to `warn`** — so it could not fail and had never
reported anything actionable.

It now audits a blog index and an article in both locales, and `seo` and
`accessibility` are `error`.

The server stays `npm run dev` deliberately, and the reason is worth recording:
`astro preview` **cannot** serve these routes. `src/middleware.ts` canonicalises
any `http:` request to `https://madagascarhotelags.com`, which is correct
production behaviour, so a preview run 308-redirects every URL off localhost.
The middleware short-circuits on `import.meta.env.DEV`, which is also why the
E2E suite targets the dev server. Verified 2026-08-30.

The consequence is stated in the config: dev-server numbers come from an
unminified, unbundled, uncompressed build, so `performance` is not comparable to
production and stays a warning. `seo` and `accessibility` check document
correctness — canonicals, hreflang, headings, labels, alt text — which bundling
does not change.

---

## 3. Still to verify against production

These could not be run from the environment this work was done in (the egress
proxy blocks the production domain):

```bash
# 1. CSP and friends now present on an SSR blog route — run twice, to compare
#    a cache MISS against a HIT (the HIT path builds its own Response).
curl -sSI https://madagascarhotelags.com/es/blog/guia-pension-canina/ \
  | grep -iE 'content-security|strict-transport|x-frame|referrer|x-isr-cache'

# 2. Sitemaps parse and contain no raw spaces in <loc>
curl -s https://madagascarhotelags.com/sitemap-en.xml | xmllint --noout -
curl -s https://madagascarhotelags.com/sitemap-en.xml | grep -c '<loc>[^<]* [^<]*</loc>'   # expect 0

# 3. The retired fabricated post 301s rather than 404s
curl -sI https://madagascarhotelags.com/en/blog/why-chose-us/    # expect 301 -> /en/blog/
```

Then by eye: `/en/blog/tag/dogs/` lists only dog-tagged articles;
`/en/blog/?page=2` differs from page 1; `/en/rss.xml` contains the D1 posts.

## 4. Notes for whoever touches this next

- **The `undefined` vs `[]` distinction in `BlogPageContent` is load-bearing.**
  It has been deleted once already. `test/blog-hardening.test.ts` exists to stop
  that happening a third time.
- **Never remove the read-side `sanitizeHtml` pass** on the grounds that
  cf-admin sanitizes on write. The 14 Markdown articles predate write-side
  sanitization, and anything holding D1 credentials can write `blog_posts`
  directly.
- **If you add an ISR cache-key parameter**, add it to the purge prefixes in
  `src/pages/api/revalidate.ts` in the same change, or those pages become
  un-purgeable for 24 hours at a time.
- The Markdown collection is now a **cold fallback**, not a source of truth: all
  14 articles exist in D1 and D1 wins by slug. Retire the files only after a
  crawl confirms every URL serves from D1.

## 5. Update 2026-10-04: unknown tags and pages are real 404s

Rendering an unknown tag with an empty list (§1.1) was correct for the page but
left a cost: every `/blog/tag/<anything>/` and every `?page=<anything>` rendered
with a 200 and was stored in the ISR cache, so each random value spent one of
the 1,000 KV writes the free plan allows a day. Since 2026-10-04:

- A tag page whose tag no post carries, in D1 or in the bundled collection,
  rewrites to the 404 page (status 404, never cached). It is matched exactly
  against the stored tag, which `tagPath()` encodes, after a `LIKE` filter in D1.
- `?page=` must be a whole number from 1 to 9999, and past the last page is a
  404 too. Page 1 always exists, because it falls back to the bundled collection.
- When a D1 lookup failed, neither rule applies: a failed lookup is never a
  404 (AGENTS.md invariant #7). A page past 1 asked for while D1 is failing is
  a 503 instead (it still shows the bundled posts), because a 200 would be kept
  for 24 hours once per `?page=` value (`isDegradedLaterBlogPage`, added
  2026-10-07).
- The pages rewrite to `/404/`, with the trailing slash. A rewrite runs the
  middleware again for its target, and the middleware redirects any page path
  without a slash, so the first version's `Astro.rewrite('/404')` answered
  `308 → /404/` instead of a 404. Found in review on 2026-10-07, before it
  shipped, by running the built Worker locally; the same fix covers the
  unknown-post and unknown-zone pages, which had answered that way since they
  were written.
- `?page=` is part of the ISR key only on `/es/blog/` and `/en/blog/`; on every
  other page it is ignored (`src/lib/isr-cache-key.ts`), and `revalidate.ts`
  still purges both key forms.

The helpers are `parseBlogPageParam`, `[SUPABASE_PROJECT_REF]`,
`isDegradedLaterBlogPage` and `isUnknownBlogTag` in `src/lib/blog.ts`, pinned by
`test/cache-flood.test.ts`, which also holds every `Astro.rewrite` target to a
trailing slash.
The [change record](./records/2026-10-04-resource-usage.md) covers the rest of
that day's work.

{% endraw %}

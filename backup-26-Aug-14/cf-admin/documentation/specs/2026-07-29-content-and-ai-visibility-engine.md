---

title: "Content & AI Visibility Engine — Tiptap Authoring + Workers AI Analysis"
status: active
audience: [owner, non-technical, technical, operator, ai]
last_verified: 2026-07-29
verified_against: [code, infra, vendor-docs, web]
owner: harshil
related_code: [src/lib/cms/storage.ts, src/lib/cms/revalidate.ts, src/lib/ai-pricing.ts, src/lib/sync-contract.ts, src/pages/api/content/faqs.ts, src/components/admin/content/GalleryManager.tsx]
related_docs: [2026-07-26-payload-cms-evaluation-and-dynamic-blog.md, ../features/CMS.md, ../2026-07-26-commercial-model-costing-pricing-and-scale.md, ../2026-07-27-go-to-market-prospecting-and-roadmap.md, ../reference/SYNC-SYSTEM-REVIEW.md]
tags: [cms, blog, tiptap, workers-ai, seo, aio, geo, pricing, addon, spec]
---

# Content & AI Visibility Engine

> **TL;DR (non-technical):** A proposed paid module. Clients write blog posts in a proper
> visual editor; an AI pass then analyses each post and generates the structured data that
> makes it findable by Google *and* citable by AI assistants like ChatGPT, Claude and
> Perplexity. The running cost is effectively zero — a client publishing ten posts a month
> would use about half a percent of their free AI allowance. The development cost is real:
> roughly 110–150 hours. The module is currently priced at $14.99 + $24.99 as two separate
> add-ons, which is far below what it is worth; this document recommends merging them into a
> single flagship module at $79–129/month.

---

## 1. Verdict

| Question | Answer |
|---|---|
| Is Tiptap free to use for this? | **Yes, with a caveat.** The editor core is MIT. Tiptap *Cloud* is paid from $49/mo — do not depend on it. §3 |
| Is Workers AI cheap enough to run per-post analysis? | **Yes, decisively.** ~162 neurons per fully-processed post against a 10,000/day free allowance. §4 |
| Does per-client account isolation help or hurt? | **Helps.** Each client's own Cloudflare account carries its own free AI allowance. §4.3 |
| Is 100+ hours a realistic estimate? | **Yes — plan for 110–150 h** to the quality bar of this codebase. §6 |
| Is this the right thing to build? | **Yes, but reorder it.** The measurement half is more valuable than the generation half and should ship first. §5 |
| Is it priced correctly today? | **No.** Underpriced by roughly 4×. §7 |

**Recommendation:** build it, on the blueprint already written in
[`2026-07-26-payload-cms-evaluation-and-dynamic-blog.md`](2026-07-26-payload-cms-evaluation-and-dynamic-blog.md) §8,
with the additions in §5 of this document, in the phase order in §8.

---

## 2. What already exists

The idea is further along than it appears. This is the honest inventory, verified against
code on 2026-07-29.

| Capability | Status | Location |
|---|---|---|
| Blog, static | **Shipped** — 14 Markdown posts (7 ES, 7 EN) | `cf-astro/src/content/blog/{es,en}/` |
| `Article` + `BreadcrumbList` JSON-LD | **Shipped**; header comment already states *"provides AIO/GEO signals for AI citation"* | `cf-astro/src/components/seo/BlogPostSchema.astro` |
| AI draft generation | **Shipped**, 110 lines, calls `@cf/meta/llama-3-8b-instruct` | `cf-astro/src/pages/api/admin/generate-blog-draft.ts` |
| IndexNow submission | **Shipped**, 74 lines, reads deployed sitemaps | `cf-astro/scripts/indexnow-ping.mjs`, `src/lib/indexnow.ts` |
| `llms.txt` / `llms-full.txt` | **Shipped** (6 KB / 14 KB) but **hand-maintained** | `cf-astro/public/` |
| Agent-readable surface | **Shipped** — `.well-known/{agent-skills,api-catalog,mcp,oauth-protected-resource,openid-configuration,security.txt}`, `/api/mcp` | `cf-astro` |
| AI-crawler allow groups | **Shipped** — GPTBot, ClaudeBot, Claude-SearchBot, OAI-SearchBot, PerplexityBot, Google-Extended, CCBot, Applebot, Amazonbot, Bingbot | `cf-astro/src/pages/robots.txt.ts` |
| Neuron cost metering | **Shipped** for 3 models, with an exact conversion formula | `cf-admin/src/lib/ai-pricing.ts` |
| Image upload with magic-byte validation | **Shipped** — 5 MB cap, jpeg/png/webp/avif allowlist | `cf-admin/src/lib/cms/storage.ts:247` (`uploadImage`) |
| CMS history/versioning pattern | **Shipped** | `storage.ts:176` (`getCmsHistory`), `cms_content_history` |
| ISR revalidation with retry + outbox + DLQ | **Shipped** | `cf-admin/src/lib/cms/revalidate.ts:156` (`revalidateAstro`) |
| Dynamic-blog design | **Written, not built** — schema, 6 phases, risk register | `specs/2026-07-26-payload-cms-evaluation-and-dynamic-blog.md` §8 |

**What is genuinely missing** is: a rich-text editor, the `blog_posts` table and its CRUD
path, the switch from static Markdown to D1-backed SSR, the AI analysis passes, and — the
important one — any *measurement* of whether AI engines actually consume the content.

---

## 3. Fact-check — Tiptap licensing

Verified 2026-07-29 against current vendor pricing.

| Item | Finding |
|---|---|
| Editor core | **MIT licensed**, free, self-hostable. Safe to build on. |
| Formerly-Pro extensions | **Ten were open-sourced under MIT.** More is free than historically. |
| Free plan | **Removed June 2025.** New users get a 30-day trial instead. |
| Tiptap Cloud | **Paid from $49/mo** — Start (500 documents, 2 environments, 2 developer licences, community support only), Team $149/mo (5,000 docs), Business $999/mo (50,000 docs), Enterprise custom. |
| Collaboration, comments, document history | Live in **Tiptap Cloud** — i.e. paid. |
| AI Toolkit, Tracked Changes | **Separate paid add-ons.** |

### 3.1 What this means for the design

**The plan to use Cloudflare Workers AI rather than Tiptap's AI Toolkit is
load-bearing, not incidental.** It keeps the entire feature inside the $0 architecture. Two
hard constraints follow:

1. **Do not design version history, comments, or multi-user co-editing on Tiptap Cloud.**
   That would place a $49/mo-per-environment floor underneath a $59/mo product tier, and
   with per-client account isolation it would be $49/mo *per client*. Version history must
   reuse the existing `cms_content_history` pattern in D1 — which the blueprint already
   specifies as a sibling `blog_posts_history` table.
2. **Use only MIT-licensed extensions.** Verify each extension's licence before adding it,
   and record the list, because the free/paid boundary has moved once already.

### 3.2 The bundle-size constraint

Tiptap sits on ProseMirror, which is substantial — realistically the largest client-side
dependency either repo will have shipped. `RULESAd.md` sets a "Lean Edge" budget and a
<15 KB CSS rule.

Mitigations, in order:
- The editor is **admin-side only**. It never loads on the public site, so client-facing
  Core Web Vitals — currently PageSpeed 98/100/100/100 desktop, GTmetrix TBT 42 ms — are
  untouched. This is the main reason the constraint is acceptable.
- **Lazy-load the editor island** so it is fetched only when a post is opened for editing.
- **Prove Preact `compat` works in the first hour, not the fiftieth.** Both repos already
  set `preact({ compat: true })` (`cf-astro/astro.config.ts:32`), so Tiptap's React bindings
  should work — but this is the single highest-risk unknown in the build and it is cheap to
  de-risk immediately. If it fails, the fallback is Tiptap's vanilla-JS API.

---

## 4. Cost model

### 4.1 Vendor rates (verified 2026-07-29)

- Workers AI free allocation: **10,000 neurons/day**, reset 00:00 UTC.
- Above that, on Workers Paid: **$0.011 per 1,000 neurons**.

### 4.2 Real per-post cost, computed from `src/lib/ai-pricing.ts`

Using the repo's own `calculateNeurons()` formula — `tokens × pricePerM ÷ 11` — for a
1,500-word post (~2,000 input tokens, ~500 output):

| Model | Neurons per pass |
|---|---:|
| `@cf/meta/llama-3.1-8b-instruct` | **16** |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **82** |
| `@cf/qwen/qwen2.5-coder-32b-instruct` | 166 |

A **fully-processed post** — five cheap passes (SEO analysis, answer extraction, schema
generation, tag/cluster suggestion, translation draft) plus one deep pass on the 70B model —
costs **≈162 neurons**.

| Scenario | Neurons | % of monthly free allowance (~300,000) |
|---|---:|---:|
| Client publishes 4 posts/month | 648 | **0.22%** |
| Client publishes 10 posts/month | 1,620 | **0.54%** |
| Client publishes 30 posts/month | 4,860 | **1.62%** |
| Monthly freshness re-scan of a 100-post archive | 1,500 | **0.50%** |
| Theoretical daily ceiling | — | **62 fully-processed posts/day** |

At $0.011/1,000 neurons, ten fully-processed posts per month would cost **$0.018** if it
were billable at all.

**Conclusion: AI inference cost is not a constraint at any plausible SMB blog volume.** It
is safe to advertise generous AI processing as a headline feature, and the module must be
priced on value and development cost, not on usage. Storage and KV writes are the dimensions
worth watching — see §9.

### 4.3 Why per-client account isolation helps here

The 10,000 neurons/day allowance is **per Cloudflare account**. Under the per-client
isolation model — each client on their own Cloudflare account, registered to their own
business email — **every client receives their own full free allowance.**

This inverts the usual trade-off. Per-client accounts are a cost *penalty* for shared
infrastructure (no quota pooling, `$5 + $25` per client if paid plans are needed). For AI
inference they are a cost *advantage*: capacity scales linearly with client count at zero
marginal cost to Velox, and no client's usage can exhaust another's allowance.

This is worth stating in a sales conversation, and it is worth recording in the commercial
model, which currently treats per-client accounts purely as a cost multiplier.

---

## 5. What to build — and the reordering that matters

The original idea is "a rich editor plus AI SEO generation." That is the **generation** half.
The **measurement** half is more commercially valuable and should ship first. Here is why.

The AI-visibility wedge has already been *proven* once: the owner demonstrated to the
existing client, across multiple AI models in incognito sessions, that the business ranks
first for its local service category. The weakness is not credibility — it is that a
one-time demonstration cannot be re-sold, cannot be put on an invoice, and gives the client
no reason to still be paying in month twelve.

Turning it into a recurring, evidenced deliverable is what converts this from a feature into
a subscription.

### A. AI-visibility measurement — **build first**

- Log AI-crawler requests by user-agent and URL into Analytics Engine. The
  `madagascar_analytics` dataset already exists and `robots.txt.ts` already enumerates ten
  crawler groups, so the taxonomy is done.
- Surface it as a dashboard: which answer engines fetched which pages, and when.
- Include it in a monthly report alongside the invoice.

No competitor in the SMB web market ships this. It converts an unprovable claim into an
evidenced one, and it supplies the retention mechanic that a loss-leader pricing model
requires. **This is the highest-value item in this specification and the cheapest to build.**

### B. Auto-regenerate `llms.txt` and `llms-full.txt` on publish

Both are hand-maintained static files today. An AI-visibility product whose AI-facing index
is manually updated is a contradiction. One function in the publish path.

### C. Fire IndexNow on publish, not only on deploy

`scripts/indexnow-ping.mjs` exists and reads deployed sitemaps. Move the trigger into the
`revalidateAstro()` path so a post is submitted seconds after publishing rather than at the
next build. Small change, direct indexing-latency win.

### D. Answer-shaped content extraction + `Speakable` schema

Answer engines cite short, self-contained passages. A pass that extracts — or asks the
author to confirm — a direct-answer block per post, then emits `Speakable` alongside the
existing `Article`, is a small addition with outsized citation effect.

### E. Schema beyond `Article`

Currently `Article` + `BreadcrumbList`. Add `FAQPage` and `HowTo` detection: most SMB blog
content is one of those two shapes, and both are strongly favoured for AI extraction and
rich results.

### F. Topical clustering and internal-link suggestions

Topical authority moves AI citation more than per-post optimisation does. A pass that maps a
new post against the existing corpus and proposes internal links builds that automatically,
and it gets better as the archive grows.

### G. Paired-locale auto-translation

`translation_slug` is already in the blueprint schema and hreflang pairing already works. A
Workers AI pass drafting the ES↔EN counterpart doubles content output at ~16 neurons, and it
makes "we can scope to any language" a real capability rather than an aspiration.

### H. Vision-model alt-text generation on upload

Serves SEO **and** the weakest compliance area in the platform:
`compliance/ACCESSIBILITY.md` records 39 icon-only buttons with no accessible name, states
the claim as NON-CONFORMANT, and confirms no screen reader has ever been run against the
portal. Note that vision-model neuron cost is priced differently from text and is **not yet
measured** — measure before enabling by default.

> **Sales constraint:** do not sell accessibility audits to prospects until the portal's own
> 45 open findings are closed. `2026-07-22-compliance-certification-audit...:576` records the
> FTC's $1M fine against an overlay vendor for exactly this class of unverifiable claim.

### I. Content freshness maintenance

`dateModified` upkeep plus periodic re-review of stale posts. Freshness is both a ranking and
a citation signal, and it creates a recurring, billable reason to touch the client's site
that requires no new features. At 1,500 neurons/month for a 100-post archive it is free to
run.

---

## 6. Effort

**110–150 hours** to this codebase's quality bar. The 100+ hour estimate is sound and
slightly optimistic.

| Workstream | Hours | Notes |
|---|---:|---|
| Blueprint phases 1–2 — migration, `BlogRepository`, writer API, manager UI | 25–30 | Patterns exist: mirror `api/content/faqs.ts` (129 lines) and `GalleryManager.tsx` |
| Tiptap integration — Preact compat, lazy island, R2 image upload | 20–25 | Reuses `uploadImage()` and its magic-byte validation |
| Item A — AI-visibility measurement + dashboard | 15–20 | Analytics Engine binding and crawler taxonomy already exist |
| Blueprint phases 3–5 — cf-astro reader, `prerender = false`, sitemap/RSS/schema, migrate 14 posts | 20–25 | **SEO regression is the real cost here, not the code** |
| Items D–G, I — Workers AI analysis passes | 25–35 | Prompt engineering and output validation dominate |
| Items B, C — `llms.txt` regeneration, IndexNow-on-publish | 4–6 | Both largely wiring |
| Item H — vision alt-text | 6–8 | Gated on measuring vision neuron cost |
| Testing, documentation, one week of quota observation | 10–15 | |

**Model upgrade, no extra cost:** `generate-blog-draft.ts` currently calls
`@cf/meta/llama-3-8b-instruct`, older than the three models in `ai-pricing.ts`. Move cheap
passes to `@cf/meta/llama-3.1-8b-instruct` and reserve
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` for the deep analysis pass.

---

## 7. Pricing recommendation

**Current state is underpriced by roughly 4×.** Two separate add-ons exist in
`velox-platform-showcase/src/data/pricing.ts`:

- `Blog & Content Hub` — **$14.99/mo**
- `AI Search & Answer Engine Visibility` — **$24.99/mo**

`2026-07-27-go-to-market-prospecting-and-roadmap.md` already observed that the second
"was being sold as a $24.99 add-on describing about a third of it."

**Recommendation: merge into one flagship module — "Content & AI Visibility Engine" — at
$79–129/month.**

The justification is defensible on all four axes a buyer will probe:

| Axis | Evidence |
|---|---|
| Development cost | 110–150 hours of specialist work |
| Differentiation | The agent-readable surface plus crawler measurement is not assemblable quickly by any competitor in this market |
| Running cost | ≈$0 per client (§4) — so margin is near 100% and generous limits carry no risk |
| Demonstrable outcome | A monthly report showing which answer engines consumed the content |

Positioning notes:
- It should be the **anchor add-on** of the catalogue, not a line item. It is the one module
  that is genuinely hard to replicate.
- Bundle the monthly visibility report into the price. That is what makes it recurring
  rather than a one-off build, and it is the difference between a feature and a subscription.
- It attaches to any tier including Starter — a Starter client with a website and no admin
  portal still benefits, which widens the addressable base.
- Do not meter AI usage. At 0.54% of the free allowance for a typical client, metering would
  cost more in billing complexity and buyer suspicion than it could ever recover.

---

## 8. Phasing

Ordered so that each phase is independently shippable and the risky parts come after the
safe ones.

| Phase | Deliverable | Gate before proceeding |
|---|---|---|
| 1 | `migrations/0009_blog_posts.sql`, `BlogRepository`, writer API, Zod schema. No UI. | D1 writes ≈2/publish, as blueprint predicts |
| 2 | Tiptap editor island + Blog manager UI + PLAC registration + audit rows | **Preact `compat` proven**; editor bundle lazy-loaded and admin Lighthouse not regressed |
| 3 | **Item A** — crawler logging + visibility dashboard | Real crawler hits visible for the existing client |
| 4 | cf-astro reader, `prerender = false` on the 4 blog routes | **Measure KV writes for one week** against the 1,000/day cap (~16 ISR PUTs/day expected) |
| 5 | Sitemap, RSS, `BlogPostSchema` wired to D1; migrate the 14 Markdown posts; delete `src/content/blog/` | **Google Search Console reports no lost URLs** |
| 6 | Items B, C — `llms.txt` regeneration, IndexNow-on-publish | Indexing latency measurably improved |
| 7 | Items D, E, F, G, I — Workers AI analysis passes | Measured neurons/post within budget |
| 8 | Item H — vision alt-text | Vision neuron cost measured first |

**Phases 1–3 are the minimum viable sellable module.** They can ship with nothing on the
public site changed, which de-risks phase 4 — the only phase that can damage existing SEO.

---

## 9. Risks

- **SEO regression is the primary risk, not cost.** Moving 14 indexed URLs from prerendered
  to SSR+ISR must preserve exact paths, `trailingSlash: 'always'`, canonical tags, and
  `translationSlug` hreflang pairing. Phase 5 gates on Search Console.
- **`sync-contract.ts` drift.** Two copies, no shared package (the $0-infra invariant), and
  no test enforcing agreement. Edit both in the same commit, always. See
  [`reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md) §3 (C4).
- **KV writes, not AI, are the quota risk.** Free tier is 1,000 writes/day and
  `architecture/KV-RESILIENCE.md:59` translates that to roughly 250 publishes/day. Phase 4
  exists to measure this.
- **D1 storage is the fleet-level constraint.** 5 GB free per account; blog bodies are the
  first content type with unbounded growth. Under per-client accounts each client has their
  own 5 GB, which materially de-risks this compared with the shared-account model.
- **Blog body is user-supplied HTML.** Must pass `sanitizeHtml` on write, and the CSP must be
  re-verified — `RULESAd.md` §2 forbids `'unsafe-eval'` and the report-only canary is
  mid-rollout.
- **Tiptap bundle size** against the Lean Edge budget. Admin-side only; mitigated by
  lazy-loading. Prove Preact compat in hour one.
- **Tiptap's free/paid boundary has moved once already** (June 2025). Pin versions, record
  which extensions are MIT, and re-check at each upgrade.
- **Vision-model cost is unmeasured.** Item H stays gated until it is.
- **AI output quality is unverified.** `compliance/AI-GOVERNANCE.md` scores MEASURE 2.1 🔴 —
  no systematic output evaluation, no bias testing, no accuracy benchmark. Generated SEO
  metadata and schema should be author-reviewable before publish, not auto-applied silently.

---

## 10. Key code paths

- Blog schema and CRUD → `migrations/0009_blog_posts.sql` (new),
  `src/lib/dal/BlogRepository.ts` (new), `src/pages/api/content/blog.ts` (new)
- Writer API pattern to mirror → `src/pages/api/content/faqs.ts` (`requireAuth` →
  `placDenyResponse('/dashboard/content')` → Zod → `sanitizeHtml` → `revalidateAstro`)
- Manager UI pattern to mirror → `src/components/admin/content/GalleryManager.tsx`
- Image upload → `src/lib/cms/storage.ts:247` (`uploadImage`, 5 MB cap, magic-byte validated)
- Version history pattern → `src/lib/cms/storage.ts:176` (`getCmsHistory`)
- Publish/invalidate → `src/lib/cms/revalidate.ts:156` (`revalidateAstro`)
- Neuron metering → `src/lib/ai-pricing.ts` (`calculateNeurons`)
- Cross-repo contract → `src/lib/sync-contract.ts` (**both copies, same commit**)
- cf-astro reader targets → `src/lib/cms.ts`, `src/pages/{es,en}/blog/*`, `src/lib/rss.ts`,
  `src/pages/sitemap-{es,en}.xml.ts`, `src/components/seo/BlogPostSchema.astro`
- Crawler taxonomy for Item A → `cf-astro/src/pages/robots.txt.ts`, `ANALYTICS` binding

## 11. Configuration / Bindings

No new bindings required. Uses existing `DB` (D1), `IMAGES` (R2), `ISR_CACHE` (KV, cf-astro),
`ANALYTICS` (Analytics Engine), and `AI` (Workers AI). Secret names only; no values here.

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-07-29 | claude | Code read across both repos; Tiptap and Workers AI vendor pricing verified via web; neuron costs computed with the repo's own `calculateNeurons()` formula | pass — idea validated, licensing caveat found, pricing recommendation raised |

## Related

- [`2026-07-26-payload-cms-evaluation-and-dynamic-blog.md`](2026-07-26-payload-cms-evaluation-and-dynamic-blog.md) — the base blueprint; §8 is the build spec
- [`../features/CMS.md`](../features/CMS.md) — the CMS this extends
- [`../architecture/KV-RESILIENCE.md`](../architecture/KV-RESILIENCE.md) — the write-quota ceiling phase 4 gates on
- [`../2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md) — the cost model this amends on AI allowance
- [`../2026-07-27-go-to-market-prospecting-and-roadmap.md`](../2026-07-27-go-to-market-prospecting-and-roadmap.md) — the agentic-visibility wedge this productizes
- [`../security/compliance/AI-GOVERNANCE.md`](../security/compliance/AI-GOVERNANCE.md) — output-evaluation gap affecting §9

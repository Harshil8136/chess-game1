---

title: "Payload CMS Evaluation & the Dynamic-Blog Path"
status: historical
audience: [owner, non-technical, technical, operator, ai]
last_verified: 2026-07-26
verified_against: [code, infra, vendor-docs]
owner: harshil
related_code: [src/lib/cms/storage.ts, src/lib/cms/revalidate.ts, src/lib/sync-contract.ts, src/pages/dashboard/content/index.astro, src/pages/api/content/blocks.ts, migrations/0000_baseline.sql]
related_docs: [../features/CMS.md, ../operations/OPERATIONS.md, ../reference/SYNC-SYSTEM-REVIEW.md, ../architecture/plac-and-audit.md, ../2026-07-26-commercial-model-costing-pricing-and-scale.md, ../2026-06-13-platform-status-summary.md]
tags: [cms, payload, blog, evaluation, cost, architecture, cloudflare]
---

<!-- docs-check: proposed-paths -->
<!-- This document is a design/plan: several paths below name files that
     are proposed, not shipped. The code-path check is skipped here for that
     reason. Do not copy this marker into a doc that describes behaviour. -->

# Payload CMS Evaluation & the Dynamic-Blog Path

> **Re-statused `historical` on 2026-08-23.** This is a design decision record; `specs/` is append-only per CONTRIBUTING-DOCS §2. It is
> accurate for the date it carries; do not read it as current state.


> **TL;DR (non-technical):** We looked at whether Payload CMS could run our website's
> content. Payload is genuinely free and open source, and Cloudflare genuinely supports
> it — both claims check out. But Payload's own documentation says it will only run on
> Cloudflare's **paid** Workers plan, and we are on the free plan, so adopting it means
> paying at least $5/month. It would also add a second admin login that sits outside all
> our security and audit controls. Meanwhile, the admin portal we already own does 90% of
> the job: it stores content, versions it, and pushes it live in seconds. **Recommendation:
> add a blog module to the CMS we already have. Cost: $0. No new software.**

---

## 1. Verdict

| Question asked | Answer |
|---|---|
| Is Payload CMS open source? | **Yes.** MIT-licensed, verifiably free to self-host, no per-seat or per-API-call fee. |
| Is it Cloudflare-compatible? | **Yes.** First-party template using Workers + D1 + R2 via OpenNext, co-built by Cloudflare and Payload. |
| Can we run it on our current infrastructure? | **No.** The official template is Workers-**Paid**-only. We are on Workers Free. |
| Would it cost extra? | **Yes — $5/month minimum**, plus the operating cost of a third application. |
| Should we adopt it? | **No.** Not now on cost, and not later on architecture. §5 and §6 explain why the $5 is the smaller of the two objections. |
| What should we do instead? | **Extend the D1-backed CMS we already run.** Full blueprint in §8. |

**Decision recorded:** evaluate-and-decline. This document is the evidence. If the decision
is ever revisited, §7.G describes the least-bad shape a Payload adoption could take.

---

## 2. Context & scope

cf-astro gained a blog in July 2026. It is currently **fully static**:

- Content lives as 14 Markdown files — 7 Spanish, 7 English — in `cf-astro/src/content/blog/{es,en}/`.
- They are loaded by Astro's `glob` loader, declared in `cf-astro/src/content.config.ts`.
- Pages are built by `getStaticPaths()` in `cf-astro/src/pages/{es,en}/blog/[slug].astro`.
- cf-astro is `output: 'static'`.

**Consequence:** publishing a post requires a developer to write a Markdown file, commit it,
and run `astro build && wrangler deploy`. The owner wants a non-technical operator to publish
without touching Git, and to see the post live in seconds.

**In scope:** whether Payload CMS can serve that need on this infrastructure, at what cost,
with what side effects; what the alternatives are; and what to build instead.

**Out of scope:** implementing any of it. No schema, route, or dependency change ships with
this document. §8 is a blueprint awaiting approval, not a changelog.

---

## 3. Fact-check — is Payload actually open source?

**Confirmed.** Payload is distributed under the **MIT License**
([`LICENSE.md`](https://github.com/payloadcms/payload/blob/main/LICENSE.md)) — permissive,
allows commercial use and modification, no copyleft obligation.

| Attribute | Finding (verified 2026-07-26) |
|---|---|
| License | MIT |
| Repository | `payloadcms/payload`, ~43.5k stars, 440 contributors |
| Latest stable | `v3.85.2` (2026-07-01) |
| Next major | v4, in beta — Node ≥ 24.15.0, Next.js ≥ 16.2.6 |
| Ownership | Acquired by **Figma, June 2025** |
| Hosted offering | Payload Cloud sign-ups **paused** post-acquisition — self-host is now the only path for new projects |
| Cost to self-host | $0 in software licensing |

**What "free" does *not* cover.** MIT licensing removes the *software* fee. It does not
remove the *hosting* fee, and Payload is not a static asset — it is a running Next.js
application with a database. Everything in §4 and §5 is infrastructure and operational
cost that the MIT license has no bearing on.

**Governance note.** Figma ownership is a mild positive on funding continuity and a mild
unknown on direction. Continued v3 maintenance and active v4 development suggest sustained
investment. This is not a reason to reject Payload; it is recorded for completeness.

---

## 4. Fact-check — is Payload Cloudflare-compatible?

**Confirmed, and more thoroughly than the owner's instinct suggested.** Cloudflare did not
merely write a deployment guide — Cloudflare engineers *built the adapters* and dogfood the
result on Cloudflare TV (2,000+ episodes, 70,000+ assets).

### 4.1 What Cloudflare actually built

Documented in [Cloudflare's engineering post](https://blog.cloudflare.com/payload-cms-workers/)
(2025-09-30):

| Piece | Package | What it does |
|---|---|---|
| Next.js → Workers | `@opennextjs/cloudflare` | Compiles the Next.js App Router app into Workers format |
| Database | `@payloadcms/db-d1-sqlite` | Custom D1 adapter — Payload had SQLite via libSQL; Cloudflare wrote a shim mapping `D1Result` → libSQL `ResultSet` (`lastInsertRowid`, `rows`, `rowsAffected`) and passes the D1 **binding** straight into Drizzle |
| Storage | `@payloadcms/storage-r2` | Uses the R2 **binding** rather than S3-compatible API tokens |
| Read latency | D1 read replication | `drizzle(binding.withSession("first-primary"))` — P50 wall time 300 ms → 120 ms (−60%) in Cloudflare's own benchmark |

A **Deploy to Cloudflare** button exists that provisions Worker + D1 + R2 in one click.
The claim in the original question — "they have a completely separate page for Cloudflare
deployment" — is accurate and, if anything, understated.

### 4.2 The caveat that decides this evaluation

The template's own README
([`templates/with-cloudflare-d1`](https://github.com/payloadcms/payload/blob/main/templates/with-cloudflare-d1/README.md))
states verbatim:

> **This can only be deployed on Paid Workers right now due to size limits.**

and, under *Known issues → Worker size limits*:

> We currently recommend deploying this template to the Paid Workers plan due to bundle
> size limits of 3mb. We're actively trying to reduce our bundle footprint over time.

This is not a soft recommendation. It is the vendor stating the free plan does not fit.

---

## 5. Cost analysis

### 5.1 Current state — verified

The Cloudflare account (`[CF_ACCOUNT_ID]`) is on the **Workers Free plan**,
as are all other services. Confirmed with the owner 2026-07-26. This matches
[`operations/OPERATIONS.md`](../operations/OPERATIONS.md) §8 and
[`RULESAd.md`](../../RULESAd.md) §15 ("TOTAL MONTHLY COST — $0"), which are the canonical
cost statements. Two stale claims elsewhere in the docs tree were corrected as part of this
pass — see §11.

### 5.2 The limits that matter

Sourced from [Cloudflare Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/),
re-read 2026-07-26 (not recalled):

| Limit | **Workers Free (us)** | Workers Paid | Payload's need |
|---|---|---|---|
| **Worker size** | **3 MB** | 10 MB | ✗ Exceeds 3 MB — vendor-stated |
| **CPU time / request** | **10 ms** | 30 s (max 5 min) | ✗ Next.js RSC admin render is far above 10 ms |
| Subrequests / request | 50 | 10,000 | ⚠ Admin panel is subrequest-heavy |
| Requests | 100k/day | 10M/month | ✓ Site runs ~50 req/day |
| Startup time | 1 s | 1 s | ⚠ Large bundles risk this |

Cloudflare's own guidance: *"the average Worker uses approximately 2.2 ms per request.
Heavier workloads that handle authentication, server-side rendering, or parse large payloads
typically use 10–20 ms."* A Payload admin render is squarely in — and above — that heavier
band, against a **10 ms hard ceiling**.

**Two independent hard blocks, not one.** Even if Payload shrank under 3 MB tomorrow, the
10 ms CPU ceiling would still make the admin panel unusable on the free plan.

### 5.3 What adoption would actually cost

| Line item | Monthly | Note |
|---|---|---|
| Workers Paid | **+$5.00** | Per **account**, not per Worker — see below |
| D1 storage | $0 | 5 GB included; the account currently uses **1.9 MB** |
| R2 storage | $0 | 10 GB included; egress free |
| Extra Worker | $0 | Included quotas are shared account-wide |
| **Cloudflare delta** | **+$5.00/mo** | **$60/year** |
| Engineering to build | — | New app, new deploy pipeline, migration of 14 posts |
| Engineering to maintain | — | Third app in the update cycle, in perpetuity |

**The $5 is per-account, and it is a one-time floor.** Once paid, every additional Worker
costs $0 until aggregate quotas are crossed — a point already established in
[`2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md) §5.1.
So the honest framing is: *Payload does not cost $5/month; Payload is the thing that forces
us across the $0 → $5 threshold.*

### 5.4 What else that $5 would buy

If the threshold is crossed anyway, the money is not wasted — it also delivers, per
[`2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md) §5:

- **Queue retention 24 h → 4 days (configurable to 14).** Today, if `cf-astro-email-consumer`
  is down over a weekend, queued booking emails are lost. This is a real data-loss exposure.
- **Removal of daily hard caps** — 100k req/day, 100k D1 rows written/day, 1k KV writes/day
  all become monthly pools.
- **CPU headroom** 10 ms → 30 s, which relaxes a constraint the whole codebase is currently
  designed around (see [`reference/DESIGN-SYSTEM.md`](../reference/DESIGN-SYSTEM.md) §4).

**This is worth doing on its own merits.** It is simply not a reason to adopt Payload. The
recommendation in §8 costs $0 on the free plan and gets *better*, not different, if the $5
is ever paid.

### 5.5 Free-tier headroom for the recommended path

For contrast — what a D1-native blog consumes:

| Dimension | Free limit | Blog impact | Verdict |
|---|---|---|---|
| D1 rows written | 100k/day | ~2 per publish (post row + history row) | negligible |
| D1 storage | 5 GB, **summed account-wide** | 1.9 MB today; 14 posts ≈ +200 KB | negligible |
| **KV writes** | **1,000/day** | ~4 per publish (§ [`features/CMS.md`](../features/CMS.md) "Write Budget Per Publish") + ~16 ISR PUTs/day at 24 h TTL | **the tightest dimension — watch it** |
| Workers requests | 100k/day | site runs ~50/day | negligible |
| R2 storage | 10 GB | cover images reuse the existing `madagascar-images` bucket | negligible |

KV writes are both the tightest free-tier dimension and the priciest metered one
($5.00/M — the most expensive rate on the whole Cloudflare bill). At ~4 writes/publish the
free plan allows ~250 publishes/day, which is not a realistic ceiling for a hotel blog. It is
recorded here so the budget is explicit rather than assumed.

---

## 6. Architectural-fit assessment

These objections survive paying the $5. They are the substantive reason for the verdict.

### 6.1 Technology-whitelist violation

[`RULESAd.md`](../../RULESAd.md) §7.3 is not advisory:

> **THE WHITELIST ARCHITECTURE POLICY:** We employ a strict "whitelisting" approach to
> technology additions. Anything not explicitly listed in this document is considered
> **BLACKLISTED** by default to protect our <50 KB "Lean Edge" budget. […] The new
> dependency can ONLY be used if the USER explicitly approves the proposal.

Payload requires **Next.js 15/16 + React 19 + Lexical + OpenNext**. The approved stack is
**Astro 6 + Preact 10 (3 KB) + Tailwind**, chosen explicitly to avoid React overhead. This is
not a dependency addition; it is a second, heavier framework stack. It requires deliberate
owner approval under §7.3, and this document is the proposal — recommending **against**.

### 6.2 A second identity system outside PLAC and the audit log

This is the most serious objection and the least obvious.

Payload ships its own `users` collection with email/password and JWT sessions. cf-admin's
privileged-access model is:

- **Cloudflare Access + Zero Trust JWT** as the only ingress (`workers_dev = false` in
  `wrangler.toml` deliberately closes the off-Access path).
- **PLAC** page-level access control — `src/lib/auth/pipeline.ts`, `admin_pages`,
  `admin_page_overrides`.
- **`admin_audit_log` written on every request** — a deliberate compliance property, cited
  as SOC 2 CC7 and ISO 27001 A.8.15 evidence.
- **Session forensics** — `admin_login_logs`, CF Access log polling every 5 minutes, Layer-3
  session revocation.

A Payload admin panel is a **parallel privileged surface with its own login, its own session
model, and no PLAC mapping or audit-log rows**. Every claim in
[`architecture/plac-and-audit.md`](../architecture/plac-and-audit.md),
[`security/THREAT-MODEL.md`](../security/THREAT-MODEL.md), and the compliance certification
audit would need a carve-out reading "…except for content editing, which happens over there."

It can be partially mitigated (put Payload behind CF Access too), but CF Access gates the
*door*; it does not give Payload PLAC granularity or write rows into `admin_audit_log`. The
audit gap is structural, not configurational.

### 6.3 No `sharp` — image processing is a regression, not a gain

Payload's `imageSizes`, `formatOptions`, and focal-point cropping are hardwired to `sharp`,
a native Node binary that cannot run in the Workers runtime. The documented workaround
([payload#16937](https://github.com/payloadcms/payload/discussions/16937)) is to omit `sharp`
from the config entirely, store originals in R2, and transform on demand via
`/cdn-cgi/image/` — which is exactly what
[`security/reviews/2026-04-24-ssl-lighthouse-audit.md`](../security/reviews/2026-04-24-ssl-lighthouse-audit.md)
already mandates and what `src/lib/cms/storage.ts` already implements, *plus* magic-byte
content validation Payload does not provide. We would be trading down.

### 6.4 Open defects in the D1 adapter

The D1 adapter is the newest and least-exercised part of the stack. Open at time of writing:

| Issue | Severity | Summary |
|---|---|---|
| [#15070](https://github.com/payloadcms/payload/issues/15070) | **High** | DELETE returns success but does not delete, on Workers only — stale D1 binding captured at module init |
| [#14766](https://github.com/payloadcms/payload/issues/14766) | **High** | `too many SQL variables` on UPDATE for wide collections; INSERTs are batched, UPDATEs are not. Confirmed still open as of March 2026 |
| [#15219](https://github.com/payloadcms/payload/issues/15219) | High | D1 adapter lacks atomic batch → data loss on array updates |
| [#17216](https://github.com/payloadcms/payload/issues/17216) | Medium | Duplicate `latest=1` version rows under autosave — non-transactional `createVersion` |
| [#14163](https://github.com/payloadcms/payload/issues/14163) | Medium | `payload migrate` times out in the Cloudflare build environment (`UND_ERR_HEADERS_TIMEOUT`) — reported on a **paid** account |

A silent-data-loss class bug (#15070) in the delete path is disqualifying for a system that
would own published content.

### 6.5 Other gaps

- **GraphQL unsupported** on Workers, pending upstream [`workerd#5175`](https://github.com/cloudflare/workerd/issues/5175). REST only. Not a blocker for us, but it means the deployment target is not feature-complete.
- **v4 raises the floor** to Node ≥ 24.15.0 and Next ≥ 16.2.6. cf-admin pins `engines.node >= 22.12.0`; CI runs Node 22.
- **No Astro adapter.** v4 introduces a framework-adapter pattern, but only **TanStack Start** is experimental. Astro integration is REST- or Local-API-only. Payload cannot live *inside* cf-admin — it is necessarily a **third application** with its own repo surface, build, deploy pipeline, secrets, and monitoring.
- **Operational load.** Three apps instead of two, in perpetuity, against a documented one-person maintenance model.

---

## 7. Alternatives evaluated

Ordered by fit. Each has a verdict and, where relevant, an implementation sketch.

### A. Extend the existing D1 CMS — ✅ **RECOMMENDED**

We already operate a headless CMS with instant publish. Verified live this session:

| Capability | Where it lives | Status |
|---|---|---|
| Content storage | `cms_content` in D1 `madagascar-db` | live, 23 tables, 1.9 MB total |
| Version history | `cms_content_history`, 10 versions/block | live — `recordCmsHistory()` in `src/lib/cms/storage.ts` |
| Image upload | `uploadImage()` → R2 + magic-byte validation + CDN URL | live |
| Instant publish | `revalidateAstro()` — 3 retries, KV injection, read-back verify | live — `src/lib/cms/revalidate.ts` |
| Durable delivery | `sync_outbox` + `SYNC_QUEUE` redrive + DLQ | live |
| 3-tier read | Edge Cache-Tag → `ISR_CACHE` KV → D1 → hardcoded fallback | live — `cf-astro/src/middleware.ts` |
| Access control | CF Access + PLAC + `admin_audit_log` | live |
| Editor UI pattern | 6 Content Studio modules under `/dashboard/content/` | live |
| AI drafting | Workers AI blog drafts | live — `cf-astro/src/pages/api/admin/generate-blog-draft.ts` |
| Reserved keys | `blog_index`, `blog_draft_*` already in `CMS_KEY_ALLOWLIST` | **already reserved** |

A blog is one more table and one more Content Studio module. **Cost $0, zero new
dependencies, inherits every security and compliance control we already have.** Blueprint in §8.

### B. Keystatic — ❌ rejected on the instant-publish requirement

MIT, by Thinkmill (KeystoneJS). Best-in-class **Astro** integration —
`npm i @keystatic/core @keystatic/astro`, serves an admin UI at `/keystatic` on your own
domain, GitHub OAuth for auth (and can sit behind CF Access). Content stays as Markdown in
`cf-astro/src/content/blog/`, so **the existing schema, hreflang pairing, and RSS/sitemap code would
not change at all**. Genuinely the strongest option in the git-based category.

Rejected because:
- **Git-based → 30–90 s rebuild per publish.** Every save is a commit that triggers a full
  Cloudflare rebuild. The owner's stated requirement is instant publish.
- Requires cf-astro to leave `output: 'static'` (Keystatic's route needs on-demand rendering).
- No scheduling, no approval workflow; drafts are a `localStorage` workaround.
- Small maintainer (~2.1k stars, single agency) — concentration risk.

*Keep on file.* If the instant-publish requirement is ever relaxed, this becomes the
recommendation, and it is roughly a half-day of work.

### C. Sveltia CMS / Decap CMS — ❌ rejected, same reason

Sveltia is a MIT-licensed, framework-agnostic, CDN-served SPA — a genuine rewrite of Netlify
CMS and the **live successor** to Decap, which is effectively neglected (Sveltia has closed
300+ longstanding Decap issues, has first-class i18n, and is actively released — v0.167.0 in
June 2026). Zero build tooling; it is a `<script>` tag plus a YAML config.

Same git-rebuild rejection as Keystatic, with a weaker Astro story. Notable that Sveltia's
roadmap includes Cloudflare Workers edge functions for user management — worth re-checking in
2027. If a git-based CMS is ever chosen, **use Sveltia, not Decap.**

### D. TinaCMS — ❌ rejected

Git-based (same rejection) and the differentiating features — visual in-context editing,
branch-based workflows — sit behind a paid cloud tier. Strictly worse than Keystatic for an
Astro project on a $0 budget.

### E. SonicJs — ❌ rejected on maturity and redundancy

Built from the ground up on **Workers + D1 + Astro** — architecturally the closest thing to a
native fit, MIT-licensed, and name-checked by Cloudflare in the same post that announced the
Payload template. But it is early-stage, and it would duplicate the D1 CMS, ISR pipeline, and
audit model we already own and have hardened. Adopting it means replacing working, audited
code with less-mature code.

### F. Directus / Strapi — ❌ rejected outright

Both require a long-running Node.js host (VM or container). That is a categorical violation
of the edge-only architecture and the $0 posture: a $5–20/month always-on server, a second
database, its own patching and backup burden. Not viable.

### G. Payload as a separate Worker on the shared D1 — 📋 the "if we do it anyway" design

Recorded so a future revisit does not start from zero.

```
cms.madagascarhotelags.com  →  Worker "cf-payload" (OpenNext + Next.js)
                                  ├─ D1 binding → madagascar-db  (own payload_* tables)
                                  ├─ R2 binding → madagascar-images
                                  └─ behind Cloudflare Access (same Zero Trust team)

cf-astro  →  reads Payload REST /api/posts, cached in ISR_CACHE KV
```

Preconditions, all mandatory:
1. **Workers Paid** enabled ($5/mo) — non-negotiable, §5.2.
2. `RULESAd.md` §7.3 whitelist exception granted in writing.
3. CF Access application configured for `cms.` with the same policy as `secure.`
4. Accept the audit gap in §6.2, or build a Payload `afterChange` hook that writes into
   `admin_audit_log` (custom work, and it still will not carry PLAC granularity).
5. Pin `@payloadcms/db-d1-sqlite` and track #15070 / #14766 before trusting it with content.

Payload's tables coexist safely with ours in `madagascar-db` — separate table namespace,
1.9 MB of 5 GB used. That part is genuinely easy. Everything else is not.

---

## 8. Recommended blueprint — dynamic blog on the existing CMS

**Not yet implemented.** This is the proposal for approval.

### 8.1 Schema — new migration

Next number after `migrations/0008_email_suppression.sql` → `migrations/0009_blog_posts.sql`.

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id               TEXT PRIMARY KEY,          -- uuid
  slug             TEXT NOT NULL,             -- url segment, unique per locale
  locale           TEXT NOT NULL,             -- 'es' | 'en'  (SITE_LOCALES)
  title            TEXT NOT NULL,             -- ≤60 chars, SEO-enforced in Zod
  description      TEXT NOT NULL,             -- ≤160 chars, SEO-enforced in Zod
  body             TEXT NOT NULL,             -- sanitized HTML (matches faq/reviews handling)
  cover_image      TEXT,                      -- R2 CDN url from uploadImage()
  tags             TEXT NOT NULL DEFAULT '[]',-- JSON array
  author           TEXT NOT NULL DEFAULT 'Madagascar Pet Hotel',
  status           TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published'
  pub_date         TEXT NOT NULL,
  updated_date     TEXT,
  translation_slug TEXT,                      -- hreflang pair; mirrors content.config.ts
  last_updated_by  TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug_locale ON blog_posts(slug, locale);
CREATE INDEX IF NOT EXISTS idx_blog_posts_locale_status ON blog_posts(locale, status, pub_date DESC);
```

Field names deliberately mirror `cf-astro/src/content.config.ts` so the existing
`BlogPostContent.astro`, `BlogPostSchema.astro`, and `RelatedPosts.astro` components need
minimal prop changes.

Version history: reuse the `cms_content_history` pattern from `recordCmsHistory()` —
either a sibling `blog_posts_history` table or a `cms_content_history` row keyed
`blog:<slug>`. Prefer the sibling table; the existing one is keyed `(id, page)` and the
semantics do not fit cleanly.

### 8.2 cf-admin changes

| Area | File | Change |
|---|---|---|
| Migration | `migrations/0009_blog_posts.sql` | new (above) |
| Repository | `src/lib/dal/BlogRepository.ts` | new — **required**: `RULESAd.md` §7.7 forbids raw D1 SQL in `.astro` frontmatter |
| Writer API | `src/pages/api/content/blog.ts` | new — mirror `src/pages/api/content/faqs.ts`: PLAC gate via `placDenyResponse(user, '/dashboard/content')`, Zod validation, `sanitizeHtml`, then `revalidateAstro()` |
| Editor UI | `src/pages/dashboard/content/blog.astro` + `src/components/admin/content/BlogManager.tsx` | new — follow `GalleryManager.tsx` (Preact island, optimistic save, Retry Sync button) |
| Hub link | `src/pages/dashboard/content/index.astro` | add the Blog module card |
| PLAC | new migration row in `admin_pages` | register `/dashboard/content/blog` so the page is access-controlled like every other |
| Sync contract | `src/lib/sync-contract.ts` | add `blog_posts` to `CMS_KEY_ALLOWLIST` (`blog_index` is already reserved) |

### 8.3 cf-astro changes

| Area | File | Change |
|---|---|---|
| Sync contract | `src/lib/sync-contract.ts` | **must stay byte-identical** to cf-admin's — see [`reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md) §3 (C4) |
| Reader | `cf-astro/src/lib/cms.ts` | add `getBlogPosts(db, locale)` / `getBlogPost(db, locale, slug)` using the existing 3-tier resolution (KV `cms:blog_index` → D1 → empty) |
| Index routes | `src/pages/{es,en}/blog/index.astro` | `export const prerender = false`; swap `getCollection('blog')` for the D1 reader |
| Post routes | `src/pages/{es,en}/blog/[slug].astro` | `export const prerender = false`; drop `getStaticPaths()`, resolve slug at request time, 404 on miss |
| Body render | `cf-astro/src/components/sections/BlogPostContent.astro` | accept sanitized HTML instead of an Astro `<Content />` component |
| Sitemaps | `src/pages/sitemap-{es,en}.xml.ts` | read blog URLs from D1 rather than `getCollection('blog')` |
| RSS | `cf-astro/src/lib/rss.ts` | same swap |

Once `prerender = false` is set, the existing ISR middleware caches these routes
automatically — 24 h KV TTL, `Cache-Tag: page-<path>`, purged by the same
`revalidateAstro()` call the other six modules already use. **No new caching code.**

### 8.4 Phasing

| Phase | Deliverable | Free-tier check |
|---|---|---|
| 1 | Migration + `BlogRepository` + writer API + Zod schema. No UI. | D1 writes ≈ 2/publish |
| 2 | Content Studio Blog module + PLAC registration + audit rows | none |
| 3 | cf-astro reader + `prerender = false` on the 4 routes | **measure KV writes for one week** — 16 ISR PUTs/day expected against a 1,000/day cap |
| 4 | Sitemap + RSS + `BlogPostSchema` wired to D1 | verify GSC does not report lost URLs |
| 5 | Import the 14 existing Markdown posts (§9), then delete `cf-astro/src/content/blog/` | one-time D1 write burst of ~28 rows |
| 6 | Wire the existing `generate-blog-draft.ts` AI output into the Blog module as a draft | Workers AI free tier: 10,000 neurons/day |

Ship phases 1–2 and stop there if desired: the admin can author posts with nothing user-facing
changed, which de-risks phase 3.

### 8.5 Risks specific to this path

- **SEO regression is the real risk, not cost.** Moving 14 indexed URLs from prerendered to
  SSR+ISR must preserve exact paths, `trailingSlash: 'always'`, canonical tags, and the
  `translationSlug` hreflang pairing. Phase 4 gates on Google Search Console staying clean.
- **`sync-contract.ts` drift.** Two copies, no shared package (the $0-infra invariant). Edit
  both in the same commit, always.
- **Blog body is user-supplied HTML.** It must go through `sanitizeHtml` on write **and** the
  existing CSP must be re-verified — `RULESAd.md` §2 forbids `'unsafe-eval'`, and the
  report-only CSP canary is mid-rollout.

---

## 9. Migrating the 14 existing Markdown posts

One-time script, run once, then `cf-astro/src/content/blog/` and its `content.config.ts` collection
are deleted.

1. Read each file in `cf-astro/src/content/blog/{es,en}/*.md`.
2. Parse front-matter (`title`, `description`, `pubDate`, `updatedDate`, `author`,
   `coverImage`, `tags`, `draft`, `translationSlug`).
3. Render Markdown body → HTML, then `sanitizeHtml`.
4. Map `draft: true` → `status = 'draft'`, else `'published'`.
5. Insert with `slug` = filename minus extension, `locale` = parent directory.
6. **Verify the pairing survives.** The ES/EN slugs differ by design — e.g.
   `guia-pension-canina` ↔ `dog-boarding-guide` — and `translationSlug` is what keeps
   `<link rel="alternate" hreflang>` correct. Assert all 7 pairs resolve both ways before
   deleting the Markdown.

Existing pairs, for the assertion fixture:

| ES slug | EN slug |
|---|---|
| `guia-pension-canina` | `dog-boarding-guide` |
| `cuanto-cuesta-hotel-para-perros-aguascalientes` | `dog-boarding-cost-aguascalientes` |
| `guarderia-vs-pension-canina` | `daycare-vs-boarding` |
| `requisitos-pension-canina` | `dog-boarding-requirements` |
| `mascotas-en-vacaciones-guia` | `holiday-pet-care-guide` |
| `preparar-gato-hotel-felino` | `prepare-cat-for-boarding` |
| `viajar-con-mascotas-aguascalientes` | `traveling-with-pets-aguascalientes` |

---

## 10. Assumptions & open questions

| # | Assumption / question | Basis | Confidence | Impact if wrong |
|---|---|---|---|---|
| A1 | Account is on Workers Free across all services | Owner-confirmed 2026-07-26 | **High** | If already Paid, §5's cost objection vanishes — but §6 still stands |
| A2 | Instant publish is a hard requirement | Owner-confirmed 2026-07-26 | **High** | If relaxed, **Keystatic (§7.B) becomes the recommendation** — much less work |
| A3 | ~4 KV writes per publish | [`features/CMS.md`](../features/CMS.md) "Write Budget Per Publish" | High | Phase 3 measures it directly |
| A4 | Blog volume stays low (single-digit posts/month) | Current 14 posts over the site's life | Medium | At 250+ publishes/day the free KV cap binds — implausible |
| A5 | Payload's 3 MB overage is not closed soon | Template README says they are "actively trying to reduce" | Medium | Re-check in 6–12 months; would remove *one* of two blocks, not both |
| Q1 | Does the operator want scheduled publishing? | Not asked | — | Adds a cron trigger; cheap to add later, `status`/`pub_date` already support it |
| Q2 | Should blog images get their own R2 prefix (`blog/`)? | Not asked | — | Cosmetic; `uploadImage()` currently hardcodes `hero/` and `gallery/` prefixes |

**Recommended re-evaluation trigger for Payload:** revisit if *both* (a) Workers Paid is
enabled for other reasons, and (b) issues #15070 and #14766 are closed. Neither alone is
sufficient.

---

## 11. Corrections applied to other docs

The owner's confirmation that the account is Free contradicted two claims in the docs tree.
Corrected in this pass using the repo's existing strikethrough + superseded-note convention
(dated snapshots are annotated, never silently rewritten):

| File | What was wrong | Fix |
|---|---|---|
| [`2026-06-13-platform-status-summary.md`](../2026-06-13-platform-status-summary.md) §4 | Compute ceiling quoted only the Workers **Paid** figure | Annotated as Paid-plan; Free-plan 100k/day added |
| [`2026-06-13-platform-status-summary.md`](../2026-06-13-platform-status-summary.md) §6 | Cost table asserted "Workers Paid … **~$5**" as current spend | Struck through + superseded note: account is Free tier |

Verified as **already correct** and left unchanged:
[`operations/OPERATIONS.md`](../operations/OPERATIONS.md) §8 ($0 free tier),
[`RULESAd.md`](../../RULESAd.md) §15 ($0 total),
[`features/CMS.md`](../features/CMS.md) (already carries both Free and Paid KV rows),
[`2026-07-22-codebase-services-architecture-and-setup-review.md`](../2026-07-22-codebase-services-architecture-and-setup-review.md) §8
(already annotated 2026-07-26 as describing an all-free-tier posture).

---

## 12. Key code paths

- Existing CMS write + history → `src/lib/cms/storage.ts:updateCmsBlock`, `:recordCmsHistory`
- Existing image upload + validation → `src/lib/cms/storage.ts:uploadImage`, `:validateImageMagicBytes`
- Instant publish + durability → `src/lib/cms/revalidate.ts:revalidateAstro`, `:revalidateAstroOnce`
- Cross-repo contract (two copies, keep identical) → `src/lib/sync-contract.ts` ⇄ `cf-astro/src/lib/sync-contract.ts`
- 3-tier ISR read path → `cf-astro/src/middleware.ts`
- Revalidation receiver + KV injection → `cf-astro/src/pages/api/revalidate.ts`
- Current static blog → `cf-astro/src/content.config.ts`, `cf-astro/src/pages/{es,en}/blog/`
- AI blog drafting (already built) → `cf-astro/src/pages/api/admin/generate-blog-draft.ts`
- Live D1 state → `madagascar-db` `[D1_MADAGASCAR_DB_ID]`, 23 tables, 1.9 MB

---

## 13. Verification log

| Date | Checked by | Method | Result |
|------|-----------|--------|--------|
| 2026-07-26 | claude | Payload LICENSE.md + npm registry + GitHub repo metadata | MIT confirmed; v3.85.2 stable, v4 beta |
| 2026-07-26 | claude | Cloudflare Workers platform limits doc (live fetch) | Free 3 MB / 10 ms confirmed |
| 2026-07-26 | claude | `templates/with-cloudflare-d1/README.md` (live fetch) | "Paid Workers only" confirmed verbatim |
| 2026-07-26 | claude | Payload GitHub issues #15070 / #14766 / #15219 / #17216 / #14163 | all open |
| 2026-07-26 | claude | Cloudflare MCP — `workers_list`, `d1_database_query` on `madagascar-db` | 7 Workers; 23 tables; 1.9 MB |
| 2026-07-26 | claude | Code read — cf-admin `src/lib/cms/*`, cf-astro `src/middleware.ts`, blog routes | pipeline and static blog as described |
| 2026-07-26 | harshil | Plan confirmation | Workers **Free** across all services; instant-publish required |

---

## 14. Sources

**Payload**
- [Payload LICENSE.md (MIT)](https://github.com/payloadcms/payload/blob/main/LICENSE.md)
- [Payload is now completely free and open source](https://payloadcms.com/posts/blog/open-source)
- [`templates/with-cloudflare-d1` README](https://github.com/payloadcms/payload/blob/main/templates/with-cloudflare-d1/README.md)
- [Payload SQLite / D1 adapter docs](https://payloadcms.com/docs/database/sqlite)
- [Deploy Payload onto Cloudflare in a single click](https://payloadcms.com/posts/blog/deploy-payload-onto-cloudflare-in-a-single-click)
- Issues: [#15070](https://github.com/payloadcms/payload/issues/15070), [#14766](https://github.com/payloadcms/payload/issues/14766), [#15219](https://github.com/payloadcms/payload/issues/15219), [#17216](https://github.com/payloadcms/payload/issues/17216), [#14163](https://github.com/payloadcms/payload/issues/14163), [#16937 (sharp)](https://github.com/payloadcms/payload/discussions/16937)

**Cloudflare**
- [Payload on Workers: a full-fledged CMS running entirely on Cloudflare's stack](https://blog.cloudflare.com/payload-cms-workers/)
- [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [workerd#5175 — GraphQL blocker](https://github.com/cloudflare/workerd/issues/5175)

**Alternatives**
- [Keystatic](https://keystatic.com/) · [thinkmill/keystatic](https://github.com/thinkmill/keystatic) · [Astro × Keystatic guide](https://docs.astro.build/en/guides/cms/keystatic/)
- [Sveltia CMS](https://sveltiacms.app/en/) · [sveltia/sveltia-cms](https://github.com/sveltia/sveltia-cms)
- [Astro × Payload CMS guide](https://docs.astro.build/en/guides/cms/payload/)

**Internal**
- [`features/CMS.md`](../features/CMS.md) — current CMS architecture, KV write budget
- [`reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md) — sync contract, C4 drift rule
- [`architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) — PLAC + audit model
- [`operations/OPERATIONS.md`](../operations/OPERATIONS.md) §8 — canonical cost statement
- [`2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md) §5–6 — verified vendor rates, scale ceiling
- [`RULESAd.md`](../../RULESAd.md) §7.3 whitelist policy, §15 $0 cost rule

---

## 15. Related

- [`features/CMS.md`](../features/CMS.md)
- [`reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md)
- [`architecture/plac-and-audit.md`](../architecture/plac-and-audit.md)
- [`2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md)
- [`specs/2026-05-13-cms-ui-redesign.md`](2026-05-13-cms-ui-redesign.md)

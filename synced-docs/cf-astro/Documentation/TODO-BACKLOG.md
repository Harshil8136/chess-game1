{% raw %}
# 📋 Madagascar Pet Hotel — ToDo

> Last updated: 2026-05-29 — moved from the repository root to `Documentation/` on 2026-09-15 (one docs root). The open items below have not been re-verified since 2026-05-29; treat each as a lead, not a fact.
> All security layers (Rate Limiting, Turnstile, Drizzle ORM), email queue, and observability are complete and deployed.

---

## 0. 🔐 Security & Compliance Review Follow-ups (2026-05-29)

> Source: [Documentation/19-SECURITY-COMPLIANCE-REVIEW-2026-05.md](./19-SECURITY-COMPLIANCE-REVIEW-2026-05.md).
> Each item preserves existing booking/Turnstile/connector behavior. Items needing
> approval are marked. **Do not** violate the invariants in [AGENTS.md](../AGENTS.md).

- [x] 🟢 **Legal pages professionalized (2026-05-29)** — Privacy & Terms moved to a
      plain, non-animated `LegalLayout` with `.legal-doc` typography; casual/marketing
      copy, ALL-CAPS, emoji, and the redundant version banner removed (see CHANGELOG
      Pass 3). Optional follow-up: apply the same to the ARCO legal page
      (`/legal/arco`, currently still on `MarketingLayout` because of its upload form).

- [x] 🟡 **Privacy notice rewrite** — DONE (branch `claude/security-compliance-fixes-cqa4S`):
      category-based disclosure, fixed Vercel/Frankfurt/Brevo inaccuracies, IP +
      fingerprint + interaction-proof disclosed by category with retention, v3.1.
- [x] 🟢 **Removed legacy duplicate `Legal.privacy` dict** (was unreferenced).
- [x] 🟡 **Terms LFPC carve-out** — additive non-waivable-rights clause added (no
      commercial term changed). Full clause revision still pending counsel.
- [x] 🟢 **ARCO `Content-Disposition` filename hardening** — done.
- [x] 🟢 **CI: Dependabot** — `.github/dependabot.yml` added.
- [x] 🟢 **Rotate `BETTERSTACK_SOURCE_TOKEN`** — ✅ Rotated 2026-06-13 (see AGENTS.md / wrangler.toml); prior 401 log-shipping failures resolved.
- [ ] 🟡 **Burst-guard before D1 audit write** in `booking.ts`/`consent.ts` —
      deferred (booking path is critical; needs approval + load testing).
- [ ] 🟡 **Nonce/hash CSP** — remove `'unsafe-inline'`/`'unsafe-eval'` from `script-src` (needs staged testing).
- [ ] 🟡 **Email-retry cron** — scan `booking_attempts WHERE status='queue_error'` and re-enqueue.
- [ ] 🟢 **Enable Supabase leaked-password protection** (dashboard).
- [ ] 🟡 **Terms full clause revision** with counsel (refund/no-show + §12 GitHub Actions wording).

---

## 1. ✅ Cloudflare Queues — Async Email Delivery

**Completed:** April 2026
**Implementation:** `cf-email-consumer` sidecar worker deployed. All transactional emails (booking confirmation × 2, ARCO admin notification) are delivered asynchronously via `madagascar-emails` queue with 3 retries + DLQ (`madagascar-emails-dlq`). See `../cf-email-consumer/` and `RULES.md §6.13` for full architecture.

---

## 2. 🟡 Frontend Polish — Mobile, Animations, CSS

**Priority:** Medium
**Effort:** ~4–6 hours
**Why:** The core functionality works, but there are visual refinements needed to match the premium brand identity, especially on mobile breakpoints.

### What to do

#### Mobile Responsiveness

- [ ] Test all pages at 320px, 375px, 414px, 768px breakpoints
- [ ] Fix booking wizard overflow on small screens (Step 3 transport buttons)
- [ ] Ensure the date picker is fully visible on mobile without horizontal scroll
- [ ] Header hamburger menu — verify smooth animation and full-screen overlay
- [ ] Footer — check stacking order on mobile, ensure legal links are accessible

#### Animations & Micro-interactions

- [ ] Add staggered fade-in to service cards on homepage
- [ ] Gallery section — ensure lazy-loaded images have a skeleton/blur placeholder
- [ ] Booking wizard step transitions — verify no layout shift during animation
- [ ] Success state animation — test the spring animation is smooth on low-end devices
- [ ] Scroll-reveal sections — tune `[SUPABASE_PROJECT_REF]` thresholds for earlier trigger

#### CSS & Design System

- [ ] Audit all color tokens against the "Solid Canvas" palette in `src/styles/global.css` (`@theme` block — no `tailwind.config.mjs` in v4)
- [ ] Ensure consistent border-radius (rounded-2xl vs rounded-3xl) across cards
- [ ] ~~Dark mode form inputs — verify contrast ratios meet WCAG AA~~ — N/A: site is forced light-only (`data-theme="light"`, `color-scheme: light only`). Either strip the shipped dark tokens/`dark:` variants (dead CSS) or re-enable dark mode first.
- [ ] Review `backdrop-blur` performance on Safari iOS (known to cause jank)

#### Specific Components

- [ ] Language switcher — verify it works on all pages including blog/legal.
      Blog posts now verify the counterpart exists before emitting an alternate,
      and all 14 imported articles are correctly paired (checked by join,
      2026-08-30), so the blog half is likely fine; legal pages unverified.
- [ ] Testimonials carousel — test infinite scroll on touch devices
- [ ] Contact section — WhatsApp button mobile responsiveness

---

## 3. 🟢 Sitemap / Robots.txt Enhancements

**Priority:** Low
**Effort:** ~1 hour
**Why:** The current sitemap and robots.txt are functional but can be improved for better crawl budget allocation and international SEO.

### What to do

#### Sitemap

- [x] Verify `sitemap-index.xml` includes all localized pages (`/es/*` and `/en/*`) — ✅ Done (Apr 2026)
- [x] Add `<xhtml:link rel="alternate">` hreflang annotations inside each `<url>` entry — ✅ Done
- [x] Include `<lastmod>` dates based on actual content update timestamps — ✅ Done (from `post.data.updatedDate ?? pubDate`)
- [x] ~~Add `<changefreq>` hints~~ — Intentionally NOT emitted: sitemaps deliberately omit `<changefreq>`/`<priority>` because Google ignores both (see comment in `sitemap-en.xml.ts`).
- [x] Exclude API routes (`/api/*`) from the sitemap — ✅ Done (not in entries)
- [x] Add blog posts to sitemap dynamically — ✅ Now merges D1 **and** the static
      collection, keyed by slug with D1 winning (2026-08-30). The feeds and
      `sitemap-index.xml` use the same `getMergedBlogPosts` helper, so the four
      endpoints can no longer disagree about which posts exist. This line
      previously described the pre-D1 world and had been stale since 39150fd.

#### Robots.txt

- [x] Block `/api/` paths from crawling — ✅ Done
- [x] ~~Block `/_astro/` hashed assets~~ — REVERSED (commit e2e4e09): robots.txt now deliberately ALLOWS `/_astro/` and CDN images so Google can render pages.
- [x] Add `Sitemap: https://madagascarhotelags.com/sitemap-index.xml` — ✅ Done
- [ ] Consider adding `Crawl-delay: 1` for non-Google bots (optional — current implementation already separates SEO and polite crawlers)

#### Structured Data (Bonus)

- [ ] Verify `LocalBusiness` schema includes both Aguascalientes locations
- [ ] Add `FAQPage` schema to the services page
- [ ] Add `BreadcrumbList` schema to all inner pages
- [ ] Test all structured data with Google's Rich Results Test

---

## ✅ Completed Tasks (For Reference)

| Task                         | Date     | Details                                       |
| ---------------------------- | -------- | --------------------------------------------- |
| Drizzle ORM migration        | Mar 2026 | Replaced raw Supabase REST with type-safe ORM |
| Hyperdrive provisioning      | Mar 2026 | PostgreSQL connection pooling via CF edge     |
| Upstash rate limiting        | Mar 2026 | Sliding window on all 3 API routes            |
| Turnstile bot protection     | Mar 2026 | Invisible on booking, managed on ARCO         |
| Production secrets deploy    | Mar 2026 | 8 secrets via `wrangler pages secret bulk`    |
| Public vars in wrangler.toml | Mar 2026 | 8 vars in `[vars]` section                    |

{% endraw %}

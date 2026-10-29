{% raw %}
# 📋 Madagascar Pet Hotel — ToDo

> The living backlog (`main.md` §4: something left undone, or a problem found). Newest
> sections first; each section says when and how it was checked. Sections 0 to 3 date from
> 2026-05-29 (moved here from the repository root on 2026-09-15); their open items are leads,
> not facts, except where a 2026-10-17 note says otherwise.

## 0e. 🇲🇽 Visibility beyond Aguascalientes (2026-10-29)

> The owner's multi-phase program; the approach and its rules are
> [ADR-0004](./adr/0004-visibility-beyond-aguascalientes.md) (proposed), the owner steps are
> [`SEO-OPERATIONS.md`](./SEO-OPERATIONS.md) §10. Baseline checked 2026-10-29 in PostHog (180
> days): 57% of visitors from the state of Aguascalientes; 3 visitors from blog pages and none
> from the neighbourhood pages.

- [x] **Phase 0: baseline and rules.** Done 2026-10-29: the baseline above, ADR-0004, §10.
- [ ] **Phase 1: people coming to Aguascalientes.** Guides whose searches name the city: the
      Feria de San Marcos with a pet (live before February for the 2027 edition), visiting family,
      business trips, road trips through the city, moving here.
- [ ] **Phase 2: the real region (about 2 hours).** A page per town only where the business
      truly serves it, with its own facts. Needs from the owner: which towns TaxiPet reaches, at
      what price. Fix or merge the seven neighbourhood pages (`src/data/zones.ts`,
      `ZoneLanding.astro`): one template with the name swapped, no visitors in 180 days, close to
      what Google calls doorway pages.
- [ ] **Phase 3: nationwide know-how.** Spanish guides on questions asked across Mexico, and one
      piece of original data with sources.
- [ ] **Phase 4: the franchise across Mexico.** The franchise pages in depth; needs the real
      figures from the owner.
- [ ] **Phase 5: presence off the site.** Directories, press, video, Wikidata (owner steps, texts
      prepared here).
- [ ] **Phase 6: measurement in cf-admin.** Share of visitors and searches from outside the state,
      and visits from AI assistants, on the Analytics page.
- [ ] 🟢 **`areaServed` names Jesús María** (`src/data/business.ts`) with no state or country.
      Review in phase 2 with the towns the owner confirms.

## 0d. 📚 Found in the documentation pass (2026-10-17)

> Checked against the code, the live D1 and Supabase databases (connectors, read-only) on
> 2026-10-17. Code was not changed in that pass; each item needs a code change or the owner.

- [ ] 🟡 **`www` and `pet` redirect loop: re-check.** `SYSTEM-ARCHITECTURE.md` §8 records that
      on 2026-08-10 both hosts redirected to themselves, which the Worker's code cannot do. Not
      re-checked since: the documentation session's network could not reach the site. On a
      phone, open `https://www.madagascarhotelags.com/`: it should land on
      `https://madagascarhotelags.com/es/`. If it loops, remove `www`/`pet` from any old Pages
      project in the dashboard and attach them to the `cf-astro` Worker or keep only the
      Redirect Rules.
- [ ] 🟢 **The MCP and WebMCP service lists disagree with the published skill.** `/api/mcp`
      `get_services` and the WebMCP `get_services` tool (`BaseLayout.astro`) say medication is
      "Included"; `llms-full.txt` and `/.well-known/agent-skills/services/SKILL.md` say
      "Priced by treatment". The tools also list fewer services than the skill. One source
      for the catalog would stop this.
- [ ] 🟢 **`privacy_requests` is still declared in `src/lib/db/schema.ts`**, but the live table
      was renamed `zz_dead_privacy_requests_20260916` on 2026-09-16. Drop the declaration (a
      schema change: `npm run db:generate` and `npm run db:check`) when the table is dropped.
- [ ] 🟢 **The `arco` rate-limit key has no route.** `RATE_LIMIT_MAX.arco` in
      `src/lib/sync-contract.ts` is unused since `/api/privacy/arco` was removed; cf-admin's
      mirror of the contract would have to drop it too.
- [ ] 🟢 **Three hardening indexes are gone** from the live database
      (`idx_booking_quality_metadata_booking_id`, `idx_bookings_owner_email`,
      `idx_privacy_requests_email`; `SECURITY.md` §11). Probably harmless at this size;
      re-create them only if a query needs them.

---

## 0c. 🔐 Permissions review follow-ups (2026-10-15, item #40)

> Source: [the change record](./records/2026-10-15-website-permissions.md). Checked against
> the code, cf-admin's code (read-only), the live Supabase grants and the live D1 tables on
> 2026-10-15. Each open item needs the owner, a secret, a dashboard change, a database
> change or cf-admin.

- [ ] 🟡 **Booking replay: cf-admin's secret through the binding only.** `/api/booking/replay`
      is the one endpoint that still takes `REVALIDATION_SECRET` from the internet. cf-admin
      already calls it through its binding (`https://internal/api/booking/replay/`), so the
      change is one line (`bindingOnlySecret`, as in `/api/consent/replay`) plus its test. It
      was left alone because the booking path is life-safety-adjacent and the 2026-09-02
      incident was a change to exactly this check. Owner's yes first.
- [ ] 🟡 **cf-admin: write the trailing slash on binding calls.** cf-admin calls
      `https://internal/api/revalidate`, `https://internal/api/cms-status?keys=…` and (the
      connectivity diagnostic) `http://internal/api/health` without the slash. Astro
      (`trailingSlash: 'always'`) answers each with a redirect before any of our code runs,
      and Cloudflare's documentation says a service-binding `fetch` follows a redirect over the
      public internet, where `internal` does not resolve. Not settled in production: Sentry
      has no revalidate issue and `sync_outbox` is empty, but no recorded publish proves it
      works. The fix is in cf-admin: `/api/revalidate/`, `/api/cms-status/?keys=`,
      `https://internal/api/health/`.
- [ ] 🟡 **ARCO documents through the portal, named.** Nobody calls
      `/api/arco/get-document` from code: the owner fetches by hand. The cf-astro side is ready:
      a call through the binding may carry `x-arco-actor` (cf-admin's `encodeActor` v1 user
      actor) and the record names that person. cf-admin would add a PLAC-gated route that
      calls `https://internal/api/arco/get-document/?ticket=ARCO-NNNNNN` with `X-Admin-Secret`
      and `x-arco-actor`, and writes its own `admin_audit_log` row (#20). That needs
      `ARCO_ADMIN_SECRET` copied to cf-admin (not a new secret, a second holder): the owner's
      decision. Then this endpoint can refuse the internet like `/api/revalidate`.
- [ ] 🟡 **Narrow the writer's read of `legal_requests`.** `cf_astro_writer` may SELECT every
      column of `legal_requests` (names, email, phone, description) with a `using (true)`
      policy; the code reads five columns by ticket number. A database change for the owner,
      as a tracked Supabase migration:

      ```sql
      begin;
      revoke select on public.legal_requests from cf_astro_writer;
      grant select (ticket_number, document_path, identity_doc_mime, full_name, arco_right)
        on public.legal_requests to cf_astro_writer;
      revoke insert on public.zz_dead_privacy_requests_20260916 from cf_astro_writer;
      commit;
      ```

      Once documents are fetched through the portal (above), the SELECT can go entirely.
      Then update `db/postgres-cf-astro-writer-grants.sql` and SECURITY.md §12.

- [ ] 🟢 **Delete the unused superuser secret.** No code reads `DATABASE_URL_ADMIN`, and a
      Worker secret cannot be read back, so it serves no emergency. Whether it is set could
      not be checked (the connector lists Workers without their secrets). On the phone:
      Cloudflare dashboard → Workers & Pages → `cf-astro` → Settings → Variables and Secrets →
      `DATABASE_URL_ADMIN` → Delete. While there, also delete `UPSTASH_REDIS_REST_TOKEN`,
      `SENTRY_DSN` and `SUPABASE_SERVICE_ROLE_KEY` if listed (none is read). Changing the
      `postgres` password afterwards is the owner's call.
- [ ] 🟢 **Preview URLs.** `wrangler.toml` sets neither `workers_dev` nor `preview_urls`, so
      both are on, and the form origin check keeps accepting this Worker's own version URLs
      (`<prefix>-cf-astro.mascotasmadagascar.workers.dev`). Nothing uses them (main-only
      deploys). Turning previews off would let that rule go: an owner decision.

## 0b. 🔎 Blog SEO / GEO audit follow-ups (2026-10-10)

> Source: [the change record](./records/2026-10-10-blog-seo-audit-fixes.md) and the audit
> report in the project. Found by reading the code and fetching the live sitemaps and
> pages on 2026-10-10; D1 was not queried directly.

- [x] ~~🟡 **A real author for each post.**~~ **Done 2026-10-10** (round 2, [record](./records/2026-10-10-blog-round-2-ai-json-and-cache.md)):
      the cf-admin Studio has an Author field and saves it on edit; the schema emits a
      `Person` for any name other than the business.
- [x] ~~🔴 **Repair or archive `/en/blog/why-chose-us/` in D1**~~ **Done 2026-10-10** (owner chose
      "Repair it"): through the Cloudflare D1 connector the stored body became the article alone,
      `aio_data` the three real questions the model wrote, and the stale `blog_redirects` row
      (`why-chose-us` en → `/en/blog/`) was deleted. The previous row is revision v3 in
      `blog_posts_history`, restorable from the Studio. The title ("Why Chose Us?") and
      description are unchanged: rewriting them is an editorial choice for the owner.
- [x] ~~🟢 **A redirect row left behind by a republish.**~~ **Done 2026-10-11** in cf-admin's
      `BlogRepository`: a post going live at a slug deletes that slug's own redirect row.
- [ ] 🟢 **Edge cache in front of KV.** Worker responses never enter Cloudflare's zone cache,
      so the `s-maxage`/`CDN-Cache-Control` headers and the zone purge by `Cache-Tag` in
      `/api/revalidate` have nothing to act on; KV is the only page cache. Serving pages
      through `caches.default` (or Workers cache) would make that purge real and save KV
      reads. An owner decision: it changes how a publish becomes visible.
- [ ] 🟢 **Pricing read memo.** `getPricing` falls back to D1 on a KV miss and never writes
      the KV key back, so every miss repeats the D1 read.
- [ ] 🟡 **RSS with full content, and crawlable.** The feeds carry only the summary, and
      robots.txt disallows them, which stops Google using them for discovery (they already
      send `noindex`).
- [x] ~~🟢 **Articles in `llms.txt`.**~~ **Done 2026-10-29**: `/llms.txt` is an on-demand route
      that lists every published article, cached like the sitemaps (FRONTEND-AND-SEO.md §4.3).
- [ ] 🟢 **Thin tag pages.** About 25 tag pages per locale for 8 posts. Consider `noindex`
      below 2–3 posts (an indexing-policy decision for the owner).
- [x] ~~🟢 **`410 Gone` for archived posts**~~ **Done 2026-10-11**: `resolveMissingPost` in
      `src/lib/blog.ts`; cf-admin no longer records a redirect to the index on archive.
- [ ] 🟢 **`og:image` size for covers.** BaseLayout always claims 1200×630.
- [ ] 🟢 **`sitemap-index.xml` lastmod** follows the newest publish date only, not edits.
- [ ] 🟢 **Blog index and un-imported Markdown posts.** Once D1 has a post in a locale, the
      index lists only D1 posts; a Markdown post never re-published in D1 would drop off the
      index while staying in the sitemap. Not the case today (all 14 are in D1, inferred
      from the live sitemaps).
- [ ] 🟢 **`google-site-verification` value** has the shape of a verification file name, not a
      meta token. Harmless if the property is verified by DNS; confirm in Search Console.

## 00. ⚙️ Resource-usage follow-ups (2026-10-04)

> Source: [the change record](./records/2026-10-04-resource-usage.md). Added 2026-10-07
> when the work was committed; only the heartbeat item below was checked against
> production (GitHub connector, 2026-10-07).

- [x] ~~**Set the consent heartbeat's secret** (owner).~~ **Done by 2026-10-08:**
      the GitHub runs from then reach the check step, where Cloudflare's bot
      protection challenges them, so the workflow's schedule was turned off on
      2026-10-10 and the server job runs the heartbeat (CONSENT-RECORD-SYSTEM.md
      §4). The original item: `HEALTH_CHECK_SECRET`
      is not set as a GitHub Actions secret in this repository (Settings → Secrets
      and variables → Actions), so every run sampled from 2026-09-07 to 2026-10-07
      checked nothing, drained no outbox and still ended green. Since 2026-10-07
      such a run fails, so the heartbeat goes red on every GitHub run until it is
      set. Use the same value as the Worker's `HEALTH_CHECK_SECRET` (make a new one
      and set it in both places if the Worker's is not known). Since the D1 audit
      moved into the Worker (2026-10-07), `CLOUDFLARE_API_TOKEN` is **no longer
      needed**. Then run the workflow once by hand and check the summary shows a
      verdict ([WHERE-THE-DATA-LIVES.md](./WHERE-THE-DATA-LIVES.md)).

- [ ] 🔴 **Check the rate-limit bindings after the first deploy.** Read the Workers
      Builds log: wrangler must accept the ten `[[ratelimits]]` bindings on this
      account's plan. Then send the contact form once from a phone. If the bindings
      are refused, the deploy fails and the previous version stays live; if they
      throw at runtime, the KV fallback decides and the logs say "Rate-limit binding
      error". The Free-plan allowance for the binding was **not** re-read on
      2026-10-04 (the pricing page could not be fetched from the session); check it
      on the first bill or the account's usage page.
- [ ] 🟡 **Delete the retired Upstash secret from cf-astro** (owner):
      `npx wrangler secret delete UPSTASH_REDIS_REST_TOKEN`. The code no longer reads it.
- [ ] 🟡 **Retire the Upstash database** once cf-admin and cf-chatbot no longer use it.
      Not before: they still read and write it. cf-admin's record of processing
      (RoPA) should stop listing Upstash for the public site's rate limiting.
- [ ] 🟡 **cf-admin history rollback cannot reach two KV keys.** A rollback of
      `about_stats` or `faq_items` sends those block ids, but the KV keys are `about`
      and `faqs`, so `/api/revalidate` drops them as not allowlisted and the page
      shows the old value until the 24 h `cms:` TTL ends or the block is published
      again. The fix belongs in cf-admin (send the published key name).
- [ ] 🟢 **Outbox redrive ordering.** cf-admin's sync outbox redrives a stored
      `cmsData` snapshot; one that lands after a newer publish writes the older
      value, now for up to 24 h instead of 1 h. A version or timestamp check would
      close it.
- [x] ~~🟢 **Skip the ISR KV read for paths with a file extension.**~~ Done 2026-10-10:
      `isIsrEligiblePath` (`src/lib/isr-response.ts`) skips any dotted path before the
      middleware reads KV.
- [ ] 🟢 **A free WAF rule for scanner paths** (`.env`, `.git`, `wp-`,
      `phpmyadmin`) would stop them before the Worker runs. A dashboard change, so
      it needs the owner.
- [ ] 🟢 **cf-graph still says rate limiting is "Redis-backed".** Its public
      Systems view (`data/platform-facts.source.ts` in cf-graph) should name
      Cloudflare's built-in rate limiting once this site and cf-admin are deployed
      without Upstash, in cf-graph's general wording (no binding names or limits).
- [ ] 🟢 **This site's traces land in the Sentry project `cf-admin`.** The Sentry
      connector (2026-10-07, last 7 days) shows every `cf-astro@…` release's spans
      under project `cf-admin` and none under project `cf-astro`. Both the browser
      and the server tag their events `cf-astro@<build>`, so at least one of the
      site's DSNs points at cf-admin's project; check both and point them at
      `cf-astro` (owner, a secret change) so the two apps' usage and alerts can be
      told apart.

---

## 0. 🔐 Security & Compliance Review Follow-ups (2026-05-29)

> Source: [Documentation/19-SECURITY-COMPLIANCE-REVIEW-2026-05.md](./19-SECURITY-COMPLIANCE-REVIEW-2026-05.md).
> Each item preserves existing booking/Turnstile/connector behavior. Items needing
> approval are marked. **Do not** violate the invariants in [AGENTS.md](../AGENTS.md).

- [x] 🟢 **Legal pages professionalized (2026-05-29)** — Privacy & Terms moved to a
      plain, non-animated `LegalLayout` with `.legal-doc` typography; casual/marketing
      copy, ALL-CAPS, emoji, and the redundant version banner removed. Optional follow-up: apply the same to the ARCO legal page
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
- [x] ~~🟡 **Burst-guard before D1 audit write** in `booking.ts`/`consent.ts`~~ — done:
      `burstAllowed` (`src/lib/rate-limit.ts`) runs before the audit write in both routes
      (checked in the code 2026-10-17).
- [ ] 🟡 **Nonce/hash CSP** — remove `'unsafe-inline'`/`'unsafe-eval'` from `script-src` (needs staged testing).
- [ ] 🟡 **Email-retry cron** — scan `booking_attempts WHERE status='queue_error'` and re-enqueue.
- [ ] 🟢 **Enable Supabase leaked-password protection** (dashboard).
- [ ] 🟡 **Terms full clause revision** with counsel (refund/no-show + §12 GitHub Actions wording).

---

## 1. ✅ Cloudflare Queues — Async Email Delivery

**Completed:** April 2026
**Implementation:** `cf-email-consumer` sidecar worker deployed. All transactional emails (booking confirmation × 2, ARCO admin notification) are delivered asynchronously via `madagascar-emails` queue with 3 retries + DLQ (`madagascar-emails-dlq`). The consumer is its own repository, `cf-email-consumer`; the April design is in [`archive/2026-04-12-async-email-logging-design.md`](./archive/2026-04-12-async-email-logging-design.md).

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
- [x] ~~Add `FAQPage` schema to the services page~~ — dropped: Google retired FAQ rich results (`SEO-OPERATIONS.md` §9); FAQ content stays in the HTML
- [ ] Add `BreadcrumbList` schema to all inner pages
- [ ] Test all structured data with Google's Rich Results Test

---

## ✅ Completed Tasks (For Reference)

_Historical (March 2026). Since then Hyperdrive was removed, Upstash was replaced by the Workers
Rate Limiting binding (2026-10-04), Turnstile was taken off booking for good (AGENTS.md
invariant #1), and secrets are set with `wrangler secret put` on the Worker._

| Task                         | Date     | Details                                       |
| ---------------------------- | -------- | --------------------------------------------- |
| Drizzle ORM migration        | Mar 2026 | Replaced raw Supabase REST with type-safe ORM |
| Hyperdrive provisioning      | Mar 2026 | PostgreSQL connection pooling via CF edge     |
| Upstash rate limiting        | Mar 2026 | Sliding window on all 3 API routes            |
| Turnstile bot protection     | Mar 2026 | Invisible on booking, managed on ARCO         |
| Production secrets deploy    | Mar 2026 | 8 secrets via `wrangler pages secret bulk`    |
| Public vars in wrangler.toml | Mar 2026 | 8 vars in `[vars]` section                    |

{% endraw %}

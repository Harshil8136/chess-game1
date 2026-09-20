---
title: "GSC Validation Readiness Engine"
status: active
audience: [ai, technical, operator, owner]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/seo/validation-readiness.ts, src/lib/seo/discovery-inspector.ts, src/pages/api/seo/validation-readiness.ts, src/pages/api/seo/discovery-health.ts, src/components/admin/seo/DiscoveryCoveragePanel.tsx, src/components/dashboard/widgets/GscValidationWidget.tsx, src/components/dashboard/widgets/ServiceStatusStrip.tsx]
related_docs: [SEARCH-CONSOLE-SYNC.md, DASHBOARD.md, CRON-CONTROL.md, ../runbooks/dev-server-optimize-deps-missing.md, ../architecture/plac-and-audit.md]
tags: [feature, seo, search-console, indexing, validation, preact, dialog]
---

# GSC Validation Readiness Engine

> **Rewritten 2026-09-19.** This document was titled "Google Search Console Error
> Auto-Healing & Validation Readiness Engine" and described a 12-hour cron
> heartbeat, a "GSC Validation Health — 100% Ready" dashboard KPI card, a `gsc`
> dashboard tab and a Vite configuration — **none of which exist**, and the Vite
> section gave advice that is the exact opposite of what `astro.config.ts` does
> and says. It also presented several hard-coded constants as live measurements.
> Everything below was re-derived from the code and the live database. The sync
> feature itself — the part that actually talks to Google on a schedule — is
> owned by [`SEARCH-CONSOLE-SYNC.md`](SEARCH-CONSOLE-SYNC.md), and **both of its
> syncs are switched off**; read that document's banner first.

> **TL;DR:** An on-demand scorer. When an operator opens the SEO dashboard, it
> crawls the site's own sitemap URLs from the edge, checks each one for
> redirects, 404s, thin copy and missing structured data, and produces a
> **Validation Readiness Score (0–100%)** plus a per-category remediation drawer.
> It answers one question: *if I click "Start New Validation" in Search Console
> right now, would it pass?* It does not call any Google API, it does not fix
> anything by itself, and nothing runs it on a timer.

## 1. Why it exists

When Googlebot crawls `sc-domain:madagascarhotelags.com`, it files unindexed URLs
under five diagnostic reasons in Search Console:

1. **Page with redirect** — URLs returning 301/308
2. **Not found (404)** — dead slugs or broken internal references
3. **Crawled - currently not indexed** — low copy density or missing schema
4. **Blocked by robots.txt** — private or admin paths
5. **Excluded by 'noindex' tag** — preview and utility pages

Clicking **"Start New Validation"** in GSC without fixing the underlying issue
makes Google re-crawl the sample URLs, fail the validation, and lower the
property's crawl priority. Validating a genuine fix does the opposite. This
subsystem is the pre-flight check for that decision.

## 2. How it actually runs

There is **no scheduled trigger.** `runValidationReadinessAudit()` has exactly two
callers, both in `src/pages/api/seo/validation-readiness.ts`:

| Call | What happens | Cost |
|---|---|---|
| `GET /api/seo/validation-readiness` | Serves the cached summary from `admin_portal_settings` if one exists | 1 row read |
| `GET …?fresh=true` | Runs the full live crawl, writes a `gsc_index_log` row and re-caches the summary | crawl + 2 D1 writes, **no rate limit** |
| `POST /api/seo/validation-readiness` | Same full crawl, Admin+ only, 15/hour | crawl + 2 D1 writes |

The cache is a single `admin_portal_settings` row,
`seo-validation-readiness-latest`. **Live today it was written on 2026-08-26 at
17:22 UTC** and reads:

```json
{"overallReadinessScore":76,"cleanUrlsCount":45,"totalUrls":87,
 "redirects":0,"notFounds":0,"thinContentPages":60}
```

So the honest current state is **76%, with 60 of 87 URLs thin or missing schema**,
from a report nearly a month old. Any screen showing "100%" is showing a literal
string, not this number — see [§5](#5-what-the-dashboard-actually-shows).

```text
Operator opens /dashboard/seo (or the main dashboard widget)
        │
        ▼
GET /api/seo/validation-readiness      ── cached summary? ──▶ render it
        │  (?fresh=true, or no cache)
        ▼
runValidationReadinessAudit()          src/lib/seo/validation-readiness.ts
        ├─ fetch sitemap-index + es/en sitemaps
        ├─ per URL: status code, canonical, word count, JSON-LD presence
        ├─ score 3 categories, hard-code 2  (§3)
        └─ write gsc_index_log row + cache the summary
```

## 3. The five categories — what is measured and what is not

Located in `src/lib/seo/validation-readiness.ts`. **Three categories are computed.
Two are placeholders.** The doc previously presented all five as verified
measurements; that is the single most misleading thing it said.

### Measured

| Category | Readiness condition | Weight in the overall score |
|---|---|---|
| `page_with_redirect` | 100% when zero sitemap URLs return a redirect hop | 0.35 |
| `not_found_404` | 100% when every sitemap endpoint returns HTTP 200 | 0.35 |
| `crawled_not_indexed` | `100 − 10 × (thin or schema-less URLs)`, floored at 20 | 0.30 |

"Thin" means a word-count estimate **under 180 words**, or no Schema.org markup
(`LocalBusiness`, `FAQPage`, `BreadcrumbList`, `PetBoardingService`). *Corrected
2026-09-19: this document said ">250 words" and "90–100% score".* On the cached
path — when the summary is served rather than re-crawled — this category is shown
as a flat **60** rather than the formula's output.

The overall score is the weighted sum of those three, and nothing else.

### Hard-coded — treat as decoration, not data

| Category | What the code emits | Reality |
|---|---|---|
| `blocked_robots` | `readinessScore: 100`, `pagesAffectedCount: 14`, `lastValidationStatus: 'started'`, "Validation is already in progress in GSC" | All four are literals. Nothing counts robots-blocked pages, and nothing asks GSC whether a validation is running. |
| `excluded_noindex` | `readinessScore: 100`, `pagesAffectedCount` = discovered noindex URLs **or 8 when none are found**, `lastValidationStatus: 'started'` | The `100` and the `8` fallback are literals. |

Neither contributes to the overall score. The underlying *claims* are reasonable
— admin routes should be robots-blocked, utility pages should be `noindex` — but
the portal is not verifying them, and a fixed "100% — Verified correct security
isolation" reads as a measurement. This is a **RULE #0.5** defect against the
code, logged in [`../MAINTENANCE.md`](../MAINTENANCE.md); the fix is either to
measure the two categories or to render them as "not measured".

## 4. The remediation drawer (RULESAd §7.8)

`DiscoveryCoveragePanel.tsx` and `GscValidationWidget.tsx` follow the RULESAd.md
§7.8 overlay standard, and this part was verified accurate:

- **In-place collapsible drawer.** Clicking a category card rings it and expands a
  drawer inline under the 5-card grid — content renders inside the page flow, so
  it cannot be clipped by a scroll container. Clicking the active card again, or
  `✕`, collapses it. The drawer carries the root-cause text, the fix recipe, the
  step-by-step GSC guide, the affected-URL list with one-click clipboard copy, and
  a deep link into Search Console.
- **Native top-layer `<dialog>`.** `#gscCategoryRemediationDialog` is a real
  `<dialog>` opened with `showModal()`, not a `fixed inset-0` div, so it escapes
  `.admin-main-content`'s `overflow-y: auto` entirely. Its backdrop is styled
  through `::backdrop`.

## 5. What the dashboard actually shows

*Corrected 2026-09-19 — the previous §5 described a KPI card, a tab and a chip
that do not exist as written.*

- **There is no GSC KPI card.** The main dashboard's KPI deck is four cards:
  Global Edge Network, Data Layer & Cache, Edge Worker Scripts, Transactional
  SMTP.
- **The tab id is `seo`, labelled "Search Console"** — not `gsc`, and not
  "Google Search Console & Indexing". Its siblings are Overview, Edge Workers,
  Database Pool and Quotas & Storage. There is no System Health tab and no Audit
  Log tab.
- **`GscValidationWidget` carries a "12h Auto-Cron Active" badge that is a
  hard-coded string.** It is not derived from `gsc-run-interval-hours`, and the
  job it names has been off since 2026-08-26.
- **The `seo` chip in `ServiceStatusStrip` is entirely literal text** — "100%
  Pass", "12h Active", "3 Failed Errors Healed" — while the live readiness score
  is 76%. It passes no `isUnconfigured` flag.

All four of those are code defects, not documentation gaps. They are listed in
[`DASHBOARD.md`](DASHBOARD.md) §0 and logged in
[`../MAINTENANCE.md`](../MAINTENANCE.md).

## 6. Vite / dev-server stability

*Section deleted 2026-09-19.* It claimed `astro.config.ts` pre-bundles
`@upstash/ratelimit`, `@upstash/redis`, `@supabase/supabase-js`, `zod`, `preact`
and `lucide-preact` through `optimizeDeps.include`, and excludes Astro dev-runtime
files through `ssr.external` and `ssr.optimizeDeps.exclude`. The real config does
the **opposite**: the top-level `optimizeDeps` excludes only `@astrojs/cloudflare`,
with an explicit comment that Vite's own "try optimizeDeps.exclude" advice is
wrong for this failure; the SSR block uses `noDiscovery: true` with an explicit
include list; and there is no `ssr.external` at all. Acting on the old text would
reintroduce the `module is not defined` crash. The subject has a runbook of its
own: [`../runbooks/dev-server-optimize-deps-missing.md`](../runbooks/dev-server-optimize-deps-missing.md).

## 7. API surface

Both readiness routes PLAC-gate on `/dashboard/seo`. Their RBAC floors differ from
the rest of `src/pages/api/seo/`:

| Endpoint | Method | RBAC floor | Notes |
|---|---|---|---|
| `/api/seo/validation-readiness` | `GET` | **Viewer** | Cached summary; `?fresh=true` forces a full crawl with no rate limit |
| `/api/seo/validation-readiness` | `POST` | Admin | Forces a crawl, 15/hour |
| `/api/seo/discovery-health` | `GET` | **Viewer** | Live sitemap counts, robots.txt status, `/llms.txt` payload, meta directives |
| `/api/seo/discovery-health` | `POST` | Admin | — |

*Corrected 2026-09-19: the old table gave an "Admin" floor for every row, and
listed four sync/log routes that belong to
[`SEARCH-CONSOLE-SYNC.md`](SEARCH-CONSOLE-SYNC.md) §11, which now owns the full
route map.*

## 8. Verification

- Unit/integration tests: `test/seo-validation-readiness.test.ts`,
  `test/seo-discovery-health.test.ts`, `test/seo-delete-targeted.test.ts`,
  `test/indexnow.test.ts`. *Corrected 2026-09-19: per-file case counts and a
  "499/499 tests across 31 files" total were removed — they were a point-in-time
  snapshot that went stale immediately and understated the suite by a wide margin.*
- Type safety: `npm run typecheck`.

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-19 | claude | Re-derived the whole document against the code and live D1 | Cron heartbeat, KPI card, `gsc` tab and §6 Vite guidance all found false and removed; two of five categories confirmed hard-coded; live cached readiness 76% (60/87 URLs thin), last written 2026-08-26 17:22 UTC |
| 2026-08-24 | claude | code + infra + tests | Original pass. Its architecture, dashboard-integration and Vite claims did not hold and are corrected above. |

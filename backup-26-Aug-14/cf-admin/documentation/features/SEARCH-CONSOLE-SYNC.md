---

title: "Search Console Sync"
status: active
audience: [non-technical, ai, technical, operator, owner]
last_verified: 2026-08-13
verified_against: [code, infra]
owner: harshil
related_code:
- src/lib/gsc/
- src/lib/pagespeed/
- src/pages/api/seo/
- src/pages/dashboard/seo/
- src/components/admin/seo/
- src/workers/scheduled-gsc-sync.ts
- src/workers/scheduled-pagespeed-sync.ts
related_docs:
- ../architecture/plac-and-audit.md
- USER-MANAGEMENT.md
- ../operations/OPERATIONS.md
- ../security/SECURITY.md
- ../2026-08-06-data-infrastructure-audit-and-reuse-policy.md
- ../reference/schema-change-ledger.md
tags: [feature, seo, search-console, pagespeed, core-web-vitals, cron, plac, rbac, google-api]

---

# Search Console Sync

> **TL;DR (non-technical):** An automated system, built into the admin portal, that keeps Google aware of the website's content and watches its Google-measured page speed — without a human having to remember to check either. Twice a day it tells Google "here's our sitemap, please re-check it" and asks Google directly whether specific pages are actually indexed. Once a week it measures real page-speed scores the way Google itself measures them. Every single call to Google is logged — what was asked, why, and exactly what Google said back — visible on one dashboard page, exportable to a spreadsheet. If something breaks (a missing credential, a quota limit), an email goes out automatically instead of the problem sitting silent. Nothing here uses any technique Google doesn't explicitly document and allow — see [§3](#3-what-this-deliberately-does-not-do-and-why) for why that restraint matters. Runs entirely on Cloudflare's free tier plus two free Google API quotas.

> **Status:** Production Active (shipped 2026-08-12; dashboard/PageSpeed/permissions hardening pass 2026-08-13)
> **Surface:** `/dashboard/seo` — Search Console Sync dashboard (KPIs, activity log, manual triggers, settings, CSV export)
> **Role floor:** Admin or higher (RBAC) with PLAC access to `/dashboard/seo` — see [§5](#5-roles--permissions).

---

## 1. What This Is, In Plain Language

Google finds and ranks pages by crawling the web on its own schedule, which can mean new or changed content sits invisible in search results for days. Two things speed that up, and this system automates both, using only the exact mechanisms Google's own documentation describes for doing so:

1. **Telling Google what changed.** Every time a blog post publishes, and twice a day regardless, the system re-submits the site's sitemap and checks whether specific pages are actually indexed — using Google's real Search Console API, the same data you'd see logging into search.google.com yourself.
2. **Measuring page speed the way Google measures it.** Once a week, the system runs the exact same Core Web Vitals check Google uses as a ranking signal (Largest Contentful Paint, Cumulative Layout Shift, Interaction to Next Paint), via Google's own PageSpeed Insights service — the same tool at pagespeed.web.dev.

Before this existed, both of these were manual: someone had to remember to open Search Console, click "Inspect URL," and separately run a PageSpeed test by hand — with no record of when it was last done or what the result was. Now it happens on a schedule, and every result is permanently logged.

## 2. How It Works, Step By Step

1. Every 15 minutes, the admin portal's existing scheduled job checks two internal clocks: "has it been 12 hours since the last Search Console sweep?" and "has it been a week since the last PageSpeed check?" (both configurable — see [§6](#6-settings--cadence)). Most ticks do nothing.
2. When the Search Console clock is due: the system submits both language sitemaps to Google, asks Google for its own read on each sitemap's health (how many URLs it actually downloaded, any warnings), then checks the indexing status of the homepage, every service page, and the ten most recently updated blog posts.
3. When the PageSpeed clock is due: the system runs a real Google PageSpeed Insights check (mobile) against every static page, and records the performance score plus Core Web Vitals.
4. **Every single one of those calls — successful or not — is written to a log** with the exact URL, why it was made (scheduled sweep, a blog post just published, or someone clicked a button), what Google returned, and how long it took.
5. A blog post publishing triggers an immediate, targeted version of step 2 for just that post, instead of waiting for the next scheduled sweep.
6. An admin can also open `/dashboard/seo` and trigger any of this on demand: a full sweep, a single-URL check on any page they paste in, or a PageSpeed run — all logged exactly the same way.
7. If a scheduled run finds it's missing its Google credential, or Google tells it a quota's been used up, an email goes out (capped at one per problem per 24 hours, so a persistent issue doesn't flood an inbox) — see [§8](#8-failure-handling--alerts).

## 3. What This Deliberately Does *Not* Do, and Why

This is the most important design decision in the whole system, so it's worth stating plainly: **there is no way to make Google index a page on demand, and this system doesn't pretend otherwise.**

Google publishes exactly two relevant APIs:

- **The Indexing API** — genuinely can request immediate (re)crawling, but Google restricts it, in writing, to pages carrying `JobPosting` or `BroadcastEvent` structured data. Using it for a blog post or a service page is a documented terms-of-service violation, and Google has tightened enforcement of this restriction. Multiple third-party "instant Google indexing" tools on the market use this API against pages that don't qualify, or automate the manual "Request Indexing" button in a way Google doesn't provide an API for at all — both carry real risk of losing API access entirely, which would break indexing monitoring for every page, not just the one being pushed.
- **The URL Inspection API** — the one this system actually uses — is explicitly **read-only**. It reports whether a page is indexed and why; it cannot request indexing. There is no publicly documented way to do that programmatically, at any price, from any vendor. Anyone selling one is either abusing the Indexing API's restricted scope or scripting the manual UI button — Google's own guidance is that the button itself only affects *crawl priority*, not rankings, and is capped at roughly 10-12 uses/day/property by the UI, not an API.

So the honest claim for this system is: it keeps Google's crawler pointed at fresh, accurate signals as fast as Google's own sanctioned channels allow, and it gives full visibility into whether that's actually working — not that it can force a page into the index. See the [Business Value & Market Comparison](#9-business-value--market-comparison) section for what this is actually worth given that constraint.

## 4. The Two Services

| | Search Console Sync | PageSpeed Insights Sync |
|---|---|---|
| **Google API used** | Search Console API — `sitemaps.submit`, `sitemaps.get`, `urlInspection.index:inspect` | PageSpeed Insights API v5 |
| **Auth** | Google Cloud service account (JWT, signed with Web Crypto — no Node SDK available in Workers), granted access to the property in Search Console | Plain API key (optional) or unauthenticated |
| **Default cadence** | Every 12 hours | Every 7 days (Core Web Vitals move slowly; checking more often adds no signal) |
| **What it checks** | Both sitemaps + homepage + services (en/es) + 10 most recent blog posts | The same static page set, mobile strategy |
| **Quota** | 2,000 queries/day, 600/min — this system uses roughly 20-30/day, comfortably under 1% | 25,000/day with a key; unauthenticated calls share a global pool with every other uncredentialed caller worldwide and can run dry from traffic that has nothing to do with this site (this happened in production on 2026-08-12 — see [§10](#10-known-limitations--incidents-as-of-2026-08-13)) |
| **On quota exhaustion** | N/A — nowhere near the limit | Stops the rest of that run immediately instead of repeating a guaranteed failure across every remaining URL, logs one clear row, retries next scheduled window |

Both services share the same underlying log table, watermark/cadence pattern, and dashboard — see [§11](#11-where-things-live-for-engineers--ai-agents).

## 5. Roles & Permissions

Every action here — viewing the dashboard, triggering a manual run, changing the cadence, exporting logs, deleting a log row — requires **Admin role or above** (RBAC) *and* explicit PLAC access to `/dashboard/seo` (this is its own registered page in the permission system, not folded into the general Settings page — see the note in [§11](#11-where-things-live-for-engineers--ai-agents) about why that mattered). Two dev-only capabilities (seeding — since removed, see [§10](#10-known-limitations--incidents-as-of-2026-08-13) — and bulk-clearing every log row) never activate in production regardless of role, since one writes fabricated data and the other can erase a real audit trail with one click.

## 6. Settings & Cadence

An Admin+ can, from the dashboard's Config panel, without any code change or redeploy:

- Turn either sync on or off independently (a "disabled" sweep makes **zero** calls to Google, on every trigger path including the manual button — not just a pause on the automatic schedule)
- Set the Search Console cadence: 6h / 12h / 24h presets, or any custom value 1-168h
- Set the PageSpeed cadence: Daily / Weekly / Monthly presets, or any custom value 1-720h

These live in the same dynamic, database-backed settings table used for every other portal-wide toggle — no environment variable governs behavior that could instead be a setting an Admin can change themselves.

## 7. The Dashboard (`/dashboard/seo`)

- **KPI ribbon**, split by service (Search Console / PageSpeed / combined) rather than blended into one misleading average, with a selectable time window (Today / 7 days / 30 days / All time) and a live "next run" countdown for both sweeps.
- **Instant single-URL inspection** — paste any URL on the site, get its real, current Google indexing status back in seconds. The URL is validated and normalized (host must match the site, trailing slash added, query/fragment stripped) before the call is made, so a typo doesn't waste an API call on a confusing generic error.
- **Activity log** — every call ever made, filterable by service/action/reason/status/date range, with a full detail drawer per row (raw JSON response, mobile-usability and rich-results verdicts, timing, syntax-highlighted).
- **CSV export** of whatever's currently filtered, permission-gated and rate-limited the same way the rest of the portal's exports work.

## 8. Failure Handling & Alerts

Every call is wrapped so a single failure never aborts a batch or crashes the cron. Three states get a one-time (then 24h-cooled-down) email, sent via the same transactional email service used for every other portal alert:

- The Google service-account credential is missing or was removed.
- The PageSpeed Insights daily quota was exhausted.
- (Both are genuine "something needs attention" states — a deliberately disabled sync does not alert, since that's an intentional choice, not a failure.)

## 9. Business Value & Market Comparison

### Is this actually useful?

Honestly, and with a caveat first: this is a **monitoring and hygiene tool, not a traffic-growth lever by itself.** Live Search Console data pulled while designing this system showed the site's homepage already indexed and healthy, and 28 days of real performance data showed ordinary day-to-day noise with no step-change tied to specific manual-inspection days — consistent with Google's own position that indexing checks affect crawl priority and diagnostic visibility, not rankings. Anyone promising that faster indexing alone will meaningfully grow traffic is overselling it, including some of the paid tools below.

What it's genuinely worth, for a small local business running its own site with no dedicated SEO staff:

- **Catches real problems automatically that currently require someone to remember to check manually** — a page accidentally marked `noindex`, a canonical pointing the wrong direction, a sitemap Google stopped downloading, a page failing Core Web Vitals — all things that silently cost search visibility and are otherwise only caught by someone opening Search Console and looking, which competing research for this project confirmed wasn't happening on a schedule before this existed.
- **Removes the "did we actually do this" uncertainty.** Every check, every result, permanently logged — not "I think I checked that last month."
- **New content gets Google's attention within hours of publishing**, not whenever Google's own crawler gets around to it (which for a site this size and posting cadence could otherwise be days).
- **Zero ongoing cost** beyond what already exists — no subscription, no per-check fee, no credit-based pricing to monitor.

### What the equivalent would cost bought off-the-shelf

Researched against current (2026) vendor pricing where published; several vendors in this category don't publish self-serve pricing at all, which is itself informative — this tooling is generally sold to agencies and enterprises, not sized for a single local business.

| Tool | Price | What you'd actually get | Confidence |
|---|---|---|---|
| **Ahrefs** (Lite) | $108–129/mo | Site Audit + rank tracking bundled — closest single-tool match, but built for competitive SEO research generally, not scheduled Google-API indexing checks specifically | Official pricing page |
| **SEMrush** | $117–165/mo (entry tiers) | Site Audit + Position Tracking, similar scope to Ahrefs | Official pricing page |
| **ContentKing / Conductor Website Monitoring** | No self-serve price — sales-negotiated; third-party estimates range from a few hundred to $26,800+/yr depending on scope | Continuous crawling + real-time alerts — the closest *conceptual* match to "always watching," but enterprise-priced | Vendor requires sales contact; figures are third-party estimates, not confirmed |
| **Screaming Frog** | ~$279/yr per license | A desktop crawler a human runs manually — **no scheduling, no logging, no automation at all**. Doesn't actually replace this system; it replaces the pre-automation manual process this system removed. | Official pricing page |
| **Botify / OnCrawl** | No published pricing; industry estimates $75K–$400K+/yr for Botify | Enterprise technical-SEO platforms, priced and built for sites vastly larger than this one | Sales-negotiated; figures are third-party estimates |
| **Treo.sh** (Core Web Vitals monitoring) | $75/mo (Vital tier: 1,000 pages, 40 scheduled Lighthouse runs) | The closest direct match to just the PageSpeed/CWV half of this system | Official pricing page |
| **DebugBear** | ~$79-125/mo (third-party sourced) | Similar CWV-monitoring scope to Treo.sh | Vendor pricing page didn't render publicly; figures via aggregators only |
| **"Auto-indexer" tools** (Indexly, IndexMachine, etc.) | $12.50 one-time to $49-149/mo | Marketed as "instant Google indexing" — **see the compliance flag below before considering any of these** | Low-confidence source (competitor marketing content) |
| **IndexNow** (the protocol itself) | Free | Real, legitimate, and *already integrated* in this project's `cf-astro` site — but Google doesn't consume it. Solves a different problem (Bing/Yandex/Naver) than this system does. | Official protocol docs |

**A realistic bundle** — one Site-Audit-class tool for indexing/technical monitoring plus one CWV-specific tool, the minimum combination that would actually cover what this system does — lands around **$150–200/month ($1,800–2,400/year)**, and that's before accounting for the fact none of those tools include the custom dashboard, permission system, or CSV/audit-log capability built here, or integrate with this specific portal's login and role system at all.

**Compliance is the sharpest differentiator, not just price.** Several cheaper "instant indexing" competitors ($12–150/mo) are marketed on a promise this system deliberately doesn't make, because Google doesn't allow it: they either call the Indexing API against pages it's not licensed for (JobPosting/BroadcastEvent only — confirmed directly against Google's own developer documentation) or script the manual "Request Indexing" button in a way Google provides no API for. Google's own developer relations team has publicly described this exact misuse as spam, and the documented consequence is losing API access entirely — which would break indexing monitoring for the *whole* site, not just whatever page someone tried to force. This system's read-only, sanctioned-API-only design (§3) is the reason that risk doesn't exist here.

### Custom-build cost, if this had been outsourced

Researched against current freelance/agency rate data rather than estimated: API-integration specialists on Upwork run **$25–150+/hr** (mid-level ~$73/hr average, senior/specialized ~$128/hr average), and agency day rates on Clutch.co's 2026 guide mostly fall in the **$24–49/hr** range, up to $150+/hr for specialized work. A scheduled-job integration of this scope — two external API clients, a shared log/dashboard system, CSV export, email alerting, and full RBAC/PLAC integration with an existing permission system — is realistically a **2-4 week build** for one developer, putting an outsourced equivalent in the rough range of **$3,000-$12,000 one-time**, plus whatever ongoing subscription the chosen monitoring tools cost from the table above. This system cost the Cloudflare/Google free-tier quota it runs inside and nothing else.

## 10. Known Limitations & Incidents (as of 2026-08-13)

- **PageSpeed quota exhaustion happened once in production (2026-08-12), fixed same day.** Root cause: no API key configured, so calls shared Google's global unauthenticated PageSpeed quota pool, which ran dry from unrelated worldwide traffic — not this site's own volume (12 calls total). Fixed two ways: the batch now stops after the first quota-exceeded response instead of repeating it across every remaining URL, and a `PAGESPEED_API_KEY` secret gives this site its own dedicated 25,000/day quota.
- **Two migrations from an earlier, unrelated feature were found never applied to production** while investigating an unrelated local-dev error on 2026-08-13 (`0043`/`0044` — blog quality-gate and AI-prompt PLAC entries). Applied and verified; unrelated to Search Console Sync itself but discovered and fixed in the same session.
- **A demo-data seeding tool existed briefly** (dev-only, gated behind `import.meta.env.DEV`) for populating the dashboard with sample rows during UI development. Removed entirely on 2026-08-13 in favor of `npm run db:pull-seo-log`, which pulls a real snapshot of this table's actual production history into local dev — consistent with this project's real-data-only stance even for dev tooling.
- **No Google Business Profile integration.** For a local, physical-location business, GBP/Maps presence is likely a larger traffic lever than indexing speed — deliberately scoped out of this system (separate API, separate multi-week Google approval process) and tracked as a candidate future initiative, not because it isn't valuable.
- **The "traffic increase after manual inspection" question this system was originally built to investigate**: live Search Console data pulled during design (28-day window) showed ordinary day-to-day variance with no clear step-change tied to specific inspection dates, consistent with Google's own documentation that manual/automated indexing checks affect crawl priority and diagnostic visibility, not rankings or traffic directly. This system's real value is faster discovery and now-continuous monitoring, not a traffic-growth lever by itself — see [§9](#9-business-value--market-comparison) for what that's actually worth.

## 11. Where Things Live (for engineers / AI agents)

- **Google API clients:** `src/lib/gsc/client.ts` (Search Console: sitemap submit/get, URL inspection), `src/lib/gsc/auth.ts` (JWT signing + token cache), `src/lib/pagespeed/client.ts` (PageSpeed Insights)
- **Orchestration:** `src/lib/gsc/sync.ts` (watermark/cadence gate, batch building, single-URL validation, all four Search Console trigger paths), `src/lib/pagespeed/sync.ts` (same pattern for PageSpeed, reuses `gsc/sync.ts`'s settings helpers and log writer)
- **Shared query logic:** `src/lib/gsc/log-query.ts` — filter-building, service-split stats, next-run ETA computation, used identically by the table view, the CSV export, and the dashboard's initial server render so none of the three can silently disagree
- **Alerting:** `src/lib/gsc/ops-alert.ts` — no generic "send an admin alert" helper existed anywhere in this codebase (checked before writing this); mirrors the shape of the login-security alert email rather than inventing a new pattern
- **Cron:** `src/workers/scheduled-gsc-sync.ts`, `src/workers/scheduled-pagespeed-sync.ts`, both piggybacking the existing `*/15 * * * *` tick in `src/workers/cf-entry.ts` — the Workers Free plan's 3-cron-trigger cap was already fully used, so this adds zero new triggers
- **API routes:** `src/pages/api/seo/` — `gsc-sync-trigger.ts` (full sweep + single-URL), `pagespeed-trigger.ts`, `gsc-index-log.ts` (GET table + stats, DELETE single/all), `gsc-index-log-export.ts` (CSV), `settings.ts` (the dedicated settings-write endpoint — see the permissions note below)
- **Dashboard:** `src/pages/dashboard/seo/index.astro` + `src/components/admin/seo/` (`SeoDashboard.tsx`, `SeoKpiCards.tsx`, `GscSettingsControl.tsx`, `PageSpeedSettingsControl.tsx`, `GscLogDetailDrawer.tsx`)
- **Data:** single table `gsc_index_log` (migration `0047`, widened by `0050` to add `mobile_usability_verdict`/`rich_results_verdict`/a `service` discriminator column) — deliberately reused for both Google services rather than standing up a second table; see the RULE #0.9 reasoning written directly into migration `0050`'s own comments. Settings live in the existing `admin_portal_settings` table, `category = 'seo'`.
- **Permissions note:** `src/pages/api/seo/settings.ts` exists as a *dedicated* endpoint, not a reuse of the portal's generic `POST /api/settings/portal` — that endpoint's PLAC check is hardcoded to `/dashboard/settings`, a different page than the one these controls actually live on, found and fixed 2026-08-13 during a permissions review. Every route under `src/pages/api/seo/` now consistently gates on `requireAuth(context, 'admin')` + PLAC access to `/dashboard/seo` specifically.
- **Secrets:** `GSC_SERVICE_ACCOUNT_JSON` (required, RULE #0.8 documented exception — see `2026-08-06-data-infrastructure-audit-and-reuse-policy.md`), `PAGESPEED_API_KEY` (optional, same exception category — deliberately a Worker secret and *not* a D1 setting, since D1 settings flow to the browser via the dashboard's initial page data and an API credential shouldn't).

## 12. Related

- [`architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) — how the permission system this feature relies on works portal-wide
- [`2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](../2026-08-06-data-infrastructure-audit-and-reuse-policy.md) — the RULE #0.6/#0.8/#0.9 reuse policy this feature was built to follow (one shared table for two services, no new cron trigger, minimal new secrets)
- [`reference/schema-change-ledger.md`](../reference/schema-change-ledger.md) — applied-migration record for `0047`/`0049`/`0050`
- [`STAFF-MANAGED-STORAGE.md`](STAFF-MANAGED-STORAGE.md) — the other feature this documentation pass covers; built on the same RBAC+PLAC foundation

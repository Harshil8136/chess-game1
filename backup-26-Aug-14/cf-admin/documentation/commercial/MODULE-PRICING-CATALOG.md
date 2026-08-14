---

title: "Module Pricing Catalog"
status: active
audience: [owner, non-technical, technical, operator]
last_verified: 2026-08-13
verified_against: [code, web, docs]
owner: harshil
related_code:
- cf-admin/src/lib/gsc/
- cf-admin/src/lib/pagespeed/
- cf-admin/src/components/admin/storage/
- cf-chatbot/src/
related_docs:
- ../2026-07-26-commercial-model-costing-pricing-and-scale.md
- ../2026-07-27-go-to-market-prospecting-and-roadmap.md
- ../2026-07-17-compliance-standing-and-market-positioning.md
- ../specs/2026-07-29-content-and-ai-visibility-engine.md
- ../features/SEARCH-CONSOLE-SYNC.md
- ../features/STAFF-MANAGED-STORAGE.md
- PLATFORM-BUY-VS-BUILD-COMPARISON.md
- BILLING-MODEL-AND-VIABILITY.md
tags: [commercial, pricing, catalog, modules, velox, addons]

---

# Module Pricing Catalog

> **TL;DR (non-technical):** What each individual capability across this platform is
> actually worth, priced against what it would cost to buy the closest real commercial
> equivalent — not a guess, every number below traces to a specific vendor's published
> price or an existing, already-researched internal document. This extends Velox's live
> 42-module add-on catalog with the two capabilities built in this session (Search
> Console Sync, an expanded Staff Managed Storage) and reconciles the AI blog module's
> already-recommended price with what actually shipped.

## Context — this doc extends, it does not replace

Three internal documents already did rigorous, sourced pricing work before this one
existed. Read them first if you haven't:

- [`2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md) — the framework-level cost floor (**~$36/client/month fully loaded**) and the Motion B (agency) pricing ($250-900/deployment/month).
- [`2026-07-27-go-to-market-prospecting-and-roadmap.md`](../2026-07-27-go-to-market-prospecting-and-roadmap.md) — resolves the apparent contradiction between that and Velox's live $59-499/mo: **two motions, one codebase.** Read this before quoting any price in this catalog to anyone.
- [`2026-07-29-content-and-ai-visibility-engine.md`](../specs/2026-07-29-content-and-ai-visibility-engine.md) — the AI blog module's own pricing analysis, in depth. Not re-derived here, only reconciled (§2).

This catalog's job is narrower: **price individual modules**, using the same
sourced-not-guessed standard those documents already established.

---

## 1. Module-by-module pricing

Every "market equivalent" price below is either (a) a vendor's own published pricing
page, fetched or searched this session, or (b) an already-existing, cited internal
research document. Where a number is aggregator-sourced rather than confirmed directly
from the vendor's own page, that's flagged in the Confidence column — treat those as
directional, not contractual.

| Module | What it actually is | Dev cost (if built from scratch) | Running cost | Closest market equivalent, monthly | Recommended Velox add-on price | Confidence |
|---|---|---|---|---|---|---|
| **Search Console Sync** *(new this session)* | Automated Google sitemap/indexing checks + weekly Core Web Vitals, full call-level audit log, ops alerts | $3,000-12,000 (2-4 weeks, API-integration rates) | ~$0 (Cloudflare/Google free tiers) | $150-200 (a Site-Audit tool + a CWV tool, minimum bundle) — see [`SEARCH-CONSOLE-SYNC.md` §9](../features/SEARCH-CONSOLE-SYNC.md#9-business-value--market-comparison) for the full sourced table | **$19.99-29.99/mo** as a standalone add-on, or bundle free into the Content & AI Visibility module (§2) since both are SEO-adjacent and the running cost of either is ~$0 | High — official vendor pages for Ahrefs/SEMrush/Treo.sh; third-party estimates flagged separately in the source doc |
| **Staff Managed Storage** *(expanded this session)* | Private per-role file drive, external share links, inbound file-request links, weekly reconciliation | $12,000-25,000 (4-8 weeks) | ~$0 (R2 free tier) | $225-330 for a 15-staff equivalent with the full feature checklist met (Box Business at $225 is the cheapest *complete* match; Google Workspace looks cheaper at ~$210 but is excluded here because it has no native file-request capability at all, per the source doc) — see [`STAFF-MANAGED-STORAGE.md` §9a](../features/STAFF-MANAGED-STORAGE.md#9a-business-value--market-comparison) | Already effectively bundled into the base portal (every tier gets it); **if sold standalone to a buyer who only wants file management, $29.99-39.99/mo** is defensible against the table in §9a | High — official Dropbox/Box/M365 pricing pages, cross-checked against 2+ sources each |
| **Content & AI Visibility Engine** (blog + AI SEO/AIO) | Rich-text blog authoring, AI-generated SEO/schema/answer-shaped content, AI-crawler visibility measurement | 110-150 hours (already estimated) | ≈$0.02 per 10 posts (measured, `ai-pricing.ts`) | $0 direct equivalent — closest comparables (Jasper, SurferSEO, Frase) run $49-129/mo each for *one* of generation *or* optimization, not both plus AI-visibility measurement, which no competitor in this market ships at all | **Confirmed at $79-129/mo**, per the existing spec — the two old line items ($14.99 + $24.99 = $39.98) were underpriced ~4× and should already be retired in favor of this single flagship module | High — internal spec, already researched in depth |
| **AI Chatbot** (WhatsApp + Web, bilingual) | Dual-channel AI support/booking assistant, RAG-grounded, human escalation | Already built (cf-chatbot) | **$2-5/mo** at ~100 chats/day (measured, `08-cost-analysis.md`) | Tidio $29-59, Intercom $39-74, Zendesk Chat $55-115, ManyChat $15-45, Dialogflow CX $20-50 — **this system runs 6-20× cheaper than any of them while doing more** (bilingual, WhatsApp-native) | Velox's `/ai` page lists this as part of the AI catalogue but doesn't publish a standalone per-module price for it in what's publicly visible — **recommend pricing it explicitly at $39.99-59.99/mo standalone** (undercutting Intercom/Zendesk while the margin is still ~92-97%) rather than leaving it implicit inside a bundle | High for cost; medium for the "what Velox charges today" figure — not visible on the fetched `/pricing` page's sampled module list |
| **RBAC + Zero Trust + audit trail** (the permission system underneath everything) | Per-page/per-feature PLAC at 10k+ entries, CF Access identity, insert-only audit log | Substantial — this is the core framework, not a bolt-on | ~$0 marginal | Retool Team $10/builder/mo, Retool Business $50/builder/mo, Appsmith Business $40/user/mo — all **per-seat**, unlike this platform | Not sold as a separate module — it's the reason "unlimited admin users, no per-seat fee" is a headline claim (per the GTM doc's §9 approved claims list). **Its commercial value is structural, not a line item**: a 10-seat Retool Business client pays $500/mo for *just* this piece | High — official Retool/Appsmith pricing, already cited in the commercial-model doc |
| **Observability** (Sentry + PostHog combined) | Error tracking, session replay, product analytics | Already built (both wired) | Free tier today | Sentry Team $26-29/mo, Business $80-89/mo; PostHog free-then-usage, Boost add-on $250/mo, Scale add-on $750/mo | Not currently sold as its own module — it's operational infrastructure for *running* the product, not a client-facing feature. **If ever offered as a client-facing "we monitor your site's errors and usage for you" module, $19.99-29.99/mo is defensible** against the Sentry Team-tier baseline it would absorb | Medium — aggregator-sourced (Sentry/PostHog official pricing pages didn't render cleanly on fetch); figures are consistent across 2+ independent sources each |
| **Core infrastructure** (D1, KV, R2, Workers, Workers AI) | The edge runtime everything else sits on | N/A — infrastructure, not a feature | ~$0-30/mo per client (commercial doc §5, §8) | Not directly comparable — this is infrastructure, not a SaaS product | Not a module — this is what makes every *other* module's near-zero running cost possible. Its value shows up as the near-100% margin on everything above, not as its own line item | High — verified vendor rates in the commercial-model doc, already cited |

## 2. What changed since the AI blog module was speced

The [2026-07-29 spec](../specs/2026-07-29-content-and-ai-visibility-engine.md) recommended
$79-129/mo and flagged the feature as "written, not built." A later document,
`2026-08-03-blog-ai-seo-production-readiness.md`, describes the system as live in
production. **The pricing recommendation doesn't change with build status** — development
cost is sunk either way, running cost is still effectively $0, and the value proposition
(a recurring, evidenced AI-visibility report, not a one-off generation feature) is
identical. Confirm the two old $14.99/$24.99 line items have actually been retired from
`velox-platform-showcase/src/data/pricing.ts` in favor of the single $79-129 module — that
retirement was recommended, not verified as executed, in the source spec.

## 3. What this catalog deliberately doesn't price

Velox's own `/ai` page publicly lists an **AI Voice Receptionist** and **AI Document &
Data Extraction** as capabilities. Neither appeared anywhere in the code explored this
session — cf-chatbot's own architecture document (`Docsbot/01-architecture.md`) covers
only WhatsApp and web-chat channels, no telephony, and no document-extraction pipeline
was found. That doesn't mean they don't exist — this session's exploration didn't cover
every corner of every repo — but per the GTM document's own stated discipline ("measure
before you claim," the Lighthouse-score lesson), **this catalog only prices what was
directly verified in code this session.** Before quoting a price for either of those two
capabilities to a buyer, confirm they're actually built and where, the same way every
other row in §1 was confirmed.

## 4. See also

- [`PLATFORM-BUY-VS-BUILD-COMPARISON.md`](PLATFORM-BUY-VS-BUILD-COMPARISON.md) — the whole-stack version of this table: what buying every category above, piecemeal, from separate vendors would cost combined, versus running this platform
- [`BILLING-MODEL-AND-VIABILITY.md`](BILLING-MODEL-AND-VIABILITY.md) — how to actually bill for these modules, and an honest answer on personal viability at near-zero marginal cost

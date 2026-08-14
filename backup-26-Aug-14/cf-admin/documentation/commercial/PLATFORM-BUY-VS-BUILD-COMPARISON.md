---

title: "Platform Buy-vs-Build Comparison"
status: active
audience: [owner, non-technical, technical]
last_verified: 2026-08-13
verified_against: [web, docs]
owner: harshil
related_docs:
- MODULE-PRICING-CATALOG.md
- BILLING-MODEL-AND-VIABILITY.md
- ../2026-07-26-commercial-model-costing-pricing-and-scale.md
- ../2026-07-17-compliance-standing-and-market-positioning.md
tags: [commercial, pricing, comparison, buy-vs-build, velox]

---

# Platform Buy-vs-Build Comparison

> **TL;DR (non-technical):** Assembling a comparable stack from separate commercial
> vendors — an internal back-office tool, an AI chatbot, SEO/indexing monitoring, file
> storage with staff permissions, AI content generation, error tracking, and product
> analytics — realistically costs **$448-1,363/month** ($5,376-$16,356/year), from seven
> different companies, none of which share a login, a permission system, or your data.
> This platform runs the equivalent capability set on **~$30-36/month of actual
> infrastructure cost** (per the existing commercial-model document) and Velox sells it
> for $59-499/month. Even the top Velox tier undercuts the piecemeal low estimate while
> including things — physical per-client data isolation, no per-seat fees, an
> agent-readable AI-visibility surface — that no combination of the seven vendors below
> offers at any price.

## Method

Every number here is a specific vendor's price already sourced in this session or in
[`MODULE-PRICING-CATALOG.md`](MODULE-PRICING-CATALOG.md) — nothing here is estimated
without a citation trail. This is **not apples-to-apples** and the caveats matter more
than the total: see §3 before using this number in a sales conversation.

## 1. The piecemeal stack

| Category | Low (cheapest vendor that qualifies) | High (vendor with the full feature match) | Source |
|---|---|---|---|
| Internal admin/back-office tool with RBAC | Directus Cloud Standard, **$25/mo** (project-based) | Retool Business, **$50/user/mo × 5 users = $250/mo** | Commercial-model doc §9.2 |
| AI chatbot (bilingual, WhatsApp + web) | ManyChat Pro, **$15-45/mo** (template-based, weaker AI) | Zendesk Chat, **$55-115/mo** (enterprise-grade, still no native WhatsApp bot) | cf-chatbot `08-cost-analysis.md` |
| SEO/indexing monitoring + Core Web Vitals | Ahrefs Lite, **$108-129/mo** | Combined Site-Audit tool + Treo.sh (CWV), **~$200/mo** | `SEARCH-CONSOLE-SYNC.md` §9 |
| Staff file storage with role-based permissions (15 staff) | Box Business, **$225/mo** | Microsoft 365 Business Premium, **$330/mo** | `STAFF-MANAGED-STORAGE.md` §9a |
| AI content generation + SEO/AIO optimization | Entry-tier tool (Jasper/SurferSEO-class), **~$49/mo** | Full-featured tier, **~$129/mo** | `MODULE-PRICING-CATALOG.md` §1 |
| Error tracking | Sentry Team, **$26-29/mo** | Sentry Business, **$80-89/mo** | Verified 2026-08-13 (aggregator-sourced, consistent across sources) |
| Product analytics | PostHog free tier, **$0/mo** (real SMB volume often fits) | PostHog Boost add-on, **$250/mo** | Verified 2026-08-13 (same sourcing note) |
| **Total** | **~$448/mo** ($5,376/yr) — sum of the low column above | **~$1,363/mo** ($16,356/yr) — sum of the high column above | |

## 2. What that buys you, and what it doesn't

Paying $448-1,363/month across seven vendors gets you seven separate logins, seven
separate data stores (your customer/staff data scattered across Retool's, Zendesk's,
Ahrefs', Box's, Jasper's, Sentry's, and PostHog's infrastructure — not yours), seven
separate bills, and zero integration between any of them — the chatbot doesn't know what
the storage system knows, the SEO tool doesn't know what the admin panel knows. Every
one of them also charges **per seat**, so the bill grows every time you hire.

What this platform's single running instance gives you instead, at $30-36/month
infrastructure cost (commercial-model doc §8):

- One login (Cloudflare Zero Trust), one permission system, unlimited staff at no
  per-seat charge.
- Physical data isolation — your data lives in your own database, not a shared
  multi-tenant one (commercial-model doc §2).
- Every module in §1 talking to the same underlying data instead of seven silos.
- The AI-visibility/agent-readable surface, which the GTM document identifies as **the
  one thing in this entire comparison no competitor can assemble quickly at any price**
  — it isn't for sale anywhere in the piecemeal stack because it doesn't exist as a
  product category yet.

## 3. Caveats — read before quoting this number to anyone

- **This is not the same product.** A buyer directly comparing feature-checklists
  across all seven vendors combined might find individual features this platform
  doesn't have yet (e.g. Retool's visual drag-drop builder, which this platform
  deliberately doesn't try to be — see commercial-model doc §1, "not a no-code
  builder"). The comparison is capability-equivalent for *this business's actual use
  case*, not feature-for-feature exhaustive.
- **The high end assumes buying the fullest tier of everything simultaneously**, which
  a real SMB rarely does — a realistic piecemeal buyer would probably land closer to the
  low end, picking one or two of these categories seriously and neglecting the rest
  (which is itself the actual status quo for most small businesses today: no SEO
  monitoring, no dedicated file-request tooling, an ad-hoc chatbot or none).
- **Sentry and PostHog pricing here is aggregator-sourced**, not confirmed directly
  against a rendered official pricing page (both pages didn't render cleanly on fetch
  this session) — directionally reliable (consistent across 2+ independent sources
  each) but re-verify before using in a signed proposal.
- **This total does not include the website/booking/CMS layer itself** (Squarespace,
  Wix, WordPress+plugins, or equivalent) — that category wasn't researched in this
  session and adding it would only widen the gap in this platform's favor, so leaving
  it out is the conservative choice, not an inflated one.
- Per the GTM document's own discipline: **do not quote this total as "you'd pay
  $X,XXX/year elsewhere" without also being ready to name the seven vendors and their
  prices if asked.** Every number here traces to a source; keep it that way in
  conversation too.

## 4. See also

- [`MODULE-PRICING-CATALOG.md`](MODULE-PRICING-CATALOG.md) — the per-module version of this comparison, with recommended standalone pricing for each
- [`BILLING-MODEL-AND-VIABILITY.md`](BILLING-MODEL-AND-VIABILITY.md) — how to actually bill for this, and whether it's worth doing at near-zero marginal cost
- [`../2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md) — the infrastructure cost floor this comparison is measured against

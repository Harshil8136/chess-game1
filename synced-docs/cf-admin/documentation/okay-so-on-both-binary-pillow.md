# Velox GTM Roadmap + Pricing/Positioning Realignment

## Context

Three repos, one business:

- **`cf-admin-madagascar`** — the edge-native admin/control-plane framework. Today it is one
  client's deployment; the plan is one dedicated repo/deployment per client. Docs-only changes
  in this repo (per instruction).
- **`cf-astro`** — the client-facing marketing site (Lighthouse 98/100/100/100, heavy
  SEO/AIO/GEO work). Reproducible for any business.
- **`velox-platform-showcase`** — the sales/agency site that sells the above as a productised
  service. Full code, pricing and presentation changes allowed.

`cf-admin-madagascar/documentation/2026-07-26-commercial-model-costing-pricing-and-scale.md`
established the cost basis, fleet economics, scale ceilings and compliance standing. It stopped
at "here is the model" and explicitly flagged that **every price is modelled, never validated**,
and that **no GTM plan exists**. This work closes both gaps:

1. A concrete, sequenced prospecting + roadmap document (the missing GTM half of the commercial
   model).
2. Velox realigned so its pricing, claims and legal terms match (a) the real stack, (b) the real
   provider allowances, and (c) the owner's actual commercial rules — several of which the site
   currently contradicts outright.

### Why now, specifically

Three classes of defect were found in Velox that make it unsafe to point prospects at:

- **It contradicts the owner's own commercial rules.** `/pricing` FAQ, `terms.astro` §5 and
  `refund.astro` §2 all state a setup/onboarding fee exists. There is no setup fee.
- **It contradicts itself on the same page.** `/pricing` promises "usage billed at provider cost,
  no markup" while quoting media-storage overage at `$1.00/GB` against a real R2 cost of
  `$0.015/GB` (~66x), and DB storage at `$0.75/GB` against the `~$0.125/GB` figure written in the
  comment directly above it (`src/data/metrics.ts:95-116`). A buyer who checks will find this.
- **It leaves free capacity unsold and gates cheap things expensively.** Behavioural analytics,
  A/B testing, surveys and customer accounts are all gated to $299+ tiers or bespoke engagements,
  while the underlying providers give those away free at volumes far beyond any SMB client.

---

## Objective 1 — GTM: prospecting, pipeline and roadmap

**Deliverable:** `cf-admin-madagascar/documentation/2026-07-27-go-to-market-prospecting-and-roadmap.md`
(docs-only repo; sits beside the commercial-model doc as its companion).

Must satisfy `scripts/docs_check.py`: YAML front-matter with `title`/`status`/`audience`/
`last_verified`, all relative links resolving, **and an entry added to
`documentation/README.md`** (index-drift check is blocking).

### Content outline

**§1 Resolve the two-business tension.** The commercial-model doc concluded "sell to agencies at
$250-900/deployment". Velox sells to SMBs at $59-499. These are not in conflict once stated
explicitly, and stating it is the doc's most useful paragraph:

| Motion | Buyer | Product | Price band | Cost-to-serve |
|---|---|---|---|---|
| **A. Direct SMB** (Velox) | Service business owner | `cf-astro` site, optionally + `cf-admin` deployment | $59-$499/mo | Starter = site only, low ops. Business+ = a real deployment, ~$36/mo floor per the commercial doc §9.1 |
| **B. Agency / reseller** | Agency running many client sites | The framework + fleet tooling | $250-900/deployment | Multiplier per relationship |

The $59 Starter is defensible **only** because it carries no admin deployment. This must be
stated, or Starter looks like it violates the doc's own cost floor.

**§2 ICP and anti-ICP**, per motion, inheriting the anti-ICP list from commercial doc §10
(no PCI scope, no health records, no SOC-2-on-day-one, no self-serve).

**§3 Prospecting plays**, each with a trigger, an asset, a script and a success metric. Ordered by
leverage, not by convention:

1. **Demo-first outbound (the flagship play).** The owner already offers a free, working,
   business-specific demo before any contract. That is a far stronger opener than a deck, and
   nothing on the site currently leads with it. Play: build the prospect's actual homepage on the
   stack, send a side-by-side Lighthouse + AI-search-visibility comparison against their live site.
2. **Automated audit lead magnet.** A repeatable "Core Web Vitals + AI/answer-engine visibility +
   ADA/WCAG exposure" report. `cf-astro` already contains the machinery that makes the report
   credible (`lighthouserc.json`, a11y verification scripts). ADA Title III has no small-business
   exemption, which makes the accessibility finding a genuine urgency lever.
3. **Vertical land-grab.** Pick 2-3 verticals and go deep. `src/data/industries.ts` already exists
   in Velox and is under-used; it can drive programmatic per-industry landing pages.
4. **Reference-and-referral engine** off the existing client (`/case-study` is already built).
5. **Agency/reseller channel** (Motion B) — deliberately sequenced *after* fleet tooling exists.
6. **Inbound / dogfooding.** Velox ranking for its own category is the proof of the SEO claim.
7. **Local/partner channel** — accountants, POS resellers, chambers, industry associations.

**§4 The funnel, matching the owner's actual rules end to end:**
demo (free, no commitment) → proposal → contract (12-month minimum, first 3 months paid upfront,
no setup fee) → build → 3-month full-power window → settle to plan → expansion (add-ons + usage).

**§5 Capacity gate — the hard constraint.** Commercial doc §7.2: the fleet has an operational
ceiling of **~10-15 clients without tooling**. The roadmap must therefore sequence fleet tooling
*before* the prospecting volume that would breach it. A GTM plan that ignores this sells contracts
the delivery side cannot honour.

**§6 Phased roadmap** (30/60/90 then quarters) with explicit gates, tying each phase to the
validation experiments in commercial doc §12 (time one real update; track support hours; price-test
three prospects).

**§7 Metrics and instrumentation** — what to track, and where it already exists (PostHog is in the
stack; the free tier covers this several times over).

**§8 Risk register** — capacity breach, price invalidation, single-reference concentration,
compliance claims outrunning evidence.

---

## Objective 2a — De-identify the infrastructure stack (Velox)

**Goal:** no customer-facing surface names the providers the platform itself runs on.

**Honest framing to state in the plan doc and the code comments:** this reduces *targeting
convenience and disclosure surface*; it is not a vulnerability fix — the stack stays fingerprintable
from response headers and DNS. It also **costs real trust signal**, so every removed vendor name
must be replaced with a *verifiable capability claim*, not with vagueness.

### The split that makes this work

| Class | Examples | Action |
|---|---|---|
| **Infrastructure we run on** | Cloudflare, Supabase, Sentry, PostHog, Upstash, the email provider, Auth0/Clerk, Workers AI/Gemini/OpenAI/Claude | **Remove from all visible copy.** Replace with capability + property. |
| **Systems the client already owns / buys** | Stripe, WhatsApp, Google Business Profile, Google Calendar, QuickBooks/Xero, Zapier/Make, Shopify, HubSpot, POS vendors | **Keep.** These are the client's tools; naming them is required for the buyer to understand the integration. |

*(Pending confirmation — see Open Questions.)*

### Changes

- **`src/data/stack.ts`** — rewrite from "vendor trust signals" to **capability trust signals**.
  Entries become e.g. `global-edge` ("Global edge network & WAF", 330+ cities, DDoS, Zero Trust
  gating), `managed-postgres` ("Managed Postgres with row-level security"), `observability`,
  `product-analytics`, `edge-rate-limiting`, `identity` (OAuth2 + email OTP + SSO on request),
  `multi-model-ai` (routing + fallback, no model names). The `claims[]` arrays survive nearly
  intact — they were already capability statements; only the brand nouns come out.
- **Chips/marks** — `src/components/icons/BrandIcon.tsx`, `brands/monochrome-paths.ts`,
  `brands/Gemini.tsx`, `brands/WorkersAI.tsx`: infra marks removed; capability chips render Lucide
  icons via the existing `Icon.tsx`. Client-side integration marks (Stripe, WhatsApp, Google,
  QuickBooks, Shopify…) are retained for the "integrates with" surfaces.
- **`src/data/stack.test.ts`** — the "7-10 core chips resolve to a brand mark" assertion is
  replaced by "every core capability resolves to a registered Lucide icon" and "no core entry name
  matches the banned-vendor list".
- **Copy surfaces to sweep** (all confirmed to contain infra vendor names):
  `src/pages/security.astro` (meta description ×2, vendor grid special-cases),
  `src/pages/ai.astro` (model-name FAQ, edge-cost copy),
  `src/pages/llms.txt.ts`, `src/pages/pricing.astro` (Managed Platform FAQ names Cloudflare +
  Supabase), `src/components/SeatsSecurity.astro`, `src/components/PlatformServices.astro`,
  `src/data/metrics.ts` (comments + `performance.*` labels), `src/data/pricing.ts`
  (`auth` and `sso` add-ons name Auth0/Clerk/Okta/Entra).
- **Make it permanent, mechanically.** Add a `vendor-name` zero-tolerance rule to
  `src/lib/copy-lint.test.ts` (the file already runs in CI and already enforces em-dashes and
  buzzwords the same way). Infra vendor names become a build failure in `src/**` visible copy, with
  a documented allowlist for the client-side integration names. This is the only change that stops
  the names drifting back in.
- **Non-visible code keeps its real names** — `package.json`, `wrangler.toml`, `.env.example`,
  `src/pages/api/contact.ts` env vars, `astro.config.mjs`. Removing those would break the build and
  buys nothing.

---

## Objective 2b — Pricing correctness: contradictions and drift to fix

These are defects, not opinions. Each is verified in the current code.

| # | Defect | Where | Fix |
|---|---|---|---|
| 1 | **A setup/onboarding fee is advertised.** There is none. | `pricing.astro:161-163` FAQ; `terms.astro` §5 (and §3's cross-reference); `refund.astro` §2 | Delete the fee everywhere. Replace with an explicit "No setup fee, no onboarding fee" statement, and make the 3-months-upfront the thing that funds the build. |
| 2 | **"No markup" claim contradicted by the overage table on the same page.** Media `$1.00/GB` vs R2 `$0.015/GB`; DB `$0.75/GB` vs the `~$0.125/GB` written in the comment above it. | `metrics.ts:112-120`, rendered at `pricing.astro:467-481` | Either drop the rates to true pass-through, or change the claim to a stated, named handling margin. Cannot keep both as written. **Recommend: pass-through rates + generous included allowances** — it is the honest version *and* the better loss-leader. |
| 3 | **Extra-seat price contradicts itself three ways.** `$19/mo on every plan` (pricing.ts:1720) vs `Enterprise +$15/mo` (pricing.astro:28) vs `$19 monthly / $15 annual` (FAQ). | as listed | Single source: derive the seat row from one constant. |
| 4 | **Plan prices hardcoded in the comparison table header** (`$59/$149/$299/From $499`) duplicating `plans[]`. | `pricing.astro:542-575` | Derive from `plans[]`; `fromPrice` already exists on the Plan type and is currently ignored by the plan card. |
| 5 | **`boostSeats` is data but barely copy.** Business (15) and Enterprise (30) boost seats are never surfaced; the FAQ hand-writes Starter/Professional only. | `pricing.ts:1601,1641,1680,1716`; `pricing.astro:86` | Render boost seats from the plan data on every card. |
| 6 | **`buildTimeline` has no `business` key** but four plans are quoted from it. | `metrics.ts:42-46` | Add it. |
| 7 | **ROI calculator competitor set is stale and unsourced.** | `src/lib/roi.ts:CURRENT_TOOLS`, `computeInlineRoi` | Refresh with dated, sourced figures, or relabel clearly as illustrative. |

---

## Objective 2c — Sell the capacity that is already paid for

Verified provider allowances (July 2026, see Sources) against what Velox currently gates. This is
where the loss-leader gets cheaper and the plans get stronger at the same time.

| Provider capacity (free tier) | Velox today | Opportunity |
|---|---|---|
| **Product analytics: 1M events, 5K session replays, 1M feature-flag requests, 100K error events, 1,500 survey responses, A/B testing** | Session replays, heatmaps, funnels, A/B all gated to **Professional $299**; surveys unsold | Push behavioural analytics down to **Business**, and basic visitor analytics into **Starter**. Near-zero marginal cost, materially stronger loss-leader. Add a **Surveys & NPS** capability to the existing feedback module instead of building anything. |
| **Auth: 50,000 monthly active users, free** | "Staff & Customer Accounts" is a **bespoke engagement** citing Auth0/Clerk; SSO likewise | Productise a flat-price **Customer Portal / Accounts** module. Removes an unnecessary engagement, removes two vendor names, and creates a recurring add-on. Biggest single miss found. |
| **Zero Trust: free to 50 users** | Named as a security feature but not connected to seat economics | Supports raising included seats as a loss-leader lever without new cost. |
| **Edge AI inference: 10,000 neurons/day free** | Chatbot is engagement-only, `$0.01/conv` claim | Funds a **capped free AI allowance inside the 3-month boost** — a concrete boost perk that costs ~nothing. |
| **Postgres extensions (vector search)** | "AI Smart Search" priced $19.99 as if novel | Already fundable; keep the price, drop the risk. |
| **Object storage $0.015/GB, egress free; image delivery ~$1/100k; video ~$1/1,000 min** | Media overage billed at $1.00/GB | Directly fixes defect #2 and lets media allowances grow generously. |
| **Error tracking: free tier is only 5K errors/mo, 1 seat** | "Managed Telemetry" implied from Business up | The genuinely tight constraint. Size honestly, or move error capture to the analytics provider's 100K free error events. **This is the one place the site currently over-promises against a real ceiling.** |
| **Transactional email: 3,000/mo free but capped 100/day** | Starter advertises 1,000/mo | Monthly total is fine; a burst is not. Add fair-use wording or change provider tier. |

---

## Objective 2d — Commercial rules, offer design and legal alignment

The owner's stated rules, and where each must land:

| Rule | Current state | Action |
|---|---|---|
| **No setup / onboarding fee** | Contradicted in 3 places | Remove; state it as a positive differentiator on `/pricing` and the homepage |
| **Free demo, built on their business, before any contract** | Buried in one FAQ answer | Promote to a named funnel stage: homepage hero CTA, `/pricing` header, `/contact`, and a step in "What working with us looks like" (`index.astro:26-70`) |
| **First 3 months paid upfront (monthly plans)** | Terms §3 frames it as "due regardless of cancellation" | Reframe as an upfront payment at signing, and say plainly what it funds |
| **12-month minimum, cancel anytime, min 50% on cancellation** | Terms §4 + refund §4 say "50% of *remaining*" | Confirm basis (see Open Questions), then make Terms, Refund and the pricing FAQ agree word for word |
| **Full support for 3 months; we absorb all hours/billing for bugs in what we built** | Not stated anywhere | Add a **Build Warranty** clause to Terms and a plain-language card on `/pricing`. Strong, cheap, differentiating. Describe the capability ("we monitor errors and flag issues automatically") without naming the tool. |

### Making the 3-month full-power window better

Current framing is defensive ("this is NOT a free trial", "it settles back"). The offer is stronger
as a **structured proof period** than as a discount:

- Name it for what it does. Add a plain "what you keep / what settles" table so the wind-down is
  legible up front rather than a surprise in month 4.
- Add perks that are genuinely cheap on this stack: capped AI conversation allowance, surveys/NPS,
  a migration + data-import window, and a written performance/accessibility baseline report at
  go-live (produces the before/after asset that feeds Play #1 and #2 in the GTM doc).
- Pair it with the **Build Warranty** so months 1-3 read as "full power *and* fully covered".
- Add a **month-3 review** as a named step: usage report, what settles, what is worth keeping. This
  is the designed expansion moment, and it is where the loss-leader converts to the add-on revenue
  that is the actual business model.

---

## Files most affected

**Velox (code + copy):**
`src/data/stack.ts`, `src/data/stack.test.ts`, `src/data/pricing.ts`, `src/data/metrics.ts`,
`src/config/site.ts` (BOOST), `src/lib/copy-lint.test.ts` (new vendor rule), `src/lib/roi.ts`,
`src/pages/pricing.astro`, `src/pages/terms.astro`, `src/pages/refund.astro`,
`src/pages/security.astro`, `src/pages/ai.astro`, `src/pages/llms.txt.ts`, `src/pages/index.astro`,
`src/pages/contact.astro`, `src/components/PoweredByStrip.astro`, `src/components/SeatsSecurity.astro`,
`src/components/PlatformServices.astro`, `src/components/AddonCatalog.astro`,
`src/components/icons/BrandIcon.tsx` + `brands/`.

**cf-admin (docs only):**
`documentation/2026-07-27-go-to-market-prospecting-and-roadmap.md` (new),
`documentation/README.md` (index entry — blocking CI check).

## Verification

- `npm test` in Velox — covers `copy-lint`, `pricing.test.ts` (CTA/price coherence, annual math,
  icon resolution, Managed-Platform label rule), `stack.test.ts`, `site.test.ts` PII guard.
- `npm run build` and `npm run check` (CI gates on both).
- `npm run verify:a11y` (axe WCAG2A/AA) and `npm run verify:budget`.
- `python3 scripts/docs_check.py` in cf-admin — front-matter, link and index-drift checks.
- Manual read-through of `/pricing`, `/terms`, `/refund` for a single consistent story on: setup
  fee (none), 3 months upfront, 12-month minimum, 50% on cancellation, build warranty, free demo.
- Grep sweep confirming zero infra-vendor names in `src/**` visible copy.

## Branch

All three repos: `claude/velox-pricing-positioning-j6r5ya` (already checked out). Commit and push
per repo; no PR unless asked.

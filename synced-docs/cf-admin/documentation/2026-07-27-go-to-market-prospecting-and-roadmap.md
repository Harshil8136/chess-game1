---

title: "Go-To-Market — Prospecting Plays, Funnel & Sequenced Roadmap"
status: active
audience: [owner, non-technical, technical, operator, ai]
last_verified: 2026-07-27
verified_against: [code, config, web]
owner: harshil
related_docs: [2026-07-26-commercial-model-costing-pricing-and-scale.md, 2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md, 2026-07-17-compliance-standing-and-market-positioning.md, reference/commercial-readiness-checklist.md, MAINTENANCE.md]
tags: [gtm, sales, prospecting, roadmap, strategy, commercial, pipeline]
---

# Go-To-Market — Prospecting, Funnel & Roadmap

> **TL;DR (non-technical):** The commercial model document priced the product and
> stopped. This one says how to actually find buyers, in what order, and how fast
> we are allowed to grow before delivery breaks.
>
> Three things matter more than the rest. **One:** the free working demo on the
> prospect's own business is the strongest asset in the funnel and it was, until
> now, the least visible thing we do. Lead with it. **Two:** the agent-readable
> business interface is the only capability here a competitor cannot copy in a
> weekend, and it is currently sold as a $24.99 checkbox. **Three:** there is a
> hard ceiling of roughly **10-15 clients** before fleet operations collapse, and
> the tooling that raises it is still unstarted. Do not sell past it.

## Context / Scope

[`2026-07-26-commercial-model-costing-pricing-and-scale.md`](2026-07-26-commercial-model-costing-pricing-and-scale.md)
established cost basis, unit economics, scale ceilings and compliance standing. It
closed with §12, a validation plan, and stated plainly that every price in it is
modelled and **none of it has met a customer**. No document in this repository has
ever described how a customer arrives.

**Audience: internal.** This document is blunt about what we cannot yet deliver.
§9 marks the subset that is safe to say to a prospect.

**Note on publication.** `documentation/` is mirrored to a public repository by
`.github/workflows/sync-docs.yml` with PII redaction. Nothing here should name a
named prospect, a rate we pay a supplier, or an individual.

---

## 1. Two motions, one product. Say which one you are running.

The commercial model concluded "lead with agencies, $250-900 per deployment". The
Velox site sells to SMB owners at $59-499. Read side by side those look like a
contradiction and it has been quietly costing us clarity in every conversation.

They are two motions over one codebase, and the distinction is the deployment:

| | **Motion A: Direct SMB** | **Motion B: Agency / reseller** |
|---|---|---|
| Buyer | The business owner | An agency running many client sites |
| Sold as | Velox plans | The framework plus fleet tooling |
| What ships | `cf-astro` marketing site, optionally plus a `cf-admin` deployment | A repeatable per-client deployment they run |
| Price | $59-$499/mo | $250-900/deployment/mo |
| Cost to serve | Starter carries **no admin deployment**, so ops load is near zero. Business and up carry a real deployment, at the ~$36/client/month fully-loaded floor from commercial §8 | One relationship, many deployments |
| Sales cycle | Days to weeks | Weeks to months |
| Ceiling | Our own fleet capacity (§5) | Their capacity, once tooling exists |

**The $59 Starter is defensible only because it carries no admin deployment.**
Stated that way it is a website product with a shared operations layer, and it
clears its costs comfortably. Left unstated it looks like it violates the cost
floor in our own commercial doc, and the first person to notice will be a buyer
comparing us with someone cheaper.

**Sequencing.** Motion A first, for a reason that is not preference: Motion B
sells a repeatable deployment, and we do not have one yet (§5). Selling agencies
before the fleet tooling exists sells a promise the delivery side cannot keep,
and an agency that gets burned tells other agencies.

---

## 2. ICP and anti-ICP

### Motion A (direct SMB), best fit first

| Segment | Fit | Why they buy |
|---|---|---|
| **Service businesses with a booking-shaped operation** (grooming, clinics, studios, salons, auto service, boarding) | ★★★★★ | The whole product maps to how they already work, and the reference deployment proves it in their exact shape |
| **Multi-location SMB and franchises** | ★★★★☆ | Per-location deployment is native, and centralised monitoring is a real pain they feel monthly |
| **Businesses in a regulated-adjacent niche** (anything handling consent, waivers, or client records) | ★★★★☆ | Consent evidence and data-rights tooling is genuinely hard to buy at this price |
| **Businesses whose current site is visibly bad** | ★★★★☆ | The audit (Play 2) does the selling; the gap is measurable, not rhetorical |
| **Local businesses whose customers ask AI assistants** | ★★★☆☆ | Real and growing, but the buyer often does not know it is a problem yet. Educate, do not assume demand |

### Motion B (agency / reseller)

Per commercial §10: agencies already run a per-client deployment model, so the
fleet model matches how they work rather than fighting it, and one relationship
yields many deployments. **Gated behind §5.**

### Anti-ICP: decline these

Carried forward from commercial §10, still correct, plus two additions:

- **Payment processing in scope.** PCI scope we have deliberately avoided.
- **Health records.** HIPAA/BAA obligations that do not exist today.
- **Anyone needing SOC 2 or ISO on day one.** We hold zero certifications. Do not
  promise a date.
- **Buyers wanting self-serve signup.** Onboarding is manual and will stay manual
  for a while.
- **A no-code visual builder buyer.** Wrong product, guaranteed churn.
- **50+ deployments from one buyer** before fleet tooling exists.
- *(New)* **Anyone who needs an uptime SLA in writing.** No DR drill has ever been
  run (`MAINTENANCE.md` C-6). We can commit to a response time. We cannot commit
  to an availability figure we have never measured, and doing so once would make
  every other claim we make suspect.
- *(New)* **Anyone who needs EU data residency.** No EU deployment exists.

---

## 3. Prospecting plays

Ordered by leverage, not by convention. Each has a trigger, an asset, an opening,
and a number that says whether it worked.

### Play 1 — Demo-first outbound *(the flagship)*

**The insight:** we will build a working version of a prospect's business, free,
before any contract. Almost nobody in this market does that, because almost nobody
can do it cheaply. We can, because the build is mostly configuration over a
codebase that already exists. Until now this was buried in a single FAQ answer.

**Trigger:** any business in a target vertical with a live site we can read.

**Asset:** their actual homepage, rebuilt on the stack, plus a side-by-side of
load performance and answer-engine visibility against their current site.

**Opening:** lead with the artifact, not the pitch. "We rebuilt your homepage.
Here it is next to your current one. No charge, nothing to sign, and the
comparison is yours whether or not we ever speak again."

**Why it converts:** it inverts the burden of proof. A deck asks them to imagine;
a demo asks them to react. It also filters hard and early: a prospect who will not
look at a free working version of their own business was never going to buy.

**Measure:** demo-to-meeting rate, then meeting-to-contract. Target a
demo-to-meeting rate that justifies the build time; if it does not clear
roughly one in four, the targeting is wrong, not the asset.

**Cost control:** timebox the demo. If it takes more than a few hours, the
prospect is out of ICP or the vertical template does not exist yet (Play 4).

### Play 2 — The audit as lead magnet

**Asset:** a repeatable report covering three things a business owner can act on:
Core Web Vitals and real load performance, answer-engine and AI-crawler
visibility, and ADA/WCAG exposure.

**Why the third one has teeth:** **ADA Title III has no small-business exemption.**
An accessibility finding is not a nice-to-have; it is a documented legal exposure
with a remediation cost attached. That converts a "maybe next quarter" into a
dated problem. Deliver it factually, never as a threat, and always with the fix
priced.

**Credibility comes from the machinery we already run:** `cf-astro` carries
`lighthouserc.json`, `scripts/check-links.mjs` and Playwright end-to-end tests,
and the Velox sales site itself now passes a full axe WCAG2A/AA sweep on every
route. We audit others against a bar we actually clear.

**Honesty constraint:** publish only measured numbers. See §7 on the Lighthouse
claim, which is the live example of getting this wrong.

**Measure:** audits delivered, audit-to-demo conversion. This play feeds Play 1.

### Play 3 — The agentic-visibility wedge *(the differentiated one)*

**The insight:** a growing share of "find me a groomer near here" now happens
inside an AI assistant rather than a search box, and essentially no SMB site is
built to be read or acted on by one. `cf-astro` already ships the full answer:
a live machine-readable interface with callable tools, in-page tool registration
so an assistant running in the visitor's browser can act rather than guess,
published capability manifests with content digests, a standards-based service
catalogue advertised in response headers, 16 named AI-crawler allow groups, an
AI-readable business summary, indexing pings fired on publish, and speakable
markup for voice.

**No competitor in the SMB web space can put that together quickly.** It is the
single most defensible thing in the portfolio, and it was being sold as a
$24.99 add-on describing about a third of it. It is now split into a visibility
module and a separate agent-interface module on the Velox pricing page.

**Opening:** ask the assistant, in front of them, what it says about their
business. The gap is usually the entire pitch.

**Measure:** attach rate of the two modules, and inbound citations we can
attribute to answer engines.

**Caveat, stated up front:** the agent standards are moving fast. This is sold
with a quarterly review precisely because some of it will need rework. Price
that in rather than pretending otherwise.

### Play 4 — Vertical land-grab

Pick **two or three** verticals, not eight. Depth beats breadth here because the
demo cost (Play 1) collapses once a vertical template exists: the second grooming
business is an afternoon, the first was a week.

`velox-platform-showcase/src/data/industries.ts` already exists and is under-used.
It can drive programmatic per-industry landing pages, which compounds with Play 6.

**Choose on three criteria:** the operation is booking-shaped, local search
matters commercially, and we can reach a cluster of them (an association, a
supplier, a trade group).

**Measure:** cost per demo within a vertical over time. It should fall sharply. If
it does not, the vertical is not templatable and should be dropped.

### Play 5 — Reference and referral

One live reference deployment exists and `/case-study` is already built. Two
actions: ask the existing client directly for introductions, and make referral a
standing, stated offer rather than an occasional favour.

**Concentration risk:** one reference is a single point of failure for the entire
GTM story. Getting to three references is more urgent than getting to ten clients.

### Play 6 — Inbound and dogfooding

We sell search and answer-engine visibility. Velox ranking for its own category is
the proof, and failing to is a live counter-argument. Cheap, slow, compounding.
Includes the industry landing pages from Play 4 and the audit report from Play 2
as a gated asset.

### Play 7 — Local and partner channel

Accountants, POS resellers, chambers of commerce, industry associations. Slow to
start, high trust, low cost. Best run in parallel with Play 4 so the partner has a
specific vertical to refer into.

### Play 8 — Agency / reseller channel *(gated)*

Motion B. **Do not open this before the fleet tooling in §5 exists.** An agency
buys repeatability. We do not have it yet.

---

## 4. The funnel

Every stage below matches what the Velox site and the contract now actually say.
If a stage here disagrees with `/pricing`, `/terms` or `/refund`, that is a bug in
one of them.

| # | Stage | What happens | Cost to prospect |
|---|---|---|---|
| 1 | **Contact** | Inbound from Plays 2/6/7, or outbound with the Play 1 artifact | Free |
| 2 | **Conversation** | 30 minutes on how the business actually runs. Listen first | Free |
| 3 | **Working demo** | Built on their business, walked through live. Comparison report is theirs regardless | **Free, no commitment** |
| 4 | **Proposal** | Plan recommendation, module scope, any tailored engagement quoted separately | Free |
| 5 | **Contract** | 12-month minimum. First 3 months paid upfront on monthly billing. **No setup fee** | First 3 months |
| 6 | **Build** | 2-3 weeks (Starter) to 8-12 weeks (Enterprise). Covered by the plan | Included |
| 7 | **Full-power window** | 3 months with far more switched on than the plan includes, plus the build warranty: defects in what we built are fixed at our cost | Plan price |
| 8 | **Month-3 review** | Go through real usage together. Decide what to keep | Included |
| 9 | **Settle and expand** | Account settles to the plan. Add-ons and usage are the actual business | Ongoing |

**Stage 8 is where the commercial model works.** The plans are deliberately
loss-leading; the margin is in add-ons and usage. A review built on the customer's
own three months of usage data is a far better expansion conversation than any
upsell sequence, and it is honest: we are telling them what they did not use.

**Stage 3 is where the funnel is won.** It is also the most expensive stage per
prospect, which is why Play 4 (templates) and hard ICP discipline (§2) matter.

---

## 5. The capacity gate. Read this before scaling anything.

Commercial §7.2 established an operational ceiling of **roughly 10-15 client
deployments without fleet tooling**. Re-verified 2026-07-27: `scripts/` still
contains only `a11y_check.py`, `audit_gate.py`, `docs_check.py` and
`rules_check.py`. **Every item below remains unbuilt:**

| Missing | What it costs at N clients |
|---|---|
| `wrangler.template.toml` | Binding IDs hand-edited per client. `GITHUB_RULES.md §6` records a real April 2026 production outage from exactly this, and a wrong UUID **fails silently** |
| `scripts/init-cloudflare.sh` | Provisioning is manual per client |
| Fleet migration runner | Migrations applied by hand (`MAINTENANCE.md`) |
| Deploy orchestration | One push deploys one deployment. N clients, N pipelines |
| Version / drift inventory | Nothing reports which client runs which version |
| Per-client secret management | Manual, per client, per rotation |

**Why this is a GTM section and not an engineering one:** past the ceiling, either
updates stop happening or an engineer is consumed full-time. Updates stopping is
not a convenience problem, it is a **compliance problem** — unpatched deployments
carry known CVEs and stale security rules, on a product whose entire pitch is
security posture. Selling past capacity is how a compliance story becomes a
compliance incident.

**Rule: prospecting volume is gated on remaining fleet capacity.** At 8 live
deployments, the priority is the tooling, not the ninth deployment. Commercial §7.2
estimates 2-4 weeks of work to build it, against 2-4 months for the multi-tenancy
alternative that was correctly rejected.

### Dated engineering constraints that bound GTM timing

These are not optional and two of them have deadlines:

| Item | Constraint | GTM effect |
|---|---|---|
| `MAINTENANCE.md` C-1 | npm audit exceptions **expire 2026-10-23** and the gate fails on expiry | A hard date. Every deployment inherits it |
| `MAINTENANCE.md` C-2 | `API_DENY_MODE` is still `shadow`, not `enforce` | Do not describe API authorization as enforced until it is |
| `MAINTENANCE.md` C-8 | **No prod/staging separation** | Every change is tested in production. Caps how fast we can safely ship to a growing fleet |
| `MAINTENANCE.md` C-6 | No IR/DR drill has ever been run | No uptime SLA, ever, until this changes |
| Compliance G12 | No external penetration test | Blocks the enterprise end of the market |
| Domain | Not yet purchased | Everything inbound (Plays 2, 6) is blocked on this. Cheapest unblock available |

---

## 6. Phased roadmap

Each phase has a gate. Do not start the next one until the gate is met.

### Phase 0 — Unblock (weeks 1-2)

1. **Buy the domain.** Every inbound play is blocked on it and it costs almost
   nothing. Do this first.
2. **Measure the real Lighthouse numbers** on a production build (§7). Publish
   what is measured, not what is hoped.
3. **Pick the two or three verticals** for Play 4.
4. **Time one real update end to end**, per commercial §12.1. This is the single
   highest-leverage measurement available and it closes assumption A4, which drives
   60-70% of modelled cost.

**Gate:** domain live, one measured performance baseline, one measured update time.

### Phase 1 — First evidence (weeks 3-8)

1. **Build the audit generator** (Play 2). Repeatable, low manual effort.
2. **Build the first vertical demo template** (Play 4). Measure how long the second
   demo in that vertical takes versus the first.
3. **Run ten discovery conversations** (commercial §12.3). Ask what they pay today
   before quoting anything.
4. **Price-test three prospects** across the plan range (commercial §12.4). Losing
   all three at the top and winning all three at the bottom means the price is too
   low, not too high.
5. **Ask the existing client for two introductions** (Play 5).

**Gate:** three signed clients, or ten completed discovery conversations with
written notes on what they pay today. Evidence, not activity.

### Phase 2 — Fleet tooling (weeks 9-16, overlapping)

Build every item in §5. Commercial §7.2 puts it at 2-4 weeks of focused work; the
window is wider here because it will run alongside delivery.

Also in this phase: flip `API_DENY_MODE` to enforce (C-2), and resolve the audit
exceptions before **2026-10-23** (C-1).

**Gate:** a new client deployment can be provisioned and updated by script, and
one command reports which version every client is running.

### Phase 3 — Scale the motion that worked (quarters 2-3)

Double down on whichever play produced the best cost per signed client. Open
Motion B (Play 8) **only if** the Phase 2 gate is met. Add prod/staging separation
(C-8) before the fleet is large enough that a bad deploy is expensive.

**Gate:** a repeatable cost-per-acquisition figure from real data.

### Phase 4 — Unlock the top of the market (quarters 3-4)

External penetration test (compliance G12) first, since it is cheap relative to
what it unblocks. Then SOC 2 Type I ($12k-$40k), which commercial §14.6 identifies
as the single highest-value certification unlock, funded by roughly four or five
clients at the upper tiers. Run a DR drill (C-6) so an availability commitment
becomes possible for the first time.

---

## 7. What to measure

**Funnel:** contacts, demos built, demo-to-meeting rate, meeting-to-contract rate,
cost per demo by vertical, time to first revenue.

**Delivery:** actual build time per tier against the published timeline, support
hours per client per month (closes commercial assumption A6, currently modelled at
zero and flagged as the largest unknown), and time per fleet update (closes A4).

**Expansion, which is the actual business model:** add-on attach rate at signing
versus at the month-3 review, usage-based revenue as a share of total, and net
revenue retention after the full-power window settles.

**The instrumentation already exists.** Product analytics is wired into the client
sites, and the volumes an SMB generates sit well inside what the plans already
fund. There is no reason to be flying blind on any of the above.

### The claim we currently cannot make

The marketing framing has used a Lighthouse score of "98/100/100/100". **That
number appears nowhere in `cf-astro`.** What the repo actually contains:
`RULES.md:11` targets "Lighthouse 95+ mobile"; `lighthouserc.json` measures the
**dev server**, not a production build, and all four of its assertions are
`warn`-level so they cannot fail CI; and
`Documentation/23-CODEBASE-REVIEW-AND-RATINGS-2026-07.md:343` states that runtime
metrics "were NOT measured", scoring performance signals 7/10 on a static
assessment with no field data.

The score may well be accurate. It is simply not evidenced, and a prospect who
runs Lighthouse themselves is exactly the kind of prospect who will. **Measure a
production run, then publish the real number**, and in the meantime claim the
mechanisms, which are all verifiable: edge caching, sub-10ms cached responses,
self-hosted subsetted fonts, immutable asset caching, no client-side router, and a
JS budget enforced in CI.

This is Phase 0 item 2, and it is the template for every performance claim we make.

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Selling past fleet capacity** | High without discipline | Severe: unpatched deployments on a security-positioned product | §5 gate. Prospecting volume tied to remaining capacity |
| **Price invalidated by first real negotiations** | High | Moderate | Price-test early (Phase 1.4). Every price is modelled, none validated |
| **Single-reference concentration** | Live today | High | Three references is more urgent than ten clients (Play 5) |
| **Claims outrunning evidence** | Live today | Severe | The Lighthouse case (§7) is the worked example. Measure, then claim |
| **Demo cost per prospect stays high** | Moderate | Moderate | Vertical templates (Play 4). Timebox and drop out-of-ICP prospects fast |
| **Agent standards shift under Play 3** | High | Low | Sold with a quarterly review and priced accordingly |
| **Audit exceptions expire 2026-10-23** | Certain, dated | High: build fails fleet-wide | Phase 2. This one has a calendar deadline |
| **No prod/staging separation** | Live today | Grows with fleet size | Phase 3, before the fleet is large enough for a bad deploy to be expensive |
| **Key-person dependency** | Live today | Severe | Not mitigated. Every play here assumes one operator; the fleet tooling in Phase 2 is also the main lever against this |

---

## 9. What is safe to say to a prospect today

Inherits commercial §13 and extends it to the GTM claims.

**True and defensible:**

- "We will build you a working version on your own business before you sign
  anything, at no cost."
- "There is no setup fee, no onboarding fee, and no migration fee."
- "Your data is exportable in standard formats at any time, including if you
  leave, and that is in the contract."
- "For your first three months, any defect in what we built is fixed at our cost."
- "Security controls map to OWASP ASVS Level 2 and the OWASP Top 10. An AI-assisted
  self-assessment puts roughly 91% of in-scope controls as verified, and the control
  mapping is available on request."
  *(Corrected 2026-07-29: was "self-assessed at roughly 95%". 95% matched no derivation
  in `compliance/ASVS-L2.md`, which reports 105 of ~115 controls = ~91%. Always carry the
  self-assessment qualifier — ASVS has no certification scheme, so "ASVS certified" is
  not a thing anyone can be.)*
- "Every mutation is audit-logged with actor, role, path and hashed IP."
- "On the production database, row-level security is enabled on 100% of tables holding
  personal data, with zero anonymous access."
  *(Scoped 2026-07-29. Verified live against the production Supabase project
  `zlvmrepvypucvbyfbpjj`, which returns a single advisory — leaked-password protection,
  tracked as L-8 and not applicable since authentication is Cloudflare Access, not Supabase
  Auth. The qualifier matters: a separate, dormant Supabase project from an earlier product
  version exists on the account pending export and decommission, and it does **not** meet
  this bar. Say "the production database", never "our infrastructure" — and re-verify the
  claim per deployment, since each client runs their own Supabase project.)*
- "Data-subject rights fulfilment has a working, audited admin workflow with
  statutory SLA tracking." *(Live and test-covered.)*
- "We do not sell, rent or share customer data."
- "Unlimited admin users. We do not charge per seat." *(Extra seats are a flat
  rate with no ceiling, which is the honest version of this.)*
- "Your site is built to be read and cited by AI assistants, not just search
  engines." *(All mechanisms are live and inspectable.)*
- "We're preparing for SOC 2 Type I; our Trust Services Criteria control mapping
  is available on request."

**Do not say:**

- "SOC 2 certified", "ISO 27001 certified", "HIPAA compliant". No certification
  exists.
- "WCAG conformant" **for a client deployment**. The accessibility statement says
  non-conformant, deliberately. *(The Velox sales site itself now passes a full
  axe WCAG2A/AA sweep; that is a statement about our site, not about a client
  build, and the two must not be blurred.)*
- "99.9% uptime", or any availability SLA. No DR drill has ever been run.
- "Fully GDPR compliant". Say "GDPR-grade architecture".
- Any specific Lighthouse score, until §7 is closed.
- Any data-residency region other than US. No EU deployment exists.
- "Scales to unlimited clients". The operational ceiling is 10-15 without tooling.
- Any named infrastructure provider. The Velox site describes capabilities
  instead, enforced by a CI rule; a verbal slip in a sales call undoes it.

---

## 10. Bottom line

1. **Lead with the free demo.** It is the strongest asset in the funnel and it was
   the least visible thing we did.
2. **Sell the agent-readable interface as the differentiator it is.** Nobody else
   in this market can assemble it quickly.
3. **Do not outrun the fleet ceiling.** Ten to fifteen deployments without tooling,
   and the tooling is 2-4 weeks that pays for itself immediately.
4. **Buy the domain this week.** Every inbound play is blocked on it.
5. **Measure before you claim.** The Lighthouse number is the live example of
   getting this backwards, and it is the cheapest thing on this list to fix.
6. **Three references matter more than ten clients.** One reference is a single
   point of failure for the whole story.
7. **The month-3 review is the business model.** Plans are the loss leader;
   add-ons and usage are the margin, and a review grounded in the customer's own
   usage data is the honest way to get there.

---

## 11. Sources

**Internal (verified 2026-07-27):**
`documentation/2026-07-26-commercial-model-costing-pricing-and-scale.md` (§7.2
ceiling, §8 unit economics, §10 ICP, §12 validation plan, §13 claims list),
`documentation/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`
(gap register, phased roadmap), `documentation/MAINTENANCE.md` (C-1, C-2, C-6,
C-8), `documentation/reference/commercial-readiness-checklist.md` (extraction
Phases A-E, unstarted), `GITHUB_RULES.md` §6 (the April 2026 binding-ID outage),
`scripts/` (fleet tooling absent), and in the sibling repositories
`cf-astro/lighthouserc.json`, `cf-astro/RULES.md`,
`cf-astro/Documentation/23-CODEBASE-REVIEW-AND-RATINGS-2026-07.md`,
`velox-platform-showcase/src/data/industries.ts`.

**Disclaimer:** internal commercial planning, not a forecast or professional
advice. Every conversion assumption here is untested; §7 exists to replace them
with measurements.

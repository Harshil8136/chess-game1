---

title: "Commercial Model — Fleet Costing, Pricing, Scale Ceilings & Compliance Standing"
status: active
audience: [owner, technical, operator, ai]
last_verified: 2026-07-26
verified_against: [code, config, web]
owner: harshil
related_docs: [2026-07-27-go-to-market-prospecting-and-roadmap.md, 2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md, 2026-07-17-compliance-standing-and-market-positioning.md, 2026-06-16-business-viability-and-compliance-assessment.md, reference/commercial-readiness-checklist.md, security/RoPA.md, security/compliance/data-residency.md, MAINTENANCE.md]
tags: [commercial, pricing, costing, unit-economics, scale, fleet, gtm, strategy]
---

# Commercial Model — Fleet Costing, Pricing, Scale & Compliance Standing

> **TL;DR (non-technical):** What this platform costs to run, what to charge for it,
> who to sell it to, and how far it scales. The delivery model is **one dedicated
> Cloudflare deployment per client** — not multi-tenant SaaS — which is a deliberate
> choice, and this document prices that model honestly.
>
> The headline numbers: infrastructure is **~$30/month for your first client and about
> $10/month for each one after that**. That is not the real cost. The real cost is
> **operating a fleet of independent deployments** — shipping a version update to 20
> separate Cloudflare accounts and 20 separate databases — and the tooling for that
> **does not exist yet**. Price against the operational cost, not the infra cost.

## Context / Scope

This is the first commercial document in the repository. Prior docs covered viability
and market positioning but contain **no cost-to-serve, no unit economics, no scale
ceiling, and no defensible price**. It closes that gap.

**Audience: internal.** It is blunt about weaknesses. §12 marks the subset that is safe
to say to a buyer.

**It resolves two contradictions** found in the existing docs (§1, §5) and **fact-checks
one architectural claim** (§3).

### What this supersedes

| Prior claim | Source | Status |
|---|---|---|
| Product is a "booking + back-office platform for small service businesses" | `2026-06-16:86` | ❌ **Superseded** — see §1 |
| "$5–30/mo … Workers Paid (floor for Queues)" | `2026-06-13:163` | ❌ **Premise obsolete** — Queues now has a free tier (§5) |
| "~$0.50/month maximum, entirely free-tier … Queues" | `2026-07-22:74,604` | 🟡 **Technically right, materially incomplete** (§5) |
| "~2,000× traffic headroom before any code change" | `2026-06-13:100` | 🟡 **Misleading** — the binding constraint is not requests (§6) |
| Multi-tenancy is "the unlock for selling to >1 business" | `2026-07-17:208` | ❌ **Rejected by design decision** — see §2 |

---

## 1. Product definition

Two documents in this repo described **different products**. `2026-06-16` called it a
booking platform for pet care/salons/clinics; `2026-07-17` called it "a compliance-forward,
edge-native admin & control-plane framework" competing with Retool and Directus. Nothing
reconciled them, and they imply prices differing by roughly 10×.

**Governing definition: a compliance-forward, edge-native admin and control-plane
framework**, deployed as a dedicated instance per client.

`reference/commercial-readiness-checklist.md:15-19` independently supports this: the
codebase is *"90% a generic Cloudflare-Workers admin framework and 10% pet-hotel-specific
glue."*

**What it is:** an admin back-office you deploy for a client, with Zero Trust identity,
per-page/per-feature permissions at 10k+ entries, a tamper-resistant audit trail, a
DSAR/ARCO workflow, consent forensics, and a multi-provider control plane (Cloudflare,
Supabase, Sentry, PostHog) — all running at the edge with no servers.

**What it is not:**

- Not a no-code/drag-drop builder. It is code-first. A buyer who wants a visual builder
  should buy Retool or Budibase.
- Not a booking SaaS. Pet-hotel booking is a *plugin-shaped* feature of one deployment.
- Not a CMS. Content management exists, but it is auth/permission-led, not content-led.
- Not for **heavy payment processing** (PCI scope) or **health records** (HIPAA/BAA) —
  carried forward from `2026-07-17:196-198` and still true.

---

## 2. Delivery model — one deployment per client, by design

**Decision (2026-07-26): multi-tenancy will not be built.** Each client gets their own
Cloudflare deployment.

The rationale is that client systems differ enough that a shared schema would be a
liability rather than an asset — so the platform is built to be *modularly reduced* per
client (remove pages and features) while the security, error-handling, logging and access
core stays identical everywhere. §3 fact-checks whether the architecture actually
delivers that.

This reframes prior analysis. `2026-06-16:107-109` called single-tenancy a blocker —
*"you cannot onboard a second customer without forking or multi-tenant work"* — and
`2026-07-17:208` called multi-tenancy *"the unlock for selling to >1 business."* Under a
deliberate per-deployment model, **neither is a blocker**. The forking *is* the product.

What changes as a consequence:

| Concern | Multi-tenant SaaS | Per-deployment fleet (chosen) |
|---|---|---|
| Isolation | Logical, `tenant_id` scoping — a bug leaks across tenants | **Physical.** Separate Worker, D1, KV, secrets. A bug cannot cross a client boundary |
| Blast radius of a bad deploy | Entire customer base | One client |
| Per-client customisation | Hard — schema must serve everyone | **Native** — that is the model |
| Data residency per client | Hard | **Easy** — pick the region at deploy time |
| Compliance story | Shared-tenancy questions in every questionnaire | **Stronger** — "your data is in your own database" |
| Marginal infra cost | Near zero | ~$10/client/month (§5) |
| **Operational cost** | One deploy | **N deploys — the dominant cost (§7)** |
| Onboarding | Self-serve possible | Manual until tooling exists (§7) |

The trade is real and it is not obviously wrong: you buy isolation, customisation and a
better compliance story, and you pay for it in **fleet operations**. §7 is the section
that matters most.

---

## 3. Modularity — fact-check of the architectural claim

**Claim under test:** *"removing pages and some features won't break it, and the core
architecture of security, error handling, logging and user access stays the same."*

**Verdict: TRUE, with two caveats.** The architecture genuinely supports per-client
reduction. Evidence, all verified in code:

### 3.1 What makes the claim hold

| Property | Evidence | Why it matters |
|---|---|---|
| **Core never imports features** | `grep` for imports from `src/pages/` inside `src/lib/` returns **zero matches** | The dependency direction is one-way. Deleting a page cannot break auth, logging or middleware, because nothing in the core references it. This is the single strongest fact supporting the claim. |
| **Navigation is data, not code** | `src/layouts/AdminLayout.astro:41-61` builds nav from `user.accessMap`, derived from the D1 `admin_pages` table. `Sidebar/config.ts` holds only section labels and colours | Removing a page is a **row change**, not a code change. No nav edit, no dead link. |
| **Unknown pages fail safe** | `deriveSection()` (`src/lib/auth/plac.ts:89-103`) returns `'MAIN'` for any unrecognised path | Adding a page needs no code edit; it lands in Overview. Removing one leaves a harmless dead branch. |
| **Access denies by default** | `checkPageAccess()` (`plac.ts:257-275`) returns `false` for any page absent from the access map | A removed page is automatically inaccessible. Removal is fail-closed, not fail-open. |
| **APIs lock automatically with their page** | `resolveApiAuthz()` → `checkPageAccess()` (`src/lib/auth/routes.ts`, `pipeline.ts:428-444`) | Remove `/dashboard/bookings` and `/api/bookings/*` **403s on its own**, because API authorization is derived from page access. You cannot forget to lock the API. |
| **Features toggle from the database** | `FeatureFlagRepository` over `admin_feature_flags` | Sub-page features switch off without a deploy. |
| **Middleware is page-agnostic** | `src/middleware.ts` = `sequence(securityHeaders, authMiddleware)` — global | CSP, security headers, GPC detection, session handling, role re-check and the audit log apply to every request regardless of which pages exist. **This is the "core stays the same" guarantee, and it holds.** |
| **Data access is abstracted** | 13 repositories under `src/lib/dal/` | Schema changes per client are contained in the DAL. |

### 3.2 Caveat 1 — removal is not a security boundary for `dev`/`owner`

`checkPageAccess()` line 262:

```ts
if (accessMap?.role === 'dev' || accessMap?.role === 'owner') return true;
```

DEV and OWNER **bypass all page checks, including deactivated pages**. So removing a page
from `admin_pages` hides it from every normal role, but a `dev` or `owner` user can still
reach the route — the `.astro` file is still in the deployed bundle.

**Consequence:** for a client deployment where a feature must be *genuinely absent* (not
merely hidden), deactivating the registry row is not enough. Delete the route files from
that client's build, or the roles at the top of the hierarchy will still see it. For
merely tidying a sidebar, the row change is sufficient.

### 3.3 Caveat 2 — two hardcoded lists, and the pet-hotel coupling

`deriveSection()` (`plac.ts:89-103`) and `API_PAGE_MAPPING` (`routes.ts:9-30`) are
hand-maintained path lists. **Removal is safe** — a stale entry is inert. **Addition**
needs a line in `API_PAGE_MAPPING`, and `test/api-authz-inventory.test.ts` fails CI if you
forget, which is the intended behaviour.

Separately, genuine domain coupling remains, per `commercial-readiness-checklist.md:26-66`:
`booking_pets` and `booking_quality_metadata` schema, hardcoded "Madagascar Pet Hotel"
copy, `madagascar-db`/`madagascar-sessions` binding names, and a `CHATBOT_SERVICE` service
binding. Phases A–E of that checklist plan the extraction; **none of it is done**. Today,
a new client deployment starts as a fork that still carries pet-hotel tables.

### 3.4 Honest summary

The **core is genuinely reusable and genuinely stays constant** — that half of the claim
is well-supported and is the platform's real asset. The **per-client reduction works at
the page and feature level today**, via database rows. What does *not* yet exist is the
mechanical extraction of the pet-hotel domain from the framework, so every new deployment
inherits schema and copy it does not need. That is a known, planned, unstarted piece of
work — and it is the difference between "modular in principle" and "productised."

---

## 4. Compliance standing — consolidated

Full detail in
[`2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md)
§9.1, updated after the 2026-07-25/26 remediation pass. Not re-derived here.

| Framework | Standing | Claimable today | Commercial effect |
|---|---|---|---|
| OWASP ASVS L1/L2, Top 10 | ~95–98% | ✅ Yes | Survives a security questionnaire and an automated scan |
| CSA STAR Level 1 (CAIQ) | ~90%, doc complete | ✅ Yes, once submitted | Free public trust badge; discoverable in procurement search |
| NIST CSF 2.0, CIS v8 | ~80% | ✅ Yes | Self-attestable mapping |
| ISO/IEC 5055, 25010 | Benchmarked | ✅ Yes | Code-quality evidence |
| GDPR | ~85% | 🟡 "GDPR-grade architecture", not "compliant" | RoPA + breach runbook now exist; DSAR workflow is live and tested |
| CCPA/CPRA | ~83% | 🟡 Qualified | GPC detected; consumer enforcement is a `cf-astro` gap |
| SOC 2 Type I | ~85% | ❌ Readiness only | **The most-requested artifact in B2B procurement.** $12k–$40k |
| SOC 2 Type II | ~75% | ❌ | +6–12 month observation. $15k–$75k |
| ISO 27001 (+27017/27018/27701) | ~60% | ❌ | Often required instead of SOC 2 outside the US. $15k–$75k |
| WCAG 2.2 AA | Partial | ❌ **Non-conformant, stated** | 45 open findings; ADA Title III has no small-business exemption |
| EU AI Act | Deployer, limited-risk | 🟡 | Chatbot Art. 50 disclosure unverified (`cf-chatbot`) |
| HIPAA, PCI DSS | N/A by design | — | Becomes live only if health data or card data is introduced |

**Zero third-party certifications are held.** For the per-deployment model this matters
*less* than it would for multi-tenant SaaS — physical isolation answers a large share of
what a security questionnaire is probing — but SOC 2 remains the gate for mid-market and
enterprise buyers.

---

## 5. Cost basis — verified vendor rates (July 2026)

All rates verified against vendor documentation on 2026-07-26, not recalled. Sources §13.

| Dimension | Free plan | Paid included | Overage |
|---|---|---|---|
| Workers requests | 100k/day | 10M/month | $0.30/M |
| Workers CPU | 10 ms/invocation | 30M CPU-ms/month | $0.02/M ms |
| D1 rows read | 5M/day | 25B/month | $0.001/M |
| **D1 rows written** | **100k/day** | **50M/month** | **$1.00/M** |
| D1 storage | 5 GB total | 5 GB | $0.75/GB-month |
| KV reads | 100k/day | 10M/month | $0.50/M |
| **KV writes** | **1k/day** | **1M/month** | **$5.00/M — priciest dimension** |
| R2 storage | 10 GB-month | — | $0.015/GB-month, **egress free** |
| Queues operations | 10k/day | 1M/month | $0.40/M |
| Queue retention | **24 h, non-configurable** | 4 days, up to 14 | — |
| Supabase | Free — pauses when idle, no PITR | **Pro $25/org/month**, incl. $10 compute credit (one Micro project) | **~+$10/month per additional project** |
| Upstash Redis | 256 MB, 500k commands/month | Pay-as-you-go | $0.20/100k commands |

### 5.1 The critical billing fact for a fleet

> **Cloudflare Workers Paid is $5/month per _account_, not per Worker** — and the
> included quotas (10M requests, 50M D1 rows written, 1M KV writes, 1M Queue operations)
> are **shared across every Worker in that account**.

This single fact determines the fleet economics. If all client deployments live in *your*
Cloudflare account, the Cloudflare marginal cost of client #2 through #N is **$0** until
aggregate usage crosses the included quotas. If each client owns *their* Cloudflare
account, it is $5/client and the quotas reset per client.

### 5.2 Resolving the three contradictory cost figures

`$5–30/mo` (`2026-06-13`) was premised on *"Workers Paid is the floor for Queues."*
**That premise is obsolete** — Queues now has a free tier at 10,000 operations/day.

`~$0.50/month` (`2026-07-22`) claims everything runs free-tier including Queues. That is
now *technically* correct but **materially incomplete**: free-tier Queues caps message
retention at **24 hours, non-configurable**. For an email queue, that is a data-loss risk
if the consumer is down over a weekend — not a cost optimisation. Free-tier Supabase also
**pauses after a week idle and has no point-in-time recovery**.

**Both figures describe real configurations. The spread is a plan choice, not an
ambiguity:**

| Posture | Monthly | Honest description |
|---|---|---|
| All free tier | **~$0–1** | Fine for a demo or an internal tool. 24 h queue retention, no PITR, idle pause, hard daily caps. **Not what you sell to a paying client.** |
| Production-grade | **~$30** | Workers Paid $5 (account) + Supabase Pro $25 (org). Real retention, PITR, no idle pause, no daily caps. |

**Price against $30, not $0.50.**

---

## 6. Scale ceiling — the constraint is writes, not requests

The "~2,000× traffic headroom" figure in `2026-06-13:100` compares current traffic to the
**Workers request** limit. That is the wrong limit.

**`src/lib/auth/pipeline.ts` writes one `admin_audit_log` row to D1 on every request** —
a deliberate compliance property (SOC 2 CC7, ISO 27001 A.8.15), not a defect. So **D1
rows written** moves in lockstep with requests, and any request that also mutates data
writes more.

| Plan | Requests | D1 rows written | Which binds first |
|---|---|---|---|
| Free | 100k/day | **100k/day** | **Simultaneously.** The audit log alone consumes the entire D1 write budget at the same moment traffic exhausts the request budget. Any mutation makes D1 bind *first*. |
| Paid | 10M/month | 50M/month | Requests. D1 has ~5× headroom over the audit-log baseline. |

**Second constraint, fleet-wide: KV writes.** 1M/month included, then **$5.00/M** — the
most expensive metered dimension. KV writes come from session activity: the 30-minute role
re-check and `patchSession`.

Illustrative — `ASSUMPTION` A3, §11: 8 working hours/day, 22 days/month, ~2 session writes
per user-hour.

| Fleet-wide admin users | KV writes/month | Within 1M included? |
|---|---|---|
| 100 | ~35k | ✅ Comfortable |
| 1,000 | ~350k | ✅ Comfortable |
| 5,000 | ~1.76M | ⚠️ ~$3.80/month overage |
| 10,000 | ~3.5M | ⚠️ ~$12.50/month overage |

Even at 10,000 admin users across the fleet, KV overage is ~$12/month. **Metered
Cloudflare cost is not a business risk at any plausible scale for this product.**

**Third constraint, and the one that actually bites: D1 storage is summed per account.**
Cloudflare bills *"the sum of all databases in your account"* — 5 GB included, then
$0.75/GB-month. Twenty client databases share one 5 GB allowance, ~250 MB each before
overage. This is why the retention windows in `src/lib/retention-tables.ts` are a
**cost control**, not only a privacy control: the 365-day audit-log window is what stops
unbounded growth. Overage is cheap ($0.75/GB), but it is the first dimension to move.

---

## 7. Fleet operations — the real cost driver

Infrastructure is nearly free. **Operating N independent deployments is not**, and this is
where the per-deployment model concentrates its cost.

Every client deployment independently needs: code updates, D1 migrations, Supabase
migrations, secret rotation, binding-ID correctness, compliance-doc currency, and incident
response.

### 7.1 Tooling that does not exist

Verified 2026-07-26 — `scripts/` contains only `a11y_check.py`, `audit_gate.py`,
`docs_check.py`, `rules_check.py`. Every item below is **absent**:

| Missing | Consequence at N clients |
|---|---|
| `wrangler.template.toml` | Binding IDs hand-edited per client. `GITHUB_RULES.md §6` records a real April 2026 production outage from exactly this — a wrong UUID **fails silently** |
| `scripts/init-cloudflare.sh` (proposed — does not exist) | Provisioning D1/KV/R2/Queues is manual per client |
| Fleet migration runner | Migrations are applied **by hand**. `MAINTENANCE.md` confirms: applied "directly, not via `wrangler d1 migrations apply`" |
| Fleet deploy orchestration | `git push` deploys **one** Worker. N clients = N pipelines |
| Version/drift inventory | Nothing reports which client runs which version |
| Per-client secret management | `wrangler secret put` × N, manually |

### 7.2 What this costs

`ASSUMPTION` A4 (§11) — 30 min/client for a routine version update, done manually:

| Clients | Manual effort per update | Realistic update cadence |
|---|---|---|
| 1 | 0.5 h | Any time |
| 5 | 2.5 h | Monthly is comfortable |
| 10 | 5 h | Monthly starts to hurt |
| 25 | **12.5 h** | Quarterly at best — **and clients drift apart** |
| 50 | **25 h** | **Not viable manually** |

**The fleet model has a hard operational ceiling around 10–15 clients without tooling.**
Past that, either updates stop happening — which is a *compliance* problem, since
unpatched deployments carry known CVEs and stale security rules — or an engineer is
absorbed full-time.

**This is the single most important number in this document.** Building the fleet tooling
(templated config, provisioning script, migration runner, version inventory) is
**perhaps 2–4 weeks of work** and it is what converts this from a consulting practice into
a product. It is a smaller investment than the 2–4 months multi-tenancy would have cost,
and it preserves the isolation benefits.

---

## 8. Unit economics

Cloudflare $5 is per-account; Supabase is $25/org plus ~$10 per additional project (§5).
Assuming **your** Cloudflare account and **your** Supabase org (`ASSUMPTION` A1):

**Fleet infra cost ≈ $30 + $10 × (N − 1)**

| Clients | Infra/month | Per client | Note |
|---|---|---|---|
| 1 | $30 | $30.00 | Base absorbs CF $5 + Supabase $25 |
| 5 | $70 | $14.00 | |
| 10 | $120 | $12.00 | |
| 25 | $270 | $10.80 | Approaches the $10 Supabase-project floor |
| 50 | $520 | $10.40 | Metered CF overage still negligible (§6) |

**Marginal infra cost of one more client: ~$10/month.** That is the true floor, and it is
low.

But infra is the small number. Adding fully-loaded operational cost at `ASSUMPTION` A5
($50/h blended, monthly update cycle, 30 min/client):

| Clients | Infra | Ops (monthly update) | **True cost/client/month** |
|---|---|---|---|
| 5 | $14.00 | $25.00 | **~$39** |
| 10 | $12.00 | $25.00 | **~$37** |
| 25 | $10.80 | $25.00 | **~$36** |
| 25 *with tooling* | $10.80 | ~$4.00 | **~$15** |

**Operations is 60–70% of cost-to-serve, and tooling removes most of it.** Support,
onboarding and incident time sit on top and are not modelled — they are the largest
remaining unknown (`ASSUMPTION` A6).

---

## 9. Pricing

### 9.1 Floor — below this you lose money

**~$36/client/month** fully loaded at 5–25 clients (§8). Anything under that is
subsidised by you.

Adding a conventional 80% gross-margin target: **absolute minimum ~$180/month per
client.** Below this the business does not fund its own maintenance, let alone the SOC 2
audit that unlocks larger buyers.

### 9.2 Competitor anchors (verified July 2026)

| Product | Price | Model |
|---|---|---|
| Retool Team | **$10**/builder/month (annual) | Per seat |
| Retool Business | **$50**/builder/month | Per seat |
| Appsmith Business | **$40**/user/month | Per seat (self-host free) |
| Directus Cloud Standard | from **$25**/month | Per project |
| Budibase Pro → Business | **$23** → **$359**/month | **Usage-based, not per seat** |

A 10-admin-user client on Retool Business pays **$500/month**. That is the ceiling this
category supports, and it is the right frame — you are replacing a Retool-class purchase,
not a website.

### 9.3 Pricing shape — do not price per seat

The cost driver is **requests, writes and deployments**, not users (§6, §8). Per-seat
pricing would misalign cost and revenue: a 50-user client costs you essentially the same
as a 5-user client, so per-seat either overcharges small clients or leaves money on the
table with large ones.

**Recommended shape: per-deployment flat fee + tier by capability, not by seat.** It
matches the cost curve, it is simple to quote, and "unlimited users" is a genuine
differentiator against Retool/Appsmith, whose bills grow with the team.

### 9.4 Recommended pricing

`ASSUMPTION` A7 — anchored to cost (§9.1) and comps (§9.2), **not validated with a single
customer**. Treat as a starting hypothesis, not a quote.

| Tier | Price/month | Setup | Includes |
|---|---|---|---|
| **Core** | **$250** | $1,500 | Dedicated deployment, unlimited admin users, Zero Trust auth, RBAC/PLAC, audit trail, security-header + CSP baseline, quarterly updates |
| **Trust** | **$500** | $2,500 | + DSAR/ARCO workflow, consent forensics, retention tooling, compliance evidence pack, monthly updates |
| **Sovereign** | **$900+** | $5,000 | + client-owned Cloudflare/Supabase accounts, region pinning, custom modules, priority incident response |

Gross margin at Core: **~$36 cost against $250 → ~86%.** Healthy, and it survives the
support load being worse than modelled.

**The setup fee is not optional.** Provisioning is manual today (§7.1), genuinely costs
several hours, and pricing it separately keeps the recurring fee honest rather than
amortising onboarding into it.

### 9.5 On the old price bands

`2026-06-16:256-259` proposed `$29–79 / $99–249 / $299–699`. Under the framework
positioning, **the bottom band is below cost** — $29/month against a ~$36 floor loses
money on every client. Those bands were written for a booking-SaaS product sold to
micro-SMBs. They do not transfer, and Starter should be retired rather than repriced.

### 9.6 Ceiling

Compliance is the premium lever. A buyer who needs an audit trail, DSAR fulfilment and
consent evidence is choosing between paying you and building it — and *building* it is
months of specialist work. `2026-07-17:220-221` framed this correctly: buyers pay to
**not** build this. Once SOC 2 Type I exists, **$900–1,500/month per deployment** is
defensible for regulated-adjacent buyers, and the audit pays for itself across ~4–5 such
clients in a year.

---

## 10. Target customers

**Lead with agencies and white-label resellers.** They buy frameworks rather than
outcomes, tolerate code-first, already run per-client deployments as their normal
operating model, and one relationship yields many deployments — which fits the fleet
model precisely.

| Segment | Fit | Why |
|---|---|---|
| **Digital agencies / white-label resellers** | ★★★★★ | Per-client deployment *is* their model. Multiplier per relationship |
| **Compliance-sensitive SMBs** (EU/LatAm, clinics, membership orgs) | ★★★★☆ | Physical isolation + DSAR/consent tooling is the differentiator. Willing to pay the Trust tier |
| **Multi-location SMB / franchises** | ★★★★☆ | Each location or brand can be its own deployment |
| **B2B SaaS teams needing an ops back-office** | ★★★☆☆ | Real fit, but they may build it themselves |
| **Membership orgs / nonprofits** | ★★☆☆☆ | Good fit, weakest budget |

**Anti-ICP — decline these:**

- Anyone wanting a **no-code visual builder** — wrong product, will churn.
- **Payment processing** in scope — introduces PCI scope you have deliberately avoided.
- **Health records** — HIPAA/BAA obligations that do not exist today.
- Buyers needing **SOC 2 or ISO on day one** — you have neither; do not promise a date.
- Buyers wanting **self-serve signup** — onboarding is manual (§7.1).
- **50+ deployments from one buyer** before fleet tooling exists (§7.2).

---

## 11. Assumptions register

Everything not traceable to a vendor rate or a repo fact.

| ID | Assumption | Value | Basis | Sensitivity | How to validate |
|---|---|---|---|---|---|
| A1 | All clients in your CF account + your Supabase org | — | §5.1 billing rules | **High.** Client-owned accounts add $5 CF + $25 Supabase each, roughly tripling per-client infra | Decide policy per contract |
| A2 | One Supabase project per client | ~$10/mo | Vendor: additional projects billed own compute | Medium | First multi-client bill |
| A3 | ~2 session KV writes per user-hour | §6 table | Derived from 30-min role re-check | Low — overage is ~$12/mo at 10k users | Cloudflare KV metrics |
| A4 | 30 min manual effort per client per update | §7.2 | Estimate — **never measured** | **Very high.** Drives 60–70% of cost | Time the next update |
| A5 | $50/h blended operator cost | §8 | Estimate | High — scales ops cost linearly | Your own rate |
| A6 | Support/incident load **not modelled** | $0 | **Deliberately excluded** | **Very high.** Could add 50–100% to cost-to-serve | Track hours for 3 months |
| A7 | Price points $250/$500/$900 | §9.4 | Cost floor + comps | **Very high — zero customer validation** | §12 |
| A8 | Clients accept quarterly (not continuous) updates | §7.2 | Untested | Medium | Ask in the first contract |

**No willingness-to-pay research, ARPU, CAC, LTV or churn data exists anywhere in this
repository.** Every price in §9 is derived from cost and competitor anchors, never from a
customer conversation.

---

## 12. Validation plan

Sequenced into a dated plan, alongside the prospecting plays that generate the
conversations these experiments need, in
[`2026-07-27-go-to-market-prospecting-and-roadmap.md`](2026-07-27-go-to-market-prospecting-and-roadmap.md) §6.

The fastest way to replace A4, A6 and A7 with evidence:

1. **Time the next real update** (closes A4). One measurement, highest-leverage number
   here. Do it on the very next deploy.
2. **Track support hours for 90 days** (closes A6).
3. **Ten discovery calls with agencies** (closes A7). Ask what they currently pay per
   client back-office, what they charge their client for it, and what would make them
   switch. Do **not** lead with a price — ask what they pay today.
4. **Price-test with three prospects**: quote $250, $500, $900 to comparable buyers. Losing
   all three at $900 and winning all three at $250 means the number is too low, not too high.
5. **Confirm the first multi-client bill** against §8 (closes A2).

Anchoring signal: a 10-seat Retool Business client pays **$500/month**. If an agency will
not pay $250 for a dedicated, compliance-hardened deployment with unlimited users, the
problem is positioning, not price.

---

## 13. What you can truthfully say to a buyer today

**True and defensible:**

- "Each client gets a dedicated, physically isolated deployment — your data lives in your
  own database, not a shared one."
- "Security controls map to OWASP ASVS Level 2 and the OWASP Top 10. An AI-assisted
  self-assessment puts ~91% of in-scope controls as verified (105 of 115), with the
  mapping available on request." *(Corrected 2026-07-29 — previously "self-assessed ~95%",
  a figure that matched no derivation in `compliance/ASVS-L2.md`. Never quote the
  percentage without the self-assessment qualifier; ASVS has no certification scheme.)*
- "Data-subject-rights fulfilment — access, rectification, erasure — has a working, audited
  admin workflow with SLA tracking." *(Live and test-covered.)*
- "Every mutation is audit-logged with actor, role, path and hashed IP."
- "We do not sell, rent or share customer data."
- "Unlimited admin users — we do not charge per seat."
- "Row-level security on 100% of PII-bearing tables, with zero anonymous access."
- "We're preparing for SOC 2 Type I; our Trust Services Criteria control mapping is
  available on request."

**Do not say:**

- "SOC 2 certified" / "ISO 27001 certified" / "HIPAA compliant" — no certification exists.
- "WCAG conformant" — the accessibility statement says **non-conformant**, deliberately.
- "99.9% uptime" or any SLA — **no DR drill has ever been run**; RTO/RPO are unmeasured
  estimates.
- "Fully GDPR compliant" — say "GDPR-grade architecture."
- "Scales to unlimited clients" — the operational ceiling is ~10–15 without tooling (§7.2).
- Any specific data-residency region other than **US** — no EU deployment exists.

---

## 14. Bottom line

1. **Infra is not the cost. Operations is.** ~$10/client/month marginal infra against
   ~$25/client/month of manual update effort. Price against the second.
2. **The fleet ceiling is ~10–15 clients without tooling**, and 2–4 weeks of tooling work
   raises it dramatically. That is the highest-ROI engineering investment available — and
   materially cheaper than the 2–4 months multi-tenancy would have taken.
3. **The modularity claim holds.** Core never imports features, nav is data-driven, removal
   is fail-closed, and API authorization derives from page access automatically. Two
   caveats: dev/owner bypass page removal, and the pet-hotel domain is not yet extracted.
4. **Floor ~$180/month, recommended $250–900, ceiling ~$1,500** post-SOC 2. Retire the old
   $29 Starter band — it is below cost.
5. **Sell to agencies first.** The per-deployment model is already how they work.
   *(Refined 2026-07-27: agencies are the higher-leverage motion but must be
   sequenced after fleet tooling exists, since what they buy is repeatability.
   Direct SMB runs first. See the GTM doc §1 and §5.)*
6. **SOC 2 Type I ($12k–$40k) is the single highest-value unlock** for larger buyers, and
   ~4–5 Trust-tier clients fund it in a year.
7. **Every price here is modelled, not validated.** §12 is how that changes — and timing
   one real update is the cheapest, highest-leverage thing to do next.

---

## 15. Sources

**Verified vendor pricing (2026-07-26):**

- [Cloudflare Workers Platform Pricing](https://developers.cloudflare.com/workers/platform/pricing/) — Workers, D1, KV, R2, Queues rates; the **$5/account** minimum
- [Cloudflare D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) — rows read/written, storage summed per account
- [Supabase Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq) — $25/org, $10 compute credit, per-project compute
- [Upstash Redis Pricing](https://upstash.com/pricing/redis)
- [Retool Billing & Usage](https://docs.retool.com/support/billing-usage)
- [Appsmith / Budibase comparison](https://comparestacks.com/saas-software/internal-tooling-admin-panels/vs/appsmith-vs-budibase/)
- [Directus pricing](https://www.capterra.com/p/156619/Directus/)

**Internal (verified against code, not quoted from prior docs):**
`src/lib/auth/plac.ts`, `src/lib/auth/routes.ts`, `src/lib/auth/pipeline.ts`,
`src/layouts/AdminLayout.astro`, `src/lib/retention-tables.ts`, `src/lib/dal/`, `scripts/`,
`wrangler.toml`.

**Disclaimer:** internal financial modelling, not a quote, forecast or professional
financial advice. Every price is derived from cost and public competitor rates with zero
customer validation (§11). Vendor pricing changes — re-verify §5 before contracting.

---

title: "Data Residency & Cross-Border Transfers"
status: active
audience: [owner, operator, technical, ai]
last_verified: 2026-08-12
verified_against: [code, config]
owner: harshil
related_docs: [../RoPA.md, ../SECURITY.md, ISO-27017-27018.md, ../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md]
tags: [data-residency, gdpr, transfers, scc, gpc, ccpa, compliance]
---

# Data Residency & Cross-Border Transfers

> **TL;DR (non-technical):** Where the data physically lives (the US), what that
> means for European customers (transfers rely on contractual safeguards), and
> what it would take to offer an EU-hosted option. This is the single biggest
> technical blocker for EU public-sector and regulated-industry buyers.

## Context / Scope

Addresses gap **G17** (no data-residency/region pinning) and the residency half
of **G6** (GPC) from
[`../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md).

## 1. Where data lives today

| Store | Provider | Region | Contains |
|---|---|---|---|
| D1 `madagascar-db` | Cloudflare | **US** | Audit log, page registry, login logs, booking state, email drafts |
| Postgres | Supabase | **US** | Users, ARCO tickets, consent records, bookings, email ledger |
| KV `cf-admin-session` | Cloudflare | Globally distributed | Sessions, access maps |
| R2 `madagascar-images` | Cloudflare | **US** | CMS images, email attachments |
| R2 `madagascar-staff-storage` | Cloudflare | **US** | Staff drive files, incl. payroll/medical records — same jurisdiction and hosting posture as `madagascar-images`; no separate residency treatment |
| Queues | Cloudflare | US | Email payloads in transit |
| Workers | Cloudflare | Edge (global) | Compute only — no durable storage |

**There is no EU-region deployment, and no per-tenant region selection.**
Every durable store is US-region.

Note the KV nuance: Cloudflare KV replicates globally by design. It holds only
session state and cached access maps — no customer PII — but "globally
distributed" is the accurate description, not "US".

## 2. Transfer mechanism for EU/UK data subjects

US storage of EU personal data is a third-country transfer under GDPR Chapter V
and requires an Art. 46 safeguard.

| Sub-processor | Mechanism | Notes |
|---|---|---|
| Cloudflare | SCCs in the Cloudflare DPA; EU-US Data Privacy Framework participant | Also offers an EU-only Data Localisation Suite (paid) |
| Supabase | SCCs in the Supabase DPA | EU regions available on paid tiers |
| Brevo | EU-based (France) | No transfer for EU subjects |
| Resend | SCCs | US |
| Sentry | SCCs; PII scrubbed before transmission | `sendDefaultPii: false` + `src/lib/sentry-scrub.ts` |
| PostHog | SCCs | US cloud |
| Upstash | SCCs | Hashed identifiers only |
| OpenRouter | Varies by model provider | Optional; staff prompts only, no customer PII |

**Action outstanding:** countersigned DPAs should be filed and their locations
recorded here. Relying on a vendor's published terms is weaker evidence than a
signed agreement when an auditor asks.

## 3. Why this matters commercially

Residency is not a checkbox — it is a hard gate for specific buyers:

- **EU public sector** frequently mandates EU-only storage; US storage is
  disqualifying regardless of SCCs.
- **German buyers** may require BSI C5, which assumes EU hosting.
- **Healthcare-adjacent EU buyers** commonly require in-region processing.
- **Schrems II** obliges a transfer-impact assessment; SCCs alone are not
  automatically sufficient.

## 4. What an EU option would take

Both providers support it; nothing here is blocked on technology.

| Step | Mechanism | Cost | Effort |
|---|---|---|---|
| Supabase EU project | Region at project creation | Paid tier | Medium — new project, migration |
| D1 EU | Location hint at database creation | $0 | Medium — new DB, migration |
| R2 EU | Jurisdiction-restricted bucket (`eu`) | $0 within free tier | Low |
| KV | Cannot be region-pinned | — | Accept (no PII) |
| Workers | Smart Placement / Regional Services | Paid for full DLS | Low |

**Realistic scope: a separate EU deployment**, not a region toggle. The current
architecture assumes one shared D1 and one shared Supabase project across
`cf-admin`, `cf-astro` and `cf-chatbot` — an EU tenant means a parallel stack
for all three, not a config flag. That is a genuine architectural decision and
should be costed as one before it is promised to anyone.

## 5. Global Privacy Control — scope and honest status

GPC (`Sec-GPC: 1`) is a legally binding "do not sell/share" signal under
CCPA/CPRA and Colorado law.

**What exists here (2026-07-25):** detection on every request via
`src/lib/security/gpc.ts`, exposed as `locals.gpc`, with tests asserting that
only the literal value `"1"` counts — so an arbitrary header value cannot
record an opt-out the user never asserted.

**What does NOT exist, and is not closed by the above:**

`cf-admin` is a staff-only portal behind Cloudflare Access. **No consumer
browser ever reaches it.** The users whose GPC signals legally matter arrive at
the public site, `cf-astro`. Therefore:

| Requirement | Where it must live | Status |
|---|---|---|
| Honour GPC for site visitors | `cf-astro` | ❌ Not implemented |
| "Do Not Sell or Share My Personal Information" link | `cf-astro` | ❌ Not implemented |
| Detection + durable evidence | `cf-admin` | ✅ Detection in place |

**G6 is therefore partially closed, not closed.** Anyone reading the gap
register should treat the consumer-facing half as an open `cf-astro` action.

The platform's substantive position is that it does not sell or share personal
data at all (see [`../PRIVACY.md`](../PRIVACY.md)), which means there is
nothing for GPC to switch off. Several state attorneys general nonetheless
treat "we don't sell data" as a claim that must be provably backed by technical
infrastructure rather than asserted in prose — which is why detection is worth
having even where there is nothing to opt out of.

## 6. Claimable vs not

**True today:**
- "All customer data is stored in US-region infrastructure operated by
  Cloudflare and Supabase."
- "Cross-border transfers rely on Standard Contractual Clauses in our
  sub-processors' data processing agreements."
- "We do not sell or share personal data with third parties."
- "We detect and record the Global Privacy Control signal."

**Not true — do not say:**
- "EU data residency available" (no EU deployment exists).
- "Data stored in your region" (single US region only).
- "Fully GPC compliant" (consumer-facing enforcement is a `cf-astro` gap).

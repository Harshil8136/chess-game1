---

title: "Data Residency & Cross-Border Transfers"
status: active
audience: [owner, operator, technical, ai]
last_verified: 2026-09-19
verified_against: [code, config]
owner: harshil
related_docs: [../RoPA.md, ../SECURITY.md, ISO-27017-27018.md, ../../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md]
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
[`../../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md).

## 1. Where data lives today

| Store | Provider | Region | Contains |
|---|---|---|---|
| D1 `madagascar-db` | Cloudflare | **US** (served from ENAM) | Audit log, page registry, login logs, booking state, email drafts and templates, blog posts, CMS content, SEO/GSC logs, platform alerts, staff-storage file metadata — 30 application tables |
| Postgres | Supabase | **US** | Users, ARCO tickets, consent records, bookings, email ledger |
| KV `ADMIN_SESSION` (binding `SESSION`) | Cloudflare | Globally distributed | Sessions, access maps |
| R2 `madagascar-images` | Cloudflare | **US** | CMS images, email attachments |
| R2 `madagascar-staff-storage` | Cloudflare | **US** | Staff drive files, incl. payroll/medical records — same jurisdiction and hosting posture as `madagascar-images`; no separate residency treatment |
| R2 `arco-documents` | Cloudflare | **US** | **ARCO identity documents** — written by `cf-astro` (binding `ARCO_DOCS`), not by `cf-admin`. The most sensitive category in the estate, and the reason this row exists |
| Queues | Cloudflare | US | Email payloads in transit |
| Workers | Cloudflare | Edge (global) | Compute only — no durable storage |

*Added 2026-09-19: `arco-documents`.* The live account holds **three** R2
buckets, which this document's own 2026-09-14 verification log recorded, but
the table listed two — a transcription gap, not a measurement gap. A residency
statement that omits the identity-document store is the omission a privacy
reviewer finds first. The table covers the whole estate; where a store is
written by a sibling repository rather than by `cf-admin`, the row says so.

*Row counts removed the same day.* The table used to end "~2,200 rows on
2026-09-14". A row total drifts daily and is not a residency fact — and it
moved sharply for the wrong reason: `admin_audit_log` fell from roughly a
thousand rows to single digits after a bulk delete on 2026-09-18. Table counts
stay; row counts belong in the verification log as dated snapshots.

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
| Upstash | SCCs | **Rate-limit keys derived from raw client IP or user id, short-TTL, no durable storage.** *(Corrected 2026-09-19: this said "hashed identifiers only". `hashIp()` is applied on the D1 write path, not before the Upstash key is built — `src/lib/ratelimit.ts` vs `src/lib/audit-helpers.ts`.)* |
| OpenRouter | Varies by model provider | Optional; staff prompts only, no customer PII. **Code-supported, not configured in production** — no API key on the Worker (2026-09-19) |
| Google | SCCs / adequacy per service terms | Search Console and PageSpeed Insights: site and page URLs, sitemap and index-coverage data — **no personal data**. Google is also one of the identity providers in front of Cloudflare Access, where it sees staff sign-in identity. *(Added 2026-09-19 to match `RoPA.md` §3.)* |

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
| D1 EU | **Jurisdiction `eu` at database creation** | $0 | Medium — new DB, migration |
| R2 EU | Jurisdiction-restricted bucket (`eu`) | $0 within free tier | Low |
| KV | Cannot be region-pinned | — | Accept (no PII) |
| Workers | Smart Placement / Regional Services | Paid for full DLS | Low |

*Corrected 2026-09-19 — the D1 row said "location hint".* A location hint is a
placement optimisation, not a residency control: a hinted database can still be
served from outside the hinted region. Residency is set by the **jurisdiction**
(`eu`) at creation time and cannot be changed afterwards. The R2 row below
already said this correctly; an operator following the old D1 row would have
created a hinted database and believed it was EU-resident.

**Realistic scope: a separate EU deployment**, not a region toggle. The current
architecture shares **one D1 (`madagascar-db`) between `cf-admin` and
`cf-astro`, with `cf-chatbot` on its own (`chatbot-kb`)**, and one Supabase
project across all three — an EU tenant means a parallel stack for all three,
not a config flag. *(Corrected 2026-09-19: this said "one shared D1 … across
`cf-admin`, `cf-astro` and `cf-chatbot`". There are three D1 databases in the
account; the Supabase half was right.)* That is a genuine architectural decision and
should be costed as one before it is promised to anyone.

## 5. Global Privacy Control — scope and honest status

GPC (`Sec-GPC: 1`) is a legally binding "do not sell/share" signal under
CCPA/CPRA and Colorado law.

**What exists here (2026-07-25, re-checked 2026-09-19):** detection on every
request via `src/lib/security/gpc.ts`, exposed as `locals.gpc`, with tests in
`test/csp.test.ts` asserting that only the literal value `"1"` counts — so an
arbitrary header value cannot record an opt-out the user never asserted.
**Detection is all that exists**: the signal is a per-request local, and no
code path persists it.

**What does NOT exist, and is not closed by the above:**

`cf-admin` is a staff-only portal behind Cloudflare Access. **No consumer
browser ever reaches it.** The users whose GPC signals legally matter arrive at
the public site, `cf-astro`. Therefore:

| Requirement | Where it must live | Status |
|---|---|---|
| Honour GPC for site visitors | `cf-astro` | ❌ Not implemented |
| "Do Not Sell or Share My Personal Information" link | `cf-astro` | ❌ Not implemented |
| Detect the GPC header on every request | `cf-admin` | ✅ In place — `src/lib/security/gpc.ts`, exposed as `locals.gpc` by `src/lib/security/csp.ts` |
| **Durable record of an asserted opt-out** | `cf-admin` | ❌ **Not implemented** *(corrected 2026-09-19)* — nothing writes the signal to the consent trail or anywhere else. `hasGpcSignal()` has exactly one caller, which sets a per-request local. The comment block in `gpc.ts` describing "a durable, queryable record in the consent trail" and "visibility in the admin Consent Trail tab" describes an intent, not shipped code |

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
- "We detect the Global Privacy Control signal on every request."
  *(Corrected 2026-09-19 — this read "detect **and record**". Nothing is
  recorded; see §5. Several state attorneys general treat the recorded opt-out
  as the evidence, so the difference is the one that matters.)*

**Not true — do not say:**
- "EU data residency available" (no EU deployment exists).
- "Data stored in your region" (single US region only).
- "Fully GPC compliant" (consumer-facing enforcement is a `cf-astro` gap).

## 7. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | §1 against the live account: `r2_buckets_list` → **three** buckets (`arco-documents`, `madagascar-images`, `madagascar-staff-storage`), so `arco-documents` was added; `wrangler.toml` KV block (namespace `ADMIN_SESSION`, binding `SESSION`) — the name `cf-admin-session` does not exist and was removed. §2 Upstash row against `src/lib/ratelimit.ts` (keys are the raw client IP on session-less routes such as `auth/logout`, and the user UUID elsewhere) and `src/lib/audit-helpers.ts` (`hashIp` is on the D1 write path); Google added to match `RoPA.md` §3; OpenRouter marked not-configured against `wrangler.toml` `[secrets] required`. §4 D1 residency mechanism (jurisdiction, not location hint) and the D1 topology (three databases). §5/§6 GPC against `src/lib/security/gpc.ts` and its single caller in `src/lib/security/csp.ts` — detection only, nothing persisted. **Dated snapshot:** D1 `madagascar-db` holds 30 application tables; `admin_audit_log` held 7 rows, oldest `2026-09-18 04:49:11` UTC. | The DPA filing status in §2 (an owner action); Supabase's actual region (still inferred from a connection string in `cf-astro`); §3's commercial assertions; §4's cost estimates |
| 2026-09-14 | §1 store list and regions against the live estate (Cloudflare MCP: D1 queries served from `ENAM`, three R2 buckets listed, KV global; Supabase `us-east-1` per the connection string in cf-astro's `wrangler.toml`); §2 sub-processor list against code (`api.brevo.com` in 13 files, `api.resend.com` in 1, PostHog in 10, `src/lib/sentry-scrub.ts` and `src/lib/security/gpc.ts` present, Upstash still on the request path, OpenRouter in `src/lib/ai/`); §5 GPC detection file present | The DPA filing status in §2 (an owner action), the commercial assessment in §3, and §4's cost estimates |

---

title: "Full-Spectrum Compliance & Certification Audit — Every Major Industry Standard, Scored, With a Sellability Roadmap"
status: active
audience: [owner, non-technical, technical, operator, ai]
last_verified: 2026-07-22
verified_against: [code, docs, config, web]
owner: harshil
related_docs: [2026-07-17-compliance-standing-and-market-positioning.md, 2026-06-16-business-viability-and-compliance-assessment.md, 2026-07-22-codebase-services-architecture-and-setup-review.md, security/SECURITY.md, security/PRIVACY.md, security/compliance/SOC2-TSC-mapping.md, security/compliance/CSA-CAIQ-v4.md, security/compliance/ASVS-L2.md, security/reviews/2026-07-17-full-platform-audit.md, MAINTENANCE.md]
tags: [compliance, certification, audit, soc2, iso27001, iso27701, iso42001, gdpr, ccpa, hipaa, pci-dss, wcag, ai-act, nist, csa-star, roadmap, scoring]
---

# Full-Spectrum Compliance & Certification Audit

> **Date:** 2026-07-22
> **Scope:** `cf-admin-madagascar` (the admin/CRM/CMS/control-plane application). Cross-references
> the sibling public site (`cf-astro`) only where a claim depends on it (e.g. cookie consent,
> bilingual notices — those live in the other repo).
> **Purpose:** Answer, exhaustively, "where do we stand on **every** compliance/certification
> framework a B2B buyer could plausibly ask for," with a scored, evidence-linked answer for each —
> not just the half-dozen frameworks prior reviews covered — plus a concrete, cost-and-effort-tagged
> roadmap to close the gaps that actually matter for winning more customers.
> **Method:** (1) Re-verified every internal compliance claim against the current codebase and the
> six existing compliance/security documents listed above — several of which were already updated
> as recently as five hours before this document, so this audit **starts from their conclusions**
> rather than re-deriving them from scratch. (2) Live web research (2026-07-22) to confirm
> fast-moving facts that are outside a training cutoff: current US state privacy-law count, EU AI
> Act phase-in dates, PCI DSS version status, ADA/WCAG litigation trend, and current SOC 2/ISO 27001
> market pricing — all cited with sources in §14. (3) Direct code/config inspection for every new
> claim not already covered by an existing doc (payment processing, health-data fields, accessibility
> markup, AI usage, data residency, marketing-email headers).
> **This document supersedes nothing** — it is additive. Where it disagrees with
> [`2026-07-17-compliance-standing-and-market-positioning.md`](2026-07-17-compliance-standing-and-market-positioning.md),
> that is because the 2026-07-22 architecture pass closed the #1 gap that doc flagged (see §5.1) —
> follow **this** document's numbers going forward; the 07-17 doc's per-standard commentary for
> anything not called out here (OWASP, market/vertical analysis) still stands.

---

## TL;DR (non-technical)

**You asked "where do we stand on ALL compliance — GDPR, SOC, CCPA, HIPAA, PCI, ISO, everything."**
Here is the honest, one-paragraph answer:

You are in genuinely strong shape on the frameworks you can control entirely with engineering
(OWASP, CSA STAR, NIST CSF, ISO code-quality) — **claimable today, at $0.** You're now **close**
on the ones that mix engineering with process (GDPR, CCPA, SOC 2 Type I) — the single biggest gap
(a working data-subject-rights workflow) **was closed in the last five days** and the remaining
work is mostly writing eight policy documents, which is $0 and about three weeks of focused effort.
You are **far** on the frameworks that require a third-party auditor and a multi-month observation
window no amount of code can shortcut (SOC 2 Type II, ISO 27001) — those are the two items worth
budgeting real money and calendar time for once you have 2–3 serious enterprise deals asking for
them. And you are **not applicable, by design** for three of your six named frameworks — **HIPAA**
(you don't store human health records), **PCI DSS** (you don't process card payments — Stripe
Checkout would keep you almost entirely out of PCI scope if you ever add payments), and most
sector-specific US laws (SOX, GLBA, FERPA, COPPA). None of that is a weakness; claiming them
would be a red flag to a real auditor. What's genuinely new in this pass, beyond the frameworks
already tracked: **ISO 27701** (privacy management — the natural GDPR-certification companion to
ISO 27001), **ISO 42001** and the **EU AI Act** (both now materially relevant because the platform
ships an AI chatbot and Workers AI email generation), and **WCAG/ADA accessibility** — a real,
currently-open gap and, per the litigation data in §7, one of the highest-frequency legal-exposure
areas for *any* SMB web platform in 2026, independent of whether you ever sell into a regulated
industry.

---

## 0. How to read this document

Two categories, carried forward from the 07-17 doc because they matter and get conflated constantly:

- 🟢🟡🔴 **Self-attestable / engineering-closeable** — you control the outcome. A high readiness %
  here means you can honestly claim it today and survive a buyer's security questionnaire or a
  pentest scan.
- 🔵 **Auditor-certified** — an *external, accredited* body must observe evidence, sometimes over
  months. No amount of code makes these instant; a high technical % only shortens the audit.
- ⚪ **Not applicable, in scope today** — the framework governs data/activity this platform does not
  have (cardholder data, PHI, securities filings, children's data). Listed anyway because "we
  checked and it doesn't apply, here's why" is itself a valuable, auditable answer for a buyer's
  security questionnaire — and three of these become **directly** relevant the moment you sell into
  verticals your own market-positioning doc already names (medical/dental clinics → HIPAA;
  memberships with saved cards → PCI).

**Percentages are self-assessed technical/process readiness, not third-party certifications.**
Nothing in this document should be repeated to a customer as "we are SOC 2 / ISO 27001 / HIPAA
certified" — none of those certifications currently exist for this platform. What you *can*
truthfully say today is in the "Claimable now" language in §12.

---

## 1. Executive summary — the headline scorecard

| Bucket | Frameworks | Where you stand |
|---|---|---|
| 🟢 **Claim today, $0** | OWASP ASVS L1/L2, OWASP Top 10, OWASP API Security Top 10, CSA STAR Level 1 (CAIQ), NIST CSF 2.0 mapping, CIS Controls v8 mapping, ISO/IEC 5055 & 25010 (code quality) | Strong technical control coverage + a completed, registry-ready self-attestation doc already exists for each |
| 🟡 **Close — weeks of writing, $0** | GDPR, CCPA/CPRA (+ the 20-state US patchwork), SOC 2 Type I readiness, ISO 27701 readiness, CAN-SPAM/CASL email compliance | Engineering is done or nearly done; the gap is 6–10 policy/process documents and a couple of small code additions (unsubscribe header, GPC signal) |
| 🔴 **Far — money + calendar time, not engineering** | SOC 2 Type II, ISO/IEC 27001, ISO 22301 (BCM), HITRUST, FedRAMP/StateRAMP, EU AI Act full conformity, ISO 42001 | Requires an accredited external auditor and, for several, a multi-month observation window |
| 🟠 **Real, open, underrated gap** | WCAG 2.2 AA / ADA Title III accessibility | Not previously tracked by any compliance doc in this repo; §7 shows this is *higher* current litigation frequency for SMB web platforms than most of the frameworks above |
| ⚪ **N/A today, by design** | HIPAA/HITECH, PCI DSS v4.0.1, GLBA, SOX, FERPA, COPPA, FCRA | The data/activity these laws govern doesn't exist in this platform yet — but three become live the moment your own named target verticals (medical clinics, saved-card billing) materialize |

**One-line answer to "what's our score":** engineering-controllable compliance ≈ **A− (90–95%
technical readiness)** across the board; audited/certified compliance ≈ **0 formal certifications
held today**, with a clear, cheap path to the first two (CSA STAR L1 registry listing, SOC 2 Type I)
inside 90 days if you choose to spend the writing time.

---

## 2. Scoring methodology

Each framework below is scored on four independent axes, then given a status tier. Not every axis
applies to every framework (a law doesn't have "third-party certification" in the way a standard
does) — where an axis is structurally N/A for that framework, it's marked and excluded from the tier
call rather than counted against the score.

| Axis | What it measures | Weight (where applicable) |
|---|---|---|
| **Technical Control Coverage** | Does the code/config actually implement what the framework requires? | 40% |
| **Documentation & Evidence** | Is there a written artifact an assessor could read (policy, mapping, runbook)? | 25% |
| **Operational Process Maturity** | Is the control *exercised* — reviewed, tested, drilled — not just present? | 20% |
| **Third-Party Validation** | Has an accredited external party actually verified it? | 15% |

Status tiers used throughout:

- 🟢 **Claimable now** — self-attest today; would survive a buyer questionnaire or automated scan.
- 🟡 **Close** — technical work is done or nearly done; gap is documentation/process, days–weeks.
- 🔴 **Far** — requires external audit and/or a multi-month observation window; not closeable by
  engineering alone.
- ⚪ **N/A** — the regulated activity/data class doesn't exist in this product today.

---

## 3. Master matrix — every framework in one table

Legend: **TR** = Technical Readiness (self-assessed %) · **Doc** = documentation exists (✅/🟡/❌) ·
**Proc** = operational process maturity (✅/🟡/❌) · **3P** = third-party validated (✅/❌/N/A) ·
**Effort** = time to close · **Cost** = $ to close (excludes any ongoing audit renewal fee).

### A. Universal security management & audit standards

| Framework | TR | Doc | Proc | 3P | Status | Effort | Cost |
|---|:---:|:---:|:---:|:---:|:---:|---|---|
| OWASP ASVS 4.0.3 L1 | 98% | ✅ | ✅ | N/A | 🟢 | Done | $0 |
| OWASP ASVS 4.0.3 L2 | 95% | ✅ | ✅ | N/A | 🟢 | Days | $0 |
| OWASP Top 10 (2021) | 95% | ✅ | ✅ | N/A | 🟢 | Done | $0 |
| OWASP API Security Top 10 (2023) | ~85% | ❌ | 🟡 | N/A | 🟡 | 1–2 weeks | $0 |
| SOC 1 Type I/II | N/A | ❌ | N/A | ❌ | ⚪ | — | — |
| SOC 2 Type I | ~85% | ✅ | 🟡 | ❌ | 🟡 | 3–5 weeks prep | $12k–$40k audit |
| SOC 2 Type II | ~75% | ✅ | 🟡 | ❌ | 🔴 | +6–12mo observation | $15k–$75k audit |
| SOC 3 (public summary) | — | ❌ | — | ❌ | 🔴 | After SOC2 Type II | +$3k–$10k |
| ISO/IEC 27001:2022 (ISMS) | ~60% | 🟡 | ❌ | ❌ | 🔴 | 4–9 months | $15k–$75k (3-yr cycle) |
| ISO/IEC 27002:2022 (control catalog) | ~65% | 🟡 | ❌ | N/A | 🟡 | Companion to 27001 | bundled |
| ISO/IEC 27017 (cloud security controls) | ~70% | ❌ | 🟡 | ❌ | 🟡 | 2–4 weeks doc | $0 (self) / bundled w/ 27001 audit |
| ISO/IEC 27018 (PII in public cloud) | ~75% | ❌ | 🟡 | ❌ | 🟡 | 2–4 weeks doc | $0 (self) / bundled |
| ISO/IEC 27701 (Privacy Info Mgmt System) | ~65% | ❌ | ❌ | ❌ | 🔴 | Extension of 27001; 2–4mo add-on | +$5k–$20k on top of 27001 |
| ISO 22301 (Business Continuity) | ~40% | ❌ | ❌ | ❌ | 🔴 | 3–6 months | $10k–$40k |
| ISO 9001 (Quality Mgmt System) | ~55% | 🟡 | 🟡 | ❌ | 🔴 | Low technical fit for a SaaS; rarely requested outside manufacturing/enterprise procurement | $8k–$25k if ever requested |
| ISO/IEC 5055 (code structural quality) | High | ✅ | ✅ | N/A | 🟢 | Done (benchmarked) | $0 |
| ISO/IEC 25010 (software quality model) | High | ✅ | ✅ | N/A | 🟢 | Done (benchmarked) | $0 |
| ISO/IEC 42001:2023 (AI Management System) | ~35% | ❌ | ❌ | ❌ | 🔴 | New standard; 2–5 months once you commit | $15k–$40k (emerging market) |
| NIST CSF 2.0 | 80% | ✅ | 🟡 | N/A | 🟢 | Done | $0 |
| NIST SP 800-53 Rev 5 | ~50% | ❌ | ❌ | N/A | 🔴 | Only relevant if pursuing FedRAMP | Large |
| NIST SP 800-171 / CMMC | N/A | ❌ | N/A | ❌ | ⚪ | Only if selling to US DoD supply chain | — |
| NIST AI RMF 1.0 | ~45% | ❌ | ❌ | N/A | 🟡 | Voluntary framework — self-map, 1–2 weeks | $0 |
| CIS Controls v8 (IG1/IG2) | ~80% | ✅ | 🟡 | N/A | 🟢 | Done | $0 |
| CSA STAR Level 1 (CAIQ v4) | 90% | ✅ | ✅ | N/A (self) | 🟢 | Submit to registry | $0 |
| CSA STAR Level 2 (3rd-party attested) | — | ❌ | ❌ | ❌ | 🔴 | Requires SOC2/ISO27001 first | Bundled with those audits |
| HITRUST CSF | N/A | ❌ | ❌ | ❌ | ⚪ | Healthcare-sector standard; only relevant if HIPAA becomes live (§8.1) | $30k–$100k+ |
| FedRAMP (Low/Mod/High) | N/A | ❌ | ❌ | ❌ | ⚪ | Only for US federal agency sales | $250k–$1M+ |
| StateRAMP / TX-RAMP | N/A | ❌ | ❌ | ❌ | ⚪ | Only for US state/local govt sales | Large |
| Cyber Essentials (UK) | ~85% | ❌ | 🟡 | ❌ | 🟡 | Self-assessment questionnaire, cheap 3rd-party check | £300–£500 |
| Cyber Essentials Plus (UK) | ~80% | ❌ | 🟡 | ❌ | 🟡 | Adds external technical audit | £1,500–£5,000 |
| C5 (Germany BSI cloud catalogue) | N/A | ❌ | ❌ | ❌ | ⚪ | Only relevant for German public-sector cloud sales | Large |

### B. Global privacy & data-protection law

| Regime | TR | Doc | Proc | Status | Effort | Notes |
|---|:---:|:---:|:---:|:---:|---|---|
| GDPR (EU/EEA) | 85% | ✅ | 🟡 | 🟡 | 2–3 weeks | See §5.1 — DSAR gap closed 2026-07-22 |
| UK GDPR + DPA 2018 | 82% | 🟡 | 🟡 | 🟡 | +1 week over GDPR | Needs UK representative if targeting UK buyers directly |
| CCPA/CPRA (California) | 83% | ✅ | 🟡 | 🟡 | 1–2 weeks | GPC signal handling still open (§5.2) |
| 20-state US patchwork (VA, CO, CT, UT, TX, OR, MT, DE, IA, NE, NH, NJ, TN, IN, KY, RI, + more) | ~78% | 🟡 | 🟡 | 🟡 | 2–3 weeks | Materially GDPR/CCPA-shaped; one unified US privacy notice covers ~90% of requirements (§5.2) |
| PIPEDA + Quebec Law 25 (Canada) | 80% | ❌ | 🟡 | 🟡 | 1–2 weeks | Needs a named Privacy Officer + Law 25 breach register |
| LGPD (Brazil) | 78% | ❌ | 🟡 | 🟡 | 1–2 weeks | GDPR-modeled; needs legal-basis mapping + encarregado (DPO) designation |
| POPIA (South Africa) | 75% | ❌ | 🟡 | 🟡 | 1–2 weeks | Same control family |
| APPI (Japan) | 72% | ❌ | ❌ | 🟡 | 2–3 weeks | Needs localized notice + cross-border transfer disclosure |
| PDPA (Singapore) | 78% | ❌ | 🟡 | 🟡 | 1–2 weeks | Same control family; DPO designation required |
| PDPA (Thailand) | 75% | ❌ | 🟡 | 🟡 | 1–2 weeks | Same |
| PIPL (China) | ~40% | ❌ | ❌ | 🔴 | Months | Strict data-localization + security-assessment regime; not closeable without an in-China deployment |
| Australia Privacy Act 1988 (+ 2024/25 amendments) | 78% | ❌ | 🟡 | 🟡 | 1–2 weeks | Same control family; new statutory tort for serious invasions of privacy since 2024 amendment |
| nFADP (Switzerland) | 80% | ❌ | 🟡 | 🟡 | 1–2 weeks | Same control family |
| LFPDPPP + LFPC (Mexico) | ~90% | ✅ | ✅ | 🟢 | Days | Already the most mature jurisdiction (see 06-16 doc §4) — only the LFPC Terms clause needs counsel review |

### C. Sector-specific regulation

| Regime | Applies today? | TR | Status | Notes |
|---|---|:---:|:---:|---|
| HIPAA / HITECH | **No** | N/A | ⚪ | No PHI stored. Becomes live if you sell to human medical/dental/physio clinics — your own stated target verticals (§8.1) |
| PCI DSS v4.0.1 | **No** | N/A | ⚪ | No cardholder data touches the platform (§8.2). Becomes live the moment card payments are added — but the *scope* of that exposure is a design choice you still control |
| GLBA (financial institutions) | **No** | N/A | ⚪ | Not a financial institution |
| SOX (public-company financial controls) | **No** | N/A | ⚪ | Not a public company; change-management discipline (CI gates, PR review) is directly reusable if that ever changes |
| FERPA (education records) | **No** | N/A | ⚪ | No student education records; relevant only if a "tutoring" vertical (already named in market doc) stores grades/attendance tied to a US school |
| COPPA (children under 13) | **No** | N/A | ⚪ | No child-directed service, no knowingly-collected children's data |
| FCRA (credit reporting) | **No** | N/A | ⚪ | No credit decisions made |
| CAN-SPAM Act (US commercial email) | **Yes** | ~75% | 🟡 | Real, open gap — no `List-Unsubscribe` header on bulk sends (§8.3) |
| CASL (Canada commercial electronic messages) | **Yes, if selling to CA** | ~60% | 🟡 | Stricter opt-in-by-default model than CAN-SPAM |
| TCPA (US telemarketing/SMS/calls) | **Conditional** | N/A today | ⚪→🟡 | Only relevant if/when SMS or WhatsApp is used for *marketing* rather than transactional messages |

### D. Accessibility

| Standard | Applies? | TR | Status | Notes |
|---|---|:---:|:---:|---|
| WCAG 2.2 Level AA | Yes (both apps) | ~55% | 🟠 | No formal audit ever run on this repo; ad-hoc `aria-*`/`role` usage present (83 files) but unverified (§7) |
| ADA Title III (US) | Yes | ~55% | 🟠 | Same underlying gap; highest current litigation frequency of any item in this document (§7) |
| Section 508 (US federal) | N/A | N/A | ⚪ | Only relevant for US federal agency sales |
| EN 301 549 / European Accessibility Act (in force June 2025) | If selling to EU | ~55% | 🟠 | Same technical gap; now a hard legal requirement for EU digital services, not just best practice |

### E. AI governance (new category — relevant because of the chatbot + Workers AI)

| Framework | Applies? | TR | Status | Notes |
|---|---|:---:|:---:|---|
| EU AI Act | If selling to EU / AI features touch EU users | ~50% | 🟡 | Chatbot likely "limited risk" tier → transparency obligations only (§9.1); GPAI obligations already in force since Aug 2025 for any *provider* of a foundation model — you're a *deployer*, not a provider, which is the less-burdened role |
| ISO/IEC 42001 | Optional, growing enterprise ask | ~35% | 🔴 | See §9.2 — a genuinely new, fast-growing enterprise vendor-selection bar in 2026 |
| NIST AI RMF 1.0 | Optional, US-market signal | ~45% | 🟡 | Voluntary, self-mappable, $0 |

---

## 4. Security management & audit frameworks — detail

### 4.1 SOC 2 (Type I / Type II) and SOC 1 / SOC 3

Fully mapped already in [`SOC2-TSC-mapping.md`](security/compliance/SOC2-TSC-mapping.md) — every
Common Criteria (CC1–CC9) plus partial Availability and Confidentiality criteria. That mapping's
gap list (competent-individuals documentation, DR tabletop, IR drills, SBOM, OpenAPI schema) is
still the accurate punch list for Type I readiness; nothing in the last five days' code changes
affects it materially, **except** that the SOC2 Confidentiality criterion (C1.2 "disposes of
confidential information") is now measurably stronger — the manual retention-purge tool (§5.1)
is a direct, auditable answer to "how do you dispose of data past its useful life," where before
it was a documented gap.

**SOC 1** governs financial-reporting internal controls (ICFR) for services that affect a
customer's financial statements — this platform doesn't process financial transactions on behalf
of customers today, so SOC 1 is not applicable. **SOC 3** is simply the public-facing, evidence-free
summary report of a SOC 2 — cheap to add ($3k–$10k) once you've done the real SOC 2 Type II audit,
useful only as a marketing artifact (it can be published on a website; SOC 2 reports cannot).

**2026 market reality (researched, §14):** most B2B SaaS buyers — 85% of mid-market, 98% of
Fortune 500 — require Type II specifically, not Type I. Doing Type I first is common but means
paying for two audits instead of one if a Type II deal ever appears; a defensible strategy is:
prepare to Type I readiness (cheap, fast), but hold off engaging an auditor until you have a
specific deal that needs the report, then negotiate straight into a Type II engagement's
observation window.

### 4.2 ISO/IEC 27001:2022 & 27002:2022

Requires a full Information Security Management System (ISMS): a documented risk-assessment
methodology, a Statement of Applicability across all 93 Annex A controls (2022 revision), management
review cadence, an internal-audit program, and a corrective-action process — then a two-stage
external certification audit (Stage 1 documentation review, Stage 2 on-site/remote evidence
review), repeated annually as a surveillance audit for 3 years. The **technical controls already
map well** (access control, cryptography, logging, supplier relationships, incident management are
all evidenced in `SECURITY.md`) — the gap is entirely the *management system layer*: risk register,
SoA, internal audit calendar, management-review minutes. This is the single most labor-intensive
item in this entire document that isn't gated purely by calendar time (SOC 2 Type II is gated by
time; ISO 27001 is gated by *documentation volume*).

**Researched 2026 cost (§14):** $15k–$75k across the 3-year cycle; small orgs report ~$15k for
initial certification. Timeline 4–9 months from a standing start.

### 4.3–4.5 ISO/IEC 27017, 27018, 27701 — the three companion standards nobody mentioned yet

These three are extensions of 27001/27002 and are **specifically relevant to this platform's
profile** (a cloud-hosted service processing customer PII) in a way generic "ISO 27001" framing
undersells:

- **ISO/IEC 27017** — cloud-specific security controls (shared responsibility clarity between
  Cloudflare/Supabase as infrastructure providers and this platform as the service operator). The
  existing `CONTROL-PLANE-CONNECTORS.md` and vendor DPA references already document most of this
  informally; formalizing it is a documentation exercise, not new engineering.
- **ISO/IEC 27018** — code of practice for protecting PII in public clouds acting as a processor.
  Directly on-point: this platform *is* a processor of customer PII running on public cloud
  infrastructure. The RLS/encryption/access-control technical story is already strong (§ SECURITY.md
  §10); the gap is a formal processor-obligations statement.
- **ISO/IEC 27701** — the actual **"ISO GDPR certification"** most buyers mean when they say that
  phrase informally (GDPR itself has no ISO certification; 27701 is the closest recognized
  standard, extending an ISMS into a full Privacy Information Management System). It requires
  27001 as a prerequisite, so realistically this is a same-project add-on once 27001 is pursued,
  not a separate initiative — budget it as **+$5k–$20k on top of a 27001 engagement**, not as a
  standalone $50k project.

**Recommendation:** if/when ISO 27001 is pursued, scope 27017 + 27018 + 27701 into the *same*
Statement of Applicability from day one — the marginal cost is far lower than doing them later as
separate engagements, and "ISO 27001 + 27701 certified, cloud-native" is a materially stronger
sales sentence than "ISO 27001 certified" alone for any buyer that cares about GDPR.

### 4.6 ISO 22301 — Business Continuity Management

This is the formal standard behind what `SOC2-TSC-mapping.md` already flags as a gap (A1.3 recovery
testing) and what the 07-17 full-platform audit calls O6 (no tested DR/backup restore runbook).
Full ISO 22301 certification is a 🔴 far item (3–6 months, external audit) — but the **underlying
control** (a written, *tested* disaster-recovery runbook with a documented RTO/RPO) is a $0,
days-of-effort item that is worth doing regardless of whether the ISO certification is ever pursued,
because it's also a prerequisite for SOC 2 A1.3 and a direct sales-questionnaire answer
("what's your RPO/RTO"). See the roadmap in §10.1 — this is one of the highest-leverage cheap wins
in the entire document.

### 4.7 ISO 9001 — Quality Management System

Included for completeness since the user asked for "all possible" standards, but it's a poor fit:
9001 governs manufacturing/service *quality management processes* broadly (customer satisfaction,
document control, supplier evaluation) and is rarely requested by SaaS buyers outside regulated
manufacturing, aerospace, or government-adjacent procurement. **Recommendation: do not pursue**
unless a specific deal explicitly requires it. The change-management and documentation-governance
discipline already in this codebase (CI-enforced doc front-matter, PR review, the `docs_check.py`
index-drift guard) would satisfy most of 9001's *document-control* clause incidentally, but that's
not worth a formal certification on its own.

### 4.8–4.9 ISO/IEC 5055, 25010 (recap) and ISO/IEC 42001 (new)

5055 (structural code quality) and 25010 (software quality characteristics) are already benchmarked
in [`2026-06-18-system-review-and-iso5055-benchmark.md`](2026-06-18-system-review-and-iso5055-benchmark.md)
— self-reportable today at $0.

**ISO/IEC 42001:2023** is new to this document and matters now for a concrete reason: this platform
ships an AI chatbot (`cf-chatbot`, proxied via `api/chatbot/[...path]`) and Workers-AI-backed
email generation (`api/emails/ai-generate.ts`). ISO 42001 is the first international AI-management-
system standard, and per researched 2026 market data (§14), **Fortune 500 buyers are increasingly
requiring vendors to hold it or show a roadmap toward it** — this is a fast-emerging procurement
gate, not a theoretical one. Current readiness (~35%) reflects that AI-specific governance
(bias testing, explainability documentation, human-oversight controls, AI risk register) doesn't
exist as a distinct discipline in this codebase yet, even though the underlying engineering
(the chatbot's RBAC gating, the pricing/usage dashboards) is solid. **This sits in the "pursue only
when a specific enterprise deal requires it" bucket** (🔴, §10.4) rather than the near-term roadmap
— but flag it now because building AI governance documentation *retroactively* under deal pressure
is materially more expensive than building it once, early, as the chatbot feature set grows.

### 4.10–4.13 NIST CSF 2.0, SP 800-53, SP 800-171/CMMC, AI RMF

**NIST CSF 2.0** — already self-mappable at ~80% (07-17 doc). **NIST SP 800-53 Rev 5** is the
detailed federal control catalog that underlies FedRAMP; only relevant if pursuing federal sales —
skip unless that becomes a real target. **NIST SP 800-171 / CMMC** governs Controlled Unclassified
Information for the US defense industrial base — not applicable, no plausible near-term relevance
for a pet-hospitality/SMB-vertical product.

**NIST AI RMF 1.0** is worth a note distinct from ISO 42001: it's a **free, voluntary, US-government
framework** (not a paid certification) with four functions — Govern, Map, Measure, Manage — that can
be self-mapped in the same spirit as the existing NIST CSF doc. Given the AI surface area growing
(chatbot + email AI-generation), producing a one-page NIST AI RMF self-map is a $0, 1–2 week item
that materially strengthens the AI-governance story ahead of any EU AI Act or ISO 42001 conversation
— **recommended as a near-term (Phase 1) item**, unlike ISO 42001 itself.

### 4.14 CIS Controls v8

Already self-assessed at ~80% (07-17 doc, Implementation Group 1/2 alignment). No change this pass.

### 4.15–4.16 CSA STAR (L1 done, L2 gated) and HITRUST

CSA STAR **Level 1** (the completed CAIQ v4 doc) is registry-submittable today at $0 — genuinely
one of the highest ROI-per-hour items available; if it hasn't been submitted to the public CSA STAR
registry yet, that's the single fastest "new trust badge" available (see §10.1). **Level 2**
requires a third-party attestation and is typically bundled with a SOC 2 or ISO 27001 engagement —
not a separate initiative.

**HITRUST CSF** is the healthcare-sector security framework many hospital systems and health-tech
buyers require as a SOC 2/ISO 27001 substitute or supplement. Not applicable today (no PHI) — but
flagged because it becomes the *natural next question* the moment a medical or dental clinic
vertical (already named in the market-positioning doc) becomes a real customer segment, alongside
HIPAA itself (§8.1).

### 4.17 Cyber Essentials / Cyber Essentials Plus (UK)

Genuinely underrated for how cheap and fast this is: **Cyber Essentials** is a self-assessment
questionnaire reviewed by an approved certification body for roughly £300–£500, turnaround days,
not months. **Cyber Essentials Plus** adds an external technical verification (vulnerability scan +
some on-site/remote checks) for £1,500–£5,000. For a platform this technically mature, both would
likely pass on the first attempt. This is a strong, cheap trust signal *specifically* for UK-market
buyers (public sector and UK enterprise increasingly require it as a baseline) and is not currently
tracked anywhere in this repo's compliance documentation. **Recommended as a Phase 2 item** if UK
sales become a target (§10.3).

### 4.18 OWASP ASVS / Top 10 / API Security Top 10

ASVS L1/L2 and Top 10 (2021) numbers are carried forward unchanged from the 07-17 full-platform
audit — still accurate; no material code change since then affects these scores. **New this pass:
OWASP API Security Top 10 (2023)**, which matters distinctly from the general Top 10 because this
platform's surface area is now dominated by API routes (84 API handler files per the 07-22
architecture review, §3.4 there). Quick self-check against the 2023 list:

| API1:2023 Broken Object Level Authorization | 🟡 | PLAC + role gates are strong but self-guarded per-route (the O1 finding from the 07-17 audit — fail-closed default is still on the roadmap) |
| API2:2023 Broken Authentication | ✅ | CF Zero Trust + JWT verification |
| API3:2023 Broken Object Property Level Authorization | 🟡 | Zod coverage is partial (O4 from 07-17 audit) |
| API4:2023 Unrestricted Resource Consumption | ✅ | Upstash rate limiting on sensitive routes |
| API5:2023 Broken Function Level Authorization | ✅ | RBAC hierarchy + PLAC |
| API6:2023 Unrestricted Access to Sensitive Business Flows | 🟡 | No formal business-flow abuse-case review has been done |
| API7:2023 Server-Side Request Forgery | ✅ | No user-controlled outbound fetch |
| API8:2023 Security Misconfiguration | 🟡 | Residual CSP `unsafe-inline` (blocked on operator action per `MAINTENANCE.md`) |
| API9:2023 Improper Inventory Management | 🟡 | No OpenAPI schema exists (also flagged by `SOC2-TSC-mapping.md`'s IPY-02) |
| API10:2023 Unsafe Consumption of APIs | ✅ | All 8 analytics providers have `AbortSignal.timeout()` |

**Net: ~85%.** Producing an OpenAPI schema (zod → OpenAPI, already recommended by the SOC 2 gap
list) would close both the SOC2 IPY-02 gap and the API9 gap in one artifact — a good candidate for
the roadmap (§10.2).

---

## 5. Global privacy & data-protection law — detail

### 5.1 GDPR — the headline update this document makes

The 07-17 compliance doc scored GDPR at ~80% and flagged, as the **#1 blocking gap**: *"admin
workflow to fulfill erasure/access (DSAR) — the `privacy_requests`/`legal_requests` tables are
captured but unused in the admin app."*

**That gap closed on 2026-07-22**, the same day as this document, per the independently-verified
[`2026-07-22-codebase-services-architecture-and-setup-review.md`](2026-07-22-codebase-services-architecture-and-setup-review.md)
§5.3: a full ARCO request queue (`/dashboard/arco`) now exists with ticket numbers,
Acceso/Rectificación/Cancelación/Oposición workflow states, **SLA deadline tracking**
(`decisionDeadline`, `finalDeadline`, overdue/due-soon flags), and a paired manual retention-purge
tool (`/dashboard/retention`) with a hard code-level invariant that open ARCO tickets can never be
purged. This directly satisfies GDPR Articles 15–17 (access/rectification/erasure) at the
*mechanism* level — the remaining gap is narrower than before:

| Article | Status | Remaining gap |
|---|:---:|---|
| Art. 5 (minimization/storage limitation) | 🟡 | Retention is now human-gated and audited (a *stronger* answer than a silent cron, per the architecture review's own framing) but still not automatic — acceptable, document the policy rationale explicitly in a short retention-policy doc |
| Art. 15–17 (access/rectification/erasure) | 🟢 (upgraded from 🟡) | ARCO queue is live; the only remaining work is verifying the SLA-deadline math has test coverage (currently untested — flagged in the 07-22 review's test-coverage gap, §2.3 there) |
| Art. 25 (privacy by design) | ✅ | `sendDefaultPii:false`, HMAC IP hashing, consent forensics dashboard, PII scrubber in Sentry pipeline (F3 from the 07-17 audit) |
| Art. 30 (RoPA) | 🟡 | Still no standalone Record of Processing Activities document — this is a **half-day writing task**, not engineering; the schema/data flows to describe already exist and are documented piecemeal across `PRIVACY.md` and `SECURITY.md` §10 |
| Art. 32 (security of processing) | ✅ | Encryption in transit/at rest, RLS, access control, audit trail, resilience |
| Art. 33 (72h breach notification) | ❌ | Still the single largest true gap — no breach-notification runbook exists anywhere in `documentation/runbooks/` (verified: 4 runbooks exist, none cover incident response or breach notification) |

**Revised score: GDPR ≈ 85%** (up from 80%), status 🟡 Close. Closing Art. 30 (RoPA) and Art. 33
(breach runbook) — both $0, days-of-writing items — would push this to 🟢 territory.

### 5.2 CCPA/CPRA and the wider US state patchwork

Researched fact (§14): **as of 2026, 19–21 US states have comprehensive consumer privacy laws in
effect** (California, Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana, Delaware, Iowa,
Nebraska, New Hampshire, New Jersey, Tennessee, Minnesota, Maryland, Rhode Island, Kentucky, Indiana,
plus Alabama newly enacted) — a materially larger patchwork than the single-state framing most SMB
compliance docs use. Nearly all of these laws share the GDPR-CCPA control family (notice, access,
deletion, opt-out-of-sale, data-minimization), so the *marginal* engineering cost of covering all
20+ versus just California is low — the same ARCO-style DSAR queue and the same privacy-notice
infrastructure serve them all. The differentiated requirements are legal-text nuances (exact notice
language, specific timelines — most are 45 days, matching CCPA) more than new mechanisms.

Two genuine, still-open technical gaps specific to this family of laws:

1. **Global Privacy Control (GPC) signal handling** — CCPA/CPRA (and Colorado's law) require
   honoring the browser-sent GPC opt-out signal as a valid "Do Not Sell/Share" request. Verified:
   no GPC handling exists in this codebase. The public privacy page (`src/pages/privacy.astro:54`)
   already states *"We do not sell, rent, or share your data with any third parties... under any
   circumstances"* — which, if durably true, actually makes the GPC gap low-risk (nothing to opt
   out *of*), but the honest fix is still to add the signal-detection + acknowledgment flow, because
   several state AGs (California's among them) treat "we don't sell data" as a claim that must be
   *provably* backed by technical non-sale infrastructure, not just a policy statement.
2. **"Do Not Sell/Share" position document** — the privacy page's prose statement is a good start
   but isn't the formal CCPA-required "Do Not Sell or Share My Personal Information" mechanism/link
   pattern. A short, dedicated compliance note plus (if audited) evidence that no sub-processor
   contract permits resale would close this.

**Score: CCPA/CPRA ≈ 83%, broader 20-state patchwork ≈ 78%.** Both 🟡 Close.

### 5.3–5.5 Rest of world

Canada (PIPEDA + Quebec Law 25), Brazil (LGPD), South Africa (POPIA), Japan (APPI), Singapore/
Thailand (PDPA), Australia (Privacy Act 1988 + 2024 amendments), and Switzerland (nFADP) all share
the same underlying "GDPR-grade engineering, jurisdiction-specific paperwork missing" pattern
already documented in depth in
[`2026-06-16-business-viability-and-compliance-assessment.md`](2026-06-16-business-viability-and-compliance-assessment.md)
§4 — that analysis (control families present, localized notice/DPO/representative/breach-process
paperwork absent) is still accurate and is not repeated in full here. Two updates worth flagging:

- **China's PIPL** is meaningfully *harder* than the GDPR-family laws — it requires data
  localization and a formal security assessment for cross-border transfer above certain thresholds.
  This is not closeable by policy writing; it would require an in-China deployment. Scored
  separately (🔴, ~40%) rather than lumped with the GDPR-family group, to avoid overstating
  readiness.
- **Australia's Privacy Act** gained a new statutory tort for serious invasions of privacy via a
  2024/2025 amendment — worth a line in any future Australia-specific legal review, but doesn't
  change the technical-control story.
- **Mexico (LFPDPPP + LFPC)** remains the most mature jurisdiction by a wide margin (~90%, 🟢) per
  the existing 06-16 analysis — this platform's *only* fully, defensibly compliant jurisdiction
  today, pending the one flagged LFPC Terms-clause counsel review.

---

## 6. Sector-specific regulation — scoped and mostly N/A (with real roadmap triggers)

### 6.1 HIPAA / HITECH

**Not applicable today.** Verified by code search: no PHI fields (patient diagnoses, treatment
records, human medical history) exist anywhere in the schema. The one grep hit for "vaccin*" is in
a legacy admin-page-label seed migration (pet vaccination *requirement copy* for the booking flow —
operationally about pet boarding policy, not a stored health record, and pets are not "individuals"
under HIPAA's definition regardless).

**Important nuance for the roadmap:** your own market-positioning documents
(`2026-06-16-business-viability-and-compliance-assessment.md` §2.3, §5) explicitly name **dental
clinics, physiotherapy, and medical-adjacent verticals** as target expansion markets for a
productized version of this platform. The moment a customer in one of those verticals stores any
patient health information in a booking/CRM record, HIPAA becomes live — and note that **there is
no such thing as "HIPAA certified"** (a common myth; HHS doesn't certify products) — what a health
vertical requires instead is: (1) a signed **Business Associate Agreement (BAA)** between you and
each covered-entity customer, (2) BAAs *you* hold with your own sub-processors — **both Cloudflare
and Supabase offer BAAs on their paid/enterprise tiers**, which is a genuinely favorable fact for
this stack if that vertical is pursued, and (3) the HIPAA Security Rule's administrative/physical/
technical safeguards, most of which overlap heavily with what's already built (access control,
audit logging, encryption). **Recommendation: do not build HIPAA-specific controls speculatively —
but if a clinic-vertical deal becomes real, the lift is smaller than it looks (BAA paperwork +
formalizing existing controls into a HIPAA-shaped policy set), not a rebuild.**

### 6.2 PCI DSS v4.0.1

**Not applicable today.** Verified: no `stripe`, no card-number fields, no `payment_intent`
patterns anywhere in `src/`. PCI DSS v4.0.1 is, per researched 2026 fact (§14), now the **only**
active version (v3.2.1 retired March 2024, v4.0 retired December 2024; all 51 previously
future-dated requirements became mandatory March 2025) — so any future scope claim must target
v4.0.1 directly, not the older, more lenient v3.2.1 baseline still referenced in some older
tutorials.

**Roadmap-relevant design note:** if/when payments are added (a plausible next feature for a
booking platform — deposits, no-show fees), the PCI scope is almost entirely a *choice*: routing
card capture through a fully-hosted third-party page (Stripe Checkout, or equivalent) so **card
data never touches this platform's servers** keeps the merchant at **SAQ A** — the lightest PCI
self-assessment tier, essentially a short attestation questionnaire with no external audit
required for most SMB transaction volumes. Building any custom card-entry UI, even one that just
proxies to a processor's API, jumps the scope to SAQ A-EP or D (external audit, meaningfully more
expensive). **This is worth deciding explicitly, in the architecture, before payments are built —**
not after.

### 6.3 GLBA / SOX / FERPA / FCRA

All not applicable — no financial-institution activity, not a public company, no US student
education records tied to a school, no credit decisioning. FERPA has the same "becomes live if a
tutoring-vertical customer stores grades" trigger pattern as HIPAA's clinic trigger — flagged for
awareness, not action.

### 6.4 COPPA

Not applicable — no service or feature is directed at children under 13, and no age-gating bypass
exists that would knowingly collect a child's data. No action needed unless the product roadmap
ever adds a child-facing feature.

### 6.5 CAN-SPAM, CASL, TCPA — the one sector-specific area with a real, live gap

Unlike the frameworks above, **commercial email regulation applies today** — the platform sends
transactional and marketing email via both Resend and Brevo. Verified gaps (consistent with O7 in
the 07-17 full-platform audit, still open as of this pass):

- **No `List-Unsubscribe` header** on tracked (open/click-tracked) bulk sends. CAN-SPAM requires an
  honored opt-out mechanism within 10 business days; the *absence* of a one-click unsubscribe header
  is increasingly treated by major mailbox providers (Gmail, Yahoo) as a **deliverability** problem
  independent of legal risk — bulk senders without `List-Unsubscribe: One-Click` since 2024 see
  material inbox-placement penalties. This is simultaneously a compliance gap and a business
  problem.
- **CASL (Canada)** is meaningfully stricter than CAN-SPAM: it requires *opt-in* consent before the
  first commercial message, not opt-out after. If any Canadian recipients are on marketing lists,
  this needs an explicit consent-capture step distinct from the existing consent-forensics system
  (which is built for *website* cookie consent, not *email* consent).
- **TCPA** (SMS/calls) is not currently triggered — no SMS/voice marketing exists in this codebase
  today — but the WhatsApp integration named in the market-positioning doc as a future "AI concierge
  upsell" would trigger TCPA-style consent requirements the moment it's used for anything beyond
  transactional booking confirmations.

**This is one of the cheapest, highest-ROI items in the entire roadmap** — a `List-Unsubscribe`
header + a suppression-list check before enqueue is a single-day engineering task (§10.1).

---

## 7. Accessibility — the gap no prior compliance doc in this repo has tracked

None of the six existing compliance/security documents in this repository mention WCAG, ADA, or
accessibility as a compliance category. This is a real gap in the compliance *program*, not just
in the *product* — and the researched 2026 litigation data (§14) suggests it deserves higher
priority than its previous invisibility implies:

- **Over 5,000 federal and state website-accessibility lawsuits were filed in the US in 2025**;
  federal filings alone surged 27% year-over-year to 3,117 cases.
- **64% of these lawsuits targeted companies with under $25M in annual revenue** — this is
  specifically an SMB-targeting litigation pattern, not a large-enterprise problem, which matters
  directly for this platform's stated target market (SMB pet-care, clinics, salons, gyms).
- **There is no small-business exemption under ADA Title III.**
- Courts in 2026 generally expect **WCAG 2.1 or 2.2 Level AA** conformance; the DOJ's own rule
  (for public-sector Title II) codifies WCAG 2.1 AA specifically. Building to 2.2 AA gets 2.1 AA
  "for free" (2.2 is a superset) and is the more future-proof target.
- **Accessibility overlay widgets do not provide legal protection** — the FTC fined a major overlay
  vendor $1M in 2025 for misrepresenting guaranteed compliance, and 22.6% of sued sites already had
  an overlay installed at the time of suit. Any accessibility roadmap item should mean genuine
  code-level remediation, not a bolt-on widget.
- The **European Accessibility Act** (in force since June 2025) makes WCAG-equivalent conformance
  (via EN 301 549) a hard legal requirement for digital services sold into the EU — this converts
  "best practice" into "compliance requirement" the moment EU sales are pursued.

**Current state:** 83 files in `src/components/` contain some `aria-*`/`role` markup — a sign that
accessibility wasn't ignored during development, but this is informal coverage, not a verified
conformance level. No automated accessibility testing tool (axe-core, Pa11y, Lighthouse CI) is
wired into the test suite or CI pipeline (verified: no such dependency in `package.json`, no
Lighthouse/axe references in `.github/workflows/`).

**Recommendation (§10.2):** run an automated `axe-core`/Pa11y scan against both the public
booking site (higher legal exposure — public-facing, unauthenticated, consumer-facing) and this
admin portal (lower exposure — authenticated staff tool, but still in scope for any employee with
a disability under separate ADA Title I employment provisions), fix the highest-severity findings,
then wire the scanner into CI as a regression gate. This is a $0–$3k, days-to-weeks item — cheap
relative to its litigation-frequency profile, and arguably **higher near-term legal-exposure ROI
than SOC 2 or ISO 27001**, which are buyer-requested rather than plaintiff-triggered.

---

## 8. AI governance — a new category, live because of the chatbot

### 8.1 Where the platform's AI usage actually sits, risk-wise

Two AI surfaces exist today (verified in code): the `cf-chatbot` Worker (proxied via
`api/chatbot/[...path]`, RBAC-gated) and Workers-AI-backed email draft generation
(`api/emails/ai-generate.ts`). Under the EU AI Act's risk tiers, a customer-support/booking-assistant
chatbot most plausibly sits in the **"limited risk"** tier (Article 50 transparency obligations —
users must be told they're interacting with an AI system) rather than "high-risk" (which covers
things like biometric ID, credit scoring, employment decisions — none of which this platform does).
Critically, this platform is a **deployer**, not a **provider**, of the underlying foundation models
(Cloudflare Workers AI, and whatever model the `cf-chatbot` calls) — deployer obligations are
lighter than provider obligations under the Act.

**Researched timeline (§14):** GPAI *provider* obligations have applied since **August 2, 2025**
(not directly this platform's burden, since it's a deployer). The next major milestone is
**August 2, 2026** — high-risk system rules (Annex III) and the Article 50 transparency
requirement both come into force. Since this platform is very unlikely to be "high-risk," the
practically relevant date is the transparency requirement: **make sure the chatbot UI already
discloses it's an AI assistant** — verify this is genuinely user-facing (not just documented) before
August 2026 if any EU users interact with it.

### 8.2 ISO 42001 and 8.3 NIST AI RMF

Covered in §4.9 and §4.10 above respectively — repeated here only to flag the connection: an EU
AI Act transparency check (§8.1, cheap, near-term) and a NIST AI RMF self-map (§4.13, cheap,
near-term) are both good precursors to a later ISO 42001 push (§4.9, expensive, situational) —
do the cheap items now regardless of whether the expensive certification is ever pursued.

---

## 9. Consolidated gap register — every open item, one list, deduplicated across all source docs

| ID | Gap | Frameworks affected | Effort | Cost | Status |
|---|---|---|---|---|---|
| G1 | No 72h/GDPR-style breach-notification runbook | GDPR Art.33, SOC2 CC7, ISO 27001/27701, all US state laws | 2–3 days | $0 | Open |
| G2 | No formal Record of Processing Activities (RoPA) | GDPR Art.30, ISO 27701 | 1–2 days | $0 | Open |
| G3 | No tested disaster-recovery/backup-restore runbook | SOC2 A1.3, ISO 22301 | 3–5 days | $0 (D1 Time Travel free) / ~$25/mo optional Supabase PITR | Open |
| G4 | No incident-response runbook / drill cadence | SOC2 CC7, ISO 27001, CSA STAR SEF-04 | 3–5 days | $0 | Open |
| G5 | No `List-Unsubscribe` header / email suppression list | CAN-SPAM, CASL, deliverability | 1 day | $0 | Open |
| G6 | No GPC signal handling | CCPA/CPRA, Colorado law | 2–3 days | $0 | Open |
| G7 | API middleware doesn't fail-closed by default (every `/api/*` route self-guards) | OWASP ASVS V4, Top10 A01, API Top10 API1 | ~1 week | $0 | Open (O1 in 07-17 audit) |
| G8 | No formal threat model / DFD | OWASP ASVS V1, Top10 A04 | 3–5 days | $0 | Open |
| G9 | No WCAG/ADA accessibility audit or CI scanner | WCAG 2.2 AA, ADA Title III, EN 301 549 | 1–3 weeks | $0–$3k | Open — **newly tracked this pass** |
| G10 | No OpenAPI schema | SOC2 IPY-02, API Top10 API9 | 3–5 days | $0 | Open |
| G11 | No SBOM emitted in CI | SOC2 STA-03, ISO 27001 supply-chain | 1 day | $0 | Open |
| G12 | No external penetration test ever engaged | SOC2 TVM-03, ISO 27001, CSA STAR L2 | 1 engagement | ~$5k (small scope) | Open |
| G13 | `npm audit` CI gate non-blocking (`|| true`) | Top10 A06/A08, SOC2 CC8 | Hours | $0 | Open |
| G14 | No prod/staging environment separation | ASVS V14, SOC2 CC8 | Days | $0 (free-tier D1/KV) | Open |
| G15 | No formal AI governance doc (bias/oversight/risk register) | ISO 42001, NIST AI RMF, EU AI Act | 1–2 weeks | $0 | Open — **newly tracked this pass** |
| G16 | No EU AI Act transparency-disclosure verification in chatbot UI | EU AI Act Art.50 | Hours–1 day | $0 | Open — **newly tracked this pass** |
| G17 | No data-residency/region pinning (single US region for D1 + Supabase) | GDPR/UK GDPR residency-sensitive buyers, ISO 27018 | Architectural | $0 (Cloudflare/Supabase both support EU regions) | Open |
| G18 | ARCO SLA-deadline math and retention-purge safety invariants have zero test coverage | GDPR Art.15-17 evidentiary strength | 3–5 days | $0 | Open — **newly tracked this pass**, surfaced by 07-22 review §2.3 |

Items resolved since the 07-17 audit (do not re-open): DSAR/erasure admin workflow (closed via
ARCO queue), manual retention-purge tool (closed, by policy design rather than automation), fail-
closed CSP nonce partial hardening, SEC-03/SEC-04 rule violations (26+12 → 0), Sentry PII scrubber,
weak IP-hash unification.

---

## 10. Roadmap — phased, cost-and-effort-tagged

### 10.1 Phase 0 — next 1–2 weeks, $0 (do these regardless of any sales motion)

1. **G5** — Add `List-Unsubscribe` header + suppression-list check to bulk email sends. Cheapest,
   highest-leverage item in the document (compliance *and* deliverability).
2. **G1 + G4** — Write `runbooks/incident-response.md` (incl. the GDPR 72h breach flow) using the
   existing `documentation/_templates`. One document covers both gaps.
2b. **G2** — Write a one-page RoPA. The data flows to describe already exist, scattered across
   `PRIVACY.md` and `SECURITY.md` §10 — this is a synthesis task, not new research.
3. **G3** — Write and **actually run once** a DR tabletop: D1 point-in-time recovery via
   `wrangler d1 time-travel`, R2 listing/export, KV export, Supabase restore. Record real RTO/RPO
   numbers, not estimates.
4. **G13** — Remove `|| true` from the `npm-audit` CI step; flip `rules_check.py` to blocking (it
   already passes 0 violations per the 07-22 review — this is a one-line change already
   identified as "ready to ship" in that document).
5. Submit the existing, completed **CSA STAR Level 1 (CAIQ)** to the public registry. Zero
   remaining work — the document exists; this is a form submission.
6. **G6** — Add GPC signal detection + a formal "Do Not Sell/Share" page section (the underlying
   truthful claim already exists in `privacy.astro`; this formalizes it into the CCPA-required
   mechanism pattern).

### 10.2 Phase 1 — next 30–60 days, $0–$5k

1. **G7** — Close the API fail-closed gap: make middleware default-deny `/api/*` with an explicit
   public allowlist, replacing "secure only if every handler self-guards" with "secure by default."
   This is the single highest-leverage *engineering* item remaining — it's also a prerequisite for
   any future multi-tenant work per the 07-17 audit's §7.
2. **G8** — Write `THREAT-MODEL.md` (STRIDE + one data-flow diagram).
3. **G9** — Run an automated `axe-core`/Pa11y accessibility scan, fix highest-severity findings,
   wire into CI. Given the litigation data in §7, treat this as equal priority to the compliance
   items above, not an afterthought.
4. **G10 + G11** — Generate an OpenAPI schema from the existing zod schemas; emit a CycloneDX SBOM
   as a CI artifact. Both were already independently identified by the SOC 2 gap list.
5. **G16** — Verify (and if missing, add) an explicit "you're chatting with an AI assistant"
   disclosure in the chatbot UI, ahead of the August 2026 EU AI Act transparency deadline.
6. **G12** — Engage a small-scope external penetration test (~$5k, per the existing SOC 2 gap
   list's own estimate). This single artifact materially advances SOC 2 Type I, ISO 27001
   readiness, and CSA STAR Level 2 simultaneously.
7. Formalize the ISO/IEC **27017** and **27018** documentation (cloud security controls, PII-in-
   cloud processor obligations) — both are primarily writing exercises given the technical
   controls already exist; do this *before* committing to a full ISO 27001 engagement so the SoA
   can include them from day one (§4.3–4.5).
8. **G15** — Write a short AI-governance note (model inventory, human-oversight statement, a NIST
   AI RMF self-map) — cheap now, expensive to retrofit later under deal pressure.

### 10.3 Phase 2 — 60–180 days, first real paid certifications ($10k–$50k range)

1. **Engage a SOC 2 Type I audit** once Phase 0–1 items are closed (per `SOC2-TSC-mapping.md`'s own
   suggested ordering: Q3 2026 publish docs → Q4 close remaining gaps → Q1 2027 pen test → Q2 2027
   engage auditor — this document's Phase 0–2 work compresses that timeline since several
   "Q4 2026" items are now closing in Phase 0–1 above). Budget $12k–$40k (researched, §14).
2. **UK-market only:** Cyber Essentials (~£300–500) then Cyber Essentials Plus (~£1,500–5,000) if
   UK sales are pursued — fast, cheap, high signal-to-cost ratio for that specific buyer segment.
3. **G17** — Decide and implement an EU-region option (Cloudflare + Supabase both support this) —
   this is the single biggest *unlock* for EU public-sector and residency-sensitive enterprise
   buyers, and directly de-risks the GDPR/UK-GDPR/EU-AI-Act stories simultaneously.

### 10.4 Phase 3 — 6–18 months, the expensive/time-gated items ($30k–$150k+ range)

1. **SOC 2 Type II** — only after Type I (or skip straight to Type II per the 2026 market-reality
   note in §4.1 if a specific enterprise deal requires it directly). Budget $15k–$75k + 6–12 months
   observation window.
2. **ISO/IEC 27001** (with 27017/27018/27701 folded into the same SoA per §4.3–4.5) — budget
   $15k–$75k over the 3-year cycle, 4–9 months to first certification.
3. **ISO 42001** — pursue only once a specific enterprise buyer names it as a requirement (per the
   2026 market data in §14, this is trending toward "Fortune 500 asks for a roadmap," which this
   document's Phase 1 AI-governance note already provides as a stopgap answer).

### 10.5 Situational — only if the product scope changes

1. **HIPAA + BAAs** — only if a medical/dental/physio-clinic customer signs (§8.1).
2. **PCI DSS (target SAQ A via a hosted checkout)** — only if card payments are added; make the
   hosted-checkout architecture decision *before* building, not after (§6.2).
3. **FedRAMP/StateRAMP** — only if pursuing US government sales; do not start without a named deal.
4. **HITRUST** — only alongside the HIPAA trigger above, and only if a specific buyer requires it
   over a standard HIPAA-compliance posture.

---

## 11. Market-unlock matrix — which certification opens which door

| Certification/framework | Buyer segment unlocked | Why |
|---|---|---|
| CSA STAR L1 registry listing | Security-conscious SMB/mid-market self-service evaluators | Free, public, discoverable in procurement due-diligence searches |
| SOC 2 Type I / II | Any US mid-market or enterprise B2B SaaS buyer | The single most commonly *required* artifact in vendor security questionnaires |
| ISO 27001 (+27701) | EU enterprise, multinational, GDPR-sensitive buyers | The internationally recognized equivalent to SOC 2; often *required* rather than SOC 2 outside the US |
| WCAG 2.2 AA / accessibility remediation | Any US buyer with an internal accessibility policy (increasingly standard in enterprise procurement) + reduces direct litigation exposure | Not a "sales unlock" in the traditional sense — a *risk-removal* item with its own ROI (§7) |
| Cyber Essentials (Plus) | UK public sector + UK enterprise | Frequently a hard prerequisite for UK government-adjacent contracts |
| EU-region data residency | EU public sector, healthcare-adjacent, regulated-industry EU buyers | Removes the single hard *technical* blocker named in the 06-16 viability doc §4.4 |
| HIPAA readiness + BAAs | Medical/dental/physio clinic vertical (already a named target market) | Without it, that vertical is simply closed, regardless of how good the rest of the product is |
| PCI SAQ-A-scoped payments | Any vertical wanting deposits/no-show fees/saved cards | Unlocks a monetization feature, not just a compliance box |
| ISO 42001 / documented AI governance | Enterprise buyers evaluating the chatbot/AI features specifically | Fast-growing 2026 procurement ask (§14) — a differentiator now, likely table-stakes within 2–3 years |

This table is deliberately narrow — the full productization roadmap (multi-tenancy, billing,
SSO/SCIM, white-label) that turns "compliant enough to sell" into "a repeatable product" is already
covered in depth in
[`2026-07-17-compliance-standing-and-market-positioning.md`](2026-07-17-compliance-standing-and-market-positioning.md)
§6, and is not re-derived here — this document's contribution is the compliance-certification layer
specifically, at a scope no prior document in this repo attempted (45+ named frameworks vs. the
prior documents' ~12).

---

## 12. What you can honestly say to a buyer today

Claims that are currently true and defensible, without overstatement:

- *"Our technical security controls map to OWASP ASVS Level 2 and the OWASP Top 10, self-assessed
  at ~95%."*
- *"We're CSA STAR Level 1 registry-listed."* (once §10.1 item 5 is submitted)
- *"Our engineering is designed to GDPR/CCPA-grade standards — data-subject-rights fulfillment
  (access, rectification, erasure) has a working, audited admin workflow with SLA tracking."*
- *"We maintain row-level security on 100% of PII-bearing database tables, with zero anonymous
  access at the grant, policy, and function-execution layers."*
- *"We do not sell, rent, or share customer data with third parties."*
- *"We're preparing for SOC 2 Type I; our internal Trust Services Criteria control mapping is
  available on request."* (true today per `SOC2-TSC-mapping.md` — do not say "SOC 2 certified" or
  "SOC 2 compliant," which would be a false claim until an auditor issues a report)

Claims that are **not** currently true and should not be made until the corresponding item in §10
is actually completed by an accredited third party: "SOC 2 certified," "ISO 27001 certified,"
"HIPAA certified" (this phrase is a myth regardless — see §8.1), "PCI compliant," "WCAG conformant."

---

## 13. Bottom line

- **Engineering-controllable compliance is genuinely strong** — A− across OWASP/CSA/NIST-CSF/CIS/
  code-quality, and GDPR/CCPA moved from 🟡-with-a-blocking-gap to 🟡-close-to-🟢 in the last five
  days because the DSAR workflow gap closed in code before this audit even started.
- **Zero formal third-party certifications exist today** — that's normal for a platform at this
  stage and is not a red flag on its own; it becomes a red flag only if a buyer's specific
  requirement (SOC 2 Type II, ISO 27001) is claimed without having actually engaged an auditor.
- **The single most underrated gap uncovered by this pass is accessibility** (§7) — not previously
  tracked by any compliance document in this repository, and per 2026 litigation data, a
  higher-frequency legal-exposure vector for an SMB-facing platform than most of the named
  "big" frameworks (SOC 2, ISO 27001, HIPAA) combined.
- **AI governance (ISO 42001, EU AI Act, NIST AI RMF) is a new, fast-emerging category** worth
  seeding cheaply now (a governance note, a transparency-disclosure check) rather than building
  from zero under future deal pressure.
- **Three of the six frameworks the user asked about by name are correctly N/A today** — HIPAA,
  PCI DSS, and (implicitly, as "PIC") likely PCI DSS again — but two of those three have a clear,
  named trigger already sitting in this platform's own stated go-to-market plan (clinic vertical →
  HIPAA; payments feature → PCI), so "N/A" should be read as "not yet," not "irrelevant."
- **Total cost to close every $0-tagged item in Phases 0–2 (§10.1–10.2): $0 plus one small
  penetration-test line item (~$5k).** Total cost to add the first two *real* external
  certifications (SOC 2 Type I + a UK Cyber Essentials pair, Phase 2): roughly $15k–$50k. The
  expensive tier (SOC 2 Type II, ISO 27001/27701, ISO 42001) should be sequenced to specific
  enterprise deals that require them, not pursued speculatively.

---

## 14. Sources, methodology & disclaimer

**Internal sources (re-verified, not just cited):** `documentation/security/SECURITY.md`,
`documentation/security/PRIVACY.md`, `documentation/security/compliance/SOC2-TSC-mapping.md`,
`documentation/security/compliance/CSA-CAIQ-v4.md`, `documentation/security/compliance/ASVS-L2.md`,
`documentation/security/reviews/2026-07-17-full-platform-audit.md`,
`documentation/2026-07-17-compliance-standing-and-market-positioning.md`,
`documentation/2026-06-16-business-viability-and-compliance-assessment.md`,
`documentation/2026-07-22-codebase-services-architecture-and-setup-review.md`,
`documentation/MAINTENANCE.md`, plus direct inspection of `src/`, `migrations/`,
`supabase/migrations/`, `wrangler.toml`, `package.json`, and `.github/workflows/`.

**External web research (2026-07-22), used only for facts outside a reasonable training-knowledge
horizon:**

- [MultiState — 20 State Privacy Laws in Effect in 2026](https://www.multistate.us/insider/2026/2/4/all-of-the-comprehensive-privacy-laws-that-take-effect-in-2026)
- [Osano — U.S. Data Privacy Laws: A Guide to the 2026 Landscape](https://www.osano.com/us-data-privacy-laws)
- [Koley Jessen — New State Privacy Laws Effective January 1, 2026](https://www.koleyjessen.com/insights/publications/new-state-privacy-laws-effective-january-1-2026-indiana-kentucky-and-rhode-island)
- [artificialintelligenceact.eu — Implementation Timeline](https://artificialintelligenceact.eu/implementation-timeline/)
- [euaiact.com — EU AI Act Implementation Timeline](https://www.euaiact.com/implementation-timeline)
- [Legalnodes — EU AI Act 2026 Updates](https://www.legalnodes.com/article/eu-ai-act-2026-updates-compliance-requirements-and-business-risks)
- [Enactia — ISO 42001 Certification: The 2026 Roadmap for AI Governance](https://enactia.com/iso-42001-certification-the-2026-roadmap-for-ai-governance/)
- [ProtechtGroup — AI governance: Why ISO 42001 is the natural next certification step](https://www.protechtgroup.com/en-us/blog/ai-governance-iso-42001-certification)
- [CyberAssure — PCI DSS v4.0.1 in 2026](https://www.cyberassure.com.au/blog-pci-dss-v4)
- [PCI SSC Blog — Now is the Time for Organizations to Adopt the Future-Dated Requirements](https://blog.pcisecuritystandards.org/now-is-the-time-for-organizations-to-adopt-the-future-dated-requirements-of-pci-dss-v4-x)
- [216digital — ADA Web Accessibility Compliance Services, 2026](https://216digital.com/ada-web-accessibility-compliance-services-protecting-your-business-in-2026/)
- [nklegal — ADA Website Lawsuits and Demand Letters: 2026 Update](https://www.nklegal.com/post/ada-website-lawsuits-and-demand-letters-2026-update)
- [ideaforgestudios — ADA Website Compliance for Small Business: 2025 Lawsuit Surge](https://ideaforgestudios.com/2026/07/15/ada-website-compliance-for-small-business-what-the-2025-lawsuit-surge-actually-m/)
- [soc2auditors.org — SOC 2 Audit Cost 2026 (data from 171 firms)](https://soc2auditors.org/soc-2-audit-cost/)
- [soc2auditors.org — SOC 2 Type 1 vs Type 2: Cost, Timeline & Which to Choose](https://soc2auditors.org/insights/soc-2-type-1-vs-type-2/)
- [BrightDefense — SOC 2 Certification Cost in 2026](https://www.brightdefense.com/resources/soc-2-certification-cost/)
- [Elevate Consult — ISO 27001 Audit Blueprint 2026: Exact Costs, Timelines & Audit Types](https://elevateconsult.com/insights/iso-27001-audit-blueprint-costs-timelines-2026/)

**Methodology:** static review of one repository (`cf-admin-madagascar`) plus targeted, cited web
research for time-sensitive facts. No production runtime code, secrets, or live customer data were
accessed or changed in producing this document. No application behavior changes as a result of this
audit — it is documentation only.

**Disclaimer:** This is an internal engineering/compliance self-assessment, not a legal opinion, not
a certification, and not a substitute for qualified counsel or an accredited external auditor.
Percentages are self-assessed technical/process readiness. Do not represent any framework in this
document as "certified," "audited," or "compliant" to a customer, regulator, or contract
counterparty unless the specific third-party validation described in §3/§10 has actually occurred.
Engage qualified privacy counsel before making binding compliance representations in any customer
contract, DPA, or public marketing claim, especially across the 25+ jurisdictions named in §5.

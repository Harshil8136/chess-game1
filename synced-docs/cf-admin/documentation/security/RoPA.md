---

title: "Record of Processing Activities (GDPR Art. 30)"
status: active
audience: [owner, operator, technical, ai]
last_verified: 2026-07-25
verified_against: [code, config]
owner: harshil
related_docs: [PRIVACY.md, SECURITY.md, ../runbooks/incident-response.md, compliance/data-residency.md, ../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md]
tags: [gdpr, ropa, privacy, article-30, lfpdppp, compliance]
---

# Record of Processing Activities (RoPA)

> **TL;DR (non-technical):** The formal inventory GDPR Article 30 requires: what
> personal data this platform holds, why, on what legal basis, who it is shared
> with, where it lives, and how long it is kept. A regulator can demand this
> document at any time and expects it to already exist — it is one of the first
> things asked for after a breach.

## Context / Scope

Closes gap **G2** from
[`../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md).
Also serves ISO/IEC 27701 and the equivalent inventory duties under Mexico's
LFPDPPP, which is this platform's primary regime today.

**Covers** processing performed by `cf-admin` (this repository).
**Does NOT cover** processing performed by the public site `cf-astro` or the
`cf-chatbot` Worker, except where they share a store — noted per row. Those
repositories need their own entries for a complete group-level RoPA.

## 1. Controller identity

| Field | Value |
|---|---|
| Controller | Madagascar Pet Hotel |
| Contact | `mascotasmadagascar@gmail.com` |
| Technical contact | harshil |
| DPO | **Not appointed.** Assessed as not mandatory under Art. 37 — no large-scale systematic monitoring and no large-scale special-category processing. Several non-EU regimes (Law 25, LGPD, PDPA) do require a named privacy officer, so this becomes an action the moment those markets are pursued. |
| EU/UK representative | **Not appointed** (Art. 27). Required if EU/UK data subjects are targeted without an EU establishment. |

## 2. Processing activities

### A. Administrative access control

| Field | Detail |
|---|---|
| Purpose | Authenticate and authorise staff; enforce RBAC/PLAC |
| Categories of subject | Staff, contractors |
| Categories of data | Email, display name, role, CF Access subject ID, active/hidden flags, per-page overrides |
| Legal basis | Art. 6(1)(b) contract; 6(1)(f) legitimate interests (securing the system) |
| Stores | Supabase `admin_authorized_users`; D1 `admin_page_overrides`, `admin_pages` |
| Retention | Life of the working relationship, then deletion on request |
| Recipients | Cloudflare (Zero Trust identity), Supabase |

### B. Security audit logging

| Field | Detail |
|---|---|
| Purpose | Detect and investigate unauthorised access; produce evidence for incident response and assessors |
| Categories of subject | Staff |
| Categories of data | User ID/email/role, action, module, request method and path, CF-Ray ID, **hashed** IP, session ID, timestamps |
| Legal basis | Art. 6(1)(f) legitimate interests — security monitoring |
| Stores | D1 `admin_audit_log`, `admin_login_logs` |
| Retention | 365 days (`retention-tables.ts`), purged manually and audited |
| Safeguards | IPs are **never stored raw** — HMAC-SHA-256 via Web Crypto with `IP_HASH_SECRET` (`hashIp()`). Rotating that secret makes historical hashes unlinkable; see the incident runbook caveat. |

### C. Data-subject-rights (ARCO) request handling

| Field | Detail |
|---|---|
| Purpose | Receive, track and fulfil access/rectification/erasure/objection requests within statutory deadlines |
| Categories of subject | Customers, website visitors, any data subject who files |
| Categories of data | Full name, email, phone, request description, **identity document** (MIME type and size recorded; the document itself is the most sensitive item this platform touches), ticket number, status |
| Legal basis | Art. 6(1)(c) legal obligation (Art. 15–17); LFPDPPP ARCO |
| Stores | Supabase `legal_requests`, `privacy_requests` |
| Retention | 3 years — evidentiary. Test-pinned so it cannot be shortened unnoticed (`test/retention-invariants.test.ts`) |
| Safeguards | **Open tickets can never be purged** — enforced by the `terminalStatuses` gate and covered by tests. SLA deadlines computed at 20 + 15 business days (`src/lib/arco/sla.ts`, 24 tests). |

### D. Consent records

| Field | Detail |
|---|---|
| Purpose | Evidence of cookie/privacy consent and its withdrawal |
| Categories of subject | Website visitors (collected by `cf-astro`) |
| Categories of data | Consent type, granted flag, timestamp, hashed IP, user agent |
| Legal basis | Art. 7(1) — demonstrating consent |
| Stores | Supabase `consent_records` |
| Retention | Per `retention-tables.ts` |
| Note | **Written by `cf-astro`, read here.** `cf-admin` provides the audit surface, not the collection point. GPC (`Sec-GPC`) is detected here (`src/lib/security/gpc.ts`) but consumer-facing enforcement belongs to `cf-astro` — see `compliance/data-residency.md`. |

### E. Customer inquiries & bookings

| Field | Detail |
|---|---|
| Purpose | Respond to enquiries; operate pet-boarding bookings |
| Categories of subject | Customers |
| Categories of data | Name, email, phone, message, locale, booking dates, pet details, internal staff notes |
| Legal basis | Art. 6(1)(b) contract; 6(1)(f) for enquiry handling |
| Stores | Supabase `contact_messages`, `bookings`, `booking_pets`; D1 `admin_booking_state` |
| Retention | Booking attempts 90 days; bookings for the commercial relationship |
| Note | **Pet health data is NOT human health data** — not Art. 9 special category, and not PHI under HIPAA. |

### F. Transactional & marketing email

| Field | Detail |
|---|---|
| Purpose | Send booking confirmations and operational email; record delivery |
| Categories of subject | Customers, staff |
| Categories of data | Recipient address, subject, body, attachments, delivery status, **hashed** sender IP |
| Legal basis | Art. 6(1)(b) contract (transactional); 6(1)(a) consent (marketing) |
| Stores | Supabase `email_audit_logs`; D1 `admin_email_drafts`, `admin_email_templates`; R2 `email-attachments/` |
| Retention | 365 days |
| Recipients | Brevo, Resend (sub-processors) |
| ⚠️ Known gap | **No `List-Unsubscribe` header and no suppression list** (audit gap G5, still open). Affects CAN-SPAM/CASL and inbox placement. Tracked in `../MAINTENANCE.md`. |

### G. AI-assisted content generation

| Field | Detail |
|---|---|
| Purpose | Draft marketing email copy from a staff prompt |
| Categories of subject | Staff (prompt author) |
| Categories of data | Prompt text, generated output, token usage |
| Legal basis | Art. 6(1)(f) legitimate interests |
| Recipients | Cloudflare Workers AI; **OpenRouter** when an `openrouter/*` model is selected — a cross-border transfer to a third party |
| Safeguards | Model IDs constrained to the `AI_MODELS` catalogue or a bounded `openrouter/<vendor>/<model>` pattern; prompt capped at 2000 chars; prompt-injection keyword screen |
| Note | Full inventory in `compliance/AI-GOVERNANCE.md` |

### H. Retained data from a superseded product version — pending decommission

Recorded 2026-07-29. This activity is **not** a live processing operation; it is disclosed
because an Art. 30 register that omits a store of personal data is a finding whether or not
that store is still in use.

| Field | Detail |
|---|---|
| Purpose | None ongoing. Residual data from an earlier product version, retained pending export and disposal |
| Status | **Dormant.** No application, worker or API connects to it. Latest write 2026-06-22 (`admin_audit_logs`, `access_login_attempts`); most tables last written between February and April 2026 |
| Location | Supabase project `[SUPABASE_PROJECT_REF]` ("supabase-pink-village"), us-east-1, created 2026-01-01 |
| Categories of subject | Staff/administrators of the earlier version; data subjects who submitted consent or ARCO requests to it |
| Categories of data | 37 tables. Materially: `email_master_log` (577 rows), `email_journey_hops` (774), `admin_audit_logs` (232), `forensic_access_log` (192), `consent_receipts` (105), `admin_sessions` (96), `access_login_attempts` (41), `admin_permission_logs` (39), `consent_logs` (14), `admin_users` (8), `access_authorized_emails` (6), **`legal_requests` (2 — ARCO requests, PII by its own table comment)** |
| Legal basis for retention | Art. 6(1)(c) / Art. 17(3)(b) — retention pending verification that no outstanding data-subject obligation attaches to the ARCO rows, then disposal |
| Known weaknesses | A security-advisor sweep on 2026-07-29 returned **128 findings** against 1 for the production project: 45 `SECURITY DEFINER` functions executable by the `anon` role over PostgREST, 48 by `authenticated`, 14 always-true RLS policies, 19 functions with a mutable `search_path`, and 1 RLS-enabled table with no policy. **The project therefore does not meet the standard claimed for the production database, and no claim about it should be made.** |
| Owner decision | Superseded version, not connected to any production or testing environment. Data to be exported for safekeeping, then the project decommissioned once the client approves. Recorded 2026-07-29. |
| Disposal method | Export → verify the two `legal_requests` rows carry no outstanding obligation → record the disposal in `deletion_audit` (currently 0 rows) → delete the project |
| Action outstanding | **Export before pausing.** Pausing a Supabase project makes its data inaccessible until restored, so pausing ahead of the export would block the export it is meant to protect. Sequence matters. |

## 3. Sub-processors

| Sub-processor | Purpose | Data | Region |
|---|---|---|---|
| Cloudflare | Hosting, Zero Trust, D1, KV, R2, Queues, Workers AI | All | US (see §4) |
| Supabase | Postgres | Users, ARCO, consent, bookings, email ledger | US |
| Brevo | Email delivery | Recipient addresses, content | EU (France) |
| Resend | Email delivery | Recipient addresses, content | US |
| Upstash | Rate-limit counters | Hashed identifiers only | US |
| Sentry | Error tracking | Scrubbed traces — `sendDefaultPii: false` + PII scrubber | US |
| PostHog | Product analytics | Usage events | US |
| OpenRouter | AI inference (optional) | Prompt text | Varies by model |

## 4. International transfers

All primary stores are **US-region**. For EU data subjects this is a third-
country transfer requiring Art. 46 safeguards — Standard Contractual Clauses,
which Cloudflare and Supabase both offer in their DPAs.

**No EU-region deployment exists today.** This is audit gap **G17** and the
single hardest blocker for EU public-sector and residency-sensitive buyers. See
[`compliance/data-residency.md`](compliance/data-residency.md).

## 5. Technical & organisational measures (Art. 32)

Summarised; full detail in [`SECURITY.md`](SECURITY.md).

- Encryption in transit (TLS 1.3, HSTS preload) and at rest (vendor-managed).
- Identity at the Cloudflare edge (Zero Trust); authorisation via RBAC + PLAC,
  **fail-closed** on `/api/*` since 2026-07-25 (`API_DENY_MODE`).
- Supabase `anon` role holds zero grants, zero policies, zero function ACLs.
- Sessions: 30-minute role re-check, 24-hour hard expiry, revocation flags.
- Audit trail on every mutation; IPs hashed, never stored raw.
- Input validation on 100% of API routes accepting a JSON body.
- CSP with per-request nonces; `unsafe-eval` removed 2026-07-25.
- CI gates: blocking `npm audit` with expiring exceptions, secret scanning,
  10 code-anchored security rules, typecheck/lint/test/build.

## 6. Known gaps

| Gap | Impact | Tracked |
|---|---|---|
| No DPO / EU representative | Required if EU targeting begins | This doc §1 |
| No EU data residency | Art. 46 SCC reliance; blocks some buyers | G17 |
| No `List-Unsubscribe` / suppression list | CAN-SPAM, CASL, deliverability | G5 |
| GPC enforcement lives in `cf-astro` | Detection only here | G6 (partial) |
| No tested DR restore | Art. 32(1)(c) resilience unproven | G3 |
| IR plan never drilled | Art. 33 readiness unproven | G1/G4 |

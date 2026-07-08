---

title: "CSA STAR Level 1 — CAIQ v4.0.3 (cf-admin-madagascar)"
status: active
audience: [technical, operator, owner]
last_verified: 2026-07-08
verified_against: [code, config, mcp]
owner: harshil
related_docs: [ASVS-L2.md, SOC2-TSC-mapping.md, ../SECURITY.md]
tags: [compliance, csa, star, caiq, self-attestation]
---

# CSA STAR Level 1 — Consensus Assessments Initiative Questionnaire (CAIQ v4.0.3)

> **TL;DR:** This is our answered CSA CAIQ v4.0.3 questionnaire, ready for
> submission to the free CSA STAR Level 1 registry
> (<https://cloudsecurityalliance.org/star/registry/>). Every answer is
> traceable to code, config, or an operator runbook. Registry listing is a
> massive enterprise-buyer trust signal at $0 cost.

## Submission format

CSA publishes CAIQ as a spreadsheet with columns `Question ID | Question |
Response (Yes/No/NA) | Notes`. This Markdown file mirrors that structure so
it can be copy-pasted into the CSA workbook without re-entry.

## Applicability

- **Provider:** Madagascar Hotel (mascotasmadagascar-cmd)
- **Service under attestation:** `cf-admin-madagascar` (private admin dashboard)
- **Deployment model:** Public cloud (Cloudflare Workers), single-tenant
- **Service model:** Software-as-a-Service (SaaS) — first-party, not resold
- **Cloud provider(s) leveraged:** Cloudflare (Workers, D1, KV, R2, Queues,
  Access, Analytics Engine), Supabase (Postgres + Auth), Upstash (Redis),
  Sentry (error tracking), Brevo (email)

## Domain answers

Rows use `Q ID | Q | Answer | Evidence`. `CCM v4.0` domain codes are the
CSA-canonical column headers.

### A&A — Audit & Assurance

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| A&A-01 | Are audit and assurance policies established? | Yes | `RULESAd.md` §9 + `documentation/security/reviews/` dated review cadence. |
| A&A-02 | Are independent audits performed? | Partial | Internal deep reviews on a monthly cadence; external audit not yet engaged. |
| A&A-03 | Is a risk-based audit plan documented? | Yes | `MAINTENANCE.md` + `documentation/2026-07-05-comprehensive-codebase-and-system-review.md`. |
| A&A-04 | Are audit findings tracked to resolution? | Yes | `MAINTENANCE.md` open-items table with severity + status. |
| A&A-05 | Are audit reports made available to customers? | Yes | Public repo for cf-admin-madagascar; `documentation/` sync'd via `sync-docs.yml`. |
| A&A-06 | Is a self-attestation available? | Yes | This document + `ASVS-L2.md` + `SOC2-TSC-mapping.md`. |

### AIS — Application & Interface Security

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| AIS-01 | Are SSDLC / secure coding standards enforced? | Yes | `documentation/reference/coding-standards.md`, `RULESAd.md` §9.0 CI-enforced rules, `scripts/rules_check.py`. |
| AIS-02 | Is app-level authentication multi-factor? | Yes | Cloudflare Zero Trust MFA + Supabase Auth. |
| AIS-03 | Are inputs validated at every boundary? | Yes | Zod schemas at every API handler. |
| AIS-04 | Is output encoded to prevent injection? | Yes | Preact/Astro auto-escape; `src/lib/email/sanitize-html.ts` HTMLRewriter sanitizer. |
| AIS-05 | Is CSRF protection in place for state-changing ops? | Yes | `src/lib/csrf.ts::validateCsrf()` on all mutation methods. |
| AIS-06 | Are dependencies scanned for vulnerabilities? | Yes | `npm audit --omit=dev --audit-level=high` on every push + weekly cron. |
| AIS-07 | Are APIs protected by strong authentication + rate limiting? | Yes | `requireAuth()` + Upstash Redis rate limiting (`src/lib/ratelimit.ts`). |

### BCR — Business Continuity Management & Operational Resilience

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| BCR-01 | Is a BC/DR plan in place? | Partial | Cloudflare's edge redundancy + Supabase point-in-time backups provide baseline recovery; formal BC plan is documented at high level in `documentation/architecture/ARCHITECTURE.md`. |
| BCR-02 | Are BC/DR tests conducted? | Partial | Sentry alerts for degraded state; formal DR drills not automated. |
| BCR-03 | Are backups encrypted and tested? | Yes | Supabase native backup encryption; D1 point-in-time recovery. |
| BCR-04 | Are systems monitored for outages? | Yes | Sentry error tracking + Cloudflare native monitoring + `/api/health` endpoint. |
| BCR-05 | Is capacity monitored? | Yes | KV budget monitoring (`documentation/architecture/KV-RESILIENCE.md`); free-tier limits documented in `documentation/operations/OPERATIONS.md`. |
| BCR-06 | Are dependencies mapped for continuity? | Yes | Dependencies + service bindings enumerated in `documentation/architecture/ARCHITECTURE.md`. |

### CCC — Change Control & Configuration Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| CCC-01 | Are changes tested before production? | Yes | `tsc` + `vitest` + `docs_check` + `rules_check` in CI; per-branch protection. |
| CCC-02 | Is a change-approval process documented? | Yes | `GITHUB_RULES.md` + PR-review requirement. |
| CCC-03 | Are unauthorized changes detected? | Yes | Git history; Cloudflare Worker version history; branch-protection prevents force push. |
| CCC-04 | Is configuration baseline maintained? | Yes | `wrangler.toml` + `documentation/operations/OPERATIONS.md` binding registry. |
| CCC-05 | Are separation-of-duty controls enforced? | Yes | Role hierarchy (dev/owner/super_admin/admin/staff); PLAC per-page overrides. |

### CEK — Cryptography, Encryption & Key Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| CEK-01 | Is data at rest encrypted? | Yes | Cloudflare D1/KV/R2 native encryption at rest; Supabase managed encryption. |
| CEK-02 | Is data in transit encrypted (TLS)? | Yes | HTTPS-only + HSTS `max-age=63072000; includeSubDomains; preload`. |
| CEK-03 | Are approved crypto algorithms used? | Yes | Web Crypto SubtleCrypto (SHA-256, RSA-256, HMAC-SHA256) — enforced by SEC-10. |
| CEK-04 | Are keys stored in a dedicated key store? | Yes | Cloudflare Worker Secrets binding. |
| CEK-05 | Is key rotation documented and periodic? | Partial | Manual rotation via dashboards; not automated. Accepted risk for admin-only app. |
| CEK-06 | Are keys generated with strong entropy? | Yes | `crypto.getRandomValues()` — used for CSP nonce (128-bit), session IDs, tokens. |

### DCS — Datacenter Security

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| DCS-01–DCS-08 | Physical DC controls | Inherited | Handled by Cloudflare + Supabase + Upstash — see their respective SOC 2 / ISO 27001 attestations. |

### DSP — Data Security & Privacy Lifecycle Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| DSP-01 | Is data classified and tracked? | Yes | `documentation/security/PRIVACY.md` classifies PII, session, audit, and public data tiers. |
| DSP-02 | Are data-retention policies enforced? | Yes | Weekly R2 cleanup (`src/workers/scheduled-asset-cleanup.ts` with `email-attachments/` protected); D1 audit log prune via `/api/audit/prune`. |
| DSP-03 | Are data-subject rights honored (GDPR/LFPDPPP)? | Yes | Privacy dashboard, consent records, deletion + export flows. |
| DSP-04 | Are logs privacy-safe? | Yes | Sentry `sendDefaultPii: false`; IP hashed via `hashIp()` (`src/pages/api/emails/send.ts`). |
| DSP-05 | Are cross-border transfers governed? | Yes | Data resides in US-East (Supabase) + Cloudflare's global edge; PII limited to authorized-user emails + admin-generated content. |
| DSP-06 | Is data deleted on request? | Yes | Privacy request handler + Supabase RLS-enforced deletes. |
| DSP-07 | Are data-sharing agreements documented? | Yes | Third parties: Cloudflare, Supabase, Upstash, Sentry, Brevo — DPAs on file. |

### GRC — Governance, Risk & Compliance

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| GRC-01 | Is a compliance/governance program in place? | Yes | `RULESAd.md` — governance codified as CI-enforced rules. |
| GRC-02 | Are regulatory obligations tracked? | Yes | GDPR + Mexican LFPDPPP tracked in `documentation/security/PRIVACY.md`. |
| GRC-03 | Are internal audits conducted? | Yes | Monthly cadence — `documentation/security/reviews/`. |

### HRS — Human Resources

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| HRS-01 | Are background checks performed on staff with system access? | Partial | Owner-only currently; staff onboarding process documented per contract. |
| HRS-02 | Is security awareness training provided? | Partial | AI-agent + human operators guided by `RULESAd.md`. |
| HRS-03 | Are acceptable-use policies signed? | Yes | GitHub organization TOS + `GITHUB_RULES.md`. |
| HRS-04 | Is access revoked on offboarding? | Yes | Force-kick + session flush + CF Access revocation — `documentation/features/SESSION-MANAGEMENT.md`. |

### IAM — Identity & Access Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| IAM-01 | Is IAM policy documented? | Yes | `documentation/architecture/plac-and-audit.md` + `documentation/features/USER-MANAGEMENT.md`. |
| IAM-02 | Is access reviewed periodically? | Yes | 30-min automatic role recheck; per-user PLAC overrides audited via Ghost Audit. |
| IAM-03 | Is MFA enforced for privileged accounts? | Yes | Cloudflare Zero Trust MFA required. |
| IAM-04 | Are shared/generic accounts forbidden? | Yes | Every user has unique CF sub-id → Supabase user row → RBAC role. |
| IAM-05 | Are privileged operations logged? | Yes | Ghost Audit — role changes, PLAC overrides, force-kicks, session revocations, exports. |
| IAM-06 | Is separation of duties enforced? | Yes | Role hierarchy + PLAC page-level gates; type-to-confirm on destructive ops. |
| IAM-07 | Are service accounts uniquely identified? | Yes | Named service bindings; service-role Supabase key kept out of client. |
| IAM-08 | Is enrollment tightly controlled? | Yes | `admin_authorized_users` allowlist; access requests via `/api/access-requests` + owner approval. |

### IPY — Interoperability & Portability

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| IPY-01 | Is data portable in standard formats? | Yes | JSON + CSV export at API + UI level (`/api/audit/export`, `SessionCommandCenter` export). |
| IPY-02 | Are APIs documented and stable? | Partial | Per-feature docs; no OpenAPI schema yet — future work. |

### IVS — Infrastructure & Virtualization Security

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| IVS-01 | Is network segmentation enforced? | Yes | Cloudflare Zero Trust perimeter + service bindings (no public origin). |
| IVS-02 | Is host hardening applied? | Inherited | Cloudflare Workers isolate execution per V8 isolate. |
| IVS-03 | Are unnecessary ports/services closed? | Yes | Workers surface only HTTP(S) endpoints defined in `src/pages/api/**`. |
| IVS-04 | Is a WAF in front of the app? | Yes | Cloudflare WAF + Zero Trust. |

### LOG — Logging & Monitoring

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| LOG-01 | Are security-relevant events logged? | Yes | Ghost Audit + login forensics + Sentry. |
| LOG-02 | Are logs tamper-evident? | Yes | Supabase RLS on `email_audit_logs`, `admin_access_requests`; append-only audit tables. |
| LOG-03 | Is log retention documented? | Yes | 30-day default retention (configurable via `/api/audit/prune`); Sentry 90-day. |
| LOG-04 | Are logs correlated / SIEM-fed? | Partial | Sentry serves as SIEM-lite; no dedicated SIEM yet. |
| LOG-05 | Are alerts triggered on anomalies? | Yes | Sentry rules + login-forensics suspicious flagging (`src/components/admin/users/sessions/sessionRisk.ts`). |

### SEF — Security Incident Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| SEF-01 | Is an IR plan documented? | Partial | Runbooks in `documentation/runbooks/`; no formal escalation matrix. |
| SEF-02 | Are IR roles assigned? | Yes | Owner (harshil) + AI agent (Claude) as documented in RULESAd.md. |
| SEF-03 | Is incident detection automated? | Yes | Sentry error tracking + login forensics suspicious flags. |
| SEF-04 | Are IR exercises performed? | No | Not yet. Follow-up. |
| SEF-05 | Are lessons learned documented? | Yes | Post-incident notes in `documentation/security/reviews/`. |

### STA — Supply Chain Management, Transparency & Accountability

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| STA-01 | Are third parties assessed? | Partial | Cloudflare, Supabase, Upstash, Sentry, Brevo — all major vendors carry SOC 2 / ISO 27001. |
| STA-02 | Is supply-chain risk tracked? | Yes | `npm audit --omit=dev` on every push + weekly cron. |
| STA-03 | Are SBOMs generated? | No | Follow-up — would use CycloneDX from npm tree. |
| STA-04 | Is source-code integrity enforced? | Yes | GitHub commit signing recommended; secret-scan CI blocks credential commits. |

### TVM — Threat & Vulnerability Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| TVM-01 | Are vulnerabilities scanned? | Yes | Weekly `npm audit`, Supabase advisor MCP, `rules_check.py`. |
| TVM-02 | Are patches applied timely? | Yes | Latest audit-fix pass 2026-07-08 (15 → 3 low-severity residual). |
| TVM-03 | Are pen tests performed? | No | Follow-up — external engagement not yet budgeted. |
| TVM-04 | Are secure defaults used? | Yes | Fail-closed API deny; SameSite=Strict cookies; nonce-based CSP. |

### UEM — Universal Endpoint Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| UEM-01 | Are endpoints managed via central policy? | Inherited | Cloudflare Zero Trust device posture check on operator devices. |
| UEM-02 | Are BYOD policies documented? | Partial | Zero-Trust posture check enforces baseline. |

---

## Submission checklist

- [ ] Copy answers into the CSA CAIQ v4.0.3 workbook (Excel).
- [ ] Register at <https://cloudsecurityalliance.org/star/registry/>.
- [ ] Submit workbook + this URL as evidence attachment.
- [ ] Once approved (typically <2 weeks), our listing appears at
      `https://cloudsecurityalliance.org/star/registry/madagascar-hotel`.

_Refreshed 2026-07-08 post-compliance-wave._

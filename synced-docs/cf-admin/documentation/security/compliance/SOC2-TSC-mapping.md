---

title: "SOC 2 Type I Readiness — TSC Control Mapping (cf-admin-madagascar)"
status: active
audience: [technical, operator, owner]
last_verified: 2026-07-08
verified_against: [code, config, mcp]
owner: harshil
related_docs: [ASVS-L2.md, CSA-CAIQ-v4.md, ../SECURITY.md]
tags: [compliance, soc2, tsc, aicpa, self-attestation]
---

# SOC 2 Type I Readiness — Trust Services Criteria Mapping

> **TL;DR:** This is our internal control-to-TSC mapping — the artifact a
> SOC 2 Type I auditor would ask for on day one. It shows how our engineering
> controls line up with the AICPA Trust Services Criteria (2017, as revised).
> We are **not currently in a Type I audit engagement**; this doc puts us in
> "audit-ready" posture so we can start one with minimal ramp-up cost.

## Scope

- **Service under review:** `cf-admin-madagascar` — Astro+Preact admin
  dashboard on Cloudflare Workers.
- **TSCs in scope:** Security (Common Criteria) primarily; Availability +
  Confidentiality touched where evidence is strong. Processing Integrity and
  Privacy left for a future Type II engagement.
- **Report boundary:** the admin application layer. Underlying platform TSCs
  (Cloudflare, Supabase, Upstash) inherit through those vendors' own SOC 2
  reports.

## Legend

- ✅ **Verified** — control implemented + evidence pointer.
- 🟡 **Design phase** — control designed but not evidenced by long-running logs
  yet (Type I threshold — designed & suitably tailored is enough).
- ❌ **Gap** — must be closed before Type I.
- 🚫 **N/A** — control does not apply.

---

## CC1 — Control Environment

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC1.1 | Entity demonstrates commitment to integrity + ethical values | ✅ | `RULESAd.md` §0 (absolute law) + §0.5 (no fake data). |
| CC1.2 | Board exercises independent oversight | 🟡 | Owner is single point of executive review; documented in `RULESAd.md`. Small-team acceptable per SOC 2 Type I "commensurate with the size + complexity". |
| CC1.3 | Management establishes structures, reporting lines, authorities | ✅ | RBAC hierarchy + `documentation/features/USER-MANAGEMENT.md`. |
| CC1.4 | Commitment to attract, develop, retain competent individuals | 🟡 | Owner + AI-agent execution model; ongoing training encoded in `RULESAd.md` + `AI_CODE_MAINTENANCE.md`. |
| CC1.5 | Individuals held accountable for internal controls | ✅ | Ghost Audit Engine logs every privileged action; owner reviews weekly. |

## CC2 — Communication & Information

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC2.1 | Obtains + uses relevant, quality information | ✅ | Sentry error tracking + Supabase advisor MCP + CF Analytics. |
| CC2.2 | Internal communication of objectives + responsibilities | ✅ | `documentation/` folder + `RULESAd.md` + `main.md` AI pointer. |
| CC2.3 | External communication with users, partners, regulators | ✅ | Privacy dashboard + consent records + status page (Cloudflare native). |

## CC3 — Risk Assessment

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC3.1 | Specifies objectives with clarity | ✅ | Mission statement in `RULESAd.md`. |
| CC3.2 | Identifies risks to objectives | ✅ | `documentation/2026-07-05-comprehensive-codebase-and-system-review.md` scorecard. |
| CC3.3 | Considers potential for fraud | ✅ | Ghost Audit Engine surfaces all privileged actions; force-kick + revocation flows. |
| CC3.4 | Assesses changes that could affect internal controls | ✅ | Every PR runs `docs_check` + `rules_check` + `tsc` + `vitest` + `npm audit`. |

## CC4 — Monitoring Activities

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC4.1 | Ongoing + periodic evaluations of controls | ✅ | Monthly security reviews (`documentation/security/reviews/`); weekly `npm audit` cron; automated CI gates. |
| CC4.2 | Communicates + acts on deficiencies | ✅ | `MAINTENANCE.md` open-items table; each PR closes findings with commit hash. |

## CC5 — Control Activities

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC5.1 | Selects + develops control activities that mitigate risks | ✅ | `RULESAd.md` §9.0 code-anchored enforced rules table. |
| CC5.2 | Deploys general controls over technology | ✅ | Cloudflare Zero Trust MFA, WAF, DDoS protection, IPv4/v6 dual-stack, TLS 1.3. |
| CC5.3 | Deploys policies + procedures for control activities | ✅ | `RULESAd.md` + `documentation/reference/coding-standards.md`. |

## CC6 — Logical & Physical Access Controls

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC6.1 | Restricts logical access | ✅ | Cloudflare Zero Trust + `admin_authorized_users` allowlist + PLAC per-page. |
| CC6.2 | Prior to issuing credentials, registers + authorizes users | ✅ | Access-request flow (`/api/access-requests`) + owner approval. |
| CC6.3 | Restricts access to data + protected info based on authority | ✅ | RBAC (dev/owner/super_admin/admin/staff) + Supabase RLS + PLAC overrides. |
| CC6.4 | Restricts physical access | Inherited | Cloudflare + Supabase DC controls (see their SOC 2 Type II reports). |
| CC6.5 | Discontinues logical + physical access | ✅ | Force-kick, session flush, revocation flag KV + CF Access session revoke — `documentation/features/SESSION-MANAGEMENT.md`. |
| CC6.6 | Implements logical access security to protect from threats outside boundaries | ✅ | HTTPS-only + HSTS `max-age=63072000; preload`; CSP nonce-based; Cloudflare WAF. |
| CC6.7 | Restricts transmission, movement, removal of information | ✅ | Export gated by `#export` PLAC fragment; downloads audit-logged. |
| CC6.8 | Prevents + detects unauthorized software installation | ✅ | Worker deploys require `wrangler` auth; commit signing recommended; secret-scan CI. |

## CC7 — System Operations

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC7.1 | Uses detection + monitoring procedures to identify anomalies | ✅ | Sentry + login-forensics suspicious flagging (`sessionRisk.ts`). |
| CC7.2 | Monitors system components for anomalies | ✅ | `/api/health` + Cloudflare Analytics + Sentry. |
| CC7.3 | Evaluates security events for impact | ✅ | Owner reviews Sentry alerts + `documentation/security/reviews/`. |
| CC7.4 | Responds to identified security incidents | ✅ | Runbooks in `documentation/runbooks/`; SEF-01 in CAIQ. |
| CC7.5 | Identifies + develops activities to recover from identified security incidents | ✅ | Rollback recipes in each runbook + `documentation/2026-07-05-...` risks section. |

## CC8 — Change Management

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC8.1 | Authorizes, designs, develops, tests, approves, implements changes | ✅ | Every change goes through PR + CI (`tsc`, `vitest`, `docs_check`, `rules_check`, `npm audit`, `secret-scan`); branch protection on `main`. |

## CC9 — Risk Mitigation

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC9.1 | Identifies + implements activities to mitigate risks from partners + vendors | ✅ | Vendor DPAs on file (Cloudflare, Supabase, Upstash, Sentry, Brevo); `documentation/features/CONTROL-PLANE-CONNECTORS.md`. |
| CC9.2 | Assesses + manages risks associated with vendors + business partners | ✅ | STA-01/02 in CAIQ; weekly npm audit + Supabase advisor MCP. |

## A1 — Availability (partial coverage)

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| A1.1 | Maintains, monitors, evaluates current capacity | ✅ | KV budget monitoring; free-tier limits documented; `/api/health` uptime. |
| A1.2 | Implements + monitors environment | ✅ | Cloudflare native + Sentry + login forensics. |
| A1.3 | Tests recovery procedures | Partial | Cloudflare + Supabase native backups; formal DR tabletop not yet scheduled. |

## C1 — Confidentiality (partial coverage)

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| C1.1 | Identifies + maintains confidential information | ✅ | `documentation/security/PRIVACY.md` data classification. |
| C1.2 | Disposes of confidential information | ✅ | Privacy request handler + Supabase RLS-enforced deletes; R2 cron cleanup. |

---

## Gap list for Type I engagement

Before an actual SOC 2 Type I engagement is worth engaging, close these:

1. **CC1.4 — competent individuals**: formalize training/onboarding cadence
   with dated attestation records for AI-agent + human contributors.
2. **A1.3 — recovery testing**: schedule a semi-annual DR tabletop; record
   results.
3. **SEF-04 — IR exercises**: schedule + record incident-response drills
   annually.
4. **TVM-03 — pen test**: engage an external firm for a scoped pen test
   (Astro admin + Cloudflare Worker attack surface). Budget ~$5k for a
   small-scope engagement.
5. **STA-03 — SBOM**: emit CycloneDX SBOM from `npm ls --production --json`
   as a CI artifact.
6. **IPY-02 — API docs**: generate an OpenAPI schema (Zod → OpenAPI) so
   external integrators + auditors have a stable API surface.

Once (1–6) are addressed, the org is Type I audit-ready. Cost of Type I
engagement itself (excluding remediation): typically $10k–$25k for a
small-scope, single-service report.

## Suggested next-step ordering

- **Q3 2026**: publish this file + CAIQ + ASVS. Register on CSA STAR L1.
- **Q4 2026**: close gaps 1, 2, 3, 5, 6. Refresh CAIQ answers.
- **Q1 2027**: close gap 4 (external pen test). Address findings.
- **Q2 2027**: engage a SOC 2 Type I auditor. Ship report.
- **Q3 2027 onwards**: Type II readiness (12-month operating-effectiveness
  window). Refresh review cadence to weekly for hot paths.

_Refreshed 2026-07-08 post-compliance-wave._

---

title: "CSA STAR Level 1 — CAIQ v4.0.3 (cf-admin-madagascar)"
status: active
audience: [technical, operator, owner]
last_verified: 2026-09-19
verified_against: [code, config, mcp]
owner: harshil
related_docs: [ASVS-L2.md, SOC2-TSC-mapping.md, ../SECURITY.md]
tags: [compliance, csa, star, caiq, self-attestation]
---

# CSA STAR Level 1 — Consensus Assessments Initiative Questionnaire (CAIQ v4.0.3)

> **TL;DR:** This is our answered CSA CAIQ v4.0.3 questionnaire, ready for
> submission to the free CSA STAR Level 1 registry
> (<https://cloudsecurityalliance.org/star/registry/>) **once its answers are
> re-keyed to the official question IDs — see *Submission format*.** Every
> answer is traceable to code, config, or an operator runbook. Registry listing
> is a strong enterprise-buyer trust signal at $0 cost. Nothing here has been
> submitted: every box in the checklist at the end is still unticked.

## Submission format

CSA publishes CAIQ as a spreadsheet with columns `Question ID | Question |
Response (Yes/No/NA) | Notes`. This Markdown file mirrors that *structure*.

> **Read before submitting (added 2026-09-19).** The row keys below —
> `A&A-01`, `AIS-02`, `LOG-02` … — are CCM v4.0 **control-domain** identifiers,
> not CAIQ v4.0.3 **question** IDs. A real CAIQ question ID takes the form
> `A&A-01.1` / `AIS-04.3`, one per assertion, and there are far more of them
> than there are rows here. This file is therefore a **CAIQ-aligned
> self-questionnaire**: the answers are real and traceable, but they must be
> mapped onto the official v4.0.3 question IDs before anything is uploaded to
> the STAR registry. That mapping step is in the submission checklist at the
> end. Do not describe the file as "copy-paste ready" — the previous wording
> promised something it cannot deliver.

## Applicability

- **Provider:** Madagascar Hotel (mascotasmadagascar-cmd)
- **Service under attestation:** `cf-admin-madagascar` (private admin dashboard)
- **Deployment model:** Public cloud (Cloudflare Workers), single-tenant
- **Service model:** Software-as-a-Service (SaaS) — first-party, not resold
- **Cloud provider(s) leveraged:** Cloudflare (Workers, D1, KV, R2, Queues,
  Access, Analytics Engine), Supabase (Postgres — GoTrue auth retired, see `SECURITY.md` §1), Upstash (Redis),
  Sentry (error tracking), Brevo (email). **The authoritative sub-processor list
  is `documentation/security/RoPA.md` §3** (nine entries as of 2026-09-19); the five named here
  are the platform dependencies, not the Art. 28 list.

## Domain answers

Rows use `Q ID | Q | Answer | Evidence`. `CCM v4.0` domain codes are the
CSA-canonical column headers.

### A&A — Audit & Assurance

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| A&A-01 | Are audit and assurance policies established? | Yes | `RULESAd.md` §9 + `documentation/security/reviews/` dated review cadence. |
| A&A-02 | Are independent audits performed? | Partial | Internal deep reviews on a quarterly cadence (see GRC-03 — this row said "monthly"; corrected 2026-09-14); external audit not yet engaged. |
| A&A-03 | Is a risk-based audit plan documented? | Yes | `MAINTENANCE.md` + `../../records/reviews/2026-07-05-comprehensive-codebase-and-system-review.md`. |
| A&A-04 | Are audit findings tracked to resolution? | Yes | `MAINTENANCE.md` open-items table with severity + status. |
| A&A-05 | Are audit reports made available to customers? | Partial | **Corrected 2026-09-19 — these self-assessments are published, not "on request".** `.github/workflows/sync-docs.yml` copies every `.md` under `documentation/` to a public repository except the excluded prefixes (`program/`, `records/`, `commercial/`, `MAINTENANCE.md` and five named files); `security/compliance/**` is not excluded, so this file, `SOC2-TSC-mapping.md` and `ASVS-L2.md` are readable by anyone. The source repository `cf-admin-madagascar` is separately **private**, which remains true. No third-party audit report exists to share. *(The 2026-07-29 correction that replaced "Public repo" with "on request" over-corrected.)* |
| A&A-06 | Is a self-attestation available? | Yes | This document + `ASVS-L2.md` + `SOC2-TSC-mapping.md`. |

### AIS — Application & Interface Security

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| AIS-01 | Are SSDLC / secure coding standards enforced? | Yes | `documentation/reference/coding-standards.md`, `RULESAd.md` §9.0 CI-enforced rules, `scripts/rules_check.py`. |
| AIS-02 | Is app-level authentication multi-factor? | **Partial** | **Corrected 2026-09-19 — "Yes" was not defensible.** Cloudflare Zero Trust is the only login path (Supabase Auth was retired — `SECURITY.md` §1, ASVS 2.1.1), and its Access application accepts three identity providers: Google, GitHub and **One-Time PIN**. Google and GitHub accounts may carry MFA, but that is the user's setting at those providers and we neither enforce nor evidence it; One-Time PIN is a single emailed code and is single-factor by construction. Making this a "Yes" requires an Access policy that requires MFA (or dropping the OTP provider) and a screenshot of it. See `ASVS-L2.md` 2.2.3. |
| AIS-03 | Are inputs validated at every boundary? | Yes | Zod schemas at every API handler. |
| AIS-04 | Is output encoded to prevent injection? | Yes | Preact/Astro auto-escape; `src/lib/email/sanitize-html.ts` HTMLRewriter sanitizer. |
| AIS-05 | Is CSRF protection in place for state-changing ops? | Yes | `src/lib/csrf.ts::validateCsrf()` on all mutation methods. |
| AIS-06 | Are dependencies scanned for vulnerabilities? | Yes | `npm audit --omit=dev --audit-level=high` on every push + weekly Monday cron, gated by `scripts/audit_gate.py`, which fails the build on any undocumented high/critical advisory **and** on an expired exception. Blocking since **2026-07-25**; before that date the step was suffixed `|| true` and could not fail. Date added 2026-07-29. |
| AIS-07 | Are APIs protected by strong authentication + rate limiting? | Yes | `requireAuth()` + Upstash Redis rate limiting (`src/lib/ratelimit.ts`). |

### BCR — Business Continuity Management & Operational Resilience

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| BCR-01 | Is a BC/DR plan in place? | Partial | Cloudflare edge redundancy + Supabase point-in-time backups provide baseline recovery. Procedures are written in `documentation/runbooks/disaster-recovery.md`, which states plainly that **they have never been executed** and that its RTO/RPO figures are vendor estimates, not measurements. No formal business-continuity plan exists. Corrected 2026-07-29 — the prior answer cited `architecture/ARCHITECTURE.md`, which contains no BC/DR content. |
| BCR-02 | Are BC/DR tests conducted? | Partial | **Updated 2026-09-19 — a drill is now written and scheduled, and has not yet succeeded.** `.github/workflows/backups.yml` (added 2026-09-15) runs every Monday at 03:17 UTC and on demand, with four jobs: `d1-export`, `supabase-dump`, `d1-drill` (restore the export into a throw-away D1, verify every table's row count, delete it) and `supabase-drill` (`pg_restore` into a `postgres:17` container, same verification). Elapsed drill time is the measured RTO. **It has run once — 2026-09-15, manual — and failed after 41 seconds.** The repository's only Actions secret is `PERSONAL_PAT`; the workflow needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (required) and `SUPABASE_DB_URL` / `BACKUP_PASSPHRASE` (optional), none of which are set. So: automation exists, evidence does not. Sentry still covers degraded-state alerting. |
| BCR-03 | Are backups encrypted and tested? | Partial | Backups **are** encrypted in the sense that Supabase and Cloudflare encrypt their own managed copies at rest. **No restore has ever been verified**: `documentation/runbooks/disaster-recovery.md` and `MAINTENANCE.md` C-6 both record that no DR drill has ever completed, and the automated drill described in BCR-02 has not produced a green run. **Two further limits, confirmed 2026-09-19:** the Supabase organisation is on the **free** plan, so the runbook's "Dashboard → Backups → Restore" path is a paid-tier feature that does not exist for this project; and the `backups.yml` artifacts are only encrypted if `BACKUP_PASSPHRASE` is set, which it is not. Corrected 2026-07-29 — the prior answer was "Yes … tested", which the encryption half supports and the testing half does not. |
| BCR-04 | Are systems monitored for outages? | Yes | Sentry error tracking + Cloudflare native monitoring + `/api/health` endpoint. |
| BCR-05 | Is capacity monitored? | Yes | KV budget monitoring (`documentation/architecture/KV-RESILIENCE.md`); free-tier limits documented in `documentation/operations/OPERATIONS.md`. |
| BCR-06 | Are dependencies mapped for continuity? | Partial | Runtime dependencies are enumerated in `package.json` and a CycloneDX SBOM is produced on every CI run. Sub-processors are listed in `documentation/security/RoPA.md`. Cloudflare bindings are registered in `wrangler.toml` and `documentation/operations/OPERATIONS.md` §1, which was rebuilt from config on 2026-08-13 and is now complete (it had been missing `SYNC_QUEUE`, both DLQs, both service bindings and the AI binding). No continuity-specific dependency mapping (single points of failure, provider exit paths) exists; `compliance/ISO-27017-27018.md` records the missing provider exit plan as an open gap. Corrected 2026-07-29 — the prior answer cited `architecture/ARCHITECTURE.md`, which enumerates neither dependencies nor service bindings. |

### CCC — Change Control & Configuration Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| CCC-01 | Are changes tested before production? | Yes | CI on every push to `main`: `quality.yml` (types:check, typecheck, ratchet/ESLint, gate self-tests, vitest, build, SBOM, blocking a11y), `security.yml` (`audit_gate.py`, secret scan, `rules_check.py`), `docs-quality.yml` (`docs_check.py`, markdownlint). No branch protection — see CCC-02. *(Corrected 2026-09-14: this row claimed "per-branch protection".)* |
| CCC-02 | Is a change-approval process documented? | **Partial** | **Corrected 2026-08-13 — there is no PR-review requirement.** `RULESAd.md` §12 mandates the opposite: *"DO NOT create new branches. ALWAYS push directly to `origin main`"*, with no branch protection. The real, documented gate is automated and pre-push: `npm run verify` (typecheck, ratchet/ESLint, the full vitest suite, gate self-tests, `rules_check`, `docs_check`, markdownlint, `a11y_check`, `audit_gate`), and CI re-runs the same guards on `main`. *(2026-09-19: the exact test count — "855 as of 2026-09-14" — was dropped. A number that changes with the next commit and cannot be re-derived by the reader is not evidence.)* *Corrected 2026-08-23:* this row also cited a monorepo-root checklist script that is not part of this repository. That is a genuine change control, but it is a **machine** approval, not a second pair of human eyes. `SOC2-TSC-mapping.md` CC8.1 states this correctly and was contradicted by this row. |
| CCC-03 | Are unauthorized changes detected? | Partial | Git history; Cloudflare Worker version history; Workers Builds deploys only from `main`. There is **no** branch protection (CCC-02), so force-push is not prevented. *(Corrected 2026-09-14.)* |
| CCC-04 | Is configuration baseline maintained? | Yes | `wrangler.toml` + `documentation/operations/OPERATIONS.md` binding registry. |
| CCC-05 | Are separation-of-duty controls enforced? | **Partial** | **Corrected 2026-08-13.** *Within the application*, yes: the six-tier role ladder (`vendor_support > owner > admin > manager > staff > viewer`, `architecture/plac-and-audit.md` §1.1) plus PLAC per-page overrides genuinely separate duties between portal users, and some destructive operations refuse self-targeting (`users/force-kick`, `users/access`, `users/manage`, `audit/requests/[id]/resolve`). *In the deployment pipeline*, no: a single operator writes, approves and ships every change. Do not present this as an organisational SoD control. |

### CEK — Cryptography, Encryption & Key Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| CEK-01 | Is data at rest encrypted? | Yes | Cloudflare D1/KV/R2 native encryption at rest; Supabase managed encryption. |
| CEK-02 | Is data in transit encrypted (TLS)? | Yes | HTTPS-only + HSTS `max-age=63072000; includeSubDomains; preload`. |
| CEK-03 | Are approved crypto algorithms used? | Yes | Web Crypto SubtleCrypto — SHA-256 (IP hashing), `RSASSA-PKCS1-v1_5` / RS256 (Cloudflare Access JWT verification) and HMAC-SHA256 — enforced by SEC-10. *(Corrected 2026-09-19: this row said "RSA-256", which is not an algorithm name; `ASVS-L2.md` 6.2.2 fixed the same wording on 2026-09-14 and CAIQ was not updated with it.)* |
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
| DSP-01 | Is data classified and tracked? | Partial | The data inventory is `documentation/security/RoPA.md`; there is no written classification into tiers (`PRIVACY.md` documents the consent dashboard, not a classification). *(Corrected 2026-09-14 — the previous answer pointed at a classification that does not exist.)* |
| DSP-02 | Are data-retention policies enforced? | **Partial** | **Corrected 2026-09-19 — "Yes" contradicted this document's own LOG-03.** Retention *targets* are registered per table in `src/lib/retention-tables.ts`, whose header states the owner policy verbatim: *"NO data is ever auto-purged. Everything here is target/informational."* Only two things are actually enforced without a human: the weekly R2 asset cleanup (`src/workers/scheduled-asset-cleanup.ts`, with `email-attachments/` protected) and the 180-day purge of `storage_share_access_logs` in the same worker. Everything else — including `admin_audit_log` and `admin_login_logs` — is deleted only when an operator runs `/api/audit/prune` or the Retention Review tool by hand. |
| DSP-03 | Are data-subject rights honored (GDPR/LFPDPPP)? | Yes | Privacy dashboard, consent records, deletion + export flows. |
| DSP-04 | Are logs privacy-safe? | Yes | Sentry `sendDefaultPii: false`; IP hashed via `hashIp()` (`src/lib/audit-helpers.ts`). |
| DSP-05 | Are cross-border transfers governed? | Yes | Data resides in US-East (Supabase) + Cloudflare's global edge; PII limited to authorized-user emails + admin-generated content. |
| DSP-06 | Is data deleted on request? | Yes | Privacy request handler + Supabase RLS-enforced deletes. |
| DSP-07 | Are data-sharing agreements documented? | Partial | Sub-processors are enumerated with transfer mechanisms in `documentation/security/RoPA.md` §3 — **the authoritative list, nine entries** — and mirrored in `compliance/data-residency.md` §2; each vendor's published DPA terms apply. *(Corrected 2026-09-19: this row listed five of them — Cloudflare, Supabase, Upstash, Sentry, Brevo — omitting Resend, PostHog, OpenRouter and Google. An incomplete Art. 28 list in a buyer-facing questionnaire is a substantive error, so the list is now cited rather than restated.)* **Countersigned DPAs are being collected individually and are available on request once held.** `data-residency.md` notes that relying on published terms is weaker evidence than a signed agreement. Corrected 2026-07-29 — the prior answer read "DPAs on file". |

### GRC — Governance, Risk & Compliance

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| GRC-01 | Is a compliance/governance program in place? | Yes | `RULESAd.md` — governance codified as CI-enforced rules. |
| GRC-02 | Are regulatory obligations tracked? | Yes | GDPR + Mexican LFPDPPP tracked in `documentation/security/RoPA.md` and `runbooks/incident-response.md` (`PRIVACY.md` only names them). |
| GRC-03 | Are internal audits conducted? | Yes | **Quarterly cadence**, plus an ad-hoc review on any significant architectural change. Evidence: the dated snapshots in `documentation/security/reviews/` (2026-04-24 → 2026-07-17) **and** the later passes filed under `documentation/records/` — `reports/2026-08-02-ui-consolidation-and-security-remediation.md` and `reports/2026-09-07-audit-log-hardening-sentry-and-dev-server.md`, plus `reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`. *(Corrected 2026-09-19: citing only `security/reviews/` made the cadence look as if it stopped in July, which understates it.)* Corrected 2026-07-29 — the prior answer claimed a monthly cadence that the actual review dates (2026-04-24, 05-24, 05-25, 05-26, 06-13, 07-17) do not support. Quarterly is what a single-operator team can sustain and evidence. |

### HRS — Human Resources

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| HRS-01 | Are background checks performed on staff with system access? | Partial | Owner-only currently; staff onboarding process documented per contract. |
| HRS-02 | Is security awareness training provided? | Partial | AI-agent + human operators guided by `RULESAd.md`. |
| HRS-03 | Are acceptable-use policies signed? | Yes | GitHub organization TOS + `RULESAd.md` §12. |
| HRS-04 | Is access revoked on offboarding? | Yes | Force-kick + session flush + CF Access revocation — `documentation/features/SESSION-MANAGEMENT.md`. |

### IAM — Identity & Access Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| IAM-01 | Is IAM policy documented? | Yes | `documentation/architecture/plac-and-audit.md` + `documentation/features/USER-MANAGEMENT.md`. |
| IAM-02 | Is access reviewed periodically? | Yes | 30-min automatic role recheck; per-user PLAC overrides audited via Ghost Audit. |
| IAM-03 | Is MFA enforced for privileged accounts? | **Partial** | **Corrected 2026-09-19.** Same fact as AIS-02: One-Time PIN is an accepted Cloudflare Access identity provider and is single-factor, and no Access policy in this repository requires MFA for any role. Privileged accounts are constrained by the `admin_authorized_users` allowlist and the role ladder, which is a real control — it is just not a second factor. |
| IAM-04 | Are shared/generic accounts forbidden? | Yes | Every user has unique CF sub-id → Supabase user row → RBAC role. |
| IAM-05 | Are privileged operations logged? | Yes | Ghost Audit — role changes, PLAC overrides, force-kicks, session revocations, exports. |
| IAM-06 | Is separation of duties enforced? | **Partial** | Application-layer only — see CCC-05. Role hierarchy + PLAC page-level gates + type-to-confirm on destructive operations, and privileged actions cannot target the actor's own account. No pipeline-level SoD (single operator). |
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
| LOG-02 | Are logs tamper-evident? | **No** | **Corrected 2026-08-13 — the previous answer used wording this project explicitly bans.** `architecture/plac-and-audit.md` §3.2 forbids describing the audit log as "tamper-evident", "immutable" or "append-only", `MAINTENANCE.md` C-9 records why, and a copy-lint rule in the Velox repo fails the build if those words return in marketing. **Store, corrected 2026-09-19:** the audit trail is `admin_audit_log` in **Cloudflare D1** (`migrations/0000_baseline.sql`; `store: 'd1'` in `src/lib/retention-tables.ts`), written through the Worker's `DB` binding. This row previously credited "Supabase RLS restricts these tables to `service_role`" — **D1 has no row-level security**, so that control does not apply to this log at all. Supabase RLS is real, but it protects the Supabase-side tables (authorized users, consent records, ARCO tickets), not the audit trail. The controls that **do** exist for `admin_audit_log`: every write goes through one insert-only application path (`auditLog()`), the table name is validated against an internal whitelist because D1 cannot parameterise it, and audit suppression was removed entirely on 2026-07-26 so coverage cannot be switched off. The controls that **do not** exist: no hash chain, no sequence numbers, no signatures, no WORM storage — and `admin_audit_log` is a purge target in `src/lib/retention-tables.ts` with three live delete paths (`/api/audit/logs` DELETE, `/api/audit/prune`, `/api/audit/delete-targeted`). **Who can alter history undetectably:** any holder of a Cloudflare API token with D1 access, or of dashboard access to the account, can run arbitrary SQL against the table — not, as this row used to say, a holder of `SUPABASE_SERVICE_ROLE_KEY`. For a single-operator deployment that is the same person who owns the trail, so no separation of duties protects it. This is not hypothetical: the table was cleared through the application's own bulk-delete endpoint on 2026-09-18 — see LOG-03. |
| LOG-03 | Is log retention documented? | Yes | Retention registry in `src/lib/retention-tables.ts` (targets: `admin_audit_log` 180 d, `admin_login_logs` 365 d; nothing is auto-purged, deletion is a manual `/api/audit/prune` run whose `days` param defaults to 30); `storage_share_access_logs` purged at 180 d by the Sunday cron; Sentry 90-day. *(Re-stated 2026-09-14.)* **Retained history, measured 2026-09-19:** `admin_audit_log` holds **7 rows**, the oldest of which — `2026-09-18 04:49:11` UTC, action `delete`, module `logs` — is the bulk-delete event that cleared everything before it. The registered 180-day target is therefore a target only; the trail an assessor could sample today is under two days deep. |
| LOG-04 | Are logs correlated / SIEM-fed? | Partial | Sentry serves as SIEM-lite; no dedicated SIEM yet. |
| LOG-05 | Are alerts triggered on anomalies? | Yes | Sentry rules + login-forensics suspicious flagging (`src/components/admin/users/sessions/sessionRisk.ts`). |

### SEF — Security Incident Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| SEF-01 | Is an IR plan documented? | Yes | `documentation/runbooks/incident-response.md` (severity classification, roles, notification targets and deadlines) plus the per-failure runbooks. *(Updated 2026-09-14; the runbook post-dates this row. SEF-04 stays No — never exercised in a drill.)* |
| SEF-02 | Are IR roles assigned? | Yes | Owner (harshil) + AI agent (Claude) as documented in RULESAd.md. |
| SEF-03 | Is incident detection automated? | Yes | Sentry error tracking + login forensics suspicious flags. |
| SEF-04 | Are IR exercises performed? | No | Not yet. Follow-up. |
| SEF-05 | Are lessons learned documented? | Yes | Post-incident notes live in `documentation/operations/incidents/` (for example `2026-09-12-cf-access-sync-gateway-timeout.md`). *(Pointer corrected 2026-09-19: this row cited `documentation/security/reviews/`, which holds scheduled deep reviews, not incident write-ups.)* |

### STA — Supply Chain Management, Transparency & Accountability

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| STA-01 | Are third parties assessed? | Partial | The sub-processor list is `documentation/security/RoPA.md` §3 (nine entries). The major platform vendors — Cloudflare, Supabase, Upstash, Sentry — publish SOC 2 / ISO 27001 attestations; **no vendor report has been read or filed here**, so this is reliance on published claims, not an assessment. *(Corrected 2026-09-19: this row restated five of the nine sub-processors; see DSP-07.)* |
| STA-02 | Is supply-chain risk tracked? | Yes | `npm audit --omit=dev` on every push + weekly cron. |
| STA-03 | Are SBOMs generated? | **Yes** | **Corrected 2026-08-13 — this row contradicted BCR-06 in this same document.** A CycloneDX SBOM is generated on every CI run (`.github/workflows/quality.yml`, `npm sbom --sbom-format cyclonedx --sbom-type application`) and uploaded as the `sbom-cyclonedx` artifact; `npm run sbom` produces it locally. |
| STA-04 | Is source-code integrity enforced? | Yes | GitHub commit signing recommended; secret-scan CI blocks credential commits. |

### TVM — Threat & Vulnerability Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| TVM-01 | Are vulnerabilities scanned? | Yes | Weekly `npm audit`, Supabase advisor MCP, `rules_check.py`. |
| TVM-02 | Are patches applied timely? | Yes | `audit_gate.py` blocking in CI and weekly; Dependabot monthly groups; 6 documented high/critical exceptions with an expiry, 0 unexcepted on 2026-09-14 (`MAINTENANCE.md` C-14). |
| TVM-03 | Are pen tests performed? | No | Follow-up — external engagement not yet budgeted. |
| TVM-04 | Are secure defaults used? | Yes | Fail-closed API deny; SameSite=Strict cookies; nonce-based CSP. |

### UEM — Universal Endpoint Management

| # | Question | Ans | Evidence |
|---|----------|-----|----------|
| UEM-01 | Are endpoints managed via central policy? | Inherited | Cloudflare Zero Trust device posture check on operator devices. |
| UEM-02 | Are BYOD policies documented? | Partial | Zero-Trust posture check enforces baseline. |

---

## Submission checklist

- [ ] **Map each answer below onto the official CAIQ v4.0.3 question IDs**
      (`A&A-01.1`, `AIS-04.3`, …). The rows in this file are CCM control-domain
      codes, one per domain topic, not one per CAIQ assertion — see *Submission
      format* above. Nothing can be uploaded until this is done.
- [ ] Copy answers into the CSA CAIQ v4.0.3 workbook (Excel).
- [ ] Register at <https://cloudsecurityalliance.org/star/registry/>.
- [ ] Submit workbook + this URL as evidence attachment.
- [ ] Once approved (typically <2 weeks), our listing appears at
      `https://cloudsecurityalliance.org/star/registry/madagascar-hotel`.

*Refreshed 2026-07-08 post-compliance-wave; rows re-verified against the repo on 2026-09-14 (twelve corrections, each marked inline; vendor attestations, DPAs and GitHub settings were not re-checked).*

*2026-09-19 pass — ten rows changed, each marked inline.* **AIS-02 and IAM-03
Yes → Partial** (One-Time PIN is an accepted single-factor identity provider,
`SECURITY.md` §1.1). **DSP-02 Yes → Partial** (`src/lib/retention-tables.ts`
states that nothing is auto-purged). **LOG-02 store attribution rewritten** —
`admin_audit_log` is D1, not Supabase, so RLS was never protecting it.
**BCR-02/03 updated in our favour and against it**: `.github/workflows/backups.yml`
exists and is scheduled weekly, and it has never completed. Sub-processor lists
in DSP-07/STA-01 now cite `RoPA.md` §3 instead of restating five of nine.
A&A-05, SEF-05, GRC-03, CEK-03 and the §"Submission format" ID caveat corrected.
Checked today: the workflow file and its required secrets; `sync-docs.yml`'s
exclusion list; `migrations/0000_baseline.sql`; `src/lib/audit.ts`
(`ALLOWED_AUDIT_TABLES`); the three audit delete paths; a live
`SELECT COUNT(*), MIN(created_at) FROM admin_audit_log` (7 rows, oldest
`2026-09-18 04:49:11`). Still not checked: vendor SOC 2 / ISO 27001 reports,
countersigned DPAs, GitHub repository settings, and Cloudflare Access policy
contents.

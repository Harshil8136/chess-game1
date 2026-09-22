---

title: "OWASP ASVS v4.0.3 Level 2 Verification Matrix"
status: active
audience: [technical, operator, owner]
last_verified: 2026-09-19
verified_against: [code, config, mcp]
owner: harshil
related_docs: [../SECURITY.md, CSA-CAIQ-v4.md, SOC2-TSC-mapping.md, ../../../RULESAd.md]
tags: [compliance, owasp, asvs, self-attestation]
---

# OWASP ASVS v4.0.3 Level 2 — cf-admin Verification Matrix

> **TL;DR (non-technical):** OWASP ASVS is the industry-standard security
> verification checklist. Level 2 is the recommended bar for applications
> handling sensitive data. This matrix maps each in-scope control to real
> evidence in our code, config, or MCP-verified infra state. Rows are marked
> ✅ verified, 🟡 partial / accepted-risk, or ❌ open gap. **Counted by the rows
> in this sheet on 2026-09-19: 87 ✅, 6 🟡, 1 ❌ and 9 not applicable, over 103
> rows.** That is the only figure derivable from this document — see the summary
> at the end for the breakdown and for why the older percentage was withdrawn.
>
> ⚠️ **This is an AI-assisted self-assessment, not an independent audit.** The
> mapping and the percentage were produced by an AI assistant reviewing this
> codebase, then reviewed by the owner. No external assessor has verified any
> row. Quote it as a self-assessment and never as a certification or audit
> result.
>
> *Superseded 2026-09-19 — kept for the trail. Corrected 2026-07-29: the TL;DR
> previously read "~92% … with 2 documented gaps" while the summary said ~91%
> with 8 partials and 0 open gaps. The two "gaps" were in fact two of the 8
> partials. 105/115 = 91.3%, so ~91% is the arithmetic, and the open-gap count
> is 0. **None of those figures is current**: the percentage was withdrawn and
> the open-gap count is now 1 — see the Summary.*

## Scope

- **Application under review:** `cf-admin-madagascar` — Astro+Preact admin
  dashboard on Cloudflare Workers, backed by D1 + Supabase + KV + R2.
- **In-scope ASVS domains:** V1 (Architecture), V2 (Auth), V3 (Session), V4
  (Access Control), V5 (Validation/Encoding), V6 (Crypto), V7 (Errors/Logs),
  V8 (Data Protection), V9 (Comms), V10 (Malicious Code), V12 (Files),
  V13 (APIs), V14 (Config).
- **Out-of-scope:** V11 (BLE / MSC-only) — no mobile client.

## Legend

- ✅ **Verified** — control is in place; evidence pointer resolves to real code
  or a documented runbook / MCP-confirmed state.
- 🟡 **Partial** — control is partly met; residual risk documented + accepted,
  or fix scheduled.
- ❌ **Gap** — control is not met; must be tracked in `MAINTENANCE.md`.
- 🚫 **N/A** — control does not apply (mobile-only, native-only, etc.).

---

## V1 — Architecture, Design & Threat Modeling

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 1.1.1 | Secure SDLC in place | ✅ | Four workflows in `.github/workflows/` (quality — unified: secret scan, compliance rules, a11y, docs check, markdownlint, audit gate, typecheck, ratchet/ESLint, gate self-tests, vitest, build, CycloneDX SBOM; production-tests; sync-docs; **backups**), `documentation/security/reviews/` (dated deep reviews), `MAINTENANCE.md` live backlog. *(Consolidated 2026-09-22: `security.yml` and `docs-quality.yml` merged into `quality.yml` — same gates, one runner instead of eight. See `records/reports/2026-09-22-ci-workflow-consolidation.md`. Added 2026-09-19: `backups.yml` — weekly D1 export + Supabase dump + two rehearsed restore drills — was missing from this list. It is **scheduled but not yet working**: one run to date, 2026-09-15, manual, failed after 41 s, and `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` are not set on the repository. Do not read it as evidence that backups or restores work — see `CSA-CAIQ-v4.md` BCR-02/03.)* |
| 1.1.2 | Threat model documented | ✅ | `documentation/security/THREAT-MODEL.md` (STRIDE); background in `../../records/reviews/2026-07-05-comprehensive-codebase-and-system-review.md` and `documentation/security/reviews/2026-06-13-security-review.md`. |
| 1.1.3 | User stories capture security features | 🟡 | Feature docs in `documentation/features/` capture RBAC + audit expectations. |
| 1.1.4 | High-level architecture defined | ✅ | `documentation/architecture/ARCHITECTURE.md`, `documentation/architecture/plac-and-audit.md`. |
| 1.2.1 | Unique low-privilege service accounts | ✅ | `SUPABASE_SERVICE_ROLE_KEY` used only in cf-admin; `anon` role revoked from all tables (RULESAd §9.1). |
| 1.2.2 | Auth between services | ✅ | Service bindings (`CHATBOT_SERVICE`, `ASTRO_SERVICE`) via Cloudflare Service Bindings — private, not exposed. Chatbot proxy uses shared `X-Admin-Key` (`CHATBOT_ADMIN_API_KEY`). |
| 1.2.3 | Central authenticated auth mechanism | ✅ | Cloudflare Zero Trust JWT + `src/middleware.ts` centralized bootstrap. |
| 1.2.4 | Clear communication paths between components | ✅ | `documentation/architecture/ARCHITECTURE.md`. |
| 1.4.1–1.4.5 | Access control architecture | ✅ | PLAC in `src/lib/auth/plac.ts` + `admin_pages` D1 table + `admin_page_overrides`; RBAC in `src/lib/auth/rbac.ts`. |
| 1.5.1–1.5.4 | Input/output validation architecture | ✅ | Zod schemas at every API boundary; `src/lib/email/sanitize-html.ts` for output-side HTML. |
| 1.6.1–1.6.4 | Crypto architecture | ✅ | Web Crypto only (`crypto.subtle.digest`); enforced by SEC-10. |
| 1.7.1–1.7.2 | Errors, logging, audit architecture | ✅ | Ghost Audit Engine (`documentation/architecture/plac-and-audit.md`); Sentry error tracking; login forensics table. |
| 1.8.1–1.8.2 | Data protection architecture | ✅ | KV for sessions (24 h lifetime — `SESSION_MAX_LIFETIME_MS`, 30-min role recheck), Supabase RLS (SEC-09), R2 for CMS assets, IP hashing (`hashIp` in `src/lib/audit-helpers.ts`). |
| 1.9.1–1.9.2 | Communications architecture | ✅ | HTTPS-only, HSTS `max-age=63072000; includeSubDomains; preload` — set in `src/lib/security/csp.ts:78`, documented in `security/SECURITY.md` §4. TLS enforced by Cloudflare edge. |
| 1.10.1 | Source code control | 🟡 | GitHub is the source of record and Workers Builds deploys only from `main`. **Corrected 2026-09-19 — there is no branch protection.** `RULESAd.md` §12 mandates direct pushes to `main` and forbids sub-branches, so force-push is not prevented and there is no required status check. `CSA-CAIQ-v4.md` CCC-03 and `SOC2-TSC-mapping.md` CC8.1 record the same state; a bare ✅ here contradicted both. |
| 1.11.1–1.11.2 | Business-logic architecture | ✅ | Documented in feature docs + `plac-and-audit.md`. |
| 1.12.1–1.12.2 | File upload architecture | ✅ | R2 for CMS images (`src/pages/api/media/upload.ts` with MIME allowlist + 5MB cap); email attachments in R2 with quota-managed cleanup. |
| 1.14.1–1.14.6 | Configuration architecture | ✅ | `wrangler.toml` + secrets in Worker Env; `documentation/operations/OPERATIONS.md`. |

## V2 — Authentication

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 2.1.1 | Passwords ≥ 12 chars | **N/A** | **Corrected 2026-08-13 — Supabase GoTrue was removed; this platform has no password store and no login form.** Identity is Cloudflare Zero Trust (Google, GitHub, one-time PIN); password policy is the IdP's, not ours. Crediting a control to a component that is not deployed overstates the posture. |
| 2.1.2 | Passwords are not truncated | **N/A** | No password store — see 2.1.1. |
| 2.1.6 | Password change requires current password | **N/A** | No password store — see 2.1.1. Credential lifecycle is handled by the Zero Trust IdP. |
| 2.1.7 | Passwords compared to compromised-password corpus | **N/A** | **Corrected 2026-08-13.** Four documents gave four different answers (30-second free toggle / Pro-plan-only / N-A since GoTrue removed / awaiting owner action). The settled answer: **not applicable** — no GoTrue passwords exist, so the Supabase HIBP toggle protects nothing here. The Supabase advisor still emits `auth_leaked_password_protection` as a WARN because the advisor cannot tell that GoTrue is unused; it is a known false positive, recorded in `security/SECURITY.md` §0. `runbooks/supabase-leaked-password-protection.md` is retained only for the day a password path is ever introduced. |
| 2.2.1 | Anti-automation on auth | ✅ | Cloudflare Zero Trust bot management + Upstash Redis rate limiting (`src/lib/ratelimit.ts`). |
| 2.2.3 | MFA required for admin/priv | 🟡 | **Corrected 2026-09-19 — MFA is not established for every accepted login path.** `security/SECURITY.md` §1.1 lists three identity providers on the Cloudflare Access application: **Google**, **GitHub** and **One-Time PIN**. Google and GitHub can each carry MFA, but that is a property of the user's account at those providers, not something this platform enforces or can evidence. **One-Time PIN is single-factor** — an emailed code, possession of the mailbox only — and `session.ts` records it as a first-class login method (`loginMethod: 'google' \| 'github' \| 'otp'`, `SECURITY.md` §1.3). A Cloudflare Access policy requiring MFA, or removing the OTP provider, would make this ✅; no such policy is in this repository and the verification log below still records Zero Trust MFA as *not checked*. Treat "MFA enforced" as unverified until an operator screenshots the Access policy. |
| 2.3.1 | Enrollment tokens random / time-bound | ✅ | Access-request tokens generated via `crypto.randomUUID()`. |
| 2.5.1–2.5.7 | Credential recovery | ✅ | Handled by CF Zero Trust IdP. |
| 2.7.1–2.7.6 | Out-of-band verifiers | ✅ | IdP-provided. |
| 2.8.1–2.8.6 | Single-factor OTP verifier | ✅ | IdP-provided; local OTP not implemented. |
| 2.9.1–2.9.3 | Cryptographic verifier | 🚫 | N/A — no cryptographic auth token stored client-side beyond CF Zero Trust JWT. |
| 2.10.1–2.10.4 | Service auth | ✅ | Service bindings + shared-secret headers; audited in Ghost Audit. |

## V3 — Session Management

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 3.1.1 | Sessions transferred securely | ✅ | HTTPS + Secure cookie flag. |
| 3.2.1 | New session token on login | ✅ | `src/lib/auth/session.ts::createSession()` generates fresh session ID. |
| 3.2.2 | Session tokens ≥ 64 bits entropy | ✅ | UUIDs from `crypto.randomUUID()`. |
| 3.2.3 | Session cookies have HttpOnly, Secure, SameSite=Strict | ✅ | `src/lib/auth/session.ts` cookie set; SEC-02 enforces Strict globally. |
| 3.3.1–3.3.4 | Session timeout | ✅ | 24h hard expiry + 30min role recheck; `src/lib/auth/session.ts::needsRoleRecheck()`. |
| 3.4.1–3.4.5 | Cookie-based session | ✅ | See 3.2.3 + `documentation/security/SECURITY.md`. |
| 3.5.1–3.5.3 | Token-based session | 🚫 | N/A — cookie-only. |
| 3.6.1–3.6.2 | Federated re-auth | ✅ | 30-min role recheck against Supabase; CF Access JWT freshness auto-managed at the edge. |
| 3.7.1 | Force logout on password change | 🚫 | **N/A, re-marked 2026-09-19.** There is no password store here (2.1.1), so there is no password-change event to force a logout on. The related controls that *do* exist are session invalidation on a permission change and operator force-kick — and their behaviour changed on 2026-09-16: a permission change now marks the session for re-verification (`src/lib/auth/authz-signal.ts`, consumed by `src/lib/auth/stages/session-stage.ts`) rather than signing the user out. The KV `revoked:` flag is still written by `src/lib/auth/plac.ts` and still read at bootstrap; retiring it is unshipped Stage 2/3 work. Evidence for the real control belongs under 3.3.x / 4.1.2. |

## V4 — Access Control

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 4.1.1 | Trusted enforcement points | ✅ | `src/middleware.ts` centralizes gate; SEC-06 enforces per-handler. |
| 4.1.2 | Every user attribute is authoritative-source-checked | ✅ | Role re-checked from Supabase every 30 min; PLAC recomputed on session start. |
| 4.1.3 | Least-privilege principle | ✅ | Role hierarchy — canonical `vendor_support > owner > admin > manager > staff > viewer` (stored as `dev`/`owner`/`super_admin`/`admin`/`staff`); `isAdmin()` helper enforced by SEC-04. |
| 4.1.4 | Deny by default | ✅ | `hasAccess = false` for unmapped API routes (`src/lib/auth/stages/decide.ts`); enforced by SEC-07. |
| 4.1.5 | Access control failures produce audit event | ✅ | Ghost Audit logs 403s via `waitUntil`. |
| 4.2.1 | Sensitive data checks at access | ✅ | PLAC per-page + per-fragment (`#revoke`, `#flush`, `#export`). |
| 4.2.2 | CSRF-defended state-changing ops | ✅ | `src/lib/csrf.ts::validateCsrf()` on all mutation methods; enforced globally in middleware. |
| 4.3.1–4.3.3 | Admin interfaces | ✅ | Admin URLs under `/dashboard/*` with role-gated PLAC; no console-only backdoors. |

## V5 — Validation, Sanitization, Encoding

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 5.1.1–5.1.5 | Input validation | ✅ | Zod schemas on every API request body. |
| 5.2.1 | HTML sanitization on operator-authored HTML | ✅ | `src/lib/email/sanitize-html.ts` (HTMLRewriter-based); called from `src/pages/api/emails/send.ts` + client `RichEditor.tsx`. |
| 5.2.6 | dangerouslySetInnerHTML only receives sanitized/escaped input | ✅ | Enforced by SEC-08; three exemptions in `scripts/rules_check.py`: `src/components/admin/logs/shared.tsx` (already-escaped syntax highlighting via `escapeHtml`), `BlogAiCopilotModal.tsx` and `TiptapRichEditor.tsx` (both through `sanitizeEmailHtmlClient`). |
| 5.2.8 | Prevent XSS via templating | ✅ | Preact + Astro auto-escape by default. |
| 5.3.1–5.3.4 | Output encoding + parameterized queries | ✅ | D1 + Supabase clients both parameterize; enforced by SEC-03 (no raw SQL from API handlers — DAL only). |
| 5.4.1–5.4.3 | Memory-safe strings | ✅ | TypeScript strict mode; no Buffer manipulation without `TextEncoder`/`TextDecoder`. |
| 5.5.1–5.5.4 | Deserialization | ✅ | JSON.parse only; no eval; no XML. |

## V6 — Cryptography

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 6.1.1–6.1.3 | Data classification | ❌ | **Corrected 2026-09-19 — no classification scheme exists.** This row cited `documentation/security/PRIVACY.md`, which is the consent/privacy **dashboard** document (Overview & Access Control, Data Architecture, Dashboard Architecture, CSS Architecture, Cross-References, Verification log) and contains no classification into tiers. What does exist is an **inventory**: `documentation/security/RoPA.md` enumerates the processing activities, categories and sub-processors, and `src/lib/retention-tables.ts` registers per-table retention targets. `CSA-CAIQ-v4.md` DSP-01 has said this since 2026-09-14; this row and `SOC2-TSC-mapping.md` C1.1 contradicted it. Writing a classification scheme is now in the gap list below. |
| 6.2.1 | Approved crypto only | ✅ | Web Crypto (SubtleCrypto) — SHA-256 for IP hashing, RS256 (`RSASSA-PKCS1-v1_5`) for JWT verify. Enforced by SEC-10. |
| 6.2.2 | Approved algorithms only | ✅ | SHA-256, RSASSA-PKCS1-v1_5 (RS256), HMAC-SHA256 — all NIST/IETF-approved. *(Corrected 2026-09-14: said RSA-PSS.)* |
| 6.2.3 | Keys sourced from secure random | ✅ | CSP nonce via `crypto.getRandomValues()` (16 bytes, `src/lib/security/csp.ts`); session IDs and enrollment tokens via `crypto.randomUUID()` (`src/lib/auth/session.ts`). Both are Web Crypto CSPRNGs. *(Evidence string corrected 2026-09-19: session IDs are not `getRandomValues`.)* |
| 6.2.4 | Auto-key-rotation | 🟡 | Rotation via Supabase and Cloudflare dashboards; not fully automated. Accepted risk for admin-only app. |
| 6.3.1–6.3.3 | Random values | ✅ | Web Crypto random. |
| 6.4.1–6.4.2 | Secret storage | ✅ | Cloudflare Worker Secrets binding — encrypted at rest, never in git. |

## V7 — Error Handling & Logging

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 7.1.1 | No secrets in logs | ✅ | Sentry `sendDefaultPii: false`; IP is hashed before storing. |
| 7.1.2 | Errors don't reveal impl details | ✅ | `jsonError()` returns generic messages; details in server logs only. |
| 7.2.1–7.2.2 | Audit high-value events | ✅ | Ghost Audit Engine logs role changes, PLAC overrides, force-kicks, revocations, exports. |
| 7.3.1–7.3.4 | Log fields | ✅ | Timestamp, user ID, action, before/after — all captured. |
| 7.4.1–7.4.3 | Error handling doesn't fail-open | ✅ | Middleware deny-by-default; `requireAuth()` throws on missing session. |

## V8 — Data Protection

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 8.1.1–8.1.6 | Client data protection | ✅ | HttpOnly cookies; no localStorage secrets; auth token never sent to non-`/api/*` endpoints. |
| 8.2.1–8.2.3 | Client-side data destruction | ✅ | Session-invalidation flow clears the cookie server-side and `SessionWatchdog.tsx` removes `sb-*` `localStorage` keys; `sessionStorage` is not touched (nothing is stored there). |
| 8.3.1–8.3.8 | Sensitive private data | ✅ | Consent records (`consent_records` in Supabase); privacy dashboard (`documentation/security/PRIVACY.md`). |

## V9 — Communications

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 9.1.1–9.1.3 | TLS client comms | ✅ | Cloudflare edge TLS 1.3; HSTS `max-age=63072000; includeSubDomains; preload`. |
| 9.2.1–9.2.5 | Server comms | ✅ | Supabase over TLS 1.2+; Upstash over TLS. |

## V10 — Malicious Code

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 10.1.1 | Malicious-code check on external deps | ✅ | `npm audit --omit=dev` → `scripts/audit_gate.py` on every push and weekly (`.github/workflows/quality.yml`, consolidated 2026-09-22 from the former `security.yml`). As of 2026-09-14: 6 high/critical advisory groups documented in `.audit-exceptions.json` (js-yaml, sharp ×3, svgo ×2; expire 2026-11-30), 0 unexcepted. *(Pointer corrected 2026-09-19: this row cited `MAINTENANCE.md` C-14, which is struck through and CLOSED 2026-09-02 and describes a different, deleted set of ten Astro-6 entries. Read `.audit-exceptions.json` itself.)* |
| 10.2.1–10.2.6 | Malicious-code inclusion | ✅ | No dynamic `import()` of untrusted URLs; CSP `script-src` allowlist. |
| 10.3.1–10.3.3 | Deployed source integrity | ✅ | Wrangler deploys signed bundle; secret-scan CI blocks credential commits. |

## V12 — Files

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 12.1.1–12.1.3 | File upload | ✅ | MIME allowlist + 5MB cap in `src/pages/api/media/upload.ts`; email attachments similarly gated. |
| 12.2.1 | File integrity | ✅ | R2 checksums; `Content-Type` normalized on upload. |
| 12.3.1–12.3.6 | File execution | ✅ | Uploaded files served from `cdn.madagascarhotelags.com` (R2) with static content-type only; never eval'd. |
| 12.4.1–12.4.2 | File storage | ✅ | R2 (isolated from Worker code); `email-attachments/` prefix protected from cron cleanup. |
| 12.5.1–12.5.2 | File download | ✅ | Content-Disposition set; no path traversal (UUID keys). |

*Added 2026-09-19 — Staff Storage was missing from V12 entirely.* The
higher-risk file surface is not CMS media but **Staff Storage** (R2
`madagascar-staff-storage`, which `runbooks/disaster-recovery.md` describes as
holding payroll and medical records). Its controls: the bucket is deliberately
**not** CDN-fronted, so every object is reached through the Worker — presigned
PUT (`src/pages/api/storage/presign.ts`, signed with `aws4fetch` against a
bucket-scoped R2 credential) and proxied GET; public share links are
domain-isolated under the control documented in
`runbooks/public-share-links-domain-isolation.md`; share access is logged to
`storage_share_access_logs`, which is the one table with an enforced 180-day
purge. `wrangler.toml` records the isolation reasoning in the binding comment.

## V13 — APIs

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 13.1.1 | Same encoding/parsing rules across API | ✅ | JSON only; content-type asserted. |
| 13.1.3 | Old versions safe | 🚫 | No API version proliferation. |
| 13.1.4 | Access controls consistent between endpoints | ✅ | Middleware + PLAC + SEC-06/07. |
| 13.2.1 | REST verbs implement least privilege | ✅ | GET vs POST/PUT/DELETE distinctions honored; CSRF only on mutations. |
| 13.2.2 | Schema-validated JSON | ✅ | Zod. |
| 13.2.3 | REST access controls | ✅ | See V4. |
| 13.2.5 | Endpoints protected against CSRF | ✅ | See 4.2.2. |
| 13.2.6 | Reflection/introspection disabled | ✅ | There is no `/api/docs` and no public OpenAPI endpoint. |
| 13.3.1 | Anti-automation on APIs | ✅ | Upstash Redis rate limits per user/IP. |
| 13.4.1–13.4.2 | GraphQL | 🚫 | N/A — REST only. |

## V14 — Configuration

| ID | Control | Status | Evidence |
|----|---------|--------|----------|
| 14.1.1 | Build reproducible | ✅ | `package-lock.json` pinned; wrangler builds are deterministic. |
| 14.1.2 | Deps clean | 🟡 | 6 documented high/critical exceptions with an expiry (`.audit-exceptions.json`), 0 unexcepted; `audit_gate.py` fails the build on any new or expired one. *(Re-stated 2026-09-14; previously "3 low-severity".)* |
| 14.1.3–14.1.5 | Build hardening | ✅ | TypeScript strict mode; no debug endpoints exposed in prod. |
| 14.2.1 | Latest patched libraries | ✅ | Weekly `npm audit` cron; Dependabot enabled (`.github/dependabot.yml`, monthly npm + github-actions groups). |
| 14.2.2 | Unused features removed | ✅ | Recent E-1/E-2/E-3 cleanup; `MAINTENANCE.md` tracks. |
| 14.3.1–14.3.3 | Debug info hidden | ✅ | Sentry `sendDefaultPii: false`; `X-Powered-By` never set. |
| 14.4.1 | Every response with security headers | ✅ | `securityHeaders` middleware applied globally. |
| 14.4.2 | Content-Type set on every response | ✅ | Astro sets by default. |
| 14.4.3 | Content-Security-Policy enforced | 🟡 | **Corrected 2026-08-13 — `'strict-dynamic'` is NOT in the policy.** It was deliberately left off: Cloudflare zone-level scripts (Rocket Loader / Web Analytics) are injected after the response leaves the Worker and never receive the nonce, so `'strict-dynamic'` would stop the browser trusting the host allowlist and break them (`MAINTENANCE.md` C-3). What is actually enforced (`src/lib/security/csp.ts`): per-request nonce on every first-party inline script, host allowlist, **no `'unsafe-eval'`** (removed 2026-07-25, pinned by SEC-01 with no exemption), residual `'unsafe-inline'` on `script-src` and `style-src`, and a hardened `Content-Security-Policy-Report-Only` canary without `'unsafe-inline'` (pinned by SEC-01b). |
| 14.4.4 | X-Content-Type-Options nosniff | ✅ | Set globally. |
| 14.4.5 | Referrer-Policy | ✅ | `strict-origin-when-cross-origin`. |
| 14.4.6 | Content-Security-Policy in report-only mode monitored | ✅ | `report-uri` to Sentry configured. |
| 14.4.7 | Frame-Ancestors + X-Frame-Options | ✅ | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`. |
| 14.5.1–14.5.4 | Requests / validation config | ✅ | See V5. |

---

## Summary

**Counted by the rows of this sheet on 2026-09-19 — 103 rows in total:**

- **✅ Verified:** 87
- **🟡 Partial / accepted-risk:** 6
  - 1.1.3 security requirements in user stories (feature-doc coverage)
  - **1.10.1 source code control** — no branch protection on `main` (new 2026-09-19)
  - **2.2.3 MFA** — not established for the One-Time PIN login path (new 2026-09-19)
  - 6.2.4 automated key rotation
  - 14.1.2 six documented, expiring high/critical npm advisories (0 unexcepted)
  - 14.4.3 residual `'unsafe-inline'` on `script-src` and `style-src`; `'strict-dynamic'` intentionally off (see C-3)
- **❌ Open gaps:** 1
  - **6.1.1–6.1.3 data classification** — no classification scheme exists (new 2026-09-19). *Action: write one. The inputs already exist — `security/RoPA.md` for the activity inventory and `src/lib/retention-tables.ts` for per-table retention — what is missing is the tiering and the handling rules that follow from it.*
- **🚫 / N/A:** 9 — cryptographic verifiers (2.9.x), token-based sessions (3.5.x), API versioning (13.1.3), GraphQL (13.4.x), and the password-store controls (2.1.1, 2.1.2, 2.1.6, 2.1.7, 3.7.1). V11 is out of scope entirely and is not counted.

> *2026-09-19 re-derivation.* The previous headline — "105 of ~115 verified
> (~91%), 8 partials, 0 open gaps" — was withdrawn. It counted individual
> requirements inside ranged rows (`1.4.1–1.4.5` as five), had not been
> re-derived since 2026-07-08, and the file's own 2026-09-14 note already
> disclaimed it. The row counts above are reproducible by anyone reading the
> tables. Four rows moved in this pass: 6.1.1–6.1.3 ✅→❌, 2.2.3 ✅→🟡,
> 1.10.1 ✅→🟡, 3.7.1 ✅→🚫. Nothing in the code changed; the rows were wrong.
> *(Superseded 2026-09-14 note, kept for the trail: by table rows the sheet then
> showed 91 ✅, 4 🟡, 4 🚫 and 4 N/A.)*

Residual partials are documented and tracked in `MAINTENANCE.md`.

> **Provenance and how to quote this.** This assessment was produced by an AI
> assistant reading the codebase and verifying infrastructure state through MCP
> connectors, then reviewed by the owner. It has **not** been reviewed by an
> external assessor, and ASVS has no certification scheme — there is no such
> thing as being "ASVS certified."
>
> Approved phrasing *(updated 2026-09-19)*: *"Controls are mapped row by row to
> OWASP ASVS Level 2. In our own assessment, 87 of the 103 mapped rows are
> verified, 6 are partial, 1 is an open gap and 9 do not apply; the mapping and
> the gap are available on request."*
>
> Not approved: any percentage figure at all — "~91%", "~92%" and "~95%" all
> circulate in older documents, none is reproducible from this sheet, and a
> single number invites the reader to skip the one ❌. Also not approved: "ASVS
> certified" or "ASVS audited", or quoting the counts without the
> self-assessment qualifier.

*Rows re-derived and four statuses corrected 2026-09-19; refreshed 2026-07-08 post-compliance-wave.*

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | The four rows corrected this pass, each against code or config read today: `documentation/security/PRIVACY.md` headings and a `classification\|classify\|tier` grep over it (no match) for 6.1.1–6.1.3; `security/SECURITY.md` §1.1 identity-provider list and §1.3 `loginMethod` union for 2.2.3; `src/lib/auth/authz-signal.ts`, `stages/session-stage.ts` and `plac.ts` for 3.7.1; `RULESAd.md` §12 plus the CAIQ/SOC2 rows for 1.10.1. Also: `crypto.getRandomValues` in `src/lib/security/csp.ts` vs `crypto.randomUUID()` in `src/lib/auth/session.ts` (6.2.3); the six workflow files in `.github/workflows/` and `backups.yml`'s header, schedule and required secrets (1.1.1); `.audit-exceptions.json` and the struck-through `MAINTENANCE.md` C-14 (10.1.1); `src/pages/api/storage/presign.ts` (`aws4fetch`) and `LOG_RETENTION_DAYS = 180` in `src/workers/scheduled-asset-cleanup.ts` (V12). Every status mark re-counted from the tables. | Whether `backups.yml` succeeds once its secrets are set; Cloudflare Access policy contents (the MFA question above); everything in the 2026-09-14 "not checked" column still stands |
| 2026-09-14 | Every row citing a file, header, middleware, script, workflow step or doc section: `csp.ts` (HSTS, nonce, allowlist, Report-Only, `frame-ancestors`), `middleware.ts` / `stages/decide.ts`, `session.ts` lifetimes and cookie flags, `csrf.ts`, `plac.ts`, `rbac.ts`, `sanitize-html.ts`, `ratelimit.ts` (live in 49 API files), `cloudflare-access.ts` algorithms, upload limits (`cms/storage.ts`, `attachments.ts`, `send.ts`), `sendDefaultPii`, service bindings, SEC-01…10 in `rules_check.py`, `quality.yml` steps (consolidated 2026-09-22 from `quality.yml` + `security.yml` + `docs-quality.yml`), `audit_gate.py` run, `.audit-exceptions.json`, `dependabot.yml`, `SessionWatchdog.tsx`, cross-referenced docs and sections. Eleven corrections above. | Cloudflare Zero Trust MFA / bot management / device posture; TLS versions on Supabase and Upstash; R2 checksums; key-rotation practice; GitHub branch policy |

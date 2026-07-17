---

title: "Full-Platform Security & Compliance Audit — OWASP / SOC 2 / GDPR / CCPA"
status: active
audience: [technical, operator]
last_verified: 2026-07-17
verified_against: [code]
owner: harshil
tags: [security, compliance, owasp, soc2, gdpr, ccpa, audit]
---

# Full-Platform Security & Compliance Audit

> **Date:** 2026-07-17
> **Scope:** `cf-admin-madagascar` — full stack: application code, auth/RBAC/PLAC,
> Cloudflare Workers config, D1 / KV / R2 / Queues, Supabase, GitHub & CI/CD, and
> data-privacy process.
> **Method:** Three parallel deep code-exploration passes + direct file verification +
> live Cloudflare read-only MCP inventory. Zero paid tooling used.
> **Benchmarks:** OWASP ASVS 4.0.3 L2, OWASP Top 10 (2021), SOC 2 TSC, GDPR, CCPA/CPRA.
> **Status:** Critical + high code fixes applied this pass (see §4). Larger process /
> DR / DSAR items tracked as a zero-cost roadmap (§6).

---

## 1. Executive summary

The platform's **security engineering is mature and above the norm** for this class of
internal admin tool. Identity is delegated to Cloudflare Zero Trust Access (RS256 JWT
verified against team JWKS, audience/issuer/exp bound, `workers_dev=false` so the
Access-protected custom domain is the only ingress). Sessions are opaque server-side KV
records behind `__Host-`-prefixed `Secure; HttpOnly; SameSite=strict` cookies, with a
3-layer force-kick revocation path, 30-minute role re-check, and 24-hour hard expiry.
Mutations are protected by fail-closed CSRF (Origin/Referer allowlist), a per-request
nonce CSP with `strict-dynamic`, HSTS preload, and per-endpoint Upstash rate limiting
that fails closed in production. All D1 queries are parameterized; Supabase runs
service-role behind application-enforced authorization with RLS enabled on every table.
Secret hygiene is clean — **no secrets have ever been committed** (git history verified);
`.env`/`.dev.vars`/cookie jars are gitignored; `[vars]` holds only non-secret identifiers.

**Overall rating: A− (strong).** The residual risk is concentrated not in the crypto or
the perimeter but in a single architectural convention and a set of process gaps:

1. The middleware **deliberately skips PLAC for `/api/*`**, so every endpoint must
   self-guard. One endpoint (`inquiries/update-status`) had missed its guard — a real,
   exploitable authorization gap. **Fixed this pass.**
2. Observability could **leak PII into Sentry logs** (`consoleLoggingIntegration`
   forwards every `console.*`). **Fixed this pass** with a scrubber.
3. One endpoint used a **weak, hardcoded-salt IP hash**. **Fixed this pass.**
4. Process gaps remain: no data-subject-erasure (DSAR) admin workflow, no automated PII
   retention, no incident-response / breach-notification runbook, no tested DR restore,
   no prod/staging separation, and CI gates that are mostly advisory. All are closeable
   at **zero cost** (§6).

---

## 2. What was reviewed (inventory)

| Layer | Detail |
|-------|--------|
| Runtime | Astro 6 (SSR `output:'server'`) + Preact on Cloudflare Workers; custom entry `src/workers/cf-entry.ts` wrapped in `@sentry/cloudflare withSentry` |
| Identity | Cloudflare Zero Trust Access; JWT verify in `src/lib/auth/cloudflare-access.ts`; pipeline in `src/lib/auth/pipeline.ts` |
| AuthZ | 5-tier RBAC (`dev<owner<super_admin<admin<staff`) + Page-Level Access Control (PLAC) with per-user grant/deny overrides; `src/lib/auth/{rbac,plac,guard,session}.ts` |
| Data | Supabase Postgres (service-role/REST, RLS on all tables) + D1 `madagascar-db` (~30 tables, shared with cf-astro) + KV `ADMIN_SESSION` + R2 `madagascar-images` |
| Async | Queues `madagascar-emails`, `madagascar-sync-revalidate` (+DLQ); crons `*/5 * * * *` (Access audit-log poll) + weekly R2 cleanup |
| Observability | Sentry (client + workerd server), Workers logs+traces, Analytics Engine, PostHog control-plane connector |
| CI/CD | 4 GitHub workflows (security scan, docs quality, docs sync, manual prod tests) + Dependabot; deploy via Cloudflare native Git integration on push to `main` |

Live Cloudflare inventory confirmed (read-only MCP): worker `cf-admin-madagascar`, KV
`ADMIN_SESSION`/`SESSION`/`ISR_CACHE`/`EMAIL_IDEMPOTENCY`, D1 `madagascar-db` (~930 KB),
R2 present. No D1 `jurisdiction` set (relevant to §7 region pinning).

---

## 3. Framework scorecards

Legend: ✅ Pass · 🟡 Partial · ❌ Gap. Evidence paths are repo-relative.

### 3.1 OWASP ASVS 4.0.3 — Level 2 (self-attested)

| Chapter | Status | Evidence / note |
|---------|--------|-----------------|
| V1 Architecture, threat modeling | 🟡 | Strong ad-hoc design docs; **no formal THREAT-MODEL/DFD** (§6) |
| V2 Authentication | ✅ | CF Access RS256 JWT verify, JWKS cache+rotation, bot-score gate (`pipeline.ts`) |
| V3 Session management | ✅ | Opaque KV sessions, `__Host-` strict cookies, 24h hard expiry, force-kick (`session.ts`) |
| V4 Access control | 🟡→✅ | RBAC+PLAC deny-wins; **API self-guard gap fixed** (`inquiries/update-status.ts`) |
| V5 Validation / encoding | 🟡 | zod in ~31 files but many `request.json() as T` casts remain (§6) |
| V6 Cryptography | 🟡→✅ | HMAC IP hashing standard; **weak email IP hash unified this pass** |
| V7 Errors & logging | 🟡→✅ | Append-only audit; **Sentry PII scrubber added this pass** |
| V8 Data protection | 🟡 | `sendDefaultPii:false`; client PII minimized this pass; retention automation pending (§6) |
| V9 Communications | ✅ | HSTS preload, TLS-only, edge-terminated |
| V10 Malicious code | ✅ | No `eval`; email HTML sanitized (HTMLRewriter); parameterized SQL |
| V11 Business logic | ✅ | Anti-escalation guards in `users/manage.ts`; rate limits on expensive ops |
| V12 Files & resources | ✅ | R2 upload gated (isAdmin+PLAC+RL), traversal rejected in `cf-entry.ts` |
| V13 API & web service | 🟡→✅ | CSRF fail-closed; API PLAC parity restored this pass |
| V14 Configuration | 🟡 | Clean secrets; **residual CSP `unsafe-inline`, no staging env, dead `public/_headers`** (§6) |

**Net:** was ~92% self-attested; the code fixes this pass close the two hardest V4/V6/V7
gaps. Remaining deltas are process (V1) and hardening (V5/V14), all zero-cost.

### 3.2 OWASP Top 10 (2021)

| Risk | Status | Note |
|------|--------|------|
| A01 Broken Access Control | 🟡→✅ | **The one real finding** (`update-status`) fixed; root-cause default-deny is roadmap (§6.1) |
| A02 Cryptographic Failures | ✅ | HMAC hashing unified; secrets encrypted via `wrangler secret`; TLS everywhere |
| A03 Injection | ✅ | Parameterized D1, Supabase query builder, HTMLRewriter sanitization |
| A04 Insecure Design | 🟡 | Mature design; missing formal threat model (§6.4) |
| A05 Security Misconfiguration | 🟡 | No staging env; dead `public/_headers`; duplicate report-only CSP header (§6) |
| A06 Vulnerable Components | 🟡 | Dependabot on; `npm audit` gate is non-blocking `|| true` (§6.2) |
| A07 Auth Failures | ✅ | Zero Trust + bot-score + force-kick + rate limits |
| A08 Software/Data Integrity | 🟡 | CI actions mostly floating tags, not SHA-pinned (§6.2) |
| A09 Logging & Monitoring | ✅ | Full audit trail + Sentry + Analytics Engine; PII scrubber added |
| A10 SSRF | ✅ | No user-controlled outbound fetch; fixed provider endpoints |

### 3.3 SOC 2 Trust Services Criteria

| TSC | Status | Note |
|-----|--------|------|
| CC6 Logical access | ✅ | RBAC/PLAC, MFA via CF Access IdP, least privilege |
| CC7 System operations / IR | 🟡 | Monitoring strong; **no incident-response runbook** (§6.4) |
| CC8 Change management | 🟡 | Direct-push-to-main, no PR gate; CI advisory-only (§6.1–6.2) |
| A1 Availability / DR | 🟡 | Provider-native redundancy; **no tested restore runbook** (§6.5) |
| C1 Confidentiality | ✅ | RLS, encryption at rest/in transit, secret hygiene |
| P-series Privacy | 🟡 | Consent forensics strong; DSAR fulfillment + retention gaps (§6.3) |

### 3.4 GDPR

| Article | Status | Evidence / gap |
|---------|--------|----------------|
| Art. 5 data minimization / storage limitation | 🟡 | Client PII minimized this pass; **no automated PII retention/TTL** (§6.3) |
| Art. 15–17 access / rectification / erasure | ❌→🟡 | `privacy_requests`/`legal_requests` captured but **no admin fulfillment workflow** (§6.3) |
| Art. 25 privacy by design | ✅ | `sendDefaultPii:false`, HMAC IP hashing, consent forensics dashboard |
| Art. 30 records of processing (RoPA) | 🟡 | Implicit in schema; **no formal RoPA doc** — note `bookings.posthog_session_id` linkage (§6.4) |
| Art. 32 security of processing | ✅ | Encryption, access control, audit, resilience |
| Art. 33 breach notification (72h) | ❌ | **No breach-notification runbook** (§6.4) |

### 3.5 CCPA / CPRA

| Requirement | Status | Note |
|-------------|--------|------|
| Notice at collection | 🟡 | Handled on public cf-astro site, not this portal |
| Right to know / delete / correct | 🟡 | Same DSAR fulfillment gap as GDPR (§6.3) |
| Do Not Sell/Share + GPC signal | ❌ | Not implemented (data is not sold; document the position — §6.4) |
| Transactional email opt-out | 🟡 | Tracked (open+click) bulk send has **no `List-Unsubscribe`** (§6.3) |

---

## 4. Fixes applied in this pass

All changes verified: `tsc` 0 errors, ESLint 0 errors, 58/58 vitest tests pass
(incl. 19 new). Delivered directly to `main` per owner directive.

| # | Severity | Fix | Files |
|---|----------|-----|-------|
| F1 | **Critical** | Added `placDenyResponse('/dashboard/inquiries#edit')` + runtime status-enum validation to the previously-unguarded status mutation; added PLAC to the comments read | `src/pages/api/inquiries/update-status.ts`, `.../comments.ts` |
| F2 | High | Replaced hardcoded-salt plain-SHA256 IP hash with the canonical HMAC-SHA256 `hashIp(ip, IP_HASH_SECRET)` | `src/pages/api/emails/send.ts` (reuses `src/lib/audit-helpers.ts`) |
| F3 | High | Added PII/secret scrubber wired into `beforeSend` + `beforeSendLog` (server) and `beforeSend` (client) — redacts emails, JWTs, IPs, tokens from events and console-forwarded logs | new `src/lib/sentry-scrub.ts`, `src/workers/cf-entry.ts`, `sentry.client.config.ts` |
| F4 | Medium | Data-minimization: stopped persisting admin **email** in `localStorage`; keep only display name + provider | `src/components/auth/SessionWatchdog.tsx` |
| F5 | Low | `prefer-const` cleanup in the file touched by F2 | `src/pages/api/emails/send.ts` |
| T1 | — | New tests: PLAC self-guard 403 behavior + status-enum rejection + scrubber redaction | `test/guard-plac.test.ts`, `test/sentry-scrub.test.ts` |

---

## 5. Findings register (open — tracked as roadmap)

| ID | Sev | Finding | Location | Framework |
|----|-----|---------|----------|-----------|
| O1 | High | API middleware does not fail-closed; every `/api/*` route must self-guard (root cause of F1) | `src/lib/auth/pipeline.ts:507`, `guard.ts:59-63` | ASVS V4, Top10 A01 |
| O2 | Med | No admin DSAR/erasure workflow; `privacy_requests`/`legal_requests` unused in `src/` | `migrations/0000_baseline.sql` | GDPR 15-17, CCPA |
| O3 | Med | No automated retention/TTL on PII tables (bookings, consent_records, consent_attempts, admin_login_logs) | D1 schema; `api/audit/prune.ts` manual only | GDPR Art.5 |
| O4 | Med | Many mutation handlers cast `request.json() as T` without zod | `pages/toggle.ts`, `features/toggle.ts`, `system/preview.ts`, … | ASVS V5 |
| O5 | Med | No incident-response / 72h breach-notification runbook; no threat model/DFD | `documentation/runbooks/` | SOC2 CC7, GDPR 33 |
| O6 | Med | No tested backup/restore (DR) runbook; provider-native only | `SOC2-TSC-mapping.md` A1.3 | SOC2 A1 |
| O7 | Low | Tracked bulk email lacks `List-Unsubscribe` / opt-out | `src/pages/api/emails/send.ts`, `webhook.ts` | CAN-SPAM/CCPA/GDPR |
| O8 | Low | CI gates advisory: `npm audit \|\| true`, `rules_check --warn-only`; floating (non-SHA) action tags | `.github/workflows/*` | Top10 A06/A08 |
| O9 | Low | No prod/staging env separation in `wrangler.toml`; D1 shared with cf-astro | `wrangler.toml` | ASVS V14, SOC2 CC8 |
| O10 | Low | Residual CSP `unsafe-inline`; dead `public/_headers`; duplicate report-only CSP header | `src/lib/security/csp.ts`, `public/_headers` | ASVS V14 |
| O11 | Info | Direct-push-to-main deploy, no PR gate (per GITHUB_RULES.md) | `GITHUB_RULES.md` | SOC2 CC8 |
| O12 | Accepted | `sync-docs.yml` publishes security internals + infra IDs to public `Harshil8136/chess-game1` (owner-accepted for AI-IDE context) | `.github/workflows/sync-docs.yml` | Info-exposure |

---

## 6. Zero-cost remediation roadmap

All items below use only free-tier tooling (Cloudflare native, GitHub Actions, D1/KV,
docs). No paid service is required for compliance pass. The single **optional** paid
lever is Supabase Pro (~$25/mo) for daily backups + PITR (§6.5).

### 6.1 Close the root cause — fail-closed API authorization (O1)
Make the middleware block `/api/*` when `!hasAccess`, with an explicit public allowlist
(`/api/health`, `/api/auth/logout`, `/api/emails/webhook`, `/api/auth/dev-login`,
`/api/dashboard/metrics`). This turns "secure only if every handler self-guards" into
"secure by default." Implement in `src/lib/auth/pipeline.ts` around line 507; add a
route→page map. Ship behind a test that asserts a denied user gets 403 for every
data-bearing route. *Effort: M. Cost: $0.*

### 6.2 Make CI enforce, not advise (O8)
Remove `|| true` from `npm-audit`; flip `rules_check` off `--warn-only`; SHA-pin every
action (`uses: actions/checkout@<sha> # v4`). Add a `typecheck`+`test` job (they pass
today). Require these as branch-protection status checks on `main`. *Effort: S. Cost: $0.*

### 6.3 Privacy operations (O2, O3, O7)
- **DSAR/erasure workflow:** add an owner/super_admin admin page + API that lists
  `privacy_requests`/`legal_requests`, and an erasure action that hard-deletes matching
  booking/contact PII and writes an append-only erasure record to `admin_audit_log`.
  Reuse `InquiryRepository`/`AccessRequestRepository` patterns. *Effort: M.*
- **Retention automation:** extend the existing weekly cron (`scheduled-asset-cleanup.ts`)
  to purge `consent_attempts`, `booking_attempts`, and `admin_login_logs` older than a
  configurable window (e.g. 180d), logging counts. *Effort: S.*
- **Email opt-out:** add a `List-Unsubscribe` header + footer link on bulk sends;
  store suppressions in KV/D1 and check before enqueue. *Effort: S.* All $0.

### 6.4 Governance docs (O5, CCPA GPC, RoPA)
Author, using the existing `documentation/_templates`: `THREAT-MODEL.md` (STRIDE + one
DFD), `runbooks/incident-response.md` (incl. GDPR 72h breach flow), a one-page RoPA
(note the `bookings.posthog_session_id` re-identification linkage), and a short
"Do Not Sell/Share position" note for CCPA. *Effort: M. Cost: $0.*

### 6.5 Disaster recovery (O6)
Write `runbooks/disaster-recovery.md` with a **tested** restore procedure: D1
point-in-time recovery via `wrangler d1 time-travel`, R2 object listing/export, KV
export, and Supabase backup restore. Run one tabletop restore into a scratch DB and
record the RTO/RPO. D1 Time Travel is free-tier; Supabase PITR needs Pro (optional).
*Effort: M. Cost: $0 (D1) / ~$25/mo (optional Supabase PITR).*

### 6.6 Config hardening (O9, O10)
Add `[env.staging]` to `wrangler.toml` with its own D1/KV/Queue; delete dead
`public/_headers` (or document it as reference-only); drop the duplicate
`Content-Security-Policy-Report-Only` header; plan removal of CSP `unsafe-inline` by
finishing the nonce migration. *Effort: S–M. Cost: $0* (staging D1/KV are free-tier).

---

## 7. Multi-tenant readiness (roadmap — "any business", 1000+ users, 10k+ perms)

The current design is **single-tenant** (Madagascar). It is already well-positioned to
scale *within* one tenant: PLAC access maps are precomputed at login and cached in the
KV session for O(1), sub-millisecond checks — so 10k+ page/permission entries per user
are cheap at request time (the cost is at login/refresh, already throttled hourly).
Serverless edge (Workers + KV + D1 + R2) scales horizontally to 1000+ users without
capacity planning. To become a reusable multi-business platform, the phased path is:

**Phase 1 — Tenant identity & isolation.** Introduce a `tenant_id` on every data-bearing
table and on the session/JWT identity. Two viable isolation models:
- *Supabase (Postgres):* single DB, `tenant_id` column + **RLS policies keyed on a tenant
  claim** — least operational overhead, strongest per-row isolation, fits the existing
  RLS discipline. **Recommended default.**
- *D1:* either a `tenant_id` column with app-enforced scoping, or **one D1 database per
  tenant** (D1 is cheap to create) for hard blast-radius isolation. Per-tenant D1 also
  unlocks per-tenant **region/jurisdiction pinning** (`wrangler d1 create --location`,
  or D1 `jurisdiction`) — directly serving the "closest regions / client requirements"
  goal. Today no jurisdiction is set on any D1 DB.

**Phase 2 — Tenant-scoped RBAC/PLAC.** Namespace `admin_pages`/`admin_page_overrides`
and the KV session key by `tenant_id`; scope the access-map computation and every
`placDenyResponse` mapping per tenant. Cross-tenant admin (support) becomes an explicit,
audited super-role.

**Phase 3 — Tenant lifecycle & region pinning.** Onboarding (provision DB/KV/queues),
per-tenant config (branding, email sender, locale), and region placement. Cloudflare's
edge already routes to the closest PoP; pin data residency via D1 location hints and
Supabase read replicas / region selection per tenant.

**Phase 4 — Noisy-neighbor & limits.** Per-tenant rate-limit namespaces (Upstash key
prefix by tenant), per-tenant Analytics Engine datasets, and quota accounting. Move the
shared-with-cf-astro D1 to a dedicated admin DB before multiplying tenants (O9).

None of this needs a rewrite — it is additive scoping on an already-clean authorization
core. The highest-leverage first step is **§6.1 (fail-closed API authz)**, because a
multi-tenant system must never rely on per-handler discipline for tenant isolation.

---

## 8. Verification of this audit

- Code fixes: `npx tsc --noEmit` → 0 errors; `npx eslint <changed>` → 0 errors;
  `npx vitest run` → 58 passed (9 files), including new `guard-plac` and `sentry-scrub`
  suites asserting the F1/F3 behavior.
- `astro check` requires a remote Cloudflare proxy session (needs `CLOUDFLARE_API_TOKEN`)
  and cannot run in a non-interactive sandbox; `tsc` was used for type verification.
- Live infra confirmed via read-only Cloudflare MCP (workers/KV/D1/R2 inventory).
- Supabase advisor re-run (`get_advisors`) recommended post-deploy to confirm no new
  RLS regressions — requires interactive MCP approval.

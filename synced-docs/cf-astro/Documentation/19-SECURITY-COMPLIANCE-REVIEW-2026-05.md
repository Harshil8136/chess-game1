{% raw %}
# 19 — Security & Compliance Review (2026-05-29)

> Deep review of the `cf-astro` codebase: connectors, MCP, system architecture,
> security posture, and legal compliance. This document is the formal report and
> the rationale source referenced by `AGENTS.md` and `SECURITY.md`.
>
> **Bottom line:** the system is well-engineered and security-conscious. No
> committed secrets, no injection surface (Drizzle is parameterized), RLS enabled
> on all 18 Supabase tables, least-privilege DB role, fail-closed rate limiting,
> timing-safe secret comparison, Svix webhook verification, and magic-byte file
> validation. The findings below are **refinements, not firefighting**, and none
> are actively exploited.

Severity legend: 🔴 act soon · 🟡 improve · 🟢 minor/hygiene.

---

## 1. System architecture (as reviewed)

- **Framework/host:** Astro 6 (SSR API routes, `prerender = false`) on Cloudflare
  Pages/Workers; Preact islands; Tailwind v4.
- **Data:** Supabase PostgreSQL via Drizzle ORM (`cf_astro_writer` least-privilege
  role) + Cloudflare D1 as a dead-letter audit store.
- **Connectors:** Resend (email, async via Cloudflare Queues → `cf-email-consumer`
  worker; delivery webhooks via Svix), Upstash Redis (rate limiting), Cloudflare R2
  (ARCO documents + images), Analytics Engine (edge metrics), Workers AI (admin
  blog/FAQ drafts), PostHog (consent-gated analytics), Sentry (errors), BetterStack
  (structured logs).
- **MCP:** `POST /api/mcp` implements MCP `2024-11-05` (JSON-RPC 2.0) exposing four
  **read-only** tools (`get_services`, `get_locations`, `get_booking_url`,
  `get_faq`). Rate-limited 60/60s; no auth by design (public data, non-browser
  clients). Connected dev MCP servers observed: a Supabase MCP (read/write to the
  project) and the GitHub MCP — these are *tooling*, not part of the deployed app.
- **Defenses:** `assertOrigin()` CSRF guard + `timingSafeEq()` + `sanitizeHtml()`
  (`src/lib/security.ts`); per-endpoint rate limits (`src/lib/rate-limit.ts`);
  security headers + CSP (`public/_headers`).

---

## 2. Security vulnerabilities / risks

| # | Sev | Finding | Location | Recommendation |
|---|-----|---------|----------|----------------|
| 1 | 🟡 | D1 audit row written **before** rate-limit → write-amplification / cost-DoS under flood | `api/booking.ts:69-74`; `api/consent.ts` | Add a cheap in-memory per-IP burst pre-check **before** the D1 write; keep audit-first for legitimate traffic |
| 2 | 🟡 | CSP allows `'unsafe-inline'` + `'unsafe-eval'` in `script-src` | `public/_headers:7` | Migrate to nonce/hash CSP (Astro middleware nonce + PostHog tweak). Test carefully |
| 3 | 🔴(ops) | BetterStack token returns 401 → structured logs silently dropped | noted in code + `ToDo.md` | Rotate `BETTERSTACK_SOURCE_TOKEN` |
| 4 | 🟢 | Supabase "leaked password protection" disabled | live security advisor | Enable in dashboard (only matters if Supabase Auth is used by admin app) |
| 5 | 🟢 | MCP endpoint unauthenticated | `api/mcp.ts` | Acceptable (public read-only, rate-limited). Document threat model only |
| 6 | 🟢 | `Content-Disposition` filename not quote-escaped | `api/arco/get-document.ts:97` | Low risk (server-derived path). Escape opportunistically |

**Confirmed NON-issues** (do not "fix"): public keys in `wrangler.toml`
(Turnstile site key, Supabase publishable key, PostHog key, Sentry DSN) are public
by design; no Turnstile on booking/contact is deliberate; audit-before-checks is
deliberate.

---

## 3. Places for improvement

- 🟡 **`.env.example`** added — documents every env var/binding (placeholders only).
- 🟡 **`AGENTS.md`** added at repo root — consolidates invariants for AI tools.
- 🟡 **Email-retry safety net:** a cron worker to scan
  `booking_attempts WHERE status='queue_error'` and re-enqueue (already a code
  `TODO` at `booking.ts:326`).
- 🟢 **Env-access consistency:** prefer `src/lib/env.ts` everywhere instead of
  inline `runtimeEnv.X || import.meta.env.X`.
- 🟢 **CI hardening:** add `npm audit` / Dependabot / CodeQL / secret-scanning to
  `.github/workflows` (currently only `sync-docs.yml`).

---

## 4. Compliance — lawful, fair, business-protective

### 4.1 Privacy notice is inaccurate AND over-disclosed 🔴
`src/i18n/translations/{es,en}.json` (`Privacy` object, ~lines 973-1132) currently:
- Names **"Vercel"** as hosting — the stack is **Cloudflare** (factually wrong).
- States the database is in **"UE (Frankfurt)"** — it is **Supabase us-east-1 (US)**
  (factually wrong; misstates the country of an international transfer).
- Enumerates vendors and internals: Supabase, Upstash Redis, honeypots, AES-256,
  TLS 1.3, SOC2, and a GitHub-Actions free-tier compute paragraph.

Inaccurate disclosures are themselves a compliance liability, and the
vendor/architecture detail is an attacker reconnaissance map. **See §5 for the
recommended rewrite.**

### 4.2 Privacy notice under-discloses actual collection 🟡
The app stores raw **IP address**, **device fingerprint**, and **interaction proof**
in `consent_records` (`booking.ts:205-211`, `api/consent.ts`). The notice must
disclose these **by category**, with purposes (security / anti-fraud / consent
proof) and **retention periods**.

### 4.3 Terms — refund / no-show clause 🟡 (flagged, not edited)
`Legal.terms` §2 ("no refunds; no-shows forfeit the full amount") may be deemed
abusive/void under Mexico's **LFPC** (consumer protection) and PROFECO practice.
The 3-month booking credit is fine; the **absolute forfeiture** is the risk.
Per owner decision this is **flagged only** — recommend counsel review and, when
Terms is next revised, the same category-based treatment for §12 (GitHub Actions).

### 4.4 Legacy duplicate privacy text 🟢
A second, short `privacy` dict (`es.json:1134`, lowercase, `section1/2/3`) appears
unused/contradictory. Verify it is not surfaced to users; remove if dead.

---

## 5. Privacy disclosure philosophy — "transparent, not a recon map"

**Goal:** satisfy LFPDPPP (México) + GDPR-grade transparency **without publishing
the exact tech stack or sub-processors.** This is lawful, not "security by
obscurity" — every control stays in place; only the *public enumeration* of
vendors/architecture is reduced.

**Legal basis:**
- **GDPR Art. 13(1)(e)** explicitly permits disclosing *"recipients or **categories
  of recipients**"* — individual vendors need not be named.
- **LFPDPPP** distinguishes *remisiones* (to *encargados*/processors acting on the
  controller's behalf — hosting, email, analytics) from *transferencias* (to
  independent third-party controllers). Processors need **not** be individually
  named publicly; you must state purposes, categories of recipients, that
  international transfer to the US occurs, and the safeguards.
- A privacy notice **must remain user-accessible** (it cannot be hidden); `noIndex`
  + robots `Disallow` on `/privacy` & `/terms` already reduce scraping. The real
  protection is the **wording**.

**Recommended notice structure (drafted; apply on owner approval):**
1. Controller identity + contact (keep — required).
2. **Categories of data** including technical data: IP address, approximate
   location, device/technical identifiers, interaction/consent records — with
   purpose (security, anti-fraud, consent proof) and retention per category.
3. **Recipients by function only**, e.g. "secure third-party infrastructure &
   hosting providers," "a transactional email provider," "security & anti-abuse
   providers," "consent-gated analytics & error-monitoring providers." State that
   **international transfer to the United States** occurs under contractual
   safeguards (DPA / standard contractual clauses).
4. **Specific current sub-processor list available on request** via the
   ARCO/privacy contact — auditable transparency without open publication.
5. ARCO rights + procedure (keep).
6. **Remove** the architecture-revealing + inaccurate specifics (Vercel, Frankfurt,
   honeypots, Redis details, encryption specifics, SOC2 vendor claims, GitHub
   Actions paragraph). Replace with the category language above; correct the
   transfer country to "United States."

> Drafted replacement copy (es/en) is intentionally **not** applied to the live
> notice in this pass. It is held for owner approval because privacy text is a
> legal artifact and was scoped as "plan, not execute."

---

## 6. Roadmap (documented now; implement on explicit approval)

Each item preserves existing behavior; none touch the booking/Turnstile/connector
patterns protected by `AGENTS.md`.

1. Booking/consent burst-guard before the D1 audit write (§2 #1).
2. Nonce/hash-based CSP (§2 #2).
3. Email-retry cron worker for `queue_error` rows (§3).
4. CI security: `npm audit` / Dependabot / CodeQL / secret-scanning (§3).
5. Ops: rotate BetterStack token; enable Supabase leaked-password protection.
6. Privacy notice rewrite per §5 + fix Vercel/Frankfurt inaccuracies — **owner approval.**
7. Terms LFPC review — **owner + counsel** (flag only).

---

## 7. Pass 1 — docs-only (branch `claude/codebase-security-compliance-review-cqa4S`)

- **New:** `AGENTS.md`, `.env.example`, this document.
- **Updated:** `SECURITY.md`, `Documentation/18-SECURITY-HARDENING.md`,
  `Documentation/16-SECURITY-SSL-LIGHTHOUSE-AUDIT.md`,
  `Documentation/Consent_System_Audit.md`, `Documentation/12-CHANGELOG.md`,
  `Documentation/README.md`, `AI_CODE_MAINTENANCE.md`, `ToDo.md`, `README.md`.
- **No** changes under `src/`, `public/_headers`, `wrangler.toml`, or any API route.

## 8. Pass 2 — implementation (branch `claude/security-compliance-fixes-cqa4S`)

Applied the safe, non-breaking fixes. **Booking, Turnstile, and all service
connectors were not touched.** No changes to `wrangler.toml`, `public/_headers`, or
the booking/contact/consent request flow.

### ✅ Done
- **Privacy notice rewrite (es + en)** — `src/i18n/translations/{es,en}.json`:
  - Removed all vendor names + architecture from the **publicly rendered** text
    (Vercel, Supabase, Brevo, Google Workspace, Upstash, GitHub Actions, honeypots,
    AES-256 / TLS 1.3 / bcrypt, SOC2-by-vendor) → replaced with **functional
    categories** (§5).
  - **Fixed factual errors:** hosting "Vercel" → cloud hosting; database
    "UE (Frankfurt)" → "United States"; email "Brevo/France" → "transactional email
    provider". Transfer country corrected to the US throughout.
  - Added "specific provider categories **available on request**" line.
  - Fixed the stray `privacy@mascotasmadagascar.com` → `team@madagascarhotelags.com`.
  - Unified version/date (was v3.0 top / v4.0 in §13 / "11" vs "13 enero") → **v3.1,
    effective 2026-05-29**.
  - Kept the IP / device-fingerprint / interaction-proof + retention disclosures
    (§4.2 satisfied), genericized of any infrastructure detail.
- **Removed dead duplicate** `Legal.privacy` short dict (was unreferenced) — §4.4.
- **Terms LFPC carve-out (es + en)** — appended a strictly-additive clause to
  `Legal.terms` §2: the refund/no-show terms apply "to the extent permitted by law"
  and "do not limit non-waivable LFPC consumer rights." **No commercial term was
  changed** (the 3-month credit + no-refund stance remain) — this is a compliance
  shield only. Full clause revision still recommended with counsel.
- **ARCO `Content-Disposition` hardening** — `api/arco/get-document.ts`: filename
  now stripped to `[A-Za-z0-9._-]` (defensive; §2 #6).
- **CI: Dependabot** — `.github/dependabot.yml` (weekly npm + actions; additive, no
  required check, never blocks merges).

### ⏳ Remaining roadmap (intentionally NOT done — needs care/approval)
- **Booking/consent burst-guard before D1 write** (§2 #1) — deferred. The booking
  path is revenue/emergency-critical; the DoS is largely mitigated by Cloudflare
  edge DDoS protection, and any change here risks the protected flow. Implement only
  with explicit approval + load testing.
- **Nonce/hash CSP** (§2 #2) — high breakage risk (inline scripts + PostHog); needs
  staged testing.
- **Email-retry cron** (§3); **rotate BetterStack token** + **enable Supabase
  leaked-password protection** (ops); **full privacy/terms legal sign-off**.

{% endraw %}

{% raw %}
# Security, Compliance & System History Manual

This document details the security hardening, Mexican LFPDPPP and European GDPR privacy notice frameworks, least-privilege database roles, constant-time authentication mechanisms, dynamic rate limiters, historical changelogs, and core troubleshooting post-mortems for the **cf-astro** project.

---

## 1. Edge Security Architecture

The application implements a strict zero-trust edge security paradigm. Access controls and validations are processed physically close to the client before requests hit database storage systems:

```
                  [Incoming Request]
                           │
                           ▼
          [Cloudflare edge: WAF, DDoS mitigation]
                           │
                           ▼
              [cf-astro Worker (src/worker.ts)]
                           │
      ┌────────────────────┴─────────────────────┐
      ▼                                          ▼
[Public form routes]                      [Protected routes]
(/api/booking, /api/consent,              (/api/revalidate, /api/health,
 /api/contact, /api/arco/submit)           replay drains, /api/arco/get-document)
      │                                          │
      ├─► D1 audit row first                     ├─► rate limit (`admin`), before auth
      │   (booking, consent)                     │
      ├─► assertOrigin() (CSRF)                  ├─► bearer or header secret,
      │                                          │   compared with timingSafeEq()
      └─► rate limit (binding → KV → allow)      └─► cf-admin's secret: service binding only
```

`SECURITY.md` is the authoritative reference for every layer; this section is a summary.

### 1.1 Key API Defense Mechanisms

- **CSRF Defense (`assertOrigin`)**: Rejects a form `POST` whose `Origin` header is not one of the site's own hosts or this Worker's own version URLs; in production a missing `Origin` is rejected too (`SECURITY.md` §2). `Referer` is not used.
- **Timing-Attack Defense (`timingSafeEq`)**: All API secrets are compared with `timingSafeEq` (`src/lib/security.ts`), a constant-time comparison. Standard string comparison (`==`) aborts on the first mismatched character, exposing token lengths and contents to timing enumeration probes; constant-time loops execute the full byte comparison under all circumstances.
- **Dynamic Rate Limiting (Workers Rate Limiting binding, since 2026-10-04)**: one-minute limits keyed per endpoint and client IP (`cf-connecting-ip`), counted by Cloudflare's Rate Limiting binding (`RL_PER_MIN_<n>` in `wrangler.toml`); this site stores none of those counters. If the binding is missing or fails, a KV counter decides (`rl:<endpoint>:<ip>`, expiring after 60 s), and if KV fails too the request is allowed (fail-open, ADR-0001). A production request with no `cf-connecting-ip` falls into one shared `no-ip` bucket — deliberately tight, never a per-request id, which would defeat the limit. Until 2026-10-04 the primary was an Upstash Redis sliding window; its limiter analytics, which had kept visitor IPs in hourly keys with no expiry, were switched off and cleared on 2026-10-02, and Upstash is no longer called at all ([change record](./records/2026-10-04-resource-usage.md)).

---

## 2. Relational Database Hardening

Data access is built on the principle of **least privilege** to protect customer PII (Personally Identifiable Information) from SQL extraction or leaks.

### 2.1 Postgres Role Isolation (`cf_astro_writer`)

Instead of using the default PostgreSQL administrative superuser (`postgres`), the application connects to Supabase via a hardened role named `cf_astro_writer`:

- **Mostly write-only privileges**: The role may `INSERT` into the tables this site writes (`bookings`, `booking_pets`, `booking_quality_metadata`, `consent_records`, `contact_messages`, `email_audit_logs`, `legal_requests`).
- **Two narrow reads**: it may `SELECT` `legal_requests` (for `/api/arco/get-document`) and `SELECT`/`UPDATE` `email_audit_logs` (for the Brevo webhook). Everything else it cannot read, so a leaked `DATABASE_URL` cannot dump bookings or consent records. The live grants are in `db/postgres-cf-astro-writer-grants.sql` and `SECURITY.md` §12, which also tracks narrowing the `legal_requests` read.

### 2.2 PII Minimization in Audit Logs

- **PII Minimization in D1 Logs (corrected 2026-07)**: The `booking_attempts`/`consent_attempts` dead-letter queues store a limited, operational set of PII in dedicated columns — `owner_email`, `request_ip` / `ip_address`, `user_agent` — bound raw, not redacted. `redactPii()` (`src/lib/db/d1-attempts.ts`) only scrubs known PII keys (email/phone/name/fingerprint/ip) out of the free-form `request_body` JSON blob, not these structured columns. **No data is auto-purged (owner policy, 2026-07):** these tables have a 90-day retention _target_, but deletion only happens via explicit admin/owner action — the audited manual tool at cf-admin `/dashboard/retention`, or a manually-triggered run of `db/retention-purge.sql` — never on a timer. These remain short-lived operational recovery tables in intent, not the legal consent-evidence store (that's Supabase `consent_records`, retained per the Privacy Notice §6, also deletion-by-policy-decision only, not automatic).
- **Email audit rows**: the `email_audit_logs` `payload` holds no customer details (booking reference, service, pet count, transport yes/no, locale). The row itself keeps the recipient address (`recipient_email`) and the sender IP (`sender_ip`), so it is personal data: readable by `service_role` and, for the Brevo webhook's status updates, by `cf_astro_writer`.

---

## 3. Privacy Compliance (LFPDPPP & GDPR)

Aguascalientes, Mexico operates under the **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)**. The consent pipeline is engineered to be fully legally compliant:

### 3.1 Forensically Auditable Consent Proofs

To establish non-repudiation in data collection audits, the Preact `ConsentBanner` collects forensic metadata verifying that a real human actively interacted with the banner:

- **Interaction Data**: Captures exact scroll depth, time elapsed before interaction, click quadrant, and device headers.
- **Text Hash Cryptography**: Captures a SHA-256 fingerprint of the exact translated privacy agreement text presented to the user during consent submission, guaranteeing that the user cannot claim they agreed to a different version of the notice.
- **Network evidence**: The consent row stores the visitor's IP address and user agent alongside Cloudflare's country, region and city, as evidence of who consented and from where (`consent_records.ip_address`, `ip_country`, `ip_region`, `ip_city`). The privacy notice discloses this by category.
- **Analytics Blockade**: PostHog and Cloudflare Web Analytics scripts are physically blocked from compiling or executing inside the DOM unless the consent state is explicitly set to `granted`.

### 3.2 ARCO Requests

The ARCO form (`/es/legal/arco/`, `POST /api/arco/submit`) takes a Mexican ARCO rights request
(Access, Rectification, Cancellation, Opposition) with an identity document. Requests are
answered by hand within the legal deadline, following
[`ARCO-DSR-RUNBOOK.md`](./ARCO-DSR-RUNBOOK.md); consent records are kept as legal evidence even
when a booking is deleted. (The older `/api/privacy/arco` endpoint was removed in July 2026.)

---

## 4. Cloudflare Firewall Hardening Checklist

The intended Cloudflare dashboard settings. These are dashboard state, not code; the HSTS header is also sent by the code (`src/lib/security-headers.ts`, `public/_headers`). The rest were last checked by hand, not on 2026-10-17:

1. **SSL/TLS Mode**: Full (Strict) — requires valid Origin Certificates.
2. **HTTP Strict Transport Security (HSTS)**: Enabled with subdomains and preloading (2-year max-age).
3. **Bot Fight Mode**: Active — challenges automated vulnerability scanners before they reach edge Workers.
4. **Email Security (DNS)**: SPF, DKIM, and DMARC text records are configured on the `@madagascarhotelags.com` zone to prevent domain spoofing.
5. **AI Crawler Exclusions**: Cloudflare "Block AI bots" toggle must remain **OFF** to preserve the GEO search indexing strategy.

---

## 5. System History & Changelogs

### May 2026

- **Technical SEO Remediation**: Removed `SearchAction` from `SchemaMarkup.astro`. Added `X-Robots-Tag: noindex` to static assets (`manifest.webmanifest`, `favicon.ico`) inside `_headers`. Suppressed IDE sitemap XSS warnings.
- **Legal Notices Refactor**: Rewrote Privacy Notice to utilize category-based descriptions rather than specifying hosting providers, securing system architecture details while fully satisfying GDPR/LFPDPPP.
- **Consolidation**: Compacted 17 separate markdown guides and logs into 3 Master Guides + 1 Master Incident post-mortem.

### April 2026

- **Astro 6 & Tailwind v4 Upgrade**: Successfully migrated the entire compiler pipeline to Astro 6.1.2 and Tailwind CSS v4 via `@tailwindcss/vite` compiler plugins.
- **LFPDPPP Compliance**: Integrated the forensic `ConsentBanner` and SHA-256 privacy proof trackers.

### March 2026

- **Solid Canvas UI**: Unified layout, rebuilt Contact section with glassmorphism forms, and integrated the `AutoTabs` system.
- **Initial Scaffold**: Project initialized with Astro 5.7, D1 schemas, and local wrangler edge bindings.

---

## 6. Critical Troubleshooting History (Post-Mortems)

### 🔴 CMS Webhook 301 Downgrade (Stale Content Issue)

_Historical: cf-admin now reaches `/api/revalidate` through its `ASTRO_SERVICE` service binding (`SECURITY.md` §7), not over the public hostname._

- **Symptoms**: Admin saved changes in `cf-admin`, but changes never appeared on the live site.
- **Root Cause**: The revalidation webhook was directed to `pet.madagascarhotelags.com`, which returned a `301 Redirect` to the apex domain. The redirect caused the serverless request to downgrade from `POST` to a `GET`, which Astro rejected as 405 Method Not Allowed, skipping the KV cache flush.
- **Resolution**: Updated the target directly to `https://madagascarhotelags.com/api/revalidate`. Added direct KV writes to the sync engine to bypass database replica lag.

### 🔴 Tailwind v4 CSS Prerender Crash

- **Symptoms**: Compilation crashed during `npx astro build` on Tailwind compilation.
- **Root Cause**: The initial `@tailwindcss/vite` plugin version suffered module resolution loops when compiling CSS inside Cloudflare worker containers during prerendering.
- **Resolution**: Fully updated dependencies to Astro 6.1+ and Tailwind v4.2+, explicitly adding Vite configuration deps exclusions for workers.

---

## 7. AI & Human Extension Guide (Security Invariants)

To prevent security regressions, any AI model or human operator modifying the application must obey these laws:

> [!CAUTION]
> **Core Security Invariants**
>
> 1. **Minimize PII in D1, and never add more than what's already there**: D1 is an unencrypted local SQLite engine. It already stores `owner_email`/`request_ip`/`user_agent` in the `booking_attempts`/`consent_attempts` dead-letter tables (90-day retention target, purge is admin/owner-triggered only — see §2.2, never automatic on a timer) — do not add further PII (passwords, phone numbers, pet/medical details, payment data) beyond this existing, already-reviewed set. Keep all other PII locked inside the Supabase PostgreSQL instance.
> 2. **Never Log Authorizations**: When auditing or handling exceptions inside API routes, never log the `Authorization` header, even partially. Substrings of `Bearer <secret>` expose secret prefixes to logs, breaking API token confidentiality.
> 3. **Never Query Supabase via administrative `postgres` User**: All database access in the Worker must connect via `cf_astro_writer`. Never override this role to bypass least-privilege write isolation rules.

{% endraw %}

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
          [Cloudflare Edge Firewall & WAF]
         (Bot Fight Mode / DDoS Mitigation)
                           │
                           ▼
                 [Pages Edge Router]
                           │
      ┌────────────────────┴────────────────────┐
      ▼                                         ▼
[Public Routes]                          [Protected Routes]
(/api/booking, /api/consent)             (/api/revalidate, /api/admin/*)
      │                                         │
      ├─► assertOrigin() (CSRF check)           ├─► Bearer Token Auth
      │                                         │
      ├─► Turnstile Token Verify                ├─► timingSafeEq() (Constant-Time)
      │                                         │
      └─► Upstash Redis Rate Limiting           └─► IP Allowlist Check
```

### 1.1 Key API Defense Mechanisms

- **CSRF Defense (`assertOrigin`)**: Rejects all cross-origin HTTP `POST` requests by strictly matching request headers (`Origin` and `Referer`) against the authoritative `https://madagascarhotelags.com` base.
- **Timing-Attack Defense (`timingSafeEq`)**: All API bearer tokens are validated using a constant-time comparison library. Standard string comparison (`==`) aborts on the first mismatched character, exposing token lengths and contents to timing enumeration probes; constant-time loops execute the full byte comparison under all circumstances.
- **Dynamic Rate Limiting (Upstash)**: Implements sliding-window rate limiters per IP. If the proxy hides the IP, the rate limiter falls back to a randomized session UUID to prevent an anonymous attacker from polluting the shared "unidentified" rate limit bucket and denying service to valid users.

---

## 2. Relational Database Hardening

Data access is built on the principle of **least privilege** to protect customer PII (Personally Identifiable Information) from SQL extraction or leaks.

### 2.1 Postgres Role Isolation (`cf_astro_writer`)

Instead of using the default PostgreSQL administrative superuser (`postgres`), the application connects to Supabase via a hardened role named `cf_astro_writer`:

- **Write-Only Privileges**: The role has `INSERT`-only permissions on PII tables (`bookings`, `booking_pets`, `consent_records`, `privacy_requests`).
- **Zero-Read Isolation**: Even if the `DATABASE_URL` credentials are fully compromised in the wild, the attacker cannot read, query, or dump existing customer data because the role lacks `SELECT` privileges on PII.

### 2.2 PII Minimization in Audit Logs

- **No PII in D1 Logs**: The local SQLite database is used strictly for technical performance and CMS blocks. The `booking_attempts` dead-letter queue logs transaction errors but explicitly strips out customer names, emails, and phone numbers before writing to D1.
- **No PII in Email Metadata**: Suppresses customer personal information inside `email_audit_logs` payloads, saving only booking references, services, and language locale slugs.

---

## 3. Privacy Compliance (LFPDPPP & GDPR)

Aguascalientes, Mexico operates under the **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)**. The consent pipeline is engineered to be fully legally compliant:

### 3.1 Forensically Auditable Consent Proofs

To establish non-repudiation in data collection audits, the Preact `ConsentBanner` collects forensic metadata verifying that a real human actively interacted with the banner:

- **Interaction Data**: Captures exact scroll depth, time elapsed before interaction, click quadrant, and device headers.
- **Text Hash Cryptography**: Captures a SHA-256 fingerprint of the exact translated privacy agreement text presented to the user during consent submission, guaranteeing that the user cannot claim they agreed to a different version of the notice.
- **Geographic Scrubbing**: Extracts geographic headers (`cf-ipcountry`, `cf-ipcity`) to confirm jurisdictional compliance but leaves the database IP fields null to respect GDPR data minimization rules.
- **Analytics Blockade**: PostHog and Cloudflare Web Analytics scripts are physically blocked from compiling or executing inside the DOM unless the consent state is explicitly set to `granted`.

### 3.2 Automated ARCO Requests

The `/api/privacy/arco` endpoint automates Mexican ARCO rights (Access, Rectification, Cancellation, Opposition):

- Customers can submit secure requests to query, alter, or erase their stored PII.
- Erased customer details are completely removed from Supabase, leaving only the randomized transaction UUID and service tags for bookkeeping audits.

---

## 4. Cloudflare Firewall Hardening Checklist

The following settings are actively enforced in the Cloudflare DNS and WAF dashboard:

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
> 1. **Do Not Store PII in D1**: D1 is an unencrypted local SQLite engine. Never modify schemas or booking logic to insert customer names, passwords, plain emails, or phone numbers into D1 tables. Keep all PII locked inside the Supabase PostgreSQL instance.
> 2. **Never Log Authorizations**: When auditing or handling exceptions inside API routes, never log the `Authorization` header, even partially. Substrings of `Bearer <secret>` expose secret prefixes to logs, breaking API token confidentiality.
> 3. **Never Query Supabase via administrative `postgres` User**: All write operations in Astro SSR must connect via `cf_astro_writer`. Never override this role to bypass least-privilege write isolation rules.

{% endraw %}

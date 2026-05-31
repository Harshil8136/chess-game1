{% raw %}
# Madagascar Pet Hotel (Cloudflare Edition) — Documentation Index

Welcome to the consolidated technical reference suite for **cf-astro** (Madagascar Pet Hotel on Cloudflare Pages). 

This folder contains high-fidelity, production-grade documentation tailored specifically for both **human developers** (technical and non-technical stakeholders) and **future agentic AI models** to read, understand, and update with complete precision.

---

## 🗺️ Master Documentation Directory

Rather than having dozens of small, scattered files, the system is fully consolidated into **3 Master Reference Manuals**, **1 Master Incident Post-Mortem**, and **1 Deep Security Audit**:

| Document | Category | Stakeholder Context | Focus Areas |
|---|---|---|---|
| [System Architecture & Operations](file:///e:/1/Madagascar%20Project/cf-astro/Documentation/SYSTEM-ARCHITECTURE.md) | Technical | Developers, DevOps, AI Models | Edge compute SSR, bindings (D1, KV, R2), API specs, 3-tier fallback, async emails, and manual provisioning. |
| [Frontend, PWA & Search Engine Optimization](file:///e:/1/Madagascar%20Project/cf-astro/Documentation/FRONTEND-AND-SEO.md) | Functional | Designers, Marketers, SEOs, AI | Design tokens, Tailwind CSS v4, hydration islands, PWAs, sitemap graphs, custom sitemaps, and Sentry budgets. |
| [Security, Compliance & System History](file:///e:/1/Madagascar%20Project/cf-astro/Documentation/COMPLIANCE-SECURITY-AND-HISTORY.md) | Administrative | Legal, Auditors, Developers, Owners | CSRF, Turnstile, timing-attack proofing, least-privilege Roles, LFPDPPP compliance, WAF checklists, and full changelog. |
| [Incident Report: Email Outage (2026-04-18)](file:///e:/1/Madagascar%20Project/cf-astro/Documentation/INCIDENT-2026-04-18-EMAIL-OUTAGE.md) | Incidents | Ops, Support, DevOps | Forensic review of the V8 isolate Eta `EvalError` failure, database schema correction, and queue recovery runbooks. |
| [Security & Compliance Deep Review (2026-05-29)](file:///e:/1/Madagascar%20Project/cf-astro/Documentation/19-SECURITY-COMPLIANCE-REVIEW-2026-05.md) | Audit | Security Auditors, AI | Deep security review report covering vulnerabilities, compliance gaps, privacy notices rewrites, and the security roadmap. |

---

## ⚡ Execution Quick Start

During local development or pre-commit checks, use these commands inside `cf-astro`:

```bash
# 1. Install dependencies
npm install

# 2. Run dev server (Astro + Vite)
npm run dev

# 3. Compile production build (verifies sourcemaps & sitemaps)
npm run build

# 4. Preview with Cloudflare bindings (D1 SQLite, R2 object, KV cache)
npm run cf:dev

# 5. Type-check and Astro diagnostics check (0 errors guarantee)
npm run check

# 6. Apply schemas to local D1 instance
npm run db:migrate

# 7. Apply schemas to production D1 instance
npm run db:migrate:remote
```

---

## 📋 System Metrics & Identity

- **Business Entity**: Hotel para Mascotas Madagascar — Aguascalientes, Mexico.
- **Apex Production URL**: [madagascarhotelags.com](https://madagascarhotelags.com)
- **Tech Stack**: Astro 6.1.2+ with `@astrojs/cloudflare` edge adapter.
- **Styling Model**: Tailwind CSS v4 compiled natively via Vite plugins.
- **Bilingual Support**: Spanish (default, `/es/`) and English (`/en/`).
- **Edge databases**: Cloudflare D1 (SQLite) and Supabase PostgreSQL.
- **Email Gateway**: Resend REST API triggered asynchronously via Cloudflare Queues.

---

## 🎯 Guidelines for AI Models & Future Updates

To preserve the architectural integrity of this project, future updates must strictly observe the **System Invariants** documented in:
1. [SYSTEM-ARCHITECTURE.md §10](file:///e:/1/Madagascar%20Project/cf-astro/Documentation/SYSTEM-ARCHITECTURE.md#L225) (Image processors, email consumers separation, and trailing slash enforcement).
2. [FRONTEND-AND-SEO.md §6](file:///e:/1/Madagascar%20Project/cf-astro/Documentation/FRONTEND-AND-SEO.md#L112) (Schema `@id` graph rules, AI crawler allowances, and inline json scripts).
3. [COMPLIANCE-SECURITY-AND-HISTORY.md §7](file:///e:/1/Madagascar%20Project/cf-astro/Documentation/COMPLIANCE-SECURITY-AND-HISTORY.md#L112) (PII boundaries, logging rules, and DB credentials handling).

{% endraw %}

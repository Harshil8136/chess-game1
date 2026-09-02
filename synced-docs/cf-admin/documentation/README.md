---

title: "Documentation Index & Map"
status: active
audience: [non-technical, ai, technical]
last_verified: 2026-08-23
verified_against: [code]
owner: harshil
related_docs: [CONTRIBUTING-DOCS.md, ../README.md, ../RULESAd.md]
tags: [meta, index]
---

# cf-admin Documentation

> **TL;DR (non-technical):** This is the map of all project documentation. Each
> entry says what a document is for and whether it's current. Start with the
> "Start here" links below.

Single index for every document under `documentation/`. See
[`CONTRIBUTING-DOCS.md`](CONTRIBUTING-DOCS.md) for naming and front-matter rules.
Every doc listed here must exist, and every doc under `documentation/` must be
listed here (the CI index-drift check enforces both).

## Start here

Every entry below is an `active` document. Dated reports are snapshots of the day
they were written — useful as history, not as the current state.

| If you want… | Read | Owns |
|---|---|---|
| **New to the project** | root [`README.md`](../README.md) | — |
| **Operating rules & policy** | root [`RULESAd.md`](../RULESAd.md) | stack versions, policy limits, gate status |
| **System architecture** | [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | request lifecycle, module pattern |
| **Who can do what** | [`architecture/PERMISSIONS-SYSTEM.md`](architecture/PERMISSIONS-SYSTEM.md) | **the permission model — authoritative** (role ladder, PLAC, API authz, revocation, measured cost) |
| **Audit engine internals** | [`architecture/plac-and-audit.md`](architecture/plac-and-audit.md) | **the Ghost Audit engine — authoritative** |
| **Security posture** | [`security/SECURITY.md`](security/SECURITY.md) | CSP, auth, RLS, current posture |
| **Infrastructure, bindings & deploy** | [`operations/OPERATIONS.md`](operations/OPERATIONS.md) | **binding registry — authoritative** (`../RULESAd.md` §12) |
| **What's still open** | [`MAINTENANCE.md`](MAINTENANCE.md) | the one live backlog |
| **What things cost** | [`2026-07-26-commercial-model-costing-pricing-and-scale.md`](2026-07-26-commercial-model-costing-pricing-and-scale.md) | **the cost model — authoritative** |
| **Blog / AI / SEO** | [`2026-08-03-blog-ai-seo-production-readiness.md`](2026-08-03-blog-ai-seo-production-readiness.md) | — |
| **Blog remediation & Suggestional Edit** | [`2026-08-30-blog-system-overhaul.md`](2026-08-30-blog-system-overhaul.md) | — |
| **AI reliability, cost truth & observability** | [`2026-08-31-ai-system-overhaul.md`](2026-08-31-ai-system-overhaul.md) | — |
| **Executive status snapshot** | [`2026-06-13-platform-status-summary.md`](2026-06-13-platform-status-summary.md) | *historical — two months old* |

> **One fact, one home.** Where a number appears in several documents it goes
> stale in all but one. The "Owns" column names the document that is allowed to
> state a given fact; everything else should link to it rather than restate it.
> If two documents disagree, the owner wins — and if the owner disagrees with
> code or config, the code wins and the owner is the bug.

## Naming

| Name | What it refers to |
|---|---|
| **cf-admin** | This repository and the Worker it deploys: the internal admin portal at `secure.madagascarhotelags.com`. Written lowercase in prose and paths. |
| **cf-astro** | Sibling repo — the public marketing site. Not in this checkout. |
| **cf-chatbot** | Sibling repo — the AI chatbot Worker (web + WhatsApp). Not in this checkout. |
| **Madagascar Pet Hotel** | The customer whose operation this platform runs. |
| **Velox** | The commercial product brand under which this platform is sold to other operators. Appears in the commercial and go-to-market documents and in `MAINTENANCE.md` (which references a copy-lint rule living in the Velox repo). It is the same software, marketed — not a separate system. |

## Status legend

`active` = current & maintained · `historical` = point-in-time snapshot (kept for
record) · `draft` = in progress · `deprecated` = superseded, pending removal.

## Business / Strategy

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`2026-07-17-compliance-standing-and-market-positioning.md`](2026-07-17-compliance-standing-and-market-positioning.md) | Quantified compliance % per standard + market positioning. **Superseded:** its multi-tenancy recommendation was rejected on 2026-07-26, and its percentages were re-derived by the 2026-07-22 audit | owner, non-technical, technical | historical |
| [`2026-06-16-business-viability-and-compliance-assessment.md`](2026-06-16-business-viability-and-compliance-assessment.md) | Viability of selling the platform, multi-jurisdiction compliance posture | non-technical, owner | historical |
| [`2026-07-27-go-to-market-prospecting-and-roadmap.md`](2026-07-27-go-to-market-prospecting-and-roadmap.md) | GTM: the two sales motions and how they differ, ICP/anti-ICP, eight prospecting plays, the funnel end to end, the fleet capacity gate that bounds growth, a phased roadmap with gates, what to measure, risk register, and what is safe to say to a prospect | owner, non-technical, technical, operator, ai | active |
| [`2026-07-29-review-findings-and-open-questions.md`](2026-07-29-review-findings-and-open-questions.md) | Live-verified review across all three repos and every connected service (Cloudflare, both Supabase projects, Sentry, PostHog), the 14 contradictions with a buyer or auditor on the other side, and a 150-question bank to answer before the correction pass | owner, non-technical, technical, operator, ai | active |
| [`commercial/MODULE-PRICING-CATALOG.md`](commercial/MODULE-PRICING-CATALOG.md) | Per-module pricing (Search Console Sync, Staff Storage, AI chatbot, AI blog/visibility engine, RBAC/Zero Trust, observability): dev cost, running cost, sourced competitor pricing, recommended Velox add-on price | owner, non-technical, technical, operator | active |
| [`commercial/PLATFORM-BUY-VS-BUILD-COMPARISON.md`](commercial/PLATFORM-BUY-VS-BUILD-COMPARISON.md) | What assembling a comparable 7-vendor commercial stack costs ($490-1,363/mo) versus this platform's ~$30-36/mo infra cost and $59-499/mo Velox pricing, with caveats on what the comparison does and doesn't capture | owner, non-technical, technical | active |
| [`commercial/BILLING-MODEL-AND-VIABILITY.md`](commercial/BILLING-MODEL-AND-VIABILITY.md) | CFZT-based seat metering evaluated as the enforcement layer under Velox's existing seat tiers, the build-fee/annual-contract model reconciled against the live funnel, and an honest personal-viability answer (infra ≈$0, operations is 60-70% of true cost, AI speeds build not support) | owner | active |

## Architecture

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | Lean Edge stack, request lifecycle, module pattern, CPU budget | ai, technical | active |
| [`architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md`](architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md) | System blueprint for D1 Blog, Workers AI RAG context retrieval, ISR cache purge, and Edge SSR | ai, technical, operator | active |
| [`architecture/KV-RESILIENCE.md`](architecture/KV-RESILIENCE.md) | KV caching strategy, quotas, fail-safe fallback chain | ai, technical | active |
| [`architecture/GLOBAL-CONFIG.md`](architecture/GLOBAL-CONFIG.md) | Research reference (not implemented): dynamic system-wide settings (session timing, theme default, page notices) via a KV-cached, D1-backed config layer — found the D1/UI plumbing already exists but is disconnected from runtime enforcement; fact-checks a JWT-delivery alternative, plus full cost/latency/long-run-maintenance analysis | ai, technical, owner | draft |
| [`architecture/PERMISSIONS-SYSTEM.md`](architecture/PERMISSIONS-SYSTEM.md) | **The permission model, authoritative** — RBAC ladder, ACM page registry, PLAC overrides, the request lifecycle and every rejection path, provisioning gates, revocation timing, measured latency and resource accounting, and a comparison against Zanzibar/OpenFGA, Auth0/Keycloak and policy-engine designs | ai, technical, operator | active |
| [`architecture/plac-and-audit.md`](architecture/plac-and-audit.md) | RBAC + PLAC resolution + Ghost Audit Engine internals | ai, technical | active |
| [`2026-06-18-system-review-and-iso5055-benchmark.md`](2026-06-18-system-review-and-iso5055-benchmark.md) | Comprehensive ISO5055 benchmark, code quality, and MCP service audit | ai, technical | historical |
| [`2026-07-05-comprehensive-codebase-and-system-review.md`](2026-07-05-comprehensive-codebase-and-system-review.md) | Full multi-benchmark scorecard (ISO 5055/25010, OWASP, CWE), findings + prioritized fix roadmap | ai, technical, operator, owner | historical |
| [`2026-07-22-architecture-improvement-summary.md`](2026-07-22-architecture-improvement-summary.md) | 12-commit architecture pass: SEC-03/SEC-04 closed, CSP guard fixed, 4 god-files split, before/after benchmark scorecard | non-technical, ai, technical, operator | historical |
| [`2026-07-22-codebase-services-architecture-and-setup-review.md`](2026-07-22-codebase-services-architecture-and-setup-review.md) | Live-verified deep review: codebase health, service topology, DB structure, CI/CD & cross-repo docs-sync pipeline, dependency freshness, findings punch list | owner, non-technical, technical, operator, ai | historical |
| [`2026-08-02-ui-consolidation-and-security-remediation.md`](2026-08-02-ui-consolidation-and-security-remediation.md) | 15-commit pass: stored-XSS regression in the email editor closed, fabricated dashboard KPIs removed (RULE #0.5), shared Preact UI primitives relocated + made theme-aware and rolled out to Sessions/Debug/Bookings (652 → 0 raw colour values), new Menu primitive, 4 god-files split, before/after ratings + explicit verification gaps | non-technical, ai, technical, operator | historical |
| [`2026-08-03-blog-ai-seo-production-readiness.md`](2026-08-03-blog-ai-seo-production-readiness.md) | Cross-repo blog AI-generation → publish → SEO/AIO/GEO reference: full workflow, time-to-live tables, quality gate + cadence-lock safety rails, service coordination map, and the security/data-integrity fixes (stored-XSS, silent slug-save bug) found and closed in the same pass | non-technical, ai, technical, operator, owner | active |
| [`architecture/RATE-LIMITING-AND-REDIS-ELIMINATION-STRATEGY.md`](architecture/RATE-LIMITING-AND-REDIS-ELIMINATION-STRATEGY.md) | Comprehensive rate limiting evaluation, KV 1k write limit risk analysis, Workers native `[[ratelimits]]` bindings, and Redis elimination roadmap | ai, technical, owner, operator | active |
| [`2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](2026-08-06-data-infrastructure-audit-and-reuse-policy.md) | Live D1 + Supabase table inventory (row counts, dead-table findings: `admin_sessions`, `privacy_requests`, `cms_content_history`) plus the reuse-before-creation policy this drove — see `RULESAd.md` RULE #0.6 | ai, technical, owner | active |
| [`2026-08-30-blog-system-overhaul.md`](2026-08-30-blog-system-overhaul.md) | Blog remediation across both repos: why the Studio showed no articles, the fabricated article that reached production, the 15 defects found, the 14-article legacy import, human-reviewed AI Suggestional Edits, and before/after metrics | non-technical, ai, technical, operator, owner | active |
| [`2026-08-31-ai-system-overhaul.md`](2026-08-31-ai-system-overhaul.md) | AI layer overhaul: why generation failed 100% of the time, the RAG grounding that never once read the knowledge base, a spend counter 6.3x under actual, per-inference telemetry with no new table, and the UI claims nobody had computed | non-technical, ai, technical, operator, owner | active |

## Security

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`security/SECURITY.md`](security/SECURITY.md) | Canonical current security posture (CSRF, headers, sessions, RLS, force-kick) | ai, technical | active |
| [`security/PRIVACY.md`](security/PRIVACY.md) | Privacy dashboard, consent records, GDPR/LFPDPPP | ai, technical, operator | active |
| [`security/RoPA.md`](security/RoPA.md) | Record of Processing Activities (GDPR Art. 30) — data inventory, legal bases, sub-processors | owner, operator, technical, ai | active |
| [`security/THREAT-MODEL.md`](security/THREAT-MODEL.md) | STRIDE threat model + data-flow diagram + residual-risk ranking | technical, operator, ai, owner | active |
| [`security/login-forensics.md`](security/login-forensics.md) | Login forensics subsystem (schema, telemetry, alerts) | ai, technical | active |
| [`security/reviews/2026-07-17-full-platform-audit.md`](security/reviews/2026-07-17-full-platform-audit.md) | Full-platform OWASP/SOC2/GDPR/CCPA audit + zero-cost roadmap + multi-tenant readiness | technical, operator | historical |
| [`security/reviews/2026-06-13-security-review.md`](security/reviews/2026-06-13-security-review.md) | Latest security review + remediation, scored (A− 91/100) — full fix pass | technical, operator | historical |
| [`security/reviews/2026-05-26-security-review.md`](security/reviews/2026-05-26-security-review.md) | Security review (follow-up) | technical | historical |
| [`security/reviews/2026-05-25-security-review.md`](security/reviews/2026-05-25-security-review.md) | Deep security review | technical | historical |
| [`security/reviews/2026-05-24-security-review.md`](security/reviews/2026-05-24-security-review.md) | CSP phase 1 hardening audit | technical | historical |
| [`security/reviews/2026-04-24-ssl-lighthouse-audit.md`](security/reviews/2026-04-24-ssl-lighthouse-audit.md) | SSL / Lighthouse audit | technical | historical |

## Features

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`features/DASHBOARD.md`](features/DASHBOARD.md) | Dashboard home, analytics providers, widgets | ai, technical | active |
| [`features/USER-MANAGEMENT.md`](features/USER-MANAGEMENT.md) | RBAC hierarchy, user lifecycle, ghost protection, sessions | ai, technical | active |
| [`features/CF-ACCESS-SYNC.md`](features/CF-ACCESS-SYNC.md) | CF Access Group whitelist sync: architecture, 2026-07-24 root-cause fix, durability (log + cron self-heal), Users-tab visibility, runbook | ai, technical, operator | active |
| [`features/CFZT-GOOGLE-QUICK-RESUME.md`](features/CFZT-GOOGLE-QUICK-RESUME.md) | Cloudflare Zero Trust Quick-Resume: 'Continue with {User Last Used Email}' via Google OAuth, client-side identity memory, Instant Authentication runbook | ai, technical, operator | active |
| [`features/SESSION-MANAGEMENT.md`](features/SESSION-MANAGEMENT.md) | Security → Sessions page: live sessions, forensics, revocations, KV-budget discipline | ai, technical, operator | active |
| [`features/CMS.md`](features/CMS.md) | Content studio, ISR revalidation, KV injection, R2/CDN | ai, technical | active |
| [`features/CHATBOT.md`](features/CHATBOT.md) | AI pipeline, proxy architecture, admin UI, analytics | ai, technical | active |
| [`features/EMAIL-PORTAL.md`](features/EMAIL-PORTAL.md) | Email Portal: compose/send, drafts, templates, scheduling, queue delivery tracking; RBAC+PLAC gating | non-technical, ai, technical, operator | active |
| [`features/CONTROL-PLANE.md`](features/CONTROL-PLANE.md) | Service Control Plane: two-layer model, access, API surface | ai, technical | active |
| [`features/CONTROL-PLANE-CONNECTORS.md`](features/CONTROL-PLANE-CONNECTORS.md) | Layer-B connector reference (Sentry/PostHog/Cloudflare/Supabase) | ai, technical | active |
| [`features/STAFF-MANAGED-STORAGE.md`](features/STAFF-MANAGED-STORAGE.md) | Staff Managed Storage: private per-role file drive, external vendor sharing with email delivery, inbound File Request Links (added 2026-08-09), weekly drift reconciliation, admin quota/config controls — shipped 2026-08-05; business-value/market-comparison section added 2026-08-13 | non-technical, ai, technical, operator | active |
| [`features/SEARCH-CONSOLE-SYNC.md`](features/SEARCH-CONSOLE-SYNC.md) | Search Console Sync: automated Google Search Console sitemap/indexing checks + weekly PageSpeed Insights (Core Web Vitals), read-only/ToS-compliant by design, full call-level audit log, CSV export, ops-alert emails, business-value & market-comparison analysis — shipped 2026-08-12 | non-technical, ai, technical, operator, owner | active |
| [`features/GSC-AUTO-HEALING-AND-VALIDATION-ENGINE.md`](features/GSC-AUTO-HEALING-AND-VALIDATION-ENGINE.md) | Google Search Console Error Auto-Healing & Validation Readiness Engine: 5-category diagnostic triage, 12h automated cron readiness scoring, in-place collapsible drawers, RULESAd §7.8 native dialog compliance, and main dashboard integration — shipped 2026-08-24 | non-technical, ai, technical, operator, owner | active |

## Operations

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`operations/OPERATIONS.md`](operations/OPERATIONS.md) | Binding IDs, free-tier limits, secrets registry, deploy | ai, technical, operator | active |
| [`operations/DEV-TOOLS.md`](operations/DEV-TOOLS.md) | Edge Command Center — debug tools, diagnostics | ai, technical | active |

## Reference

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`reference/coding-standards.md`](reference/coding-standards.md) | DAL pattern, TypeScript standards, component rules, naming | ai, technical | active |
| [`reference/DESIGN-SYSTEM.md`](reference/DESIGN-SYSTEM.md) | Midnight Slate tokens, CSS architecture, components | ai, technical | active |
| [`reference/control-plane-design/VISUAL-OVERHAUL-PLAN.md`](reference/control-plane-design/VISUAL-OVERHAUL-PLAN.md) | Control Plane visual/theme-unification proposal, moved from the removed `docs/` tree (2026-08-12) — partially implemented, theme unification still open | ai, technical | draft |
| [`reference/SYNC-SYSTEM-REVIEW.md`](reference/SYNC-SYSTEM-REVIEW.md) | Sync-system architecture review + durability roadmap (outbox, read-back, versioning) | ai, technical | active |
| [`reference/schema-change-ledger.md`](reference/schema-change-ledger.md) | RULE #0.7's applied-ledger artifact: one row per migration (file, date, applied by, description), started 2026-08-12, not backfilled | ai, technical | active |
| [`reference/commercial-readiness-checklist.md`](reference/commercial-readiness-checklist.md) | Pet-hotel decoupling roadmap toward a generic Workers admin framework | owner, technical | draft |
| [`reference/RBAC-AT-SCALE.md`](reference/RBAC-AT-SCALE.md) | Research reference (not implemented): scaling permissions from 6 roles/small staff to 100+ roles/1000+ staff — fact-checks a proposed design, covers RBAC/PBAC/ABAC/ReBAC/bitmask models, verified Cloudflare KV/D1/Durable Objects consistency + pricing, and a recommended blueprint | ai, technical, owner | draft |
| [`reference/PERMISSION-ARCHITECTURE-ASSESSMENT.md`](reference/PERMISSION-ARCHITECTURE-ASSESSMENT.md) | Current RBAC+PLAC+CFZT system explained end to end, fact-checked against a proposed browser-held JWT redesign; multi-benchmark comparison, per-staff-count service-usage modeling (10/20/50/100/1,000+), ×5/×10 scaling recommendations, and ASVS/SOC2 standards positioning for both designs | ai, technical, owner, non-technical | draft |
| [`reference/DYNAMIC-ROLES-PBAC-DESIGN.md`](reference/DYNAMIC-ROLES-PBAC-DESIGN.md) | Greenfield PBAC design: fully dynamic, admin-editable roles/groups built from a fixed, code-anchored permission catalog — data model, request-resolution flow, library build-vs-buy decision, per-service usage across the current stack, and why it simplifies (not just modernizes) today's RBAC+PLAC split | ai, technical, owner, non-technical | draft |

## Compliance

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`security/compliance/ASVS-L2.md`](security/compliance/ASVS-L2.md) | OWASP ASVS v4.0.3 Level 2 verification matrix (per-control status + evidence) | technical, operator, owner | active |
| [`security/compliance/CSA-CAIQ-v4.md`](security/compliance/CSA-CAIQ-v4.md) | CSA STAR Level 1 Consensus Assessments Initiative Questionnaire (CAIQ v4.0.3) — registry-ready | technical, owner | active |
| [`security/compliance/SOC2-TSC-mapping.md`](security/compliance/SOC2-TSC-mapping.md) | SOC 2 Type I readiness: control-to-TSC mapping + gap list | technical, owner | active |
| [`security/compliance/AI-GOVERNANCE.md`](security/compliance/AI-GOVERNANCE.md) | AI model inventory, human-oversight statement, EU AI Act deployer position, NIST AI RMF self-map | technical, owner, operator | active |
| [`security/compliance/ACCESSIBILITY.md`](security/compliance/ACCESSIBILITY.md) | WCAG 2.2 AA conformance statement + A11Y rule crosswalk (non-conformant; open defects listed) | technical, owner, operator | active |
| [`security/compliance/ISO-27017-27018.md`](security/compliance/ISO-27017-27018.md) | Cloud shared-responsibility (27017) and PII-in-cloud processor (27018) statements | technical, owner | active |
| [`security/compliance/data-residency.md`](security/compliance/data-residency.md) | Data residency, cross-border transfer mechanisms, GPC scope | technical, owner, operator | active |
| [`security/compliance/supabase-advisors-latest.json`](security/compliance/supabase-advisors-latest.json) | Supabase advisor baseline (2026-07-08). SEC-11 regression guard is **planned, not implemented**; baseline is stale as of 2026-07-25 — see MAINTENANCE.md | technical | active |
| [`2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md) | Full-spectrum audit across 45+ frameworks (SOC 1/2/3, ISO 27001/27017/27018/27701/22301/9001/42001, NIST CSF/800-53/AI RMF, CSA STAR, HITRUST, FedRAMP, WCAG/ADA, EU AI Act, GDPR/CCPA/20-state US patchwork + global privacy law, HIPAA/PCI/GLBA/SOX scope notes) with scoring, gap register, and a phased sellability roadmap | owner, non-technical, technical, operator, ai | active |
| [`2026-07-26-commercial-model-costing-pricing-and-scale.md`](2026-07-26-commercial-model-costing-pricing-and-scale.md) | Commercial model: per-deployment fleet costing, unit economics, pricing floor/recommended/ceiling, scale ceilings, ICP, modularity fact-check | owner, technical, operator, ai | active |

## Specs (dated design records)

| Doc | Purpose | Status |
|-----|---------|--------|
| [`specs/2026-04-25-user-registry-design.md`](specs/2026-04-25-user-registry-design.md) | User registry "Midnight Command" redesign | historical |
| [`specs/2026-05-03-settings-design.md`](specs/2026-05-03-settings-design.md) | Settings dashboard design | historical |
| [`specs/2026-05-12-bookings-header-design.md`](specs/2026-05-12-bookings-header-design.md) | Bookings page header redesign | historical |
| [`specs/2026-05-13-cms-ui-redesign.md`](specs/2026-05-13-cms-ui-redesign.md) | CMS UI redesign | historical |
| [`specs/2026-07-26-payload-cms-evaluation-and-dynamic-blog.md`](specs/2026-07-26-payload-cms-evaluation-and-dynamic-blog.md) | Payload CMS evaluation (MIT ✓, Cloudflare ✓, Workers-Paid-only ✗) + alternatives + recommended $0 dynamic-blog blueprint on the existing D1 CMS | historical |
| [`specs/2026-07-29-content-and-ai-visibility-engine.md`](specs/2026-07-29-content-and-ai-visibility-engine.md) | Tiptap authoring + Workers AI analysis as a paid module: Tiptap licensing fact-check, measured neuron costs (≈162/post), nine capability additions with the measurement half prioritised first, 110–150 h effort breakdown, and a pricing correction from $14.99+$24.99 to a single $79–129/mo flagship | historical |

## Runbooks

| Doc | Purpose | Status |
|-----|---------|--------|
| [`runbooks/ssr-silent-blank-screen.md`](runbooks/ssr-silent-blank-screen.md) | Known issue: SSR silent blank screen diagnosis | active |
| [`runbooks/incident-response.md`](runbooks/incident-response.md) | Incident response + GDPR Art. 33 72-hour breach notification (severity, containment, notification matrix) | active |
| [`runbooks/disaster-recovery.md`](runbooks/disaster-recovery.md) | Backup/restore per store, RTO/RPO targets, scenario playbooks (drill outstanding) | active |
| [`runbooks/release-and-rollback.md`](runbooks/release-and-rollback.md) | The release path (Workers Builds → `build:ci` / `deploy:ci`: verify, migrate before deploy, smoke), expand/contract policy for migrations, the one-time dashboard switch-on, and code-vs-schema rollback | active |
| [`runbooks/cron-scheduled-exception.md`](runbooks/cron-scheduled-exception.md) | Cron `*/5` scheduled-handler exception (CF Access audit poller): diagnosis + fix | active |
| [`runbooks/cloudflare-deploy-queue-handler-missing.md`](runbooks/cloudflare-deploy-queue-handler-missing.md) | Deploy fails with `Queue handler is missing [code: 11001]` while the build passes: missing `main` entrypoint in wrangler.toml, diagnosis + fix + guard | active |
| [`runbooks/brevo-webhook.md`](runbooks/brevo-webhook.md) | Enable Brevo delivery webhook: Worker secret + CF Access bypass policy + Brevo config | active |
| [`runbooks/supabase-leaked-password-protection.md`](runbooks/supabase-leaked-password-protection.md) | Enable Supabase Auth HIBP leaked-password check (3-step dashboard toggle) | active |
| [`runbooks/supabase-account-advisor-sweep.md`](runbooks/supabase-account-advisor-sweep.md) | Quarterly account-wide advisor sweep: enumerate every Supabase project before checking any, triage table, 2026-07-29 baseline (production 1 finding vs superseded project 128), and the export-before-pause ordering | active |
| [`runbooks/public-share-links-domain-isolation.md`](runbooks/public-share-links-domain-isolation.md) | External vendor share links + File Request Links + RFC 8058 unsubscribe reachable on the single primary domain (`secure.madagascarhotelags.com`) via a Cloudflare Access Path-Based Bypass Policy — supersedes the earlier dedicated-hostname (`share.madagascarhotelags.com`) design; flags an unverified gap for the request-link path (2026-08-12) | active |

## Archive (historical — kept verbatim)

| Doc | Purpose | Status |
|-----|---------|--------|
| [`archive/COMPLETED_PHASES.md`](archive/COMPLETED_PHASES.md) | Full implementation log of completed phases | historical |
| [`archive/PENDING_PHASES.md`](archive/PENDING_PHASES.md) | Post-review tracker (superseded by MAINTENANCE.md) | historical |
| [`archive/ToDoList.md`](archive/ToDoList.md) | Phase 4 hardening backlog (superseded by MAINTENANCE.md) | historical |
| [`archive/NEW_FILES_CREATED.md`](archive/NEW_FILES_CREATED.md) | Refactor-session file snapshot | historical |
| [`archive/REFACTORING_OVERVIEW.md`](archive/REFACTORING_OVERVIEW.md) | Refactoring project overview | historical |
| [`archive/control-plane-design/PLAN.md`](archive/control-plane-design/PLAN.md) | Control-plane design record (provider API specs, phases). Archived 2026-08-23 — specifies routes never built; see `features/CONTROL-PLANE.md` for what exists | historical |
| [`archive/control-plane-design/TECHNICAL_OVERVIEW.md`](archive/control-plane-design/TECHNICAL_OVERVIEW.md) | Control-plane technical overview (same design record). Archived 2026-08-23 | historical |

## Viability Program

The chunk-by-chunk long-term viability program started 2026-09-02. Evergreen
roadmap and registry, one record per chunk, decision records. Excluded from
the public docs mirror (ADR-0001).

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`program/ROADMAP.md`](program/ROADMAP.md) | The ordered chunk table, owner decisions, principles, dependency lanes and definition of done — updated every chunk | owner, ai, technical, operator | active |
| [`program/DEBT-REGISTRY.md`](program/DEBT-REGISTRY.md) | Every metric the program moves, with its counting command, 2026-09-02 baseline and current value; live-estate facts and the free-tier limits designed against | ai, technical, owner | active |
| [`program/CHUNK-TEMPLATE.md`](program/CHUNK-TEMPLATE.md) | The twelve-section record every chunk writes before its code, and the draft → active → historical lifecycle | ai, technical | active |
| [`program/adr/ADR-0001-program-constraints.md`](program/adr/ADR-0001-program-constraints.md) | The seven owner decisions that bind the program: scope, $0 budget, dependency approval, safety-first order, Workers Builds deploy, manual-only retention, no staging | owner, ai, technical, operator | active |
| [`program/chunks/2026-09-02-00-program-scaffolding.md`](program/chunks/2026-09-02-00-program-scaffolding.md) | Chunk P0 record: this folder, the baseline registry, and the four documentation contradictions corrected | ai, technical, owner | historical |
| [`program/chunks/2026-09-02-01-real-runtime-test-harness.md`](program/chunks/2026-09-02-01-real-runtime-test-harness.md) | Chunk 1 record: the Workers test pool enabled with a production schema snapshot, fixtures, the first middleware/route/repository/cron/queue tests, and the coverage baseline | ai, technical, owner | historical |
| [`program/chunks/2026-09-02-02-config-truth.md`](program/chunks/2026-09-02-02-config-truth.md) | Chunk 2 record: `Env` generated from `wrangler.toml`, required-secrets validation at deploy, the 92 untyped env accesses fixed at source, `.dev.vars.example`, offline build flag, and C-12 (`_headers`) closed by evidence | ai, technical, owner, operator | historical |
| [`program/chunks/2026-09-02-03-release-discipline.md`](program/chunks/2026-09-02-03-release-discipline.md) | Chunk 3 record: the release script and its unit-tested guards, Workers Builds build/deploy commands, release id = commit SHA, the health route split by auth with the synthetic metrics removed, local verify = CI | ai, technical, owner, operator | historical |

## Meta

| Doc | Purpose | Status |
|-----|---------|--------|
| [`CONTRIBUTING-DOCS.md`](CONTRIBUTING-DOCS.md) | Documentation conventions & governance | active |
| [`_templates/doc-template.md`](_templates/doc-template.md) | Canonical doc template | active |
| [`MAINTENANCE.md`](MAINTENANCE.md) | Single live maintenance backlog | active |

## Root-level entry docs (stay at root, exempt from front-matter)

| Doc | Purpose |
|-----|---------|
| [`../README.md`](../README.md) | Project entry point / quick start |
| [`../RULESAd.md`](../RULESAd.md) | Operational Rules Bible + policy contract |
| [`../main.md`](../main.md) | AI entry pointer into `documentation/` |
| [`../AI_CODE_MAINTENANCE.md`](../AI_CODE_MAINTENANCE.md) | AI-agent code-maintenance rules |

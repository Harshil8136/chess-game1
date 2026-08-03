---

title: "Documentation Index & Map"
status: active
audience: [non-technical, ai, technical]
last_verified: 2026-08-03
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

- **Executive status, ratings, scale & cost (both repos)** → [`2026-06-13-platform-status-summary.md`](2026-06-13-platform-status-summary.md)
- **New to the project?** → root [`README.md`](../README.md)
- **Operating rules & policy** → root [`RULESAd.md`](../RULESAd.md)
- **System architecture** → [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md)
- **Dynamic D1 Blog & Workers AI RAG Architecture** → [`architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md`](architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md)
- **Blog AI/SEO/AIO/GEO — complete reference (current, verified)** → [`2026-08-03-blog-ai-seo-production-readiness.md`](2026-08-03-blog-ai-seo-production-readiness.md)
- **Security posture** → [`security/SECURITY.md`](security/SECURITY.md)
- **Infrastructure & deploy** → [`operations/OPERATIONS.md`](operations/OPERATIONS.md)
- **Open maintenance items** → [`MAINTENANCE.md`](MAINTENANCE.md)

## Status legend

`active` = current & maintained · `historical` = point-in-time snapshot (kept for
record) · `draft` = in progress · `deprecated` = superseded, pending removal.

## Business / Strategy

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`2026-07-17-compliance-standing-and-market-positioning.md`](2026-07-17-compliance-standing-and-market-positioning.md) | Quantified compliance % per standard (instant/close/far) + market positioning, verticals, and monetization | owner, non-technical, technical | active |
| [`2026-06-16-business-viability-and-compliance-assessment.md`](2026-06-16-business-viability-and-compliance-assessment.md) | Viability of selling the platform, multi-jurisdiction compliance posture | non-technical, owner | historical |
| [`2026-07-27-go-to-market-prospecting-and-roadmap.md`](2026-07-27-go-to-market-prospecting-and-roadmap.md) | GTM: the two sales motions and how they differ, ICP/anti-ICP, eight prospecting plays, the funnel end to end, the fleet capacity gate that bounds growth, a phased roadmap with gates, what to measure, risk register, and what is safe to say to a prospect | owner, non-technical, technical, operator, ai | active |
| [`2026-07-29-review-findings-and-open-questions.md`](2026-07-29-review-findings-and-open-questions.md) | Live-verified review across all three repos and every connected service (Cloudflare, both Supabase projects, Sentry, PostHog), the 14 contradictions with a buyer or auditor on the other side, and a 150-question bank to answer before the correction pass | owner, non-technical, technical, operator, ai | active |

## Architecture

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | Lean Edge stack, request lifecycle, module pattern, CPU budget | ai, technical | active |
| [`architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md`](architecture/DYNAMIC-BLOG-AI-RAG-SYSTEM-ARCHITECTURE.md) | System blueprint for D1 Blog, Workers AI RAG context retrieval, ISR cache purge, and Edge SSR | ai, technical, operator | active |
| [`architecture/KV-RESILIENCE.md`](architecture/KV-RESILIENCE.md) | KV caching strategy, quotas, fail-safe fallback chain | ai, technical | active |
| [`architecture/plac-and-audit.md`](architecture/plac-and-audit.md) | RBAC + PLAC resolution + Ghost Audit Engine internals | ai, technical | active |
| [`2026-06-18-system-review-and-iso5055-benchmark.md`](2026-06-18-system-review-and-iso5055-benchmark.md) | Comprehensive ISO5055 benchmark, code quality, and MCP service audit | ai, technical | active |
| [`2026-07-05-comprehensive-codebase-and-system-review.md`](2026-07-05-comprehensive-codebase-and-system-review.md) | Full multi-benchmark scorecard (ISO 5055/25010, OWASP, CWE), findings + prioritized fix roadmap | ai, technical, operator, owner | active |
| [`2026-07-22-architecture-improvement-summary.md`](2026-07-22-architecture-improvement-summary.md) | 12-commit architecture pass: SEC-03/SEC-04 closed, CSP guard fixed, 4 god-files split, before/after benchmark scorecard | non-technical, ai, technical, operator | active |
| [`2026-07-22-codebase-services-architecture-and-setup-review.md`](2026-07-22-codebase-services-architecture-and-setup-review.md) | Live-verified deep review: codebase health, service topology, DB structure, CI/CD & cross-repo docs-sync pipeline, dependency freshness, findings punch list | owner, non-technical, technical, operator, ai | active |
| [`2026-08-02-ui-consolidation-and-security-remediation.md`](2026-08-02-ui-consolidation-and-security-remediation.md) | 15-commit pass: stored-XSS regression in the email editor closed, fabricated dashboard KPIs removed (RULE #0.5), shared Preact UI primitives relocated + made theme-aware and rolled out to Sessions/Debug/Bookings (652 → 0 raw colour values), new Menu primitive, 4 god-files split, before/after ratings + explicit verification gaps | non-technical, ai, technical, operator | active |
| [`2026-08-03-blog-ai-seo-production-readiness.md`](2026-08-03-blog-ai-seo-production-readiness.md) | Cross-repo blog AI-generation → publish → SEO/AIO/GEO reference: full workflow, time-to-live tables, quality gate + cadence-lock safety rails, service coordination map, and the security/data-integrity fixes (stored-XSS, silent slug-save bug) found and closed in the same pass | non-technical, ai, technical, operator, owner | active |

## Security

| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`security/SECURITY.md`](security/SECURITY.md) | Canonical current security posture (CSRF, headers, sessions, RLS, force-kick) | ai, technical | active |
| [`security/PRIVACY.md`](security/PRIVACY.md) | Privacy dashboard, consent records, GDPR/LFPDPPP | ai, technical, operator | active |
| [`security/RoPA.md`](security/RoPA.md) | Record of Processing Activities (GDPR Art. 30) — data inventory, legal bases, sub-processors | owner, operator, technical, ai | active |
| [`security/THREAT-MODEL.md`](security/THREAT-MODEL.md) | STRIDE threat model + data-flow diagram + residual-risk ranking | technical, operator, ai, owner | active |
| [`security/login-forensics.md`](security/login-forensics.md) | Login forensics subsystem (schema, telemetry, alerts) | ai, technical | active |
| [`security/reviews/2026-07-17-full-platform-audit.md`](security/reviews/2026-07-17-full-platform-audit.md) | Full-platform OWASP/SOC2/GDPR/CCPA audit + zero-cost roadmap + multi-tenant readiness | technical, operator | active |
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
| [`features/SESSION-MANAGEMENT.md`](features/SESSION-MANAGEMENT.md) | Security → Sessions page: live sessions, forensics, revocations, KV-budget discipline | ai, technical, operator | active |
| [`features/CMS.md`](features/CMS.md) | Content studio, ISR revalidation, KV injection, R2/CDN | ai, technical | active |
| [`features/CHATBOT.md`](features/CHATBOT.md) | AI pipeline, proxy architecture, admin UI, analytics | ai, technical | active |
| [`features/EMAIL-PORTAL.md`](features/EMAIL-PORTAL.md) | Email Portal: compose/send, drafts, templates, scheduling, queue delivery tracking; RBAC+PLAC gating | non-technical, ai, technical, operator | active |
| [`features/CONTROL-PLANE.md`](features/CONTROL-PLANE.md) | Service Control Plane: two-layer model, access, API surface | ai, technical | active |
| [`features/CONTROL-PLANE-CONNECTORS.md`](features/CONTROL-PLANE-CONNECTORS.md) | Layer-B connector reference (Sentry/PostHog/Cloudflare/Supabase) | ai, technical | active |

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
| [`reference/control-plane-design/PLAN.md`](reference/control-plane-design/PLAN.md) | Control-plane design doc (provider API specs, phases) | ai, technical | active |
| [`reference/control-plane-design/TECHNICAL_OVERVIEW.md`](reference/control-plane-design/TECHNICAL_OVERVIEW.md) | Control-plane technical overview | ai, technical | active |
| [`reference/SYNC-SYSTEM-REVIEW.md`](reference/SYNC-SYSTEM-REVIEW.md) | Sync-system architecture review + durability roadmap (outbox, read-back, versioning) | ai, technical | active |
| [`reference/commercial-readiness-checklist.md`](reference/commercial-readiness-checklist.md) | Pet-hotel decoupling roadmap toward a generic Workers admin framework | owner, technical | draft |

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
| [`specs/2026-07-26-payload-cms-evaluation-and-dynamic-blog.md`](specs/2026-07-26-payload-cms-evaluation-and-dynamic-blog.md) | Payload CMS evaluation (MIT ✓, Cloudflare ✓, Workers-Paid-only ✗) + alternatives + recommended $0 dynamic-blog blueprint on the existing D1 CMS | active |
| [`specs/2026-07-29-content-and-ai-visibility-engine.md`](specs/2026-07-29-content-and-ai-visibility-engine.md) | Tiptap authoring + Workers AI analysis as a paid module: Tiptap licensing fact-check, measured neuron costs (≈162/post), nine capability additions with the measurement half prioritised first, 110–150 h effort breakdown, and a pricing correction from $14.99+$24.99 to a single $79–129/mo flagship | active |

## Runbooks

| Doc | Purpose | Status |
|-----|---------|--------|
| [`runbooks/ssr-silent-blank-screen.md`](runbooks/ssr-silent-blank-screen.md) | Known issue: SSR silent blank screen diagnosis | active |
| [`runbooks/incident-response.md`](runbooks/incident-response.md) | Incident response + GDPR Art. 33 72-hour breach notification (severity, containment, notification matrix) | active |
| [`runbooks/disaster-recovery.md`](runbooks/disaster-recovery.md) | Backup/restore per store, RTO/RPO targets, scenario playbooks (drill outstanding) | active |
| [`runbooks/cron-scheduled-exception.md`](runbooks/cron-scheduled-exception.md) | Cron `*/5` scheduled-handler exception (CF Access audit poller): diagnosis + fix | active |
| [`runbooks/cloudflare-deploy-queue-handler-missing.md`](runbooks/cloudflare-deploy-queue-handler-missing.md) | Deploy fails with `Queue handler is missing [code: 11001]` while the build passes: missing `main` entrypoint in wrangler.toml, diagnosis + fix + guard | active |
| [`runbooks/brevo-webhook.md`](runbooks/brevo-webhook.md) | Enable Brevo delivery webhook: Worker secret + CF Access bypass policy + Brevo config | active |
| [`runbooks/supabase-leaked-password-protection.md`](runbooks/supabase-leaked-password-protection.md) | Enable Supabase Auth HIBP leaked-password check (3-step dashboard toggle) | active |
| [`runbooks/supabase-account-advisor-sweep.md`](runbooks/supabase-account-advisor-sweep.md) | Quarterly account-wide advisor sweep: enumerate every Supabase project before checking any, triage table, 2026-07-29 baseline (production 1 finding vs superseded project 128), and the export-before-pause ordering | active |

## Archive (historical — kept verbatim)

| Doc | Purpose | Status |
|-----|---------|--------|
| [`archive/COMPLETED_PHASES.md`](archive/COMPLETED_PHASES.md) | Full implementation log of completed phases | historical |
| [`archive/PENDING_PHASES.md`](archive/PENDING_PHASES.md) | Post-review tracker (superseded by MAINTENANCE.md) | historical |
| [`archive/ToDoList.md`](archive/ToDoList.md) | Phase 4 hardening backlog (superseded by MAINTENANCE.md) | historical |
| [`archive/NEW_FILES_CREATED.md`](archive/NEW_FILES_CREATED.md) | Refactor-session file snapshot | historical |
| [`archive/REFACTORING_OVERVIEW.md`](archive/REFACTORING_OVERVIEW.md) | Refactoring project overview | historical |

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
| [`../GITHUB_RULES.md`](../GITHUB_RULES.md) | Git workflow rules |

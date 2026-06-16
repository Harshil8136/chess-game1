{% raw %}
---
title: "Documentation Index & Map"
status: active
audience: [non-technical, ai, technical]
last_verified: 2026-06-06
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
- **Security posture** → [`security/SECURITY.md`](security/SECURITY.md)
- **Infrastructure & deploy** → [`operations/OPERATIONS.md`](operations/OPERATIONS.md)
- **Open maintenance items** → [`MAINTENANCE.md`](MAINTENANCE.md)

## Status legend

`active` = current & maintained · `historical` = point-in-time snapshot (kept for
record) · `draft` = in progress · `deprecated` = superseded, pending removal.

## Business / Strategy
| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`2026-06-16-business-viability-and-compliance-assessment.md`](2026-06-16-business-viability-and-compliance-assessment.md) | Viability of selling the platform, multi-jurisdiction compliance posture ("how many countries"), AI-replicability/moat, sell as-is vs. upgrade, tiered model + sales appendix | non-technical, owner, operator, technical, ai | historical |

## Architecture
| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | Lean Edge stack, request lifecycle, module pattern, CPU budget | ai, technical | active |
| [`architecture/KV-RESILIENCE.md`](architecture/KV-RESILIENCE.md) | KV caching strategy, quotas, fail-safe fallback chain | ai, technical | active |
| [`architecture/plac-and-audit.md`](architecture/plac-and-audit.md) | RBAC + PLAC resolution + Ghost Audit Engine internals | ai, technical | active |

## Security
| Doc | Purpose | Audience | Status |
|-----|---------|----------|--------|
| [`security/SECURITY.md`](security/SECURITY.md) | Canonical current security posture (CSRF, headers, sessions, RLS, force-kick) | ai, technical | active |
| [`security/PRIVACY.md`](security/PRIVACY.md) | Privacy dashboard, consent records, GDPR/LFPDPPP | ai, technical, operator | active |
| [`security/login-forensics.md`](security/login-forensics.md) | Login forensics subsystem (schema, telemetry, alerts) | ai, technical | active |
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

## Specs (dated design records)
| Doc | Purpose | Status |
|-----|---------|--------|
| [`specs/2026-04-25-user-registry-design.md`](specs/2026-04-25-user-registry-design.md) | User registry "Midnight Command" redesign | historical |
| [`specs/2026-05-03-settings-design.md`](specs/2026-05-03-settings-design.md) | Settings dashboard design | historical |
| [`specs/2026-05-12-bookings-header-design.md`](specs/2026-05-12-bookings-header-design.md) | Bookings page header redesign | historical |
| [`specs/2026-05-13-cms-ui-redesign.md`](specs/2026-05-13-cms-ui-redesign.md) | CMS UI redesign | historical |

## Runbooks
| Doc | Purpose | Status |
|-----|---------|--------|
| [`runbooks/ssr-silent-blank-screen.md`](runbooks/ssr-silent-blank-screen.md) | Known issue: SSR silent blank screen diagnosis | active |
| [`runbooks/cron-scheduled-exception.md`](runbooks/cron-scheduled-exception.md) | Cron `*/5` scheduled-handler exception (CF Access audit poller): diagnosis + fix | active |

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
{% endraw %}

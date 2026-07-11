{% raw %}
---
title: 'Documentation Index & Map'
status: active
audience: [non-technical, ai, technical]
last_verified: 2026-06-18
verified_against: [code]
owner: harshil
related_docs: [../RULES.md]
tags: [meta, index]
---

# cf-astro Documentation

> **TL;DR:** This is the map of all project documentation for the `cf-astro` edge application.

## Start here

- **Operating rules & policy** → root `RULES.md`
- **AI Start point** → root `main.md`

## Architecture & Systems

| Doc                                                                                                      | Purpose                                                                       | Audience      | Status |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------- | ------ |
| [`SYSTEM-ARCHITECTURE.md`](SYSTEM-ARCHITECTURE.md)                                                       | Lean Edge stack, request lifecycle, module pattern, CPU budget                | ai, technical | active |
| [`2026-06-18-system-review-and-iso5055-benchmark.md`](2026-06-18-system-review-and-iso5055-benchmark.md) | Multi-level system architecture, edge platform health, and ISO-5055 benchmark | ai, technical | active |
| [`SYNC-SYSTEM-REVIEW.md`](SYNC-SYSTEM-REVIEW.md)                                                         | Sync-system architecture review + durability roadmap                          | ai, technical | active |
| [`FRONTEND-AND-SEO.md`](FRONTEND-AND-SEO.md)                                                             | UI architecture, Glassmorphism, Astro configurations                          | ai, technical | active |

## Security & Compliance

| Doc                                                                                      | Purpose                                                                      | Audience                | Status     |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------- | ---------- |
| [`COMPLIANCE-SECURITY-AND-HISTORY.md`](COMPLIANCE-SECURITY-AND-HISTORY.md)               | Privacy dashboard, consent records, GDPR/LFPDPPP and legacy security history | ai, technical, operator | active     |
| [`19-SECURITY-COMPLIANCE-REVIEW-2026-05.md`](19-SECURITY-COMPLIANCE-REVIEW-2026-05.md)   | Security review + remediation, scored (A− 91/100)                            | technical, operator     | historical |
| [`20-SECURITY-REVIEW-REMEDIATION-2026-06.md`](20-SECURITY-REVIEW-REMEDIATION-2026-06.md) | Latest security fix pass                                                     | technical               | historical |

## Operations & Infrastructure

| Doc                                                                          | Purpose                                                    | Audience                | Status     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------- | ---------- |
| [`OPERATIONS.md`](OPERATIONS.md)                                             | Cloudflare Binding IDs, free-tier limits, and CLI commands | ai, technical, operator | active     |
| [`SEO-OPERATIONS.md`](SEO-OPERATIONS.md)                                     | Dashboard-level SEO/GEO runbook and IndexNow configs       | ai, operator            | active     |
| [`INCIDENT-2026-04-18-EMAIL-OUTAGE.md`](INCIDENT-2026-04-18-EMAIL-OUTAGE.md) | Outage post-mortem and resolution for async emails         | technical               | historical |

## Business / Strategy

| Doc                                                                                                                        | Purpose                                                                  | Audience             | Status     |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- | ---------- |
| [`21-PLATFORM-STATUS-SUMMARY-2026-06.md`](21-PLATFORM-STATUS-SUMMARY-2026-06.md)                                           | Executive status, ratings, scale & cost                                  | non-technical, owner | historical |
| [`22-BUSINESS-VIABILITY-AND-COMPLIANCE-ASSESSMENT-2026-06.md`](22-BUSINESS-VIABILITY-AND-COMPLIANCE-ASSESSMENT-2026-06.md) | Viability of selling the platform, multi-jurisdiction compliance posture | non-technical, owner | historical |

## Root-level entry docs

| Doc           | Purpose                                   |
| ------------- | ----------------------------------------- |
| `../RULES.md` | Operational Rules Bible + policy contract |
| `../main.md`  | AI entry pointer into `Documentation/`    |

{% endraw %}

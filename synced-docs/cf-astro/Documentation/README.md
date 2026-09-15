{% raw %}
---
title: 'Documentation Index & Map'
status: active
audience: [non-technical, ai, technical]
last_verified: 2026-09-14
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

| Doc                                                                                                                  | Purpose                                                                                                     | Audience                | Status     |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- |
| [`SYSTEM-ARCHITECTURE.md`](SYSTEM-ARCHITECTURE.md)                                                                   | Lean Edge stack, request lifecycle, module pattern, CPU budget                                              | ai, technical           | active     |
| [`adr/0001-fail-open-rate-limiting.md`](adr/0001-fail-open-rate-limiting.md)                                         | ADR-0001 — rate limiting fails open (AGENTS.md invariant #3)                                                | ai, technical           | active     |
| [`adr/0002-no-captcha-on-booking.md`](adr/0002-no-captcha-on-booking.md)                                             | ADR-0002 — no Turnstile/CAPTCHA on booking and contact (invariant #1)                                       | ai, technical           | active     |
| [`adr/0003-audit-first-dead-letter.md`](adr/0003-audit-first-dead-letter.md)                                         | ADR-0003 — audit-first D1 dead-letter for booking/consent attempts (invariant #2)                           | ai, technical           | active     |
| [`assessments/2026-08-codebase-assessment-and-progress.md`](assessments/2026-08-codebase-assessment-and-progress.md) | Comprehensive codebase assessment, invariants ledger, and progress tracking                                 | ai, technical, operator | active     |
| [`2026-06-18-system-review-and-iso5055-benchmark.md`](2026-06-18-system-review-and-iso5055-benchmark.md)             | Multi-level system architecture, edge platform health, and ISO-5055 benchmark                               | ai, technical           | active     |
| [`SYNC-SYSTEM-REVIEW.md`](SYNC-SYSTEM-REVIEW.md)                                                                     | Sync-system architecture review + durability roadmap                                                        | ai, technical           | active     |
| [`FRONTEND-AND-SEO.md`](FRONTEND-AND-SEO.md)                                                                         | UI architecture, Glassmorphism, Astro configurations                                                        | ai, technical           | active     |
| [`ARCHIVE-RULES-HISTORY.md`](ARCHIVE-RULES-HISTORY.md)                                                               | Frozen pre-2026-07-pruning snapshot of `RULES.md` — several statements now disproven, kept for history only | ai, technical           | historical |

## Security & Compliance

| Doc                                                                                      | Purpose                                                                                                                                   | Audience                | Status     |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- |
| [`COMPLIANCE-SECURITY-AND-HISTORY.md`](COMPLIANCE-SECURITY-AND-HISTORY.md)               | Privacy dashboard, consent records, GDPR/LFPDPPP and legacy security history                                                              | ai, technical, operator | active     |
| [`19-SECURITY-COMPLIANCE-REVIEW-2026-05.md`](19-SECURITY-COMPLIANCE-REVIEW-2026-05.md)   | Security review + remediation, scored (A− 91/100)                                                                                         | technical, operator     | historical |
| [`20-SECURITY-REVIEW-REMEDIATION-2026-06.md`](20-SECURITY-REVIEW-REMEDIATION-2026-06.md) | Latest security fix pass                                                                                                                  | technical               | historical |
| [`23-CODEBASE-REVIEW-AND-RATINGS-2026-07.md`](23-CODEBASE-REVIEW-AND-RATINGS-2026-07.md) | Full-repo deep codebase review, fix plan, and multi-benchmark ratings (as-found 5.5/10 → wave 2 8.3/10)                                   | technical, operator     | historical |
| [`CONSENT-ENGINEERING-RECORD-2026-08.md`](CONSENT-ENGINEERING-RECORD-2026-08.md)         | Full engineering record of the 2026-08-07 consent outage: what broke, why nobody was told, and the durable-write system built in response | ai, technical           | active     |
| [`CONSENT-RECORD-SYSTEM.md`](CONSENT-RECORD-SYSTEM.md)                                   | Operational runbook for the consent recording system — read when consent writes are on fire                                               | ai, technical, operator | active     |
| [`WHERE-THE-DATA-LIVES.md`](WHERE-THE-DATA-LIVES.md)                                     | Which store holds which consent/data record (Supabase vs D1) — read before declaring data is missing                                      | ai, technical, operator | active     |
| [`DB-HARDENING-APPLIED-VIA-SUPABASE-MCP.md`](DB-HARDENING-APPLIED-VIA-SUPABASE-MCP.md)   | Historical record of DB hardening (FKs, constraints, indexes) applied directly via Supabase MCP, outside the Drizzle migration chain      | technical               | historical |
| [`ARCO-DSR-RUNBOOK.md`](ARCO-DSR-RUNBOOK.md)                                             | Step-by-step runbook for handling ARCO/data-subject-request submissions within the LFPDPPP 20-business-day deadline                       | technical, operator     | active     |

## Operations & Infrastructure

| Doc                                                                                                              | Purpose                                                                                                                                                                                                        | Audience                | Status     |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- |
| [`OPERATIONS.md`](OPERATIONS.md)                                                                                 | Cloudflare resource inventory (D1, R2, KV, queues) and the wrangler commands that verify it — IDs are redacted there; `wrangler.toml` holds the live values                                                    | ai, technical, operator | active     |
| [`SEO-OPERATIONS.md`](SEO-OPERATIONS.md)                                                                         | Dashboard-level SEO/GEO runbook and IndexNow configs                                                                                                                                                           | ai, operator            | active     |
| [`2026-08-30-BLOG-RENDERING-AND-INDEXABILITY.md`](2026-08-30-BLOG-RENDERING-AND-INDEXABILITY.md)                 | Public blog rendering, indexability and security: the tag-page regression, missing CSP on SSR routes, the AIO block that never rendered, sitemap/feed correctness, and the production checks still outstanding | ai, technical, operator | active     |
| [`BACKLINKS-PLAYBOOK.md`](BACKLINKS-PLAYBOOK.md)                                                                 | Owner-facing off-page SEO playbook — backlink/citation targets, KPIs, and canonical NAP block                                                                                                                  | non-technical, operator | active     |
| [`INCIDENT-2026-04-18-EMAIL-OUTAGE.md`](INCIDENT-2026-04-18-EMAIL-OUTAGE.md)                                     | Outage post-mortem and resolution for async emails                                                                                                                                                             | technical               | historical |
| [`INCIDENT-2026-08-07-CONSENT-OUTAGE.md`](INCIDENT-2026-08-07-CONSENT-OUTAGE.md)                                 | Outage post-mortem: consent records silently discarded for ~7h45m due to an unapplied schema migration                                                                                                         | technical               | historical |
| [`INCIDENT-2026-09-02-BOOKING-REPLAY-AUTH.md`](INCIDENT-2026-09-02-BOOKING-REPLAY-AUTH.md)                       | Outage post-mortem: cf-admin's outbox-drain poke got HTTP 401 from `/api/booking/replay/` for three days — a secret-selection short-circuit, and the fix stuck behind a lockfile-broken CI                     | technical               | historical |
| [`TODO-BACKLOG.md`](TODO-BACKLOG.md)                                                                             | The 2026-05-29 ToDo list, moved from the root on 2026-09-15; open items are unverified leads                                                                                                                   | technical, operator     | historical |
| [`archive/2026-03-17-tailwind-build-crash-resolution.md`](archive/2026-03-17-tailwind-build-crash-resolution.md) | Plan from the Astro 5 + Tailwind v4 build crash (moved from `docs/plans/` 2026-09-15)                                                                                                                          | technical               | historical |
| [`archive/2026-04-12-async-email-logging-design.md`](archive/2026-04-12-async-email-logging-design.md)           | Original async email + audit-logging design (moved from `docs/superpowers/` 2026-09-15; the consumer now sends via Brevo, not Resend)                                                                          | technical               | historical |

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

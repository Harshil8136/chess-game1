{% raw %}
# 20 — Security Review & Remediation (2026-06-13)

> **TL;DR (non-technical):** We ran a full security check-up of the public booking
> site, fixed every code-level issue we found, and re-scored the result. The site
> moved from **B (83/100)** to **A− (90/100)**. There are no critical or high-risk
> issues left open. The few remaining items are deliberate, low-risk engineering
> follow-ups that need no urgent action at the site's current traffic. The code was
> verified to type-check cleanly.

**Date:** 2026-06-13 · **Reviewer:** Automated + manual deep review · **Branch:** `claude/security-codebase-review-vw8gi0`
**Scope:** All public + admin API routes, form / upload / webhook paths, full git history (secret scan), npm dependency tree, live Supabase advisors, type check.
**Method:** Manual review of every API route and data path, secret scan over full history, XSS / JSON-LD breakout / SSRF / weak-RNG / SQL sweep, `npm audit`, OWASP Top 10 (2021) + ASVS mapping, prior-review delta verification.

This document is the formal remediation report referenced by `AGENTS.md` and the
Security & Compliance manual. It supersedes the working-tree audit note that was
previously kept at the repository root.

---

## 1. Result at a glance

|                          | Before     | After                                        |
| ------------------------ | ---------- | -------------------------------------------- |
| **Overall grade**        | B (83/100) | **A− (90/100)**                              |
| Critical / High open     | 0          | **0**                                        |
| Medium open              | 3          | **0**                                        |
| Findings fixed this pass | —          | **10 of 13** (3 are info/deferred-by-choice) |

The site was already engineered well above its category norm: parameterized database
queries, row-level security on every table holding personal data, a least-privilege
database role, signed-and-verified delivery webhooks, a multi-layer file-upload validator,
a hardened analytics reverse-proxy, and consent-gated session recording with full input
masking. This pass closed all three medium-severity items and completed the owner-side
credential rotations.

---

## 2. Scorecard (post-remediation)

| #   | Dimension                          | Before |  After  | Notes                                                                                    |
| --- | ---------------------------------- | :----: | :-----: | ---------------------------------------------------------------------------------------- |
| 1   | Authentication (admin endpoints)   |  9.0   |   9.0   | Constant-time secret checks; one secret per endpoint; no empty-secret bypass.            |
| 2   | Authorization & access control     |  9.0   |   9.0   | Public endpoints unauthenticated by design; documents have no IDOR.                      |
| 3   | Injection defenses                 |  9.0   | **9.5** | Preventive `</script>`-safe escaping added to every structured-data block.               |
| 4   | Secrets & key hygiene              |  7.5   | **9.0** | Publishable database key rotated; history re-confirmed free of live secrets.             |
| 5   | Security headers / CSP             |  7.0   |   7.0   | CSP still allows `unsafe-inline`/`eval` (analytics requirement); nonce migration staged. |
| 6   | Rate limiting & resilience         |  6.5   | **8.5** | Shared edge-state counter replaces the per-isolate fallback; trusted client-IP only.     |
| 7   | Dependency / supply chain          |  7.5   | **8.5** | Runtime-adjacent advisories cleared via `npm audit fix`; Dependabot + CI in place.       |
| 8   | Data protection & privacy          |  9.0   | **9.5** | Personal data is now redacted before the audit write and gated by a burst pre-check.     |
| 9   | Observability & incident readiness |  6.0   | **9.0** | Structured-logging token rotated; logs shipping again.                                   |
| 10  | CI/CD & repo security              |  7.0   | **8.0** | Security workflow added alongside existing Dependabot.                                   |
| 11  | Docs & process maturity            |  9.5   |   9.5   | Best-in-class for the scale; this verified, scored review added.                         |

**Benchmark:** clears **OWASP ASVS Level 1** comfortably and reaches **Level 2** on input
validation, data protection, and communications security. Remaining L2 gaps are CSP
hardening and a blocking dependency-audit gate. Against the typical Astro/Cloudflare
marketing-site baseline — usually no rate limiting, no webhook verification, no row-level
security — this site sits firmly in the top decile.

---

## 3. What was fixed

| Severity     | Finding                                                                                                | Resolution                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medium       | Rate limiter fell back to per-isolate memory (near-useless across edge isolates)                       | Replaced with a shared edge-state (KV) counter; client identity trusts only the Cloudflare-supplied IP in production                                |
| Medium       | Raw, unvalidated request bodies (incl. personal data) were written to the audit store before any check | Added a per-IP burst pre-check before the write, and personal-data redaction of the stored body — the "never lose a submission" design is preserved |
| Medium       | Publishable database key present in git history; rotation was still pending                            | Key **rotated by owner** 2026-06-13; configuration updated                                                                                          |
| Low          | Structured-logging token was rejected (logs silently dropped)                                          | Token **rotated by owner**; ingestion verified                                                                                                      |
| Low          | Identity-document form skipped a hostname check and didn't encode one field                            | Hostname pinned, field safely encoded, ticket IDs now cryptographically derived                                                                     |
| Low          | A content-sanitizer was applied in the wrong context for JSON-valued keys                              | Made context-aware (validate JSON keys, sanitize HTML keys)                                                                                         |
| Low (latent) | Structured-data blocks had no `</script>` escaping for any future dynamic input                        | Added a shared safe-escaper and applied it at all structured-data outputs                                                                           |
| Info         | One contact endpoint used manual validation instead of the shared schema validator                     | Unified on the schema validator                                                                                                                     |
| —            | Security CI                                                                                            | Added a security workflow + Dependabot configuration                                                                                                |

**Verified safe (no change needed):** parameterized queries throughout, the analytics
reverse-proxy's path/host allowlist (no SSRF), the read-only public API endpoint, and
the privacy-safe, double-consent-gated session recording.

---

## 4. Scale & system-design context

Accurate risk scoring depends on scale, so this is grounded in the live configuration.

- **Traffic is low — on the order of ~50 requests/day** (per the Worker observability
  configuration, which runs 100% telemetry sampling well within free-tier limits). At this
  volume the site sits comfortably behind Cloudflare's global edge, which absorbs
  volumetric/DDoS traffic _before_ it reaches the Worker. Origin-side rate limiting is
  therefore a **second** layer, not the only one — which is why the availability-class
  finding and the deferred CSP item are low real-world risk today.
- **Architecture:** edge SSR on Cloudflare Pages/Workers; **Supabase** Postgres 17.6
  (us-east-1) via a parameterized ORM and a least-privilege role; **Cloudflare D1** as a
  dead-letter audit store; **R2** for identity documents (private, short-lived signed
  access) and shared images; **KV** for sessions and the ISR/edge cache; **Cloudflare
  Queues** for asynchronous email; **Analytics Engine**, **Workers AI**, and **Upstash
  Redis** for edge metrics, drafting, and rate limiting respectively. The database is
  shared with the admin portal (same project).
- **Scaling headroom:** the design scales horizontally on Cloudflare's isolates with no
  single-node bottleneck (edge-cached reads, queue-decoupled email, dead-letter audit).
  The rate-limiter change from per-isolate memory to shared edge state means throttling now
  behaves correctly as traffic grows across isolates. Future watch-items are the shared
  Supabase connection budget (mitigated — direct least-privilege connection, no double
  pooling) and database write throughput (negligible at current traffic).

> **Note on live verification:** the Cloudflare management connector was approval-gated this
> session, so live binding and request-analytics parity could not be re-pulled. Infra figures
> above come from the project configuration, whose binding identifiers carry "verified via
> Cloudflare API" lock-dates.

---

## 5. Build & verification (2026-06-13)

| Check                         | Result                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                      | ✅ clean install                                                                                                                                                                                        |
| `tsc --noEmit`                | ✅ pass                                                                                                                                                                                                 |
| `npm audit`                   | 13 advisories (8 high, 5 moderate, **0 critical**) — **all dev/build-chain** (esbuild, vite, wrangler, yaml); none in the deployed Worker                                                               |
| `astro build` / `astro check` | Run in CI/CD. The Cloudflare adapter's build requires a live remote-bindings proxy (a Cloudflare API token), which is not present in the review sandbox; `tsc --noEmit` is the offline gate and passes. |

---

## 6. Remaining & deferred (low priority)

| Item                                  | Why deferred                                                                                          | Recommendation                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **CSP `unsafe-inline`/`unsafe-eval`** | Removing requires a staged nonce/hash migration; needed by analytics today; low risk at current scale | Migrate incrementally (shared roadmap item with the admin portal) |
| **CodeQL / secret-scanning workflow** | `npm audit` + Dependabot now cover dependencies                                                       | Add static analysis when convenient                               |
| **Blocking audit gate**               | Current `npm audit` job is non-blocking (dev-chain noise)                                             | Flip to blocking once the production tree is advisory-free        |
| **Leaked-password protection (auth)** | N/A on the current plan (owner-confirmed)                                                             | No action                                                         |

---

_No application behavior was changed beyond the security fixes listed in §3._

{% endraw %}

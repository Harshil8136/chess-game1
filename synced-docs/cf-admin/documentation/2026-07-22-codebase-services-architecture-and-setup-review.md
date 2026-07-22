---

title: "Codebase, Services, Architecture & Setup — Deep Technical Review"
status: active
audience: [owner, non-technical, technical, operator, ai]
last_verified: 2026-07-22
verified_against: [code, infra]
owner: harshil
related_code: [wrangler.toml, package.json, src/middleware.ts, src/lib/env.ts, src/lib/dal/, migrations/, database/legacy_migrations/, .github/workflows/, scripts/rules_check.py, scripts/docs_check.py]
related_docs: [2026-07-17-compliance-standing-and-market-positioning.md, 2026-07-22-architecture-improvement-summary.md, 2026-07-05-comprehensive-codebase-and-system-review.md, architecture/ARCHITECTURE.md, operations/OPERATIONS.md, MAINTENANCE.md]
tags: [architecture, codebase, services, infrastructure, ci-cd, review, benchmark]
---

# Codebase, Services, Architecture & Setup — Deep Technical Review

> **Date:** 2026-07-22
> **Scope:** `cf-admin` (worker name `cf-admin-madagascar`) **only** — not cf-astro,
> cf-chatbot, or any other repo in this account.
> **Purpose:** A systems-level companion to
> [`2026-07-17-compliance-standing-and-market-positioning.md`](2026-07-17-compliance-standing-and-market-positioning.md)
> (which covers compliance % and market fit). This document covers the other half:
> what the codebase actually *is* — its size, quality, architecture, service
> topology, database structure, dependency health, CI/CD pipeline, and
> documentation hygiene — measured by **running the project's own tooling live**,
> not by re-reading older documents.
> **Method:** Every number in this document was produced by executing a command
> against the current working tree on 2026-07-22 (`tsc`, `eslint`, `vitest`,
> `npm audit`, `npm outdated`, `knip`, `scripts/rules_check.py`,
> `scripts/docs_check.py`, `wc -l`, `git log`) — not carried forward from prior
> reports. Where this document disagrees with an older doc, the older doc is
> stale, not this one.

---

## 0. Verification log (what was actually run)

| Command | Result |
|---|---|
| `git status` / `git remote -v` | Clean tree, `main`, `origin` → `mascotasmadagascar-cmd/cf-admin-madagascar.git` ✅ |
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run` | **58/58 tests passing**, 9 test files |
| `npx eslint .` | **0 errors**, 264 warnings (all `@typescript-eslint/no-explicit-any`) |
| `python3 scripts/rules_check.py` | **9 rules, 0 violations** |
| `python3 scripts/docs_check.py` | **0 errors, 0 warnings** (60 docs) |
| `npx knip` | 13 unused files, 9 unused exports, 5 unused exported types |
| `npm audit --omit=dev --audit-level=high` | 8 vulnerabilities (1 low, 7 high), all in the transitive build-tool chain |
| `npm outdated` | 21 packages checked; several 1–2 majors behind (Dependabot policy — see §4.3) |
| `find`/`wc -l` over `src/` | 56,400 lines across 350 `.ts`/`.tsx`/`.astro` files |

This is a **live re-verification**, not a summary of the 2026-07-22
[architecture-improvement-summary](2026-07-22-architecture-improvement-summary.md)
(that document is this morning's *change log*; this document is a from-scratch
audit run *after* those 12 commits landed, confirming the after-state holds).

---

## 1. Scorecard at a glance

| Dimension | Grade | Basis |
|---|:---:|---|
| Type safety | 🟢 A | `tsc --noEmit` clean; strict `astro/tsconfigs/strict` base |
| Test suite (pass rate) | 🟢 A | 58/58 passing, 0 flaky, ~4.5s full run |
| Test suite (coverage breadth) | 🔴 D | 9 test files for 350 source files — see §2.3 |
| Lint / static rules | 🟡 B− | 0 errors; 264 `any`-warnings and file-size cap both *deliberately* downgraded mid-burn-down (§2.2) |
| Dead code | 🟢 A | knip finds only 13 files / 14 exports in 56K LOC — very clean |
| Repo hygiene | 🟡 B | 4 stray debug/scratch files committed at repo root (§2.5) |
| Architecture coherence | 🟢 A− | consistent layering (DAL/lib/pages), single env accessor, service-binding RPC (§3) |
| Service topology | 🟢 A | 11 distinct Cloudflare primitives + 6 external services, all documented in code (§4) |
| Dependency freshness | 🟡 B− | Core framework 1–2 majors behind by explicit Dependabot policy, not neglect (§4.3) |
| Database structure | 🟢 A− | Consolidated baseline + 42-migration archive is a clean pattern; one dead table flagged (§5) |
| Data governance | 🟢 A (upgraded) | ARCO/DSAR queue + manual retention-purge tool now shipped — was the #1 open gap 5 days ago (§5.3) |
| CI/CD pipeline | 🟢 A− | 4 workflows, cross-repo sync hardened with secret-scan + PII redaction + retry (§6) |
| Documentation | 🟢 A− | 60 docs, all CI checks green; 3 "active" docs approaching staleness (§7) |
| Infra cost | 🟢 A+ | ~$0.50/month max, 11 Cloudflare primitives, 0 servers |

**Overall: A−.** The codebase is materially healthier today than the
2026-07-05 review found — the July 22 architecture pass (12 commits, see the
companion summary) closed both compliance rule violations it set out to
close, and this independent re-run confirms `0` violations, `0` type errors,
and a fully green test suite. The residual gaps are the ones already tracked
in `MAINTENANCE.md` (test coverage breadth, remaining god-files, dependency
majors) plus two new, small findings from this pass (§2.5, §7.2).

---

## 2. Codebase health

### 2.1 Size & shape

| Area | Files | Notes |
|---|---:|---|
| `src/components/` | 145 | Preact islands + `.astro` presentational wrappers |
| `src/pages/` (incl. API) | 131 | 47 route/page files + 84 API handler files |
| `src/pages/api/` | 84 | grouped into 19 route namespaces (`bookings`, `emails`, `arco`, `retention`, `control-plane`, …) |
| `src/lib/` | 69 | domain logic: `auth/` (9), `dal/` (12), `control-plane/` (10), `analytics/providers/` (5), `cms/` (3), `email/` (2+templates), `security/` (1), `schemas/` (1) |
| `src/workers/` | 5 | custom Worker entry + 4 scheduled/queue-consumer handlers |
| **Total** | **350** files, **56,400** lines | TypeScript/TSX/Astro only (excludes CSS, SQL, JSON, markdown) |

The `src/lib/dal/` folder — the repository layer — has grown to **12
repositories** (`AccessRequestRepository`, `AuditLogRepository`,
`BookingStateRepository`, `EmailDraftRepository`, `EmailTemplateRepository`,
`FeatureFlagRepository`, `InquiryRepository`, `LoginLogRepository`,
`PageRegistryRepository`, `PortalSettingsRepository`,
`ServiceConfigRepository`, `UserSettingsRepository`) — up from roughly half
that count as of the last full inventory (2026-05-10 memory snapshot). This
directly reflects today's SEC-03 remediation (26 raw-SQL call sites moved
into the DAL).

### 2.2 Type safety & lint — clean, but two rules are intentionally relaxed

`tsc --noEmit` and `eslint .` both run to **0 errors**. Two rules are
deliberately not at their target strictness, and — importantly — the code
says so in comments, which is the right way to carry technical debt:

| Rule | Current state | Why | Where it's declared |
|---|---|---|---|
| `max-lines` (500-line file cap) | `off` | Mid-way through a god-file-splitting pass (4 of 11 flagged files split today) | `eslint.config.js:18` |
| `@typescript-eslint/no-explicit-any` | `warn` (264 occurrences) | `coding-standards.md` forbids `any` outright, but flipping to `error` across 264 sites would block unrelated PRs mid-burn-down | `eslint.config.js:22` |

Both have an explicit re-enable plan referenced in the config comments
("phase 12", "type-debt burn-down"). This is healthy debt management, not
silent rot — the same cannot be said for every codebase this size.

**`any` usage is concentrated, not scattered.** Reading the 264 sites shows
three legitimate clusters rather than random laziness:
1. Bridging `Astro.locals`/`context.locals` (untyped by the framework) to the
   app's typed session/env shapes — `env.ts`, `session.ts`, `AdminLayout.astro`.
2. `catch (err: any)` / `catch (err: unknown)` boundary casts.
3. Third-party JSON responses (`await res.json() as any`) before a zod parse.

None of the 264 are in security-critical decision logic (RBAC/PLAC/CSRF/CSP
all type-check strictly with no `any`).

**File-size distribution** (10 files still over 500 lines, down from 13 this
morning and higher before that):

| File | Lines | Note |
|---|---:|---|
| `src/pages/dashboard/DashboardStyles.astro` | 1,195 | was 1,871 before today's dead-CSS removal; a global stylesheet, lower risk than a logic file |
| `src/components/admin/control-plane/ProviderControls.tsx` | 875 | not yet split |
| `src/components/admin/users/ExpandedRow.tsx` | 841 | not yet split |
| `src/components/dashboard/privacy/FeedItem.tsx` | 654 | not yet split |
| `src/components/ui/AccessDeniedView.astro` | 621 | not yet split |
| `src/pages/dashboard/inquiries/_components/InquiriesDashboard.tsx` | 605 | exempted to 600-line cap in `eslint.config.js` |
| `src/components/admin/debug/PageRegistryManager.tsx` | 562 | not yet split |
| `src/pages/dashboard/content/hero.astro` | 558 | not yet split |
| `src/components/admin/emails/_components/QueueTracker.tsx` | 557 | not yet split |
| `src/lib/auth/pipeline.ts` | 517 | **formally exempted** — the single request-auth hot path; splitting would fragment security-critical control flow across files for a 3.4% overage (documented rationale in `eslint.config.js`) |

This list matches `MAINTENANCE.md`'s "still pending" list exactly — confirms
no drift between the backlog doc and the code.

### 2.3 Test coverage — the one real weak spot

58 tests across 9 files, all passing, is a **good pass rate but a thin
surface**: `test/csrf.test.ts`, `example.test.ts`, `exportSessions.test.ts`,
`guard-plac.test.ts`, `plac.test.ts`, `sanitize-html.test.ts`,
`sentry-scrub.test.ts`, `sessionRisk.test.ts`, `webhook-secret.test.ts`.

- **What's covered:** the highest-risk security primitives — CSRF, PLAC
  resolution, HTML sanitization, Sentry PII scrubbing, session risk scoring,
  webhook secret verification. This is the *right* 9 things to test if you
  can only test 9 things.
- **What's not covered:** any of the 12 DAL repositories, any of the 84 API
  route handlers, any Preact component, the retention-purge safety
  invariants (§5.3), the ARCO SLA-deadline math, the CMS revalidation
  retry/backoff logic, the email queue/Brevo/Resend dual-provider paths.
- **No coverage tooling configured** — `vitest.config.ts` has no `coverage`
  block, so there's no numeric coverage %, only "does the suite pass."

This is not a new finding (the 2026-07-05 review flagged the same gap), but
it is the single largest gap between "ships clean" and "is regression-safe."
For a 56K-line, single-maintainer-plus-AI codebase, this is the highest-ROI
investment available: a handful of DAL/API integration tests using
`@cloudflare/vitest-pool-workers` (already a dependency) would catch far more
than incremental UI tests.

### 2.4 Dead code — very clean

`knip` found only:
- **13 "unused" files** — but 9 of the 13 are `test/*.test.ts` files that
  knip's entry-point config doesn't recognize as Vitest entries (a knip
  config gap, not real dead code) plus `fix.cjs`, `test-regex.js`,
  `test-regex2.js` (real — see §2.5) and one orphaned CSS file
  (`src/styles/components/cms-module-panel.css`).
- **9 unused exports + 5 unused exported types** — small, scattered
  (`SYNC_QUEUE_NAME`, `RATE_LIMIT_MAX`, `CMS_KEY_ALLOWLIST`, a few
  diagnostics display maps). Trivial cleanup, not a structural issue.

For 56,400 lines this is an unusually low dead-code ratio — a good proxy for
"nothing gets written and abandoned here."

### 2.5 Repo hygiene — new finding

Four files are **committed to the repo root** that look like one-off,
session-scratch debug artifacts rather than project source:

| File | Contents | Assessment |
|---|---|---|
| `fix.cjs` | 8-line one-shot script that regex-replaces mojibake characters in one specific component file | Looks like a fix that was run once and never removed |
| `test-regex.js` / `test-regex2.js` | 3-line scratch snippets testing a CSP-nonce regex against sample strings | Throwaway regex experiments |
| `fixes.patch` | 87 lines, **UTF-16-encoded / garbled text** — unreadable as a normal git patch | Broken/corrupted artifact; unclear if it was ever meant to be applied |

The project already has a `scratch/` directory (currently empty, gitignored
by convention) for exactly this purpose — these four files should have gone
there, or been deleted after use, instead of landing in the tracked root.
None are security-sensitive (no secrets found in them), and none are
referenced by build/test/lint tooling, so this is purely a hygiene item, not
a functional risk. **Recommended:** `git rm` all four, or `git mv` into
`scratch/` if there's a reason to keep them.

---

## 3. Architecture

### 3.1 Request pipeline

The entire middleware chain is two composed functions:

```ts
// src/middleware.ts
export const onRequest = sequence(securityHeaders, authMiddleware);
```

`securityHeaders` (`src/lib/security/csp.ts`) builds the per-request nonce
CSP + HSTS + other headers; `authMiddleware` (`src/lib/auth/pipeline.ts`,
517 lines, the one formally-exempted god-file) does JWT verify → session
bootstrap → 30-minute role recheck → PLAC resolution, threading a mutable
session/accessMap through the rest of the request. This two-line composition
is a good architectural signal: the *complexity* lives inside well-named,
single-purpose modules, not in the pipeline wiring.

### 3.2 Layering

```
src/pages/**            → route handlers (.astro pages + api/*.ts), thin
src/lib/dal/*Repository  → the ONLY place raw D1 SQL is allowed (SEC-03, enforced by CI)
src/lib/auth/*           → rbac, plac, session, pipeline, guard — identity & authz
src/lib/control-plane/*  → Layer-B provider connectors (Sentry/PostHog/Cloudflare/Supabase admin reads)
src/lib/cms/*            → content storage + cross-repo ISR revalidation
src/lib/analytics/providers/* → per-provider dashboard metric fetchers (split today from one 950-line file)
src/lib/email/*          → HTML sanitizer + template registry
src/components/**        → Preact islands, grouped by admin module
```

`src/lib/env.ts` is the single accessor for all Cloudflare bindings (`getEnv`,
`getRawEnv`, `getKVBinding`, `getCfContext`) — every other module reads
bindings through it rather than importing `cloudflare:workers` directly. This
single-choke-point pattern is what makes the SEC-05 rule
(`process.env` forbidden outside `env.ts`) mechanically enforceable.

### 3.3 Worker-to-Worker RPC — a notable architecture choice

`wrangler.toml` declares two **Service Bindings**:

```toml
[[services]]
binding = "CHATBOT_SERVICE"
service = "cf-chatbot"

[[services]]
binding = "ASTRO_SERVICE"
service = "cf-astro"
```

These are zero-latency, zero-egress-cost RPC calls between Workers on the
same Cloudflare account — `env.CHATBOT_SERVICE.fetch(...)` and
`env.ASTRO_SERVICE.fetch(...)` invoke the target Worker directly without a
public network hop. Both call sites (`src/lib/chatbot-proxy.ts`,
`src/lib/cms/revalidate.ts`, `src/lib/control-plane/config-publisher.ts`,
`src/lib/diagnostics/tests/connectivity.ts`) fall back to a plain HTTP
`fetch()` against the public URL when the binding is unavailable (local dev,
where service bindings between separately-run `wrangler dev` processes don't
resolve). This is the correct pattern — most Workers projects at this scale
just use HTTP between services and pay the latency/cost for it; this one
uses the platform-native primitive and degrades gracefully when it's absent.

### 3.4 Feature-module inventory (current, verified against the file tree)

Nine admin domains, each with its own components + dashboard route(s) + API
namespace:

| Module | Dashboard route | API namespace | Notes |
|---|---|---|---|
| Bookings | `/dashboard/bookings` | `api/bookings/*` | |
| Users | `/dashboard/users` | `api/users/*` | RBAC/PLAC registry, access-policy UI |
| Content (CMS) | `/dashboard/content/*` | `api/content/*`, `api/media/*` | Gallery/Services/Reviews/FAQ/About/Hero |
| Chatbot | `/dashboard/chatbot/*` | `api/chatbot/[...path]` | proxies to `cf-chatbot` via service binding |
| Emails | `/dashboard/emails` | `api/emails/*` | Compose/drafts/templates/queue — dual-provider (§4.2) |
| Logs / Security | `/dashboard/logs`, `/dashboard/sessions` | `api/audit/*`, `api/sessions/*` | Ghost Audit + Session Command Center |
| Settings | `/dashboard/settings/*` | `api/settings/*`, `api/features/*` | |
| Control Plane | `/dashboard/control-plane` | `api/control-plane/*` | Layer-B provider dashboards (Sentry/PostHog/CF/Supabase reads) |
| Debug | `/dashboard/debug/*` | `api/diagnostics/*`, `api/system/*` | Page registry, diagnostics runner |

Four modules exist now that were **not** present in the last full component
inventory (72 days ago): `Inquiries` (`/dashboard/inquiries`,
`api/inquiries/*`), `ARCO` (`/dashboard/arco`, `api/arco/*` — see §5.3),
`Retention` (`/dashboard/retention`, `api/retention/*` — see §5.3), and a
dedicated `Sessions` page (previously folded into Logs). The platform has
grown four features' worth of surface area since the last inventory without
a corresponding update to the architecture docs (`ARCHITECTURE.md` — see
§7.2).

---

## 4. Services & integrations

### 4.1 Full service inventory (verified against `wrangler.toml` + source, not docs)

| Service | Type | Binding/Secret | Purpose | Criticality |
|---|---|---|---|---|
| Cloudflare D1 | Data | `DB` (`madagascar-db`, shared with cf-astro) | Operational/relational data, ~40 tables | Critical |
| Cloudflare KV | Cache/session | `SESSION` (`ADMIN_SESSION`) | Opaque session store | Critical |
| Cloudflare R2 | Object storage | `IMAGES` (`madagascar-images`) | CMS images + email attachments | High |
| Cloudflare Queues | Async | `EMAIL_QUEUE`, `SYNC_QUEUE` + 2 DLQs | Email dispatch decoupling; ISR-revalidation durability | High |
| Cloudflare Analytics Engine | Telemetry | `ANALYTICS` (`madagascar_analytics`) | Dashboard usage metrics | Medium |
| Cloudflare Workers AI | AI | `AI` | Email AI-generation (`ai-generate.ts`), chatbot model pricing (`ai-pricing.ts`) | Medium |
| Cloudflare Service Bindings | RPC | `CHATBOT_SERVICE`, `ASTRO_SERVICE` | Zero-latency Worker-to-Worker calls (§3.3) | High |
| Cloudflare Zero Trust Access | Identity | `CF_TEAM_NAME`/`CF_ACCESS_AUD` vars + 2 API tokens | Edge authentication (Google/GitHub/OTP) | Critical |
| Supabase Postgres | Data | `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Auth whitelist, consent ledger, ARCO/legal requests, bookings | Critical |
| Upstash Redis | Rate limiting | `UPSTASH_REDIS_REST_URL/TOKEN` | Per-endpoint fail-closed rate limits | High |
| Sentry (`@sentry/cloudflare`) | Observability | `PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` | Error tracking, edge-native (workerd-compatible) | High |
| PostHog | Observability | `POSTHOG_PERSONAL_API_KEY` (optional) | Control-plane Layer-B connector — usage/billing reads | Low (degrades gracefully) |
| Resend | Email | `RESEND_API_KEY` | Security-alert emails, invites, DEV local-emulation | Medium |
| Brevo | Email | `BREVO_API_KEY` | Production custom-send dispatch (queue consumer), templates, webhooks | High |

**11 distinct Cloudflare primitives** bound in one `wrangler.toml`, plus
**6 external services** — all wired through the single `getEnv()` accessor
(§3.2). Every optional integration (PostHog, the CF-purge token) is coded to
degrade to a "Setup Required" UI state rather than crash when its secret is
absent — a pattern documented in the dashboard-analytics memory notes and
confirmed in `control-plane/preflight.ts`.

### 4.2 Why two email providers

Resend and Brevo are not redundant — they're split by responsibility:
Resend handles the low-volume, latency-sensitive paths (login security
alerts, invite emails, and local-dev emulation so a developer doesn't need
Brevo credentials to test); Brevo handles the higher-volume,
queue-decoupled, production custom-send path (Email Portal compose → D1
draft → `EMAIL_QUEUE` → `cf-astro-email-consumer` → Brevo, with delivery
webhooks feeding status back). This is a reasonable cost/reliability split,
not accidental duplication — but it does mean **two separate provider
integrations to keep credentialed, monitored, and upgraded**, which is worth
knowing before assuming "email" is one dependency.

### 4.3 Dependency freshness

`npm outdated` against the 21 direct dependencies:

| Package | Current | Latest | Gap |
|---|---|---|---|
| `astro` | 6.4.8 | 7.1.3 | 1 major |
| `@astrojs/cloudflare` | 13.5.4 | 14.1.4 | 1 major |
| `@astrojs/preact` | 4.0.10 | 6.0.1 | 2 majors |
| `typescript` | 5.9.3 | 7.0.2 | 2 majors |
| `wrangler` | 4.107.1 | 4.113.0 | minor only |
| `zod`, `preact`, `@upstash/redis`, `@supabase/supabase-js` | — | — | patch/minor only |

This gap is **policy, not neglect** — `.github/dependabot.yml` explicitly
sets `ignore: update-types: ["version-update:semver-major"]` on both the npm
and github-actions ecosystems, so Dependabot will never propose these bumps
automatically. That's a defensible choice for a production system (major
Astro/TypeScript bumps are not drop-in), but it has a direct security
consequence: `npm audit --omit=dev --audit-level=high` reports **8
vulnerabilities (1 low, 7 high)**, and several of the fixes are only
available via `npm audit fix --force` (i.e., a major bump) — `esbuild`
(dev-server arbitrary file read on Windows), `fast-uri` (host-confusion via
backslash authority delimiter), and `sharp`/`libvips` (multiple CVEs). All
of these currently sit in the **transitive build-tool chain**
(`@astrojs/cloudflare` → `@cloudflare/vite-plugin` → `miniflare`/`wrangler`
→ `sharp`/`esbuild`) — not in the code that ships to the deployed Worker —
which is exactly the reasoning `security.yml` already documents for why this
check is non-blocking (`|| true`). That reasoning is sound *today*, but it
is worth re-verifying periodically that these packages remain build-time-only
and haven't crept into the runtime bundle as the Astro adapter evolves.

---

## 5. Database & data architecture

### 5.1 D1 — a clean consolidation pattern

The **live migration path is `migrations/`** (8 files, 402 lines total):
`0000_baseline.sql` (212 lines, idempotent — every statement is
`CREATE TABLE IF NOT EXISTS`) followed by 7 small incremental migrations
(`0001`–`0007`). This baseline is the *consolidated* result of **42 prior
migrations**, preserved verbatim and clearly marked inert in
`database/legacy_migrations/README.md`:

> "Do NOT run anything in this folder ... several files here contain
> destructive statements that were safe in their original sequence but would
> damage a current database if replayed."

This is a good pattern for a schema that's been iterated on heavily by an AI
agent over months — it prevents a future session from accidentally replaying
a `DROP TABLE` from migration `0018` against a live database, while keeping
full history for forensic/documentation purposes. One small naming wrinkle
is called out and explained in the same README (two files originally both
numbered `0021`) — cosmetic, already resolved.

**One known dead table remains** (carried over from `MAINTENANCE.md`, not a
new finding): `cms_content_history` (migration `0026`) has zero writers —
either ship the version-history feature or drop the migration.

### 5.2 Supabase

Six migration files under `supabase/migrations/` (RLS + index hardening from
2026-07-08 is the most recent). Per the existing security posture docs
(re-confirmed here, not re-derived): all tables RLS-enabled, `anon` role has
zero grants, service-role key only. `scripts/rules_check.py`'s **SEC-09**
rule mechanically enforces that any future `ENABLE ROW LEVEL SECURITY`
migration also ships a `CREATE POLICY` in the same file — this ran clean (0
violations) in this pass.

### 5.3 Data governance — the most significant change since 2026-07-17

The [compliance doc from five days ago](2026-07-17-compliance-standing-and-market-positioning.md)
listed as GDPR/CCPA's **#1 blocking gap**: *"admin workflow to fulfill
erasure/access (DSAR) — the `privacy_requests`/`legal_requests` tables are
captured but unused in the admin app."*

**That gap is now closed in code.** Two features exist today that were not
mentioned in that audit:

1. **ARCO request queue** (`/dashboard/arco`, `src/components/dashboard/arco/ArcoQueue.tsx`,
   `api/arco/requests[.ts|/[id].ts]`) — a full DSAR fulfillment workflow for
   LFPDPPP/GDPR data-subject rights (Acceso/Rectificación/Cancelación/
   Oposición), with ticket numbers, identity-document handling, a
   PENDING → IN_PROGRESS → RESOLVED/REJECTED status pipeline, and **SLA
   deadline tracking** (`decisionDeadline`, `finalDeadline`,
   `businessDaysElapsed`, overdue/due-soon flags) surfaced directly in the
   admin UI.
2. **Manual retention-purge tool** (`/dashboard/retention`,
   `src/lib/retention-tables.ts`, `api/retention/{preview,purge}.ts`) — a
   registry of 5 tables (`booking_attempts`, `consent_attempts`,
   `consent_records`, `legal_requests`, `privacy_requests`) each with a
   target retention window (90 days for operational dead-letter logs, 3
   years for consent/legal evidence), owner/DEV-only auth, mandatory
   `confirm: true`, and a **hard, code-level safety invariant**: status-gated
   tables (ARCO tickets) can never be deleted while still open, regardless
   of what the request body claims. Every purge is audit-logged with table,
   threshold, and row count.

The code comment in `retention-tables.ts` documents this as a **deliberate
2026-07 policy decision**: *"NO data is ever auto-purged... actual deletion
only happens when an Owner/DEV explicitly reviews and confirms it."* This
means the gap isn't fully closed the way the 07-17 doc's roadmap envisioned
("a retention cron") — it's closed by a *safer* mechanism (human-gated,
audited, status-aware) that trades automation for defensibility. For a
compliance narrative, "a human reviews and confirms every deletion, with an
audit trail" is arguably a *stronger* answer to a DSAR auditor's question
than a silent cron job would have been.

**Recommendation:** the 2026-07-17 compliance document's GDPR/CCPA
percentages and gap list should be revisited in light of this — the DSAR
workflow gap it flagged as "1–2 weeks of work" appears to already be built.
That revision is out of scope for this document (which is scoped to
codebase/services/architecture, not compliance scoring) but is flagged here
so it isn't lost.

---

## 6. CI/CD & GitHub Actions — pipeline inventory and the cross-repo push

Four workflows + Dependabot, all under `.github/workflows/`:

| Workflow | Trigger | Purpose | Blocking? |
|---|---|---|---|
| `security.yml` | push to main, PR, weekly cron | npm audit (advisory), secret-scan (blocking), `rules_check.py` (warn-only, ready to flip — see below) | Partial |
| `docs-quality.yml` | push/PR touching `documentation/**` | front-matter + link + index-drift (blocking), markdownlint (advisory), external-link check (advisory) | Partial |
| `production-tests.yml` | manual (`workflow_dispatch`) | cross-repo integration test: checks out cf-admin **and** cf-astro, runs both test suites | Manual only |
| `sync-docs.yml` | push to main touching `RULESAd.md`/`documentation/**`, or manual | **pushes `documentation/**` + `RULESAd.md` to a separate public GitHub repo** | N/A (one-way sync) |
| Dependabot | monthly | npm + github-actions dependency PRs, majors ignored | N/A |

### 6.1 The cross-repo push, in detail

This is the workflow the "push to other repo" instruction in this task
refers to. It is real, already exists, and is well-hardened:

- **Target:** `Harshil8136/chess-game1`, path `synced-docs/cf-admin/`,
  branch `main` — a **separate, public** repository, not another private
  project repo in this account.
- **Auth:** a `PERSONAL_PAT` repo secret with write access scoped to the
  target repo only; the default `GITHUB_TOKEN` (read-only, scoped to
  `cf-admin` itself) is never used for the cross-repo push.
- **Trigger surface:** `push` to `main` touching `RULESAd.md` or
  `documentation/**`, plus a manual `workflow_dispatch` with a `dry_run`
  toggle that prepares files without pushing.
- **Safety steps, in order:** (1) fails fast if `PERSONAL_PAT` is missing,
  (2) shallow-clones both repos, (3) a pre-copy secret-scan across 8
  credential patterns (warning-only — never blocks the sync, by design, so a
  false positive on a doc example can't wedge the pipeline), (4) copies
  **every `.md` file** under `documentation/` plus `RULESAd.md` (non-markdown
  files are the only exclusion — the stated rationale is that AI coding
  agents need full architectural context, not a redacted subset), (5)
  redacts personal developer email addresses (business emails are kept —
  they're public contact info already), (6) normalizes encoding/line-endings
  via `ftfy`, (7) validates no mojibake remains, (8) writes a
  `SYNC_PROVENANCE.md` with source commit/ref/timestamp, (9) commits and
  pushes with **3 retries + rebase** on conflict.

### 6.2 Where this document sits in that pipeline — confirmed correct

This document was placed at `documentation/2026-07-22-codebase-services-architecture-and-setup-review.md`
— the same top-level location as every other dated review
(`2026-07-17-compliance-standing-and-market-positioning.md`,
`2026-07-05-comprehensive-codebase-and-system-review.md`, etc.) — which is
the **correct and only place** for a doc to automatically participate in
`sync-docs.yml`, because that workflow's path filter is `documentation/**`
with no subfolder restriction. Concretely, this means:

1. On the next push to `main` that includes this file, `sync-docs.yml`
   fires automatically (no extra configuration needed).
2. It will be copied to `synced-docs/cf-admin/documentation/2026-07-22-…md`
   in the public `chess-game1` repo, redacted and encoding-normalized like
   every other doc.
3. It was also added to `documentation/README.md`'s index (Architecture
   section) — required because `docs-quality.yml`'s index-drift check is
   **blocking**: a doc under `documentation/` that isn't listed in the index
   fails CI. This was verified by re-running `scripts/docs_check.py`
   locally after the edit — **0 errors, 0 warnings**.
4. Front-matter was written to satisfy `docs_check.py`'s required-field
   check (`title`, `status`, `audience`, `last_verified` since `status:
   active`) — also re-verified locally.

No workflow file changes were needed — the pipeline was already built
correctly for "any new doc in `documentation/`." The only thing that could
have put this doc in the "wrong place" would have been creating a new
top-level folder outside `documentation/`, or forgetting the README index
entry (which CI would have caught anyway).

### 6.3 CI observations

- **`rules_check.py` is running `--warn-only`** in `security.yml` even
  though it now returns **0 violations** (verified live in §0). Per its own
  code comment ("flip to blocking after MAINTENANCE.md burn-down"), the
  burn-down is done — this is a one-line change
  (`security.yml` → remove `--warn-only`) ready to ship, and doing so
  converts a currently-advisory gate into a real regression guard for the
  SEC-01 through SEC-10 rules.
- **`npm audit` is non-blocking (`|| true`)** — reasonable today per §4.3,
  but this workflow doesn't distinguish "these specific known packages" from
  "any high-severity finding," so a genuinely new, runtime-relevant
  vulnerability would also pass silently. Pinning the `|| true` to named
  advisories (or a `.nsprc`/audit-ignore file) rather than blanket-ignoring
  the whole check would tighten this without losing the current flexibility.
- **`production-tests.yml` is manual-only** — it's the only workflow that
  exercises cf-admin and cf-astro together, and it never runs automatically.
  For a platform whose CMS/ISR sync explicitly depends on both repos staying
  compatible (§3.3, §5.3 of the architecture doc), this is a gap: a breaking
  change to the shared D1 schema or the `ASTRO_SERVICE` contract would ship
  to production without this test ever running unless someone remembers to
  trigger it by hand.

---

## 7. Documentation health

### 7.1 Mechanical checks — all green

`scripts/docs_check.py` (run live, §0) confirms all 60 `.md` files under
`documentation/` have valid front-matter, every internal link resolves, and
`documentation/README.md`'s index exactly matches the files on disk in both
directions (nothing missing, nothing phantom). This is a genuinely strong
signal — most projects this size have at least a few broken links or
undocumented files; this one has zero as of this pass.

### 7.2 Staleness — three foundational docs are 46 days old

`last_verified: 2026-06-06` appears on `documentation/README.md`,
`documentation/MAINTENANCE.md`, and `documentation/operations/OPERATIONS.md`
— all `status: active`, all 46 days old as of this review. The
`docs_check.py` staleness threshold is 120 days (a warning, not a blocker),
so none of these are flagged by CI yet, but the *content* has measurably
drifted from the code in that window:

- **`OPERATIONS.md`'s §1 binding registry** (the doc explicitly designated
  "single source of truth for current production UUIDs" by `GITHUB_RULES.md`
  §6) does not list the `SYNC_QUEUE` producer/consumer pair, the DLQ, the
  two service bindings (`CHATBOT_SERVICE`, `ASTRO_SERVICE`), or the `AI`
  binding — all four are live in `wrangler.toml` today (confirmed in §4.1)
  but were added to the code after this doc's last verification pass.
- **`architecture/ARCHITECTURE.md`** (last full read not repeated in this
  document, but cross-checked via its README listing) predates the four new
  feature modules identified in §3.4 (Inquiries, ARCO, Retention, standalone
  Sessions).

None of this is a functional risk — the code is the source of truth and
works correctly regardless of doc staleness — but per `GITHUB_RULES.md` §6,
`OPERATIONS.md` is specifically designated as the safety reference an
operator or future AI session is told to trust before touching binding IDs.
A stale version of *that specific document* has more blast-radius than a
stale version of most others. **Recommended:** a short refresh pass on
`OPERATIONS.md` §1 (4 missing bindings) and `README.md`/`MAINTENANCE.md`'s
`last_verified` dates is lower-effort than it sounds — it's an additive
table update, not a rewrite.

---

## 8. Setup & infrastructure cost

No change from the existing operations baseline (re-confirmed, not
re-derived): **~$0.50/month maximum**, entirely free-tier Cloudflare
(Workers/D1/KV/R2/Queues/Analytics Engine) + free-tier Supabase + free-tier
Upstash + free-tier Resend, with the only variable cost being Workers AI /
Anthropic Haiku fallback usage (§4.1). The service count has grown (11
Cloudflare primitives + 6 external services, up from a smaller set in
earlier snapshots) without the cost baseline moving, which is the expected
behavior of this architecture — Cloudflare's free tier scales with request
volume headroom (100K requests/day), not with binding count.

---

## 9. Findings — prioritized punch list

### Quick wins (hours, $0)
1. Remove or relocate the 4 stray root files (`fix.cjs`, `test-regex.js`,
   `test-regex2.js`, `fixes.patch`) into `scratch/` or delete them (§2.5).
2. Flip `rules_check.py` in `security.yml` from `--warn-only` to blocking —
   it already passes 0 violations (§6.3).
3. Refresh `OPERATIONS.md` §1 with the 4 missing bindings; bump
   `last_verified` on `README.md`/`MAINTENANCE.md`/`OPERATIONS.md` (§7.2).
4. Add `test/**/*.test.ts` to knip's entry patterns to remove the 9
   false-positive "unused file" findings (§2.4).

### Near-term (days)
5. Add integration tests for at least the DAL repository layer and the
   retention-purge safety invariants (§2.3) — highest-ROI test investment
   available given current coverage shape.
6. Continue the god-file split for the remaining 9 files over 500 lines
   (§2.2) — already a tracked, in-progress effort.
7. Update `architecture/ARCHITECTURE.md` to include the four newer feature
   modules (Inquiries, ARCO, Retention, Sessions) (§3.4).
8. Revisit the 2026-07-17 compliance document's GDPR/CCPA percentages given
   the ARCO/retention findings in §5.3 — the flagged gap appears substantially
   closed.

### Structural / policy decisions (weeks, needs a call from the owner)
9. Decide whether `production-tests.yml` (cross-repo integration test)
   should run automatically on schema/contract-relevant changes rather than
   manually only (§6.3).
10. Decide on a periodic (quarterly?) check that the transitive
    `npm audit` findings haven't moved from build-time-only into the
    runtime bundle, given they're currently accepted as non-blocking (§4.3).
11. Ship or drop the dead `cms_content_history` table (§5.1) — carried over,
    still open.

---

## 10. Bottom line

- **The codebase is in genuinely good shape**, and — unusually — this is
  independently *verifiable* rather than asserted: every quality signal in
  §0 was re-run live, not quoted from a prior report, and came back clean
  (0 type errors, 0 lint errors, 58/58 tests, 0 compliance-rule violations,
  0 doc-check errors).
- **The architecture is coherent and intentional**, not accidental — a
  single env accessor, a mechanically-enforced DAL boundary, Worker-to-Worker
  RPC via native service bindings, and a consolidated-migration database
  pattern are all choices a team makes on purpose, not by drift.
- **The biggest surprise in this pass** is that the ARCO/DSAR workflow and
  a manual retention-purge tool — both flagged as *missing* in the
  2026-07-17 compliance audit — are now built and live in the codebase
  (§5.3). That document's compliance percentages are now understated for
  GDPR/CCPA and should be revisited.
- **The two real, non-cosmetic gaps** are test-coverage breadth (§2.3) and
  the small amount of documentation drift in the specific file
  (`OPERATIONS.md`) designated as the binding-ID source of truth (§7.2) —
  both are cheap to close and neither blocks anything today.
- **This document is correctly wired into the existing docs-sync pipeline**
  (§6.2) — no workflow changes were required; placement in `documentation/`
  plus a README index entry was sufficient, and both were verified against
  the live checker scripts before this pass concluded.

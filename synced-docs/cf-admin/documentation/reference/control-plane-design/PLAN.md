---
title: "Unified Service Control Plane — Design & Implementation Plan"
status: active
audience: [ai, technical]
last_verified: 2026-06-06
verified_against: [code]
owner: harshil
tags: []
---

# Unified Service Control Plane — Design & Implementation Plan

> **TL;DR (non-technical):** The detailed design document behind the Service Control Plane — provider API specifications and the phased implementation plan.

> **Status:** Proposed (design doc, pre-implementation) · **Revision:** v2 (verified)
> **Owner page:** `/dashboard/control-plane` (cf-admin) — RBAC + PLAC gated
> **Scope chosen:** Full writes (Layer A remote-config **and** Layer B provider-API), all services
> **Location note:** This file lives under `docs/` which is **NOT** auto-synced to the public
> docs repo (`Harshil8136/chess-game1`). The sync workflow only copies `RULESAd.md` +
> `documentation/**` on push to `main`. Keep control-plane internals out of `documentation/`.
>
> **v2 changes:** Every code reference, line number, helper name, and provider-API endpoint was
> fact-checked against the live repos and the providers' current docs/APIs (June 2026). The
> verified corrections — including **two architecture-blocking issues** — are consolidated in
> **§0.5 Review Addendum**, and the affected sections (§2, §7, §10, §11) are patched inline and
> marked `[v2]`. Read §0.5 first.

---

## 0.5 Review Addendum (v2) — verified corrections & additions

> Authoritative list of what changed after fact-checking v1. Where a body section conflicts with
> this addendum, **this addendum wins**. Ordered by severity.

### 🔴 Blocking architecture issues (resolve before Phase 3)

**A. cf-astro is `output: 'static'` → the "JSON island injected by the SSR layout" (§11.2) does NOT
work on the pages that matter.** Verified `cf-astro/astro.config.ts:22` → `output: 'static'` (static
by default; SSR only where `export const prerender = false`). Prerendered marketing pages are served
as static assets — **`src/middleware.ts` does not run on them and `Astro.locals` is baked at build
time** — yet `BaseLayout.astro` (used by those pages) is exactly where the client Sentry
(`initSentry`, line ~232) and PostHog (`loadAnalytics`, line ~212) scripts load. A per-request
server-injected JSON island would therefore be frozen at build time on static pages.
- **Fix:** add a tiny SSR endpoint **`GET /api/runtime-config`** in cf-astro (`prerender = false`)
  returning the client-safe config JSON (rates/toggles only, **never secrets**), reading shared D1
  `service_config` via the same 3-layer cache cf-astro already uses for feature flags (isolate 10s →
  CF Cache API 60s → D1). Client scripts `fetch('/api/runtime-config')` **before** `Sentry.init()` /
  `posthog.init()`; both already defer via `requestIdleCallback`, and on fetch failure fall back to
  baked-in hardcoded defaults (fail-safe invariant). Mirrors the existing `prerender=false` endpoints
  (`/api/ingest`, `/api/health` — 17 SSR routes already exist). Keep the JSON island only as an
  optional fast-path for genuinely-SSR pages.

**B. No shared KV namespace exists → "KV `config:global` read by BOTH apps" (§2/§7/§11.1) is
impossible as written.** Verified: cf-admin has only `SESSION` (`getKVBinding()` returns `SESSION`);
cf-astro has `SESSION` + `ISR_CACHE`. KV namespaces are per-binding and isolated. The only shared
substrate is **D1 `madagascar-db`** (already how `admin_feature_flags` propagates).
- **Fix:** D1 `service_config` is the single source of truth; **each app reads D1 and caches locally**
  (cf-astro via CF Cache API + isolate memory like `admin_feature_flags`; cf-admin via its `SESSION`
  KV under a `cfg:` key prefix, or in-isolate memory). The **cross-app cache-bust** ("Purge config
  cache") must (1) clear cf-admin's cache AND (2) tell cf-astro to clear its cache by reusing the
  **existing** `ASTRO_SERVICE` binding + `/api/revalidate` webhook (`REVALIDATION_SECRET`), the same
  path `revalidateAstro()` already uses for CMS — add a `kind:'config'` branch (or `/api/config/flush`).
  A single KV delete (as v1 implied) does NOT reach cf-astro. Add a monotonic `version`
  (`service_config_meta` row or `MAX(updated_at)`) so each app does one cheap indexed read per TTL to
  decide whether to re-pull. (Optional KV path: bind ONE new namespace with the **same id** in both
  `wrangler.toml` files; not recommended — D1+webhook needs no new infra.)

### 🟠 Provider-API corrections (verified live, June 2026)

**C. Sentry spike protection (§10.1.5) — wrong endpoint.** Org-level:
`POST /api/0/organizations/{org}/spike-protections/` body `{ "projects": ["$all"] }` to enable,
`DELETE` to disable. Scope `project:read|write|admin`. (Not a project-options PUT.)

**D. Sentry usage/quota (§10.1.1) — prefer stats_v2.**
`GET /api/0/organizations/{org}/stats_v2/?field=sum(quantity)&groupBy=outcome&category=error&statsPeriod=24h`.
Outcomes: `accepted, filtered, rate_limited, invalid, abuse, client_discard, cardinality_limited`.
Scope `org:read`. Keep per-project `/stats/` as fallback. **Token:** Layer B writes need
`project:write` — expand the read-only `SENTRY_AUTH_TOKEN` to `org:read + project:read + project:write`
or add a write-scoped token.

**E. PostHog (§10.2.1/§10.2.4) — wrong fields & scope.** Sample rate is **nested** and a **string**:
`PATCH /api/projects/{id}/` body `{ "session_recording_opt_in": true, "session_replay_config": { "sample_rate": "0.1", "minimum_duration_milliseconds": 0 } }`;
autocapture via top-level `autocapture_opt_out`. Billing/quota is **org-level**
`GET /api/organizations/{org}/billing/` (not project-level). PostHog is migrating settings to
**environments** — resolve id via `GET /api/projects/` (or `/api/environments/`) and prefer the
environments endpoint if present. API host `https://us.posthog.com` (app), not `us.i.posthog.com`.

**F. Supabase Management API (§10.4/§14) — wrong credential.** `api.supabase.com/v1/projects/{ref}/advisors`
and `/health` need a **Personal Access Token (`sbp_…`)** or OAuth, **not** the `service_role` key.
Either add secret `SUPABASE_ACCESS_TOKEN` (PAT), or derive advisors by running the lint queries over
the existing service-role Postgres connection. `service_role` stays correct for the project's own
privileged metrics / PostgREST / `/auth/v1/admin/*`.

**G. Cloudflare observability (§10.3.3) — correct, plus enhancement.** `head_sampling_rate` is
wrangler-config + redeploy only (✅ keep read-only). *Enhancement:* the GA Workers Observability
query API (`/accounts/{id}/workers/observability/*`) can enrich read-only CF logs/traces metrics
beyond the GraphQL Analytics already used. Traces and logs each have their own `head_sampling_rate`
(cf-astro sets both = 1).

### 🟡 Codebase-reference corrections

**H. `deriveSection` has 3 real copies (§5.4).** `[v2.1 — verified during Phase 0 impl]`
`src/lib/auth/plac.ts:88`, `src/components/admin/users/shared/AccessPolicyGrid.tsx:40`, and
`src/components/admin/users/AccessPolicyManager.tsx:26`. `PageChipGrid.tsx` is a 21-line stub that
only *references* `deriveSection` in a comment — it has no real copy (v2 over-counted it as a 4th).
All 3 real copies were updated with `… || path.startsWith('/dashboard/control-plane')) return 'MANAGEMENT';`.
**Robust future fix:** extract `deriveSection` into one shared exported helper imported by all three.

**I. Server Sentry async-vs-sync (§11.3):** `sentryPagesPlugin`'s options factory runs per request
and cannot cleanly `await` a KV/D1 read. **Pattern:** module-scoped cached config refreshed
out-of-band via `ctx.waitUntil` (short TTL); `tracesSampler` reads the cached value synchronously;
first request uses the hardcoded default. Same for cf-admin's server entry.

**J. ServiceConfigRepository naming (§5.8):** mirror the real `PortalSettingsRepository` API
(`getAllSettings`, `getSettingsByCategory`, `getSetting`, `getSettingsMap`, `updateSetting`;
proto-guard via `Reflect.set` at `PortalSettingsRepository.ts:110`). `getRecentHistory()` is a NEW
method reading `service_config_history`.

**K. Verified accurate — no change:** `guard.ts` (`requireAuth`/`AuthError`/`placDenyResponse`/`requirePageAccess`),
`api.ts` (`jsonOk`/`jsonError`/`withETag`/`jsonFresh`), `audit.ts` (`createAuditLogger`,
`AuditAction`/`AuditModule`, columns `user_id,user_email,user_role,action,module,target_id,target_type,details`),
`plac.ts` nav filters (skip `#`, skip >2 segments), `@/*` tsconfig alias, latest migration `0027`
(0028–0030 free), `admin_pages` pattern, CSRF-before-auth.

### 🟢 Additions

- **§17 Testing & rollout gates**, **§18 Config versioning / rollback / concurrency** (new sections).
- **Portability:** the `file:///e:/1/Madagascar Project/...` links in §5 are local Windows paths that
  resolve for no one else — treat as repo-relative (`migrations/0027_…sql`, `src/lib/auth/plac.ts`).

---

## 0. Purpose

Build a single, RBAC+PLAC-protected admin surface inside **cf-admin** that **manages and runs
both cf-admin and cf-astro** (and, where relevant, cf-chatbot) by:

1. Showing **accurate live metrics** for every external service in one place.
2. Letting authorized admins **tune runtime knobs** (Sentry sampling/trace/error rates, PostHog
   capture & session-recording, rate limits, feature flags, maintenance mode) **without a
   redeploy**.
3. Letting high-privilege admins **write provider-side settings** (Sentry dynamic sampling /
   inbound filters / client-key rate limits, PostHog project settings, Cloudflare cache &
   observability, Supabase advisories) through the providers' own APIs.

The single most important behavioural change: **Sentry sample/trace rates are hardcoded in source
today** in both apps. This plan converts them into runtime-resolved values so they become tunable.

---

## 1. Ground truth — current state (verified against code + live infra)

### 1.1 The two apps

| | cf-astro | cf-admin-madagascar |
|---|---|---|
| Role | Public marketing + booking site | Admin / control plane |
| Deploy | Cloudflare **Pages** → `madagascarhotelags.com` | Cloudflare **Worker** → `secure.madagascarhotelags.com` |
| Astro | `output: 'static'` + SSR API routes | `output: 'server'`, entry `src/workers/cf-entry.ts` |
| Auth | None (per-endpoint bearer secrets) | Cloudflare Zero Trust + 5-tier RBAC + PLAC + Ghost Audit |
| DB | Supabase Postgres **direct** (postgres.js + Drizzle), role `cf_astro_writer` | Supabase service-role REST (`@supabase/supabase-js`) |

**Shared (one CF account `320d1ebab5143958d2acd481ea465f52`):** D1 `madagascar-db`
(`7fca2a07-d7b4-449d-b446-408f9187d3ca`), R2 `madagascar-images`, Queue `madagascar-emails`,
Analytics Engine `madagascar_analytics`, Supabase project `zlvmrepvypucvbyfbpjj` (us-east-1),
Sentry org `pet-hotel-madagascar` (`o4510752043761664`).
**Isolated:** KV sessions (`SESSION` vs `ADMIN_SESSION`), Sentry projects (`cf-astro` vs `cf-admin`).
**Related external workers:** `cf-chatbot` (`charlar.madagascarhotelags.com`), `cf-astro-email-consumer`.

**Live-confirmed (MCP):** Sentry org `pet-hotel-madagascar` → projects `cf-admin`, `cf-astro`.
Supabase `zlvmrepvypucvbyfbpjj` tables incl. `admin_authorized_users` (6), `admin_sessions` (28),
`bookings`, `consent_records` (78), chatbot `conversations`/`messages`/`chat_analytics`,
`email_audit_logs`; `auth.users` = 6. D1 list: `madagascar-db`, `chatbot-kb`, `whatsapp-chatbot`.
KV: `ADMIN_SESSION`, `SESSION`, `ISR_CACHE`, `CHATBOT_CACHE`, `CHATBOT_KV`.
**Constraint:** the Cloudflare MCP/API token in this session is **read-scoped** — `workers_list`
and `r2_buckets_list` return `403 Authentication error` (D1/KV list worked). CF writes need a
properly scoped token (see §3.2, §7).

### 1.2 Where every sample/trace rate lives today (the target of this work)

| Knob | File | Current value | How set |
|---|---|---|---|
| cf-astro client traces | `src/scripts/sentry.ts` (`tracesSampler`) | `/booking`,`/api/contact`→0.5; other `/api/`→0.1; else 0.0 | hardcoded |
| cf-astro client error rate | `src/scripts/sentry.ts` | `sampleRate: 1.0` | hardcoded |
| cf-astro client replay | `src/scripts/sentry.ts` | disabled (no replay integration) | hardcoded |
| cf-astro server traces | `functions/_middleware.ts:6` | `tracesSampleRate: 0.1` | hardcoded |
| cf-admin client traces | `sentry.client.config.ts` | `tracesSampleRate: 0.1`, replay off | hardcoded |
| cf-admin server traces | `sentry.server.config.ts` | `tracesSampleRate: 0.1`, `enableLogs:true` | hardcoded |
| CF Worker observability | `wrangler.toml` (both) | cf-astro `head_sampling_rate=1`; cf-admin enabled | **deploy-time** |
| PostHog capture/replay | cf-astro `src/scripts/analytics-loader.ts` | key `phc_62mNJJsf…`, no session recording, default autocapture | hardcoded |
| Rate-limit tables | cf-astro `src/lib/rate-limit.ts`; cf-admin `src/lib/ratelimit.ts` | per-endpoint limits/windows | hardcoded |

Sentry stats are **already read** in cf-admin `src/lib/analytics/providers.ts::fetchSentry()`
using `SENTRY_AUTH_TOKEN` / `SENTRY_ORG_SLUG` / `SENTRY_PROJECT_SLUG`.

### 1.3 Existing foundation we build on (do NOT reinvent)

- **D1 `admin_feature_flags`** (`migrations/0017`) — cross-service; cf-astro reads it in
  `src/middleware.ts`, caches 3-layer (isolate 10s → CF Cache API 60s → D1), exposes
  `Astro.locals.features`.
- **D1 `admin_portal_settings`** (`0023`) — typed/categorized key-value, `PortalSettingsRepository`,
  UI at `/dashboard/settings`.
- **DAL pattern** (`src/lib/dal/*Repository.ts`): injected `D1Database`, fail-soft, prototype-
  pollution-guarded writes.
- **`fetchAllAnalytics()`** (`src/lib/analytics/providers.ts`) — aggregates 8 providers (CF
  Zone/Workers/R2/Queues GraphQL+REST, Supabase Prometheus + Auth, Sentry, Resend), KV-cached 5 min;
  surfaced at `/api/dashboard/metrics`, rendered by `ServiceStatusStrip.tsx`.
- **Service bindings** `ASTRO_SERVICE` + `CHATBOT_SERVICE`; helpers `revalidateAstro()`
  (`src/lib/cms.ts`) and `chatbotFetch()` (`src/lib/chatbot-proxy.ts`).
- **Diagnostics runner** (`src/lib/diagnostics/*`) probes D1/R2/KV/Supabase/cf-astro/Upstash/Analytics.
- **RBAC+PLAC+Ghost Audit** — see §4.

---

## 2. Architecture — two layers

The knobs split into two classes that must be managed differently:

```
cf-admin /dashboard/control-plane (RBAC + PLAC)
 ├── LAYER A: Remote Config (knobs WE own)
 │      D1 `service_config` → KV `config:global` (30–60s TTL) → read by BOTH apps
 │      at SDK init / request time. Tunable without redeploy.
 │      e.g. Sentry trace/error sample rates, PostHog capture/replay, rate limits, flags.
 │
 └── LAYER B: Provider Control (knobs the PROVIDER owns)
        Direct provider APIs called from cf-admin API routes (tokens = cf-admin secrets):
        Sentry API, PostHog API, Cloudflare API, Supabase (service-role / Mgmt), Upstash REST.
        e.g. Sentry dynamic sampling / inbound filters / key rate limits, PostHog project
        session-recording sampling, CF cache purge, Supabase advisors.

 Both layers → audit_log (Ghost Audit) + service_config_history (before/after).
```

**Why both:** Sentry SDK `tracesSampleRate` (Layer A) controls *how much our code sends*; Sentry's
org **dynamic sampling / quotas / spike protection** (Layer B) controls *what Sentry keeps and
bills*. A credible "manage Sentry sampling" panel needs both, and they live in different places.

**Propagation `[v2 — corrected, see §0.5-B]`:** D1 `service_config` is the single source of truth
(shared `madagascar-db`). **Each app reads D1 and caches locally** (no shared KV namespace exists).
Writing a Layer-A value updates D1 and bumps a `version` marker; both apps re-pull within one TTL
(≤60s). A **"Purge config cache"** action clears cf-admin's cache **and** calls cf-astro's existing
`/api/revalidate` webhook (via the `ASTRO_SERVICE` binding) to flush cf-astro's cache immediately.

**Fail-safe invariant:** config reads ALWAYS fall back to baked-in defaults. A bad/missing config
value can never crash Sentry init or break a site.

---

## 3. Per-service capability matrix

### 3.1 Sentry (projects: cf-astro, cf-admin; org pet-hotel-madagascar)
- **Read (metrics):** extend `fetchSentry()` → issues count, events/min, error rate, transactions,
  **quota/usage**, top issues, release health. Per project. (Sentry REST with `SENTRY_AUTH_TOKEN`.)
- **Write — Layer A (`service_config`):**
  `sentry.cf_astro.traces.{default,booking,api}`, `sentry.cf_astro.error_sample_rate`,
  `sentry.cf_admin.traces`, `sentry.cf_admin.error_sample_rate`,
  `sentry.*.replay.{session_rate,on_error_rate}`, `sentry.*.profiles_sample_rate`,
  `sentry.*.enabled`, `sentry.*.environment`, `sentry.*.send_pii`.
- **Write — Layer B (Sentry API):** per-project client-key rate limits, inbound data filters,
  dynamic-sampling target rate (org), spike-protection toggle, alert rules.
- **Constraint:** SDK error `sampleRate` is read only at `init`. Implement runtime error sampling
  via `beforeSend` (`Math.random() < rate ? event : null`). `tracesSampler` is natively dynamic.

### 3.2 Cloudflare
- **Read (metrics):** reuse CF GraphQL Analytics — requests, errors, CPU, cache-hit ratio,
  bandwidth, R2 ops/storage, Queue backlog, D1 rows read/written.
- **Write — Layer B (CF API):** cache purge (exists in cf-astro `/api/revalidate`), Zero Trust
  session revoke (exists, `CF_API_TOKEN_ZT_WRITE`), DNS/redirect/WAF reads.
- **Worker observability `head_sampling_rate`:** deploy-time, **no runtime API** → surface
  **read-only** with a "requires redeploy" badge + drift check. Do not fake live control.
- **Token:** provision scoped `CONTROL_PLANE_CF_TOKEN`
  (`Account: Workers Scripts:Edit`, `Cache Purge`, `R2:Read`, `Analytics:Read`,
  `Zone: Analytics:Read`) as a cf-admin secret for any CF writes/full reads.

### 3.3 PostHog (cf-astro)
- **Read (metrics):** PostHog Query/Insights API → pageviews, uniques, funnels, session counts,
  event volume vs quota.
- **Write — Layer A (`service_config`, injected into `analytics-loader.ts`):**
  `posthog.enabled`, `posthog.capture_pageview`, `posthog.session_recording.enabled`,
  `posthog.session_recording.sample_rate`, `posthog.autocapture`.
- **Write — Layer B (PostHog API):** project session-recording sampling, feature flags,
  autocapture toggle. New secret: `POSTHOG_PERSONAL_API_KEY`.

### 3.4 Supabase
- **Read:** Postgres Prometheus metrics (exists), Auth user counts, table row/size counts,
  **advisors** (security/perf), slow queries/logs.
- **Write:** operational only (surface advisories, run vetted maintenance). **Schema changes stay
  migration-only** — do NOT expose arbitrary SQL in the panel.

### 3.5 D1 / R2 / KV / Queues / Analytics Engine
- **Read:** D1 tables + row counts + size; R2 object counts/storage (needs token scope); KV key
  counts; Queue depth/throughput; Analytics Engine datasets. Most already in `fetchAllAnalytics` +
  `/api/diagnostics/infrastructure`.
- **Ops:** KV purge for `config:global` / `features:global` / `cms:*` (forces both apps to
  re-pull), Queue retry/peek, R2 orphan cleanup (cron exists).

### 3.6 Upstash / Resend / Chatbot
- **Upstash:** read `dbsize`/`ping` (exists); manage rate-limit tables via Layer A
  `ratelimit.<endpoint>.{limit,window}`.
- **Resend:** read send/delivery/bounce stats (exists); webhook health.
- **Chatbot:** reuse `chatbotFetch()` — model registry swap, KB status, health.

---

## 4. RBAC + PLAC integration (how the page is gated)

Confirmed mechanics (`src/lib/auth/{rbac,plac,guard}.ts`, `src/middleware.ts`,
`documentation/plac-and-audit.md`):

- Roles = fixed numeric hierarchy `dev(0) < owner(1) < super_admin(2) < admin(3) < staff(4)`.
- **The permission for a page == a row in D1 `admin_pages`** (`path`, `required_role`, `label`,
  `icon`, `sort_order`, `is_active`). Per-user overrides in `admin_page_overrides`.
- Middleware enforces page access automatically (deny-by-default for unknown paths); nav is
  auto-computed from `admin_pages`; `/api/*` is exempt from middleware PLAC → API routes
  self-enforce with `requireAuth` + `placDenyResponse`.
- Action-level gating uses `#`-suffixed pseudo-paths (e.g. `/dashboard/logs#export`).
- Mutations call `auditLog(...)` (Ghost Audit, append-only `admin_audit_log`).

**AuthZ model for the control plane:**
| Capability | Required role | PLAC pseudo-path |
|---|---|---|
| View control-plane + metrics | `super_admin` | page rows |
| Edit Layer-A sample/trace/error rates | `admin` | `/dashboard/control-plane#edit-sampling` |
| Purge config cache | `admin` | `/dashboard/control-plane#purge-config` |
| Write provider-side settings (Layer B) | `owner` | `/dashboard/control-plane#provider-write` |
DEV is always exempt (existing rule).

---

## 5. Data model, RBAC+PLAC onboarding, and D1 migrations

> **This section is the authoritative reference for adding the control-plane pages.**
> Every step mirrors patterns proven in existing pages (settings, sessions, chatbot).

### 5.1 D1 migrations (additive, after `0027`)

```sql
-- ═══════════════════════════════════════════════════════════════════════
-- 0028_service_config.sql — Layer A knobs, read by BOTH apps
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE service_config (
  key         TEXT PRIMARY KEY,        -- 'sentry.cf_astro.traces.booking'
  value       TEXT NOT NULL,           -- JSON-encoded scalar
  value_type  TEXT NOT NULL CHECK(value_type IN ('number','boolean','string','json')),
  service     TEXT NOT NULL,           -- 'sentry'|'posthog'|'cloudflare'|'ratelimit'|...
  app_scope   TEXT NOT NULL,           -- 'cf-astro'|'cf-admin'|'global'
  category    TEXT NOT NULL,           -- 'sampling'|'feature'|'limits'|'ops'
  min_value   REAL, max_value REAL,    -- bounds (e.g. 0..1 for rates)
  description TEXT,
  updated_by  TEXT, updated_at INTEGER DEFAULT (unixepoch()),
  is_active   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_service_config_service ON service_config(service);

-- ═══════════════════════════════════════════════════════════════════════
-- 0029_service_config_history.sql — before/after for every change
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE service_config_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL, old_value TEXT, new_value TEXT,
  changed_by TEXT, changed_by_email TEXT, reason TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- ═══════════════════════════════════════════════════════════════════════
-- 0030_seed_control_plane_pages.sql — RBAC+PLAC page registration
-- ═══════════════════════════════════════════════════════════════════════
-- See §5.2 for full details of each entry.
```

### 5.2 PLAC page registration (migration `0030`)

> **Pattern:** `INSERT OR IGNORE INTO admin_pages (path, label, icon, required_role, description, sort_order, is_active)`
> See existing references: [0027_seed_session_management_page.sql](file:///e:/1/Madagascar%20Project/cf-admin/migrations/0027_seed_session_management_page.sql), [0021_seed_settings_subfeatures.sql](file:///e:/1/Madagascar%20Project/cf-admin/migrations/0021_seed_settings_subfeatures.sql), [0003_seed_admin_pages.sql](file:///e:/1/Madagascar%20Project/cf-admin/migrations/0003_seed_admin_pages.sql)

**Sort order strategy:** Existing pages use 0–19 (core), 30–32 (settings subfeatures),
700–770 (chatbot). Control-plane uses the **800 range** (dedicated block, no collisions):

```sql
-- Migration: 0030_seed_control_plane_pages
-- Purpose: Register Service Control Plane and its sub-pages + PLAC sub-features.
-- Pattern: Matches 0027 (session pages) and 0021 (settings sub-features).

-- ═══ TOP-LEVEL PAGE (sidebar nav item) ═══
-- This appears in the sidebar under the MANAGEMENT section (see §5.4).
-- required_role: super_admin → accessible to super_admin + owner + dev
INSERT OR IGNORE INTO admin_pages (path, label, icon, required_role, description, sort_order, is_active)
VALUES (
  '/dashboard/control-plane',
  'Service Control',
  'sliders-horizontal',
  'super_admin',
  'Unified service & remote-config control plane for Sentry, PostHog, CF, and Supabase',
  800,
  1
);

-- ═══ SUB-PAGES (per-service detail views) ═══
-- These are child routes — NOT displayed in sidebar nav (depth > 2 segments).
-- They inherit access from the parent page via PLAC prefix matching.
-- But registering them enables independent PLAC overrides per user.
INSERT OR IGNORE INTO admin_pages (path, label, icon, required_role, description, sort_order, is_active)
VALUES
  ('/dashboard/control-plane/sentry',     'Sentry',     'bug',        'super_admin', 'Sentry sampling, traces, error quotas & inbound filters', 810, 1),
  ('/dashboard/control-plane/cloudflare', 'Cloudflare', 'cloud',      'super_admin', 'CF metrics, cache purge, KV, R2, observability', 820, 1),
  ('/dashboard/control-plane/posthog',    'PostHog',    'bar-chart',  'super_admin', 'Analytics, session recording, autocapture, quotas', 830, 1),
  ('/dashboard/control-plane/supabase',   'Supabase',   'database',   'super_admin', 'DB metrics, Prometheus, advisors', 840, 1);

-- ═══ PLAC SUB-FEATURES (fragment pseudo-paths) ═══
-- These use #hash notation — they DON'T create sidebar items (computeNavItems skips '#' paths).
-- Purpose: Enable granular per-user PLAC overrides for specific ACTIONS within the page.
-- Pattern: matches 0021 (settings#portal-config, settings#feature-flags, settings#modules).
--
-- Example: Grant an `admin` user access to edit sampling rates but NOT provider writes:
--   admin_page_overrides: user_id=X, page_path='/dashboard/control-plane#edit-sampling', granted=1
--
-- The page .astro file reads these via:
--   accessPages?.['/dashboard/control-plane#edit-sampling'] !== false
INSERT OR IGNORE INTO admin_pages (path, label, icon, required_role, description, sort_order, is_active)
VALUES
  ('/dashboard/control-plane#edit-sampling',  'Edit Sampling',      '',  'admin',       'Mutate Sentry/PostHog/rate-limit sample rates (Layer A)', 850, 1),
  ('/dashboard/control-plane#provider-write', 'Provider Write',     '',  'owner',       'Write to external provider APIs (Layer B: Sentry keys, PostHog settings, CF token)', 851, 1),
  ('/dashboard/control-plane#purge-config',   'Purge Config Cache', '',  'admin',       'Force-refresh config cache on both apps via KV delete', 852, 1);
```

**Why these `required_role` values:**
- Top-level + sub-pages: `super_admin` — matches settings/users pages pattern. Owner+DEV inherit.
- `#edit-sampling`: `admin` — lower barrier for sampling rate tweaks (safe, bounded 0..1).
- `#provider-write`: `owner` — highest for writes that hit external APIs (billing risk).
- `#purge-config`: `admin` — cache purge is safe but operational.

### 5.3 How PLAC enforcement works for the new page

> **Reference:** [plac.ts](file:///e:/1/Madagascar%20Project/cf-admin/src/lib/auth/plac.ts), [guard.ts](file:///e:/1/Madagascar%20Project/cf-admin/src/lib/auth/guard.ts)

**Middleware flow (already automatic — no middleware edits needed):**

```
Request: GET /dashboard/control-plane/sentry
  ↓
middleware.ts §7 → checkPageAccess(accessMap, '/dashboard/control-plane/sentry')
  ↓
Exact match in accessMap.pages? → YES if registered in admin_pages → use boolean
  OR prefix match: '/dashboard/control-plane' is parent → use parent's access
  ↓
If false → 403 redirect (HTML) or JSON error (script/fetch)
```

**Page-level RBAC+PLAC checks (in each .astro page):**

```ts
// Pattern from settings/index.astro (line 22–32)
const user = await requireAuth(Astro);                    // 401 if no session
const env = getEnv(Astro);
const canEdit = isSuperAdmin(user.role as Role);          // Base edit gate

// Granular sub-feature PLAC checks using # fragments:
const accessPages = (user as any).accessMap as Record<string, boolean> | undefined;
const canEditSampling   = canEdit && (accessPages?.['/dashboard/control-plane#edit-sampling'] !== false);
const canWriteProvider  = isOwnerOrDev(user.role as Role) && (accessPages?.['/dashboard/control-plane#provider-write'] !== false);
const canPurgeConfig    = canEdit && (accessPages?.['/dashboard/control-plane#purge-config'] !== false);
```

**API route PLAC checks:**

```ts
// Pattern from api/settings/portal.ts (line 17–21 for GET, 36–39 for POST)
import { requireAuth, AuthError, placDenyResponse } from '@/lib/auth/guard';
import { jsonOk, jsonError, withETag } from '@/lib/api';

export const GET: APIRoute = async (ctx) => {
  const user = await requireAuth(ctx);                    // Any authenticated user
  const denied = placDenyResponse(user, '/dashboard/control-plane');  // PLAC gate
  if (denied) return denied;
  // ... read data ...
  return withETag(ctx.request, { configs });               // ETag caching
};

export const POST: APIRoute = async (ctx) => {
  const user = await requireAuth(ctx, 'admin');           // Minimum role for writes
  const denied = placDenyResponse(user, '/dashboard/control-plane#edit-sampling');  // Fragment PLAC
  if (denied) return denied;
  // ... validate bounds → write → audit ...
  return jsonOk({ key, value });                          // No-cache mutation response
};
```

### 5.4 Sidebar section routing

> **Reference:** [plac.ts → deriveSection()](file:///e:/1/Madagascar%20Project/cf-admin/src/lib/auth/plac.ts#L88-L95), [Sidebar/config.ts](file:///e:/1/Madagascar%20Project/cf-admin/src/components/navigation/Sidebar/config.ts)

**Current `deriveSection` mapping (plac.ts line 88–95):**

```ts
function deriveSection(path: string, role: Role): string {
  if (path.startsWith('/dashboard/chatbot')) return 'CHATBOT';
  if (role === 'dev') return 'DEV';
  if (path.startsWith('/dashboard/settings') || path.startsWith('/dashboard/users')) return 'MANAGEMENT';
  if (path.startsWith('/dashboard/logs') || path.startsWith('/dashboard/analytics') || path.startsWith('/dashboard/reports')) return 'TOOLS';
  if (path.startsWith('/dashboard/content')) return 'CONTENT';
  return 'MAIN';
}
```

**Required change — add control-plane to MANAGEMENT section:**

```ts
// ADD before the existing settings/users line:
if (path.startsWith('/dashboard/control-plane')) return 'MANAGEMENT';
```

**Why MANAGEMENT:** Control-plane is an operational management tool alongside Settings and Users.
The sidebar config already has `MANAGEMENT: { label: 'Management', color: 'blue' }` in
[Sidebar/config.ts](file:///e:/1/Madagascar%20Project/cf-admin/src/components/navigation/Sidebar/config.ts#L21).

**Mirror deriveSection in 3 files `[v2.1 — verified: only 3 real copies]`** (each has its own copy):
1. `src/lib/auth/plac.ts` → `deriveSection()` (line 88)
2. `src/components/admin/users/shared/AccessPolicyGrid.tsx` → `deriveSection()` (line 40)
3. `src/components/admin/users/AccessPolicyManager.tsx` → `deriveSection()` (line 26)

> `PageChipGrid.tsx` is a stub that only references `deriveSection` in a comment — not a real copy.
> **Recommended robust fix:** extract `deriveSection` into ONE shared exported helper (e.g.
> `src/lib/auth/sections.ts`) and import it in all three sites, so this control-plane change — and
> every future one — is made once instead of three times.

**Only the top-level path appears in sidebar nav.** `computeNavItems()` filters:
- `path.includes('#')` → skipped (sub-features like `#edit-sampling`)
- `segments.length > 2` → skipped (sub-pages like `/control-plane/sentry`)

So only `/dashboard/control-plane` shows in nav → clicking it loads the index page → sub-pages
are reached via in-page navigation (tabs, cards, etc.).

### 5.5 CSRF protection (automatic — no changes needed)

> **Reference:** [csrf.ts](file:///e:/1/Madagascar%20Project/cf-admin/src/lib/csrf.ts)

CSRF validation runs in middleware **before** any auth check (middleware.ts line 166–175) on
ALL mutation methods (POST/PUT/PATCH/DELETE). It validates `Origin` or `Referer` headers against
`SITE_URL`. New API routes at `/api/control-plane/*` are **automatically covered** — no opt-in.

**Client-side requirement:** All Preact islands making API calls must include credentials:
```ts
fetch('/api/control-plane/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'same-origin',  // ensures cookies + Origin header are sent
  body: JSON.stringify({ key, value }),
});
```

### 5.6 Audit system integration

> **Reference:** [audit.ts](file:///e:/1/Madagascar%20Project/cf-admin/src/lib/audit.ts)

**New types to add:**

```ts
// AuditAction union — add:
| 'config_change'       // Layer A: service_config value mutation
| 'provider_write'      // Layer B: external provider API call
| 'cache_purge'         // KV config cache purge

// AuditModule union — add:
| 'control_plane'       // All control-plane operations
```

**Audit pattern (from api/settings/portal.ts line 69–87):**

```ts
// Every mutation must log via createAuditLogger → waitUntil (zero latency):
if (cfCtx?.waitUntil) {
  const auditLogger = createAuditLogger({
    db: env.DB,
    waitUntil: cfCtx.waitUntil.bind(cfCtx),
    silenced: user.auditSilenced,          // DEV audit silence feature
  });

  auditLogger({
    userId: user.userId,
    userEmail: user.email,
    userRole: user.role,
    action: 'config_change',               // NEW action type
    module: 'control_plane',               // NEW module type
    targetId: key,                         // e.g. 'sentry.cf_astro.traces.booking'
    targetType: 'service_config',
    details: JSON.stringify({ key, old_value, new_value, reason }),
  });
}
```

**Additionally write to `service_config_history`** (double-write for structured diffs):

```ts
await env.DB.prepare(`
  INSERT INTO service_config_history (key, old_value, new_value, changed_by, changed_by_email, reason)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6)
`).bind(key, oldValue, newValue, user.userId, user.email, reason || null).run();
```

### 5.7 API response patterns

> **Reference:** [api.ts](file:///e:/1/Madagascar%20Project/cf-admin/src/lib/api.ts)

All control-plane API routes MUST use the shared helpers:

| Method | Response helper | Headers | Purpose |
|---|---|---|---|
| GET (reads) | `withETag(req, data)` | `Cache-Control: private, max-age=60, SWR=300` + ETag | Cached, 304 support |
| GET (live/realtime) | `jsonFresh(data)` | `Cache-Control: no-store` | No caching (health, live metrics) |
| POST/PATCH/DELETE | `jsonOk(data)` | `Cache-Control: no-store, no-cache` + nosniff | Mutation, never cached |
| Error | `jsonError(status, msg)` | Same as mutation | Structured error |

**Error handling pattern (from api/settings/portal.ts line 89–94):**

```ts
catch (err: unknown) {
  if (err instanceof AuthError) return jsonError(err.status, err.message);
  console.error('[ControlPlaneAPI] POST error:', err);
  return jsonError(500, 'Internal server error');
}
```

### 5.8 Page component patterns

> **Reference:** [settings/index.astro](file:///e:/1/Madagascar%20Project/cf-admin/src/pages/dashboard/settings/index.astro)

**Mandatory page structure (from settings page):**

```astro
---
// 1. Imports
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { requireAuth } from '../../../lib/auth/guard';
import { isSuperAdmin, isOwnerOrDev, type Role } from '../../../lib/auth/rbac';
import { getEnv } from '../../../lib/env';
import { ServiceConfigRepository } from '../../../lib/dal/ServiceConfigRepository';

// 2. Auth + PLAC
const user = await requireAuth(Astro);
const env = getEnv(Astro);
const canEdit = isSuperAdmin(user.role as Role);
const accessPages = (user as any).accessMap as Record<string, boolean> | undefined;
const canEditSampling = canEdit && (accessPages?.['/dashboard/control-plane#edit-sampling'] !== false);

// 3. Server-side data fetching (fail-graceful — return [] on error)
const configRepo = new ServiceConfigRepository(env.DB);
const [configs, history] = await Promise.all([
  configRepo.getAllSettings(),
  configRepo.getRecentHistory(20),
]);
---

<!-- 4. Layout wrapper (provides sidebar, header, theme) -->
<AdminLayout title="Service Control">
  <div class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">

    <!-- 5. Hero Page Header (standard pattern from settings page) -->
    <div class="mb-10">
      <div class="flex items-center gap-3 mb-3">
        <div class="flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--theme-accent)]/10 ...">
          <!-- icon SVG -->
        </div>
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold ...">Service Control</h1>
          <p class="text-sm text-[var(--theme-text-secondary)] mt-0.5">
            {canEdit ? 'Manage service configurations...' : 'View current service configuration.'}
          </p>
        </div>
      </div>
    </div>

    <!-- 6. Content sections with Preact islands -->
    <section class="bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border-subtle)] ...">
      <PreactIsland client:load initialData={configs} canEdit={canEditSampling} />
    </section>

  </div>
</AdminLayout>
```

**Key points:**
- `AdminLayout` wraps everything — provides sidebar, header, auth context, theme CSS vars.
- `client:load` hydration directive for Preact islands (interactive components).
- `canEdit` prop gates UI controls (shows read-only vs editable).
- All data fetched server-side in the `---` frontmatter block, passed as props.

### 5.9 Seed data overview

`service_config` is **seeded with the current production values** so the panel reflects reality on
day one. Full INSERT statements are in §12. Summary of 25 config keys:

| Service | Keys | Examples |
|---|---|---|
| Sentry (cf-astro) | 8 | traces.booking=0.5, error_sample_rate=1.0, enabled=true |
| Sentry (cf-admin) | 3 | traces=0.1, error_sample_rate=1.0, enabled=true |
| PostHog | 5 | enabled=true, autocapture=true, session_recording.enabled=false |
| Rate limits | 7 | booking.max_requests=20, analytics.max_requests=60 |
| Cloudflare | 2 | head_sampling_rate=1 (READ-ONLY), observability_enabled=true (READ-ONLY) |

---

## 6. Files to build (cf-admin)

```
migrations/0028_service_config.sql, 0029_service_config_history.sql, 0030_seed_control_plane_pages.sql

src/lib/dal/ServiceConfigRepository.ts     # mirror PortalSettingsRepository: get/getAll/set,
                                           # bounds-validated, proto-guarded, fail-soft
src/lib/control-plane/
  config-schema.ts          # typed registry of every knob (key,type,bounds,default,service,scope)
  config-publisher.ts       # D1 write → bump KV config:global → audit + history
  sentry-admin.ts           # Sentry REST: stats + settings read/write (SENTRY_AUTH_TOKEN)
  posthog-admin.ts          # PostHog API: insights + project settings
  cloudflare-admin.ts       # CF GraphQL/REST: metrics + scoped writes
  supabase-admin.ts         # advisors/metrics via service role (+ optional Mgmt API)

src/pages/dashboard/control-plane/
  index.astro               # overview: ServiceStatusStrip + per-service cards
  sentry.astro cloudflare.astro posthog.astro supabase.astro
src/components/admin/control-plane/
  SamplingSlider.tsx        # 0..1 slider + live "events/day at this rate" estimate
  ProviderMetricsCard.tsx ConfigDiffModal.tsx ServiceToggle.tsx

src/pages/api/control-plane/
  config.ts                 # GET all / PATCH one
  sentry.ts cloudflare.ts posthog.ts supabase.ts purge-cache.ts
```

**Every mutation route pattern:**
`requireAuth(ctx,'<role>')` → `placDenyResponse(session,'/dashboard/control-plane#<action>')` →
validate against `config-schema` bounds → `ServiceConfigRepository.set()` → `config-publisher`
bumps KV → `auditLog(...)` + `service_config_history` (before/after). No middleware edits needed.

Add `config_change` to the `AuditAction` union and (optionally) a `control_plane` `AuditModule` in
`src/lib/audit.ts`.

---

## 7. Consumer-side changes (makes the knobs real)

> **Detailed implementation patterns, code diffs, and architecture are in §11.**
> This section is a summary of what changes and where.

Both apps gain a shared config reader that reuses cf-astro's **existing 3-layer cache** pattern
(isolate memory 10s → CF Cache API 60s → **shared D1 `service_config`** fallback). `[v2 — there is
NO shared KV namespace between the apps; D1 is the shared substrate, see §0.5-B]`

```ts
// getServiceConfig(env): snapshot of service_config read from shared D1 (cached locally per app)
// (30–60s TTL, fallback to baked-in defaults so a D1 outage never breaks init)
```

**Client-side (browsers) `[v2 — corrected, see §0.5-A]`:** cf-astro is `output: 'static'`, so the
client config CANNOT come from a per-request SSR-injected island on prerendered pages. Client scripts
instead `fetch('/api/runtime-config')` (a new `prerender=false` SSR endpoint, D1-backed, client-safe
values only) before initializing Sentry/PostHog, with hardcoded fallback on failure. The JSON island
is an optional fast-path for genuinely-SSR pages only.

**Files modified and why:**
- **cf-astro `src/scripts/sentry.ts`** — `tracesSampler` reads config from JSON island;
  `beforeSend` adds runtime error sampling. See §11.3.
- **cf-astro `functions/_middleware.ts`** — `tracesSampleRate: 0.1` → `tracesSampler` reading
  from KV-cached config via closure. See §11.3.
- **cf-astro `src/scripts/analytics-loader.ts`** — `posthog.init()` reads config; kill-switch
  skips init entirely if `posthog.enabled: false`. See §11.4.
- **cf-astro `src/lib/rate-limit.ts`** — `RATE_LIMITS` const gains override support from config.
  See §11.5.
- **cf-admin server Sentry** — same `tracesSampler` pattern; D1 access already available. See §11.3.

A **"Purge config cache"** action deletes the KV `config:global` key → both apps refresh within
one TTL (≤60s), no redeploy.

> Cross-repo note: cf-astro consumer code ships in the **cf-astro** repo (branch
> `claude/codebase-services-review-4NRFz`); everything else is cf-admin. Both deploy manually
> (`wrangler deploy` / Pages dashboard) — no CI deploy exists.

---

## 8. Security, secrets, audit

- **Secrets never displayed** — panel shows health/last-used only. New secrets:
  `CONTROL_PLANE_CF_TOKEN` (scoped CF writes), `POSTHOG_PERSONAL_API_KEY`; reuse
  `SENTRY_AUTH_TOKEN`. Full inventory in §14.
- **Validation:** numeric rates clamped to `[min_value,max_value]` defined in `service_config`
  schema (rates 0–1, rate-limit counts 1–1000); proto-pollution guard (existing DAL standard
  from `PortalSettingsRepository.getSettingsMap()` line 110).
- **Audit:** Ghost Audit (`admin_audit_log`) + `service_config_history` (full before/after).
  CSRF middleware covers new API routes automatically. New audit types in §13.
- **Fail-safe:** baked-in defaults on any read failure; a bad value cannot crash Sentry init.
  Provide "reset to defaults" action. See §15 constraint #9.
- **Blast radius tiering:** provider-API writes (Layer B) require `owner` + `#provider-write`;
  SDK sampling edits require `admin` + `#edit-sampling`. See §4.
- **Client config safety:** JSON island `<script type="application/json">` is CSP-safe. Never
  include API keys, tokens, or DSN secrets in the client-side config blob. Only rates/toggles.

---

## 9. Phased roadmap (chosen scope: Full Layer A + B, all services)

> **Implementation status (branch `claude/codebase-services-review-4NRFz`):**
> ✅ **Phase 0 done** — migrations 0028–0030, `config-schema.ts`, `ServiceConfigRepository`,
> RBAC+PLAC page + 4 sub-pages, deriveSection→MANAGEMENT, audit types. `astro check` clean.
> ✅ **Phase 1 done** — read-only live metrics on the overview (snapshot strip) and per-service
> sub-pages via `metrics-view.ts` reusing the KV-cached `fetchAllAnalytics()` aggregate
> (Cloudflare/Workers/R2/Queue/Supabase/Sentry; PostHog metrics deferred to the PostHog-API phase).
> ✅ **Phase 2 done** — Layer-A writes: editable `ConfigEditor` island (sliders/toggles, optimistic
> UI, optimistic-concurrency), `PATCH/GET /api/control-plane/config` (admin + PLAC `#edit-sampling`,
> bounds-validated, audited, history-recorded), `POST /api/control-plane/purge-cache` (`#purge-config`),
> and `config-publisher.flushAstroConfigCache()` (best-effort cross-app flush via the existing
> `ASTRO_SERVICE` + `/api/revalidate` channel — cf-astro consumer lands in Phase 3). `getConfigVersion()`
> added for cheap change-detection.
> ✅ **Phase 3 done (cf-astro repo, same branch)** — cf-astro now consumes the shared D1
> `service_config`: `src/lib/service-config.ts` (3-layer cache, fail-safe DEFAULTS, `peek`/`purge`),
> `GET /api/runtime-config` + `runtime-config-client.ts` (client-safe subset; static pages fetch it),
> client `sentry.ts` (tracesSampler + beforeSend error sampling + replay + kill-switch), server
> `functions/_middleware.ts` (module-cached sync sampler + waitUntil refresh), `analytics-loader.ts`
> (PostHog kill-switch + capture/recording), `rate-limit.ts` (per-endpoint max from config), and
> `revalidate.ts` (`{kind:'config'}` flush). `tsc` clean across `src/**`; DEFAULTS verified equal to
> the live D1 values (exact parity). The cross-app "Purge config cache" path is now end-to-end.
> ✅ **Phase 4 done** — Layer-B provider control (cf-admin): admin clients
> `sentry-admin.ts` (stats_v2 usage, top issues, inbound filters, client-key rate limits, spike
> protection — corrected endpoints), `posthog-admin.ts` (project settings incl. nested
> `session_replay_config`, org billing), `cloudflare-admin.ts` (edge cache purge), `supabase-admin.ts`
> (Management-API advisors via PAT). API routes `/api/control-plane/{sentry,posthog,cloudflare,supabase}`
> (reads: super_admin+PLAC; writes: owner+PLAC `#provider-write`, audited `provider_write`). UI:
> `ProviderControls` island wired into each sub-page (graceful "token unconfigured" states). New
> optional secrets documented in `env.d.ts` + `wrangler.toml`. `astro check` clean (0/0).
> ✅ **Phase 5 (polish) done** — `preflight.ts` (schema-parity + provider-token presence) rendered as a
> **Health & Drift** panel on the overview; **"events/day at this rate" estimator** on the sampling
> sliders (baseline = CF 24h requests); **Reset to defaults** (`resetToDefaults` + `/api/control-plane/reset`,
> audited + cf-astro flush) per PLAN §18. `astro check` clean (0/0). Deferred (need cron/queue + a notify
> channel): scheduled config changes and external alerting.
> ✅ **Migrations applied to live D1** `madagascar-db` (24 config rows, 8 admin_pages rows, history table).
> ⏳ Neither app deployed yet; new Layer-B secrets not provisioned (those panels show "configure token"
> until `SUPABASE_ACCESS_TOKEN` / `POSTHOG_PERSONAL_API_KEY` / `CONTROL_PLANE_CF_TOKEN` are set).
> **The control plane is feature-complete across Layer A + Layer B; remaining work is deploy + secrets.**

| Phase | Scope | Outcome | cf-astro? |
|---|---|---|---|
| **0** | Migrations 0028–0030 + `ServiceConfigRepository` + seed real values + page registration | Page in nav, RBAC+PLAC enforced, shells | No |
| **1** | Read-only metrics pages (Sentry/CF/PostHog/Supabase/D1/R2/KV) extending `fetchAllAnalytics` | One-place accurate live dashboards | No |
| **2** | Layer-A writes (Sentry/PostHog/rate-limit rates) + `config-publisher` + KV bump; cf-admin consumes its own Sentry first | Tune cf-admin sampling live | No |
| **3** | cf-astro consumer wiring (`sentry.ts`, `_middleware.ts`, `analytics-loader.ts`, rate-limit) + new `GET /api/runtime-config` SSR endpoint + `/api/revalidate {kind:'config'}` flush `[v2]` | Tune cf-astro live | **Yes** |
| **4** | Layer-B provider writes (Sentry key rate limits/filters/spike protection, PostHog project settings, scoped CF token, Supabase advisors). New secrets: `POSTHOG_PERSONAL_API_KEY`, `CONTROL_PLANE_CF_TOKEN` | Manage provider-owned knobs | No |
| **5** | Alerting, config-drift detection, scheduled config changes, rate-estimators, "events/day at this rate" calculator | Polished ops tooling | No |

---

## 10. Provider API Reference (Layer B — exact endpoints & payloads)

> **Why this section exists:** Any AI agent implementing Layer B must know *exactly* which
> endpoints to call, what auth they require, and what gotchas to expect. All information below
> was verified against live Sentry/PostHog/CF/Supabase API docs and research (June 2025).

### 10.1 Sentry REST API

**Base URL:** `https://sentry.io/api/0/`
**Auth:** `Authorization: Bearer {SENTRY_AUTH_TOKEN}` — existing secret, already in cf-admin env.
**Rate limit:** ~100 req/sec per token.
**Org slug:** `pet-hotel-madagascar` | **Projects:** `cf-astro`, `cf-admin`

#### 10.1.1 Project Stats (events received/dropped/quota) `[v2 — prefer stats_v2]`
**Preferred (accurate quota/usage):**
```
GET /api/0/organizations/{org}/stats_v2/?field=sum(quantity)&groupBy=outcome&category=error&statsPeriod=24h
```
Outcomes: `accepted, filtered, rate_limited, invalid, abuse, client_discard, cardinality_limited`.
Scope: `org:read`. Use `category=transaction` for trace volume.
**Legacy fallback (per project):** `GET /api/0/projects/{org}/{project}/stats/?stat=received&stat=rejected&resolution=1h`.
**Extend existing `fetchSentry()` in `providers.ts` to call stats_v2 grouped by outcome.**

#### 10.1.2 Client Key Rate Limits
```
PUT /api/0/projects/{org}/{project}/keys/{key_id}/
Body: { "rateLimit": { "window": 3600, "count": 1000 } }
```
Response: full key object including `dsn`, `isActive`, `rateLimit`.
Scope: `project:write`. Window is in seconds; count is max events per window.
**List keys first:** `GET /api/0/projects/{org}/{project}/keys/` to get `key_id`.

#### 10.1.3 Inbound Data Filters
```
PUT /api/0/projects/{org}/{project}/filters/{filter_id}/
Body: { "active": true }
```
Valid `filter_id` values: `browser-extensions`, `localhost`, `legacy-browsers`, `web-crawlers`,
`filtered-transaction`. Each filter is updated independently (not bulk).
Scope: `project:write`.

#### 10.1.4 Dynamic Sampling — NOT a public API
> **CRITICAL FINDING:** Sentry does NOT expose a public REST endpoint for CRUD on dynamic
> sampling rules. Dynamic sampling is an automated feature managed by Sentry's Relay internally.
> You can toggle between `Automatic` mode (Sentry manages rates) and `Manual` mode (static
> baseline) via the Sentry UI.
>
> **What we CAN do via API:**
> - **SDK-level sampling** (Layer A) — `tracesSampler` / `beforeSend` with runtime-resolved rates
> - **Client-key rate limits** (§10.1.2) — cap events/sec per DSN
> - **Inbound data filters** (§10.1.3) — toggle built-in noise filters
>
> **Do NOT build a "dynamic sampling rules editor" in the panel.** Instead, surface a read-only
> "Dynamic Sampling mode" badge (Automatic/Manual) and link to Sentry UI for changes.

#### 10.1.5 Spike Protection `[v2 — corrected endpoint]`
Org-level dedicated endpoint (NOT a project-options PUT):
```
POST   /api/0/organizations/{org}/spike-protections/   Body: { "projects": ["$all"] }   # enable (201)
DELETE /api/0/organizations/{org}/spike-protections/   Body: { "projects": ["$all"] }   # disable
```
Use specific project slugs instead of `$all` to target one project. Scope: `project:read|write|admin`.
**May not be available on all plans — preflight before exposing the toggle.**

#### 10.1.6 Alert Rules (read-only listing)
```
GET /api/0/projects/{org}/{project}/rules/
```
Response: array of `{ id, name, conditions, actions, status, dateCreated }`.
Scope: `project:read`. Display in panel as read-only; link to Sentry UI for editing.

#### 10.1.7 Issues (extend metrics)
```
GET /api/0/projects/{org}/{project}/issues/?query=is:unresolved&sort=freq&limit=5
```
Response: array of `{ id, title, shortId, count, userCount, lastSeen, level }`.
Use for "Top 5 unresolved issues" card on dashboard.

### 10.2 PostHog REST API

**Base URL:** `https://us.posthog.com/api/` (US Cloud instance, matching `us.i.posthog.com` host).
**Auth:** `Authorization: Bearer {POSTHOG_PERSONAL_API_KEY}` — new secret, stored via
`wrangler secret put POSTHOG_PERSONAL_API_KEY`.
**Rate limit:** ~480 req/min for CRUD endpoints.

#### 10.2.1 Project Settings — Session Recording + Autocapture
> **IMPORTANT FINDING:** PostHog operates on a **project-level** for these settings. There is no
> separate "environment" API. If you need different sample rates for dev/prod, you use separate
> PostHog projects. Since we only use PostHog in cf-astro (production), one project suffices.

```
PATCH /api/projects/{project_id}/        # (or /api/environments/{id}/ on newer accounts)
Body: {
  "session_recording_opt_in": true,                       // enable/disable session recording
  "session_replay_config": { "sample_rate": "0.1",        // [v2] NESTED, value is a STRING
                             "minimum_duration_milliseconds": 0 },
  "autocapture_opt_out": false                            // true = disable autocapture
}
```
`[v2 — corrected]` The sample rate is **nested in `session_replay_config`** and serialized as a
**string**, not a flat `session_recording_sample_rate` float. Response: full project object.
Scope: Personal API Key with project admin permissions.
**Get project ID first:** `GET /api/projects/` (or `/api/environments/`) to resolve the id. PostHog is
migrating settings to environments — prefer the environments endpoint where present.

#### 10.2.2 Query API (HogQL)
```
POST /api/projects/{project_id}/query/
Body: {
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT toStartOfDay(timestamp) as day, count() as pageviews FROM events WHERE event = '$pageview' GROUP BY day ORDER BY day ASC"
  }
}
```
Response: `{ results: [[day, count], ...], columns: [...], types: [...] }`.
Use for pageview counts, unique users (`count(DISTINCT distinct_id)`), event volume trends.
**Gotcha:** queries are expensive — cache results in KV with 5-min TTL.

#### 10.2.3 Feature Flags
```
GET    /api/projects/{project_id}/feature_flags/                    # list all
GET    /api/projects/{project_id}/feature_flags/{id}/               # read one (id = numeric)
PATCH  /api/projects/{project_id}/feature_flags/{id}/               # update
Body:  { "active": true, "filters": { "groups": [{ "rollout_percentage": 50 }] } }
```
**Note:** `id` is the numeric ID, not the flag key. List first to resolve key → id.

#### 10.2.4 Billing / Quota `[v2 — org-level, not project-level]`
```
GET /api/organizations/{organization_id}/billing/
```
Response: `{ plan, current_usage, products: [{ type, current_usage, usage_limit, percentage_usage }] }`.
Use for "X% of Y quota used" gauge. Billing is an **organization** resource — `/api/projects/{id}/billing/`
does not exist. **Gotcha:** PostHog Cloud only, not self-hosted.

### 10.3 Cloudflare REST API v4

**Base URL:** `https://api.cloudflare.com/client/v4/`
**Auth:** `Authorization: Bearer {CONTROL_PLANE_CF_TOKEN}` — new scoped token.
**Account ID:** `320d1ebab5143958d2acd481ea465f52`
**Zone ID:** `c73b1ccd7f03999ea419ef8177fa68d4`

#### 10.3.1 Cache Purge (runtime, no redeploy)
```
POST /zones/{zone_id}/purge_cache
Body: { "purge_everything": true }       # or { "files": ["https://…/page"] }
```
Response: `{ success: true, result: { id: "..." } }`.
Scope: `Cache Purge`. **Already exists in cf-astro `/api/revalidate` — this adds it to the panel.**

#### 10.3.2 KV Write/Delete (runtime)
```
PUT    /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key_name}
       Body: raw value (string)
DELETE /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key_name}
```
Scope: `Workers KV Storage:Edit`. Use for the "Purge config cache" action → delete
`config:global` key to force both apps to re-pull from D1.

#### 10.3.3 Worker Observability (`head_sampling_rate`)
> **CONFIRMED: NOT runtime-configurable.** `head_sampling_rate` is part of `wrangler.toml`
> `[observability]` config and requires script redeployment. The Workers Script Settings API
> (`/accounts/{account_id}/workers/scripts/{name}/settings`) only supports `logpush` and
> `tail_consumers`, NOT observability sampling.
>
> **Panel behaviour:** Surface as read-only with a "⚠ Requires redeploy" badge. Show current
> value parsed from `wrangler.toml` (cf-astro: `head_sampling_rate=1`, cf-admin: enabled).

#### 10.3.4 Analytics GraphQL datasets (beyond what exists)
Additional datasets available: `firewallEventsAdaptive`, `r2OperationsAdaptive`,
`botManagementAdaptive`, `dnsAnalyticsAdaptive`. Currently using: `httpRequests1hGroups`,
`workersInvocationsAdaptive`, `d1AnalyticsAdaptiveGroups`. **Add R2 ops metrics in Phase 1.**

#### 10.3.5 Zero Trust Session Revoke (runtime)
```
DELETE /accounts/{account_id}/access/users/{user_id}/active_sessions
```
Already exists in cf-admin with `CF_API_TOKEN_ZT_WRITE`. Surface in panel for convenience.

#### 10.3.6 Token Scopes Required for `CONTROL_PLANE_CF_TOKEN`
```
Zone:    Cache Purge, Analytics:Read
Account: Workers Scripts:Read, R2:Read, D1:Read   (extended read-only metrics)
Account: Workers KV Storage:Edit                  # [v2] ONLY if you adopt the optional shared-KV
                                                  #      propagation path; the recommended
                                                  #      D1 + /api/revalidate webhook path (§0.5-B)
                                                  #      does NOT need KV write.
```

### 10.4 Supabase

**Prometheus Metrics:** Already implemented via `fetchSupabase()` in `providers.ts` using
`Basic service_role:` auth to `/{projectRef}.supabase.co/customer/v1/privileged/metrics`.

**Management API (optional Phase 4+):**
```
GET https://api.supabase.com/v1/projects/{ref}/health       # uptime status
GET https://api.supabase.com/v1/projects/{ref}/advisors     # security/perf recommendations
```
`[v2 — corrected auth]` Auth: `Authorization: Bearer {SUPABASE_ACCESS_TOKEN}` — a Supabase
**Personal Access Token (`sbp_…`)** or OAuth token. The **`service_role` key does NOT work** on
`api.supabase.com`. Alternative (no new secret): derive advisors by running the advisor lint queries
over the existing service-role Postgres connection. `service_role` remains correct for the project's
own privileged metrics endpoint, PostgREST, and `/auth/v1/admin/*`.
**Decision: Surface advisors read-only. No schema writes through the panel.**

---

## 11. Consumer-Side Architecture (how both apps read config)

> This is the most critical section — it describes how hardcoded values become runtime-resolved.

### 11.1 Config propagation flow

```
[v2 — corrected; no shared KV, see §0.5-B. D1 is the shared source of truth.]

cf-admin writes to shared D1 `service_config`  + bumps `version`
       │
       ├─ cf-admin: invalidate its own local cache (SESSION KV `cfg:*` / isolate memory)
       │
       └─ "Purge config cache" → POST cf-astro /api/revalidate {kind:'config'}  (ASTRO_SERVICE binding,
                                  REVALIDATION_SECRET) → cf-astro flushes its CF Cache API config entry
       ↓
EACH app independently reads shared D1 `service_config` and caches LOCALLY:
   isolate memory (10s) → CF Cache API (60s) → shared D1 (source of truth / fallback = baked defaults)
   (a 1-row `version` read per TTL decides whether to re-pull the full config)
       ↓
Config available to:  cf-astro SSR → Astro.locals  ·  cf-astro client → GET /api/runtime-config
                      cf-admin server → module-scoped cache
```

### 11.2 Client-side config injection (cf-astro browser scripts)

> `[v2 — IMPORTANT, see §0.5-A]` cf-astro is `output: 'static'`. Prerendered marketing pages do NOT
> run `src/middleware.ts` and have no per-request `Astro.locals`, so a server-injected JSON island
> would be **frozen at build time** on exactly the pages where Sentry/PostHog run. The JSON-island
> pattern below is therefore valid ONLY for genuinely-SSR pages (`prerender = false`). The primary,
> reliable mechanism is the **`GET /api/runtime-config` fetch** described at the end of this section.

Browser scripts (`sentry.ts`, `analytics-loader.ts`) cannot access KV/D1 at runtime. Config must
reach them from the server. **Pattern (SSR pages only): JSON island.**

```html
<!-- Injected by cf-astro SSR layout, read by client scripts -->
<script type="application/json" id="__svc_cfg">
  {"sentry":{"traces":{"booking":0.5,"api":0.1,"default":0},"error_sample_rate":1.0},
   "posthog":{"enabled":true,"session_recording":{"enabled":false,"sample_rate":0},"autocapture":true}}
</script>
```

**Why this pattern:**
- CSP-safe: `<script type="application/json">` does NOT execute — no `unsafe-inline` needed.
- Works with current `script-src 'self'` policy.
- Client reads via `JSON.parse(document.getElementById('__svc_cfg')?.textContent || '{}')`.
- Must HTML-escape `</script>` sequences in JSON values (replace `</` with `<\\/`).

**Implementation (SSR pages only):** In a `prerender=false` layout, read config from
`Astro.locals.serviceConfig` (populated by middleware) and render the JSON island.

#### Primary mechanism `[v2]`: `GET /api/runtime-config` (works on static AND SSR pages)

Add an SSR endpoint (`export const prerender = false`) that returns the client-safe config:

```ts
// cf-astro: src/pages/api/runtime-config.ts
export const prerender = false;
export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime.env;
  const cfg = await getServiceConfig(env);            // shared D1 read + 3-layer cache (10s/60s)
  // CLIENT-SAFE SUBSET ONLY — never tokens/DSN secrets:
  const body = {
    sentry:  { traces: cfg.sentry.cf_astro.traces, error_sample_rate: cfg.sentry.cf_astro.error_sample_rate,
               replay: cfg.sentry.cf_astro.replay, enabled: cfg.sentry.cf_astro.enabled },
    posthog: cfg.posthog,
    v: cfg.version,
  };
  return jsonFreshShort(body); // Cache-Control: public, max-age=60, stale-while-revalidate=300
};
```

Client scripts fetch it before init (already deferred via `requestIdleCallback`), with the current
hardcoded values as the fallback if the fetch fails:

```ts
const cfg = await fetch('/api/runtime-config').then(r => r.json()).catch(() => null);
const sentryCfg = cfg?.sentry ?? DEFAULTS.sentry;   // fail-safe: never blocks Sentry init
```

This is the same SSR-endpoint shape as the existing `prerender=false` routes (`/api/ingest`,
`/api/health`) and keeps CSP unchanged (a same-origin fetch). A short edge cache (`max-age=60`)
bounds propagation; the "Purge config cache" action additionally purges this path's cache tag.

### 11.3 Sentry SDK refactors

#### cf-astro `src/scripts/sentry.ts` (client-side)
```ts
// BEFORE (hardcoded):
tracesSampler: (ctx) => {
  if (name.includes('/booking')) return 0.5;  // ← hardcoded
  if (name.includes('/api/')) return 0.1;      // ← hardcoded
  return 0.0;
};
sampleRate: 1.0,  // ← hardcoded, immutable after init

// AFTER (runtime-resolved):
const cfg = JSON.parse(document.getElementById('__svc_cfg')?.textContent || '{}');
const sentryCfg = cfg?.sentry ?? {};

tracesSampler: (ctx) => {
  const rates = sentryCfg.traces ?? {};
  if (name.includes('/booking')) return rates.booking ?? 0.5;    // ← fallback = current value
  if (name.includes('/api/'))    return rates.api ?? 0.1;
  return rates.default ?? 0.0;
};
// sampleRate: 1.0 → stays as init-time default, but add beforeSend for runtime override:
beforeSend: (event) => {
  const rate = sentryCfg.error_sample_rate ?? 1.0;
  return Math.random() < rate ? event : null;  // ← runtime error sampling
};
```

**Why `beforeSend` for errors:** `sampleRate` is read-only after `Sentry.init()`. The only way to
dynamically control error sampling is via `beforeSend` callback doing probabilistic dropping.
`tracesSampler` is natively dynamic (called per transaction).

#### cf-astro `functions/_middleware.ts` (server-side)
```ts
// BEFORE: tracesSampleRate: 0.1 (hardcoded scalar)
// AFTER: tracesSampler reading from KV-cached config via context.env

const sentryPlugin = Sentry.sentryPagesPlugin((context) => {
  // context.env.KV is available in Pages Functions
  // Config already loaded by middleware into a closure variable
  const rate = getConfigValue('sentry.cf_astro.traces.server') ?? 0.1;
  return {
    dsn: context.env.SENTRY_DSN || '…',
    environment: 'production',
    tracesSampler: () => rate,  // ← dynamic, from KV config
    sendDefaultPii: false,
  };
});
```

**Challenge `[v2 — corrected, see §0.5-I]`:** `sentryPagesPlugin`'s options factory runs per request
and cannot cleanly `await` a D1/cache read, and reading config on every request before init adds
latency. **Do NOT read inline in the closure.** Instead keep a **module-scoped cached config**
refreshed out-of-band via `context.waitUntil(refreshIfStale())` (short TTL, reads shared D1 →
CF Cache API → isolate memory); `tracesSampler` reads the cached value **synchronously**; the very
first request after a cold start uses the hardcoded default. This keeps the hot path allocation-free
and never blocks Sentry init on I/O.

#### cf-admin (server-side)
cf-admin's Sentry is initialized in `src/workers/cf-entry.ts` or equivalent server entry point.
Same pattern: read `sentry.cf_admin.traces` from D1/KV config, pass to `tracesSampler`.
cf-admin already has D1 access in every request context, so no special injection needed.

### 11.4 PostHog refactor (cf-astro `analytics-loader.ts`)

```ts
// BEFORE (hardcoded):
posthog.init('phc_62mNJJsf…', {
  api_host: 'https://us.i.posthog.com',
  capture_pageview: true,
  capture_pageleave: true,
});

// AFTER (config-driven):
const cfg = JSON.parse(document.getElementById('__svc_cfg')?.textContent || '{}');
const phCfg = cfg?.posthog ?? {};

if (phCfg.enabled !== false) {  // ← kill-switch
  posthog.init('phc_62mNJJsf…', {
    api_host: 'https://us.i.posthog.com',
    capture_pageview: phCfg.capture_pageview ?? true,
    capture_pageleave: true,
    autocapture: phCfg.autocapture ?? true,        // ← was default (true)
    session_recording: phCfg.session_recording?.enabled ? {
      sample_rate: phCfg.session_recording.sample_rate ?? 0,
    } : undefined,
  });
}
```

**PostHog snippet loads async regardless** — the `posthog.init()` call configures behaviour.
If `enabled: false`, we skip `init()` entirely → no PostHog script loads → zero analytics cost.

### 11.5 Rate-limit refactors

#### cf-astro `src/lib/rate-limit.ts`
```ts
// BEFORE: RATE_LIMITS is a const object with hardcoded values
// AFTER: read from config with hardcoded fallbacks

// In middleware, populate Astro.locals.rateLimitConfig from service_config
// In rate-limit.ts, accept optional overrides:
export function getRateLimits(overrides?: Partial<Record<keyof typeof RATE_LIMITS, RateLimitConfig>>): typeof RATE_LIMITS {
  return {
    booking:    overrides?.booking    ?? { maxRequests: 20, window: '60 s' },
    consent:    overrides?.consent    ?? { maxRequests: 20, window: '60 s' },
    contact:    overrides?.contact    ?? { maxRequests: 10, window: '60 s' },
    arco:       overrides?.arco       ?? { maxRequests: 3,  window: '60 s' },
    arcoSubmit: overrides?.arcoSubmit ?? { maxRequests: 3,  window: '60 s' },
    analytics:  overrides?.analytics  ?? { maxRequests: 60, window: '60 s' },
    mcp:        overrides?.mcp        ?? { maxRequests: 60, window: '60 s' },
    admin:      overrides?.admin      ?? { maxRequests: 10, window: '60 s' },
  };
}
```

Config keys: `ratelimit.booking.max_requests=20`, `ratelimit.booking.window=60 s`, etc.

---

## 12. Full seed data (migration 0028 INSERT statements)

```sql
-- Sentry cf-astro (from src/scripts/sentry.ts + functions/_middleware.ts)
INSERT INTO service_config (key,value,value_type,service,app_scope,category,min_value,max_value,description) VALUES
 ('sentry.cf_astro.traces.booking','0.5','number','sentry','cf-astro','sampling',0,1,'Trace sample rate for /booking routes'),
 ('sentry.cf_astro.traces.api','0.1','number','sentry','cf-astro','sampling',0,1,'Trace sample rate for /api/* routes'),
 ('sentry.cf_astro.traces.default','0','number','sentry','cf-astro','sampling',0,1,'Trace sample rate for all other routes'),
 ('sentry.cf_astro.traces.server','0.1','number','sentry','cf-astro','sampling',0,1,'Server-side tracesSampleRate (Pages middleware)'),
 ('sentry.cf_astro.error_sample_rate','1.0','number','sentry','cf-astro','sampling',0,1,'Error event sample rate (via beforeSend)'),
 ('sentry.cf_astro.replay.session_rate','0','number','sentry','cf-astro','sampling',0,1,'Session replay sample rate (0=disabled)'),
 ('sentry.cf_astro.replay.on_error_rate','0','number','sentry','cf-astro','sampling',0,1,'Replay-on-error rate (0=disabled)'),
 ('sentry.cf_astro.enabled','true','boolean','sentry','cf-astro','feature',NULL,NULL,'Master kill-switch for Sentry in cf-astro'),

-- Sentry cf-admin (from server config)
 ('sentry.cf_admin.traces','0.1','number','sentry','cf-admin','sampling',0,1,'Server tracesSampleRate'),
 ('sentry.cf_admin.error_sample_rate','1.0','number','sentry','cf-admin','sampling',0,1,'Error event sample rate'),
 ('sentry.cf_admin.enabled','true','boolean','sentry','cf-admin','feature',NULL,NULL,'Master kill-switch for Sentry in cf-admin'),

-- PostHog (from src/scripts/analytics-loader.ts)
 ('posthog.enabled','true','boolean','posthog','cf-astro','feature',NULL,NULL,'Master kill-switch for PostHog'),
 ('posthog.capture_pageview','true','boolean','posthog','cf-astro','feature',NULL,NULL,'Auto-capture pageviews'),
 ('posthog.autocapture','true','boolean','posthog','cf-astro','feature',NULL,NULL,'Autocapture clicks/forms/etc'),
 ('posthog.session_recording.enabled','false','boolean','posthog','cf-astro','feature',NULL,NULL,'Enable session recording'),
 ('posthog.session_recording.sample_rate','0','number','posthog','cf-astro','sampling',0,1,'Session recording sample rate'),

-- Rate limits cf-astro (from src/lib/rate-limit.ts RATE_LIMITS const)
 ('ratelimit.booking.max_requests','20','number','ratelimit','cf-astro','limits',1,1000,'Max requests per window for /booking'),
 ('ratelimit.booking.window','60 s','string','ratelimit','cf-astro','limits',NULL,NULL,'Sliding window for booking rate limit'),
 ('ratelimit.consent.max_requests','20','number','ratelimit','cf-astro','limits',1,1000,'Max requests for consent endpoint'),
 ('ratelimit.contact.max_requests','10','number','ratelimit','cf-astro','limits',1,1000,'Max requests for contact endpoint'),
 ('ratelimit.arco.max_requests','3','number','ratelimit','cf-astro','limits',1,100,'Max requests for ARCO upload'),
 ('ratelimit.analytics.max_requests','60','number','ratelimit','cf-astro','limits',1,1000,'Max requests for analytics endpoints'),
 ('ratelimit.mcp.max_requests','60','number','ratelimit','cf-astro','limits',1,1000,'Max requests for MCP endpoints'),

-- Cloudflare observability (read-only, deploy-time — surfaced for visibility)
 ('cloudflare.cf_astro.head_sampling_rate','1','number','cloudflare','cf-astro','sampling',0,1,'Worker observability sampling (DEPLOY-TIME ONLY)'),
 ('cloudflare.cf_admin.observability_enabled','true','boolean','cloudflare','cf-admin','feature',NULL,NULL,'Worker observability enabled (DEPLOY-TIME ONLY)');
```

---

## 13. Audit system additions

Add to `src/lib/audit.ts`:

```ts
// New AuditAction:
| 'config_change'       // Layer A config mutation
| 'provider_write'      // Layer B provider API call
| 'cache_purge'         // Config/KV cache purge

// New AuditModule:
| 'control_plane'       // All control plane operations
```

Every mutation records both `admin_audit_log` (Ghost Audit) AND `service_config_history`
(structured before/after diff). Example audit details JSON:
```json
{
  "key": "sentry.cf_astro.traces.booking",
  "old_value": "0.5",
  "new_value": "0.3",
  "reason": "Reducing trace volume to stay within free tier"
}
```

---

## 14. Secrets inventory

| Secret | Where stored | Purpose | Phase |
|---|---|---|---|
| `SENTRY_AUTH_TOKEN` | cf-admin wrangler secret | Sentry REST API. `[v2]` Read-only today — for Layer B writes expand scopes to `org:read + project:read + project:write` (or add a write-scoped token) | Existing (re-scope) |
| `SENTRY_ORG_SLUG` | cf-admin wrangler.toml | `pet-hotel-madagascar` | Existing |
| `SENTRY_PROJECT_SLUG` | cf-admin wrangler.toml | `cf-admin` (extends to cf-astro per query) | Existing |
| `POSTHOG_PERSONAL_API_KEY` | cf-admin wrangler secret (NEW) | PostHog project/env settings + query + org billing | Phase 4 |
| `CONTROL_PLANE_CF_TOKEN` | cf-admin wrangler secret (NEW) | Scoped CF API for cache purge + analytics (KV write only if you choose the optional shared-KV path) | Phase 4 |
| `SUPABASE_ACCESS_TOKEN` | cf-admin wrangler secret (NEW) | `[v2]` Supabase **Personal Access Token (`sbp_…`)** for Management API advisors/health (service_role does NOT work on api.supabase.com). Optional if advisors are derived via SQL | Phase 4 |
| `CLOUDFLARE_API_TOKEN` | cf-admin wrangler secret | Existing CF analytics (read-only) | Existing |
| `CF_API_TOKEN_ZT_WRITE` | cf-admin wrangler secret | Zero Trust session revoke | Existing |
| `SUPABASE_SERVICE_ROLE_KEY` | cf-admin wrangler secret | Supabase privileged metrics + Auth admin + PostgREST | Existing |

**Creating new secrets:**
```sh
# PostHog: create at https://us.posthog.com/settings/user-api-keys
# Required scopes: project:admin (for session recording + autocapture + billing reads)
wrangler secret put POSTHOG_PERSONAL_API_KEY --name cf-admin-madagascar

# Cloudflare: create at https://dash.cloudflare.com/profile/api-tokens
# Template: "Edit Cloudflare Workers" + Cache Purge + Analytics:Read
wrangler secret put CONTROL_PLANE_CF_TOKEN --name cf-admin-madagascar
```

---

## 15. Constraints & decisions (updated)

1. **CF write token** — current MCP token is read-scoped (403 on workers/R2). Phase 4 CF writes
   require provisioning `CONTROL_PLANE_CF_TOKEN`. Until then CF is read-only + existing
   purge/ZT-revoke actions (which use separate tokens).
2. **Worker observability sampling** — `head_sampling_rate` is deploy-time only (confirmed: the
   Workers Script Settings API does NOT expose observability config). Surface as read-only badge
   with "⚠ Requires redeploy" annotation. Current values: cf-astro = `1`, cf-admin = enabled.
3. **Sentry dynamic sampling** — NO public API for custom dynamic sampling rules. Server-side
   sampling is automated by Sentry Relay. Surface mode (Automatic/Manual) as read-only badge.
   All "sampling control" in the panel is SDK-level (Layer A) + client-key rate limits (Layer B).
4. **PostHog environments** — PostHog API operates project-level. No per-environment settings API.
   Since only cf-astro uses PostHog (production only), single-project model is correct.
5. **Doc publishing** — keep control-plane internals under `docs/` (not synced), never under
   `documentation/`. The sync workflow only copies `RULESAd.md` + `documentation/**`.
6. **No arbitrary SQL** in the Supabase panel — schema stays migration-driven. Advisors surfaced
   read-only.
7. **env.d.ts gaps** — `ANALYTICS` and `EMAIL_QUEUE` bindings exist in `wrangler.toml` but are
   absent from the typed `CfEnv` interface. Fix when touching env types.
8. **Config injection security** — JSON island `<script type="application/json">` is CSP-safe
   (does not execute). Must escape `</script>` in values. Never include secrets in client config.
9. **Fail-safe invariant** — every config read MUST fall back to the baked-in default (the
   current hardcoded value). A missing/corrupt config can never crash SDK init or break a site.
   The `config-schema.ts` registry defines the default for every key.
10. **Deployment** — both apps deploy manually (`wrangler deploy` / Pages dashboard). No CI.
    Consumer-side changes (Phase 3) ship in the cf-astro repo; everything else is cf-admin.

---

## 16. Infra resource inventory (reference)

| Resource | Identifier |
|---|---|
| CF account | `320d1ebab5143958d2acd481ea465f52` |
| CF zone (madagascarhotelags.com) | `c73b1ccd7f03999ea419ef8177fa68d4` |
| D1 (shared) | `madagascar-db` / `7fca2a07-d7b4-449d-b446-408f9187d3ca` |
| KV namespaces | `SESSION` `bee123…`, `ISR_CACHE` `d9cea8…`, `ADMIN_SESSION` `ba82ee…` |
| R2 buckets | `madagascar-images` (shared), `arco-documents` (cf-astro, private) |
| Queue / Analytics Engine | `madagascar-emails` / `madagascar_analytics` |
| Supabase | project `zlvmrepvypucvbyfbpjj` (us-east-1) |
| Sentry org | `pet-hotel-madagascar` (`o4510752043761664`); projects `cf-astro`, `cf-admin` |
| Sentry DSN cf-astro | `…@o4510752043761664.ingest.us.sentry.io/4511247514861568` |
| Sentry DSN cf-admin | `389bb420…@o4510752043761664.ingest.us.sentry.io/4511193333760000` |
| PostHog | host `https://us.i.posthog.com`, key `phc_62mNJJsf…` (cf-astro only) |
| Upstash Redis | `https://modest-mastiff-88856.upstash.io` |
| CF Zero Trust | team `mascotas`, AUD `680d4150…b13088` |
| Chatbot worker | `cf-chatbot` (`charlar.madagascarhotelags.com`) |

---

## 17. Testing & rollout gates `[v2 — new]`

The control plane changes runtime behaviour of two production apps, so each phase ships behind a gate.

**Unit / static tests (cf-admin):**
- **Defaults-parity test (critical):** assert every default in `config-schema.ts` equals the current
  hardcoded value in source (Sentry `tracesSampler` thresholds, `sampleRate`, rate-limit table,
  PostHog opts). This guarantees that a missing/empty `service_config` row reproduces today's exact
  behaviour — the fail-safe invariant. Keep this test green forever; it catches drift when someone
  edits a hardcoded fallback without updating the schema (or vice-versa).
- **Bounds + proto-guard:** `ServiceConfigRepository.updateSetting` clamps numbers to
  `[min_value,max_value]`, rejects `__proto__`/`constructor` keys (mirror `PortalSettingsRepository.ts:110`),
  rejects unknown `value_type`.
- **Audit double-write:** every mutation writes both `admin_audit_log` and `service_config_history`.

**Provider preflight (Layer B):** before enabling a write toggle in the UI, call a read endpoint with
the configured token and verify scope (e.g. Sentry `GET /organizations/{org}/` needs `org:read`;
`spike-protections` needs `project:write`; PostHog `GET /api/projects/`; Supabase Management `GET …/health`).
Surface a per-provider "token OK / insufficient scope" badge so Layer B is never a blind 403.

**Fail-safe outage test:** simulate D1 + cache unavailable → `getServiceConfig` returns baked-in
defaults and Sentry/PostHog still initialize. A bad config value must never crash init or a page.

**Rollout canary (already in §9, made explicit):** Phase 2 wires **cf-admin's own** Sentry to config
first and runs in production for a few days (parity test + audit observed) **before** Phase 3 touches
cf-astro. Phase 3 ships the `/api/runtime-config` endpoint + consumer reads behind the per-app
`sentry.*.enabled` / `posthog.enabled` kill-switches so any regression is one toggle away from revert.

**Smoke after each deploy:** hit `/api/runtime-config` (cf-astro) and `/api/dashboard/metrics`
(cf-admin); confirm the JSON reflects the seeded production values; confirm "Purge config cache"
reaches cf-astro (observe a cache-miss → fresh read in logs).

---

## 18. Config versioning, rollback & concurrency `[v2 — new]`

- **Version marker:** add a monotonic `version` (a single-row `service_config_meta(version INTEGER,
  updated_at INTEGER)` bumped on every write, or use `MAX(updated_at)` over `service_config`). Each
  consuming app reads only the version per TTL (one cheap indexed read) and re-pulls the full config
  only when it changes. The version is also stamped into `/api/runtime-config` (`v` field) and audit
  entries for correlation.
- **Rollback:** `service_config_history` already records `old_value`/`new_value` per key. Add a
  "Revert" action (gated by `#edit-sampling`) that writes the previous value back through the normal
  validated path (so it is itself bounds-checked, audited, and version-bumped). Provide a one-click
  **"Reset service to defaults"** that restores `config-schema.ts` defaults.
- **Optimistic concurrency:** `updateSetting` accepts the `updated_at` the editor last saw and updates
  `WHERE key=? AND updated_at=?`; a 0-row result means another admin changed it first → return 409 and
  have the UI refetch. Prevents two admins silently clobbering each other (e.g. during an incident).
- **Blast-radius guard for sampling:** when a Layer-A rate is lowered below a threshold (e.g. error
  sample < 1.0 on a low-traffic site), show the "events/day at this rate" estimate (§9 Phase 5) and
  require a `reason` string (stored in history) — cheap protection against accidentally blinding
  observability, the exact failure the 2026-05-13 booking outage came from (`wrangler.toml` note).

---

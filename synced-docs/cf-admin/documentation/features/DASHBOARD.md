---

title: "Dashboard — Real-Data Command Center"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-19
verified_against: [code]
owner: harshil
related_code:
- src/pages/dashboard/index.astro
- src/components/dashboard/DashboardController.tsx
- src/components/dashboard/widgets/ServiceStatusStrip.tsx
- src/components/dashboard/widgets/GscValidationWidget.tsx
- src/components/dashboard/widgets/EventLedgerWidget.tsx
- src/components/ui/MetricCard.tsx
- src/pages/api/dashboard/metrics.ts
- src/lib/analytics/providers/index.ts
- src/lib/analytics/providers/cloudflare.ts
- src/lib/analytics/providers/external.ts
related_docs:
- EMAIL-PORTAL.md
- GSC-AUTO-HEALING-AND-VALIDATION-ENGINE.md
- SEARCH-CONSOLE-SYNC.md
- ../operations/OPERATIONS.md
tags: [feature, dashboard, analytics, cloudflare, supabase, telemetry]
---

# Dashboard — Real-Data Command Center

> **TL;DR (non-technical):** The admin home screen: the live metrics and widgets it shows, where those numbers come from, and which of them are not real.

> **Rewritten 2026-09-19.** This document carried ~200 lines describing the v4.5
> layout of 2026-05-02 — a setup banner, a bento grid, a dual-axis chart, a quota
> monitor, an audit-log feed — inside an `active` doc, with a "historical" label
> that was easy to read past. Those widgets no longer exist and git holds their
> history, so they have been removed rather than re-labelled. What remains
> describes the page as it is today.

**Scope:** the `/dashboard` home page and the analytics provider layer behind it.

---

## 0. What the dashboard renders today

`src/pages/dashboard/index.astro` mounts one island,
`DashboardController.tsx`, `client:only="preact"` and **props-free** — the page
performs no database query of its own.

| Layer | What is rendered | Source |
|---|---|---|
| Command bar | Title, live sync indicator ("Live Stream Active" / "Syncing…" + last sync time), Refresh Telemetry button | `DashboardController.tsx` |
| KPI deck | 4 `MetricCard`s: Global Edge Network (requests, bandwidth, uptime, sparkline), Data Layer & Cache (pool + buffer-cache ratio bar), Edge Worker Scripts (count, P50, errors, isolate-health bar), Transactional SMTP (sent / 9,000 bar) | `DashboardController.tsx`, `src/components/ui/MetricCard.tsx` |
| Tabs (segmented control) | Overview · Search Console · Edge Workers · Database Pool · Quotas & Storage | `DashboardController.tsx` |
| Overview tab | "Service Health Matrix" = `ServiceStatusStrip` (**8** mini-cards: Network, D1 DB, Google SEO, Security, Brevo, Sentry, Observability, Queues) → `GscValidationWidget` (fetches its own report) → 7/12 `WidgetEdgeCompute` + 5/12 `EventLedgerWidget` | `widgets/*.tsx` |
| Edge Workers tab | `WidgetEdgeCompute` (`CloudflareWidgets.tsx`) — searchable fleet console: full script names, role tags, humanised durations | |
| Database Pool tab | `WidgetPostgresCluster` (`SupabaseWidgets.tsx`) with 4 tabs: Vitals, Engine I/O, Capacity, Auth | |
| Quotas & Storage tab | 2 cards: Brevo `{sent} / 9,000` and R2 objects / volume | |
| Event ledger | Section A: telemetry events (routing, pool & cache, email engine, isolates); Section B "Edge Ingress & D1 Engine": cache-hit ratio, D1 read / write queries, cached bandwidth | `widgets/EventLedgerWidget.tsx` |

Tab ids are `overview`, `seo`, `edge`, `postgres`, `quotas`. There is no System
Health tab and no Audit Log tab.

### 0.1 Values on this page that are not measurements

*Added 2026-09-19. These are **code** defects against RULE #0.5, not wording
problems, and they are logged in [`../MAINTENANCE.md`](../MAINTENANCE.md). They
are recorded here because anyone reading a number off this page needs to know
which ones mean nothing.*

| Where | What is shown | What it actually is |
|---|---|---|
| KPI deck — Transactional SMTP | `99.8% Delivery · TLS Verified` | A literal string. No provider computes a delivery rate. |
| KPI deck — Edge Worker Scripts | P50 `1.2 ms` | The fallback when no worker script has data; not a measurement. |
| KPI deck — Global Edge Network | `100.0%` uptime | The fallback when the status-code series is empty. |
| KPI deck — Data Layer & Cache | `100.0%` cache-hit ratio | Same: the fallback when Supabase reports nothing. |
| KPI deck — Edge Worker Scripts | "Isolate Health" bar | `100 − errors × 10`, an invented index rather than a reported metric. |
| Service Health Matrix — Google SEO | `100% Pass`, `12h Active`, `3 Failed Errors Healed` | All three are literal text. The live readiness score is **76%**, with 60 of 87 URLs thin — see [`GSC-AUTO-HEALING-AND-VALIDATION-ENGINE.md`](GSC-AUTO-HEALING-AND-VALIDATION-ENGINE.md). The card passes no `isUnconfigured` flag. |
| `GscValidationWidget` header | `12h Auto-Cron Active` badge | A hard-coded string. *Corrected 2026-09-19: this document said the badge was "a label derived from the `gsc-run-interval-hours` setting".* It is not, and the job it names has been off at source since 2026-08-26 and paused in the cron control plane since 2026-09-16 — see [`SEARCH-CONSOLE-SYNC.md`](SEARCH-CONSOLE-SYNC.md). |

Most remaining deck fields fall back to `|| 0`, and **nothing in the KPI deck
reads `_unconfigured`** — so the "never show a fake zero" guarantee described in
[§Architecture Decisions](#_unconfigured-flag-pattern) holds for the provider
layer and some widgets, but not for this deck.

### 0.2 How the data gets there

*Corrected 2026-09-19: this document said "all data (analytics, audit log, user
info) is fetched client-side after mount via the analytics API". There is no audit
log and no user info on this page.*

`DashboardController` calls `GET /api/dashboard/metrics` on mount and then every
**60 seconds** while the page is open. That route calls `fetchAllAnalytics()`,
which:

1. reads a 5-minute KV cache (`telemetry_metrics_cache_v2`) from the `SESSION`
   namespace and returns it on a hit;
2. on a miss, fans out to the eight providers and, on success, writes **two** KV
   keys — the 5-minute cache and a permanent stale copy.

Two KV writes per cache miss matters: the free allowance is ~1,000 writes/day and
this namespace is shared with sessions. A dashboard left open all day costs up to
about 576 of them.

On a Cloudflare-provider failure the route serves the stale copy **with
`timestamp` reset to now**, so the "last sync" clock reads fresh over stale data.

---

## Analytics Provider Architecture

### Provider design

The analytics system uses **8 parallel providers**. Each returns a typed result
object with an optional `_unconfigured` flag. When a token is missing or a fetch
fails, the flag is set instead of throwing. All eight run under
`Promise.allSettled`, so one crashing never affects the others.

### Provider descriptions

1. **Zone HTTP Metrics** — zone-level HTTP analytics from Cloudflare GraphQL (requests, cached, bandwidth, threats, status codes, WAF actions, top countries). Also queries D1 analytics for read/write stats.

2. **Worker Invocation Analytics** — account-level Worker invocation data from Cloudflare GraphQL. CPU/wall times are converted from microseconds to milliseconds. Both worker scripts always appear in output, even with 0 invocations (`WORKER_SCRIPTS` in `src/lib/analytics/providers/cloudflare.ts`).

3. **R2 Bucket Usage** — object count and uploaded bytes from the R2 REST API.

4. **Queue Info** — queue metadata **plus backlog and dead-letter metrics**: consumer count, `backlog_count`, `backlog_bytes`, and the same figures for the `-dlq` queue. *Corrected 2026-09-19: this said "name, consumer count".*

5. **Supabase PostgreSQL Metrics** — Prometheus metrics from Supabase (18+ metrics including tuple activity, cache hit ratio, deadlocks, WAL, disk utilisation).

6. **Supabase Auth Metrics** — total registered users, MAU (derived from `last_sign_in_at`), recent signups (7d), and auth provider breakdown via the Supabase Admin API. These reflect users in Supabase's `auth.users` table (used for DB access); portal authentication itself is Cloudflare Zero Trust.

7. **Sentry** — fetches the **5 most frequent unresolved issues** (`?query=is:unresolved&limit=5&sort=freq`) and sums their **lifetime** `count`. *Corrected 2026-09-19: this said "fetches error event counts", which reads as a windowed count. It is neither windowed nor complete.*

8. **Email Stats** — reads the **latest 100 events** from Brevo (`api.brevo.com/v3/smtp/statistics/events?limit=100`, `src/lib/analytics/providers/external.ts`) and counts `sent`/`delivered` and the bounce variants among them. *(Corrected 2026-08-13 — this said Resend; cf-admin has no Resend call path. See `RULESAd.md` §17.)* *Corrected 2026-09-19: because only 100 events are read, the "Monthly Usage" bar rendered as `{sent} / 9,000` can never exceed 100 and is not a monthly total.*

---

## Bug History — GraphQL Filter Field Names

> **Critical pattern:** Cloudflare GraphQL filter objects use **snake_case field names**, not camelCase. Using the wrong casing causes the filter to be silently ignored, and the query either returns no results or GraphQL returns an errors array (HTTP 200 with errors). Always check for errors after parsing the response body.

**Workers analytics bug:** originally used camelCase filter fields which were silently ignored. Fixed to snake_case datetime filter fields.

**D1 analytics bug:** originally missing the datetime filter entirely — could return all-time data or error. Fixed to include proper datetime scope.

Both providers now also check for GraphQL errors before attempting to read data.

---

## Required Configuration

### API token permissions

A Cloudflare API Token is required with the following permission scopes:

| Permission | Scope | Reason |
|-----------|-------|--------|
| Zone Analytics: Read | Target Zone | HTTP request/bandwidth/threat metrics |
| Workers Scripts: Read | Account | Worker invocation analytics |
| R2 Storage: Object Read | Account | R2 bucket object count & size |
| Queues: Read | Account | Queue consumers, backlog and DLQ metrics |
| Account Analytics: Read | Account | D1 analytics, read through the GraphQL analytics API |

*Corrected 2026-09-19: "Workers KV Storage: Read" was listed for "KV namespace
metadata". No provider calls a KV API — the only KV use on this path is the
telemetry cache, through the binding. The D1 analytics row said "Analytics Engine:
Read"; those figures come from the GraphQL analytics API, not an AE SQL query. The
exact scope name Cloudflare requires for that query has not been re-derived — treat
the last row as indicative.*

### Production secrets

All analytics-related secrets are deployed via Wrangler secret management: the
Cloudflare API token, Supabase keys, Sentry (`SENTRY_AUTH_TOKEN`,
`SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`) and `BREVO_API_KEY`.

---

## Architecture Decisions

### `_unconfigured` flag pattern

Every analytics provider returns a typed object with an optional `_unconfigured`
field. When the API token is missing or a fetch fails, this flag is set instead of
throwing, keeping the distinction between **zero** (real data, no activity) and
**unknown** (no credentials or unreachable endpoint) explicit in the type system.

**The flag is not consistently consumed.** `ServiceStatusStrip` passes
`isUnconfigured` for most of its cards and renders a placeholder; the KPI deck
does not read the flag at all and falls back to invented values instead — see
[§0.1](#01-values-on-this-page-that-are-not-measurements). *Corrected 2026-09-19:
this section previously claimed the UI shows `—` / "Setup Required" rather than
zeros, without qualification.*

### Parallel provider settlement

All 8 providers run in parallel. A single provider failing (network error, 401,
wrong token scope) returns its typed fallback and the rest of the dashboard
continues unaffected.

### GraphQL error checking

After every Cloudflare GraphQL response, the code checks for errors before reading
data. Cloudflare returns HTTP 200 with an errors array when a query is malformed
or a filter field name is wrong — not a non-200 status. Skipping this check causes
silent data loss.

### Component isolation

Each widget is a standalone Preact component receiving analytics data and loading
state as props, so state stays in one place and skeleton states are trivial. One
exception: `GscValidationWidget` fetches its own validation report.

### No new dependencies

The overhaul used only existing approved dependencies: CSS for progress
animations and native `fetch` for all API calls. No third-party chart library —
`uplot` is **not** in `package.json` and is not used.

---

## Known Limitations

1. **KV operation counts** — Cloudflare does not expose KV reads/writes via any REST or GraphQL API, so they are not shown rather than shown as permanently N/A.

2. **Supabase Auth API limitations** — we fetch `per_page=1000` to do localised counts for provider breakdown, MAU and recent signups. Above 1,000 users this would need pagination or the dedicated Analytics API.

3. **D1 Analytics lag** — Cloudflare's analytics ingest D1 data with roughly a 2-minute lag, so recent write counts are near-real-time, not real-time.

4. **Workers script name matching** — the analytics API returns every script on the account; the provider filters client-side to `WORKER_SCRIPTS`. Renaming a worker in the Cloudflare dashboard requires updating that list.

5. **Supabase Prometheus endpoint** — the privileged metrics endpoint is a non-public API in early/internal use. Supabase could change or restrict it without notice, so the string-parsing logic must fail safely.

6. **Brevo usage bar and the SMTP KPI are not trustworthy** — see [§0.1](#01-values-on-this-page-that-are-not-measurements).

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | `DashboardController.tsx` (KPI fallbacks, 60 s poll, tab ids), `ServiceStatusStrip.tsx` (the static `seo` card), `GscValidationWidget.tsx` (the static badge), `src/pages/api/dashboard/metrics.ts`, `src/lib/analytics/providers/index.ts` (KV cache + stale copy + timestamp rewrite), `external.ts` (Sentry top-5 lifetime sum, Brevo 100-event window), `cloudflare.ts` (queue backlog/DLQ). §0.1 and §0.2 added; the v4.5 historical sections removed; provider, token-scope and `_unconfigured` claims corrected. | The exact Cloudflare token-scope name the GraphQL D1 query needs; the D1 analytics lag figure; the Supabase Prometheus endpoint's stability |
| 2026-09-14 | `DashboardController.tsx`, every file under `src/components/dashboard/widgets/`, `src/pages/dashboard/index.astro`, the provider layer (8 providers, `Promise.allSettled`, `_unconfigured`, snake-case GraphQL filters, `WORKER_SCRIPTS`), `wrangler.toml` crons, `package.json` (no `uplot`) | API-token permission scopes; D1 Analytics lag; Supabase Prometheus endpoint stability |

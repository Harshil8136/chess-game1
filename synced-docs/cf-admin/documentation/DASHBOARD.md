{% raw %}
# Dashboard Overhaul — Real-Data Command Center

**Last updated:** 2026-04-12
**Scope:** `cf-admin` project — Dashboard page and all supporting analytics infrastructure

---

## What Was Built

The `cf-admin` dashboard was overhauled from a mostly-static layout showing zero data into a **live infrastructure command center** that reads from every active Cloudflare binding and Supabase service.

### Before
- ~6 bento cards with hardcoded or zero values
- Chart had fixed width (caused overflow)
- SystemHealthBar had hardcoded "operational" entries regardless of reality
- Analytics provider had 4 providers only
- No Workers analytics, no R2 usage, no Queue info, no Supabase Auth/GoTrue metrics
- No distinction between "token missing" and "genuine zero value"

### After
- **10 live services** in SystemHealthBar, all derived from analytics data
- **8 parallel analytics providers** via parallel settlement (never crashes if one fails)
- **`_unconfigured` flag pattern** on every provider — UI shows `—` / "Setup Required" instead of zeros when token is missing
- **Dismissible setup banner** when API token is not configured
- **ResizeObserver** drives chart width responsively
- **2-column bento grid** replaces old fixed layout — collapses to 1-column on narrow viewports

---

## Current Dashboard Layout (Top → Bottom)

The dashboard is composed of the following visual rows, from top to bottom:

1. **Setup Banner** — Amber, dismissible — only visible if analytics token is missing
2. **Dashboard Header** — "Overview" title + Health Orb Dropdown + Refresh Button
3. **Row 1 (2-column):** Cloudflare Workers (cf-admin vs cf-astro) | Usage Limits (6 quota cells, 3-col grid)
4. **Row 2 (2-column):** Edge Analytics 24h chart (responsive) | Supabase Cluster (Tabbed Widget: PostgreSQL Performance + GoTrue Auth)
5. **Storage & Queues** — Full-width (R2 + D1 + Email Queue)
6. **Quick Actions** — Full-width action buttons
7. **Audit Log Feed** — Full-width, 8 recent entries

**Note:** The former "Business Engine" ticket card and standalone `DatabaseMetricsWidget` were removed. Analytics are now consolidated. Active Application Users is displayed contextually within the Supabase Auth tab.

---

## Analytics Provider Architecture

### Provider Design

The analytics system uses **8 parallel providers**. Each provider returns a typed result object with an optional `_unconfigured` flag. When a token is missing or a fetch fails, this flag is set instead of throwing.

All 8 providers run in parallel using `Promise.allSettled`. A single provider crashing never affects others.

### Provider Descriptions

1. **Zone HTTP Metrics** — Fetches zone-level HTTP analytics from Cloudflare GraphQL (requests, cached, bandwidth, threats, time-series for the chart). Also queries D1 analytics for read/write stats.

2. **Worker Invocation Analytics** — Fetches account-level Worker invocation data from Cloudflare GraphQL. CPU/wall times are converted from microseconds to milliseconds. Both worker scripts always appear in output, even with 0 invocations.

3. **R2 Bucket Usage** — Fetches object count and uploaded bytes from the R2 REST API.

4. **Queue Info** — Fetches queue metadata (name, consumer count) from the Cloudflare REST API.

5. **Supabase PostgreSQL Metrics** — Fetches Prometheus metrics from Supabase (18+ metrics including tuple activity, cache hit ratio, deadlocks, WAL, and disk utilization).
6. **Supabase Auth (GoTrue)** — Fetches total registered users, MAU (derived directly from `last_sign_in_at`), recent signups (7d), and auth provider breakdown using the GoTrue Admin API.

7. **Sentry Error Count** — Fetches error event counts from the Sentry API.

8. **Resend Email Stats** — Fetches email delivery stats (sent vs bounced) from the Resend API.

---

## Bug History — GraphQL Filter Field Names

> **Critical pattern:** Cloudflare GraphQL filter objects use **snake_case field names**, not camelCase. Using the wrong casing causes the filter to be silently ignored, and the query either returns no results or GraphQL returns an errors array (HTTP 200 with errors). Always check for errors after parsing the response body.

**Workers analytics bug:** Originally used camelCase filter fields which were silently ignored. Fixed to snake_case datetime filter fields.

**D1 analytics bug:** Originally missing datetime filter entirely — could return all-time data or error. Fixed to include proper datetime scope.

Both providers now also check for GraphQL errors before attempting to read data.

---

## Component Details

### Workers Widget
- When unconfigured → renders a "Workers Analytics Unavailable" setup state
- When loading → skeleton spans inside each worker card
- Display map controls name and accent color per script
- Error rate calculated as errors / requests percentage, shown in red when > 0
- 4 stats per card: Requests (24h), Errors, CPU p50, CPU p99 (all in ms)

### Storage Widget
**Three sections (separated by dividers):**
1. **R2 Images** — object count + formatted bytes vs 10 GB limit
2. **D1 Database** — read queries, write queries, rows read, rows written
3. **Email Queue** — green status dot, queue name, consumers count

Renders full-width using the teal-tinted bento card variant.

### Supabase Cluster Widget (formerly SupabaseAuthWidget)
**Tabbed Layout:**
- **Tab 1: PostgreSQL Performance** — Comprehensive performance overview including a 4-column load/RAM/connections grid, prominent Buffer Cache Hit Ratio bar, transaction counters (commits, rollbacks, deadlocks), tuple activity, and disk/WAL utilization bars. Progress bar against 500 MB plan limit.
- **Tab 2: GoTrue Auth** — Total Registered, Active Now (24h) with pulse dot, MAU (30d), and Recent Signups (7d). Includes an Auth Provider Breakdown horizontal bar chart showing Google/Email/Phone/etc identities.

### Quota Monitor Widget
**Layout:** 3-column grid, 6 entries in 2 rows. Each cell contains a colored dot, service name, metric label, percentage badge, 4px progress bar, and value/limit in monospace.

**6 Quota Cells:**

| Service | Metric | Limit |
|---------|--------|-------|
| Workers | Requests | 100,000 / day |
| D1 | Rows read | 5,000,000 / day |
| D1 | Rows written | 100,000 / day |
| R2 | Storage | 10 GB |
| Supabase | DB size | 500 MB |
| Auth | MAU | 50,000 |

**KV entries removed** — Cloudflare does not expose KV operation counts via any API.

When unconfigured → progress bar shows striped pattern, value area shows "Token required".

### System Health Bar
**10 Services and their status logic:**

| Service | Operational | Degraded | Outage | Unknown |
|---------|-------------|----------|--------|---------|
| API Gateway | error rate ≤ 1% | 1–5% | > 5% | workers unconfigured |
| cf-astro Worker | error rate ≤ 1% | 1–5% | > 5% | workers unconfigured |
| Database (D1) | configured | — | — | unconfigured |
| Session KV | always operational | — | — | never unknown |
| R2 Storage | configured | — | — | unconfigured |
| Email Queue | queue present | — | — | queue absent |
| Supabase DB | cpuLoad ≤ 2 AND cacheHitRatio ≥ 0.90 AND ramUsedPct ≤ 0.90 | cpuLoad > 2 OR cacheHitRatio < 0.90 OR ramUsedPct > 0.90 | deadlocks > 0 OR cpuLoad > 4 | unconfigured |
| GoTrue Auth | configured | — | — | unconfigured |
| Resend Email | configured | — | — | unconfigured |
| Sentry | configured | — | — | unconfigured |

**Overall label logic:**
- Any outage → "Partial Outage"
- Any degraded → "Degraded"
- All known operational → "All Systems Operational"
- No known statuses → "Awaiting Data"

### Dashboard Controller
The main orchestrator Preact island receives initial SSR data (active users count, recent audit activity, user RBAC level). Global welcome messages have been purged for a true "Command Center" aesthetic.

**Responsive chart:** Uses ResizeObserver to dynamically adjust chart width to match container dimensions.

**Setup banner:** Displayed only when analytics are not loading, the Cloudflare token is missing, and the user hasn't previously dismissed the banner.

---

## CSS Architecture

### Layout Classes
- **2-column bento row** — collapses to 1-column at ≤1100px viewport
- **Workers split** — 2-column side-by-side cards (collapses to 1-column at ≤640px)
- **Quota grid** — 3-column grid with cubic-bezier animated progress bars
- **Gradient variants** — blue-tinted (Workers), teal-tinted (Storage), amber/green-tinted (Quota), green-tinted (Supabase)

### Health Bar Visual States
- Green = Operational | Amber = Degraded | Red = Outage | Gray = Unknown
- Animated pulse on active status dots

### Removed
- All "Business Engine" ticket card CSS was deleted when the card was removed

---

## Required Configuration

### API Token Permissions

A Cloudflare API Token is required with the following permission scopes:

| Permission | Scope | Reason |
|-----------|-------|--------|
| Zone Analytics: Read | Target Zone | HTTP request/bandwidth/threat metrics |
| Workers Scripts: Read | Account | Worker invocation analytics |
| Workers KV Storage: Read | Account | KV namespace metadata |
| R2 Storage: Object Read | Account | R2 bucket object count & size |
| Queues: Read | Account | Queue consumer count |
| Analytics Engine: Read | Account | D1 analytics |

### Production Secrets
All analytics-related secrets must be deployed via Wrangler secret management. This includes tokens/keys for Cloudflare API, Supabase, Sentry, and Resend.

---

## Architecture Decisions

### `_unconfigured` Flag Pattern
Every analytics provider returns a typed object with an optional `_unconfigured` field. When the API token is missing or a fetch fails, this flag is set to `true` instead of throwing. The UI renders `—` or a "Setup Required" state rather than `0` or crashing. This keeps the distinction between **zero** (real data, no activity) and **unknown** (no credentials or unreachable endpoint) explicit in the type system.

### Parallel Provider Settlement
All 8 analytics providers run in parallel. A single provider failing (network error, 401, wrong token scope) returns its typed fallback and the rest of the dashboard continues unaffected.

### GraphQL Error Checking
After every Cloudflare GraphQL response, the code checks for errors before reading data. Cloudflare returns HTTP 200 with an errors array when the query is malformed or a filter field name is wrong — not a non-200 status. Skipping this check causes silent data loss.

### Component Isolation
Each widget is a standalone Preact component receiving analytics data and loading state props. No widget fetches its own data. All data flows from the dashboard controller after a single API call. This keeps state in one place and makes skeleton loading states trivial.

### Active App Users Source
Active users is the only SSR-sourced metric on the dashboard — it comes from a D1 query counting distinct users in the audit log over the last 24 hours. This is intentional: D1 can be queried server-side at page load for near-instant first paint without waiting for the client-side analytics fetch.

### No New Dependencies
The entire overhaul uses only existing dependencies: uplot for charts, CSS for quota bars and progress animations, native `fetch` for all API calls.

### Dual-Axis Edge Analytics Chart
- Upgraded to a highly dense **Dual-Axis Chart**.
- **Left Axis**: Total Requests (Cyan) and Cached Requests (Deep Blue) for Cache Hit metrics visualization.
- **Right Axis**: Bandwidth / Data Transfer in auto-scaled units (Magenta), independently scaled.
- **Midnight Slate integration**: Custom CSS applied for glassmorphic legend transparency on dark backgrounds.

### Bento Grid System
2-column grid is the primary layout primitive — a simple equal-width grid per row. Each row is independent so column counts can differ, responsive collapse is per-row, and no item unexpectedly spans across sections.

---

## Verification Checklist

After adding environment tokens and restarting the dev server:

- [ ] Dashboard loads without JavaScript errors in browser console
- [ ] Setup banner does NOT appear (tokens configured)
- [ ] SystemHealthBar shows 10 services with colored status dots (not all gray)
- [ ] WorkersWidget shows two side-by-side cards for both workers
- [ ] WorkersWidget cards show non-zero request counts
- [ ] UsageLimits widget shows 3-column grid with 6 cells and real percentage fills
- [ ] SupabaseClusterWidget shows real total registered users and MAU
- [ ] SupabaseClusterWidget "Active Now (24h)" row shows non-zero if any admin logins today and the pulse dot appears
- [ ] StorageWidget shows R2 object count and D1 query metrics
- [ ] Edge Analytics chart renders and resizes with browser window (no fixed-width overflow)
- [ ] Audit Log shows 8 entries
- [ ] At narrow viewport: all 2-column rows collapse to single column cleanly

**Without tokens (graceful degradation):**
- [ ] Setup banner appears with amber styling and dismiss × button
- [ ] All CF-dependent values show `—` instead of `0`
- [ ] WorkersWidget shows "Workers Analytics Unavailable" setup state
- [ ] Quota cells with missing tokens show striped bar + "Token required"
- [ ] SystemHealthBar shows CF-dependent services as gray "unknown" dots
- [ ] No uncaught JavaScript errors

---

## Known Limitations

1. **KV operation counts** — Cloudflare does not expose KV reads/writes via any REST or GraphQL API. These entries have been removed rather than shown as permanently N/A.

2. **Supabase Auth API limitations** — We fetch `per_page=1000` to do localized counts for provider breakdown, MAU, and recent signups. For projects with >1000 users, this would need pagination logic or dedicated Analytics API integration.

3. **D1 Analytics lag** — Cloudflare's Analytics Engine ingests D1 data with ~2-minute lag. Quota bars reflect recent but not real-time write counts.

4. **Workers script name matching** — The analytics API returns all scripts on the account. The provider filters client-side to known script names. If a worker is renamed in the Cloudflare dashboard, update the script list in the provider configuration.

5. **Supabase Prometheus endpoint** — The privileged metrics endpoint is a non-public API. It provides 20+ crucial infrastructure metrics, but since it's in early beta/internal use, Supabase could change or restrict it without notice. String parsing logic must fail safely.

{% endraw %}

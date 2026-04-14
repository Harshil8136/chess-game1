# Dashboard Overhaul — Real-Data Command Center

**Last updated:** 2026-04-12
**Scope:** `cf-admin` project — `/dashboard` page and all supporting analytics infrastructure

---

## What Was Built

The `cf-admin` dashboard was overhauled from a mostly-static layout showing zero data into a **live infrastructure command center** that reads from every active Cloudflare binding and Supabase service.

### Before
- ~6 bento cards with hardcoded or zero values
- uplot chart had `width: 600` hardcoded (caused overflow)
- SystemHealthBar had 5 hardcoded "operational" entries regardless of reality
- Analytics provider had 4 providers (Cloudflare zone, Supabase PG metrics, Sentry, Resend)
- No Workers analytics, no R2 usage, no Queue info, no Supabase Auth/GoTrue metrics
- No distinction between "token missing" and "genuine zero value"

### After
- **10 live services** in SystemHealthBar, all derived from analytics data
- **8 parallel analytics providers** via `Promise.allSettled` (never crashes if one fails)
- **`_unconfigured` flag pattern** on every provider — UI shows `—` / "Setup Required" instead of zeros when token is missing
- **Dismissible setup banner** when `CLOUDFLARE_API_TOKEN` is not in env
- **ResizeObserver** drives chart width responsively
- **`bento-row-2col` grid** replaces old fixed layout — collapses to 1-column at ≤1100px

---

## Current Dashboard Layout (Top → Bottom)

```
┌─────────────────────────────────────────────────────────────┐
│  Setup Banner (amber, dismissible — only if token missing)  │
├─────────────────────────────────────────────────────────────┤
│  Dashboard Header                                           │
│  "Overview" title + Health Orb Dropdown + Refresh Button    │
├──────────────────────────┬──────────────────────────────────┤
│  Cloudflare Workers      │  Usage Limits                    │
│  cf-admin vs cf-astro    │  6 quota cells, 3-col grid       │
├──────────────────────────┼──────────────────────────────────┤
│  Edge Analytics (24h)    │  Supabase Platform               │
│  responsive uplot chart  │  GoTrue Auth + 3-col PG Metrics  │
│                          │  + Active App Users              │
├─────────────────────────────────────────────────────────────┤
│  Storage & Queues (full-width)                              │
│  R2 + D1 + Email Queue                                      │
├─────────────────────────────────────────────────────────────┤
│  Quick Actions                                              │
├─────────────────────────────────────────────────────────────┤
│  Audit Log Feed (full-width, 8 entries)                     │
└─────────────────────────────────────────────────────────────┘
```

**Note:** The "Business Engine" ticket card was removed. Its only real stat ("Active Application Users") was moved into `SupabaseAuthWidget` where it is more contextually relevant alongside Auth and MAU data. `sessionCount` was also removed from the SSR query in `index.astro` as it had no remaining consumer.

---

## Files Modified / Created

### New Files

| File | Purpose |
|------|---------|
| `src/components/dashboard/WorkersWidget.tsx` | Side-by-side cf-admin vs cf-astro workers metrics |
| `src/components/dashboard/StorageWidget.tsx` | R2 + D1 + Email Queue combined card |
| `src/components/dashboard/SupabaseAuthWidget.tsx` | GoTrue Auth + PostgreSQL metrics + Active App Users |
| `src/components/dashboard/QuotaMonitorWidget.tsx` | 6-entry quota grid (2-column layout) |

### Modified Files

| File | What Changed |
|------|-------------|
| `src/lib/analytics/providers.ts` | Complete rewrite — 8 providers, new interfaces; GraphQL filter fixes |
| `src/components/dashboard/DashboardController.tsx` | New layout, ResizeObserver chart, setup banner, Business Engine removed |
| `src/components/dashboard/SystemHealthBar.tsx` | Dynamic service status from analytics data |
| `src/components/dashboard/Dashboard.css` | New grid/quota/worker CSS; business-ticket CSS removed |
| `src/pages/dashboard/index.astro` | Removed `sessionCount` query and hardcoded services; LIMIT 8 audit log |
| `src/env.d.ts` | Added 6 missing secret type declarations |
| `wrangler.toml` | Removed misplaced `CLOUDFLARE_ZONE_ID` from root level |

---

## Analytics Provider Architecture

**File:** `src/lib/analytics/providers.ts`

### Constants (top of file)

```typescript
const CF_ACCOUNT_ID = '320d1ebab5143958d2acd481ea465f52';
const D1_DATABASE_ID = '7fca2a07-d7b4-449d-b446-408f9187d3ca';
const R2_BUCKET_NAME = 'madagascar-images';
const QUEUE_NAME = 'madagascar-emails';
const WORKER_SCRIPTS = ['cf-admin-madagascar', 'cf-astro'] as const;
```

### `AnalyticsMetrics` Interface (complete, accurate)

```typescript
export interface WorkerScript {
  name: string;
  requests: number;
  errors: number;
  subrequests: number;
  cpuTimeP50: number;   // milliseconds (converted from µs in provider)
  cpuTimeP99: number;
  wallTimeP50: number;
  wallTimeP99: number;
}

export interface AnalyticsMetrics {
  cloudflare: {
    requests: number;
    bandwidthBytes: number;
    threats: number;
    cachedRequests: number;
    cachedBytes: number;
    timelines?: {
      requests: number[];
      bytes: number[];
      threats: number[];
      times: string[];
    };
    d1: {
      readQueries: number;
      writeQueries: number;
      rowsRead: number;
      rowsWritten: number;
    };
    _unconfigured?: boolean;
  };
  workers: {
    scripts: WorkerScript[];
    _unconfigured?: boolean;
  };
  r2: {
    objectCount: number;
    uploadedBytes: number;
    _unconfigured?: boolean;
  };
  queue: {
    name: string;
    consumers: number;
    _unconfigured?: boolean;
  } | null;
  supabase: {
    dbSizeBytes: number;
    ramTotal: number;
    ramAvailable: number;
    cpuLoad: number;
    activeConnections: number;
    _unconfigured?: boolean;
  };
  supabaseAuth: {
    totalUsers: number;
    mau: number;
    _unconfigured?: boolean;
  };
  sentry: {
    errorCount: number;
    _unconfigured?: boolean;
  };
  resend: {
    sent: number;
    bounced: number;
    _unconfigured?: boolean;
  };
  timestamp: string;
}
```

### Provider Functions

#### `fetchCloudflare(env)` — Zone HTTP Metrics
- **Endpoint:** Cloudflare GraphQL `https://api.cloudflare.com/client/v4/graphql`
- **Query:** `httpRequests1hGroups` (zone-level, last 24h), filter: `datetime_geq` / `datetime_lt`
- **Data:** requests, cached, bandwidth, threats, time-series for uplot chart
- **Also queries:** `d1AnalyticsAdaptiveGroups` (account-level) for D1 read/write stats — see D1 bug note below
- **Requires:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`
- **Fallback:** `{ ..., _unconfigured: true }` on any error

#### `fetchCloudflareWorkers(env)` — Worker Invocation Analytics
- **Endpoint:** Cloudflare GraphQL, **account-level** (`accounts(filter: { accountTag })`)
- **Dataset:** `workersInvocationsAdaptive`
- **Filter fields:** `datetime_geq` / `datetime_leq` (snake_case — critical, see bug history)
- **Script matching:** Partial name match against `WORKER_SCRIPTS`; keyed by canonical name so multiple time-bucket rows aggregate cleanly
- **CPU/wall times:** API returns microseconds → divided by 1000 → stored as ms
- **Fallback scripts:** Both canonical worker names always appear in output, even with 0 invocations
- **Requires:** `CLOUDFLARE_API_TOKEN`
- **Fallback:** `{ scripts: [], _unconfigured: true }`

#### `fetchCloudflareR2(env)` — R2 Bucket Usage
- **Endpoint:** `GET https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/r2/buckets/madagascar-images/usage`
- **Data:** `result.objectCount`, `result.uploadedBytes`
- **Requires:** `CLOUDFLARE_API_TOKEN`
- **Fallback:** `{ objectCount: 0, uploadedBytes: 0, _unconfigured: true }`

#### `fetchCloudflareQueue(env)` — Queue Info
- **Endpoint:** `GET https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/queues`
- **Finds:** Queue where `queue_name === 'madagascar-emails'`
- **Data:** `name`, `consumers_total_count`
- **Requires:** `CLOUDFLARE_API_TOKEN`
- **Fallback:** `null` (queue section shows unknown in StorageWidget)

#### `fetchSupabase(env)` — PostgreSQL Prometheus Metrics
- **Endpoint:** `GET https://{ref}.supabase.co/customer/v1/privileged/metrics`
- **Auth:** `Authorization: Basic {btoa('service_role:' + token)}`
- **Parsing:** Global `matchAll` Regex scrape of Prometheus text format. This correctly parses multiline values (where Prometheus outputs a schema and value on separate lines).
- **Metrics extracted:** `pg_database_size_bytes`, `node_load1`, `pgbouncer_pools_client_active_connections`, `node_memory_MemTotal_bytes`, `node_memory_MemAvailable_bytes`
- **Also hits:** `GET https://api.supabase.com/v1/projects/{ref}/usage` for backup `database_size`
- **Requires:** `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Fallback:** `{ dbSizeBytes: 0, ramTotal: 0, ramAvailable: 0, cpuLoad: 0, activeConnections: 0, _unconfigured: true }`

#### `fetchSupabaseAuth(env)` — GoTrue User Count + MAU
- **Endpoint:** `GET https://{ref}.supabase.co/auth/v1/admin/users?page=1&per_page=1`
- **Auth:** `apikey: {token}` + `Authorization: Bearer {token}`
- **Total users:** from `data.total` or header `X-Total-Count`
- **MAU:** from `api.supabase.com/v1/projects/{ref}/usage` → `auth_mau` / `monthly_active_users` / `usage.auth_mau`
- **Requires:** `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Fallback:** `{ totalUsers: 0, mau: 0, _unconfigured: true }`

#### `fetchSentry(env)` — Error Count
- **Endpoint:** `GET https://sentry.io/api/0/projects/{org}/{proj}/stats/?stat=received&resolution=1h`
- **Auth:** `Authorization: Bearer {SENTRY_AUTH_TOKEN}`
- **Data:** sum of all `[timestamp, count]` pairs
- **Requires:** `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`
- **Fallback:** `{ errorCount: 0, _unconfigured: true }`

#### `fetchResend(env)` — Email Stats
- **Endpoint:** `GET https://api.resend.com/emails?per_page=100`
- **Auth:** `Authorization: Bearer {RESEND_API_KEY}`
- **Data:** iterates `result.data[]`, counts `status === 'delivered'` and `status === 'bounced'`
- **Requires:** `RESEND_API_KEY`
- **Fallback:** `{ sent: 0, bounced: 0, _unconfigured: true }`

### `fetchAllAnalytics(env)` Orchestration

```typescript
const [cf, wk, r2, qu, sb, sbAuth, sn, rs] = await Promise.allSettled([
  fetchCloudflare(env),
  fetchCloudflareWorkers(env),
  fetchCloudflareR2(env),
  fetchCloudflareQueue(env),
  fetchSupabase(env),
  fetchSupabaseAuth(env),
  fetchSentry(env),
  fetchResend(env),
]);
```

Each settled result uses `status === 'fulfilled' ? result.value : hardcoded_fallback`. A single provider crashing never affects others.

---

## Bug History — GraphQL Filter Field Names

> **Critical pattern:** Cloudflare GraphQL filter objects use **snake_case field names**, not camelCase. Using the wrong casing causes the filter to be silently ignored, and the query either returns no results or GraphQL returns an errors array (HTTP 200 with `{ errors: [...] }`). Always check `result.errors` after parsing the response body.

### Workers analytics — original bug
```graphql
# ❌ Wrong — filter fields ignored, query returns unfiltered or errors
filter: { datetimeStart: $datetimeStart, datetimeEnd: $datetimeEnd }

# ✅ Fixed
filter: { datetime_geq: $start, datetime_leq: $end }
```

### D1 analytics — same bug, also missing datetime filter entirely
```graphql
# ❌ Wrong — no datetime scope; Cloudflare may return all-time data or error
d1AnalyticsAdaptiveGroups(filter: { databaseId: $databaseId }, limit: 100)

# ✅ Fixed
d1AnalyticsAdaptiveGroups(
  filter: { databaseId: $databaseId, datetime_geq: $start, datetime_leq: $end }
  limit: 100
)
```

Both providers also now check `result.errors?.length` and throw/log before attempting to read `result.data`.

---

## Component Details

### WorkersWidget.tsx

**Props:**
```typescript
interface WorkersWidgetProps {
  scripts: WorkerScript[];
  isLoading: boolean;
  unconfigured?: boolean;
}
```

**Behavior:**
- When `unconfigured: true` → renders a "Workers Analytics Unavailable" setup state
- When loading → skeleton spans inside each `WorkerCard`
- `SCRIPT_DISPLAY` map controls display name and accent color per script:
  - `cf-admin-madagascar` → cyan `#22d3ee`, label "cf-admin", desc "Admin Portal"
  - `cf-astro` → violet `#a78bfa`, label "cf-astro", desc "Customer Site"
- Falls back to gray `#8b9ab5` if script name doesn't match any key
- Error rate: `errors / requests * 100`, shown in red when > 0
- 4 stats per card: Requests (24h), Errors, CPU p50, CPU p99 (all in ms)

### StorageWidget.tsx

**Props:**
```typescript
interface StorageWidgetProps {
  analytics: AnalyticsMetrics | null;
  isLoading: boolean;
}
```

**Three sections (separated by dividers):**
1. **R2 IMAGES** — object count + `fmtBytes(uploadedBytes)` vs 10 GB limit label
2. **D1 Database** — read queries, write queries, rows read, rows written
3. **Email Queue** — green status dot, queue name, consumers count

**Renders full-width** (not in a 2-col row — it has no sibling since Business Engine was removed).
**Uses:** `.kv-gradient` bento card variant

### SupabaseAuthWidget.tsx

**Props:**
```typescript
interface SupabaseAuthWidgetProps {
  analytics: AnalyticsMetrics | null;
  isLoading: boolean;
  activeUsers?: number;   // from SSR D1 query in index.astro
}
```

**Constants:**
```typescript
const MAU_LIMIT = 50_000;
const DB_SIZE_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB
```

**`MicroBar` sub-component:** Inline quota progress bar (height 4px). Color: green < 60%, amber 60–80%, red ≥ 80%.

**Sections:**
- **Authentication**
  - Total Users + Monthly Active Users
  - "Active App Users (24h)" — highlighted row sourced from SSR D1 audit log query
  - MAU progress bar has been replaced/simplified.
- **PostgreSQL Edge Cluster**
  - 3-column metric grid: CPU Load, Active Conns, RAM Utilz percentage.
  - DB size progress bar: `dbSizeBytes / 500 MB`
  - Replaces the old loose list with a highly optimized, high-density visualization format.

### QuotaMonitorWidget.tsx

**Props:**
```typescript
interface QuotaMonitorWidgetProps {
  analytics: AnalyticsMetrics | null;
  isLoading: boolean;
}
```

**Layout:** 3-column grid (`quota-grid` with `grid-template-columns: repeat(3, 1fr)`), 6 entries in 2 rows. Each cell (`quota-cell`) contains: colored dot + service + metric label, percentage badge, 4px progress bar, value/limit in monospace. Cells have premium glassmorphic overlays and specular top-border highlights on hover.

**6 Quota Cells (in order):**

| Position | Service | Metric | Limit | Data Source |
|----------|---------|--------|-------|-------------|
| 1 | Workers | Requests | 100,000 / day | `workers.scripts` (sum across all) |
| 2 | D1 | Rows read | 5,000,000 / day | `cloudflare.d1.rowsRead` |
| 3 | D1 | Rows written | 100,000 / day | `cloudflare.d1.rowsWritten` |
| 4 | R2 | Storage | 10 GB | `r2.uploadedBytes` |
| 5 | Supabase | DB size | 500 MB | `supabase.dbSizeBytes` |
| 6 | Auth | MAU | 50,000 | `supabaseAuth.mau` |

**KV entries removed** — Cloudflare does not expose KV operation counts via any API. Including them only added confusion.

**Title:** `Usage Limits` (was "Free Tier Quota Monitor" — "Free" terminology removed throughout)
**Footer:** `Resets daily at 00:00 UTC · Cloudflare & Supabase plan limits`
**Header badge:** `$0 / MO`

When `unconfigured: true` for an entry → progress bar shows striped pattern, value area shows "Token required" in tertiary color.

### SystemHealthBar.tsx

**Props:**
```typescript
interface SystemHealthBarProps {
  analytics?: AnalyticsMetrics | null;
  isLoading?: boolean;
}
```

**10 Services and their status logic:**

| Service | Operational | Degraded | Outage | Unknown |
|---------|-------------|----------|--------|---------|
| API Gateway | error rate ≤ 1% | 1–5% | > 5% | workers unconfigured / script missing |
| cf-astro Worker | error rate ≤ 1% | 1–5% | > 5% | workers unconfigured / script missing |
| Database (D1) | cloudflare configured | — | — | cloudflare unconfigured |
| Session KV | always operational | — | — | never unknown |
| R2 Storage | r2 configured | — | — | r2 unconfigured |
| Email Queue | queue not null | — | — | queue is null |
| Supabase DB | cpuLoad ≤ 2 | cpuLoad > 2 | — | supabase unconfigured |
| GoTrue Auth | supabaseAuth configured | — | — | supabaseAuth unconfigured |
| Resend Email | resend configured | — | — | resend unconfigured |
| Sentry | sentry configured | — | — | sentry unconfigured |

**`deriveServices()` detail:** Worker status uses a closure-captured `const workersUnconfigured = analytics.workers._unconfigured` (extracted before the closure to satisfy TypeScript narrowing inside a nested function).

**Overall label logic:**
- Any outage → "Partial Outage"
- Any degraded → "Degraded"
- All known operational → "All Systems Operational"
- No known statuses → "Awaiting Data"

### DashboardController.tsx

**Props:**
```typescript
interface DashboardControllerProps {
  initialStats: {
    activeUsers: number;      // from D1 SSR query (distinct users last 24h)
    recentActivity: any[];    // from D1 SSR query (last 8 audit log entries)
    userLevel: number;        // RBAC level for QuickActions
  };
}
```

Note: Global welcome messages and "New Report" buttons have been purged for a true "Command Center" aesthetic. The `dashboard-controller` wrapper also applies `zoom: 1.1` to optimally increase visual density without breaking CSS breakpoints on modern high-resolution displays.

**Responsive chart:**
```tsx
const chartContainerRef = useRef<HTMLDivElement>(null);
const [chartWidth, setChartWidth] = useState(560);

useEffect(() => {
  const el = chartContainerRef.current;
  if (!el) return;
  const ro = new ResizeObserver(entries => {
    const w = entries[0]?.contentRect.width;
    if (w > 0) setChartWidth(Math.floor(w) - 2);
  });
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

**Setup banner condition:**
```tsx
const showSetupBanner = !isLoading && cfUnconfigured && !setupDismissed;
```

---

## CSS Classes in Dashboard.css

### Layout
- `.bento-row-2col` — `grid-template-columns: 1fr 1fr`, gap 24px, collapses to `1fr` at ≤1100px
- `.bento-card.workers-gradient` — blue-tinted top border
- `.bento-card.kv-gradient` — teal-tinted variant (StorageWidget)
- `.bento-card.quota-gradient` — amber/green-tinted variant (QuotaMonitorWidget)
- `.bento-card.supabase-gradient` — green-tinted variant (SupabaseAuthWidget)

### Health Bar
- `.health-dot-unknown` — `rgba(255,255,255,0.2)` gray dot
- `.health-dot-pulse` — `dotPulse` keyframe animation (pulsing ring)
- `.health-outage` — red overall badge
- `.health-warn` — amber overall badge
- `.health-ok` — green overall badge
- `.health-unknown` — gray overall badge

### Workers Widget
- `.workers-split` — `grid-template-columns: 1fr 1fr` (collapses to 1fr at ≤640px)
- `.worker-card` — individual script card, dark background, border, 14px gap
- `.worker-card-header` — flex row with dot + name/desc
- `.worker-script-dot` — 10px accent dot with box-shadow glow
- `.worker-script-name`, `.worker-script-desc`
- `.worker-stats-grid` — 2-column stat grid
- `.worker-stat`, `.worker-stat-label`, `.worker-stat-value`
- `.worker-error-rate` — footer row for error rate percentage
- `.workers-setup-state` — centered empty state (flex column, centered)
- `.workers-setup-icon` — icon wrapper for setup state

### Storage Widget
- `.storage-sections` — flex column, gap 20px
- `.storage-section` — individual R2/D1/Queue section
- `.storage-divider` — 1px `rgba(255,255,255,0.06)` separator
- `.storage-section-label` — uppercase 11px label
- `.storage-stat-row` — `justify-content: space-between` flex row
- `.storage-stat`, `.storage-stat-label`, `.storage-stat-value`

### Quota Widget (2-column grid, replaced old vertical list)
- `.quota-grid` — `grid-template-columns: 1fr 1fr`, gap 8px
- `.quota-cell` — compact card with `rgba(255,255,255,0.03)` background, hover highlight
- `.quota-cell-header` — flex row: dot + service + metric + pct badge
- `.quota-cell-dot` — 6px colored dot
- `.quota-cell-service` — 11px bold service name
- `.quota-cell-metric` — 10px tertiary metric label
- `.quota-cell-pct` — 10px monospace percentage badge, colored by threshold
- `.quota-cell-track` — 4px height progress track
- `.quota-cell-fill` — `transition: width 0.8s cubic-bezier(0.34, 1.2, 0.64, 1)`
- `.quota-cell-value` — 10px monospace value/limit display
- `.quota-fill-unknown` — striped `repeating-linear-gradient` for unconfigured cells

**Removed:** `.quota-list`, `.quota-row`, `.quota-row-header`, `.quota-service-dot`, `.quota-service-label`, `.quota-metric-label`, `.quota-track`, `.quota-fill`

### Setup Banner
- `.setup-banner` — amber `border: 1px solid rgba(245,158,11,0.3)`, flex with dismiss ×

### Removed CSS
- `.business-ticket` and all `.business-ticket-*` variants — deleted when Business Engine card was removed

---

## Required Environment Variables

### `.dev.vars` (local development)

```env
# Cloudflare zone + account analytics (Workers, R2, D1, Queues)
CLOUDFLARE_API_TOKEN=<token_from_dash.cloudflare.com>
CLOUDFLARE_ZONE_ID=c73b1ccd7f03999ea419ef8177fa68d4

# Supabase — PostgreSQL metrics + GoTrue Auth
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# Optional — enables Sentry Faults indicator in SystemHealthBar
SENTRY_AUTH_TOKEN=<token>
SENTRY_ORG_SLUG=<org>
SENTRY_PROJECT_SLUG=<project>

# Optional — enables Emails Sent / bounced stats
RESEND_API_KEY=<api_key>
```

### Cloudflare API Token Permissions Required

Create at `dash.cloudflare.com/profile/api-tokens`:

| Permission | Scope | Reason |
|-----------|-------|--------|
| Zone > Analytics: Read | madagascarhotelags.com | HTTP request/bandwidth/threat metrics |
| Account > Workers Scripts: Read | Account | Worker invocation analytics (requests, errors, CPU) |
| Account > Workers KV Storage: Read | Account | KV namespace metadata (future use) |
| Account > R2 Storage: Object Read | Account | R2 bucket object count & size |
| Account > Queues: Read | Account | Queue consumer count |
| Account > Analytics Engine: Read | Account | D1 analytics + future AE SQL queries |

### Production (wrangler secrets)

```bash
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put CLOUDFLARE_ZONE_ID
wrangler secret put PUBLIC_SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SENTRY_AUTH_TOKEN
wrangler secret put RESEND_API_KEY
```

---

## Architecture Decisions

### `_unconfigured` Flag Pattern
Every analytics provider returns a typed object with an optional `_unconfigured?: boolean` field. When the API token is missing or a fetch fails, this flag is set to `true` instead of throwing. The UI renders `—` or a "Setup Required" state rather than `0` or crashing. This keeps the distinction between **zero** (real data, no activity) and **unknown** (no credentials or unreachable endpoint) explicit in the type system.

### `Promise.allSettled` for Providers
All 8 analytics providers run in parallel. A single provider failing (network error, 401, wrong token scope) returns its typed fallback and the rest of the dashboard continues unaffected.

### GraphQL Error Checking
After every Cloudflare GraphQL response, code checks `result.errors?.length` before reading `result.data`. Cloudflare returns HTTP 200 with an `errors` array when the query is malformed or a filter field name is wrong — not a non-200 status. Skipping this check causes silent data loss.

### Component Isolation
Each widget is a standalone Preact component receiving `analytics` + `isLoading` props. No widget fetches its own data. All data flows from `DashboardController` after a single `fetch('/api/dashboard/metrics')` call. This keeps state in one place and makes skeleton loading states trivial.

### Active App Users Source
`activeUsers` is the only SSR-sourced metric on the dashboard — it comes from a D1 query in `index.astro` counting distinct `user_id` values in `admin_audit_log` over the last 24 hours. This is intentional: D1 can be queried server-side at page load for near-instant first paint without waiting for the client-side analytics fetch.

### No New Dependencies
The entire overhaul uses only existing dependencies: uplot for charts, CSS for quota bars and progress animations, native `fetch` for all API calls.

### Dual-Axis Edge Analytics Chart
- Upgraded the default single-axis uPlot chart to a highly dense **Dual-Axis Chart**.
- **Left Axis**: Maps Total Requests (Cyan) and Cached Requests (Deep Blue) to visually display Cache Hit metrics on an overlapping timeline.
- **Right Axis**: Maps Bandwidth / Data Transfer in auto-scaled MBs/GBs (Magenta) independently so it does not flatten the request plots.
- **Midnight Slate integration**: Applied deep custom CSS (`.cf-uplot-theme`) to override uPlot's raw defaults, bringing a glassmorphic blurred `u-legend` to ensure visibility against the dark background.

### Bento Grid System
`bento-row-2col` is the primary layout primitive — a simple `1fr 1fr` grid per row. Each row is independent so column counts can differ across rows, responsive collapse is per-row, and no item unexpectedly spans across sections.

---

## Verification Checklist

After adding `.dev.vars` tokens and restarting `npm run dev`:

- [ ] `http://localhost:4321/dashboard` loads without JavaScript errors in browser console
- [ ] Setup banner does NOT appear (tokens configured)
- [ ] SystemHealthBar shows 10 services with colored status dots (not all gray)
- [ ] WorkersWidget shows two side-by-side cards: cf-admin and cf-astro
- [ ] WorkersWidget cards show non-zero request counts
- [ ] UsageLimits widget shows 2-column grid with 6 cells; real percentage fills for D1/R2/Supabase
- [ ] SupabaseAuthWidget shows real total user count (cross-check with Supabase Dashboard → Auth → Users)
- [ ] SupabaseAuthWidget "Active App Users (24h)" row shows non-zero if any admin logins today
- [ ] StorageWidget shows R2 object count and D1 query metrics
- [ ] Edge Analytics chart renders and resizes with browser window (no fixed-width overflow)
- [ ] Audit Log shows 8 entries from D1 `admin_audit_log`
- [ ] At ≤1100px viewport: all 2-column rows collapse to single column cleanly

**Without tokens (graceful degradation):**
- [ ] Setup banner appears with amber styling and dismiss × button
- [ ] All CF-dependent values show `—` instead of `0`
- [ ] WorkersWidget shows "Workers Analytics Unavailable" setup state
- [ ] Quota cells with missing tokens show striped bar + "Token required"
- [ ] SystemHealthBar shows CF-dependent services as gray "unknown" dots
- [ ] No uncaught JavaScript errors

---

## Known Limitations

1. **KV operation counts** — Cloudflare does not expose KV reads/writes via any REST or GraphQL API. These entries have been removed from QuotaMonitorWidget rather than shown as permanently N/A.

2. **Supabase MAU on free tier** — The `auth_mau` field is typically absent from the Supabase Management API usage endpoint on free plans. MAU will show as 0 unless Supabase exposes this. The GoTrue admin endpoint gives total registered users correctly.

3. **D1 Analytics lag** — Cloudflare's Analytics Engine ingests D1 data with ~2-minute lag. Quota bars reflect recent but not real-time write counts.

4. **Workers script name matching** — `workersInvocationsAdaptive` returns all scripts on the account. The provider filters client-side to `WORKER_SCRIPTS`. If a worker is renamed in the Cloudflare dashboard, update `WORKER_SCRIPTS` in `providers.ts`. The server logs `[Workers Analytics] Raw groups returned:` with all script names on every metrics fetch — check Wrangler console if data appears missing.

5. **Supabase Prometheus endpoint** — `customer/v1/privileged/metrics` is a non-public endpoint. It has worked reliably but Supabase could change or restrict it without notice.

---

## File Tree (dashboard-related)

```
cf-admin/
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       ├── Dashboard.css               # All dashboard styles
│   │       ├── DashboardController.tsx     # Main orchestrator (Preact island)
│   │       ├── SystemHealthBar.tsx         # 10-service live health strip
│   │       ├── WorkersWidget.tsx           # cf-admin vs cf-astro side-by-side
│   │       ├── StorageWidget.tsx           # R2 + D1 + Email Queue (full-width)
│   │       ├── SupabaseAuthWidget.tsx      # GoTrue Auth + PostgreSQL + Active Users
│   │       ├── QuotaMonitorWidget.tsx      # 6-entry 2-column quota grid
│   │       ├── QuickActions.tsx            # Action buttons (existing, unchanged)
│   │       ├── ActivityFeed.tsx            # Audit log list (existing, unchanged)
│   │       └── charts/
│   │           └── UPlotChart.tsx          # Lazy-loaded uplot wrapper
│   ├── lib/
│   │   └── analytics/
│   │       └── providers.ts               # All 8 analytics providers
│   └── pages/
│       └── dashboard/
│           └── index.astro                # SSR page — D1 queries + controller mount
└── documentation/
    └── dashboard-overhaul-2026-04.md      # This file
```

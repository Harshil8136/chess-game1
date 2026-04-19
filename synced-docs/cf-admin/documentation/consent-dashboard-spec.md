{% raw %}
# Consent Records Dashboard Rebuild — Design Spec

> **Date:** 2026-04-17  
> **Codename:** Project Forensic Blue  
> **Scope:** Full rebuild of `/dashboard/privacy/` page components  
> **Stack:** Preact Islands + CSS Tokens + Pure SVG + Astro SSR  
> **Dependencies Added:** None (Lean Edge compliant)

---

## Problem Statement

The current consent records dashboard (`/dashboard/privacy/`) has:
- Static SVG sparkline paths (not data-driven)
- Hardcoded color values (cyan hex instead of Blue-500 design tokens)
- Missing features: 7-day trend charts, bot analysis, daily volume, animated counters
- No status hero panel — just a flat header
- Inline styles in several places
- Inconsistent with the "Midnight Blue" design system

## Goal

Rebuild all 3 privacy dashboard components to match the quality level of the admin-app's `consent-integrity` module, while staying 100% within Lean Edge constraints (zero new deps, <50KB JS, Preact-only).

---

## Architecture

### Files Modified

| File | Action | Description |
|------|--------|-------------|
| `src/pages/api/privacy/logs.ts` | MODIFY | Add `daily_counts`, `last_24h_volume`, `revocation_rate`, `last_consent_date` to metrics |
| `src/components/dashboard/privacy/PrivacyMetrics.tsx` | REWRITE | Status hero panel + 4 data-driven metric cards with SVG sparklines + animated counters |
| `src/components/dashboard/privacy/ForensicFeed.tsx` | REWRITE | Glassmorphic control bar, loading overlay, empty states |
| `src/components/dashboard/privacy/FeedItem.tsx` | REWRITE | 3-panel forensic view, bot analysis, mechanism badge, revocation callouts |
| `src/styles/pages/privacy-dashboard.css` | NEW | Page-level styles using design tokens |
| `src/pages/dashboard/privacy/index.astro` | MODIFY | Import new CSS, minor layout adjustments |

### Data Flow

```
Astro Page (SSR auth guard)
  └─→ PrivacyMetrics (client:idle)
  │     └─→ GET /api/privacy/logs?limit=1
  │           └─→ Supabase: consent_records (aggregate metrics)
  │           └─→ Returns: { metrics: { totalConsents, activeGrants, revocations, daily_counts[], last_24h_volume, revocation_rate, last_consent_date } }
  └─→ ForensicFeed (client:idle)
        └─→ GET /api/privacy/logs?limit=15&offset=0&search=...
              └─→ Supabase: consent_records (paginated, filtered)
              └─→ Returns: { records[], pagination }
                    └─→ FeedItem × N (expandable, inline forensics)
```

---

## Component Specifications

### 1. API Enhancement: `/api/privacy/logs.ts`

Add to the metrics computation:

```typescript
// Daily counts for last 7 days
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const { data: recentRecords } = await supabase
  .from('consent_records')
  .select('created_at')
  .gte('created_at', sevenDaysAgo)
  .order('created_at', { ascending: true });

// Aggregate daily
const dailyCounts = aggregateByDay(recentRecords);

// Last 24h volume
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { count: last24h } = await supabase
  .from('consent_records')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', twentyFourHoursAgo);

// Last consent date
const { data: lastRecord } = await supabase
  .from('consent_records')
  .select('created_at')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

Returns enhanced metrics object with `daily_counts`, `last_24h_volume`, `revocation_rate`, `last_consent_date`.

### 2. PrivacyMetrics.tsx

**Status Hero Panel:**
- Gradient background: `from-surface-1 via-surface-0 to-surface-1`
- Shield icon with pinging live-dot indicator
- "Consent Receipts" title with `[Active]` emerald badge
- Refresh button in header row
- Compliance status text

**4 Metric Cards:**
- Total Receipts (indigo), Active Consents (emerald), Revocations (rose), Last 24h (amber)
- Each card has: icon, title, animated value, subtitle, data-driven SVG sparkline
- Sparklines generated from `daily_counts[]` array → normalized to viewBox
- Animated count-up: `requestAnimationFrame` loop, 800ms duration, ease-out curve
- Hover: glow effect via `box-shadow` transition

**Skeleton loading:**
- 1 hero skeleton (h-24, rounded-2xl, animate-pulse)
- 4 card skeletons in grid (h-[72px], animate-pulse)

### 3. ForensicFeed.tsx

**Control Bar:**
- Sticky top with `backdrop-blur-md`
- "Forensic Feed" section title
- Sync Active indicator (pulsing green dot)
- Search input with icon, focus ring transitions
- Refresh button, record count badge, paginator (◀ 1/N ▶)

**Feed Content:**
- Loading state: centered spinner with "Loading receipts..." text
- Empty state: dashed border card with search icon + message
- Pagination overlay: semi-transparent blur during page transitions
- Footer: "Showing X of Y receipts" with live indicator

### 4. FeedItem.tsx

**Header Row (always visible):**
- Left accent bar (emerald for active, rose for revoked) with gradient + glow
- Shield icon in colored container
- Status badge (ACTIVE/REVOKED) + truncated ID
- Email, timestamp (relative), origin location
- Chevron toggle button with rotation animation

**Expanded Forensic Panels (3-column grid):**

**Panel 1 — Device Context (Indigo):**
- Platform, Screen resolution, Privacy Notice version
- User Agent in monospace code block with copy button
- Indigo gradient background + border

**Panel 2 — Network Registry (Cyan → Blue-500):**
- Region, City from `ip_city`/`ip_country`/`ip_region`
- "IP Not Stored" privacy badge (emerald)
- Consent text hash (SHA-256) in monospace
- Blue gradient background + border

**Panel 3 — Human Proof & Bot Analysis (Rose):**
- Time to Click + Cursor Travel metrics in 2-col grid
- Consent mechanism badge with visual bar
- Bot detection: WebDriver + Headless checks with CLEAN/DETECTED badges
- Revocation note callout (if `revocation_reason` exists)
- Rose gradient background + border

**Expand/collapse animation:**
- Uses existing `.animate-reveal-down` CSS class
- No Framer Motion / no JS animation library

### 5. CSS: `privacy-dashboard.css`

Token-based styles for:
- `.consent-hero` — Status hero panel gradient + glow
- `.consent-metric-card` — Card base with sparkline positioning
- `.consent-sparkline` — SVG sparkline container
- `.forensic-panel` — Forensic expansion panel base
- `.forensic-panel--indigo/blue/rose` — Color variants
- `.detail-row` — Key/value pair rows
- `.bot-check` — Bot detection check items
- `@keyframes count-up` — Counter animation
- `@keyframes pulse-dot` — Live indicator pulse

---

## Constraints Checklist

| Constraint | Status |
|-----------|--------|
| Zero new npm dependencies | ✅ Pure SVG, rAF, CSS keyframes |
| No code copying from admin-app | ✅ Fresh Preact implementations |
| Design tokens only (no hardcoded hex) | ✅ All colors via `var(--color-*)` |
| Lean Edge <50KB JS budget | ✅ No Recharts, no Framer Motion, no date-fns |
| Preact Islands architecture | ✅ `client:idle` hydration |
| RBAC auth guard | ✅ Existing `requireAuth(context, ROLES.SUPER_ADMIN)` preserved |
| Both dark + light theme support | ✅ All tokens are theme-aware |
| No inline styles | ✅ CSS classes + CSS custom properties only |

---

## Date Formatting

Instead of `date-fns` (banned dependency), use a lightweight inline helper:

```typescript
function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
```
{% endraw %}

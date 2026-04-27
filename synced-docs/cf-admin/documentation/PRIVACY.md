{% raw %}
# Data Privacy Dashboard

> **Status:** Production Active (Project Forensic Blue rebuild spec pending)
> **Route:** `/dashboard/privacy/`
> **Access:** SuperAdmin (Level 2) minimum
> **Compliance:** LFPDPPP, GDPR, CCPA

---

## 1. Overview & Access Control

Enterprise-grade forensic auditing interface for the consent records ledger. Provides authorized operators with deep visibility into cookie consent data collected by the public site.

**Access Control:**
- **Minimum Role:** SuperAdmin (Level 2)
- **Hidden Accounts:** DEV and Owner can additionally view audit entries from hidden accounts
- **Sidebar:** Displayed automatically when permitted via PLAC access maps
- **API Defense:** PLAC middleware gate rejects unauthorized users before the route handler executes; API route additionally validates role via KV-cached session

---

## 2. Data Architecture

### Database Integration

- **D1:** Admin pages registry includes the privacy module (sidebar inclusion, PLAC gating)
- **Supabase `consent_records`:** Anonymous INSERT allowed (public cookie banner on cf-astro), all SELECT/UPDATE/DELETE restricted to `service_role` only
- Pagination designed for 10K+ records/month scaling

### RLS Policy

`consent_records` table:
- **INSERT:** `anon` role (public cookie consent banner on cf-astro)
- **SELECT/UPDATE/DELETE:** `service_role` only

See [SECURITY.md](./SECURITY.md) §10 for the full RLS policy matrix.

---

## 3. Current Dashboard Architecture

### Route Controller (`src/pages/dashboard/privacy/index.astro`)

SSR entry point: auth-gating, Midnight Slate layout, "Security Cyan" section tint. Static Astro boundaries around Preact islands maintain <10ms load times.

### PrivacyMetrics Island (`client:idle`)

Fetches live aggregations from Supabase via `GET /api/privacy/logs?limit=1`:
- Total Interactions, Active Consents, Revocations
- Animated glowing state cards for executive attention

### Forensic Ledger (`src/components/dashboard/privacy/ForensicFeed.tsx`)

- Infinite-scroll-ready, server-side paginated
- "No Blank Loading Screens" policy — `SkeletonBlock` shimmer placeholders
- 4-column metadata header: `Captured`, `Origin`, `Device`, `Analysis`
- Expandable 3-pillar forensic architecture per record:
  - **Client Environment** (Blue) — platform, screen, UA hash
  - **Interaction Telemetry** (Indigo) — time-to-click, cursor travel, consent mechanism
  - **Security & Ledger** (Rose/Emerald) — bot checks, WebDriver, headless detection, revocation notes

---

## 4. Planned Enhancement — Project Forensic Blue

> **Date scoped:** 2026-04-17
> **Status:** Spec complete, implementation pending
> **Goal:** Rebuild to match admin-app `consent-integrity` module quality

### Problem

Current dashboard has static non-data-driven sparklines, hardcoded hex colors (cyan instead of Blue-500 tokens), no 7-day trend charts, no animated counters, no status hero panel, and inline styles inconsistent with the Midnight Slate system.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/api/privacy/logs.ts` | Add `daily_counts`, `last_24h_volume`, `revocation_rate`, `last_consent_date` |
| `src/components/dashboard/privacy/PrivacyMetrics.tsx` | Rewrite: status hero + 4 metric cards with SVG sparklines + animated counters |
| `src/components/dashboard/privacy/ForensicFeed.tsx` | Rewrite: glassmorphic control bar, loading overlay, empty states |
| `src/components/dashboard/privacy/FeedItem.tsx` | Rewrite: 3-panel forensic view, bot analysis, mechanism badges |
| `src/styles/pages/privacy-dashboard.css` | New: page styles using design tokens only |
| `src/pages/dashboard/privacy/index.astro` | Import new CSS, layout adjustments |

### API Enhancement

`GET /api/privacy/logs` extended to return:
```typescript
metrics: {
  totalConsents: number,
  activeGrants: number,
  revocations: number,
  daily_counts: { date: string, count: number }[],   // last 7 days
  last_24h_volume: number,
  revocation_rate: number,
  last_consent_date: string
}
```

### PrivacyMetrics Rebuild

**Status Hero Panel:** Gradient background + shield icon + pinging live-dot + `[Active]` emerald badge + compliance status text.

**4 Metric Cards:**
- Total Receipts (indigo), Active Consents (emerald), Revocations (rose), Last 24h (amber)
- Each: icon, animated value counter (800ms ease-out `rAF` loop), subtitle, data-driven SVG sparkline from `daily_counts[]`
- Hover: glow via `box-shadow` transition

### ForensicFeed Rebuild

- Sticky control bar with `backdrop-blur-md`, search input, sync-active pulsing dot, paginator
- Loading: spinner; Empty: dashed border card; Pagination transitions: semi-transparent blur overlay

### FeedItem Rebuild — 3-Panel Forensic View

| Panel | Color | Contents |
|-------|-------|----------|
| Device Context | Indigo | Platform, screen res, privacy notice version, UA (monospace + copy btn) |
| Network Registry | Cyan → Blue-500 | Region/City, "IP Not Stored" badge, consent hash (SHA-256) |
| Human Proof & Bot Analysis | Rose | Time-to-click, cursor travel, consent mechanism bar, WebDriver/Headless CLEAN/DETECTED badges, revocation note callout |

Expand/collapse uses existing `.animate-reveal-down` CSS class — no animation library.

### Constraints

| Constraint | Requirement |
|-----------|-------------|
| Zero new npm dependencies | Pure SVG, rAF, CSS keyframes |
| No admin-app code copying | Fresh Preact implementations |
| Design tokens only | All colors via `var(--color-*)` |
| JS budget | <50KB (no Recharts, Framer Motion, date-fns) |
| Hydration | `client:idle` |
| Themes | Both dark + light — all tokens are theme-aware |

**Inline date formatting (no date-fns):**
```typescript
function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
```

---

## 5. Cross-References

- **RLS policy for `consent_records`** → See [SECURITY.md](./SECURITY.md) §10
- **PLAC gate documentation** → See [PLAC-AND-AUDIT.md](./PLAC-AND-AUDIT.md)
- **RBAC hierarchy** → See [USER-MANAGEMENT.md](./USER-MANAGEMENT.md)
- **Design tokens** → See [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)

{% endraw %}

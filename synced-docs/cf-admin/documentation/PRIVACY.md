# Data Privacy Dashboard

> **Status:** Production Active — v2 rebuild complete (2026-05-06)
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

## 3. Dashboard Architecture (v2 — Current)

### Shared Types (`src/components/dashboard/privacy/types.ts`)

Single source of truth for all privacy component interfaces:

```typescript
ConsentRecord       — full row shape from consent_records table
FingerprintData     — fingerprint_data JSONB column structure
InteractionProof    — interaction_proof JSONB column structure
ConsentMetrics      — aggregated metrics returned by API
ReceiptsApiResponse — full GET /api/audit/receipts response shape
```

No `any` types anywhere in the privacy module.

### API (`src/pages/api/audit/receipts.ts`)

`GET /api/audit/receipts` — SuperAdmin minimum. Returns:

```typescript
{
  records: ConsentRecord[],          // paginated, searchable
  pagination: { total, globalTotal, limit, offset },
  metrics: {
    totalConsents: number,
    activeGrants: number,
    revocations: number,
    revocationRate: number,          // percentage
    dailyCounts: { date, count }[],  // last 7 days, all gaps filled
    last24hVolume: number,
    lastConsentDate: string | null
  }
}
```

5 parallel Supabase queries (total, granted, revoked, 7-day window, last record) — all lightweight `head: true` counts except the window query.

### Route Controller (`src/pages/dashboard/privacy/index.astro`)

SSR entry point. Auth-gated via `requireAuth(Astro, ROLES.SUPER_ADMIN)`. Mounts both islands with `client:idle`. Section tint: `data-section="cyan"`.

### ConsentMetrics Island (`src/components/dashboard/privacy/PrivacyMetrics.tsx`)

`client:idle` — props-free, self-fetching.

**Page Header:** Shield icon + pinging live-dot + `[Active]` emerald badge + compliance subtitle + refresh button.

**4 Metric Cards in a segmented panel (Linear style):**
| Card | Variant | Icon |
|------|---------|------|
| Total Receipts | indigo | Shield |
| Active Consents | emerald | CheckCircle |
| Revocations | rose | Activity |
| Last 24h | amber | Zap |

Each card:
- `data-mounted` attribute drives mount animation (CSS only — no inline `opacity`/`transform`)
- rAF count-up animation (800ms ease-out cubic)
- Data-driven SVG sparkline using `dailyCounts[]` — smooth quadratic bezier, `currentColor` for both fill gradient and stroke (inherits from variant CSS class)
- All colors via CSS variant selectors `.consent-metric-card--{variant}` — no `colorVar` prop

### ConsentFeed (`src/components/dashboard/privacy/ForensicFeed.tsx`)

`client:idle` — paginated at 15 records/page.

- Glassmorphic control bar: "Audit Ledger" title + pulsing sync badge + search + refresh + record count + paginator
- Three distinct states: skeleton (initial load), loading overlay (pagination), empty state
- Error state with rose styling
- `search` passed as URL param on Enter keypress or refresh

### FeedItem (`src/components/dashboard/privacy/FeedItem.tsx`)

Expandable consent record row. All dynamic state via data-attributes — zero inline styles.

**Data-attribute patterns:**
- `data-revoked={isRevoked}` — on shield icon and status badge (emerald → rose)
- `data-bot-risk={isBotDetected}` — on analysis dot, label, security panel header/body, bot risk label
- `data-safe={safe}` — on individual bot check badges (CLEAN / DETECTED)

**Collapsed row:** Status badge + email + 4-column metadata grid (Captured / Origin / Device / Analysis).

**Expanded 3-panel forensic view:**
| Panel | Color | Contents |
|-------|-------|----------|
| Client Environment | Cyan | Platform, browser, screen res, location, UA (monospace + copy) |
| Interaction Telemetry | Indigo | Notice version, time-to-click, cursor travel px, mechanism bar |
| Security & Ledger | Emerald/Rose | Bot likelihood, WebDriver + Headless checks, SHA-256 hash, revocation note |

Expand/collapse driven by `revealDown` CSS keyframe (0.35s spring).

Full keyboard accessibility: `role="button"`, `tabIndex={0}`, `onKeyDown` Enter/Space handler, `aria-expanded`.

---

## 4. CSS Architecture (`src/styles/pages/privacy-dashboard.css`)

All styles use design tokens — no raw hex values, no hardcoded pixel colors.

**Key patterns:**
- Variant colors: `.consent-metric-card--{variant} .consent-metric-icon/title` selectors
- Data-attribute dynamic states: `[data-revoked="true"]`, `[data-bot-risk="true"]`, `[data-safe="true/false"]`, `[data-mounted="true"]`
- Sparklines: `currentColor` on SVG stroke/fill inherits from variant class
- `consent-feed-list--loading`: border/shadow stripped for skeleton layout

**Keyframes defined:**
- `heroLivePulse` — live-dot beacon on page header
- `dotPulse` — sync badge dot
- `revealDown` — forensic panel expand animation
- `pulse` — skeleton shimmer (via Tailwind)

---

## 5. Cross-References

- **RLS policy for `consent_records`** → See [SECURITY.md](./SECURITY.md) §10
- **PLAC gate documentation** → See [PLAC-AND-AUDIT.md](./PLAC-AND-AUDIT.md)
- **RBAC hierarchy** → See [USER-MANAGEMENT.md](./USER-MANAGEMENT.md)
- **Design tokens** → See [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)

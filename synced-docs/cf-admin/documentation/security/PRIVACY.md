---

title: "Data Privacy Dashboard"
status: active
audience: [ai, technical]
last_verified: 2026-08-13
verified_against: [code]
owner: harshil
tags: []
---

# Data Privacy Dashboard

> **TL;DR (non-technical):** How the platform handles personal data and privacy/consent obligations (GDPR and Mexico's LFPDPPP): what consent is recorded, how data requests are handled, and how the privacy dashboard works.

> **Status:** Production Active — v2 rebuild complete (2026-05-06)
> **Route:** `/dashboard/privacy/`
> **Access:** canonical **Admin** (level 2) minimum — stored as `super_admin`
> **Compliance:** LFPDPPP, GDPR, CCPA

---

## 1. Overview & Access Control

Enterprise-grade forensic auditing interface for the consent records ledger. Provides authorized operators with deep visibility into cookie consent data collected by the public site.

**Access Control:**

- **Minimum Role:** canonical **Admin** (level 2); stored value `super_admin`
- **Elevated visibility:** Vendor Support (level 0, stored `dev`) and Owner can additionally view audit entries from hidden accounts
- **Sidebar:** Displayed automatically when permitted via PLAC access maps
- **API Defense:** PLAC middleware gate rejects unauthorized users before the route handler executes; API route additionally validates role via KV-cached session

---

## 2. Data Architecture

### Database Integration

- **D1:** Admin pages registry includes the privacy module (sidebar inclusion, PLAC gating)
- **Supabase `consent_records`:** INSERT via the dedicated `cf_astro_writer` role (public cookie banner on cf-astro); all SELECT/UPDATE/DELETE restricted to `service_role` only. `anon` has no access — see the RLS Policy note below
- Pagination designed for 10K+ records/month scaling

### RLS Policy

`consent_records` table — verified live via `pg_policies` on 2026-08-13:

- **INSERT:** `cf_astro_writer` (policy `cf_astro_writer_insert`) — the dedicated,
  least-privilege role the public cookie-consent banner on cf-astro writes through.
- **SELECT/UPDATE/DELETE:** `service_role` only.
- **`anon`:** zero policies, zero grants.

> **Corrected 2026-08-13.** This said INSERT was granted to `anon`, which
> contradicted [`SECURITY.md`](./SECURITY.md) §10 ("all anon policies dropped
> 2026-04-29"). Both were partly wrong: `anon` really was dropped, but the
> capability did not disappear — it moved to `cf_astro_writer`, which no
> document mentioned at all. See [`SECURITY.md`](./SECURITY.md) §10.2a.

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

`GET /api/audit/receipts` — canonical **Admin** (level 2) minimum. Returns:

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

SSR entry point. Mounts both islands with `client:idle`. Section tint:
`data-section="cyan"`.

> **Corrected 2026-08-13.** This previously read "Auth-gated via
> `requireAuth(Astro, ROLES.SUPER_ADMIN)`". Two things were wrong:
> `ROLES.SUPER_ADMIN` does not exist in `src/lib/auth/rbac.ts` (the canonical
> ladder has no `SUPER_ADMIN` member), and the page itself calls bare
> `requireAuth(Astro)` with no role argument.
>
> **The page is still gated — just at a different layer.** Access is enforced by
> PLAC in the middleware, from the `admin_pages` row for `/dashboard/privacy`,
> which carries `required_role = 'super_admin'` (the *stored* value; canonical
> **Admin**, level 2). Verified against the live D1 table on 2026-08-13, together
> with its sub-page rows:
>
> | Row | `required_role` (stored) | Canonical |
> |---|---|---|
> | `/dashboard/privacy` | `super_admin` | Admin (2) |
> | `/dashboard/privacy#forensics` | `admin` | Manager (3) |
> | `/dashboard/privacy#export` | `owner` | Owner (1) |
> | `/dashboard/privacy#delete` | `owner` | Owner (1) |

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
- **PLAC gate documentation** → See [PLAC-AND-AUDIT.md](../architecture/plac-and-audit.md)
- **RBAC hierarchy** → See [USER-MANAGEMENT.md](../features/USER-MANAGEMENT.md)
- **Design tokens** → See [DESIGN-SYSTEM.md](../reference/DESIGN-SYSTEM.md)

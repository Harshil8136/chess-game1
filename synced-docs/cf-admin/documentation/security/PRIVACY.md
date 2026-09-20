---

title: "Data Privacy Dashboard"
status: active
audience: [ai, technical]
last_verified: 2026-09-20
verified_against: [code]
owner: harshil
related_docs: [RoPA.md, SECURITY.md, ../architecture/plac-and-audit.md, ../features/USER-MANAGEMENT.md]
related_code: [src/pages/dashboard/privacy/index.astro, src/pages/api/audit/receipts.ts, src/components/dashboard/privacy/FeedItem.tsx, src/styles/pages/privacy-dashboard.css]
tags: [privacy, consent, dashboard, feature]
---

# Data Privacy Dashboard

> **TL;DR (non-technical):** How the Privacy screen in the admin portal works —
> the consent records it reads, the forensic detail it shows per record, and who
> may open it. It is a feature doc for one dashboard page.

> **Scope — read this before citing this document.**
> This is an **implementation doc for the `/dashboard/privacy` surface**. It is
> **not** the platform's privacy posture, **not** a statement of how data
> subjects' rights are handled, and **not** a data-classification scheme — it
> contains no classification tiers, no sensitivity labels and no handling rules,
> and never has. Compliance answers that need those must cite the documents that
> own them:
>
> | You need | Cite |
> |---|---|
> | What personal data exists, why, on what basis, how long | [`RoPA.md`](RoPA.md) |
> | Security controls over that data | [`SECURITY.md`](SECURITY.md) |
> | Data residency and transfers | [`compliance/data-residency.md`](compliance/data-residency.md) |
> | ARCO / data-subject request handling | [`RoPA.md`](RoPA.md) activity C, and cf-astro's ARCO runbook |
> | Retention targets per store | `src/lib/retention-tables.ts`, summarised in [`RoPA.md`](RoPA.md) §2.1 |

> **Status:** Production Active — v2 rebuild complete (2026-05-06)
> **Route:** `/dashboard/privacy/`
> **Access:** canonical **Admin** (level 2) minimum — stored as `super_admin`

---

## 1. Overview & Access Control

Forensic auditing interface over the consent records store. Provides authorized
operators with deep visibility into the cookie-consent data collected by the
public site. "Ledger" appears in the UI title; do not read it as a durability
claim — records here are deletable, see §3.

**Access Control:**

- **Minimum Role:** canonical **Admin** (level 2); stored value `super_admin`
- **Sidebar:** Displayed automatically when permitted via PLAC access maps
- **API Defense:** the middleware PLAC gate rejects unauthorized users before
  the handler runs; `src/pages/api/audit/receipts.ts` then re-checks PLAC for
  `/dashboard/privacy` itself. It calls bare `requireAuth(context)` with **no**
  role argument — the registry row is what sets the floor, so a PLAC grant can
  change who reaches it. *Corrected 2026-09-20; this said the route validated a
  role, and claimed a hidden-account visibility rule that belongs to the logs
  surface and has never existed here.*

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

`any` is used in 12 places across the privacy module (`FeedItem.tsx`, `ForensicFeed.tsx`, `PrivacyMetrics.tsx`, `types.ts`, `receipts.ts`) — counted by the A1 ratchet like everywhere else. *(2026-09-14: this line claimed none.)*

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

7 parallel Supabase queries in one `Promise.all` (the records page plus six metrics: total, granted, revoked, last-24h, 7-day window, last record); the window and last-record queries are full reads, the rest `head: true` counts. Metrics are memoised for 60 s (`METRICS_TTL_MS`); `skipMetrics`, `refresh`, `type` and `intent` query params exist. *(Corrected 2026-09-14.)*

### Route Controller (`src/pages/dashboard/privacy/index.astro`)

SSR entry point. Mounts both islands with `client:load`. Section tint:
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

`client:load` — props-free, self-fetching.

**Page Header:** Shield icon + pinging live-dot + "SOC Active" emerald badge + compliance subtitle + refresh button.

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

`client:load` — paginated at 15 records/page.

- Glassmorphic control bar: "Audit Ledger" title (the shipped UI string) + pulsing sync badge + search + refresh + record count + paginator
- Three distinct states: skeleton (initial load), loading overlay (pagination), empty state
- Error state with rose styling
- `search` passed as URL param on Enter keypress or refresh

### FeedItem (`src/components/dashboard/privacy/FeedItem.tsx`)

Expandable consent record row. State flags (`data-revoked`, `data-bot-risk`, `data-safe`) drive the CSS; computed values (bars, widths, colours) use inline `style` objects, which pass because `style-src` still carries `'unsafe-inline'` — there is no nonce on `style-src`. *(2026-09-14: this said "zero inline styles"; 2026-09-20: it then credited the nonce.)*

**Destructive action — `Delete`.** Each record carries a Delete button, gated on
`canDelete` in the UI and on PLAC `/dashboard/privacy#delete` (Owner) at the API.
It calls `DELETE /api/audit/delete?id=<id>` behind a type-of-confirmation dialog
and **permanently removes a `consent_records` row** — the store the retention
registry calls the primary legal-defense record, and the evidence GDPR Art. 7(1)
requires you to be able to produce.

Known gap, recorded 2026-09-20: **no audit entry names the deleted record.**
`src/pages/api/audit/delete.ts` writes no `auditLog()` call, so the only trace is
the pipeline's generic `api_mutation_attempt` row, which carries the path but not
the query string. After the fact you can tell that someone deleted *something*
here, and who, but not *which record*. Tracked in `../MAINTENANCE.md`.

**Data-attribute patterns:**

- `data-revoked={isRevoked}` — on shield icon and status badge (emerald → rose)
- `data-bot-risk={isBotDetected}` — on analysis dot, label, security panel header/body, bot risk label
- `data-safe={safe}` — on individual bot check badges (CLEAN / DETECTED)

**Collapsed row:** Status badge + email + 4-column metadata grid (Captured / Origin / Device / Analysis).

**Expanded forensic view (4 cards as shipped — 2026-09-14; this table said 3):**

| Panel | Contents |
|-------|----------|
| Client Environment | Platform, browser, screen res, UA (monospace + copy) |
| Session Origin | Location / origin details |
| Interaction Metrics | Notice version, time-to-click, cursor travel px, mechanism bar |
| Security Checks | Bot likelihood, WebDriver + Headless checks, SHA-256 hash, revocation note |

Expand/collapse driven by the `revealDown` CSS keyframe (`privacy-dashboard.css`).

Full keyboard accessibility: `role="button"`, `tabIndex={0}`, `onKeyDown` Enter/Space handler, `aria-expanded`.

---

## 4. CSS Architecture (`src/styles/pages/privacy-dashboard.css`)

Styles use design tokens, with a `#0f172a` fallback and a handful of raw
`rgba(…)` literals left in `privacy-dashboard.css`. *(2026-09-20: the count that
stood here — "three" — was wrong and is dropped rather than replaced; a literal
count in prose goes stale on the next commit.)*

**Key patterns:**

- Variant colors: `.consent-metric-card--{variant} .consent-metric-icon/title` selectors
- Data-attribute dynamic states: `[data-revoked="true"]`, `[data-bot-risk="true"]`, `[data-safe="true/false"]`, `[data-mounted="true"]`
- Sparklines: `currentColor` on SVG stroke/fill inherits from variant class
- `consent-feed-list--loading`: border/shadow stripped for skeleton layout

**Keyframes defined:**

- `heroLivePulse` — live-dot beacon on page header
- `dotPulse` — sync badge dot
- `revealDown` — forensic panel expand animation
- `shimmer-loading` (global.css, 1.8 s) — skeleton shimmer on `.consent-skeleton`

---

## 5. Cross-References

- **What personal data the platform holds, and for how long** → See [RoPA.md](./RoPA.md)
- **RLS policy for `consent_records`** → See [SECURITY.md](./SECURITY.md) §10
- **PLAC gate documentation** → See [PLAC-AND-AUDIT.md](../architecture/plac-and-audit.md)
- **RBAC hierarchy** → See [USER-MANAGEMENT.md](../features/USER-MANAGEMENT.md)
- **Design tokens** → See [DESIGN-SYSTEM.md](../reference/DESIGN-SYSTEM.md)

## 6. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-20 | Scope: what this document is and is not, added at the top because two compliance documents were citing it as evidence of a data-classification scheme it does not contain. The per-record Delete path (`FeedItem.tsx` → `src/pages/api/audit/delete.ts`) and its audit gap, previously undocumented. The `receipts.ts` gate (bare `requireAuth` + PLAC, no role argument) and the removal of the hidden-accounts line, which belonged to the logs surface. The `style-src` reason. The `rgba` count dropped | Live RLS state and live `admin_pages` rows (unchanged since the 2026-09-14 pass); the 10K+/month pagination claim |
| 2026-09-14 | Every path in §1–§4; the five interfaces in `types.ts` (plus `envUrls`, which the response also carries); the `receipts.ts` query fan-out and cache; island directives in `index.astro`; PLAC seeds for `/dashboard/privacy` and its fragments; metric-card, feed and FeedItem behaviour (keyboard handling, `aria-expanded`, data flags); keyframes in `privacy-dashboard.css`; cross-references. Ten corrections above. | Live RLS state; live `admin_pages` rows; the 10K+/month scaling claim |

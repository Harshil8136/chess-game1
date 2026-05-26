# cf-admin Refactoring — Completed Phases (Full Detail)

---

## Phase 1A — SQL Injection Fix in Bookings API ✅

**File:** `src/pages/api/bookings/index.ts` (around line 52-54)

**Bug:** The code was string-concatenating booking IDs into a raw SQL `IN` clause, allowing SQL injection if any booking ID contained SQL metacharacters.

**Before (unsafe):**
```typescript
const ids = finalBookings.map(b => `'${b.id}'`).join(',');
const stmt = env.DB.prepare(`SELECT * FROM admin_booking_state WHERE booking_id IN (${ids})`);
const { results } = await stmt.all();
```

**After (safe — parameterized binding):**
```typescript
const placeholders = finalBookings.map(() => '?').join(',');
const stmt = env.DB.prepare(`SELECT * FROM admin_booking_state WHERE booking_id IN (${placeholders})`);
const { results } = await stmt.bind(...finalBookings.map(b => b.id)).all();
```

**Why this is correct:** Cloudflare D1 parameterized binding sanitizes all values before interpolation. The `?` placeholders are replaced by D1 at the driver level, preventing any injection.

---

## Phase 1B — Rate Limiting on Unprotected Routes ✅

**Pattern source:** `src/pages/api/users/access.ts` (which already had Upstash Redis rate limiting via `getRateLimiter()` from `src/lib/ratelimit.ts`)

**Routes updated:**
1. **`src/pages/api/media/upload.ts`** — already had rate limiting (confirmed, no change needed)
2. **`src/pages/api/audit/export.ts`** — added 5 exports/hour per actor
3. **`src/pages/api/users/manage.ts`** — added 10 req/hour in POST, PATCH, DELETE handlers
4. **`src/pages/api/content/blocks.ts`** — added 30 updates/hour
5. **`src/pages/api/content/reviews.ts`** — added 30 updates/hour
6. **`src/pages/api/content/services.ts`** — added 30 updates/hour (used alias `rlOk` due to name collision with existing `success` variable)

**Pattern used in each route (after requireAuth, before handler logic):**
```typescript
import { getRateLimiter } from '@/lib/ratelimit';

// Inside the handler:
const rl = getRateLimiter(env);
if (rl) {
  const { success: rlOk } = await rl.limit(actor.userId ?? actor.email);
  if (!rlOk) {
    return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'X-RateLimit-Limit': '10', 'Retry-After': '3600' },
    });
  }
}
```

Note: Rate limit responses are kept as raw `new Response()` (not `jsonError`) because they need `X-RateLimit-*` headers that the canonical helpers don't add.

---

## Phase 2A — Delete Dead BookingList.tsx Component ✅

**File deleted:** `src/components/admin/BookingList.tsx` (327 lines)

**Verification:** Grepped entire codebase for any import of `BookingList` — confirmed zero external references. The file only referenced itself. This component was superseded by `BookingDashboard` + `BookingSlideDrawer`.

---

## Phase 2B — Remove Deprecated RBAC Alias Exports ✅

**File:** `src/lib/auth/rbac.ts`

**Deleted lines 133-136:**
```typescript
/** @deprecated Use BREAK_GLASS_EMAILS */ export const SUPER_ADMIN_EMAILS = BREAK_GLASS_EMAILS;
/** @deprecated Use isBreakGlassAdmin */ export const isHardcodedSuperAdmin = isBreakGlassAdmin;
```

**Verification:** Grepped entire codebase for `SUPER_ADMIN_EMAILS` and `isHardcodedSuperAdmin` — confirmed zero imports outside rbac.ts itself.

---

## Phase 2C — /api/system/preview Route Investigation ✅

**File inspected:** `src/pages/api/system/preview.ts`

**Finding:** Grepped codebase for `system/preview` — found it IS used by `src/components/admin/debug/PageRegistryManager.tsx`. Route kept; no deletion.

---

## Phase 2D — @types/react/@types/react-dom Removal Investigation ✅

**Decision:** Attempted removal, but build failures indicated some Preact compat types depend on React type stubs being present. Left installed. This is a known Preact ecosystem quirk.

---

## Phase 3A — Unify All API Response Helpers ✅

**Problem:** The codebase had 3 different patterns for JSON responses across 36 API routes:
1. `src/lib/api.ts` — canonical: `jsonOk`, `jsonError`, `withETag`, `jsonFresh` ✓
2. Local `jsonErr()` / `jsonOk()` duplicates in `manage.ts` and `access.ts`
3. Raw `new Response(JSON.stringify(...))` scattered across ~20 routes

**Solution:** Removed all local duplicates, replaced all raw `new Response()` calls with canonical helpers.

**Files updated (20+ files):**
- `src/pages/api/users/manage.ts` — removed local `jsonErr`/`jsonOk`, added import from `@/lib/api`
- `src/pages/api/users/access.ts` — removed local `SECURITY_HEADERS`/`jsonResponse`, added import
- `src/pages/api/content/blocks.ts` — replaced raw Responses
- `src/pages/api/content/reviews.ts` — replaced raw Responses
- `src/pages/api/content/services.ts` — replaced raw Responses
- `src/pages/api/features/toggle.ts` — full rewrite, 6 raw Responses replaced
- `src/pages/api/users/force-kick.ts` — 5 raw Responses replaced
- `src/pages/api/audit/prune.ts` — 3 raw Responses replaced, removed `any` types
- `src/pages/api/audit/silence.ts` — 6 raw Responses replaced
- `src/pages/api/users/activity.ts` — added `withETag` caching (was missing), fixed `row: any`
- `src/pages/api/media/gallery.ts` — POST responses fixed, typed request body
- `src/pages/api/media/revalidate.ts` — full rewrite, typed throughout
- `src/pages/api/media/upload.ts` — replaced raw Responses, fixed `user: any`
- `src/pages/api/debug-ssr.ts` — added `jsonError`, fixed `err: any`
- `src/pages/api/audit/consent.ts` — DELETE handler `jsonOk`
- `src/pages/api/audit/emails.ts` — DELETE handler `jsonOk`
- `src/pages/api/audit/logs.ts` — DELETE handler `jsonOk`
- `src/pages/api/audit/receipts.ts` — full response standardization
- `src/pages/api/auth/logout.ts` — POST handler `jsonOk`

**Exception:** Rate limit `429` responses kept as raw `new Response()` — they need `X-RateLimit-*` / `Retry-After` headers that `jsonError` doesn't support.

---

## Phase 3B — Merge WidgetShared + WidgetSharedV2 → Single WidgetShared ✅

**Problem:** Two files served similar purposes:
- `WidgetShared.tsx` — had: `formatBytes`, `formatNumber`, `Dot`, `WarningDot`, `UnconfiguredDot`, `Stat`, `SectionHeader`
- `WidgetSharedV2.tsx` — had: `formatBytes`, `formatNumber`, `ModernCard`, `SkeletonBlock`, `DashboardSkeleton`, `EmptyState`, `ModernIcon`, `TrendPill`
- Neither was a superset; they had 5 different and 2 overlapping exports

**Solution:**
1. Added the 5 missing exports (`Dot`, `WarningDot`, `UnconfiguredDot`, `Stat`, `SectionHeader`) to `WidgetSharedV2.tsx`
2. Updated all 4 files importing from `WidgetShared` to import from `WidgetSharedV2`
3. Deleted `WidgetShared.tsx`
4. Renamed `WidgetSharedV2.tsx` → `WidgetShared.tsx`
5. Updated all 15 files that imported from `WidgetSharedV2` to import from `WidgetShared`

**Files that previously imported WidgetShared (now updated):**
- `DataServicesWidget.tsx`, `InfrastructureWidget.tsx`, `IntelliobsWidget.tsx`, `MasterAuditFeed.tsx`

**Files that previously imported WidgetSharedV2 (now updated):**
- `BookingDashboard.tsx`, `UsersRegistry.tsx`, `DashboardController.tsx`, `ActivityTable.tsx`, `CloudflareWidgets.tsx`, `ObservabilityWidgets.tsx`, `ServiceStatusStrip.tsx`, `SupabaseQuickActions.tsx`, `SupabaseWidgets.tsx`

**Result:** One canonical file `src/components/dashboard/widgets/WidgetShared.tsx` containing all shared widget utilities.

---

## Phase 3C/D — Extract getServiceBadgeStyle to Shared Constant ✅

**Problem:** Identical booking service badge color logic existed in two components with slightly different alpha values (0.12 vs 0.15 for background, 0.25 vs 0.3 for border):
- `src/components/admin/bookings/BookingDashboard.tsx` (lines 181-187)
- `src/components/admin/bookings/BookingSlideDrawer.tsx` (lines 132-138)

**Solution:** Created `src/lib/bookings/constants.ts`:
```typescript
export function getServiceBadgeStyle(service: string): { background: string; color: string; borderColor: string } {
  const s = (service || '').toLowerCase();
  if (s === 'relocation') return { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.25)' };
  if (s === 'hotel')      return { background: 'rgba(168,85,247,0.12)', color: '#c084fc', borderColor: 'rgba(168,85,247,0.25)' };
  if (s === 'daycare')    return { background: 'rgba(16,185,129,0.12)', color: '#34d399', borderColor: 'rgba(16,185,129,0.25)' };
  return { background: 'rgba(100,116,139,0.12)', color: '#94a3b8', borderColor: 'rgba(100,116,139,0.25)' };
}
```

Both components now import and use `getServiceBadgeStyle(booking.service)` instead of inline IIFEs. The canonical values use 0.12/0.25 alpha (slightly more subtle than the 0.15/0.3 in the drawer — visually more consistent with the rest of the dashboard).

---

## Phase 3E — Remove Duplicate CmsBlock Interface ✅

**Problem:** `CmsBlock` interface was defined in two files:
- `src/lib/cms.ts:12` — with `type: 'text' | 'image_url' | 'json'` (inline union)
- `src/lib/shared-schema.ts:7` — with `type: CmsContentType` (references shared type alias)

**Solution:**
1. Deleted the `CmsBlock` interface from `cms.ts`
2. Added `import type { CmsBlock } from './shared-schema';` to `cms.ts`
3. `shared-schema.ts` is now the single authoritative source

---

## Phase 3F — Consolidate Date Formatters ✅

**Problem:** Multiple components had their own local `formatDate` functions with the same `en-US` locale formatting.

**Implementations found:**
- `src/components/admin/chatbot/hooks/useChatbotApi.ts:126` — exported `formatDate` (en-US, date+time)
- `src/components/dashboard/privacy/FeedItem.tsx:390` — local `formatDate` (en-US, date+time) — **identical logic**
- `src/components/admin/bookings/BookingSlideDrawer.tsx:28` — local `formatDate` (es-ES, date only) — **kept local** (intentional Spanish locale for Madagascar pet transport context)
- Various inline `toLocaleDateString` calls — kept as-is (single-use, not worth extracting)

**Solution:** Created `src/lib/formatters.ts`:
```typescript
/** Date + time: "Apr 28, 02:15 AM" */
export function formatDateTime(s: string | null | undefined): string { ... }

/** Date only (short): "Apr 28" */
export function formatDateShort(s: string | null | undefined): string { ... }
```

- `FeedItem.tsx` — removed local function, imports `formatDateTime as formatDate` from `@/lib/formatters`
- `useChatbotApi.ts` — replaced local function with re-export: `export { formatDateTime as formatDate } from '@/lib/formatters'`
- All chatbot components that import `formatDate` from `useChatbotApi` continue to work unchanged

---

## Phase 4C — Null Guard on isBreakGlassAdmin() ✅

**File:** `src/lib/auth/rbac.ts`

**Problem:** `isBreakGlassAdmin(email: string)` would throw if called with `null`, `undefined`, or a non-string (TypeScript can't always prevent this at runtime when called from JS contexts or across serialization boundaries).

**Fix:**
```typescript
export function isBreakGlassAdmin(email: string): boolean {
  if (!email || typeof email !== 'string') return false;  // ← added
  const matched = BREAK_GLASS_EMAILS.includes(
    email.toLowerCase().trim() as typeof BREAK_GLASS_EMAILS[number]
  );
  ...
}
```

---

## Phase 4D — Env Validation in createAdminClient() ✅

**File:** `src/lib/supabase.ts`

**Problem:** `createAdminClient()` silently force-cast `env.PUBLIC_SUPABASE_URL as string` even if it was undefined, causing a cryptic error deep inside the Supabase client constructor rather than a clear error at the call site.

**Fix:**
```typescript
export function createAdminClient(env: EnvBindings): SupabaseClient {
  if (!env.PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('[Supabase] Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createSupabaseClient(
    env.PUBLIC_SUPABASE_URL,        // no longer needs `as string`
    env.SUPABASE_SERVICE_ROLE_KEY,  // no longer needs `as string`
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  );
}
```

---

## Phase 4E — Enable verbatimModuleSyntax in tsconfig.json ✅

**File:** `tsconfig.json`

Changed `"verbatimModuleSyntax": false` → `"verbatimModuleSyntax": true`

**Result:** `npx astro check` ran with **0 errors**. There are TypeScript warnings (unused imports, unused variables) but these are pre-existing and are not errors. `verbatimModuleSyntax` itself introduced no new errors — the codebase was already compatible.

---

## Build Verification Throughout

Every phase was followed by `npm run build`. All builds passed with `✓ Complete!` — zero errors. Only pre-existing Sentry auth token warnings appear (these are expected in local dev and unrelated to our changes).

---

## Phase 4A — Eliminate `any` in Core Library Files ✅

### 4A-1: src/lib/cms.ts

**Fix:** Added `import type { D1Database } from '@cloudflare/workers-types'`. Replaced all `db: any` parameters with `db: D1Database`. For D1 query results where TypeScript cannot infer the row type, used the double-cast pattern `as unknown as CmsBlock[]` (required because D1's `.all()` returns `D1Result<Record<string, unknown>>` which cannot be directly cast to a typed array).

### 4A-2: src/lib/analytics/providers.ts

**Fix:** Added a typed generic interface at the top of the file:
```typescript
interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}
```
All `const data: any = await res.json()` calls replaced with `const data = await res.json() as GraphQLResponse<{ viewer: { ... } }>` where each inline type matches the actual GraphQL query shape. All `~27` `any` instances eliminated.

---

## Phase 4B — Eliminate `any` in Key Components ✅

### BookingSlideDrawer.tsx
- `booking: any` prop replaced with `booking: BookingRow` (imported from the new `src/components/admin/bookings/types.ts` — see Phase 5B).

### BotConfig.tsx
- `(e: any)` event handlers replaced with `(e: JSX.TargetedEvent<HTMLInputElement>)` throughout.
- Uses `e.currentTarget.value` (not `e.target.value`) per Preact typed event requirements.

### GalleryManager.tsx
- All `const data: any = await res.json()` replaced with typed API response interfaces defined locally (`GalleryApiResponse`, etc.).

### ReviewsManager.tsx
- Fixed the fetch-then-cast pattern. The correct Preact/TypeScript pattern is:
```typescript
// CORRECT — cast at the json() call:
.then(r => r.json() as Promise<MyType>)
.then(data => {
  // data is typed as MyType here
})

// WRONG — TypeScript strict mode rejects this:
.then((data: MyType) => { ... })
```

---

## Phase 5A — Split ActivityCenter.tsx ✅

**Original file:** `src/components/admin/logs/ActivityCenter.tsx` (1,436 lines)

**New file created:** `src/components/admin/logs/shared.tsx`

`shared.tsx` contains all shared types, utilities, and micro-components used across the log tabs:

**Types exported:** `AuditLog`, `EmailLog`, `ConsentRecord`, `LoginLog`, `Stats`, `TabId`, `TABS` (tab config array)

**Utilities exported:** `formatTimestamp(ts: string): string`, `tryParseJSON(s: string): unknown`, `buildQueryString(params: Record<string, string>): string`

**Micro-components exported:** `JSONViewer`, `DetailPanel`, `TableFooter`

**Result:** `ActivityCenter.tsx` is now a thin orchestrator that imports from `shared.tsx` and renders the appropriate tab based on `activeTab` state. Tab navigation has `role="tablist"`, individual tabs have `role="tab"`, `aria-selected`, `aria-controls`.

---

## Phase 5B — Split BookingSlideDrawer.tsx ✅

**Original file:** `src/components/admin/bookings/BookingSlideDrawer.tsx` (368 lines → ~115 lines)

**New files created:**

| File | Purpose |
|------|---------|
| `src/components/admin/bookings/types.ts` | `BookingPet`, `AdminState`, `BookingRow`, `ConsentRecord`, `EmailLog`, `BookingDetails`, `SERVICE_LABELS`, `PET_TYPE_ICONS` |
| `src/components/admin/bookings/BookingCustomerSection.tsx` | Customer name, email, phone display |
| `src/components/admin/bookings/BookingPetSection.tsx` | Pet profiles, weights, breeds |
| `src/components/admin/bookings/BookingOperationsSection.tsx` | Service type, dates, status badge |
| `src/components/admin/bookings/BookingAuditSection.tsx` | Email audit log for this booking |
| `src/components/admin/bookings/BookingDangerZoneSection.tsx` | Force cancel, delete actions |

`BookingSlideDrawer.tsx` is now ~115 lines — a thin orchestrator that fetches `BookingDetails` and renders the section components.

---

## Phase 5C — Split BotConfig.tsx ✅

**Original file:** `src/components/admin/chatbot/BotConfig.tsx` (480 lines → ~200 lines)

**New files created:**

| File | Purpose |
|------|---------|
| `src/components/admin/chatbot/BotConfigShared.tsx` | `ConfigSection`, `Field`, `InfoIcon` primitives reused across sections |
| `src/components/admin/chatbot/BotConfigThinkingSection.tsx` | `ThinkingConfig` interface + `BotConfigThinkingSection` component |

`BotConfig.tsx` reduced to ~200 lines.

---

## Phase 5D — Split UsersTable.tsx ✅

**Original file:** `src/components/admin/users/UsersTable.tsx` (467 lines → slim orchestrator)

**New files created:**

| File | Purpose |
|------|---------|
| `src/components/admin/users/roleColors.ts` | `getRoleBorderHex`, `getRoleBgGrad`, `getRoleBorderColor`, `getRelativeTime`, `getInitials` |
| `src/components/admin/users/UserTableRow.tsx` | `SortIcon`, `UserAvatar`, `UserTableRow` — full desktop row with accessibility (`aria-sort`, `role="button"`, `onKeyDown`) |
| `src/components/admin/users/UserCardStack.tsx` | Mobile card layout with full accessibility |

`UsersTable.tsx` is now a slim orchestrator importing all three new files.

---

## Phase 5E — Split PageRegistryManager.tsx ✅

**Original file:** `src/components/admin/debug/PageRegistryManager.tsx` (569 lines → significantly reduced)

**New file created:**

| File | Purpose |
|------|---------|
| `src/components/admin/debug/PageRegistryConfirmModal.tsx` | Extracted 150-line confirmation modal |

Edit icon button upgraded from `title=` to `aria-label="Edit Configuration"` during this phase.

---

## Phase 6A — ErrorBoundary Wrappers on Dashboard Widgets ✅

**Finding:** `DashboardController.tsx` already had `<ErrorBoundary>` wrappers around all widget groups. No changes were required — the wrapping was already in place from a prior implementation.

---

## Phase 6B — ErrorBoundary Wrapper on BookingDashboard ✅

**Finding:** `src/pages/dashboard/bookings/index.astro` already imported and rendered `<BookingDashboard>` inside an `<ErrorBoundary sectionName="Booking Dashboard">` wrapper. No changes were required.

---

## Phase 6C — SkeletonBlock Loading States ✅

**File updated:** `src/components/dashboard/SupabaseAuthWidget.tsx`

**Change:** Replaced plain spinner `<div>` elements in both `PostgresTab` and `AuthTab` loading states with `SkeletonBlock` components from `@/components/dashboard/widgets/WidgetShared`. The shimmer placeholders now match the structure of the loaded content.

---

## Phase 7A — Badge Color CSS Variables ✅

**File updated:** `src/styles/themes/dark.css`

**Variables added:**
```css
--color-badge-emerald:        #34d399;
--color-badge-emerald-bg:     rgba(16, 185, 129, 0.15);
--color-badge-emerald-border: rgba(16, 185, 129, 0.3);

--color-badge-amber:          #fbbf24;
--color-badge-amber-bg:       rgba(251, 191, 36, 0.15);
--color-badge-amber-border:   rgba(251, 191, 36, 0.3);

--color-badge-blue:           #60a5fa;
--color-badge-blue-bg:        rgba(59, 130, 246, 0.15);
--color-badge-blue-border:    rgba(59, 130, 246, 0.3);

--color-badge-slate:          #94a3b8;
--color-badge-slate-bg:       rgba(100, 116, 139, 0.15);
--color-badge-slate-border:   rgba(100, 116, 139, 0.3);

--color-badge-red:            #f87171;
--color-badge-red-bg:         rgba(248, 113, 113, 0.15);
--color-badge-red-border:     rgba(248, 113, 113, 0.3);

--color-badge-purple:         #c084fc;
--color-badge-purple-bg:      rgba(192, 132, 252, 0.15);
--color-badge-purple-border:  rgba(192, 132, 252, 0.3);
```

---

## Phase 7B — Consolidate Duplicate Badge CSS Selectors ✅

**File updated:** `src/styles/components/chatbot/buttons-badges.css`

**Before:** `.chatbot-badge-active` and `.chatbot-badge-yes` were separate rules with identical emerald hex values. `.chatbot-badge-escalated` and `.chatbot-badge-no` were separate rules with identical amber hex values.

**After:** All 6 badge selectors consolidated to multi-selector rules using the CSS variables from Phase 7A:
```css
.chatbot-badge-active,
.chatbot-badge-yes {
  color: var(--color-badge-emerald);
  background: var(--color-badge-emerald-bg);
  border-color: var(--color-badge-emerald-border);
}

.chatbot-badge-escalated,
.chatbot-badge-no {
  color: var(--color-badge-amber);
  background: var(--color-badge-amber-bg);
  border-color: var(--color-badge-amber-border);
}
```
(And similarly for blue, slate, red, purple variants.)

---

## Phase 7C — Move Inline Styles to CSS ✅

### 7C-1: src/components/dashboard/StatCard.tsx

**Removed:** 7 inline `style={{}}` objects.

**Added to `src/styles/components/dashboard/DashboardStyles.astro`** (new CSS classes):
- `.stat-card-bg-chart` — background chart area positioning
- `.stat-card-suffix` — suffix text styling

**Augmented existing classes** with extracted static properties:
- `.stat-card-header`, `.stat-card-body`, `.stat-card-value`, `.stat-card-delta`, `.stat-card-title`

**Remaining inline:** Only 2 dynamic mount animation properties (`opacity`, `transform`) that depend on runtime state remain as inline styles — these cannot be extracted to CSS.

### 7C-2: src/components/admin/chatbot/AnalyticsDashboard.tsx

**Removed:** 20+ inline `style={{}}` objects.

**Added 17+ new CSS classes to `src/styles/components/chatbot/stats.css`:**

| Class | Purpose |
|-------|---------|
| `.ad-layout` | Outer flex layout |
| `.ad-section-no-mb` | Section without margin-bottom |
| `.ad-error-indicator` | Error state container |
| `.ad-error-dot` | Animated error dot |
| `.ad-empty-card` | Empty state card |
| `.ad-empty-text` | Empty state text |
| `.ad-pillar-heading` | Section pillar heading |
| `.ad-two-col-grid` | Two-column grid layout |
| `.ad-card-padded` | Card with padding |
| `.ad-card-heading` | Card heading text |
| `.ad-model-row` | Model usage row |
| `.ad-model-header` | Model header row |
| `.ad-model-name` | Model name cell |
| `.ad-model-share` | Model share percentage |
| `.chatbot-bar--model` | Model usage bar |
| `.ad-model-meta` | Model metadata text |
| `.ad-kb-topic`, `.ad-kb-queries`, `.ad-kb-date`, `.ad-kb-add-btn` | Knowledge base table cells |
| `.ad-kb-empty`, `.ad-bar-chart`, `.ad-bar-label`, `.ad-kb-table-wrapper` | KB table layout helpers |

---

## Phase 8A — Accessible Clickable Rows ✅

### BookingDashboard.tsx
Each booking `<tr>` now has:
```tsx
<tr
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrawer(booking); }}
  aria-label={`View booking ${booking.booking_ref}`}
>
```

### ActivityCenter.tsx
Tab container:
```tsx
<div role="tablist" aria-label="Log Categories">
  <button role="tab" aria-selected={activeTab === tab.id} aria-controls={`tab-${tab.id}`}>
```

### UsersTable.tsx (via UserTableRow.tsx)
- Sortable `<th>` elements have `aria-sort={sortField === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}`
- Row `<tr>` has `role="button"`, `tabIndex={0}`, `onKeyDown`

---

## Phase 8B — aria-label on Icon-Only Buttons ✅

**Files updated:**

| File | Change |
|------|--------|
| `src/components/ui/SlideDrawer.tsx` | Close button: `aria-label="Close drawer"` |
| `src/components/admin/chatbot/ConversationsBrowser.tsx` | Modal close (✕): `aria-label="Close"` |
| `src/components/admin/chatbot/KnowledgeBase.tsx` | Modal close (✕): `aria-label="Close"` |
| `src/components/admin/chatbot/PromptsEditor.tsx` | Modal close (✕): `aria-label="Close"` |
| `src/components/admin/debug/PageRegistryManager.tsx` | Edit icon button: `aria-label="Edit Configuration"` (upgraded from `title=`) |
| `src/components/admin/logs/ActivityCenter.tsx` | Export/prune buttons: `aria-label` (upgraded from `title=`) |

All icon elements inside these buttons have `aria-hidden="true"` to prevent screen readers from announcing the icon name.

---

## Final Verification

```
npx astro check  →  0 errors, 0 warnings (new)
npm run build    →  ✓ Complete! — 0 errors
```

All 8 phases complete. The codebase went from ~27 `any` types in core libs, 1,436-line monoliths, ~200 inline style objects, hardcoded hex badge values, and missing ARIA attributes — to a fully typed, componentized, CSS-variable-driven, accessible admin portal.

---

## Phase 9 — Security Lockdown & Codebase Pruning (v4.1) ✅

**Objective:** Conduct a comprehensive defense-in-depth lockdown and shrink the codebase payload ("Lean Edge" budget).

### Phase 9A: Defense-in-Depth Lockdown
- **0 Anon Privileges:** Verified and enforced that the Supabase `anon` role has exactly 0 table grants, 0 RLS policies, and 0 function EXECUTE permissions.
- **Fail-Secure Local Dev:** Hardened `isLocalDev()` in `src/middleware.ts`. If `SITE_URL` is omitted, the application falls back to production behavior (CF Zero Trust enforced) instead of bypassing authentication.

### Phase 9B: Vite Optimization & Dependency Pruning
- **Vite Warning Resolved:** Refactored dynamic `import()` calls for `createAdminClient` into static imports in `src/lib/auth/plac.ts` and `src/pages/api/users/force-kick.ts`, eliminating all Vite build-time warnings during SSR generation.
- **Unused Dependencies Removed:** Removed 6 obsolete packages (`@sentry/cloudflare`, `uplot`, etc.) to shrink the `node_modules` footprint. `zod` was retained for shared schemas.

### Phase 9C: Dead Code & Export Elimination (100% Clean `knip`)
- **Deleted 18+ Legacy Components:** Pruned unused components (e.g., `PageChipGrid`, `RoleAccessCard`, obsolete settings modules, legacy `auth.css`) leftover from the Next.js migration and prior refactoring phases.
- **Unused Export Removal:** Stripped `export` keywords from internal schemas, unused interfaces, and internal utility functions (`src/lib/shared-schema.ts`, `src/lib/chatbot-proxy.ts`, `src/lib/auth/session.ts`) to satisfy static analysis.
- **Verification:** Ran `npx knip` repeatedly until achieving a 100% clean report.

**Final Verification:**
```
npx knip         →  No unused files, dependencies, or exports.
npx astro check  →  0 errors, 0 warnings.
npm run build    →  ✓ Complete! — production ready.
```

---

## Phase 10 — CF Zero Trust ↔ Supabase Visibility Suite ✅

**Objective:** Surface CF Zero Trust data inside the User Registry — connection status, live sessions, unauthorized probe attempts, and per-user login forensics. The CF Access policy is OTP-open (any email can authenticate); the Supabase whitelist is the only authorization gate. This phase added visibility into the gap between who has CF-authenticated and who is whitelisted.

### Phase 10A: CF Status Column (cfLinked / CF Pending)

**Files modified:**
- `src/pages/api/users/index.ts` — Added `cf_sub_id` to SELECT; derived `cfLinked: boolean` server-side; stripped UUID from response
- `src/components/admin/users/types.ts` — Added `cfLinked?: boolean` to `AuthorizedUser`
- `src/components/admin/users/UserTableRow.tsx` — Stacked indicator in Status cell: active/suspended + CF Linked (sky) / CF Pending (amber)
- `src/components/admin/users/UserCardStack.tsx` — CF badge in mobile card badge row

**Constraint:** `cf_sub_id` UUID never sent to client. CF Pending = user invited but never logged in; CF Linked = cf_sub_id populated, Layer 3 force-kick available.

### Phase 10B: Live KV Session Status

**Files created:**
- `src/pages/api/users/[id]/session-status.ts` — super_admin+ auth; lists `user-session:{userId}:*` KV reverse-index; returns count + session metadata (IP, UA, geo, CF Ray ID, lastActiveAt); Ghost Protection at DB boundary
- `src/components/admin/users/sessions/SessionForensicsDrawer.tsx` — 345-line premium HUD drawer: device identity, connection telemetry, 24h countdown, per-session revocation

**Files modified:**
- `src/components/admin/users/ExpandedRow.tsx` — "Check Active Sessions" button (sky) in Command Center; opens SessionForensicsDrawer with full session telemetry

### Phase 10C: Access Probe Feed

**Files created:**
- `src/pages/api/users/probes.ts` — Owner+ auth; D1 query groups unauthorized login attempts by email; returns email/count/last attempt/method/bot score/location
- `src/components/admin/users/AccessProbePanel.tsx` — Collapsible panel below User Registry; shows probe table; "+ Whitelist" button dispatches `modal:open-invite` with pre-filled email

**Files modified:**
- `src/components/admin/users/InviteUserModal.tsx` — `open` handler accepts optional `CustomEvent.detail.email` pre-fill
- `src/pages/dashboard/users/index.astro` — Added `AccessProbePanel` (Owner+, `client:idle`)

**Migration created:** `migrations/0022_login_logs_probe_index.sql` (D1 partial index on `is_authorized_email = 0`)

### Phase 10D: CF Access Audit Cross-Reference

**Files created:**
- `src/pages/api/users/cf-access-audit.ts` — Owner+ auth; parallel fetch: CF Access users list API + Supabase whitelist; cross-references into three groups (linked / awaiting login / CF orphans)
- `src/components/admin/users/CfAuditDrawer.tsx` — `<dialog>` modal; 3-tab interface (Linked / Awaiting Login / CF Orphans); auto-selects Orphans tab if orphans > 0; dispatched by `cf-audit:open` CustomEvent

**Files modified:**
- `src/components/admin/users/RegistryToolbar.tsx` — Added `activeRole` prop; "CF Audit" button (violet) for Owner+ dispatches `cf-audit:open`
- `src/components/admin/users/UsersRegistry.tsx` — Passes `activeRole` down to `RegistryToolbar`
- `src/pages/dashboard/users/index.astro` — Added `CfAuditDrawer` (Owner+, `client:load`)

**Migration created:** `migrations/supabase_0002_cf_status_index.sql` (Supabase partial index on `cf_sub_id IS NOT NULL`)

### Phase 10E: Login Intelligence Panel

**Files created:**
- `src/pages/api/users/[id]/login-history.ts` — Owner+ auth; ghost protection; fetches last 15 login events from `admin_login_logs` by user email + lifetime summary counts; masks IPs for non-dev actors

**Files modified:**
- `src/components/admin/users/ExpandedRow.tsx`:
  - Added `last_login_at` row in Identity Profile column (between Created and CF Identity)
  - Added `LoginHistoryEntry` / `LoginHistoryResponse` interfaces
  - Added `formatRelativeDate`, `MethodBadge`, `BotScoreBadge` helpers
  - Added `loginHistory` state + `handleLoadLoginHistory` callback
  - Added full-width "Login Intelligence" section below the 3-column grid (on-demand, Owner+ only)

**Data shown in Login Intelligence:**
- Outcome (SUCCESS emerald / FAILED|BLOCKED red), Method badge (OTP/Google/GitHub), Location (geo + CF colo), Bot score (color-coded: emerald < 20, amber 20–49, red ≥ 50), CF Ray ID (truncated, full in tooltip), IP (masked), Date (relative)
- Summary: total logins, success count, failure count
- Header shows "Last: Xh ago" from `user.last_login_at` without requiring a fetch

**Final Verification:**
```
npx astro check  →  0 errors, 0 warnings (181 files)
```

Both D1 and Supabase migrations applied via MCP (no deploy required for index-only operations).

---

## Phase 4 (Post-Refactor Audit) — Code Quality & Documentation ✅

**Completed:** 2026-05-02

### Item 2 — ActivityCenter Fetch Timeouts ✅
Added 5-second `AbortController` timeout to all 5 fetch calls in `ActivityCenter.tsx`. Prevents the logs panel from hanging indefinitely when a tab API is slow or the Worker is cold-starting.

### Item 3 — Breadcrumb Accessibility Fix ✅
Changed the current-page breadcrumb from an `<a>` element to a `<span aria-current="page">` in `AdminLayout.astro`. An anchor pointing to the current page is an accessibility anti-pattern.

### Item 4 — Silent Catches in User Management ✅
**Files:** `ExpandedRow.tsx`, `UsersTable.tsx`
- `handleCheckSessions`, `handleLoadLoginHistory`: now set visible error state instead of swallowing exceptions
- `actionError` signal now displayed in `ExpandedRow` action panel
- `handleRoleChange`, `handleSuspend`, `handleDelete` in `UsersTable`: now surface error messages to UI

### Item 5 — cfBotScore Gate ✅ (⛔ N/A)
D1 query confirmed all 23 production `admin_login_logs` rows have `cf_bot_score = null`. Bot Management (`request.cf.botManagementScore`) is not available on the Cloudflare free Workers plan. Gate implementation blocked. Column retained in schema for future paid-plan use.

### Item 8 — DashboardController Props Cleanup ✅
Removed the SSR D1 query from `src/pages/dashboard/index.astro` and all associated props from `DashboardController.tsx`. The controller is now props-free and fetches all data client-side. Eliminates unnecessary server-side D1 query on every dashboard load.

### Item 9 — Pricing Magic Numbers → Named Constants ✅
Replaced hardcoded `286` and `200` in `src/pages/api/content/services.ts` with named constants `DEFAULT_PRICE_DOGS_CATS = 286` and `DEFAULT_PRICE_DAYCARE = 200`.

**Final Verification:**
```
npx tsc --noEmit  →  0 errors
```

---

## Phase 11 — Theme Default Hardening ✅

**Rationale:** First-time visitors with light OS preference were seeing the white theme instead of the canonical Midnight Slate dark theme with cyan/blue ambient orbs.

**Files modified:**
- `public/scripts/theme-init.js` — Removed OS `prefers-color-scheme` auto-detection; dark is now the hardcoded default when no cookie exists
- `src/components/navigation/ThemeToggle.tsx` — Removed `matchMedia` OS preference listener; theme toggles are now purely cookie-based explicit user choice

**Verification:** `astro check` — 0 errors, 0 warnings, 0 hints (223 files)

---

## Phase 12 — 2026-05-25 Deep Security Review Fixes ✅

**Date:** 2026-05-25
**Shipped:** PR #2 → `main` (merge commit `3f8cd78`), 7 atomic commits on `claude/codebase-security-review-LhIkr`.
**Full report:** `documentation/SECURITY-REVIEW-2026-05-25.md`

The 2026-05-25 deep-review pass surfaced 35 new findings on top of the 2026-05-24 review. Phase 12 lands the 2 Critical and 5 High items. 14 Medium + 14 Low items are tracked in `PENDING_PHASES.md` and `ToDoList.md` Section II.

### Commits

| Commit | Severity | Subject |
|---|---|---|
| `d89ceae` | 🔴 Critical (C-2) | `fix(cron): match wrangler's "SUN" cron pattern in scheduled dispatcher` |
| `208bc13` | 🟠 High (H-5) | `refactor(auth): simplify JWKS cache-bust path in CF Access JWT verifier` |
| `7a69d23` | 🟠 High (H-1) | `security(csrf): fix Referer prefix-match bypass` |
| `29c5445` | 🟠 High (H-2) | `security(settings): enforce target-role hierarchy on cross-user edits` |
| `777727b` | 🔴 Critical (C-1) | `security(plac): verify target role from DB; forbid self-modification` |
| `7e04bf4` | 🟠 High (H-3) | `security(audit): forbid DEV self-silencing; preserve session TTL on patch` |
| `8132ec6` | 🟠 High (H-4) | `security(plac): enforce page-level access on highest-risk API routes` |

### C-1 — PLAC bypass via spoofed `targetUserRole` (`src/pages/api/users/access.ts`)

Hierarchy Gates A and B read `targetUserRole` from the request body. An admin (level 3) could send `{ targetUserId: <super_admin_id>, targetUserRole: "staff", action: "revoke", pagePath: "/dashboard/users" }`: Gate A (`3 >= 4`) returned false and passed, Gate B (`isOwnerOrDev('staff')`) returned false and passed, the super_admin lost access. A user previously denied a page via PLAC could also self-grant within their own clearance using the same trick.

**Fix:** Fetch the target's verified `role` and `email` from `admin_authorized_users` on every call. Use those DB-verified values for Gates A and B and the audit log payload. Added Gate E: reject `actor.userId === targetUserId`. `body.targetUserRole` and `body.targetUserEmail` are now informational only.

### C-2 — Asset-cleanup cron never fired (`src/workers/cf-entry.ts`)

`wrangler.toml` triggers Sunday at 02:00 with `"0 2 * * SUN"` (Cloudflare rejects the numeric `0` form per commit `f96c560`), but the dispatcher only matched `"0 2 * * 0"`. CF echoes the original pattern string back on `ScheduledEvent`, so the equality check failed and the weekly handler never ran — R2 was growing without bound.

**Fix:** Dispatcher accepts both `"0 2 * * SUN"` and `"0 2 * * 0"`.

### H-1 — CSRF Referer prefix bypass (`src/lib/csrf.ts`)

`referer.startsWith(siteUrl)` accepted `https://secure.example.com.attacker.com/...` when `SITE_URL` was `https://secure.example.com`. Modern browsers send Origin on cross-origin mutations so the exposure was narrow (some webviews / older clients strip Origin on same-origin redirects), but the bypass was real and easy to fix.

**Fix:** Anchored Referer match — exact equality to the normalized SITE_URL, or a prefix followed by `/`. Origin check unchanged.

### H-2 — Settings cross-user edit ignored target hierarchy (`src/pages/api/settings/user.ts`)

`POST /api/settings/user` accepts `targetUserId` so admins can edit subordinates' theme / display_name. The check verified the editor was admin+ but never looked at the target's role. An admin could rewrite a super_admin's `display_name` (rendered in TopBar, UserTable, ExpandedRow, audit drawers, etc.) — visual impersonation inside the portal.

**Fix:** When `targetUserId` differs from `user.userId`, fetch the target's role from `admin_authorized_users` and reject unless the editor strictly outranks (lower numeric level). DEV remains exempt.

### H-3 — DEV self-silence + KV TTL rejuvenation (`src/pages/api/audit/silence.ts`)

Two issues:
1. A compromised DEV could mute their own audit trail by passing their own `userId`. The silencing entry itself was the only record; subsequent actions left no log.
2. `propagateAuditSilence` wrote every active KV session back with `expirationTtl = SESSION_MAX_LIFETIME` (24h from now), rejuvenating sessions past their `createdAt`-anchored hard expiry. Same bug previously fixed in `patchSession`.

**Fix:** Reject `targetUserId === session.userId` (requires a second DEV). Compute remaining TTL from `session.createdAt`, floor at 60 s; read `SESSION_MAX_LIFETIME_MS` from env instead of hard-coding.

### H-4 — Most API routes bypassed PLAC entirely (`src/lib/auth/guard.ts` + 10 routes)

Astro middleware deliberately skips PLAC for `/api/*` (each route picks its own auth posture). Some routes had ad-hoc PLAC checks; most data-bearing routes relied only on role and ignored explicit denies on the corresponding dashboard page. A super_admin with a PLAC deny on `/dashboard/users` could still call `/api/users/manage`, `/api/users/force-kick`, etc. with full effect.

**Fix:**
- Added `requirePageAccess(user, pagePath)` and `placDenyResponse(user, pagePath)` helpers in `src/lib/auth/guard.ts`. Both honor the deny resolution rules (exact-match → longest-prefix), exempt DEV (break-glass tier), and fall through when no access map exists.
- Wired `placDenyResponse` into the highest-risk routes: all `/api/audit/*` data endpoints (`emails`, `sessions`, `stats`, `logs`, `consent`, `receipts`) + `audit/prune`, plus `users/{manage, force-kick, access-data}`.
- **Bundled:** `access-data.ts` ghost protection — non-DEV actors get 403 when querying a DEV/Owner's PLAC matrix. Closes the back door around the `/api/users` ghost-hiding.
- **Bundled:** `audit/prune.ts` `days` parameter is NaN-safe and bounded to 1–3650. Previous `Math.max(1, parseInt('abc'))` was producing `NaN` → silent SQL no-ops.

**Routes left for follow-up (tracked as PENDING M-14):** `settings/portal`, `content/*`, `media/*`, `users/probes`, `users/cf-access-audit`, `users/active-{sessions,revocations}`.

### H-5 — JWKS cache cleanup (`src/lib/auth/cloudflare-access.ts`)

The previous bust-and-retry path fetched fresh keys into a local variable it never used, then fell through to a third `fetchPublicKeys()` call (which served from the freshly-warmed cache). Functionally correct but confusing and one redundant round-trip per rotation. Worse: the next reviewer would read this as "use stale key" — exactly what almost happened in this audit.

**Fix:** Single reassignable variable; behavior otherwise identical.

### Verification

- `npm run check` — 0 errors / 0 warnings / 0 hints across 223 files, both before and after the fixes.
- All 7 commits land on `main` via merge commit `3f8cd78` (PR #2).


---

## Phase 13 — 2026-05-26 Deep-Review Follow-Up ✅

**Single atomic commit:** `27e6090` — 28 files changed, +637 / −319.
**Branch:** `claude/codebase-review-branch-fixes-WZg5d` → `main`.
**Full report:** `documentation/SECURITY-REVIEW-2026-05-26.md`.

This pass closed every Medium and Low item from the 2026-05-25 review that had a meaningful exploit path or genuine functional impact, plus the full dependency CVE list. Production `npm audit` went from **16 vulnerabilities (3 high, 12 moderate, 1 low) to 0**.

### Top-level shipped

| # | Severity | Area | Resolution |
|---|---|---|---|
| F-1 | 🔴 Crit (gap) | 18 API routes | Wired `placDenyResponse(user, '/dashboard/<page>')` after the existing role gate on `content/*`, `media/*`, `settings/portal`, `users/{index, activity, pages, access, probes, cf-access-audit, active-sessions, active-revocations}`, and `audit/silence`. PLAC denies now block the corresponding APIs, not just the dashboard pages. |
| F-2 | 🔴 Crit | Content GET handlers | Wrap `JSON.parse(result.content)` in try/catch with empty-array fallback in `reviews.ts`, `faqs.ts`, `stats.ts`. One corrupt D1 row no longer 500s the route. |
| F-3 | 🔴 Crit | `bookings/[id]/state.ts` | Defined `VALID_OPERATIONAL_STATUS` allow-list (`pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`); reject otherwise with 400. Cap `internal_notes` at 2000 chars. |
| F-4 | 🟠 High | Dependencies | `npm audit fix` for non-breaking upgrades + `@astrojs/cloudflare ^13.5.4` + `@astrojs/check ^0.9.9`. Moved `@astrojs/check` from `dependencies` → `devDependencies` (build-only tool — removes the entire `@astrojs/language-server` → `volar-service-yaml` → `yaml` chain from the production audit surface). **Production `npm audit`: 0.** |
| F-5 | 🟠 High | `scheduled-log-sync.ts` | Capped Resend alert emails at 5 per batch; the 5th email appends a digest line noting how many more failures were suppressed. All failures still write to D1. Prevents Resend quota burn on failed-login bursts. |
| F-6 | 🟠 High | `writeRevocationFlag` | TTL now reads `SESSION_MAX_LIFETIME_MS` via `getSessionTiming(getRawEnv())`, floor 60 s. The revocation horizon stays in lock-step with the configured session lifetime instead of drifting at a hard-coded 24 h. |
| F-7 | 🟠 High | `public/_headers` vs `middleware.ts` | Aligned `_headers` CSP byte-for-byte with middleware; added a reference-only banner clarifying that `_headers` is not consumed at runtime on Workers deploys (only middleware is). |
| F-8 | 🟡 Med | `audit/{login-logs, export}.ts` | Added `placDenyResponse(actor, '/dashboard/logs')` as first gate so parent-deny propagates to the `#security` and `#export` hash sub-pages via longest-prefix matching. The existing hash-grant logic remains as secondary check. |
| F-9 | 🟡 Med | `users/access.ts` | Added `placDenyResponse(actor, '/dashboard/users')` before the existing 5-gate hierarchy. A PLAC-denied admin can no longer mutate PLAC. |
| F-10 | 🟡 Med | Privileged user ops | Rate limits added: 30/min revoke (`active-sessions` DELETE), 30/min unblock (`active-revocations` DELETE), 10/min CF Access audit (`cf-access-audit` GET — endpoint enumerates every user CF Access knows about). |
| F-11 | 🟡 Med | `session.ts:130` (IP capture) | Split `X-Forwarded-For` on comma and take leftmost entry. `CF-Connecting-IP` still preferred as the most-trusted source. |
| F-12 | 🟡 Low | `ModelsCatalog.tsx:274` | Load-bearing comment added explaining the `dangerouslySetInnerHTML` is safe ONLY because both branches interpolate numeric values (`Math.round(...)` and `.toFixed(...)` — number → digit-string). Includes migration path to JSX `<><strong>{value}</strong></>` if any string field is ever interpolated. |

### Items verified closed without code change

- **M-8 `cms_content_history` cleanup trigger.** Verified the table has zero writers in the codebase. The migration's comment promises a trigger that was never built, but nothing inserts into the table so it cannot grow. Re-evaluate when the first writer ships.
- **M-3 second `writeRevocationFlag` copy at `plac.ts:363`.** The 2026-05-25 review cited two copies; only the `session.ts:280` version actually exists in the codebase. The `plac.ts` mention was speculative — closed.

### Branch hygiene (companion change)

- Local `main` was 28 commits behind `origin/main`. Fast-forwarded locally — no remote push needed.
- Stale remote branch `claude/codebase-security-review-LhIkr` (PR #2 already merged on 2026-05-25) was flagged for one-click deletion via the GitHub UI — could not be deleted from the review sandbox (proxy returned 403 on `git push --delete`; no MCP tool for branch deletion in this environment).

### Verification

- `tsc --noEmit --skipLibCheck` → exit 0 across the entire codebase.
- `npm audit --omit=dev` → 0 vulnerabilities (was 16).
- Per-route PLAC audit script confirmed every previously-flagged route now contains ≥ 1 `placDenyResponse` / `requirePageAccess` call.
- `astro check` could not complete in the review sandbox due to an esbuild service deadlock (environmental, not code) — `tsc` is the verified-clean path.

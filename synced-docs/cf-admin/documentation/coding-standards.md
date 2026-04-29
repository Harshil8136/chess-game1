{% raw %}
# Code Quality Rules

## 1. TypeScript Strictness
- `moduleResolution: "bundler"` in `tsconfig.json`
- `any` type is **FORBIDDEN** (unless bypassing upstream type bug, documented)
- All Cloudflare bindings must be strictly typed.

## 2. File Naming
All file names must be unique and descriptive:
- ✅ `LoginForm.tsx`, `AuthLayout.astro`, `rbac.ts`
- ❌ `Form.tsx` (ambiguous), `index.tsx` (without context)

## 3. Component Architecture ("LEGO-Style" Atomic Design)
- **Strict Composition Rule:** Components must follow Atomic Design + Island Architecture. Never create monolithic files.
- **Hard size limit: No component file may exceed 200 lines.** If a file grows past this threshold, split it immediately.
- **Atoms/Molecules:** Tiny, focused, reusable sub-components (e.g. `SidebarHeader.tsx`, `SidebarProfile.tsx`, `NavIcon.tsx`).
- **Organisms (Islands):** The primary Preact component that orchestrates atoms/molecules (e.g., `SidebarMenu.tsx`).
- **Astro Shells (`.astro`):** For server-rendered layouts and server-side data fetching.
- **Preact islands (`.tsx`):** Only for interactive UI.
- Use `client:load` for above-fold critical interactivity (like navigation)
- Use `client:idle` for below-fold widgets

### Component Split Pattern

When a component grows too large, follow this three-step extraction pattern:

1. **Shared types file** — Create `[Module]Types.ts` (or `shared.tsx` for co-located micro-components). Move all interfaces, type aliases, constants, and utility functions here. This eliminates circular imports.
2. **Section components** — Extract each logical section of the UI into a focused `[Module][Section].tsx` file. Each receives only the props it needs.
3. **Thin orchestrator** — The original file becomes the orchestrator: it fetches data, manages top-level state, and renders the section components. Target: ≤ 150 lines.

**Example applied (BookingSlideDrawer):**
```
bookings/
├── types.ts                     ← BookingRow, BookingPet, SERVICE_LABELS, ...
├── BookingCustomerSection.tsx   ← name, email, phone
├── BookingPetSection.tsx        ← pet profiles
├── BookingOperationsSection.tsx ← service, dates, status
├── BookingAuditSection.tsx      ← email log
├── BookingDangerZoneSection.tsx ← destructive actions
└── BookingSlideDrawer.tsx       ← orchestrator (~115 lines)
```

## 4. Error Handling & Resilience

### 4.1 Core Rules
- Never show white screens — use `ErrorBoundary` component from `src/components/ui/ErrorBoundary.tsx`
- Section-level boundaries: one broken widget **never** crashes the page
- API routes return structured JSON errors with proper HTTP status codes
- Users always have navigation to recover

### 4.2 🚨 SSR Safety — The 3 Crash Patterns
When using `client:load`, the component is rendered *synchronously* during Astro SSR. These 3 patterns will **silently kill the entire HTML stream**, producing a blank page with no error visible to the user:

| # | Pattern | Example | Fix |
|---|---------|---------|-----|
| 1 | **Missing default export** | `export function Widget()` | Must be `export default function Widget()` |
| 2 | **Wrong API route** | `fetch('/api/admin/analytics')` (404) | Verify endpoint exists in `src/pages/api/` |
| 3 | **Unguarded property access** | `data!.property` or `data.nested.value` | Always: `if (!data) return <SkeletonBlock />` first |

**ALWAYS use strict null guards and early returns before accessing any data props in Preact components.**

> **Note on Loading States:** The dashboard enforces a strict "No Blank Loading Screens" policy. Do not use plain text (e.g., "Loading...") or unstyled spinners for primary data fetches. Always use `SkeletonBlock` from `src/components/dashboard/widgets/WidgetShared.tsx` (canonical — `WidgetSharedV2` was merged and deleted) to provide immediate, structure-matching shimmer placeholders.

### 4.3 Mandatory ErrorBoundary Wrapping
Every widget group inside a `client:load` island must be wrapped in `<ErrorBoundary sectionName="...">`:

```tsx
import { ErrorBoundary } from '../ui/ErrorBoundary';

// ✅ CORRECT — crash in WidgetA doesn't affect WidgetB
<ErrorBoundary sectionName="Widget A">
  <WidgetA data={data} />
</ErrorBoundary>
<ErrorBoundary sectionName="Widget B">
  <WidgetB data={data} />
</ErrorBoundary>

// ❌ WRONG — crash in WidgetA takes down WidgetB too
<WidgetA data={data} />
<WidgetB data={data} />
```

### 4.4 Error Capture Infrastructure (Deployed)
Three-layer error shield, all core-level (survives any page/widget changes):

| Layer | What | Where |
|-------|------|-------|
| **Sentry `@sentry/astro`** | Framework-level server + client auto-capture | `astro.config.ts`, `sentry.*.config.ts` |
| **ErrorBoundary → Sentry** | Per-widget crash capture with section tags | `src/components/ui/ErrorBoundary.tsx` |
| **Global `window.onerror`** | Pre-boot safety net (catches hydration failures) | `AdminLayout.astro` inline `<script>` |

All errors automatically appear in the Sentry dashboard with:
- Section name tag (which widget crashed)
- Component stack trace (where in the Preact tree)
- Deduplication (same error won't flood)

### 4.5 Pre-Deploy Checklist for Preact Islands
Before deploying any new or modified `client:load` component:
- [ ] Component uses `export default function ...`
- [ ] All data props typed with `| null | undefined`
- [ ] Early `if (!data) return <Loading />` guard before any property access
- [ ] No `!` non-null assertions crossing component boundaries
- [ ] No `window`/`document` access outside `useEffect`
- [ ] Widget wrapped in `<ErrorBoundary sectionName="...">` in parent

## 5. TypeScript Fetch Patterns

### Typed JSON responses

TypeScript strict mode enforces a specific pattern when typing `fetch` responses. The type annotation must go on the `json()` call itself — NOT on the callback parameter.

```typescript
// CORRECT — type cast at json(), then destructure in next .then()
fetch('/api/some-endpoint')
  .then(r => r.json() as Promise<MyResponseType>)
  .then(data => {
    // data is typed as MyResponseType here
    console.log(data.someField);
  });

// WRONG — TypeScript strict mode rejects annotating the callback param
fetch('/api/some-endpoint')
  .then((data: MyResponseType) => {  // ❌ ERROR: Parameter 'data' implicitly has an 'any' type
    console.log(data.someField);
  });
```

**Why:** `Response.prototype.json()` returns `Promise<any>`. Annotating the `.then()` callback parameter does not narrow the type — TypeScript requires the cast to be applied to the `Promise` itself via `as Promise<T>`.

### Typed interfaces for all API responses

Never use `const data: any = await res.json()`. Always define a response interface:

```typescript
interface BookingListResponse {
  bookings: BookingRow[];
  total: number;
  page: number;
}

const data = await res.json() as BookingListResponse;
```

For D1 query results that the TypeScript compiler cannot narrow directly, use the double-cast pattern:
```typescript
const { results } = await stmt.all();
const rows = results as unknown as MyRowType[];
```

---

## 6. Accessibility Requirements

### Interactive non-button elements

Any non-`<button>` element that is click-activated (e.g., `<tr>`, `<div>`) must have the full interactive triad:

```tsx
<tr
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
  aria-label="View booking BK-00123"
>
```

- `role="button"` — tells assistive technology this is interactive
- `tabIndex={0}` — makes it keyboard-reachable
- `onKeyDown` — activates on Enter and Space (the keyboard equivalents of click)
- `aria-label` — describes the action when the visual text is insufficient

### Icon-only buttons

Every button that contains only an icon (no visible text) must have `aria-label`. The icon itself must have `aria-hidden="true"`.

```tsx
<button aria-label="Close drawer">
  <X className="w-4 h-4" aria-hidden="true" />
</button>
```

Using `title=` alone is not sufficient — `title` is not announced by all screen readers and is hidden on mobile.

### Tab components

Tab navigation must use the WAI-ARIA tab pattern:

```tsx
<div role="tablist" aria-label="Log Categories">
  <button
    role="tab"
    aria-selected={activeTab === 'audit'}
    aria-controls="tabpanel-audit"
    id="tab-audit"
  >
    Audit
  </button>
</div>
<div
  id="tabpanel-audit"
  role="tabpanel"
  aria-labelledby="tab-audit"
  hidden={activeTab !== 'audit'}
>
  ...
</div>
```

### Sortable table columns

Sortable `<th>` elements must have `aria-sort`:

```tsx
<th
  aria-sort={sortField === 'name'
    ? (sortDir === 'asc' ? 'ascending' : 'descending')
    : 'none'}
  onClick={() => handleSort('name')}
>
  Name
</th>
```

---

## 7. Animation Standards
- All interactive elements must have smooth transitions
- Use `var(--duration-normal)` (200ms) for hover/focus states
- Use `var(--duration-slow)` (350ms) for page transitions
- Respect `prefers-reduced-motion` media query

{% endraw %}

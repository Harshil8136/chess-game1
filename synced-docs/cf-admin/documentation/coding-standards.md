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
- **Atoms/Molecules:** Tiny, focused, reusable sub-components (e.g. `SidebarHeader.tsx`, `SidebarProfile.tsx`, `NavIcon.tsx`).
- **Organisms (Islands):** The primary Preact component that orchestrates atoms/molecules (e.g., `SidebarMenu.tsx`).
- **Astro Shells (`.astro`):** For server-rendered layouts and server-side data fetching.
- **Preact islands (`.tsx`):** Only for interactive UI.
- Use `client:load` for above-fold critical interactivity (like navigation)
- Use `client:idle` for below-fold widgets

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

> **Note on Loading States:** The dashboard enforces a strict "No Blank Loading Screens" policy. Do not use plain text (e.g., "Loading...") or unstyled spinners for primary data fetches. Always use `SkeletonBlock` from `src/components/dashboard/widgets/WidgetSharedV2.tsx` to provide immediate, structure-matching shimmer placeholders.

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

## 5. Animation Standards
- All interactive elements must have smooth transitions
- Use `var(--duration-normal)` (200ms) for hover/focus states
- Use `var(--duration-slow)` (350ms) for page transitions
- Respect `prefers-reduced-motion` media query

{% endraw %}

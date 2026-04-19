{% raw %}
# 08 — Codebase Cleanup & Refactoring

> **Goal:** Eliminate all technical debt during the design system migration.  
> **Scope:** Inline styles, anti-patterns, hardcoded values, dead code, and mixed paradigms.

---

## 1. Anti-Pattern Inventory

### 1.1 `zoom: 1.1` — DashboardController.tsx (Line 153)

**File:** `src/components/dashboard/DashboardController.tsx`  
**Line:** `<div className="dashboard-controller animate-fade-in" style={{ zoom: 1.1 }}>`

**Problem:**
- `zoom` is a non-standard CSS property (IE legacy)
- Breaks text scaling for accessibility users
- Causes layout calculations to be wrong (mouse events, element positions)
- Not supported in Firefox (silently ignored)
- Makes the dashboard 10% larger than intended on supported browsers

**Fix:**
```diff
- <div className="dashboard-controller animate-fade-in" style={{ zoom: 1.1 }}>
+ <div className="dashboard-controller animate-fade-in">
```

If the content needs to be larger, adjust `font-size` or `max-width` in the CSS instead.

---

### 1.2 `window.location.reload()` — DashboardController.tsx (Line 196)

**File:** `src/components/dashboard/DashboardController.tsx`  
**Line:** `onClick={() => window.location.reload()}`

**Problem:**
- Full page reload is jarring and destroys all React state
- Loses scroll position, sidebar state, any pending interactions
- Not compatible with Astro View Transitions (causes full navigation cycle)

**Fix:** Replace with state-level data refetch:

```tsx
// Create a refetch function
const [refreshKey, setRefreshKey] = useState(0);

const handleRefresh = () => {
  setRefreshKey(prev => prev + 1);
  setIsLoading(true);
};

useEffect(() => {
  fetch('/api/dashboard/metrics')
    .then(res => res.json())
    .then(data => setAnalytics(data as AnalyticsMetrics))
    .catch(err => console.error('[Dashboard] Metrics fetch failed:', err))
    .finally(() => setIsLoading(false));
}, [refreshKey]);  // ← Re-runs when refreshKey changes

// Button:
<button onClick={handleRefresh} aria-label="Refresh Dashboard">
  <RefreshIcon className={isLoading ? 'animate-spin' : ''} />
  Refresh
</button>
```

---

### 1.3 Inline `style={{}}` Objects — DashboardController.tsx (~200 lines)

**Problem:** The DashboardController contains approximately 200 lines of inline style objects. This violates the two-paradigm rule and is unmaintainable.

**Comprehensive Extraction Plan:**

| Lines | Current Inline Style | Target CSS Class | Target File |
|-------|---------------------|-----------------|-------------|
| 36-43 | Chart loader flex center | `.chart-loader` | `components/chart.css` |
| 67-69 | Skeleton pulse inline | `.skeleton-stat` | `components/stat-card.css` |
| 153 | `zoom: 1.1` | DELETE | — |
| 158 | Setup banner flex | `.setup-banner-inner` | `components/setup-banner.css` |
| 159 | Warning icon color `#f59e0b` | `.setup-icon` | `components/setup-banner.css` |
| 165-166 | Warning title inline | `.setup-title` | `components/setup-banner.css` |
| 168-171 | Warning description + code | `.setup-desc`, `.setup-code` | `components/setup-banner.css` |
| 177 | Dismiss button inline | `.setup-dismiss` | `components/setup-banner.css` |
| 189 | Header flex layout | `.dashboard-header` | `pages/dashboard.css` |
| 190-191 | H1 inline styles | `.dashboard-title` | `pages/dashboard.css` |
| 193 | Header actions flex | `.dashboard-actions` | `pages/dashboard.css` |
| 198-213 | Refresh button ALL inline | `.refresh-button` | `pages/dashboard.css` |
| 214-221 | `onMouseOver`/`onMouseOut` | CSS `:hover` | `pages/dashboard.css` |
| 247 | Icon color cyan | `.bento-title-icon` | `components/bento.css` |
| 257 | Token badge inline | `.status-badge--warning` | `components/bento.css` |
| 263 | Inner grid margin | `.bento-inner-grid` | `components/bento.css` |
| 284 | Danger color conditional | `.stat-danger` class toggle | `components/stat-card.css` |
| 290 | Chart container inline bg/border | `.chart-wrapper` | `components/chart.css` |
| 294-298 | Chart empty state | `.chart-empty` | `components/chart.css` |

**Process for each extraction:**

1. Create the CSS class with the exact same visual properties
2. Replace `style={{...}}` with `className="new-class-name"`
3. For conditional styles (like line 284), use className toggling:
   ```tsx
   // Before
   style={{ color: threats > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
   
   // After
   className={threats > 0 ? 'stat-value stat-value--danger' : 'stat-value'}
   ```

---

### 1.4 `onMouseOver`/`onMouseOut` Event Handlers for Styling

**Files Affected:** `DashboardController.tsx` (lines 214-221)

**Problem:**
```tsx
// ❌ JavaScript hover state management — should be CSS
onMouseOver={(e) => {
  e.currentTarget.style.background = 'var(--color-surface-overlay)';
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
}}
onMouseOut={(e) => {
  e.currentTarget.style.background = 'var(--color-surface-raised)';
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
}}
```

**Fix:** Delete the event handlers entirely. Use CSS:
```css
.refresh-button {
  background: var(--color-surface-raised);
  border: 1px solid var(--theme-border-subtle);
  transition: background var(--duration-fast) ease, border-color var(--duration-fast) ease;
}

.refresh-button:hover {
  background: var(--color-surface-overlay);
  border-color: var(--theme-border-default);
}
```

---

### 1.5 `data-theme="slate"` — AdminLayout.astro (Line 78)

**File:** `src/layouts/AdminLayout.astro`  
**Line:** `<body data-theme="slate" style="background:var(--theme-bg);">`

**Problems:**
- `data-theme="slate"` doesn't match any CSS selector (dark.css uses `"dark"`, light.css uses `"light"`)
- Theme attribute should be on `<html>` not `<body>` (`:root` = `<html>`)
- Inline `style` on body duplicates what CSS already sets

**Fix:**
```diff
- <body data-theme="slate" style="background:var(--theme-bg);" class={isCollapsed ? "" : "sidebar-expanded"}>
+ <body class={isCollapsed ? "" : "sidebar-expanded"}>
```

And move theme to `<html>`:
```diff
- <html lang="en">
+ <html lang="en" data-theme={ssrTheme}>
```

---

### 1.6 Inline Gradient Orbs — AdminLayout.astro (Lines 82-94)

**Problem:** Three ambient gradient orbs with ALL styles inline — colors, sizes, positions, animations, opacity.

**Fix:** Extract to CSS classes:

```astro
<!-- BEFORE: 12 lines of inline styles per orb -->
<div class="absolute w-[600px] h-[600px] ..." style="background:radial-gradient(...);animation:...;">

<!-- AFTER: clean semantic classes -->
<div class="admin-orb admin-orb--blue" aria-hidden="true" />
<div class="admin-orb admin-orb--cyan" aria-hidden="true" />
<div class="admin-orb admin-orb--emerald" aria-hidden="true" />
```

```css
/* AdminLayout.css or a new ambient.css */
.admin-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(80px);
  will-change: transform;
}

.admin-orb--blue {
  width: 600px; height: 600px;
  top: -200px; left: -150px;
  opacity: 0.08;
  background: radial-gradient(circle, oklch(0.637 0.191 264.1 / 0.5), transparent 70%);
  animation: orbDrift1 25s ease-in-out infinite;
}

/* etc. for each orb variant */
```

---

## 2. Hardcoded Color Inventory

### 2.1 auth.css — Full Color Audit

Every hardcoded color value and its replacement:

| Line | Current Value | Replacement Token | Context |
|------|--------------|-------------------|---------|
| 59 | `linear-gradient(135deg, #e2e8f0 0%, #c7d2fe 50%, #ddd6fe 100%)` | Blue-500 gradient | Primary CTA background |
| 63 | `rgba(99,102,241,0.12)` | `var(--theme-accent-subtle)` | CTA box-shadow glow |
| 69 | `rgba(99,102,241,0.2)` | `var(--theme-accent-muted)` | CTA hover shadow |
| 74 | `rgba(99,102,241,0.06)` | `var(--theme-accent-subtle)` | Disabled background |
| 104 | `rgba(34,211,238,0.06)` | `var(--theme-accent-subtle)` | OAuth hover background |
| 105 | `rgba(34,211,238,0.2)` | `var(--theme-accent-muted)` | OAuth hover border |
| 136 | `rgba(34, 211, 238, 0.8)` | `var(--theme-accent)` | Last-used badge text |
| 137 | `rgba(34, 211, 238, 0.08)` | `var(--theme-accent-subtle)` | Last-used badge bg |
| 138 | `rgba(34, 211, 238, 0.18)` | `var(--theme-accent-muted)` | Last-used badge border |
| 208 | `rgba(34,211,238,0.4)` | `var(--theme-accent-glow)` | Input focus border |
| 209 | `rgba(34,211,238,0.08)` + `rgba(34,211,238,0.06)` | `var(--theme-accent-glow)` | Input focus ring |
| 247 | `rgba(99,102,241,0.12)` + `rgba(139,92,246,0.06)` | `var(--theme-accent-subtle)` | Avatar gradient |
| 248 | `rgba(99,102,241,0.15)` | `var(--theme-accent-muted)` | Avatar border |
| 255 | `rgba(99,102,241,0.3)` | `var(--theme-accent-glow)` | Avatar text shadow |
| 308 | `rgba(99,102,241,0.08)` | `var(--theme-accent-subtle)` | Sent icon background |
| 309 | `rgba(99,102,241,0.12)` | `var(--theme-accent-muted)` | Sent icon border |
| 310 | `rgba(165,148,249,0.7)` | `var(--theme-accent)` | Sent icon color |

### 2.2 DashboardController.tsx — Color Audit

| Line | Current Value | Replacement | Context |
|------|--------------|-------------|---------|
| 135 | `'#d946ef'` | `var(--color-section-rose)` | Chart axis stroke |
| 143 | `'var(--color-cyan)'` | `'var(--theme-accent)'` | Chart series stroke — interactive |
| 144 | `'rgba(34, 211, 238, 0.1)'` | `'var(--theme-accent-subtle)'` | Chart series fill |
| 145 | `'#d946ef'` | `var(--color-section-rose)` | Chart data series |
| 159 | `color: '#f59e0b'` | CSS class `.setup-icon` | Warning icon |
| 165 | `color: '#f59e0b'` | CSS class `.setup-title` | Warning title text |
| 169 | `color: '#fbbf24'` | CSS class `.setup-code` | Code highlight color |
| 197 | `'cyan-500/50'` | `'blue-500/50'` | Tailwind focus ring |

---

## 3. Dead Code Removal

### 3.1 placeholder.css (5.3 KB)

**Action:** Delete entirely.

```diff
// AdminLayout.astro
- import '../styles/placeholder.css';
```

**Reason:** Contains placeholder table styles, skeleton patterns, and demo content styles that are no longer used. None of these class names appear in the current codebase.

### 3.2 Unused CSS Classes in Dashboard.css

After splitting Dashboard.css into component files, audit for classes that no longer have JSX references. Common candidates:

- `.db-toolbar` — appears in CSS but not in any component
- `.db-footer` — no matching JSX
- `.db-placeholder` — dead placeholder styles

### 3.3 Dot Pattern SVG — AdminLayout.astro (Lines 91-94)

```html
<svg class="absolute inset-0 w-full h-full opacity-[0.01]" aria-hidden="true">
  <filter id="dashNoise">...</filter>
  <rect width="100%" height="100%" filter="url(#dashNoise)"/>
</svg>
```

**Action:** Delete. At `opacity: 0.01` (1%), this is invisible to human eyes but still triggers SVG filter rendering on every frame.

---

## 4. Preact Component Optimization

### 4.1 Memoization

Components that receive stable props should be wrapped in `memo`:

```tsx
import { memo } from 'preact/compat';

// ✅ Memoize pure display components
const StatCard = memo(function StatCard({ label, value, icon }) {
  return (
    <div className="stat-card">
      {icon}
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">{value}</span>
    </div>
  );
});
```

**Candidates for memoization:**
- `StatCard` — pure display, receives primitive props
- `ActivityFeed` — receives array but only re-renders on new data
- `QuickActions` — receives stable `userLevel` number
- `SystemHealthBar` — receives analytics object (check referential stability)

### 4.2 Lazy Loading

Already implemented for uPlot chart — extend pattern to other heavy components:

```tsx
// Lazy-load the chatbot admin components (only needed on chatbot pages)
const ChatbotDashboard = lazy(() => import('./chatbot/ChatbotDashboard'));

// Lazy-load booking list (heavy table with formatting logic)
const BookingList = lazy(() => import('./BookingList'));
```

### 4.3 Event Handler Cleanup

Ensure all `addEventListener` calls in `useEffect` have cleanup returns:

```tsx
// Pattern check: every addEventListener must have removeEventListener
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('event', handler);
  return () => window.removeEventListener('event', handler);  // ← Required
}, []);
```

---

## 5. TypeScript Improvements

### 5.1 Remove `any` Types

```tsx
// ❌ Current
const user = (Astro.locals as any).user as AdminUser | undefined;

// ✅ Target — extend Astro types
// src/env.d.ts
declare namespace App {
  interface Locals {
    user?: AdminUser;
  }
}

// Usage
const user = Astro.locals.user;
```

### 5.2 Chart Config Type Safety

```tsx
// ❌ Current chart types
const [Chart, setChart] = useState<any>(null);

// ✅ Typed
import type { UPlotChart } from './charts/UPlotChart';
const [Chart, setChart] = useState<typeof UPlotChart | null>(null);
```

---

## 6. Execution Order

The cleanup should be done in this order to minimize merge conflicts:

1. **First:** Delete dead code (placeholder.css, noise SVG, unused classes)
2. **Second:** Extract inline styles to CSS classes (DashboardController.tsx)
3. **Third:** Replace hardcoded colors with tokens (auth.css, all components)
4. **Fourth:** Fix anti-patterns (zoom, reload, data-theme)
5. **Fifth:** Split monolith CSS files
6. **Sixth:** Optimize Preact components (memo, lazy, types)
7. **Last:** Visual regression test every page
{% endraw %}

{% raw %}
# 02 — CSS Architecture

> **Goal:** Transform the current four-paradigm mess into a clean, two-paradigm system that leverages Astro's automatic per-route code splitting.

---

## 1. Current State (Problems)

### 1.1 File Inventory & Size Audit

| File | Size | Lines | Problem |
|------|------|-------|---------|
| `global.css` | 9.0 KB | 205 | Imports everything. `@theme` bridge is good but oversized. |
| `dark.css` | 2.6 KB | 58 | Neon cyan accent (`#00e5ff`). Needs Blue-500. |
| `light.css` | 2.1 KB | 58 | Sky-blue accent (`#0ea5e9`). Needs Blue-600. |
| `Dashboard.css` | 27.1 KB | 1000+ | **MONOLITH.** Every dashboard component's styles in one file. |
| `chatbot.css` | 22.2 KB | ~700 | **MONOLITH.** All chatbot admin panel styles. |
| `auth.css` | 8.7 KB | 335 | 12 hardcoded indigo/cyan values. |
| `audit.css` | 18.2 KB | ~600 | Audit log page styles. Large but scoped. |
| `sections.css` | 3.3 KB | 76 | Section color resolution. Clean design. Keep. |
| `utilities.css` | 3.3 KB | ~100 | Custom utility classes. Keep. |
| `placeholder.css` | 5.3 KB | ~180 | Placeholder styles. Mostly dead code. |
| `AdminLayout.css` | 1.0 KB | ~30 | Layout grid. Fine. |
| `TopBar.css` | 5.2 KB | ~150 | TopBar styles. Scoped well. |
| `SlideDrawer.css` | 0.8 KB | ~25 | Drawer component. Fine. |

**Total CSS payload:** ~106 KB (uncompressed, before Astro splits)

### 1.2 Four Competing Paradigms

The codebase currently mixes four incompatible styling approaches:

1. **Tailwind utility classes** — Used in Astro templates and some Preact JSX
2. **CSS Custom Properties** — `var(--theme-*)` system in theme files ✅
3. **BEM-style class names** — `.bento-card`, `.bento-header`, `.dashboard-panel` in `Dashboard.css`
4. **Inline `style={{}}` objects** — ~200+ lines in `DashboardController.tsx` alone

### 1.3 Specific Anti-Patterns Found

```tsx
// ❌ ANTI-PATTERN: Inline styles in DashboardController.tsx (line 153)
<div className="dashboard-controller animate-fade-in" style={{ zoom: 1.1 }}>

// ❌ ANTI-PATTERN: Inline hover handlers (lines 214-221)
onMouseOver={(e) => {
  e.currentTarget.style.background = 'var(--color-surface-overlay)';
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
}}

// ❌ ANTI-PATTERN: window.location.reload() (line 196)
onClick={() => window.location.reload()}

// ❌ ANTI-PATTERN: Hardcoded colors in JSX (line 159)
style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }}
```

---

## 2. Target Architecture

### 2.1 Two Paradigms Only

| Paradigm | Use For | Example |
|----------|---------|---------|
| **Tailwind Utilities** | Layout, spacing, sizing, flexbox, grid, responsive breakpoints | `className="flex items-center gap-2 p-4"` |
| **CSS Custom Properties + Component CSS** | Colors, complex selectors, animations, pseudo-elements, glassmorphism | `.bento-card { background: var(--theme-surface-raised); }` |

### 2.2 The Rule

> **If it's layout → Tailwind. If it's visual style → CSS file with tokens.**

**Banned forever:**
- Inline `style={{}}` objects in Preact/JSX (except dynamic computed values like `width` from ResizeObserver)
- Raw hex/rgba values in component code
- `onMouseOver`/`onMouseOut` style manipulation (use CSS `:hover`)
- BEM naming that duplicates Tailwind utilities

---

## 3. File Organization (Target)

### 3.1 Directory Structure

```
src/styles/
├── global.css              # @import orchestrator + @theme bridge + base resets
├── themes/
│   ├── dark.css            # :root dark token definitions (Blue-500 accent)
│   └── light.css           # :root[data-theme="light"] definitions
├── sections.css            # data-section attribute color resolution (KEEP AS-IS)
├── utilities.css           # Custom utility classes (KEEP, audit for dead code)
│
├── components/             # NEW: Component-scoped CSS modules
│   ├── bento.css           # Bento grid layout + card base styles
│   ├── stat-card.css       # StatCard number display, shimmer
│   ├── health-bar.css      # SystemHealthBar service indicators
│   ├── workers-widget.css  # Workers widget specific styles
│   ├── storage-widget.css  # R2/Queue storage widget
│   ├── quota-widget.css    # Quota monitoring bars
│   ├── auth-widget.css     # Supabase auth widget
│   ├── activity-feed.css   # Audit log activity feed
│   ├── quick-actions.css   # Quick action grid
│   ├── chart.css           # uPlot chart container + theme
│   ├── setup-banner.css    # API token warning banner
│   └── command-palette.css # Ctrl+K command palette overlay
│
├── pages/                  # NEW: Page-level contextual overrides
│   ├── dashboard.css       # Dashboard page density + grid overrides
│   ├── chatbot.css         # Chatbot admin panel (split from monolith)
│   └── audit.css           # Audit log page (moved)
│
└── auth.css                # Auth form styles (IN-PLACE refactor)

DELETED:
├── placeholder.css         # ← REMOVE (dead code)
├── Dashboard.css           # ← SPLIT into components/ + pages/dashboard.css
├── chatbot.css             # ← SPLIT into components/ + pages/chatbot.css
```

### 3.2 Import Strategy in global.css

```css
/* global.css — AFTER refactoring */
@import "tailwindcss";
@import "./themes/dark.css";
@import "./themes/light.css";

@theme {
  /* Token bridge — maps --theme-* to Tailwind-consumable --color-* */
  /* This section stays exactly as current, just with Blue-500 accent */
}

@layer base {
  /* html, body, ::selection, :focus-visible, scrollbar */
  /* These stay as current */
}

/* Component and page CSS are NOT imported here.
   They are imported in the components/pages that need them.
   Astro handles per-route code splitting automatically. */
```

### 3.3 Import Pattern in Components

```tsx
// ✅ CORRECT: Component imports its own CSS
// src/components/dashboard/StatCard.tsx
import '../../styles/components/stat-card.css';

export default function StatCard({ ... }) {
  return <div className="stat-card">...</div>;
}
```

```astro
---
// ✅ CORRECT: Page imports its page CSS
// src/pages/dashboard/index.astro
import '../../styles/pages/dashboard.css';
---
```

---

## 4. Splitting Strategy for Dashboard.css

The 27KB monolith contains styles for approximately 12 distinct components. Here's the extraction plan:

### 4.1 Class Name → Component Mapping

| CSS Class Prefix | Target File | ~Lines |
|-----------------|-------------|--------|
| `.bento-*` (grid, card, row, header, stat) | `components/bento.css` | ~200 |
| `.stat-card-*` | `components/stat-card.css` | ~80 |
| `.health-*`, `.service-*` | `components/health-bar.css` | ~120 |
| `.workers-*` | `components/workers-widget.css` | ~100 |
| `.storage-*`, `.r2-*`, `.queue-*` | `components/storage-widget.css` | ~100 |
| `.quota-*` | `components/quota-widget.css` | ~80 |
| `.supabase-*`, `.auth-widget-*` | `components/auth-widget.css` | ~80 |
| `.activity-*`, `.feed-*` | `components/activity-feed.css` | ~60 |
| `.quick-action-*` | `components/quick-actions.css` | ~50 |
| `.cf-uplot-*`, `.chart-*` | `components/chart.css` | ~40 |
| `.setup-banner*` | `components/setup-banner.css` | ~30 |
| `.dashboard-controller`, `.dashboard-section` | `pages/dashboard.css` | ~60 |

### 4.2 Extraction Process

For each component CSS file:

1. **Cut** the relevant class blocks from `Dashboard.css`
2. **Replace** any hardcoded color values with `var(--theme-*)` tokens
3. **Move** hover/focus pseudo-class styles that were in inline JS to the CSS
4. **Add** the import statement to the component's `.tsx` file
5. **Verify** the component renders identically

---

## 5. CSS Layer Strategy

```css
/* Layer precedence (lowest → highest): */
@layer base;        /* Theme tokens, resets, typography */
@layer components;  /* Component-scoped styles */
@layer utilities;   /* Tailwind utilities (highest specificity) */
```

Tailwind v4 handles this automatically. The `@layer base` in `dark.css`/`light.css` is already correct. Component CSS will use `@layer components` explicitly.

---

## 6. Performance Impact

### 6.1 Before (Current)

- **Dashboard page load:** ~106 KB CSS total (monolithic imports)
- **Every page** loads `Dashboard.css` (27KB) plus `chatbot.css` (22KB) even when not needed
- No tree-shaking possible

### 6.2 After (Target)

- **Dashboard page load:** ~35 KB CSS (global + dashboard-specific components)
- **Chatbot page load:** ~30 KB CSS (global + chatbot-specific components)
- **Auth page load:** ~15 KB CSS (global + auth form only)
- **Astro code-splits** CSS per route automatically — unused component CSS never ships

### 6.3 Estimated Savings

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Dashboard FCP CSS | ~106 KB | ~35 KB | **67% reduction** |
| Chatbot FCP CSS | ~106 KB | ~30 KB | **72% reduction** |
| Auth FCP CSS | ~106 KB | ~15 KB | **86% reduction** |

---

## 7. Migration Checklist

- [ ] Create `src/styles/components/` directory
- [ ] Create `src/styles/pages/` directory
- [ ] Extract bento grid styles → `components/bento.css`
- [ ] Extract health bar styles → `components/health-bar.css`
- [ ] Extract stat card styles → `components/stat-card.css`
- [ ] Extract workers widget → `components/workers-widget.css`
- [ ] Extract storage widget → `components/storage-widget.css`
- [ ] Extract quota widget → `components/quota-widget.css`
- [ ] Extract auth widget → `components/auth-widget.css`
- [ ] Extract activity feed → `components/activity-feed.css`
- [ ] Extract quick actions → `components/quick-actions.css`
- [ ] Extract chart styles → `components/chart.css`
- [ ] Extract setup banner → `components/setup-banner.css`
- [ ] Move dashboard page styles → `pages/dashboard.css`
- [ ] Refactor chatbot.css → split into components + `pages/chatbot.css`
- [ ] Delete `placeholder.css`
- [ ] Delete original `Dashboard.css` monolith
- [ ] Update all component imports
- [ ] Remove `placeholder.css` import from `AdminLayout.astro`
- [ ] Visual regression test every page

{% endraw %}

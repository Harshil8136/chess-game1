{% raw %}
# Design System — "Midnight Slate"

> **Status:** Production Active
> **Last Updated:** 2026-04-17 (overhaul complete)
> **Codename:** Project Midnight Blue

---

## 1. Design Philosophy

**"Every pixel earns its place."**

The cf-admin design system delivers a professional command center aesthetic rivaling Linear, Raycast, and Vercel. Four guiding principles:

1. **Linear-Minimal DNA** — Ultra-clean surfaces, generous whitespace, single accent family. The UI disappears; the content speaks.
2. **Rich Color Harmony** — Depth through controlled surface elevation and OKLCH perceptual uniformity — not flat monochrome.
3. **Alive But Truthful** — Every animation communicates real system state. Health pulses reflect actual uptime. Counters animate to real values. No decorative noise.
4. **Edge-Native Performance** — All design decisions respect the Cloudflare Workers CPU budget and $0 infrastructure constraint.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Aesthetic Direction** | Linear/Raycast minimal | Professional, content-first |
| **Primary Accent** | Blue-500 (`#3b82f6`) | Linear's actual accent. Works on both themes. |
| **Theme Strategy** | Dark (default) + Light toggle | Cookie-persisted, SSR-compatible, system detection |
| **CSS Architecture** | Two paradigms: Tailwind utilities + Component CSS with tokens | Kill inline styles, kill raw hex values |
| **Animation** | Purposeful only — every animation shows real data | No decorative-only effects |

### What Was Eliminated

- `#00e5ff` neon cyan interactive accent → replaced by Blue-500
- `rgba(99,102,241,...)` indigo interactive accents
- `rgba(139,92,246,...)` violet interactive accents
- `zoom: 1.1` on DashboardController
- `data-theme="slate"` attribute → replaced by `data-theme="dark"`
- Inline `style={{}}` objects in Preact components (~200 lines; reduced to near-zero after Phase 7C — only dynamic computed values remain)
- `window.location.reload()` for dashboard refresh

---

## 2. Design Tokens

**File:** `src/styles/themes/dark.css` and `src/styles/themes/light.css`

### 2.1 Accent System — Blue-500 Family

```css
/* Dark Theme */
--theme-accent:        oklch(0.637 0.191 264.1);   /* #3b82f6 — Primary interactive */
--theme-accent-hover:  oklch(0.707 0.165 264.1);   /* #60a5fa — Hover state */
--theme-accent-muted:  oklch(0.637 0.191 264.1 / 0.15);
--theme-accent-glow:   oklch(0.637 0.191 264.1 / 0.40);
--theme-accent-subtle: oklch(0.637 0.191 264.1 / 0.08);

/* Light Theme — darker shade for contrast on white */
--theme-accent:        oklch(0.546 0.245 264.1);   /* #2563eb */
--theme-accent-hover:  oklch(0.488 0.243 264.1);   /* #1d4ed8 */
```

### 2.2 Surface Elevation (5 Layers)

```
L0 → L1 → L2 → L3 → L4
bg     surface  raised  overlay  elevated
(page) (sidebar)(cards) (modals) (tooltips)
```

```css
/* Dark */
--theme-bg:               #09090b;
--theme-surface:          #121214;
--theme-surface-raised:   #18191c;
--theme-surface-overlay:  #212226;
--theme-surface-elevated: #2b2d31;

/* Light */
--theme-bg:               #F8FAFC;
--theme-surface:          #FFFFFF;
--theme-surface-raised:   #F1F5F9;
--theme-surface-overlay:  #E2E8F0;
--theme-surface-elevated: #CBD5E1;
```

### 2.3 Text Hierarchy

```css
/* Dark (contrast on #121214) */
--theme-text-primary:   #ffffff;    /* 17.1:1 — AAA */
--theme-text-secondary: #a1a1aa;    /*  7.2:1 — AAA */
--theme-text-tertiary:  #8a8a93;    /*  5.3:1 — AA  */
--theme-text-muted:     #71717a;    /*  4.0:1 — AA large only */
```

> **Rule:** `--text-muted` for large text (≥14px bold or ≥18px) only — never for essential information.

### 2.4 Border System

```css
/* Dark */
--theme-border-subtle:  rgba(255, 255, 255, 0.05);
--theme-border-default: rgba(255, 255, 255, 0.12);
--theme-border-strong:  rgba(255, 255, 255, 0.20);
--theme-border-accent:  rgba(59, 130, 246, 0.40);
```

### 2.5 Glassmorphism Tokens

```css
/* Dark */
--theme-glass:         rgba(18, 18, 20, 0.7);
--theme-glass-strong:  rgba(24, 25, 28, 0.85);
--theme-glass-border:  rgba(255, 255, 255, 0.08);
--theme-glass-inner:   inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
```

### 2.6 Section Colors (Navigation Identity Only)

Section colors identify sidebar sections — NOT used for interactive elements (buttons, links, focus rings always use `--theme-accent`).

```css
--theme-violet:  #b794f4;   /* Admin, Users, Roles */
--theme-cyan:    #22d3ee;   /* Dashboard, Analytics */
--theme-amber:   #f6ad55;   /* Reports, Billing */
--theme-emerald: #4ade80;   /* CMS, Content */
--theme-blue:    #60a5fa;   /* AI Server, Chatbot */
--theme-rose:    #fb7185;   /* Logs, Audit */
```

Applied via `data-section` attribute; children consume `var(--section-color)` etc.

### 2.7 Semantic Status Colors

```css
/* Dark */
--theme-success: #4ade80;
--theme-warning: #f6ad55;
--theme-danger:  #f87171;
--theme-info:    #60a5fa;
```

### 2.8 RBAC Role Badge Colors

```css
--color-role-dev:        var(--theme-red);       /* Red */
--color-role-owner:      var(--theme-emerald);   /* Emerald */
--color-role-superadmin: var(--theme-amber);     /* Amber */
--color-role-admin:      var(--theme-violet);    /* Violet */
--color-role-staff:      var(--theme-blue);      /* Blue */
```

### 2.9 Typography

```css
--font-family-sans: 'Inter', -apple-system, system-ui, sans-serif;
--font-family-mono: 'JetBrains Mono', ui-monospace, Consolas, monospace;
```

**Type scale:** `display` (32px/800) → `headline` (24px/700) → `title` (18px/650) → `subtitle` (15px/600) → `body` (14px/400) → `body-sm` (13px/400) → `caption` (12px/500) → `micro` (11px/600) → `mono-data` (14px/500, JetBrains)

### 2.10 Component Badge Color Tokens

**File:** `src/styles/themes/dark.css`

A full set of semantic badge color tokens for status badges across the admin UI. Each color family has three variants: text color, background fill, and border color.

```css
/* Emerald — active, yes, success states */
--color-badge-emerald:        #34d399;
--color-badge-emerald-bg:     rgba(16, 185, 129, 0.15);
--color-badge-emerald-border: rgba(16, 185, 129, 0.3);

/* Amber — escalated, no, warning states */
--color-badge-amber:          #fbbf24;
--color-badge-amber-bg:       rgba(251, 191, 36, 0.15);
--color-badge-amber-border:   rgba(251, 191, 36, 0.3);

/* Blue — info, relocation service */
--color-badge-blue:           #60a5fa;
--color-badge-blue-bg:        rgba(59, 130, 246, 0.15);
--color-badge-blue-border:    rgba(59, 130, 246, 0.3);

/* Slate — neutral, unknown states */
--color-badge-slate:          #94a3b8;
--color-badge-slate-bg:       rgba(100, 116, 139, 0.15);
--color-badge-slate-border:   rgba(100, 116, 139, 0.3);

/* Red — danger, error, cancelled */
--color-badge-red:            #f87171;
--color-badge-red-bg:         rgba(248, 113, 113, 0.15);
--color-badge-red-border:     rgba(248, 113, 113, 0.3);

/* Purple — hotel service, special states */
--color-badge-purple:         #c084fc;
--color-badge-purple-bg:      rgba(192, 132, 252, 0.15);
--color-badge-purple-border:  rgba(192, 132, 252, 0.3);
```

**Usage:** In `src/styles/components/chatbot/buttons-badges.css`, all `.chatbot-badge-*` selectors now reference these variables. No raw hex values in component CSS.

**Rule:** When adding a new badge color, add the three-variant token group here first, then reference `var(--color-badge-*)` in component CSS. Never write raw hex values for badge colors.

---

### 2.11 Spacing, Radius, Shadow, Motion

```css
/* 4px grid spacing */
--spacing-xs: 4px;  --spacing-sm: 8px;  --spacing-md: 16px;
--spacing-lg: 24px; --spacing-xl: 32px; --spacing-2xl: 48px;

/* Border radius */
--radius-sm: 6px;   --radius-md: 10px;  --radius-lg: 14px;
--radius-xl: 20px;  --radius-2xl: 24px; --radius-full: 9999px;

/* Motion */
--duration-fast: 120ms;  --duration-normal: 200ms;  --duration-slow: 350ms;
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
```

---

## 3. CSS Architecture

**Rule: Two paradigms only.**

| Paradigm | Use For |
|----------|---------|
| **Tailwind utilities** | Layout, spacing, sizing, flexbox, grid, responsive |
| **CSS Custom Properties + Component CSS** | Colors, animations, pseudo-elements, glassmorphism |

**Banned:** Inline `style={{}}` in JSX (except dynamic computed values from ResizeObserver), raw hex/rgba in component code, `onMouseOver` style manipulation (use CSS `:hover`).

### File Structure

```
src/styles/
├── global.css              ← @import orchestrator + @theme bridge + base resets
├── themes/
│   ├── dark.css            ← :root dark tokens (includes --color-badge-* variables)
│   └── light.css           ← :root[data-theme="light"] tokens
├── sections.css            ← data-section attribute color resolution
├── utilities.css           ← Custom utility classes (.sr-only, etc.)
├── components/             ← Component-scoped CSS modules
│   ├── bento.css, stat-card.css, health-bar.css, button.css
│   ├── badge.css, input.css, table.css, toast.css, modal.css
│   ├── command-palette.css, activity-feed.css ...
│   └── chatbot/
│       ├── buttons-badges.css   ← .chatbot-badge-* (uses --color-badge-* vars; no raw hex)
│       ├── stats.css            ← .ad-* analytics dashboard classes (20+ extracted from AnalyticsDashboard.tsx)
│       └── [other chatbot css files]
└── pages/                  ← Page-level overrides
    ├── dashboard.css, chatbot.css, audit.css
    └── login-forensics.css
```

Component and page CSS are **NOT** imported in `global.css`. Each component/page imports its own CSS — Astro handles per-route code splitting automatically. This reduces per-page CSS payload by 67–86% vs the previous monolithic approach.

**Note on widget shared utilities:** The canonical shared widget file is `src/components/dashboard/widgets/WidgetShared.tsx`. The former `WidgetSharedV2.tsx` was merged into it and deleted (Phase 3B). All imports must reference `WidgetShared`, never `WidgetSharedV2`.

**CSS layer precedence:** `@layer base` → `@layer components` → `@layer utilities` (Tailwind utilities win).

---

## 4. Theme System

### 4.1 Detection Cascade

```
1. Cookie cf_admin_theme → "dark" | "light"     (user's explicit choice)
2. prefers-color-scheme media query              (OS/browser setting)
3. Default: "dark"
```

### 4.2 Zero-FOWT SSR Integration

`data-theme` lives on `<html>` (the `:root`). A blocking `<script is:inline>` in `<head>` reads the cookie and sets the attribute synchronously before paint — ~200 bytes, negligible blocking cost.

```css
/* dark.css */
:root, :root[data-theme="dark"] { /* dark tokens */ }

/* light.css */
:root[data-theme="light"] { /* light tokens override :root defaults */ }
```

### 4.3 ThemeToggle Component

Lives in `TopBar.tsx`. On toggle: updates `document.documentElement.dataset.theme` immediately, sets `cf_admin_theme` cookie (1 year, SameSite=Lax), dispatches `CustomEvent('theme-change')` for canvas-based components (uPlot charts) that need explicit re-rendering.

---

## 5. Page Layouts

**Philosophy:** Each page gets the density its content demands.

### Shell Structure (`AdminLayout.astro`)

```
┌──────────────────────────────────────────┐
│  TopBar (sticky, z-40, 60px, glass)      │
├──────┬───────────────────────────────────┤
│      │                                   │
│ Side │  <main id="main-content">         │
│  bar │    <slot />                       │
│      │                                   │
└──────┴───────────────────────────────────┘
```

`.admin-content-area` uses `margin-left: var(--sidebar-width)` with a 200ms transition.

### Per-Page Strategies

| Page | Layout | Max Width |
|------|--------|-----------|
| Dashboard | Dense 2-column bento grid | 1400px |
| CMS/Content | Spacious editorial — 2-col (editor + sidebar) | 1200px / editor 720px |
| Table pages | Full-width with horizontal scroll on mobile | none |
| Chatbot Admin | Split panel — tabs + detail | none |
| Auth/Login | Single centered card | 400px |

### Sidebar States

| State | Width | Trigger |
|-------|-------|---------|
| Collapsed (default) | 72px | Page load |
| Expanded | 240px | Hover |
| Pinned | 240px | Click pin (saved to `cf_admin_sidebar_collapsed` cookie) |
| Hidden | 0 | < 1024px breakpoint |

### Login Portal — "Midnight Slate"

Single-column centered card on `#09090b` background with three ambient gradient orbs (Cyan, Slate, Deep Blue at 0.06–0.12 opacity) + SVG `feTurbulence` noise texture at `opacity-[0.015]`.

```css
/* Glassmorphic card */
background:  rgba(255,255,255,0.035);
border:      1px solid rgba(255,255,255,0.08);
backdrop-filter: blur(40px);
box-shadow:  0 0 0 1px rgba(34,211,238,0.06),
             0 20px 50px rgba(0,0,0,0.5),
             0 0 80px rgba(34,211,238,0.06);
```

---

## 6. Animation & Motion

**Rule:** Animations communicate real system state. No decorative noise (exception: ambient background orbs).

### 6.1 Motion Tokens

```css
--duration-fast:   120ms;  /* hover, focus rings */
--duration-normal: 200ms;  /* panel reveals, tab switches */
--duration-slow:   350ms;  /* page transitions, drawer slides */
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);   /* emphasis */
--ease-out:        cubic-bezier(0.16, 1, 0.3, 1);        /* appearing */
--ease-in:         cubic-bezier(0.55, 0, 1, 0.45);       /* leaving */
```

### 6.2 Truthful Animations

- **Health dots** pulse only when healthy (green, 3s); static red = down; amber slow-pulse = degraded
- **Stat counters** animate from 0 → real value using a `useAnimatedCounter` hook (ease-out curve, 800ms)
- **Quota bars** animate width to real usage percentage; color changes at warning/critical thresholds
- **Activity feed** new items slide in from top with `slideInFromTop` + spring easing

### 6.3 Standard Patterns

```css
/* Fade-in for content loads */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Staggered bento card entrance */
.bento-card:nth-child(n) { animation-delay: calc(n * 60ms); }

/* Skeleton shimmer */
.skeleton {
  background: linear-gradient(90deg,
    var(--theme-surface-raised) 0%, var(--theme-surface-overlay) 50%,
    var(--theme-surface-raised) 100%);
  background-size: 200px 100%;
  animation: shimmer 1.5s var(--ease-in-out) infinite;
}
```

### 6.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  .admin-ambient-orb { display: none; }
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation: none !important;
  }
}
```

**Performance rules:** Animate only `transform`/`opacity` — never layout properties. `will-change: transform` only on actively animating orbs. Nothing over 500ms.

---

## 7. Accessibility (WCAG 2.2 AA)

### 7.1 Verified Contrast Ratios (Dark Theme)

| Token Pair | Contrast | Level |
|------------|----------|-------|
| `--text-primary` (#fff) on `--surface` | 17.1:1 | AAA |
| `--text-secondary` (#a1a1aa) on `--surface` | 7.2:1 | AAA |
| `--text-tertiary` (#8a8a93) on `--surface` | 5.3:1 | AA |
| `--accent` (#3b82f6) on `--surface` | 4.8:1 | AA |
| `--success` (#4ade80) on `--surface` | 8.5:1 | AAA |
| `--danger` (#f87171) on `--surface` | 5.6:1 | AA |

### 7.2 Landmark Structure

```html
<a href="#main-content" class="skip-nav">Skip to main content</a>
<nav aria-label="Main navigation" class="sidebar">...</nav>
<header role="banner" class="topbar">
  <nav aria-label="Breadcrumb">...</nav>
</header>
<main id="main-content" class="admin-main-content">...</main>
<div role="status" aria-live="polite" aria-label="Notifications">...</div>
```

### 7.3 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Navigate focus |
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Escape` | Close modal/dropdown/palette |
| `Arrow Up/Down` | Navigate sidebar / palette results |

Focus trapping required for modals and command palette via `useFocusTrap` hook.

### 7.4 Rules

- Every icon-only button requires `aria-label`
- Form errors announced via `role="alert"` + `aria-describedby`
- `role="progressbar"` + `aria-valuenow` on quota bars
- `role="tablist"` + `role="tab"` + `aria-selected` on chatbot admin tabs
- Color must NOT be the only state indicator — add icons/text too
- Live regions: `aria-live="polite"` on toast region and loading states

---

## 8. Responsive & Mobile

**Philosophy:** Core pages fully responsive; CRUD pages functional but simplified. Admins check dashboards on phones; they don't edit CMS hero sections on phones.

### 8.1 Breakpoints (Tailwind standard)

| Breakpoint | Sidebar | Grid | Tables |
|------------|---------|------|--------|
| ≥1280px | Expanded/pinned optional | 2-col bento | Full |
| 1024–1279px | Collapsed (72px) | 2-col bento | Full |
| 768–1023px | Hidden + hamburger overlay | 1-col stack | Scroll |
| <768px | Full-screen overlay | 1-col stack | Card layout |

### 8.2 Container Queries

Used for components that adapt to their container width (bento cards) rather than viewport width:

```css
.bento-card { container-type: inline-size; container-name: bento; }

@container bento (max-width: 450px) { .bento-inner-grid { grid-template-columns: 1fr 1fr; } }
@container bento (max-width: 280px) { .bento-inner-grid { grid-template-columns: 1fr; } }
```

### 8.3 Mobile-Specific Rules

- Touch targets: 44×44px minimum (WCAG 2.5.8)
- iOS: inputs use `font-size: 16px` to prevent auto-zoom
- Safe area insets via `env(safe-area-inset-*)` on sidebar and main content
- Tables transform to stacked card layout at <768px using `data-label` attributes

### 8.4 Progressive Mobile Priority

| Page | Priority | Mobile Experience |
|------|----------|-------------------|
| Dashboard | ★★★ | Full responsive, bento → cards, charts → summary fallback |
| Audit Logs | ★★★ | Table → card layout |
| Auth/Login | ★★★ | Already mobile-first |
| Chatbot Admin | ★★☆ | Tab nav, detail panel → full-screen slide |
| CMS Editor | ★☆☆ | Functional but simplified |

---

## 9. Component Patterns

### 9.1 Naming Convention

| Pattern | Example | Rule |
|---------|---------|------|
| Base element | `.btn`, `.input`, `.badge` | Noun, lowercase |
| Variant | `.btn-primary`, `.btn-danger` | `base-variant` |
| Modifier | `.btn--sm`, `.btn--lg` | `base--modifier` |
| Child | `.bento-header`, `.bento-title` | `parent-child` |

No BEM `__` double underscore. Single hyphen for children, double hyphen for modifiers.

### 9.2 Bento Card

The fundamental dashboard widget container.

```css
.bento-card {
  background: var(--theme-surface-raised);
  border: 1px solid var(--theme-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  container-type: inline-size;
  transition: border-color var(--duration-fast) ease;
}
.bento-card:hover { border-color: var(--theme-border-default); }
```

Modifiers: `.bento-card.primary-gradient`, `.bento-card--full`, `.bento-card--compact`, `.bento-card--interactive`

### 9.3 Button Variants

| Class | Style |
|-------|-------|
| `.btn-primary` | Accent-filled, white text |
| `.btn-secondary` | Surface-raised bg, border |
| `.btn-ghost` | Transparent, low emphasis |
| `.btn-danger` | Red tinted, destructive |
| `.btn-icon` | 36×36px square, icon-only |

Base `.btn` minimum height: 36px. Sizes: `.btn--sm` (28px), `.btn--lg` (44px). All have `scale(0.98)` press-down on `:active`.

### 9.4 Badge Variants

`.badge--success/warning/danger/info` for status. `.badge--role-dev/superadmin/admin/staff` for RBAC. `.badge--neutral` for generic labels. All uppercase, `--tracking-widest`, 11px/600.

### 9.5 Form Inputs

`.input` base with Blue-500 focus ring + glow (`0 0 0 3px var(--theme-accent-subtle)`). `.input--error` uses danger color. All inputs must have associated `<label>` or `aria-label`.

### 9.6 Data Table

`.data-table` with sticky headers (`position: sticky; top: 0`). Row hover uses `--theme-accent-subtle`. Selected rows use `--theme-accent-muted`. Monospace cell class: `.cell-mono`. Mobile: transforms to stacked cards via media query.

### 9.7 Toast

`.toast` slides in from right with spring easing. Left-border color signals type (`toast--success/warning/error/info`). Rendered in `role="status" aria-live="polite"` container.

### 9.8 Modal

`.modal-backdrop` with `blur(4px)` scrim. `.modal` uses spring `modalEnter` animation (`scale(0.96) → 1`). Focus trapped via `useFocusTrap`. `Escape` closes.

---

## 10. Cross-References

- **RBAC role hierarchy** → See [USER-MANAGEMENT.md](./USER-MANAGEMENT.md)
- **Chatbot admin component inventory** → See [CHATBOT.md](./CHATBOT.md)
- **Login forensics CSS module** → See [LOGIN-FORENSICS.md](./LOGIN-FORENSICS.md) §7
- **CSP + security headers** → See [SECURITY.md](./SECURITY.md) §4

{% endraw %}

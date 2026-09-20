---

title: "Design System — 'Midnight Slate'"
status: active
audience: [ai, technical]
last_verified: 2026-09-20
verified_against: [code]
owner: harshil
related_code: [src/styles/, src/components/ui/, src/components/navigation/Sidebar/]
tags: [css, tokens, theming, accessibility, motion]
---

# Design System — "Midnight Slate"

> **TL;DR (non-technical):** The visual design system ("Midnight Slate") — the colors, surfaces, spacing, and component patterns that keep the admin UI consistent.

> **How to read this doc.** The token values in §2 are the shipped values in
> `src/styles/themes/*.css`. Sections describing patterns the code never adopted
> are marked ***target, not implemented*** — §2.9, §6.1, §6.2, §6.3, §6.4, §7.4,
> §8.1, §8.2 and §9. A target is a thing to build, **not** a description of what
> is on screen; do not cite one as current behaviour. Baseline v4.6 (2026-05-25:
> theme default changed to hardcoded dark, OS detection removed); re-verified
> 2026-09-14 and 2026-09-20.

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
| **Theme Strategy** | Dark (default) + Light toggle | Cookie-persisted, SSR-compatible, dark hardcoded default (no OS detection) |
| **CSS Architecture** | Two paradigms: Tailwind utilities + Component CSS with tokens | Kill inline styles, kill raw hex values |
| **Animation** | Purposeful only — every animation shows real data | No decorative-only effects |

### What Was Eliminated

Verified 2026-09-20 — each of the first five has **0 occurrences** in `src/`:

- `#00e5ff` neon cyan interactive accent → replaced by Blue-500
- `rgba(99,102,241,...)` indigo interactive accents
- `rgba(139,92,246,...)` violet interactive accents
- `zoom: 1.1` on DashboardController
- `data-theme="slate"` attribute → replaced by `data-theme="dark"`

The two below were **not** eliminated and are tracked debt, not achieved states:

- Inline `style={{}}` objects and raw hex in components — held by `.ratchet.json`
  `A6` / `A7` (the counts may fall, never rise). Measured 2026-09-20: **922
  `style={` lines across 116 `.tsx` files**, and 455 raw six-digit-hex lines in
  75 files under `src/components/`. Many are static, not computed (e.g. the
  sidebar's `280px`/`72px` width and `CommandPalette.tsx`'s inline `animation:`).
  `coding-standards.md` §1/§3 uses the same ratchet framing.
- `window.location.reload()` — **6 call sites remain**, four of them dashboard
  surfaces (`InquiriesDashboard.tsx`, `ConfigEditor.tsx`, `TopBar.tsx`,
  `UserSettingsPanel.tsx`), plus `ui/ErrorBoundary.tsx` and one API route. What
  went away is the *automatic* CMS/dashboard refresh reload; explicit
  user-triggered reloads are still the pattern.

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
/* Dark (src/styles/themes/dark.css, 2026-09-14) */
--theme-bg:               #080e1a;
--theme-surface:          #0f172a;
--theme-surface-raised:   #1e293b;
--theme-surface-overlay:  #2d3a4f;
--theme-surface-elevated: #3c4b63;

/* Light */
--theme-bg:               #F8FAFC;
--theme-surface:          #FFFFFF;
--theme-surface-raised:   #F1F5F9;
--theme-surface-overlay:  #E2E8F0;
--theme-surface-elevated: #CBD5E1;
```

### 2.3 Text Hierarchy

```css
/* Dark (dark.css, 2026-09-14 — the ratios below were computed for the old
   #121214 / zinc palette and have NOT been re-measured for the slate palette;
   see ACCESSIBILITY.md §4) */
--theme-text-primary:   #ffffff;
--theme-text-secondary: #cbd5e1;    /* slate-300 */
--theme-text-tertiary:  #94a3b8;    /* slate-400 */
--theme-text-muted:     #64748b;    /* slate-500 */
```

> **Rule:** `--text-muted` for large text (≥14px bold or ≥18px) only — never for essential information.

### 2.4 Border System

```css
/* Dark (dark.css, 2026-09-14) */
--theme-border-subtle:  rgba(148, 163, 184, 0.05);
--theme-border-default: rgba(148, 163, 184, 0.10);
--theme-border-strong:  rgba(148, 163, 184, 0.20);
--theme-border-accent:  rgba(59, 130, 246, 0.45);
```

### 2.5 Glassmorphism Tokens

```css
/* Dark (dark.css, 2026-09-14) */
--theme-glass:         rgba(8, 14, 26, 0.70);
--theme-glass-strong:  rgba(15, 23, 42, 0.88);
--theme-glass-border:  rgba(148, 163, 184, 0.08);
--theme-glass-hover:   rgba(30, 41, 59, 0.80);
--theme-glass-inner:   inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
```

### 2.6 Section Colors (Navigation Identity Only)

Section colors identify sidebar sections — NOT used for interactive elements (buttons, links, focus rings always use `--theme-accent`).

**Seven** tokens exist, and the two themes do not agree on all of them:

| Token | Dark | Light | Intended for |
|---|---|---|---|
| `--theme-violet` | `#b794f4` | `#0d9488` (**a teal**) | Admin, Users, Roles |
| `--theme-cyan` | `#22d3ee` | `#0ea5e9` | Dashboard, Analytics |
| `--theme-amber` | `#f6ad55` | `#d97706` | Reports, Billing |
| `--theme-emerald` | `#4ade80` | `#10b981` | CMS, Content |
| `--theme-blue` | `#60a5fa` | `#3b82f6` | AI Server, Chatbot |
| `--theme-rose` | `#fb7185` | `#e11d48` | Logs, Audit |
| `--theme-red` | `#f87171` | `#ef4444` | Danger, destructive |

⚠️ **Violet has a token but no `data-section` wiring** (re-verified 2026-09-20).
The 2026-09-14 pass fixed the token itself in both theme files — it had been
mis-typed as a second `--theme-emerald`, so `--theme-violet` (consumed by
`src/lib/bookings/constants.ts`) resolved to nothing — but the *same* mis-typing
in the section plumbing was never repaired:

- `src/styles/global.css` declares the `--color-section-emerald-*` group
  **twice** where the violet group belongs, so `--color-section-violet-*` does
  not exist.
- `src/styles/sections.css` has **two identical `[data-section="emerald"]`
  blocks** and no `[data-section="violet"]`; its own header comment reads
  `data-section="emerald|cyan|amber|emerald|blue|rose|red"` — emerald twice,
  violet absent.
- Nothing in `src/` sets `data-section="violet"`. Live usage: blue ×6, cyan ×4,
  emerald ×2, red ×2, rose ×2, amber ×1.

Also note the light theme: `--theme-violet` is `#0d9488`, so a "violet" section
would render **teal** on light. Fix the CSS before relying on either.

Applied via the `data-section` attribute; children consume `var(--section-color)` etc.

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
/* global.css, 2026-09-14 — only these four exist; there is no --color-role-owner.
   Runtime role badges use the .role-badge--{vendor_support|owner|admin|manager|staff|viewer|suspended}
   classes in global.css instead. */
--color-role-dev:        var(--theme-red);       /* Red */
--color-role-superadmin: var(--theme-amber);     /* Amber */
--color-role-admin:      var(--theme-emerald);   /* Emerald (not violet) */
--color-role-staff:      var(--theme-blue);      /* Blue */
```

### 2.9 Typography

```css
--font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
--font-family-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
```

**Type scale (target — no such tokens or classes exist in the code as of 2026-09-14; sizes are applied per component with Tailwind utilities):** `display` (32px/800) → `headline` (24px/700) → `title` (18px/650) → `subtitle` (15px/600) → `body` (14px/400) → `body-sm` (13px/400) → `caption` (12px/500) → `micro` (11px/600) → `mono-data` (14px/500, JetBrains)

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

/* Purple values, but the token is named "teal" in dark.css (2026-09-14) */
--color-badge-teal:           #c084fc;
--color-badge-teal-bg:        rgba(192, 132, 252, 0.15);
--color-badge-teal-border:    rgba(192, 132, 252, 0.3);
```

**Usage:** In `src/styles/components/chatbot/buttons-badges.css`, the `.chatbot-badge-*` selectors reference these variables, except `.chatbot-badge-primary`, `-fallback` and `-thinking`, which still carry raw `#60a5fa` / `#fbbf24` / `#c084fc` and `rgba()` literals (2026-09-14).

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

/* Motion (global.css) — declared, but see the warning below */
--duration-[120ms]: 120ms;  --duration-[200ms]: 200ms;  --duration-[350ms]: 350ms;
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
```

🚨 **The three `--duration-*` entries are unusable via `var()`.** `[` and `]` are
not valid CSS identifier characters, so `var(--duration-[200ms])` never resolves
and the declaration containing it is dropped — you get no transition at all.
Zero files in `src/` use that form. The real mechanism everywhere is the
**Tailwind utility** of the same name, e.g. `@apply transition-colors
duration-[200ms]`. The one `var(--duration-…)` call site in the repo
(`src/components/ui/AccessDeniedView.astro`) names `--duration-normal`, which was
never defined, and works only via its literal `200ms` fallback. Renaming the
three to `--duration-fast/normal/slow` is an open code change.
`coding-standards.md` §7 is the normative statement of this rule and agrees.

---

## 3. CSS Architecture

**Rule: Two paradigms only.**

| Paradigm | Use For |
|----------|---------|
| **Tailwind utilities** | Layout, spacing, sizing, flexbox, grid, responsive |
| **CSS Custom Properties + Component CSS** | Colors, animations, pseudo-elements, glassmorphism |

**Banned for new code:** Inline `style={{}}` in JSX (except dynamic computed values from ResizeObserver), raw hex/rgba in component code, `onMouseOver` style manipulation (use CSS `:hover`).

*Existing violations are held, not eliminated: `.ratchet.json` `A6` (inline-style
lines) and `A7` (raw-hex lines) may fall but never rise. See §1 for the measured
counts — this is a burn-down, not a clean tree.*

### File Structure

```
src/styles/
├── global.css              ← @import orchestrator + @theme bridge + base resets
├── themes/
│   ├── dark.css            ← :root dark tokens (includes --color-badge-* variables)
│   └── light.css           ← :root[data-theme="light"] tokens
├── sections.css            ← data-section attribute color resolution
├── utilities.css           ← Custom utility classes (.sr-only, etc.)
├── bookings.css            ← Bookings dashboard styles
├── components/             ← Component-scoped CSS (2026-09-14 listing)
│   ├── blog-studio.css, cms-module-panel.css, seo-patterns.css
│   └── chatbot/
│       ├── buttons-badges.css   ← .chatbot-badge-* (mostly --color-badge-* vars; three raw-hex selectors remain)
│       ├── stats.css            ← .ad-* analytics dashboard classes (extracted from AnalyticsDashboard.tsx)
│       └── cards, forms, layout, messages, modal-toast, tables, utilities .css
└── pages/                  ← Page-level overrides
    ├── audit.css, cron.css, diagnostics.css
    └── privacy-dashboard.css, session-registry.css
```

*(Listing re-checked 2026-09-20 — 23 files; `pages/cron.css` landed with the
cron control plane on 2026-09-16. Run `find src/styles -type f` rather than
trusting this tree if the two disagree.)*

Component and page CSS are **NOT** imported in `global.css` (one exception: `blog-studio.css`). Each component/page imports its own CSS — Astro handles per-route code splitting automatically. *(A "67–86% per-page payload reduction" has been claimed for this since the split; no measurement of it exists in the repo, so treat the direction as right and the number as unverified.)*

**Note on widget shared utilities:** The canonical shared widget file is `src/components/dashboard/widgets/WidgetShared.tsx`. The former `WidgetSharedV2.tsx` was merged into it and deleted (Phase 3B). All imports must reference `WidgetShared`, never `WidgetSharedV2`.

**CSS layer precedence:** `@layer base` → `@layer components` → `@layer utilities` (Tailwind utilities win).

---

## 4. Theme System

### 4.1 Detection Cascade

```
1. Cookie cf_admin_theme → "dark" | "light"     (user's explicit toggle choice)
2. Default: "dark"                                   (hardcoded — OS preference NOT respected)
```

### 4.2 Zero-FOWT SSR Integration

`data-theme` lives on `<html>` (the `:root`). A blocking `<script is:inline src="/scripts/theme-init.js">` in `<head>` (an external 511-byte file, not inline script text — it carries the CSP nonce) reads the cookie and, if no cookie exists, defaults to dark. It does not check `prefers-color-scheme`; the one place that still does is the `system` option in `UserSettingsPanel.tsx`, which clears the cookie and reads `matchMedia` once (and `admin_user_settings.theme` defaults to `'system'`). The attribute is set synchronously before paint.

```css
/* dark.css */
:root, :root[data-theme="dark"] { /* dark tokens */ }

/* light.css */
:root[data-theme="light"] { /* light tokens override :root defaults */ }
```

### 4.3 ThemeToggle Component

Lives in its own file `src/components/navigation/ThemeToggle.tsx` (imported by `TopBar`). On toggle: updates `document.documentElement.dataset.theme` immediately, sets `cf_admin_theme` cookie (1 year, SameSite=Strict), POSTs the choice to `/api/settings/user` so it persists in D1, and dispatches `CustomEvent('theme-change')` for components that re-render on theme. The OS preference `matchMedia` listener was removed — the component no longer reacts to system-level theme changes.

---

## 5. Page Layouts

**Philosophy:** Each page gets the density its content demands.

### Shell Structure (`AdminLayout.astro`)

```
┌──────────────────────────────────────────┐
│  TopBar (sticky, z-30, 52px, glass)      │
├──────┬───────────────────────────────────┤
│      │                                   │
│ Side │  <main id="main-content">         │
│  bar │    <slot />                       │
│      │                                   │
└──────┴───────────────────────────────────┘
```

`.admin-content-area` sits in a flex row with `margin-left: 0 !important` (`AdminLayout.css`); there is no `--sidebar-width` token. *(Corrected 2026-09-14.)*

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
| Expanded (default when the cookie is absent) | 280px | Page load |
| Collapsed | 72px | Click pin (saved to `cf_admin_sidebar_collapsed` cookie); hover re-expands to 280px, 300 ms |
| Hidden | 0 | < 1024px breakpoint |

### Login Portal — "Midnight Slate" *(historical — there is no login page; Cloudflare Access hosts login and `src/pages/index.astro` is the access-denied / dev gate. The orbs + `feTurbulence` noise live in `AdminLayout.css` at `opacity: 0.03`)*

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
/* Declared in global.css — but usable ONLY as Tailwind utilities, not via var().
   See the warning in §2.11: `var(--duration-[200ms])` cannot parse. */
--duration-[120ms]: 120ms;  /* hover, focus rings      → class: duration-[120ms] */
--duration-[200ms]: 200ms;  /* panel reveals, tabs     → class: duration-[200ms] */
--duration-[350ms]: 350ms;  /* page transitions        → class: duration-[350ms] */
--ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1);   /* emphasis — usable via var() */
/* Target only — never defined: --duration-fast/normal/slow, --ease-out, --ease-in */
```

### 6.2 Truthful Animations *(target, not implemented — only the health dots exist; re-verified 2026-09-20)*

- **Health dots** pulse only when healthy (green, 3s); static red = down; amber slow-pulse = degraded — *shipped*
- **Stat counters** animate from 0 → real value using a `useAnimatedCounter` hook (ease-out curve, 800ms) — *target; `useAnimatedCounter` does not exist anywhere in `src/`*
- **Quota bars** animate width to real usage percentage; color changes at warning/critical thresholds — *target*
- **Activity feed** new items slide in from top with `slideInFromTop` + spring easing — *target, and a live defect:* `slideInFromTop` appears exactly once, as an inline `animation:` in `src/components/navigation/CommandPalette.tsx`, and **no `@keyframes slideInFromTop` is defined anywhere in the repo** — it is not among the `@keyframes` blocks in `src/`. The command palette therefore has no entrance animation, and nothing in an activity feed uses it.

### 6.3 Standard Patterns *(target — `useAnimatedCounter`, `slideInFromTop`, `.bento-card:nth-child` stagger and `.skeleton` do not exist in the code as of 2026-09-14; only `fadeIn` in `utilities.css` does)*

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
}
/* 2026-09-14: the shipped block in utilities.css ends here — it only zeroes durations.
   Hiding the orbs (.admin-orb in AdminLayout.css) and the view-transition rules are target, not implemented. */
```

**Performance rules:** Animate only `transform`/`opacity` — never layout properties. `will-change: transform` only on actively animating orbs. Nothing over 500ms.

---

## 7. Accessibility (WCAG 2.2 AA)

### 7.1 Contrast Ratios (Dark Theme) — *measured against the retired #121214 / zinc palette; not re-measured for the current slate tokens (ACCESSIBILITY.md §4)*

| Token Pair | Contrast | Level |
|------------|----------|-------|
| `--text-primary` (#fff) on `--surface` | 17.1:1 | AAA |
| `--text-secondary` (#a1a1aa) on `--surface` | 7.2:1 | AAA |
| `--text-tertiary` (#8a8a93) on `--surface` | 5.3:1 | AA |
| `--accent` (#3b82f6) on `--surface` | 4.8:1 | AA |
| `--success` (#4ade80) on `--surface` | 8.5:1 | AAA |
| `--danger` (#f87171) on `--surface` | 5.6:1 | AA |

### 7.2 Landmark Structure *(2026-09-14: `<div role="banner">` wraps the TopBar, not `<header class="topbar">`; there is no Breadcrumb `<nav>`; the toast region has `aria-live="polite"` but no `role="status"` / `aria-label`. The skip link, `<nav aria-label="Main navigation">` and `<main id="main-content">` are as described)*

```html
<a href="#main-content" class="skip-nav">Skip to main content</a>
<nav aria-label="Main navigation" class="sidebar">...</nav>
<header role="banner" class="topbar">
  <nav aria-label="Breadcrumb">...</nav>
</header>
<main id="main-content" class="admin-main-content">...</main>
<div role="status" aria-live="polite" aria-label="Notifications">...</div>
```

### 7.3 Keyboard Shortcuts *(Ctrl/Cmd+K, Escape and arrow keys in the palette verified 2026-09-14)*

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Navigate focus |
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Escape` | Close modal/dropdown/palette |
| `Arrow Up/Down` | Navigate sidebar / palette results |

**Focus trapping.** There is no `useFocusTrap` hook and none is needed for
modals: the 50 `<dialog>` elements in `src/` get the trap natively, which is why
`RULESAd.md` §7.8 makes `<dialog>` the mandatory modal pattern.
⚠️ **The command palette is the exception and is an open defect** (re-verified
2026-09-20): `src/components/navigation/CommandPalette.tsx` is a plain
`<div aria-modal="true">` with no `<dialog>`, no `showModal()` and no trap, so
Tab walks straight out of the palette into the page behind it.

### 7.4 Rules *(two of these are unmet targets — see the labels)*

- Every icon-only button requires `aria-label` — *enforced by `scripts/a11y_check.py` A11Y-01, which also accepts `title`; see `coding-standards.md` §6*
- Form errors announced via `role="alert"` + `aria-describedby`
- `role="progressbar"` + `aria-valuenow` on quota bars — ***target, unmet:*** `role="progressbar"` has **0 occurrences** in `src/`
- `role="tablist"` + `role="tab"` + `aria-selected` on chatbot admin tabs — ***target, unmet:*** `role="tablist"` has 3 uses (`ContentTabs.astro`, `ActivityCenter.tsx`, `ui/Tabs.tsx`), **none of them under `src/components/admin/chatbot/`**
- Color must NOT be the only state indicator — add icons/text too
- Live regions: `aria-live="polite"` on toast region and loading states

Nothing enforces the two unmet rules — `scripts/a11y_check.py` covers only
button names, `img` alt, `dialog` names, link text, positive `tabindex` and
`<html lang>`. Track them in
[`../security/compliance/ACCESSIBILITY.md`](../security/compliance/ACCESSIBILITY.md),
which the script names as the honest conformance home.

---

## 8. Responsive & Mobile

**Philosophy:** Core pages fully responsive; CRUD pages functional but simplified. Admins check dashboards on phones; they don't edit CMS hero sections on phones.

### 8.1 Breakpoints (Tailwind standard)

The sidebar has exactly **one** breakpoint — `lg` (1024px). Re-verified
2026-09-20 against `src/components/navigation/Sidebar/index.tsx`: the desktop
`<aside>` is `hidden lg:flex` and the mobile overlay is `lg:hidden`.

| Breakpoint | Sidebar | Grid | Tables |
|------------|---------|------|--------|
| ≥1024px (`lg`) | Always present; 280px expanded / 72px collapsed | 2-col bento | Full |
| <1024px | Slide-in overlay (`max-w-[280px]`, `slideInFromLeft`), hamburger | 1-col stack | Scroll |

- **The 280px ↔ 72px collapse is a user preference, not a width rule** — it is
  driven by the `cf_admin_sidebar_collapsed` cookie.
- There is no 1280px tier and no separate `<768px` sidebar behaviour. The
  four-tier table this replaced described neither the code nor a plan.
- The Grid and Tables columns are *targets* and are not verified per-page here.

### 8.2 Container Queries *(target — no `@container` / `container-type` in any stylesheet as of 2026-09-14)*

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

## 9. Component Patterns *(target vocabulary — see §11: as of 2026-09-14 the code has no `.btn` base / `.btn--sm` / `.badge--*` / `.input--error` / `.cell-mono` / `.toast--*` / `modalEnter`; `.bento-card` lived in `DashboardStyles.astro` until that file was deleted on 2026-09-15 (`4e60c9d`) — no `.bento-card` rule exists now; `.data-table__*` in `global.css` does use BEM `__`)*

### 9.1 Naming Convention

| Pattern | Example | Rule |
|---------|---------|------|
| Base element | `.btn`, `.input`, `.badge` | Noun, lowercase |
| Variant | `.btn-primary`, `.btn-danger` | `base-variant` |
| Modifier | `.btn--sm`, `.btn--lg` | `base--modifier` |
| Child | `.bento-header`, `.bento-title` | `parent-child` |

No BEM `__` double underscore. Single hyphen for children, double hyphen for modifiers.

⚠️ **The "never adopted" note above applies to the *unprefixed* vocabulary
only.** The `base--modifier` half of this convention is shipped and widespread,
under per-module prefixes: `.role-badge--vendor_support|owner|admin|manager|staff|viewer|suspended`
(`global.css`, documented in §2.8), `.sr-btn--sm/--ghost/--danger`,
`.hero-badge--warning/--success/--amber`, plus diff badges in `pages/audit.css`
and query-kind badges in `pages/cron.css`. And `__` does appear —
`.data-table__*` in `global.css` uses it. Read §9 as: *the generic `.btn` /
`.badge` vocabulary was never adopted; the shipped convention is a per-module
prefix with `--modifier`.*

### 9.2 Bento Card *(target — the rule below has no implementation since the dashboard remodel of 2026-09-15; dashboard cards are the shared `Card` / `MetricCard` components with Tailwind utilities)*

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

> **Not the pattern to follow.** `modalEnter` and `useFocusTrap` have 0
> occurrences in `src/`. The mandatory modal pattern is native `<dialog>` +
> `showModal()`, owned by `RULESAd.md` §7.8 — see §7.3 above.

---

## 10. Cross-References

- **RBAC role hierarchy** → See [USER-MANAGEMENT.md](../features/USER-MANAGEMENT.md)
- **Chatbot admin component inventory** → See [CHATBOT.md](../features/CHATBOT.md)
- **Login forensics CSS module** → See [LOGIN-FORENSICS.md](../security/login-forensics.md) §7
- **CSP + security headers** → See [SECURITY.md](../security/SECURITY.md) §4
- **Code-side rules (motion tokens, a11y, component size)** → See [coding-standards.md](coding-standards.md) §3, §6, §7
- **Accessibility conformance position** → See [ACCESSIBILITY.md](../security/compliance/ACCESSIBILITY.md)

## 11. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-14 | Every token value in §2 against `src/styles/themes/dark.css`, `light.css` and `global.css` (dark surfaces, text, borders, glass, section colours, role tokens, badge tokens, fonts, spacing, radii, shadows, motion); the `src/styles` tree; `theme-init.js`, `ThemeToggle.tsx`, `UserSettingsPanel.tsx`; `AdminLayout.astro` / `AdminLayout.css` (landmarks, orbs, content area); `TopBar.tsx` and `Sidebar/index.tsx` geometry; `utilities.css` reduced-motion block; grep for every class, hook and keyframe named in §6–§9. **Result:** §1, §2.1 (accents), §2.7, §2.11 (spacing/radius/shadow), §3 architecture prose, §4.1, §5 shell and §7.3 hold; the dark palette in §2.2–2.5 was the pre-slate zinc palette and is now corrected; §2.9 type scale, §6.1 extra tokens, §6.3, §6.4 extras, §8.2 and §9 describe a target vocabulary the code never adopted and are labelled as such rather than deleted; the `--theme-violet` mis-declaration was fixed in both theme files. | Contrast ratios for the slate palette; the "67–86 % payload reduction" figure; Phase 3B/7C history |
| 2026-09-20 | §1 "What Was Eliminated" re-measured (five items genuinely gone; inline styles and `location.reload()` are **not** — `.ratchet.json` A6/A7, 6 reload call sites); §2.6 rebuilt as a seven-token table with both theme values, and the violet `data-section` plumbing confirmed **still unwired** (`global.css` and `sections.css` each duplicate the emerald group); §2.11/§6.1 motion tokens confirmed unusable via `var()`; `src/styles` tree re-listed (23 files, `pages/cron.css` added); §6.2 labelled target, with `slideInFromTop` recorded as a dangling animation with no `@keyframes`; §7.3 focus-trap claim corrected (native `<dialog>` ×50; the command palette is a `div` with no trap); §7.4 `progressbar` 0 / `tablist` 3-none-in-chatbot labelled unmet; §8.1 breakpoint table replaced with the one real `lg` breakpoint; §9/§9.8 rephrased (prefixed `--modifier` is shipped, `useFocusTrap`/`modalEnter` are 0). | Contrast ratios for the slate palette (still measured against the retired zinc palette); the "67–86 % payload reduction" figure (no measurement exists in the repo); Phase 3B/7C history |

{% raw %}
# 01 — Design Token System

> **Purpose:** Single source of truth for every visual value in cf-admin.  
> **Paradigm:** CSS Custom Properties defined in `@layer base`, consumed via Tailwind `@theme` bridge and direct `var()` references.  
> **Color Space:** OKLCH for perceptual uniformity. Hex fallbacks generated for legacy browsers.

---

## 1. Color Architecture

### 1.1 Accent Family — Blue-500

The entire interactive accent palette is unified under a single Blue-500 hue. This replaces the previous split between neon cyan (`#00e5ff`), indigo (`rgba(99,102,241,...)`), and violet (`rgba(139,92,246,...)`).

**Why Blue-500?** It's Linear's actual accent color. It has excellent contrast ratios on both dark and light surfaces, gorgeous shade ramps that feel professional rather than playful, and perceptually uniform lightness steps in OKLCH.

#### Dark Theme Accent Tokens

```css
/* ── Accent: Blue-500 Family (Dark) ── */
--theme-accent:        oklch(0.637 0.191 264.1);   /* #3b82f6 — Primary interactive */
--theme-accent-hover:  oklch(0.707 0.165 264.1);   /* #60a5fa — Hover state */
--theme-accent-muted:  oklch(0.637 0.191 264.1 / 0.15);  /* Subtle backgrounds */
--theme-accent-glow:   oklch(0.637 0.191 264.1 / 0.40);  /* Focus rings, glows */
--theme-accent-subtle: oklch(0.637 0.191 264.1 / 0.08);  /* Barely-there tints */
```

**Hex Equivalents (for reference):**

| Token | OKLCH | Hex | Usage |
|-------|-------|-----|-------|
| `--theme-accent` | `oklch(0.637 0.191 264.1)` | `#3b82f6` | Buttons, links, active states |
| `--theme-accent-hover` | `oklch(0.707 0.165 264.1)` | `#60a5fa` | Hover overlays, highlighted text |
| `--theme-accent-muted` | 15% opacity | — | Badge backgrounds, selected rows |
| `--theme-accent-glow` | 40% opacity | — | Focus rings, glow effects |
| `--theme-accent-subtle` | 8% opacity | — | Subtle tints on hover surfaces |

#### Light Theme Accent Tokens

```css
/* ── Accent: Blue-500 Family (Light) ── */
--theme-accent:        oklch(0.546 0.245 264.1);   /* #2563eb — Darker for light bg contrast */
--theme-accent-hover:  oklch(0.488 0.243 264.1);   /* #1d4ed8 — Even darker on hover */
--theme-accent-muted:  oklch(0.546 0.245 264.1 / 0.12);
--theme-accent-glow:   oklch(0.546 0.245 264.1 / 0.25);
--theme-accent-subtle: oklch(0.546 0.245 264.1 / 0.06);
```

> **Key Insight:** Light theme accents use a DARKER shade (Blue-600/700) to maintain WCAG AA contrast against white/light surfaces. Dark theme uses the brighter Blue-500/400.

---

### 1.2 Surface Elevation System

Five distinct elevation layers create visual depth without relying on heavy shadows.

#### Dark Theme Surfaces

```css
/* Canvas → Surface → Raised → Overlay → Elevated */
--theme-bg:               #09090b;   /* L0: Page canvas, deepest layer */
--theme-surface:          #121214;   /* L1: Sidebar, content area background */
--theme-surface-raised:   #18191c;   /* L2: Cards, bento grid cells */
--theme-surface-overlay:  #212226;   /* L3: Popovers, dropdowns, modals */
--theme-surface-elevated: #2b2d31;   /* L4: Tooltips, command palette */
```

#### Light Theme Surfaces

```css
--theme-bg:               #F8FAFC;   /* L0: Slate-50 canvas */
--theme-surface:          #FFFFFF;   /* L1: Pure white content */
--theme-surface-raised:   #F1F5F9;   /* L2: Slate-100 cards */
--theme-surface-overlay:  #E2E8F0;   /* L3: Slate-200 dropdowns */
--theme-surface-elevated: #CBD5E1;   /* L4: Slate-300 tooltips */
```

**Elevation Diagram:**

```
┌─────────────────────────────────────────┐
│  L0: --theme-bg                         │  Page canvas
│  ┌───────────────────────────────────┐  │
│  │  L1: --theme-surface              │  │  Sidebar / main content
│  │  ┌─────────────────────────────┐  │  │
│  │  │  L2: --theme-surface-raised │  │  │  Cards, bento cells
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │ L3: --surface-overlay │  │  │  │  Popovers, modals
│  │  │  │  ┌─────────────────┐  │  │  │  │
│  │  │  │  │L4: -elevated    │  │  │  │  │  Tooltips
│  │  │  │  └─────────────────┘  │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

### 1.3 Text Hierarchy

Four text levels ensure clear information hierarchy while maintaining WCAG AA compliance.

#### Dark Theme

```css
--theme-text-primary:   #ffffff;     /* Headlines, key data values, navigation labels */
--theme-text-secondary: #a1a1aa;     /* Body text, descriptions, form labels */
--theme-text-tertiary:  #8a8a93;     /* Timestamps, supplementary info, chart labels */
--theme-text-muted:     #71717a;     /* Placeholders, disabled states, ghost text */
```

#### Light Theme

```css
--theme-text-primary:   #0F172A;     /* Slate-900: Maximum contrast */
--theme-text-secondary: #475569;     /* Slate-600: Standard body */
--theme-text-tertiary:  #64748B;     /* Slate-500: Supporting text */
--theme-text-muted:     #94A3B8;     /* Slate-400: Minimum weight */
```

**Contrast Ratios (Dark, against `#121214` surface):**

| Token | Color | Contrast Ratio | WCAG Level |
|-------|-------|---------------|------------|
| `--theme-text-primary` | `#ffffff` | 17.1:1 | AAA |
| `--theme-text-secondary` | `#a1a1aa` | 7.2:1 | AAA |
| `--theme-text-tertiary` | `#8a8a93` | 5.3:1 | AA |
| `--theme-text-muted` | `#71717a` | 4.0:1 | AA (large) |

---

### 1.4 Border System

```css
/* Dark Theme */
--theme-border-subtle:  rgba(255, 255, 255, 0.05);  /* Internal card dividers */
--theme-border-default: rgba(255, 255, 255, 0.12);  /* Standard boundaries */
--theme-border-strong:  rgba(255, 255, 255, 0.20);  /* Emphasized borders, hover */
--theme-border-accent:  rgba(59, 130, 246, 0.40);   /* ← CHANGED from white to Blue-500 */

/* Light Theme */
--theme-border-subtle:  rgba(15, 23, 42, 0.05);
--theme-border-default: rgba(15, 23, 42, 0.10);
--theme-border-strong:  rgba(15, 23, 42, 0.20);
--theme-border-accent:  rgba(37, 99, 235, 0.40);    /* Blue-600 accent border */
```

---

### 1.5 Glassmorphism Tokens

```css
/* Dark Theme Glass */
--theme-glass:         rgba(18, 18, 20, 0.7);        /* Standard glass panel */
--theme-glass-strong:  rgba(24, 25, 28, 0.85);       /* Dense glass (sidebar, bars) */
--theme-glass-border:  rgba(255, 255, 255, 0.08);    /* Glass panel edge highlight */
--theme-glass-hover:   rgba(24, 25, 28, 0.8);        /* Glass on hover */
--theme-glass-inner:   inset 0 1px 0 0 rgba(255, 255, 255, 0.05); /* Top-light inner glow */

/* Light Theme Glass */
--theme-glass:         rgba(255, 255, 255, 0.85);
--theme-glass-strong:  rgba(255, 255, 255, 0.95);
--theme-glass-border:  rgba(15, 23, 42, 0.05);
--theme-glass-hover:   rgba(255, 255, 255, 0.95);
--theme-glass-inner:   inset 0 0 0 1px rgba(15, 23, 42, 0.02);
```

---

### 1.6 Section Colors (Navigation Identity)

Section colors are used ONLY for navigation identity — sidebar icons, breadcrumb badges, and page header accents. They are NOT used for interactive elements (buttons, links, focus rings). Those always use `--theme-accent`.

```css
/* Dark Theme Section Colors */
--theme-violet:  #b794f4;    /* Admin, Users, Roles */
--theme-cyan:    #22d3ee;    /* Dashboard, Analytics — NOTE: demoted from accent to section-only */
--theme-amber:   #f6ad55;    /* Reports, Billing */
--theme-emerald: #4ade80;    /* CMS, Content */
--theme-blue:    #60a5fa;    /* AI Server, Chatbot */
--theme-rose:    #fb7185;    /* Logs, Audit */
--theme-red:     #f87171;    /* Danger, Delete actions */
```

**Section Color Resolution via `data-section` attribute:**

```html
<main data-section="cyan">
  <!-- All children can use var(--section-color) etc. -->
</main>
```

```css
[data-section="cyan"] {
  --section-color: var(--color-section-cyan);
  --section-muted: var(--color-section-cyan-muted);
  --section-glow:  var(--color-section-cyan-glow);
  /* ... full variant set ... */
}
```

---

### 1.7 Semantic Status Colors

```css
/* Consistent across themes, adjusted for background contrast */
/* Dark */
--theme-success: #4ade80;    /* Operations succeeded, health good */
--theme-warning: #f6ad55;    /* Attention needed, quota approaching */
--theme-danger:  #f87171;    /* Errors, failures, delete confirmations */
--theme-info:    #60a5fa;    /* Informational, tips, neutral highlights */

/* Light */
--theme-success: #10b981;    /* Deeper green for white backgrounds */
--theme-warning: #d97706;    /* Deeper amber */
--theme-danger:  #ef4444;    /* Deeper red */
--theme-info:    #3b82f6;    /* Matches accent in light mode */
```

---

### 1.8 RBAC Role Colors

Role badge colors are semantic and permanent — they should never change between themes (only intensity adjusts).

```css
--color-role-dev:        var(--theme-red);       /* Developer: Red badge */
--color-role-dev-bg:     /* 15% opacity */
--color-role-superadmin: var(--theme-amber);     /* Super Admin: Amber badge */
--color-role-superadmin-bg: /* 15% opacity */
--color-role-admin:      var(--theme-violet);    /* Admin: Violet badge */
--color-role-admin-bg:   /* 15% opacity */
--color-role-staff:      var(--theme-blue);      /* Staff: Blue badge */
--color-role-staff-bg:   /* 15% opacity */
```

---

## 2. Typography Tokens

### 2.1 Font Families

```css
--font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
--font-family-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
```

**Loading Strategy:**
- Google Fonts with `display=swap` and `preconnect`
- Inter: weights 400–800, variable with `opsz` axis
- JetBrains Mono: weights 400, 500, 600
- Feature settings: `'cv02', 'cv03', 'cv04', 'cv11'` — distinguishable characters

### 2.2 Type Scale

| Name | Size | Weight | Line Height | Use Case |
|------|------|--------|-------------|----------|
| `display` | 2rem (32px) | 800 | 1.1 | Page titles on spacious pages (e.g., CMS hero) |
| `headline` | 1.5rem (24px) | 700 | 1.2 | Dashboard "Overview" header |
| `title` | 1.125rem (18px) | 650 | 1.3 | Card titles, section headers |
| `subtitle` | 0.9375rem (15px) | 600 | 1.4 | Widget subtitles, sub-headers |
| `body` | 0.875rem (14px) | 400 | 1.6 | Default body text, descriptions |
| `body-sm` | 0.8125rem (13px) | 400 | 1.5 | Dense tables, compact lists |
| `caption` | 0.75rem (12px) | 500 | 1.4 | Labels, timestamps, badges |
| `micro` | 0.6875rem (11px) | 600 | 1.3 | Chart axis labels, tiny badges |
| `mono-data` | 0.875rem (14px) | 500 | 1.3 | Stat values, counts, IDs (JetBrains Mono) |

### 2.3 Letter Spacing

```css
--tracking-tight:  -0.02em;   /* Headlines, display text */
--tracking-normal:  0;         /* Body text */
--tracking-wide:    0.01em;    /* Buttons, UI labels */
--tracking-wider:   0.05em;    /* All-caps labels */
--tracking-widest:  0.1em;     /* Tiny uppercase badges (e.g. "TOKEN REQUIRED") */
```

---

## 3. Spacing System

Using a 4px base grid:

```css
--spacing-xs:  4px;     /* Micro gaps (icon-to-text) */
--spacing-sm:  8px;     /* Tight spacing (inline elements) */
--spacing-md:  16px;    /* Default gap (cards, form fields) */
--spacing-lg:  24px;    /* Section spacing */
--spacing-xl:  32px;    /* Major section dividers */
--spacing-2xl: 48px;    /* Page-level spacing */
--spacing-3xl: 64px;    /* Maximum breathing room */
```

**Grid alignment rule:** Every spacing value is a multiple of 4px to maintain pixel-perfect alignment at 1x and 2x DPI.

---

## 4. Border Radius Tokens

```css
--radius-sm:   6px;     /* Small interactive elements (badges, tags) */
--radius-md:   10px;    /* Buttons, inputs, small cards */
--radius-lg:   14px;    /* Bento cards, medium panels */
--radius-xl:   20px;    /* Large panels, modals */
--radius-2xl:  24px;    /* Hero sections, feature cards */
--radius-full: 9999px;  /* Circular elements (avatars, pills) */
```

---

## 5. Shadow System

```css
/* Base shadows (Dark theme — deeper for contrast) */
--shadow-sm:  0 1px 3px rgba(0, 0, 0, 0.4);
--shadow-md:  0 4px 12px rgba(0, 0, 0, 0.4);
--shadow-lg:  0 12px 32px rgba(0, 0, 0, 0.5);

/* Specialized */
--shadow-side-nav: 24px 0 80px -20px rgba(0, 0, 0, 0.6);
--shadow-card: 0 10px 30px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);

/* Light theme shadows are softer */
--shadow-sm:  0 1px 3px rgba(0, 0, 0, 0.06);
--shadow-md:  0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg:  0 12px 32px rgba(0, 0, 0, 0.12);
--shadow-card: 0 0 0 1px rgba(15,23,42,0.05), 0 32px 64px rgba(0,0,0,0.04);
```

---

## 6. Motion Tokens

```css
--duration-fast:   120ms;   /* Micro-interactions: hover, focus */
--duration-normal: 200ms;   /* Standard transitions: panel open, color change */
--duration-slow:   350ms;   /* Major transitions: page enter, drawer slide */
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);  /* Bouncy spring for emphasis */
--ease-out:        cubic-bezier(0.16, 1, 0.3, 1);       /* Natural deceleration */
--ease-in-out:     cubic-bezier(0.45, 0, 0.55, 1);      /* Symmetric ease */
```

---

## 7. Token Migration Map

Exact search-and-replace targets for the codebase cleanup:

| Old Value | New Token | Files Affected |
|-----------|-----------|----------------|
| `#00e5ff` | `var(--theme-accent)` → Blue-500 | `dark.css`, `Dashboard.css`, auth styles |
| `#4dffff` | `var(--theme-accent-hover)` | `dark.css` |
| `rgba(0, 229, 255, 0.15)` | `var(--theme-accent-muted)` | `dark.css` |
| `rgba(0, 229, 255, 0.4)` | `var(--theme-accent-glow)` | `dark.css` |
| `rgba(0, 229, 255, 0.08)` | `var(--theme-accent-subtle)` | `dark.css` |
| `rgba(99,102,241,...)` (any opacity) | `var(--theme-accent-*)` or section token | `auth.css` (12 occurrences) |
| `rgba(139,92,246,...)` (any opacity) | section token only | `auth.css` (2 occurrences) |
| `rgba(34,211,238,...)` interactive uses | `var(--theme-accent-*)` | `auth.css` (8 occurrences) |
| `#22d3ee` (interactive) | `var(--theme-accent)` | Various component files |
| `#d946ef` (fuchsia chart) | `var(--color-section-rose)` | `DashboardController.tsx` |
| `cyan-500/50` Tailwind class | `blue-500/50` | `DashboardController.tsx` |
{% endraw %}

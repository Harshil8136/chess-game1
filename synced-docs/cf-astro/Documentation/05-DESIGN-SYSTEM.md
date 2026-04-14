# 05 — Design System

## Brand Identity

| Property | Value |
|---|---|
| **Business Name** | Hotel para Mascotas Madagascar |
| **Location** | Aguascalientes, Mexico |
| **Target Market** | Pet owners in the Aguascalientes metropolitan area |
| **Brand Personality** | Warm, trustworthy, professional, nature-inspired |
| **Primary Aesthetic** | Emerald/green palette with clean, modern typography |

---

## Color Palette

All colors are defined as CSS custom properties in `src/styles/global.css` and consumed by Tailwind via `tailwind.config.mjs`.

### Brand Colors

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| `--color-primary` | `#166534` | `text-primary`, `bg-primary` | Primary brand green (CTA buttons, links, accents) |
| `--color-primary-hover` | `#15803d` | `hover:bg-primary-hover` | Hover state for primary elements |
| `--color-primary-light` | `#bbf7d0` | `bg-primary-light` | Light green backgrounds (badges, highlights) |
| `--color-secondary` | `#0d9488` | `text-secondary` | Secondary teal for gradients and accents |
| `--color-accent` | `#4ade80` | `text-accent` | Bright green accent (hero highlight text) |

### Neutral Colors

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| `--color-background` | `#ffffff` | `bg-background` | Page background |
| `--color-foreground` | `#111827` | `text-foreground` | Primary text color (gray-900) |
| `--color-muted-foreground` | `#6b7280` | `text-muted-foreground` | Secondary/muted text (gray-500) |
| `--color-border` | `#e5e7eb` | `border-border` | Border color (gray-200) |
| `--color-card` | `#ffffff` | `bg-card` | Card background |
| `--color-card-hover` | `#f9fafb` | `bg-card-hover` | Card hover background (gray-50) |

### Gradient Patterns Used in Components

| Gradient | CSS | Where Used |
|---|---|---|
| Hero overlay | `bg-gradient-to-r from-black/70 via-black/40 to-transparent` | Hero section |
| Brand gradient | `bg-gradient-to-br from-emerald-900 via-teal-800 to-green-900` | Hero fallback bg |
| Service card: hotel | `from-emerald-500 to-teal-600` | Services.astro |
| Service card: daycare | `from-amber-400 to-orange-500` | Services.astro |
| Service card: transport | `from-blue-500 to-cyan-500` | Services.astro |
| Email header | `linear-gradient(135deg, #166534, #0d9488)` | Email templates |

---

## Typography

### Font Stack

```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
```

**Inter** is loaded from Google Fonts with the following weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 900 (black).

Font loading is performance-optimized:
- `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`
- `display=swap` to prevent FOIT (Flash of Invisible Text)

### Type Scale (via Tailwind)

| Element | Classes | Example |
|---|---|---|
| Page heading (h1) | `text-4xl md:text-6xl lg:text-7xl font-black` | Hero title |
| Section heading (h2) | `text-3xl md:text-4xl lg:text-5xl font-bold` | Section titles |
| Card heading (h3) | `text-xl font-bold` | Service card titles |
| Body text | `text-lg` or `text-base` | Descriptions, paragraphs |
| Small text | `text-sm` | Nav links, badges, metadata |
| Tiny text | `text-xs` | Footer copyright, timestamps |
| Badge text | `text-sm font-semibold tracking-widest uppercase` | Hero badge |

---

## Spacing System

| Token | Value | Usage |
|---|---|---|
| `--container-max` | `1280px` | Max width for main content container |
| `--container-padding` | `1rem` (mobile) → `1.5rem` (sm) → `2rem` (lg) | Responsive horizontal padding |

The `.container` class is defined in `global.css`:
```css
.container {
  max-width: var(--container-max);
  margin-inline: auto;
  padding-inline: var(--container-padding);
}
```

---

## Shadow System

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), ...` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), ...` | Header on scroll |
| `--shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1), ...` | Hover state cards |

---

## Transition System

| Token | Value | Usage |
|---|---|---|
| `--transition-fast` | `150ms ease` | Micro-interactions (button press) |
| `--transition-normal` | `300ms ease` | Standard transitions (hover, toggle) |
| `--transition-slow` | `500ms ease` | Layout transitions (slide-in) |

---

## Animation System

Defined in `global.css`:

| Animation | Keyframes | CSS Class | Usage |
|---|---|---|---|
| `fade-in` | `opacity: 0, translateY(12px)` → `opacity: 1, translateY(0)` | `.animate-fade-in` | Section reveal on scroll |
| `bounce-subtle` | `translateY(0)` → `translateY(-6px)` → `translateY(0)` | Built-in `animate-bounce` | Scroll indicator |

### Mobile Performance Optimizations

```css
@media (max-width: 640px) {
  .backdrop-blur-md { backdrop-filter: blur(4px); }   /* Reduced from 12px */
  .backdrop-blur-lg { backdrop-filter: blur(6px); }   /* Reduced from 16px */
}
```

Reduced blur on mobile devices to prevent GPU performance issues.

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility Features

| Feature | Implementation |
|---|---|
| **Skip link** | `.skip-link` class in `global.css` — hidden, revealed on focus |
| **Scroll behavior** | `html { scroll-behavior: smooth; }` |
| **Text size adjust** | `text-size-adjust: 100%` prevents iOS zoom issues |
| **Font smoothing** | `-webkit-font-smoothing: antialiased` |
| **Hidden scrollbars** | `.scrollbar-hide` / `.no-scrollbar` utility classes |
| **ARIA labels** | All interactive elements have `aria-label` attributes |
| **Decorative elements** | Include `aria-hidden="true"` |

---

## CSS Architecture (Tailwind v3)

### How It Works

1. **Design tokens** are CSS custom properties defined in `@layer base { :root { ... } }` inside `global.css`
2. **Tailwind config** (`tailwind.config.mjs`) maps tokens to utility classes via `var()` references
3. **Components** use Tailwind utility classes (`text-primary`, `bg-card`, `border-border`, etc.)
4. **Custom CSS** is minimal and only used for things Tailwind can't handle (skip link, scrollbar hiding, animations)

### Previous Approach (Tailwind v4 — abandoned)

The project initially used Tailwind v4's CSS-only `@import "tailwindcss"` + `@theme { ... }` syntax. This was abandoned because the `@tailwindcss/vite` plugin caused silent build crashes in Astro 5's SSR context. See [10-TROUBLESHOOTING-LOG.md](./10-TROUBLESHOOTING-LOG.md) for details.

### Current Approach (Tailwind v3 — stable)

Uses the official `@astrojs/tailwind` integration which:
- Automatically configures PostCSS
- Processes `@tailwind base/components/utilities` directives
- Scans `.astro`, `.ts`, `.tsx`, `.html` files for class usage
- Purges unused CSS in production builds

---

## Glassmorphism Patterns

The site uses glassmorphism effects extensively in the Header and Contact sections. These are the established patterns:

### Transparent-to-Solid Transition (Header)

```css
/* Default state (transparent over hero image) */
.header-default {
  background: rgba(0, 0, 0, 0.2);     /* bg-black/20 */
  backdrop-filter: blur(4px);           /* backdrop-blur-sm */
  border-bottom: 1px solid transparent; /* border-b border-transparent */
}

/* Scrolled state (solid white glass) */
.header-scrolled {
  background: rgba(255, 255, 255, 0.95); /* bg-white/95 */
  backdrop-filter: blur(12px);            /* backdrop-blur-md */
  border-bottom-color: #f3f4f6;           /* border-gray-100 */
  box-shadow: 0 1px 2px rgba(0,0,0,0.05); /* shadow-sm */
}
```

> **Critical Pattern**: Always declare `border-b border-transparent` as the default state when a component transitions to `border-gray-100` or any visible border. Without this, CSS will interpolate from `currentColor` (inherited text color), causing a visible flash during the 300ms transition. See [10-TROUBLESHOOTING-LOG.md](./10-TROUBLESHOOTING-LOG.md) Issue #9.

### Card Glassmorphism (Contact Form)

```css
.glass-card {
  background: rgba(255, 255, 255, 0.8); /* bg-white/80 */
  backdrop-filter: blur(24px);           /* backdrop-blur-xl */
  border: 1px solid white;              /* border border-white */
  border-radius: 1.5rem;                /* rounded-3xl */
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); /* shadow-xl */
}
```

### Gradient Patterns (Updated)

| Gradient | CSS | Where Used |
|---|---|---|
| Hero overlay | `bg-gradient-to-r from-black/70 via-black/40 to-transparent` | Hero section |
| Brand gradient | `bg-gradient-to-br from-emerald-900 via-teal-800 to-green-900` | Hero fallback bg |
| Service card: hotel | `from-emerald-500 to-teal-600` | Services.astro |
| Service card: daycare | `from-amber-400 to-orange-500` | Services.astro |
| Service card: transport | `from-blue-500 to-cyan-500` | Services.astro |
| Email header | `linear-gradient(135deg, #166534, #0d9488)` | Email templates |
| Contact bg: top-right | `radial-gradient(circle at top right, emerald-100, transparent 40%)` | Contact.astro |
| Contact bg: bottom-left | `radial-gradient(circle at bottom left, teal-50, transparent 40%)` | Contact.astro |

---

## Scroll-Reveal Animation Engine

### Overview

The site uses a custom IntersectionObserver-based scroll-reveal system defined in `src/scripts/scroll-reveal.ts` and loaded globally via `MarketingLayout.astro`.

### How It Works

1. On page load, all `[data-animate]` elements are set to invisible (CSS handles initial state via `opacity: 0` and transform offsets)
2. An `IntersectionObserver` watches all `[data-animate]` elements
3. When an element enters the viewport (10% threshold), the `.is-visible` class is added after an optional `data-delay` timeout
4. CSS transitions handle the visual reveal animation

### Available Animations

| `data-animate` Value | Effect |
|---|---|
| `slide-up` | Fades in while sliding up from 12px below |
| `slide-left` | Fades in while sliding from the right |
| `slide-right` | Fades in while sliding from the left |
| `scale-in` | Fades in while scaling from 0.95 to 1.0 |
| `fade-in` | Simple opacity fade from 0 to 1 |

### Stagger Pattern

Use `data-delay` to create cascading reveal effects:

```html
<span data-animate="slide-up">Badge</span>
<h2 data-animate="slide-up" data-delay="100">Title</h2>
<p data-animate="slide-up" data-delay="200">Description</p>
<div data-animate="slide-up" data-delay="300">Content</div>
```

### Accessibility

The system respects `prefers-reduced-motion: reduce` — when enabled, all animation durations are set to near-zero (0.01ms) so elements appear instantly without motion.


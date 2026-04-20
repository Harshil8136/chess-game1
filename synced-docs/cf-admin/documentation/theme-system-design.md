{% raw %}
# Theme System & Linear/Vercel Slate Design Spec

## Goal
Migrate the `cf-admin` Content Studio from an extremely dark ("pitch black") aesthetic to an elevated, professional "Linear/Vercel Slate" dark mode, while introducing a scalable CSS-variable based theming system to allow future color theme switching.

## Architecture

### 1. CSS Variable Theme Foundation
Instead of hard-coding utility classes or arbitrary color values directly onto elements, we introduced a robust CSS variable layer in the global stylesheet.

**Theme Variables Scheme:**
- **Background** — The absolute lowest layer background.
- **Surface** — Elevated panels and master layouts.
- **Surface Raised** — Deeper or contrasting inner containers (like SaaS pricing rows).
- **Border** — Delicate, low-opacity strokes holding the layout together.
- **Border Strong** — For active states or highlighted components.
- **Text Primary** — Primary headings and dominant text.
- **Text Muted** — Secondary labels and descriptions.

**Data-Theme Attribute:**
The foundation is applied to the `<body>` element using a `data-theme` attribute. The Slate theme maps values to the variables defined above. Future themes (e.g., "midnight" or "ocean") can define a new block of variable re-assignments under a different attribute value.

### 2. The "Slate" Theme (Default)
Our primary implementation is the Slate theme, using Zinc-scale colors:
- **Background:** Zinc-950
- **Surface:** Zinc-900
- **Surface Raised:** Zinc-800
- **Border:** White at 10% opacity
- **Text Primary:** Zinc-50
- **Text Muted:** Zinc-400

### 3. Execution & Refactoring Plan
Existing hardcoded inline styles across the application were refactored to utilize standard utility classes or CSS variable references.

**Scope of changes:**
- Admin layout (injecting `data-theme` and defining CSS)
- Dashboard and all module subpages (hero, gallery, services, reviews, faq, about)
- Interactive Preact component files (GalleryManager, ServicesManager, ReviewsManager)

## Trade-offs and Considerations
- **Tailwind v4 Setup:** Tailwind v4 supports CSS variables directly in themes. Utility classes are mapped onto these CSS variables where possible.
- **Opacity overlays:** Glassmorphism (`backdrop-blur`) is retained, but relies more on the solid base of the theme variables rather than extreme translucency.

## Verification
- Run the dev server and navigate through all 6 pages of the Content Studio.
- Verify that no legacy pitch-black background colors remain.
- Verify that swapping the `data-theme` attribute correctly changes the underlying color base.


## 10. DESIGN SYSTEM Ã¢â‚¬â€ "MIDNIGHT SLATE"

> **Evolved from "Obsidian Clarity / Spectrum" Ã¢â€ â€™ "Midnight Slate"**
> We have abandoned the multi-color section identity system. The entire portal operates under a unified premium dark UI with **Arctic Cyan** (`#22d3ee`) primary accents.

### Core Surface Palette

| Token | Dark Value | Purpose |
|-------|-----------|---------|
| `surface-base` | `#060a0e` | Page background |
| `surface-raised` | `#0c1117` | Card/panel background |
| `surface-overlay` | `#131a22` | Modal/dropdown background |
| `surface-glass` | `rgba(12,17,23,0.72)` | Glassmorphism panels |
| `text-primary` | `#f0f4f8` | Headings, important text |
| `text-secondary` | `#8b9ab5` | Body text, labels |
| `text-tertiary` | `#5a6b83` | Hints, captions |

### Arctic Cyan Accent System
Violet is fully removed from all primary interactions. All active elements, focus rings, and primary highlights use **Arctic Cyan** (`#22d3ee` / `rgba(34, 211, 238, *)`).

| Element | Idle State | Active/Hover State |
|---------|-----------|-------------------|
| **Social Buttons** | `border-white/[0.08]` + `bg-white/[0.04]` | `hover:bg-cyan-500/[0.06]` + `hover:border-cyan-400/[0.2]` |
| **Input Focus Ring** | `border-white/[0.1]` | `border: rgba(34,211,238,0.4)` + `box-shadow: 0 0 0 3px rgba(34,211,238,0.15)` |
| **Active Nav Items**| `rgba(255,255,255,0.02)`| `rgba(34,211,238,0.12)` + `cyan` glowing dot + `cyan` vertical accent line |

### Typography
- Primary: `Inter` (Google Fonts) Ã¢â‚¬â€ 400, 500, 600, 700, 800
- Mono: `JetBrains Mono` Ã¢â‚¬â€ code blocks, technical data

### Motion
- Fast: 120ms (micro-interactions)
- Normal: 200ms (hover, focus)
- Slow: 350ms (page transitions)
- Spring: `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy elements)

### 10.1 Login Portal Ã¢â‚¬â€ "Midnight Slate"

The login page uses a **single-column, centered card** layout inspired by Clerk/Vercel auth flows. No split-screen, no sidebar Ã¢â‚¬â€ just a pristine glassmorphic card on a warm dark canvas.

#### Background & Ambient System

| Element | Spec |
|---------|------|
| **Base** | `#09090b` (zinc-950) Ã¢â‚¬â€ set via inline `style` on `<body>`, not Tailwind class |
| **Orb 1 (Cyan)** | `radial-gradient` of `rgba(34,211,238,0.4)` Ã¢â€ â€™ `rgba(8,145,178,0.15)` |
| **Orb 2 (Slate)** | `radial-gradient` of `rgba(51,65,85,0.5)` Ã¢â€ â€™ `rgba(30,41,59,0.15)` |
| **Orb 3 (Deep Blue)** | `radial-gradient` of `rgba(59,130,246,0.3)` Ã¢â€ â€™ `rgba(29,78,216,0.1)` |
| **Noise Texture** | SVG `feTurbulence` overlay at `opacity-[0.015]` for grain |

All orbs are `position: absolute` inside a `fixed inset-0 pointer-events-none z-0` container, animated via CSS.

#### Glassmorphic Card Setup

```css
background:  rgba(255,255,255,0.035)
border:      1px solid rgba(255,255,255,0.08)
backdrop:    blur(40px)
box-shadow:  0 0 0 1px rgba(34,211,238,0.06),
             0 20px 50px rgba(0,0,0,0.5),
             0 0 80px rgba(34,211,238,0.06)
```

### 10.2 Dashboard & Navigation Architecture

The dashboard implements a modular **Hover-Expand Sidebar**.

#### Sidebar Mechanics (Hover & Pin)
- **Default State:** Collapsed (72px wide), showing only icons. Nav labels are hidden.
- **Hover State:** Sidebar immediately expands to full width (~280px).
- **Pin State:** Users can click a "Lock/Unlock" icon at the bottom of the sidebar to persist the expanded layout. This state is saved to `localStorage`.
- **Layout Sync:** The `AdminLayout.astro` utilizes a synchronous inline script to read `localStorage` and inject the `sidebar-expanded` class into the `<body>` before hydration. The `.admin-content-area` margin shifts cleanly via a 300ms CSS transition matching the sidebar's width.

#### Sidebar Visuals
- **Background:** Glassmorphic with `@supports` fallback (solid `surface-raised`).
- **Logo icon:** Cyan gradient shield with blur glow + `rgba(34,211,238,0.08)` bg.
- **Active Navigation:** Cyan muted bg (12%) + cyan icon + cyan glowing dot + 2px accent bar.
- **Collapsed tooltips:** Rendered conditionally using Preact `createPortal` to the `document.body` for overflow escaping.

#### TopBar & Modals
- **Command Palette:** `Ctrl+K` triggers a robust search palette via Preact signals. Focus states utilize Midnight Slate cyan glow boundaries.
- **TopBar:** Follows general glass logic (`blur(24px)`).

#### Unbuilt Modules & Soft 404
- Unbuilt portal paths (e.g. `/dashboard/customers` or `/dashboard/analytics`) are intercepted by a Catch-All spread route at `src/pages/dashboard/[...slug].astro`.
- Because Astro resolves exact physical paths first, this route organically serves as a fallback.
- It leverages the `AdminLayout` cleanly so that sidebar state is preserved, injecting a Midnight Slate "Module Under Construction" card in the main view rather than breaking the Single-Page Application sequence.

#### Dashboard Widgets
| Widget | Key Treatment |
|--------|---------------|
| **StatCard** | Glass bg, `cyan-400` top accent line (2px), `translateY(-3px)` lift on hover |
| **SystemHealthBar** | Minimalist background, strict tabular data display |

---
{% endraw %}

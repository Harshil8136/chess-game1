# Theme System & Linear/Vercel Slate Design Spec

## Goal
Migrate the `cf-admin` Content Studio from an extremely dark ("pitch black") aesthetic to an elevated, professional "Linear/Vercel Slate" dark mode, while introducing a scalable CSS-variable based theming system to allow future color theme switching.

## Architecture

### 1. CSS Variable Theme Foundation
Instead of hard-coding Tailwind classes like `bg-zinc-900` or arbitrary values like `rgba(12, 17, 23, 0.5)` directly onto elements, we will introduce a robust CSS variable layer in `cf-admin/src/styles/global.css` (or `index.css`).

**Theme Variables Scheme:**
- `--theme-bg`: The absolute lowest layer background.
- `--theme-surface`: Elevated panels and master layouts.
- `--theme-surface-raised`: Deeper or contrasting inner containers (like SaaS pricing rows).
- `--theme-border`: Delicate, low-opacity strokes holding the layout together.
- `--theme-border-strong`: For active states or highlighted components.
- `--theme-text-primary`: Primary headings and dominant text.
- `--theme-text-muted`: Secondary labels and descriptions.

**Data-Theme Attribute:**
The foundation will be applied to the `<body>` element. For example, `[data-theme="slate"]` will map the slate values to the variables. Future themes (e.g., "midnight" or "ocean") can simply define a new block of variable re-assignments under `[data-theme="obsidian"]` etc.

### 2. The "Slate" Theme (Default)
Our primary implementation will be the Slate theme as approved by the user:
- `--theme-bg`: Zinc-950 (`#09090b`)
- `--theme-surface`: Zinc-900 (`#18181b`)
- `--theme-surface-raised`: Zinc-800 (`#27272a`)
- `--theme-border`: White at 10% opacity (`rgba(255,255,255,0.1)`)
- `--theme-text-primary`: Zinc-50 (`#fafafa`)
- `--theme-text-muted`: Zinc-400 (`#a1a1aa`)

### 3. Execution & Refactoring Plan
We will refactor the existing hardcoded `rgba()` inline styles across the application to utilize standard Tailwind arbitrary variable syntax or utility classes mapped to our CSS variables.

**Files to modify:**
- `src/layouts/AdminLayout.astro` (Injecting `data-theme` and defining CSS)
- `src/pages/dashboard/index.astro` and module subpages (`hero`, `gallery`, `services`, `reviews`, `faq`, `about`)
- Component files: `GalleryManager.tsx`, `ServicesManager.tsx`, `ReviewsManager.tsx`

## Trade-offs and Considerations
- **Tailwind v4 Setup:** Tailwind v4 supports CSS variables directly in themes perfectly. We will map utility classes directly onto these CSS variables if possible, or use standard inline `var(--theme-*)` injections.
- **Opacity overlays:** Glassmorphism (`backdrop-blur`) will be retained, but we will rely more on the solid base of the theme variables rather than extreme translucency.

## Verification
- Run `npm run dev` and navigate through all 6 pages of the Content Studio.
- Verify that no pitch-black `#0c1117` remains.
- Verify that swapping the `data-theme` attribute (or a localized class) correctly changes the underlying color base.

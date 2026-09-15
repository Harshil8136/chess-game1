{% raw %}
# Resolving Astro 5 + Tailwind v4 Build Crash

## Problem Overview

While running `npx astro build` for the Cloudflare Pages deployment, the Vite Rollup pipeline consistently and silently crashes during the `vite:css` or `astro:scanner` phases when the official `@tailwindcss/vite` plugin (Tailwind v4) is active.

Since Tailwind v4 is extremely new (released early 2025) and Astro 5's internal hydration engine is strict, this creates an irrecoverable conflict when rendering static/SSR routes using the `@astrojs/cloudflare` adapter. If we remove the plugin, the build succeeds, but we lose all CSS styling.

As per the brainstorming skill, we need to choose a reliable path forward to restore styling without crashing the build.

---

## Approach Options

### Option 1: Downgrade to Tailwind CSS v3 (Recommended)

Use the highly stable `@astrojs/tailwind` integration designed specifically for Astro.

- **Implementation:** Uninstall v4, install `tailwindcss@^3` and `@astrojs/tailwind`, rewrite `src/styles/global.css` back into a classic `tailwind.config.mjs` structure.
- **Pros:** 100% guaranteed stability. No Vite build crashes. Native Astro integration.
- **Cons:** We lose v4's CSS-only configuration methodology.

### Option 2: Pre-compile Tailwind v4 via CLI

Keep Tailwind v4, but remove it from Vite completely. We compile CSS in a separate terminal process before running the Astro build.

- **Implementation:** Remove `@tailwindcss/vite` plugin. Add `npm run build:css` script calling the Tailwind CLI to generate `public/tailwind.css`. Include `<link rel="stylesheet" href="/tailwind.css">` in `BaseLayout.astro`.
- **Pros:** Preserves all Tailwind v4 features and our existing `global.css` design system.
- **Cons:** Developer experience is slightly worse, as running the dev server requires two scripts (`npm run build:css --watch` and `npm run dev`).

### Option 3: Switch HTML styling to UnoCSS

UnoCSS is an atomic CSS engine that is fully compatible with Tailwind utility classes (`flex`, `px-4`, `bg-green-500`) but uses an entirely different, heavily optimized Vite plugin.

- **Implementation:** Install `unocss`, add the UnoCSS Vite integration, write a minimal `uno.config.ts`.
- **Pros:** Keeps our existing Astro markup intact. Extremely fast compilation. No Tailwind v4 bugs.
- **Cons:** Introduces a non-Tailwind dependency; a few complex v4 features may not map 1:1.

---

## Recommendation

I strongly recommend **Option 2 (Pre-compile Tailwind v4)** if keeping v4 is a priority (since our tokens are already written for it), or **Option 1 (Downgrade to v3)** if we want the simplest, most fail-proof Astro developer experience.

Please approve an approach so we can stabilize the build and finish the migration!

{% endraw %}

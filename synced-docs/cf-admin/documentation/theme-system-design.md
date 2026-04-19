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
{% endraw %}

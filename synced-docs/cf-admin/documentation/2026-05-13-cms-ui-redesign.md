# CMS UI Redesign: Content Studio & Gallery

**Date:** 2026-05-13
**Project:** cf-admin

## 1. Visual Theme & Atmosphere
The CMS UI is shifting from a "heavy, flat dark mode" to a modern, airy, and professional "Sleek Midnight" aesthetic. The goal is to reduce vertical space waste, eliminate the "overwhelming blackness" of the UI, and create a sophisticated environment that feels like a premium enterprise SaaS product (e.g., Vercel, Linear).

- **Depth over Darkness:** Instead of purely dark backgrounds, we will rely on subtle surface elevations. The base background will remain a rich dark slate, but content areas will use frosted glass (`backdrop-blur`) and thin, semi-transparent borders (`rgba(255,255,255,0.08)`) to create depth.
- **Vibrant but Professional Accents:** The primary interactive color will remain Blue-500, but we will introduce subtle glow effects on active states to make the UI feel alive and responsive.
- **Density & Spacing:** We will significantly increase information density by consolidating headers and removing redundant titles, ensuring the user's focus is on their actual content.

## 2. Header & Navigation Architecture
The current layout stacks the Page Title, Subtitle, Tabs, and Module Headers, wasting roughly 45% of the viewport height.

- **Consolidated Sticky Header:** 
  - The `ContentTabs` will be merged with the page title and primary actions into a single, compact, sticky top bar.
  - This header will remain fixed to the top (`position: sticky; top: 0; z-index: 40`) as the user scrolls, maintaining constant access to navigation and publishing actions.
  - Background: Frosted glass (`bg-slate-900/80 backdrop-blur-md`) with a subtle bottom border.

## 3. Gallery Module Layout (Option A: Inline Action)
The Gallery page will be restructured to prioritize the images and clarify the publishing workflow.

- **Removal of the Right Sidebar:** The right-hand column (which currently holds "Add Photo" and "Publish") will be entirely removed. The image grid will now span the full width of the container.
- **The "Add Photo" Tile:**
  - The very first item in the image grid will be a dedicated "Add Photo" tile.
  - Design: Dashed border, translucent background, clear "upload" icon, and hover state indicating drop interactivity.
- **Grid Enhancements:**
  - Cards will be simplified to just the image with a sleek overlay for actions (Edit Alt Text, Delete, Drag Handle).
  - Borders will be softened (`rounded-xl` or `rounded-2xl` with a 1px `rgba(255,255,255,0.05)` stroke).

## 4. Publishing Flow & State Management
The current "Push to Live Site" action is confusingly placed and its state is not always clear.

- **Global Publishing Action:** The "Publish to Website" button will be relocated to the Consolidated Sticky Header.
- **State Visualizer:**
  - **Live & Synced:** The button is subdued, perhaps just a green dot indicator or muted text.
  - **Unpublished Changes:** As soon as a change is made (image added, reordered, deleted), the header prominently displays an "Unpublished Changes" indicator (e.g., amber text) and the "Publish" button becomes a highly visible, primary action button.

## 5. Implementation Steps
1. **Theme Update:** Update CSS variables in `dark.css` and `global.css` to refine surface colors, borders, and shadows.
2. **Layout Refactor:** Refactor `ContentTabs.astro` and `index.astro` to create the Consolidated Sticky Header.
3. **Gallery Overhaul:** Rewrite `gallery.astro` and its associated Preact components to remove the sidebar, implement the full-width grid, and add the inline "Add Photo" tile.
4. **State Wiring:** Connect the Preact state (unsaved changes) to the new global "Publish" button in the header.

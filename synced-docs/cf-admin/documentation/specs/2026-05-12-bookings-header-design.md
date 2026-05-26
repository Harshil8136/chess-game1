# Booking Dashboard Header Redesign Spec
> **Date:** 2026-05-12
> **Topic:** Booking Manager UX/UI Makeover
> **Status:** Approved for Implementation Planning

## 1. Objective
Redesign the header section of the `BookingDashboard` to drastically reduce its vertical footprint (from ~60% of viewport down to ~15%), while elevating the aesthetics to a modern, "AI-product" standard (Linear/Raycast vibe). The redesign must prioritize data density, real-world operational usability, and adhere strictly to the "Midnight Slate" design system without compromising the existing rock-solid security and data flows.

## 2. Layout & Architecture: The "Zero-Waste" Header
The layout will be compressed into a highly efficient, two-row architecture on desktop:

- **Row 1 (Controls):** 
  - **Left:** "Booking Manager" title (`font-weight: 800`, `letter-spacing: -0.03em`). The redundant descriptive paragraph is permanently removed to respect power-user efficiency.
  - **Right:** The search input, pulled up into this row to save space.
- **Row 2 (Telemetry):** 
  - A single, continuous "KPI Ribbon" replacing the four disparate, high-padding `.ios-card` elements.
- **Row 3 (Table Tooling):**
  - The "Show Deleted" RBAC-gated toggle and the "Record Count" string will be integrated directly into the upper boundary of the data table, acting as table-level context rather than page-level clutter.

## 3. "AI-Like" Aesthetics & Component Design
The design leans heavily into the "Midnight Slate" design tokens to achieve a premium, futuristic feel:

### 3.1 The KPI Ribbon
- **Container:** Uses `var(--theme-glass-strong)` with a `backdrop-filter: blur(24px)` and a delicate `var(--theme-glass-inner)` top border to simulate a frosted glass slab.
- **Data Display:** Each stat block consists of a label (e.g., "Total Bookings", `var(--theme-text-secondary)`, `12px`) and a value.
- **Typography:** Values will use `var(--font-family-mono)` for terminal-grade precision. 
- **Accentuation:** The primary stat (Total Bookings) will glow subtly using `var(--theme-accent)`.
- **Separators:** 1px vertical dividers (`var(--theme-border-subtle)`) will separate the four data points.

### 3.2 The Smart Search Input
- **Styling:** Inset magnifying glass icon (SVG), `var(--theme-glass)` background, `var(--radius-full)` for a pill-shaped look, and a subtle focus ring (`box-shadow: 0 0 0 2px var(--theme-accent-subtle)`).
- **Usability:** Keyboard shortcut hint visual (`/` or `Ctrl+K` style badge) integrated into the right side of the input to signify power-user readiness.

## 4. Responsive Behavior (Mobile & Desktop)
- **Desktop (≥1024px):** Fully horizontal. Search sits opposite the Title. Ribbon stretches below.
- **Tablet (768px - 1023px):** Search wraps below the title, but the KPI ribbon remains fully horizontal.
- **Mobile (<768px):** 
  - The KPI Ribbon uses `overflow-x-auto` and `overscroll-behavior-x: contain`. 
  - CSS Scroll Snap (`snap-type: x mandatory`) ensures the user can swipe horizontally through the stats without them breaking into multiple rows and devouring vertical screen space.

## 5. Data Flow, Security & Resilience
- **Data Fetching:** The existing robust `fetchBookings` logic, debounced search (`350ms`), and pagination remain 100% untouched.
- **Security:** The `userRole === 'dev'` check for the "Show Deleted" toggle remains strictly enforced. All inputs remain sanitized via the existing API layer. No UI change will bypass the O(1) PLAC resolution.
- **Resilience:** The Loading Skeletons will be refactored from chunky boxes into a single, sleek shimmering ribbon (`animation: shimmer 1.5s infinite`) that perfectly matches the physical dimensions of the new KPI Ribbon ("No Blank Loading Screens" rule).

## 6. Scope
This spec is restricted entirely to:
1. `cf-admin/src/pages/dashboard/bookings/index.astro` (Static wrapper changes)
2. `cf-admin/src/components/admin/bookings/BookingDashboard.tsx` (Component internals and CSS class adjustments)
3. Corresponding CSS files. No database, API, or global layout changes required.

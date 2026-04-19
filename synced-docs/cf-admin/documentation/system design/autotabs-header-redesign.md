{% raw %}
# AutoTabs Header Redesign Spec

## Objective
Overhaul the visual appearance and functionality of the "Servicios / Requisitos / Precios" navigation header inside the `AutoTabs.tsx` Preact component located in the `cf-astro` front-end. The goal is to replace the poorly scaling pill tabs and misaligned waiting bar with a premium, responsive "Midnight Slate" style segmented control.

## Visual Design ("Midnight Slate" Influence)
- **Container**: Use a dark, glassmorphic segmented control track (`bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl`).
- **Tabs**: 
  - Active: Frosty solid background with the tab's specific accent glowing softly. 
  - Inactive: Subdued text that brightens on hover.
- **Progress Bar**: Instead of a separate floating green line, the "waiting bar" will be a subtle background fill moving inside the active tab, or an elegant loading ring around the icon. We will implement it as an absolute positioned `div` layered beneath the tab text that expands from `width: 0%` to `width: 100%` over the 5-second interval.

## Technical Implementation
- **File**: `e:\1\Madagascar Project\cf-astro\src\components\islands\AutoTabs.tsx`
- **Logic**: Retain the existing `useInterval`/`setTimeout` auto-rotation state logic. The 5000ms `ROTATION_MS` and tracking events will be preserved.
- **Responsiveness**: 
  - **Desktop**: 3 side-by-side tabs uniformly spaced.
  - **Mobile**: Allow the tab container to be touch-scrollable without squishing (`overflow-x-auto snap-x snap-mandatory`), or use compact mode where text labels are abbreviated or stacked cleanly.

## Maintenance Budget Constraints
- **JS Impact**: 0 KB increase. We are modifying JSX/Tailwind classes, not adding dependencies.
- **CSS Impact**: Negligible. Utilizing existing Tailwind utility classes. Only custom CSS for the continuous progress animation may be added inline.

## Testing Strategy
- Ensure auto-rotation pauses on user-hover.
- Verify transition cross-fade of the body panels remains smooth.
- Confirm visual alignment at 320px and 768px widths.
{% endraw %}

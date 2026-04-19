{% raw %}
# Bento Dashboard UI Redesign

**Date:** April 18, 2026  
**Status:** Approved for Implementation  
**Topic:** Operations Console Density & Void Elimination  

## 1. Problem Statement
The current standard CSS Grid implements `items-stretch` by default. While this aligns component bottoms, it forces shorter grid items (like "Network Core") to expand vertically to match the tallest sibling (like "Edge Compute"). This results in massive, ugly black voids inside the cards.

Secondly, structural elements in `SupabaseMetrics` span the entire width of the screen. On a 1600px monitor, a single metric ("Cache Hit Ratio") stretches over 1000px wide. This creates excessive horizontal gaps between labels and values, ruining readability.

## 2. Approach: "Bento Box" Shrink-Wrapping
We will transition the dashboard into a strict Bento Box masonry-lite structure.

**Key Technical Decisions:**
1. **Vertical Constraint (`items-start`):** Apply `items-start` to all primary grid wrappers (`DashboardController` and `CloudflareOverview`). This tells CSS Grid to shrink-wrap the cards around their internal content, breaking the vertical stretching link. Cards will naturally fall into a jagged, dense masonry-like pattern.
2. **Shatter Monoliths:** Rip the Supabase telemetry out of its single massive card and shatter it into three distinct, smaller cards:
   * **Engine Specs:** CPU, RAM, Cache.
   * **Transactional Activity:** Tupels, Commits, Deadlocks.
   * **Storage & Auth:** Database Size, Disk usage, Connected Identities.
3. **Max-Width Cap:** Enforce `max-w-[1600px] mx-auto` on the global container so ultrawide scaling hits a hard stop.

## 3. Aesthetic Tone
- Extremely dense.
- No wasted space. Numbers and labels sit intimately together.
- Modular squares and rectangles fitting perfectly together like a mosaic.

## 4. Implementation Constraints
- Preserve all existing tailwind classes for Dark/Light mode (`dark:bg-white/[0.02]`).
- Ensure no data metrics are lost during the refactor.
{% endraw %}

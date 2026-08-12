---

title: "Control Plane Visual Overhaul Plan"
status: draft
audience: [ai, technical]
last_verified: 2026-08-12
verified_against: [code]
owner: harshil
related_docs: [PLAN.md, TECHNICAL_OVERVIEW.md]
tags: [control-plane, ui, design]
---

# Control Plane Visual Overhaul Plan

> **TL;DR (non-technical):** A proposal to unify the Service Control Plane page's
> look under a single accent color instead of per-service branding, and fix a
> handful of layout bugs. Moved here 2026-08-12 from the now-removed `docs/` tree
> (see `CONTRIBUTING-DOCS.md`); **partially implemented** — see status note below.

## Status note (added 2026-08-12)

This plan was originally written as a working proposal in the legacy `docs/`
folder. Re-checked against the current codebase before this move:

- **Done:** `ConfigRow.tsx` already uses `break-words font-mono text-[13px]
  tracking-tight` on the config-key class (matches the "Config Tables & Rows"
  section below).
- **Partially done, differently:** `ServiceSubNav.astro`'s sticky positioning was
  changed from the original `sticky top-[52px]` bug, but landed on
  `sticky top-3 sm:top-4`, not the `sticky top-0` this plan proposed. Worth a
  follow-up look to confirm it resolved the same overlap issue.
- **Not done:** The core ask — **Theme Unification (no brand color coding)** —
  has not shipped. `ProviderControls.tsx` still uses per-service brand colors
  extensively (`emerald-400`/`amber-400`/`cyan-400`/`rose-400` for Sentry,
  PostHog, and status indicators throughout `SentryView`/`PostHogView`), not the
  unified `var(--theme-accent)` this plan calls for.

Kept as `draft` / still-relevant planning rather than deleted, since the
headline goal remains unshipped.

## Overview

This plan implements a complete visual overhaul of the Service Control Plane page (`/dashboard/control-plane`). It addresses layout squishing, overlapping navigation headers, word-wrapping bugs for code keys, and the confusing layout/logic of the PostHog provider system, while unifiying the theme to avoid unnecessary multi-color coding.

---

## User Review Required

> [!IMPORTANT]
> **Theme Unification (No Brand Color Coding)**: As requested, we will remove individual branding colors (violet for Sentry, amber for Cloudflare, emerald for Supabase, etc.) and unify all UI elements under the premium "Midnight Slate" theme using Blue-500 (`var(--theme-accent)`) for active accents and `var(--theme-border-subtle)` for structure.

> [!WARNING]
> **PostHog Layer Dimensions**: We will restructure the PostHog page to explicitly separate **Astro Integration (Layer A - D1 Config)** and **Live Platform Control (Layer B - PostHog API)**.

---

## Open Questions (For /grill-me)

1. **PostHog Integration Detail**: Do you want us to add clear helper tooltips explaining the difference between Layer A (local client-side feature flags) and Layer B (PostHog provider account limits/settings)?
2. **Sub-Nav Layout**: Should the sub-navigation stay as horizontal tabs at the top (with the sticky position fixed), or would you prefer a sidebar-integrated sub-nav list?

---

## Proposed Changes

### Component: Navigation & Layout Headers

#### [MODIFY] `src/components/admin/control-plane/ServiceSubNav.astro`
- Change `sticky top-[52px]` to `sticky top-0` to align correctly within the internal scroll container (`.admin-main-content`).
- Standardize all active state colors to use the unified accent theme instead of individual service colors (`violet`, `amber`, etc.).

#### [MODIFY] `src/pages/dashboard/control-plane/index.astro`
- Add `lg:flex-1 min-w-0` to the header text wrapper to prevent the browser from squishing the description text down to a single-word column width.
- Remove individual brand color definitions (`amber`, `violet`, `emerald`, `cyan`) in the status circles, tags, and provider tiles. Map all active elements to a single cohesive `var(--theme-accent)`.

### Component: Config Tables & Rows

#### [MODIFY] `src/components/admin/control-plane/ConfigRow.tsx`
- Change code key class from `break-all` to `break-words font-mono text-[13px] tracking-tight` to prevent awkward mid-word line breaks (e.g. `session_reco rding.sample _rate` becomes `session_recording.sample_rate`).
- Simplify the layout structure of controls to ensure clean alignment on mobile and desktop viewports.
- Standardize toggle themes to use a single unified accent state.

### Component: Provider Controls (Sentry / PostHog)

#### [MODIFY] `src/components/admin/control-plane/ProviderControls.tsx`
- Restructure `PostHogView` to clearly segregate local D1 configuration toggles/sliders from live PostHog billing & API details.
- Clean up Sentry and Supabase panels to match the unified, non-color-coded theme.
- Replace any colored text or badges representing services with the slate/blue-500 design tokens.

---

## Verification Plan

### Automated Tests
- Run `npm run check` to ensure there are no TypeScript compile-time errors in the Astro pages or Preact components.
- Run `npm run build` to verify the build output packages successfully without CSS compilation warnings.

### Manual Verification
- Ask the developer/maintainer to check the page `/dashboard/control-plane` in their browser and confirm:
  - Header text wraps naturally and spans the layout width without squishing.
  - Sticky sub-nav sticks smoothly at the top of the content area without overlapping the top header or cards.
  - Config labels like `session_recording.sample_rate` display without incorrect character line breaks.
  - The PostHog section is intuitive and visually clean.

## Related

- [`PLAN.md`](PLAN.md) — the original control-plane design doc (provider API specs, phases)
- [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md) — control-plane technical overview

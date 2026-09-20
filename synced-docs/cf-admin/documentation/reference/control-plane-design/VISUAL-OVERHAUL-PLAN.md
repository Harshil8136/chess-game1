---

title: "Control Plane Visual Overhaul Plan"
status: historical
audience: [ai, technical]
last_verified: 2026-09-20
verified_against: [code]
owner: harshil
related_docs: [../../archive/control-plane-design/PLAN.md, ../../archive/control-plane-design/TECHNICAL_OVERVIEW.md, ../DESIGN-SYSTEM.md]
tags: [control-plane, ui, design, historical]
---

# Control Plane Visual Overhaul Plan

> ## 📕 HISTORICAL — this plan is closed. Do not execute it.
>
> A 2026-08 working proposal to unify the Service Control Plane's look under one
> accent colour and fix some layout bugs. **Effectively all of it shipped.** It
> is kept as a record of what was asked for and why, and for the one question it
> left open. Its two siblings (`PLAN.md`, `TECHNICAL_OVERVIEW.md`) were archived
> on 2026-08-23; this file stayed behind as the sole occupant of
> `reference/control-plane-design/`.
>
> The living owner of anything in here is
> [`../DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md).

## What actually shipped (re-verified 2026-09-20)

| Ask | Outcome |
|---|---|
| Config-key wrapping (`break-all` → `break-words font-mono`) | ✅ **Done** — `ConfigRow.tsx` renders the key with `font-mono text-[13px] font-semibold tracking-tight … break-words`. |
| Header text squishing (`min-w-0` on the header wrapper) | ✅ **Done** — `src/pages/dashboard/control-plane/index.astro` uses `flex-1 min-w-0 w-full`. |
| PostHog **Layer A / Layer B** restructure | ✅ **Done**, and it also answers Open Question 1: `ProviderControls.tsx` renders an inline explainer — "App Integration Settings (Layer A): Configured locally in D1…" / "Live Platform Telemetry (Layer B): Queried in real-time… Governs actual recording ingestion and billing quotas" — plus dedicated Layer B section headers. No tooltips needed. |
| Sub-nav layout: tabs or sidebar list? (Open Question 2) | ✅ **Answered by shipping tabs** — `ServiceSubNav.astro` is a "sticky segmented sub-navigation". |
| Sticky sub-nav fix (`sticky top-[52px]` → `sticky top-0`) | ✅ **Done differently** — it landed on `sticky top-3 sm:top-4`. Whether that resolved the original overlap needs a browser and was never confirmed; it has been in production since 2026-08 with no complaint, so treat it as settled. |
| **Theme unification — remove per-service brand colour** | ✅ **Done.** `violet` has **0 occurrences** across all 13 `src/components/admin/control-plane/*` files and all 5 `src/pages/dashboard/control-plane/*.astro` pages, and no provider carries its own colour. The 2026-08-12 note below said otherwise; it conflated brand colour with semantic status colour. |

### The one thing left open

`ProviderControls.tsx` keeps two kinds of colour that the "not done" note ran
together:

- **Semantic status colour** — `text-emerald-400` / `text-rose-400` for ok/error,
  `bg-rose-500/10` / `bg-amber-500/10` for issue severity, deploy-health dots.
  This plan never asked for its removal and it should stay.
- **A cyan section accent**, where this plan asked for `var(--theme-accent)`
  (Blue-500). This is a real divergence: `DESIGN-SYSTEM.md` §2.6 reserves cyan
  for navigation identity and says section colours are "NOT used for interactive
  elements". Measured 2026-09-20 across the control-plane tree: `theme-accent`
  33 uses vs `theme-cyan` 17.

**That cyan-vs-Blue-500 question is the entire remaining value of this
document.** It is a design call, not a plan, and belongs in
[`../DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md) §2.6 or on the maintenance list.

> The original proposal text is preserved unchanged below. Two blocks in it —
> "User Review Required" and "Open Questions (For /grill-me)" — are
> proposal-time interaction artifacts; `/grill-me` is no longer part of the
> workflow and both questions are answered in the table above.

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
- Run **`npm run verify`** — that is the repo's gate (typecheck → ratchet → tests
  → `rules_check.py` → `docs_check.py` → `lint:md` → `a11y_check.py` →
  `audit_gate.py`), and it is what CI runs.
  *(Corrected 2026-09-20: this plan originally said `npm run check` + `npm run
  build`. Both exist, but neither is the gate, and a UI change verified with them
  alone skips the a11y guard and the `A6`/`A7` ratchet that hold exactly the
  inline-style and raw-hex debt this plan touches.)*

### Manual Verification
- Ask the developer/maintainer to check the page `/dashboard/control-plane` in their browser and confirm:
  - Header text wraps naturally and spans the layout width without squishing.
  - Sticky sub-nav sticks smoothly at the top of the content area without overlapping the top header or cards.
  - Config labels like `session_recording.sample_rate` display without incorrect character line breaks.
  - The PostHog section is intuitive and visually clean.

## Related

- [`archive/control-plane-design/PLAN.md`](../../archive/control-plane-design/PLAN.md) — the original control-plane design doc (provider API specs, phases); archived 2026-08-23
- [`archive/control-plane-design/TECHNICAL_OVERVIEW.md`](../../archive/control-plane-design/TECHNICAL_OVERVIEW.md) — control-plane technical overview; archived 2026-08-23

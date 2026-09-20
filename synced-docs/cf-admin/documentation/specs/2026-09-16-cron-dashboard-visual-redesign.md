---

title: "Cron Dashboard Visual & Architecture Redesign"
status: historical
audience: [ai, technical]
last_verified: 2026-09-19
verified_against: [code]
owner: harshil
related_code: [src/pages/dashboard/cron/index.astro, src/components/admin/cron]
related_docs: [../features/CRON-CONTROL.md, 2026-09-16-cron-control-plane-design.md]
tags: [cron, design, ui]
---

# Plan: Cron Control Visual & Architecture Redesign

> **Shipped, then superseded — moved here 2026-09-19.** This plan lived at the
> repository root as `cron-visual-redesign.md`, outside the docs tree, with no
> front-matter and no index entry. The redesign shipped on 2026-09-16
> (`d870161`, `06799ce`) and was extended again by `a9dd974` on 2026-09-17,
> which added the per-query trace console, skeleton loading and the D1-usage
> cards this plan does not describe. Read
> [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md) for what the page
> does today; this file is kept as the design record.

**Task Slug**: `cron-visual-redesign`  
**Target Route**: `/dashboard/cron`  
**Goal**: Transform `/dashboard/cron` from a constrained, bland container into a state-of-the-art, full-width enterprise operations center matching the canonical design system established in `/dashboard/storage`, `/dashboard/inquiries`, and `ServiceStatusStrip`.

---

## 1. Context & Visual Audit

### Critical Defects Identified
1. **Severe Viewport Margin Waste**: `index.astro` constrained the layout inside `max-w-7xl mx-auto`, leaving massive empty black gutters on widescreen monitors while cramming content vertically.
2. **Disjointed Header Badge**: The green sticker `● All Systems Nominal (8/11 Active)` next to the title clashes with the existing portal header patterns and looks amateurish.
3. **Bland, Low-Density Telemetry**: The KPI cards were oversized and contained large empty gaps between metric values and progress bars.
4. **Unbalanced Configuration Space**: The configuration section felt like a form rather than an enterprise command panel.
5. **Lack of Portal Design Consistency**: Missing the ambient background blur orbs (`bg-cyan-600/10 blur-[100px]`), section header identity badges (`D1 Scheduler`), and high-density telemetry rows present on other `/dashboard/*` pages.

---

## 2. Design System Alignment & Reference Matrix

Referencing `src/pages/dashboard/storage/index.astro` and `src/components/dashboard/widgets/ServiceStatusStrip.tsx`:

| UI Component | Legacy Approach | New Canonical Redesign |
| :--- | :--- | :--- |
| **Container Width** | `max-w-7xl mx-auto p-6` (Gutter waste) | `w-full p-0 sm:p-2 relative` (Full edge-to-edge layout) |
| **Ambient Depth** | Flat dark background | Dual ambient blur orbs (`cyan-600/10` + `amber-500/10`) |
| **Header Identity** | Plain text title + sticker badge | Gradient title (`Cron Control Engine`), uppercase section badge (`D1 Scheduler`), breadcrumb subtitle, compact action buttons |
| **Telemetry Deck** | 3 tall blocky cards | **4-card high-density telemetry strip** with 3px accent borders, micro stat chips, and mini progress bars |
| **Configuration** | Heavy form cards dominating screen | **Compact Accordion / Sliding Control Deck** with refined numeric steppers and discrete emergency circuit breaker |
| **Job Hierarchy** | Flat grey cards | **Enterprise data cards** with tier status badges, mono ID tags, live execution latencies, and hover glow |

---

## 3. Component Architecture & Implementation Breakdown

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FULL-WIDTH AMBIENT CONTAINER (w-full)                           │
│  Dual Ambient Blur Orbs (cyan-500/10 + amber-500/10)                                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  PAGE HEADER                                                                           │
│  Cron Control Engine [D1 SCHEDULER] | Actions: [⚙ Config] [🔄 Sync Telemetry]          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  4-CARD HIGH-DENSITY TELEMETRY STRIP                                                   │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐  │
│  │ D1 Daily Reads   │ │ D1 Daily Writes  │ │ Auto-Shedder     │ │ Scheduler Health │  │
│  │ 13.4k (0.27%)    │ │ 272 (0.27%)      │ │ 70% / 70% Limit  │ │ 10/10 Jobs       │  │
│  │ [====     ] 5M   │ │ [====     ] 100k │ │ Status: Nominal  │ │ Analytics: 🟢 OK │  │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  TIER SECTIONS (Protected · Deferrable · Idle)                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ cf-access-reconcile [ID]  [● ACTIVE]  🕒 5m  📊 288 runs  💾 12 r  ⚡ 42ms [▶] [⏸] │  │
│  ├──────────────────────────────────────────────────────────────────────────────────┤  │
│  │ booking-email-retry [ID]  [● ACTIVE]  🕒 5m  📊 288 runs  💾 0 r   ⚡ 18ms [▶] [⏸] │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Full-Width Layout & Ambient Header (`index.astro` & `CronDashboard.tsx`)
- Remove `max-w-7xl` container lock; use full-width dashboard layout with `p-2 sm:p-4 w-full relative`.
- Add atmospheric depth with subtle ambient radial gradients in the background.
- Redesign Header:
  - Title: `Cron <span class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">Control Engine</span>`
  - Badge: `D1 Scheduler` with pulsing cyan dot.
  - Subtitle: `Scheduled Workers & Resource Governor`.
  - Header actions: Clean icon buttons for `🔄 Sync Telemetry` and collapsible `⚙ Settings`.

### Phase 2: High-Density 4-Card Telemetry Strip
- Construct a 4-column compact telemetry grid modeled on `ServiceStatusStrip`:
  1. **D1 Daily Reads**: Read count (`13,417`), percentage (`0.27%`), mini progress bar, `5,000,000` ceiling.
  2. **D1 Daily Writes**: Write count (`272`), percentage (`0.27%`), mini progress bar, `100,000` ceiling.
  3. **Auto-Shedder Governor**: Shedding triggers (`70% Reads / 70% Writes`), governor status (`Nominal / Inactive`), trigger count.
  4. **Scheduler Engine**: Active job tally (`10 Registered`), heartbeat status (`Analytics Engine 🟢 Online`), last sync time.

### Phase 3: Compact Configuration Deck (`ConfigPanel.tsx`)
- Convert the bulky static configuration cards into a streamlined, high-density panel or collapsible toolbar.
- Compact numeric inputs with inline stepper buttons and `%` indicators.
- Distinct Emergency Halt switch with high-contrast safety confirmation.

### Phase 4: Sleek Job Rows with Telemetry Chips (`JobRow.tsx` & `cron.css`)
- Full-width high-density job rows:
  - **Left**: Job Title + mono ID tag + purpose tooltip + status pill (`Active`, `Paused`, `Standing down`).
  - **Center**: Micro telemetry chips: `🕒 Schedule`, `📊 24h Runs`, `💾 D1 Rows`, `⚡ Latency`.
  - **Right**: Button cluster with micro-icons (`▶ Run`, `⏸ Pause`, `▶ Resume`).
- Slide-down pause drawer with quick duration chips (`1h`, `4h`, `24h`, `Indefinitely`) and warning callout for essential jobs.

---

## 4. Verification & Quality Gates

1. **Visual Testing**:
   - Inspect on standard (1920x1080), laptop (1440x900), and mobile viewports.
   - Verify zero edge gutter waste; full responsive adaptability.
2. **Automated Verification**:
   - `npm run typecheck` (0 errors)
   - `npm run ratchet` (0 metric regressions)
   - `npx vitest run test/cron-api.test.ts test/jobs-budget.test.ts` (100% pass)
   - `python scripts/rules_check.py` (0 violations)

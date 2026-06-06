---
title: "User Registry Transformation — 'Midnight Command' Design Spec"
status: historical
audience: [technical]
last_verified: 2026-06-06
verified_against: [code]
owner: harshil
tags: []
---

# User Registry Transformation — "Midnight Command" Design Spec

> **Approach:** B — Premium Slate Hybrid  
> **Module:** `/dashboard/users` (Sapphire Network → Command Center)  
> **Date:** 2026-04-25  
> **Status:** Pending Review

---

## 1. Goal

Transform the User Registry from a card-based, scattered layout into a professional, enterprise-grade **data table** interface that matches the visual density and polish of Linear, Clerk, and Vercel admin panels — while maintaining the "Midnight Slate" design language and Arctic Cyan accent system used across the rest of the cf-admin dashboard.

### What Changes

| Current State | New State |
|--------------|-----------|
| Stacked expandable cards (vertical list) | Sortable data table (desktop) + stacked cards (mobile) |
| 44KB monolithic `UserCardStyles.astro` | Tailwind v4 `@theme` tokens + `@layer components` (~3-5KB) |
| Inline `style={{...}}` objects everywhere | Zero inline styles — pure Tailwind utility classes |
| Activity Timeline panel per user | **Removed entirely** — "Last seen" as a table column |
| `PermissionsDrawer` overlay modal | Dedicated page at `/dashboard/users/[id]/access` |
| Legacy CSS variable system (`--uc-role-*`) | Tailwind v4 `@theme` token system with semantic naming |

### What Stays

- SSR auth guard (`requireAuth(Astro)`) on all routes
- API contracts (`/api/users`, `/api/users/manage`, `/api/users/access`, `/api/users/pages`, `/api/users/access-data`)
- `CustomEvent` decoupling (`user:invited`, `modal:open-invite`)
- Ghost account protections (hidden from DOM for non-dev users)
- Audit Silence panel (DEV-only, strictly SSR-gated)
- RBAC hierarchy enforcement (`ROLE_LEVEL[actor] < ROLE_LEVEL[target]`)
- Preact island architecture (`client:load`)

---

## 2. Architecture Overview

```
/dashboard/users (index.astro)
├── SSR: requireAuth → session.role
├── Preact Island: UsersRegistry (client:load)
│   ├── RegistryToolbar (search, filters, stats, "Add User" CTA)
│   ├── UsersTable (desktop: <table>, mobile: card stack)
│   │   ├── TableHeader (sticky, glassmorphic, sortable columns)
│   │   ├── TableRow × N
│   │   │   ├── Avatar + Name + Email
│   │   │   ├── RoleBadge (color-coded pill)
│   │   │   ├── StatusDot (active/suspended)
│   │   │   ├── InlineRoleSelector (dropdown, guarded)
│   │   │   ├── "Last seen" timestamp
│   │   │   └── OverflowMenu (⋮) → Expand, Manage Access, Suspend, Delete
│   │   └── ExpandedRow (collapse/expand in-place)
│   │       ├── ProfileSection (name, email, created date, danger zone)
│   │       └── AccessSummary (route count + "Manage Full Access →" link)
│   └── EmptyState / ErrorBanner
├── Preact Island: InviteUserModal (client:load)
│   ├── Left Panel: Email, Name, Role, Hidden toggle
│   └── Right Panel: Page Access chip grid (redesigned)
└── MobileUserCard × N (visible only < md breakpoint)

/dashboard/users/[id]/access (NEW — dedicated access page)
├── SSR: requireAuth → validate userId ownership + role clearance
├── Breadcrumb: Users > {user.display_name} > Access Policy
├── Preact Island: AccessPolicyManager (client:load)
│   ├── PolicyToolbar (search, category filter, bulk actions)
│   ├── CategorySections (Dashboard, CMS, System, Chatbot, etc.)
│   │   └── PermissionRow × N per category
│   │       ├── Page icon + label + path
│   │       ├── Required role badge
│   │       ├── Current access state (Role-inherited / Granted / Revoked)
│   │       ├── Toggle switch (guarded by canManage)
│   │       └── "Reset to default" action
│   └── PolicySummary footer (X routes accessible, Y overrides active)
```

---

## 3. Component Design

### 3.1 RegistryToolbar

A single glassmorphic bar spanning the full width, containing all controls.

**Layout:** `flex items-center justify-between` with internal `gap-4`.

| Slot | Content |
|------|---------|
| **Left** | Search input (icon + placeholder "Search by name, email, or role...") |
| **Center** | Role filter tabs: All · Admins · Staff (segmented control) |
| **Right** | Stats pills (N total, N active, N suspended) + "Add User" CTA button |

**Styling:**
- Background: `bg-surface-elevated/80 backdrop-blur-lg`
- Border: `border border-border-subtle rounded-xl`
- Shadow: `shadow-elevated`
- Search focus: `border-accent ring-2 ring-accent/15`
- Active tab: `bg-accent text-white shadow-md`
- "Add User" button: `bg-gradient-to-r from-cyan-600 to-blue-600 hover:shadow-accent/30`

**Mobile (< md):** Stack vertically — search full-width on top, tabs below, button last.

### 3.2 UsersTable (Desktop)

A proper `<table>` element with semantic HTML, sticky header, and hover states.

**Columns:**

| # | Column | Width | Align | Sortable | Content |
|---|--------|-------|-------|----------|---------|
| 1 | User | flex-1 (min 240px) | left | by name | Avatar (32px circle) + Name (primary) + Email (muted) |
| 2 | Role | 140px | left | yes | Color-coded pill badge + inline dropdown on hover (if canManage) |
| 3 | Status | 100px | center | yes | Green dot "Active" or Red dot "Suspended" |
| 4 | Last Seen | 140px | left | yes | Relative timestamp ("2h ago", "3 days ago", "Never") |
| 5 | Actions | 48px | right | no | Overflow menu (⋮) |

**Row Behavior:**
- Hover: `bg-surface-subtle/40` + subtle left accent border flash (role-colored)
- Click anywhere on row: toggles expand (same as current)
- Expanded state: row gains `bg-surface-overlay` + bottom border removed, expanded panel slides in below

**Table Header:**
- `sticky top-0 z-20 bg-surface-subtle/90 backdrop-blur-sm`
- Column headers: `text-[11px] uppercase tracking-wider text-text-muted font-semibold`
- Sort indicators: chevron icons that rotate on active sort

**Role Badge Colors (semantic, no longer per-card theming):**

| Role | Badge BG | Badge Text | Dot Color |
|------|----------|------------|-----------|
| dev | `red-500/12` | `red-300` | `red-500` |
| owner | `emerald-500/12` | `emerald-300` | `emerald-500` |
| super_admin | `amber-500/12` | `amber-300` | `amber-500` |
| admin | `violet-500/12` | `violet-300` | `violet-500` |
| staff | `blue-500/12` | `blue-300` | `blue-500` |

### 3.3 InlineRoleSelector

When `canManage` is true and user hovers/clicks the Role cell:

- The static badge morphs into a compact dropdown (`<select>` styled as a custom dropdown)
- Options are filtered by the actor's own role level (can only assign roles below own tier)
- On selection: immediate optimistic update + API call to `/api/users/manage` with `action: 'changeRole'`
- On failure: revert badge + show toast error
- If `!canManage`: badge remains static, cursor shows `not-allowed` on hover

### 3.4 ExpandedRow

When a row is expanded, a panel slides down below the row with a smooth `max-height` transition.

**Layout:** 2-column grid on desktop, stacked on mobile.

| Column | Content |
|--------|---------|
| **Left (60%)** | **Profile Card** — Display name (editable inline if canManage), email (copyable), created date, account ID (monospace). Below: **Danger Zone** — Suspend/Unsuspend button, Delete button (confirmation required). DEV-only: Audit Silence toggle. |
| **Right (40%)** | **Access Summary Card** — Role badge, "{X} routes accessible", "{Y} custom overrides". Below: **"Manage Full Access →"** link button that navigates to `/dashboard/users/{id}/access`. |

**Styling:**
- Panel bg: `bg-surface-overlay/60 backdrop-blur-sm`
- Inner cards: `bg-surface-raised border border-border-subtle rounded-lg p-4`
- Danger Zone: `border-red-500/20 bg-red-500/5` wrapper with warning icon

### 3.5 OverflowMenu (⋮)

Appears on hover or click of the Actions column. Uses a dropdown/popover pattern.

**Menu Items:**
1. **View Details** — expands the row (same as clicking)
2. **Manage Access** — navigates to `/dashboard/users/[id]/access`
3. **Separator**
4. **Suspend Account** / **Reactivate Account** — destructive, confirmation dialog
5. **Remove User** — destructive, requires typed confirmation of email

All destructive actions show a confirmation modal with clear warning text.

### 3.6 MobileUserCard (< md breakpoint)

On mobile, the table is completely hidden. Users are rendered as stacked cards.

**Card Layout:**
```
┌─────────────────────────────────────┐
│ [Avatar]  Jane Doe         [⋮ menu] │
│           jane@example.com          │
│ ┌──────┐ ┌────────┐ ┌───────────┐  │
│ │ Admin│ │● Active│ │ 2h ago    │  │
│ └──────┘ └────────┘ └───────────┘  │
└─────────────────────────────────────┘
```

- Tap card: expand in-place (same content as desktop expanded row, but stacked)
- Overflow menu: same items as desktop
- Cards use the same Tailwind tokens as the desktop table

---

## 4. Dedicated Access Page (`/dashboard/users/[id]/access`)

### 4.1 Route Structure

**File:** `src/pages/dashboard/users/[id]/access.astro`

**SSR Logic:**
1. `requireAuth(Astro)` — validate session
2. Fetch target user by `Astro.params.id` from D1
3. Validate: does `session.role` have sufficient clearance to view/edit this user's access?
4. If not: redirect to `/dashboard/users` with flash error
5. If yes: pass `{ targetUser, sessionRole }` as props to the Preact island

### 4.2 Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Users    Jane Doe's Access Policy            │
│                     jane@example.com · Admin             │
├─────────────────────────────────────────────────────────┤
│  [Search permissions...]  [Category ▾]  [Bulk Actions ▾]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ▾ DASHBOARD (3 pages)                                  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 📊 Dashboard Home    /dashboard       admin    ✓ ◉  ││
│  │ 👥 User Registry     /dashboard/users  admin   ✓ ◉  ││
│  │ 🔧 System Debug      /dashboard/debug  dev     ✗ ○  ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ▾ CONTENT MANAGEMENT (4 pages)                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🖼️ Gallery Manager   /dashboard/gallery staff  ✓ ◉  ││
│  │ ⭐ Reviews Editor    /dashboard/reviews staff  ✓ ◉  ││
│  │ 📝 Content Studio    /dashboard/content admin  ✓ ◉  ││
│  │ ❓ FAQ Manager       /dashboard/faq     staff  ✓ ◉  ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ▾ SYSTEM (2 pages)                                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🤖 Chatbot Hub       /dashboard/chatbot admin  ✓ ◉  ││
│  │ 📅 Booking Manager   /dashboard/book... admin  ✓ ◉  ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Summary: 8 of 9 routes accessible · 2 custom overrides │
│  Last modified by dev@example.com · 3 days ago          │
└─────────────────────────────────────────────────────────┘
```

### 4.3 PermissionRow Design

Each row in the access page shows:

| Element | Description |
|---------|-------------|
| **Icon** | Page icon (emoji or Lucide icon from `admin_pages` table) |
| **Label** | Page display name |
| **Path** | Truncated route path in monospace (`text-text-muted`) |
| **Required Role** | Badge showing the minimum role needed for natural access |
| **Access State** | Visual indicator: `◉ Inherited` (role grants access), `✓ Granted` (override), `✗ Revoked` (override) |
| **Toggle** | Switch control — disabled if `!canManage`, with loading spinner during API call |
| **Reset** | "Reset to default" link — only visible when an override exists |

**Access State Colors:**
- Inherited (natural): `text-text-muted` + muted dot
- Granted (override): `text-emerald-400` + green dot
- Revoked (override): `text-red-400` + red dot + strikethrough on label

### 4.4 Category Grouping

Pages are grouped by a `category` field (derived from the URL path or a new `category` column in `admin_pages`):

| Category | Pages |
|----------|-------|
| Dashboard | Home, Users, System Debug |
| Content Management | Gallery, Reviews, Content Studio, FAQ |
| Operations | Bookings |
| AI & Automation | Chatbot Hub |

Each category is a collapsible section with a header showing the category name and count.

### 4.5 Toolbar

- **Search:** Filter permissions by page name or path
- **Category dropdown:** Show only a specific category
- **Bulk Actions (if canManage):** "Grant All in Category", "Revoke All in Category", "Reset All Overrides"

### 4.6 Footer Summary

Sticky footer bar showing aggregate stats:
- "X of Y routes accessible"
- "Z custom overrides active"
- "Last modified by {email} · {relative_time}"

---

## 5. Invite Modal Redesign

The two-panel `InviteUserModal` is kept but visually overhauled:

### 5.1 Left Panel (Identity)
- Same fields: Email, Display Name, Role pills, Hidden toggle
- **Improved:** Role pills now include a one-line description below each option
- **Improved:** Labels use consistent Tailwind typography tokens
- **Removed:** All inline `style={{...}}` — pure Tailwind classes

### 5.2 Right Panel (Quick Access)
- Same `PageChipGrid` component concept
- **Improved:** Chips are grouped by category (matching the dedicated access page)
- **Improved:** A callout at the top: "Configure basic access now. Fine-tune on the dedicated access page after creation."
- **Improved:** Each chip shows the page icon + label + required role badge

### 5.3 Styling
- Modal background: `bg-surface-overlay border border-border-subtle rounded-xl`
- Accent line at top: `bg-gradient-to-r from-transparent via-accent to-transparent`
- All inline styles replaced with Tailwind classes
- The embedded `<style>` block (`MODAL_STYLE`) is eliminated — all states handled via Tailwind

---

## 6. Tailwind v4 Token Architecture

### 6.1 Theme Token Block

All tokens defined in a single `@theme` block in the main CSS file. The existing CSS variable system (`--color-surface-raised`, `--color-text-primary`, etc.) is migrated into Tailwind v4's `@theme` directive.

```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-surface-base: #060a0e;
  --color-surface-raised: #0c1117;
  --color-surface-overlay: #131a22;
  --color-surface-subtle: rgba(255, 255, 255, 0.03);
  --color-surface-elevated: rgba(12, 17, 23, 0.72);

  /* Borders */
  --color-border-subtle: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.15);

  /* Text */
  --color-text-primary: #f0f4f8;
  --color-text-secondary: #8b9ab5;
  --color-text-tertiary: #5a6b83;
  --color-text-muted: #3d4f65;

  /* Accent (Arctic Cyan) */
  --color-accent: #22d3ee;
  --color-accent-subtle: rgba(34, 211, 238, 0.15);
  --color-accent-muted: rgba(34, 211, 238, 0.08);

  /* Danger */
  --color-danger: #f87171;
  --color-danger-muted: rgba(248, 113, 113, 0.1);

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Shadows */
  --shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.25);
  --shadow-card: 0 4px 16px rgba(0, 0, 0, 0.2);

  /* Motion */
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 350ms;
  --ease-standard: cubic-bezier(0.2, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Glass */
  --blur-glass: 16px;
}
```

### 6.2 Component Layer

Reusable abstractions in `@layer components`:

```css
@layer components {
  .glass-surface {
    @apply bg-surface-elevated/80 border border-white/10
           rounded-lg shadow-elevated backdrop-blur-[var(--blur-glass)];
  }

  .data-table {
    @apply min-w-full border-separate border-spacing-0 text-sm;
  }

  .data-table__th {
    @apply text-left font-semibold text-text-tertiary uppercase tracking-wider
           text-[11px] px-4 py-3 border-b border-border-subtle;
  }

  .data-table__row {
    @apply group transition-colors duration-[var(--duration-normal)]
           ease-[var(--ease-standard)] hover:bg-surface-subtle/40 cursor-pointer;
  }

  .data-table__cell {
    @apply px-4 py-3 border-b border-border-subtle text-text-secondary;
  }

  .role-badge {
    @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
           text-[11px] font-semibold uppercase tracking-wide;
  }
}
```

### 6.3 Animation Keyframes

```css
@layer utilities {
  @keyframes fade-in-soft {
    0%   { opacity: 0; transform: translateY(4px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes slide-down {
    0%   { opacity: 0; max-height: 0; }
    100% { opacity: 1; max-height: 600px; }
  }

  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
}
```

---

## 7. File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/pages/dashboard/users/[id]/access.astro` | Dedicated access policy page (SSR entry) |
| `src/components/admin/users/AccessPolicyManager.tsx` | Full-page access policy editor (Preact island) |
| `src/components/admin/users/UsersTable.tsx` | Desktop data table component |
| `src/components/admin/users/MobileUserCard.tsx` | Mobile card layout component |
| `src/components/admin/users/RegistryToolbar.tsx` | Search + filter + stats toolbar |
| `src/components/admin/users/InlineRoleSelector.tsx` | Inline role change dropdown |
| `src/components/admin/users/OverflowMenu.tsx` | Row action dropdown menu |
| `src/components/admin/users/ExpandedRow.tsx` | In-place expansion panel |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/dashboard/users/index.astro` | Remove `UserCardStyles`, restructure layout |
| `src/components/admin/users/UsersManager.tsx` | Rewrite as `UsersRegistry` — table-based layout, remove card logic |
| `src/components/admin/users/InviteUserModal.tsx` | Replace all inline styles with Tailwind classes, group chips by category |

### Deleted Files

| File | Reason |
|------|--------|
| `src/components/admin/users/UserCardStyles.astro` | 44KB monolith replaced by Tailwind v4 tokens (~3KB) |
| `src/components/admin/users/UserCard.tsx` | Replaced by `UsersTable` + `ExpandedRow` |
| `src/components/admin/users/molecules/ActivityTimeline.tsx` | Activity log feature removed |
| `src/components/admin/users/molecules/UserCardHeader.tsx` | Card header concept merged into table row |
| `src/components/admin/users/PermissionsDrawer.tsx` | Replaced by dedicated access page |
| `src/pages/api/users/activity.ts` | **Kept but unused** — activity API preserved for future audit log features |

### Preserved Files (refactored in-place)

| File | Changes |
|------|---------|
| `src/components/admin/users/atoms/RoleBadge.tsx` | Migrate to Tailwind classes |
| `src/components/admin/users/atoms/StatusIndicator.tsx` | Migrate to Tailwind classes |
| `src/components/admin/users/atoms/UserAvatar.tsx` | Migrate to Tailwind classes |
| `src/components/admin/users/molecules/UserProfileBlock.tsx` | Migrate to Tailwind classes |
| `src/components/admin/users/molecules/DangerZone.tsx` | Migrate to Tailwind classes |
| `src/components/admin/users/molecules/AccessOverview.tsx` | Simplify to summary card, add link to dedicated page |
| `src/components/admin/users/invite/RolePillSelector.tsx` | Add role descriptions, Tailwind migration |
| `src/components/admin/users/invite/PageChipGrid.tsx` | Add category grouping, Tailwind migration |
| `src/components/admin/users/invite/PageAccessMatrix.tsx` | Tailwind migration |
| `src/components/admin/users/shared/AccessPolicyGrid.tsx` | Reuse in dedicated access page |

---

## 8. API Changes

### Existing (No Changes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users` | GET | List all users |
| `/api/users/manage` | POST | Create/update/delete users |
| `/api/users/access` | POST | Grant/revoke/reset page access |
| `/api/users/access-data` | GET | Get pages + overrides for a user |
| `/api/users/pages` | GET | List all admin pages |
| `/api/users/force-kick` | POST | Terminate user session |

### New (if needed)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users/[id]` | GET | Get single user details (for the access page SSR) |

> **Note:** The single-user endpoint may not be needed if we fetch from the D1 `admin_authorized_users` table directly in the Astro frontmatter. Evaluate during implementation.

---

## 9. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Inline role changes via dropdown | Server-side validation: `ROLE_LEVEL[actor] < ROLE_LEVEL[newRole]` AND `ROLE_LEVEL[actor] < ROLE_LEVEL[targetCurrentRole]` |
| Access page for ghost accounts | SSR guard: if `target.is_hidden && !isDev(session.role)` → redirect with 404 |
| Audit Silence toggle in expanded row | Only rendered when `isDev(activeRole)` — never in DOM for non-dev users |
| Dedicated access page authorization | SSR: verify `session.role` can manage `targetUser.role` before rendering |
| Bulk actions on access page | Each individual toggle still hits `/api/users/access` — server validates per-action |

---

## 10. Responsive Breakpoints

| Breakpoint | Behavior |
|-----------|----------|
| `≥ 1024px` (lg) | Full data table, 2-column expanded row |
| `768px – 1023px` (md) | Data table with fewer columns (hide "Last Seen"), single-column expanded row |
| `< 768px` (sm) | Table hidden, mobile card stack, stacked expanded content |

---

## 11. Verification Plan

### Automated Checks
1. `astro check` — TypeScript validation passes
2. `astro build` — Production build succeeds without errors
3. Visual inspection on dev server at `localhost:4321/dashboard/users`

### Manual Testing (by user)
1. **Table rendering:** All users appear in the data table with correct role badges and status indicators
2. **Sorting:** Click column headers to sort by name, role, status, last seen
3. **Search:** Type in search bar — table filters in real-time
4. **Role filter tabs:** Switching between All/Admins/Staff correctly filters the table
5. **Expand row:** Click a row — expanded panel slides down with profile + access summary
6. **Inline role change:** Hover role badge → dropdown appears → change role → verify API call
7. **Overflow menu:** Click ⋮ → menu appears with correct options → test Suspend, Manage Access
8. **Dedicated access page:** Click "Manage Full Access →" → navigates to `/dashboard/users/[id]/access`
9. **Access page:** Categories render correctly, toggle switches work, bulk actions functional
10. **Invite modal:** "Add User" → modal opens → fill form → assign access → submit → user appears in table
11. **Mobile:** Resize to < 768px → table disappears, cards appear, all functionality preserved
12. **Security:** Log in as `staff` role → verify cannot see dev accounts, cannot change admin roles, cannot access dev-only controls
13. **Ghost accounts:** Log in as non-dev → verify hidden accounts are not visible anywhere

# 04 — Page Layout Strategy

> **Philosophy:** "Each page gets the density its content demands."  
> **No uniform grid.** Dashboard is dense bento. CMS is spacious editorial. Logs are adaptive tables.

---

## 1. Layout Framework

### 1.1 Shell Structure

Every authenticated page shares the same shell from `AdminLayout.astro`:

```
┌──────┬────────────────────────────────────────────┐
│      │  TopBar (fixed, z-40)                      │
│  S   ├────────────────────────────────────────────┤
│  i   │                                            │
│  d   │  <main class="admin-main-content">         │
│  e   │    <slot />  ← Page content injected here  │
│  b   │                                            │
│  a   │                                            │
│  r   │                                            │
│      │                                            │
└──────┴────────────────────────────────────────────┘
```

### 1.2 Shell CSS (AdminLayout.css)

```css
.admin-layout {
  display: flex;
  min-height: 100dvh;
}

.admin-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;  /* Prevent flex blowout */
  margin-left: var(--sidebar-width, 72px);
  transition: margin-left var(--duration-normal) ease;
}

.sidebar-expanded .admin-content-area {
  margin-left: var(--sidebar-expanded-width, 240px);
}

.admin-main-content {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
  overflow-x: hidden;
}
```

---

## 2. Per-Page Layout Strategies

### 2.1 Dashboard (`/dashboard`) — Dense Bento Grid

**Density:** Maximum information density. 2-column bento grid that stacks to single column on mobile.

```
┌──────────────────────┬──────────────────────┐
│  SystemHealthBar (full-width strip)         │
├──────────────────────┬──────────────────────┤
│  Workers Widget      │  Quota Monitor       │
├──────────────────────┼──────────────────────┤
│  Edge Analytics      │  Supabase Auth       │
│  (with chart)        │                      │
├──────────────────────┴──────────────────────┤
│  Storage & Queues (full-width, internal 3-col) │
├─────────────────────────────────────────────┤
│  Quick Actions (full-width grid)            │
├─────────────────────────────────────────────┤
│  Audit Log Feed (full-width table)          │
└─────────────────────────────────────────────┘
```

**CSS:**

```css
/* pages/dashboard.css */

.dashboard-controller {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);    /* 24px between rows */
  max-width: 1400px;
  margin: 0 auto;            /* Center on ultrawide */
  /* NO zoom: 1.1 — REMOVED */
}

.bento-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
}

@media (max-width: 1024px) {
  .bento-row-2col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-controller {
    gap: var(--spacing-md);  /* 16px on mobile */
  }
  
  .admin-main-content {
    padding: var(--spacing-md);
  }
}
```

### 2.2 CMS/Content Pages (`/dashboard/content/*`) — Spacious Editorial

**Density:** Low density. Wide content area with comfortable reading margins.

```
┌─────────────────────────────────────────────┐
│  Page Header  (title + breadcrumb)          │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │  Content Form / Editor              │    │
│  │  (max-width: 720px, centered)       │    │
│  │                                     │    │
│  │  [Title input]                      │    │
│  │  [Rich text area]                   │    │
│  │  [Image upload]                     │    │
│  │  [Action buttons]                   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌──────────────────────┐                   │
│  │  Sidebar (metadata)  │                   │
│  │  Status, dates, etc. │                   │
│  └──────────────────────┘                   │
└─────────────────────────────────────────────┘
```

**CSS:**

```css
/* pages/content.css */

.content-editor-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.content-editor-main {
  max-width: 720px;
}

.content-editor-sidebar {
  position: sticky;
  top: calc(60px + var(--spacing-lg));  /* TopBar height + padding */
  align-self: start;
}

@media (max-width: 1024px) {
  .content-editor-layout {
    grid-template-columns: 1fr;
  }
  
  .content-editor-sidebar {
    position: static;
    order: -1;  /* Move sidebar above on mobile */
  }
}
```

### 2.3 Table Pages (`/customers`, `/dashboard/audit`) — Adaptive Tables

**Density:** High density. Full-width tables with horizontal scroll on mobile.

```
┌─────────────────────────────────────────────┐
│  Page Header  (title + filters + search)    │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐│
│  │  Data Table (full-width)                ││
│  │  ┌─────┬──────┬────────┬──────┬───────┐││
│  │  │ ID  │ Name │ Email  │ Role │ Date  │││
│  │  ├─────┼──────┼────────┼──────┼───────┤││
│  │  │ ... │ ...  │ ...    │ ...  │ ...   │││
│  │  └─────┴──────┴────────┴──────┴───────┘││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │  Pagination (centered)                  ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

**CSS:**

```css
/* pages/table.css (shared by /customers, /audit, /reports) */

.table-page-layout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.table-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.table-container {
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--theme-border-default);
  background: var(--theme-surface-raised);
}

.table-container table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

/* Responsive: card layout on small screens */
@media (max-width: 768px) {
  .table-container table {
    display: block;
  }
  
  .table-container thead {
    display: none;
  }
  
  .table-container tr {
    display: block;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--theme-border-subtle);
  }
  
  .table-container td {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-xs) 0;
  }
  
  .table-container td::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--theme-text-secondary);
  }
}
```

### 2.4 Chatbot Admin (`/dashboard/chatbot/*`) — Split Panel

**Density:** Medium. Split view with conversation list + detail panel.

```
┌─────────────────────────────────────────────┐
│  Page Header (AI Server)                    │
├──────────────────┬──────────────────────────┤
│  Nav Tabs         │                         │
│  ┌──────────────┐│  Detail Panel           │
│  │ Conversations││  (context-dependent)    │
│  │ Knowledge    ││                         │
│  │ Analytics    ││  Shows selected item    │
│  │ Settings     ││  or analytics view      │
│  └──────────────┘│                         │
└──────────────────┴──────────────────────────┘
```

### 2.5 Auth Page (`/auth/login`) — Centered Card

**Density:** Minimal. Single card centered on full-bleed background.

```
┌─────────────────────────────────────────────┐
│                                             │
│           ┌───────────────────┐             │
│           │  Login Card       │             │
│           │  (max-width: 400px)│            │
│           │                   │             │
│           │  [Logo]           │             │
│           │  [OAuth buttons]  │             │
│           │  [Email form]     │             │
│           │  [Submit]         │             │
│           └───────────────────┘             │
│                                             │
│          Madagascar Admin Portal            │
└─────────────────────────────────────────────┘
```

---

## 3. Sidebar Behavior

### 3.1 States

| State | Width | Content | Trigger |
|-------|-------|---------|---------|
| **Collapsed** (default) | `72px` | Icons only | Default on page load |
| **Expanded** | `240px` | Icons + labels | Hover or pin toggle |
| **Pinned** | `240px` | Icons + labels (persistent) | Click pin icon |
| **Hidden** | `0px` | None | Mobile breakpoint (< 768px) |

### 3.2 Cookie Persistence

```
Cookie: cf_admin_sidebar_collapsed=true|false
```

Read in `AdminLayout.astro` frontmatter:
```astro
const isCollapsed = Astro.cookies.get('cf_admin_sidebar_collapsed')?.boolean() || false;
```

### 3.3 Responsive Breakpoints

| Breakpoint | Sidebar | Content Area |
|------------|---------|--------------|
| `≥ 1280px` | Expanded/pinned optional | Full width minus sidebar |
| `1024–1279px` | Collapsed by default | Full width minus 72px |
| `768–1023px` | Hidden, hamburger toggle | Full width |
| `< 768px` | Full-screen overlay on open | Hidden behind overlay |

---

## 4. TopBar Behavior

### 4.1 Structure

```
┌─────────────────────────────────────────────────────────┐
│ [≡] Breadcrumb > Current Page   [🔍 Ctrl+K] [☀] [👤]  │
└─────────────────────────────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| `≡` Hamburger | Mobile only. Toggles sidebar overlay. |
| Breadcrumb | Dynamic from current path. Section-colored icon. |
| Search | Opens Command Palette (Ctrl+K). |
| Theme Toggle | Sun/Moon icon. Toggles dark/light. |
| User Avatar | Dropdown with role badge, email, sign out. |

### 4.2 Fixed Positioning

```css
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 60px;
  backdrop-filter: blur(12px);
  background: var(--theme-glass);
  border-bottom: 1px solid var(--theme-glass-border);
}
```

---

## 5. Page Spacing Standards

| Context | Padding | Max Width |
|---------|---------|-----------|
| Dashboard bento | `24px` | `1400px` |
| Content editor | `32px` | `1200px` |
| Table pages | `24px` | `none` (full width) |
| Auth page | `24px` | `400px` (card only) |
| Chatbot admin | `24px` | `none` |

---

## 6. Container Query Strategy

For components that need to adapt to their container width rather than viewport width:

```css
/* Enable container queries on bento cards */
.bento-card {
  container-type: inline-size;
  container-name: bento-card;
}

/* Responsive within card */
@container bento-card (max-width: 400px) {
  .bento-inner-grid {
    grid-template-columns: 1fr 1fr;  /* 2 cols instead of 4 */
  }
}

@container bento-card (max-width: 280px) {
  .bento-inner-grid {
    grid-template-columns: 1fr;      /* Stack to single column */
  }
}
```

This is especially valuable for the dashboard's bento grid, where card width varies based on grid configuration, not viewport width.

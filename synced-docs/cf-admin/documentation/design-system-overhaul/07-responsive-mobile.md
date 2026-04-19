{% raw %}
# 07 — Responsive & Mobile Strategy

> **Philosophy:** "Progressive adaptation — core pages fully responsive, CRUD pages functional but simplified."  
> **Reality:** Admins check dashboards on phones. They don't edit CMS hero sections on phones.

---

## 1. Breakpoint System

```css
/* Standard breakpoints aligned with Tailwind defaults */
/* sm:   640px  — Large phones, landscape */
/* md:   768px  — Tablets portrait */
/* lg:  1024px  — Tablets landscape, small laptops */
/* xl:  1280px  — Standard desktop */
/* 2xl: 1536px  — Wide desktop, ultrawide monitors */
```

### Breakpoint Behavior Map

| Breakpoint | Sidebar | Grid | TopBar | Tables |
|------------|---------|------|--------|--------|
| `≥1280px (xl)` | Expanded or pinned | 2-column bento | Full | Full table |
| `1024–1279px (lg)` | Collapsed (72px) | 2-column bento | Full | Full table |
| `768–1023px (md)` | Hidden + hamburger overlay | 1-column stack | Simplified | Horizontal scroll |
| `640–767px (sm)` | Full-screen overlay | 1-column stack | Mini | Card layout |
| `<640px` | Full-screen overlay | 1-column stack | Mini | Card layout |

---

## 2. Container Queries vs Media Queries

### When to Use Each

| Query Type | Use When | Example |
|------------|----------|---------|
| **Media query** | Layout changes that affect the page shell (sidebar, grid columns) | Sidebar hide/show at 768px |
| **Container query** | Component-internal layout that depends on the component's container width | Bento card stat grid: 4 cols → 2 cols → 1 col |

### Container Query Setup

```css
/* Enable container queries on key containers */
.bento-card {
  container-type: inline-size;
  container-name: bento;
}

.admin-main-content {
  container-type: inline-size;
  container-name: main;
}

/* Component adapts to its container, not the viewport */
@container bento (max-width: 450px) {
  .bento-inner-grid {
    grid-template-columns: 1fr 1fr;  /* 4 → 2 columns */
  }
}

@container bento (max-width: 280px) {
  .bento-inner-grid {
    grid-template-columns: 1fr;      /* 2 → 1 column */
  }
  
  .bento-stat-value {
    font-size: 1.25rem;              /* Smaller numbers */
  }
}
```

---

## 3. Responsive Component Patterns

### 3.1 Dashboard Bento Grid

```css
/* Desktop: 2-column grid */
.bento-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
}

/* Tablet: stack to single column */
@media (max-width: 1024px) {
  .bento-row-2col {
    grid-template-columns: 1fr;
  }
}

/* Mobile: tighter spacing */
@media (max-width: 768px) {
  .bento-row-2col {
    gap: var(--spacing-md);
  }
  
  .dashboard-controller {
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
  }
}
```

### 3.2 Sidebar

```css
/* Desktop: always visible */
@media (min-width: 1024px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 50;
  }
}

/* Tablet/Mobile: overlay mode */
@media (max-width: 1023px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform var(--duration-slow) var(--ease-out);
  }
  
  .sidebar--open {
    transform: translateX(0);
  }
  
  /* Scrim behind sidebar */
  .sidebar-scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 55;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-slow) ease;
  }
  
  .sidebar--open ~ .sidebar-scrim {
    opacity: 1;
    pointer-events: auto;
  }
  
  /* Remove margin from content area */
  .admin-content-area {
    margin-left: 0 !important;
  }
}
```

### 3.3 TopBar

```css
/* Mobile: simplified */
@media (max-width: 768px) {
  .topbar {
    height: 52px;
    padding: 0 var(--spacing-sm);
  }
  
  /* Show hamburger */
  .topbar-hamburger {
    display: flex;
  }
  
  /* Hide breadcrumb text on very small screens */
  .topbar-breadcrumb-text {
    display: none;
  }
  
  /* Compact user menu */
  .topbar-user-name {
    display: none;
  }
}

@media (min-width: 769px) {
  .topbar-hamburger {
    display: none;
  }
}
```

### 3.4 Data Tables → Card Layout

On mobile, tables transform into stacked cards:

```css
@media (max-width: 768px) {
  .data-table {
    display: block;
  }
  
  .data-table thead {
    display: none;  /* Hide column headers */
  }
  
  .data-table tbody {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .data-table tr {
    display: block;
    padding: var(--spacing-md);
    background: var(--theme-surface-raised);
    border-radius: var(--radius-md);
    border: 1px solid var(--theme-border-subtle);
  }
  
  .data-table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xs) 0;
    border: none;
    font-size: 0.8125rem;
  }
  
  /* Show label from data attribute */
  .data-table td::before {
    content: attr(data-label);
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--theme-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}
```

### 3.5 Charts

```css
/* Chart responsive container */
.chart-container {
  container-type: inline-size;
  container-name: chart;
  min-height: 200px;
}

/* Reduce chart height on small containers */
@container chart (max-width: 400px) {
  .chart-container {
    min-height: 150px;
  }
}

/* On very small screens, show a summary instead of chart */
@container chart (max-width: 280px) {
  .chart-canvas {
    display: none;
  }
  
  .chart-summary-fallback {
    display: flex;  /* Show text summary instead */
  }
}
```

---

## 4. Touch Target Sizing

### 4.1 Minimum Sizes

| Element | Minimum Size | Standard |
|---------|-------------|----------|
| Buttons | 44×44px | WCAG 2.5.8 |
| Nav items | 44×44px | WCAG 2.5.8 |
| Icon buttons | 36×36px (with 4px padding = 44px touch area) | WCAG 2.5.8 |
| Form inputs | 44px height | WCAG 2.5.8 |
| Table rows | 44px height | WCAG 2.5.8 |
| Links in text | Inherit line-height (≥24px) | — |

### 4.2 Touch Spacing

```css
/* Minimum gap between touchable elements */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Ensure enough space between adjacent targets */
.button-group {
  gap: var(--spacing-sm);  /* 8px minimum */
}

/* Mobile: increase padding for fat-finger friendliness */
@media (max-width: 768px) {
  .sidebar-item {
    padding: var(--spacing-md) var(--spacing-sm);
    min-height: 48px;
  }
  
  .topbar-action {
    min-width: 44px;
    min-height: 44px;
  }
}
```

---

## 5. Mobile-Specific Optimizations

### 5.1 Viewport Meta

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

Already present in `AdminLayout.astro`. No `maximum-scale` restriction — users should be able to zoom.

### 5.2 Safe Area Insets (Notch Devices)

```css
/* Respect safe areas on notched devices */
.admin-main-content {
  padding-left: max(var(--spacing-lg), env(safe-area-inset-left));
  padding-right: max(var(--spacing-lg), env(safe-area-inset-right));
  padding-bottom: max(var(--spacing-lg), env(safe-area-inset-bottom));
}

.sidebar {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

### 5.3 Prevent Zoom on Input Focus (iOS)

```css
/* Prevent iOS auto-zoom on input focus by ensuring font-size >= 16px */
@media (max-width: 768px) {
  input, select, textarea {
    font-size: 16px !important;  /* Prevents iOS zoom */
  }
}
```

### 5.4 Sticky Headers on Mobile

```css
@media (max-width: 768px) {
  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
  }
  
  /* Prevent content from jumping under sticky header */
  .admin-main-content {
    scroll-padding-top: 60px;
  }
}
```

---

## 6. Progressive Enhancement by Page

| Page | Mobile Priority | Experience |
|------|----------------|------------|
| **Dashboard** | ★★★ | Full responsive. Bento → stacked cards. Charts → summary fallback. |
| **Audit Logs** | ★★★ | Table → card layout. Filters preserved. |
| **Customers** | ★★☆ | Table → card layout. CRUD forms functional. |
| **Auth/Login** | ★★★ | Already mobile-first (centered card design). |
| **CMS Editor** | ★☆☆ | Functional but simplified. Rich editor → basic textarea on mobile. |
| **Chatbot Admin** | ★★☆ | Tab navigation. Detail panel → full-screen slide. |
| **Analytics/Reports** | ★★☆ | Charts responsive. Complex filters → drawer. |
| **Settings** | ★★☆ | Form-based pages work naturally. |

---

## 7. Testing Requirements

- [ ] Test all breakpoints: 1536, 1280, 1024, 768, 640, 375 (iPhone SE), 320 (minimum)
- [ ] Test sidebar open/close on tablet breakpoint
- [ ] Test table-to-card transformation
- [ ] Verify 44px touch targets on mobile
- [ ] Test iOS Safari: no zoom on input focus
- [ ] Test notch device safe areas
- [ ] Verify charts degrade gracefully at small widths
- [ ] Test landscape orientation on phones
- [ ] Verify no horizontal scroll on any page at any breakpoint
{% endraw %}

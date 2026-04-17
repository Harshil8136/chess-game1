# 06 — Accessibility (WCAG 2.2 AA)

> **Target:** WCAG 2.2 Level AA compliance across all pages.  
> **Priority:** Keyboard navigation, screen reader support, color contrast, focus management.

---

## 1. Current Gaps

| Issue | Location | Severity |
|-------|----------|----------|
| No skip navigation link | `AdminLayout.astro` | High |
| No ARIA landmarks | `AdminLayout.astro` | High |
| `zoom: 1.1` breaks text scaling | `DashboardController.tsx:153` | Medium |
| Missing `aria-label` on icon-only buttons | Various | Medium |
| No `prefers-reduced-motion` respect | All animations | Medium |
| Inline color manipulation via JS events | `DashboardController.tsx:214–221` | Low |
| Hardcoded colors may fail contrast | `auth.css` | Medium |
| No `<h1>` hierarchy enforcement | Dashboard | Low |

---

## 2. Landmark Structure

### 2.1 Required ARIA Landmarks

```html
<body>
  <!-- Skip Link (first focusable element) -->
  <a href="#main-content" class="skip-nav">Skip to main content</a>
  
  <div class="admin-layout">
    <!-- Sidebar: navigation landmark -->
    <nav aria-label="Main navigation" class="sidebar">
      ...
    </nav>
    
    <div class="admin-content-area">
      <!-- TopBar: banner landmark (or secondary navigation) -->
      <header role="banner" class="topbar">
        <nav aria-label="Breadcrumb" class="breadcrumb">
          <ol>...</ol>
        </nav>
        ...
      </header>
      
      <!-- Main content area -->
      <main id="main-content" aria-label="Page content" class="admin-main-content">
        <slot />
      </main>
    </div>
  </div>
  
  <!-- Toast region: status landmark -->
  <div role="status" aria-live="polite" aria-label="Notifications" class="toast-region">
    ...
  </div>
</body>
```

### 2.2 Skip Navigation

The very first focusable element in the DOM. Visually hidden until focused.

```css
.skip-nav {
  position: fixed;
  top: -100%;
  left: var(--spacing-md);
  z-index: 9999;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--theme-accent);
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  text-decoration: none;
  transition: top var(--duration-fast) ease;
}

.skip-nav:focus {
  top: 0;
  outline: 2px solid white;
  outline-offset: 2px;
}
```

---

## 3. Keyboard Navigation

### 3.1 Focus Order

The tab order follows visual layout:

```
1. Skip nav link (hidden until Tab)
2. Sidebar nav items (top to bottom)
3. TopBar elements (breadcrumb → search → theme toggle → user menu)
4. Main content (cards, buttons, links, form fields)
5. Toast notifications (if present)
```

### 3.2 Focus Indicators

```css
/* Global focus-visible style */
:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Card focus (for keyboard-navigable cards) */
.bento-card:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 4px;
  border-radius: var(--radius-lg);
}

/* Sidebar item focus */
.sidebar-item:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: -2px;  /* Inset to fit within sidebar width */
  border-radius: var(--radius-md);
}
```

### 3.3 Keyboard Shortcuts

| Key | Action | Component |
|-----|--------|-----------|
| `Tab` | Move focus forward | Global |
| `Shift + Tab` | Move focus backward | Global |
| `Ctrl + K` / `Cmd + K` | Open command palette | Global |
| `Escape` | Close modal/dropdown/command palette | Global |
| `Enter` / `Space` | Activate focused button/link | Global |
| `Arrow Up/Down` | Navigate sidebar items | Sidebar |
| `Arrow Up/Down` | Navigate command palette results | Command Palette |
| `Home` / `End` | Jump to first/last item | Lists |

### 3.4 Focus Trapping

Modals and the command palette must trap focus:

```tsx
// useFocusTrap hook for modals, drawers, command palette
function useFocusTrap(ref: RefObject<HTMLElement>, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;
    
    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    // Focus first element on open
    firstFocusable?.focus();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, ref]);
}
```

---

## 4. Color Contrast

### 4.1 Minimum Contrast Ratios

| Element | Minimum Ratio | Standard |
|---------|--------------|----------|
| Body text | 4.5:1 | AA Normal |
| Large text (≥18px or ≥14px bold) | 3:1 | AA Large |
| UI components (borders, icons) | 3:1 | AA Non-text |
| Focus indicators | 3:1 | AA |
| Disabled elements | No requirement | — |

### 4.2 Verified Token Contrast (Dark Theme)

| Token Pair | Contrast | Result |
|------------|----------|--------|
| `--text-primary` (#fff) on `--surface` (#121214) | 17.1:1 | ✅ AAA |
| `--text-secondary` (#a1a1aa) on `--surface` (#121214) | 7.2:1 | ✅ AAA |
| `--text-tertiary` (#8a8a93) on `--surface` (#121214) | 5.3:1 | ✅ AA |
| `--text-muted` (#71717a) on `--surface` (#121214) | 4.0:1 | ⚠️ AA Large only |
| `--accent` (#3b82f6) on `--surface` (#121214) | 4.8:1 | ✅ AA |
| `--accent` (#3b82f6) on `--bg` (#09090b) | 5.2:1 | ✅ AA |
| `--success` (#4ade80) on `--surface` (#121214) | 8.5:1 | ✅ AAA |
| `--danger` (#f87171) on `--surface` (#121214) | 5.6:1 | ✅ AA |
| `--warning` (#f6ad55) on `--surface` (#121214) | 7.8:1 | ✅ AAA |

### 4.3 Rules

1. **`--text-muted` may only be used on large text (≥14px bold or ≥18px regular)**, labels, or decorative text
2. **Never use `--text-muted` for essential information** the user must read
3. **Section colors on dark backgrounds must pass 3:1** minimum (all currently pass)
4. **Hardcoded rgba colors are banned** — use tokens that have verified contrast

---

## 5. Screen Reader Support

### 5.1 Live Regions

```html
<!-- Toast notifications -->
<div role="status" aria-live="polite" aria-atomic="true">
  <!-- Toasts are injected here; screen readers announce them -->
</div>

<!-- Loading states -->
<div aria-live="polite" aria-busy="true">
  Loading dashboard metrics...
</div>

<!-- After loading completes -->
<div aria-live="polite" aria-busy="false">
  Dashboard loaded. 5 services healthy.
</div>
```

### 5.2 Dynamic Content Announcements

```tsx
// Announce metric updates to screen readers
function announceMetric(label: string, value: string | number) {
  const announcer = document.getElementById('sr-announcer');
  if (announcer) {
    announcer.textContent = `${label}: ${value}`;
  }
}

// Hidden announcer element
<div id="sr-announcer" className="sr-only" role="status" aria-live="polite" />
```

### 5.3 Visually Hidden Utility

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## 6. ARIA Patterns

### 6.1 Icon-Only Buttons

Every icon-only button MUST have `aria-label`:

```tsx
// ✅ CORRECT
<button aria-label="Refresh dashboard" className="icon-button">
  <RefreshIcon />
</button>

// ❌ WRONG — no accessible label
<button className="icon-button">
  <RefreshIcon />
</button>
```

### 6.2 Data Tables

```tsx
<table role="table" aria-label="Customer bookings">
  <thead>
    <tr>
      <th scope="col" aria-sort="ascending">Name</th>
      <th scope="col">Email</th>
      <th scope="col">Date</th>
    </tr>
  </thead>
  <tbody>
    {/* rows */}
  </tbody>
</table>
```

### 6.3 Tabs (Chatbot Admin)

```tsx
<div role="tablist" aria-label="Chatbot admin sections">
  <button role="tab" aria-selected={activeTab === 'conversations'} aria-controls="panel-conversations">
    Conversations
  </button>
  <button role="tab" aria-selected={activeTab === 'knowledge'} aria-controls="panel-knowledge">
    Knowledge Base
  </button>
</div>

<div role="tabpanel" id="panel-conversations" aria-labelledby="tab-conversations">
  {/* conversation content */}
</div>
```

### 6.4 Progress Bars (Quota Widgets)

```tsx
<div 
  role="progressbar"
  aria-valuenow={usedPercentage}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`${label}: ${usedPercentage}% used`}
>
  <div className="quota-bar-fill" style={{ width: `${usedPercentage}%` }} />
</div>
```

---

## 7. Form Accessibility

### 7.1 Input Labels

Every form input MUST have a visible or `aria-label`ed label:

```tsx
// ✅ CORRECT — visible label
<label htmlFor="email-input" className="lf-label">Email address</label>
<input id="email-input" type="email" className="lf-input" />

// ✅ CORRECT — aria-label for search
<input 
  type="search" 
  aria-label="Search command palette"
  placeholder="Type a command or search..."
  className="command-input"
/>
```

### 7.2 Error Messages

```tsx
<input
  id="email"
  aria-invalid={hasError}
  aria-describedby={hasError ? "email-error" : undefined}
/>
{hasError && (
  <div id="email-error" role="alert" className="lf-error">
    Please enter a valid email address
  </div>
)}
```

---

## 8. Testing Checklist

- [ ] Tab through entire page — logical order, no traps
- [ ] All interactive elements have visible focus indicators
- [ ] Skip nav link works on Tab from page top
- [ ] Screen reader (NVDA/VoiceOver) can navigate all landmarks
- [ ] All images have alt text (or `aria-hidden` if decorative)
- [ ] All icon-only buttons have `aria-label`
- [ ] Color is not the only indicator of state (add icons/text too)
- [ ] Form errors are announced to screen readers
- [ ] `prefers-reduced-motion: reduce` disables all animations
- [ ] Contrast ratios verified with browser devtools
- [ ] Charts have text fallback for screen readers
- [ ] Toast notifications are `aria-live="polite"`

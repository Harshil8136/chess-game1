{% raw %}
# 09 — Component Design Patterns

> **Goal:** Standardize all UI components to use consistent patterns, tokens, and interaction behaviors.

---

## 1. Bento Card Component

The fundamental building block of the dashboard. All dashboard widgets are bento cards.

### 1.1 Structure

```html
<div class="bento-card [modifier]">
  <div class="bento-header">
    <div class="bento-title">
      <span class="bento-title-icon">{icon}</span>
      <span class="bento-title-text">{title}</span>
    </div>
    <div class="bento-header-actions">
      {/* optional badges, links, buttons */}
    </div>
  </div>
  
  <div class="bento-body">
    {/* Component-specific content */}
  </div>
  
  <div class="bento-footer">
    {/* Optional footer actions */}
  </div>
</div>
```

### 1.2 CSS

```css
/* components/bento.css */
.bento-card {
  background: var(--theme-surface-raised);
  border: 1px solid var(--theme-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  container-type: inline-size;
  container-name: bento;
  transition:
    border-color var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease;
}

.bento-card:hover {
  border-color: var(--theme-border-default);
}

.bento-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.bento-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--theme-text-primary);
  letter-spacing: var(--tracking-wide);
}

.bento-title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--section-subtle, var(--theme-accent-subtle));
  color: var(--section-color, var(--theme-accent));
}

/* Modifier: primary gradient card */
.bento-card.primary-gradient {
  background: linear-gradient(
    135deg,
    var(--theme-surface-raised) 0%,
    oklch(from var(--theme-accent) l c h / 0.04) 100%
  );
}

/* Inner stat grid */
.bento-inner-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-md);
}

@container bento (max-width: 450px) {
  .bento-inner-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### 1.3 Modifiers

| Modifier Class | Effect |
|---------------|--------|
| `.bento-card.primary-gradient` | Subtle accent gradient background |
| `.bento-card.bento-card--full` | Full-width, spans entire grid row |
| `.bento-card.bento-card--compact` | Reduced padding (`--spacing-md`) |
| `.bento-card.bento-card--interactive` | Clickable card with hover lift |

---

## 2. Button Component

### 2.1 Variants

| Variant | Class | Use Case |
|---------|-------|----------|
| **Primary** | `.btn-primary` | Main CTA (submit form, save, confirm) |
| **Secondary** | `.btn-secondary` | Secondary actions (cancel, back, reset) |
| **Ghost** | `.btn-ghost` | Tertiary actions (low emphasis, within cards) |
| **Danger** | `.btn-danger` | Destructive actions (delete, revoke) |
| **Icon** | `.btn-icon` | Icon-only buttons (refresh, close, toggle) |

### 2.2 CSS

```css
/* components/button.css */

/* Base button styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 550;
  letter-spacing: var(--tracking-wide);
  cursor: pointer;
  border: none;
  transition:
    background var(--duration-fast) ease,
    color var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease,
    transform var(--duration-instant) ease;
  min-height: 36px;
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* Primary — accent filled */
.btn-primary {
  background: var(--theme-accent);
  color: white;
  box-shadow: 0 1px 3px oklch(from var(--theme-accent) l c h / 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: var(--theme-accent-hover);
  box-shadow: 0 2px 8px oklch(from var(--theme-accent) l c h / 0.4);
}

/* Secondary — subtle background */
.btn-secondary {
  background: var(--theme-surface-raised);
  color: var(--theme-text-secondary);
  border: 1px solid var(--theme-border-default);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--theme-surface-overlay);
  color: var(--theme-text-primary);
  border-color: var(--theme-border-strong);
}

/* Ghost — transparent */
.btn-ghost {
  background: transparent;
  color: var(--theme-text-tertiary);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--theme-surface-raised);
  color: var(--theme-text-secondary);
}

/* Danger — red destructive */
.btn-danger {
  background: oklch(from var(--theme-danger) l c h / 0.1);
  color: var(--theme-danger);
  border: 1px solid oklch(from var(--theme-danger) l c h / 0.2);
}

.btn-danger:hover:not(:disabled) {
  background: oklch(from var(--theme-danger) l c h / 0.15);
}

/* Icon — square, icon-only */
.btn-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--theme-text-tertiary);
  border: 1px solid var(--theme-border-subtle);
}

.btn-icon:hover:not(:disabled) {
  background: var(--theme-surface-raised);
  color: var(--theme-text-primary);
  border-color: var(--theme-border-default);
}

/* Sizes */
.btn--sm { min-height: 28px; padding: 0.25rem 0.75rem; font-size: 0.75rem; }
.btn--lg { min-height: 44px; padding: 0.75rem 1.5rem; font-size: 0.875rem; }
```

---

## 3. Badge / Tag Component

### 3.1 Variants

```css
/* components/badge.css */

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  line-height: 1.4;
}

/* Status badges */
.badge--success {
  color: var(--theme-success);
  background: var(--color-success-muted);
}

.badge--warning {
  color: var(--theme-warning);
  background: var(--color-warning-muted);
}

.badge--danger {
  color: var(--theme-danger);
  background: var(--color-danger-muted);
}

.badge--info {
  color: var(--theme-info);
  background: var(--color-info-muted);
}

/* Role badges */
.badge--role-dev       { color: var(--color-role-dev);       background: var(--color-role-dev-bg); }
.badge--role-superadmin{ color: var(--color-role-superadmin); background: var(--color-role-superadmin-bg); }
.badge--role-admin     { color: var(--color-role-admin);     background: var(--color-role-admin-bg); }
.badge--role-staff     { color: var(--color-role-staff);     background: var(--color-role-staff-bg); }

/* Neutral badge */
.badge--neutral {
  color: var(--theme-text-secondary);
  background: var(--theme-surface-overlay);
}
```

### 3.2 Usage

```tsx
<span className="badge badge--success">Healthy</span>
<span className="badge badge--danger">Error</span>
<span className="badge badge--role-admin">Admin</span>
```

---

## 4. Form Input Component

### 4.1 Text Input

```css
/* components/input.css */

.input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 0.8125rem;
  color: var(--theme-text-primary);
  background: var(--theme-surface-raised);
  border: 1px solid var(--theme-border-default);
  outline: none;
  transition:
    border-color var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease;
  min-height: 40px;
}

.input::placeholder {
  color: var(--theme-text-muted);
}

.input:focus {
  border-color: var(--theme-accent);
  box-shadow: 0 0 0 3px var(--theme-accent-subtle), 0 0 16px var(--theme-accent-subtle);
}

.input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Error state */
.input--error {
  border-color: var(--theme-danger);
}

.input--error:focus {
  box-shadow: 0 0 0 3px var(--color-danger-muted);
}

/* Label */
.input-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--theme-text-secondary);
  margin-bottom: var(--spacing-xs);
}

/* Helper/error text */
.input-helper {
  font-size: 0.75rem;
  color: var(--theme-text-tertiary);
  margin-top: var(--spacing-xs);
}

.input-error-msg {
  font-size: 0.75rem;
  color: var(--theme-danger);
  margin-top: var(--spacing-xs);
}
```

---

## 5. Table Component

```css
/* components/table.css */

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.data-table th {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  font-weight: 600;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--theme-text-tertiary);
  background: var(--theme-surface-raised);
  border-bottom: 1px solid var(--theme-border-default);
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table td {
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--theme-text-secondary);
  border-bottom: 1px solid var(--theme-border-subtle);
  vertical-align: middle;
}

.data-table tr:hover td {
  background: var(--theme-accent-subtle);
}

/* Selected row */
.data-table tr.selected td {
  background: var(--theme-accent-muted);
}

/* Sortable column header */
.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  color: var(--theme-text-primary);
}

/* Monospace cell (IDs, codes) */
.data-table .cell-mono {
  font-family: var(--font-family-mono);
  font-size: 0.75rem;
  color: var(--theme-text-tertiary);
}
```

---

## 6. Toast/Notification Component

```css
/* components/toast.css */

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--theme-surface-overlay);
  border: 1px solid var(--theme-border-default);
  box-shadow: var(--shadow-lg);
  max-width: 400px;
  animation: toastSlideIn var(--duration-normal) var(--ease-spring) forwards;
}

.toast--success { border-left: 3px solid var(--theme-success); }
.toast--warning { border-left: 3px solid var(--theme-warning); }
.toast--error   { border-left: 3px solid var(--theme-danger); }
.toast--info    { border-left: 3px solid var(--theme-info); }

.toast-dismiss {
  animation: toastSlideOut var(--duration-fast) var(--ease-in) forwards;
}

@keyframes toastSlideIn {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes toastSlideOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(16px); }
}
```

---

## 7. Modal / Dialog Component

```css
/* components/modal.css */

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn var(--duration-fast) ease;
}

.modal {
  background: var(--theme-surface-overlay);
  border: 1px solid var(--theme-border-default);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  max-width: 500px;
  width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  animation: modalEnter var(--duration-normal) var(--ease-spring);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--theme-text-primary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--theme-border-subtle);
}

@keyframes modalEnter {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

---

## 8. Component Naming Convention

All components follow this naming convention:

| Pattern | Example | Rule |
|---------|---------|------|
| **Base element** | `.btn`, `.input`, `.badge` | Noun, lowercase |
| **Variant** | `.btn-primary`, `.btn-danger` | Base + hyphen + variant |
| **Modifier** | `.btn--sm`, `.btn--lg` | Base + double-hyphen + modifier |
| **State** | `.btn:hover`, `.btn:disabled` | CSS pseudo-classes |
| **Child** | `.bento-header`, `.bento-title` | Parent + hyphen + child |
| **Conditional** | `.stat-value--danger` | Element + double-hyphen + condition |

> **Rule:** No BEM `__` double underscore. Use single hyphen for children, double hyphen for modifiers/conditions.
{% endraw %}

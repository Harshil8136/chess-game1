{% raw %}
# 10 — File-by-File Audit Checklist

> **Purpose:** Comprehensive audit of every file that needs modification during the overhaul.  
> **Format:** Each entry lists the file, current issues, required changes, and verification steps.

---

## Status Key

- 🔴 **Critical** — Blocks the overhaul; must be first
- 🟡 **Important** — Significant refactoring needed
- 🟢 **Minor** — Small tweaks, token replacements
- ⚪ **No Change** — File is clean, keep as-is

---

## 1. Theme Files

### 🔴 `src/styles/themes/dark.css` (58 lines)

**Current Issues:**
- Accent is neon cyan `#00e5ff` — needs to be Blue-500 `#3b82f6`
- Accent hover is `#4dffff` — needs Blue-400 `#60a5fa`
- All accent-derived rgba values use cyan

**Changes Required:**
```diff
- --theme-accent: #00e5ff;
+ --theme-accent: #3b82f6;

- --theme-accent-hover: #4dffff;
+ --theme-accent-hover: #60a5fa;

- --theme-accent-muted: rgba(0, 229, 255, 0.15);
+ --theme-accent-muted: rgba(59, 130, 246, 0.15);

- --theme-accent-glow: rgba(0, 229, 255, 0.4);
+ --theme-accent-glow: rgba(59, 130, 246, 0.4);

- --theme-accent-subtle: rgba(0, 229, 255, 0.08);
+ --theme-accent-subtle: rgba(59, 130, 246, 0.08);
```

Also change border-accent:
```diff
- --theme-border-accent: rgba(255, 255, 255, 0.4);
+ --theme-border-accent: rgba(59, 130, 246, 0.4);
```

**Verification:** All accent-colored elements (buttons, links, focus rings) should appear Blue-500 instead of cyan.

---

### 🟡 `src/styles/themes/light.css` (58 lines)

**Changes Required:**
```diff
- --theme-accent: #0ea5e9;
+ --theme-accent: #2563eb;

- --theme-accent-hover: #0284c7;
+ --theme-accent-hover: #1d4ed8;

- --theme-accent-muted: rgba(14, 165, 233, 0.15);
+ --theme-accent-muted: rgba(37, 99, 235, 0.12);

- --theme-accent-glow: rgba(14, 165, 233, 0.25);
+ --theme-accent-glow: rgba(37, 99, 235, 0.25);

- --theme-accent-subtle: rgba(14, 165, 233, 0.08);
+ --theme-accent-subtle: rgba(37, 99, 235, 0.06);

- --theme-border-accent: rgba(14, 165, 233, 0.4);
+ --theme-border-accent: rgba(37, 99, 235, 0.4);
```

Also update shadow:
```diff
- --theme-shadow-card: ... rgba(14, 165, 233, 0.04);
+ --theme-shadow-card: ... rgba(37, 99, 235, 0.04);
```

**Verification:** Toggle to light theme. Accent elements should be a deeper blue, not sky blue.

---

## 2. Global & Utility Styles

### 🟡 `src/styles/global.css` (205 lines)

**Changes Required:**
1. Remove `--color-cyan`, `--color-cyan-muted`, `--color-cyan-glow` aliases (lines 96-98) — these were promoting cyan as a pseudo-accent
2. Add comment clarifying that accent = Blue-500 family
3. No structural changes needed — `@theme` bridge system is well-designed

```diff
-   /* Miscellaneous Colors */
-   --color-cyan: var(--theme-cyan);
-   --color-cyan-muted: color-mix(in srgb, var(--theme-cyan) 12%, transparent);
-   --color-cyan-glow: color-mix(in srgb, var(--theme-cyan) 30%, transparent);
+   /* Note: Cyan remains as section color only (--color-section-cyan).
+      Interactive accent is --color-accent (Blue-500 family). */
```

**Verification:** Grep for `var(--color-cyan)` across all files and replace interactive uses with `var(--color-accent)`.

---

### ⚪ `src/styles/sections.css` (76 lines)

**No changes required.** The section color resolution system is clean and correctly scoped.

---

### 🟢 `src/styles/utilities.css` (~100 lines)

**Audit for:**
- Dead utility classes not used in any component
- Utilities that duplicate Tailwind (remove if Tailwind covers them)

---

### 🔴 `src/styles/placeholder.css` (5.3 KB)

**Action: DELETE ENTIRE FILE**

Remove import from `AdminLayout.astro`:
```diff
- import '../styles/placeholder.css';
```

---

## 3. Page-Specific Stylesheets

### 🔴 `src/components/dashboard/Dashboard.css` (27.1 KB, 1000+ lines)

**Action: SPLIT into ~12 component files + 1 page file**

See `02-css-architecture.md` §4 for the complete extraction plan.

After splitting:
1. Delete the original `Dashboard.css`
2. Update every dashboard component `.tsx` to import its own CSS
3. Create `src/styles/pages/dashboard.css` for page-level grid styles

---

### 🟡 `src/styles/chatbot.css` (22.2 KB, ~700 lines)

**Action: SPLIT into component files + `src/styles/pages/chatbot.css`**

Class prefixes to extract:
- `.chatbot-hub-*` → `components/chatbot-hub.css`
- `.conversation-*` → `components/chatbot-conversation.css`
- `.knowledge-*` → `components/chatbot-knowledge.css`
- `.chat-analytics-*` → `components/chatbot-analytics.css`
- `.chat-settings-*` → `components/chatbot-settings.css`

---

### 🟡 `src/styles/auth.css` (8.7 KB, 335 lines)

**Action: IN-PLACE refactor — replace all hardcoded colors with tokens**

See `08-code-cleanup.md` §2.1 for the complete color replacement map (17 replacements needed).

Key changes:
- All `rgba(99,102,241,...)` → `var(--theme-accent-*)` tokens
- All `rgba(34,211,238,...)` → `var(--theme-accent-*)` tokens
- All `rgba(139,92,246,...)` → `var(--theme-accent-*)` tokens
- Primary CTA gradient: use Blue-500 family gradient

---

### 🟢 `src/styles/audit.css` (18.2 KB, ~600 lines)

**Action:** Audit for hardcoded colors. Move to `src/styles/pages/audit.css`. Update import location.

---

## 4. Layout Files

### 🔴 `src/layouts/AdminLayout.astro` (153 lines)

**Changes Required:**
1. **Move `data-theme` from `<body>` to `<html>`**
2. **Remove `data-theme="slate"` and inline `style`**
3. **Add blocking theme script in `<head>`**
4. **Delete noise SVG** (lines 91-94)
5. **Extract inline gradient orbs** to CSS classes
6. **Remove `placeholder.css` import**
7. **Add skip navigation link**
8. **Add ARIA landmarks** (nav, header, main)

```diff
  <head>
+   <script is:inline>
+     (function() {
+       var m = document.cookie.match(/cf_admin_theme=(dark|light)/);
+       var t = m ? m[1] : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
+       document.documentElement.setAttribute('data-theme', t);
+     })();
+   </script>
    <!-- ... rest of head ... -->
  </head>
- <body data-theme="slate" style="background:var(--theme-bg);" class={...}>
+ <body class={...}>
+   <a href="#main-content" class="skip-nav">Skip to main content</a>
    <div class="admin-layout">
-     <Sidebar client:load ... />
+     <nav aria-label="Main navigation">
+       <Sidebar client:load ... />
+     </nav>
      <div class="admin-content-area">
-       <TopBar client:load ... />
+       <header role="banner">
+         <TopBar client:load ... />
+       </header>
-       <main class="admin-main-content">
+       <main id="main-content" class="admin-main-content">
          <slot />
        </main>
      </div>
    </div>
```

---

### 🟢 `src/layouts/AdminLayout.css` (1.0 KB)

**Minor changes:** May need to add skip-nav styles, orb CSS classes.

---

### ⚪ `src/layouts/AuthLayout.astro` (7.9 KB)

**Verify:** Uses auth.css correctly. May need the same theme detection updates.

---

### ⚪ `src/layouts/ChatbotLayout.astro` (0.8 KB)

**No changes anticipated.**

---

## 5. Dashboard Components

### 🔴 `src/components/dashboard/DashboardController.tsx` (339 lines, 15.6 KB)

**This is the most heavily modified file in the entire overhaul.**

Changes:
1. **Remove `zoom: 1.1`** (line 153)
2. **Remove `window.location.reload()`** (line 196) — replace with state refetch
3. **Extract ALL inline `style={{}}` objects** (~200 lines) → CSS classes (~30 new classes)
4. **Remove `onMouseOver`/`onMouseOut` handlers** (lines 214-221) → CSS `:hover`
5. **Replace hardcoded chart colors** (lines 135, 143, 144, 145)
6. **Replace Tailwind `cyan-500/50`** → `blue-500/50` (line 197)
7. **Add CSS component imports** (bento, chart, setup-banner, etc.)

**Expected result:** File shrinks from ~339 lines to ~200 lines (40% reduction) as inline styles move to CSS.

---

### 🟡 `src/components/dashboard/SystemHealthBar.tsx` (9.6 KB)

**Changes:**
- Extract inline styles to `components/health-bar.css`
- Replace any hardcoded colors with tokens
- Add `aria-label` to health indicator dots
- Add screen reader text for service status

---

### 🟡 `src/components/dashboard/WorkersWidget.tsx` (6.4 KB)

**Changes:**
- Extract styles to `components/workers-widget.css`
- Replace hardcoded colors
- Add `aria-label` to interactive elements

---

### 🟡 `src/components/dashboard/StorageWidget.tsx` (7.3 KB)

**Changes:**
- Extract styles to `components/storage-widget.css`
- Replace hardcoded colors
- Add ARIA roles for progress bars

---

### 🟡 `src/components/dashboard/SupabaseAuthWidget.tsx` (8.3 KB)

**Changes:**
- Extract styles to `components/auth-widget.css`
- Replace hardcoded colors

---

### 🟡 `src/components/dashboard/QuotaMonitorWidget.tsx` (6.6 KB)

**Changes:**
- Extract styles to `components/quota-widget.css`
- Add `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

---

### 🟢 `src/components/dashboard/StatCard.tsx` (5.5 KB)

**Changes:** Extract inline styles. Wrap in `memo()`.

---

### 🟢 `src/components/dashboard/ActivityFeed.tsx` (2.5 KB)

**Changes:** Extract styles. Add entry animation. Wrap in `memo()`.

---

### 🟢 `src/components/dashboard/QuickActions.tsx` (3.6 KB)

**Changes:** Extract styles. Ensure 44px touch targets.

---

## 6. Navigation Components

### 🟡 `src/components/navigation/TopBar.tsx` (8.7 KB)

**Changes:**
1. Add `ThemeToggle` component between search and user profile
2. Review for hardcoded colors
3. Add ARIA landmarks

---

### 🟢 `src/components/navigation/TopBar.css` (5.2 KB)

**Changes:** Review for hardcoded colors. Add theme toggle styling.

---

### 🟡 `src/components/navigation/CommandPalette.tsx` (7.4 KB)

**Changes:**
- Add focus trapping
- Add `aria-modal="true"`, `role="dialog"`
- Verify keyboard navigation (Up/Down arrows, Enter, Escape)

---

### 🟡 `src/components/navigation/Sidebar/` (directory)

**Changes:**
- Add `aria-label="Main navigation"` wrapper
- Keyboard arrow key navigation between items
- Active item indication via `aria-current="page"`

---

## 7. UI Components

### 🟢 `src/components/ui/ConfirmDialog.tsx` (9.6 KB)

**Changes:** Add focus trapping. Verify accessible dialog pattern.

---

### 🟢 `src/components/ui/SlideDrawer.tsx` + `SlideDrawer.css` (3.4 KB + 0.8 KB)

**Changes:** Verify focus management. Add `aria-modal`.

---

### 🟢 `src/components/ui/ToastProvider.tsx` (3.3 KB)

**Changes:** Ensure toast container has `role="status"` and `aria-live="polite"`.

---

### 🟢 `src/components/ui/ToggleSwitch.tsx` (2.0 KB)

**Changes:** Verify `role="switch"` and `aria-checked` attributes.

---

### 🟢 `src/components/ui/ErrorBoundary.tsx` (2.3 KB)

**No changes anticipated.**

---

## 8. Admin Components

### 🟡 `src/components/admin/BookingList.tsx` (11.7 KB)

**Changes:** Replace table with standardized table component pattern. Add mobile card layout.

---

### 🟡 `src/components/admin/chatbot/` (directory)

**Changes:** Ensure all chatbot admin components use tokens. Add tab ARIA pattern.

---

## 9. New Files to Create

| File | Purpose | Section Reference |
|------|---------|-------------------|
| `src/styles/components/bento.css` | Bento grid + card base | §1 this file |
| `src/styles/components/stat-card.css` | Stat number display | — |
| `src/styles/components/health-bar.css` | Health indicators | — |
| `src/styles/components/workers-widget.css` | Workers widget | — |
| `src/styles/components/storage-widget.css` | Storage/R2 widget | — |
| `src/styles/components/quota-widget.css` | Quota bars | — |
| `src/styles/components/auth-widget.css` | Supabase auth | — |
| `src/styles/components/activity-feed.css` | Activity feed | — |
| `src/styles/components/quick-actions.css` | Quick action grid | — |
| `src/styles/components/chart.css` | uPlot chart container | — |
| `src/styles/components/setup-banner.css` | API token warning | — |
| `src/styles/components/button.css` | Standardized buttons | 09 §2 |
| `src/styles/components/badge.css` | Status + role badges | 09 §3 |
| `src/styles/components/input.css` | Form inputs | 09 §4 |
| `src/styles/components/table.css` | Data tables | 09 §5 |
| `src/styles/components/toast.css` | Toast notifications | 09 §6 |
| `src/styles/components/modal.css` | Modal dialogs | 09 §7 |
| `src/styles/pages/dashboard.css` | Dashboard page layout | — |
| `src/styles/pages/chatbot.css` | Chatbot admin layout | — |
| `src/styles/pages/audit.css` | Audit log page | — |
| `src/components/navigation/ThemeToggle.tsx` | Theme toggle button | 03 §4 |

**Total: 21 new files**

---

## 10. Execution Priority Order

### Phase 1: Foundation (Do First)
1. `dark.css` — Blue-500 accent tokens
2. `light.css` — Blue-600 accent tokens
3. `global.css` — Remove cyan aliases
4. `AdminLayout.astro` — Theme detection, skip-nav, landmarks, remove slate/zoom

### Phase 2: Component CSS Extraction
5. Create `src/styles/components/` directory
6. Create `src/styles/pages/` directory
7. Split `Dashboard.css` → 12 component files + page file
8. Split `chatbot.css` → 5 component files + page file

### Phase 3: Inline Style Extraction
9. `DashboardController.tsx` — Extract 200+ lines of inline styles
10. All dashboard widget `.tsx` files — Extract inline styles

### Phase 4: Color Replacement
11. `auth.css` — Replace 17 hardcoded color values
12. All components — Grep-and-replace remaining hardcoded colors

### Phase 5: New Components
13. Create `ThemeToggle.tsx`
14. Create standardized `button.css`, `badge.css`, `input.css`, `table.css`
15. Integrate ThemeToggle into TopBar

### Phase 6: Accessibility
16. Focus management (skip-nav, focus trap, landmarks)
17. ARIA attributes on all interactive elements
18. `prefers-reduced-motion` support

### Phase 7: Cleanup & Verification
19. Delete `placeholder.css`, noise SVG, dead code
20. Visual regression test every page
21. Lighthouse audit (performance + accessibility scores)
22. Cross-browser test (Chrome, Firefox, Safari)

{% endraw %}

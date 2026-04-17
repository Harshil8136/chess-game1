# 03 — Theme System (Dark + Light)

> **Goal:** Ship dark and light themes simultaneously with a persistent toggle, system preference detection, and zero Flash of Wrong Theme (FOWT).

---

## 1. Theme Detection Cascade

The theme is resolved using a strict cascade — first match wins:

```
1. Cookie `cf_admin_theme` → "dark" | "light"     (user's explicit choice)
2. prefers-color-scheme media query                (OS/browser setting)
3. Default: "dark"                                 (fallback)
```

---

## 2. SSR Theme Injection (Blocking Script)

To prevent FOWT, a **blocking `<script>`** runs in `<head>` BEFORE any CSS or DOM renders. This sets `data-theme` on `<html>` synchronously.

### Implementation in AdminLayout.astro

```astro
---
// Read theme cookie server-side for SSR hint
const themeCookie = Astro.cookies.get('cf_admin_theme')?.value;
const ssrTheme = themeCookie === 'light' ? 'light' : 'dark';
---

<html lang="en" data-theme={ssrTheme}>
  <head>
    <!-- Blocking theme script — MUST be first in <head> -->
    <script is:inline>
      (function() {
        // 1. Check cookie
        var match = document.cookie.match(/cf_admin_theme=(dark|light)/);
        var theme = match ? match[1] : null;
        
        // 2. Check system preference
        if (!theme) {
          theme = window.matchMedia('(prefers-color-scheme: light)').matches
            ? 'light' : 'dark';
        }
        
        // 3. Apply immediately (before paint)
        document.documentElement.setAttribute('data-theme', theme);
      })();
    </script>
    
    <!-- CSS loads AFTER theme attribute is set -->
    <!-- ... rest of head ... -->
  </head>
```

### Key Points

- `is:inline` in Astro prevents the script from being bundled/deferred — it runs immediately
- The script is ~200 bytes minified — negligible blocking cost
- The SSR `data-theme={ssrTheme}` provides the initial attribute for Astro's HTML generation
- The blocking script corrects it client-side if cookie disagrees with SSR guess

---

## 3. CSS Theme Selectors

### 3.1 Current Problem

```html
<!-- ❌ CURRENT: Uses data-theme="slate" — not mapped to anything -->
<body data-theme="slate" style="background:var(--theme-bg);">
```

`data-theme="slate"` is not matched by any CSS selector. The dark theme only works because `:root` (without qualifier) sets the dark tokens as defaults.

### 3.2 Fixed Selectors

```css
/* dark.css */
@layer base {
  :root,
  :root[data-theme="dark"] {
    /* Dark tokens */
  }
}

/* light.css */
@layer base {
  :root[data-theme="light"] {
    /* Light tokens — overrides :root defaults */
  }
}
```

### 3.3 Remove data-theme from `<body>`

Move `data-theme` to `<html>` element (the `:root`). Remove it from `<body>`.

```diff
- <body data-theme="slate" style="background:var(--theme-bg);">
+ <body>
```

```diff
- <html lang="en">
+ <html lang="en" data-theme={ssrTheme}>
```

---

## 4. Theme Toggle Component

### 4.1 Location

The toggle lives in `TopBar.tsx`, right-aligned next to the user profile dropdown.

### 4.2 Behavior

1. Click toggles between `"dark"` and `"light"`
2. Sets `document.documentElement.dataset.theme` immediately (no page reload)
3. Sets cookie `cf_admin_theme` with `max-age=31536000` (1 year), `path=/`, `SameSite=Lax`
4. Dispatches a `CustomEvent('theme-change')` for any components that need to react (e.g., chart re-theme)

### 4.3 Implementation Sketch

```tsx
// components/navigation/ThemeToggle.tsx
import { useState, useEffect } from 'preact/hooks';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Read initial theme from DOM (set by blocking script)
    const current = document.documentElement.getAttribute('data-theme') as 'dark' | 'light';
    setTheme(current || 'dark');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    
    // 1. Update DOM immediately
    document.documentElement.setAttribute('data-theme', next);
    
    // 2. Persist to cookie
    document.cookie = `cf_admin_theme=${next};max-age=31536000;path=/;SameSite=Lax`;
    
    // 3. Notify other components
    window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: next } }));
    
    // 4. Update local state
    setTheme(next);
  };

  return (
    <button 
      onClick={toggle}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? (
        <SunIcon />   /* Show sun icon = "click to go light" */
      ) : (
        <MoonIcon />  /* Show moon icon = "click to go dark" */
      )}
    </button>
  );
}
```

### 4.4 CSS for the Toggle

```css
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid var(--theme-border-subtle);
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition: 
    background var(--duration-fast) ease,
    color var(--duration-fast) ease,
    border-color var(--duration-fast) ease;
}

.theme-toggle:hover {
  background: var(--theme-surface-raised);
  color: var(--theme-text-primary);
  border-color: var(--theme-border-default);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
}

/* Smooth icon transition */
.theme-toggle svg {
  transition: transform var(--duration-normal) var(--ease-spring);
}

.theme-toggle:active svg {
  transform: scale(0.85) rotate(15deg);
}
```

---

## 5. System Preference Listener

The app respects `prefers-color-scheme` changes (e.g., macOS auto Dark Mode at sunset) ONLY if the user hasn't explicitly set a theme via cookie.

```tsx
// In ThemeToggle.tsx or a global hook
useEffect(() => {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  
  const handler = (e: MediaQueryListEvent) => {
    // Only auto-switch if no cookie exists (user hasn't explicitly chosen)
    if (!document.cookie.includes('cf_admin_theme=')) {
      const newTheme = e.matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      setTheme(newTheme);
    }
  };
  
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, []);
```

---

## 6. Transition Between Themes

When the theme toggles, a smooth CSS transition animates the change:

```css
/* Already in global.css body rule — keep */
body {
  transition: background 0.3s ease, color 0.3s ease;
}

/* Add to all surface elements */
.bento-card,
.sidebar,
.topbar,
.command-palette {
  transition: 
    background var(--duration-slow) ease,
    border-color var(--duration-slow) ease,
    box-shadow var(--duration-slow) ease;
}
```

---

## 7. Component Theme Awareness

### 7.1 Charts (uPlot)

Charts need explicit re-rendering when the theme changes because canvas-based rendering doesn't respond to CSS variable changes.

```tsx
useEffect(() => {
  const handler = () => {
    // Force chart redraw with new theme colors
    if (chartRef.current) {
      chartRef.current.redraw();
    }
  };
  window.addEventListener('theme-change', handler);
  return () => window.removeEventListener('theme-change', handler);
}, []);
```

### 7.2 Ambient Background Orbs

The gradient orbs in `AdminLayout.astro` need theme-aware colors:

```css
:root[data-theme="light"] .admin-ambient-orb-1 {
  /* Softer, warmer gradients for light mode */
  background: radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%);
}

:root[data-theme="light"] .admin-ambient-orb-2 {
  background: radial-gradient(circle, rgba(37,99,235,0.1), transparent 70%);
}
```

---

## 8. Migration Steps

1. [ ] Fix `<html>` to use `data-theme` instead of `<body data-theme="slate">`
2. [ ] Add blocking theme script to `AdminLayout.astro` `<head>`
3. [ ] Read `cf_admin_theme` cookie in Astro frontmatter for SSR hint
4. [ ] Update `dark.css` accent from `#00e5ff` to Blue-500
5. [ ] Update `light.css` accent from `#0ea5e9` to Blue-600
6. [ ] Create `ThemeToggle.tsx` component
7. [ ] Add `ThemeToggle` to `TopBar.tsx`
8. [ ] Add system preference listener
9. [ ] Add `theme-change` CustomEvent dispatch
10. [ ] Update ambient orbs for light theme
11. [ ] Test: Toggle works without page reload
12. [ ] Test: Cookie persists across sessions
13. [ ] Test: System preference auto-switches (when no cookie)
14. [ ] Test: No FOWT on hard refresh
15. [ ] Test: Charts re-render on theme change

{% raw %}
# 05 — Animation & Motion System

> **Philosophy:** "Every animation communicates real system state. No decorative noise."  
> **Constraint:** All animations must respect `prefers-reduced-motion`.

---

## 1. Motion Tokens

```css
/* Duration Scale */
--duration-instant:  60ms;     /* Opacity toggles, checkbox ticks */
--duration-fast:    120ms;     /* Hover color changes, focus rings */
--duration-normal:  200ms;     /* Panel reveals, tab switches */
--duration-slow:    350ms;     /* Page transitions, drawer slides */
--duration-slower:  500ms;     /* Complex orchestrated sequences */

/* Easing Functions */
--ease-out:        cubic-bezier(0.16, 1, 0.3, 1);       /* Natural deceleration — default for most */
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);   /* Bouncy — emphasis, notifications */
--ease-in-out:     cubic-bezier(0.45, 0, 0.55, 1);      /* Symmetric — looping animations */
--ease-in:         cubic-bezier(0.55, 0, 1, 0.45);      /* Accelerating — elements exiting */
```

### When to Use Each Easing

| Easing | Use Case | Example |
|--------|----------|---------|
| `--ease-out` | Elements appearing, expanding, revealing | Dropdown opens, card enters viewport |
| `--ease-spring` | Emphasis, attention, interactive feedback | Button bounce on click, toast notification arrives |
| `--ease-in-out` | Continuous/looping, bidirectional | Loading spinner, ambient orb drift |
| `--ease-in` | Elements leaving, collapsing | Modal closing, toast dismissing |

---

## 2. Animation Categories

### 2.1 Micro-Interactions (60–200ms)

Instant feedback that makes the UI feel responsive.

```css
/* Hover state — buttons, cards, nav items */
.interactive-element {
  transition: 
    background var(--duration-fast) ease,
    border-color var(--duration-fast) ease,
    color var(--duration-fast) ease,
    transform var(--duration-fast) var(--ease-out);
}

.interactive-element:hover {
  transform: translateY(-1px);  /* Subtle lift */
}

.interactive-element:active {
  transform: scale(0.98);       /* Press-down feel */
  transition-duration: var(--duration-instant);
}
```

```css
/* Focus ring animation */
:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
  animation: focusRing var(--duration-fast) var(--ease-spring);
}

@keyframes focusRing {
  0% { outline-offset: 0px; outline-color: transparent; }
  100% { outline-offset: 2px; outline-color: var(--theme-accent); }
}
```

### 2.2 Component Transitions (200–350ms)

Panel reveals, tab switches, content changes.

```css
/* Fade-in for lazy-loaded content */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn var(--duration-normal) var(--ease-out) forwards;
}

/* Staggered card entrance */
.bento-card {
  animation: fadeIn var(--duration-slow) var(--ease-out) both;
}

.bento-card:nth-child(1) { animation-delay: 0ms; }
.bento-card:nth-child(2) { animation-delay: 60ms; }
.bento-card:nth-child(3) { animation-delay: 120ms; }
.bento-card:nth-child(4) { animation-delay: 180ms; }
.bento-card:nth-child(5) { animation-delay: 240ms; }
.bento-card:nth-child(6) { animation-delay: 300ms; }
```

```css
/* Sidebar expand/collapse */
.sidebar {
  width: var(--sidebar-width, 72px);
  transition: width var(--duration-normal) var(--ease-out);
}

.sidebar-expanded .sidebar {
  width: var(--sidebar-expanded-width, 240px);
}

/* Sidebar label fade */
.sidebar-label {
  opacity: 0;
  transform: translateX(-4px);
  transition: 
    opacity var(--duration-fast) ease,
    transform var(--duration-fast) ease;
}

.sidebar-expanded .sidebar-label {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 80ms;  /* Wait for width to expand first */
}
```

### 2.3 Page Transitions (350–500ms)

Using Astro's View Transitions API for smooth page-to-page navigation.

```astro
<!-- AdminLayout.astro -->
<ClientRouter />
```

```css
/* Page content cross-fade */
::view-transition-old(root) {
  animation: fadeOut var(--duration-normal) var(--ease-in) forwards;
}

::view-transition-new(root) {
  animation: fadeIn var(--duration-normal) var(--ease-out) forwards;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
```

---

## 3. Truthful Animations — Real Data Only

### 3.1 Health Status Pulse

The `SystemHealthBar` shows real service health. The pulse animation reflects ACTUAL status:

```css
/* Green pulse = service is healthy (based on real API check) */
.health-dot--healthy {
  background: var(--theme-success);
  animation: healthPulse 3s var(--ease-in-out) infinite;
}

@keyframes healthPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
  50%      { box-shadow: 0 0 0 4px rgba(74, 222, 128, 0); }
}

/* Red static = service is down (no animation = dead) */
.health-dot--down {
  background: var(--theme-danger);
  /* No animation — static red = clearly unhealthy */
}

/* Amber slow pulse = degraded performance */
.health-dot--degraded {
  background: var(--theme-warning);
  animation: healthPulse 5s var(--ease-in-out) infinite;
}

/* Gray = unknown/loading */
.health-dot--unknown {
  background: var(--theme-text-muted);
  opacity: 0.5;
}
```

### 3.2 Counter Animation (Real Values)

Stat values animate from 0 to their REAL value on load:

```tsx
// Animate counter from 0 to target value
function useAnimatedCounter(target: number, duration: number = 800) {
  const [value, setValue] = useState(0);
  
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out curve for natural feel
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  
  return value;
}

// Usage:
const displayRequests = useAnimatedCounter(analytics?.cloudflare?.requests ?? 0);
```

### 3.3 Activity Feed — Real Events

The activity feed shows REAL audit log events. New items slide in from the top:

```css
.activity-item-enter {
  animation: slideInFromTop var(--duration-normal) var(--ease-spring) forwards;
}

@keyframes slideInFromTop {
  from { 
    opacity: 0; 
    transform: translateY(-12px) scale(0.97); 
    max-height: 0;
  }
  to { 
    opacity: 1; 
    transform: translateY(0) scale(1); 
    max-height: 80px;
  }
}
```

### 3.4 Quota Bars — Real Usage

Quota progress bars animate to their REAL percentage:

```css
.quota-bar-fill {
  width: 0;
  transition: width 1s var(--ease-out);
  /* Width is set via inline style from real data */
}

/* Color changes based on real quota level */
.quota-bar-fill--healthy {
  background: linear-gradient(90deg, var(--theme-success), oklch(0.75 0.18 145));
}

.quota-bar-fill--warning {
  background: linear-gradient(90deg, var(--theme-warning), oklch(0.75 0.15 55));
}

.quota-bar-fill--critical {
  background: linear-gradient(90deg, var(--theme-danger), oklch(0.65 0.2 25));
}
```

---

## 4. Ambient Background (Decorative — The Exception)

The ambient gradient orbs in `AdminLayout.astro` are the ONLY decorative animation. They create depth and atmosphere without conveying data.

```css
/* Slow, continuous drift — 25-35s cycles */
@keyframes orbDrift1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(40px, 30px) scale(1.05); }
  66%      { transform: translate(-20px, 50px) scale(0.95); }
}

/* Very low opacity (0.06-0.12) — visible but not distracting */
.admin-ambient-orb {
  opacity: 0.08;
  filter: blur(80px);
  will-change: transform;  /* GPU-accelerated */
}
```

---

## 5. Loading States

### 5.1 Content-Aware Skeleton Loaders

Skeleton loaders match the SHAPE of the content they replace:

```css
/* Skeleton shimmer */
@keyframes shimmer {
  0%   { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--theme-surface-raised) 0%,
    var(--theme-surface-overlay) 50%,
    var(--theme-surface-raised) 100%
  );
  background-size: 200px 100%;
  animation: shimmer 1.5s var(--ease-in-out) infinite;
  border-radius: var(--radius-sm);
}

/* Shape variants */
.skeleton--text    { height: 14px; width: 60%; }
.skeleton--number  { height: 28px; width: 80px; }
.skeleton--chart   { height: 200px; width: 100%; border-radius: var(--radius-md); }
.skeleton--circle  { width: 40px; height: 40px; border-radius: 50%; }
```

### 5.2 Full-Card Skeleton

```tsx
function BentoCardSkeleton() {
  return (
    <div className="bento-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton skeleton--circle" />
        <div className="skeleton skeleton--text" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton skeleton--number" />
        <div className="skeleton skeleton--number" />
        <div className="skeleton skeleton--number" />
        <div className="skeleton skeleton--number" />
      </div>
    </div>
  );
}
```

---

## 6. Reduced Motion

All motion must be disabled or minimized when the user has `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* Keep essential state indicators visible but static */
  .health-dot--healthy {
    box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3);
    /* Static glow instead of pulsing */
  }
  
  /* Disable ambient orbs entirely */
  .admin-ambient-orb {
    display: none;
  }
  
  /* Skip page transitions */
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

---

## 7. Performance Rules

1. **GPU-accelerate only what moves:** Use `will-change: transform` only on actively animating elements (orbs, sidebar). Remove after animation completes.
2. **No layout-triggering animations:** Never animate `width`, `height`, `top`, `left`, `margin`, `padding`. Use `transform` and `opacity` only.
3. **Cap animation duration:** Nothing over 500ms. Users perceive anything longer as sluggish.
4. **Debounce resize-triggered animations:** ResizeObserver callbacks that trigger re-renders should be debounced to 100ms.
5. **Lazy-load chart library:** uPlot is loaded via dynamic `import()` only when the chart card is in viewport.
{% endraw %}

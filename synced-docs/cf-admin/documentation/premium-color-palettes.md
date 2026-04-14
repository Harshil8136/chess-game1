# 🎨 CF-ADMIN — PREMIUM COLOR PALETTES

> **🚨 DEPRECATED:** This multi-color section identity system (Obsidian Spectrum) has been replaced globally by the unified **"Midnight Slate" (Cyan Accent)** theme! DO NOT USE VIOLET ACCENTS OR SECTION COLORS.
> **Version:** 2.0 — "Obsidian Spectrum" (DEPRECATED)
> **Last Updated:** 2026-04-03
> **Status:** DEPRECATED in favor of Midnight Slate
> **Design Philosophy:** Every section of the admin portal has a unique color identity for instant visual scanning, emotional differentiation, and premium aesthetics.

---

## 🧬 DESIGN DNA — THE PHILOSOPHY

The "Obsidian Spectrum" system extends the original "Obsidian Clarity" dark-first palette with a **per-section color identity layer**. Instead of a monochromatic violet-only interface, each functional area of the admin portal radiates its own premium accent — creating an experience that rivals Linear, Vercel, Raycast, and Arc Browser.

### Core Principles
1. **Instant Scanning** — A user glancing at the sidebar or any page can identify which section they're in within 100ms, purely from color cues.
2. **Emotional Differentiation** — Warm colors (amber/rose) for data-centric sections; cool colors (cyan/blue) for security/technical; jewel tones (violet/emerald) for creative/management.
3. **Consistent Depth** — Every section accent follows the same 6-tier opacity system, ensuring no section feels louder or quieter than another.
4. **Dark Canvas Harmony** — All colors are carefully selected to bloom beautifully against `#060a0e` to `#0c1117` backgrounds without creating muddy or washed-out appearances.

---

## 🏗️ THE 6-TIER OPACITY SYSTEM

Every section accent color generates exactly 6 derivative values:

| Tier | CSS Variable Suffix | Opacity | Usage |
|------|---------------------|---------|-------|
| **Primary** | `--section-primary` | 100% | Buttons, active indicators, badges, icon fills |
| **Hover** | `--section-hover` | ~85-100% (lighter tint) | Button hover, link hover, interactive states |
| **Muted** | `--section-muted` | 12% | Card backgrounds, nav item active bg, subtle fills |
| **Glow** | `--section-glow` | 20-25% | Box shadows, ambient orbs, focus rings |
| **Subtle** | `--section-subtle` | 6% | Table row hover, page background tint, breadcrumb hints |
| **Border** | `--section-border` | 20-30% | Active borders, dividers, card outlines |

---

## 🎯 THE SEVEN SECTION ACCENTS — EXACT SPECIFICATIONS

### Section 1: COMMAND CENTER (Dashboard/Overview)
**Accent: Electric Violet** — The signature brand color. Command and authority.

| Property | Value |
|----------|-------|
| Hue Family | Violet (270°) |
| Inspiration | Linear App, Stripe dark, Supabase |
| Primary | `#8b5cf6` |
| Hover | `#a78bfa` |
| Muted (12%) | `rgba(139, 92, 246, 0.12)` |
| Glow (25%) | `rgba(139, 92, 246, 0.25)` |
| Subtle (6%) | `rgba(139, 92, 246, 0.06)` |
| Border (25%) | `rgba(139, 92, 246, 0.25)` |
| Icon Active | `#a78bfa` |
| Section Label | `rgba(139, 92, 246, 0.65)` |
| Active Dot | `#a78bfa` with `shadow: 0 0 8px rgba(139,92,246,0.6)` |
| Ambient Orb | `radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)` |

**Where it appears:** Dashboard page, overview stats, welcome greeting gradient, sidebar "Main" section.

---

### Section 2: ARCTIC SHIELD (Security/Audit)
**Accent: Arctic Cyan** — Cool, vigilant, trustworthy. The color of digital surveillance.

| Property | Value |
|----------|-------|
| Hue Family | Cyan (195°) |
| Inspiration | Vercel teal, GitHub dark, Cloudflare |
| Primary | `#06b6d4` |
| Hover | `#22d3ee` |
| Muted (12%) | `rgba(6, 182, 212, 0.12)` |
| Glow (25%) | `rgba(6, 182, 212, 0.25)` |
| Subtle (6%) | `rgba(6, 182, 212, 0.06)` |
| Border (25%) | `rgba(6, 182, 212, 0.25)` |
| Icon Active | `#22d3ee` |
| Section Label | `rgba(6, 182, 212, 0.65)` |
| Active Dot | `#22d3ee` with `shadow: 0 0 8px rgba(6,182,212,0.6)` |
| Ambient Orb | `radial-gradient(circle, rgba(6,182,212,0.4), transparent 70%)` |

**Where it appears:** Audit logs, session activity, security dashboard, user activity panels, sidebar "Security" items.

---

### Section 3: SOLAR FORGE (Bookings/Data)
**Accent: Solar Amber** — Warm, productive, data-driven. The color of business operations.

| Property | Value |
|----------|-------|
| Hue Family | Amber (40°) |
| Inspiration | Arc Browser, Notion amber, Linear orange |
| Primary | `#f59e0b` |
| Hover | `#fbbf24` |
| Muted (12%) | `rgba(245, 158, 11, 0.12)` |
| Glow (25%) | `rgba(245, 158, 11, 0.25)` |
| Subtle (6%) | `rgba(245, 158, 11, 0.06)` |
| Border (25%) | `rgba(245, 158, 11, 0.25)` |
| Icon Active | `#fbbf24` |
| Section Label | `rgba(245, 158, 11, 0.65)` |
| Active Dot | `#fbbf24` with `shadow: 0 0 8px rgba(245,158,11,0.6)` |
| Ambient Orb | `radial-gradient(circle, rgba(245,158,11,0.4), transparent 70%)` |

**Where it appears:** Bookings management, reservation calendar, guest data, sidebar "Data" items.

---

### Section 4: NEON GARDEN (Content/CMS)
**Accent: Neon Emerald** — Growth, creation, content. The color of what your users see.

| Property | Value |
|----------|-------|
| Hue Family | Emerald (155°) |
| Inspiration | Vercel green, Notion dark, Supabase accent |
| Primary | `#10b981` |
| Hover | `#34d399` |
| Muted (12%) | `rgba(16, 185, 129, 0.12)` |
| Glow (25%) | `rgba(16, 185, 129, 0.25)` |
| Subtle (6%) | `rgba(16, 185, 129, 0.06)` |
| Border (25%) | `rgba(16, 185, 129, 0.25)` |
| Icon Active | `#34d399` |
| Section Label | `rgba(16, 185, 129, 0.65)` |
| Active Dot | `#34d399` with `shadow: 0 0 8px rgba(16,185,129,0.6)` |
| Ambient Orb | `radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%)` |

**Where it appears:** CMS content editor, image management, visual assets, sidebar "Content" section.

---

### Section 5: SAPPHIRE NETWORK (Users/Management)
**Accent: Sapphire Blue** — Authority, identity, networks. The color of people and access.

| Property | Value |
|----------|-------|
| Hue Family | Blue (220°) |
| Inspiration | GitHub dark, Figma, Stripe blue |
| Primary | `#3b82f6` |
| Hover | `#60a5fa` |
| Muted (12%) | `rgba(59, 130, 246, 0.12)` |
| Glow (25%) | `rgba(59, 130, 246, 0.25)` |
| Subtle (6%) | `rgba(59, 130, 246, 0.06)` |
| Border (25%) | `rgba(59, 130, 246, 0.25)` |
| Icon Active | `#60a5fa` |
| Section Label | `rgba(59, 130, 246, 0.65)` |
| Active Dot | `#60a5fa` with `shadow: 0 0 8px rgba(59,130,246,0.6)` |
| Ambient Orb | `radial-gradient(circle, rgba(59,130,246,0.4), transparent 70%)` |

**Where it appears:** User management, roles/permissions, invite flows, PLAC page access, sidebar "Management" section.

---

### Section 6: CORAL PULSE (Settings/Configuration)
**Accent: Coral Rose** — Refined, personal, configuration. The color of system tuning.

| Property | Value |
|----------|-------|
| Hue Family | Rose (345°) |
| Inspiration | Figma dark, Linear red, Notion pink |
| Primary | `#f43f5e` |
| Hover | `#fb7185` |
| Muted (12%) | `rgba(244, 63, 94, 0.12)` |
| Glow (25%) | `rgba(244, 63, 94, 0.25)` |
| Subtle (6%) | `rgba(244, 63, 94, 0.06)` |
| Border (25%) | `rgba(244, 63, 94, 0.25)` |
| Icon Active | `#fb7185` |
| Section Label | `rgba(244, 63, 94, 0.65)` |
| Active Dot | `#fb7185` with `shadow: 0 0 8px rgba(244,63,94,0.6)` |
| Ambient Orb | `radial-gradient(circle, rgba(244,63,94,0.4), transparent 70%)` |

**Where it appears:** Site settings, configuration, system preferences, sidebar "Settings/Admin" section.

---

### Section 7: PHANTOM TERMINAL (Developer/Debug)
**Accent: Red-Orange (Dev Exclusive)** — Danger, power, raw access. DEV-only tools.

| Property | Value |
|----------|-------|
| Hue Family | Red (0°) |
| Inspiration | Terminal red, VS Code debug, error states |
| Primary | `#ef4444` |
| Hover | `#f87171` |
| Muted (12%) | `rgba(239, 68, 68, 0.12)` |
| Glow (25%) | `rgba(239, 68, 68, 0.25)` |
| Subtle (6%) | `rgba(239, 68, 68, 0.06)` |
| Border (25%) | `rgba(239, 68, 68, 0.25)` |
| Icon Active | `#f87171` |
| Section Label | `rgba(239, 68, 68, 0.65)` |
| Active Dot | `#f87171` with `shadow: 0 0 8px rgba(239,68,68,0.6)` |
| Ambient Orb | `radial-gradient(circle, rgba(239,68,68,0.3), transparent 70%)` |

**Where it appears:** Debug tools, system diagnostics, D1 viewer, dev console, sidebar "Developer" section.

---

## 🗺️ SECTION → PAGE MAPPING

| Section | Accent Name | Nav Section | Pages |
|---------|-------------|-------------|-------|
| **Dashboard** | Electric Violet | `MAIN` | `/dashboard` |
| **Security** | Arctic Cyan | `SECURITY` | `/dashboard/logs`, `/dashboard/logs/audit`, activity panels |
| **Bookings** | Solar Amber | `DATA` | `/dashboard/bookings` |
| **Content** | Neon Emerald | `CONTENT` | `/dashboard/content`, `/dashboard/content/images` |
| **Users** | Sapphire Blue | `MANAGEMENT` | `/dashboard/users` |
| **Settings** | Coral Rose | `ADMIN` | `/dashboard/settings` |
| **Developer** | Phantom Red | `DEV` | `/dashboard/debug/*` |

---

## 🧩 COLOR APPLICATION LAYERS — WHERE SECTIONS APPEAR

### Layer 1: Sidebar Navigation
- **Section labels** — colored text matching section accent at 65% opacity
- **Active nav item** — muted bg + section-colored icon + glowing dot + left accent bar
- **Hover** — subtle bg tint (6% opacity) from section color
- **Collapsed tooltip** — section-colored left border accent

### Layer 2: Page Headers
- **Gradient tint** — `linear-gradient(135deg, var(--surface-base) 0%, var(--section-subtle) 100%)` across the top 120px
- **Page title** — gradient text using section primary → hover
- **Subtitle** — standard `text-secondary` color
- **Breadcrumb** — last segment uses section primary color

### Layer 3: Page Content
- **Stat cards** — top accent line (2px) in section primary
- **Table header** — subtle section-muted background tint
- **Table row hover** — section-subtle (6%) background
- **Action buttons** — section primary for primary CTA
- **Empty states** — section-muted icon tint

### Layer 4: Ambient Background
- **Page-specific orb** — one ambient glow orb positioned top-right using section glow color at 4-8% opacity
- **The base orbs** (violet/rose/cyan) remain at 50% dashboard opacity as the foundational atmosphere
- **Section orb** adds a fourth, page-specific color accent to the background

### Layer 5: Interactive Elements
- **Focus rings** — section primary outline (2px solid)
- **Toggle switches** — section primary when active
- **Progress bars** — section primary fill
- **Badges/Tags** — section muted bg + section primary text

---

## 🎨 FULL CSS VARIABLE MAP — TAILWIND V4

```css
@theme {
  /* ── Section: Command Center (Dashboard) — Electric Violet ── */
  --color-section-violet: #8b5cf6;
  --color-section-violet-hover: #a78bfa;
  --color-section-violet-muted: rgba(139, 92, 246, 0.12);
  --color-section-violet-glow: rgba(139, 92, 246, 0.25);
  --color-section-violet-subtle: rgba(139, 92, 246, 0.06);
  --color-section-violet-border: rgba(139, 92, 246, 0.25);
  --color-section-violet-label: rgba(139, 92, 246, 0.65);

  /* ── Section: Arctic Shield (Security) — Arctic Cyan ── */
  --color-section-cyan: #06b6d4;
  --color-section-cyan-hover: #22d3ee;
  --color-section-cyan-muted: rgba(6, 182, 212, 0.12);
  --color-section-cyan-glow: rgba(6, 182, 212, 0.25);
  --color-section-cyan-subtle: rgba(6, 182, 212, 0.06);
  --color-section-cyan-border: rgba(6, 182, 212, 0.25);
  --color-section-cyan-label: rgba(6, 182, 212, 0.65);

  /* ── Section: Solar Forge (Bookings/Data) — Solar Amber ── */
  --color-section-amber: #f59e0b;
  --color-section-amber-hover: #fbbf24;
  --color-section-amber-muted: rgba(245, 158, 11, 0.12);
  --color-section-amber-glow: rgba(245, 158, 11, 0.25);
  --color-section-amber-subtle: rgba(245, 158, 11, 0.06);
  --color-section-amber-border: rgba(245, 158, 11, 0.25);
  --color-section-amber-label: rgba(245, 158, 11, 0.65);

  /* ── Section: Neon Garden (Content/CMS) — Neon Emerald ── */
  --color-section-emerald: #10b981;
  --color-section-emerald-hover: #34d399;
  --color-section-emerald-muted: rgba(16, 185, 129, 0.12);
  --color-section-emerald-glow: rgba(16, 185, 129, 0.25);
  --color-section-emerald-subtle: rgba(16, 185, 129, 0.06);
  --color-section-emerald-border: rgba(16, 185, 129, 0.25);
  --color-section-emerald-label: rgba(16, 185, 129, 0.65);

  /* ── Section: Sapphire Network (Users/Management) — Sapphire Blue ── */
  --color-section-blue: #3b82f6;
  --color-section-blue-hover: #60a5fa;
  --color-section-blue-muted: rgba(59, 130, 246, 0.12);
  --color-section-blue-glow: rgba(59, 130, 246, 0.25);
  --color-section-blue-subtle: rgba(59, 130, 246, 0.06);
  --color-section-blue-border: rgba(59, 130, 246, 0.25);
  --color-section-blue-label: rgba(59, 130, 246, 0.65);

  /* ── Section: Coral Pulse (Settings) — Coral Rose ── */
  --color-section-rose: #f43f5e;
  --color-section-rose-hover: #fb7185;
  --color-section-rose-muted: rgba(244, 63, 94, 0.12);
  --color-section-rose-glow: rgba(244, 63, 94, 0.25);
  --color-section-rose-subtle: rgba(244, 63, 94, 0.06);
  --color-section-rose-border: rgba(244, 63, 94, 0.25);
  --color-section-rose-label: rgba(244, 63, 94, 0.65);

  /* ── Section: Phantom Terminal (Dev) — Phantom Red ── */
  --color-section-red: #ef4444;
  --color-section-red-hover: #f87171;
  --color-section-red-muted: rgba(239, 68, 68, 0.12);
  --color-section-red-glow: rgba(239, 68, 68, 0.25);
  --color-section-red-subtle: rgba(239, 68, 68, 0.06);
  --color-section-red-border: rgba(239, 68, 68, 0.25);
  --color-section-red-label: rgba(239, 68, 68, 0.65);
}
```

---

## ⚡ IMPLEMENTATION PATTERN — DYNAMIC SECTION COLOR

Pages set their section color via a CSS `data-section` attribute on the main content container. This enables all child components to inherit the correct accent without prop drilling.

```html
<!-- In each .astro page -->
<main class="admin-main-content" data-section="cyan">
  <!-- All children auto-inherit cyan accents -->
</main>
```

```css
/* Dynamic section color resolution */
[data-section="violet"] { --section-color: var(--color-section-violet); --section-hover: var(--color-section-violet-hover); --section-muted: var(--color-section-violet-muted); --section-glow: var(--color-section-violet-glow); --section-subtle: var(--color-section-violet-subtle); --section-border: var(--color-section-violet-border); }

[data-section="cyan"]   { --section-color: var(--color-section-cyan);   --section-hover: var(--color-section-cyan-hover);   --section-muted: var(--color-section-cyan-muted);   --section-glow: var(--color-section-cyan-glow);   --section-subtle: var(--color-section-cyan-subtle);   --section-border: var(--color-section-cyan-border); }

/* ... same for amber, emerald, blue, rose, red ... */
```

Then components use generic `var(--section-color)` without knowing which section they're in:

```css
.page-action-btn {
  background: var(--section-muted);
  border: 1px solid var(--section-border);
  color: var(--section-color);
}

.page-action-btn:hover {
  background: var(--section-glow);
  color: var(--section-hover);
  box-shadow: 0 0 20px var(--section-glow);
}
```

---

## 🚫 COLOR COMBINATIONS TO AVOID

| Avoid | Reason |
|-------|--------|
| Neon Emerald adjacent to Solar Amber | Creates Christmas-tree vibrancy; separate by at least 1 section |
| Pure red (#ff0000) for non-error states | Triggers danger response; our Phantom Red is `#ef4444` (softer) |
| Desaturated violets + cyans together | Blend into murky gray on dark backgrounds |
| Any accent at >20% opacity for backgrounds | Overwhelms the dark canvas; cap at 12% for fills |
| Yellow-green hues (120-150°) | Appear sickly/muddy on near-black; avoid entirely |
| Multiple bright accents in one view | Max 2 section colors visible at once (primary + one reference) |

---

## 🔬 ACCESSIBILITY — WCAG COMPLIANCE

| Check | Requirement | Status |
|-------|-------------|--------|
| Text on `#060a0e` | `#f0f4f8` = 16.7:1 contrast ratio | ✅ AAA |
| Section primary on `#060a0e` | All 7 accents > 4.5:1 | ✅ AA |
| Muted bg (12%) distinction | Visually distinct from base | ✅ |
| Color-blind safety | No information conveyed by color alone; always paired with icons + text | ✅ |
| `prefers-reduced-motion` | All glow animations respect media query | ✅ |

---

## 📐 LEGACY PALETTE REFERENCE

The following palettes from V1 remain as **supplementary references** for non-section UI elements (modals, toasts, generic cards).

### "Graphite" Balanced Mode (Linear/Raycast)
| Token | Value | Use |
|-------|-------|-----|
| Atmosphere | `#111318` | Alternative bg for nested modals |
| Primary Surface | `#1C1F26` | Card surfaces within modals |
| Raised Surface | `#222630` | Elevated card within card |
| Primary Accent | `#5E6AD2` | Desaturated indigo (non-section use) |

### "Twilight" Purple Hybrid (Supabase)
| Token | Value | Use |
|-------|-------|-----|
| Atmosphere | `#121016` | Login page alternative |
| Primary Surface | `#1A1625` | Auth card surfaces |
| Border | `rgba(196, 181, 253, 0.08)` | Subtle violet borders |

### Best Practices (Unchanged)
1. **Glassmorphism**: `backdrop-blur-md` + bg at 60-80% opacity
2. **Inner Rings**: `ring-1 ring-white/[0.05]` for physical light simulation
3. **Dark Shadows**: Pure black `shadow-[0_8px_30px_rgba(0,0,0,0.4)]` or colored `shadow-[0_0_40px_var(--section-glow)]`

---

*End of Premium Color Palettes v2.0 — "Obsidian Spectrum"*

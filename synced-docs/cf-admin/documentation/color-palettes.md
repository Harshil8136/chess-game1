{% raw %}
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
4. **Dark Canvas Harmony** — All colors are carefully selected to bloom beautifully against deep dark backgrounds without creating muddy or washed-out appearances.

---

## 🏗️ THE 6-TIER OPACITY SYSTEM

Every section accent color generates exactly 6 derivative values:

| Tier | Usage |
|------|-------|
| **Primary** | Buttons, active indicators, badges, icon fills |
| **Hover** | Button hover, link hover, interactive states |
| **Muted** (12%) | Card backgrounds, nav item active bg, subtle fills |
| **Glow** (20-25%) | Box shadows, ambient orbs, focus rings |
| **Subtle** (6%) | Table row hover, page background tint, breadcrumb hints |
| **Border** (20-30%) | Active borders, dividers, card outlines |

---

## 🎯 THE SEVEN SECTION ACCENTS

### Section 1: COMMAND CENTER (Dashboard/Overview)
**Accent: Electric Violet** — The signature brand color. Command and authority.
- Hue Family: Violet (270°)
- Inspiration: Linear App, Stripe dark, Supabase
- Appears in: Dashboard page, overview stats, welcome greeting gradient, sidebar "Main" section.

### Section 2: ARCTIC SHIELD (Security/Audit)
**Accent: Arctic Cyan** — Cool, vigilant, trustworthy. The color of digital surveillance.
- Hue Family: Cyan (195°)
- Inspiration: Vercel teal, GitHub dark, Cloudflare
- Appears in: Audit logs, session activity, security dashboard, user activity panels, sidebar "Security" items.

### Section 3: SOLAR FORGE (Bookings/Data)
**Accent: Solar Amber** — Warm, productive, data-driven. The color of business operations.
- Hue Family: Amber (40°)
- Inspiration: Arc Browser, Notion amber, Linear orange
- Appears in: Bookings management, reservation calendar, guest data, sidebar "Data" items.

### Section 4: NEON GARDEN (Content/CMS)
**Accent: Neon Emerald** — Growth, creation, content. The color of what your users see.
- Hue Family: Emerald (155°)
- Inspiration: Vercel green, Notion dark, Supabase accent
- Appears in: CMS content editor, image management, visual assets, sidebar "Content" section.

### Section 5: SAPPHIRE NETWORK (Users/Management)
**Accent: Sapphire Blue** — Authority, identity, networks. The color of people and access.
- Hue Family: Blue (220°)
- Inspiration: GitHub dark, Figma, Stripe blue
- Appears in: User management, roles/permissions, invite flows, PLAC page access, sidebar "Management" section.

### Section 6: CORAL PULSE (Settings/Configuration)
**Accent: Coral Rose** — Refined, personal, configuration. The color of system tuning.
- Hue Family: Rose (345°)
- Inspiration: Figma dark, Linear red, Notion pink
- Appears in: Site settings, configuration, system preferences, sidebar "Settings/Admin" section.

### Section 7: PHANTOM TERMINAL (Developer/Debug)
**Accent: Red-Orange (Dev Exclusive)** — Danger, power, raw access. DEV-only tools.
- Hue Family: Red (0°)
- Inspiration: Terminal red, VS Code debug, error states
- Appears in: Debug tools, system diagnostics, dev console, sidebar "Developer" section.

---

## 🗺️ SECTION → PAGE MAPPING

| Section | Accent Name | Nav Section |
|---------|-------------|-------------|
| **Dashboard** | Electric Violet | MAIN |
| **Security** | Arctic Cyan | SECURITY |
| **Bookings** | Solar Amber | DATA |
| **Content** | Neon Emerald | CONTENT |
| **Users** | Sapphire Blue | MANAGEMENT |
| **Settings** | Coral Rose | ADMIN |
| **Developer** | Phantom Red | DEV |

---

## 🧩 COLOR APPLICATION LAYERS — WHERE SECTIONS APPEAR

### Layer 1: Sidebar Navigation
- **Section labels** — colored text matching section accent at reduced opacity
- **Active nav item** — muted background + section-colored icon + glowing dot + left accent bar
- **Hover** — subtle background tint from section color
- **Collapsed tooltip** — section-colored left border accent

### Layer 2: Page Headers
- **Gradient tint** — color-tinted gradient across the top header area
- **Page title** — gradient text using section primary to hover colors
- **Subtitle** — standard secondary color
- **Breadcrumb** — last segment uses section primary color

### Layer 3: Page Content
- **Stat cards** — top accent line in section primary
- **Table header** — subtle section-muted background tint
- **Table row hover** — subtle section background
- **Action buttons** — section primary for primary CTA
- **Empty states** — section-muted icon tint

### Layer 4: Ambient Background
- **Page-specific orb** — one ambient glow orb positioned top-right using section glow color at low opacity
- **Base orbs** remain at reduced dashboard opacity as the foundational atmosphere
- **Section orb** adds a fourth, page-specific color accent to the background

### Layer 5: Interactive Elements
- **Focus rings** — section primary outline
- **Toggle switches** — section primary when active
- **Progress bars** — section primary fill
- **Badges/Tags** — section muted background + section primary text

---

## ⚡ IMPLEMENTATION PATTERN — DYNAMIC SECTION COLOR

Pages set their section color via a CSS `data-section` attribute on the main content container. This enables all child components to inherit the correct accent without prop drilling. Components then reference generic section color variables without knowing which section they're in, enabling full decoupling of color from component logic.

---

## 🚫 COLOR COMBINATIONS TO AVOID

| Avoid | Reason |
|-------|--------|
| Neon Emerald adjacent to Solar Amber | Creates Christmas-tree vibrancy; separate by at least 1 section |
| Pure red for non-error states | Triggers danger response; use softer red tones instead |
| Desaturated violets + cyans together | Blend into murky gray on dark backgrounds |
| Any accent at >20% opacity for backgrounds | Overwhelms the dark canvas; cap at 12% for fills |
| Yellow-green hues (120-150°) | Appear sickly/muddy on near-black; avoid entirely |
| Multiple bright accents in one view | Max 2 section colors visible at once (primary + one reference) |

---

## 🔬 ACCESSIBILITY — WCAG COMPLIANCE

| Check | Requirement | Status |
|-------|-------------|--------|
| Primary text on dark background | >16:1 contrast ratio | ✅ AAA |
| All section accents on dark background | >4.5:1 contrast ratio | ✅ AA |
| Muted background distinction | Visually distinct from base | ✅ |
| Color-blind safety | No information conveyed by color alone; always paired with icons + text | ✅ |
| `prefers-reduced-motion` | All glow animations respect media query | ✅ |

---

## 📐 LEGACY PALETTE REFERENCE

The following palettes from V1 remain as **supplementary references** for non-section UI elements (modals, toasts, generic cards).

### "Graphite" Balanced Mode
- Alternative atmosphere for nested modals
- Card surfaces, elevated surfaces, desaturated indigo accents

### "Twilight" Purple Hybrid
- Login page alternatives
- Auth card surfaces, subtle violet borders

### Best Practices (Unchanged)
1. **Glassmorphism**: Use backdrop blur with background at 60-80% opacity
2. **Inner Rings**: Subtle white ring at very low opacity for physical light simulation
3. **Dark Shadows**: Pure black or colored shadow variants using section glow colors

---

*End of Premium Color Palettes v2.0 — "Obsidian Spectrum"*

{% endraw %}

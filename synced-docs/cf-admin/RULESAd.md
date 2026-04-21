{% raw %}
REMIND TO DO ALL THINS;
Part A — You must do this manually (Google Cloud Console)
The Google OAuth verification issue is a dashboard configuration problem, not code. Check these in order:

Fastest fix: Go to Google Cloud Console → OAuth consent screen → switch User Type to "Internal" (admin-only tool = no verification ever needed, no 100-user cap)

If not on Google Workspace: Add your emails as test users (Audience → Add Users: harshil.8136@gmail.com, harshil.cloud8@gmail.com) while verification completes

Critical — verify these redirect URIs in Google Cloud Console → Credentials → your OAuth client:

Authorized redirect URIs: https://zlvmrepvypucvbyfbpjj.supabase.co/auth/v1/callback
Authorized JavaScript origins: https://secure.madagascarhotelags.com
Supabase Dashboard → Auth → URL Configuration: confirm https://secure.madagascarhotelags.com/auth/callback is in the redirect allowlist

You must do: fill in the Client ID
In wrangler.toml, replace the empty string with your actual Google OAuth Client ID:


PUBLIC_GOOGLE_CLIENT_ID = "123456789-abc...xyz.apps.googleusercontent.com"
Also add it to .dev.vars for local dev:


PUBLIC_GOOGLE_CLIENT_ID=123456789-abc...xyz.apps.googleusercontent.com
The Client ID is found in Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web client.



# CF-ADMIN PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Last Updated:** 2026-04-21 (v3.7: Search Engine Isolation + Security Hardening)
> **Research Sources:** Cloudflare Docs MCP, Supabase MCP, Cloudflare Bindings MCP, Tavily, Official Documentation

---

## 🚨 RULE #0 — THE ABSOLUTE LAW (NEVER VIOLATE)

**cf-admin is the Cloudflare-native version of admin-app. We can deeply review, understand how everything looks, works, and is designed in admin-app — however, WE NEVER, like NEVER, copy any single file or code from there.**

This is the **STRICTEST** rule and MUST be followed at ALL times:

- ✅ **ALLOWED:** Reference admin-app to understand features, flows, UX patterns, business logic concepts
- ✅ **ALLOWED:** Use MCP tools (Cloudflare Docs, Supabase, Tavily) and SKILLs to find the best Cloudflare-native approach
- ✅ **ALLOWED:** Build equivalent functionality from scratch using Cloudflare-optimized patterns
- ❌ **FORBIDDEN:** Copy-pasting any file, component, function, hook, schema, or code block from admin-app
- ❌ **FORBIDDEN:** Duplicating CSS, design tokens, or configuration verbatim from admin-app
- ❌ **FORBIDDEN:** Using admin-app files as templates with "find and replace" modifications

**Every line of code in cf-admin must be written fresh, optimized for the Cloudflare + Astro + Preact stack.**

---

## 🚨 RULE #0.5 — NO FAKE DATA OR PLACEHOLDERS

**ALL data and presented information MUST be real and accurate, sourced from active databases (Supabase/D1) or actual API telemetry (Cloudflare Analytics/Resend/etc).**

- ❌ **FORBIDDEN:** Randomly generated chart data (e.g. `Math.random()`), hardcoded dashboard metrics (`sessionCount = 24`), or mock user activity logs.
- ❌ **FORBIDDEN:** "Under Construction" placeholder pages masking incomplete features.
- If a feature requires data that cannot be currently provided by the backend, the feature MUST NOT be built with mock data. Instead, either:
  1. Omit the feature entirely from the UI, OR
  2. Implement the full backend pipeline to fetch the real data.
- If real data cannot be provided even when explicitly requested by the USER, the AI agent MUST provide a documented explanation and refuse to implement the mock data solution.

---

## 🏢 PROJECT MISSION — SECURE ADMIN PORTAL, $0 INFRASTRUCTURE

**cf-admin is a production-ready, commercial-grade administrative portal built entirely on FREE tier services.** This is a standard admin product — architected so any project with a main site can plug in a professional admin portal. Designed to:

- ✅ Manage content, bookings, users, and site settings via secure dashboard
- ✅ Enforce multi-level RBAC (DEV > Owner > SuperAdmin > Admin > Staff) on every route
- ✅ Authenticate via Supabase GoTrue (Magic Link + Google/GitHub/Facebook OAuth)
- ✅ Block ALL unauthorized access — signup disabled, whitelist-only entry
- ✅ Refresh JWT tokens every 30 minutes, hard-expire sessions at 24 hours
- ✅ Run 24/7 at **$0/month** total infrastructure cost
- ✅ Deliver premium, animated, dark-themed admin experience
- ✅ Meet professional security, accessibility, and performance standards

**Every architectural decision optimizes for: maximum security + maximum quality + exactly ZERO ongoing cost.**

---

## 1. PROJECT IDENTITY

| Property | Value |
|----------|-------|
| **Name** | cf-admin (Madagascar Pet Hotel — Admin Portal) |
| **Purpose** | Cloudflare-native admin portal equivalent to admin-app |
| **Framework** | Astro 6.0+ with `@astrojs/cloudflare` adapter |
| **Rendering** | Full SSR (`output: 'server'`) — every route requires auth |
| **UI Islands** | Preact (3KB, React-compatible) for interactive components |
| **Hosting** | Cloudflare Workers |
| **Auth** | Supabase GoTrue (Magic Link + OAuth providers) |
| **Database** | Supabase PostgreSQL (shared project `zlvmrepvypucvbyfbpjj`) |
| **Session Store** | Cloudflare KV (via Astro Sessions API) |
| **Cache** | Upstash Redis (free tier — 10K commands/day) |
| **Storage** | Cloudflare R2 (CMS image uploads — `madagascar-images` bucket → `cdn.madagascarhotelags.com`) |
| **CSS** | Tailwind CSS v4 via `@tailwindcss/vite` |
| **Design System** | "Midnight Slate" — dark-first with Arctic Cyan primary accents |
| **Domain** | `secure.madagascarhotelags.com` (provisioned at v1.0) |
| **GitHub** | `mascotasmadagascar-cmd/cf-admin-madagascar` (private) |
| **Worker Name** | `cf-admin-madagascar` (Mascotas Cloudflare account) |

---

## 2. STRICT CONTENT SECURITY POLICY (CSP)

**NO INLINE STYLES ALLOWED:** The dashboard enforces a strict CSP which bans \unsafe-inline\. All dynamic state representing UI presentation MUST use Data-Attribute Driven CSS architecture (e.g. \data-expanded\, \data-active\) instead of inline \style={{...}}\ properties.

## 2. RELATIONSHIP TO OTHER PROJECTS

| Project | Role | Relationship |
|---------|------|-------------|
| **cf-astro** | Main customer-facing website | Shares Supabase project, D1 database, R2 bucket. Uses Hyperdrive for direct PG (booking, ARCO) |
| **cf-chatbot** | Cloudflare Workers AI Bot | Operates autonomously on Edge natively interacting with WhatsApp/Web. `cf-admin` serves as its secure configuration proxy and analytics Dashboard. |
| **admin-app** | Legacy admin portal (Next.js) | Reference for UX/features only — **NEVER copy code** |
| **nextjs-app** | Legacy main site (Next.js) | Reference only — no code sharing |

### Shared Resources
- **Supabase Project:** `zlvmrepvypucvbyfbpjj` (same PostgreSQL instance)
- **D1 Database:** `madagascar-db` (ID: `bbca7ba8-87b0-4998-a17d-248bb8d9a0a2`) — shared between both projects
- **R2 Bucket:** `madagascar-images` → `cdn.madagascarhotelags.com` (CMS images, shared read/write)
- **Cloudflare Account:** Mascotas Madagascar

### KV Namespaces (Isolated per project)
| Namespace | ID | Project | Purpose |
|-----------|-----|---------|---------|
| `cf-admin-session` | `c81d1970f3d548b8a53a0e6c870b7685` | cf-admin | Astro session store |
| `cf-astro-session` | `9da1ac5253a54ea1bf236c6fe514dd02` | cf-astro | Astro session store |
| `cf-astro-isr-cache` | `e31f413bb1224f559a8de105248da6cc` | cf-astro | ISR HTML cache |

> ⚠️ **OPERATIONAL CRITICAL:** These IDs were verified against the Cloudflare API on 2026-04-20. A prior mismatch caused a full CMS pipeline outage. See [`documentation/cloudflare-bindings-registry.md`](./documentation/cloudflare-bindings-registry.md) for the canonical registry and verification commands.

### Isolation Rules
- Admin tables use `admin_` prefix to avoid collision with cf-astro tables
- cf-admin has its own KV namespace for sessions (`cf-admin-session`, separate from cf-astro)
- cf-admin has its own Worker deployment (not shared with cf-astro)
- Each project has its own `wrangler.toml`, `.dev.vars`, and deployment pipeline

---

## 3. RBAC — ROLE-BASED ACCESS CONTROL

> 📖 **Full technical details:** [`documentation/user-management-rbac.md`](./documentation/user-management-rbac.md)

## 4. INFRASTRUCTURE FREE TIER LIMITS

> 📖 **Full technical details:** [documentation/infrastructure-limits.md](./documentation/infrastructure-limits.md)
---

## 7. TECHNOLOGY STACK

> 🚨 **THE WHITELIST ARCHITECTURE POLICY:** We employ a strict "whitelisting" approach to technology additions. Anything not explicitly listed in this document is considered **BLACKLISTED** by default to protect our <50KB "Lean Edge" budget. If an AI agent or developer wishes to introduce a new library (e.g., React 19, Recharts, shadcn/ui, Hono), it must be explicitly proposed with a strong "why it's needed" justification. The new dependency can ONLY be used if the USER explicitly approves the proposal.

### 7.1 Framework: Astro 6.0+ (Full SSR for Admin)

- `output: 'server'` — ALL routes are server-rendered (auth check required)
- Cloudflare adapter with native binding access
- Astro Sessions API backed by Cloudflare KV for session persistence
- No static pages — admin portal has zero public content

### 7.2 UI: Preact Islands
> 📖 **Full RLS policy matrix:** [documentation/database-rls-policy.md](./documentation/database-rls-policy.md)

### 7.6 Environment Variables

```
# .dev.vars (local — gitignored)
PUBLIC_SUPABASE_URL=https://zlvmrepvypucvbyfbpjj.supabase.co
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
TURNSTILE_SECRET_KEY=...
SITE_URL=https://secure.madagascarhotelags.com
```

Secrets in production: `wrangler secret put <KEY>`

### 7.7 The "Module Manifest" Pattern

To prevent architectural entropy as `cf-admin` grows, every new feature area must be encapsulated using the **Module Manifest** pattern. Code should be organized into self-contained vertical slices.

**Directory Structure:**
```text
src/
  ├── pages/
  │    └── [module_name]/
  │         ├── index.astro       # Main entry point (SSR)
  │         ├── [sub_route].astro # Nested routes
  │         └── _components/      # Module-specific islands (Preact)
  └── styles/
       └── [module_name]/
            └── [component].css   # Module-isolated CSS
```

**Implementation Rules:**
1. **Entry Point (`index.astro`):** Must wrap content in `<AdminLayout title="ModuleName">` and call `requireAuth(Astro)`.
2. **Dynamic Sidebar Auto-Registry:** A module is ONLY visible in the sidebar if its path exists in the D1 `admin_pages` table and the user's role has PLAC authorization. You do NOT hardcode nav links in the UI.
3. **CSS Code Splitting:** Do not dump styles directly into `global.css`. Create a module-specific CSS file and import it directly into the `.astro` page (`import '../../styles/module.css';`).
4. **Data Fetching:** Fetch server-side within the `.astro` frontmatter. Pass static initial state to Preact islands as props.

---

## 8. CODE QUALITY RULES

> 📖 **Full code quality & architecture standards:** [`documentation/coding-standards.md`](./documentation/coding-standards.md)

---

## 9. SECURITY RULES

> 🔒 **Full security architecture & protocols:** [`documentation/security-protocols.md`](./documentation/security-protocols.md)
> 🛡️ **Supabase RLS policy matrix:** [`documentation/database-rls-policy.md`](./documentation/database-rls-policy.md)

## 10. DESIGN SYSTEM — "MIDNIGHT SLATE"

The dashboard utilizes a unified premium dark UI with Arctic Cyan accents, transitioning away from the legacy multi-color section identities.

> 📖 **Full design system specifications:** [`documentation/theme-system-design.md`](./documentation/theme-system-design.md)
> 🎨 **Legacy color palettes:** [`documentation/color-palettes.md`](./documentation/color-palettes.md)

---

### 10.1 Login Portal — "Midnight Slate"

The login page uses a **single-column, centered card** layout inspired by Clerk/Vercel auth flows. No split-screen, no sidebar — just a pristine glassmorphic card on a warm dark canvas.

#### Background & Ambient System

| Element | Spec |
|---------|------|
| **Base** | `#09090b` (zinc-950) — set via inline `style` on `<body>`, not Tailwind class |
| **Orb 1 (Cyan)** | `radial-gradient` of `rgba(34,211,238,0.4)` —> `rgba(8,145,178,0.15)` |
| **Orb 2 (Slate)** | `radial-gradient` of `rgba(51,65,85,0.5)` —> `rgba(30,41,59,0.15)` |
| **Orb 3 (Deep Blue)** | `radial-gradient` of `rgba(59,130,246,0.3)` —> `rgba(29,78,216,0.1)` |
| **Noise Texture** | SVG `feTurbulence` overlay at `opacity-[0.015]` for grain |

All orbs are `position: absolute` inside a `fixed inset-0 pointer-events-none z-0` container, animated via CSS.

#### Glassmorphic Card Setup

```css
background:  rgba(255,255,255,0.035)
border:      1px solid rgba(255,255,255,0.08)
backdrop:    blur(40px)
box-shadow:  0 0 0 1px rgba(34,211,238,0.06),
             0 20px 50px rgba(0,0,0,0.5),
             0 0 80px rgba(34,211,238,0.06)
```

### 10.2 Dashboard & Navigation Architecture

The dashboard implements a modular **Hover-Expand Sidebar**.

#### Sidebar Mechanics (Hover & Pin)
- **Default State:** Collapsed (72px wide), showing only icons. Nav labels are hidden.
- **Hover State:** Sidebar immediately expands to full width (~280px).
- **Pin State:** Users can click a "Lock/Unlock" icon at the bottom of the sidebar to persist the expanded layout. This state is saved to `localStorage`.
- **Layout Sync:** The `AdminLayout.astro` utilizes a synchronous inline script to read `localStorage` and inject the `sidebar-expanded` class into the `<body>` before hydration. The `.admin-content-area` margin shifts cleanly via a 300ms CSS transition matching the sidebar's width.

#### Sidebar Visuals
- **Background:** Glassmorphic with `@supports` fallback (solid `surface-raised`).
- **Logo icon:** Cyan gradient shield with blur glow + `rgba(34,211,238,0.08)` bg.
- **Active Navigation:** Cyan muted bg (12%) + cyan icon + cyan glowing dot + 2px accent bar.
- **Collapsed tooltips:** Rendered conditionally using Preact `createPortal` to the `document.body` for overflow escaping.

#### TopBar & Modals
- **Command Palette:** `Ctrl+K` triggers a robust search palette via Preact signals. Focus states utilize Midnight Slate cyan glow boundaries.
- **TopBar:** Follows general glass logic (`blur(24px)`).
> 📖 **Full technical architecture:** [`documentation/cms-isr-architecture.md`](./documentation/cms-isr-architecture.md)

#### Unbuilt Modules & Soft 404
- Unbuilt portal paths (e.g. `/dashboard/customers` or `/dashboard/analytics`) are intercepted by a Catch-All spread route at `src/pages/dashboard/[...slug].astro`.
- Because Astro resolves exact physical paths first, this route organically serves as a fallback.
## 10. DESIGN SYSTEM — "MIDNIGHT SLATE"

The dashboard utilizes a unified premium dark UI with Arctic Cyan accents, transitioning away from the legacy multi-color section identities.

> 📖 **Full design system specifications:** [`documentation/theme-system-design.md`](./documentation/theme-system-design.md)
> 🎨 **Legacy color palettes:** [`documentation/color-palettes.md`](./documentation/color-palettes.md)

---

### 10.1 Login Portal — "Midnight Slate"

The login page uses a **single-column, centered card** layout inspired by Clerk/Vercel auth flows. No split-screen, no sidebar — just a pristine glassmorphic card on a warm dark canvas.

#### Background & Ambient System

| Element | Spec |
|---------|------|
| **Base** | `#09090b` (zinc-950) — set via inline `style` on `<body>`, not Tailwind class |
| **Orb 1 (Cyan)** | `radial-gradient` of `rgba(34,211,238,0.4)` —> `rgba(8,145,178,0.15)` |
| **Orb 2 (Slate)** | `radial-gradient` of `rgba(51,65,85,0.5)` —> `rgba(30,41,59,0.15)` |
| **Orb 3 (Deep Blue)** | `radial-gradient` of `rgba(59,130,246,0.3)` —> `rgba(29,78,216,0.1)` |
| **Noise Texture** | SVG `feTurbulence` overlay at `opacity-[0.015]` for grain |

All orbs are `position: absolute` inside a `fixed inset-0 pointer-events-none z-0` container, animated via CSS.

#### Glassmorphic Card Setup

```css
background:  rgba(255,255,255,0.035)
border:      1px solid rgba(255,255,255,0.08)
backdrop:    blur(40px)
box-shadow:  0 0 0 1px rgba(34,211,238,0.06),
             0 20px 50px rgba(0,0,0,0.5),
             0 0 80px rgba(34,211,238,0.06)
```

### 10.2 Dashboard & Navigation Architecture

The dashboard implements a modular **Hover-Expand Sidebar**.

#### Sidebar Mechanics (Hover & Pin)
- **Default State:** Collapsed (72px wide), showing only icons. Nav labels are hidden.
- **Hover State:** Sidebar immediately expands to full width (~280px).
- **Pin State:** Users can click a "Lock/Unlock" icon at the bottom of the sidebar to persist the expanded layout. This state is saved to `localStorage`.
- **Layout Sync:** The `AdminLayout.astro` utilizes a synchronous inline script to read `localStorage` and inject the `sidebar-expanded` class into the `<body>` before hydration. The `.admin-content-area` margin shifts cleanly via a 300ms CSS transition matching the sidebar's width.

#### Sidebar Visuals
- **Background:** Glassmorphic with `@supports` fallback (solid `surface-raised`).
- **Logo icon:** Cyan gradient shield with blur glow + `rgba(34,211,238,0.08)` bg.
- **Active Navigation:** Cyan muted bg (12%) + cyan icon + cyan glowing dot + 2px accent bar.
- **Collapsed tooltips:** Rendered conditionally using Preact `createPortal` to the `document.body` for overflow escaping.

#### TopBar & Modals
- **Command Palette:** `Ctrl+K` triggers a robust search palette via Preact signals. Focus states utilize Midnight Slate cyan glow boundaries.
- **TopBar:** Follows general glass logic (`blur(24px)`).
> 📖 **Full technical architecture:** [`documentation/cms-isr-architecture.md`](./documentation/cms-isr-architecture.md)

#### Unbuilt Modules & Soft 404
- Unbuilt portal paths (e.g. `/dashboard/customers` or `/dashboard/analytics`) are intercepted by a Catch-All spread route at `src/pages/dashboard/[...slug].astro`.
- Because Astro resolves exact physical paths first, this route organically serves as a fallback.
- It leverages the `AdminLayout` cleanly so that sidebar state is preserved, injecting a Midnight Slate "Module Under Construction" card in the main view rather than breaking the Single-Page Application sequence.

#### Dashboard Widgets
| Widget | Key Treatment |
|--------|---------------|
| **StatCard** | Glass bg, `cyan-400` top accent line (2px), `translateY(-3px)` lift on hover |
| **SystemHealthBar** | Minimalist background, strict tabular data display |

### 10.3 Loading States & Data Hydration

The dashboard enforces a strict "No Blank Loading Screens" policy to maintain a professional, high-performance aesthetic.

- **Skeleton Loading is Mandatory:** ALL client-side data fetching components (Preact islands with `client:load` or `client:idle`) MUST display a Skeleton Screen during their initial `loading` state.
- **No Text-Only Loading:** Using plain text like `"Loading records..."`, `"Syncing..."`, or simple spinners alone is FORBIDDEN for primary data fetches.
- **Generic Implementation:** Use the `SkeletonBlock` component from `src/components/dashboard/widgets/WidgetSharedV2.tsx` to construct shimmering placeholders that mirror the expected layout of the loaded content.
- **Immediate Feedback:** Skeleton screens must render immediately upon mount before the API request completes.

---

## 11. DYNAMIC CMS & ISG/ISR ARCHITECTURE (cf-admin <> cf-astro)

cf-admin securely mutates data for the public-facing cf-astro site via a precise $0 ISR Edge-Cache mechanism.

> 📖 **Full technical architecture:** [documentation/cms-isr-architecture.md](./documentation/cms-isr-architecture.md)
|-----------|-------------|-------------------|
| `POST /api/content/blocks` | Update text blocks | `revalidateAstro(env, [basePath])` |
| `POST /api/content/reviews` | Update happy clients JSON | `revalidateAstro(env, ['/'])` |
| `POST /api/content/services` | Update pricing data | `revalidateAstro(env, ['/'])` |
| `POST /api/media/gallery` | Update gallery JSON array | `revalidateAstro(env, ['/'])` |
| `POST /api/media/upload` | Upload image to R2 + D1 | `revalidateAstro(env, ['/'])` |

---

## 12. DEPLOYMENT RULES

### Build & Deploy
```bash
# Development
astro dev                    # Local dev with .dev.vars

# Type Check
astro check                  # TypeScript validation

# Build
astro build                  # Production build to ./dist

# Deploy
astro build && wrangler deploy  # Build + deploy to Cloudflare
```

### Git Workflow
> 🚨 **CRITICAL: See `../../GITHUB_RULES.md` for all Git deployment commands.**
> You must ALWAYS verify your directory with `git remote -v` and push directly to `origin main`. Do not create branches.

### Environment
- `wrangler.toml` — Cloudflare bindings (D1, KV, R2, Queues)
- `.dev.vars` — Local secrets (gitignored)
- `wrangler secret put <KEY>` — Production secrets

---

## 13. DOCUMENTATION ARCHITECTURE

| File/Folder | Purpose |
|-------------|---------|
| `RULESAd.md` | This file — operational bible |
| `ToDoAdmin.md` | Living progress tracker (what's done, what's next) |
| `README.md` | Quick start guide for developers |
| `documentation/` | Detailed technical documentation |
| `.agents/context/` | AI agent reference files |

### Documentation Folder Structure
```
documentation/
├── user-management-rbac.md          # RBAC hierarchy, user lifecycle, ghost protection, hidden accounts
├── plac-and-audit.md             # PLAC access control + Ghost Audit Engine + SHA-256 hash chain
├── security-hardening.md         # CSRF, cookie security, error sanitization, request tracing
├── data-privacy.md               # Privacy dashboard, consent records, GDPR/LFPDPPP compliance
├── cms-bookings-management.md  # CMS content studio + bookings architecture
├── observability-sentry.md    # Sentry integration for error tracking + edge observability
├── theme-system-design.md  # Midnight Slate theme design system decisions
└── color-palettes.md     # Color palette reference for the design system
├── cloudflare-bindings-registry.md # Immutable registry of all Cloudflare D1/KV binding IDs
├── database-rls-policy.md         # Supabase RLS policy matrix, service_role patterns, index coverage
```

---

## 14. MCP & SKILL USAGE GUIDE

### 14.1 Active MCP Tools

| MCP Name | Cost | When to Use |
|----------|------|-------------|
| `@mcp:tavily` | **FREE** | Web searches, deep research, data extraction |
| `@mcp:cloudflare-docs` | **FREE** | API signatures, platform limits |
| `@mcp:cloudflare-bindings` | **FREE** | Runtime binding patterns |
| `@mcp:supabase-mcp-server` | **FREE** | Database schema, RLS, Auth setup |
| `@mcp:upstash` | **FREE** | Redis management, rate limiting |
| `@mcp:sentry` | **FREE** | Error tracking setup |
| `@mcp:posthog` | **FREE** | Analytics queries |
| `@mcp:resend` | **FREE** | Email management |

### 14.2 Skills

| Skill | When to Use |
|-------|-------------|
| `astro/SKILL.md` | Astro CLI, project structure, adapters |
| `cloudflare/SKILL.md` | Cloudflare product selection, limits |
| `tailwind-design-system/SKILL.md` | Tailwind v4 @theme, component patterns |
| `systematic-debugging/SKILL.md` | First response to ANY bugs |
| `brainstorming/SKILL.md` | Design process (brainstorm → plan → build) |

### 14.3 Perplexity MCP — PAID SERVICE

`@mcp:perplexity-ask` costs real money. Use ONLY as last resort after exhausting all free tools.

**Priority Order:**
1. RULES.md → 2. SKILL.md files → 3. `@mcp:cloudflare-docs` → 4. `@mcp:tavily` → 5. Pre-trained knowledge → 6. `@mcp:perplexity-ask` (💰 LAST)

---

## 15. TOTAL MONTHLY COST — $0

| Service | What We Use | Monthly Cost |
|---------|------------|-------------|
| Cloudflare Workers | Hosting + SSR | **$0** |
| Cloudflare KV | Session storage & ISR Cache | **$0** |
| Cloudflare D1 | Operational data & CMS content | **$0** |
| Cloudflare R2 | CMS image storage (10GB free) | **$0** |
| Cloudflare Queues | Async email delivery | **$0** |
| Supabase | Auth + PostgreSQL (shared) | **$0** |
| Upstash | Redis (rate limiting) | **$0** |
| GitHub | Source control | **$0** |
| | **TOTAL** | **$0.00** |

### Only Paid Service

| Service | Cost | Note |
|---------|------|------|
| Domain name | ~$10-15/year | One-time, shared with cf-astro |
| Perplexity MCP | Per-query | Minimize usage |

---

## 16. CMS IMAGE MANAGEMENT — cf-admin <-> cf-astro BRIDGE

The CMS Image Management system enables authorized admin users to upload and manage an UNLIMITED array of images for the gallery and update the Hero background on cf-astro from the cf-admin dashboard. All infrastructure remains .

### Architecture Summary

| Component | Role |
|-----------|------|
| **R2 Bucket** (`madagascar-images`) | Stores uploaded image binaries |
| **CDN Domain** (`cdn.madagascarhotelags.com`) | Public edge-cached delivery of R2 images |
| **Cloudflare Transformations** | /cdn-cgi/image/ handles responsive sizing, WebP/AVIF auto-formats, and optimization on-the-fly |
| **D1 Table** (cms_content) | Stores pure CDN URLs; caching architecture mitigates D1 read-replica lag |
| **KV Cache (cf-astro-isr-cache)** | 7-DAY durability for injected CMS data. Dramatically increases resilience and performance. |
| **Revalidation Webhook** | `POST /api/revalidate` on cf-astro, protected by `REVALIDATION_SECRET` |

> 📖 **Full documentation:** [documentation/CMS_IMAGE_MANAGEMENT.md](./documentation/CMS_IMAGE_MANAGEMENT.md)

## 17. ASYNC EMAIL QUEUES & AUDIT ARCHITECTURE

Both `cf-admin` and `cf-astro` utilize a decoupled Cloudflare Queues architecture to dispatch emails asynchronously.

- **Queue Binding:** `EMAIL_QUEUE` (mapped to `madagascar-emails`)
- **Producer:** API Routes push a JSON payload with a unique `trackingId` to the queue and respond immediately.
- **Consumer:** A standalone Cloudflare Worker (`cf-email-consumer`) consumes the queue batches, processes HTML templates using **Eta** (a lightweight Edge-native framework), and executes the Resend REST API `fetch` completely out of band of the user request. Bloated Node.js SDKs (like `resend` and React Email) are strictly forbidden in the consumer worker.
- **Audit Logs:** All email payloads, transmission statuses, and Resend webhook delivery events are chronologically mapped in the Supabase PostgreSQL table `email_audit_logs`. This table relies exclusively on `service_role` edge requests and has Row Level Security (RLS) entirely locking out public access.
  - **Referential Integrity:** The `booking_id` foreign key constraint enforces `ON DELETE CASCADE`, ensuring that atomic "Hard Wipes" of bookings cleanly and automatically purge associated audit records without referential blocking errors.

> 📖 **Full detailed documentation and Webhook setup guide:** Please refer to the master architecture document located at [`../cf-email-consumer/README.md`](../cf-email-consumer/README.md).

---
*DEV-harshil.8136@gmail.com*
*End of Rules. These constraints must be acknowledged and followed for every task in cf-admin.*

{% endraw %}

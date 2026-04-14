# CF-ADMIN PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Last Updated:** 2026-04-13 (v3.4: Sync pipeline fixes — reviews.ts path expansion, Hyperdrive documentation accuracy, env.d.ts phantom binding cleanup)
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

## 2. RELATIONSHIP TO OTHER PROJECTS

| Project | Role | Relationship |
|---------|------|-------------|
| **cf-astro** | Main customer-facing website | Shares Supabase project, D1 database, R2 bucket. Uses Hyperdrive for direct PG (booking, ARCO) |
| **admin-app** | Legacy admin portal (Next.js) | Reference for UX/features only — **NEVER copy code** |
| **nextjs-app** | Legacy main site (Next.js) | Reference only — no code sharing |

### Shared Resources
- **Supabase Project:** `zlvmrepvypucvbyfbpjj` (same PostgreSQL instance)
- **D1 Database:** `madagascar-db` (ID: `7fca2a07-d7b4-449d-b446-408f9187d3ca`) — shared between both projects
- **R2 Bucket:** `madagascar-images` → `cdn.madagascarhotelags.com` (CMS images, shared read/write)
- **Cloudflare Account:** Mascotas Madagascar

### KV Namespaces (Isolated per project)
| Namespace | ID | Project | Purpose |
|-----------|-----|---------|---------|
| `cf-admin-session` | `ba82eecc6f5a4956ad63178b203a268f` | cf-admin | Astro session store |
| `cf-astro-session` | `bee123e795504473accf58ac5b6de13d` | cf-astro | Astro session store |
| `cf-astro-isr-cache` | `d9cea8c7e20f4b328b8cb3b04104138c` | cf-astro | ISR HTML cache |

### Isolation Rules
- Admin tables use `admin_` prefix to avoid collision with cf-astro tables
- cf-admin has its own KV namespace for sessions (`cf-admin-session`, separate from cf-astro)
- cf-admin has its own Worker deployment (not shared with cf-astro)
- Each project has its own `wrangler.toml`, `.dev.vars`, and deployment pipeline

---

## 3. RBAC — ROLE-BASED ACCESS CONTROL

### Role Hierarchy (5-Tier — lower number = higher privilege)

Defined centrally in `src/lib/auth/rbac.ts`. Color hierarchy follows a **thermal gradient** designed for dark UI legibility:

| Role | Level | Icon | Badge Color | Hex | Permissions |
|------|-------|------|-------------|-----|-------------|
| **DEV** | 0 | ⚡ | Red | `#ef4444` | Absolute system access + dev tools + DB admin + hidden account creation |
| **Owner** | 1 | 💎 | Emerald | `#10b981` | Project ownership + billing + API keys + view hidden accounts |
| **SuperAdmin** | 2 | 👑 | Amber | `#f59e0b` | Full access + user management + settings |
| **Admin** | 3 | 🛡️ | Purple | `#8b5cf6` | Content management + bookings + reports |
| **Staff** | 4 | 👤 | Blue | `#3b82f6` | Read bookings + basic operations |

### Ghost Protection (DEV + Owner Isolation)
- **DEV accounts** are "Ghosts" — invisible to SuperAdmin and below in user listings and API queries
- **Owner accounts** are "Protected" — cannot be modified or deleted by SuperAdmin or below
- Only a logged-in DEV can see/manage other DEV and Owner accounts
- Both DEV and Owner accounts can view **hidden accounts** (see below)

### Hidden Accounts System
- DEV can create accounts with `is_hidden: true` flag in `admin_authorized_users` (Supabase)
- Hidden accounts are completely invisible to SuperAdmin, Admin, and Staff in the user list API (`GET /api/users`)
- Only DEV and Owner roles can view hidden accounts
- Hidden accounts receive identical 404 responses when queried by unauthorized roles (anti-enumeration)
- The **HiddenAccountToggle** UI component only renders in `InviteUserModal` when `activeRole === 'dev' || activeRole === 'owner'` (mirrors the `isOwnerOrDev()` server guard in `rbac.ts`)

### Authorization Model (RBAC + PLAC)
1. **Supabase signup is DISABLED** in dashboard settings
2. Only users listed in `admin_authorized_users` table can access the portal. They are assigned a natural hierarchy level above.
3. DEV/Owner/SuperAdmin can add users to the whitelist with assigned roles (constrained to their level and below).
4. **PLAC (Page-Level Access Control)** dynamically overlays explicit `GRANT` and `DENY` parameters to specific pages per user in D1 `admin_page_overrides`. Overrides can now be set **at creation time** via the InviteUserModal page chip grid — the POST `/api/users/manage` endpoint accepts an optional `pageOverrides: { pagePath, granted }[]` array and batch-writes to D1 after the GoTrue user is provisioned.
5. Access Maps are evaluated via Cloudflare KV with O(1) reads taking <0.5ms on `middleware.ts`. "Deny" values strictly overrule all naturally inherited hierarchies.
6. **Ghost Audit Engine** logs all sensitive mutations (PLAC parsing, User Management, Content/Media updates) via `ctx.waitUntil()` (accessed through `getCfContext()` from `env.ts`). The audit factory validates table names against `ALLOWED_AUDIT_TABLES` whitelist.
7. GoTrue issues JWTs for valid auth attempts; application layer validates the JWT against KV caches and role definitions.

### Session Security
| Setting | Value | Rationale |
|---------|-------|-----------|
| JWT Refresh | Every 30 minutes | `SESSION_REFRESH_INTERVAL_MS=1800000` |
| Max Session | 24 hours | `SESSION_MAX_LIFETIME_MS=86400000` |
| Cookie Prefix | `__Host-admin_session` (production) | Prevents subdomain fixation attacks |
| Storage | Cloudflare KV (Astro Sessions) | Edge-local, fast reads |
| SignOut | Destroys KV entry + revokes Supabase tokens globally | No lingering tokens |

### Environment Bindings Rule (Astro 6)
- **`src/lib/env.ts`** is the **single source of truth** for all Cloudflare Workers env bindings
- `getEnv(context)` returns typed `CfEnv` with Proxy fallback to `process.env` for local dev
- `getRawEnv()` provides direct env object access for session/auth modules
- `getKVBinding()` returns the `SESSION` KV namespace directly
- **NEVER import `cloudflare:workers` in any other file** — always import from `env.ts`
- `getCfContext(context)` provides `waitUntil()` for background tasks (replaces deprecated `locals.runtime`)

---

## 4. CLOUDFLARE FREE TIER — EXACT LIMITS & QUOTAS

> Identical to cf-astro. All data verified against official Cloudflare documentation (March 2026).

### 4.1 Workers (Compute)

| Metric | Free Limit |
|--------|-----------|
| Requests | **100,000/day** |
| CPU time per request | **10 ms** |
| Memory | 128 MB |
| Subrequests per request | 50 |
| Worker script size | 3 MB |
| Number of Workers | 100 per account |

### 4.2 KV (Sessions)

| Metric | Free Limit |
|--------|-----------|
| Keys read | **100,000/day** |
| Keys written | **1,000/day** |
| Storage per account | **1 GB** |

### 4.3 D1 Database (SQLite)

| Metric | Free Limit |
|--------|-----------|
| Rows read | **5 million/day** |
| Rows written | **100,000/day** |
| Storage | **5 GB** |

### 4.4 R2 Object Storage

| Metric | Free Limit |
|--------|-----------|
| Storage | **10 GB/month** |
| Reads | **10 million/month** |
| Writes | **1 million/month** |
| Egress | **FREE (always $0)** |

---

## 5. SUPABASE FREE TIER

| Metric | Free Limit |
|--------|-----------|
| Projects | **2 active** (cf-astro + cf-admin share 1 project) |
| PostgreSQL size | **500 MB** |
| Auth MAUs | **50,000** |
| File storage | **1 GB** |
| Edge Functions | **500,000/month** |
| RLS policies | **Unlimited** |

---

## 6. UPSTASH FREE TIER

| Metric | Free Limit |
|--------|-----------|
| Commands per day | **10,000** |
| Max data size | **256 MB** |
| Concurrent connections | 10 |
| Databases | 1 |

---

## 7. TECHNOLOGY STACK

> 🚨 **THE WHITELIST ARCHITECTURE POLICY:** We employ a strict "whitelisting" approach to technology additions. Anything not explicitly listed in this document is considered **BLACKLISTED** by default to protect our <50KB "Lean Edge" budget. If an AI agent or developer wishes to introduce a new library (e.g., React 19, Recharts, shadcn/ui, Hono), it must be explicitly proposed with a strong "why it's needed" justification. The new dependency can ONLY be used if the USER explicitly approves the proposal.

### 7.1 Framework: Astro 6.0+ (Full SSR for Admin)

- `output: 'server'` — ALL routes are server-rendered (auth check required)
- Cloudflare adapter with native binding access
- Astro Sessions API backed by Cloudflare KV for session persistence
- No static pages — admin portal has zero public content

### 7.2 UI: Preact Islands

- 3KB gzipped vs 45KB+ for React runtime
- Full React API compatibility via `preact/compat`
- Use `client:load` for auth-critical UI (login form)
- Use `client:idle` for dashboard widgets

### 7.3 CSS: Tailwind CSS v4

- Runs via `@tailwindcss/vite` as a Vite plugin
- Uses `@theme` in `src/styles/global.css` for design tokens
- Dark-first "Midnight Slate" design system with Arctic Cyan primary accents.

### 7.4 Auth: Supabase GoTrue

- Client-side: `@supabase/supabase-js` for login flows
- Server-side: service_role client for whitelist verification
- Providers: Magic Link, Google, GitHub, Facebook
- JWT refresh every 30 min, hard session expiry at 24 hours

### 7.5 Database Access

- Supabase PostgreSQL via REST client (@supabase/supabase-js) — Hyperdrive is NOT used by cf-admin
- Admin tables: `admin_authorized_users`, `admin_sessions`
- All tables have RLS enabled — service_role only
- D1 for non-PII operational data (future)

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

### 8.1 TypeScript Strictness
- `moduleResolution: "bundler"` in tsconfig.json
- `any` type is **FORBIDDEN** (unless bypassing upstream type bug, documented)
- All Cloudflare bindings typed

### 8.2 File Naming
All file names must be unique and descriptive:
- ✅ `LoginForm.tsx`, `AuthLayout.astro`, `rbac.ts`
- ❌ `Form.tsx` (ambiguous), `index.tsx` (without context)

### 8.3 Component Architecture ("LEGO-Style" Atomic Design)
- **Strict Composition Rule:** Components must follow Atomic Design + Island Architecture. Never create monolithic files.
- **Atoms/Molecules:** Tiny, focused, reusable sub-components (e.g. `SidebarHeader.tsx`, `SidebarProfile.tsx`, `NavIcon.tsx`).
- **Organisms (Islands):** The primary Preact component that orchestrates atoms/molecules (e.g., `SidebarMenu.tsx`).
- **Astro Shells (`.astro`):** For server-rendered layouts and server-side data fetching.
- **Preact islands (`.tsx`):** Only for interactive UI.
- Use `client:load` for above-fold critical interactivity (like navigation)
- Use `client:idle` for below-fold widgets

### 8.4 Error Handling
- Never show white screens — use ErrorBoundary component
- Section-level boundaries: one broken widget never crashes the page
- API routes return structured JSON errors with proper HTTP status codes
- Users always have navigation to recover

### 8.5 Animation Standards
- All interactive elements must have smooth transitions
- Use `var(--duration-normal)` (200ms) for hover/focus states
- Use `var(--duration-slow)` (350ms) for page transitions
- Respect `prefers-reduced-motion` media query

---

## 9. SECURITY RULES

### 9.1 Secrets Management
- Local dev secrets in `.dev.vars` (gitignored)
- Production secrets via `wrangler secret put <KEY>`
- Never commit secrets; `.dev.vars` is in `.gitignore`
- Required production secrets: `SUPABASE_SERVICE_ROLE_KEY`, `REVALIDATION_SECRET`, `SITE_URL`

### 9.2 Auth Architecture
- Signup is **DISABLED** in Supabase dashboard
- Only `admin_authorized_users` whitelist members can authenticate
- Server-side whitelist check on every auth callback
- OAuth provider validated against whitelist (`google`, `github`, `facebook`, `email`)
- JWT validation + refresh via Supabase client
- Session cookies use `__Host-` prefix in production (prevents subdomain fixation)
- Sessions stored in KV with 24-hour hard expiry

### 9.3 Route Protection
- Astro middleware checks session on EVERY non-public route
- Public routes: `/` (login), `/auth/callback` — restricted to `GET`/`HEAD` only
- Everything else requires valid session + role check
- Failed auth → redirect to login with error message
- **X-Request-ID** header injected on every request via `crypto.randomUUID()` for audit correlation

### 9.4 CSRF Protection
- **Stateless CSRF** via `src/lib/csrf.ts` — Origin + Referer header validation
- Applied globally by `middleware.ts` to all mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`)
- Fail-closed: if both Origin and Referer headers are missing, the request is denied
- Cost: <0.05ms CPU, 0 KV reads, 0 client-side JavaScript
- Fail-open in development only (when `SITE_URL` is not configured)

### 9.5 Input Validation
- All form inputs validated server-side before processing
- Parameterized queries only — never string concatenation
- All API error messages are sanitized — no internal stack traces or schema details leak to the client
- Turnstile protection on login form (magic link)

### 9.6 Audit Integrity
- Every audit operation runs in `ctx.waitUntil()` to avoid blocking the user flow and maintain sub-10ms logic paths.
- The system aggregates metrics dynamically via parallel D1 and Supabase calls in `/api/audit/stats` without slowing down individual worker tasks.
- For maximum operational scaling, granular permissions (sub-features like `/dashboard/logs#export`) map securely under routing strings cleanly without impacting schema constraints.
- The `admin_audit_log` table has NO `DELETE` or `UPDATE` endpoints exposed at the application layer.

### 9.7 Security Headers
Defined in `public/_headers` (hardened 2026-04-10):
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-XSS-Protection: 0` — disabled (CSP supersedes it; `1; mode=block` leaks data)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin` — isolates browsing context
- `Cross-Origin-Resource-Policy: same-origin` — blocks cross-origin data reads
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — 2-year HSTS
- `Content-Security-Policy` — `'unsafe-eval'` and `'unsafe-inline'` completely removed. Fully secured via Astro 6 native CSP nonces (`data-astro-csp` and `security.csp` config).

---

## 10. DESIGN SYSTEM — "MIDNIGHT SLATE"

> **Evolved from "Obsidian Clarity / Spectrum" → "Midnight Slate"**
> We have abandoned the multi-color section identity system. The entire portal operates under a unified premium dark UI with **Arctic Cyan** (`#22d3ee`) primary accents.

### Core Surface Palette

| Token | Dark Value | Purpose |
|-------|-----------|---------|
| `surface-base` | `#060a0e` | Page background |
| `surface-raised` | `#0c1117` | Card/panel background |
| `surface-overlay` | `#131a22` | Modal/dropdown background |
| `surface-glass` | `rgba(12,17,23,0.72)` | Glassmorphism panels |
| `text-primary` | `#f0f4f8` | Headings, important text |
| `text-secondary` | `#8b9ab5` | Body text, labels |
| `text-tertiary` | `#5a6b83` | Hints, captions |

### Arctic Cyan Accent System
Violet is fully removed from all primary interactions. All active elements, focus rings, and primary highlights use **Arctic Cyan** (`#22d3ee` / `rgba(34, 211, 238, *)`).

| Element | Idle State | Active/Hover State |
|---------|-----------|-------------------|
| **Social Buttons** | `border-white/[0.08]` + `bg-white/[0.04]` | `hover:bg-cyan-500/[0.06]` + `hover:border-cyan-400/[0.2]` |
| **Input Focus Ring** | `border-white/[0.1]` | `border: rgba(34,211,238,0.4)` + `box-shadow: 0 0 0 3px rgba(34,211,238,0.15)` |
| **Active Nav Items**| `rgba(255,255,255,0.02)`| `rgba(34,211,238,0.12)` + `cyan` glowing dot + `cyan` vertical accent line |

### Typography
- Primary: `Inter` (Google Fonts) — 400, 500, 600, 700, 800
- Mono: `JetBrains Mono` — code blocks, technical data

### Motion
- Fast: 120ms (micro-interactions)
- Normal: 200ms (hover, focus)
- Slow: 350ms (page transitions)
- Spring: `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy elements)

### 10.1 Login Portal — "Midnight Slate"

The login page uses a **single-column, centered card** layout inspired by Clerk/Vercel auth flows. No split-screen, no sidebar — just a pristine glassmorphic card on a warm dark canvas.

#### Background & Ambient System

| Element | Spec |
|---------|------|
| **Base** | `#09090b` (zinc-950) — set via inline `style` on `<body>`, not Tailwind class |
| **Orb 1 (Cyan)** | `radial-gradient` of `rgba(34,211,238,0.4)` → `rgba(8,145,178,0.15)` |
| **Orb 2 (Slate)** | `radial-gradient` of `rgba(51,65,85,0.5)` → `rgba(30,41,59,0.15)` |
| **Orb 3 (Deep Blue)** | `radial-gradient` of `rgba(59,130,246,0.3)` → `rgba(29,78,216,0.1)` |
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

#### Unbuilt Modules & Soft 404
- Unbuilt portal paths (e.g. `/dashboard/customers` or `/dashboard/analytics`) are intercepted by a Catch-All spread route at `src/pages/dashboard/[...slug].astro`.
- Because Astro resolves exact physical paths first, this route organically serves as a fallback.
- It leverages the `AdminLayout` cleanly so that sidebar state is preserved, injecting a Midnight Slate "Module Under Construction" card in the main view rather than breaking the Single-Page Application sequence.

#### Dashboard Widgets
| Widget | Key Treatment |
|--------|---------------|
| **StatCard** | Glass bg, `cyan-400` top accent line (2px), `translateY(-3px)` lift on hover |
| **SystemHealthBar** | Minimalist background, strict tabular data display |

---

## 11. DYNAMIC CMS & ISG/ISR ARCHITECTURE (cf-admin <> cf-astro)

cf-admin securely mutates data for the public-facing cf-astro site via a precise "$0 ISR Edge-Cache" mechanism.

### 11.1 The Shared Data Layer
- **Structured Content**: All CMS content (text, prices, reviews) is stored in the D1 `cms_content` table (shared with cf-astro).
- **Media/Images**: Uploaded and managed securely through the shared Cloudflare R2 `IMAGES` Bucket (`madagascar-images`).
- **RBAC**: Any mutation query is strictly gated by the active session role (`Admin` or higher — Owner, SuperAdmin, DEV).

### 11.2 KV-Backed ISR Gateway (How it works)
We intentionally bypass native Cloudflare Cache API purging (which requires privileged Account-level Tokens) in favor of a KV-backed manual revalidation Gateway.
1. Admin saves changes in cf-admin UI (Hero, Gallery, Services, or Reviews).
2. cf-admin writes updates to the D1 `cms_content` table or R2.
3. cf-admin calls the **unified `revalidateAstro(env, ['/'])`** helper in `src/lib/cms.ts`.
4. The helper **auto-expands** base paths to include all locale variants (`/` → `['/', '/en', '/es']`).
5. The helper fires `POST {PUBLIC_ASTRO_URL}/api/revalidate` with `Authorization: Bearer {REVALIDATION_SECRET}`.
6. cf-astro receives the webhook, verifies the secret, and deletes the requested paths from its `ISR_CACHE` KV namespace.
7. The next request to cf-astro triggers an SSR rebuild using the fresh D1 data, delivering high performance (sub-10ms cache hits) and true CMS dynamism.

> 🚨 **CRITICAL SYNC RULE**: For this gateway to function, the target pages on `cf-astro` (e.g., `index.astro`) MUST have `export const prerender = false;` explicitly defined. If `cf-astro` is locked to static generation, the webhook will succeed but the site will blindly serve static files without hitting the ISR middleware, making UI updates impossible.

### 11.3 Unified Revalidation Helper (Single Source of Truth)

All 5 Content Studio API routes call a **single function** in `src/lib/cms.ts`:

```typescript
// Signature:
export async function revalidateAstro(
  env: { PUBLIC_ASTRO_URL?: string; REVALIDATION_SECRET?: string },
  basePaths: string[]
): Promise<boolean>

// Usage (identical in every endpoint):
await revalidateAstro(env, ['/']);
```

**Path Expansion Engine:** `SITE_LOCALES = ['en', 'es']` — the helper automatically generates:
- `'/'` → `['/', '/en', '/es']`
- `'/services'` → `['/services', '/en/services', '/es/services']`

> ⚠️ To add a new locale (e.g., French), update ONLY the `SITE_LOCALES` array in `src/lib/cms.ts`. Zero changes to any API route.

| API Route | CMS Function | Revalidation Call |
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
├── manage-users-rbac.md          # RBAC hierarchy, user lifecycle, ghost protection, hidden accounts
├── PLAC_AND_AUDIT.md             # PLAC access control + Ghost Audit Engine + SHA-256 hash chain
├── SECURITY_HARDENING.md         # CSRF, cookie security, error sanitization, request tracing
├── DATA_PRIVACY.md               # Privacy dashboard, consent records, GDPR/LFPDPPP compliance
├── CMS_AND_BOOKINGS_MANAGEMENT.md  # CMS content studio + bookings architecture
├── 10-observability-sentry.md    # Sentry integration for error tracking + edge observability
├── 2026-04-07-theme-system-design.md  # Midnight Slate theme design system decisions
└── premium-color-palettes.md     # Color palette reference for the design system
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

## 16. CMS IMAGE MANAGEMENT — cf-admin ↔ cf-astro BRIDGE

The CMS Image Management system enables authorized admin users to upload and replace images (Hero background, Gallery 1–6) on `cf-astro` from the `cf-admin` dashboard. All infrastructure remains $0.

### Architecture Summary

| Component | Role |
|-----------|------|
| **R2 Bucket** (`madagascar-images`) | Stores uploaded image binaries |
| **CDN Domain** (`cdn.madagascarhotelags.com`) | Public edge-cached delivery of R2 images |
| **D1 Table** (`cms_content`) | Stores CDN URLs with cache-busting timestamps |
| **ISR KV Cache** | HTML cache in cf-astro — purged on image update |
| **Revalidation Webhook** | `POST /api/revalidate` on cf-astro, protected by `REVALIDATION_SECRET` |

### Key Files

| File | Project | Purpose |
|------|---------|----------|
| `src/lib/cms.ts` | cf-admin | Upload to R2, write D1, **unified revalidation helper** |
| `src/pages/api/media/upload.ts` | cf-admin | Image upload API endpoint |
| `src/pages/api/media/gallery.ts` | cf-admin | Gallery JSON array CRUD + revalidation |
| `src/pages/api/content/blocks.ts` | cf-admin | Text block CMS updates + revalidation |
| `src/pages/api/content/services.ts` | cf-admin | Services/pricing JSON updates + revalidation |
| `src/pages/api/content/reviews.ts` | cf-admin | Happy clients reviews JSON + revalidation |
| `src/pages/dashboard/content/` | cf-admin | Content Studio UI (Hero, Gallery, Services, Reviews tabs) |
| `src/lib/images.ts` | cf-astro | Dynamic image URL resolver |
| `src/components/sections/Hero.astro` | cf-astro | Dynamic hero background |
| `src/components/sections/Gallery.astro` | cf-astro | Dynamic gallery carousel |
| `src/pages/api/revalidate.ts` | cf-astro | ISR cache purge webhook (receives calls from cf-admin) |

### ⚠️ Critical Deployment Rules (DO NOT SKIP)

1. **`REVALIDATION_SECRET` must be deployed on BOTH Workers.** The secret is the shared key that authenticates the revalidation webhook from cf-admin to cf-astro. If missing from cf-astro, the `/api/revalidate` endpoint returns 500, revalidation silently fails, and the live site serves stale HTML indefinitely.
   ```bash
   wrangler secret put REVALIDATION_SECRET --name cf-admin-madagascar  # sender
   wrangler secret put REVALIDATION_SECRET --name cf-astro              # receiver
   ```

2. **Hero images use unique UUID R2 keys per upload** (e.g. `hero/hero-{uuid}.jpg`), matching the gallery pattern. This prevents Cloudflare's CDN from permanently serving a stale cached version after replacement. The `cacheControl` is `public, max-age=31536000` (without `immutable`) so manual purges remain possible.

> 📖 **Full documentation:** [`documentation/CMS_IMAGE_MANAGEMENT.md`](./documentation/CMS_IMAGE_MANAGEMENT.md)

---

## 17. ASYNC EMAIL QUEUES & AUDIT ARCHITECTURE

Both `cf-admin` and `cf-astro` utilize a decoupled Cloudflare Queues architecture to dispatch emails asynchronously.

- **Queue Binding:** `EMAIL_QUEUE` (mapped to `madagascar-emails`)
- **Producer:** API Routes push a JSON payload with a unique `trackingId` to the queue and respond immediately.
- **Consumer:** A standalone Cloudflare Worker (`cf-email-consumer`) consumes the queue batches and executes the Resend API `fetch` completely out of band of the user request.
- **Audit Logs:** All email payloads, transmission statuses, and Resend webhook delivery events are chronologically mapped in the Supabase PostgreSQL table `email_audit_logs`. This table relies exclusively on `service_role` edge requests and has Row Level Security (RLS) entirely locking out public access.

> 📖 **Full detailed documentation and Webhook setup guide:** Please refer to the master architecture document located at [`../cf-email-consumer/README.md`](../cf-email-consumer/README.md).

---
*DEV-harshil.8136@gmail.com*
*End of Rules. These constraints must be acknowledged and followed for every task in cf-admin.*

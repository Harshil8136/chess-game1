{% raw %}
# CF-ADMIN PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Last Updated:** 2026-04-27 (v4.0: Cloudflare Zero Trust auth migration — GoTrue fully removed)
> **Research Sources:** Cloudflare Docs MCP, Supabase MCP, Cloudflare Bindings MCP, Tavily, Official Documentation

---

## 🛡️ RULE #0 — THE ABSOLUTE LAW (NEVER VIOLATE)

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

## 🛡️ RULE #0.5 — NO FAKE DATA OR PLACEHOLDERS

**ALL data and presented information MUST be real and accurate, sourced from active databases (Supabase/D1) or actual API telemetry (Cloudflare Analytics/Resend/etc).**

- ❌ **FORBIDDEN:** Randomly generated chart data (e.g. `Math.random()`), hardcoded dashboard metrics (`sessionCount = 24`), or mock user activity logs.
- ❌ **FORBIDDEN:** "Under Construction" placeholder pages masking incomplete features.
- If a feature requires data that cannot be currently provided by the backend, the feature MUST NOT be built with mock data. Instead, either:
  1. Omit the feature entirely from the UI, OR
  2. Implement the full backend pipeline to fetch the real data.
- If real data cannot be provided even when explicitly requested by the USER, the AI agent MUST provide a documented explanation and refuse to implement the mock data solution.

---

## PROJECT MISSION — SECURE ADMIN PORTAL, $0 INFRASTRUCTURE

**cf-admin is a production-ready, commercial-grade administrative portal built entirely on FREE tier services.** Designed to:

- ✅ Manage content, bookings, users, and site settings via secure dashboard
- ✅ Enforce multi-level RBAC (DEV > Owner > SuperAdmin > Admin > Staff) on every route
- ✅ Authenticate via Cloudflare Zero Trust Access (Google/GitHub/OTP — no Supabase GoTrue)
- ✅ Block ALL unauthorized access — identity at CF edge, authorization whitelist in Supabase
- ✅ Role re-check every 30 minutes via D1 re-fetch, hard-expire sessions at 24 hours (KV TTL + CF session duration + createdAt guard)
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
| **Auth** | Cloudflare Zero Trust Access (Google / GitHub / OTP — CF edge identity) |
| **Database** | Supabase PostgreSQL (shared project `zlvmrepvypucvbyfbpjj`) |
| **Session Store** | Cloudflare KV (via Astro Sessions API) |
| **Cache** | Upstash Redis (free tier — 10K commands/day) |
| **Storage** | Cloudflare R2 (CMS image uploads — `madagascar-images` bucket → `cdn.madagascarhotelags.com`) |
| **CSS** | Tailwind CSS v4 via `@tailwindcss/vite` |
| **Design System** | "Midnight Slate" — dark-first with Blue-500 primary accents |
| **Domain** | `admin.example.com` (provisioned at v1.0) |
| **GitHub** | `mascotasmadagascar-cmd/cf-admin-madagascar` (private) |
| **Worker Name** | `cf-admin-madagascar` (Mascotas Cloudflare account) |

---

## 2. STRICT HTTP SECURITY HEADERS & CSP

**EDGE-INJECTED SECURITY:** The dashboard enforces strict HTTP security headers injected globally at the edge via Astro middleware `sequence`.

- **Content-Security-Policy (CSP):** Allows `self`, `unsafe-inline` styles (for Tailwind v4), and `unsafe-inline`/`unsafe-eval` scripts strictly for Preact/Astro island hydration and Sentry tracking.
- **X-Frame-Options: DENY** (Blocks Clickjacking)
- **X-Content-Type-Options: nosniff** (Prevents MIME-sniffing)
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Strict-Transport-Security: max-age=31536000; includeSubDomains; preload**

→ See [SECURITY.md](./documentation/SECURITY.md) for the full security architecture.

## 2. RELATIONSHIP TO OTHER PROJECTS

| Project | Role | Relationship |
|---------|------|-------------|
| **cf-astro** | Main customer-facing website | Shares Supabase project, D1 database, R2 bucket. Uses Hyperdrive for direct PG (booking, ARCO) |
| **cf-chatbot** | Cloudflare Workers AI Bot | Operates autonomously on Edge natively interacting with WhatsApp/Web. `cf-admin` serves as its secure configuration proxy and analytics Dashboard. |
| **admin-app** | Legacy admin portal (Next.js) | Reference for UX/features only — **NEVER copy code** |
| **nextjs-app** | Legacy main site (Next.js) | Reference only — no code sharing |

### Shared Resources

- **Supabase Project:** `[PROJECT_REF]` (same PostgreSQL instance)
- **D1 Database:** `madagascar-db` (ID: `7fca2a07-d7b4-449d-b446-408f9187d3ca`) — shared between both projects
- **R2 Bucket:** `madagascar-images` → `cdn.madagascarhotelags.com` (CMS images, shared read/write)
- **Cloudflare Account:** Mascotas Madagascar

### KV Namespaces (Isolated per project)

| Namespace | ID | Project | Purpose |
|-----------|-----|---------|---------|
| `cf-admin-session` | `ba82eecc6f5a4956ad63178b203a268f` | cf-admin | Astro session store |
| `cf-astro-session` | `bee123e795504473accf58ac5b6de13d` | cf-astro | Astro session store |
| `cf-astro-isr-cache` | `d9cea8c7e20f4b328b8cb3b04104138c` | cf-astro | ISR HTML cache |

> ✅ **SESSION KV IDs VERIFIED:** The `cf-admin-session` (`ba82...`) and `cf-astro-session` (`bee1...`) IDs are verified against the LIVE environment.

### Isolation Rules

- Admin tables use `admin_` prefix to avoid collision with cf-astro tables
- cf-admin has its own KV namespace for sessions (`cf-admin-session`, separate from cf-astro)
- cf-admin has its own Worker deployment (not shared with cf-astro)
- Each project has its own `wrangler.toml`, `.dev.vars`, and deployment pipeline

---

## 3. RBAC — ROLE-BASED ACCESS CONTROL

→ See [USER-MANAGEMENT.md](./documentation/USER-MANAGEMENT.md) for the full RBAC hierarchy, user lifecycle, ghost protection, and hidden accounts.

---

## 4. INFRASTRUCTURE FREE TIER LIMITS

→ See [OPERATIONS.md](./documentation/OPERATIONS.md) for Cloudflare binding IDs, free tier quotas, and the pre-flight deploy checklist.

---

## 7. TECHNOLOGY STACK

> 🛡️ **THE WHITELIST ARCHITECTURE POLICY:** We employ a strict "whitelisting" approach to technology additions. Anything not explicitly listed in this document is considered **BLACKLISTED** by default to protect our <50KB "Lean Edge" budget. If an AI agent or developer wishes to introduce a new library (e.g., React 19, Recharts, shadcn/ui, Hono), it must be explicitly proposed with a strong "why it's needed" justification. The new dependency can ONLY be used if the USER explicitly approves the proposal.

### 7.1 Framework: Astro 6.0+ (Full SSR for Admin)

- `output: 'server'` — ALL routes are server-rendered (auth check required)
- Cloudflare adapter with native binding access
- Astro Sessions API backed by Cloudflare KV for session persistence
- No static pages — admin portal has zero public content

### 7.2 UI: Preact Islands

- Preact (~3KB) for all interactive components — React-compatible, no React overhead
- Islands hydrate with `client:load` (immediate) or `client:idle` (deferred)
- Cross-island state via Preact Signals; no global event bus needed at current scale

### 7.6 Environment Variables

```
# .dev.vars (local — gitignored)
PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=...         # DB operations only (no GoTrue auth)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
SITE_URL=https://admin.example.com
# CF Zero Trust
CF_TEAM_NAME=mascotas                 # your-team.cloudflareaccess.com
CF_ACCESS_AUD=...                     # Application Audience tag from CF dashboard
CF_API_TOKEN_ZT_WRITE=...             # Zero Trust Edit — Layer 3 force-kick
CF_API_TOKEN_READ_LOGS=...            # Zero Trust Read — audit log cron polling
LOCAL_DEV_ADMIN_EMAIL=harshil.8136@gmail.com  # dev-only auth bypass
# REMOVED: PUBLIC_SUPABASE_ANON_KEY, TURNSTILE_SECRET_KEY (no longer used)
```

Secrets in production: `wrangler secret put <KEY>`

### 7.7 The "Module Manifest" Pattern

To prevent architectural entropy as `cf-admin` grows, every new feature area must be encapsulated using the **Module Manifest** pattern. Code should be organized into self-contained vertical slices.

**Directory Structure:**
```
src/
  ├── pages/
  │   └── [module_name]/
  │       ├── index.astro       # Main entry point (SSR)
  │       ├── [sub_route].astro # Nested routes
  │       └── _components/      # Module-specific islands (Preact)
  └── styles/
      └── [module_name]/
          └── [component].css   # Module-isolated CSS
```

**Implementation Rules:**

1. **Entry Point (`index.astro`):** Must wrap content in `<AdminLayout title="ModuleName">` and call `requireAuth(Astro)`.
2. **Dynamic Sidebar Auto-Registry:** A module is ONLY visible in the sidebar if its path exists in the D1 `admin_pages` table and the user's role has PLAC authorization. You do NOT hardcode nav links in the UI.
3. **CSS Code Splitting & Scoping:** Monolithic global CSS (e.g., `global.css`, `dashboard.css`) is strictly forbidden. Essential dashboard styles must be scoped via Astro components (like `DashboardStyles.astro`) or inline component `<style>` blocks to ensure zero style bleeding and an optimal payload size.
4. **Data Access Layer (DAL):** Never write raw D1 SQL queries directly inside `.astro` frontmatter. All data fetching must go through Repository classes (e.g., `DashboardRepository.ts` in `src/lib/dal/`) to ensure separation of concerns, security, and testability. Pass the fetched static initial state to Preact islands as props.

---

## 8. CODE QUALITY RULES

→ See [CODING-STANDARDS.md](./documentation/CODING-STANDARDS.md) for the full code quality and architecture standards.

---

## 9. SECURITY RULES

→ See [SECURITY.md](./documentation/SECURITY.md) for the full security architecture, CSRF, cookie policy, RLS matrix, and Ghost Protection.

---

## 10. DESIGN SYSTEM — "MIDNIGHT SLATE"

The dashboard uses a unified premium dark UI with Blue-500 primary accents, 5-level surface elevation, OKLCH color tokens, and component-scoped CSS. Both dark and light themes are fully supported.

→ See [DESIGN-SYSTEM.md](./documentation/DESIGN-SYSTEM.md) for design tokens, login portal spec, sidebar mechanics, component patterns, animation, accessibility, and responsive layout.

---

## 11. DYNAMIC CMS & ISR ARCHITECTURE (cf-admin ↔ cf-astro)

cf-admin securely mutates content for cf-astro via a 2-tier KV injection pipeline that bypasses D1 read-replica lag. All revalidation uses `revalidateAstro(env, basePaths, cmsData?)` with 3× exponential backoff.

→ See [CMS.md](./documentation/CMS.md) for the full ISR architecture, KV injection strategy, upload flow, and configuration constraints.

---

## 12. DEPLOYMENT RULES

### Build & Deploy

```bash
# Development
npm run dev              # Local dev (wrangler dev)
npm run cf:dev           # Full CF runtime with R2 simulation (required for image uploads)

# Type Check
astro check              # TypeScript validation

# Build & Deploy
astro build && wrangler deploy   # Build + deploy to Cloudflare
```

### Git Workflow

> 🛡️ **CRITICAL: See `../../GITHUB_RULES.md` for all Git deployment commands.**
> You must ALWAYS verify your directory with `git remote -v` and push directly to `origin main`. Do not create branches.

### Environment

- `wrangler.toml` — Cloudflare bindings (D1, KV, R2, Queues)
- `.dev.vars` — Local secrets (gitignored) — **never set `PUBLIC_ASTRO_URL` here** (causes CMS revalidation loop)
- `wrangler secret put <KEY>` — Production secrets

→ See [OPERATIONS.md](./documentation/OPERATIONS.md) for binding IDs, secrets checklist, and deploy verification steps.

---

## 13. DOCUMENTATION ARCHITECTURE

| File | Purpose |
|------|---------|
| `RULESAd.md` | This file — operational rules and quick-reference pointers |
| `README.md` | Quick start guide for developers |
| `AI_CODE_MAINTENANCE.md` | AI agent maintenance guidelines |
| `documentation/` | Detailed technical documentation (14 files) |

### Documentation Folder Structure

```
documentation/
├── ARCHITECTURE.md          # Lean Edge stack, CF ZT request lifecycle, module map, CPU budget
├── SECURITY.md              # CF Zero Trust auth, CSRF, sessions, HTTP headers, RLS matrix, 3-layer force-kick
├── PLAC-AND-AUDIT.md        # PLAC access control + Ghost Audit Engine + break-glass admin
├── USER-MANAGEMENT.md       # RBAC hierarchy, user lifecycle (CF ZT), 3-layer ghost protection, hidden accounts
├── CMS.md                   # CMS content studio, bookings, ISR, KV injection, R2/CDN
├── DASHBOARD.md             # Dashboard home, KPI widgets, bento grid, analytics
├── PRIVACY.md               # Privacy dashboard, consent records, GDPR/LFPDPPP, Forensic Blue spec
├── CHATBOT.md               # Workers AI pipeline, proxy architecture, admin UI, analytics
├── LOGIN-FORENSICS.md       # Login forensics v3 (CF ZT), Tier 1-only schema, CF Access fields
├── DESIGN-SYSTEM.md         # Midnight Slate tokens, CSS architecture, components, login portal, sidebar
├── OPERATIONS.md            # Binding IDs (D1/KV/R2), secrets registry (CF ZT new secrets), deploy commands
├── CODING-STANDARDS.md      # DAL pattern, TypeScript standards, component rules, naming
├── DEV-TOOLS.md             # Edge Command Center — debug tools, diagnostics, dev utilities
└── errors/
    └── ssr-silent-blank-screen.md  # Known issue: SSR silent blank screen diagnosis
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

### Only Paid Services

| Service | Cost | Note |
|---------|------|------|
| Domain name | ~$10-15/year | One-time, shared with cf-astro |
| Anthropic (Claude Haiku fallback) | ~$0.01-0.50/month | Chatbot fallback only |
| Perplexity MCP | Per-query | Minimize usage |

---

## 17. ASYNC EMAIL QUEUES & AUDIT ARCHITECTURE

Both `cf-admin` and `cf-astro` utilize a decoupled Cloudflare Queues architecture to dispatch emails asynchronously.

- **Queue Binding:** `EMAIL_QUEUE` (mapped to `madagascar-emails`)
- **Producer:** API Routes push a JSON payload with a unique `trackingId` to the queue and respond immediately.
- **Consumer:** A standalone Cloudflare Worker (`cf-email-consumer`) consumes the queue batches, processes HTML templates using **Eta** (a lightweight Edge-native framework), and executes the Resend REST API `fetch` completely out of band of the user request. Bloated Node.js SDKs (like `resend` and React Email) are strictly forbidden in the consumer worker.
- **Audit Logs:** All email payloads, transmission statuses, and Resend webhook delivery events are chronologically mapped in the Supabase PostgreSQL table `email_audit_logs`. This table relies exclusively on `service_role` edge requests and has Row Level Security (RLS) entirely locking out public access.
  - **Referential Integrity:** The `booking_id` foreign key constraint enforces `ON DELETE CASCADE`, ensuring that atomic "Hard Wipes" of bookings cleanly and automatically purge associated audit records without referential blocking errors.

> 📎 **Full detailed documentation and Webhook setup guide:** See [`../cf-email-consumer/README.md`](../cf-email-consumer/README.md).

---

*End of Rules. These constraints must be acknowledged and followed for every task in cf-admin.*

{% endraw %}

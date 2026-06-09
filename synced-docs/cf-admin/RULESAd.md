# CF-ADMIN PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Last Updated:** 2026-06-09 (v4.7: sync-system durability merge + PENDING OPS runbook below)
> **Research Sources:** Cloudflare Docs MCP, Supabase MCP, Cloudflare Bindings MCP, Tavily, Official Documentation

---

## ⏳ PENDING OPS — MANUAL STEPS REQUIRED (added 2026-06-09)

The sync-system durability work (see `documentation/reference/SYNC-SYSTEM-REVIEW.md`)
is merged to `main` in **both repos** and deploys green, but parts of it are
**dormant by design** until the steps below are completed. Everything is fail-soft
in the meantime — nothing breaks, the new features just don't activate.

**What is safe right now (before any step below):**

| Area | Behavior until steps done |
|------|---------------------------|
| CMS publish | Works exactly as before; on a failed edge purge it logs a warning and records a `pending` outbox row (no redrive yet) |
| Control-plane config | Fully works via a legacy fallback; version tracking + If-Match concurrency activate after migration `0034` |
| Booking flow | Completely unaffected; the email-payload write fails softly until migration `0008` (cf-astro) |
| Email-retry reconciler | Runs every 5 min but finds nothing until `0008` is applied |

### Step A — Create the Cloudflare Queues + un-gate the wrangler config (cf-admin)

Purpose: activates the **durable revalidation pipeline** (failed CMS publishes are
automatically re-driven with retries and a dead-letter queue, instead of lagging
silently for 1–24 h).

1. From the `cf-admin-madagascar` repo root (logged into wrangler):

   ```bash
   npx wrangler queues create madagascar-sync-revalidate
   npx wrangler queues create madagascar-sync-revalidate-dlq
   ```

2. Open `wrangler.toml`, find the section
   `# ─── Queues (Durable Revalidation — Phase 1.1) ─────` and **uncomment** the
   three gated blocks (remove the leading `# ` from the `[[queues.producers]]`
   SYNC_QUEUE block and BOTH `[[queues.consumers]]` blocks). Do not change any
   values — batch sizes, `max_retries = 4`, and the `dead_letter_queue` name are
   already correct.

3. Commit + push to `main` (Workers Builds auto-deploys), or deploy manually:

   ```bash
   npm run cf:deploy
   ```

4. Verify:

   ```bash
   npx wrangler queues list
   ```

   Both `madagascar-sync-revalidate` queues should exist. Then save any CMS block
   in the Content Studio — the save response should include `verified: true`.

> ⚠ Order matters: create the queues **before** deploying the un-gated config.
> `wrangler deploy` hard-fails if the consumers reference queues that don't exist
> (this is exactly why the config was gated).

### Step B — Apply D1 migrations for cf-admin (madagascar-db, remote)

Purpose: creates the outbox table (Step A's pipeline writes to it) and the config
version column (enables exact optimistic concurrency in the control plane).

1. From the `cf-admin-madagascar` repo root:

   ```bash
   npx wrangler d1 migrations list madagascar-db --remote
   npx wrangler d1 migrations apply madagascar-db --remote
   ```

   The list should show `0033` and `0034` pending. (cf-admin has no `db:migrate`
   npm script — use wrangler directly; the migrations folder is the default
   `migrations/`.)

2. What gets applied:

   - `0033_create_sync_outbox.sql` — `sync_outbox` table: durable record of failed
     publishes (`status` pending → done/dead, `attempts`, `last_error`,
     `content_hash`). Powers the Step A redrive + a future DLQ admin view.
   - `0034_service_config_version.sql` — adds `service_config.version` (INTEGER,
     backfills to 1). Activates per-row version bumps, the `SUM(version)` change
     token, and `If-Match` 409 protection on `PATCH /api/control-plane/config`.

3. Verify:

   ```bash
   npx wrangler d1 execute madagascar-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_outbox';"
   npx wrangler d1 execute madagascar-db --remote --command "SELECT config_key, version FROM service_config LIMIT 3;"
   ```

   The first returns `sync_outbox`; the second returns rows with `version = 1`.

### Step C — Apply D1 migrations for cf-astro (same database, separate migration set)

Purpose: makes failed booking-email queue sends retryable by the cf-admin
reconciler cron (until then a `queue_error` is recorded but never retried).

1. From the `cf-astro` repo root:

   ```bash
   npm run db:migrate:remote
   ```

   This runs `wrangler d1 migrations apply madagascar-db --remote` with
   cf-astro's `migrations_dir = "db/migrations"`.

2. What gets applied:

   - `0008_booking_attempts_email_retry.sql` — adds `email_payload` (JSON) +
     `retry_count` to `booking_attempts`, plus a `(status, updated_at)` index for
     the reconciler scan.

3. Verify:

   ```bash
   npx wrangler d1 execute madagascar-db --remote --command "SELECT name FROM pragma_table_info('booking_attempts') WHERE name IN ('email_payload','retry_count');"
   ```

> ℹ Both repos apply migrations to the **same** D1 database (`madagascar-db`,
> `7fca2a07-d7b4-449d-b446-408f9187d3ca`). Wrangler tracks each repo's files
> separately by filename in the `d1_migrations` table, so Steps B and C don't
> conflict and can be run in either order.

### Step D — Dashboard tasks (no CLI, ~5 min total)

1. **Rotate `BETTERSTACK_SOURCE_TOKEN`** — it currently returns 401, so all
   worker logs are silently dropped, which blinds sync observability.
   Better Stack → Sources → (the cf-astro/cf-admin source) → rotate/copy the
   token, then update the secret in **both** workers:

   ```bash
   npx wrangler secret put BETTERSTACK_SOURCE_TOKEN
   ```

   Run that in each repo root. Verify: trigger any page view / admin action and
   confirm logs arrive in Better Stack.

2. **Enable Supabase leaked-password protection** — Supabase dashboard → project
   `zlvmrepvypucvbyfbpjj` → Authentication → Settings → enable
   "Leaked password protection". (Flagged by the Supabase security advisor.)

### Step E — End-to-end durability check (after A + B)

1. Save a CMS block in the Content Studio → response shows
   `revalidated: true, verified: true`.
2. Confirm the outbox is empty or all-done:

   ```bash
   npx wrangler d1 execute madagascar-db --remote --command "SELECT status, COUNT(*) AS n FROM sync_outbox GROUP BY status;"
   ```

3. Optional failure drill: temporarily set a wrong `REVALIDATION_SECRET` on
   cf-admin, save a block (publish fails → outbox row `pending`), restore the
   correct secret, and watch the queue consumer flip the row to `done` on its
   retry — that is the durability guarantee working.

Once **all steps are done**, delete this PENDING OPS section — the permanent
documentation lives in `documentation/reference/SYNC-SYSTEM-REVIEW.md` (§7
implementation log).

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
- ✅ Enforce **3-layer defense-in-depth** on Supabase: zero table grants + zero RLS policies + zero function ACLs for `anon`
- ✅ **Fail-secure** dev mode detection — missing `SITE_URL` defaults to production mode, never bypasses auth

**Every architectural decision optimizes for: maximum security + maximum quality + exactly ZERO ongoing cost.**

---

## 1. PROJECT IDENTITY

| Property | Value |
|----------|-------|
| **Name** | cf-admin (Madagascar Pet Hotel — Admin Portal) |
| **Purpose** | Cloudflare-native admin portal equivalent to admin-app |
| **Framework** | Astro 6.3.7 with `@astrojs/cloudflare` adapter (`^13.5.4`) |
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
| **Domain** | `secure.madagascarhotelags.com` (`SITE_URL` wrangler.toml var) |
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

→ See [SECURITY.md](./documentation/security/SECURITY.md) for the full security architecture.

## 2. RELATIONSHIP TO OTHER PROJECTS

| Project | Role | Relationship |
|---------|------|-------------|
| **cf-astro** | Main customer-facing website | Shares Supabase project, D1 database, R2 bucket. Uses Hyperdrive for direct PG (booking, ARCO) |
| **cf-chatbot** | Cloudflare Workers AI Bot | Operates autonomously on Edge natively interacting with WhatsApp/Web. `cf-admin` serves as its secure configuration proxy and analytics Dashboard. |
| **admin-app** | Legacy admin portal (Next.js) | Reference for UX/features only — **NEVER copy code** |
| **nextjs-app** | Legacy main site (Next.js) | Reference only — no code sharing |

### Shared Resources

- **Supabase Project:** `zlvmrepvypucvbyfbpjj` (same PostgreSQL instance)
- **D1 Database:** `madagascar-db` (ID: `7fca2a07-d7b4-449d-b446-408f9187d3ca`) — shared between both projects
- **R2 Bucket:** `madagascar-images` → `cdn.madagascarhotelags.com` (CMS images, shared read/write)
- **Analytics Engine:** `ANALYTICS` binding → dataset `madagascar_analytics` (shared, both projects)
- **Queue:** `EMAIL_QUEUE` → `madagascar-emails` (async email dispatch)
- **Cloudflare Account:** Mascotas Madagascar (ID: `320d1ebab5143958d2acd481ea465f52`)

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

→ See [USER-MANAGEMENT.md](./documentation/features/USER-MANAGEMENT.md) for the full RBAC hierarchy, user lifecycle, ghost protection, and hidden accounts.

---

## 4. INFRASTRUCTURE FREE TIER LIMITS

→ See [OPERATIONS.md](./documentation/operations/OPERATIONS.md) for Cloudflare binding IDs, free tier quotas, and the pre-flight deploy checklist.

---

## 7. TECHNOLOGY STACK

> 🛡️ **THE WHITELIST ARCHITECTURE POLICY:** We employ a strict "whitelisting" approach to technology additions. Anything not explicitly listed in this document is considered **BLACKLISTED** by default to protect our <50KB "Lean Edge" budget. If an AI agent or developer wishes to introduce a new library (e.g., React 19, Recharts, shadcn/ui, Hono), it must be explicitly proposed with a strong "why it's needed" justification. The new dependency can ONLY be used if the USER explicitly approves the proposal.

### 7.1 Framework: Astro 6.0+ (Full SSR for Admin)

- `output: 'server'` — ALL routes are server-rendered (auth check required)
- Cloudflare adapter with native binding access
- Astro Sessions API backed by Cloudflare KV for session persistence
- No static pages — admin portal has zero public content

### 7.2 UI: Preact Islands

- Preact 10.29.0 for all interactive components — React-compatible, no React overhead
- Islands hydrate with `client:load` (immediate) or `client:idle` (deferred)
- Cross-island state via `@preact/signals` (`^2.9.0`); no global event bus needed at current scale

### 7.3 Approved Dependency Whitelist

All packages below are **explicitly approved**. Anything NOT listed here is blacklisted by default.

| Package | Version | Purpose |
|---------|---------|---------|
| `preact` | `^10.29.0` | UI islands |
| `@preact/signals` | `^2.9.0` | Cross-island reactive state |
| `lucide-preact` | `^1.7.0` | Icon library (Preact-native, no extra weight) |
| `zod` | `^4.4.1` | Runtime schema validation in API routes |
| `@upstash/ratelimit` | `^2.0.8` | Edge-compatible rate limiting |
| `@upstash/redis` | `^1.37.0` | Redis client for Upstash |
| `@supabase/supabase-js` | `^2.101.1` | Supabase client (service_role only) |
| `@sentry/astro` | `^10.51.0` | Error tracking (build-time integration) |
| `@sentry/cloudflare` | `^10.51.0` | Error tracking (Workers runtime, V8 workerd only) |
| `@tailwindcss/vite` | `^4.2.2` | Tailwind CSS v4 via Vite plugin |

> **Icon usage:** Always import from `lucide-preact` (NOT `lucide-react`). The package is Preact-native — importing from the wrong package will cause hydration mismatches.

### 7.6 Environment Variables

```
# .dev.vars (local — gitignored)
# Secrets (not in wrangler.toml)
SUPABASE_SERVICE_ROLE_KEY=...         # DB operations only (no GoTrue auth)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
REVALIDATION_SECRET=...
CLOUDFLARE_API_TOKEN=...              # Read-only analytics token
CLOUDFLARE_ZONE_ID=...
CF_API_TOKEN_READ_LOGS=...            # Zero Trust Audit Read — cron log polling
CF_API_TOKEN_ZT_WRITE=...            # Zero Trust Session Revoke — Layer 3 force-kick
RESEND_API_KEY=...
SENTRY_AUTH_TOKEN=...
IP_HASH_SECRET=...
CHATBOT_WORKER_URL=https://charlar.madagascarhotelags.com
CHATBOT_ADMIN_API_KEY=...

# REMOVED: PUBLIC_SUPABASE_ANON_KEY, TURNSTILE_SECRET_KEY (no longer used)
```

> **Note — wrangler.toml `[vars]` entries (NOT .dev.vars secrets):** `PUBLIC_SUPABASE_URL`, `SITE_URL` (`https://secure.madagascarhotelags.com`), `CF_TEAM_NAME` (`mascotas`), `CF_ACCESS_AUD` (audience tag), `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_R2_BUCKET_NAME`, `CF_QUEUE_NAME`, `LOCAL_DEV_ADMIN_EMAIL` (`[DEVELOPER_EMAIL]`), `PUBLIC_ASTRO_URL`, `PUBLIC_CDN_URL`. These are non-secret config values; do **not** put them in `.dev.vars` or treat them as secrets.

Secrets in production: `wrangler secret put <KEY>` — see [OPERATIONS.md §5](./documentation/operations/OPERATIONS.md) for the full registry.

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

→ See [CODING-STANDARDS.md](./documentation/reference/coding-standards.md) for the full code quality and architecture standards.

---

## 9. SECURITY RULES

### Security Invariants (v4.5)

1. **Supabase `anon` role has ZERO access** — no table grants, no RLS policies, no function EXECUTE privileges.
2. **Default privileges locked** — `ALTER DEFAULT PRIVILEGES` prevents future tables from auto-granting to `anon`.
3. **All 3 apps use `service_role` or direct PG** — `cf-admin` and `cf-chatbot` use `SUPABASE_SERVICE_ROLE_KEY`; `cf-astro` uses `DATABASE_URL` via Drizzle.
4. **Fail-secure dev detection** — `isLocalDev()` returns `false` unless `SITE_URL` explicitly contains a local dev domain.
5. **6 functions hardened** — EXECUTE revoked from `anon`, `authenticated`, and `PUBLIC` on all public schema functions; `search_path` pinned.

→ See [SECURITY.md](./documentation/security/SECURITY.md) for the full security architecture, CSRF, cookie policy, RLS matrix, defense-in-depth, and Ghost Protection.

---

## 10. DESIGN SYSTEM — "MIDNIGHT SLATE"

The dashboard uses a unified premium dark UI with Blue-500 primary accents, 5-level surface elevation, OKLCH color tokens, and component-scoped CSS. Both dark and light themes are fully supported.

→ See [DESIGN-SYSTEM.md](./documentation/reference/DESIGN-SYSTEM.md) for design tokens, login portal spec, sidebar mechanics, component patterns, animation, accessibility, and responsive layout.

---

## 11. DYNAMIC CMS & ISR ARCHITECTURE (cf-admin ↔ cf-astro)

cf-admin securely mutates content for cf-astro via a 2-tier KV injection pipeline that bypasses D1 read-replica lag. All revalidation uses `revalidateAstro(env, basePaths, cmsData?)` with 3× exponential backoff.

→ See [CMS.md](./documentation/features/CMS.md) for the full ISR architecture, KV injection strategy, upload flow, and configuration constraints.

---

## 12. DEPLOYMENT RULES

### Build & Deploy

```bash
# Development
npm run dev              # Local dev (wrangler dev)
npm run cf:dev           # Full CF runtime with R2 simulation (required for image uploads)

# Type & Dependency Check
astro check              # TypeScript validation
npx knip                 # Static analysis (must be 100% clean - no unused exports/files)

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

→ See [OPERATIONS.md](./documentation/operations/OPERATIONS.md) for binding IDs, secrets checklist, and deploy verification steps.

---

## 13. DOCUMENTATION ARCHITECTURE

| File | Purpose |
|------|---------|
| `RULESAd.md` | This file — operational rules and quick-reference pointers |
| `README.md` | Quick start guide for developers |
| `main.md` | AI entry pointer into `documentation/` |
| `AI_CODE_MAINTENANCE.md` | AI agent maintenance guidelines |
| `GITHUB_RULES.md` | Git workflow rules |
| `documentation/` | All detailed technical documentation (governed tree — see [`documentation/README.md`](./documentation/README.md)) |

> **Single source of truth for the doc map:** [`documentation/README.md`](./documentation/README.md)
> is the authoritative, always-current index (CI enforces index ↔ filesystem
> parity). Naming and front-matter rules live in
> [`documentation/CONTRIBUTING-DOCS.md`](./documentation/CONTRIBUTING-DOCS.md).

### Documentation Folder Structure

```
documentation/
├── README.md                 # Doc index & map (start here)
├── CONTRIBUTING-DOCS.md      # Naming, front-matter, folder governance
├── MAINTENANCE.md            # Single live backlog of open items
├── _templates/               # Canonical doc template
├── architecture/             # ARCHITECTURE.md, KV-RESILIENCE.md, plac-and-audit.md
├── security/                 # SECURITY.md, PRIVACY.md, login-forensics.md
│   └── reviews/              # Dated security/SSL audit snapshots (historical)
├── features/                 # DASHBOARD, USER-MANAGEMENT, CMS, CHATBOT, CONTROL-PLANE(+CONNECTORS)
├── operations/               # OPERATIONS.md (binding IDs/secrets/deploy), DEV-TOOLS.md
├── reference/                # coding-standards.md, DESIGN-SYSTEM.md, control-plane-design/
├── specs/                    # Dated design specs
├── runbooks/                 # Operational error playbooks (e.g. ssr-silent-blank-screen.md)
└── archive/                  # Superseded status/tracking docs (kept verbatim)
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

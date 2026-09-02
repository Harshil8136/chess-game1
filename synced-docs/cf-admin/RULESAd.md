# CF-ADMIN PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Version: v5.0 · Last Updated: 2026-08-13** — documentation truth pass. This
> one version number governs the whole file; per-section version tags have been
> removed, because they had drifted to four different values (header v4.9, §9.0
> "v4.8", §9.1 "v4.5", root `README.md` "v4.7") and a reader had no way to tell
> which was current.
>
> **v5.0 changes:** the env-var and table counts reconciled to one figure each,
> with the query that reproduces them (they read 40/41 and 62/63 in three places
> in this file); stack versions corrected to Astro 7; `public/_headers` no longer
> described as deleted; §8.1 now separates the file-size *intent* from what
> ESLint enforces; §9.0 gate status re-derived; §15 relabelled direct-spend and
> pointed at the costed model; §17 email providers settled against both repos;
> RULE #0.7's `npm run db:check` and `d1 migrations apply` instructions replaced
> with commands that work. Full context:
> [`documentation/MAINTENANCE.md`](./documentation/MAINTENANCE.md).
>
> Change history lives in git — this header records the current version and the
> reason for it, not a running changelog.

> **Research Sources:** Cloudflare Docs MCP, Supabase MCP, Cloudflare Bindings MCP, Official Documentation

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

## 🛡️ RULE #0.6 — REUSE BEFORE CREATION (D1/Supabase/KV/services)

**Before creating a new D1 table, a new Supabase table, a new KV namespace, or integrating a new external service, three questions must be answered, in order — see [`documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](./documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md) for the full live audit and reasoning this rule is based on.**

This exists because the pattern has already recurred: `service_config` → `admin_portal_settings` → `admin_feature_flags` are three separate, never-consolidated mechanisms for the same general idea, and a live audit on 2026-08-06 found two confirmed-dead Supabase tables (`admin_sessions`, `privacy_requests`) that existed only because nobody checked for an existing fit before adding the next one.

> **Hard cap, not a guideline.** The counts that define these caps live in
> **RULE #0.8** (env vars) and **RULE #0.9** (tables) below — this rule does not
> restate them, because restating them is exactly how they drifted: until
> 2026-08-13 this paragraph said "40 env vars / 62 tables", #0.8 said "41", and
> #0.9 said "63", all in the same file. A new environment variable or a new
> database table is the **last option on the table**, proposed only after every
> reuse path below has been checked and genuinely doesn't fit — never the first
> thing reached for.

1. **Does something that already exists cover this?** Check [`documentation/reference/coding-standards.md`](./documentation/reference/coding-standards.md) §8 (config tables — `admin_portal_settings` covers most global/per-role/per-user config needs already), the audit doc's live table inventory, and a grep of `src/` for related repository/table names.
2. **If nothing existing fits, does a free, open-source, or already-integrated service solve this better than bespoke infrastructure?** This project already has active connectors for Cloudflare, Supabase, Sentry, and PostHog — evaluate honestly per-case (the audit doc has three worked examples: adopt PostHog for feature flags needing real targeting; don't adopt a hosted ReBAC/graph-auth engine for permissions this project doesn't need yet; don't adopt a third-party config SaaS for system settings that already have a home in D1).
3. **If new infrastructure is genuinely the right call, say why in one line in the PR/commit.** That's the entire mechanism that prevents this list from needing a fourth entry.

- ❌ **FORBIDDEN:** Creating a new table/namespace/service integration without first checking for an existing one that already fits.
- ✅ **ALLOWED, and expected:** Creating new infrastructure when the check comes back negative — this rule is about checking first, not about never building anything new.

---

## 🛡️ RULE #0.7 — SCHEMA CHANGE LEDGER (3 ARTIFACTS PER CHANGE)

**Every schema change requires 3 artifacts:**

1. **Schema TS/DDL** — the `CREATE`/`ALTER` statement itself, in a new file under `migrations/` (D1) or `supabase/migrations/` (Supabase).
2. **Applied migration** — for D1, apply through Wrangler's migration runner:
   `npx wrangler d1 migrations apply madagascar-db --local` (dev) and
   `npx wrangler d1 migrations apply madagascar-db --remote` (production).
   > **Corrected 2026-09-02.** This rule previously said "do NOT use
   > `wrangler d1 migrations apply` on `madagascar-db`" because the database's
   > `d1_migrations` table "tracks cf-astro's history". A live query of that
   > table (86 rows) shows it is keyed on **filename** and holds both repos'
   > files interleaved — every one of this repo's 29 `migrations/*.sql` files
   > is recorded there, applied by exactly this command. The runner is the
   > mechanism in use; `main.md` RULE #0.7b and `README.md` already said so.
   > What the filename key does imply: **never rename an applied migration file**
   > (the runner would re-apply it) and never reuse a number the other repo
   > owns (RULE #0.7b). Supabase changes use the Supabase migration tooling as
   > normal.
3. **Applied ledger entry** — one row in [`documentation/reference/schema-change-ledger.md`](./documentation/reference/schema-change-ledger.md) recording the migration file, date applied, who/what applied it, and a one-line description.

**Verify the change landed** by querying the live schema — there is no
`npm run db:check` script in `package.json` (this rule asked for one for months;
it never existed):

```bash
wrangler d1 execute madagascar-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

> **Status note (2026-08-12):** artifact 3 (the ledger) did not exist anywhere in this
> repo until today — this rule referenced it while nothing implemented it, unlike
> RULE #0.6/#0.9 below, which point at the real, live
> `documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`. The ledger
> is now a real, lightweight doc, seeded with one example row; it is **not** backfilled
> for migrations applied before this date — treat it as an ongoing practice starting
> now, not a complete history.

---

## 🛡️ RULE #0.8 — ENV VAR CAP & DYNAMIC CONFIG FIRST (HARD STOP, WE ARE NOT ADDING MORE)

cf-admin's production Worker carries **40 env entries** (15 `[vars]` + 25 secrets),
live-counted on 2026-09-02 with the two commands below. The platform limit is
**64 per Worker on Workers Free** (128 on Paid) — this rule's cap is a *policy*
choice about where configuration belongs, not a platform ceiling, and it used
to be stated as if it were one. Re-derive with:

```bash
grep -c '^[A-Z_]* = ' wrangler.toml   # the [vars] block (15)
wrangler secret list                   # the authoritative secret count (25)
```

Since viability program chunk 2 the 24 secrets the Worker *requires* are
declared in `wrangler.toml` under `[secrets] required`: `wrangler deploy`
refuses when one is missing, and `worker-configuration.d.ts` (generated by
`npm run types`, verified in CI by `npm run types:check`) is the type every
`env.X` access is checked against — there is no index signature any more. The
25th secret, `RESEND_WEBHOOK_API`, has no reader and is scheduled for removal.
`GSC_SERVICE_ACCOUNT_JSON` and `PAGESPEED_API_KEY` remain the documented
exceptions to this rule (bootstrap-time external credentials with no
dynamic-config alternative, see
[`documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](./documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md)).

This is a hard cap, not a soft target. Do NOT introduce new environment variables
(`env.VAR_NAME`, `.dev.vars`, or `wrangler.toml` `[vars]`/bindings) for feature toggles,
limits, or operational settings. All application toggles, operational thresholds, and
non-secret runtime configs MUST be managed dynamically via D1 —
`admin_portal_settings`, through `src/lib/dal/PortalSettingsRepository.ts` — the pattern
every recent feature (Staff Managed Storage, Blog AI, Control Plane connectors) has
already followed. *Corrected 2026-08-23:* this rule also named a `CONFIG_KV` binding as
an alternative. No such binding exists — `wrangler.toml` declares exactly one KV
namespace, `SESSION`, and `CONFIG_KV` appears nowhere in `src/`. D1 is the mechanism.

A new env var is the **last option on the table, not the first** — propose
one only after showing every dynamic-config route was checked and genuinely doesn't
fit (e.g. a bootstrap-time platform credential needed before any D1/KV read is
possible), and say why in the PR/commit. Even then it requires explicit architectural
signoff.

---

## 🛡️ RULE #0.9 — MIGRATION-MINIMAL DATA DESIGN & SCHEMA REUSE (HARD STOP, WE ARE NOT ADDING MORE)

The live production estate is **63 tables** across all three apps, re-counted
against the live databases on 2026-08-13:

| Store | Tables | How counted |
|---|---:|---|
| D1 `madagascar-db` [cf-admin + cf-astro] | 30 | `sqlite_master` query below |
| D1 `chatbot-kb` [cf-chatbot] | 9 | same |
| D1 `whatsapp-chatbot` [cf-chatbot] | 4 | same |
| Supabase `public` [cf-admin + cf-astro] | 20 | Supabase MCP `list_tables` |
| **Total** | **63** | |

```sql
-- Run per D1 database; excludes SQLite/D1 internal bookkeeping tables.
SELECT COUNT(*) FROM sqlite_master
 WHERE type='table' AND name NOT LIKE 'sqlite_%'
   AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%';
```

> The 2026-08-12 breakdown recorded 31 D1 / 19 Supabase. The **total was right**
> and the split was wrong; the live query above is now the derivation, so the
> next reader can re-check it in one command instead of trusting the number.
> A second Supabase project (`supabase-pink-village`, 37 tables) belongs to the
> retired `admin-app` and is deliberately **excluded** — see RULE #0.

See [`documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](./documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md)
for the per-table inventory and reuse analysis.
Do NOT create new D1/Supabase tables or write migration scripts when an existing table
can fulfill the requirement. Leverage key-value repositories, generic config columns,
or structured JSON/JSONB payload fields in active tables (`admin_portal_settings`,
`cms_content`, `service_config`, etc.) to store feature state — Staff Managed Storage
(2026-08-05) is the reference case: 1 new table shipped instead of the 6 originally
planned. A new table is the **last option on the table, not the first** — a proposed
schema migration MUST formally prove why existing infrastructure cannot house the data
model without structural changes before it's written, not after.

---

## PROJECT MISSION — SECURE ADMIN PORTAL, $0 INFRASTRUCTURE

**cf-admin is a production-ready, commercial-grade administrative portal built entirely on FREE tier services.** Designed to:

- ✅ Manage content, bookings, users, and site settings via secure dashboard
- ✅ Enforce multi-level RBAC (`vendor_support` > `owner` > `admin` > `manager` > `staff` > `viewer`) on every route — 6-tier hierarchy, renamed 2026-07-27; see [USER-MANAGEMENT.md](./documentation/features/USER-MANAGEMENT.md) and [plac-and-audit.md](./documentation/architecture/plac-and-audit.md) §1
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
| **Framework** | Astro 7.1.6 with `@astrojs/cloudflare` adapter (`^14.1.7`), `@astrojs/preact` `^6.0.2` |
| **Rendering** | Full SSR (`output: 'server'`) — every route requires auth |
| **UI Islands** | Preact (3KB, React-compatible) for interactive components |
| **Hosting** | Cloudflare Workers |
| **Auth** | Cloudflare Zero Trust Access (Google / GitHub / OTP — CF edge identity) |
| **Database** | Supabase PostgreSQL (shared project `[SUPABASE_PROJECT_REF]`) |
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

- **Content-Security-Policy (CSP):** Nonce-based `script-src` — `'self' 'nonce-<per-request>'` + a small host allowlist (Sentry, CF Insights, jsDelivr, Google Accounts). `'unsafe-eval'` is forbidden and absent (SEC-01, no exemptions). `'unsafe-inline'` is **still present on the enforcing policy**; a `Content-Security-Policy-Report-Only` canary ships the hardened directive without it, pinned by SEC-01b, and is promoted once it reports clean (blocked on operator verification of Cloudflare Rocket Loader — see MAINTENANCE.md). `'strict-dynamic'` is off for the same reason. `style-src` still uses `'unsafe-inline'` — Preact hydration and Astro scoped styles require it. Also sets COOP, CORP and `X-Robots-Tag`. ⚠️ `public/_headers` **still exists** (this line previously said it had been deleted) and its CSP has drifted — it still carries `'unsafe-eval'`. Whether Workers Static Assets now serves it is unresolved; see `documentation/MAINTENANCE.md` → C-12. Until that closes, `src/lib/security/csp.ts` is the only file to read for the live policy.
- **X-Frame-Options: DENY** (Blocks Clickjacking)
- **X-Content-Type-Options: nosniff** (Prevents MIME-sniffing)
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Strict-Transport-Security: max-age=63072000; includeSubDomains; preload** (2 years; set in `src/lib/security/csp.ts:78` — corrected 2026-07-29, previously documented here as `31536000`)

→ See [SECURITY.md](./documentation/security/SECURITY.md) for the full security architecture.

## 2. RELATIONSHIP TO OTHER PROJECTS

| Project | Role | Relationship |
|---------|------|-------------|
| **cf-astro** | Main customer-facing website | Shares Supabase project, D1 database, R2 bucket. Uses Hyperdrive for direct PG (booking, ARCO) |
| **cf-chatbot** | Cloudflare Workers AI Bot | Operates autonomously on Edge natively interacting with WhatsApp/Web. `cf-admin` serves as its secure configuration proxy and analytics Dashboard. |
| **admin-app** | Legacy admin portal (Next.js) | Reference for UX/features only — **NEVER copy code** |
| **nextjs-app** | Legacy main site (Next.js) | Reference only — no code sharing |

### Shared Resources

- **Supabase Project:** `[SUPABASE_PROJECT_REF]` (same PostgreSQL instance)
- **D1 Database:** `madagascar-db` (ID: `[D1_MADAGASCAR_DB_ID]`) — shared between both projects
- **R2 Bucket:** `madagascar-images` → `cdn.madagascarhotelags.com` (CMS images, shared read/write)
- **Analytics Engine:** `ANALYTICS` binding → dataset `madagascar_analytics` (shared, both projects)
- **Queue:** `EMAIL_QUEUE` → `madagascar-emails` (async email dispatch)
- **Cloudflare Account:** Mascotas Madagascar (ID: `[CF_ACCOUNT_ID]`)

### KV Namespaces (Isolated per project)

| Namespace | ID | Project | Purpose |
|-----------|-----|---------|---------|
| `cf-admin-session` | `[KV_ADMIN_SESSION_ID]` | cf-admin | Astro session store |
| `cf-astro-session` | `[KV_ASTRO_SESSION_ID]` | cf-astro | Astro session store |
| `cf-astro-isr-cache` | `[KV_ISR_CACHE_ID]` | cf-astro | ISR HTML cache |

> ✅ **SESSION KV IDs VERIFIED:** The `cf-admin-session` (`ba82...`) and `cf-astro-session` (`bee1...`) IDs are verified against the LIVE environment.

### Isolation Rules

- Admin tables use `admin_` prefix to avoid collision with cf-astro tables
- cf-admin has its own KV namespace for sessions (`cf-admin-session`, separate from cf-astro)
- cf-admin has its own Worker deployment (not shared with cf-astro)
- Each project has its own `wrangler.toml`, `.dev.vars`, and deployment pipeline

---

## 3. RBAC — ROLE-BASED ACCESS CONTROL

**Current model (renamed 2026-07-27):** a 6-tier ladder, lower number = higher privilege —
`vendor_support(0) > owner(1) > admin(2) > manager(3) > staff(4) > viewer(5)`. The database
still stores the pre-rename values (`dev`, `owner`, `super_admin`, `admin`, `staff`) and
`normalizeRole()`/`toStoredRole()` translate at the D1/Supabase boundary — see
`plac-and-audit.md` §1.2 for the full translation table and the collision warning
(`super_admin`→`admin` and `admin`→`manager` means a bare stored `"admin"` is ambiguous
without translation).

→ See [USER-MANAGEMENT.md](./documentation/features/USER-MANAGEMENT.md) for the full RBAC hierarchy, user lifecycle, ghost protection, and hidden accounts.
→ See [plac-and-audit.md](./documentation/architecture/plac-and-audit.md) for the canonical role table, helper functions, and PLAC resolution algorithm.

---

## 4. INFRASTRUCTURE FREE TIER LIMITS

→ See [OPERATIONS.md](./documentation/operations/OPERATIONS.md) for Cloudflare binding IDs, free tier quotas, and the pre-flight deploy checklist.

---

## 7. TECHNOLOGY STACK

> 🛡️ **THE WHITELIST ARCHITECTURE POLICY:** We employ a strict "whitelisting" approach to technology additions. Anything not explicitly listed in this document is considered **BLACKLISTED** by default to protect our <50KB "Lean Edge" budget. If an AI agent or developer wishes to introduce a new library (e.g., React 19, Recharts, shadcn/ui, Hono), it must be explicitly proposed with a strong "why it's needed" justification. The new dependency can ONLY be used if the USER explicitly approves the proposal.

### 7.1 Framework: Astro 7.x (Full SSR for Admin)

- `output: 'server'` — ALL routes are server-rendered (auth check required)
- Cloudflare adapter with native binding access
- Astro Sessions API backed by Cloudflare KV for session persistence
- No static pages — admin portal has zero public content
- ❌ **FORBIDDEN:** `export const prerender = true` on ANY page under `src/pages/dashboard/**`
  - Reason: Pre-rendering a dashboard page means Astro builds it as a static file served directly
    from the Cloudflare edge cache, **bypassing the auth middleware entirely**. This strips
    `Astro.locals.user`, `Astro.locals.cspNonce`, and the PLAC access check — making the page
    unauthenticated and breaking CSP nonce injection. Use `prerender = false` (or omit the export).
  - **Enforcement:** `eslint.config.js` contains a `no-restricted-syntax` rule that hard-errors on this.

### 7.2 UI: Preact Islands

- Preact 10.29.7 for all interactive components — React-compatible, no React overhead
- Islands hydrate with `client:load` (immediate) or `client:idle` (deferred)
- Cross-island state via `@preact/signals` (pinned `2.10.0`); no global event bus needed at current scale

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

> **Note — wrangler.toml `[vars]` entries (NOT .dev.vars secrets):** `PUBLIC_SUPABASE_URL`, `SITE_URL` (`https://secure.madagascarhotelags.com`), `CF_TEAM_NAME` (`mascotas`), `CF_ACCESS_AUD` (audience tag), `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_R2_BUCKET_NAME`, `CF_QUEUE_NAME`, `LOCAL_DEV_ADMIN_EMAIL` (`[OWNER_PERSONAL_EMAIL]`), `PUBLIC_ASTRO_URL`, `PUBLIC_CDN_URL`. These are non-secret config values; do **not** put them in `.dev.vars` or treat them as secrets.

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
4. **Data Access Layer (DAL):** Never write raw D1 SQL queries directly inside `.astro` frontmatter. All data fetching must go through Repository classes (e.g., `PortalSettingsRepository.ts`, one of the 18 in `src/lib/dal/`) to ensure separation of concerns, security, and testability. Pass the fetched static initial state to Preact islands as props.

### 7.8 Modals, Dialogs & The "Squished Card" Bug — MANDATORY READING

> 🔴 **READ THIS ENTIRE SECTION before building ANY modal, dialog, popup, overlay, empty-state card, or full-screen panel inside a Preact island.**

There are **FOUR** separate CSS bugs that can squish modals/dialogs/cards inside Preact islands. Each has a different root cause. You must defend against ALL four simultaneously.

---

#### Bug #1: The `<astro-island>` Inline Display Bug

**Root Cause:** Astro wraps every `client:load` / `client:idle` component in a custom `<astro-island>` element. Browsers default custom elements to `display: inline`, which causes block children (`w-full`, flexbox containers) to shrink-wrap to their text content width (~100-200px).

**Our Global Fix:** We apply `astro-island, astro-slot { display: contents; }` in `global.css` (line ~168). This removes the `<astro-island>` from the layout tree, so its children inherit the parent's full width. This fix is already in place — **do NOT re-apply it or add redundant overrides.**

---

#### Bug #2: The `overflow` Containing-Block Trap

**Root Cause:** `.admin-main-content` has `overflow-y: auto` (in `AdminLayout.css`), which creates a new CSS **containing block** for `position: fixed` descendants. Any `<div className="fixed inset-0 ...">` overlay rendered inside this scroll container will be **clipped to the scroll container's bounds**, not the viewport. It may appear to work on large screens but will break on smaller viewports or deeply nested components.

**Why `<dialog open>` DOES NOT fix this:** The declarative `<dialog open>` attribute simply makes the dialog visible in-place (like `display: block`). It does **NOT** use the browser's Top Layer. The element stays trapped inside the scroll container's containing block.

**The ONLY reliable fix:** Use `dialog.showModal()` (imperative JavaScript), which promotes the `<dialog>` element into the browser's **Top Layer** — a rendering layer that sits above ALL other content, ignoring ALL containing blocks, overflow clips, stacking contexts, and z-index hierarchies.

---

#### Bug #3: Tailwind v4 `@layer` vs Browser UA Specificity (The Silent Width Killer)

**Root Cause:** The browser's User-Agent stylesheet sets `width: fit-content` on `<dialog>` elements. In Tailwind CSS v4, utility classes are placed inside `@layer utilities`, which has **lower cascade priority** than unlayered UA defaults. This means Tailwind classes like `w-full`, `max-w-2xl`, etc. applied via `className` on a `<dialog>` element **silently lose the specificity battle** to the browser's `width: fit-content`, causing the dialog to shrink-wrap to its content width.

**The fix:** Use **inline `style={{ }}` attributes** for ALL layout-critical properties on the `<dialog>` element itself. Inline styles have the highest CSS specificity and always beat UA defaults.

---

#### Bug #4: Flexbox Auto-Margin Min-Content Collapse (The Vertical Text Wrapping Trap)

**Root Cause:** In CSS Flexbox (W3C CSS Flexible Box Layout Module Level 1 §8.1), when a parent container uses `flex flex-col items-center` (`align-items: center`), cross-axis alignment calculates free space BEFORE flex item sizing. If a direct flex child element (e.g. `<p>` or `<div>`) has `max-w-md` (`max-width: 28rem`) combined with `mx-auto` (`margin-left: auto; margin-right: auto;`), the browser flexbox engine distributes all horizontal space to the auto margins first. This forces the child element's width box to collapse down to its intrinsic **`min-content` width** — which is the width of the single longest word in the text (e.g. *"generate"* or *"toolbar"*). As a result, every single word in the paragraph is forced to wrap onto its own vertical line!

**The fix:** NEVER place `max-w-*` and `mx-auto` directly on text `<p>` elements that are direct children of a `flex-col items-center` container. Always wrap empty-state text elements in a dedicated block container with explicit inline width styling:
`<div style={{ width: '100%', maxWidth: '448px', margin: '0 auto', textAlign: 'center' }}>`.

---

#### ✅ THE CORRECT PATTERN (MANDATORY)

Every modal/dialog in a Preact island **MUST** follow this exact pattern. Reference implementations: `ConfirmDialog.tsx`, `InviteUserModal.tsx`, `TemplatesPanel.tsx`.

```tsx
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

function MyModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open: ALWAYS use showModal() — NEVER use <dialog open> or toggle className
  const openDialog = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  // Close: ALWAYS use .close()
  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // Handle native Escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => { e.preventDefault(); closeDialog(); };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [closeDialog]);

  // Click-outside (backdrop click)
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === dialogRef.current) closeDialog();
  };

  return (
    <>
      {/* Backdrop styling — MUST use unique ID selector */}
      <style>{`
        #myModalId::backdrop {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
      `}</style>

      {/* DIALOG — inline style is MANDATORY for width/maxWidth/padding/margin */}
      <dialog
        id="myModalId"
        ref={dialogRef}
        onClick={handleBackdropClick}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          padding: 0,
          margin: 'auto',
          width: '100%',
          maxWidth: '672px',   // Adjust per use case
          zIndex: 99999,
          outline: 'none',
        }}
      >
        {/* Inner visual container — Tailwind classes are safe HERE */}
        <div
          className="bg-[var(--theme-surface)] border border-[var(--theme-border-subtle)] w-full rounded-2xl shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal content goes here */}
        </div>
      </dialog>
    </>
  );
}
```

#### 🚫 BANNED PATTERNS (Will cause squished modals or vertical text collapse)

| ❌ BANNED | Why It Fails |
|-----------|-------------|
| `<dialog open className="w-full max-w-2xl">` | `open` attr = no Top Layer; Tailwind `w-full` loses to UA `fit-content` |
| `<dialog open className="fixed inset-0">` | Same: not in Top Layer, trapped in scroll container |
| `<div className="fixed inset-0 z-50">` as overlay | Trapped by `overflow-y: auto` containing block |
| `className="w-full"` on `<dialog>` | Tailwind v4 `@layer` loses to UA specificity |
| `<p className="w-full max-w-md mx-auto">` inside `flex flex-col items-center` | Flexbox auto-margins absorb cross-axis space, forcing text box to `min-content` width (every word wraps vertically) |
| `setIsOpen(true)` + conditional `{isOpen && <div>...}` | No Top Layer escape, no native focus trap |

#### ✅ REQUIRED CHECKLIST (Before merging any modal)

- [ ] Uses `<dialog>` element (not a `<div>`)
- [ ] Opens via `dialogRef.current?.showModal()` (not `<dialog open>`)
- [ ] Closes via `dialogRef.current?.close()` (not DOM removal)
- [ ] Width/maxWidth set via **inline `style={{ }}`** (not Tailwind className)
- [ ] Has `::backdrop` styling via `<style>` tag with unique ID
- [ ] Handles `cancel` event (Escape key)
- [ ] Handles backdrop click (`e.target === dialogRef.current`)
- [ ] Inner content div uses `onClick={e => e.stopPropagation()}`

> ⚠️ **CRITICAL DEV WORKFLOW:** If you change a component's architecture from `.tsx` to `.astro` to fix layout bugs, Vite's Hot Module Replacement (HMR) will often cache the old ghost `.tsx` component in memory. **You MUST instruct the user to kill and restart the dev server (`npm run dev`) and hard-refresh the browser for the structural fix to appear.**

---

## 8. CODE QUALITY RULES & ARCHITECTURAL GUARDRAILS

### 8.1 File Size & Complexity Limits (Anti-Bloat)

To keep the architecture lightweight and fast, `cf-admin` aims at strict file
size limits. **Read this section as intent plus current enforcement — they are
not the same thing, and this section used to state only the intent as if it were
the enforcement.**

**Intent:** ~200 lines for components (`coding-standards.md`), 500 as the outer
bound for any file. If a file grows past that, extract logic into modules
(routing constants, security headers, sub-components) rather than disabling the
rule.

**What `eslint.config.js` actually enforces today (verified 2026-08-13):**

| Scope | Rule | Effect |
|---|---|---|
| All `.ts`/`.tsx`/`.astro` | `'max-lines': 'off'` | **Nothing is enforced.** Marked `TEMP` pending the god-file split pass; slated to return as `error` in phase 12. |
| 4 named files (`auth/session.ts`, `auth/pipeline.ts`, `users/sessions/*.tsx`, `InquiriesDashboard.tsx`) | `['warn', { max: 600 }]` | Warning only |
| `src/pages/dashboard/**/*.astro` | `no-restricted-syntax` on `export const prerender = true` | **Hard error** — this one is real |

The same gap exists for `any`: `coding-standards.md` forbids it outright while
`@typescript-eslint/no-explicit-any` is set to `'warn'`. `npm run lint` reports
**444** such warnings (2026-08-13) — count them with
`npx eslint . -f json` rather than by grepping, which undercounts generics and
type arguments. Do not cite either limit as enforced until the rule is flipped
back on.

`npm run lint` currently exits clean with **0 errors, 445 warnings**: the 444
above plus **1 `max-lines`** — `src/lib/auth/pipeline.ts` is at 608 lines against
its own 600-line exception. That exception's comment in `eslint.config.js` still
describes the file as 517 lines.

→ See [CODING-STANDARDS.md](./documentation/reference/coding-standards.md) for the full code quality and architecture standards.

---

## 9. SECURITY RULES

### 9.0 Enforced Compliance Rules (code-anchored, CI-blocking)

Every rule below is **mechanically enforced** by `scripts/rules_check.py` and
wired into `.github/workflows/security.yml`. A PR that violates any rule fails
CI. Rules are one-line-per-file grep guards; they anchor to real code, not
prose.

Compliance mappings link to the OWASP ASVS v4.0.3 matrix in
`documentation/security/compliance/ASVS-L2.md`.

| ID | Rule | Anchor | CI guard | Compliance |
|----|------|--------|----------|------------|
| SEC-01 | `script-src` MUST NOT contain `'unsafe-eval'` — **no exemptions** | `src/lib/security/csp.ts` (`SCRIPT_SRC_ENFORCING`) | `rules_check.py::SEC-01` | ASVS 14.4.3 |
| SEC-01b | The Report-Only canary `script-src` MUST stay free of `'unsafe-inline'`/`'unsafe-eval'` | `src/lib/security/csp.ts` (`SCRIPT_SRC_CANARY`) | `rules_check.py::SEC-01b` | ASVS 14.4.3 |
| SEC-02 | All cookies MUST be `SameSite=Strict` (never `Lax`) | any `SameSite=` in `src/**` | `rules_check.py::SEC-02` | ASVS 3.4.3 |
| SEC-03 | API handlers MUST use a DAL repository (`src/lib/dal/*`), never raw `env.DB.prepare(...)` | `src/pages/api/**/*.ts` | `rules_check.py::SEC-03` | ASVS 5.3.4 |
| SEC-04 | Use `isAdmin()` / `isSuperAdmin()` helpers (`src/lib/auth/rbac.ts`), never hardcoded role arrays | `src/pages/api/**/*.ts` | `rules_check.py::SEC-04` | ASVS 4.1.3 |
| SEC-05 | Workers runtime has no `process.env` — use `getEnv(context)` from `src/lib/env.ts` | `src/**/*.{ts,tsx,astro}` | `rules_check.py::SEC-05` | ASVS 14.1.1 |
| SEC-06 | Every API handler MUST gate on `requireAuth()`, `placDenyResponse()`, or `locals.user` — no unauthenticated endpoints outside `PUBLIC_API_ROUTES` / `WEBHOOK_ROUTES` | `src/pages/api/**/*.ts` | `rules_check.py::SEC-06` | ASVS 4.1.1 |
| SEC-07 | Every `/api/*` route MUST resolve via `resolveApiAuthz()` — `API_PAGE_MAPPING` prefix or an explicit `PUBLIC_API_*`/`WEBHOOK` allowlist. Default-deny is enforced at runtime by `API_DENY_MODE` | `src/lib/auth/routes.ts`, `src/pages/api/**/*.ts` | `rules_check.py::SEC-07` ✅ implemented 2026-07-25 | ASVS 4.1.5 |
| SEC-08 | `dangerouslySetInnerHTML` MUST receive pre-sanitized content only (`sanitizeHtml`, `escapeHtml`, template literal) | `src/**/*.{ts,tsx,astro}` | `rules_check.py::SEC-08` | ASVS 5.2.6 |
| SEC-09 | Every table with `ENABLE ROW LEVEL SECURITY` MUST also declare at least one `CREATE POLICY` in the same migration | `supabase/migrations/**/*.sql` | `rules_check.py::SEC-09` | ASVS 5.3.4 |
| SEC-10 | Use Web Crypto `crypto.subtle.digest(...)`, never Node's `crypto.createHash(...)` | `src/**/*.{ts,tsx}` | `rules_check.py::SEC-10` | ASVS 6.2.1 |

**Roll-out policy:** New rules ship in `--warn-only` mode for ~1 week
(prints violations, exits 0) so existing tech-debt can burn down without
blocking merges. Once the tree is clean for a given rule, remove `--warn-only`
in `.github/workflows/security.yml`.

**Status (verified 2026-08-13): `rules_check.py` is BLOCKING** — 11 rules,
0 violations. `a11y_check.py` is also blocking — 6 rules over 254 files,
0 findings.

> **This line is a snapshot, not a guarantee — re-run before citing it.** On
> 2026-08-13 it read "0 violations" while the tree actually had 5 (SEC-03 ×4 in
> the new Search Console routes, SEC-08 ×1) and `a11y_check.py` had 7, so
> `npm run verify` was red while three documents said it was green. The SEC-03
> debt this section calls "fully burned down" was reintroduced by the very next
> feature; it has since been re-fixed by moving the queries into
> `src/lib/dal/GscIndexLogRepository.ts`. A burn-down is a state, not a
> milestone.

> ⚠️ **An exemption that is disabled by the condition it detects is worse than
> no rule.** SEC-01 previously carried `exempt_line=r"unsafe-eval"`, rationalised
> as sparing a local-dev branch that did not exist. Because the repo has exactly
> one `script-src` — the production one — that exemption swallowed the only line
> the rule guarded, and *adding* `'unsafe-eval'` is what silenced the
> `'unsafe-inline'` beside it. The guard reported "0 violations" against a CSP
> with both. When adding an exemption, first prove the rule still fails without
> it: every rule in this table now has a negative test.

**Accessibility rules (A11Y-01…06)** live in `scripts/a11y_check.py` and run in
`.github/workflows/quality.yml`, currently `--warn-only` — see
`documentation/security/compliance/ACCESSIBILITY.md`.

### 9.1 Security Invariants (historical — superseded by §9.0)

1. **Supabase `anon` role has ZERO access** — no table grants, no RLS policies, no function EXECUTE privileges.
2. **Default privileges locked** — `ALTER DEFAULT PRIVILEGES` prevents future tables from auto-granting to `anon`.
3. **All 3 apps use `service_role` or direct PG** — `cf-admin` and `cf-chatbot` use `SUPABASE_SERVICE_ROLE_KEY`; `cf-astro` uses `DATABASE_URL` via Drizzle.
4. **Fail-secure dev detection** — `isLocalDev()` returns `false` unless `SITE_URL` explicitly contains a local dev domain.
5. **6 functions hardened** — EXECUTE revoked from `anon`, `authenticated`, and `PUBLIC` on all public schema functions; `search_path` pinned.

→ See [SECURITY.md](./documentation/security/SECURITY.md) for the full security architecture, CSRF, cookie policy, RLS matrix, defense-in-depth, and Ghost Protection.
→ See [ASVS-L2.md](./documentation/security/compliance/ASVS-L2.md) for the full OWASP ASVS v4.0.3 Level 2 verification matrix.

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
npm run typecheck        # astro check — TypeScript validation
npm run lint             # ESLint
npm run knip             # Dead-code sweep. NOT clean today (see MAINTENANCE.md
                         # C-15) — knip.json has no `entry` config, so it cannot
                         # see Astro's file-based routes and reports ~34 "unused"
                         # files that are really pages. Read its output; do not
                         # treat a non-zero exit as a blocking failure yet.

# The full gate — run this before any commit (see "Git & deployment protocol")
npm run verify           # typecheck → lint → tests → rules_check → docs_check
                         #   → a11y_check → audit_gate

# Build & Deploy
astro build && wrangler deploy   # Build + deploy to Cloudflare
```

### Git & deployment protocol

This is the authoritative statement of the deploy protocol for this repo. It
absorbs the rules previously kept in a monorepo-root git-rules file, which is
not part of this repository and is no longer referenced anywhere — the repo is
now standalone, so a pointer outside it can never resolve.

- **Verify the working directory before every push** — `git remote -v` must show
  this repo. Pushing cf-admin changes from a sibling checkout is the single
  easiest way to deploy the wrong Worker.
- **Push directly to `origin main`.** There is no pull-request gate and no branch
  protection; `main` auto-deploys **through Cloudflare Workers Builds** (the
  dashboard-side GitHub connection — no workflow in `.github/` runs
  `wrangler deploy`). The quality/security workflows run on the same push but
  do not gate that deploy today; making the Builds build/deploy commands run
  verify → migrate → deploy is the viability program's chunk 3
  (`documentation/program/ROADMAP.md`). Compliance docs record this honestly as a
  machine approval rather than a second pair of human eyes — see
  [`documentation/security/compliance/SOC2-TSC-mapping.md`](./documentation/security/compliance/SOC2-TSC-mapping.md)
  CC8.1. (An agent working on an assigned feature branch follows its own
  instructions and pushes there instead.)
- **Run `npm run verify` before every push.** CI re-runs the same gates on `main`,
  so a failure that slips through is visible immediately after deploy, not before.

#### §6 — Binding IDs are never invented

[`documentation/operations/OPERATIONS.md`](./documentation/operations/OPERATIONS.md)
§1 is the **single source of truth for production bindings** (D1/KV/R2 IDs, queue
names, service bindings). Never hand-edit or guess a binding UUID: a wrong ID
**fails silently** rather than erroring, and did cause a real CMS outage in April
2026. Read the value from `wrangler.toml` or the Cloudflare dashboard, and update
the registry in the same change. Docs elsewhere cite this rule as "§6".

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
├── reference/                # coding-standards.md, DESIGN-SYSTEM.md, control-plane-design/ (VISUAL-OVERHAUL-PLAN only)
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

## 15. DIRECT INFRASTRUCTURE SPEND — ~$0.50/month

> **This is direct spend on this one deployment, not cost-to-serve.** The two
> were being quoted interchangeably: this section said "$0.00", `OPERATIONS.md`
> §8 said "~$0.50", and the commercial analysis says **~$30–36/client/month**
> fully loaded. All three were "right" about different things, which made every
> one of them misleading on its own.
>
> - **Direct spend (this table):** what leaves the bank account today, with
>   everything on a free tier.
> - **Cost-to-serve (the number for any commercial conversation):**
>   [`documentation/2026-07-26-commercial-model-costing-pricing-and-scale.md`](./documentation/2026-07-26-commercial-model-costing-pricing-and-scale.md)
>   owns it, including the paid tiers a real client deployment needs and the
>   operational time that is 60–70% of it. **Never quote this table to a client.**

| Service | What We Use | Monthly Cost |
|---------|------------|-------------|
| Cloudflare Workers | Hosting + SSR | **$0** |
| Cloudflare KV | Session storage & ISR Cache | **$0** |
| Cloudflare D1 | Operational data & CMS content | **$0** |
| Cloudflare R2 | CMS image storage (10GB free) | **$0** |
| Cloudflare Queues | Async email delivery | **$0** |
| Supabase | Auth + PostgreSQL (shared) | **$0** |
| Upstash | Redis (rate limiting) | **$0** |
| Cloudflare Workers AI | Blog generation + RAG | **$0** (free tier) |
| GitHub | Source control | **$0** |
| Anthropic (Claude Haiku fallback) | Chatbot fallback only | ~$0.01–0.50 |
| | **TOTAL, direct spend** | **~$0.50** |

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
- **Consumer:** A standalone Cloudflare Worker (`cf-email-consumer`) consumes the queue batches, processes HTML templates using **Eta** (a lightweight Edge-native framework), and calls the provider REST API out of band of the user request. Bloated Node.js SDKs (like `resend` and React Email) are strictly forbidden in the consumer worker.
- **Providers — Brevo primary, Resend failover.** Verified 2026-08-13 by grepping both repos for send endpoints:
  - `cf-admin` sends **exclusively via Brevo** (`https://api.brevo.com/v3/smtp/email`) — security alerts, retention notices, storage notifications, GSC ops alerts. There is **no** `api.resend.com` call anywhere in `cf-admin/src/`.
  - `cf-email-consumer` calls Brevo first and falls back to `https://api.resend.com/emails`.
  - The `resend_id` column and `resend_*` field names in `email_audit_logs` are **legacy names retained for schema stability**, not evidence of an active Resend path. Do not infer the provider from a column name.
  > Four documents previously gave four different answers here (Resend-only, split-by-role, Brevo-primary-with-failover, and Brevo-only). This bullet is the reconciled version; if it disagrees with another doc, this one was re-derived from code.
- **Audit Logs:** All email payloads, transmission statuses, and provider webhook delivery events are chronologically mapped in the Supabase PostgreSQL table `email_audit_logs`. This table relies exclusively on `service_role` edge requests and has Row Level Security (RLS) entirely locking out public access.
  - **Referential Integrity:** The `booking_id` foreign key constraint enforces `ON DELETE CASCADE`, ensuring that atomic "Hard Wipes" of bookings cleanly and automatically purge associated audit records without referential blocking errors.

> 📎 **Full detailed documentation and Webhook setup guide:** See [`../cf-email-consumer/README.md`](../cf-email-consumer/README.md).

---

*End of Rules. These constraints must be acknowledged and followed for every task in cf-admin.*

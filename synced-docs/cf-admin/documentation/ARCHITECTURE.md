{% raw %}
# CF-Admin Architecture

> **Status:** Production Active (v4.5)
> **Stack:** Astro 6.1.2 SSR + Cloudflare Workers (Free) + Preact 10.29.0 Islands + D1 + KV + R2 + Queues + Analytics Engine
> **Last Updated:** 2026-05-02 (v4.5: documentation audit; cfBotScore N/A confirmed)

---

## 1. Design Philosophy — "Lean Edge"

> **Build the simplest architecture that is genuinely production-grade. Defer enterprise complexity until scale demands it. Every millisecond of CPU and every kilobyte of JavaScript must justify its existence.**

### Core Architecture Decisions

| Component | Approach | CPU Cost | JS Bundle |
|-----------|----------|----------|-----------|
| RBAC + ACM | Hierarchical integers + route registry | <0.1ms | 0 KB |
| PLAC | KV-cached access maps + D1 overrides | <0.5ms | ~3 KB |
| SPA Navigation | Astro `ClientRouter` (View Transitions) | 0ms (browser-native) | 0 KB |
| CSS Architecture | Component-scoped + centralized tokens | 0ms | 0 KB |
| Security Headers | Edge-injected via middleware sequence | 0ms | 0 KB |
| Audit Logging | `ctx.waitUntil()` fire-and-forget D1 writes | 0ms (post-response) | 0 KB |
| API Caching | HTTP ETag + Cache-Control headers | 0ms | 0 KB |
| Island Communication | Preact Signals (`useApi()`, `<ToastProvider />`) | 0ms | ~1 KB |

---

## 2. The 5-Layer "Lean Edge" Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 5: EXTERNAL PROXY                          │
│  Astro API Gateway (/api/chatbot/*) → Cloudflare Worker AI Bot      │
├─────────────────────────────────────────────────────────────────────┤
│                    LAYER 4: OBSERVER                                │
│  Ghost Audit Engine (ctx.waitUntil → D1 admin_audit_log)            │
│  Post-response, zero-latency, fire-and-forget                       │
├─────────────────────────────────────────────────────────────────────┤
│                    LAYER 3: CACHE                                   │
│  HTTP ETag + Cache-Control headers on API responses                 │
│  KV hot cache for PLAC access maps + expensive queries              │
├─────────────────────────────────────────────────────────────────────┤
│                    LAYER 2: ACCESS CONTROL                          │
│  Hierarchical RBAC (rbac.ts) + Route ACM (registry.ts)              │
│  + Page-Level Access Control (PLAC) with KV-cached overrides        │
├─────────────────────────────────────────────────────────────────────┤
│                    LAYER 1: TRANSPORT                               │
│  Astro 6 SSR + ClientRouter + Preact Islands + Signals              │
│  Cloudflare Workers → D1 / KV / R2 / Queues / Analytics Engine     │
│  (Hyperdrive: DISABLED — free tier; Observability: logs + traces ✅) │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Request Lifecycle

```
Browser Request → CF Zero Trust Edge (CF_Authorization cookie validation)
    │
    ▼  CF injects: CF-Access-Authenticated-User-Email + CF-Access-JWT-Assertion headers
    │
    ▼
┌── MIDDLEWARE (middleware.ts) ──────────────────────────────────────┐
│  1. Is route public? (/privacy, /terms) → PASS (GET/HEAD only)     │
│  2. CSRF check on mutations (Origin/Referer vs SITE_URL)            │
│  3. Read KV session by cookie                                        │
│                                                                      │
│  ── KV session FOUND (fast path) ──────────────────────────────── │
│  3a. createdAt > 24h? → destroySession() → 401 (hard expiry)       │
│  3b. lastRoleCheckedAt > 30min? → re-fetch role from D1             │
│      · is_active=false → destroySession() + 3-layer kick → 401     │
│      · role changed → update session + re-compute PLAC map          │
│      · unchanged → update lastRoleCheckedAt, continue              │
│  3c. Session valid → skip to PLAC check                             │
│                                                                      │
│  ── No KV session, CF-Access-JWT-Assertion header PRESENT ──────── │
│  4a. verifyZeroTrustJwt(jwt, CF_ACCESS_AUD) — RS256 signature       │
│  4b. Check KV revocation flag: revoked:{userId} → 403 if set       │
│  4c. Lookup email in admin_authorized_users (Supabase) → id, role   │
│  4d. Not whitelisted or is_active=false → 403                       │
│  4e. createSession({ userId, cfSubId, email, role, loginMethod })   │
│  4f. computeAccessMap() → embed PLAC in KV session                  │
│  4g. logLoginAttempt() + sendSecurityAlertEmail() via waitUntil()   │
│  4h. Write cf_sub_id to admin_authorized_users on first login        │
│      (idempotent — .is('cf_sub_id', null) guard)                    │
│                                                                      │
│  ── No KV session, no CF headers → 401 (defense-in-depth) ──────── │
│                                                                      │
│  5. PLAC check: role hierarchy + page overrides (O(1) hashmap)      │
│  6. Denied? → Redirect /dashboard?error=insufficient                │
│  7. Inject user + permissions into Astro.locals                     │
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
┌── PAGE RENDER (Astro SSR) ─────────────────────────────────────────┐
│  Data Access Layer (DAL) — Repository pattern, native D1            │
│  Render HTML + Preact island placeholders                           │
│  Set ETag + Cache-Control headers                                   │
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
┌── POST-RESPONSE (ctx.waitUntil) ───────────────────────────────────┐
│  Ghost Audit: log action to D1 admin_audit_log                      │
│  Runs AFTER response is sent — zero user latency                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## 4. Atomic Islands Pattern

All front-end code follows this composability hierarchy. **No monolith > 200 lines.**

| Level | Role | Rule |
|-------|------|------|
| **Atoms / Molecules** | Pure display subcomponents | `SidebarHeader.tsx`, `NavIcon.tsx` |
| **Organisms (Islands)** | Stateful wrappers importing Atoms | Mounted via `client:load` or `client:idle` |
| **Templates (Layouts)** | Raw HTML wrappers (`AdminLayout.astro`) | No reactive state |

---

## 5. Feature-Sliced Module Architecture

Each module is a self-contained unit: pages + components + API handlers. **Adding a module = create folder + add to `admin_pages` D1 table. Removing = delete folder + remove from table.**

```
src/
├── pages/dashboard/
│   ├── index.astro                    ← Dashboard home
│   ├── bookings/index.astro
│   ├── customers/index.astro
│   ├── pets/index.astro
│   ├── content/
│   │   ├── index.astro, gallery.astro, services.astro
│   │   ├── testimonials.astro, faq.astro, about.astro
│   ├── analytics/index.astro
│   ├── reports/index.astro
│   ├── logs/index.astro
│   ├── users/index.astro + [id]/access.astro
│   ├── settings/index.astro, email.astro, integrations.astro
│   ├── privacy/index.astro
│   ├── chatbot/index.astro (+ sub-tabs)
│   ├── debug/index.astro              ← DEV only
│   └── [...slug].astro                ← Spread Route / Soft 404
├── components/
│   ├── admin/
│   │   ├── bookings/
│   │   │   ├── BookingDashboard.tsx           ← booking list + search
│   │   │   ├── BookingSlideDrawer.tsx          ← thin orchestrator (~115 lines)
│   │   │   ├── types.ts                        ← BookingRow, BookingPet, BookingDetails, SERVICE_LABELS, PET_TYPE_ICONS
│   │   │   ├── BookingCustomerSection.tsx
│   │   │   ├── BookingPetSection.tsx
│   │   │   ├── BookingOperationsSection.tsx
│   │   │   ├── BookingAuditSection.tsx
│   │   │   └── BookingDangerZoneSection.tsx
│   │   ├── chatbot/
│   │   │   ├── BotConfig.tsx                  ← orchestrator (~200 lines)
│   │   │   ├── BotConfigShared.tsx            ← ConfigSection, Field, InfoIcon primitives
│   │   │   ├── BotConfigThinkingSection.tsx   ← ThinkingConfig interface + component
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   ├── ConversationsBrowser.tsx
│   │   │   ├── KnowledgeBase.tsx
│   │   │   └── PromptsEditor.tsx
│   │   ├── users/
│   │   │   ├── UsersTable.tsx                 ← slim orchestrator
│   │   │   ├── roleColors.ts                  ← getRoleBorderHex, getRoleBgGrad, getRelativeTime, getInitials
│   │   │   ├── UserTableRow.tsx               ← SortIcon, UserAvatar, UserTableRow (desktop)
│   │   │   ├── UserCardStack.tsx              ← mobile card layout
│   │   │   └── atoms/                         ← pre-existing atom components
│   │   ├── logs/
│   │   │   ├── ActivityCenter.tsx             ← orchestrator (imports shared.tsx)
│   │   │   └── shared.tsx                     ← AuditLog, EmailLog, ConsentRecord, LoginLog, Stats, TabId, TABS, formatTimestamp, tryParseJSON, buildQueryString, JSONViewer, DetailPanel, TableFooter
│   │   ├── debug/
│   │   │   ├── PageRegistryManager.tsx        ← orchestrator (significantly reduced)
│   │   │   └── PageRegistryConfirmModal.tsx   ← extracted 150-line confirmation modal
│   │   ├── customers/, pets/, content/, analytics/
│   ├── navigation/                    ← Sidebar, TopBar
│   ├── dashboard/
│   │   └── widgets/
│   │       └── WidgetShared.tsx       ← CANONICAL: formatBytes, formatNumber, Dot, WarningDot, ModernCard, SkeletonBlock, DashboardSkeleton, EmptyState, TrendPill, etc.
│   └── ui/                            ← Toast, Modal, Skeleton, Badge, ErrorBoundary, SlideDrawer
├── pages/api/
│   ├── auth/, users/, content/, media/, bookings/, chatbot/
│   └── audit/, privacy/, diagnostics/
└── lib/
    ├── auth/                          ← RBAC, PLAC, sessions, guards
    ├── bookings/
    │   └── constants.ts               ← getServiceBadgeStyle() — canonical service badge colors
    ├── analytics/
    │   └── providers.ts               ← GraphQLResponse<T> interface; Cloudflare + Supabase analytics fetch
    │                                     Uses ANALYTICS binding (Analytics Engine dataset: `madagascar_analytics`)
    ├── env.ts                         ← Single source of truth for CF env bindings
    ├── audit.ts                       ← Ghost Audit Engine (table name whitelisted)
    ├── cms.ts                         ← revalidateAstro(), locale expansion (CmsBlock imported from shared-schema.ts)
    ├── formatters.ts                  ← formatDateTime(), formatDateShort() — shared date formatting
    ├── shared-schema.ts               ← CmsBlock interface (canonical), CmsContentType
    └── supabase.ts                    ← Supabase client factory (service_role only)
```

### The "Baseplate" Principle

The auth system (middleware + PLAC + registry) is the "Lego baseplate." It reads from `admin_pages` (D1) and enforces access for all modules without knowing what modules exist. New modules snap in without modifying the baseplate.

### Spread Route / Soft 404

`src/pages/dashboard/[...slug].astro` catches all unbuilt paths. Astro resolves exact physical paths first; this is a fallback. It renders a Midnight Slate "Module Under Construction" card within `AdminLayout` — sidebar and topbar persist, no SPA break.

---

## 6. Key Systems (Summary with Cross-References)

### RBAC + PLAC

5-tier role hierarchy (DEV → Owner → SuperAdmin → Admin → Staff) with per-user page-level overrides cached in KV for O(1) middleware checks. Deny always wins. Role changes auto-purge override history and force-logout all active sessions.

→ See [USER-MANAGEMENT.md](./USER-MANAGEMENT.md) for full RBAC hierarchy and user lifecycle
→ See [PLAC-AND-AUDIT.md](./PLAC-AND-AUDIT.md) for PLAC resolution algorithm, provisioning API, and Ghost Audit Engine

### Security

CSRF via Origin/Referer headers, `__Host-` cookie prefix, edge-injected HTTP headers (CSP, HSTS, X-Frame-Options), RLS policy matrix, Ghost Protection session sweeps.

→ See [SECURITY.md](./SECURITY.md)

### CMS & ISR

D1-backed headless CMS with 2-tier KV injection strategy to bypass D1 replica lag. All content changes propagate to cf-astro via ISR revalidation webhook + `cms:*` KV keys.

→ See [CMS.md](./CMS.md)

### Design System

"Midnight Slate" — Blue-500 accent, 5-level surface elevation, OKLCH color tokens, two-paradigm CSS (Tailwind utilities + component CSS), zero inline styles.

→ See [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)

### Data Access Layer (DAL)

Repository pattern in `src/lib/dal/`. Controllers (`.astro` / API routes) handle HTTP + auth only. Repositories handle all D1 SQL. Zero SQL in UI layers. Parameterized queries throughout.

→ See [CODING-STANDARDS.md](./CODING-STANDARDS.md) for DAL patterns and code conventions

### Chatbot

Workers AI (Qwen3-30B-A3B) → Claude Haiku 4.5 fallback → static. Proxy at `/api/chatbot/[...path].ts` with RBAC gating. All admin panels are Preact islands in `src/components/admin/chatbot/`.

→ See [CHATBOT.md](./CHATBOT.md)

---

## 7. CPU & Resource Budget

### Per-Request CPU (10ms limit)

```
Session KV read:    ~0.5ms
CF JWT verify:      ~1-2ms   ← RS256 — only on bootstrap (no active KV session)
PLAC KV read:       ~0.3ms   ← cached access map (~2KB JSON)
D1 role re-check:   ~2-3ms   ← every 30min only; 0ms on fast-path requests
Page access check:  ~0.1ms   ← O(1) hashmap lookup
SSR render:         ~3-5ms
D1 data query:      ~2-4ms
──────────────────────────
TOTAL:              ~6-10ms  ✅ (CF JWT verify adds cost only on first bootstrap)
```

### Daily Resource Budget

| Resource | Free Limit | Typical Daily Use |
|----------|-----------|-------------------|
| KV reads | 100K/day | ~75 writes @ 10 users |
| D1 writes | 100K/day | ~100-500 (audit logs + mutations) |
| KV writes | 1K/day | ~75 (sessions + PLAC cache) |
| Worker requests | 100K/day | Well within for admin portal |

---

## 8. Scale-Up Vault (Deferred Features)

These are architecturally sound but not needed until trigger conditions are met.

| Feature | Trigger Condition |
|---------|-------------------|
| **Bitmask entitlements** | >20 granular sub-feature permissions within one page |
| **IndexedDB + SWR + Web Crypto Vault** | 100+ concurrent users approaching D1 5M read/day, OR offline admin needed |
| **Custom Fragment Orchestration / MFE Loader** | 50+ pages AND initial JS exceeds 100KB despite Astro code splitting |
| **Global Event Bus** | 10+ islands on one page with complex cross-dependencies |

---

## 9. Infrastructure & Operations

### Cloudflare Bindings (cf-admin)

| Binding | Type | Name / UUID |
|---------|------|-------------|
| `DB` | D1 | `madagascar-db` (`7fca2a07-d7b4-449d-b446-408f9187d3ca`) |
| `SESSION` | KV | `ADMIN_SESSION` (`ba82eecc6f5a4956ad63178b203a268f`) |
| `IMAGES` | R2 | `madagascar-images` |
| `EMAIL_QUEUE` | Queue | `madagascar-emails` |
| `ANALYTICS` | Analytics Engine | dataset `madagascar_analytics` |

**Observability** — enabled in wrangler.toml: invocation logs + traces (both `true`). Available in Cloudflare dashboard → Workers → Logs.

**Bot Management score** (`request.cf.botManagementScore`) — NOT available on the free Workers plan. All production `cf_bot_score` rows are `null`. Gate implementation blocked until paid plan.

### Key Approved Packages

| Package | Version | Role |
|---------|---------|------|
| `preact` | `^10.29.0` | UI islands |
| `@preact/signals` | `^2.9.0` | Cross-island state |
| `lucide-preact` | `^1.7.0` | Icon library (Preact-native) |
| `zod` | `^4.4.1` | API route validation |
| `@upstash/ratelimit` | `^2.0.8` | Rate limiting |
| `@sentry/cloudflare` | `^10.51.0` | Error tracking (workerd-safe) |

→ See [OPERATIONS.md](./OPERATIONS.md) for Cloudflare binding IDs, free tier limits, Sentry integration, and deploy commands

{% endraw %}

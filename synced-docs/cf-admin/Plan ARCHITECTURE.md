# CF-ADMIN — PRODUCTION ARCHITECTURE PLAN

> **Version:** 3.5 (Sync Pipeline & Secret Standardization)  
> **Last Updated:** 2026-04-13  
> **Status:** APPROVED — Phase 1-6 Implemented, Phase A (Security), B (Performance), and C (Modularity) Applied  
> **Research Sources:** Perplexity Deep Research, Cloudflare Docs MCP, Codebase Audit  
> **Stack:** Astro 6 SSR + Cloudflare Workers (Free) + Preact Islands + D1 + KV + R2

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview — The "Lean Edge" Philosophy](#2-architecture-overview)
3. [PHASE 1 — RBAC + Declarative ACM (✅ IMPLEMENTED)](#3-phase-1--rbac--declarative-acm)
4. [PHASE 2 — Page-Level Access Control (PLAC) System (🔥 NEW)](#4-phase-2--page-level-access-control-plac)
5. [PHASE 3 — Astro View Transitions (SPA-Feel Navigation)](#5-phase-3--astro-view-transitions)
6. [PHASE 4 — Ghost Audit Engine (ctx.waitUntil Logging)](#6-phase-4--ghost-audit-engine)
7. [PHASE 5 — HTTP Caching & ETag Strategy](#7-phase-5--http-caching--etag-strategy)
8. [PHASE 6 — Preact Signals (Inter-Island Reactivity)](#8-phase-6--preact-signals)
9. [SCALE-UP VAULT — Enterprise Features (Deferred)](#9-scale-up-vault)
10. [Risk Analysis & CPU Budget](#10-risk-analysis--cpu-budget)
11. [File Map & Implementation Order](#11-file-map--implementation-order)

---

## 1. EXECUTIVE SUMMARY

This plan defines the **production architecture** for cf-admin — a secure, lightning-fast admin portal running on Cloudflare's $0 free tier. It was validated through deep research (Perplexity, Cloudflare Docs, industry analysis) against the original "Lego MFE" proposal.

### Design Philosophy: "Lean Edge"

> **Build the simplest architecture that is genuinely production-grade. Defer enterprise complexity until scale demands it. Every millisecond of CPU and every kilobyte of JavaScript must justify its existence.**

### What We Build NOW (6-10 pages, <10 users)

| Component | Approach | CPU Cost | JS Bundle |
|-----------|----------|----------|-----------|
| RBAC + ACM | ✅ Already implemented — hierarchical integers + route registry | <0.1ms | 0 KB |
| **Page-Level Access (PLAC)** | **KV-cached access maps + D1 overrides + Auto-reset on role change** | **<0.5ms** | **~3 KB** |
| **Module Manifest** | **Domain-grouped module silos (Customers, Pets, Analytics, Reports)** | **0ms (build-time)** | **0 KB** |
| SPA Navigation | Astro View Transitions API | 0ms (browser-native) | 0 KB |
| CSS Architecture | Modular CSS under 14KB (splits lazy-loaded locally per-component) | 0ms | 0 KB |
| Security | Native Astro 6 CSP nonces eliminating `unsafe-inline` with strict origin checks | 0ms | 0 KB |
| Audit Logging | ctx.waitUntil() fire-and-forget D1 writes | 0ms (post-response) | 0 KB |
| API Caching | HTTP ETag + Cache-Control headers | 0ms | 0 KB |
| Island Communication | Preact Signals (`useApi()`, global `<ToastProvider />`) | 0ms | ~1 KB |

### What We Defer (Scale-Up Vault — when 100+ users)

| Component | Why Deferred |
|-----------|-------------|
| Bitmask entitlements | Hierarchical RBAC + PLAC covers all needs at current scale |
| IndexedDB + Web Crypto vault | HTTP caching achieves "zero-invocation" without client JS |
| Custom fragment orchestration | View Transitions handles this natively |
| Global event bus | Preact Signals is simpler and type-safe |
| Full MFE registry + dynamic loader | Astro's build-time code splitting already handles this |

---

## 2. ARCHITECTURE OVERVIEW

### The 4-Layer "Lean Edge" Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 4: OBSERVER                            │
│  Ghost Audit Engine (ctx.waitUntil → D1 admin_audit_log)        │
│  Post-response, zero-latency, fire-and-forget                   │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 3: CACHE                               │
│  HTTP ETag + Cache-Control headers on API responses             │
│  KV hot cache for PLAC access maps + expensive queries          │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 2: ACCESS CONTROL                      │
│  Hierarchical RBAC (rbac.ts) + Route ACM (registry.ts)          │
│  + Page-Level Access Control (PLAC) with KV-cached overrides    │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 1: TRANSPORT                           │
│  Astro 6 SSR + ClientRouter + Preact Islands + Signals          │
│  Cloudflare Workers → D1 / KV / R2 (Hyperdrive: DISABLED)       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Architecture: "Atomic Islands"
To ensure "LEGO-like" composability and restrict large monolithic UI files, all front-end code strictly follows the **Atomic Islands Pattern**:
1. **Atoms & Molecules (.tsx / .astro):** Strictly display-layer subcomponents. E.g. `SidebarHeader.tsx`, `NavIcon.tsx`.
2. **Organisms (Islands):** Complex stateful wrappers that import Atoms. E.g. `SidebarMenu.tsx`. MUST be mounted via `client:load` or `client:idle`.
3. **Templates (Astro Layouts):** The raw HTML wrappers. No reactive state allowed.
4. **No Monoliths:** Any `.tsx` file crossing 200 lines must be evaluated for decomposition into smaller Atomic pieces.


### Request Lifecycle (Every Request)

```
Browser Request
    │
    ▼
┌── MIDDLEWARE (middleware.ts) ──────────────────────────────┐
│  1. Is route public? (/login, /auth/*) → PASS             │
│  2. Get session from KV (cookie → session:uuid)            │
│  3. Session expired? → Redirect to /                       │
│  4. Need JWT refresh? (30min interval) → Refresh tokens    │
│  5. Get PLAC access map from KV (plac:{userId})            │
│  6. Check access: role hierarchy + page overrides           │
│  7. Denied? → Redirect /dashboard?error=insufficient       │
│  8. Inject user + permissions into Astro.locals             │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌── PAGE RENDER (Astro SSR) ────────────────────────────────┐
│  Server-side data fetch (D1/Supabase via REST client)      │
│  Render HTML + Preact island placeholders                  │
│  Set ETag + Cache-Control headers                          │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌── POST-RESPONSE (ctx.waitUntil) ──────────────────────────┐
│  Ghost Audit: log action to D1 admin_audit_log             │
│  (Runs AFTER response is sent — zero user latency)         │
└────────────────────────────────────────────────────────────┘
```

---

## 3. PHASE 1 — RBAC + DECLARATIVE ACM (✅ IMPLEMENTED)

> **Status:** Already implemented and production-ready. No changes needed.

### 3.1 Current Implementation (Keep As-Is)

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/auth/rbac.ts` | Role hierarchy (DEV:0 > Owner:1 > SuperAdmin:2 > Admin:3 > Staff:4) | ✅ Complete |
| `src/lib/auth/registry.ts` | Declarative route → minimum role mapping (ACM) | ✅ Complete |
| `src/lib/auth/guard.ts` | Server-side auth gate with ACM + token refresh | ✅ Complete |
| `src/lib/auth/session.ts` | KV-backed sessions with 30min refresh + 24h expiry (env via centralized `env.ts`) | ✅ Complete |
| `src/middleware.ts` | Global auth gate on every non-public route | ✅ Complete |

### 3.2 Why This Is Already Optimal

The `hasPermission()` function uses a simple integer comparison:

```typescript
// rbac.ts — O(1), <0.01ms, zero allocations
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_LEVEL[userRole] <= ROLE_LEVEL[requiredRole];
}
```

**Research confirmed:** At 5 roles and ~20 routes, this integer hierarchy is identical in security to bitmask systems but with zero debugging complexity. Bitwise operations save ~0.9μs per check — irrelevant when D1 queries take 5-8ms.

### 3.3 Current Route Registry

```typescript
// registry.ts — Declarative ACM (longest-prefix matching)
export const ROUTE_REGISTRY: Record<string, RouteDefinition> = {
  '/dashboard/users':    { minRole: ROLES.SUPER_ADMIN },
  '/dashboard/settings': { minRole: ROLES.SUPER_ADMIN },
  '/dashboard/content':  { minRole: ROLES.ADMIN },
  '/dashboard':          { minRole: ROLES.STAFF },
};
```

This registry defines the **default baseline** for role-based access. PLAC (Phase 2) adds per-user overrides on top of this foundation.

---

## 4. PHASE 2 — PAGE-LEVEL ACCESS CONTROL (PLAC) SYSTEM (🔥 NEW)

> **Priority:** HIGH — This is the primary new feature.  
> **Research:** Validated via Perplexity against Clerk, WorkOS, and Oso patterns (2026).

### 4.1 What PLAC Does

PLAC enables **per-user, full-page access overrides** on top of hierarchical RBAC:

- A **DEV** can grant a Staff member access to `/dashboard/content` (normally Admin-only)
- A **SuperAdmin** can revoke an Admin's access to `/dashboard/settings`
- A **SuperAdmin** CANNOT grant access to pages they don't have access to
- A **SuperAdmin** CANNOT modify a DEV's access (hierarchy enforcement)
- **Deny always wins** — if an explicit deny override exists, role-based access is ignored
- All overrides are **auditable** — who granted/revoked, when, and for whom

### 4.2 Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Lightning fast** | KV-cached access maps — zero D1 queries per request |
| **Deny wins** | Explicit deny override trumps both role default and grant override |
| **Hierarchy-enforced** | API validates actor rank > target rank before any mutation |
| **Cannot grant upward** | Actor cannot grant access to pages they don't have access to |
| **Audit trail** | Every grant/revoke writes to `admin_audit_log` via ctx.waitUntil |
| **Cache invalidation** | Provisioning immediately deletes target user's KV cache |

### 4.3 Database Schema (D1)

```sql
-- ═══════════════════════════════════════════════════════════════
-- PLAC: Page-Level Access Control Tables
-- ═══════════════════════════════════════════════════════════════

-- Table 1: Page Registry (pre-populated with all dashboard pages)
-- This is the single source of truth for what pages exist and
-- their default minimum role requirement.
CREATE TABLE IF NOT EXISTS admin_pages (
  path TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'file',
  required_role TEXT NOT NULL CHECK (
    required_role IN ('dev', 'owner', 'super_admin', 'admin', 'staff')
  ),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Table 2: Per-User Page Access Overrides (junction table)
-- Normalized — NOT a JSON array in the user row.
-- Research confirmed: junction table enables indexed O(1) lookups,
-- hierarchy enforcement via granted_by, and clean provisioning queries.
CREATE TABLE IF NOT EXISTS admin_page_overrides (
  user_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  granted_by TEXT NOT NULL,
  granted_by_email TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, page_path)
);

-- Index for fast lookups by user (middleware cache rebuild)
CREATE INDEX IF NOT EXISTS idx_overrides_user 
  ON admin_page_overrides (user_id);

-- Index for fast lookups by grantor (audit: "what did this admin provision?")
CREATE INDEX IF NOT EXISTS idx_overrides_grantor 
  ON admin_page_overrides (granted_by);
```

**Seed data for admin_pages:**

```sql
INSERT OR IGNORE INTO admin_pages (path, label, icon, required_role, description, sort_order) VALUES
  -- ═══ CORE ═══
  ('/dashboard',              'Dashboard',         'layout-dashboard', 'staff',       'Home dashboard with KPIs and activity feed',        0),
  ('/dashboard/bookings',     'Bookings',          'calendar',         'staff',       'View and manage pet boarding reservations',          1),
  ('/dashboard/customers',    'Customers',         'contact',          'staff',       'Customer profiles and contact information',          2),
  ('/dashboard/pets',         'Pet Profiles',      'paw-print',        'staff',       'Pet records, breeds, medical notes',                 3),
  -- ═══ CONTENT MANAGEMENT ═══
  ('/dashboard/content',      'Content Studio',    'palette',          'admin',       'CMS hub for managing public site content',           4),
  ('/dashboard/content/hero', 'Hero Editor',       'image',            'admin',       'Hero background and headline management',            5),
  ('/dashboard/content/gallery','Gallery Manager', 'images',           'admin',       'Photo gallery drag-and-drop manager',                6),
  ('/dashboard/content/services','Services Editor','list-checks',      'admin',       'Service offerings and descriptions',                 7),
  ('/dashboard/content/pricing','Pricing Editor',  'badge-dollar-sign','admin',       'Pricing tables and package configuration',            8),
  ('/dashboard/content/testimonials','Testimonials','message-square',  'admin',       'Customer testimonials and reviews',                   9),
  ('/dashboard/content/faq',  'FAQ Editor',        'help-circle',      'admin',       'Frequently asked questions management',               10),
  ('/dashboard/content/about','About Page',        'info',             'admin',       'About page content and team information',             11),
  -- ═══ ANALYTICS & REPORTS ═══
  ('/dashboard/analytics',    'Analytics',         'bar-chart-3',      'admin',       'Traffic, engagement, and usage analytics',            12),
  ('/dashboard/reports',      'Reports',           'file-bar-chart',   'super_admin', 'Financial and operational reports',                   13),
  -- ═══ OPERATIONS ═══
  ('/dashboard/logs',         'Activity Logs',     'scroll-text',      'staff',       'Admin action audit trail and system logs',            14),
  -- ═══ ADMINISTRATION ═══
  ('/dashboard/users',        'User Management',   'users',            'super_admin', 'Admin user accounts, roles, and page access',        15),
  ('/dashboard/settings',     'Site Settings',     'settings',         'super_admin', 'General portal and site configuration',               16),
  ('/dashboard/settings/email','Email Templates',  'mail',             'super_admin', 'Email notification template management',              17),
  ('/dashboard/settings/integrations','Integrations','plug',           'super_admin', 'Third-party service connections',                     18),
  -- ═══ DEV TOOLS ═══
  ('/dashboard/debug',        'Debug Tools',       'bug',              'dev',         'Developer diagnostics, cache inspection, D1 viewer',  19);
```

### 4.4 Resolution Algorithm (The "Merge" Logic)

The access map is **precomputed at login and on provisioning changes**, then cached in KV. The middleware only reads from KV — zero D1 queries per request.

```
RESOLUTION RULE (per page, per user):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Check explicit override for this user + page:
   → If override exists AND granted = 0 (DENY):  ACCESS = FALSE  (deny ALWAYS wins)
   → If override exists AND granted = 1 (GRANT):  ACCESS = TRUE

2. If no override exists, fall back to role hierarchy:
   → ROLE_LEVEL[user.role] <= ROLE_LEVEL[page.required_role]
   → DEV(0) and Owner(1) can access everything
   → Staff(4) can only access Staff-level pages

RESULT: A flat Record<string, boolean> object cached in KV as plac:{userId}
```

**TypeScript implementation:**

```typescript
// src/lib/auth/plac.ts

import type { Role } from './rbac';
import { ROLE_LEVEL } from './rbac';

export interface PageAccessMap {
  /** Map of page path → boolean access. True = allowed, False = denied */
  pages: Record<string, boolean>;
  /** Unix ms timestamp of when this map was computed */
  computedAt: number;
  /** The user's role at time of computation (for staleness detection) */
  role: Role;
}

/**
 * Compute full access map for a user by merging role defaults + overrides.
 * Called at login and when a provisioning change targets this user.
 * 
 * Cost: 1 D1 query (batched JOIN), ~2ms. Cached in KV for 1 hour.
 */
export async function computeAccessMap(
  db: D1Database,
  userId: string,
  userRole: Role
): Promise<PageAccessMap> {
  // Single batched query: all pages LEFT JOIN user's overrides
  const result = await db.prepare(`
    SELECT 
      p.path,
      p.required_role,
      o.granted
    FROM admin_pages p
    LEFT JOIN admin_page_overrides o 
      ON o.user_id = ?1 AND o.page_path = p.path
    WHERE p.is_active = 1
    ORDER BY p.sort_order
  `).bind(userId).all<{
    path: string;
    required_role: Role;
    granted: number | null;
  }>();

  const pages: Record<string, boolean> = {};
  
  for (const row of result.results) {
    if (row.granted === 0) {
      // DENY override — always wins, regardless of role
      pages[row.path] = false;
    } else if (row.granted === 1) {
      // GRANT override — explicit access
      pages[row.path] = true;
    } else {
      // No override — fall back to role hierarchy
      pages[row.path] = ROLE_LEVEL[userRole] <= ROLE_LEVEL[row.required_role as Role];
    }
  }

  return {
    pages,
    computedAt: Date.now(),
    role: userRole,
  };
}

/**
 * Get access map from KV cache. Returns null on miss.
 * Key format: plac:{userId}
 * TTL: 3600s (1 hour)
 */
export async function getCachedAccessMap(
  kv: KVNamespace,
  userId: string
): Promise<PageAccessMap | null> {
  const raw = await kv.get(`plac:${userId}`, { type: 'json' });
  return raw as PageAccessMap | null;
}

/**
 * Write access map to KV cache.
 */
export async function cacheAccessMap(
  kv: KVNamespace,
  userId: string,
  map: PageAccessMap
): Promise<void> {
  await kv.put(`plac:${userId}`, JSON.stringify(map), {
    expirationTtl: 3600, // 1 hour
  });
}

/**
 * Invalidate a user's cached access map (called after provisioning changes).
 */
export async function invalidateAccessMap(
  kv: KVNamespace,
  userId: string
): Promise<void> {
  await kv.delete(`plac:${userId}`);
}

/**
 * Check if a user can access a specific page path.
 * Uses the cached access map (KV) — zero D1 queries.
 * Falls back to role hierarchy if path not in map.
 * 
 * Cost: <0.3ms (KV read + object lookup)
 */
export function checkPageAccess(
  accessMap: PageAccessMap,
  pathname: string
): boolean {
  // Exact match
  if (pathname in accessMap.pages) {
    return accessMap.pages[pathname];
  }
  
  // Prefix match (for sub-routes like /dashboard/content/gallery)
  const paths = Object.keys(accessMap.pages)
    .sort((a, b) => b.length - a.length);
  
  for (const registeredPath of paths) {
    if (pathname.startsWith(registeredPath + '/') || pathname === registeredPath) {
      return accessMap.pages[registeredPath];
    }
  }

  // Unknown page — deny by default
  return false;
}
```

### 4.5 Middleware Integration

The middleware is updated to check PLAC on every request:

```typescript
// Updated middleware.ts flow (pseudocode)

// After session validation...
const session = await getSession(context);

// 1. Get or compute PLAC access map
let accessMap = await getCachedAccessMap(env.SESSION, session.userId);

if (!accessMap || accessMap.role !== session.role) {
  // Cache miss or role changed — recompute from D1
  accessMap = await computeAccessMap(env.DB, session.userId, session.role);
  // Cache in background (don't block response)
  // NOTE: Astro 6 removed locals.runtime — use getCfContext() from env.ts
  const cfCtx = getCfContext(context);
  cfCtx?.waitUntil(cacheAccessMap(env.SESSION, session.userId, accessMap));
}

// 2. Check page access (O(1) hashmap lookup — <0.1ms)
if (!checkPageAccess(accessMap, pathname)) {
  return context.redirect('/dashboard?error=insufficient_permissions');
}

// 3. Inject into locals for downstream pages/islands
context.locals.user = { ...session, accessMap: accessMap.pages };
```

### 4.6 Provisioning API (Hierarchy-Enforcing)

```
POST /api/users/access
Content-Type: application/json

{
  "targetUserId": "uuid-xxx",
  "pagePath": "/dashboard/content",
  "action": "grant" | "revoke" | "reset",
  "reason": "Needed for content updates during Q2 campaign"
}
```

**Server-side hierarchy enforcement rules:**

```typescript
// src/pages/api/users/access.ts — Provisioning endpoint

// Rule 1: Actor must have higher role level than target
if (ROLE_LEVEL[actorRole] >= ROLE_LEVEL[targetRole]) {
  return error(403, 'Cannot modify access for users at or above your level');
}

// Rule 2: Actor must have access to the page they're granting
if (!checkPageAccess(actorAccessMap, pagePath)) {
  return error(403, 'Cannot grant access to pages you do not have access to');
}

// Rule 3: DEV and Owner users are "ghosts" — invisible to SuperAdmin and below
if ((targetRole === 'dev' || targetRole === 'owner') && actorRole !== 'dev') {
  return error(403, 'Cannot modify DEV/Owner user access');
}

// Rule 4: Cannot elevate target above their role's natural ceiling
// (e.g., granting a Staff user DEV-only pages would require DEV actor)
const pageDefinition = await getPageDefinition(db, pagePath);
if (ROLE_LEVEL[actorRole] > ROLE_LEVEL[pageDefinition.required_role]) {
  return error(403, 'Cannot grant access to pages above your clearance');
}
```

### 4.7 Auto-Reset on Role Change

When a user's role changes (e.g., Staff → Admin), their overrides are automatically cleared because a new role implies a new access baseline:

```typescript
// When role changes, reset all overrides and rebuild access map
async function onRoleChange(db: D1Database, kv: KVNamespace, userId: string, newRole: Role) {
  // 1. Delete all existing overrides for this user
  await db.prepare('DELETE FROM admin_page_overrides WHERE user_id = ?')
    .bind(userId).run();
  
  // 2. Invalidate cached access map (forces recompute on next request)
  await invalidateAccessMap(kv, userId);
  
  // 3. Audit the reset
  // (audit entry is logged by the caller via ctx.waitUntil)
}
```

### 4.8 UI: Page Access Manager (Preact Island)

**File:** `src/components/admin/users/PageAccessManager.tsx`

The UI renders a responsive toggle grid showing all pages with their access state for a target user. Built with Preact + Signals for reactive updates.

**Desktop Layout:** 2-column grid with page cards showing name, icon, current access, and toggle  
**Mobile Layout:** Full-width stacked cards with touch-friendly toggle switches  
**Tailwind v4 styling:** Midnight Slate tokens, glassmorphic cards, cyan accents

**Key UI behaviors:**
- Pages the actor cannot modify are shown **locked** (grayed out with lock icon)
- Override state is shown distinctly: "Role Default" vs "Explicit Grant" vs "Explicit Deny"
- Changes save immediately via optimistic UI (toggle flips instantly, API call in background)
- Toast notification confirms success or shows hierarchy violation error
- The "Reset" button removes the override and reverts to role default

```
┌─────────────────────────────────────────────────────────┐
│  🔐 Page Access for: Maria García (Admin)               │
│  ┌──────────────────────┐ ┌──────────────────────────┐  │
│  │ 📊 Dashboard         │ │ 📅 Bookings              │  │
│  │ ● Role Default       │ │ ● Role Default           │  │
│  │ [====ON====]         │ │ [====ON====]             │  │
│  └──────────────────────┘ └──────────────────────────┘  │
│  ┌──────────────────────┐ ┌──────────────────────────┐  │
│  │ 🎨 Content Studio    │ │ 📜 Activity Logs         │  │
│  │ ● Role Default       │ │ ● Role Default           │  │
│  │ [====ON====]         │ │ [====ON====]             │  │
│  └──────────────────────┘ └──────────────────────────┘  │
│  ┌──────────────────────┐ ┌──────────────────────────┐  │
│  │ 👥 User Management   │ │ ⚙️ Settings              │  │
│  │ 🔒 Above clearance   │ │ 🔒 Above clearance       │  │
│  │ [---LOCKED---]       │ │ [---LOCKED---]           │  │
│  └──────────────────────┘ └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.9 PLAC Performance Budget

| Operation | When | CPU Cost | D1 Queries |
|-----------|------|----------|------------|
| Access check (middleware) | Every request | <0.3ms (KV read + hashmap lookup) | 0 |
| Access map computation | Login + provisioning change | ~2ms | 1 (batched JOIN) |
| KV cache write | After computation | ~0.5ms | 0 |
| Provisioning API | On grant/revoke action | ~3ms | 2 (validate + upsert) |
| KV cache invalidation | After provisioning | ~0.2ms | 0 |

**Total middleware overhead per request: <0.5ms** (well within 10ms CPU limit)

---

## 5. PHASE 3 — ASTRO VIEW TRANSITIONS (SPA-FEEL NAVIGATION)

> **Status:** ✅ IMPLEMENTED — Using Astro 6's `ClientRouter` (renamed from `ViewTransitions`).

### 5.1 What It Does

Astro's native View Transitions API gives SPA-like instant page navigation without any custom JavaScript. Pages morph between states with cross-fade animations, and the browser handles DOM diffing automatically.

### 5.2 Implementation

**One line in the admin layout:**

```astro
---
// src/layouts/AdminLayout.astro
// Astro 6: ViewTransitions was renamed to ClientRouter
import { ClientRouter } from 'astro:transitions';
---
<html>
  <head>
    <ClientRouter />
  </head>
  <body>
    <!-- Sidebar, TopBar, Content -->
    <slot />
  </body>
</html>
```

### 5.3 Why This Replaces Custom Fragment Orchestration

| Aspect | Custom Fragments (Original Plan) | View Transitions (This Plan) |
|--------|--------------------------------|------------------------------|
| JavaScript needed | ~15-20 KB custom loader + DOM swap logic | 0 KB (browser-native) |
| Hydration risk | High — Preact islands can desync | Zero — Astro manages islands |
| Animation | Manual CSS transitions | Browser-native morphing |
| Prefetching | Manual `fetch()` calls | Automatic `<link rel="prefetch">` |
| SSR compatibility | Complex — must handle partial HTML | Built-in — designed for SSR |

### 5.4 Sidebar Navigation Enhancement

With View Transitions, sidebar links become instant:

```astro
<!-- Sidebar link with transition animation -->
<a href="/dashboard/content" 
   transition:name="main-content"
   class="sidebar-link">
  Content Studio
</a>
```

The main content area morphs between pages. The sidebar and topbar persist across navigations — true SPA feel with zero custom code.

---

## 6. PHASE 4 — GHOST AUDIT ENGINE (ctx.waitUntil LOGGING)

> **Status:** ✅ IMPLEMENTED — Critical for security and compliance. Active across PLAC, User Management, and CMS APIs.
> **Hardening (v3.1):** Audit factory `createAuditLogger()` now validates table names against `ALLOWED_AUDIT_TABLES` whitelist to prevent SQL injection via config surface expansion.

### 6.1 How It Works

The Ghost Audit Engine uses Cloudflare Workers' `ctx.waitUntil()` to log every admin action **after** the HTTP response is sent. The user sees instant feedback; the audit log writes happen in the background.

```
User clicks "Save" → API processes → Response sent → User sees "✅ Saved!"
                                                        │
                                              (connection closed)
                                                        │
                                              Worker stays alive ──→ D1 INSERT audit log
                                              (invisible to user)
```

### 6.2 D1 Audit Table

```sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  target_id TEXT,
  target_type TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user 
  ON admin_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_module 
  ON admin_audit_log (module, created_at DESC);
```

### 6.3 Audit Helper

```typescript
// src/lib/audit.ts

export interface AuditEntry {
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;      // 'create' | 'update' | 'delete' | 'login' | 'logout' | 'grant_access' | 'revoke_access'
  module: string;      // 'auth' | 'users' | 'content' | 'bookings' | 'settings' | 'plac'
  targetId?: string;
  targetType?: string;
  details?: string;
}

/**
 * Fire-and-forget audit log via ctx.waitUntil().
 * Runs AFTER the response is sent — zero user latency.
 * Uses D1 prepared statements to stay under 10ms CPU.
 */
export function auditLog(
  ctx: ExecutionContext,
  db: D1Database,
  entry: AuditEntry
): void {
  ctx.waitUntil(
    db.prepare(`
      INSERT INTO admin_audit_log 
        (user_id, user_email, user_role, action, module, target_id, target_type, details)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `).bind(
      entry.userId,
      entry.userEmail,
      entry.userRole,
      entry.action,
      entry.module,
      entry.targetId ?? null,
      entry.targetType ?? null,
      entry.details ?? null
    ).run()
  );
}
```

### 6.4 Usage in API Endpoints

```typescript
// Example: PLAC provisioning audit
auditLog(ctx, env.DB, {
  userId: actor.userId,
  userEmail: actor.email,
  userRole: actor.role,
  action: 'grant_access',
  module: 'plac',
  targetId: targetUserId,
  targetType: 'user',
  details: JSON.stringify({ page: pagePath, reason })
});
```

### 6.5 Audit Performance

| Metric | Value |
|--------|-------|
| User-perceived latency added | **0ms** (post-response) |
| D1 writes consumed per action | 1 row |
| Daily budget (100K writes) | ~100,000 admin actions/day |
| Storage per log entry | ~200 bytes |
| 1 year of logs @ 100 actions/day | ~7 MB (well within 5GB D1 limit) |

### 6.6 DEV-Only Log Pruning

Audit logs are immutable — no user (including SuperAdmin) can delete them. Only DEV-level users can trigger a purge via a protected endpoint:

```
POST /api/audit/prune (DEV only)
→ Archives logs older than 6 months to R2 as compressed JSON
→ Deletes archived rows from D1
→ Logs the prune action itself to the audit log
```

---

## 7. PHASE 5 — HTTP CACHING & ETAG STRATEGY

> **Status:** ✅ IMPLEMENTED — Optimization reduces D1 reads on repeated API calls via 304 Not Modified responses.

### 7.1 How It Replaces IndexedDB + SWR

Instead of building a client-side IndexedDB vault with Web Crypto encryption (100+ KB of JavaScript), we use standard HTTP caching headers that browsers handle natively with **zero client code**:

```typescript
// API response with caching headers
const data = await fetchFromD1(env.DB);
const etag = `"${hashData(data)}"`;

// Check if client already has this version
if (request.headers.get('If-None-Match') === etag) {
  return new Response(null, { status: 304 }); // Not Modified — 0 bytes sent
}

return new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'ETag': etag,
    'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
  },
});
```

### 7.2 Comparison

| Strategy | JS Bundle | CPU per revisit | Complexity |
|----------|-----------|----------------|------------|
| IndexedDB + SWR + Crypto (original plan) | ~100-150 KB | ~15ms (parse + decrypt + merge) | Very High |
| **HTTP ETag + Cache-Control (this plan)** | **0 KB** | **~0.5ms (304 check)** | **Trivial** |

---

## 8. PHASE 6 — PREACT SIGNALS (INTER-ISLAND REACTIVITY)

> **Priority:** LOW — Only needed when multiple islands on one page need to communicate.

### 8.1 What It Solves

When the "User Management" Preact island updates a user's role, the "Activity Feed" island on the same page should reflect the change.

### 8.2 Implementation

```typescript
// src/lib/signals.ts
import { signal } from '@preact/signals';

/** Shared reactive state between Preact islands */
export const userUpdated = signal<string | null>(null);
export const toastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);
```

Both islands import from the same shared module. When one island writes to the signal, the other re-renders automatically. **1 KB total, type-safe, no event bus complexity.**

---

## 9. FEATURE-SLICED MODULE ARCHITECTURE (ACTIVE)

> **Status:** ACTIVE — 30 pages across ~15 modules triggers this pattern.

With 30 pages, domain-grouped module organization is essential for maintainability. Each module owns its pages, components, and API handlers as a self-contained unit. Removing a feature = deleting its folder + its entry in `admin_pages`.

### 9.1 Module Map (The "Lego Bricks")

```
src/
├── pages/dashboard/
│   ├── index.astro                    ← Dashboard home
│   ├── bookings/
│   │   ├── index.astro                ← Booking list/calendar
│   │   └── [id].astro                 ← Booking detail (future)
│   ├── customers/
│   │   └── index.astro                ← Customer profiles
│   ├── pets/
│   │   └── index.astro                ← Pet records
│   ├── content/
│   │   ├── index.astro                ← Content Studio hub
│   │   ├── hero.astro                 ← Hero editor
│   │   ├── gallery.astro              ← Gallery manager
│   │   ├── services.astro             ← Services editor
│   │   ├── pricing.astro              ← Pricing tables
│   │   ├── testimonials.astro         ← Testimonials
│   │   ├── faq.astro                  ← FAQ editor
│   │   └── about.astro                ← About page editor
│   ├── analytics/
│   │   └── index.astro                ← Analytics dashboard
│   ├── reports/
│   │   └── index.astro                ← Financial reports
│   ├── logs/
│   │   └── index.astro                ← Activity audit logs
│   ├── users/
│   │   └── index.astro                ← User management + PLAC
│   ├── settings/
│   │   ├── index.astro                ← General settings
│   │   ├── email.astro                ← Email templates
│   │   └── integrations.astro         ← Third-party connections
│   └── debug/
│       └── index.astro                ← Dev tools (DEV only)
├── components/
│   ├── admin/
│   │   ├── bookings/                  ← Booking-specific Preact islands
│   │   ├── customers/                 ← Customer Preact islands
│   │   ├── pets/                      ← Pet management islands
│   │   ├── content/                   ← CMS Preact islands (GalleryManager, etc.)
│   │   ├── analytics/                 ← Analytics chart islands
│   │   ├── users/                     ← User management + PageAccessManager
│   │   └── settings/                  ← Settings form islands
│   ├── navigation/                    ← Sidebar, TopBar
│   ├── dashboard/                     ← Home dashboard widgets
│   └── ui/                            ← Shared UI primitives (Toast, Modal, etc.)
├── pages/api/
│   ├── auth/                          ← Auth callbacks
│   ├── users/                         ← User management + PLAC provisioning
│   ├── content/                       ← CMS content APIs
│   └── media/                         ← Media upload/gallery APIs
└── lib/
    ├── auth/                          ← RBAC, PLAC, sessions, guards
    ├── env.ts                         ← Single source of truth for Cloudflare env bindings
    ├── audit.ts                       ← Ghost Audit Engine (table name whitelisted)
    ├── cms.ts                         ← CMS helpers: revalidateAstro(), locale expansion
    └── supabase.ts                    ← Supabase client factory (anon + admin)
```

### 9.2 Module Isolation Rules

1. **Pages** live in `src/pages/dashboard/{module}/` — Astro handles routing
2. **Preact islands** live in `src/components/admin/{module}/` — co-located with their domain
3. **API routes** live in `src/pages/api/{module}/` — server-side handlers
4. **Shared UI** lives in `src/components/ui/` — reusable across all modules
5. **Auth + PLAC** lives in `src/lib/auth/` — the "Baseplate" that gates all modules
6. Adding a module = create folder + add to `admin_pages` table + add to registry
7. Removing a module = delete folder + remove from `admin_pages` + remove from registry

### 9.3 The "Baseplate" Principle

The auth system (middleware + PLAC + registry) is the "Lego baseplate." It doesn't care what modules exist — it reads from `admin_pages` (D1) and enforces access. New bricks snap in without modifying the baseplate.

```
┌─────────────────────────────────────────────────┐
│           BASEPLATE (Auth Middleware)            │
│  registry.ts + plac.ts + middleware.ts           │
│  Reads admin_pages from D1 → enforces access    │
├──────┬──────┬──────┬──────┬──────┬──────┬───────┤
│ 📊   │ 📅   │ 🎨   │ 👥   │ ⚙️   │ 📈   │ 🐛   │
│ Home │ Book │ CMS  │Users │ Set  │ Ana  │Debug  │
│      │ ings │      │      │tings │lytics│       │
└──────┴──────┴──────┴──────┴──────┴──────┴───────┘
  Each brick is a self-contained module folder.
  The baseplate enforces access for ALL bricks.
```

### 9.4 The Dashboard Spread Route (Soft 404)

Unbuilt modules and routes within the portal are intercepted by `src/pages/dashboard/[...slug].astro`. 
Astro strictly resolves exact routes first:
1. Valid paths (e.g. `users/index.astro`) render immediately.
2. If no exact match exists, the request defaults to the spread route.

This acts as a "Soft 404" net which ensures:
- **No SPA breaks:** Native Astro 404s eject the user interface. The spread route retains the `<AdminLayout>` so the sidebar/topbar navigation is persisted seamlessly.
- **Premium UX:** The module renders a "Midnight Slate" themed "Under Maintenance" board indicating the string `slug` is offline.

---

## 10. SCALE-UP VAULT — ENTERPRISE FEATURES (DEFERRED)

> **Status:** Documented for when cf-admin scales to 100+ users.

These features are architecturally sound but not yet needed. Each has a **trigger condition**.

### 10.1 Bitmask Entitlements

**Trigger:** When you need >20 granular sub-feature permissions within the same page.

```typescript
// Future: Sub-feature gating within a page
const CAN_VIEW    = 0b0001;
const CAN_EDIT    = 0b0010;
const CAN_DELETE  = 0b0100;
const CAN_EXPORT  = 0b1000;
if (user.permissionMask & CAN_DELETE) { /* show delete button */ }
```

### 10.2 IndexedDB + SWR + Web Crypto Vault

**Trigger:** 100+ concurrent users approaching D1 5M read/day limit, OR offline admin access needed.

### 10.3 Custom Fragment Orchestration / MFE Loader

**Trigger:** 50+ pages and initial JS exceeds 100KB despite Astro's code splitting.

### 10.4 Global Event Bus

**Trigger:** 10+ islands on one page with complex cross-dependencies.

---

## 11. RISK ANALYSIS & CPU BUDGET

### 11.1 CPU Budget per Request (10ms limit)

```
CURRENT (without PLAC):
  Session KV read:    ~0.5ms
  JWT validation:     ~0.2ms
  Registry lookup:    ~0.1ms
  SSR render:         ~3-5ms
  D1 data query:      ~2-4ms
  ─────────────────────────
  TOTAL:              ~6-10ms ✅

WITH PLAC (30 pages, ~20 entries in access map):
  Session KV read:    ~0.5ms
  JWT validation:     ~0.2ms
  PLAC KV read:       ~0.3ms  ← NEW (cached access map, ~2KB JSON)
  Page access check:  ~0.1ms  ← NEW (hashmap lookup, O(1))
  SSR render:         ~3-5ms
  D1 data query:      ~2-4ms
  ─────────────────────────
  TOTAL:              ~6-10ms ✅ (PLAC adds only ~0.4ms even at 30 pages)
```

> **Note:** The access map grows linearly with pages. At 30 pages, the KV-stored JSON is ~2KB — well within KV's 25MB value limit. The hashmap lookup remains O(1) regardless of page count.

### 11.2 KV Budget (1,000 writes/day)

| Operation | KV Writes |
|-----------|-----------|
| Session create (login) | 1 per login |
| PLAC cache write | 1 per login + 1 per provisioning change |
| Session refresh | 1 per 30-min refresh |
| PLAC invalidation | 1 per provisioning change |
| **Daily total @ 10 users, 5 provisioning changes** | **~75 writes** (well within 1,000) |

### 11.3 D1 Budget (100,000 writes/day)

| Operation | D1 Writes |
|-----------|-----------|
| Audit log entries | 1 per admin action |
| PLAC overrides | 1 per grant/revoke |
| CMS updates | ~5-20 per day |
| **Daily total** | **~100-500 writes** (well within 100,000) |

### 11.4 Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| KV cache miss → D1 fallback on every request | 🟡 Medium | `waitUntil()` background cache rebuild; 1hr TTL |
| PLAC map stale after role change | 🟡 Medium | Role change triggers `invalidateAccessMap()` |
| Cold start CPU spike | 🟡 Medium | Keep middleware logic simple; no dynamic imports |
| Audit log D1 storage growth | 🟢 Low | 6-month auto-archive to R2 via CRON |

---

## 12. FILE MAP & IMPLEMENTATION ORDER

### 12.1 New Files Created

| # | File | Purpose | Phase |
|---|------|---------|-------|
| 1 | `src/lib/auth/plac.ts` | PLAC core: compute, cache, check access maps | Phase 2 |
| 2 | `src/pages/api/users/access.ts` | PLAC provisioning API (grant/revoke/reset) | Phase 2 |
| 3 | `src/components/admin/users/PageAccessManager.tsx` | Preact island: page access toggle grid (existing users) | Phase 2 |
| 4 | `src/lib/audit.ts` | Ghost audit engine helper | Phase 4 |
| 5 | `src/lib/signals.ts` | Shared Preact Signals for inter-island reactivity | Phase 6 |
| 6 | `src/pages/api/users/pages.ts` | Page registry endpoint — all active pages without userId; powers InviteUserModal chip grid | Post-Phase 6 |
| 7 | `src/components/admin/users/InviteUserModal.tsx` | Two-panel "Command Console" Preact island replacing InviteUserModal.astro | Post-Phase 6 |
| 8 | `src/components/admin/users/invite/RolePillSelector.tsx` | Atomic: 2×2 role pill grid with RBAC-gated availability | Post-Phase 6 |
| 9 | `src/components/admin/users/invite/HiddenAccountToggle.tsx` | Atomic: ghost-mode toggle (DEV/Owner only) | Post-Phase 6 |
| 10 | `src/components/admin/users/invite/PageChipGrid.tsx` | Atomic: interactive page chip grid (4 states) grouped by section | Post-Phase 6 |

### 12.2 Files Modified

| # | File | Change | Phase |
|---|------|--------|-------|
| 1 | `src/middleware.ts` | Add PLAC access check after session validation | Phase 2 |
| 2 | `src/lib/auth/session.ts` | Compute + cache PLAC map on session create | Phase 2 |
| 3 | `src/lib/auth/registry.ts` | Sync `ROUTE_REGISTRY` with `admin_pages` D1 table | Phase 2 |
| 4 | `src/layouts/AdminLayout.astro` | Add `<ViewTransitions />` | Phase 3 |
| 5 | `src/pages/api/users/manage.ts` | Add audit logging + `pageOverrides` batch D1 write at creation | Phase 4 / Post-6 |
| 6 | `src/pages/dashboard/users/index.astro` | Add PageAccessManager island; replace InviteUserModal.astro with Preact island | Phase 2 / Post-6 |
| 7 | `src/components/admin/users/UsersManager.tsx` | Button dispatches `modal:open-invite` CustomEvent; outer wrapper overflow fix | Post-Phase 6 |

### 12.3 D1 Migrations

| # | Migration | Phase |
|---|-----------|-------|
| 1 | `create_admin_pages_table` | Phase 2 |
| 2 | `create_admin_page_overrides_table` | Phase 2 |
| 3 | `seed_admin_pages` | Phase 2 |
| 4 | `create_admin_audit_log_table` | Phase 4 |

### 12.4 Implementation Order

```
STEP 1: D1 migrations (admin_pages, admin_page_overrides, admin_audit_log)
STEP 2: src/lib/audit.ts (Ghost Audit Engine)
STEP 3: src/lib/auth/plac.ts (PLAC core logic)
STEP 4: Update src/middleware.ts (integrate PLAC check)
STEP 5: Update src/lib/auth/session.ts (compute PLAC on login)
STEP 6: src/pages/api/users/access.ts (provisioning API)
STEP 7: src/components/admin/users/PageAccessManager.tsx (UI island)
STEP 8: Update src/pages/dashboard/users/index.astro (mount island)
STEP 9: Add <ViewTransitions /> to AdminLayout.astro
STEP 10: Documentation in cf-admin/documentation/
```

---

*End of Architecture Plan. This plan must be followed for all architectural decisions in cf-admin. Deferred features (Scale-Up Vault) should only be implemented when their trigger conditions are met.*
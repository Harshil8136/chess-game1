{% raw %}
# 🛡️ System Architecture: RBAC, PLAC & Ghost Audit

> [!NOTE]
> **System Status:** Production Ready
> **Target Environment:** Cloudflare Workers V8 Isolates (Edge Computing)
> **Last Updated:** 2026-05-02 (v4.5: documentation audit pass; content verified against live codebase)

This document outlines the complete technical implementation, execution lifecycle, and operational rules for the **CF-Admin Security & Tracing Triad**: Hierarchical RBAC, Page-Level Access Control (PLAC), and the Ghost Audit Engine.

Designed specifically to operate within Cloudflare's strict 10ms–50ms CPU limits, this triad provides enterprise-grade administrative security with **zero user-perceived latency** and an effective **$0 infrastructure cost**.

---

## 1. The RBAC Foundation (Role-Based Access Control)

RBAC forms the "natural baseline" of the CF-Admin authentication system. It assigns an absolute integer weight to users, establishing a rigid command hierarchy.

### 1.1 The 5-Tier Role Hierarchy Matrix

Roles are defined centrally and scored such that a **lower number equals higher privilege**. Any permission check evaluates if `ActorLevel <= TargetLevel`.

| Level | Role | Capabilities | Badge Color | Icon | Target Audience |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **0** | **DEV (Ghost)** | **Absolute System Supremacy.** Can execute database prunes, create hidden accounts, mutate other devs, and view raw cryptolocked logs. Hidden entirely from lower tiers. | Red | ⚡ | System Architects |
| **1** | **Owner** | **Project Ownership.** Can manage billing, API keys, and view all hidden accounts. Protected from modification by SuperAdmin and below. | Emerald | 💎 | Business Owners |
| **2** | **Super Admin** | **Full Operational Access.** Can manage users (at or below their level), alter global settings, and grant PLAC privileges. Cannot see hidden accounts. | Amber | 👑 | Senior Managers |
| **3** | **Admin** | **Manager-Level Access.** Can manage content (Hero, Gallery, Reviews), view customers, and read generalized audit logs. | Purple | 🛡️ | Operations Managers |
| **4** | **Staff** | **Restricted Access.** Designed for read-only operations and basic daily front-desk interactions. | Blue | 👤 | Front Desk & Support |

### 1.2 Color System: Thermal Gradient

Badge colors follow a deliberate **thermal gradient** for dark UI legibility — progressing from Red (danger/system) through Emerald (ownership), Amber (authority), Purple (management), to Blue (operations).

Each role has full display metadata including color, background color, icon, and label.

### 1.3 The Break-Glass Emergency Fallback

> [!CAUTION]
> **Anti-Lockout Mechanism**
> To prevent catastrophic administrative lockouts (e.g., if Supabase is down, whitelist is corrupted, or a vicious actor strips rights), the system relies on `BREAK_GLASS_EMAILS` — a hardcoded array of emergency email addresses in `src/lib/auth/rbac.ts`.

`BREAK_GLASS_EMAILS = ['harshil.8136@gmail.com', 'team@madagascarhotelags.com']`

If a CF-authenticated email matches the array, the Worker force-grants super_admin properties and bypasses the Supabase whitelist check during session bootstrap. `isBreakGlassAdmin()` logs `console.warn` every invocation for auditability.

**Legacy aliases (backwards compatibility — deprecated, do not use in new code):**
- `SUPER_ADMIN_EMAILS` = `BREAK_GLASS_EMAILS`
- `isHardcodedSuperAdmin` = `isBreakGlassAdmin`

### 1.4 Helper Functions

| Function | Description |
|----------|-------------|
| `hasPermission` | O(1) integer comparison — core gatekeeper |
| `isDev` | Exact DEV check |
| `isOwner` | Owner or higher (DEV/Owner) |
| `isOwnerOrDev` | Specific check for hidden account visibility |
| `isSuperAdmin` | SuperAdmin or higher |
| `isAdmin` | Admin or higher |
| `isValidRole` | Type guard for string validation |
| `isBreakGlassAdmin` | Anti-lockout fallback check (replaces `isHardcodedSuperAdmin` — legacy alias still exported) |

---

## 2. Page-Level Access Control (PLAC)

While RBAC handles broad categorization natively, **PLAC** is a high-performance database extension that allows explicit **Granting** or **Denying** of single pages inside the dashboard on a *per-user* basis. It acts as the absolute final authority determining if a user can view a specific dashboard route.

### 2.1 The "Compute on Write, Read from Cache" Pipeline

Querying D1 for page permissions on every single navigation event would consume 3–5ms of CPU time per click and create thousands of unnecessary SQL reads. PLAC avoids this entirely.

**The Two-Phase Approach:**

1. **Phase 1 — Login / Provisioning:** When a user authenticates, the Worker joins page definitions and overrides, computes a precomputed JSON access map, and serializes it into the KV session cache.
2. **Phase 2 — High-Speed Navigation:** When the user navigates to any dashboard page, the middleware fetches the access map from KV and performs an O(1) hashmap lookup. Zero D1 queries are executed during navigation.

### 2.2 The D1 Schema Integration

PLAC relies on two database constructs:

* **Page Registry** (The Source of Truth for Routing) — Defines every page that exists in the interface including path, required role, and active status. The required role is validated against all 5 role tiers.

* **Override Table** (The Delta State) — Holds specific overrides from the natural hierarchy via composite keys (user identifier + page path) and a boolean granted parameter.

### 2.3 The "Deny Wins" Resolution Algorithm

When the access map computation fires, it resolves permissions through strict precedence:

1. **Explicit DENY Overrides:** ACCESS IS BLOCKED. Denies instantly overwrite the natural hierarchy.
2. **Explicit GRANT Overrides:** ACCESS IS ALLOWED.
3. **Implicit Role Default:** If no override row exists, the system relies on baseline mathematics: the user's role level must be at or above the page's required level.

### 2.4 Granular Permission Model (Sub-Features)

PLAC extends beyond simple "page routing" via **Pseudo-Paths**. This allows micro-capabilities (e.g., exporting CSVs, performing a destructive prune) to be managed by the exact same O(1) mathematical resolution engine without requiring structural schema updates.

* **Pattern:** A hash-fragment sub-feature is appended to a parent route in the page registry.
* **Evaluation:** Standard routing still checks the base path. The UI buttons independently request a PLAC check for the sub-feature path.
* **UI Visualization:** In the invite flows and permission managers, sub-features automatically nest under their parent route and are branded as "Features" rather than "Pages" for conceptual clarity.
* **Cost:** $0. Because the hashmap loads instantly into Cloudflare KV, querying 50 granular capability checks for a single render still operates at <1ms.

**Registered Pseudo-Paths:**

| Pseudo-Path | Default Access | Description |
|-------------|---------------|-------------|
| `/dashboard/logs#export` | DEV, Owner | Export audit logs as CSV |
| `/dashboard/logs#prune` | DEV | Destructive prune of logs >30 days |
| `/dashboard/logs#security` | DEV, Owner | View Login Forensics tab (contains PII: IP, User-Agent, Geo) |

> [!TIP]
> For comprehensive documentation of the Login Forensics subsystem (D1 schema, API endpoints, UI, alert emails), see **[LOGIN-FORENSICS.md](./LOGIN-FORENSICS.md)**.

### 2.5 Provisioning Gatekeepers (Anti-Escalation Measures)

> [!IMPORTANT]
> The API endpoint handling Access Management contains four ironclad validation gates. Without them, a standard Admin could theoretically grant themselves Dev permissions.

* **Gate A: Rank Supremacy** — Administrators can never manipulate the access array of users at their own level or higher.
* **Gate B: DEV + Owner Ghosting** — Users with DEV or Owner rank are intentionally dropped from UI payloads when requested by non-devs. The DEV and Owner cohort operates completely invisibly to standard administration.
* **Gate C: Page Visibility Check** — Administrators cannot grant another user access to a page (or granular sub-feature) they cannot see themselves.
* **Gate D: Natural Ceiling Enforcement** — Administrators cannot grant a Staff member access to a tool designed with a DEV base requirement. Grants are capped at the actor's maximum clearance level.

### 2.6 Auto-Purging Strategies

* **Instant Discontinuation:** Modifying a user's PLAC map triggers `forceLogoutUser()` — a **3-layer revocation** cascade:
  1. **Layer 1** — KV session deletion via reverse-mapping key pattern for O(k) destruction
  2. **Layer 2** — KV revocation flag (`revoked:{userId}`) prevents re-bootstrap via still-valid CF Access cookie
  3. **Layer 3** — CF API `DELETE /access/users/{cfSubId}/active_sessions` invalidates the CF_Authorization cookie at the edge immediately
* **Role Promotion Reset:** Changing a user's natural baseline role immediately triggers `resetUserOverrides(env.DB, userId)` — complete purge of all D1 historical PLAC overrides. A new role implies a new baseline; historical overrides are destroyed. The 3-layer force-kick fires immediately after to apply the new role.

### 2.7 Admin Pages Registry Manager

To ensure full administrative oversight over the PLAC system itself, the **Admin Pages Registry Manager** is implemented at `/dashboard/debug/pages`. This interface is exclusively accessible to DEV and operates under a rigorous 5-layer security stack:

1. **SSR Gating**: Enforced by the `isDev` helper in the Astro page component, instantly rejecting any unauthorized rendering.
2. **API-Level Auth**: All mutations via `/api/system/pages.ts` and `/api/system/preview.ts` undergo `requireAuth(context, 'dev')`.
3. **Rate Limiting**: Enforced via Upstash Redis to prevent abuse.
4. **Schema Validation**: The D1 schema incorporates a hardened `CHECK` constraint guaranteeing valid required roles (including `owner`), automatically resolving legacy migration issues (e.g., Migration 0018).
5. **Ghost Audit Logging**: All mutations to the registry log a `registry_update` action in the Ghost Audit Engine.

The manager includes an **Impact Analysis Engine** that performs pre-mutation dry-runs, calculating aggregate access gains or losses globally across the user base before any role changes are committed to the D1 schema.

---

## 3. The Ghost Audit Engine

The Ghost Audit Engine is the overarching forensic surveillance system covering `cf-admin`. Because we do not rely on a monolithic backend, traditional blocking loggers would severely degrade Edge performance. The Ghost Engine resolves this.

### 3.1 The Concept: Deferred Execution

Writing to a physical D1 SQL database takes approximately 5ms to 15ms. Waiting for an audit log to spool before completing a request destroys perceived application speed.

**Solution:** Cloudflare's `ExecutionContext.waitUntil(promise)` mechanism.

The API endpoint processes the user's request, returns the HTTP response immediately, and then the V8 isolate is kept alive to perform the asynchronous audit log write to D1. The user experiences unparalleled performance, while the security ledger remains mathematically uncompromised.

### 3.2 Immutability at the Edge

> [!WARNING]
> The audit log table explicitly allows reads and inserts only. **No delete or update endpoints are exposed.**

To modify a log, a malicious actor would require Cloudflare Dashboard-level administrative access to run raw D1 queries via the CLI. At the framework level, the ledger is computationally immutable.

**Defense-in-Depth:** The audit logger factory validates table name configuration against an internal whitelist. Since D1 does not support parameterized table names, this prevents SQL injection out-of-the-box.

### 3.3 Typed Actions and Modules

The audit system uses strict typed unions (not arbitrary strings) for maximum query reliability:

**Actions:**
`login`, `logout`, `create`, `update`, `delete`, `grant_access`, `revoke_access`, `reset_access`, `role_change`, `view`, `export`, `prune`, `force_logout`

**Modules:**
`auth`, `plac`, `users`, `content`, `bookings`, `customers`, `pets`, `settings`, `analytics`, `reports`, `logs`, `media`, `debug`, `system`

### 3.4 Operational Payload Tracking

The engine specifically tracks unified JSON payloads representing every state mutation:

* **Identity Signatures:** user identifier, user email, user role
* **Behavior Vectors:** action (typed enum), module (typed enum)
* **Impact Vectors:** target identifier, target type, details (granular JSON tracking of exact element changes)

### 3.5 Ubiquitous Navigational Telemetry (Middleware Tracking)

> [!TIP]
> **The "In-Accessible Page" Tracer**
> Traditional audit logs only track successful API actions. CF-Admin intercepts navigations at the core middleware level to log both permitted views and **malicious probing**.

Every non-API navigation inside the dashboard is intercepted:

1. **Access Evaluation:** The middleware checks the PLAC map.
2. **Synchronous Transition:** The user is either allowed to load the page or bounced to a 403 error screen.
3. **Ghost Telemetry:** The middleware fires an async deferred task pushing a "view" ledger entry.

The details payload contains a `granted` boolean. This allows Devs to scan the audit table for denied entries to instantly uncover repeated unauthorized access attempts.

{% endraw %}

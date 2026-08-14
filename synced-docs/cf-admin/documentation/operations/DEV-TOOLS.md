---

title: "Edge Command Center — Architecture & Security Reference"
status: active
audience: [ai, technical]
last_verified: 2026-08-13
verified_against: [code]
owner: harshil
tags: []
---

# Edge Command Center — Architecture & Security Reference

> **TL;DR (non-technical):** The built-in developer and debug tools inside the admin portal — diagnostics, health checks, and the page-registry manager.

> **Scope**: `cf-admin` — Covers System Debugging, Feature Configuration, and the Audit Engine.
>
> **Last Updated**: 2026-04-25

---

## 1. Overview

The Edge Command Center is the developer-exclusive administrative module within `cf-admin`. It provides DEV-role users with:

- **System Debugging** — Health check tooling for production bindings (D1, KV)
- **Feature Configuration** — Runtime feature flag management (no deployment required)
- **Audit Suppression** — Secure, auditable suppression of activity logging per-user (managed via User Management)

All modules are protected by **Server-Side Rendering (SSR) authorization guards**, ensuring that no unauthorized content is ever sent to the client.

---

## 2. Authorization Model

### 2.1 SSR-First Security

Every sensitive page uses a strict **server-side role check** in the Astro frontmatter.
The guard is `isVendorSupport` (level 0) — the samples below previously used
`isDev`, which is now a `@deprecated` alias for exactly the same check:

```astro
---
import { requireAuth } from '../../../lib/auth/guard';
import { isVendorSupport, type Role } from '../../../lib/auth/rbac';

const user = await requireAuth(Astro);
if (!isVendorSupport(user.role as Role)) {
  return Astro.redirect('/dashboard?error=unauthorized');
}
---
```

**Why SSR, not client-side?** Client-side checks (e.g., `{isVendorSupport(user.role) && <Component />}`) still ship the component JavaScript to the browser. An attacker with browser DevTools could inspect, modify, or replay those components. SSR guards ensure the HTML is never generated at all — the server returns a 302 redirect before any markup reaches the wire.

### 2.2 API Route Protection

Every API endpoint backing these features enforces the same guard:

```typescript
import { isVendorSupport, type Role } from '../../../lib/auth/rbac';

if (!isVendorSupport(sessionUser.role as Role)) {
  return new Response(
    JSON.stringify({ error: 'Insufficient permissions: DEV only' }),
    { status: 403 }
  );
}
```

This prevents direct `curl`/`fetch` attacks that bypass the UI.

### 2.3 RBAC + PLAC Layering

Authorization is enforced at **three layers**:

| Layer | Mechanism | File |
|-------|-----------|------|
| **Page-Level** (PLAC) | D1 `admin_pages` table restricts sidebar visibility | `lib/auth/plac.ts` |
| **SSR Guard** | Astro frontmatter redirects non-DEV users | `pages/dashboard/debug/index.astro` |
| **API Guard** | API route rejects non-DEV requests with 403 | `pages/api/diagnostics/ping.ts` |

All three layers must independently agree. If an attacker bypasses PLAC (e.g., bookmarks a URL), the SSR guard catches them. If they call the API directly, the API guard catches them.

---

## 3. System Debugging (`/dashboard/debug`)

### 3.1 Purpose

The System Debugging page provides real-time health verification of the production infrastructure, enabling DEV users to verify binding availability without SSH or Cloudflare dashboard access.

### 3.2 Diagnostic Ping

The **"Run Diagnostic Ping"** tool calls `GET /api/diagnostics/ping`, which:

1. Authenticates the DEV user (role check)
2. Sends a `GET` request to `cf-astro`'s `/api/health` endpoint (authenticated via `REVALIDATION_SECRET`)
3. Measures round-trip latency
4. Returns D1 and KV binding status from `cf-astro`
5. Logs the action via `ctx.waitUntil()` (non-blocking, post-response)

### 3.3 File Map

| File | Purpose |
|------|---------|
| `pages/dashboard/debug/index.astro` | SSR page with DEV guard |
| `components/admin/debug/SystemDiagnostics.tsx` | Preact island (Ping UI + audit status indicator) |
| `pages/api/diagnostics/ping.ts` | API: proxies cf-astro health check |

---

## 4. Feature Configuration (`/dashboard/settings/features`)

### 4.1 Purpose

Feature Configuration enables instant, deployment-free toggling of experimental features across `cf-admin` and `cf-astro`. Flags are stored in D1 (`admin_feature_flags` table) and cached in KV with a 60-second TTL.

### 4.2 Toggle Flow

```
[DEV clicks toggle] → POST /api/features/toggle
  → DEV role check (403 if not DEV)
  → FeatureFlagRepository.setFlagStatus()
  → auditLogger() via ctx.waitUntil()
  → 200 OK
```

### 4.3 Cross-Project Propagation

When a flag is toggled in `cf-admin`, `cf-astro` picks it up within 60 seconds via its middleware cache cycle (see `EDGE_FEATURE_ROUTING.md` in cf-astro).

### 4.4 File Map

| File | Purpose |
|------|---------|
| `pages/dashboard/settings/features.astro` | SSR page with DEV guard |
| `components/admin/settings/FeatureToggles.tsx` | Preact island for toggle UI |
| `pages/api/features/toggle.ts` | API: updates flag in D1 |
| `lib/dal/FeatureFlagRepository.ts` | Data access layer for feature flags |

---

## 5. Audit Suppression (removed)

Audit suppression was **deleted on 2026-07-26**, along with the
`/api/audit/silence` endpoint, the `AuditSilencePanel` toggle, the
`auditSilenced` session field and the `is_audit_silenced` column.

### 5.1 Why

The feature was documented as suppressing only `view` and `export` telemetry.
It did not. `isActionSilenceable()` in `src/lib/audit.ts` had degraded to
`return true`, so it covered `delete`, `role_change`, `grant_access`,
`revoke_access`, `prune` and `config_change` as well. Self-silencing was
explicitly permitted, so the actor being logged could switch off their own
logging. And the bulk-delete path in `api/audit/logs.ts` snapshotted rows with
the comment *"a compromised Owner cannot silently erase evidence of their own
actions"* and then passed the same flag into the write, discarding the
snapshot.

There is no configuration of a vendor-controlled audit switch that survives a
security review, and its existence contradicted the audit guarantees the
product is sold on.

### 5.2 If you need test-data separation again

Add an `environment` column to `admin_audit_log` and filter on **read**. Do not
reintroduce a write-side suppression flag: the value of an audit log is that
its contents are not a function of who was being audited.

---

## 6. Audit Engine (`ctx.waitUntil`)

### 6.1 Zero-Latency Logging

All audit writes use Cloudflare's `ctx.waitUntil()` API, which schedules work **after** the HTTP response is sent. This means:

- The user sees their response immediately
- The D1 INSERT happens asynchronously in the background
- If the D1 write fails, the user is unaffected (error is logged to console)

### 6.2 Performance Budget

| Operation | CPU Cost |
|-----------|----------|
| Page view audit (middleware) | 0ms on hot path |
| API action audit | 0ms on hot path |
| ~~Ghost Mode check~~ | *Removed — the suppression path no longer exists (§8.1)* |

### 6.3 Design Decision: Why Not a Queue?

Cloudflare Queues would add a binding dependency and introduce eventual consistency. Since `ctx.waitUntil()` runs in the same isolate with direct D1 access, it provides:

- Simpler architecture (no queue consumer worker)
- Near-instant log availability
- No additional billing

---

## 7. D1 Sidebar Labels

The `admin_pages` table controls sidebar navigation. The following entries were updated as part of the terminology overhaul:

| Path | Old Label | New Label |
|------|-----------|-----------|
| `/dashboard/debug` | Debug Tools | System Debugging |

Page titles (rendered in `<h1>` tags) were also updated:

| Page | Old Title | New Title |
|------|-----------|-----------|
| `debug/index.astro` | QA & Diagnostics Command Center | System Debugging |
| `settings/features.astro` | Feature Flags | Feature Configuration |

---

## 8. Drawbacks & Considerations

### 8.1 Ghost Mode — REMOVED, no longer a risk

**Ghost Mode no longer exists.** It has been fully removed and this section is retained only
so the history is legible.

It allowed a `vendor_support`/DEV actor to suppress audit writes for their own session. Its
removal happened in three steps:

1. **2026-07-26** — the suppression gate was removed from `src/lib/audit.ts` and the
   user-management toggle was deleted. `audit.ts` now records: *"Every action is logged;
   there is no suppression path."*
2. **2026-07-27** — migration `supabase/migrations/20260727000000_drop_audit_silence.sql`
   dropped `admin_authorized_users.is_audit_silenced`. Its rationale is candid about why the
   feature was indefensible: the gate had degraded to `isActionSilenceable() { return true }`,
   self-silencing was permitted, and the bulk-delete evidence snapshot was discarded through
   the same flag.
3. **2026-07-29** — `src/pages/api/audit/silence.ts` was deleted. It had survived the earlier
   passes: still a live `POST` handler, still writing the dropped column, and gated on
   `placDenyResponse(session, '/dashboard/audit')` — a path that exists neither on disk nor
   in `admin_pages`, so `requirePageAccess` matched nothing and the gate silently passed.
   Two orphaned doc-comments left behind in `env.d.ts` and `session.ts` were removed at the
   same time.

The previous mitigation bullet claimed the toggle event produced an "immutable meta-trail".
No part of the audit log is immutable — see
[`architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.2.

### 8.2 Performance Impact

- **None measurable** — all audit operations are post-response via `ctx.waitUntil()`
- There is no suppression check on the write path at all; every entry is written
- No additional KV reads — the flag is part of the existing session object

### 8.3 DEV-Only Restriction

Feature Configuration and System Debugging are now **DEV-exclusive**. SuperAdmin users who previously had access will be redirected. This is intentional — these are infrastructure-level controls that should not be accessible to business-level administrators.

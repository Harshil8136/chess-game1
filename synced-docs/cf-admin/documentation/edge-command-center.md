{% raw %}
# Edge Command Center — Architecture & Security Reference

> **Scope**: `cf-admin` — Covers System Debugging, Feature Configuration, Audit Suppression, and the Ghost Audit Engine.
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

Every sensitive page uses a strict **server-side role check** in the Astro frontmatter:

```astro
---
const user = await requireAuth(Astro);
if (user.role !== 'dev') {
  return Astro.redirect('/dashboard?error=unauthorized');
}
---
```

**Why SSR, not client-side?** Client-side checks (e.g., `{user.role === 'dev' && <Component />}`) still ship the component JavaScript to the browser. An attacker with browser DevTools could inspect, modify, or replay those components. SSR guards ensure the HTML is never generated at all — the server returns a 302 redirect before any markup reaches the wire.

### 2.2 API Route Protection

Every API endpoint backing these features enforces the same guard:

```typescript
if (sessionUser.role !== 'dev') {
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

## 5. Audit Suppression

### 5.1 What It Is

Audit Suppression allows a DEV user to suppress activity logging for a specific user. When enabled, the middleware and API audit loggers skip D1 writes for that user's actions.

### 5.2 Where It Is Managed

Audit Suppression is managed **exclusively** through the **User Management** page (`/dashboard/users`) via the `AuditSilencePanel` in `UserCard.tsx`. The System Debugging page shows a **read-only status indicator** for the current DEV user's audit state, with a link to User Management for toggling.

> **Design Decision**: An earlier iteration placed a duplicate toggle on the System Debugging page. This was removed to avoid maintaining two separate UI components and API endpoints for the same feature. The single source of truth is `POST /api/audit/silence`.

### 5.3 Security Guarantees

1. **The toggle action itself is ALWAYS logged** — even when enabling suppression, the act of enabling it creates an immutable audit trail entry
2. **User-scoped** — Suppression only affects the targeted user; other users' logs are unaffected
3. **Persistent** — The `is_audit_silenced` flag is stored in Supabase (`admin_authorized_users` table), so it survives re-login
4. **KV-propagated** — The flag is pushed to all active KV sessions for the user, taking immediate effect without re-login

### 5.4 Toggle Flow

```
[DEV clicks Audit Silence in User Management] → POST /api/audit/silence
  → DEV role check (403 if not DEV)
  → auditLog() — ALWAYS writes the toggle event (no silent flag)
  → Supabase UPDATE admin_authorized_users.is_audit_silenced
  → KV propagation to all active sessions
  → 200 OK
```

### 5.5 How Audit Suppression Works

**Middleware level** (`middleware.ts`):
```typescript
if (!isApiRoute && cfCtx?.waitUntil && !session.auditSilenced) {
  // page-view audit log — skipped when suppression is ON
}
```

**API level** (e.g., `toggle.ts`, `ping.ts`):
```typescript
const auditLogger = createAuditLogger({
  db,
  waitUntil: cfCtx.waitUntil.bind(cfCtx),
  silenced: sessionUser.auditSilenced,  // Suppression awareness
});
```

### 5.6 File Map

| File | Purpose |
|------|---------|
| `components/admin/users/UserCard.tsx` | `AuditSilencePanel` toggle UI (DEV-only) |
| `pages/api/audit/silence.ts` | API: toggles audit suppression for any user |
| `lib/auth/session.ts` | `updateSessionAuditSilenced()` KV helper |
| `middleware.ts` | Reads `session.auditSilenced` for page-view logging |
| `lib/audit.ts` | `createAuditLogger({ silenced })` factory |

---

## 6. Ghost Audit Engine (`ctx.waitUntil`)

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
| Ghost Mode check | ~0.01ms (boolean read from session) |

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

### 8.1 Ghost Mode Risk

Ghost Mode creates a window where DEV actions are unlogged. Mitigation:
- The toggle event itself is always logged (immutable meta-trail)
- Only DEV role can activate it (SSR + API enforced)
- Supabase persistence means the state is visible to other DEVs via the User Management dashboard

### 8.2 Performance Impact

- **None measurable** — all audit operations are post-response via `ctx.waitUntil()`
- Ghost Mode adds a single boolean check (`if (silenced) return;`) which is negligible
- No additional KV reads — the flag is part of the existing session object

### 8.3 DEV-Only Restriction

Feature Configuration and System Debugging are now **DEV-exclusive**. SuperAdmin users who previously had access will be redirected. This is intentional — these are infrastructure-level controls that should not be accessible to business-level administrators.

{% endraw %}

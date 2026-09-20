---

title: "Developer Debug Portal (Edge Command Center) — Architecture & Security Reference"
status: active
audience: [ai, technical]
last_verified: 2026-09-19
verified_against: [code]
owner: harshil
tags: []
---

# Developer Debug Portal (Edge Command Center) — Architecture & Security Reference

> **TL;DR (non-technical):** The built-in developer and debug tools inside the admin portal — diagnostics, health checks, and the page-registry manager.

> **Scope**: `cf-admin` — Covers System Debugging, Feature Configuration, and the Audit Engine.
>
> **Naming**: nothing in the product is labelled "Edge Command Center". The
> shipped `<h1>` is **Developer Debug Portal** (§7), which is what to search
> for in the code or a screenshot; the older name is kept in the title only so
> existing links and index rows still find this page.
>
> **Last Updated**: 2026-04-25; re-verified 2026-09-14 and 2026-09-19 (see §9)

---

## 1. Overview

The Developer Debug Portal is the developer-exclusive administrative module within `cf-admin`. It provides DEV-role users with:

- **System Debugging** — the probe suite in `lib/diagnostics/` (tiers, latency
  grades and remediation text) run against the live production bindings, plus
  its history and the page-registry manager (§3)
- **Feature Configuration** — Runtime feature flag management (no deployment required)

*(A third bullet, "Audit Suppression", was removed on 2026-09-19: the feature
was deleted on 2026-07-26 and §5/§8.1 explain why it is not coming back. It
should not have survived in the overview a reader hits first.)*

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
  return Astro.rewrite('/dashboard/access-denied');
}
---
```

**Why SSR, not client-side?** Client-side checks (e.g., `{isVendorSupport(user.role) && <Component />}`) still ship the component JavaScript to the browser. An attacker with browser DevTools could inspect, modify, or replay those components. SSR guards ensure the page HTML is never generated at all — the server rewrites to the access-denied view before any of the page's markup reaches the wire. *(2026-09-14: the guarded pages still import the deprecated `isDev` alias and use `Astro.rewrite`, not a redirect; this doc previously showed `Astro.redirect('/dashboard?error=unauthorized')`. 2026-09-19: there are **five** such pages, not three — `debug/index`, `debug/diagnostics`, `debug/diagnostics/history`, **`debug/pages`** (the page-registry manager, the highest-privilege of the set) and `settings/features`.)*

### 2.2 API Route Protection

Every API endpoint backing these features rejects an unauthenticated or
under-privileged caller, which is what stops a direct `curl`/`fetch` from
bypassing the UI. **The guards are not identical, and two of them are weaker
than the role check** — corrected 2026-09-19, this section previously said
"every API endpoint … enforces the same guard" and showed only the strict form.

The strict form, used by `POST /api/features/toggle` and the `is_active` half
of `POST /api/pages/toggle`:

```typescript
import { isVendorSupport, type Role } from '../../../lib/auth/rbac';

if (!isVendorSupport(sessionUser.role as Role)) {
  return new Response(
    JSON.stringify({ error: 'Insufficient permissions: DEV only' }),
    { status: 403 }
  );
}
```

The two exceptions, both live:

| Route(s) | Actual guard | Consequence |
|---|---|---|
| `pages/api/diagnostics/run.ts`, `results.ts`, `infrastructure.ts` | `checkPerm('/dashboard/debug', isDev(user.role))` — a **PLAC grant overrides the role**: `user.accessMap['/dashboard/debug'] === true` returns true before the role is consulted | A non-DEV user holding that grant can run the probe suite against live production bindings. The 403 body is `Insufficient permissions or access denied by PLAC policy` |
| `pages/api/pages/toggle.ts` | `is_active` is DEV-only, but `required_role` is gated on `isSuperAdmin` | **Super Admin and above can change which role a page requires** — a privilege-boundary edit, from outside the DEV role |

Treat both as decisions to confirm or defects to fix, not as documentation
gaps. As written before this correction, the section asserted a stricter
control than the code implements, which is the worse of the two failure modes
for a threat model.

### 2.3 RBAC + PLAC Layering

Authorization is enforced at **three layers**:

| Layer | Mechanism | File |
|-------|-----------|------|
| **Page-Level** (PLAC) | The **middleware authorization gate** for both pages and API routes, resolved from D1 `admin_pages`. It **default-denies**: an unmapped `/api/*` path is refused outright, and a refused page is rewritten to `/dashboard/access-denied`. Sidebar visibility is a consequence of the same map, not its purpose | `lib/auth/stages/decide.ts`, `lib/auth/guard.ts`, `lib/auth/plac.ts` |
| **SSR Guard** | Astro frontmatter rewrites non-DEV users to the access-denied view | `pages/dashboard/debug/index.astro` |
| **API Guard** | The handler's own role/PLAC check (§2.2) | `pages/api/diagnostics/run.ts` |

All three layers must independently agree. *Corrected 2026-09-19:* this section
described PLAC as restricting "sidebar visibility" and offered "an attacker
bookmarks a URL" as the bypass the SSR guard catches. Bookmarking a URL is
precisely what PLAC itself stops — the middleware decides before the page or
route runs. The defence-in-depth argument stands; the example did not.

---

## 3. Developer Debug Portal (`/dashboard/debug`)

### 3.1 Purpose

`/dashboard/debug` is a landing hub (`<h1>` "Developer Debug Portal") linking to the diagnostics run, its history and the page-registry manager. The diagnostics page provides real-time health verification of the production infrastructure, enabling DEV users to verify binding availability without SSH or Cloudflare dashboard access.

### 3.2 Diagnostics run

`/dashboard/debug/diagnostics` mounts `SystemDiagnostics.tsx` (`client:idle`), which calls `POST /api/diagnostics/run`
on load and every 30 seconds ("Force Sync" runs it on demand). The route checks
the vendor-support role, runs the probe suite in `src/lib/diagnostics/runner.ts`
against the live bindings and returns the run; one row per probe is written to
`system_test_results`.

Two things that used to be on this page are gone (2026-09-02, viability
program chunk 9): the "Run Diagnostic Ping" tool and its route
`GET /api/diagnostics/ping`, which nothing had called since the page was
rebuilt around the runner, and the "Trigger Production Tests" button, whose
route only ever simulated a dispatch in production (owner decision, ADR-0002
answer 5).

### 3.3 File Map

| File | Purpose |
|------|---------|
| `pages/dashboard/debug/index.astro` | Landing hub with DEV guard |
| `pages/dashboard/debug/diagnostics.astro`, `debug/diagnostics/history.astro` | Diagnostics run and its history (`SystemDiagnosticsHistory.tsx`) |
| `pages/dashboard/debug/pages.astro` + `components/admin/debug/PageRegistryManager.tsx`, `PageRegistryConfirmModal.tsx` | Page-registry manager (edit `admin_pages` rows) |
| `components/admin/debug/SystemDiagnostics.tsx` (+ `DiagnosticsInfraBar.tsx`, `DiagnosticsTestList.tsx`) | Preact island: runs the suite on load and every 30 s, renders the infra bar and the per-probe list |
| `pages/api/diagnostics/run.ts`, `results.ts`, `infrastructure.ts` | API: run the probe suite / read persisted results / infra snapshot; results persist to `system_test_results` |
| `lib/diagnostics/runner.ts`, `benchmarks.ts`, `types.ts`, `tests/` | The probe suite (tiers, latency grades, remediation text) |

---

## 4. Feature Configuration (`/dashboard/settings/features`)

### 4.1 Purpose

Feature Configuration enables instant, deployment-free toggling of experimental features across `cf-admin` and `cf-astro`. Flags are stored in D1 (`admin_feature_flags` table) and read from D1 on each request — `FeatureFlagRepository.ts` has no KV layer. *(2026-09-14: this said "cached in KV with a 60-second TTL".)*

### 4.2 Toggle Flow

```
[DEV clicks toggle] → POST /api/features/toggle
  → DEV role check (403 if not DEV)
  → FeatureFlagRepository.setFlagStatus()
  → auditLogger() via ctx.waitUntil()
  → 200 OK
```

### 4.3 Cross-Project Propagation

**Not implemented, and there is no consumer in either app.** This section said cf-astro picks a toggled flag up within 60 seconds via its middleware cache and pointed at a cf-astro file (`EDGE_FEATURE_ROUTING`) that does not exist in the cf-astro checkout (removed or never written), and cf-astro's `src/` contains no reader of `admin_feature_flags` (its `service-config.ts` header still mentions a "feature-flag 3-layer cache in middleware.ts" that the middleware no longer contains). *2026-09-19:* cf-**admin** has no runtime reader either — `admin_feature_flags` is written and read by the toggle UI and `FeatureFlagRepository.ts` and nothing else, so toggling a flag changes no behaviour anywhere. Read this as "the table is a UI with no consumer", not "it works locally". Cross-app runtime config goes through `service_config` — see [`../features/CONTROL-PLANE.md`](../features/CONTROL-PLANE.md), which is where this surface should fold in.

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
- If the D1 write fails, the user is unaffected. `handleAuditError` logs to the
  console **and** calls `Sentry.captureException` with
  `component: 'ghost_audit_engine'` — so a persistent audit-write failure is
  visible in Sentry, not console-only as this line said until 2026-09-19

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
| `/dashboard/debug` | Debug Tools | System Debugging *(no migration on disk sets this label — unverified, likely applied by hand; the seed is `Debug Tools`)* |

Page titles (rendered in `<h1>` tags) were also updated:

| Page | Old Title | New Title |
|------|-----------|-----------|
| `debug/index.astro` | QA & Diagnostics Command Center | Developer Debug Portal *(the shipped `<h1>`; this row said "System Debugging")* |
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
- ~~No additional KV reads — the flag is part of the existing session object~~ *(stale remnant: the `auditSilenced` session field was removed with §5; there is no flag)*

### 8.3 DEV-Only Restriction

Feature Configuration and System Debugging are now **DEV-exclusive**. SuperAdmin users who previously had access are **rewritten to `/dashboard/access-denied`** — the URL does not change, so this is not a redirect (corrected 2026-09-19; §2.1 already said so). This is intentional — these are infrastructure-level controls that should not be accessible to business-level administrators. Note the two exceptions in §2.2: a PLAC grant reaches the diagnostics API, and Super Admin can still change a page's required role.

## 9. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | `grep -rn isDev src/pages --include=*.astro` (**five** guarded pages, not three); `api/diagnostics/run.ts` and `api/pages/toggle.ts` guards read in full; `lib/auth/stages/decide.ts` + `lib/auth/guard.ts` (PLAC is the middleware gate and default-denies); `lib/audit.ts` `handleAuditError` (console **and** Sentry); `admin_feature_flags` readers across both checkouts (none outside the toggle UI/repository) | Live `admin_pages` label for `/dashboard/debug`; historical redirect behaviour (§8.3) |
| 2026-09-14 | The guarded pages and their guard pattern; `run.ts` and `toggle.ts` guards and messages; every file under `components/admin/debug/`, `pages/dashboard/debug/`, `pages/api/diagnostics/`, `lib/diagnostics/`; `FeatureFlagRepository.ts` (D1 only); cf-astro for any `admin_feature_flags` reader; audit-silence removal (no `silence.ts`, no `auditSilenced`, `supabase/migrations/20260727000000_drop_audit_silence.sql`); `ctx.waitUntil` audit writes. Ten corrections above. | Live `admin_pages` labels in D1; historical redirect behaviour |

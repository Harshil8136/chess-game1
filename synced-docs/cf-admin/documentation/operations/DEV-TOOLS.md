---

title: "Developer Debug Portal (Edge Command Center) — Architecture & Security Reference"
status: active
audience: [ai, technical]
last_verified: 2026-10-10
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

*(A second bullet, "Feature Configuration", was removed on 2026-10-10 with the feature: its
flags table had no reader anywhere, so a switch changed nothing (§4).)*
*(A third bullet, "Audit Suppression", was removed on 2026-09-19: the feature
was deleted on 2026-07-26 and §5/§8.1 explain why it is not coming back. It
should not have survived in the overview a reader hits first.)*

All modules are protected by **Server-Side Rendering (SSR) authorization guards**, ensuring that no unauthorized content is ever sent to the client.

---

## 2. Authorization Model

### 2.1 SSR-First Security

Every Developer Tools page checks its **page key on the server** in the Astro frontmatter
(2026-10-10). The hub, Diagnostics and its history ask for `/dashboard/debug`
(`canUseDebug`); Page Registry asks for its own key, `/dashboard/debug/pages`
(`canUsePageRegistry`). Both are in `src/lib/auth/surface-guards.ts` and check the exact key
in the person's access map (`placRequireGrant`): vendor support by default (the rows' stored
role is `dev`), anyone an access grant names, and the owner and vendor support, who bypass
page-level access everywhere (ADR-0002). A missing or switched-off row refuses.

```astro
---
import { requireAuth } from '../../../lib/auth/guard';
import { canUseDebug } from '../../../lib/auth/surface-guards';

const user = await requireAuth(Astro);
if (!canUseDebug(user)) {
  return Astro.rewrite('/dashboard/access-denied');
}
---
```

*Changed 2026-10-10 (the owner's report):* until then the four pages checked the role alone
(`isDev`, an alias of `isVendorSupport`). A grant on `/dashboard/debug` showed the page in the
sidebar, which follows the access map, and the page refused it, so a grant never worked.
`test/debug-access.test.ts` fails the build if a page under `src/pages/dashboard/debug/` checks
the role again instead of its key.

**Why SSR, not client-side?** Client-side checks (e.g., `{isVendorSupport(user.role) && <Component />}`) still ship the component JavaScript to the browser. An attacker with browser DevTools could inspect, modify, or replay those components. SSR guards ensure the page HTML is never generated at all — the server rewrites to the access-denied view before any of the page's markup reaches the wire. *(2026-09-14: the guarded pages still import the deprecated `isDev` alias and use `Astro.rewrite`, not a redirect; this doc previously showed `Astro.redirect('/dashboard?error=unauthorized')`. 2026-09-19: there are **five** such pages, not three — `debug/index`, `debug/diagnostics`, `debug/diagnostics/history`, **`debug/pages`** (the page-registry manager, the highest-privilege of the set) and `settings/features`.)*

### 2.2 API Route Protection

Every API endpoint backing these features rejects an unauthenticated or
under-privileged caller, which is what stops a direct `curl`/`fetch` from
bypassing the UI. **The guards are not identical, and two of them are weaker
than the role check** — corrected 2026-09-19, this section previously said
"every API endpoint … enforces the same guard" and showed only the strict form.

The strict form, the role alone, which the Feature Flags switch and the `is_active`
half of the Modules list's switch used until both were deleted on 2026-10-10:

```typescript
import { isVendorSupport, type Role } from '../../../lib/auth/rbac';

if (!isVendorSupport(sessionUser.role as Role)) {
  return new Response(
    JSON.stringify({ error: 'Insufficient permissions: DEV only' }),
    { status: 403 }
  );
}
```

Since 2026-10-10 the routes ask for the same key as their page:

| Route(s) | Guard | Notes |
|---|---|---|
| `pages/api/diagnostics/run.ts`, `results.ts`, `infrastructure.ts` | `canUseDebug` | Until 2026-10-10 a local `checkPerm('/dashboard/debug', isDev(...))`, which honoured a grant while the pages did not, and refused the owner, whose stored map holds `false` for a vendor-only row. The 403 body is unchanged: `Insufficient permissions or access denied by PLAC policy` |
| `pages/api/system/pages.ts` (GET, PATCH), `preview.ts` | `canUsePageRegistry` | PATCH below vendor support: `registryEditRefusal` (`src/lib/auth/registry-impact.ts`) |
| `pages/api/system/console-features.ts` | `canUsePageRegistry` (`gate()` in `src/lib/access-center/registry.ts`) | Each console checks the person's own `access.manage` again; a move below vendor support stays within the editor's rank |

**The rank rule.** A grant on Page Registry must not become a way up: an Admin who could lower
an owner-only page to Admin would open it for themselves. So below vendor support a page's
required role and its on/off switch change only when the editor's own role already opens the
page, and only to a role at or below their own; a page's name, description, group and order
may change on any row. Console permissions follow the same rule. The registry offers only
those roles, and a row above the editor shows "Above your role" in place of the picker.

### 2.3 RBAC + PLAC Layering

Authorization is enforced at **three layers**:

| Layer | Mechanism | File |
|-------|-----------|------|
| **Page-Level** (PLAC) | The **middleware authorization gate** for both pages and API routes, resolved from D1 `admin_pages`. It **default-denies**: an unmapped `/api/*` path is refused outright, and a refused page is rewritten to `/dashboard/access-denied`. Sidebar visibility is a consequence of the same map, not its purpose | `lib/auth/stages/decide.ts`, `lib/auth/guard.ts`, `lib/auth/plac.ts` |
| **SSR Guard** | Astro frontmatter rewrites a person without the page's key to the access-denied view | `pages/dashboard/debug/index.astro` |
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
once on load and otherwise only when "Force Sync" is pressed (*changed 2026-10-04:* it re-ran every 30 seconds, hidden tabs included). The route checks
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
| `components/admin/debug/SystemDiagnostics.tsx` (+ `DiagnosticsInfraBar.tsx`, `DiagnosticsTestList.tsx`) | Preact island: runs the suite once on load (every 30 s until 2026-10-04) and on the button, renders the infra bar and the per-probe list |
| `pages/api/diagnostics/run.ts`, `results.ts`, `infrastructure.ts` | API: run the probe suite / read persisted results / infra snapshot; results persist to `system_test_results` |
| `lib/diagnostics/runner.ts`, `benchmarks.ts`, `types.ts`, `tests/` | The probe suite (tiers, latency grades, remediation text) |

---

## 4. Feature Configuration (removed)

The Feature Flags tab of Settings, its switch `POST /api/features/toggle`, its repository
`src/lib/dal/FeatureFlagRepository.ts` and its table `admin_feature_flags` were **deleted on
2026-10-10** (Harshil's decision; the table by migration `0069`). Nothing in cf-admin or cf-astro
read a flag, so a switch changed no behaviour anywhere (found 2026-09-19). A runtime switch that
must change behaviour is an `admin_portal_settings` row, read by the code it governs (RULESAd
RULE #0.8); cross-app runtime config goes through `service_config`
([`../features/CONTROL-PLANE.md`](../features/CONTROL-PLANE.md)).

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
| `settings/features.astro` (deleted 2026-10-10) | Feature Flags | Feature Configuration |

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

System Debugging is **DEV-exclusive** (Feature Configuration was too, until it was removed on 2026-10-10). SuperAdmin users who previously had access are **rewritten to `/dashboard/access-denied`** — the URL does not change, so this is not a redirect (corrected 2026-09-19; §2.1 already said so). This is intentional — these are infrastructure-level controls that should not be accessible to business-level administrators. Note the exception in §2.2: a PLAC grant reaches the diagnostics API.

## 9. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-10 | §2.1 to §2.3 after the Developer Tools pages and routes moved to their page keys: `canUseDebug` and `canUsePageRegistry` in `src/lib/auth/surface-guards.ts`, the four pages under `src/pages/dashboard/debug/`, the three diagnostics routes, `api/system/pages.ts`, `preview.ts` and `access-center/registry.ts`; the live rows (`/dashboard/debug` and `/dashboard/debug/pages`, both `dev`, active) and their grants read through the D1 connector; `test/debug-access.test.ts`, `test/registry-impact.test.ts`, `test/registry-console-features.test.ts` | §3 onward; the pages in a browser |
| 2026-10-10 | §1, §2.2, §4, §7 and §8.3 after the Feature Flags tab and the Modules list were deleted: `git grep` finds no `/api/features/toggle`, `/api/pages/toggle`, `FeatureFlagRepository` or `ModuleToggles` in `src/`; the page-registry manager calls `/api/system/preview` and `/api/system/pages` (`src/components/admin/debug/PageRegistryManager.tsx`) | Everything else |
| 2026-10-04 | §3.2 and the file table's `SystemDiagnostics.tsx` row against `src/components/admin/debug/SystemDiagnostics.tsx` (no interval left) | Everything else |
| 2026-09-19 | `grep -rn isDev src/pages --include=*.astro` (**five** guarded pages, not three); `api/diagnostics/run.ts` and `api/pages/toggle.ts` guards read in full; `lib/auth/stages/decide.ts` + `lib/auth/guard.ts` (PLAC is the middleware gate and default-denies); `lib/audit.ts` `handleAuditError` (console **and** Sentry); `admin_feature_flags` readers across both checkouts (none outside the toggle UI/repository) | Live `admin_pages` label for `/dashboard/debug`; historical redirect behaviour (§8.3) |
| 2026-09-14 | The guarded pages and their guard pattern; `run.ts` and `toggle.ts` guards and messages; every file under `components/admin/debug/`, `pages/dashboard/debug/`, `pages/api/diagnostics/`, `lib/diagnostics/`; `FeatureFlagRepository.ts` (D1 only); cf-astro for any `admin_feature_flags` reader; audit-silence removal (no `silence.ts`, no `auditSilenced`, `supabase/migrations/20260727000000_drop_audit_silence.sql`); `ctx.waitUntil` audit writes. Ten corrections above. | Live `admin_pages` labels in D1; historical redirect behaviour |

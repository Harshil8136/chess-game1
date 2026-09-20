---

title: "The Ghost Audit Engine (and where the permission model lives)"
status: active
audience: [ai, technical]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/audit.ts, src/lib/audit-helpers.ts, src/lib/auth/stages/record.ts, src/lib/auth/stages/decide.ts, src/lib/auth/guard.ts, src/lib/retention-tables.ts, src/pages/api/audit/logs.ts]
related_docs: [PERMISSIONS-SYSTEM.md, ARCHITECTURE.md, ../security/THREAT-MODEL.md, ../MAINTENANCE.md]
tags: [architecture, audit, logging, security, plac]
---

# The Ghost Audit Engine (and where the permission model lives)

> **Scope note — rewritten 2026-09-19.** The permission *model* — the role ladder,
> the PLAC resolution algorithm, API authorization, provisioning gates, revocation
> timing and measured cost — is owned by
> [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md). §1 and §2 below used to restate
> it, and had drifted badly: they described a middleware that lets every `/api/*`
> request past PLAC, a helper exempting only DEV, and a force-logout on every
> permission change. All three were wrong. Those sections are now **pointers**, kept
> at their original numbering so existing `§1.2` / `§2.5` references still land.
> This document remains authoritative for the **Ghost Audit engine** (§3). Where the
> two overlap, the permissions document wins.

> **TL;DR (non-technical):** How the portal records sensitive actions for
> accountability, what that record does and does not prove, and who can erase it.

This document covers the implementation, execution lifecycle and operational rules
of the Audit Engine. The Cloudflare Workers Free plan allows **10 ms of CPU per
invocation** ([`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §3.1),
which is why the engine defers every write until after the response is sent.

---

## 1. The RBAC foundation — see PERMISSIONS-SYSTEM.md

RBAC assigns every account an integer rank, lower meaning higher privilege, so a
permission check is an integer comparison. The ladder, the vocabulary translation
and the helper contract live in `src/lib/auth/rbac.ts` and are documented in
[`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §4.

### 1.1 The six-tier role hierarchy

→ [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §4.

*Corrected 2026-09-19: the table that stood here listed Viewer as "Assignable?
Yes". It is not — `viewer` has no legacy stored value and `toStoredRole()` throws
rather than write a different role. Manager does persist, as the stored value
`admin`.*

### 1.2 Naming, and why stored values differ from labels

→ [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §4.1, which carries the
stored→canonical translation table and the warning about the `super_admin` →
`admin` → `manager` rename collision.

### 1.3 No hardcoded bypass

> [!IMPORTANT]
> **There is no break-glass list, no hardcoded super-admin emails, no fallback
> grant path.** Every authenticated request must clear (a) Cloudflare Zero Trust at
> the edge, (b) the `admin_authorized_users` whitelist with `is_active = true`, and
> (c) the relevant role/PLAC gate. A previously-existing `BREAK_GLASS_EMAILS` array
> and the `isBreakGlassAdmin()` / `isHardcodedSuperAdmin()` helpers were removed
> from `src/lib/auth/rbac.ts` — confirmed by the 2026-05-24 deep review
> (`../security/reviews/2026-05-24-security-review.md`) and re-verified in the
> 2026-05-25 review.

What the two top tiers *do* get is a PLAC exemption, not a bypass of
authentication: `vendor_support` and `owner` resolve to allow on every page
([`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §6.2, ADR-0002).

**Lockout recovery** *(rewritten 2026-09-19 — the procedure that stood here did not
work):*

1. If the whitelist row for a stranded admin is wrong, a still-active admin fixes
   it through `/dashboard/users`.
2. If every admin is locked out, the row is fixed directly in Supabase (Studio or
   `psql`) using `SUPABASE_SERVICE_ROLE_KEY`.
3. **Fixing the row is not enough on its own.** A `revoked:{userId}` flag in KV
   refuses sign-in for 24 hours whatever the directory says
   (`src/lib/auth/stages/bootstrap.ts`), and the three-layer force-kick writes that
   flag. That is exactly how the only Owner was stranded on 2026-09-16 with a
   correct `role=owner, is_active=true` row. Clear the flag too: Sessions → Active
   Edge Blocks (`DELETE /api/sessions/active-revocations`), or reactivate the
   account through `/dashboard/users`, which deletes it as part of the same call.

The incident, the design and the staged remedy are in
[`../specs/2026-09-16-access-revocation-remediation-design.md`](../specs/2026-09-16-access-revocation-remediation-design.md).

### 1.4 Helper functions

Exported from `src/lib/auth/rbac.ts` and `src/lib/auth/guard.ts`.

| Function | Description |
|----------|-------------|
| `isVendorSupport` | Exact vendor-support (level 0) check |
| `isOwnerOrVendor` | Vendor-support-or-Owner; used for privileged-account edit protection |
| `isAdminOrAbove` | Level ≤ 2 |
| `isManagerOrAbove` | Level ≤ 3 |
| `requireAuth(context, minRole?)` | (`guard.ts`) Server-side auth gate for pages and API routes. Returns the user on success; throws `AuthError` 401 or 403 on failure |
| `requirePageAccess(user, pagePath)` | (`guard.ts`) Throws `AuthError(403)` if the actor's PLAC map denies `pagePath`. **Vendor support and owner are exempt; a missing map is a 403.** See §2.6 |
| `placDenyResponse(user, pagePath)` | (`guard.ts`) Response-returning wrapper around `requirePageAccess`. Returns `null` if allowed, or a fully-formed `403` JSON `Response` if denied |

*Corrected 2026-09-19: this table listed `hasPermission` as "the core gatekeeper".
It is not exported from `rbac.ts`. The `requireAuth` / `requirePageAccess` /
`placDenyResponse` rows were also orphaned below a spliced-in sub-table and a
blockquote, so they rendered outside the table entirely.*

**Deprecated aliases.** The pre-rename names are still exported and still used in
`.astro` pages. They are *aliases*, not separate logic — but three of the four now
read as a different tier than they check, which is why they are being retired
(ROADMAP chunk 20):

| Deprecated alias | Actually calls | Reads as | Really means |
|---|---|---|---|
| `isDev` | `isVendorSupport` | "developer" | Vendor support, level 0 |
| `isOwnerOrDev` | `isOwnerOrVendor` | — | Level ≤ 1 |
| `isSuperAdmin` | `isAdminOrAbove` | "super admin" | **Admin**, level ≤ 2 |
| `isAdmin` | `isManagerOrAbove` | "admin" | **Manager**, level ≤ 3 |

> `isAdmin` is the dangerous one: it does **not** mean canonical Admin. It admits
> Managers. Prefer `isManagerOrAbove` / `isAdminOrAbove`, which say what they check.

---

## 2. Page-Level Access Control — see PERMISSIONS-SYSTEM.md

PLAC is the per-user override layer over the role baseline: explicit grants and
denies keyed on `(user_id, page_path)` in D1 `admin_page_overrides`, folded once
into a flat access map that rides inside the KV session record. The authoritative
account of the schema, the resolution query, the two read predicates and the
propagation timing is [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §5–§6, §10
and §11.

### 2.1 The "compute on write, read from cache" pipeline

→ [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §7 (the stage-by-stage request
lifecycle) and §13.1 (what each path actually costs — it is four KV reads on the
warm path, not one).

### 2.2 The D1 schema integration

→ [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §5 (the `admin_pages` registry)
and §6 (the `admin_page_overrides` schema).

### 2.3 The "deny wins" resolution algorithm

→ [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §6.2.

*Corrected 2026-09-19: "deny wins" is the rule inside `computeAccessMap`, but it is
not the whole story at read time — `vendor_support` and `owner` are resolved to
allow before the map is consulted, so a deny row against either has no effect.*

### 2.4 Granular permission model (sub-features)

PLAC extends beyond page routing via **pseudo-paths**: a hash fragment appended to
a registered page path, so a micro-capability (exporting a CSV, running a
destructive prune) is resolved by the same hashmap lookup without a schema change.

**A fragment key is not a descendant of its page.** Ancestor matching requires a
`/`, and `#export` supplies none, so `/dashboard/logs#export` inherits nothing from
`/dashboard/logs`. A handler must check both, and
`src/lib/auth/surface-guards.ts` exists to make that pair the default.
[`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §5 has the full pitfall.

The registered set is data — D1 `admin_pages` where `path LIKE '%#%'` — and it
changes with every migration that adds a sub-permission. Read it there rather than
from a document. *Corrected 2026-09-19: the table that stood here listed a
`#prune` pseudo-path, which does not exist, and gave `#export` as "DEV, Owner"
when the live row requires stored `admin`, i.e. manager and above.*

### 2.5 Provisioning gatekeepers (anti-escalation measures)

→ [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §10, which lists all five gates
on `POST /api/users/access`. Note that Gate D caps a grant at the **actor's**
clearance, not the target's.

### 2.6 PLAC enforcement on API routes (`placDenyResponse`)

*Rewritten 2026-09-19.* This section said the Astro middleware "deliberately allows
every `/api/*` request through the page-level PLAC gate". That has been untrue
since 2026-08-12. There are two layers, and both apply:

1. **Pipeline default-deny.** `src/lib/auth/stages/decide.ts` resolves every
   `/api/*` path through `API_PAGE_MAPPING`. A mapped route is checked against the
   caller's access map; an **unmapped** route is denied outright. `API_DENY_MODE` in
   `wrangler.toml` selects `enforce` (403) or `shadow` (record and allow), and has
   been `enforce` since 2026-08-12. `test/api-authz-inventory.test.ts` fails CI on
   any unmapped `/api/*` route.
2. **Per-handler opt-in.** `placDenyResponse(actor, pagePath)` in
   `src/lib/auth/guard.ts`, for handlers gating on a different page than their
   prefix maps to, or on a hash sub-permission.

`placDenyResponse` behaviour, corrected:

- **Vendor support and owner** pass — not DEV alone.
- A **missing access map is a 403**, not a fall-through. Both this helper and the
  middleware gate fail closed on it.
- Exact match, then longest-ancestor match across a `/` boundary. An ancestor's
  value is inherited whether it is a grant or a deny.
- On deny: a fully-formed `403` JSON `Response` (no-store / nosniff). On allow:
  `null`.

```typescript
import { placDenyResponse } from '@/lib/auth/guard';

const actor = locals.user;
if (!actor) return jsonError(401, 'Unauthorized');
// ... other role checks ...

const denied = placDenyResponse(actor, '/dashboard/logs');
if (denied) return denied;
```

> **Known stale code comment.** The docblock above `requirePageAccess` in
> `src/lib/auth/guard.ts` still carries the same "middleware deliberately skips
> PLAC for /api/\*" sentence this section used to repeat. The code below it is
> correct; the comment is not. Flagged 2026-09-19.

The dated per-route inventory that used to sit here has been removed rather than
corrected: it named routes that have since moved under `/api/sessions/` or no
longer exist. `src/lib/auth/routes.ts` is the live mapping, and
[`../security/SECURITY.md`](../security/SECURITY.md) §6a/§6b carries the route
table with rate limits.

### 2.7 What a permission change actually does

*Rewritten 2026-09-19.* This section said that modifying a PLAC map "triggers
`forceLogoutUser()`", and that a role change fires the three-layer force-kick
"immediately after". Since 2026-09-16 neither is true.

- **Grant, revoke, reset, role change, access-request approval and page-registry
  change** all call `markAuthzChanged()` (`src/lib/auth/authz-signal.ts`), which
  writes a random `authz-changed:{userId}` mark to KV. The target's next request
  reads that mark in the same bulk KV read as the revocation flags, re-verifies
  role and map, and carries on. **Nobody is signed out, and no sign-in block is
  written.**
- **Role promotion still resets overrides.** `resetUserOverrides(env.DB, userId)`
  purges the target's D1 override rows, because a new role implies a new baseline.
- **The three-layer force-kick still exists**, but is now reserved for force-kick,
  deactivation, deletion and the Sessions console's block action. Its layers: KV
  session deletion via the `user-session:` reverse index; the 24-hour
  `revoked:{userId}` flag; and a Cloudflare API call —
  `POST /accounts/{id}/access/organizations/revoke_user` with `devices: true`, and
  **not** the per-user `active_sessions` endpoint this section previously named.

[`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §11 owns the timing.

### 2.8 Admin Pages Registry Manager

`/dashboard/debug/pages` gives oversight of the registry itself. Its security
stack:

1. **SSR gating** in the page component.
2. **API-level auth**: mutations through `/api/system/pages` check
   `isDev(actor.role)` on `locals.user` — vendor support only. *Corrected
   2026-09-19: this said `requireAuth(context, 'dev')`; `'dev'` is no longer a
   canonical Role.*
3. **Rate limiting** via Upstash Redis.
4. **Schema validation**: `admin_pages.required_role` carries a `CHECK` constraint
   pinning the legacy role names. *Corrected 2026-09-19: the migration cited here
   as `0018` lives in `database/legacy_migrations/`, not in `migrations/`.*
5. **Audit logging**: every registry mutation writes a `registry_update` action.

The manager includes an impact-analysis dry-run that computes aggregate access
gains and losses across the user base before a change is committed.

---

## 3. The Audit Engine

The Audit Engine is the forensic record for `cf-admin`. Because there is no
monolithic backend, a blocking logger would sit on the edge hot path, so writes are
deferred until after the response is sent.

**What it records, precisely** *(corrected 2026-09-19 — this section used to claim
"every action is recorded, and there is no path that skips a write"):*

| Event | Recorded? | Where |
|---|---|---|
| Any non-idempotent request (POST/PUT/PATCH/DELETE), allowed or refused | Yes — `api_mutation_attempt` / `page_mutation_attempt`, carrying `granted` | `src/lib/auth/stages/decide.ts` |
| An API authorization denial | Yes — `api_authz_deny`, or `api_authz_shadow_deny` in shadow mode | same |
| A read-only account attempting a mutation | Yes — `viewer_write_blocked` | same |
| Domain mutations in handlers (users, content, settings, control plane, cron, …) | Yes — the typed action for that operation | the handler, via `auditLog()` |
| Sign-in attempts, authorised or not | Yes, to `admin_login_logs` | `src/lib/auth/login-event.ts` |
| **A page or API read, allowed or denied** | **No** — deliberately, to spare the D1 write budget | — |
| **An insert that fails** | **No** — it is lost. `auditLog` has no retry; the only fallback is a v1-shaped insert for missing-column errors | `src/lib/audit.ts` |

Retry policy belongs to the engine and is scheduled as ROADMAP chunk 15; the
pipeline's own recorder deliberately does not carry one
(`src/lib/auth/stages/record.ts`).

### 3.1 The concept: deferred execution

A D1 write costs milliseconds the user should not pay for. The engine therefore
uses `ExecutionContext.waitUntil(promise)`: the handler returns its HTTP response
immediately, and the isolate stays alive to perform the insert.

The context is resolved through `getCfContext()` (`src/lib/env.ts`) and its
`waitUntil` is **bound** before use — workerd's `waitUntil` is a native method and
throws "Illegal invocation" when called detached from its receiver.

### 3.2 Write-path restriction at the edge — not immutability

> [!WARNING]
> The `auditLog()` write path exposes **inserts only**: there is no update
> endpoint, and no interface lets anyone edit an existing entry. Deletion is a
> different matter — see the table below.

**What this does give you.** No actor can *alter* history through the application.
The logger factory validates table names against an internal allowlist (D1 cannot
parameterise a table name), and every write goes through `auditLog()`.

**What it does not give you — and do not claim otherwise.** The log is **not
immutable, not append-only and not tamper-evident**:

- There is **no hash chain, no sequence number, no digital signature and no WORM
  storage**, so a modification leaves no detectable trace.
- `admin_audit_log` is a retention-purge target (`src/lib/retention-tables.ts`,
  180-day target), and four application paths delete from it:

| Path | Who | What it deletes | Snapshot? |
|---|---|---|---|
| `DELETE /api/audit/logs` | owner or vendor support, plus PLAC on `/dashboard/logs` | the `admin_audit_log` rows whose ids are posted | Yes — the deleted rows are embedded in a `delete` audit row written afterwards, **into the same deletable table** |
| `DELETE /api/audit/prune` | vendor support only, plus the same PLAC gate | every `admin_audit_log` row older than N days (default 30, capped at 3,650), and stale pending access requests | No |
| `/api/audit/delete-targeted` | owner or vendor support | rows from the tab's table — `admin_audit_log`, `admin_login_logs`, `access_requests` or `gsc_index_log` | Writes a master record after the fact |
| Retention review | owner or vendor support | whatever the retention sweep selects | Per that surface |

  *Corrected 2026-09-19: this list previously named `/api/audit/delete`, which
  deletes Supabase `consent_records` and not audit rows at all, and omitted
  `DELETE /api/audit/logs` — the bulk path that actually emptied the live table on
  2026-09-18.*

- Anyone with Cloudflare dashboard or API access can run arbitrary D1 SQL against
  the table. For a single-operator deployment that is the same person who owns the
  audit trail, so no separation of duties protects it.
- The snapshot defence is weaker than it reads. The bulk-delete row is written
  through `auditLog()` **without** `requestPath` or `ipHash`, so the row recording
  the erasure carries less context than the rows it replaced — the live row from
  2026-09-18 has `request_path` NULL. And it lands in the same table, so a second
  delete removes it.

[`../security/THREAT-MODEL.md`](../security/THREAT-MODEL.md) scores this correctly
as a Medium residual risk — "an Owner could delete evidence" — and
[`../MAINTENANCE.md`](../MAINTENANCE.md) C-9 tracks building real tamper-evidence.
The decided design is
[`../specs/2026-09-06-audit-log-remediation-design.md`](../specs/2026-09-06-audit-log-remediation-design.md):
append-only with one gated erasure path, three stages, **none started**, scheduled
as ROADMAP chunk 19.

> **Terminology rule (2026-07-29, still binding).** Do not describe this log as
> *immutable*, *append-only*, *tamper-evident*, *tamper-proof*, or *a ledger*, in
> engineering docs or in customer-facing copy. Velox's `copy-lint.test.ts` already
> fails the marketing build on those words.
>
> *Amended 2026-09-19.* The replacement phrasing this rule used to prescribe —
> "every privileged action is audit-logged with actor, role, path and hashed IP,
> through an **insert-only application path**" — is **withdrawn**. Four routes
> delete from the table, so the *application path* is not insert-only, and reads
> are not logged at all, so "every privileged action" overstates it. Until the
> append-only design ships, the accurate claim is narrower: **"every privileged
> mutation is audit-logged with actor, role, path and hashed IP; deletion of the
> log is restricted to the account holder and to supplier support, and is itself
> logged."**
>
> The file header of `src/lib/audit.ts` still says "Append-only audit trail". That
> comment is in scope for this rule. Flagged 2026-09-19.

**Defence in depth:** the audit logger factory validates table-name configuration
against an internal allowlist. Since D1 does not support parameterised table names,
this closes SQL injection through that argument.

### 3.3 Typed actions and modules

The engine uses strict typed unions rather than arbitrary strings, so the log can
be queried reliably: `AuditAction` and `AuditModule` in `src/lib/audit.ts`.

**Read the unions in the file; they are not restated here.** They have roughly
doubled since this document last listed them — the additions cover the control
plane, the cron surface, storage, AI inference telemetry and the auth pipeline's
own rows (`page_mutation_attempt`, `viewer_write_blocked`, `api_authz_deny`,
`api_authz_shadow_deny`), which were written by inline SQL and absent from the
union until chunk 10. *Corrected 2026-09-19: the lists that stood here named 13
actions and 14 modules.*

### 3.4 The details payload — v2, and the redaction chokepoint

Every row carries identity (`user_id`, `user_email`, `user_role`), behaviour
(`action`, `module`), impact (`target_id`, `target_type`, `target_label`) and
request context (`session_id`, `request_method`, `request_path`, `cf_ray_id`,
`ip_hash`, `correlation_id`).

The `details` column is a JSON string built by **`buildAuditDetails()`**
(`src/lib/audit-helpers.ts`), and that function is the **single redaction
chokepoint** — it moved there on 2026-09-07 so that no caller has to remember to
mask anything ([`../records/reports/2026-09-07-audit-log-hardening-sentry-and-dev-server.md`](../records/reports/2026-09-07-audit-log-hardening-sentry-and-dev-server.md)).

Shape (v2 rows carry `{ "v": 2 }` so the UI can tell the formats apart):

| Field | Meaning |
|---|---|
| `summary` | One human-readable line |
| `reason` | The actor's stated reason, when the surface collects one |
| `diff` | `FieldDiff[]` — `{ field, old, new }`, plus `isRedacted` where masked |
| `changeCount` | Length of `diff` |
| `context` | Free-form structured extras for that action |

Redaction rules worth knowing:

- `isSensitiveKey()` matches on **name segments**, not substrings: a key is split
  on case boundaries and non-alphanumerics, so `apiKey`, `api_key` and
  `providerApiKey` all match while a benign allowlist (token counts, and similar)
  is exempted first.
- A redacted `diff` field **also** poisons `context`: the field name plus `old`,
  `new` and `value` are added to the redaction set for the context pass. Without
  that, control-plane and settings mutations masked a secret in the diff and
  echoed it verbatim in the context, which made the mask cosmetic.
- `details` is truncated at **500,000 characters** with a `... [TRUNCATED]` marker.
- An insert that fails with a missing-column error is retried once against the
  **v1** column set. Any other failure is reported to Sentry and console, and the
  row is lost.

### 3.5 Navigation is not logged

*This section previously described an "In-Accessible Page Tracer": a middleware
that intercepted every dashboard navigation, wrote a "view" ledger entry with a
`granted` boolean, and let a developer "scan the audit table for denied entries to
instantly uncover repeated unauthorized access attempts".*

**That detection control does not exist, and had already been removed when this
document last claimed it.** `view` logging was deleted on 2026-08-06. Today
`src/lib/auth/stages/decide.ts` records nothing for a read, allowed or denied — its
own comment says reads are skipped "to spare the D1 write budget" — and a denied
page is *rewritten* to `/dashboard/access-denied` with the URL preserved, not
"bounced to a 403 error screen".

What is available instead, for the same question:

- **Mutations** carry `granted: false` when refused, so attempted writes against a
  denied surface are visible (`page_mutation_attempt`, `api_mutation_attempt`).
- **API denials** are recorded as `api_authz_deny`, including the reason
  (`plac_denied` or `unmapped_route`).
- **Sign-in attempts** are in `admin_login_logs` with `is_authorized_email`, which
  is where probing by non-whitelisted identities shows up.

Restoring read-level telemetry would mean one D1 write per navigation against a
100,000 rows/day free-tier budget; if it is wanted, it should be designed with
sampling or an aggregate, not reinstated as it was.

---

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-19 | claude | Re-derived against `06f8ab7`. Read `src/lib/audit.ts`, `src/lib/audit-helpers.ts`, `src/lib/retention-tables.ts`, `src/lib/auth/stages/decide.ts`, `record.ts`, `bootstrap.ts`, `guard.ts`, `authz-signal.ts`; and every handler under `src/pages/api/audit/`. Live `admin_audit_log` state taken from the 2026-09-18 fact sheet (2 rows, the bulk delete and its own attempt row, `request_path` NULL) | §1 and §2 reduced to pointers; §3 rewritten. Load-bearing corrections: the middleware does **not** skip `/api/*`; `requirePageAccess` exempts owner as well as vendor and 403s on a missing map; permission changes write an `authz-changed` mark, not a force-logout; the §3.5 "view" telemetry never existed after 2026-08-06; the deletion-path table now names `DELETE /api/audit/logs` and drops `/api/audit/delete`; the "insert-only application path" phrasing is withdrawn |

## Related

- [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) — **the permission model, authoritative**
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the wider system overview
- [`../security/THREAT-MODEL.md`](../security/THREAT-MODEL.md) — the residual-risk scoring for audit erasure
- [`../security/login-forensics.md`](../security/login-forensics.md) — `admin_login_logs`, the sign-in telemetry subsystem
- [`../MAINTENANCE.md`](../MAINTENANCE.md) — C-9, tamper-evidence

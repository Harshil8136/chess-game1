---

title: "Session Management (Security section)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-19
verified_against: [code]
owner: harshil
related_code: [src/pages/dashboard/sessions/index.astro, src/components/admin/users/sessions/SessionCommandCenter.tsx, src/pages/api/sessions/active-sessions.ts, src/pages/api/sessions/active-revocations.ts, src/pages/api/sessions/flush-sessions.ts, src/lib/auth/surface-guards.ts, src/lib/auth/routes.ts]
related_docs: [USER-MANAGEMENT.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/login-forensics.md, ../architecture/plac-and-audit.md]
tags: [sessions, security, plac, rbac, kv, forensics]
---

# Session Management

> **Scope note (2026-08-23).** This document covers the sessions console. Session
> lifecycle, revocation layers and their timing are described in full in
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).


> **TL;DR:** The **Security → Sessions** page (`/dashboard/sessions`) is the
> first-class home for live edge sessions, login forensics, and edge revocation
> blocks. Gated to canonical **Admin** and above (stored `super_admin`+) via a dedicated PLAC page row; bulk flush is
> owner/dev only. Built KV-budget-aware — auto-refresh is opt-in and self-limiting.

## Location & access

- **Route:** `src/pages/dashboard/sessions/index.astro` → `/dashboard/sessions`
  (top-level, depth-2 so it renders as a sidebar nav item). The old
  `/dashboard/users/sessions` path was **deactivated**, not deleted: migration
  `migrations/0002_promote_sessions_page.sql` re-pointed its PLAC overrides here
  and set `is_active = 0` on the old `admin_pages` rows (verified against live D1
  2026-08-23).
- **Sidebar:** the **SECURITY** section (`deriveSection` in `src/lib/auth/plac.ts`).
- **PLAC:** `admin_pages` row `/dashboard/sessions` (`required_role=super_admin` — the *stored* value; canonical **Admin**, level 2),
  seeded by `migrations/0002_promote_sessions_page.sql`, with action fragments
  `#revoke` / `#unblock` / `#flush` (owner) / `#export`. SSR access is enforced
  by the middleware `decideAccess` gate; per-user overrides are editable in the
  Access Policy Manager (grouped under "Security"). The model itself is owned by
  [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).

### Which fragments the server actually checks

*Added 2026-09-19.* Since `20c6213` the mutating routes check the page key **and**
the action key through `src/lib/auth/surface-guards.ts` (`denySessions`) — a hash
key is not a path descendant, so a page check alone never covered them. This was
gap **D-5**, closed 2026-09-16.

| Fragment | Server-checked | Where |
|---|---|---|
| `#revoke` | yes | `DELETE /api/sessions/active-sessions` |
| `#unblock` | yes | `DELETE /api/sessions/active-revocations` |
| `#flush` | yes, but see below | `POST /api/sessions/flush-sessions` |
| `#export` | **no** | No server route exists — export is built client-side from already-fetched data |

Two honest caveats:

- **The page chooses which controls to render by role alone**
  (`isSuperAdmin` / `isOwnerOrDev` in `src/pages/dashboard/sessions/index.astro`),
  not by the fragments. So a fragment deny leaves the button visible and the
  server refuses the click.
- **`#flush` cannot bind anyone.** The route keeps a hard `isOwnerOrDev` check
  alongside the PLAC one, and owner and vendor_support bypass every PLAC deny
  (`src/lib/auth/guard.ts`, ADR-0002 answer 2). So the only roles a `#flush` deny
  could apply to are already refused by the role check, and the two it would need
  to apply to cannot be denied. The in-code comment calling the fragment
  "deny-only — it can remove the capability from an owner" is wrong; it is inert.
  Raised for triage in [`../MAINTENANCE.md`](../MAINTENANCE.md) (D-5) and
  `PERMISSIONS-SYSTEM.md`, both of which record the same claim.

## Components (code-split)

`src/components/admin/users/sessions/` — the full list, corrected 2026-09-19
(seven files were previously missing):

- `SessionCommandCenter.tsx` — shell: KPI ribbon, tabs, filters, export, auto-refresh.
- `ActiveSessionsPanel.tsx`, `AuthHistoryPanel.tsx`, `EdgeBlocksPanel.tsx` — the three tab bodies.
- `SessionDetailDrawer.tsx` — per-session detail; desktop side-panel, **mobile
  bottom-sheet** (`src/components/ui/BottomSheet.tsx`). Full IP rendered here only.
- `SessionForensicsDrawer.tsx`, `AuthLogDetailDrawer.tsx`, `ForensicComponents.tsx` — the forensics HUD and log-row detail.
- `sessionRisk.ts` — pure suspicious-session heuristics (unit-tested).
- `exportSessions.ts` — pure CSV/JSON builders (unit-tested).
- `sessionTypes.ts` (`maskIp`), `sessionFormat.ts`, `sessionBadges.ts`, `useIsMobile.ts` — shared helpers.
- Styling: `src/styles/pages/session-registry.css` — token-only (`--color-*`),
  responsive (history table → stacked cards `<768px`), light/dark aware.

## Tabs & data sources

| Tab | Source | KV cost |
|-----|--------|---------|
| Active Sessions | `GET /api/sessions/active-sessions` (`kv.list` + gets) | 1 list/call |
| Authentication History | `GET /api/audit/login-logs` (D1) | none |
| Active Edge Blocks | `GET /api/sessions/active-revocations` (KV `revoked:*`) — fetched only when this tab is opened (design D2; the surface is retired in stage 2) | 1 list/call |
| KPI ribbon | `GET /api/audit/stats` (D1) | none |

> **The Edge Blocks KPI tile reads a false all-clear until the tab is opened.**
> Because the fetch is deferred, `revocations.length` is `0` on first render, so
> the tile shows **0** with the change text **"No active blocks"** styled
> `positive` (green), and the tab label reads "Active Edge Blocks (0)". This is
> the one screen an operator uses to find a user stranded behind a 24-hour
> `revoked:` block, so a green zero is the worst possible default. **Click the
> Active Edge Blocks tab before believing the tile.** The fix is to render `—`
> until loaded, or to fetch on mount; logged in
> [`../MAINTENANCE.md`](../MAINTENANCE.md). *Added 2026-09-19.*

Session-mutation endpoints (`active-sessions` DELETE, `active-revocations`
DELETE, `flush-sessions` POST) live under `/api/sessions/*` and PLAC-map to
`/dashboard/sessions` via `API_PAGE_MAPPING` in **`src/lib/auth/routes.ts`**
(*corrected 2026-09-19 — this said `src/middleware.ts`*). `force-kick` stays
under `/api/users` (used by the user registry) and maps to `/dashboard/users`.

## KV budget discipline (important)

Cloudflare KV free tier allows only ~**1,000 list/write ops per day** (reads are
100k). The active-session list is a `kv.list`, so **auto-refresh is engineered to
not burn the budget**:
- **opt-in** (default off — the manual **⟳ Refresh** is the primary control),
- **30s** minimum interval,
- **paused while the tab is hidden** (`document.hidden`),
- **hard auto-stop after 5 minutes** (worst case ~10 list ops per activation).

No UI action writes to KV except the explicit revoke/flush/lockout operations.
Export and suspicious-flagging run entirely client-side on already-fetched data.

## Features

- **Per-session detail drawer** — tap a card for full telemetry (full IP, geo,
  device, method, Ray ID, timestamps) + revoke.
- **Suspicious flagging** — `sessionRisk.ts`: unauthorized-email and blocked
  attempts (high), outdated TLS (medium), concurrent sessions across countries
  (geo conflict). `cf_bot_score` is null on the free plan and is treated as
  *no signal* (never a false "safe").
- **History filters** — outcome (success/failed) + method + search over the
  fetched window; **CSV/JSON export**.
- **Bulk flush** (owner/dev) — Purge Orphaned (stale/dev/corrupt) or Flush All
  (type-to-confirm; keeps the operator's own session). See `flush-sessions.ts`.
- **Lock Out User** — a `PATCH /api/users/manage` with `is_active: false`, gated
  by `/dashboard/users` (not this page's fragments). It force-kicks every session
  **and writes a 24-hour `revoked:` sign-in block**. Reactivating the account via
  the same PATCH clears the block; a force-kick from the user registry does not,
  and can only be lifted here under **Active Edge Blocks** (`#unblock`). See
  [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md) §5.4. *Added 2026-09-19.*
- **Privacy — masking is client-side only.** `sessionTypes.ts`'s `maskIp` shortens
  the IP in list views and the drawer shows it in full, per
  `login-forensics.md §6.2` — but `GET /api/sessions/active-sessions` and
  `GET /api/users/[id]/session-status` both return the **full `ipAddress` of every
  session** to anyone holding `/dashboard/sessions`, i.e. canonical Admin and
  above. Anyone who can open the page can read the unmasked value from the
  network tab. `GET /api/users/[id]/login-history` is different: it masks
  server-side and reveals the full IP only to Vendor Support.
  *Corrected 2026-09-19 — this previously read as though masking were a server
  boundary.* `active-sessions` also hides `vendor_support` sessions from non-vendor
  viewers, which is at odds with the 2026-07-26 no-hiding policy recorded in
  [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md) §4; both are logged in
  [`../MAINTENANCE.md`](../MAINTENANCE.md).

## Authorization changes and re-verification (2026-09-16)

A warm request reads three keys in one bulk KV read: `revoked-session:<sessionId>`,
`revoked:<userId>` (retired in stage 2 of the access revocation remediation) and
`authz-changed:<userId>`. When the mark differs from the one the session stored,
the request re-reads the user's row from Supabase and recomputes the page map
from D1 before it is authorised. Granting, revoking or resetting a page,
approving an access request, changing a role and applying a page-registry change
write the mark; none of them signs anyone out.

The periodic re-check (every `SESSION_REFRESH_INTERVAL_MS`) never writes a
sign-in block. A missing row ends the session with `access_denied`, an inactive
row with `account_inactive`, an untranslatable role with `role_unrecognised`.
A Supabase outage keeps the session for up to two intervals since the last good
check, then ends it with `recheck_failed`; a re-check forced by a mark gets no grace.
Design and rationale: [`../specs/2026-09-16-access-revocation-remediation-design.md`](../specs/2026-09-16-access-revocation-remediation-design.md).

## Verification

`npm run typecheck`; `npx vitest run test/sessions-permissions.test.ts
test/pipeline-session.test.ts` (fragment denies and the session pipeline) plus the
`sessionRisk` and `exportSessions` unit tests; load `/dashboard/sessions` as
canonical Admin / stored `super_admin` (sidebar shows Security → Sessions),
confirm a `manager`/`staff` user is access-denied, toggle auto-refresh and confirm
it pauses on tab blur and stops after 5 minutes, and open the **Active Edge
Blocks** tab to confirm the tile updates from its deferred-fetch zero.

| Date | Checked by | Result |
|---|---|---|
| 2026-09-19 | claude | Re-verified against code. Corrections: `API_PAGE_MAPPING` lives in `src/lib/auth/routes.ts`, not `src/middleware.ts`; IP masking is client-side only; the Edge Blocks tile shows a green zero until its tab is opened; `#export` has no route and `#flush` is inert; seven components and the Lock Out action were missing. |

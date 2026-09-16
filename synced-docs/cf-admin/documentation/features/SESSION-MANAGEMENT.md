---

title: "Session Management (Security section)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-16
verified_against: [code]
owner: ai-agent
related_docs: [USER-MANAGEMENT.md, ../security/login-forensics.md, ../architecture/plac-and-audit.md]
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
  Access Policy Manager (grouped under "Security").

## Components (code-split)

`src/components/admin/users/sessions/`
- `[SUPABASE_PROJECT_REF].tsx` — shell: KPI ribbon, tabs, filters, export, auto-refresh.
- `SessionDetailDrawer.tsx` — per-session detail; desktop side-panel, **mobile
  bottom-sheet** (`src/components/ui/BottomSheet.tsx`). Full IP shown here only.
- `sessionRisk.ts` — pure suspicious-session heuristics (unit-tested).
- `exportSessions.ts` — pure CSV/JSON builders (unit-tested).
- `sessionTypes.ts` (`maskIp`), `sessionFormat.ts`, `useIsMobile.ts` — shared helpers.
- Styling: `src/styles/pages/session-registry.css` — token-only (`--color-*`),
  responsive (history table → stacked cards `<768px`), light/dark aware.

## Tabs & data sources

| Tab | Source | KV cost |
|-----|--------|---------|
| Active Sessions | `GET /api/sessions/active-sessions` (`kv.list` + gets) | 1 list/call |
| Authentication History | `GET /api/audit/login-logs` (D1) | none |
| Active Edge Blocks | `GET /api/sessions/active-revocations` (KV `revoked:*`) — fetched only when this tab is opened, so the KPI tile and tab count read 0 until then (design D2; the surface is retired in stage 2) | 1 list/call |
| KPI ribbon | `GET /api/audit/stats` (D1) | none |

Session-mutation endpoints (`active-sessions` DELETE, `active-revocations`
DELETE, `flush-sessions` POST) live under `/api/sessions/*` and PLAC-map to
`/dashboard/sessions` (`API_PAGE_MAPPING` in `src/middleware.ts`). `force-kick`
stays under `/api/users` (used by the user registry).

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
- **Privacy** — IPs are masked in list views; the full IP appears only in the
  detail drawer (`maskIp`, per `login-forensics.md §6.2`).

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

`npx tsc --noEmit`; `npx vitest run` (covers `sessionRisk` + `exportSessions`);
load `/dashboard/sessions` as canonical Admin / stored `super_admin` (sidebar shows Security → Sessions),
confirm an `admin`/`staff` user is access-denied, toggle auto-refresh and confirm
it pauses on tab blur and stops after 5 minutes.

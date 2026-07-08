---

title: "Session Management (Security section)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-07-08
verified_against: [code]
owner: ai-agent
related_docs: [USER-MANAGEMENT.md, ../security/login-forensics.md, ../architecture/plac-and-audit.md]
tags: [sessions, security, plac, rbac, kv, forensics]
---

# Session Management

> **TL;DR:** The **Security → Sessions** page (`/dashboard/sessions`) is the
> first-class home for live edge sessions, login forensics, and edge revocation
> blocks. Gated to `super_admin`+ via a dedicated PLAC page row; bulk flush is
> owner/dev only. Built KV-budget-aware — auto-refresh is opt-in and self-limiting.

## Location & access

- **Route:** `src/pages/dashboard/sessions/index.astro` → `/dashboard/sessions`
  (top-level, depth-2 so it renders as a sidebar nav item). The old
  `/dashboard/users/sessions` 301-redirects here.
- **Sidebar:** the **SECURITY** section (`deriveSection` in `src/lib/auth/plac.ts`).
- **PLAC:** `admin_pages` row `/dashboard/sessions` (`required_role=super_admin`),
  seeded by `migrations/0002_promote_sessions_page.sql`, with action fragments
  `#revoke` / `#unblock` / `#flush` (owner) / `#export`. SSR access is enforced
  by the middleware `checkPageAccess` gate; per-user overrides are editable in the
  Access Policy Manager (grouped under "Security").

## Components (code-split)

`src/components/admin/users/sessions/`
- `SessionCommandCenter.tsx` — shell: KPI ribbon, tabs, filters, export, auto-refresh.
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
| Active Edge Blocks | `GET /api/sessions/active-revocations` (KV `revoked:*`) | 1 list/call |
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

## Verification

`npx tsc --noEmit`; `npx vitest run` (covers `sessionRisk` + `exportSessions`);
load `/dashboard/sessions` as super_admin (sidebar shows Security → Sessions),
confirm an `admin`/`staff` user is access-denied, toggle auto-refresh and confirm
it pauses on tab blur and stops after 5 minutes.

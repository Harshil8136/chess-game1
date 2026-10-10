---
title: "Efficiency To-Do — KV per Click, Background Polling, Sidebar and Session Cost"
status: active
audience: [ai, technical, owner]
last_verified: 2026-10-04
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/auth/pipeline.ts, src/lib/auth/stages/session-stage.ts, src/lib/auth/stages/access-map.ts, src/lib/auth/stages/refresh-role.ts, src/lib/auth/session.ts, src/lib/auth/plac.ts, src/layouts/AdminLayout.astro, src/components/dashboard/DashboardController.tsx, src/lib/analytics/providers/index.ts, src/components/admin/debug/SystemDiagnostics.tsx, src/lib/diagnostics/tests/functional.ts, src/lib/diagnostics/runner.ts, src/lib/auth/cf-access-reconcile.ts, src/lib/jobs/registry.ts]
related_docs: [MAINTENANCE.md, architecture/PERMISSIONS-SYSTEM.md, architecture/KV-RESILIENCE.md, reference/DYNAMIC-ROLES-PBAC-DESIGN.md, specs/2026-09-16-access-revocation-remediation-design.md]
tags: [performance, efficiency, kv, d1, sessions, sidebar, polling, todo]
---

# Efficiency To-Do — KV per Click, Background Polling, Sidebar and Session Cost

> **TL;DR (non-technical):** Every click in the admin portal reads Cloudflare's
> key-value store (KV) four or five times, and some screens keep asking the
> server for fresh data every 15–60 seconds even when nobody is looking. Two of
> those screens can, if left open, use up the whole account's daily KV write
> allowance — after which **nobody can sign in** until midnight UTC. This list
> fixes the dangerous ones first (P0), then cuts each click to one KV read (P1),
> then moves the sidebar and header into the browser so only page content comes
> from the server (P2, the owner's proposal). Today's totals are small; the point
> is headroom, speed, and removing the "forgotten tab" failure.

> **Not published.** This file is listed in `SYNC_EXCLUDE_PREFIXES`
> (`.github/workflows/sync-docs.yml`): it is a list of what is wrong, which
> [`CONTRIBUTING-DOCS.md`](CONTRIBUTING-DOCS.md) §6 keeps out of the public mirror.
> [`MAINTENANCE.md`](MAINTENANCE.md) remains the live defect backlog and points here
> for efficiency work.

**How to use this list.** Items are ordered by priority. Each one states the
issue, the evidence, the fix on the **current** architecture, the saving, and the
risk. Every figure is labelled **measured** (with source and date) or
**arithmetic**. Close an item only after re-checking it against code and live
usage — the same rule as `MAINTENANCE.md`. IDs use `EF-` because `MAINTENANCE.md`
already uses `E-` for email-portal items.

---

## 1. What one click costs today

**A click swaps the page in place (since 2026-10-10, EF-9).** Every click still
asks the Worker for a whole server-rendered page, with the steps below, but the
browser keeps the sidebar and header it already has and swaps only the page.

### 1.1 A page load (code-derived, 2026-09-23)

In order — each step waits for the one before it:

| # | Step | Store | Where |
|---|---|---|---|
| 1 | Read the session record `session:{id}` (skipped if the same isolate read it in the last 5 s) | KV, 1 read | `src/lib/auth/stages/session-stage.ts` → `src/lib/auth/session.ts` |
| 2 | One bulk read of `revoked-session:{sessionId}`, `revoked:{userId}` and `authz-changed:{userId}` | KV, billed as **3** reads | `src/lib/auth/stages/session-stage.ts` |
| 3 | Sidebar: read `system:admin_pages_cache_v2` — all 86 active registry rows with labels, icons and roles — parse it and filter it for this user. When the 1-hour cache expires: a D1 re-read and 1 KV write. *Since 2026-10-10: the registry comes from D1 at most once a minute per isolate, with no KV read or write (EF-4)* | KV, 1 read (now 0; D1, 1 query a minute per isolate) | `computeNavItems` in `src/lib/auth/plac.ts`, called from `src/layouts/AdminLayout.astro` |
| 4 | Users-page badge, **admin tier and above only**: `SELECT COUNT(*) FROM admin_access_requests WHERE status = 'pending'` | D1, 1 query | `src/layouts/AdminLayout.astro` |
| 5 | The page's own data | varies | the page |

**Total before any page data: 5 KV reads, plus 1 D1 query for admins — 3 to 4
storage round trips in a row.** The header costs nothing extra: name, email,
role and session timings come from the session already read in step 1
(`locals.user`).

**Every 30 minutes** one request also waits for a Supabase call (measured
average 366 ms, p95 800 ms — Sentry, 30 days to 2026-09-23) and writes the session
back to KV. **Every hour** one request rebuilds the access map (183 D1 rows read,
measured 2026-09-23) and writes the session again. Each session write is a KV
read followed by a KV write (`patchSession` re-reads the record first).

### 1.2 An API call from a page

Every `fetch('/api/…')` a page's widgets make after loading — and every
auto-refresh — is a separate Worker request through the same pipeline: steps 1–2,
so **4 KV reads and 2 round trips**, before the route's own work.

### 1.3 Account usage for context (measured, Cloudflare GraphQL Analytics, 16–22 Sep 2026)

| Resource | Free limit per day (whole account) | Used per day | cf-admin sessions |
|---|---|---|---|
| KV reads | 100,000 | 2,029–3,509 | about 390 |
| KV writes | 1,000 | 40–152 | about 21 |
| KV deletes | 1,000 | 0–7 | — |
| D1 rows written | 100,000 | 108–555 (`madagascar-db`) | — |

The KV write and delete limits are **account-wide** and shared with cf-astro's
`ISR_CACHE`. When a limit is reached, further operations of that type fail until
00:00 UTC ([Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
Session creation writes KV, so **exhausting KV writes blocks every new sign-in**.

---

## 2. The list

### P0 — can exhaust the account's KV quota

#### EF-1. The diagnostics page re-runs its full test suite every 30 seconds

> **Partly done 2026-10-04** ([record](records/reports/2026-10-04-resource-usage-optimisation.md)):
> the 30-second re-run is gone. The suite runs once when the page opens and
> otherwise only on the button, and the audit-log probe no longer counts the
> whole table (it reads the newest entry and counts the last 7 days up to
> 1,000). Still open: the run on open includes the KV and R2 write-cycle
> tests, and the 30-day prune is unchanged.

- **Issue.** `/dashboard/debug/diagnostics` runs the suite when it opens and again
  every 30 s, with no opt-in and no pause when the tab is hidden. Each run does a
  KV write, read and delete (the `kv_write_cycle` test), an R2 write and delete,
  about 10 outbound connectivity probes, a 17-row D1 insert into
  `system_test_results` (7 connectivity + 6 functional + 4 security tests), two
  audit rows, and a `DELETE … WHERE created_at < datetime('now','-30 days')` that
  no index serves, so it scans the whole results table on every run.
  *Corrected 2026-09-23: this said 13 rows and omitted the prune; see
  [`OPTIMIZATION-TODO.md`](OPTIMIZATION-TODO.md) OPT-R1.*
- **Evidence.** `src/components/admin/debug/SystemDiagnostics.tsx` (`runSuite(true)`
  on mount, then `setInterval(…, 30000)`); `src/lib/diagnostics/tests/functional.ts`;
  `src/lib/diagnostics/runner.ts`.
- **Cost (arithmetic).** 120 runs an hour → 120 KV writes **and** 120 KV deletes
  an hour. An open tab exhausts the account's 1,000 daily writes and 1,000 daily
  deletes in about **8.3 hours** — then sign-ins fail until midnight UTC. D1 goes
  first: the table grows 17 rows a run and each prune reads all of it, so reads
  add up to about 8.5 × runs², which reaches the account's 5,000,000 daily D1 row
  reads after about 767 runs — **about 6.4 hours** — and then every D1 query on
  the account fails until midnight UTC, cf-astro's included.
- **Not yet triggered (measured 2026-09-23):** `system_test_results` holds 6 runs,
  the last on 2026-07-16. The page is vendor-only (`/dashboard/debug`).
- **Fix.** Make auto-run opt-in and off by default, as
  `src/components/admin/cron/CronDashboard.tsx` already does. Pause while
  `document.hidden`. Exclude the write-cycle tests (KV, R2) from automatic runs,
  so they run only on an explicit click. Prune `system_test_results` at most once
  a day instead of on every run (or give the prune an index that leads with
  `created_at`), and add the prune to `test/hot-query-plans.test.ts`.
- **Saving.** Up to 120 KV writes + 120 deletes per open hour → 0.
- **Size.** Small, one component and the runner's test selection.

#### EF-2. The dashboard rewrites a KV cache all day while open

> **Fixes 1 to 3 done 2026-10-04** ([record](records/reports/2026-10-04-resource-usage-optimisation.md)):
> the dashboard polls every 5 minutes, only while the tab is on screen (and at
> once on return when its data is older than that; `src/lib/visible-poll.ts`),
> and each refill writes one KV key that carries its own fetch time. An open
> tab now costs at most 12 KV writes an hour, and none while hidden. Fix 4
> (move the snapshot to D1) is not done.

- **Issue.** The dashboard home fetches `/api/dashboard/metrics` every 60 s and
  never pauses when the tab is hidden. The metrics are cached in KV for 5 minutes,
  and every refill writes **two** keys (an active copy with a 5-minute TTL and a
  stale copy with none). Each refill also runs 8 provider fetches (Cloudflare,
  Supabase, Sentry, Brevo), each one or more outbound API calls.
- **Evidence.** `src/components/dashboard/DashboardController.tsx`;
  `src/lib/analytics/providers/index.ts` (`telemetry_metrics_cache_v2`,
  `telemetry_metrics_cache_stale_v2`).
- **Cost (arithmetic).** One open dashboard → 12 refills an hour → **24 KV writes
  an hour**: 192 over an 8-hour day, **576 over 24 hours (58% of the account's
  daily writes)**. Plus about 300 KV reads an hour (4 for the pipeline and 1 for
  the cache per poll). The cache key is shared, so several viewers do not multiply
  it — one forgotten tab is enough. The polling also keeps the session alive, so
  the 30-minute re-check and the hourly rebuild keep running for nobody.
- **Fix, in order.**
  1. Pause while `document.hidden`. The pattern exists in
     `src/components/admin/users/sessions/SessionCommandCenter.tsx`.
  2. Poll every 5 minutes, matching the cache TTL. Polling faster only re-reads
     the same cached value.
  3. Store one value holding its own fetch time instead of two keys: 1 write per
     refill.
  4. Move the snapshot from KV to one D1 row. D1 allows 100,000 rows written a day
     against KV's 1,000 writes; a 5-minute refresh is at most 288 row writes a day.
     Use an existing table (RULE #0.9) — a key in `admin_portal_settings` fits.
  - **Not an option:** the Workers Cache API. Cloudflare's docs state it "is not
    currently available" for Workers fronted by Cloudflare Access
    ([Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)).
- **Saving.** 24 KV writes an hour → 0 while hidden; at most 12 an hour while
  visible with fix 3; 0 KV writes with fix 4.
- **Size.** Small.

### P1 — the cost of every click

#### EF-3. Retire the `revoked:{userId}` flag

- **Issue.** Read on every request (in the bulk read) and at every sign-in, to
  honour a 24-hour sign-in block that ordinary permission changes no longer write.
- **Fix.** Stage 2 of the access-revocation remediation
  ([`specs/2026-09-16-access-revocation-remediation-design.md`](specs/2026-09-16-access-revocation-remediation-design.md)):
  deactivation is the only lockout; the flag goes.
- **Saving.** 1 KV read per request, 1 per sign-in.

#### EF-4. Put the sidebar menu in the session

- **Done differently, 2026-10-10.** The KV copy is gone: the registry, which now also names
  every page heading, tab and title, is read from D1 at most once a minute per isolate and
  filtered per person (`src/lib/auth/page-registry.ts`). That removes the KV read on every
  page and the hourly KV write, and a registry edit shows within a minute instead of an hour,
  without growing the session. The menu itself is still computed per page load (about 100
  rows filtered in memory).
- **Issue.** Step 3 above: every page load reads the whole registry from KV and
  filters it, although the menu only changes when the user's access changes.
- **Fix.** Compute the menu items when the access map is computed (sign-in, the
  30-minute re-check, a forced recompute) and store them in the session record.
  `AdminLayout.astro` renders from `locals.user`. Permission and role changes
  already trigger a recompute through the `authz-changed` mark; a label or icon
  edit in the page registry must do the same, or the menu stays stale until the
  next re-check (at most 30 minutes).
- **Saving.** 1 KV read and one parse of 86 rows per page load; the hourly D1
  re-read and KV write of the shared cache disappear.
- **Risk.** The session record grows by a few KB (KV's value limit is 25 MiB).

#### EF-5. Take the pending-requests badge off the page path

- **Issue.** Step 4 above: one D1 round trip on every page load for admins, to
  show a number that is usually 0 (0 pending on 2026-09-23).
- **Fix.** Load the count once per tab after the page renders (one small API
  call), or keep it in the browser shell (EF-8) and refresh it on focus.
- **Saving.** 1 sequential D1 round trip per page load for admins.

#### EF-6. Fold the hourly access rebuild into the 30-minute re-check

- **Issue.** Two timers each end in a session write: the 30-minute re-check
  (`src/lib/auth/stages/refresh-role.ts`) and the hourly rebuild
  (`src/lib/auth/stages/access-map.ts`).
- **Fix.** Rebuild the map inside the re-check. Changes already land immediately
  through the `authz-changed` mark, so the hourly timer is only a safety net that
  the re-check already provides.
- **Saving.** 8 KV writes per user per 8-hour day (26 → 18 in
  [`architecture/PERMISSIONS-SYSTEM.md`](architecture/PERMISSIONS-SYSTEM.md)
  §13.3's arithmetic).

#### EF-7. One KV read per request

- **Issue.** After EF-3 a request still reads three keys: the session record,
  `revoked-session:{sessionId}` and `authz-changed:{userId}`.
- **Fix.** Move the per-user change signal into the session record itself. When an
  administrator changes a user, rewrite that user's live session records — found
  through the existing `user-session:{userId}:*` index — marking them stale,
  instead of every request reading a separate key. The cost moves from every
  click to the rare admin action: 1 KV list plus 1 write per live session.
- **Check before removing `revoked-session:`.** KV's eventual consistency applies
  equally to a deleted session record and to a newly written flag — both can be
  seen stale for up to about 60 s at other locations — so the flag's extra
  protection appears to be only against the 5-second isolate cache. Confirm that
  reading before relying on it; Cloudflare Access revocation (the three-layer
  kick's third layer) remains the edge backstop.
- **Risk — a lost update.** `patchSession` reads, modifies and writes the record;
  an admin rewrite landing between that read and write is overwritten. Keep
  writing the existing `authz-changed:{userId}` mark on every admin change, and
  read it only in the 30-minute re-check instead of on every request: a lost update
  then heals within one interval, with no schema change and one KV read per
  half-hour instead of per click.
- **Saving.** A warm request becomes **1 KV read and 1 round trip**, for pages and
  API calls alike.

### P2 — keep the sidebar and header in the browser (owner's proposal, 2026-09-23)

#### EF-8. A browser-held shell: only page content comes from the Worker

- **The idea.** While a person is signed in, the sidebar menu and the header (name,
  role, email, badge) are kept in their browser, so each click fetches only the
  page's own content from the Worker.
- **What cannot move to the browser.** Checking that this person may see this page
  or call this API. Anything in the browser can be edited by its user, so the
  server still reads the session and authorizes **every** page and API call. The
  browser copy is presentation only: a tampered menu only shows links that answer
  403.
- **Design on the current architecture.**
  1. The server includes a short `shellVersion` in every page — a hash of role,
     access map and registry version. After EF-4 and EF-7 it is already in the
     session, so this costs no read.
  2. The browser keeps the shell in `sessionStorage` under
     `shell:{userId}:{shellVersion}`. `sessionStorage` ends with the tab, which is
     safer than `localStorage` on a shared computer.
  3. On each page load a small inline script (carrying the per-request CSP nonce)
     paints the menu and header from storage before first paint when the version
     matches. If it doesn't, or storage is empty, it shows a skeleton and calls
     one endpoint (for example `/api/me/shell`, proposed) once, then stores the
     result.
  4. Sign-out clears the storage. A permission, role or registry change changes
     the version, so the next page refetches. A different user's key is ignored.
  5. The server stops rendering the sidebar HTML and computing the menu.
- **Is the saving significant? Measured against today:** it removes step 3 (1 KV
  read) and, for admins, step 4 (1 D1 query) from every page load, plus the sidebar
  HTML and its render work. After EF-4 and EF-5 those reads are already gone, so
  EF-8's own saving becomes response size and render CPU (not measured), and it
  enables EF-9. The larger savings on this list are EF-1, EF-2 and EF-7.
- **Risks.** A flash on the first page in a new tab while storage is empty; the
  inline script needs the CSP nonce; the menu must stay a real `<nav>` of links for
  accessibility; the badge can be minutes stale unless it refreshes on focus.
- **Size.** Medium: the layout, one island, one endpoint, sign-out.

#### EF-9. Client-side navigation — ✅ done 2026-10-10

- **What shipped.** `<ClientRouter />` in `src/layouts/AdminLayout.astro`. The
  sidebar, top bar, session watchdog, toasts and dialogs carry
  `transition:persist` **and** `transition:persist-props`, so they stay mounted
  and are never re-hydrated (a re-hydrated Preact island mounts a second copy
  beside the first). Each page carries the frame's new data (current path, the
  list of pages, breadcrumbs) in one `<script type="application/json"
  id="shell-state">` block that the kept islands read after each swap
  (`src/lib/shell-state.ts`). Link prefetching is off (`prefetch: false` in
  `astro.config.ts`), so the router asks the Worker for nothing the person did
  not click.
- **The answers to the spike questions.** Swapped-in scripts get the first page's
  nonce in `astro:after-swap`, before the router runs them
  (`src/components/navigation/NativeNavigationState.astro`;
  [SECURITY.md](./security/SECURITY.md) §4). Page scripts set themselves up on
  `astro:page-load` only, which fires on the first load and after every swap
  (`test/client-navigation.test.ts` fails a page that also checks
  `document.readyState`, which would bind twice). Sign-out and an expired session
  still do a full load on purpose.
- **Limit, unchanged.** Each click is still one Worker request with its session
  read, and the server still renders the whole page; the saving is the browser's
  (no re-download, re-parse and re-hydration of the frame), not the Worker's.

### P3 — optional, or small and independent

#### EF-10. Zero KV reads per request: a signed session cookie (only if ever needed)

- **Idea.** An HMAC-signed cookie carrying user ID, role or tier, a permission
  bitmask, an authorization version and the issue time, verified with WebCrypto on
  each request. The KV record is still written at sign-in, for the Sessions screen,
  but is not read per click.
- **No new secret needed.** Derive the key with HKDF from an existing secret, as
  the unsubscribe and share-token paths already do (`src/lib/crypto/hkdf.ts`), so
  RULE #0.8's env-var cap is untouched.
- **Trade-offs.** A permission change lands at the next re-validation (every 5–15
  minutes) unless one per-user key is read, which is back to 1 read. The Sessions
  screen's "last active" goes stale. The cookie must stay under 4 KB (a bitmask
  keeps it small). A kick still works at once through Cloudflare Access
  revocation.
- **Recommendation.** Not now. KV reads are at 0.4% of the daily limit; EF-7's one
  read per request is enough.

#### EF-11. The Access-sync cron reads the whole user list every 5 minutes

> **Done 2026-10-04 through Cron Control, not code:** `cf-access-reconcile`
> carries a 60-minute interval in the live control document (read-only D1
> query, 2026-10-04), so it runs about 24 times a day. The `shouldRun` gate
> suggested below was not needed.

- **Issue.** `src/lib/auth/cf-access-reconcile.ts` fetches every active user from
  Supabase on each 5-minute tick to hash the list, and usually finds nothing
  changed. **Measured: 312 Supabase reads of `admin_authorized_users` in the 24 h
  to 2026-09-23 06:30 UTC (Supabase edge logs), about 288 of them from this job.**
- **Why it can be rarer.** Adding, editing or removing a user already syncs
  directly (`src/pages/api/users/manage.ts`, `src/pages/api/users/cf-resync.ts`),
  so the poll only catches edits made outside the app.
- **Fix.** Give the job an interval gate — hourly or daily — using the pattern
  `storage-notifications` already uses in `src/lib/jobs/registry.ts` (`gateKeys`
  plus `shouldRun`).
- **Saving.** About 288 Supabase calls a day down to 24 (hourly) or 1 (daily).

#### EF-12. Other background refreshes

| Screen | Interval | On by default | Pauses when hidden | Action |
|---|---|---|---|---|
| Dashboard home | 5 min (60 s until 2026-10-04) | yes | **yes** since 2026-10-04 | EF-2, done |
| Diagnostics | none since 2026-10-04: once on open, then the button (was 30 s) | — | — | EF-1, partly done |
| Email portal queue | 15 s | only while queued or scheduled items are shown | **no** | add a hidden-tab pause |
| Sessions | 30 s | no — opt-in "Live" mode, which switches itself off after 5 minutes (`SessionCommandCenter.tsx`); *corrected 2026-09-23, this said "yes"* | yes | none |
| Cron control | 60 s | no (opt-in) | **no** — once switched on it keeps polling a hidden tab (`CronDashboard.tsx`); `/api/cron` was the most-requested app endpoint in the week to 2026-09-22 (253 real requests, 157 of them on 2026-09-21) | add a hidden-tab pause; *corrected 2026-09-23, this said "none"* |
| System alerts | user-chosen | no (0 = off) | — | none |

---

## 3. Where each stage leaves one click

KV figures are from the code paths in §1; round-trip latency is **not measured**
(KV and D1 calls are not traced in Sentry).

| After | Page load | API call | Storage round trips before page data | A forgotten tab |
|---|---|---|---|---|
| Today | 5 KV reads, +1 D1 query for admins | 4 KV reads | 3–4 | dashboard: 24 KV writes/h; diagnostics: 120 writes + 120 deletes/h |
| P0 (EF-1, EF-2) | unchanged | unchanged | unchanged | 0 KV writes while hidden |
| EF-3 to EF-6 | 3 KV reads | 3 KV reads | 2 | — |
| EF-7 | 1 KV read | 1 KV read | 1 | — |
| EF-8 | 1 KV read, no sidebar render | 1 KV read | 1 | — |
| EF-10 (optional) | 0 | 0 | 0 | — |

At today's traffic (about 390 cf-admin KV reads a day) EF-7 would bring reads to
roughly a quarter of that — arithmetic, and small either way. The practical
gains are the removed failure mode (P0), one storage round trip per click instead
of three or four, and headroom as users are added.

---

## 4. What stays on the server, whatever is built

- Authorization of every page and every API call.
- Revocation: deleting sessions and the Cloudflare Access revocation call.
- The audit trail.

The browser shell (EF-8) and a signed cookie (EF-10) change what is *cached*,
never who *decides*.

---

## Related

- [`architecture/PERMISSIONS-SYSTEM.md`](architecture/PERMISSIONS-SYSTEM.md) §7 and
  §13 — the request pipeline and its resource accounting.
- [`reference/DYNAMIC-ROLES-PBAC-DESIGN.md`](reference/DYNAMIC-ROLES-PBAC-DESIGN.md)
  §13 — the owner's three-tier permission model; EF-3, EF-4, EF-6 and EF-7 carry
  over to it unchanged.
- [`architecture/KV-RESILIENCE.md`](architecture/KV-RESILIENCE.md) — KV failure
  behaviour and the account-wide budget shared with cf-astro.
- [`MAINTENANCE.md`](MAINTENANCE.md) — the live defect backlog.

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-10-10 | claude | `src/layouts/AdminLayout.astro`, `src/lib/shell-state.ts`, `NativeNavigationState.astro`, `astro.config.ts`, the built router script after `npm run build`; `test/client-navigation.test.ts` | §1's opening and EF-9: the router is mounted. §1's step costs not re-derived (unchanged: every click is still one server render) |
| 2026-10-10 | claude | `src/lib/auth/page-registry.ts`, `computeNavItems` in `src/lib/auth/plac.ts`, `src/layouts/AdminLayout.astro`; `test/page-registry.test.ts` | Step 3 and EF-4: the sidebar's KV copy is gone, replaced by a D1 read at most once a minute per isolate. The rest of §1 and §3 not re-derived |
| 2026-10-04 | claude | `src/components/dashboard/DashboardController.tsx`, `src/lib/visible-poll.ts`, `src/lib/analytics/providers/index.ts`, `src/components/admin/debug/SystemDiagnostics.tsx`, `src/lib/diagnostics/tests/security.ts`; read-only D1 query of the live `cron-control` row | EF-2 fixes 1-3 and EF-11 done, EF-1 partly; §EF-12's first two rows updated. Not re-checked: §1's per-click costs, EF-3 to EF-10, the other EF-12 rows |
| 2026-09-23 | claude | Read the auth pipeline, `src/lib/auth/session.ts`, `computeNavItems` in `src/lib/auth/plac.ts`, `src/layouts/AdminLayout.astro`, every `setInterval` under `src/components/`, the metrics provider and the diagnostics runner. Cloudflare GraphQL Analytics for KV, D1 and Worker usage (16–22 Sep 2026); Supabase edge logs (24 h); Sentry spans (30 days); live D1 queries on `admin_access_requests`, `admin_pages` and `system_test_results`. Cloudflare docs for the KV limits and for Cache API availability behind Access. | List created. EF-1 and EF-2 are latent — neither has been triggered in the measured window. |

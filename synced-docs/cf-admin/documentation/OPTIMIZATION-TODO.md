---
title: "Optimization To-Do — Runtime Cost, Duplicated Code and Repo Size"
status: active
audience: [ai, technical, owner]
last_verified: 2026-09-23
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/api.ts, src/lib/supabase.ts, src/lib/observability.ts, src/lib/jobs/runJob.ts, src/lib/jobs/registry.ts, src/lib/diagnostics/runner.ts, src/lib/gsc/client.ts, src/lib/formatters.ts, src/stores/dialogStore.ts, scripts/ratchet.py, wrangler.toml]
related_docs: [EFFICIENCY-TODO.md, MAINTENANCE.md, program/ROADMAP.md, program/DEBT-REGISTRY.md, reference/coding-standards.md, ../AI_CODE_MAINTENANCE.md, ../RULESAd.md]
tags: [performance, efficiency, duplication, refactoring, repo-size, dead-code, todo]
---

# Optimization To-Do — Runtime Cost, Duplicated Code and Repo Size

> **TL;DR (non-technical):** A whole-system review on 2026-09-23 of what wastes
> free-tier allowances, what code is written several times over, and what makes the
> repository big. Three headlines:
>
> - **The repo is 12.8 MB, and the biggest single cut is not code.** 2.4 MB is
>   images and icons nothing uses (1.6 MB of them ship with every deploy). Removing
>   them, plus a 200 KB favicon that can be 10 KB, takes the working tree from
>   12.8 MB to about 10.3 MB with nothing lost.
> - **Copy-paste is low (2.2%), but the same *patterns* are rewritten everywhere.**
>   Consolidating them into shared building blocks removes an estimated ~9,900
>   lines (about 8% of the source) and fixes a set of bugs where copies have
>   drifted apart.
> - **Several small things quietly burn quota or can break things:** tracing at
>   100% becomes billable on **2026-10-01**, the diagnostics page can exhaust the
>   account's daily D1 reads in about 6 hours, timeouts that never time out, and
>   FAQ/stats/review edits that skip version history.
>
> Nothing here is implemented. Every removal keeps the file in git history, and
> §0.2 is the protocol for cutting without breaking or losing anything.

> **Not published.** Listed in `SYNC_EXCLUDE_PREFIXES`
> (`.github/workflows/sync-docs.yml`): a list of what is wrong stays out of the
> public mirror ([`CONTRIBUTING-DOCS.md`](CONTRIBUTING-DOCS.md) §6).

---

## 0. Read this first

### 0.1 How this file relates to the others

| Document | Owns |
|---|---|
| [`EFFICIENCY-TODO.md`](EFFICIENCY-TODO.md) | The sign-in/session path: KV reads per click, the sidebar and header, dashboard and diagnostics polling (EF-1 … EF-12) |
| **This file** | Everything else found on 2026-09-23: runtime cost beyond the session path (`OPT-R`), duplicated code and boilerplate (`OPT-D`), repo size and dead weight (`OPT-S`) |
| [`MAINTENANCE.md`](MAINTENANCE.md) | The live defect backlog |
| [`program/ROADMAP.md`](program/ROADMAP.md) and [`program/DEBT-REGISTRY.md`](program/DEBT-REGISTRY.md) | The planned consolidation chunks and the ratchet counters that measure them |

**The roadmap already plans most of the consolidation**: chunk 11 (API baseplate +
island data layer + rate-limit registry), 12 (DAL v2 + SettingsService), 13.x
(per-module migrations), 15 (shared outbound HTTP client), 16 (Redis removal), 17
(structured logger) and 18 (styling tokens). This file does **not** replace those
chunks — it is the measured inventory they work from, plus the items no chunk
covers. Every item names the ratchet counter it moves and the chunk that owns it,
or says "not on the roadmap".

IDs: `OPT-R` runtime and reliability, `OPT-D` duplicated code, `OPT-S` size and
dead weight. Priorities: **P0** can exhaust an account-wide quota or break
sign-in; **P1** a bug, a leak or significant waste; **P2** worthwhile
consolidation; **P3** tidy-up.

### 0.2 Cutting without breaking or losing anything — the protocol

1. **Nothing is lost.** A deleted file stays in git history. Before a large removal
   batch, tag the commit (`git tag pre-slim-YYYY-MM-DD`) so any file is one
   `git checkout <tag> -- <path>` away.
2. **One item per commit**, and `npm run verify` before each. When a ratchet
   counter falls (A2, A4, A6, A7, A8, A13, A14, A15…), run
   `python scripts/ratchet.py --update` **in the same commit** — the ratchet treats
   an unrecorded fall as a failure (DEBT-REGISTRY "How to read and update").
3. **Start from a clean ratchet.** On 2026-09-23 the ratchet already fails on the
   working tree (A4 374 → 375, A7 700 → 709, A15 114,640 → 114,928) because of
   another session's uncommitted files, not because of anything here. Get a clean
   baseline before the first consolidation commit.
4. **Characterize before you migrate.** Only 14 of 147 API route modules have
   handler tests, and no Preact component has a test (vitest runs in workerd, which
   has no DOM). Write characterization tests for a slice before moving it, as
   chunk 10 did.
5. **A response-shape change updates its island in the same commit.**
6. **UI changes need the owner's browser check** — agents do not open a browser
   (`main.md`). Each UI item lists what to click.
7. **Route handlers are removed by decision, not by sweep**
   ([`../AI_CODE_MAINTENANCE.md`](../AI_CODE_MAINTENANCE.md) §4). Pruning (dead
   code) and consolidation (shared building blocks) go in separate commits (§2's
   critical rule there).
8. **This checkout is shared.** Stage only your own files.

---

## 1. An open question that changes the numbers — which Workers plan is this account on?

The repo's documents assume **Workers Free** (RULESAd RULE #0.8, the $0 program
decision). One measurement disagrees:

- **1,977 of 2,016 cron runs (98%) in the 7 days to 2026-09-23 used more than
  10 ms of CPU, and none failed** (Cloudflare GraphQL `workersInvocationsScheduled`:
  every status `success`).
- Cloudflare's limits page: Workers Free allows **10 ms CPU per invocation**, with
  "some built-in flexibility … If your Worker starts hitting the limit consistently,
  its execution will be terminated"
  ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).
  Paid allows 30 s.
- The API token in `.dev.vars` cannot read the account's subscriptions (HTTP 403),
  so this could not be settled from here.

**Why it matters:** on Free, KV allows 1,000 writes and 100,000 reads **a day**, D1
5,000,000 rows read a day, and logs/trace events 200,000 a day — so EF-1, EF-2 and
OPT-R1 are outages waiting to happen. On Paid the same limits are monthly and much
larger (KV 1 M writes and 10 M reads a month included; D1 25 B rows read), and
those items become cost and noise instead.

**Action (owner, 2 minutes):** Cloudflare dashboard → Workers & Pages → Plans.
Record the answer in `operations/OPERATIONS.md` and `program/DEBT-REGISTRY.md` §D.
**Everything below assumes Free** unless it says otherwise.

---

## 2. Measured baseline (2026-09-23)

### 2.1 Repository size

| What | Size | Files |
|---|---:|---:|
| Tracked working tree, total | **12.84 MB** | 1,061 |
| `src/` | 5.04 MB | 622 |
| `documentation/` | 3.73 MB | 157 |
| `public/` | 2.23 MB | 26 |
| `icon/` (top level) | 0.79 MB | 2 |
| `test/` | 0.50 MB | 94 |
| `package-lock.json` | 0.40 MB | 1 |
| everything else (scripts, migrations, database, config) | 1.35 MB | 159 |
| **Git history** (`git count-objects -vH`) | **10.52 MB packed** | 688 commits |

Source lines (`.ts`/`.tsx`/`.astro`/`.css` under `src/`): **123,788** — 82.5%
code, 8.5% comments, 9.0% blank. Comment share is highest in `src/lib` (20.8%) and
`src/workers` (25.1%); most of those comments record *why* a decision was made and
must stay (AI_CODE_MAINTENANCE §4), so comment trimming is not a real lever here.

### 2.2 Duplication

- **Exact copy-paste is low:** `jscpd` (≥ 8 lines, ≥ 70 tokens) over `src/` found
  **205 clone pairs, 3,186 duplicated lines — 2.2%** of 144,825 lines scanned.
  Nearly all of it sits in `src/pages/api` and `src/components/admin` (storage
  modals, the SEO settings controls, email and audit routes).
- **The real repetition is structural** — the same job done by hand in slightly
  different words each time. The ratchet already counts some of it:

| Counter | What it counts | Now | Target | Owner chunk |
|---|---|---:|---|---|
| A8 | hand-written `try {` in API routes | 330 | 0 | 11 |
| A10 | `createAdminClient(` call sites | 70 | ≤ repositories | 12 |
| A9 | Supabase `.from('` outside the DAL | 91 | 0 | 12 |
| A2 / A3 | raw `.prepare(` outside the DAL / in API routes | 104 / 48 | 0 | 12, 13.x |
| A12 | inline `getRateLimiter(` sites | 57 | 0 | 11, 16 |
| A13 | files with a hand-rolled backoff loop | 6 | 1 | 15 |
| A4 / A5 | `console.*` in `src` / in `.tsx` | 374 / 56 | 0 | 17 |
| A6 / A7 | inline `style={` / raw hex outside `src/styles` | 922 / 700 | ~0 | 18 |
| A14 | source files over 600 lines | 22 | 0 | 13.x, 18 |
| A15 | lines under `src/` (ts/tsx/astro) | 114,640 | falls | every chunk |
| A17 / A18 | files nothing imports / API routes nothing calls | 0 / 0 | 0 | 9 — **A18 has a hole, see OPT-D6** |

### 2.3 Live usage (7 days to 2026-09-23, Cloudflare GraphQL + Supabase logs)

- Account KV: 2,029–3,509 reads/day, 40–152 writes/day, 0–7 deletes/day.
- `madagascar-db`: 13,636–65,406 rows read/day, 108–555 rows written/day.
- cf-admin Worker: 287–289 cron runs/day plus 83–534 HTTP requests/day.
- Supabase (24 h): 317 reads of `admin_authorized_users` (about 288 from the
  Access-sync cron, EF-11), 290 of `conversations`, 14 of `consent_records`.
- Top app queries by D1 rows read (7 days):

| Query | Runs | Rows read | From |
|---|---:|---:|---|
| Tick settings read (12 keys, `admin_portal_settings`) | 1,989 | 41,769 | every cron tick |
| Booking email-retry scan (`booking_attempts`) | 1,973 | 9,865 | every cron tick, ungated |
| `SELECT COUNT(*) FROM admin_login_logs` | 21 | 7,333 | stats endpoints (full scan, OPT-R11) |
| Access-map build (`admin_pages` ⟕ overrides) | 30 | 5,547 | sign-in and recompute |
| Single-setting reads (two query shapes) | 4,715 | 4,713 | per-job and per-request reads |

- **Traffic, real visitors only** (`requestSource = eyeball`, admin host): the most
  requested app endpoint is `/api/cron` (253 GETs; 157 on 2026-09-21 alone — the
  cron page left open with auto-refresh on, EF-12), then `/api/dashboard/metrics`
  (82).

---

## Part A — Runtime and reliability (`OPT-R`)

### OPT-R1 (P0). The diagnostics prune scans the whole results table on every run

- **Addendum to EF-1** (which covers the 30-second auto-run and its KV cost; EF-1
  was corrected on 2026-09-23).
- **Evidence.** `src/lib/diagnostics/runner.ts` inserts one row per test — 17 tests
  (7 connectivity, 6 functional, 4 security) — then runs
  `DELETE FROM system_test_results WHERE created_at < datetime('now','-30 days')`
  **on every run**. The table's only indexes lead with `run_id` and `test_id`
  (`database/schema.snapshot.sql`), so the delete scans every row.
- **Cost (arithmetic).** The table grows 17 rows a run, so cumulative prune reads
  ≈ 8.5 × runs². At 120 runs an hour (a tab left open) that reaches the account's
  5,000,000 daily D1 row reads after about 767 runs — **about 6.4 hours** — and then
  every D1 query on the account fails until midnight UTC, including cf-astro's
  bookings and cf-admin sign-in. Each run also writes about 65 rows (17 rows × the
  table and its 2 indexes, plus 2 audit rows × 8) and makes about 10 external calls.
- **Fix.** EF-1's opt-in auto-run, plus: prune at most once a day (or index
  `created_at`), and add the prune to `test/hot-query-plans.test.ts`.
- **Verify.** `EXPLAIN QUERY PLAN` on the delete. **Effort** S.

### OPT-R2 (P1, deadline 2026-10-01). Tracing records every request

- **Evidence.** `wrangler.toml` enables `[observability.traces]` with no
  `head_sampling_rate`, so the default of 1 (100%) applies. From **2026-10-01** each
  span counts as one observability event against **200,000 a day on Free**, shared
  with Workers Logs and with cf-astro
  ([Traces — Limits & Pricing](https://developers.cloudflare.com/workers/observability/traces/)).
- **Estimate.** 10–15 spans per idle cron tick (7 D1 queries, fetches, the Sentry
  flush) → roughly 3,000–4,000 events a day from cron alone, before any page view.
  Not measured.
- **Fix.** `head_sampling_rate = 0.1` under `[observability.traces]` (Sentry already
  samples 10%), or disable traces. One line; no env var (it is config, not a
  variable).
- **Verify.** The Observability event count after 2026-10-01. **Effort** S.

### OPT-R3 (P1). Seven idle jobs report "ran", so every idle tick logs nine lines

- **Evidence.** `src/lib/jobs/runJob.ts` marks any handler that returns as `ran`;
  only 2 of 9 five-minute jobs have a `shouldRun` gate (`src/lib/jobs/registry.ts`),
  and `src/lib/jobs/telemetry.ts` logs every `ran`. GSC and PageSpeed also log
  "paused" on every tick (`src/workers/scheduled-gsc-sync.ts`,
  `src/workers/scheduled-pagespeed-sync.ts`). `src/workers/cf-entry.ts` forwards
  `log`-level console output to Sentry Logs as well. Result: 9 lines per idle tick —
  matching the ~10 events per tick measured on 2026-09-16 — and the job-health view
  counts 863 idle runs a day as work.
- **Cost (arithmetic).** 9 × 288 = **~2,592 log events a day**, doubled into Sentry.
- **Fix.** Move the GSC/PageSpeed enable and interval checks into `shouldRun` (their
  keys are already in `gateKeys`); let a handler return `'noop'`, recorded as
  `skipped`, for the audit poll, retry, reconcile and probe jobs; delete the "paused"
  lines; drop `'log'` from the Sentry console integration levels.
- **Saving.** ~2,592 events a day → about 0 on idle ticks. **Effort** S.

### OPT-R4 (P1). Seven D1 queries per idle tick; the booking-retry scan is ungated

- **Evidence.** Per idle tick: the batched settings read and a separate
  control-row read (`src/lib/jobs/runJob.ts`), the audit-poll watermark
  (`src/workers/scheduled-log-sync.ts`, not batched), the booking-retry scan
  (`src/workers/scheduled-booking-retry.ts`, no gate), the outbox probe, the
  blog-publish lookup (no gate) and the usage probe's second control read — **7
  queries, 2,016 a day** (arithmetic). The retry scan measured **9,865 rows read in
  7 days** (§2.3) and is not covered by `test/hot-query-plans.test.ts`.
- **Fix.** Read `cron-control` and `cf-audit-last-synced` in the one batched
  settings read and pass the parsed control doc to the gates; merge the two booking
  probes into one `SELECT EXISTS(…), EXISTS(…)` with a partial index; gate the blog
  job on a `blog-next-scheduled-at` setting written when a post is scheduled.
- **Saving (arithmetic).** 7 → 2 queries per tick; retry rows ~1,400 a day → ~0.
- **Side bug.** `markExhaustedRows` runs only when the scan found rows (the function
  returns early), so an attempt that ages past 24 h unscanned is never marked
  exhausted.
- **Owner option.** The Access audit poll could run every 15 minutes (288 → 96
  Cloudflare API calls a day) through the control doc's `intervalMinutes`; failed-
  login alerts would then arrive up to 15 minutes later. **Effort** S.

### OPT-R5 (P1). The email queue polls for days and downloads full email bodies

- **Addendum to EF-12.** `src/components/admin/emails/_components/useEmailPortalState.ts`
  keeps polling every 15 s while any row is `queued` **or `scheduled`** — and a
  scheduled Brevo send can wait for days. Each poll hits
  `src/pages/api/audit/emails.ts`, which selects `payload` (full HTML) and
  `delivery_events` for 50 rows with an exact count, although the list shows only
  subject, sender, cc and scheduled time. Three `console.log` calls per poll, two of
  them identical and containing the actor's email. `cache: 'no-store'` plus a `t=`
  parameter defeat the ETag.
- **Cost (arithmetic).** 240 polls an hour × 4 pipeline KV reads = **~23,000 KV
  reads a day** for one open tab; Supabase egress = 50 × row size per poll (not
  measured; free egress is 5 GB a month).
- **Fix.** Stop polling for `scheduled` (or poll it every 5 minutes); pause when
  hidden; select only the list fields and fetch the HTML when a row is expanded;
  drop the exact count after the first page; remove the logs. **Effort** S–M.

### OPT-R6 (P1). The Supabase client has no timeout and is rebuilt on every call

- **Evidence.** `createAdminClient` in `src/lib/supabase.ts` passes no `global.fetch`,
  so no request ever times out; it is called at 70 sites (A10), including the
  sign-in re-check (measured p95 800 ms) and every cron tick.
- **Fix.** Pass a fetch wrapper with `AbortSignal.timeout(5000)` (overridable for
  bulk and retention calls), and memoise one client per isolate. Belongs with
  chunk 15. **Risk** a 5 s cap on long calls — allow an override. **Effort** S.

### OPT-R7 (P1). Two timeout helpers that never time anything out

- **Evidence.** `withTimeout` in `src/lib/gsc/client.ts` and
  `src/lib/pagespeed/client.ts` creates an `AbortController` whose signal is never
  passed to `fetch` and never races the promise — so all three GSC calls and the
  PageSpeed call have **no timeout at all**. More widely, 66 of 116 server `fetch`
  sites carry no signal, including the JWKS fetch on the sign-in path
  (`src/lib/auth/cloudflare-access.ts`), `src/lib/jobs/health.ts`,
  `src/workers/scheduled-usage-probe.ts`, every call in
  `src/lib/dal/EmailTemplateRepository.ts` and the sign-in alert email in
  `src/lib/auth/security-logging.ts`.
- **Fix.** Replace both helpers with `fetch(url, { signal: AbortSignal.timeout(ms) })`
  now; the rest arrive with chunk 15's shared client (OPT-D9).
- **Risk.** Calls that used to hang now fail; they already return a result type
  that handles failure. **Effort** S.

### OPT-R8 (P1, latent). GSC and PageSpeed share one subrequest budget

- **Evidence.** Since chunk 7 every job runs in one invocation
  (`src/lib/jobs/runJob.ts`). A full GSC sync is ~29 external calls and PageSpeed
  12; with the audit poll, reconcile, probe and Sentry flush a tick where both are
  due reaches **~46–48 of the 50 external subrequests** Workers Free allows per
  invocation. One retry pushes it over, and the error lands in whichever job makes
  call 51. Both jobs are disabled today.
- **Fix.** Never run two heavy jobs in the same tick (PageSpeed skips if GSC is
  due), or give `JobContext` a per-tick external-call counter. **Effort** S.

### OPT-R9 (P1). The weekly cleanup downloads every email payload for nothing

- **Evidence.** `src/workers/scheduled-asset-cleanup.ts` selects `payload` (full
  HTML) for every `email_audit_logs` row, with no range, only to collect attachment
  keys — but those keys all live under `email-attachments/`, a prefix the same job's
  `PROTECTED_PREFIXES` never deletes (the file's own comment says so). The drafts
  scan is equally moot.
- **Fix.** Delete steps 1b and 1c. **Risk** none while the prefix stays protected.
  **Effort** S.

### OPT-R10 (P2). KV `list` and delete limits

- Every `list` call site (9) is human-triggered; no cron or poll lists KV unattended.
  The Sessions console's Live mode is opt-in and stops itself after 5 minutes.
- **The flush-all purge cap is 2,000** (`src/lib/auth/session.ts`) — above the
  account's **1,000 KV deletes a day**. Harmless today only because sessions expire
  after 24 h. **Fix.** Cap at 500. Also load the Users page's per-user session count
  lazily (`src/pages/api/users/index.ts` lists KV on every load). **Effort** S.

### OPT-R11 (P2). Stats endpoints full-scan the log tables

- `src/pages/api/retention/preview.ts` runs 6 `SUM(length(…))` full scans to build a
  size *estimate*, plus full counts on 5 D1 tables and 16 Supabase requests; replace
  the size scans with `meta.size_after` from any D1 result.
- `src/pages/api/audit/stats.ts` counts all of `admin_audit_log` and
  `admin_login_logs` plus 3 exact Supabase counts on every Sessions or Activity page
  load, while the Sessions console uses 2 of the numbers. **Measured:**
  `SELECT COUNT(*) FROM admin_login_logs` ran 21 times in 7 days and read 7,333 rows
  (every row, every time). Add a `?fields=` parameter.
- Growth risk, not a present problem. **Effort** S–M.

### OPT-R12 (P2). Audit write amplification

- Every non-GET request writes an `api_mutation_attempt` row
  (`src/lib/auth/stages/decide.ts`) and most routes write their own row too; each
  insert into `admin_audit_log` costs up to 8 rows written (the table has 7
  indexes). **Fix.** Skip the pipeline row when the route audits, or drop an
  overlapping index after checking the query plans. Coordinate with the append-only
  design (`specs/2026-09-06-audit-log-remediation-design.md`). **Effort** M.

### OPT-R13 (P2). Serial awaits

- `src/pages/api/emails/engine.ts` GET awaits 13 settings reads one after another,
  then 5 Brevo calls one after another. **Fix.** One `readSettings(keys)` and
  `Promise.all`. **Effort** S.

### OPT-R14 (P2). Upstash analytics is switched on

- `src/lib/ratelimit.ts` creates limiters with `analytics: true`, which records extra
  Redis commands on each `limit()` call (library behaviour, not measured here) across
  50 route files, against Upstash's 500,000 commands a month. **Fix.**
  `analytics: false` (chunk 16 removes Upstash altogether). **Effort** S.
- **Done.** Analytics went off on 2026-10-02, and cf-admin stopped using Upstash on
  2026-10-04 ([record](records/reports/2026-10-04-resource-usage-optimisation.md)).

### OPT-R15 (P2). A registry "apply now" writes one KV mark per active user

- `src/pages/api/system/pages.ts` writes an `authz-changed` mark per active user on
  each role-changing edit. **Option.** One global epoch key read in the existing bulk
  get — at the cost of +1 KV read per request. Leave until user counts grow.

### OPT-R16 (P2). Client hydration weight

- 52 `client:load`, 5 `client:idle`, **0 `client:visible`**, 0 dynamic imports.
  `ToastProvider` and `GlobalDialogProvider` hydrate `client:load` on every page
  (`src/layouts/AdminLayout.astro`; `client:idle` suffices). Large modals are imported
  statically (`BlogAiCopilotModal` 55 KB of source, `BrevoTelemetryView` 61 KB,
  `RetentionInspectModal` 49 KB). **Fix.** `client:idle`/`client:visible` for
  below-the-fold islands; dynamic `import()` for modals. Bundle bytes were not
  measured (no build was run). **Effort** S.

### OPT-R17 (P2). Every HTTP isolate loads all cron job modules

- `src/workers/cf-entry.ts` imports `src/lib/jobs/registry.ts` statically, pulling
  every job (GSC JWT code, cleanup, reconcile) into isolates that only serve pages.
  **Fix.** `await import()` inside `scheduled()`. Startup-CPU gain, unmeasured.
  **Effort** S.

### OPT-R18 (P2). The sitemap "ping" calls endpoints Google and Bing retired

- `src/lib/seo/pings.ts` (142 lines) calls `google.com/ping` and `bing.com/ping`;
  the repo's own `src/lib/gsc/client.ts` header says the ping GET was deprecated.
  **Decision.** Delete it, or re-point it to GSC `sitemaps.submit` / IndexNow (both
  already implemented). Confirm with one live call first. **Effort** S.

### Checked — not a problem

- **OPT-R19. The 748 HTTP 504s on the admin host (7 days) are not user failures.**
  Every one has `requestSource = earlyHintsCache` — Cloudflare's internal Early Hints
  cache lookups — with no user agent and no protocol. Worker analytics show 0 errors
  and a p99 wall time of 1.6–2.6 s in the same hours, and Sentry recorded nothing.
  **When reading zone analytics, filter on `requestSource = eyeball`.**
- **OPT-R20. Scanner probes** (`/.env`, `/.ssh/id_rsa`, `/wp-config.php` and ~40
  similar paths, hundreds a week) are all answered `302` by Cloudflare Access at the
  edge and never reach the Worker. No quota impact; no action.

---

## Part B — Duplicated code and boilerplate (`OPT-D`)

### B.1 Bugs that duplication caused — fix these first (small)

#### OPT-D1 (P1). FAQ, stats and review edits skip version history

- `src/pages/api/content/faqs.ts`, `stats.ts` and `reviews.ts` each write their own
  `INSERT … ON CONFLICT` into `cms_content` instead of using `updateCmsBlock` in
  `src/lib/cms/storage.ts`, which also records history. **These edits are never
  versioned and cannot be restored.** They also store an ISO timestamp and
  `user.email` where every other writer stores `datetime('now')` and `user.userId`.
- **Fix.** Call the existing `updateJsonBlock`. A2 −6. **Effort** S.

#### OPT-D2 (P1). Auth failures return the wrong status in 34 handlers

- **403 reported as 401 (10):** a role check fails into a blanket 401 — e.g.
  `src/pages/api/content/faqs.ts` catches `requireAuth(context, 'admin')` and
  returns 401. Also `ai/health`, `content/blocks` and the `content/{faqs,history,
  reviews,stats}` GET and POST handlers.
- **Any failure reported as 403 (10):** `arco/requests`, the `retention` routes,
  `audit/enrich`.
- **A thrown `AuthError` would become a 500 (14, latent):** the `alerts` routes,
  `emails/templates`, `users/pages`.
- **Fix.** Free with the chunk-11 baseplate (OPT-D7); the stopgap is one line per
  catch. **Effort** S.

#### OPT-D3 (P1, owner sign-off). Page-access keys have drifted

- **Split keys (8 files).** The pipeline checks one page and the handler another, so
  a user needs both grants: the 6 `alerts` routes (pipeline `/dashboard/logs`,
  handler `/dashboard/alerts`); `audit/delete` and `audit/enrich` (pipeline
  `/dashboard/logs`, handler `/dashboard/privacy`, and their caller is the privacy
  page).
- **Stale mapping keys (4).** `API_PAGE_MAPPING` in `src/lib/auth/routes.ts` has
  keys for `/api/content/{hero,gallery,faq,about}` with no route file; `faq` is a
  near miss for the live `faqs`, so `/api/content/faqs` and `/reviews` resolve to
  `/dashboard/content`, and a deny on the FAQ or reviews sub-page never reaches the
  API.
- **Registry keys the code checks (verified live 2026-09-23 against the active
  `admin_pages` rows):**
  - `/dashboard/alerts#resolve` — **present and active live, but in no migration or
    seed file.** It works today and would vanish on a rebuild from migrations.
  - `/dashboard/inquiries#view` (`inquiries/export`), `/dashboard/bookings#delete`
    (`bookings/batch`), `/dashboard/media` (`media/gallery`) — **absent** from the
    active rows and from every migration. `placDenyResponse` refuses only an
    explicit deny, so these three checks do nothing. (Whether an *inactive* row
    exists was not checked.)
- **`checkPerm` closures (9 files — 6 audit, 3 diagnostics)** re-implement page
  resolution: exact key only, no normalisation, and a deny binds **owner**, which
  the canonical resolver never does (ADR-0002). Already owned by the audit spec's
  Stage 2.
- **Aside for the owner.** `/api/access-requests` is gated on `/dashboard/inquiries`,
  so a user denied inquiries cannot even request access.
- **Fix.** Correct the 4 mapping keys and 8 handler keys; add the three missing
  registry rows through a migration (rows only — RULE #0.9) or move those checks to
  `placRequireGrant`; add a migration for `alerts#resolve`; add a test that each
  route's declared page equals, or is an ancestor or descendant of, its mapping.
  **Risk** medium — changes who reaches the alerts and privacy actions. **Effort** S.

#### OPT-D4 (P1). The error path leaks internal messages and often reports nothing

- **27 files echo internal errors to the browser**, e.g.
  `src/pages/api/retention/inspect.ts` returns
  `` `Postgres query error: ${error.message}` ``; also `retention/purge`, the `cron`
  routes, `features/toggle`, `arco/requests`. 8 files call `request.json()` inside
  the main `try` with no schema, so malformed JSON returns **500 with the parser's
  message** instead of 400.
- **Of 176 handlers that can return 500, 42 log nothing** and 57 only
  `console.error`. `jsonServerError` (sanitised body + Sentry) exists and is used in
  49 files; 102 files use `jsonError(500, …)`, 79 of them with no Sentry path.
- **Fix.** Stopgap: replace the 27 echo sites with `jsonServerError`. Structural: the
  baseplate's catch (OPT-D7). **Effort** S.

#### OPT-D5 (P1, owner decision). The revocation flag is written two ways

- `writeRevocationFlag` in `src/lib/auth/session.ts` derives its TTL from the
  session lifetime and has **0 callers**; `src/lib/auth/plac.ts` instead hardcodes
  `expirationTtl: 86400` twice (`revoked:` and `revoked-session:`). Session key names
  are also typed out as 37 string literals across 8 files.
- **Fix.** Decide the lifetime (it may be moot once access-revocation Stage 2
  retires the user flag — EF-3), keep one writer, and add a proposed
  `src/lib/auth/kv-keys.ts` next to the existing `authzChangedKey`. **Effort** S.

#### OPT-D6 (P1). Seven dead API routes, and a hole in the gate that should catch them

| Route (file under `src/pages/api/`) | Lines | Why it is dead |
|---|---:|---|
| `inquiries/update-status.ts` | 87 | Its only caller was removed in `1fa613f` (2026-09-10); the UI saves through `inquiries/edit.ts` |
| `inquiries/priority.ts`, `inquiries/assign.ts`, `inquiries/tags.ts` | 66 each | Added in `1fa613f` with no caller then or since |
| `content/ai-generate.ts` | 282 | Its caller moved to `ai-generate-stream` in `e41910a` (2026-08-11) |
| `content/blocks.ts` | 86 | Last caller removed in `6e0b98f` (2026-05-01) |
| `content/history.ts` | 121 | Never had a UI caller — **ask the owner** (keep and build a UI, or delete) |

- **Verified 2026-09-23:** the only references outside the route files are one-line
  `/** POST /api/… */` doc comments in `src/lib/schemas/inquiries.ts` and
  `src/lib/schemas/operations.ts`, and the SEC-03 exempt list in
  `scripts/rules_check.py`. No reference in cf-astro, cf-chatbot or cf-backup.
- **Why ratchet A18 reads 0:** it counts comment mentions and the `rules_check.py`
  list as callers. **Fix the gate first** — blank comments before matching (A19
  already does) and ignore `rules_check.py` — so A18 reads 7, then delete in the
  same commit and re-lock `.ratchet.json`.
- **Before deleting,** port the richer diff-based audit from `inquiries/priority.ts`
  into `src/pages/api/inquiries/edit.ts`. The deletion also orphans three
  `InquiryRepository` methods (~51 lines) and four schemas (~32 lines).
- **Saving.** 774 lines measured + ~83. **Effort** S.

### B.2 API routes — the chunk-11 baseplate (OPT-D7, P2)

**Measured (147 route files, 203 handlers, 21,084 lines).**

| Pattern | Scale | Existing helper — adopters / bypassers |
|---|---|---|
| Auth boilerplate, **6 different dialects** | 138 files, 190 handlers; 81 standalone `requireAuth` try/catch blocks = 525 lines | `requireAuth` 122 files; 21 handlers read `locals.user` directly |
| Page-access check pairs | 172 `placDenyResponse` calls; in 88 files the key equals the pipeline's own mapping (redundant under `API_DENY_MODE=enforce`) | `placDenyResponse` 112 files |
| Response envelopes, **3 shapes** | 62 raw `new Response(JSON.stringify…)` in 18 files (24 in `content/blog.ts`); 41 bodies lack `success` | `jsonOk`/`jsonError` via `src/lib/api.ts` |
| Audit writes | 109 writer calls in 82 files; 90 hand-written `if (cfCtx?.waitUntil && db)` guards; **50 of 82 files omit `extractAuditContext`**, so their rows have no session id, path or Ray id | `background()` 0 adopters |
| Rate limiting | 57 inline sites, 49 identifiers, 12+ different 429 messages; **18 calls sit outside any `try`**, so an Upstash error escapes | `safeRateLimit` 13 calls vs 43 direct |
| Body/query parsing | 18 files parse JSON with no schema; `limit` hand-parsed in 14 files, 5 with no clamp (and `Math.max(1, parseInt('x'))` is NaN) | `parseJsonBody` 55 files |
| Env and bindings | 198 `getEnv`, 101 `getCfContext`, 52 DB guards with 8 messages, 61 of them returning 500 instead of 503 | `checkBinding()` 0 adopters |
| CSRF and method handling | done centrally in `src/lib/auth/stages/classify.ts` | — nothing to do |
| CSV export | 3 of 3 use `src/lib/csv.ts` | — adopted |

**Design (for chunk 11).** A proposed `src/lib/api-route.ts` exporting
`defineRoute({ policy, body?, query?, rateLimit?, bindings?, handler })`, with a
proposed policy registry `src/lib/ratelimit-policies.ts` beside it (not
`src/lib/api/` — that would make `@/lib/api` ambiguous). The wrapper reads
`locals.user`, applies the role and page policy through `surface-guards.ts`, calls
`safeRateLimit` and returns a uniform 429 with `Retry-After`, parses body and query
with zod, checks bindings (one consistent 503), passes an `audit()` that fills
actor, request context and IP hash and anchors the write with `background()`,
serialises the result (`withETag` for GET, `jsonOk` otherwise), and turns any
throw into `jsonServerError` — never echoing `err.message`. No new dependency,
table or env var.

**Before/after (the chunk-11 pilot, `src/pages/api/access-requests/index.ts`):** 81
lines today → about 27, and the limiter moves inside error handling.

```ts
export const POST = defineRoute({
  policy: { page: '/dashboard/inquiries' },   // test-checked against API_PAGE_MAPPING
  rateLimit: 'access-requests',               // registry: 5 per hour per user
  body: accessRequestCreateSchema, bindings: ['DB'],
  async handler({ user, db, body: { requestedPath }, audit }) {
    const repo = new AccessRequestRepository(db);
    if (await repo.hasPendingRequest(user.userId, requestedPath)) throw new HttpError(409, 'Already pending');
    const id = crypto.randomUUID();
    await repo.createRequest({ id, userId: user.userId, userEmail: user.email, userRole: user.role, requestedPath });
    audit({ action: 'request_access', module: 'auth', targetId: id, targetType: 'admin_access_requests', details: { requestedPath } });
    return { message: 'Access request logged successfully.' };
  },
});
```

- **Adoption.** 104 files are mechanical (auth → access → limit → body → repository
  → audit → JSON). 43 need care: 9 public/token/webhook routes (stay hand-written),
  2 streaming, 3 CSV (return a `Response`), the chatbot proxy, the 9 `checkPerm`
  files (semantics change), 18 raw-envelope files (their islands change), 7
  `formData` routes (need a `form:` option).
- **Estimate (arithmetic, all 147 files):** auth −700, `locals.user`/`checkPerm`
  −123, page-check pairs −182, catch tails −880, audit −630, rate limiting −140,
  parsing −50, env −190, imports −450; new per-handler scaffold +380, wrapper and
  registry +300 → **net ≈ −2,650 lines (12.6% of the API routes)**. A8 → 0, A12 → 0.
- **Verify.** `npm run verify`; `test/api-authz-inventory.test.ts`,
  `test/api-authz-mapping.test.ts`, `test/guard-plac.test.ts`,
  `test/pipeline-decision.test.ts`; add a proposed `test/api-route.test.ts` that
  asserts the 401/403/429/400/503/500 envelopes, that no error message leaks, and
  that audit rows carry request context.

### B.3 Server libraries, workers, scripts and tests

**Scale.** `src/lib` 24,858 lines in 147 files; `src/workers` 1,942 lines; `scripts`
3,985 lines; `test` 12,014 lines. Estimated reduction ≈ 1,300 lines in `src/lib` +
`src/workers` (≈ 5%), plus the scripts and tests below.

| ID | Finding | Evidence | Home for the fix (proposed unless it exists) | Est. | Chunk | P |
|---|---|---|---|---:|---|---|
| OPT-D8 | Dead exports and repository methods | 19 exports with zero references (e.g. `getPaymentBadgeStyle`, `buildDefaults`, `classifyUsage`, `GRADE_DISPLAY`, `positiveIntSchema`); 5 observability helpers with no caller (`safeSync`, `guard`, `checkBinding`, `background`, `safeServiceCall`); 8 re-exports in `src/lib/api.ts`, only 1 used; 14 repository methods with no caller (e.g. `InquiryRepository.getInquiryStats`, `ServiceConfig.getConfigMap`) | delete | −510 | pruning | P1 |
| OPT-D9 | Cloudflare REST/GraphQL/Analytics Engine calls built by hand | 33 call sites in 9 files (`src/lib/analytics/providers/cloudflare.ts` 8, `src/lib/control-plane/cloudflare-admin.ts` 15 with the same guard repeated in 9 functions, `cf-access-sync`, `plac`, `jobs/health`, 2 workers, 2 routes); GraphQL `errors[]` checked in some, values string-interpolated into queries in two; 4 different tokens | `src/lib/cloudflare/api.ts` (proposed): `cfRest`, `cfGraphql`, `cfAnalyticsSql`, token as a parameter, never merged | −100 to −200 | 15 | P1 |
| OPT-D10 | Brevo "send transactional email" copied 5 times, none with a timeout | `security-logging`, `gsc/ops-alert`, `retention-email`, `storage/notify`, `storage/share-email`; `src/lib/dal/EmailTemplateRepository.ts` is an HTTP client, not D1 (7 fetches, no timeout); 34 Brevo URL lines in 13 files | `src/lib/email/brevo.ts` (proposed) | −80 | 15 | P1 |
| OPT-D11 | HTML escaping copied 9 times at 3 strengths | 4-, 5- and 3-character variants; `retention-email` interpolates with no escaping | `src/lib/email/escape.ts` (proposed) | −40 | — | P1 |
| OPT-D12 | Settings read/written outside `PortalSettingsRepository` | private `readSetting`/`writeSetting` copies in `gsc/sync`, `seo/indexnow`, `seo/review-loop`, `scheduled-log-sync`; the conditional-claim SQL duplicated verbatim in `runJob` and `observability` | add `readSetting` and `claimSettingIfAtMost` to `src/lib/dal/PortalSettingsRepository.ts` | −55; A2 −8 | 12 | P1 |
| OPT-D13 | Retry/backoff loops | 6 loops (`ai/inference`, `cf-access-sync` ×2, `plac`, `cms/revalidate`, `scheduled-log-sync`) beside `runWithRetry` in `src/lib/auth/login-event.ts` | `src/lib/retry.ts` (proposed) | −90; A13 6 → 1 | 15 | P1 |
| OPT-D14 | Swallow-and-log catch blocks | 61 blocks in 23 files (BlogRepository 12, PortalSettings 9); `safeAsync` in `src/lib/observability.ts` has 3 callers | `safeAsync` | −180; A4 falls | 17 | P2 |
| OPT-D15 | Queue/DLQ and Worker-list reads implemented twice | analytics provider vs `cloudflare-admin.ts` | one implementation | −90 | 15 | P2 |
| OPT-D16 | cf-astro "binding or URL" call pattern ×6, host spelled `https://internal` and `http://internal` | `cms/revalidate`, `cms-status`, `config-publisher`, diagnostics, `content/edge-verify`, `scheduled-booking-retry` | `src/lib/astro-client.ts` (proposed) | −16 | 15 | P2 |
| OPT-D17 | `sFetch` and `phFetch` identical but for the base URL; `audit/enrich` makes raw calls with no timeout | `sentry-admin`, `posthog-admin` | one `providerFetch` in `provider-result.ts` | −10 | 15 | P2 |
| OPT-D18 | Upstash reached over raw REST (4 sequential calls, no timeout) although `@upstash/redis` is installed | `src/lib/alert-gate.ts` | a pipelined client next to `getRedisClient` | −10; 4 → 1 subrequests | 16 | P2 — **done another way 2026-10-04**: the Upstash channel was removed, 4 → 0 |
| OPT-D19 | Hashing/encoding copies | sha256-hex ×5, base64url ×7, `timingSafeEqual` ×2 (one duplicates an export the same file imports) | `src/lib/crypto/encoding.ts` (proposed) | −55 | — | P2 |
| OPT-D20 | Job interval gates and error paths | GSC and PageSpeed gates line-for-line identical, 3 more variants; 12 log-then-capture pairs; 5 handler catch-alls that record a real failure as `ran` | `src/lib/jobs/interval-gate.ts` (proposed); a `log.fail()` on the job logger | −90 | 8c | P2 |
| OPT-D21 | Raw SQL outside the DAL | A2 = 104 lines in 43 files; 49 hit tables that already have a repository (`admin_audit_log` 16, `admin_pages` 12, `gsc_index_log` 7 — inserted from 3 places); tables with no repository: `cms_content`, `sync_outbox`, `system_test_results`, `booking_attempts` | move into repositories; 9 route files first (their repository exists) | A2 −13 now | 12, 13.x | P2 |
| OPT-D22 | `createAuditLogger` repeats `auditLog`'s body; the V1 fallback insert looks unreachable (the live schema has `target_label`) | `src/lib/audit.ts` | return `(e) => auditLog(…)` | −50 | 19 | P2 |
| OPT-D23 | Scripts | `wranglerBin` resolver ×3, `routes.ts` regex-parsed ×2 with different quote handling, `ROOT` defined in 5 scripts; `test/migrations-guard.test.ts` re-implements the manifest hash | `scripts/lib/wrangler.mjs` and `scripts/gatelib.py` (both proposed); move pure functions into `scripts/lib/migration-guards.mjs` | −34 | — | P2 |
| OPT-D24 | Test setup | the `ExecutionContext` stub ×6, `job()` finder ×3, `createStubDb` ×2 (~45 lines each), 5 files stub `fetch` directly although `fixtures/outbound.withFetch` exists | `test/fixtures/jobs.ts` and `test/fixtures/d1-stub.ts` (proposed) | −60 | — | P3 |
| OPT-D25 | Constants and types | the 12-URL static page list byte-identical in 3 files; `madagascarhotelags.com` on 75 lines in 25 files; two different `SITE_URL` and two `CfEnvLike` types; `PageOverrideInput` ×2; 9 inline zod schemas in content routes | `src/lib/seo/site-urls.ts` (proposed), `lib/schemas` | −50 | — | P3 |
| OPT-D26 | Largest library files mix jobs | `BlogRepository` 959 lines (posts + history + suggestions + categories), `InquiryRepository` 553, `gsc/sync` 524, `plac` 473 (page access + force-logout + Access revoke) | split `BlogSuggestionRepository`; move revocation to a proposed `src/lib/auth/revocation.ts` | ~0; A14 −1 | 13.x | P3 |

### B.4 UI components

**Headline.** No component file is dead (the reachability walk found every file
reachable, matching A17 = 0), so the UI shrinks by **consolidating**, not deleting.
Estimated ≈ 3,450 lines of TSX and ≈ 1,250 lines of CSS. Three copies have already
drifted into wrong behaviour (OPT-D27, OPT-D34, OPT-D35).

**Rules for every UI item:** no new npm dependency; browser-only modules go in a new
`src/lib/client/` (proposed) because `src/lib/api.ts` pulls in Sentry and must not
reach islands; hooks touch the DOM only inside `useEffect`; keep the `csvField`
re-export (a test seam), the documented `NavIcon` switch and
`NativeNavigationState` (EF-9 uses it for the page-swap nonce and progress bar).

| ID | Finding | Evidence | Shared building block (proposed unless it exists) | Est. | P |
|---|---|---|---|---:|---|
| OPT-D27 | CSV/download helpers rewritten per screen; **3 CSV builders skip the formula-injection guard** | 7 sites in 6 files. `BookingDashboard` joins values with `,` unquoted (a comma breaks the row, a leading `=` runs as a formula) and never revokes the object URL; `QueueTracker` and `RetentionInspectModal` quote but skip neutralisation. The good version (`exportSessions.ts`: `toCsv`, `downloadFile`) has 1 user | move `toCsv`/`toJson` into `src/lib/csv.ts`; a proposed `src/lib/client/download.ts` | −50, closes CSV injection | P1 |
| OPT-D28 | No client fetch layer | 84 files, 217 raw `fetch(` calls; 27 files with the full load/error/finally block; 141 mutation literals in 68 files; **192 `res.json()` calls, 18 guarded** — an edge HTML 502 surfaces as "Unexpected token <". `useChatbotApi` (8 chatbot islands) is the seed | proposed: `src/lib/client/api.ts` (`apiFetch`, `ApiError`, `ApiEnvelope`) and a `useApi` hook in a new `src/components/ui/hooks/` (proposed) | −800 (±40%) | P1 |
| OPT-D29 | ~~The §7.8 modal setup copied into every dialog~~ **Done 2026-10-10** another way: one shared `src/components/ui/Dialog.tsx` (title required, so A11Y-03 holds) with `SlideDrawer` and `BottomSheet` rebuilt on it; every pop-up moved onto it bar the three Email API modals, which `test/dialog-system.test.ts` allows until that thread moves them, and `CommandPalette` ([record](records/reports/2026-10-10-sessions-settings-github-and-pop-ups.md)) | `<dialog` 50 times in 37 files; `showModal()` 36, `cancel` handler 33, backdrop click 32, `::backdrop` 32 (15 identical); 3 overlays RULESAd §7.8 bans (`SeoConfigModal`, `SessionForensicsDrawer`, `CommandPalette`) | `src/components/ui/ModalShell.tsx` (proposed) with `labelledBy` required; rebuild `SlideDrawer` on it | −825; A6 falls | P1 |
| OPT-D30 | Three ways to confirm | `showConfirm` 8 files; 15 local `<ConfirmDialog>` copies (~20 lines of state each); native `confirm()` ×8 in 5 files; native `alert()` ×5 in 3 files | `confirmAsync`/`alertAsync` in `src/stores/dialogStore.ts` | −300 | P1 |
| OPT-D31 | No shared polling hook — the tool EF-1, EF-2 and EF-12 need | 6 polling sites, 1 pauses when hidden | `usePolling(fn, { intervalMs, enabled, pauseWhenHidden = true, maxDurationMs })` | −30 | P1 |
| OPT-D32 | Local toasts instead of `pushToast` | 11 files with their own auto-dismiss banner, none with `aria-live` (`ToastProvider` has it) | existing `pushToast`; delete the per-editor toast CSS | −190 | P2 |
| OPT-D33 | Formatters rewritten locally | relative time ×12, byte formatting ×9+ by hand, 71 inline `toLocale…String`, twins (`fmtEta` ×2, `gaugeTone` ×2); `formatBytes` lives inside `WidgetShared.tsx` (14 importers) | `formatRelative`, `formatBytes`, `formatNumber`, `formatEta`, `formatDate` in `src/lib/formatters.ts`; `WidgetShared` re-exports | −110 | P2 |
| OPT-D34 | ~~`SessionForensicsDrawer` copies the session helpers and **brings back two fixed bugs**~~ **Done 2026-10-10:** rebuilt on the shared Dialog, importing `sessionFormat.ts` and `parts.tsx` | re-declares `parseUA`, `getRelativeTimeMs`, `getMethodIcon`, `SessionInfo`. Verified 2026-09-23: it tests `linux` before `android`, so **Android sessions show as Linux**, and an unknown sign-in method shows the email icon — the C-28 fabrication `sessionFormat.ts` fixed on 2026-09-05 (RULE #0.5) | import `src/components/admin/users/sessions/sessionFormat.ts` | −45 + 2 fixes | P1 |
| OPT-D35 | Role display bypasses `ROLE_META` with **conflicting colours** | `StorageProfilesTable` declares its own `ROLE_META` (owner amber, admin red — canonical emerald and amber); `logs/Badges.tsx` shows a null role as "STAFF" (a RULE #0.5 fabrication); 4 more local maps | one proposed `src/components/ui/RoleBadge.tsx` reading `ROLE_META` in `src/lib/auth/rbac.ts`; unknown shows "Unknown" | −70 | P2 |
| OPT-D36 | Near-duplicate components | `GscSettingsControl` + `PageSpeedSettingsControl` + `ReviewLoopSettingsControl` (767 lines, 0.72 containment); ~~the SevMini SVG in `NativeNavigationState.astro` and `SevMiniLoader.tsx` (46 lines + 5 keyframes)~~ (2026-10-10: the copy in `NativeNavigationState.astro` is gone, replaced by a 2 px progress bar); 3 log tabs with identical selection scaffolding; chatbot `StatCard` ×3; `EmptyState` ×2; `Card` vs `ModernCard`; `UserCardStack`/`UserTableRow`; `FileGrid`/`FileTable`; `Composer`/`MobileComposer`. **`BotScoreBadge` ×2 disagree** (one calls >30 "Bot", the other colours <20 green; Cloudflare scores low = automated, so both look inverted — check the data before merging) | `seo/ServiceAutomationControl.tsx`, `SelectableLogTable<T>` (both proposed) | −600 | P2 |
| OPT-D37 | Small repeated pieces | clipboard ×33 in 30 files (12 show "Copied" even when the copy failed); debounce ×3; 19 search inputs (5 without an accessible name); tab state in 11 files, ≥3 without `role="tab"` although `src/components/ui/Tabs.tsx` exists; pagers ×6 | `useCopy`, `useDebouncedValue`, `ui/SearchInput`, `ui/Pager` (proposed) | −250 | P2 |
| OPT-D38 | CSS rule bodies and keyframes duplicated | 39 declaration bodies in 2+ files (84 redundant copies); the 4 CMS editors carry 922 lines of CSS in JS strings with the same rules under 4 prefixes (292 redundant); `spin`, `pulse`, `fadeIn`, `revealDown`, `dotPulse` each defined twice; two stylesheets imported twice | a proposed `src/styles/components/cms-editor.css`; one keyframe home | −490 CSS | P2 |
| OPT-D39 | Dead CSS classes — **per class, not per file** | 82 classes with no code reference own ~760 lines (e.g. most of the blog-studio stylesheet; `cron-row__*`; diagnostics; chatbot hub). Spot-check 2026-09-23: of the 18 `ios-*` classes in `src/styles/bookings.css`, **7 are used and 11 are not** — remove class by class | delete per class | −760 CSS (medium confidence) | P2 |
| OPT-D40 | Types declared in several files | diagnostics types re-declared in 2 components although `src/lib/diagnostics/types.ts` exports them; partial copies of `AdminPage` ×3, `EmailLog` ×3, `ConsentRecord` ×3, `LoginLog` ×2; 26 inline `{ success?: boolean; error?: string }` literals | `import type` / `Pick<>` from one module per entity; `ApiEnvelope` | −100 | P2 |
| OPT-D41 | Unused exports and imports | 8 exports referenced nowhere (incl. a hard-coded `HOTEL_UNITS` room list in `bookings/types.ts` — RULE #0.5 forbids that data), 33 exports used only in their own file, 4 unused imports | delete / drop `export` | −60 | P2 |
| OPT-D42 | Oversized components | 120 of 269 UI files over 200 lines, 19 over 600. Worst: `BlogManager` 1,557 lines / 23 `useState` / 12 fetches / ~10 jobs; `SeoDashboard` 29 `useState`; `PlatformAlertsManager` 29 `useState` + native `alert()` | split per coding-standards §3 **after** OPT-D28–D30 land | ~0; A14 falls | P3 |
| OPT-D43 | Styles that bypass the design tokens | 922 `style={` lines (A6); 105 inline `color: 'var(--theme-text-*)'` although the `text-text-*` utilities exist (used 458 times); 122 hard-coded status hex colours in 37 files | mechanical swap; §7.8 dialog styles move into `ModalShell` | 0 lines; A6 −105, A7 −122 | P3 |

**Verify (every UI item).** `npm run verify` (typecheck, a11y_check); new workerd
unit tests for the pure helpers (`apiFetch` with a stubbed JSON error, an HTML 502
and a timeout; the formatters with a fixed `now`; CSV with a leading `=` and an
embedded comma — extend `test/csv-injection.test.ts` and
`test/exportSessions.test.ts`). **Owner browser checks:** load, empty, error (DevTools
offline) and one mutation on each migrated screen; every dialog opened and closed by
Escape and backdrop, a confirm opened from inside a modal, a narrow viewport for the
§7.8 squished-card bugs, focus returning to the trigger; exported CSVs opened in a
spreadsheet; light and dark screenshots for OPT-D43.

---

## Part C — Repo size and dead weight (`OPT-S`)

| ID | Item | Size | Evidence (2026-09-23) | Action | P |
|---|---|---:|---|---|---|
| OPT-S1 | Top-level `icon/` folder (`icon.svg`, 2,282 paths; a `.ico`) | 786,648 B | Tracked, not under `public/`, **zero references** anywhere | Delete (history keeps it); if it is the source artwork, keep one copy outside the repo | P2 |
| OPT-S2 | Unused images in `public/` | **1,602,963 B (72% of `public/`)** | `installations/*.webp` (6 files, 1,140,420 B), `daycare`/`grooming`/`relocation`/`spa`/`transport.jpg` (303,241 B — each **byte-identical** by SHA-256 to a gallery or boarding image that is used), `logo.png`/`logo.webp` (159,302 B — the code loads the public site's copy, `madagascarhotelags.com/images/logo.*`). **Zero references** in `src`, config, `scripts` or `public/_headers`. They ship with every deploy | Check the zone logs for requests to these paths, then delete | P2 |
| OPT-S3 | `public/favicon.svg` | 200,535 B | An SVG wrapping one base64 512×512 PNG; also the sidebar logo's fallback | Replace with a 32–64 px icon or a simple vector (~5–15 KB) | P2 |
| OPT-S4 | `email-templates/` (7 Supabase Auth HTML templates) | 68,512 B | **Zero references** anywhere in the repo, docs included; Supabase Auth sign-in was removed (Cloudflare Access replaced it) | Confirm in the Supabase dashboard that no Auth email template is in use, then delete | P2 |
| OPT-S5 | Seven dead API routes (OPT-D6) | ~857 lines | see OPT-D6 | delete with the A18 fix | P1 |
| OPT-S6 | `scripts/import_legacy_blog_posts.py` | 292 lines | One-shot import applied 2026-08-30 (schema-change ledger); referenced by 2 records only | Delete (medium-high confidence) | P3 |
| OPT-S7 | A tracked `.pyc` (`scripts/__pycache__/a11y_check.cpython-313.pyc`) | 1 file | Tracked despite `.gitignore` | `git rm --cached` | P3 |
| OPT-S8 | Documentation | 3.73 MB / 157 files | 74 active (1.66 MB), 24 draft (0.62 MB), **58 historical (1.44 MB)** | **Keep.** Records are the project's memory and are already out of the public mirror and out of `main.md`'s reading path. Text costs little in git; moving them would break links for little gain | — |
| OPT-S9 | Git history | 10.52 MB packed | Largest deleted blob: a 1.48 MB SVG; ~20 versions of `package-lock.json` | **Do not rewrite history** — it forces every clone to re-sync for ~1–2 MB. Locally, `git gc` merges the 12 packs and 444 loose objects (safe, local only) | — |
| OPT-S10 | Keep as is | — | `package-lock.json` (needed), `database/legacy_migrations/` (documented by RULE #0.7b), `.ratchet.json`'s `increases` log (the audit trail), load-bearing comments | Keep | — |

**What the cuts add up to (estimates).**

| | Now | After Part C | After Parts B and C |
|---|---:|---:|---:|
| Tracked working tree | 12.84 MB | ≈ 10.2 MB (−2.5 MB: S1–S4) | ≈ 9.8 MB |
| Source lines under `src/` | 123,788 | − ~857 (dead routes) | ≈ 114,000 (− ~9,900, ≈ 8%) |
| `public/` shipped per deploy | 2.23 MB | ≈ 0.44 MB | same |
| Git history | 10.52 MB | unchanged (by design) | unchanged |

The line estimate combines the four reviews without double-counting: API routes
≈ 3,500 (baseplate + dead routes), libraries/workers/scripts/tests ≈ 1,700, UI ≈
4,700 (TSX + CSS). Each is an estimate with its arithmetic in the item.

---

## Part D — Order of work

| Phase | Items | Why now |
|---|---|---|
| **0 — this week** | §1 (plan check); OPT-R2 (before 2026-10-01); EF-1 + OPT-R1; EF-2 | quota and outage risk, one deadline |
| **1 — small bug fixes** | OPT-D1, OPT-D2 (stopgap), OPT-D4 (stopgap), OPT-D27, OPT-D34, OPT-R7, OPT-R6, OPT-R9, OPT-R5; OPT-D3 and OPT-D5 after the owner decides | each is S and fixes a real defect |
| **2 — dead weight (pruning commits, tagged first)** | OPT-D6 with the A18 gate fix; OPT-D8; OPT-D41; OPT-D39; OPT-S1–S4, S6, S7; OPT-R18 | shrinks the repo; nothing to design |
| **3 — shared building blocks** | OPT-D31 (`usePolling`), OPT-D28 (`apiFetch`/`useApi`), OPT-D29 (`ModalShell`), OPT-D30 (`confirmAsync`), OPT-D33 (formatters); OPT-R3, OPT-R4 | the tools the later migrations need |
| **4 — roadmap chunks** | chunk 11 pilot → OPT-D7; chunk 15 → OPT-D9, D10, D13, D15–D17 + OPT-R6/R7 remainder; chunk 12 → OPT-D12, D21; chunk 16 → OPT-D18, OPT-R14; chunk 17 → OPT-D14; chunk 18 → OPT-D43 | already planned; this file gives them their inventory |
| **5 — migrate screens and split** | UI migrations folder by folder (storage, users, emails, content, chatbot); OPT-D32, D35–D38, D40; then OPT-D42 splits | biggest line savings, needs the owner's browser checks |

**Decisions only the owner can make:** the Workers plan (§1); the split page keys
and `/api/access-requests` gating (OPT-D3); the revocation lifetime (OPT-D5);
keep-or-delete `/api/content/history` (OPT-D6); a 15-minute audit poll (OPT-R4);
the role colour changes (OPT-D35); the `BotScoreBadge` meaning (OPT-D36); deleting
the unused images and templates (OPT-S1–S4); the sitemap pings (OPT-R18).

---

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-10-10 | claude | `grep -rln "<dialog\b" src` and `grep -rln "showModal()" src` (only `Dialog.tsx` and the three Email API modals; `Menu.tsx` names it in a comment); read `SessionForensicsDrawer.tsx` | OPT-D29 and OPT-D34 marked done. No other row re-checked |
| 2026-10-07 | claude | `grep -rni "upstash\|getRedisClient" src/` (historical comments only, no import or client); read `src/lib/alert-gate.ts` | The two Upstash items marked done on 2026-10-04 (analytics off; OPT-D18 done another way, the Redis channel removed from the alert gate) hold. No other row re-checked |
| 2026-09-23 | claude | Four parallel read-only reviews (API routes; UI components; server libraries, workers, scripts and tests; runtime cost), each finding counted with the command recorded in its review; their key claims re-checked by hand (dead routes and their comment-only references, the no-op `withTimeout`, the CMS history bypass, `writeRevocationFlag`'s 0 callers, the diagnostics prune and its 17 tests, the session-drawer drift, image references and SHA-256 duplicates, the `ios-*` classes). `jscpd` over `src/`; `git count-objects`, `git ls-files`, `git rev-list --objects` for size and history. Live: Cloudflare GraphQL Analytics (KV, D1 queries, Worker and scheduled invocations, zone requests by path, status, hour and request source, 16–23 Sep); Supabase edge logs (24 h); Sentry issues (7 days) and spans (30 days); D1 queries on `admin_pages`, `admin_access_requests` and `system_test_results`. Cloudflare docs for Workers limits, trace billing and Cache API availability. | File created. Not verified: the Workers plan (API 403); bundle sizes (no build run); D1 latency from the Worker (not traced); `knip` export analysis (it found no unused files, matching A17 = 0, but its export pass could not be relied on in this checkout because dependencies resolve from the parent folder). |

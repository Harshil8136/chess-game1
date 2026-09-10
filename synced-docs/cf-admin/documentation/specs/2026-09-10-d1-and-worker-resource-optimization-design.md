---

title: "D1, KV & Worker Resource Optimization — Design"
status: draft
audience: [ai, technical, owner, operator]
last_verified: 2026-09-10
verified_against: [code, infra]
owner: harshil
related_code: [src/workers/cf-entry.ts, src/lib/auth/cf-access-reconcile.ts, src/lib/auth/cf-access-sync-log.ts, src/lib/observability.ts, src/lib/dal/PortalSettingsRepository.ts, src/lib/gsc/sync.ts, src/lib/seo/indexnow.ts, src/lib/seo/review-loop.ts, src/workers/scheduled-booking-retry.ts]
related_docs: [../program/ROADMAP.md, ../program/DEBT-REGISTRY.md, ../operations/OPERATIONS.md, ../architecture/ARCHITECTURE.md, ../MAINTENANCE.md]
tags: [d1, performance, cron, observability, design]
---

<!-- docs-check: proposed-paths -->

# D1, KV & Worker Resource Optimization — Design

> **TL;DR (non-technical):** The website gets fewer than a hundred visitors a day,
> but the database runs about four thousand queries a day. Almost none of that is
> visitors — it is scheduled background jobs checking for work that isn't there.
> Two thirds of every request our admin Worker handles is a timer, not a person.
>
> This design does three things. It makes those jobs **check cheaply before they
> work**, which removes roughly nine in ten of the database writes and most of the
> reads. It makes sure that when something breaks, **we always hear about it** — in
> both Sentry and Cloudflare's logs, with no failure quietly swallowed. And it makes
> sure that when something breaks on the **public website, visitors never see it**:
> the blog falls back to its built-in copies of the articles instead of showing an
> empty page, and a real article is never reported as "not found" just because the
> database hiccuped.
>
> Each of the three is protected by an automated check that fails the build if
> anyone undoes it later.

## 1. Why this exists

Measured live on 2026-09-10 against `madagascar-db` and the Cloudflare D1 query
dashboard. Every figure below has its derivation named, because a figure copied
from another document is how every count in this repo drifted.

### 1.1 The shape of the problem

| Window | Queries | Rows read | Rows written |
|---|---:|---:|---:|
| 24 hours | ~4,000 | ~34,000 | ~1,000 |
| 30 days | ~97,000 | ~724,000 | ~50,000 |

**This is not a quota problem.** 34,000 reads against the 5,000,000/day free
allowance is 0.7%; 1,000 writes against 100,000/day is 1%. Nothing is close to a
limit, and no invoice is at risk.

It is a *proportion* problem. Attributing the 34,000 daily reads against the
dashboard's per-query table:

Re-derived on the evening of 2026-09-10 from the **GraphQL Analytics API**
(`d1QueriesAdaptiveGroups`, ordered by `sum_rowsRead_DESC`) over the two full days
2026-09-08/09, rather than from the dashboard's rounded view. Each cadence leaves
an exact fingerprint that attributes it to a trigger without guessing: the
watermark upsert runs **288/day** and the gate batch **97/day**, which are the
`*/5` and `*/15` ticks precisely.

| Query | Runs/day | Rows read/day | Share | Driven by |
|---|---:|---:|---:|---|
| `booking_attempts` replay claim *(executes in cf-astro)* | 302 | **9,378** | 24% | `booking-outbox-poke` |
| `service_config` read *(cf-astro rate limiter)* | 292 | **6,728** | 17% | `booking-outbox-poke` |
| `gsc_index_log` GROUP BY | 4 | 2,176 | 5% | admin SEO page load |
| `storage_files` quota GROUP BY | 267 | 1,602 | 4% | `storage-notifications` |
| `booking_attempts` email-retry claim | 304 | 1,522 | 4% | `booking-email-retry` |
| `gsc_index_log` LIKE `'%overallReadinessScore%'` | 2 | 1,412 | 4% | admin SEO page load |
| `storage_files` share-expiry | 292 | 1,168 | 3% | `storage-notifications` |
| settings 6-key gate batch | 97 | 1,164 | 3% | `*/15` tick |
| watermark upsert + select | 288 / 309 | 1,173 | 3% | `cf-access-audit-poll` |
| `admin_pages` PLAC join | 4 | 700 | 2% | admin page load |
| `admin_login_logs` `COUNT(*)` | 2 | 638 | 2% | admin dashboard |
| remainder (blog, cms, settings, diagnostics) | — | ~12,000 | 30% | mixed |

Total measured: **39,643 rows read/day**, of which **22,735 (57%) is cron.**

The runs/day column splits this into **two distinct problems**, which need
different fixes:

**Problem A — one line of cf-admin, paid for in cf-astro.** The two most expensive
queries in the entire estate are not cf-admin's at all. `pokeBookingOutboxDrain`
POSTs `cf-astro/api/booking/replay` every five minutes; that route calls
`checkRateLimit` → `getServiceConfig` (23 rows) and then `drainBookingOutbox`
(31 rows). Together **16,106 rows/day — 41% of all database reads** — to drain an
outbox that is almost always empty, on a site taking roughly one booking a week.
The config read misses cache every single time because the Cache-API entry carries
`s-maxage=60` and the isolate memory TTL is 10 s, while the poke arrives every
300 s. Verified 2026-09-10: `SELECT 1 … LIMIT 1` against the same table uses
`idx_booking_attempts_pending_replay` and reads **0 rows**, so cf-admin can decide
whether to poke at no cost at all.

**Problem B — a handful of admin page loads with catastrophic per-run cost.** The
`gsc_index_log` GROUP BY (544 rows/run), the `gsc_index_log` `LIKE` scan (565 rows
read per row returned) and the `admin_login_logs` `COUNT(*)` (319:1) run only 2–4
times a day and still account for **4,226 rows/day**. These do not scale with cron
frequency — they scale with table size, and they get worse every day the tables
grow.

**Problem C — a cron tick that does nothing at all.** Re-checked live 2026-09-10:
`gsc-sync-enabled` is `false` (since 2026-08-26), `pagespeed-check-enabled` is
`false` (since 2026-08-22), and all 15 `blog_posts` rows are `published` with zero
`scheduled`. The `*/15` trigger therefore fires 96 times a day, reads 12 rows of
settings, and every one of its three jobs immediately no-ops. It is pure overhead
holding one of five account cron slots.

### 1.2 The write side

> **The Stage 1 purge has already executed.** Re-counted live 2026-09-10:
> `cf_access_sync_log` holds **107 rows**, not 13,584. The 10 real events were
> retained exactly as designed (3 `update`, 1 `create`, 1 `delete`,
> 1 `manual_resync`, 4 failed `cron_reconcile`). **The other 97 rows accumulated
> in the 8.0 hours since the purge** — one per five-minute tick, 300 s apart to
> the second. At 288 rows/day the table returns to 13,584 rows on or about
> **2026-10-27.** Purging without gating the writer is a treadmill; this is the
> single strongest argument for the reconcile gate below.

Write attribution, same GraphQL source and window, ordered by `sum_rowsWritten`:

| Query | Runs/day | Rows written/day | Share | Driven by |
|---|---:|---:|---:|---|
| `INSERT INTO cf_access_sync_log` | 286 | **1,142** | **73%** | `cf-access-reconcile` |
| `INSERT INTO admin_portal_settings` (watermark) | 288 | 288 | 18% | `cf-access-audit-poll` |
| everything else (audit log, consent, login logs) | — | ~128 | 8% | real events |

Total measured: **1,551 rows written/day**, of which **1,430 (92%) is the `*/5`
cron.** The sync-log insert costs four physical writes per logical row because
each also writes its two index entries; the watermark upsert costs one, because it
updates an existing row whose indexed columns do not change.

### 1.3 What the reconcile actually costs

`reconcileCfAccessGroup()` is unconditional. Every five minutes it:

1. pushes the entire whitelist to the Cloudflare Access API (~288 external writes/day);
2. inserts a `cf_access_sync_log` row (~283 D1 rows/day, ~1,130 with indexes);
3. runs `UPDATE ... .eq('is_active', true)` across **every active Supabase user
   row** (~1,730 Postgres row updates/day).

None of it is conditional on anything having changed. The Supabase side leaves a
matching fingerprint: `admin_authorized_users` holds **6 live rows** and has taken
**38,923 sequential scans** against 16 index scans over a 163-day statistics
window.

### 1.4 Index-defeating predicates found

- **`booking_attempts` replay.** `idx_booking_attempts_pending_replay` is a partial
  index on `(next_replay_at) WHERE replay_payload IS NOT NULL AND replayed_at IS NULL`
  that matches the query and should be *empty*. The disjunction
  `next_replay_at IS NULL OR next_replay_at <= datetime('now')` moves the planner
  onto a full scan. Measured: 31 rows read per run on a 31-row table.
- **`gsc_index_log` readiness lookup.** `LIKE '%overallReadinessScore%'` has a
  leading wildcard and can never use an index.
- **`blog_posts` ordering.** `ORDER BY datetime(pub_date) DESC` wraps the column in
  a function, which defeats `idx_posts_status_date (locale, status, pub_date DESC)`.
  The wrapper exists for a reason: `pub_date` holds **two incompatible stored
  formats** — `'2026-08-11T04:15'` and `'2026-04-01T12:00:00Z'` — so plain
  lexicographic ordering is currently wrong. The data must be normalized before
  the query can be fixed.
- **`blog_posts` tags.** Stored as a JSON string and matched with `LIKE`, with
  inconsistent spacing between rows (`["a","b"]` versus `["a", "b"]`).
  Unindexable and substring-fragile.

### 1.5 Supabase findings

22 unused indexes (each a write cost on every insert with no read benefit) and 2
unindexed foreign keys on `tool_call_events` (`contact_id`, `message_id`), per the
Supabase performance advisor on 2026-09-10. `email_audit_logs` is 61 rows but
760 kB — the JSONB `delivery_events` array is the growth curve.

## 2. Principles

1. **Fail open, always.** Any gate, lease, meter or counter that throws must cause
   the job to *run*, never to skip. A broken optimizer degrades to today's
   behaviour. This mirrors the fail-open rate-limiting owner decision recorded in
   `cf-astro/AGENTS.md`.
2. **The budget is a CI gate, not a runtime breaker.** Production always completes
   the work. Only the test blocks.
3. **No new tables, no new env vars.** RULE #0.8 and RULE #0.9. Job state lives in
   `admin_portal_settings`.
4. **Compose the existing observability primitives.** `src/lib/observability.ts`
   already exports `writeAnalytics`, `reportNonFatal`, `reportOnce`, `background`,
   `logToObservability`, `safeAsync`, `safeSync` and `guard`. Build on them.
5. **Measure before changing.** Stage 1 changes no behaviour; it establishes the
   baseline that stages 2–4 are judged against.
6. **Retention stays manual.** ADR-0001 fixes this. The `cf_access_sync_log` purge
   is a one-time owner-approved action, not an automated retention policy.
7. **Swallow nothing, show nothing.** (Owner requirement, 2026-09-10.) Two layers,
   and they must not be confused with each other:
   - **Server side:** every failure reaches Cloudflare Observability *and* Sentry.
     No bare `catch {}`, no console-only catch. `reportNonFatal` already does both
     — Layer 0 always logs, Layer 1 reports to Sentry, and a Sentry failure is
     itself logged — so this is largely a collapse of existing code, not new code.
   - **Visitor side (cf-astro):** a visitor never sees an error, an empty void, or
     a false 404. Failures degrade to real content first, a friendly notice only
     when content is genuinely unavailable.

   "Surfaced" is not "rethrown". An exception thrown out of `scheduled()` becomes a
   Worker `outcome: exception`, which **kills the remaining jobs in that tick** and
   adds no visibility that reporting does not already provide. Report, never
   rethrow, on the cron path.
8. **Alerting capacity is itself a resource.** `reportOnce` dedupes per *isolate*,
   and a five-minute cron gets a fresh isolate most ticks, so it does not actually
   dedupe across ticks. A persistently failing job would emit 288 Sentry events a
   day — 8,640/month against a 5,000/month allowance — exhausting the quota and
   then **silencing the real alerts**. Cron-path reporting therefore goes through a
   cooldown-backed `reportOnce`, while Cloudflare Observability still receives
   every occurrence. Verified 2026-09-10: the Sentry project currently has zero
   unresolved issues over 30 days, which is consistent with silent catches
   swallowing failures rather than with nothing having gone wrong.
9. **A fallback that is never exercised is not a fallback.** Every degradation path
   this design adds ships with a test that forces the failure and asserts the
   visitor still gets content.

## 3. Architecture

### 3.1 New module

```
src/lib/jobs/
├── registry.ts     job id -> { handler, schedule, budget, shouldRun? }
├── runJob.ts       gate -> lease -> meter -> run -> report
├── budgets.ts      declared per-job budgets (data, not logic)
└── metered-d1.ts   transparent D1 proxy accumulating rows_read/rows_written
```

### 3.2 Measurement

D1's `.run()` and `.all()` already return `meta.rows_read` and `meta.rows_written`;
today both are discarded. `metered-d1.ts` wraps `env.DB` for the duration of one
job and accumulates them per statement. The proxy is interface-transparent, so no
call site changes. If the proxy itself throws it falls through to the raw binding
and the run is recorded as `unmetered`.

### 3.3 Ordering — the part that matters

The naive design takes a lease per job per tick. Five jobs on a five-minute cron is
1,440 writes/day, which is **worse than what this design removes.** The order is
therefore:

> **gate (cheap read) → lease (only when there is work) → run**

An idle tick takes no lease and performs no write. Because `readSettings(db, keys)`
already batches a key set into one query, the entire idle tick collapses to **one
D1 query reading about six rows**, against today's ~10 queries reading ~600 rows
and writing ~4.

### 3.4 State

Lease and gate state live in `admin_portal_settings` under `scope_type='job'`,
`scope_id=<jobId>`. No new table (RULE #0.9); `idx_admin_portal_settings_scope`
already covers the lookup. The lease is claimed by conditional update and carries
`{ leaseUntil, runId }`; a held, unexpired lease means another tick is mid-run and
this one records `lease-held` and returns.

### 3.5 Failure matrix

| Failure | Behaviour |
|---|---|
| Gate read throws | **Run the job** |
| Lease read or write throws | **Run the job** |
| Lease held and unexpired | Skip; record `lease-held` |
| Meter proxy throws | Fall through to raw D1; record `unmetered` |
| Analytics write throws | Swallowed by `background()`; job unaffected |
| Job handler throws | `allSettled` as today; Sentry; next tick retries |
| Budget exceeded at runtime | Record and alert; **never abort** |

### 3.6 Telemetry

One Analytics Engine data point per job run through the existing `writeAnalytics`
(free; does not consume D1 or KV quota):

- `blobs`: `[jobId, outcome, cronExpr]` where outcome is `ran` / `skipped` / `lease-held` / `failed` / `unmetered`
- `doubles`: `[rowsRead, rowsWritten, durationMs, queryCount]`
- `indexes`: `[jobId]`

One structured `logToObservability` line per tick for Cloudflare Observability.
Sentry through `reportOnce` **only** on budget breach or job failure — never per
run, so alerting cannot burn the free tier.

### 3.7 The guardrail

`test/jobs-budget.test.ts` runs in the Workers pool against a real miniflare D1
seeded from `database/schema.snapshot.sql`, executes each job's idle path, and
asserts `rowsRead <= budget.idle` and `rowsWritten <= budget.idleWrites`.

Budgets live in `budgets.ts` as data with a required `reason` string, so raising
one is a visible, reviewable diff — deliberately the same ergonomics as
`.ratchet.json`, which the agents working in this repo already understand. A change
that reintroduces a full scan fails `npm run verify` with the job and the overage
named.

### 3.8 The observability contract

Both repos already export the primitive this requires. `reportNonFatal` is
two-layered by construction: **Layer 0 always** writes a structured line through
`logToObservability` (Cloudflare Observability), **Layer 1** reports to Sentry on a
best-effort basis, and if the Sentry call itself throws, that failure is logged
too. Nothing further needs to be built for the "both destinations, always" rule —
the work is replacing console-only catches with it, which *removes* lines.

Two additions:

- **`reportOnceCooled(db, key, ttlMs, scope, error, data?)`** — principle 8's
  cooldown. State lives in `admin_portal_settings` under `job-alert:<key>` (no new
  table, RULE #0.9). Fails **open**: a cooldown read that throws reports anyway.
  Note the deliberate consequence — when the failure *is* D1 being unreachable, the
  cooldown cannot be read, so every tick reports. That is correct: a database
  outage is exactly when the alert must not be suppressed.
- **`// silent-ok: <reason>`** — the annotation for the small number of catches
  that must genuinely stay quiet (a Sentry-breadcrumb catch cannot itself report to
  Sentry). Anything unannotated and unreported is a defect that A19 counts.

Classification, so the two are not confused:

| Situation | Cloudflare Observability | Sentry |
|---|---|---|
| Expected degradation (cache miss, fallback taken) | every occurrence | `reportOnceCooled`, 1/hour |
| Job failure | every occurrence | `reportOnceCooled`, 1/hour |
| Budget breach | every occurrence | `reportOnce` (already built) |
| Visitor-facing fallback taken | every occurrence | `reportOnceCooled`, 1/hour |
| Sentry itself failing | logged by `reportNonFatal` | n/a |

### 3.9 The visitor fallback ladder (cf-astro)

The architectural defect is small and specific: **an error and a genuine absence
are currently indistinguishable.** `getBlogPostBySlug` returns `null` for both, so
during a D1 outage a real post is served as a 404 — which search engines can act
on. The fix is a discriminated result, `{ ok: true, post }` or
`{ ok: false, reason: 'not_found' | 'error' }`, so the page can branch.

**Blog index and tag pages**

1. D1 → render.
2. D1 fails → the static Markdown collection, via the `getMergedBlogPosts` helper
   that already implements exactly this and is today wired only to RSS and
   sitemaps → render, report the degradation.
3. Both empty → a bilingual "content temporarily unavailable" panel inside the
   normal page chrome, with a contact route → report.

**Blog post `[slug]`**

1. D1 → render.
2. `reason: 'error'` → look the slug up in the static collection → render if found.
3. `reason: 'not_found'` in both sources → 404. **A 404 is never returned because a
   lookup failed** — only because the post genuinely does not exist.

**`service_config`**

Ladder is unchanged (isolate memory 10 s → Cache API → D1 → `DEFAULTS`); two
changes around it. The silent `catch {}` becomes `reportOnce`, because falling back
to `DEFAULTS` silently means the site can revert to default rate limits and default
Sentry sampling during an outage with nobody told. And `s-maxage` goes 60 s → 300 s,
which both widens the resilience window and removes the 6,728 rows/day.

**Rejected: a site-wide degraded banner.** It would alarm visitors during blips
they would otherwise never notice, and it puts an infrastructure detail on a
customer-facing page. The notice appears only where content is genuinely missing.

## 4. Chunks

Re-cut on 2026-09-10 (evening) from four "stages" into four **chunk records**, so
the work lands in the homes the roadmap already has for it rather than inventing a
parallel structure: roadmap chunk 7 is already *"Job runner + cron consolidation"*
and roadmap chunk 8 is already *"no-op writes stopped in the 5-minute reconcile,
`cf_access_sync_log` rows/day ~288 → ~0"*.

Each chunk is one record, ships to `main` alone, and is independently revertible.

| # | Chunk | Repos | Metric moved |
|---|---|---|---|
| 7 | Cron consolidation + job observability contract | cf-admin, cf-chatbot | crons 4/5 → 3/5; cf-chatbot 1,440 → 288 ticks/day; timeouts 0/2 → 2/2; budgets provisional → measured; A19 baseline set |
| 8c | Visitor-facing resilience | cf-astro | blog surfaces with a fallback 0 → 6; false-404-on-error → structurally impossible; reads −6,728/day |
| 8 | Idle-tick gates | cf-admin | writes 1,551 → ~150/day; `cf_access_sync_log` 288 → ~0/day; reads ~41,900 → ~26,000/day |
| 8b | Hot-query correctness | cf-admin | reads → ~21,700/day (−45% from baseline); no top-ten query above 10:1 read:return |

> **A projection corrected on review, recorded rather than quietly fixed.** An
> earlier draft of this table promised ~5,000 rows read/day. That was wrong: it
> ignored that chunk 7's `*/15` fold makes the gate settings batch run 288×/day
> instead of 96×, and that chunk 8 adds keys to it. Verified by `EXPLAIN QUERY PLAN`
> on 2026-09-10 — the batch is an exact primary-key lookup costing ~2 rows per key —
> the trajectory is **39,643 → ~41,900 (chunk 7 costs reads to buy a cron slot) →
> ~26,000 (chunk 8) → ~21,700 (chunk 8b)**. After that the largest single read in the
> system is the settings batch itself at ~6,900/day; caching its static keys would
> take it to ~3,500 and is sized in chunk 8's §6 but deliberately not taken there.

**Order: 7 → 8c → 8 → 8b.** Chunk 7 goes first because it is ~85% built and it
arms the measurement every later chunk is judged against. **8c goes second, ahead
of all the cost work**, because the empty-blog and false-404 failures exist in
production *today* and are visible to customers, whereas the cost work is hygiene
on a system running at 0.8% of its read quota.

### Chunk 7 — Cron consolidation and the job observability contract

Already committed (2026-09-10): `src/lib/jobs/{metered-d1,registry,runJob,telemetry,budgets}.ts`,
six job test suites, `readSettings`/`writeSetting` consolidated into
`PortalSettingsRepository`, and every cron branch dispatching through
`runCronBatch`.

Remaining: replace the ten `PROVISIONAL` 10,000-row budgets with measured values
(**the gate is installed but toothless until this happens**); add `AbortSignal` to
the two untimed Cloudflare API fetches on the `*/5` path; fold `*/15` into `*/5`
and delete the trigger; drop cf-chatbot's `* * * * *` to `*/5`; replace every
console-only catch on a job path with `reportNonFatal`/`reportOnceCooled`; add
ratchet metric **A19**.

**Behaviour change:** blog-publish resolution improves 15 min → 5 min; chatbot
auto-close resolution degrades 1 min → 5 min against a 10-minute timeout.

### Chunk 8c — Visitor-facing resilience (cf-astro)

The fallback ladder in §3.9 below. Wires the **existing** `getMergedBlogPosts`
static-collection fallback into the six visitor-facing blog surfaces that today
call `getBlogPosts` (which returns `{posts: [], total: 0}` on failure) and
`getBlogPostBySlug` (which returns `null`, indistinguishable from a genuine
absence). Replaces the silent `catch {}` in `getServiceConfig` with `reportOnce`,
and raises its Cache-API `s-maxage` from 60 s to 300 s — which widens the window a
cached snapshot survives a D1 blip *and* removes 6,728 rows/day. Safe because
`/api/revalidate` already calls `purgeServiceConfigCache` on config change, so
propagation does not depend on the TTL.

**Done when:** a forced D1 failure still renders blog content from the static
collection; a real post's slug does not 404 on a lookup error; every degradation
emits to both Sentry and Cloudflare Observability.

### Chunk 8 — Idle-tick gates (cf-admin)

Four gates, all fail-open, all riding the single batched settings read
`runCronBatch` already performs:

1. **Booking-outbox probe** — `SELECT 1 … LIMIT 1` on the partial index (0 rows)
   before deciding whether to POST cf-astro. Removes ~15,800 rows/day while
   preserving five-minute recovery *exactly when there is something to recover*.
2. **Reconcile hash gate** — hash the member list, compare against a stored
   setting, skip the CF Access PUT, the sync-log insert and the Supabase sweep when
   unchanged. Follows the existing `SETTING_INDEXNOW_LAST_BATCH_HASH` precedent.
3. **Watermark write gate** — write only on new events, or hourly, bounded so the
   API window cannot grow without limit. 288 → ~24 writes/day.
4. **Storage-notifications interval gate** — a 24-hour expiry warning does not need
   five-minute resolution. 60-minute gate.

**Done when:** `cf_access_sync_log` writes ~288/day → ~0 on an unchanged whitelist;
the Supabase sweep stops firing on no-ops; a genuine whitelist change still
propagates within five minutes, proven by test.

### Chunk 8b — Hot-query correctness (cf-admin)

GSC readiness score stored in its own setting rather than `LIKE`-scanned out of the
log; the `gsc_index_log` GROUP BY and `admin_login_logs` `COUNT(*)` scans
denormalised; a partial index for the scheduled-post lookup; the
`scheduled-booking-retry` N+1 (up to 50 sequential `UPDATE`s) collapsed to one
statement.

**Done when:** total daily rows read falls by at least 40% from the 39,643 baseline,
and **no query in the top ten has a read:return ratio above 10:1** — the ratio, not
the total, is what this chunk exists for. These four are the only remaining costs
that grow with table size rather than with traffic.

### Deferred — not in this programme of work

Owner decision, 2026-09-10: the former Stage 4 is **not** taken now. `pub_date`
normalisation needs a backfill migration on live customer-facing content, the tag
model rework touches the public blog's URL surface, and Supabase's 22 unused
indexes already have a home in roadmap chunk 14. Revisit after 8b's measurement
lands.

## 5. What this design does not do

- **It does not replace polling with events.** The polling crons are the durable
  backstop behind `booking_attempts` and `consent_attempts`; `cf-astro/AGENTS.md`
  invariant 2 makes audit-first ordering an LFPDPPP compliance requirement.
  Replacing the backstop with the same class of mechanism that already failed is
  how a booking is lost. Revisit for the storage and GSC jobs, where nothing is at
  stake, once Stage 3 has landed.
- **It does not add automated retention.** ADR-0001, owner decision.
- **It does not raise the cron count.** The account is at 4 of 5 slots; chunk 7
  returns one, taking it to 3/5. Folding the Sunday trigger in as well was
  considered and **rejected** (owner decision 2026-09-10): the weekly job already
  costs ~0, so the second slot would be bought with concentrated failure risk
  rather than real savings.
- **It does not change what any job does** — only how often, and how expensively,
  it decides to do it. The one exception is chunk 8c, which changes what a
  *visitor* sees when a data load fails.
- **It does not rethrow on the cron path.** See principle 7.

## 5a. Why this is future-proof

The measurements in §1 will drift the moment someone writes a new query. What
survives is the three gates that make the drift fail CI rather than accumulate
silently:

| Gate | Lands in | Prevents |
|---|---|---|
| `test/jobs-budget.test.ts` with **measured** budgets | 7 | A change reintroducing a full scan on a cron path |
| Ratchet **A19** — catches on job and data paths with neither a report nor a `// silent-ok:` annotation | 7 | New silent failures being introduced, ever |
| Forced-failure fallback tests | 8c | Someone unwiring the static fallback, or a real post 404-ing on a lookup error |

A19 is the one that makes principle 7 permanent. It converts "we cleaned up the
silent catches once" into a rule CI enforces on every future commit, in exactly the
idiom (A1–A18) the agents working in this repository already understand.

## 6. Risks

| Risk | Mitigation |
|---|---|
| A gate skips work that should have run | Every gate fails open; chunk 8 ships a test proving a real whitelist change still propagates within five minutes |
| Budget test blocks another agent's legitimate feature | Budgets are data with a `reason` field; raising one is a one-line reviewable diff, not a code change |
| Folding `*/15` into `*/5` concentrates failure into one trigger | `runCronBatch` already isolates jobs with `allSettled`; a failing job cannot starve its siblings. The Sunday trigger deliberately stays separate |
| The static fallback serves stale content without anyone noticing | Every fallback taken reports through `reportOnceCooled`; the runbook names what degrades and what fires |
| A19 is gamed by annotating everything `// silent-ok:` | The annotation requires a reason string and shows up in review as an added line, the same ergonomics as a budget raise |
| Sentry quota exhausted by a persistently failing cron, silencing real alerts | Principle 8: cooldown-backed reporting, 1 event/hour/fingerprint; Cloudflare Observability still receives every occurrence |
| cf-chatbot auto-close runs 5 minutes late | 5-minute resolution against a 10-minute inactivity timeout; one-line revert |
| Concurrent sessions collide in this repo | Each chunk is separate with its own commits; shared files staged hunk-by-hunk; `.ratchet.json` never staged while dirty from another session |

## 7. Open questions

None blocking. Decisions taken during design and recorded here:

1. The `cf_access_sync_log` purge was executed on 2026-09-10 as a standalone
   data-only step, ahead of the gate that makes it durable. §1.2 records the
   consequence: it regrows to its pre-purge size by ~2026-10-27 unless chunk 8
   lands first.
2. The `*/15` cron fold sits in chunk 7 rather than chunk 8. It is a behaviour
   change, but it is a *trigger* change, and chunk 7 is the trigger chunk.
3. Chunk 8c was moved **ahead of** all the cost work (owner decision, 2026-09-10).
   The empty-blog and false-404 failures are live customer-facing defects; the cost
   work is hygiene on a system at 0.8% of its read quota.
4. The former Stage 4 is deferred rather than dropped — see §4.
5. "Always thrown" was clarified with the owner as "always **surfaced**". Rethrowing
   on the cron path would destroy sibling jobs in the same tick; see principle 7.

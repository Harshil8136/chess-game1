---

title: "When D1 Is Unavailable — What Degrades and What Fires"
status: active
audience: [operator, owner, technical, ai]
last_verified: 2026-09-19
verified_against: [code, live-mcp]
owner: harshil
related_code: [src/lib/observability.ts, src/lib/jobs/runJob.ts, src/lib/jobs/registry.ts, src/lib/jobs/budgets.ts, src/workers/cf-entry.ts, src/lib/auth/cf-access-sync-log.ts, src/workers/scheduled-log-sync.ts]
related_docs: [../operations/OPERATIONS.md, cron-scheduled-exception.md, incident-response.md, disaster-recovery.md, ../specs/2026-09-10-d1-and-worker-resource-optimization-design.md]
tags: [runbook, d1, cron, observability, resilience]
---

# When D1 Is Unavailable — What Degrades and What Fires

> **TL;DR (non-technical):** If the database has a bad moment, this page tells
> you what stops working, what keeps working, where the alarm shows up, and what
> to check first. The short version: background jobs pause and retry on their own,
> nothing is lost, and you will hear about it in two places.

## 1. The rule everything here follows

**Swallow nothing, show nothing.**

- **Server side** — every failure reaches Cloudflare Observability *and* Sentry.
  There is no bare `catch {}` on a job path; ratchet metric **A19** fails the
  build if one is added.
- **Visitor side** — a visitor to the public site never sees an error, an empty
  page, or a false "not found". *(cf-astro; shipped with chunk 8c — see §6.)*

Three destinations, and they behave differently under load. **This table is the
contract; `OPERATIONS.md` links here rather than restating it.**

| Layer | Destination | Rate |
|---|---|---|
| **Layer 0a** | Analytics Engine | **Every** run of **every** job, unconditionally — one data point per job per tick, whatever the outcome |
| **Layer 0b** | Cloudflare Observability | Only when the outcome is `ran` or `failed`, or the job blew its D1 budget. `skipped`, `disabled` and `shed` ticks write **nothing** here |
| **Layer 1** | Sentry | Three regimes — see below. It is **not** a blanket hourly cap |

Layer 0a runs before anything that can fail, so a broken cooldown, a broken
Sentry, or a dead D1 can never suppress the record of what happened.

> **Layer 0b changed on 2026-09-16 (`eb8cb12`), and this runbook said
> "unconditionally" until 2026-09-19.** A per-job-per-tick line was ~2,301 log
> events a day mostly to say nothing happened, against a 200,000/day Workers
> Free allowance that trace spans start counting against from 2026-10-01.
> **Operational consequence:** filtering `jobs.` in Observability for a gated
> or paused job returns nothing, and it looks like the cron is dead when it is
> idling correctly. Check Analytics Engine (§4 step 3) before concluding
> anything about a job you do not see.

**The Sentry regimes** (`src/lib/observability.ts`, `src/lib/jobs/runJob.ts`):

| Call site | Behaviour |
|---|---|
| `reportOnceCooled` — explicit call sites, e.g. `cf-sync:*`, `cf-sync-log:*` | One event per fingerprint per window (1 h), the cooldown stored in D1. **Fails open** (§2) |
| `reportNonFatal` — **every job handler failure**, via `runJob`'s catch | **Uncooled.** A persistently failing handler on `*/5` reports 288 times a day |
| `reportOnce` — budget overruns | Deduped **per isolate** only, and Workers hands most cron ticks a fresh isolate, so this is close to uncooled in practice |

So §2's arithmetic below is not only the thing prevented — for a persistently
failing *handler* it is the live behaviour.

## 2. Why Sentry is rate-limited and Observability is not

A five-minute cron reporting every failed tick emits 288 events a day — 8,640 a
month against a 5,000/month allowance. It would exhaust the quota in about
eighteen days and then **silence the alerts that matter**. Alerting capacity is
itself a resource. **This is the outcome `reportOnceCooled` prevents — and it
is exactly what a failing job *handler* still produces, because that path is
uncooled (§1).**

`reportOnceCooled` stores the last-reported time in `admin_portal_settings` under
`job-alert:<fingerprint>`. It **fails open**: if the cooldown cannot be read, the
report goes out. So when the failure *is* D1 being unreachable, the cooldown is
unreadable and every tick reports — deliberately. A database outage is exactly
when an alert must not be suppressed.

**Consequence to expect:** during a real D1 outage Sentry will be noisy. That is
the design working, not a bug.

## 3. What degrades, job by job

Every job runs under `runJob`, which catches, reports, and records the tick as
`failed`. **A failing job never throws out of `scheduled()`** — that would become
a Worker `outcome: exception` and kill its siblings in the same tick. Jobs are
isolated by `allSettled`, so one failure cannot starve another.

> **Do not trust a job count in prose — derive it.** The list is
> [`../../src/lib/jobs/registry.ts`](../../src/lib/jobs/registry.ts)
> (`FIVE_MIN_JOBS` + `SUNDAY_JOBS`), the tiers are in
> [`../../src/lib/jobs/tiers.ts`](../../src/lib/jobs/tiers.ts), and the outcomes
> are in [`../../src/lib/jobs/telemetry.ts`](../../src/lib/jobs/telemetry.ts).
> This runbook said "all eight jobs" over a ten-row table until 2026-09-19; the
> real figure that day was **11 — 9 on `*/5`, 2 on Sunday**. Three other
> documents carried a different wrong number.
>
> **Possible outcomes an operator will see**, since the 2026-09-16 control
> plane: `ran`, `failed`, `skipped` (the job's own gate said no), `disabled`
> (paused from `/dashboard/cron`) and `shed` (automatic shedding on D1 usage).
> `decideJobRun` returns the last two *before* the job's own gate — see
> [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md). Live today,
> `gsc-sync` and `pagespeed-sync` sit in `state: "off"`, so their normal
> outcome is `disabled` and they log nothing to Observability (§1).

| Job | Cron | If D1 is down | Recovered by |
|---|---|---|---|
| `cf-access-audit-poll` | `*/5` | Watermark unreadable → run skipped. Failed-login capture pauses | Next tick; watermark not advanced, so no window is lost |
| `booking-email-retry` | `*/5` | Scan fails → no re-enqueue this tick | Next tick |
| `booking-outbox-poke` | `*/5` | The pending-replay probe fails **open**, so the poke still fires; cf-astro's own drain is what touches D1 | Next tick, plus cf-astro's hourly GitHub Actions heartbeat |
| `cf-access-reconcile` | `*/5` | Push to Cloudflare still happens; the D1 log row and Supabase sweep fail | Next tick |
| `storage-notifications` | `*/5` | Gate settings unreadable → treated as due (fails open); the scans then fail → no quota or share-expiry mail this tick, and `storage-notify-last-run` is not stamped | Next tick |
| `blog-scheduled-publish` | `*/5` | A matured post stays `scheduled` | Next tick |
| `gsc-sync`, `pagespeed-sync` | `*/5` | Gate settings unreadable → treated as not-due. Both are `disabled` in the control plane today, so they never reach the gate at all | Next tick |
| `cron-usage-probe` | `*/5` | Cannot refresh the cached D1-usage reading, so `usage.checkedAt` goes stale — **the automatic shed decision then runs on an old number**. Its own 60-minute interval is enforced in code as well as in the control document, so it cannot storm the analytics API | Next tick after D1 returns |
| `asset-cleanup`, `staff-storage-reconcile` | `0 2 * * SUN` | Run aborts **before** deleting anything | Next Sunday, or a manual run |

**Nothing in this table loses data.** Every job is a poll over durable state:
the work is still there on the next tick. That is the whole reason these are
polling crons rather than events — see the design doc §5.

### The one that deserves extra care

`asset-cleanup` **deletes R2 objects**. If a reference source fails to load, assets
can look orphaned. Two protections: `PROTECTED_PREFIXES` always excludes
`email-attachments/` regardless of what failed, and since chunk 7 every
reference-load failure reports. **If you see `cron.asset_cleanup.*` in Sentry,
check what it deleted that week before assuming it was fine.**

## 4. Where to look, in order

1. **Analytics Engine** (`madagascar_analytics`) — **start here.** One data
   point per job per tick, `blobs: [jobId, outcome, cronExpr]`, with no
   filtering of any kind. It is the only complete record, and it is the only
   place a `skipped`, `disabled` or `shed` tick appears. Use it to tell "the
   cron is dead" apart from "the job is idling correctly".
2. **Cloudflare Observability** → Workers → `cf-admin-madagascar` → Logs.
   Filter `jobs.` for the per-tick line: outcome, `rowsRead`, `rowsWritten`,
   `queryCount`, `durationMs`, `overBudget`. **Only `ran`, `failed` and
   over-budget ticks are here** (§1) — a silent job is not necessarily a
   stopped job.
3. **Sentry** → unresolved issues. Scope tags name the job (`cron.booking_retry.*`,
   `cf-sync-log.*`, `cron.cf_audit.*`). Remember the three regimes in §1: a
   quiet Sentry proves nothing for a cooled call site, and a very noisy one is
   what an uncooled handler failure looks like.
4. **D1 itself**:

   ```bash
   npx wrangler d1 execute madagascar-db --remote --command "SELECT 1"
   ```

   A `7403` here is transient — retry before concluding anything.

## 5. What is NOT a D1 problem

- **A quiet Sentry is not proof of health.** Before chunk 7, 23 catch sites on
  job paths reported to `console` only. If you are reading a historical incident
  from before 2026-09-10, absence of a Sentry issue means nothing.
- **`overBudget: true` in the logs** is a cost regression, not an outage. The job
  completed. Budgets are a CI gate, never a runtime breaker — production always
  finishes the work.
- **A `lease-held` outcome** means another run of that job was still in flight.
  *Corrected 2026-09-20: this said no job sets `leaseSeconds` and the branch was
  unreachable. Two now do* — `asset-cleanup` and `staff-storage-reconcile`, the
  weekly pair, both of which delete, at 900 s. On those two `lease-held` is the
  guard working: an operator pressed **Run now** while the Sunday tick was still
  going, and the second run stood down rather than putting two deleters on the
  same bucket. On any other job it means a definition in `registry.ts` changed
  and this runbook is out of date.
- **A `disabled` or `shed` outcome** is the control plane working, not a
  failure. `disabled` = someone paused the job at `/dashboard/cron`; `shed` =
  automatic shedding on D1 usage. Neither writes to Observability (§1).

## 6. The visitor-facing half (cf-astro, chunk 8c — shipped 2026-09-15)

| Surface | If D1 is down | Visitor sees | Reported |
|---|---|---|---|
| `/en/blog`, `/es/blog` | `getBlogPosts` returns `degraded: true` | The bundled Markdown collection (`cf-astro/src/content/blog/`, 7 posts per locale) as the listing, no pagination | `blog.fallback_taken`, once per isolate |
| `/blog/tag/[tag]` | same | The bundled posts carrying that tag; if none, the "temporarily unavailable" panel with **503 + Retry-After** (an empty fallback is unavailability, not an empty result) | same |
| `/blog/[slug]` | `getBlogPostBySlug` returns `{ ok: false, reason: 'error' }` | The bundled copy if one exists; otherwise the panel with **503**. **Never a 404** — that answer is reserved for `reason: 'not_found'` in both sources (`resolvePostOutcome`, tested) | `blog.fallback_taken` / `blog.post_unavailable` |
| RSS, sitemaps | `getMergedBlogPosts` | Collection-only feed (unchanged behaviour) | `blog.sources.*` |
| Rate limits, Sentry sampling | `getServiceConfig` | The last snapshot for up to 300 s (was 60 s), then `DEFAULTS` | `service_config.fallback_to_defaults`, once per isolate |

**What this means for the operator:** during a D1 incident the public blog keeps
serving the fourteen bundled articles; D1-only articles answer 503 (not 404), so
nothing is de-listed. The bundled collection must stay a truthful subset of the
blog for this to hold (cf-astro `AGENTS.md` invariant 7).

## 7. Related

- [`cron-scheduled-exception.md`](cron-scheduled-exception.md) — a cron surfacing as `outcome: exception`, which this design makes structurally unlikely
- [`incident-response.md`](incident-response.md) — the general incident path
- [`disaster-recovery.md`](disaster-recovery.md) — D1 Time Travel, 7-day window
- [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md) — the job list, the tiers, the pause/shed control plane
- [`../specs/2026-09-10-d1-and-worker-resource-optimization-design.md`](../specs/2026-09-10-d1-and-worker-resource-optimization-design.md) — §3.8 the observability contract, §3.9 the visitor ladder, principles 7–9

## 8. Verification log

| Date | Method | Result |
|---|---|---|
| 2026-09-19 | `src/lib/jobs/registry.ts`, `tiers.ts`, `telemetry.ts`, `runJob.ts`, `src/lib/observability.ts` re-read; live `admin_portal_settings` queried for the `cron-control` document and the `job-alert:*` keys | §1 rewritten (Observability is conditional since `eb8cb12`; Sentry has three regimes, not one); §3 job table re-derived — **11 jobs, 9+2**, `cron-usage-probe` row added, `disabled`/`shed` outcomes documented; §4 reordered to put Analytics Engine first; `lease-held` marked unreachable; §1's stale "until chunk 8c" wording removed. `job-alert:cf-sync-log:sweep` and `job-alert:cf-sync:supabase_fetch_failed` confirmed present in D1 |

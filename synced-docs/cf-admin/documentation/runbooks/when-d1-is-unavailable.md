---

title: "When D1 Is Unavailable — What Degrades and What Fires"
status: active
audience: [operator, owner, technical, ai]
last_verified: 2026-09-10
verified_against: [code]
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
  page, or a false "not found". *(cf-astro; the visitor half lands with chunk 8c
  — until then see §6.)*

Two layers, and they behave differently under load:

| Layer | Destination | Rate |
|---|---|---|
| **Layer 0** | Cloudflare Observability | **Every** occurrence, unconditionally |
| **Layer 1** | Sentry | Once per hour per fingerprint on cron paths |

Layer 0 runs **before** anything that can fail, so a broken cooldown, a broken
Sentry, or a dead D1 can never suppress the record of what happened.

## 2. Why Sentry is rate-limited and Observability is not

A five-minute cron reporting every failed tick emits 288 events a day — 8,640 a
month against a 5,000/month allowance. It would exhaust the quota in about
eighteen days and then **silence the alerts that matter**. Alerting capacity is
itself a resource.

`reportOnceCooled` stores the last-reported time in `admin_portal_settings` under
`job-alert:<fingerprint>`. It **fails open**: if the cooldown cannot be read, the
report goes out. So when the failure *is* D1 being unreachable, the cooldown is
unreadable and every tick reports — deliberately. A database outage is exactly
when an alert must not be suppressed.

**Consequence to expect:** during a real D1 outage Sentry will be noisy. That is
the design working, not a bug.

## 3. What degrades, job by job

All eight jobs run under `runJob`, which catches, reports, and records the tick as
`failed`. **A failing job never throws out of `scheduled()`** — that would become
a Worker `outcome: exception` and kill its siblings in the same tick. Jobs are
isolated by `allSettled`, so one failure cannot starve another.

| Job | Cron | If D1 is down | Recovered by |
|---|---|---|---|
| `cf-access-audit-poll` | `*/5` | Watermark unreadable → run skipped. Failed-login capture pauses | Next tick; watermark not advanced, so no window is lost |
| `booking-email-retry` | `*/5` | Scan fails → no re-enqueue this tick | Next tick |
| `booking-outbox-poke` | `*/5` | Poke still fires; cf-astro's own drain is what touches D1 | Next tick, plus cf-astro's hourly GitHub Actions heartbeat |
| `cf-access-reconcile` | `*/5` | Push to Cloudflare still happens; the D1 log row and Supabase sweep fail | Next tick |
| `storage-notifications` | `*/5` | No quota or share-expiry mail this tick | Next tick |
| `blog-scheduled-publish` | `*/5` | A matured post stays `scheduled` | Next tick |
| `gsc-sync`, `pagespeed-sync` | `*/5` | Gate settings unreadable → treated as not-due | Next tick |
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

1. **Cloudflare Observability** → Workers → `cf-admin-madagascar` → Logs.
   Filter `jobs.` for the per-tick line every job writes: outcome, `rowsRead`,
   `rowsWritten`, `queryCount`, `durationMs`, `overBudget`. This is the complete
   record — Sentry is a sampled view of it.
2. **Sentry** → unresolved issues. Scope tags name the job (`cron.booking_retry.*`,
   `cf-sync-log.*`, `cron.cf_audit.*`).
3. **Analytics Engine** (`madagascar_analytics`) — one data point per job run,
   `blobs: [jobId, outcome, cronExpr]`. Use this to see whether a job has been
   failing *persistently*, which the hourly Sentry cooldown deliberately hides.
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
- **A `lease-held` outcome** means another tick was still running. Expected under
  slow conditions, not an error.

## 6. The visitor-facing half

Chunk 8c extends this runbook with the cf-astro rows. Until it lands, the known
gaps on the public site are:

- `/en/blog`, `/es/blog` and the tag pages call `getBlogPosts`, which returns
  `{ posts: [], total: 0 }` on a D1 error — a visitor sees an **empty blog page**.
- `/blog/[slug]` calls `getBlogPostBySlug`, which returns `null` for both a
  genuine absence and an error — so a real post is served as a **404**, which
  search engines can act on.
- The bundled Markdown fallback **already exists** (`getMergedBlogPosts`) but is
  wired only to RSS and the sitemaps.
- `getServiceConfig` falls back to `DEFAULTS` **silently**, so the site can revert
  to default rate limits and default Sentry sampling with nobody told.

If a D1 incident happens before chunk 8c ships, check the public blog manually.

## 7. Related

- [`cron-scheduled-exception.md`](cron-scheduled-exception.md) — a cron surfacing as `outcome: exception`, which this design makes structurally unlikely
- [`incident-response.md`](incident-response.md) — the general incident path
- [`disaster-recovery.md`](disaster-recovery.md) — D1 Time Travel, 7-day window
- [`../specs/2026-09-10-d1-and-worker-resource-optimization-design.md`](../specs/2026-09-10-d1-and-worker-resource-optimization-design.md) — §3.8 the observability contract, §3.9 the visitor ladder, principles 7–9

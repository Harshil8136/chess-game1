---
title: "Incident Record — Scheduled Jobs Stopped: Cron Invocation Exceeded Its CPU Limit"
status: active
audience: [ai, technical, operator, owner]
last_verified: 2026-09-27
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [src/lib/jobs/dispatch.ts, src/workers/job-runner.ts, src/workers/cf-entry.ts, src/lib/jobs/runJob.ts, src/lib/jobs/registry.ts]
related_docs: [../OPERATIONS.md, ../../features/CRON-CONTROL.md, ../../features/BACKUP-CONSOLE.md, 2026-09-12-cf-access-sync-gateway-timeout.md]
tags: [incident, cron, cloudflare-workers, free-plan, cpu-limit]
---

# Incident Record — Scheduled Jobs Stopped: Cron Invocation Exceeded Its CPU Limit

> **Summary (non-technical):** From late on 26 September 2026, none of the
> portal's background jobs ran: the five-minute jobs and the Sunday jobs alike.
> These jobs keep the sign-in audit log current, retry booking emails, keep the
> Cloudflare Access list in step with the user list, send storage warnings and
> drive the backup schedule. The website and the portal kept serving pages,
> because only the background work stopped. The cause was a Cloudflare Workers
> Free plan limit: each run gets 10 ms of processor time, and all ten jobs were
> sharing one run that needed about 22 ms. Cloudflare had allowed the overrun
> for some time and then began stopping every run at the limit. The fix gives
> every job its own run, and so its own 10 ms, at no cost. The site stays on
> the free plan.

## 1. Overview

| | |
|---|---|
| Worker | `cf-admin-madagascar` |
| Triggers | `*/5 * * * *` (10 jobs) and `0 2 * * SUN` (2 jobs) |
| Symptom | Every scheduled invocation ends with outcome `exceededCpu`, `cpuTimeMs` 10, wall time about 600 ms |
| First noticed | 2026-09-27, as cf-backup's Diagnostics `tick.age` failure (222 minutes since the last tick) |
| Last tick that finished its jobs | 2026-09-26 22:45 UTC (`cf-audit-last-synced` 22:45:48, `backup:status.lastTickAt` 22:45:47) |
| Plan constraint | Workers Free, kept by the owner's decision: no paid plan |
| Status | Fix committed 2026-09-27. §6 records the post-deploy check |

## 2. Timeline (UTC)

| When | What |
|---|---|
| 2026-09-16 | One live five-minute tick captured with `wrangler tail`: 1 invocation, wall time 1,327 ms, **CPU 22 ms**, already over the 10 ms limit ([`../../specs/2026-09-16-cron-control-plane-design.md`](../../specs/2026-09-16-cron-control-plane-design.md) §1.1). Cloudflare let it finish. |
| 2026-09-23 | `backup-tick` added to the five-minute tick (cf-backup's schedule, reconciliation and alerts). |
| 2026-09-26 22:45 | The last tick whose jobs wrote their D1 markers. |
| 2026-09-26 22:45 onward | Every five-minute invocation ends `exceededCpu` at 10 ms. |
| 2026-09-27 02:00 | The Sunday invocation (`asset-cleanup`, `staff-storage-reconcile`) also ends `exceededCpu`. |
| 2026-09-27 | Owner pastes the Trigger events from the Cloudflare dashboard. Cause confirmed and fix written. |
| 2026-09-27 03:03 | Fix pushed to `main` (`009c523`). Workers Builds deploys it as script version `51b39319…`; the failing runs were version `79d23754…`. |
| 2026-09-27 03:05 | First tick on the new code: outcome `ok`, wall time 13 s, `cpuTimeMs` 35. It carried the backlog: about 6 hours of audit events, the hourly usage refresh and cf-backup's four queued alerts, all sent and delivered. |
| 2026-09-27 03:10 | No tick fired. Every deploy re-sends the cron schedules, and Cloudflare says schedule changes take up to 15 minutes to propagate. |
| 2026-09-27 03:15 | Outcome `ok`, wall time 2.5 s, `cpuTimeMs` 15, `invocation.sequence.number` 1 (a fresh isolate). The dispatcher stamped `cron-usage-probe`'s clock, which it does only after every job call returns. In the same trace, a `JobRunner.jsrpc` event with its own `cpuTimeMs` (9), so the scheduled event's 15 ms is the dispatcher's own. |
| 2026-09-27 03:20 | Tick ran; `backup:status.lastTickAt` 03:20:06. |
| 2026-09-27 03:30 | Tick on a docs-only redeploy of the same code (version `25c215f7…`): dispatcher `cpuTimeMs` 6. |
| 2026-09-27 03:31 | Second pass deployed (`453b215`, version `772d3b61…`): a binding per job (the job id as `ctx.props`) and the light Sentry options on the scheduled handler (§5). |
| 2026-09-27 03:35 | First tick on `772d3b61…`: dispatcher `cpuTimeMs` 14. Each job in its own `jsrpc` invocation: `cf-access-audit-poll` 7 ms, `backup-tick` 5 ms, each under its own request ID. |

## 3. Root cause

**One invocation carried every job.** The scheduled handler in
`src/workers/cf-entry.ts` ran all due jobs inside the scheduled invocation
(`runCronBatch`, now removed from `src/lib/jobs/runJob.ts`). Cloudflare meters
CPU per invocation, and on Workers Free each invocation gets 10 ms. The ten jobs
together, plus the Sentry wrapper's per-invocation work (log capture, scrubbing,
trace sampling), came to about 22 ms.

**Cloudflare tolerates an occasional overrun, not a consistent one.** An
invocation over the limit is not always stopped at once. One that is over on
every run is eventually stopped at the limit, and it then reports `exceededCpu`.
This tick was over the limit on every run from at least 2026-09-16, so the
change on 2026-09-26 was Cloudflare enforcing the limit, not a change in this
code. Cloudflare does not say when it starts enforcing, so the exact trigger
cannot be named. `backup-tick` (2026-09-23) made the tick heavier, but the tick
was already over the limit before that job existed.

**Why the tick died whole.** The `allSettled` isolation between jobs protects
against a job that throws, not against the invocation being stopped: when the
CPU limit ends an invocation, every job still running in it ends too.

## 4. Impact

| Job | What stopped | Recovery once ticks resume |
|---|---|---|
| `cf-access-audit-poll` | Access sign-in events stopped reaching `admin_login_logs` | Catches up from its watermark, at most 1,000 entries per tick |
| `booking-email-retry`, `booking-outbox-poke` | A booking email or a booking stranded by an outage waited | Picked up on the next tick |
| `cf-access-reconcile` | A whitelist change was not pushed to Cloudflare Access on schedule. Changes made in the portal still sync straight away; only the reconcile safety net was down | Next tick |
| `storage-notifications` | Quota and share-expiry warnings delayed | Next due run |
| `backup-tick` | cf-backup's schedule, run reconciliation and alert mail stopped (its scheduled backups were already paused on 2026-09-26) | Next tick |
| `cron-usage-probe` | The D1 usage figure used for automatic shedding went stale. Shedding fails open, so every job would have run anyway | Next hourly run |
| `asset-cleanup`, `staff-storage-reconcile` | The 2026-09-27 Sunday run was missed | Run from `/dashboard/cron` with **Run now**, or wait for 2026-10-04 |

No data was lost. Page serving, sign-in and bookings made through the site
were not affected; only background work was.

## 5. Remediation

**Each due job runs in its own invocation.** The scheduled handler now calls
`dispatchCronJobs` (`src/lib/jobs/dispatch.ts`):

1. It reads the control document once and runs `decideJobRun` for every job.
2. A job the control plane holds back (off, paused, shed, throttled) is
   recorded as `disabled` or `shed` with no invocation. Today that is
   `gsc-sync`, `pagespeed-sync`, and `cron-usage-probe` between its hourly runs.
3. Every other job is called through the Worker's own `JobRunner` entrypoint
   (`src/workers/job-runner.ts`) over the `ctx.exports` loopback binding.
   Each call is its own invocation with its own 10 ms, and runs the unchanged
   `runJob`: gate, lease, meter, telemetry.
4. When the calls return, it stamps the interval clocks, as before.

Supporting changes:

- `wrangler.toml` gains the `enable_ctx_exports` compatibility flag, which is
  what exposes `ctx.exports`.
- `JobRunner` and the scheduled handler are wrapped by Sentry without
  console-log capture or tracing, so each 10 ms goes to the work. Narration
  still reaches Workers Observability, and errors still reach Sentry. The
  scheduled handler got this in the second pass.
- Each job is called through a binding of its own,
  `ctx.exports.JobRunner({ props: { jobId } })`, and reads its id from
  `ctx.props`. Props belong to one invocation, so no two jobs can ever share
  one budget. *Corrected 2026-09-27:* this was added because a `jsrpc` event
  showing `rpcCallCount` 2 was read as two jobs in one invocation. The
  03:35 events show `rpcCallCount` 2 on invocations that carry one job each,
  so the count is not a count of jobs. The binding stays as a guarantee.
- A named `WorkerEntrypoint` is reachable only through a binding, never from the
  Internet, so no new public endpoint exists.
- Where the flag is missing, the handler falls back to running the job in the
  same invocation, as before. That keeps tests and local development working.

**Cost on the free plan:** nothing new. Service Binding calls are not billed as
requests, and one invocation may make up to 32 of them. A tick makes 7 or 8.
D1 rows read are unchanged: each job now reads its own gate keys instead of
sharing one batched read, and no two running jobs share a key.

**What was already unnecessary, and stays that way:**

- `gsc-sync` and `pagespeed-sync` have been switched off in the control plane
  since 2026-09-16. They now cost no invocation at all.
- `cron-usage-probe` is throttled to hourly.
- `blog-scheduled-publish` still runs every tick and writes nothing: no post is
  in the `scheduled` state. Throttling it from `/dashboard/cron` (Manage →
  every 60 minutes) would save one invocation per tick. A scheduled post would
  then publish up to an hour late. That is a product decision for the owner, so
  the setting is unchanged.

### 5.1 Alternatives considered

| Option | Verdict |
|---|---|
| Workers Paid ($5/month, 30 s CPU) | Ruled out by the owner: the stack stays on free plans. |
| Supabase `pg_cron` + `pg_net` calling the portal | It moves the trigger, not the CPU: each call is still an HTTP invocation with 10 ms. It would also need a new public, secret-protected endpoint. Worth keeping as a **backup trigger** if Cloudflare Cron ever stops firing, but it is not a fix for this. |
| Sentry Cron Monitors | These watch a schedule; they cannot run it. They are the right tool to **alert** within minutes when ticks stop. Here it took hours, and cf-backup's Diagnostics was what noticed. Follow-up §7. |
| PostHog | An analytics product. It has nothing that can run this Worker's jobs. |
| GitHub Actions `schedule` | A private repository gets 2,000 minutes a month. A five-minute schedule needs about 8,640 billed minutes, and GitHub delays or drops scheduled runs under load. |
| Cloudflare Queues fan-out | This works, but each job would cost about 3 queue operations per tick, roughly 6,000 of the 10,000 daily free operations. The portal's revalidation queue already uses that quota. The loopback binding costs nothing. |
| Keeping state in isolate memory (the 128 MB) | Memory was never the constraint; CPU time was. An isolate can be evicted between ticks, so nothing cached there is guaranteed to survive to the next one. |

## 6. Verification

- **Before deploy:** `npm run verify` (typecheck, ratchet, tests, gates, docs
  check) passes. The build's `dist/server/entry.mjs` exports `JobRunner`
  next to the default handler. `dist/server/wrangler.json` carries
  `enable_ctx_exports` and both crons.
- **End to end in workerd (local `wrangler dev --test-scheduled` on the
  built Worker, local D1 with migrations applied):** with a control document
  holding `gsc-sync` and `pagespeed-sync` off and `cron-usage-probe` inside its
  hour, the five-minute trigger made exactly 7 `JobRunner.run` calls, each
  receiving the control document (rev 7). The three held-back jobs got none.
  The Sunday trigger made 2 calls. Without a control row, all 10 jobs were
  called (fail open). Temporary log lines in the built bundle showed which path
  ran; they were removed before the commit.
- **After deploy (2026-09-27):** ticks resumed. The 03:05 and 03:15 ticks
  ended `ok` on version `51b39319…`. `cf-audit-last-synced` and
  `backup:status.lastTickAt` moved to 03:05. At 03:15 `cron-control` was
  stamped by `cron-tick`, and cf-backup recorded its alerts as delivered.
  cf-backup writes `lastTickAt` only every other tick when nothing else
  changed, so it does not move on every tick.
- **Settled:** the `JobRunner` calls report their own `cpuTimeMs` (event type
  `jsrpc`), so the scheduled event's figure is the dispatcher's alone. The job
  invocations measured 5 and 7 ms, inside their budgets.
- **Still open: the dispatcher's own CPU varies from tick to tick** (35, 15,
  6 and 14 ms) whatever the Sentry options. Every tick starts a fresh isolate
  (`invocation.sequence.number` 1). The high readings are the first ticks
  after a code change, which fits V8 having no compiled code cached yet for
  the new version. The ticks after a deploy decide what comes next. If they
  settle near 6 ms, the only overrun is the first tick after each deploy,
  which Cloudflare tolerates when it is occasional. If they stay over 10 ms,
  the dispatcher's own work has to shrink further.

## 7. Follow-ups

1. **Alert when ticks stop.** Add a Sentry cron monitor check-in from the
   scheduled handler, so a stopped tick pages within one interval. Check the
   free plan's monitor allowance first.
2. **A backup trigger (optional).** A Supabase `pg_cron` job that calls an
   authenticated portal endpoint only when `backup:status.lastTickAt` is older
   than 15 minutes. It is only worth adding if §7.1 shows Cloudflare Cron
   missing ticks.
3. **Owner decision:** throttle `blog-scheduled-publish` (§5).
4. **Run the missed Sunday jobs** from `/dashboard/cron`, or let them run on
   2026-10-04.

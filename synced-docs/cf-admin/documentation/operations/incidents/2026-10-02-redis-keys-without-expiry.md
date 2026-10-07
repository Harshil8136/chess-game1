---
title: "Incident Record — Redis Keys Without an Expiry: Rate-Limit Analytics Kept Identifiers Indefinitely"
status: active
audience: [ai, technical, operator, owner]
last_verified: 2026-10-02
verified_against: [code, infra, live]
owner: harshil
related_code: [src/lib/ratelimit.ts, src/lib/alert-gate.ts, src/pages/api/auth/logout.ts, src/pages/api/emails/unsubscribe.ts]
related_docs: [../OPERATIONS.md, ../../security/RoPA.md, ../../security/compliance/data-residency.md, ../../security/SECURITY.md, ../../architecture/RATE-LIMITING-AND-REDIS-ELIMINATION-STRATEGY.md, ../../features/CRON-CONTROL.md, ../../MAINTENANCE.md]
tags: [incident, redis, upstash, ratelimit, privacy, retention, ttl]
---

# Incident Record — Redis Keys Without an Expiry: Rate-Limit Analytics Kept Identifiers Indefinitely

> **Summary (non-technical):** The platform's shared Redis database (Upstash),
> which cf-admin, the public website (cf-astro) and the chatbot all use, held
> hundreds of entries that were never going to be deleted. They were written by
> a usage-statistics feature of the rate-limiting library, switched on since
> April 2026, which records each visitor's IP address (or, in the admin portal,
> the user's internal id) once an hour and never sets an expiry. Nothing in the
> platform read those statistics. The privacy records said these identifiers
> are kept for minutes to hours; in fact they had been kept for up to 56 days.
> No visitor or staff member was affected, nothing failed, and no data left the
> platform's own database. The feature is now off in every app, the 648 entries
> were removed on 2 October 2026, every key in the database now expires, and a
> weekly check reports — and repairs — any key that would not.

## 1. Overview

| | |
|---|---|
| Store | Upstash Redis `modest-mastiff-88856` (free tier), **shared** by cf-admin, cf-astro and cf-chatbot |
| Symptom | 648 of 651 keys had no expiry (owner report: "hundreds of stale keys") |
| Keys | `{prefix}:events:{hour-bucket}` sorted sets: 508 from cf-astro (`madagascar:*`, mostly `admin` 354 and `consent` 140), 140 from cf-admin (`cf-admin-rl:*`, 30 limiter names). 677 members, 162 KB |
| What they held | One member per identifier per hour: `{"identifier": …, "success": …}`. cf-astro: **raw IPv4 addresses of 179 distinct website visitors**. cf-admin: 12 identifiers — internal user UUIDs, and raw IPv6 addresses on the session-less routes |
| Oldest | 2026-08-07 17:00 UTC (cf-admin), 21:00 UTC (cf-astro) |
| Cause | `analytics: true` on `@upstash/ratelimit`. Its analytics dependency, `@upstash/core-analytics` 0.0.10, never sets an expiry (§3) |
| Detected | 2026-10-01, by the owner, in the Upstash console |
| Status | **Resolved 2026-10-02.** No key without an expiry since 02:39:50 UTC; the 648 were gone by 03:40 UTC (§6). A weekly job guarded it (§5) until 2026-10-04, when cf-admin stopped using Upstash and the job left with its Upstash code; checking cf-astro's and cf-chatbot's keys is now open ([`../../MAINTENANCE.md`](../../MAINTENANCE.md) RU-8, [record](../../records/reports/2026-10-04-resource-usage-optimisation.md)) |

## 2. Timeline (UTC)

| When | What |
|---|---|
| 2026-04-07 | cf-astro's limiter is created with `analytics: true` (`75ce3c6`). |
| 2026-04-12 | cf-admin's limiter is created with `analytics: true` (`ab7df0f`). |
| 2026-08-07 | The oldest key that survived to 2026-10-02 was written this day. A one-off sweep script outside this repository, last modified the same day, gives every key without an expiry a default of up to 7 days. **Most likely** it was run then: the older keys expired, the writer kept writing, and the build-up started again. Nothing else records that sweep. |
| 2026-08-07 → 2026-10-01 | About 12 new expiry-less keys a day. Most of the traffic behind them (3,844 of 4,265 limit checks) is monitoring probes on cf-astro's `/api/health`. |
| 2026-10-01 | Owner reports the stale keys and asks for a review. |
| 2026-10-02 01:35 | Read-only census of the instance: 651 keys, 648 without expiry, every one an analytics bucket. Root cause read in the installed library source. |
| 02:18 | cf-astro fix pushed (`5c83638`, `e5bd786`). Deployed 02:19 as `87d1e42f…`. |
| 02:31 | cf-admin fix and the `redis-ttl-hygiene` job pushed (`f7c4820`…`822f762`). Deployed 02:38:42 as `8a626f9f…`. |
| 02:35 | Production D1: job catalog seeded; `admin_portal_settings` `redis-hygiene-mode` = `repair`. |
| 02:35:57 | cf-chatbot write-path hardening deployed as `d5b9bd82…` (its keys were not part of the leak; §5). |
| 02:37, 02:40 | One live probe per app (cf-astro `GET /api/health/` → 401, cf-admin `POST /api/emails/unsubscribe` → 400): each wrote one sliding-window key expiring in 118 s and **no** analytics key. |
| 02:39:43 | Cleanup: the hygiene module, in repair mode, gives the 648 keys `EXPIRE 3600 NX`. Unrecognised keys: 0. Over-long expiries: 0. |
| 02:39:50 | Census: **0 keys without an expiry.** |
| 03:07 | Fixes from an independent review pushed (`0c8c611`, docs). cf-astro deployed 03:08:47 (`1a76ac0e…`), cf-admin 03:14:29 (`fe4d753f…`). |
| 03:41:12 | Census after the one-hour expiry: **3 keys in the whole instance, all with an expiry** (0.4 KB, down from 651 keys and 162 KB). |

## 3. Root cause

**The library's retention option does nothing.** With `analytics: true`, every
`limit()` call in `@upstash/ratelimit` 2.0.8 also records an event through
`@upstash/core-analytics`: `ZINCRBY {prefix}:events:{hourBucketMs} 1 {identifier, success}`.
Ratelimit constructs the analytics client with `retention: "90d"`, but the
`Analytics` constructor in core-analytics 0.0.10 reads only `redis`, `prefix` and
`window`. No code path ever sets an expiry, so every hour that saw traffic left
one key behind for good.

**Nothing read the data.** No code in cf-admin, cf-astro or cf-chatbot calls the
analytics read methods (`getUsage`, `getUsageOverTime`, …); only the Upstash
console's analytics view could show it. The keys were pure cost.

**Why it went unnoticed for six months.**

- Diagnostics shows the Redis key count as a bare number, with no baseline and no
  check for keys without an expiry.
- The rate-limit keys that the docs describe — the sliding-window counters — do
  expire (2 × window + 1 s), so a review of the limiter's own keys found nothing.
- The August sweep, if it ran, removed the symptom and not the writer.
- Three apps write to one instance and no document listed the key families or
  their expiries, so an unfamiliar key had no owner to ask.

**Contributing: writes that set the expiry separately.** Several writers stored a
value in one request and its expiry in a second (`INCRBY` then `EXPIRE` for the
AI neuron counter; `LPUSH`, `LTRIM`, `EXPIRE` as three GETs in both alert gates;
`HSET`/`ZADD` then `EXPIRE` in cf-chatbot). None had stranded a key at the time
of the census, but a failure between the two requests would have left one
without an expiry. The alert gates also took any HTTP response for success,
because `fetch` does not throw on a 4xx or 5xx.

## 4. Impact

| Area | Effect |
|---|---|
| Privacy | Raw visitor IPs and admin identifiers were kept with no expiry for up to 56 days. [`RoPA.md`](../../security/RoPA.md) §2 said "sliding window (minutes to hours)" and [`data-residency.md`](../../security/compliance/data-residency.md) said "short-TTL, no durable storage" — both wrong for the whole period. The **public** privacy policy's 90-day target for raw-IP security logs was not crossed: the oldest key was 56 days old, and it would have been crossed on 2026-11-05. |
| Exposure | The data stayed in the platform's own Upstash database (a US sub-processor already listed in RoPA §3), readable only with the Upstash token. Nothing indicates access by anyone else. |
| Availability | None. No request failed because of it. |
| Cost and capacity | Negligible: 162 KB of the 256 MB allowance, and one extra Redis command per rate-limit check (about 77 a day). |
| Data loss | None. The removed entries had no reader; no copy was kept, because a copy would have been the same retention problem. |

### Found and fixed during the same work

| Finding | Effect before the fix | Fix |
|---|---|---|
| A slow Upstash silently disabled rate limiting | After 5 s the library answers `{ success: true, reason: 'timeout' }` instead of failing, so every limiter allowed the request — in cf-admin against its documented fail-closed posture, and in cf-astro without the documented KV fallback | Timeout set to 3 s in both apps. cf-astro sends a timeout to its KV fallback; cf-admin's `getRateLimiter` refuses it (fail closed), logged to Observability and once per isolate to Sentry |
| Logout refused during an Upstash timeout | Introduced by the fail-closed change at 02:38 and fixed at 03:14: a logout during a stall of more than 3 s would have kept the session alive while telling the user they were signed out | The refusal carries `reason: 'timeout'`; logout and the RFC 8058 unsubscribe proceed on it, and still refuse a real over-limit |
| cf-chatbot "zombie" sessions | A language update on an expired session recreated it as a hash holding only `language`, which then "resumed" with no conversation | One script that updates only an existing session; `getSession` rejects a hash without its contact and conversation |

## 5. Remediation

1. **The writer is off.** `analytics: false` in `src/lib/ratelimit.ts` (cf-admin)
   and `src/lib/rate-limit.ts` (cf-astro), pinned by tests in both repos.
2. **The leftover keys are gone.** The 648 keys were given a one-hour expiry
   (`EXPIRE … NX`) rather than deleted, leaving an hour to undo it if something
   unexpected had depended on them. Nothing did.
3. **A weekly net under every writer: `redis-ttl-hygiene`.** A new job on the
   existing Sunday trigger (`0 2 * * SUN`) — no new cron slot, env var or table.
   `src/lib/redis-hygiene.ts` recognises every key family the three apps write
   (the inventory is in [`../OPERATIONS.md`](../OPERATIONS.md) §3.6), and each run:
   - reports keys with no expiry, keys whose expiry is longer than their writer
     sets, and keys it does not recognise;
   - in `repair` mode (`admin_portal_settings` `redis-hygiene-mode` = `repair`,
     set 2026-10-02) gives a recognised key its writer's expiry with
     `EXPIRE … NX` — it never deletes, and never touches an unrecognised key;
   - alerts at `warning` (console, D1 `platform_alerts`, Sentry) on any finding;
   - never logs a raw key: identifiers are folded out before anything is reported;
   - stays inside one Workers Free invocation: at most 12 Upstash calls and
     2,000 keys, each call bounded by a 10 s timeout. A bigger keyspace is
     reported as `truncated`, and an Upstash failure fails the run visibly.
4. **Every write carries its expiry in the same request.** `trackAiNeurons` is
   one `MULTI/EXEC`; both alert gates write their list in one `POST /multi-exec`
   and treat a non-2xx as a failure; cf-chatbot's rate limit and session writes
   are transactions or a script.
5. **The records are true.** RoPA §2/§3, data-residency, ISO 27017/27018, SECURITY,
   OPERATIONS §3.6, the rate-limiting strategy doc, the D1-down runbook and Cron
   Control now describe the system as it is, and `RULESAd.md` carries a rule so
   the leak cannot be reintroduced quietly.

## 6. Verification

| Check | Result |
|---|---|
| Tests | cf-admin `npm run verify`: 111 files, **1,531/1,531** tests; ratchet, gate tests, rules, a11y, audit and markdownlint green. cf-astro: **241/241**, every gate green. cf-chatbot: the 8 new Redis tests pass |
| Independent review | One reviewer, fresh context, across the three repos: no critical findings; its important findings (the logout case, the invocation budget, a request timeout, two doc errors) fixed with failing tests first |
| Production, analytics off | One probe per app after each deploy: a 121 s sliding-window key appears, no `:events:` key does |
| Production, every key expires | Census 2026-10-02 02:39:50: 652 keys, **0** without an expiry |
| Production, leftovers gone | Census 2026-10-02 03:41:12: 3 keys (a neuron counter, one sliding-window key, one chatbot session), 0 without an expiry, no `:events:` key |
| The live classifier | A report-mode dry run of `redis-hygiene.ts` against the live instance before the cleanup classified all 651 keys: 648 repairable, 0 unrecognised |

## 7. Follow-ups

Tracked in [`../../MAINTENANCE.md`](../../MAINTENANCE.md) "Redis TTL remediation":

- **R-1** — when roadmap chunk 16 removes Upstash from cf-admin, **move** the
  hygiene job to whatever still holds the instance's credentials; do not delete
  it. cf-astro and cf-chatbot keep using the instance.
- **R-2** — restate the job's D1 budget, and record its CPU time, from the first
  Sunday run (2026-10-04).
- **R-3** — the `alerts:{severity}` lists are written and never read; drop them
  with chunk 16.

Outside this repository, for the owner:

- Two older cf-admin worktrees (`feat/email-console`, `feat/vps-console`) still
  contain `analytics: true` and deploy to the same Worker. A deploy from either
  would bring the leak back until the next Sunday repair. Both are clean and
  merged; remove them.
- The one-off sweep script from 2026-08-07 expires every key it finds, including
  ones it does not recognise, and prints raw keys. The weekly job replaces it;
  retire it.

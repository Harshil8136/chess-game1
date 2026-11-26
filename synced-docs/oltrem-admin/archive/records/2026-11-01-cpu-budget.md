---
title: "CPU per page and per tick, for the Free plan (2026-11-01)"
status: record
owner: vendor
last_verified: 2026-11-01
sources: [packages/core-http/src/app.ts; packages/screens/src/api.ts; packages/core-audit/src/module.ts; packages/core-config/src/clock.ts; modules/iam/src/module.ts; templates/client/src/index.ts; templates/client/test/screens.test.ts; packages/core-http/test/inner.test.ts]
---

# CPU per page and per tick

> **In plain words.** On Cloudflare's free plan each request and each run of the five-minute
> timer may use 10 ms of processor time. The client portal was using about 34 ms on a typical
> run in production, with spikes to 75 ms. Most runs are the timer, because almost no one is
> using the portal yet. Four things cost the most. Once a day the timer re-checked a week of the
> audit log in one go. Every page asked the portal's own API about 25 times, and sent each of
> those questions through the whole front door again. The first date shown in a fresh copy of
> the Worker loaded the world's time-zone data. Each module also read its own copy of the
> permission list. Now the audit check is spread over the day, a little at a time. A page's
> questions to its own API are answered inside the same request, and every permission check
> still runs on each one. The time-zone data is loaded while the Worker starts up, which the
> plan does not count against a request. The permission list is read once and shared. Measured
> locally, the worst timer run went from about 40 ms to about 10 to 20 ms. The usual timer run is
> about 5 ms, and every page but Home is well under 10 ms. Home is about 10 ms. The first request
> to a fresh copy of the Worker is still well over 10 ms, and only Cloudflare's own numbers can
> show how often that happens in production.

## What changed

| Cost | Before | Now |
|---|---|---|
| The audit seal's recheck | `audit.seal` (daily) rechecked the newest 7 seals in the same run, every row of each hashed again in the Worker: 36 to 47 ms of a tick on a log of 300 rows a day | `audit.recheck`, every 15 minutes: the seals not yet checked today, at most `RECHECK_ROWS` (200) rows hashed a run, its place kept in the bucket at `logs/audit/recheck.json`. A seal's chain is computed from the hashes `verify` already read, or, for a large seal, from one value the database joins (`group_concat ... ORDER BY seq`). The daily seal only seals. |
| A page's calls to its own API | each call went through `app.fetch`, the whole pipeline again (request id, security headers, same-origin check, the door, the startup gate, Hono's routing and context): Home 26 passes | `INNER_CALL` in core-http: the outer request's identity and parts switched off are reused. The part switched off, the session hook, the capability check, the schema, the handler and `onChange` all run as before. A page is one pass. |
| The router | Hono's default router failed its first choice on one module route, then built two routers on an isolate's first request | the trie router, built while the Worker loads |
| Time zones | a new `Intl.DateTimeFormat` for every date shown, every check of a zone, and every quiet-hours test in the tick. The first one in an isolate loads the time-zone data (10 to 30 ms locally) | one formatter per zone, kept (`core-config` clock, the email look, alerts, campaigns). `warmClock()` runs in the Worker's global scope. Sorting days and devices compares text directly instead of `localeCompare`, which loads collation data. |
| The capability index | each module that checks capabilities loaded its own copy of `iam_capabilities` on first use (`/email/write` read it twice) | `createIam(...).index`, shared with every module that takes `index` |

The owner suggested a signed session cookie. It was measured first and not built: reading the
session (the KV get and `sessions.ts`) costs under 0.1 ms on a warm page. A signed cookie would
save nothing measurable, and it would add a key and a revocation path.

## Before and after

Local, `wrangler dev` with the Worker minified, on the same database: a company, senders and
sent emails, and 300 audit rows a day for 8 days with 7 seals. "Before" is the parent commit's
code, measured on the same database the same day. Warm pages are the mean of 10 requests. Cold is
the first request of a fresh isolate. Milliseconds of CPU, the "active" measure described below.

| Page | Warm before | Warm after | Cold before | Cold after |
|---|---|---|---|---|
| `/` Home | 12.3 | 10.8 | 58.5 / 73.3 / 76.4 | 45.0 / 57.9 / 43.8 |
| `/email/write` | 6.4 | 5.3 | | |
| `/email/sent` | 14.1 | 5.9 | 101.0 | 35.0 |
| `/email/senders` | 4.2 | 3.3 | | |
| `/people` | 5.2 | 4.9 | 45.0 | 47.7 |
| `/access` | 3.2 | 3.9 | | |
| `/settings` | 5.8 | 5.1 | 42.4 | 42.3 |
| `/health` | 4.8 | 6.4 | | |
| `/audit` (180 KB page) | 8.4 | 8.9 | | |
| `/tasks` | 2.7 | 2.9 | | |
| `/healthz` | 0.0 | 0.1 | | |

| Tick | Before | After |
|---|---|---|
| nothing due | 0.2 | 0.3 |
| the 5-minute jobs due, warm | 5.7 / 8.5 / 6.6 | 4.5 / 5.6 / 5.2 |
| the 5-minute jobs due, cold isolate | 16.9 (20.5 in an earlier run) | 19.4 (13.3 and 18.5 in earlier runs) |
| every job of 15 minutes or less, the seal and the recheck due, warm | 46.7 / 38.9 / 36.3 | 12.9 / 20.0 / 10.1 |
| the same, cold isolate | 51.5 | 24.9 |

The worst tick only happens on the first runs after UTC midnight, while today's rechecks are
still running. The rest of the day the recheck finds nothing to do. Between runs on unchanged
code the warm figures move by 1 to 3 ms, and the cold figures by more: differences that small
(`/access`, `/health`, `/audit`) are noise.

**Still over 10 ms locally:**

- The first request of a fresh isolate: about 45 ms for Home and 35 to 48 ms for other pages.
  This is V8 compiling each function the first time it runs, plus the reads made once per
  isolate: the capability index, the settings snapshot and the parts switched off.
- A cold tick: 13 to 25 ms, spread over every job's first run.
- The worst warm tick: 10 to 20 ms.
- Home warm: about 10 ms. About 25 database queries and their wrappers make up roughly 3 ms.
  Rendering, including the sidebar's icons, makes up about 3 ms.

Production processors differ from this computer, and part of the local cost (the local D1's
wrapper and tracing) may differ there too, so these figures do not translate directly. The
owner's check is Cloudflare's own CPU time per invocation, split by trigger (below).

## How it was measured

- `wrangler dev --test-scheduled` with its inspector, and the CPU profiler of the Chrome
  DevTools Protocol, recording one or more requests to a page or to `/__scheduled`.
- **Active CPU** sums the profiler's samples whose gap to the next sample is under 1 ms. A longer
  gap is the isolate waiting on the database, KV or the bucket, or idle between requests. The
  plan does not count that time as CPU, but a plain sum of samples does. The plain sum was also
  recorded. It is several times larger and is not what the plan limits.
- Cold runs restart the dev server and profile its first request. The global scope runs before
  that request and is not in its figure, just as Cloudflare counts it against the separate
  startup limit. Local startup measured 139 ms with `wrangler check startup`.
- The ticks reset the seals' `checked_at` and set the chosen jobs due before each run, so every
  warm run did the same work.
- Attribution to source files and functions used an unminified build with the same settings.
- Production-only work cannot be profiled locally: `health.measure` calls Cloudflare's GraphQL
  API every 15 minutes, `iam.door` calls the Cloudflare API, and the email and campaign jobs call
  the providers. Their own CPU is small next to the wait, but it is not in these figures.

## The guards

Timings are too noisy for a gate, so the guards count:

- `templates/client/test/screens.test.ts`: every page in the sidebar, a person's page and the
  new role page go through the pipeline once (`app.fetch` called once), read KV at most twice,
  write nothing and never read `iam_capabilities`. The existing query budgets still hold (Home
  40, other pages 10). A person denied `users.read` opens People in one pass and still sees
  "users.read is needed". With the inner call switched off, both tests fail: Home made 25
  passes.
- `packages/core-http/test/inner.test.ts`: the inner call's checks, one by one. The capability
  check refuses with 403, a refusing session hook, 422, 404 for a part switched off,
  `onChange` told, and the whole pipeline taken with no identity or to another origin.
- `packages/core-audit/test/module.test.ts`: one recheck hashes at most `RECHECK_ROWS` rows. A
  large seal is finished over several runs, and a change late in it, or a row removed from it,
  is still found.
- `packages/core-config/test/clock.test.ts`: once a zone is warm, no new formatter is made.

## What the owner checks in Cloudflare

1. **Workers & Pages, the client Worker, Observability**: the invocation logs carry `cpuTime`
   per invocation. Filter by trigger. Compare scheduled with fetch, and the five-minute runs with
   the first runs after 00:00 UTC (the recheck), over a day before and after this deploy.
2. **Metrics, CPU time**: the median should fall well below the 34 ms seen before. If the
   scheduled median stays high while the warm figures above are low, most ticks are landing on
   fresh isolates. That cold cost is what is left to work on.
3. **Errors on the scheduled trigger** after the deploy: `audit.recheck` runs SQL that the
   tests run on the local D1 but nobody has yet run on production D1 (`group_concat` with
   `ORDER BY`). A failure shows as a failed job on the Tasks page and in System status. It does
   not mark a seal broken.

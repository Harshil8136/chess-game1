{% raw %}
---
title: 'Codebase Assessment, Progress Tracking & Edge Architecture'
status: active
audience: [technical, ai, operator]
last_verified: 2026-08-28
verified_against: [code, tests, checklist, live-infrastructure]
owner: harshil
related_docs: [../../RULES.md, ../../AGENTS.md, ../SYSTEM-ARCHITECTURE.md, ../CONSENT-RECORD-SYSTEM.md]
tags: [assessment, progress, quality, health, resilience, observability, durability]
---

# Codebase Assessment & Progress Tracking Ledger

> **Status:** Active
> **Target Application:** `cf-astro` (Astro 7 SSR + Cloudflare Workers + Preact)
> **Last Comprehensive Audit:** August 2026

> ### Publication policy for this file
>
> This document syncs to a **public** repository. It therefore contains:
>
> - **No database schematics.** No table names, column names, DDL, migration
>   contents, or query text. Data mechanisms are described by their *behaviour*,
>   not their shape. If you need the schema, read the migrations in the private
>   repo — never mirror them here.
> - **No infrastructure identifiers.** No account IDs, database or namespace
>   UUIDs, project references, or hostnames.
> - **No personal data.** No customer emails, names, or phone numbers.
>
> Secret *names* may appear (they are already public in `.env.example`). Secret
> *values* never do. Keep it that way when editing.

---

## 1. Executive Summary & Verification Baseline

Full-spectrum static analysis, security validation and test audit, followed by a
durability overhaul of the booking path and a system-wide observability floor.

| Category | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **P0 Security** | `.agents/scripts/checklist.py` | 🟢 **PASS** | 0 vulnerabilities, least-privilege DB role, secure headers |
| **P1 Lint** | `npm run lint` | 🟢 **PASS** | **0 errors, 0 hints** (2 pre-existing hints resolved) |
| **P1 Types** | `npm run typecheck` | 🟢 **PASS** | 164 files — 0 errors, 0 warnings, 0 hints |
| **P2 Data Layer** | `npm run db:check` | 🟢 **PASS** | Migration chain and schema in 100% sync |
| **P3 Testing** | `npm run test` | 🟢 **PASS** | 20 files, **176 tests** (was 15 / 109) |
| **P4 Accessibility** | `a11y_check.py` | 🟢 **PASS** | 6 rules over 81 files, 0 findings |
| **P5 SEO** | `seo_checker.py` | 🟢 **PASS** | Trailing slash, sitemaps, OpenGraph, JSON-LD |

> **Pre-flight command correction.** The checklist script lives at
> `.agents/scripts/checklist.py` — **plural**, at the **parent repo root**, run
> from the workspace parent, not from inside `cf-astro/`. It was documented as
> `.agent/` in both `main.md` and `GITHUB_RULES.md` until 2026-08-28, so the
> mandated deployment gate had never actually been runnable as written. Both
> files are now corrected.

---

## 2. Architectural Invariants Ledger ("DO NOT POKE")

Deliberate, incident-hardened production choices. Never alter or remove during a
refactoring pass without explicit owner sign-off.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CRITICAL ARCHITECTURAL INVARIANTS                     │
├────────────────────────────────┬─────────────────────────────────────────────┤
│ Invariant                      │ Operational Rationale                       │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ No Turnstile on Booking/Contact│ Life-safety-adjacent booking path for pets. │
│                                │ Widget failures must never drop bookings.   │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Audit-First Ordering           │ The raw attempt is recorded locally BEFORE  │
│                                │ origin or rate-limit checks can reject it.  │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Fail-Open Rate Limiting        │ Upstash → shared KV → allow. Never 503 a    │
│                                │ legitimate booking or contact request.      │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Strict Origin Check on POST    │ CSRF defence stays strict. Rejections are   │
│                                │ now ALERTED rather than silently dropped.   │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Least-Privilege DB Access      │ Dedicated writer role over raw Postgres.    │
│                                │ No admin credential on any request path.    │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Async Decoupled Email          │ Enqueue to the shared queue; a sidecar      │
│                                │ worker sends, with provider failover.       │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Outbox-Before-Database         │ NEW. The canonical payload is made durable  │
│                                │ at the edge BEFORE the database is touched, │
│                                │ for consent AND bookings. Never reorder.    │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Success Response on DB Failure │ NEW. The booking API returns success even   │
│                                │ when the database is down. Owner decision.  │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Console Is The Logging Floor   │ NEW. Every warning and error reaches        │
│                                │ Cloudflare Observability directly, with no  │
│                                │ third-party dependency in the path.         │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Category-Based Privacy Copy    │ LFPDPPP / GDPR Art. 13 generic disclosure   │
│                                │ (no internal vendor names in public text).  │
├────────────────────────────────┼─────────────────────────────────────────────┤
│ Hard Env Var Cap (~21)         │ Zero new env vars for feature flags. Use    │
│                                │ the shared dynamic config store instead.    │
└────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 3. Booking Durability Overhaul

### 3.1 Why this was needed

The architecture *documented* two guarantees — a booking always reaches the
business, and the customer never sees an error. Verification against live
infrastructure showed **neither was true**. Three findings:

**Finding 1 — the recovery store was blind.**
The dead-letter record captured every booking attempt, but its correlation
reference was written as a fixed placeholder string and never updated with the
real value, which was generated later in the flow. Contact details were likewise
left as placeholders until a partial backfill much later in the request.

The consequence was not cosmetic. A live reconciliation found **22 attempt
records marked complete against only 14 bookings in the system of record**. Five
had no correlatable booking — and because the reference and contact fields were
placeholders, **it was impossible to determine whether those were lost bookings
or deliberately deleted test data**. The recovery mechanism could not see what it
was supposed to recover.

**Finding 2 — a database failure had no automated recovery at all.**

- The admin-side reconciler only looked for the *email* failure state. The
  database-failure state appeared nowhere in its source.
- It also required the email payload, which was persisted only *after* the
  database transaction committed — so a database failure could never have
  matched it even if the state filter had been widened.
- On database failure the route returned **HTTP 500 with a red error box**, and
  because email dispatch happened after the transaction, **no staff notification
  was sent at all**. An outage meant the customer saw a failure *and* the
  business never learned a customer had tried to book.
- The admin repo's own sync review had already recorded this: a booking outbox
  was planned, and only its "first consumer" (email retry) ever shipped.

**Finding 3 — the email sidecar's dead-letter handler deleted bookings.**
After three failed sends a message reached the dead-letter queue, whose handler
captured a Sentry event and then acknowledged the message — destroying the only
copy. No durable write, no re-drive path, and no telemetry flush before it
returned. If that one event was lost, quota-dropped, or unwatched, the booking
notification was gone permanently.

**Supporting weaknesses.** The attempt-state update was an unguarded overwrite,
and the email dispatch and the final success write were backgrounded
**concurrently** — so a fast queue rejection recorded a failure that the success
write immediately clobbered, hiding the record from the only reconciler that
read it. Records stranded mid-flight by an isolate eviction were scanned by
nothing. On the client, a **single** fetch with a 30-second timeout and no retry
meant any mobile network blip produced a red error box and a booking that never
left the browser.

### 3.2 Why this approach — reuse, not a second system

The 2026-08-07 consent outage had already forced us to build exactly the
machinery a booking outbox needs, and it is production-proven: durable local
write before the network call, lease-based claiming, transient-vs-permanent
error classification, exponential backoff, exhaustion accounting, an hourly
heartbeat, and a rolled-back-write health probe.

Cloning ~200 lines of that into a second file would have doubled the maintenance
surface and let the two drift — exactly as the rate-limit constants once drifted
from the config defaults before a shared contract module fixed them structurally.

**So the drain loop now lives once, and each store plugs in as a tenant.** The
consent implementation was rewritten as a thin tenant over that shared core — its
22 existing tests pass unchanged, which is the evidence the refactor was
behaviour-preserving — and booking is the second tenant. Net new concepts:
approximately zero. This is what makes the change *reduce* the maintenance
burden rather than add to it.

**Alternatives considered and rejected:**

- **A queue as the outbox.** Queue messages are not queryable for audit, their
  retention is shorter than a schema-drift outage can plausibly run, and it would
  need another consumer worker. The attempt store already exists, already holds
  the record, and is already covered by the retention policy and heartbeat.
- **A Durable Object.** Far too heavy for a path that sees roughly one booking a
  week.
- **New tables.** Forbidden by RULE #0.9 without proving existing infrastructure
  cannot house the model — and it can. Only fields were added.

### 3.3 What was built

**Phase A — forensics and correctness**

- The correlation reference is now generated *before* the first durable write and
  carried through the whole flow, so the recovery store and the system of record
  share a key from the very first moment. A reference is an opaque identifier, so
  minting it early costs nothing.
- Attempt-state updates are now **monotonic**: an optimistic state can never
  overwrite a recorded failure. Failure and recovery states still write through,
  so the outbox can record progress on a record already marked failed. Enforced
  in the query predicate, so it is atomic against concurrent background tasks.
- The success write is now **chained after** the email dispatch settles instead
  of racing it. Belt and braces: ordering plus the predicate guard.
- Origin-blocked and rate-limited bookings now raise a warning-severity alert.
  The origin check stays strict (invariant untouched) — this is the visibility
  that will tell us with data, not guesswork, if it ever costs a real customer
  (for example an in-app browser that strips the origin header).

**Phase B — the booking outbox**

- A shared outbox core holding the drain loop, backoff schedule and error
  classification, with consent and booking as tenants.
- A canonical transaction builder — the single chokepoint used by both the live
  write and any replay. Every identifier is generated up front; without that, a
  replay would create a *second* set of child records rather than colliding.
- Outbox fields added to the existing attempt store via a generated migration,
  with a partial index to drive the drain. As with consent, the replay payload
  **deliberately bypasses PII redaction** — it *is* the booking awaiting
  delivery, and redacting it would make it unreplayable.
- The write path restructured: build → durable local write → attempt the
  database (allowed to fail) → **dispatch email on both paths** → return the same
  success response either way.
- A replay endpoint mirroring the consent one: bearer-only, deliberately without
  the origin check (a scheduled `curl` sends no origin header; adding the check
  would silently disable the drain — exactly the class of quiet failure this
  subsystem exists to prevent).

**Phase C — the customer never sees an error**

- A resilient submission module: persist to `localStorage` *before* the network
  is touched, retry with exponential backoff and jitter (network errors and
  5xx/429 only, never 4xx), `sendBeacon` on `pagehide`, and replay on next page
  load and on the `online` event.
- The wizard draft moved from `sessionStorage` to `localStorage`. It used to die
  with the tab — on a three-step mobile form, that was the single largest silent
  source of abandonment.
- When every attempt fails, the wizard shows a **success screen with an offline
  notice and a WhatsApp button**, not an error. The booking is durable and will
  be delivered; telling the customer to "try again" would risk a duplicate
  submission and misrepresent what happened.
- `pagehide` / `visibilitychange` rather than `beforeunload`, which is unreliable
  on mobile and blocks the bfcache.

**Phase D — the last mile (email sidecar)**

- The dead-letter handler now **persists the payload durably before
  acknowledging**. If it cannot make it durable it requeues instead — a message
  sitting visibly in the dead-letter queue is recoverable; an acknowledged one is
  gone forever. Loud failure beats silent loss. A telemetry flush was added
  before its early return.
- Message parsing moved *inside* the try block, so one malformed body can no
  longer throw past the loop and abort the whole batch.
- The audit-write helper no longer re-throws. It was called inside the catch
  block on the line before the requeue call, so during a database outage the
  throw escaped before the requeue could run — and the failure record you would
  use to diagnose it was the very write that failed.
- Provider failover and discarded unknown-type messages now raise Sentry events.
  Log sampling raised from 5% to 100%: at 5%, 95% of that worker's diagnostic
  output was being dropped.

**Phase E — detection**

- The hourly heartbeat now covers bookings as well as consent: outbox depth, open
  failure states, stranded records, orphaned mid-flight records, uncorrelated
  legacy records, and origin-blocked counts.
- The health endpoint reports booking outbox depth on every call (one cheap local
  aggregate, no database round-trip).
- The admin reconciler was widened from the email-failure state to cover the
  database-failure state, given a terminal exhausted state with an alert
  (previously exhausted records silently fell out of the query), and now triggers
  the booking drain every five minutes.
- The retention purge gained an **unrecovered-record guard**: it refuses to
  delete anything still holding an undelivered payload or marked exhausted. Its
  old comment claimed reconciliation windows are "hours-to-days", which is true
  for the email retry but false for a booking awaiting manual recovery.

---

## 4. System-Wide Observability & Stability Floor

### 4.1 Why this was needed

An audit counted **196 `catch` blocks against 39 error-reporting calls**. Ten
catches were completely empty; dozens more were comment-only. Every one is a
place where something can break forever with no log line, no Sentry event and no
route to a root cause.

That is not theoretical here. This project has twice mistaken "no telemetry" for
"no errors": server-side Sentry was a silent no-op for months because the
execution context was never wired, and the 2026-08-07 outage ran ~22 hours with
nobody paged. **Sentry has recorded one event in 90 days** — which is either a
very healthy site or a still-broken pipeline, and those two states must be
distinguishable.

Five concrete gaps were found and closed:

1. **The logger could lose every warning and error.** When BetterStack was
   configured, `warn` and `error` went *only* there. Combined with its
   exception-suppression setting (correct in itself — logging must never break a
   request), a bad or expired token made every warning and error in the entire
   codebase vanish with no trace anywhere. This project has run with a
   BetterStack 401 before and lost exactly those logs.
2. **The error reporter could take itself down.** It serialised arbitrary context
   with plain `JSON.stringify`. A circular reference — routine in error context —
   would throw and destroy the console line, the Sentry event *and* the alert
   dispatch in one go.
3. **Alert dispatch could become an unhandled rejection.** Without an execution
   context the alert promise was left floating, and its rejection was invisible.
4. **A blind window in the browser.** Client error capture only begins after
   `requestIdleCallback` → dynamic import → a 1.5s config fetch. On a slow
   connection that is **3.5+ seconds after paint with nothing capturing errors**,
   and *nothing at all* if the import is blocked by an ad blocker or a CDN fault.
5. **No true last-resort response.** Any error escaping a route handler
   propagated to the runtime, so the customer could receive a raw stack trace, a
   bare "Internal Server Error", or a blank page.

### 4.2 The design — three layers, floor first

```
   Layer 0   console.*        cannot fail. No token, no network hop, no
                              dependency. Goes straight to Cloudflare
                              Observability (100% sampled, persisted).
                              ── ATTEMPTED FIRST, ALWAYS ──
   Layer 1   Sentry           grouping, stack traces, release correlation.
                              Its own failure is itself reported to Layer 0.
   Layer 2   Alert Gate       durable local record + Upstash + email.
                              Critical severity only.
```

The ordering is the whole point. Layer 0 is attempted **before** Sentry, so a
broken Sentry — bad DSN, exhausted quota, missing execution context — can never
take the log down with it. Previously the reporter tried the rich channel first
and a failure there took everything.

### 4.3 What was built

**A shared observability module** providing:

- `safeStringify` — serialisation that cannot throw. Handles circular
  references, BigInt and throwing getters, and truncates rather than emitting an
  unbounded payload.
- `describeError` — normalises anything thrown into message / stack / error-code,
  including the driver error code that is the single most useful root-cause field
  for a database failure.
- `logToObservability` — one structured line to Cloudflare Observability, with a
  bare-marker fallback if even serialisation fails.
- `reportNonFatal` — the replacement for a bare `catch {}`. Console first,
  always; Sentry second, best-effort; a Sentry failure is itself logged.
- `reportOnce` — reports the first occurrence of a recurring failure per isolate.
  For failures that are individually trivial but systemically important. Every
  occurrence would flood the free-tier quota and drown the signal; none is how a
  binding silently disappears for weeks. Isolates are short-lived, so a
  persistent problem produces a steady trickle rather than silence.
- `safeSync` / `safeAsync` / `guard` / `background` — wrappers that make a side
  operation or a fire-and-forget promise incapable of breaking its caller or
  producing an unhandled rejection.
- `writeAnalytics` — replaced six near-identical guarded telemetry blocks
  scattered across the middleware, two routes and the booking service. Fewer
  lines *and* the first failure is now visible.
- `errorResponse` — a last-resort response shape that never leaks a stack trace,
  internal message or error code to the customer.

**Hardened existing paths:**

- The logger now **mirrors every warning and error to the console** in addition
  to BetterStack, so third-party logging can never be a single point of log loss.
  Info stays BetterStack-only for volume. Flush calls are now guarded against
  producing unhandled rejections.
- The error reporter uses safe serialisation throughout, reports its own Sentry
  and alert-dispatch failures instead of swallowing them, and tolerates a
  malformed context object.
- The alert gate's console channel — the one channel that is supposed to be
  unfailable — uses safe serialisation, and background alert dispatch is guarded
  unconditionally rather than only when an execution context exists.

**A last-resort request boundary in middleware.** Every route already has its own
try/catch; this exists for what those cannot cover — a throw in module scope, in
a layout, in the adapter, or in a route's own error handler. One boundary covers
all 17 API routes and every page without touching any of them. API paths receive
a clean JSON envelope; pages receive a **self-contained inline HTML page** with
no layout, CMS, i18n or external asset dependency (anything it depended on would
be another thing that can be broken at the exact moment it is needed) and a
WhatsApp button. Both are `no-store`, because a cached error page is how a
transient fault becomes a lasting outage.

**A client error floor.** A tiny inline script installs error and
unhandled-rejection handlers at first paint, logs to console and buffers up to 20
events. Sentry drains that buffer once it initialises, so hydration and
first-interaction failures in the blind window are no longer permanently
invisible. Sentry init failure is now itself logged rather than silently ignored.

**A repaired island crash boundary.** It now always logs to console (not only to
Sentry, which may never have loaded), is locale-aware, uses the site's dark
palette instead of a light-theme panel that itself read as broken, and — most
importantly — offers **WhatsApp alongside reload**. Telling a customer with an
urgent pet situation to reload a page that will deterministically crash again is
a dead end.

---

## 5. Metrics: from → to

| Metric | Before (measured) | After | Why it matters |
| :--- | :--- | :--- | :--- |
| **Attempt records correlatable to a booking** | **18%** (4 of 22) | **100%** | Without this, recovery is blind — a lost booking is indistinguishable from a deleted test record. |
| **Failure classes with automated recovery** | **1 of 5** | **5 of 5** | The database-failure class — the worst one — previously needed a human to notice an alert. |
| **Customer-visible errors on backend failure** | HTTP 500 + red box | **0** | This is the company's entire public face. |
| **Booking delivered when the database is down** | **No** — no email at all | **Yes** — from the durable payload | The single most important guarantee in the system. |
| **Dead-letter payload after 3 failed sends** | **Deleted** | **Durable + re-drivable** | Closes the last-mile hole. |
| **Client submit attempts on a flaky network** | **1** | **4** + exit beacon + next-load replay | The audience is mobile; a blip used to lose the booking outright. |
| **Draft survives a tab close** | **No** | **Yes** | Three-step form; abandonment was invisible. |
| **Booking-loss detection latency** | **Unbounded** | **~5 min**, ≤60 min worst case | Consent had a probe, a heartbeat and an alert; bookings had none. |
| **Warnings/errors guaranteed to reach Cloudflare Observability** | **~0%** when BetterStack was configured | **100%** | A third party could silently swallow every log in the codebase. |
| **Error reporter survives circular context** | **No** — threw, losing all 3 channels | **Yes** | The reporter must not be the thing that fails. |
| **Client error capture blind window** | **3.5s+**, or total if the import is blocked | **0** | Hydration failures were unobservable. |
| **Unhandled request errors reaching the customer raw** | Possible | **0** — friendly page + WhatsApp | No stack traces, ever. |
| **Sidecar log retention** | 5% sampled | **100%** | A failover or a discarded message was statistically invisible. |
| **Lint** | 0 errors, **2 hints** | **0 errors, 0 hints** | Clean gate. |
| **Test coverage** | 109 tests / 15 files | **176 tests / 20 files** | Contract, outbox, status guard, client retry, observability. |
| **Duplicate-booking risk on retry** | Unbounded | **Zero** | Server-generated identifiers, conflict-tolerant writes, replayed responses. |
| **New env vars / new tables** | — | **0 / 0** | RULE #0.8 and #0.9 respected. |
| **Monthly infrastructure cost** | $0.00 | **$0.00** | Unchanged. |

---

## 6. Resilience Model

```
                    [Customer submits the booking form]
                                   │
       ┌───────────────────────────┴───────────────────────────┐
       │ CLIENT  persist locally BEFORE the network            │
       │         retry ×4 w/ backoff → exit beacon → next-load  │
       │         replay. Same idempotency key every attempt.    │
       └───────────────────────────┬───────────────────────────┘
                                   ▼
      ┌──────────────────────────────────────────────────────────┐
      │ STEP 1  Durable edge write: audit + replay + email       │
      │         payload. Before the database is touched.         │
      └────────────────────────────┬─────────────────────────────┘
                                   ▼
      ┌──────────────────────────────────────────────────────────┐
      │ STEP 2  Database transaction — ALLOWED TO FAIL           │
      └──────────────┬────────────────────────────┬──────────────┘
              [succeeds]                     [fails]
                     │                            │
                     ▼                            ▼
        outbox entry retired          payload retained, failure
                     │                recorded, CRITICAL alert
                     └────────────┬─────────────┘
                                  ▼
      ┌──────────────────────────────────────────────────────────┐
      │ STEP 3  EMAIL DISPATCHED ON BOTH PATHS                   │
      │         ← this is what makes "always reaches us" true    │
      └────────────────────────────┬─────────────────────────────┘
                                   ▼
      ┌──────────────────────────────────────────────────────────┐
      │ STEP 4  Same success response either way                 │
      │         Real reference + one-tap WhatsApp link           │
      └────────────────────────────┬─────────────────────────────┘
                                   ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ RECOVERY, in ascending latency                              │
   │  • inline opportunistic drain (next booking)                │
   │  • admin cron, every 5 min: email re-drive + drain trigger  │
   │  • hourly heartbeat: drain + probe + fail the run if stuck  │
   │  • sidecar dead-letter: payload persisted, never discarded  │
   └─────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────┐
   │ AND AT EVERY STEP ABOVE                                     │
   │  • console → Cloudflare Observability   (cannot fail)       │
   │  • Sentry                               (best effort)       │
   │  • Alert Gate → durable + Upstash + email  (critical only)  │
   │  • last-resort boundary → friendly page, never a stack      │
   └─────────────────────────────────────────────────────────────┘
```

---

## 7. Work Done & Progress Log

### Phase 1: Tooling & Cross-Platform Reliability
- [x] **Windows compatibility** for the schema-drift guard, so it passes on all developer operating systems.
- [x] **ESLint Worker globals** registered, eliminating false-positive `no-undef` noise.

### Phase 2: Code Hygiene
- [x] **Unused variable pruning** across booking, franchise, consent-banner, gallery, services and SEO schema components.
- [x] **Explicit `is:inline`** on JSON-LD script elements across SEO schema components.
- [x] **Design token alignment** — legacy purple gradients replaced with the emerald/cyan "Obsidian & Lime" palette.

### Phase 3: Edge Services Optimization
- [x] **Orphaned AI binding pruned** from the Worker configuration and types.
- [x] **Atomic queue batching** — both emails dispatched in a single edge operation.
- [x] **Edge conversion telemetry** across booking, contact and ARCO.

### Phase 4: Booking Durability (§3)
- [x] Correlation reference restored from the first durable write.
- [x] Monotonic state guard — optimistic writes cannot erase a recorded failure.
- [x] Background writes sequenced rather than raced.
- [x] Shared outbox core; consent and booking as tenants.
- [x] Booking replay outbox, canonical transaction builder, replay endpoint.
- [x] Success response on database failure — customer never sees infrastructure state.
- [x] Email dispatched on both paths — the business is notified even with the database down.
- [x] Client resilience — persist-first, retry, exit beacon, next-load replay, durable draft.
- [x] Dead-letter queue no longer discards payloads.
- [x] Sidecar batch-abort and re-throw defects fixed; failover and discards made visible.
- [x] Booking heartbeat, health-endpoint outbox depth, exhaustion alerts.
- [x] Retention purge guard for unrecovered records.
- [x] Governance drift corrected — checklist path, live table counts, env-var cap reconciled.

### Phase 5: Observability & Stability Floor (§4)
- [x] Shared observability module — safe serialisation, error description, structured logging, non-fatal reporting, once-per-isolate reporting, safe wrappers, guarded telemetry, last-resort response shape.
- [x] **Missing-Binding Sentinels** — `checkBinding` and `writeAnalytics` now alert on detached or missing bindings via `reportOnce` rather than failing silently.
- [x] **Unanchored Background Task Guard** — `background()` alerts via `reportOnce` if `ExecutionContext.waitUntil` is missing while still guarding against unhandled rejections.
- [x] **Universal Service Wrapper** — `safeServiceCall` provides isolated, timed execution with non-fatal fallbacks for all current and future service calls.
- [x] Logger mirrors every warning and error to Cloudflare Observability; flushes guarded.
- [x] Error reporter hardened — safe serialisation, self-reporting on Sentry and alert-dispatch failure.
- [x] Alert gate console channel made unfailable; background dispatch guarded unconditionally.
- [x] Last-resort request boundary in middleware — JSON for APIs, self-contained HTML page for pages, WhatsApp fallback, `no-store`.
- [x] Client error floor installed at first paint, drained into Sentry on init.
- [x] Sentry init failure now logged instead of silently ignored.
- [x] Island crash boundary — always logs, locale-aware, dark palette, WhatsApp escape hatch.
- [x] Six duplicated telemetry try/catch blocks consolidated into one guarded helper.
- [x] **All lint hints resolved** — clean diagnostic output across all 164 files (0 errors, 0 warnings, 0 hints).
- [x] **30 tests covering the observability contract** across 20 test files (180 total passing tests).

---

## 8. Known Gaps & Follow-Ups

1. **The new migration is committed but not applied.** Committing is not applying
   (RULE #0.7). Apply it and confirm against the ledger before relying on the
   outbox. Until then the durable-write helpers fail harmlessly and the system
   behaves exactly as it did before.
2. **The email sidecar's dependencies are not installed locally.** That worker
   cannot build or deploy until they are. Pre-existing.
3. **A status literal and a field in the sidecar still carry a legacy provider
   name** despite holding the current provider's values. Cosmetic but misleading
   when querying provider health. Renaming touches admin-side queries, so it was
   deliberately left alone.
4. **The `pet.` subdomain is a hard infinite redirect loop in production**, and
   `www.` resolves in two hops rather than the documented single hop. Root cause:
   a relative, host-preserving redirect in the static asset layer that runs
   before middleware, on a prerendered path middleware therefore never sees. A
   dashboard/config issue, not a code one.
5. **The live `robots.txt` contains contradictory duplicate groups for seven AI
   crawlers.** A managed block is prepended before the application's own output,
   disallowing agents the application then explicitly allows. Dashboard-level;
   unfixable in code.
6. **A synthetic alert canary is still outstanding.** Sentry recorded one event
   in 90 days. The observability floor now makes silence meaningful, but a
   scheduled synthetic critical event would prove the full alert path end to end.
7. **Legacy records predating the correlation fix** can never be reconciled. The
   heartbeat reports the count; it should be static and age out with retention.

---

## 9. Maintenance Recommendations

1. **Never reorder the durable write.** The edge payload write must stay *before*
   the database attempt. Backgrounding it or moving it after would silently
   reintroduce the exact window this design closes.
2. **Never route the replay payload through PII redaction.** It is the record
   awaiting delivery, not forensic residue.
3. **Never let a `catch` block be silent.** Use `reportNonFatal` or `reportOnce`.
   "Non-fatal" means "does not break the request", not "invisible".
4. **Never make console the *second* channel.** It is the floor precisely because
   it has no dependencies. Anything richer goes after it.
5. **Migrations**: always generate, never hand-write; confirm with the drift
   guard; then apply and verify against the ledger.
6. **Mobile testing**: maintain zero horizontal scroll and test island
   interaction on real viewports — including a real in-app browser, not devtools
   emulation.
7. **Re-verify live counts before quoting them.** Figures in the rule docs have
   drifted repeatedly; everything here was verified on 2026-08-28 and should be
   re-checked, not trusted, later.

{% endraw %}

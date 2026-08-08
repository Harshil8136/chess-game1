{% raw %}
# Consent recording: engineering record, August 2026

Complete account of the 2026-08-07 consent outage and the system built in
response. Written to be readable a year from now by someone with no memory of
it — what broke, why it broke, why nobody was told, what was built, how each
piece works, and what will happen the next time something goes wrong.

- **Companion documents**
  - [`CONSENT-RECORD-SYSTEM.md`](./CONSENT-RECORD-SYSTEM.md) — the operational runbook. Read that when something is on fire.
  - [`INCIDENT-2026-08-07-CONSENT-OUTAGE.md`](./INCIDENT-2026-08-07-CONSENT-OUTAGE.md) — the short incident summary.
  - [`WHERE-THE-DATA-LIVES.md`](./WHERE-THE-DATA-LIVES.md) — which store holds what.
  - `RULES.md` RULE #0.7 — the rule this incident produced.

---

## 1. What a consent record is, and why losing one matters

Under Mexico's LFPDPPP (and GDPR for EU visitors), when a site processes
personal data on the basis of consent, the operator must be able to
**demonstrate** that consent was given: who, when, to what text, by what
action. A `consent_records` row is that evidence. It is not analytics, and it
is not reconstructable after the fact — if the row is missing, the consent
legally did not happen, and any processing performed on its basis is
unsupported.

That asymmetry drives every design decision below. Recording a consent twice is
harmless. Failing to record one is not.

---

## 2. What happened

### 2.1 The defect

`36bf45a` (2026-08-07 18:33 UTC) added accessibility-accommodation tracking. In
`src/pages/api/consent.ts` it added one line to the insert:

```ts
accessibilityAccommodation: data.accessibilityAccommodation || null,
```

This looks conditional. It is not. `||` returns `null` — a real value — whenever
the left side is falsy, and Drizzle builds its SQL column list from the keys
present in the values object. `undefined` would have been omitted; `null` is
emitted as an explicit `NULL`. So **every** consent insert, for every visitor,
whether or not any accommodation was supplied, generated:

```sql
INSERT INTO consent_records (..., accessibility_accommodation) VALUES (..., NULL)
```

The column did not exist in the database:

```
ERROR: 42703: column "accessibility_accommodation" of relation
              "consent_records" does not exist
```

Every POST threw, was caught, and returned HTTP 500. **100% failure rate.**

### 2.2 Why the column was missing

The same commit added `drizzle/0002_add_accessibility_accommodation.sql`. It was
written by hand, which meant:

- no `drizzle/meta/0002_snapshot.json`
- no entry in `drizzle/meta/_journal.json`

Drizzle tracks migrations through the journal, so as far as every tool was
concerned that file did not exist. And nothing in CI or the deploy pipeline
applies Postgres migrations at all — application had always been a manual step
that happened to have been remembered every previous time. Deploys are
automatic on push to `main` via Cloudflare Workers Builds, so the code shipped
without its schema, immediately, with a green pipeline.

### 2.3 Why the failure was invisible to the visitor

`ConsentBanner.tsx` was optimistic by design:

```ts
setIsDismissing(true);   // hide the banner
setConsent(granted);     // write localStorage
...
try { await fetch('/api/consent/', ...) } catch (err) {
  if (import.meta.env.DEV) console.error(...);   // production: silence
}
```

The banner dismissed, `localStorage` recorded a decision, and the failure was
swallowed. Because `hasDecidedConsent()` then returned true, the banner never
reappeared — so there was no second chance to capture that record, ever. From
the visitor's side everything looked perfect. From the database's side the
visitor never consented.

### 2.4 Why nobody was paged

This is the more important half of the incident. Six independent safeguards were
all inoperative at the same time, and five of them had been broken for a long
time without anyone noticing, because **code that never runs looks identical to
code that runs and finds nothing wrong.**

| #   | Safeguard          | Actual state                                                                                                                                      |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `locals.cfContext` | Read in 6 places, **assigned nowhere**. Always `undefined`.                                                                                       |
| 2   | Server-side Sentry | Captured both errors correctly (`CF-ADMIN-1F`) — but no alert rule turned them into a notification, so they sat unread. See the correction below. |
| 3   | Alert severity     | `captureApiError` hardcoded `severity: 'warning'`, which routes to console + D1 + Sentry. **Only `critical` reaches email.**                      |
| 4   | Alert delivery     | `fireAlertBackground` called without `waitUntil`, so the runtime cancelled the alert's HTTP calls when the Response returned.                     |
| 5   | Consent heartbeat  | Daily, D1-only, and **skipped silently** when `CLOUDFLARE_API_TOKEN` was absent.                                                                  |
| 6   | CI                 | Aborting at `Format Check`, so typecheck, build, vitest and knip had been **skipped on every run for days**.                                      |

Cause 1 is the root of 4. Cause 6 meant the pipeline was reporting failure over
a formatting nit while verifying nothing of substance.

#### Correction: Sentry was working (2026-08-08)

An earlier version of this document asserted that server-side Sentry was never
initialised, reasoning from the fact that `middleware.ts` gates
`Sentry.wrapRequestHandler` on `cfCtx`, which was always `undefined`. Direct
inspection of the Sentry project disproved it. Both consent failures are
recorded as [`CF-ADMIN-1F`](https://pet-hotel-madagascar.sentry.io/issues/CF-ADMIN-1F)
— two events at `2026-08-07T21:07:35.337Z` and `2026-08-08T01:45:36.000Z`,
tagged `api.route=api/consent`, `handled=yes`, `environment=production`, with
the full `PostgresError: column "accessibility_accommodation" ... does not
exist` and the complete bound parameter list.

The inference was wrong, and the corrected picture is more useful:

- **Capture worked.** The events were in Sentry within seconds, every time.
- **Notification did not exist.** No alert rule routed them anywhere, and they
  landed in a project named `cf-admin`, where nobody was watching for a cf-astro
  consent failure.

That distinction matters for the fix. Adding more error _capture_ would have
achieved nothing — the data was already there. What was missing was something
that actively pushes at a human, which is exactly what the `critical` severity
path (email via `EMAIL_QUEUE`) and the hourly probe now provide.

It also had a large practical consequence: because the events carried the
entire failed INSERT's parameters, both lost records were recoverable at **full
fidelity** rather than as degraded reconstructions. See §8.

**Recommended follow-up (outside this repo):** create a Sentry alert rule on
`api.route:api/consent` so the capture path can page on its own, and consider
splitting the `cf-astro` Worker into its own Sentry project rather than
reporting into `cf-admin`.

### 2.5 Impact

- **Window**: 2026-08-07 18:33 UTC → 2026-08-08 02:20 UTC (~7h45m).
- **Failure rate**: 100% of cookie-banner consent.
- **Not affected**: `/api/contact` and `/api/booking` consent inserts — neither
  sent the offending key.
- **Volume**: the site averages ~5 consent records/day, so roughly 1–3 records.
  Small in count; total in rate.

---

## 3. What was found along the way

Investigating the above surfaced four further defects, all pre-existing:

1. **A second schema drift.** `privacy_notice_version` defaulted to `v1.0-2026`
   in the live database while `schema.ts` declared `v3.1-2026`. No existing row
   was wrong — all three writers set the column explicitly — but any future
   writer relying on the default would have stamped consent with the wrong
   privacy-notice version. A latent legal defect, now aligned.
2. **A crippled audit trail.** `/api/consent` passed only 5 of the 9 available
   fields to `[SUPABASE_PROJECT_REF]`, leaving `consent_type`, `granted`, `locale`
   and `session_id` permanently NULL in `consent_attempts` — weakening exactly
   the forensic record this incident needed.
3. **Vocabulary drift.** `/api/contact` wrote `consent_type = 'contact'`, which
   was absent from `/api/consent`'s Zod enum. The column has no CHECK
   constraint, so Postgres accepted it and the two vocabularies quietly split.
4. **Three hand-built insert objects.** `consent.ts`, `contact.ts` and
   `booking-service.ts` each constructed their own row shape, so there was no
   single place where "what we write" could be checked against "what the schema
   has". That absence is what made the root-cause bug unshippable-proof
   impossible to write.

---

## 4. What was built

### 4.1 Design principle

> Capture the click durably at the edge before anything that can fail, then
> converge on Postgres. Never make the visitor wait for anything that isn't
> required to answer them.

Concretely: **four independent layers must fail simultaneously to lose a
record.**

```
Visitor clicks Accept / Reject
        │
        ├── localStorage 'mada_consent'          decision recorded, banner dismisses
        ├── localStorage 'mada_consent_pending'  ① CLIENT OUTBOX — queued BEFORE the fetch
        │
        ▼ POST /api/consent   (keepalive: true)
        │
        ├── D1 consent_attempts INSERT           ② AUDIT-FIRST — before any rejection path
        │       ╎ (concurrently: rate limit, Turnstile)
        ├── origin → rate limit → Zod → enrichment
        ├── buildConsentInsert()                 ③ ONE canonical row shape
        ├── D1 replay_payload                    ④ SERVER OUTBOX — before the Postgres attempt
        │
        ▼ Supabase INSERT ... ON CONFLICT (id) DO NOTHING
        │        ↺ one inline retry, transient errors only
   ┌────┴────────────────────────────────┐
   ▼                                     ▼
 SUCCESS                               FAILURE
 respond immediately                   row stays pending → replayed automatically
 (waitUntil: settle D1, drain 5)       critical alert → email to ADMIN_EMAIL
```

### 4.2 Layer ① — client outbox

`src/lib/consent/consent-outbox-client.ts` (~110 lines, ~0.35 KB brotli).

Protects against the request never reaching the server at all: offline, radio
drop, 5xx from a bad deploy, tab closed mid-flight.

- Payload written to `localStorage['mada_consent_pending']` **before** the fetch.
- `keepalive: true` lets the request outlive the page that fired it.
- Cleared **only** on a 2xx that carries a real `consentId`. A 200 without a
  receipt means nothing was persisted, so the entry survives.
- Retried on every subsequent page load and on `visibilitychange`. The retry
  effect lives in the banner island but **outside** its visibility guard — the
  people whose record was lost are precisely the people who already decided and
  will never see the banner again.
- Bounded: 5 attempts, 7-day TTL, and a permanent 4xx (not 429) drops the entry
  rather than retrying a payload the server will never accept.
- Clearing is compare-and-swap on `firstQueuedAt`, so a slow in-flight flush can
  never delete a newer entry queued behind it.
- Every `localStorage` access is wrapped — iOS Private Browsing throws.

**There is no user-visible retry UI.** No button, no toast, no error state.
This is entirely our problem to solve, and the visitor never learns it existed.

### 4.3 Layer ② — audit-first D1 write

Unchanged in principle from ADR-0003, but now correct: all 9 seed fields are
populated, from a type-guarded best-effort parse of the raw body that cannot
throw. Written **before** origin, rate-limit and validation checks, so even a
rejected request leaves a forensic trail.

### 4.4 Layer ③ — one canonical row

`src/lib/consent/consent-contract.ts` is the single definition of a consent row.
All three writers, the replay drain, and the health probe go through
`buildConsentInsert()`.

Two decisions worth preserving:

- **Every nullable column is emitted explicitly**, never omitted. An omitted key
  is invisible to the contract test and to the health probe, so a column could
  silently stop being written. Explicit `null` keeps the SQL column list stable
  and makes drift loud.
- **`createdAt` is always set explicitly**, never left to `DEFAULT now()`. A row
  replayed from the outbox six hours later must carry the time the human
  clicked. A consent record stamped with its replay time is legally wrong.

### 4.5 Layer ④ — server outbox and replay

`consent_attempts` doubles as the outbox (D1 migration 0014):

| Column            | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `replay_payload`  | The exact canonical insert, **unredacted**. NULL once delivered. |
| `replay_attempts` | Failure count.                                                   |
| `next_replay_at`  | Lease + backoff marker. NULL = not eligible.                     |
| `replayed_at`     | Delivery timestamp.                                              |

Written **before** the Postgres attempt, so even a mid-request Worker eviction
leaves a replayable row.

**Why D1 and not a queue.** `consent_attempts` already existed as the
dead-letter table, already carried the row, and is already covered by the
90-day purge and the heartbeat. A Cloudflare Queue would need a second consumer
worker, its messages aren't queryable for audit, and its 4-day retention is
shorter than a schema-drift outage can plausibly run. A Durable Object is heavy
for ~5 writes/day.

**Why `replay_payload` is not redacted.** `request_body` is a raw client payload
kept for forensics, so it goes through `redactPii`. `replay_payload` _is the
legal record awaiting delivery_ — redacting it would make the row unreplayable,
which is the exact failure this table exists to prevent. Same data class as
Postgres `consent_records`; `ip_address` and `user_agent` are already dedicated
columns here; cleared within milliseconds on success; covered by the 90-day
purge.

**Idempotency.** `consent_records.id` is generated before the first attempt and
travels inside the payload, so retries and replays reuse it and
`onConflictDoNothing` makes duplication impossible. This is not optional:
`cf_astro_writer` holds INSERT only and _cannot delete a duplicate it creates_.

**Two drain triggers**, so it works with or without traffic:

- opportunistic — after any successful consent write, `waitUntil`, 5 rows, 3s budget;
- scheduled — `POST /api/consent/replay/` hourly from the heartbeat workflow.

### 4.6 Transient vs permanent failures

`isTransientDbError()` decides whether retrying can possibly help.

- **Transient** — `08xxx` connection, `53xxx` resources, `57P01/02/03` shutdown
  or starting up, `40001/40P01` serialization or deadlock, plus driver errors
  with no SQLSTATE (`ECONNRESET`, timeouts, "connection terminated").
- **Permanent** — any other real 5-character SQLSTATE: `42703` undefined column,
  `42501` insufficient privilege, `23xxx` integrity violations.
- **Unknown** → treated as transient. Wrongly calling something permanent risks
  abandoning a legal record; wrongly calling it transient costs one cheap retry.
  Fail toward retrying.

This distinction drives three behaviours:

1. **Inline**, `/api/consent` retries a transient failure **once**, immediately,
   on a fresh connection — fixing a dropped socket in ~50ms while the visitor is
   still on the page, instead of waiting for the next drain. Permanent errors are
   never retried inline; the second attempt would fail identically and it would
   disguise a code defect as a network blip.
2. **In the drain**, transient failures back off exponentially
   (`min(2^attempts, 60)` minutes) and **do** exhaust at 12 attempts — something
   is durably unreachable and a human should look.
3. **In the drain**, permanent failures retry **hourly and never exhaust**. A
   `42703` will fail identically until someone applies a migration; burning the
   retry budget would abandon a legal record for a reason entirely within our
   control. The moment the schema is fixed, the record lands by itself with no
   manual replay. The heartbeat surfaces it as stuck within two hours.

---

## 5. Performance

The original handler ran every I/O call in series:

```
text() → burst(KV) → audit(D1) → origin → rateLimit(Upstash)
       → Zod → Turnstile(HTTP) → payload(D1) → Postgres → update(D1) → clear(D1) → respond
```

Four of those waits were unnecessary, because nothing downstream depended on
their result at the point they were awaited.

**Changes**

1. **Rate limit and Turnstile start early and run concurrently** with the D1
   audit write. Their latency now overlaps rather than stacks. The audit-first
   invariant is untouched: the D1 row is still awaited before any branch that
   can reject the request — only the _waiting_ overlaps, nothing acts sooner.
2. **Turnstile is capped at 2s** (`AbortSignal.timeout`). Third-party HTTP on a
   request path needs a ceiling; without one, a Cloudflare-side stall would hold
   a consent write open until the Worker's own limit, turning a signal-only
   enrichment into an outage. A timeout records as `{ success: false }` like any
   other failure — it can never gate a write.
3. **Two trailing D1 round trips became one, off the critical path.**
   `[SUPABASE_PROJECT_REF]` + `clearConsentReplayPayload` merged into
   `[SUPABASE_PROJECT_REF]`, run via `waitUntil`. The record is already safe in
   Postgres by then; the visitor should not wait for bookkeeping. Falls back to
   awaiting when `waitUntil` is unavailable (dev, tests), because leaving a
   delivered row marked undelivered is worse than a few milliseconds.
4. **`closeDb` via `waitUntil`** — now actually works, since `cfContext` is
   populated.

**Resulting critical path**

```
text() → burst(KV) → max(audit D1, rateLimit, Turnstile) → Zod
       → payload(D1) → Postgres INSERT → respond
```

Serial third-party waits drop from four to two. The two D1 writes that remain on
the path are local to the Worker (no network hop) and are the price of the
durability guarantee — the payload write in particular is what makes the record
survive everything after it.

**Client cost**: the entire client outbox is ~0.35 KB brotli inside an island
that was already `client:idle`. No new requests, no new dependencies, no
blocking work.

---

## 6. Guards — why this cannot ship again

Three layers, deliberately overlapping, because the migration file and the
applied migration are different facts and each guard can only prove one.

| Guard                            | Runs         | Needs      | Proves                                               |
| -------------------------------- | ------------ | ---------- | ---------------------------------------------------- |
| `npm run db:check`               | every CI run | nothing    | `schema.ts` matches the committed migration chain    |
| `test/consent-contract.test.ts`  | every CI run | nothing    | every column written exists in the newest snapshot   |
| `GET /api/health/?probe=consent` | hourly       | one secret | the migration was actually **applied** to production |

**`db:check`** runs `drizzle-kit check` (journal/snapshot integrity — catches a
hand-written migration) then a `drizzle-kit generate` probe that fails if any
new migration is emitted. It restores the tree byte-identically afterwards; an
early version of this script deleted only the `.sql` and left the snapshot and
journal entry behind, which silently _absorbed_ the drift so a second run
reported "in sync" — verified fixed.

**The contract test** compares `buildConsentInsert()`'s output keys against the
newest Drizzle snapshot. Verified: restoring the pre-fix snapshot makes it fail
with the exact diagnostic.

**The health probe** performs a real, full-width `INSERT` into `consent_records`
inside a transaction that always rolls back, using the same
`buildConsentInsert()` production uses. It catches schema drift, a revoked
grant, an RLS change, a type mismatch and connectivity in one round trip, and
writes nothing. Rollback rather than insert-then-delete is forced: the
least-privilege role cannot DELETE.

**CI ordering also changed.** A failing step aborts the job, so step order
decides what actually gets verified. Unit tests now run immediately after the
drift guard, before Playwright, Lighthouse and the build — otherwise the
regression test for this very incident sits behind the steps most likely to
break for unrelated reasons.

---

## 7. Alerting

The structural change: **the alarm originates in the Worker, not in CI.**

A failed consent write now calls `captureApiError` with `severity: 'critical'`
and a real `waitUntil`, which reaches `channelsForSeverity('critical')` =
console + D1 + Sentry + Upstash + **email to `ADMIN_EMAIL`**. A human is emailed
within seconds of the first failure, independent of GitHub Actions, independent
of Sentry, independent of any schedule. That single change is what turns a
day-long silent outage into a minutes-long one.

The heartbeat is now **hourly with two independent jobs**:

- **probe** — needs only `HEALTH_CHECK_SECRET`, curls the health probe, fails on
  a bad insert, a missing execution context, or exhausted replay rows, then
  drains the outbox.
- **audit** — needs only `CLOUDFLARE_API_TOKEN`, queries D1 for error rates,
  pending replay, stuck (>2h) and exhausted rows.

Separate jobs on purpose: losing one credential must never blind both. Both warn
loudly when their credential is missing rather than skipping in silence.

It also now distinguishes **"quiet site"** from **"broken"** — zero successes
with zero attempts is a quiet Sunday; zero successes with non-zero attempts is
an outage. Conflating them caused the 2026-07-19 false alarm.

---

## 8. What happens now — failure mode walkthrough

| Failure                              | Visitor sees | Record                                                        | Detection                                              | Recovery                                             |
| ------------------------------------ | ------------ | ------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| Schema drift (the 2026-08-07 bug)    | nothing      | queued in outbox                                              | critical email in seconds; probe fails within the hour | replays automatically once the migration is applied  |
| Supabase down                        | nothing      | queued in outbox                                              | critical email; probe fails                            | inline retry, then hourly drain until it recovers    |
| Dropped socket / connection cap      | nothing      | **written on the inline retry**                               | none needed                                            | already resolved in ~50ms                            |
| Worker evicted mid-request           | nothing      | payload already in D1                                         | pending row in heartbeat                               | next drain                                           |
| Visitor offline / request never sent | nothing      | client outbox                                                 | —                                                      | retried on next page load                            |
| Response lost in transit             | nothing      | written server-side; client may resend                        | —                                                      | `ON CONFLICT DO NOTHING`, or a duplicate (harmless)  |
| Turnstile stalls                     | nothing      | written, `turnstile: {success:false, errorCodes:['timeout']}` | —                                                      | none needed; capped at 2s                            |
| D1 unavailable                       | nothing      | Postgres write still proceeds                                 | heartbeat sees no attempts                             | Postgres is the source of truth; audit degrades only |
| Rate limited / bad origin            | 429 / 403    | audit row records the rejection                               | —                                                      | by design                                            |
| Grant or RLS revoked                 | nothing      | queued                                                        | probe fails within the hour                            | replays after the grant is restored                  |

**Duplicates are possible and are not a bug.** If a write succeeds but the
response is lost, the client retry re-sends and the server assigns a new id.
Over-recording consent is legally harmless; under-recording is not. Collapse by
`session_id` + `created_at` offline if exact counts are ever needed.

### 8.1 Recovery of the two lost records

Exactly two records were lost. Both are restored, at **full fidelity**:

| Attempt     | Clicked (UTC)       | Where                                                         | Restored as                            |
| ----------- | ------------------- | ------------------------------------------------------------- | -------------------------------------- |
| `b763e8e3…` | 2026-08-07 21:07:35 | Aguascalientes, MX — Edge 151 / Windows, Total Play (AS22884) | `[D1_DATABASE_ID]` |
| `3610927e…` | 2026-08-08 01:45:36 | Toronto, CA — Chrome 150 / Android, Bell Mobility (AS577)     | `[D1_DATABASE_ID]` |

Both accepted (`granted = true`), `cookies_essential`, locale `es`, notice
`v3.1-2026`, identical consent-text hash.

The D1 audit row alone would have given a degraded reconstruction, because
`request_body` is PII-redacted. The Sentry events supplied the rest: the failed
INSERT's complete bound parameter list, including the **original
server-generated UUIDs**, `ip_region`/`ip_city`, interaction proof, the full
device fingerprint, network ASN and colo, Turnstile result, and the trace and CF
ray IDs. So the rows are what would have been written, not an approximation.

The one field that is not original is `created_at`: it holds the server-side
insert-_attempt_ timestamp rather than the commit timestamp (~1s later). Each
row carries a `fingerprint_data._recovery` block with `fidelity: "complete"`,
the source Sentry event ID and the originating attempt ID.

Post-recovery verification: 321 rows, 0 duplicate `(session_id, created_at)`
groups, 0 `db_error` rows remaining in D1.

### 8.2 A race the system caught in itself

At `2026-08-08 04:26:13`, a genuine visitor consent (attempt `beecdd18…`,
Zacatecas MX) was written to Postgres successfully on the first attempt — and
then marked `db_replayed` with `replay_attempts = 0` and no error.

Cause: `[SUPABASE_PROJECT_REF]` and `drainConsentOutbox` were both scheduled with
`waitUntil` **concurrently**. The request's own outbox row stays pending until
`[SUPABASE_PROJECT_REF]` clears it, so the drain could claim the row the same
request had just written and "replay" a record that never failed.

Consequences were mild only because the design assumed this class of mistake:
`onConflictDoNothing` on the pre-generated id meant **no duplicate was created**.
The costs were a wasted Postgres round trip per consent write — on the very path
that had just been optimised — and a misleading status.

Fixed by chaining rather than parallelising: the drain now runs _after_ the
settle completes. This also preserves the fallback, since `[SUPABASE_PROJECT_REF]`
swallows its own errors — if it fails, the payload stays set and the following
drain correctly picks the row up.

Worth recording as the general lesson: **two independent background tasks that
touch the same row are not independent.** The idempotency key is what turned a
concurrency bug into a performance nit instead of duplicated legal evidence.

---

## 9. Cleanup performed

**Code**

- Deleted `functions/` — a Cloudflare **Pages** convention directory. This
  project deploys as a **Worker** (`wrangler deploy`, no `pages_build_output_dir`),
  so `sentryPagesPlugin` never executed. Confirmed absent from build output. Its
  only real job — server-side Sentry — now works properly in `middleware.ts`,
  and its malformed-URI guard was already duplicated there.
- Removed `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` from `env.d.ts`, `wrangler.toml` and
  `.env.example`. Zero code references anywhere; `@supabase/supabase-js` is not
  even a dependency. All access is raw Postgres as `cf_astro_writer`. An unused
  **service-role key bypasses RLS entirely** — a standing liability with no
  consumer. If one is still set as a Worker secret, delete it:
  `wrangler secret delete SUPABASE_SERVICE_ROLE_KEY`.
- Merged two D1 helpers into one (`[SUPABASE_PROJECT_REF]`).
- Fixed a stale hardcoded `SSR_ROUTES` list in `scripts/check-links.mjs`, which
  had gone out of date when blog and RSS routes were added and was reporting
  three live pages as broken. Now derived from `src/pages` by scanning for
  `export const prerender = false`.

**Database**

- Dropped `idx_consent_records_email` — `consent_records.email` holds an
  anonymous placeholder (`Visitor <8 hex>`), so the index could never serve a
  meaningful lookup. Zero scans, non-unique, not a foreign key.
- **Deliberately kept `idx_booking_pets_booking_id`**, which the same Supabase
  lint flags. It covers a foreign key with `ON DELETE CASCADE`; it reads as
  unused only because the table has 12 rows and the planner prefers a seq scan
  at that size. Dropping it would immediately trip the unindexed-foreign-keys
  lint and degrade cascade deletes as the table grows.
- **`privacy_requests` is confirmed dead but retained**: 0 rows, zero inserts
  ever, no cf-astro code references it (ARCO requests go to `legal_requests`).
  Not dropped because this database is shared with cf-admin, whose source could
  not be inspected. Verify and drop when convenient:
  ```sql
  SELECT n_tup_ins, n_live_tup FROM pg_stat_user_tables
   WHERE relname = 'privacy_requests';   -- expect 0, 0
  -- then, after confirming cf-admin doesn't reference it:
  DROP TABLE public.privacy_requests;
  ```
- The other 20 unused indexes belong to cf-admin's chat subsystem and were left
  alone.

---

## 10. Operating this

**Daily**: nothing. The system is autonomous.

**When the heartbeat fails**, start here:

```bash
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
  'https://madagascarhotelags.com/api/health/?probe=consent' | jq '.checks'
```

`consent_insert` names the Postgres error; the table in
[`CONSENT-RECORD-SYSTEM.md` §5](./CONSENT-RECORD-SYSTEM.md) maps each SQLSTATE to
its fix. Nothing is lost while it is broken — clicks accumulate in the outbox
and drain automatically once the probe is green.

**Changing the schema** — RULE #0.7, three artefacts, not one:

1. `src/lib/db/schema.ts`
2. `npm run db:generate` (never hand-write; commit the `.sql` **and**
   `drizzle/meta/*`)
3. Apply it, and confirm it in `supabase_migrations.schema_migrations`

`npm run db:check` enforces 1–2 offline. The health probe enforces 3 against
production. Both are required.

**Completed operationally (2026-08-08):**

- D1 migration **0014 applied** — `replay_payload`, `replay_attempts`,
  `replayed_at`, `next_replay_at` and the partial index all exist. The outbox is
  live and has already replayed in production.
- **`d1_migrations` ledger repaired.** cf-astro migrations 0010–0014 were all
  _applied_ but **none were recorded**. `npm run db:migrate:remote` would
  therefore have re-run them and failed on `ALTER TABLE … ADD COLUMN` (SQLite
  has no `IF NOT EXISTS` for columns). Backfilled, so the command is now a clean
  no-op and future migrations apply normally. Note the ledger is **shared with
  cf-admin** — cf-astro's `0013_add_accessibility_accommodation.sql` and
  cf-admin's `0013_create_admin_booking_state_table.sql` coexist as distinct
  names, which works but is worth knowing before renaming anything.
- **Both lost consent records recovered** (§8.1).
- Dead index `idx_consent_records_email` dropped.

**Still outstanding — needs a human:**

- **Add `HEALTH_CHECK_SECRET` as a GitHub Actions repository secret.** Until
  then the token-free heartbeat leg is disabled and logs a `::warning::`. This
  is the single most valuable remaining item: it is the leg that survives losing
  the Cloudflare token.
- **Create a Sentry alert rule** on `api.route:api/consent` (see the correction
  in §2.4). Sentry captured this outage perfectly and told nobody; the Worker
  now emails on `critical`, but Sentry itself should also be able to page.
- Consider giving the `cf-astro` Worker its own Sentry project — its errors
  currently report into `cf-admin`, which is where they went unnoticed.
- Optional: `wrangler secret delete SUPABASE_SERVICE_ROLE_KEY` if one is still
  set (§9).
- Optional: drop the confirmed-dead `privacy_requests` table once cf-admin is
  verified not to reference it (§9).

`scripts/consent-reconcile.mjs` remains in the repo as the general-purpose
recovery path for any _future_ pre-outbox loss, but is **not needed for this
incident** — both records are already restored, and it would find nothing
(it only selects rows with `replay_payload IS NULL` and `status='db_error'`,
of which there are now none).

---

## 11. Lessons

1. **A migration file is not an applied migration.** The repo is not the ledger.
   Guard the artefact in CI _and_ the applied state at runtime.
2. **`|| null` is not `undefined`.** With an ORM that derives column lists from
   supplied keys, the difference is an outage.
3. **Optimistic UI over legal evidence needs a durable queue.** Dismissing the
   banner and writing localStorage before persistence is confirmed converts any
   transient failure into permanent, invisible loss.
4. **Verify the alarm, not just the alert.** Five of six observability gaps were
   code that looked correct and had simply never fired once. A synthetic probe
   that exercises the real write path is worth more than any quantity of
   error handling nobody has watched work.
5. **Step order in CI is a correctness property.** A gate that aborts on a
   formatting nit before running the tests is not a gate.
6. **Retry policy needs an error taxonomy.** Retrying a permanent defect wastes
   latency and hides a bug; giving up on a transient one loses data. The
   distinction has to be explicit in code, not implied by a fixed count.

{% endraw %}

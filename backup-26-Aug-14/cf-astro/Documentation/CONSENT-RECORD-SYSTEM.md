{% raw %}
# Consent record system

How a consent click becomes a durable legal record, what happens when that
fails, and how to fix it. Written after the 2026-08-07 outage, in which every
consent click was silently discarded.

> For the full background — what broke, why nobody was paged, every design
> decision and its rationale — see
> [`CONSENT-ENGINEERING-RECORD-2026-08.md`](./CONSENT-ENGINEERING-RECORD-2026-08.md).
> **This document is the runbook**: read it when something is on fire.

**The guarantee:** a consent click is never lost. Not to schema drift, not to a
Supabase outage, not to a bad deploy, not to a dropped mobile connection.

---

## 1. The path

```
Visitor clicks Accept / Reject
        │
        ├─ localStorage 'mada_consent'          ← decision recorded locally, banner dismisses
        ├─ localStorage 'mada_consent_pending'  ← ① CLIENT OUTBOX: payload queued BEFORE the fetch
        │
        ▼  POST /api/consent  (keepalive: true)
        │
        ├─ D1 consent_attempts INSERT           ← ② AUDIT-FIRST: before origin/rate-limit/validation
        ├─ origin → rate limit → Zod → enrichment
        ├─ buildConsentInsert()                 ← ③ THE canonical row, built in exactly one place
        ├─ D1 consent_attempts.replay_payload   ← ④ SERVER OUTBOX: durable copy BEFORE Postgres
        │
        ▼  Supabase consent_records INSERT ... ON CONFLICT (id) DO NOTHING
        │
   ┌────┴─────────────────────────────┐
   ▼                                  ▼
 SUCCESS                            FAILURE
 clear both outboxes                row stays pending → replayed automatically
 drain 5 stranded rows (waitUntil)  critical alert → email to ADMIN_EMAIL
```

Four independent layers have to fail simultaneously to lose a record:

| #   | Layer                  | Protects against                                            | Where                                      |
| --- | ---------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| ①   | Client outbox          | request never reaches the server (offline, 5xx, tab closed) | `src/lib/consent/consent-outbox-client.ts` |
| ②   | Audit-first D1 write   | request rejected before it could be processed               | `src/lib/db/d1-attempts.ts`                |
| ③   | Canonical row builder  | column drift between the three writers                      | `src/lib/consent/consent-contract.ts`      |
| ④   | Server outbox + replay | Postgres unreachable or rejecting                           | `src/lib/consent/consent-outbox.ts`        |

**The visitor is never shown any of this.** There is no retry button, no error
toast, no "something went wrong" state, and no second consent prompt. Recovery
is entirely a backend concern — the banner dismisses and that is the last the
customer ever hears of it. Any change that surfaces a consent failure in the UI
is a regression.

## 2. The three writers

All go through `buildConsentInsert()`. Never inline a
`db.insert(schema.consentRecords)` anywhere else — the outbox has to be able to
replay a byte-identical row, and the contract test only checks this one builder.

| Writer                       | consent_type                                                                | Mechanism                                |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| `src/pages/api/consent.ts`   | `cookies_essential` \| `cookies_analytics` \| `accessibility_accommodation` | `button_click`                           |
| `src/pages/api/contact.ts`   | `contact`                                                                   | `checkbox_click`                         |
| `src/lib/booking-service.ts` | `booking`                                                                   | `checkbox_click` (inside the booking tx) |

Only `/api/consent` has outbox protection. Contact and booking inserts are
inside a request the user is actively waiting on, so a failure surfaces as a
visible error and the user retries — the silent-loss problem does not apply.

## 3. Replay

`consent_attempts` doubles as the outbox (migration 0014).

| Column            | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `replay_payload`  | The exact canonical insert, **unredacted**. NULL once delivered. |
| `replay_attempts` | Failure count. Gives up at 12 (~13h of backoff).                 |
| `next_replay_at`  | Lease/backoff marker. NULL = not eligible.                       |
| `replayed_at`     | Delivery timestamp. Non-NULL = done.                             |

Retry policy depends on **why** the write failed — see `isTransientDbError()`
in `src/lib/consent/consent-outbox.ts`:

| Failure class | Examples                                                                                               | Drain behaviour                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Transient** | `08xxx` connection, `53xxx` resources, `57P0x` shutdown, `40001` serialization, `ECONNRESET`, timeouts | exponential backoff `min(2^attempts, 60)` min; **exhausts** at 12 attempts |
| **Permanent** | `42703` undefined column, `42501` insufficient privilege, `23xxx` constraint violation                 | retried **hourly, forever** — never exhausts                               |
| **Unknown**   | no SQLSTATE, unrecognised message                                                                      | treated as transient (a wasted retry is cheaper than an abandoned record)  |

Permanent failures never exhaust on purpose: a `42703` will fail identically
until someone applies a migration, and burning the retry budget would abandon a
legal record for a reason entirely within our control. The moment the schema is
fixed, the record lands by itself. The heartbeat fails the run on the first
`permanent > 0`, so it is never quiet about it.

`/api/consent` additionally retries a **transient** failure once inline, on a
fresh connection, before falling through to the outbox — fixing a dropped
socket in ~50ms while the visitor is still on the page. Permanent errors are
never retried inline.

Two drain triggers:

- **Opportunistic** — after any successful consent write, `waitUntil` drains up
  to 5 rows (3s budget). A healthy write proves Postgres is reachable, so it is
  the cheapest moment to flush a backlog.
- **Scheduled** — `POST /api/consent/replay/` (bearer `HEALTH_CHECK_SECRET`),
  called hourly by `consent-heartbeat.yml`. Covers a site with no traffic.

Replay is idempotent: `consent_records.id` is generated before the first attempt
and reused, so `ON CONFLICT DO NOTHING` makes a double-submit a no-op. This
matters because `cf_astro_writer` is INSERT-only and cannot delete a duplicate.

> **Why `replay_payload` is not redacted.** `request_body` is a raw client
> payload kept for forensics, so it goes through `redactPii`. `replay_payload`
> _is the legal record awaiting delivery_ — redacting it would make the row
> unreplayable, which is the exact failure this table exists to prevent. The
> data class already lives in Postgres `consent_records`, `ip_address` and
> `user_agent` are already dedicated columns on this table, and the 90-day purge
> in `db/retention-purge.sql` covers it. **Do not "fix" this.**

## 4. Monitoring

| Check                            | Frequency    | Credential             | Catches                                                 |
| -------------------------------- | ------------ | ---------------------- | ------------------------------------------------------- |
| `GET /api/health/?probe=consent` | hourly       | `HEALTH_CHECK_SECRET`  | schema drift, revoked grants, RLS changes, connectivity |
| D1 audit query                   | hourly       | `CLOUDFLARE_API_TOKEN` | error rates, stuck/exhausted replay                     |
| `npm run db:check`               | every CI run | none                   | schema.ts drifted from the migration chain              |
| `test/consent-contract.test.ts`  | every CI run | none                   | a column written but not migrated                       |
| Critical alert from the Worker   | immediate    | none                   | any failed consent write → email                        |

The two heartbeat legs are **separate jobs on purpose**: losing one credential
must never blind both. The daily, single-legged, silently-skipping version of
this workflow is why the 2026-08-07 outage ran for a day.

### The probe

`?probe=consent` performs a real, **full-width INSERT into `consent_records`
inside a transaction that is always rolled back**. It uses the same
`buildConsentInsert()` as production, so it cannot drift from what the live code
writes, and it leaves no row behind. Rollback rather than insert-then-delete is
forced by `cf_astro_writer` holding INSERT only.

## 5. Runbook

### "Consent probe failed" / consent recording is broken

```bash
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
  'https://madagascarhotelags.com/api/health/?probe=consent' | jq
```

`checks.consent_insert` names the Postgres error:

| Code              | Meaning                 | Fix                                                                                                                                                         |
| ----------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `42703`           | column does not exist   | A migration was written but never applied. Apply it, then verify it appears in `supabase_migrations.schema_migrations`. **This was the 2026-08-07 outage.** |
| `42501`           | permission denied       | `cf_astro_writer` lost a grant. See `db/postgres-cf-astro-writer-grants.sql`.                                                                               |
| `42P01`           | relation does not exist | Wrong database, or the table was dropped.                                                                                                                   |
| `08006` / timeout | connectivity            | Check Supabase status and the `DATABASE_URL` secret.                                                                                                        |

Nothing is lost while this is broken — clicks accumulate in the outbox and drain
automatically once the probe is green.

### Drain the outbox now

```bash
curl -sS -X POST -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
  -H 'Content-Type: application/json' -d '{"limit":200}' \
  'https://madagascarhotelags.com/api/consent/replay/' | jq
```

### "Replay exhausted" — records that gave up

Their `replay_payload` is retained deliberately.

```bash
npx wrangler d1 execute madagascar-db --remote --command \
  "SELECT id, created_at, error_code, error_message, replay_attempts
     FROM consent_attempts WHERE status = 'replay_exhausted'"
```

Fix the underlying cause, then re-arm them:

```bash
npx wrangler d1 execute madagascar-db --remote --command \
  "UPDATE consent_attempts SET status='db_error', replay_attempts=0,
          next_replay_at=datetime('now')
     WHERE status='replay_exhausted'"
```

### Reconstruct pre-outbox losses (one-off, 2026-08-07 window only)

```bash
export CLOUDFLARE_API_TOKEN=... DATABASE_URL=...
node scripts/consent-reconcile.mjs            # dry run
node scripts/consent-reconcile.mjs --apply
```

Only touches rows with `replay_payload IS NULL` — records failing after
migration 0014 replay themselves and are never picked up by this script.
Reconstructed rows carry `fingerprint_data.reconstructed = true`; their consent
decision, timestamp, locale, notice version and text hash are authentic, but the
fraud-signal enrichment was PII-redacted at capture and cannot be recovered.

## 6. Changing the schema — read this first

A schema change is **three artefacts, not one**:

1. `src/lib/db/schema.ts`
2. A migration **generated** by `npm run db:generate` — including its
   `drizzle/meta/NNNN_snapshot.json` and `_journal.json` entry
3. **Applied**, and visible in `supabase_migrations.schema_migrations`

> A migration file in the repo is **not** evidence that it was applied. The
> ledger is. On 2026-08-07 step 1 was done, step 2 was half-done (SQL written by
> hand, never journalled), step 3 was skipped entirely — and CI was green.

`npm run db:check` enforces steps 1-2 with no database access.
`GET /api/health/?probe=consent` enforces step 3 against production.
Both are required; neither is sufficient alone.

{% endraw %}

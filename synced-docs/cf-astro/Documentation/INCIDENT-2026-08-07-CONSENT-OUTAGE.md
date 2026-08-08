{% raw %}
# Incident: consent records silently discarded (2026-08-07)

- **Severity**: High — loss of legal evidence (LFPDPPP / GDPR consent records)
- **Window**: 2026-08-07 18:33 UTC → 2026-08-08 02:20 UTC (~7h45m)
- **Impact**: 100% of cookie-banner consent decisions failed to persist. Booking
  and contact consent were unaffected.
- **Detected**: 2026-08-08, by investigation — **not** by any alert. (Sentry had
  captured both failures within seconds; nothing was configured to notify a
  human. See cause 2.)
- **Volume**: **exactly 2 records**, both since recovered at full fidelity — see
  [Recovery](#recovery--both-lost-records-restored-at-full-fidelity). The count
  is measured, not estimated: the D1 audit trail survived the outage intact.
  Small in count; the failure rate was nonetheless total.
- **Status**: Resolved. Root cause fixed, both records restored, guards in place.

## What happened

Commit `36bf45a` added `accessibilityAccommodation` to the `consentRecords`
Drizzle model and made `/api/consent` write it on every request:

```ts
accessibilityAccommodation: data.accessibilityAccommodation || null,
```

`|| null` yields an explicit `null` rather than `undefined`, so Drizzle included
the column in the generated SQL column list on **every** insert — not only when
an accommodation was supplied. The column did not exist in Supabase:

```
ERROR: 42703: column "accessibility_accommodation" does not exist
```

Every POST threw, was caught, and returned 500. The banner had already written
`localStorage` and dismissed itself, so the visitor was never re-prompted and
the client never retried. The record was gone.

The same commit added `drizzle/0002_add_accessibility_accommodation.sql`, but it
was hand-written: no `drizzle/meta/0002_snapshot.json`, no `_journal.json`
entry, and no application to the database. Nothing in CI or the deploy path
applies Postgres migrations, and deploys are automatic on push to main — so the
code shipped without its schema.

## Why nobody was told

The failure was invisible on every channel simultaneously. This is the more
important half of the incident.

1. **`locals.cfContext` was never assigned.** It was read in six places, but
   nothing bridged it from the adapter's `locals.runtime.ctx`. It was always
   `undefined`.
2. **Sentry DID receive the errors — nobody was notified.** This corrects an
   earlier version of this document, which claimed server-side Sentry was never
   initialised. It was: both failures are recorded as
   [`CF-ADMIN-1F`](https://pet-hotel-madagascar.sentry.io/issues/CF-ADMIN-1F) at
   `21:07:35.337Z` and `01:45:36.000Z`, tagged `api.route=api/consent`, with the
   complete Postgres error. The capture path worked. What did not exist was any
   **alert rule or routing** that turned those two events into a notification, so
   they sat unread in a project named `cf-admin`.
3. **The alert was severity-gated below email.** `captureApiError` hardcoded
   `severity: 'warning'`, which routes to console + D1 + Sentry only. Only
   `critical` reaches the email channel.
4. **The alert's fetches were cancelled anyway.** `fireAlertBackground` was
   called without `waitUntil` (a consequence of 1), so the runtime discarded the
   promise when the Response returned.
5. **The heartbeat ran daily, read only D1, and skipped silently** when
   `CLOUDFLARE_API_TOKEN` was absent.
6. **The D1 audit trail was intact.** Also corrected: migration 0013 _had_ been
   applied to D1 (though it was missing from the `d1_migrations` ledger), so
   `[SUPABASE_PROJECT_REF]` kept working throughout. That is the only reason the
   two lost records were recoverable at all.

A single missing column took down the write path. The observability path did not
fail to _record_ — it failed to _tell anyone_, which is a different and more
insidious problem: the evidence existed the whole time and no human ever saw it.

## Resolution

Applied the DDL through Supabase's own migration ledger. Consent recording
resumed immediately, with no deploy. All 315 existing rows untouched.

## Recovery — both lost records restored at full fidelity

Exactly **two** consent records were lost, identified from the D1 audit trail:

| Attempt     | Clicked                 | Where                             | Restored as                            |
| ----------- | ----------------------- | --------------------------------- | -------------------------------------- |
| `b763e8e3…` | 2026-08-07 21:07:35 UTC | Aguascalientes, MX (Edge/Windows) | `[D1_DATABASE_ID]` |
| `3610927e…` | 2026-08-08 01:45:36 UTC | Toronto, CA (Chrome/Android)      | `[D1_DATABASE_ID]` |

Both were **accepted** (`granted = true`), `cookies_essential`, locale `es`,
notice `v3.1-2026`.

The D1 dead-letter row alone would have given a degraded reconstruction — its
`request_body` is PII-redacted, so the fingerprint and interaction proof were
gone. But the Sentry events (see cause 2 above) captured the **entire bound
parameter list** of the failed INSERT, including the original server-generated
UUIDs, region/city, interaction proof, full device fingerprint, network ASN,
Turnstile result, trace and CF ray IDs.

So both records were restored **byte-for-byte as originally captured**, under
their original UUIDs — not approximations. The only field that is not the
original is `created_at`, which uses the server-side insert-attempt timestamp
(the original would have been the commit timestamp, ~1s later). Each carries a
`fingerprint_data._recovery` block recording provenance, fidelity and the
source Sentry event ID.

Verified afterwards: 0 duplicate `(session_id, created_at)` groups, 0 remaining
`db_error` rows in D1.

## Contributing causes

| Cause                                                | Fix                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Migration authored but never applied                 | `npm run db:check` in CI + `?probe=consent` in production                                         |
| Hand-written migration with no journal entry         | `drizzle-kit check` in the same guard; hand-writing migrations is now a documented rule violation |
| No test compared written columns against the schema  | `test/consent-contract.test.ts`                                                                   |
| A failed consent write lost the record permanently   | Client outbox + server outbox with automatic replay                                               |
| `locals.cfContext` never assigned                    | Assigned in `middleware.ts`; asserted by `checks.execution_context`                               |
| Consent failures alerted at `warning`                | Now `critical`, which reaches email                                                               |
| Alert promises cancelled                             | `waitUntil` threaded through `captureApiError`                                                    |
| Heartbeat daily, single-credential, silently skipped | Hourly, two independent legs, warns loudly when a credential is missing                           |

## Also found and fixed

- **A second, older drift**: `privacy_notice_version` defaulted to `v1.0-2026`
  in the live database while `schema.ts` declared `v3.1-2026`. No existing row
  is wrong (all three writers set it explicitly), but any future writer relying
  on the default would have stamped consent records with the wrong privacy
  notice version — a latent legal defect.
- `/api/consent` populated only 5 of the 9 available audit columns, leaving
  `consent_type`, `granted`, `locale` and `session_id` always NULL in
  `consent_attempts` and weakening exactly the forensic record needed here.
- The `consent_type` vocabulary had drifted: `/api/contact` wrote `'contact'`,
  which was absent from `/api/consent`'s Zod enum.

## Lessons

1. **A migration file is not an applied migration.** The repo is not the ledger.
   Guard the artefact in CI _and_ the applied state at runtime — neither alone
   is sufficient.
2. **`|| null` is not `undefined`.** With an ORM that builds column lists from
   supplied keys, they mean very different things.
3. **Optimistic UI on legal evidence needs a retry queue.** Dismissing the
   banner and writing localStorage before confirming persistence converts any
   transient failure into permanent, invisible data loss.
4. **Verify the alarm, not just the alert.** Five of the six observability gaps
   were code that looked correct and had simply never fired. A synthetic probe
   that exercises the real write path is worth more than any amount of
   error-handling that has never been observed to work.

{% endraw %}

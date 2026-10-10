{% raw %}
# Where the data lives — read this BEFORE declaring "we have zero X"

Written after the 2026-07-19 false alarm: the owner saw "zero consent logs /
no traffic", but every backend was healthy. The page used to _view_ consent
logs (cf-admin `/dashboard/privacy`) was broken, and an empty **legacy** D1
table named `consent_records` read as "zero consents" in the Cloudflare
console. Two hours of forensics later: not a single record was ever lost.

## The 30-second health check

In the admin portal, open the server's **Jobs** page (`/dashboard/vps/jobs`),
pick `astro_heartbeat` and press **Run now**. Green = consents are being recorded
and no booking is stranded. The check itself runs in the Worker
(`/api/health/?probe=heartbeat`): the live insert probe, both outboxes and the D1
audit of consents and bookings; the job then drains both outboxes. The server
runs it every hour, and cf-admin's `heartbeat-watchdog` job runs the same check
whenever nobody has for 70 minutes
([CONSENT-RECORD-SYSTEM.md](./CONSENT-RECORD-SYSTEM.md) §4).

> **Not the GitHub workflow (2026-10-10).** "Consent & booking heartbeat (by
> hand)" still exists, but Cloudflare's bot protection answers GitHub's runners
> with a challenge page, so a run from GitHub fails without reaching the site.
> Its hourly schedule was turned off for that reason.

## Consent data

| What                                          | Store                         | Table                             | Notes                                                                                                              |
| --------------------------------------------- | ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Legal consent evidence** (the real records) | **Supabase Postgres**         | `consent_records`                 | Written by cf-astro `/api/consent` via Drizzle. THE source of truth.                                               |
| Attempt audit trail (dead-letter)             | Cloudflare D1 `madagascar-db` | `consent_attempts`                | Written BEFORE validation; every click lands here even if the Postgres write later fails. 90-day target retention. |
| Replay outbox (undelivered records)           | Cloudflare D1 `madagascar-db` | `consent_attempts.replay_payload` | The exact canonical Postgres row, held until delivery. Non-NULL = not yet in Supabase. Drained automatically.      |

Full architecture and runbook: **[`CONSENT-RECORD-SYSTEM.md`](./CONSENT-RECORD-SYSTEM.md)**.

There is **no** `consent_records` table in D1 anymore. It was a legacy,
always-empty leftover from the Supabase migration; it was dropped 2026-07-19
(and cf-admin's `migrations/0000_baseline.sql` no longer re-creates it). If
you see one reappear, something re-ran an old migration — investigate.

Copy-paste queries:

```sql
-- Supabase (SQL editor): daily consents, last 30 days
SELECT date_trunc('day', created_at)::date AS day,
       COUNT(*) FILTER (WHERE granted)      AS accepted,
       COUNT(*) FILTER (WHERE NOT granted)  AS rejected
FROM consent_records
WHERE created_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 1 DESC;
```

```sql
-- D1 (console or wrangler d1 execute madagascar-db --remote): attempt statuses, last 14 days
SELECT date(created_at) AS day, status, COUNT(*) AS n
FROM consent_attempts
WHERE created_at >= datetime('now', '-14 days')
GROUP BY day, status ORDER BY day DESC;
```

Healthy = every row `db_success` (or `db_replayed`, meaning it reached Postgres
on a later retry — equally valid). `db_error` / `env_missing` = recording is
broken, fix immediately (the heartbeat fails on exactly this; see the warning at
the top).
`replay_exhausted` = a record gave up retrying and needs manual recovery.

```sql
-- D1: anything still undelivered to Supabase right now
SELECT id, created_at, status, replay_attempts, error_code
FROM consent_attempts
WHERE replay_payload IS NOT NULL AND replayed_at IS NULL
ORDER BY created_at;
```

**30-second health check, no credentials beyond one secret:**

```bash
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
  'https://madagascarhotelags.com/api/health/?probe=consent' | jq '.checks'
```

`consent_insert: "ok (…ms)"` means the full write path — schema, grants, RLS,
connectivity — is verified against production right now. It performs a real
INSERT inside a rolled-back transaction, so it proves the path without
writing a row.

> **Duplicate records are possible and are not a bug.** If a consent write
> succeeds but the response is lost in transit, the browser retry queue re-sends
> it and the server assigns a new id. Over-recording consent is legally
> harmless; under-recording is not, so the trade-off is deliberate. Collapse
> duplicates offline by `session_id` + `created_at` if you ever need exact counts.

## Traffic data

| Lens                                            | Counts                                                                                  | Caveat                                                                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostHog**                                     | Only visitors who clicked **Accept**                                                    | Loads after consent, so PostHog ≈ accept-rate × real traffic. ~5–15 pageviews/day here is NORMAL for this site. Zero-looking mornings are usually just low absolute volume. |
| **Cloudflare** (zone Analytics / Web Analytics) | Everyone, cookieless                                                                    | The only complete traffic number.                                                                                                                                           |
| Booking funnel events                           | PostHog (`booking_wizard_started`, `booking_step_reached`, `booking_submitted_success`) | Same consent caveat.                                                                                                                                                        |

There is deliberately **no** consent event in PostHog — rejected-consent
clicks must not feed an analytics tool. Consent volume lives only in the two
stores above.

## Short-lived data: rate limits and the browser's config cache

| What                                   | Store                                                  | Holds                                                  | Kept for                                      |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------- |
| Rate-limit counters (since 2026-10-04) | Cloudflare's Workers Rate Limiting binding             | a count per `<endpoint>:<client IP>` key               | its one-minute window; we store nothing       |
| Rate-limit fallback counters           | KV `ISR_CACHE` (`rl:<endpoint>:<ip>`, `burst:<ip>`)    | a count, keyed by the client IP                        | 60 s, only when a binding is missing or fails |
| Runtime config in the browser          | the visitor's `sessionStorage` (`mada_runtime_config`) | PostHog and Sentry rates and toggles, no personal data | 10 minutes, and only for that tab             |

Until 2026-10-04 the rate-limit counters were Upstash Redis keys (sliding
windows, 121 s). cf-astro writes nothing to Redis now; the
[change record](./records/2026-10-04-resource-usage.md) has the detail. The
client IP leaves our code only as part of the key sent to Cloudflare's own
rate limiter, inside the same Cloudflare account that already sees it.

## Admin dashboard (cf-admin, secure.madagascarhotelags.com)

`/dashboard/privacy` ("Consent Records") reads **Supabase** `consent_records`
through `/api/audit/receipts`. If it shows zero but the Supabase query above
shows rows, the dashboard is broken — not the data. Check Sentry project
**cf-admin** first (that's exactly what happened on 2026-07-19: a PLAC crash
plus CSP blocking the panel scripts).

Both apps share ONE D1 database (`madagascar-db`) and one `d1_migrations`
ledger. cf-admin migrations are hand-applied (`wrangler d1 execute`); cf-astro
migrations go through `wrangler d1 migrations apply`. Never give two migration
files the same number prefix — a duplicate `0005` is how the forensics PLAC
rows went missing.

{% endraw %}

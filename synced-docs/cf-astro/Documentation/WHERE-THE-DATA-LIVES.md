{% raw %}
# Where the data lives — read this BEFORE declaring "we have zero X"

Written after the 2026-07-19 false alarm: the owner saw "zero consent logs /
no traffic", but every backend was healthy. The page used to *view* consent
logs (cf-admin `/dashboard/privacy`) was broken, and an empty **legacy** D1
table named `consent_records` read as "zero consents" in the Cloudflare
console. Two hours of forensics later: not a single record was ever lost.

## The 30-second health check

Run the **Consent heartbeat** workflow (GitHub → Actions → "Consent heartbeat
(daily)" → Run workflow). Green = consents are being recorded. It also runs
daily at 07:00 Aguascalientes and emails you if consent writes stop or error.

## Consent data

| What | Store | Table | Notes |
| --- | --- | --- | --- |
| **Legal consent evidence** (the real records) | **Supabase Postgres** | `consent_records` | Written by cf-astro `/api/consent` via Drizzle. THE source of truth. |
| Attempt audit trail (dead-letter) | Cloudflare D1 `madagascar-db` | `consent_attempts` | Written BEFORE validation; every click lands here even if the Postgres write later fails. 90-day target retention. |

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

Healthy = every row `db_success`. `db_error` / `env_missing` = recording is
broken, fix immediately (the heartbeat workflow alerts on exactly this).

## Traffic data

| Lens | Counts | Caveat |
| --- | --- | --- |
| **PostHog** | Only visitors who clicked **Accept** | Loads after consent, so PostHog ≈ accept-rate × real traffic. ~5–15 pageviews/day here is NORMAL for this site. Zero-looking mornings are usually just low absolute volume. |
| **Cloudflare** (zone Analytics / Web Analytics) | Everyone, cookieless | The only complete traffic number. |
| Booking funnel events | PostHog (`booking_wizard_started`, `booking_step_reached`, `booking_submitted_success`) | Same consent caveat. |

There is deliberately **no** consent event in PostHog — rejected-consent
clicks must not feed an analytics tool. Consent volume lives only in the two
stores above.

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

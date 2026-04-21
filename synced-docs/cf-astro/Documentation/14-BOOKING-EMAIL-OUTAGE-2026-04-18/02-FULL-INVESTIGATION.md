{% raw %}
# Full Investigation — Step by Step

This document reconstructs the exact sequence of probes used to diagnose the outage, so future incidents can be debugged the same way.

## 0. Initial hypotheses (from the user's report)

The user flagged several possible causes:
- Confirmation number generation
- Resend emailing customer + admin
- Fallback issues
- Database connections
- Domain change from `pet.madagascarhotelags.com` to `madagascarhotelags.com`

Each was tested systematically below.

## 1. Mapped the booking submission flow

Source files traversed:

| File | Role |
|------|------|
| [`src/pages/en/booking.astro`](../../src/pages/en/booking.astro) | Page host, renders `<BookingWizard client:load />` |
| [`src/components/booking/BookingWizard.tsx`](../../src/components/booking/BookingWizard.tsx) | 3-step Preact wizard. On submit, `fetch('/api/booking', { method: 'POST', … })` |
| [`src/pages/api/booking.ts`](../../src/pages/api/booking.ts) | API route: rate-limit → Zod validate → insert consent + booking + pets + quality + 2 audit logs → `env.EMAIL_QUEUE.send()` × 2 → return 200 |
| [`src/lib/schemas/booking.ts`](../../src/lib/schemas/booking.ts) | Zod schema + `generateBookingRef()` |
| [`src/lib/db/client.ts`](../../src/lib/db/client.ts) | Drizzle + postgres-js over Hyperdrive |
| [`src/lib/db/schema.ts`](../../src/lib/db/schema.ts) | Supabase table definitions |
| [`src/lib/rate-limit.ts`](../../src/lib/rate-limit.ts) | Upstash sliding-window limiter (5/60s for booking) |
| [`../cf-email-consumer/src/index.ts`](../../../cf-email-consumer/src/index.ts) | Queue consumer — calls Resend |
| [`../cf-email-consumer/src/templates.ts`](../../../cf-email-consumer/src/templates.ts) | Eta templates |
| [`../cf-email-consumer/src/db.ts`](../../../cf-email-consumer/src/db.ts) | Consumer's isolated Drizzle schema |

## 2. Probed live `/api/booking` on production

### 2a. Empty body → validation

```bash
curl -sS -i -X POST https://madagascarhotelags.com/api/booking \
  -H "Content-Type: application/json" -d "{}" --max-time 20
```

Response:
```
HTTP/1.1 400 Bad Request
Content-Type: application/json
{"success":false,"errors":{"pets":["Required"],"service":["Required"],…,"agreeToTerms":["You must agree to terms"]}}
```

✅ Rate limiter passed, Zod fired correctly.

### 2b. Real payload → full path

```bash
curl -sS -i -X POST https://madagascarhotelags.com/api/booking \
  -H "Content-Type: application/json" \
  -d '{"service":"hotel","checkInDate":"2026-05-01","checkOutDate":"2026-05-03",
       "pets":[{"petName":"TestPet","petType":"dog","petBreed":"Lab","petAge":"3"}],
       "ownerName":"Test Diagnostic","ownerEmail":"diagnostic+cf-astro-debug@example.com",
       "ownerPhone":"+524491234567","agreeToTerms":true,"transportType":"none"}'
```

Response:
```
HTTP/1.1 200 OK
{"success":true,
 "bookingRef":"MAD-20260418-PYLT",
 "consentId":"38e2289c-7bc4-4ed6-971d-c3e5ef1f67f3",
 "emailsQueued":true,
 "whatsappUrl":"https://wa.me/…"}
```

✅ Full happy path works through: rate-limit → Zod → consent insert → booking insert → pets insert → quality insert → audit logs × 2 → queue send × 2.

**→ Server is not the problem.**

## 3. Verified the delivered JS bundle

```bash
curl -sS -o /tmp/booking.html https://madagascarhotelags.com/en/booking/
grep -oE '/_astro/[a-zA-Z0-9._-]+\.(js|css)' /tmp/booking.html | sort -u
```

Output:
```
/_astro/BaseLayout.B0RVTACX.css
/_astro/BookingWizard.mYYHgJ-H.js
/_astro/ConsentBanner.BVTWpHXt.js
/_astro/client.SAVTe8p6.js
/_astro/ClientRouter.astro_astro_type_script_index_0_lang.BcdOYiQn.js
```

All 5 assets returned 200. Inspected `BookingWizard.mYYHgJ-H.js`:

```js
fetch("/api/booking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(I)})
```

✅ Correct endpoint, correct method, correct headers. Bundle is not stale.

## 4. Service Worker check

`/sw.js` on the apex domain:
- HTTP 200, version `madagascar-v2`
- Correctly bypasses `/api/*` (network-only for API routes)

✅ Service worker is not intercepting the booking request.

## 5. Cross-domain sanity checks

```bash
curl -sS -o /dev/null -w "%{http_code} %{url_effective}\n" -L https://pet.madagascarhotelags.com/en/booking/
# → 200 https://pet.madagascarhotelags.com/en/booking/      (not redirecting to apex)

curl -sS -o /dev/null -w "%{http_code}\n" https://cf-astro.pages.dev/en/booking/
# → 404                                                       (safe — old Pages URL is dead)
```

⚠️ `pet.` subdomain still answers 200 — means the Redirect Rules promised in `wrangler.toml` comments were never created in the Cloudflare Dashboard. Tracked as P4 in the fix plan. **Not the cause** of the outage; the user is on the apex domain.

## 6. Queried Supabase for actual row state

### 6a. Recent bookings

```sql
SELECT booking_ref, owner_email, service, created_at, admin_email_sent, user_email_sent, email_error
FROM bookings ORDER BY created_at DESC LIMIT 15;
```

Salient rows:

| booking_ref | owner_email | created_at | admin_sent | user_sent |
|-------------|-------------|------------|------------|-----------|
| MAD-20260418-PYLT | diagnostic+cf-astro-debug@example.com | 2026-04-18 02:31:32 | **false** | **false** |
| MAD-20260418-JA69 | harshil.8136@gmail.com  | 2026-04-18 02:30:08 | **false** | **false** | ← **USER'S BOOKING (confirmed landed)** |
| MAD-20260413-RHPX | harshil.8136@gmail.com  | 2026-04-13 05:33:56 | true       | true      | ← last success |

✅ The user's booking **did land** in the DB. The bug is purely in the email pipeline.

### 6b. Email audit logs — what are they stuck on?

```sql
SELECT id, purpose, status, recipient_email, resend_id, email_error,
       payload->>'bookingRef' AS booking_ref, created_at, updated_at,
       EXTRACT(EPOCH FROM (updated_at - created_at)) AS age_seconds
FROM email_audit_logs
WHERE created_at::date = '2026-04-18'
ORDER BY created_at DESC;
```

All 10 rows for today: `status='failed'`, `resend_id=NULL`, `email_error=NULL`, `updated_at` around 02:45 UTC (batched consumer retry window).

### 6c. Aggregate by day

```sql
SELECT date_trunc('day', created_at) AS day, status, COUNT(*), COUNT(resend_id)
FROM email_audit_logs
WHERE created_at > now() - interval '30 days'
GROUP BY 1, 2 ORDER BY day DESC, status;
```

| day | status | count | with_resend_id |
|-----|--------|-------|----------------|
| 2026-04-18 | failed | 10 | 0 |
| 2026-04-13 | delivered | 1 | 1 |
| 2026-04-13 | failed | 4 | 0 |
| 2026-04-13 | queued | 4 | 0 |
| 2026-04-13 | sent_to_provider | 5 | 5 |

**Zero successful deliveries since 2026-04-13.** All of 2026-04-18 is failed.

## 7. Cloudflare queue & consumer health

```bash
wrangler queues list
# madagascar-emails     : producers=2 (cf-admin-madagascar, cf-astro), consumers=1 (cf-astro-email-consumer)
# madagascar-emails-dlq : producers=0, consumers=0

wrangler queues info madagascar-emails
# 1 consumer, queue healthy
```

✅ Queue is healthy; consumer is attached.

```bash
wrangler secret list --name cf-astro-email-consumer
# → PUBLIC_SUPABASE_URL, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY
```

✅ All three required secrets present on the consumer.

```bash
wrangler versions view e0a88e0f-b1aa-4ef3-9546-5a7048b84b7a --name cf-astro-email-consumer
# Handlers: queue
# Bindings: HYPERDRIVE, SENDER_EMAIL, RESEND_API_KEY, PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

✅ Bindings intact.

## 8. Version history — identifying the trigger event

```bash
wrangler versions list --name cf-astro-email-consumer
```

Key versions:

| Version ID | Created | Source | Note |
|------------|---------|--------|------|
| c5c4186f | 2026-04-13 05:18:29 | version_upload | Added `RESEND_API_KEY` |
| fec61dee | 2026-04-13 05:31:54 | version_upload | Last version that actually delivered emails |
| 74e3c3f1 | 2026-04-13 05:32:09 | Secret Change | — |
| 847ead8e | 2026-04-13 05:32:16 | Secret Change | — |
| 106262b4 | 2026-04-13 05:32:28 | Secret Change | Final successful config — 1 email delivered at 05:33 |
| **e0a88e0f** | **2026-04-17 02:02:16** | **version_upload** | ← **Breaking deploy.** This version is live now and fails 100% of messages. |

**The 04-17 redeploy is the trigger event.** Something in the code delta between 04-13 fec61dee and 04-17 e0a88e0f introduced the Eta runtime compilation path.

## 9. Captured the live error

```bash
wrangler tail cf-astro-email-consumer --format=pretty &
# (then submit a booking to generate traffic)
```

Output (verbatim):
```
Queue madagascar-emails (2 messages) - Ok @ 2026-04-17, 10:51:35 p.m.
  (error) [Consumer] Failed processing 152f75ae1fbae6dd35944c3ab60d0954
    (tracking: 7b868579-3e86-4fa1-9ce6-85900a83630f):
    EvalError: Code generation from strings disallowed for this context
  (error) [Consumer] Failed processing f2b1e90cfae5862e1c79c58030c9dc98
    (tracking: 1f39ff65-5c6f-4415-8d51-3bdcdda992de):
    EvalError: Code generation from strings disallowed for this context
```

**Root cause confirmed.** See [03-ROOT-CAUSE-ANALYSIS.md](./03-ROOT-CAUSE-ANALYSIS.md) for the mechanism.

{% endraw %}

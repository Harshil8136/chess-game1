{% raw %}
# Evidence and Logs — Raw Captured Output

Verbatim output from the probes. Kept here so the investigation is reproducible without re-running the commands.

## 1. `/api/booking` — empty body

```
$ curl -sS -i -X POST https://madagascarhotelags.com/api/booking \
    -H "Content-Type: application/json" -d "{}" --max-time 20

HTTP/1.1 400 Bad Request
Content-Type: application/json
CF-Ray: 8fa4…
Server: cloudflare

{"success":false,"errors":{
  "pets":["Required"],
  "service":["Required"],
  "checkInDate":["Required"],
  "ownerName":["Required"],
  "ownerEmail":["Required"],
  "ownerPhone":["Required"],
  "agreeToTerms":["You must agree to terms"]
}}
```

## 2. `/api/booking` — real payload

```
$ curl -sS -i -X POST https://madagascarhotelags.com/api/booking \
    -H "Content-Type: application/json" \
    -d '{"service":"hotel","checkInDate":"2026-05-01","checkOutDate":"2026-05-03",
         "pets":[{"petName":"TestPet","petType":"dog","petBreed":"Lab","petAge":"3"}],
         "ownerName":"Test Diagnostic","ownerEmail":"diagnostic+cf-astro-debug@example.com",
         "ownerPhone":"+524491234567","agreeToTerms":true,"transportType":"none"}'

HTTP/1.1 200 OK
Content-Type: application/json

{"success":true,
 "bookingRef":"MAD-20260418-PYLT",
 "consentId":"38e2289c-7bc4-4ed6-971d-c3e5ef1f67f3",
 "emailsQueued":true,
 "whatsappUrl":"https://wa.me/5214494485486?text=..."}
```

## 3. Delivered bundle — endpoint confirmation

```
$ curl -sS https://madagascarhotelags.com/_astro/BookingWizard.mYYHgJ-H.js \
  | grep -oE 'fetch\("/api/booking"[^)]*\)'

fetch("/api/booking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(I)})
```

## 4. Service worker

```
$ curl -sS -I https://madagascarhotelags.com/sw.js
HTTP/1.1 200 OK
Content-Type: application/javascript
…
$ curl -sS https://madagascarhotelags.com/sw.js | grep -i "api"
  // Network-only for /api/* — never cache API calls
  if (url.pathname.startsWith('/api/')) { return; }
```

## 5. Domain sanity

```
$ curl -sS -o /dev/null -w "%{http_code} %{url_effective}\n" -L \
    https://pet.madagascarhotelags.com/en/booking/
200 https://pet.madagascarhotelags.com/en/booking/

$ curl -sS -o /dev/null -w "%{http_code}\n" \
    https://cf-astro.pages.dev/en/booking/
404
```

## 6. Supabase — recent bookings

```sql
SELECT booking_ref, owner_email, service, created_at,
       admin_email_sent, user_email_sent, email_error
FROM bookings
ORDER BY created_at DESC LIMIT 15;
```

```
 booking_ref        | owner_email                              | created_at          | admin_sent | user_sent | email_error
--------------------+------------------------------------------+---------------------+------------+-----------+-------------
 MAD-20260418-PYLT  | diagnostic+cf-astro-debug@example.com    | 2026-04-18 02:31:32 | false      | false     | NULL
 MAD-20260418-JA69  | harshil.8136@gmail.com                   | 2026-04-18 02:30:08 | false      | false     | NULL
 MAD-20260417-W2K1  | (internal test)                          | 2026-04-17 02:05:10 | false      | false     | NULL
 MAD-20260413-RHPX  | harshil.8136@gmail.com                   | 2026-04-13 05:33:56 | true       | true      | NULL
 MAD-20260413-T4E8  | (internal test)                          | 2026-04-13 05:31:12 | true       | true      | NULL
 …
```

`email_error` is `NULL` everywhere, including on the failing rows — the schema-drop bug masking the real error text (see [06-SECONDARY-FINDINGS.md](./06-SECONDARY-FINDINGS.md)).

## 7. Supabase — email_audit_logs for 2026-04-18

```sql
SELECT id, purpose, status, recipient_email, resend_id, email_error,
       payload->>'bookingRef' AS booking_ref,
       created_at, updated_at,
       EXTRACT(EPOCH FROM (updated_at - created_at)) AS age_seconds
FROM email_audit_logs
WHERE created_at::date = '2026-04-18'
ORDER BY created_at DESC;
```

All 10 rows: `status='failed'`, `resend_id=NULL`, `email_error=NULL`, `age_seconds ≈ 900` (the time from enqueue to final retry exhaustion).

## 8. Supabase — daily aggregate, last 30 days

```sql
SELECT date_trunc('day', created_at) AS day, status,
       COUNT(*) AS cnt, COUNT(resend_id) AS with_resend
FROM email_audit_logs
WHERE created_at > now() - interval '30 days'
GROUP BY 1, 2 ORDER BY day DESC, status;
```

```
 day        | status            | cnt | with_resend
------------+-------------------+-----+-------------
 2026-04-18 | failed            |  10 |  0
 2026-04-17 | failed            |   6 |  0
 2026-04-13 | delivered         |   1 |  1
 2026-04-13 | failed            |   4 |  0
 2026-04-13 | queued            |   4 |  0
 2026-04-13 | sent_to_provider  |   5 |  5
 2026-03-xx | delivered         |  …  |  …
```

Last successful delivery: **2026-04-13 05:33 UTC**. Zero successes on 2026-04-17 or 2026-04-18.

## 9. Wrangler — queue health

```
$ wrangler queues list
┌────────────────────────┬───────────┬───────────┐
│ Name                   │ Producers │ Consumers │
├────────────────────────┼───────────┼───────────┤
│ madagascar-emails      │ 2         │ 1         │
│ madagascar-emails-dlq  │ 0         │ 0         │
└────────────────────────┴───────────┴───────────┘

$ wrangler queues info madagascar-emails
Queue: madagascar-emails
Producers:
  - cf-admin-madagascar   (binding: EMAIL_QUEUE)
  - cf-astro              (binding: EMAIL_QUEUE)
Consumers:
  - cf-astro-email-consumer (max_batch_size=10, max_retries=3, dlq=madagascar-emails-dlq)
Status: healthy
```

## 10. Wrangler — consumer secrets and bindings

```
$ wrangler secret list --name cf-astro-email-consumer
[
  { "name": "PUBLIC_SUPABASE_URL",        "type": "secret_text" },
  { "name": "RESEND_API_KEY",              "type": "secret_text" },
  { "name": "SUPABASE_SERVICE_ROLE_KEY",   "type": "secret_text" }
]

$ wrangler versions view e0a88e0f-b1aa-4ef3-9546-5a7048b84b7a --name cf-astro-email-consumer
Version ID:    e0a88e0f-b1aa-4ef3-9546-5a7048b84b7a
Created:       2026-04-17 02:02:16 UTC
Author:        harshil.cloud8@gmail.com
Handlers:      queue
Bindings:
  - HYPERDRIVE                (hyperdrive)
  - SENDER_EMAIL              (plain_text)
  - RESEND_API_KEY            (secret)
  - PUBLIC_SUPABASE_URL       (secret)
  - SUPABASE_SERVICE_ROLE_KEY (secret)
```

## 11. Wrangler — version history

```
$ wrangler versions list --name cf-astro-email-consumer
Version ID                              | Created (UTC)         | Source         | Note
c5c4186f-…                              | 2026-04-13 05:18:29   | version_upload | RESEND_API_KEY added
fec61dee-c5c4-4bc6-bbc5-b45948b2e83c    | 2026-04-13 05:31:54   | version_upload | LAST GOOD — delivered at 05:33
74e3c3f1-…                              | 2026-04-13 05:32:09   | secret_change  |
847ead8e-…                              | 2026-04-13 05:32:16   | secret_change  |
106262b4-…                              | 2026-04-13 05:32:28   | secret_change  | final good config
e0a88e0f-b1aa-4ef3-9546-5a7048b84b7a    | 2026-04-17 02:02:16   | version_upload | BROKEN — Eta renderString path
```

## 12. `wrangler tail` — the live error

```
$ wrangler tail cf-astro-email-consumer --format=pretty

Connected to cf-astro-email-consumer.
Waiting for logs...

Queue madagascar-emails (2 messages) - Ok @ 2026-04-17, 10:51:35 p.m.
  (log)   [Consumer] Booting handler, batch size=2
  (error) [Consumer] Failed processing 152f75ae1fbae6dd35944c3ab60d0954
          (tracking: 7b868579-3e86-4fa1-9ce6-85900a83630f):
          EvalError: Code generation from strings disallowed for this context
  (error) [Consumer] Failed processing f2b1e90cfae5862e1c79c58030c9dc98
          (tracking: 1f39ff65-5c6f-4415-8d51-3bdcdda992de):
          EvalError: Code generation from strings disallowed for this context
  (log)   [Consumer] Batch complete: 0 ack, 2 retry

Queue madagascar-emails (2 messages) - Ok @ 2026-04-17, 10:56:40 p.m.
  (error) [Consumer] Failed processing 152f75ae1fbae6dd35944c3ab60d0954
          (tracking: 7b868579-3e86-4fa1-9ce6-85900a83630f):
          EvalError: Code generation from strings disallowed for this context
  …retry #2…

Queue madagascar-emails (2 messages) - Ok @ 2026-04-17, 11:01:45 p.m.
  …retry #3 (max_retries) — will route to DLQ on next failure…
```

**This is the smoking gun.** The error identifier string `"Code generation from strings disallowed for this context"` is the verbatim message V8 produces when `new Function(...)` or `eval(...)` is invoked in an isolate with `AllowCodeGenerationFromStrings = false`.

{% endraw %}

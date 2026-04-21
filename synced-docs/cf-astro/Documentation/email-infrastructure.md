{% raw %}
# Email Infrastructure & Consent Pipeline

This document details the high-integrity email delivery and consent tracking architecture for `cf-astro`.

## 1. Dual-Queue Producer Architecture
In `cf-astro`, we do not perform synchronous email deliveries (i.e. waiting on `fetch('https://api.resend.com/...')`) inside our API routes. Doing so risks timeouts, poor user experience, and lost events during high traffic.

Instead, `/api/booking.ts` pushes *two* separate messages to Cloudflare Queues for each booking configuration:
1. `booking_admin_notification`: Targeted to the internal admin team (`booking@madagascarhotelags.com`).
2. `booking_customer_confirmation`: Targeted to the customer's provided email.

This is critical because if the customer mistypes their email and the message bounces, it will *not* prevent the admin from receiving their notification, since the queue processes them natively as independent payloads.

## 2. Isolated Email Consumer
The Cloudflare queue is consumed by the `cf-email-consumer` worker. 
**Crucial Architectural Rule:** The queue worker is 100% self-contained. It operates with a duplicated schema `db.ts` to connect to Supabase. It **must never** import Drizzle schemas or UI files from `cf-astro` or `cf-admin`. Breaking this rule causes unresolvable build cycles and module resolution failures in Cloudflare's `workerd` runtime.

## 3. LFPDPPP Consent Interaction Proofs
To comply with Mexican Data Privacy laws (LFPDPPP) and international GDPR laws, explicit consent must be logged natively.
When a user clicks "He leído y acepto los Términos y Condiciones", we use JavaScript UI tracking to capture `interactionProof` and `consentFingerprint`:
- `checkboxClickedAt`: Exact ISO time the user interacted with the checkbox.
- `formStartedAt`: Exact ISO time the session began.
- `userAgent`: Raw user-agent string.
- `fieldFocusOrder`: The array sequence of fields the user interacted with (to prove genuine human input, not bot autofill).

## 4. Webhook Observability Loop
Resend dispatches delivery events (`email.delivered`, `email.bounced`, etc.). 
We receive these in `cf-astro/src/pages/api/webhooks/resend.ts`.
Since standard webhook SDKs like `svix` use Node.js `crypto` un-supported by edge variants, we verify the signature manually using the native `crypto.subtle.verify` (Web Crypto API) with HMAC-SHA256.
Once verified, the payload is appended to the `email_audit_logs.delivery_events` JSONB array in Supabase.

{% endraw %}

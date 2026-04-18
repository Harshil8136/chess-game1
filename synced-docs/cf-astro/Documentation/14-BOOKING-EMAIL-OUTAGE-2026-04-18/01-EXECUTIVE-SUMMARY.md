# Executive Summary

## What the user observed

> "On the booking page in prod at https://madagascarhotelags.com/en/booking/ I made a booking, and I'm stuck at the last step where we hit Book Now and it's not working."

## What is actually happening

- The **front-end wizard submits successfully**, the **API returns 200**, and the **booking is recorded** in Supabase.
- The user then sees the green **"Booking Request Sent!"** success screen — the wizard believes it succeeded.
- However, **no confirmation email is ever sent** to the customer and **no notification email is ever sent** to the admin (`mascotasmadagascar@gmail.com`).
- From the business's perspective this looks identical to a total booking failure: no ops team sees the reservation, no customer gets a confirmation, everyone assumes "Book Now is broken."

## Root cause (one sentence)

The `cf-astro-email-consumer` Cloudflare Worker uses the **Eta** templating library, whose `renderString()` compiles HTML templates at runtime via `new Function()`, which Cloudflare Workers block with `EvalError: Code generation from strings disallowed for this context` — so every queued email fails before it can reach Resend.

## Impact

| Metric | Value |
|---|---|
| Bookings correctly persisted in DB | 100% |
| Emails successfully delivered since 2026-04-17 02:02 UTC | **0%** |
| Customers affected (as of report time) | At least 5 bookings × 2 recipients = 10 missed emails |
| Days the bug has been live | ~1 day visibly (user-reported), but pipeline has been in a broken state since the 04-17 redeploy |
| Admin operational visibility | Zero — `email_audit_logs.email_error` column is silently dropped by a schema mismatch, so the DB shows `status='failed'` with no error text |

## Confidence level

**High (≥95%).** The error was captured live via `wrangler tail cf-astro-email-consumer`:

```
(error) [Consumer] Failed processing 152f75ae1fbae6dd35944c3ab60d0954
  (tracking: 7b868579-3e86-4fa1-9ce6-85900a83630f):
  EvalError: Code generation from strings disallowed for this context
```

This matches the exact failure mode of Eta on Cloudflare Workers (documented upstream).

## Fix in one sentence

Replace `eta.renderString(tpl, data)` calls in `cf-email-consumer/src/index.ts` with either (a) plain template-literal functions that don't need runtime compilation, or (b) an Eta build-time pre-compile step that emits compiled JS.

## Recommended next step

Execute P0 from [05-FIX-PLAN.md](./05-FIX-PLAN.md): convert the 3 templates in `cf-email-consumer/src/templates.ts` to template-literal functions, redeploy the consumer, verify end-to-end via a test booking, then re-queue the failed emails per [07-RUNBOOK-RECOVERY.md](./07-RUNBOOK-RECOVERY.md).

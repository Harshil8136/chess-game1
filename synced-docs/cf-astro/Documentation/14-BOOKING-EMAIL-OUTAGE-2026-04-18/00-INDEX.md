{% raw %}
# Booking Email Outage — 2026-04-18 Incident Report

> **Status:** Root cause identified. Fix not yet applied.
> **Severity:** P0 — customer-facing (silent email delivery failure)
> **First failing booking:** `MAD-20260418-JA69` (user report) — but pipeline actually broke on **2026-04-17 02:02:16 UTC** during a redeploy of `cf-astro-email-consumer`.
> **Last successful email delivery:** 2026-04-13 05:33 UTC (`MAD-20260413-RHPX`).
> **Blast radius:** Every booking submitted since the 2026-04-17 redeploy reached Supabase successfully but neither customer nor admin received any email. The wizard UI shows the green "Booking Request Sent!" success screen — users can't tell anything is wrong.

## Files in this folder

| File | Purpose |
|------|---------|
| [00-INDEX.md](./00-INDEX.md) | This file — entry point |
| [01-EXECUTIVE-SUMMARY.md](./01-EXECUTIVE-SUMMARY.md) | One-page summary for stakeholders |
| [02-FULL-INVESTIGATION.md](./02-FULL-INVESTIGATION.md) | Step-by-step forensics with every probe and result |
| [03-ROOT-CAUSE-ANALYSIS.md](./03-ROOT-CAUSE-ANALYSIS.md) | Deep dive on the `EvalError` and why Eta doesn't work on Workers |
| [04-EVIDENCE-AND-LOGS.md](./04-EVIDENCE-AND-LOGS.md) | Raw captured output (curl, wrangler tail, SQL results) |
| [05-FIX-PLAN.md](./05-FIX-PLAN.md) | P0→P5 remediation plan with code sketches |
| [06-SECONDARY-FINDINGS.md](./06-SECONDARY-FINDINGS.md) | Other bugs discovered during the investigation |
| [07-RUNBOOK-RECOVERY.md](./07-RUNBOOK-RECOVERY.md) | How to recover the 10+ lost customer confirmations |
| [08-PREVENTION.md](./08-PREVENTION.md) | Changes to RULES.md, CI checks, and observability to prevent recurrence |

## One-minute read

1. `/api/booking` is **healthy**. Submitting a real payload returns `200 {"success":true,"bookingRef":"MAD-…"}`.
2. The booking is **inserted** into Supabase correctly (verified `MAD-20260418-JA69` for Harshil).
3. The API pushes 2 messages to `env.EMAIL_QUEUE` (admin + customer) — this also succeeds.
4. The **`cf-astro-email-consumer` worker picks up the messages** but throws on every single one:
   ```
   EvalError: Code generation from strings disallowed for this context
   ```
5. The error is thrown by **Eta's `renderString(...)`**, which compiles the HTML template at runtime using `new Function()`. Cloudflare Workers block dynamic code generation at the V8 isolate level — this is a platform policy, not something a flag can turn off on the Free plan.
6. The consumer's catch-block tries to persist the error to `email_audit_logs.email_error`, but the Drizzle schema in the consumer doesn't declare that column, so Drizzle silently drops the field — the DB row ends up with `status='failed'` but `email_error=NULL`. That's why the failure was invisible for ~5 days.

## Trigger event

| When | What |
|------|------|
| 2026-04-13 05:33 UTC | Last successful delivery — version `fec61dee-c5c4-4bc6-bbc5-b45948b2e83c` still processing. |
| 2026-04-17 02:02:16 UTC | Version `e0a88e0f-b1aa-4ef3-9546-5a7048b84b7a` uploaded via `wrangler deploy`. This is the version currently running and failing 100% of messages. |
| 2026-04-18 02:30:08 UTC | User (Harshil) submits a real booking that surfaces the bug externally. |

## Domain switch is **not** the cause

The user suspected the `pet.madagascarhotelags.com → madagascarhotelags.com` migration. Verified it is unrelated:
- The booking page, bundle, and API all live on the apex domain and respond correctly.
- The consumer worker talks server-to-server to Supabase + Resend; it never touches the public domain.
- `pet.` is still live (the Dashboard redirect rules were never created) — tracked as a separate P4 cleanup, not a blocker.

{% endraw %}

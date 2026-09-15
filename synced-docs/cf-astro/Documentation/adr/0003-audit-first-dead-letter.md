{% raw %}
# ADR-0003: Audit-first D1 dead-letter for booking/consent attempts

**Status:** Accepted · **Guarded by:** AGENTS.md invariant #2

## Context

The primary datastore (Supabase Postgres) is external to Cloudflare's edge. If
it is down or slow, a booking submission could be lost entirely — and consent
clicks are legal evidence under LFPDPPP/GDPR.

## Decision

`booking.ts` and `consent.ts` write a PII-redacted record of every attempt to
**D1 (same-isolate, always available) before** origin/rate-limit/validation
checks. A coarse pre-audit burst guard (KV) caps write amplification during
floods; PII keys in the stored body are scrubbed by `redactPii()`.

## Rationale

D1 lives in the Worker's infrastructure: if the Worker can run, it can audit.
This turns "Supabase outage during a booking" from data loss into a
reconcilable event (the cf-admin retry cron re-processes `queue_error` rows,
and `email_payload` is persisted before dispatch).

## Consequences

- Attempt tables accumulate IP/UA + redacted bodies → the 90-day retention
  purge (`db/retention-purge.sql`, weekly workflow) is part of this contract.
- Audit writes must never block or fail the user path (all wrapped, and
  non-terminal status updates run via `waitUntil`).

{% endraw %}

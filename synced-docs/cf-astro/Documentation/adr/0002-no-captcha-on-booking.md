{% raw %}
# ADR-0002: No Turnstile/CAPTCHA on booking and contact

**Status:** Accepted · **Guarded by:** AGENTS.md invariant #1, ⛔ banners in `booking.ts`/`contact.ts`, README security table

## Context

Cloudflare Turnstile protects forms against bots, but the widget adds a
client-side dependency that can fail silently (script blocked, challenge
loop, network hiccup) — and a failed widget means the form cannot submit.

## Decision

Turnstile is used **only** on the ARCO legal-document upload
(`/api/arco/submit`). It is permanently forbidden on `/api/booking` and
`/api/contact`.

## Rationale

A silently failing widget on the booking form would block legitimate,
possibly-urgent bookings with no error the user can act on. Spam pressure on
these endpoints is handled by layered controls that cannot brick the form:
Origin allowlist → rate limits + burst guard → Zod validation → D1 dead-letter
audit. ARCO is different: low traffic, file upload, legal exposure — there the
anti-abuse benefit outweighs the friction.

## Consequences

- Booking/contact accept some bot noise by design; the dead-letter table makes
  it observable.
- Any future bot mitigation for these endpoints must be non-blocking
  (heuristics, scoring), never a challenge that gates submission.

{% endraw %}

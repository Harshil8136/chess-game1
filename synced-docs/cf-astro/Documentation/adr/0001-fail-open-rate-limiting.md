{% raw %}
# ADR-0001: Rate limiting fails OPEN

**Status:** Accepted (owner decision, 2026-06-13) · **Guarded by:** AGENTS.md invariant #3, `test/doc-accuracy.test.ts`

## Context

Rate limiting protects the booking/contact/consent endpoints from abuse. The
primary limiter is Upstash Redis; the fallback is a shared KV counter. Both are
external dependencies that can be down or unconfigured.

## Decision

When BOTH Upstash and KV are unavailable, requests are **allowed through**
(fail-open), not rejected.

## Rationale

The booking path is treated as life-safety-adjacent: a family with a pet
emergency must be able to book even during an Upstash outage. Real traffic is
~1 booking/week; the damage from letting unmetered requests through for the
duration of an outage is bounded (D1 dead-letter still audits every attempt,
origin checks still apply), while the damage from blocking a legitimate
emergency booking is not.

## Consequences

- SECURITY.md must state fail-open honestly (it once claimed fail-closed —
  that drift is now CI-enforced against).
- Do NOT "fix" this to fail-closed/503 without explicit owner approval.

{% endraw %}

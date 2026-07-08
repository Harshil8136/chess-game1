---

title: "Runbook: Enable Supabase Leaked-Password Protection"
status: active
audience: [operator, owner]
last_verified: 2026-07-08
verified_against: [supabase-mcp]
owner: harshil
related_docs: [../security/SECURITY.md, ../security/compliance/ASVS-L2.md]
tags: [runbook, supabase, auth, compliance]
---

# Runbook: Enable Supabase Leaked-Password Protection

Closes the `auth_leaked_password_protection` finding surfaced by
`mcp__Supabase__get_advisors({ type: 'security' })`. Turns on Supabase Auth's
built-in HaveIBeenPwned (HIBP) check so new/rotated passwords are compared
against the compromised-password corpus and rejected on match.

> **TL;DR:** it's a 30-second dashboard toggle. No code change, no cost. Once
> enabled, verify via the advisor MCP call and delete this runbook's "pending"
> note in `documentation/2026-07-05-comprehensive-codebase-and-system-review.md`.

## Steps

1. Open the Supabase Dashboard for the `Cloudflare` project
   (project ref `zlvmrepvypucvbyfbpjj`).
2. Navigate to **Authentication → Providers → Email**.
3. Scroll to **"Password Protection"**.
4. Enable **"Leaked Password Protection"** (a.k.a. HIBP check).
5. Save. No user session is invalidated.

## Verification

Run the security-advisor MCP call after the toggle propagates (a few seconds):

```json
mcp__Supabase__get_advisors({
  "project_id": "zlvmrepvypucvbyfbpjj",
  "type": "security"
})
```

The `auth_leaked_password_protection` entry should be gone from `lints[]`.

If it is still present after a minute, confirm the toggle is on
in the dashboard and check that no infra-as-code (Terraform, Supabase CLI)
is reverting the setting on the next apply.

## Why this matters

- **Compliance ref:** OWASP ASVS v4.0.3 § 2.1.7 (passwords must be checked
  against a corpus of known compromised passwords).
- **Cost:** $0 — bundled with Supabase Auth on all tiers.
- **Blast radius:** users whose new password matches a HIBP entry get a rejection
  message and are asked to choose another. Existing sessions are unaffected.

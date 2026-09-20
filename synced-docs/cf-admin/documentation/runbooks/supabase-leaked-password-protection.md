---

title: "Runbook (historical): Supabase Leaked-Password Protection — not applicable"
status: historical
audience: [operator, owner]
last_verified: 2026-09-19
verified_against: [live-mcp, code]
owner: harshil
related_docs: [supabase-account-advisor-sweep.md, ../security/SECURITY.md, ../security/compliance/ASVS-L2.md]
tags: [runbook, supabase, auth, compliance, historical]
---

# Runbook (historical): Supabase Leaked-Password Protection — not applicable

> ## ⛔ Do not follow this runbook. The finding it closes should not be actioned.
>
> [`supabase-account-advisor-sweep.md`](supabase-account-advisor-sweep.md) §3 is
> the owner of the `auth_leaked_password_protection` advisor line, and it says:
> *"Not applicable — authentication is Cloudflare Access, not Supabase Auth …
> **Do not re-raise it as a finding**."* This page used to give step-by-step
> instructions to act on it anyway. Two active runbooks in direct opposition on
> the same advisor line was the real defect; this one is now `historical` and
> the sweep runbook owns the decision.

## Why it does not apply

Three independent reasons, each sufficient on its own (all verified 2026-09-19):

1. **There are no Supabase Auth passwords to protect.** This platform
   authenticates through Cloudflare Access. There is no GoTrue usage anywhere
   in `src/` — no `signIn`, `signUp`, `updateUser` or `auth.admin` call — and
   `src/lib/supabase.ts`'s `createAdminClient` explicitly disables session
   handling. `OPERATIONS.md` §5 records that GoTrue and the login form were
   retired, along with `PUBLIC_SUPABASE_ANON_KEY` and `TURNSTILE_SECRET_KEY`.
   The HIBP check would guard a login path that does not exist.
2. **It is not available on this plan.** Supabase documents leaked-password
   protection as **Pro Plan and above**. The organisation
   (`Mascotas Madagascar's projects`) is on the **free** plan. Acting on this
   page therefore means a paid upgrade, which breaks the $0 constraint in
   ADR-0001 — the opposite of the "$0 — bundled with Supabase Auth on all
   tiers" this document claimed until 2026-09-19.
3. **The advisor will keep reporting it, and that is expected.** Re-checked
   2026-09-19: `get_advisors(type: 'security')` on the production project
   returns exactly one lint, `auth_leaked_password_protection` (WARN,
   EXTERNAL). The toggle genuinely is off. It is meant to be.

## If the situation changes

Revisit only if the platform adopts Supabase Auth for a real login path **and**
the organisation moves to Pro. In that case the procedure is a dashboard
toggle (Authentication → Providers → Email → Password Protection), and the
verification is the advisor call above returning zero lints. Re-open this page
as `active` at that point rather than writing a new one.

## Compliance note

OWASP ASVS v4.0.3 § 2.1.7 (passwords checked against a corpus of known
compromised passwords) is satisfied **vacuously**: the application stores and
verifies no user passwords. Record it that way in
`../security/compliance/ASVS-L2.md` rather than as an open item — a control
that has nothing to control is not a gap.

## Verification log

| Date | Method | Result |
|---|---|---|
| 2026-09-19 | Supabase MCP `get_organization` and `get_advisors(security)`; `grep` for GoTrue usage across `src/`; `supabase-account-advisor-sweep.md` §3 re-read | Org plan `free`; one lint, unchanged; no GoTrue usage. Re-statused `active` → `historical`; the "$0 on all tiers" and "30-second toggle" claims removed; the instruction to edit a dated historical review (`2026-07-05-comprehensive-codebase-and-system-review.md`) dropped — a dated snapshot is not edited after the fact |

---

title: "Runbook — Account-Wide Supabase Advisor Sweep"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-07-29
verified_against: [live-mcp]
owner: harshil
related_docs: [../security/RoPA.md, ../security/compliance/data-residency.md, ../security/compliance/SOC2-TSC-mapping.md, ../operations/OPERATIONS.md]
tags: [runbook, supabase, security, advisors, review, quarterly]
---

# Runbook — Account-Wide Supabase Advisor Sweep

> **TL;DR (non-technical):** Every quarter, list *all* Supabase projects on the account and
> run the security check against each one — not just the project we think is in use. This
> exists because on 2026-07-29 a review found a second project holding personal data that
> appeared in no document and no code, with 128 security findings against the production
> project's 1. Checking one known project by name is what let it stay invisible.

## Context / Scope

**Why this runbook exists.** Every prior security review queried advisors for the production
project by its hardcoded ref (`zlvmrepvypucvbyfbpjj`). Each review reported a clean result
and was correct about the project it checked. None of them discovered
`anpagfigqkorxubnyanj`, dormant since June 2026, holding 105 consent receipts, 192 forensic
access log rows and 2 ARCO requests, with 45 `SECURITY DEFINER` functions callable by the
anonymous role over the public REST API.

The failure was not the check. It was the **scope** of the check: an inventory derived from
documentation rather than from the account.

**Cadence.** Quarterly, matching the `GRC-03` internal-audit cadence in
`security/compliance/CSA-CAIQ-v4.md`, and additionally on any of these triggers:

- Before publishing any claim about database security posture (RLS coverage, anonymous
  access) — the claim must name the project it applies to.
- Before onboarding a client, since each client runs their own Supabase project.
- After any project creation, restore, or branch merge.

## Procedure

### 1. Enumerate every project on the account — do not skip this step

```
mcp__Supabase__list_projects
```

Record `id`, `name`, `status`, `region` and `created_at` for **every** row returned. The
point of the runbook is this list, not the advisors. If a project appears here that is not
described in `security/RoPA.md`, that is a finding in itself — stop and resolve the omission
before continuing.

### 2. Run both advisor types against each project

For every ref from step 1:

```
mcp__Supabase__get_advisors  project_id=<ref>  type=security
mcp__Supabase__get_advisors  project_id=<ref>  type=performance
```

> The security output for a neglected project can be large — the 2026-07-29 run returned
> 139 KB for one project and overflowed the tool's token budget. When that happens the
> result is written to a file; aggregate it by lint `name` and `level` rather than reading
> it linearly.

### 3. Triage

| Finding | Severity | Action |
|---|---|---|
| `anon_security_definer_function_executable` | **High** — a `SECURITY DEFINER` function callable by an unauthenticated caller over `/rest/v1/rpc/*` | `REVOKE EXECUTE ... FROM anon` or switch to `SECURITY INVOKER`, unless the public exposure is deliberate and documented |
| `authenticated_security_definer_function_executable` | High if the function is privileged | Same, scoped to `authenticated` |
| `rls_policy_always_true` | **High** — `USING (true)` / `WITH CHECK (true)` negates RLS for that role | Replace with a `service_role`-scoped or subject-scoped policy |
| `rls_enabled_no_policy` | Medium — table is unreachable, which fails closed but is usually unintended | Add the intended policy or document the intent |
| `function_search_path_mutable` | Medium | Pin `search_path` (see `supabase/migrations/20260726000000_advisor_fixes.sql` for the pattern) |
| `auth_leaked_password_protection` | Low **on this platform** | Not applicable — authentication is Cloudflare Access, not Supabase Auth. Tracked as L-8. Do not re-raise it as a finding on the production project |
| Unused-index / performance lints | Informational | Never drop an index covering a foreign key, even at `idx_scan = 0` — see `supabase/migrations/20260708000001_drop_unused_indexes.sql` |

### 4. Record the result

Append one line per project to the verification log below: date, project ref, security
finding count, performance finding count, action taken. This log is the sampleable evidence
for SOC 2 `CC4.1`, which is currently 🟡 precisely because no such log existed.

## Baseline — 2026-07-29

| Project | Ref | Status | Security findings | Verdict |
|---|---|---|---|---|
| Cloudflare (**production**) | `zlvmrepvypucvbyfbpjj` | ACTIVE_HEALTHY | **1** (`auth_leaked_password_protection`, N/A on this platform) | Clean. This is the project every posture claim refers to. |
| supabase-pink-village (superseded version) | `anpagfigqkorxubnyanj` | ACTIVE_HEALTHY, dormant | **128** — 45 anon-executable `SECURITY DEFINER`, 48 authenticated-executable, 14 always-true RLS, 19 mutable `search_path`, 1 RLS-no-policy | Not remediated by decision. Superseded product version, no live connection; pending export then decommission. See `security/RoPA.md` activity **H**. |

Any future sweep should compare against this table. A production count above 1, or a new
project absent from `RoPA.md`, is the signal to act.

## Operational notes

- **Export before pausing.** Pausing a Supabase project makes its data inaccessible until
  restored. For `anpagfigqkorxubnyanj` the export must complete *before* the pause, or the
  pause blocks the export it exists to protect.
- **A clean advisor run is not a clean database.** Advisors do not evaluate application-layer
  authorization. cf-admin reaches Supabase exclusively through a service-role client that
  bypasses RLS entirely, so RLS is defence-in-depth here, not the primary control. Velox's
  `copy-lint.test.ts` already bans the phrase "row-level security" in customer copy for this
  reason.
- **Per-client deployments multiply this runbook.** Each client has their own Supabase
  project on their own account, so this sweep runs per account, not once globally. Whoever
  builds the fleet tooling should fold it in.

## Verification log

| Date | Project(s) | Security / Perf | Action |
|---|---|---|---|
| 2026-07-29 | Both (see baseline) | 1 / not run · 128 / not run | Baseline established. Production clean. Superseded project recorded in RoPA as activity H, pending export and decommission. |

## Related

- [`../security/RoPA.md`](../security/RoPA.md) — activity **H** records the superseded project
- [`../security/compliance/data-residency.md`](../security/compliance/data-residency.md) — where durable stores live
- [`../security/compliance/SOC2-TSC-mapping.md`](../security/compliance/SOC2-TSC-mapping.md) — `CC4.1`, which this log supplies evidence for
- [`supabase-leaked-password-protection.md`](supabase-leaked-password-protection.md) — the L-8 advisory this sweep will keep surfacing

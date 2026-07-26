---

title: "Incident Response & Breach Notification Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-07-25
verified_against: [code, config]
owner: harshil
related_docs: [disaster-recovery.md, ../security/SECURITY.md, ../security/RoPA.md, ../security/compliance/SOC2-TSC-mapping.md, ../MAINTENANCE.md]
tags: [incident-response, breach, gdpr, soc2, runbook, security]
---

# Incident Response & Breach Notification Runbook

> **TL;DR (non-technical):** What to do, in order, when something goes wrong
> security-wise — who decides, who gets told, and by when. The single hardest
> deadline in here is GDPR's: if personal data is exposed, regulators must be
> told within **72 hours of becoming aware**, and that clock does not pause for
> weekends. Everything else in this document exists to make that deadline
> achievable rather than theoretical.

## Context / Scope

Closes gaps **G1** (no breach-notification runbook) and **G4** (no
incident-response runbook or drill cadence) from
[`../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md).

Satisfies: GDPR Art. 33/34, SOC 2 CC7.3–CC7.5, ISO/IEC 27001 A.5.24–A.5.28,
CSA STAR SEF-01…SEF-05, and the breach-notification clauses of the US state
privacy laws (see §7).

**Covers:** security incidents affecting `cf-admin` — the admin portal, its D1
and Supabase data, its Cloudflare bindings, and the credentials it holds.

**Does NOT cover:** availability-only incidents with no security dimension
(see [`disaster-recovery.md`](disaster-recovery.md)), or incidents confined to
the public site `cf-astro` — though note the two share a Supabase project, a D1
database and an R2 bucket, so an incident in one is presumed to affect the
other until proven otherwise (§3).

> **This runbook is untested.** It has never been exercised in a drill. The
> first tabletop is the outstanding action in §8 — until it is run, treat the
> timings here as estimates, not measurements. SOC 2 CC7.5 and ISO 27001 both
> ask for evidence the plan *works*, which is the drill, not the document.

## 1. Severity classification

Classify first: severity drives who is woken and which clocks start.

| Sev | Definition | Examples | Response starts |
|-----|------------|----------|-----------------|
| **SEV-1** | Confirmed unauthorised access to personal data, or full loss of a production system | Stolen `SUPABASE_SERVICE_ROLE_KEY`; RLS bypass reading `legal_requests`; admin account takeover | Immediately, any hour |
| **SEV-2** | Credible risk of data exposure, not yet confirmed | Leaked credential with unclear blast radius; auth bypass found in code; suspicious `api_authz_deny` spike | Within 1 hour, business hours |
| **SEV-3** | Security-relevant, no data at risk | Dependency CVE with no reachable path; failed-login brute force blocked by rate limiting | Next business day |
| **SEV-4** | Informational | Scanner noise; a single failed CF Access login | Logged, no response |

**When uncertain, classify UP.** A SEV-2 that is really a SEV-1 burns hours of
the 72-hour clock before anyone notices.

## 2. Roles

Single-operator platform, so one person holds every role — stated explicitly
because assessors ask, and because it is a real concentration risk.

| Role | Holder | Responsibility |
|------|--------|----------------|
| Incident Commander | harshil (owner) | Declares severity, owns the timeline, makes the notification call |
| Technical Lead | harshil | Containment, eradication, recovery |
| Privacy Lead | harshil | Art. 33/34 assessment, regulator and data-subject contact |
| Communications | harshil | Customer and stakeholder messaging |

**Known limitation:** no on-call rotation and no separation of duties. If the
sole operator is unavailable, response does not begin. Documented rather than
hidden — it is a real finding for SOC 2 CC1.3, and the mitigation (a named
deputy) is a business decision, not an engineering one.

## 3. Phase 1 — Detect & triage (target: within 1 hour of awareness)

**"Awareness" starts the GDPR clock.** Record the exact UTC timestamp at which
any person first had reason to believe personal data may have been exposed —
not when it was confirmed. Regulators measure from the former.

Detection sources, in the order they usually fire:

| Source | Where | Notes |
|--------|-------|-------|
| Sentry alert | `cf-admin` project | `[SECURITY ALERT]` fatal messages from `retention/purge.ts`, `users/manage.ts` |
| Audit log | D1 `admin_audit_log` | `api_authz_deny`, `api_mutation_attempt`, `login_failed` |
| CF Access logs | Zero Trust dashboard | Failed auth, unexpected geography |
| Supabase advisors | `get_advisors` MCP | RLS/policy drift |
| CI | `security.yml` | `audit_gate.py`, secret-scan |
| External report | email | Treat as credible until disproven |

Triage queries:

```sql
-- Authorization denials by path (fail-closed middleware)
SELECT request_path, user_email, COUNT(*) AS n
FROM admin_audit_log
WHERE action IN ('api_authz_deny','api_authz_shadow_deny')
  AND created_at > datetime('now','-24 hours')
GROUP BY request_path, user_email ORDER BY n DESC;

-- Everything one actor did
SELECT created_at, action, module, request_method, request_path
FROM admin_audit_log
WHERE user_email = ? ORDER BY created_at DESC LIMIT 500;
```

**Open an incident log immediately** — a plain timestamped file. Every
subsequent action gets a UTC timestamp. This log is the evidence artefact for
both the regulator and the SOC 2 auditor; reconstructing it afterwards is not
credible.

## 4. Phase 2 — Contain (target: within 4 hours for SEV-1)

Containment precedes investigation. Preserve evidence where possible, but never
delay containment to gather more.

1. **Revoke sessions.** `/dashboard/sessions` → force-kick. Layer 3 revocation
   uses `CF_API_TOKEN_ZT_WRITE`; KV revocation flags apply within 30 minutes at
   worst (`SESSION_REFRESH_INTERVAL_MS`), immediately on next request.
2. **Deactivate accounts.** Set `is_active = false` in
   `admin_authorized_users`. The middleware re-checks role and active state
   every 30 minutes and destroys the session on failure
   (`src/lib/auth/pipeline.ts`).
3. **Rotate credentials** — order matters, most privileged first:
   `SUPABASE_SERVICE_ROLE_KEY` → `CF_API_TOKEN_ZT_WRITE` →
   `CLOUDFLARE_API_TOKEN` → `CF_API_TOKEN_READ_LOGS` → `IP_HASH_SECRET` (see
   caveat below) → `RESEND_API_KEY` / `BREVO_API_KEY` →
   `CHATBOT_ADMIN_API_KEY` → `UPSTASH_REDIS_REST_TOKEN`.
   `wrangler secret put <KEY>`; full registry in
   [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §5.
   > **`IP_HASH_SECRET` caveat:** rotating it makes every previously stored IP
   > hash unlinkable to any new hash. That is good for privacy but destroys
   > correlation in the login-forensics trail. Rotate it only if the secret
   > itself is believed compromised, and record the rotation time in the
   > incident log so analysts know why hashes stop matching.
4. **Tighten the edge if under active attack.** Cloudflare security level →
   `under_attack` via `/dashboard/control-plane` or
   `POST /api/control-plane/cloudflare {"action":"set-security-level","level":"under_attack"}`.
5. **Cross-repo containment.** `cf-astro` and `cf-chatbot` share the Supabase
   project, the D1 database and the R2 bucket. A compromised
   `SUPABASE_SERVICE_ROLE_KEY` is compromised for all three — rotate and
   redeploy every consumer, not just this one.

## 5. Phase 3 — Assess (runs in parallel; must conclude before hour 60)

Answer, in writing:

1. **What data?** Map affected tables to categories using
   [`../security/RoPA.md`](../security/RoPA.md). `legal_requests` (ARCO tickets
   with identity documents) and `admin_login_logs` are the most sensitive.
2. **Whose data?** Count and identify data subjects; note jurisdictions — they
   determine which regulators apply (§7).
3. **Special categories?** Identity documents attached to ARCO requests are
   the realistic worst case and raise the risk assessment materially.
4. **Was it actually accessed, or merely accessible?** Exposure and access are
   different findings and lead to different notification outcomes.
5. **Is it contained?** Ongoing exposure changes the risk calculus.

## 6. Phase 4 — GDPR Art. 33/34 notification decision

```
Personal data breach?  ──no──▶ Log, close, no regulator contact.
        │ yes
        ▼
Risk to rights/freedoms
 of natural persons?   ──unlikely──▶ Document the reasoning. Still log
        │ likely                     internally (Art. 33(5) requires the
        ▼                            record even when you do not notify).
NOTIFY SUPERVISORY AUTHORITY
within 72h of AWARENESS
        │
        ▼
HIGH risk to individuals? ──yes──▶ ALSO notify each data subject
                                    without undue delay (Art. 34)
```

Art. 33(3) requires the notification to state: nature of the breach, categories
and approximate number of subjects and records, DPO/contact point, likely
consequences, and measures taken or proposed.

**A partial notification on time beats a complete one late.** Art. 33(4)
explicitly permits notifying in phases.

## 7. Notification targets & deadlines

| Regime | Trigger | Deadline | Notes |
|---|---|---|---|
| GDPR (EU/EEA) | Risk to rights/freedoms | **72h from awareness** | Lead authority by main establishment |
| UK GDPR | Same | 72h | ICO |
| **Mexico LFPDPPP** | Significant harm | Without delay | **The primary regime today** — see `../2026-06-16-business-viability-and-compliance-assessment.md` |
| CCPA/CPRA | Unencrypted personal info | Without unreasonable delay | California AG if >500 residents |
| Other US states | Varies (30–60d typical) | Varies | ~20 states; check per affected state |
| PIPEDA / Law 25 | Real risk of significant harm | ASAP | OPC + Commission d'accès (Québec) |
| Cloudflare / Supabase | Vendor-side involvement | ASAP | Support ticket |
| Affected customers | Contractual | Per contract | Check DPAs |

## 8. Phase 5 — Recover, and the drill obligation

Recovery: restore per [`disaster-recovery.md`](disaster-recovery.md), verify
integrity, monitor for recurrence, keep heightened logging for 30 days.

Post-incident review within **5 business days**: timeline, root cause (five
whys, no blame), what detection missed, and concrete follow-ups filed into
`../MAINTENANCE.md`.

**Drill cadence — currently outstanding.** SOC 2 CC7.5 and ISO 27001 A.5.24
require evidence the plan works.

| Drill | Frequency | Status |
|---|---|---|
| Tabletop: leaked service-role key | Annual | ❌ **Never run** |
| Credential-rotation walkthrough | Annual | ❌ Never run |
| Restore drill | Annual | ❌ Never run (see `disaster-recovery.md`) |

Until the first tabletop is complete, the honest external statement is *"we
have a documented incident-response plan; our first drill is scheduled"* — not
*"we have a tested plan."*

## 9. What we cannot currently do

Stated plainly, because an assessor will find these anyway:

- **No 24/7 on-call.** Out-of-hours SEV-1 detection depends on the operator
  seeing an alert.
- **No SIEM.** Correlation is manual across Sentry, D1 and CF Access logs.
- **No forensic snapshot capability.** D1 Time Travel provides point-in-time
  recovery, not an evidentiary image.
- **No cyber-insurance policy** and no pre-retained incident-response firm.
- **No named deputy** if the sole operator is unavailable.

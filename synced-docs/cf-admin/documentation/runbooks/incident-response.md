---

title: "Incident Response & Breach Notification Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-09-19
verified_against: [code, config, live-mcp]
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
`../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md` (private).

Satisfies: GDPR Art. 33/34, SOC 2 CC7.3–CC7.5, ISO/IEC 27001 A.5.24–A.5.28,
CSA STAR SEF-01…SEF-05, and the breach-notification clauses of the US state
privacy laws (see §7).

**Covers:** security incidents affecting `cf-admin` — the admin portal, its D1
and Supabase data, its Cloudflare bindings, and the credentials it holds.

**Does NOT cover:** availability-only incidents with no security dimension
(see [`disaster-recovery.md`](disaster-recovery.md)), or incidents confined to
the public site `cf-astro` — though note that cf-admin and cf-astro share a
Supabase project, the D1 database `madagascar-db` and the R2 bucket
`madagascar-images`, so an incident in one is presumed to affect the other
until proven otherwise (§4 step 5).

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
| **Sign-in alert email** | The sign-in alert list (Security → Sessions → Alert policy; the business inbox when the policy names nobody) | Two kinds are emailed as urgent whatever the account's own alert settings say: **"SIGN-IN WITHOUT GOOGLE"**, every sign-in made any way but Google, which is the emergency way in, and **"SIGN-IN MOVED"**, a sign-in first seen on one device and country now used on another, which is what a copied cookie looks like. Other sign-ins and failed sign-ins are emailed as the policy says (`src/lib/login-alerts/decide.ts`; the rules: [`../security/login-forensics.md`](../security/login-forensics.md)) |
| **Access-change email** | The same list | Every change that widens or reshapes who can do what: a role changed; a person added, suspended, restored or deleted; an Owner-level page given; a page's or a console permission's default role moved; Backups or Server permissions changed. One email per save, one summary a day at 08:00 in Aguascalientes, or off, as the alert policy's "Access changes emailed" says (`src/lib/access-changes/notify.ts`). A change nobody on the team made is an incident |
| **Audit log seal email** | The same list, each morning at 08:00 in Aguascalientes (14:00 UTC) | The fingerprint of the previous day of `admin_audit_log`, and the past week checked again; every morning, or only when a sealed day changed, as the alert policy says. **A "Warning: … of the audit log changed" email is the tamper signal:** sealed entries were changed or removed outside the portal, for example straight in the database. Check any day on Logs → Check seals (Owner and Vendor support). Engine `src/lib/audit-seal/`; what a seal proves: [`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.6 |
| Sentry alert | `cf-admin` project | `[SECURITY ALERT]` messages, emitted **only** by `src/pages/api/retention/purge.ts` (an unauthorized, PLAC-denied or deactivated-actor purge) |
| Audit log | D1 `admin_audit_log` | `api_authz_deny`, `api_mutation_attempt`; `view` rows for who opened someone's sign-in history, a consent record's details or an email message's body. The portal cannot delete an entry younger than 180 days |
| **Login logs** | D1 `admin_login_logs` | **Failed logins live here, not in the audit log.** `event_type` is one of `LOGIN_SUCCESS` / `LOGIN_FAILED` / `LOGIN_BLOCKED`, with a `failure_reason`; `cf_identity_provider` says how a sign-in was made, and `alert` what became of its alert email. There is no `login_failed` audit action anywhere in `src/`: querying the audit log for one returns nothing and looks like "no brute force" |
| CF Access logs | Zero Trust dashboard | Failed auth, unexpected geography |
| Supabase advisors | `get_advisors` MCP | RLS/policy drift |
| CI | `quality.yml` | `audit_gate.py`, secret-scan, `rules_check.py` |
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

-- Failed-login triage — a DIFFERENT table (see the detection sources above)
SELECT email, event_type, failure_reason, COUNT(*) AS n, MAX(created_at) AS last_seen
FROM admin_login_logs
WHERE event_type IN ('LOGIN_FAILED','LOGIN_BLOCKED')
  AND created_at > datetime('now','-24 hours')
GROUP BY email, event_type, failure_reason ORDER BY n DESC;
```

**Open an incident log immediately** — a plain timestamped file. Every
subsequent action gets a UTC timestamp. This log is the evidence artefact for
both the regulator and the SOC 2 auditor; reconstructing it afterwards is not
credible.

## 4. Phase 2 — Contain (target: within 4 hours for SEV-1)

Containment precedes investigation. Preserve evidence where possible, but never
delay containment to gather more.

1. **Sign the person out.** Users → the person → **Sign out everywhere**
   (`DELETE /api/users/force-kick`). It needs the Users page and its own key,
   `/dashboard/users#force-kick`, granted exactly: the Owner and Vendor support
   hold it, anyone else only once it is granted on their Access page (since
   2026-10-15). Below Owner and Vendor support you can sign out only people
   below your role. **Security → Sessions** (the `#revoke` key) offers **End
   session** for one device, and **Lock out**, which signs the person out and
   suspends the account (step 2). Each of these, except ending one of your own
   sessions, needs a sign-in from the last 10 minutes: when the portal asks you
   to confirm it is you, sign out, sign in again and repeat.

   A sign-out has three layers (`forceLogoutUser`, `src/lib/auth/plac.ts`): a
   `revoked:<userId>` mark in KV for 24 hours, written *before* the sessions are
   deleted; every KV session deleted; and the person's Cloudflare Access
   sessions revoked at the edge through `CF_API_TOKEN_ZT_WRITE`. **It applies on
   the next request:** `revoked:<userId>` and `revoked-session:<sessionId>` are
   read on every warm request in a single bulk KV get and end the session on the
   spot (`src/lib/auth/stages/session-stage.ts`). The `revoked:` mark also
   refuses a new sign-in for its 24 hours (`src/lib/auth/stages/bootstrap.ts`);
   after that the person can sign in again, so for a compromised account do
   step 2 as well.
2. **Suspend the account.** Users → the person → **Suspend**
   (`PATCH /api/users/manage` with `is_active: false`; `applyUserUpdate` in
   `src/lib/users/manage-apply.ts`). One action does all of it:
   `is_active = false` in Supabase `admin_authorized_users`; every session ended
   by the same three-layer sign-out as step 1; an `authz-changed:` mark, so a
   session still open re-checks on its next request; an activity-log row; an
   access-change email to the alert list; and the Cloudflare Access group of
   authorised users synced without them. It needs the Users page, a role above
   theirs (Vendor support may suspend anyone), and a sign-in from the last
   10 minutes. Suspending the last active Owner waits for a second person (the
   two-person rule). Sessions → **Lock out** makes the same suspension from the
   Sessions page, where the Owner and Vendor support reach everyone. **Suspend,
   do not remove:** removing a person waits for a second person whenever someone
   else could approve it.

   If the portal itself cannot be used, set `is_active = false` in
   `admin_authorized_users` directly, and expect it to be slower: no mark is
   written, so the middleware sees it at its next re-check of role and active
   state, every `SESSION_REFRESH_INTERVAL_MS` (30 min,
   `src/lib/auth/stages/refresh-role.ts`), and the Cloudflare Access group
   follows at the hourly Access list sync (`cf-access-reconcile`).

   > **Outage grace:** if Supabase is *also* unwell, the re-check reports and
   > then lets the session proceed on its last good verification for up to
   > **two** intervals. Containment by `is_active = false` can therefore take
   > ~60 minutes when the directory is degraded. If that is not fast enough,
   > use step 1: revocation does not consult Supabase.
3. **Rotate credentials** — order matters, most privileged first:
   `SUPABASE_SERVICE_ROLE_KEY` → `CF_API_TOKEN_ZT_WRITE` →
   `CLOUDFLARE_API_TOKEN` → `CF_API_TOKEN_READ_LOGS` → `IP_HASH_SECRET` (see
   caveat below) → `RESEND_API_KEY` / `BREVO_API_KEY` →
   `CHATBOT_ADMIN_API_KEY`. (`UPSTASH_REDIS_REST_TOKEN` closed this list until
   2026-10-04; cf-admin no longer reads it, so rotate it in the services that do,
   cf-astro and cf-chatbot, and delete it here: `../MAINTENANCE.md` (private) RU-1.)
   `wrangler secret put <KEY>`; full registry in
   [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §5.
   > **`IP_HASH_SECRET` is the most consequential rotation in this list.**
   > It is not only the IP pseudonymisation key — it is the **HKDF root for
   > four token families**: share links, file-request links, storage passcodes
   > and RFC 8058 unsubscribe tokens
   > ([`public-share-links-domain-isolation.md`](public-share-links-domain-isolation.md) §3).
   > Rotating it:
   >
   > - breaks correlation with every IP hash already written to
   >   `storage_share_access_logs`, `admin_audit_log` and the login logs;
   > - **invalidates every live share link and file-request link** — they must
   >   be re-issued, and the recipients are external parties;
   > - invalidates every stored passcode that has not yet upgraded-on-use;
   > - **breaks the unsubscribe link in every email already sent**, which is a
   >   CAN-SPAM/CASL exposure and a Gmail/Yahoo deliverability penalty, not a
   >   broken link.
   >
   > So: rotate only if the secret itself is believed compromised; plan the
   > re-issuance before rotating, not after; and record the rotation time in
   > the incident log so analysts know why hashes stop matching.
4. **Tighten the edge if under active attack.** Cloudflare security level →
   `under_attack` via `/dashboard/control-plane` or
   `POST /api/control-plane/cloudflare {"action":"set-security-level","level":"under_attack"}`.
5. **Cross-repo containment.** The neighbours share different things, and the
   rotation scope differs accordingly:
   - **`cf-astro`** shares the Supabase project, the D1 database
     `madagascar-db` **and** the R2 bucket `madagascar-images`. A compromised
     `SUPABASE_SERVICE_ROLE_KEY` is compromised for it too — rotate and
     redeploy both.
   - **`cf-chatbot`** is reached over a **service binding**, not shared
     storage: it has its own D1 (`chatbot-kb`) and no shared R2. Its scope is
     its own copy of the Supabase key plus `CHATBOT_ADMIN_API_KEY`, which must
     be set to the same value in both Workers in one sitting.
   - **The consoles** (`cf-backup`, `cf-vps` and the email API's Console) are
     reached only over service bindings. `cf-backup` also reads and writes the
     shared D1 database `madagascar-db`. `CONSOLE_SIGNING_KEY`, once set, is the
     same value in cf-admin and in each console that checks it: set the new
     value in cf-admin first, then in each console, in one sitting, because a
     console whose key differs refuses every request.

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
   different findings and lead to different notification outcomes. The
   activity log's `view` rows (§3) say who opened someone's sign-in history, a
   consent record's details or an email message's body
   (`src/lib/audit-views.ts`); ARCO identity documents have no viewer in the
   portal, so no row records a look at them.
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
| **Mexico LFPDPPP** | Significant harm | Without delay | **The primary regime today** — see `../commercial/analyses/2026-06-16-business-viability-and-compliance-assessment.md` |
| CCPA/CPRA | Unencrypted personal info | Without unreasonable delay | California AG if >500 residents |
| Other US states | Varies | Varies | **All 50 states, DC and the territories have breach-notification statutes**; roughly 20 set a numeric 30–60 day deadline. The absence of a numeric deadline is not the absence of a duty — check every affected state |
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
| Restore drill | — | **Owned by [`disaster-recovery.md`](disaster-recovery.md) §8 — read the status there, do not restate it.** (In short as of 2026-09-19: automated, blocked on an owner action, never yet succeeded.) |

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

## 10. Verification log

| Date | Method | Result |
|---|---|---|
| 2026-10-16 | claude: `src/pages/api/users/force-kick.ts`, `src/lib/auth/surface-guards.ts` (`denyForceKick`, `denySessions`), `src/lib/auth/guard.ts` (`placRequireGrant`), `src/pages/api/users/manage.ts` (PATCH), `src/lib/users/manage-apply.ts` (`applyUserUpdate`, `updateClearance`), `src/lib/approvals/ask.ts` and `rules.ts` (`kindForPersonChange`), `src/pages/api/sessions/active-sessions.ts` and `flush-sessions.ts`, `src/components/admin/users/PersonDrawer.tsx`, `src/lib/auth/plac.ts` (`forceLogoutUser`), `stages/session-stage.ts`, `stages/bootstrap.ts`, `stages/refresh-role.ts`, `src/lib/auth/fresh-sign-in.ts`, `src/lib/login-alerts/decide.ts` and `dispatch.ts`, `src/lib/auth/security-logging.ts`, `src/lib/access-changes/notify.ts`, `src/lib/audit-seal/mail.ts`, `src/pages/api/audit/seals.ts`, `src/lib/login-alerts/policy.ts`, `src/lib/audit-views.ts`, `src/lib/console-signature.ts`; the `cf-access-reconcile` interval read live (D1 connector, `cron-control`: 60 minutes); cf-backup `wrangler.json` | §3: rows for the sign-in alert, access-change and audit-seal emails, `view` rows and the login logs' method and alert columns. §4 step 1 rewritten for Users → Sign out everywhere (`#force-kick`, since `b78965c`) and the Sessions actions, the 10-minute sign-in and the 24-hour sign-in block; step 2 rewritten for Users → Suspend and Sessions → Lock out (what one suspension does, the two-person rule), with a direct database edit as the slower fallback; step 5 gains the consoles and `CONSOLE_SIGNING_KEY`; §5 step 4 names the `view` rows. Not re-checked: step 3's rotation order and the `IP_HASH_SECRET` caveat, §1, §2, §6 to §9, the legal deadlines in §7 |
| 2026-10-07 | `wrangler.toml` `[secrets] required` read (no `UPSTASH_*` name; the 2026-10-04 comment says they left it); `grep -rn UPSTASH src/` (no match: nothing reads either secret) | The secret-rotation list (changed 2026-10-04): cf-admin no longer reads `UPSTASH_REDIS_REST_TOKEN`. Nothing else re-checked |
| 2026-09-19 | `grep -rn "SECURITY ALERT" src/`; `grep -rn login_failed src/`; `admin_login_logs` schema and `event_type` values queried live; `src/lib/auth/stages/refresh-role.ts` and `stages/session-stage.ts` read; `public-share-links-domain-isolation.md` §3; `wrangler.toml` service bindings | §3's failed-login triage pointed at the wrong table — corrected to `admin_login_logs` (`event_type`, `failure_reason`) with a working query; `users/manage.ts` dropped from the `[SECURITY ALERT]` sources; §4's revocation timing, the `refresh-role.ts` path and its two-interval outage grace corrected; the `IP_HASH_SECRET` caveat expanded to the four token families; cf-chatbot separated from the shared-store list; the restore-drill row handed to `disaster-recovery.md` §8. Not re-checked: the legal deadlines in §7 beyond GDPR/CCPA (not a legal review) |

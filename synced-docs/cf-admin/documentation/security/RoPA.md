---

title: "Record of Processing Activities (GDPR Art. 30)"
status: active
audience: [owner, operator, technical, ai]
last_verified: 2026-09-20
verified_against: [code, config]
owner: harshil
related_docs: [PRIVACY.md, SECURITY.md, THREAT-MODEL.md, ../runbooks/incident-response.md, compliance/data-residency.md, ../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md]
related_code: [src/lib/retention-tables.ts, src/lib/audit-helpers.ts, src/lib/auth/login-event.ts, src/workers/scheduled-asset-cleanup.ts]
tags: [gdpr, ropa, privacy, article-30, lfpdppp, compliance]
---

# Record of Processing Activities (RoPA)

> **TL;DR (non-technical):** The formal inventory GDPR Article 30 requires: what
> personal data this platform holds, why, on what legal basis, who it is shared
> with, where it lives, and how long it is kept. A regulator can demand this
> document at any time and expects it to already exist — it is one of the first
> things asked for after a breach.

## Context / Scope

Closes gap **G2** from
[`../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md).
Also serves ISO/IEC 27701 and the equivalent inventory duties under Mexico's
LFPDPPP, which is this platform's primary regime today.

**Covers** processing performed by `cf-admin` (this repository).
**Does NOT cover** processing performed by the public site `cf-astro` or the
`cf-chatbot` Worker, except where they share a store — noted per row. Those
repositories need their own entries for a complete group-level RoPA.

## 1. Controller identity

| Field | Value |
|---|---|
| Controller | Madagascar Pet Hotel |
| Contact | `mascotasmadagascar@gmail.com` |
| Technical contact | harshil |
| DPO | **Not appointed.** Assessed as not mandatory under Art. 37 — no large-scale systematic monitoring and no large-scale special-category processing. Several non-EU regimes (Law 25, LGPD, PDPA) do require a named privacy officer, so this becomes an action the moment those markets are pursued. |
| EU/UK representative | **Not appointed** (Art. 27). Required if EU/UK data subjects are targeted without an EU establishment. |

## 2. Processing activities

### A. Administrative access control

| Field | Detail |
|---|---|
| Purpose | Authenticate and authorise staff; enforce RBAC/PLAC |
| Categories of subject | Staff, contractors |
| Categories of data | Email, display name, role, CF Access subject ID, active/hidden flags, per-page overrides |
| Legal basis | Art. 6(1)(b) contract; 6(1)(f) legitimate interests (securing the system) |
| Stores | Supabase `admin_authorized_users`; D1 `admin_page_overrides`, `admin_pages` |
| Retention | Life of the working relationship, then deletion on request |
| Recipients | Cloudflare (Zero Trust identity), Supabase |

### B. Security audit logging

| Field | Detail |
|---|---|
| Purpose | Detect and investigate unauthorised access; produce evidence for incident response and assessors |
| Categories of subject | Staff |
| Categories of data | User ID/email/role, action, module, request method and path, CF-Ray ID, session ID, timestamps. IP handling differs per store — see §2.1 |
| Legal basis | Art. 6(1)(f) legitimate interests — security monitoring |
| Stores | D1 `admin_audit_log` (mutation trail), `admin_login_logs` (sign-in forensics), KV session records (live sessions only) |
| Retention | Per-table targets in `src/lib/retention-tables.ts`: `admin_audit_log` **180 days**, `admin_login_logs` **365 days**. Both are *targets* — deletion happens only when an Owner/DEV runs the Retention Review tool, so actual age can exceed the target. KV session records expire with the session (24 h TTL) |
| Safeguards | `admin_audit_log` stores a keyed hash of the IP and no raw column. `admin_login_logs` stores the **raw** client IP by design (forensics) — see §2.1. Insert-only application paths; deletion is PLAC-gated and audited, but not prevented (`../architecture/plac-and-audit.md` §3.2) |

### C. Data-subject-rights (ARCO) request handling

| Field | Detail |
|---|---|
| Purpose | Receive, track and fulfil access/rectification/erasure/objection requests within statutory deadlines |
| Categories of subject | Customers, website visitors, any data subject who files |
| Categories of data | Full name, email, phone, request description, **identity document** (MIME type and size recorded; the document itself is the most sensitive item this platform touches), ticket number, status |
| Legal basis | Art. 6(1)(c) legal obligation (Art. 15–17); LFPDPPP ARCO |
| Stores | Supabase `legal_requests` (ticket, contact details, `identity_doc_mime`/`identity_doc_size` only); **the identity document itself lives in cf-astro's R2 bucket** and is retrieved through a cf-astro endpoint behind an admin secret header — `cf-admin` never holds the file. `privacy_requests` was quarantined on 2026-09-16 (renamed `zz_dead_privacy_requests_20260916`) and holds no live processing |
| Retention | 3 years — evidentiary. Test-pinned so it cannot be shortened unnoticed (`test/retention-invariants.test.ts`) |
| Safeguards | **Open tickets can never be purged** — enforced by the `terminalStatuses` gate and covered by tests. SLA deadlines computed at 20 + 15 business days (`src/lib/arco/sla.ts`, 24 tests). |

### D. Consent records

| Field | Detail |
|---|---|
| Purpose | Evidence of cookie/privacy consent and its withdrawal |
| Categories of subject | Website visitors (collected by `cf-astro`) |
| Categories of data | Consent type, granted flag, timestamp, email, user agent, IP-derived city/region/country, a device fingerprint block (screen size, bot-detection flags, ASN/colo/TLS, Turnstile result), interaction telemetry (time on page, cursor travel), session and trace IDs, CF-Ray, and an `accessibility_accommodation` field. **That last field may be health-adjacent and has not been assessed under Art. 9 — owner/counsel action.** |
| Legal basis | Art. 7(1) — demonstrating consent |
| Stores | Supabase `consent_records` (the record); D1 `consent_attempts` (dead-letter recovery log written by the consent flow — **raw** IP and UA, 90-day target) |
| Retention | `consent_records` 3 years, `consent_attempts` 90 days (`src/lib/retention-tables.ts`) — both manual |
| Note | **Written by `cf-astro`, read here.** `cf-admin` provides the audit surface, not the collection point. GPC (`Sec-GPC`) is detected here (`src/lib/security/gpc.ts`) but consumer-facing enforcement belongs to `cf-astro` — see `compliance/data-residency.md`. |

### E. Customer inquiries & bookings

| Field | Detail |
|---|---|
| Purpose | Respond to enquiries; operate pet-boarding bookings |
| Categories of subject | Customers |
| Categories of data | Name, email, phone, message, locale, booking dates, pet details, internal staff notes |
| Legal basis | Art. 6(1)(b) contract; 6(1)(f) for enquiry handling |
| Stores | Supabase `contact_messages`, `contact_message_comments`, `bookings`, `booking_pets`; D1 `admin_booking_state`, `booking_attempts` (dead-letter recovery log — **raw** `request_ip`, UA, owner email and the request body) |
| Retention | `booking_attempts` 90-day target (manual); bookings for the commercial relationship |
| Note | **Pet health data is NOT human health data** — not Art. 9 special category, and not PHI under HIPAA. |

### F. Transactional & marketing email

| Field | Detail |
|---|---|
| Purpose | Send booking confirmations and operational email; record delivery |
| Categories of subject | Customers, staff |
| Categories of data | Recipient address, subject, body, attachments, delivery status, **hashed** sender IP |
| Legal basis | Art. 6(1)(b) contract (transactional); 6(1)(a) consent (marketing) |
| Stores | Supabase `email_audit_logs` (hashed sender IP — `src/pages/api/emails/send.ts`); D1 `admin_email_drafts`, `admin_email_templates`, `admin_email_suppression` (unsubscribe list — address plus hashed IP); R2 `email-attachments/` |
| Retention | 365-day target on `email_audit_logs`, manual. The suppression list is kept indefinitely — it is the record that proves an opt-out was honoured |
| Recipients | **Brevo** carries transactional, marketing and security-alert mail — the default path. **Resend** carries only staff invite emails and a diagnostics ping (`src/pages/api/users/resend-invite.ts`) |
| Known gap | **Closed 2026-09-10.** `List-Unsubscribe` and `List-Unsubscribe-Post` are emitted (`src/lib/email/unsubscribe.ts`) and the suppression list ships. G5 is closed in code; confirm the header on a real Brevo send before citing it to an auditor. *This row said "still open" while §6 said closed — corrected 2026-09-20.* |

### G. AI-assisted content generation

| Field | Detail |
|---|---|
| Purpose | Draft marketing email copy and blog content from a staff prompt (`src/pages/api/content/ai-generate.ts`, `src/pages/api/content/blog/suggest.ts`, `src/pages/api/emails/ai-generate.ts`) |
| Categories of subject | Staff (prompt author) |
| Categories of data | Prompt text, generated output, token usage |
| Legal basis | Art. 6(1)(f) legitimate interests |
| Recipients | Cloudflare Workers AI; **OpenRouter** when an `openrouter/*` model is selected — a cross-border transfer to a third party |
| Safeguards | Model IDs constrained to the `AI_MODELS` catalogue or a bounded `openrouter/<vendor>/<model>` pattern; prompt capped at 2000 chars; prompt-injection keyword screen |
| Note | Full inventory in `compliance/AI-GOVERNANCE.md` |

### H. Retained data from a superseded product version — pending decommission

Recorded 2026-07-29. This activity is **not** a live processing operation; it is disclosed
because an Art. 30 register that omits a store of personal data is a finding whether or not
that store is still in use.

| Field | Detail |
|---|---|
| Purpose | None ongoing. Residual data from an earlier product version, retained pending export and disposal |
| Status | **Dormant.** No application, worker or API connects to it. Most recent write 2026-06-22; most tables last written between February and April 2026 |
| Location | A separate, superseded Supabase project in a US region. Its identifiers are held with the disposal task in [`../MAINTENANCE.md`](../MAINTENANCE.md), not here |
| Categories of subject | Staff/administrators of the earlier version; data subjects who submitted consent or ARCO requests to it |
| Categories of data | 37 tables of operational history — email delivery logs, admin audit and permission logs, forensic access logs, consent receipts, session and login-attempt records, administrator accounts — and **2 `legal_requests` rows (ARCO requests, PII)**, which are the reason this activity is registered at all |
| Legal basis for retention | Art. 6(1)(c) / Art. 17(3)(b) — retention pending verification that no outstanding data-subject obligation attaches to the ARCO rows, then disposal |
| Known weaknesses | A security-advisor sweep on 2026-07-29 returned two orders of magnitude more findings than the production project, across database-level authorisation and function hardening. **This store does not meet the standard claimed for the production database and no assurance about it should be given to anyone.** It is still unremediated, so the finding detail is held in the private backlog ([`../MAINTENANCE.md`](../MAINTENANCE.md)) rather than in this published record — the fix is disposal, not hardening |
| Owner decision | Superseded version, not connected to any production or testing environment. Data to be exported for safekeeping, then the project decommissioned once the client approves. Recorded 2026-07-29; re-confirmed 2026-09-16 (leave dormant for now) |
| Disposal method | Export → verify the two `legal_requests` rows carry no outstanding obligation → record the disposal in `deletion_audit` (currently 0 rows) → delete the project |
| Action outstanding | **Export before pausing.** Pausing a Supabase project makes its data inaccessible until restored, so pausing ahead of the export would block the export it is meant to protect. Sequence matters. |

### I. Staff Managed Storage (personal & shared file drives)

| Field | Detail |
|---|---|
| Purpose | Give staff a private file drive for work documents (payroll, medical records, contracts, media) and let external parties (vendors, vets) exchange files without a portal account |
| Categories of subject | Staff, contractors, external vendors/vets (link recipients, no account) |
| Categories of data | Uploaded file content and metadata (filename, size, extension, folder path, MIME type); recipient name/email on File Request links; access telemetry (hashed IP, user agent, CF country, timestamp, attempt status) on share/request links |
| Legal basis | Art. 6(1)(b) contract (employment-relationship recordkeeping); 6(1)(f) legitimate interests (operational file sharing with vendors) |
| Stores | R2 `madagascar-staff-storage` (private bucket, object content); D1 `storage_files`, `storage_file_requests`, `storage_share_access_logs`. Storage settings live under the `storage-config` key of `admin_portal_settings` — there is no `storage_config` table |
| Retention | Files persist until deleted by the owner or an `#admin-manage` grantee. Soft-deleted files are recoverable in Trash for 30 days (`TRASH_RETENTION_DAYS`), after which the weekly reconciliation cron becomes free to purge the underlying R2 object. Share/file-request access logs are deleted **automatically** at 180 days by the weekly cron (`src/workers/scheduled-asset-cleanup.ts`) — the one store on this register with a working automatic purge |
| Recipients | None outside Cloudflare, unless a staff member deliberately mints a share link or File Request link — both are HMAC-signed, time-boxed, optionally passcode-gated, and every access attempt is telemetry-logged regardless of outcome |
| Safeguards | This is the one deliberate exception to full Cloudflare Zero Trust gating in the portal: two public, unauthenticated route families (`/api/storage/share/*`, `/api/storage/request/*`) exist for external parties. Both were remediated for a reflected-XSS-to-session-takeover chain, an upload passcode-enforcement bypass, and non-timing-safe comparisons in the 2026-08 security pass — see [`THREAT-MODEL.md`](THREAT-MODEL.md). Uploads are magic-byte verified against the declared extension; per-role storage quotas enforced server-side; all mutating endpoints rate-limited |
| ⚠️ Known gap | R2 object versioning **not enabled** on `madagascar-staff-storage` — a bucket that can hold payroll/medical records arguably needs it more than `madagascar-images` (already flagged). Tracked in `../MAINTENANCE.md` |

### J. Disaster-recovery backups (cf-backup — built 2026-09-23; no production backup has run through it yet)

| Field | Detail |
|---|---|
| Purpose | Restore the platform's databases after loss or corruption, and prove each backup restores (restore drills) |
| Categories of subject | Everyone whose data is in the backed-up databases (customers, pet owners, staff); staff also as the people who start, cancel or prune backups |
| Categories of data | Full copies of the D1 databases and of the Supabase `public` schema (customer names, emails and phones, pet records, consent evidence, staff accounts, admin sign-in IPs). Run records: the requesting staff member's sign-in email and role, an optional reason, timestamps, sizes and outcomes. Run evidence is free of personal data by policy (plan of record doc 11 §4) |
| Legal basis | Art. 6(1)(f) legitimate interests — availability and integrity of the service (Art. 32(1)(c)) |
| Stores | Cloudflare R2 (the private backups bucket: encrypted archives, run evidence, and cf-backup's action records under `v1/ops/`, which name the acting staff member's sign-in email and are bucket-locked for 90 days); D1 `backup_runs` (run records); the backup key's private half in Supabase Vault. **Since 2026-09-24:** Supabase `email_audit_logs`, one row per backup alert email (the recipient addresses, the subject and the alert text), written by cf-admin's `backup-tick` job (`src/workers/scheduled-backup-tick.ts`, `emailLogRow`) and listed in the Email Portal's queue logs |
| Retention | Archives: the owner's bucket locks set the minimum (plan: 30 days for daily, 90 days for full); deletion beyond that is manual, through the console's prune action, which never removes the newest four good full backups. `backup_runs` rows are kept (about 400 a year); pruning marks a run, it does not delete the row. The alert rows in `email_audit_logs` follow activity F's 365-day manual target |
| Recipients | GitHub-hosted runners (US) process the data in transit while a backup or drill runs and keep nothing afterwards. **Since 2026-09-24**, backup alert emails leave through activity F's path (`EMAIL_QUEUE`, cf-email-consumer, the email provider) to the alert recipients set in the console (Settings → Alerts). Their text can name the staff member who acted (a data download, a key action, an access, schedule or prune change) and the daily digest lists console actions by the acting staff member's email; no backup data is ever in an email |
| Safeguards | Every archive is encrypted to a public key before it leaves the runner, with the private half held at a second provider; cf-backup has no public address and is reached only through cf-admin's gateway; every change made through the console is audited (`admin_audit_log`, module `backup`) |

### 2.1 IP addresses at rest — per store

The register previously claimed IPs are "never stored raw". That is false and was
corrected on 2026-09-20. `hashIp()` (`src/lib/audit-helpers.ts`) is real and is used
in the stores marked *hashed* below; it is **not** used by the login forensics log,
which records the raw address deliberately so that a sign-in can be investigated.

| Store | IP at rest | Retention |
|---|---|---|
| D1 `admin_audit_log` | Hashed — HMAC-SHA-256 keyed with `IP_HASH_SECRET`; no raw column exists | 180-day target, manual |
| D1 `admin_login_logs` | **Raw**, alongside latitude, longitude, postal code, ASN and user agent | 365-day target, manual |
| D1 `consent_attempts`, `booking_attempts` | **Raw** (`ip_address` / `request_ip`) | 90-day target, manual |
| D1 `storage_share_access_logs` | Hashed | 180 days, **automatic** |
| D1 `admin_email_suppression` | Hashed | Indefinite |
| Supabase `email_audit_logs` | Hashed sender IP | 365-day target, manual |
| KV session records | **Raw** `ipAddress`, plus a derived `ipHash` used for audit rows | Session lifetime (24 h TTL) |
| Upstash rate-limit keys | **Raw** client IP on the session-less routes (logout, the Brevo webhook, the four public storage routes); internal user UUIDs elsewhere | Sliding window (minutes to hours) |

Practical consequence for a data-subject request or a breach assessment: a raw IP
is recoverable from the login log, the two dead-letter tables and any live KV
session, so those stores are in scope for Art. 15 and Art. 34 and must be searched.
`IP_HASH_SECRET` is **also** the HKDF root for the share-link, file-request,
passcode and unsubscribe signing keys (`src/lib/storage/share-token.ts`), so
rotating it does not only make historical hashes unlinkable — it invalidates every
live share link, file-request link, stored passcode hash and unsubscribe link.
Treat rotation as a breaking change, not a privacy hygiene step.

## 3. Sub-processors

| Sub-processor | Purpose | Data | Region |
|---|---|---|---|
| Cloudflare | Hosting, Zero Trust identity, D1, KV, R2, Queues, Workers AI | All | US (see §4) |
| GitHub | Actions runners that take, encrypt and restore-test backups (cf-backup) | Database contents in transit, encrypted before upload; nothing kept after a run | US |
| Supabase | Postgres | Users, ARCO, consent, bookings, email ledger | US |
| Brevo | Email delivery — transactional, marketing and security alerts | Recipient addresses, content | EU (France) |
| Resend | Email delivery — staff invites and a diagnostics ping only | Staff addresses, invite content | US |
| Upstash | Rate-limit counters | **Raw client IPs** (short-TTL keys) on session-less routes; internal user UUIDs elsewhere | US |
| Sentry | Error tracking | Scrubbed traces — `sendDefaultPii: false` + PII scrubber | US |
| PostHog | Product analytics | Usage events; read back through the admin API for the control-plane surface | US |
| Google | Search Console API (`GSC_SERVICE_ACCOUNT_JSON`) and PageSpeed Insights (`PAGESPEED_API_KEY`) | Public site and page URLs, sitemap and index-coverage data — no personal data. Google is also an IdP option in front of Cloudflare Access, where it sees staff sign-in identity | US |
| OpenRouter | AI inference (optional) | Prompt text | Varies by model |

Cloudflare Workers AI is a Cloudflare service and is covered by the Cloudflare row;
it is listed separately in `compliance/AI-GOVERNANCE.md` because the AI governance
inventory is organised by model, not by vendor.

## 4. International transfers

All primary stores are **US-region**. For EU data subjects this is a third-
country transfer requiring Art. 46 safeguards — Standard Contractual Clauses,
which Cloudflare and Supabase both offer in their DPAs.

**No EU-region deployment exists today.** This is audit gap **G17** and the
single hardest blocker for EU public-sector and residency-sensitive buyers. See
[`compliance/data-residency.md`](compliance/data-residency.md).

## 5. Technical & organisational measures (Art. 32)

Summarised; full detail in [`SECURITY.md`](SECURITY.md).

- Encryption in transit (TLS 1.3, HSTS preload) and at rest (vendor-managed).
- Identity at the Cloudflare edge (Zero Trust); authorisation via RBAC + PLAC,
  **fail-closed** on `/api/*` since **2026-08-12**, when `API_DENY_MODE` was
  flipped from `shadow` to `enforce`. The code shipped on 2026-07-25 but only
  recorded what it *would* have blocked until that flip.
- Supabase `anon` role holds zero table grants and zero RLS policies. Function
  EXECUTE is revoked on four of the six public functions; two remain callable by
  `anon` and `authenticated` (live check 2026-09-20). Neither is
  `SECURITY DEFINER`, and `anon` has no table grants, so the body fails on table
  access — a posture defect with a REVOKE migration outstanding, not a live
  exposure path. Detail in [`SECURITY.md`](SECURITY.md) §10.3.
- Sessions: 30-minute role re-check, 24-hour hard expiry, revocation flags, and
  an authorisation-change mark that makes a permission change take effect on the
  user's next request without signing them out (since 2026-09-16).
- Audit trail on every privileged mutation, written through an insert-only
  application path with actor, role, path and hashed IP. It is **not** immutable
  or tamper-evident: an Owner or vendor can delete rows, and anyone with
  Cloudflare API access can run SQL against the table
  ([`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.2).
  Raw IPs are held in the stores listed in §2.1.
- Input validation on 100% of API routes accepting a JSON body.
- CSP with per-request nonces; `unsafe-eval` removed 2026-07-25.
- CI gates: blocking `npm audit` with expiring exceptions, secret scanning,
  11 code-anchored security rules (SEC-01…10 plus SEC-01b), typecheck/lint/test/build.
  These run in `npm run verify` and the Docs/Quality workflows. They gate the
  development path, **not** the production deploy — Cloudflare Workers Builds
  runs its own default build command, so a red gate does not stop a release.

## 6. Known gaps

| Gap | Impact | Tracked |
|---|---|---|
| No DPO / EU representative | Required if EU targeting begins | This doc §1 |
| No EU data residency | Art. 46 SCC reliance; blocks some buyers | G17 |
| ~~No `List-Unsubscribe` / suppression list~~ — **closed 2026-09-10**: the Emails portal ships a suppression list (`admin_email_suppression`) and emits `List-Unsubscribe` (three call sites in `src/`, re-checked 2026-09-14). Confirm the header on a real Brevo send before citing it to an auditor | CAN-SPAM, CASL, deliverability | G5 (closed in code) |
| GPC enforcement lives in `cf-astro` | Detection only here | G6 (partial) |
| No working backup, so no tested DR restore | Art. 32(1)(c) resilience unproven. The backup workflow shipped 2026-09-15 but has never completed a green run — its repository secrets are not set | G3 |
| IR plan never drilled | Art. 33 readiness unproven | G1/G4 |
| Audit log is deletable and has no tamper-evidence | Art. 32 integrity: an Owner or vendor can delete the evidence of their own actions, and the log was bulk-cleared on 2026-09-18. No hash chain, sequence number or WORM copy | [`../specs/2026-09-06-audit-log-remediation-design.md`](../specs/2026-09-06-audit-log-remediation-design.md); `../MAINTENANCE.md` C-9 |
| Raw IPs held in four D1 stores and in KV sessions | Data minimisation (Art. 5(1)(c)) and Art. 15/34 search scope — see §2.1 | This doc §2.1 |
| Manual-only retention | Every target in `src/lib/retention-tables.ts` except the storage access logs requires an Owner to run the Retention Review tool, so "365 days" is an intention, not a control | This doc §2.1 |
| Function EXECUTE not fully revoked | 2 of 6 public Postgres functions are still executable by `anon`/`authenticated`. Not exploitable today (neither is `SECURITY DEFINER`, and `anon` has no table grants) but it defeats the defence-in-depth claim and one of the two is a deletion routine | [`SECURITY.md`](SECURITY.md) §10.3 — needs a Supabase migration |

## 7. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-24 | Activity J's Stores, Retention and Recipients, for the backup alert emails cf-backup's program added that day: the `email_audit_logs` row from cf-admin `src/workers/scheduled-backup-tick.ts` (`emailLogRow`, and `EmailAuditLogRepository`), the alert texts from cf-backup `src/tick/run-alerts.ts` and each console action's notice (`src/api/downloads.ts`, `src/api/files.ts`, `src/keys/operations.ts`, `src/api/access.ts`, `src/api/config.ts`, `src/backups/prune.ts`), the digest from `src/notify/digest.ts`, and the actor field of the `v1/ops/` records from cf-backup `src/lib/ops.ts` | Whether alert recipients are set in production; the provider each alert actually used (cf-email-consumer's routing); legal basis and retention remain owner and counsel judgements |
| 2026-09-23 | Activity J and the GitHub sub-processor row added from the cf-backup plan of record (doc 05 §5) and its full-build design, for chunk CB-2: `backup_runs` from `migrations/0057_backup_runs.sql`, the audit module from `src/lib/audit.ts` | Nothing in J has run in production yet; the bucket-lock periods are the plan's and become facts only when the owner sets them; legal basis and retention are owner and counsel judgements |
| 2026-09-20 | **§2 B/C/D/E/F/I and §5 re-derived from code.** The "IPs never stored raw" safeguard was false and is replaced by §2.1, a per-store table built from `src/lib/retention-tables.ts`, `migrations/0000_baseline.sql`, `src/lib/auth/login-event.ts`, `src/lib/auth/session.ts` and the `hashIp()` call sites. Per-table retention targets; the automatic 180-day purge in `src/workers/scheduled-asset-cleanup.ts`; `privacy_requests` quarantined; the ARCO identity document located in cf-astro's R2; F's G5 self-contradiction; Brevo/Resend split; Upstash key material; Google added to §3; the 2026-08-12 enforcement date; activity H weakness detail moved to the private backlog. §5's blanket "zero function ACLs" claim corrected from a live `has_function_privilege` check (4 of 6 revoked). The 2026-09-14 row below says the `anon` posture "still holds" — on function ACLs, it did not | Live Supabase *policy* and *grant* state (only function ACLs were queried); `email_audit_logs` sender-IP values in production; Upstash region; whether R2 offers object versioning at all (bucket locks are the R2 control, so I's known gap may name a feature that does not exist); §2's legal bases, which remain owner and counsel judgements |
| 2026-09-14 | §3 sub-processor list against code and the live estate (see `compliance/data-residency.md` §7 for the commands); §4 regions; §5 the rule count (11, was written as 10) and that `API_DENY_MODE=enforce`, the `anon` posture and the audit-exception gate still hold; §6 G5 closed by the 2026-09-10 Emails portal work, G3 and G1/G4 still open (chunk 6 and the IR drill remain `planned`) | §2's legal bases and retention periods for activities A–I, and the §1 DPO assessment — those are owner and counsel judgements, not code, and were not re-derived |

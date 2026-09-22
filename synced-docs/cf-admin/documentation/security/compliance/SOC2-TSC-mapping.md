---

title: "SOC 2 Type I Readiness — TSC Control Mapping (cf-admin-madagascar)"
status: active
audience: [technical, operator, owner]
last_verified: 2026-09-19
verified_against: [code, config, mcp]
owner: harshil
related_docs: [ASVS-L2.md, CSA-CAIQ-v4.md, ../SECURITY.md]
tags: [compliance, soc2, tsc, aicpa, self-attestation]
---

# SOC 2 Type I Readiness — Trust Services Criteria Mapping

> **TL;DR:** This is our internal control-to-TSC mapping — the artifact a
> SOC 2 Type I auditor would ask for on day one. It shows how our engineering
> controls line up with the AICPA Trust Services Criteria (2017, as revised).
> We are **not currently in a Type I audit engagement**; this doc exists so one
> can be started with minimal ramp-up cost.
>
> ⚠️ **Read this before quoting any row.** This is an AI-assisted
> self-assessment reviewed by the owner. No auditor has examined any control
> here, and a ✅ means "we believe the control operates", not "an assessor
> confirmed it". **A correction pass on 2026-07-29 downgraded five rows** —
> CC1.5, CC4.1, CC7.4, CC8.1 and CC9.1 — that asserted controls which either
> did not exist when written or have no sampleable evidence. Each carries an
> inline note explaining what changed and why. Two rows (CC3.4, CC7.4) now carry
> an explicit effective date, because no CI existed before 2026-07-25 and the
> incident-response runbook did not exist before then either.
>
> **A second correction pass on 2026-09-19 moved six more rows.** CC1.5 and
> C1.1 dropped to ❌ (the audit history was deleted on 2026-09-18 and the
> promised review log was never created; no data-classification scheme exists),
> CC9.2 dropped to 🟡, CC5.2 and CC6.1 kept their ✅ but lost an MFA claim that
> is not enforced on the One-Time PIN login path, and A1.3 gained a real
> scheduled restore drill that has not yet succeeded.
>
> The honest summary of readiness: **the technical controls are largely real;
> the evidence trail is thin — thinner than this document said until 2026-09-19
> — and the single-operator model means there is no separation of duties.**
> Both are things an auditor will raise first.

## Scope

- **Service under review:** `cf-admin-madagascar` — Astro+Preact admin
  dashboard on Cloudflare Workers.
- **TSCs in scope:** Security (Common Criteria) primarily; Availability +
  Confidentiality touched where evidence is strong. Processing Integrity and
  Privacy left for a future Type II engagement.
- **Report boundary:** the admin application layer. Underlying platform TSCs
  (Cloudflare, Supabase, Upstash) inherit through those vendors' own SOC 2
  reports.

## Legend

- ✅ **Verified** — control implemented + evidence pointer.
- 🟡 **Design phase** — control designed but not evidenced by long-running logs
  yet (Type I threshold — designed & suitably tailored is enough).
- ❌ **Gap** — must be closed before Type I.
- 🚫 **N/A** — control does not apply.

---

## CC1 — Control Environment

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC1.1 | Entity demonstrates commitment to integrity + ethical values | ✅ | `RULESAd.md` §0 (absolute law) + §0.5 (no fake data). |
| CC1.2 | Board exercises independent oversight | 🟡 | Owner is single point of executive review; documented in `RULESAd.md`. Small-team acceptable per SOC 2 Type I "commensurate with the size + complexity". |
| CC1.3 | Management establishes structures, reporting lines, authorities | ✅ | RBAC hierarchy + `documentation/features/USER-MANAGEMENT.md`. |
| CC1.4 | Commitment to attract, develop, retain competent individuals | 🟡 | Owner + AI-agent execution model; ongoing training encoded in `RULESAd.md` + `AI_CODE_MAINTENANCE.md`. |
| CC1.5 | Individuals held accountable for internal controls | ❌ | **Rewritten 2026-09-19 — neither half of this row is sampleable.** *(a) The trail.* The audit engine does log every privileged action to `admin_audit_log`, and that mechanism is real — but the **retained history is not**. Measured live on 2026-09-19: the table holds **7 rows**, and the oldest, at `2026-09-18 04:49:11` UTC, is a `delete` on module `logs` — the bulk-delete event that removed everything before it. The row previously cited "1,025 rows as of 2026-07-29"; that history no longer exists. Any operator at Owner/DEV level can clear the table through `/api/audit/logs` DELETE, which is tracked as `MAINTENANCE.md` C-9. *(b) The review.* The "owner reviews weekly" half still has no artifact: the review log this row said would start on 2026-07-29 was never created — `grep -rniE "review log" documentation/` finds no such file. **To reach 🟡:** stop the trail being deletable without a counter-record, then start the review log and let it accumulate. To reach ✅: both, with a sampleable history behind them. Downgraded 2026-07-29 and again 2026-09-19. |

## CC2 — Communication & Information

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC2.1 | Obtains + uses relevant, quality information | ✅ | Sentry error tracking + Supabase advisor MCP + CF Analytics. |
| CC2.2 | Internal communication of objectives + responsibilities | ✅ | `documentation/` folder + `RULESAd.md` + `main.md` AI pointer. |
| CC2.3 | External communication with users, partners, regulators | ✅ | Privacy dashboard + consent records + status page (Cloudflare native). |

## CC3 — Risk Assessment

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC3.1 | Specifies objectives with clarity | ✅ | Mission statement in `RULESAd.md`. |
| CC3.2 | Identifies risks to objectives | ✅ | `../../records/reviews/2026-07-05-comprehensive-codebase-and-system-review.md` scorecard. |
| CC3.3 | Considers potential for fraud | ✅ | Ghost Audit Engine surfaces all privileged actions; force-kick + revocation flows. |
| CC3.4 | Assesses changes that could affect internal controls | ✅ *(since 2026-07-25)* | `quality.yml` (unified 2026-09-22) runs secret scan, `rules_check.py`, `a11y_check.py`, `docs_check.py`, markdownlint, `audit_gate.py`, `astro check`, `eslint` via `ratchet.py`, `vitest`, `astro build`, and CycloneDX SBOM. **Effective date matters:** no lint, typecheck, test or build job existed in CI at all before 2026-07-25 (finding N6 in `../../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`), so this control cannot be evidenced for any period before that date. *(Consolidated 2026-09-22: the former `security.yml` and `docs-quality.yml` gates were merged into `quality.yml` — see `records/reports/2026-09-22-ci-workflow-consolidation.md`.)* Re-dated 2026-07-29 — it previously carried an unqualified ✅ written on 2026-07-08. |

## CC4 — Monitoring Activities

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC4.1 | Ongoing + periodic evaluations of controls | 🟡 | Automated evaluation is real and continuous: weekly `npm audit` cron, `rules_check.py` on every push, `audit_gate.py` failing on undocumented or expired advisories. **Human periodic review is ad-hoc, not monthly** — the actual review dates (2026-04-24, 05-24, 05-25, 05-26, 06-13, 07-17) show an irregular cadence. `CSA-CAIQ-v4.md` GRC-03 now states quarterly, which is what a single-operator team can sustain and evidence. Downgraded 2026-07-29. |
| CC4.2 | Communicates + acts on deficiencies | ✅ | `MAINTENANCE.md` open-items table; each PR closes findings with commit hash. |

## CC5 — Control Activities

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC5.1 | Selects + develops control activities that mitigate risks | ✅ | `RULESAd.md` §9.0 code-anchored enforced rules table. |
| CC5.2 | Deploys general controls over technology | ✅ | Cloudflare Zero Trust (perimeter authentication on every route), WAF, DDoS protection, IPv4/v6 dual-stack, TLS 1.3. *(Corrected 2026-09-19: this row read "Zero Trust **MFA**". The Access application accepts Google, GitHub and **One-Time PIN**, and OTP is single-factor, so MFA is not a control we enforce or can evidence — see `ASVS-L2.md` 2.2.3. The general technology controls listed here stand on their own and keep the ✅.)* |
| CC5.3 | Deploys policies + procedures for control activities | ✅ | `RULESAd.md` + `documentation/reference/coding-standards.md`. |

## CC6 — Logical & Physical Access Controls

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC6.1 | Restricts logical access | ✅ | Cloudflare Zero Trust at the edge + `admin_authorized_users` allowlist + PLAC per-page, all three fail-closed. *(2026-09-19: the ✅ is for the allowlist and PLAC, which are verifiable in code. Do not read it as an MFA claim — see CC5.2.)* |
| CC6.2 | Prior to issuing credentials, registers + authorizes users | ✅ | Access-request flow (`/api/access-requests`) + owner approval. |
| CC6.3 | Restricts access to data + protected info based on authority | ✅ | RBAC — canonical `vendor_support > owner > admin > manager > staff > viewer` (stored as `dev`/`owner`/`super_admin`/`admin`/`staff`) + Supabase RLS + PLAC overrides. |
| CC6.4 | Restricts physical access | Inherited | Cloudflare + Supabase DC controls (see their SOC 2 Type II reports). |
| CC6.5 | Discontinues logical + physical access | ✅ | Force-kick, session flush, revocation flag KV + CF Access session revoke — `documentation/features/SESSION-MANAGEMENT.md`. |
| CC6.6 | Implements logical access security to protect from threats outside boundaries | ✅ | HTTPS-only + HSTS `max-age=63072000; preload`; CSP nonce-based; Cloudflare WAF. |
| CC6.7 | Restricts transmission, movement, removal of information | ✅ | Export gated by `#export` PLAC fragment; downloads audit-logged. |
| CC6.8 | Prevents + detects unauthorized software installation | ✅ | Worker deploys require `wrangler` auth; commit signing recommended; secret-scan CI. |

## CC7 — System Operations

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC7.1 | Uses detection + monitoring procedures to identify anomalies | ✅ | Sentry + login-forensics suspicious flagging (`sessionRisk.ts`). |
| CC7.2 | Monitors system components for anomalies | ✅ | `/api/health` + Cloudflare Analytics + Sentry. |
| CC7.3 | Evaluates security events for impact | ✅ | Owner reviews Sentry alerts + `documentation/security/reviews/`. |
| CC7.4 | Responds to identified security incidents | 🟡 *(since 2026-07-25)* | `documentation/runbooks/incident-response.md` exists and covers the GDPR 72-hour clock, and **ten** further runbooks cover specific failure modes (`documentation/runbooks/` holds twelve files; the twelfth is `disaster-recovery.md`). *(Count corrected 2026-09-19: the row said five.)* Two limits keep this at partial: the runbook **states on its own first page that it is untested**, and no incident-response drill has ever been run (`MAINTENANCE.md` C-6). **Effective date matters:** the 2026-07-22 audit verified that four runbooks existed and *none* covered incident response or breach notification; `incident-response.md` was written 17 days after this row's original ✅. Corrected and re-dated 2026-07-29. |
| CC7.5 | Identifies + develops activities to recover from identified security incidents | ✅ | Rollback recipes in each runbook + `documentation/2026-07-05-...` risks section. |

## CC8 — Change Management

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC8.1 | Authorizes, designs, develops, tests, approves, implements changes | 🟡 | **What is actually true:** changes are verified locally before push via `npm run verify` — `astro check`, `eslint`, `ratchet.py`, the full `vitest` suite, `test:gates`, then `rules_check.py`, `docs_check.py`, `lint:md`, `a11y_check.py`, `audit_gate.py` — and the same gates re-run in CI on push to `main` (`quality.yml`, unified 2026-09-22 from the former `quality.yml` + `security.yml` + `docs-quality.yml`). A local repository backup is retained before each push. **What is not true:** there is no pull-request approval step. `RULESAd.md` §12 mandates direct pushes to `main` and forbids sub-branches, and the 2026-07-17 audit confirmed no PR gate (finding O11). As a single-operator team there is also no separation of duties — an independent approver does not exist, which `security/THREAT-MODEL.md` already records as a residual risk. **Compensating control:** CI gates run on every push, so a failing change is visible immediately after push rather than approved before it. **Branch protection on `main` is not enabled** — there is no required status check and force-push is not prevented; `CSA-CAIQ-v4.md` CCC-03 records the same. *(Corrected 2026-09-19: this row read "authorised and pending enablement", which reads to an assessor as a control in flight. Nothing in the repository evidences an authorisation, and it is tracked as an open item, not a scheduled one. The exact test count was also dropped — it goes stale on the next commit.)* Corrected 2026-07-29 — the prior ✅ claimed "PR + CI" and "branch protection on `main`", both of which contradicted `RULESAd.md` §12 and the repo's own audit. |

## CC9 — Risk Mitigation

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| CC9.1 | Identifies + implements activities to mitigate risks from partners + vendors | 🟡 | Sub-processors are enumerated with transfer mechanisms in `security/RoPA.md` and `compliance/data-residency.md`, each vendor's published DPA terms apply, and connector scopes are documented in `features/CONTROL-PLANE-CONNECTORS.md`. **Countersigned DPAs are being collected individually and are not yet held** — `data-residency.md` flags this as an outstanding action and notes that published terms are weaker evidence than a signed agreement when an assessor asks. Downgraded 2026-07-29 — the prior ✅ read "DPAs on file". |
| CC9.2 | Assesses + manages risks associated with vendors + business partners | 🟡 | The sub-processor list is `security/RoPA.md` §3 (nine entries — the authoritative home); supply-chain risk is covered by the weekly `npm audit` → `audit_gate.py` and the Supabase advisor sweep. **Downgraded 2026-09-19:** the ✅ rested on "STA-01/02 in CAIQ", and STA-01 listed only five of the nine sub-processors — now corrected to cite RoPA. More substantively, no vendor SOC 2 or ISO 27001 report has actually been obtained or read; this is reliance on published claims, which an assessor will name as such. |

## A1 — Availability (partial coverage)

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| A1.1 | Maintains, monitors, evaluates current capacity | ✅ | KV budget monitoring; free-tier limits documented; `/api/health` uptime. |
| A1.2 | Implements + monitors environment | ✅ | Cloudflare native + Sentry + login forensics. |
| A1.3 | Tests recovery procedures | Partial | **Updated 2026-09-19 — a recovery test is scheduled; none has succeeded.** `.github/workflows/backups.yml` has run every Monday at 03:17 UTC since 2026-09-15 and contains the two jobs an assessor would want: `d1-drill` restores the export into a throw-away D1 and verifies per-table row counts, `supabase-drill` does the same through `pg_restore` into a `postgres:17` container. Elapsed time is the measured RTO, and `runbooks/disaster-recovery.md` is written to treat that job summary as the A1.3 evidence. **What is not true yet:** the workflow has exactly one run — 2026-09-15, manual, failed after 41 s — because `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are not set on the repository (the only Actions secret is `PERSONAL_PAT`), and `SUPABASE_DB_URL` is unset too. Every RTO/RPO figure in the runbook is therefore still a vendor estimate. The design of the control is now evidenced; its operation is not, which is why this stays Partial rather than rising to ✅. |

## C1 — Confidentiality (partial coverage)

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| C1.1 | Identifies + maintains confidential information | ❌ | **Corrected 2026-09-19 — there is no data classification.** This row cited `documentation/security/PRIVACY.md` as the classification artifact; that document describes the consent/privacy dashboard and contains no classification scheme (a `classification\|classify\|tier` grep over it returns nothing). What exists is *identification without classification*: `security/RoPA.md` inventories the processing activities, categories, recipients and regions; `src/lib/retention-tables.ts` registers per-table retention targets; and sensitive stores are separated in infrastructure (Staff Storage is a non-CDN R2 bucket reached only through the Worker). What is missing is the tiering — which data is confidential, restricted or internal — and the handling rules that follow from it. `CSA-CAIQ-v4.md` DSP-01 has recorded this since 2026-09-14; this row and `ASVS-L2.md` 6.1.1 contradicted it. Added to the gap list below. |
| C1.2 | Disposes of confidential information | ✅ | Privacy request handler + Supabase RLS-enforced deletes; R2 cron cleanup. |

---

## Gap list for Type I engagement

Before an actual SOC 2 Type I engagement is worth engaging, close these:

1. **CC1.4 — competent individuals**: formalize training/onboarding cadence
   with dated attestation records for AI-agent + human contributors.
2. **A1.3 — recovery testing**: schedule a semi-annual DR tabletop; record
   results.
3. **SEF-04 — IR exercises**: schedule + record incident-response drills
   annually.
4. **TVM-03 — pen test**: engage an external firm for a scoped pen test
   (Astro admin + Cloudflare Worker attack surface). Budget ~$5k for a
   small-scope engagement.
5. ~~**STA-03 — SBOM**: emit CycloneDX SBOM from `npm ls --production --json`
   as a CI artifact.~~ **Closed 2026-09-14 (re-verified):** `quality.yml` runs
   `npm sbom --sbom-format cyclonedx` on every push to `main` and uploads
   `sbom.cyclonedx.json` as the `sbom-cyclonedx` artifact.
6. **IPY-02 — API docs**: generate an OpenAPI schema (Zod → OpenAPI) so
   external integrators + auditors have a stable API surface.
7. **C1.1 — data classification** *(added 2026-09-19)*: write a classification
   scheme. Three documents claimed one existed; none did. The inputs are
   already there — `security/RoPA.md` for the activity inventory,
   `src/lib/retention-tables.ts` for per-table retention — what is missing is
   the tiering and the handling rules per tier. Days of work, and it unblocks
   C1.1, ASVS 6.1.1–6.1.3 and CAIQ DSP-01 together.
8. **CC1.5 — evidence retention and a review log** *(added 2026-09-19)*: the
   audit trail can be cleared from the application (`MAINTENANCE.md` C-9) and
   was, on 2026-09-18. Until deletion leaves a counter-record that survives it,
   and until the weekly review is written down somewhere an assessor can
   sample, CC1.5 cannot be evidenced at all.

Once (1–8) are addressed, the org is Type I audit-ready. Cost of Type I
engagement itself (excluding remediation): typically $10k–$25k for a
small-scope, single-service report.

## Suggested next-step ordering

- ~~**Q3 2026**: publish this file + CAIQ + ASVS. Register on CSA STAR L1.~~
  **Slipped, noted 2026-09-19.** The publishing half happened by default —
  `sync-docs.yml` copies all three to a public repository — but no STAR
  registration was started: every box in `CSA-CAIQ-v4.md`'s submission
  checklist is unticked, and the answers must first be re-keyed to the official
  CAIQ v4.0.3 question IDs. Reason it slipped: engineering work took the
  quarter. Re-planned to Q4 2026 rather than silently carried.
- **Q4 2026**: register on CSA STAR L1 (after the ID mapping). Close gaps 1, 2,
  3, 6, 7 (5 closed 2026-09-14). Refresh CAIQ answers.
- **Q1 2027**: close gap 4 (external pen test). Address findings.
- **Q2 2027**: engage a SOC 2 Type I auditor. Ship report.
- **Q3 2027 onwards**: Type II readiness (12-month operating-effectiveness
  window). Refresh review cadence to weekly for hot paths.

*Refreshed 2026-07-08 post-compliance-wave; correction passes 2026-07-29 and 2026-09-19.*

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | CC1.5 against a live `SELECT COUNT(*) AS n, MIN(created_at) FROM admin_audit_log` (7 rows; oldest `2026-09-18 04:49:11` UTC, a `delete` on module `logs`) and a `"review log"` grep across `documentation/` (no artifact); C1.1 against `documentation/security/PRIVACY.md` (no classification section, no keyword match); CC5.2/CC6.1 against `security/SECURITY.md` §1.1 (identity providers) and §1.3 (`loginMethod` union); A1.3 against `.github/workflows/backups.yml` (schedule, four jobs, required secrets, first-run outcome); CC7.4 against `ls documentation/runbooks/` (12 files); CC8.1 and CC9.2 against `CSA-CAIQ-v4.md` CCC-03 / `security/RoPA.md` §3 (nine sub-processors). | Vendor SOC 2 reports (CC6.4); whether the local pre-push repository backup in CC8.1 exists; GitHub repository settings; Cloudflare Access policy contents |

---

title: "Platform Review — Live-Verified Findings & 150 Open Questions"
status: active
audience: [owner, non-technical, technical, operator, ai]
last_verified: 2026-07-29
verified_against: [code, config, live-mcp]
owner: harshil
related_docs: [MAINTENANCE.md, 2026-07-27-go-to-market-prospecting-and-roadmap.md, 2026-07-26-commercial-model-costing-pricing-and-scale.md, 2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md, security/compliance/CSA-CAIQ-v4.md, security/compliance/SOC2-TSC-mapping.md, operations/OPERATIONS.md]
tags: [review, questions, architecture, compliance, commercial, governance, open-questions]
---

# Platform Review — Live-Verified Findings & 150 Open Questions

> [!IMPORTANT]
> **The correction pass this document was written to gate ran on 2026-08-13.**
> This file asked the questions; the answers landed *in the files carrying the
> wrong claims*, exactly as §Scope below prescribes. What was actually corrected:
>
> | This document flagged | Outcome |
> |---|---|
> | 5-tier role vocabulary in active docs | ✅ Swept — canonical names with stored values annotated; `plac-and-audit.md` §1.4 now documents the deprecated aliases and warns that `isAdmin` means *Manager* |
> | Batch-stamped `last_verified: 2026-06-06` | ✅ Re-verified and re-stamped where the claims were actually re-checked; `docs_check.py` now blocks on staleness instead of warning at 120 days |
> | Contradictory env-var / table counts | ✅ Reconciled to one figure each in `RULESAd.md` #0.8/#0.9, with the live query that reproduces them (63 tables: 30 + 9 + 4 D1, 20 Supabase) |
> | Two coexisting cost figures | ✅ Separated: direct spend (~$0.50) vs cost-to-serve (~$30–36), with the commercial doc named as owner |
> | `DASHBOARD.md` mojibake (Q141) | ✅ Fixed at source — 43 sequences; see Q141 below for why the sync workflow never repaired it |
> | Attestations citing evidence that does not exist | ✅ Corrected — see the compliance pass in `CSA-CAIQ-v4.md`, `SOC2-TSC-mapping.md`, `ASVS-L2.md` |
> | `public/_headers` / CSP drift | ➡️ Documented and tracked as `MAINTENANCE.md` C-12 — needs a build to resolve, not a doc edit |
>
> **Findings not yet actioned remain open in
> [`MAINTENANCE.md`](MAINTENANCE.md)**, which is the one live backlog. This
> document is now a record of the review, not a queue. Individual questions
> below are annotated where they were answered.

> **TL;DR (non-technical):** A full review of the three repositories and the live
> services behind them. Part 1 records what was checked directly against Cloudflare,
> Supabase, Sentry and PostHog rather than taken from the docs. Part 2 is a bank of 150
> questions to answer **before** any correction pass, so the next round of writing fixes
> the record instead of adding to it. Nothing here changes code or copy yet.

## Context / Scope

This document exists because the documentation corpus has grown faster than it has been
reconciled. Roughly 29 factual contradictions exist between documents that are all marked
`status: active`. Ten docs share a batch-stamped `last_verified: 2026-06-06`. Two live
price ladders coexist. Two buyer-facing attestations cite evidence that does not exist in
the file they cite.

The corpus is not low quality — it is unusually self-policing. `compliance/ACCESSIBILITY.md`
declares NON-CONFORMANT rather than claiming a score. `runbooks/disaster-recovery.md` says
plainly that its procedures have never been executed. `2026-07-27-go-to-market...:412`
names "claims outrunning evidence" as a *Live today / Severe* risk in its own register.
That honesty is the asset worth protecting, and it is exactly why writing more prose on
top of unreconciled facts would be the wrong move.

**Scope:** `cf-admin-madagascar`, `cf-astro`, `velox-platform-showcase`, plus live state
in the Cloudflare account, both Supabase projects, the Sentry org, and the PostHog project.

**Deliberately not covered:** any correction. This document asks; it does not assert
fixes. Corrections land in place, in the files carrying the wrong claim, once Part 2 is
answered.

---

## Part 1 — Live verification (facts, not doc claims)

Everything in this section was read from the live service through an MCP connector on
2026-07-29, not from a document.

### 1.1 Cloudflare account `[CF_ACCOUNT_ID]`

| Resource | Live state | In `operations/OPERATIONS.md §1`? |
|---|---|---|
| Workers (7) | `cf-astro`, `cf-admin-madagascar`, `cf-chatbot`, `cf-astro-email-consumer`, `velox-platform-showcase`, `whatsapp-chatbot`, `advertisement` | `whatsapp-chatbot` and `advertisement` appear in **no document** |
| D1 (3) | `madagascar-db` (2.1 MB), `chatbot-kb` (221 KB), `whatsapp-chatbot` (78 KB) | Only `madagascar-db` |
| KV (6) | `ADMIN_SESSION`, `SESSION`, `ISR_CACHE`, `EMAIL_IDEMPOTENCY`, `CHATBOT_KV`, `CHATBOT_CACHE` | 3 listed |
| R2 (2) | `madagascar-images`, `arco-documents` | Yes |

`madagascar-db` sits at 2.1 MB against the 5 GB free-tier ceiling that
`2026-07-26-commercial-model...:295` identifies as the binding constraint on fleet size.
That ceiling is account-wide, not per-database.

`OPERATIONS.md §1` is designated the single source of truth for production bindings by
`RULESAd.md` §12, which also records an April 2026 silent CMS failure
caused by a wrong binding UUID. It is currently missing `SYNC_QUEUE`, the sync DLQ, both
service bindings, and the `AI` binding.

### 1.2 Supabase — two projects exist

**`[SUPABASE_PROJECT_REF]` ("Cloudflare")** — the documented production project. 20 public
tables. Live counts: `bookings` 10, `contacts` 81, `messages` 628, `conversations` 120,
`consent_records` 268, `chat_analytics` 360, `admin_authorized_users` 6, `admin_sessions`
28. **Security advisors: 1 warning** (leaked-password protection disabled, already tracked
as L-8). This project matches its documentation.

**`[SUPABASE_PROJECT_REF]` ("supabase-pink-village")** — created 2026-01-01, status
`ACTIVE_HEALTHY`, referenced in **zero files across all three repositories and zero
documentation files**. 37 tables holding personal data, including `consent_receipts` (105),
`forensic_access_log` (192), `admin_audit_logs` (232), `email_master_log` (577),
`email_journey_hops` (774), and `legal_requests` (2) — whose own table comment reads
*"Strictly regulated table for ARCO rights (LFPDPPP). Contains PII."*

Its advisor run returns **128 findings** against 1 for production: 45 `SECURITY DEFINER`
functions executable by `anon` over PostgREST, 48 by `authenticated`, 14 always-true RLS
policies, 19 mutable `search_path` functions, 1 RLS-enabled table with no policy.

**Owner decision (2026-07-29):** this is a prior product version, not connected to any
production or testing environment. It will be exported for PII safekeeping and
decommissioned once the client approves. **No remediation is scoped against it.**

Three consequences remain, and they are cheap:

1. It should appear in `security/RoPA.md` as a *retained, non-production store of personal
   data pending decommission*, with the decision and expected disposal recorded. An Art. 30
   register that omits a store holding ARCO requests is a finding whether or not that store
   is live. The fix is a paragraph.
2. The approved sales claim at `2026-07-27-go-to-market...:438` — *"RLS on 100% of
   PII-bearing tables with zero anonymous access"* — is true of the production project and
   was verified. It should name that project explicitly so the sentence stays true as the
   estate changes. The same applies to `2026-06-18-system-review...:50` ("ZERO access
   policies granted to `anon`").
3. `security.yml` should sweep advisors across `list_projects` rather than a hardcoded ref.
   That is the control which would have surfaced a second project without a human noticing.

### 1.3 Sentry — org `pet-hotel-madagascar`

Projects `cf-admin`, `cf-astro`. **One** unresolved issue in 30 days:
`CF-ADMIN-12 — TypeError: Cannot read properties of undefined (reading 'filter')`, culprit
`Object.ActivityCenter(ActivityCenter.tsx)`, 2 events, 1 user. Error volume is genuinely
low; so is traffic (below).

### 1.4 PostHog — org "Hotel Madagascar", project 320246, 90 days

| Event | Count | Unique people |
|---|---:|---:|
| `$autocapture` | 1,931 | 153 |
| `$pageview` | 499 | 190 |
| `$pageleave` | 381 | 141 |
| `$dead_click` | 354 | 75 |
| `booking_step_reached` | 87 | 41 |
| `booking_wizard_started` | 86 | 58 |
| `booking_submitted_success` | **12** | 10 |
| `booking_submission_failed` | 8 | 5 |
| `$exception` | 11 | 10 |

**~190 unique visitors and 12 completed bookings in 90 days.** Wizard-start → success is
**14%**. `$dead_click` at 354 events across 75 people on 499 pageviews is a real UX signal
on the customer-facing site.

Custom telemetry is three booking events and nothing else. **There are no admin-side
product events at all**, so there is currently no data on how the product being sold is
actually used — which matters for both the case study and the roadmap.

### 1.5 Codebase signals

- cf-admin: 61,895 LOC in `src/`, 89 API route files, ~150 Preact components, 18 test
  files / ~188 cases. `lib/auth/pipeline.ts` — 677 lines, the entire request-auth hot path
  — has **zero direct tests**, and exceeds its own written 600-line exemption whose
  justification text still says "517 lines."
- 253 `any` across 74 files, against `reference/coding-standards.md:19` which states `any`
  is FORBIDDEN. The ESLint comment cites 207; it has grown ~22% since.
- Nine ESLint rules are fully `off` including `no-unused-vars`; `max-lines` is `off`
  against a documented "500 lines, hard error." `knip.json` exists but knip is not
  installed. **Nothing in the toolchain detects dead code.**
- `API_DENY_MODE = "shadow"` (`wrangler.toml:131`) — API authorization is observed, not
  enforced.
- ~~`src/pages/api/audit/silence.ts` still ships (117 lines, live `POST`)~~ — **✅ resolved: the route was deleted 2026-07-29.** It wrote
  `is_audit_silenced`, the column dropped by
  `supabase/migrations/20260727000000_drop_audit_silence.sql`, and its PLAC gate names
  `/dashboard/audit` — a path that exists neither on disk nor in any `admin_pages` seed, so
  `requirePageAccess` finds no key and no prefix and returns without throwing. **The gate
  is a no-op.** The role gate still restricts it to `vendor_support`.
- `supabase/migrations/20260724000000_add_cf_sync_status_columns.sql` is headed "NOT YET
  APPLIED — run this manually," while `lib/auth/cf-access-sync-log.ts` writes those columns
  unconditionally.
- `migrations/` contains **two files numbered `0002`**.
- Astro version spread: cf-astro 7, cf-admin 6.4.8, Velox 5. `MAINTENANCE.md` C-1 ties the
  cf-admin upgrade to audit exceptions that **expire 2026-10-23** — a hard build-failure
  date, ~12 weeks out.
- Velox sells 12-month contracts with a 50% early-termination fee while
  `cf-astro/src/config/site.ts:30` (path no longer exists — the file was moved or renamed after this audit; re-locate before actioning) still read `'[Legal Business Name]'` and
  `'[Governing Jurisdiction, TBD]'`.

### 1.6 The contradictions that matter most

Full set is 29; these are the ones with a buyer or an auditor on the other side.

| # | Claim | Contradicted by |
|---|---|---|
| 1 | `CSA-CAIQ-v4.md` BCR-01 & BCR-06 cite `architecture/ARCHITECTURE.md` for business-continuity evidence | That file contains zero occurrences of *backup*, *recovery*, *disaster* or *continuity* |
| 2 | `CSA-CAIQ-v4.md` BCR-03: "backups encrypted and **tested**" | `runbooks/disaster-recovery.md:7` — "have never been executed" |
| 3 | `CSA-CAIQ-v4.md` A&A-05: "Public repo for cf-admin-madagascar" | `RULESAd.md:75` — private |
| 4 | `CSA-CAIQ-v4.md` DSP-07 & `SOC2-TSC-mapping.md` CC9.1: "DPAs on file" | `compliance/data-residency.md:60` — filing them is outstanding |
| 5 | `SOC2-TSC-mapping.md` CC8.1: "branch protection on `main`", "every change goes through PR + CI" | `RULESAd.md` §12 — "DO NOT create new branches. ALWAYS push directly to `origin main`" |
| 6 | `SOC2-TSC-mapping.md` CC3.4 (dated 2026-07-08): `tsc` + `vitest` + `npm audit` on every PR | Finding N6 — no lint/typecheck/test/build job existed in CI at all until 2026-07-25 |
| 7 | `SOC2-TSC-mapping.md` CC7.4 cites runbooks as incident-response evidence | `runbooks/incident-response.md` was written 17 days after that ✅ |
| 8 | HSTS `max-age=63072000` in three compliance docs, `ASVS-L2.md:61` citing "(SECURITY.md)" | `SECURITY.md:180` and `RULESAd.md:88` both say `31536000`; the cited value is not in the cited file |
| 9 | ASVS L2 "~95%" — the most-quoted external number in the corpus | Also stated as ~92% and ~91%; `ASVS-L2.md` says both "2 documented gaps" and "0 open gaps" in one file |
| 10 | Setup fee "not optional", $1,500–$5,000 (`2026-07-26-commercial...:431`) | Velox `/pricing`, `/terms`, homepage: "no setup fee, no onboarding fee, no build fee, no migration fee" |
| 11 | $29 tier retired as below a ~$36 fully-loaded floor (`2026-07-26-commercial...:436`) | `2026-07-27-go-to-market...:47` sells $59–499, one day later |
| 12 | `DESIGN-SYSTEM.md:425` "**Verified** Contrast Ratios (Dark Theme)" | `compliance/ACCESSIBILITY.md:102` lists contrast under "what has NEVER been tested"; `:112` — no screen reader has ever been run |
| 13 | "append-only audit" in `README.md:33` and two other docs | `MAINTENANCE.md:129` C-9 — no hash chain, no sequence number, no signature, no WORM; `admin_audit_log` is itself a purge target |
| 14 | Six documents still describe the **5-tier** role model, incl. `USER-MANAGEMENT.md` §2 titled "Role Hierarchy (5-Tier)" eleven lines after its own six-tier banner | `architecture/plac-and-audit.md:31` is authoritative with six tiers — and `:60` warns the rename **collides** (`super_admin`→`admin`, `admin`→`manager`) |

Item 14 is the dangerous one: a reader landing on any stale doc will read `admin` as
level 3 when the code now means level 2.

---

## Part 2 — 150 open questions

Answer inline under each item. Anything left blank will be carried forward as an explicit
open question rather than guessed at. Where an obvious default exists it is stated, so a
one-word answer is often enough.

### A. Identity, entity, and what the product actually is (1–14)

1. What is the legal entity that would sign a customer contract? Does it exist today?
2. Where is it incorporated — Mexico, US, elsewhere? This determines which privacy regime
   you are controller under; every compliance doc currently assumes Mexico.
3. `RoPA.md:37` names the controller as **Madagascar Pet Hotel**. Is that intended to remain
   the controller for *client* deployments, or is a separate vendor entity planned?
4. Is "Velox" the final brand or a placeholder? `site.ts:1` makes it one env var with a
   comment saying "set `PUBLIC_SITE_NAME` to rebrand."
5. Has any domain been purchased? `2026-07-27-go-to-market...:479` says "buy the domain
   this week."
6. `reference/commercial-readiness-checklist.md:19` describes a third product — a
   "$0-infra admin starter kit" as `cf-admin-starter`. Live strategy, dead, or deferred?
7. **One product or three?** A reader can currently find (a) Velox subscriptions $59–499,
   (b) a per-deployment admin framework $250–900, (c) an open starter kit. Which are you
   actually pursuing in the next 6 months?
8. If more than one — shared brand, or separately named?
9. Who is "we" in the Velox copy? `security.astro:181` says "We hold a support account on
   your dashboard." Solo, or is there a team?
10. Is there anyone else who can deploy, debug, or restore this system today?
11. What is the intended relationship between the pet hotel and the software business —
    customer, subsidiary, parent, or origin story?
12. Is the pet hotel's revenue funding the software work?
13. Do you want the pet hotel named publicly? `case-study.astro` already names it, links the
    live domain, and screenshots its admin dashboard.
14. Target outcome: a lifestyle business at 10–15 clients, something you scale past that, or
    an asset you intend to sell?

### B. The prior-version Supabase project (15–20)

Mostly closed by the 2026-07-29 owner decision above. These remain.

 1. Confirm: was `supabase-pink-village` the original cf-admin backend, superseded by the
    move to `[SUPABASE_PROJECT_REF]`? The table set (`admin_users`, `admin_section_permissions`,
    `admin_permission_logs`) reads like a predecessor of the current model.
 2. Its `admin_audit_logs` and `access_login_attempts` were last written **2026-06-22**.
    Was anything still pointed at it that recently?
 3. Do `email_master_log` / `email_journey_hops` belong to `cf-astro-email-consumer`, or to
    the prior version?
 4. Are the 2 rows in its `legal_requests` real data-subject requests? If so, were they
    fulfilled, and is that recorded anywhere?
 5. Is `consent_receipts` (105) / `forensic_access_log` (192) data duplicated in the
    production project, or does it exist only there? This affects what the export must
    capture.
 6. Are there other Supabase orgs/projects, other Cloudflare accounts, or second accounts
    at Brevo / Upstash / Resend / PostHog that I can't see?

### C. Undocumented infrastructure (21–28)

 1. What is the `advertisement` worker? Created 2026-05-30, last modified 2026-06-02.
 2. What is `whatsapp-chatbot`, and how does it relate to `cf-chatbot`? It has its own D1.
 3. Is it live, and does it process phone numbers or message content? WhatsApp implies Meta
    as a sub-processor, and it appears in no RoPA entry.
 4. Velox `/pricing` sells a "WhatsApp AI Bot" as an engagement-priced add-on. Is this the
    implementation, and is it production-ready?
 5. `chatbot-kb` D1 (221 KB) — the chatbot knowledge base? Who curates it?
 6. Are there Cloudflare resources configured only in the dashboard and not in any
    `wrangler.toml` — routes, WAF rules, Access policies, Zero Trust groups? The
    custom-domain route block at `wrangler.toml:21-25` is commented out, so live routing is
    configured out-of-band.
 7. Is there a staging environment in any form? `MAINTENANCE.md` C-8 says no.
 8. Are `chatbot-kb` and `whatsapp-chatbot` D1 databases in scope for retention and DSAR,
    and are they covered by any backup?

### D. Architecture and data layer (29–46)

 1. `madagascar-db` is shared between cf-admin and cf-astro, and `ISO-27017-27018.md:77`
    says that arrangement has never had a formal risk assessment. Deliberate or artifact?
 2. Velox `/security` sells "an isolated database per customer, so isolation is physical."
    Given the reference deployment shares one D1 and one Supabase project across two apps,
    is that claim about the *per-client* boundary only? Should the copy be qualified?
 3. `sync-contract.ts` exists in both repos with a "must stay identical" comment and **no
    test enforcing it**. Add a cross-repo diff check, or is the no-shared-package rule more
    important?
 4. Bookings are canonical in Supabase with a D1 shadow table for admin-only fields. Worth
    the join complexity at 10 bookings/quarter?
 5. Two migrations are numbered `0002`. Which ran first in production?
 6. Has `20260724000000_add_cf_sync_status_columns.sql` been applied? If not, the
    unconditional writes in `cf-access-sync-log.ts` are failing silently.
 7. There is no `supabase/config.toml`; migrations are applied by hand or via MCP. Do you
    want a real runner?
 8. Two Supabase migration naming conventions coexist (`supabase_000N_` and timestamped).
    Which is canonical going forward?
 9. What is blocking the `API_DENY_MODE` flip to `enforce` — unmapped routes, or confidence?
10. Shall I run the readiness SQL given in the `wrangler.toml` comment against the
    shadow-deny audit rows to prove the flip is safe?
11. `checkPageAccess()` returns `true` unconditionally for `dev`/`owner`, so removing a page
    hides it from normal roles but leaves the route in the bundle and reachable by the top
    two tiers. For per-client module removal, do you want real file deletion?
12. The 5-tier → 6-tier role migration is still pending (`ROLE_VOCABULARY = 'legacy'`,
    `rbac.ts:100`). Target date?
13. `viewer` (level 5) cannot be written at all — `toStoredRole()` throws — yet its write
    block is enforced unconditionally. Is `viewer` shipped or not?
14. Every request writes an `admin_audit_log` row to D1, which
    `2026-07-26-commercial...:258` identifies as the binding fleet cost. Is per-request
    audit a hard requirement, or would mutation-only/sampled auditing be acceptable?
15. Do you want audit tamper-evidence built (hash chain / sequence / WORM), or the
    "append-only" language removed from the engineering docs where it still appears?
16. Is Hyperdrive permanently rejected?
17. cf-admin reaches Supabase only through a service-role client that bypasses RLS — Velox's
    `copy-lint.test.ts:192` already bans the phrase "row-level security" for that reason. Is
    service-role-only permanent, or a stepping stone?
18. Is the Astro 6→7 upgrade scheduled against the **2026-10-23** exception expiry?

### E. Security posture and the buyer-facing attestations (47–66)

 1. `CSA-CAIQ-v4.md` is described as "registry-ready." **Has it been submitted to the CSA
    STAR registry?** If yes this becomes urgent; if no, there is room to fix first.
 2. BCR-01 / BCR-06 cite `ARCHITECTURE.md`, which contains no BC/DR content. Aspirational,
    or is there a BC/DR document elsewhere?
 3. BCR-03 says backups are "encrypted and tested"; the DR runbook says restores have never
    been executed. Which is true?
 4. A&A-05 says "Public repo." The repo is private. Did this mean the `synced-docs` mirror?
 5. DSP-07 says "DPAs on file." Are any countersigned DPAs actually held?
 6. GRC-03 says "Monthly cadence." Actual review dates are irregular. Commit to monthly, or
    change the answer?
 7. CC8.1 claims branch protection and a PR gate; `RULESAd.md` §12 forbids branches.
    Which is the actual policy?
 8. Is branch protection enabled on `main` right now? I can verify this directly if you want
    me to query repo settings.
 9. CC3.4 and CC7.4 both claim controls that postdate the ✅. Re-date, or downgrade?
10. CC1.5 ("owner reviews weekly") and CC4.1 ("monthly security reviews") — is there any
    artifact recording these happened? An auditor asks for evidence, not a claim.
11. Which HSTS `max-age` is deployed? I can settle it with one `curl -sI` if you'd like.
12. What is the actual derivation of the ASVS "~95%", and who computed it? It is the
    most-quoted external number you have.
13. `AI_CODE_MAINTENANCE.md:11` bars future security reviews from raising key rotation as a
    finding, unscoped — which also suppresses *future* leaks of the same services. Intended,
    or should it be scoped to the 2026-06-13 rotation?
14. Have keys been rotated since 2026-06-13? Is there a cadence?
15. `sync-docs.yml` publishes `documentation/**` and `RULESAd.md` to the **public** repo
    `Harshil8136/chess-game1` — auth flows, PLAC internals, threat model, infrastructure
    IDs — and its pre-copy secret scan is **warning-only and never blocks**. Still wanted?
16. If yes: make the secret scan blocking, and exclude `security/` and
    `reference/control-plane-design/`?
17. `reference/control-plane-design/PLAN.md:10` says it "lives under `docs/` which is NOT
    auto-synced." It is in `documentation/` and therefore *is* published. Move it, or accept
    the disclosure?
18. Has an external penetration test been engaged? G12 has been open since July at ~$5k.
19. Is there a `security.txt`, a vulnerability disclosure policy, or a security contact?
    I found none.
20. `public/_headers` is dead (Workers, not Pages) but contains `'unsafe-eval'`, which
    SEC-01 forbids with no exemption — the rule only globs `csp.ts`, so the drifted copy
    passes CI. Delete it?

### F. Codebase health and engineering debt (67–84)

 1. Delete `src/pages/api/audit/silence.ts`, or was its removal reverted deliberately?
 2. Nine ESLint rules are `off`. What's the re-enable plan, and in what order?
 3. Install knip, or delete `knip.json`? With `no-unused-vars` also off, nothing detects
    dead code today.
 4. 253 `any` against a "FORBIDDEN" standard. Real burn-down, or rewrite the standard to
    match reality?
 5. `env.d.ts:134` has `[key: string]: any`, which defeats typo detection on every `env.X`
    access in the codebase. Fix first?
 6. Is testing `pipeline.ts` a priority? 677 lines, the whole auth hot path, zero direct
    tests — no coverage of the bot-score gate, the JWT/header email binding, the 30-minute
    role recheck, the shadow-vs-enforce branch, or the viewer write block.
 7. What is the target test posture? Today: no handler tests, no component tests, no DAL
    tests, no cron/queue tests. Breadth graded **D**.
 8. Consolidate the duplicates? Four `StatCard`, three `timed<T>`, three `maskIp` **with
    three different masking policies**, two `isLocalDev` — one re-implemented inside
    `dev-login.ts`, the file whose entire safety depends on it.
 9. `deriveSection` exists three times: once server-side taking `role`, twice client-side
    taking only `path`. The UI copies will disagree with the server for `vendor_support`.
    Is that a live bug?
10. Standardize the 60 hand-rolled `jsonError(401, …)` sites and 10 spellings of
    "Insufficient permissions"?
11. Split `DashboardStyles.astro` (1,195 lines — the largest file in `src/`, a stylesheet
    with an `.astro` extension)?
12. Extract the `Reflect.set` prototype-pollution guard, inlined as a ternary 16 times
    across 13 files?
13. Finish or revert the Resend→Brevo rename? One live caller remains in
    `users/resend-invite.ts`; `RULESAd.md:592` still documents Resend as the email path.
14. `main.md` — the AI entry point, copy-pasted identically into all three repos — ends with
    an unstructured block telling agents to use "ydc-search" and "openrouter MCP which is
    paid." Three docs give three different MCP inventories. What is the approved tool list?
15. `astro.config.ts:53` excludes three nonexistent packages (`audit`, `xray`, `toolbar`).
    Safe to remove?
16. Fix Sentry `CF-ADMIN-12` in this pass?
17. Velox is on Astro 5, two majors behind cf-astro. Maintained on the same cadence, or
    deliberately frozen?
18. Should admin-side PostHog events be added? There is currently **no telemetry on how the
    product being sold is used** — which weakens both the case study and the roadmap.

### G. Fleet operations and the capacity ceiling (85–94)

 1. `scripts/` contains only the four Python gates. Every fleet tool named in the GTM doc is
    absent — no `wrangler.template.toml`, no `init-cloudflare.sh`, no fleet migration runner,
    no drift inventory, no per-client secret management. Still accurate?
 2. **How long does one client update actually take, end to end?** Assumption A4 (30
    min/client) is self-rated "Very high. Never measured. Drives 60–70% of cost." This is
    the highest-value single measurement available to you.
 3. Have you ever provisioned a second deployment from scratch? How long did it take?
 4. **How many live deployments exist today?** I believe one. The stated rule is that at 8,
    tooling outranks the ninth client.
 5. Assumption A6 models support and incident load at **$0**, self-rated as possibly adding
    50–100% to cost-to-serve. Any real support-hours data from the pet hotel?
 6. Assumption A1 puts all clients in your Cloudflare account and Supabase org. Acceptable to
    a client who wants to own their infrastructure? Client-owned roughly triples per-client
    infra cost.
 7. Velox `/security` says the vendor support account "sits outside your role ladder" —
    that's `vendor_support` (level 0), which `checkPageAccess` grants everything
    unconditionally. Is unrestricted vendor access acceptable to your target buyers, or does
    it need scoping?
 8. Is there a documented customer-offboarding / data-return procedure? Velox's terms promise
    export "including if you leave"; `ISO-27017-27018.md:113` marks the procedure 🔴 twice.
 9. Is there cyber or E&O insurance?
10. What happens to client deployments if you are unavailable for a month? No succession,
    escrow, or second operator is documented.

### H. Commercial model — the two price ladders (95–112)

The docs themselves flag this as the most important unresolved commercial fact.

1. Which ladder is live — $59–499, or $250–900?
2. The GTM doc defends $59 because Starter "carries no admin deployment, so ops load is near
    zero." Is that architecturally true — does a Starter client get `cf-astro` with no
    `cf-admin`?
3. If so, who operates a Starter client's CMS? Velox Starter advertises "keep full control
    of it yourself," but the CMS lives in cf-admin.
4. Setup fee: "not optional" ($1,500–$5,000) or "no setup fee"? Both are currently published.
5. Velox instead asks for three months upfront, non-refundable — $447 at Business against a
    modelled $1,500 setup fee. Does the build economics work at that number?
6. Has any price on either ladder ever been quoted to a real prospect? A7 is self-rated
     "Very high — zero customer validation."
7. Has a lawyer reviewed the 12-month minimum and 50% early-termination fee — in a
     jurisdiction currently rendered as `'[Governing Jurisdiction, TBD]'`?
8. Is there an MSA, DPA, or support agreement template anywhere? I found none.
9. "Usage billed at provider cost, no markup" with published rates — how is usage actually
     metered and invoiced? There is no billing system.
10. How does a customer pay today? Is there any payment rail at all?
11. The "3-Month Full Power" promotion is `enabled: true` through 2026-12-31 and includes
     "all on-request modules" and "a capped AI allowance." What is the cap, and what is the
     modelled cost of the window?
12. **How many of the ~45 priced add-on modules are actually built?** Five are flagged
     `roadmap: true`, but e.g. "Behavioural Analytics Suite $59.99" and "Operations Dashboard
     $39.99" — do those map to shipped cf-admin features?
13. `metrics.ts:57` claims Velox replaces "$700–$2,400/mo" of SaaS. Source?
14. `case-study.astro:122` names competitors with prices and criticisms — "Gingr… Acquired
     Nov 2024, closed to new clients," "Wix… 2-5s load times." Verified? Factual claims about
     a named competitor's business carry defamation risk if wrong.
15. `metrics.ts:20` compares "$0.01/conversation" to "Intercom Fin $0.99/resolution" and
     "Zendesk Advanced AI $0.55." Sourced and dated?
16. `FAQ.astro:14` claims "sub-50ms" cached responses. Measured on a real deployment?
17. The only measured Lighthouse run in the corpus is 2026-04-24: **Performance 73 / A11y 95
     / Best Practices 77 / SEO 92**, three months old. Re-measure against production before
     any performance claim ships?
18. Velox's JSON-LD declares `areaServed: 'Worldwide'` while `data-residency.md` says
     US-only and the anti-ICP excludes anyone needing EU residency. Narrow the schema?

### I. Go-to-market and client acquisition (113–132)

You asked specifically about acquiring clients with a genuinely useful product. These are
what I'd need to write that well.

  1. Have you had **any** sales conversation with a prospect who is not the pet hotel?
  2. If yes — what did they say about price, and what did they object to?
  3. If no — Phase 1's gate is "three signed clients **or** ten completed discovery
     conversations with written notes. Evidence, not activity." Ready to run those ten
     before more building?
  4. The flagship play is demo-first outbound: build a working version of the prospect's
     business for free, before any contract. **Have you ever built one?**
  5. How long did it take, and how long would #2 take? The whole model rests on the second
     being an afternoon.
  6. The doc timeboxes demos to "a few hours" and targets ≥1-in-4 demo-to-meeting. Realistic
     given provisioning is manual?
  7. Which **two or three verticals**? The doc is explicit that eight is wrong. Candidates
     given: grooming/boarding, clinics, studios, salons, auto service.
  8. Do you have a reachable list in any of them — an association, directory, or chamber of
     commerce?
  9. Geography: Aguascalientes / Mexico first, or English-language markets first? The admin
     portal is `<html lang="en">` only (`ACCESSIBILITY.md:57`) while cf-astro is bilingual —
     a real product gap if you sell into Mexico.
 10. The **agentic-visibility wedge** is the genuinely differentiated asset — cf-astro really
     does ship `/api/mcp`, `.well-known/api-catalog`, agent skills, and 16 AI-crawler allow
     groups. Do SMB owners you've spoken to understand or care about it?
 11. If not — is it a wedge for *agencies* rather than end SMBs?
 12. The **accessibility audit as lead magnet** is legally sharp (>5,000 US suits in 2025,
     64% against companies under $25M revenue, no Title III small-business exemption). But
     your own admin portal is NON-CONFORMANT with 45 open findings and has never had a screen
     reader run against it. Fix that before selling on it?
 13. Related: are you comfortable running accessibility audits *for* prospects, given the
     FTC's $1M fine against an overlay vendor for unverifiable claims?
 14. Single-reference concentration is called "a single point of failure for the entire GTM
     story," and three references are called more urgent than ten clients. Agreed?
 15. Will the pet hotel give a referral introduction? The plan asks for two.
 16. Motion B (agencies / white-label) is gated behind fleet tooling. Keep the gate, or chase
     agency interest sooner?
 17. What does "genuine useful product" mean to you concretely — (a) honestly described,
     (b) solves a problem prospects already know they have, or (c) both? They lead to
     different work.
 18. Given ~190 visitors and 12 bookings in 90 days, the case study cannot lean on volume.
     What *is* the honest win story — time saved, compliance posture, cost replaced?
 19. `$dead_click` fired 354 times across 75 people on 499 pageviews on the customer-facing
     site. Worth investigating as a conversion problem before selling the site as fast?
 20. Booking wizard start → success is 14% (86 → 12). Is that in line with expectations, or a
     funnel problem worth fixing first — since it's the exact metric a prospect will ask
     about?

### J. Documentation governance (133–150)

  1. What is the corpus **for**? It currently serves AI agents, a future auditor, and
     prospects simultaneously, and most conflicts come from that. Split into separate trees?
  2. Who wins when two `active` docs disagree? There is no precedence rule.
  3. Enforce a **superseded-banner convention** in CI, so any doc a newer one replaces must
     carry a pointer? `2026-06-13-platform-status-summary.md` does this well with
     strike-throughs; nothing else does.
  4. Ten docs share `last_verified: 2026-06-06`. Should `docs_check.py` flag identical batch
     dates?
  5. Its staleness threshold is 120 days and non-blocking. Tighten to 60 and make it block?
  6. Delete `docs/PLAN-*.md` (4 files)? They exist despite `CONTRIBUTING-DOCS.md:21` saying
     the tree "must not be recreated," their features are merged, and every code reference is
     an absolute local Windows path (scrubbed to repo-relative links 2026-08-23).
  7. Consolidate the **six** control-plane documents (~140 KB) — which contradict each other
     on status ("Proposed, pre-implementation" vs "Implementation Complete" in the same
     folder) — down to the two `features/CONTROL-PLANE*.md` files?
  8. Fold `archive/` (~112 KB of superseded backlogs) into `MAINTENANCE.md` and delete?
     `MAINTENANCE.md:39` still cross-references `PENDING_PHASES.md` for L-item detail, so
     they can't simply be dropped.
  9. ~~`features/DASHBOARD.md` is corrupted with mojibake throughout~~ — **✅ RESOLVED
     2026-08-13.** 43 double-encoded sequences repaired via a cp1252 round-trip:
     the em dash (37), arrow (4), `≤` (2) and `×` (1). The corrupt byte
     sequences are named by code point rather than reproduced here, so this
     note cannot itself re-introduce them — U+00E2 U+20AC U+201D, U+00E2 U+2020
     U+2019, U+00E2 U+2030 U+00A4 and U+00C3 U+2014 respectively. The file now
     has zero residual mojibake characters.
     **Answering the question it asked:** `sync-docs.yml` runs `ftfy` on the *copy
     it publishes*, not on the source, so the public repo looked clean while the
     source stayed broken — the repair was never going to propagate backwards. A
     mojibake check now runs against the source in `scripts/docs_check.py`.
 10. Rename `security/PRIVACY.md` → `features/PRIVACY-DASHBOARD.md` and make `RoPA.md` the
     privacy entry point? It is a UI spec wearing a privacy-policy title, and both compliance
     attestations cite it as the privacy source.
 11. Pull versions from `package.json` at docs-check time? `README.md`, `RULESAd.md` and
     `ARCHITECTURE.md` all state Astro 6.3.7 / Preact 10.29.0; the lockfile says 6.4.8 /
     10.29.7.
 12. Is a mechanical 5-tier → 6-tier propagation acceptable across the six stale docs, or do
     you want to review each? The rename collides, so this is a privilege-boundary
     correction, not cosmetic.
 13. Should `README.md:7`'s broken security-review link and two-month-stale date be fixed as
     part of this, or separately?
 14. `SECURITY.md` self-describes as "the canonical, current security state" with a §0 dated
     2026-05-26 in which every row is now wrong. Rewrite §0, or demote the file from
     "canonical"?
 15. Should `2026-07-17-compliance-standing-and-market-positioning.md` and
     `security/reviews/2026-07-17-full-platform-audit.md` be marked superseded on
     multi-tenancy, pricing shape, and the GDPR/CCPA scores? Both are still `active` and both
     were explicitly superseded by later docs.
 16. `MAINTENANCE.md:80` says of itself: "This table had listed both as open long after they
     were actually fixed — re-verify against `rules_check.py` rather than trusting a status
     table." Should that verify-don't-trust principle become a governance rule?
 17. Confirm the delivery method: **edit files in place** where the wrong claim lives, plus
     one short reconciliation index. (Chosen 2026-07-29; restating for the record.)
 18. Of everything in Part 1 — **what is news to you?** That answer locates the real gap
     between the documentation and your mental model, which is the thing most worth fixing.

---

## Key code paths

- Rogue-project verification → `mcp__Supabase__list_projects`, `list_tables`, `get_advisors`
- Live binding inventory → `mcp__Cloudflare_Developer_Platform__{workers,kv_namespaces,d1_databases,r2_buckets}_list`
- Traffic baseline → `mcp__PostHog__exec` / `execute-sql` over `events`, 90-day window
- Error baseline → `mcp__Sentry__search_issues`, org `pet-hotel-madagascar`
- No-op PLAC gate → `src/pages/api/audit/silence.ts:55` → `src/lib/auth/guard.ts:108`
- Shadow authorization → `wrangler.toml:131` → `src/lib/auth/routes.ts:92` →
  `src/lib/auth/pipeline.ts:623`
- Role collision → `src/lib/auth/rbac.ts:100` ↔ `architecture/plac-and-audit.md:60`

## Configuration / Bindings

No configuration changes are proposed by this document. Binding **names** referenced:
`DB`, `IMAGES`, `SESSION`, `ANALYTICS`, `EMAIL_QUEUE`, `SYNC_QUEUE`, `CHATBOT_SERVICE`,
`ASTRO_SERVICE`, `AI`. Secret names only, never values.

## Operational notes

Nothing here is actionable until Part 2 is answered. The one item with a hard external
deadline is the audit-exception expiry on **2026-10-23**, which fails the build fleet-wide
when it passes and is tracked as `MAINTENANCE.md` C-1.

## Verification log

| Date       | Checked by | Method                                             | Result |
|------------|-----------|----------------------------------------------------|--------|
| 2026-07-29 | claude    | Full doc read + 3-repo code map + live MCP checks across Cloudflare, both Supabase projects, Sentry, PostHog | pass — findings recorded above |

## Related

- [`MAINTENANCE.md`](MAINTENANCE.md) — the live backlog these questions feed
- [`2026-07-27-go-to-market-prospecting-and-roadmap.md`](2026-07-27-go-to-market-prospecting-and-roadmap.md)
- [`2026-07-26-commercial-model-costing-pricing-and-scale.md`](2026-07-26-commercial-model-costing-pricing-and-scale.md)
- [`security/compliance/CSA-CAIQ-v4.md`](security/compliance/CSA-CAIQ-v4.md)
- [`security/compliance/SOC2-TSC-mapping.md`](security/compliance/SOC2-TSC-mapping.md)
- [`operations/OPERATIONS.md`](operations/OPERATIONS.md)

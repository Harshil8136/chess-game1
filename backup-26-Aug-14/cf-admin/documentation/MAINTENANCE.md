---

title: "Maintenance Backlog"
status: active
audience: [ai, technical]
last_verified: 2026-08-12
verified_against: [code]
owner: harshil
related_docs: [archive/ToDoList.md, archive/PENDING_PHASES.md, security/SECURITY.md]
tags: [maintenance, backlog]
---

# Maintenance Backlog

> **TL;DR (non-technical):** A single, honest list of the small engineering tasks
> that are still open. Anything finished lives in the historical files under
> [`archive/`](archive/), not here.

This is the **one live backlog**. It reconciles the previously-conflicting status
files (`ToDoList.md`, `PENDING_PHASES.md`, `REFACTORING_OVERVIEW.md`), which are
now archived as historical snapshots. Items below were open as of the 2026-05-26
deep-review follow-up; **each must be re-verified against current code before
work** (line numbers are from the original audit and may have drifted).

> Note: this backlog is documentation-only. It does not modify code. Use it to
> track real code follow-ups discovered during the docs audit and from the
> 2026-05-25 deep review's remaining Medium/Low items.

## Open items (from the 2026-05-25 deep review)

| # | Item | File (verify lines) | Severity | Notes |
|---|------|---------------------|----------|-------|
| 13 | Decide policy on `DELETE /api/audit/logs` (append-only ledger vs. interactive "Delete Selected" UI) | `src/pages/api/audit/logs.ts` | 🟡 policy | PLAC gate already wired; remaining question is product policy. Needs sign-off. |
| 14 | Validate `pageOverrides` on user creation (each `pagePath` exists in `admin_pages`; apply Gate D ceiling to grants) | `src/pages/api/users/manage.ts` | 🟡 | — |
| ~~16~~ | ~~Simplify `effectiveSiteUrl`~~ | `src/middleware.ts` | ✅ RESOLVED 2026-07-08 | Dropped `process.env` branch; `const effectiveSiteUrl = env.SITE_URL;` |
| ~~18~~ | ~~Fail-closed chatbot proxy `minRole`~~ | `src/pages/api/chatbot/[...path].ts` | ✅ RESOLVED 2026-07-08 | Default changed from `'admin'` → `'dev'` (most restrictive) |
| ~~20~~ | ~~Use `isAdmin()` helper in media upload~~ | `src/pages/api/media/upload.ts` | ✅ RESOLVED 2026-07-08 | Replaced hardcoded allowlist with `isAdmin(user.role as Role)` |
| ~~22~~ | ~~`cf_admin_theme` cookie `SameSite=Strict`~~ | `src/pages/api/settings/user.ts` | ✅ RESOLVED 2026-07-08 | Changed from `SameSite=Lax` → `SameSite=Strict` |
| 25 | Misc low items (L-1…L-12). Notably `ModelsCatalog` `dangerouslySetInnerHTML` → JSX (partially resolved: load-bearing comment added; full JSX conversion still open) | `src/components/admin/chatbot/ModelsCatalog.tsx` + others | 🔵 | See `archive/PENDING_PHASES.md` for the full L-item detail |

**Suggested ordering:** 13 (policy) → 14 (validation) → 16+18+20+22 (single hygiene PR) → 25 batch.

## Documentation follow-ups discovered during the audit

| Item | Where | Notes |
|------|-------|-------|
| `cms_content_history` is a dead table (zero writers) | `migrations/0026_cms_content_history.sql` | Either ship the version-history feature (writers + UI + trigger) or drop the migration. Currently a maintenance trap, not a runtime bug. |
| ~~Email Portal schema not provisioned by migrations~~ (RESOLVED 2026-06) | `migrations/0032_create_admin_email_tables.sql` | `migration 0032` now creates `admin_email_drafts` + `admin_email_templates`, seeds `custom_email_max_recipients`, and seeds the `#preview`/`#contacts` PLAC rows. Applied out-of-band to the shared `madagascar-db` (its default `d1_migrations` table tracks **cf-astro**, so cf-admin migrations are applied directly, not via `wrangler d1 migrations apply`). All statements are idempotent. |
| ~~Drafts "autosave" copy vs. behavior~~ (RESOLVED 2026-06) | `src/components/admin/emails/_components/EmailPortal.tsx` | Real debounced autosave (~10s after the last edit, dirty-tracked via a content snapshot) now backs the "autosaves as you type" copy, reusing `POST /api/emails/drafts`. A "Saving…/Draft saved" indicator surfaces the state. |

## Email Portal hardening backlog (2026-06-07 review)

Code follow-ups from the deep review of `src/components/admin/emails/` and
`src/pages/api/emails/`. See [`features/EMAIL-PORTAL.md`](features/EMAIL-PORTAL.md).

| # | Item | Where | Severity | Notes |
|---|------|-------|----------|-------|
| ~~E-1~~ | ~~Weekly R2 sweep can delete email attachments~~ | `src/workers/scheduled-asset-cleanup.ts` | ✅ RESOLVED 2026-07-08 | `email-attachments/` prefix now excluded unconditionally before orphan check (belt-and-suspenders over existing draft+ledger DB reference scan). |
| ~~E-2~~ | ~~Sanitize composed email HTML~~ | `RichEditor.tsx`, `api/emails/send.ts` | ✅ RESOLVED 2026-07-08 | Workers-native HTMLRewriter sanitizer (`src/lib/email/sanitize-html.ts`) strips scripts/iframes/on* attrs/javascript: URIs; applied server-side in `send.ts` and client-side in `RichEditor.tsx` value-sync. |
| ~~E-3~~ | ~~Hash sender IP at rest in the email ledger~~ | `src/pages/api/emails/send.ts` | ✅ RESOLVED (pre-existing) | `hashIp()` uses Web Crypto SHA-256 + site salt; `sender_ip` column stores the hash. |
| E-4 | Tighten the attachments endpoint | `src/pages/api/emails/attachments.ts` | 🟡 | Gate on the `#attachments` capability (currently only the broad page PLAC), add a server-side MIME allowlist, a cumulative-size cap enforced at send time, and filename sanitization. |
| E-5 | Move email SQL to the DAL + close audit gaps | `src/pages/api/emails/{drafts,templates}.ts` | 🟡 | Replace inline `env.DB.prepare(...)` with `[SUPABASE_PROJECT_REF]` / `EmailTemplateRepository` (per `coding-standards.md`); add Ghost-Audit coverage for draft and attachment actions (send/cancel/templates already audit). |
| E-6 | Validate recipient addresses, not just count | `src/pages/api/emails/send.ts`, `Composer.tsx` | 🟡 | `parseRecipientCount` only counts; invalid addresses flow into the queue payload. Add a shared zod validator used by the API and the composer. |

## 2026-07-08 Compliance-wave — CI-enforced burn-down

Surfaced by `scripts/rules_check.py` when the invariants in `RULESAd.md §9.0`
were first enforced. Shipped in **warn-only** mode; each PR should nibble at
the list. Once a rule reaches 0 violations, remove its exemption in
`.github/workflows/security.yml`.

| SEC | Debt | Count | Status |
|-----|------|:-----:|--------|
| SEC-03 | Raw `env.DB.prepare(...)` in API handlers instead of DAL repositories | ~~25~~ **0** | ✅ CLOSED (verified 2026-07-25) |
| SEC-04 | Hardcoded `['dev','owner','super_admin','admin']` role arrays | ~~12~~ **0** | ✅ CLOSED (verified 2026-07-25) |

✅ **Burn-down complete and CI is now blocking.** `scripts/rules_check.py`
reports 0 violations across all 11 rules, and `security.yml::rules-check` no
longer passes `--warn-only`. This table had listed both as open long after they
were actually fixed — re-verify against `python3 scripts/rules_check.py` rather
than trusting a status table.

## CSP hardening — pending operator verification (2026-07-22)

A same-day commit (`2f93119`) had reverted the 2026-07-08 nonce-based
`script-src` hardening (removed `'strict-dynamic'`, added `'unsafe-inline'`)
to fix a Sentry issue (CF-ADMIN-9). Re-reviewed and partially fixed same day:

| Item | Status | Notes |
|------|--------|-------|
| `'unsafe-inline'` removed from production `script-src` | ❌ **This entry was FALSE** — corrected 2026-07-25 | The directive still contained BOTH `'unsafe-inline'` and `'unsafe-eval'` on 2026-07-25, and SEC-01 could not detect it: the rule carried `exempt_line=r"unsafe-eval"`, so adding `'unsafe-eval'` silenced the `'unsafe-inline'` beside it. `'unsafe-eval'` is now removed (proven unused in `src/**` and in the built bundles) and the exemption is gone. `'unsafe-inline'` remains on the ENFORCING policy, with a `Content-Security-Policy-Report-Only` canary shipping the hardened directive — see the row below. |
| `SEC-01` glob fixed (`src/middleware.ts` → `src/lib/security/csp.ts`) | ✅ Done | The rule had been structurally blind to the file that actually holds the CSP string since CSP construction moved out of `middleware.ts`; it reported 0 violations even during today's regression. |
| Re-add `'strict-dynamic'` | 🟡 Blocked on operator | Suspected root cause of the original incident: Cloudflare zone-level auto-injected scripts (Web Analytics/Browser Insights beacon, Rocket Loader — both serve from `static.cloudflareinsights.com` / `/cdn-cgi/`, already in the host allowlist) are injected *after* the Worker response leaves the Worker, so they never receive this middleware's nonce. `'strict-dynamic'` makes browsers stop trusting host-allowlist/`'self'` entries for non-nonced scripts, which would break them again. **Operator action needed:** check the Cloudflare dashboard (Zone → Speed → Optimization for Rocket Loader; Zone → Analytics → Web Analytics/Browser Insights) for `secure.madagascarhotelags.com`. If either is enabled and not needed (Sentry + PostHog already cover telemetry), disable it, then re-add `'strict-dynamic'` behind a short (~24h, not the usual week — a duplicate `Report-Only` header double-counts every Sentry violation report) `Content-Security-Policy-Report-Only` canary before flipping to enforcing. If needed and can't be disabled, leave `'strict-dynamic'` off permanently and document why in `csp.ts`. |

## How to close an item

When an item is fixed in code, move its row out of this file and record it in the
relevant doc (e.g. `security/SECURITY.md` for security fixes) — do not edit the
archived snapshots.


## Accessibility burn-down (2026-07-25)

`scripts/a11y_check.py` ships `--warn-only`, matching the SEC-03/SEC-04 rollout
pattern above. A11Y-02/03/05/06 are at zero. Remaining:

| Rule | WCAG | Count | Fix |
|------|------|:-----:|-----|
| A11Y-01 | 4.1.2 | 39 | Add `aria-label` to each icon-only `<button>` |
| A11Y-04 | 2.4.4 | 6 | Add `aria-label` to each icon-only link |

Each needs an individually written label, so this cannot be automated
meaningfully. Once both reach 0, drop `--warn-only` from
`.github/workflows/quality.yml::accessibility`.
Context: `documentation/security/compliance/ACCESSIBILITY.md`.

## Open items surfaced by the 2026-07-25 compliance pass

| # | Item | Where | Severity | Notes |
|---|------|-------|----------|-------|
| C-1 | **Astro 6 → 7 upgrade.** 3 high XSS advisories are excepted with evidence in `.audit-exceptions.json`; the exceptions **expire 2026-10-23** and `audit_gate.py` fails the build on an expired entry. | `package.json` | 🟠 | Breaking major: also moves `@astrojs/cloudflare` 13→14 and `@astrojs/preact` 4→6. Verified non-exploitable today (no `transition:*`, no spread attrs, no ClientRouter). |
| C-2 | **`API_DENY_MODE` flip to `enforce`.** Currently `shadow`. | `wrangler.toml` | 🟠 | Query `SELECT request_path, COUNT(*) FROM admin_audit_log WHERE action='api_authz_shadow_deny' GROUP BY request_path;` — flip once it shows no legitimate traffic. |
| C-3 | **CSP `'unsafe-inline'` removal.** Report-Only canary is live. | `src/lib/security/csp.ts` | 🟠 | Blocked on operator verification of Cloudflare Rocket Loader (zone → Speed → Optimization). Once the canary reports no `script-src` violations, promote `SCRIPT_SRC_CANARY` and delete the Report-Only header. |
| ~~C-4~~ | ~~`List-Unsubscribe` + suppression list~~ | `src/pages/api/emails/{send,unsubscribe}.ts` | ✅ **CLOSED 2026-07-26** | RFC 8058 headers minted per recipient, D1 suppression table (`migrations/0008_email_suppression.sql`), HMAC one-click endpoint, pre-enqueue suppression check. **Follow-up (1) — DONE 2026-07-29.** `admin_email_suppression` and `idx_email_suppression_created` are now live in `madagascar-db`, verified by a full round-trip against the exact `EmailSuppressionRepository` queries (upsert incl. `ON CONFLICT`, `isSuppressed` lookup, delete), sentinel row removed, table at 0 rows.<br><br>**How this was missed for three days, and the lesson.** This entry was marked ✅ CLOSED on 2026-07-26 while follow-up (1) was still outstanding — so the feature was recorded as shipped while `admin_email_suppression` did not exist in production. Every `EmailSuppressionRepository` read and write was failing, and the public RFC 8058 one-click endpoint could not work, which is a CASL/CAN-SPAM exposure and not merely a missing feature. Nothing detected it: the test suite passes because `@cloudflare/vitest-pool-workers` applies migrations to a *local* miniflare D1, so tests prove the code is correct against the intended schema and say nothing about production. **Do not mark an item ✅ while a deployment step is still listed as a follow-up** — use 🟡 until the out-of-band step is actually applied and verified against the remote database. A schema check alone is not verification either; run the repository's own queries.<br><br>**Follow-up (2) — still open.** The `cf-email-consumer` worker must forward `data.unsubscribeHeaders[recipient]` onto the outbound Brevo/Resend send, and a visible unsubscribe footer belongs in that worker's templates — the header alone satisfies one-click but a visible link is also expected for marketing mail. Until this lands, the suppression table is populated only by the admin path, not by recipients. |
| C-5 | **SEC-11 Supabase advisor guard is planned, not implemented.** | `scripts/rules_check.py` | 🟡 | The two findings it should have caught are now **fixed and verified clear** (`supabase/migrations/20260726000000_advisor_fixes.sql`: `search_path` pinned on `increment_conversation_metrics`; the always-true `tool_call_events` policy replaced with a `service_role`-scoped one). Baseline refreshed. The remaining advisor — leaked-password protection — is a dashboard toggle with no code fix, and is moot here since the platform does not use Supabase GoTrue passwords. **Still open:** no automated guard re-runs `get_advisors` against the baseline, so drift is only caught by a manual run. |
| C-6 | **No IR/DR drill has ever been run.** | `documentation/runbooks/` | 🟠 | Both runbooks exist and both say so explicitly. SOC 2 CC7.5 / A1.3 require evidence the plan works — the drill, not the document. RTO/RPO figures are estimates until measured. |
| C-7 | **OpenAPI schema not generated.** Gap G10 — still open. | — | 🟡 | Zod schemas now cover 100% of JSON-body routes, so the input for a generator exists. Would close SOC2 IPY-02 and OWASP API9. |
| C-8 | **No prod/staging separation.** Gap G14. | `wrangler.toml` | 🟡 | Needs new Cloudflare resources; `GITHUB_RULES.md` §6 makes inventing binding UUIDs a production-outage risk, so this is an operator decision. |
| C-9 | **Audit log has no tamper-evidence.** Removing suppression (2026-07-26) fixed *coverage*: every action is now written and nobody can switch that off. It did not make the log tamper-*evident*. There is no hash chain, no sequence number, no signature, no WORM storage, and `admin_audit_log` remains a purge target in `src/lib/retention-tables.ts`. | `migrations/`, `src/lib/audit.ts` | 🟠 | Marketing no longer claims "tamper-evident", "immutable" or "append-only" anywhere, and a copy-lint rule in the Velox repo fails the build if those words return, so the exposure today is a missing feature rather than a false claim. **To close:** add a `prev_hash` column, chain each row to its predecessor, and expose a verify endpoint that walks the chain. **The hard part is concurrency, not hashing:** audit writes are fire-and-forget via `ctx.waitUntil` and can interleave, so a naive read-then-hash chain will fork under load. Needs either a single-writer (Durable Object) or a per-actor chain with a periodic signed checkpoint. Do not ship a chain that silently forks; a broken chain is worse than no chain, because it produces false tamper alarms. When this lands, delete the matching entry from `UNSUPPORTED_CLAIMS` in the Velox `copy-lint.test.ts` in the same change. |
| C-11 | **Role data migration is pending.** The code speaks the canonical vocabulary (`vendor_support > owner > admin > manager > staff > viewer`); both databases still hold the previous values, translated on read by `normalizeRole()` and on write by `toStoredRole()`. `viewer` therefore cannot be assigned yet: `toStoredRole()` throws rather than write a different role. | `supabase/migrations/`, `migrations/`, `src/lib/auth/rbac.ts` | 🟡 | **This is a safe steady state, not a half-finished change** — the translation layer means the Worker and the databases can never disagree about what a role means, so there is no deadline. **To close, in this order:** (1) migrate both stores with a **single `CASE` expression per table**, never two `UPDATE`s — `super_admin`→`admin` and `admin`→`manager` both touch the string "admin", so sequential updates silently collapse both tiers into `manager`; (2) verify per-role row counts before and after (expected in Supabase `admin_authorized_users`: manager 2, admin 1, owner 1, staff 1, vendor_support 1; in D1 `admin_pages.required_role`: manager 27, admin 26, owner 9, staff 6, vendor_support 3); (3) update the `admin_authorized_users_role_check` CHECK constraint and D1 migration 0018's constraint to the six canonical names; (4) update the `admin_read` RLS policy on `contact_message_comments`, which embeds `ARRAY['admin','super_admin','owner','dev']` in a JWT-claim check — dormant today because everything runs service-role, but a landmine the day a JWT path is added; (5) **only then**, and in its own commit with no other change, flip `ROLE_VOCABULARY` to `'canonical'` in `rbac.ts`; (6) delete `LEGACY_TO_CANONICAL` / `CANONICAL_TO_LEGACY` once the counts confirm zero legacy rows. Rollback is the inverse `CASE`, and remains available as long as the translation layer is deployed. |
| C-10 | **Login anomaly detection is named but not built.** `src/lib/auth/security-logging.ts` records the sign-in and emails the owner. There is no baselining, geo-velocity check, device-fingerprint comparison, breached-password lookup or automatic lockout; the only automated signal on the login path is the Cloudflare bot score in `pipeline.ts`. | `src/lib/auth/security-logging.ts` | 🟡 | The Velox module was renamed to "Login Forensics & Sign-In Alerts" and its copy now describes recording and alerting, with the detection features listed explicitly as roadmap. Reinstate the detection language only when the checks exist. |


## Staff Managed Storage follow-ups (2026-08-12)

From the Staff Managed Storage security/permissions/UI/UX remediation pass
(`documentation/features/STAFF-MANAGED-STORAGE.md`). Two of these are manual —
they cannot be closed by a code change and need to be done directly against
the Cloudflare dashboard.

| # | Item | Where | Severity | Notes |
|---|------|-------|----------|-------|
| S-1 | **CF Access bypass-policy scope for `/api/storage/request/*` unverified.** The route family needs a Zero Trust path-based bypass policy (mirroring the existing one for `/api/storage/share/*`) so external file-request recipients without a portal account can reach it — but this has never been independently re-verified against the live Zero Trust dashboard since the feature shipped. | Cloudflare Zero Trust Dashboard → Access → Applications | 🟠 manual | Getting this wrong in either direction is a real incident: too broad silently exposes an authenticated route past CF Access; too narrow breaks the feature for every vendor/vet without a portal account. See `security/SECURITY.md` §2a. |
| S-2 | **R2 object versioning not enabled on `madagascar-staff-storage`.** The bucket can hold payroll and medical records; a direct R2-level deletion or same-key overwrite is unrecoverable today even though the application-level Trash (30-day soft-delete window) covers accidental in-app deletes. | Cloudflare Dashboard → R2 → `madagascar-staff-storage` → Settings | 🟠 manual | No MCP tool exposes this toggle — dashboard-only. Recommended in `runbooks/disaster-recovery.md` §5, which also flags `madagascar-images` for the same gap. |
| S-3 | **File list pagination.** `StorageDrive.tsx`/`InspectExplorerTree.tsx` filter and sort entirely client-side against the full file list returned by `list.ts`/`admin/inspect.ts`. | `src/pages/api/storage/list.ts`, `StorageDrive.tsx` | 🔵 | Fine at current staff-count scale; becomes a real cost once any single drive holds hundreds of files. Requires moving filter/sort/paging server-side — larger scope than a quick fix, deliberately deferred rather than half-built. |
| S-4 | **Per-item upload-cancel button.** The upload modal has no way to cancel an individual in-flight file once presign/PUT/confirm has started; only closing the whole modal (which leaves any already-presigned R2 object for the reconciliation cron to clean up). | `UploadModal.tsx` | 🔵 | Minor UX gap, not a correctness or security issue — the orphaned-object cleanup path already handles the abandoned-upload case safely. |

## Commercial follow-ups (2026-07-26)

From `2026-07-26-commercial-model-costing-pricing-and-scale.md`. The delivery model is
**one dedicated deployment per client** — multi-tenancy is explicitly not being built.

| # | Item | Severity | Notes |
|---|------|----------|-------|
| M-1 | **Fleet tooling does not exist.** No `wrangler.template.toml`, no provisioning script, no fleet migration runner, no version/drift inventory. | 🟠 | **The binding constraint on the business.** Manual updates cap the fleet at ~10–15 clients; past that, updates stop happening, which is a compliance problem (unpatched CVEs, stale security rules). ~2–4 weeks of work — the highest-ROI engineering investment available, and far cheaper than the 2–4 months multi-tenancy would have cost. |
| M-2 | **Time one real update** to replace assumption A4. | 🟠 | 30 min/client is an estimate that has never been measured, and it drives 60–70% of modelled cost-to-serve. One measurement on the next deploy fixes the largest unknown in the pricing model. |
| M-3 | Pet-hotel domain not extracted from the framework. | 🟡 | `booking_pets`/`booking_quality_metadata` schema, hardcoded copy, `madagascar-*` binding names. Every new client deployment inherits tables it does not need. Phases A–E in `reference/commercial-readiness-checklist.md` — unstarted. |
| M-4 | Pricing has **zero customer validation**. | 🟡 | $250/$500/$900 tiers are derived from cost and competitor rates only. Validation plan in §12 of the commercial doc. |
| M-5 | Track support/incident hours for 90 days (assumption A6). | 🟡 | Currently modelled as $0. Could add 50–100% to true cost-to-serve. |
| M-6 | D1 storage is summed **per Cloudflare account**, not per database. | 🟡 | 5 GB included across the whole fleet. At 20 client databases that is ~250 MB each. Retention windows in `src/lib/retention-tables.ts` are a cost control, not only a privacy control. |

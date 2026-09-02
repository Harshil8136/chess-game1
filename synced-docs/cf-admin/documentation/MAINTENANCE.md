---

title: "Maintenance Backlog"
status: active
audience: [ai, technical]
last_verified: 2026-09-02
verified_against: [code, infra]
owner: harshil
related_docs: [archive/ToDoList.md, archive/PENDING_PHASES.md, security/SECURITY.md, program/ROADMAP.md]
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

> **Closing an item means re-verifying it, not remembering it.** The 2026-08-13
> truth pass found C-1 and C-2 still listed as open weeks after both had shipped,
> and a "dead table" note that a later commit had falsified. Every row here
> should be cheap to re-check against code — if it isn't, add the command that
> makes it cheap.

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
| ~~`cms_content_history` is a dead table (zero writers)~~ | (migration now in `database/legacy_migrations/`) | ❌ **Wrong as of 2026-08-13 — superseded by C-13 below.** The table has a writer: `recordCmsHistory()` in `src/lib/cms/storage.ts`, called on CMS block updates. This row was carried forward verbatim from the 2026-05-26 review, which was correct *then*, and was never re-checked after the writer shipped. |
| ~~Email Portal schema not provisioned by migrations~~ (RESOLVED 2026-06) | `database/legacy_migrations/0032_create_admin_email_tables.sql` | `migration 0032` now creates `admin_email_drafts` + `admin_email_templates`, seeds `custom_email_max_recipients`, and seeds the `#preview`/`#contacts` PLAC rows. Applied out-of-band to the shared `madagascar-db` (its default `d1_migrations` table tracks **cf-astro**, so cf-admin migrations are applied directly, not via `wrangler d1 migrations apply`). All statements are idempotent. |
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
were actually fixed — re-verify against `python scripts/rules_check.py` rather
than trusting a status table.

> **SEC-03 regressed and was re-closed on 2026-08-13.** The Search Console
> feature added 4 raw `env.DB.prepare(...)` calls back into
> `src/pages/api/seo/gsc-index-log.ts` and `gsc-index-log-export.ts`, plus one
> SEC-08 violation. Fixed by moving the queries into
> `src/lib/dal/GscIndexLogRepository.ts` — the same remedy **E-5** above still
> prescribes for the email routes, which remain open. A closed row in this table
> means "was clean when checked", never "cannot come back".

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


## Accessibility burn-down (2026-07-25) — ✅ closed, with one caveat

The original burn-down (A11Y-01 ×39, A11Y-04 ×6) was completed and the guard now
runs **blocking** in `npm run verify`, not `--warn-only`. A11Y-02/03/05/06 have
been at zero throughout.

**Regression and re-close, 2026-08-13.** The Search Console feature shipped on
2026-08-12/13 took the count back to 7 (A11Y-01 ×6, A11Y-04 ×1) while three
documents still recorded zero. Resolution:

- **6 of the 7 were false positives.** The buttons carry real multi-word labels
  ("Run Full Sweep", "Inspect URL", "Delete Record"), but the labels are rendered
  from inside a JSX expression container — the standard idiom for a button whose
  text changes while its action runs — and `has_text_content()` deleted every
  `{...}` container wholesale before looking for text. Fixed in the checker, not
  in the components; bolting an `aria-label` onto a button that already has
  visible text risks a WCAG 2.5.3 *Label in Name* mismatch, which would be a real
  defect introduced to silence a fake one. Residual gap tracked as **C-16**.
- **1 was genuine.** The target-URL link in `GscLogDetailDrawer.tsx` had the raw
  URL as its only text, which satisfies 2.4.4 but gives no cue that the link
  leaves the portal; it now carries an `aria-label` that keeps the URL inside the
  label (2.5.3) and adds that context.

Current state: `python scripts/a11y_check.py` → **0 findings over 254 files**.
Context: [`security/compliance/ACCESSIBILITY.md`](security/compliance/ACCESSIBILITY.md).

> The lesson worth keeping: a burn-down to zero is not durable unless the guard
> blocks *and* the docs are re-derived from the guard rather than from the last
> time someone looked. Both failures happened here within 24 hours.

## Open items surfaced by the 2026-07-25 compliance pass

| # | Item | Where | Severity | Notes |
|---|------|-------|----------|-------|
| ~~C-1~~ | ~~**Astro 6 → 7 upgrade.**~~ | `package.json` | ✅ **DONE — verified 2026-08-13** | Shipped: `astro ^7.1.6`, `@astrojs/cloudflare ^14.1.7`, `@astrojs/preact ^6.0.2`. **Follow-up still open (C-14):** `.audit-exceptions.json` still carries 3 Astro advisory exceptions written against Astro 6, and `npm audit --omit=dev` still reports 16 findings (4 high). Re-check whether those exceptions describe a resolved issue or a live one before they expire 2026-10-23. |
| ~~C-2~~ | ~~**`API_DENY_MODE` flip to `enforce`.**~~ | `wrangler.toml` | ✅ **DONE 2026-08-12** | `API_DENY_MODE = "enforce"` is live. The shadow-deny log was queried first: the only 4 historical `api_authz_shadow_deny` rows (2026-08-07, `/api/alerts` + `/api/alerts/scan`) predated the `API_PAGE_MAPPING` entry that already fixed that route, and no shadow-deny occurred on any route in the following 5 days. Rollback lever: set the value back to `"shadow"` and redeploy. |
| C-3 | **CSP `'unsafe-inline'` removal.** Report-Only canary is live. | `src/lib/security/csp.ts` | 🟠 | Blocked on operator verification of Cloudflare Rocket Loader (zone → Speed → Optimization). Once the canary reports no `script-src` violations, promote `SCRIPT_SRC_CANARY` and delete the Report-Only header. |
| ~~C-4~~ | ~~`List-Unsubscribe` + suppression list~~ | `src/pages/api/emails/{send,unsubscribe}.ts` | ✅ **CLOSED 2026-07-26** | RFC 8058 headers minted per recipient, D1 suppression table (`migrations/0008_email_suppression.sql`), HMAC one-click endpoint, pre-enqueue suppression check. **Follow-up (1) — DONE 2026-07-29.** `admin_email_suppression` and `idx_email_suppression_created` are now live in `madagascar-db`, verified by a full round-trip against the exact `EmailSuppressionRepository` queries (upsert incl. `ON CONFLICT`, `isSuppressed` lookup, delete), sentinel row removed, table at 0 rows.<br><br>**How this was missed for three days, and the lesson.** This entry was marked ✅ CLOSED on 2026-07-26 while follow-up (1) was still outstanding — so the feature was recorded as shipped while `admin_email_suppression` did not exist in production. Every `EmailSuppressionRepository` read and write was failing, and the public RFC 8058 one-click endpoint could not work, which is a CASL/CAN-SPAM exposure and not merely a missing feature. Nothing detected it: the test suite passes because `@cloudflare/vitest-pool-workers` applies migrations to a *local* miniflare D1, so tests prove the code is correct against the intended schema and say nothing about production. **Do not mark an item ✅ while a deployment step is still listed as a follow-up** — use 🟡 until the out-of-band step is actually applied and verified against the remote database. A schema check alone is not verification either; run the repository's own queries.<br><br>**Follow-up (2) — still open.** The `cf-email-consumer` worker must forward `data.unsubscribeHeaders[recipient]` onto the outbound Brevo/Resend send, and a visible unsubscribe footer belongs in that worker's templates — the header alone satisfies one-click but a visible link is also expected for marketing mail. Until this lands, the suppression table is populated only by the admin path, not by recipients. |
| C-5 | **SEC-11 Supabase advisor guard is planned, not implemented.** | `scripts/rules_check.py` | 🟡 | The two findings it should have caught are now **fixed and verified clear** (`supabase/migrations/20260726000000_advisor_fixes.sql`: `search_path` pinned on `increment_conversation_metrics`; the always-true `tool_call_events` policy replaced with a `service_role`-scoped one). Baseline refreshed. The remaining advisor — leaked-password protection — is a dashboard toggle with no code fix, and is moot here since the platform does not use Supabase GoTrue passwords. **Still open:** no automated guard re-runs `get_advisors` against the baseline, so drift is only caught by a manual run. |
| C-6 | **No IR/DR drill has ever been run.** | `documentation/runbooks/` | 🟠 | Both runbooks exist and both say so explicitly. SOC 2 CC7.5 / A1.3 require evidence the plan works — the drill, not the document. RTO/RPO figures are estimates until measured. **Scheduled:** viability program chunk 6 (`program/ROADMAP.md`) runs the DR drill against a temporary throw-away D1 and replaces every estimate with a measurement; the runbook's platform facts (7-day Time Travel, bucket locks not versioning) were corrected 2026-09-02. |
| C-7 | **OpenAPI schema not generated.** Gap G10 — still open. | — | 🟡 | Zod schemas now cover 100% of JSON-body routes, so the input for a generator exists. Would close SOC2 IPY-02 and OWASP API9. |
| C-8 | **No prod/staging separation.** Gap G14. | `wrangler.toml` | 🟡 declined | **Owner decision 2026-09-02 (`program/adr/ADR-0001-program-constraints.md`): no staging environment at the current scale.** Changes are built locally, tested on the dev server, then pushed. The compensating controls are real-binding tests (chunk 1), expand/contract migrations (chunk 5) and a release script that orders migrate-before-deploy (chunk 3). Re-open only if scale or a second client changes the calculus. |
| C-9 | **Audit log has no tamper-evidence.** Removing suppression (2026-07-26) fixed *coverage*: every action is now written and nobody can switch that off. It did not make the log tamper-*evident*. There is no hash chain, no sequence number, no signature, no WORM storage, and `admin_audit_log` remains a purge target in `src/lib/retention-tables.ts`. | `migrations/`, `src/lib/audit.ts` | 🟠 | Marketing no longer claims "tamper-evident", "immutable" or "append-only" anywhere, and a copy-lint rule in the Velox repo fails the build if those words return, so the exposure today is a missing feature rather than a false claim. **To close:** add a `prev_hash` column, chain each row to its predecessor, and expose a verify endpoint that walks the chain. **The hard part is concurrency, not hashing:** audit writes are fire-and-forget via `ctx.waitUntil` and can interleave, so a naive read-then-hash chain will fork under load. Needs either a single-writer (Durable Object) or a per-actor chain with a periodic signed checkpoint. Do not ship a chain that silently forks; a broken chain is worse than no chain, because it produces false tamper alarms. When this lands, delete the matching entry from `UNSUPPORTED_CLAIMS` in the Velox `copy-lint.test.ts` in the same change. |
| C-11 | **Role data migration is pending.** The code speaks the canonical vocabulary (`vendor_support > owner > admin > manager > staff > viewer`); both databases still hold the previous values, translated on read by `normalizeRole()` and on write by `toStoredRole()`. `viewer` therefore cannot be assigned yet: `toStoredRole()` throws rather than write a different role. | `supabase/migrations/`, `migrations/`, `src/lib/auth/rbac.ts` | 🟡 | **This is a safe steady state, not a half-finished change** — the translation layer means the Worker and the databases can never disagree about what a role means, so there is no deadline. **To close, in this order:** (1) migrate both stores with a **single `CASE` expression per table**, never two `UPDATE`s — `super_admin`→`admin` and `admin`→`manager` both touch the string "admin", so sequential updates silently collapse both tiers into `manager`; (2) verify per-role row counts before and after (expected in Supabase `admin_authorized_users`: manager 2, admin 1, owner 1, staff 1, vendor_support 1; in D1 `admin_pages.required_role`: manager 27, admin 26, owner 9, staff 6, vendor_support 3); (3) update the `admin_authorized_users_role_check` CHECK constraint and D1 migration 0018's constraint to the six canonical names; (4) update the `admin_read` RLS policy on `contact_message_comments`, which embeds `ARRAY['admin','super_admin','owner','dev']` in a JWT-claim check — dormant today because everything runs service-role, but a landmine the day a JWT path is added; (5) **only then**, and in its own commit with no other change, flip `ROLE_VOCABULARY` to `'canonical'` in `rbac.ts`; (6) delete `LEGACY_TO_CANONICAL` / `CANONICAL_TO_LEGACY` once the counts confirm zero legacy rows. Rollback is the inverse `CASE`, and remains available as long as the translation layer is deployed. |
| C-10 | **Login anomaly detection is named but not built.** `src/lib/auth/security-logging.ts` records the sign-in and emails the owner. There is no baselining, geo-velocity check, device-fingerprint comparison, breached-password lookup or automatic lockout; the only automated signal on the login path is the Cloudflare bot score in `pipeline.ts`. | `src/lib/auth/security-logging.ts` | 🟡 | The Velox module was renamed to "Login Forensics & Sign-In Alerts" and its copy now describes recording and alerting, with the detection features listed explicitly as roadmap. Reinstate the detection language only when the checks exist. |

## The 2026-08-13 documentation truth pass — what changed and why

A full read of all 88 docs plus the root policy files found the corpus had
drifted badly from the code. The drift had one structural cause worth stating
plainly, because it will recur otherwise:

> **`docs_check.py` validated shape, not truth.** Front-matter present, markdown
> links resolve, index matches disk, staleness warned at 120 days and never
> failed. Every one of the ~29 contradictions, the 39 dead code references, the
> 30 docs frozen at `2026-06-06`, and a `RULESAd.md` giving the table count as
> both 62 and 63 in the same file — all of it is *well-formed*, so the gate
> reported `✓ passed (0 warnings)` throughout.

The gate now also checks staleness (45 days, **blocking**), backticked code
paths, and mojibake, with reviewable escape hatches documented in
[`CONTRIBUTING-DOCS.md`](CONTRIBUTING-DOCS.md) §8. That is the part of this pass
that protects the rest of it.

**The three highest-value corrections**, for anyone auditing what moved:

1. **`npm run verify` was red** while `RULESAd.md` §9.0, `MAINTENANCE.md` and
   `ACCESSIBILITY.md` all reported zero violations. `rules_check` had 5 (SEC-03 ×4
   in the new Search Console routes, SEC-08 ×1) and `a11y_check` had 7. All fixed.
2. **The email provider question had four incompatible answers.** Settled against
   both repos: cf-admin sends **exclusively via Brevo**; `cf-email-consumer` uses
   Brevo with a Resend fallback; `resend_id` is a legacy column name, not evidence.
3. **`cf_astro_writer` was undocumented.** `PRIVACY.md` said `anon` still had
   INSERT on `consent_records`; `SECURITY.md` said all anon policies were dropped.
   Both were incomplete — the capability moved to a dedicated least-privilege
   role that no document mentioned. Now in `SECURITY.md` §10.2a.

## Opened by the 2026-08-13 documentation truth pass

| # | Item | Where | Severity | Notes |
|---|------|-------|----------|-------|
| ~~C-12~~ | ~~`public/_headers` exists, has drifted, and nobody agrees whether it is consumed.~~ | `public/_headers`, `src/lib/security/csp.ts` | ✅ **CLOSED 2026-09-02** (viability program chunk 2) | Settled against the Cloudflare docs and a build: Workers Static Assets applies `_headers` to **static-asset responses only**, never to SSR, and `@astrojs/cloudflare` appends its immutable `Cache-Control` rule for `/_astro/*` into it at build time, so the file must exist. It was trimmed to the four headers that mean something on a static file (HSTS, nosniff, Referrer-Policy, X-Robots-Tag); the drifted CSP, COOP/CORP, Permissions-Policy and the dead `/api/*` block were removed; `csp.ts` no longer claims the file was deleted. |
| C-13 | **`cms_content_history` grows unbounded.** `recordCmsHistory()` (`src/lib/cms/storage.ts`) writes a row on every CMS block update. The promised cleanup trigger from the original migration was never created, and the table has no retention entry. | `src/lib/cms/storage.ts`, `src/lib/retention-tables.ts` | 🟡 | Supersedes the long-standing "dead table, zero writers" note, which was true in May and re-quoted as current fact ever since. Either add a retention window (consistent with the other tables in `retention-tables.ts`) or cap history depth per block. Low urgency at current CMS edit volume, but it is now a growth curve rather than a flat line. |
| ~~C-14~~ | ~~**`.audit-exceptions.json` describes Astro 6.**~~ | `.audit-exceptions.json`, `scripts/audit_gate.py` | ✅ **CLOSED 2026-09-02** (viability program chunk 4) | All ten entries were stale — none matched an advisory in this package's tree (Astro 7 plus the `overrides` block fixed them at the source) — and were deleted; the shared 2026-10-23 expiry no longer exists. Root cause of the confusing local picture: run inside the npm workspace, `npm audit` read the **root** lockfile and reported a sibling project's `fast-uri` advisories. The gate now audits a copy of this package's `package.json` + `package-lock.json` in isolation (`--package-lock-only`), so local equals CI: 0 advisories on 2026-09-02. |
| ~~C-15~~ | ~~**`knip` is wired but not clean, and `knip.json` is misconfigured for Astro.**~~ | `package.json`, `knip.json` | ✅ **CLOSED 2026-09-02** (viability program chunk 4) — one follow-up | With `entry` patterns in place the 34 "unused files" and the alias "duplicate exports" were gone; what remained was the monorepo hoist: five binaries hidden from the member's `node_modules/.bin`, `tailwindcss` imported only from CSS, `dotenv-cli` exposing a binary under another name, and the `@vitest/*` pins. `knip.json` now says so and `npm run knip` exits 0. Real findings it surfaced were acted on: `@preact/signals` (zero imports; the repo has its own `src/lib/signalsCore.ts`) was removed and the five `@vitest/*` pins moved to `devDependencies`. **Follow-up:** `knip` runs only through the hoist locally; wiring it into `npm run verify` and the `quality` workflow needs it as a pinned devDependency — proposed in the chunk 4 record, pending owner approval. |
| C-19 | **`src/lib/auth/pipeline.ts` has outgrown its own exception.** It is **620** lines (re-counted 2026-09-02; 721 on 2026-08-23, 608 on 2026-08-13) against the 600-line `max-lines` warning granted to it in `eslint.config.js`. | `src/lib/auth/pipeline.ts`, `eslint.config.js` | 🟡 scheduled | **Decided 2026-09-02 (ADR-0002):** the file is decomposed into stages by viability program chunk 10 and the exception is deleted then. Chunk 4 corrected the exception's comment (it said 517) to the current count and pointed it at chunk 10, and `scripts/ratchet.py` A14 now holds the number of files over 600 lines (22) so no new one can appear. Do not raise the ceiling. |
| C-18 | **Decide whether `control-plane-design/` should be public at all.** *Partly closed 2026-08-23:* `PLAN.md` and `TECHNICAL_OVERVIEW.md` were moved to `archive/control-plane-design/` and re-statused `historical`, and their 12 `file:///` links to a developer's local Windows path were rewritten repo-relative. They are still inside the synced tree, so the publication question below stands for them and for `reference/control-plane-design/VISUAL-OVERHAUL-PLAN.md`. `archive/control-plane-design/PLAN.md` (80 KB) carried two notes asserting it was outside the synced tree; both were false — it sits under `documentation/` and has been copied to the public repo on every push. A live Upstash endpoint was recorded in its §16 inventory and has now been replaced with the binding name. | `documentation/archive/control-plane-design/`, `.github/workflows/sync-docs.yml` | 🟠 | The leak is closed, but the placement question is not: this is unimplemented internal design detail (provider API surfaces, config-write paths) sitting in a public repo. Options: accept and keep it scrubbed, or add an exclusion to `sync-docs.yml` (which currently copies **every** `.md` under `documentation/`). Also note the workflow's secret scan is **warning-only** and its patterns would not have caught a bare hostname. |
| C-17 | **Cancel-scheduled-send is documented but does not exist.** `features/EMAIL-PORTAL.md` described `POST /api/emails/cancel` as working behaviour and listed the file twice more in its inventory. There is no `src/pages/api/emails/cancel.ts` and no caller anywhere in `src/`. | `src/pages/api/emails/` | 🟡 | The doc now marks it as design intent rather than behaviour. Decide: build it (the ledger already carries `status: scheduled` and a provider message ID, so the pieces exist) or delete the spec. Do not leave a third state where the doc implies a feature that a user cannot find. |
| C-16 | **A11Y-01 has a residual false positive on single-word conditional labels.** `has_text_content()` in `a11y_check.py` now recognises multi-word labels rendered from inside a JSX expression container, which is what flagged the labelled SEO buttons on 2026-08-13. A single-word conditional label (`{busy ? 'Saving…' : 'Save'}`) is still reported as icon-only. | `scripts/a11y_check.py` | 🔵 | Deliberate: the rule errs toward flagging, per the script's own "a guard that cries wolf gets disabled" principle. Fix by recognising quoted string literals in a container, taking care not to count comparison values like `=== 'running'` as labels. |

## Opened by the 2026-08-23 documentation truth pass

Two code defects found while verifying documentation against live infrastructure
were **fixed in that pass** and are recorded here as closed, per "closing an item
means re-verifying it":

| # | Item | Files | Status |
|---|------|-------|--------|
| D-1 | **`/api/health` returned 503 unconditionally.** The Supabase probe queried a `roles` table that exists in no schema of the project (verified against `pg_class` via Supabase MCP, 2026-08-23). PostgREST answers an unknown relation with `42P01`; the handler treats any code other than `PGRST116` as a failure, so `overall` was always `error` while every dependency it checks was healthy. | `src/pages/api/health.ts` | ✅ closed — repointed at `admin_authorized_users`, the table every sign-in reads, and pinned by `test/health-probe-contract.test.ts` |
| D-2 | **`TopBar` depended on a router that is not mounted.** `handleRefresh` called `navigate()` from `astro:transitions/client`, but no `<ClientRouter />` exists anywhere in `src/` — navigation is full-page SSR by design — so only the `.catch()` reload fallback ever ran. | `src/components/navigation/TopBar.tsx` | ✅ closed — calls `window.location.reload()` directly; dead import removed |

Still open, and deliberately **not** changed in a documentation pass because both
alter authorization behaviour:

| # | Item | Files | Sev | Notes |
|---|------|-------|-----|-------|
| D-3 | **A guard gates on a deactivated PLAC page key.** `src/pages/api/users/[id]/session-status.ts` calls `placDenyResponse(session, '/dashboard/users/sessions')`. Migration `migrations/0002_promote_sessions_page.sql` set `is_active = 0` on those `admin_pages` rows when the page moved to `/dashboard/sessions` — confirmed against live D1 on 2026-08-23. The access map is built `WHERE is_active = 1`, so the key is absent from it and `requirePageAccess()` falls through to longest-prefix matching, landing on `/dashboard/users`. | `src/pages/api/users/[id]/session-status.ts`, `src/lib/auth/plac.ts` | 🟠 | It does **not** fail open — the parent deny still propagates — but the effective gate is `/dashboard/users`, not the sessions page, so a PLAC grant or deny scoped to sessions has no effect on this endpoint, which returns session telemetry (IP, User-Agent, geolocation, Ray ID). **To close:** decide whether the intended gate is `/dashboard/sessions` (the live page) or `/dashboard/users` (today's effective behaviour), then make the code say so explicitly. Either choice changes who can read session telemetry, so it needs an operator decision and a before/after check of per-role access — not a silent edit. |
| D-4 | **Two page keys for one route family.** `API_PAGE_MAPPING` in `src/lib/auth/routes.ts` maps `/api/sessions` → `/dashboard/sessions`, so the pipeline's default-deny evaluates that page; but all three handlers under `src/pages/api/sessions/` call `placDenyResponse(session, '/dashboard/users')`. Both gates must pass, so the effective requirement is access to **both** pages. | `src/lib/auth/routes.ts`, `src/pages/api/sessions/` | 🟡 | Not a hole — the stricter of the two wins — but the mapping and the handlers disagree about which page owns these routes, which makes the access matrix impossible to reason about from either source alone. Resolve to one page key. Related to D-3; fix them together. |

### Gate changes made in the same pass

`scripts/docs_check.py` gained root-doc code-path checking plus route, bare-`.md`,
`related_code` and `file:///` checks — and two pre-existing bugs in its
absence-cue escape hatch were fixed: `→` was matched across the whole 7-line
lookback window (so one decorative arrow in a heading disabled checking beneath
it), and the HTTP verbs `DELETE`/`DROP` matched the `delet`/`drop` cues (so any
route table documenting a DELETE suppressed its own neighbourhood). Cue matching
now ignores code spans and method names. Narrowing those two exposed four real
errors that had been hidden for months — worth remembering when adding a cue:
**a cue that is too broad is indistinguishable from a check that is switched off.**

### What this pass verified, and what it did not

`docs_check` reports two batch-stamp warnings. Both are expected, and the split
is the point — treat it as a coverage map, not noise.

**Re-verified on 2026-08-23 (13 docs, `last_verified` bumped).** Claims checked
against the code, `wrangler.toml`, or live infrastructure through the Cloudflare
and Supabase MCP connectors: `README.md` (index, every Status cell against
front-matter), `CONTRIBUTING-DOCS.md`, this file, `operations/OPERATIONS.md`
(bindings, KV/R2/D1 names and IDs, migration counts), `features/SESSION-MANAGEMENT.md`
and `features/USER-MANAGEMENT.md` (PLAC page keys against `admin_pages` in live
D1), `architecture/plac-and-audit.md`, `security/SECURITY.md` (the `/api/media`
route table against `API_PAGE_MAPPING`), `security/THREAT-MODEL.md`,
`2026-08-06-data-infrastructure-audit-and-reuse-policy.md` (all four table
counts re-queried live), `reference/SYNC-SYSTEM-REVIEW.md`, plus the two runbooks
already dated 2026-08-23.

**Still carrying the 2026-08-13 batch stamp (24 docs) — NOT re-verified here.**
They were mass-stamped by the previous pass, and this one did not re-check their
substantive claims, so their date is inherited rather than earned. Several had
citations repointed (the compliance mappings, `runbooks/disaster-recovery.md`)
and that alone is not verification; their dates were deliberately left alone
rather than bumped, because a bumped date is a claim in itself. Their **paths and
routes** are now machine-checked by `docs_check` on every push, so the mechanical
half is covered; the prose half is not. Work through them in the next pass.

**One claim could not be verified from this environment.** RULE #0.8's env-var
figure is `17 [vars] + 24 secrets = 41`. The 17 was re-counted directly from
`wrangler.toml` and is correct. The 24 was not: Worker secret names are not
exposed by any read-only MCP tool, and confirming them needs `wrangler secret
list` against the production account. Until someone runs that, treat the 24 —
and therefore the 41 — as inherited, not verified.

## Staff Managed Storage follow-ups (2026-08-12)

From the Staff Managed Storage security/permissions/UI/UX remediation pass
(`documentation/features/STAFF-MANAGED-STORAGE.md`). Two of these are manual —
they cannot be closed by a code change and need to be done directly against
the Cloudflare dashboard.

| # | Item | Where | Severity | Notes |
|---|------|-------|----------|-------|
| S-1 | **CF Access bypass-policy scope for `/api/storage/request/*` unverified.** The route family needs a Zero Trust path-based bypass policy (mirroring the existing one for `/api/storage/share/*`) so external file-request recipients without a portal account can reach it — but this has never been independently re-verified against the live Zero Trust dashboard since the feature shipped. | Cloudflare Zero Trust Dashboard → Access → Applications | 🟠 manual | Getting this wrong in either direction is a real incident: too broad silently exposes an authenticated route past CF Access; too narrow breaks the feature for every vendor/vet without a portal account. See `security/SECURITY.md` §2a. |
| S-2 | **`madagascar-staff-storage` has no protection against R2-level deletion or same-key overwrite.** The bucket can hold payroll and medical records; the application-level Trash (30-day soft-delete window) covers accidental in-app deletes only. **Premise corrected 2026-09-02:** this row asked for "R2 object versioning", which R2 does not offer — the platform primitive is a **bucket lock** (retention policy), and a lock would also block the app's own Trash hard-delete and the weekly reconciliation cron. | `runbooks/disaster-recovery.md` §5 | 🟠 decision | Taken as a design decision in viability program chunk 6 (`program/ROADMAP.md`): bucket lock vs scheduled copy, with a measured drill. Not a dashboard toggle. |
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

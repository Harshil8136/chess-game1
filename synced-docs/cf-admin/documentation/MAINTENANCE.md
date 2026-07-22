---

title: "Maintenance Backlog"
status: active
audience: [ai, technical]
last_verified: 2026-06-06
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
| E-5 | Move email SQL to the DAL + close audit gaps | `src/pages/api/emails/{drafts,templates}.ts` | 🟡 | Replace inline `env.DB.prepare(...)` with `EmailDraftRepository` / `EmailTemplateRepository` (per `coding-standards.md`); add Ghost-Audit coverage for draft and attachment actions (send/cancel/templates already audit). |
| E-6 | Validate recipient addresses, not just count | `src/pages/api/emails/send.ts`, `Composer.tsx` | 🟡 | `parseRecipientCount` only counts; invalid addresses flow into the queue payload. Add a shared zod validator used by the API and the composer. |

## 2026-07-08 Compliance-wave — CI-enforced burn-down

Surfaced by `scripts/rules_check.py` when the invariants in `RULESAd.md §9.0`
were first enforced. Shipped in **warn-only** mode; each PR should nibble at
the list. Once a rule reaches 0 violations, remove its exemption in
`.github/workflows/security.yml`.

| SEC | Debt | Count | Where | Fix pattern |
|-----|------|:-----:|-------|-------------|
| SEC-03 | Raw `env.DB.prepare(...)` in API handlers instead of DAL repositories | 25 | `src/pages/api/audit/**`, `bookings/**`, `system/**`, `users/**`, `auth/logout.ts`, `chatbot/**` | Move SQL to a repository under `src/lib/dal/*Repository.ts` per `coding-standards.md`; import + use in the handler. |
| SEC-04 | Hardcoded `['dev','owner','super_admin','admin']` role arrays | 12 | `src/pages/api/emails/*.ts`, `src/pages/api/media/revalidate.ts` | Replace with `isAdmin(user.role as Role)` from `src/lib/auth/rbac.ts`. |

Track progress by re-running `python3 scripts/rules_check.py` locally.
Once both drop to 0, flip CI to blocking (`security.yml::rules-check` remove `--warn-only`).

## CSP hardening — pending operator verification (2026-07-22)

A same-day commit (`2f93119`) had reverted the 2026-07-08 nonce-based
`script-src` hardening (removed `'strict-dynamic'`, added `'unsafe-inline'`)
to fix a Sentry issue (CF-ADMIN-9). Re-reviewed and partially fixed same day:

| Item | Status | Notes |
|------|--------|-------|
| `'unsafe-inline'` removed from production `script-src` | ✅ Done | Was already inert — any browser that honors the response's `nonce-` source ignores `'unsafe-inline'` regardless of `'strict-dynamic'`. Zero behavior change, closes the flagged literal string. |
| `SEC-01` glob fixed (`src/middleware.ts` → `src/lib/security/csp.ts`) | ✅ Done | The rule had been structurally blind to the file that actually holds the CSP string since CSP construction moved out of `middleware.ts`; it reported 0 violations even during today's regression. |
| Re-add `'strict-dynamic'` | 🟡 Blocked on operator | Suspected root cause of the original incident: Cloudflare zone-level auto-injected scripts (Web Analytics/Browser Insights beacon, Rocket Loader — both serve from `static.cloudflareinsights.com` / `/cdn-cgi/`, already in the host allowlist) are injected *after* the Worker response leaves the Worker, so they never receive this middleware's nonce. `'strict-dynamic'` makes browsers stop trusting host-allowlist/`'self'` entries for non-nonced scripts, which would break them again. **Operator action needed:** check the Cloudflare dashboard (Zone → Speed → Optimization for Rocket Loader; Zone → Analytics → Web Analytics/Browser Insights) for `secure.madagascarhotelags.com`. If either is enabled and not needed (Sentry + PostHog already cover telemetry), disable it, then re-add `'strict-dynamic'` behind a short (~24h, not the usual week — a duplicate `Report-Only` header double-counts every Sentry violation report) `Content-Security-Policy-Report-Only` canary before flipping to enforcing. If needed and can't be disabled, leave `'strict-dynamic'` off permanently and document why in `csp.ts`. |

## How to close an item

When an item is fixed in code, move its row out of this file and record it in the
relevant doc (e.g. `security/SECURITY.md` for security fixes) — do not edit the
archived snapshots.

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
| 16 | Simplify `effectiveSiteUrl` (`const effectiveSiteUrl = env.SITE_URL;` — drop the `process.env` branch) | `src/middleware.ts` | 🟡 | Hygiene |
| 18 | Fail-closed default for chatbot proxy `minRole` (`return 'dev'` instead of `'admin'`) | `src/pages/api/chatbot/[...path].ts` | 🟡 | Not fail-open today (entry `requireAuth(ctx,'admin')` matches default); defensive |
| 20 | Use `isAdmin()` helper instead of a hardcoded role allowlist | `src/pages/api/media/upload.ts` | 🟡 | Separate from the already-shipped PLAC wiring |
| 22 | `cf_admin_theme` cookie → `SameSite=Strict` to match session cookie | `src/pages/api/settings/user.ts` | 🟢 | UI preference only, no security impact |
| 25 | Misc low items (L-1…L-12). Notably `ModelsCatalog` `dangerouslySetInnerHTML` → JSX (partially resolved: load-bearing comment added; full JSX conversion still open) | `src/components/admin/chatbot/ModelsCatalog.tsx` + others | 🔵 | See `archive/PENDING_PHASES.md` for the full L-item detail |

**Suggested ordering:** 13 (policy) → 14 (validation) → 16+18+20+22 (single hygiene PR) → 25 batch.

## Documentation follow-ups discovered during the audit

| Item | Where | Notes |
|------|-------|-------|
| `cms_content_history` is a dead table (zero writers) | `migrations/0026_cms_content_history.sql` | Either ship the version-history feature (writers + UI + trigger) or drop the migration. Currently a maintenance trap, not a runtime bug. |
| Email Portal schema not provisioned by migrations | `src/pages/api/emails/drafts.ts`, `templates.ts`; `migrations/` | `admin_email_drafts`, `admin_email_templates`, the `/dashboard/emails` PLAC page seed, and the `custom_email_max_recipients` portal setting are referenced by code but have no migration file. Add a migration (and seed) so the feature provisions cleanly. See [`features/EMAIL-PORTAL.md`](features/EMAIL-PORTAL.md) §10. |
| Drafts "autosave" copy vs. behavior | `src/components/admin/emails/_components/EmailPortal.tsx` (Drafts instructions), `Composer.tsx` | UI copy claims drafts auto-save every 15s; the implementation saves on the explicit **Save Draft** action only. Either add the timer or correct the copy. |

## Email Portal hardening backlog (2026-06-07 review)

Code follow-ups from the deep review of `src/components/admin/emails/` and
`src/pages/api/emails/`. See [`features/EMAIL-PORTAL.md`](features/EMAIL-PORTAL.md).

| # | Item | Where | Severity | Notes |
|---|------|-------|----------|-------|
| E-1 | Weekly R2 sweep can delete email attachments | `src/workers/scheduled-asset-cleanup.ts` | 🔴 data-loss | The Sunday cron treats any `IMAGES` object not referenced in `cms_content` as orphaned. `email-attachments/` blobs are never in `cms_content`, so they can be deleted out from under saved drafts / in-flight sends. Exclude the prefix or honour draft+ledger references; only then use it to GC truly-orphaned uploads. |
| E-2 | Sanitize composed email HTML (defense-in-depth) | `RichEditor.tsx`, `QueueTracker.tsx`, `logs/shared.tsx`, `api/emails/send.ts` | 🟠 | Operator-authored HTML is stored and previewed without sanitization. Add server + client sanitization and restrict link schemes to `http`/`https`/`mailto`. (Portal is admin-only, so impact is bounded, but this is standard hardening.) |
| E-3 | Hash sender IP at rest in the email ledger | `src/pages/api/emails/send.ts` | 🟡 privacy | `email_audit_logs.sender_ip` currently stores the raw `cf-connecting-ip` despite a "hashing for privacy" comment. Hash it (Web Crypto SHA-256) and fix the comment. |
| E-4 | Tighten the attachments endpoint | `src/pages/api/emails/attachments.ts` | 🟡 | Gate on the `#attachments` capability (currently only the broad page PLAC), add a server-side MIME allowlist, a cumulative-size cap enforced at send time, and filename sanitization. |
| E-5 | Move email SQL to the DAL + close audit gaps | `src/pages/api/emails/{drafts,templates}.ts` | 🟡 | Replace inline `env.DB.prepare(...)` with `EmailDraftRepository` / `EmailTemplateRepository` (per `coding-standards.md`); add Ghost-Audit coverage for draft and attachment actions (send/cancel/templates already audit). |
| E-6 | Validate recipient addresses, not just count | `src/pages/api/emails/send.ts`, `Composer.tsx` | 🟡 | `parseRecipientCount` only counts; invalid addresses flow into the queue payload. Add a shared zod validator used by the API and the composer. |

## How to close an item

When an item is fixed in code, move its row out of this file and record it in the
relevant doc (e.g. `security/SECURITY.md` for security fixes) — do not edit the
archived snapshots.

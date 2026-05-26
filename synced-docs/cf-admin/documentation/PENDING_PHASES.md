# cf-admin — Pending Hardening Items

> **Last Updated:** 2026-05-26 (post deep-review follow-up commit `27e6090` — closes M-1, M-2, M-3, M-6, M-10, M-12, M-14, L-10, L-14)
>
> **Context:** Phases 1A–11 of the original refactor + the 2026-05-24 security review + the 2026-05-25 deep review (C-1, C-2, H-1..H-5) + the 2026-05-26 follow-up pass are all complete on `main`. This document tracks what remains from the 2026-05-25 review — every item that had a meaningful exploit path or functional impact has shipped; the residue is policy decisions, dead-code cleanup, and advisor lints.
>
> **Severity legend:** 🟡 Medium = real bug or hardening gap, fix within ~2 weeks. 🔵 Low/Info = polish, defense-in-depth, advisor lints.

---

## 🟡 Medium — 4 items still open (was 14)

| # | Area | File / Location | Issue | Fix sketch |
|---|---|---|---|---|
| M-4 | Audit immutability | `src/pages/api/audit/logs.ts:113–174` (DELETE handler) | Even after the new PLAC gate, DEV/Owner can bulk-delete audit entries by ID. Audit log should be append-only. | Genuinely a **policy decision** — the UI's "Delete Selected" button in `ActivityCenter` depends on this. Either remove the button and the DELETE export together, or require an external break-glass token rather than a role check. |
| M-5 | Input validation | `src/pages/api/users/manage.ts:100–121` | POST `pageOverrides[].pagePath` not validated against `admin_pages` existence; Gate D ceiling check not applied to creation-time overrides | Look up each pagePath in `admin_pages` before insert; reject if missing; apply `ROLE_LEVEL[actor.role] <= ROLE_LEVEL[pageDef.requiredRole]` for grants |
| M-7 | Middleware ergonomics | `src/middleware.ts:170` | `process.env.SITE_URL ?? env.SITE_URL` reverses the intended precedence; not currently exploitable (both env paths agree today) but fragile | Use `env.SITE_URL` only |
| M-9 | Proxy hardening | `src/pages/api/chatbot/[...path].ts:54` | `getMinRole` defaults to `'admin'` when no rule matches — same as the function-entry `requireAuth(ctx, 'admin')` gate, so not currently fail-open, but a divergence if either side changes. Defense-in-depth fix: default to `'dev'`. | Default to `'dev'` (most-restrictive); document the upgrade path |
| M-11 | Maintainability | `src/pages/api/media/upload.ts:39` | Hardcoded role allowlist `['dev','owner','super_admin','admin']` instead of `isAdmin()` helper | Replace with `if (!isAdmin(user.role as Role))` |
| M-13 | Cookie consistency | `src/pages/api/settings/user.ts:157,163` | `cf_admin_theme` cookie uses `SameSite=Lax` while the session cookie uses `Strict`. UI preference only, no security impact, but inconsistent | Switch to `Strict` |

---

## 🔵 Low / Info — 12 items still open (was 14)

| # | Area | Where | Note |
|---|---|---|---|
| L-1 | Robustness | `src/pages/api/auth/logout.ts:35` | `siteUrl.includes('localhost')` would treat `app.localhost.com` as dev; not exploitable, fragile. Parse via `new URL(...).hostname` |
| L-2 | Defense-in-depth | `src/lib/auth/cloudflare-access.ts:140–146` | No `nbf` (not-before) check. CF Access tokens don't include `nbf` in practice but add `if (claims.nbf && claims.nbf > nowSec + 60) return null;` |
| L-3 | Load shedding | `src/pages/api/dashboard/metrics.ts` | No rate limit; aggregates heavy upstream queries | Add `getRateLimiter({ requests: 30, window: '1 m' }, 'dash-metrics')` |
| L-4 | Defense-in-depth | `src/pages/dashboard/content/hero.astro:329` | `statusEl.innerHTML = ${message}` — `message` is currently server-controlled / hardcoded but vulnerable to future drift | Use `textContent` |
| L-5 | Worker budget | `src/workers/scheduled-log-sync.ts:140,166` | `setTimeout` waits up to ~24 s total inside a scheduled handler | Track elapsed time and bail out before exceeding the 30 s wall-clock budget |
| L-6 | Data model consistency | `src/lib/audit.ts` | The `details` field is free-text; some callers pass `JSON.stringify({...})`, others plain strings. Inconsistent rendering downstream | Standardize on `JSON.stringify` |
| L-7 | Proxy hardening (defense-in-depth) | `src/pages/api/chatbot/[...path].ts:77,86–89` | Reject slug containing `..` or leading `/` before concatenating into upstream URL |
| L-8 | Supabase advisor (security) | Project `zlvmrepvypucvbyfbpjj` | `auth_leaked_password_protection` disabled. Not used by cf-admin (CF Access) but relevant if sibling project uses Supabase Auth | Enable in Supabase Dashboard → Auth → Password Security |
| L-9 | Supabase advisor (performance) | Project `zlvmrepvypucvbyfbpjj` | 28 unused indexes flagged across `bookings`, `chat_analytics`, `consent_records`, `email_audit_logs`, `feedback_events`, `intent_events`, `kb_gaps`, `legal_requests`, `privacy_requests`, `admin_authorized_users(cf_sub_id)` | Drop only after confirming no cf-astro / cf-chatbot usage |
| L-11 | Cron resilience | `src/workers/cf-entry.ts` | The fix for C-2 accepts both patterns; once Cloudflare normalizes the cron API behavior consistently, the redundant arm can be dropped | Verify via observability logs after a few Sunday runs |
| L-12 | CI / sync-docs | `.github/workflows/sync-docs.yml` (PII Redaction step) | PII pattern catches only `harshil*@*` — too narrow as contributor base grows | Broaden to a generic developer-PII regex (and/or a maintained allowlist of business emails) |
| L-13 | Info disclosure (minor) | `src/pages/api/health.ts` | Returns which CF bindings are configured (D1, R2, KV, Supabase). Inside the auth gate so only authenticated users see it — acceptable, documented here for awareness | Acceptable as-is |

---

## Resolved 2026-05-26 (commit `27e6090`)

All items below verified shipped on `main` — see `SECURITY-REVIEW-2026-05-26.md` for the full report.

| # | Original Issue | Resolution |
|---|---|---|
| M-1 | `operational_status` accepted any string | Allow-listed via `VALID_OPERATIONAL_STATUS` set; `internal_notes` capped at 2000 chars; reject otherwise with 400 |
| M-2 | `JSON.parse` crash in content GET routes | Wrapped in try/catch with empty-array fallback in `reviews.ts`, `faqs.ts`, `stats.ts` |
| M-3 | `writeRevocationFlag` hardcoded TTL | Now reads `SESSION_MAX_LIFETIME_MS` via `getSessionTiming(getRawEnv())`, floor 60 s. (Note: the second copy at `plac.ts:363` cited in the 2026-05-25 review did not exist — that finding was speculative; only the `session.ts` version was real and is now fixed.) |
| M-6 | `X-Forwarded-For` IP fallback | Split on comma, take leftmost entry; `CF-Connecting-IP` still preferred |
| M-10 | `scheduled-log-sync` email amplification | Capped at 5 alert emails per batch with a digest line on the last email; all failures still write to D1 |
| M-12 | `public/_headers` vs middleware CSP divergence | Aligned byte-for-byte with middleware CSP + added reference-only banner clarifying `_headers` is not consumed at runtime by Workers deploys |
| M-14 | Missing PLAC on `settings/portal`, `content/*`, `media/*`, remaining `users/*` | All 18 routes now call `placDenyResponse(user, '/dashboard/<page>')` after their role gate. Full route table in `SECURITY.md` §6a |
| L-10 | `ModelsCatalog` `dangerouslySetInnerHTML` | Load-bearing comment added explaining the numeric-only safety invariant + migration path to JSX when any string field is interpolated |
| L-14 | 16 npm audit vulnerabilities | `npm audit fix` + `@astrojs/cloudflare ^13.5.4` + `@astrojs/check ^0.9.9` + reclassification of `@astrojs/check` to `devDependencies`. Production `npm audit` is now 0. |

### Bonus hardening shipped in the same commit

- `users/access.ts` — PLAC-denied admin can no longer mutate PLAC (`placDenyResponse(actor, '/dashboard/users')` added before the existing 5-gate hierarchy).
- `audit/{login-logs, export}.ts` — parent-deny propagation: `placDenyResponse(actor, '/dashboard/logs')` added as first gate so a deny on the parent page blocks the hash sub-pages too.
- `users/active-sessions` DELETE — 30/min revoke rate limit added.
- `users/active-revocations` DELETE — 30/min unblock rate limit added.
- `users/cf-access-audit` GET — 10/min rate limit added (endpoint enumerates every user CF Access knows about).
- `audit/silence.ts` — `placDenyResponse(session, '/dashboard/audit')` added for defence-in-depth (DEV is exempt anyway, but documents intent).
- `@astrojs/check` moved from `dependencies` → `devDependencies` (build-only tool; removes the entire `language-server → volar → yaml` chain from production audit surface).

---

## Recommended Order

1. **M-4 — Audit-log immutability decision.** Coordinate with product: keep the "Delete Selected" UI button (and accept the policy) or remove both. Once decided, the code change is mechanical.
2. **M-5 — pageOverrides validation.** Privileged action so impact is limited, but it's a one-PR clean-up that also tightens Gate D.
3. **M-7 — `process.env` precedence cleanup.** Two-line change. Worth doing alongside any other middleware edit.
4. **M-9, M-11, M-13 — opportunistic.** Bundle when convenient.
5. **L batch.** All 12 low items are defensive polish or advisor lints. Land as a single hygiene PR when there's a quiet week. L-3 (rate limit on `/api/dashboard/metrics`) and L-7 (chatbot slug `..` rejection) are the highest-value of the lot.

### Genuinely dead — drop or implement

- **migration 0026 — `cms_content_history` table.** Created with a stub comment promising trigger-based cleanup that was never built. The 2026-05-26 review verified **no code reads from or writes to this table.** Either ship the version-history feature (writers + UI + the missing trigger) or drop the migration. Currently it's a maintenance trap.

---

## Previously Resolved (record only)

- Phases 1A–11 of the original refactor (SQL injection, rate limiting, dead code, type safety, component splitting, ErrorBoundary, CSS architecture, accessibility, Session Forensics, Theme Hardening) — see `COMPLETED_PHASES.md` for the full record.
- 2026-05-24 deep review's 7 patches — see `SECURITY-REVIEW-2026-05-24.md`.
- 2026-05-25 deep review's Critical + High patches (C-1, C-2, H-1..H-5) — see `SECURITY-REVIEW-2026-05-25.md` and `COMPLETED_PHASES.md` § Phase 12.
- 2026-05-26 deep-review follow-up (Medium and Low closures + dependency CVEs) — see `SECURITY-REVIEW-2026-05-26.md` and `COMPLETED_PHASES.md` § Phase 13.

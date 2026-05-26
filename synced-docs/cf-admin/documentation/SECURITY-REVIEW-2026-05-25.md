# Security Vulnerability Review — CF-Admin Madagascar
**Date:** 2026-05-25
**Reviewer:** Automated deep scan
**Branch (merged):** `claude/codebase-security-review-LhIkr` → `main` (PR #2, merge commit `3f8cd78`)
**Scope:** Full codebase pass — middleware, all 50 API routes, frontend rendering, workers, scheduled crons, GitHub workflows, dependency CVEs, live Supabase advisors

---

## Executive Summary

A fresh full-codebase pass on top of the 2026-05-24 review surfaced **35 new findings**: **2 Critical**, **5 High**, **14 Medium**, **14 Low**. All Critical and High items shipped to `main` in PR #2 as 7 atomic commits. Medium and Low items are tracked in `PENDING_PHASES.md` for follow-up.

The codebase's posture remains strong — RBAC numeric hierarchy, KV-backed sessions, Ghost Audit, fail-closed CSRF, parameterized D1 queries, all-RLS-enabled Supabase tables, magic-byte upload validation — but the review found one critical PLAC bypass (spoofed role in the request body) and a critical functional bug (the weekly asset-cleanup cron never fired due to a pattern-string mismatch). Both are now patched.

---

## Patches Shipped in PR #2 (`main`)

| # | Severity | Commit | File(s) | Vulnerability | Fix |
|---|---|---|---|---|---|
| C-1 | 🔴 Critical | `777727b` | `src/pages/api/users/access.ts` | **PLAC bypass via spoofed `targetUserRole`** — Hierarchy Gates A (rank) and B (ghost) read `targetUserRole` from the request body. An admin (level 3) could send `targetUserRole: "staff"` while targeting a super_admin to revoke their page access (lockout) or self-grant a previously-denied page within their own clearance. | Fetch verified role + email from `admin_authorized_users` on every call; use DB values for all gates and audit log payload. Forbid `actor.userId === targetUserId` — denies must not be self-removable and grants must not be self-administered. `body.targetUserRole` is treated as informational only. |
| C-2 | 🔴 Critical | `d89ceae` | `src/workers/cf-entry.ts` | **Weekly asset-cleanup cron never ran** — wrangler.toml triggers `"0 2 * * SUN"` (Cloudflare rejects the numeric `0` form), but the dispatcher only matched `"0 2 * * 0"`. CF echoes the original pattern back on `ScheduledEvent`, so the equality check failed and R2 grew unbounded. | Dispatcher now accepts both `"0 2 * * SUN"` and `"0 2 * * 0"`. |
| H-1 | 🟠 High | `7a69d23` | `src/lib/csrf.ts` | **CSRF Referer prefix bypass** — `referer.startsWith(siteUrl)` would accept `https://secure.example.com.attacker.com/...` when `SITE_URL` was `https://secure.example.com`. Modern browsers send Origin so the exposure is narrow, but some webviews/older clients strip Origin on same-origin redirects. | Anchored match: exact equality to the normalized SITE_URL, or prefix followed by `/`. |
| H-2 | 🟠 High | `29c5445` | `src/pages/api/settings/user.ts` | **Cross-user settings edit ignored target hierarchy** — POST verified the editor was admin+ but never checked the target's role. An admin could rewrite a super_admin's `display_name` (rendered widely in the admin UI), enabling visual impersonation. | When editing another user, fetch target role from `admin_authorized_users` and reject unless editor strictly outranks the target. DEV remains exempt. |
| H-3 | 🟠 High | `7e04bf4` | `src/pages/api/audit/silence.ts` | **DEV self-silence + KV TTL rejuvenation** — A compromised DEV could pass their own `userId` to silence their own audit trail. Separately, `propagateAuditSilence` wrote every active KV session back with `expirationTtl = SESSION_MAX_LIFETIME` (24h from now), rejuvenating sessions past their `createdAt`-anchored hard expiry — same bug previously fixed in `patchSession`. | Reject `targetUserId === session.userId` (requires a second DEV to flip the flag). Compute remaining TTL from `session.createdAt` and floor at 60s; read `SESSION_MAX_LIFETIME_MS` from env instead of hard-coding. |
| H-4 | 🟠 High | `8132ec6` | `src/lib/auth/guard.ts` + 10 routes | **Most API routes bypass PLAC entirely** — Middleware deliberately skips PLAC for `/api/*` (each route picks its own auth posture). Many data-bearing routes relied only on role and ignored explicit denies on the corresponding dashboard page. A super_admin with a PLAC deny on `/dashboard/users` could still call `/api/users/manage`, `/api/users/force-kick`, etc. with full effect. | Added `requirePageAccess()` + `placDenyResponse()` helpers in `guard.ts`. Wired into the highest-risk routes: all `/api/audit/*` data endpoints (emails, sessions, stats, logs, consent, receipts) + `audit/prune`, plus `users/{manage, force-kick, access-data}`. Helper honors deny resolution rules (exact match + longest-prefix), exempts DEV (break-glass tier). |
| H-5 | 🟠 High | `208bc13` | `src/lib/auth/cloudflare-access.ts` | **JWKS cache double-fetch on key rotation** — The cache-bust-and-retry path fetched fresh keys into a local variable it never used, then fell through to a third `fetchPublicKeys()` call (served from the freshly warmed cache). Functionally correct but confusing and one redundant round-trip per rotation. The next reviewer would read this as "use stale key" — exactly what almost happened in this audit. | Single reassignable variable; behavior otherwise identical. |

### Additional fixes bundled with H-4

- `access-data.ts` now performs ghost protection — non-DEV actors cannot enumerate a DEV/Owner PLAC matrix via this endpoint. (The `/api/users` listing endpoint already hid DEV from non-DEV; access-data was a back door.)
- `audit/prune.ts` is NaN-safe and bounds `days` to 1–3650. Previous code: `Math.max(1, parseInt('abc'))` → `NaN` → SQL `datetime('now', '-NaN days')` → silent no-op.

---

## Findings Pending (tracked in `PENDING_PHASES.md`)

### 🟡 Medium (14)

1. `bookings/[id]/state.ts:112` — `operational_status` accepted without an enum allowlist; parameterized so no SQL exec, but garbage strings (`"<script>"`, `"DROP"`) end up in D1.
2. `content/reviews.ts:33` — GET crashes 500 if a corrupted JSON row sits in `cms_content`. Wrap `JSON.parse` in try/catch (pattern already used in `gallery.ts`).
3. `writeRevocationFlag` TTL hardcoded to 86 400 s in both `src/lib/auth/session.ts:281` and `src/lib/auth/plac.ts:363` — doesn't respect `SESSION_MAX_LIFETIME_MS`. Two copies; consolidate into one helper.
4. `audit/logs.ts` DELETE handler — even with the new PLAC gate, allows DEV/Owner to bulk-delete arbitrary audit entries. Audit log should be append-only. Consider removing DELETE entirely (use `audit/prune` retention instead).
5. `users/manage.ts:100–121` — POST `pageOverrides[].pagePath` accepted without validating it exists in `admin_pages`, and without the Gate D ceiling check. Stash junk rows in `admin_page_overrides`. Low impact (privileged action) but data-quality bug.
6. `session.ts:130` — `X-Forwarded-For` fallback for IP logging. CF always sets `CF-Connecting-IP` on Internet-facing requests; the XFF fallback only lets an attacker spoof audit-trail IP if CF-Connecting-IP is somehow missing. Drop the XFF leg.
7. `middleware.ts:170` — `process.env.SITE_URL ?? env.SITE_URL` reverses precedence vs intent. Not currently exploitable (both agree today) but fragile.
8. `migrations/0026_cms_content_history.sql` — Comment promises "trigger-based cleanup keeps last 10 rows per (id, page)" but no trigger is created. Table grows unbounded. Add `AFTER INSERT` trigger or app-level cleanup.
9. `chatbot/[...path].ts` — `getMinRole` defaults to `'admin'` when no pattern matches (fail-open if a new admin endpoint ships upstream before the regex list is updated). Slug also concatenated into upstream URL without rejecting `..` or leading `/`.
10. `scheduled-log-sync.ts:181–191` — One Resend email per failed CF Access attempt. Attacker triggering many failures generates inbox flood / Resend quota burn. Batch by `(email, ip, hour)` into a daily digest, or rate-limit per recipient.
11. `media/upload.ts:39` — Hardcoded role allowlist `['dev','owner','super_admin','admin']` instead of using `isAdmin()` helper. Maintainability bug.
12. `public/_headers` CSP diverges from `src/middleware.ts:510` CSP. Middleware wins at runtime for SSR responses; `_headers` only applies to assets in `public/`. Confusing — sync them or delete the line from `_headers`.
13. Settings `cf_admin_theme` cookie uses `SameSite=Lax` while session cookie uses Strict. Minor inconsistency (theme cookie has no security impact).
14. Apply the new `placDenyResponse` helper to the remaining medium-risk routes: `settings/portal`, `content/*`, `media/*`, `users/probes`, `users/cf-access-audit`, `users/active-{sessions,revocations}`.

### 🔵 Low / Info (14)

1. `auth/logout.ts:35` — `siteUrl.includes('localhost')` would treat `app.localhost.com` as dev. Defensive (falls through to team-domain logout) but fragile; parse URL hostname.
2. `cloudflare-access.ts:140–146` — No `nbf` (not-before) JWT check. CF Access tokens don't typically include `nbf`, so theoretical. Add belt-and-suspenders check.
3. `api/dashboard/metrics.ts` — No rate limit; aggregates heavy upstream queries.
4. `src/pages/dashboard/content/hero.astro:329` — `statusEl.innerHTML = ${message}` where `message` is currently always server-controlled / hardcoded. Switch to `textContent` to prevent future drift.
5. `scheduled-log-sync.ts:140,166` — `setTimeout` waits up to ~24s inside scheduled worker — close to CPU/wall-time budget. Add absolute deadline check.
6. `audit.ts` — `details` field free-text; some callers pass `JSON.stringify({...})`, others plain strings. Standardize.
7. `chatbot/[...path].ts` — Defense-in-depth: reject slug containing `..` or absolute `/`.
8. **Supabase advisor (security):** `auth_leaked_password_protection` disabled on project `zlvmrepvypucvbyfbpjj`. Not relevant for cf-admin (uses CF Access, not Supabase Auth) but relevant if other apps on this project use email/password — enable in Supabase dashboard → Auth → Password Security.
9. **Supabase advisor (performance):** 28 unused indexes across `bookings`, `chat_analytics`, `consent_records`, `email_audit_logs`, `feedback_events`, `intent_events`, `kb_gaps`, `legal_requests`, `privacy_requests`, `admin_authorized_users(cf_sub_id)`. Drop after confirming no usage from `cf-astro` / `cf-chatbot`.
10. `ModelsCatalog.tsx:274` — `dangerouslySetInnerHTML` with numeric-only template (`Math.round(...)`). Currently safe; structurally fragile if the data source changes. Replace with JSX.
11. `cms_content_history` — same root cause as Medium #8; tracked once.
12. **GitHub workflow `sync-docs.yml`** — PII redaction regex catches only `harshil*@*`. Broaden to a generic developer-PII pattern as the contributor base grows.
13. `api/health.ts` is inside the auth gate (good) but returns which bindings are configured (D1/R2/KV/Supabase) — minor info disclosure to authenticated users. Acceptable.
14. **Dependency CVEs (npm audit):** 16 vulnerabilities. Direct: `astro <6.1.10` (moderate XSS GHSA-j687-52p2-xcff), `@astrojs/cloudflare <13.1.10` (low SSRF GHSA-88gm-j2wx-58h6). Transitive: `vite` (3 high/moderate dev-server issues), `devalue 5.6.3–5.8.0` (high DoS), `fast-uri` (2 highs), `postcss <8.5.10` (moderate XSS in `</style>` stringify), `yaml <2.8.3` (moderate stack overflow), `ws <8.20.1` (moderate memory disclosure), `brace-expansion 5.0.2–5.0.5` (moderate DoS). All resolvable via `npm update astro @astrojs/cloudflare wrangler @cloudflare/workers-types && npm audit fix`. `@astrojs/check` chain needs a semver-major downgrade — review before applying.

---

## Verification Methodology

- **Static analysis pass:** every API route in `src/pages/api/**/*.ts` (≈50 routes) read and cross-referenced against `requireAuth()` minimum role + PLAC check + rate limit + input validation.
- **Live Supabase audit:** `mcp__supabase__get_advisors` (security + performance) on project `zlvmrepvypucvbyfbpjj`. `list_tables` confirmed all 18 public tables have RLS enabled.
- **Frontend XSS pass:** grep + per-file review of every `dangerouslySetInnerHTML`, `innerHTML =`, `eval(`, `new Function(`, `setTimeout('string')`, `window.location = userInput`, `target="_blank"` without `noopener`.
- **Per-route PLAC enforcement audit:** table built of which endpoints check `actor.accessMap[?]` (5 had ad-hoc checks, 45 did not).
- **CVE scan:** `npm audit --json` — 16 vulns reported.
- **Type-check:** `npm run check` — 0 errors / 0 warnings / 0 hints across 223 files, both before and after the fixes.

---

## Patches Applied in This Review (file-level summary)

| # | File | Change |
|---|------|--------|
| 1 | `src/workers/cf-entry.ts` | Accept both `"0 2 * * SUN"` and `"0 2 * * 0"` cron patterns — fixes asset cleanup never running |
| 2 | `src/lib/auth/cloudflare-access.ts` | Simplify JWKS bust-and-retry to a single reassignable variable |
| 3 | `src/lib/csrf.ts` | Anchor Referer match (exact equality or `prefix + "/"`) — fixes prefix-injection bypass |
| 4 | `src/pages/api/settings/user.ts` | Fetch target's role from DB; reject unless editor strictly outranks (DEV exempt) |
| 5 | `src/pages/api/users/access.ts` | Verify target role + email from DB; forbid self-modification; ignore `body.targetUserRole` for gates |
| 6 | `src/pages/api/audit/silence.ts` | Reject self-silencing; preserve session TTL on patch; read `SESSION_MAX_LIFETIME_MS` from env |
| 7 | `src/lib/auth/guard.ts` | Add `requirePageAccess()` + `placDenyResponse()` helpers |
| 8 | `src/pages/api/audit/{emails,sessions,stats,logs,consent,receipts}.ts` | Wire `placDenyResponse(actor, '/dashboard/logs')` |
| 9 | `src/pages/api/audit/prune.ts` | Wire `placDenyResponse`; NaN-safe and bounded `days` (1–3650) |
| 10 | `src/pages/api/users/{manage,force-kick}.ts` | Wire `placDenyResponse(actor, '/dashboard/users')` |
| 11 | `src/pages/api/users/access-data.ts` | Wire `placDenyResponse`; add ghost protection (non-DEV cannot enumerate DEV/Owner PLAC matrices) |

All 7 commits land on `main` via merge commit `3f8cd78` (PR #2).

---

## Recommended Follow-Up Order

1. Dependency CVE bump — `npm update astro @astrojs/cloudflare wrangler && npm audit fix`. Small, low-risk, addresses 9 of 14 Low items.
2. Apply `placDenyResponse` to remaining routes (`settings/portal`, `content/*`, `media/*`, `users/{probes, cf-access-audit, active-sessions, active-revocations}`) — mechanical, no behavior change for users without PLAC overrides.
3. Wrap `content/reviews.ts:33` `JSON.parse` and add `operational_status` enum (Medium #1, #2) — single PR, both trivial.
4. Add `cms_content_history` cleanup trigger (Medium #8) before this table sees any real volume.
5. Consolidate `writeRevocationFlag` TTL into a single helper that reads `SESSION_MAX_LIFETIME_MS` (Medium #3).
6. Email-throttling on `scheduled-log-sync` (Medium #10) — only matters once you have inbound traffic that can fail-login at scale.

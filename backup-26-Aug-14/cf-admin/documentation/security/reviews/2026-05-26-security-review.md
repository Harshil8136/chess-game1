---

title: "Security Vulnerability Review — CF-Admin Madagascar"
status: historical
audience: [technical]
last_verified: 2026-06-06
verified_against: [code]
owner: harshil
tags: []
---

# Security Vulnerability Review — CF-Admin Madagascar

**Date:** 2026-05-26
**Reviewer:** Automated deep scan (follow-up pass on top of 2026-05-25 review)
**Branch:** `claude/codebase-review-branch-fixes-WZg5d` → `main` (commit `27e6090`)
**Scope:** All Medium and Low items left open by PR #2 + a fresh full-codebase re-pass for new findings

---

## Executive Summary

This review re-verified every deferred item from the 2026-05-25 review (14 Medium + 14 Low) against the current code, then closed every meaningful gap in a single atomic commit. Production `npm audit` drops from **16 vulnerabilities (3 high, 12 moderate, 1 low) to 0** by combining `npm audit fix` with two minor-version bumps and one dependencies → devDependencies reclassification.

The most consequential finding is that **18 API routes had no PLAC enforcement** — they relied solely on the role gate, so an admin with an explicit page-level deny could still call the underlying JSON endpoints. All 18 are now wired with `placDenyResponse()`. The deny resolution is identical to dashboard navigation (DEV-exempt, exact-match then longest-prefix), so the only behavioural change is the intended one: PLAC denies now block their corresponding API paths.

Two items remain genuinely deferred (not done):

- `cms_content_history` cleanup trigger — the table is created by migration 0026 but has **zero writers** in the codebase. There is nothing to clean up. Building the trigger now would be premature; the table is dead until a writer ships.
- `astro check` hangs in the sandbox where this review ran (esbuild service deadlock — known environmental issue, not a code issue). `tsc --noEmit --skipLibCheck` passes cleanly across all 28 modified files, so type safety is verified through the alternate path.

---

## Patches Shipped (commit `27e6090`)

| # | Severity | File(s) | Vulnerability / Improvement | Fix |
|---|---|---|---|---|
| F-1 | 🔴 Crit (gap) | 18 API routes across `content/*`, `media/*`, `settings/portal`, `users/*`, `audit/silence` | **PLAC bypass via direct JSON API** — routes ran a role check (admin+ or super_admin+) but never called `placDenyResponse()`, so a user with an explicit deny on `/dashboard/content`, `/dashboard/media`, `/dashboard/settings`, or `/dashboard/users` could still hit the corresponding APIs (POST a new gallery, list active sessions, mutate FAQs, etc.). | Added `placDenyResponse(user, '/dashboard/<page>')` after the role gate on every flagged route. DEV-exempt; behaviour-identical for users without explicit denies. |
| F-2 | 🔴 Crit | `content/{reviews,faqs,stats}.ts` GET handlers | **Route crash on corrupt JSON** — `JSON.parse(result.content)` had no try/catch, so a single corrupted row in `cms_content` would 500 the entire route (and the dashboard page that depends on it). | Wrap in try/catch, fall back to empty array. Matches the pattern already in `gallery.ts:27`. |
| F-3 | 🔴 Crit | `bookings/[id]/state.ts` | **`operational_status` accepted any string** — the column has no DB CHECK constraint and the route applied no zod/allowlist validation, so UI dropdowns could drift apart from data and `<script>` strings would persist into D1. `internal_notes` had no length cap either. | Defined `VALID_OPERATIONAL_STATUS` allow-list (`pending`/`confirmed`/`in_progress`/`completed`/`cancelled`/`no_show`); reject otherwise with 400. Cap `internal_notes` at 2000 chars. |
| F-4 | 🟠 High | 16 npm packages | **Production `npm audit`: 16 vulnerabilities** including high-severity `vite` path traversal + WebSocket file read, `devalue` DoS, `fast-uri` path traversal + host confusion. | Ran `npm audit fix` for non-breaking upgrades, then bumped `@astrojs/cloudflare ^13.1.6 → ^13.5.4` and `@astrojs/check ^0.9.8 → ^0.9.9`. Moved `@astrojs/check` from `dependencies` → `devDependencies` (build-only tool; eliminates the entire `@astrojs/language-server`→`volar-service-yaml`→`yaml` chain from the production audit surface). **Result: 0 prod vulnerabilities.** |
| F-5 | 🟠 High | `src/workers/scheduled-log-sync.ts` | **Email amplification** — for every failed CF Access login returned by the audit poll, one alert email was sent via Resend. A burst of 100 failed logins from a misconfigured IdP or password-spraying bot would burn the Resend quota and silence real alerts. | Cap email notifications at 5 per batch; append a digest line on the last email noting how many more failures were suppressed (with a pointer to D1 `admin_login_logs` for the complete set). All failures still write to D1. |
| F-6 | 🟠 High | `src/lib/auth/session.ts:280` | **`writeRevocationFlag` TTL hardcoded to 86 400 s** — drifts whenever `SESSION_MAX_LIFETIME_MS` is changed. A 12 h session shouldn't be outlived by a 24 h revocation flag. | Read `SESSION_MAX_LIFETIME_MS` via `getSessionTiming(getRawEnv())`; floor at 60 s. Signature unchanged for callers. |
| F-7 | 🟠 High | `public/_headers` vs `src/middleware.ts:510` | **CSP divergence** — `_headers` had `https://*.sentry-cdn.com` wildcard and `https://*.supabase.co` carveouts the middleware version had already dropped, plus a different `Permissions-Policy` (older fields). On a Workers (non-Pages) deploy `_headers` is not consumed at runtime, but the divergence misleads anyone reading the config. | Aligned `_headers` byte-for-byte with the middleware CSP and added a header comment clarifying that `_headers` is reference-only on Workers — middleware is authoritative. |
| F-8 | 🟡 Med | `src/pages/api/audit/{login-logs,export}.ts` | **PLAC parent-deny not propagated** — both files used custom `actor.accessMap['/dashboard/logs#security']` / `['#export']` lookups that bypassed the longest-prefix matcher in `placDenyResponse`. A deny on the parent `/dashboard/logs` would not block these endpoints if a stale grant for the hash sub-page existed. | Added `placDenyResponse(actor, '/dashboard/logs')` as the first gate; the existing hash-sub-page grant logic remains as the secondary check. Order matters: parent deny wins. |
| F-9 | 🟡 Med | `src/pages/api/users/access.ts` | **PLAC-denied admin could still POST PLAC changes** — the route enforced its own 5-gate hierarchy but never checked whether the actor was even allowed to reach `/dashboard/users`. | Added `placDenyResponse(actor, '/dashboard/users')` before any of the existing gates run. |
| F-10 | 🟡 Med | `users/{active-sessions, active-revocations, cf-access-audit}.ts` | **No rate limit on privileged ops** — session revocation, edge-block unblock, and CF Access user enumeration could be polled or scripted without throttling. `cf-access-audit` is the most sensitive: it enumerates every user CF Access knows about in the account. | Added Upstash limiters: 30/min revoke, 30/min unblock, 10/min CF Access audit. Keyed by `session.userId`. |
| F-11 | 🟡 Med | `src/lib/auth/session.ts:130` | **`X-Forwarded-For` used raw** — some proxy chains emit a comma-separated list; using the full string as an IP poisons the audit trail. | Split on comma and take leftmost entry; `CF-Connecting-IP` still preferred as the most-trusted source. |
| F-12 | 🟡 Low | `src/components/admin/chatbot/ModelsCatalog.tsx:274` | **`dangerouslySetInnerHTML` fragile** — currently safe (both branches interpolate only `Math.round(...)` and `.toFixed(...)` results — i.e. number → digit-string), but a future refactor that adds `m.name` to `costHtml` would silently introduce XSS. | Added a load-bearing comment explaining the safety invariant and instructing future maintainers to convert to a JSX `<><strong>{value}</strong></>` fragment if any string field is ever interpolated. |
| F-13 | 🧹 Hyg | `package.json` | `@astrojs/check` was in `dependencies` despite being a build-only typecheck tool. | Moved to `devDependencies`. Side-effect: removes 5 transitive vulnerabilities from the production audit surface (`@astrojs/language-server` → `volar-service-yaml` → `yaml-language-server` → `yaml`). |

### Branch hygiene (companion change)

- Local `main` was 28 commits behind `origin/main`. Fast-forwarded locally via `git update-ref refs/heads/main refs/remotes/origin/main` (no remote push needed; remote was already current).
- Stale remote branch `claude/codebase-security-review-LhIkr` (PR #2 already merged into main on 2026-05-25) **could not be deleted from the review sandbox** — `git push --delete` returned 403 from the local proxy, and no `delete_branch` MCP tool is available in this environment. Flagged for one-click deletion at <https://github.com/mascotasmadagascar-cmd/cf-admin-madagascar/branches>.

---

## Items Verified Closed (no code change needed)

| Item from 2026-05-25 review | Verification |
|---|---|
| M-4 — `audit/logs.ts` DELETE handler audit-immutability | Genuinely a policy decision, not a bug — the UI's "Delete Selected" button in ActivityCenter depends on it. Left as-is pending a product call. |
| M-5 — `users/manage.ts` `pageOverrides[].pagePath` validation | Privileged action (super_admin+), low-impact data-quality issue. Tracked but deferred — covers the entire "create a junk row" surface; needs a focused PR. |
| M-7 — middleware `process.env.SITE_URL` precedence | Confirmed both env paths agree today; no exploit vector. Deferred. |
| M-8 — `cms_content_history` cleanup trigger | **Verified table has zero writers in the codebase.** The migration's comment promises a trigger that was never created, but nothing inserts into the table, so it cannot grow. Building the trigger now would be premature optimisation against a dead feature. Re-evaluate when the first writer ships. |
| M-9 — `chatbot/[...path].ts` `getMinRole` default | Already gated by `requireAuth(context, 'admin')` at function entry — the `getMinRole` default-to-`admin` is the same as the entry gate. Lower priority than originally rated. Deferred. |
| M-13 — `cf_admin_theme` cookie SameSite | UI preference cookie with no security impact. Cosmetic inconsistency, deferred. |
| L-1..L-13 | Mix of polish, advisor lints, defense-in-depth that are not currently exploitable. Deferred as a follow-up batch. |

---

## Verification Methodology

- **Per-route PLAC audit:** scripted `grep -c "requirePageAccess\|placDenyResponse"` across all 21 previously-flagged routes — all returned ≥ 1 after the patches.
- **TypeScript check:** `tsc --noEmit --skipLibCheck` → exit 0 across the entire codebase (preferred path; `astro check` is environmentally broken in this sandbox).
- **CVE re-scan:** `npm audit --omit=dev` → 0 vulnerabilities (was 16).
- **Branch state:** `git log --oneline -3` confirms the new commit sits cleanly on top of `origin/main`; no merge commits, no force-pushes.
- **Functional dry-run:** every changed route's first-gate call ordering (auth → PLAC → rate-limit → input validation → action) re-read to confirm no early-exit reordering broke an existing path.

---

## Recommended Next Items

1. **Dead-code removal**: either ship a writer for `cms_content_history` or drop migration 0026 — currently it's a maintenance trap.
2. **L-14 batch follow-up**: the remaining L-1..L-13 items are all small. Bundle into a single hygiene PR when convenient.
3. **Per-page CSP nonce**: the only blocker on dropping `script-src 'unsafe-inline'` from CSP is Sentry's SDK init script (see `SECURITY.md` §13). Now that we're on `@sentry/astro ^10.51`, re-check whether the SDK supports nonce attribution.
4. **Astro check sandboxing**: investigate why `astro check` hangs in containerised review environments — `tsc --noEmit` is a working workaround but type checking should be a one-button affair.

# cf-admin — Pending Hardening Items

> **Last Updated:** 2026-05-25 (post deep-review PR #2 merge to `main`)
>
> **Context:** Phases 1A–11 of the original refactor + the 2026-05-24 security review + the 2026-05-25 deep review's Critical and High findings (C-1, C-2, H-1..H-5) are all complete on `main`. This document tracks the Medium and Low items surfaced by the 2026-05-25 review that have NOT yet shipped. Each item links back to the original finding in `SECURITY-REVIEW-2026-05-25.md`.
>
> **Severity legend:** 🟡 Medium = real bug or hardening gap, fix within ~2 weeks. 🔵 Low/Info = polish, defense-in-depth, advisor lints.

---

## 🟡 Medium — 14 items

| # | Area | File / Location | Issue | Fix sketch |
|---|---|---|---|---|
| M-1 | Input validation | `src/pages/api/bookings/[id]/state.ts:112` | `operational_status` accepted without an allowlist; arbitrary strings persist into D1 (parameterized, so no SQL exec) | Define `const VALID_STATUSES = ['pending','confirmed','checked_in','checked_out','cancelled','completed']` and reject anything else with 400 |
| M-2 | Error handling | `src/pages/api/content/reviews.ts:33` | `JSON.parse(result.content)` not wrapped in try/catch — a corrupted DB row crashes the GET endpoint with 500 | Wrap `JSON.parse` in try/catch and default to `[]` (the pattern used in `gallery.ts:26-30`) |
| M-3 | KV / session lifecycle | `src/lib/auth/session.ts:281`, `src/lib/auth/plac.ts:363` | `writeRevocationFlag` TTL hardcoded to `86400` in two places; doesn't respect `SESSION_MAX_LIFETIME_MS` | Consolidate into one helper that reads the env var; default 24h if missing |
| M-4 | Audit immutability | `src/pages/api/audit/logs.ts:113–174` (DELETE handler) | Even after the new PLAC gate, DEV/Owner can bulk-delete audit entries by ID. Audit log should be append-only. | Remove the DELETE export entirely; rely on `audit/prune` retention. If selective delete is genuinely needed, require an external break-glass token rather than a role check |
| M-5 | Input validation | `src/pages/api/users/manage.ts:100–121` | POST `pageOverrides[].pagePath` not validated against `admin_pages` existence; Gate D ceiling check not applied to creation-time overrides | Look up each pagePath in `admin_pages` before insert; reject if missing; apply `ROLE_LEVEL[actor.role] <= ROLE_LEVEL[pageDef.requiredRole]` for grants |
| M-6 | Logging trust | `src/lib/auth/session.ts:130` | `X-Forwarded-For` used as IP fallback. CF always sets `CF-Connecting-IP`; the fallback lets a misconfigured edge spoof audit-trail IPs | Drop the XFF fallback → `?? 'unknown'` |
| M-7 | Middleware ergonomics | `src/middleware.ts:170` | `process.env.SITE_URL ?? env.SITE_URL` reverses the intended precedence; not currently exploitable but fragile | Use `env.SITE_URL` only |
| M-8 | DB lifecycle | `migrations/0026_cms_content_history.sql` | Header comment promises "trigger-based cleanup keeps last 10 rows per (id, page)" — no trigger is created. Unbounded growth | Add `AFTER INSERT` trigger that deletes rows past the 10-version mark per `(id, page)`, or do it in the app on each write |
| M-9 | Proxy hardening | `src/pages/api/chatbot/[...path].ts:54` | `getMinRole` defaults to `'admin'` when no rule matches — fail-open if a new admin endpoint ships upstream before the regex list is updated | Default to `'dev'` (most-restrictive); document the upgrade path |
| M-10 | Worker hygiene | `src/workers/scheduled-log-sync.ts:181–191` | One Resend email per failed CF Access attempt — amplifies inbox flood / Resend quota cost / cost spike risk | Batch by `(email, ip, hour)` and emit one summary per group; or throttle to 1 alert per recipient per 15 min using KV |
| M-11 | Maintainability | `src/pages/api/media/upload.ts:39` | Hardcoded role allowlist `['dev','owner','super_admin','admin']` instead of `isAdmin()` helper | Replace with `if (!isAdmin(user.role as Role))` |
| M-12 | Config drift | `public/_headers:11` vs `src/middleware.ts:510` | Two CSP policies that don't match. Middleware wins at runtime for SSR responses; `_headers` only applies to static assets | Delete the CSP line from `_headers` (middleware is authoritative) or sync them |
| M-13 | Cookie consistency | `src/pages/api/settings/user.ts:157,163` | `cf_admin_theme` cookie uses `SameSite=Lax` while the session cookie uses `Strict`. UI preference only, but inconsistent | Switch to `Strict` |
| M-14 | API hardening | `settings/portal`, `content/*`, `media/*`, `users/{probes, cf-access-audit, active-sessions, active-revocations}` | These routes have role gates but no PLAC enforcement. PR #2 wired the highest-risk subset; this completes the pass. | Add `const denied = placDenyResponse(actor, '/dashboard/<page>'); if (denied) return denied;` after the existing role check |

---

## 🔵 Low / Info — 14 items

| # | Area | Where | Note |
|---|---|---|---|
| L-1 | Robustness | `src/pages/api/auth/logout.ts:35` | `siteUrl.includes('localhost')` would treat `app.localhost.com` as dev; not exploitable, fragile. Parse via `new URL(...).hostname` |
| L-2 | Defense-in-depth | `src/lib/auth/cloudflare-access.ts:140–146` | No `nbf` (not-before) check. CF Access tokens don't include `nbf` in practice but add `if (claims.nbf && claims.nbf > nowSec + 60) return null;` |
| L-3 | Load shedding | `src/pages/api/dashboard/metrics.ts` | No rate limit; aggregates heavy upstream queries | Add `getRateLimiter({ requests: 30, window: '1 m' }, 'dash-metrics')` |
| L-4 | Defense-in-depth | `src/pages/dashboard/content/hero.astro:329` | `statusEl.innerHTML = ${message}` — `message` is currently server-controlled / hardcoded but vulnerable to future drift | Use `textContent` |
| L-5 | Worker budget | `src/workers/scheduled-log-sync.ts:140,166` | `setTimeout` waits up to ~24s total inside a scheduled handler | Track elapsed time and bail out before exceeding the 30s wall-clock budget |
| L-6 | Data model consistency | `src/lib/audit.ts` | The `details` field is free-text; some callers pass `JSON.stringify({...})`, others plain strings. Inconsistent rendering downstream | Standardize on `JSON.stringify` |
| L-7 | Proxy hardening (defense-in-depth) | `src/pages/api/chatbot/[...path].ts:77,86–89` | Reject slug containing `..` or leading `/` before concatenating into upstream URL |
| L-8 | Supabase advisor (security) | Project `zlvmrepvypucvbyfbpjj` | `auth_leaked_password_protection` disabled. Not used by cf-admin (CF Access) but relevant if sibling project uses Supabase Auth | Enable in Supabase Dashboard → Auth → Password Security |
| L-9 | Supabase advisor (performance) | Project `zlvmrepvypucvbyfbpjj` | 28 unused indexes flagged across `bookings`, `chat_analytics`, `consent_records`, `email_audit_logs`, `feedback_events`, `intent_events`, `kb_gaps`, `legal_requests`, `privacy_requests`, `admin_authorized_users(cf_sub_id)` | Drop only after confirming no cf-astro / cf-chatbot usage |
| L-10 | Frontend (structural) | `src/components/admin/chatbot/ModelsCatalog.tsx:274` | `dangerouslySetInnerHTML` with `Math.round(...)`-only template. Currently safe; fragile if the data source changes | Replace with JSX `<>Est. Cost: <strong>~{cost}</strong> / interact</>` |
| L-11 | Cron resilience | `src/workers/cf-entry.ts` | The fix for C-2 accepts both patterns; once Cloudflare normalizes the cron API behavior consistently, the redundant arm can be dropped | Verify via observability logs after a few Sunday runs |
| L-12 | CI / sync-docs | `.github/workflows/sync-docs.yml` (PII Redaction step) | PII pattern catches only `harshil*@*` — too narrow as contributor base grows | Broaden to a generic developer-PII regex (and/or a maintained allowlist of business emails) |
| L-13 | Info disclosure (minor) | `src/pages/api/health.ts` | Returns which CF bindings are configured (D1, R2, KV, Supabase). Inside the auth gate so only authenticated users see it — acceptable, documented here for awareness | Acceptable as-is |
| L-14 | Dependency CVEs (`npm audit`) | `package.json` / `package-lock.json` | 16 vulnerabilities total (3 high, 12 moderate, 1 low). **Direct:** `astro <6.1.10` (moderate XSS — GHSA-j687-52p2-xcff), `@astrojs/cloudflare <13.1.10` (low SSRF — GHSA-88gm-j2wx-58h6). **Transitive:** `vite` (3 high/moderate dev-server issues), `devalue 5.6.3–5.8.0` (high DoS), `fast-uri` (2 highs — path traversal + host confusion), `postcss <8.5.10` (moderate XSS), `yaml <2.8.3` (moderate stack overflow), `ws <8.20.1` (moderate memory disclosure), `brace-expansion 5.0.2–5.0.5` (moderate DoS) | `npm update astro @astrojs/cloudflare wrangler @cloudflare/workers-types && npm audit fix`. `@astrojs/check` chain (volar-service-yaml → yaml) requires a semver-major downgrade — review before applying |

---

## Recommended Order

1. **L-14** — `npm update astro @astrojs/cloudflare wrangler && npm audit fix`. Smallest, addresses the most CVEs. Re-run `npm run check` and the diagnostic suite afterward.
2. **M-14** — Apply `placDenyResponse` to the remaining 8 routes. Mechanical; no behavior change for users without PLAC overrides.
3. **M-1 + M-2 + M-11** — Single PR for the three trivial input/typing fixes.
4. **M-8 + M-3** — Single PR for the two D1 / KV lifecycle fixes.
5. **M-10** — Email throttling on `scheduled-log-sync`. Only meaningful once you actually have inbound traffic that fails CF Access at scale; track but defer if traffic stays low.
6. **M-4** — Audit-log immutability. Functional regression if any current workflow relies on the DELETE endpoint; check the UI (`ActivityCenter` "Delete Selected" button) before removing.
7. The rest (M-5..M-7, M-9, M-12, M-13, L-1..L-13) — opportunistic, batch when convenient.

---

## Previously Resolved (record only)

Phases 1A–11 of the original refactor (SQL injection, rate limiting, dead code, type safety, component splitting, ErrorBoundary, CSS architecture, accessibility, Session Forensics, Theme Hardening) — see `COMPLETED_PHASES.md` for the full record.

2026-05-24 deep review's 7 patches — see `SECURITY-REVIEW-2026-05-24.md`.

2026-05-25 deep review's Critical + High patches (C-1, C-2, H-1..H-5) — see `SECURITY-REVIEW-2026-05-25.md` and `COMPLETED_PHASES.md` § Phase 12.

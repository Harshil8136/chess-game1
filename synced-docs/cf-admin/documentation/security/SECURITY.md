---

title: "Security Architecture — CF-Admin"
status: active
audience: [ai, technical]
last_verified: 2026-10-17
verified_against: [code, infra]
owner: harshil
related_docs: [THREAT-MODEL.md, RoPA.md, ../architecture/PERMISSIONS-SYSTEM.md, ../architecture/plac-and-audit.md, ../operations/OPERATIONS.md]
related_code: [src/lib/auth/routes.ts, src/lib/auth/plac.ts, src/lib/auth/authz-signal.ts, src/lib/security/csp.ts, src/lib/csrf.ts]
tags: [security, rls, auth]
---

# Security Architecture — CF-Admin

> [!IMPORTANT]
> **Role names changed on 2026-07-27.** The ladder is now
> `vendor_support > owner > admin > manager > staff > viewer` (six tiers,
> including a read-only Viewer). The database still holds the previous values
> and they are translated in code, so `super_admin` in a stored row means
> **Admin** (level 2) and `admin` in a stored row means **Manager** (level 3);
> Viewer is stored under its own name, `viewer`, since 2026-10-16.
> Any role name below that has not been updated refers to the pre-rename
> vocabulary. [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md)
> §4.1 is the authoritative reference for the ladder and the collision this
> rename creates.

> **TL;DR (non-technical):** The complete security picture for the admin portal: how users are authenticated, how requests are protected, how data is locked down, and what the current security posture is.

> **Status:** Production Active
> **Scope:** Auth, CSRF, Sessions, HTTP Headers, RLS, Defense-in-Depth, Ghost Protection, Error Sanitization, IDOR Prevention, Rate Limiting, Input Validation

---

## 0. Current Posture (at a glance)

This document is the **canonical, current** security state. Point-in-time audit
snapshots are preserved under [`reviews/`](./reviews/) as historical records — do
not treat them as the present state; this file supersedes them.

Every row below was re-derived from code or a live query on the date shown. A
row with no evidence column is a claim, not a posture — do not add one. The
[verification log](#verification-log) at the end of this document says what each pass
checked and what it did not.

| Area | Current state | Verified | How to re-check |
|------|---------------|----------|-----------------|
| `npm audit` (production deps) | **0 unexcepted advisories**; 6 documented, time-boxed exceptions in `.audit-exceptions.json` (js-yaml ×1, sharp ×3, svgo ×2 — all build-time only, all expiring **2026-11-30**). `audit_gate.py` audits this package's own lockfile in isolation (chunk 4) and fails the build on an expired or undocumented entry. *Corrected 2026-09-14* — this row described the pre-chunk-4 state (16 findings, ten exceptions expiring 2026-10-23). | 2026-09-14 | `npm audit --omit=dev`, then `python scripts/audit_gate.py` |
| PLAC on API routes | **55** path prefixes in `API_PAGE_MAPPING`. Of the **171** route files under `src/pages/api/`, 162 resolve through a prefix and 9 are the session-less routes of §2; none is unmapped, and `test/api-authz-inventory.test.ts` fails the build on one that is | 2026-10-26 | `resolveApiAuthz` in `src/lib/auth/routes.ts`; count the files under `src/pages/api/` |
| API authorization mode | **`enforce`** — an unmapped, un-allowlisted `/api/*` request is denied 403. Flipped from `shadow` 2026-08-12. | 2026-10-16 | `API_DENY_MODE` in `wrangler.toml`; logic in `src/lib/auth/stages/decide.ts` |
| Break-glass / hardcoded admins | None (removed; whitelist-only) | 2026-06-06 | `src/lib/auth/` — no hardcoded email list |
| Session expiry | 30-min role re-check, 24h hard expiry. The revocation flag's TTL is a **fixed 24 h** (`expirationTtl: 86400` in `src/lib/auth/plac.ts`). *Corrected 2026-09-20* — this row said it follows `SESSION_MAX_LIFETIME_MS`; the TTL-aware writer `writeRevocationFlag()` in `src/lib/auth/session.ts` exists but has no callers | 2026-09-20 | `src/lib/auth/plac.ts`, `src/lib/auth/session.ts` |
| Permission-change propagation | An `authz-changed:{userId}` mark; the session re-verifies on its **next request** and nobody is signed out (2026-09-16) | 2026-09-20 | `src/lib/auth/authz-signal.ts`; §5 |
| Recent sign-in before dangerous actions | Role changes, suspending or deleting a person, signing people out, Owner-level grants, Page Registry changes reaching more than one person, deleting records and Email API credentials refuse 403 with `x-fresh-sign-in: required` unless the session's Access sign-in is under 10 minutes old (60 s skew; unknown fails closed). The full list is owned by [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) §10.5. It proves the person only with Access's own second step at every sign-in (owner step, item #13) | 2026-10-16 | `src/lib/auth/fresh-sign-in.ts`; `test/fresh-sign-in.test.ts` lists every route that calls it |
| Accounts nobody uses | Flagged on Users and emailed to the sign-in alert list at 45 days without a sign-in or a change; suspended with the three-layer force-kick at the 14:00 UTC check after 90 days, unless the alert policy says to flag only; never the Owner, Vendor support or an unreadable role (CIS Controls v8 5.3). The rule is owned by [`../features/USER-MANAGEMENT.md`](../features/USER-MANAGEMENT.md) §5.5 | 2026-10-16 | `src/lib/unused-accounts.ts`, `src/workers/scheduled-unused-accounts.ts`; `test/unused-accounts.test.ts` |
| Sensitive reads recorded | One `view` row in `admin_audit_log` for opening a consent record's details, a person's sign-in history and an Email API message with Read mail (`src/lib/audit-views.ts`); a backup console file preview or restore-test file is recorded by the gateway as `backup_data_access` or `backup_restore_test` (its `RECORDED_READS`, [`../features/BACKUP-CONSOLE.md`](../features/BACKUP-CONSOLE.md) §4). Lists and masked reads are not recorded ([`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.5). ARCO identity documents have no viewer in the portal, so there is nothing to record | 2026-10-16 | `test/sensitive-views.test.ts`, `test/backup-gateway.test.ts` |
| Audit log integrity | Nothing in the portal edits an activity log entry or deletes one younger than 180 days. Each day is sealed at 14:00 UTC the next day: a SHA-256 fingerprint over its entries, chained to the day before, kept as a log entry, as an R2 copy and in a morning email; the past week is checked again each morning, and any day under *Check seals*. Today's entries are unsealed until then, and an account administrator can still change the database; the seals make it visible, not impossible. The R2 bucket lock is an owner step (MAINTENANCE AL-1). Owned by [`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.2 and §3.6 | 2026-10-16 | `src/lib/audit-seal/`, `src/workers/scheduled-audit-seal.ts`; `test/audit-seal.test.ts` |
| CSP | Enforcing policy has **no `'unsafe-eval'`** (removed 2026-07-25) and still carries `'unsafe-inline'`. A hardened Report-Only canary without `'unsafe-inline'` **is live** — see §4. | 2026-08-13 | `src/lib/security/csp.ts` |
| `public/_headers` | **The only source of static-file headers since 2026-10-10.** Every static file (`/_astro/*`, favicons, `public/scripts/*`) is served from the asset store without running the Worker; `run_worker_first` used to send `/_astro/*` and the favicons through it, one Worker request per file. The file sets HSTS, `nosniff`, `Referrer-Policy`, `Cross-Origin-Resource-Policy: same-origin` (added 2026-10-10, since the Worker no longer adds it to those files) and `X-Robots-Tag`; the adapter adds immutable caching for `/_astro/*`. A CSP, `X-Frame-Options`, COOP or `Permissions-Policy` on a script or an image has no effect, which is why chunk 2 trimmed them (C-12). Cloudflare Access still guards every static file. SSR responses take all their headers from `src/lib/security/csp.ts`. | 2026-10-10 | `public/_headers`, `wrangler.toml` `assets`, `test/worker-entry-contract.test.ts` |
| Supabase `anon` role | Zero table grants, zero RLS policies. **Function EXECUTE is revoked on 4 of 6 public functions, not all 6** — `increment_conversation_metrics` and `purge_expired_privacy_data` are still callable by `anon` and `authenticated`. Neither is `SECURITY DEFINER` and `anon` has no table grants, so the body fails on table access: a posture defect, not an exposure path. REVOKE migration outstanding — see §10.3 | 2026-09-20 (live `has_function_privilege`) | `has_function_privilege` over `pg_proc` in the `public` schema |
| Email alert amplification | **Throttled on both paths, and one email per sign-in.** The cron path caps at 5/batch with a digest line; the inline bootstrap path (since 2026-10-03) emails a failure at most once per account and reason per repeat window (15 minutes unless the alert policy sets 5 or 60), and the email counts the attempts of the past hour. A successful sign-in is emailed once, not once for every portal session it opens: the row's INSERT claims its Access assertion, so sessions opened at once cannot both email (88 duplicate emails over the table's life before). Every attempt is still logged, with what happened to its email (`admin_login_logs.alert`). *Until 2026-10-03 the inline path sent one Brevo alert per refused request.* | 2026-10-03 | `src/workers/scheduled-log-sync.ts`; `src/lib/login-alerts/decide.ts`; `src/lib/login-alerts/dispatch.ts`; `test/login-alerts.test.ts` |
| Sign-in reuse from another place | A portal session opened with an Access assertion already seen from another country or on another device sends an urgent alert (`🚨 SIGN-IN MOVED`) whatever the alert settings or policy say, once per new country and device (2026-10-03). It checks new portal sessions only; what that leaves out is tracked in `../MAINTENANCE.md` (private) (SA-6). The device is read from the client-set User-Agent | 2026-10-03 | `src/lib/login-alerts/decide.ts`; `test/login-alert-decide.test.ts`; [`../specs/2026-10-03-sign-in-alerts-v2-design.md`](../specs/2026-10-03-sign-in-alerts-v2-design.md) §6 |
| Sign-in without Google | Every new Access sign-in whose provider is not Google (One-time PIN, GitHub or any other) is emailed as urgent (`🚨 SIGN-IN WITHOUT GOOGLE`) whatever the account's settings say: any way in but Google is the emergency way in (permissions item #37). Since 2026-10-23 GitHub and the one-time PIN each have a rule, for every account (Alert policy → Ways in) or one (Your alerts → Ways you sign in, which wins): always urgent (the default), quiet inside the account's trusted areas and urgent elsewhere, or like Google. A quieter rule is audited and emails the alert recipients, so a stolen session cannot set it quietly. Any other provider stays the emergency way in. The provider comes from Access's get-identity, after the response; when Access does not answer, the sign-in follows the usual rules. Restricting the other ways in to the Owner's account is a dashboard step (owner step) | 2026-10-16 | `src/lib/login-alerts/decide.ts` (`otherWayIn`); `test/login-alert-decide.test.ts`, `test/login-alerts.test.ts` |
| Static security gates | `rules_check.py` 0 violations · `a11y_check.py` 0 findings | 2026-08-13 | `npm run verify` |

**Review history (most recent first):**
[2026-06-13](./reviews/2026-06-13-security-review.md) ·
[2026-05-26](./reviews/2026-05-26-security-review.md) ·
[2026-05-25](./reviews/2026-05-25-security-review.md) ·
[2026-05-24](./reviews/2026-05-24-security-review.md) ·
[SSL/Lighthouse 2026-04-24](./reviews/2026-04-24-ssl-lighthouse-audit.md).
The full-platform audit of [2026-07-17](./reviews/2026-07-17-full-platform-audit.md)
is the most recent cross-repo pass. Open follow-ups are tracked in
`../MAINTENANCE.md` (private).

**Live verification (2026-06-06):** Supabase MCP `list_tables` confirmed RLS is
enabled on all `public` tables (incl. `admin_authorized_users`, `bookings`,
`consent_records`, `email_audit_logs`, chatbot tables). `get_advisors(security)`
returned no data-model findings — the sole WARN (`auth_leaked_password_protection`)
is a Supabase **GoTrue** feature that this project does not use (GoTrue removed in
favour of CF Zero Trust), so it is not applicable. Re-confirmed 2026-08-13: RLS
enabled on all 20 `public` tables.

---

## 1. Auth Architecture

CF-Admin uses **Cloudflare Zero Trust Access** for identity (who you are) and a custom **Supabase authorization whitelist** for access decisions (what you're allowed to do). Supabase GoTrue has been fully removed — no magic links, no OAuth callbacks, no anon key on the client.

### 1.1 Identity Layer — Cloudflare Zero Trust

- **CF Access Application** protects all routes at the CF edge, before any request reaches the Worker
- **Identity providers:** Google, GitHub, One-Time PIN (OTP)
- **CF injects on every authenticated request:**
  - `CF-Access-Authenticated-User-Email` — verified user email
  - `CF-Access-JWT-Assertion` — short-lived RS256 JWT with `sub` (CF user UUID), `iat`, `exp`. An `idp` claim is *defined* but is **absent in production**, so IdP attribution is not available from the JWT: every login from 2026-09-05 to 2026-10-16 resolved `login_method = 'unknown'`. Since 2026-10-16 the login event asks Access for the provider after the response (below), and a sign-in made without Google is emailed as urgent every time (permissions item #37; [`login-forensics.md`](login-forensics.md) §2.2 and §7)
  - `CF-RAY` — Cloudflare Ray ID (links to CF dashboard trace)
- **JWKS verification:** Worker verifies JWT signature via public keys fetched from `https://{team}.cloudflareaccess.com/cdn-cgi/access/certs`, cached in memory for 1h per isolate lifecycle
- **Provider lookup (since 2026-10-16):** after a sign-in's response, the login event sends the verified assertion as the `CF_Authorization` cookie to `https://{team}.cloudflareaccess.com/cdn-cgi/access/get-identity` (the configured team only, 2 s timeout) and keeps only `idp.type`; nothing else in the answer is stored
- **No client-side secrets:** CF Access cookie (`CF_Authorization`) is managed entirely by the CF edge. No anon key, no OAuth credentials ever reach the browser.

### 1.2 Authorization Layer — Supabase Whitelist

- **Whitelist-only entry:** Only emails present in `admin_authorized_users` (Supabase PostgreSQL) with `is_active = true` can create a KV session
- **Service-role isolation:** All Supabase queries use `SUPABASE_SERVICE_ROLE_KEY`, accessed only server-side — bypasses RLS entirely, never exposed to the client
- **No hardcoded bypass accounts:** The break-glass mechanism (`BREAK_GLASS_EMAILS`, `isBreakGlassAdmin`, `isHardcodedSuperAdmin`) was intentionally removed. All access is gated exclusively through the `admin_authorized_users` whitelist — there are zero hardcoded emails or fallback grants in the codebase.

### 1.3 Session Design

Sessions are stored in **Cloudflare KV** with a dual-key pattern:

- Primary: `session:{uuid}` → JSON `AdminSession` object
- Reverse index: `user-session:{userId}:{sessionId}` → `'1'` (enables O(k) force-logout without scanning the full KV namespace)

**`AdminSession` interface (`src/lib/auth/session.ts`):**

```typescript
interface AdminSession {
  sessionId?: string;
  userId: string;           // admin_authorized_users UUID (Supabase)
  cfSubId: string;          // CF Access user UUID (JWT sub claim) — needed for Layer 3 revocation
  email: string;
  displayName: string;
  role: Role;
  loginMethod: 'google' | 'github' | 'otp' | 'unknown';
  createdAt: number;        // Unix ms — 24h hard expiry anchor
  signedInAt?: number;      // Unix ms — the Access assertion's iat at bootstrap; the recent sign-in rule (§1.4)
  lastRoleCheckedAt: number;// Unix ms — 30-min role re-check anchor
  accessMap?: PageAccessMap;
  authzMark?: string;       // last authz-changed mark this session re-verified against
  ipHash?: string;          // HMAC of the login IP, computed once, used in audit rows
  vpsNoticeVersion?: string;// server access notice accepted (POST /api/vps/notice); a new sign-in starts without it
  testingPassUntil?: number;// Unix ms — end of a Vendor support testing pass (POST /api/settings/testing-pass, §1.4)
  codeConfirmedAt?: number; // Unix ms — an emailed code entered in this session (POST /api/settings/confirm-code, §1.4)
  confirmCode?: { hash; expiresAt; tries; sentAt }; // the code waiting to be entered: its SHA-256 hash only
  // Telemetry — note ipAddress is the RAW address
  ipAddress: string;
  userAgent: string;
  geoLocation: string;
  rayId: string;
  lastActiveAt: number;
}
```

Re-checked 2026-10-16. `src/lib/auth/session.ts` is the source of truth — prefer
reading it to trusting this copy. A session written before `signedInAt` existed falls back
to `createdAt` for the recent sign-in rule.

**`cfSubId` persistence:** Stored in `admin_authorized_users.cf_sub_id` (TEXT column, Supabase migration `supabase_0001_add_cf_sub_id`). Written idempotently on first CF ZT login via `waitUntil()`. Enables Layer 3 revocation even when no active KV session exists (natural expiry edge case).

### 1.4 Session Timing Matrix

| Component | Duration | How Enforced |
|-----------|----------|--------------|
| CF Access cookie (`CF_Authorization`) | **24 hours** | CF Dashboard → App Session Duration |
| Global CF session | **24 hours** | CF Dashboard → Settings → Authentication → Global Session Timeout |
| KV session TTL | **24 hours** | `expirationTtl: 86400` on `SESSION.put()` |
| Hard expiry guard | **24 hours** | `createdAt` check in middleware fast-path (defense-in-depth) |
| Role re-check | **30 minutes** | `lastRoleCheckedAt` check → re-fetch of `admin_authorized_users` from **Supabase** (not D1; the page map is the D1 read) |
| CF JWT assertion | Short-lived | Auto-refreshed by CF edge on every request — Worker does not manage this |
| Permission / role change | **Next request** | `authz-changed:{userId}` mark, bounded by KV eventual consistency (≈60 s) and the 5 s isolate cache (see §5) |
| Recent sign-in for dangerous actions | **10 minutes** | `signedInAt` (the Access assertion's `iat`, taken at bootstrap) checked by `freshSignInRefusal` on each route that needs it ([PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §10.5) |
| Vendor support testing pass | **1, 4 or 8 hours**, never past the session's end | started only within the 10 minutes above; while it lasts the recent sign-in rule reads the current time, in the portal and in the three consoles' actor headers ([PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §10.5) |
| Force-kick propagation | **Next request**, ≈60 s worst case | 3-layer revocation (see §5). Not instantaneous: KV is eventually consistent, so "immediate" was never accurate |

Sessions are **fixed-duration from creation** — no rolling extension. A session created at 09:00 expires at 09:00 next day regardless of activity.

### Astro Sessions API

Session cookies use the `__Host-` prefix in production (enforces `Secure`, host-bound, `path=/`). In local dev, plain cookie name is used without the prefix.

> **⚠️ Fail-Secure Local Dev Detection:** `isLocalDev(siteUrl)` in `src/lib/auth/routes.ts` is
> `!!siteUrl && (siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1'))` — if `SITE_URL`
> is missing or misconfigured the system defaults to **production mode**, never to dev mode, so a
> missing variable can never bypass Cloudflare Zero Trust. It has one implementation and seven
> callers: `src/lib/auth/stages/assertion.ts` (the pipeline's local-dev shortcut since the
> chunk 10 split), `src/lib/auth/landing.ts`, `src/lib/storage/share-token.ts`,
> `src/pages/index.astro`, `src/pages/api/auth/dev-login.ts`,
> `src/pages/api/content/edge-verify.ts` and `src/workers/cf-entry.ts` — two of them carried
> private copies until 2026-09-04. *(Count corrected 2026-09-20; it read "four".)*
>
> **Corrected 2026-09-04.** The file list above was stale — the check has not lived in
> `src/middleware.ts` since the auth pipeline was split into stages. `src/pages/index.astro`
> had also ORed two request-derived clauses onto it (`Astro.url.hostname === 'localhost'` and
> `=== '127.0.0.1'`), so on that page dev mode was no longer decided by `SITE_URL` alone; the
> clauses are removed and the rule holds everywhere again
> (`../MAINTENANCE.md` (private) C-27, closed).

### Local Development Bypass

CF Access requires a live domain, so it does not run locally.
`src/lib/auth/stages/assertion.ts` short-circuits when `isLocalDev(SITE_URL)` is true, and
`src/pages/index.astro` renders the Local Dev Gateway: a picker over the active rows of
`admin_authorized_users`, plus a fallback that signs in as `LOCAL_DEV_ADMIN_EMAIL` from
`.dev.vars`. Either choice POSTs to `src/pages/api/auth/dev-login.ts`, which creates a real KV
session — RBAC, PLAC and audit all behave normally in dev.

That endpoint is guarded twice: `import.meta.env.PROD` returns 404 in a production build, and
`isLocalDev(SITE_URL)` redirects to `/` otherwise. It takes its email from the request body with
no credential check, so both guards carry real weight.

> **Corrected 2026-09-04.** This section previously said middleware reads the email from an
> `X-Dev-User-Email` request header. Nothing under `src/` reads that header — it documented a
> mechanism that does not exist. The dev session comes from the POST described above.

---

## 2. Route Protection

Every non-public route is gated by `src/middleware.ts`. Public routes are restricted to `GET`/`HEAD` only:

| Public Route | Method Restriction | Notes |
|---|---|---|
| `/` | GET, HEAD only | The auth landing page. It **is** in `PUBLIC_ROUTES`, so `classify()` answers it before any session or identity lookup and the rest of the pipeline never runs on it; the page does its own `getSession()` and redirect. Cloudflare Access still challenges it at the edge |
| `/privacy`, `/terms` | GET, HEAD only | Static legal pages |

`/api/auth/logout` and `/api/auth/dev-login` are exempt from the pipeline as well, named
individually in `PUBLIC_API_ROUTES`. They were an `/api/auth/` *prefix* until 2026-09-04,
which made every future file in that directory public before anyone chose it
(`../MAINTENANCE.md` (private) C-25, closed). Because the pipeline's CSRF gate
never sees them, the GET logout additionally refuses any `Sec-Fetch-Site` other than `none`
or `same-origin`, so a cross-site `<img src>` cannot force-logout an administrator.
Everything else requires a valid KV session plus a PLAC check.

> **Corrected 2026-09-04.** This paragraph said `index.astro` at `/` "only redirects to
> `/dashboard` once a KV session exists", and the table above it omitted `/` entirely while
> `PUBLIC_ROUTES` has always contained it. Since the single-sign refactor (`198f7bd`) the page
> also redirects when there is **no** session and no `?error=` — that is exactly how an
> unauthenticated visitor is bounced into the Cloudflare Access challenge. The old wording
> described the pre-refactor page. See
> [`../features/CFZT-EDGE-AUTHENTICATION.md`](../features/CFZT-EDGE-AUTHENTICATION.md) §1.

Any mutation method on public routes returns `405 Method Not Allowed`. Everything else requires a valid KV session + PLAC access check.

### Session-less routes — the complete list

Everything not named here requires a valid KV session plus a PLAC check. The
set below is `src/lib/auth/routes.ts`, and it is the whole of it:

| Route | Authorization instead of a session | Reaches the Worker past CF Access via |
|---|---|---|
| `GET /api/health` | None — liveness probe, returns no data | The edge bypass policy |
| `POST /api/emails/unsubscribe` | HMAC-signed token in the link (RFC 8058 one-click). Public since 2026-07-26; a mailbox provider has no session, cookie or CSRF token | The edge bypass policy |
| `GET/POST /api/auth/logout` | Must work when the session is already gone. GET additionally refuses any `Sec-Fetch-Site` other than `none`/`same-origin` | Normal Access session |
| `POST /api/auth/dev-login` | Local dev only — 404 in a production build, and redirects unless `isLocalDev(SITE_URL)` | Never reachable in production |
| `POST /api/emails/webhook` | Pre-shared secret, constant-time compared, fail-closed when unset; 120/min per IP. **Not** an HMAC signature — see [`THREAT-MODEL.md`](THREAT-MODEL.md) | The edge bypass policy |
| `/api/storage/share/*`, `/api/storage/request/*` | HMAC-signed self-verifying token + optional passcode — §2a | A path-based bypass policy |

*Corrected 2026-09-20.* §2a used to call the two storage families the "only"
exception, which was wrong in both directions: unsubscribe and the webhook are
also session-less, and both must be reachable past Cloudflare Access.

### 2a. Staff Managed Storage — the deliberate exception

These two route families are the deliberate *product* exception: they serve
external parties (vendors, vets) with no portal account, so they cannot sit
behind CF Access. They are not gated by `src/middleware.ts` at all — the gate is
a Cloudflare Zero Trust **path-based bypass policy** at the edge (outside this
repository) plus the route's own HMAC-token verification.

| Route | Methods | Auth model | Rate limit (`safeRateLimit`, fail-closed) |
|---|---|---|---|
| `/api/storage/share/[token]` | GET (gateway form only), POST (download) | HMAC-signed self-verifying token (`verifyShareToken`) + optional passcode, `timingSafeEqualStrings` compared | `storage-share-consume` — 20/min, keyed on the **raw** client IP |
| `/api/storage/request/[token]` | GET (gateway form only), POST (passcode submit) | Same token model; `GET` never reads or echoes query-string data (closes the 2026-08 reflected-XSS finding, see `THREAT-MODEL.md`) | `storage-request-consume` — 30/min, keyed on the **raw** client IP |
| `/api/storage/request/[token]/presign` | POST | Token + independently re-verified passcode | `storage-request-presign` — 20/min, keyed on the **raw** client IP |
| `/api/storage/request/[token]/confirm` | POST | Token + independently re-verified passcode; magic-byte + extension + size re-validation before the row is written | `storage-request-confirm` — 20/min, keyed on the **raw** client IP |

*Corrected 2026-09-20:* these four limiters were documented as "keyed on hashed
client IP". They pass `cf-connecting-ip` straight to the limiter, so raw client
IPs become limiter keys: Upstash keys until 2026-10-04, and since then keys of
Cloudflare's own Rate Limiting binding, which no store of ours holds (§6b). The access **telemetry** rows written by the same
routes do hash the IP — the two are different things. See [`RoPA.md`](RoPA.md) §2.1.

**Open operator action:** the scope of the Cloudflare Access bypass policy in
front of these routes has not been re-verified against the Zero Trust dashboard
since the route family shipped. It is a dashboard-side setting, not code, and it
is tracked in `../MAINTENANCE.md`; re-verify it there rather than reasoning about
it from this document.

All other `/api/storage/*` routes (the owner's own drive, Inspect, admin
config, reconciliation report) sit behind the normal KV session + PLAC model
like every other dashboard-mapped route and are not exceptions.

---

## 3. CSRF Protection

Stateless CSRF via `src/lib/csrf.ts` — Origin + Referer header validation. No tokens, no cookies, no client JS required. It runs as the `csrfGate` stage of the auth pipeline (`src/lib/auth/pipeline.ts`), **after** `classify()`, on every mutation method (POST, PUT, PATCH, DELETE). Consequence: public routes, webhook routes and the public API routes are answered by `classify()` first and never reach the gate — which is why the GET logout carries its own `Sec-Fetch-Site` check and the webhook carries its own secret. *Corrected 2026-09-20: this said "applied globally by `middleware.ts`".*

| Step | Check | Action |
|------|-------|--------|
| 1 | Method is GET, HEAD, or OPTIONS | Skip — safe methods don't mutate state |
| 2 | `Origin` header matches `SITE_URL` (or `SITE_URL` without trailing `/`) | ✅ Allow |
| 3 | `Origin` doesn't match | ❌ Deny — origin mismatch |
| 4 | No `Origin`, but `Referer` is **exactly** `SITE_URL` (no trailing slash) OR begins with `SITE_URL + "/"` | ✅ Allow (fallback) |
| 5 | Neither header present | ❌ Deny — fail-closed |

> **Referer match is boundary-anchored (2026-05-25 hardening — see §14 H-1).** Earlier versions used a plain `referer.startsWith(siteUrl)`, which would accept `https://secure.example.com.attacker.com/...` when `SITE_URL` was `https://secure.example.com`. Modern browsers send Origin on cross-origin mutations so the exposure was narrow (some webviews / older clients strip Origin on same-origin redirects), but the check is now hardened: an exact equality to the normalized URL, or a prefix followed by `/`.

**Performance:** <0.05ms CPU, 0 KV reads, 0 bytes client JS.

**Missing `SITE_URL`:** in a **production** build (`import.meta.env.PROD`) an
absent `SITE_URL` makes CSRF unenforceable, so the gate **blocks every
mutation** rather than skipping. Only a non-production build falls through, for
developer convenience. *Corrected 2026-09-20 — this said validation is "skipped
entirely", which would have been a fail-open in production.* If `SITE_URL` is
misconfigured in `.dev.vars`, every mutation fails with 403 — check it first
when debugging.

---

## 4. Edge-Injected Security Headers

Applied **inside the Worker** by Astro's `sequence` middleware —
`sequence(sentryErrorBoundary, securityHeaders, authMiddleware)`
(`src/middleware.ts`), not at the Cloudflare edge. Headers are written to a
mutable `new Headers(response.headers)` copy to avoid immutable-header
exceptions on the Workers runtime. The distinction matters: anything Cloudflare
injects after the response leaves the Worker (Rocket Loader, for one) is not
covered by these headers and cannot receive the CSP nonce.

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` (except `SAMEORIGIN` under `/dashboard/backup/app/` — see "Framing exception" below) | Prevents clickjacking (legacy; `frame-ancestors` in CSP is primary). Skipped on localhost so the dev toolbar works |
| `X-XSS-Protection` | `0` | Deliberately disables the legacy auditor, which is itself an XSS vector in old browsers. Omitted from this table until 2026-09-20 |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaks only origin on cross-origin navigation |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | 2-year HSTS with preload eligibility. Source of truth: `src/lib/security/csp.ts:78`. Corrected 2026-07-29 — this row read `31536000` while the deployed header has been `63072000`; three compliance documents cited the correct value and this file did not. |
| `Permissions-Policy` | `camera=(), microphone=(), payment=(), geolocation=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()` | Disables all browser hardware APIs not used by the admin portal |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Not the stricter `same-origin`: CF Access and Google sign-in use popups, and `same-origin` severs `window.opener` and breaks those flows |
| `Cross-Origin-Resource-Policy` | `same-origin` | Blocks cross-origin embedding of this origin's resources |
| `X-Robots-Tag` | `noindex, nofollow, noarchive, nosnippet, noimageindex` | Defence in depth over robots.txt — an authenticated portal with zero public content |
| `Content-Security-Policy` | See enforced policy below | Resource restriction; `'unsafe-inline'` retained on `script-src`/`style-src`, `'unsafe-eval'` removed 2026-07-25 |
| `Content-Security-Policy-Report-Only` | **Live** — the hardened canary | Ships the target policy (no `'unsafe-inline'`) so violations surface in Sentry without breaking the portal |

### Enforced CSP

Generated per-request in `src/lib/security/csp.ts` (private)
(`buildPolicy(SCRIPT_SRC_ENFORCING(nonce), true)`) — read that file for the
literal string; the shape is:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'nonce-<per-request>'
           https://browser.sentry-cdn.com
           https://static.cloudflareinsights.com
           https://cloudflareinsights.com
           https://cdn.jsdelivr.net
           https://accounts.google.com
           https://secure.madagascarhotelags.com
           https://*.madagascarhotelags.com;
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src     'self' data: blob: https:;
font-src    'self' data: https://fonts.gstatic.com;
worker-src  'self' blob:;
connect-src 'self' <app domains> <CF Access> <Sentry ingest> <Supabase + wss:>
            <R2 S3 endpoint, for presigned Staff Storage PUTs>;
frame-src   'self' https://accounts.google.com https://*.cloudflareaccess.com;
frame-ancestors 'none';
base-uri    'self';
object-src  'none';
form-action 'self';
report-uri  <Sentry security endpoint>;
upgrade-insecure-requests
```

Every first-party inline `<script>` is rewritten to carry the per-request nonce
by the middleware itself (the `finalBody` replace at the end of `csp.ts`).

**Page swaps (since 2026-10-10).** A click inside the portal no longer reloads the
tab: Astro's `<ClientRouter />` fetches the next page and swaps it in, so the tab
keeps the policy, and the nonce, of the page it first loaded. The new page's
scripts carry *their* response's nonce, which the kept policy would refuse. So
`src/components/navigation/NativeNavigationState.astro` captures the first page's
nonce and, in `astro:after-swap`, sets it on every script the router is about to
run; the policy itself is unchanged. That code runs only on documents this origin
served through the auth pipeline, with each response's own nonce already checked
by the middleware. The router script is an external file under `'self'`, and
link prefetching is off. `test/client-navigation.test.ts` holds both in place.

### Framing exception — the backup console (added 2026-09-23)

Responses whose path starts with `/dashboard/backup/app/` carry
`X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` instead of
`DENY`/`'none'`, because `/dashboard/backup` frames cf-backup's console from the
same origin (plan of record [02 §5](../program/cf-backup/02-admin-integration-contract.md)).
The prefix is one constant, `FRAMEABLE_PREFIX` in `src/lib/security/csp.ts`, and
the URL parser has already resolved `..` and `%2e%2e` segments before the
comparison. When a framed response carries its own `Content-Security-Policy`,
it is kept and sent as a second policy: browsers enforce both, so cf-backup can
narrow what this policy allows and never widen it. `test/csp.test.ts` fails if
any other path loses `DENY`/`'none'`, if the prefix changes, or if a proxied
policy replaces this one.

**Why `'unsafe-inline'` is still present:**

- **`script-src 'unsafe-inline'`:** retained *only* until the canary below reads
  clean. First-party inline scripts are already nonced, so the sole remaining
  dependency is any Cloudflare zone-level *inline* injection (Rocket Loader) —
  those are added after the response leaves the Worker and can never receive the
  nonce. Cloudflare Web Analytics loads from `static.cloudflareinsights.com` and
  is covered by the host allowlist, so it is unaffected either way.
- **`style-src 'unsafe-inline'`:** Preact's SSR renderer emits `style="..."`
  attributes in the initial HTML for components using `style={{ }}` props
  (dynamic gradients, animations, colors). **885 occurrences across 110 files**
  as of 2026-09-20 — measured with
  `grep -rn "style={{" src --include=*.tsx --include=*.astro`. *This read
  "roughly 20 instances" across three named files; it is a materially larger
  job than that and the CSP plan should be sized accordingly.* There is also no
  nonce on `style-src`, so anything describing inline styles as "nonce-permitted"
  is wrong.

**`https://cdn.jsdelivr.net` is due to come out of `SCRIPT_SRC_HOSTS`.** Nothing
under `src/` loads from jsDelivr any more — Chart.js is no longer CDN-loaded,
and `src/lib/security/csp.ts` is the only file that still names the host, in the
enforcing policy and the canary alike. Tracked in `../MAINTENANCE.md` (PD-8).

**`'unsafe-eval'` was removed on 2026-07-25** — verified absent from both `src/**`
and the built client bundles under `dist/_astro/`. SEC-01 now forbids it outright
with no exemption, so it cannot come back silently.

### Report-Only CSP — the hardened canary (live)

> **Corrected 2026-08-13.** This section previously stated the Report-Only header
> was "RETIRED 2026-05-26". It was retired then, but a new canary was shipped
> afterwards and has been live since; `csp.ts` sets it on every response. The
> stale text survived because nothing checked doc claims against code — see
> `MAINTENANCE.md` C-3 for the flip procedure this canary gates.

`Content-Security-Policy-Report-Only` carries the same policy as the enforcing
header with `'unsafe-inline'` dropped from `script-src`, reporting to the Sentry
`report-uri`. `upgrade-insecure-requests` is deliberately omitted from it —
browsers ignore that directive in a Report-Only policy and log a console warning
on every page load if it is present.

Promote `SCRIPT_SRC_CANARY` to the enforcing directive and delete the Report-Only
header once it reports zero `script-src` violations. Note that while both headers
are live Sentry double-counts any violation that trips the enforcing policy too,
so keep the canary window short. The flip is blocked on operator verification of
Cloudflare Rocket Loader (zone → Speed → Optimization) — `MAINTENANCE.md` C-3.

### Data-Attribute Driven CSS

Dynamic UI state is controlled via data attributes (`data-state="expanded"`, `data-active="true"`) wherever possible — `style={{ }}` props are only used for values that cannot be expressed as static CSS (runtime-computed gradients, role-specific color tokens). Remaining inline-style props are the primary blocker for `style-src unsafe-inline` removal.

---

## 5. Revocation — two mechanisms, not one

> **Owner of this subject:** [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) §11.
> When the two disagree, that document wins. This section was rewritten on
> 2026-09-20 because it still described the pre-2026-09-16 behaviour, in which
> *every* permission change signed the user out — the behaviour that stranded the
> only Owner account for 14 hours and prompted the remediation.

Since 2026-09-16 there are two distinct mechanisms, and using the wrong word for
what happened is how an incident gets misdiagnosed.

### 5.1 The authorization-change mark — for permission changes

A role change, a page grant or revoke, an access-request approval and a
page-registry change all write a random mark to `authz-changed:{userId}`
(`src/lib/auth/authz-signal.ts`), **after** the database change commits. The
session stage reads it in the same bulk KV read as the revocation flags; a live
session whose stored `authzMark` differs re-reads its role from Supabase and its
page map from D1 on that request and stores the new mark.

Nobody is signed out. Grants and revocations both reach a signed-in user on
their **next request**, bounded by KV's eventual consistency (≈60 s).

| Trigger | Code |
|---|---|
| Role change, activation/deactivation, display name, on Users | `applyUserUpdate` in `src/lib/users/manage-apply.ts`, from `PATCH /api/users/manage`, or from `POST /api/users/approvals` when a second person approves a change that waited (`src/lib/approvals/`) |
| Another person's display name, from Settings | `src/pages/api/settings/user.ts` (your own name updates your session directly) |
| Page grant / revoke | `src/lib/access-center/handlers.ts` (`POST /api/users/access-center`), gates in `src/lib/access-center/page-gates.ts` |
| Access-request approval | `src/lib/access-requests/handlers.ts` (`POST /api/access-requests/[id]`), the same gates as a page grant |
| Page-registry change (a default role or switch marks every active person, 2026-10-14) | `src/pages/api/system/pages.ts` |
| Page settings for many people from Page Registry | `src/lib/access-center/registry-access.ts` (`POST /api/system/page-access`), the same gates |
| An account unused for 90 days, suspended at the 14:00 UTC check (with the force-kick, §5.2) | `src/workers/scheduled-unused-accounts.ts` |

A role change additionally calls `resetUserOverrides(env.DB, person.id)`
before the mark, so the new role starts from its own PLAC baseline.

### 5.2 The 3-layer force-kick — for removing a person

`forceLogoutUser()` (`src/lib/auth/plac.ts`) still exists and is still a hard
eviction. It runs in five places:

| Trigger | Code |
|---|---|
| Account deactivation (`is_active === false`) on Users, made at once or approved by a second person | `applyUserUpdate` in `src/lib/users/manage-apply.ts`, from `PATCH /api/users/manage` or `POST /api/users/approvals` |
| User deletion, made at once or approved by a second person | `applyUserDelete` in `src/lib/users/manage-apply.ts`, from `DELETE /api/users/manage` or `POST /api/users/approvals` |
| *Sign someone out* on Users | `src/pages/api/users/force-kick.ts` |
| *Lock out* on Sessions (the account block, which also switches the account off) | `src/pages/api/sessions/active-sessions.ts`; locking out the last active Owner waits for a second person and then runs through `applyUserUpdate` |
| An account unused for 90 days, at the 14:00 UTC check | `src/workers/scheduled-unused-accounts.ts` |

Revoking **one** session instead uses `revokeSingleSession()`, which writes
`revoked-session:{sessionId}` — a different key from the user-level flag.

**Layer 2 runs first — KV revocation flag:**

- Writes `revoked:{userId}` → `'1'` with a fixed `expirationTtl: 86400` (24 h).
  The TTL is a constant, not derived from `SESSION_MAX_LIFETIME_MS`
- Written **before** the sessions are deleted, deliberately: doing it the other
  way round leaves a window in which a deleted session can re-bootstrap
- Checked on every warm request (`src/lib/auth/stages/session-stage.ts`) as well
  as at bootstrap, in one bulk read together with `revoked-session:` and
  `authz-changed:`
- While the flag is live the user cannot sign in at all, and each refused
  request emits a `revocation_block_active` row. The alert email for it is
  throttled to one per 15 minutes (`src/lib/login-alerts/throttle.ts`, since
  2026-10-03; before that, one per request). Lifting the flag early means
  reactivating the account or calling `DELETE /api/sessions/active-revocations`

**Layer 1 — KV session deletion (O(k)):**

- LISTs `user-session:{userId}:*` in the reverse index → deletes all matching KV
  session keys, and the reverse-index pointers
- **Reverse-index KV pattern:** sessions indexed at
  `user-session:{userId}:{sessionId}: '1'` — a targeted LIST is
  O(sessions_per_user), not O(total_sessions)

**Layer 3 — CF Access API hard revocation:**

- `POST https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/access/organizations/revoke_user`
  with `{ email?, user_uid?, devices: true }` — it revokes the user's Access
  tokens across devices at the organization. *Corrected 2026-09-20: this
  documented `DELETE …/access/users/{cfSubId}/active_sessions`, which ends the
  current sessions only. `test/plac-revocation.test.ts` pins the URL, the method
  and the payload.*
- `cfSubId` and email come from an active KV session, falling back to
  `cf_sub_id` / `email` in Supabase `admin_authorized_users`
- Requires `CF_API_TOKEN_ZT_WRITE`, which also serves the Access group sync and
  the Access audit read. Its permissions are listed in
  [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §6, and its scope is
  tracked in `../MAINTENANCE.md` (private) (PD-7)
- Fired through `ctx.waitUntil()` **only when the caller passes a context**. The
  Sessions page does; `force-kick.ts`, both calls in `manage-apply.ts` and the
  unused-accounts job do not, so for those the CF API call is awaited inline, and
  in a request its latency is on the actor's response

**Failure mode:** the flag is written first, so a failure in the session sweep
still leaves re-bootstrap blocked. A Layer 3 failure is logged and non-fatal —
the `CF_Authorization` cookie stays valid, but the flag still refuses session
creation, and the user is fully locked out at CF session expiry (max 24 h).

---

## 6. Input Validation & Error Sanitization

- All form inputs validated server-side before processing
- Parameterized D1 queries only — never string concatenation
- Role values pass through `normalizeRole()` / `storedRoleOrNull()`
  (`src/lib/auth/rbac.ts`) plus the zod schemas before any DB write — an
  unrecognised value is refused. *Corrected 2026-09-20: this named a
  `VALID_ROLES` allowlist; no such symbol exists.*
- Zod schemas cover every JSON-body route (see `../MAINTENANCE.md` C-7)
- **API error responses should return generic messages** — no stack traces, SQL
  errors, schema details or internal paths. `return jsonError(500, error.message)`
  is the anti-pattern. **This is the rule, not yet the state:** 9 route files still
  return the caught exception's message on a 500 (counted 2026-10-16), among them
  `src/pages/api/audit/delete.ts`, `src/pages/api/arco/requests/[id].ts` and
  `src/pages/api/retention/purge.ts`. Find them with
  `grep -rn "jsonError(500, message)" src/pages/api`. A SEC rule would make this
  enforceable; until then, treat the claim as an intention
- Hidden accounts are intended to return an identical 404 shape whether or not
  they exist. Not re-verified against the handlers in this pass

---

## 6a. API Route Access Control — IDOR Prevention

Every API route that returns user data, PII, or privileged records **must** both capture and enforce a minimum role from `requireAuth`. Discarding the return value is a bug.

**Correct pattern:**

```typescript
// Captures user AND enforces 'admin' minimum role — 403 if below
try {
  await requireAuth(context, 'admin');
} catch (err) {
  if (err instanceof AuthError) return jsonError(err.status, err.message);
  return jsonError(401, 'Unauthorized');
}
```

**Wrong pattern (IDOR vulnerability):**

```typescript
try {
  await requireAuth(context);  // ❌ result discarded, no role check
} catch {
  return jsonError(401, 'Unauthorized');
}
```

| Route | Minimum Role | Reason |
|-------|-------------|--------|
| `GET /api/bookings/[id]` | `admin` | Returns consent records, email audit logs, quality metadata (PII). Since 2026-10-15 the consent record keeps only its row's fields for someone without "View consent details" (`canViewConsentDetails`, [PRIVACY.md](./PRIVACY.md) §1) |
| `GET /api/bookings` | authenticated | Booking list |
| `GET /api/media/gallery` | `admin` | Gallery management |
| `POST /api/media/gallery` | `admin` | Gallery mutations; CDN URL whitelist enforced on image src |
| `GET /api/users` | bare `requireAuth` + PLAC on `/dashboard/users` | Full user list. Admin is the floor only because the registry row says so, so a PLAC grant can change it — *this row read "canonical Admin via `requireAuth`" until 2026-09-20* |
| `GET /api/users/[id]/session-status` | bare `requireAuth` + PLAC on `/dashboard/sessions` | Returns session telemetry (IP, UA, geo, Ray ID, lastActiveAt) — PII; Ghost Protection at DB boundary. Each session is named by a handle, never its ID, which is the session cookie (`src/lib/auth/session-ref.ts`, 2026-10-10) |

### Page-Level Access Control on API routes (`placDenyResponse`)

> **Rewritten 2026-09-20.** The text here said the middleware "deliberately
> skips PLAC for `/api/*`" and that the helper allows when the actor has no PLAC
> map. Both were true before 2026-08-12 and are the opposite of the current
> behaviour — and the first contradicted this document's own §0 row.
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) §9
> owns API authorization.

**The pipeline enforces PLAC on `/api/*`.** With `API_DENY_MODE = "enforce"`,
`decide()` (`src/lib/auth/stages/decide.ts`) resolves every `/api/*` path
through `API_PAGE_MAPPING` (longest prefix first) and:

- **mapped** → the page decision applies; a deny returns 403
- **public / webhook** → allowlisted by design
- **no match at all** → `unmapped_route`, denied 403. A missing map is a deny,
  not an allow, and `test/api-authz-inventory.test.ts` fails CI if any `/api/*`
  route is unmapped, so shipping a route without a mapping is a build error
- `shadow` mode records an `api_authz_shadow_deny` row and allows; any
  unrecognised value of `API_DENY_MODE` enforces

Two independent gates therefore guard an API route, and both must pass. The
second is the per-handler opt-in, `placDenyResponse(actor, pagePath)` from
`src/lib/auth/guard.ts` (wrapping `requirePageAccess`). That helper:

- Returns `null` (allow) for **vendor_support and owner**, who bypass every
  deny by design (ADR-0002)
- **Throws 403 when the actor has no PLAC map.** A map goes missing when session
  hydration fails or a stale session carries the pre-refactor shape, neither of
  which says anything about whether the route's own role check was sufficient —
  so the defensive reading is to deny and make the user re-authenticate
- Applies explicit-deny semantics: exact match wins, then longest prefix. A key
  the registry does not define passes *here* (the route's own role check still
  applies), while the middleware gate uses `decideAccess()` and denies the unknown
- Returns a fully-formed `403` JSON `Response` when denied (no-store / nosniff
  headers included) so callers can early-return:
  `const denied = placDenyResponse(actor, '/dashboard/logs'); if (denied) return denied;`

**Routes wired (all data-bearing routes now enforce PLAC):**

Which of these actions also need a sign-in from the last 10 minutes (403 with
`x-fresh-sign-in: required` otherwise) is owned by
[`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) §10.5, and
which wait for a second person by §10.7; the rows below name them where they apply.

| Route | Page check | Wired In | Notes |
|---|---|---|---|
| `GET /api/audit/emails` (+ `DELETE`) | `/dashboard/logs` | PR #2 (2026-05-25) | Replaces the prior inline `accessMap[]` check; consistent across the audit endpoints. `DELETE` (email send records in Supabase `email_audit_logs`, by id) is for the Owner and Vendor support only and needs a recent sign-in; audited. |
| `GET /api/audit/stats` | `/dashboard/logs` | PR #2 | |
| `GET /api/audit/logs` | `/dashboard/logs` | PR #2 | No `DELETE` since 2026-10-16: the activity log is sealed each morning and nothing in the portal deletes an entry younger than 180 days ([plac-and-audit.md](../architecture/plac-and-audit.md) §3.2). |
| `GET /api/audit/seals` | `/dashboard/logs` | 2026-10-16 | Owner and Vendor support only (403 for everyone else, before the page check). Reads a page of the daily seals and checks each against its entries and its R2 copy, stopping at 128 KB of entries ([plac-and-audit.md](../architecture/plac-and-audit.md) §3.6). `?before` must be a window start (400 otherwise). |
| `POST` / `DELETE /api/audit/delete-targeted` | `/dashboard/logs`, or `/dashboard/seo` for the seo tab | 2026-10-16 (row added) | Owner or Vendor support (`isOwnerOrDev`), then the page check; `DELETE` also needs a sign-in from the last 10 minutes. Reaches only the emails, consent, security, requests and seo logs: any other tab, the activity log included, is refused with 400. |
| `DELETE /api/retention/purge` | `/dashboard/retention`, then `/dashboard/retention#purge` | 2026-10-16 (row added) | The Data Retention page's purge of a table's rows older than a threshold. The Owner and Vendor support only: any other role is refused 403, reported to Sentry and emailed to the security alert address. Both pass the page and `#purge` checks (ADR-0002), so the role is the gate. Then a recent sign-in, the account read again from the directory (refused unless still an active Owner or Vendor support), a strict body (a `confirm`, a table from the retention list, a threshold of 1 to 3,650 days) and, with the preview's count, a 409 when the eligible rows have moved by more than 5 rows and 15 % since. The activity log keeps 180 days whatever the threshold (400 below it, [`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.2). |
| `GET /api/audit/consent` (+ `DELETE`) | `/dashboard/logs` | PR #2 | Since 2026-10-15 each record keeps only its row's fields for someone without `/dashboard/privacy#forensics` (`canViewConsentDetails`). `DELETE` (consent records in Supabase `consent_records`, a strict list of ids) is for the Owner and Vendor support only and needs a recent sign-in; audited. |
| `DELETE /api/audit/delete?id=` | `/dashboard/logs` (mapping), then `/dashboard/privacy#delete` | 2026-10-16 (row added) | Deletes one consent record (`consent_records`) from the Consent Records page. The Owner and Vendor support only (`requireAuth(context, 'owner')`, 403 otherwise), who both pass the `#delete` check (ADR-0002), so the role is the gate; always needs a recent sign-in. |
| `GET /api/audit/receipts` | `/dashboard/privacy` | PR #2 | Privacy dashboard surface. Since 2026-10-15 each record keeps only its row's fields for someone without `/dashboard/privacy#forensics` (`canViewConsentDetails`, [PRIVACY.md](./PRIVACY.md) §1). |
| `GET /api/audit/enrich` | `/dashboard/logs` (mapping), then `/dashboard/privacy` | 2026-10-15 | Refuses with 403 without `/dashboard/privacy#forensics`: everything it returns is consent detail (session, trace and network lookups). |
| `GET /api/audit/login-logs` | `/dashboard/logs` (parent) | 2026-05-26 | `placDenyResponse` used as first gate so parent-deny propagates to the `#security` hash sub-page via longest-prefix matching. Then `canReadSignInHistory` (`src/lib/auth/surface-guards.ts`, 2026-10-10), the same check the Sessions page makes before it shows its History tab. Since 2026-10-24 its filters are built by `src/lib/login-log-filters.ts` with every value bound: `method` also takes a comma list (up to 8), and `alert=emailed` or `alert=quiet` splits the rows by whether an alert email went out. |
| `POST /api/audit/export` | `/dashboard/logs` (parent) | 2026-05-26 | Same parent-deny propagation as above for the `#export` hash sub-page. |
| `GET /api/users/role-preview` | `/dashboard/users` | 2026-10-16 | What a role change would do, before the Users page saves it: pages, actions and console permissions gained and lost, and the personal settings it deletes. Read only. Refused (403) to anyone `PATCH /api/users/manage` would refuse: a read-only account, yourself, someone not below you, a role at or above yours, vendor support from below it. A hidden person answers 404 below the owner and vendor support. The console part asks each console the viewer can open what the person would hold with the new role, with this portal's real record in the target header, so a console answers it only to a viewer holding its `access.view` |
| `POST/PATCH/DELETE /api/users/manage` | `/dashboard/users` | PR #2 | Since 2026-10-16 the page settings an invitation carries meet the page gates a later change meets (`inviteSettingRefusals`: the inviter holds each page, may give it, and a grant must clear the page's floor for the new role); one refused setting refuses the whole invitation with 403 and nobody is invited (MAINTENANCE AC-10). Since 2026-10-16 (permissions item #36) making someone Owner or Vendor support, a `DELETE`, and suspending or demoting the last active Owner answer `202 { success: false, pending: true }` and wait for a second person; an invitation as Owner or Vendor support is refused 403 while someone else could approve ([`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) §10.7) |
| `DELETE /api/users/force-kick` | `/dashboard/users`, then `/dashboard/users#force-kick` | PR #2 | Since 2026-10-15 the page and then the owner-only `#force-kick` key, granted exactly (`denyForceKick`, `src/lib/auth/surface-guards.ts`): below the owner and vendor support only a grant opens it. On top of that the caller must strictly outrank the target (`canManageUser`, 2026-10-14); until then any holder of the page could sign out a peer or a senior below the owner (PERMISSIONS-SYSTEM D6). |
| `GET /api/users/access-data` | `/dashboard/users` | PR #2 | Also adds ghost protection: below Vendor support, an Owner's or Vendor support's numbers (or an account whose stored role cannot be read) are refused 403. `userId` must be a UUID. Since 2026-10-16 it answers only counts, worked out by the enforced rules (`accessCounts`, `src/lib/access-center/counts.ts`): pages and actions open of those switched on, and the personal settings in force; until then it sent the whole page table and the person's raw settings. |
| `GET /api/users` | `/dashboard/users` | 2026-05-26 | |
| `GET /api/users/pages` | `/dashboard/users` | 2026-05-26 | The page list for Invite someone. Since 2026-10-26 each page also says whether the viewer may give it (`mayGive`, gates C and D) and take it away (`mayTake`, gate C), and a refused sign-in answers 401 instead of 500. |
| `GET/POST /api/users/access-center` | `/dashboard/users` | 2026-10-02 | The Access Center. The page is checked before anything is read, so a PLAC-denied admin cannot change access. Replaced `POST /api/users/access` (2026-05-26) on 2026-10-03. Hidden accounts answer 404 below owner and vendor; a server-console change also needs the `/dashboard/vps` key itself, strict outrank and not self, and cf-vps re-checks it ([`../features/ACCESS-CENTER.md`](../features/ACCESS-CENTER.md)). Since 2026-10-14 a page grant or revoke may carry an end date (in the future, at most 366 days ahead); a grant of an Owner-level page needs a recent sign-in. |
| `GET/POST/DELETE /api/users/access-templates` | `/dashboard/users` | 2026-10-16 | Access templates ([`../features/ACCESS-CENTER.md`](../features/ACCESS-CENTER.md) §3.3): GET to anyone the page opens for; POST and DELETE to the Owner and Vendor support only, refused 403 for every other role after the page check. A strict body (a name, an optional note, at most 200 entries, each a page path or a `vps`/`backup` capability by pattern). It changes nobody's access: applying a template only fills the editor's draft, and the save goes through `POST /api/users/access-center` with its own gates |
| `GET/POST /api/users/access-review` | `/dashboard/users` | 2026-10-16 | The quarterly access review ([`../features/USER-MANAGEMENT.md`](../features/USER-MANAGEMENT.md) §6.2): the Owner and Vendor support only, refused 403 for every other role after the page check. GET lists every active account with its last sign-in and last recorded console action; POST is the sign-off, a strict body (UUIDs, no one twice, a note of at most 500 characters, 64 KB at most), refused 409 when an active account is left out. It removes nothing itself: removals go through the Access Center and `PATCH /api/users/manage` with their own gates |
| `GET/POST /api/users/approvals` | `/dashboard/users` | 2026-10-16 | Changes waiting for a second person ([`../features/USER-MANAGEMENT.md`](../features/USER-MANAGEMENT.md) §6.3). GET: every waiting change to the Owner and Vendor support, only your own to anyone else. POST: a strict body (`id` a UUID, `decision`, a note of at most 200 characters, 4096 characters at most); approve and decline only by an Owner or Vendor support who did not ask, cancel only by the asker, otherwise 403; approving needs a recent sign-in (§10.5 of PERMISSIONS-SYSTEM). The change is taken off the list by compare-and-swap before anything runs (409 when someone decided it first), then checked again as the asker and made through the same code as `/api/users/manage`, with that route's gates |
| `GET /api/users/access-history` | `/dashboard/users` | 2026-10-14 | One person's access changes from the activity log, fifty at a time. The same person check as the Access Center (a hidden account answers 404 below owner and vendor); an owner's or vendor support's history answers empty with `hidden` below vendor support. `userId` must be a UUID and `before` a cursor the route itself made. |
| `GET/POST /api/access-requests` | `/dashboard` | 2026-10-15 | Asking for a page for yourself, or reading whether you can, why the page is closed to you (since 2026-10-16: your own setting on it, a grant whose end date passed, or your role, read from your own rows only) and your latest request for it: anyone signed in, so the mapping is the Overview (it was `/dashboard/inquiries` until 2026-10-15, which shut out anyone without Inquiries). A page with a floor, Page Registry (only vendor support gives it, since 2026-10-17), a page you already open, a page switched off in Page Registry (named as such since 2026-10-16), an address that is no page, and any ask from the owner or vendor support are refused with 422. The body is checked strictly (a length is one of four, a reason at most 500 characters) and the reason is escaped in the email. `?view=decide` needs `/dashboard/users` and lists only requests from the roles below the viewer (every request for the owner and vendor support). Since 2026-10-16 (#22) a POST may instead ask for one console permission, `{ console, capability, reason?, wantedHours? }`: the console must be one the asker can open, and the console's own catalog answer to the asker refuses a permission they hold, one a personal setting closes and a floor (422) |
| `POST /api/access-requests/[id]` | `/dashboard`, then `/dashboard/users` | 2026-10-15 | Approve or decline. Read-only refused; then the same person and page gates as a page grant (`personPageRefusal`, the page floor, `pageEditability`), so an Admin decides only for the roles below theirs and for pages they may give. The switch and the decision are one D1 batch, both conditional on the request still waiting (409 otherwise). Replaced `POST /api/audit/requests/[id]/resolve`. Since 2026-10-16 (#22) a console permission request is decided against the console instead: the person gates (never yourself, strictly outrank), the console's door, then the person read from the console as the decider and the change checked as the console checks a delegated save (a floor, a personal close and anything the decider does not hold are refused). An approval always has an end (`hours: null` is 400); the request is marked approved before the console is written and put back to waiting if the console refuses |
| `GET /api/users/probes` (+ `DELETE`) | `/dashboard/users` | 2026-05-26 | The Owner and Vendor support only (`requireAuth(context, 'owner')`), then the page check. GET lists sign-ins by addresses Access let through that are not in the directory, minus any address in it now. `DELETE ?email=` dismisses one address: its refused attempts leave the list and stay in the sign-in log (`admin_login_logs.is_authorized_email` set to -1). |
| `GET /api/users/[id]/login-history` | `/dashboard/users` (mapping) | 2026-10-16 (row added) | One person's last 15 sign-in events and their totals. The Owner and Vendor support only (`requireAuth(context, 'owner')`); an id the directory does not hold answers 404. Addresses are shortened to their first two parts except for Vendor support. Each read writes a `view` row ([`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.5). |
| `GET /api/users/cf-access-audit` | `/dashboard/users` | 2026-05-26 | The Owner and Vendor support only (`requireAuth(context, 'owner')`). Also added a 10/min rate limit — endpoint enumerates every user CF Access knows about in the account. |
| `GET /api/sessions/active-sessions` (+ `DELETE`) | `/dashboard/sessions` | 2026-05-26 | Moved out of `/api/users` since. Gated by `denySessions()` (`src/lib/auth/surface-guards.ts`) on the page plus the `#revoke` action. DELETE additionally has a 30/min revoke rate limit. Since 2026-10-10 the list names each session by a handle and DELETE takes that handle (`sessionRef`), looked up only among the named person's own sessions: the list used to send each session's ID, which is the session cookie. Since 2026-10-14, below the owner and vendor support, ending someone else's sessions or blocking them needs a strict outrank (`canManageUser`); nobody blocks their own account (400); and a block whose account update fails answers 502 (PERMISSIONS-SYSTEM D7). Since 2026-10-16 a block reads the person first: one the directory does not have answers 404, a directory that cannot be read 502 with nobody signed out, and blocking the last active Owner answers `202 { success: false, pending: true }` and waits for a second person, as a suspension on Users does ([`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) §10.7). A block that goes ahead is emailed as an access change. |
| `GET /api/sessions/active-revocations` (+ `DELETE`) | `/dashboard/sessions` | 2026-05-26 | `denySessions()` + `#unblock`. DELETE additionally has a 30/min unblock rate limit. |
| `POST /api/sessions/flush-sessions` | `/dashboard/sessions` | 2026-09 | `denySessions()` with `#flush`, which is deny-only: an override can take it away, never give it. Then the Owner and Vendor support only (403 otherwise), 5 a minute (`session-flush`, §6b) and a strict body (`scope` is `orphaned` or `all`). `all` ends every session but the caller's and needs a recent sign-in; `orphaned` clears the sessions of inactive or deleted accounts and unreadable entries, and does not ask. Writes no sign-in block, so people can sign in again at once. Audited (`force_logout`, operation `flush_sessions`). |
| `GET/POST /api/sessions/sign-in-alerts` | `/dashboard/sessions` | 2026-10-03 | `denySignInAlerts()`: the page, then an explicit grant of `#alerts` (fail closed). Self-service only; a change that turns alerts down emails the alert recipients. Since 2026-10-23 the answer also carries `emailed`, the caller's own alerts of the last 30 days grouped by why, and `table`, what their next sign-in each way would get; `set-way` sets their own rule for GitHub or the PIN, and a quieter one emails the alert recipients. A person cannot set their own successful sign-ins to never; places to trust are their own log rows, referenced by id, and no coordinates cross the API. |
| `GET/POST /api/sessions/alert-policy` | `/dashboard/sessions` | 2026-10-03 | `denyAlertPolicy()`: the page, then an explicit grant of `#alert-policy` (fail closed). The alert policy and other people's mode (not the caller's own); a change that turns alerts down, or new recipients, emails the old and the new recipients. Since 2026-10-23 the answer also carries `emailed`, every account's alerts of the last 30 days grouped by why, and the policy's `ways`. |
| `POST /api/configuration` | `/dashboard/configuration` | 2026-10-10 | Replaced `POST /api/settings/portal` (deleted 2026-10-10), which took any of thirty-odd keys as free text. The page key, then the setting's own key (`#edit`, or `#email-limit` for the recipient limit), both by exact key (`placRequireGrant`, fail closed); the value must pass the catalog's type and range check in `src/lib/configuration.ts`. Audited. |
| `POST /api/vps/notice` | `/dashboard/vps` | 2026-10-11 | The server access notice's answer (`accept` or `leave`). The `/dashboard/vps` key itself (`mayUseConsole`, never inherited), as the Server page and its gateway ask; the body is checked strictly, and the version must be the current notice's (409 otherwise). An acceptance is kept in the session, which the page and the gateway need before they open the console; every answer is audited (`vps_notice_accept`, `vps_notice_leave`) with a keyed hash of the address, never the address ([`../specs/2026-10-11-server-access-notice.md`](../specs/2026-10-11-server-access-notice.md)). A read-only role is refused by the pipeline, as for every change |
| `GET/POST/PATCH/DELETE /api/emails/api-tokens` | `/dashboard/email-api` | 2026-10-16 (row added) | `guardEmailApi()`: the administrator floor, then the page key by exact key. GET lists the tokens. Creating (POST), rotating (`PATCH { id, rotate: true, grace_hours? }`, the grace 0 to 24 hours and nothing else in the body) and deleting need `#manage`; creating and rotating also need a recent sign-in, checked before the email service is called, and the email service checks again. Another edit (PATCH) needs `#respond` or `#manage`, and the email service refuses one that widens a token without Manage tokens. Unknown fields and a malformed token id are refused with 400. The secret is in the create or rotate answer only, never logged or audited; every change is audited (target `email_api_token`). Deleting a person on Users blocks every active token they made (`applyUserDelete`, [`../features/EMAIL-API-ACCESS.md`](../features/EMAIL-API-ACCESS.md)) |
| `GET/POST/PUT/PATCH /api/emails/api-templates` | `/dashboard/email-api` | 2026-10-10 | `guardEmailApi()`: the administrator floor, then the page key by exact key; creating, saving, publishing, archiving and restoring also need `#manage` (fail closed), and each is audited. A preview (`POST ?preview=1`) needs the page only: it fills a template without sending or storing anything. Template ids are checked against `tpl_[a-z0-9_]{2,60}` before the email service is called ([`../features/EMAIL-API-ACCESS.md`](../features/EMAIL-API-ACCESS.md) §4). |
| `GET/PUT/POST /api/emails/api-hotel-mail` | `/dashboard/email-api` | 2026-10-10 | `guardEmailApi()`: the administrator floor, then the page key by exact key. A switch (`PUT { purpose, on }`) also needs `#settings` (fail closed) and is audited (target `email_api_template`); asking for the samples (`POST { purpose, locale? }`) needs `#manage` or `#settings`, and the email service mails them only to the asker's own address. The purpose must be one of the five hotel emails, `on` a boolean and `locale` `es` or `en` before the email service is called ([`../features/EMAIL-API-ACCESS.md`](../features/EMAIL-API-ACCESS.md) §4d). |
| `GET/POST/PATCH /api/emails/api-clients` | `/dashboard/email-api` | 2026-10-10 | `guardEmailApi()`: the administrator floor, then the page key by exact key. Creating needs `#manage`; a change needs `#respond` or `#manage`, and the email service allows Respond a pause and nothing else (resuming, renaming or widening the domains needs Manage tokens). Unknown fields, a `status` on create and a client id that is not `cli_` plus 12 base32 characters are refused before the email service is called; each change is audited (target `email_api_client`) ([`../features/EMAIL-API-ACCESS.md`](../features/EMAIL-API-ACCESS.md) §4e). Since 2026-10-10 (email API phase 5) a client also takes `webhook_url` and `webhook_events`, and `PATCH { id, action: "webhook-secret" | "webhook-test" }` makes a new signing secret or sends one signed test event; both actions need `#manage` (fail closed) and nothing else in the body. A webhook secret passes through in that one answer and is never audited or stored here. |
| `GET /api/emails/api-attachments` | `/dashboard/email-api` | 2026-10-14 | `guardEmailApi()`: the administrator floor, then the page key by exact key. Read-only and takes no input; the email service answers its attachment bucket's state (counts, space, the oldest file's age; never a file or a name). Replaced `GET /api/emails/api-mailroom` (2026-10-10 to 2026-10-14), which also returned the public half of Mailroom's signing key ([`../features/EMAIL-API-ACCESS.md`](../features/EMAIL-API-ACCESS.md) §4g). |
| `GET /api/emails/api-usage` | `/dashboard/email-api` | 2026-10-10 | `guardEmailApi()`: the administrator floor, then the page key by exact key. Read-only; `days` must be a whole number from 1 to 90 before the email service is called ([`../features/EMAIL-API-ACCESS.md`](../features/EMAIL-API-ACCESS.md) §4e). |
| `GET /api/emails/api-export` | `/dashboard/email-api` | 2026-10-10 | `guardEmailApi()`: the administrator floor, the page key, then `#read-mail` by exact key (fail closed), because the file holds recipients' addresses and subjects (never a body). `days` 1 to 90 and an optional token id are checked before the email service is called; the CSV goes through `csvCell` (`src/lib/csv.ts`), so a cell that starts like a formula stays text; each export is audited (action `export`) ([`../features/EMAIL-API-ACCESS.md`](../features/EMAIL-API-ACCESS.md) §4f). |
| `GET/POST /api/emails/api-messages` | `/dashboard/email-api` | 2026-10-10 | `guardEmailApi()`: the administrator floor, then the page key by exact key; the message id is checked before the email service is called. GET is one message: without `#read-mail` the email service masks the addresses and withholds the body; with it, each read writes a `view` row (2026-10-16, [`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.5). POST needs `#respond` or `#manage`: `{ id }` puts a failed or dead message back on the queue, `{ id, action: "cancel" }` cancels a scheduled message whose time has not come (409 when it is too late, the email service decides); any other action is refused with 400. Each re-send and cancel is audited ([`../features/EMAIL-API-ACCESS.md`](../features/EMAIL-API-ACCESS.md) §4f). |
| `POST /api/settings/user` | `/dashboard/settings` | 2026-10-10 | Your own name and theme. Another person's name needs `/dashboard/settings#others` by exact key, and their role below yours (vendor support: anyone); only the name can be changed for someone else. Audited when it names someone else, and their sessions pick the new name up on their next request. |
| `POST`, `DELETE /api/settings/testing-pass` | `/dashboard/settings` | 2026-10-17 | Vendor support's testing pass (§1.4). `POST { hours: 1 \| 4 \| 8 }` is Vendor support only and needs a real sign-in from the last 10 minutes, never a pass (403 with `x-fresh-sign-in: required` otherwise); it writes `testingPassUntil` into the caller's own session, never past its end. `DELETE` ends the caller's own pass. The body is checked strictly; both are audited (`testing_pass_start`, `testing_pass_end`); a read-only role is refused by the pipeline. No rate limit: it changes only the caller's own session |
| `POST /api/settings/confirm-code` | `/dashboard/settings` | 2026-10-25 | The email code (§1.4; PERMISSIONS-SYSTEM §10.5). `{ action: 'send' }` emails a 6-digit code to the caller's own address through `EMAIL_QUEUE` and keeps only its SHA-256 hash in the caller's session (one a minute, 429 otherwise); `{ action: 'check', code }` with the right code writes `codeConfirmedAt`, a fresh sign-in for 10 minutes. 10 minutes, 5 tries, used once (410 after); the body is checked strictly; audited (`confirm_code_sent`, `confirm_code_ok`, `confirm_code_failed`). It changes only the caller's own session |
| `GET /api/dashboard/overview` | `/dashboard` | 2026-10-26 | The Overview's one read ([`../features/DASHBOARD.md`](../features/DASHBOARD.md)), replacing `GET /api/dashboard/metrics`. `locals.user` (401), then each section only for someone who opens the page it links to, decided as the sidebar decides (`decideAccess` and `pageFloorOpens`), plus `denyHealth` for Platform and `canViewGitHub` for Latest changes; a section the viewer may not open is left out of the answer. `day` must be a real day within a day of UTC or the UTC date is used. Read only; guests' names are cut to a first name and an initial; `no-store`. Tested in `test/overview.test.ts` |
| `GET /api/analytics/{part}` | `/dashboard/analytics` | 2026-10-26 | One part of the Analytics page, or `summary` ([`../features/ANALYTICS.md`](../features/ANALYTICS.md)). `locals.user` (401), an unknown part 404, then `denyAnalytics`: the page, the part's own key (`/dashboard/analytics/{part}`), `#export` for `?format=csv` and `#refresh` for `?fresh=1`, each with `placRequireGrant` (fail-closed); `summary` builds only the parts `analyticsCan` allows. `range` is one of `7d`, `30d`, `90d` and `tz` passes `safeTimeZone` (no quote or space) before it reaches a HogQL literal; `retry=1` (since 2026-10-26, round 2) skips only a kept copy in which a source failed and needs no key of its own. Read only; the Supabase reads select no names, emails or phones, and the email ledger read keeps only each email's source, kind, status and first delivered and opened times (the provider's reason is dropped); CSV cells starting `=`, `+`, `-` or `@` are prefixed with `'`; `no-store`, and the edge-cache copy (10 minutes) holds counts and page addresses only. Tested in `test/analytics.test.ts` |
| `GET /api/system-health` | `/dashboard/health` | 2026-10-17 | System health, which replaced Diagnostics (`/api/diagnostics/*`, Developer Tools key) and Alerts (`/api/alerts/*`) on 2026-10-17 ([`../features/SYSTEM-HEALTH.md`](../features/SYSTEM-HEALTH.md)). `denyHealth()` (`src/lib/auth/surface-guards.ts`): the page key by exact key (fail closed). Reads stored results and problems and runs nothing; error text, response times and raw output only with `#details`. A check that depends on a provider and fails or needs a look carries what that provider's public status page reported (`provider`: its name, the page's own words and the page's address from the portal's own list, never one the page sent), for everyone with the page key. |
| `POST /api/system-health/run` | `/dashboard/health` | 2026-10-17 | `denyHealth(user, 'run')`. A strict body (`check` one of the catalog's ids, or nothing for every check); one check at most once a minute and every check at most once every two minutes (429), the stored results being the clock. Every check only reads. Audited (`health_run`) |
| `GET/POST/PATCH /api/system-health/problems` | `/dashboard/health` | 2026-10-17 | GET: the page key; compliance records and test alerts are never listed, and what a problem said only with `#details`. POST closes one problem: `denyHealth(user, 'resolve')`, 10 a minute (`health-resolve`), a strict body (`asOf` in D1's time form, a reason of 3 to 500 characters); it closes only the rows open at `asOf` (409 when none), refuses compliance records and test alerts (400), and a health check's problem whose check does not pass needs `#resolve-anyway` (403). Audited (`health_resolve`) with the reason. PATCH (migration `0074`): `denyHealth(user, 'ack')`, 10 a minute (`health-ack`), a strict body by `action` (`ack`; `snooze` with `hours` 1, 4 or 24 and a reason of 3 to 200 characters; `unsnooze`); refuses compliance records and test alerts (400), 409 when nothing is open or snoozed. Audited (`health_ack`, `health_snooze` with the reason and end, `health_unsnooze`) |
| `GET /api/system-health/history` | `/dashboard/health` | 2026-10-17 | The page key; the website's compliance records (ARCO documents handed out) need `#details` (403), because they name staff and requests |
| `GET/POST /api/system-health/heavy` | `/dashboard/health` | 2026-10-17 | `denyHealth(user, 'run-heavy')` (migration `0075`). POST, 3 a minute (`health-heavy`), a strict body (`test` `storage` or `email`): the storage write test writes, reads back and deletes one item in the session store and the staff file storage; the test email goes only to the presser's own address, through the email queue with its ledger row. The error behind a failure only with `#details`. Audited (`health_heavy_test`). GET `?email=<uuid>`, 30 a minute (`health-heavy-follow`): that email's ledger row, answered only when it was sent to the person asking (otherwise it reads as not there) |
| `GET/POST /api/system-health/settings` | `/dashboard/health` | 2026-10-17 | GET with the page key: System health's settings (paused checks, quiet windows, the two thresholds), each pause and window with the email address of the person who set it. POST `denyHealth(user, 'configure')` (migration `0076`), 10 a minute (`health-configure`), a strict body by `action`: `pause` (a known check, 1, 4, 24, 72 or 168 hours, a reason of 3 to 200 characters), `resume`, `quiet` (an ISO time from 10 minutes ago to 30 days ahead, 1, 2, 4, 8 or 24 hours, a reason; at most ten windows), `unquiet`, `thresholds` (1 to 5 each), `log-scan` (0, 15, 60, 240 or 360 minutes). Written compare-and-swap, three tries, then 409. Audited (`health_configure`) |
| `GET/POST /api/system-health/logs` | `/dashboard/health` | 2026-10-24 | GET with the page key: the Cloudflare log scan's state and its groups (Worker, level, counts), and Sentry's unresolved issues read with one call (existing `SENTRY_AUTH_TOKEN`, never stored; short id, project, level, counts); the masked messages, likely causes, issue titles, links (https only) and AI briefs only with `#details`. POST `denyHealth(user, 'run')`, a strict body `{ action: 'scan' }`, at most once every two minutes (429, the state row's last run the clock); asks Cloudflare's Workers Observability API at most six questions with the existing `CLOUDFLARE_API_TOKEN` and writes the state row compare-and-swap (409 on a race). Audited (`health_run`, target `log-scan`) |
| `POST /api/system-health/test-alert` | `/dashboard/health` | 2026-10-17 | `denyHealth(user, 'simulate')`, 3 a minute (`health-test-alert`), a strict body (`level` `urgent` or `soon`). Sends a marked test through the real channels and closes it at once. An urgent test's email goes only to the presser's own address, marked `test: true` so the email service never sends it to the alert inbox, and only after the email service says alert emails are not off (`GET /admin/health` as the `health-checks` system actor, which answers counts and `on`/`off`, never an address). Audited (`health_test_alert`) |
| `GET/PATCH /api/system/pages`, `GET/POST/PATCH /api/system/console-features` | `/dashboard/debug/pages` | 2026-10-10 | `canUsePageRegistry()`: since 2026-10-17 (the owner's decision) vendor support and the people vendor support gives the key to, the owner included only by such a grant (a grant-only page, `src/lib/auth/page-floors.ts`), then the exact key. From 2026-10-15 to 2026-10-17 vendor support only; from 2026-10-10 to 2026-10-15 the owner and a grant of the key passed; before that, vendor support only. Below vendor support a page's required role and switch, and a console permission's default role, move only within the editor's own rank (`registryEditRefusal`, `src/lib/auth/registry-impact.ts`). PATCH keeps Page Registry's own default role at vendor support (400), refuses Viewer as a page's default (`canBePageDefault` in `src/lib/auth/rbac.ts`: a Viewer opens only the pages given to them, and the column's CHECK admits only the five older role names), refuses switching off a debug page, and asks a recent sign-in for a change of role or switch; since 2026-10-14 such a change marks every active person for a re-check. 3 changes a minute (`registry`, §6b), shared with the console permission defaults. `POST /api/system/preview` was removed on 2026-10-14 with the old registry screen, its only caller. |
| `GET /api/system/access-overview`, `POST /api/system/page-access`, `GET /api/system/access-history` | `/dashboard/debug/pages` | 2026-10-14 | `canUsePageRegistry()`, as above ([control-room spec](../specs/2026-10-14-access-control-room.md)). The overview applies the viewer's rules on the server (hidden accounts, an owner's or vendor support's overrides). `page-access` takes at most 100 changes in a body of at most 32,768 characters, checks every change with the Access Center's page gates before writing any, writes one D1 batch with one audit row per change, and refuses a read-only viewer; a removed account's setting may only be removed, by vendor support. The history is a read over `admin_audit_log`. |
| `GET/POST /api/content/services` | `/dashboard/content` | 2026-05-26 | |
| `POST /api/content/blocks` | `/dashboard/content` | 2026-05-26 | |
| `GET/POST /api/content/faqs` | `/dashboard/content` | 2026-05-26 | |
| `GET/POST /api/content/stats` | `/dashboard/content` | 2026-05-26 | |
| `GET/POST /api/content/reviews` | `/dashboard/content` | 2026-05-26 | |
| `GET/POST /api/media/gallery` | `/dashboard/content/media` (middleware) | 2026-05-26 | See the media note below. |
| `POST /api/media/upload` | `/dashboard/content/media` (middleware) | 2026-05-26 | |
| `GET/DELETE /api/media/library` | `/dashboard/content/media` (middleware) | 2026-05-26 | DELETE also restricted to DEV/Owner via existing `isOwnerOrDev` check. |
| `POST /api/media/revalidate` | `/dashboard/content/media` (middleware) | 2026-05-26 | |
| `GET /api/cron/jobs/[id]/check`, `GET /api/cron/jobs/[id]/history` | `/dashboard/cron` | 2026-10-09 | `denyCron()` (`src/lib/auth/surface-guards.ts`) on the page key alone, like `GET /api/cron`, because both only read: the check reads the control document, the job's own gate and its lease row and writes nothing; the history reads Analytics Engine. An id the registry does not hold answers 404 before anything is read, and the history query also refuses any id that is not lowercase letters, digits and hyphens. The other Cron Control routes and their action keys: [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md) §1. |

**Media note (2026-09-20).** The four media handlers call
`placDenyResponse(user, '/dashboard/media')`, but that key is neither a page nor
a registry row, so their route-level check resolves against nothing and is
effectively inert. The gate that actually holds is the middleware mapping
`/api/media` → `/dashboard/content/media`. Flagged to the code owners; the fix
is a one-word change in the handlers, not in this document.

All data-bearing API routes that map to a dashboard page enforce PLAC — and
since the `enforce` flip, so does every other `/api/*` route, because an unmapped
path is denied. `/api/health` is the only genuinely public endpoint of the three
previously listed here: `/api/diagnostics` (removed 2026-10-17) mapped to `/dashboard/debug/diagnostics`
until System health replaced it, and the third, the Feature Flags switch, was
deleted with its table on 2026-10-10. *That sentence previously said all three were on
role-only gates "by design".*

---

## 6b. Input Validation & Rate Limit Coverage

### Rate-Limited API Routes

| Route | Limit | Identifier | Key |
|-------|-------|-----------|-----|
| `GET /api/bookings/[id]` | 60/min | `bookings-detail` | `user.userId` |
| `GET /api/users` | 30/min | `users-list` | `session.userId` |
| `PATCH /api/system/pages`, `PATCH /api/system/console-features` | 3/min (one budget for both) | `registry` | `actor.userId` / `viewer.userId` |
| `POST /api/system/console-features` (the impact preview) | 20/min | `system-preview` | `viewer.userId` |
| `POST/PATCH/DELETE /api/users/manage` | 10/h | `users-manage` | `session.userId` |
| `POST /api/users/resend-invite` | 5/h | `users-resend-invite` | `session.userId` |
| `POST /api/users/cf-resync` | 10/h | `cf-resync` | `session.userId` |
| `DELETE /api/sessions/active-sessions` | 30/min | `session-revoke` | `session.userId` |
| `DELETE /api/sessions/active-revocations` | 30/min | `revocation-unblock` | `session.userId` |
| `POST /api/sessions/flush-sessions` | 5/min | `session-flush` | `session.userId` |
| `GET /api/users/cf-access-audit` | 10/min | `cf-access-audit` | `session.userId` |
| `POST /api/content/blocks` | 30/h | `content-blocks` | `user.userId` |
| `POST /api/content/faqs` | 30/h | `content-faqs` | `user.userId` |
| `POST /api/content/stats` | 30/h | `content-stats` | `user.userId` |
| `POST /api/content/reviews` | 30/h | `content-reviews` | `user.userId` |
| `POST /api/content/services` | 30/h | `content-services` | `user.userId` |
| `POST /api/audit/export` | 5/h | `audit-export` | `session.userId` |
| `POST /api/media/upload` | 20/min | `media-upload` | `user.userId` |
| `POST /api/users/access-center` | 5 saves/min (each save counts once, however many changes) | `plac` | `viewer.userId` |
| `POST /api/system/page-access` | 5/min (the same `plac` budget; one request counts once, however many changes) | `plac` | `viewer.userId` |
| `POST /api/access-requests/[id]` | 5/min (the same `plac` budget; one decision counts once) | `plac` | `viewer.userId` |
| `POST /api/access-requests` | 5/h | `access-requests` | `user.userId` |
| `POST /api/users/access-review` | 5/min | `access-review` | `viewer.userId` |
| `POST/DELETE /api/users/access-templates` | 10/min | `access-templates` | `viewer.userId` |
| `POST /api/users/approvals` | 10/min | `approvals` | `viewer.userId` |
| `POST /api/storage/presign` | 30/min | `storage-presign` | `user.userId` |
| `POST /api/storage/[id]/share` | 20/h | `storage-share-create` | `user.userId` |
| `POST /api/storage/[id]/share/email` | 10/h | `storage-share-email` | `user.userId` |
| `POST /api/storage/requests` | 20/h | `storage-request-create` | `user.userId` |
| `GET/POST /api/storage/share/[token]` | 20/min | `storage-share-consume` | raw client IP — **public route, see §2a** |
| `GET/POST /api/storage/request/[token]` | 30/min | `storage-request-consume` | raw client IP — **public route, see §2a** |
| `POST /api/storage/request/[token]/presign` | 20/min | `storage-request-presign` | raw client IP — **public route, see §2a** |
| `POST /api/storage/request/[token]/confirm` | 20/min | `storage-request-confirm` | raw client IP — **public route, see §2a** |
| `POST /api/auth/logout` | 10/min | `auth-logout` | raw client IP |
| `POST /api/emails/webhook` | 120/min | `brevo-webhook` | raw client IP |

The table is not every limiter: those on the SEO triggers, AI generation, the blog, content
history and email sending, among others, are not listed. `grep -rn "getRateLimiter(" src`
finds every one with its limit and identifier.

Rate limiting goes through `getRateLimiter()` in `src/lib/ratelimit.ts`, backed
since 2026-10-04 by one new binding type, the Workers Rate Limiting binding (the
owner-approved exception), and by D1, which the Worker already had (Upstash Redis until then;
[`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §3.6 owns the
detail):

- **One-minute limits** (every IP-keyed limiter above, and most of the rest):
  Cloudflare's Workers Rate Limiting binding, one `RL_PER_MIN_<n>` per limit
  value, keyed `<limiter>:<caller>` so two limiters never share a counter. Its
  counts are per Cloudflare location and approximate: an abuse guard, not an
  accounting system.
- **Hour and day limits** (signed-in routes only, keyed by `user.userId`): a
  fixed-window counter row in D1 `admin_portal_settings`, counted by one atomic
  upsert, so two concurrent requests cannot both read the same count.

**Fail-closed is unchanged.** A missing binding or D1 in production is reported
and refuses every request on that limiter (outside production it allows, so
local work needs no setup); a binding or D1 call that throws refuses too, with
`reason: 'unavailable'`. Logout and the RFC 8058 unsubscribe proceed on
`unavailable`, because refusing either does harm (a session left alive; an
unsubscribe not honoured). A one-minute limit with no binding would refuse
every request on its route, so `test/ratelimit-bindings-contract.test.ts` fails
the build when a `getRateLimiter(…, window: '1 m')` call names a limit
`wrangler.toml` does not bind. `safeRateLimit()` still wraps the call on 11
route files (`grep -rln "safeRateLimit(" src/pages`) and fails closed if
`.limit()` itself throws. No limiter key is written to any store with an
expiry to forget any more: the binding's counters are Cloudflare's, and a D1
counter row holds a user id and a count, overwritten each window. The Upstash
history (3 s timeouts, keys without expiry) is in
[`../operations/incidents/2026-10-02-redis-keys-without-expiry.md`](../operations/incidents/2026-10-02-redis-keys-without-expiry.md).

### Zod Schema Validation

| Route | Schema | Validates |
|-------|--------|----------|
| `POST /api/content/reviews` | `ReviewsSchema` | `Array<{ id, name, text: string; rating: int 1-5 }>`, max 50 items |
| `POST /api/content/services` | `ServicesBodySchema` | `{ dogs?, cats?, daycare?: string(max 100); currency?: string(max 10) }` |

The `services.ts` POST no longer spreads `rawBody` directly — only validated fields are written to D1.

### Email Format Validation

`POST/PATCH/DELETE /api/users/manage` — all three verbs validate the email parameter with `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` before any DB lookup.

### Bounded Queries

- `GET /api/users` — Supabase query is bounded with `.limit(200)` to prevent unbounded scans.
- `PageRegistryRepository.updatePage` — `required_role` validation uses `!== undefined` check so empty strings (`''`) are correctly rejected instead of silently bypassing the allowlist.

### Analytics Provider Timeouts

The analytics providers in `src/lib/analytics/providers/` put an
`AbortSignal.timeout()` on every external `fetch()` — 5000 ms in most places,
4000 ms on two Cloudflare calls. This bounds how long a slow upstream
(Cloudflare GraphQL, Supabase metrics, Sentry, **Brevo** — `fetchBrevo`, not
Resend) can hold a request open. Note what it does *not* do: a fetch timeout
bounds wall-clock time, while the Workers free-tier budget is 10 ms of **CPU**
time, which an awaited fetch does not consume. *Corrected 2026-09-20.*

---

## 7. Request Tracing

**There is no `X-Request-ID` header.** Nothing under `src/` sets or reads one;
`grep -rni x-request-id src` returns nothing. *This section claimed one until
2026-09-20.* What exists:

- **`CF-RAY`** — Cloudflare's per-request ID. It is stored on the session
  (`rayId`), on every `admin_login_logs` row (`cf_ray_id`), and it is the handle
  that links a request to the Cloudflare dashboard trace. This is the ID to use.
- **`rid`** — a `crypto.randomUUID()` generated inside the auth pipeline
  (`src/lib/auth/pipeline.ts`) and written into the `details` JSON of authz
  audit events (`src/lib/auth/stages/decide.ts`). It correlates the authz
  decisions *within* one request; it never leaves the server and is not on any
  response.

---

## 8. CF Zero Trust Middleware Bootstrap Hardening

| Protection | Implementation |
|-----------|----------------|
| JWT absence → refuse | **Fail-close**: without `CF-Access-JWT-Assertion` no session can be bootstrapped. An API path gets 401; a page path is redirected to `/?error=missing_token` so the visitor meets the Access challenge rather than a bare error (`src/lib/auth/stages/assertion.ts`) |
| JWT signature verification | RS256 via JWKS from `https://{team}.cloudflareaccess.com/cdn-cgi/access/certs` |
| Audience validation | `aud` claim matched against `CF_ACCESS_AUD` env var (app-specific tag) |
| Whitelist check | Email verified against `admin_authorized_users` (Supabase) before session creation |
| Revocation check | `revoked:{userId}` KV flag checked before any new session bootstrap |
| Active status check | `is_active = false` → 403 even for CF-authenticated users |
| Session binding | Session bound to userId, cfSubId, email, role, loginMethod, createdAt |
| Idempotent cfSubId | `cf_sub_id` written to Supabase on first login with `.is('cf_sub_id', null)` guard |

---

## 9. Required Production Secrets & Vars

**Owner: [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §5.** That
section is derived from the live Worker and from the `[secrets] required` block
in `wrangler.toml`, which `wrangler deploy` enforces. Read it there.

*Replaced 2026-09-20.* A 14-row copy of the secrets table lived here and had
drifted badly: it named `CF_API_TOKEN` and `CF_ZONE_ID` (the real names are
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID`), listed `SITE_URL` — a
`[vars]` entry — as a secret, and omitted ten required secrets. Two facts worth
carrying here because they are security-relevant rather than operational:

- **`IP_HASH_SECRET` is not just an IP hash key.** It is the HKDF root for the
  share-link, file-request, passcode and unsubscribe signing keys
  (`src/lib/storage/share-token.ts`). Rotating it invalidates every live share
  link, file-request link, stored passcode hash and unsubscribe link. It is not
  a routine rotation.
- **`RESEND_API_KEY` is not the outgoing-mail key.** cf-admin sends no email
  through Resend directly: its one reader is a diagnostics ping. Since 2026-10-10
  every system email the portal sends (invitations, storage notices and share
  links, the purge and Search Console alerts) goes onto `EMAIL_QUEUE`
  (`src/lib/email/queue-mail.ts`), and the email service sends it through Brevo,
  then Resend if Brevo fails. Only a sign-in alert the queue refuses still goes
  to Brevo directly (`src/lib/auth/security-logging.ts`).
- **`CONSOLE_SIGNING_KEY` (optional) is shared with three other Workers.** It
  signs the "who you are" headers to cf-backup, cf-vps and cf-email-api
  ([`../features/CONSOLE-SIGNATURE.md`](../features/CONSOLE-SIGNATURE.md)). A
  console holding it refuses every unsigned request, so a rotation sets the new
  value on cf-admin and the three consoles together; between the two the
  consoles answer `400 bad_signature`. Any of the four Workers could forge the
  portal's identity to the others with it: it keeps out Workers that do not hold
  it, not one that does.

---

## 10. Supabase RLS Policy Reference

> **Last Audited:** 2026-04-29 (via Supabase Advisor API — 0 security warnings)
> **Database:** `[SUPABASE_PROJECT_REF]` (shared with cf-astro)

### 10.1 Design Principles

**Zero Anon Access:** The `anon` role has **zero table-level grants**, **zero RLS policies**, and **zero function EXECUTE privileges** across the entire `public` schema. Default privileges are also revoked so future tables inherit this lockdown.

**Service-Role Exclusive — with one documented exception.** `cf-admin` and
`cf-chatbot` access the database via `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
or a direct `DATABASE_URL` connection (bypasses PostgREST). `cf-astro`'s public
forms write through the dedicated, insert-only `cf_astro_writer` role — see
§10.2a. No application code uses the Supabase anon key. *Reworded 2026-09-20:
as written, §10.1 contradicted §10.2a in the same document.*

**Defense-in-Depth:** Even though `service_role` bypasses RLS (via `bypassrls = true`), every table has an explicit `service_role`-only RLS policy. This creates a documented deny-by-default posture for `anon`/`authenticated` roles and prevents accidental exposure if a new code path is added.

---

### 10.2 Table Policy Matrix

> **Re-derive this before citing it (flagged 2026-09-20).** The matrix below was
> last checked live on 2026-08-13 and three repo-level facts have moved since,
> so treat it as indicative, not evidential, until someone re-runs the
> `pg_policies` query:
>
> - `admin_sessions` and `privacy_requests` were **quarantined on 2026-09-16**
>   (renamed `zz_dead_*`), leaving **18** live tables, not 20.
> - "A single `Service role full access` policy on every table" cannot be
>   reconciled with the repo migrations: `contact_message_comments` carries an
>   `admin_read` policy `FOR SELECT TO authenticated`
>   (`supabase/migrations/20260708000000_rls_and_indexes.sql`), `tool_call_events`
>   uses a differently named service-role policy, and four tables carry
>   `cf_astro_writer` policies (§10.2a).
> - The matrix omits `contact_messages` and `contact_message_comments`, which
>   this portal does touch through `InquiryRepository`.

RLS is **enabled** on every public table, and the intended posture is one
service-role policy per table with no `anon` grant anywhere. The exceptions
above are the ones the repo can prove; the live grant state was not re-queried
in this pass.

#### Admin & Session Tables

| Table | Policy | Roles | Notes |
|-------|--------|-------|-------|
| `admin_authorized_users` | ALL | service_role | Authorization whitelist — `cf_sub_id` for Layer 3 revocation |
| `email_audit_logs` | ALL | service_role | Email dispatch audit; CASCADE on booking delete |
| `contact_messages`, `contact_message_comments` | ALL (+ an `admin_read` policy `TO authenticated` on the comments table) | service_role, authenticated | Customer inquiries, read through `InquiryRepository` |

#### Chatbot & Analytics Tables (PII — customer data)

| Table | Policy | Roles | Notes |
|-------|--------|-------|-------|
| `contacts` | ALL | service_role | Customer PII (names, emails, phones) |
| `conversations` | ALL | service_role | Chat history linked to contacts |
| `messages` | ALL | service_role | Message content |
| `chat_analytics` | ALL | service_role | Aggregate analytics |
| `conversation_metrics` | ALL | service_role | Performance metrics |
| `feedback_events` | ALL | service_role | User feedback signals |
| `intent_events` | ALL | service_role | Intent classification data |
| `kb_gaps` | ALL | service_role | Knowledge base gap analysis |

#### Booking & Compliance Tables

| Table | Policy | Roles | Notes |
|-------|--------|-------|-------|
| `bookings` | ALL + UPDATE | service_role | Pet boarding reservations |
| `booking_pets` | ALL | service_role | Pets linked to bookings |
| `booking_quality_metadata` | ALL | service_role | Booking quality signals |
| `consent_records` | ALL | service_role | GDPR/LFPDPPP consent receipts |
| `legal_requests` | ALL + SELECT | service_role | ARCO rights requests. The identity document itself is **not here** — it is an R2 object owned by cf-astro; this table holds only its MIME type and size |

`admin_sessions` and `privacy_requests` had rows in this table until 2026-09-20.
Both were renamed `zz_dead_*` on 2026-09-16 and hold no live processing.

> **Historical note (removed 2026-04-29):** Tables `bookings`, `booking_pets`, `booking_quality_metadata`, `consent_records`, `privacy_requests`, and `legal_requests` previously had `anon` INSERT policies for public forms. These were vestigial — GoTrue auth was removed, and no application uses the anon key. All anon policies have been dropped.

#### 10.2a The `cf_astro_writer` role — public-form writes, least privilege

**Added to this document 2026-08-13; it was previously undocumented anywhere.**
Dropping the `anon` policies did not remove the need for the public site to
record bookings and consent. That capability moved to a **dedicated database
role**, `cf_astro_writer`, holding the narrowest possible grants:

| Table | `cf_astro_writer` policy | Commands |
|---|---|---|
| `consent_records` | `cf_astro_writer_insert` | INSERT only |
| `bookings` | `cf_astro_writer_insert` | INSERT only |
| `booking_pets` | `cf_astro_writer_insert` | INSERT only |
| `legal_requests` | `cf_astro_writer_insert`, `cf_astro_writer_select` | INSERT, SELECT |

Verified live via `pg_policies` on 2026-08-13; **four** tables, not five —
`cf_astro_writer_insert` was dropped from `privacy_requests` on 2026-09-16 when
that table was quarantined
(`supabase/migrations/20260916000000_supabase_objects_chunk_14a.sql`, corrected
here 2026-09-20). `anon` holds **zero** policies on all of them, so §10.2's
statement is correct as far as it goes — it was simply incomplete, and
`PRIVACY.md` §2 read the gap as "still `anon`".

Why this matters: an insert-only grant to a dedicated role is a materially
stronger posture than an `anon` grant, and it is a real control worth citing in a compliance answer —
but only now that it is written down. An undocumented control cannot be
audited.

---

### 10.3 Function Security

All public functions have `SET search_path = public` to prevent search-path
hijacking. EXECUTE is revoked from `anon`, `authenticated` and `PUBLIC` on
**four of the six** functions in the schema — not all of them.

> **Corrected 2026-09-20 from a live `has_function_privilege` check.** This
> section, §11 and the §0 posture row all claimed a blanket revoke.
> `increment_conversation_metrics` and `purge_expired_privacy_data` are still
> EXECUTE-able by `anon` and `authenticated`. Neither is `SECURITY DEFINER`, so
> a caller runs with their own privileges and `anon` holds zero table grants —
> the body would fail on table access. It is a false claim and a posture defect,
> **not** a live exposure path today. It becomes one the moment a grant or an
> RLS policy changes, and `purge_expired_privacy_data` is a deletion routine.
> The REVOKE needs a Supabase migration and is outstanding work.

| Function | Signature | search_path | EXECUTE Revoked From |
|----------|-----------|-------------|---------------------|
| `get_command_center_analytics` | `(p_days integer)` | `public` | anon, authenticated, PUBLIC ✅ |
| `get_kb_clusters` | `(p_resolved boolean)` | `public` | anon, authenticated, PUBLIC ✅ |
| `get_usage_metrics` | `(p_days_ago integer)` | `public` | anon, authenticated, PUBLIC ✅ |
| `increment_conversation_metrics` | `(uuid, text, bool, int, numeric[, text])` | `public` | **Not revoked** — `anon` and `authenticated` can EXECUTE. Not `SECURITY DEFINER` |
| `purge_expired_privacy_data` | `()` | `public` | **Not revoked** — `anon` and `authenticated` can EXECUTE. Not `SECURITY DEFINER`. A deletion routine, so it is the one to fix first |
| `rls_auto_enable` | (trigger) | `pg_catalog` | anon, authenticated, PUBLIC ✅ (the one `SECURITY DEFINER` function, and it is locked down) |

---

### 10.4 Table-Level Grant Lockdown

**All DML privileges have been revoked from `anon` on all public tables:**

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
```

This means even if an RLS policy is accidentally misconfigured in the future, `anon` won't have the underlying table privilege to exploit it.

---

### 10.5 Index Coverage

All foreign keys have covering indexes to prevent sequential scans during JOINs and CASCADE operations.

| Table | Column | Index | Added |
|-------|--------|-------|-------|
| `booking_pets` | `booking_id` | `idx_booking_pets_booking_id` | 2026-04-29 |
| `chat_analytics` | `contact_id` | `idx_chat_analytics_contact_id` | 2026-04-29 |
| `chat_analytics` | `conversation_id` | `idx_chat_analytics_conversation_id` | 2026-04-21 |
| `email_audit_logs` | `booking_id` | `idx_email_audit_logs_booking_id` | 2026-04-21 |
| `feedback_events` | `contact_id` | `idx_feedback_events_contact_id` | 2026-04-29 |
| `feedback_events` | `message_id` | `idx_feedback_events_message_id` | 2026-04-29 |
| `feedback_events` | `conversation_id` | `idx_feedback_events_conversation_id` | 2026-04-29 |
| `intent_events` | `contact_id` | `idx_intent_events_contact_id` | 2026-04-29 |
| `intent_events` | `message_id` | `idx_intent_events_message_id` | 2026-04-29 |
| `intent_events` | `conversation_id` | `idx_intent_events_conversation_id` | 2026-04-29 |
| `kb_gaps` | `contact_id` | `idx_kb_gaps_contact_id` | 2026-04-29 |
| `kb_gaps` | `conversation_id` | `idx_kb_gaps_conversation_id` | 2026-04-29 |

Removed: 20+ unused indexes dropped to save Free Tier storage (2026-04-29). Duplicate `idx_consent_records_consent_id` removed (2026-04-21).

---

### 10.6 Required Manual Actions (Phase 0 — CF Dashboard Setup)

> **Historical procedure, kept as the rebuild recipe.** These one-time steps were
> run before the CF Zero Trust auth flow went live; they cannot be automated. If
> you are rebuilding the Access application from this list, note the domain
> correction below — the original text would have protected the wrong host.

**Cloudflare Zero Trust Application:**

1. Zero Trust → Access → Applications → Add Self-Hosted App
2. Application domain: **`secure.madagascarhotelags.com`** with path `/*`.
   *Corrected 2026-09-20 — this said `admin.madagascarhotelags.com`. The
   Worker's only route is `secure.madagascarhotelags.com` (`wrangler.toml`), so
   the documented step protected a host the application does not serve.*
3. Session Duration: **24 hours** (must match KV TTL)
4. Identity providers: Google, GitHub, One-Time Pin only
5. Note the **Application Audience (AUD)** tag → add to `wrangler.toml` as `CF_ACCESS_AUD`

**Global Session Timeout:**

- Zero Trust → Settings → Authentication → Global Session Timeout: **24 hours**

**CF API Tokens (dash.cloudflare.com → My Profile → API Tokens):**

- `CF_API_TOKEN_READ_LOGS`: Account → Access Audit Logs / SCIM Logs / Logs → **Read**
- `CF_API_TOKEN_ZT_WRITE`: the permission Layer 3 needs is **Access:
  Organizations — Revoke**; the same token also runs the Access group sync and the
  Access audit read. *Corrected 2026-09-20: this said "Zero Trust → Edit
  permission only".* What the token holds is listed in
  [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §6, and its scope is
  tracked in `../MAINTENANCE.md` (private) (PD-7).

**Google Cloud Console — OAuth Redirect:**

- Add: `https://{team}.cloudflareaccess.com/cdn-cgi/access/callback`
- Remove: old Supabase redirect URIs

**GitHub OAuth App:**

- Authorization callback URL: `https://{team}.cloudflareaccess.com/cdn-cgi/access/callback`

---

## 11. Defense-in-Depth Architecture

The Supabase database is protected by **three independent layers**. Even if one layer is compromised or misconfigured, the other two prevent unauthorized PII access.

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: TABLE-LEVEL GRANTS                             │
│  anon has ZERO grants on any table in public schema      │
│  Default privileges revoked for future tables             │
│  → PostgREST returns 404 for anon on any table           │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: ROW-LEVEL SECURITY (RLS)                       │
│  Service-role-only policies on the admin tables, plus     │
│  four insert-only cf_astro_writer policies (§10.2a)       │
│  No policy matches anon; one matches authenticated        │
│  (contact_message_comments admin_read) — see §10.2        │
├─────────────────────────────────────────────────────────┤
│  LAYER 3: FUNCTION ACLs — INCOMPLETE                     │
│  EXECUTE revoked on 4 of 6 public functions               │
│  All functions have pinned search_path                    │
│  → 2 remain callable by anon/authenticated; neither is    │
│    SECURITY DEFINER, so Layers 1-2 still deny the body    │
└─────────────────────────────────────────────────────────┘
```

---

## 12. Hardening Migrations Applied

### Phase 1 (2026-04-21)

| Migration | Description |
|-----------|-------------|
| `harden_chatbot_tables_rls` | Replaced `USING(true)` with service_role on 4 chatbot tables |
| `harden_bookings_and_email_audit_rls` | Locked bookings UPDATE + added email_audit_logs policy |
| `fix_rls_initplan_performance` | Wrapped `auth.role()` in subquery for 3 admin tables |
| `fix_function_search_path` | Pinned search_path on `get_usage_metrics()` |
| `add_fk_indexes_drop_duplicate` | 3 FK indexes added, 1 duplicate dropped |

### Phase 2 (2026-04-29) — Deep Lockdown

| Migration | Description |
|-----------|-------------|
| `lock_down_rls_policies` | Restricted 9 tables' RLS from PUBLIC→service_role; removed 6 vestigial anon INSERT policies; added 6 replacement service_role policies |
| `revoke_anon_function_and_table_access` | Revoked EXECUTE on 4 functions (5 overloads) from anon/authenticated/PUBLIC; revoked ALL table grants from anon; locked default privileges |
| `add_remaining_fk_indexes` | Added 6 covering indexes for remaining unindexed foreign keys |

---

---

> # §13–§15 are historical audit logs
>
> **Everything below this line is a point-in-time record of the May 2026 review
> passes, kept for provenance. It is not the current posture — §0–§12 are.**
> Banner added 2026-09-20, because three "Items Remaining" lists in these
> sections had been read as live state long after they were closed. Each list
> now carries its own status note. They belong in `reviews/` alongside the full
> reports; moving them is a separate change.

## 13. Security Audit Log — 2026-05-24 Deep Review

Full report: [`security/reviews/2026-05-24-security-review.md`](./reviews/2026-05-24-security-review.md)

### Vulnerabilities Patched

| Severity | File | Vulnerability | Fix |
|----------|------|--------------|-----|
| 🔴 Critical | `src/components/admin/logs/shared.tsx` | **Stored XSS** — `JSON.stringify` does not HTML-escape `<>&`; raw data passed to `dangerouslySetInnerHTML` in JSONViewer. Exploitable via crafted URL paths stored in audit log. | Added `escapeHtml()` applied per matched regex token before `<span>` insertion |
| 🔴 High | `src/lib/auth/security-logging.ts` | **HTML injection in security alert emails** — `userAgent`, `email`, `geoLocation`, `cfIdentityProvider`, `failureReason` interpolated raw into HTML email. Unauthenticated attacker can inject HTML via `User-Agent` header. | Added `escHtml()` helper; applied to all 5 user-controlled fields |
| 🔴 High | `cf-admin/src/lib/cms/storage.ts` (renamed — this was a single `cms.ts` file when the finding was written, since split into a directory) | **MIME type bypass** — `file.type` (client-controlled multipart header) trusted without verifying actual file bytes. Attacker could upload HTML/SVG as `image/jpeg`. | Added `validateImageMagicBytes()` (JPEG/PNG/WebP/AVIF signatures); replaced filename-based extension with hardcoded `MIME_TO_EXT` map |
| 🟠 Medium | `src/pages/api/bookings/index.ts` | **PostgREST filter injection** — `search` param interpolated raw into `.or()` filter string | Added `sanitizeSearchTerm()` stripping PostgREST operator chars |
| 🟠 Medium | `src/pages/api/audit/receipts.ts`, `src/pages/api/arco/requests.ts`, `src/lib/dal/InquiryRepository.ts` | **PostgREST filter injection** (found 2026-10-15, after this review) — the consent, ARCO and Inquiries searches spliced typed text into `.or()` the same way | `safeSearchTerm()` (`src/lib/search-term.ts`) keeps letters, digits and `@._+-` only; `test/search-term.test.ts` |
| 🟠 Medium | `src/pages/api/users/force-kick.ts` | **Supabase filter injection** — `.or(`id.eq.${userId}`)` with attacker-controlled `userId` | Replaced with `.eq('id', userId).limit(1)` |
| 🟠 Medium | `src/lib/auth/session.ts` | **Session cookie `SameSite: lax`** — Admin cookie sent on cross-origin top-level navigation | Changed to `SameSite: strict` on both `createSession` and `destroySession` |
| 🟠 Medium | `src/lib/auth/session.ts` | **patchSession resets KV TTL** — every 30-min role recheck extended KV entry lifetime to now+24h | Now uses `remainingMs = maxLifetime − (now − session.createdAt)` with 60s floor |
| 🟡 Low | `src/pages/api/users/manage.ts` | **No `displayName` length limit** — unbounded string stored in D1 + audit log | Added 120-char limit |
| 🟡 Low | `src/pages/api/settings/user.ts` | **Theme cookie missing `Secure` attribute** | Added `Secure` to both set and clear `Set-Cookie` headers |
| 🟡 Low | `src/pages/api/auth/logout.ts` | **No rate limit on logout** — KV delete + audit write unbounded | Added 10 req/min per IP via `getRateLimiter` |
| 🟡 Low | `wrangler.toml` | **Developer email in committed `[vars]`** — `LOCAL_DEV_ADMIN_EMAIL` should be in gitignored `.dev.vars` | Removed from `[vars]`; replaced with comment pointing to `.dev.vars` |
| 🟡 Low | `documentation/SECURITY.md` | **Stale break-glass docs** — referenced `BREAK_GLASS_EMAILS` / `isBreakGlassAdmin()` that no longer exist | Replaced with accurate statement that no hardcoded bypasses exist |

### Items Resolved After Initial Audit

| Item | Resolution | Date |
|------|-----------|------|
| Security docs synced to public repo via `sync-docs.yml` | **✅ Approach settled 2026-05-24, narrowed since.** *Status note 2026-09-20: this row no longer describes the workflow.* `sync-docs.yml` now publishes living docs only — `program/`, `records/`, `commercial/`, `MAINTENANCE.md` and several named files are **excluded**, and the redaction step strips dashed UUIDs, 64- and 32-hex strings and 20-character project-ref-shaped tokens as well as personal developer emails. "All `.md` synced, resource IDs preserved intact" has not been true for some time; read `.github/workflows/sync-docs.yml` for what actually ships. | 2026-05-24 |
| `Content-Security-Policy` — Phase 1 hardening | **✅ Partially done 2026-05-24.** Enforced CSP updated: (1) `https://*.sentry-cdn.com` wildcard replaced with explicit `https://browser.sentry-cdn.com`; (2) `frame-ancestors 'none'` added; (3) `base-uri 'self'` added; (4) `object-src 'none'` added; (5) `form-action 'self'` added; (6) `upgrade-insecure-requests` added; (7) `Permissions-Policy` header added disabling camera/mic/payment/geo/USB/sensors. `Content-Security-Policy-Report-Only` deployed with hardened policy (no `unsafe-inline`/`unsafe-eval`) reporting violations to Sentry. | 2026-05-24 |

### Items Remaining (as of 2026-05-24 — status appended 2026-09-20)

> Two of these four are closed and one is mis-sized. `'unsafe-eval'` was removed
> on 2026-07-25 and SEC-01 now forbids it. The Chart.js SRI item is moot —
> Chart.js is no longer CDN-loaded; what remains is that `cdn.jsdelivr.net` is
> still in `SCRIPT_SRC_HOSTS` and should come out (§4). The `style-src` row
> undercounts by more than an order of magnitude: 885 occurrences, not ~20.
> Only the `script-src 'unsafe-inline'` row is still live work.

| Item | Root Cause | Required Work |
|------|-----------|--------------|
| `script-src 'unsafe-inline'` | `@sentry/astro` v10 injects an inline init script into `<head>` that cannot currently receive an Astro-managed nonce | Implement nonce generation in Workers middleware → pass via `Astro.locals.cspNonce` → apply to Sentry's build hook. Alternatively: compute SHA-256 hash of Sentry's static init script and add as `'sha256-{hash}'` to CSP |
| `script-src 'unsafe-eval'` | Retained pending verification Sentry v10 doesn't use `eval()` for stack trace processing in Workers | After collecting ≥ 2 weeks of Report-Only data with no `unsafe-eval` violations: remove it from enforced CSP. If violations appear: upgrade Sentry or disable the offending integration |
| `style-src 'unsafe-inline'` | Preact SSR emits `style="..."` attributes in HTML for ~20 components using dynamic `style={{ }}` props (`ExpandedRow.tsx`, and others; `AccessPolicyGrid.tsx` removed 2026-10-26) | Convert ~20 `style={{ }}` prop usages to Tailwind utility classes or CSS custom properties. Many use runtime-computed role colors — those need CSS variable injection instead |
| Chart.js CDN — no SRI hash | `cdn.jsdelivr.net/npm/chart.js@4.4.7` lacks `integrity` attribute | Compute: `curl -s https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js \| openssl dgst -sha384 -binary \| openssl base64 -A` then add `integrity="sha384-{hash}"` to `usage.astro:8`. Or move chart.js to `package.json` and bundle it via Vite (eliminates CDN dependency) |

---

## 14. Security Audit Log — 2026-05-25 Deep Review

Full report: [`security/reviews/2026-05-25-security-review.md`](./reviews/2026-05-25-security-review.md)
Shipped on `main` via PR #2 (merge commit `3f8cd78`) as 7 atomic commits.

### Vulnerabilities Patched

| Severity | File | Vulnerability | Fix |
|----------|------|--------------|-----|
| 🔴 Critical | `src/pages/api/users/access.ts` | **PLAC bypass via spoofed `targetUserRole`** — Hierarchy Gates A (rank) and B (ghost) read `targetUserRole` from the request body. An admin (level 3) could send `{ targetUserId: <super_admin_id>, targetUserRole: "staff", action: "revoke" }` to lockout a super_admin from a dashboard page; a user with a PLAC deny could self-grant within their own clearance. | Fetch verified role + email from `admin_authorized_users` on every call; use DB values for all gates and audit payload. Forbid `actor.userId === targetUserId` — denies must not be self-removable. `body.targetUserRole` treated as informational only. |
| 🔴 Critical | `src/workers/cf-entry.ts` | **Weekly asset-cleanup cron never ran** — wrangler.toml triggers `"0 2 * * SUN"` (CF rejects the numeric `0` form), but the dispatcher only matched `"0 2 * * 0"`. CF echoes the original pattern back, so the equality failed and R2 grew unbounded. | Dispatcher accepts both `"0 2 * * SUN"` and `"0 2 * * 0"`. |
| 🟠 High | `src/lib/csrf.ts` | **CSRF Referer prefix bypass** — `referer.startsWith(siteUrl)` accepted `https://secure.example.com.attacker.com/...`. Modern browsers send Origin so exposure was narrow, but the bypass was real. | Anchored match: exact equality to normalized SITE_URL, or prefix followed by `/`. |
| 🟠 High | `src/pages/api/settings/user.ts` | **Cross-user settings edit ignored target hierarchy** — POST checked editor was admin+ but never the target's role. An admin could rewrite a super_admin's `display_name`, enabling visual impersonation in any UI surface that renders display_name. | When editing another user, fetch target role and reject unless editor strictly outranks target. DEV exempt. |
| 🟠 High | `src/pages/api/audit/silence.ts` | **DEV self-silence + KV TTL rejuvenation** — DEV could mute their own audit trail by passing their own userId. `propagateAuditSilence` also rewrote every active session with `expirationTtl = SESSION_MAX_LIFETIME` (same bug previously fixed in `patchSession`). | Reject `targetUserId === session.userId` (requires a second DEV). Compute remaining TTL from `session.createdAt`, floor at 60s; read `SESSION_MAX_LIFETIME_MS` from env. |
| 🟠 High | `src/lib/auth/guard.ts` + 10 routes | **Most API routes bypassed PLAC entirely** — at the time, the middleware skipped PLAC for `/api/*` (this changed on 2026-08-12, §6a); many data routes ignored explicit denies on the corresponding page. A super_admin denied `/dashboard/users` could still call `/api/users/manage` etc. | Added `requirePageAccess()` + `placDenyResponse()` helpers. Wired into highest-risk routes (all `/api/audit/*` data endpoints, `audit/prune`, `users/{manage, force-kick, access-data}`). See §6a above. |
| 🟠 High | `src/lib/auth/cloudflare-access.ts` | **JWKS cache double-fetch on rotation** — Bust-and-retry path fetched fresh keys into an unused variable then fell through to a third `fetchPublicKeys()` call. Functionally correct but confusing — next reviewer would misread as "use stale key". | Single reassignable variable; behavior identical. |

### Additional fixes bundled with the PLAC PR

- `access-data.ts` ghost-protection: non-DEV actors get 403 when querying a DEV/Owner's PLAC matrix (was a back door around the `/api/users` ghost-hiding).
- `audit/prune.ts` `days` parameter: NaN-safe and bounded to 1–3650. Previous `Math.max(1, parseInt('abc'))` produced silent SQL no-ops.

### Items Remaining (as of 2026-05-25)

All Critical and High items shipped in PR #2 (2026-05-25). The follow-up pass on 2026-05-26 (commit `27e6090` — see §15) cleared every Medium and Low item that had a meaningful exploit path or genuine functional impact, plus the entire dependency CVE list. Only soft items remained: the audit-log DELETE policy decision, dead-code migration cleanup and advisor lints. *Status note 2026-09-20: the tracker referenced here is archived at `../archive/PENDING_PHASES.md`; open work now lives in `../MAINTENANCE.md` and `../program/ROADMAP.md`. The audit-log DELETE decision was ultimately taken the other way — deletion stayed, and the tamper-evidence gap it leaves is item 1 in [`THREAT-MODEL.md`](THREAT-MODEL.md) §3.*

---

## 15. Security Audit Log — 2026-05-26 Deep-Review Follow-Up

Full report: [`security/reviews/2026-05-26-security-review.md`](./reviews/2026-05-26-security-review.md)
Shipped on `main` via commit `27e6090` (single atomic commit — 28 files changed, +637 / −319).

This pass re-verified every deferred item from the 2026-05-25 review and closed every meaningful gap. Production `npm audit` drops from **16 vulnerabilities (3 high, 12 moderate, 1 low) to 0**.

### Vulnerabilities & Improvements Patched

| Severity | File(s) | Issue | Fix |
|---|---|---|---|
| 🔴 Crit (gap) | 18 API routes — `content/*`, `media/*`, `settings/portal`, `users/*`, `audit/silence` | **PLAC bypass via direct JSON API.** Routes had role gates but never called `placDenyResponse()`, so an admin with an explicit deny on `/dashboard/content`, `/dashboard/media`, `/dashboard/settings`, or `/dashboard/users` could still POST to the corresponding APIs (mutate FAQs, post a gallery, list active sessions, etc.). | `placDenyResponse(user, '/dashboard/<page>')` added after the existing role gate on every flagged route. DEV-exempt, behaviour-identical for users without an explicit deny. See §6a for the full route table. |
| 🔴 Crit | `content/{reviews,faqs,stats}.ts` GET handlers | **Route crash on corrupt JSON.** `JSON.parse(result.content)` had no try/catch; one corrupted row in `cms_content` would 500 the whole route and the dashboard page that depends on it. | Wrapped in try/catch with empty-array fallback — same pattern already in `gallery.ts:27`. |
| 🔴 Crit | `bookings/[id]/state.ts` | **`operational_status` accepted any string** (no DB CHECK, no zod allow-list) and `internal_notes` had no length cap. Garbage strings could persist into D1 and corrupt UI filters. | Defined `VALID_OPERATIONAL_STATUS = {'pending','confirmed','in_progress','completed','cancelled','no_show'}`; reject otherwise with 400. Cap `internal_notes` at 2000 chars. |
| 🟠 High | 16 npm packages | **Production `npm audit`: 16 vulnerabilities** including high-severity `vite` path traversal + WS file read, `devalue` DoS, `fast-uri` path traversal + host confusion, plus moderate-severity `astro` XSS, `@astrojs/cloudflare` SSRF, `postcss` XSS, `ws` memory disclosure, `yaml` stack overflow. | `npm audit fix` (non-breaking) + `@astrojs/cloudflare ^13.1.6 → ^13.5.4` + `@astrojs/check ^0.9.8 → ^0.9.9`. Moved `@astrojs/check` from `dependencies` → `devDependencies` (build-only). **Result: 0 prod vulnerabilities.** |
| 🟠 High | `src/workers/scheduled-log-sync.ts` | **Email amplification.** For every failed CF Access login returned by the audit poll, one alert email was sent via Resend. A 100-failure burst (misconfigured IdP, password-spraying bot) would burn the Resend quota and silence real alerts. | Cap email notifications at 5 per batch; the 5th email appends a digest line noting how many more failures were suppressed (with a pointer to D1 `admin_login_logs` for the complete set). All failures still write to D1 — only the email fan-out is throttled. |
| 🟠 High | `src/lib/auth/session.ts` (`writeRevocationFlag`) | **TTL hardcoded to 86 400 s.** Drifts whenever `SESSION_MAX_LIFETIME_MS` changes — a 12 h session would be outlived by a 24 h revocation flag. | Read `SESSION_MAX_LIFETIME_MS` via `getSessionTiming(getRawEnv())`; floor at 60 s. *Status note 2026-09-20: the fixed function has **no callers**. The only live writer of `revoked:` is `src/lib/auth/plac.ts`, which still uses a hardcoded `expirationTtl: 86400`, so the finding is open in practice — either route the writer through `writeRevocationFlag()` or delete it.* |
| 🟠 High | `public/_headers` vs `src/middleware.ts` | **CSP divergence.** `_headers` had `https://*.sentry-cdn.com` wildcard, `https://*.supabase.co` carveouts, and an older `Permissions-Policy` that the middleware version had already dropped. `_headers` was believed not to be consumed by the Workers runtime, so the divergence misled rather than weakened — but the misleading file is now byte-aligned with middleware and carries a header comment clarifying its reference-only role. *Status note 2026-09-20: that belief was wrong and is contradicted by the §0 row. Workers Static Assets does apply `_headers` — to static-asset responses only, never to SSR (settled by evidence 2026-09-02). `src/lib/security/csp.ts` remains the only file to read for the live SSR policy.* | Aligned `_headers` to middleware byte-for-byte; added the reference-only banner. |
| 🟡 Med | `audit/{login-logs,export}.ts` | **PLAC parent-deny not propagated** — both used custom `actor.accessMap['/dashboard/logs#security']` / `['#export']` lookups instead of the canonical helper, so a deny on the parent `/dashboard/logs` would not block these endpoints if a stale grant for the hash sub-page existed. | Added `placDenyResponse(actor, '/dashboard/logs')` as the first gate; the existing hash-grant logic remains as secondary. Order matters: parent deny wins. |
| 🟡 Med | `users/access.ts` | **PLAC-denied admin could still POST PLAC changes.** The route had its full 5-gate hierarchy but never checked whether the actor was allowed to reach `/dashboard/users` in the first place. | `placDenyResponse(actor, '/dashboard/users')` added before any of the existing gates. |
| 🟡 Med | `users/{active-sessions, active-revocations, cf-access-audit}.ts` | **No rate limit on privileged ops.** Session revocation, edge-block unblock, and CF Access user enumeration were unthrottled. `cf-access-audit` is the most sensitive — it enumerates every CF Access user in the account. | Added Upstash limiters: 30/min revoke, 30/min unblock, 10/min CF Access audit. Keyed by `session.userId`. |
| 🟡 Med | `src/lib/auth/session.ts:130` | **`X-Forwarded-For` used raw** as IP fallback when `CF-Connecting-IP` is missing — some proxy chains emit a comma-separated list, so the full string was being persisted to the audit trail. | Split on comma and take leftmost entry; `CF-Connecting-IP` still preferred as the most-trusted source. |
| 🟡 Low | `ModelsCatalog.tsx:274` | **`dangerouslySetInnerHTML` structurally fragile.** Currently safe (both branches interpolate only `Math.round(...)` and `.toFixed(...)` — number → digit-string), but a future refactor adding `m.name` would silently introduce XSS. | Load-bearing comment added explaining the safety invariant and the migration path to JSX `<><strong>{value}</strong></>` if any string field is ever interpolated. |
| 🧹 Hyg | `package.json` | `@astrojs/check` was in `dependencies` despite being a build-only typecheck tool. | Moved to `devDependencies`. Removes 5 transitive vulnerabilities from the production audit surface (`@astrojs/language-server` → `volar-service-yaml` → `yaml-language-server` → `yaml`). |

### Items Verified Closed (no code change needed)

- **M-8 `cms_content_history` cleanup trigger** — verified the table has zero writers in the codebase. The migration's comment promises a trigger that was never created, but nothing inserts into the table so it cannot grow. Re-evaluate when the first writer ships.
  > **Superseded 2026-08-13 — the first writer has shipped.** `recordCmsHistory()`
  > (`src/lib/cms/storage.ts`) is called on CMS block updates, so the table now
  > grows unbounded and the promised cleanup trigger still does not exist. This
  > 2026-05-26 finding was correct when written; it was subsequently re-quoted as
  > current fact in `MAINTENANCE.md` and the data-infrastructure audit, which is
  > the drift this note closes. Retention is tracked in `MAINTENANCE.md` → C-13.
- **M-4 audit-log DELETE handler** — genuinely a policy decision, not a bug. The UI's "Delete Selected" button in ActivityCenter depends on it. Left pending a product call. *Decided 2026-09-15 (append-only) and removed on 2026-10-16 with the button, when the daily seal shipped ([plac-and-audit.md](../architecture/plac-and-audit.md) §3.2).*
- **M-9 `chatbot/[...path]` default minRole** — function entry already uses `requireAuth(context, 'admin')`, which matches the `getMinRole` default. Lower priority than originally rated.

### Verification

- `tsc --noEmit --skipLibCheck` → exit 0 across the entire codebase.
- `npm audit --omit=dev` → 0 vulnerabilities (was 16).
- Per-route PLAC audit script: every previously-flagged route now contains ≥ 1 `placDenyResponse` / `requirePageAccess` call.
- `astro check` could not complete in the review sandbox due to an esbuild service deadlock (environmental, not code) — `tsc` is the verified-clean path for this review.

---

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-26 | §6a's `GET /api/users/pages` row (the `mayGive` and `mayTake` fields, 401 for a refused sign-in) against `src/pages/api/users/pages.ts` and `test/invite-pages.test.ts`; `AccessPolicyGrid.tsx` marked removed in the CSP row | The rest of the document |
| 2026-10-26 | §6a's `GET /api/analytics/{part}` row after round 2 (seven parts, `retry=1`, the email ledger read) against `src/pages/api/analytics/[part].ts`, `src/lib/analytics/report/load.ts` and `emailLogs` in `src/lib/dal/AnalyticsRepository.ts`; `test/analytics-round2.test.ts` passes; §0's PLAC row unchanged (no route file added: 171 files under `src/pages/api/`) | The rest of the document |
| 2026-10-26 | §6a's new `GET /api/analytics/{part}` row against `src/pages/api/analytics/[part].ts`, `denyAnalytics` in `src/lib/auth/surface-guards.ts`, `safeTimeZone` in `src/lib/analytics/report/range.ts` and `csv.ts`; `test/analytics.test.ts` passes (401, 404, 403 per part, Download and Refresh keys); §0's PLAC row re-counted (55 prefixes; 171 route files, 162 mapped and 9 session-less) against `API_PAGE_MAPPING` and the files under `src/pages/api/` | The rest of the document |
| 2026-10-26 | §6a's new `GET /api/dashboard/overview` row against `src/pages/api/dashboard/overview.ts` and `test/overview.test.ts` (401, staff seeing only their sections, the Owner seeing all); `GET /api/dashboard/metrics` removed with the old Overview; the `?summary=1` sentence dropped from the System health row with `healthGlance`; §0's PLAC row re-counted (54 prefixes; 170 route files, 161 mapped and 9 session-less) against `API_PAGE_MAPPING` and the files under `src/pages/api/` | The rest of the document |
| 2026-10-24 | §6a's `GET /api/audit/login-logs` row, for its filters, against `src/pages/api/audit/login-logs.ts`, `src/lib/login-log-filters.ts` and `test/sessions-section.test.ts` (`loginLogWhere`, injection text included) | Everything else, the §0 route counts included (no route added) |
| 2026-10-23 | The sign-in-without-Google row and the two route rows again, for the per-way rules and `set-way` (evening), against `src/lib/login-alerts/decide.ts`, `policy.ts`, `handlers.ts`, `policy-handlers.ts` and `test/login-alert-ways-in.test.ts` | Everything else |
| 2026-10-23 | The sign-in-without-Google row and the two sign-in alert route rows, for the alert policy's Ways in and the 30-day emailed summary, against `src/lib/login-alerts/decide.ts`, `policy.ts`, `emailed.ts`, `handlers.ts`, `policy-handlers.ts` and `test/login-alert-ways-in.test.ts` | Everything else |
| 2026-10-17 | §6a's `GET /api/system-health` row for the providers' notes, against `src/pages/api/system-health/index.ts` and `providerTrouble` in `src/lib/health/view.ts`; `test/system-health.test.ts` passes. No new route file, so §0's counts stand | The rest of the document |
| 2026-10-17 | §6a's test alert row against `src/pages/api/system-health/test-alert.ts`, `fireAlert` in `src/lib/alert-gate.ts` and `emailServiceHealth` in `src/lib/email-console.ts`; `test/system-health.test.ts` passes | The rest of the document |
| 2026-10-24 | §0's PLAC row re-counted after the logs route (54 prefixes; 169 route files, 160 mapped and 9 session-less) against `API_PAGE_MAPPING` in `src/lib/auth/routes.ts` and the files under `src/pages/api/`; §6a's new logs row and the settings row's `log-scan` change against `src/pages/api/system-health/logs.ts`, `settings.ts` and `healthLogScanSchema`/`healthSettingsSchema` in `src/lib/schemas/health.ts`; `test/log-scan.test.ts` passes | The rest of the document |
| 2026-10-24 | §6a's logs row (the Sentry list on GET) against `src/pages/api/system-health/logs.ts` and `getOrgIssues` in `src/lib/control-plane/sentry-admin.ts`; `test/log-scan.test.ts` passes | The rest of the document |
| 2026-10-17 | §0's PLAC row re-counted after the settings route (54 prefixes; 168 route files, 159 mapped and 9 session-less) against `src/lib/auth/routes.ts` and the files under `src/pages/api/`; §6a's new settings row against `src/pages/api/system-health/settings.ts`, `healthSettingsSchema` in `src/lib/schemas/health.ts` and `denyHealth` in `src/lib/auth/surface-guards.ts`; `test/system-health-settings.test.ts` passes | The rest of the document |
| 2026-10-17 | §0's PLAC row re-counted after the heavy tests route (54 prefixes; 167 route files, 158 mapped and 9 session-less) against `src/lib/auth/routes.ts` and the files under `src/pages/api/`; §6a's new heavy tests row against `src/pages/api/system-health/heavy.ts`, `healthHeavySchema` and `healthHeavyQuery` in `src/lib/schemas/health.ts` and `denyHealth` in `src/lib/auth/surface-guards.ts`; `test/system-health-heavy.test.ts` passes | The rest of the document |
| 2026-10-17 | §6a's `GET /api/system-health` row for `?summary=1`, against `src/pages/api/system-health/index.ts` and `healthGlance` in `src/lib/health/view.ts`; `test/system-health.test.ts` covers 401, 403 and the answer. No new route file, so §0's counts stand | The rest of the document |
| 2026-10-17 | §6a's System health problems row for the new PATCH, against `src/pages/api/system-health/problems.ts`, `healthAckSchema` in `src/lib/schemas/health.ts` and `denyHealth` in `src/lib/auth/surface-guards.ts`; `test/system-health-ack.test.ts` passes. No new route file, so §0's counts stand | The rest of the document |
| 2026-10-25 | §1.3's `AdminSession` (two fields) and §6a's new `confirm-code` row against `src/lib/auth/session.ts` and `src/pages/api/settings/confirm-code.ts`; `test/confirm-code.test.ts` passes. §0's PLAC counts were not re-counted (one more mapped route file under `/api/settings`) | The rest of the document |
| 2026-10-17 | §0's PLAC row re-counted after the testing pass route (54 prefixes; 166 route files, 157 mapped and 9 session-less) against `src/lib/auth/routes.ts` and the files under `src/pages/api/`; §1.3's `AdminSession` and §1.4's new row against `src/lib/auth/session.ts`, `src/lib/auth/fresh-sign-in.ts` and the three actor builders; §6a's new row against `src/pages/api/settings/testing-pass.ts`; `test/testing-pass.test.ts` passes | The rest of the document |
| 2026-10-17 | §0's PLAC row re-counted after System health replaced Diagnostics and Alerts (54 prefixes; 165 route files, 156 mapped and 9 session-less) against `src/lib/auth/routes.ts` and the files under `src/pages/api/`; §6a's five System health rows against `src/pages/api/system-health/*`, `denyHealth` and `healthCan` in `src/lib/auth/surface-guards.ts` and `src/lib/schemas/health.ts`, and `test/system-health.test.ts`; the 500-message count (still 9; none of the removed routes was among them); the closing note on `/api/diagnostics` | The rest of §6a |
| 2026-10-17 | §6a's two Page Registry rows and the `/api/access-requests` row after Page Registry became a grant-only page, against `src/lib/auth/page-floors.ts`, `surface-guards.ts` (`canUsePageRegistry`), `src/pages/api/system/pages.ts`, `src/lib/access-requests/rules.ts` (`checkAsk`) and `test/debug-access.test.ts`, `test/registry-access.test.ts`, `test/registry-console-features.test.ts`, `test/access-requests.test.ts` | Every other section |
| 2026-10-16 | §0's two API rows, re-counted (55 prefixes; 169 route files, 160 mapped and 9 session-less, none unmapped) against `src/lib/auth/routes.ts` and the files under `src/pages/api/`; the sensitive-reads row against `src/lib/audit-views.ts`, `src/lib/backup-audit.ts` and the backup gateway; §1.3's `AdminSession` against `src/lib/auth/session.ts` and `pipeline.ts` (`signedInAt`, `vpsNoticeVersion`); §5.1 and §5.2 against every caller of `markAuthzChanged` and `forceLogoutUser` (`src/lib/users/manage-apply.ts`, `src/lib/approvals/handlers.ts`, `src/pages/api/settings/user.ts`, `src/workers/scheduled-unused-accounts.ts`, `force-kick.ts`, `active-sessions.ts`) and `plac.ts`; §6's 500 count by its grep; §6a's new and corrected rows against `src/pages/api/users/[id]/login-history.ts`, `users/probes.ts`, `users/cf-access-audit.ts`, `emails/api-tokens.ts`, `emails/api-messages.ts`, `src/lib/email-api-route.ts`, `audit/delete.ts`, `audit/consent.ts`, `audit/emails.ts`, `retention/purge.ts`, `sessions/flush-sessions.ts`, `system/pages.ts` and `src/lib/schemas/admin.ts`; §6b against every `getRateLimiter(` call. Merged the duplicate Access Center rows in §6a and §6b, added the flush, preview and two Users limiters, rephrased three sentences on open items to point at MAINTENANCE, and moved this log to the end. No test run (shared checkout) | Everything else: §2 to §4, §7 to §15, the live Cloudflare and Supabase state, and the §6a rows and §6b limits not named here |
| 2026-10-16 | §6a's `/api/sessions/active-sessions` row (the block reads the person, the two-person rule, the email), against `src/pages/api/sessions/active-sessions.ts` and `src/lib/approvals/ask.ts`; `test/two-person-rule.test.ts` and `test/session-rank.test.ts` pass | Everything else |
| 2026-10-16 | §9's `CONSOLE_SIGNING_KEY` bullet against `src/lib/console-signature.ts`, `src/env.d.ts` and the three consoles' checks (`cf-backup/src/gateway/signature.ts`, `cf-vps/src/gateway/signature.ts`, `cf-email-consumer/api/src/signature.ts`) | Everything else; the secret on the Workers (the owner sets it) |
| 2026-10-16 | §6a's new `GET/POST /api/users/approvals` row, the `/api/users/manage` row's second-person sentence and §6b's `approvals` limit, against `src/pages/api/users/approvals.ts`, `src/lib/approvals/handlers.ts` (`decisionSchema`, the 4096-character body cap, `mayDecide`, `claim`), `src/pages/api/users/manage.ts`, `src/lib/approvals/ask.ts` and `src/lib/auth/routes.ts` (`/api/users` → `/dashboard/users`); `test/two-person-rule.test.ts` passes | Everything else; the §0 route count (one route added under a prefix already mapped) |
| 2026-10-16 | §6a's new `GET/POST/DELETE /api/users/access-templates` row and §6b's `access-templates` limit, against `src/pages/api/users/access-templates.ts`, `src/lib/access-center/templates.ts` (`manager`, `templateSaveSchema`, `TEMPLATE_ENTRY`), `src/lib/auth/routes.ts` (`/api/users` → `/dashboard/users`); `test/access-templates.test.ts` passes | Everything else; the §0 route count (one route added under a prefix already mapped) |
| 2026-10-16 | §0's new "Audit log integrity" row and §6a's audit rows (`GET /api/audit/seals` added, `DELETE` gone from `/api/audit/logs`, the `/api/audit/prune` row removed with its file, a `delete-targeted` row added), against `src/pages/api/audit/seals.ts`, `logs.ts`, `delete-targeted.ts` (`targetTabOf`, the fresh sign-in on `DELETE`), `src/pages/api/retention/purge.ts` (the 180-day floor), a search of `src/` for any other delete from `admin_audit_log` (none), and `test/audit-seal.test.ts` | Everything else; the first live seal run; the R2 bucket lock (not added) |
| 2026-10-16 | §6a's `GET /api/users/access-data` row, against `src/pages/api/users/access-data.ts` (the page check, the UUID check, the ghost rule, counts only) and `src/lib/access-center/counts.ts`; `test/users-console.test.ts` passes. The route left the raw-D1 burn-down list in `scripts/rules_check.py` SEC-03: it reads through `PageRegistryRepository` | Everything else; the §0 route count (no route added) |
| 2026-10-16 | §6a's new `GET/POST /api/users/access-review` row and §6b's `access-review` limit, against `src/pages/api/users/access-review.ts`, `src/lib/access-review/handlers.ts` (`reviewer`, `readSignOff`, `notReviewed`), `src/lib/auth/routes.ts` (`/api/users` → `/dashboard/users`); `test/access-review.test.ts` passes | Everything else; the §0 route count (one route added under a prefix already mapped) |
| 2026-10-16 | §0's new "Sensitive reads recorded" row, against `src/lib/audit-views.ts`, `enrich.ts`, `users/[id]/login-history.ts`, `emails/api-messages.ts` and the backup gateway; a search for an ARCO identity document reader found none (`identity_doc_*` columns are only listed). No route added or remapped | Everything else |
| 2026-10-16 | §0's new "Accounts nobody uses" row, against `src/lib/unused-accounts.ts`, `src/workers/scheduled-unused-accounts.ts` and `test/unused-accounts.test.ts`. No route added or remapped, so §6a's table is unchanged | Everything else; the check has not run live yet (not deployed when written) |
| 2026-10-16 | §0's recent sign-in row and §1.4's new timing row, against `src/lib/auth/fresh-sign-in.ts`, `src/lib/auth/stages/bootstrap.ts` (`signedInAtFromAssertion`), `src/lib/auth/pipeline.ts` (the `createdAt` fallback), `src/lib/fresh-sign-in-client.ts` and `test/fresh-sign-in.test.ts`. No route added or remapped, so §6a's table is unchanged | Everything else; whether Cloudflare Access asks for a second step at sign-in (dashboard-side) |
| 2026-10-16 | §6a's new `GET /api/users/role-preview` row, against `src/pages/api/users/role-preview.ts`, `src/lib/access-center/role-preview.ts` (`roleChangeRefusal`, the console calls through `consolePerson`), `src/lib/auth/routes.ts` (`/api/users` → `/dashboard/users`); `test/role-preview.test.ts` passes | Everything else |
| 2026-10-16 | §6a's two `/api/access-requests` rows for console permissions (#22), against `src/lib/access-requests/handlers.ts` (`askForPower`, `decidePower`), `rules.ts` (`checkPowerAsk`, `powerApproval`), `src/lib/schemas/audit.ts` and `src/lib/access-center/handlers.ts` (`checkConsoleGrant`); `test/access-console-requests.test.ts` passes | Everything else |
| 2026-10-16 | §6a's `/api/users/manage` and `GET/POST /api/access-requests` rows, against `src/pages/api/users/manage.ts`, `src/lib/access-center/page-gates.ts` (`inviteSettingRefusals`), `src/lib/access-requests/handlers.ts` and `rules.ts` (`whyClosed`, `checkAsk`); `test/access-why.test.ts` passes | Everything else |
| 2026-10-15 | §5.1's access-request trigger, §6a's two new `/api/access-requests` rows and §6b's two limits, against `src/lib/access-requests/handlers.ts`, `rules.ts`, `src/lib/auth/routes.ts` (`/api/access-requests` → `/dashboard`) and `test/access-requests.test.ts` | Everything else |
| 2026-10-15 | §6a's consent rows (`receipts`, the new `enrich` row, `consent`) and the `bookings/[id]` row, against `src/lib/consent-details.ts`, `src/lib/auth/surface-guards.ts` (`canViewConsentDetails`), those routes and `test/action-keys-enforced.test.ts` | Every other section, the §0 route counts included (no route added) |
| 2026-10-15 | §6a's two Page Registry rows (`/api/system/*`) after it became vendor support only, against `src/lib/auth/page-floors.ts`, `surface-guards.ts` (`canUsePageRegistry`), `src/lib/access-center/registry.ts`, `registry-access.ts`, `history.ts` and `test/debug-access.test.ts`, `test/registry-access.test.ts`, `test/registry-console-features.test.ts` | Every other section |
| 2026-10-15 | §6a's `force-kick` row, against `src/pages/api/users/force-kick.ts`, `src/lib/auth/surface-guards.ts` (`denyForceKick`), the live `/dashboard/users#force-kick` registry row (D1 connector: `owner`, active) and `test/session-rank.test.ts` | Every other section |
| 2026-10-14 | §5.1's page-registry trigger, §6a's rows for `force-kick`, `active-sessions`, the Access Center and the Page Registry routes (the new `access-overview`, `page-access`, `system/access-history` and `users/access-history`; `preview` removed), and §6b's `registry` and `plac` limiter rows, against those files, `src/lib/access-center/registry-access.ts`, `history.ts`, `src/lib/auth/routes.ts` (`/api/system`, `/api/users`) and `test/registry-access.test.ts`, `test/access-history.test.ts`, `test/session-rank.test.ts`, `test/api-authz-inventory.test.ts` | Every other section, the §0 route counts included (three routes added, one removed, under prefixes already mapped) |
| 2026-10-14 | §6a's `/api/emails/api-attachments` row (it replaced `api-mailroom`), against `src/pages/api/emails/api-attachments.ts`, `src/lib/email-api-route.ts`, `src/lib/auth/routes.ts`, `test/email-api-routes.test.ts` and `test/api-authz-mapping.test.ts` | Every other section, the §0 route counts included (the count is unchanged: one route renamed) |
| 2026-10-11 | §6a's new `POST /api/vps/notice` row, against `src/pages/api/vps/notice.ts`, `src/lib/vps-notice-record.ts`, `src/lib/auth/routes.ts` (`/api/vps` → `/dashboard/vps`), the gateway's notice check and `test/vps-notice.test.ts`, `test/vps-gateway.test.ts`, `test/api-authz-inventory.test.ts` | Every other section, the §0 route counts included |
| 2026-10-10 | §9's `RESEND_API_KEY` note, against `src/lib/email/queue-mail.ts`, its five callers and `grep -rn "api.resend.com" src/` (the diagnostics ping only); pinned by `test/system-mail-queue.test.ts` | The rest of §9 |
| 2026-10-10 | The rows for `GET /api/users/[id]/session-status`, `GET /api/audit/login-logs` and `/api/sessions/active-sessions`, against those files, `src/lib/auth/session-ref.ts` and `surface-guards.ts`; pinned by `test/session-ref.test.ts` and `test/sessions-console.test.ts` | The rest of the route tables |
| 2026-10-10 | §6a's rows for the Developer Tools and Page Registry routes, against `src/lib/auth/surface-guards.ts`, the three `src/pages/api/diagnostics/` routes, `src/pages/api/system/pages.ts`, `preview.ts`, `src/lib/access-center/registry.ts` and `test/debug-access.test.ts` | Every other section, the §0 route counts included |
| 2026-10-10 | §6a's new `/api/emails/api-mailroom` row, against `src/pages/api/emails/api-mailroom.ts`, `src/lib/email-api-route.ts`, `src/lib/auth/routes.ts`, `test/email-api-routes.test.ts` and `test/api-authz-mapping.test.ts` | Every other section, the §0 route counts included |
| 2026-10-10 | §6a's new `/api/emails/api-hotel-mail` row, against `src/pages/api/emails/api-hotel-mail.ts`, `src/lib/email-api-route.ts`, `src/lib/auth/routes.ts`, `test/email-api-routes.test.ts` and `test/api-authz-mapping.test.ts` | Every other section, the §0 route counts included |
| 2026-10-10 | §6a's new `/api/emails/api-export` and cancel rows and the `api-clients` webhook actions, against `src/pages/api/emails/api-export.ts`, `api-messages.ts`, `api-clients.ts`, `src/lib/email-api-route.ts`, `src/lib/auth/routes.ts`, `test/email-api-routes.test.ts` and `test/api-authz-mapping.test.ts` | Every other section, the §0 route counts included |
| 2026-10-10 | §6a's new `/api/emails/api-clients` and `/api/emails/api-usage` rows, against those files, `src/lib/email-api-route.ts`, `src/lib/auth/routes.ts`, `test/email-api-routes.test.ts` and `test/api-authz-mapping.test.ts`; the `api-tokens` row's new fields (token rules, `grace_hours`) are in the feature document | Every other section, the §0 route counts included |
| 2026-10-10 | §6a's new `/api/emails/api-templates` row, against `src/pages/api/emails/api-templates.ts`, `src/lib/email-api-route.ts`, `src/lib/auth/routes.ts`, `test/email-api-routes.test.ts` and `test/api-authz-mapping.test.ts` | Every other section, the §0 route counts included |
| 2026-10-10 | §6a's rows for `POST /api/configuration` and `POST /api/settings/user`, and the removal of the Feature Flags, page-toggle and generic settings routes, against `src/pages/api/configuration.ts`, `src/pages/api/settings/user.ts`, `src/lib/auth/routes.ts`, `test/api-configuration.test.ts` and `test/api-settings-user.test.ts` | Every other section, the §0 route counts included |
| 2026-10-10 | §4's page-swap paragraph, against `src/components/navigation/NativeNavigationState.astro`, Astro's router source in the installed package (the swap, `astro:after-swap`, then the scripts run), the build output after `npm run build` (the router script is an external file) and `test/client-navigation.test.ts` | Every other section; the live headers after the deploy |
| 2026-10-10 | The `public/_headers` row, against `wrangler.toml` (`assets` without `run_worker_first`), `public/_headers`, `dist/client/_headers` after `npm run build` (the adapter's immutable rule first) and the Cloudflare static-assets documentation (`_headers` applies to asset responses, not Worker responses) | The live response headers of a static file, which wait for the deploy; every other section |
| 2026-10-09 | §6a's new Cron Control row, against `src/pages/api/cron/jobs/[id]/check.ts`, `history.ts`, `src/lib/jobs/history.ts` (`SAFE_ID`) and `test/cron-api.test.ts` (401, 403, page key alone allowed, 404) | Every other section, the §0 route counts included |
| 2026-10-07 | §6b's opening sentence against `wrangler.toml`: the Rate Limiting binding is a new binding type (the owner-approved exception), not a store the Worker already had | Every other section |
| 2026-10-04 | §2a's raw-IP note and §6b's rate-limit mechanism, rewritten for the move off Upstash, against `src/lib/ratelimit.ts`, `src/lib/dal/RateLimitRepository.ts`, `wrangler.toml` `[[ratelimits]]`, `test/ratelimit.test.ts` and `test/ratelimit-bindings-contract.test.ts`. No route, method, limit or key changed, so the §6b table and the route table are unchanged | Everything else; how long Cloudflare's limiter keeps a counter after its period |
| 2026-10-03 | The route table's two sign-in alert rows, against `src/lib/login-alerts/handlers.ts`, `policy-handlers.ts`, `src/lib/auth/surface-guards.ts` and `test/login-alert-settings.test.ts` / `test/login-alert-policy.test.ts` (v2 step 2) | Everything else |
| 2026-10-03 | The email-alert-amplification row rewritten and the sign-in-reuse row added for sign-in alerts v2 step 1, against `src/lib/login-alerts/decide.ts`, `src/lib/login-alerts/dispatch.ts`, `src/lib/auth/security-logging.ts` and `test/login-alert-decide.test.ts` / `test/login-alerts.test.ts` | Everything else; the API route table is unchanged (no route added) |
| 2026-10-03 | The email-alert-amplification row and the §5 revocation-flag note, against `src/lib/login-alerts/throttle.ts`, `src/lib/auth/login-event.ts` and `test/login-alerts.test.ts` | Everything else; the last full pass is the 2026-09-20 row |
| 2026-09-20 | §5 rewritten against the 2026-09-16 access-revocation work (the `authz-changed` mark vs the force-kick, the real Layer-3 endpoint and payload, layer order, the fixed 24 h flag TTL, which callers pass `ctx`). §6a rewritten — the pipeline **enforces** PLAC on `/api/*` and an unmapped route denies. §9 replaced by a link to the live-derived owner. §10.3 and the §0 `anon` row corrected from a live `has_function_privilege` check. Also: §0 counts (44 prefixes / 147 routes), the `AdminSession` shape, the timing matrix, the session-less route list, raw-IP limiter keys, the CSRF stage and its production fail-closed, the header sequence and `X-XSS-Protection`, the CSP blocker size (885) and the jsDelivr host, `VALID_ROLES`, the error-message claim, the session and media PLAC keys, `safeRateLimit` coverage, analytics timeouts, §7 (no `X-Request-ID`), §8, the Access application domain, the ZT token scope, and a historical banner over §13–§15 | Live Supabase table policies and grants (only function ACLs were queried); the Cloudflare Access bypass-policy scope; the "hidden accounts return an identical 404" claim; the CF Access JWT lifetime |

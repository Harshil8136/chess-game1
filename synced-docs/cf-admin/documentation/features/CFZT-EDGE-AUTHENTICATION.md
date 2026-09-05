---
title: "Cloudflare Zero Trust Edge Authentication & Single-Sign Architecture"
status: active
audience: [operator, technical, ai]
last_verified: 2026-09-04
verified_against: [code, infra, tests]
owner: harshil
related_docs: [./CF-ACCESS-SYNC.md, ../security/SECURITY.md, ../architecture/ARCHITECTURE.md, ../architecture/PERMISSIONS-SYSTEM.md, ../MAINTENANCE.md, ../../RULESAd.md]
tags: [cloudflare-access, zero-trust, google-oauth, identity, auth, single-sign]
---

# Cloudflare Zero Trust Edge Authentication & Single-Sign Architecture

This runbook documents the architecture, edge configuration, middleware pipeline verification, and fail-safe error recovery for the single-sign authentication system on `secure.madagascarhotelags.com`.

---

## 1. System Overview & The Single-Sign Flow

The Madagascar Admin Portal operates on a **Pure Cloudflare Zero Trust (CFZT)** authentication paradigm. There is **no secondary application-level login form**, no fake client-side "Sign in with Google Workspace" button, and no client-side `localStorage` identity emulation. Cloudflare Zero Trust is the sole edge identity gate.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. CLOUDFLARE ZERO TRUST EDGE GATEWAY                                                   │
│    • Domain: secure.madagascarhotelags.com                                              │
│    • Identity Providers: Google Workspace (@madagascarhotelags.com) + Email OTP        │
│    • Access Policy: Includes Group "Admin Portal Authorized Users"                      │
│    • Edge Interception: All unauthenticated inbound requests challenged at edge         │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ User completes Google OAuth or OTP
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. CLOUDFLARE EDGE INJECTS IDENTITY ASSERTION HEADERS                                    │
│    Upon successful authentication, CFZT injects:                                        │
│      • CF-Access-Authenticated-User-Email: user's verified corporate email              │
│      • CF-Access-JWT-Assertion: RS256-signed JWT issued by Cloudflare Access JWKS       │
│      • CF-RAY: unique trace ID for request correlation                                  │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ Request forwarded to origin Worker
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. WORKER INGRESS & AUTH PIPELINE (src/middleware.ts → src/lib/auth/pipeline.ts)         │
│    • Stage 1 (classify): Assets, webhooks, /privacy, /terms, and / handled.              │
│    • Stage 2 (session-stage): Looks up KV session via __Host-admin_session.             │
│    • Stage 3b-i (assertion): Extracts headers & verifies RS256 JWT against JWKS:        │
│        - Validates issuer: https://{CF_TEAM_NAME}.cloudflareaccess.com                  │
│        - Validates audience: CF_ACCESS_AUD from wrangler.toml                           │
│        - Validates exp & iat (clock skew protection)                                    │
│    • Stage 3b-ii (bootstrap):                                                           │
│        - Bot score gate (cfBotScore >= 30)                                              │
│        - Supabase whitelist check: email must exist in admin_authorized_users with       │
│          is_active = true                                                               │
│        - Revocation gate: revoked:{userId} checked in KV                                │
│        - PLAC access map computed from D1 admin_pages                                   │
│        - createSession() stores session in KV (ADMIN_SESSION) & sets cookie             │
│        - Login event logged to D1 admin_login_logs & security alert emailed             │
│    • Stage 4/5 (access-map & decide): Page-level authorization enforced.                 │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
                   ┌─────────────────────────┴─────────────────────────┐
                   ▼                                                   ▼
┌──────────────────────────────────────────────┐     ┌───────────────────────────────────┐
│ SUCCESSFUL AUTHENTICATION                    │     │ UNAUTHORIZED / FAILED ATTEMPT     │
│ User arrives directly on /dashboard with     │     │ • Non-whitelisted or inactive     │
│ active __Host-admin_session cookie.          │     │ • Redirects to /?error=...        │
│ Zero intermediate click gates.               │     │ • Renders explicit Error Screen   │
│                                              │     │ • "Switch Account" action clears  │
│                                              │     │   CFZT edge session at /logout    │
└──────────────────────────────────────────────┘     └───────────────────────────────────┘
```

---

## 2. Decommission of the Legacy "Double Sign-In" System

### What was broken
In earlier versions, a client-side component (`QuickResumeCard.tsx`) stored profile metadata in `localStorage` (`cf_admin_last_profile`) and rendered an intermediate card asking the user to *"Sign in with Google Workspace"* or *"Continue with Google"*.

This created critical operational defects:
1. **Double Sign-In UX Friction:** Users who already completed Google authentication through Cloudflare Access arrived at `/` and were forced to click "Sign in with Google" a **second time** to navigate to `/dashboard` before their session was bootstrapped.
2. **Account Switching Trap:** Clicking "Use another account or sign in with OTP" cleared `localStorage` but **did not revoke the Cloudflare Access edge session**. When users clicked either link, both went to `/dashboard`, re-authenticated the *old* user's CFZT headers, and logged them back into the previous account.
3. **Silent Failure Loop:** When an unauthorized Google email (e.g. personal Gmail) authenticated at the edge, `bootstrap.ts` redirected to `/?error=access_denied`. The page ignored the query parameter, displayed the login card again, and gave zero feedback.

### The Remediation (v5.0 Architecture)
- **Deleted `QuickResumeCard.tsx`** and **deleted `profile-memory.ts`**.
- Replaced the landing logic in `src/pages/index.astro`:
  - If an active session exists -> redirect to `/dashboard`.
  - In production without an active session -> redirect to `/dashboard` to trip CFZT edge authentication.
  - If rejected with an error -> render a dedicated, clear Access Denied card with an active button to `/cdn-cgi/access/logout?returnTo=/`.
  - In local development (`devMode`) -> render the Dev User Picker from `admin_authorized_users` and `.dev.vars` fallback.

---

## 3. Cloudflare Zero Trust (Access) Edge Configuration

### Application Setup
1. Log in to the **Cloudflare One Dashboard** (`dash.teams.cloudflare.com`).
2. Navigate to **Access controls** > **Applications** > Select the **Admin Portal** application (`secure.madagascarhotelags.com`).
3. **Application Domain:** `secure.madagascarhotelags.com` (Path: `/*`).
4. **Session Duration:** `24 hours` (mirrors `SESSION_MAX_LIFETIME_MS = 86400000`).

### Identity Providers
Under the **Authentication** tab:
- **Google Workspace / Google OAuth:** Configured with client ID and secret restricted to authorized domains.
- **One-time PIN (OTP):** Enabled as secondary fallback for emergency owner access.

### Access Policies
- **Rule 1 (Allow):**
  - Action: `Allow`
  - Include: Access Group `"Admin Portal Authorized Users"`.
  - (The group membership is automatically synchronized from Supabase `admin_authorized_users` via `src/lib/auth/cf-access-sync.ts` every 5 minutes and on user invite/removal).
- **Rule 2 (Bypass for Public Webhooks/Shares):**
  - Action: `Bypass`
  - Paths:
    - `/api/storage/share/*` (vendor share downloads)
    - `/api/storage/request/*` (client upload requests)
    - `/api/emails/webhook` (Brevo inbound webhooks, authenticated via HMAC)
    - `/api/health` (unauthenticated liveness probe)

---

## 4. Error Handling & Account Switching

Every rejection a person can hit ends on `/` with an `?error=` code, and every
code has a card. That was not true until 2026-09-04: four codes were appended
to `/cdn-cgi/access/logout` — Cloudflare's endpoint, which does not forward an
`error` parameter to the application — so their cards could never render, and
three codes that did reach `/` had no card at all. Two of six screens worked.
See [`../MAINTENANCE.md`](../MAINTENANCE.md) C-21.

### 4.1 Every code, where it comes from, and what the visitor sees

| Code | Emitted by | Meaning |
| :--- | :--- | :--- |
| `missing_identity` | `src/lib/auth/stages/assertion.ts` | The request carried no `CF-Access-Authenticated-User-Email`, so there is nobody to sign in as |
| `missing_token` | `src/lib/auth/stages/assertion.ts` | Identity header present, `CF-Access-JWT-Assertion` absent |
| `expired_token` | `src/lib/auth/stages/assertion.ts` | The assertion failed RS256, audience, issuer or expiry verification |
| `access_denied` | `src/lib/auth/stages/bootstrap.ts` | Authenticated by Cloudflare, not in `admin_authorized_users` |
| `account_inactive` | `src/lib/auth/stages/bootstrap.ts` | In the directory, `is_active = false` |
| `role_unrecognised` | `src/lib/auth/stages/bootstrap.ts` | On the list, but the stored role does not translate — a configuration fault, not the user's problem |
| `access_revoked` | `src/lib/auth/stages/bootstrap.ts`, `src/lib/auth/stages/refresh-role.ts` | A KV revocation flag is set, or the 30-minute re-check found the account inactive |
| `session_revoked` | `src/lib/auth/stages/session-stage.ts` | A force-kick flag ended this session |
| `recheck_failed` | `src/lib/auth/stages/refresh-role.ts` | The identity store was unreachable at the re-check, so the session closed rather than assume |
| `system_error` | `src/lib/auth/stages/access-map.ts` | The PLAC map could not be computed and there was no cached copy |
| `session_expired` | `src/components/auth/SessionWatchdog.tsx` | The 24-hour lifetime elapsed in an open tab |

`test/error-code-contract.test.ts` compares the emitted set against the cards
in `ERROR_DESCRIPTIONS` in both directions and fails on a code with no card, a
card with no code, or any redirect that puts a code on the Cloudflare logout
endpoint. That comparison is what nobody was doing when these drifted apart.

### 4.2 The same rejections on `/api/*`

A rejection forks on the caller: a page gets the redirect above, an API client
gets JSON. Two branches did not fork until 2026-09-04 (C-20) — a missing
identity header redirected an API client to the HTML landing page, and an
untranslatable role handed a browser a raw JSON body.

| Trigger | `/api/*` | Page |
| :--- | :--- | :--- |
| No identity header | `401 {"error":"Missing identity"}` | `/?error=missing_identity` |
| No assertion | `401 {"error":"Missing auth token"}` | `/?error=missing_token` |
| Assertion fails verification | `401 {"error":"Invalid or expired auth token"}` | `/?error=expired_token` |
| Not whitelisted **or** inactive | `403 {"error":"Access denied"}` | `/?error=access_denied` or `/?error=account_inactive` |
| Role does not translate | `403 {"error":"Account role not recognised"}` | `/?error=role_unrecognised` |
| Revocation flag set | `403 {"error":"Access revoked"}` + `Clear-Site-Data` | `/?error=access_revoked` |
| Session revoked | `403 {"error":"Session revoked"}` + `Clear-Site-Data` | `/?error=session_revoked` |
| Bot score below threshold | `403 {"error":"Automated traffic blocked"}` | same 403 |
| Assertion email ≠ header email | `403 {"error":"Identity verification failed"}` | same 403 |

The API answer for "not whitelisted" and "inactive" is deliberately the same
flat 403: it must not tell an unauthenticated caller whether an address is in
the directory. Only the page, which the person reached through Cloudflare
Access with a verified identity, is told which of the two it was.

### 4.3 Why the codes are not carried through the logout endpoint

The obvious repair would have been
`/cdn-cgi/access/logout?returnTo=%2F%3Ferror%3Dexpired_token`. It was rejected:
Cloudflare's [session-management documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
describes the two logout URLs and the cookie they clear, and documents no
`returnTo` parameter on them. Building the error path on an undocumented
default is how the original defect happened. The redirect therefore goes to a
page this Worker serves, and the Cloudflare logout stays where a person can
choose it — behind the card's **Sign In with Another Account** button.

Clearing the Cloudflare session was never the enforcement. The KV revocation
flag blocks a fresh bootstrap in `src/lib/auth/stages/bootstrap.ts`, the app
session is destroyed on the spot, and the Layer 3 Cloudflare session revoke
happens at revocation time in `src/lib/auth/plac.ts`. The logout hop was
convenience, and it cost the user the explanation.

### Why `/cdn-cgi/access/logout` is Required
Cloudflare Access sets a domain-scoped cookie (`CF_Authorization`). Simply deleting local cookies or localStorage does not invalidate this cookie. Directing the user to `/cdn-cgi/access/logout`:
1. Destroys the `CF_Authorization` cookie in the user's browser.
2. Invalidates the edge session in Cloudflare's distributed edge cache.
3. Redirects the browser back to `returnTo` (`/`), where the user can choose a different Google account or log in via OTP.

---

## 5. Local Development Isolation

In local development (`localhost` or `127.0.0.1`):
- Cloudflare Access headers are not present.
- `isLocalDev(env.SITE_URL)` evaluates to `true`.
- The worker bypasses CFZT verification in `stages/assertion.ts`.
- `src/pages/index.astro` mounts the **Local Dev Gateway**:
  - Displays all active users queried from Supabase `admin_authorized_users` with color-coded RBAC badges (`ROLE_META`).
  - Clicking any user issues a `POST /api/auth/dev-login` request with `email`.
  - If database connection fails, a fallback form permits signing in via `LOCAL_DEV_ADMIN_EMAIL` configured in `.dev.vars`.
  - The dev login endpoint is strictly guarded by `import.meta.env.PROD` and `isLocalDev()`—it returns HTTP 404 in production builds.

---

## 6. Source File Inventory

| Component | File Path | Primary Responsibility |
| :--- | :--- | :--- |
| **Pipeline Orchestrator** | `src/lib/auth/pipeline.ts` | Multi-stage auth flow (classify → session → bootstrap → decide). |
| **Assertion Stage** | `src/lib/auth/stages/assertion.ts` | Header extraction and RS256 JWT signature/claims validation. |
| **Bootstrap Stage** | `src/lib/auth/stages/bootstrap.ts` | Whitelist verification, role normalization, PLAC map, session creation. |
| **JWT Verifier** | `src/lib/auth/cloudflare-access.ts` | Web Crypto RS256 validation against CF JWKS certs endpoint. |
| **Session Manager** | `src/lib/auth/session.ts` | Cloudflare KV storage (`ADMIN_SESSION`), 24h hard expiry, `__Host-admin_session`. |
| **Auth Gateway** | `src/pages/index.astro` | Single-sign redirect to `/dashboard`, explicit error gate, and dev picker. |
| **Logout Endpoint** | `src/pages/api/auth/logout.ts` | KV session destruction and 302 redirect to `/cdn-cgi/access/logout`. |
| **Dev Login Route** | `src/pages/api/auth/dev-login.ts` | Dev-only session establishment (compiled out of production). |

---

## 7. Verified ingress facts

The whole design rests on one claim: **the Access-protected custom domain is the
only way in.** Re-derived 2026-09-04 rather than assumed.

| Fact | Value | How it was checked |
| :--- | :--- | :--- |
| Routes | one `[[routes]]` entry, `secure.madagascarhotelags.com`, `custom_domain = true` | `wrangler.toml` |
| `workers.dev` subdomain | `workers_dev = false` | `wrangler.toml`, with the reasoning in a comment above it |
| Version preview URLs | disabled, declared | Cloudflare docs: `preview_urls` defaults to the `workers_dev` value on Wrangler v4.44.0+, and Cloudflare ran a one-time disable for Workers with `workers.dev` off. This repo pins `wrangler ^4.128.0` |
| API default-deny | `API_DENY_MODE = "enforce"` | `wrangler.toml`; only the literal `shadow` relaxes it (`resolveDenyMode`) |

`preview_urls = false` is now declared beside `workers_dev`, so row 3 no longer
depends on what a future Wrangler defaults to — that default has changed twice
([`../MAINTENANCE.md`](../MAINTENANCE.md) C-26, closed 2026-09-04).

### The Access bypass paths are operator-configured, not code-verifiable

§3's "Rule 2 (Bypass)" list is Cloudflare dashboard state. Nothing in this repo
can read it, and no connector available here exposes Access policies, so it is
**operator-verified only**. What the code does assume is that the four bypassed
paths never need identity: they are the entries in `PUBLIC_API_ROUTES` /
`PUBLIC_API_PREFIXES` / `WEBHOOK_ROUTES` in `src/lib/auth/routes.ts`, and each
carries its own token or HMAC check. If the dashboard list and that file ever
disagree, the dashboard is what actually runs.

---

## 8. Review history

The 2026-09-04 end-to-end review of this system opened eight items and closed
all eight in the same pass. Full detail, including what was wrong in each case,
is in [`../MAINTENANCE.md`](../MAINTENANCE.md); the short version:

| Item | What changed |
| :--- | :--- |
| C-20 | Two rejection branches now fork by caller, so an API client is never handed HTML and a browser is never handed raw JSON (§4.2) |
| C-21 | Every `?error=` code now lands on a page that can render it, and every code has a card (§4) |
| C-22 | `returnTo` is reduced to a same-origin path by `safeInternalPath()`, closing an open redirect on the landing page |
| C-23 | The no-identity branch names itself, so `/` and `/dashboard` can no longer redirect to each other |
| C-24 | The landing rules moved to `src/lib/auth/landing.ts` and are covered by `test/landing.test.ts` |
| C-25 | The `/api/auth/` blanket exemption is gone; the two endpoints are named, and the GET logout refuses a cross-site trigger |
| C-26 | `preview_urls = false` declared (§7) |
| C-27 | Dev mode is decided by `SITE_URL` alone again, and the three copies of `isLocalDev` are one |

A ninth item, **C-28**, was opened and closed on 2026-09-05: `resolveLoginMethod`
recorded any unrecognised identity provider as a **Google** sign-in, and
`loginMethodLabel` rendered any unrecognised value — `null` included — as **OTP**.
Two fabricated answers to "how did this person authenticate", on the records the
login forensics screen and the sign-in alert email are built from. Both now say
unknown. The raw claim is unaffected: it is stored and shown as
`cf_identity_provider`.

Reviewed and left unchanged: the RS256 verifier in
`src/lib/auth/cloudflare-access.ts` — `alg` pinned, `kid` required, the JWKS
re-fetched once on rotation, and `exp`, `iat` skew, `iss` and `aud` all checked.

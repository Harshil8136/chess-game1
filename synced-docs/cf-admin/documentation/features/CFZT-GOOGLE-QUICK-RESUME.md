---
title: "Cloudflare Zero Trust Edge Authentication & Single-Sign Architecture"
status: active
audience: [operator, technical, ai]
last_verified: 2026-09-04
verified_against: [code, infra, tests]
owner: harshil
related_docs: [./CF-ACCESS-SYNC.md, ../security/SECURITY.md, ../architecture/ARCHITECTURE.md, ../../RULESAd.md]
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

When a user's authentication fails or needs to be changed, the system provides deterministic resolution paths:

| Error Code | Cause | User Guidance Displayed | Action Provided |
| :--- | :--- | :--- | :--- |
| `access_denied` | Email authenticated by CFZT is not in `admin_authorized_users`. | Explains that the Google account is not on the admin whitelist. | [Sign In with Another Account] → `/cdn-cgi/access/logout?returnTo=/` |
| `account_inactive` | Email exists in directory but `is_active = false`. | Explains that the account is deactivated. | Contact administrator. |
| `expired_token` | RS256 assertion `exp` timestamp is in the past. | Prompts user to refresh Zero Trust session. | [Sign In with Another Account] |
| `missing_token` | Request arrived without `CF-Access-JWT-Assertion`. | Advises connecting through the Zero Trust edge. | [Retry Verification] → `/dashboard` |
| `session_expired` | 24-hour application hard expiry reached. | Informs user that the security window closed. | [Sign In with Another Account] |
| `session_revoked` | Active session was force-kicked or user revoked. | Explains that access was revoked. | [Sign In with Another Account] |

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

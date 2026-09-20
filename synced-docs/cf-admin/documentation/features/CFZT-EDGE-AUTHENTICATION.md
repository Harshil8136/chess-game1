---
title: "Cloudflare Zero Trust Edge Authentication & Single-Sign Architecture"
status: active
audience: [operator, technical, ai]
last_verified: 2026-09-19
verified_against: [code, infra, tests]
owner: harshil
related_docs: [./CF-ACCESS-SYNC.md, ../runbooks/public-share-links-domain-isolation.md, ../runbooks/release-and-rollback.md, ../security/SECURITY.md, ../architecture/ARCHITECTURE.md, ../architecture/PERMISSIONS-SYSTEM.md, ../MAINTENANCE.md, ../../RULESAd.md]
tags: [cloudflare-access, zero-trust, google-oauth, identity, auth, single-sign]
---

# Cloudflare Zero Trust Edge Authentication & Single-Sign Architecture

This runbook documents the architecture, edge configuration, middleware pipeline verification, and fail-safe error recovery for the single-sign authentication system on `secure.madagascarhotelags.com`.

> **Where each fact lives.** The permission model — roles, PLAC resolution and
> what every rejection returns — is owned by
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).
> The Access **bypass** inventory is owned by
> [`../runbooks/public-share-links-domain-isolation.md`](../runbooks/public-share-links-domain-isolation.md),
> which is the only live-verified record of it. The Access **Group** membership
> sync is owned by [`CF-ACCESS-SYNC.md`](CF-ACCESS-SYNC.md). This document is
> authoritative for the sign-in flow and the `?error=` code contract, and
> §3–§4 were rebuilt from those sources and from code on 2026-09-19.

---

## 1. System Overview & The Single-Sign Flow

The Madagascar Admin Portal operates on a **Pure Cloudflare Zero Trust (CFZT)** authentication paradigm. There is **no secondary application-level login form**, no fake client-side "Sign in with Google Workspace" button, and no client-side `localStorage` identity emulation. Cloudflare Zero Trust is the sole edge identity gate.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. CLOUDFLARE ZERO TRUST EDGE GATEWAY                                                   │
│    • Domain: secure.madagascarhotelags.com                                              │
│    • Identity Providers: Google Workspace (@madagascarhotelags.com) + Email OTP        │
│    • Access Policy: expected Include = Group "Admin Portal Authorized Users"            │
│      (dashboard-only state — operator-verified, still pending; see §3)                   │
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
│    • Stage 1 (classify): Assets, webhooks, /privacy, /terms, and / handled;              │
│        then the CSRF gate (validateCsrf, every non-GET method).                          │
│    • Stage 2 (session-stage): Looks up KV session via __Host-admin_session,              │
│        refuses a revoked session, reads the authz-changed mark.                          │
│    • Stage 3a (refresh-role): warm sessions only — re-verify against the                 │
│        directory every 30 min, or at once when the authz-changed mark is new.            │
│        Writes no sign-in block (see §4.1).                                               │
│    • Stage 3b-i (assertion): Extracts headers & verifies RS256 JWT against JWKS:        │
│        - Validates issuer: https://{CF_TEAM_NAME}.cloudflareaccess.com                  │
│        - Validates audience: CF_ACCESS_AUD from wrangler.toml                           │
│        - Validates exp & iat (clock skew protection)                                    │
│    • Stage 3b-ii (bootstrap):                                                           │
│        - Bot score gate (cfBotScore >= 30)                                              │
│        - Assertion email must equal the CF-Access header email                          │
│        - Supabase whitelist check: email must exist in admin_authorized_users with       │
│          is_active = true. A lookup error other than PGRST116 is an outage, not          │
│          an answer: directory_unavailable (503 on /api/*), never "not authorized"       │
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
│                                              │     │ • Two buttons: team-domain CFZT   │
│                                              │     │   logout, and "Check Access       │
│                                              │     │   Again" (retries /dashboard)     │
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
  - If rejected with an error -> render a dedicated, clear Access Denied card carrying two actions: **Sign In with Another Account**, which links to the **team-domain** logout `https://{CF_TEAM_NAME}.cloudflareaccess.com/cdn-cgi/access/logout` (no `returnTo` — see §4.3), and **Check Access Again**, which retries `/dashboard`. *Corrected 2026-09-19 — this said `/cdn-cgi/access/logout?returnTo=/`, which contradicted §4.3 and the code.*
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

### Access applications and policies

*Rebuilt 2026-09-19 from
[`../runbooks/public-share-links-domain-isolation.md`](../runbooks/public-share-links-domain-isolation.md)
(live-verified 2026-08-15) and `src/lib/auth/routes.ts`. The previous version
described a single application with a four-path "Rule 2 (Bypass)" that does not
exist: it listed `/api/health` as bypassed when it deliberately is not, and
omitted `/api/emails/unsubscribe`, which is. An operator restoring config from
that list would have exposed the health probe and broken RFC 8058 one-click
unsubscribe — a CAN-SPAM obligation and a Gmail/Yahoo bulk-sender requirement.*

There are **two** Access applications on `secure.madagascarhotelags.com`:

**1. Admin Portal** — domain `secure.madagascarhotelags.com`, path `/*`.

- Policy: `Allow`, Include: Access Group `"Admin Portal Authorized Users"`.
- The group's membership is synchronized from Supabase `admin_authorized_users`
  by `src/lib/auth/cf-access-sync.ts`. It is pushed inline on invite/removal and
  reconciled by a 5-minute cron **behind a hash-or-age gate** — see
  [`CF-ACCESS-SYNC.md`](CF-ACCESS-SYNC.md) for the actual recovery windows and
  for the cron-control pause. *Corrected 2026-09-19 — this said "every 5 minutes
  and on user invite/removal", which has not been true since 2026-09-12.*
- **Whether the Policy actually references that Group is dashboard-only state
  and remains operator-verified/pending** (open since 2026-07-24, tracked in
  [`CF-ACCESS-SYNC.md`](CF-ACCESS-SYNC.md) "Known limitation"). Do not restate
  it as configured fact here.

**2. Public Vendor Share Links** — a separate application carrying `Bypass` +
Include `Everyone`, scoped to exactly three public hostnames:

| Public hostname | Why it must reach the Worker anonymously | Verified |
|---|---|---|
| `secure.madagascarhotelags.com/api/storage/share/*` | Vendor share-link downloads; authorization is the HMAC token plus a D1 row | 2026-08-15, live probe → 404 from the Worker |
| `secure.madagascarhotelags.com/api/storage/request/*` | Client file-request uploads, including the nested `/{token}/presign` and `/{token}/confirm` | 2026-08-15, live probe → 404 from the Worker |
| `secure.madagascarhotelags.com/api/emails/unsubscribe` | RFC 8058 one-click unsubscribe: a mailbox provider calls it with no session, no cookie and no CSRF token | 2026-08-15, live probe → 200 |

Constraints that matter if these are ever edited:

- The unsubscribe entry is an **exact path with no wildcard**. `/*` or
  `api/emails/*` would drop the edge layer in front of the whole Email Portal
  API.
- A single `*` spans `/` separators in Cloudflare's app-path syntax, which is
  why `/api/storage/request/*` covers the nested endpoints. At most one
  wildcard between any two slashes.
- The scope is deliberately **not** `/api/storage/*`, so `/api/storage/admin/*`
  keeps its edge layer.

**Not bypassed, on purpose:**

- **`/api/health`** — live it returns `302` to the Access login. It is in the
  code's `PUBLIC_API_ROUTES` as a liveness probe, but the edge keeps it behind
  Access (decision 2026-08-15: no external uptime monitor points at cf-admin,
  so nothing breaks). Release smoke checks reach it with an Access service
  token instead — see
  [`../runbooks/release-and-rollback.md`](../runbooks/release-and-rollback.md).
  Revisit only if external monitoring is added.
- **`/api/emails/webhook`** — the Brevo inbound webhook. It is a `WEBHOOK_ROUTES`
  entry in code, dispatched before session bootstrap and authenticated by a
  **shared secret** compared in constant time (header, `Bearer`, or `?secret=` —
  `src/pages/api/emails/webhook.ts`), not by an HMAC signature. *Corrected
  2026-09-19.* Whether it also has an edge bypass has not been verified live.

---

## 4. Error Handling & Account Switching

Almost every rejection a person can hit ends on `/` with an `?error=` code, and
every code has a card. That was not true until 2026-09-04: four codes were
appended to `/cdn-cgi/access/logout` — Cloudflare's endpoint, which does not
forward an `error` parameter to the application — so their cards could never
render, and three codes that did reach `/` had no card at all. Two of six
screens worked. See [`../MAINTENANCE.md`](../MAINTENANCE.md) C-21.

**Two refusals are the exception** and never produce a code: a bot score below
the threshold and an assertion-email/header-email mismatch both return a flat
`403` to page and API callers alike (§4.2). They are refusals of the request,
not explanations owed to a person. *Corrected 2026-09-19 — this paragraph said
"every rejection", which its own §4.2 contradicted.*

### 4.1 Every code, where it comes from, and what the visitor sees

*Regenerated 2026-09-19 from `grep -rn "error=" src` and
`test/error-code-contract.test.ts`.*

| Code | Emitted by | Meaning |
| :--- | :--- | :--- |
| `missing_identity` | `stages/assertion.ts` | The request carried no `CF-Access-Authenticated-User-Email`, so there is nobody to sign in as |
| `missing_token` | `stages/assertion.ts` | Identity header present, `CF-Access-JWT-Assertion` absent |
| `expired_token` | `stages/assertion.ts` | The assertion failed RS256, audience, issuer or expiry verification |
| `directory_unavailable` | `stages/bootstrap.ts` | Cloudflare verified the identity, but the Supabase lookup returned an error other than `PGRST116`. The directory could not be *asked*, which says nothing about this address — so it must not render "not authorized". Added in `c4a1f3e`, 2026-09-16 |
| `access_denied` | `stages/bootstrap.ts`, `stages/refresh-role.ts` | Authenticated by Cloudflare, not in `admin_authorized_users` — at sign-in, or the row vanished during a warm session |
| `account_inactive` | `stages/bootstrap.ts`, `stages/refresh-role.ts` | In the directory, `is_active = false` — at sign-in, or set during a warm session |
| `role_unrecognised` | `stages/bootstrap.ts`, `stages/refresh-role.ts` | On the list, but the stored role does not translate — a configuration fault, not the user's problem |
| `access_revoked` | `stages/bootstrap.ts` **only** | A `revoked:{userId}` block is set in KV and this is a fresh sign-in |
| `session_revoked` | `stages/session-stage.ts` | A revocation flag (`revoked-session:{sessionId}` or `revoked:{userId}`) ended this warm session |
| `recheck_failed` | `stages/refresh-role.ts` | The directory was unreachable past the grace window, or D1 failed while recomputing the map, so the session closed rather than assume |
| `system_error` | `stages/access-map.ts` | The PLAC map could not be computed and there was no cached copy |
| `session_expired` | `src/components/auth/SessionWatchdog.tsx` | The 24-hour lifetime elapsed in an open tab |

Stage files are under `src/lib/auth/stages/`.

> **`access_revoked` no longer comes from the re-check.** *Corrected 2026-09-19
> — this table said it was emitted by `refresh-role.ts` too, "or the 30-minute
> re-check found the account inactive".* Since `6571216` (2026-09-16, access
> revocation remediation Stage 1) the re-check writes **no sign-in block at
> all**: a deactivated or deleted user ends the session with `account_inactive`
> or `access_denied` and is refused by the directory row at the next sign-in.
> `access_revoked` is now exclusively the `revoked:{userId}` path.
>
> **Recovering from it.** `revoked:{userId}` is a 24-hour KV block written by
> the three-layer force-kick, and `forceLogoutUser` also writes it on ordinary
> permission changes — which is how an owner can lock themselves out. An
> operator lists and clears live blocks from the Sessions page
> (`GET /api/sessions/active-revocations`, owner+); see
> [`SESSION-MANAGEMENT.md`](SESSION-MANAGEMENT.md).

`test/error-code-contract.test.ts` compares the emitted set against the cards
in `ERROR_DESCRIPTIONS` in both directions and fails on a code with no card, a
card with no code, or any redirect that puts a code on the Cloudflare logout
endpoint. That comparison is what nobody was doing when these drifted apart. A
**fourth** check was added with `c4a1f3e`: the landing page must never
`fetch('/cdn-cgi/access/logout')`, so no `/?error=…` link can sign a visitor
out of Cloudflare Access without a click (design D9). The automatic fetch that
used to do exactly that is gone. *Added 2026-09-19.*

### 4.2 The same rejections on `/api/*`

A rejection forks on the caller: a page gets the redirect above, an API client
gets JSON. Two branches did not fork until 2026-09-04 (C-20) — a missing
identity header redirected an API client to the HTML landing page, and an
untranslatable role handed a browser a raw JSON body.

*Regenerated 2026-09-19. The re-check (stage 3a) rows and the
`directory_unavailable` row were missing.*

| Trigger | Stage | `/api/*` | Page |
| :--- | :--- | :--- | :--- |
| No identity header | assertion | `401 {"error":"Missing identity"}` | `/?error=missing_identity` |
| No assertion | assertion | `401 {"error":"Missing auth token"}` | `/?error=missing_token` |
| Assertion fails verification | assertion | `401 {"error":"Invalid or expired auth token"}` | `/?error=expired_token` |
| Directory lookup errored at sign-in | bootstrap | `503 {"error":"Directory unavailable"}` | `/?error=directory_unavailable` |
| Not whitelisted **or** inactive, at sign-in | bootstrap | `403 {"error":"Access denied"}` | `/?error=access_denied` or `/?error=account_inactive` |
| Role does not translate, at sign-in | bootstrap | `403 {"error":"Account role not recognised"}` | `/?error=role_unrecognised` |
| `revoked:{userId}` present at sign-in | bootstrap | `403 {"error":"Access revoked"}` + `Clear-Site-Data` | `/?error=access_revoked` |
| Session carries a revocation flag | session-stage | `403 {"error":"Session revoked"}` + `Clear-Site-Data` | `/?error=session_revoked` |
| Identity row gone during a warm session | refresh-role | `403 {"error":"Access denied"}` + `Clear-Site-Data` | `/?error=access_denied` |
| Account deactivated during a warm session | refresh-role | `403 {"error":"Account inactive"}` + `Clear-Site-Data` | `/?error=account_inactive` |
| Role stopped translating during a warm session | refresh-role | `403 {"error":"Account role not recognised"}` + `Clear-Site-Data` | `/?error=role_unrecognised` |
| Re-check could not reach the directory past the grace window, or D1 failed recomputing the map | refresh-role | `503 {"error":"Verification unavailable"}` + `Clear-Site-Data` | `/?error=recheck_failed` |
| PLAC map unavailable and no cached copy | access-map | `403 Access policy unavailable for this session` | `/?error=system_error` |
| Bot score below threshold | bootstrap | `403 {"error":"Automated traffic blocked"}` | same 403 |
| Assertion email ≠ header email | bootstrap | `403 {"error":"Identity verification failed"}` | same 403 |

The warm-session refusals carry `Clear-Site-Data` and destroy the app session,
but — since `6571216` — write no sign-in block. See
[`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md)
§8 for the same table with the audit outcome of each row.

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

### Why the Cloudflare logout endpoint is still offered
Cloudflare Access sets a domain-scoped cookie (`CF_Authorization`). Deleting local cookies or `localStorage` does not invalidate it. The card's **Sign In with Another Account** button therefore links to the **team-domain** endpoint, `https://{CF_TEAM_NAME}.cloudflareaccess.com/cdn-cgi/access/logout` (`src/pages/index.astro`), which:

1. Destroys the `CF_Authorization` cookie in the user's browser.
2. Invalidates the edge session in Cloudflare's distributed edge cache.
3. Lands the user on Cloudflare's own logout confirmation, from where they can authenticate as a different Google account or via OTP.

*Corrected 2026-09-19 — point 3 previously said the endpoint "redirects the browser back to `returnTo` (`/`)". No `returnTo` is sent, deliberately: §4.3 explains why building on that undocumented parameter was rejected. The app falls back to the relative `/cdn-cgi/access/logout` only when `CF_TEAM_NAME` is unset.*

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
| **Logout Endpoint** | `src/pages/api/auth/logout.ts` | KV session destruction. `POST` returns JSON `{redirect}` to the app-domain logout; `GET` 302s and refuses a cross-site `Sec-Fetch-Site` (MAINTENANCE C-25). *Corrected 2026-09-19 — this said "302 redirect" for both.* |
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

§3's application list is Cloudflare dashboard state. Nothing in this repo can
read it, and no connector available here exposes Access policies, so it is
**operator-verified only** — last probed live on 2026-08-15
([runbook](../runbooks/public-share-links-domain-isolation.md)). If the
dashboard and the repo disagree, the dashboard is what actually runs.

The code's own allowlists are **not** the same set, and reading one as the
other is the mistake this section used to invite. *Corrected 2026-09-19 — it
claimed "the four bypassed paths… are the entries in `PUBLIC_API_ROUTES` /
`PUBLIC_API_PREFIXES` / `WEBHOOK_ROUTES`". There are seven entries, not four,
and the two sets differ in both directions.*

| `src/lib/auth/routes.ts` | Entries | Bypassed at the edge? |
|---|---|---|
| `PUBLIC_API_ROUTES` | `/api/health` | **No** — deliberately behind Access (§3) |
| | `/api/emails/unsubscribe` | Yes — exact path, third public hostname |
| | `/api/auth/logout` | No — must work when the session is gone, but stays behind Access |
| | `/api/auth/dev-login` | No — local dev only, 404 in a production build |
| `PUBLIC_API_PREFIXES` | `/api/storage/share/`, `/api/storage/request/` | Yes — the two wildcard hostnames |
| `WEBHOOK_ROUTES` | `/api/emails/webhook` | Unverified live |

These lists govern **PLAC and CSRF exemption inside the Worker**, not edge
reachability. A path can be on them and still hit the Access wall
(`/api/health`); the reverse — bypassed at the edge but not exempt in code —
would produce a 403 from the Worker rather than a security hole. Each entry
carries its own token, secret or dev guard; see the runbook's §2 for the
share-link authorization chain.

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

### 2026-09-19 re-verification

The pipeline changed on 2026-09-16 (`6571216`, `c4a1f3e`, `46b8f4d`,
`84c38db`) and this document had not been re-derived since 2026-09-04, while
still being cited as the authoritative code list. Re-derived against HEAD:

| Checked | Not checked |
|---|---|
| `src/lib/auth/routes.ts` (all seven allowlist entries); `grep -rn "error=" src` against `ERROR_DESCRIPTIONS` in `src/pages/index.astro`; `stages/assertion.ts`, `bootstrap.ts`, `refresh-role.ts`, `session-stage.ts`, `access-map.ts` for every emitter and API status; `test/error-code-contract.test.ts` (four checks); the card's logout href and the "Check Access Again" action; `src/pages/api/emails/webhook.ts` (shared secret, constant-time); `src/pages/api/sessions/active-revocations.ts`; the edge bypass inventory against the live-verified runbook | IdP configuration (Google restricted to the company domain; OTP); the Access app session duration of 24 h; the Cloudflare One dashboard URL; whether the Policy includes the Group (§3, still pending); whether `/api/emails/webhook` has an edge bypass |

Four claims were corrected: the Access bypass list (§3, §7), the `?error=`
tables (§4.1, §4.2), the logout target and its `returnTo` (§2, §4.3 preamble),
and the group-sync cadence (§3, now a link to `CF-ACCESS-SYNC.md`).

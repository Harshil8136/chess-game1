---
title: "Cloudflare Zero Trust Quick-Resume with Google OAuth"
status: active
audience: [operator, technical, ai]
last_verified: 2026-08-31
verified_against: [code, infra, tests]
owner: harshil
related_docs: [./CF-ACCESS-SYNC.md, ../security/SECURITY.md, ../architecture/ARCHITECTURE.md, ../../RULESAd.md]
tags: [cloudflare-access, zero-trust, google-oauth, quick-resume, identity, auth]
---

# Cloudflare Zero Trust Quick-Resume with Google OAuth

This runbook documents the architecture, client-side identity memory, and Cloudflare Zero Trust configuration for the **"Continue with {User Last Used Email}"** single-click sign-in feature.

---

## 1. System Overview & The 3 Pillars

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ PILLAR 1: CLIENT IDENTITY MEMORY (localStorage: cf_admin_last_profile)                 │
│ Upon successful authenticated session, browser stores:                                  │
│   { email, displayName, role, loginMethod, avatarInitials, lastActiveAt }               │
│ (Zero tokens or secrets stored — display metadata only)                                 │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ PILLAR 2: "MIDNIGHT SLATE" QUICK-RESUME GATEWAY (src/components/admin/auth/)             │
│ On `/` or session expiry, renders personalized profile card:                           │
│   • Avatar badge & Display Name ("Welcome back, Harshil")                               │
│   • Identity: "[DEVELOPER_EMAIL] • Owner"                                  │
│   • Primary Action: [ ⚡ Continue with Google (as harshil@...)           ➜ ]            │
│   • Secondary Action: [ 🔑 Switch Account / Sign in with OTP ]                          │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ (Click triggers /dashboard navigation)
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ PILLAR 3: CLOUDFLARE ZERO TRUST INSTANT AUTHENTICATION                                  │
│ Cloudflare Access edge auto-redirects to Google OAuth -> Google presents "Continue as"   │
│ -> Completes OAuth -> Cloudflare edge injects CF-Access-JWT-Assertion -> Session created │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cloudflare Zero Trust (Access) Edge Configuration

To enable zero-click / single-click redirection to Google OAuth from Cloudflare Access:

1. Log in to the **Cloudflare One Dashboard** (`dash.teams.cloudflare.com`).
2. Navigate to **Access controls** > **Applications** > Select the **Admin Portal** application (`secure.madagascarhotelags.com`).
3. Under the **Authentication** tab:
   - Ensure **Google** is selected in **Identity providers**.
   - Enable **"Apply instant authentication"** (`auto_redirect_to_identity: true`).
4. (Optional via Cloudflare API):
   ```bash
   curl "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps/${APP_ID}" \
     -X PUT \
     -H "Authorization: Bearer ${CF_API_TOKEN_ZT_WRITE}" \
     -H "Content-Type: application/json" \
     -d '{
       "auto_redirect_to_identity": true,
       "allowed_idps": ["<GOOGLE_IDP_UUID>"]
     }'
   ```

---

## 3. Client-Side Identity Memory Specifications

* **Storage Location:** `window.localStorage.getItem('cf_admin_last_profile')`
* **Schema Definition (`StoredProfile` in `src/lib/auth/profile-memory.ts`):**
  ```typescript
  export interface StoredProfile {
    email: string;
    displayName: string;
    role: string;
    loginMethod: 'google' | 'github' | 'otp' | string;
    avatarInitials: string;
    lastActiveAt: number;
  }
  ```
* **Security & Invariants:**
  * **No Secrets:** Session IDs, CSRF tokens, and JWT assertions are NEVER written to `localStorage`.
  * **Auto-Expiration:** Profiles older than 30 days (`PROFILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000`) are purged automatically.
  * **Reset Capability:** Clicking *"Use another account or sign in with OTP"* immediately invokes `[SUPABASE_PROJECT_REF]()`.

---

## 4. Source File Inventory

| Component | File Path | Responsibility |
| :--- | :--- | :--- |
| **Profile Memory** | `src/lib/auth/profile-memory.ts` | Storage, validation, and expiry management. |
| **QuickResume Card** | `src/components/admin/auth/QuickResumeCard.tsx` | Preact island displaying the quick-resume UI. |
| **Landing Page** | `src/pages/index.astro` | Host page mounting the interactive gateway card. |
| **Session Sync** | `src/layouts/AdminLayout.astro` | Nonced script syncing active profile on page render. |
| **Test Suite** | `test/profile-memory.test.ts` | Vitest unit test suite covering profile serialization & expiry. |

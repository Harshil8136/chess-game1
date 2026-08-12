---

title: "Runbook: Public Share-Link Architecture (Single-Domain Access Bypass)"
status: active
audience: [technical, operator]
last_verified: 2026-08-12
verified_against: [code]
owner: harshil
related_docs: [../features/STAFF-MANAGED-STORAGE.md, brevo-webhook.md, ../security/SECURITY.md]
tags: [runbook, cloudflare-access, zero-trust, storage, security]
---

# Runbook: Public Share-Link Architecture (Single-Domain Access Bypass)

Makes vendor share links (`GET /api/storage/share/[token]`), the inbound File Request Links flow (`/api/storage/request/[token]/*` — see [`../features/STAFF-MANAGED-STORAGE.md`](../features/STAFF-MANAGED-STORAGE.md)), and RFC 8058 one-click unsubscribe (`/api/emails/unsubscribe`) reachable by external recipients on the single primary domain (`secure.madagascarhotelags.com`).

> **TL;DR:** All portal endpoints and API routes run on a single custom domain, `secure.madagascarhotelags.com`. Anonymous access for public vendor share links (`/api/storage/share/*`) and file request links (`/api/storage/request/*`) is granted via a dedicated **Cloudflare Access Path-Based Bypass Policy** in Zero Trust. This eliminates multi-domain deployment conflicts, worker route contention, and dashboard URL flipping.

> ⚠️ **UNVERIFIED (flagged 2026-08-12):** The Worker-side code (`src/lib/auth/routes.ts` `PUBLIC_API_ROUTES_PREFIXES`) has treated `/api/storage/request/` as a public, unauthenticated prefix since File Request Links shipped (2026-08-09) — same as `/api/storage/share/`. It is **not confirmed** whether the actual Cloudflare Access **Path-Based Bypass Policy** (§1, the edge-level Zero Trust config, external to this repo) was ever extended to cover `/api/storage/request/*`, or whether it still only lists `/api/storage/share/*` as originally configured. This doc's own §1 below has not been updated to list the request path. No MCP/API tool available for this review could read live Zero Trust Access policies to check. **If the bypass policy was never extended, every file-request link is currently unusable by a real external vendor** — they'd hit the CF Access SSO wall before the Worker ever sees the request, even though the Worker-side code and the D1 audit log show internal test traffic succeeding (internal testers already hold a valid CF Access session, which would mask this gap). Verify directly in Cloudflare Zero Trust Dashboard → Access Controls → Applications, and add a second self-hosted application for `secure.madagascarhotelags.com/api/storage/request/*` (mirroring §1) if it's missing.

## 1. Cloudflare Access Configuration

In Cloudflare Zero Trust Dashboard (**Access Controls → Applications**):

1. Self-hosted application registered for Path: `secure.madagascarhotelags.com/api/storage/share/*`.
2. Policy Action: `Bypass`.
3. Rule Type: `Include` → `Selector: Everyone`.
4. **Needs verification (see warning above):** a matching application for Path: `secure.madagascarhotelags.com/api/storage/request/*`, same policy shape — required for File Request Links to be reachable by external recipients.

This allows Cloudflare Zero Trust to bypass authentication exclusively for `/api/storage/share/*` (and, once verified/added, `/api/storage/request/*`), while leaving all `/dashboard/*` routes locked behind Zero Trust SSO.

## 2. In-Depth Authorization Layers

1. **Edge Bypass**: Cloudflare Zero Trust allows traffic on `/api/storage/share/*` (and `/api/storage/request/*`, pending verification above) to hit the Worker without an SSO prompt.
2. **Worker Middleware**: `isPublicApiRoute()` marks both the `/api/storage/share/` and `/api/storage/request/` prefixes as public (`src/lib/auth/routes.ts`).
3. **HMAC Signature Check**: The token itself carries an HMAC-SHA256 signature and expiration claim (`src/lib/storage/share-token.ts` — the same signer is reused for request-link tokens, namespaced with a `req:` prefix on the payload's file-id claim so a share token and a request token can never be swapped for each other).
4. **Passcode Protection**: If enabled, the recipient must provide a valid passcode (share links only — request links are not passcode-gated, since the recipient email is fixed at creation time).
5. **Telemetry Logging**: Every attempt (SUCCESS, INVALID_PASSCODE, MISSING_CONSENT, EXPIRED_LINK, DISALLOWED_EXTENSION, FILE_TOO_LARGE) is logged to `storage_share_access_logs`.

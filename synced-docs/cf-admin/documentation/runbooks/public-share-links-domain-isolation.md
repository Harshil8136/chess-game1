---

title: "Runbook: Public Share-Link Architecture (Single-Domain Access Bypass)"
status: active
audience: [technical, operator]
last_verified: 2026-08-06
verified_against: [code, infra]
owner: harshil
related_docs: [../features/STAFF-MANAGED-STORAGE.md, brevo-webhook.md, ../security/SECURITY.md]
tags: [runbook, cloudflare-access, zero-trust, storage, security]
---

# Runbook: Public Share-Link Architecture (Single-Domain Access Bypass)

Makes vendor share links (`GET /api/storage/share/[token]`) and RFC 8058 one-click unsubscribe (`/api/emails/unsubscribe`) reachable by external recipients on the single primary domain (`secure.madagascarhotelags.com`).

> **TL;DR:** All portal endpoints and API routes run on a single custom domain, `secure.madagascarhotelags.com`. Anonymous access for public vendor share links (`/api/storage/share/*`) is granted via a dedicated **Cloudflare Access Path-Based Bypass Policy** in Zero Trust. This eliminates multi-domain deployment conflicts, worker route contention, and dashboard URL flipping.

## 1. Cloudflare Access Configuration

In Cloudflare Zero Trust Dashboard (**Access Controls → Applications**):

1. Self-hosted application registered for Path: `secure.madagascarhotelags.com/api/storage/share/*`.
2. Policy Action: `Bypass`.
3. Rule Type: `Include` → `Selector: Everyone`.

This allows Cloudflare Zero Trust to bypass authentication exclusively for `/api/storage/share/*`, while leaving all `/dashboard/*` routes locked behind Zero Trust SSO.

## 2. In-Depth Authorization Layers

1. **Edge Bypass**: Cloudflare Zero Trust allows traffic on `/api/storage/share/*` to hit the Worker without an SSO prompt.
2. **Worker Middleware**: `isPublicApiRoute('/api/storage/share/[token]')` marks the route as public.
3. **HMAC Signature Check**: The token itself carries an HMAC-SHA256 signature and expiration claim.
4. **Passcode Protection**: If enabled, the recipient must provide a valid passcode.
5. **Telemetry Logging**: Every attempt (SUCCESS, INVALID_PASSCODE, MISSING_CONSENT, EXPIRED_LINK) is logged to `storage_share_access_logs`.

---

title: "Runbook: Public Share-Link Architecture (Single-Domain Access Bypass)"
status: active
audience: [technical, operator]
last_verified: 2026-08-15
verified_against: [code]
owner: harshil
related_docs: [../features/STAFF-MANAGED-STORAGE.md, brevo-webhook.md, ../security/SECURITY.md]
tags: [runbook, cloudflare-access, zero-trust, storage, security]
---

# Runbook: Public Share-Link Architecture (Single-Domain Access Bypass)

Makes vendor share links (`GET /api/storage/share/[token]`), the inbound File Request Links flow (`/api/storage/request/[token]/*` — see [`../features/STAFF-MANAGED-STORAGE.md`](../features/STAFF-MANAGED-STORAGE.md)), and RFC 8058 one-click unsubscribe (`/api/emails/unsubscribe`) reachable by external recipients on the single primary domain (`secure.madagascarhotelags.com`).

> **TL;DR:** All portal endpoints and API routes run on a single custom domain, `secure.madagascarhotelags.com`. Anonymous access for public vendor share links (`/api/storage/share/*`) and file request links (`/api/storage/request/*`) is granted via a dedicated **Cloudflare Access Path-Based Bypass Policy** in Zero Trust. This eliminates multi-domain deployment conflicts, worker route contention, and dashboard URL flipping.

> ⚠️ **UNVERIFIED (flagged 2026-08-12):** The Worker-side code (`src/lib/auth/routes.ts` `PUBLIC_API_PREFIXES`) has treated `/api/storage/request/` as a public, unauthenticated prefix since File Request Links shipped (2026-08-09) — same as `/api/storage/share/`. It is **not confirmed** whether the actual Cloudflare Access **Path-Based Bypass Policy** (§1, the edge-level Zero Trust config, external to this repo) was ever extended to cover `/api/storage/request/*`, or whether it still only lists `/api/storage/share/*` as originally configured. This doc's own §1 below has not been updated to list the request path. No MCP/API tool available for this review could read live Zero Trust Access policies to check. **If the bypass policy was never extended, every file-request link is currently unusable by a real external vendor** — they'd hit the CF Access SSO wall before the Worker ever sees the request, even though the Worker-side code and the D1 audit log show internal test traffic succeeding (internal testers already hold a valid CF Access session, which would mask this gap). Verify directly in Cloudflare Zero Trust Dashboard → Access Controls → Applications, and add a second self-hosted application for `secure.madagascarhotelags.com/api/storage/request/*` (mirroring §1) if it's missing.
>
> ✅ **RESOLVED 2026-08-15 — verified against the live edge, not just the config.** The application **"Public Vendor Share Links"** carries exactly two public hostnames, `secure.madagascarhotelags.com/api/storage/share/*` and `secure.madagascarhotelags.com/api/storage/request/*` (operator screenshot). Both were then probed unauthenticated from outside the tenant:
>
> ```
> GET /api/storage/share/invalid-token    -> HTTP 404   (reached the Worker)
> GET /api/storage/request/invalid-token  -> HTTP 404   (reached the Worker)
> ```
>
> A 404 here is the Worker's own `invalidLinkPage()`, so the request passed Access and was rejected on token grounds — which is the whole bypass chain working end to end. An Access wall would have shown `HTTP 302` to `mascotas.cloudflareaccess.com`. The scope is also correctly narrow: it is not `/api/storage/*`, so `/api/storage/admin/*` keeps its edge layer.
>
> Wildcard semantics were confirmed against Cloudflare's [Application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) documentation: a single `*` **spans `/` separators**, so `/api/storage/request/*` covers the nested `/{token}/presign` and `/{token}/confirm` endpoints, not just the one-segment landing page. (Constraint to respect if these are ever edited: at most one wildcard between any two slashes.)

> ✅ **RESOLVED 2026-08-15 — but it was TWO defects in two different layers, and fixing only the first left it broken.** Original finding: RFC 8058 one-click unsubscribe was behind the Access wall. This runbook has claimed since it was written (see the sentence above §1) that it makes `/api/emails/unsubscribe` reachable by external recipients. It does not — there is no public hostname for it on the application, and the live edge confirms the consequence:
>
> ```
> GET /api/emails/unsubscribe  -> HTTP 302 -> mascotas.cloudflareaccess.com/cdn-cgi/access/login/...
> GET /api/health              -> HTTP 302 -> mascotas.cloudflareaccess.com/cdn-cgi/access/login/...
> ```
>
> `src/lib/auth/routes.ts` lists `/api/emails/unsubscribe` in `PUBLIC_API_ROUTES` precisely because a mailbox provider hits it with no session, no cookie and no CSRF token — but the Worker never sees the request. Both `GET` (the human-clickable footer link) and `POST` (the `List-Unsubscribe-Post: List-Unsubscribe=One-Click` call Gmail and Yahoo make) get the SSO redirect instead. Impact is bigger than one broken link: opt-out is a CAN-SPAM/CASL obligation, and since 2024 Gmail and Yahoo materially penalise bulk senders whose one-click endpoint does not work — which degrades inbox placement for **all** mail from the domain, transactional included. Note this defeats the exact purpose gap G5 was closed for (`2026-07-22-compliance-certification-audit…` §8.3).
>
> **Fix:** add a third public hostname to this application — subdomain `secure`, domain `madagascarhotelags.com`, path `api/emails/unsubscribe`. **Use the exact path with NO wildcard.** A trailing `/*` or, worse, `api/emails/*` would bypass Access for the entire Email Portal API surface (`/api/emails/send`, drafts, templates), which PLAC would still deny but which has no business being outside the edge layer.
>
> `/api/health` is the same story with far lower stakes — it is in `PUBLIC_API_ROUTES` as a liveness probe. **Decision 2026-08-15: left behind Access deliberately.** No external uptime monitor points at cf-admin, so there is nothing to break; revisit only if monitoring is added.
>
> **Layer 1 — Access (fixed in the dashboard).** A third public hostname, `secure.madagascarhotelags.com/api/emails/unsubscribe`, exact path, no wildcard. Verified live:
>
> ```
> GET  /api/emails/unsubscribe  -> HTTP 200   reached the Worker
> GET  /api/emails/send         -> HTTP 302   still behind Access  <- scope did NOT widen
> ```
>
> **Layer 2 — Astro's own CSRF (fixed in code).** With Access cleared, `POST` still returned `403 Cross-site POST form submissions are forbidden` — plain text, not this app's JSON `{"error":"Forbidden"}`. That is Astro's [`security.checkOrigin`](https://docs.astro.build/en/reference/configuration-reference/#securitycheckorigin), default `true` since 4.9, which rejects `POST`/`PUT`/`PATCH`/`DELETE` carrying `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain` without a matching `Origin`. A Gmail/Yahoo one-click POST is precisely that shape and sends no `Origin`, so the automated path stayed broken while the human GET link worked — the kind of split that hides from manual testing.
>
> It is global with no per-route exemption, so it is now `false` in `astro.config.ts`. CSRF is unchanged in practice: `validateCsrf()` (`src/lib/csrf.ts`, applied in `src/lib/auth/pipeline.ts`) is a superset — every non-GET method rather than three content-types, boundary-anchored against Referer suffix spoofing, fail-closed without `SITE_URL` — and it runs *after* the public-API allowlist, so the routes that must accept anonymous cross-origin POSTs are exempt by design. `test/csrf.test.ts` pins both halves, including that `/api/emails/*` and `/api/storage/requests` (plural) are **not** exempt.
>
> **Diagnostic worth reusing:** distinguish the two layers by the response body. Astro says `Cross-site POST form submissions are forbidden` in `text/plain`; this app's middleware says `{"error":"Forbidden"}` in JSON; Cloudflare Access sends a `302` to `mascotas.cloudflareaccess.com`. Three different failures that all look like "403/blocked" from the client.

## 0. Why the Access Bypass is correct (do not re-flag)

> A security review on 2026-08-14 flagged the `Bypass` + `Include: Everyone` policy on the **Public Vendor Share Links** application as "overprovisioned access", describing these endpoints as "completely unauthenticated and unmonitored", and recommended deleting the policy in favour of a scoped `Allow` (service token or email list). **Acting on that recommendation would have caused a production outage.** The reasoning, recorded here so the same finding is not raised a third time:

1. **The bypass is load-bearing.** The recipients of these links are external vendors and clients who have no Cloudflare Access identity and never will. A scoped `Allow` policy cannot authenticate a party that has no IdP account, no service token and no seat — every real recipient would hit the SSO wall instead of the file. `Bypass` is the only Access decision that expresses "let the Worker do the authorization".
2. **"Unauthenticated" is inaccurate.** Authorization is carried by the link itself: an HMAC-SHA256 token with an `exp` claim, compared in constant time, **plus** a matching `share_token_hash` / `token_hash` row in D1 (so a link can be revoked before it expires), **plus** status, expiry and slot-count checks, **plus** an optional passcode. See §2.
3. **"Unmonitored" is inaccurate.** Access `Bypass` does skip *edge* logging — that part is true — but every attempt, successful or not, is written to `storage_share_access_logs` with an attempt status (`SUCCESS`, `INVALID_PASSCODE`, `MISSING_CONSENT`, `EXPIRED_LINK`, `REVOKED_LINK`, `DISALLOWED_EXTENSION`, `FILE_TOO_LARGE`) plus hashed IP, user agent and country, and successful downloads additionally land in `admin_audit_log`. The Worker records strictly more than an Access log would.

**What the review did not find, and what was actually wrong:** `IP_HASH_SECRET` was signing share tokens, file-request tokens and RFC 8058 unsubscribe tokens *as well as* pseudonymising IP addresses — four jobs, one key, no domain separation. That is fixed (see §3), and it was the real defect behind this surface.

**The one thing still worth tightening** is the app's *path scope*, not its policy: confirm the application matches exactly `/api/storage/share/*` and `/api/storage/request/*`, and not a broader pattern such as `/api/storage/*`, which would drop the edge layer in front of `/api/storage/admin/*`. Worker-side PLAC would still deny those, so this is depth rather than a live hole — but it should be checked. See §1.

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

## 3. Signing keys and their rotation behaviour

Every token on this surface derives its signing key from the single root secret `IP_HASH_SECRET` via HKDF-SHA256 (`src/lib/crypto/hkdf.ts`). Deriving rather than adding one secret per purpose is deliberate — RULE #0.8 caps environment variables at 41 and a derivation needs no new input.

| Purpose | Signing key | Legacy fallback |
|---|---|---|
| IP pseudonymisation (`hashIp`) | the **raw root secret**, unchanged | n/a |
| Share + file-request tokens | `HKDF(root, "cf-admin/storage/share-token/v1")` | until **2026-09-15**, then delete |
| Share + request passcodes | `HKDF(root, "cf-admin/storage/passcode/v1")` | permanent (upgrade-on-use) |
| RFC 8058 unsubscribe tokens | `HKDF(root, "cf-admin/email/unsubscribe/v1")` | **permanent — never remove** |

Notes a future maintainer needs:

- **`hashIp` deliberately stays on the raw root.** Re-keying it would break correlation with every historical `ip_hash` already written to `storage_share_access_logs`, `admin_audit_log` and the login logs, and buys nothing once the token signers have moved off it.
- **The share-token fallback has a hard sunset.** Share and request TTLs are capped at 30 days (`schemas/storage.ts`, max 2592000s), so every token signed with the raw root is guaranteed expired 30 days after the split shipped. The fallback branch in `verifyShareToken` is marked with that date and should be deleted once it passes.
- **The unsubscribe fallback must never be removed.** Those tokens are intentionally not time-limited, because an opt-out link in a two-year-old email has to keep working; dropping the branch would silently break opt-out on every message already delivered, which is a CAN-SPAM and deliverability problem rather than a broken link.
- **Passcodes migrate themselves.** `verifyPasscode` checks the keyed scheme first and falls back to the legacy unsalted SHA-256; on a legacy match the caller rewrites the stored hash with the keyed form, so records drain over as they are used. No migration script, no forced link regeneration.
- **Mass revocation does not need a key change.** Nulling `storage_files.share_token_hash` (or setting `storage_file_requests.status`) revokes links immediately — that lever already exists and is why no separate token-generation counter was added.

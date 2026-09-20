---

title: "Runbook: Public Share-Link Architecture (Single-Domain Access Bypass)"
status: active
audience: [technical, operator]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_docs: [../features/STAFF-MANAGED-STORAGE.md, brevo-webhook.md, ../security/SECURITY.md]
tags: [runbook, cloudflare-access, zero-trust, storage, security]
---

# Runbook: Public Share-Link Architecture (Single-Domain Access Bypass)

Makes vendor share links (`GET /api/storage/share/[token]`), the inbound File Request Links flow (`/api/storage/request/[token]/*` — see [`../features/STAFF-MANAGED-STORAGE.md`](../features/STAFF-MANAGED-STORAGE.md)), and RFC 8058 one-click unsubscribe (`/api/emails/unsubscribe`) reachable by external recipients on the single primary domain (`secure.madagascarhotelags.com`).

> **TL;DR:** All portal endpoints and API routes run on a single custom domain, `secure.madagascarhotelags.com`. Anonymous access for public vendor share links (`/api/storage/share/*`) and file request links (`/api/storage/request/*`) is granted via a dedicated **Cloudflare Access Path-Based Bypass Policy** in Zero Trust. This eliminates multi-domain deployment conflicts, worker route contention, and dashboard URL flipping.

> ## ✅ Resolved and re-verified live — 2026-08-15, re-probed 2026-09-19
>
> **Everything on this surface that was once flagged is closed.** Two gaps were
> opened on 2026-08-12 (was the Access bypass ever extended to
> `/api/storage/request/*`? and was `/api/emails/unsubscribe` reachable at
> all?); both were fixed and verified on 2026-08-15, and all four paths were
> probed again, unauthenticated from outside the tenant, on **2026-09-19**:
>
> ```text
> GET /api/storage/share/<invalid>    -> 404   reached the Worker (invalidLinkPage)
> GET /api/storage/request/<invalid>  -> 404   reached the Worker (invalidLinkPage)
> GET /api/emails/unsubscribe         -> 200   reached the Worker
> GET /api/emails/send                -> 302   still behind Access  <- scope has NOT widened
> ```
>
> A 404 here is the Worker's own `invalidLinkPage()` — the request passed
> Access and was rejected on token grounds, which is the whole bypass chain
> working end to end. An Access wall shows `302` to
> `mascotas.cloudflareaccess.com`, as `/api/emails/send` still does.
>
> **Do not re-open these as findings.** §0 explains why the `Bypass` policy is
> correct; §1 and §2 describe the configuration as it actually is.
>
> <details><summary>What the two defects were, and the diagnostic worth keeping</summary>
>
> **Defect 1 — the request-link bypass.** `src/lib/auth/routes.ts`
> (`PUBLIC_API_PREFIXES`) treated `/api/storage/request/` as public from
> 2026-08-09, but it was unknown whether the edge policy had been extended to
> match. Internal testers already hold a valid Access session, which masked the
> gap. Resolved: the application **"Public Vendor Share Links"** carries both
> public hostnames. Wildcard semantics confirmed against Cloudflare's
> [Application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
> docs — a single `*` **spans `/` separators**, so `/api/storage/request/*`
> covers the nested `/{token}/presign` and `/{token}/confirm`. (Constraint if
> these are ever edited: at most one wildcard between any two slashes.)
>
> **Defect 2 — one-click unsubscribe, two layers.** RFC 8058 unsubscribe was
> behind the Access wall, and fixing only the edge left it broken.
>
> *Layer 1 — Access.* A third public hostname,
> `secure.madagascarhotelags.com/api/emails/unsubscribe`, **exact path, no
> wildcard**. A trailing `/*` or `api/emails/*` would drop the edge layer in
> front of the whole Email Portal API. Why it mattered: opt-out is a
> CAN-SPAM/CASL obligation, and since 2024 Gmail and Yahoo penalise bulk
> senders whose one-click endpoint fails — degrading inbox placement for *all*
> mail from the domain, transactional included. It also defeated the purpose
> gap G5 was closed for.
>
> *Layer 2 — Astro's own CSRF.* With Access cleared, `POST` still returned
> `403 Cross-site POST form submissions are forbidden` in plain text. That is
> [`security.checkOrigin`](https://docs.astro.build/en/reference/configuration-reference/#securitycheckorigin),
> default `true` since Astro 4.9, rejecting non-GET requests carrying
> `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`
> without a matching `Origin` — precisely the shape of a Gmail/Yahoo one-click
> POST. The human GET link worked while the automated path stayed broken, which
> is the kind of split manual testing misses. It is global with no per-route
> exemption, so it is now `false` in `astro.config.ts`. CSRF is unchanged in
> practice: `validateCsrf()` (`src/lib/csrf.ts`, applied in
> `src/lib/auth/stages/classify.ts` — stage 1 of the pipeline, not
> `pipeline.ts` itself since the chunk-10 split) is a superset, and it runs
> *after* the public-API allowlist. `test/csrf.test.ts` pins both halves,
> including that `/api/emails/*` and `/api/storage/requests` (plural) are
> **not** exempt.
>
> **Diagnostic worth reusing:** three failures all look like "403/blocked" from
> the client, and the response body tells them apart — Astro says
> `Cross-site POST form submissions are forbidden` in `text/plain`; this app's
> middleware says `{"error":"Forbidden"}` in JSON; Cloudflare Access sends a
> `302` to `mascotas.cloudflareaccess.com`.
>
> </details>
>
> **`/api/health` is deliberately left behind Access** (decision 2026-08-15;
> re-confirmed 2026-09-19, it still answers `302`). It is in
> `PUBLIC_API_ROUTES` as a liveness probe and no external uptime monitor points
> at cf-admin. It does have **one** consumer worth knowing about: the release
> smoke stage in `scripts/release.mjs` calls it with
> `CF-Access-Client-Id`/`CF-Access-Client-Secret` service-token headers
> (`release-and-rollback.md` §4). Revisit the decision if external monitoring
> is ever added.
>
> **Not covered by this document, and owned by nobody:** `/api/emails/webhook`.
> Probed 2026-09-19 → `302` to the Access login, i.e. **there is no bypass for
> it**, which is why Brevo cannot reach it. See
> [`brevo-webhook.md`](brevo-webhook.md). There is no single place that lists
> every Access bypass on this hostname; the list above plus that note is the
> closest thing.

## 0. Why the Access Bypass is correct (do not re-flag)

> A security review on 2026-08-14 flagged the `Bypass` + `Include: Everyone` policy on the **Public Vendor Share Links** application as "overprovisioned access", describing these endpoints as "completely unauthenticated and unmonitored", and recommended deleting the policy in favour of a scoped `Allow` (service token or email list). **Acting on that recommendation would have caused a production outage.** The reasoning, recorded here so the same finding is not raised a third time:

1. **The bypass is load-bearing.** The recipients of these links are external vendors and clients who have no Cloudflare Access identity and never will. A scoped `Allow` policy cannot authenticate a party that has no IdP account, no service token and no seat — every real recipient would hit the SSO wall instead of the file. `Bypass` is the only Access decision that expresses "let the Worker do the authorization".
2. **"Unauthenticated" is inaccurate.** Authorization is carried by the link itself: an HMAC-SHA256 token with an `exp` claim, compared in constant time, **plus** a matching `share_token_hash` / `token_hash` row in D1 (so a link can be revoked before it expires), **plus** status, expiry and slot-count checks, **plus** an optional passcode. See §2.
3. **"Unmonitored" is inaccurate.** Access `Bypass` does skip *edge* logging — that part is true — but every attempt, successful or not, is written to `storage_share_access_logs` with an attempt status (`SUCCESS`, `INVALID_PASSCODE`, `MISSING_CONSENT`, `EXPIRED_LINK`, `REVOKED_LINK`, `DISALLOWED_EXTENSION`, `FILE_TOO_LARGE`) plus hashed IP, user agent and country, and successful downloads additionally land in `admin_audit_log`. The Worker records strictly more than an Access log would.

**What the review did not find, and what was actually wrong:** `IP_HASH_SECRET` was signing share tokens, file-request tokens and RFC 8058 unsubscribe tokens *as well as* pseudonymising IP addresses — four jobs, one key, no domain separation. That is fixed (see §3), and it was the real defect behind this surface.

**The path scope was the one thing worth checking, and it checks out.** The
application matches `/api/storage/share/*`, `/api/storage/request/*` and the
exact path `/api/emails/unsubscribe` — not a broader pattern such as
`/api/storage/*` or `/api/emails/*`, either of which would drop the edge layer
in front of `/api/storage/admin/*` or the Email Portal API. Re-confirmed by
live probe 2026-09-19 (`/api/emails/send` still answers `302`). Keep it that
way if these are ever edited. See §1.

## 1. Cloudflare Access Configuration

In Cloudflare Zero Trust Dashboard (**Access Controls → Applications**):

The self-hosted application **"Public Vendor Share Links"** carries three public
hostnames, all on `secure.madagascarhotelags.com`:

| # | Path | Wildcard? | Purpose |
|---|---|---|---|
| 1 | `/api/storage/share/*` | yes — spans `/`, so nested paths are covered | Vendor share links |
| 2 | `/api/storage/request/*` | yes — covers `/{token}/presign` and `/{token}/confirm` | Inbound File Request Links |
| 3 | `/api/emails/unsubscribe` | **no — exact path, deliberately** | RFC 8058 one-click unsubscribe |

Policy on all three: Action `Bypass`, Rule Type `Include` → `Selector: Everyone`.

This bypasses Access **only** for those paths, leaving every `/dashboard/*`
route and the rest of `/api/*` behind Zero Trust SSO. The scope is correctly
narrow — it is not `/api/storage/*`, so `/api/storage/admin/*` keeps its edge
layer, and it is not `/api/emails/*`, so the Email Portal API keeps its. All
three were re-probed live on 2026-09-19 (see the resolved note above).

## 2. In-Depth Authorization Layers

1. **Edge Bypass**: Cloudflare Zero Trust allows traffic on `/api/storage/share/*` and `/api/storage/request/*` (§1) to hit the Worker without an SSO prompt.
2. **Worker Middleware**: `isPublicApiRoute()` marks both the `/api/storage/share/` and `/api/storage/request/` prefixes as public (`src/lib/auth/routes.ts`).
3. **HMAC Signature Check**: The token itself carries an HMAC-SHA256 signature and expiration claim (`src/lib/storage/share-token.ts` — the same signer is reused for request-link tokens, namespaced with a `req:` prefix on the payload's file-id claim so a share token and a request token can never be swapped for each other).
4. **Passcode Protection**: If enabled, the recipient must provide a valid passcode (share links only — request links are not passcode-gated, since the recipient email is fixed at creation time).
5. **Telemetry Logging**: Every attempt (SUCCESS, INVALID_PASSCODE, MISSING_CONSENT, EXPIRED_LINK, DISALLOWED_EXTENSION, FILE_TOO_LARGE) is logged to `storage_share_access_logs`.

## 3. Signing keys and their rotation behaviour

Every token on this surface derives its signing key from the single root secret `IP_HASH_SECRET` via HKDF-SHA256 (`src/lib/crypto/hkdf.ts`). Deriving rather than adding one secret per purpose is deliberate: **RULE #0.8** says a new env var is the last option (it is a policy, not a numeric ceiling — this line quoted "41", which matched no other document's number and does not match the live figure either), and a derivation needs no new input at all.

| Purpose | Signing key | Legacy fallback |
|---|---|---|
| IP pseudonymisation (`hashIp`) | the **raw root secret**, unchanged | n/a |
| Share + file-request tokens | `HKDF(root, "cf-admin/storage/share-token/v1")` | sunset **2026-09-15 — expired, branches still live** (see below) |
| Share + request passcodes | `HKDF(root, "cf-admin/storage/passcode/v1")` | permanent (upgrade-on-use) |
| RFC 8058 unsubscribe tokens | `HKDF(root, "cf-admin/email/unsubscribe/v1")` | **permanent — never remove** |

Notes a future maintainer needs:

- **`hashIp` deliberately stays on the raw root.** Re-keying it would break correlation with every historical `ip_hash` already written to `storage_share_access_logs`, `admin_audit_log` and the login logs, and buys nothing once the token signers have moved off it.
- **The share-token fallback has a hard sunset, and it has passed.** Share and request TTLs are capped at 30 days (`schemas/storage.ts`, max 2592000s), so every token signed with the raw root was guaranteed expired by **2026-09-15**. ⚠️ **As of 2026-09-19 both branches are still in the code** — the raw-root HMAC comparison in `verifyShareToken` (marked "safe to delete this branch on or after 2026-09-15") and the legacy remint path in the same file. This runbook is the only tracker for the deletion: delete them, or record an owner decision and a new date. A signing fallback that outlives its window is exactly the kind of thing nobody notices.
- **The unsubscribe fallback must never be removed.** Those tokens are intentionally not time-limited, because an opt-out link in a two-year-old email has to keep working; dropping the branch would silently break opt-out on every message already delivered, which is a CAN-SPAM and deliverability problem rather than a broken link.
- **Passcodes migrate themselves.** `verifyPasscode` checks the keyed scheme first and falls back to the legacy unsalted SHA-256; on a legacy match the caller rewrites the stored hash with the keyed form, so records drain over as they are used. No migration script, no forced link regeneration.
- **Mass revocation does not need a key change.** Nulling `storage_files.share_token_hash` (or setting `storage_file_requests.status`) revokes links immediately — that lever already exists and is why no separate token-generation counter was added.
- **Rotating `IP_HASH_SECRET` is not a routine step.** Because it is the root of all four rows above, a rotation invalidates every live share link and file-request link, every stored passcode that has not upgraded, and the unsubscribe link in **every email already sent**. `incident-response.md` §4 lists the rotation order; treat this table as the re-issuance checklist that must accompany it.

## 4. Verification log

| Date | Method | Result |
|---|---|---|
| 2026-09-19 | Unauthenticated `curl` from outside the tenant against `/api/storage/share/<invalid>`, `/api/storage/request/<invalid>`, `/api/emails/unsubscribe`, `/api/emails/send`, `/api/health` and `/api/emails/webhook`; `grep -rn validateCsrf src/lib/auth/`; `src/lib/storage/share-token.ts` read | 404 / 404 / 200 / 302 / 302 / **302**. Bypass scope confirmed unchanged and correctly narrow. Three stale banners collapsed into the resolved note above; §1 and §2 rewritten to state the configuration rather than ask about it; `validateCsrf` path corrected to `stages/classify.ts`; the expired share-token legacy window flagged; the RULE #0.8 number dropped. New: `/api/emails/webhook` has **no** Access bypass — recorded here and in `brevo-webhook.md` |

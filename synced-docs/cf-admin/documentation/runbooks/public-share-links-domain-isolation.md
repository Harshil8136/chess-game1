---

title: "Runbook: Public Share-Link Domain Isolation"
status: active
audience: [technical, operator]
last_verified: 2026-08-05
verified_against: [code, live production test]
owner: ai-agent
related_docs: [../features/STAFF-MANAGED-STORAGE.md, brevo-webhook.md, ../security/SECURITY.md]
tags: [runbook, cloudflare-access, zero-trust, storage, security, dns]
---

# Runbook: Public Share-Link Domain Isolation

Makes vendor share links (`GET /api/storage/share/[token]`) and the RFC 8058
one-click unsubscribe link (`POST /api/emails/unsubscribe`) reachable by
external recipients who have no Cloudflare Access login and no cf-admin
session — a vet clinic, a vendor, or Gmail/Yahoo's unsubscribe crawler.

> **TL;DR:** Both routes are served from a second hostname,
> `share.madagascarhotelags.com`, pointed at the same `cf-admin-madagascar`
> Worker via a Cloudflare Custom Domain. That hostname is **deliberately
> never enrolled in any Cloudflare Zero Trust Access Application** — Access
> only inspects traffic for hostnames explicitly registered with it, so an
> unregistered hostname is structurally unreachable by any Access policy.
> `secure.madagascarhotelags.com` is completely unchanged and keeps
> requiring Access for everything.

## History — why this replaced the original Access-Bypass-policy plan

The first version of this runbook (superseded 2026-08-05) proposed adding a
path-scoped Cloudflare Access **Bypass** policy for `/api/storage/share/*`
on the *existing* `secure.madagascarhotelags.com` Access Application — the
Cloudflare-documented pattern for exposing one path on an otherwise gated
domain (see [Cloudflare: Application paths](https://developers.cloudflare.com/cloudflare-one/policies/access/app-paths/)).
That plan was technically valid but was superseded by the dedicated-hostname
approach below for one reason: it puts the one exception directly inside the
policy set that guards the entire admin portal, forever. The dedicated
hostname removes that risk structurally — there is no Access policy for
`share.*` at all, so there is nothing there to misconfigure.

**A second, independent bug was found while validating both plans**, and had
to be fixed either way: `src/lib/auth/pipeline.ts`'s public-API allowlist
(`isPublicApiRoute`) was only checked *after* the session-bootstrap gate, so
an anonymous request to `/api/storage/share/*` or `/api/emails/unsubscribe`
was redirected to `/` before the allowlist was ever consulted — regardless
of Cloudflare Access configuration. This was fully masked in production
because Cloudflare Access blocked the whole `secure.*` domain before the
Worker ran, so the redirect-to-`/` never had a chance to manifest. Fixed in
commit `fb52f0e` (see `src/lib/auth/pipeline.ts`).

## Why this is safe

Independent, defense-in-depth layers — not reliant on any single one being
configured correctly:

1. **No Access enrollment.** `share.*` was never added as a Cloudflare
   Access Application, so `CF-Access-Authenticated-User-Email` /
   `CF-Access-JWT-Assertion` headers never exist for requests to it.
2. **Host-scoped app-layer guard.** `pipeline.ts` hard-404s every path on
   `share.*` except the explicit public-API allowlist
   (`isShareHost()` + `isPublicApiRoute()` in `src/lib/auth/routes.ts`).
3. **`__Host-` cookie prefix + `SameSite=Strict`.** cf-admin's session
   cookie is host-bound and `SameSite=Strict` (`src/lib/auth/session.ts`) —
   the browser cannot send it to a different hostname, and won't attach it
   to a cross-site request either, so a leaked/forged request to `share.*`
   (or anywhere else, cross-site) carries no session regardless.
4. **`dev-login.ts`'s own independent guards** (`import.meta.env.PROD` 404 +
   a fixed-env-var `isLocalDev(SITE_URL)` check, not request-hostname-based)
   mean this new hostname cannot reactivate it in production.
5. **Token-carries-authorization on both routes.** Neither route trusts the
   request's identity at all — `/api/storage/share/[token]` verifies an
   HMAC-SHA256 signed, expiring token; `/api/emails/unsubscribe` verifies an
   HMAC-SHA256 signed token over the recipient address. Layers 1–4 control
   *reachability*; these tokens control *authorization* once reached.

**Hostname is hardcoded, not an env var.** `PUBLIC_SHARE_HOST` /
`PUBLIC_SHARE_URL` are constants in `src/lib/auth/routes.ts`, not
`wrangler.toml [vars]` entries — this value never differs per environment,
so a var would be pure configuration bloat on top of this Worker's ~40
existing vars/secrets. Change the constant and redeploy if it ever needs to
change.

## Setup (already completed 2026-08-05)

1. Cloudflare dashboard → Workers & Pages → `cf-admin-madagascar` → Settings
   → Domains & Routes → Custom Domain → `share.madagascarhotelags.com`.
   ✅ Done by the account owner.
2. **Confirmed:** no existing Zero Trust Access Application uses a wildcard
   hostname pattern (e.g. `*.madagascarhotelags.com`) that would have
   auto-enrolled this new hostname. If this ever changes, re-verify this
   plan's core assumption before trusting it again.
3. `wrangler.toml` declares the same Custom Domain route (`[[routes]]`,
   `custom_domain = true`, no wildcard/path — Cloudflare Custom Domains
   don't support either) so `wrangler deploy` reconciles with, rather than
   fights, the dashboard-created resource.

## Verify

```bash
# 1. The new host is NOT Access-gated — expect the app's own 404, not a
#    cloudflareaccess.com redirect:
curl -sD- -o /dev/null "https://share.madagascarhotelags.com/api/storage/share/nonexistent-token"
# Expect: 404, Content-Type: text/html (the app's "link unavailable" page)
# NOT: 302 to *.cloudflareaccess.com

# 2. The host-guard blocks everything else on this hostname:
curl -sD- -o /dev/null "https://share.madagascarhotelags.com/dashboard"
curl -sD- -o /dev/null "https://share.madagascarhotelags.com/api/users"
# Expect: bare 404 (no body, no Set-Cookie) for both

# 3. secure.* is completely unaffected:
curl -sD- -o /dev/null "https://secure.madagascarhotelags.com/dashboard"
# Expect: unchanged — 302 to the Cloudflare Access login, same as before this change

# 4. Full round trip — create a real share as a logged-in staff user via the
#    UI (ShareLinkModal → Generate Link, or Regenerate Link on an existing
#    share created before this change shipped). Confirm the generated URL
#    uses https://share.madagascarhotelags.com/..., then in a
#    private/incognito browser window with no cf-admin session and no CF
#    Access login:
curl -s -o /tmp/shared-file -w "%{http_code}\n" "<the generated share URL>"
# Expect: 200, and /tmp/shared-file matches the original file's bytes.

# 5. Unsubscribe: trigger a test email send, confirm the List-Unsubscribe
#    header now reads https://share.madagascarhotelags.com/api/emails/unsubscribe?token=...,
#    then POST it with no cookies:
curl -s -X POST "<the List-Unsubscribe URL>"
# Expect: 200 JSON {"message":"If the address was subscribed, it has been unsubscribed."}
```

## Rollback

Remove the Custom Domain in the Cloudflare dashboard (Workers & Pages →
`cf-admin-madagascar` → Settings → Domains & Routes) and revert the
`[[routes]]` block in `wrangler.toml`. This immediately makes
`share.madagascarhotelags.com` stop resolving to the Worker — every
outstanding share/unsubscribe link on that hostname stops working. The
`pipeline.ts` ordering fix should stay regardless of rollback — it is a bug
fix independent of this domain, and reverting it would silently reintroduce
the redirect-before-allowlist bug on `secure.*` as well.

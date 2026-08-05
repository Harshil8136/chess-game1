---

title: "Runbook: Storage Share-Link Cloudflare Access Bypass"
status: active
audience: [technical, operator]
last_verified: 2026-08-05
verified_against: [code, live production test]
owner: ai-agent
related_docs: [../features/STAFF-MANAGED-STORAGE.md, brevo-webhook.md, ../security/SECURITY.md]
tags: [runbook, cloudflare-access, zero-trust, storage, security]
---

# Runbook: Storage Share-Link Cloudflare Access Bypass

Makes vendor share links (`GET /api/storage/share/[token]`) reachable by an
external recipient — a vet clinic, a vendor — who has no Cloudflare Access
login and no cf-admin session. Without this, the link fails with a Zero
Trust login wall instead of the file.

> **TL;DR:** two independent gates sit in front of this route, and BOTH must
> allow it through: (1) **Cloudflare Access at the edge** — blocks by
> default, needs an explicit **Bypass** policy scoped to the path; (2) **App
> middleware** — already fixed in code, `/api/storage/share/` is in
> `PUBLIC_API_PREFIXES` (`src/lib/auth/routes.ts`), which skips session/CSRF
> and the handler verifies an HMAC-signed token instead. Missing step 1
> means every vendor link 302-redirects to a Zero Trust login page.

## ⚠️ A live example of this exact gap already exists in production

While building this, `GET https://secure.madagascarhotelags.com/api/emails/unsubscribe`
was tested directly (2026-08-05) and returned:

```
HTTP/1.1 302 Found
Www-Authenticate: Cloudflare-Access resource_metadata="...protected-resource/api/emails/unsubscribe"
Location: https://mascotas.cloudflareaccess.com/cdn-cgi/access/login/secure.madagascarhotelags.com?...
```

That route is documented in code (`src/pages/api/emails/unsubscribe.ts`) as
"the only intentionally PUBLIC mutating route," listed in
`PUBLIC_API_ROUTES`, and is meant to be called by Gmail/Yahoo with no
session — but it currently has **no Cloudflare Access Bypass policy**, so a
real mailbox provider hitting RFC 8058 one-click unsubscribe gets a login
redirect instead of an unsubscribe. **This predates the storage feature and
is a separate, pre-existing production gap** — flagging it here because it's
the clearest possible proof that the app-level `PUBLIC_API_ROUTES` /
`PUBLIC_API_PREFIXES` allowlist alone does **not** make a route reachable
without a login; only an Access Bypass policy does that. Worth fixing
independently (same steps below, path `/api/emails/unsubscribe`).

## Why both a middleware bypass AND an Access policy are needed

1. **Cloudflare Access** (edge, in front of the Worker) — blocks any request
   without a valid Access login, before the Worker even runs. An external
   vendor has no Access identity, so they are blocked here first.
   → fixed by an **Access Bypass policy** scoped to the path (step below).
2. **App middleware** (inside the Worker) — session + CSRF checks.
   → already fixed in code: `/api/storage/share/` is a `PUBLIC_API_PREFIXES`
     entry (`src/lib/auth/routes.ts`), and the handler
     (`src/pages/api/storage/share/[token].ts`) verifies an HMAC-SHA256
     signed, expiring token instead of a session.

## Step — Add a Cloudflare Access Bypass policy for the path

Cloudflare **Zero Trust dashboard → Access → Applications →** the cf-admin
app (`secure.madagascarhotelags.com`):

1. Open the application → **Policies → Add a policy**.
2. Name: `Storage share-link bypass`. Action: **Bypass**.
3. Include → **Everyone** (the HMAC token in the URL is the real gate — keep
   the path narrow, do not widen "Include" to compensate).
4. **Scope it to the path**: restrict the rule to `/api/storage/share/*`
   only (path-based policy, or a dedicated route/application for that exact
   prefix — whichever this Access app already uses for path scoping).
5. Save, and confirm the Bypass rule evaluates **before** any enforcing
   "Allow" policy for that path (policy order matters in Zero Trust).

> Keep the bypass to the exact `/api/storage/share/*` prefix. Do **not**
> bypass Access for `/api/*` or the whole app — that removes Access from the
> entire admin portal, including everything behind PLAC/RBAC.

## Verify

```bash
# Before the policy exists — proves the current (broken) state:
curl -s -D - -o /dev/null "https://secure.madagascarhotelags.com/api/storage/share/nonexistent-token"
# Expect: 302 to mascotas.cloudflareaccess.com/cdn-cgi/access/login/...

# After adding the Bypass policy — proves Access now lets it through:
curl -s -D - -o /dev/null "https://secure.madagascarhotelags.com/api/storage/share/nonexistent-token"
# Expect: 404 (the app's own "link unavailable" page) — NOT a Cloudflare
# Access redirect, and NOT 403. A 404 here means both gates now pass and
# the token itself was correctly rejected as invalid, which is right for a
# made-up token.

# Full round trip — create a real share as a logged-in staff user via the
# UI (ShareLinkModal → Generate Link), then:
curl -s -o /tmp/shared-file -w "%{http_code}\n" "<the generated share URL>"
# Expect: 200, and /tmp/shared-file matches the original file's bytes.
```

## Rollback / disable

Delete the Access Bypass policy — this immediately re-blocks the path at the
edge (every outstanding share link stops working for external recipients,
though staff can still reach it while logged in via `/dashboard/storage`).
The app-level HMAC verification stays in place regardless, so removing the
policy is the correct way to pause the feature without touching code.

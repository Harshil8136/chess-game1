---

title: "Runbook: Brevo Delivery Webhook"
status: active
audience: [technical, operator]
last_verified: 2026-07-08
verified_against: [code, config]
owner: ai-agent
related_docs: [../features/EMAIL-PORTAL.md, ../security/SECURITY.md]
tags: [runbook, email, brevo, webhook, cloudflare-access]
---

# Runbook: Brevo Delivery Webhook

Makes Brevo delivery/bounce/spam events reach `POST /api/emails/webhook` so the
email delivery ledger updates. The endpoint is authenticated **only** by a shared
secret — it is exempt from session + CSRF (middleware `WEBHOOK_ROUTES`) and must
also be exempted from Cloudflare Access at the edge.

> **TL;DR:** three things must all be true — (1) `BREVO_WEBHOOK_SECRET` is set as
> a Worker secret, (2) a Cloudflare Access **Bypass** policy exists for the
> `/api/emails/webhook` path, and (3) Brevo posts to the URL carrying the secret.
> Miss any one and events are silently dropped (401/403/503).

## Why both a middleware bypass AND an Access policy are needed

Two independent gates sit in front of the endpoint:

1. **Cloudflare Access** (edge, in front of the Worker) — blocks any request
   without a valid Access login. Brevo has no login, so it is blocked here first.
   → fixed by an **Access Bypass policy** scoped to the path (step 2).
2. **App middleware** (inside the Worker) — runs CSRF + session checks on
   non-public POSTs. → already fixed in code: `/api/emails/webhook` is in
   `WEBHOOK_ROUTES`, so it skips session/CSRF and the handler validates the
   secret (constant-time) and rate-limits by IP.

## Step 1 — Set the Worker secret

```bash
openssl rand -hex 32                        # generate
npx wrangler secret put BREVO_WEBHOOK_SECRET # paste the value (prod)
# local dev: add BREVO_WEBHOOK_SECRET=<value> to .dev.vars
```

The handler fails closed (503) until this is set.

## Step 2 — Add a Cloudflare Access Bypass policy for the path

Cloudflare **Zero Trust dashboard → Access → Applications →** the cf-admin app
(`secure.madagascarhotelags.com`):

1. Open the application → **Policies → Add a policy**.
2. Name: `Brevo webhook bypass`. Action: **Bypass**.
3. Include → **Everyone** (the app secret is the real gate; keep the path narrow).
4. **Scope it to the path.** Either:
   - add a dedicated application/route for `secure.madagascarhotelags.com/api/emails/webhook`
     with the Bypass policy, **or**
   - if using path-based policies, restrict the rule to
     `/api/emails/webhook` only.
5. Save. Order the Bypass rule so it evaluates for that path.

> Keep the bypass to the exact path. Do **not** bypass Access for `/api/*` or the
> whole app — that would remove Access from the entire portal.

## Step 3 — Configure the Brevo webhook

Brevo dashboard → **Transactional → Settings → Webhooks** (already enabled for
delivered/bounce/spam; opens/clicks are optional and not required by the ledger):

- URL (query fallback, since Brevo transactional webhooks don't send custom headers):

  ```text
  https://secure.madagascarhotelags.com/api/emails/webhook?secret=<the-hex-value>
  ```

- If your plan supports custom headers, prefer sending `x-brevo-secret: <value>`
  and drop the `?secret=` (query strings appear in access logs).

## Verify

```bash
# Wrong/missing secret → 401 (proves the gate works and Access lets it through):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://secure.madagascarhotelags.com/api/emails/webhook -d '{}'
# Expect 401 (NOT the Access login HTML, and NOT 403). 503 = secret not set.

# Correct secret → 200 (empty payload is accepted as a no-op):
curl -s -X POST \
  "https://secure.madagascarhotelags.com/api/emails/webhook?secret=<the-hex-value>" \
  -H 'Content-Type: application/json' -d '[]'
```

Then send a test email from the portal and confirm the ledger row transitions to
`delivered`. If it stays `queued`, re-check steps 1–3 in order.

## Rollback / disable

Remove the Brevo webhook URL (stops events), or delete the Access Bypass policy
(re-blocks at the edge). The endpoint stays fail-closed regardless.

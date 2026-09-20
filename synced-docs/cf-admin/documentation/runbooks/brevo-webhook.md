---

title: "Runbook: Brevo Delivery Webhook"
status: active
audience: [technical, operator]
last_verified: 2026-09-19
verified_against: [code, config, infra, live-mcp]
owner: harshil
related_docs: [../features/EMAIL-PORTAL.md, ../security/SECURITY.md, public-share-links-domain-isolation.md]
tags: [runbook, email, brevo, webhook, cloudflare-access]
---

# Runbook: Brevo Delivery Webhook

> ## 🚩 cf-astro owns the live webhook. cf-admin's endpoint is not in service.
>
> **Verified 2026-09-19.** Brevo currently posts delivery events to
> **cf-astro's `POST /api/webhooks/brevo`**, not to cf-admin's
> `POST /api/emails/webhook`. Two independent confirmations:
>
> - **The edge still blocks cf-admin's path.** An unauthenticated
>   `GET https://secure.madagascarhotelags.com/api/emails/webhook` returns
>   `302` to `mascotas.cloudflareaccess.com` — **step 2 below has never been
>   done**, so Brevo could not reach this Worker even if it were pointed here.
> - **The ledger says so.** Both Workers write the *same* Supabase table
>   `email_audit_logs`, but they append distinguishable shapes: cf-admin writes
>   `{event_type, timestamp, resend_email_id, raw_data}`, cf-astro writes
>   `{event, timestamp, reason}`. Of the delivery events in that table today,
>   **129 across 41 rows are cf-astro-shaped, spanning 2026-07-08 → 2026-09-20**,
>   and **4 across 2 rows are cf-admin-shaped, none later than 2026-06-07** —
>   the Resend era, hence `resend_email_id`.
>
> **Consequence: the old "send a test email and watch the ledger row turn
> `delivered`" check proved nothing.** It passes on cf-astro's traffic whether
> or not cf-admin's endpoint works. Use the shape-specific query in "Verify"
> instead.
>
> **Decision needed (owner):** either retire cf-admin's endpoint and its
> `BREVO_WEBHOOK_SECRET`, or complete steps 2–3 and point Brevo here. Running
> this runbook end to end is the *second* of those choices — do not follow it
> by reflex. Today it documents a path that is configured in code and dead in
> production.

Makes Brevo delivery/bounce/spam events reach cf-admin's
`POST /api/emails/webhook` so the email delivery ledger updates. The endpoint
is authenticated **only** by a shared secret — it is exempt from session + CSRF
(middleware `WEBHOOK_ROUTES`) and must also be exempted from Cloudflare Access
at the edge.

> **TL;DR:** three things must all be true — (1) `BREVO_WEBHOOK_SECRET` is set as
> a Worker secret, (2) a Cloudflare Access **Bypass** policy exists for the
> `/api/emails/webhook` path (**it does not today**), and (3) Brevo posts to the
> URL carrying the secret (**it does not today — it posts to cf-astro**).
> Miss any one and events are dropped: `429` if the IP rate limit trips first,
> then `401` for a wrong or missing secret, `403`/a `302` login redirect at the
> Access layer, or `503` when the secret is unset.

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

The handler accepts the secret in three forms (`src/pages/api/emails/webhook.ts`).
**Prefer a header** — a query string lands in every intermediate access log,
and choosing it means the secret must be rotated if logs are ever shared:

1. `x-brevo-secret: <value>` — **first choice.**
2. `Authorization: Bearer <value>` — equivalent.
3. `?secret=<value>` or `?token=<value>` — **last resort**, only if the Brevo
   plan in use cannot send custom headers on transactional webhooks:

   ```text
   https://secure.madagascarhotelags.com/api/emails/webhook?secret=<the-hex-value>
   ```

## Verify

**Step A — did the request reach this Worker at all?**

```bash
# Wrong/missing secret → 401 (proves the gate works and Access lets it through):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://secure.madagascarhotelags.com/api/emails/webhook -d '{}'
```

Read the code carefully:

| Result | Meaning |
|---|---|
| `401` | ✅ The Access bypass works and the handler rejected the bad secret |
| `302` (to `mascotas.cloudflareaccess.com`) | ❌ **No Access bypass — step 2 is not done.** This is the current state |
| `503` | The Worker secret is not set (step 1) |
| `429` | The per-IP rate limit tripped **before** the secret was checked — expect this under a bounce storm or an Upstash wobble |

```bash
# Correct secret → 200 (empty payload is accepted as a no-op):
curl -s -X POST \
  "https://secure.madagascarhotelags.com/api/emails/webhook" \
  -H 'x-brevo-secret: <the-hex-value>' \
  -H 'Content-Type: application/json' -d '[]'
```

**Step B — which Worker actually recorded the event?** A ledger row turning
`delivered` does **not** answer this: cf-astro writes the same table. Send a
test email from the portal, then group the events by shape:

```sql
-- true  = cf-admin wrote it; false = cf-astro wrote it
SELECT (ev ? 'event_type') AS cf_admin_shaped,
       count(*)            AS events,
       max(ev->>'timestamp') AS newest
FROM email_audit_logs, jsonb_array_elements(delivery_events::jsonb) ev
GROUP BY 1;
```

Success for *this* runbook means the `true` row's `newest` advances. If only the
`false` row moves, Brevo is still posting to cf-astro and steps 2–3 are
incomplete. Baseline to compare against (2026-09-19): `false` → 129 events,
newest `2026-09-20`; `true` → 4 events, newest `2026-06-07`.

## Rollback / disable

Remove the Brevo webhook URL (stops events), or delete the Access Bypass policy
(re-blocks at the edge). The endpoint stays fail-closed regardless.

## Verification log

| Date | Method | Result |
|---|---|---|
| 2026-09-19 | Unauthenticated `GET /api/emails/webhook` from outside the tenant; `src/pages/api/emails/webhook.ts` read; cf-astro `src/pages/api/webhooks/brevo.ts` read; `email_audit_logs` delivery events grouped by shape (Supabase MCP) | `302` to the Access login — **no bypass exists**. 129 cf-astro-shaped events (2026-07-08 → 2026-09-20) vs 4 cf-admin-shaped (none after 2026-06-07). Banner added; the ledger verification replaced with a shape-specific query; the three auth forms reordered to put the header first; `429` added to the failure list; owner changed from `ai-agent` to a human |

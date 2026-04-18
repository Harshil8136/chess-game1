# Runbook — Recovering the 10+ Lost Customer Confirmations

**Prerequisite:** P0 fix from [05-FIX-PLAN.md](./05-FIX-PLAN.md) deployed and verified. Do not attempt recovery before that — re-queuing into a broken consumer just grows the DLQ.

## Scope

Every email queued from **2026-04-17 02:02 UTC** through the moment P0 ships. As of report time, that's:

- **10 rows** on 2026-04-18 in `email_audit_logs`, all `status='failed'`.
- **6 rows** on 2026-04-17 (post-redeploy).
- Total: **16 email attempts** across roughly **8 bookings** (admin + customer per booking).

All 16 are in `madagascar-emails-dlq` (they've exhausted 3 retries) or already persisted in `email_audit_logs` with the original payload preserved in the `payload` jsonb column.

## Strategy

Drive recovery from `email_audit_logs.payload` — the DLQ is a nice-to-have but the database has the authoritative copy of the original queue message. One recovery script, run once.

## Step 1 — confirm P0 is live

```bash
# submit a test booking via the wizard, then:
wrangler tail cf-astro-email-consumer --format=pretty
# expect: [Consumer] Admin email sent for MAD-… and [Consumer] Customer email sent for MAD-…
```

If you still see `EvalError`, stop. Do not proceed.

## Step 2 — identify failed rows

```sql
SELECT id, purpose, recipient_email, payload, created_at
FROM email_audit_logs
WHERE status = 'failed'
  AND created_at >= '2026-04-17'
ORDER BY created_at ASC;
```

Expected: ~16 rows. Save the output. Confirm each row's `payload` has `bookingRef`, `ownerEmail`, `adminEmail`, `pets[]`, etc.

## Step 3 — author a one-off re-queue script

Add a temporary Astro API route, `src/pages/api/admin/requeue-failed.ts`, gated by an auth header. Sketch:

```ts
import type { APIRoute } from 'astro';
import { createDb, getConnectionString } from '../../../lib/db/client';
import { emailAuditLogs } from '../../../lib/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  if (request.headers.get('x-admin-secret') !== env.ADMIN_REQUEUE_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const db = createDb({
    hyperdrive: env.HYPERDRIVE,
    connectionString: getConnectionString(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
  });

  const rows = await db.select().from(emailAuditLogs)
    .where(and(
      eq(emailAuditLogs.status, 'failed'),
      gte(emailAuditLogs.createdAt, new Date('2026-04-17T00:00:00Z')),
    ));

  let requeued = 0;
  for (const row of rows) {
    await env.EMAIL_QUEUE.send({
      trackingId: row.id,
      projectSource: 'cf-astro',
      purpose: row.purpose,
      data: row.payload,
    });
    await db.update(emailAuditLogs)
      .set({ status: 'requeued', updatedAt: new Date() })
      .where(eq(emailAuditLogs.id, row.id));
    requeued++;
  }

  return Response.json({ requeued, ids: rows.map(r => r.id) });
};
```

Set `ADMIN_REQUEUE_SECRET` on `cf-astro` (`wrangler secret put ADMIN_REQUEUE_SECRET --name cf-astro`), then deploy. **Delete this endpoint after recovery is complete** — it's a one-shot tool, not a permanent admin feature.

## Step 4 — trigger recovery

```bash
curl -sS -X POST https://madagascarhotelags.com/api/admin/requeue-failed \
  -H "x-admin-secret: <the secret you set>" \
  | jq .
```

Expected:

```json
{ "requeued": 16, "ids": ["…uuid1…", "…uuid2…", …] }
```

## Step 5 — watch deliveries land

```bash
wrangler tail cf-astro-email-consumer --format=pretty
```

Expect one `[Consumer] Admin email sent` / `[Consumer] Customer email sent` line per requeued row. Resend dashboard (https://resend.com/emails) should show ~16 new deliveries within 1–2 minutes.

SQL spot-check:

```sql
SELECT id, status, resend_id, updated_at
FROM email_audit_logs
WHERE status IN ('requeued', 'sent_to_resend', 'delivered')
  AND updated_at > now() - interval '10 minutes'
ORDER BY updated_at DESC;
```

Every row that was `requeued` should flip to `sent_to_resend` within minutes. If any stay at `requeued` for >5 min, something is still wrong — check `wrangler tail` for new error lines.

## Step 6 — direct apology email to affected customers

The automated confirmation is recovered, but the customer's delay is real. Draft one short Spanish email to the owners whose `created_at` is between 2026-04-17 and now, delivered from `mascotasmadagascar@gmail.com`:

> Hola {firstName},
> Tu solicitud de reservación ({bookingRef}) fue recibida correctamente, pero por un problema técnico el correo de confirmación se retrasó. Ya está resuelto — acabas de recibir (o recibirás en los próximos minutos) el correo con todos los detalles. Nos disculpamos por la demora. Si tienes cualquier duda, responde a este correo o escríbenos por WhatsApp al +52 449 448 5486.

Not automated — a human should hit send. ~5 customers, 5 minutes total.

## Step 7 — clean up

```bash
# delete the temporary endpoint
rm cf-astro/src/pages/api/admin/requeue-failed.ts
# commit, redeploy
wrangler deploy
# rotate the admin secret so the URL can't be replayed
wrangler secret delete ADMIN_REQUEUE_SECRET --name cf-astro
```

Close the loop in the incident tracker: link the Supabase row list from Step 2 as the authoritative "affected customers" list.

## Failure modes to anticipate

| Symptom | Meaning | Response |
|---|---|---|
| `requeued` status never flips | Consumer still broken | Re-check `wrangler tail`; roll back P0 fix if needed |
| `Duplicate email` warning from Resend | Same `Idempotency-Key` reused | OK — Resend dedupes; treat as success |
| Customer reports two confirmation emails | Recovery script ran twice | Acknowledge; it's a cosmetic issue, not a data issue |
| Row stays `failed` with new error text | Different bug | Investigate as new incident |

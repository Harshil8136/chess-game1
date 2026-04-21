{% raw %}
# Prevention — Making This Class of Bug Impossible

The outage wasn't one mistake — it was one mistake (Eta on Workers) that stayed invisible because three layers of safety net were missing. Fix the library issue *and* the safety nets.

## P-1. Correct `cf-astro/RULES.md` §6.5

Replace the Eta-is-fine wording with:

> **§6.5 Templating on Workers.** Cloudflare Workers run in a hardened V8 isolate with `AllowCodeGenerationFromStrings = false`. Any library that calls `eval`, `new Function`, `new AsyncFunction`, or `new GeneratorFunction` at runtime will throw `EvalError: Code generation from strings disallowed for this context`.
>
> **Forbidden in production:**
> - Eta's `renderString`, `render`-of-string, `compile`, `compileAsync`
> - Handlebars' `compile` (use `precompile` at build time instead)
> - Mustache/Hogan `compile`
> - Any `vm.*` API
> - `JSON5.parse` versions that use `new Function`
> - Lodash `_.template`
>
> **Allowed:** plain template-literal functions, pre-compiled templates emitted at build time, React/Preact `renderToString`, MJML *compiled output* (not the runtime compiler).
>
> **When in doubt:** run `wrangler dev` and exercise the code path. If it throws `EvalError`, the library is doing runtime compilation and cannot ship.
>
> **Reference:** `Documentation/14-BOOKING-EMAIL-OUTAGE-2026-04-18/` documents the 2026-04-17 incident caused by violating this rule.

## P-2. Consumer smoke test in CI

Add `cf-email-consumer/test/handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index';

describe('cf-email-consumer queue handler', () => {
  it('renders a booking_admin_notification without throwing', async () => {
    const acks: string[] = [];
    const retries: string[] = [];

    const mockMessage = {
      id: 'test-msg-1',
      body: {
        trackingId: 'tr-1',
        projectSource: 'cf-astro' as const,
        purpose: 'booking_admin_notification' as const,
        data: {
          bookingRef: 'MAD-TEST-0001',
          bookingId: 'b1',
          ownerName: 'Test Owner',
          ownerEmail: 'a@b.com',
          ownerPhone: '+5214494485486',
          service: 'hotel',
          checkInDate: '2026-05-01',
          checkOutDate: '2026-05-03',
          transportType: 'none',
          pets: [{ petName: 'Rex', petType: 'dog', petBreed: 'Lab', petAge: '3' }],
          submittedAt: new Date().toISOString(),
          adminEmail: 'admin@b.com',
        },
      },
      ack: () => acks.push('test-msg-1'),
      retry: () => retries.push('test-msg-1'),
    };

    // fetch → stub a 200 from Resend
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ id: 'rs_test' }), { status: 200 })));

    // db → noop chainable
    vi.mock('../src/db', () => ({
      createDb: () => ({ update: () => ({ set: () => ({ where: async () => {} }) }) }),
      getConnectionString: () => '',
      bookings: {},
      emailAuditLogs: { id: {} },
    }));

    await worker.queue(
      { messages: [mockMessage] } as any,
      {
        RESEND_API_KEY: 'test', SENDER_EMAIL: 'a@b.com',
        HYPERDRIVE: { connectionString: '' },
        PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
      } as any,
    );

    expect(retries).toEqual([]);       // no retries — the render path must succeed
    expect(acks).toEqual(['test-msg-1']);
  });
});
```

Add `"test": "vitest run"` to `cf-email-consumer/package.json` and wire it into the GitHub Actions workflow that builds the consumer. **This single test would have caught the 04-17 regression locally.**

## P-3. Lint rule banning `eval`-family calls

`cf-email-consumer/.eslintrc.cjs`:

```js
module.exports = {
  rules: {
    'no-eval': 'error',
    'no-new-func': 'error',
    'no-implied-eval': 'error',
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'eta', message: 'Eta runtime compilation is forbidden on Workers. Use plain template literals or build-time precompile. See Documentation/14-BOOKING-EMAIL-OUTAGE-2026-04-18/.' },
      ],
    }],
  },
};
```

Apply the same `no-restricted-imports` rule to `cf-astro/` where anything in `src/pages/` or `src/lib/` could end up on the Worker runtime.

## P-4. DLQ depth alert

Cloudflare Dashboard → Notifications → Create → *Workers — Queue backlog*:

- Queue: `madagascar-emails-dlq`
- Condition: `message_count > 0` for `10 minutes`
- Destination: email `harshil.cloud8@gmail.com` and (ideally) Slack/WhatsApp webhook

Rationale: a DLQ message means "we tried 3× and gave up" — always a real failure. If DLQ depth > 0 for more than 10 minutes, something that should be automated is not happening. This alone would have paged oncall within 10 minutes of the 04-17 deploy.

## P-5. "Zero deliveries in 24h" canary

Supabase scheduled query (daily 09:00 UTC):

```sql
SELECT COUNT(*) AS delivered_today
FROM email_audit_logs
WHERE status IN ('sent_to_resend', 'delivered')
  AND created_at > now() - interval '24 hours';
```

If `delivered_today = 0` while `COUNT(*) FROM bookings WHERE created_at > now() - interval '24 hours' > 0`, send an alert email. The combination ("bookings coming in, emails going out = 0") is the exact invariant that was violated for 5 days in this incident.

## P-6. Pre-deploy smoke for the consumer

Add to `cf-email-consumer/package.json`:

```json
{
  "scripts": {
    "predeploy": "vitest run && tsc --noEmit",
    "deploy": "wrangler deploy"
  }
}
```

`npm run deploy` now refuses to ship unless the handler test from P-2 passes. A deploy failure here is strictly better than an undetected production regression.

## P-7. Post-deploy production canary

Immediately after every `wrangler deploy cf-astro-email-consumer`, automatically:

1. Push one synthetic message to `madagascar-emails` with a `trackingId` prefixed `canary-<timestamp>` and `recipient_email = 'canary@madagascarhotelags.com'` (route to a folder that auto-discards).
2. Wait 60s, then query `email_audit_logs WHERE id = 'canary-…'`. Expected: `status='sent_to_resend'`.
3. If not, post a loud failure.

Can be a GitHub Actions step in the deploy workflow. Four extra lines of YAML; same benefit as a full synthetic monitor.

## P-8. Drift check between producer and consumer schemas

The `emailError` drop happened because the producer schema ([`cf-astro/src/lib/db/schema.ts`](../../src/lib/db/schema.ts)) and consumer schema ([`cf-email-consumer/src/db.ts`](../../../cf-email-consumer/src/db.ts)) are separately authored. Add a CI step:

```bash
diff <(tsx scripts/print-schema.ts cf-astro) \
     <(tsx scripts/print-schema.ts cf-email-consumer) \
  | grep -E '^[<>]' && exit 1 || exit 0
```

Any column mismatch for shared tables (`bookings`, `email_audit_logs`, `consent_records`) fails the build.

## P-9. Remove `as any` casts from DB update paths

Ban `as any` in both workers' DB access code via ESLint scoping:

```js
// cf-email-consumer/.eslintrc.cjs
overrides: [{
  files: ['src/**/*.ts'],
  rules: { '@typescript-eslint/no-explicit-any': 'error' },
}],
```

Each `as any` hides a schema mismatch. That's how this outage became invisible. Make future ones loud at compile time.

## Summary — how each layer would have caught this

| Layer | Detection time if in place |
|---|---|
| P-1 (RULES.md fix) | Prevents the deploy entirely |
| P-2 (handler unit test) | Fails `npm test` locally, < 1 minute |
| P-3 (lint) | Fails CI, < 2 minutes |
| P-4 (DLQ alert) | Pages within 10 minutes of deploy |
| P-5 (24h canary) | Fires 24h after last successful delivery |
| P-6 (predeploy) | Blocks the deploy itself |
| P-7 (post-deploy canary) | Fires 60 seconds after deploy |
| P-8 (schema drift) | Fails CI if `emailError` columns diverge |
| P-9 (no-any rule) | Fails CI on the exact cast that hid the bug |

Ship all of these. They are cheap individually, and together they make this *class* of failure non-recurring.

{% endraw %}

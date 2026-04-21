{% raw %}
# Root Cause Analysis — Eta `renderString()` on Cloudflare Workers

## One-line statement

`eta.renderString(template, data)` builds a string of JavaScript source and passes it to `new Function(...)` to compile a render function at runtime. Cloudflare Workers' V8 isolate disallows dynamic code generation, so the constructor throws `EvalError: Code generation from strings disallowed for this context` and the queue message fails.

## The platform rule

Cloudflare Workers run inside a hardened V8 isolate. The isolate is created with `AllowCodeGenerationFromStrings = false`. This means:

- `eval("code")` throws `EvalError`.
- `new Function("...body...")` throws `EvalError`.
- `new AsyncFunction(...)`, `new GeneratorFunction(...)` — same.
- WebAssembly is permitted (precompiled); runtime JS compilation is not.

This is **not a toggle**. It is a platform-level security invariant applied to every Worker script on every plan (Free, Paid, Unbound, Workers for Platforms). There is no `--allow-eval` flag and no `wrangler.toml` key that changes it. The only ways to have "dynamic code" on Workers are:

1. Ship the code pre-compiled (bundled at build time).
2. Use WebAssembly.
3. Use a string-walking interpreter that never synthesises JS.

Eta qualifies for **none of these** in `renderString` mode.

## How Eta's `renderString` works

Eta is a template engine whose compiled output is plain JavaScript. Given a template like:

```eta
<h1><%= it.bookingRef %></h1>
<% for (const p of it.pets) { %>
  <li><%= p.petName %> (<%= p.icon %>)</li>
<% } %>
```

Eta's `compile()` walks the template and produces a source string that looks (conceptually) like:

```js
"let tR = '';" +
"tR += '<h1>' + it.bookingRef + '</h1>';" +
"for (const p of it.pets) {" +
"  tR += '<li>' + p.petName + ' (' + p.icon + ')</li>';" +
"}" +
"return tR;"
```

It then hands that source to `new Function("it", "...source...")`. On Node this returns a callable render function. **On Workers, that `new Function(...)` call is where execution dies.**

`renderString` is the hottest path that always needs this — it receives the template as text and has no precompiled artifact to fall back to. `renderAsync` and `render` helpers end up in the same `compile` path.

## Where it actually throws in our code

[`cf-email-consumer/src/index.ts:213`](../../../cf-email-consumer/src/index.ts#L213):

```ts
const html = eta.renderString(adminBookingTemplate, viewData);
```

and the two sibling calls at lines 253 and 288. All three templates are string constants imported from [`cf-email-consumer/src/templates.ts`](../../../cf-email-consumer/src/templates.ts). When the queue consumer processes a `booking_admin_notification` (or customer, or ARCO) message, control reaches `renderString`, which internally does `new Function(...)`, which throws synchronously.

Because the throw happens **inside the `try` block**, control transfers to the `catch` at `index.ts:310`:

```ts
} catch (err) {
  console.error(`[Consumer] Failed processing ${msg.id} (tracking: ${trackingId}):`, err);
  try {
    await db.update(emailAuditLogs)
      .set({ status: 'failed', emailError: String(err), updatedAt: new Date() } as any)
      .where(eq(emailAuditLogs.id, trackingId));
  } catch (dbErr) {
    console.error('[Consumer] Failed to update audit log on error:', dbErr);
  }
  msg.retry();
}
```

Two things happen here:

1. `console.error(...)` is what surfaced in `wrangler tail` — that's how we captured the `EvalError` text.
2. The DB update silently **drops** `emailError` (see [06-SECONDARY-FINDINGS.md](./06-SECONDARY-FINDINGS.md)) because the consumer's Drizzle schema in [`cf-email-consumer/src/db.ts`](../../../cf-email-consumer/src/db.ts) does not declare an `emailError` column. Drizzle generates SQL containing only the known columns, leaving `email_error` as `NULL` on every failed row.

Net effect: the error is real, loud, and reproducible on every message — but completely invisible in the database. That is why the bug ran silently for 5 days.

## Why the 04-17 redeploy is the trigger

`wrangler versions list` shows version `e0a88e0f` uploaded on **2026-04-17 02:02:16 UTC**. The previous good version was `fec61dee` (2026-04-13 05:31, last successful delivery at 05:33 that same day). Between those two version_uploads, `renderString` was introduced into the hot path — either because:

- The consumer previously used `fetch` to a precompiled Eta or a different templating strategy and was refactored to import `eta` directly, **or**
- `adminBookingTemplate` / `customerBookingTemplate` were converted from JS template literals into Eta string templates, **or**
- Eta was bumped and `renderString` was added anew.

The exact diff is in version control; what matters for the outage is that **any** deploy containing `eta.renderString(...)` on Workers will 100%-fail, and `e0a88e0f` is that deploy. No message has succeeded since.

## Why was RULES.md wrong?

`cf-astro/RULES.md` §6.5 states that Eta is safe on Workers. That is incorrect. The confusion most likely arose because:

- Eta publishes itself as "edge-friendly" in marketing copy (small bundle, no Node dependencies).
- It **does** bundle cleanly and **does** load — the error only appears at render time.
- A pre-compilation mode exists (`eta.compileToString` emits JS text you can bake into your bundle), so Eta technically *can* run on Workers, just not via `renderString`.

The correct rule is: **never call any Eta API whose implementation reaches `new Function` at runtime on Workers.** In practice that forbids `renderString`, `render` of a raw string, `compile`, and `compileAsync`. See [08-PREVENTION.md](./08-PREVENTION.md) for the RULES.md patch.

## Why this didn't surface locally

`wrangler dev` uses `workerd`, which applies the same eval restriction — so a single `wrangler dev` test of the consumer would have reproduced this error immediately. The deploy went out without a local consumer smoke test; the producer (`cf-astro`) was exercised in dev but never the consumer side. Adding a `wrangler dev --test-scheduled`-style smoke on the consumer before deploy would have caught it in seconds. That is also covered in [08-PREVENTION.md](./08-PREVENTION.md).

## Why retries don't help

`msg.retry()` re-enqueues the message up to `max_retries = 3` (per [`cf-email-consumer/wrangler.toml`](../../../cf-email-consumer/wrangler.toml)), after which the message is routed to `madagascar-emails-dlq`. Because the failure is deterministic (the code path is identical on every retry), retries only burn CPU-ms before the message lands in the DLQ. Checking DLQ depth in the Dashboard is a reliable side-channel signal of this kind of systemic failure — see [08-PREVENTION.md](./08-PREVENTION.md) for the alert we should add.

## Confidence and falsifiability

The conclusion is falsifiable in two ways:

1. **Replace `renderString` with a plain template-literal function** and redeploy. If emails start flowing, the hypothesis is confirmed. This is the P0 fix.
2. **Shim `globalThis.Function` with a logger** in a throwaway deploy. Every queue message would log a call-site that includes Eta internals. Not necessary given (1) is both the test and the fix, but it exists if anyone wants independent confirmation.

Given the captured error matches the documented Workers failure mode verbatim, and given the identical pattern (`new Eta(); eta.renderString(...)`) is known to fail on Workers in multiple upstream issues, confidence is **≥95%**.

{% endraw %}

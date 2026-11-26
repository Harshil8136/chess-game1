---
title: "@oltrem/email: using it, settings, templates, sending and failover"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/email.ts, routes.ts, usage.ts, addon.ts]
---

# @oltrem/email: using it, settings, templates, sending and failover

> Part of [the @oltrem/email README](../README.md).

## Using it

```ts
const booked = defineTemplate({
  id: 'bookings.confirmed',
  summary: 'The booking is confirmed',
  schema: z.object({ name: z.string() }),
  subject: (d) => `Booked for ${d.name}`,
  text: (d) => `Hello ${d.name}, the booking is confirmed.`,
  html: (d) => html`<p>Hello ${d.name}</p>`,
});

const email = createEmail<Env>({
  bindings: (env) => ({ db: env.DB }),
  providers: providers.registry,
  templates: [booked],
  from: () => ({ email: 'portal@example.com', name: 'The portal' }),
  outbox: (env) => createOutbox({ db: env.DB, send: (e) => env.EVENTS.send(e) }),
});

await email.send(env, {
  tenantId,
  template: 'bookings.confirmed',
  to: [{ email: 'guest@example.com' }],
  data: { name: 'Ann' },
  messageKey: `booking-${id}-confirmed`,
});
```

Mount `email.module` beside IAM and providers; `@oltrem/core-http`'s queue handler calls its
`onEvent` for `email.send`.

## Settings

All on the system layer, an Owner's to change.

| Name | Default | What it is |
| --- | --- | --- |
| `email.from_address` | empty | The address messages come from. Empty: the company's everyday sender (Email settings, Addresses); with neither, a message fails as `from: there is no address to send from yet` |
| `email.from_name` | empty | The name they come from; the client's name while empty |
| `email.undo_seconds` | 10 | How long a sent email waits so Undo can take it back, 5 to 30 (the `undoSeconds` option) |

## Templates

A template is code: an id `<module>.<name>`, a summary, a data schema (checked before rendering,
`KIT-E-1505` with each field), a subject, a text body, an optional HTML body and optional headers
(a bulk message's `List-Unsubscribe`). The `html` tag escapes every value that is not itself
`html`, so typed text never becomes markup.

Each message goes to the provider tagged with its template (`bookings-confirmed`). Everything but
bulk mail goes with `tracking: false`, and providers that can (Postmark, SendGrid, Mailgun,
Mailjet) are asked not to track opens and clicks, since tracking is what Gmail reads as marketing.
Bulk mail is tagged with the campaign's name and marked bulk. The module's own template is
`email.canary`, the canary route's test message.

## Sending, the lease and failover

| Step | What happens |
| --- | --- |
| `send` | Renders, checks the message (addresses, header lines, 1 to 50 in To, 50 in all with `cc` and `bcc`, none twice) and queues it through the outbox under its message key, so a key asked twice is queued once |
| A reply | `thread: { inReplyTo, references }` sets `In-Reply-To` and `References`; each id one `<...>` on one line (`KIT-E-0422`), the newest 20 kept (`THREAD_IDS`) |
| History | Every message's row is kept (no text): it lists late spam reports and unsubscribes, stops a second send under a key, and is Sent's delivery line. `email.outbox` removes finished outbox rows after 7 days (`OUTBOX_DONE_DAYS`), 2,000 a run (`OUTBOX_PRUNE_RUN`) |
| No route ready | The outbox row is held (`outbox.hold`) and the message says `waiting`; `email.release` (every 5 minutes while one is held, else hourly) sends them once a provider is ready. A provider that went away after queuing does the same |
| Replays | The same job replays 10 outbox rows a run (`REPLAY_ROWS`): released rows, rows the queue refused (again after 1, 5, 30 and 120 minutes) and unconfirmed rows. Five refusals or eight unconfirmed sends (about two days) make a row `dead`, reported |
| The lease | `deliver` takes one row per key (new, waiting, retrying, or a lapsed two-minute lease); `sent` or `failed` is acknowledged without a send; one held by another delivery is `KIT-E-1502` and comes back |
| Route order | An add-on's route first when it takes the message (Mail's Cloudflare route), then the active instance, then failovers by order. For everyday mail, an instance at its last tenth of an allowance (`src/usage.ts`, no call made) moves behind the others, and one whose provider always tracks (`alwaysTracks`: Brevo, Sender) behind one that can send untracked. Bulk keeps the order. The route that took it is kept (`instance_id`, or `cloudflare`) |
| Each answer | Sorted in `src/routes.ts`: the message is wrong or the receiver refused (fails now); the route may not carry it, is not set up, is too fast or out of allowance (next route); or no clear answer (a timeout, a broken connection, 500, 502, 504) |
| No clear answer | It may have been sent, so the row is pinned (`pinned_route`) and never sent elsewhere (M-1). A route that knows the key (`keyed`: an idempotency header, as Resend; or `repeatable`) is retried there only, up to 6 tries (`PINNED_TRIES`). One that does not (Brevo, most others, Cloudflare) fails at once as **May have been sent**, naming the route and saying to ask the recipient. A 503 means not taken, so it fails over. The route is written before the call, so a delivery cut short after the provider's yes is never sent through another |
| Taken | Written outside the route's own `try`, three tries, so a database failure never reads as the route failing; a last failure is reported with the key |
| Refused | The next route tries; all refusing for now is `retrying` (`KIT-E-1504`, back to the queue), ending after 30 deliveries (`MAX_TRIES`, about 17 hours). All refusing the account (401, 403) or the message (4xx) fails at once |
| Never sendable | An unknown template, stale data, an address refused as such: `failed`, acknowledged |

The subject and body are never stored; the row keeps the addresses. An address on the do-not-mail
list is taken off its list (a copy is never moved up to To), so with no To left nothing is sent.

### An add-on's route

`createEmail({ route: () => taker })` takes a `RouteTaker` (`src/addon.ts`): `take(env, tenantId,
message, { bulk, own })` answers a `SendRoute` (id, label, `send()`, `failure(error)` sorting its
own answers, `repeatable`) or null. Its optional `records(env, actor, domain, wanted)` writes a
sending domain's missing DNS records where it can and answers each in words. Read on every
message, so a client builds email first. `MailAddonDeps`, `MailAddon` and `MailAddonFactory` are
the wiring types ([kit contract](../../../docs/kit-contract.md)); the add-on's `receive` is the
Worker's `email` handler, given `bucket` and `worker`.

`email.write(env, actor, input)` is `POST /write` as a function, with the same checks, Undo and
Sent; the inbox replies through it with a `thread` (refused with `later`).

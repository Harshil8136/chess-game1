---
title: "@oltrem/email: Using it; Settings; Templates; Sending, the lease and failover"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Using it; Settings; Templates; Sending, the lease and failover

> Part of [the @oltrem/email README](../README.md).

## Using it

```ts
import { createOutbox } from '@oltrem/core-outbox';
import { createEmail, defineTemplate, html } from '@oltrem/email';
import * as z from 'zod/mini';

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

Mount `email.module` beside the IAM and providers modules; the queue handler of
`@oltrem/core-http` calls its `onEvent` for `email.send`. `from` is the client's; the client
template reads the two settings below.

## Settings

| Name | Layer, editor | What it is |
|---|---|---|
| `email.from_address` | system, an Owner; empty by default | the address the portal's messages come from, one the active provider may send from; while it is empty they come from the company's sender address for everyday mail (Email settings, Addresses; since 2026-10-30), and with neither a message fails as `from: there is no address to send from yet` and is never sent |
| `email.from_name` | system, an Owner; empty by default | the name they come from; the client template uses the client's name while it is empty |
| `email.undo_seconds` | system, an Owner; 10 by default | how long a sent email waits before it leaves, so Undo can take it back: 5 to 30 seconds, as Gmail offers; the client hands it in the `undoSeconds` option, and any other value, or none, is the 10 seconds |

The client file sets both at onboarding (`settings` in `oltrem.config.ts`); an Owner may change
them live once the Settings page exists.

## Templates

A template is code, compiled with the Worker: an id `<module>.<name>`, a line saying what it is
for, the schema of its data, and a subject, a text body and an optional HTML body. The data is
checked against the schema before anything is rendered (`KIT-E-1505`, with each field). A template may also add headers, such as a bulk message's
`List-Unsubscribe` (`@oltrem/campaigns`); they are checked like the rest of the message. The HTML
is written with the `html` tag, which escapes every value it is given unless the value is itself
`html`, so a name a guest typed never becomes markup. Prettier formats an `html` template as
HTML, which changes only the whitespace between elements.

Every message names its template to the provider as a tag (`bookings.confirmed` becomes
`bookings-confirmed`), so the provider's own reports group the messages by kind. Every message that
is not bulk mail (Write, replies, automated notices) goes with `tracking: false`, and each provider
that can (Postmark, SendGrid, Mailgun, Mailjet) is asked not to track its opens and clicks: an open
pixel and links sent through the provider's own address are what Gmail reads as marketing and files
under Promotions. A bulk template whose links sign someone in sets `tracking: false` itself. Bulk
mail is tagged with the campaign's name (`bulk.send`'s `tag`) and marked as bulk, so a provider with
a separate way for it uses that way (`@oltrem/providers`, "Each provider's own features").

The module adds one template of its own, `email.canary`, the test message the canary route sends.

## Sending, the lease and failover

| Step | What happens |
|---|---|
| `send` | The template is found and rendered, the message checked (addresses, header lines, one to fifty recipients in To, with `cc` and `bcc` fifty in all and none named twice) and queued through the outbox under its message key; the caller's own key makes a message asked for twice queued once |
| A reply | `thread: { inReplyTo, references }` puts `In-Reply-To` and `References` on the message (RFC 5322), on every route; each id must be one `<...>` on one line (`KIT-E-0422` otherwise), repeats are dropped and the newest 20 kept (`THREAD_IDS`) |
| History kept | Every message's row is kept: it holds no text, and it is what lists a spam report or an unsubscribe that arrives months later (`email_donotmail`), what stops a second send under the same key, and what Sent shows as the delivery line. The `email.outbox` job removes the outbox's finished sends after 7 days (`OUTBOX_DONE_DAYS`), at most 2,000 a run (`OUTBOX_PRUNE_RUN`), hourly while more wait and daily once none do: only a receipt, since a key asked for again is answered as a duplicate from the message's own row |
| No instance ready | The outbox row is held and the message's row says `waiting`; the job `email.release`, every five minutes while a message is held, releases the held messages once a tenant that waits has an active or failover instance, and sends them. With none held it sleeps (an hour a run), and holding a message wakes it |
| What did not land | The same job replays the outbox, ten rows a run (`REPLAY_ROWS`), since nothing else does: a released row, a row the queue refused (it wakes the job for a minute later, and the outbox tries again after 1, 5, 30 and 120 minutes), and a row no delivery confirmed, an hour later and then further apart. A row the queue refused five times, or that no delivery confirmed in eight sends (about two days), is `dead` and reported, so nothing is sent for ever |
| The provider went away | A message queued while a provider was ready, whose delivery then finds no route: the row says `waiting` again and its outbox row is held (`outbox.hold`), as if it had been queued with none, and the job sends it once a provider is ready. Until 2026-11-17 the delivery threw instead, the queue brought the message back five more times to the same answer, and nothing sent it afterwards |
| `deliver` takes the lease | One row per message key: a new key, or one that waits, retries or whose two-minute lease ran out, is taken; a `sent` or `failed` one is acknowledged without a send; one another delivery holds is `KIT-E-1502`, and the queue brings it back |
| The routes in order | An add-on's route first when it takes the message (Oltrem Mail's Cloudflare route, handed in as the `route` option; see below), then the active instance, then each failover by its order. For everyday mail (not bulk), an instance down to its last tenth of an allowance, or out, by what its provider last said (`low` in `src/usage.ts`, no call made), moves behind the others, so a password reset never meets a full allowance; among those with room, an instance whose provider tracks every message and cannot stop (`alwaysTracks` in `@oltrem/providers`: Brevo, Sender) goes behind one that can send it untracked, so everyday mail reaches Gmail's Primary tab rather than Promotions, and stays the backup; bulk mail keeps the order, since its engine paces itself on what is left; the first that takes the message is kept on the row (`instance_id`, `cloudflare` for that route) with the id it gave it. A message held for want of an instance is held only when no add-on route takes it either |
| Each answer, sorted | Every route's answer goes into one list (`src/routes.ts`): the message is wrong (fails now), the receiving server refused it (fails now), the route may not carry it, is not set up, is too fast for now or has used its allowance (the next route tries), or there was no clear answer: a timeout, a broken connection, a 500, 502 or 504 |
| No clear answer | The route may have sent it, so the row is pinned to that route (`pinned_route`, migration `1000`) and it is never sent through another (mail law M-1). What happens next depends on whether the route knows the message's key (`keyed`, `src/routes.ts`: the provider's definition sends it as an idempotency header, as Resend's does, or an add-on route says `repeatable`). One that does says `retrying`, and every retry goes to that route only, where a repeat under the same key sends nothing new. One that does not (Brevo and every other provider, and Cloudflare's route) is not asked again: the message fails at once with words that begin "May have been sent", naming the route and saying to ask the recipient whether it arrived, and the Sent page shows it as **May have been sent**, not Failed. Before, such a route was asked up to six times, and a customer could get up to six copies. A 503 says the provider did not take it in, so it fails over. A pinned route that can no longer send (removed, disabled) fails the message, saying it was not sent again elsewhere and to ask the recipient whether it arrived. The route about to be called is written on the row before the call, so a delivery cut short after the provider's yes (the CPU limit, a database that cannot be written) is asked again only there too, not through whichever route comes first; on a route that knows no key it is not asked again at all and fails as "May have been sent" |
| An end to the tries | A message is asked on a route that knows its key, and may have sent it, six times in all (`PINNED_TRIES`, the queue's own six deliveries), then fails saying no clear answer came and to ask the recipient whether it arrived; one every route refused for now fails once thirty deliveries have ended that way (`MAX_TRIES`: five rounds of the queue's six in the first five hours, so at the sixth round, some seventeen hours after it was queued), with the last answer. Without an end the outbox, which sends an unconfirmed message again for two days, would ask that route again each round |
| A route took it | That is written down outside the route's own `try` (`accepted`, 2026-11-17): a database that fails just then never reads as the route failing, so the message does not go again through the next one (M-1). The write is tried three times; if it still fails it is reported with the message key, and the delivery ends with the row still marked with that route. |
| A refusal | The next route is tried; when every one refused, the row says `retrying` with what each said, and `KIT-E-1504` sends the message back to the queue. When every one refused the account itself (401 or 403: a wrong key, an account not activated or suspended), a retry would get the same answer, so the row says `failed` at once with what each said, and the queue is not asked again. The same holds when every route refused the message itself with a 4xx (an address the provider will not mail, such as Resend's 422 for `example.com`), or some refused the account and the rest the message |
| A message that can never be sent | An unknown template, data that no longer matches, an address a provider refuses as such: the row says `failed` and the message is acknowledged |

The subject and the body are never stored; the row keeps the addresses (To, then Cc and Bcc), for
the screens and the delivery reports. An address on the do-not-mail list is taken off whichever
list it is on; a copy is never moved up to To, so with no To left the message is not sent.

### An add-on's route

`createEmail({ route: () => taker })` takes a `RouteTaker` (`src/addon.ts`): for each message,
`take(env, tenantId, message, { bulk, own })` answers a `SendRoute` (an id, a label, `send()`,
`failure(error)` that sorts its own answers into the list, and `repeatable` when the route knows
the message's key, so an unclear answer may be asked again there) or null to leave it to the
providers.
Its optional `records(env, actor, domain, wanted)` writes a sending domain's missing DNS records
where the add-on can (Oltrem Mail, on Cloudflare) and answers each in words, or null when it
cannot there; the provider card calls it. It is read on every message, so a client builds email first and the add-on after. A client
without Oltrem Mail hands in nothing, and sending is as before. `MailAddonDeps`, `MailAddon` and
`MailAddonFactory` are the types the client wires `@oltrem/mail` with (docs/kit-contract.md);
the add-on's `receive` is the client Worker's `email` handler, and `bucket` and `worker` give it
the portal's bucket and the Worker's own name for the inbox.

`email.write(env, actor, input)` is the `POST /write` route as a function, with the same checks,
Undo and Sent page: the inbox replies through it, with a `thread` (refused together with `later`,
since a reply goes now).

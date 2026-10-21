# @oltrem/email

Email as the kit sends it (plan sections 8.1 and 8.2). A message is asked for once, rendered
from a typed template and checked at once, so a mistake is the caller's answer and never a
failed send later. The outbox and the queue carry it to `deliver`, which sends it through the
tenant's active email instance from `@oltrem/providers` and, when that one refuses, through each
failover in order. The kit keeps its own lease per message key in D1, so a message the queue
brings twice is sent once whatever the provider promises.

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
| `email.from_address` | system, an Owner; empty by default | the address the portal's messages come from, one the active provider may send from; a message composed while it is empty fails as `from: not an email address` and is never sent |
| `email.from_name` | system, an Owner; empty by default | the name they come from; the client template uses the client's name while it is empty |

The client file sets both at onboarding (`settings` in `oltrem.config.ts`); an Owner may change
them live once the Settings page exists.

## Templates

A template is code, compiled with the Worker: an id `<module>.<name>`, a line saying what it is
for, the schema of its data, and a subject, a text body and an optional HTML body. The data is
checked against the schema before anything is rendered (`KIT-E-1505`, with each field). The HTML
is written with the `html` tag, which escapes every value it is given unless the value is itself
`html`, so a name a guest typed never becomes markup. Prettier formats an `html` template as
HTML, which changes only the whitespace between elements.

The module adds one template of its own, `email.canary`, the test message the canary route sends.

## Sending, the lease and failover

| Step | What happens |
|---|---|
| `send` | The template is found and rendered, the message checked (addresses, header lines, one to fifty recipients) and queued through the outbox under its message key; the caller's own key makes a message asked for twice queued once |
| No instance ready | The outbox row is held and the message's row says `waiting`; the job `email.release`, every five minutes, releases the held messages once a tenant that waits has an active or failover instance |
| `deliver` takes the lease | One row per message key: a new key, or one that waits, retries or whose two-minute lease ran out, is taken; a `sent` or `failed` one is acknowledged without a send; one another delivery holds is `KIT-E-1502`, and the queue brings it back |
| The instances in order | The active instance, then each failover by its order; the first that takes the message is kept on the row with the id the provider gave it |
| A refusal | The next instance is tried; when every one refused, the row says `retrying` with what each said, and `KIT-E-1504` sends the message back to the queue |
| A message that can never be sent | An unknown template, data that no longer matches, an address a provider refuses as such: the row says `failed` and the message is acknowledged |

The subject and the body are never stored; the row keeps the addresses, for the screens and the
delivery reports.

## Routes

Under `/api/email`, through the IAM module's sessions and check. `email.manage` asks for a fresh
sign-in.

| Route | Capability | What it does |
|---|---|---|
| `GET /messages?status=` | `email.read` | The tenant's newest fifty messages: to whom, through which instance, what became of each |
| `GET /instances/:id/hook` | `email.manage` | The address to paste into the provider's dashboard for its delivery reports; it carries the instance's secret token, so reading it is audited as `email.hook` |
| `POST /canary` | `email.manage` | A test message through one instance (`instanceId`) to the signed-in person's own address, before it is made the one that sends; the result is kept on the instance as its last probe, and the canary is audited as `email.canary` |
| `GET /home` | `email.read` | The Home card: the messages of the last 24 hours, how many were sent, wait and failed |

## Delivery reports

Each email instance has a public address, `POST /hooks/email/<instance>/<token>`, which the
client's Access door lets through. The token is made when the instance's key is first pasted,
sealed with it, and kept when a key is pasted again, so the address the provider was given stays
valid. A report is checked twice: the token against the instance's, in constant time, then the
provider's own signature (`@oltrem/providers`); Brevo signs nothing, so its token is its only
guard. An SNS subscription is confirmed at the AWS address the verified message names. Each event
is then kept on its message, sent through that instance, as `last_event` with its time, unless a
later event is already there; SendGrid's ids, which add a suffix after a dot, are matched by
prefix. A repeated report changes nothing, and an event the provider's map does not name is
counted as ignored.

| Answer | When |
|---|---|
| 200 `{ recorded, ignored }` | the report was checked; `recorded` events were kept |
| 200 `{ subscribed: true }` | an SNS subscription was confirmed |
| 401 `KIT-E-1409` | the token or the signature does not match, or the instance's signing field is not set |
| 404 `KIT-E-0404` | no email instance has that id |

## Health

`email.sending`, in the `email` lane: **fail** while a message of the last day waits for a retry
after every provider refused it, **warn** while one waits for an email provider, **ok** otherwise.
Two failures in a row open a problem (`@oltrem/core-health`).

## Not here yet

- Suppression of an address that bounced or complained comes with the screens; the reports are
  kept on the messages until then.
- The generated Modules page of a client lists routes, not public hooks.
- Suppression and a daily cap come with the screens.

## The table and the error codes

`email_messages` (migration `0011_email.sql`): the message key, the tenant, the template, the
addresses, the status (`leased`, `sent`, `retrying`, `waiting`, `failed`), the attempts, the
lease, the instance, the provider's id, the last error and the last delivery event.

| Code | Name | Status | When |
|---|---|---|---|
| `KIT-E-1501` | `NO_PROVIDER` | 503 | the tenant has no active or failover email instance |
| `KIT-E-1502` | `LEASED` | 409 | another delivery of the message holds its lease |
| `KIT-E-1503` | `UNKNOWN_TEMPLATE` | 422 | no template the Worker was built with has that id |
| `KIT-E-1504` | `ALL_FAILED` | 502 | the active instance and every failover refused the message |
| `KIT-E-1505` | `BAD_TEMPLATE_DATA` | 422 | the data does not match the template's schema |

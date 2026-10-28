# @oltrem/email

Email as the kit sends it (plan sections 8.1 and 8.2). A message is asked for once, rendered
from a typed template and checked at once, so a mistake is the caller's answer and never a
failed send later. The outbox and the queue carry it to `deliver`, which sends it through the
tenant's active email instance from `@oltrem/providers` and, when that one refuses, through each
failover in order. The kit keeps its own lease per message key in D1, so a message the queue
brings twice is sent once whatever the provider promises. The company's sending domains and the
sender addresses on them live here too: who may send from which address, and whether a domain
is set up well enough for bulk mail; and the company's saved templates, the designs bulk mail is
written with.

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
checked against the schema before anything is rendered (`KIT-E-1505`, with each field). A template may also add headers, such as a bulk message's
`List-Unsubscribe` (`@oltrem/campaigns`); they are checked like the rest of the message. The HTML
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

## Senders and sending domains

A message names the address it comes from with `senderId`; without one it comes from the
`from` the client hands in (the two settings above). Bulk mail, such as a campaign, always names
one.

| Part | What it does |
|---|---|
| A sending domain | Added by someone who holds `email.senders.manage` for the whole company, with the email instance it sends through. Where the provider's definition has a `domains` block (Resend and Brevo, `@oltrem/providers`), the portal adds the domain there and shows the DNS records the provider asks for, each with a Copy button |
| The check | Live from the page and once a day after (the job `email.domains`, hourly, four domains a run). One line per finding, in plain words: the provider says the domain is verified; each of its records is found in public DNS (DKIM by its key, SPF by its `include`); the domain publishes a DMARC record, which Gmail, Yahoo and Microsoft require of bulk senders; it has one SPF record, not two. A provider or DNS that does not answer leaves the state as it was and says so |
| Passing | The provider verified the domain and it publishes DMARC, with no broken SPF. Where the portal cannot ask the provider (no `domains` block, or a key that may only send, which Resend refuses with 401), a person confirms the dashboard shows it verified, and the confirmation is audited |
| A sender address | An address on an added domain, the name people see, an optional reply-to, the place of the company whose `email.senders.use` holders may send from it, and what it is for: bulk, everyday or both. The first address of a domain for each kind becomes its default; a default is changed, never left empty while the domain has addresses |
| A send | `compose` reads the sender: one that was removed, or is for the other kind of mail, refuses the message (`KIT-E-1508`); bulk mail asked for from a domain that does not pass is refused the same way, before it is queued |

Every change is audited: `email.domain-add`, `email.domain-check`, `email.domain-confirm`,
`email.domain-remove`, `email.sender-add`, `email.sender-update`, `email.sender-remove`,
`email.sender-default`.

The page is Messages, Senders (`/email/senders`, from `@oltrem/email/pages`): the sender
addresses, and the domains with their check lines and records.

## Saved templates

The designs bulk mail is written with, kept in D1 as the company's (stage 3 of the bulk sending
plan, `docs/records/2026-10-28-saved-templates.md`). They are not the typed templates above,
which are code; a saved template is data a person builds on the page Messages, Templates
(`/email/templates`).

| Part | What it does |
|---|---|
| Blocks | A heading, text (a blank line starts a paragraph, an https address becomes a link), a button, an image with its description and an optional link, a divider, a space; at most 40. `renderDesign` puts them together as table HTML a mail app shows well on a phone and in dark mode (`color-scheme`, a dark palette by media query), with a hidden preview line and the footer bulk mail carries, and the same message as plain text. Every value is escaped; links are https, mailto or tel, images https |
| Pasted HTML | Only for someone who also holds `email.templates.html`. `sanitizeEmailHtml` cleans it with HTMLRewriter before it is saved: a script, frame, form, SVG and the like go with their content, an unknown tag goes and keeps its words, an attribute not on the list and every `on...` handler go, a link must be https, mailto, tel, `#` or a merge field, an image https or a small inline picture, a style that loads or runs something goes. What was taken out is kept on the template, in words, and shown on its page |
| Merge fields | `{{first_name}}`, or `{{first_name|there}}` with words for an empty value, in the subject, the preview line and every block; a person's value is escaped before it goes into pasted HTML. The lists and merge fields are read by `readList` and `merge` (`src/people.ts`, moved here from `@oltrem/campaigns`, which re-exports them) |
| The checks | Every view of a template carries them, filled with sample values: the subject is set and not all capitals, a preview line, words in the message, its size under the 100 KB Gmail cuts at, no http links, every button and image address whole and https, every image described. A line is `pass`, `warn` (worth a look) or `fail` (must be fixed before it goes to many people) |
| Versions | Each save that changes the content is a version (the newest 30 are kept). Saves by the same person within ten minutes of a version not yet tested change that version, so moving a block does not bury the history. An older version can be previewed and brought back, as a new version. A save carries the version it was made to; one over a newer version is refused (`KIT-E-1509`) rather than undoing someone's work |
| The preview | `GET /templates/:id/preview` answers the message as a page of its own, under a policy that runs nothing and loads only https images (`default-src 'none'; ...; sandbox`); the page frames it with `sandbox` as a phone, a desktop or a mail app in dark mode shows it |
| The test | Sent at once, not through the queue, to the signed-in person's own address, from their default bulk sender when they have one, through the active instance and then each failover. It is kept as a message (`email.template-test`), so its delivery reports arrive like any other; a refusal is the answer and the message's row says `failed` with what each provider said. The version is then marked as tested; the next change makes a new, untested version |
| Archive | A template is archived, never deleted, so a send that used it can still show it; it can be brought back |

`createEmail(...).templates.design` hands a template's current or named version to
a send. Every change is audited: `email.template-add`, `email.template-save`,
`email.template-copy`, `email.template-archive`, `email.template-restore`,
`email.template-revert`, `email.template-test`.

## Routes

Under `/api/email`, through the IAM module's sessions and check. `email.manage` and
`email.senders.manage` ask for a fresh sign-in. The templates' capabilities are held at the
company itself: `email.templates.read` to see and preview, `email.templates.write` to build from
blocks and send oneself a test, `email.templates.html` as well to paste HTML or change a pasted
body.

| Route | Capability | What it does |
|---|---|---|
| `GET /messages?status=` | `email.read` | The tenant's newest fifty messages: to whom, through which instance, what became of each |
| `GET /instances/:id/hook` | `email.manage` | The address to paste into the provider's dashboard for its delivery reports; it carries the instance's secret token, so reading it is audited as `email.hook` |
| `POST /canary` | `email.manage` | A test message through one instance (`instanceId`) to the signed-in person's own address, before it is made the one that sends; the result is kept on the instance as its last probe, and the canary is audited as `email.canary` |
| `GET /home` | `email.read` | The Home card: the messages of the last 24 hours, how many were sent, wait and failed |
| `GET /domains` | `email.senders.manage` | The sending domains with their records, check lines and defaults |
| `POST /domains` | `email.senders.manage` | Add a domain (`domain`, `instanceId`), through the provider where it can, and check it |
| `POST /domains/:domain/check` | `email.senders.manage` | Ask the provider to look again, then check the provider and DNS now |
| `POST /domains/:domain/confirm` | `email.senders.manage` | A person confirms the provider's dashboard shows the domain verified |
| `POST /domains/:domain/default` | `email.senders.manage` | Make an address the domain's default for bulk or everyday mail (`use`, `senderId`) |
| `DELETE /domains/:domain` | `email.senders.manage` | Remove a domain that has no sender address |
| `GET /senders` | `email.senders.manage` | Every sender address, with its domain's state and the defaults it holds |
| `GET /senders/places` | `email.senders.manage` | The places where the person may add a sender address, the company first |
| `GET /senders/usable?use=` | `email.senders.use` | The addresses the person may send bulk or everyday mail from, the defaults first; bulk only from a passing domain |
| `POST /senders` | `email.senders.manage` | Add an address (`email`, `name`, `replyTo`, `scopeId`, `purpose`) |
| `PATCH /senders/:id` | `email.senders.manage` | Change its name, reply-to, place or purpose |
| `DELETE /senders/:id` | `email.senders.manage` | Remove it; a default goes last |
| `GET /templates?archived=` | `email.templates.read` | The saved templates, the newest change first, and whether the person may build and paste |
| `POST /templates` | `email.templates.write` | A new template (`name`, `kind` `blocks` or `html`); blocks start with three to change |
| `GET /templates/:id?version=` | `email.templates.read` | The template with its checks, merge fields and versions; an older version when one is named |
| `PATCH /templates/:id` | `email.templates.write` | Save `name`, `subject`, `preheader`, `accent`, `blocks` or `html`, with the `version` edited |
| `POST /templates/:id/copy` | `email.templates.write` | A copy, as a new template |
| `POST /templates/:id/archive` | `email.templates.write` | Archive it (`archived` true) or bring it back |
| `POST /templates/:id/revert` | `email.templates.write` | Make an older `version` the current one again |
| `GET /templates/:id/preview?version=&dark=` | `email.templates.read` | The message filled with sample values, as its own page under a policy that runs nothing |
| `POST /templates/:id/test` | `email.templates.write` | Send it to oneself at once; the version is marked as tested |

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

Each report also lands on its message as one write, read in two kinds:

- **The outcome:** delivered, deferred, bounced or refused by the provider, with its time, the
  provider's words (`reason`) and, for a bounce or a refusal, whether it is for good
  (`permanent` 1) or for now (0, or unknown). An outcome for good is never replaced, so a late
  "delayed" cannot hide a bounce.
- **The first times:** the first open by a person, the first open by a machine (Apple's privacy
  proxy opens every image, so Brevo's `proxy_open` is counted apart and never as a reader), the
  first click, the spam report and the unsubscribe. A later report of the same kind changes
  nothing.

Each message keeps its milestones rather than a row per event, so a send of thousands stays well
inside the free plan's daily writes.

## The do-not-mail list

`email_donotmail` is the company's list of addresses never to mail, kept in lower case, one row
an address. `deliver` reads it before every send:

| Reason | What it stops | Put there by |
|---|---|---|
| `bounced` | every message | a bounce for good, or three temporary bounces within 30 days (`email_softbounces` counts them) |
| `refused` | every message | the provider refusing the address for good (Resend's suppressed, Brevo's blocked or invalid) |
| `complained` | every message | a spam report |
| `unsubscribed` | bulk mail only | the person's unsubscribe; a password reset still arrives |
| `manual` | bulk mail only | a person in the portal (`@oltrem/campaigns`) |

An address that unsubscribed and then reports spam moves from bulk only to every message. A
message whose every address is on the list fails at once with the reason, never in silence; one
with some barred sends to the rest and keeps the note in `last_error`. A caller marks bulk mail
with `bulk: true` on `send`.

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

`email.domains`: **warn** while a sending domain that passed its check fails it now, naming the
domain and what is wrong; **ok** otherwise.

## Personal data

For a privacy request (`personal`, read by the privacy module) the module answers each message
sent to the address: its template, its state, the last delivery event, its outcome, its first
open, click, spam report and unsubscribe, and when it was sent; and the address's row on the
do-not-mail list, with its reason, when there is one. The text of a message is not kept, so it
is not in the answer. The Email page is linked.

## Not here yet

- A screen of the do-not-mail list in this module, saved lists and a daily cap come with the
  later bulk sending stages (docs/records/2026-10-28-senders-and-domains.md); until then the
  list is seen and changed on the Campaigns pages. A campaign is written with its own subject
  and text until the sending engine of stage 5 lets it pick a saved template.
- The domain calls are written from Resend's and Brevo's API references and tested against
  their documented answers, not yet against live accounts. Resend's sending-only keys cannot
  read domains, so with one the domain is confirmed by hand; the instance's own probe (`GET
  /domains`) may also refuse such a key.
- The generated Modules page of a client lists routes, not public hooks.

## The tables and the error codes

`email_messages` (migration `0011_email.sql`): the message key, the tenant, the template, the
addresses, the status (`leased`, `sent`, `retrying`, `waiting`, `failed`), the attempts, the
lease, the instance, the provider's id, the last error and the last delivery event; migration
`0043_email_outcomes.sql` adds the outcome, its time, whether it is for good and the provider's
words, and the first open by a person and by a machine, click, spam report and unsubscribe. The
same migration makes `email_donotmail` (the address, what it stops, the reason, the message that
put it there, who and when) and `email_softbounces` (temporary bounces per address and their
window). Migration `0045_email_senders.sql` makes `email_domains` (the domain, its instance and
the provider's id for it, the records and check lines as JSON, the state `new`, `failing` or
`passing`, who confirmed it, when it was checked and first passed, and its two default
addresses) and `email_senders` (the address, its name and reply-to, its place, its purpose and
its domain). Migration `0047_email_templates.sql` makes `email_templates` (the name, the kind,
the current version's subject, preview line, accent and body, the blocks as JSON or the cleaned
HTML, what the last cleaning took out, the version last tested, by whom and when, and when it was
archived) and `email_template_versions` (each version's content, by whom and when).

| Code | Name | Status | When |
|---|---|---|---|
| `KIT-E-1501` | `NO_PROVIDER` | 503 | the tenant has no active or failover email instance |
| `KIT-E-1502` | `LEASED` | 409 | another delivery of the message holds its lease |
| `KIT-E-1503` | `UNKNOWN_TEMPLATE` | 422 | no template the Worker was built with has that id |
| `KIT-E-1504` | `ALL_FAILED` | 502 | the active instance and every failover refused the message |
| `KIT-E-1505` | `BAD_TEMPLATE_DATA` | 422 | the data does not match the template's schema |
| `KIT-E-1506` | `IN_USE` | 409 | a domain with addresses, or a default address while others remain, is removed or narrowed |
| `KIT-E-1507` | `ALREADY_ADDED` | 409 | the domain or the address is there already |
| `KIT-E-1508` | `SENDER_NOT_READY` | 422 | the sender was removed, is for the other kind of mail, or its domain does not pass for bulk mail |
| `KIT-E-1509` | `CHANGED_SINCE` | 409 | a template was saved again after the version the change was made to |

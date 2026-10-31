# @oltrem/providers

Providers as data (plan section 8): the outside services a client Worker uses are rows, not
adapters. A **definition** says how one kind of provider is spoken to: its transport, auth
scheme, send template, probe, webhook field map, DNS fingerprint, the fields a person pastes and
the key recipe. An **instance** is one provider a tenant has set up from a definition, with its
credential sealed to its own row (`@oltrem/core-crypto`), its place in the failover order and
what the probe last saw. The kit ships its definitions in code; a client's own, or its changes to
the kit's, are rows a screen can edit with no deploy.

## Using it

```ts
import { createApp } from '@oltrem/core-http';
import { createIam } from '@oltrem/iam';
import { createProviders } from '@oltrem/providers';

const bindings = (env: Env) => ({ kv: env.CACHE, db: env.DB });
const iam = createIam<Env>({ bindings, audience: (env) => env.ACCESS_AUD });
const providers = createProviders<Env>({ bindings, sessions: iam.sessions, kek: (env) => env.KEK });
const app = createApp<Env>({
  modules: [iam.module, providers.module],
  startup: iam.startup,
  session: iam.sessions.hook,
  authorize: iam.sessions.authorize,
});
```

`createProviders` returns the `registry` and the module manifest. It stands on the IAM module:
the same sessions and authorizer, the same audit wrapper. `kek` reads the `KEK` secret from the
request's env; the envelope is built from it once per isolate, on the first request that needs
it, so a Worker without the secret answers `KIT-E-1301` only when a credential is stored or read.
The manifest carries the secret's key recipe, `KEK_RECIPE`: how to make the key with one Node
command and keep it, how to test it, the rotation through `POST /keys/rewrap`, and what stops
without it. A Worker that mounts the module therefore lists `KEK` in `secrets.required`
(`oltrem doctor`, CF-SEC-02), and its generated Key recipes page shows the recipe.

## The definitions

The kit ships twelve email definitions in `src/definitions/email.ts`, each written from the
provider's public API reference: Resend, Brevo, Postmark, SendGrid, Mailgun, Amazon SES, Sender
(its API and its SMTP relay), Mailjet, Mailtrap, SMTP2GO and any SMTP server. Ten are the HTTP
template engine's: a base URL, a send template with `{{secret.x}}`,
`{{config.x}}` and `{{message.x}}` placeholders (a `$each`/`$as` pair maps a list), a JSON or
form body, where the message id is read from, a probe. Two are the SMTP client's: Sender's
relay (`smtp.sender.net`, 587) and any server. A message may carry copies, `cc` and `bcc`
(2026-10-29): each HTTP definition but Sender's sends them in its own field
(`{{message.cc}}`, `{{message.ccList}}` and the same for `bcc`, gone when there are none), and
the SMTP client writes a `Cc` header and gives every copy as a recipient, never writing `Bcc`. Every one names
its auth scheme (`bearer`, `basic`, `api-key-header`, `sigv4`, `smtp-plain`), the fields a person
pastes with which are secret (a field's `wrong` names values that are surely the wrong thing by how
they start, refused on save with what to paste instead: Brevo's SMTP key, `xsmtpsib-`, where its
API key goes, and its API key, `xkeysib-`, as an SMTP password), a recipe (where to create the key, its scopes, how to test and
rotate it, what the kit does without it, and a `guide`: the steps in the provider's own dashboard
for the key, the sending domain and the delivery reports, each with a link to the page it names,
the day they were checked and the provider's own guide for when its screens change; the steps
live in `src/definitions/guides.ts`, and report steps without a webhook block are refused), and, where the provider signs its webhooks, the
signature scheme and the paths of the event type, message id, recipient, time and reason with the
map of its event names to the kit's nine kinds. An entry of the map may be an object that also
says a bounce or refusal is for good (`permanent`) or an open was a machine's (`automatic`, such
as Brevo's Apple privacy proxy opens); where the provider says it in the report itself, a
`severity` path names the field and the values that mean for good and for now (Resend's
`bounce.type`, Postmark's `Type`, SendGrid's `type`, Mailgun's `severity`, SES's `bounceType`,
Mailjet's `hard_bounce`, a flag read as `true` or `false`, SMTP2GO's `bounce`). A report that is an
object holding the list names where it is (`eventsPath`: Mailtrap's `events`); a list where the
definition expects one event (Mailjet's "Group events" setting) is read whole.
A fingerprint (SPF includes, DKIM selectors or
CNAME suffix, a verification TXT prefix) is written only where the research confirmed the
pattern; the rest is left for the sandbox to confirm, never guessed.

Sender (2026-10-28) takes one recipient a message: its send says `oneRecipient`, and a message
to more, or with a Cc or Bcc, is refused before any call (`KIT-E-1408`), so it goes through the failover, or through
Sender's SMTP relay, which takes many. It has no reply-to field, so `{{message.headersWithReplyTo}}`
sends Reply-To among the headers. Its webhooks carry only bounces, on its paid plans, signed with
a header it does not publish; it publishes no count of emails used or left and no domain API. So
a Sender instance sends, is probed and is counted by the portal, while its delivery reports, its
allowance and its domain set-up wait for the sandbox: the domain is set up in Sender's dashboard.

Mailjet, Mailtrap and SMTP2GO (2026-10-28) were added from their references the same day:

| | Mailjet | Mailtrap | SMTP2GO |
|---|---|---|---|
| Send | `POST /v3.1/send`, one message in `Messages`; the id kept is the `MessageUUID` (its numeric `MessageID` can pass what a JavaScript number holds) | `POST /api/send` on `send.api.mailtrap.io`, with a `User-Agent`, which its edge may ask for and a Worker's fetch does not add; one id a recipient, the first kept | `POST /v3/email/send`; Reply-To among `custom_headers` (`{{message.headerEntriesWithReplyTo}}`); it answers 200 to a send it refused, so `send.acceptedWhen` takes it only while `data.failed` is 0 |
| Key | the key pair: the public key is the basic auth user, the secret key the password | a bearer token | `X-Smtp2go-Api-Key` |
| Probe | lists the senders | none: the sending address answers nothing else, so the canary is the test | reads the email cycle |
| Reports | unsigned (`none`), `Message_GUID` matches the kept id | `hmac-body`, `events` list; `suspension` is left unmapped | unsigned (`none`), `email_id`, `bounce` hard or soft |
| Allowance | none published | none on the sending address | the month's cycle, `POST /v3/stats/email_cycle` |

None has a `batch` or `domains` block yet: Mailtrap's and Mailjet's batch calls answer in shapes
the engine's batch does not read, and their domains are set up in their dashboards. A
multi-recipient SMTP2GO send that fails for some recipients only counts as failed. Mailjet's US
platform answers on another address and waits for the sandbox, like every real answer here.

An HTTP definition may also carry a `domains` block: how the provider adds a sending domain
(`create`), reads it back (`read`) and is asked to look again (`verify`), each a method, a path
and an optional body template that may use `{{domain.name}}` and `{{domain.id}}`; where the
provider's id for the domain is read (`idPath`, else the name is the id); where it says the
domain is verified and the values that mean so; and where its DNS records are, with the paths of
each record's name, type, value, priority and status and the status values that mean found.
Resend and Brevo carry one; the others are added when their APIs are written up.

An HTTP definition may also carry `identities`: up to three lists the provider keeps of what the
account may send from, each a method, a path and an optional body; where the list is
(`itemsPath`), each entry's domain or address (`namePath`; `*@example.com` is the whole domain),
where it says the entry is verified and the values that mean so (`okPath` and `ok`, together), and
the display name it keeps for an address. `needs` names fields that must be filled for the call to
be made, and `auth: false` with `headers` sends a second key instead of the definition's own.
Resend, Brevo, SendGrid, Postmark (with its optional account token), Mailgun, SES, Mailjet and
SMTP2GO carry them. Mailtrap's list needs the account's number, which no field holds yet; Sender
publishes no list.

`defineProvider` checks a definition against the contract where it is written, and
`definitionProblems` returns what is wrong, one line each with the path; a client's definition
submitted through the route is checked the same way. The contract refuses an id or field name in
the wrong shape, a base URL that is not `https`, a port other than 465 or 587, an SMTP transport
with an HTTP auth scheme, `api-key-header` without its header, `sigv4` without its service, a
repeated field name, an event mapped to an unknown kind, a webhook signature without the field it
reads its key from, `hmac-body` without its header. A field marked `optional` may be left out of an instance: the webhook keys
are, so a provider sends before its delivery reports are set up.

## Routes

Under `/api/providers`, with `providers.read` (class read) and `providers.manage` (class admin,
fresh sign-in), on bit plane 2:

| Route | Capability | What it does |
|---|---|---|
| `GET /definitions` | read | every definition, the kit's and the client's, with its fields and recipe |
| `PUT /definitions/:id` | manage | the client's own definition, or its change to the kit's; checked, then a row |
| `DELETE /definitions/:id` | manage | removes the client's row; the kit's definition, if any, is back (`KIT-E-1406` when there is no row to remove) |
| `GET /instances?kind=` | read | the tenant's instances with status, failover order, config and whether a credential is set |
| `GET /instances/:id` | read | one instance; never its credential |
| `POST /instances` | manage | sets one up: the definition, a label, every field the definition lists; `201` |
| `POST /instances/:id/credential` | manage | the fields again (a new key, a changed domain); a secret left out keeps the one stored, so a webhook secret is added without the key being pasted again; a suggestion becomes confirmed |
| `POST /instances/:id/activate` | manage | this instance sends; the one that was active becomes the first failover |
| `POST /instances/:id/disable` | manage | out of the failover order |
| `POST /instances/:id/probe` | manage | reaches the provider with the sealed credential; the result (ok, when, how long, the provider's words) is kept on the row and audited as `providers.probe` |
| `POST /detect` | manage | reads a domain's public DNS for the providers it already uses; each new one becomes a `suggested` instance with its evidence, audited as `providers.detect` |
| `DELETE /instances/:id` | manage | removes it with its credential; the active one is refused (`KIT-E-1405`) |
| `POST /keys/rewrap` | manage | after the KEK secret changed: every tenant's data key wrapped again under the current key |
| `GET /home` | read | the Home card: how many connected instances are active |

Instances belong to a tenant; the Vendor, who has none, is refused. A field the definition does
not list, or an empty one, is `422`; a listed field that is missing is `KIT-E-1403` naming it.

## The adapters

Two adapters speak to every email definition, by its transport; `createEmailAdapter({ fetch?,
connect?, now? })` returns one `send(opened, message)` and one `probe(opened)` for both, so the
email module never names a provider.

- **The HTTP template engine** renders the definition's URL, headers and body against three
  scopes, `secret`, `config` and `message`, signs the request with the auth scheme and reads the
  provider's message id from the answer (`messageIdPath`, a JSONPath, or `messageIdHeader`). A
  placeholder alone takes its value as it is; one with no value removes its key, and an object
  or a list entry left empty goes with it, so a message without HTML sends no empty HTML part. A
  URL or a header with a missing value is refused, naming the field (`KIT-E-1403`).
- **Each provider's own features**, from three optional fields of the message. A `tag` (made by
  `tagOf(text)`: letters, digits, `_` and `-`, at most 64) groups the message in the provider's
  own reports: Resend's and SES's tags (as `category`), Brevo's tags, Postmark's `Tag`,
  SendGrid's categories, Mailgun's `o:tag`, Mailjet's `CustomCampaign`, Mailtrap's `category`.
  `tracking: false` asks the provider not to track opens and clicks, in its own words: Postmark
  `TrackOpens` and `TrackLinks`, SendGrid `tracking_settings`, Mailgun `o:tracking`, Mailjet
  `TrackOpens` and `TrackClicks`; the others track by their account setting. `bulk: true` sends
  bulk mail the provider's bulk way: Postmark's broadcast stream, the instance's
  `broadcastStream` field, read in the template as `{{bulk.broadcastStream}}` (the `bulk` scope is
  the config, present only for a bulk message). A definition's `send.bulkNeeds` lists the config
  fields bulk mail needs; while one is empty a bulk message is refused before any call
  (`KIT-E-1408`), so it never goes out the everyday way.
- **The auth schemes**: `bearer`, `basic` (the definition's user, else the `user` field),
  `api-key-header` and `none`, a line each; `sigv4`, the AWS signature, computed with WebCrypto
  over every header sent and checked against AWS's published vector. `oauth2-client-credentials`
  has no code yet and is refused by name (`KIT-E-1408`), never sent half-signed.
- **The SMTP client**, over the Workers TCP socket: port 465 is TLS from the first byte, 587
  upgrades with STARTTLS before any credential is sent, and refuses a server that does not offer
  it or sends bytes before the handshake; AUTH PLAIN or LOGIN; the message written as MIME here,
  base64 bodies, encoded words for text outside ASCII, a `Message-ID` made from the kit's message
  key. Port 25 is refused: Cloudflare blocks it.
- **The message** (`EmailMessage`) is checked once before any request: addresses well formed, no
  line break where a header goes, at most fifty recipients, no header a message may not set
  (`From`, `Bcc` and the like).
- **A refusal** is `KIT-E-1407` with the provider's status and its answer cut to one line, every
  secret value of the instance blanked; its `details` carry the status (`null` when no answer
  came) and the seconds of a `Retry-After`. A send waits 20 seconds for the answer, a batch 30.
  `failureOf(error)` sorts it for the bulk engine: `network` (no answer: it may have been sent),
  `speed` (429), `allowance` (402, or a 429 that names a quota or credits), `account` (401, 403:
  the key, the account or the sending domain), `message` (another 4xx), `provider` (5xx) or
  `other`; an SMTP reply before `DATA` says nothing was sent. A probe never throws: it answers
  `{ ok, checkedAt, latencyMs, detail }`. A definition's `probe.ready` (up to five
  `{ path, is, problem }`) says what the probe's answer must also hold for the account to send:
  a key the provider accepts on an account it has not switched sending on fails the probe with
  `problem`, which says what to do. Brevo's reads `relay.enabled` from `GET /v3/account` (a new
  account answers with its key and refuses every send until Brevo activates transactional email).
- **Many messages at once**: a definition's optional `batch` block (`path`, `max`, `idsPath` and
  `idPath` for the ids in the answer, in order, and an optional `idempotencyHeader`) lets
  `sendBatch(opened, messages, key)` send up to `max` messages in one call, each rendered from
  the send's own template; `batchSize(opened)` is 1 for a definition without one. A send's own
  `idempotencyHeader` carries the message key. Resend has both (100 a call, `Idempotency-Key`,
  which Resend honours for 24 hours: a repeated call is answered as the first); Brevo has neither,
  since its message versions carry no headers of their own and every bulk message has its own
  unsubscribe header.
- **What is used and left** (2026-10-28): a definition's optional `usage` block names the
  provider's own count, a `GET` or a `POST` with an empty object (`path`) read by JSONPaths into three windows, `day`, `month`
  and `plan` (a plan's credits that are neither), each with `used`, `limit`, `left` and `resets`,
  and a `when` that reads a window only when a field says so (Brevo's credits are today's on the
  free plan, the plan's on a paid one). `usage(opened)` answers `{ at, asked, day, month, plan,
  problem }`, null for a definition without one; it never throws, and a key that may not read
  the count (Resend's sending-only key answers 401) is the `problem`, in words. `left` is worked
  out only from a used count and a limit the provider gave together, never guessed. The block's
  `headers` name the counts used some providers put on every answer to a send (Resend's
  `x-resend-daily-quota` and `x-resend-monthly-quota`): `send` and `sendBatch` return them as
  `quota`, and `withQuota(kept, quota, at)` moves the kept figures on, the limit kept while the
  window has not started again. `leftOf(usage, now)` is the tightest window that still says what
  is left. The kit's definitions read Resend's `/usage`, Brevo's account, SendGrid's credits and
  SES's 24-hour quota and SMTP2GO's monthly cycle; Postmark, Mailgun, Mailjet, Mailtrap, Sender
  and SMTP say nothing.
- **The domain client**, `createDomainClient({ fetch?, now? })`, speaks the `domains` block:
  `supports`, `create`, `read` and `verify`, each answering the provider's id, whether it is
  verified, its status word and its records with full host names (`hostOf`; `@` is the domain
  itself). Adding a domain the provider already has reads it instead. A refusal is `KIT-E-1410`
  with the provider's status and its answer cut to one line, the key blanked. `identities` reads
  the definition's lists: each domain and address once, verified when any list says so, and the
  lists skipped because a field they need is empty; null for a definition without lists
  (`readIdentities` reads one answer). The email module's senders use it.

## Delivery reports

`createWebhookVerifier({ now?, fetchCertificate? }).verify(opened, { headers, body })` checks a
report against the instance's definition and returns `{ deliveryId, payload, subscribeUrl? }`;
`deliveryEvents(definition, payload)` turns it into the kit's events (`kind`, the provider's
event name, message id, recipient, ISO time, reason; `permanent`, true, false or null when the
provider did not say, for a bounce or a refusal only; `automatic` for a machine's open or click)
and lists the event names the map does not
name as `ignored`. The body is the raw text: a signature covers the bytes as they came.

| Scheme | Provider | What is checked | Key field |
|---|---|---|---|
| `standard-webhooks` | Resend | HMAC-SHA256 of `id.timestamp.body`, any listed `v1` signature, `svix-` or `webhook-` headers | secret `webhookSecret` |
| `hmac-timestamp-token` | Mailgun | HMAC-SHA256 of timestamp and token, hex, in the body | secret `webhookSigningKey` |
| `ecdsa-public-key` | SendGrid | ECDSA P-256 over timestamp and body, a DER signature | config `webhookPublicKey` |
| `sns` | Amazon SES | RSA (SHA-1 or SHA-256) over the documented fields, the certificate fetched from an `sns.*.amazonaws.com` address and cached, the topic equal to the instance's | config `topicArn` |
| `shared-secret` | Postmark | the password of the basic auth on the webhook's address, compared in constant time | secret `webhookSecret` |
| `hmac-body` | Mailtrap | HMAC-SHA256 of the body alone, hex, in the header the definition names (`signatureHeader`); it carries no time, so a copy sent again verifies again | secret `webhookSecret` |
| `none` | Brevo, Mailjet, SMTP2GO | nothing: the token in the hook's address is the only guard | none |

A signed timestamp more than five minutes from the clock is refused. An SNS subscription is
answered with its confirmation address only when that address is an AWS one. A refusal is
`KIT-E-1409` naming the check. The public address the reports arrive at,
`/hooks/email/<instance>/<token>`, is the email module's; its token is the one sealed with the
instance's credential (below).

## Detection

`detect(domain, definitions, resolve)` asks DNS over HTTPS (Cloudflare's resolver, JSON form) for
the domain's TXT and MX records and one TXT question per DKIM selector the definitions name, so a
CNAME on the way is seen too, then matches each definition's fingerprint. Evidence is **strong**
when a record names the provider (an SPF include of its domain or under it, a DKIM CNAME to its
suffix, an MX host, its verification record) and **weak** when it only shows a DKIM key at a
common selector; a provider with only weak evidence is a weak suggestion. A look-alike include
(`notmailgun.org`) is not a match, and an IP address or a bare name is not a domain.

`POST /detect` writes one `suggested` instance per provider found that the tenant has no
instance of, labelled "(found in DNS)", with no credential and its evidence in `detectedBy`; a
second run adds nothing. A suggestion never sends: it becomes `confirmed` when a person pastes its
key and is activated by a person. The job `providers.refingerprint` reads every detected domain
again once a day and keeps what it saw (`now`, `evidence`, `checkedAt`); `drift` is true when it
saw less than the first time. The health check `providers.dns` (lane `email`) warns while any
instance that is not disabled has drifted.

## Status and the failover order

`suggested` is what the detection writes; `confirmed` is an instance a person
set up or a suggestion whose credential was pasted; `active` sends; `failover` stands in, in
order; `disabled` is out. `registry.pick(db, tenant, kind)` is what the email module will ask:
the active instance, else the first failover. Activating an instance needs its credential, and a
suggestion is never activated by itself (plan 8.3).

## Credentials

The secret fields are sealed together under the tenant's data key to the instance's row, so a
sealed value copied to another row refuses to open; the other fields are config in the clear.
`registry.open(env, tenant, id)` returns the fields to an adapter inside the request that uses
them, and a credential that did not open is written to the audit log as `providers.open`,
`failed`, with the error code and never the value. Beside the pasted fields the seal holds one
the kit makes, `HOOK_FIELD`: the secret token of the instance's address for delivery reports,
made when a key is first pasted and kept when one is pasted again. A secret field left out of a
new paste keeps the stored value, so a signing secret is added without pasting the key again. `registry.instance(db, id)`
finds an instance by its id alone, for that public address. Every write is audited under the person who
made it: `providers.define`, `undefine`, `create`, `credential`, `probe`, `activate`, `disable`,
`remove` and `rewrap`, with the field names and never a value.

## Tables and errors

Migration `0010`: `providers_definitions` (the client's rows), `providers_keys` (one wrapped data
key per tenant, with the id of the key that wrapped it and when it was rotated) and
`providers_instances` (indexed by tenant, kind, status and failover order). Migration `0051`
adds `usage` to the instance: what its provider last said was used and left, as JSON, written by
`registry.recordUsage(db, id, usage)`. Error codes
`KIT-E-1401` to `1409`: a bad definition, an unknown one, a missing field, an instance not ready
to activate, the active instance in use, the kit's definition that has no row to remove, a
provider that did not take the message, what the definition asks for that this kit version
cannot do, a delivery report that failed its check, and a provider that refused a domain call
(`KIT-E-1410`).

## Not here yet

The screens, with the Setup page that tests a provider's key from its recipe. No adapter has spoken
to a real provider yet: the request shapes stand on the public references until the sandbox
sends through two of them. A batch for Postmark (500 a call, on a broadcast message stream),
SendGrid, Mailgun and Amazon SES: until then they send bulk mail one message a call.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the seven definitions
pass the contract and a bad one is refused with its path; an instance set up with its credential
sealed to its row and the key nowhere in a response or the table; a missing, unknown or empty
field refused; activation and the failover order, `pick`, the active instance not removable, a
suggestion not activatable; a client's definition added, replacing the kit's and removed; the
audit rows with field names and no value; a credential moved to another row refused and recorded;
the data keys wrapped again after the KEK changed, and opened under the new key alone; the probe
route with the sealed key, its result kept and audited. The adapters without the network: the
template engine against every kit definition (nothing left unrendered, no field the definition
does not list); one request shape per HTTP provider against a scripted fetch; a refusal with the
key blanked; a bad message refused before any request; SigV4 against AWS's published vector and
one computed apart; the SMTP client against a scripted server on a fake socket, on 587 and 465,
refusing to sign in without TLS. The webhooks against reports signed outside the kit: the Standard
Webhooks published vector, a Mailgun HMAC made in Python, SendGrid and SNS signatures made with
openssl (SNS with SHA-256 and SHA-1); a changed body, an old timestamp, another key or topic, a
certificate address that is not AWS's and a missing key field refused; every provider's events
read by its field map; an unmapped or inherited event name ignored. The detection against small
zones: strong and weak evidence, a look-alike include refused, the resolver's TXT chunks, CNAMEs,
missing names and failures; through the route, the suggestions written once, refused to activate,
audited, and the daily re-check marking the one whose records went, with the health check
warning.

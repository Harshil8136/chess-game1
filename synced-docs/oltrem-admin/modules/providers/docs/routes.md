---
title: "@oltrem/providers: Routes; The adapters"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/providers/src; split from modules/providers/README.md]
---

# @oltrem/providers: Routes; The adapters

> Part of [the @oltrem/providers README](../README.md).

## Routes

Under `/api/providers`, with `providers.read` (class read), `providers.manage` (class admin,
fresh sign-in) and `providers.definitions` (class admin, fresh sign-in, the Vendor's floor: no
role carries it, so only the Vendor holds it), on bit plane 2. A definition says where a
provider's key is sent, so writing one is the Vendor's alone; `providers.manage` sets up
instances and pastes their keys.

| Route | Capability | What it does |
|---|---|---|
| `GET /definitions` | read | every definition, the kit's and the client's, with its fields and recipe |
| `GET /report?days=&to=` | read, at the company | the section on Reports' Services tab: each connection's last check, the failing first, and the allowance used where a provider tells it; today's state only |
| `PUT /definitions/:id` | definitions, at the company | the client's own definition, or its change to the kit's; checked, then a row |
| `DELETE /definitions/:id` | definitions, at the company | removes the client's row; the kit's definition, if any, is back (`KIT-E-1406` when there is no row to remove) |
| `GET /instances?kind=` | read | the tenant's instances with status, failover order, config and whether a credential is set; never a data connection, a storage bucket or an analytics app |
| `GET /instances/:id` | read | one instance; never its credential |
| `POST /instances` | manage, at the company | sets one up: the definition, a label, every field the definition lists; `201` |
| `POST /instances/:id/credential` | manage, at the company | the fields again (a new key, a changed domain); a secret left out keeps the one stored, so a webhook secret is added without the key being pasted again; a suggestion becomes confirmed |
| `POST /instances/:id/activate` | manage, at the company | this instance sends; the one that was active becomes the first failover |
| `POST /instances/:id/disable` | manage, at the company | out of the failover order |
| `POST /instances/:id/probe` | manage, at the company | reaches the provider with the sealed credential; the result (ok, when, how long, the provider's words) is kept on the row and audited as `providers.probe` |
| `GET /checkup` | read, at the company | every connection the tenant holds, of every kind (email, data, storage, analytics and the rest), not suggested or switched off: its title, label, last check (ok, when, how long, the words), a retiring API (`sunset`, `deprecated`) and what the checkup fixed by itself (`fixed`); never a key. `probe=1` reads nothing, for the Checkup tab |
| `POST /detect` | manage, at the company | reads a domain's public DNS for the providers it already uses; each new one becomes a `suggested` instance with its evidence, audited as `providers.detect` |
| `DELETE /instances/:id` | manage, at the company | removes it with its credential; the active one is refused (`KIT-E-1405`) |
| `POST /keys/rewrap` | manage, at the company | after the KEK secret changed: every tenant's data key wrapped again under the current key |
| `GET /home` | read | the Home card: how many connected instances are active and working; one active whose last check failed is not counted and the card says so; a connected database (kind `data`) is not counted, as it is the data part's |
| `GET /onboarding` | manage | Home's Get started: "Connect an email service", done while an email instance is active and its last check did not fail |

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
  URL or a header with a missing value is refused, naming the field (`KIT-E-1403`). In a form
  body, an object under a key that ends in `*` is one field for each entry (`'h:*'` gives
  Mailgun its `h:<header>` fields).
- **The message's own headers** (the unsubscribe pair of campaigns, a reply's `In-Reply-To` and
  `References`) are named by every HTTP definition that sends, and a test refuses one that
  forgets them. Mailgun and Amazon SES left them out until 2026-11-17, so a campaign through
  either went without one-click unsubscribe: Mailgun now gets `h:<name>` fields and SES
  `Content.Simple.Headers` (fifteen at most, its limit).
- **Each provider's own features**, from three optional fields of the message. A `tag` (made by
  `tagOf(text)`: letters, digits, `_` and `-`, at most 64) groups the message in the provider's
  own reports: Resend's and SES's tags (as `category`), Brevo's tags, Postmark's `Tag`,
  SendGrid's categories, Mailgun's `o:tag`, Mailjet's `CustomCampaign`, Mailtrap's `category`.
  `tracking: false` asks the provider not to track opens and clicks, in its own words: Postmark
  `TrackOpens` and `TrackLinks`, SendGrid `tracking_settings`, Mailgun `o:tracking`, Mailjet
  `TrackOpens` and `TrackClicks`; the others track by their account setting. A definition that
  tracks every message with no way to stop it says `alwaysTracks: true` (Brevo, Sender and Sender
  SMTP, 2026-11-11): Gmail reads an open pixel and links sent through the provider's own address
  as signs of marketing mail, so the email module sends everyday mail through another route first
  when there is one. `bulk: true` sends
  campaigns the provider's bulk way: Postmark's broadcast stream, the instance's
  `broadcastStream` field, read in the template as `{{bulk.broadcastStream}}` (the `bulk` scope is
  the config, present only for a bulk message). A definition's `send.bulkNeeds` lists the config
  fields campaigns needs; while one is empty a bulk message is refused before any call
  (`KIT-E-1408`), so it never goes out the everyday way.
- **Files sent with a message**: `attachments`, at most `ATTACHMENTS_MAX` (10), each a one-line
  `name`, an `https` `url` and its `size` in bytes. The provider downloads each file from its link
  during the call, so the Worker never reads the file and its CPU time does not grow with it. A
  definition says it can with `send.attachments: { maxBytes }`: Brevo (`attachment`, each `{ url,
  name }`, 20 MB in all) and Resend (`attachments`, each `{ path, filename }`, 25 MB kept under its
  40 MB after encoding). Any other definition, the SMTP client, a batch call, or more bytes than
  `maxBytes` is refused before any call (`KIT-E-1408`); `attachmentBytes(definition)` tells a module
  which providers take files, so it offers them only there.
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
  came) and the seconds of a `Retry-After`. A send or a probe waits 20 seconds for the answer, a batch 30.
  `failureOf(error)` sorts it for the bulk engine: `network` (no answer: it may have been sent),
  `speed` (429), `allowance` (402, or a 429 that names a quota or credits), `account` (401, 403:
  the key, the account or the sending domain), `message` (another 4xx), `provider` (5xx) or
  `other`; an SMTP reply before `DATA` says nothing was sent. A probe never throws: it answers
  `{ ok, checkedAt, latencyMs, detail }`, with `sunset` (the `Sunset` header, RFC 8594, 64
  characters at most) and `deprecated` (a `Deprecation` header, RFC 9745) when the provider said
  it is retiring the API (`retiringOf`). A definition's `probe.ready` (up to five
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
- **What is used and left**: a definition's optional `usage` block names the provider's own count, a
  `GET` or a `POST` with an empty object (`path`) read by JSONPaths into three windows, `day`,
  `month` and `plan` (a plan's credits that are neither), each with `used`, `limit`, `left` and
  `resets`, and a `when` that reads a window only when a field says so (Brevo's credits are today's
  on the free plan, the plan's on a paid one). `usage(opened)` answers `{ at, asked, day, month,
  plan, problem }`, null for a definition without one; it never throws, and a key that may not read
  the count (Resend's sending-only key answers 401) is the `problem`, in words. `left` is worked out
  only from a used count and a limit the provider gave together, never guessed. The block's
  `headers` name the counts used some providers put on every answer to a send (Resend's
  `x-resend-daily-quota` and `x-resend-monthly-quota`): `send` and `sendBatch` return them as
  `quota`, and `withQuota(kept, quota, at)` moves the kept figures on, the limit kept while the
  window has not started again. `leftOf(usage, now)` is the tightest window that still says what is
  left. The kit's definitions read Resend's `/usage`, Brevo's account, SendGrid's credits and SES's
  24-hour quota and SMTP2GO's monthly cycle; Postmark, Mailgun, Mailjet, Mailtrap, Sender and SMTP
  say nothing.
- **A test inbox**: a definition's optional `testInbox` is an address the provider keeps for tests,
  which takes an email and delivers it to no one (Resend's `delivered@resend.dev`). Where the key
  may only send and so cannot read a domain's state, `@oltrem/email`'s domain check sends one test
  to it to learn whether the provider sends from the domain; each test counts against the account's
  allowance, so the check sends one only while the domain is unproven.
- **The domain client**, `createDomainClient({ fetch?, now? })`, speaks the `domains` block:
  `supports`, `create`, `read` and `verify`, each answering the provider's id, whether it is
  verified, its status word and its records with full host names (`hostOf`; `@` is the domain
  itself). Adding a domain the provider already has reads it instead. A refusal is `KIT-E-1410`
  with the provider's status and its answer cut to one line, the key blanked. `identities` reads
  the definition's lists: each domain and address once, verified when any list says so, and the
  lists skipped because a field they need is empty; null for a definition without lists
  (`readIdentities` reads one answer). The email module's senders use it.

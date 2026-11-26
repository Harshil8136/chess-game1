---
title: "@oltrem/providers: routes, the adapters"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/providers/src/module.ts, adapters/]
---

# @oltrem/providers: routes, the adapters

> Part of [the @oltrem/providers README](../README.md).

## Routes

Under `/api/providers`, on bit plane 2: `providers.read`, `providers.manage` (admin, fresh sign-in;
instances and their keys) and `providers.definitions` (admin, fresh sign-in, the Vendor's floor: no
role carries it, since a definition says where a key is sent). Write routes are read at the company.

| Route | Needs | What it does |
|---|---|---|
| `GET /definitions` | read | Every definition, the kit's and the client's, with fields and recipe |
| `PUT /definitions/:id`, `DELETE /definitions/:id` | definitions | The client's own or its change to the kit's, checked, as a row; removing the row brings the kit's back (`KIT-E-1406` with no row) |
| `GET /instances?kind=`, `GET /instances/:id` | read | Instances with status, failover order, config and whether a credential is set; never the credential, a data connection, a bucket or an analytics app |
| `POST /instances` | manage | Sets one up from a definition, a label and every listed field; `201` |
| `POST /instances/:id/credential` | manage | The fields again; a secret left out keeps the stored one; a suggestion becomes confirmed |
| `POST /instances/:id/activate`, `/disable` | manage | This one sends (the old active one becomes the first failover); out of the order |
| `POST /instances/:id/probe` | manage | Reaches the provider with the sealed key; ok, when, how long and its words kept, audited `providers.probe` |
| `GET /checkup` | read | Every connection of every kind not suggested or off: last check, `sunset`, `deprecated`, `fixed`; never a key. `probe=1` reads nothing |
| `POST /detect` | manage | A domain's public DNS read for providers it uses; each new one a `suggested` instance with its evidence, audited `providers.detect` |
| `DELETE /instances/:id` | manage | Removes it and its credential; the active one is refused (`KIT-E-1405`) |
| `POST /keys/rewrap` | manage | After the KEK changed: every tenant's data key wrapped again |

Module parts: Reports' Services section (last checks, failing first, allowance used), the Home card
(working instances, a failing one named) and Get started's "Connect an email service". Instances
belong to a tenant (the Vendor is refused). An unlisted or empty field is `422`; a missing listed one
is `KIT-E-1403` naming it.

## The adapters

`createEmailAdapter({ fetch?, connect?, now? })` gives one `send(opened, message)` and one
`probe(opened)` for every email definition, by transport, so the email module never names a
provider.

| Part | What it does |
|---|---|
| HTTP templates | URL, headers and body rendered against `secret`, `config` and `message` (and `bulk`), signed, the message id read by `messageIdPath` (JSONPath) or `messageIdHeader`. An empty placeholder removes its key (no empty HTML part); a missing value in a URL or header is `KIT-E-1403`. In a form body a key ending `*` spreads an object (`'h:*'` for Mailgun) |
| Headers | Every sending definition names the message's own headers (unsubscribe pair, `In-Reply-To`, `References`), at most 15; a test refuses one that forgets |
| Provider features | `tag` (`tagOf`: letters, digits, `_`, `-`, 64) as each provider's tag or category; `tracking: false` in each provider's words where it can; `alwaysTracks: true` (Brevo, Sender) sends everyday mail elsewhere first; `bulk: true` uses the bulk way (Postmark's `broadcastStream`), refused while a `send.bulkNeeds` field is empty (`KIT-E-1408`) |
| Attachments | `ATTACHMENTS_MAX` (10), each `name`, an `https` `url`, `size`; the provider downloads them, so the Worker never reads the file. Only where `send.attachments: { maxBytes }` (Brevo 20 MB, Resend 25 MB); else `KIT-E-1408`. `attachmentBytes(definition)` says which take files |
| Auth | `bearer`, `basic`, `api-key-header`, `none`, and `sigv4` (WebCrypto, checked against AWS's vector); `oauth2-client-credentials` refused by name (`KIT-E-1408`) |
| SMTP | Over the TCP socket: 465 TLS, 587 STARTTLS before any credential (refused if not offered or bytes come first), AUTH PLAIN or LOGIN, MIME written here, a `Message-ID` from the message key; port 25 refused |
| The message | Checked once: well-formed addresses, no line break in a header, 50 recipients, no forbidden header (`From`, `Bcc`) |
| Refusals | `KIT-E-1407` with the status and a one-line answer, secrets blanked, `details` with the status and `Retry-After`. `SEND_TIMEOUT_MS` (20 s), `BATCH_TIMEOUT_MS` (30 s). `failureOf(error)`: `network` (may have sent), `speed` (429), `allowance` (402 or a quota 429), `account` (401, 403), `message` (4xx), `provider` (5xx), `other`; an SMTP reply before `DATA` sent nothing |
| Probes | Never throw: `{ ok, checkedAt, latencyMs, detail }`, with `sunset` (RFC 8594) and `deprecated` (RFC 9745) via `retiringOf`. `probe.ready` (up to five `{ path, is, problem }`) fails an account that cannot send yet (Brevo's `relay.enabled`) |
| Batches | A `batch` block (`path`, `max`, `idsPath`, `idPath`, `idempotencyHeader`) lets `sendBatch(opened, messages, key)` send `max` at once; `batchSize` is 1 without it. Resend: 100 a call, `Idempotency-Key` honoured 24 h; Brevo has neither |
| Usage | A `usage` block reads `day`, `month` and `plan` windows (`used`, `limit`, `left`, `resets`, a `when`); `usage(opened)` never throws, a refused read is the `problem`; `left` only from a used count and limit given together. Header counts (Resend's quotas) come back from sends as `quota`; `withQuota` moves kept figures on; `leftOf` is the tightest window. Read for Resend, Brevo, SendGrid, SES, SMTP2GO |
| Test inbox | `testInbox` (Resend's `delivered@resend.dev`): `@oltrem/email` sends one there while a domain is unproven, since each counts against the allowance |
| Domains | `createDomainClient({ fetch?, now? })`: `supports`, `create`, `read`, `verify` (id, verified, status, records with full hosts by `hostOf`); an existing domain is read instead; refusals `KIT-E-1410`. `identities` (and `readIdentities`) lists each domain and address once, naming lists skipped for an empty field |

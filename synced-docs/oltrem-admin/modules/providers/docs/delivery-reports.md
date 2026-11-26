---
title: "@oltrem/providers: delivery reports, detection, checks, credentials, tables, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/providers/src/webhooks, detection, registry.ts, module.ts, errors.ts]
---

# @oltrem/providers: delivery reports, detection, checks, credentials, tables, tests

> Part of [the @oltrem/providers README](../README.md).

## Delivery reports

`createWebhookVerifier({ now?, fetchCertificate? }).verify(opened, { headers, body })` checks a
report against the instance's definition and returns `{ deliveryId, payload, subscribeUrl? }`;
`deliveryEvents(definition, payload)` turns it into the kit's events (`kind`, the provider's event
name, message id, recipient, ISO time, reason; `permanent`, true, false or null when the provider
did not say, for a bounce or a refusal only; `automatic` for a machine's open or click) and lists
the event names the map does not name as `ignored`. The body is the raw text: a signature covers the
bytes as they came. Where a provider's report names only the message's recipients (Resend's
`data.to`, SES's `mail.destination`), the recipient is null when there are several: which one
bounced is not said, and the first is not assumed.

| Scheme | Provider | What is checked | Key field |
|---|---|---|---|
| `standard-webhooks` | Resend | HMAC-SHA256 of `id.timestamp.body`, any listed `v1` signature, `svix-` or `webhook-` headers | secret `webhookSecret` |
| `hmac-timestamp-token` | Mailgun | HMAC-SHA256 of timestamp and token, hex, in the body | secret `webhookSigningKey` |
| `ecdsa-public-key` | SendGrid | ECDSA P-256 over timestamp and body, a DER signature | config `webhookPublicKey` |
| `sns` | Amazon SES | RSA (SHA-1 or SHA-256) over the documented fields, the certificate fetched from an `sns.*.amazonaws.com` address and cached, the topic equal to the instance's | config `topicArn` |
| `shared-secret` | Postmark | the password of the basic auth on the webhook's address, compared in constant time | secret `webhookSecret` |
| `hmac-body` | Mailtrap | HMAC-SHA256 of the body alone, hex, in the header the definition names (`signatureHeader`); it carries no time, so a copy sent again verifies again | secret `webhookSecret` |
| `none` | Brevo, Mailjet, SMTP2GO | nothing: the token in the hook's address is the only guard | none |

A signed timestamp more than five minutes off is refused (SNS's `Timestamp` too). An SNS
subscription is answered only at an AWS confirmation address. A refusal is `KIT-E-1409` naming the
check. The public address, `/hooks/email/<instance>/<token>`, is the email module's; its token is
sealed with the credential (below).

## Detection

`detect(domain, definitions, resolve)` asks DNS over HTTPS (Cloudflare's resolver) for TXT, MX and
one TXT per DKIM selector named (CNAMEs seen on the way), then matches fingerprints. **Strong**
evidence names the provider (an SPF include of its domain, a DKIM CNAME to its suffix, an MX host,
its verification record); **weak** only shows a DKIM key at a common selector. A look-alike include
(`notmailgun.org`) is no match. `POST /detect` writes one `suggested` instance per new provider,
"(found in DNS)", no credential, evidence in `detectedBy`; it never sends until a person pastes its
key and activates it. `providers.refingerprint` rereads detected domains daily (`now`, `evidence`,
`checkedAt`, `drift` when less is seen), and `providers.dns` (lane `email`) warns on drift.

## Status and the failover order

`suggested` (detected), `confirmed` (set up or pasted), `active` (sends), `failover` (in order),
`disabled` (out). `registry.pick(db, tenant, kind)` answers the active one, else the first
failover. Activating needs a credential; a suggestion is never activated by itself.

## The checks

| Check | What it does |
| --- | --- |
| `providers.connections` (Status, email lane, `CONNECTIONS_EVERY` 1 h) | Probes each email instance set to send (`CONNECTIONS_MAX` 5) side by side within `CONNECTION_WAIT_MS` (4 s), keeps `last_probe` (only when changed, or daily) without an audit row, and says it in words (`connectionSaid`): 401 or 403 a refused key with the fix, 429 a warning. The active one failing fails the check (two hours open a problem); a failover only warns. A failed write warns, never blaming the service |
| `providers.checkup` (job, hourly) | The `CHECKUP_BATCH` (3) connections of this part's kinds with a key and no check in `CHECKUP_DUE_MS` (20 h), never-checked first. A passing failure (`passingFailure`: timeout, lost connection, 408, 425, 429, 5xx) is retried after `CHECKUP_RETRY_MS` (2 s) and kept as `fixed`. Audited as `providers.checkup`; `GET /checkup` lists every kind |

## Credentials

Secret fields are sealed together under the tenant's data key to the instance's row (a copy on
another row refuses to open); other fields are config in the clear. `registry.open(env, tenant,
id)` hands them to an adapter for one request; a failed open is audited `providers.open`, never
with the value. The seal also holds:

- `HOOK_FIELD`: the report address's token, made at the first paste and kept.
- `ORIGIN_FIELD`: the host the key was saved for (`originOf`: base URL host, SMTP host or endpoint
  as rendered). `open` refuses (`KIT-E-1411`, both hosts named) when the definition or fields now
  name another; a paste to a new host keeps no stored secret. A key from before hosts were kept
  opens only where the kit's own definition sends.

A secret left out of a new paste keeps the stored one. `registry.instance(db, id)` finds one by id
for the public address.

| Function | What it does |
| --- | --- |
| `registry.setOption(env, actor, id, name, value)` | One of `OPTIONS` beside the fields, kept across new keys: `edits` (`on` or `null`), `columns` (2 to 8,000 characters of JSON) |
| `registry.setCredential(..., { replace: true })` | The pasted fields are the whole credential (a sign-in drops a key and the reverse); audited `replaced: true` |
| `registry.renew(env, tenant, id, from, secret)` | Seals `token`, `refresh`, `expires` or `access` a service renewed, only while `from` is still stored (false when another request won); never moves the host; the one unaudited write (Airtable's and Supabase's hourly renewals) |
| `registry.recordUsage(db, id, usage)` | Keeps the provider's used and left |

Audited by the person: `providers.define`, `undefine`, `create`, `credential`, `probe`, `activate`,
`disable`, `rename`, `option`, `remove`, `rewrap`, with field names and never a value.

## Tables and errors

Migration `0010`: `providers_definitions` (the client's rows), `providers_keys` (a wrapped data key
per tenant, its wrapping key's id, rotation time) and `providers_instances` (indexed by tenant,
kind, status, order). `0051` adds `usage`.

| Code | When |
| --- | --- |
| `KIT-E-1401` to `1403` | A bad definition, an unknown one, a missing field |
| `KIT-E-1404`, `1405` | Not ready to activate; the active instance in use |
| `KIT-E-1406` | No client row to remove |
| `KIT-E-1407` | The provider did not take the message |
| `KIT-E-1408` | The definition asks what this kit cannot do |
| `KIT-E-1409` | A report failed its check |
| `KIT-E-1410` | The provider refused a domain call |
| `KIT-E-1411` | A stored key's definition now names another host |

## Not built yet

A batch for Postmark (500 a call, broadcast stream), SendGrid, Mailgun and SES; until then they send
campaigns one call a message.

## Tests

In the Workers runtime beside IAM. `definitions.test.ts`: every kit definition passes the contract,
a bad one fails with its path, data and storage patterns and dialects. `providers.test.ts`: sealed
credentials never in a response or the table; fields missing, unknown, empty or not matching;
data, storage and analytics connections untouched by these routes; activation, failover, `pick`;
client definitions by the Vendor only; host pinning; audit rows; a moved credential refused; rewrap
after a KEK change; the probe. `adapters.test.ts`: the template engine against every definition,
request shapes, blanked refusals, SigV4 against AWS's vector, the SMTP client on 587 and 465
refusing to sign in without TLS. `webhooks.test.ts`: signatures made outside the kit (Standard
Webhooks' vector, Python HMAC, openssl ECDSA and SNS), tampering, old timestamps, wrong keys, the
field maps. `detection.test.ts`: strong and weak evidence, look-alikes, DNS shapes, suggestions and
drift. `domains.test.ts`: the domain client.

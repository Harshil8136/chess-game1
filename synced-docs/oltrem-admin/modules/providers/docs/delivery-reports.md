---
title: "@oltrem/providers: Delivery reports and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/providers/src; split from modules/providers/README.md]
---

# @oltrem/providers: Delivery reports and more

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

A signed timestamp more than five minutes from the clock is refused, SNS's signed `Timestamp`
(when the message was published) included. An SNS subscription is
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

## The connections check

`providers.connections`, in the email lane of Status, every hour (`CONNECTIONS_EVERY`,
2026-11-22, the owner's health watch): it probes each email instance set to send (the active one
and its failovers, 5 at most, `CONNECTIONS_MAX`) through the adapter's `probe`, side by side,
each within 4 seconds (`CONNECTION_WAIT_MS`, opening the key included), keeps each result on the
instance as the probe route does (`last_probe`, without an audit row, since the system asked;
no answer in time is kept as a failed probe), and says what it found
in words (`connectionSaid`). A 401 or 403 is a refused key, with what to do: make a new key and
paste it on Integrations. A 429 is a service asking the portal to wait, and only warns. Anything
else, or no answer in time, did not work, with the provider's words. The active instance failing
fails the check, so two hours in a row open a problem and an alert; a failover one only warns.
A key that can no longer be opened fails, named. The result is written to the instance only when
it changed, or once a day: one row a day for a service that keeps working. A write that fails
turns an OK into a warning that says the answer could not be kept, so a database fault is never
blamed on the service.

## Credentials

The secret fields are sealed together under the tenant's data key to the instance's row, so a
sealed value copied to another row refuses to open; the other fields are config in the clear.
`registry.open(env, tenant, id)` returns the fields to an adapter inside the request that uses
them, and a credential that did not open is written to the audit log as `providers.open`,
`failed`, with the error code and never the value. Beside the pasted fields the seal holds one
the kit makes, `HOOK_FIELD`: the secret token of the instance's address for delivery reports,
made when a key is first pasted and kept when one is pasted again. A secret field left out of a
new paste keeps the stored value, so a signing secret is added without pasting the key again.

A stored key goes only to the host it was saved for. The seal also holds `ORIGIN_FIELD`: the host
the definition sent to when the key was pasted (`originOf`: its base URL's host, SMTP host or
endpoint, rendered with the instance's fields, such as Mailgun's `apiHost` or the SMTP host a person
types). `open` refuses the credential (`KIT-E-1411`, naming both hosts) when the definition, or the
instance's own fields, now name another host, so a changed definition cannot send a stored key
elsewhere; putting the definition back opens it again. A new paste that moves the instance to
another host keeps no stored secret: every secret field is pasted again, and the key is then saved
for the new host. A key sealed before hosts were recorded opens only where the kit's own definition
of that id sends; for a client's own definition it is pasted again. `registry.instance(db, id)`
finds an instance by its id alone, for that public address. Every write is audited under the person
who made it: `providers.define`, `undefine`, `create`, `credential`, `probe`, `activate`, `disable`,
`rename` (the new name, for the data part), `option`, `remove` and `rewrap`, with the field names
and never a value.

`registry.setOption(env, actor, id, name, value)` (for the data part's editing) keeps one of
`OPTIONS` on the instance's config beside its fields: a choice about how the portal uses it, not
part of its key. `edits` (`on`, or `null` to take it away): a connected database whose rows the
portal may change. `columns` (JSON of 2 to 8,000 characters, no control characters): the data part's
hidden and masked columns. A new key for the same host keeps the options.

`registry.setCredential(env, actor, id, fields, { replace: true })` (for Sign in with PostHog and
Google Analytics) keeps none of the stored secrets: the pasted fields are the whole credential, so a
key pasted over a sign-in drops its tokens and signing in again drops a key. The audit row says
`replaced: true`. Without `replace`, a secret left out keeps the stored value, as above.

`registry.renew(env, tenant, id, from, secret)` (for Sign in with Airtable; since 2026-11-25 also
Sign in with Supabase's Management API tokens, so `access` is one of the fields it may write beside
`token`, `refresh` and `expires`) seals secrets the service itself renewed over the credential
`from` was opened from, and writes them only while that credential is still the one stored (`UPDATE
… WHERE credential = <the one read>`): it answers false when another request renewed it first, so
two renewals at once never overwrite each other. It cannot move the key to another host. It is the
one write that is not audited: the data part's timed check renews a signed-in Airtable connection
every hour, and no person's access changes.

## Tables and errors

Migration `0010`: `providers_definitions` (the client's rows), `providers_keys` (one wrapped data
key per tenant, with the id of the key that wrapped it and when it was rotated) and
`providers_instances` (indexed by tenant, kind, status and failover order). Migration `0051`
adds `usage` to the instance: what its provider last said was used and left, as JSON, written by
`registry.recordUsage(db, id, usage)`. Error codes
`KIT-E-1401` to `1411`: a bad definition, an unknown one, a missing field, an instance not ready
to activate, the active instance in use, the kit's definition that has no row to remove, a
provider that did not take the message, what the definition asks for that this kit version
cannot do, a delivery report that failed its check, a provider that refused a domain call
(`KIT-E-1410`), and a stored key whose definition now names another host (`KIT-E-1411`).

## Not here yet

The Integrations page exists and live portals send through it; a definition no portal has sent
through yet stands on the provider's public reference. A batch for Postmark (500 a call, on a broadcast message stream),
SendGrid, Mailgun and Amazon SES: until then they send campaigns one message a call.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the seven definitions pass
the contract and a bad one is refused with its path; an instance set up with its credential sealed
to its row and the key nowhere in a response or the table; a missing, unknown or empty field
refused; a pattern matched against the whole value only, and a value past 500 characters refused;
the five data definitions each naming its dialect, with a pattern that takes the service's own
address and refuses another, Neon's connection string checked, a data definition without a pattern
on its host refused; a data connection neither made, listed nor touched through these routes; the
seven storage definitions speaking S3 with their key fields, a host pattern refusing a scheme or a
path, and a storage connection neither made, listed nor touched here; activation and the failover
order, `pick`, the active instance not removable, a suggestion not activatable; a client's
definition added by the Vendor, replacing the kit's and removed, and refused to the Owner and to
whoever sets up integrations; a stored key refused when its definition or its host field names
another host, opened again when put back, bound to the new host only when pasted again, and an older
key without a host held to the kit's definition; the audit rows with field names and no value; a
credential moved to another row refused and recorded; the data keys wrapped again after the KEK
changed, and opened under the new key alone; the probe route with the sealed key, its result kept
and audited. The adapters without the network: the template engine against every kit definition
(nothing left unrendered, no field the definition does not list); one request shape per HTTP
provider against a scripted fetch; a refusal with the key blanked; a bad message refused before any
request; SigV4 against AWS's published vector and one computed apart; the SMTP client against a
scripted server on a fake socket, on 587 and 465, refusing to sign in without TLS. The webhooks
against reports signed outside the kit: the Standard Webhooks published vector, a Mailgun HMAC made
in Python, SendGrid and SNS signatures made with openssl (SNS with SHA-256 and SHA-1); a changed
body, an old timestamp (SNS's publish time too), another key or topic, a certificate address that is
not AWS's and a missing key field refused; every provider's events read by its field map; an
unmapped or inherited event name ignored. The detection against small zones: strong and weak
evidence, a look-alike include refused, the resolver's TXT chunks, CNAMEs, missing names and
failures; through the route, the suggestions written once, refused to activate, audited, and the
daily re-check marking the one whose records went, with the health check warning.

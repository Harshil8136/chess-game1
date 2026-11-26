---
title: "@oltrem/providers: the definitions"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/providers/src/definition.ts, definitions/, registry.ts]
---

# @oltrem/providers: the definitions

> Part of [the @oltrem/providers README](../README.md).

## What the kit ships

| Kind | File | Definitions |
| --- | --- | --- |
| `email` | `src/definitions/email.ts` | 12: Resend, Brevo, Postmark, SendGrid, Mailgun, Amazon SES, Sender (API and SMTP relay), Mailjet, Mailtrap, SMTP2GO, any SMTP server |
| `forwarding` | `src/definitions/forwarding.ts` | ImprovMX (basic auth, user `api`): its aliases and logs; nothing is sent through it, so no send, reports or fingerprint |
| `data` | `src/definitions/data.ts` | 5, read by [`@oltrem/data`](../../data/README.md) in their `data` block's dialect: Turso (`libsql`), Neon (`neon`), Supabase (`postgrest`), Airtable (`airtable`), Upstash Redis (`upstash-redis`) |
| `analytics` | `src/definitions/analytics.ts` | 7, read by [`@oltrem/connect`](../../connect/README.md) for `web-report`: PostHog, Plausible, Umami, Cloudflare Web Analytics, Google Analytics 4, Matomo, Fathom |
| `storage` | `src/definitions/storage.ts` | 7, S3 with `sigv4` for [`@oltrem/files`](../../files/README.md): Amazon S3, Cloudflare R2 elsewhere, Backblaze B2, Wasabi, DigitalOcean Spaces, Supabase Storage, any S3 service |

Each definition is written from the provider's public reference; nothing is guessed. A
fingerprint (SPF includes, DKIM selectors, CNAME suffix, verification TXT prefix) is written only
where research confirmed it.

The routes below, held by whoever runs email, never make, list or touch a `data`, `analytics` or
`storage` connection (setting one up is an unknown definition; any instance route answers 404), so
`providers.manage` cannot replace a client's database, bucket or analytics app. Data guides ask
for the smallest key (read-only where offered; Supabase's secret key passes row level security,
which its recipe says). Supabase also takes an access token, Neon and Turso an `api` key, for
usage. PostHog's and Google Analytics' key is optional: `SIGN_IN_FIELDS` names the secret fields a
sign-in fills, never typed in a form and refused when posted. Google's and Matomo's auth is `none`
(the reader asks Google for a token; Matomo's goes in a POST body).

## What a definition holds

| Part | What it says |
| --- | --- |
| Transport | Ten email definitions use the HTTP template engine: a base URL, a send template with `{{secret.x}}`, `{{config.x}}` and `{{message.x}}` (a `$each`/`$as` pair maps a list), a JSON or form body, where the id is read. Two use the SMTP client (Sender's relay on 587, any server) |
| Copies | Every HTTP definition but Sender's sends `cc` and `bcc` in its own field (`{{message.cc}}`, `{{message.ccList}}`); SMTP writes `Cc` and never `Bcc` |
| Auth | `bearer`, `basic`, `api-key-header`, `sigv4`, `smtp-plain`, `none` |
| Fields | What a person pastes and which are secret; `wrong` refuses values surely misplaced (Brevo's `xsmtpsib-` SMTP key as the API key, `xkeysib-` as the SMTP password); `optional` ones (the webhook keys) may be left out; `pattern` (a regular expression and the problem) matched whole, on at most `PATTERN_VALUE_MAX` (500) characters, before any call |
| Recipe | Where to make the key, its scopes, test and rotation, what stops without it, and a `guide` (`src/definitions/guides.ts`): the dashboard steps for the key, the domain and reports, each linked and dated, with the provider's own guide |
| Webhooks | The signature scheme and the paths of event type, id, recipient, time and reason, with the map to the kit's nine kinds. An entry may say `permanent` or `automatic` (Brevo's Apple proxy opens); a `severity` path reads for-good from the report (Resend `bounce.type`, Postmark `Type`, SendGrid `type`, Mailgun `severity`, SES `bounceType`, Mailjet `hard_bounce`, SMTP2GO `bounce`); `eventsPath` where events sit in an object (Mailtrap) |
| `domains` | `create`, `read`, `verify` (method, path, body with `{{domain.name}}`, `{{domain.id}}`), `idPath`, the verified path and values, and the records' paths and found values. Resend and Brevo |
| `identities` | Up to three lists of what the account may send from (`itemsPath`, `namePath` with `*@domain`, `okPath` and `ok`, the display name), `needs`, and `auth: false` with `headers` for a second key. Resend, Brevo, SendGrid, Postmark, Mailgun, SES, Mailjet, SMTP2GO |
| `status` | The provider's status page (`https://` host, `/api/v2/status.json`) for System status's Service status: Resend, Brevo, Mailgun, Mailjet, SMTP2GO |
| `batch`, `usage`, `testInbox`, `probe.ready`, `alwaysTracks` | See [the adapters](routes.md#the-adapters) |

A data, analytics or storage definition must put a `pattern` on its `host` field and every field
its address is built from (a database address ends in `.turso.io`, `.neon.tech`, `.supabase.co`,
`.upstash.io`; Neon's string starts `postgresql://`), so a key is never sent elsewhere; the host is
also pinned in the seal.

## Providers with limits

| | What differs |
| --- | --- |
| Sender | One recipient a message (`oneRecipient`): more, or a copy, is refused before any call (`KIT-E-1408`) and fails over, or uses the relay. Reply-To goes among headers (`{{message.headersWithReplyTo}}`). No published webhook signature, allowance or domain API: it sends, is probed and counted, and its domain is set up in its dashboard |
| Mailjet | `POST /v3.1/send`, the `MessageUUID` kept; the key pair as basic auth; probe lists senders; unsigned reports matched by `Message_GUID`; no allowance |
| Mailtrap | `POST /api/send` on `send.api.mailtrap.io` with a `User-Agent`; a bearer token; no probe (the canary is the test); `hmac-body` reports in `events`; no allowance; its identities need an account number no field holds |
| SMTP2GO | `POST /v3/email/send`, Reply-To in `custom_headers`; a 200 counts only while `data.failed` is 0 (`send.acceptedWhen`); `X-Smtp2go-Api-Key`; unsigned reports by `email_id`; the month's cycle as allowance |

Mailjet, Mailtrap and SMTP2GO have no `batch` or `domains` block yet.

## The contract

`defineProvider` checks a definition where it is written and `definitionProblems` lists what is
wrong with its path; a client's definition through the route is checked the same way. The kit's own
are frozen by `kitProvider` without the check, which `test/definitions.test.ts` runs instead. It
refuses: a misshapen id or field name, a non-`https` base URL, a port other than 465 or 587, SMTP
with an HTTP auth scheme, `api-key-header` without its header, `sigv4` without its service, a
repeated field, a `data` block on another kind (or none on `data`), a bad `pattern`, a data,
analytics or storage address field without one, an unknown event kind, a signature without its key field,
`hmac-body` without its header, and report steps without a webhook block.

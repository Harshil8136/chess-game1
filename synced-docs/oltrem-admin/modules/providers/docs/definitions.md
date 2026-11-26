---
title: "@oltrem/providers: The definitions: Send, Key, Probe, Reports, Allowance"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/providers/src; split from modules/providers/README.md]
---

# @oltrem/providers: The definitions: Send, Key, Probe, Reports, Allowance

> Part of [the @oltrem/providers README](../README.md).

## The definitions

The kit ships twelve email definitions in `src/definitions/email.ts`, each written from the
provider's public API reference: Resend, Brevo, Postmark, SendGrid, Mailgun, Amazon SES, Sender (its
API and its SMTP relay), Mailjet, Mailtrap, SMTP2GO and any SMTP server. Ten are the HTTP template
engine's: a base URL, a send template with `{{secret.x}}`, `{{config.x}}` and `{{message.x}}`
placeholders (a `$each`/`$as` pair maps a list), a JSON or form body, where the message id is read
from, a probe. Two are the SMTP client's: Sender's relay (`smtp.sender.net`, 587) and any server. A
message may carry copies, `cc` and `bcc` : each HTTP definition but Sender's sends them in its own
field (`{{message.cc}}`, `{{message.ccList}}` and the same for `bcc`, gone when there are none), and
the SMTP client writes a `Cc` header and gives every copy as a recipient, never writing `Bcc`. Every
one names its auth scheme (`bearer`, `basic`, `api-key-header`, `sigv4`, `smtp-plain`), the fields a
person pastes with which are secret (a field's `wrong` names values that are surely the wrong thing
by how they start, refused on save with what to paste instead: Brevo's SMTP key, `xsmtpsib-`, where
its API key goes, and its API key, `xkeysib-`, as an SMTP password), a recipe (where to create the
key, its scopes, how to test and rotate it, what the kit does without it, and a `guide`: the steps
in the provider's own dashboard for the key, the sending domain and the delivery reports, each with
a link to the page it names, the day they were checked and the provider's own guide for when its
screens change; the steps live in `src/definitions/guides.ts`, and report steps without a webhook
block are refused), and, where the provider signs its webhooks, the signature scheme and the paths
of the event type, message id, recipient, time and reason with the map of its event names to the
kit's nine kinds. An entry of the map may be an object that also says a bounce or refusal is for
good (`permanent`) or an open was a machine's (`automatic`, such as Brevo's Apple privacy proxy
opens); where the provider says it in the report itself, a `severity` path names the field and the
values that mean for good and for now (Resend's `bounce.type`, Postmark's `Type`, SendGrid's `type`,
Mailgun's `severity`, SES's `bounceType`, Mailjet's `hard_bounce`, a flag read as `true` or `false`,
SMTP2GO's `bounce`). A report that is an object holding the list names where it is (`eventsPath`:
Mailtrap's `events`); a list where the definition expects one event (Mailjet's "Group events"
setting) is read whole. A fingerprint (SPF includes, DKIM selectors or CNAME suffix, a verification
TXT prefix) is written only where the research confirmed the pattern; the rest is left for the
sandbox to confirm, never guessed.

The kit also ships one definition of the kind `forwarding`, in `src/definitions/forwarding.ts`:
ImprovMX, which forwards the mail sent to a domain's addresses on to people's own inboxes. Its key
(basic auth, user `api`) manages ImprovMX's aliases and reads its forwarding logs; nothing is sent
through it, so it has no send, no reports and no fingerprint (a domain whose MX is ImprovMX's is
never suggested as an email provider). Oltrem Mail's Forwarding page keeps the key here, sealed like
any other, and speaks to ImprovMX itself.

The kit also ships five definitions of the kind `data`, in `src/definitions/data.ts`: a client's own
database or data service, read by the Connected data module ([`@oltrem/data`](../../data/README.md)).
Each names the dialect it is read with in its `data` block, and only a data definition has one:
Turso (`libsql`), Neon (`neon`), Supabase (`postgrest`), Airtable (`airtable`) and Upstash Redis
(`upstash-redis`). Each guide asks for the smallest key the service offers, read-only where there is
one (Turso's `--read-only` token, a Neon role made with `--access read_only`, Upstash's Read Only
token, an Airtable token with `data.records:read` and `schema.bases:read`); Supabase has no
read-only key, so its guide says the secret key passes row level security and that the portal only
reads with it. Supabase also takes an optional access token, for its Management API, and Neon and
Turso an optional API key (`api`, after the database's own key, which stays the one the database is
read with), for their usage (the data module's README). The steps were checked against each
service's own documentation that day. The Email services page lists none of them: a database is
connected under Connected data. The routes below, held by whoever runs email, refuse a connection of
the kind `data` too: setting one up is refused as an unknown definition, the listing leaves them
out, and every route on one instance answers as if it were not there (404), so `providers.manage`
cannot replace or remove a client's database connection.

It also ships four definitions of the kind `analytics`, in `src/definitions/analytics.ts`: the app a
company already counts its website's visitors with, connected on the Apps page and read by
[`@oltrem/connect`](../../connect/README.md) (Website analytics) for the Analytics page. PostHog (a
personal API key with Query Read, its region and project), Plausible (a Stats API key, its address
and site), Umami (an API key, Cloud's address or its own server's, and the website's ID), Cloudflare
Web Analytics (a token with Account Analytics Read, the account ID and the site tag), Google
Analytics 4 (a service account's JSON key and the property ID), Matomo (an auth token, its address
and the site ID) and Fathom (an API key and the site ID), each capable of `web-report`. Google's and
Matomo's say auth `none`: the reader asks Google for a token with the key, and sends Matomo's token
in the body of a POST. As with a data definition, the field an address is built from must carry a
`pattern`, so a key is never sent elsewhere. The routes below treat one as they treat a data
connection: not listed, not counted on Home, 404 on every instance route. PostHog's and Google
Analytics' key is optional since the same day: `SIGN_IN_FIELDS` names the secret fields a sign-in
fills (a token, a refresh token, when it ends, and PostHog's client), all optional, never typed into
a form and refused when posted by hand; the Apps page asks for the key only when someone connects
without signing in.

It also ships six definitions of the kind `storage`, in `src/definitions/storage.ts`: a bucket of
the client's own that the Files module may keep a location's files in
([`@oltrem/files`](../../files/README.md), Storage locations). Each speaks S3 with `sigv4` (transport
`s3`: the endpoint and region built from config fields) and takes the secret fields `accessKeyId`
and `secretAccessKey`: Amazon S3 (the bucket in the host name), Cloudflare R2 in another account,
Backblaze B2, Wasabi, DigitalOcean Spaces, Supabase Storage (at the project's own storage host,
signed for its region) and any other S3 service by its endpoint (the bucket in the path). A storage
definition whose address is built from a field without a `pattern` is refused, as for data. Each
guide asks for a key limited to the one bucket where the service has one; Supabase's keys open every
bucket of the project and pass by row level security, which its recipe says. They are joined on
Files, Storage by an Owner; like a data connection, the routes below neither make, list nor touch
one, and the Email services page and its Home card leave them out.

A field may say what its whole value must look like (`pattern`, 2026-11-22): a regular
expression and the problem to show. It is matched against the whole value whatever the
definition wrote (wrapped as `^(?:…)$`), on a value of at most 500 characters
(`PATTERN_VALUE_MAX`); a value that does not match is refused before any call. The data
definitions use it so a database address ends in the service's own domain (`.turso.io`,
`.neon.tech`, `.supabase.co`, `.upstash.io`) and Neon's connection string starts with
`postgresql://`, and a key is never sent elsewhere; the host the key was saved for is pinned in
its seal besides, as for every credential. A data definition must carry a pattern on its `host`
field and on every field its base URL is built from, or the contract refuses it.

Sender takes one recipient a message: its send says `oneRecipient`, and a message to more, or with a
Cc or Bcc, is refused before any call (`KIT-E-1408`), so it goes through the failover, or through
Sender's SMTP relay, which takes many. It has no reply-to field, so `{{message.headersWithReplyTo}}`
sends Reply-To among the headers. Its webhooks carry only bounces, on its paid plans, signed with a
header it does not publish; it publishes no count of emails used or left and no domain API. So a
Sender instance sends, is probed and is counted by the portal, while its delivery reports, its
allowance and its domain set-up wait for the sandbox: the domain is set up in Sender's dashboard.

Mailjet, Mailtrap and SMTP2GO were added from their references the same day:

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
submitted through the route is checked the same way. The kit's own definitions are frozen by
`kitProvider`, which skips the check so a Worker's start does not repeat it;
`test/definitions.test.ts` checks each of them instead. The contract refuses an id or field name in
the wrong shape, a base URL that is not `https`, a port other than 465 or 587, an SMTP transport
with an HTTP auth scheme, `api-key-header` without its header, `sigv4` without its service, a
repeated field name, a `data` block on a definition of another kind or none on a `data` one, a
`pattern` that is not a regular expression, a data or analytics definition whose address field has
no pattern, an event mapped to an unknown kind, a webhook signature without the field it reads its
key from, `hmac-body` without its header. A field marked `optional` may be left out of an instance:
the webhook keys are, so a provider sends before its delivery reports are set up.

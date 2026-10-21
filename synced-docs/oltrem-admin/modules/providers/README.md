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
const iam = createIam<Env>({ bindings, audience: env.ACCESS_AUD });
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

## The definitions

The kit ships seven email definitions in `src/definitions/email.ts`, each written from the
provider's public API reference: Resend, Brevo, Postmark, SendGrid, Mailgun, Amazon SES and any
SMTP server. Six are the HTTP template engine's: a base URL, a send template with `{{secret.x}}`,
`{{config.x}}` and `{{message.x}}` placeholders (a `$each`/`$as` pair maps a list), a JSON or
form body, where the message id is read from, a probe. One is the SMTP client's. Every one names
its auth scheme (`bearer`, `basic`, `api-key-header`, `sigv4`, `smtp-plain`), the fields a person
pastes with which are secret, a recipe (where to create the key, its scopes, how to test and
rotate it, what the kit does without it), and, where the provider signs its webhooks, the
signature scheme and the paths of the event type, message id, recipient, time and reason with the
map of its event names to the kit's nine kinds. A fingerprint (SPF includes, DKIM selectors or
CNAME suffix, a verification TXT prefix) is written only where the research confirmed the
pattern; the rest is left for the sandbox to confirm, never guessed.

`defineProvider` checks a definition against the contract where it is written, and
`definitionProblems` returns what is wrong, one line each with the path; a client's definition
submitted through the route is checked the same way. The contract refuses an id or field name in
the wrong shape, a base URL that is not `https`, a port other than 465 or 587, an SMTP transport
with an HTTP auth scheme, `api-key-header` without its header, `sigv4` without its service, a
repeated field name, an event mapped to an unknown kind.

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
| `POST /instances/:id/credential` | manage | the fields again (a new key, a changed domain); a suggestion becomes confirmed |
| `POST /instances/:id/activate` | manage | this instance sends; the one that was active becomes the first failover |
| `POST /instances/:id/disable` | manage | out of the failover order |
| `POST /instances/:id/probe` | manage | reaches the provider with the sealed credential; the result (ok, when, how long, the provider's words) is kept on the row and audited as `providers.probe` |
| `DELETE /instances/:id` | manage | removes it with its credential; the active one is refused (`KIT-E-1405`) |
| `POST /keys/rewrap` | manage | after the KEK secret changed: every tenant's data key wrapped again under the current key |

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
  secret value of the instance blanked. A probe never throws: it answers `{ ok, checkedAt,
  latencyMs, detail }`.

## Status and the failover order

`suggested` is what the detection will write (a later slice); `confirmed` is an instance a person
set up or a suggestion whose credential was pasted; `active` sends; `failover` stands in, in
order; `disabled` is out. `registry.pick(db, tenant, kind)` is what the email module will ask:
the active instance, else the first failover. Activating an instance needs its credential, and a
suggestion is never activated by itself (plan 8.3).

## Credentials

The secret fields are sealed together under the tenant's data key to the instance's row, so a
sealed value copied to another row refuses to open; the other fields are config in the clear.
`registry.open(env, tenant, id)` returns the fields to an adapter inside the request that uses
them, and a credential that did not open is written to the audit log as `providers.open`,
`failed`, with the error code and never the value. Every write is audited under the person who
made it: `providers.define`, `undefine`, `create`, `credential`, `probe`, `activate`, `disable`,
`remove` and `rewrap`, with the field names and never a value.

## Tables and errors

Migration `0010`: `providers_definitions` (the client's rows), `providers_keys` (one wrapped data
key per tenant, with the id of the key that wrapped it and when it was rotated) and
`providers_instances` (indexed by tenant, kind, status and failover order). Error codes
`KIT-E-1401` to `1408`: a bad definition, an unknown one, a missing field, an instance not ready
to activate, the active instance in use, the kit's definition that has no row to remove, a
provider that did not take the message, and what the definition asks for that this kit version
cannot do.

## Not here yet

The webhook verifiers, the detection that writes suggestions, the email module that calls `pick`
and `send`, the recipe pages and the screens: the next slices of phase 4. No adapter has spoken
to a real provider yet: the request shapes stand on the public references until the sandbox
sends through two of them.

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
refusing to sign in without TLS.

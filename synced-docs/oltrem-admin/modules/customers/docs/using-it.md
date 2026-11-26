---
title: "@oltrem/customers: Using it; Signing in; Sign-in services; Who may do what; The pages"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/customers/src; split from modules/customers/README.md]
---

# @oltrem/customers: Using it; Signing in; Sign-in services; Who may do what; The pages

> Part of [the @oltrem/customers README](../README.md).

## Using it

```ts
import { createCustomers } from '@oltrem/customers';
import { doorViews, pages as customersPages } from '@oltrem/customers/pages';
import { withPages } from '@oltrem/core-module';

const customers = createCustomers<Env>({
  bindings: (env) => ({ db: env.DB }),
  // The code and the link are plain messages; the client template sends them through email.
  send: async (env, message) => {
    await email.send(env, {
      tenantId: message.tenantId,
      template: 'customers.message',
      to: [{ email: message.to }],
      data: { subject: message.subject, text: message.text },
      messageKey: message.key,
    });
  },
  // Seals each sign-in service's client secret; without it, no service can be connected.
  kek: (env) => env.KEK,
  // The portal's modules, made after this one: each that declares `customer` adds its section
  // to the account page.
  modules: () => modules,
});
const modules = [iam.module, /* ... */ withPages(customers.module, customersPages)];

createApp<Env>({
  modules,
  // The door answers before any Access identity is read.
  publicRoutes: (routes) => {
    const door = customers.door({
      portal: client.name,
      views: doorViews,
      document: screens.customerPage,
    });
    routes.all('/account', (c) => door.handle(c.req.raw, c.env));
    routes.all('/account/*', (c) => door.handle(c.req.raw, c.env));
  },
  // ...
});
```

`createCustomers` returns the `store`, the `services`, the module manifest and `door`. It stands on
the IAM module (sessions, the authorizer) and the audit log. It adds four tables and no binding,
variable or setting; it reuses the KEK secret the providers already seal their keys with.

### The door and Cloudflare Access

Staff sign in through Cloudflare Access, which stands in front of the whole portal. Customers do
not: Access's free plan counts 50 people, and each customer would be one of them. So the client
lets `/account` past Access, with a self-hosted Access application on the portal's address with
the path `account` and a Bypass policy, the same step as for `/hooks` and `/healthz`
(`oltrem deploy` prints it). The pipeline hands every request under `/account` to the door before
it reads any Access identity:

- the door reads only its own cookie, so a staff sign-in never opens a customer's page;
- every other path still needs Access, so a customer's cookie opens no staff page or route;
- the door's forms are refused unless they come from the portal's own page (their `Origin`, or a
  browser's `Sec-Fetch-Site: same-origin`), and every answer is `no-store`;
- a form's body is read only up to 4 KB (an address or a six-digit code needs far less), so a long
  one is never held whole, and a link whose path is not valid percent-encoding leads back to the
  account page or the sign-in, never to an error.

Until the Bypass is added, a customer who opens `/account` meets the Access sign-in, which lets in
only the addresses it allows.

## Signing in

```mermaid
sequenceDiagram
  participant C as Customer's browser
  participant D as Door at /account
  participant DB as D1
  participant E as Email
  C->>D: POST /account/sign-in (address)
  D->>DB: count this hour's requests; is it a customer who is on?
  D->>DB: store the code's hash, ten minutes
  D->>E: the code, when it is a customer's address
  D-->>C: 303 to /account/code (the same for any address)
  C->>D: POST /account/code (six digits)
  D->>DB: right, unused, not expired? mark it used; a new sign-in
  D-->>C: 303 to /account, with the sign-in's cookie
```

| Rule | Why |
|---|---|
| The answer to an address is the same whether it is a customer's or not, and so is the code page | Nobody learns who is a customer by trying addresses |
| Only addresses staff added get a code; a customer who is off gets none | Nobody signs themselves up; the company decides who its customers are |
| A code is six digits, drawn evenly, kept only as the SHA-256 of its row id and itself | A copy of the database shows no code |
| A code lasts ten minutes, once; a new code ends the last; five wrong tries end it (audited as `customers.code-burned`) | Guessing a code is one in a million per try, and five tries a code |
| An address gets five codes an hour; a network (the hash of its address) asks thirty times an hour, then the page says to wait | A mailbox is not flooded, and one network cannot try many addresses |
| A sign-in is 32 random bytes in a `__Host-` cookie (`Secure`, `HttpOnly`, `SameSite=Lax`, thirty days), kept only as its SHA-256 | The cookie stays on this host over HTTPS, scripts cannot read it, and a copy of the database opens nothing |
| A sign-in ends after thirty days, when the customer signs out, signs out of the other devices, is switched off, or staff end their sign-ins | A lost phone is closed from either side |

Every sign-in is in the audit log as `customers.sign-in` by `customers.door`, with the customer's
id. Requests for a code are rows in `customers_codes`, deleted after a day.

## Sign-in services

A company whose customers already have an account somewhere (its own app on Auth0 or Supabase, a
Google Workspace, Okta, Keycloak) can offer "Continue with" that service at the door, beside the
emailed code, which always stays. Whoever holds `customers.services` connects one on
`/customers/sign-in` with three things the service gives when an application is made there: the
issuer address, a client id and a client secret. The application at the service is given the
return address `https://<portal>/account/return`.

```mermaid
sequenceDiagram
  participant C as Customer's browser
  participant D as Door at /account
  participant S as Sign-in service
  C->>D: GET /account/with/<service>
  D-->>C: 303 to the service, with state, nonce and a PKCE challenge; the three kept in a cookie
  C->>S: signs in there
  S-->>C: 303 to /account/return with a code and the state
  C->>D: GET /account/return
  D->>S: the code, the PKCE verifier, the client id and secret (server to server)
  S-->>D: an ID token
  D->>D: issuer, this client, the nonce, the time, a verified address; a customer who is on?
  D-->>C: 303 to /account, with the sign-in's cookie
```

| Rule | Why |
|---|---|
| Connecting reads the service's `<issuer>/.well-known/openid-configuration` first; the issuer it names must be the one typed, and its addresses HTTPS | A typo or a look-alike service is refused before anything is kept |
| The client secret is sealed under the KEK with its own data key, bound to its row; no page or route shows it again | A copy of the database shows no secret |
| The trip carries `state`, `nonce` and a PKCE `S256` challenge, kept in a `__Host-` cookie for ten minutes | Nobody can finish another browser's sign-in, replay a token or use a stolen code |
| The ID token comes straight from the service's token endpoint over HTTPS, as OpenID Connect Core 3.1.3.7 allows, and its issuer, audience (and `azp`), nonce and times (two minutes' skew) are checked | The token is the service's answer to this sign-in and no other |
| The token must say the address was verified (`email_verified`), and the address must be a customer the company added who is on | A service proves an address; the company still decides who its customers are |
| A sign-in made this way is the same `__Host-` sign-in as the code's, marked with the service's name, and audited as `customers.sign-in` | Ending sign-ins, switching off and signing out work the same |
| Each call to the service (its details, the token) gives up after ten seconds (`SERVICE_LIMITS.callSeconds`) | A service that hangs fails the sign-in with a reason instead of holding the customer's page |

Services that fit: any OpenID Connect provider that publishes its details at the issuer and puts
`email_verified` in its ID tokens, such as Auth0, Okta, Keycloak and Google. Supabase's OAuth 2.1
server fits too: its issuer is the project's `/auth/v1` address, its project needs asymmetric
signing keys, and the company's own app shows its consent page. Microsoft Entra ID's tokens carry no
`email_verified`, so the door refuses their sign-ins. A company connects ten services at
most; one that is switched off disappears from the door, and sign-ins made with it stay.

## Who may do what

Three capabilities on bit plane `26`, held across the company:

| Capability | Lets them |
|---|---|
| `customers.view` | see the customers, search them, and when each signed in; see the sign-in services, never their secrets |
| `customers.manage` | add a customer, change their name and note, switch them off and on, end their sign-ins, email them the link |
| `customers.services` | connect, switch and remove the sign-in services (admin class, a fresh sign-in) |

A customer holds no capability: the door is the only place they reach.

## The pages

| Path | Shows |
|---|---|
| `/customers` | where customers sign in (this portal's `/account`); how many customers there are and how many are on; to whoever manages them "Add a customer" in a dialog (address, name, a note only staff see, and "Email them the link to sign in", ticked); a search by name or address; the customers by name with their state, address and last sign-in. An address that is a customer already is refused with a link to open that customer. Beside it, to whoever manages them, "Import from a spreadsheet" in a dialog: a CSV file with Email and Name columns (Note if wanted, in any order); the notice after says how many were added and how many skipped as customers already, and nobody is emailed |
| `/customers/sign-in` | how customers sign in: the emailed code always; the sign-in services with their state, issuer and last use; to whoever may set them up "Connect a service" in a dialog (the name on the button, the issuer address, the client id, the client secret) and, in each row, "Stop offering" or "Offer again" and "Remove", confirmed in a dialog; the return address to give the service |
| `/customers/:id` | one customer: on or off, the address, who added them and when, the last sign-in; a row with "Make a quote for them" and "Make an invoice" (to whoever makes them somewhere, while the customer is on, with the address filled in), and to whoever manages them "Email the sign-in link", "Change", "End their sign-ins (n)", "Switch back on" and "Switch off", each confirmed in a dialog; the note; their quotes and their invoices, the newest five of each with "All of them" (read through those modules' own APIs, so a portal without one, or a person who does not see them, gets no section); the sign-ins, the newest first, with the browser, how and when. The notice after an add or an email of the link says the email is queued; one that no email service took links Email settings |
| `/account/sign-in` | the customer's door: their address and "Email me a code", and "Continue with" each service that is on |
| `/account/code` | the code from the email, with the phone's one-time-code keyboard, and a link to ask for a new one |
| `/account/open/<module>/<id>` | one thing a module showed the customer, a file to download, say; the module checks again that it is theirs; anything else returns to `/account` with "That is no longer open to you" |
| `/account/act/<module>/<id>/<action>` | a button on the account page, accept a quote, say: posted by the signed-in customer, the module checks again that the item is theirs and still takes that answer, then back to `/account` with "Thank you: we have your answer", or "That is no longer open to you" |
| `/account` | the customer's account: their name and address, Sign out; a section for each module that shows the customer their own things (the newest 20, each with its state, its date and any replies; "Nothing yet"; a section that could not be read says so and the rest still shows); an item's first button posts at once, and any other, Decline say, opens below to ask "Are you sure? Your answer is final." before "Yes, decline" posts it (a disclosure, so the door needs no script); where they are signed in (this device marked) and "Sign out on the other devices" |

The door's pages use the portal's look, without the staff sidebar; the mark at the top leads to
`/account`.

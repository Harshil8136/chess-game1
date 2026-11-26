---
title: "@oltrem/customers: using it, signing in, sign-in services, who may do what, the pages"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/customers/src/door.ts, customers.ts, services.ts, module.ts, pages.tsx]
---

# @oltrem/customers: using it, signing in, sign-in services, who may do what, the pages

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

`createCustomers` returns the `store`, the `services`, the module and `door`, on the IAM module and
the audit log. It adds four tables and no binding, variable or setting, reusing the providers' KEK.


## The door and Cloudflare Access

Staff come through Access; customers do not (Access's free plan counts 50 people). The client
lets `/account` past Access with a self-hosted application on the path `account` and a Bypass
policy, as for `/hooks` and `/healthz` (`oltrem deploy` prints it); until then a customer meets the
Access sign-in. The pipeline hands `/account` to the door before reading any Access identity:

- the door reads only its own cookie, so a staff sign-in opens no customer page, and every other
  path still needs Access, so a customer's cookie opens no staff page;
- its forms need the portal's own `Origin` or `Sec-Fetch-Site: same-origin`; answers are
  `no-store`;
- a form body is read only to 4 KB (`FORM_MAX`); a path that is not valid percent-encoding leads
  back to the account or the sign-in, never an error.

## Signing in

```mermaid
sequenceDiagram
  participant C as Customer's browser
  participant D as Door at /account
  participant DB as D1
  participant E as Email
  C->>D: POST /account/sign-in (address)
  D->>DB: count this hour's requests; a customer who is on?
  D->>DB: store the code's hash, ten minutes
  D->>E: the code, only to a customer's address
  D-->>C: 303 to /account/code (the same for any address)
  C->>D: POST /account/code (six digits)
  D->>DB: right, unused, in time? mark used; a new sign-in
  D-->>C: 303 to /account with the sign-in cookie
```

| Rule (`LIMITS`) | Why |
|---|---|
| The same answer and code page for any address | Nobody learns who is a customer |
| Only addresses staff added, and on, get a code | The company decides who its customers are |
| Six digits drawn evenly, kept as the SHA-256 of its row id and itself | A database copy shows no code |
| `codeMinutes` (10), once; a new code ends the last; `tries` (5) wrong end it (`customers.code-burned`) | One in a million a try, five tries a code |
| `perAddress` (5) codes an hour; `perNetwork` (30) requests an hour by the network's hash | No flooded mailbox, no address sweeping |
| 32 random bytes in `__Host-oltrem_customer` (`Secure`, `HttpOnly`, `SameSite=Lax`, `sessionDays` 30), kept as its SHA-256, marked used at most hourly | HTTPS only, unreadable by scripts, a copy opens nothing |
| Ends after 30 days, on sign out, sign out of other devices, switched off, or staff ending sign-ins | A lost phone is closed from either side |

Each sign-in is audited `customers.sign-in` by `customers.door`.

## Sign-in services

A company whose customers have an account elsewhere (its app on Auth0 or Supabase, Google
Workspace, Okta, Keycloak) can offer "Continue with" it beside the code, which always stays.
`customers.services` connects one on `/customers/sign-in` with the issuer, a client id and secret;
the service's application gets the return address `https://<portal>/account/return`.

```mermaid
sequenceDiagram
  participant C as Customer's browser
  participant D as Door at /account
  participant S as Sign-in service
  C->>D: GET /account/with/<service>
  D-->>C: 303 to the service with state, nonce, PKCE challenge (kept in a cookie)
  C->>S: signs in
  S-->>C: 303 to /account/return with a code and the state
  C->>D: GET /account/return
  D->>S: code, verifier, client id and secret (server to server)
  S-->>D: an ID token
  D->>D: issuer, client, nonce, time, verified address; a customer who is on?
  D-->>C: 303 to /account with the sign-in cookie
```

| Rule (`SERVICE_LIMITS`) | Why |
|---|---|
| Connecting reads `<issuer>/.well-known/openid-configuration` (kept `discoveryMinutes`, 60); its issuer must be the one typed, its addresses HTTPS | A typo or look-alike is refused first |
| The secret is sealed under the KEK with its own data key, bound to its row, never shown again | A database copy shows no secret |
| `state`, `nonce` and PKCE `S256` in `__Host-oltrem_customer_with` for `returnMinutes` (10) | No finishing another browser's sign-in, replay or stolen code |
| The ID token comes straight from the token endpoint (OpenID Connect Core 3.1.3.7); issuer, audience (and `azp`), nonce and times (`skewSeconds`, 120) checked | It answers this sign-in only |
| `email_verified` and an added customer who is on | A service proves an address; the company decides |
| The same sign-in as the code's, marked with the service | Ending, switching off and signing out work alike |
| Each call gives up after `callSeconds` (10) | A hanging service fails with a reason |

Any OpenID provider that publishes its details and sends `email_verified` fits: Auth0, Okta,
Keycloak, Google, and Supabase's OAuth 2.1 server (issuer `/auth/v1`, asymmetric signing keys).
Microsoft Entra ID sends no `email_verified`, so its sign-ins are refused. At most `count` (10)
services; one switched off leaves the door, its sign-ins stay.

## Who may do what

Bit plane `26`, across the company. A customer holds none: the door is all they reach.

| Capability | Lets them |
|---|---|
| `customers.view` | See and search customers and their sign-ins; see the services, never secrets |
| `customers.manage` | Add, change name and note, switch off and on, end sign-ins, email the link |
| `customers.services` (admin, fresh sign-in) | Connect, switch and remove sign-in services |

## The pages

| Path | Shows |
|---|---|
| `/customers` | Where customers sign in, counts, a search, the list by name with state, address and last sign-in; for managers **Add a customer** (address, name, a staff-only note, "Email them the link", ticked; an existing address links to that customer) and **Import from a spreadsheet** (a CSV with Email and Name, Note optional; added and skipped counted, nobody emailed) |
| `/customers/sign-in` | The emailed code always; services with state, issuer, last use; **Connect a service** (button name, issuer, id, secret), **Stop offering** or **Offer again**, **Remove** (confirmed); the return address |
| `/customers/:id` | State, address, who added them, last sign-in; **Make a quote for them** and **Make an invoice** (for whoever makes them, while on, address filled); for managers Email the link, Change, End their sign-ins (n), Switch on or off (confirmed); the note; the newest five quotes and invoices (through those modules' APIs); sign-ins newest first. After an add or link, a notice that the email is queued, or a link to Email settings when no service took it |
| `/account/sign-in` | Address and **Email me a code**, and **Continue with** each service that is on |
| `/account/code` | The code, with the one-time-code keyboard, and a link for a new one |
| `/account` | Name, address, Sign out; a section per module (the newest 20 with state, date and replies; "Nothing yet"; an unreadable section said, the rest shown); an item's first button posts at once, others (Decline) ask "Are you sure? Your answer is final." first, without a script; devices (this one marked) and **Sign out on the other devices** |
| `/account/open/<module>/<id>` | One item (a file to download); the module checks it is theirs, else back with "That is no longer open to you" |
| `/account/act/<module>/<id>/<action>` | A button posted by the customer; the module checks again, then "Thank you: we have your answer", or "That is no longer open to you" |

The door's pages use the portal's look without the staff sidebar; the mark leads to `/account`.

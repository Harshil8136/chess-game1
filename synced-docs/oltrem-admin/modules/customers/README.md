# @oltrem/customers

Customers: the people outside the company who sign in to the portal to see what is theirs. Staff
add them by address and name; a customer signs in at `/account` with a six-digit code emailed to
them, with no password, and never through the staff door. Staff see when each customer last signed
in, switch a customer off, end their sign-ins when a device is lost, and email them the link to
sign in. Every step is in the audit log.

This is the door and the account. What a customer sees once signed in, beyond their account and
their sign-ins, comes next (below).

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

`createCustomers` returns the `store`, the module manifest and `door`. It stands on the IAM module
(sessions, the authorizer) and the audit log. It adds three tables and no binding, secret, variable
or setting.

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
  browser's `Sec-Fetch-Site: same-origin`), and every answer is `no-store`.

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

## Who may do what

Two capabilities on bit plane `26`, held across the company:

| Capability | Lets them |
|---|---|
| `customers.view` | see the customers, search them, and when each signed in |
| `customers.manage` | add a customer, change their name and note, switch them off and on, end their sign-ins, email them the link |

A customer holds no capability: the door is the only place they reach.

## The pages

| Path | Shows |
|---|---|
| `/customers` | where customers sign in (this portal's `/account`); how many customers there are and how many are on; to whoever manages them "Add a customer" in a dialog (address, name, a note only staff see, and "Email them the link to sign in", ticked); a search by name or address; the customers by name with their state, address and last sign-in |
| `/customers/:id` | one customer: on or off, the address, who added them and when, the last sign-in; to whoever manages them a row with "Email the sign-in link", "Change", "End their sign-ins (n)", "Switch back on" and "Switch off", each confirmed in a dialog; the note; the sign-ins, the newest first, with the browser, how and when |
| `/account/sign-in` | the customer's door: their address and "Email me a code" |
| `/account/code` | the code from the email, with the phone's one-time-code keyboard, and a link to ask for a new one |
| `/account` | the customer's account: their name and address, Sign out, where they are signed in (this device marked) and "Sign out on the other devices" |

The door's pages use the portal's look, without the staff sidebar; the mark at the top leads to
`/account`.

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /people` (`q` words) | `customers.view` | the customers by name, or those whose name or address holds the words, 200 at most, with the counts and whether the reader may manage them |
| `POST /people` | `customers.manage` | adds a customer by address and name, with a note; `invite: true` emails them the link, and the answer says whether it went (`invited`) |
| `GET /people/:id` | `customers.view` | one customer with their last 20 sign-ins |
| `POST /people/:id` | `customers.manage` | changes the name and the note; the address stays |
| `POST /people/:id/off` | `customers.manage` | switches them off and ends every sign-in |
| `POST /people/:id/on` | `customers.manage` | switches them back on |
| `POST /people/:id/end-sign-ins` | `customers.manage` | ends every sign-in, and says how many |
| `POST /people/:id/invite` | `customers.manage` | emails a customer who is on the link to sign in |
| `GET /search?q=` | `customers.view` | the portal's search: customers by name or address |

Every change is audited: `customers.add` (with whether the link went), `customers.change`,
`customers.off`, `customers.on`, `customers.end-sign-ins` (with how many) and `customers.invite`,
refusals included.

A privacy request (`@oltrem/privacy`) finds the customer's row (name, address, note, state, who
added them and when, the last sign-in) and their sign-ins (when, how, the browser, last used,
ended).

## Tables

Migration `0036_customers.sql`, additive and idempotent: `customers_people` (one row a customer,
one address a portal), `customers_codes` (each request for a code, the code's hash when one was
sent, its tries and when it was used) and `customers_sessions` (each sign-in, by the hash of its
token: how, the browser, when it was made, last used, expires and ended).

## Errors

The `36xx` block: `KIT-E-3601` the address is a customer already, `KIT-E-3602` the customer is
off, so no link is sent. An address, a name or a note out of bounds is the core's `KIT-E-0422`; a
customer who is not there is `KIT-E-0404`. The door answers in pages, never with a problem.

## Not here yet

- What a customer sees beyond their account: their bookings, the files shared with them, their
  form answers. Each module adds its part.
- "Sign in with" a service the client already uses (Auth0, Supabase, Microsoft, Google), through
  OpenID Connect, as a choice beside the email code.
- Customers who sign themselves up, when a client wants that.
- The outbox keeps an email's text, the code included, until the email is sent: anyone who reads
  the database directly could read a code in its ten minutes.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with the door mounted as
the client template mounts it: the manifest; a customer added once an address and emailed the link
when asked, refused without the capability, with a bad address or no name; the list and the search
to whoever sees customers; a change; a customer asking for a code, typing it with a space, signed
in with the `__Host-` cookie, the code working once; the cookie refused by the staff routes and
Access's headers refused by the door; an address that is not a customer answered the same with no
email; a form from elsewhere refused; five wrong tries ending a code, a new code ending the last, a
code expiring after ten minutes; five codes an hour an address and thirty requests a network;
signing out on the other devices and on this one; staff ending the sign-ins, switching off and on;
the privacy answer. The client template's screens journey adds a customer on the page, signs them
in at `/account` with the code from the outbox, and shows their account.

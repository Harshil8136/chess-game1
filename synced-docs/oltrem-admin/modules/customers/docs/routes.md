---
title: "@oltrem/customers: The routes; Tables; Errors; Not here yet; Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/customers/src; split from modules/customers/README.md]
---

# @oltrem/customers: The routes; Tables; Errors; Not here yet; Tests

> Part of [the @oltrem/customers README](../README.md).

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /people` (`q` words) | `customers.view` | the customers by name, or those whose name or address holds the words, 200 at most, with the counts and whether the reader may manage them |
| `POST /people` | `customers.manage` | adds a customer by address and name, with a note; `invite: true` emails them the link, and the answer says whether it went (`invited`) |
| `POST /import` (the CSV file as the body, 128 KB at most) | `customers.manage` | adds a customer for each row of the file, 1,000 rows at most: the Email and Name columns needed, Note kept when there; all or none, so a bad row (with its number) adds nobody; an address that is a customer already, or twice in the file, is skipped; nobody is emailed; answers `added` and `skipped` |
| `GET /people/:id` | `customers.view` | one customer with their last 20 sign-ins |
| `POST /people/:id` | `customers.manage` | changes the name and the note; the address stays |
| `POST /people/:id/off` | `customers.manage` | switches them off and ends every sign-in |
| `POST /people/:id/on` | `customers.manage` | switches them back on |
| `POST /people/:id/end-sign-ins` | `customers.manage` | ends every sign-in, and says how many |
| `POST /people/:id/invite` | `customers.manage` | emails a customer who is on the link to sign in |
| `GET /services` | `customers.view` | the sign-in services, never their secrets, and whether the reader may set them up |
| `POST /services` | `customers.services` at the company | connects a service by its issuer address, client id and client secret, after reading its published details |
| `POST /services/:id/on` | `customers.services` at the company | offers it at the door again |
| `POST /services/:id/off` | `customers.services` at the company | stops offering it; sign-ins made with it stay |
| `POST /services/:id/remove` | `customers.services` at the company | removes it and its sealed secret |
| `GET /search?q=` | `customers.view` | the portal's search: customers by name or address |
| `GET /report?days=&to=` | `customers.view` | the section on Reports, under Customers: new customers, all customers and how many signed in, a line of new customers each day and who signed in most; sign-ins are kept 30 days after they end, so a period reaching further back shows no sign-in count |

Every change is audited: `customers.add` (with whether the link went), `customers.import` (the
counts only, never the addresses), `customers.change`,
`customers.off`, `customers.on`, `customers.end-sign-ins` (with how many), `customers.invite`,
`customers.service-add`, `customers.service-on`, `customers.service-off` and
`customers.service-remove`, refusals included.

A privacy request (`@oltrem/privacy`) finds the customer's row (name, address, note, state, who
added them and when, the last sign-in) and their sign-ins (when, how, the browser, last used,
ended).

## Tables

Migration `0036_customers.sql`, additive and idempotent: `customers_people` (one row a customer, one
address a portal), `customers_codes` (each request for a code, the code's hash when one was sent,
its tries and when it was used) and `customers_sessions` (each sign-in, by the hash of its token:
how, the browser, when it was made, last used, expires and ended). Migration
`0037_customers_services.sql` adds `customers_services`: each sign-in service, its issuer and client
id, its secret sealed with its own wrapped data key, on or off, and when it was last used. Migration
`0061_customers_by_name.sql` indexes the customers by name whatever its case, the order the page
lists them in, so a page of them stops at its last row instead of sorting every customer. The daily
job `customers.prune` removes a sign-in 30 days after it ended or ran out (`SESSIONS_KEPT_DAYS`),
with the browser it names, at most 1,000 a run (`SESSIONS_PRUNE_RUN`); a sign-in still live stays
however old.

## Errors

The `36xx` block: `KIT-E-3601` the address is a customer already, `KIT-E-3602` the customer is
off, so no link is sent, `KIT-E-3603` a sign-in service's published details could not be read or
did not match, `KIT-E-3604` no KEK secret to seal a service's secret with. An address, a name or a note out of bounds is the core's `KIT-E-0422`; a
customer who is not there is `KIT-E-0404`. The door answers in pages, never with a problem.

## Not here yet

- A setting to switch the emailed code off, for a company whose customers all use a service.
- The ID token's signature checked against the service's keys (`jwks_uri`); today TLS to the
  token endpoint stands for it, as the standard allows.
- Customers who sign themselves up, when a client wants that.
- The outbox keeps an email's text, the code included, until the email is sent: anyone who reads
  the database directly could read a code in its ten minutes.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with the door mounted as the
client template mounts it: the manifest; a customer added once an address and emailed the link when
asked, refused without the capability, with a bad address or no name; the list and the search to
whoever sees customers; a change; a customer asking for a code, typing it with a space, signed in
with the `__Host-` cookie, the code working once; the cookie refused by the staff routes and a staff
sign-in at Access refused by the door; an address that is not a customer answered the same with no
email; a form from elsewhere refused; five wrong tries ending a code, a new code ending the last, a
code expiring after ten minutes; five codes an hour an address and thirty requests a network;
signing out on the other devices and on this one; staff ending the sign-ins, switching off and on;
the privacy answer. Against a stand-in OpenID Connect service: connecting refused without the KEK,
without the capability, with an `http://` issuer or a service naming another issuer; the secret kept
only sealed and never listed; the trip with PKCE and the return signed in, marked with the service;
the return refused for another state, after ten minutes, when cancelled, with another nonce, an
unverified address or an address that is no customer; a service switched off gone from the door;
removed with its secret; each step audited. The account page with two modules' parts: the items for
the signed-in address only, at most twenty with "more", and a part that fails shown as not readable
while the page opens and the error is reported; an item opened under the door for its customer only
and uncached, and another id, another module, a broken path or a failing module returning to the
account, a visitor with no sign-in sent to sign in; an action posted by its customer done once and
thanked, one the module refuses or a broken path returned with "no longer open". The import: the
rows added with a header in any order and case and quoted fields, an address already a customer or
repeated in the file skipped, nobody emailed; a file with a bad row, without the Email or Name
column, empty, over 1,000 rows or over 128 KB adding nobody and naming the row; refused without the
capability; the audit rows with the counts only. The client template's screens journey adds a
customer on the page, signs them in at `/account` with the code from the outbox, and shows their
account with "Your messages", the file shared with them and a quote, which they accept there, then
the invoice made from it, owed and then paid. The page tests (`test/pages.test.ts`) render a
customer's quotes and invoices with "Make a quote for them", the link to an existing customer after
a refused add, the notice when no email service took the link, and the door's Decline asked once
more.

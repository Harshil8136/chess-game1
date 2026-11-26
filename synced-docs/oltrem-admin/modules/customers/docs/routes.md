---
title: "@oltrem/customers: routes, tables, errors, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/customers/src/module.ts, customers.ts, services.ts, errors.ts]
---

# @oltrem/customers: routes, tables, errors, tests

> Part of [the @oltrem/customers README](../README.md).

## The routes

Under `/api/customers`. `view` is `customers.view`, `manage` `customers.manage`, `services`
`customers.services` at the company.

| Route | Needs | What it does |
|---|---|---|
| `GET /people?q=` | view | By name, or name or address holding the words, `LIMITS.listed` (200) at most, with counts and whether the reader may manage |
| `POST /people` | manage | Adds one (address, name, note); `invite: true` emails the link and answers `invited` |
| `POST /import` | manage | A CSV body (`importBytes`, 128 KB; `import`, 1,000 rows): Email and Name needed, Note kept; all or none, a bad row named; existing or repeated addresses skipped; nobody emailed; answers `added`, `skipped` |
| `GET /people/:id` | view | One customer with their last `signIns` (20) sign-ins |
| `POST /people/:id` | manage | Name and note; the address stays |
| `POST /people/:id/off`, `/on` | manage | Off ends every sign-in; on again |
| `POST /people/:id/end-sign-ins` | manage | Ends every sign-in, saying how many |
| `POST /people/:id/invite` | manage | Emails the sign-in link to a customer who is on |
| `GET /services` | view | The sign-in services, never their secrets |
| `POST /services` | services | Connects one by issuer, client id and secret, after reading its published details |
| `POST /services/:id/on`, `/off`, `/remove` | services | Offer again, stop offering (its sign-ins stay), or remove it and its sealed secret |

Search (customers by name or address) and the Reports section (new and all customers, who signed
in, a line a day; sign-ins kept 30 days after they end) are module parts. Audited:
`customers.add` (whether the link went), `.import` (counts only), `.change`, `.off`, `.on`,
`.end-sign-ins`, `.invite`, `.service-add`, `.service-on`, `.service-off`, `.service-remove`,
refusals included. A privacy request finds the customer's row and sign-ins.

## Tables

| Migration | Adds |
|---|---|
| `0036_customers.sql` | `customers_people` (one address a portal), `customers_codes` (each request, the code's hash, tries, used; deleted after a day), `customers_sessions` (by token hash: how, browser, made, last used, expires, ended) |
| `0037_customers_services.sql` | `customers_services`: issuer, client id, the secret sealed with its own wrapped key, on or off, last used |
| `0061_customers_by_name.sql` | Index by name whatever its case, so a page stops at its last row |

The daily job `customers.prune` removes a sign-in `SESSIONS_KEPT_DAYS` (30) after it ended or ran
out, at most `SESSIONS_PRUNE_RUN` (1,000) a run; a live one stays.

## Errors

`KIT-E-3601` already a customer, `KIT-E-3602` the customer is off (no link sent), `KIT-E-3603` a
service's published details unreadable or not matching, `KIT-E-3604` no KEK to seal a secret. Out of
bounds is `KIT-E-0422`, not there `KIT-E-0404`. The door answers in pages, never with a problem.

## Not built yet

- A setting to switch the emailed code off for a company whose customers all use a service.
- The ID token's signature checked against `jwks_uri`; today TLS to the token endpoint stands for
  it, as the standard allows.
- Customers who sign themselves up.
- The outbox keeps an email's text, code included, until sent: a direct database reader could see
  a code in its ten minutes.

## Tests

| File | What it proves |
|---|---|
| `test/customers.test.ts` | The manifest; adding (once an address, the link when asked, refusals); list and search; a code typed with a space signing in with the `__Host-` cookie, once; the cookie refused by staff routes and Access refused by the door; a stranger's address answered the same with no email; cross-site forms refused; five wrong tries, a new code ending the last, ten-minute expiry; five codes an hour an address, thirty requests a network; signing out here and elsewhere; staff ending sign-ins, off and on; privacy. With a stand-in OpenID service: connecting refused without the KEK, the capability, `https://` or the same issuer; the secret only sealed; PKCE trip and return; returns refused for another state, late, cancelled, another nonce, unverified or unknown address; off gone from the door; removed; audited. The account page with two modules: own items only, twenty with "more", a failing part shown as unreadable; open and act for the owner only. The import's rows, skips and refusals with the counts audited |
| `test/pages.test.ts` | Quotes and invoices with "Make a quote for them", the link after a refused add, the notice when no email service took the link, the door's Decline asked once more |

The template's screens journey adds a customer, signs them in with the outbox's code, and shows
their messages, a shared file and a quote accepted there, then its invoice owed and paid.

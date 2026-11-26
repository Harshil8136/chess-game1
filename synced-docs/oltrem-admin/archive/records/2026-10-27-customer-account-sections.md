---
title: "Customer account sections (2026-10-27)"
status: record
owner: vendor
last_verified: 2026-10-27
sources: [packages/core-module/README.md; modules/customers/README.md; modules/forms/README.md; this repository]
---

# Customer account sections

> **In plain words.** Customers could sign in, but their account page showed only their name and
> where they were signed in. Now each part of the portal can add a section to it with the
> customer's own things. The first is "Your messages": what they sent through the company's forms,
> whether it was received, is being handled or is done, and the replies staff sent them. A section
> shows only what the company wrote, never what anyone typed in the customer's name.

## What changed, and why

| What | Why |
|---|---|
| A module may declare a `customer` part: a title and `find(env, tenantId, email)` answering up to 20 items, each with a title, a date, a state and replies | One contract, so bookings, shared files and later modules add their sections without the customers module knowing them |
| The account page reads each part for the address the customer proved at sign-in, in parallel, and shows one section each | A customer sees what is theirs in one place; nothing is searched by an address they did not prove |
| A part that fails shows "could not be read" and is reported; the page still opens | One broken module never locks a customer out of their account |
| Forms adds "Your messages": the form's name, when it came, its state in plain words and the replies staff sent | The address in a form answer is only what the sender typed, so the section shows only the company's own words: never the answer itself or the internal notes |
| Migration `0039_forms_reply_to.sql`: an index on the reply address in lower case | The account page reads answers by address without scanning every answer |

## Before and after

Before, the account page showed only the account:

```mermaid
flowchart LR
  C[Signed-in customer] --> A[/account]
  A --> N[Name and address]
  A --> S[Where they are signed in]
```

After, each module that declares a customer part adds its section:

```mermaid
flowchart LR
  C[Signed-in customer] --> A[/account]
  A --> N[Name and address]
  A -->|address they proved| F[Forms: Your messages]
  A -->|address they proved| M[Any later module's part]
  A --> S[Where they are signed in]
```

Explanation: when a signed-in customer opens `/account`, the customers module asks every module
of the portal that declares a `customer` part for its items, with the company and the address the
customer proved by code or by a sign-in service. Each answer is cut to the newest 20. Forms reads
the answers sent with that address through the new index and returns only their form's name, date,
state and the replies staff sent; the answer's own text and the staff notes stay out.

## Impact on each part

| Part | Impact |
|---|---|
| `@oltrem/core-module` | `customer` on the manifest, `CustomerPart`, `CustomerItem`, `CustomerShown` and `CUSTOMER_ITEMS`; `defineModule` refuses a part without a title |
| `@oltrem/customers` | a `modules` option; the account page's sections; no new route, capability or table |
| `@oltrem/forms` | the "Your messages" part; migration `0039_forms_reply_to.sql` (one index) |
| The client template | hands its modules to the customers module; one more migration; no new binding, secret, variable or setting |

## How it was verified

`pnpm verify` passes. The core-module test refuses a part without a title. The customers tests,
with two stand-in modules, show the items for the signed-in address only, at most twenty with
"more", and a failing part shown as not readable while the page opens and the error is reported.
The forms test reads a customer's messages with their states and replies, never a note, and
nothing from another company; `EXPLAIN QUERY PLAN` showed the new index used. The client
template's journey signs a customer in and finds "Your messages" on their account. The page was
looked at by hand at 360 px in light and dark. Not checked: a phone or a deployed portal.

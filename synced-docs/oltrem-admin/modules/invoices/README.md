# @oltrem/invoices

Invoices: what the company bills its customers, line by line. Staff make an invoice at a place as a
draft, from scratch or from a quote the customer accepted (`@oltrem/quotes`), change it until it is
right, and send it; the customer is emailed and sees it on the portal's account page
(`@oltrem/customers`) with its lines, its total, the day it is due and how to pay. When the money
arrives, staff mark it paid with a word on how, and the customer is thanked. An invoice past its day
shows as overdue, to the customer and in Needs you for whoever makes invoices at its place. Every
step is in the audit log, so an automation can follow `invoices.pay`.

The portal takes no payment itself: the note on an invoice says how to pay (bank details, a payment
link from the company's own provider), and staff mark it paid.

## Using it

```ts
import { createInvoices } from '@oltrem/invoices';
import { pages as invoicesPages } from '@oltrem/invoices/pages';
import { withPages } from '@oltrem/core-module';

const invoices = createInvoices<Env>({
  bindings: (env) => ({ db: env.DB }),
  config: settingsFor, // reads the invoices.currency setting
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: INVOICE_MESSAGE.id, // a template with a subject and a text
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, customers.module, /* ... */ withPages(invoices.module, invoicesPages)];
```

`createInvoices` returns the `store` and the module manifest. It stands on the IAM module (sessions,
the authorizer), the audit log, and the customers module, whose account page shows the customer's
invoices. `send` is optional: without it nobody is emailed, and a sent invoice waits on the account
page all the same. With the quotes module mounted, the page that makes an invoice offers the
accepted quotes the person sees, read through the quotes API, and fills the form from the one
picked; without it, the form starts blank. It adds no binding, secret or variable; it adds one
setting.

## Who may do what

Two capabilities on bit plane `29`, both read at the invoice's place, so a role at a place (or at a
place above it) decides:

| Capability | Lets them |
|---|---|
| `invoices.view` | see the invoices sent from the place, their lines and their history |
| `invoices.make` | make, change and send drafts at the place, mark a sent invoice paid, and void a draft or a sent invoice |

The customer holds no capability: they see only the invoices sent to their own address, signed in
at `/account`.

## An invoice

| Part | What it is |
|---|---|
| Number | 1, 2, 3 within the company, given when the draft is made; a series of its own, apart from the quotes |
| Place | where it is made; the people who make invoices there send it and mark it paid |
| Customer | the address it is sent to, which they sign in with |
| Title | what it is for, 200 characters at most |
| Lines | 1 to 30: what (200 characters), how many (a whole number from 1) and the price of one, typed as 1200 or 1200.50; the total is their sum |
| Currency | the `invoices.currency` setting when the draft is made; an invoice keeps its own |
| Due by | from today to a year ahead; after it a sent invoice shows as Overdue |
| How to pay | a note the customer reads under the lines until it is paid; 2000 characters at most |
| State | Draft, then To be paid once sent, then Paid; Void when staff cancel it |
| Paid | when it was marked paid and how, 200 characters at most |

Only a draft is changed or sent, and a draft whose day has passed is changed before it is sent. Only
a sent invoice is marked paid, once. A draft or a sent invoice is voided; a paid one stays as it was
paid (`KIT-E-3901`). A voided draft never reaches the customer; a voided sent invoice shows on their
page as cancelled.

## The setting

| Key | Default | What it is |
|---|---|---|
| `invoices.currency` | `USD` | the three-letter code of the currency new invoices are written in, set by the Owner |

## The pages

| Path | Shows |
|---|---|
| `/invoices` | a row of All, Overdue, Drafts, Sent, Paid and Void with their counts; "Make an invoice" to whoever makes them somewhere; the invoices, the newest first, with their number, customer, total and state |
| `/invoices/new` | a row "From an accepted quote" (Blank and the newest twelve accepted quotes) when there are any; the place as a row of choices, the customer's address, the title, six rows of lines, the day it is due (30 days ahead to start) and how to pay |
| `/invoices/:id` | the invoice with its state; a row with "Send to the customer", "Change", "Mark it paid" (how, in a dialog) and "Void it" (after a confirmation) to whoever makes invoices there, and "All invoices"; the lines with the total and the day it is due; how to pay; when it was made, sent and paid |
| `/invoices/:id/change` | the same form as a new invoice, for a draft |

On the customer's account page, under "Your invoices": each invoice sent to them with its number,
title and state (To pay, Overdue, Paid, Cancelled), its lines and total, the day it is due or the day
it was paid, and how to pay while it is owed.

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /invoices` (`view` all, overdue or a state) | `invoices.view` | the invoices at the places the person sees, at most 100, with the places, the counts and the company's currency |
| `POST /invoices` | `invoices.make` at the place | makes a draft |
| `GET /invoices/:id` | `invoices.view` at its place | one invoice, with whether the reader makes invoices there |
| `POST /invoices/:id` | `invoices.make` at its place | changes a draft |
| `POST /invoices/:id/send` | `invoices.make` at its place | sends a draft; the customer is emailed, and `told` says whether it went |
| `POST /invoices/:id/pay` | `invoices.make` at its place | marks a sent invoice paid, with how; the customer is thanked, and `told` says whether it went |
| `POST /invoices/:id/void` | `invoices.make` at its place | voids a draft or a sent invoice |
| `GET /search?q=` | `invoices.view` | invoices by title or address where the person sees |
| `GET /todo` | `invoices.make` | Needs you: how many sent invoices are past their day at the places the person makes them |

Every step is audited: `invoices.create`, `invoices.change`, `invoices.send`, `invoices.pay` and
`invoices.void`, refusals included.

A privacy request (`@oltrem/privacy`) finds every invoice sent to a person: its number, title, total,
state, dates and how it was paid.

## Tables

Migration `0042_invoices.sql`, additive and idempotent: `invoices_invoices`, one row an invoice,
with its lines as JSON (an invoice is read and written whole), its total in the currency's smallest
unit, the day it is due, and when it was made, sent and paid and how. The number is unique in the
company; an index on the state and the day serves Needs you.

## Errors

The `39xx` block: `KIT-E-3901` the invoice can no longer change that way. An address, a title, a
line, a quantity, a price or a day out of bounds is the core's `KIT-E-0422`; a person without the
capability at the place is `KIT-E-0403`; an invoice that is not there is `KIT-E-0404`.

## Not here yet

- Taking the payment online: a payment link per invoice needs a payment provider's secret, the
  owner's yes first (R-09).
- Taxes and discounts per line, part payments and credit notes.
- A PDF of the invoice, and the company's legal details on it, which some countries require.
- Reminders to the customer before and after the day it is due.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; a draft made
only where the person makes invoices, numbered within the company, with its total; the refusals for
a bad address, line or day; what each person sees, with the counts; a draft changed, unseen by the
customer until sent, then emailed and shown on their account page for their address only; marked
paid once with how, the customer thanked, never voided after; overdue past its day, in its view and
in Needs you, and settled when paid late; voided, a sent one shown as cancelled and a draft never
shown; the search and the privacy answer; every step audited. The client template's screens journey
makes an invoice from the quote the customer accepted, sends it, finds it on their account page,
and marks it paid.

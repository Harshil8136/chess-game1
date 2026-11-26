# @oltrem/invoices

What the company bills its customers, line by line. Staff make a draft at a place (blank or from an
accepted quote), send it to a customer, who is emailed and sees it on `/account` with its total, due
day and how to pay, and mark it paid. Past its day it shows as overdue, to the customer and in Needs
you. The portal takes no payment: the note says how to pay. Each invoice opens as one plain page to
print or save as a PDF.

## Using it

```ts
const invoices = createInvoices<Env>({
  bindings: (env) => ({ db: env.DB }),
  config: settingsFor, // invoices.currency
  timeZone: async (env) => (await settingsFor(env)).get<string>('bookings.time_zone'), // UTC when left out
  isCustomer: async (env, tenantId, address) =>
    (await customers.store.customerByEmail(env, address))?.tenantId === tenantId,
  send: async (env, m) =>
    email.send(env, {
      tenantId: m.tenantId,
      template: INVOICE_MESSAGE.id,
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    }),
});
const modules = [iam.module, customers.module, /* ... */ withPages(invoices.module, invoicesPages)];
```

It returns `store` and the manifest, stands on IAM, the audit log and customers, and adds three
settings and one daily job, no binding, secret or variable.

| Option | Without it |
|---|---|
| `send` | Nobody is emailed; a sent invoice still waits on the account page. A `waiting` status (no email service yet) is said on the page with a link to Email settings |
| `isCustomer` | Any address is taken; with it a send or resend goes only to a customer who is on (`KIT-E-3902`), and a draft's page says so first |
| The quotes module | The new form starts blank; with it the form offers accepted quotes, and one already billed by an invoice not void (same customer and title) is left out or named |

Two capabilities on bit plane 29, read at the invoice's place: `invoices.view` (the invoices, lines
and history) and `invoices.make` (make, change, send, email again, mark paid, void). The customer
holds none and sees only invoices sent to their own address.

## An invoice

Limits are `LIMITS` in `src/invoices.ts`.

| Part | What it is |
|---|---|
| Number | 1, 2, 3 within the company, given at the draft; apart from quotes |
| Customer, title | The address they sign in with; `title` (200) |
| Lines | 1 to `lines` (30): what (`line`, 200), how many (whole, from 1), the price of one (1200 or 1200.50); the total is their sum, kept in the smallest unit |
| Currency | `invoices.currency` at the draft; kept |
| Due by | Today to `dueDays` (365) ahead |
| How to pay | `note` (2,000), shown until paid |
| State | `STATES`: draft, sent (To be paid), paid (with how, `paidNote` 200), void |

Only a draft changes or is sent (one past its day is changed first); only a sent one is paid, once;
a paid one is never voided (`KIT-E-3901`). A voided draft never reaches the customer; a voided sent
one shows as cancelled.

| Setting | Default | What it is |
|---|---|---|
| `invoices.currency` | `USD` | The currency of new invoices |
| `invoices.reminders` | off | The reminder emails below |
| `invoices.issuer` | empty | Legal name, address and tax number under the company name on each page, 500 characters |

**Reminders.** The daily job `invoices.reminders`, while the setting is on, emails each sent
invoice due in `remindBefore` (3) days and each due yesterday and unpaid, with the total and how to
pay, `reminders` (20) of each a run, keyed by invoice and kind so each goes once. A missed day is
not made up.

## The pages

| Path | Shows |
|---|---|
| `/invoices` | Tiles in the company's currency: Owed to you, Overdue, Paid this month (UTC), each opening its view; chips `VIEWS` with counts; **Make an invoice**; the list newest first. `?email=` shows one customer's, with **Make an invoice for them** |
| `/invoices/new` | **From an accepted quote** chips (Blank and the newest twelve unbilled); `?quote=` of a billed one links its invoice; place as chips, customer (from `?email=`), title, six line rows, due day (30 days ahead), how to pay |
| `/invoices/:id` | State; Send, Change, Mark it paid (a dialog asks how), Email it again while owed, Void it (confirmed), Print or save as PDF; lines, total, due day, how to pay, dates. A non-customer draft links Customers; after a send or payment, queued, waiting or none, with a link to Email settings |
| `/invoices/:id/change` | The new form, for a draft |

The account page lists "Your invoices": number, title, state (To pay, Overdue, Paid, Cancelled),
lines, total, due or paid day, how to pay while owed; the title opens the printable page through
`/account/open/invoices/<id>` while it is theirs and sent.

## The routes

| Route | Needs | What it answers |
|---|---|---|
| `GET /invoices` (`view`, `email`) | `invoices.view` | `listed` (100) from `scanned` (500) rows, with places, counts, currency and the sums owed, overdue and paid this month |
| `POST /invoices` | `invoices.make` at the place | Makes a draft |
| `GET /invoices/billed` | `invoices.view` | Invoices not void with customer and title, the newest 500, so pages tell a billed quote |
| `GET /invoices/:id` | `invoices.view` at its place | One, with whether the reader makes invoices there |
| `GET /invoices/:id/paper` | `invoices.view` at its place | The printable page: no script or image, every text escaped, `default-src 'none'`, not cached; a draft marked "Draft: not sent" |
| `POST /invoices/:id` | `invoices.make` at its place | Changes a draft |
| `POST /invoices/:id/send`, `/resend`, `/pay` | `invoices.make` at its place | Sends a draft, emails a sent one again (a new message key each time), marks it paid with how; each answers `told` and `waiting` |
| `POST /invoices/:id/void` | `invoices.make` at its place | Voids a draft or a sent one |

Module parts: search (title or address), Needs you (overdue at places the person makes invoices),
Reports under Money (sent, invoiced, paid, overdue, days to paid, paid per day, each currency once
a second is used; paid is the funnel's last step), and the privacy answer (each invoice to a person,
linking `/invoices?email=`). `store.csv(env, session)` gives the viewable invoices, newest 500, for
the spreadsheet link of `@oltrem/connect` (it holds customers' addresses).

Audited, refusals too: `invoices.create`, `.change`, `.send`, `.resend`, `.pay`, `.void`.

## Tables and errors

| Migration | Adds |
|---|---|
| `0042` | `invoices_invoices`: one row an invoice, lines as JSON, total, due day, made, sent, paid and how; the number unique in the company; an index on state and day for Needs you |
| `0062` | An index newest first, so a page stops at its last row |

Block `39xx`: `KIT-E-3901` the invoice can no longer change that way, `KIT-E-3902` the address is
not a customer who is on. Bad input is `KIT-E-0422`, no capability `KIT-E-0403`, not there
`KIT-E-0404`.

Not built: online payment (a provider's secret needs the owner's yes, R-09); taxes, discounts, part
payments, credit notes; a PDF made by the portal or a country's e-invoice (CFDI); a stored link to
the quote (a second invoice with another title for one quote is not caught); more than two
reminders.

## Tests

| File | Covers |
|---|---|
| `test/invoices.test.ts` | The manifest; drafts only where allowed, numbered, totalled; bad input; what each person sees with counts; a draft unseen until sent, then emailed and on that customer's page only; paid once and thanked, never voided after; overdue in its view and Needs you, settled when paid late; void; the printable page escaped; reminders off, then each once; search and privacy; every step audited; resend with a new key, refused once paid; the billed list; a non-customer refused; the CSV by place and gone with the role |
| `test/pages.test.ts` | Email it again, the non-customer notice, the queued, waiting and no-email words, a billed quote left out and named |

The client template's screens journey makes an invoice from an accepted quote, sends it, finds it
on the account page, prints it and marks it paid.

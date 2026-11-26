# @oltrem/quotes

The prices the company sends its customers, line by line. Staff make a draft at a place and send it
to a customer, who is emailed and accepts or declines it on `/account` until its last day; the
maker is told. An answer is final. Every step is audited, so an automation can follow
`quotes.accept` with a task, an email or the client's own action.

## Using it

```ts
const quotes = createQuotes<Env>({
  bindings: (env) => ({ db: env.DB }),
  config: settingsFor, // quotes.currency
  timeZone: async (env) => (await settingsFor(env)).get<string>('bookings.time_zone'), // UTC when left out
  isCustomer: async (env, tenantId, address) =>
    (await customers.store.customerByEmail(env, address))?.tenantId === tenantId,
  send: async (env, m) =>
    email.send(env, {
      tenantId: m.tenantId,
      template: QUOTE_MESSAGE.id,
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    }),
});
const modules = [iam.module, customers.module, /* ... */ withPages(quotes.module, quotesPages)];
```

It returns `store` and the manifest, stands on IAM, the audit log and customers (whose account page
shows the quotes and carries the answer), and adds one setting, no binding, secret or variable.

| Option | Without it |
|---|---|
| `send` | Nobody is emailed; a sent quote still waits on the account page. A `waiting` status (no email service yet) is said with a link to Email settings |
| `isCustomer` | Any address is taken; with it a send or resend goes only to a customer who is on (`KIT-E-3802`), and a draft's page says so first |
| `issuer` | The lines under the company name on the printable page; the client template passes `invoices.issuer`, so both read the same |

Two capabilities on bit plane 28, read at the quote's place: `quotes.view` (quotes, lines, history)
and `quotes.make` (make, change, send, email again, withdraw). The customer holds none and answers
only open quotes sent to their own address.

## A quote

Limits are `LIMITS` in `src/quotes.ts`.

| Part | What it is |
|---|---|
| Number | 1, 2, 3 within the company, given at the draft |
| Customer, title | The address they sign in with; `title` (200) |
| Lines | 1 to `lines` (30): what (`line`, 200), how many (whole, from 1), the price of one (1200 or 1200.50); the total is their sum, kept in the smallest unit |
| Currency | `quotes.currency` (default `USD`, set by the Owner) at the draft; kept |
| Last day | Today to `validDays` (365) ahead; after it no answer, shown as Expired |
| Note | Terms, what is included, how to pay; `note` (2,000) |
| State | `STATES`: draft, sent (Waiting for the customer), accepted, declined, withdrawn |

Only a draft changes or is sent (one past its last day is changed first); a draft or sent quote is
withdrawn; an answered one stays (`KIT-E-3801`). The answer is one write that checks it is still
sent, theirs and in date, so a second answer or one after a withdrawal changes nothing.

## The pages

| Path | Shows |
|---|---|
| `/quotes` | Chips `VIEWS` with counts; **Make a quote**; the list newest first. `?email=` shows one customer's, with **Make a quote for them** |
| `/quotes/new` | Place as chips, customer (from `?email=`), title, six line rows, last day (30 days ahead), note |
| `/quotes/:id` | State; Send, Change, Withdraw (confirmed), Email it again while open, Print or save as PDF; on an accepted quote with invoices mounted **Make the invoice** (`/invoices/new?quote=<id>`) or **Open invoice N** once one not void bills the same customer and title; lines, total, note, dates. A non-customer draft links Customers; after a send, queued, waiting or none |
| `/quotes/:id/change` | The new form, for a draft |

The account page lists "Your quotes": number, title, total, lines, note, and while open **Accept the
quote** and **Decline** (posting to `/account/act/quotes/<id>/<accept|decline>`); the title opens
the printable page through `/account/open/quotes/<id>` once sent and while not withdrawn.

## The routes

| Route | Needs | What it answers |
|---|---|---|
| `GET /quotes` (`view`, `email`) | `quotes.view` | `listed` (100) from `scanned` (500) rows, with places, counts and currency |
| `POST /quotes` | `quotes.make` at the place | Makes a draft |
| `GET /quotes/:id` | `quotes.view` at its place | One, with whether the reader makes quotes there |
| `GET /quotes/:id/paper` | `quotes.view` at its place | The printable page (`paperHtml`, `@oltrem/core-module`): company and issuer, lines, total, terms, a stamp once answered, withdrawn, expired or while a draft |
| `POST /quotes/:id` | `quotes.make` at its place | Changes a draft |
| `POST /quotes/:id/send`, `/resend` | `quotes.make` at its place | Sends a draft, or emails an open one again under a new message key; each answers `told` and `waiting` |
| `POST /quotes/:id/withdraw` | `quotes.make` at its place | Withdraws a draft or sent quote |

Module parts: search (title or address), Needs you (accepted in the last week where the person makes
quotes), Reports under Money (sent, accepted and their value, win rate of those answered, sent per
day, waiting oldest first, each currency once a second is used; sent and accepted are funnel steps),
and the privacy answer (each quote to a person, linking `/quotes?email=`).

Audited, refusals too: `quotes.create`, `.change`, `.send`, `.resend`, `.withdraw`, and the
customer's `quotes.accept` or `.decline`, recorded by the customers' door.

## Tables and errors

| Migration | Adds |
|---|---|
| `0041` | `quotes_quotes`: one row a quote, lines as JSON, total, made, sent, answered; the number unique in the company |
| `0063` | An index newest first, so a page stops at its last row |

Block `38xx`: `KIT-E-3801` the quote can no longer change that way, `KIT-E-3802` the address is not
a customer who is on. Bad input is `KIT-E-0422`, no capability `KIT-E-0403`, not there `KIT-E-0404`.

Not built: a signature with the acceptance; a PDF made by the portal; taxes, discounts, options to
pick; a stored link to the invoice (matched by customer and title, and Needs you counts an accepted
quote for a week even once invoiced); a reminder before the last day.

## Tests

| File | Covers |
|---|---|
| `test/quotes.test.ts` | The manifest; drafts only where allowed, numbered, totalled; bad input; what each person sees with counts; a draft unseen until sent, then emailed; the account part with two answers for that address only; accepted once, other addresses, actions or second answers refused, the maker told; Needs you; expired and withdrawn; the printable page escaped; search and privacy; every step audited, the answer by the door; resend with a new key, waiting, refused once withdrawn or expired; a non-customer refused; one customer's quotes |
| `test/pages.test.ts` | Email it again, Make the invoice or Open invoice N, the non-customer notice, the queued and waiting words |

The client template's screens journey makes a quote as the Owner, sends it, and the customer accepts
it on their account page.

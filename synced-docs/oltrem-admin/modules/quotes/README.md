# @oltrem/quotes

Quotes: the prices the company sends its customers, line by line. Staff make a quote at a place as
a draft, change it until it is right, and send it; the customer is emailed, signs in at the portal's
account page (`@oltrem/customers`) and accepts or declines it there until its last day, and the
person who made it is told. An answer is final. Every step is in the audit log, so an automation can
follow an accepted quote with a task, an email or the client's own action.

## Using it

```ts
import { createQuotes } from '@oltrem/quotes';
import { pages as quotesPages } from '@oltrem/quotes/pages';
import { withPages } from '@oltrem/core-module';

const quotes = createQuotes<Env>({
  bindings: (env) => ({ db: env.DB }),
  config: settingsFor, // reads the quotes.currency setting
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: QUOTE_MESSAGE.id, // a template with a subject and a text
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, customers.module, /* ... */ withPages(quotes.module, quotesPages)];
```

`createQuotes` returns the `store` and the module manifest. It stands on the IAM module (sessions,
the authorizer), the audit log, and the customers module, whose account page shows the customer's
quotes and carries their answer. `send` is optional: without it nobody is emailed, and a sent quote
waits on the account page all the same. It adds no binding, secret or variable; it adds one setting.

## Who may do what

Two capabilities on bit plane `28`, both read at the quote's place, so a role at a place (or at a
place above it) decides:

| Capability | Lets them |
|---|---|
| `quotes.view` | see the quotes sent from the place, their lines and their history |
| `quotes.make` | make, change and send drafts at the place, and withdraw a draft or a sent quote |

The customer holds no capability: they see only the quotes sent to their own address, signed in at
`/account`, and answer only those still open.

## A quote

| Part | What it is |
|---|---|
| Number | 1, 2, 3 within the company, given when the draft is made |
| Place | where it is made; the people who make quotes there change and send it |
| Customer | the address it is sent to, which they sign in with |
| Title | what it is for, 200 characters at most |
| Lines | 1 to 30: what (200 characters), how many (a whole number from 1) and the price of one, typed as 1200 or 1200.50; the total is their sum |
| Currency | the `quotes.currency` setting when the draft is made; a quote keeps its own |
| Last day | from today to a year ahead; after it the customer can no longer accept it, and it shows as Expired |
| Note | terms, what is included, how to pay; 2000 characters at most |
| State | Draft, then Waiting for the customer once sent, then Accepted or Declined; Withdrawn when staff take it back |

Only a draft is changed or sent, and a draft whose last day has passed is changed before it is sent.
A draft or a sent quote is withdrawn; an answered one stays as the customer answered it
(`KIT-E-3801`). The customer's answer is one write that checks the quote is still sent, theirs and
within its last day, so two answers, or an answer after a withdrawal, change nothing.

## The setting

| Key | Default | What it is |
|---|---|---|
| `quotes.currency` | `USD` | the three-letter code of the currency new quotes are written in, set by the Owner |

## The pages

| Path | Shows |
|---|---|
| `/quotes` | a row of All, Drafts, Sent, Accepted, Declined and Withdrawn with their counts; "Make a quote" to whoever makes them somewhere; the quotes, the newest first, with their number, customer, total and state |
| `/quotes/new` | the place as a row of choices, the customer's address, the title, six rows of lines, the last day (30 days ahead to start) and the note |
| `/quotes/:id` | the quote with its state; a row with "Send to the customer", "Change" and "Withdraw" (after a confirmation) to whoever makes quotes there, and "All quotes"; the lines with the total; the note; when it was made, sent and answered |
| `/quotes/:id/change` | the same form as a new quote, for a draft |

On the customer's account page, under "Your quotes": each quote sent to them with its number, title,
total, lines and note, and while it is open "Accept the quote" and "Decline", each a button that
posts to `/account/act/quotes/<id>/<accept|decline>`.

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /quotes` (`view` all or a state) | `quotes.view` | the quotes at the places the person sees, at most 100, with the places, the counts and the company's currency |
| `POST /quotes` | `quotes.make` at the place | makes a draft |
| `GET /quotes/:id` | `quotes.view` at its place | one quote, with whether the reader makes quotes there |
| `POST /quotes/:id` | `quotes.make` at its place | changes a draft |
| `POST /quotes/:id/send` | `quotes.make` at its place | sends a draft; the customer is emailed, and `told` says whether it went |
| `POST /quotes/:id/withdraw` | `quotes.make` at its place | withdraws a draft or a sent quote |
| `GET /search?q=` | `quotes.view` | quotes by title or address where the person sees |
| `GET /todo` | `quotes.make` | Needs you: how many quotes customers accepted in the last week at the places the person makes them |

Every step is audited: `quotes.create`, `quotes.change`, `quotes.send` and `quotes.withdraw`,
refusals included, and the customer's `quotes.accept` or `quotes.decline`, recorded by the
customers' door. An automation on `quotes.accept` can make the task that starts the work.

A privacy request (`@oltrem/privacy`) finds every quote sent to a person: its number, title, total,
state and dates.

## Tables

Migration `0041_quotes.sql`, additive and idempotent: `quotes_quotes`, one row a quote, with its
lines as JSON (a quote is read and written whole, and its lines are never searched apart from it),
its total in the currency's smallest unit, and when it was made, sent and answered. The number is
unique in the company.

## Errors

The `38xx` block: `KIT-E-3801` the quote can no longer change that way. An address, a title, a line,
a quantity, a price or a last day out of bounds is the core's `KIT-E-0422`; a person without the
capability at the place is `KIT-E-0403`; a quote that is not there is `KIT-E-0404`.

## Not here yet

- A PDF of the quote, and a signature with the acceptance.
- Taxes and discounts per line, and options the customer picks from.
- Turning an accepted quote into an invoice: invoices are a module of their own, later.
- A reminder to the customer before the last day.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; a draft made
only where the person makes quotes, numbered within the company, with its total; the refusals for a
bad address, line or day; what each person sees, with the counts; a draft changed, unseen by the
customer until sent, then emailed; the account page part with its lines and two answers, for their
address only; accepted once, any other address, action or second answer refused, the maker told;
Needs you; an expired quote takes no answer and a withdrawn one leaves the page; the search and the
privacy answer; every step audited, the customer's answer by the door. The client template's screens
journey makes a quote as the Owner, sends it, and the customer accepts it on their account page.

# @oltrem/expenses

Expenses: people claim back what they spent for the company, with a photo of the receipt. "Printer
ink, 42.80"; "Taxi to the airport"; "Lunch with a supplier". A claim belongs to a place, so the roles
held there decide who may claim and who answers. Nobody approves or pays their own claim, an answer
is final, and a no says why. Once the money is sent, whoever decides marks the claim paid. The person
who claimed is told each step by email, sees what the company still owes them, and every step is in
the audit log. Each month, the people who decide download the approved and paid claims as a
spreadsheet for the accountant.

## Using it

```ts
import { createExpenses } from '@oltrem/expenses';
import { pages as expensesPages } from '@oltrem/expenses/pages';
import { withPages } from '@oltrem/core-module';

const expenses = createExpenses<Env>({
  bindings: (env) => ({ db: env.DB, bucket: env.FILES }), // the bucket keeps the receipts
  config: settingsFor, // reads expenses.currency
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: EXPENSE_MESSAGE.id, // a template with a subject and a text
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(expenses.module, expensesPages)];
```

`createExpenses` returns the `store` and the module manifest. It stands on the IAM module
(sessions, the authorizer), the audit log and the settings. The bucket is optional: without one,
claims are made without receipts. In the client template it is the files' bucket, the one R2
bucket a client has; receipts sit under their own prefix, `expenses/`, apart from the drive. `send`
is optional: without it nobody is emailed. It adds no binding, secret or variable.

## Who may do what

Two capabilities on bit plane `23`, both read at the claim's place, so a role at a place (or at a
place above it) decides:

| Capability | Lets them |
|---|---|
| `expenses.claim` | claim back what they spent at the place |
| `expenses.decide` | see what is claimed at the place with its receipt, approve or decline it, mark it paid, never their own; download a month |

The person who claimed always sees their own claims, may add or replace the receipt and withdraw one
while it waits, whatever they hold later (`expenses.self`, which every account holds). Someone who
neither claimed nor decides at the place cannot open a claim or its receipt.

## A claim

| Part | What it is |
|---|---|
| Place | where it is claimed; the people who decide there answer and pay it |
| Amount | typed as 12.50 or 12,50, never with a thousands separator, so neither reading is possible; kept in the currency's smallest unit (cents) |
| Currency | the company's, from the setting when the claim is made; a claim keeps its own |
| Category | travel, meals, supplies, equipment, services or other |
| What it was for, where | 1000 and 200 characters at most |
| Day spent | today or before |
| Receipt | a photo (PNG, JPEG, WebP, HEIC) or a PDF, 10 MB at most, added with the claim or later while it waits |
| State | waiting, then approved or declined once, then paid; withdrawn by the person who claimed while it waits |
| The answer | who gave it, when, and a reason; a no always has one; who marked it paid and when |

Two people answering at once give one answer, and two marking it paid at once mark it once: only a
claim in the right state changes (`KIT-E-3302`).

A receipt is served only to the person who claimed and the people who decide, as a download, a photo
shown in place when asked; it never runs as a page of the portal (a sandboxing policy, its type never
sniffed).

## The setting

| Key | Default | What it does |
|---|---|---|
| `expenses.currency` | `USD` | the three-letter code of the currency people claim in, as `MXN`. Claims already made keep theirs, and sums are kept by currency |

## The pages

| Path | Shows |
|---|---|
| `/expenses` | a row of For you (what waits for the person's answer; to whoever decides somewhere), To pay (approved, not paid yet) and Yours (with how many still wait); "Claim an expense" in a dialog (the place and the category as rows of choices, the amount, what for, where, the day, the receipt, which a phone can take with its camera) and "Download a month" in another; what is approved and still to be paid to the person; the claims |
| `/expenses/:id` | the claim, its amount, category, day and where; a row with "Approve" and "Decline" (with the reason, in a dialog) to whoever may answer it, "Mark paid" (after a confirmation) once approved, "Add the receipt" or "Replace the receipt" and "Withdraw it" (after a confirmation) to the person who claimed while it waits, and "All expenses"; what it was for, the receipt (a photo shown in place), the history |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /claims` (`view` mine, waiting or approved) | `expenses.self` | the list, at most 100, with the places, the counts, what is owed to the person and the company's currency; left out, waiting for whoever decides somewhere, else their own |
| `POST /claims` | `expenses.claim` at the place | claims |
| `GET /claims/:id` | `expenses.self`, and claimed it or decides at its place | one claim, with what the reader may do |
| `PUT /claims/:id/receipt?name=` | `expenses.self`, and claimed it while it waits | keeps the receipt, its content as the body with its own type; one sent without its length is read up to the limit |
| `GET /claims/:id/receipt` (`inline=1`) | `expenses.self`, and claimed it or decides at its place | the receipt, as a download or a photo in place |
| `POST /claims/:id/answer` | `expenses.decide` at its place, not one's own | approves or declines it, a no with its reason; the person who claimed is emailed |
| `POST /claims/:id/paid` | `expenses.decide` at its place, not one's own | marks an approved claim paid; the person who claimed is emailed |
| `POST /claims/:id/withdraw` | `expenses.self`, and claimed it | withdraws it while it waits |
| `GET /export?month=2026-10` | `expenses.decide` | the month's approved and paid claims at the places the person decides, by the day spent, as a CSV file (amounts as plain digits, text a spreadsheet would run as a formula defused); 5000 rows at most |
| `GET /todo` | `expenses.decide` | Needs you: how many claims wait for the person's answer, and how many approved ones wait to be paid, with their sum |

Every step is audited: `expenses.claim`, `expenses.receipt`, `expenses.approve`,
`expenses.decline`, `expenses.pay`, `expenses.withdraw` and `expenses.export` (with the month and
its rows), refusals included. One that went through can set off an automation: an automation on
`expenses.claim` emails the people who decide, one on `expenses.approve` makes the task to pay it.

A privacy request (`@oltrem/privacy`) finds every claim a person made: the place, day, amount,
category, where, what for, the receipt's name, the state and the answer.

## Table

Migration `0033_expenses.sql`, additive and idempotent: `expenses_claims` (the place, who claimed,
the day, the amount and currency, the category, where and what for, the receipt's name, type and
size, its state, who answered, when and why, who marked it paid and when).

## Errors

The `33xx` block: `KIT-E-3301` nobody answers or pays their own claim, `KIT-E-3302` the claim can no
longer change that way, `KIT-E-3303` that receipt cannot be kept, `KIT-E-3304` the claim has no
receipt. An amount, a day, a category or a text out of bounds, and a no without its reason, are the
core's `KIT-E-0422`; a person without the capability at the place is `KIT-E-0403`.

## Not here yet

- Mileage by distance, and per-diem amounts.
- Limits by category or role, and two answers above an amount.
- Reading the amount from the receipt's photo.
- Paying from the portal: "Mark paid" records a payment made elsewhere.
- Receipts count towards the bucket's 10 GB, but the files' storage check counts only the drive.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with a bucket: the
manifest; a claim made only where the person may claim, its amount, day, category and text checked,
every refusal audited; a receipt kept by the person who claimed only, a type that is not a photo or a
PDF refused, one sent without its length read, served in place to the people who decide and refused
to anyone else; what waits for each person who decides, never their own, and Needs you with the sum
to pay; approved or declined once and paid once, never one's own, the four emails; withdrawn only by
the person who claimed while it waits; the month's CSV at the places the person decides, a formula
defused, refused without the capability, audited; the privacy answer. The amounts are tested on
their own: a point or a comma, never a thousands separator, a currency without decimals. The client
template's screens journey claims an expense with a photo of its receipt as the Owner, is refused an
amount with three decimals, finds no Approve on their own claim, and withdraws it.

# @oltrem/expenses

People claim back what they spent for the company, with a photo of the receipt ("Printer ink,
42.80"). A claim belongs to a place, whose roles decide who claims and who answers. Nobody approves
or pays their own claim while someone else decides there; an answer is final and a no says why.
Whoever decides marks it paid once the money is sent. The claimant is emailed each step and sees
what is still owed; each month the deciders download the approved and paid claims for the
accountant.

## Using it

```ts
const expenses = createExpenses<Env>({
  bindings: (env) => ({ db: env.DB, bucket: env.FILES }), // receipts under `expenses/`
  config: settingsFor, // expenses.currency
  timeZone: async (env) => (await settingsFor(env)).get<string>('bookings.time_zone'), // UTC when left out
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: EXPENSE_MESSAGE.id,
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(expenses.module, expensesPages)];
```

It returns `store` and the manifest and stands on IAM, the audit log and settings. Without the
bucket (the client's one R2 bucket, apart from the drive) claims have no receipts; without `send`
nobody is emailed. No binding, secret or variable.

Two capabilities on bit plane 23, read at the claim's place: `expenses.claim` and `expenses.decide`
(see claims and receipts, approve, decline, mark paid, download a month). The claimant always sees
their own, and adds or replaces the receipt or withdraws while it waits (`expenses.self`, every
account); anyone else cannot open a claim or its receipt.

**One's own claim.** An Owner or the Vendor answers and pays their own when no other person who is
on may decide at its place, so a company of one is never stuck; at most ten possible deciders are
checked (with more, it waits). The audit row says `self: true` and nobody is emailed. Once someone
else decides there, it waits for them (`KIT-E-3301`). Who decides is read from compiled access, so
a deny or override counts.

## A claim

Limits are `LIMITS` in `src/expenses.ts`.

| Part | What it is |
|---|---|
| Amount | 12.50 or 12,50, never a thousands separator; kept in the smallest unit |
| Currency | `expenses.currency` (default `USD`, an Owner's setting) at the claim; kept; sums by currency |
| Category | `CATEGORIES`: travel, meals, supplies, equipment, services, other |
| What for, where | `description` (1,000), `merchant` (200); the day spent is today or before |
| Receipt | `RECEIPT_TYPES` (PNG, JPEG, WebP, HEIC, HEIF, PDF), `receipt` (10 MB), with the claim or later while it waits (`KIT-E-3303`) |
| State | `STATES`: waiting, approved or declined once, paid; withdrawn while waiting. Only a claim in the right state changes, so two answers give one (`KIT-E-3302`) |
| The answer | Who, when, a reason (always for a no, `reason` 1,000); who marked it paid and when |

A receipt goes only to the claimant and the deciders, as a download or a photo in place, under a
sandboxing policy, its type never sniffed.

## Pages and routes

| Path | Shows |
|---|---|
| `/expenses` | Chips For you (waiting on the person's answer), To pay, Yours (with how many wait); **Claim an expense** (place and category as chips, amount, what for, where, day, receipt by camera) and **Download a month** in dialogs; what is owed to the person; the claims. A refused receipt keeps the claim and opens it saying both |
| `/expenses/:id` | Amount, category, day, where; **Approve**, **Decline** (with reason), **Mark paid** (confirmed), **Add** or **Replace the receipt**, **Withdraw it** (confirmed); what for, the receipt, the history |

| Route | Needs | What it does |
|---|---|---|
| `GET /claims` (`view` `VIEWS`: mine, waiting, approved) | `expenses.self` | `listed` (100) from `scanned` (500) rows, with places, counts, what is owed and currency; by default waiting for a decider, else their own |
| `POST /claims` | `expenses.claim` at the place | Claims |
| `GET /claims/:id` | `expenses.self`, claimant or decider | One, with what the reader may do |
| `PUT /claims/:id/receipt?name=` | `expenses.self`, claimant while waiting | The body is the file with its type; one without a length is read up to the limit |
| `GET /claims/:id/receipt` (`inline=1`) | `expenses.self`, claimant or decider | A download or a photo in place (`KIT-E-3304` with none) |
| `POST /claims/:id/answer`, `/paid` | `expenses.decide` at its place (one's own as above) | Approve or decline (a no with its reason), or mark an approved one paid; the claimant emailed unless their own |
| `POST /claims/:id/withdraw` | `expenses.self`, claimant | Withdraws while waiting |
| `GET /export?month=2026-10` | `expenses.decide` | The month's approved and paid claims where the person decides, by day, as CSV (plain digits, formulas defused), `exported` (5,000), named `-first-5000` past it |

Module parts: Needs you (waiting answers, approved ones to pay with their sum), Reports under Money
(made, claimed, paid back, waiting, per day and by category), and the privacy answer (every claim a
person made). Audited, refusals too: `expenses.claim`, `.receipt`, `.approve`, `.decline`, `.pay`,
`.withdraw`, `.export` (month and rows); an automation can follow `expenses.claim` or `.approve`.

## Table and errors

Migration `0033`: `expenses_claims` (place, claimant, day, amount and currency, category, where, what
for, the receipt's name, type and size, state, the answer, who paid and when).

Block `33xx`: `KIT-E-3301` not one's own while someone else decides, `3302` it can no longer change
that way, `3303` that receipt cannot be kept, `3304` no receipt. Bad input or a no without a reason
is `KIT-E-0422`, no capability `KIT-E-0403`.

Not built: mileage and per-diem; limits by category or role and two answers above an amount;
reading the amount from the photo; paying from the portal; the files' storage check counting
receipts (they count towards the bucket's 10 GB).

## Tests

`test/expenses.test.ts`, with a bucket: the manifest; claims only where allowed, every field checked,
refusals audited; receipts by the claimant only, a wrong type refused, one without a length read,
served to deciders and refused to others; what waits for each decider, never their own, Needs you
with the sum; answered and paid once, the four emails; withdrawn only by the claimant while waiting;
the month's CSV by place, defused, refused without the capability, audited; privacy; an Owner's own
claim with nobody else deciding, `self: true`, no email; amounts with a point or comma, no thousands
separator, a currency without decimals. The client template's screens journey claims with a receipt
photo, is refused three decimals, and withdraws.

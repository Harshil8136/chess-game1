# @oltrem/approvals

Someone asks for a yes and someone else gives it or not ("A new laptop for the front desk"). A
request belongs to a place, whose roles decide who asks and who answers. Nobody answers their own
(save an Owner or the Vendor alone there); an answer is final and a no says why. Deciders see what
waits on Home; the asker is emailed the answer. An automation can follow each step.

## Using it

```ts
const approvals = createApprovals<Env>({
  bindings: (env) => ({ db: env.DB }),
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: APPROVAL_MESSAGE.id,
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(approvals.module, approvalsPages)];
```

It returns `store` and the manifest and stands on IAM and the audit log; without `send` nobody is
emailed. No binding, secret or variable.

Two capabilities on bit plane 19, read at the request's place: `approvals.ask` and
`approvals.decide`. The asker always sees and may withdraw their own while it waits
(`approvals.self`, every account); anyone else cannot open one.

**One's own request.** An Owner or the Vendor may answer their own when no other person of the
company decides at its place, read from each active person's access now (the Vendor never counts as
the other); at most `deciders` (10) are checked, and with more it waits. The audit row says
`self: true` and no email goes. While another person decides there, `KIT-E-3001`. Anyone else whose
request nobody can answer is told so, with a link to invite the right person.

## A request

Limits are `LIMITS` in `src/approvals.ts`.

| Part | What it is |
|---|---|
| Title, details | `title` (200); `details` (4,000): cost, days, a link |
| Needed by | A day or none; the soonest first |
| State | `STATES`: waiting, then approved, declined or withdrawn, once; only a waiting one changes, so two answers give one (`KIT-E-3002`) |
| The answer | Who, when, a note (always for a no, `note` 1,000) |

## Pages and routes

| Path | Shows |
|---|---|
| `/approvals` | Chips For you (waiting on the person's answer, own ones included where they may answer alone), Asked by you, Answered; **Ask for a yes** in a dialog (place as chips when several); the requests |
| `/approvals/:id` | State, place, asker; a notice when answering one's own or when nobody can answer yet (with Invite); **Approve** (confirmed), **Decline** (with reason), **Withdraw it** (confirmed); details and history |

| Route | Needs | What it does |
|---|---|---|
| `GET /requests` (`view` `VIEWS`: waiting, mine, answered) | `approvals.self` | `listed` (100) from `scanned` (500), with places and counts; by default waiting for a decider, else their own |
| `POST /requests` | `approvals.ask` at the place | Asks |
| `GET /requests/:id` | `approvals.self`, asker or decider | One, with what the person may do |
| `POST /requests/:id/answer` | `approvals.decide` at its place (one's own as above) | Approve or decline, a no with its note; the asker emailed unless their own |
| `POST /requests/:id/withdraw` | `approvals.self`, asker | While it waits |

Module parts: Needs you (waiting, and needed by today or earlier) and search (titles of one's own
and where one decides). Audited, refusals too: `approvals.ask`, `.approve`, `.decline`, `.withdraw`.

## Table and errors

Migration `0027`: `approvals_requests` (place, title, details, needed by, state, asker, the answer).
Block `30xx`: `KIT-E-3001` not one's own, `3002` no longer waiting. Bad input or a no without a
reason is `KIT-E-0422`, no capability `KIT-E-0403`.

Not built: two answers or answers in a row; amounts with limits by role; files (a link does it);
an email to deciders on a new request (an automation on `approvals.ask` does it).

## Tests

| File | Covers |
|---|---|
| `test/approvals.test.ts` | The manifest; asked only where allowed, refusals audited; what waits for each decider soonest first, their own and Needs you; one request seen by asker and deciders only; answered once, a no with its reason, the email; withdrawn by the asker; search; an Owner, then the Vendor, answering their own alone (`self`), refused where someone else decides; a request nobody can answer |
| `test/pages.test.ts` | Approve behind a confirmation; the two notices |

The client template's screens test asks as the Owner, finds no Approve on their own
request and withdraws it.

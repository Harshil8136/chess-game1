# @oltrem/approvals

Approvals: someone asks for a yes, and someone else gives it or not. "A new laptop for the front
desk"; "Two days off next week"; "Pay this supplier". A request belongs to a place, so the roles
held there decide who may ask and who answers. Nobody answers their own request (but an Owner or
the Vendor alone at a place, below), an answer is final, and a no says why. The people who decide see what waits for them on Home; the person who
asked is told the answer by email. Every step is in the audit log, so an automation can follow
it: when something is approved, make a task or send an email.

## Using it

```ts
import { createApprovals } from '@oltrem/approvals';
import { pages as approvalsPages } from '@oltrem/approvals/pages';
import { withPages } from '@oltrem/core-module';

const approvals = createApprovals<Env>({
  bindings: (env) => ({ db: env.DB }),
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: APPROVAL_MESSAGE.id, // a template with a subject and a text
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(approvals.module, approvalsPages)];
```

`createApprovals` returns the `store` and the module manifest. It stands on the IAM module
(sessions, the authorizer) and the audit log. `send` is optional: without it nobody is emailed.
It adds no binding, secret or variable.

## Who may do what

Two capabilities on bit plane `19`, both read at the request's place, so a role at a place (or at
a place above it) decides:

| Capability | Lets them |
|---|---|
| `approvals.ask` | ask for a yes at the place |
| `approvals.decide` | see what is asked at the place, and approve or decline it, never their own (except an Owner or the Vendor where nobody else decides there) |

The person who asked always sees their own requests and may withdraw one while it waits, whatever
they hold later (`approvals.self`, which every account holds). Someone who neither asked nor
decides at the place cannot open a request.

Answering one's own: an Owner or the Vendor may approve or decline their own request when no other
person of the company decides at its place. "Decides" is each active person's access as it is now,
overrides and denies included; the Vendor never counts as that other person. At most ten people who
could decide are checked; with more, someone is taken to decide, and it waits for them. The audit
row of such an answer names the asker and carries `self: true`, and no email is sent, since they
gave it. While another person decides there, the separation stands (`KIT-E-3001`). Anyone else whose
request nobody else can answer is told so on its page, with a link to invite the person who should.

## A request

| Part | What it is |
|---|---|
| What it is for | a title, 200 characters at most |
| Place | where it is asked; the people who decide there answer it |
| Details | 4000 characters at most: the cost, the days, a link |
| Needed by | a day, or none; the soonest needed is listed first |
| State | waiting, then approved, declined or withdrawn, once |
| The answer | who gave it, when, and a note; a no always has one, 1000 characters at most |

Two people answering at once give one answer: only a request still waiting changes, and the
second is told it was answered (`KIT-E-3002`).

## The pages

| Path | Shows |
|---|---|
| `/approvals` | a row of For you (what waits for the person's answer, with the count, their own waiting requests included where they may answer them alone; to whoever decides somewhere), Asked by you (with how many still wait) and Answered (at the places they decide); "Ask for a yes" in a dialog, the place as a row of choices when there is more than one; the requests |
| `/approvals/:id` | the request, its state, place and who asked; a notice when the person answers their own, or when nobody can answer it yet (with a link to invite someone); a row with "Approve" (after a confirmation: an answer is final) and "Decline" (with the reason, in a dialog) to whoever may answer it, "All approvals", and "Withdraw it" (after a confirmation) to the person who asked while it waits; its details and history |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /requests` (`view` waiting, mine or answered) | `approvals.self` | the list, at most 100, with the places and the counts; left out, waiting for whoever decides somewhere, else their own |
| `POST /requests` | `approvals.ask` at the place | asks |
| `GET /requests/:id` | `approvals.self`, and asked it or decides at its place | one request, with what the person may do to it |
| `POST /requests/:id/answer` | `approvals.decide` at its place, not one's own (save an Owner or the Vendor where nobody else decides) | approves or declines it, a no with its note; the person who asked is emailed, unless they answered it themselves |
| `POST /requests/:id/withdraw` | `approvals.self`, and asked it | withdraws it while it waits |
| `GET /todo` | `approvals.decide` | Needs you: how many requests wait for the person's answer, and how many are needed by today or earlier |
| `GET /search` | `approvals.self` | the portal's search: requests by title, the person's own and those at the places they decide |

Every step is audited: `approvals.ask`, `approvals.approve`, `approvals.decline`,
`approvals.withdraw`, refusals included. One that went through can set off an automation: an
automation on `approvals.approve` makes the task that follows, one on `approvals.ask` emails the
people who decide.

## Table

Migration `0027_approvals.sql`, additive and idempotent: `approvals_requests` (the place, what it
is for and its details, the day it is needed by, its state, who asked and when, who answered, when
and why).

## Errors

The `30xx` block: `KIT-E-3001` nobody answers their own request (save an Owner or the Vendor where
nobody else decides), `KIT-E-3002` the request is no
longer waiting. A title, a note or a day out of bounds, and a no without its reason, are the core's
`KIT-E-0422`; a person without the capability at the place is `KIT-E-0403`.

## Not here yet

- Two answers needed, or answers in a row (a lead, then the Owner).
- An amount with limits by role: up to a sum at one level, above it at the next.
- Files attached to a request; a link in the details does it today.
- An email to the people who decide when something is asked: an automation on `approvals.ask`
  does it today.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; a request
asked only where the person may ask, with its title and day checked, every refusal audited; what
waits for each person who decides (never their own, except where they may answer it alone), soonest needed first, their own requests and
Needs you; one request seen only by the person who asked and the people who decide at its place;
approved or declined once, never one's own, a no only with its reason, the person who asked
emailed the answer and the note; withdrawn only by the person who asked while it waits; the
search; an Owner, then the Vendor, finding their own in For you and Needs you and answering it where nobody else decides, audited with
`self`, and refused where someone else does; a person nobody can answer told so. The pages,
against answers of the API (`test/pages.test.ts`): Approve behind a confirmation, and the two
notices. The client template's screens test asks for a yes as the Owner, finds no Approve on their
own request and withdraws it.

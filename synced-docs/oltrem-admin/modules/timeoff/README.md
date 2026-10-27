# @oltrem/timeoff

Time off: people ask for days off, and someone else says yes or no. Vacation, sick leave, personal
time. A request belongs to a place, so the roles held there decide who may ask and who answers.
Nobody answers their own request, an answer is final, and a no says why. One person never has two
requests waiting or approved on the same day. When the company sets its vacation days a year, each
person sees what they took, asked for and have left, and so do the people who decide. Colleagues see
who is off in the next two weeks and when, never why. The person who asked is told the answer by
email, and every step is in the audit log.

## Using it

```ts
import { createTimeOff } from '@oltrem/timeoff';
import { pages as timeoffPages } from '@oltrem/timeoff/pages';
import { withPages } from '@oltrem/core-module';

const timeoff = createTimeOff<Env>({
  bindings: (env) => ({ db: env.DB }),
  config: settingsFor, // reads timeoff.days_per_year
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: TIMEOFF_MESSAGE.id, // a template with a subject and a text
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(timeoff.module, timeoffPages)];
```

`createTimeOff` returns the `store` and the module manifest. It stands on the IAM module (sessions,
the authorizer), the audit log and the settings. `send` is optional: without it nobody is emailed.
It adds no binding, secret or variable.

## Who may do what

Two capabilities on bit plane `22`, both read at the request's place, so a role at a place (or at a
place above it) decides:

| Capability | Lets them |
|---|---|
| `timeoff.ask` | ask for time off at the place, and see who is off there and when |
| `timeoff.decide` | see what is asked at the place, with its kind and note, and approve or decline it, never their own |

The person who asked always sees their own requests and may withdraw one, whatever they hold later
(`timeoff.self`, which every account holds). Someone who neither asked nor decides at the place
cannot open a request.

Why someone is off is private. In who is off, a colleague sees the person and the days; the kind,
the note and the reason are shown only to the person and the people who decide at the place.

## A request

| Part | What it is |
|---|---|
| Place | where it is asked; the people who decide there answer it |
| Kind | vacation, sick leave, personal or other; only vacation counts against the days a year |
| Days | the first and last day off, both counted; one request covers 366 days at most |
| Working days | Monday to Friday from the first day to the last, counted when it is asked |
| Note | 1000 characters at most, for the people who decide |
| State | waiting, then approved or declined once; withdrawn by the person who asked |
| The answer | who gave it, when, and a reason; a no always has one, 1000 characters at most |

Asking for a day the person already has waiting or approved is refused in the same statement that
writes the row (`KIT-E-3202`), so two requests sent at once cannot both get through. Two people
answering at once give one answer: only a request still waiting changes (`KIT-E-3203`).

A request can be withdrawn while it waits, or once approved until its first day, so the person can
cancel a holiday that has not started. Days count in UTC; a request asked for today has begun.

## The setting

| Key | Default | What it does |
|---|---|---|
| `timeoff.days_per_year` | `0` | the working days of vacation each person has in a calendar year; `0` counts none. A request across New Year counts its days in each year. A request beyond the days left is not refused: the people who decide see the count, below zero in red |

## The pages

| Path | Shows |
|---|---|
| `/timeoff` | a row of For you (what waits for the person's answer, with the count; to whoever decides somewhere), Yours (with how many still wait) and Who is off (the next 14 days at the places the person asks or decides); "Ask for time off" in a dialog, the place and the kind as rows of choices; the person's vacation this year when it is counted; the requests |
| `/timeoff/:id` | the request, its state, place, who asked and the days; the vacation of the person who asked in that year; a row with "Approve" and "Decline" (with the reason, in a dialog) to whoever may answer it, "All time off", and "Withdraw it" (after a confirmation) to the person who asked while they may; the note and the history |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /requests` (`view` mine, waiting or off) | `timeoff.self` | the list, at most 100, with the places, the counts, the person's vacation this year and the window of who is off; left out, waiting for whoever decides somewhere, else their own |
| `POST /requests` | `timeoff.ask` at the place | asks; refused when the person already has some of those days |
| `GET /requests/:id` | `timeoff.self`, and asked it or decides at its place | one request, with the vacation of the person who asked and what the reader may do |
| `POST /requests/:id/answer` | `timeoff.decide` at its place, not one's own | approves or declines it, a no with its reason; the person who asked is emailed |
| `POST /requests/:id/withdraw` | `timeoff.self`, and asked it | withdraws it while it waits, or once approved until it begins |
| `GET /todo` | `timeoff.decide` | Needs you: how many requests wait for the person's answer, and the day the soonest begins |

Every step is audited: `timeoff.ask`, `timeoff.approve`, `timeoff.decline`, `timeoff.withdraw`,
refusals included. One that went through can set off an automation: an automation on
`timeoff.ask` emails the people who decide, one on `timeoff.approve` posts an announcement.

A privacy request (`@oltrem/privacy`) finds every request a person made: the place, kind, days,
note, state and answer.

## Table

Migration `0032_timeoff.sql`, additive and idempotent: `timeoff_requests` (the place, who asked,
the kind, the first and last day and the working days between, the note, its state, who answered,
when and why).

## Errors

The `32xx` block: `KIT-E-3201` nobody answers their own time off, `KIT-E-3202` those days are
already asked for, `KIT-E-3203` the request can no longer change. A day, a kind or a note out of
bounds, and a no without its reason, are the core's `KIT-E-0422`; a person without the capability
at the place is `KIT-E-0403`.

## Not here yet

- Public holidays and each person's own working days: every Monday to Friday counts today.
- Half days, and hours off.
- Days a year by person or role, and days carried over into the next year.
- A shared calendar feed of who is off.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; time off
asked only where the person may ask, its days and kind checked, never twice on one day, every
refusal audited; what waits for each person who decides (never their own), soonest first, their
own requests, their vacation this year and Needs you; one request seen only by the person who asked
and the people who decide at its place; approved or declined once, never one's own, a no only with
its reason, the person who asked emailed; who is off with the kind hidden from colleagues; withdrawn
only by the person who asked, until it begins; the privacy answer. The days are tested on their
own: real dates only, Monday to Friday whatever the week's start, and split by year. The client
template's screens test asks for time off as the Owner, finds no Approve on their own request and
withdraws it.

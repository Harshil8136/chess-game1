# @oltrem/timeoff

People ask for days off (vacation, sick leave, personal time) and someone else says yes or no. A
request belongs to a place, whose roles decide who asks and who answers. Nobody answers their own
while someone else decides there; an answer is final and a no says why. Nobody has two requests on
one day. With vacation days a year set, each person and the deciders see what was taken, asked and
left. Colleagues see who is off in the next two weeks, never why.

## Using it

```ts
const timeoff = createTimeOff<Env>({
  bindings: (env) => ({ db: env.DB }),
  config: settingsFor, // timeoff.days_per_year
  timeZone: async (env) => (await settingsFor(env)).get<string>('bookings.time_zone'), // UTC when left out
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: TIMEOFF_MESSAGE.id,
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(timeoff.module, timeoffPages)];
```

It returns `store` and the manifest and stands on IAM, the audit log and settings; without `send`
nobody is emailed. No binding, secret or variable.

Two capabilities on bit plane 22, read at the request's place: `timeoff.ask` (ask, see who is off)
and `timeoff.decide` (see requests with kind and note, approve or decline). The asker always sees
and may withdraw their own (`timeoff.self`, every account); anyone else cannot open one. The kind,
note and reason are shown only to the asker and the deciders.

**One's own request.** An Owner or the Vendor answers their own when no other person who is on may
decide at its place, so a company of one is never stuck; at most ten possible deciders are checked
(with more, it waits). The audit row says `self: true` and nobody is emailed. Once someone else
decides there, it waits for them (`KIT-E-3201`). Who decides is read from compiled access.

## A request

Limits are `LIMITS` in `src/timeoff.ts`.

| Part | What it is |
|---|---|
| Kind | `KINDS`: vacation, sick, personal, other; only vacation counts against the days a year |
| Days | First and last, both counted, `span` (366) at most; working days are Monday to Friday between |
| Note | `note` (1,000), for the deciders |
| State | `STATES`: waiting, approved or declined once, withdrawn |
| The answer | Who, when, a reason (always for a no, `reason` 1,000) |

A day already waiting or approved is refused in the statement that writes the row (`KIT-E-3202`);
only a waiting request is answered, so two answers give one (`KIT-E-3203`). Withdrawn while waiting,
or once approved until its first day. Days count in UTC; one asked for today has begun.

| Setting | Default | What it does |
|---|---|---|
| `timeoff.days_per_year` | `0` | Vacation working days a calendar year; `0` counts none. A request across New Year counts in each year; one past the days left is not refused, the count shows below zero in red |

## Pages and routes

| Path | Shows |
|---|---|
| `/timeoff` | Chips For you (waiting on the person's answer, with count), Yours, Who is off (next `window` 14 days where they ask or decide); **Ask for time off** in a dialog (place and kind as chips); this year's vacation when counted; the requests. Days already asked for are refused with a link to that request |
| `/timeoff/:id` | State, place, asker, days; the asker's vacation that year; **Approve**, **Decline** (with reason), **Withdraw it** (confirmed); note and history |

| Route | Needs | What it does |
|---|---|---|
| `GET /requests` (`view` `VIEWS`: mine, waiting, off) | `timeoff.self` | `listed` (100) from `scanned` (500), with places, counts, this year's vacation and who is off; by default waiting for a decider, else their own |
| `POST /requests` | `timeoff.ask` at the place | Asks |
| `GET /requests/:id` | `timeoff.self`, asker or decider | One, with the asker's vacation and what the reader may do |
| `POST /requests/:id/answer` | `timeoff.decide` at its place (one's own as above) | Approve or decline, a no with its reason; the asker emailed unless their own |
| `POST /requests/:id/withdraw` | `timeoff.self`, asker | While waiting, or approved until it begins |

Module parts: Needs you (waiting requests and the soonest day), the privacy answer (every request a
person made), and `store.calendar(env, session, from, to)` (own approved days, `calendar` 200,
all-day items titled `Time off: <kind>`, for `@oltrem/connect`). Audited, refusals too:
`timeoff.ask`, `.approve`, `.decline`, `.withdraw`; an automation can follow them.

## Table and errors

Migration `0032`: `timeoff_requests` (place, asker, kind, first and last day, working days, note,
state, the answer).

Block `32xx`: `KIT-E-3201` not one's own while someone else decides, `3202` those days are already
asked for, `3203` it can no longer change. Bad input or a no without a reason is `KIT-E-0422`, no
capability `KIT-E-0403`.

Not built: public holidays and each person's working days; half days and hours; days by person or
role, carried over; a shared calendar of who is off.

## Tests

| File | Covers |
|---|---|
| `test/timeoff.test.ts` | The manifest; asked only where allowed, days and kind checked, never twice a day, refusals audited; what waits for each decider (never their own) soonest first, their own, this year's vacation, Needs you; one request seen by asker and deciders only; answered once, a no with reason, the email; who is off with the kind hidden; withdrawn by the asker until it begins; privacy; an Owner's own with nobody else deciding (`self: true`, no email) and refused where someone does; calendar items, gone with the role |
| `test/days.test.ts` | Real dates only, Monday to Friday whatever the week's start, split by year |

The client template's screens test asks for time off as the Owner and withdraws it.

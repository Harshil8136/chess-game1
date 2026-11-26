# @oltrem/shifts

Who works when at each place. A planner drafts the week's shifts, each with a person or left open,
and publishes the week: the place's people see it and everyone on it is emailed their shifts.
People see their own on the phone and take open ones; a changed or cancelled shift tells the people
on it; a planner copies the week before in one go. It plans the work; `@oltrem/timeclock` records
the hours worked.

## Using it

```ts
const shifts = createShifts<Env>({
  bindings: (env) => ({ db: env.DB }),
  timeZone: async (env) => (await settingsFor(env)).get<string>(TIME_ZONE_SETTING.key), // kept in UTC
  send: async (env, message) => {
    await email.send(env, {
      tenantId: message.tenantId,
      template: 'shifts.message',
      to: [{ email: message.to }],
      data: { subject: message.subject, text: message.text },
      messageKey: message.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(shifts.module, shiftsPages)];
```

It returns `store` and the manifest, stands on IAM, the audit log and the company's clock, and adds
one table, no binding, secret, variable or setting. Two capabilities on bit plane 27, held at a
place: `shifts.view` (the published schedule, taking open shifts) and `shifts.plan` (plan, change,
remove, publish, drafts included). Everyone sees their own published shifts.

## The rules

| Rule | Why |
|---|---|
| A draft is seen only by its place's planners until the week is published there | People see a schedule once decided |
| A day and two times on the company's clock; an end before the start is the next day | A night shift is typed as said; daylight saving is the clock's |
| One shift at a time a person, checked in the statement that writes it (`KIT-E-3701`) | Two planners cannot double-book someone |
| Given to a person of the company who is on, by address (`KIT-E-3703`), or left open | Nobody is put on a shift they cannot see |
| An open published shift not yet started is taken once, by someone who sees the place and is free (`KIT-E-3702`) | The first to take it has it, with no clash |
| Publishing emails each person their week's shifts there; a change emails who works it now and who no longer does; removal emails who worked it | Nobody learns of a change by surprise |
| **Copy the week before** makes drafts at the same clock times, leaving out one whose person is busy or that exists, in one statement | One tap, across daylight saving; copying twice does nothing |
| A failed email is reported and never undoes the change | The schedule stays right when mail is down |

## Pages and routes

| Path | Shows |
|---|---|
| `/shifts` | Chips Mine or Schedule; the week before, this, after. For planners **Plan a shift** (addresses offered, the planner first), **Copy the week before** and **Publish the week (n)** in dialogs (publish offers only places with drafts, the most first). Mine: the person's shifts and open ones with **Take it**; Schedule: every shift where they see, drafts marked for planners |
| `/shifts/:id` | When, how long, where, who or open, draft or not, the note; **Take it**, **Change it**, **Remove it** in dialogs |

Places are chips when there is more than one. A planned shift returns to its week as a draft beside
Publish; a publish with nothing waiting says "Nothing to publish there"; an address that is nobody
of the company links to invite them on People.

| Route | Needs | What it does |
|---|---|---|
| `GET /shifts` (`view` `VIEWS`, `week`) | everyone | A week (`week` any day in it): `mine` (own and takeable) or `schedule` (`listed` 500), with drafts waiting and `draftPlaces` |
| `POST /shifts` | `shifts.plan` at the place | A draft: place, day, two times, an address or none, a label (`label` 100) and note (`note` 500) |
| `GET /people` | `shifts.plan` somewhere | The company's people who are on, the reader first, `people` (200) |
| `GET /shifts/:id` | everyone | To who works it, sees its place once published, or plans it |
| `POST /shifts/:id`, `/remove` | `shifts.plan` at its place | Change times, person, label, note; remove |
| `POST /shifts/:id/take` | `shifts.view` at its place | Take an open shift |
| `POST /publish` | `shifts.plan` at the place | Publishes the week's drafts and emails each person; `published` is how many |
| `POST /copy` | `shifts.plan` at the place | Copies the week before as drafts, saying how many were copied and left out |

Module parts: Needs you (drafts and open shifts in the next `ahead` 14 days where the person plans),
the privacy answer (every shift given to a person), and `store.calendar(env, session, from, to)`
(own published shifts, `calendar` 200, titled `Shift: <label>`, for `@oltrem/connect`'s calendar
link). Audited, refusals too: `shifts.plan`, `.change`, `.remove`, `.publish` and `.copy` (week and
count), `.take`.

## Table and errors

Migration `0038`: `shifts_items` (place, person or none, start and end in UTC, label, note,
published, who planned it and when).

Block `37xx`: `KIT-E-3701` busy then, `3702` cannot be taken (taken, a draft, or started), `3703` no
such person who is on. A bad day or time is `KIT-E-0422`, not there `KIT-E-0404`, not a planner
there `KIT-E-0403`.

Not built: swaps and giving a shift up; a warning when the person is on time off; breaks and planned
against clocked hours.

## Tests

| File | Covers |
|---|---|
| `test/shifts.test.ts` | On the Mexico City clock: the manifest; drafts only where allowed, overnight, double booking, unknown address, other place, no capability and an impossible day refused; drafts for planners only; Needs you; publishing by week with emails; mine, open and schedule, nothing without a role; another week; taking refused when busy, once, not after the start; changes and removals emailed, a draft removed quietly; copying, a busy person left out, twice nothing, New York's daylight saving; draft places; the people offered; privacy; the audit; calendar items, gone with the role |
| `test/pages.test.ts` | A planned shift on its week; publishing nothing or some; the publish dialog's places; a non-company address with Invite; one shift changed, a refusal kept |

The client template's screens journey plans a shift, is refused a second at the same time,
publishes, finds the shift and email, and copies the week.

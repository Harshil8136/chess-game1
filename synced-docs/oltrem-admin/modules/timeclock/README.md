# @oltrem/timeclock

Time clock: people clock in when they start work and out when they stop, from their phone, at a
place. The time between is theirs for the week, shown on the company's clock with the week's
total. Whoever manages the place sees everyone's hours there, adds the time someone forgot to clock
and fixes a missed clock-out, always saying why and never for themselves, and downloads the hours as
a spreadsheet for payroll. Who is still clocked in after a long day shows on Home, and every step is
in the audit log.

## Using it

```ts
import { createTimeClock } from '@oltrem/timeclock';
import { pages as timeclockPages } from '@oltrem/timeclock/pages';
import { withPages } from '@oltrem/core-module';

const timeclock = createTimeClock<Env>({
  bindings: (env) => ({ db: env.DB }),
  // The company's clock: the client template reads the bookings' time zone, one clock a portal.
  timeZone: async (env) => (await settingsFor(env)).get<string>('bookings.time_zone'),
});
const modules = [iam.module, /* ... */ withPages(timeclock.module, timeclockPages)];
```

`createTimeClock` returns the `store` and the module manifest. It stands on the IAM module
(sessions, the authorizer, the people of the company), the audit log and the company's clock of
`@oltrem/core-config`. It adds no binding, secret, variable or setting, and sends no email.

## Who may do what

Two capabilities on bit plane `25`, both read at the entry's place, so a role at a place (or at a
place above it) decides:

| Capability | Lets them |
|---|---|
| `timeclock.clock` | clock in and out at the place |
| `timeclock.manage` | see everyone's hours at the place, add the time someone forgot, fix a stretch's times (which clocks out one still open), download the hours; never their own |

A person always sees their own hours and clocks out, whatever they hold later
(`timeclock.self`, which every account holds). Someone who neither worked a stretch nor manages
its place cannot open it.

## A stretch of work

| Part | What it is |
|---|---|
| Place | where it was worked; the people who manage there see and fix it |
| Person | who worked it |
| Start, end | kept in UTC and shown on the company's clock; no end while the person is clocked in |
| Note | 500 characters at most, given when clocking in; one given when clocking out is added below it |
| Fix | who added or fixed it, when, and why |

A person is clocked in at one place at a time (`KIT-E-3501`): the statement that clocks in refuses
a second, and a unique index refuses it when two taps arrive at once. Clocking out when not clocked
in is `KIT-E-3502`. A manager types a stretch as a day and two times on the company's clock; an end
before the start is the next day, so a stretch lasts under 24 hours. It must have ended already,
must not overlap another of the same person (`KIT-E-3504`), and says why. Nobody adds or fixes their
own hours (`KIT-E-3503`).

## The pages

| Path | Shows |
|---|---|
| `/timeclock` | the clock: "Clocked in" with the time so far, where and since when, and Clock out (a note folded away); or Clock in, the place as a row of choices when there is more than one; a row of Mine and Team to whoever manages somewhere; a row with the week before and after, This week, and to managers "Add hours" and "Download hours" in dialogs; which week and clock it is; the week's figures (hours and days, or hours, people and who is clocked in now); the team's hours by person; each stretch by day with its hours, place and whether it was fixed |
| `/timeclock/:id` | one stretch: who, where, the day and times, the hours; "Fix the times" (or "Clock them out" while open) in a dialog to whoever manages its place and did not work it; the note; who fixed it, when and why |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /entries` (`view` mine or team, `week` any day in it) | `timeclock.self`; the team needs `timeclock.manage` somewhere | the week from Monday on the company's clock, at most 500 stretches, with the totals by person, the places and the person's open stretch |
| `POST /in` | `timeclock.clock` at the place | clocks in, with a note |
| `POST /out` | `timeclock.self` | clocks out, with a note |
| `POST /entries` | `timeclock.manage` at the place | adds a stretch for a person of the company whose account is on, with why |
| `GET /entries/:id` | `timeclock.self`, and worked it or manages its place | one stretch, with whether the reader may fix it |
| `POST /entries/:id/fix` | `timeclock.manage` at its place, not one's own | sets its day and times with why, which closes one still open |
| `GET /export?from=&to=` | `timeclock.manage` | the stretches that started between the two days at the places the person manages, by person, as a CSV file (hours as decimals, text a spreadsheet would run as a formula defused); 62 days and 5000 rows at most |
| `GET /todo` | `timeclock.manage` | Needs you: who is still clocked in after 12 hours at the places the person manages |

Every step is audited: `timeclock.in`, `timeclock.out`, `timeclock.add`, `timeclock.fix` and
`timeclock.export` (with the days and its rows), refusals included. One that went through can set
off an automation: one on `timeclock.fix` can tell the person.

A privacy request (`@oltrem/privacy`) finds every stretch a person worked: the place, the start and
end, the note, and who fixed it, when and why.

## Table

Migration `0035_timeclock.sql`, additive and idempotent: `timeclock_entries` (the place, the
person, the start and end, the note, who fixed it, when and why), with a unique index that holds one
open stretch a person.

## Errors

The `35xx` block: `KIT-E-3501` clocked in already, `KIT-E-3502` not clocked in, `KIT-E-3503`
nobody adds or fixes their own hours, `KIT-E-3504` the times do not work (ahead of now, or
overlapping). A day, a time or a text out of bounds, an unknown address and a fix without its
reason are the core's `KIT-E-0422`; a person without the capability at the place is `KIT-E-0403`.

## Not here yet

- Shifts planned ahead, and hours compared with them.
- Breaks inside a stretch, overtime rules and rounding.
- Where the person was when they clocked in: the pages run without a script, and a phone's
  location needs one.
- A person asking for a fix: today they ask a manager, who fixes it with the reason.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, on the Mexico City clock:
the manifest and the Monday of a week; clocked in only where the person may clock, once at a time,
out once with the note added; the person's week and the team's at the places a manager manages,
with the totals and who is still in, the team refused to someone who manages nowhere, the weeks
before and after; Needs you after 12 hours; a stretch fixed by another manager with the reason,
refused without one, ahead of now, by someone who does not manage the place; hours added refused
when they overlap, for oneself, for an unknown address and at a place the manager does not manage,
and an end before the start read as the next morning; the download at the places the person
manages, refused without the capability and over 62 days, audited; the privacy answer. The client
template's screens journey clocks the Owner in and out through the page.

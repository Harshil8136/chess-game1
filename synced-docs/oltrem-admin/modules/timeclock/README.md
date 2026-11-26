# @oltrem/timeclock

People clock in and out from their phone at a place; the time between is theirs for the week, on the
company's clock with the week's total. A manager sees everyone's hours there, adds forgotten time
and fixes a missed clock-out (always saying why), and downloads the hours for payroll. Who is still
clocked in after a long day shows in Needs you.

## Using it

```ts
const timeclock = createTimeClock<Env>({
  bindings: (env) => ({ db: env.DB }),
  timeZone: async (env) => (await settingsFor(env)).get<string>('bookings.time_zone'), // one clock a portal
});
const modules = [iam.module, /* ... */ withPages(timeclock.module, timeclockPages)];
```

It returns `store` and the manifest, stands on IAM, the audit log and the company's clock, adds no
binding, secret, variable or setting, and sends no email.

Two capabilities on bit plane 25, read at the stretch's place: `timeclock.clock` and
`timeclock.manage` (everyone's hours, add, fix (closing an open one), download). Everyone sees their
own hours and clocks out (`timeclock.self`); anyone else cannot open a stretch.

## A stretch of work

Limits are `LIMITS` in `src/timeclock.ts`.

| Part | What it is |
|---|---|
| Place, person | Where and who |
| Start, end | Kept in UTC, shown on the company's clock; no end while clocked in |
| Note | `note` (500) at clock-in; one at clock-out is added below |
| Fix | Who added or fixed it, when, why (`reason` 500) |

One open stretch a person, refused by the clock-in statement and a unique index (`KIT-E-3501`);
clocking out when not in is `KIT-E-3502`. A manager types a day and two times (an end before the
start is the next day, so under 24 hours); it must have ended and not overlap the person's others
(`KIT-E-3504`). Nobody adds or fixes their own while someone else manages the place (`KIT-E-3503`);
an Owner or the Vendor may when nobody else who is on manages it (`self: true` in the audit; at most
ten possible managers checked, from compiled access).

## Pages and routes

| Path | Shows |
|---|---|
| `/timeclock` | "Clocked in" with time so far, where, since when, and **Clock out** (a note folded away), or **Clock in** (place as chips when several); chips Mine and Team for managers; the week before and after, This week; **Add hours** (addresses offered, the manager first) and **Download hours** in dialogs; the week's figures; the team's hours by person; each stretch by day, its hours, place and whether fixed |
| `/timeclock/:id` | Who, where, day, times, hours; **Fix the times** (or **Clock them out** while open) for a manager who did not work it; the note; the fix |

| Route | Needs | What it does |
|---|---|---|
| `GET /entries` (`view` `VIEWS`: mine, team; `week`) | `timeclock.self`; team needs `timeclock.manage` somewhere | The week from Monday, `listed` (500), totals by person, places, the open stretch |
| `POST /in`, `POST /out` | `timeclock.clock` at the place; `timeclock.self` | Clock in or out, with a note |
| `POST /entries` | `timeclock.manage` at the place (one's own as above) | Adds a stretch for a person who is on, with why |
| `GET /people` | `timeclock.manage` somewhere | People who are on, the reader first, `people` (200) |
| `GET /entries/:id` | `timeclock.self`, worker or manager | One, with whether the reader may fix it |
| `POST /entries/:id/fix` | `timeclock.manage` at its place (one's own as above) | Sets day and times with why, closing an open one |
| `GET /export?from=&to=` | `timeclock.manage` | Stretches started in the range where the person manages, by person, as CSV (decimal hours, formulas defused), `exportDays` (62) and `exported` (5,000), named `-first-5000` past it |

Module parts: Needs you (still in after `longHours` 12 hours where the person manages) and the
privacy answer (every stretch a person worked). Audited, refusals too: `timeclock.in`, `.out`,
`.add`, `.fix`, `.export` (days and rows); an automation can follow them.

## Table and errors

Migration `0035`: `timeclock_entries` (place, person, start, end, note, the fix), with a unique index
holding one open stretch a person.

Block `35xx`: `KIT-E-3501` clocked in already, `3502` not clocked in, `3503` not one's own while
someone else manages, `3504` the times do not work (ahead of now or overlapping). Bad input, an
unknown address or a fix without a reason is `KIT-E-0422`, no capability `KIT-E-0403`.

Not built: hours against planned [shifts](../shifts/README.md); breaks, overtime, rounding; location
at clock-in (it needs a script); a person asking for a fix.

## Tests

`test/timeclock.test.ts`, on the Mexico City clock: the manifest and a week's Monday; clock in only
where allowed, once, out once with the note; own and team weeks with totals and who is in, team
refused to non-managers, other weeks; Needs you after 12 hours; fixes with a reason by another
manager, refused without one, ahead of now or elsewhere; added hours refused when overlapping, for
oneself, for an unknown address or another place, an end before the start as next morning; the
download by place, refused without the capability or past 62 days, audited; privacy; the people
offered; an Owner's own hours with nobody else managing (`self: true`). The client template's
screens journey clocks the Owner in and out.

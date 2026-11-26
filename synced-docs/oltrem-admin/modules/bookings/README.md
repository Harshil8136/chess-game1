# @oltrem/bookings

Rooms, vehicles and equipment at the company's places, booked by the hour ("The van, all of
Friday"). A resource belongs to a place, whose roles decide who books it and who adds and removes
it. Times are typed and shown on the company's clock, kept in UTC, and never booked twice at once.

## Using it

```ts
const bookings = createBookings<Env>({ bindings: (env) => ({ db: env.DB }), config: settingsFor });
const modules = [iam.module, /* ... */ withPages(bookings.module, bookingsPages)];
```

It returns `store` and the manifest and stands on IAM, the audit log and settings. No binding,
secret or variable. Two capabilities on bit plane 21, read at the resource's place: `bookings.book`
(see, book, cancel one's own) and `bookings.manage` (add and remove resources, cancel anyone's).

| Setting | Default | What it is |
|---|---|---|
| `bookings.time_zone` | `UTC` | Company time zone, as `America/Mexico_City`: one clock a portal, also read by the time clock, shifts, send later, and today's day in invoices, quotes, expenses and time off. An Owner changes it on Settings; a booking keeps its moment, only its display moves |

## A booking

Limits are `LIMITS` in `src/bookings.ts`.

| Part | What it is |
|---|---|
| What | A resource: `name` (100), `notes` (1,000) |
| When | A day and time on the company's clock, 15 minutes to `minutes` (1,440) in steps of 15 (the pages offer `LENGTHS`, 30 minutes to 8 hours), up to `ahead` (365) days. A skipped time lands an hour later, a repeated one takes the first |
| What for, who | `title` (120); the booker, seen by anyone who may book there |

A booking is written only when no other of the resource covers its time, in the same statement
(`KIT-E-3101`). An ended one cannot be made or cancelled. Bookings are cancelled, never deleted; a
resource is removed only with nothing booked from now on (`KIT-E-3102`), its past kept.

## Pages and routes

| Path | Shows |
|---|---|
| `/bookings` | **Add something to book** in a dialog (place as chips when several); own bookings to come; resources by place; the clock |
| `/bookings/:id` | Chips Today, Tomorrow, then the week's days, and **Another day** (a date up to 365 days ahead, shown as its own chip); **Book it** (from, length as chips, what for), **Remove it** (confirmed); the day's bookings with **Cancel it** (confirmed). A refusal redraws the same day |

| Route | Needs | What it does |
|---|---|---|
| `GET /resources` | `bookings.book` | Resources by place and own bookings to come, `mine` (50) |
| `POST /resources`, `DELETE /resources/:id` | `bookings.manage` at the place | Add; remove once nothing is to come |
| `GET /resources/:id` (`day`) | `bookings.book` at its place | A day's bookings (`day` 100), the week's days, how far ahead and the last day allowed |
| `POST /bookings` | `bookings.book` at the place | Books a day, from a time, for minutes |
| `DELETE /bookings/:id` | `bookings.book`, booker or manager | Cancels one not ended |

Module parts: search (resources by name where one may book), Reports under Work (made, hours booked
and cancelled, per day, busiest), and `store.calendar(env, session, from, to)` (own bookings not
cancelled, `calendar` 200, titled `<title> (<resource>)`, for `@oltrem/connect`). Audited, refusals
too: `bookings.add`, `.remove`, `.book`, `.cancel`.

## Tables and errors

Migration `0029`: `bookings_resources` (place, name, notes, who added, removed) and `bookings_items`
(resource, what for, from and to in UTC, booker, canceller). Block `31xx`: `KIT-E-3101` already
booked, `3102` bookings to come. Bad input is `KIT-E-0422`, no capability `KIT-E-0403`.

Not built: opening hours and weekly repeats; a yes before a booking (an automation can ask); a week
or month view across resources; reminders.

## Tests

| File | Covers |
|---|---|
| `test/bookings.test.ts` | On the Mexico City clock: the manifest and setting; resources added only by managers; places and resources; ten in Mexico City kept as four in the afternoon UTC, refused over another, allowed right after, refused for a bad length or time, the past or another place, refusals audited; a day with the week, who cancels which, own bookings; cancelled once by booker or manager; a resource kept while booked, then removed with its past; search; calendar items |
| `test/pages.test.ts` | A refusal redraws its own day; a day past the week asked by date |

The client template's screens test adds a room, books it tomorrow, is refused the same time,
cancels and removes the room.

# @oltrem/bookings

Bookings: rooms, vehicles and equipment at the company's places, booked by the hour. "The meeting
room, Tuesday from ten to eleven"; "The van, all of Friday". Something to book belongs to a place,
so the roles held there decide who books it and who adds and removes it. Times are asked for and
shown on the company's clock and kept in UTC, and the same thing is never booked twice at once.

## Using it

```ts
import { createBookings } from '@oltrem/bookings';
import { pages as bookingsPages } from '@oltrem/bookings/pages';
import { withPages } from '@oltrem/core-module';

const bookings = createBookings<Env>({ bindings: (env) => ({ db: env.DB }), config: settingsFor });
const modules = [iam.module, /* ... */ withPages(bookings.module, bookingsPages)];
```

`createBookings` returns the `store` and the module manifest. It stands on the IAM module
(sessions, the authorizer), the audit log and the settings, which `config` reads. It adds no
binding, secret or variable.

## Who may do what

Two capabilities on bit plane `21`, both read at the resource's place, so a role at a place (or at
a place above it) decides:

| Capability | Lets them |
|---|---|
| `bookings.book` | see what can be booked at the place and its bookings, book it, and cancel their own bookings |
| `bookings.manage` | add and remove what can be booked at the place, and cancel anyone's booking there |

## The setting

| Key | Default | What it is |
|---|---|---|
| `bookings.time_zone` | `UTC` | the clock bookings are made and shown on, as `America/Mexico_City` (the client template's time clock reads it too, one clock a portal); the Owner changes it on the Settings page. A booking keeps its moment when it changes; only how it is shown moves |

## A booking

| Part | What it is |
|---|---|
| What | a resource at a place: a name (100 characters at most) and notes (1000) |
| When | a day and a time on the company's clock, for 15 minutes to a whole day in steps of 15; the pages offer 30 minutes to 8 hours. Kept in UTC. A time the clocks skip lands an hour later; a time they repeat takes the first |
| What for | 120 characters at most |
| Who | the person who booked it; anyone who may book at the place sees it |

Two bookings of one resource never overlap: the booking is written only when no other covers any
of its time, in the same statement, so two people asking at once cannot both get it
(`KIT-E-3101`). A booking may start up to 365 days ahead, and one that has ended cannot be made or
cancelled. A booking is never deleted, only cancelled; a resource is removed only when nothing is
booked from now on (`KIT-E-3102`), and its past bookings are kept.

## The pages

| Path | Shows |
|---|---|
| `/bookings` | "Add something to book" in a dialog where the person manages bookings, the place as a row of choices when there is more than one; their own bookings to come; what they may book, by place; the clock the times are on |
| `/bookings/:id` | a row of the week's days (Today, Tomorrow, then each day); a row with "Book it" (a dialog: from, for how long as a row of choices, what for), "All bookings" and "Remove it" (after a confirmation) where they manage; the day's bookings, each with "Cancel it" (after a confirmation) to whoever may |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /resources` | `bookings.book` | what the person may book, by place, and their own bookings to come, 50 at most |
| `POST /resources` | `bookings.manage` at the place | adds something to book |
| `GET /resources/:id` (`day`) | `bookings.book` at its place | its bookings on a day (today when left out), 100 at most, with the week's days |
| `DELETE /resources/:id` | `bookings.manage` at its place | removes it, once nothing is booked from now on |
| `POST /bookings` | `bookings.book` at the resource's place | books it on a day, from a time, for a number of minutes |
| `DELETE /bookings/:id` | `bookings.book`, and booked it or manages the place | cancels a booking that has not ended |
| `GET /search` | `bookings.book` | the portal's search: what can be booked, by name, at the places the person may book |

Every change is audited: `bookings.add`, `bookings.remove`, `bookings.book`, `bookings.cancel`,
refusals included. One that went through can set off an automation: one on `bookings.book` emails
whoever looks after the van.

## Tables

Migration `0029_bookings.sql`, additive and idempotent: `bookings_resources` (the place, the name
and notes, who added it, when it was removed) and `bookings_items` (the resource, what for, from
and to in UTC, who booked it and when, who cancelled it and when).

## Errors

The `31xx` block: `KIT-E-3101` that time is already booked, `KIT-E-3102` it has bookings to come.
A name, a time, a length or a day out of bounds is the core's `KIT-E-0422`; a person without the
capability at the place is `KIT-E-0403`.

## Not here yet

- Opening hours, and bookings that repeat every week.
- A booking that needs a yes first: an automation on `bookings.book` asks today by email.
- A week or month view across every resource of a place.
- A reminder before a booking starts.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, on the Mexico City clock:
the manifest and the setting; something added only where the person manages bookings; each
person's places and resources; a booking at ten in Mexico City kept as four in the afternoon in
UTC, refused over another, allowed right after it, and refused with a bad length or time, in the
past, at a place the person may not book, every refusal audited; a resource's day with the week's
days, who may cancel which, and the person's own bookings; cancelled by the person who booked or a
manager and by nobody else, once; a resource with a booking to come kept, then removed with its
past bookings kept; the search. The client template's screens test adds a room, books it tomorrow,
is refused the same time again, cancels the booking and removes the room.

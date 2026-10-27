# @oltrem/announcements

Announcements: notices to the people at a place. "The north office is closed on Monday"; "New
safety rule: gloves on in the store room". A notice belongs to a place, so the roles held there
decide who sees it and who posts it. It waits on each person's Home until they read it. When it
must be confirmed, each person says "I have read it", and whoever posts at the place sees who has
and when: the record a new rule or policy needs.

## Using it

```ts
import { createAnnouncements } from '@oltrem/announcements';
import { pages as announcementsPages } from '@oltrem/announcements/pages';
import { withPages } from '@oltrem/core-module';

const announcements = createAnnouncements<Env>({ bindings: (env) => ({ db: env.DB }) });
const modules = [iam.module, /* ... */ withPages(announcements.module, announcementsPages)];
```

`createAnnouncements` returns the `store` and the module manifest. It stands on the IAM module
(sessions, the authorizer) and the audit log. It adds no binding, secret or variable.

## Who may do what

Two capabilities on bit plane `20`, both read at the notice's place, so a role at a place (or at a
place above it) decides:

| Capability | Lets them |
|---|---|
| `announcements.read` | see the notices at the place, and mark them read or confirm them |
| `announcements.post` | post and remove the notices at the place, and see who has read each |

## A notice

| Part | What it is |
|---|---|
| Title | 200 characters at most |
| Place | the people who may see the notices there see it |
| What it says | 8000 characters at most, shown as written |
| Shown until | the last day, today or later, it is on Home and under Current; none, until it is removed. After it, the notice is under Past. Days are read in UTC, as every time the portal keeps |
| Must be confirmed | each person reads it with "I have read it", audited as `announcements.confirm` |

Whoever posts it has read it. Removing a notice removes who has read it too; the audit log keeps
its title and every confirmation.

## The pages

| Path | Shows |
|---|---|
| `/announcements` | a row of Current (with how many the person has not read) and Past; "Post an announcement" in a dialog where they may post, the place as a row of choices when there is more than one; the notices, newest first, each with Unread, Read, To confirm or Confirmed |
| `/announcements/:id` | the notice, its place, who posted it and until when; a row with "Mark as read" or "I have read it" while unread, "All announcements", and "Remove it" (after a confirmation) where they may post; what it says, and who has read it with when, to whoever may post |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /posts` (`view` current or past) | `announcements.read` | the notices at the places the person may see, at most 100, with when they read each and how many current ones they have not |
| `POST /posts` | `announcements.post` at the place | posts one |
| `GET /posts/:id` | `announcements.read` at its place | one notice; who has read it, to whoever may post there |
| `POST /posts/:id/read` | `announcements.read` at its place | marks it read, or confirms it, once |
| `DELETE /posts/:id` | `announcements.post` at its place | removes it with who has read it |
| `GET /todo` | `announcements.read` | Needs you: how many current notices the person has not read, and how many they must confirm |
| `GET /search` | `announcements.read` | the portal's search: notices by title at the places the person may see |

Every step is audited: `announcements.post`, `announcements.read`, `announcements.confirm`,
`announcements.remove`, refusals included. One that went through can set off an automation: an
automation on `announcements.post` emails it to a list.

## Tables

Migration `0028_announcements.sql`, additive and idempotent: `announcements_posts` (the place, the
title and text, whether it must be confirmed, the last day it is shown, who posted it and when) and
`announcements_reads` (who read which notice, and when).

## Errors

None of its own. A title, a text or a day out of bounds is the core's `KIT-E-0422`; a person
without the capability at the place is `KIT-E-0403`; a notice that is not there is `KIT-E-0404`.

## Not here yet

- An email to everyone at the place when a notice is posted: an automation on
  `announcements.post` sends one to a list today.
- How many of the people at the place have not read it yet, beside who has.
- A reminder to those who have not confirmed by a day.
- Files attached to a notice; a link in the text does it today.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; a notice
posted only where the person may post, with its title, text and last day checked, every refusal
audited; each person's list of the places they may see, newest first, the unread counted, Needs
you with what must be confirmed; read once and confirmed, with who has read it shown to whoever
posts and to nobody else; shown until its day, then past; removed with its readers, the title
kept in the log; the search. The client template's screens test posts a notice that must be
confirmed as the Owner, sees it read by them, and removes it.

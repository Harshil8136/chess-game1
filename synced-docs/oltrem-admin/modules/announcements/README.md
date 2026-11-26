# @oltrem/announcements

Notices to the people at a place ("New safety rule: gloves on in the store room"). A notice belongs
to a place, whose roles decide who sees and who posts it. It waits on each person's Home until read;
one that must be confirmed takes "I have read it", and posters see who has and when: the record a
new rule needs.

## Using it

```ts
const announcements = createAnnouncements<Env>({ bindings: (env) => ({ db: env.DB }) });
const modules = [iam.module, /* ... */ withPages(announcements.module, announcementsPages)];
```

It returns `store` and the manifest and stands on IAM and the audit log. No binding, secret or
variable. Two capabilities on bit plane 20, read at the notice's place: `announcements.read` (see,
mark read, confirm) and `announcements.post` (post, remove, see who has read).

## A notice

Limits are `LIMITS` in `src/announcements.ts`.

| Part | What it is |
|---|---|
| Title, text | `title` (200); `body` (8,000), shown as written |
| Shown until | A last day (today or later) on Home and under Current, or none until removed; then Past. Days in UTC |
| Must be confirmed | Each person's "I have read it", audited `announcements.confirm` |

The poster has read it. Removing a notice removes its reads; the audit log keeps its title and every
confirmation.

## Pages and routes

| Path | Shows |
|---|---|
| `/announcements` | Chips Current (with unread count), Past; **Post an announcement** in a dialog (place as chips when several); notices newest first, each Unread, Read, To confirm or Confirmed |
| `/announcements/:id` | Place, poster, until when; **Mark as read** or **I have read it**, **Remove it** (confirmed); the text; who has read it and when, for posters |

| Route | Needs | What it does |
|---|---|---|
| `GET /posts` (`view` current or past) | `announcements.read` | `listed` (100) from `scanned` (500), with when each was read and the unread count |
| `POST /posts` | `announcements.post` at the place | Posts one |
| `GET /posts/:id` | `announcements.read` at its place | One; its `readers` (500) for posters |
| `POST /posts/:id/read` | `announcements.read` at its place | Marks read or confirms, once |
| `DELETE /posts/:id` | `announcements.post` at its place | Removes it with its reads |

Module parts: Needs you (unread, and to confirm) and search (titles where visible). For automations,
`store.make(env, tenantId, { title, body, mustConfirm?, shownForDays?, key })` posts at the company
once per `key` (the id comes from the key), by `system`, shown as posted by an automation; the
`announceAction` passes the run's key. Audited, refusals too: `announcements.post`, `.read`,
`.confirm`, `.remove`.

## Tables and errors

Migration `0028`: `announcements_posts` (place, title, text, must confirm, last day, poster) and
`announcements_reads` (who read which, when). No errors of its own: bad input is `KIT-E-0422`, no
capability `KIT-E-0403`, not there `KIT-E-0404`.

Not built: an email to the place on posting (an automation does it); an automation's notice at a
place other than the company; how many have not read; reminders to confirm; files (a link does it).

## Tests

`test/announcements.test.ts`: the manifest; posted only where allowed, title, text and day checked,
refusals audited; each person's notices newest first with unread counted, Needs you with what to
confirm; read once and confirmed, readers shown to posters only; shown until its day, then past;
removed with its reads, the title kept in the log; search. The client template's screens test posts
one that must be confirmed, sees it read, and removes it.

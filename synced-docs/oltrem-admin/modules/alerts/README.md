# @oltrem/alerts

Platform alerts: a problem the portal finds, raised once by its key and emailed to the people the
settings name. Raised again while open, it counts up and is not emailed again. In the quiet hours a
warning is held and sent with the others when they end; a critical one goes at once. The check or
code that raised it resolves it; a manager may resolve any open one by hand (a check still failing
opens it again on its next run, emailed unless muted).

## Using it

```ts
const alerts = createAlerts<Env>({
  db: (env) => env.DB,
  config: settingsFor,
  send: async (env, message) => {
    /* hand { to, subject, text, key } to email; a throw keeps the alert for the next try */
  },
});
await alerts.raise(env, { key: 'health.backup.fresh', source: 'backup', severity: 'warning', title: 'No fresh backup' });
await alerts.resolve(env, 'health.backup.fresh');
```

Mount `alerts.module` beside IAM; it does not depend on email. The client template sends through
`@oltrem/email` with the plain `alerts.notice` template, and raises a warning for each System health
problem (a check failed twice in a row), resolved when it passes. Every email opens "Hello,", names
each alert with severity, detail and when it opened, and ends with the Alerts page's address
(`address`, else `https://` and `PUBLIC_HOST`, else none) and `@oltrem/iam`'s `mainInbox` line.

## Server errors

`alerts.reportError(env, { error, area, ref })` keeps a server error as a warning, so none is lost
to Workers Logs' sampling; it never throws (a failure goes to the module's `report`, and the next
occurrence writes both).

| Part | What it does |
|---|---|
| Key | `error.<area>.<fingerprint>`: name and message without numbers, long ids (a word of 8 characters or more with a digit) and quoted values, hashed to 7 characters, so one failure counts up on one alert. An id inside the area moves to the reference |
| Title | Plain words for Needs you: a kit error's definition title, else "An unexpected error", then the area in brackets (a module by name, `request` as "a page or a call", a job, flow or queue by kind) |
| Detail | The message with its code, a kit error's action as "What to do", the reference, last seen, 15 lines of stack (`DETAIL_MAX` 2,000) |
| Pace | One write a key a minute per isolate (`ERROR_WRITE_EVERY_MS`, at most `ERROR_KEYS_MAX` 200 keys remembered), the occurrences between added to the next |
| Ending | The release job resolves one not seen for a day (`ERROR_QUIET_MS`); `resolveErrors(env, area)` closes every open error of exactly that area at once |

The client template's `report`, which every module and the pipeline call, prints the error and
hands it to `reportError` under `waitUntil`.

## The email and the job

| `notified` | Means |
|---|---|
| `sent` | Handed to email, which sends it or holds it until a provider is ready |
| `held` | A warning in the quiet hours, sent by the job when they end (never, if resolved first) |
| `failed` | Email refused it; the job tries again |
| `none` | Nobody in `alerts.recipients`: only listed |

`alerts.release` runs every 5 minutes while an alert waits, sending every open held or failed one as
one message out of quiet hours; it sleeps otherwise (`'idle'`, 6 h), woken in the same write that
leaves one waiting (`wakeJobsStatement`). It deletes resolved alerts after 90 days
(`KEEP_RESOLVED_MS`). Waiting and resolved alerts are read through partial indexes.

## The Alerts page

`packages/screens/src/alerts.tsx`: one row per alert under its day, in the viewer's zone ("Nov 26,
12:18 AM EST"; UTC only in the technical details), with a severity edge, title, times seen, the
section in its sidebar colour, who is on it and its email.

| Part | What it does |
|---|---|
| Chips | View (Open, Unassigned, Assigned to me, Critical, Resolved, Everything) and kind (Checks, Errors, Account access); a search over title, detail, section, key, assignee and note |
| A row opened | Observed activity, Recommended response (for account access, what to do if it was them or not, linking Users and sign-in history), the facts in one band (not repeating the head), technical details folded (fingerprint with Copy, id, source, UTC times), an internal note (Add note, Remove note) |
| Actions (`alerts.manage`) | Assign to me or Unassign; Resolve incident, which asks why (`RESOLUTIONS`: Legitimate activity verified, Unauthorized activity contained, False positive, Duplicate, Problem fixed, Other with 200 characters), kept as `resolution`; Mute emails for 1, 7 or 30 days or Unmute; Copy alert details |
| Ticked rows | A bar with the count and Clear selection: assign, resolve (Other for one alert only) or delete together |
| Delete (`alerts.delete`) | A resolved alert, through the kit's confirm dialog |
| The row above | Recipients, quiet hours, kept time and zone, **Edit notification settings** (recipients only for managers) |

A mute belongs to the key: a new alert under it while muted is listed, not emailed, and a waiting
one is dropped; Unmute ends it for every alert under the key.

## Settings and routes

System settings an Owner changes on Settings, at once:

| Key | Default | What it holds |
|---|---|---|
| `alerts.recipients` | empty | Addresses, comma separated; while empty `oltrem deploy` writes the Vendor's (and a real Owner's from `oltrem.config.ts`), never changing a written list |
| `alerts.quiet_hours` | empty | `22-07`, may pass midnight; empty or the same hour twice is none |
| `alerts.time_zone` | `UTC` | The zone quiet hours are read in; an unknown one is refused |

Under `/api/alerts`; capabilities on bit plane 8: `alerts.read`, `alerts.manage`, `alerts.delete`
(every Owner role has it; any role can).

| Route | Needs | What it does |
|---|---|---|
| `GET /items` | `alerts.read` | Open alerts last seen first and the latest resolved (`limit` `RECENT` 30, at most 100; `before` pages; `more`), with `manage` and `remove`; `emailing` for managers |
| `POST /items/:id/acknowledge`, `/release` | `alerts.manage` | Take an open, untaken alert, or let one go; else 404 |
| `POST /items/:id/resolve` | `alerts.manage` | Resolve any open alert (`reason`, words), keeping `resolvedBy` (and as taker when nobody was) |
| `POST /items/:id/note` | `alerts.manage` | `{ note }`, `NOTE_MAX` 500, with who and when; empty clears |
| `POST /items/:id/mute` | `alerts.manage` | `{ days }` 1, 7, 30; 0 unmutes the key |
| `POST /items/:id/delete` | `alerts.delete` | A resolved alert for good; an open one is 404 |
| `POST /bulk` | `alerts.manage` | `{ action, ids }`: `acknowledge`, `resolve` or `delete` (resolved, `alerts.delete`), `BULK_MAX` 100; one audit entry; answers `done` |

Each is audited (`alerts.acknowledge`, `.release`, `.resolve`, `.note`, `.mute`, `.delete`). Module
parts: Home's card (open, critical), Needs you, and Get started (done once someone is named).
Needs you (`alerts.manage`) lists each untaken alert, critical first, at most `TODO_ALERTS` (5),
with its "What to do:" line and one press: its `fix` (an API route), else Assign to me.

## The table

| Migration | Adds to `oltrem_alerts` |
|---|---|
| `0015` | One row an alert: key, source, severity, title, detail, state, `notified`, count, opened, last raised, emailed, acknowledged, resolved; a unique index keeps one open row per key, so a raise counts up in one statement |
| `0060` | A partial index of waiting alerts |
| `0064` | An index of resolved alerts, newest first |
| `0096` | `resolved_by`, `note`, `note_by`, `note_at`, `muted_until`, an index on key and mute |
| `0098` | `resolution` |
| `0104` | `fix`: the one press offered on Needs you, as JSON |

Not built: routes other than email; an alert emailed again while it stays open; snoozing.

## Tests

`test/alerts.test.ts`: quiet hours within a day or past midnight; the manifest; nobody named; raised
once, counted, resolved by key; held and critical in quiet hours, released after; refused emails
retried and held ones sent together; bad settings refused; the routes and acknowledge, audited;
Get started; error fingerprints, a lost write counted next time, one write a minute; errors resolved
after a day or by area while a check's stays; a kit error's title; resolve by hand (a check's, a
person's report); release, note, mute, delete, bulk; paging, `emailing`, the 90-day delete; the
email's links; `reportError` never throwing.

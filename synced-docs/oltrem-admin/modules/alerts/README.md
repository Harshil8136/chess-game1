# @oltrem/alerts

Platform alerts (plan 4.4): a problem the portal finds, raised once by its key and emailed to the
people the settings name. A problem raised again while it is open counts up and is not emailed
again. In the quiet hours a warning is held and sent with the others in one message when they
end; a critical alert is sent at once. People see the open alerts and the recent ones on the
Alerts page and say they are on one by acknowledging it; the check or the code that raised it
resolves it.

## Using it

```ts
import { createAlerts } from '@oltrem/alerts';

const alerts = createAlerts<Env>({
  db: (env) => env.DB,
  config: settingsFor, // the settings reader, ensured
  send: async (env, message) => {
    /* hand { to, subject, text, key } to email; a throw keeps the alert for the next try */
  },
});
await alerts.raise(env, { key: 'health.backup.fresh', source: 'backup', severity: 'warning', title: 'No fresh backup' });
await alerts.resolve(env, 'health.backup.fresh');
```

Mount `alerts.module` beside the IAM module. The module does not depend on email: the client
hands in `send`. The client template sends through `@oltrem/email` with one plain template,
`alerts.notice`, as the company the first-run form made, and raises a warning for each System
health problem when it opens (a check failed twice in a row), resolved when the check passes.

## Server errors

`alerts.reportError(env, { error, area, ref })` keeps a server error as a warning, so none is
lost to Workers Logs' sampling. Its key is `error.<area>.<fingerprint>`: the fingerprint is the
error's name and message with numbers, long ids and quoted values taken out, hashed to seven
characters, so the same failure counts up on one alert. A word of eight characters or more with a
digit in it counts as an id, such as the runtime's `reference = …` on a network error: before
2026-11-12 each one opened a new alert, and an alert's own email failing the same way opened
another, without end. An id inside the area (a queue message's)
moves to the reference. The detail keeps the message, the reference, when it was last seen and
the first fifteen lines of the stack. One isolate writes a key at most once a minute and adds the
occurrences between to the next write, so a failing loop cannot spend the day's D1 writes. It
never throws: a failure to keep the error goes to the module's own `report`.

The client template's `report`, which every module and the request pipeline call, prints the
error with its stack and hands it to `reportError` under `waitUntil` from `cloudflare:workers`.
Errors are emailed like any warning (once, then counted) and listed on the Alerts page. No check
passes to close an error, so the release job resolves one not seen again for a day (2026-11-12:
a live portal had kept 274 open for a week after its email service's key was fixed); seen again,
it opens anew.

## What becomes of the email

`notified` on each alert says it:

| Value | Means |
|---|---|
| `sent` | handed to email, which sends it, or holds it while no provider is ready |
| `held` | a warning raised in the quiet hours: sent by the job once they end |
| `failed` | email refused it (no sending address, no company yet): the job tries again every five minutes |
| `none` | nobody is named in `alerts.recipients`: it is only listed |

The job `alerts.release` runs every five minutes on the tick while an alert waits: out of the
quiet hours it sends every open alert that is held or failed as one message. A held alert that is
resolved before the quiet hours end is never sent. While none waits the job sleeps (it answers
`'idle'` and looks again every six hours): an alert left held or failed when it is raised wakes
it in the same write (`wakeJobsStatement` of `@oltrem/core-module`). The waiting alerts are found
through a partial index (migration `0060`), so the job reads the waiting rows only, where it read
every alert ever raised on each run. System status's last resolved alerts are read the same way
(migration `0064`, 2026-11-13), newest first from an index of the resolved ones.

## Settings

All three are system settings an Owner changes on the Settings page; each takes effect at once.

| Key | Default | What it holds |
|---|---|---|
| `alerts.recipients` | empty | the addresses alerts are emailed to, separated by commas; while it is empty, `oltrem deploy` writes the Vendor's address (and the client's Owner from `oltrem.config.ts` when it is a real one), so someone is told; it never changes a list someone wrote |
| `alerts.quiet_hours` | empty | from one hour to another, as `22-07`; it may run past midnight; empty, or the same hour twice, is no quiet hours |
| `alerts.time_zone` | `UTC` | the time zone the quiet hours are read in, as `America/Mexico_City`; one the runtime does not know is refused |

## Routes

Under `/api/alerts`, through the IAM module's sessions and check. Capabilities are on bit plane 8.

| Route | Capability | What it does |
|---|---|---|
| `GET /items` | `alerts.read` | the open alerts, newest first, and the thirty latest resolved ones |
| `GET /home` | `alerts.read` | the Home card: how many are open, and how many of those are critical |
| `GET /todo` | `alerts.manage` | Home's Needs you: how many open alerts nobody has acknowledged, and the worst of them |
| `POST /items/:id/acknowledge` | `alerts.manage` | keeps the caller's address and the time on an open alert not yet acknowledged; audited as `alerts.acknowledge`; another alert is 404 |

## The table

`oltrem_alerts` (migration `0015`): one row per alert, with its key, source, severity, title,
detail, state, what became of its email, how many times it was raised, and the times it opened,
was last raised, emailed, acknowledged and resolved. At most one row per key is open, held by a
unique index, so a raise that finds one counts it up in the same statement.

## Not here yet

- Alerts by other routes than email (SMS, chat) come with those providers.
- An alert is not emailed again while it stays open, however long.
- Snoozing, and alerts that repeat on a schedule while open.

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

## What becomes of the email

`notified` on each alert says it:

| Value | Means |
|---|---|
| `sent` | handed to email, which sends it, or holds it while no provider is ready |
| `held` | a warning raised in the quiet hours: sent by the job once they end |
| `failed` | email refused it (no sending address, no company yet): the job tries again every five minutes |
| `none` | nobody is named in `alerts.recipients`: it is only listed |

The job `alerts.release` runs every five minutes on the tick: out of the quiet hours it sends
every open alert that is held or failed as one message. A held alert that is resolved before the
quiet hours end is never sent.

## Settings

All three are system settings an Owner changes on the Settings page; each takes effect at once.

| Key | Default | What it holds |
|---|---|---|
| `alerts.recipients` | empty | the addresses alerts are emailed to, separated by commas |
| `alerts.quiet_hours` | empty | from one hour to another, as `22-07`; it may run past midnight; empty, or the same hour twice, is no quiet hours |
| `alerts.time_zone` | `UTC` | the time zone the quiet hours are read in, as `America/Mexico_City`; one the runtime does not know is refused |

## Routes

Under `/api/alerts`, through the IAM module's sessions and check. Capabilities are on bit plane 8.

| Route | Capability | What it does |
|---|---|---|
| `GET /items` | `alerts.read` | the open alerts, newest first, and the thirty latest resolved ones |
| `GET /home` | `alerts.read` | the Home card: how many are open, and how many of those are critical |
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

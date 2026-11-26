# @oltrem/automations

The portal does something on its own, when something happens or on a schedule: "when a website form
is answered, email the sales team"; "every Monday at 08:00, post the week's safety check". One
trigger and one action each, switched on only once the action has what it needs; every time it acts
is a run in its log.

## Using it

```ts
const automations = createAutomations<Env>({
  bindings: (env) => ({ db: env.DB }),
  actions: [
    emailAction(email, ALERT_NOTICE.id), // a template with a subject and a text
    alertAction(alerts),
    taskAction(tasks.store),
    announceAction(announcements.store),
    // a client's own: defineAction({ id, title, summary, fields, check?, run })
  ],
  timeZone: async (env) => 'America/Mexico_City', // the company's clock (UTC when left out)
});
const modules = [iam.module, /* ... */ withPages(automations.module, automationsPages)];
```

It returns `store` and the manifest, stands on IAM and the audit log, and reaches email, alerts,
tasks and announcements only through the actions handed in (a portal without one offers the
others). No binding, secret or variable. Two capabilities on bit plane 15, read at the company:
`automations.read` and `automations.manage` (make, change, run, switch, delete; a fresh sign-in).

## An automation

Limits are `LIMITS` in `src/automations.ts`.

| Part | What it is |
|---|---|
| When something happens | Audited actions that went through: chips by plain names (a form answered, a file shared, anything in Files, a task made, a yes asked for, approved or declined, something booked, any change), others under "Other events" (`customers.add`, `<part>.*`); `events` (20). The API takes `forms.answer`, `files.*`, `*`. One optional condition: a value (`name`, `target`, `actor`, or a detail such as `form`) equals a text, any case |
| On a schedule | Every hour at a minute, every day, or one weekday at a time, on the company's clock (named on the form and page). A skipped time runs an hour later, a repeated one the first time; a run starts within five minutes, and a time missed while down runs once |
| Then | One action with its values; text may name the event: `{{target}}`, `{{actor}}`, `{{at}}`, `{{type}}`, `{{automation}}`, `{{details.<name>}}` or `{{<name>}}` |
| Switched on | Only with the action's required fields valid (`KIT-E-2702` names what is missing); made off unless `on`, which the dialog ticks by default. Switching on restarts the failure count and the schedule from then |
| Run now | An event automation on the newest matching row of the last 300, or a stand-in `automations.test`; a schedule as if due, its next time kept |

| Action | Fields | What it does |
|---|---|---|
| `email` | To (up to 20), Subject, Message | One email per address under the run's key (`<key>.<n>` from the second), so never sent twice |
| `alert` | Title, How serious, Detail | Under `automations.<automation>`, so a second run while open counts on it |
| `task` | What, Given to, Due in days (0–365), Notes | At the company, to someone who may see tasks there, told by email; once per run |
| `announce` | Title, What it says, Each person confirms, Shown for days (1–365) | At the company, on Home; the run's key its id. On a schedule, a reminder that comes back |

`defineAction` fields are `text`, `textarea`, `emails` or `choice` (with options); `run` gets the
env, company, automation, event, filled values and a run key, returns the run's note, and throws to
fail.

## How it runs

`automations.run` (`RUN_JOB`), every 5 minutes while one is on:

1. Reads `readPerTick` (100) audit rows from `oltrem_meta` `automations.seq`; the first run starts
   from that moment. Refused or failed rows and the module's own set nothing off.
2. Runs each matching automation that is on, `runsPerTick` (20) a tick; a row that does not fit
   waits whole for the next tick.
3. Runs due schedules within the same 20, writing the next time first so a failing one is not
   retried every tick.

With none on, it moves its place to the log's end in one write and sleeps (`'idle'`, 1 h);
switching one on or changing one that is on wakes it in the same batch. `perHour` (60) runs an
automation; past that a run is skipped and says why. Each run is a row of `automations_runs`,
counted on the automation, and the system's `automations.run` in the audit log.
`automations.prune` removes runs past `keptDays` (30).

## Pages and routes

| Path | Shows |
|---|---|
| `/automations` | Chips All, On, Off, Failing; the automations with state, trigger in words, action, last run; a command per action, each a dialog (name, **When something happens** with event chips or **On a schedule**, the action's fields, **Switch it on now**), landing on the new one |
| `/automations/:id` | State and trigger in words; what is missing; **Run now** (held while something is), **Switch on** or off, **Delete**; the form; the newest `listed` (50) runs |

| Route | Needs | What it does |
|---|---|---|
| `GET /actions`, `GET /automations`, `GET /automations/:id` | `automations.read` | The actions and fields; the automations; one with what it needs and its runs; each with `timeZone` |
| `POST /automations` (`name`, `trigger`, `events` or `schedule`, `condition`, `action`, `input`, `on`), `PATCH /automations/:id`, `DELETE /automations/:id`, `POST /automations/:id/run` | `automations.manage` | Make, change, delete, run now |

Module parts: search (by name, at the company) and Reports' Services section (runs through, failed,
skipped, each automation). Audited: `automations.create`, `.update` (fields changed, never values),
`.delete`, `.run-now`, and the system's `automations.run`. Health: `automations.runs` (lane `jobs`)
warns for each automation on whose last run failed, with how many in a row.

## Tables and errors

Migration `0023`: `automations` (name, on, events and condition or schedule and next time, action
and values, counts, last run) and `automations_runs` (what set it off, state, note, time taken, by
hand, when).

Block `2700`–`2799`: `KIT-E-2701` an action the portal does not have, `2702` not ready to switch
on, `2703` the company has `max` (50).

Not built: chains of steps (they belong in the one Workflow); actions on the company's own data
(they wait for functions callable without a person's session).

## Tests

| File | Covers |
|---|---|
| `test/automations.test.ts` | The manifest; schedules (next hour, day, weekday, in words, bad ones refused) on the clocks of Mexico City and India and across summer time; event values filled in, missing fields named; capabilities at the company; unknown actions and bad events refused; switched on only when ready; new matching rows acted on, not the past, refusals, its own rows or a differing condition; 20 a tick with whole rows; the hourly cap; schedules run and moved on, by hand kept; failures and the check; an alert with event values; run now; the audit; pruning |
| `test/pages.test.ts` | A dialog per action, events by name, what it sends and the notice; one automation in words, Run now held |

The client template's screens test makes an automation from the pages and runs it on the forms
journey's website answer.

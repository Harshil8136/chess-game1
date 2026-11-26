# @oltrem/automations

Automations: the portal does something on its own, when something happens or on a schedule. "When a
website form is answered, email the sales team"; "when a file is shared, raise an alert"; "every
Monday at 08:00, send the team a reminder". Each automation is one trigger and one action, switched
on as it is made or later, only once its action has what it needs, and every time it acts is a run
in its log.

## Using it

```ts
import {
  alertAction,
  announceAction,
  createAutomations,
  defineAction,
  emailAction,
  taskAction,
} from '@oltrem/automations';
import { pages as automationsPages } from '@oltrem/automations/pages';
import { withPages } from '@oltrem/core-module';

const automations = createAutomations<Env>({
  bindings: (env) => ({ db: env.DB }),
  actions: [
    emailAction(email, ALERT_NOTICE.id), // a template with a subject and a text
    alertAction(alerts),
    taskAction(tasks.store),
    announceAction(announcements.store),
    // a client's own: defineAction({ id, title, summary, fields, run })
  ],
  timeZone: async (env) => 'America/Mexico_City', // the company's clock (optional: UTC)
});
const modules = [iam.module, /* ... */ withPages(automations.module, automationsPages)];
```

`createAutomations` returns the `store` (every function the routes and the job call) and the
module manifest. It stands on the IAM module (sessions, the authorizer, the audit wrapper) and the
audit log; it reaches the email, alerts, tasks and announcements modules only through the actions the client
hands in, so a portal without one of them simply offers the others. It adds no binding, secret or
variable.

## Who may do what

Two capabilities on bit plane `15`: `automations.read` sees the automations and their runs;
`automations.manage` makes, changes, runs, switches and deletes them, and asks for a fresh
sign-in. Both are read at the company itself: an automation acts on what happens at every place.

## An automation

| Part | What it is |
|---|---|
| When something happens | Audited actions that went through. The pages offer the common ones as chips by plain names (a website form is answered, a file is shared, anything in Files, a task is made, someone asks for a yes, a request is approved or declined, something is booked, any change at all), and any other by its name under "Other events", separated by spaces: `customers.add`, or `<part>.*` for anything in a part. The API takes the names: `forms.answer`, `files.*`, `*`. The Developer page's API reference and the audit page name them. One optional condition: a value of the event (`name`, `target`, `actor`, or a detail such as `form`) equals a text, without regard to case. |
| On a schedule | Every hour at a minute, every day at a time, or one day of the week at a time, on the company's clock: the time zone the client hands in (`timeZone`; the kit's client template gives the company's, `bookings.time_zone`, where it was UTC). The form names the zone on its time field ("At (America/Mexico_City)") and the page says it after the time; a time the clocks skip runs an hour later, one they repeat runs the first time. A schedule made before keeps its hour and minute, now read on that clock from its next run. The tick runs every five minutes, so a run starts within five minutes of its time; a time missed while the portal was down runs once on the next tick. |
| Then | One action, with the values of its form. A text value may name the event: `{{target}}`, `{{actor}}`, `{{at}}`, `{{type}}`, `{{automation}}`, `{{details.<name>}}` (or `{{<name>}}` for a detail). A schedule's event has the automation's name as its detail. |
| Switched on | Only when the action's required fields are filled in and valid (`KIT-E-2702` names what is not). It is made switched off unless it is asked to be on (`on`), which is refused the same way while a value is missing; the page's dialog ticks "Switch it on now" by default. Switching it back on starts its count of failures again and works out a schedule's next time from then. |
| Run now | Runs it at once: an event automation on the newest audited action it matches among the last three hundred, or a stand-in `automations.test` event; a schedule as if its time had come, its next time kept. |

## The actions the kit ships

| Action | Fields | What it does |
|---|---|---|
| `email`, Send an email | To (up to twenty addresses), Subject, Message (plain text) | through the email module, one email per address so nobody sees who else it went to, under the run's key (`<key>.<n>` for the second address on), so a run never sends twice; the email module's failover and delivery reports apply |
| `alert`, Raise an alert | Title, How serious (warning or critical), Detail | through the alerts module, under the key `automations.<automation>`, so a second run while it is open counts on the same alert; emailed to the alerts' recipients as any alert is |
| `task`, Make a task | What is to be done, Given to (one address), Due in days (0 to 365), Notes | through the tasks module, at the company itself, given to someone who may see the tasks there and told by email; once per run, under the run's key |
| `announce`, Post an announcement | Title, What it says, Each person confirms (no, or yes with "I have read it"), Shown for days (1 to 365) | through the announcements module, at the company itself, so everyone who may see the company's announcements finds it on Home; once per run, the run's key its id. On a schedule, it is a reminder that comes back: every Monday, the week's safety check |

A client adds its own with `defineAction({ id, title, summary, fields, check?, run })`: the fields
are `text`, `textarea`, `emails` or `choice` (with options), and `run` gets the env, the company,
the automation, the event, the values with the event filled in, and a key unique to the run.
What `run` returns is the run's note; a throw is a failed run.

## How it runs

While no automation is on the job sleeps: it reads no audit row, moves its place to the end of the
log in one write, answers `'idle'` and looks again every hour. Switching an automation on, or
changing one that is on, wakes it in the same batch; when it is the only one on, the place moves to
the end of the log first, so what was audited while nothing was on sets nothing off, and what is
audited from then on does.

The job `automations.run`, every five minutes while one is on:

1. Reads the audit rows written since its last run, a hundred at most, from where it stopped
   (`oltrem_meta` key `automations.seq`); its first run starts from that moment, so the past sets
   nothing off. A row that was refused or failed, and a row written by this module, sets nothing
   off, so an automation cannot set itself off. An automation acts only on what was audited after
   it was made.
2. Runs each automation that is on and matches the row. Twenty runs a tick at most; a row whose
   automations do not fit in what is left waits whole for the next tick, so no row is half done.
3. Runs the schedules whose time has come, within the same twenty; the next time is written
   before the run, so a failing one is not tried again on every tick.

An automation runs sixty times an hour at most; a run past that is recorded as skipped and says
why. Every run is a row of `automations_runs`, counted on the automation (runs, failures in a row,
last run and its state), and the system's `automations.run` in the audit log with the action, the
state and what set it off. The job `automations.prune` removes runs older than thirty days.

## The pages

| Path | Shows |
|---|---|
| `/automations` | a row of All, On, Off and Failing; the automations with their state, when (in words), then and last run; for a manager a command for each action (**Send an email**, **Raise an alert**, ...), each a dialog with a name, when it runs (**When something happens**, with the events as chips, or **On a schedule**), the action's own fields and **Switch it on now**; it lands on the new automation with a done notice |
| `/automations/:id` | titled by its name; the state and the trigger in words; what is missing before it can be switched on; **Run now** (held while something is missing), **Switch on** or **off**, **Delete**; the form of its name, trigger, condition and the action's own fields; the newest fifty runs, what set each off in words |

## Search

The portal's search (`GET /api/automations/search?q=`, `automations.read`) finds automations by
name, for someone who holds the capability at the company; anyone else finds none.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /actions`, `GET /automations`, `GET /automations/:id` | `automations.read` | the actions with their fields; the automations; one with what it still needs and its runs; both with `timeZone`, the clock schedules are read on |
| `GET /report?days=&to=` | `automations.read` at the company | the section on Reports' Services tab: runs that went through, failed and were skipped, each automation; past the 30 days kept it says so instead |
| `POST /automations` (`name`, `trigger`, `events` or `schedule`, `condition`, `action`, `input`, `on`), `PATCH /automations/:id` (those and `on`), `DELETE /automations/:id`, `POST /automations/:id/run` | `automations.manage` | the automations |

Every change is audited by the module: `automations.create`, `.update` (the fields changed, never
the values), `.delete`, `.run-now`; and the system's `automations.run`.

## Health

`automations.runs`, in the `jobs` lane, **warns** naming each automation that is on and whose last
run failed, with how many in a row.

## Tables

Migration `0023_automations.sql`, additive and idempotent: `automations` (its name, on or off, the
trigger's events and condition or its schedule and next time, the action and its values, the
counts and last run, who and when) and `automations_runs` (one per run: the audit row or event that
set it off, its state, note, time taken, whether by hand, when).

## Errors

The module owns the `2700` to `2799` block: `KIT-E-2701` an action the portal does not have,
`KIT-E-2702` not ready to switch on (the detail names what), `KIT-E-2703` the company has fifty
automations.

## Not here yet

- One action an automation; a chain of steps (do this, wait, do that) belongs in the one Workflow
  and comes later.
- Actions on the company's own data (add a record, move a form answer) wait for those modules to
  offer a function an action can call without a person's session.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with the email and alerts
modules stood in for: the manifest; schedules (the next hour, day and weekday, in words, bad ones
refused), on the company's clock in Mexico City, India and across a change to summer time, made through the route and named on the form; the event's values filled in and an action's missing fields named; both capabilities
read at the company; an unknown action and bad events refused; made off and switched on only when
ready, or made on at once only when ready; the tick acting on new matching rows and not on the past, a refusal, its own rows or a
condition that differs; twenty runs a tick with a row taken whole; the hourly cap; a schedule run
when due and moved on, a run by hand keeping it, failures counted and the check; an alert raised
with the event's values; a run by hand on the newest matching row; changes checked; the audit;
pruning. The pages, against answers of the API (`test/pages.test.ts`): a dialog for each action
with its fields, the events by name and the tick; what it sends and the done notice; one automation
titled by its name, its events and runs in words, Run now held. The client template's screens test makes an automation from the pages, fills in its
email, switches it on and runs it on the forms journey's website answer.

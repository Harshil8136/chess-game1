# @oltrem/tasks

Tasks: work given to people at the company's places. "Count the stock at North by Friday, Mo";
"Call back about the quote, Sue". A task belongs to a place, so the roles held there decide who
sees it and who makes, gives and changes it. The person it is given to sees it first on the Tasks
page and on Home, is told by email, and marks it done. An automation can make one too: when a
website form is answered, a task to call back.

## Using it

```ts
import { createTasks } from '@oltrem/tasks';
import { pages as tasksPages } from '@oltrem/tasks/pages';
import { taskAction } from '@oltrem/automations';
import { withPages } from '@oltrem/core-module';

const tasks = createTasks<Env>({
  bindings: (env) => ({ db: env.DB }),
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: TASK_MESSAGE.id, // a template with a subject and a text
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(tasks.module, tasksPages)];
// and, for automations: actions: [ /* ... */ taskAction(tasks.store)]
```

`createTasks` returns the `store` and the module manifest. It stands on the IAM module (sessions,
the authorizer, the access of the person a task is given to) and the audit log. `send` is
optional: without it nobody is emailed. It adds no binding, secret or variable.

## Who may do what

Two capabilities on bit plane `18`, both read at the task's place, so a role at a place (or at a
place above it) decides:

| Capability | Lets them |
|---|---|
| `tasks.read` | see the tasks at the place; mark done, or open again, a task given to them |
| `tasks.manage` | make, give, change, mark done and remove the tasks at the place |

A task is given only to someone whose account is on and who holds `tasks.read` at its place,
checked against their access as it is at that moment (`KIT-E-2901` otherwise). Someone who can
see a task but neither manages it nor has it given to them cannot mark it done.

## A task

| Part | What it is |
|---|---|
| What is to be done | a title, 200 characters at most |
| Place | where it belongs; fixed once made |
| Given to | one person, or nobody yet |
| Due on | a day, or none. "Past due" and "Due today" are read in UTC, as every time the portal keeps |
| Notes | 4000 characters at most |
| Done | by whom and when; it can be opened again |

When a task is given to someone by another person, or by an automation, they get one email: who
gave it, the place, the due day and its link. Giving a task to oneself sends nothing.

## The pages

| Path | Shows |
|---|---|
| `/tasks` | a row of Mine (the person's own open tasks at every place, with the count), Open and Done; for Open and Done, a row of the places they may see with their open counts; "New task" in a dialog where they manage the tasks; the tasks, open ones by due day |
| `/tasks/:id` | the task, its state and place; a row with "Mark done" or "Open it again", "Change it", "All tasks" and "Remove it" (after a confirmation), each shown only to whoever may; its notes and history |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /tasks` (`view` mine, open or done; `place`) | `tasks.read` | the list, at most 100, with the places and their open counts |
| `POST /tasks` | `tasks.manage` at the place | makes a task |
| `GET /people` | `tasks.manage` somewhere | the people with an account that is on, 200 at most, for the form |
| `GET /tasks/:id` | `tasks.read` at its place | one task, with what the person may do to it |
| `PATCH /tasks/:id` | `tasks.manage` at its place | changes its title, notes, due day or the person it is given to |
| `POST /tasks/:id/done` | `tasks.read`, and manages it or has it given to them | marks it done, or open again |
| `DELETE /tasks/:id` | `tasks.manage` at its place | removes it; the audit log keeps its title |
| `GET /todo` | `tasks.read` | Needs you: how many open tasks are the person's, how many past due or due today |
| `GET /search` | `tasks.read` | the portal's search: tasks by title at the places the person may see |

Every change is audited: `tasks.create`, `tasks.update`, `tasks.done`, `tasks.reopen`,
`tasks.remove`, refusals included. One that went through can set off an automation.

## For automations

`store.make(env, tenantId, { title, notes?, assignee?, dueInDays?, key })` makes a task at the
company itself, once per `key`: a second call with the same key answers the first task. The
automations module's `taskAction` calls it with the run's key, so a run that is retried makes one
task.

## Table

Migration `0026_tasks.sql`, additive and idempotent: `tasks_items` (the place, the title and notes,
the person it is given to, the due day, the state, who made it and did it, and the automation
run's key).

## Errors

The `29xx` block: `KIT-E-2901` the task cannot be given to that person. A title or a day out of
bounds is the core's `KIT-E-0422`; a person without the capability at the place is `KIT-E-0403`.

## Not here yet

- Comments on a task, and files attached to it.
- Repeating tasks: an automation on a schedule with the task action does it today.
- A board view by state.
- A task given to a group.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; a task made
only by whoever manages the place, never given to someone who may not see it there or who has no
account, the email to the person it is given to and none to oneself, every refusal audited; each
person's places and their own list, Needs you; done by the person it is given to or a manager and
by nobody else; changed, given to another (who is told) and to nobody, removed with its title kept
in the log; the automations' task made once per key; the search. The automations tests cover the
task action's fields. The client template's screens test makes a task for today, sees it on Home,
marks it done, opens it again, changes it and removes it.

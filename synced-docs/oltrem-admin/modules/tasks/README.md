# @oltrem/tasks

Work given to people at the company's places ("Count the stock at North by Friday, Mo"). A task
belongs to a place, whose roles decide who sees it and who makes, gives and changes it. The person
it is given to sees it first on Tasks and Home, is emailed, and marks it done; the people on it talk
in its comments. An automation can make one too.

## Using it

```ts
const tasks = createTasks<Env>({
  bindings: (env) => ({ db: env.DB }),
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: TASK_MESSAGE.id,
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(tasks.module, tasksPages)];
// automations: actions: [/* ... */ taskAction(tasks.store)]
```

It returns `store` and the manifest and stands on IAM and the audit log; without `send` nobody is
emailed. No binding, secret or variable.

Two capabilities on bit plane 18, read at the task's place: `tasks.read` (see tasks; mark done or
reopen one given to them) and `tasks.manage` (make, give, change, mark done, remove). A task is
given only to someone who is on and holds `tasks.read` there, by their access at that moment
(`KIT-E-2901`); anyone may give one to themselves, the Vendor included, but nobody else gives one to
the Vendor.

## A task

Limits are `LIMITS` in `src/tasks.ts`.

| Part | What it is |
|---|---|
| Title, notes | `title` (200), `notes` (4,000) |
| Place | Fixed once made |
| Given to | One person who may see it there, or nobody yet |
| Due on | A day or none; Past due and Due today read in UTC |
| Done | By whom and when; it can be reopened |
| Comments | By anyone who may see it, `comment` (2,000) each, oldest first, `comments` (200) shown |

Given by another person or an automation, the assignee gets one email (who, place, due day, link);
giving to oneself sends nothing. A comment is emailed to the assignee and the maker while they may
still see it, never to its writer.

## Pages and routes

| Path | Shows |
|---|---|
| `/tasks` | Chips Mine (own open tasks everywhere, with count), Open, Done; for Open and Done, the places as chips with open counts. **New task** in a dialog where the person manages (place as chips when several; "Given to" offers Me first, **Give it to me**). Open tasks by due day; with two or more ticked, a bar: **Mark done**, **Remove** (confirmed) |
| `/tasks/:id` | State and place; **Mark done** or **Open it again**, **Change it**, **Remove it** (confirmed), each only to whoever may; notes, comments with a box, history |

| Route | Needs | What it does |
|---|---|---|
| `GET /tasks` (`view` `VIEWS`: mine, open, done; `place`) | `tasks.read` | `listed` (100), with places and open counts |
| `POST /tasks` | `tasks.manage` at the place | Makes a task |
| `GET /people` | `tasks.manage` somewhere | `me` first, then people who are on, `people` (200) |
| `GET /tasks/:id` | `tasks.read` at its place | One, with what the person may do |
| `PATCH /tasks/:id` | `tasks.manage` at its place | Title, notes, due day, assignee |
| `POST /tasks/:id/done` | `tasks.read`, and manages it or is its assignee | Done, or open again |
| `POST /tasks/:id/comments` | `tasks.read` at its place | Adds a comment; the people on it told |
| `DELETE /tasks/:id` | `tasks.manage` at its place | Removes it with its comments; the log keeps its title |

Bulk actions on the manifest (`bulk`): **done** and **remove**, up to 100, each task by its one-task
rule, answering what was done and each refusal with its reason. Module parts: Needs you (own open,
past due, due today), search (titles where visible), Reports under Work (made, done, overdue, per
day, who did most), and `store.calendar(env, session, from, to)` (own open tasks due in the range,
`calendar` 200, all-day `Due: <title>`, for `@oltrem/connect`). For automations,
`store.make(env, tenantId, { title, notes?, assignee?, dueInDays?, key })` makes a task at the
company once per `key`, so a retried run makes one.

Audited, refusals too: `tasks.create`, `.update`, `.done`, `.reopen`, `.comment`, `.remove`; a bulk
press writes one row per task with `bulk: true`, in the batch of its change.

## Tables and errors

Migrations `0026` (`tasks_items`: place, title, notes, assignee, due day, state, maker, doer, the
automation run's key) and `0030` (`tasks_comments`: task, writer and their address then, text,
when). Block `29xx`: `KIT-E-2901` cannot be given to that person; bad input is `KIT-E-0422`, no
capability `KIT-E-0403`.

Not built: files on a task; repeating tasks (an automation on a schedule does it); a board view; a
task given to a group.

## Tests

| File | Covers |
|---|---|
| `test/tasks.test.ts` | The manifest; made only by managers, given only to someone who may see it, the email and none to oneself, refusals audited; places, own list, Needs you; done by assignee or manager only; comments and who is told; changed, given to another, removed; bulk with refusals named; the automation's task once per key; search; giving to oneself and the Vendor; Reports; calendar items |
| `test/pages.test.ts` | New task on Mine with the place to choose and Me first; one place fixed, none no button |

The client template's screens test makes a task for today, sees it on Home, marks it done, reopens,
comments, changes and removes it.

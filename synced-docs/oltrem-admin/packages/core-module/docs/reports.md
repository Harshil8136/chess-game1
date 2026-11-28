---
title: "@oltrem/core-module: reports, Needs you, Get started, bulk, personal data, customer parts, pages"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-module/src/module.ts, report.ts, pages.ts]
---

# @oltrem/core-module: reports, Needs you, Get started, bulk, personal data, customer parts, pages

> Part of [the @oltrem/core-module README](../README.md). Each part below is optional on the
> manifest; `find`, `list`, `steps` and `read` get the session from `ctx`, so they answer only what
> the person may see. A link that is not a portal page is dropped.

## Reports

`report`: a title, a tab (`money`, `customers`, `work`, `email`, `services`), a capability
(`company: true` asks it at the root) and `read(period, ctx)`. It adds `GET
/api/<module>/report?days=&to=YYYY-MM-DD`: `days` 7, 30 or 90 (`REPORT_DAYS`) or 1 to 90
(`REPORT_MAX_DAYS`) ending on `to`; anything else is 422. The answer:

- up to 6 figures (`REPORT_FIGURES`), each `now` and `before` (`null` when unknown), with `good:
  'down'`, `currency` (smallest unit) or `unit` (`percent`, `days`, `bytes`);
- a `trend`, one number a day; lists of up to 8 rows (`REPORT_ROWS`, a row's `unit` or `shown`);
  a `note`;
- `steps` (`enquiries`, `quoted`, `won`, `paid`) for the Money tab's "From visit to paid".

Helpers: `reportPeriod(days, to)`, `tally(period, rows, pick)` (folds rows by day `d` into both
totals and daily lines), `mainCurrency(rows)`, `bytes(n)`. The analytics module's `parts` lists the
sections; the page asks only the open tab's.

```ts
report: { title: 'Notes', tab: 'work', capability: 'notes.read',
  read: async (p, ctx) => {
    const made = tally(p, await notesByDay(ctx, p.beforeFrom, p.end), (r) => r.n);
    return { figures: [{ label: 'Notes made', now: made.now, before: made.before }],
             trend: { label: 'Notes made', values: made.daily, before: made.dailyBefore } };
  } },
```

## Needs you

`todo`: a capability and `list(ctx)` answering items (title, optional note, page). It adds `GET
/api/<module>/todo`, at most 5 items (`TODO_ITEMS`). Home asks every module in sidebar order and
shows them first. `list` answers only what this person can act on, by the same rules the action
checks. Count what is many ("3 requests to decide"). An item may carry an `action` (a label and an API path from `/api/`): Home
shows its button and `/do/needs-you` POSTs `{}` only to a fix the module still offers.

## Get started

`onboarding`: a capability and `steps(ctx)`, each a title, optional note, page and `done` read from
what the module stores, never a click. A one-press step may carry `action` (a label and a `path`
among the module's own `/api/<module>/...` routes, posted empty; its own capability and audit
apply). It adds `GET /api/<module>/onboarding`, at most 5 steps (`ONBOARDING_STEPS`). Home shows
"Get started: n of m done" above Needs you until all are done; `settings.get-started` switches it
off. The kit's steps come from `providers`, `users`, `iam` (the people named at setup sign in),
`backup` and `alerts`.

## Bulk actions

`bulk`: each action an `id` (the route's last segment), a `label`, a `capability`, `destructive`
when it cannot be undone, and `run(ctx, ids)`. It adds `POST /api/<module>/bulk/<id>` with `{ ids }`
(1 to 100, `BULK_MAX`, repeats dropped). `run` checks each row by its one-row rule and answers
`{ done, refused: [{ id, reason }] }`. To stay within 50 database calls, read the rows in one query
(`json_each(?1)`) and write the changes with one audit row each in one `db.batch`
(`auditStatements` from `@oltrem/iam`, or core-audit's `statements`). The screens draw `BulkBar`
and post through `/do/bulk`. The kit's: tasks (Mark done, Remove), files (trash, purge, end
access).

## Personal data

`personal`: a `title` and `find(env, tenantId, email)` answering the rows held under that address
(lower case), at most 200 (`PERSONAL_ROWS`), with `more` and an `href`. The privacy module calls it
in-process for a privacy request and puts the rows in the person's copy, so rows use plain field
names, no internal ids. No route. Correcting and deleting stay in the module.

## Customer parts

`customer`: a `title` and `find(env, tenantId, email)` answering the items held for the signed-in
customer's address, newest first, at most 20 (`CUSTOMER_ITEMS`), with `more`. Each item has a
`title`, an `at` time, and may have a `state`, `replies`, `details` (a few lines) and `actions`. The
customers module shows one section a module on `/account`; only what the company wrote or
confirmed belongs there. A `find` that throws shows its section as unreadable.

- **`open(env, tenantId, email, id)`** hands a thing over at `/account/open/<module>/<id>`
  (uncached), checking again it is theirs; null or an error returns to the account page.
- **`act(env, tenantId, email, id, action)`** answers a button at
  `/account/act/<module>/<id>/<action>`: it checks the item is theirs and open, acts once, audits,
  and answers false otherwise ("That is no longer open to you").

## Pages

`pages`: each a portal path, a `get` and an optional `post` answering a page (title, body, and
optionally `sub`, `tools`, `counts`, `kind: 'form'`), a redirect or a response, and an optional
`nav` (label, group, summary, `before`, `tabs`, `under`) for a sidebar section. A page reads and
writes only through `api`, the portal's own API in the same request, so it can never do more than
its routes allow. Paths under `/api`, `/hooks`, `/ui`, `/do` or `/local`, a repeated path, a page
with no `get` or an incomplete nav entry are refused.

- **`views`**: the query parameters a saved view keeps (`views: ['view', 'place']`; `done`, `page`
  and the like refused). The screens show saved views as chips (`@oltrem/users`). Declared on
  tasks, customers and the data module's records.
- **JSX in its own entry.** The manifest cannot compile JSX, so pages live in `src/pages.tsx`
  (checked against the DOM) and the client joins them with `withPages(module, pages)`; `module.ts`
  never imports them. Types come from `@oltrem/core-module/pages` (no Workers type); a
  `pages.public.d.ts` is the Worker-typed view, held by a type test. `@oltrem/files` is the model:
  `./pages` exported with one export named `pages`, a `tsconfig.pages.json`, two pragma lines.
- **Helpers** from `@oltrem/core-module/pages`: `field(form, name)`, `redirect(to)`,
  `refused(title, detail?)` (the 422 `KIT-E-0422` shown above a form).

A route with `body: 'bytes'` (POST or PUT) takes the content as its body; its schema checks the
query. `route(def)` keeps a route's own input type in the module's list.

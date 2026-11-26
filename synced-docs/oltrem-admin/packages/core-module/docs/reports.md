---
title: "@oltrem/core-module: Reports; Needs you; Get started; Bulk actions; Personal data; Customer parts; Pages"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-module/src; split from packages/core-module/README.md]
---

# @oltrem/core-module: Reports; Needs you; Get started; Bulk actions; Personal data; Customer parts; Pages

> Part of [the @oltrem/core-module README](../README.md).

## Reports

A module's section on the Reports page is declared as `report`: a title (the section's heading), the
tab it sits under (`money`, `customers`, `work` or `email`), one of the module's own capabilities,
and `read(period, ctx)`, which answers up to `REPORT_FIGURES` (six) figures, each the period's
number and the period before's (`before: null` when that cannot be known, so no move is shown;
`good: 'down'` when less is better; `currency` for an amount in its smallest unit; `unit` `percent`
or `days` for a share or a number of days), one number a day as a `trend`, and lists of up to
`REPORT_ROWS` (eight) rows. `defineModule` adds `GET
/api/<module>/report?days=7|30|90&to=YYYY-MM-DD` under that capability; any other period or day is
refused (422), and a row's address that is not a page of the portal is dropped. `reportPeriod(days,
to)` is the period and the one before it; `tally(period, rows, pick)` folds rows counted by day
(`d`), read from `beforeFrom` to `end`, into both totals and both daily lines; `mainCurrency(rows)`
is the currency most rows use. A part that counts a step from an enquiry to a payment declares it in
`steps` (`enquiries`, `quoted`, `won`, `paid`) and answers each in `steps`, the period's count and
the one before's; the Money tab sets them after the website's visitors as "From visit to paid", and
a step it did not declare is dropped. `read` reads the session from `ctx`, so a section counts only
the places the person may see. The analytics module's `parts` option lists the sections, and the
page asks only the open tab's.

```ts
report: {
  title: 'Notes',
  tab: 'work',
  capability: 'notes.read',
  read: async (p, ctx) => {
    const made = tally(p, await notesByDay(ctx, p.beforeFrom, p.end), (r) => r.n);
    return {
      figures: [{ label: 'Notes made', now: made.now, before: made.before }],
      trend: { label: 'Notes made', values: made.daily, before: made.dailyBefore },
    };
  },
},
```

## Needs you

What waits for the person signed in is declared as `todo`: one of the module's own capabilities
and `list(ctx)`, which answers items, each a title, an optional note and the portal page to act on
it. `defineModule` adds `GET /api/<module>/todo` under that capability; an item whose address is
not a page of the portal is dropped, and at most `TODO_ITEMS` (five) are answered. Home asks every
mounted module that has one, in the sidebar's order, and shows the items first, under "Needs you";
a module that refuses the person adds nothing. `list` reads the session from `ctx`: it answers
only what this person can act on, by the same rules the action itself checks, so nobody is sent
to a decision the API would refuse them. Count what is many ("3 requests to decide") rather than
listing each.

```ts
todo: {
  capability: 'notes.manage',
  list: async (ctx) => {
    const n = await unansweredFor(ctx);
    return n ? [{ title: `${n} notes to answer`, href: '/notes' }] : [];
  },
},
```

## Get started

A module that has a step of setting a new portal up declares `onboarding`: one of its own
capabilities and `steps(ctx)`, which answers each step's title, an optional note, the portal page
where it is done and `done`, read from what the module really stores (a row, a setting), never from
a click. A step one press does may also carry `action`: a button label and a `path` among the
module's own API routes (`/api/<module>/...`), which Home shows as a button on the step's row and
POSTs with an empty body; the route's own capability and audit apply, and the step still ticks only
by what is stored. `defineModule` adds `GET /api/<module>/onboarding` under that capability; a step
whose address is not a page of the portal is dropped, an action whose path is not the module's own
is dropped from its step, and at most `ONBOARDING_STEPS` (five) are answered. Home asks every
mounted module that has one, in the sidebar's order, and shows the card "Get started: n of m done"
above Needs you while a step is open; once all are done the card is gone. The settings part's extra
`settings.get-started` switches it off. The kit's steps: connect an email service (`providers`),
invite a second person (`users`), make the first backup copy (with Make it now once backups are set
up) and run a restore drill (`backup`), name who gets alerts (`alerts`).

```ts
onboarding: {
  capability: 'notes.manage',
  steps: async (ctx) => [
    { title: 'Write the first note', href: '/notes', done: await anyNote(ctx.env) },
  ],
},
```

## Bulk actions

A module whose list can act on many rows at once declares `bulk`: each action an `id` (lower case,
the route's last segment), the button's `label`, the `capability` the route needs somewhere,
`destructive` when it cannot be taken back, and `run(ctx, ids)`. `defineModule` adds
`POST /api/<module>/bulk/<id>` with the body `{ ids }`: one to `BULK_MAX` (100) ids, repeats
dropped. `run` checks each row by the same rule its one-row action checks, refuses the rows that
fail with a reason, and answers `{ done, refused: [{ id, reason }] }`. To stay inside an
invocation's 50 database calls it reads the rows in one query (`json_each(?1)` with the ids as
JSON, never one bind per id) and writes the changes and one audit row per record in one
`db.batch`: `auditStatements` from `@oltrem/iam` (or `statements` of `@oltrem/core-audit`) makes
the rows for that batch. The screens draw the bar (`BulkBar` in `@oltrem/core-ui`) and post to it
through `/do/bulk`. The kit's: Mark done and Remove on the tasks.

```ts
bulk: [
  { id: 'remove', label: 'Remove', capability: 'notes.manage', destructive: true,
    run: (ctx, ids) => store.removeMany(ctx.env, actorOf(ctx), ids) },
],
```

## Personal data

A module that keeps rows about people declares `personal`: a `title` and `find(env, tenantId,
email)`, which answers the rows it holds under that address (lower case), at most `PERSONAL_ROWS`
(200), with `more` when there are more and the `href` of the portal page that shows them. The
privacy module calls it in-process when a privacy request is searched, and puts the rows in the
copy the person is given, so a row should say what it is in plain field names, without internal
ids. No route is added. `defineModule` refuses a `personal` without a title. Correcting and
deleting stay in the module, where its own rules and audit apply.

```ts
personal: {
  title: 'Notes about them',
  find: async (env, tenantId, email) => {
    const rows = await notesAbout(env, tenantId, email, PERSONAL_ROWS + 1);
    return { rows: rows.slice(0, PERSONAL_ROWS), more: rows.length > PERSONAL_ROWS, href: '/notes' };
  },
},
```

## Customer parts

A module that keeps things a customer of the company should see declares `customer`: a `title`
and `find(env, tenantId, email)`, which answers the items it holds for the address the customer
proved when they signed in (lower case), the newest first, at most `CUSTOMER_ITEMS` (20), with
`more` when there are more. Each item has a `title`, the time it is about (`at`, ISO), and may
have a `state` in a few words and `replies`, each a time and a text. The customers module calls
it in-process when a signed-in customer opens `/account` and shows one section a module, so an
item should be something the company wrote or confirmed: never text that anyone could have sent
in the customer's name. No route is added. `defineModule` refuses a `customer` without a title.
A `find` that throws shows its section as not readable; the page still opens.

A part that can hand the customer something, a file, adds `open(env, tenantId, email, id)` and
gives each such item an `id`: the page links the item to `/account/open/<module>/<id>`, where the
door calls `open` for the signed-in customer and answers its `Response`, uncached. `open` checks
again that the thing is theirs and answers null when it is not or no longer is; null, or an
error, returns the customer to their account page.

An item may also carry `details`, a few lines of text shown under it (a quote's lines and its
total), and `actions`, each an `id` and a label: the customer's answers to it, accept or decline,
say. A part with actions adds `act(env, tenantId, email, id, action)`: each action is a button that
posts to `/account/act/<module>/<id>/<action>`, and the door calls `act` for the signed-in customer
and returns them to their account page with "Thank you: we have your answer". `act` checks again
that the item is theirs and still takes that answer, does it once, records it in the audit log,
and answers false otherwise, which shows "That is no longer open to you"; so does an error.

```ts
customer: {
  title: 'Your orders',
  find: async (env, tenantId, email) => {
    const rows = await ordersOf(env, tenantId, email, CUSTOMER_ITEMS + 1);
    return {
      items: rows.slice(0, CUSTOMER_ITEMS).map((o) => ({ title: o.name, at: o.at, state: o.state })),
      more: rows.length > CUSTOMER_ITEMS,
    };
  },
},
```

## Pages

A module brings its own screens as `pages`: each a portal path, a `get` and an optional `post` that
answer a page (a title and a body; optionally the line under the title, `sub`, the buttons on the
head's right, `tools`, a count beside a tab of its set by the tab's path, `counts`, and `kind:
'form'` for a form that keeps a readable width), a redirect or a plain response, and an optional
`nav` (a label, a group, a summary, and optionally `before`: the path of the section it goes just
before; `tabs`, the set of tabs it joins; and `under`, the tab it opens under when it is no tab of
its own, such as Email's setup pages under `/settings/section/email`) that gives it a section in the
sidebar. A page reads and writes only through `api`, the portal's own API called inside the same
request, so it can never show or change more than its routes allow. A path under `/api`, `/hooks`,
`/ui`, `/do` or `/local`, a path taken twice, a page with no `get` and a sidebar entry missing a
word are refused when the module is defined.

A list page whose filters live in its address declares `views`: the query parameters a saved view
keeps (`views: ['view', 'place']`), lower case, never a page's own state (`done`, `page` and the
like are refused). The screens then show the person's saved views of that page as a sideways row
of chips above it (All first), offer to save the filters on screen under a name, and to remove
the view on screen; the views are `@oltrem/users`'s. The kit declares them on tasks, files and
customers, and the screens on a records list, a form's inbox and the audit log.

Pages are JSX, which the Workers-typed manifest cannot compile, so a module keeps them in their
own entry (`src/pages.tsx`, type-checked against the DOM) and the client joins them to the
manifest with `withPages(module, pages)`, checked the same way. The module's own `module.ts`
never imports its pages. The page types live in `@oltrem/core-module/pages`, which names no
Workers type, so both sides import them; a `pages.public.d.ts` beside the pages is what a
Worker-typed client sees, held to the implementation by a type test. `@oltrem/files` is the
model: its `package.json` exports `./pages`, whose one export is named `pages` (the tool's
loader stands it in by that name when it reads a Worker in Node), its `tsconfig.pages.json`
checks the JSX, and two pragma lines at the top of `pages.tsx` tell any bundler how to compile it.

A page's post uses three helpers from `@oltrem/core-module/pages`, kept once: `field(form, name)`, a
form field's text trimmed (empty for a missing one or a file), `redirect(to)`, and `refused(title,
detail?)`, the 422 `KIT-E-0422` a page shows above its form.

A route may take its body as the content itself (`body: 'bytes'`, POST or PUT only): an upload.
Its schema then checks the query. `route(def)` holds a route written with its own input type
(from its schema) in the module's list of routes, which every module's list uses.

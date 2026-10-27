---
title: "Adding a module to the kit"
status: living
owner: vendor
last_verified: 2026-10-27
sources: [modules/tasks, modules/approvals, modules/announcements, templates/client, packages/core-module/README.md, docs/architecture.md]
---

# Adding a module to the kit

> **In plain words.** The steps, in order, to add a feature every client gets, such as Tasks or
> Approvals: which files to write, which numbers to take, how to mount it in the client template,
> what to test and which documents to change in the same commit. An agent or a developer starting
> from a blank chat follows it top to bottom. A feature for one client only is not this: run
> `oltrem new module <name>` in that client's repository ([the tool](../../packages/cli/README.md)).

The smallest complete examples are [`modules/announcements`](../../modules/announcements/README.md)
and [`modules/approvals`](../../modules/approvals/README.md): copy the one closer to the new feature
and change it, rather than starting from nothing.

## 1. Before writing code

- Read [the module contract](../../packages/core-module/README.md) and
  [the permission model](../../modules/iam/README.md) for the parts the module will use.
- Check [the roadmap](../roadmap.md): the module fits an edition, needs no new binding, secret or
  variable (R-09), and is not aimed at one kind of business.
- Take the next free numbers from [the numbers table](../architecture.md#numbers-that-are-taken):
  a migration number, a bit plane, and an error block if the module has errors of its own. They
  are claimed in the same commit, and never reused.

## 2. The files

Every module has the same shape; the names below are the ones to keep.

| File | What it holds |
|---|---|
| `package.json` | `@oltrem/<id>`, `private`, the exports `.` (`src/index.ts`) and `./pages` (types `src/pages.public.d.ts`, default `src/pages.tsx`), `typecheck` running both programs, `test` running vitest; dependencies from the catalog (`catalog:`) or the workspace |
| `src/types.ts` | what the API answers, read by the Worker code and the pages alike; no imports from either |
| `src/<feature>.ts` | the store: every read and change, the capability check at the row's place (`can`), each change inside `recorded(...)` so it and its refusal are audited |
| `src/module.ts` | `defineCapabilities` (classes `read`, `operate`, `admin`; labels in `en` and `es`), the routes with their zod/mini schemas, then `defineModule` with `todo`, `search`, `errors` and `migrations` |
| `src/errors.ts` | `defineErrors` with the module's block, only when the core's codes do not say it |
| `src/index.ts` | the public exports: the factory, the capabilities, the store's types |
| `src/pages.tsx` | the pages, JSX on the server; read and change only through `ctx.api` so the capabilities decide; options in sideways rows (`ChipRow`, `ChoiceChips`, `CommandRow`), dialogs for forms, `ConfirmDialog` before anything removed (R-12) |
| `src/pages.public.d.ts`, `tsconfig.pages.json`, `test/pages-types.ts` | the pages' type check against the DOM, apart from the Worker's; copied unchanged |
| `migrations/<number>_<id>.sql` | additive and idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`; tables named for the module |
| `test/<id>.test.ts`, `test/seed.ts` | the tests inside the Workers runtime, through the pipeline beside the IAM module, with a seeded company, places, roles and people |
| `vitest.config.ts`, `wrangler.jsonc`, `oltrem.manifest.json`, `test/env.d.ts`, `test/apply-migrations.ts`, `tsconfig.json` | the test Worker; copied with the module's name |
| `README.md` | what it does, using it, who may do what, the parts of a record, the pages, the routes, the tables, the errors, what is not here yet, the tests |

Rules the gates hold the module to:

- A route's `action` is a bare verb (`create`), and its capability starts with the module's id.
- A capability nobody declares is refused for everyone, the Owner included; `<id>.self` is held
  by every account, for what a person sees of their own.
- A store that writes its own audit row keeps the pipeline from writing a second.
- Times are kept in UTC, and every list has a limit (100 rows in the kit's modules).
- A download is written with `csvFile` of `@oltrem/core-module`, which quotes every cell and keeps
  what people typed from running as a spreadsheet formula; times on the company's clock come from
  `@oltrem/core-config`.
- A page is one invocation, and the Free plan allows 50 database queries in one (a `batch` counts
  as one). Home calls every module's `todo` and `home` on each view, so each answers in one query
  or one batch; the client template's screens test fails when Home makes more than 40 or another
  page more than 10, and names the page.
- The Worker code never imports `src/pages.tsx`, and the pages never import `src/module.ts`.

## 3. Mounting it in the client template

In `templates/client`:

1. `package.json`: the module under `dependencies`, then `pnpm install`.
2. `src/index.ts`: the factory, its email template when it sends one, and the module in the
   `modules` list with `withPages(...)`, beside the modules of its edition; the header comment
   names it.
3. `pnpm build`, then `pnpm oltrem migrations sync templates/client`: the migration is copied and
   `migrations/kit.json` is written.
4. `test/worker.test.ts`: the module's id in the health route's list, its tables in the
   migrations test.
5. `test/screens.test.ts`: the page and its words in the list of pages, and a journey through the
   page as the Owner.

Then add the id to `RESERVED` in `packages/cli/src/new-module.ts`; a test fails when a kit module
is missing from it.

## 4. The documents, in the same commit

| Document | The change |
|---|---|
| The module's `README.md` | the whole of it |
| [Index](../README.md) | a row for the README, and one for the record |
| [Architecture](../architecture.md) | the numbers taken, and the next free ones |
| [Roadmap](../roadmap.md) | the module in its edition, and its row in the state of each module |
| A record, `docs/records/<date>-<id>-module.md` | what changed and why in plain words, before and after as two flowcharts with an explanation, the impact on each part, how it was verified |
| [Verification log](../verification-log.md) | one row: what the tests checked, and what was not (a phone, a deployed portal) |

## 5. Checking and pushing

```sh
pnpm format && pnpm ui:build && pnpm docs:build && pnpm oltrem docs templates/client
pnpm verify
```

`pnpm verify` passes, its summary line goes in the commit message with the documents changed, and
the commit goes to `main` (R-01, R-02).

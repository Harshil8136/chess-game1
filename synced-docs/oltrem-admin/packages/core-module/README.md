# @oltrem/core-module

The module contract of the kit (plan section 4.3): one manifest per feature, checked when it is
defined so a bad one fails the build. So far: the id and the version, the capabilities on their
bit plane, the API routes with their capability and schema, the event types a module handles, its
jobs, its flows, its health checks, the migrations it ships, the settings and errors it owns, and
the scheduled hook. Pages, i18n and docs join the manifest with the rest of the module system
(phase 3).

## Defining a module

```ts
import { defineModule } from '@oltrem/core-module';

export const notes = defineModule({
  id: 'notes',
  version: '1.0.0',
  bitPlane: 7, // the permission bit plane the registry gave this module, once and for ever
  capabilities: [
    { id: 'notes.read', class: 'read', label: { en: 'See notes', es: 'Ver notas' } },
    { id: 'notes.write', class: 'operate', label: { en: 'Write notes' }, freshSignIn: true },
  ],
  api: [
    {
      method: 'POST',
      path: '/',
      capability: 'notes.write',
      schema: NoteInput, // any Standard Schema: zod, valibot, arktype
      summary: 'Create a note',
      handler: async ({ input, identity, env }) =>
        Response.json(await create(env, identity, input), { status: 201 }),
    },
  ],
  eventTypes: ['notes.created'],
  onEvent: async (event, env) => {
    /* fan out */
  },
  jobs: [
    {
      id: 'notes.digest',
      every: '1h',
      summary: 'Send the hourly digest',
      run: async (env) => {
        /* ... */
      },
    },
  ],
  flows: [
    {
      id: 'notes.export',
      summary: 'Export every note',
      schedule: '0 4 * * *',
      run: async ({ step, env }) => {
        /* ... */
      },
    },
  ],
  health: [
    {
      id: 'notes.store',
      lane: 'storage',
      summary: 'The notes table answers',
      run: async (env) => ({ status: 'ok' }),
    },
  ],
  migrations: ['0012_notes.sql'], // shipped in the module's migrations/ folder
  settings: [notesPerPage], // defined with defineSetting, under the key prefix `notes.`
  errors: NOTES_ERRORS, // defined with defineErrors('notes', ...)
  secrets: [
    {
      name: 'NOTES_KEY',
      purpose: '...',
      create: '...',
      scopes: [],
      test: '...',
      rotate: '...',
      without: '...',
    },
  ],
  home: {
    title: 'Notes',
    capability: 'notes.read',
    read: async (env) => ({ value: '12', note: '3 today', state: 'ok' }),
  },
  scheduled: async (controller, env) => {
    /* the raw tick, rarely needed */
  },
});
```

## What the contract refuses

| Rule                                                                                                                                                                                                    | Code                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| The id is `[a-z][a-z0-9-]*`; the version is `x.y.z`                                                                                                                                                     | `KIT-E-1006`               |
| A route path starts with `/` and has a summary                                                                                                                                                          | `KIT-E-1006`               |
| A route's `action`, when given, is lower case letters, digits and dashes: the verb its automatic audit row names                                                                                        | `KIT-E-1006`               |
| Every route names a capability, `<module>.<name>`, with the module's own id                                                                                                                             | `KIT-E-1001`, `KIT-E-1006` |
| A POST, PUT or PATCH route has a schema for its body                                                                                                                                                    | `KIT-E-1002`               |
| A route open to any identity (`access: 'identity'`) is POST and names no capability                                                                                                                     | `KIT-E-1006`               |
| Capabilities come with a bit plane, a whole number, and a bit plane with capabilities                                                                                                                   | `KIT-E-1006`               |
| A capability is `<module>.<name>`, declared once, with a class, a label in English and a known floor                                                                                                    | `KIT-E-1006`               |
| A module that declares capabilities names every route's capability among them, `<module>.self` apart                                                                                                    | `KIT-E-1006`               |
| No two routes share a method and a path                                                                                                                                                                 | `KIT-E-1005`               |
| A public hook's path is `/` and segments of letters, digits, `_` and `-`, or `:params`; it has a summary and a handler, and is declared once                                                            | `KIT-E-1006`, `KIT-E-1005` |
| An event type is prefixed with the module's id; event types and `onEvent` come together                                                                                                                 | `KIT-E-1006`               |
| A job is `<module>.<name>`, declared once, with a summary, a `run` and an interval of a count and a unit (`15m`, `6h`, `1d`)                                                                            | `KIT-E-1006`               |
| A flow is `<module>.<name>`, declared once, with a summary, a `run` and, when scheduled, five cron fields                                                                                               | `KIT-E-1006`               |
| A health check is `<module>.<name>`, declared once, with a lane of lower-case letters, digits and dashes, a summary and a `run`                                                                         | `KIT-E-1006`               |
| A migration is named `NNNN_name.sql` and declared once                                                                                                                                                  | `KIT-E-1006`               |
| A setting's key starts with the module's id and its definition names the module; an error's definition names the module                                                                                 | `KIT-E-1006`               |
| A key recipe names its secret once, in upper case letters, digits and `_`, with a purpose and how to create, test and rotate it and live without it; `createAt` is an https address; `scopes` is a list | `KIT-E-1006`               |

The manifest is frozen once defined. `RouteContext` gives a handler the request, the bindings,
the identity the door asserted (email, subject, when the person signed in, the token's audience),
the session the app's hook returned (the IAM session, or nothing in own-account mode), the
validated input, the path parameters, the request id and `waitUntil`.

A route's `access` is `session` unless said otherwise: the app's session hook runs and the
capability is checked. `access: 'identity'` opens the route to any identity the door asserted,
for a person who has no account yet (the IAM module's acceptance of an invitation): the pipeline
loads no session and checks no capability, so the route names none, and it is POST only, so its
body is validated and the same-origin check applies. It is the one way past the capability check,
and it is written in the manifest where a reviewer reads it.

## Capabilities

A module declares what its routes check as data on the manifest: `bitPlane`, the permission bit
plane the registry gave it once and for ever, and `capabilities`, each with its id, its class
(`read`, `operate` or `admin`, how the screens group it), a label a person reads, and the flags
the permission model acts on (`floor`, `freshSignIn`, `secondPerson`). The contract checks the
shape; the permission module (`@oltrem/iam`) registers the declarations when the Worker starts,
through the pipeline's startup hook, and only under a version the registry has not seen, so a
change to the capabilities bumps the module's version; a client's `oltrem docs --check` refuses a
change made under the same version, against the committed `capabilities.json`. A module may
declare none, in a client
that runs the own-account rule, where the owner holds every capability by name; one that declares
any names every route's capability among them, so no route checks what nobody can hold.
`<module>.self` is the one exception: every account holds it, for the routes about one's own
things.

## Public hooks

A module's `hooks` are addresses an outside service posts to, such as a provider's delivery
reports, or a link a person opens, such as a shared file (`method: 'GET'`; `POST` by default),
mounted by `@oltrem/core-http` at `/hooks/<module><path>` before the Access identity is read. The handler gets the body exactly as it arrived (`HookContext.body`), the path's
parameters and no session; it is the only check, so it verifies the caller by a signature or a
secret in the address.

## Jobs

A module's periodic work is declared as `jobs`, each with a stable id, an interval and a summary;
the one tick (`@oltrem/core-jobs`) runs them when due under a lease and records each outcome.
`everySeconds(every)` is the parser both share. The `scheduled` hook stays for a module that
needs the raw tick; work that should be seen, counted and retried is a job.

## Flows

Work too long or too many-stepped for the tick is a flow: a stable id, a summary, a `run` and,
when it runs on its own, a `schedule` of five cron fields in UTC. The client's one Workflow
(`@oltrem/core-jobs`, `createFlows`) runs it, either when the tick finds its schedule due
(`flows.startDue`) or when `startFlow` starts it by hand with its params. `run` gets a `step`: each `step.do(name,
callback)` is retried on its own and its result kept, so a callback is the unit of work and code
outside one runs again whenever the instance resumes; `step.sleep` pauses without spending CPU.
`isCron(text)` is the check the contract applies to a schedule.

## Health

A module's checks are declared as `health`, each with a stable id, a lane the page groups it
under, a summary and a `run` that answers `ok`, `warn` or `fail` with a few words. The health job
(`@oltrem/core-health`) runs every mounted module's checks on the tick, keeps the last result per
check and opens a problem after two failures in a row.

## Home

A module's card on Home is declared as `home`: a title, one of the module's own capabilities,
and a `read` that answers one short figure (`value`), an optional line under it (`note`) and a
state, `ok`, `attention`, `failing` or `unknown`. `defineModule` adds the route
`GET /api/<module>/home` under that capability, so the card is checked like any other read; the
screens ask every mounted module that has one and leave out the cards a person may not read. A
module whose routes already include `GET /home` is refused (`KIT-E-1005`).

## Search

A module's part of the portal's search is declared as `search`: a title (the heading of its
results), one of the module's own capabilities, and `find(words, ctx)`, which gets the words and
the route's context and answers hits, each a title, an optional note and the portal page that
shows it. `defineModule` adds `GET /api/<module>/search?q=` under that capability: words shorter
than two letters find nothing, a hit whose address is not a page of the portal is dropped, and at
most `SEARCH_HITS` (eight) are answered. `find` reads the session from `ctx`, so it answers only
what the person may see. `containing(words)` is the `LIKE` pattern for it, its wildcards escaped
(`ESCAPE '\'`).

```ts
search: {
  title: 'Notes',
  capability: 'notes.read',
  find: async (words, ctx) => (await notesFor(ctx, containing(words))).map((n) => ({ title: n.title, href: `/notes/${n.id}` })),
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

A module brings its own screens as `pages`: each a portal path, a `get` and an optional `post`
that answer a page (a title and a body), a redirect or a plain response, and an optional `nav`
(a label, a group and a summary) that gives it a section in the sidebar. A page reads and writes
only through `api`, the portal's own API called inside the same request, so it can never show
or change more than its routes allow. A path under `/api`, `/hooks`, `/ui` or `/local`, a path
taken twice, a page with no `get` and a sidebar entry missing a word are refused when the module
is defined.

Pages are JSX, which the Workers-typed manifest cannot compile, so a module keeps them in their
own entry (`src/pages.tsx`, type-checked against the DOM) and the client joins them to the
manifest with `withPages(module, pages)`, checked the same way. The module's own `module.ts`
never imports its pages. The page types live in `@oltrem/core-module/pages`, which names no
Workers type, so both sides import them; a `pages.public.d.ts` beside the pages is what a
Worker-typed client sees, held to the implementation by a type test. `@oltrem/files` is the
model: its `package.json` exports `./pages`, whose one export is named `pages` (the tool's
loader stands it in by that name when it reads a Worker in Node), its `tsconfig.pages.json`
checks the JSX, and two pragma lines at the top of `pages.tsx` tell any bundler how to compile it.

A route may take its body as the content itself (`body: 'bytes'`, POST or PUT only): an upload.
Its schema then checks the query.

## CSV files

`parseCsv(text)` reads a CSV file as a spreadsheet saves it, row by row (RFC 4180: quoted fields,
doubled quotes, line breaks inside quotes; a comma or a semicolon between fields, whichever the
first line uses most; a byte order mark ignored; empty lines left out). `decodeText(bytes)` reads
an upload as UTF-8 when it is, otherwise as Windows-1252. The campaigns' list and the records'
import use both. `csvFile(head, rows)` writes one, every cell through `csvCell`: quoted with
its quotes doubled, a yes or no as `Yes` or `No`, and text a spreadsheet would run as a formula
(starting with `=`, `+`, `-`, `@`, a tab or a carriage return) given a leading apostrophe, so what
someone typed never runs on the computer of whoever opens the download. Every download of the kit
writes through them: the audit log's, the forms' answers, the records' lists, the expenses' month
and the time clock's hours.

## Migrations, settings and errors

The manifest also names what the module owns elsewhere, so one file says everything a reviewer
or a generator needs: `migrations`, the SQL files it ships, named `NNNN_name.sql`; `settings`,
the definitions it made with `defineSetting` (`@oltrem/core-config`), whose keys start with the
module's id; `errors`, the codes it made with `defineErrors` (`@oltrem/core-errors`). The contract
checks that each belongs to this module and refuses one defined for another, so a module cannot
claim another's setting or code; the generator and the references of phase 3 read these lists.

## Key recipes

`secrets` lists the Worker secrets the module needs, one key recipe each (plan 15.3): the name
`wrangler secret put` takes, what it is for, how to make and set it (`create`, with `createAt`
when an outside service issues it, and its `scopes`), how to see that it works, how and how
often to rotate it, and what the portal does without it. The recipes of every module the Worker
mounts are its generated Key recipes page (`oltrem docs`), and its `secrets.required` must name
exactly them (`oltrem doctor`, CF-SEC-02), so wrangler refuses a deploy with one missing. A
provider's own key is not a Worker secret: it is pasted on the portal, stored sealed, and its
recipe is on the provider's definition.

## Schemas

A route's schema is any object that implements the
[Standard Schema](https://standardschema.dev) interface, so a module may use zod, valibot or
arktype and the pipeline needs none of them. `validate(schema, value)` runs one and returns the
output or its issues.

## The event envelope

Every queue message is one shape, `{ type, v, payload, idempotencyKey }` (plan 9.1). A new
event is a new `type`, never a new queue. The consumer dispatches on `type` to the module that
declares it; the outbox keeps the row until it is handled.

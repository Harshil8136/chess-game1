---
title: "@oltrem/core-module: Defining a module and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-module/src; split from packages/core-module/README.md]
---

# @oltrem/core-module: Defining a module and more

> Part of [the @oltrem/core-module README](../README.md).

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
      title: 'Send the digest', // optional: its name on the Scheduled jobs page
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
| A health check is `<module>.<name>`, declared once, with a lane of lower-case letters, digits and dashes, a summary, a `run` and, when given, an `every` of a count and a unit                     | `KIT-E-1006`               |
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

`company: true` holds a route to the company itself: the capability counts only where it is held at
the root, never at a place below it. It is for a route that reads or changes what belongs to the
whole company: the audit log, settings and modules, providers and their keys, a backup, the
customers' sign-in services.

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

A module's `hooks` are addresses an outside service posts to, such as a provider's delivery reports,
or a link a person opens, such as a shared file (`method: 'GET'`; `POST` by default), mounted by
`@oltrem/core-http` at `/hooks/<module><path>` before the Access identity is read. The handler gets
the body exactly as it arrived (`HookContext.body`), the path's parameters and no session; it is the
only check, so it verifies the caller by a signature or a secret in the address. A hook with `body:
'bytes'` (the files module's file requests) gets its body unread and an empty `body`, and reads
`request` itself under its own limit, which it checks from the declared length before it reads.

## Jobs

A module's periodic work is declared as `jobs`, each with a stable id, an interval and a summary;
the one tick (`@oltrem/core-jobs`) runs them when due under a lease and records each outcome.
`everySeconds(every)` is the parser both share. The `scheduled` hook stays for a module that
needs the raw tick; work that should be seen, counted and retried is a job.

A job that mostly finds nothing to do declares `idle`, a slower pace longer than `every`, and its
`run` answers `'idle'` (`JobAnswer`) when nothing waits: the tick then runs it at that pace.
`wakeJobs(db, ids)` makes sleeping jobs due now, and `wakeJobsStatement(db, ids)` is the same
write for a batch, so the change that gives a job work wakes it in one transaction. Both live
here, not in `@oltrem/core-jobs`, so a module wakes a job without depending on the scheduler; the
table is the scheduler's (`oltrem_jobs`). `@oltrem/core-jobs`' README has the reasons.

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
under, a summary, a `run` that answers `ok`, `warn` or `fail` with a few words and, optionally,
`every`: how often it runs (fifteen minutes when left out). The health job (`@oltrem/core-health`)
runs every mounted module's checks on the tick, each at its own pace, keeps the last result per
check and opens a problem after two failures in a row.

## Home

A module's card on Home is declared as `home`: a title, one of the module's own capabilities,
and a `read` that answers one short figure (`value`), an optional line under it (`note`) and a
state, `ok`, `attention`, `failing` or `unknown`, or `off` for work someone switched off on the
Features page (a quiet "Off" on Home, never a warning, and left out of the band's count).
`defineModule` adds the route
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

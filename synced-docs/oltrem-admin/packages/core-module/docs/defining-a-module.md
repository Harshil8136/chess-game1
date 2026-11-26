---
title: "@oltrem/core-module: defining a module"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-module/src/module.ts]
---

# @oltrem/core-module: defining a module

> Part of [the @oltrem/core-module README](../README.md).

## Defining a module

```ts
import { defineModule } from '@oltrem/core-module';

export const notes = defineModule({
  id: 'notes',
  version: '1.0.0',
  bitPlane: 7, // given once by the registry
  capabilities: [
    { id: 'notes.read', class: 'read', label: { en: 'See notes' } },
    { id: 'notes.write', class: 'operate', label: { en: 'Write notes' }, freshSignIn: true },
  ],
  api: [{ method: 'POST', path: '/', capability: 'notes.write', schema: NoteInput, summary: 'Create a note',
          handler: async ({ input, identity, env }) => Response.json(await create(env, identity, input), { status: 201 }) }],
  eventTypes: ['notes.created'], onEvent: async (event, env) => {},
  jobs: [{ id: 'notes.digest', every: '1h', summary: 'Send the hourly digest', title: 'Send the digest', run: async (env) => {} }],
  flows: [{ id: 'notes.export', summary: 'Export every note', schedule: '0 4 * * *', run: async ({ step, env }) => {} }],
  health: [{ id: 'notes.store', lane: 'storage', summary: 'The notes table answers', run: async (env) => ({ status: 'ok' }) }],
  migrations: ['0012_notes.sql'],      // in the module's migrations/ folder
  settings: [notesPerPage],            // defineSetting, keys under `notes.`
  errors: NOTES_ERRORS,                // defineErrors('notes', ...)
  secrets: [{ name: 'NOTES_KEY', purpose, create, scopes: [], test, rotate, without }],
  home: { title: 'Notes', capability: 'notes.read', read: async (env) => ({ value: '12', note: '3 today', state: 'ok' }) },
  scheduled: async (controller, env) => {}, // the raw tick, rarely needed
});
```

## What the contract refuses

| Rule | Code |
|---|---|
| The id is `[a-z][a-z0-9-]*`; the version `x.y.z` | `KIT-E-1006` |
| A route path starts with `/` and has a summary; an `action` (its audit verb) is lower case, digits and dashes | `KIT-E-1006` |
| Every route names a capability `<module>.<name>` of its own module | `KIT-E-1001`, `KIT-E-1006` |
| A POST, PUT or PATCH route has a body schema | `KIT-E-1002` |
| An `access: 'identity'` route is POST and names no capability | `KIT-E-1006` |
| Capabilities and a whole-number bit plane come together | `KIT-E-1006` |
| A capability is `<module>.<name>`, declared once, with a class, an English label and a known floor | `KIT-E-1006` |
| A module that declares capabilities names every route's among them, `<module>.self` apart | `KIT-E-1006` |
| No two routes share a method and path | `KIT-E-1005` |
| A public hook's path is `/` and segments of letters, digits, `_`, `-` or `:params`, with a summary and handler, declared once | `KIT-E-1006`, `KIT-E-1005` |
| Event types carry the module's prefix and come with `onEvent` | `KIT-E-1006` |
| A job is `<module>.<name>`, once, with a summary, `run` and an interval (`15m`, `6h`, `1d`) | `KIT-E-1006` |
| A flow is `<module>.<name>`, once, with a summary, `run` and, when scheduled, five cron fields | `KIT-E-1006` |
| A health check is `<module>.<name>`, once, with a lane, a summary, `run` and an optional `every` | `KIT-E-1006` |
| A migration is `NNNN_name.sql`, declared once | `KIT-E-1006` |
| Settings' keys and errors' definitions name the module | `KIT-E-1006` |
| A key recipe names its secret once in upper snake case, with purpose, create, test, rotate and without; `createAt` is https; `scopes` a list | `KIT-E-1006` |

The manifest is frozen once defined. `RouteContext` gives a handler the request, bindings, the
door's identity (email, subject, sign-in time, audience), the session (or none in own-account
mode), the validated input, path parameters, request id and `waitUntil`.

- **`access`** is `session` by default. `access: 'identity'` opens a POST route to any identity
  the door asserted, for a person with no account yet (accepting an invitation): no session, no
  capability, but the body is validated and same-origin applies. It is the one way past the check,
  written where a reviewer reads it.
- **`company: true`** counts the capability only where held at the root: for what belongs to the
  whole company (the audit log, settings and modules, providers, backups, customer sign-in).

## Capabilities

`bitPlane` and `capabilities` (id, class `read`, `operate` or `admin`, label, and `floor`,
`freshSignIn`, `secondPerson`) are data on the manifest. `@oltrem/iam` registers them at start
under a version it has not seen, so a change bumps the version; a client's `oltrem docs --check`
refuses a change under the same version. A module may declare none in an own-account client.
`<module>.self` is held by every account, for routes about one's own things.

## Public hooks

`hooks` are addresses an outside service posts to, or a link a person opens (`method: 'GET'`;
`POST` by default), mounted at `/hooks/<module><path>` before the Access identity is read. The
handler gets the body as it arrived (`HookContext.body`), path parameters and no session, so it
verifies the caller itself (a signature or a secret in the address). With `body: 'bytes'` it gets
the body unread and reads `request` under its own limit, checking the declared length first.

## Jobs, flows, health

- **Jobs:** an id, an interval and a summary; the tick (`@oltrem/core-jobs`) runs each when due
  under a lease and records the outcome (`everySeconds` parses both). A job that mostly finds
  nothing declares a slower `idle` and answers `'idle'` (`JobAnswer`). `wakeJobs(db, ids)` and
  `wakeJobsStatement` (for a batch) make sleeping jobs due now, here so a module needs no scheduler
  dependency; the table is `oltrem_jobs`.
- **Flows:** work too long for the tick, with a `schedule` of five UTC cron fields (`isCron`) or
  started by `startFlow`; the client's one Workflow runs it (`createFlows`). Each
  `step.do(name, callback)` retries alone and keeps its result; code outside a step runs again on
  resume; `step.sleep` costs no CPU.
- **Health:** an id, a lane, a summary, `run` answering `ok`, `warn` or `fail`, and `every` (15
  minutes, `CHECK_EVERY`). `@oltrem/core-health` runs them on the tick, keeps the last result and
  opens a problem after two failures in a row.

## Home and search

**`home`**: a title, a capability and a `read` answering `value`, an optional `note` and a state
(`ok`, `attention`, `failing`, `unknown`, or `off` for work switched off: a quiet "Off", not
counted). It adds `GET /api/<module>/home` under that capability; a module with its own `GET /home`
is refused (`KIT-E-1005`).

**`search`**: a title, a capability and `find(words, ctx)` answering hits (title, optional note, a
portal page). It adds `GET /api/<module>/search?q=`: under two letters finds nothing, a hit outside
the portal is dropped, at most `SEARCH_HITS` (8). `find` reads the session from `ctx`, so it answers
only what the person may see; `containing(words)` is the escaped `LIKE` pattern.

```ts
search: { title: 'Notes', capability: 'notes.read',
  find: async (words, ctx) => (await notesFor(ctx, containing(words))).map((n) => ({ title: n.title, href: `/notes/${n.id}` })) },
```

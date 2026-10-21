# @oltrem/core-module

The module contract of the kit (plan section 4.3): one manifest per feature, checked when it is
defined so a bad one fails the build. So far: the id and the version, the capabilities on their
bit plane, the API routes with their capability and schema, the event types a module handles, its
jobs, its health checks, the migrations it ships, the settings and errors it owns, and the
scheduled hook. Pages, i18n and docs join the manifest with the rest of the module system
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
      handler: async ({ input, identity, env }) => Response.json(await create(env, identity, input), { status: 201 }),
    },
  ],
  eventTypes: ['notes.created'],
  onEvent: async (event, env) => { /* fan out */ },
  jobs: [{ id: 'notes.digest', every: '1h', summary: 'Send the hourly digest', run: async (env) => { /* ... */ } }],
  health: [{ id: 'notes.store', lane: 'storage', summary: 'The notes table answers', run: async (env) => ({ status: 'ok' }) }],
  migrations: ['0012_notes.sql'], // shipped in the module's migrations/ folder
  settings: [notesPerPage], // defined with defineSetting, under the key prefix `notes.`
  errors: NOTES_ERRORS, // defined with defineErrors('notes', ...)
  secrets: [{ name: 'NOTES_KEY', purpose: '...', create: '...', scopes: [], test: '...', rotate: '...', without: '...' }],
  scheduled: async (controller, env) => { /* the raw tick, rarely needed */ },
});
```

## What the contract refuses

| Rule | Code |
|---|---|
| The id is `[a-z][a-z0-9-]*`; the version is `x.y.z` | `KIT-E-1006` |
| A route path starts with `/` and has a summary | `KIT-E-1006` |
| Every route names a capability, `<module>.<name>`, with the module's own id | `KIT-E-1001`, `KIT-E-1006` |
| A POST, PUT or PATCH route has a schema for its body | `KIT-E-1002` |
| A route open to any identity (`access: 'identity'`) is POST and names no capability | `KIT-E-1006` |
| Capabilities come with a bit plane, a whole number, and a bit plane with capabilities | `KIT-E-1006` |
| A capability is `<module>.<name>`, declared once, with a class, a label in English and a known floor | `KIT-E-1006` |
| A module that declares capabilities names every route's capability among them, `<module>.self` apart | `KIT-E-1006` |
| No two routes share a method and a path | `KIT-E-1005` |
| A public hook's path is `/` and segments of letters, digits, `_` and `-`, or `:params`; it has a summary and a handler, and is declared once | `KIT-E-1006`, `KIT-E-1005` |
| An event type is prefixed with the module's id; event types and `onEvent` come together | `KIT-E-1006` |
| A job is `<module>.<name>`, declared once, with a summary, a `run` and an interval of a count and a unit (`15m`, `6h`, `1d`) | `KIT-E-1006` |
| A health check is `<module>.<name>`, declared once, with a lane of lower-case letters, digits and dashes, a summary and a `run` | `KIT-E-1006` |
| A migration is named `NNNN_name.sql` and declared once | `KIT-E-1006` |
| A setting's key starts with the module's id and its definition names the module; an error's definition names the module | `KIT-E-1006` |
| A key recipe names its secret once, in upper case letters, digits and `_`, with a purpose and how to create, test and rotate it and live without it; `createAt` is an https address; `scopes` is a list | `KIT-E-1006` |

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
reports: POST only, mounted by `@oltrem/core-http` at `/hooks/<module><path>` before the Access
identity is read. The handler gets the body exactly as it arrived (`HookContext.body`), the path's
parameters and no session; it is the only check, so it verifies the caller by a signature or a
secret in the address.

## Jobs

A module's periodic work is declared as `jobs`, each with a stable id, an interval and a summary;
the one tick (`@oltrem/core-jobs`) runs them when due under a lease and records each outcome.
`everySeconds(every)` is the parser both share. The `scheduled` hook stays for a module that
needs the raw tick; work that should be seen, counted and retried is a job.

## Health

A module's checks are declared as `health`, each with a stable id, a lane the page groups it
under, a summary and a `run` that answers `ok`, `warn` or `fail` with a few words. The health job
(`@oltrem/core-health`) runs every mounted module's checks on the tick, keeps the last result per
check and opens a problem after two failures in a row.

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

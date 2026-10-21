# @oltrem/core-module

The module contract of the kit (plan section 4.3): one manifest per feature, checked when it is
defined so a bad one fails the build. So far: the id and the version, the capabilities on their
bit plane, the API routes with their capability and schema, the event types a module handles, and
the scheduled hook. Pages, migrations, settings, jobs, health and docs join the manifest with the
rest of the module system (phase 3).

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
  scheduled: async (controller, env) => { /* the daily tick */ },
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
| An event type is prefixed with the module's id; event types and `onEvent` come together | `KIT-E-1006` |

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
change to the capabilities bumps the module's version. A module may declare none, in a client
that runs the own-account rule, where the owner holds every capability by name; one that declares
any names every route's capability among them, so no route checks what nobody can hold.
`<module>.self` is the one exception: every account holds it, for the routes about one's own
things.

## Schemas

A route's schema is any object that implements the
[Standard Schema](https://standardschema.dev) interface, so a module may use zod, valibot or
arktype and the pipeline needs none of them. `validate(schema, value)` runs one and returns the
output or its issues.

## The event envelope

Every queue message is one shape, `{ type, v, payload, idempotencyKey }` (plan 9.1). A new
event is a new `type`, never a new queue. The consumer dispatches on `type` to the module that
declares it; the outbox keeps the row until it is handled.

# @oltrem/core-module

The module contract of the kit (plan section 4.3): one manifest per feature, checked when it is
defined so a bad one fails the build. This is the phase 1 subset: the id, the API routes with
their capability and schema, the event types a module handles, and the scheduled hook.
Capabilities, pages, migrations, settings, jobs, health and docs join the manifest with the
module system in phase 3.

## Defining a module

```ts
import { defineModule } from '@oltrem/core-module';

export const notes = defineModule({
  id: 'notes',
  version: '1.0.0',
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
| No two routes share a method and a path | `KIT-E-1005` |
| An event type is prefixed with the module's id; event types and `onEvent` come together | `KIT-E-1006` |

The manifest is frozen once defined. `RouteContext` gives a handler the request, the bindings,
the identity the door asserted, the validated input, the path parameters, the request id and
`waitUntil`.

## Schemas

A route's schema is any object that implements the
[Standard Schema](https://standardschema.dev) interface, so a module may use zod, valibot or
arktype and the pipeline needs none of them. `validate(schema, value)` runs one and returns the
output or its issues.

## The event envelope

Every queue message is one shape, `{ type, v, payload, idempotencyKey }` (plan 9.1). A new
event is a new `type`, never a new queue. The consumer dispatches on `type` to the module that
declares it; the outbox keeps the row until it is handled.

# @oltrem/core-config

The configuration layers of the kit, as the plan's section 5 describes them, and the one
registry every setting is defined in. Everything about a setting is data: the Settings page,
the seed, the snapshot validator, the JSON Schema and the reference page render from the same
definition.

## The four layers

| Layer | Set by | Lives in | Changes |
|---|---|---|---|
| L0 kit defaults | the kit, in `defineSetting` | the code | with a kit release |
| L1 client file | the vendor, at onboarding | the client repository, bundled into the Worker | with a deploy |
| L2 system settings | the client's admins | D1 (`oltrem_settings`, the truth), one KV snapshot, the Worker's memory | live |
| L3 secrets | the vendor or the owner | Worker secrets, never in a config object | without a deploy |

L2 overrides L1 overrides L0. A `client`-layer key is **locked**: a value for it in D1 is
ignored and reported, so no live edit can take a portal down. Secrets are never merged into
configuration: a setting says *which* provider, never its key.

## The read path

```mermaid
flowchart LR
  R["request: config.ensure(ctx.waitUntil)"] --> M{"memory"}
  M -- "fresh" --> V["config.get(key): no I/O"]
  M -- "stale" --> V
  M -- "stale" -.->|after the response| KV["KV: one snapshot key"]
  M -- "cold" --> KV
  KV -- "missing" --> D1["D1: oltrem_settings (truth)"]
  D1 --> KV
  S["config.save(...)"] --> D1
  S --> KV
  S --> M
```

Reads never leave memory while the snapshot is fresh (one minute by default). A stale snapshot
is served as it is and refreshed after the response. A cold Worker reads KV once; a KV miss
rebuilds the snapshot from D1 and fills KV. A failed read keeps the last good copy, or the kit
and client defaults when there is none, and reports one event; nothing throws on the hot path.
A save writes D1 (the row, its history row, the version bump, in one transaction), rebuilds
the snapshot, writes KV once and updates the saving instance, so the admin who saved sees the
value at once; `ensureVersion` lets a request that carries a newer version catch up from D1.

## Using it

```ts
import * as z from 'zod/mini';
import { createConfig, defineSetting, settings } from '@oltrem/core-config';

defineSetting({
  key: 'email.daily_limit',
  title: 'Daily email limit',
  description: 'Hard cap on emails sent per UTC day. 0 disables sending.',
  schema: z.number().check(z.int(), z.minimum(0), z.maximum(10_000)),
  default: 500,
  layer: 'system',
  editableBy: 'owner',
  takesEffect: 'immediately',
  module: 'email',
});

const config = createConfig({ registry: settings, client: clientFile, db: env.DB, cache: env.CACHE });
// per request:
await config.ensure(ctx.waitUntil.bind(ctx));
const limit = config.get<number>('email.daily_limit');
```

A definition is refused at once when its key is not `module.name`, when its module does not
match the key, when its default fails its own schema, or when the key already exists.

## Storage this package owns

Migration `0001_settings.sql`: `oltrem_meta` (the configuration version and, later, the client
id), `oltrem_settings` and `oltrem_settings_history`. Additive and idempotent; the ledger is
`oltrem_migrations`.

## Tests

`pnpm test:packages` runs the suite inside the Workers runtime with the bindings of
`wrangler.jsonc` (local, in-memory) and the migration applied first. The tests prove the
precedence and the locks, the refusals, the no-I/O hot path, the stale-then-refresh behaviour,
the fallbacks when KV or D1 fail, and read-your-writes.

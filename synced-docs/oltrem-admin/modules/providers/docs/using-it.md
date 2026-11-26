---
title: "@oltrem/providers: Using it"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/providers/src; split from modules/providers/README.md]
---

# @oltrem/providers: Using it

> Part of [the @oltrem/providers README](../README.md).

## Using it

```ts
import { createApp } from '@oltrem/core-http';
import { createIam } from '@oltrem/iam';
import { createProviders } from '@oltrem/providers';

const bindings = (env: Env) => ({ kv: env.CACHE, db: env.DB });
const iam = createIam<Env>({ bindings, audience: (env) => env.ACCESS_AUD });
const providers = createProviders<Env>({ bindings, sessions: iam.sessions, kek: (env) => env.KEK });
const app = createApp<Env>({
  modules: [iam.module, providers.module],
  startup: iam.startup,
  session: iam.sessions.hook,
  authorize: iam.sessions.authorize,
});
```

`createProviders` returns the `registry` and the module manifest. It stands on the IAM module:
the same sessions and authorizer, the same audit wrapper. `kek` reads the `KEK` secret from the
request's env; the envelope is built from it once per isolate, on the first request that needs
it, so a Worker without the secret answers `KIT-E-1301` only when a credential is stored or read.
The manifest carries the secret's key recipe, `KEK_RECIPE`: how to make the key with one Node
command and keep it, how to test it, the rotation through `POST /keys/rewrap`, and what stops
without it. A Worker that mounts the module therefore lists `KEK` in `secrets.required`
(`oltrem doctor`, CF-SEC-02), and its generated Key recipes page shows the recipe.

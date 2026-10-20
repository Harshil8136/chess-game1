# @oltrem/core-http

The one request pipeline of a client Worker (plan section 4.2 and 11), built on Hono: request
ids, security headers, the identity the Access door asserted, the session hook, the module routes
with their capability and schema checks, one problem shape for every error, and the three Worker
handlers (`fetch`, `scheduled`, `queue`) from one place.

## The pipeline

```mermaid
flowchart LR
  R["request"] --> I["request id"] --> H["security headers"] --> Z{"/healthz?"}
  Z -- "yes" --> OK["200, the module ids"]
  Z -- "no, /api/*" --> N["no-store, same-origin check (CSRF)"] --> D["identity from the Access headers"]
  D -- "missing or unreadable" --> P401["problem 401"]
  D --> SE["session hook, when one is given"]
  SE -- "throws" --> PS["problem with its code"]
  SE --> C{"authorize(identity, capability, env, session)"}
  C -- "no" --> P403["problem 403"]
  C -- "throws" --> PS
  C -- "yes" --> S["schema: body for POST/PUT/PATCH, query for GET/DELETE"]
  S -- "issues" --> P422["problem 422 with the fields"]
  S --> M["the module's handler"]
  M -- "throws" --> PB["problem with the error's code; 5xx reported"]
```

Every mutation needs same-origin proof (an `Origin` or `Sec-Fetch-Site` header that matches);
a bare cross-site POST is refused with `KIT-E-0440`. Every response carries `x-request-id`,
`X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: same-origin` and a content security policy
that allows framing by the same origin only. Routes mount at `/api/<module id><path>`.

## Using it

```ts
import { createApp, createWorker } from '@oltrem/core-http';

const sessions = createSessions({ bindings: (env) => ({ kv: env.CACHE, db: env.DB }) }); // @oltrem/iam

const app = createApp({
  modules: [notes, settings],
  session: sessions.hook,
  authorize: sessions.authorize,
  report: (error, requestId) => sentry(error, requestId),
});

export default createWorker({
  app,
  modules: [notes, settings],
  onHandled: (event, env) => outbox(env).complete(event.idempotencyKey),
  report: (error, context) => sentry(error, context),
});
```

`session` and `authorize` are the two places the permission model plugs in. The session hook
runs once per request after the identity is read and before the capability check; whatever it
returns reaches the authorizer as its fourth argument and the handler as `ctx.session`. Either may
throw a `KitError` to answer with a reason of its own. The IAM module provides both
(`createSessions` in `@oltrem/iam`); without the module a client uses the own-account authorizer
and no hook: the one owner email holds every capability and `ctx.session` is `undefined`.

The identity comes from the headers Cloudflare Access adds: the email, and the token whose claims
(`sub`, `iat`, `aud`) become `subject`, `signedInAt` and `audience`. Access verified the person at
the edge, so the Worker does no crypto in the request (plan 11): the claims are decoded, not
verified, and a token that does not parse or lacks a subject or a sign-in time is no identity at
all. The IAM module checks the audience.

## The three handlers

| Handler | What it does |
|---|---|
| `fetch` | the pipeline above |
| `scheduled` | runs every module's `scheduled` hook on the one cron; an error in one is reported and the others still run |
| `queue` | reads each message as an envelope, dispatches on `type` to the module that declares it, calls `onHandled` (the outbox marks its row done), acknowledges; a handler that throws retries the message; an unknown type is reported and retried, so it reaches the dead-letter queue |

Tests run inside the Workers runtime with a sample module that has one route of each shape, and
a second module that echoes what the session hook returned.

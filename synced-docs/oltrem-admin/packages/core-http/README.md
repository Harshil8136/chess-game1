# @oltrem/core-http

The one request pipeline of a client Worker (plan section 4.2 and 11), built on Hono: request
ids, security headers, the identity the Access door asserted, the startup hook once per isolate,
the session hook, the module routes with their capability and schema checks, one problem shape for
every error, and the three Worker handlers (`fetch`, `scheduled`, `queue`) from one place.

## The pipeline

```mermaid
flowchart LR
  R["request"] --> I["request id"] --> H["security headers"] --> Z{"/healthz?"}
  Z -- "yes" --> OK["200, the module ids"]
  Z -- "no, /api/*" --> N["no-store, same-origin check (CSRF)"] --> D["identity from the Access headers"]
  D -- "missing or unreadable" --> P401["problem 401"]
  D --> U["startup hook, once per isolate"] --> A{"route open to any identity?"}
  U -- "throws" --> PB
  A -- "yes" --> S
  A -- "no" --> SE["session hook, when one is given"]
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

const iam = createIam({ bindings: (env) => ({ kv: env.CACHE, db: env.DB }) }); // @oltrem/iam
const modules = [iam.module, notes, settings];
const scheduler = createScheduler({ bindings: (env) => ({ db: env.DB }), modules }); // @oltrem/core-jobs

const app = createApp({
  modules,
  startup: iam.startup,
  session: iam.sessions.hook,
  authorize: iam.sessions.authorize,
  report: (error, requestId) => sentry(error, requestId),
});

export default createWorker({
  app,
  modules,
  tick: scheduler.tick,
  onHandled: (event, env) => outbox(env).complete(event.idempotencyKey),
  report: (error, context) => sentry(error, context),
});
```

A route the module marked `access: 'identity'` (`@oltrem/core-module`) skips the session hook
and the capability check: the door's identity is enough, for a person who has no account yet.
Its body is still validated and the same-origin check still applies; the handler sees
`ctx.session` as `undefined`.

A module's public hooks (`hooks` in `@oltrem/core-module`) are mounted at
`POST /hooks/<module><path>` before the identity is read, so an outside service such as an email
provider can post its reports with no sign-in. The body is read once, as text, at most
`HOOK_BODY_MAX` (512 KiB), and handed to the handler with the path's parameters; the answer is
`no-store`, and a `KitError` the handler throws is a problem response like any other. No session,
capability or same-origin check runs, so the handler checks the caller itself. The client's Access
door must let `/hooks/` through: a self-hosted Access application on that path with a Bypass
policy, on a custom domain or a `workers.dev` address alike (a path rule wins over the door that
protects every Worker); `oltrem deploy` prints the step.

`startup` runs once per isolate, on the first request that passed the door and before its session
hook, with the mounted modules: the IAM module's `startup` registers the capabilities they declare.
Requests that arrive while it runs wait on the same run; when it fails, that request is answered
with the error, reported as every 5xx is, and the next request runs it again. `/healthz` and a
request without an identity never start it.

`session` and `authorize` are the two places the permission model plugs in. The session hook
runs once per request after the identity is read and before the capability check; whatever it
returns reaches the authorizer as its fourth argument and the handler as `ctx.session`. Either may
throw a `KitError` to answer with a reason of its own. The IAM module provides both, with the
startup hook (`createIam` in `@oltrem/iam`); without the module a client uses the own-account authorizer
and no hook: the one owner email holds every capability and `ctx.session` is `undefined`.

The identity comes from the headers Cloudflare Access adds: the email, and the token whose claims
(`sub`, `iat`, `aud`) become `subject`, `signedInAt` and `audience`. Access verified the person at
the edge, so the Worker does no crypto in the request (plan 11): the claims are decoded, not
verified, and a token that does not parse or lacks a subject or a sign-in time is no identity at
all. The IAM module checks the audience.

When Access stands on the Worker itself (the dashboard's "Protect all Workers"), the runtime hands
the Worker `ctx.access`, with the application's `aud` and `getIdentity()`. The identity is then read
by `readWorkerAccessIdentity`: a token naming that `aud`, or, with no token, a `getIdentity()` that
gives an email, a subject and a sign-in time, carries `door: 'worker'`, which the audience `worker`
requires, so nothing is copied from the dashboard into a secret. A token for another application
(a hostname application in front) stays unmarked, for that application's own tag.

## The local door

On the owner's computer there is no Cloudflare Access in front of the Worker, so `createApp`
takes a stand-in: `localDoor: { enabled(env), page? }`. It opens only when both locks hold:
`enabled(env)` is true (the client template passes `!env.ACCESS_AUD`, which is unset on a
computer and a required secret once deployed) and the request's host is `localhost`, `127.0.0.1`
or `[::1]`. A tunnel or a deployed address is never loopback, so there it answers 404 and its
cookie is no identity.

| Route | What it does |
|---|---|
| `GET /local/sign-in?next=` | the sign-in page: `page(state)` when given, a plain one otherwise |
| `POST /local/sign-in` | takes `email` (and `next`), sets the `oltrem_local` cookie (HttpOnly, SameSite=Strict, the email and when) and answers 303 to `next` |
| `POST /local/sign-out` | clears the cookie, then 303 to the sign-in page |

The identity read from the cookie carries `door: 'local'` and no audience, which the IAM
module's audience check accepts only for this door. A page request with no identity is sent to
the sign-in page; an API request still gets the 401 problem. Both forms carry the same-origin
check. Access's own headers, when present, always win.

`publicRoutes(app)`, when given, is called before anything else is mounted: routes that answer
before the door, such as the screens' stylesheet.

## The three handlers

| Handler | What it does |
|---|---|
| `fetch` | the pipeline above |
| `scheduled` | runs the `tick` it was given (the jobs' scheduler of `@oltrem/core-jobs`), then every module's `scheduled` hook, on the one cron; an error in one is reported and the others still run |
| `queue` | reads each message as an envelope, dispatches on `type` to the module that declares it, calls `onHandled` (the outbox marks its row done), acknowledges; a handler that throws retries the message; an unknown type is reported and retried, so it reaches the dead-letter queue |

Tests run inside the Workers runtime with a sample module that has one route of each shape, and
a second module that echoes what the session hook returned.

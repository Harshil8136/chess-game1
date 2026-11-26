---
title: "@oltrem/core-http: Using it; The local door; The three handlers"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-http/src; split from packages/core-http/README.md]
---

# @oltrem/core-http: Using it; The local door; The three handlers

> Part of [the @oltrem/core-http README](../README.md).

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

A route with `body: 'bytes'` (an upload) is not read as JSON: its schema checks the query, and
the handler reads the content from `ctx.request` as a stream.

A module's public hooks (`hooks` in `@oltrem/core-module`) are mounted at `POST
/hooks/<module><path>` (or `GET`, for a link a person opens, such as a shared file) before the
identity is read, so an outside service such as an email provider can post its reports with no
sign-in. The body is read once, as text, at most `HOOK_BODY_MAX` (512 KiB): through `readCapped`, so
a body sent in pieces without a declared length is still refused at the first byte past it rather
than read whole. A hook declared with `body: 'bytes'` is the exception: its body is left unread for
the handler, which holds it to its own limit, and the log counts it by its declared length. It is
handed to the handler with the path's parameters; the answer is `no-store`, except a successful
answer to a GET that asks to be kept for ever (`immutable`), as a script whose address changes with
any byte of it does (Oltrem Mail's reader), and a `KitError` the handler throws is a problem
response like any other. No session, capability or same-origin check runs, so the handler checks the
caller itself. The client's Access door must let `/hooks/` through: a self-hosted Access application
on that path with a Bypass policy, on a custom domain or a `workers.dev` address alike (a path rule
wins over the door that protects every Worker); `oltrem deploy` prints the step.

**Every hook call is told**. With `onHook` given, each call that reached a hook is handed over once
it answered or threw, as a `HookCall` (`@oltrem/core-module`): the module, the method, the route as
declared (`/hooks/connect/calendar/:token`, never the address, which may hold a secret), the status
and outcome, the time taken, the bytes in and out, the caller's address, country and browser, and
the facts the handler noted with `ctx.note` (whose link, how many rows; never a body). A hook that
throws goes to `report`. The client template passes `createHookAudit` (`@oltrem/core-audit`), so
every webhook, delivery report and link another app reads is a row in the audit log.

**A hook rests before a limit runs out**. Since September 2026 Cloudflare's free plan refuses every
D1 query for the rest of the UTC day once the day's rows read or written run out, which would stop
the whole portal. With `shed` given, a hook call while it returns a reason answers 503 `KIT-E-0503`
with that reason, `Retry-After` until midnight UTC (at least 60 seconds) and `no-store`, before its
body is read; the client template passes `health.shed` (`@oltrem/core-health`). With `limiter` given
(the template's `LIMITS` rate-limit binding, 60 calls a minute), each module's hooks are limited per
caller's address: past it, 429 `KIT-E-0429` with `Retry-After: 60`. A call with no address, or a
binding that fails, is let in. Both are told to `onHook` like any answer.

**One figure per request**. With `metrics` given (the template's `METRICS` Analytics Engine dataset,
`oltrem_requests`), every answer writes one data point: the route as declared (`other` when none
matched, so an address that holds a secret is never written), the method and the status as blobs,
the time taken and the status as doubles, and the first part of the path as the index. A write that
fails is ignored. Free: 100,000 points a day. A call that names an API key adds two blobs, the key's
subject (`key:<id>`, read from the header whether or not the key is let in, so refused calls count)
and the caller's address; for a key's call the route is the module route it ran. Nothing else writes
them.

**API keys**. With `keys` given (`iam.keys.verify` in the template), another system calls the API at
`/hooks/api/<module><path>` (`KEY_PATH`), the path the door already leaves open, with
`Authorization: Bearer okey_…`. The key's service account is the identity (`door: 'key'`), and the
call runs the route `/api/<module><path>` declares, with its session hook, capability check, schema
and audit like any call a person makes; no same-origin check runs, as nothing a browser holds is
sent. A missing, wrong, ended or revoked key is refused 401 (`KIT-E-0401`), a switched-off module or
an unknown route 404; `shed` and `limiter` apply as for a hook, the limiter per key
(`api|<subject>`). The answer is `no-store`. A module may not take the id `api`. Since 2026-11-25
`keys` is also given the call (`address` from `cf-connecting-ip`, `method`, and `area`, the module
id after `KEY_PATH`) and may answer a `weight`, how many of the limiter's calls one call counts (a
slower key's pace); a `KitError` it throws (a key that works but may not make this call) is the
answer as it is, a 403 with its detail and no `Retry-After`.

Every answer carries `frame-ancestors 'self'` in its content security policy, added to the
policy the handler set when it set one: a file served for download keeps its sandbox.

`startup` runs once per isolate, on the first request that passed the door and before its session
hook, with the mounted modules: the IAM module's `startup` registers the capabilities they declare.
Requests that arrive while it runs wait on the same run; when it fails, that request is answered
with the error, reported as every 5xx is, and the next request runs it again. `/healthz` and a
request without an identity never start it. A hook may carry `prepare(modules)`, the part that
reads nothing: `createApp` runs it once while the Worker loads, which the Free plan does not count
against a request's CPU, and leaves a fault in it for the hook to meet on the first request.

`session` and `authorize` are the two places the permission model plugs in. The session hook
runs once per request after the identity is read and before the capability check; whatever it
returns reaches the authorizer as its fourth argument and the handler as `ctx.session`; the fifth
is `company` on a route held to the company itself (`company: true`), and a refusal there says
"for the whole company". It is
given the request's `executionCtx` when the request came with one: the calls a screen makes to the
API inside one page share it, so the hook may keep what it read for the rest of them. Either may
throw a `KitError` to answer with a reason of its own. The IAM module provides both, with the
startup hook (`createIam` in `@oltrem/iam`); without the module a client uses the own-account authorizer
and no hook: the one owner email holds every capability and `ctx.session` is `undefined`.

The identity comes only from the runtime. When Cloudflare Access authenticates a request that
invokes the Worker (Access on the Worker itself, the account's "Protect all Workers", or a
hostname's Access application in front of it), the runtime hands the Worker `ctx.access`: the
application's `aud` and `getIdentity()`, the signed-in person. `readAccessIdentity(ctx.access)`
turns that into the identity: the email, `user_uuid` as `subject`, `iat` as `signedInAt`,
`audience: [aud]` and `door: 'worker'`; a record without an email, a subject or a sign-in time
(a service token's) is no identity. It is read once per request, so the screens' calls inside
the same request reuse it. The IAM module checks the audience: `worker` accepts any application
the runtime names, a tag only that application.

Request headers are never read for the identity, Access's own `cf-access-*` headers included:
anyone can send a header, and a request that did not come through Access has no `ctx.access`, so
it gets the 401 problem whatever headers it carries. Cloudflare's documentation ("Cloudflare
Access" under Workers, configuration) names the limits: `ctx.access` is not passed through a
service binding, and a Worker with static assets does not get it. A client's Worker has neither:
nothing reaches it through a binding, and its stylesheet is a route, not a static asset.

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
check. Access's own record, when the runtime gives one, always wins.

`publicRoutes(app)`, when given, is called before anything else is mounted: routes that answer
before the door, such as the screens' stylesheet.

## The three handlers

| Handler | What it does |
|---|---|
| `fetch` | the pipeline above |
| `scheduled` | runs the `tick` it was given (the jobs' scheduler of `@oltrem/core-jobs`), then every module's `scheduled` hook, on the one cron; an error in one is reported and the others still run |
| `queue` | reads each message as an envelope, dispatches on `type` to the module that declares it, calls `onHandled` (the outbox marks its row done), acknowledges; a handler that throws retries the message; an unknown type is reported and retried, so it reaches the dead-letter queue; each retry waits (`retryDelay`: 30 seconds, doubling, an hour at most), so five tries span about a quarter of an hour |

With `off` (the parts switched off, `@oltrem/core-config`), read once per request before the
hooks: a switched-off module's `/api/<id>/` and `/hooks/<id>/` answer Not found (`KIT-E-0404`),
`/healthz` leaves it out, and the set rides on the request as the `partsOff` variable, which the
screens read. Given the same `off`, the Worker skips that module's `scheduled` hook and
acknowledges its events without calling `onEvent` or `onHandled`, so the outbox keeps the row and
sends it again until the module is back on (`test/parts.test.ts`).

Tests run inside the Workers runtime with a sample module that has one route of each shape, and
a second module that echoes what the session hook returned.
The inner call has its own tests (`test/inner.test.ts`): a page past the door is answered in
process with one pass through the pipeline and the session hook still run; without the
capability the inner call is refused with the same 403; a session hook that refuses, a bad input
(422), a module switched off and an unknown path (404) answer as on a request; a change and a
refusal made through it are told to `onChange`; with no identity, or to another origin, the call
goes through the whole pipeline.

---
title: "@oltrem/core-http: using it, hooks, API keys, identity, the local door, the handlers"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-http/src/app.ts, identity.ts, local-door.ts, worker.ts, test]
---

# @oltrem/core-http: using it, hooks, API keys, identity, the local door, the handlers

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

- **`access: 'identity'`** routes skip the session hook and capability: the door's identity is
  enough (a person with no account yet); body and same-origin still checked; `ctx.session` is
  `undefined`.
- **`body: 'bytes'`** routes are not read as JSON: the schema checks the query, the handler streams
  `ctx.request`.
- **`publicRoutes(app)`** is mounted first, for routes before the door (the stylesheet).

## Public hooks

A module's `hooks` mount at `/hooks/<module><path>` (POST, or GET for a link a person opens)
before the identity is read; the client's Access needs a Bypass application on `/hooks/`
(`oltrem deploy` prints it). The body is read once as text up to `HOOK_BODY_MAX` (512 KiB) through
`readCapped`, unless the hook says `body: 'bytes'` and holds its own limit. No session, capability
or same-origin check runs: the handler checks the caller. Answers are `no-store`, except a
successful GET asking `immutable`; a thrown `KitError` is a problem.

| Option | What it does |
|---|---|
| `onHook` | Each call as a `HookCall`: module, method, route as declared (never the address), status, outcome, time, bytes, address, country, browser, and `ctx.note` facts; the template passes `createHookAudit` |
| `shed` | While it returns a reason (the template's `health.shed`), 503 `KIT-E-0503` with `Retry-After` to midnight UTC (60 s at least), before the body is read |
| `limiter` | The `LIMITS` binding, `KEY_CALLS_A_MINUTE` (60) per module per address: past it 429 `KIT-E-0429`, `Retry-After: 60`; no address or a failing binding lets the call in |
| `metrics` | The `METRICS` Analytics Engine dataset (`oltrem_requests`): one point per answer, blobs route as declared (`other` when none), method, status; doubles time and status; the path's first part as index; a key's call adds the key's subject and the address. Failed writes ignored |

## API keys

With `keys` (`iam.keys.verify`), another system calls `/hooks/api/<module><path>` (`KEY_PATH`)
with `Authorization: Bearer okey_…`. The key's service account is the identity (`door: 'key'`) and
the call runs the route `/api/<module><path>` with session hook, capability, schema and audit; no
same-origin check. A missing, wrong, ended or revoked key is 401 `KIT-E-0401`; a part off or
unknown route 404; `shed` and `limiter` apply (per key, `api|<subject>`). `keys` gets the call
(`address`, `method`, `area`) and may answer a `weight` (one call counting as several), or throw a
`KitError` (a 403 with its detail). A module may not take the id `api`.

## Startup, session and identity

- **`startup`** runs once per isolate on the first request past the door, before its session hook
  (IAM registers capabilities there); others wait on the same run; a failure answers that request
  and the next runs it again; `/healthz` and identity-less requests never start it. A hook's
  `prepare(modules)` runs at load, outside a request's CPU.
- **`session` and `authorize`** plug in the permission model: the session hook runs after the
  identity, gets the request's `executionCtx` (so a page's inner calls share what it read), and its
  answer reaches the authorizer as the fourth argument and the handler as `ctx.session`; the fifth
  is `company` for a `company: true` route. Either may throw a `KitError`. Without IAM, the
  own-account authorizer gives the one owner every capability.
- **The identity** comes only from the runtime's `ctx.access` (Access on the Worker, "Protect all
  Workers", or an Access application in front): `readAccessIdentity` makes email, `user_uuid` as
  `subject`, `iat` as `signedInAt`, `audience: [aud]`, `door: 'worker'`; a record without email,
  subject or time (a service token) is none. Headers, `cf-access-*` included, are never read.
  `ctx.access` does not cross a service binding or reach a Worker with static assets; a client's
  Worker has neither.

## The local door

On the owner's computer, `localDoor: { enabled(env), page? }` stands in for Access when
`enabled(env)` (the template passes `!env.ACCESS_AUD`) and the host is `localhost`, `127.0.0.1` or
`[::1]`; elsewhere it answers 404 and its cookie is no identity.

| Route | What it does |
|---|---|
| `GET /local/sign-in?next=` | `page(state)`, or a plain page |
| `POST /local/sign-in` | Takes `email`, sets `oltrem_local` (HttpOnly, SameSite=Strict), 303 to `next` |
| `POST /local/sign-out` | Clears it, 303 to sign-in |

Its identity is `door: 'local'` with no audience, accepted only for this door. A page without an
identity goes to sign-in, an API call gets 401. Access's record, when present, wins.

## The three handlers

| Handler | What it does |
|---|---|
| `fetch` | The pipeline |
| `scheduled` | The `tick` (`@oltrem/core-jobs`), then each module's `scheduled`; one error reported, the rest still run |
| `queue` | Each envelope dispatched on `type`, then `onHandled` (the outbox marks it done) and ack; a throw or unknown type retries after `retryDelay` (30 s doubling, an hour at most), so five tries span about a quarter of an hour before the dead-letter queue |

With `off` (`@oltrem/core-config`), read once per request: a part's `/api/<id>/` and `/hooks/<id>/`
answer 404 `KIT-E-0404`, `/healthz` leaves it out, `partsOff` rides on the request for the screens,
its `scheduled` is skipped and its events are acknowledged without `onEvent` or `onHandled`, so the
outbox sends them again once it is back.

## Tests

Inside the Workers runtime with a sample module of every route shape and one echoing the session
hook: `test/app.test.ts` (the pipeline, hooks, shed, limiter, metrics),
`test/identity.test.ts`, `test/local-door.test.ts`, `test/key-calls.test.ts` (API keys, idempotency),
`test/worker.test.ts` (the handlers and retries), `test/parts.test.ts` (parts off), and
`test/inner.test.ts` (the inner call: one pass, same refusals, told to `onChange`, the fallbacks).

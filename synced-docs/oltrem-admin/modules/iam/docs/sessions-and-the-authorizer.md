---
title: "@oltrem/iam: sessions and the authorizer"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src/sessions.ts, device.ts, care.ts]
---

# @oltrem/iam: sessions and the authorizer

> Part of [the @oltrem/iam README](../README.md).

## Sessions and the authorizer

```ts
import { asSession, createSessions } from '@oltrem/iam';

const sessions = createSessions<Env>({
  bindings: (env) => ({ kv: env.CACHE, db: env.DB }),
  audience: (env) => env.ACCESS_AUD, // read on each request
});
const app = createApp<Env>({ modules, session: sessions.hook, authorize: sessions.authorize });

const { access } = asSession(ctx.session);       // in a handler
can(access, index, 'rooms.cancel', input.scopeId);  // at the scope at hand
allowedScopes(access, index, 'rooms.read');         // for WHERE scope_id IN (...)
```

**The audience** is the secret `ACCESS_AUD` (`ACCESS_AUD_RECIPE`): `worker` (`WORKER_AUDIENCE`,
set by `npm run deploy`) when Access stands on the Worker, or a hostname application's tag that
`ctx.access.aud` must equal. Only an identity the runtime vouched for (`ctx.access`, never a
header) or the local door gets in; anything else is `wrongAudience`. Read per request, so the
Worker file loads in Node; an empty tag refuses everyone (`KIT-E-0401`).

**The record.** Access keeps its own cookie; the kit sets none. Each request reads one KV record,
`sess:<email>` (`SESSION_PREFIX`): the compiled map, its expiry (a day after compiling) and the
sign-ins. It recompiles and writes once when the record is missing, a day old, past `refreshAt` (a
grant started or ended), or the tenant's policy version moved (checked at most every
`recheckSeconds`, 300, per person). No active account is `KIT-E-2005`. Nothing writes per request
(KV allows 1,000 writes a day), and one record read serves all of a page's API calls in that
isolate; calls arriving together share one read and one compile, and a due version check runs
beside the read. A write in the isolate makes the next call read again.

**Devices.** A device is one Access sign-in, keyed by its `iat`. Its first request adds it (one
write; the 10 latest kept, `DEVICE_LIMIT`). `revokeDevice` ends one (`KIT-E-2006` until a new
sign-in), `revokeAll` ends all in one write, `setDeviceEnd` sets an end up to 30 days. A record
holding an ended sign-in is kept until a day after it began.

**Blocks.** An account with `blocked_until` ahead or `is_active = 0` is `KIT-E-2017` with the time.
A block or switch off writes `signed_out_at`, moves the policy version and removes the record; the
next compile keeps it as `notBefore`, so earlier sign-ins stay ended while one made during a block
works once it is over. A recompile refuses an account blocked since, so a stale record lasts one
recheck at most.

**Recorded and compared**, after the answer (`waitUntil`), once per new device: one D1 batch writes
`last_signed_in_at` and an `iam.sign-in` audit row (device, browser, country). It compares with the
person's last 50 sign-ins over 90 days (`SIGN_INS_COMPARED`, `SIGN_IN_LOOKBACK_DAYS`): a browser
(versions aside) or country (`countryOf`; `T1` is Tor) not seen makes it `new`; another country
within 60 minutes (`TWO_COUNTRIES_MINUTES`) `unusual`, with `countries`. A first sign-in compares
with nothing. Either flag calls `signedIn` with a `SignInEvent` (with `timeZoneOf`), which
`createIam` turns into the sign-in alert ([care-on-the-tick](care-on-the-tick.md#care-on-the-tick)).

**A sign-in used elsewhere.** Each request of a known sign-in is compared with where it was made
(`movedTo`): another country, or another browser by name (`deviceName`), is kept in `moved` (at
most 3, `MOVED_LIMIT`), audited `iam.sign-in-moved`, and passed to `signInMoved`. `createIam` always
emails the person (`signInMovedAlert`), and the client template raises an alert
(`report.sign-in-moved.<person>.<device>.<country>`, `signInMovedReport`): critical for another
browser, a warning for another country alone; resolved by hand.

**Refused sign-ins.** An address with no account writes an `iam.sign-in` row, outcome `refused`,
`{reason: 'no account', country}`, at most hourly per address per isolate. Comparisons and refused
rows are kept whatever the extras say (Users' Signed in today reads them); the extras switch only
the email and the warning.

**The authorizer** fails closed without a session, then asks `holdsAnywhere` (the root or any scope
with a grant; the handler narrows); a `company: true` route asks the root alone. For a
`freshSignIn` or `secondPerson` capability it first re-reads the policy version (shared within the
request), so a revoke reaches a dangerous action at once. An allow on `freshSignIn` then needs a
sign-in within `freshMinutes`, else `KIT-E-2004`, except for the Vendor. The window is
`iam.fresh_sign_in_minutes` (`FRESH_SIGN_IN_SETTING`, the Vendor's, 0 to 1,440); **0, the default,
asks nobody**. A route that reveals a secret checks `session.fresh` itself
(`IAM_ERRORS.FRESH_SIGN_IN_NEEDED`), and a page meeting `KIT-E-2004` offers to sign in again.

`iam.self` (`SELF`) is the authorizer's alone: every account holds it by having a session, no role
carries it, and the function behind each route decides the rest. Any `<module>.self` reads the same
(`SELF_SUFFIX`).

**Making a change visible.** `invalidate(env, principalId)` recompiles one person's record (or
removes it for a switched-off account); `invalidateTenant(env, tenantId)` moves the policy version,
seen at once by a dangerous route and by the rest within the recheck. Governance calls both.

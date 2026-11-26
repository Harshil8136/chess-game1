---
title: "@oltrem/iam: Sessions and the authorizer"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src; split from modules/iam/README.md]
---

# @oltrem/iam: Sessions and the authorizer

> Part of [the @oltrem/iam README](../README.md).

## Sessions and the authorizer

```ts
import { createApp } from '@oltrem/core-http';
import { asSession, createSessions } from '@oltrem/iam';

const sessions = createSessions<Env>({
  bindings: (env) => ({ kv: env.CACHE, db: env.DB }),
  audience: (env) => env.ACCESS_AUD, // read on each request; a sign-in at another application is refused
});
const app = createApp<Env>({ modules, session: sessions.hook, authorize: sessions.authorize });

// in a handler
const { access } = asSession(ctx.session);
can(access, index, 'rooms.cancel', input.scopeId); // the scope at hand
allowedScopes(access, index, 'rooms.read'); // for WHERE scope_id IN (...)
```

The **audience** is the Worker secret `ACCESS_AUD`, whose key recipe (`ACCESS_AUD_RECIPE`) the
module declares: `worker` (`WORKER_AUDIENCE`) when Access stands on the Worker itself, which
`npm run deploy` sets and which accepts any application the runtime names, or the tag of a
hostname Access application, which the runtime's `ctx.access.aud` must equal. Either way only an
identity the runtime vouched for (`door: 'worker'`, read from `ctx.access` by `@oltrem/core-http`,
never from a request header) or the local door's on the owner's own computer gets in; anything
else is refused (`wrongAudience`). Given as a function it is read from the env on each request,
so the Worker file needs no Workers-only import at module scope and the tool can still load it;
an empty tag is one no application has, so a Worker without the secret refuses everyone
(`KIT-E-0401`).

The door (Cloudflare Access) signs the person in and keeps its own cookie; the kit sets none. On
each request the **hook** reads one KV record, `sess:<email>`, carrying the compiled map, its hard
expiry (a day after the compile) and the person's sign-ins. It compiles afresh, and writes once,
when the record is missing, a day old, past the map's `refreshAt` (a grant started or ended), or
when the tenant's policy version has moved, which an isolate checks against the database at most
every `recheckSeconds` (five minutes) per person. An email with no active account is refused
(`KIT-E-2005`). Nothing writes per request: KV allows 1,000 writes a day on the free plan. Nor does
a page read the record more than once: the screens call the API several times a page, with the
page's ExecutionContext, and the record read for the first call serves the others (KV allows 100,000
reads a day; Home made 24 before, one now). A write or removal of the record in that isolate (a new
sign-in, `invalidate`, `revokeDevice`, a recompile) makes the next call read it again, so a change
made in the request shows in the rest of it. A page starts its reads together, so the calls that
arrive while the first is still reading share its work: one read, and a stale record compiled once,
not once per call. When the policy check is due (so on the first request of a new isolate), the
version is asked for beside the record's read, not after it: one wait for the two.

A **device** is one sign-in at the door, keyed by the sign-in's issue time (`iat`), which stays the
same for the whole of that sign-in and differs between browsers. The first request of a sign-in adds
it to the record (one write; the ten most recent are kept); `revokeDevice` ends one, and that
sign-in is refused from then on (`KIT-E-2006`) until the person signs in again; `revokeAll` ends
every open one in the same single write (the Users page's "Sign out everywhere"); `setDeviceEnd`
gives one an end time, or clears it (`endsAt`, thirty days at most, set by the Users module): past
it, that sign-in is refused like an ended one. An ended sign-in is written only in the record, so a
record that holds one is kept until a day after that sign-in began, when the door's own sign-in has
ended too, even past the record's own day. A **blocked** account (`iam_principals.blocked_until`
still ahead, or `is_active = 0`) is refused at the door with `KIT-E-2017` and the time. A block or a
switch off writes `iam_principals.signed_out_at`, moves the tenant's policy version and removes the
record; the next compile keeps that time as `notBefore`, so a sign-in made before it stays ended
(`KIT-E-2006`) until the person signs in again, while one made during a block works once the block
is over (the cut-off is in whole seconds, like `iat`). A recompile reads the account again and
refuses one blocked or switched off since, removing its record: a record that outlived its removal
(a KV failure, or a request under way that wrote it back) is refused within one recheck. No query is
added to a request. Since 2026-11-11 a new device is also **recorded**, after the answer
(`waitUntil`), in one D1 batch: `iam_principals.last_signed_in_at` (migration `0058`, the Users
list's "Last sign-in") and an audit row `iam.sign-in` whose target is the account id and whose
details hold the device and the browser's own description (the person's Sign-in history). Once per
sign-in on a browser, never per request.

That moment also **compares** the new sign-in with the person's earlier ones: their last 50
`iam.sign-in` rows of the last 90 days (`SIGN_INS_COMPARED`, `SIGN_IN_LOOKBACK_DAYS`), one read on
the index of the audit log's target, after the answer like the rest. The country is Cloudflare's own
two letters for the request (`countryOf`, kept on the device and in the row; `T1` is the Tor
network). A browser whose description, with its version numbers set aside, is not among them, or a
country not among those the earlier rows name, makes the row `new: true`; another country within 60
minutes (`TWO_COUNTRIES_MINUTES`) makes it `unusual: true`, with `countries`, the new one first. A
first sign-in has nothing to compare with, and a row without a country compares by browser alone.
Either flag calls the `signedIn` option with a `SignInEvent` (the person, the device, the browser,
the country, the time, the portal's address and, the time zone Cloudflare placed it in,
`timeZoneOf`, kept on the device); `createIam` turns it into the **sign-in alert** below.

**A sign-in used from another country or browser** (after the first client's portal): the door's
token travels with a copy of its cookie, so each request of a known sign-in is compared with where
it was made (`movedTo`): another country (both known) or another browser by name (`deviceName`, so
an update of the same browser is not one) is another place, kept on the device as `"<country>
<browser>"` in `moved`, so each is told once, at most three (`MOVED_LIMIT`: each is one write to the
record). It writes an `iam.sign-in-moved` row (where it was used, and `began`, where it was made)
and calls `signInMoved` with a `SignInMovedEvent`, after the answer; the request itself still
answers. `createIam` emails the person (`signInMovedAlert`, whatever the Modules page says, since it
may be a copied sign-in: where it was made and where it was used, both in the sign-in's local time,
and Report a sign-in; keyed by the sign-in and the place) and hands the event to its `moved` option.
The client template raises an alert from it (`report.sign-in-moved.<person>.<device>.<country>`,
words from `signInMovedReport`): critical for another browser, a warning for another country alone,
which a VPN or travel can make; no check closes it, so it is resolved by hand. A sign-in refused
because the address has no active account here is recorded too: an `iam.sign-in` row with outcome
`refused`, target empty and details `{reason: 'no account', country}`, at most once an hour for each
address in an isolate, so a door left knocking costs a write an hour, not one a request. The
comparison and the refused rows are kept whatever the two extras below say, since Users' Signed in
today reads them; the extras switch only the email and the warning. A refused row keeps the address
that tried as its actor, as long as the audit log keeps its rows, like any row's actor: only someone
the door let through reaches it, so the address is one Cloudflare Access verified.

The **authorizer** refuses when the hook did not run (no session: fail closed), then asks
`holdsAnywhere`: the capability at the root or at any scope with a grant, since a route is the
widest question and the handler narrows to the scope at hand. A route held to the company (`company:
true` in `@oltrem/core-module`) is asked at the root alone. On a route whose capability is flagged
`freshSignIn` or `secondPerson` it first re-reads the tenant's policy version and recompiles if it
moved (plan 7.2, step 6), so a revoke reaches a dangerous action at once. The calls of one request
share that read, and the next request reads it again, so nothing is kept between requests. An allow
on a `freshSignIn` capability then needs a sign-in within `freshMinutes`, else `KIT-E-2004`, of
everyone but the Vendor. The window is the setting `iam.fresh_sign_in_minutes`
(`FRESH_SIGN_IN_SETTING`, Settings, Security, the Vendor's to change: 0 to 1,440 minutes), and **0,
its default, asks nobody**: the owner's ruling of 2026-11-11, "disable it by default everywhere"
(before, ten minutes for everyone). A number passed as `freshMinutes` still wins, for tests and a
client that wants it fixed. The Vendor is never asked either way; the second-person gate is the
governance step's, with the approvals it needs. A fresh sign-in is for what reveals or replaces a
secret, or hands out people's data, never for everyday work: a capability that also covers everyday
routes leaves the flag off, and the one route that reveals a secret asks itself, refusing with
`IAM_ERRORS.FRESH_SIGN_IN_NEEDED` when `session.fresh` is false (the email module's delivery reports
address, since 2026-11-01). A page that meets `KIT-E-2004` shows a way to sign in again in place,
never a smaller view. One capability is the authorizer's alone: `iam.self` (`SELF`), which every
account holds by having a session and no role carries; the routes about one's own things name it,
and the function behind each decides the rest. Any module's `<module>.self` is read the same way
(`SELF_SUFFIX`).

Two calls make a change visible: `invalidate(env, principalId)` compiles the person's access again
into their record (or removes the record when the account was switched off), so their next
request sees it; `invalidateTenant(env, tenantId)` moves the policy version, which a dangerous
route sees at once and every other within the recheck window. The governance step calls them.

# @oltrem/iam

Permissions for a client Worker (plan sections 6, 7 and 10): who may do what, where, as data a
client's Owners manage themselves. So far: the tables, the capability registry the modules fill
when the Worker starts, the compiler that turns a person's grants into one small map, the check that reads it,
the sessions that carry the map from one request to the next with the pipeline's hook and
authorizer, the governance: every write that changes who may do what, each refused unless the
actor could stand behind it, and the handover: the Vendor creates the one company and invites its
first Owner, who takes it over, and the routes: the JSON side of all of it under `/api/iam`, with
one call, `createIam`, that builds the sessions, the governance, the handover and the module the
pipeline mounts. The phone screens follow.

## The model in one paragraph

A **capability** is one thing a module lets someone do (`rooms.book`), declared by the module as
data and given a bit in the module's plane at deploy. A **role** is a bundle of capabilities. A
**scope** is a node of the client's one tree: the company, then its sites, then departments or
teams, four levels at most. A **binding** gives a role to a person or a flat **group** at one
scope, as allow or deny, in force between two moments, or merely *eligible* until activated. An
**override** does the same for one capability. At sign-in the kit **compiles** all of that into
one map per person; a check is a few lookups and one bit test, with no network.

## Declaring capabilities

```ts
import { defineCapabilities } from '@oltrem/iam';

export const ROOMS = defineCapabilities({
  module: 'rooms',
  version: '1.0.0',
  bitPlane: 7, // assigned once by the registry; two modules never share one
  capabilities: [
    { id: 'rooms.read', class: 'read', label: { en: 'See rooms', es: 'Ver habitaciones' } },
    { id: 'rooms.cancel', class: 'operate', label: { en: 'Cancel a booking' }, freshSignIn: true },
    { id: 'rooms.export', class: 'admin', floor: 'owner', label: { en: 'Export every booking' } },
  ],
});
```

| Field | Rule |
|---|---|
| `id` | `<module>.<name>`, lowercase, stable for ever |
| `class` | `read`, `operate` or `admin`: how the screens group it |
| `label` | a few words a person reads, in English at least |
| `floor` | `owner`: granted only through the Owner role or by the Vendor; `vendor`: the Vendor's alone |
| `freshSignIn`, `secondPerson` | the route runs those gates after an allow (plan 7.2, step 5) |

`defineCapabilities` refuses a bad declaration when the module loads (`KIT-E-2001`). A module
declares the same thing on its manifest, as `bitPlane` and `capabilities` in `defineModule`
(`@oltrem/core-module`), which checks the shape when the module loads and that every route checks
a declared capability. `registerCapabilities(db, sets)` writes a set into the registry: the module
row with its plane and version, a bit for each new capability (the next free one, never one
already given), labels and flags refreshed, a capability no longer declared marked inactive while
it keeps its bit, and a new one joined to every Owner role. Two modules claiming one plane, in one
run or across runs, fail it. The pipeline's startup hook (`createIam(...).startup`, under The
routes) runs it when the Worker starts, for the mounted modules whose declaration the registry
has not seen (`registrationMark(set)`: the version and a fingerprint of the plane and
capabilities, kept as the module row's version); `capabilitySets(modules)` is the step from manifests to sets. `loadCapabilityIndex(db)`
reads the rows; a `capabilityIndexSource` reads them once per isolate and replaces them after a
registration, and the sessions, the governance and the handover share one, so the compiler and
the check read the same index. `createIam(...).index` hands that one to the other modules (their
`index` option), so a module's own checks use it too instead of reading the registry into a copy
of their own on first use; the client template passes it to every module that takes one.

## Compiling and checking

```ts
const index = await loadCapabilityIndex(env.DB);
const access = await compileAccess(env.DB, principalId, index); // at sign-in, and on a change
const decision = can(access, index, 'rooms.cancel', scopeId); // { allowed, reason, freshSignIn, secondPerson }
const scopes = allowedScopes(access, index, 'rooms.read'); // for WHERE scope_id IN (...)
```

The compiler reads the tenant, its tree, the person's groups, the bindings in force now for the
person and those groups, the bound roles' capabilities and the person's overrides, in one batch,
then ORs each role's bits into `allow` or `deny` per scope and module. The map holds the tree
(`parent`), the bits per scope, whether the person holds the Owner role at the root, the
tenant's policy version and Vendor setting, `refreshAt` (when the next grant starts or ends), and
a `sha256-` hash of all of it. A compile only reads: it writes no row (since 2026-11-22; its old
record in `iam_policy_compiles` was never read, and migration `0078` drops the table). A map is
a few hundred bytes to a few kilobytes.

`can` decides in this order, and refuses when in doubt (R-10):

1. An unknown or inactive capability: `unknown_capability`, `inactive_capability`.
2. A scope that is not in the tree: `unknown_scope`, whoever asks.
3. The Vendor: `vendor` (allow), unless the tenant set its access to `approval` or
   `incident_only` and no window is open (below, the handover). The Vendor holds by its kind,
   not by bits, so it holds every capability the index knows, a module registered after the
   company was made included, the moment the registry has it, with no grant and no recompile.
4. An Owner (the Owner role at the root, in force) with no deny of their own, for a capability
   not on the vendor floor: `owner` (allow) at once, with no walk. The compile marks an Owner
   that has one (`narrowed`).
5. Walk from the scope up to the root once: a deny bit on any node is `deny`, for an Owner too
   (since 2026-11-14, the owner's ask for "a specific owner with less permission").
6. A capability on the vendor floor is held only through an allow bit the Vendor gave: `allow`,
   else `vendor_floor`.
7. An Owner: `owner` (allow).
8. Anyone else: an allow bit found on the walk is `allow`; nothing found is `not_granted`.

Floors are applied at compile time: a capability with `floor: owner` enters the allow bits only
from the Owner role (position `0`), never from another role or an override; a vendor-floor
capability enters them only from an override the Vendor gave (the join to the granter's kind is
in the one override query, so the check stays a few hash lookups). A deny override enters the
bits at any floor, so the Vendor or another Owner can take one permission away from one Owner;
a role's deny binding still never reaches an Owner. An *eligible* binding, an expired one and one
not yet started grant nothing; `refreshAt` says when to compile again.

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
(`KIT-E-2005`). Nothing writes per request: KV allows 1,000 writes a day on the free plan. Nor
does a page read the record more than once: the screens call the API several times a page, with
the page's ExecutionContext, and the record read for the first call serves the others (KV allows
100,000 reads a day; Home made 24 before, one now). A write or removal of the record in that
isolate (a new sign-in, `invalidate`, `revokeDevice`, a recompile) makes the next call read it
again, so a change made in the request shows in the rest of it. A page starts its reads
together (2026-11-12), so the calls that arrive while the first is still reading share its work:
one read, and a stale record compiled once, not once per call. When the policy check is due (so
on the first request of a new isolate), the version is asked for beside the record's read, not
after it: one wait for the two.

A **device** is one sign-in at the door, keyed by the sign-in's issue time (`iat`), which stays the same
for the whole of that sign-in and differs between browsers. The first request of a sign-in adds
it to the record (one write; the ten most recent are kept); `revokeDevice` ends one, and that
sign-in is refused from then on (`KIT-E-2006`) until the person signs in again; `revokeAll`
ends every open one in the same single write (the Users page's "Sign out everywhere");
`setDeviceEnd` gives one an end time, or clears it (`endsAt`, thirty days at most, set by the
Users module): past it, that sign-in is refused like an ended one. An ended sign-in is written
only in the record, so a record that holds one is kept until a day after that sign-in began,
when the door's own sign-in has ended too, even past the record's own day (2026-11-20: gone
sooner, a new record knew none of them and let the ended sign-in back in). A **blocked** account
(`iam_principals.blocked_until` still ahead, or `is_active = 0`) is refused at the door with
`KIT-E-2017` and the time. A block or a switch off writes `iam_principals.signed_out_at`, moves
the tenant's policy version and removes the record; the next compile keeps that time as
`notBefore`, so a sign-in made before it stays ended (`KIT-E-2006`) until the person signs in
again, while one made during a block works once the block is over (the cut-off is in whole
seconds, like `iat`). A recompile reads the account again and refuses one blocked or switched off
since, removing its record: a record that outlived its removal (a KV failure, or a request under
way that wrote it back) is refused within one recheck. No query is added to a request. Since
2026-11-11 a new device is also **recorded**, after the answer (`waitUntil`), in one D1 batch:
`iam_principals.last_signed_in_at` (migration `0058`, the Users list's "Last sign-in") and an
audit row `iam.sign-in` whose target is the account id and whose details hold the device and the
browser's own description (the person's Sign-in history). Once per sign-in on a browser, never
per request.

Since 2026-11-21 that moment also **compares** the new sign-in with the person's earlier ones:
their last 50 `iam.sign-in` rows of the last 90 days (`SIGN_INS_COMPARED`,
`SIGN_IN_LOOKBACK_DAYS`), one read on the index of the audit log's target, after the answer like
the rest. The country is Cloudflare's own two letters for the request (`countryOf`, kept on the
device and in the row; `T1` is the Tor network). A browser whose description, with its version
numbers set aside, is not among them, or a country not among those the earlier rows name, makes
the row `new: true`; another country within 60 minutes (`TWO_COUNTRIES_MINUTES`) makes it
`unusual: true`, with `countries`, the new one first. A first sign-in has nothing to compare
with, and a row without a country compares by browser alone. Either flag calls the `signedIn`
option with a `SignInEvent` (the person, the device, the browser, the country, the time, the
portal's address); `createIam` turns it into the **sign-in alert** below. A sign-in refused
because the address has no active account here is recorded too: an `iam.sign-in` row with outcome
`refused`, target empty and details `{reason: 'no account', country}`, at most once an hour for
each address in an isolate, so a door left knocking costs a write an hour, not one a request.
The comparison and the refused rows are kept whatever the two extras below say, since Users'
Signed in today reads them; the extras switch only the email and the warning. A refused row keeps
the address that tried as its actor, as long as the audit log keeps its rows, like any row's actor:
only someone the door let through reaches it, so the address is one Cloudflare Access verified.

The **authorizer** refuses when the hook did not run (no session: fail closed), then asks
`holdsAnywhere`: the capability at the root or at any scope with a grant, since a route is the
widest question and the handler narrows to the scope at hand. A route held to the company
(`company: true` in `@oltrem/core-module`) is asked at the root alone (2026-11-20). On a route whose capability is
flagged `freshSignIn` or `secondPerson` it first re-reads the tenant's policy version and
recompiles if it moved (plan 7.2, step 6), so a revoke reaches a dangerous action at once. The
calls of one request share that read (2026-11-13: Home asked three times), and the next request
reads it again, so nothing is kept between requests. An
allow on a `freshSignIn` capability then needs a sign-in within `freshMinutes`, else
`KIT-E-2004`, of everyone but the Vendor. The window is the setting `iam.fresh_sign_in_minutes`
(`FRESH_SIGN_IN_SETTING`, Settings, Security, the Vendor's to change: 0 to 1,440 minutes), and
**0, its default, asks nobody**: the owner's ruling of 2026-11-11, "disable it by default
everywhere" (before, ten minutes for everyone). A number passed as `freshMinutes` still wins, for
tests and a client that wants it fixed. The Vendor is never asked either way (the owner's ruling of 2026-11-08,
in `can` since 2026-11-11); the second-person gate is the governance step's, with the approvals it needs. A
fresh sign-in is for what reveals or replaces a secret, or hands out people's data, never for
everyday work: a capability that also covers everyday routes leaves the flag off, and the one
route that reveals a secret asks itself, refusing with `IAM_ERRORS.FRESH_SIGN_IN_NEEDED` when
`session.fresh` is false (the email module's delivery reports address, since 2026-11-01). A page
that meets `KIT-E-2004` shows a way to sign in again in place, never a smaller view. One
capability is the authorizer's alone: `iam.self` (`SELF`), which every account holds by having a
session and no role carries; the routes about one's own things name it, and the function behind
each decides the rest. Any module's `<module>.self` is read the same way (`SELF_SUFFIX`).

Two calls make a change visible: `invalidate(env, principalId)` compiles the person's access again
into their record (or removes the record when the account was switched off), so their next
request sees it; `invalidateTenant(env, tenantId)` moves the policy version, which a dangerous
route sees at once and every other within the recheck window. The governance step calls them.

## Governance

```ts
import { createGovernance } from '@oltrem/iam';

const governance = createGovernance<Env>({
  bindings: (env) => ({ kv: env.CACHE, db: env.DB }),
  sessions,
});

// in a handler, with the session the pipeline loaded: actorOf(ctx) is the session, the
// request's id and its waitUntil, so the audit row is written after the response
await governance.grant(env, actorOf(ctx), {
  subjectKind: 'principal',
  subjectId,
  roleId,
  scopeId,
  reason,
});
```

`createGovernance` holds every write that changes who may do what (plan 7.3): grants and their
end, eligible grants and their activation, roles, groups and members, scopes, overrides, access
requests, approvals and reviews. Each one reads the actor's standing from the compiled map in
their session, writes the rows, refreshes the sessions that carry the old answer (`invalidate`
for one person; `invalidateTenant` after a change to a group, a role or the tree) and records
itself in the audit log, refusals included, with the policy hash the actor was decided under.
Each row names what it touched, by name and not only by id: the role (`role`), the person
(`person`, their address), the group (`group`), the grant as `Clerk for ann@example.com`
(`name`), a role's changes from what to what and the permissions `added` and `removed`.

Every module writes its audit rows through `recorded(options, actor, action, target, details,
work, outcome?)`: it runs the work, then writes the row, the refusal as much as the success. The
work is handed `note(facts)`, for what it learns as it runs: the record's `name` and, on a change,
its `changes` from `changesOf` (re-exported here from `@oltrem/core-audit`, which says what a
module row holds). Noted facts are written whatever the outcome. A row that would pass the
audit's 4 KB limit is still written: its `changes`, `added` and `removed` are dropped and `cut`
says so.
The rules, each refused with its own code:

- **You grant only what you hold.** A role goes to a person or group at a scope only if the actor
  holds `iam.bindings.manage` there (`iam.owners.manage` for the Owner role) and the role's
  position is below the actor's own standing at that scope: the best position they hold there or
  above it (`rankAt`), and the actor holds every permission the role carries at that scope
  (since 2026-11-24, the owner's pick from the review of 2026-11-20: a role below your own could
  carry a permission you lack; a deny grant hands nothing on and is not held to it; the same
  holds for an invitation, a group's members and an API key). `GET /roles` marks each role
  `mine` when the reader holds all its permissions somewhere, so the pages offer only those. A capability enters a role only if the actor holds it at every scope where
  the role is granted (anywhere, for a role not granted yet); a role is made or edited below the
  actor's best position; the Owner role is edited by the Vendor alone and never deleted.
  Otherwise `KIT-E-2007`. A refusal about a role names the permission by its label in words
  ("you do not hold “View the user directory” yourself") and a location by its name, not by id.
- **Never for yourself.** Nobody changes their own grants, overrides or group membership, nor the
  grants of a group they belong to (`KIT-E-2008`); they request access instead.
- **Overrides by floor** (2026-11-14). A permission with no floor is allowed or denied by whoever
  may give at that place and holds it themselves. An Owner-floor permission is never allowed by
  an override (it comes with the Owner role only) and is denied only to an Owner. A Vendor-floor
  permission is allowed by the Vendor alone, and never denied (no one else holds it to take away);
  only the Vendor ends such an allow. An override on an Owner is made or ended by the Vendor or
  another Owner; on anyone else, by someone whose standing there is above every role the person
  holds (`KIT-E-2007` otherwise). An Owner's People and access permissions (`iam.*`) are denied by
  the Vendor alone, so that two Owners can never strip each other of the means to undo it; the
  compile ignores such a deny written by anyone else.
- **No role twice at one place.** A grant of a role the person or group already holds at that
  place, in force and held the same way (both eligible or both not), is refused in plain words
  (`KIT-E-2010`): change or end the one in force instead.
- **A grant lasts until it is ended, unless an end is given** (since 2026-11-11, the owner's ask
  to make giving access simple; before, every grant but the Owner's ended after ninety days). The
  setting `iam.grant_days` (`GRANT_DAYS_SETTING`, Settings, Users and access, an Owner's to change)
  sets an end of its own, 1 to 366 days, for a grant or override given without one; 0, its
  default, sets none. An end that is given is at most a year away, and `expiresAt: null` asks for
  no end for any role; the grant may start later; an override has the same window. Access reviews
  still look at every grant. An *eligible* grant is held but not in
  force until its holder activates it, for one to twelve hours (four unless said) with a reason;
  the activation is a grant of its own, linked back to the eligible one.
- **An Owner is made or unmade with a second person only when the client wants it.** The
  setting `iam.owner_second_person` (Settings, Security, the Vendor's to change) is off by
  default, so whoever may make, invite or end an Owner does it alone; the Vendor is never asked
  either way (the owner's decisions of 2026-11-08 and 2026-11-11). When it is on, the actor asks
  for an approval that names the capability, the scope, the action and the exact change (hashed); another holder of
  the capability approves within the hour; the change spends the approval, once, and refuses one
  that is pending, someone else's, expired, spent or for another change (`KIT-E-2011` when none
  is given, `KIT-E-2012` otherwise). Modules use the same approvals for their own `secondPerson`
  capabilities through `requestApproval`, `decideApproval` and `useApproval`. The last Owner at
  the root is never ended (`KIT-E-2009`), except by the Vendor before the handover: an Owner the
  Vendor made while setting the company up can be taken back (2026-11-15).
- **Access requests.** A person asks for a role at a scope with a reason; the request waits a
  week; whoever could have made the grant decides it, and an approval makes the grant in the
  decider's name. The requester may withdraw it.
- **Access reviews.** `openReview` lists every grant in force under a scope, due in two weeks;
  each is marked keep or remove by someone with the standing over it; `closeReview` refuses while
  one is undecided (`KIT-E-2013`) and ends the removed. An Owner is never removed in a review.
  Opening one is a person's decision; the health check below says when one is due.
- **Groups and scopes.** A member joins a group only by the hand of someone who could have made
  each of the group's grants to that person. The tree is the Owners' (`iam.scopes.manage` has the
  owner floor): four levels at most, the root stays, and a scope, role or group with any grant in
  its history is never deleted; its grants are ended instead. Anything else that does not fit
  (an unknown role, scope or person, a date out of range, a thing still in use) is `KIT-E-2010`,
  titled "That cannot be done", its detail naming what to change. Before the company exists every
  write is refused with "The company is not made yet: name it first on the Home page."

## The Vendor and the handover

```ts
import { createHandover } from '@oltrem/iam';

const handover = createHandover<Env>({
  bindings: (env) => ({ kv: env.CACHE, db: env.DB }),
  sessions,
  audience: (env) => env.ACCESS_AUD,
});
// at setup, as the Vendor
const { invitation } = await handover.createTenant(env, actor, { name, ownerEmail });
// the invited person, signed in at the door, with the token from the link; no account yet
await handover.acceptInvitation(env, ctx.identity, token, ctx.requestId);
// or with no token: the newest invitation waiting for the address Access proved
await handover.acceptInvitation(env, ctx.identity, null, ctx.requestId);
```

The **Vendor** is the one account that exists before the company does: tenant-less, with every
capability and every floor, its address set at setup. It alone creates the company (plan 7.4):
one per portal (`KIT-E-2014` for a second), with its root scope, its **Owner role** at position
`0` holding every capability but the Vendor's, and one **invitation** to the first Owner. The
Vendor holds no role, group or override of the company's, before or after: its access is its
kind, and the company sets how it may enter.

**Several Vendor accounts** (the owner's decision of 2026-11-08). Any account of kind `vendor` is
a Vendor, so a portal may have more than the one setup made: each signs in with its own address
and shows under it in the audit log, and the company's choice of how the Vendor may enter covers
them all. Another one is made two ways: named at setup as `vendor` (it gets its account at its
first sign-in, before the company too, below), or added by a Vendor on Vendor access
(`addVendor`, `POST /vendors`; an address that has an account already is refused). A Vendor
switches another off or on (`setVendorActive`): its session ends from the next request, its row
stays for the record, and neither its own account nor the last one on is ever switched off. Audit
rows: `iam.vendor-add`, `iam.vendor-on`, `iam.vendor-off`
(`modules/iam/test/setup-admit.test.ts`).

An **invitation** gives one role at one scope to one email address: single use, a week, under
the grant rules of the governance (`invite`, `revokeInvitation`), and the token travels once in
the link while the row keeps its hash. `acceptInvitation` runs on the identity alone, since the
person has no account yet: the address must be the invited one (`KIT-E-2016`), the invitation
pending and in date (`KIT-E-2015`); it creates the account (or finds the one with that address),
makes the grant in the inviter's name and records the acceptance, and closes any other invitation
still waiting for that address. The invitation is taken first, and only while it still waits: of
two sign-ins taking it at once (a double tap, two tabs), or one withdrawn meanwhile, the second is
refused with `KIT-E-2015` and makes no second grant; a grant that fails leaves it waiting again
(2026-11-20). Since 2026-11-15 one invitation waits per address: an address that
has an account here is refused (`KIT-E-2010`, "give them the role on their page", with
`details.principalId`), and so is one with an invitation waiting (`KIT-E-2010`, the day it was
made, with `details.invitationId`); `POST /invitations/many` passes these on as `personId` and
`invitationId` in `refused`. **Send again** (`inviteAgain`, `POST /invitations/:id/again`) gives a
pending invitation a new link and a new week, so the old link stops working (`iam.invite-again` in
the audit log); with `send` the new link is emailed under its own message key. The first Owner's acceptance is
the **handover**, stamped on the tenant: before it the Vendor alone invites Owners, since nobody
else could approve, and the record says so; from then on an Owner is made, invited or unmade
with a second person only when `iam.owner_second_person` is on and the actor is not the Vendor,
and the last one stays.

An invitation can be **emailed**. The client hands `createIam` a `mail(env, message)` (the client
template sends it through the email module, as the plain template `iam.message`);
when the inviter asks (`send: true`), the module writes the message, naming who invited, the
company, the role, the place, the link and its last day, and ending with the main-inbox line
below, keyed `iam.invitation:<id>` so it goes
once (a link sent again is keyed `iam.invitation:<id>:<new last day>`, so it is not taken for the
first). The link is then held by the email module's outbox until it is delivered, as any message
is. Without a sender, or when it refuses (no sending address yet), the invitation stands, the
answer says `sent: false`, and the screens show the link to pass on by hand.

The company decides **how the Vendor may enter** (`setVendorAccess`, an Owner's with
`iam.tenant.manage`, never the Vendor's own): `always`; `approval`, where the Vendor is refused
everything until an Owner opens a **window** of one to twelve hours with a reason
(`openVendorWindow`), closed early with `closeVendorWindow`; or `incident_only`, where the Vendor
itself declares the incident and opens the window, out loud, as an audit row under its own kind.
The compiler reads the window, so the Vendor's map says `always` while it lasts and is rebuilt
when it ends. The emails to the Owners on every Vendor action come with the notifications of
phase 4; the seal with the audit module of phase 5.

The Owner role keeps a **minimum** whatever the Vendor takes out of it (`OWNER_MINIMUM`: the
module's own capabilities below the Vendor's floor), and every capability new to the registry
joins every Owner role at deploy, so a new module's screens open to the Owners by themselves;
what the Vendor removed on purpose stays out.

## Care on the tick

The module keeps four rules without anyone having to remember them (`src/care.ts`). Each is an
extra of the Access part, switched on and off on the Features page, and since 2026-11-21 (the
owner's pick) all start off on a new portal; a portal that already saved its list keeps it, and
the two added that day are added to a saved list as off (migration `0067`, `@oltrem/core-config`):

| Kind | Id | What it does |
|---|---|---|
| Job, daily | `iam.expiring` | Emails each active person whose own grant ends within 7 days (`EXPIRY_NOTICE_DAYS`): the company, the role, the place and the date, keyed `iam.expiring:<grant>:<end>`, so it goes once for each end date and again if the grant is renewed to a new one. Activations and grants through a group are not noticed. 200 a run at most; a message the sender refuses fails the run after the others are tried, with the count and the first cause in its words (since 2026-11-17; the count alone hid why), and the next run sends what is missing. Without `mail`, it does nothing. Its check (the jobs page's **Check for work**, 2026-11-21) counts the grants it would notice, by the same rule, and sends nothing. |
| Health check, lane `access` | `iam.reviews` | Warns when an open access review is past its due date, or when none was opened for 90 days (`REVIEW_EVERY_DAYS`), counted from the company's creation until the first one. |
| Email, at sign-in | `iam.sign-in-alerts` | Sign-in alerts (2026-11-21): a sign-in compared as new or unusual (above) emails the person, after the answer: the browser by name (`deviceName`, also its own entry `@oltrem/iam/device`, with no Workers type, which the customers' sign-ins read; the Users pages keep their own copy of the same names, the screens depending on core-ui alone), the country in English, the time in UTC, and, since 2026-11-24, "If it was not you, open" My access, its sign-ins (`MY_SIGN_INS`) "and press Report a sign-in": it signs the person out everywhere and tells whoever looks after access, who can block the account (`POST /me/sign-ins/report`). An unusual one says "two countries within an hour" in the subject. Since 2026-11-22 it opens with "Hello," and ends with the main-inbox line (`mainInbox(origin)`, below the table). Keyed `iam.sign-in:<person>:<device>`, so once. Without `mail`, or while the extra is off, nothing is sent; the row is written either way. The extra is on from the start since 2026-11-24 (the owner's pick: staff hear of every new sign-in), and core-config's migration `0085` switched it on where it was off only because it started off. |
| Health check, lane `access`, hourly | `iam.unusual` | Unusual sign-ins (2026-11-21): over the last 7 days, warns when a sign-in came from two countries within the hour, or when 10 or more sign-ins were refused for addresses with no account (`REFUSED_WARN`); fewer refused ones are only counted in its words (someone who left, a mistyped address). One query on the audit log's action index. |

**The main-inbox line** (2026-11-22). Gmail files a notice it sees as automatic (a sign-in alert,
an invitation, an alert) under Updates whoever sends it; what keeps a sender in Primary for good is
the reader's own filter or contact. So the portal's own notices end with one line, `mainInbox`:
"If this email landed under Updates, Promotions or Other, the one-minute step at
`<portal>/notifications#primary` keeps the portal's emails in your main inbox" (`MAIN_INBOX`; the
Notifications page's name when the address is not known). The sign-in alert and the invitation
carry it, the invitation after "Once you are in:"; the alerts module ends its emails with it too.
The step itself is the Notifications page's (`@oltrem/screens`).

The four only read the rows. The notices go through the same `mail` as an invitation, and the
health page shows the checks' last results with the others. With `iam.expiring` and `iam.reviews` off,
whoever looks after access is told on Home's Needs you instead (below, since 2026-11-22). Cloudflare's bot score, which the
plan named for unusual sign-ins, is not used: it needs Bot Management, which the free plan does
not have.

Home's "Needs you" (`todo`, `src/todo.ts`) asks the module for what waits for the person signed
in, under `iam.self`: the access requests and second-person approvals they may decide, each
access review with grants they may keep or remove, their own grants ending within 7 days, and,
since 2026-11-22, for whoever may renew them (`standingAt`) how many other people's own grants end
within 7 days (one links to that person's page, more to People), and for whoever holds
`iam.bindings.manage` at the company "An access review is due" when none is open, none was opened
for 90 days and someone else holds a grant (a company of one has nobody to review).
`waitingFor` counts with the rules the decisions check (`standingAt`, `can`, never one's own
request, approval or grant), so a person is never sent to a decision the API would refuse.

## The door, and who gets in

Cloudflare Access stands on the Worker itself (ACCESS_AUD `worker`). Since 2026-11-05 the module
keeps nothing of it in step: `npm run deploy` sets it once with Cloudflare's own command line and
its sign-in (`@oltrem/cli`, `src/door.ts`), and the Worker holds no key that could change it. The
door asks anyone for a code sent to their email (the One-time PIN login, one policy that includes
everyone), and leaves the customers' pages, the webhooks, the health check and the styles open.

Who gets in is this module's own list. A sign-in whose email has no active account here is refused
with `KIT-E-2005` ("No account here"), except on the routes that make one: accepting an invitation
(`POST /invitations/accept`, `POST /invitations/mine`), and a person named at setup on their first
sign-in (below). So people come and go on the Users page
alone, and the door never needs changing. A Zero Trust organization made since June 2026 has only
the "Cloudflare" login, which admits members of the Cloudflare account and no one else; the door the
deploy sets uses only the One-time PIN login instead. The cost: anyone may ask for a code and so
take one of the 50 free Zero Trust seats for a month, while they still see nothing of the portal.

```ts
createIam({ ...,
  settings: (env) => settingsFor(env), // iam.setup_people: in at the first sign-in, or one press
});
```

**The people named at setup.** Step 2 of `npm run deploy` ("Who signs in") writes each person
it names, with what they are, to `iam.setup_people` (`SETUP_PEOPLE_SETTING`: lines
`address owner|staff|team|vendor`, lower case, set by the Vendor). Since 2026-11-08 (the owner's
decision) each one **gets in at their first sign-in**, with nothing pressed: the session hook asks
`handover.admitNamed` when a signed-in address has no account at all, and it makes the account at
the whole company with the role setup gave: the Owner as Owner, Staff as Member, Your team
as Admin (each made from its ready set when missing: View and Edit, or View, Edit and Manage,
the Owner's and the Vendor's own left out; until 2026-11-22 Standard user and Full admin, still
found by those names). Another Vendor gets a Vendor account, with no role and no company
needed; the Users page offers nothing to invite for it. The binding is the Vendor's (`granted_by`), its reason "named at
setup", and the audit row `iam.setup-admit`. Its limits, each refused with "No account here" and
why in words (`modules/iam/test/setup-admit.test.ts`):

- No company yet: the detail names the Vendor, who signs in first and makes it.
- An Owner comes in this way only before the handover, as the first Owner (the handover is
  stamped); after it, only an Owner adds another Owner.
- After the handover, anyone else only while the Vendor may enter at any time (`always`).
- An invitation already waiting for the address is accepted as any other, and a switched-off
  account stays off.

The Users page can still invite them all in one press, each to that role (`GET /setup-people`
lists the ones without an account or a pending invitation; Home's Get started says "The 3 people
named at setup sign in"); each then presses Accept on the page they land on (`POST
/invitations/mine`, then `/invitations/accept` without a token). An Owner named after the
handover is invited by the same press: the Vendor is never asked for a second person
(`templates/client/test/setup-people.test.ts`). Without `settings` nobody is named.

## API keys

Since 2026-11-24 (the owner's yes) another system calls the portal's API with a key
(`src/keys.ts`, `iam.keys`). An Owner makes one under Users and access, Settings, API keys
(`POST /keys`: a name, a role, a location and an optional end): the module makes a service
account (`iam_principals` kind `service`, address `key-<id>@keys.invalid`, never a mailbox) and
gives it the role through the grant rules, so a key never holds more than its maker may give, and
**never the Owner role** (refused 422, so a lost key cannot hand the company over). The key,
`okey_<16 hex>_<48 hex>`, is shown once; only the SHA-256 of its secret is kept, compared in
constant time. A call carries it to `/hooks/api/...` (`@oltrem/core-http`'s `keys`); the session
hook takes a key's identity with no device, sign-in row, alert or fresh sign-in, and checks its
capabilities like anyone's. A key that ends stops at that time; Revoke (`DELETE /keys/:id`)
switches its account off and ends its session at once. Its last use is written at most once an
hour (`KEY_USE_EVERY_MS`); a company holds 20 keys at most (`KEYS_MAX`). Making and revoking are
audited (`iam.key-made`, `iam.key-revoked`); making and revoking need `iam.keys.manage`, held to
the Owner role (`floor: 'owner'`). Tests: `test/keys.test.ts`.

## The routes

```ts
import { createApp, createWorker } from '@oltrem/core-http';
import { createIam } from '@oltrem/iam';

const iam = createIam<Env>({
  bindings: (env) => ({ kv: env.CACHE, db: env.DB }),
  audience: (env) => env.ACCESS_AUD,
});
const app = createApp<Env>({
  modules: [iam.module, ...others],
  startup: iam.startup,
  session: iam.sessions.hook,
  authorize: iam.sessions.authorize,
});
```

`createIam` builds the sessions, the governance and the handover on one set of bindings and
returns them with the startup hook and the module manifest. `iam.startup` runs once per isolate,
on the first request past the door: it reads the registry's module marks and registers the
capabilities of every mounted module whose declaration it has not seen (a new module, an upgrade,
a pull of the kit that added a capability under the same version). The marks of the mounted
modules are worked out while the Worker loads (`iam.startup.prepare`, run by `createApp`), not in
the first request:
the new ones join every Owner role, each tenant's policy version moves so the sessions recompile
on their next request, and the index the check reads is replaced. A version already seen costs
one read. A change to the capabilities under the same version is seen too: a copy whose
database was made before a pull would otherwise refuse the new capabilities to everyone, the
Vendor included. The IAM module declares its own eight on plane `0` the same way, so the registry fills
itself on the first request of a new client.

The manifest: sixty-eight JSON routes under `/api/iam` (the Home card's `GET /home`, under
`iam.read`, counts the roles and the places), each naming the
capability the pipeline checks before the handler runs, with the function behind it enforcing
the rest (your standing, your own grants, the second person, a fresh sign-in where the capability
is flagged). Bodies and queries are validated by schema (`KIT-E-0422` names the field); a list
takes `limit` (fifty, two hundred at most) and `offset`; rows come out in camel case, flags as
booleans, never a hash. A create answers `201` with the ids, a change or an end `204`, a read
`200`.

| Routes | Capability | What they do |
|---|---|---|
| `GET /me`, `GET /me/devices`, `DELETE /me/devices/:id` | `iam.self` | my session and compiled map, with `may`: whether I hold, anywhere, what the access pages change (`read`, `give` for grants and invitations, `roles`, `groups`, `places`, `vendor`), by the routes' own check, so a screen offers only what would be allowed; my sign-ins; end one of them (`iam.device-end` in the audit log) |
| `POST /me/sign-out-everywhere` | `iam.self` | Sign out everywhere (My access, its sign-ins, and the sign-in alert's link; no body): ends every sign-in of mine (`iam.sign-out-everywhere` in the audit log, with how many), then answers 303 to Access's own sign-out like the one below |
| `POST /me/sign-ins/report` | `iam.self` | Report a sign-in that was not me (2026-11-24, My access, its sign-ins, where the sign-in alert now sends a person; no body): reads the other sign-ins still open (each browser by name, its country, when), ends every sign-in of mine, then hands `reported` a `SignInReport` (tenant, person, address, when, the other browsers) inside the same audited step (`iam.sign-in-reported`, with how many were ended and how many others there were), so a report nobody hears of never reads as done; then 303 to Access's own sign-out. The client template turns it into a critical alert (`report.sign-in.<person>.<when>`, words from `signInReportAlert`), emailed to the alert recipients at once and marked resolved by hand once it is safe |
| `POST /me/sign-out` | `iam.self` | Sign out (the sidebar's plain form; no body): ends this sign-in (`iam.sign-out` in the audit log), then answers 303 to `/cdn-cgi/access/logout` (`ACCESS_SIGN_OUT`), Cloudflare Access's own sign-out, which clears the door's cookie and ends the Access session |
| `GET /me/grants`, `POST /me/grants/:id/activate` | `iam.self` | the grants that reach me; bring an eligible one into force for a few hours |
| `GET /me/options` | `iam.self` | what I may ask for: every role but the Owner's and every place, by name, so a member who cannot read the Access page can still ask |
| `GET /todo` | `iam.self` | Home's Needs you: what waits for me (`waitingFor`, above) |
| `GET`, `POST /me/requests`, `DELETE /me/requests/:id` | `iam.self` | my access requests: ask for a role at a scope, withdraw |
| `GET`, `POST /me/approvals`, `POST /approvals/:id/decision` | `iam.self` | the approvals I asked for; ask a second person; decide one (you must hold the same power and not be the one who asked) |
| `GET /tenant`, `/capabilities`, `/people`, `/people/:id`, `/groups`, `/groups/:id`, `/roles`, `/roles/:id`, `/scopes`, `/bindings`, `/overrides`, `/invitations`, `/requests`, `/approvals`, `/reviews`, `/reviews/:id` | `iam.read` | the company, the registry and every list the screens show, filtered by status, scope, role, subject or person; `/bindings?inForce=true` for the grants in force now; each binding carries its location's name and parent (`scopeName`, `scopeParentId`, 2026-11-22), so a role's badge can name where it holds |
| `GET /people/:id/access?scopeId=` | `iam.read` | "See it as" (plan 7.3): every capability, with its `area.thing.verb` `name` beside its id (2026-11-22, for the rows' names to copy), with whether the person may use it at the place (the company when none is named) and the check's reason (`owner`, `allow`, `deny`, `not_granted`, a floor), compiled from the rows as their next request would be, and `sources`: the grants behind it at that place or above it (`kind` `role` with the role's and the group's name, or `exception`; `effect`, `scopeId`, `expiresAt`), by the compiler's own rules (`sourcesOf`); `active: false` and no items for an account switched off. Read only: it makes no session and touches none, so nothing can be done as them |
| `POST /bindings`, `DELETE /bindings/:id`, `POST /overrides`, `DELETE /overrides/:id` | `iam.bindings.manage` | grant and end, under the grant rules; one-capability exceptions |
| `GET /keys`, `POST /keys`, `DELETE /keys/:id` | `iam.keys.manage` | the API keys: listed without the key, made (the key shown once, 201), revoked (204); see API keys above |
| `POST /invitations`, `POST /invitations/many`, `POST /invitations/:id/again`, `DELETE /invitations/:id` | `iam.bindings.manage` | invite an address to a role at a scope (the token is answered once, here), or up to fifty addresses at once, each under the same rules and a refusal stopping none (`made` and `refused`, a refusal naming the account or the waiting invitation as `personId` or `invitationId`); with `send`, each link is emailed; send a pending invitation again with a new link; withdraw |
| `POST /requests/:id/decision`, `POST /reviews`, `POST /reviews/:id/items/:bindingId`, `POST /reviews/:id/close` | `iam.bindings.manage` | decide a request; open a review of a scope, decide each grant, close it |
| `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id` | `iam.roles.manage` | roles below your standing, with capabilities you hold |
| `POST /groups`, `PATCH /groups/:id`, `DELETE /groups/:id`, `POST /groups/:id/members`, `DELETE /groups/:id/members/:principalId` | `iam.groups.manage` | groups and their members, never yourself |
| `POST /scopes`, `PATCH /scopes/:id`, `DELETE /scopes/:id` | `iam.scopes.manage` | the tree, four levels at most; two locations of one name (whatever its case) under the same parent are refused (`KIT-E-2010`, since 2026-11-15) |
| `PUT /tenant/vendor-access`, `POST /tenant/vendor-window` | `iam.tenant.manage` | how the Vendor may enter; the window an Owner opens |
| `POST /tenant/incident`, `DELETE /tenant/vendor-window` | `iam.self` | the Vendor declares an incident (the handler lets only the Vendor through); the Vendor or an Owner closes a window early |
| `POST /tenant` | `iam.vendor.manage` | the Vendor creates the one company and invites its first Owner |
| `GET /vendors`, `POST /vendors`, `PUT /vendors/:id/active` | `iam.vendor.manage` | the Vendor accounts, on or off; add one by its address; switch one off or on, never your own or the last one on |
| `GET /setup-people` | `iam.bindings.manage` | the people setup step 2 named (`iam.setup_people`) who are not users and hold no pending invitation, each with what they are (`owner`, `staff`, `team`); a named `vendor` is left out, since it needs no invitation |
| `POST /invitations/accept` | open to any identity | the invited person, signed in at the door with no account yet, takes the grant: with the token from the link, or without one the newest invitation waiting for the signed-in address |
| `POST /invitations/mine` | open to any identity | the newest invitation waiting for the signed-in address: the company, the role and the place, never the token (`{ invitation: null }` when none) |

The last two routes are the pipeline's one exception (`access: 'identity'` in `@oltrem/core-module`):
no session is loaded and no capability checked, since the person has no account; the body is
still validated and the same-origin check still applies. `/invitations/mine` is a read made a
POST for that reason. Accepting without the token is safe because the address is the one Access
proved with its email code, the same check the token's address gets (`KIT-E-2016`): the link only
helps find the invitation, and a person with nothing waiting is refused (`KIT-E-2015`, "no
invitation waits for this address"). The incident and window routes name
`iam.self` because under `incident_only` and `approval` the check refuses the Vendor everything,
the very reason it needs a way to declare the incident; the handover functions decide who may
open and close by the mode. Reads are not audited; every write goes through the governance or the
handover and is. The registry `GET /capabilities` and "See it as" list is read once per isolate,
like the capability index, and again after the startup registers a changed module: it changes
only with a deploy, so People and Access pages do not read its rows on every request.

Given `off` (the parts switched off on the Features page, `@oltrem/core-config`), a switched-off
module's capabilities stay registered and active, but `GET /capabilities` and "See it as" leave
them out, so the role and exception forms do not show them; `PATCH /roles/:id` with a list of
capabilities keeps the ones of a switched-off module the role already holds, so saving a role
from a form that does not show them never takes them away. Back on, they show again with every
grant where it was (`test/parts.test.ts`).

## Permission names

Since 2026-11-22 (the access review, the owner's yes) every permission reads
`<area>.<thing>.<verb>`: its area named like its sidebar section, its verb one of ten (`read`,
`edit`, `delete`, `manage`, `request`, `approve`, `send`, `export`, `share`, `run`). The ids stored
before never change: `src/aliases.ts` gives each that does not fit its new name (`ALIASES`,
`nameOf`, `idOf`), `GET /capabilities` carries it as `name`, and the screens' Policy JSON reads
and accepts either. A permission added later is named this way from the start: the client
template's screens test refuses any other (`NAME_PATTERN`). Tests: `test/aliases.test.ts`.

## Tables

Migration `0004_iam.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`iam_tenants`, `iam_principals` (kinds `person`, `service`, `vendor`; the Vendor row exists from
the migration), `iam_modules`, `iam_capabilities`, `iam_scopes`, `iam_groups`,
`iam_group_members`, `iam_roles` (position `0` is the Owner role), `iam_role_caps`,
`iam_bindings`, `iam_overrides` (`0004` also made `iam_policy_compiles`, dropped by `0078`).
Migration `0005_iam_governance.sql` adds
`activated_from` to `iam_bindings` (the eligible grant an activation came from) and the tables
`iam_access_requests`, `iam_approvals`, `iam_reviews` and `iam_review_items`. Migration
`0006_iam_handover.sql` adds `handed_over_at`, `vendor_window_until` and `vendor_window_reason`
to `iam_tenants` and the table `iam_invitations`. Ids are text. Migration
`0076_iam_ready_role_names.sql` (2026-11-22) renames the ready-made roles Full admin, Standard
user and View only to Admin, Member and Viewer, each only where no role of the new name exists
in that company, so it runs twice the same. Migration `0078_iam_drop_policy_compiles.sql`
(2026-11-22, the owner's yes in the database review) drops `iam_policy_compiles` and its index,
which nothing has read ever or written since kit `053f26e`; marked `-- contract:`, it shipped a
release after the code that stopped writing it (the live portal's last row, read through the
Cloudflare connector on 2026-11-22, was from before that release). Migration
`0089_iam_api_keys.sql` (2026-11-24) adds `iam_api_keys`: a key's id, company, service account,
name, the hash of its secret, who made it and when, its end, last use and revoke time.

## Errors

The module owns the `2000` to `2099` block: `KIT-E-2001` a bad capability list, `KIT-E-2002` an
unknown or inactive account, `KIT-E-2003` a bad scope tree (deeper than four levels, a loop, or
more than one root), `KIT-E-2004` a dangerous action without a fresh sign-in, `KIT-E-2005` an
email the door let in that has no active account here, `KIT-E-2006` a sign-in that was ended
(from the sessions list, by its end time, or by a block or a switch off), `KIT-E-2007` a change beyond the actor's standing, `KIT-E-2008` a change
to one's own access, `KIT-E-2009` the last Owner, `KIT-E-2010` a grant that does not fit the
rules, `KIT-E-2011` a second person's approval missing, `KIT-E-2012` an approval that does not
fit, `KIT-E-2013` a review closed with grants undecided, `KIT-E-2014` a second company,
`KIT-E-2015` an invitation that cannot be used (unknown, used, withdrawn, a week old),
`KIT-E-2016` an invitation taken with another address, `KIT-E-2017` a sign-in while the account
is blocked, with the time it ends (`iam_principals.blocked_until`, migration `0065`, written by
the Users module). A sign-in at another Access application
answers with the core's `KIT-E-0401`; a grant, request, approval, review or invitation that does
not exist with the core's `KIT-E-0404`.

## Tests

`test/sign-out.test.ts`: signing out ends the sign-in and hands over to Cloudflare's own sign-out,
and the module keeps no door (no hook, no job, no health check, only `iam.setup_people`).

Inside the Workers runtime, against the real migration: the registry's rules and bit stability;
the tree's limits; a small tenant decided case by case (owner, vendor, floors, deny over allow,
inheritance, siblings, groups, time, eligibility, overrides, the hash and the compile record,
"See it as" with where each permission comes from, and the Vendor holding a module registered
after its map was compiled, at every scope, its floors included);
and a synthetic tenant of three locations, four departments, twelve roles and forty people on
which 320 generated decisions of the compiled check are compared with a plain evaluator that
reads the rows one question at a time (`test/reference.ts`). The sessions are tested with the KV
writes counted (one on the first request, none on the next), a grant ending and the day passing,
the dangerous route's re-read, a revoke seen on the next request, an ended sign-in, the audience
read from the env with an empty one refusing everyone, an identity the runtime did not vouch for
refused under every audience, and the whole pipeline from the runtime's `ctx.access` to the
problem codes. The governance is tested on a tenant of
four scopes, four roles and twelve people, every rule refused and then obeyed: the standing at a
scope, the self-edit, the dates, the Owner made and unmade with approvals that fit one change
once, an eligible grant activated and lapsed, roles edited only with what is held where they are
granted, members placed by the standing over the group's grants, the tree's depth, a deny
override beating the role, a request decided in the decider's name, a review closed only when
decided, the audit rows with the policy hash and the deferred write, and the last Owner. The
handover is tested from an empty portal: the Vendor creates the company and nobody else can, the
first Owner accepts with the invited address and the tenant is stamped, a second Owner invited
before the handover and a third only with a second person after it, an ordinary invitation under
the grant rules, the Vendor refused every role, the Owner role's minimum and a new module's
capability joining it at deploy, and the three ways the Vendor may enter, with a window that runs
out by itself. The plan's `can()` timing budget is measured on the sandbox, not here: the test
runtime does not advance its clock during a check. The routes are tested end to end through the
pipeline, from an empty portal: the Vendor creates the company over its route, the first Owner
with no account accepts through the open route and is refused with a wrong token or another
address, the lists answer with their shapes and refuse a bad page, the Owner shapes the company
and invites a clerk who reads but cannot shape, invites several at once (duplicates folded, their
own address refused, the others made and emailed, a failing sender leaving the link to pass on,
fifty at most), grants are made, activated, ended and overridden,
a request is decided and another withdrawn, an approval asked and refused to the wrong person, a
review decided and closed, the three Vendor modes with the incident and the window, and a sign-in
ended from the devices list and refused from then on. The startup hook is tested through three
apps on one IAM instance: the door's refusal runs nothing, the first request past it registers
both mounted modules, the Owner holds a new module's capability at once, a declaration grown
under the same version is not seen, and a bumped version is, with the index replaced and the
Owner's session recompiled without a new sign-in. The care is tested on the rows: only a
person's own grant ending within the week is noticed (not one ended, later, eligible, a deny, an
inactive person's, a group's or an activation), a renewed end is noticed again, a refused message
fails the run after the others, and the review check moves from none due, to none yet, to on time,
to past due, to none for a quarter. `test/sign-in-alerts.test.ts`: the first sign-in and the same
browser after an update are nothing new, another browser is, a known browser from another country
within the hour is unusual and after 61 minutes only new, a row without a country compares by
browser alone; an address with no account is recorded once an hour; the alert names the browser,
the country and the way out, and is sent only while the extra is on; Sign out everywhere ends
both browsers; the week's check warns and counts.

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
the check read the same index.

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
a `sha256-` hash of all of it. Every compile is recorded in `iam_policy_compiles` with that hash,
so a decision can be replayed. A map is a few hundred bytes to a few kilobytes.

`can` decides in this order, and refuses when in doubt (R-10):

1. An unknown or inactive capability: `unknown_capability`, `inactive_capability`.
2. A scope that is not in the tree: `unknown_scope`, whoever asks.
3. The Vendor: `vendor` (allow), unless the tenant set its access to `approval` or
   `incident_only` and no window is open (below, the handover). The Vendor holds by its kind,
   not by bits, so it holds every capability the index knows, a module registered after the
   company was made included, the moment the registry has it, with no grant and no recompile.
4. A capability on the vendor floor, for anyone else: `vendor_floor`.
5. An Owner (the Owner role at the root, in force): `owner` (allow).
6. Otherwise walk from the scope up to the root: a deny bit on any node is `deny`; an allow bit on
   any node is `allow`; nothing found is `not_granted`.

Floors are applied at compile time: a capability with `floor: owner` enters the bits only from
the Owner role (position `0`), never from another role or an override; a vendor-floor capability
never enters a map. An *eligible* binding, an expired one and one not yet started grant nothing;
`refreshAt` says when to compile again.

## Sessions and the authorizer

```ts
import { createApp } from '@oltrem/core-http';
import { asSession, createSessions } from '@oltrem/iam';

const sessions = createSessions<Env>({
  bindings: (env) => ({ kv: env.CACHE, db: env.DB }),
  audience: (env) => env.ACCESS_AUD, // read on each request; a token for another application is refused
});
const app = createApp<Env>({ modules, session: sessions.hook, authorize: sessions.authorize });

// in a handler
const { access } = asSession(ctx.session);
can(access, index, 'rooms.cancel', input.scopeId); // the scope at hand
allowedScopes(access, index, 'rooms.read'); // for WHERE scope_id IN (...)
```

The **audience** is the Worker secret `ACCESS_AUD`, whose key recipe (`ACCESS_AUD_RECIPE`) the
module declares: `worker` (`WORKER_AUDIENCE`) when Access stands on the Worker itself, which
`npm run deploy` sets and which lets in only an identity marked `door: 'worker'`, or the tag of a
hostname Access application. Given as a function it is read from the
env on each request, so the Worker file needs no Workers-only import at module scope and the tool
can still load it; an empty tag is one no token names, so a Worker without the secret refuses
everyone (`KIT-E-0401`).

The door (Cloudflare Access) signs the person in and keeps its own cookie; the kit sets none. On
each request the **hook** reads one KV record, `sess:<email>`, carrying the compiled map, its hard
expiry (a day after the compile) and the person's sign-ins. It compiles afresh, and writes once,
when the record is missing, a day old, past the map's `refreshAt` (a grant started or ended), or
when the tenant's policy version has moved, which an isolate checks against the database at most
every `recheckSeconds` (five minutes) per person. An email with no active account is refused
(`KIT-E-2005`). Nothing writes per request: KV allows 1,000 writes a day on the free plan.

A **device** is one sign-in at the door, keyed by the token's issue time, which stays the same
for the whole of that sign-in and differs between browsers. The first request of a sign-in adds
it to the record (one write; the ten most recent are kept); `revokeDevice` ends one, and that
sign-in is refused from then on (`KIT-E-2006`) until the person signs in again.

The **authorizer** refuses when the hook did not run (no session: fail closed), then asks
`holdsAnywhere`: the capability at the root or at any scope with a grant, since a route is the
widest question and the handler narrows to the scope at hand. On a route whose capability is
flagged `freshSignIn` or `secondPerson` it first re-reads the tenant's policy version and
recompiles if it moved (plan 7.2, step 6), so a revoke reaches a dangerous action at once. An
allow on a `freshSignIn` capability then needs a sign-in within `freshMinutes` (ten), else
`KIT-E-2004`; the second-person gate is the governance step's, with the approvals it needs. One
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
The rules, each refused with its own code:

- **You grant only what you hold.** A role goes to a person or group at a scope only if the actor
  holds `iam.bindings.manage` there (`iam.owners.manage` for the Owner role) and the role's
  position is below the actor's own standing at that scope: the best position they hold there or
  above it (`rankAt`). A capability enters a role only if the actor holds it at every scope where
  the role is granted (anywhere, for a role not granted yet); a role is made or edited below the
  actor's best position; the Owner role is edited by the Vendor alone and never deleted.
  Otherwise `KIT-E-2007`. A refusal about a role names the permission by its label in words
  ("you do not hold “See the people directory” yourself") and a place by its name, not by id.
- **Never for yourself.** Nobody changes their own grants, overrides or group membership, nor the
  grants of a group they belong to (`KIT-E-2008`); they request access instead.
- **No role twice at one place.** A grant of a role the person or group already holds at that
  place, in force and held the same way (both eligible or both not), is refused in plain words
  (`KIT-E-2010`): change or end the one in force instead.
- **Every grant but the Owner's expires**: ninety days unless an expiry is given, a year at most,
  and it may start later; an override has the same window. An *eligible* grant is held but not in
  force until its holder activates it, for one to twelve hours (four unless said) with a reason;
  the activation is a grant of its own, linked back to the eligible one.
- **An Owner is made or unmade only with a second person.** The actor asks for an approval that
  names the capability, the scope, the action and the exact change (hashed); another holder of
  the capability approves within the hour; the change spends the approval, once, and refuses one
  that is pending, someone else's, expired, spent or for another change (`KIT-E-2011` when none
  is given, `KIT-E-2012` otherwise). Modules use the same approvals for their own `secondPerson`
  capabilities through `requestApproval`, `decideApproval` and `useApproval`. The last Owner at
  the root is never ended (`KIT-E-2009`).
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
```

The **Vendor** is the one account that exists before the company does: tenant-less, with every
capability and every floor, its address set at setup. It alone creates the company (plan 7.4):
one per portal (`KIT-E-2014` for a second), with its root scope, its **Owner role** at position
`0` holding every capability but the Vendor's, and one **invitation** to the first Owner. The
Vendor holds no role, group or override of the company's, before or after: its access is its
kind, and the company sets how it may enter.

An **invitation** gives one role at one scope to one email address: single use, a week, under
the grant rules of the governance (`invite`, `revokeInvitation`), and the token travels once in
the link while the row keeps its hash. `acceptInvitation` runs on the identity alone, since the
person has no account yet: the address must be the invited one (`KIT-E-2016`), the invitation
pending and in date (`KIT-E-2015`); it creates the account (or finds the one with that address),
makes the grant in the inviter's name and records the acceptance. The first Owner's acceptance is
the **handover**, stamped on the tenant: before it the Vendor alone invites Owners, since nobody
else could approve, and the record says so; from then on an Owner is made, invited or unmade
only with a second person, and the last one stays.

An invitation can be **emailed**. The client hands `createIam` a `mail(env, message)` (the client
template sends it through the email module, as the plain template `iam.message`);
when the inviter asks (`send: true`), the module writes the message, naming who invited, the
company, the role, the place, the link and its last day, keyed `iam.invitation:<id>` so it goes
once. The link is then held by the email module's outbox until it is delivered, as any message
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

The module keeps two rules without anyone having to remember them (`src/care.ts`):

| Kind | Id | What it does |
|---|---|---|
| Job, daily | `iam.expiring` | Emails each active person whose own grant ends within 7 days (`EXPIRY_NOTICE_DAYS`): the company, the role, the place and the date, keyed `iam.expiring:<grant>:<end>`, so it goes once for each end date and again if the grant is renewed to a new one. Activations and grants through a group are not noticed. 200 a run at most; a message the sender refuses fails the run after the others are tried, and the next run sends what is missing. Without `mail`, it does nothing. |
| Health check, lane `access` | `iam.reviews` | Warns when an open access review is past its due date, or when none was opened for 90 days (`REVIEW_EVERY_DAYS`), counted from the company's creation until the first one. |

Both only read the rows. The notice goes through the same `mail` as an invitation, and the
health page shows the check's last result with the others.

Home's "Needs you" (`todo`, `src/todo.ts`) asks the module for what waits for the person signed
in, under `iam.self`: the access requests and second-person approvals they may decide, each
access review with grants they may keep or remove, and their own grants ending within 7 days.
`waitingFor` counts with the rules the decisions check (`standingAt`, `can`, never one's own
request, approval or grant), so a person is never sent to a decision the API would refuse.

## The door, kept in step

Cloudflare Access stands on the Worker itself (ACCESS_AUD `worker`). Given `door` (`src/door.ts`),
the module keeps it letting in exactly the portal's people, by a code sent to their email:

```ts
createIam({ ...,
  door: {
    token: (env) => env.KIT_OPS_TOKEN,                // Access: Apps and Policies, and Organizations, Identity Providers, and Groups
    account: async (env) => (await settingsFor(env)).get('backup.account_id'),
    settings: (env) => settingsFor(env),              // iam.door_worker_id, iam.door_extra_emails
  },
});
```

Why: Cloudflare's one-click "Protect this Worker behind Access" admits members of the Cloudflare
account, and a Zero Trust organization made since June 2026 has only the "Cloudflare" login, so
anyone else reads "Cloudflare sign-in is restricted to members of the account". `syncAccess` reads
each piece first and writes only what differs: Zero Trust is set up (a person does that once:
team name, Free plan; `no-zero-trust` until then); the One-time PIN login exists; one reusable
allow policy, `DOOR_POLICY_NAME`, includes every active person's address (the Vendor's included),
every pending invitation's, and each entry of `iam.door_extra_emails` (an address, or
`@company.example` as an email domain); and the Access application whose destination is this
Worker (`iam.door_worker_id`, which the deploy writes) uses only that login, goes straight to it
(`auto_redirect_to_identity`), links only that policy, and leaves `DOOR_OPEN_PATHS` public
(`/hooks/*`, `/healthz`, `/account`, `/account/*`, `/ui/*`) as destination overrides. That
application is edited, never replaced, so its audience and the runtime's word stay the same; one
is made only when the Worker has none.

| Kind | Id | What it does |
|---|---|---|
| Job, every 5 minutes | `iam.door` | `door.sync`: works out who is wanted (two D1 reads), and calls Cloudflare only when that list, the account or the Worker changed, an hour has passed since it last matched, or a failure is due another try (15 minutes; an hour when a person must act). The outcome is one KV key, `iam:door`. |
| Hook | `POST /hooks/iam/door` | The same sync, at once; answers only `{ state }`, the outcome word. The deploy calls it. |
| Health check, lane `access` | `iam.door` | `ok` with how many may sign in; `warn` while a piece the deploy gives is missing; `fail` with `DOOR_ADVICE` and Cloudflare's answer when it refused. |

Making or withdrawing an invitation, and creating the company, call `door.soon` after the
response: a failing door never fails the change, it shows on the health page. Switching a person
off (the users module) is followed by the next tick. Without `door` none of this is mounted and
the door is the Vendor's to keep by hand.

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
a pull of the kit that added a capability under the same version):
the new ones join every Owner role, each tenant's policy version moves so the sessions recompile
on their next request, and the index the check reads is replaced. A version already seen costs
one read. A change to the capabilities under the same version is seen too: a copy whose
database was made before a pull would otherwise refuse the new capabilities to everyone, the
Vendor included. The IAM module declares its own eight on plane `0` the same way, so the registry fills
itself on the first request of a new client.

The manifest: fifty-eight JSON routes under `/api/iam` (the Home card's `GET /home`, under
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
| `POST /me/sign-out` | `iam.self` | Sign out (the sidebar's plain form; no body): ends this sign-in (`iam.sign-out` in the audit log), then answers 303 to `/cdn-cgi/access/logout` (`ACCESS_SIGN_OUT`), Cloudflare Access's own sign-out, which clears the door's cookie and ends the Access session |
| `GET /me/grants`, `POST /me/grants/:id/activate` | `iam.self` | the grants that reach me; bring an eligible one into force for a few hours |
| `GET /me/options` | `iam.self` | what I may ask for: every role but the Owner's and every place, by name, so a member who cannot read the Access page can still ask |
| `GET /todo` | `iam.self` | Home's Needs you: what waits for me (`waitingFor`, above) |
| `GET`, `POST /me/requests`, `DELETE /me/requests/:id` | `iam.self` | my access requests: ask for a role at a scope, withdraw |
| `GET`, `POST /me/approvals`, `POST /approvals/:id/decision` | `iam.self` | the approvals I asked for; ask a second person; decide one (you must hold the same power and not be the one who asked) |
| `GET /tenant`, `/capabilities`, `/people`, `/people/:id`, `/groups`, `/groups/:id`, `/roles`, `/roles/:id`, `/scopes`, `/bindings`, `/overrides`, `/invitations`, `/requests`, `/approvals`, `/reviews`, `/reviews/:id` | `iam.read` | the company, the registry and every list the screens show, filtered by status, scope, role, subject or person; `/bindings?inForce=true` for the grants in force now |
| `GET /people/:id/access?scopeId=` | `iam.read` | "See it as" (plan 7.3): every capability with whether the person may use it at the place (the company when none is named) and the check's reason (`owner`, `allow`, `deny`, `not_granted`, a floor), compiled from the rows as their next request would be, and `sources`: the grants behind it at that place or above it (`kind` `role` with the role's and the group's name, or `exception`; `effect`, `scopeId`, `expiresAt`), by the compiler's own rules (`sourcesOf`); `active: false` and no items for an account switched off. Read only: it makes no session and touches none, so nothing can be done as them |
| `POST /bindings`, `DELETE /bindings/:id`, `POST /overrides`, `DELETE /overrides/:id` | `iam.bindings.manage` | grant and end, under the grant rules; one-capability exceptions |
| `POST /invitations`, `POST /invitations/many`, `DELETE /invitations/:id` | `iam.bindings.manage` | invite an address to a role at a scope (the token is answered once, here), or up to fifty addresses at once, each under the same rules and a refusal stopping none (`made` and `refused`); with `send`, each link is emailed; withdraw |
| `POST /requests/:id/decision`, `POST /reviews`, `POST /reviews/:id/items/:bindingId`, `POST /reviews/:id/close` | `iam.bindings.manage` | decide a request; open a review of a scope, decide each grant, close it |
| `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id` | `iam.roles.manage` | roles below your standing, with capabilities you hold |
| `POST /groups`, `PATCH /groups/:id`, `DELETE /groups/:id`, `POST /groups/:id/members`, `DELETE /groups/:id/members/:principalId` | `iam.groups.manage` | groups and their members, never yourself |
| `POST /scopes`, `PATCH /scopes/:id`, `DELETE /scopes/:id` | `iam.scopes.manage` | the tree, four levels at most |
| `PUT /tenant/vendor-access`, `POST /tenant/vendor-window` | `iam.tenant.manage` | how the Vendor may enter; the window an Owner opens |
| `POST /tenant/incident`, `DELETE /tenant/vendor-window` | `iam.self` | the Vendor declares an incident (the handler lets only the Vendor through); the Vendor or an Owner closes a window early |
| `POST /tenant` | `iam.vendor.manage` | the Vendor creates the one company and invites its first Owner |
| `POST /invitations/accept` | open to any identity | the invited person, signed in at the door with no account yet, takes the grant with the token from the link |

The last route is the pipeline's one exception (`access: 'identity'` in `@oltrem/core-module`):
no session is loaded and no capability checked, since the person has no account; the body is
still validated and the same-origin check still applies. The incident and window routes name
`iam.self` because under `incident_only` and `approval` the check refuses the Vendor everything,
the very reason it needs a way to declare the incident; the handover functions decide who may
open and close by the mode. Reads are not audited; every write goes through the governance or the
handover and is.

Given `off` (the parts switched off on the Parts page, `@oltrem/core-config`), a switched-off
module's capabilities stay registered and active, but `GET /capabilities` and "See it as" leave
them out, so the role and exception forms do not show them; `PATCH /roles/:id` with a list of
capabilities keeps the ones of a switched-off module the role already holds, so saving a role
from a form that does not show them never takes them away. Back on, they show again with every
grant where it was (`test/parts.test.ts`).

## Tables

Migration `0004_iam.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`iam_tenants`, `iam_principals` (kinds `person`, `service`, `vendor`; the Vendor row exists from
the migration), `iam_modules`, `iam_capabilities`, `iam_scopes`, `iam_groups`,
`iam_group_members`, `iam_roles` (position `0` is the Owner role), `iam_role_caps`,
`iam_bindings`, `iam_overrides`, `iam_policy_compiles`. Migration `0005_iam_governance.sql` adds
`activated_from` to `iam_bindings` (the eligible grant an activation came from) and the tables
`iam_access_requests`, `iam_approvals`, `iam_reviews` and `iam_review_items`. Migration
`0006_iam_handover.sql` adds `handed_over_at`, `vendor_window_until` and `vendor_window_reason`
to `iam_tenants` and the table `iam_invitations`. Ids are text.

## Errors

The module owns the `2000` to `2099` block: `KIT-E-2001` a bad capability list, `KIT-E-2002` an
unknown or inactive account, `KIT-E-2003` a bad scope tree (deeper than four levels, a loop, or
more than one root), `KIT-E-2004` a dangerous action without a fresh sign-in, `KIT-E-2005` an
email the door let in that has no active account here, `KIT-E-2006` a sign-in that was ended
from the devices list, `KIT-E-2007` a change beyond the actor's standing, `KIT-E-2008` a change
to one's own access, `KIT-E-2009` the last Owner, `KIT-E-2010` a grant that does not fit the
rules, `KIT-E-2011` a second person's approval missing, `KIT-E-2012` an approval that does not
fit, `KIT-E-2013` a review closed with grants undecided, `KIT-E-2014` a second company,
`KIT-E-2015` an invitation that cannot be used (unknown, used, withdrawn, a week old),
`KIT-E-2016` an invitation taken with another address. A token for another Access application
answers with the core's `KIT-E-0401`; a grant, request, approval, review or invitation that does
not exist with the core's `KIT-E-0404`.

## Tests

`test/door.test.ts` runs the door against an in-memory stand-in for Cloudflare's Access API: who is
wanted, the one-click application turned to the code by email and kept, nothing written when in
step, Cloudflare skipped while nothing changed and asked again an hour later, each refusal named,
and an invitation answered 201 while the door fails.

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
read from the env with an empty one refusing everyone, and the whole pipeline from the Access
headers to the problem codes. The governance is tested on a tenant of
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
to past due, to none for a quarter.

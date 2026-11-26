---
title: "@oltrem/iam: Governance; The Vendor and the handover"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src; split from modules/iam/README.md]
---

# @oltrem/iam: Governance; The Vendor and the handover

> Part of [the @oltrem/iam README](../README.md).

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
- **Overrides by floor**. A permission with no floor is allowed or denied by whoever may give at
  that place and holds it themselves. An Owner-floor permission is never allowed by an override (it
  comes with the Owner role only) and is denied only to an Owner. A Vendor-floor permission is
  allowed by the Vendor alone, and never denied (no one else holds it to take away); only the Vendor
  ends such an allow. An override on an Owner is made or ended by the Vendor or another Owner; on
  anyone else, by someone whose standing there is above every role the person holds (`KIT-E-2007`
  otherwise). An Owner's People and access permissions (`iam.*`) are denied by the Vendor alone, so
  that two Owners can never strip each other of the means to undo it; the compile ignores such a
  deny written by anyone else.
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
- **An Owner is made or unmade with a second person only when the client wants it.** The setting
  `iam.owner_second_person` (Settings, Security, the Vendor's to change) is off by default, so
  whoever may make, invite or end an Owner does it alone; the Vendor is never asked either way. When
  it is on, the actor asks for an approval that names the capability, the scope, the action and the
  exact change (hashed); another holder of the capability approves within the hour; the change
  spends the approval, once, and refuses one that is pending, someone else's, expired, spent or for
  another change (`KIT-E-2011` when none is given, `KIT-E-2012` otherwise). Modules use the same
  approvals for their own `secondPerson` capabilities through `requestApproval`, `decideApproval`
  and `useApproval`. The last Owner at the root is never ended (`KIT-E-2009`), except by the Vendor
  before the handover: an Owner the Vendor made while setting the company up can be taken back.
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

**Several Vendor accounts**. Any account of kind `vendor` is a Vendor, so a portal may have more
than the one setup made: each signs in with its own address and shows under it in the audit log, and
the company's choice of how the Vendor may enter covers them all. Another one is made two ways:
named at setup as `vendor` (it gets its account at its first sign-in, before the company too,
below), or added by a Vendor on Vendor access (`addVendor`, `POST /vendors`; an address that has an
account already is refused). A Vendor switches another off or on (`setVendorActive`): its session
ends from the next request, its row stays for the record, and neither its own account nor the last
one on is ever switched off. Audit rows: `iam.vendor-add`, `iam.vendor-on`, `iam.vendor-off`
(`modules/iam/test/setup-admit.test.ts`).

An **invitation** gives one role at one scope to one email address: single use, a week, under the
grant rules of the governance (`invite`, `revokeInvitation`), and the token travels once in the link
while the row keeps its hash. `acceptInvitation` runs on the identity alone, since the person has no
account yet: the address must be the invited one (`KIT-E-2016`), the invitation pending and in date
(`KIT-E-2015`); it creates the account (or finds the one with that address), makes the grant in the
inviter's name and records the acceptance, and closes any other invitation still waiting for that
address. The invitation is taken first, and only while it still waits: of two sign-ins taking it at
once (a double tap, two tabs), or one withdrawn meanwhile, the second is refused with `KIT-E-2015`
and makes no second grant; a grant that fails leaves it waiting again . One invitation waits per
address: an address that has an account here is refused (`KIT-E-2010`, "give them the role on their
page", with `details.principalId`), and so is one with an invitation waiting (`KIT-E-2010`, the day
it was made, with `details.invitationId`); `POST /invitations/many` passes these on as `personId`
and `invitationId` in `refused`. **Send again** (`inviteAgain`, `POST /invitations/:id/again`) gives
a pending invitation a new link and a new week, so the old link stops working (`iam.invite-again` in
the audit log); with `send` the new link is emailed under its own message key. The first Owner's
acceptance is the **handover**, stamped on the tenant: before it the Vendor alone invites Owners,
since nobody else could approve, and the record says so; from then on an Owner is made, invited or
unmade with a second person only when `iam.owner_second_person` is on and the actor is not the
Vendor, and the last one stays.

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

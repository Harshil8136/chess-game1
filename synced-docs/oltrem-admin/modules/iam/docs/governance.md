---
title: "@oltrem/iam: governance, the Vendor and the handover"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src/governance.ts, handover.ts, module.ts]
---

# @oltrem/iam: governance, the Vendor and the handover

> Part of [the @oltrem/iam README](../README.md).

## Governance

```ts
import { createGovernance } from '@oltrem/iam';

const governance = createGovernance<Env>({
  bindings: (env) => ({ kv: env.CACHE, db: env.DB }),
  sessions,
});
// actorOf(ctx): the session, the request id and waitUntil, so the audit row lands after the answer
await governance.grant(env, actorOf(ctx), { subjectKind: 'principal', subjectId, roleId, scopeId, reason });
```

`createGovernance` holds every write that changes who may do what: grants and their end, eligible
grants and activations, roles, groups and members, scopes, overrides, requests, approvals and
reviews. Each reads the actor's standing from their session's compiled map, writes the rows,
refreshes affected sessions (`invalidate` for one person, `invalidateTenant` after a group, role or
tree change) and writes an audit row, refusals included, with the policy hash. Rows name what they
touched in words: `role`, `person`, `group`, the grant's `name` (`Clerk for ann@example.com`), and
a role's changes with the permissions `added` and `removed`.

Every module audits through `recorded(options, actor, action, target, details, work, outcome?)`:
it runs the work, then writes the row whatever happened. The work gets `note(facts)` for the
record's `name` and its `changes` (`changesOf`, from `@oltrem/core-audit`). A row over the audit's
4 KB keeps its place but drops `changes`, `added` and `removed`, with `cut` saying so.

| Rule | What it means | Refused with |
|---|---|---|
| You grant only what you hold | A role goes to a person or group at a scope only if the actor holds `iam.bindings.manage` there (`iam.owners.manage` for Owner), the role sits below the actor's best position there (`rankAt`), and the actor holds every permission it carries there. The same holds for invitations, group members and API keys. `GET /roles` marks `mine` the roles the reader may give. A role is made or edited only below the actor's position; the Owner role is the Vendor's to edit and is never deleted. Refusals name the permission and the place in words. | `KIT-E-2007` |
| Never for yourself | Nobody changes their own grants, overrides or groups, or a group they belong to; they request access. | `KIT-E-2008` |
| Overrides by floor | No floor: allowed or denied by whoever may give there and holds it. Owner floor: never allowed by override, denied only to an Owner. Vendor floor: allowed and ended by the Vendor alone, never denied. An override on an Owner is the Vendor's or another Owner's; on anyone else, someone above every role they hold. An Owner's `iam.*` permissions are denied by the Vendor alone (two Owners can never strip each other). | `KIT-E-2007` |
| No role twice at one place | A role already held there the same way, in force. | `KIT-E-2010` |
| Grants last until ended | `iam.grant_days` (`GRANT_DAYS_SETTING`, an Owner's) sets a default end, 1 to 366 days; 0, the default, sets none. A given end is at most a year away; `expiresAt: null` means none. An *eligible* grant is activated for 1 to 12 hours (4 by default) with a reason, as a linked grant. | |
| A second person for Owners, if wanted | `iam.owner_second_person` (the Vendor's, off by default): when on, making or ending an Owner needs another holder's approval of the exact change (hashed) within the hour, spent once. Modules use the same approvals for their `secondPerson` capabilities (`requestApproval`, `decideApproval`, `useApproval`). The Vendor is never asked. | `KIT-E-2011`, `KIT-E-2012` |
| The last Owner stays | The last Owner at the root is never ended, except by the Vendor before the handover. | `KIT-E-2009` |
| Requests | A person asks for a role at a scope with a reason; it waits a week; whoever could grant it decides, and an approval grants in the decider's name. The requester may withdraw. | |
| Reviews | `openReview` lists every grant under a scope, due in two weeks; each is marked keep or remove by someone above it; `closeReview` refuses while one is undecided and ends the removed. An Owner is never removed in a review. | `KIT-E-2013` |
| Groups and scopes | A member joins only by the hand of someone who could make each of the group's grants. The tree is the Owners' (`iam.scopes.manage`): four levels, the root stays, anything with grants in its history is never deleted. | `KIT-E-2010` |

`KIT-E-2010` ("That cannot be done") also covers an unknown role, scope or person, a date out of
range, or a thing in use, its detail naming what to change. Before the company exists every write
is refused: "The company is not made yet: name it first on the Home page."

## The Vendor and the handover

```ts
import { createHandover } from '@oltrem/iam';

const handover = createHandover<Env>({ bindings: (env) => ({ kv: env.CACHE, db: env.DB }), sessions, audience: (env) => env.ACCESS_AUD });
const { invitation } = await handover.createTenant(env, actor, { name, ownerEmail }); // as the Vendor
await handover.acceptInvitation(env, ctx.identity, token, ctx.requestId); // or null: the newest for that address
```

**The Vendor** exists before the company: tenant-less, every capability and floor, its address set
at setup. It alone creates the company, one per portal (`KIT-E-2014`), with its root scope, the
**Owner role** at position `0` (every capability but the Vendor's) and an invitation to the first
Owner. It holds no role, group or override: its access is its kind, and the company decides how it
may enter.

**Several Vendors.** Any `vendor` account is a Vendor, each signing in and audited under its own
address. More come from setup (`vendor`, in at first sign-in) or Vendor access (`addVendor`, `POST
/vendors`; an existing address is refused). `setVendorActive` switches another off or on (its
session ends at the next request; never one's own or the last one on). Audit: `iam.vendor-add`,
`iam.vendor-on`, `iam.vendor-off`.

**Invitations** give one role at one scope to one address: single use, a week, under the grant
rules (`invite`, `revokeInvitation`); the token travels once, the row keeps its hash.
`acceptInvitation` runs on the identity alone: the address must match (`KIT-E-2016`) and the
invitation be pending and in date (`KIT-E-2015`). It makes or finds the account, grants in the
inviter's name and closes the address's other invitations. It takes the invitation first, so of two
sign-ins at once the second gets `KIT-E-2015`; a failed grant leaves it waiting. One invitation per
address: an existing account (with `details.principalId`) or a waiting invitation (with
`details.invitationId`) is `KIT-E-2010`, passed on by `POST /invitations/many` in `refused`.
**Send again** (`inviteAgain`, `POST /invitations/:id/again`) gives a new link and week, ending the
old link (`iam.invite-again`).

**Emailed invitations.** With `createIam`'s `mail(env, message)` and `send: true`, the module
writes who invited, the company, role, place, link and last day, ending with the main-inbox line,
keyed `iam.invitation:<id>` (`iam.invitation:<id>:<new last day>` when sent again). Without a
sender, or when it refuses, the answer says `sent: false` and the screens show the link to pass on.

**The handover** is the first Owner's acceptance, stamped on the tenant. Before it the Vendor alone
invites Owners.

**How the Vendor may enter** (`setVendorAccess`, an Owner's with `iam.tenant.manage`): `always`;
`approval`, refused until an Owner opens a 1 to 12 hour window with a reason (`openVendorWindow`,
`closeVendorWindow`); or `incident_only`, where the Vendor declares the incident and opens the
window itself, audited under its kind. The compiler reads the window, so the map is rebuilt when it
ends.

The Owner role keeps a minimum (`OWNER_MINIMUM`, the module's capabilities below the Vendor's
floor), and every capability new to the registry joins every Owner role at deploy, so a new
module's screens open to Owners by themselves; what the Vendor removed on purpose stays out.

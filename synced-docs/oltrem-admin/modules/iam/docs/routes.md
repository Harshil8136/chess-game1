---
title: "@oltrem/iam: The routes; Permission names; Tables"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src; split from modules/iam/README.md]
---

# @oltrem/iam: The routes; Permission names; Tables

> Part of [the @oltrem/iam README](../README.md).

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
| `POST /me/sign-ins/report` | `iam.self` | Report a sign-in that was not me (My access, its sign-ins, where the sign-in alert now sends a person; no body): reads the other sign-ins still open (each browser by name, its country, when), ends every sign-in of mine, then hands `reported` a `SignInReport` (tenant, person, address, when, the other browsers) inside the same audited step (`iam.sign-in-reported`, with how many were ended and how many others there were), so a report nobody hears of never reads as done; then 303 to Access's own sign-out. The client template turns it into a critical alert (`report.sign-in.<person>.<when>`, words from `signInReportAlert`), emailed to the alert recipients at once and marked resolved by hand once it is safe |
| `POST /me/sign-out` | `iam.self` | Sign out (the sidebar's plain form; no body): ends this sign-in (`iam.sign-out` in the audit log), then answers 303 to `/cdn-cgi/access/logout` (`ACCESS_SIGN_OUT`), Cloudflare Access's own sign-out, which clears the door's cookie and ends the Access session |
| `GET /me/grants`, `POST /me/grants/:id/activate` | `iam.self` | the grants that reach me; bring an eligible one into force for a few hours |
| `GET /me/options` | `iam.self` | what I may ask for: every role but the Owner's and every place, by name, so a member who cannot read the Access page can still ask |
| `GET /todo` | `iam.self` | Home's Needs you: what waits for me (`waitingFor`, above) |
| `GET`, `POST /me/requests`, `DELETE /me/requests/:id` | `iam.self` | my access requests: ask for a role at a scope, withdraw |
| `GET`, `POST /me/approvals`, `POST /approvals/:id/decision` | `iam.self` | the approvals I asked for; ask a second person; decide one (you must hold the same power and not be the one who asked) |
| `GET /tenant`, `/capabilities`, `/people`, `/people/:id`, `/groups`, `/groups/:id`, `/roles`, `/roles/:id`, `/scopes`, `/bindings`, `/overrides`, `/invitations`, `/requests`, `/approvals`, `/reviews`, `/reviews/:id` | `iam.read` | the company, the registry and every list the screens show, filtered by status, scope, role, subject or person; `/bindings?inForce=true` for the grants in force now; each binding carries its location's name and parent (`scopeName`, `scopeParentId`, 2026-11-22), so a role's badge can name where it holds |
| `GET /people/:id/access?scopeId=` | `iam.read` | "See it as" (plan 7.3): every capability, with its `area.thing.verb` `name` beside its id (for the rows' names to copy), with whether the person may use it at the place (the company when none is named) and the check's reason (`owner`, `allow`, `deny`, `not_granted`, a floor), compiled from the rows as their next request would be, and `sources`: the grants behind it at that place or above it (`kind` `role` with the role's and the group's name, or `exception`; `effect`, `scopeId`, `expiresAt`), by the compiler's own rules (`sourcesOf`); `active: false` and no items for an account switched off. Read only: it makes no session and touches none, so nothing can be done as them |
| `POST /bindings`, `DELETE /bindings/:id`, `POST /overrides`, `DELETE /overrides/:id` | `iam.bindings.manage` | grant and end, under the grant rules; one-capability exceptions |
| `GET /keys`, `POST /keys`, `DELETE /keys/:id` | `iam.keys.manage` | the API keys: listed without the key, made (the key shown once, 201), revoked (204); see API keys above |
| `GET /keys/:id`, `PATCH /keys/:id`, `POST /keys/:id/roll`, `POST /keys/:id/access`, `POST /keys/:id/remove` | `iam.keys.manage` | one key with its activity; its name and limits changed (204); rotated (the new key shown once, 200); its role or location changed (204); a revoked or ended key deleted (204) |
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
`iam_tenants`, `iam_principals` (kinds `person`, `service`, `vendor`; the Vendor row exists from the
migration), `iam_modules`, `iam_capabilities`, `iam_scopes`, `iam_groups`, `iam_group_members`,
`iam_roles` (position `0` is the Owner role), `iam_role_caps`, `iam_bindings`, `iam_overrides`
(`0004` also made `iam_policy_compiles`, dropped by `0078`). Migration `0005_iam_governance.sql`
adds `activated_from` to `iam_bindings` (the eligible grant an activation came from) and the tables
`iam_access_requests`, `iam_approvals`, `iam_reviews` and `iam_review_items`. Migration
`0006_iam_handover.sql` adds `handed_over_at`, `vendor_window_until` and `vendor_window_reason` to
`iam_tenants` and the table `iam_invitations`. Ids are text. Migration
`0076_iam_ready_role_names.sql` renames the ready-made roles Full admin, Standard user and View only
to Admin, Member and Viewer, each only where no role of the new name exists in that company, so it
runs twice the same. Migration `0078_iam_drop_policy_compiles.sql` drops `iam_policy_compiles` and
its index, which nothing has read ever or written since kit `053f26e`; marked `-- contract:`, it
shipped a release after the code that stopped writing it (the live portal's last row, read through
the Cloudflare connector on 2026-11-22, was from before that release). Migration
`0089_iam_api_keys.sql` adds `iam_api_keys`: a key's id, company, service account, name, the hash of
its secret, who made it and when, its end, last use and revoke time. Migration
`0101_iam_idempotency.sql` adds `iam_idempotency`, keyed by key and Idempotency-Key: the first
call's method, path, body hash, claim and time, and its answer.

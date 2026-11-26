---
title: "@oltrem/iam: the routes, permission names, tables"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src/module.ts, index.ts, capabilities.ts, aliases.ts, modules/iam/migrations]
---

# @oltrem/iam: the routes, permission names, tables

> Part of [the @oltrem/iam README](../README.md).

## The routes

```ts
const iam = createIam<Env>({ bindings: (env) => ({ kv: env.CACHE, db: env.DB }), audience: (env) => env.ACCESS_AUD });
const app = createApp<Env>({ modules: [iam.module, ...others], startup: iam.startup, session: iam.sessions.hook, authorize: iam.sessions.authorize });
```

`createIam` builds the sessions, governance and handover on one set of bindings, with the startup
hook and the manifest. **Startup:** the mounted modules' marks are worked out while the Worker
loads (`iam.startup.prepare`); on the first request past the door, any module whose declaration
is new or changed (even under the same version) has its capabilities registered, added to every
Owner role, each tenant's policy version moved and the index replaced. A seen version costs one
read. IAM's own nine capabilities sit on plane `0`, so a new client's registry fills itself.

76 JSON routes under `/api/iam` (74 here, plus core-module's `GET /home` and `GET /todo`). Each
names the capability the pipeline checks; the function behind it checks the rest (standing, own
grants, second person, fresh sign-in). Bodies and queries are schema-checked (`KIT-E-0422` names
the field); lists take `limit` (50, at most 200) and `offset`; rows are camel case, flags
booleans, never a hash. Create `201` with ids, change or end `204`, read `200`.

| Routes | Capability | What they do |
|---|---|---|
| `GET /me`, `GET /me/devices`, `DELETE /me/devices/:id` | `iam.self` | My session and map, with `may` (what the access pages may change for me: `read`, `give`, `roles`, `groups`, `places`, `vendor`); my sign-ins; end one (`iam.device-end`) |
| `POST /me/sign-out` | `iam.self` | Ends this sign-in (`iam.sign-out`), then 303 to `/cdn-cgi/access/logout` (`ACCESS_SIGN_OUT`) |
| `POST /me/sign-out-everywhere` | `iam.self` | Ends every sign-in of mine (`iam.sign-out-everywhere`), then the same 303 |
| `POST /me/sign-ins/report` | `iam.self` | Reads the other open sign-ins, ends all of mine, hands `reported` a `SignInReport` in the same audited step (`iam.sign-in-reported`), then the 303. The client template raises a critical alert (`report.sign-in.<person>.<when>`, `signInReportAlert`) |
| `GET /me/grants`, `POST /me/grants/:id/activate` | `iam.self` | My grants; bring an eligible one into force |
| `GET /me/options` | `iam.self` | What I may ask for: every role but Owner, every place |
| `GET /todo` | `iam.self` | Home's Needs you (`waitingFor`) |
| `GET`, `POST /me/requests`, `DELETE /me/requests/:id` | `iam.self` | My access requests |
| `GET`, `POST /me/approvals`, `POST /approvals/:id/decision` | `iam.self` | Approvals I asked for; ask; decide one (same power, not the asker) |
| `GET /tenant`, `/capabilities`, `/people`, `/people/:id`, `/groups`, `/groups/:id`, `/roles`, `/roles/:id`, `/scopes`, `/bindings`, `/overrides`, `/invitations`, `/requests`, `/approvals`, `/reviews`, `/reviews/:id` | `iam.read` | The company, the registry and every list, filtered by status, scope, role, subject or person; `/bindings?inForce=true`; each binding with `scopeName` and `scopeParentId` |
| `GET /people/:id/access?scopeId=` | `iam.read` | "See it as": every capability with its `name`, whether the person may use it there and why (`owner`, `allow`, `deny`, `not_granted`, a floor), and its `sources` (`sourcesOf`). Read only; no session made |
| `POST /bindings`, `DELETE /bindings/:id`, `POST /overrides`, `DELETE /overrides/:id` | `iam.bindings.manage` | Grant and end; one-capability exceptions |
| `GET /keys`, `POST /keys`, `DELETE /keys/:id`, `GET`, `PATCH /keys/:id`, `POST /keys/:id/roll`, `/access`, `/remove` | `iam.keys.manage` | API keys ([care-on-the-tick](care-on-the-tick.md#api-keys)) |
| `POST /invitations`, `/invitations/many`, `/invitations/:id/again`, `DELETE /invitations/:id` | `iam.bindings.manage` | Invite one address (token answered once) or up to 50 (`made`, `refused` with `personId` or `invitationId`); `send` emails each link; send again; withdraw |
| `POST /requests/:id/decision`, `POST /reviews`, `/reviews/:id/items/:bindingId`, `/reviews/:id/close` | `iam.bindings.manage` | Decide a request; open, decide and close a review |
| `POST`, `PATCH`, `DELETE /roles…` | `iam.roles.manage` | Roles below your standing, with capabilities you hold |
| `POST`, `PATCH`, `DELETE /groups…`, `POST /groups/:id/members`, `DELETE /groups/:id/members/:principalId` | `iam.groups.manage` | Groups and members, never yourself |
| `POST`, `PATCH`, `DELETE /scopes…` | `iam.scopes.manage` | The tree, four levels; one name (any case) once per parent (`KIT-E-2010`) |
| `PUT /tenant/vendor-access`, `POST /tenant/vendor-window` | `iam.tenant.manage` | How the Vendor may enter; an Owner's window |
| `POST /tenant/incident`, `DELETE /tenant/vendor-window` | `iam.self` | The Vendor declares an incident; the Vendor or an Owner closes a window |
| `POST /tenant` | `iam.vendor.manage` | The Vendor creates the company and invites its first Owner |
| `GET`, `POST /vendors`, `PUT /vendors/:id/active` | `iam.vendor.manage` | Vendor accounts: list, add, switch (never your own or the last) |
| `GET /setup-people` | `iam.bindings.manage` | People named at setup with no account or invitation (`owner`, `staff`, `team`) |
| `POST /invitations/accept`, `POST /invitations/mine` | any identity | Take the grant (with the link's token, or the newest for the signed-in address); read the newest waiting invitation, never its token |

**Exceptions.** The last two are `access: 'identity'`: no session or capability, since the person
has no account; the body is validated and same-origin applies. Accepting without a token is safe
because Access proved the address (`KIT-E-2016`); nothing waiting is `KIT-E-2015`. The incident and
window routes name `iam.self` because under `incident_only` and `approval` the Vendor is refused
everything else; the handover decides by the mode.

Reads are not audited; every write is. The registry behind `GET /capabilities` and "See it as" is
read once per isolate. Given `off` (`@oltrem/core-config`), a switched-off module's capabilities
stay registered but leave those two lists, and `PATCH /roles/:id` keeps the ones a role already
holds, so a save never drops them (`test/parts.test.ts`).

## Permission names

Every permission reads `<area>.<thing>.<verb>`: the area named like its sidebar section, the verb
one of `read`, `edit`, `delete`, `manage`, `request`, `approve`, `send`, `export`, `share`, `run`.
Stored ids never change: `src/aliases.ts` maps the older ones (`ALIASES`, `nameOf`, `idOf`),
`GET /capabilities` carries `name`, and Policy JSON accepts either. The client template's screens
test refuses a new permission named otherwise (`NAME_PATTERN`). Tests: `test/aliases.test.ts`.

## Tables

In the one ledger `oltrem_migrations`, each additive and idempotent:

| Migration | Adds |
|---|---|
| `0004_iam.sql` | `iam_tenants`, `iam_principals` (`person`, `service`, `vendor`; the Vendor row from the start), `iam_modules`, `iam_capabilities`, `iam_scopes`, `iam_groups`, `iam_group_members`, `iam_roles` (position `0` is Owner), `iam_role_caps`, `iam_bindings`, `iam_overrides` |
| `0005_iam_governance.sql` | `iam_bindings.activated_from`; `iam_access_requests`, `iam_approvals`, `iam_reviews`, `iam_review_items` |
| `0006_iam_handover.sql` | `iam_tenants.handed_over_at`, `vendor_window_until`, `vendor_window_reason`; `iam_invitations` |
| `0058_iam_sign_ins.sql` | `iam_principals.last_signed_in_at` |
| `0065_iam_blocks.sql` | `iam_principals.blocked_until`, `signed_out_at` |
| `0076_iam_ready_role_names.sql` | Renames the ready roles to Admin, Member and Viewer where free |
| `0078_iam_drop_policy_compiles.sql` | Drops the unused `iam_policy_compiles` (`-- contract:`) |
| `0089_iam_api_keys.sql`, `0090_iam_api_key_limits.sql` | `iam_api_keys` and its limits |
| `0101_iam_idempotency.sql` | `iam_idempotency`, keyed by key and Idempotency-Key |

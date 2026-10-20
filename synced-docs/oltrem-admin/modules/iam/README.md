# @oltrem/iam

Permissions for a client Worker (plan sections 6, 7 and 10): who may do what, where, as data a
client's Owners manage themselves. This is the first step of phase 2: the tables, the capability
registry modules fill at deploy, the compiler that turns a person's grants into one small map,
and the check that reads it. Sessions, the writes with their governance rules (who may grant
what), the Vendor handover and the phone screens follow in the next steps.

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

`defineCapabilities` refuses a bad declaration when the module loads (`KIT-E-2001`).
`registerCapabilities(db, sets)` runs at deploy: the module row with its plane, a bit for each
new capability (the next free one, never one already given), labels and flags refreshed, and a
capability no longer declared marked inactive while it keeps its bit. Two modules claiming one
plane, in one deploy or across deploys, fail the deploy. `loadCapabilityIndex(db)` reads the
rows once per isolate; the compiler and the check share that index.

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
   `incident_only`.
4. A capability on the vendor floor, for anyone else: `vendor_floor`.
5. An Owner (the Owner role at the root, in force): `owner` (allow).
6. Otherwise walk from the scope up to the root: a deny bit on any node is `deny`; an allow bit on
   any node is `allow`; nothing found is `not_granted`.

Floors are applied at compile time: a capability with `floor: owner` enters the bits only from
the Owner role (position `0`), never from another role or an override; a vendor-floor capability
never enters a map. An *eligible* binding, an expired one and one not yet started grant nothing;
`refreshAt` says when to compile again.

## Tables

Migration `0004_iam.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`iam_tenants`, `iam_principals` (kinds `person`, `service`, `vendor`; the Vendor row exists from
the migration), `iam_modules`, `iam_capabilities`, `iam_scopes`, `iam_groups`,
`iam_group_members`, `iam_roles` (position `0` is the Owner role), `iam_role_caps`,
`iam_bindings`, `iam_overrides`, `iam_policy_compiles`. Ids are text. Access requests, approvals
and reviews come with the governance step.

## Errors

The module owns the `2000` to `2099` block: `KIT-E-2001` a bad capability list, `KIT-E-2002` an
unknown or inactive account, `KIT-E-2003` a bad scope tree (deeper than four levels, a loop, or
more than one root).

## Tests

Inside the Workers runtime, against the real migration: the registry's rules and bit stability;
the tree's limits; a small tenant decided case by case (owner, vendor, floors, deny over allow,
inheritance, siblings, groups, time, eligibility, overrides, the hash and the compile record);
and a synthetic tenant of three locations, four departments, twelve roles and forty people on
which 320 generated decisions of the compiled check are compared with a plain evaluator that
reads the rows one question at a time (`test/reference.ts`). The plan's `can()` timing budget is
measured on the sandbox, not here: the test runtime does not advance its clock during a check.

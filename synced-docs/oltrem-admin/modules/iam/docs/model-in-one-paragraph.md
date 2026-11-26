---
title: "@oltrem/iam: The model in one paragraph; Declaring capabilities; Compiling and checking"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src; split from modules/iam/README.md]
---

# @oltrem/iam: The model in one paragraph; Declaring capabilities; Compiling and checking

> Part of [the @oltrem/iam README](../README.md).

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
(`parent`), the bits per scope, whether the person holds the Owner role at the root, the tenant's
policy version and Vendor setting, `refreshAt` (when the next grant starts or ends), and a `sha256-`
hash of all of it. A compile only reads: it writes no row. A map is a few hundred bytes to a few
kilobytes.

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

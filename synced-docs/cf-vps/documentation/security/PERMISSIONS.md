---
title: "cf-vps Permissions"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-03
verified_against: [code]
owner: harshil
related_code: [contract/capabilities.ts, src/access/policy.ts, src/access/save.ts, src/agent/proxy.ts, src/ui/pages.ts]
related_docs: [../architecture/OVERVIEW.md, ../features/ACTIONS.md, ../features/CONSOLE.md, ../reference/API-ROUTES.md]
tags: [security, permissions, capabilities, rbac]
---

# cf-vps Permissions

> **TL;DR (non-technical):** What a person can do on the server console is a list of
> small permissions called capabilities. Each role gets a default list, the owner can add or
> remove capabilities for one person, and the most dangerous ones can never be given to
> anyone except the owner and the vendor. The check is made three times: in the portal's
> private service, on the server's agent, and again by the root script that makes a change.

## The catalog

One file, `contract/capabilities.ts`, is read by the Worker, the agent and the console, so
they cannot disagree. A capability has a class: `read` (looks), `operate` (changes something
routine) or `admin` (high impact). **Floor** marks the capabilities only Owner and Vendor
support can hold.

| Capability | Class | What it allows | Default roles | Floor |
|---|---|---|---|---|
| `host.view` | read | Overview, metrics, processes, services, timers, packages, storage, network, history, diagnostics | owner, vendor, admin | no |
| `logs.view` | read | The system journal and its live tail (login and sudo sources also need `security.view`) | owner, vendor, admin | no |
| `files.view` | read | Browse folders and preview files the agent can read; secrets are always refused | owner, vendor | no |
| `files.download` | operate | Download files up to 200 MB | owner, vendor | no |
| `files.write` | operate | Upload, create folders, rename, delete in app source and config folders and the share folder only | owner, vendor | no |
| `security.view` | read | Posture, who is logged in, alerts, login sources in Logs, log storage usage | owner, vendor | no |
| `audit.view` | read | Every session, command, sudo and config change on record | owner, vendor | yes |
| `sessions.replay` | read | Replay recorded terminal sessions | owner, vendor | yes |
| `api.raw` | read | The raw read-only JSON explorer | owner, vendor | no |
| `services.control` | operate | Start, stop and restart allow-listed services (never SSH, the tunnel, the audit pipeline or the agent) | owner, vendor | no |
| `packages.update` | operate | Refresh package lists and install updates (no removals) | owner, vendor | no |
| `apps.deploy` | operate | Deploy hosted apps from their manifests (regenerate the unit and site, restart, health-check) | owner, vendor | no |
| `apps.control` | operate | Start, stop, restart, pause and resume hosted apps | owner, vendor | no |
| `apps.manage` | admin | Block or unblock a hosted app, and change its memory cap, CPU cap and CPU weight within the server's limits | owner, vendor | no |
| `host.reboot` | admin | Reboot the server (one-minute delay, cancellable) | owner, vendor | yes |
| `retention.manage` | admin | Change how long each kind of log is kept, within fixed limits | owner, vendor | yes |
| `logs.purge` | admin | Delete stored logs by date, size or kind; never today, never the locked R2 copy | owner, vendor | yes |
| `terminal.ops` | operate | A shell as the unprivileged `vps-ops` account through a 60-second certificate; recorded | owner, vendor | no |
| `terminal.admin` | admin | A shell as `vps-admin` (sudo); recorded and the owner is alerted | owner, vendor | yes |
| `access.view` | read | See who holds which capabilities | owner, vendor | no |
| `access.delegate` | admin | Give or take away capabilities you hold yourself, for people below you, from cf-admin's Access Center (see Delegation) | owner, vendor, admin | no |
| `access.manage` | admin | Change role defaults and per-person grants | owner, vendor | yes |

## Roles

| Role | Default capabilities |
|---|---|
| `owner`, `vendor_support` | All 22 |
| `admin` | `host.view`, `logs.view`, `access.delegate` |
| `manager`, `staff`, `viewer` | None |

The role comes from cf-admin in the actor header. These are the code defaults
(`DEFAULT_ROLE_CAPABILITIES`); a saved policy can change them for any role except that a
floor capability can never be added to a role outside `FLOOR_ROLES`.

## How a decision is made

`can()` in `src/access/policy.ts`, in order:

1. An unknown capability id is refused. A system actor holds nothing.
2. A floor capability is refused unless the role is owner or vendor support.
3. A per-person **deny** wins over everything.
4. A per-person **allow** grants the capability unless it has expired.
5. Otherwise the role's list decides (the stored policy, or the code default for any
   capability the stored policy predates).

## Stored policy and per-person grants

The policy is one row, `vps:access`, in cf-admin's settings table (schema `cf-vps/access@1`).
With no row, the code defaults apply. A row that exists but is invalid makes requests fail
rather than fall back. The Worker caches the row for 30 seconds; a save reads fresh.

| Rule | Value |
|---|---|
| A person's grant | `allow` list, `deny` list, optional `expiresAt` and `note` |
| Most people with a grant | 50 |
| Longest grant | 366 days ahead; a past date is refused |
| Note length | 200 characters |
| Floor capabilities in `allow` | Refused: a floor follows the role |
| Floor capabilities in `deny` | Allowed: it can switch one person off |
| Lock-out guard | Owner or vendor must always keep `access.manage`, and a save cannot remove it from the person saving |
| Concurrency | Compare-and-swap on the revision; a stale save gets a conflict |

People are edited on the console's Access page (`access.view` to read, `access.manage` to
save) and from cf-admin's Access Center on a person's Users page, which calls the same API for
one person. Each save returns an `x-vps-audit` line that becomes a cf-admin activity-log row.

### One capability's default role

cf-admin's page registry moves one capability's default with `POST /api/access/role` and the
body `{ rev, capability, minRole }`, which needs `access.manage`. On the portal's role ladder
(vendor support, owner, admin, manager, staff, viewer), `minRole` and every role above it hold
the capability and every role below it does not. Nothing else changes:

| Part | After the save |
|---|---|
| Every other capability | Each role keeps what it resolves to now: its stored list, or the code default for a capability the stored policy predates |
| Personal grants | Carried over unchanged, including one that names the same capability; a grant that has already run out is dropped, as on the person route |
| Floor capabilities | Refused with 400: a floor follows the Owner and Vendor support roles and cannot be moved |
| Unknown capability or role, missing or non-integer `rev` | 400 |

The save runs through the same validation, lock-out guard and compare-and-swap as the Access
page (a stale `rev` is 409 `conflict`), and its audit line ends in `via=role`. The `changes`
list compares what each role held before with the new lists, so only real changes are named.

## Delegation

cf-admin's Access Center lets people below owner hand out what they hold, following the
portal's role ladder (vendor support, owner, admin, manager, staff, viewer; the design is in
cf-admin's `documentation/specs/2026-10-02-access-center-design.md`). A per-person change from
someone without `access.manage` is accepted only when all of these hold:

| Rule | Check |
|---|---|
| Holds `access.delegate` | Otherwise `need: access.delegate` |
| T1 trusted target | cf-admin names the person, with the role from its own user table, in `x-vps-target` (base64url JSON `{ v: 1, email, role }`). cf-admin's gateway never forwards that header from a browser. Missing, malformed or naming someone else: `need: trusted_target` |
| T2 not yourself | `need: self` |
| T3 outrank | The actor's role sits strictly above the person's; owner and vendor can never be changed by delegation (`need: outranked`) |
| T4 hold it | Every capability added to or removed from the allow or deny list is one the actor holds now (`need: not-held:<cap>`) |
| T5 not locked | No floor capability changes (`need: locked:<cap>`) |

The save then runs through the same validation, limits and compare-and-swap as any other, and
its audit line ends in `via=delegate`. Viewing one person needs `access.view`, or
`access.delegate` with T1 to T3 and the same role as cf-admin's record.

`GET /api/access/catalog` gives cf-admin every capability (label, class, floor), each role's
level and current defaults, and what the caller holds and may delegate. It names nobody else.

## Fresh sign-in

The Worker compares the actor's sign-in time with the clock. A sign-in older than **10
minutes** is refused with `need: fresh_sign_in` for:

| Request | Capability |
|---|---|
| Delete logs, delete old journal (`logs.purge`, `logs.vacuum`) | `logs.purge` |
| Set retention (`retention.set`) | `retention.manage` |
| Open a terminal as `vps-admin` | `terminal.admin` |

Other risky actions use a typed confirmation instead (`reboot`, `upgrade`, `delete`, or the
service name for a stop); see [ACTIONS](../features/ACTIONS.md).

## Where it is enforced

| Layer | Check |
|---|---|
| Console | Hides pages and disables buttons the person cannot use (`/api/me` lists their capabilities) |
| Worker | `proxyToAgent` refuses with 403 and the capability needed before anything is signed |
| Agent | Re-checks the route's capability from the signed list; the Worker's headers alone are never trusted |
| Root script | Each action script validates its own target again |

The local preview signs with a dev key that the agent limits to `read`-class capabilities
(`DEV_KEY_CAPS`), so a laptop can look at the server but change nothing. Its `/api/me` still
lists every capability the dev actor holds as `caps`, with `preview: true` and the agent's
read-only list as `agentCaps`, so every page and control can be designed there. A change the
agent would have to make is refused by the Worker before it is signed, and access edits in the
preview save to the local test database, never the real one.

## Related

- [CONSOLE](../features/CONSOLE.md): which page needs which capability.
- [API-ROUTES](../reference/API-ROUTES.md): which route needs which capability.

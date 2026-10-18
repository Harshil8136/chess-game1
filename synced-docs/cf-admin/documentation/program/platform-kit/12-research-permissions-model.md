---
title: "Platform kit research: permission models compared"
status: historical
audience: [owner, ai, technical]
last_verified: 2026-10-18
verified_against: [web-sources]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, research, snapshot]
---

> **Research snapshot, read on 2026-10-18.** Written by a research pass for the platform kit plan ([`01-plan.md`](01-plan.md)). Figures carry their source URL and the date read; anything unverified is marked **GAP**. Paths named here describe other repositories or a proposed design, not files in this repository. Kept as a dated record and not updated in place.

# Dynamic authorization for a multi-client admin kit on Cloudflare Workers + D1 + KV

Research note, 2026-10-18. Research worker output; nothing here is committed to any repo.
Inputs: the current cf-admin model (`cf-admin-madagascar/documentation/architecture/PERMISSIONS-SYSTEM.md`,
authority), the cf-vps capability model (`cf-vps/documentation/security/PERMISSIONS.md`), the
existing draft successor (`cf-admin-madagascar/documentation/reference/DYNAMIC-ROLES-PBAC-DESIGN.md`,
status draft, 2026-08), and the web sources cited inline.

## 0. The constraints, re-checked

| Constraint | Figure | Source |
|---|---|---|
| CPU per request, Workers Free | **10 ms** (Paid: 30 s default, 5 min max). Waiting on KV/D1/fetch does **not** count. Average Worker ≈2.2 ms; auth/SSR-heavy Workers 10–20 ms | [Cloudflare Workers limits, updated 2026-10-12](https://developers.cloudflare.com/workers/platform/limits/) |
| Worker size | 64 MiB on both plans (the old 3 MB / 10 MB compressed limit is gone) | same page |
| Memory | 128 MB per isolate, incl. WASM allocations | same page |
| Subrequests | 50/request Free, 10,000 Paid (every KV/D1 call counts) | same page |
| Current warm path | 4 KV reads per request; the access map rides inside the session record; 97.6% warm hits; cold login ≈240 ms to Supabase; map recompute 0.65 ms from D1 | PERMISSIONS-SYSTEM.md §3, §13 |
| KV hot read | sub-10 ms, cache-backed, eventually consistent ≤60 s | [Cloudflare KV product page](https://www.cloudflare.com/products/kv.md), [KV scaling notes](https://flaviocopes.com/courses/cloudflare/understand-how-kv-reads-scale/) |

So the budget is really "a few hundred microseconds of JS per check, zero extra network hops
on the warm path", because SSR already eats most of the 10 ms. The size cap is no longer a
blocker for a WASM engine; CPU and cold-start are.

## 1. Models compared, for this setting

### 1.1 What the current model already is

A rank ladder (vendor_support > owner > admin > manager > staff > viewer) plus a registry of
page keys and `#action` keys, each with a default minimum rank, plus per-user allow/deny
overrides with optional expiry; resolved once into a flat `Record<key, boolean>` stored in
the session; deny beats allow; owner and vendor bypass; floors; grant-only pages; five
provisioning gates (self-edit refused, strict outrank with the target role read from the DB,
top tiers immutable from below, "you must hold the door you grant", "you cannot grant above
your own clearance"); temporary grants (≤90/366 days); two-person rule for four changes;
fresh sign-in (10 min) for dangerous actions; quarterly access review; sealed audit log.
The consoles (cf-vps, cf-backup) hold a parallel capability catalogue with class
read/operate/admin, role defaults, floors, personal allow/deny/temporary, delegation rules
T1–T5, and a signed actor header from the gateway.

PERMISSIONS-SYSTEM.md §15 already says where it fails: "The moment permissions need to depend
on the *object* rather than the *page*… the honest answer is a rewrite onto a relationship
model, not an extension." The owner's new requirement (departments, teams, locations, client-
created roles, module-registered capabilities) is exactly that moment.

### 1.2 The candidates

| Model | Who models departments/teams/locations without vendor code? | Fit for D1/KV/10 ms | Verdict for the kit |
|---|---|---|---|
| **Fixed tiers (today)** | Nobody: a new tier is a deploy | Perfect | Keep the *mechanisms* (floors, gates, expiry, two-person), drop the fixed ladder |
| **RBAC with dynamic roles + groups** (Keycloak composite roles, groups inherit downward; Google Workspace custom roles; GitHub custom org/repo roles) | Client creates roles (= permission bundles) and groups, assigns roles to groups. Workspace limits a role's effect to an OU; GitHub builds a custom role from a base role plus add-ons | Excellent: a role is a set of capability ids; flatten once per principal | **Core of the recommendation**. Risk: role explosion if roles are the only tool ([PlainID](https://blog.plainid.com/role-explosion-unintended-consequence-rbac), [WorkOS 2026](https://workos.com/blog/multi-tenant-permissions-slack-notion-linear)) |
| **Cloud-IAM hybrid: roles bound at nodes of a resource hierarchy** (GCP: role = permission collection, binding on org/folder/project, children inherit, deny policies checked first, Principal Access Boundaries cap reach; Azure: role definition + assignment at a scope + system deny assignments; AWS: identity policies ∩ permission boundary ∩ SCP, explicit deny wins) | Client creates nodes ("Location: North", "Department: Front desk") and binds roles there; staff in location X see only X | Very good: "scope" is one extra column on the binding; inheritance is a walk up a short path, precomputed | **Adopt the binding-at-scope idea.** It is what turns RBAC into something departments and locations can be modelled with, no code |
| **ReBAC / Zanzibar tuples** (OpenFGA, SpiceDB, Permify, Ory Keto, Warrant) | Everything is a tuple `object#relation@subject`; groups nest; schema (userset rewrites) says editor ⊂ viewer, etc. p95 <10 ms at Google *with Spanner, Leopard index, zookies* | Poor as a general engine in a Worker: recursive graph walk per check, needs a server + Postgres (all four products are servers; SpiceDB's WASM build exists only for its playground) | Borrow the **tuple table shape** for memberships and resource grants, with bounded depth; do not adopt a Zanzibar server. Sources: [Zanzibar paper](https://www.usenix.org/system/files/atc19-pang.pdf), [Permify vs Keto/OpenFGA/SpiceDB](https://permify.notion.site/Differentiation-Between-Zanzibar-Products-[CF_HEX_ID]), [SpiceDB consistency](https://docs.authzed.com/reference/api-consistency), [SpiceDB WASM playground](https://www.plushcap.com/content/authzed/blog/authzed-some-assembly-required) |
| **ABAC / policy language** (Cedar, OPA/Rego, Cerbos) | Policies are code: the *vendor* or a technical admin writes them. A pet-hotel manager will not write Cedar | Cedar WASM is feasible (below) but adds 1.4 MB gz, a cold-start parse and a second source of truth | Not as the primary model. Possibly later for conditions ("only 08:00–20:00", "only from the hotel's IP") |
| **Kubernetes RBAC** (Roles/ClusterRoles, bindings, aggregated ClusterRoles via label selectors, purely additive, `escalate`/`bind` verbs guard who may write roles) | Admin writes YAML | Not directly | **Steal two ideas**: *aggregation* (a module contributes a labelled fragment into a client role automatically) and the *escalation check* (you may only write a role whose permissions you hold). [k8s RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/), [good practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices) |
| **Discord** (roles → 64-bit permission bitfield OR-ed; ADMINISTRATOR short-circuit; per-channel overwrites applied @everyone→roles→member, deny then allow; a member may only manage roles below their highest role; 250 roles per server) | Server owners (non-technical) do it daily | Excellent CPU: O(1) per check; the overwrite order is exactly "scope-level override" | **Steal the evaluation order and the hierarchy rule** for the UI; use bitsets per module as the compiled form. [Discord permissions](https://docs.discord.com/developers/topics/permissions) |

Answer to the question "which approach lets a client model departments/teams/locations
without the vendor writing code": **roles-as-permission-bundles + groups, bound at nodes of a
client-defined scope tree, Discord-style overwrites at a scope, deny-overrides**. That is the
GCP/Azure shape with Discord's evaluator and Kubernetes' escalation rule. Pure ReBAC gives the
same expressiveness but costs a server; pure ABAC gives it only to someone who writes policy.

## 2. Embeddable engines, measured against "inside a Worker, ≤10 ms, few MB"

| Engine | Runs in-process in a Worker? | Size / cost | Notes |
|---|---|---|---|
| **Cedar** (`@cedar-policy/cedar-wasm` 4.13.0) | Yes, WASM; ESM/web/nodejs sub-packages, `initSync(wasmBuffer)` for custom loading | ≈4.3 MB wasm, ≈1.4 MB gzipped per build (third-party measurement of 4.13.0); package unpacked 13 MB because three builds ship. Policy-set parsing dominates per-call cost; batch is ~10× cheaper than one-by-one (cedarpy notes). Level validation / slicing bounds the entity data a request needs | Fits the 64 MiB cap easily; the risk is the 1 s startup cap and parse-per-request unless policies are compiled once per isolate. Nobody has published a Workers-specific number. [cedar-wasm README](https://github.com/cedar-policy/cedar/blob/main/cedar-wasm/README.md), [size report](https://github.com/jamjet-labs/jamjet-policy/pull/14), [level validation](https://docs.cedarpolicy.com/policies/level-validation.html), [cedarpy cost notes](https://simple-repository.app.cern.ch/project/cedarpy) |
| **Casbin** (node-casbin) | Pure JS, yes | Go figures: 0.0155 ms ACL/2 rules, 0.164 ms RBAC/1,100 rules, 2.26 ms at 11,000 rules; Casbin's own guidance is "<100 rules per enforcer, shard". No node-casbin bundle size published | Policy is a flat text/DB table with no scope tree, no deny-precedence semantics unless you write the matcher; would re-implement most of our rules in a matcher string. [Casbin benchmark](https://casbin.org/docs/benchmark), [performance guide](https://v1.casbin.org/docs/en/performance) |
| **OpenFGA / SpiceDB / Permify / Keto** | No: all are servers (Postgres/MySQL; OpenFGA also SQLite). SpiceDB compiled to WASM exists only for the browser playground; OpenFGA has no in-process build | Network hop per check (or batched check), own infra | Out: a hop per request on the warm path and a cluster to run contradict the kit's "none beyond Cloudflare" |
| **Cerbos** | Hub-generated WASM embedded PDP exists (marked legacy-Hub docs); the Workers integration page describes a network call to a PDP | WASM PDP size not published | Possible, but policies are YAML written by engineers, and Hub is a SaaS dependency. [Cerbos embedded PDP](https://docs.cerbos.dev/cerbos-hub/decision-points-embedded), [Workers page](https://www.cerbos.dev/ecosystem/cloudflare-workers) |
| **Oso** | Library deprecated 2023-12-18; Oso Cloud is SaaS | — | Out. [Oso docs](https://www.osohq.com/docs/oss/getting-started.html) |
| **Permit.io** | SaaS with OPA/Cedar-based PDP sidecar via OPAL | — | Out (outside service, Golden Rule 6). [Permit OSS fallback](https://docs.permit.io/concepts/oss-fallback) |

Conclusion: the only engines that run inside a Worker are Cedar (WASM) and Casbin (JS). Neither
gives the client a non-technical model of roles/groups/scopes; both would sit *under* a
hand-rolled data model anyway. A hand-rolled compiled form is smaller, faster and auditable,
and it is what the current system already does well (one hash lookup per check). Cedar stays
the candidate for a later "conditions" layer, loaded lazily and only on routes that need it.

## 3. Hand-rolled designs that fit D1 + KV

| Option | Check cost | Invalidation | Notes |
|---|---|---|---|
| **(a) Materialised effective-permission set per principal, cached in KV with a version stamp** | One KV read already on the session path (today's design); O(1) lookup | Write a per-principal `authz-changed` mark (today) *and* a per-tenant policy version; the session stage recomputes when either moves. Staleness bound = KV propagation (≤60 s cross-colo) unless the mark is read from the same key as the session | Today's shape; keep it |
| **(b) Bitsets per module (Discord)** | `(bits[module] & need) === need` on a BigInt or Uint32 array; ~nanoseconds | Same as (a) | Compact: a tenant with 40 modules × ≤64 capabilities each is 40 BigInts ≈ 2 KB in the session. Each module owns one bit-plane so adding a capability never renumbers another module. Store the stable `capability_id → (module, bit)` map in D1 and in the compiled policy; bits are an *encoding*, ids are the truth |
| **(c) Relationship tuples with bounded-depth check** | Group nesting depth ≤ 3, scope tree depth ≤ 4, resolved at compile time into (b); a *runtime* tuple walk only for object-level ACLs (e.g. one booking shared with one person), depth 1 | Tuples change → mark the affected principals (member of group G, or everyone when a group-of-groups changes) | Zanzibar's lesson: the "new enemy problem" (a stale cache answers after a revoke). Answer it with a *snapshot token*: the session stores the tenant policy version it was compiled from, and the mutation paths that matter (role edits, deletes, money) re-read the version from D1 (`FRESH_POLICY_ROUTES` pattern already in cf-vps) |
| **(d) Compact compiled JSON policy evaluated per request** | Interpret a small decision table (scope → role bindings → bitsets, overwrites) per request: tens of µs if the policy is in the isolate's memory, but it has to be loaded (KV read or D1 query) and parsed; per-isolate cache with a 30–60 s TTL like cf-vps's policy row | Policy version bump | Use it for the *compiler*, not for the hot path: compile (d) into (a)+(b) at sign-in and on change |

Recommended combination: **compile (c)+(d) into (a)+(b)**. The session carries
`{tenant, policyVersion, principalVersion, scopes: {scopeId: bits[]}, overrides}`; a check is a
scope walk of ≤4 hash lookups and one bit test, no network. Cache invalidation has three levers,
all existing today: the per-principal mark, a per-tenant policy version, and the map's own
`refreshAt` for the earliest expiring grant. Session-bound snapshots are a feature, not a bug,
as long as (i) revocation and deny propagate on the next request (today's §11) and (ii)
dangerous routes re-read the version (TOCTOU, §6 below). Audit: every compile writes a
`policy_compile` row (who, version, hash of the compiled map) so a decision can be replayed.

## 4. Governance features worth building in

| Feature | What the literature does | For the kit |
|---|---|---|
| Least privilege, deny by default | OWASP: minimum privileges horizontally and vertically; deny when no rule allows; one site-wide component; re-validate in long sessions; review for privilege creep ([OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP dev guide checklist](https://devguide.owasp.org/en/04-design/02-web-app-checklist/07-access-controls/)) | A new role starts empty; a new client starts with one Owner and nothing else; an unknown capability id is refused (cf-vps `can()` step 1 already) |
| Deny overrides | GCP checks deny policies before allow; AWS: explicit deny in any policy type wins; Azure deny assignments | Keep "deny beats allow" at every layer, incl. scope overwrites |
| Permission boundaries ("no one can grant what they don't hold") | AWS permission boundary = ceiling, effective = boundary ∩ policy; GCP Principal Access Boundary = what a principal may reach at all, checked before deny; Kubernetes refuses writing a Role with permissions you lack unless you hold `escalate`/`bind` | Keep gates C and D and T4; generalise: a role may be created/edited only with capabilities the editor holds *in that scope*; a binding may be made only below the editor's own position in the role order (Discord) and inside the editor's scope subtree; never ship an `escalate` equivalent except to the Vendor principal |
| Separation of duties / two-person | Entra PIM approvals; audit literature warns a role that both creates and approves inherits the control failure ([NHI journal](https://nhimg.org/faq/what-breaks-when-organisations-keep-adding-exceptions-to-rbac/)) | Keep §10.7 as data: `requires_second_person` is a flag on the capability (set by the module) *or* on the client's policy; approver must hold the capability and not be the requester |
| JIT / time-bound elevation | PIM: eligible vs active, MFA + justification + optional approval, auto-expiry ([Entra PIM notes](https://docs.it.tamu.edu/security/identity/pim-best-practices)) | Keep temporary grants (≤90 days) and access requests; add "eligible" bindings a person activates for N hours with reason, logged |
| Access reviews / attestation | PIM access reviews: "activation monitoring asks if a role is used; reviews ask if the assignment should exist" | Keep the quarterly review; scope it per role and per group owner so a large client can split it |
| Break-glass | Two cloud-only emergency accounts, excluded from CA, monitored; or permanently active admin ([AdminDroid](https://blog.admindroid.com/best-practices-for-break-glass-accounts-in-microsoft-entra/), [SC-300 guide](https://open-exam-prep.com/study-guides/azure-sc-300/privileged-identity-management/break-glass-accounts)) | The Vendor principal *is* break-glass for the client; make its use loud: every Vendor action in a client tenant is emailed to the client Owner and sealed in the audit log; optionally the client can require its own approval for Vendor entry outside an incident window |
| Immutable audit | Daily sealed chain already built (§12) | Keep; add the compiled-policy hash to each decision-relevant row |
| SCIM / IdP group sync | Okta Push Groups / Entra provisioning map IdP groups to app roles; newer products allow mapping after the fact rather than by naming convention ([Portkey](https://portkey.ai/docs/product/enterprise-offering/org-management/scim/group-management), [ClickHouse](https://clickhouse.com/docs/products/cloud/guides/security/cloud-access-management/scim-setup)) | Groups get an optional `external_id` + `source` (`cloudflare_access`, `scim`, `manual`). The existing 5-minute Cloudflare Access group reconcile is the first provider; a SCIM endpoint can come later. Synced groups are read-only in the UI; roles are still bound locally |
| Bootstrap / first admin | Multi-tenant guides: tenant first, first user becomes admin, admin can transfer; provider assigns an "Access Manager" per tenant ([DEV](https://dev.to/paultowers/multi-tenant-saas-architecture-getting-account-creation-right-from-day-one-2lb1), [BMC](https://docs.bmc.com/docs/display/APM26/Managing+tenant+accounts+and+permissions)) | §5 of the recommendation |
| Service accounts / tokens | GCP service accounts are principals; AWS session policies narrow further | A principal of kind `service` holds bindings like a person, cannot sign in interactively, and a token may carry a *subset* mask (session policy) never a superset |
| Impersonation ("view as") | GitHub/Entra treat impersonate as escalation; Kyverno blocks `impersonate` with `escalate`/`bind` | Keep read-only "See it as" (already built); never a real impersonated session |
| Tenant/resource scopes | GCP bindings on hierarchy nodes; Workspace roles limited to OUs | Scope tree per tenant |
| Row-level filters | Pre-filter: ask authz for the allowed object ids, then `WHERE id IN (...)`; or native RLS predicates ([WorkOS FGA + Postgres](https://workos.com/blog/how-to-build-row-level-access-control-with-workos-fga-and-postgres)) | Resources carry `scope_id`; the repository layer appends `AND scope_id IN (:allowedScopes)` derived from the compiled map. The list of allowed scopes is small (a location list), so the IN-list problem does not arise |

## 5. UX patterns for non-technical admins, phone first

- **GitHub custom roles**: pick a base role, then tick add-ons; you can only add what the base
  lacks; settings pages the role does not cover are hidden ([GitHub docs](https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/about-custom-organization-roles)). Copy: "start from a template, add switches".
- **Google Workspace**: Admin roles → create role → privilege checkboxes grouped by service → assign → "apply to specific organizational units" ([Workspace help](https://knowledge.workspace.google.com/kb/how-to-limit-custom-admin-roles-scope-to-specific-organizational-units-000007069)). Copy: the *assignment* step chooses the scope, not the role definition.
- **Discord**: one role editor with grouped toggles, a draggable role order that *is* the hierarchy, per-channel overwrites shown as a three-state switch (inherit / allow / deny), Administrator as an explicit red toggle. Copy: three-state switches per scope and "you can only edit roles below yours".
- **Notion/Slack**: admin roles stack additively; members only see settings their roles cover; Slack's permission table marks "default / only if an admin enables it" ([Notion enterprise](https://www.notion.com/help/enterprise-admins), [Slack roles](https://slack.com/help/articles/201912948)). Copy: additive add-on roles for cross-cutting duties (Audit viewer, Security admin).
- Phone-sized: one capability per row with its module icon and a three-state control; group by module with collapsible sections; a sticky "what changes" preview (the existing role-preview dialog); search; templates ("Front desk", "Night shift") as the first screen; the full matrix only as a landscape/desktop view and as an export. The existing Access Center v2 (draft → one save, gates on the server) is the right skeleton.

## 6. Security pitfalls

| Pitfall | Evidence | Mitigation in the kit |
|---|---|---|
| Role explosion | Roles become "exception buckets" that reviewers cannot read; WorkOS recommends scoped, composable roles over ever-growing global lists | Roles are per tenant and reusable across scopes via bindings; per-person overrides exist but are capped and expire (today's rule) and the review lists them first |
| Privilege escalation via role-management permissions | Kubernetes `escalate`/`bind`/`impersonate` and wildcards; Entra: Privileged Authentication Admin can take over Global Admin | `access.manage`-class capabilities are themselves bounded: edit roles only with capabilities you hold in scope; bind only below your position; never grant `iam.*` to a role you can assign to yourself; two-person for changes to the Owner role or to the role order |
| Confused deputy across service boundaries | Token forwarding: a backend forwards a user token to a service that reads it differently; fix is a narrowly scoped downstream token with a distinct audience ([JWT hardening](https://www.elliptic.co/corpus/gen-3642/application-security/jwt-hardening.html)) | Keep the signed actor header (`CONSOLE_SIGNING_KEY`, 60 s window) and the consoles' own re-check against the *signed* capability list and role; add `aud` = console name and the policy version to the header; consoles refuse an unknown version drift beyond N minutes |
| TOCTOU on cached permissions | Zanzibar's new-enemy problem; stale JWT claims after revocation; "re-authorize every request" | Session snapshot + version check on dangerous routes + revocation marks on the next request (today) + fresh sign-in for destructive actions |
| IDOR when scopes are not enforced at the data layer | OWASP: horizontal escalation is the most common authz weakness; enforce at the data layer | Scope filters in the repository layer, not in the page; a CI test (`rules_check`-style) that every repository read on a scoped table takes `allowedScopes` |
| Fail-open on missing policy rows | The `0054` incident: a silently dropped registry row made a check a no-op | Unknown capability → refuse; missing compiled map → 403 (today); modules register capabilities with a manifest test like `action-keys-enforced.test.ts` |

## 7. Recommended model for the kit (one page)

### 7.1 Entities (D1, shared `madagascar-db`; prefer reuse of `admin_portal_settings`, `admin_audit_log`, `admin_pages`-style registry)

```
tenant            (id, name, policy_version, owner_principal_id)
principal         (id, tenant_id NULL for the Vendor, kind: person|service|vendor, external_subject, is_active)
module            (id 'email'|'backup'|'vps'|'github'|..., bit_plane INTEGER, version)
capability        (id 'email.templates.manage', module_id, bit INTEGER, class read|operate|admin,
                   floor BOOL, requires_fresh_sign_in BOOL, requires_second_person BOOL,
                   resource_type NULL|'booking'|'location'..., label, description)   -- registered by modules
scope             (id, tenant_id, parent_id NULL, kind 'tenant'|'department'|'team'|'location'|custom, name, external_id)
group             (id, tenant_id, parent_id NULL (depth ≤3), name, source manual|cloudflare_access|scim, external_id)
group_member      (group_id, principal_id)
role              (id, tenant_id NULL for Vendor-owned templates, name, position INTEGER, is_template BOOL)
role_capability   (role_id, capability_id)
binding           (id, tenant_id, subject_kind principal|group, subject_id, role_id, scope_id,
                   effect allow|deny, eligible BOOL, starts_at, expires_at, granted_by, reason)
override          (tenant_id, principal_id, capability_id, scope_id, effect allow|deny, expires_at, granted_by, reason)  -- today's admin_page_overrides, generalised
resource_scope    (resource_type, resource_id, scope_id)   -- or a scope_id column on each scoped table
approval, access_request, access_review  -- as today (admin_portal_settings rows or their own tables; reuse first)
```

Everything a client creates lives in rows; nothing a client does changes code. The only
built-in principal is the Vendor (`kind = vendor`, `tenant_id NULL`).

### 7.2 The check (CPU budget ≈ 50–200 µs, zero network on the warm path)

At sign-in (and on `authz-changed` or a `policy_version` move), **compile** for the principal:
walk groups (≤3 deep), collect bindings, for each scope compute `allow[]` and `deny[]` bitsets
per module by OR-ing role bitsets, apply overrides, and store
`{policyVersion, scopes: {scopeId: {allow: bits[], deny: bits[]}}, parent: {scopeId: parentId}}`
in the session record (today's access map, ≈2–6 KB). The compile is one batched D1 query set,
same order of cost as today's 0.65 ms.

`can(session, capabilityId, scopeId?)`:

1. Unknown capability → deny. Vendor principal → allow unless the tenant has switched Vendor
   access to "approval needed" (then deny with `need: vendor_approval`). Owner role → allow
   except floors marked `vendor_only` (today's grant-only page rule).
2. Walk from `scopeId` up to the tenant root (≤4 steps). At each node: if `deny` bit set → deny
   (deny anywhere on the path wins, GCP/AWS rule). Collect `allow`.
3. If any node allowed → allow, else deny.
4. Floors: a capability with `floor = 1` is allowed only if the role that granted it is the
   Owner role or the Vendor (stamped at compile time as a separate bit-plane `floorOk`).
5. Routes flagged `requires_fresh_sign_in` or `requires_second_person` run those gates after.
6. Dangerous routes (`FRESH_POLICY_ROUTES`) read `tenant.policy_version` from D1 first and
   recompile if it moved: closes the TOCTOU window at the cost of one D1 read on those routes only.

Row-level reads: `allowedScopes(session, capabilityId)` returns the scope ids whose subtree
allows the capability; repositories add `WHERE scope_id IN (...)`.

### 7.3 How modules register capabilities

Each module ships a static manifest (`contract/capabilities.ts`, the cf-vps pattern): module id,
bit plane, capability ids with class, floor, fresh-sign-in, second-person, resource types, labels.
On deploy a migration-free upsert (`INSERT OR IGNORE`, then `UPDATE` labels) writes the rows;
bits are assigned once and never reused (a retired capability keeps its bit, `is_active = 0`).
A CI test fails the build if two modules claim one bit plane, if a capability has no label, or
if a route checks an id the manifest does not declare (today's `action-keys-enforced.test.ts`).
Kubernetes-style **aggregation**: a module may ship `role_template` fragments ("Email operator")
labelled by module; a client role that opts into a template fragment receives the module's
future additions automatically, which the client can turn off per role.

### 7.4 The Vendor and the handover

- The Vendor principal exists from the first migration, tenant-less, with every capability
  and every floor. It is the only principal that can create a tenant.
- Creating a tenant creates the root scope, the Owner role (position 0, all non-vendor
  capabilities, cannot be deleted or edited below a fixed minimum set that includes
  `iam.roles.manage`, `iam.bindings.manage`, `audit.view`), and **one invitation** to the
  client's first Owner (email, single use, 7 days). Today's rule "when nobody else could
  approve, the change goes ahead alone and the record says `secondPerson: 'none available'`"
  covers this first Owner.
- Handover = the moment the first Owner accepts. From then on: the Vendor cannot hold the
  Owner role; making or removing an Owner needs a second Owner (or the Vendor + an Owner); the
  last Owner cannot be removed (today's D14 guard); every Vendor action in the tenant is emailed
  to Owners and sealed; the tenant may set Vendor access to `always`, `approval needed` (JIT, a
  time-boxed eligible binding the Owner activates) or `incident only` (break-glass, loud).
- Vendor-only floors (today's Page Registry rule) stay the Vendor's: platform-level module
  settings, bit-plane registry, tenant creation, seal verification keys.

### 7.5 What to keep from the current model

Keep, generalised to roles/scopes: deny beats allow; owner bypass except vendor floors; floors;
grant-only (vendor-only) capabilities; gates A–D and T1–T5 as the single boundary rule
("edit roles and bindings only with what you hold, only below your position, only inside your
scope"); self-edit refused; target role read from the DB; expiring grants with a 90-day default;
temporary console powers; access requests decided by whoever could grant; two-person rule as a
capability flag; fresh sign-in (10 min) with the testing pass; quarterly access review; emailed
access changes; the sealed daily audit chain; the session-embedded compiled map with
`authz-changed` marks and `refreshAt`; the signed actor header to consoles; "See it as"
read-only; fail-closed on unknown keys and on a missing map; the manifest-and-test discipline
for capability ids.

Drop: the fixed six-tier ladder and `required_role` per page (replaced by role position and
bindings); page paths as the permission vocabulary (pages become capabilities with
`resource_type = page`, kept as keys so the sidebar logic survives); the legacy role
vocabulary translation (C-11 becomes moot).

Open questions for the owner: (1) whether group nesting is needed at all in v1 (depth 1 is
far simpler and Workspace gets by with OUs); (2) whether scopes are one tree or several
(location *and* department as two dimensions means two scope ids per binding and two walks);
(3) whether Cedar conditions are wanted at all before a client asks.

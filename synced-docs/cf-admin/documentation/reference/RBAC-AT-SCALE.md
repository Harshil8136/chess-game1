---

title: "Permissions at Scale — From 6 Roles/20 Staff to 100+ Roles/1000+ Staff"
status: draft
audience: [ai, technical, owner]
last_verified: 2026-08-06
verified_against: [research, docs]
owner: harshil
related_code: [src/lib/auth/rbac.ts, src/lib/auth/plac.ts, src/lib/auth/session.ts, src/lib/auth/pipeline.ts]
related_docs: [architecture/plac-and-audit.md, architecture/ARCHITECTURE.md, ../MAINTENANCE.md]
tags: [rbac, abac, pbac, rebac, permissions, scale, authorization, research, zanzibar]
---

# Permissions at Scale — From 6 Roles/20 Staff to 100+ Roles/1000+ Staff

> **Status note (2026-08-23).** This is forward-looking scaling analysis. For what is
> actually built and measured today, see
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).


> **TL;DR (non-technical):** cf-admin's current permission system (6 roles, page-level
> overrides) is a small, well-built version of a pattern the whole industry uses. This
> document is a research-backed teaching reference for what changes — and what doesn't —
> if the same product ever needs 100+ distinct roles and 1000+ staff checking permissions
> constantly. It fact-checks a specific proposal (a flat per-user permission table plus
> Cloudflare-JWT-embedded claims) against how Cloudflare's own storage primitives actually
> behave, and against how Google, AWS, and Discord solve the same problem at far larger
> scale. **Nothing in this document is implemented.** It is a reference for a future
> decision, written before any code changes.

## Context / Scope

This document answers one question: *if cf-admin (or a product built on the same
pattern) needs to go from 6 roles / a few dozen staff to 100+ roles / 1000+ staff,
all checking permissions on every request, what is the industry-standard, durable,
Cloudflare-native way to do it?*

It covers:

- A fact-check of a specific proposal discussed by the owner (a flat `user_permissions`
  table + `group_permissions` table + embedding the result in a Cloudflare JWT).
- The actual, current behavior of Cloudflare KV, D1, and Durable Objects relevant to
  a permissions system — pulled from Cloudflare's own documentation, not assumption.
- The four names the industry uses for this problem — RBAC, PBAC, ABAC, ReBAC — what
  each one is, a real system that uses it, and when it's the right (or wrong) tool.
- A recommended blueprint sized for 100+ roles / 1000+ staff that stays inside
  Cloudflare's free-to-low-cost tier philosophy this project already commits to.
- How this connects to what already exists in cf-admin today (RBAC + PLAC), and the
  trigger conditions for when to move from one to the other — mirroring the
  "Scale-Up Vault" philosophy already written into `architecture/ARCHITECTURE.md` §8.

It deliberately does **not** cover: multi-tenant SaaS data isolation (a separate
problem — see `documentation/MAINTENANCE.md` M-1..M-6, which explicitly rules out
multi-tenancy for cf-admin's commercial model), or a concrete implementation plan.
This is a decision-support document, not a spec.

---

## 1. Why "just add more rows" breaks down — role explosion

At 6 roles and a small staff count, a role hierarchy plus a small override table
(exactly what cf-admin has today — see `architecture/plac-and-audit.md`) is close to
the ideal solution: simple, auditable, fast, and small enough that one engineer can
hold the whole model in their head.

The moment an organization tries to model **100+ roles**, it is almost always hitting
what identity-and-access-management literature calls **role explosion**: instead of
"Manager," "Staff," "Viewer," the org starts minting "Manager — East Region,"
"Manager — West Region," "Manager — East Region — Bookings Only," and so on — a
combinatorial product of *job function × department × region × store × shift*. The
role count grows multiplicatively with the number of dimensions, not additively, and
nobody can review 100+ literal roles by eye.

**The practical implication for this project:** before building anything, distinguish
two very different situations that both get described as "100+ roles":

1. **Genuinely 100+ distinct job functions**, each needing a meaningfully different
   permission set. Rare in practice — most orgs top out at a few dozen real job
   functions even at thousands of employees.
2. **A handful of job functions × several *attributes*** (region, department, store,
   shift) that got modeled as separate roles because the system had no other way to
   express "same permissions, different scope." This is far more common, and it is a
   modeling problem, not a scale problem — the fix is **attributes on the user**, not
   more roles (see §4.3, ABAC).

Assume it's (2) until proven otherwise. Ask "does a Manager in Region A need a
*different set of features* than a Manager in Region B, or the *same features scoped
to a different region*?" Almost always it's the second, and that changes the entire
design.

---

## 2. Fact-check: the proposal (flat table + JWT)

The proposal discussed: one `user_permissions` table (columns roughly `UserName`,
`Permission`, `Group`, `DefaultValue`), a separate `group_permissions` table for role
defaults, two D1 reads on login to assemble the full permission set, and embedding the
result "in Cloudflare JWT settings" so it's tamper-proof.

**What's right about it:**

- Compute the permission set once (at login / on change), not on every request. This
  is the correct instinct and is exactly what cf-admin's PLAC already does
  (`computeAccessMap()` in `src/lib/auth/plac.ts`).
- D1 as the durable source of truth for roles and overrides is the right choice —
  it's relational data with real constraints (foreign keys, CHECK constraints), which
  is exactly what SQL is for.
- "Refetch from source on any doubt" as a fallback is the right fail-safe instinct.

**What needs correction:**

| Issue | Why it matters at 1000+ staff |
|---|---|
| **`UserName` as the primary key of a permissions table.** | Usernames and emails change (marriage, rebrand, corrected typo). A permissions/audit ledger keyed on a mutable field either orphans history or silently merges two people. Every serious IAM system keys on an immutable internal ID and treats username/email as a display attribute, never a join key. |
| **Storing `DefaultValue` denormalized inside the per-user row.** | The default already lives once in `group_permissions`. Copying it into every user row means the same fact now lives in two places. The moment a group's baseline permission changes, you must decide whether to rewrite every existing per-user row that copied the old default (expensive, and easy to get half-done) — or leave them stale (which defeats the purpose of storing them). cf-admin's actual `admin_page_overrides` table already avoids this: it stores **only the exception**, never the default, and always recomputes the baseline fresh from the role table. Keep that; it's the more mature pattern the proposal is unintentionally moving away from. |
| **One row per (user × permission) if the table is meant to hold the *full resolved set*.** | 1000 users × ~100 relevant permissions ≈ up to 100,000 rows just to represent "what everyone can do," most of which are just "the role default, restated." Compare to override-only storage, which at a realistic exception rate (a handful of exceptions per user, most users have zero) stays in the low thousands of rows or fewer — a 10-50x difference in table size, index size, and JOIN cost, for storing the *same information*. |
| **"Set it with Cloudflare JWT settings so it's tamper-proof."** | Two different things are being conflated. (a) The Cloudflare Access JWT (the `CF-Access-JWT-Assertion` header cf-admin already reads) is minted by Cloudflare's identity layer and carries *identity* claims (email, IdP, `sub`) — an application cannot add custom permission claims to it. (b) If the intent is to mint the *app's own* signed JWT and hand it to the browser as the session token, that is a legitimate, common pattern — but it trades away something a staff-access-control system needs more than it needs statelessness: **instant revocation.** A signed JWT is tamper-proof (nobody can forge its claims) but it is not *revocable* before its expiry without a server-side deny-list check on every request — at which point you're doing the same server-side lookup you were trying to avoid, except now you're also carrying a stale, unrevoked permission set around in a token until that lookup catches it. See §6 for the sharper version of this trade-off. |
| **Two separate D1 round-trips.** | If `group_permissions` and the user-override table live in the same D1 database (they should), this is one `LEFT JOIN` query, not two round-trips. cf-admin's `computeAccessMap()` already does this in a single query. Two round-trips only makes sense if the two data sources genuinely live in different systems. |

**Bottom line:** the instinct (compute once, cache, D1 as source of truth, KV/session
for speed) is correct and is already validated in production by cf-admin's own PLAC
system. The specific schema shape (flat table, denormalized defaults, mutable key) and
the JWT idea both quietly reintroduce problems the *existing* PLAC design already
solved. The fix at scale is to generalize what's already there (§5), not replace it.

---

## 3. Cloudflare's actual primitives — verified, not assumed

These numbers are pulled from Cloudflare's current documentation (via the project's
`cloudflare` skill reference, cross-checked against `developers.cloudflare.com`), not
from memory. Verify against `developers.cloudflare.com` again before relying on exact
figures in an implementation — Cloudflare's limits move.

### Workers KV

| Property | Value | Implication for a permissions system |
|---|---|---|
| Write→global propagation | **Eventually consistent, up to 60 seconds** globally (same-colo reads see a write immediately) | A `revoked:{userId}` flag or a "permission epoch" counter written to KV is **not instantly global**. A user in a different Cloudflare colo can keep their old cached permission for up to 60s after a revocation. This is exactly why cf-admin's existing 3-layer force-kick doesn't rely on KV alone for the "instant" guarantee — Layer 3 (a direct call to the identity provider's session-revocation API) is what actually closes the gap. Generalize *that* pattern, don't drop it for a JWT that has no revocation path at all. |
| Negative caching | A "key not found" result can be cached for up to 60s | Check-then-create races (check if a session/flag exists, then create it) can silently miss for up to a minute. |
| Write rate | 1 write/second **per key** | An `epoch` counter that many requests try to bump concurrently will hit 429s. Route writes through a single owner (a Durable Object, see below), not directly from many Workers. |
| Cost shape | Reads $0.50/million, writes/deletes $5/million | Design for read-heavy, write-light: compute once on login/change (write), read many times per session (cheap). Never write on every permission check. |
| Value size | 25 MiB max (512 B key) | Irrelevant at these permission-set sizes even unoptimized — the real reason to keep the cached set compact is speed and cost, not this ceiling. |

### D1 (SQLite at the edge)

| Property | Free tier | Paid | Implication |
|---|---|---|---|
| Read replicas | **Not available** | Available (paid add-on) | On the free tier — which is this project's stated $0 commitment — D1 effectively has one primary location. A globally distributed staff base will see materially different latency depending on distance from that location; "under 50ms" is a reasonable claim for users near it, not a guarantee everywhere. If 1000+ staff are geographically spread, budget for D1 read replicas (a real, if modest, cost) rather than assuming free-tier D1 is latency-uniform worldwide. |
| Database size | 500 MB | 10 GB | 1000 users × a modest role/override schema is trivially small either way — this is not the constraint that will force a paid plan; global latency is. |
| Concurrent requests | 10,000/min | higher | A useful sanity ceiling: "thousands of permission checks at once" is well inside free-tier D1's stated concurrency, **provided** those checks hit the KV/session cache and not D1 directly — see §5. |
| Read-replica lag | 100 ms – 2 s (paid, if using replicas) | | Read-after-write on a replica can be stale for up to ~2s. Not a concern for the compute-once-cache pattern below, since the write and the value used immediately after it come from the primary, never a replica. |

> **Correcting a common assumption: a Worker and its D1 database are *not*
> automatically "the same node."** Cloudflare's own D1 docs state it plainly: D1
> "routes all queries to a specific database instance in **one location** in the
> world, known as the primary database instance," and "users located further away
> from the primary database instance experience longer request latency due to
> network round-trip time." A Worker, by contrast, runs at whichever of 300+ edge
> locations is nearest the *end user* (or, with Smart Placement enabled, nearest a
> concentrated backend — see below). So a Worker handling a request for a user in
> Sydney, talking to a D1 primary that lives in, say, the US, pays real cross-region
> network latency on that query — the two are only "the same node" when your users
> happen to be geographically near wherever the D1 primary was placed. This is
> exactly why read replicas exist (a paid add-on that puts read-only copies nearer
> distributed users) and why **Smart Placement** exists (moves the *Worker's
> execution*, not the database, near a geographically-concentrated backend when a
> single request makes several round trips to it — see
> `references/smart-placement/` in the project's `cloudflare` skill). Neither is
> needed for the design in §5 below, precisely because that design deliberately
> keeps D1 off the hot path (§5 point 6) — D1's absolute location stops mattering
> once it's only touched on login/change instead of on every permission check.

**Measured/reported latency (not an official SLA — Cloudflare does not publish
guaranteed numbers for either; figures below are from Cloudflare's own docs plus
third-party benchmarks, see Sources):**

| Path | Reported latency | Source-quality note |
|---|---|---|
| KV read, hot/cached key | roughly 1–10 ms | Consistent across Cloudflare's own materials and third-party benchmarks |
| KV read, cold/cache-miss key | roughly 30 ms+, worse with distance from the value's origin | Third-party benchmark; matches the "negative caching" and propagation behavior in §3's KV row |
| D1 query, execution time at the primary once reached | sub-millisecond (SQLite is fast) | Third-party benchmark of the database engine itself, **not** including network time to reach it |
| D1 query, full round-trip when Worker and primary are geographically separated | tens to 100+ ms, scaling with distance (comparable to any cross-region database call) | Cloudflare's own docs describe the effect; exact figures are third-party observations, including public Cloudflare Community threads reporting exactly this surprise |
| Durable Object call, once placed/warm | low single-digit to low tens of ms within its region | Consistent with DO's stated design (placement near first caller, strongly consistent, single-threaded) |

**The practical takeaway:** none of this changes the recommendation in §5 — it
strengthens it. If D1 is only touched rarely (login/role-change), its worst-case
cross-region latency (tens to 100+ ms) is a rounding error paid occasionally, not a
tax paid on every request. If D1 were on the hot path instead, this exact latency
profile is what would make that a real problem regardless of how much the free tier
otherwise allows.

### Durable Objects

| Property | Value | Implication |
|---|---|---|
| Consistency | **Strongly consistent**, single-threaded per object | The one Cloudflare primitive that can give a genuinely instant, globally-agreed "has this been revoked" answer — unlike KV's ≤60s eventual consistency. |
| Placement | Spawns near first request; a single global object becomes a round-trip for everyone far from it | Don't put one DO in the whole architecture for "all permissions." Use it narrowly — e.g., one per organization/tenant, or per security-sensitive action — for the *write*/kill-switch path, not as a replacement for the KV read cache. |
| Throughput | ~1,000 req/s per object before you must shard | Fine for "how often does a revocation happen" (rare); wrong tool for "how often is a permission checked" (constant) — that's what the KV-cached session is for. |

**The one-sentence synthesis:** KV is the right tool for *fast, frequent reads of a
computed answer*; D1 is the right tool for the *durable, relational source of truth*;
Durable Objects are the right tool for the *rare, must-be-instant, must-be-globally-
agreed write* (a hard kill-switch). A permissions system at any scale needs a role for
all three — the mistake is trying to make one of them do all the jobs.

---

## 4. The four industry models, and a real system that proves each one

### 4.1 RBAC (Role-Based Access Control) — what cf-admin has today

Users are assigned one role from a small, ordered hierarchy; each role implies a
permission set; higher roles typically imply everything lower roles have. Cheap to
reason about, cheap to audit, breaks down via role explosion once "role" starts being
asked to also encode department/region/store (§1).

**Cloudflare fit:** excellent — this is what a single D1 table plus a KV-cached
computed map already does, at near-zero cost, at any request volume the free tier
supports.

### 4.2 PBAC (Policy-Based Access Control) — AWS IAM's model

Instead of a permission living directly on a role, it lives in a **reusable policy
document** — a named bundle of permissions ("read bookings," "export logs," "manage
users in own region"). Roles/groups/users get one or more policies *attached*; the
same policy can be reused across many roles. Crucially, AWS IAM's evaluation rule is
**default-deny, and an explicit Deny always wins over any Allow** — the exact same
"deny wins" algebra cf-admin's PLAC already implements for page overrides.

**Why this is the real fix for "100+ roles":** the number of *distinct policy
documents* an organization actually needs is almost always far smaller than the
number of job titles, because policies are reusable across job titles. "100+ roles"
often collapses to "15-30 policies, combined in different ways" once policies (not
roles) become the unit of reuse.

**Cloudflare fit:** excellent — a policy is just another row in D1 (a name, a
description, and a bitmask or small JSON of the permissions it grants), and
"attach policy to role/user" is a small join table. No new infrastructure required.

### 4.3 ABAC (Attribute-Based Access Control) — the fix for "same role, different scope"

Instead of (or alongside) a role, the system evaluates **attributes** of the user and
the resource at check time — department, region, store, "is this record owned by me,"
time of day, MFA status. A single "Manager" policy can say "can approve bookings
*where booking.region == user.region*" instead of needing "Manager — East," "Manager —
West," etc. This is precisely how the combinatorial explosion in §1 gets undone.

**Cloudflare fit:** good, with a caveat — attribute *matching* is cheap (a
comparison in application code once the attributes are already loaded), but if
conditions get elaborate (nested resource ownership chains, multi-hop "is a member of
a team that has access to a folder that contains this document") you are drifting
toward §4.5 (ReBAC) whether you call it that or not.

### 4.4 Bitmask / Bitfield permissions — Discord's model, proof this works past 1000 users

Discord — hundreds of millions of users, servers with 100+ distinct permission flags —
stores a member's permissions as a single integer, computed by OR-ing together the
bits for each granted permission, and checks a permission with a single bitwise AND.
On top of the guild-wide (role-based) baseline, Discord layers **per-channel
permission overwrites** — explicit allow/deny exceptions, scoped to a role or a
specific member, where an explicit deny beats a role-based allow.

That is, feature-for-feature, the same "role default, with explicit per-scope
overrides where deny wins," that cf-admin's PLAC already implements — just represented
as bits instead of a `Record<string, boolean>` hashmap. The practical payoff of the
bitmask representation specifically is **compactness**: a handful of 32/64-bit
integers (one per feature category — content, bookings, users, finance...) represent
what would otherwise be 100+ separate named boolean columns or hashmap keys, which
matters directly for KV value size, session cookie/JWT size if ever needed, and the
cost of transmitting/diffing a permission set.

**Cloudflare fit:** excellent, and directly complementary to §4.2/4.3 — a policy or
role's permission grant is naturally represented as one or a few bitmask integers;
overrides stay as small delta rows exactly like today.

### 4.5 ReBAC (Relationship-Based Access Control) — Google Zanzibar, and its open-source descendants

Google's internal authorization system, described in the public *Zanzibar* paper,
answers a different question than RBAC/ABAC do: not "what role does this user have,"
but "is there a path through a graph of relationships connecting this user to this
resource" — e.g., *user is a member of team, team is an editor of folder, folder
contains document* → user can edit the document. This is the model behind sharing in
Google Drive, Docs, and Calendar, and it is built specifically for **resource-level
sharing graphs**, not job-function hierarchies.

Three well-known open-source, Zanzibar-inspired systems exist: **OpenFGA** (developer-
friendly, Postgres/MySQL-backed), **SpiceDB** (the most faithful reimplementation,
built for strong global consistency via a token it calls a ZedToken, typically run on
CockroachDB/Spanner-class storage), and **Ory Keto** (one of the earliest open-source
implementations, HTTP/gRPC, commonly paired with the Ory identity stack).

**Cloudflare fit: poor, until proven otherwise.** All three of these are **separate
services** you would deploy and operate, each needing its own backing relational
database and its own compute — real, ongoing infrastructure and cost that sits outside
a Cloudflare Worker and outside this project's stated $0-infrastructure model. They
are the right answer when the actual requirement is a resource-sharing *graph*
("anyone on this booking's care team, plus their manager's delegate, plus...") — not
when the requirement is "which of ~100 job functions does this employee have."
**Recommendation: do not adopt this for a pure staff/role permissions system.** Treat
it the same way this codebase already treats other deferred complexity in
`architecture/ARCHITECTURE.md` §8 ("Scale-Up Vault") — a named, trigger-conditioned
option for later, not a default.

### 4.6 The middle ground: hand-rolled relationship tuples in D1 — no new service required

A fair objection to §4.5: adopting OpenFGA/SpiceDB/Ory Keto is an all-or-nothing,
whole-new-service decision, but the *idea* behind ReBAC — "permission comes from a
relationship, not a role" — doesn't strictly require adopting one of those engines.
It's entirely possible to model a **relationship-tuple table directly in D1**: a
single table of rows shaped like *(subject, relation, object)* — e.g., "user:412 —
member-of — team:7," "team:7 — assigned-to — booking:9981" — and write ordinary
application code (or a couple of `JOIN`s / a recursive query) to answer "does this
subject have this relation to this object." This is a real, common pattern — many
teams build exactly this ("a poor man's Zanzibar") in their existing relational
database long before ever adopting a dedicated graph-authorization engine, and it
fits inside this project's existing D1 + KV-cache architecture with **no new service,
no new backing database, and no new operational surface** — it's just another table
and another query, governed the same way `admin_page_overrides` is today.

**Where it genuinely stops working, and a purpose-built engine starts earning its
keep:** shallow relationships (1-2 hops — "is a member of the team that owns this
resource") stay simple SQL. *Deep or recursive* relationships ("is a member of a team
that's nested in a department that inherits access from a shared drive that...",
arbitrary depth, evaluated fast, with a formal consistency guarantee that a
permission change is visible to the very next check) are precisely the problem
Zanzibar-derived engines were built to solve efficiently and correctly, and a
hand-rolled recursive query starts getting slow and easy to get subtly wrong at that
depth. **Use the D1 tuple table for shallow, well-understood relationship patterns;
treat "we need genuine multi-hop graph traversal with strong consistency guarantees"
as the actual trigger for §4.5, not "the role count is high" or "we can now afford
it."**

### Comparison at a glance

| Model | Real-world proof | Solves | Cloudflare-native fit | Adopt when |
|---|---|---|---|---|
| RBAC (hierarchy) | cf-admin today | Small, ordered org | Excellent, $0 | Always the base layer |
| PBAC (policy bundles) | AWS IAM | Role explosion from job-function variety | Excellent, $0 | >~20 roles, lots of shared permission bundles |
| ABAC (attributes/conditions) | AWS/Azure/GCP IAM conditions | Role explosion from scope (region/dept/store) | Good, $0 | Same permission, different scope, repeatedly |
| Bitmask representation | Discord | Compactness/speed at 100+ discrete permissions | Excellent, $0 | Whenever a role/policy's grant set gets past ~15-20 named booleans |
| **DIY relationship tuples in D1** | Common industry pre-Zanzibar-adoption pattern | Shallow (1-2 hop) resource-sharing relationships | Excellent, $0 — just another D1 table | Permission depends on "is related to," not "what role," but the relationship graph is shallow |
| ReBAC (Zanzibar-style engine) | Google Drive/Calendar sharing | Deep/recursive sharing graphs, formal consistency | Poor without new infra — real cost, real new service | Only once relationships need arbitrary-depth traversal or hard consistency guarantees a hand-rolled query can't cleanly provide |

---

## 5. Recommended blueprint for 100+ roles / 1000+ staff, staying Cloudflare-native

This is a description of a *shape*, not an implementation — consistent with "no
coding today." It is a direct generalization of what already exists in cf-admin
(`rbac.ts` + `plac.ts`), not a replacement for it.

1. **Identity stays as-is, but add SCIM at this headcount.** Cloudflare Access (or
   whatever SSO/IdP is in use) still proves identity. At 1000+ staff, joiner/mover/
   leaver churn is constant — manually managing a whitelist table stops being safe or
   sane. **SCIM** (System for Cross-domain Identity Management) is the industry-
   standard protocol most HR systems (Workday, BambooHR, Azure AD, Okta) speak for
   automated provisioning *and deprovisioning*: when someone is terminated in the
   HRIS, SCIM pushes that within minutes, everywhere, without a human remembering to
   click "deactivate." This is a bigger lever on real-world security at this scale
   than any caching architecture below it.

2. **Roles/policies stay small in *count*, even if the permission catalog is large.**
   Keep a single canonical **permission registry** (name, category, human
   description — cf-admin's `admin_pages` + `ROLE_META` already do this for the small
   case) listing every permission that exists, once. Group related permissions into a
   handful of **category bitmasks** (content, bookings, users, finance, HR...) rather
   than one flag per named permission scattered across many columns — this is the
   Discord-proven pattern from §4.4, and it keeps a role/policy definition to a fixed,
   small number of integer columns no matter how large the underlying permission
   catalog grows.

3. **Roles are built from reusable policy bundles (§4.2), and scoped with attributes
   (§4.3) before reaching for a new role.** Before creating role #101, ask whether it's
   actually "role #14, scoped to a different region/department" — if so, add an
   attribute column to the user record and a condition to the policy, not a new role.

4. **Overrides remain delta-only, keyed by immutable ID.** Exactly today's
   `admin_page_overrides` pattern, generalized: a small table of *exceptions* (grant or
   deny, keyed by an immutable user ID and a permission/policy key, deny always wins),
   never a materialized full permission set per user in D1.

5. **Compute once, cache in the server-held session — never in a client-readable
   token.** On login or on any role/policy/override/attribute change, run one JOIN
   across role/policy bundles + attributes + overrides, producing a small set of
   bitmask integers, and store that inside the existing KV-backed session (as PLAC's
   access map already is) — not inside a JWT the browser can read. The client keeps
   holding only an opaque, meaningless session identifier, exactly as today. This is
   strictly more secure than a self-issued JWT (there is nothing in the client's
   possession to reverse-engineer) and, per §3, no slower at the edge.
   **This is exactly the "KV first, D1 as the fallback/source-of-truth" shape already
   running in production today** — `src/lib/auth/pipeline.ts` already reads the
   cached `accessMap` from the session, and only on a miss or staleness does it call
   `computeAccessMap()` against D1 and write the result back to KV, with a further
   fallback if that D1 call itself fails (serve the last-known map rather than lock
   the user out). Generalizing to 100+ roles doesn't change this shape at all — it
   only changes what's inside the cached value (a few bitmask integers instead of a
   small hashmap).

6. **Every permission check on every request is then a single in-memory bitmask
   comparison against the cached session** — no database round-trip per check, which
   is what actually lets "thousands of permissions checked instantly" be true
   regardless of how large the total permission catalog grows. This is unchanged from
   how `checkPageAccess()` already works today; it just operates on bitmask integers
   instead of a hashmap once the permission count is large enough to make that worth
   doing (§4.4's compactness argument).

7. **Solve instant revocation explicitly — don't let caching quietly reintroduce a
   security gap.** Generalize the existing 3-layer force-kick: (a) drop the cached
   session, (b) write a revocation signal, (c) call the identity provider's own
   session-revocation API so the *edge* rejects the old session immediately, not just
   the app. Per §3, a bare KV flag alone is "eventually instant" (≤60s globally) — good
   enough for routine changes, not good enough on its own for "this account is
   compromised, kill it now." Reserve a narrowly-scoped Durable Object (e.g., one
   "security epoch" counter per organization) for that specific, rare, must-be-instant
   case if the CF Access API path alone isn't fast enough in practice — not as the
   general-purpose cache.

8. **Keep the 30-minute-style defense-in-depth re-check regardless.** Cheap insurance
   against every fast-path assumption above being wrong in some edge case nobody
   thought of — this principle doesn't change with scale, it's already correct today.

9. **Govern it like cf-admin already governs the 6-role version, not like a bigger,
   looser version of it:**
   - One source-of-truth file/table for the role and permission catalog, with an
     automated test that fails the build if the model is ever restated elsewhere
     (cf-admin's `rbac-roles.test.ts` already does exactly this for 6 roles — the
     practice, not the specific test, is what needs to scale).
   - A **policy simulation / impact-analysis step** before any role or policy bundle
     is edited — "how many people gain or lose permission X if I save this" — answered
     *before* the save, not discovered after. cf-admin's own docs already describe the
     seed of this for the small case (the Admin Pages Registry Manager's "Impact
     Analysis Engine" in `architecture/plac-and-audit.md` §2.8); at 1000+ staff this
     stops being a nice-to-have and becomes the only way to avoid locking out or
     over-granting a large group by accident.
   - Human-readable labels and descriptions live next to every permission and policy,
     never just a bit position or a raw string, so a new engineer (or an auditor) can
     read the registry without cross-referencing code.

---

## 6. The revocation-vs-statelessness trade-off, stated plainly

This is worth isolating because it's the single most consequential decision, and the
one the original proposal (embedding permissions in a JWT) gets backwards for a staff
system specifically:

| | Server-held session (today's cf-admin pattern, generalized) | Client-held signed JWT with permission claims |
|---|---|---|
| Tamper resistance | Full — client holds a meaningless opaque ID | Full — signature can't be forged |
| Revocation | Instant-to-seconds (delete server state / call IdP revoke API) | **Not possible before expiry** without an additional server-side deny-list check on every request — which, if you add it, means you've paid the "server lookup" cost anyway, while still carrying stale permissions until that check catches it |
| Payload size at 100+ permissions | Irrelevant — nothing permission-shaped leaves the server | Grows with permission count; needs bitmask-packing to stay inside cookie/header size limits, at which point you've re-derived §4.4 anyway, just client-side |
| Right fit for | Employment/staff access control, where "fire someone and their access must actually stop" is a hard requirement | Machine-to-machine/API tokens with short lifetimes and low blast radius if slightly stale |

**Recommendation:** keep permissions server-side at any scale this project is likely
to reach. The marginal latency a JWT might save is not measurable against a cached
KV session read (§3), and what it costs in return — an unrevocable, stale-until-expiry
permission set for a terminated or compromised account — is not an acceptable trade
for a system managing 1000+ staff.

---

## 7. When to move off the current 6-role system — trigger conditions

Mirroring the "Scale-Up Vault" pattern this codebase already uses elsewhere
(`architecture/ARCHITECTURE.md` §8: defer complexity until a stated trigger condition
is actually met, not before):

| Move to... | Trigger condition |
|---|---|
| Bitmask permission representation (§4.4) | Any single role/policy needs to express more than roughly 15-20 discrete boolean permissions — a plain hashmap starts costing more (in KV payload size, diff/audit clarity) than a bitmask would. |
| Policy bundles, PBAC-style (§4.2) | The org needs more than roughly 15-20 *distinct* roles — a strong signal that permissions should be composed from reusable bundles rather than defined per-role from scratch each time. |
| Attributes, ABAC-style (§4.3) | The same role needs to exist multiple times only because of region/department/store/shift — i.e., role count is growing because of *scope*, not because of genuinely different job functions. |
| SCIM-based provisioning | Staff headcount or turnover makes manual whitelist management error-prone — a good rule of thumb is triple-digit headcount with regular joiner/leaver churn. |
| A narrow Durable Object for instant revocation | The measured ≤60s KV propagation window for a revocation is demonstrated to be an actual, unacceptable risk in practice (e.g., a real incident, or a compliance requirement demanding sub-second global revocation) — not before, since it's additional operational complexity for a mostly-theoretical gap today. |
| Hand-rolled relationship tuples in D1 (§4.6) | Permission genuinely depends on a relationship ("shared with my team") rather than a role/attribute, but the relationship is shallow (1-2 hops). No new service needed — just a new table. |
| ReBAC / Zanzibar-style (OpenFGA, SpiceDB, Ory Keto) | Relationships need arbitrary-depth traversal or a formal consistency guarantee a hand-rolled query can't cleanly provide — not merely "the role count is large," and, per §8.4, not gated on affordability at 1000+-seat commercial pricing either (the honest gate is operational complexity, not dollars, at that revenue tier). |

---

## 8. Detailed cost, complexity, maintenance & integration timing

This section was added after live-fetching Cloudflare's current pricing pages
directly (not the static skill reference, which omits Workers/D1 pricing) —
figures below are sourced from `developers.cloudflare.com/workers/platform/pricing/`
and `developers.cloudflare.com/durable-objects/platform/pricing/`, fetched 2026-08-05.
**Confirmed: the "$5 for 25 billion D1 rows-read" figure is exactly right** — that's
the D1 allowance bundled into the $5/month Workers Paid plan.

### 8.1 The actual Cloudflare price list (verified 2026-08-05)

| Product | Free plan | Paid plan ($5/mo minimum) | Overage beyond included |
|---|---|---|---|
| **Workers** (requests) | 100,000/day | 10,000,000/month included | $0.30 / additional million |
| **Workers** (CPU time) | 10ms/invocation | 30,000,000 CPU-ms/month included | $0.02 / additional million CPU-ms |
| **KV** (reads) | 100,000/day | 10,000,000/month included | $0.50 / million |
| **KV** (writes) | 1,000/day | 1,000,000/month included | $5.00 / million |
| **KV** (storage) | 1 GB | 1 GB included | $0.50 / GB-month |
| **D1** (rows read) | 5,000,000/day | **25,000,000,000/month included** | $0.001 / million |
| **D1** (rows written) | 100,000/day | 50,000,000/month included | $1.00 / million |
| **D1** (storage) | 500 MB (5 GB total) | 5 GB included, 10 GB/db max | $0.75 / GB-month |
| **Durable Objects** (requests) | 100,000/day | 1,000,000/month included | $0.15 / million |
| **Durable Objects** (duration) | 13,000 GB-s/day | 400,000 GB-s/month included | $12.50 / million GB-s |
| **Durable Objects storage** (SQLite-backed, recommended) | shares Workers Free storage | 5 GB-month included | rows read $0.001/M, written $1.00/M, storage $0.20/GB-mo |

One number does almost all the work here: **D1 includes 25 *billion* rows-read per
month on the $5/mo plan.** For scale, that is roughly 800,000 rows read *every second*
of the month, continuously — a figure no permissions system for 1000 staff will come
close to touching, even reading D1 directly on every request (which the recommended
design in §5 deliberately avoids anyway).

### 8.2 Worked example — what 1000 staff actually costs

Using deliberately generous assumptions (padded upward, not a best case):

- 1000 staff, each generating ~300 dashboard/API requests per working day
  → **~9 million requests/month** (Workers Paid includes 10M — fits with room to spare;
  this is also comfortably under the "10,000 concurrent requests/min" ceiling D1
  documents even on the free tier, so a synchronized "everyone logs in at 9am" spike is
  not a concern).
- With the §5 design (compute-once, cache-in-session), **each of those 9M requests is
  one KV read**, not one D1 read → 9M KV reads/month against a 10M/month included
  allowance. **$0 overage.**
- Generous login/role-recompute churn: 1000 users × ~10 recompute events/day × 30 days
  = 300,000 D1 JOIN queries/month for the actual role+override lookup, plus writing an
  audit-log row on every one of the 9M requests (cf-admin already does this today) →
  **~9M D1 rows written/month against a 50M/month included allowance, and well under
  1% of the 25-billion rows-read allowance.** **$0 overage.**
- KV writes (new session on login, access-map refresh): generously 1000 × 5/day × 30 =
  150,000/month against a 1M/month included allowance. **$0 overage.**

**Bottom line: for a 1000-staff permissions system built the way §5 describes, the
entire Cloudflare bill is the $5/month Workers Paid plan base fee — usage-based
overage on any of KV, D1, or Workers is effectively $0 at this scale**, and would stay
that way well past 1000 staff (the 25-billion D1 rows-read allowance alone has roughly
2,700x headroom over the worked estimate above). This is not a case for being careless
about efficiency — it's confirmation that the *architecture* in §5, not raw Cloudflare
pricing, is what would ever make this expensive (e.g., accidentally hitting D1 on
every request instead of caching would still likely stay inside the 25B allowance at
this headcount, but throws away the point of caching in the first place: latency, not
just cost).

Durable Objects, if added narrowly per §5 point 7 (one "security epoch" object per
organization, touched only on revocation events — rare), would add negligible cost:
even 10,000 revocation-related calls/month is 1% of the included 1M requests/month,
and duration billing only accrues while the object is actively doing work, not while
idle.

### 8.3 Complexity, maintenance, and new-service ladder

None of the pieces below exist in the codebase today — this is a planning reference,
not a status report. Ordered as an escalation ladder matching §7's trigger conditions:

| Add... | New Cloudflare service? | New non-Cloudflare service? | Complexity to build | Ongoing maintenance burden | Rough integration timing* |
|---|---|---|---|---|---|
| **Nothing** (today's RBAC+PLAC, generalized) | No | No | — (already exists) | Low — same as today | — |
| **Bitmask permission representation** (§4.4) | No | No | Low-Medium — schema change + a permission registry | Low — same admin UI patterns already used for `admin_pages` | Days, not weeks |
| **Policy bundles / PBAC** (§4.2) | No | No | Low-Medium — 1-2 new D1 tables + a join table | Low — same DAL/repository pattern already established | Days to ~1-2 weeks |
| **Attributes / ABAC** (§4.3) | No | No | Medium — condition-evaluation logic added to the access-map compute step | Medium — more test surface (scoped grants need their own test cases) | ~1-2 weeks |
| **SCIM provisioning** | No (Worker receives SCIM calls) | **Yes — an IdP/HRIS with SCIM support** (Okta, Azure AD, etc.; often already owned for other reasons at 1000+ staff) | Medium-High — new inbound API surface, attribute-mapping logic | **Medium** — a real external dependency to monitor (sync health, schema drift, vendor support) | ~1-3 weeks, IdP-dependent |
| **Durable Object for instant revocation** | Yes — Durable Objects binding | No | Medium — new primitive, but cheap and Cloudflare-managed (§8.1) | Low — no server to patch, occasional resharding review only | ~2-5 days for a narrowly-scoped object |
| **ReBAC / Zanzibar-style** (OpenFGA, SpiceDB, Ory Keto) | **No — deliberately not a Cloudflare product** | **Yes — a separate hosted service + its own Postgres/MySQL/CockroachDB backing store** | **High** — new relation-schema language to learn, new service to deploy, network hop off the Cloudflare edge for that call | **High** — a second production database and service to patch, back up, monitor, and staff on-call for; the one item on this list that is a genuinely new operational commitment | Weeks, not days |

*Timing figures are rough planning estimates for a team already familiar with this
codebase's patterns, not commitments — they scale up if the team is new to the stack.

**The honest one-line summary:** every tier up through "Durable Object for instant
revocation" stays inside Cloudflare's managed platform, stays inside (or barely above)
the existing $5/month cost floor, and reuses patterns this codebase already has. ReBAC
is the one tier that changes the deal — real new infrastructure, real new operational
surface — which is exactly why §4.5, §4.6 and §7 all say to reach for a dedicated
engine only when the actual requirement is deep/recursive resource-sharing graphs, not
merely "many roles" (and, per §8.4 below, not decided by whether the money is
available — at 1000+-seat commercial pricing it usually is).

### 8.4 Cost *is* a rounding error at this revenue — but that reframes the argument, it doesn't remove it

If this platform is sold at, realistically, $20+/seat/month, a 1000-staff customer is
a $20,000+/month contract. Against that, even a properly-run self-hosted OpenFGA or
SpiceDB instance — a small compute footprint plus a small Postgres/CockroachDB
instance, realistically tens to a couple hundred dollars a month — is genuinely a
rounding error. **This is a fair and correct point, and it changes the conversation:**
the reason to avoid ReBAC at this revenue tier is no longer "you can't afford it."

What doesn't change with revenue is the *kind* of commitment it is. A D1 table (even
the §4.6 relationship-tuple version) is Cloudflare-managed: no server to patch, no
backup strategy to design, no version upgrades to plan around, no separate on-call
runbook. A self-hosted authorization engine is a **second production database and
service** sitting in the security-critical path of every request — it needs its own
monitoring, its own backup/restore testing, its own upgrade cadence, and someone who
actually understands its relationship-schema language when something looks wrong at
2 a.m. That is true whether the monthly hosting bill is $20 or $2,000. The gate on
ReBAC, in other words, is **"do we have the operational maturity and headcount to run
a second stateful production service reliably," not "can we afford the invoice."**
Given that, and given that §4.6's D1-tuple approach covers the shallow-relationship
case (which is what most staff-permission scenarios actually are) with zero new
operational surface, the practical recommendation is: **default to §4.6, and reserve
a real ReBAC engine for the specific day the relationship graph is demonstrably too
deep for a D1 query to answer cleanly** — not for the day the budget allows it, since
that day, per this section, has likely already arrived.

### 8.5 What the *actual* $0 policy costs — where the free tier breaks, concretely

The project's founding constraint (`RULESAd.md` §"PROJECT MISSION": run at $0/month)
was set for a small-staff, single-tenant deployment. It's worth being precise about
what happens if that exact constraint — Workers **Free** plan, not Paid — is applied
to a 1000-staff scenario, rather than assuming it just scales down proportionally.

Using the same generous-but-realistic assumptions as §8.2 (1000 staff, ~300
requests/staff/day) against the Workers **Free** plan's *daily* (not monthly) caps:

| Resource | Free-tier daily cap | 1000-staff daily demand (worked estimate) | Result |
|---|---|---|---|
| Workers requests | 100,000/day | ~300,000/day | **Exceeded ~3x.** The request volume alone caps out around **~330 staff** at this usage rate — long before 1000. |
| D1 rows written (audit log, ~1 per request) | 100,000/day | ~300,000/day | **Exceeded ~3x**, for the same underlying reason and at roughly the same staff count. |
| D1 rows read (role/override recompute, rare) | 5,000,000/day | a few thousand/day | Not the binding constraint — recomputes are rare even at 1000 staff. |
| **KV writes** (session create + periodic patches — `lastActiveAt` every ≤5 min, role-recheck every 30 min while a session is active, per `session.ts`) | **1,000/day** | A single continuously-active staff member alone can generate on the order of 100+ session-patch writes across an 8-hour day under today's exact touch pattern — so **the free tier's write budget is exhausted by roughly a dozen or so simultaneously-active staff**, not 1000 | **By far the tightest ceiling of the four**, and the first one to break — well before request volume becomes the story at all. |

**The conclusion, stated plainly: the true $0 architecture cannot serve 1000 staff,
full stop — not because of anything about how permissions are modeled, but because
the Workers Free plan's own daily quotas (KV writes tightest, Workers
requests/D1-writes next) are structurally sized for a small deployment and are
exhausted by ordinary session activity alone, at a headcount in the dozens-to-low-
hundreds, not thousands.** This isn't a permissions-architecture failure to design
around — throttling session-patch frequency (e.g., every 30 minutes instead of every
5) buys some headroom on the KV line specifically, but does not change the
conclusion, because the Workers-request and D1-write ceilings bind at a similar
headcount regardless.

Put next to §8.2 and §8.4: the $5/month Workers Paid plan isn't an upsell decision at
1000-staff scale, it's the literal minimum viable plan — and at $20+/seat/month
commercial pricing, it is, like a self-hosted ReBAC engine, a rounding error rather
than a trade-off worth spending time on.

### 8.6 A more realistic $0 question: does it hold for a 20-seat free/trial tier?

The commercial context this was raised in: Velox bills ~$19/seat, and the idea floated
was offering a small number of seats (e.g. 20) free/loss-leader to a prospective
client, on the assumption that "zero services cost" would carry that. Worth checking
properly rather than assuming, using §8.5's same method at n=20 instead of n=1000:

| Resource | Free daily cap | 20-staff daily demand (same 300 req/staff/day assumption) | Headroom |
|---|---|---|---|
| Workers requests | 100,000/day | 6,000/day | **~16x headroom — comfortable** |
| D1 rows written (audit log) | 100,000/day | 6,000/day | **~16x headroom — comfortable** |
| D1 rows read | 5,000,000/day | negligible | **Comfortable, not close** |
| **KV writes** (session create + `lastActiveAt` patch every ≤5 min + role-recheck patch every 30 min, per today's exact `session.ts`/`pipeline.ts` code) | **1,000/day** | ~113/staff/day if *continuously* active all 8 hours (1 login + 96 activity patches + 16 role-recheck patches) → **~2,260/day if all 20 are continuously active** | **Over the cap by ~2.3x in the worst case** — the same constraint that bound 1000 seats binds 20 seats too, just far less dramatically |

**Honest read:** every resource except KV writes has huge headroom at 20 seats — this
is nowhere near the 1000-seat blowout in §8.5. KV writes are the one line that's
genuinely borderline, and the answer depends on real usage intensity: the ~2,260/day
figure assumes all 20 people are making a request in *every single* 5-minute window
across a full 8-hour day, which is a worst case, not a typical one — actual staff
checking a dashboard intermittently rather than continuously would use meaningfully
fewer writes. This is exactly the kind of thing worth measuring against real traffic
rather than assuming either way (see the live-verification note below).

**The one change worth making regardless of the answer above:** the `lastActiveAt`
patch (every ≤5 min) and the role-recheck patch (every 30 min) are two separate
`patchSession()` calls today. Throttling the activity-heartbeat write to align with
the 30-minute role-recheck interval — one combined write every 30 minutes instead of
up to seven separate writes in that window — cuts the per-active-user daily write
count from ~113 to ~17, which moves the worst-case "how many continuously-active
seats fit in the free tier" ceiling from **~9 to ~58**. That's the single highest-
leverage lever available if the goal is specifically to stretch a genuine $0
architecture across more free/trial seats, and it costs a small code change, not a
new service or a paid plan.

**Live-verification attempted, blocked:** this session tried to pull actual 30-day
account-wide usage (Workers/D1/R2/Queues) via the GraphQL Analytics API using the
`CLOUDFLARE_API_TOKEN` already present in `.dev.vars`, reusing the exact query shape
`src/lib/analytics/providers/cloudflare.ts` uses in production. Cloudflare's own
`/user/tokens/verify` endpoint returned `"Invalid API Token"` for that value — it is
expired, revoked, or simply a stale local-dev copy (this is independent of whatever
is set as the production secret via `wrangler secret put`, which this session cannot
see). **This section's numbers remain modeled, not measured, pending either a valid
token or a manual check of the Cloudflare dashboard's own Usage/Analytics page** —
re-verify against real traffic before treating the 20-seat borderline call as settled
either way.

---

## Glossary

- **Role explosion** — the combinatorial growth of role count when "role" is asked to
  encode both job function and scope (region/department/etc.) at once.
- **RBAC** — Role-Based Access Control: permissions attach to a role, users get roles.
- **PBAC** — Policy-Based Access Control: permissions attach to a reusable policy
  document, which is attached to roles/users/groups (AWS IAM's model).
- **ABAC** — Attribute-Based Access Control: permission depends on attributes of the
  user and/or resource evaluated at check time (region, ownership, time, MFA state).
- **ReBAC** — Relationship-Based Access Control: permission depends on a path through
  a graph of relationships between subjects and objects (Google Zanzibar's model).
- **Bitmask / bitfield permissions** — representing a set of boolean permissions as
  bits in an integer; combined with OR, checked with AND (Discord's model; Unix file
  permissions are a simpler, older example of the same idea).
- **SCIM** — System for Cross-domain Identity Management: the standard protocol for
  automated user provisioning/deprovisioning between an identity source (HRIS/IdP) and
  downstream applications.
- **Eventual consistency (KV)** — a write is visible immediately where it was made,
  but may take up to ~60 seconds to be visible everywhere else globally.
- **Epoch / generation counter** — a single counter bumped on any state-invalidating
  change; readers compare their cached value's epoch against the current one to know
  whether to recompute, without needing to know *what* changed.
- **Deny wins** — the evaluation rule (used by AWS IAM, Discord channel overwrites,
  and cf-admin's PLAC alike) that an explicit deny always overrides any grant, no
  matter which layer (role, policy, or override) each came from.

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-08-05 | claude | Read `src/lib/auth/rbac.ts`, `plac.ts`, `pipeline.ts`, `session.ts` in full; live Supabase MCP query against project `[SUPABASE_PROJECT_REF]` for RLS/grants | Confirmed current cf-admin RBAC/PLAC behavior used as the baseline throughout this doc |
| 2026-08-05 | claude | Loaded project `cloudflare` skill references for KV, D1, Durable Objects (the bundle's gotchas and README files — external to this repo) | KV/D1/DO figures in §3 sourced from these; re-verify against `developers.cloudflare.com` before implementation, limits change over time |
| 2026-08-05 | claude | Web search: Zanzibar/OpenFGA/SpiceDB/Ory Keto; Discord permissions bitfield docs | §4.4/§4.5 claims grounded against current public documentation, see Sources below |
| 2026-08-05 | claude | Live `WebFetch` of `developers.cloudflare.com/workers/platform/pricing/` and `.../durable-objects/platform/pricing/` (not the static skill reference, which omits $ figures for Workers/D1) | §8 pricing table confirmed directly from source; the "$5/mo for 25B D1 rows-read" claim verified exactly correct |
| 2026-08-06 | claude | Live `WebFetch` of `developers.cloudflare.com/d1/best-practices/read-replication/`; web search for D1/KV latency benchmarks; re-read `src/lib/auth/pipeline.ts` and `session.ts` for exact session-patch frequency | Corrected the "Worker and D1 run on the same node" assumption (D1 has exactly one primary location, per Cloudflare's own docs) — added §3 latency table and §4.6/§8.4/§8.5 |
| 2026-08-06 | claude | Attempted live Cloudflare GraphQL Analytics API pull (30d Workers/D1 usage) using `CLOUDFLARE_API_TOKEN` from `.dev.vars`, reusing the exact query shape from `src/lib/analytics/providers/cloudflare.ts` | **Blocked** — token fails `/user/tokens/verify` with "Invalid API Token" (local-dev copy only; says nothing about the production secret). §8.6's 20-seat figures remain modeled, not measured, until this is re-run with a valid token or cross-checked against the Cloudflare dashboard directly |

## Sources

- [Fine-Grained Authorization, ReBAC, ABAC & Zanzibar Explained — OpenFGA docs](https://openfga.dev/docs/authorization-concepts)
- [Google Zanzibar Deep Dive — DEV Community](https://dev.to/kanywst/google-zanzibar-deep-dive-handling-2-trillion-acls-in-under-10ms-f06)
- [SpiceDB vs Auth0 FGA: Relationship Authorization Compared](https://sph.sh/en/posts/spicedb-vs-auth0-fga/)
- [Alternatives to OpenFGA — Authzed](https://authzed.com/learn/openfga-alternatives)
- [Discord Developer Documentation — Permissions](https://discord.com/developers/docs/topics/permissions)
- [discord.js — PermissionsBitField](https://discord.js.org/docs/packages/discord.js/14.18.0/PermissionsBitField:Class)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) — Workers, KV, D1 pricing (live-fetched 2026-08-05)
- [Cloudflare Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) — Durable Objects requests/duration/storage pricing (live-fetched 2026-08-05)
- [Cloudflare D1 Global Read Replication docs](https://developers.cloudflare.com/d1/best-practices/read-replication/) — confirms D1 has exactly one primary location; read replicas/Sessions API bookmarks exist specifically to address this (live-fetched 2026-08-06)
- Third-party D1/KV latency benchmarks (community reports, not an official Cloudflare SLA — treat as directional): [Edge Database: Cloudflare D1 in Production](https://tanstackship.com/blog/cloudflare-d1-production-guide), [Cloudflare Community: "High D1 Latency"](https://community.cloudflare.com/t/high-d1-latency/738494), [Cloudflare Community: "Pages + D1 has way higher latency than expected"](https://community.cloudflare.com/t/cloudflare-pages-d1-has-way-higher-latency-than-expected/728285), [Upstash: Benchmarking Cloudflare KV vs Upstash Redis](https://upstash.com/blog/edgecaching-benchmark)
- Cloudflare KV, D1, and Durable Objects behavior/limits (consistency, replicas, throughput) — `developers.cloudflare.com` (via project `cloudflare` skill reference; re-verify current limits before implementation)
- AWS IAM policy evaluation logic (explicit deny overrides any allow; default deny) — long-standing, stable AWS documentation, not independently re-searched this session; verify against current `docs.aws.amazon.com/IAM` if citing specifics in an implementation.

## Related

- [`architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) — the current 6-role RBAC + PLAC system this document generalizes from.
- [`architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) §8 — "Scale-Up Vault," the existing trigger-condition-gated deferred-complexity philosophy this document follows.
- [`../MAINTENANCE.md`](../MAINTENANCE.md) — C-11 (pending role data migration) and M-1..M-6 (commercial/fleet model — explicitly single-tenant-per-deployment, relevant context for why ReBAC/multi-tenant graph systems are out of scope here).
- [`../architecture/GLOBAL-CONFIG.md`](../architecture/GLOBAL-CONFIG.md) — a separate research reference that directly builds on this document's §8.5/§8.6 finding (the `lastActiveAt` heartbeat interval as the tightest free-tier cost constraint), proposing to make it an admin-adjustable setting rather than a code literal.

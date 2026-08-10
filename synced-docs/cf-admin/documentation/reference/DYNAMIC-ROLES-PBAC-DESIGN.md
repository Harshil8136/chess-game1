---

title: "Dynamic Roles, Fixed Permissions — A Greenfield PBAC Design on the Current Stack"
status: draft
audience: [ai, technical, owner, non-technical]
last_verified: 2026-08-10
verified_against: [code, infra, research]
owner: harshil
related_code: [src/lib/auth/rbac.ts, src/lib/auth/plac.ts, src/lib/auth/session.ts, src/lib/auth/pipeline.ts, src/pages/api/system/pages.ts]
related_docs: [PERMISSION-ARCHITECTURE-ASSESSMENT.md, RBAC-AT-SCALE.md, ../architecture/plac-and-audit.md, ../architecture/ARCHITECTURE.md]
tags: [rbac, pbac, dynamic-roles, permissions, d1, kv, architecture, design, greenfield]
---

# Dynamic Roles, Fixed Permissions — A Greenfield PBAC Design

> **TL;DR (non-technical):** This document answers a specific question: *if we were
> designing the permissions system from a blank page today, using the same free
> Cloudflare/Supabase/Upstash/Sentry/PostHog stack, how would we make user roles fully
> dynamic — creatable and editable by an admin, with no code deploy — while keeping
> individual permissions defined in code, where they have to live? The answer:
> **the mental model behind this question is already correct**, and it's the same
> model AWS IAM and Discord both use in production at enormous scale. This document
> works out the concrete data model, what gets simpler (a real amount — two overlapping
> systems collapse into one), what a request actually costs, and confirms this
> redesign changes **what the system can express, not how fast it runs** — the
> performance and free-tier numbers are the same as today's, because the fast part of
> today's design (compute once, cache, check by simple lookup) doesn't need to change
> at all. Nothing in this document is implemented — it's a design reference.

---

## Table of contents

1. [Confirming the mental model](#1-confirming-the-mental-model)
2. [The data model](#2-the-data-model)
3. [The one thing that stays fixed on purpose](#3-the-one-thing-that-stays-fixed-on-purpose)
4. [How a request actually gets resolved](#4-how-a-request-actually-gets-resolved)
5. [What happens when a role's own bundle changes](#5-what-happens-when-a-roles-own-bundle-changes)
6. [Would a library help? A concrete answer](#6-would-a-library-help-a-concrete-answer)
7. [What this replaces, and how much simpler it actually is](#7-what-this-replaces-and-how-much-simpler-it-actually-is)
8. [Service-by-service usage across the current stack](#8-service-by-service-usage-across-the-current-stack)
9. [Performance and scaling — what changes and what doesn't](#9-performance-and-scaling--what-changes-and-what-doesnt)
10. [Current vs. new — a multi-metric comparison](#10-current-vs-new--a-multi-metric-comparison)
11. [A realistic migration path](#11-a-realistic-migration-path)
12. [Final recommendation](#12-final-recommendation)
13. [Sources & verification log](#13-sources--verification-log)

---

## 1. Confirming the mental model

The premise behind the question is correct, and it's worth stating plainly why, because
it's the load-bearing idea for everything below: **a permission is a fact about the
code, not a fact about the organization.** "Can export the audit log" only means
something because a specific piece of code somewhere checks for it before running the
export. You cannot grant a permission that has no corresponding check anywhere — doing
so would create the appearance of control with none of the substance. So the full list
of permissions that can ever exist is bounded by what the codebase actually enforces at
any given moment, and it changes exactly when a developer ships a new protected page or
action — never at runtime, never from an admin screen.

**Roles, by contrast, are just named groupings of permissions someone in the
organization finds useful** — "Regional Manager," "Weekend Supervisor," "Finance
Read-Only." None of those names mean anything to the code; they're a convenience label
over a *set* of the fixed, code-defined permissions. There's no reason that grouping
can't be entirely data-driven, created and edited from an admin screen, with zero
deploys. **Grants** — a specific person getting (or losing) one specific permission,
independent of their role — are the same story: pure data, fully dynamic, and
inherently the right shape to log (who granted what, to whom, when, why).

This is not a new idea being invented here — it is, almost verbatim, how **AWS IAM**
works (a fixed catalog of API-level permissions; roles/policies are just named,
admin-editable bundles of them; individual grants layer on top) and how **Discord**
works (a fixed catalog of permission bits baked into the client and server code; a
guild's roles are entirely user-created bundles of those bits). Both are proven at
scales many orders of magnitude larger than this project will ever need. The industry
name for this shape is **Policy-Based Access Control (PBAC)** — already covered, at the
conceptual level, in the companion document
[`RBAC-AT-SCALE.md`](RBAC-AT-SCALE.md) §4.2. This document is the concrete version of
that idea, worked all the way down to a data model and a request flow.

---

## 2. The data model

Five tables, all in D1 — co-located with the identity/session logic already living
there today, so resolving a person's permissions never has to reach across two
different databases in one operation.

| Table | What it holds | Who edits it | How often it changes |
|---|---|---|---|
| **Permission catalog** | Every permission key that currently exists in the code (e.g. a short string per protected action/page), a human label, a description, and a category for grouping in the UI | **Developers only, via a code change** (a new protected page/action ships with a matching catalog row in the same change) | Rarely — only when a new protected feature ships |
| **Roles** | Admin-created named bundles — a name, a description, who created it, and a flag marking whether it's one of the small number of built-in, protected roles (see §3) | **Admins, freely, from a UI screen** | As often as the organization wants — this is the whole point |
| **Role → permission bundle** | Which permission keys each role grants — a simple join between roles and the permission catalog | **Admins**, via a checkbox-matrix UI (rows = roles, columns = permission catalog) | Whenever an admin adjusts what a role can do |
| **User → role assignment** | Which role(s) each person holds — deliberately allows more than one role per person from day one, so someone can be, say, both "Bookings Manager" and "Read-Only Finance" without needing a bespoke combined role invented for them | **Admins** | Onboarding, role changes, offboarding |
| **Per-user permission overrides** | Individual exceptions layered on top of whatever the person's role(s) already grant — grant one extra permission, or explicitly deny one their role would otherwise give them. Same **deny-always-wins** rule as today's page-override table, and for the same structural reason: one row per (person, permission) pair, so a grant and a deny for the same thing can never both exist at once | **Admins**, with the same safety gates already proven today (actor can't touch their own access, can't grant above their own clearance, target's role is always re-read fresh — see the companion assessment document §1.3) | As needed, individually |

Every one of these tables is a direct, one-for-one generalization of a table that
already exists and is already proven in production — the permission catalog
generalizes the existing page registry; the role-bundle table generalizes nothing that
exists today (this is the genuinely new piece — today's roles are hardcoded, not
data); the per-user override table is structurally identical to today's page-override
table, just keyed by permission instead of by page path.

### 2.1 Verified against the live system — the trigger has already been reached

None of this needs to stay theoretical. A live query against the current production
database, run specifically to check this design against reality, found:

| What was measured | Live result |
|---|---|
| Total permission-equivalent rows today (the current page registry — real pages + `#fragment` sub-features) | 89 (78 currently active, 11 disabled) |
| Split between real pages and `#fragment`-style sub-permissions | 44 real pages, 45 fragments — almost exactly half of today's permission surface is already the fragment workaround described in §7 |
| Permissions in each role's effective bundle today, cumulative (a higher role already inherits everything a lower one has) | staff: 5 · admin *(canonical: manager)*: 36 · super_admin *(canonical: admin)*: 60 · owner: 75 · dev *(canonical: vendor_support)*: 78 |
| Per-user page-access overrides that exist today | 1, for 1 person, across the entire system |

§6 identifies "a role's bundle regularly exceeding roughly 15–20 permissions" as the
point where a compact bitmask starts being worth it over a plain set. **The live
numbers show four of the current five roles are already 2–5× past that point** — only
`staff`, the bottom tier, is still under it. This isn't a future concern to design
around later; it's already true today, at 89 total permissions. The practical
conclusion: **build the role-bundle representation as a small number of per-category
bitmasks from the start**, not as a plain hashmap with bitmask compaction deferred to
"later." With today's 7 real categories (the largest, communication-related
permissions, currently holds 22), a single small integer per category comfortably
covers each one many times over before needing to split further — this costs nothing
extra to build now and avoids a real, if not urgent, rework later.

The near-zero override count (1, total) is worth reading correctly: it is not evidence
the current hierarchy comfortably fits real-world needs — it's a snapshot of a system
that hasn't yet been stressed by much fine-grained customization. §9.1 projects what
happens to that number as the permission catalog grows.

---

## 3. The one thing that stays fixed on purpose

Fully dynamic roles create one real risk that has to be closed by design, not by
policy: if *every* role is just data an admin can edit, what stops an admin from
editing their way into (or granting someone else) god-mode, or from locking out the
platform's own support tier?

The answer is the same one today's system already uses, generalized rather than
discarded: a **small, fixed number of built-in, protected roles** — realistically just
two, matching what exists today: the platform vendor's own support tier, and the
customer's account owner. These are marked as protected at creation time, in code, not
in the editable role table's data, and three things are true of them no matter what any
admin screen allows: they cannot be deleted, their permission bundle cannot be edited
by anyone below that tier, and any account holding one of them is untouchable by
mutation from any other role — exactly today's "ghost protection" rule, generalized
from a numeric rank comparison to a simple "is this account in the protected set"
check.

Everything else — every role an admin actually creates for their own organization — is
fully dynamic, fully editable, fully deletable, with no code-level floor beneath it
other than "cannot touch a protected-tier account." This gets almost all of the
flexibility the goal calls for, while keeping exactly the one guarantee that has to
never be editable by mistake: there is always a way to recover the system if
everything else goes wrong.

---

## 4. How a request actually gets resolved

This part barely changes from what's already running today — it's the same
compute-once-and-cache shape, applied to a different data model:

1. **On login, or whenever a role/override changes:** one query joins the person's
   role assignment(s) against the role-bundle table, producing the union of every
   permission every role they hold grants. A second, cheap lookup applies their
   personal overrides on top — deny removes, grant adds, exactly today's rule.
2. **The result — a flat set of permission keys — is written into the same KV-backed
   session record used today.** Nothing about the session envelope, the cookie, the
   revocation flags, or the 3-layer force-kick mechanism needs to change; only the
   *shape* of the one field holding "what can this person do" changes, from a page-path
   map to a permission-key set.
3. **Every request after that is a single, in-memory set-membership check** —
   "does this person's cached set contain the permission this action requires" —
   no database round-trip, no string-prefix matching, no path-parsing. This is
   actually *simpler* at the point of enforcement than today's page-path system, not
   just more dynamic (§7 has the specifics).
4. The same periodic refresh cadence already in place today (role/assignment
   re-confirmed roughly every 30 minutes, the resolved set refreshed roughly every
   hour or immediately on a relevant change) carries over unchanged.

---

## 5. What happens when a role's own bundle changes

Today's per-user overrides only ever affect one person, so there's no "blast radius"
question. A dynamic role is different: editing what "Bookings Manager" can do
potentially affects everyone who holds that role at once. This needs an explicit
answer, not an assumption:

- A personal override changing → same as today: revoking force-logs-out just that one
  person; granting relies on the natural refresh cycle.
- **A role's bundle changing → force-log-out everyone currently holding that specific
  role**, not the whole system. This is not a new mechanism to invent — it is *exactly*
  the pattern already live in this codebase today for a closely related case: when a
  page's required role is tightened, the system already looks up every active user who
  would lose access and force-kicks precisely that set, nobody else. The same lookup
  (find everyone assigned to role X) plus the same existing force-logout mechanism
  covers this case directly — no new primitive required.

---

## 6. Would a library help? A concrete answer

Three well-known authorization libraries were evaluated for this specific shape:
**CASL** (the most widely used JavaScript/TypeScript authorization library — define
"can user X do Y on resource Z" abilities, with optional per-instance conditions),
**Casbin** (a policy-engine supporting RBAC/ABAC/ACL via a configurable model file, used
across many languages), and **accesscontrol** (a simpler grant-based RBAC library).
All three are pure JavaScript/TypeScript with no platform-native dependencies, so
nothing rules them out on the Cloudflare Workers runtime specifically.

**None of them earns its place here, and the reason is specific, not just "keep
dependencies light":** every one of these libraries exists to solve the problem of
evaluating *conditional* rules at the moment of the check — "can edit this booking only
if it belongs to the user's own region," "can view this document only if related to it
through a chain of team memberships." That's real complexity, and it's exactly what
those libraries are built for. **It is also not the problem this design has.** By the
time a request is being checked, the person's entire permission set has already been
fully resolved and cached — the runtime check is "is this one string present in this
one small set," which is a single, built-in language operation. Bringing in a
rules-evaluation library to answer a question that's already been reduced to a
one-line lookup adds bundle weight, a new dependency to review and keep patched, and
zero actual capability.

**The moment one of these libraries *would* start earning its keep** is if/when the
system needs condition-based scoping — "same role, but only for records in my own
region" — which is the Attribute-Based Access Control layer already flagged as a
distinct, later concern in the companion scaling document, not something today's
question is asking for. That's the trigger to revisit this section, not "the role
count got large" or "we now have a free hand to add anything."

**Recommendation: no library. A plain set works for any role still under roughly
15–20 permissions (today, per §2.1's live numbers, that's only `staff`); everything
above that — already four of the current five roles — should use a compact
per-category bitmask instead. Either way, this stays simpler, faster, and lighter than
every alternative considered.**

---

## 7. What this replaces, and how much simpler it actually is

This is a real simplification, not just a relabeling — two overlapping systems
collapse into one:

- **The entire legacy-name-to-current-name translation layer disappears.** It exists
  today only because the six roles are a fixed enum with two historical generations of
  naming baked into the database. Once a role is just a row of data an admin named
  themselves, there is no second naming generation to translate between — the whole
  subsystem, including its "fail closed on an unrecognized value" logic and its
  dedicated anti-hardcoding build check, has nothing left to guard.
- **The page-path-plus-hash-suffix trick disappears.** Today, a handful of
  sub-features ("export the log," "prune the log," "force-kick a session") are modeled
  as fake extra "pages" with a `#fragment` bolted onto a real page's path, purely so
  they can ride the same page-based access-check machinery. That's the direct cause of
  a real bug this project already had and fixed once (a deny on the *real* page didn't
  correctly block the fake fragment-page riding on it, because the two were never
  actually related to each other structurally). Under a flat permission-key model,
  "export the log" is just its own permission, checked directly — there's no
  parent/child relationship to get wrong, because there was never a real hierarchy
  there to begin with, just a workaround pretending there was one.
- **Two access-control systems become one.** Today, "what role are you" (RBAC) and
  "what pages can you specifically reach" (PLAC) are two separate mechanisms that
  happen to cooperate. Under this design, there's exactly one mechanism — a resolved
  set of permission keys — and a role is nothing more than a convenient, named,
  admin-editable way to assign a bunch of them at once. Anyone reasoning about "why can
  this person do this" only ever has one place to look, not two.

---

## 8. Service-by-service usage across the current stack

| Service | Role in this design | Change from today |
|---|---|---|
| **Cloudflare D1** | Source of truth for the five tables in §2; touched only at login and on the same periodic refresh cadence already in place today | Same usage shape as today — a different (marginally larger, still trivially cheap) join query, computed exactly as rarely as today's |
| **Cloudflare KV** | Caches the resolved permission set inside the same session record used today, with the same revocation-flag and reverse-index mechanics | **No change at all** — same keys, same write cadence, same free-tier cost model as the companion assessment document already worked out |
| **Cloudflare Workers** | Runs the same middleware shape, with the enforcement check simplified (§4) rather than made more expensive | Marginally *less* CPU per check (a set lookup replaces a path-prefix-matching loop) — not a measurable difference at this scale, but not a regression either |
| **Supabase** | Keeps its current job — the authenticated-identity whitelist — unchanged | No change; there's no strong reason to move the new role/permission tables here instead of D1, since keeping them in D1 avoids a cross-database join every time access needs recomputing |
| **Upstash** | Keeps its current job — rate-limiting the admin-provisioning endpoints — unchanged | **Deliberately not used as a second permission cache.** Its free tier (10,000 commands/day) is tighter than KV's already-tight write budget, and splitting the cache across two systems with two different consistency models would add real complexity for no benefit when KV already does this job well |
| **Sentry** | Captures failures in the permission-resolution query, exactly as it captures equivalent failures today | No change |
| **PostHog** *(optional addition)* | Could track which permission checks get denied most often, as a product-analytics signal to inform which role bundles actually need adjusting | New, but purely observational — not part of the enforcement path, and entirely optional |

No new external service is required to build this. Everything needed already exists
somewhere in the current stack, doing a job closely related to the job it would do
here.

---

## 9. Performance and scaling — what changes and what doesn't

This needs to be stated plainly rather than oversold: **this redesign does not make the
system faster, because the current system's hot path is already close to the
practical floor for this shape of check** (a cached, in-memory lookup with no database
round-trip). What it changes is what the system can *express* — dynamic roles, a
cleaner permission model, one system instead of two — not how quickly it evaluates a
request.

Concretely, reusing the figures already verified in the companion assessment document
(unchanged by this design, since neither the session envelope, the cache key shape, nor
the activity-tracking write frequency is affected by it):

| Metric | Value | Changed by this design? |
|---|---|---|
| Hot-path request latency | ~6–10ms | No — same cache-lookup-dominated cost structure |
| Database reads on a normal request | Zero | No |
| Cache reads per request | 2–3 | No |
| The binding free-tier constraint at every staff count modeled | Cache writes, dominated by routine activity tracking, **not** by permission checks | No — this design doesn't touch activity-tracking frequency at all |
| Free-tier staff-count ceiling (with the already-recommended activity-heartbeat throttle applied) | Comfortable up to roughly 50 continuously-active staff; the pragmatic point to move to the $5/month paid plan is around 100 | No change |
| Cost at 1,000+ staff | ~$5/month base, effectively $0 usage overage | No change |

The full derivation of every figure in that table — including the per-staff-count
tables at 10/20/50/100/1,000 and the ×5/×10 scaling recommendations — is in
[`PERMISSION-ARCHITECTURE-ASSESSMENT.md`](PERMISSION-ARCHITECTURE-ASSESSMENT.md) §5–§6
and is not repeated here, because none of it changes under this design. Restating
different numbers here would misrepresent the one honest finding of this section: this
is a *modeling* upgrade, not a *performance* upgrade.

### 9.1 A second, independent scaling axis — the permission catalog itself

Everything in §9 so far is about *staff count*. Permission *count* is a separate axis,
and the honest shape of it is front-loaded, not smooth — this project is roughly a
year into an active build-out phase, still shipping whole new service architectures,
not just refining existing ones.

**A concrete, verified data point, not a guess:** the Staff Managed Storage module
(secure R2 file drive, presigned uploads, vendor sharing, admin quota controls) was
built, tested, and deployed across five calendar days (2026-08-05 to 2026-08-09, per
this repository's own commit history). It alone added **11 permission rows** to the
live registry — 1 real page plus 10 `#fragment` sub-permissions (admin inspect, admin
manage, config defaults, config overrides, reconciliation policy, reconciliation
report, request create, request manage, share create, share unlimited). That's a 12%
jump on top of the entire 89-permission catalog, from one module, in under a week —
not an outlier to average away, but the actual operating rhythm of this project right
now.

A top-down "%-per-year" curve understates what an active-build year looks like when
growth arrives in module-sized bursts rather than a steady trickle. A bottom-up model,
built from what's actually been observed, fits the evidence better:

| Phase | What's driving it | Modeled growth |
|---|---|---|
| **Phase 1 — the current build-out year** | New service architectures shipping roughly every few weeks (storage was one; the pattern is expected to repeat), each landing somewhere between a small module (1–4 permissions, e.g. `arco` or `alerts` today) and a large one (8–11, e.g. `storage`, `emails`, `chatbot`, `control-plane`), plus incremental fragment permissions added to already-existing modules as they mature | Conservative: ~130 · Moderate: ~160 · **Aggressive: ~205** by year-end |
| **Phase 2 — years 2–4, after the build-out settles** | Fewer whole-new-modules; more fine-grained splitting of permissions *within* already-shipped modules as real usage reveals where one broad permission needs to become several narrower ones, plus continued client-driven customization under the white-label commercial model | Conservative: ~200 · Moderate: ~275 · **Aggressive: ~400** by +4 years |

The four-year end state isn't wildly different from a naive smooth projection — the
important correction is *where in time* the growth actually lands. Most of it is
arriving this year, while the team is still actively building, not spread evenly
across four. Anything that depends on permission-catalog size — the bitmask-compaction
trigger already crossed today (§2.1), the JWT design's cookie-size ceiling below, an
admin-UI permission matrix staying usable — needs to be treated as a near-term
concern, not a multi-year runway.

**This also reframes the timing of building the design in this document, not just
whether to build it.** Every new module shipped against the current hardcoded ladder
from here forward is one more thing that eventually has to be migrated later (§11).
The cheapest time to introduce a dynamic, code-anchored-permission-catalog model is
*during* an active build-out — new modules can be built directly against it — not
after another dozen modules have already shipped the old way.

None of the three D1/KV tables in §2 strain at any of these numbers — even several
hundred rows is nothing against a 5-million-row-per-day free-tier read budget. **The advantage of this
design under permission growth isn't about capacity — it's that it has no structural
ceiling at all, where the two alternatives compared in the companion assessment
document each have one that gets closer as the catalog grows:**

- **The current hardcoded ladder** has no capacity problem either, but its near-zero
  override count today (§2.1) is likely to climb faster than the catalog itself, not in
  step with it — more fine-grained permissions mean more real-world cases that don't
  cleanly fit a single, linear 5–6-tier ordering, and each mismatch becomes another
  hand-added exception patched on top of a hierarchy that was never designed to carry
  that weight.
- **The proposed browser-held-token design** has an actual, calculable ceiling: a
  realistic override entry, once encoded into the token, costs roughly 50 bytes. Twenty
  personal exceptions for one person is a comfortable ~1.4KB; sixty to eighty starts
  pressing the browser's ~4KB per-cookie limit. Only 1 override exists platform-wide
  today, so this isn't an immediate risk — but it's a hard ceiling neither server-held
  design has at all, and it gets closer precisely as permission granularity (and,
  plausibly, per-client customization in a white-label product) increases.

This doesn't change with a move to the Workers Paid plan — that decision addresses the
*staff-count* ceiling in §9 (specifically the activity-heartbeat cache-write budget),
which is orthogonal to permission-catalog size. Paid or free, the permission-count
question is decided by which design has to fight a rigid hierarchy or a payload-size
ceiling as the catalog grows, not by how many requests or cache writes the plan allows.

---

## 10. Current vs. new — a multi-metric comparison

| Metric | Current (hardcoded 6-tier RBAC + page-path PLAC) | This design (dynamic roles + flat permission keys) |
|---|---|---|
| Can an admin create a new role without a deploy? | No — the role ladder is a fixed enum in code | **Yes — the entire point** |
| Can a permission exist that no code actually checks? | Not today, but nothing structurally prevents it | **Structurally prevented** — the permission catalog is code-anchored by design |
| Number of overlapping access-control subsystems | Two (role hierarchy + page-path overrides), that must be reasoned about together | **One** — a single resolved permission set |
| Legacy/current naming translation layer | A real, currently-live subsystem with its own fail-closed rules and a dedicated build-time guard | **Does not exist** — nothing to translate once roles are pure data |
| Sub-feature permissions (export/prune/force-kick-style) | Modeled as fake pages with a `#fragment` hack; caused one real historical bug | **First-class permission keys** — no hack, no analogous bug class |
| Hot-path request latency | ~6–10ms | ~6–10ms — unchanged |
| Free-tier staff-count ceiling | Same as below | Same — this design doesn't move the ceiling |
| New admin UI required | None (already built) | A role editor + a permission-matrix screen — new, but the same general shape as UI this project has already built twice (the page registry manager, the user access-policy manager) |
| Migration risk | N/A (already live) | Low-to-moderate — see §11; the existing six roles seed the new table directly, nothing has to be invented |
| Audit/reasoning clarity | Good, but requires knowing two systems | **Better** — "why can this person do X" always has exactly one answer path |
| Extensibility to attribute-based scoping (region/department) later | Possible, not designed for | **Cleaner starting point** — an attribute check slots naturally onto a flat permission-key model without disturbing the role/bundle layer |
| Sustainability as the permission catalog grows (89 today, verified live; a plausible 150–450 within 2–4 years — see §9.1) | Infrastructure is fine; administrative burden (hand-added overrides patching around a rigid hierarchy) likely grows faster than the catalog itself | **No structural ceiling** — new permissions are just new catalog rows; the one real challenge is admin-UI usability, solved with categorization, not architecture |

---

## 11. A realistic migration path

Not a full plan — a sketch, since the question asked was "from scratch," and the
honest answer for a *live* system is that this isn't really starting from scratch:

1. Seed the new role table with the six roles that already exist today, marking the
   top two as the protected/system tier described in §3 — nothing about who-can-do-what
   changes on day one.
2. Generate the initial permission catalog directly from today's page registry plus
   its existing `#fragment` sub-features — each becomes one clean permission key
   instead of a page-path-plus-hash pair.
3. Populate the initial role-bundle table by replaying today's existing role-hierarchy
   logic once, in a migration script, not by hand — every role gets exactly the
   permissions it already effectively has today, computed, not guessed.
4. Convert today's per-user page overrides into per-user permission overrides
   one-for-one — same rows, same deny-wins rule, just keyed differently.
5. Only once all four steps are verified to produce the *same* effective access as
   today for every existing user does the admin-facing role editor actually get turned
   on — until then, the new tables exist and are correct, but nothing about the live
   system's behavior has changed yet.

---

## 12. Final recommendation

Build it this way. The mental model behind the original question was already right —
permissions belong to the code, roles and grants belong to data — and the concrete
design above delivers real dynamism and a genuine reduction in how many separate ideas
someone has to hold in their head to answer "why can this person do that," without
costing anything on the performance or free-tier side, because the part of today's
design that was already fast (compute once, cache, check by simple lookup) doesn't
need to change to get there. The only thing that has to stay deliberately, permanently
fixed is the small, protected top tier described in §3 — everything else can be made as
dynamic as the goal asks for.

---

## 13. Sources & verification log

| Date | What was checked | Method | Result |
|---|---|---|---|
| 2026-08-09 | Live re-read of the current role-hierarchy, page-access, and force-logout-on-role-change code to confirm the exact precedent reused in §5 | Direct reading of the relevant source files in this repository | Confirmed a directly analogous "find affected users, force-log-out only them" mechanism already exists live in code for a page-level role-tightening case |
| 2026-08-09 | Whether CASL, Casbin, or accesscontrol have any platform-native dependency that would rule them out on Cloudflare's edge runtime | External web research | No such dependency found for any of the three; the recommendation against using one is based on fit for this specific problem, not runtime incompatibility |
| 2026-08-09 (reused) | Free-tier ceilings, per-staff-count usage figures, and the ×5/×10 scaling breakpoints referenced in §9 | Carried forward from the companion assessment document, not re-derived, since nothing in this design changes the inputs to that model | See `PERMISSION-ARCHITECTURE-ASSESSMENT.md` §5–§6 for the full derivation |
| 2026-08-09 | Exact contents of the live production permission registry — row counts, active/inactive split, real-page vs. fragment split, per-role cumulative bundle sizes, category breakdown, existing override count | Direct, live SQL query against the production D1 database via the Cloudflare account's own D1 query access | Confirmed the "89 permissions" figure exactly; found four of five roles already past the bitmask-compaction trigger — basis for §2.1 and §9.1 |
| 2026-08-10 | Real-world build velocity for a single module (Staff Managed Storage), to ground the growth-phase model in §9.1 | Git log timeline of storage-related commits, cross-checked against the live D1 permission count for that module's paths | Confirmed: 11 permission rows shipped across 5 calendar days (2026-08-05 to 2026-08-09) — the model in §9.1 was revised from a smooth annual curve to a front-loaded, module-driven one on this basis |

**Sources:**
- [casl vs casbin vs accesscontrol 2026 — PkgPulse Guides](https://www.pkgpulse.com/guides/casl-vs-casbin-vs-accesscontrol-authorization-rbac-2026)
- [CASL.js documentation](https://casl.js.org/v4/en/guide/intro/)
- [Runtime APIs · Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/)

## Related

- [`PERMISSION-ARCHITECTURE-ASSESSMENT.md`](PERMISSION-ARCHITECTURE-ASSESSMENT.md) — the current system explained in full, the JWT-design fact-check, and the full per-staff-count scaling model this document's §9 reuses.
- [`RBAC-AT-SCALE.md`](RBAC-AT-SCALE.md) — the original PBAC/ABAC/bitmask industry-model comparison this document's §1 builds on.
- [`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) — the current page-access engine this design's §2/§4 generalizes from.

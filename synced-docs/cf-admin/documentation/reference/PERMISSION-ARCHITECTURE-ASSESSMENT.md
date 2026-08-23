---

title: "Permission Architecture Assessment — Current System vs. Proposed JWT Design, Benchmarked & Scaled"
status: draft
audience: [ai, technical, owner, non-technical]
last_verified: 2026-08-10
verified_against: [code, infra, research]
owner: harshil
related_code: [src/lib/auth/rbac.ts, src/lib/auth/plac.ts, src/lib/auth/session.ts, src/lib/auth/pipeline.ts, src/lib/auth/cloudflare-access.ts, src/lib/audit.ts]
related_docs: [../reference/RBAC-AT-SCALE.md, ../architecture/GLOBAL-CONFIG.md, ../architecture/plac-and-audit.md, ../architecture/ARCHITECTURE.md, ../security/compliance/ASVS-L2.md, ../security/compliance/SOC2-TSC-mapping.md]
tags: [rbac, plac, authorization, cfzt, kv, d1, scaling, benchmarks, assessment, jwt, cost]
---

# Permission Architecture Assessment — Current System vs. Proposed JWT Design

> **Status note (2026-08-23).** This is an assessment of alternatives. For what is
> actually built and measured today, see
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).


> **TL;DR (non-technical):** Someone (an AI, in an earlier discussion) proposed replacing
> today's login-and-permissions system with one based on browser-held signed tokens
> (JWTs) instead of the server-held sessions cf-admin uses today. This document verifies
> exactly how today's system works end to end, fact-checks the proposal line by line
> against real Cloudflare platform behavior and current (2026) industry practice, and
> works out — with real numbers — what each design costs and how far it scales, at 10,
> 20, 50, 100, and 1,000+ staff. **Bottom line: keep today's design and generalize it;
> the proposed redesign trades away the one guarantee a staff-access system needs most
> (that firing someone actually stops their access) for a speed gain that doesn't
> clearly exist once measured.** Nothing in this document changes any code — it's a
> decision-support reference, like its two companion documents linked at the bottom.

> **A note on sensitive values:** per this project's documentation policy, this
> document names variables, tables, and services by **role and purpose only**. No
> environment-variable values, API tokens, KV namespace IDs, D1 database IDs, or
> Cloudflare account IDs appear anywhere below — only what each one is *for*. Table
> schemas are described by column purpose, not reproduced as literal `CREATE TABLE`
> statements.

---

## Table of contents

1. [How the current system works](#1-how-the-current-system-works-verified-live-2026-08-09)
2. [The proposed JWT + role/delta design](#2-the-proposed-jwt--roledelta-design)
3. [Fact-check: claims vs. reality](#3-fact-check-claims-vs-reality)
4. [Multi-benchmark comparison](#4-multi-benchmark-comparison)
5. [Service usage modeling — per hour, per day, per staff count](#5-service-usage-modeling--per-hour-per-day-per-staff-count)
6. [Scaling recommendations — current, ×5, ×10, and beyond](#6-scaling-recommendations--current-5-10-and-beyond)
7. [Where each design stands against real standards](#7-where-each-design-stands-against-real-standards)
8. [What to adopt from the proposal](#8-what-to-adopt-from-the-proposal)
9. [Final recommendation](#9-final-recommendation)
10. [Sources & verification log](#10-sources--verification-log)

---

## 1. How the current system works (verified live, 2026-08-09)

Two separate planes cooperate: **identity** (proving who you are) and **authorization**
(deciding what you can do). Identity is proven once, at the Cloudflare network edge, by
Cloudflare Zero Trust Access. Authorization is two stacked layers computed once at login
and cached — a coarse role (RBAC) as the default, and a fine-grained per-page override
table (PLAC) that can grant or deny beyond that default.

### 1.1 Identity — the edge handshake

1. Cloudflare's Zero Trust layer authenticates the browser *before* the application
   ever sees the request, and injects two proof-of-identity headers into every request
   that reaches the Worker.
2. The Worker verifies the identity token using the browser's own cryptography
   primitives (no external library) — checking its signature against Cloudflare's
   published signing keys, its expiry, its issuer, and its intended audience. A bad or
   expired token is routed back through Cloudflare's own logout endpoint, which also
   clears the identity cookie itself.
3. The verified email is cross-checked against a **whitelist table** (a managed
   database, not the edge database) — a row must exist, be marked active, and carry a
   role. Not found or inactive → access denied, unconditionally.
4. A per-provider "subject ID" is written back to that whitelist row on first login
   only (guarded so it can never overwrite an existing value) — this exists purely so
   the system can later force-revoke that specific identity-provider session even if no
   application session currently exists for it.
5. A fresh application session is created and cached (§1.4).
6. Every login attempt — success or failure, and every distinct failure reason — is
   logged to a durable table and triggers a real-time email alert.

### 1.2 RBAC — the role hierarchy

Six roles, ordered by privilege, each a plain integer level (lower number = more
privileged): a top-tier **vendor/support** role (the platform provider's own access,
not a purchasable seat), **owner** (the customer's account holder), **admin** (second
in command), **manager** (day-to-day operations, no user/platform admin), **staff**
(does the work, own area only), and **viewer** (read-only, cannot mutate anything).

The underlying database still stores an older 5-tier naming scheme from before a
rename; a small, single-purpose translation layer converts between the two at every
read and write boundary, and is designed to **fail closed** — an unrecognized value is
never guessed at, it's treated as "no access" until a human resolves it. A single
switch (currently pointed at the old naming) controls this translation and is meant to
flip in one dedicated change once the underlying data is migrated to the new names —
never bundled with any other change.

A build-time test scans the entire codebase and fails the build if the role hierarchy
is ever hand-copied anywhere outside its one canonical file — a direct response to a
real historical incident where seven separate hand-copies of the ladder existed, two of
which were still wrong after a rename shipped.

### 1.3 PLAC — Page-Level Access Control

On top of the role baseline, individual users can be granted access to a page their
role wouldn't normally allow, or explicitly denied a page their role otherwise would.
This is computed with a single query joining a page registry (every page's default
required role) against a small per-user exceptions table, and resolves with a strict,
structurally-guaranteed precedence: **an explicit deny always wins**, an explicit grant
wins next, and the role default applies only if neither exception exists. Because the
exceptions table's key is (user, page) — one row per pair — a grant and a deny can
literally never coexist for the same person and page, so "deny wins" is a database
guarantee, not just a convention followed in code.

A small number of special "sub-feature" permissions (e.g., "can export this page's
data," "can permanently delete this page's records") are modeled as extra rows in the
same page registry rather than as a separate system — they resolve through the exact
same grant/deny/default logic as any real page.

The endpoint that lets an admin grant or revoke another user's page access enforces, in
order: the actor must themselves have access to the user-management page; the request
is rate-limited; the target's *current* role is always re-read fresh from the
authoritative database (never trusted from the request itself — this closes a
previously real vulnerability where a lower-privileged actor could claim a target had
a lower role than they actually did); an actor can never modify their own access;
certain top-tier accounts are untouchable except by the very top tier; an actor can
never grant a page they don't themselves have; and an actor can never grant access
above their own clearance level. Revoking access force-logs-out the target
immediately; granting or resetting access does not — the target's already-cached
permissions can take up to about an hour to reflect a newly granted page, a known and
accepted trade-off (see §1.4).

### 1.4 The cache layer — why this is fast

Once role and page-access are resolved, they're written into one cached "session"
record, keyed by an opaque, meaningless identifier the browser holds in a cookie.
Every subsequent request looks up that one record — no database round-trip — to know
who the user is and exactly what they can and cannot do. The database is only touched
again: (a) roughly every 30 minutes, to re-confirm the user's role and active status
haven't changed; (b) roughly every hour, to refresh the page-access computation in case
an admin changed something; and (c) whenever a role change is actually detected. On a
normal request in between, the database read count is genuinely zero.

A short-lived, per-process in-memory cache sits in front of even that lookup, so
repeated requests from the same person in quick succession don't pay even the cache
lookup's cost more than once every few seconds.

### 1.5 Instant-revocation guarantee — three independent layers

When an account needs to be cut off immediately — role change, deactivation, deletion,
a manual "kick this user" action, or an explicit access revocation — the system does
three things, not one:

1. **Every cached session for that person is deleted directly**, using a small reverse
   index that maps a person to their live sessions, so this doesn't require scanning
   the whole cache.
2. **A short-lived "this person is revoked" flag is written to the cache**, checked on
   every request and on every future login attempt — this closes the gap where a
   still-valid identity-provider cookie could otherwise let the system silently
   re-issue a fresh session moments after the old one was killed.
3. **A live call is made to Cloudflare's own identity layer**, telling it directly to
   invalidate that person's edge-level session — independent of the application's own
   cache entirely. This is the layer that actually matters if the person's browser
   still holds a valid identity cookie and isn't currently talking to the application
   at all.

This three-layer design — not just the cache flag — is what lets the system make a
real "this is now instant, not eventually-instant" claim. §3 explains why that
distinction matters for the proposed alternative.

### 1.6 Every mutation is logged, out of the request's critical path

Every meaningful change (role changes, access grants/revokes, deletions, exports,
setting changes) is written to a durable audit table, but that write happens *after*
the response is already sent to the browser — it never adds latency to what the user
experiences. A hard, code-enforced whitelist restricts this logging mechanism to
writing to exactly one destination table, and a prior "let the person being audited
silence their own entry" escape hatch was identified as a real risk and removed
entirely.

### 1.7 The current permission catalog, measured live

Everything above is described structurally. Here is what it actually looks like
today, pulled directly from the live production database rather than estimated:

| What was measured | Live result |
|---|---|
| Total page-registry rows (real pages + `#fragment` sub-permissions) | 89 — 78 active, 11 currently disabled |
| Split between real pages and `#fragment`-style sub-permissions | 44 real pages, 45 fragments |
| Cumulative permissions reachable by each role today (a higher role inherits everything a lower one has) | staff: 5 · admin *(canonical: manager)*: 36 · super_admin *(canonical: admin)*: 60 · owner: 75 · dev *(canonical: vendor_support)*: 78 |
| Per-user page-access overrides in use today | 1, for 1 person |
| Page categories in use | communication (22), tools (14), system (12), main (12), management (7), content (7), admin (4) |

Two things worth carrying into later sections: **almost exactly half of today's
permission surface is already the `#fragment` workaround** described in more detail
in the companion design document, and **four of the current five roles already carry
well over 30 permissions each** — a data point §6.5 below builds on directly when
projecting what happens as the catalog keeps growing.

---

## 2. The proposed JWT + role/delta design

Summarized faithfully: at login, compute the user's role and any personal permission
*exceptions* (not the full resolved permission set), sign that small payload into a
tamper-proof token, and hand it to the browser as a cookie — instead of an opaque
session ID. On every request, verify the token's signature (no database or cache read
needed just to know who the user is), look up that role's full default permission set
from a fast cache (falling back to the database on a cache miss), merge in the personal
exceptions from the token, and evaluate access. To handle admin changes and
revocation before the token naturally expires, keep a small "version number" per user
in the cache; if it doesn't match the number embedded in the token, refuse the request
and force the browser to re-authenticate and get a freshly signed token.

Three refinements were proposed alongside it: fall back to the durable database if the
fast cache is unavailable; keep the personal-exceptions payload compact using a
`+grant`/`-deny` shorthand so it stays well under the browser's per-cookie size limit;
and push cache updates the moment the underlying data changes, rather than waiting for
a cache entry to naturally expire.

---

## 3. Fact-check: claims vs. reality

Several things framed as advantages of the new design are already true of the current
one, or are stated more strongly than the underlying technology actually supports.

| Claim made | What's actually true |
|---|---|
| "Total DB reads: 0" on a normal request | **Already true of the current system**, verified from the live code — a normal request touches the database zero times; it's read only on the ~30-minute and ~1-hour refresh cycles described in §1.4. This isn't a gap the new design closes. |
| Sub-10-millisecond edge evaluation as a target | **Already measured and achieved today** — the project's own architecture documentation puts the current hot-path cost at roughly 6–10ms, cache lookups included. Not a novel target the new design is reaching for that today's design misses. |
| Revocation described as happening "the very next click," implicitly instant | **Not literally instant, and not more instant than today's own cache-based flag.** The fast cache layer both designs rely on for this check is *eventually consistent* — a write can take up to about 60 seconds to be visible everywhere globally (same-location reads see it immediately; a request landing somewhere else in the world may not, for up to that window). Both a version-number check and today's revocation flag share that exact ceiling. What today's design has that the proposal does not mention at all is the third, cache-independent layer in §1.5 — a direct call to the identity provider itself. |
| The compact `+grant`/`-deny` shorthand, motivated by staying under the browser cookie size limit | This constraint **only exists because the permission data is being handed to the browser at all.** A server-held design has no such ceiling — the cached record can hold an arbitrarily large amount of data with zero effect on what the browser carries. The shorthand is solving a problem the server-held design never has in the first place. |

None of this means the proposal is poorly reasoned — the underlying instinct (compute
once, cache aggressively, keep the source of truth in a real database) is exactly
right, and is exactly what the current design already does. The disagreement is
narrower and sharper than "cache vs. no cache" — it's specifically about *where the
computed permission data lives* (browser-held token vs. server-held cache record), and
that choice is where the trade-offs below actually live.

### 3.1 The trade-off that matters most for a staff system

A signed token is provably tamper-proof — nobody can forge its contents. But it is
*not* the same thing as revocable. A token is valid, by cryptographic design, until it
expires or a lookup catches a mismatch — and that lookup **is** the same kind of
server-side check the token was meant to avoid needing. It doesn't eliminate the
check; it renames it, and in the meantime the token still carries whatever permissions
it was issued with.

This is not a novel observation specific to this project — it's where current (2026)
industry guidance on this exact question converges independently:

> "For browser-facing layers, use server-side sessions with an opaque session ID in an
> HttpOnly, Secure, SameSite cookie backed by [a fast server-side store]. For
> service-to-service communication, use short-lived [signed tokens]."
> — [Stop Defaulting to JWTs: Choosing the Right Session Architecture in 2026](https://reptile.haus/journal/stop-defaulting-to-jwts-choosing-the-right-session-architecture-in-2026/)

That's exactly what today's design already is. **It already matches where the
industry landed on this exact question in 2026** — this isn't a place the project is
behind and needs to catch up; the proposal would be moving away from current best
practice for this specific use case (a staff/admin panel, not a machine-to-machine
API), not toward it.

---

## 4. Multi-benchmark comparison

| Benchmark | Current design (server-held cache) | Proposed design (browser-held signed token) |
|---|---|---|
| Cache reads per request (warm) | 2–3 (one session lookup, short-circuited by an in-process cache most of the time, plus two independent revocation-flag checks) | ~1–2 (one version check, required every request; the role's default permission set is looked up only until a given server process has it warm) — comparable order of magnitude, not a clear win either way |
| Cache writes per admin action | 1–2 (the exception record itself, plus a full force-logout only on revoke) | One version-bump per *individual* user revoked or edited — but **no described mechanism for a role-wide default change to reach an already-issued token**, other than the role's cached default naturally being re-read fresh each time |
| Database reads per request | Zero on the hot path either way; both designs agree on this | Zero on the hot path — same as current, by the same mechanism |
| Revocation guarantee | **Three independent layers**, including a direct, cache-independent call to the identity provider (§1.5) | **One layer** — a cache version flag, with the same ≤60-second worst case as today's own flag, and no identity-provider-level kill described |
| Free-tier cache-write budget | Already the tightest resource ceiling in the current design (§5) — dominated by routine activity tracking, not by permission checks | Adds a version-bump write on top of that same existing budget for every permission edit — makes the already-tightest ceiling tighter, not looser, especially under fast-changing role/permission catalogs |
| Size ceiling on the cached permission payload | None meaningful — server-side only | The browser's own per-cookie limit (a few kilobytes) — a real, self-imposed constraint the current design never has to think about |
| Hot-path latency | ~6–10ms, already measured | Not measurably faster — dominated by the same cache-lookup cost structure |
| New moving parts required | None — already built and running | Token signing/verification, a secret-rotation story for the signing key, an in-process cache layer with no defined expiry policy in the proposal as written, and a "push the cache update the moment something changes" mechanism |
| Rough code surface to build/maintain | None (already exists) | A meaningfully larger surface for a system whose entire current implementation lives in three focused files |
| Fit for "unlimited roles/groups/permissions" | Already has a fully worked-out, sourced blueprint for this (§6.4) that doesn't touch any of the above | Doesn't actually help this specific goal — the browser-held-token question and the "how do we model 100+ permissions" question are unrelated; solving the second doesn't require solving it via the first |

---

## 5. Service usage modeling — per hour, per day, per staff count

All figures below use Cloudflare's own published free-tier numbers, re-confirmed live
against `developers.cloudflare.com` on 2026-08-09 (not assumed from memory — limits do
change), plus this project's own already-measured, real (not modeled) daily usage for
its current ~10-person staff count, where available.

### 5.1 The platform ceilings being measured against

| Resource | Free tier, daily | Paid tier ($5/mo base), monthly included | Paid overage rate |
|---|---|---|---|
| Requests | 100,000 / day | 10,000,000 / month | $0.30 / additional million |
| Cache reads | 100,000 / day | 10,000,000 / month | $0.50 / million |
| **Cache writes** | **1,000 / day** | 1,000,000 / month | $5.00 / million |
| Database rows read | 5,000,000 / day | 25,000,000,000 / month | $0.001 / million |
| Database rows written | 100,000 / day | 50,000,000 / month | $1.00 / million |

The cache-write row is bolded because, at every staff count modeled below, **it is the
first ceiling reached** — by a wide margin. This holds true for both the current
design and the proposed one, because the dominant source of cache writes is routine
activity tracking (an "I'm still here" heartbeat, refreshed frequently while someone is
actively using the portal), which is a design decision independent of whether
permissions are delivered via a server-held cache or a browser-held token.

### 5.2 Per-active-staff-member cache-write cost, per day

Two figures matter here: the **worst case** (someone actively clicking around for a
full 8-hour shift, generating an activity update on every refresh interval) and the
**shipped-today figure**, both taken directly from this project's own code:

| Scenario | Writes / active staff / 8-hour day | Why |
|---|---|---|
| **As shipped today** (worst case, continuous use) | ≈113 | 1 login (2 writes) + an activity heartbeat roughly every 5 minutes (≈96 writes over 8 hours) + a role re-confirmation roughly every 30 minutes (≈16 writes) |
| **With one small, already-identified fix** (align the heartbeat to the same ~30-minute cadence as the role re-check, instead of every 5 minutes) | ≈17 | Same login + one combined write every ~30 minutes instead of up to seven separate writes in that window |
| **Actually observed in production today**, for the current ~10-person staff | ≈7.5 (≈75 total / 10 people, per this project's own architecture documentation) | Real staff don't click continuously for a full 8-hour shift — this is roughly 15× lower than the worst-case model, which is the expected and healthy gap between a stress-test ceiling and typical real usage |

**This is the single most important number in this whole document for planning
purposes**, and it is identical for both designs — the browser-held-token proposal
does not change it, because it doesn't touch how often "is this person still active" is
recorded.

### 5.3 Staff-count breakpoints — cache writes/day vs. the free-tier ceiling (1,000/day)

| Staff count | As-shipped worst case | Fits free tier? | With the heartbeat throttle | Fits free tier? |
|---|---|---|---|---|
| **10 (current)** | 1,130/day | Marginally over in the worst case *(real observed usage today is ~75/day — comfortably under)* | 170/day | Yes, 5.9× headroom |
| **20** | 2,260/day | No, 2.3× over in the worst case | 340/day | Yes, 2.9× headroom |
| **50 (current × 5)** | 5,650/day | No, 5.7× over | 850/day | Yes, but tight — 85% utilized |
| **100 (current × 10)** | 11,300/day | No, 11.3× over | 1,700/day | No, 1.7× over — this is the realistic point to move to the $5/mo paid plan |
| **1,000** | 113,000/day | No | ≈17,000/day (≈510,000/month) | N/A on free tier at this size regardless — but **comfortably inside the paid plan's 1,000,000/month included allowance, $0 overage** |

### 5.4 Requests and database writes at the same breakpoints

Using a deliberately generous planning assumption of ~300 requests per staff member per
working day (padded upward on purpose, not a best case):

| Staff count | Requests/day | % of free 100K/day cap | Database writes/day (generous estimate) | % of free 100K/day cap |
|---|---|---|---|---|
| 10 | 3,000 | 3% | 3,000 | 3% |
| 20 | 6,000 | 6% | 6,000 | 6% |
| 50 | 15,000 | 15% | 15,000 | 15% |
| 100 | 30,000 | 30% | 30,000 | 30% |
| 1,000 | 300,000 | 300% (needs paid) | 300,000 | 300% (needs paid) |

Database *reads* are not shown — at every count modeled here they stay in the low
thousands per day at most, nowhere near the 5-million/day free ceiling, and are never
the binding constraint.

**Reading these two tables together: at every staff count from 10 through 1,000, the
cache-write budget breaks down first, and by a wide margin, well before requests or
database writes become a concern.** This holds for both designs equally.

### 5.5 Does the proposed design change any of this?

Not meaningfully. Its version-bump writes only fire on an actual permission edit (a
comparatively rare, admin-driven event — similar in volume to today's page-access
exception writes), not per request and not per active staff member per day. The
dominant cost in §5.2–5.4 is activity tracking, which both designs need regardless of
how they deliver permissions. **The choice between a server-held cache and a
browser-held token is close to orthogonal to the actual free-tier bottleneck** — the
bottleneck is really about how often "this person is still here" gets written, a
decision that exists one layer above either design.

---

## 6. Scaling recommendations — current, ×5, ×10, and beyond

### 6.1 Current scale (~10 staff) — no action needed

Real, observed usage today is comfortably inside every free-tier ceiling, by a wide
margin, on every resource. Nothing needs to change at this scale.

### 6.2 Current × 5 (~50 staff) — implement the throttle before it's needed

Still $0 on requests and database usage. Cache writes become the first thing worth
watching — comfortably fine if the heartbeat throttle from §5.2 is already in place,
tight (85% of the free daily budget) if it isn't. **Recommendation: implement the
heartbeat-throttle fix proactively at or before this point** — it is a small,
low-risk, one-line-of-reasoning change (align two existing periodic cache writes into
one), not a new system, and it roughly triples the free tier's effective staff-count
ceiling for a trivial cost.

### 6.3 Current × 10 (~100 staff) — the real inflection point

Even with the throttle applied, 100 continuously-active staff sit right at or just
past the free tier's cache-write ceiling. This — not 1,000 staff, not a
re-architecture — is the realistic point where moving to the $5/month paid plan is the
pragmatic answer, rather than continuing to optimize around the free tier's daily
caps. Once on the paid plan, **every** resource modeled above has enormous headroom
(effectively $0 in overage charges) well past 1,000 staff — the paid plan's cache-write
allowance alone is roughly 1,000× the daily free-tier cap once converted to a monthly
figure.

### 6.4 Bigger scaling (1,000+ staff, "unlimited roles/groups/permissions")

At this scale, the constraint stops being infrastructure cost — it's confirmed
negligible at $5/month base plus effectively $0 usage overage — and becomes the
*permission model itself*: how many genuinely distinct roles exist, how access scopes
by region/department/store, and how joiner/mover/leaver churn gets managed without a
human remembering to click "deactivate."

This project already has a complete, independently-researched, sourced blueprint for
exactly this transition, generalizing today's design rather than replacing it:

| Move to... | When (trigger condition) |
|---|---|
| Compact bitmask-style permission representation | Any single role needs to express more than roughly 15–20 discrete yes/no permissions |
| Reusable policy bundles (the model AWS IAM uses) | The organization needs more than roughly 15–20 *distinct* roles |
| Attribute-based scoping (region/department/store as data, not as new roles) | The same role keeps being re-created only because of scope, not because the job itself differs |
| Automated identity provisioning (SCIM) | Headcount or turnover makes a manually-managed whitelist error-prone — roughly triple-digit headcount with regular churn |
| A narrow, purpose-built "instant kill switch" primitive | The ≤60-second cache-propagation window is demonstrated to be an actual, unacceptable risk in practice — not before |
| A dedicated relationship-graph authorization engine (the kind Google/large SaaS platforms use for deep resource-sharing graphs) | Access genuinely depends on multi-hop relationships ("shared with my team, who reports to...") that a straightforward database query can no longer answer cleanly — this is a real, separate infrastructure commitment, and is *not* triggered merely by having many roles |

Every tier up through the "instant kill switch" stays inside the same $0-to-$5/month
platform commitment already in place and reuses patterns already proven in this
codebase (the page-access override table, the compute-once-cache-everywhere pattern).
The full reasoning, cost modeling, and a real-world proof point for each model
(Discord's bitmask permissions, AWS IAM's policy model, Google's relationship-graph
model) is written out in full in the companion document
[`RBAC-AT-SCALE.md`](RBAC-AT-SCALE.md).

### 6.5 A second, independent axis: permission-catalog growth

Everything in §5–§6 so far scales by *staff count*. The permission catalog itself is a
separate axis, and its honest shape is front-loaded, not smooth — this project is
roughly a year into an active build-out phase, still shipping whole new service
architectures, not just refining existing ones.

**A concrete, verified data point:** the Staff Managed Storage module (secure R2 file
drive, presigned uploads, vendor sharing, admin quota controls) was built, tested, and
deployed across five calendar days (2026-08-05 to 2026-08-09, per this repository's
own commit history). It alone added **11 permission rows** to the live registry — a
12% jump on top of the entire 89-permission catalog (§1.7), from one module, in under
a week. That's the actual operating rhythm right now, not an outlier.

A top-down "%-per-year" curve understates what an active-build year looks like when
growth arrives in module-sized bursts. A bottom-up model fits the evidence better:

| Phase | What's driving it | Modeled growth |
|---|---|---|
| **Phase 1 — the current build-out year** | New service architectures shipping every few weeks (storage was one, expected to repeat), each landing between a small module (1–4 permissions) and a large one (8–11), plus incremental fragment permissions added to maturing modules | Conservative: ~130 · Moderate: ~160 · **Aggressive: ~205** by year-end |
| **Phase 2 — years 2–4, after the build-out settles** | Fewer whole-new-modules; more fine-grained splitting of permissions within already-shipped modules, plus continued client-driven customization under the white-label commercial model | Conservative: ~200 · Moderate: ~275 · **Aggressive: ~400** by +4 years |

The four-year end state is a similar range to a naive smooth projection — the
important correction is *where in time* the growth lands. Most of it is arriving this
year, not spread evenly across four, which means the structural-ceiling comparison
below is a near-term concern, not something with a multi-year runway to plan around.
This is also the strongest timing argument for building the companion dynamic-roles
design ([`DYNAMIC-ROLES-PBAC-DESIGN.md`](DYNAMIC-ROLES-PBAC-DESIGN.md)) *during* this
build-out rather than after it — every module shipped against the current hardcoded
ladder between now and then is one more thing to migrate later.

Neither design examined in this document strains technically at any of these numbers —
D1 and KV both handle a few hundred permission rows without noticing. The difference is
structural, not a matter of capacity:

- **Current design:** only 1 page-access override exists in the live system today
  (§1.7), which reads as healthy — but it's more likely a sign the catalog hasn't yet
  outgrown what a 5–6-tier linear hierarchy can express cleanly, not evidence the
  hierarchy will keep scaling. More permissions tend to create more real-world cases
  that don't fit a single ordering ("this specific combination, but not that one"),
  and each one becomes another hand-added override. That count has no particular
  reason to grow only as fast as the catalog itself.
- **Proposed JWT design:** has an actual, calculable ceiling here that the current
  design doesn't. A realistic encoded override entry costs roughly 50 bytes once
  base64-encoded into the token; 20 personal exceptions for one person is a
  comfortable ~1.4KB, but 60–80 starts pressing the browser's ~4KB per-cookie limit.
  Not an immediate concern at today's usage (1 override, platform-wide), but a
  structural ceiling that gets closer as permission granularity grows — one neither a
  server-held design nor the dynamic-roles design in the companion document has at
  all.

**This axis is independent of the Workers Paid-plan question in §6.3.** Paid removes
the *staff-count* ceiling (the activity-heartbeat cache-write budget); it does nothing
for either design's permission-count behavior, because neither was ever bound by
Cloudflare's usage limits on this axis — the current design is bound by its
hierarchy's expressiveness, and the proposed design is bound by a browser payload
limit that no Cloudflare plan changes.

The companion design document,
[`DYNAMIC-ROLES-PBAC-DESIGN.md`](DYNAMIC-ROLES-PBAC-DESIGN.md), works out a third
option — admin-editable role bundles built from a fixed, code-anchored permission
catalog — that has no structural ceiling on either count, and shows, using this same
live data, that the point where its recommended bitmask representation becomes worth
using has already been reached today, not in some future year.

---

## 7. Where each design stands against real standards

### 7.1 Current design — verified against this project's own tracked compliance controls

This project already tracks its posture against OWASP's Application Security
Verification Standard and SOC 2's Trust Services Criteria. Pulling the rows relevant
specifically to session management and access control (not re-deriving them — citing
what's already tracked, cross-checked against the live code reviewed for this
document):

**OWASP ASVS — Session Management:** fresh, high-entropy session identifiers on every
login; secure/http-only/strict cookie flags; enforced timeout (both a hard maximum
lifetime and a periodic re-confirmation); forced logout that includes the
identity-provider-level revocation described in §1.5 — all independently verified
against the live code as part of this document, not just the tracked-compliance doc's
own (slightly dated) citations.

**OWASP ASVS — Access Control:** a single, centralized enforcement point for every
request; every user attribute re-checked against its authoritative source rather than
trusted indefinitely; least-privilege role ordering; default-deny for anything not
explicitly mapped; access-control failures generate an audit event; state-changing
requests are defended against cross-site request forgery.

**SOC 2 — Logical & Physical Access Controls (the "CC6" family):** every relevant
sub-control — restricting logical access, registering/authorizing users before
credentials are issued, restricting access by role, discontinuing access, securing
transmission against external threats, controlling export/removal of information, and
guarding against unauthorized software changes — is currently marked met in this
project's own tracked matrix.

*(Minor honesty note: the tracked compliance document itself has some drift — it still
references the old 5-tier role names and one stale file/line citation — but the
underlying control coverage described above was independently re-verified against the
live code for this document, not just taken from that file's own citations.)*

**Industry authorization-model maturity:** the current design is a textbook, correctly
executed example of Role-Based Access Control with delta overrides — the same shape as
Discord's per-channel permission overwrites and structurally identical to how AWS IAM's
"explicit deny always wins" evaluation rule works. That's the right, proven tier for
its current scale, with a clearly signposted, already-designed upgrade path (§6.4)
rather than a gap that needs closing today.

### 7.2 Where the proposed design would stand, if adopted as written

Adopting the browser-held-token proposal would not improve this posture — on the one
control most likely to actually get scrutinized in a real audit or incident review, it
would move backward:

- **Forced logout / revocation:** today's design satisfies this through three
  independent layers, including the identity-provider-level kill (§1.5). The proposal
  as written relies on one layer — a cache version flag with the same eventual-
  consistency ceiling as today's own flag — with no described equivalent to the
  identity-provider call. Unless that third layer is explicitly retained alongside the
  new design (entirely possible, just not mentioned in the proposal as given), this
  specific control would move from a genuinely strong position to a materially weaker
  one.
- **Cookie-based vs. token-based session controls:** today's design cleanly satisfies
  the "cookie-based session" control family because the cookie is opaque and
  meaningless without the server-side cache behind it. A browser-held signed token
  shifts the relevant control family entirely (token algorithm restrictions, ensuring
  no sensitive data rides in the token, token-specific replay protections) — not a
  strictly harder bar, but a different one that would need to be built and verified
  from scratch, not inherited from what's already in place.

**Net assessment: adopting the proposal as literally described would not move this
project forward against any standard examined here, and specifically risks a
regression on the control an auditor or a real incident is most likely to test first.**

---

## 8. What to adopt from the proposal

Stripped of the browser-held-token delivery mechanism, three parts of the proposal are
genuinely correct and either already exist or are already independently recommended
elsewhere in this project's own research:

- **Compact grant/deny shorthand for exceptions.** Already effectively how the current
  page-access exception table works (it stores only the exception, never the full
  resolved permission set). If the permission catalog grows large enough to need
  further compaction, the bitmask approach in §6.4 is the same idea, proven at scale by
  Discord — keep it server-side.
- **Push cache updates the moment underlying data changes, instead of waiting for a
  timer.** Correct, and already the recommended shape in the companion document
  covering global settings caching — worth wiring up regardless of anything else
  discussed here.
- **Fall back to the durable database if the fast cache is unavailable.** Already
  implemented today — the page-access refresh path already falls back to the database
  and serves the last-known-good result rather than locking anyone out if that fallback
  itself fails.

One part has no current equivalent and is a legitimate future addition, kept
server-side: caching a role's *default* permission set in short-lived, per-process
memory, shared across everyone with that role on the same server process — not just
per individual session as today. This only pays off once the permission catalog is
large enough that recomputing it per person is measurably expensive, and it needs an
explicit expiry window (the proposal as written doesn't specify one) rather than being
held indefinitely.

---

## 9. Final recommendation

**Keep and generalize the current server-held cache design — for this project and for
any new project built the same way.** Not because it's what already exists, but
because it independently holds up against three things that don't care about sunk
cost: how Cloudflare's own caching layer actually behaves, the real free-tier numbers
re-verified live for this document, and where the broader industry landed on this exact
question in 2026. The browser-held-token design is the right tool for short-lived,
service-to-service credentials; for a system whose core job is making sure a
terminated or compromised staff account actually loses access, it trades away the one
property that matters most for a speed gain that doesn't clearly materialize once
measured honestly.

If "unlimited roles, groups, and permissions" is the real target, the path there is
already fully designed, sourced, and costed — §6.4 and its companion document — and it
doesn't touch the revocation guarantee at all.

---

## 10. Sources & verification log

| Date | What was checked | Method | Result |
|---|---|---|---|
| 2026-08-09 | Full live-code trace of identity bootstrap, role hierarchy, page-access engine, cache-key inventory, middleware enforcement order, and the three-layer revocation mechanism | Direct reading of the relevant source files in this repository | Basis for §1 |
| 2026-08-09 | Free-tier and paid-tier limits for requests, cache reads/writes, and database reads/writes | Live documentation lookup against Cloudflare's own published pricing/limits pages | Confirmed unchanged from this project's prior research; used in §5 |
| 2026-08-09 | Current (2026) industry guidance on browser-held tokens vs. server-held sessions for staff/admin systems specifically | External web research, multiple independent sources | Confirms §3.1's conclusion; today's design already matches recommended practice for this use case |
| 2026-08-09 | This project's own tracked OWASP ASVS and SOC 2 control-mapping documents, for the session-management and access-control sections specifically | Direct reading, cross-checked against the live-code trace above rather than trusted at face value | Basis for §7; one minor staleness note flagged rather than silently repeated |
| 2026-08-06 (prior session, reused here) | Cloudflare KV/D1/Durable Objects consistency behavior, pricing, and a full industry-model comparison (RBAC/PBAC/ABAC/bitmask/relationship-graph) | Live documentation fetches + external research, recorded in the companion document | Reused directly in §6.4; not re-derived, since it was already sourced and dated within days of this document |
| 2026-08-09 | Exact contents of the live production permission registry — row counts, active/inactive split, real-page vs. fragment split, per-role cumulative bundle sizes, category breakdown, existing override count | Direct, live SQL query against the production D1 database via the Cloudflare account's own D1 query access | Confirmed the "89 permissions" figure exactly; basis for §1.7 and §6.5 |
| 2026-08-10 | Real-world build velocity for a single module (Staff Managed Storage), to ground the growth-phase model in §6.5 | Git log timeline of storage-related commits, cross-checked against the live D1 permission count for that module's paths | Confirmed: 11 permission rows shipped across 5 calendar days (2026-08-05 to 2026-08-09) — the model in §6.5 was revised from a smooth annual curve to a front-loaded, module-driven one on this basis |

## Related

- [`RBAC-AT-SCALE.md`](RBAC-AT-SCALE.md) — the full industry-model comparison and scaling blueprint referenced throughout §6.4.
- [`../architecture/GLOBAL-CONFIG.md`](../architecture/GLOBAL-CONFIG.md) — the write-on-change caching pattern referenced in §8.
- [`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) — the current page-access engine this document summarizes in §1.3.
- [`../security/compliance/ASVS-L2.md`](../security/compliance/ASVS-L2.md) and [`../security/compliance/SOC2-TSC-mapping.md`](../security/compliance/SOC2-TSC-mapping.md) — the tracked standards mappings referenced in §7.

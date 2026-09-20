---

title: "Global Config Architecture — Dynamic System Settings via KV + D1"
status: draft
audience: [ai, technical, owner]
last_verified: 2026-08-06
verified_against: [code, research]
owner: harshil
related_code: [src/lib/dal/PortalSettingsRepository.ts, src/lib/dal/FeatureFlagRepository.ts, src/pages/api/settings/portal.ts, src/lib/auth/session.ts, src/lib/auth/pipeline.ts, src/lib/auth/plac.ts, src/lib/cms/]
related_docs: [KV-RESILIENCE.md, plac-and-audit.md, ../reference/RBAC-AT-SCALE.md, ../features/CF-ACCESS-SYNC.md]
tags: [kv, d1, cache, config, feature-flags, settings, architecture, research]
---

# Global Config Architecture — Dynamic System Settings via KV + D1

> **TL;DR (non-technical):** A proposal to make system-wide settings — session
> timing, default theme, maintenance/page-block notices, and similar low-write/
> high-read values — editable from the admin UI and effective almost immediately,
> without a code deploy. The good news: most of the database and admin-UI plumbing
> for this **already exists** (`admin_portal_settings`, `admin_feature_flags`, the
> Settings page). What's missing is the fast-read cache layer connecting that
> already-built settings store to the code paths that actually enforce those
> settings on every request — today, several of those settings can be changed in
> the UI and silently do nothing. **Nothing in this document is implemented.**

## Context / Scope

This document evaluates a proposal: introduce a KV-backed `GLOBAL_CONFIG`
(system-wide, not per-user) cache, backed by D1 as the durable source of truth,
covering settings like session-recheck interval, session max lifetime, default
theme, and per-page maintenance notices/blocks — and fact-checks a secondary idea
(delivering this config via a JWT refreshed at login) against what the feature
actually needs to do.

It does **not** cover per-user permission caching (see
[`../reference/RBAC-AT-SCALE.md`](../reference/RBAC-AT-SCALE.md) — a related but
distinct problem with a different consistency requirement) or the existing
CMS/ISR KV pipeline (see [`KV-RESILIENCE.md`](KV-RESILIENCE.md), which this
document deliberately mirrors the shape of).

---

## 1. What already exists — read this before designing anything new

Before proposing new infrastructure, the codebase was checked for existing
overlap. It has more than expected:

| Already exists | Where | Status |
|---|---|---|
| A generic, typed, D1-backed global settings table | `admin_portal_settings` (created by `migrations/0000_baseline.sql`; the `scope_type`/`scope_id` columns for global vs. per-user/per-role rows were added later, by `migrations/0037_widen_admin_portal_settings_scoped.sql` — *corrected 2026-09-19*) | **Built and in use** |
| A repository with get/set, category filtering, and a **JSON-typed value** column (`setting_type: 'json'`) | `src/lib/dal/PortalSettingsRepository.ts` | **Built and in use** |
| An authoritative allowlist of known setting keys | `KNOWN_SETTING_KEYS` in the same file — already includes `default_theme`, `session_max_lifetime`, `session_recheck_interval`, `maintenance_mode` | **Built** |
| A GET/POST API with RBAC + PLAC gating and audit logging | `src/pages/api/settings/portal.ts` (`admin`+ to write, PLAC-gated on `/dashboard/settings`) | **Built and in use** |
| An admin UI to edit these settings | `PortalSettingsPanel.tsx` | **Built and in use** |
| A separate boolean feature-flag table + repository + UI | `admin_feature_flags` / `FeatureFlagRepository.ts` / `FeatureToggles.tsx` | **Built, and a second, parallel mechanism to the one above (see §6)** |
| The exact "KV cache, D1 source of truth, TTL refresh" pattern this proposal describes, already running for a *different* dataset | `system:admin_pages_cache_v2` in `computeNavItems()` (`src/lib/auth/plac.ts`), and the `cms:*` / `isr:*` keys documented in [`KV-RESILIENCE.md`](KV-RESILIENCE.md) | **Built and proven in production** |
| The isolate-local in-memory cache trick (bypass KV entirely on a warm isolate) | `ISOLATE_CACHE` in `src/lib/auth/session.ts` (5-second TTL, per-session) | **Built and proven in production** |

**The concrete, currently-live gap this document is really about:** `session.ts`
reads session timing from `env.SESSION_REFRESH_INTERVAL_MS` /
`env.SESSION_MAX_LIFETIME_MS` — `wrangler.toml` `[vars]`, requiring a redeploy to
change. It does **not** read `admin_portal_settings.session_recheck_interval` or
`.session_max_lifetime` — the exact same concepts, already sitting in the D1 table
with an admin UI to edit them. Likewise, nothing in the codebase outside the
settings feature itself reads `maintenance_mode` — the checkbox exists
(`"Block all non-Dev access to the portal"`), and per a grep across `src/`, it is
never checked anywhere. **An admin can go into the Settings page today, change
"Session Max Lifetime" or toggle "Maintenance Mode," get a success toast and an
audit-log entry — and the running system is completely unaffected.** `default_theme`
is explicitly commented out of the UI as superseded by the per-user
`admin_user_settings.theme` column, so it's effectively dead code sitting in the
allowlist.

> **Still true on 2026-09-19, and still tracked nowhere else.** Re-checked: no code
> path outside the settings feature reads `maintenance_mode`, and
> `documentation/MAINTENANCE.md` — the one live backlog — has no entry for it. A
> switch labelled "Block all non-Dev access to the portal" that does nothing is a
> defect, not a design gap, and it is recorded only inside a `draft` proposal that
> may never be built. **It needs a MAINTENANCE item of its own, or the dead
> settings need hiding from the UI.** Flagged here because this document cannot
> edit that backlog.

This reframes the proposal correctly: **this is not "should we build a global
config system" — it's "the global config system already exists; the fast-read
cache layer connecting it to the enforcement code paths was never built."** That's
good news — it means most of the schema, validation, RBAC gating, and audit logging
work is already done and battle-tested; what's missing is narrower than it looked.

---

## 2. Fact-checking the proposal

### 2.1 KV cache + D1 source of truth — correct, and already proven in this exact codebase

This is precisely the shape of `computeNavItems()`'s `system:admin_pages_cache_v2`
key (`plac.ts`) and the `cms:*` keys documented in `KV-RESILIENCE.md`: compute from
D1, cache the result as one JSON blob in KV with a TTL, fall back to D1 on a miss or
error. Nothing about this needs to be invented — it needs to be applied to a new
dataset (global settings) using the pattern already proven for two other datasets
(the page registry, and CMS content).

**One refinement over "reload from D1 on every TTL":** relying on TTL expiry alone
as the *only* refresh trigger means a change an admin makes right now doesn't take
effect until the old cached value's TTL naturally runs out — which defeats the
point of a live "block this page" switch if the TTL is, say, an hour. The better
pattern is to **write the freshly-computed value to KV immediately when the
underlying D1 data changes** (in this case, from the
`POST /api/settings/portal` handler, right after the D1 update succeeds), and treat
the TTL purely as a defense-in-depth backstop for the rare case that write-through
itself fails or a request lands on a KV replica that hasn't caught up yet. TTL as
primary refresh mechanism = changes take up to the TTL to appear. TTL as backstop +
write-through on save = changes appear within KV's normal propagation window
(≤60 seconds globally, same figure documented in `RBAC-AT-SCALE.md` §3) almost all
the time, with the TTL only mattering when something already went wrong.

> *Corrected 2026-09-19.* This paragraph cited
> `computeAccessMap()`/`updateSessionAccessMap()` as an existing write-through
> precedent. **PLAC is not write-through for other users.** An administrator's
> change writes a random `authz-changed:{userId}` mark to KV
> (`src/lib/auth/authz-signal.ts`), and the *target* recomputes its own map on its
> next request; `updateSessionAccessMap` only patches the requester's own session
> record. The mark **is** the right precedent to cite here, and it is arguably a
> better fit for global config than write-through: one small write per change,
> fanned out lazily by the readers, rather than one recomputed blob per writer. See
> [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §11.

### 2.2 "Load it in a separate JWT, refresh on login" — this doesn't fit, for a sharper reason than last time

This is a different question than the earlier per-user-permissions JWT discussion,
and it fails for a different, more concrete reason. It isn't primarily a security
concern here (the data genuinely is low-sensitivity, as noted) — it's a **timing**
concern specific to what this feature is *for*.

Look at the actual example given: *"individual page is blocked, unblock it, or
write a notice on a specific page route."* The entire value of that feature is that
an admin's action should take effect **for people who are already logged in**, not
just for people who log in after the change. A JWT set at login time and only
refreshed at the next login is, by construction, the wrong delivery mechanism for
exactly that requirement — a page-block set at 2pm would not be visible to a user
who logged in at 9am until their session naturally expires and they re-authenticate,
which under the *current* 24-hour lifetime (or an 8-hour one, if that becomes
dynamic too) could be most of a working day. For a maintenance-notice / kill-switch
feature specifically, that's not a minor staleness trade-off, it's the feature not
working as described.

The same reasoning applies, with less force, to session timing itself: if "session
max lifetime" is baked into a JWT issued at login using the *old* value, changing it
from 24h to 8h wouldn't actually shorten already-issued sessions — the stale JWT
would keep enforcing the old number until its own natural expiry. The setting has to
be read fresh by the code that enforces it, not carried inside the thing it's
supposed to be governing.

**Recommendation: read `GLOBAL_CONFIG` fresh (from isolate cache → KV → D1, per §3)
on every request that needs it, the same way `decideAccess()` already reads the
PLAC map fresh from the session on every request. Do not deliver it via a token that
only refreshes at login.** This isn't a security objection — it would be exactly as
wrong even if it held zero sensitive data — it's that a login-scoped token cannot
express "this changed five minutes ago and should apply now," which is the one
property the whole feature exists to provide.

---

## 3. Recommended shape

Described as a shape, not code — consistent with keeping this a planning document.

1. **One JSON blob, one KV key** (e.g. `system:global_config`), following
   Cloudflare's own stated best practice ("many small keys → coalesce into one JSON
   object") and the existing `system:admin_pages_cache_v2` precedent. Not one KV key
   per setting — that multiplies KV operations for no benefit at this data size.

2. **D1 stays the source of truth, and it should be the settings tables that
   already exist** (`admin_portal_settings` + `admin_feature_flags` merged into one
   computed view), not a third, new table. See §6 for the coordination question this
   raises.

3. **Compute-on-write, not compute-on-a-timer:** `POST /api/settings/portal` (and
   the feature-flag toggle endpoint) already writes to D1 and already runs an audit
   log via `waitUntil`. Add one more step to that same handler: recompute the full
   `GLOBAL_CONFIG` blob and `kv.put()` it immediately, exactly mirroring
   `updateSessionAccessMap()`'s role in the PLAC flow. This is what makes changes
   feel close to instant rather than "instant, up to an hour."

4. **A TTL on the KV entry regardless** (mirroring `cms:*`'s 3600s), purely as a
   safety net — if the write-through step is ever skipped or fails, the system
   self-heals within the TTL window instead of staying wrong indefinitely.

5. **Add the isolate-local memory cache layer cf-admin already invented for
   sessions, applied here too — it's an even better fit.** `session.ts`'s
   `ISOLATE_CACHE` caches per-session data in the warm V8 isolate for 5 seconds,
   specifically to skip a KV round-trip on rapid same-user navigations. Global
   config is *more* cacheable than that: it's identical for every user, not just the
   same user, so a warm isolate can safely serve it from memory for meaningfully
   longer (a reasonable starting point: 30–60 seconds) before ever touching KV
   again. This is not a new idea for this codebase — it's the same trick, applied to
   data that's an even better fit for it, and it materially changes the cost picture
   (§5).

6. **Version the cached blob**, the same way `PageAccessMap` already carries
   `computedAt`/`role` for staleness detection. The codebase already had to fix a
   real bug of exactly this shape once — a session written before the
   `PageAccessMap` refactor stored the old flat shape, and new code had to learn to
   detect and discard it rather than misread it. That comment now lives in
   `src/lib/auth/stages/access-map.ts`, not in `pipeline.ts`, since the chunk-10
   decomposition *(corrected 2026-09-19)*. A global config blob will hit the same problem the
   first time its shape changes across a deploy: an old cached value from before the
   change, read by new code expecting the new shape. Carry a small `configVersion`
   number in the blob itself so new code can recognise an old shape and force a
   recompute, instead of silently reading `undefined` for a renamed/added field.

7. **A self-heal cron, mirroring `CF-ACCESS-SYNC.md`'s proven pattern for a
   different subsystem:** that feature already solved "what if the inline
   write-through silently fails" for CF Access Group sync, via a 5-minute cron plus
   a durable per-attempt log and a visible status indicator. Reusing that shape
   here (a low-frequency cron that recomputes `GLOBAL_CONFIG` from D1 and rewrites
   KV) closes the same class of gap — a failed or partially-applied write-through —
   without inventing new failure-handling machinery. *Corrected 2026-09-19: this
   described the reconcile as "unconditionally re-runs the sync regardless of
   whether the last attempt reported success". It is hash-or-age gated and skips
   the Cloudflare API entirely when nothing has changed
   (`src/lib/auth/cf-access-reconcile.ts`) — which is the better model to copy
   anyway, since an unconditional rewrite of a config blob would spend KV writes on
   every tick for nothing.*

---

## 4. What should actually be in it (and one correction)

**Correction on the example given:** "session recheck is 5min, change it to
30min" doesn't quite match what's in the code today. The **role re-check** interval
(`SESSION_REFRESH_INTERVAL_MS`) already defaults to **30 minutes**, not 5. The
5-minute figure is a *different*, currently-hardcoded timer — the `lastActiveAt`
"heartbeat" throttle in `src/lib/auth/pipeline.ts`
(`now - lastActive > 5 * 60 * 1000`), which isn't wired to a setting or an env var;
it's a literal in the code. That much is still true.

> ### ⚠ Premise refuted — 2026-09-19
>
> **The heartbeat is not a source of KV writes at all, and this section's
> cost argument for making it configurable does not hold.**
>
> This section claimed, following
> [`RBAC-AT-SCALE.md`](../reference/RBAC-AT-SCALE.md) §8.5/§8.6, that the 5-minute
> heartbeat is "the single tightest constraint on how many staff the true $0
> Workers-Free tier can support", being "the dominant source of KV writes per
> active user per day" — around 113 writes per active user per day.
>
> `touchLastActive()` in `src/lib/auth/pipeline.ts` moves `lastActiveAt` **in
> memory only**; it reaches KV with the next session write that happens for some
> other reason. The function's own comment says so: "an active user costs no extra
> KV writes per request." That changed in commit `ae569e0` on 2026-08-06 at 16:52 —
> fourteen hours *after* this document was written at 02:20 the same day — so the
> premise was refuted within a day of being recorded, and nobody noticed because
> the document was never re-verified.
>
> **What the recurring writes actually are:** the 30-minute role re-check and the
> hourly access-map refresh, each one `patchSession` call
> (`src/lib/auth/stages/refresh-role.ts`, `src/lib/auth/stages/access-map.ts`).
> That is roughly **26 writes per person per day**, not ~113 — the arithmetic is in
> [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §13.3, which owns it.
>
> **Consequence for this proposal:** making the heartbeat interval admin-adjustable
> buys nothing on cost. If a cost lever is wanted, the candidates are the re-check
> interval and the map-refresh TTL — both of which are real writes, and the first of
> which is already an env var. The heartbeat row in the table below is struck for
> the same reason. `RBAC-AT-SCALE.md` §8.5/§8.6 carries the same stale model and is
> outside this document's scope to fix.

The general principle this section was reaching for still stands: **values that are
genuinely operational knobs (timing, defaults, on/off switches, short notices)
belong here; anything that changes the shape of authorization decisions (roles,
permissions) belongs in the PLAC/RBAC system, which has its own separate cache.**

A reasonable first set, combining what already has a home in
`KNOWN_SETTING_KEYS` with what's genuinely new:

| Setting | Status today | Notes |
|---|---|---|
| `session_recheck_interval` | Known key, D1-stored, **not read by `session.ts`** | Wire it up; this document doesn't change the 30-minute default, just makes it editable |
| `session_max_lifetime` | Known key, D1-stored, **not read by `session.ts`** | Same |
| `maintenance_mode` | Known key, D1-stored, **not enforced anywhere** | Needs an actual middleware check added, not just a stored boolean |
| `default_theme` | Known key, but **dead** — superseded by per-user `admin_user_settings.theme` | Resolve the naming collision: this should mean "fallback used only when a user has no personal preference set," evaluated in that order — not a value that overrides an explicit per-user choice. Same "explicit override beats a global default" algebra as PLAC, Discord overwrites, and AWS IAM's deny-wins rule, once again |
| Per-route notices/blocks (new) | Not modeled yet | A natural extension of `maintenance_mode` from a single global boolean to a JSON list of `{ path, status: 'blocked' \| 'notice', message }` — the `setting_type: 'json'` column already supports exactly this shape |
| ~~`lastActiveAt` heartbeat interval (new)~~ | **Struck 2026-09-19.** Still a hardcoded literal, but it costs no KV write, so there is no cost case for making it a setting (see the refutation above) | — |
| `session_refresh_interval` / the PLAC map TTL | Real recurring KV writes: ~16 + ~8 per person per working day | The genuine cost levers, if one is wanted. `SESSION_REFRESH_INTERVAL_MS` is already an env var; the 1-hour map TTL is a literal in `src/lib/auth/stages/access-map.ts` |

---

## 5. Cost — with numbers, layered on top of the earlier session-cost model

Building on the worked 1000-staff estimate in `RBAC-AT-SCALE.md` §8.2 (~9M
requests/month, one KV session-read per request already accounted for there):

### 5.1 If `GLOBAL_CONFIG` is read via a plain KV `get()` on every request

- +9M KV reads/month (one per request), **on top of** the 9M/month already spent on
  the session read.
- Combined: **18M KV reads/month** against the Workers Paid plan's 10M/month
  included allowance → **8M reads over**, at $0.50/million = **+$4.00/month**.
- This is a real, if small, change to the earlier "$0 usage overage" conclusion in
  `RBAC-AT-SCALE.md` §8.2 — worth stating precisely rather than letting that
  now-superseded claim stand unqualified. At $20+/seat/month commercial pricing,
  $4/month is trivial, but it's the honest number, and it's avoidable (§5.2).

### 5.2 With the isolate-memory cache layer (§3 point 5)

- A request that hits a warm isolate within its in-memory cache window (30–60s
  suggested) costs **zero KV operations** for global config — it's an in-process
  memory read, not a network call.
- Cloudflare does not publish a guaranteed isolate reuse rate or lifetime, so an
  exact "X% of requests avoid KV" figure would be false precision — but directionally,
  a value that's identical for every user (unlike per-session data) is about as
  favourable a case for this optimization as exists, and it is the same mechanism
  already measured to work for per-session data in this codebase (`session.ts`'s own
  comment: "dropping latency from ~30ms to 0ms" on a cache hit).
- **Practical framing: this optimization is what keeps the whole system inside the
  "$5/month flat" story from `RBAC-AT-SCALE.md` §8.2, rather than incurring the
  ~$4/month KV overage from §5.1.** Given it costs nothing but a short in-memory TTL
  to add, and the codebase already has the pattern proven, there's no real reason to
  skip it.

### 5.3 Writes and D1

- Writes to `GLOBAL_CONFIG` only happen on an admin edit — realistically dozens to
  low hundreds per month even for an actively-managed system, nowhere near either
  the KV write allowance (1M/month included) or the D1 write allowance (50M/month
  included). Not a cost consideration at any staffing scale this document has
  modeled.
- D1 reads for the rare recompute (on write, or on a full KV miss) are single-digit
  or low-double-digit row reads per event — negligible against the 25-billion-row
  monthly allowance, exactly as established in `RBAC-AT-SCALE.md` §8.2.

---

## 6. Latency — the full path, with the "build/parse" step the question specifically asked about

| Step | Typical cost | Source |
|---|---|---|
| Isolate-memory cache hit (§3 point 5) | effectively 0ms — in-process memory read | Same mechanism as `session.ts`'s `ISOLATE_CACHE` |
| **Parsing/"building" the config object from the cached JSON** (the step the question specifically raised) | **On the order of microseconds, not milliseconds** — a JSON blob of a few dozen scalar settings is a trivial parse; comparable in cost to the "Page access check: ~0.1ms" line already in `ARCHITECTURE.md`'s own per-request CPU budget table for a similarly-sized structure | Order-of-magnitude estimate consistent with that table; not independently benchmarked this session |
| KV read, hot/cached key | ~1–10ms | `RBAC-AT-SCALE.md` §3, sourced from Cloudflare docs + third-party benchmarks |
| KV read, cold/cache-miss | ~30ms+, worse with distance | Same source |
| D1 fallback (full recompute from `admin_portal_settings` + `admin_feature_flags`) | Sub-millisecond execution once reached; tens to 100+ms round-trip if the Worker and D1's single primary location are geographically separated | `RBAC-AT-SCALE.md` §3, and the D1-location correction in that same section |

**The honest summary:** the "build/config itself" step the question raised is not
where any meaningful latency lives — it's a tiny in-memory parse. The cost that
actually matters is *how often* the request has to leave the isolate at all (KV) or
leave KV entirely (D1), which is exactly why §3's layered design (isolate cache →
KV → D1, with write-through keeping the top layer fresh) is the right shape: it
minimizes how often the request pays the larger of those two costs, on data that
changes rarely and is identical for every user — about the most favorable case for
aggressive caching that exists in this system.

---

## 7. Long-run challenges

Not reasons not to build this — things worth deciding on purpose now rather than
discovering by accident later:

1. **There are already four runtime-read config stores, not two** *(corrected
   2026-09-19)*, and `GLOBAL_CONFIG` would make five if built as its own table
   instead of a *read-side cache over what exists.* Besides
   `admin_portal_settings` (scalar/JSON rows) and `admin_feature_flags` (booleans),
   this document missed:
   - **`service_config`** — the control plane's Layer-A store
     (`src/lib/dal/ServiceConfigRepository.ts`).
   - **The `cron-control` JSON document**, a row *inside* `admin_portal_settings`
     read straight from D1 by the job runner on every tick
     (`src/lib/dal/CronControlRepository.ts`). That is a live precedent for a JSON
     global setting with **no KV layer at all**, and worth measuring against before
     adding one — ROADMAP chunk 14b is the config-store consolidation this overlaps.

   Recommendation unchanged: don't add another source of truth.
   `GLOBAL_CONFIG` should be a KV-cached **view**, computed
   by joining both existing tables, the same way `computeAccessMap()` is a view over
   `admin_pages` + `admin_page_overrides` rather than a new table duplicating both.
   If the two tables' distinct existence (typed settings vs. plain booleans) stops
   earning its keep, that's a separate, smaller cleanup — but the cache layer
   shouldn't be the thing that decides to fork a third copy of "where do global
   settings live."

2. **Cache-invalidation discipline has to be centralized, not left to each call
   site to remember.** Every code path that writes a global setting (today: the
   portal-settings POST handler and the feature-flag toggle handler; potentially
   more later) must trigger the same write-through-to-KV step. The way to make this
   safe long-term is the same DAL discipline already enforced elsewhere in this
   codebase (SEC-03: no raw `env.DB.prepare(...)` outside a repository) — route every
   write through one function that does the D1 write *and* the KV refresh together,
   so a future engineer adding a new setting can't forget the second half.

3. **Schema/shape drift across deploys is a real, specific hazard, not a
   hypothetical one — this codebase has already hit the equivalent bug once** (the
   `PageAccessMap` flat-shape issue documented inline in `pipeline.ts`). Carrying a
   `configVersion` field (§3 point 6) is cheap insurance against the same class of
   bug recurring here.

4. **Key/setting sprawl.** "Many things" was the phrase used to describe what could
   go into this — that's fine as a direction, but without the existing
   `KNOWN_SETTING_KEYS` allowlist discipline (already proven: the API rejects any
   key not on that list) being kept as the gate for *every* new setting, this can
   drift into an unstructured blob nobody can audit. Keep the allowlist as
   mandatory, and keep descriptions/categories (already present in the schema)
   populated for every key, the same governance principle
   [`RBAC-AT-SCALE.md`](../reference/RBAC-AT-SCALE.md) §5 point 9 recommends for the
   permission registry.

5. **Security boundary: this blob must stay non-sensitive by policy, not just by
   accident.** Because it's cached broadly, read on every request, and some values
   in it (default theme, page notices) plausibly need to reach client-side
   rendering, it needs an explicit, written rule: **no credential, internal URL, or
   per-user data ever goes into `GLOBAL_CONFIG`** — full stop, checked the same way
   `SEC-08`/`SEC-05`-style rules in `RULESAd.md` §9.0 are mechanically checked for
   other invariants, not left as an unwritten assumption.

6. **Cross-isolate disagreement during the cache window is expected, not a bug.**
   With an isolate-memory layer on top of a KV layer, two users hitting different
   edge colos within the same ~30–60 second window can transiently see slightly
   different values if a change just landed. This is the identical "eventually
   consistent, ≤60s" trade-off already accepted for KV throughout
   `RBAC-AT-SCALE.md` §3 — worth stating explicitly here too so it isn't mistaken
   for a defect the first time someone notices it.

---

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-08-06 | claude | Read `PortalSettingsRepository.ts`, `FeatureFlagRepository.ts`, `src/pages/api/settings/portal.ts`, `PortalSettingsPanel.tsx` in full; grepped `src/` for `maintenance_mode`, `session_recheck_interval`, `session_max_lifetime`, `default_theme`, and `PortalSettingsRepository` usage; cross-checked against `session.ts`/`pipeline.ts`'s actual timing source (`SESSION_REFRESH_INTERVAL_MS` env var) | **Confirmed**: `admin_portal_settings` + UI already exist for these exact settings, and are disconnected from the runtime code that would need to read them. `default_theme` confirmed dead (superseded, commented out of the UI). `maintenance_mode` confirmed unenforced anywhere. |
| 2026-08-06 | claude | Re-read `KV-RESILIENCE.md` and `plac.ts`'s `computeNavItems()`/`computeAccessMap()` for the existing KV+D1 cache precedent and TTL/fallback conventions | Confirmed the proposed pattern already exists twice in this codebase (page registry cache, CMS `cms:*`/`isr:*` keys) — this document generalizes an established pattern, not a new one |
| 2026-09-19 | claude | Re-checked the premises, not the arithmetic. Read `src/lib/auth/pipeline.ts` (`touchLastActive`), `stages/refresh-role.ts`, `stages/access-map.ts`, `authz-signal.ts`, `cf-access-reconcile.ts`, `dal/ServiceConfigRepository.ts`, `dal/CronControlRepository.ts`, `migrations/0000_baseline.sql` and `migrations/0037_widen_admin_portal_settings_scoped.sql`; re-grepped `src/` for `maintenance_mode` and `documentation/MAINTENANCE.md` for an entry | **§4's central cost premise is refuted** — the `lastActiveAt` heartbeat has cost no KV write since `ae569e0` (2026-08-06, 14 h after this doc was written). Also corrected: the PLAC "write-through" precedent (it is the `authz-changed` mark), the `0037` scope columns, the flat-shape comment's new home, the CF-Access reconcile's gating, and "two mechanisms" → four. Status stays `draft`: **nothing here is implemented**, which remains true. **Not re-derived:** §5 and §6's cost and latency figures, which come from `RBAC-AT-SCALE.md` and rest on the same stale write model |

## Related

- [`KV-RESILIENCE.md`](KV-RESILIENCE.md) — the existing KV+D1 fallback pattern this document mirrors.
- [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) — the `authz-changed` mark (§11) and the per-request KV accounting (§13), both of which this document's cost model depends on.
- [`plac-and-audit.md`](plac-and-audit.md) — the Ghost Audit engine.
- [`../reference/RBAC-AT-SCALE.md`](../reference/RBAC-AT-SCALE.md) — §3 (KV/D1 latency and consistency facts, reused here). **Its §8.5/§8.6 `lastActiveAt` heartbeat cost finding is stale** on the same `ae569e0` change; see the refutation in §4.
- [`../features/CF-ACCESS-SYNC.md`](../features/CF-ACCESS-SYNC.md) — the durable sync-log + cron self-heal + status-pill pattern proposed for reuse in §3 point 7.

---

title: "Service Control Plane"
status: active
audience: [ai, technical]
last_verified: 2026-09-14
verified_against: [code]
owner: harshil
related_code: [src/lib/control-plane/config-schema.ts, src/lib/control-plane/preflight.ts, src/lib/dal/ServiceConfigRepository.ts, src/pages/api/control-plane/config.ts, src/components/admin/control-plane/ConfigEditor.tsx]
related_docs: [CONTROL-PLANE-CONNECTORS.md, ../architecture/PERMISSIONS-SYSTEM.md, ../architecture/ARCHITECTURE.md, ../operations/OPERATIONS.md]
tags: [control-plane, config, sentry, posthog, cloudflare, supabase, observability]
---

# Service Control Plane

> **TL;DR (non-technical):** A single admin screen to watch and tune the platform's external services (error tracking, analytics, CDN, database advisories) live, without redeploying code.

> **Status:** Deployed, **partially wired**. The surface, Layer-A store and the
> Sentry/Cloudflare connectors work in production. Two Layer-B integrations
> (Supabase advisors, PostHog billing) return `unconfigured` live because their
> secrets are not on the Worker, and the **`sentry.cf_admin.*` keys are not read
> by anything** — see §4.5 and §5. *Corrected 2026-09-19; this said "Production
> Active" without qualification.*
> **Surface:** `/dashboard/control-plane` (cf-admin) — RBAC + PLAC gated
> **Scope:** Layer-A config is stored for both apps. Only **cf-astro** currently
> reads its keys at runtime; cf-admin's own keys are editable but inert.
> **Last Updated:** 2026-09-19

> **Audience note:** This document is an architecture-level overview for AI IDE agents and
> contributors. It intentionally omits all environment-specific values — resource IDs, account
> identifiers, provider org/project slugs, secret names, and database DDL live only in the private
> repo and infrastructure config, never here.

---

## 1. Purpose

The Service Control Plane is a single, access-controlled admin surface inside **cf-admin** that lets
authorized operators **observe and tune** the platform's external services **without a redeploy**.

It solves a concrete problem: runtime knobs such as Sentry sampling/trace rates were historically
**hardcoded in source** across both apps. The control plane converts them into runtime-resolved
values that can be changed live, validated, audited, and propagated to the public site.

It does three things:

1. **Observe** — accurate live metrics for every service in one place (reusing the same cached
   analytics aggregate the main dashboard already computes).
2. **Tune (Layer A)** — edit remote configuration (sampling rates, capture toggles, rate limits)
   stored in shared D1 and read by both apps.
3. **Operate (Layer B)** — apply changes directly through the providers' own management APIs
   (Sentry, PostHog, Cloudflare, Supabase) for high-privilege operators.

---

## 2. The Two-Layer Model

The control plane separates **our config** from **the providers' config**. This distinction drives
the entire access model, audit story, and failure behaviour.

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER A — REMOTE CONFIG (our values, our store)                       │
│  ──────────────────────────────────────────────────────────────────   │
│  Runtime-tunable parameters persisted in shared D1.                    │
│  cf-admin edits them. cf-astro reads its own; cf-admin does NOT read    │
│  its own — see §4.5.                                                   │
│  e.g. Sentry sample/trace rates, PostHog capture toggles, rate limits. │
│  Validated · audited · versioned · propagated to cf-astro.             │
├──────────────────────────────────────────────────────────────────────┤
│  LAYER B — PROVIDER CONTROL (their values, their API)                  │
│  ──────────────────────────────────────────────────────────────────   │
│  Reads and (for some) writes against each provider's management API.   │
│  e.g. Sentry spike protection / inbound filters, PostHog session       │
│  recording, Cloudflare cache purge, Supabase advisors.                 │
│  Fail-soft: a missing token degrades to a "configure" notice, never    │
│  an error page.                                                        │
└──────────────────────────────────────────────────────────────────────┘
            │                                            │
            ▼                                            ▼
   Shared D1 (source of truth)                Provider management APIs
   read by cf-admin + cf-astro                (server-to-server, tokens
   each cache locally per TTL                  held as Worker secrets)
```

**Why D1 (not a shared KV)** — KV namespaces are per-binding and isolated between the two apps, so
they cannot share one. The single shared substrate is D1. It is the source of truth; each app reads
it and caches locally (cf-astro via a 10 s in-isolate memory layer plus the Cache API — `cf-astro/src/lib/service-config.ts`). The repository exposes a monotonic version token (`getConfigVersion()`), but as of 2026-09-14 nothing calls it: cf-astro re-pulls the full key set per TTL. *Corrected 2026-09-14 — this said cf-admin caches in its session KV namespace and both apps poll the version token; only the metrics aggregate is KV-cached. Corrected again 2026-09-19 — it then said "cf-admin reads D1 directly on every request", which reads as though cf-admin consumes its own config. It does not consume it at all; see §4.5.*

---

## 3. Access Control (RBAC + PLAC)

Every entry point is gated by the platform's two-engine access model:

- **RBAC** — a 6-tier role hierarchy (`vendor_support > owner > admin > manager > staff > viewer`
  since 2026-07-27; the databases still store the old names, translated on read — *corrected
  2026-09-14, this line named the pre-rename ladder*; lower rank = higher
  privilege).
- **PLAC** — Page-Level Access Control: per-user grants and denies layered on the role baseline,
  keyed by page path and by `#fragment` sub-capability.

Both models are owned by
[PERMISSIONS-SYSTEM.md](../architecture/PERMISSIONS-SYSTEM.md); read the
resolution rules there rather than here.

> *Corrected 2026-09-19 — this section said PLAC is "resolved O(1) from a
> KV-cached access map. Deny always wins", and linked the role ladder to
> USER-MANAGEMENT.md rather than the owning document. Both halves were wrong in
> ways that matter for this page: **owner and vendor_support bypass PLAC
> entirely** (`src/lib/auth/decide-access.ts`), so a deny written against them
> never applies — you cannot use `#provider-write` to hold an owner back.
> Resolution is also not a single O(1) lookup: an exact key match first, then a
> longest-ancestor scan across the map's keys.*

The control plane uses **fragment sub-capabilities** on its page path so a user can be granted page
visibility without write power, or one kind of write without another:

| Capability (PLAC anchor)              | Grants                                         |
|---------------------------------------|------------------------------------------------|
| `/dashboard/control-plane`            | See the page, read all live metrics             |
| `…#edit-sampling`                     | Edit Layer-A config; reset to defaults          |
| `…#purge-config`                      | Force a cross-app config-cache flush            |
| `…#provider-write`                    | Apply Layer-B writes via provider APIs          |

The role floor is enforced **and** the PLAC capability is checked — both must pass. Reads are open to
anyone who can see the page (provider reads require Admin+); Layer-A writes require Admin+; Layer-B writes require Owner+.

Page-level denies also block the underlying API calls, but **enforcement is
central, not per-route**: under `API_DENY_MODE = "enforce"` the middleware maps
every `/api/*` path to a page through `API_PAGE_MAPPING` and denies anything
unmapped (`src/lib/auth/routes.ts`, `src/lib/auth/stages/decide.ts`). That is
what keeps the UI and the API from drifting apart — not each handler
remembering to call a helper. `GET /api/control-plane/cloudflare`, for
instance, never calls `placDenyResponse` and is still gated. Note also that the
middleware maps the provider routes to their **sub-pages**
(`/dashboard/control-plane/sentry`, and so on) while the handlers check the
parent page, so a deny written against a sub-page is caught by the middleware
alone. *Corrected 2026-09-19 — this said "each route opts in via the shared
deny helper", which invites a new route to be written without one on the
assumption that it is then simply unguarded.*

---

## 4. Layer A — Remote Config

### 4.1 Config model

A central schema is the **single source of truth** for every writable knob. Each entry declares:

| Field         | Meaning                                                             |
|---------------|--------------------------------------------------------------------|
| key           | Stable dotted identifier (`<service>.<app>.<group>.<name>`)         |
| value type    | `number` · `boolean` · `string` · `json`                           |
| service       | `sentry` · `posthog` · `ratelimit` · `cloudflare`                  |
| app scope     | `cf-astro` · `cf-admin` · `global`                                 |
| category      | `sampling` · `feature` · `limits` · `ops`                          |
| default       | Canonical serialized default (the fail-safe fallback)              |
| min / max     | Inclusive numeric bounds (numbers only)                            |
| read-only     | Surfaced for visibility but never writable (e.g. deploy-time knobs) |
| description    | Human-readable explanation shown in the UI                         |

Values are stored as text and **coerced** to their declared type on read. A `buildDefaults()` helper
produces an in-memory fallback map so the apps always have safe values even if the store is empty or
unreachable.

**Parity invariant** — every default must match (1) the seed migration and (2) the hardcoded baseline
in each app's source. This three-way agreement is what makes the "fail back to hardcoded defaults"
path safe. Drift is detected automatically (see §6).

### 4.2 The write path

A Layer-A edit is an **optimistic, validated, audited, propagated** operation:

```
UI edits a row ──▶ optimistic local update ──▶ PATCH config
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          ▼                        ▼                        ▼
                  validate (type/bounds,    optimistic concurrency    write + history
                  writable, known key)      (expected version)        (best-effort audit row)
                          │                        │                        │
                   400 on bad input         409 on conflict          200 + new version
                          │                        │                        │
                          ▼                        ▼                        ▼
                  UI rolls back +          UI auto-refetches +       UI confirms; cross-app
                  shows reason             "changed elsewhere"       cache flush scheduled
```

- **Validation** happens in the data-access layer, never by throwing: unknown or read-only keys and
  out-of-bounds/wrong-type values are rejected with a clear status and message.
- **Optimistic concurrency** — the client sends the value's expected version with the edit. If
  another operator changed it in the meantime, the write is refused (conflict) and the UI silently
  refetches the latest values instead of clobbering them.
- **Audit** — every change records before/after values, the actor, and an optional free-text reason
  into a history trail. The audit write is best-effort and never blocks the user-facing result.
- **Propagation** — after a successful write, cf-astro is asked to drop its config cache via the
  existing internal revalidation webhook (the same mechanism the CMS already uses), so the public
  site picks up the change within one TTL instead of waiting it out.

### 4.3 Reset and purge

- **Reset to defaults** — walks every writable spec and restores any value that has drifted from its
  canonical default, recording each change in the audit trail. It is a destructive bulk action, so
  the UI routes it through a typed confirmation dialog (not a browser `confirm`).
- **Purge config cache** — forces the cross-app cache flush immediately rather than waiting for the
  TTL, for when a change must take effect on the public site right now.

Both fail soft: if the public site is briefly unreachable, the local change still succeeds and the
result reports the flush outcome separately.

### 4.4 Route policy — per-route telemetry rules

Most Layer-A knobs are scalar (one rate or toggle). Two keys are **structured** JSON: `sentry.cf_astro.ignore_errors` (edited by `IgnoreErrorsEditor.tsx`) and the **route policy** described here (`sentry.cf_astro.route_policy`), a JSON **route policy**
that makes cf-astro's Sentry/PostHog sampling *per-route* and runtime-tunable, so adding a route or
retuning one is a config edit rather than a redeploy.

- **Shape** — `{ version, rules[] }`. Each rule has a unique `id`, an optional `label`, a list of
  `match` patterns (substring match; a trailing `*` makes it a prefix match — `cf-astro/src/lib/route-policy.ts`), and any subset of
  per-signal overrides: client `traces`, server `tracesServer`, `replaySession`, `replayError`, and a
  `posthog` block (`pageview`, `autocapture`, `recording`). Every rate is clamped to `[0,1]`.
- **Resolution (two-tier, fail-safe)** — cf-astro reads the existing scalar keys as the **baseline**
  for unmatched routes; the first matching rule (first-match-wins, in order) layers its specified
  fields on top. An empty or corrupt policy resolves entirely through the legacy buckets — i.e.
  today's exact behaviour. (Replay and PostHog capture are session/init-time, so their per-route
  resolution uses the entry route; client and server traces are truly per-transaction.)
- **Validation** — a schema `validate` hook runs on write (and client-side before the PATCH): shape,
  0–1 rate bounds, caps (≤50 rules, ≤20 patterns/rule, id ≤64 / label ≤120 / pattern ≤128 chars), and
  a duplicate-id guard. JSON is canonicalised on write so equivalent policies never read as drift.
- **Parity** — the seed migration's default is byte-identical to the schema's canonical default, which
  reproduces the pre-engine behaviour exactly, so applying it is behaviour-neutral.
- **Editing** — a dedicated structured editor (`RoutePolicyEditor`, not a raw JSON box): reorderable
  rule cards with match-pattern chips, per-signal rate inputs with inherit/override toggles, tri-state
  PostHog controls, and a per-rule "≈ N events/day at this rate" estimate. It batches a draft and
  commits through the same optimistic-concurrency write path as every other key.

### 4.5 What is stored but not yet consumed

*Added 2026-09-19.* Three Layer-A keys are scoped to `cf-admin` and are fully
editable in the UI, but **nothing in cf-admin reads them**:

| Key | Declared as | Reality |
|---|---|---|
| `sentry.cf_admin.traces` | Server + client `tracesSampleRate` | `src/workers/cf-entry.ts` and `sentry.client.config.ts` both hardcode `0.1` |
| `sentry.cf_admin.error_sample_rate` | Error sample rate via `beforeSend` | no reader |
| `sentry.cf_admin.enabled` | "Master kill-switch for Sentry in cf-admin" | no reader |

`grep -rn "sentry.cf_admin" src` returns only `config-schema.ts`. The practical
consequence is the one that matters during an incident: **turning the
kill-switch off, or dropping the sample rate, during a Sentry quota event
changes nothing**, while the UI reports the edit as applied and audits it. The
equivalent `sentry.cf_astro.*` keys *are* read, by
`cf-astro/src/lib/service-config.ts`.

`cloudflare.cf_admin.observability_enabled` is a separate case and is correctly
marked read-only in the schema: it is deploy-time config.

Until these are wired, treat the cf-admin Sentry rows as a declaration of
intent. Wiring them means reading the config in `cf-entry.ts` and at client
init with the hardcoded values as the fail-safe fallback — which is what the
"parity invariant" in §4.1 already assumes.

---

## 5. Layer B — Provider Control

Layer B talks to each provider's **own management API**, server-to-server, using scoped tokens held
as Worker secrets. Every call returns a **discriminated result** — success, error, or *unconfigured*
— so a missing token renders a friendly "configure this to enable control" notice rather than
breaking the page. Writes are gated behind the `#provider-write` capability and only render in the UI
for operators who hold it.

**Failure classification.** A failed provider call is not automatically a server error: `unconfigured`
and provider-4xx results map to **400**, genuine upstream 5xx and network failures to **502**. The
table that defines this — and the reasoning behind it — is owned by
[CONTROL-PLANE-CONNECTORS.md §2.1](./CONTROL-PLANE-CONNECTORS.md#21-failure-classification-why-a-502-is-not-the-default),
along with the per-connector reference. *Corrected 2026-09-19 — this paragraph
duplicated that section in full, so the two could drift.*

| Provider    | Reads (visibility)                                              | Writes (Owner+ only)                                  | Configured in production? |
|-------------|----------------------------------------------------------------|-------------------------------------------------------|---|
| **Sentry**  | Quota outcomes, top unresolved issues, inbound filters, keys   | Toggle inbound filters, set key rate limits, spike protection, issue resolve/ignore/unresolve | ✅ yes |
| **PostHog** | Project settings (recording opt-in, sample rate, autocapture) | Enable/disable session recording + set sample rate | ⚠️ partly — see below |
| **PostHog** | Billing usage | — | ❌ no — the org id is not a live secret |
| **Cloudflare** | Resource inventory (Workers, KV, D1, R2, queue detail, Zero Trust active users, zone security); metrics via the analytics aggregate | Cache purge — everything, by URL, or by cache-tag; zone security level | ✅ yes |
| **Supabase** | Security & performance advisors                               | — (read-only; schema changes stay migration-driven)   | ❌ no — the Management API PAT is not a live secret |

*Column added 2026-09-19.* Checked against `wrangler secret list` on the live
Worker (names only, never values): 25 secrets, and neither the Supabase
Management API PAT nor the PostHog org id is among them. Both cards therefore
render the `unconfigured` "configure this to enable control" notice in
production — correct fail-soft behaviour, but not the "Production Active" the
banner used to claim. The PostHog settings read and the session-recording write
work, but resolve their project by falling back to the first project the key can
list; see
[CONTROL-PLANE-CONNECTORS.md](./CONTROL-PLANE-CONNECTORS.md) §3.3.

Notes that matter for correctness:

- Some knobs are **deploy-time only** (e.g. Cloudflare Worker observability sampling is set in build
  config and requires a redeploy) and are surfaced **read-only** — the UI explains this rather than
  pretending it can change them at runtime.
- **Provider writes are audited, but not identically to Layer-A writes.** A
  Layer-A edit writes both an `admin_audit_log` row and a versioned
  `service_config_history` row; a Layer-B provider write records only the
  `admin_audit_log` row, because there is no local value to version. The
  "recent change history" panel on the overview therefore shows Layer-A edits
  only. *Corrected 2026-09-19 — this said provider writes are audited "the same
  way".*

---

## 6. Metrics, Health & Drift

- **Live metrics** reuse the existing cached analytics aggregate (the same numbers as the main
  dashboard), formatted into per-service stat cards. If a provider is unconfigured, the card area
  shows an explanatory note instead of an empty or broken widget.
- **Schema parity / drift** — a preflight check compares the live config store against the canonical
  schema and reports three things: keys **missing** from the store, **unknown** keys in the store not
  in the schema, and values that have **drifted** from their baseline default. This is surfaced in a
  "Health & Drift" panel on the overview.
- **Token presence** — the same panel reports which provider integrations are configured by checking
  for the **presence** of their tokens only. Token values are never read into the UI, logged, or
  exposed.

---

## 7. API Surface

All endpoints live under `/api/control-plane/` and enforce the guards below. Reads are open to anyone
who can see the page; writes require the role floor **and** the PLAC capability; mutations are
same-origin (CSRF-guarded) and audited.

| Endpoint                          | Method | Role floor | PLAC capability        | Purpose                              |
|-----------------------------------|--------|------------|------------------------|--------------------------------------|
| `/api/control-plane/config`       | GET    | Any auth   | page                   | Read all config + recent history     |
| `/api/control-plane/config`       | PATCH  | Admin+     | `#edit-sampling`       | Edit one config value                |
| `/api/control-plane/reset`        | POST   | Admin+     | `#edit-sampling`       | Restore drifted values to defaults   |
| `/api/control-plane/purge-cache`  | POST   | Admin+     | `#purge-config`        | Force cross-app config-cache flush    |
| `/api/control-plane/sentry`       | GET    | Admin+     | page                   | Sentry usage, issues, filters, keys  |
| `/api/control-plane/sentry`       | POST   | Owner+     | `#provider-write`      | Filters / key limits / spike protection / issue resolve-ignore-unresolve |
| `/api/control-plane/posthog`      | GET    | Admin+     | page                   | PostHog settings + billing           |
| `/api/control-plane/posthog`      | POST   | Owner+     | `#provider-write`      | Session recording config             |
| `/api/control-plane/cloudflare`   | GET    | Admin+     | page                   | Workers / KV / D1 / R2 / queue / ZT users / zone security inventory |
| `/api/control-plane/cloudflare`   | POST   | Owner+     | `#provider-write`      | Cache purge; zone security level     |
| `/api/control-plane/supabase`     | GET    | Admin+     | page                   | Security + performance advisors      |

*Re-verified against each handler on 2026-09-14.* The three provider GETs were listed as "Any auth"
but have always called `requireAuth(ctx, 'admin')`. `PATCH config` was the other way round: this
table and the handler's own header said "Admin+ and `#edit-sampling`", but the code checked only the
session and the page-level PLAC — fixed the same day to match `reset.ts`.

`GET config` attaches an ETag (`withETag`) so the editor can revalidate cheaply; the provider GETs
are served `Cache-Control: no-store` (`jsonFresh`) and the Cloudflare inventory plain `jsonOk`.
*Corrected 2026-09-14 — this said every read endpoint carried ETag / short max-age headers.* Every mutating endpoint writes an audit entry via the post-response, fire-and-forget audit
engine — zero added latency for the operator.

---

## 8. User Interface

The surface is one overview page plus per-service sub-pages, all sharing a consistent component
library (the Phase-6 redesign):

```
/dashboard/control-plane              Overview: live snapshot · config editor ·
                                      health & drift · recent change history
/dashboard/control-plane/sentry       Sentry metrics + Layer-B controls
/dashboard/control-plane/cloudflare    Cloudflare metrics + purge controls
/dashboard/control-plane/posthog       PostHog metrics + session-recording config
/dashboard/control-plane/supabase      Supabase metrics + advisors
```

**Shared, mobile-first components**

| Component         | Role                                                                       |
|-------------------|----------------------------------------------------------------------------|
| `ConfigEditor`    | Layer-A editor island: grouped rows, optimistic UI, rollback, conflict handling |
| `ConfigRow`       | One config item — toggle for booleans, slider + numeric input for rates, locked display for read-only |
| `RoutePolicyEditor` | Structured editor for the JSON route-policy key — reorderable rule cards, per-signal rate overrides, tri-state PostHog controls, per-rule traffic estimate |
| `ProviderControls`| Layer-B panel island: fetches a service's provider data and renders per-provider views |
| `StatCard` / `MetricGrid` | KPI card (accent bar, loading/empty states) + responsive 1→2→3→4 grid |
| `SectionCard`     | Consistent section container (title, accent, body)                          |
| `ServiceSubNav`   | Sticky segmented sub-nav (native `<select>` on mobile, tabs on desktop)      |
| `EmptyState`      | Consistent empty state (there is no `Skeleton` component; loading states are per-island) |
| `IgnoreErrorsEditor` | Structured editor for the `sentry.cf_astro.ignore_errors` JSON key |
| `Sparkline`, `ProviderTile.astro`, `SubPageShell.astro` | Trend glyph, provider summary tile, and the shared sub-page frame that carries the role / PLAC gating for the UI |

Cross-island feedback uses the shared toast channel (a Preact signal) rather than per-island feedback
state, and destructive actions use a typed confirmation dialog. Write controls only render for
operators who hold the relevant capability.

---

## 9. Design Principles

- **Fail-safe by default.** Every read path has a hardcoded fallback; every write path validates
  before persisting; the apps run correctly even if the config store is empty or a provider token is
  missing.
- **D1 is the one source of truth.** No second store to keep in sync — apps read D1 and cache
  locally, with an explicit cross-app flush for immediacy.
- **No throws across boundaries.** The data layer and provider clients return typed results; the UI
  degrades gracefully to an `unconfigured` notice or an empty state instead of erroring. *Corrected
  2026-09-19 — this said "notice, skeleton, or empty state"; there is no `Skeleton` component, as §8
  itself notes. Loading states are per-island.*
- **Everything sensitive is gated and audited.** Reads, role floors, PLAC capabilities, same-origin
  mutation guards, and a versioned change history apply uniformly to both layers.
- **Secrets never surface.** Provider tokens are Worker secrets used server-side only; the UI knows
  whether a token *exists*, never what it is.

---

## 10. Cross-References

- [CONTROL-PLANE-CONNECTORS.md](./CONTROL-PLANE-CONNECTORS.md) — Layer-B connector reference: provider management APIs, the shared result contract + failure classification, token scopes, config propagation, and how the connectors relate to MCP tooling
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — the "Lean Edge" stack, request lifecycle, DAL pattern
- [PERMISSIONS-SYSTEM.md](../architecture/PERMISSIONS-SYSTEM.md) — **the owner of the permission model**: the role ladder, PLAC resolution and the owner/vendor bypass
- [USER-MANAGEMENT.md](./USER-MANAGEMENT.md) — user lifecycle
- [plac-and-audit.md](../architecture/plac-and-audit.md) — the Ghost Audit Engine
- [SECURITY.md](../security/SECURITY.md) — CSRF, headers, session model, security posture
- [CMS.md](./CMS.md) — the cross-app revalidation webhook the config flush reuses
- [OPERATIONS.md](../operations/OPERATIONS.md) — deploy commands, provider integrations, free-tier limits

## 11. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | `grep -rn "sentry.cf_admin\|error_sample_rate" src` → only `config-schema.ts`; the hardcoded `tracesSampleRate: 0.1` in `src/workers/cf-entry.ts` and `sentry.client.config.ts`; `src/lib/auth/decide-access.ts` (owner / vendor_support bypass, exact-then-ancestor resolution); `src/lib/auth/routes.ts` + `stages/decide.ts` (central API→page mapping, `API_DENY_MODE`); `src/pages/api/control-plane/cloudflare.ts` GET (no deny helper); the audit targets in `sentry.ts` / `cloudflare.ts` / `posthog.ts`; `src/lib/control-plane/preflight.ts`; live `wrangler secret list` (25 names — no `SUPABASE_ACCESS_TOKEN`, no `POSTHOG_ORG_ID`) | Whether the unconfigured cards are *intended* to stay unconfigured; Cloudflare Observability behaviour; provider API behaviour |
| 2026-09-14 | Every route under `src/pages/api/control-plane/` (role floor, PLAC fragment, response helper); the six-tier RBAC ladder in `src/lib/auth/rbac.ts`; the three PLAC anchors in routes and UI; the config schema (`config-schema.ts`: value types, categories, scopes, services, caps, route-policy validation); optimistic concurrency + history + audit + best-effort flush in `config.ts` / `ServiceConfigRepository.ts`; cf-astro's `route-policy.ts` matching and `service-config.ts` caching; every component under `src/components/admin/control-plane/`; the cross-reference targets. Ten corrections above, one of which was a code defect (PATCH config lacked its role floor and fragment; fixed). | Live `admin_pages` rows (the seed is in `database/legacy_migrations/0030_seed_control_plane_pages.sql`; the baseline migration carries no data); Cloudflare Observability behaviour; the pre-redesign "hardcoded in source" history |

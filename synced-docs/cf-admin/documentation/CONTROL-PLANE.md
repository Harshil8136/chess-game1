# Service Control Plane

> **Status:** Production Active
> **Surface:** `/dashboard/control-plane` (cf-admin) — RBAC + PLAC gated
> **Scope:** Manages runtime configuration and provider settings for **both** cf-admin and cf-astro
> **Last Updated:** 2026-06-05

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
│  Both apps read them; cf-admin edits them.                             │
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
it and caches locally (cf-astro via its edge cache + in-isolate memory; cf-admin via its session KV
namespace / in-isolate memory). A monotonic version token lets each app do one cheap indexed read
per TTL to decide whether to re-pull.

---

## 3. Access Control (RBAC + PLAC)

Every entry point is gated by the platform's two-engine access model:

- **RBAC** — a 5-tier role hierarchy (DEV → Owner → SuperAdmin → Admin → Staff; lower rank = higher
  privilege). See [USER-MANAGEMENT.md](./USER-MANAGEMENT.md).
- **PLAC** — Page-Level Access Control: per-user grants/denies layered on top of the role baseline,
  resolved O(1) from a KV-cached access map. Deny always wins. See
  [plac-and-audit.md](./plac-and-audit.md).

The control plane uses **fragment sub-capabilities** on its page path so a user can be granted page
visibility without write power, or one kind of write without another:

| Capability (PLAC anchor)              | Grants                                         |
|---------------------------------------|------------------------------------------------|
| `/dashboard/control-plane`            | See the page, read all live metrics             |
| `…#edit-sampling`                     | Edit Layer-A config; reset to defaults          |
| `…#purge-config`                      | Force a cross-app config-cache flush            |
| `…#provider-write`                    | Apply Layer-B writes via provider APIs          |

The role floor is enforced **and** the PLAC capability is checked — both must pass. Reads are open to
anyone who can see the page; Layer-A writes require Admin+; Layer-B writes require Owner+. Page-level
denies also block the underlying API calls (each route opts in via the shared deny helper), so the UI
and the API cannot drift apart.

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

Most Layer-A knobs are scalar (one rate or toggle). One key is **structured**: a JSON **route policy**
that makes cf-astro's Sentry/PostHog sampling *per-route* and runtime-tunable, so adding a route or
retuning one is a config edit rather than a redeploy.

- **Shape** — `{ version, rules[] }`. Each rule has a unique `id`, an optional `label`, a list of
  `match` patterns (substring match; a trailing `*`/`/` acts as a prefix), and any subset of
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

---

## 5. Layer B — Provider Control

Layer B talks to each provider's **own management API**, server-to-server, using scoped tokens held
as Worker secrets. Every call returns a **discriminated result** — success, error, or *unconfigured*
— so a missing token renders a friendly "configure this to enable control" notice rather than
breaking the page. Writes are gated behind the `#provider-write` capability and only render in the UI
for operators who hold it.

**Failure classification.** A failed provider call is not automatically a server error. The shared
result carries the HTTP status the endpoint should return: an *unconfigured* token or a provider
**4xx** (typically a 401/403 token-scope problem) is **our** misconfiguration and maps to **400**
with an actionable message (e.g. "check API token permissions"), logged at `warn`; only a genuine
upstream **5xx** or a network/timeout failure maps to **502**, logged at `error`. This keeps expected
misconfigurations from being reported to Cloudflare Workers Observability as server errors. See
[CONTROL-PLANE-CONNECTORS.md](./CONTROL-PLANE-CONNECTORS.md) for the per-connector reference.

| Provider    | Reads (visibility)                                              | Writes (Owner+ only)                                  |
|-------------|----------------------------------------------------------------|-------------------------------------------------------|
| **Sentry**  | Quota outcomes, top unresolved issues, inbound filters, keys   | Toggle inbound filters, set key rate limits, spike protection |
| **PostHog** | Project settings (recording opt-in, sample rate, autocapture), billing usage | Enable/disable session recording + set sample rate |
| **Cloudflare** | (metrics shown via the analytics aggregate)                 | Cache purge — everything, by URL, or by cache-tag      |
| **Supabase** | Security & performance advisors                               | — (read-only; schema changes stay migration-driven)   |

Notes that matter for correctness:

- Some knobs are **deploy-time only** (e.g. Cloudflare Worker observability sampling is set in build
  config and requires a redeploy) and are surfaced **read-only** — the UI explains this rather than
  pretending it can change them at runtime.
- Provider writes are audited the same way Layer-A writes are.

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
| `/api/control-plane/sentry`       | GET    | Any auth   | page                   | Sentry usage, issues, filters, keys  |
| `/api/control-plane/sentry`       | POST   | Owner+     | `#provider-write`      | Filters / key limits / spike protection |
| `/api/control-plane/posthog`      | GET    | Any auth   | page                   | PostHog settings + billing           |
| `/api/control-plane/posthog`      | POST   | Owner+     | `#provider-write`      | Session recording config             |
| `/api/control-plane/cloudflare`   | POST   | Owner+     | `#provider-write`      | Cache purge                          |
| `/api/control-plane/supabase`     | GET    | Any auth   | page                   | Security + performance advisors      |

Read endpoints attach cache-validation headers (ETag / short max-age) so the UI can revalidate
cheaply. Every mutating endpoint writes an audit entry via the post-response, fire-and-forget audit
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
| `EmptyState` / `Skeleton` | Consistent empty / loading states                                  |

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
  degrades gracefully (notice, skeleton, or empty state) instead of erroring.
- **Everything sensitive is gated and audited.** Reads, role floors, PLAC capabilities, same-origin
  mutation guards, and an immutable change history apply uniformly to both layers.
- **Secrets never surface.** Provider tokens are Worker secrets used server-side only; the UI knows
  whether a token *exists*, never what it is.

---

## 10. Cross-References

- [CONTROL-PLANE-CONNECTORS.md](./CONTROL-PLANE-CONNECTORS.md) — Layer-B connector reference: provider management APIs, the shared result contract + failure classification, token scopes, config propagation, and how the connectors relate to MCP tooling
- [ARCHITECTURE.md](./ARCHITECTURE.md) — the "Lean Edge" stack, request lifecycle, DAL pattern
- [USER-MANAGEMENT.md](./USER-MANAGEMENT.md) — RBAC role hierarchy and user lifecycle
- [plac-and-audit.md](./plac-and-audit.md) — PLAC resolution algorithm and the Ghost Audit Engine
- [SECURITY.md](./SECURITY.md) — CSRF, headers, session model, security posture
- [CMS.md](./CMS.md) — the cross-app revalidation webhook the config flush reuses
- [OPERATIONS.md](./OPERATIONS.md) — deploy commands, provider integrations, free-tier limits

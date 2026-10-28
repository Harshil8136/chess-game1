---

title: "Service Control Plane"
status: active
audience: [ai, technical]
last_verified: 2026-10-28
verified_against: [code]
owner: harshil
related_code: [src/lib/control-plane/config-schema.ts, src/lib/control-plane/settings-rows.ts, src/lib/control-plane/settings-routes.ts, src/lib/dal/ServiceConfigRepository.ts, src/components/admin/control-plane/SettingRows.tsx, src/pages/dashboard/control-plane/index.astro]
related_docs: [CONTROL-PLANE-CONNECTORS.md, SENTRY.md, POSTHOG.md, SETTINGS-AND-CONFIGURATION.md, ../architecture/PERMISSIONS-SYSTEM.md, ../architecture/ARCHITECTURE.md, ../operations/OPERATIONS.md]
tags: [control-plane, config, sentry, posthog, cloudflare, supabase, observability]
---

# Service Control Plane

> **TL;DR (non-technical):** Control Plane ("Cloud Services" in the sidebar) was one admin screen to watch and tune the platform's outside services. It was retired on 2026-10-28: its tools now sit on the pages that own them, and its old addresses lead there. What it left behind still works and is described here: the stored settings the website reads (Layer A) and the portal's connections to each provider (Layer B).

> **Retired (2026-10-28).** Harshil asked to "completely scrap" Control Plane and put Sentry's
> systems in its place, each tool going to the page that owns it. The page and its API routes
> were removed the same day; its five addresses forward:
>
> | Old address | Leads to | What took over |
> |---|---|---|
> | `/dashboard/control-plane` | `/dashboard/sentry` | the [Sentry page](SENTRY.md), in the same sidebar group |
> | `/dashboard/control-plane/sentry` | `/dashboard/sentry` | the Sentry page's Overview and Issues, and its Settings part ([SENTRY.md](SENTRY.md) §6): Sentry's settings and controls |
> | `/dashboard/control-plane/posthog` | `/dashboard/posthog/settings` | the [PostHog page](POSTHOG.md)'s Settings part (§3): the website's PostHog settings and PostHog's own recording switch |
> | `/dashboard/control-plane/cloudflare` | `/dashboard/configuration#cloudflare` | the [Configuration page](SETTINGS-AND-CONFIGURATION.md): the website's request limits, emptying the website's cache, the site's security level |
> | `/dashboard/control-plane/supabase` | `/dashboard/health` | dropped on Harshil's choice; System health has the Supabase security advice check (not set up until its token is, MAINTENANCE (private) SH-11) |
>
> The overview's six figures were dropped too: the Overview, Analytics and System health show
> them. Its `admin_pages` rows stay until the next push switches them off, after the code that
> stopped using them is live (MAINTENANCE (private) SE-3): a row switched off while
> the old page still ran would have let its address fall back to the Overview's access.

> **Status:** Layer A (the stored settings) and the Sentry and Cloudflare connectors are live;
> the Supabase one waits on its token (MAINTENANCE (private) SH-11). The **`sentry.cf_admin.*` keys are still read by nothing** (§4.5).
> **Edited from:** the Sentry page's Settings part (Sentry rows), the PostHog page's Settings part
> (PostHog rows) and the Configuration page (the request limits), since 2026-10-28.
> **Scope:** Layer-A config is stored for both apps. Only **cf-astro** reads its keys at runtime;
> cf-admin's own keys are shown, not offered (§4.5).

> **Audience note:** This document is an architecture-level overview for AI IDE agents and
> contributors. It intentionally omits all environment-specific values — resource IDs, account
> identifiers, provider org/project slugs, secret names, and database DDL live only in the private
> repo and infrastructure config, never here.

---

## 1. Purpose

The Service Control Plane was a single, access-controlled admin surface inside **cf-admin** that let
authorized operators **observe and tune** the platform's external services **without a redeploy**.
Since 2026-10-28 the surface is gone and the three jobs below are done on the pages that own each
service (the table at the top); the two layers it introduced remain.

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

Every entry point is gated by the platform's two-engine access model: **RBAC**, the role ladder,
and **PLAC**, per-user grants and denies keyed by page path and by `#fragment` action switch. Both
are owned by [PERMISSIONS-SYSTEM.md](../architecture/PERMISSIONS-SYSTEM.md); read the resolution
rules there. **Owner and vendor_support pass every switch** (`src/lib/auth/decide-access.ts`), so
a deny written against them never applies.

Since 2026-10-28 each page that edits these settings checks its own keys, each exactly with
`placRequireGrant` (fail-closed):

| Settings | Who may see them | Who may change them |
|---|---|---|
| The website's Sentry rows, and Sentry's own settings | `/dashboard/sentry/settings` (Admin) | `/dashboard/sentry#sampling` (Admin) for the rows; `/dashboard/sentry#provider-write` (Owner) in Sentry |
| The website's PostHog rows, and PostHog's own recording switch | `/dashboard/posthog/settings` (Admin) | `/dashboard/posthog#sampling` (Admin); `/dashboard/posthog#provider-write` (Owner) in PostHog |
| The website's request limits | `/dashboard/configuration` (Admin) | `/dashboard/configuration#edit` (Admin) |
| Emptying the website's cache, the site's security level | `/dashboard/configuration` (Admin) | `/dashboard/configuration#cloudflare` (Owner) |

Control Plane's own keys (`/dashboard/control-plane`, its four sub-pages, `#edit-sampling`,
`#purge-config` and `#provider-write`) guard nothing since its routes were removed on 2026-10-28;
the next push switches them off (MAINTENANCE (private) SE-3).

Page-level denies also block the underlying API calls, and **enforcement is central, not
per-route**: under `API_DENY_MODE = "enforce"` the middleware maps every `/api/*` path to a page
through `API_PAGE_MAPPING` and denies anything unmapped (`src/lib/auth/routes.ts`,
`src/lib/auth/stages/decide.ts`). The routes above then check their part and switch themselves.

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
UI edits a row ──▶ optimistic local update ──▶ PATCH the page's settings route
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
- **Where it runs** — since 2026-10-28, `changeRow` in `src/lib/control-plane/settings-routes.ts`,
  called by `PATCH /api/sentry/settings`, `PATCH /api/posthog/settings` and
  `PATCH /api/configuration/limits`; each first checks that the key belongs to its service
  (`ownsKey`), so a page changes only its own rows. The screens save through `useConfigEdit.ts`.

### 4.3 Reset and purge

- **Put back to defaults** — `resetRows` restores the rows of **one service** (the page's own)
  whose value has drifted from its canonical default, recording each change in the history and
  one audit entry. Each page asks first in a confirmation dialog. Control Plane's reset walked
  every service at once; it was removed with the page on 2026-10-28.
- **Ask the website to read its settings now** — the Configuration page's request-limit section
  forces the cross-app cache flush (`POST /api/configuration/limits`, `{ action: 'refresh' }`,
  audited as `cache_purge`), for when a change must take effect on the public site right now. It
  replaced Control Plane's purge on 2026-10-28.

Both fail soft: if the public site is briefly unreachable, the local change still succeeds; the
refresh says so (502) and the website reads its settings within its TTL anyway.

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

*Added 2026-09-19.* Three Layer-A keys are scoped to `cf-admin`, but **nothing in cf-admin
reads them**. Control Plane let them be edited; since 2026-10-28 the Sentry page's Settings part
shows them and does not offer them ("Shown, not offered: nothing in the portal reads these yet"):

| Key | Declared as | Reality |
|---|---|---|
| `sentry.cf_admin.traces` | Server + client `tracesSampleRate` | `src/workers/cf-entry.ts` and `sentry.client.config.ts` both hardcode `0.1` |
| `sentry.cf_admin.error_sample_rate` | Error sample rate via `beforeSend` | no reader |
| `sentry.cf_admin.enabled` | "Master kill-switch for Sentry in cf-admin" | no reader |

Outside `config-schema.ts`, `grep -rn "sentry.cf_admin" src` finds only the Sentry page's words
for them (`src/components/dashboard/sentry/format.ts`, each "Meant to …") and its Settings part.
The consequence that mattered during an incident, while Control Plane offered them: **turning the
kill-switch off, or dropping the sample rate, during a Sentry quota event changed nothing**, while
the UI reported the edit as applied and audited it. The
equivalent `sentry.cf_astro.*` keys *are* read, by
`cf-astro/src/lib/service-config.ts`.

`cloudflare.cf_admin.observability_enabled` and `cloudflare.cf_astro.head_sampling_rate` are
read-only in the schema (deploy-time config) and read by nothing; no page offers them since
2026-10-28, and they are switched off with Control Plane's rows (MAINTENANCE (private)
SE-7).

Until these are wired, treat the cf-admin Sentry rows as a declaration of
intent. Wiring them means reading the config in `cf-entry.ts` and at client
init with the hardcoded values as the fail-safe fallback — which is what the
"parity invariant" in §4.1 already assumes.

---

## 5. Layer B — Provider Control

Layer B talks to each provider's **own management API**, server-to-server, using scoped tokens held
as Worker secrets. Every call returns a **discriminated result** (success, error, or
*unconfigured*), so a missing token renders a "configure this" notice rather than breaking the
page. Writes are behind an action switch (§3) and only render for people who hold it.

**Failure classification.** A failed provider call is not automatically a server error: `unconfigured`
and provider-4xx results map to **400**, genuine upstream 5xx and network failures to **502**. The
table that defines this, and the reasoning behind it, is owned by
[CONTROL-PLANE-CONNECTORS.md §2.1](./CONTROL-PLANE-CONNECTORS.md#21-failure-classification-why-a-502-is-not-the-default),
along with the per-connector reference.

Since 2026-10-28 the provider tools live on the pages that own each provider:

| Provider | Reads | Writes | Where, and its connector |
|---|---|---|---|
| **Sentry** | counts, issues, logs, the projects' filters, keys and spike protection | issue resolve, reopen and archive (`#triage`, Admin); filters, key limits, spike protection (`#provider-write`, Owner) | the [Sentry page](SENTRY.md), `src/lib/sentry/`; Analytics and System health still read usage and issues through `src/lib/control-plane/sentry-admin.ts` |
| **PostHog** | the project's recording settings, and the page's reads | PostHog's recordings on or off and the share recorded (`#provider-write`, Owner) | the [PostHog page](POSTHOG.md), `src/lib/posthog/` |
| **Cloudflare** | what the account holds, the zone's security level | emptying the website's cache, the security level (`#cloudflare`, Owner) | the [Configuration page](SETTINGS-AND-CONFIGURATION.md), `src/lib/control-plane/cloudflare-admin.ts` |
| **Supabase** | the security advisor | — (schema changes stay migration-driven) | System health's check, `src/lib/control-plane/supabase-admin.ts` |

Control Plane's own PostHog client (`posthog-admin.ts`) was removed with it on 2026-10-28. Its
recording write put the share of visits recorded where PostHog does not sample by, and it picked
its project by taking the first one the key could list; the PostHog page's client uses the
configured project and PostHog's own sampling field ([POSTHOG.md](POSTHOG.md) §3).

Notes that matter for correctness:

- Some knobs are **deploy-time only** (e.g. Cloudflare Worker observability sampling is set in build
  config and requires a redeploy); they are not offered for change (§4.5).
- **Provider writes are audited, but not identically to Layer-A writes.** A Layer-A edit writes
  both an `admin_audit_log` row and a versioned `service_config_history` row; a Layer-B provider
  write records only the `admin_audit_log` row, because there is no local value to version. A
  page's "last changes" list therefore shows Layer-A edits only.

---

## 6. Metrics, Health & Drift

Control Plane's overview showed the Overview's cached figures per service, and a "Health & Drift"
panel (`preflight.ts`) listing keys missing from the store, unknown keys and drifted values, and
which tokens were set. Both were removed with the page on 2026-10-28. What replaced them:

- **Figures** — the Overview, the Analytics page and System health.
- **Drift** — each settings part lists its own rows with their defaults, marks a value that differs
  from its default, and names the keys the database has no row for (`rowsOf` in
  `src/lib/control-plane/settings-rows.ts`).
- **Tokens** — the Sentry page's Overview has "What the portal's tokens can reach", and the PostHog
  page's Overview "What the portal's key can reach", each naming a permission to add; System
  health checks that Sentry and Cloudflare accept the portal's tokens. Token values are never read into the UI, logged or exposed.

---

## 7. API Surface

Control Plane's retired routes under `/api/control-plane/` (config, reset, purge-cache, sentry,
posthog, cloudflare, supabase) were all removed by 2026-10-28; nothing calls them
(`test/control-plane-retired.test.ts`). The routes that took their jobs, each in
[SECURITY.md](../security/SECURITY.md) §6a:

| Removed (2026-10-28) | Replaced by |
|---|---|
| reading and changing the config, and the reset | `GET`, `PATCH`, `POST /api/sentry/settings`; `GET`, `PATCH`, `POST /api/posthog/settings`; `GET`, `PATCH`, `POST /api/configuration/limits` |
| the cross-app config-cache flush (purge-cache) | `POST /api/configuration/limits` with `{ action: 'refresh' }` |
| Sentry's reads and writes | `GET /api/sentry/{part}`, `POST /api/sentry/issues`, `POST /api/sentry/settings` |
| PostHog's reads and the recording write | `GET /api/posthog/{part}`, `POST /api/posthog/settings` |
| Cloudflare's inventory, cache purge and security level | `GET`, `POST /api/configuration/cloudflare` |
| Supabase's advisors | dropped; System health's check reads them |

---

## 8. User Interface

Control Plane's overview and its four tabs were removed on 2026-10-28; each address is a forward
(`src/pages/dashboard/control-plane/`, the table at the top). Its components went with it:
`ConfigEditor`, `ConfigRow`, `ProviderControls`, `StatCard`, `MetricGrid`, `EmptyState`,
`Sparkline`, `ProviderTile.astro`, `SubPageShell.astro` and the Supabase widgets were deleted.

The pieces the new pages share stayed in `src/components/admin/control-plane/`:

| Component | Used by |
|---|---|
| `SettingRows.tsx` | the Sentry and PostHog Settings parts and Configuration's request limits: one row per setting, the last changes, putting the rows back after a confirmation dialog |
| `useConfigEdit.ts` | the same three: saves one row at a time, optimistic, with the version check (§4.2) |
| `RoutePolicyEditor.tsx` | the Sentry Settings part, for the JSON rules per page (§4.4) |
| `IgnoreErrorsEditor.tsx` | the Sentry Settings part, for `sentry.cf_astro.ignore_errors` once it has a row (MAINTENANCE (private) SE-5) |
| `SectionCard.astro` | the Configuration page's sections |

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

- [SENTRY.md](./SENTRY.md), [POSTHOG.md](./POSTHOG.md), [SETTINGS-AND-CONFIGURATION.md](./SETTINGS-AND-CONFIGURATION.md) — the pages that took over Control Plane's tools on 2026-10-28
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
| 2026-10-28 | Control Plane retired: the top table against the five forwards in `src/pages/dashboard/control-plane/` and `test/control-plane-retired.test.ts`; §3's keys against migrations `0068`, `0081`, `0082` and `0083`; §4.2 and §4.3 against `settings-routes.ts`, `useConfigEdit.ts` and `src/pages/api/configuration/limits.ts`; §4.1's types, scopes and categories and §4.4's caps against `config-schema.ts`; §4.5 by `grep -rn "sentry.cf_admin" src` and the hardcoded `0.1` in `cf-entry.ts` and `sentry.client.config.ts`; §5 to §8 against what is left in `src/lib/control-plane/` and `src/components/admin/control-plane/` and who imports each. `last_verified` moved | The live `admin_pages` and `service_config` rows (no change to them in this push); provider API behaviour; the pages in a phone browser |
| 2026-10-28 | The "Being replaced" note, the §3 sentence on the Cloudflare route, the §7 route row and the §8 address against the Configuration page's two routes, `src/pages/dashboard/control-plane/cloudflare.astro` (a forward) and migration `0083`; `test/configuration-limits-cloudflare.test.ts` passes | The rest of the document; `last_verified` left as it was |
| 2026-10-28 | The "Being replaced" note against the PostHog page's Settings part (`src/pages/api/posthog/settings.ts`, migration `0082`); that this page's PostHog write (`setSessionRecording` in `src/lib/control-plane/posthog-admin.ts`) puts its share in `session_replay_config`, and that the project's live `session_replay_config` is empty while `session_recording_sample_rate` is none (every visit), through the PostHog connector | The rest of the document; `last_verified` left as it was |
| 2026-10-28 | The "Being replaced" note against the Sentry page's Settings part (`src/pages/api/sentry/settings.ts`, migration `0081`); `ConfigEditor.tsx` now saves through `useConfigEdit.ts`, which sends the row's version so a change made on the other page is refused (409) and reread, checked with `test/sentry-settings.test.ts` | The rest of the document; `last_verified` left as it was |
| 2026-10-28 | The "Being replaced" note against the new Sentry page (`src/pages/dashboard/sentry/`, migration `0080`) and the plan's §2 and §8; this page's code and rows unchanged | The rest of the document; `last_verified` left as it was |
| 2026-10-17 | Every route under `src/pages/api/control-plane/` again (role floor, PLAC fragment, `withETag` / `jsonFresh` / `jsonOk`), matching §7; `sentry.cf_admin.*` still read by nothing but `config-schema.ts`, and `tracesSampleRate: 0.1` still hardcoded in `cf-entry.ts` and `sentry.client.config.ts` (§4.5 stands); the schema's types, scopes, categories, services and route-policy caps; the env names each connector reads; every component and page in §8; cf-astro's `MEM_TTL_MS` (10 s) and `route-policy.ts` matching. No corrections needed | The live secret list and `admin_pages` rows (no connector used in this pass); provider API behaviour |
| 2026-09-19 | `grep -rn "sentry.cf_admin\|error_sample_rate" src` → only `config-schema.ts`; the hardcoded `tracesSampleRate: 0.1` in `src/workers/cf-entry.ts` and `sentry.client.config.ts`; `src/lib/auth/decide-access.ts` (owner / vendor_support bypass, exact-then-ancestor resolution); `src/lib/auth/routes.ts` + `stages/decide.ts` (central API→page mapping, `API_DENY_MODE`); `src/pages/api/control-plane/cloudflare.ts` GET (no deny helper); the audit targets in `sentry.ts` / `cloudflare.ts` / `posthog.ts`; `src/lib/control-plane/preflight.ts`; live `wrangler secret list` (25 names — no `SUPABASE_ACCESS_TOKEN`, no `POSTHOG_ORG_ID`) | Whether the unconfigured cards are *intended* to stay unconfigured; Cloudflare Observability behaviour; provider API behaviour |
| 2026-09-14 | Every route under `src/pages/api/control-plane/` (role floor, PLAC fragment, response helper); the six-tier RBAC ladder in `src/lib/auth/rbac.ts`; the three PLAC anchors in routes and UI; the config schema (`config-schema.ts`: value types, categories, scopes, services, caps, route-policy validation); optimistic concurrency + history + audit + best-effort flush in `config.ts` / `ServiceConfigRepository.ts`; cf-astro's `route-policy.ts` matching and `service-config.ts` caching; every component under `src/components/admin/control-plane/`; the cross-reference targets. Ten corrections above, one of which was a code defect (PATCH config lacked its role floor and fragment; fixed). | Live `admin_pages` rows (the seed is in `database/legacy_migrations/0030_seed_control_plane_pages.sql`; the baseline migration carries no data); Cloudflare Observability behaviour; the pre-redesign "hardcoded in source" history |

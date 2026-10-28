---

title: "Service Control Plane — Connectors (Layer B)"
status: active
audience: [ai, technical]
last_verified: 2026-10-28
verified_against: [code]
owner: harshil
related_code: [src/lib/control-plane/provider-result.ts, src/lib/control-plane/cloudflare-admin.ts, src/lib/control-plane/sentry-admin.ts, src/lib/control-plane/supabase-admin.ts, src/lib/control-plane/config-publisher.ts]
related_docs: [CONTROL-PLANE.md, ../operations/OPERATIONS.md, ../security/SECURITY.md]
tags: [control-plane, connectors, sentry, posthog, cloudflare, supabase]
---

# Service Control Plane — Connectors (Layer B)

> **TL;DR (non-technical):** The technical reference for how the portal talks to each outside provider's management API (Sentry, Cloudflare, Supabase), what it reads and changes, and how failures are handled safely. Control Plane, the page these were written for, was retired on 2026-10-28; the connectors now serve the pages that took over its tools.

> **Status (2026-10-28):** Control Plane's page and routes were removed and its tools moved to
> the pages that own each provider ([CONTROL-PLANE.md](./CONTROL-PLANE.md), the table at the top).
> Its PostHog connector (`posthog-admin.ts`) and its token panel (`preflight.ts`) were deleted with
> it; the PostHog page has its own client (§3.3). The Cloudflare connector serves the Configuration
> page, the Sentry one Analytics and System health, and the Supabase one System health, which reads
> `unconfigured` until its token is set (MAINTENANCE (private) SH-11).
> **Scope:** The server-to-server clients in `src/lib/control-plane/`, plus the shared result
> contract, failure classification, token scopes, and config propagation. This document owns the
> failure-classification table (§2.1); [CONTROL-PLANE.md](./CONTROL-PLANE.md) §5 links here rather
> than restating it.
> **Companion to:** [CONTROL-PLANE.md](./CONTROL-PLANE.md)
> **Last Updated:** 2026-10-28

> **Audience note:** Architecture-level reference for AI IDE agents and contributors. It deliberately
> omits environment-specific values — exact secret/env-var names, resource IDs, account identifiers,
> org/project slugs, and zone IDs live only in the private repo and infrastructure config (e.g.
> `wrangler.toml` and Worker secrets), never here. Tokens are described by **scope and purpose**.

---

## 1. What a connector is

A **connector** is a thin, server-side client to one provider's **management API**. Connectors back
**Layer B** (see [CONTROL-PLANE.md](./CONTROL-PLANE.md) §5): they read provider state for visibility
and, for some providers, apply writes. They run only on the Worker, never in the browser, and are
reached only through the gated routes of the pages that use them. Control Plane's own
`/api/control-plane/*` routes were removed on 2026-10-28.

Design rules, enforced uniformly:

- **Never throw across the boundary.** Every connector returns a discriminated `ProviderResult<T>`.
- **Fail-soft on missing config.** No token → an `unconfigured` result → a "configure this to enable
  control" notice in the UI, never a 500.
- **Tokens are Worker secrets.** Used server-side only; the UI knows whether a token *exists*
  (presence check), never its value.
- **Writes are privileged and audited.** Gated by an Owner action switch
  (`/dashboard/configuration#cloudflare` for Cloudflare's; the Sentry and PostHog pages'
  `#provider-write` for theirs) and recorded in `admin_audit_log`. *Corrected 2026-09-19 — this said "the same history trail as Layer-A
  edits". Layer-A edits additionally write a versioned `service_config_history` row; a provider write
  does not, because there is no local value to version, so provider writes never appear in a
  page's "last changes" list.*
- **An Owner switch cannot be used to hold an owner back.** Owner and vendor_support bypass PLAC
  entirely ([PERMISSIONS-SYSTEM.md](../architecture/PERMISSIONS-SYSTEM.md)), so a deny written
  against them has no effect. The capability separates *page visibility* from *write power* for
  everyone below that line; it is not a brake on the top two tiers.

---

## 2. The shared result contract

All connectors return one type, so API routes and the UI handle success, failure, and missing
configuration the same way everywhere:

```ts
type ProviderResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string; unconfigured?: boolean; status?: number };
```

Constructors and helpers (in `provider-result.ts`):

| Helper                      | Use                                                                        |
|-----------------------------|----------------------------------------------------------------------------|
| `ok(data)`                  | Success.                                                                    |
| `err(message)`              | Generic failure (no HTTP status implied).                                   |
| `unconfigured(what)`        | Missing token / required setting → drives the "configure" UI state.         |
| `httpError(label, res)`     | Classify a non-OK upstream `Response` (reads its body for the real message).|
| `networkError(label, e)`    | A thrown fetch error (network / timeout).                                   |
| `errorStatus(result)`       | The HTTP status an endpoint should return for a failed result.             |

### 2.1 Failure classification (why a 502 is not the default)

A failed provider call is **not** automatically a server error. The result carries the HTTP `status`
the endpoint should return, and `errorStatus()` resolves it:

| Failure                                   | `status` | Endpoint returns | Logged at | Rationale                                   |
|-------------------------------------------|----------|------------------|-----------|---------------------------------------------|
| `unconfigured` (no token / setting)       | —        | **400**          | —         | Our config gap, not an outage.              |
| Provider **4xx** (esp. 401 / 403 scope)   | 400      | **400**          | `warn`    | Our misconfiguration (token/permissions).   |
| Provider **5xx**                          | 502      | **502**          | `error`   | Genuine upstream outage.                     |
| Network / timeout (thrown)                | 502      | **502**          | `error`   | Upstream unreachable.                        |

`errorStatus(r)` = `r.status ?? (r.unconfigured ? 400 : 502)`. For 401/403, `httpError` appends an
actionable hint (`" — check API token permissions"`) and surfaces the provider's own message
(extracted from common JSON error shapes — `errors[0].message`, `error`, `detail`, `message` — or the
first 200 chars of the body).

**Why it matters:** routing expected misconfigurations (a token missing a scope) to **400** instead
of **502** keeps Cloudflare Workers Observability from flagging them as server errors, and the
`warn`/`error` split keeps real outages legible in logs. This is what the cache-purge "502 noise" fix
addressed: a Cloudflare token lacking `Zone:Cache Purge` now reads as a 400 config fault with a clear
message, not a 5xx.

---

## 3. Connector reference

Each connector lives in `src/lib/control-plane/` and is invoked by the route of the page that owns
the provider (Control Plane's routes, which used them until 2026-10-28, were removed). Provider API
base URLs are public/standard and shown for orientation.

### 3.1 Cloudflare — `cloudflare-admin.ts`

| | |
|---|---|
| **Provider API** | `https://api.cloudflare.com/client/v4` |
| **Function** | `purgeCache(env, body)` → `POST /zones/{zoneId}/purge_cache`; `setSecurityLevel(env, level)` → zone security level |
| **Capability** | writes: purge **everything**, by **URL list**, or by **cache-tag**; set the zone **security level**. Reads (added since the 2026-08-13 pass): `listWorkerScripts`, `listKVNamespaces`, `listD1Databases`, `listR2Buckets`, `getQueueDetail`, `listZTActiveUsers`, `getZoneSecurity`, served by `GET /api/configuration/cloudflare` (moved from Control Plane's route, removed 2026-10-28) |
| **Token / scope** | `resolveToken()` = the dedicated override if set, otherwise the shared Cloudflare API token. **The same resolved token powers all of it** — the seven inventory reads, the cache purge and the zone-security write |
| **Unconfigured when** | no token, or (for zone-scoped calls) no zone id |

> ⚠️ **The "dedicated purge token" is not purge-scoped in practice.** *Corrected
> 2026-09-19 — this row said the token needs only `Zone: Cache Purge` and that
> the override applies "for purge only".* `resolveToken()` is called by every
> function in this file, so setting the override **replaces** the shared token
> for the Workers, KV, D1, R2, Queues, Zero Trust-users and zone-security reads
> as well. A token provisioned with `Zone: Cache Purge` alone will make the
> Configuration page's Cloudflare section read `unconfigured`/400 while purge still works —
> a confusing half-failure. Provision it with the account read scopes those
> inventory calls need, plus `Zone: Zone Settings: Edit` for the security-level
> write, or leave the override unset.

> Cloudflare **metrics** (requests, cache hit, bandwidth, threats, D1/R2/queue/workers) are *not* read
> by this connector — they come from the shared analytics aggregate (`src/lib/analytics/providers/index.ts`).
> *2026-09-14: this note said the file is "purge-only"; it has been an inventory reader plus two writers
> since the Cloudflare sub-page gained its resource inventory.*

### 3.2 Sentry — `sentry-admin.ts`

| | |
|---|---|
| **Provider API** | `https://sentry.io/api/0` |
| **Reads** | `getSentryUsage` (the organisation's usage by outcome, stats_v2) and `getOrgIssues` (unresolved issues of every project, most frequent first) |
| **Used by** | the Analytics page (`src/lib/analytics/report/sources.ts`) and System health's log scan (`src/lib/health/logscan.ts`, `src/pages/api/system-health/logs.ts`) |
| **Writes** | none since 2026-10-28 |
| **Token / scope** | a Sentry auth token + org; `org:read` |
| **Unconfigured when** | token or org missing |

Control Plane's Sentry reads and writes (top issues, inbound filters, client keys, key rate
limits, spike protection, resolve and ignore) were removed from this file on 2026-10-28. The
Sentry page does them through its own client, `src/lib/sentry/`, with its own permission checks
([SENTRY.md](./SENTRY.md) §6 and §7).

### 3.3 PostHog — removed 2026-10-28

Control Plane's PostHog connector (`posthog-admin.ts`) was deleted with the page. It picked its
project by taking the first one the key could list, and its recording write set a share that
PostHog does not sample by. The PostHog page's client, `src/lib/posthog/client.ts`, reads the
configured project id, and its Settings part changes PostHog's own sampling field
([POSTHOG.md](./POSTHOG.md) §3 and §4).

### 3.4 Supabase — `supabase-admin.ts`

| | |
|---|---|
| **Provider API** | `https://api.supabase.com/v1` (Management API) |
| **Function** | `getAdvisors(env, 'security' | 'performance')` → `GET /projects/{ref}/advisors/{type}` |
| **Capability** | read only — advisors. Schema changes stay migration-driven; no connector mutates the database. |
| **Token / scope** | a Supabase **Management API PAT**; the project `ref` is derived from the public Supabase URL |
| **Unconfigured when** | access token (PAT) missing |
| **Used by** | System health's Supabase security advisor check (`src/lib/health/catalog.ts`) |
| **Live status** | **unconfigured** — the PAT is not a Worker secret, so that check reads "Not set up" (MAINTENANCE (private) SH-11) |

> Supabase DB/auth **metrics** (size, connections, cache-hit, users, MAU) likewise come from the
> shared analytics aggregate, not this connector.

---

## 4. Token & scope matrix

Control Plane's `tokenStatus()` panel (`preflight.ts`), which showed which tokens were set by
presence only, was removed with the page on 2026-10-28. The Sentry page's Overview ("What the
portal's tokens can reach") and the PostHog page's ("What the portal's key can reach") now say
which permission a token lacks, and System health checks that Sentry and Cloudflare accept the
portal's tokens; none reads or logs a value. Tokens, by purpose:

| Purpose                                                            | Powers                                  | Required scope                         | Configured live |
|-------------------------------------------------------------------|-----------------------------------------|----------------------------------------|---|
| Sentry auth token (+ org)                                         | the Sentry page, Analytics, System health | `org:read`; the Sentry page's writes need `event:write` and `project:write` (MAINTENANCE (private) SE-2) | ✅ |
| Cloudflare API token                                              | Cloudflare analytics + the full inventory, purge and zone-security write | `Zone: Cache Purge` for purge, plus the account read scopes for the inventory and `Zone Settings: Edit` for security level | ✅ |
| Dedicated Cloudflare token *(optional)*                           | **overrides the above for everything this connector does**, not purge alone (§3.1) | as the row above                        | — |
| Supabase service-role key                                        | Supabase metrics + Auth                | service role                           | ✅ |
| Supabase Management API PAT                                       | Supabase advisors                       | Management API (advisors)              | ❌ |
| PostHog personal API key                                         | the PostHog page, Analytics             | per product (MAINTENANCE (private) PH-1) | ✅ |
| PostHog org id *(optional)*                                       | the PostHog page's billing read, which otherwise takes the project's organisation | —      | ❌ |

*"Configured live" column added 2026-09-19, from `wrangler secret list` against
the production Worker — names only, never values. Two of the seven are absent,
which is why §1's fail-soft `unconfigured` path is the normal state for the
Supabase and PostHog-billing cards rather than an edge case.*

Exact secret/env-var names are intentionally omitted here; they live in `wrangler.toml` and the
Worker secret store ([OPERATIONS.md](../operations/OPERATIONS.md) §5).

---

## 5. Config propagation connector — `config-publisher.ts`

Distinct from the provider connectors, this is the **internal** connector that pushes a Layer-A change
to cf-astro so the public site picks it up immediately instead of waiting a TTL.

- **Function:** `flushAstroConfigCache(env)` → `POST /api/revalidate` with body `{ kind: 'config' }`.
- **Transport:** prefers the internal **service binding** (`https://internal/api/revalidate`,
  server-to-server, no public hop); falls back to the public cf-astro URL.
- **Auth:** a shared **revalidation secret** as a Bearer token (the same mechanism the CMS uses).
- **Failure mode:** **best-effort** — if cf-astro is briefly unreachable the D1 write still succeeds,
  and the endpoint reports the flush outcome separately (it never blocks the operator).

Triggered by, since 2026-10-28: `changeRow` and `resetRows` in
`src/lib/control-plane/settings-routes.ts` (fire-and-forget after a successful change; a reset only
when something changed), which the Sentry, PostHog and Configuration settings routes call, and the
explicit `POST /api/configuration/limits` with `{ action: 'refresh' }`. Control Plane's config,
reset and purge-cache routes, which triggered it until then, were removed.

---

## 6. How connectors relate to MCP

The same four providers are also reachable via **MCP (Model Context Protocol) servers** during
AI-assisted development and operations — e.g. an agent inspecting Cloudflare resources, querying
Supabase, or triaging Sentry issues. It is important not to conflate the two channels:

| | **Control-plane connectors** | **MCP servers** |
|---|---|---|
| **Audience** | platform operators (humans), at runtime | developers / AI agents, at build/ops time |
| **Path** | in the request path, behind RBAC + PLAC, same-origin & audited | a separate developer tool channel, outside the app |
| **Auth** | Worker secrets scoped to the minimum needed | the developer's own MCP credentials |
| **Surface** | the curated, safe actions the UI exposes (purge, zone security level, recording toggle, Sentry issue triage, advisors) | the provider's broader API as the MCP server exposes it |
| **Source of truth** | shared D1 + provider APIs | read/inspection (and provider-side changes) outside the audit trail |

**Rule of thumb:** the connectors are the *production* path — gated, minimal, audited. MCP is a
*development/ops convenience* and is **not** a substitute for them: changes that must be audited,
access-controlled, or reflected to operators belong in the portal, not in an ad-hoc MCP call.
When adding capability, extend a connector (and the owning page's route, PLAC capability, and
audit) rather than wiring the UI to anything MCP-side.

---

## 7. Adding or extending a connector — checklist

1. **Client** with the page that owns the provider (`src/lib/sentry/` and `src/lib/posthog/` since
   2026-10-28) or in `src/lib/control-plane/<provider>-admin.ts` when several pages share it: return
   `ProviderResult<T>`; use `unconfigured(...)` when the token/setting is absent; wrap non-OK
   responses with `httpError(label, res)` and thrown errors with `networkError(label, e)`. Never throw.
2. **Route** under the owning page's API (`src/pages/api/<page>/`): check the page, its part and its
   action switch (reads = the page or part; writes = an Owner switch), and return failures via
   `errorStatus(result)`.
3. **Token**: the page says which permission is missing when the provider refuses (as the Sentry and
   PostHog Overviews do), never showing its value; add a System health check when the page depends
   on it.
4. **Audit** every write through the shared history trail.
5. **UI** renders the write control only for operators who hold the capability, and degrades to the
   `unconfigured` notice otherwise.

---

## 8. Cross-References

- [CONTROL-PLANE.md](./CONTROL-PLANE.md) — the two-layer model, who may change what since Control Plane was retired, Layer-A config (incl. the route-policy engine), where each old address leads
- [OPERATIONS.md](../operations/OPERATIONS.md) — deploy commands, provider integrations, free-tier limits
- [plac-and-audit.md](../architecture/plac-and-audit.md) — PLAC resolution and the audit engine
- [SECURITY.md](../security/SECURITY.md) — secret handling, CSRF, headers, session model

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-28 | After Control Plane was retired: the files left in `src/lib/control-plane/` and who imports each connector (`grep -rln`); `sentry-admin.ts` now `getSentryUsage` and `getOrgIssues` only; `resolveToken(env)` still called 8 times in `cloudflare-admin.ts` (the §3.1 warning stands); `supabase-admin.ts` used only by System health's catalog; `posthog-admin.ts` and `preflight.ts` deleted; `src/lib/posthog/client.ts` reads `POSTHOG_PROJECT_ID`, else `PUBLIC_POSTHOG_PROJECT_ID`; `flushAstroConfigCache`'s callers (`settings-routes.ts`, `src/pages/api/configuration/limits.ts`) | The live secret list and token scopes (no connector used in this pass); provider API behaviour; §6 |
| 2026-10-17 | The 11 files under `src/lib/control-plane/`: every exported function named in §2 and §3 and its API base; `errorStatus`, `httpError`, `networkError`; `resolveToken(env)` still called 8 times in `cloudflare-admin.ts` (the §3.1 warning stands); `resolveProjectId()` still falls back to the first listed project (the §3.3 warning stands); `tokenStatus()` (7 entries, label, purpose, presence); `flushAstroConfigCache` and its transport. No corrections needed | The live secret list and token scopes (no connector used in this pass); provider API behaviour; §6 |
| 2026-09-19 | `cloudflare-admin.ts` — `resolveToken(env)` and its **8** call sites (the seven inventory reads plus the security-level write), so the override is not purge-scoped; `posthog-admin.ts` `resolveProjectId()` (env var, else first listed project) and its use by both the settings read and `setSessionRecording`; `supabase-admin.ts` unconfigured condition; `preflight.ts` `tokenStatus()` (label + purpose + presence); the audit targets of the three provider routes; live `wrangler secret list` — 25 names, no Supabase Management PAT and no PostHog org id. **`ls src/lib/control-plane` returns 11 files, not six**, as the 2026-09-14 row below claims | Which scopes the provisioned tokens actually carry; whether the PostHog personal key can see more than one project; provider API behaviour; the §6 MCP comparison |
| 2026-09-14 | All six files under `src/lib/control-plane/`; the `ProviderResult` type and helpers in §2 line by line (status mapping, 401/403 hint, message extraction); every function named in §3 exists with the described API base, token and unconfigured conditions; the §4 token matrix against `tokenStatus()` (7 entries, presence-only); the §5 flush path in `config-publisher.ts` and its three call sites, and cf-astro's `kind === 'config'` handling; `#provider-write` + `requireAuth(ctx, 'owner')` on every Layer-B POST. Six corrections above (Cloudflare reads and security-level write, Sentry issue triage, panel shows token names). | Token scopes actually provisioned; provider API behaviour; the MCP comparison in §6 |

---

title: "Service Control Plane — Connectors (Layer B)"
status: active
audience: [ai, technical]
last_verified: 2026-09-14
verified_against: [code]
owner: harshil
related_code: [src/lib/control-plane/provider-result.ts, src/lib/control-plane/cloudflare-admin.ts, src/lib/control-plane/sentry-admin.ts, src/lib/control-plane/posthog-admin.ts, src/lib/control-plane/supabase-admin.ts, src/lib/control-plane/config-publisher.ts, src/lib/control-plane/preflight.ts]
related_docs: [CONTROL-PLANE.md, ../operations/OPERATIONS.md, ../security/SECURITY.md]
tags: [control-plane, connectors, sentry, posthog, cloudflare, supabase]
---

# Service Control Plane — Connectors (Layer B)

> **TL;DR (non-technical):** The technical reference for how the control plane talks to each external provider (Sentry, PostHog, Cloudflare, Supabase): what it reads, what it can change, and how failures are handled safely.

> **Status:** Deployed. **Two of the four providers are only partly configured
> in production** — Supabase advisors and PostHog billing return `unconfigured`
> live, because their secrets are not on the Worker (§4). *Corrected 2026-09-19;
> this said "Production Active" for all four.*
> **Scope:** The server-to-server clients the control plane uses to read and write each external
> provider, plus the shared result contract, failure classification, token scopes, and config
> propagation. This document owns the failure-classification table (§2.1);
> [CONTROL-PLANE.md](./CONTROL-PLANE.md) §5 links here rather than restating it.
> **Companion to:** [CONTROL-PLANE.md](./CONTROL-PLANE.md)
> **Last Updated:** 2026-09-19

> **Audience note:** Architecture-level reference for AI IDE agents and contributors. It deliberately
> omits environment-specific values — exact secret/env-var names, resource IDs, account identifiers,
> org/project slugs, and zone IDs live only in the private repo and infrastructure config (e.g.
> `wrangler.toml` and Worker secrets), never here. Tokens are described by **scope and purpose**.

---

## 1. What a connector is

A **connector** is a thin, server-side client to one provider's **management API**. Connectors back
the control plane's **Layer B** (see [CONTROL-PLANE.md](./CONTROL-PLANE.md) §5): they read provider
state for visibility and, for some providers, apply writes. They run only on the Worker, never in the
browser, and are reached exclusively through the gated `/api/control-plane/*` routes.

Design rules, enforced uniformly:

- **Never throw across the boundary.** Every connector returns a discriminated `ProviderResult<T>`.
- **Fail-soft on missing config.** No token → an `unconfigured` result → a "configure this to enable
  control" notice in the UI, never a 500.
- **Tokens are Worker secrets.** Used server-side only; the UI knows whether a token *exists*
  (presence check), never its value.
- **Writes are privileged and audited.** Gated by the `#provider-write` PLAC capability (Owner+) and
  recorded in `admin_audit_log`. *Corrected 2026-09-19 — this said "the same history trail as Layer-A
  edits". Layer-A edits additionally write a versioned `service_config_history` row; a provider write
  does not, because there is no local value to version, so provider writes never appear in the
  overview's "recent change history" panel.*
- **`#provider-write` cannot be used to hold an owner back.** Owner and vendor_support bypass PLAC
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

Each connector lives in `src/lib/control-plane/` and is invoked by the matching `/api/control-plane/*`
route. Provider API base URLs are public/standard and shown for orientation.

### 3.1 Cloudflare — `cloudflare-admin.ts`

| | |
|---|---|
| **Provider API** | `https://api.cloudflare.com/client/v4` |
| **Function** | `purgeCache(env, body)` → `POST /zones/{zoneId}/purge_cache`; `setSecurityLevel(env, level)` → zone security level |
| **Capability** | writes: purge **everything**, by **URL list**, or by **cache-tag**; set the zone **security level**. Reads (added since the 2026-08-13 pass): `listWorkerScripts`, `listKVNamespaces`, `listD1Databases`, `listR2Buckets`, `getQueueDetail`, `listZTActiveUsers`, `getZoneSecurity`, served by `GET /api/control-plane/cloudflare` |
| **Token / scope** | `resolveToken()` = the dedicated override if set, otherwise the shared Cloudflare API token. **The same resolved token powers all of it** — the seven inventory reads, the cache purge and the zone-security write |
| **Unconfigured when** | no token, or (for zone-scoped calls) no zone id |

> ⚠️ **The "dedicated purge token" is not purge-scoped in practice.** *Corrected
> 2026-09-19 — this row said the token needs only `Zone: Cache Purge` and that
> the override applies "for purge only".* `resolveToken()` is called by every
> function in this file, so setting the override **replaces** the shared token
> for the Workers, KV, D1, R2, Queues, Zero Trust-users and zone-security reads
> as well. A token provisioned with `Zone: Cache Purge` alone will make the
> whole Cloudflare sub-page read `unconfigured`/400 while purge still works —
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
| **Reads** | `getSentryUsage` (error/transaction stats), `getTopIssues`, `listInboundFilters`, `listClientKeys` |
| **Writes** | `setInboundFilter`, `setKeyRateLimit`, `setSpikeProtection`, `updateSentryIssue` (resolve / ignore / unresolve — `POST` actions `resolve-issue`, `ignore-issue`, `unresolve-issue`) |
| **Project scope** | each call takes `'cf-admin' | 'cf-astro'` to target the right project |
| **Token / scope** | a Sentry auth token + org; **writes require `project:write`** |
| **Unconfigured when** | token or org missing |

### 3.3 PostHog — `posthog-admin.ts`

| | |
|---|---|
| **Provider API** | `https://us.posthog.com/api` |
| **Reads** | `getPostHogSettings` (recording opt-in, sample rate, autocapture), `getPostHogBilling` |
| **Writes** | `setSessionRecording(env, optIn, sampleRate)` |
| **Token / scope** | a PostHog **personal API key**; billing reads additionally need the **org id** |
| **Unconfigured when** | personal API key missing (billing: also when org id missing) |
| **Live status** | settings + recording write: configured. Billing: **unconfigured** — the org id is not a Worker secret |

> ⚠️ **Project scoping is a fallback, not a setting.** `resolveProjectId()` reads
> a `POSTHOG_PROJECT_ID` env var, and when it is absent asks the API for
> `/projects/` and takes **the first result**. That variable is not set on the
> live Worker; the secret that *is* set is a differently-named public one that
> this connector does not read. The fallback governs both the settings read
> **and** the `setSessionRecording` PATCH, so if the personal key can see more
> than one project, an Owner's session-recording write can land on the wrong
> one. Fix: have the connector read the configured project id (adding no new
> secret — the value already exists under the public name), then document the
> scoping here. *Flagged 2026-09-19 — not yet fixed.*

### 3.4 Supabase — `supabase-admin.ts`

| | |
|---|---|
| **Provider API** | `https://api.supabase.com/v1` (Management API) |
| **Function** | `getAdvisors(env, 'security' | 'performance')` → `GET /projects/{ref}/advisors/{type}` |
| **Capability** | read only — advisors. Schema changes stay migration-driven; the control plane never mutates the database. |
| **Token / scope** | a Supabase **Management API PAT**; the project `ref` is derived from the public Supabase URL |
| **Unconfigured when** | access token (PAT) missing |
| **Live status** | **unconfigured** — the PAT is not a Worker secret, so the advisors card shows the "configure" notice in production |

> Supabase DB/auth **metrics** (size, connections, cache-hit, users, MAU) likewise come from the
> shared analytics aggregate, not this connector.

---

## 4. Token & scope matrix

The preflight `tokenStatus()` check reports which integrations are configured by **presence only** —
it never reads or logs a value. Tokens, by purpose:

| Purpose                                                            | Powers                                  | Required scope                         | Configured live |
|-------------------------------------------------------------------|-----------------------------------------|----------------------------------------|---|
| Sentry auth token (+ org)                                         | Sentry metrics + Layer-B               | `project:write` for writes             | ✅ |
| Cloudflare API token                                              | Cloudflare analytics + the full inventory, purge and zone-security write | `Zone: Cache Purge` for purge, plus the account read scopes for the inventory and `Zone Settings: Edit` for security level | ✅ |
| Dedicated Cloudflare token *(optional)*                           | **overrides the above for everything this connector does**, not purge alone (§3.1) | as the row above                        | — |
| Supabase service-role key                                        | Supabase metrics + Auth                | service role                           | ✅ |
| Supabase Management API PAT                                       | Supabase advisors                       | Management API (advisors)              | ❌ |
| PostHog personal API key                                         | PostHog settings + recording write      | personal API key                       | ✅ |
| PostHog org id                                                   | PostHog billing reads                   | —                                      | ❌ |

*"Configured live" column added 2026-09-19, from `wrangler secret list` against
the production Worker — names only, never values. Two of the seven are absent,
which is why §1's fail-soft `unconfigured` path is the normal state for the
Supabase and PostHog-billing cards rather than an edge case.*

Exact secret/env-var names are intentionally omitted here; they live in `wrangler.toml` and the
Worker secret store. The Health & Drift panel shows each token's **name and purpose** and a
configured/not dot (presence only — never a value). *Corrected 2026-09-14: it said "purpose only".*

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

Triggered by: `PATCH /api/control-plane/config` (fire-and-forget after a successful write), the bulk
`POST /api/control-plane/reset` (only when something changed), and the explicit
`POST /api/control-plane/purge-cache`.

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
access-controlled, or reflected to operators belong in the control plane, not in an ad-hoc MCP call.
When adding capability, extend a connector (and its `/api/control-plane/*` route, PLAC capability, and
audit) rather than wiring the UI to anything MCP-side.

---

## 7. Adding or extending a connector — checklist

1. **Client** in `src/lib/control-plane/<provider>-admin.ts`: return `ProviderResult<T>`; use
   `unconfigured(...)` when the token/setting is absent; wrap non-OK responses with
   `httpError(label, res)` and thrown errors with `networkError(label, e)`. Never throw.
2. **Route** under `src/pages/api/control-plane/`: enforce the role floor + PLAC capability (reads =
   page; writes = `#provider-write`, Owner+), and return failures via `errorStatus(result)`.
3. **Token** registered in `tokenStatus()` with its **label and purpose** (`src/lib/control-plane/preflight.ts`), so the Health & Drift panel can show it. *Corrected 2026-09-19 — this said "(purpose only)", contradicting §4's own correction three sections earlier.*
4. **Audit** every write through the shared history trail.
5. **UI** renders the write control only for operators who hold the capability, and degrades to the
   `unconfigured` notice otherwise.

---

## 8. Cross-References

- [CONTROL-PLANE.md](./CONTROL-PLANE.md) — the control plane overview: two-layer model, access control, Layer-A config (incl. the route-policy engine), API surface, UI
- [OPERATIONS.md](../operations/OPERATIONS.md) — deploy commands, provider integrations, free-tier limits
- [plac-and-audit.md](../architecture/plac-and-audit.md) — PLAC resolution and the audit engine
- [SECURITY.md](../security/SECURITY.md) — secret handling, CSRF, headers, session model

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | `cloudflare-admin.ts` — `resolveToken(env)` and its **8** call sites (the seven inventory reads plus the security-level write), so the override is not purge-scoped; `posthog-admin.ts` `resolveProjectId()` (env var, else first listed project) and its use by both the settings read and `setSessionRecording`; `supabase-admin.ts` unconfigured condition; `preflight.ts` `tokenStatus()` (label + purpose + presence); the audit targets of the three provider routes; live `wrangler secret list` — 25 names, no Supabase Management PAT and no PostHog org id. **`ls src/lib/control-plane` returns 11 files, not six**, as the 2026-09-14 row below claims | Which scopes the provisioned tokens actually carry; whether the PostHog personal key can see more than one project; provider API behaviour; the §6 MCP comparison |
| 2026-09-14 | All six files under `src/lib/control-plane/`; the `ProviderResult` type and helpers in §2 line by line (status mapping, 401/403 hint, message extraction); every function named in §3 exists with the described API base, token and unconfigured conditions; the §4 token matrix against `tokenStatus()` (7 entries, presence-only); the §5 flush path in `config-publisher.ts` and its three call sites, and cf-astro's `kind === 'config'` handling; `#provider-write` + `requireAuth(ctx, 'owner')` on every Layer-B POST. Six corrections above (Cloudflare reads and security-level write, Sentry issue triage, panel shows token names). | Token scopes actually provisioned; provider API behaviour; the MCP comparison in §6 |

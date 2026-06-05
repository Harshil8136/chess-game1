# Service Control Plane — Connectors (Layer B)

> **Status:** Production Active
> **Scope:** The server-to-server clients the control plane uses to read and write each external
> provider, plus the shared result contract, failure classification, token scopes, and config
> propagation.
> **Companion to:** [CONTROL-PLANE.md](./CONTROL-PLANE.md)
> **Last Updated:** 2026-06-05

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
  recorded in the same history trail as Layer-A edits.

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
| **Function** | `purgeCache(env, body)` → `POST /zones/{zoneId}/purge_cache` |
| **Capability** | write only: purge **everything**, by **URL list**, or by **cache-tag** |
| **Token / scope** | a Cloudflare API token with **`Zone: Cache Purge`**; a dedicated purge-token override is preferred if set, otherwise the shared analytics token is reused |
| **Unconfigured when** | no purge token, or no zone id |

> Cloudflare **metrics** (requests, cache hit, bandwidth, threats, D1/R2/queue/workers) are *not* read
> by this connector — they come from the shared analytics aggregate (see `providers.ts`). This file is
> purge-only.

### 3.2 Sentry — `sentry-admin.ts`

| | |
|---|---|
| **Provider API** | `https://sentry.io/api/0` |
| **Reads** | `getSentryUsage` (error/transaction stats), `getTopIssues`, `listInboundFilters`, `listClientKeys` |
| **Writes** | `setInboundFilter`, `setKeyRateLimit`, `setSpikeProtection` |
| **Project scope** | each call takes `'cf-admin' | 'cf-astro'` to target the right project |
| **Token / scope** | a Sentry auth token + org; **writes require `project:write`** |
| **Unconfigured when** | token or org missing |

### 3.3 PostHog — `posthog-admin.ts`

| | |
|---|---|
| **Provider API** | `https://us.posthog.com/api` |
| **Reads** | `getPostHogSettings` (recording opt-in, sample rate, autocapture), `getPostHogBilling` |
| **Writes** | `setSessionRecording(optIn, sampleRate)` |
| **Token / scope** | a PostHog **personal API key**; billing reads additionally need the **org id** |
| **Unconfigured when** | personal API key missing (billing: also when org id missing) |

### 3.4 Supabase — `supabase-admin.ts`

| | |
|---|---|
| **Provider API** | `https://api.supabase.com/v1` (Management API) |
| **Function** | `getAdvisors(env, 'security' | 'performance')` → `GET /projects/{ref}/advisors/{type}` |
| **Capability** | read only — advisors. Schema changes stay migration-driven; the control plane never mutates the database. |
| **Token / scope** | a Supabase **Management API PAT**; the project `ref` is derived from the public Supabase URL |
| **Unconfigured when** | access token (PAT) missing |

> Supabase DB/auth **metrics** (size, connections, cache-hit, users, MAU) likewise come from the
> shared analytics aggregate, not this connector.

---

## 4. Token & scope matrix

The preflight `tokenStatus()` check reports which integrations are configured by **presence only** —
it never reads or logs a value. Tokens, by purpose:

| Purpose                                                            | Powers                                  | Required scope                         |
|-------------------------------------------------------------------|-----------------------------------------|----------------------------------------|
| Sentry auth token (+ org)                                         | Sentry metrics + Layer-B               | `project:write` for writes             |
| Cloudflare API token                                              | Cloudflare analytics (read) + purge    | `Zone: Cache Purge` for purge          |
| Dedicated cache-purge token *(optional)*                          | overrides the above for purge only      | `Zone: Cache Purge`                    |
| Supabase service-role key                                        | Supabase metrics + Auth                | service role                           |
| Supabase Management API PAT                                       | Supabase advisors                       | Management API (advisors)              |
| PostHog personal API key                                         | PostHog settings + recording write      | personal API key                       |
| PostHog org id                                                   | PostHog billing reads                   | —                                      |

Exact secret/env-var names are intentionally omitted here; they live in `wrangler.toml` and the
Worker secret store. The Health & Drift panel only shows the **purpose** and a configured/not dot.

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
| **Surface** | the curated, safe actions the UI exposes (e.g. purge, recording toggle, advisors) | the provider's broader API as the MCP server exposes it |
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
3. **Token** registered in `tokenStatus()` (purpose only) so the Health & Drift panel can show it.
4. **Audit** every write through the shared history trail.
5. **UI** renders the write control only for operators who hold the capability, and degrades to the
   `unconfigured` notice otherwise.

---

## 8. Cross-References

- [CONTROL-PLANE.md](./CONTROL-PLANE.md) — the control plane overview: two-layer model, access control, Layer-A config (incl. the route-policy engine), API surface, UI
- [OPERATIONS.md](./OPERATIONS.md) — deploy commands, provider integrations, free-tier limits
- [plac-and-audit.md](./plac-and-audit.md) — PLAC resolution and the audit engine
- [SECURITY.md](./SECURITY.md) — secret handling, CSRF, headers, session model

---
title: "Platform kit research: Cloudflare platform limits and tooling"
status: historical
audience: [owner, ai, technical]
last_verified: 2026-10-18
verified_against: [web-sources]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, research, snapshot]
---

> **Research snapshot, read on 2026-10-18.** Written by a research pass for the platform kit plan ([`01-plan.md`](01-plan.md)). Figures carry their source URL and the date read; anything unverified is marked **GAP**. Paths named here describe other repositories or a proposed design, not files in this repository. Kept as a dated record and not updated in place.

# Cloudflare platform kit — research findings

Date of research: 2026-10-18. Sources are Cloudflare's own docs/changelog unless marked
*(third party)*. Figures that come from docs pages last changed before 2025, or from third
parties, are marked **(may be dated)**. Three items could not be verified and are flagged as
**GAP**. Note: direct page fetches (developers.cloudflare.com, cloudflare.com, docs.astro.build,
hono.dev) failed from this container (DNS `ENOTFOUND`); all Cloudflare facts below come from the
Cloudflare docs search index and web-search snippets of those pages, so each URL should be
opened before a figure is written into a kit document.

---

## 1. Current Cloudflare limits (free vs paid)

### Workers
Source: <https://developers.cloudflare.com/workers/platform/limits/> and
<https://developers.cloudflare.com/workers/platform/pricing/>

| Limit | Free | Paid ($5/mo) |
|---|---|---|
| Requests | 100,000 / day (then Error 1027; a route can be set to fail open or closed) | 10M / mo included, then $0.30 / M |
| CPU time per request | 10 ms | 30 s default, raisable to 300,000 ms via `limits.cpu_ms` (<https://developers.cloudflare.com/changelog/post/2025-03-25-higher-cpu-limits/>); 30M CPU-ms / mo included, then $0.02 / M ms |
| Memory | 128 MB | 128 MB |
| Subrequests per request | 50 (plus 1,000 to Cloudflare services) | 10,000, and per the 2026-02-11 changelog raised toward 10M for Standard (<https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/>) |
| Simultaneous outgoing connections | 6 | 6 |
| Environment variables + secrets | **64 per Worker**, 5 KB each (error code 10055 on overflow) | 128 per Worker |
| Worker size | 64 MiB uncompressed (limits page). **Conflict:** the Workflows limits page still quotes 3 MB / 10 MB script size; treat 64 MiB as the current figure and re-check | same |
| Startup time | 1 s (`wrangler check startup` measures it) | 1 s |
| Workers per account | 100 | 500 |
| Cron triggers | 5 / account | 250 / account |
| Static assets | 20,000 files, 25 MiB each | 100,000 files, 25 MiB each |
| Cache API calls | 50 / request | unlimited-ish, see Workers Cache below |
| Logs | 256 KB / request | same |
| Routes / custom domains | 1,000 routes per zone, 100 custom domains per zone | same |

Other Worker runtime facts that matter for a 10 ms budget:
- The limits page states the **average Worker uses ≈2.2 ms CPU**, and that "auth, SSR,
  large payload parsing typically take 10–20 ms". Occasional overruns are tolerated;
  a Worker that **consistently** exceeds the limit returns **Error 1102** and shows
  `exceededCpu` in the logs (<https://developers.cloudflare.com/workers/platform/limits/>).
- `ctx.waitUntil()` extends the invocation by up to **30 s after the response** is sent
  (<https://developers.cloudflare.com/workers/runtime-apis/context/>). Cron, Queue and Alarm
  handlers have a **15-minute wall-clock** ceiling (limits page). Note: waitUntil work still
  consumes CPU time counted against the invocation.
- **Service bindings**: at most **32 Worker invocations per request**; each counts as a
  subrequest; no extra request charge on Workers Standard
  (<https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/>).

### D1
Sources: <https://developers.cloudflare.com/d1/platform/limits/> ,
<https://developers.cloudflare.com/d1/platform/pricing/>

| | Free | Paid |
|---|---|---|
| Rows read | 5M / day | 25B / mo included, then $0.001 / M |
| Rows written | 100,000 / day | 50M / mo, then $1.00 / M |
| Storage | 5 GB total | 5 GB included, $0.75 / GB-mo |
| Databases per account | 10 | 50,000 |
| Max DB size | 10 GB | 10 GB |
| D1 bindings per Worker | ~5,000 (each binding ~150 B against script size) | same |

- From **2026-09-01** the free-tier daily limits are **hard-enforced with errors**
  (<https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/>).
  This is the single most important change for a free-plan kit: a runaway cron or a
  chatty dashboard can take the whole portal down at midnight-UTC-minus-one.
- **Read replication** (Sessions API: `db.withSession(bookmark)`) is on all plans at no
  extra cost, 6 regions
  (<https://developers.cloudflare.com/d1/best-practices/read-replication/>).
- D1 Worker API latency improved 40–60 % on 2025-01-07 (changelog).
- **GAP:** bound-parameter count, max statement length and max `batch()` size were not
  retrieved; open <https://developers.cloudflare.com/d1/platform/limits/> before quoting.

### KV
Source: <https://developers.cloudflare.com/kv/platform/limits/> ,
<https://developers.cloudflare.com/kv/platform/pricing/>

| | Free | Paid |
|---|---|---|
| Reads | 100,000 / day | 10M / mo, then $0.50 / M |
| Writes | 1,000 / day | 1M / mo, then $5 / M |
| Deletes / Lists | 1,000 / 1,000 per day | 1M / 1M, then $5 / M |
| Storage | 1 GB | 1 GB, then $0.50 / GB-mo |
| Namespaces | 1,000 (raised 2025-01-27) | 1,000 |
| Key / value size | 512 B / 25 MiB | same |
| Ops per invocation | 1,000 | 1,000 |
| Writes per key | 1 / s | 1 / s |

- Eventually consistent: a write may take **up to 60 s** to be globally visible; minimum
  `cacheTtl` 30 s (<https://developers.cloudflare.com/kv/api/write-key-value-pairs/>).
- **1,000 writes/day free is the binding constraint**, not reads: a permission-snapshot
  cache that is rewritten on every login would exhaust it. Write only on permission change.

### R2
Source: <https://developers.cloudflare.com/r2/pricing/>
Free forever: 10 GB-mo storage, 1M Class A ops, 10M Class B ops, **zero egress**. Paid:
$0.015 / GB-mo, $4.50 / M Class A, $0.36 / M Class B.

### Queues
Source: <https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/> ,
<https://developers.cloudflare.com/queues/platform/limits/>
- **Free since 2026-02-04**: 10,000 queues, **10,000 operations / day**, 24 h retention
  (14 days paid). Pull consumer batch ≤ 100, visibility timeout ≤ 12 h.
- Each message is roughly 3 ops (write, read, ack), so ~3,300 messages/day free.

### Durable Objects
Source: <https://developers.cloudflare.com/durable-objects/platform/pricing/>
- **Free since 2025-04-07, SQLite-backed only**: 5M rows read / 100k rows written per day,
  5 GB storage; 10 GB per object. Storage billing on paid began 2026-01-07.

### Workflows
Source: <https://developers.cloudflare.com/workflows/reference/pricing/> ,
<https://developers.cloudflare.com/workflows/reference/limits/>
- Free plan: 10 ms CPU per invocation, **3,000 steps / day**, 1 GB-mo state, 3-day
  retention. Paid: 500k steps / mo, 7-day default retention (2026-09-10 changelog), max steps
  per instance raised 10k → 25k. Cron-like `schedules` on the binding, 100 schedules/account.

### Workers for Platforms / Dynamic Workers
Source: <https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/>
(updated 2026-04-21), <https://developers.cloudflare.com/use-cases/saas/> ,
<https://developers.cloudflare.com/dynamic-workers/pricing/>
- **$25 / mo, requires Workers Paid**: 20M requests, 60M CPU-ms, 1,000 scripts included
  (+$0.02 / script), unlimited scripts in a dispatch namespace, per-customer CPU and
  subrequest limits, ≤ 8 tags per script, `caches.default` disabled in user Workers.
- Dynamic Workers are paid-only too. Neither is free-plan compatible.

### Hyperdrive
Source: <https://developers.cloudflare.com/hyperdrive/platform/limits/> ,
<https://developers.cloudflare.com/hyperdrive/reference/faq/>
- Free since 2025-04-08: 100k queries / day, 10 configs (25 paid), ~20 origin connections
  (~100 paid). Cuts per-query latency to Postgres from 20–30 ms to 1–3 ms when the Worker is
  placed near the origin. Does **not** front D1. Relevant for the Supabase user directory.

### Observability / logs
Sources: <https://developers.cloudflare.com/workers/observability/logs/workers-logs/> ,
<https://developers.cloudflare.com/observability/pricing/>
- Today: free 200k events / day, 3-day retention; paid 20M / mo, 7 days.
- **From 2026-12-01** Observability pricing changes to volume: free **0.5 GB / day, 7-day
  retention**. Logpush stays paid-only.
- Workers Issues (Wrangler ≥ 4.134), production CPU-profiling API, and
  `wrangler check startup` (<https://developers.cloudflare.com/changelog/post/2026-07-31-wrangler-startup-profile-summary/>)
  are the tools for finding what eats the 10 ms.

### Secrets Store
Source: <https://developers.cloudflare.com/secrets-store/manage-secrets/>
- Beta. One store per account, **100 secrets**, 64 KiB each, bound via
  `secrets_store_secrets`, read with async `get()`. Secrets bound this way do **not** count
  against the 64 per-Worker variable cap (they are one binding each, not a variable), but a
  binding still costs script-size bytes. CI token needs the Secrets Store Edit permission.

---

## 2. Multi-client deployment patterns

| Pattern | Free-plan? | Isolation | Ops cost per client | Verdict for the kit |
|---|---|---|---|---|
| **One Cloudflare account per client**, kit deployed from the client's own GitHub repo | Yes (each account gets its own 100k req/day, 10 D1 DBs, 1k KV writes/day) | Total: billing, Access org, data | One `wrangler.toml`, one Workers Builds connection per Worker, one Access org | **Recommended default**. Matches the owner's "blank repo per client" idea and multiplies the free quota by the number of clients. |
| Single account, **shared multi-tenant Worker + shared D1** with `tenant_id` columns | Yes but all tenants share one 100k/day and one 5M reads/day | Logical only (RLS-like discipline in the DAL) | Lowest | Only for a hosted-SaaS pivot; a bug leaks across clients. <https://developers.cloudflare.com/use-cases/saas/data-isolation/> |
| Single account, **one D1 per tenant**, one Worker, binding chosen at runtime | Yes up to 10 DBs free, 50k paid; ~5,000 bindings/script | Physical per tenant | Medium: a migration run per DB | Good middle ground; D1 bindings are static in `wrangler.toml`, so adding a tenant = redeploy. <https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/bindings/> |
| **SQLite Durable Object per tenant** | Yes since 2025-04-07 | Physical per tenant, co-located compute | Low; created on demand with `idFromName(tenant)` | Best for *dynamic* tenants (no redeploy). 10 GB/object. Pattern write-up *(third party)*: <https://boristane.com/blog/durable-objects-database-per-user> |
| **Workers for Platforms** dispatch namespace | **No** ($25/mo + Paid) | Script per tenant, custom limits | Low once paid | Only if the owner later sells hosting; not for the free-plan kit. |
| `wrangler` environments (`[env.clientA]`) in one repo | Yes | Separate Workers and bindings, same account | One block per client | Fine for staging/production inside one client account; **not** for separating clients (shared quota, shared Access org). <https://developers.cloudflare.com/workers/wrangler/environments/> |

Sharding D1 beyond 10 GB with a routing table *(third party)*:
<https://dev.to/araldhafeeri/scaling-your-cloudflare-d1-database-from-the-10-gb-limit-to-tbs-4a16>

Quota arithmetic for "account per client" on free: 100k requests/day across *all* the
client's Workers (admin + public site + email API count together), 5M D1 reads/day, 1k KV
writes/day, 10k Queue ops/day, 5 cron triggers. Today's platform (5 repos) already uses
crons in cf-admin and GitHub Actions for backups; a kit should budget the 5 crons explicitly.

---

## 3. Repo and modularity patterns

### Distribution of the kit

| Option | How updates reach a client repo | Pros | Cons |
|---|---|---|---|
| **Monorepo + private npm packages (`@kit/core`, `@kit/users`...) + `create-kit` scaffolder** | `npm update` in the client repo | Clean versioning, type-safe, modules opt-in by import | Needs a registry (GitHub Packages is free for private within the org); clients can't easily patch internals; Astro pages inside packages need the integration API (below) |
| **Template repo + three-way sync** | A tool merges template changes into the client repo | Clients own and can edit every file | Merge conflicts on edited files; needs discipline. Tools: GitHub "Use this template" has no sync; coopTilleuls/template-sync (<https://github.com/coopTilleuls/template-sync>); agent-native's base-ref three-way merge (<https://www.agent-native.com/docs/syncing-template-changes/>); **Copier** supports updates natively, **cruft** adds updates to cookiecutter (<https://gitlab.developers.cam.ac.uk/uis/devops/webapp-boilerplate/-/issues/89> , <https://python-basics-tutorial.readthedocs.io/en/latest/libs/templating/cruft.html> , <https://www.astronomer.io/blog/standardizing-astro-projects-with-cookiecutter-and-cruft/>) *(all third party)* |
| **Hybrid: thin template repo (wrangler.toml, Access config, docs skeleton) + versioned packages for all code** | packages via npm; template via occasional sync | Most of the code is versioned; the per-client surface is small | Two mechanisms to maintain |

Reference monorepo layout for Workers: `apps/` + `packages/` with pnpm + turbo
(<https://tomevault.io/tome/jahands/workers-monorepo-template/AGENTS>) *(third party)*;
Workers Builds supports monorepos with a per-Worker root directory, watch paths and build
caching, and `turbo deploy -F <app>` (<https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/>).

### Module system models worth copying *(third party)*
- **Medusa v2**: each module owns its tables and a service; cross-module relations via
  "module links"; orchestration via workflows with compensation steps
  (<https://docs.medusajs.com/v2/architectural-modules> ,
  <https://www.buildwithmatija.com/blog/medusa-architecture-explained-developers-guide>).
  Maps well to "users module owns `users`, email module owns `email_outbox`, a link table joins".
- **Payload / Directus plugins**: a plugin is a function `(config) => config` that adds
  collections, hooks and admin UI (<https://payloadcms.com/compare/directus> ,
  <https://glukhov.org/post/2025/11/headless-cms-comparison-strapi-directus-payload/>).

### Astro integrations vs Hono vs both
- **Astro Integration API** (<https://docs.astro.build/en/reference/integrations-reference/>):
  in `astro:config:setup` an integration can `injectRoute({ pattern, entrypoint })`,
  `addMiddleware({ entrypoint, order: 'pre' | 'post' })`, `updateConfig()`, `setAdapter()`;
  `astro:routes:resolved` lists final routes. This is exactly a "module = integration" model:
  `@kit/users` ships its own `.astro` pages, API routes and middleware, enabled by one line in
  `astro.config.mjs`.
- **Hono** (<https://hono.dev/api/hono>): `app.route('/users', usersApp)`, `basePath()`,
  `mount()` compose sub-apps; trivial per-module routers, tiny bundle, JSX SSR available.
- **Astro + Hono**: Astro renders the HTML screens (islands), Hono handles `/api/*` via
  Static Assets `run_worker_first` or an Astro catch-all route. Astro guide for Workers:
  <https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/>
- **No public Astro-vs-Hono CPU benchmark on Workers was found (GAP)**; the only hard
  number is Cloudflare's own "SSR typically 10–20 ms" caution above. Measure the current
  cf-admin with `wrangler check startup` and the CPU profiler before choosing.

---

## 4. Staying under 10 ms CPU

Facts with sources:
1. Cloudflare's own guidance: avg Worker 2.2 ms; auth + SSR + payload parsing 10–20 ms
   (<https://developers.cloudflare.com/workers/platform/limits/>). Consistent overrun = 1102.
2. **I/O does not count**: D1, KV, fetch wait time is wall time, not CPU. What costs CPU is
   JSON parsing, HTML string building, crypto, big dependency init.
3. **Startup counts separately** (1 s limit) but a heavy bundle also slows every isolate
   cold start; `wrangler check startup` prints a startup CPU profile summary
   (<https://developers.cloudflare.com/changelog/post/2026-07-31-wrangler-startup-profile-summary/>).
4. **JWT verification**: Cloudflare Access signs with RS256; verification through WebCrypto
   (`jose` `createRemoteJWKSet`) is sub-millisecond-to-low-ms. A vendor benchmark on Workers
   quotes Ed25519 WASM 0.20 ms vs jose WebCrypto 0.30 ms *(third party, vendor)*:
   <https://docs.rs/crate/authia/latest> . The expensive part is fetching the JWKS; cache it in
   memory per isolate and in KV (<https://mojoauth.com/blog/edge-authentication-jwt-cloudflare-workers-lambda-edge>) *(third party)*.
   For the kit's own session tokens HS256 (HMAC) is the cheapest to verify and sign.
5. **Prefer `ctx.access.getIdentity()`** on Access-protected Workers (2026-08-14): the
   runtime has already verified the JWT; the Worker does no crypto at all
   (<https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/>).
6. **Permission snapshots in KV**: one `get()` with `cacheTtl` ≥ 30 s instead of several D1
   rows per request; write only on change because of 1,000 writes/day
   (<https://developers.cloudflare.com/kv/platform/limits/>). Accept ≤ 60 s staleness, or keep
   a "permissions version" in the session and re-read on mismatch.
7. **Workers Cache** (new, <https://developers.cloudflare.com/workers/cache/>): runs *before*
   the Worker, tiered, with request collapsing; enabled with `cache: { enabled: true }` on an
   `exports` entrypoint; `ctx.props` can be part of the key. Cache hits bill a request but
   **no CPU**. The documented *authenticated-caching* pattern: default entrypoint checks auth,
   then forwards to a cached named entrypoint. The old Cache API is not tiered and is **not
   available for Workers fronted by Access**
   (<https://developers.cloudflare.com/workers/runtime-apis/cache/>).
8. **D1 Sessions API** read replicas cut latency not CPU; batching with `db.batch()` cuts
   the per-statement overhead and rows-read accounting
   (<https://developers.cloudflare.com/d1/best-practices/read-replication/>).
9. **Move work off the request path**: `ctx.waitUntil()` for audit rows and email enqueue
   (still CPU-counted), Queues (free, 10k ops/day) for email and webhooks, Workflows (free,
   3k steps/day) for multi-step jobs like backups, cron for periodic checks (5 free).
10. **Smart Placement / explicit hints**: `placement = { mode = "smart" }` on all plans and,
    since 2026-01-22, `region`/`host` hints
    (<https://developers.cloudflare.com/changelog/post/2026-01-22-explicit-placement-hints/>).
    Helps a Worker that makes several round trips to Supabase (us-east) — latency, not CPU.
    Caution: with `run_worker_first` Static Assets, placement also moves asset responses.
11. **Hyperdrive** for Supabase Postgres (free, 100k queries/day): 1–3 ms per query when
    placed near the origin (<https://developers.cloudflare.com/hyperdrive/reference/faq/>).
12. **Islands discipline**: Preact islands with `client:idle`/`client:visible` keep SSR to
    HTML strings; avoid rendering large tables server-side with per-row components.
13. **Measure**: DevTools CPU profiling in `wrangler dev`
    (<https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/>) and the
    production CPU-profiling API / Workers Issues (Wrangler ≥ 4.134).

---

## 5. Zero Trust (Access) as the identity front door

- **Access for Workers** (GA 2026-08-14, <https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/> ,
  <https://developers.cloudflare.com/workers/configuration/cloudflare-access/>): protect one
  Worker or all Workers in an account; read the verified identity with
  `ctx.access.getIdentity()`; `access.dev` block in `wrangler.toml` simulates a user
  locally; API `POST /accounts/{id}/access/apps` with `destinations` of type
  `worker | preview_worker | all_workers | all_preview_workers`. Limitations: no WebSockets
  through it, and `ctx.access` is **not available when the request is served by Static
  Assets** (so protect HTML routes through the Worker, or use the JWT header path).
- **Manual JWT path** (any plan): header `Cf-Access-Jwt-Assertion` (or cookie
  `CF_Authorization`); verify with `jose` against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`,
  audience = the app's AUD tag
  (<https://developers.cloudflare.com/changelog/post/2025-10-03-one-click-access-for-workers/> ,
  <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/>).
  Custom claims are trimmed to ~1 KB; group claims only if configured; the full identity is
  at `/cdn-cgi/access/get-identity`.
- **Identity providers** (<https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/>):
  One-time PIN (`type: onetimepin`; new orgs default to the Cloudflare-managed IdP), Google,
  GitHub, Microsoft Entra, Okta, generic OIDC and SAML. OTP alone is enough for a small
  client with no IdP.
- **Reusable policies** (2025-12-03): one policy object attached to many apps
  (<https://developers.cloudflare.com/changelog/post/2025-12-03-reusable-access-policies/>) —
  the kit can ship "staff", "owner", "service" policies once per account.
- **Service tokens**: `CF-Access-Client-Id` / `CF-Access-Client-Secret`; new tokens use the
  `cfast_` prefix since 2026-08-26; policies use the Service Auth action / `non_identity`
  (<https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/>).
  Use for GitHub Actions → portal API calls (backup notifications, deploy hooks).
- **Access for SaaS** (<https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/saas-apps/generic-oidc-saas/>):
  Access acts as an OIDC/SAML provider for other apps — useful if a client app outside
  Workers must share the same login.
- **Seats**: Zero Trust Free is widely described as **50 users**, but the plans page
  (<https://www.cloudflare.com/plans/zero-trust-services/>) was unreachable and the docs search
  returned nothing — **GAP, verify before quoting**. Access also charges per seat on paid
  plans; a kit for small clients should keep staff well under 50.
- **Automation objects** (API and Terraform `cloudflare` provider ≥ 5):
  `/accounts/{id}/access/organizations` (team domain, login design),
  `/access/identity_providers`, `/access/groups`, `/access/policies` (with `make_reusable`),
  `/access/apps` (self-hosted, SaaS, Worker destinations), `/access/service_tokens`;
  Terraform: `cloudflare_zero_trust_access_application`, `_policy`, `_identity_provider`,
  `_service_token`, `_group`
  (<https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/> ,
  <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/policy-management/>).
  API-token permissions needed: "Access: Apps and Policies Write", "Access: Organizations,
  Identity Providers, and Groups Write", "Access: Service Tokens Write".
- Pattern for the kit: Access = authentication (who), the kit's D1 `permissions` module =
  authorisation (what). Session rows keyed by the Access `sub`/email; on each request read
  identity from `ctx.access` (or JWT), then a KV permission snapshot.

---

## 6. Official tooling as of 2026

- **Wrangler environments**: `[env.<name>]` blocks; bindings are **not inherited** and must
  be repeated; `CLOUDFLARE_ENV` selects the env for the Vite plugin; `.env.<env>` files are
  read (<https://developers.cloudflare.com/workers/wrangler/environments/>).
- **Multi-Worker local dev**: `wrangler dev -c admin/wrangler.toml -c email/wrangler.toml`
  (2025-09-23, <https://developers.cloudflare.com/workers/local-development/multi-workers/>);
  Vite plugin equivalent `auxiliaryWorkers`. Service bindings resolve locally.
- **Auto-provisioning**: `wrangler deploy` creates KV, R2, D1, Queues and dispatch
  namespaces declared without IDs — removes the "invent a binding UUID" failure mode the
  owner's rules fight today (same environments page / wrangler docs).
- **`wrangler types`**: generates for **all environments by default** since 2026-01-13,
  `--check` for CI, multiple `-c` for cross-Worker RPC types
  (<https://developers.cloudflare.com/changelog/post/2026-01-13-wrangler-types-multi-environment/>).
- **`wrangler check startup`** (2026-07-31) and **`wrangler preview --name`** for
  preview Workers.
- **Workers Builds**: Git-connected deploys with monorepo root dir, watch paths, caching;
  one connection per Worker (<https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/>).
  It runs no tests of its own, which is why the owner's repos make `npm run verify` the gate.
- **D1 migrations**: `wrangler d1 migrations create|list|apply --remote`; the deploy path
  does not apply them unless the build command does (owner's repos already encode this).
- **Static Assets**: `run_worker_first` accepts path arrays and negations since Wrangler
  4.20 (<https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>);
  `ctx.access` unavailable on asset-served responses (section 5).
- **Vite plugin** (`@cloudflare/vite-plugin`) is the recommended dev path for frameworks;
  Astro's adapter sits on it (<https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/>).
- **Observability**: Workers Logs, Workers Issues, CPU profiling API; pricing change
  2026-12-01 (section 1).
- **Secrets Store** (beta): account-level secrets shared by many Workers (section 1).
- Timeline of 2025–2026 changes that matter: higher CPU limits (2025-03), DO free
  (2025-04), Hyperdrive free (2025-04), multi-config dev (2025-09), one-click Access for
  Workers (2025-10), reusable Access policies (2025-12), storage billing for DO (2026-01),
  wrangler types multi-env (2026-01), explicit placement hints (2026-01), Queues free
  (2026-02), subrequest limit raise (2026-02), WfP pricing update (2026-04), startup
  profile (2026-07), Access for Workers GA + ctx.access (2026-08), service token format
  (2026-08), D1 free-tier hard enforcement (2026-09), Workflows retention (2026-09),
  Observability pricing (2026-12).

---

## What this means for the kit (one page)

1. **One Cloudflare account per client, one kit repo per client.** Each account gets its own
   100k req/day, 5M D1 reads, 1k KV writes, 10 D1 DBs, 5 crons — free quota scales with
   clients (<https://developers.cloudflare.com/workers/platform/limits/>). Workers for
   Platforms is $25/mo + Paid and is not the answer here
   (<https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/>).
2. **Ship code as versioned private packages (`@kit/*`) plus a thin template repo.** The
   template holds `wrangler.toml`, the Access bootstrap script and the docs skeleton;
   everything else is `npm update`. Template drift is the known failure of pure
   template-repo approaches (<https://www.agent-native.com/docs/syncing-template-changes/>).
3. **Make each module an Astro integration** that `injectRoute`s its pages/API and
   `addMiddleware`s its guards (<https://docs.astro.build/en/reference/integrations-reference/>);
   `/api/*` can be a Hono sub-app per module (`app.route`, <https://hono.dev/api/hono>). The
   client's `astro.config.mjs` lists the modules it bought.
4. **Treat 10 ms as a hard budget with a ratchet, not a hope.** Cloudflare says SSR+auth is
   typically 10–20 ms (limits page). Add `wrangler check startup` to `verify`, and a CPU
   p95 check from the Workers Logs / profiling API; consistent overrun = Error 1102.
5. **Let Access do the crypto.** Put every Worker behind Access and read
   `ctx.access.getIdentity()` (<https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/>);
   keep the `jose` + JWKS path only for asset-served pages and non-Worker callers.
6. **Permissions = one KV read per request, written only on change.** 100k reads/day vs
   1,000 writes/day free (<https://developers.cloudflare.com/kv/platform/limits/>); carry a
   permissions version in the session to tolerate the ≤ 60 s propagation.
7. **Budget D1 rows read per screen.** Hard enforcement since 2026-09-01
   (<https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/>);
   the health/debugging module should show the day's rows read/written against 5M/100k.
8. **Email, webhooks and audit fan-out go through Queues** (free since 2026-02-04, 10k
   ops/day, <https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/>);
   backups and other multi-step jobs through Workflows (3k steps/day free,
   <https://developers.cloudflare.com/workflows/reference/pricing/>) rather than hand-rolled
   cron state. Keep GitHub Actions for the heavy `age`-encrypted dumps (no CPU limit there).
9. **Use Workers Cache's authenticated-caching pattern** for read-mostly dashboard
   fragments: cache hits cost zero CPU (<https://developers.cloudflare.com/workers/cache/>).
   Do not rely on the legacy Cache API behind Access
   (<https://developers.cloudflare.com/workers/runtime-apis/cache/>).
10. **Settings in D1, secrets in Secrets Store, zero `[vars]` growth.** The 64-variable cap
    is real (limits page); Secrets Store bindings (100/account,
    <https://developers.cloudflare.com/secrets-store/manage-secrets/>) let one secret serve
    several Workers.
11. **Bootstrap Access by API/Terraform from the kit's setup script**: organization,
    OTP + optional Google/GitHub IdP, reusable "staff"/"owner" policies, one app per
    Worker destination, one service token for CI
    (<https://developers.cloudflare.com/cloudflare-one/access-controls/policies/policy-management/>).
    Verify the free seat limit before promising it to a client (**GAP**).
12. **Use `wrangler` auto-provisioning and `wrangler types --check` in CI** so a new client
    repo never needs a hand-pasted UUID
    (<https://developers.cloudflare.com/workers/wrangler/environments/> ,
    <https://developers.cloudflare.com/changelog/post/2026-01-13-wrangler-types-multi-environment/>).
13. **Supabase stays only if a client needs Postgres**; route it through Hyperdrive (free,
    100k queries/day, <https://developers.cloudflare.com/hyperdrive/platform/limits/>) and
    place the Worker near it. For most small clients D1 + Access covers users and sessions.
14. **Plan for 2026-12-01 Observability pricing** (0.5 GB/day free, 7 days,
    <https://developers.cloudflare.com/observability/pricing/>): the health module should
    sample logs, not log every request.
15. **Optional per-tenant growth path**: if a client later wants sub-tenants, use SQLite
    Durable Objects per tenant (free, 10 GB each,
    <https://developers.cloudflare.com/durable-objects/platform/pricing/>) instead of new D1
    bindings, which need a redeploy.

### Open gaps to close before writing kit docs
- Zero Trust free seat count (50?) — plans page unreachable.
- D1 bound-parameter / statement / batch limits — not retrieved.
- Worker script size: 64 MiB (limits page) vs 3/10 MB (Workflows page) — confirm.
- No published Astro-vs-Hono CPU benchmark on Workers — measure the current cf-admin.

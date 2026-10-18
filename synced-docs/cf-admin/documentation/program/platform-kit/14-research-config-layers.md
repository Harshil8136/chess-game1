---
title: "Platform kit research: configuration layers and the fast read path"
status: historical
audience: [owner, ai, technical]
last_verified: 2026-10-18
verified_against: [web-sources]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, research, snapshot]
---

> **Research snapshot, read on 2026-10-18.** Written by a research pass for the platform kit plan ([`01-plan.md`](01-plan.md)). Figures carry their source URL and the date read; anything unverified is marked **GAP**. Paths named here describe other repositories or a proposed design, not files in this repository. Kept as a dated record and not updated in place.

# Configuration layers for the platform kit: research findings

Research topic: `global_config` / `client_config` / `system_config` for a one-Worker-per-client admin
portal on Cloudflare (Astro 7 SSR + Preact islands, Hono `/api/*`, D1, KV, R2, Queues, Cloudflare
Access, free plan by default).

Method: read-only web research (Cloudflare docs through the docs MCP tool and direct fetches, Astro
docs, library docs, vendor docs, one local Node benchmark). No repository file and no live system was
touched. Every figure carries its URL and the date it was read (all read **2026-10-18**). Anything
that could not be verified is marked **GAP** with what to check.

---

## 1. Summary (10 lines)

1. Use **four** layers, not three: kit defaults (code) → `client_config` (build-time, per deployment)
   → `system_config` (runtime, D1) → secrets (never in config). Later layers win, but only for keys
   whose definition says they are runtime-editable.
2. "dev.vars JSON in prod" is a misunderstanding: `.dev.vars` is local-development only. The real
   production equivalents are `[vars]` JSON objects (≤5 KB each, 64 per Worker on free) and
   `wrangler secret bulk` JSON. Both need a deploy to change.
3. A value read on every request must come from **isolate memory**. Nothing else is free at
   100k requests/day: KV's 100k reads/day and Durable Objects' 100k requests/day both run out at
   exactly that volume.
4. Recommended read path: **D1 is the truth, one versioned KV snapshot key is the distribution
   layer, a module-scope memory cache (TTL 30–60 s) is the hot path, `ctx.waitUntil` refreshes.**
   At 100k req/day this costs a few thousand KV reads, not 100k, and D1 is read only when someone
   saves.
5. `JSON.parse` of a 53 KB snapshot took **0.33 ms** in Node 22 on this container (not Workers).
   Parsing is not the CPU problem; running a schema validator on every request would be. Validate at
   write time and at cache fill, never per request.
6. Classic KV propagation is "up to 60 s" (eventual). Admin read-your-writes needs a trick (a version
   cookie that sends the admin to D1 for ≤60 s), or **KV Instant** (private beta: p99 reads 1.62 ms,
   replication p99 256 ms) once it opens.
7. The Cache API is **not available for Workers behind Cloudflare Access** (official limitation). The
   new Workers Caching (`ctx.cache`) is a different feature and not a config store.
8. Validation: **Zod 4 Mini** (3.9–6.9 kB) with `.meta()` and `z.toJSONSchema()` gives one definition
   → TypeScript type, runtime check, JSON Schema, Settings form, docs page and an AI-readable
   catalogue. Valibot is smaller; TypeBox is JSON-Schema-native but not Standard Schema.
9. Per-client identity is a **build artefact**: one Worker per client account, `client.config.ts`
   committed in the client repo, a `custom_domain = true` route, an Access application per hostname.
   Page names become data through a `routes` map + one catch-all SSR route + `Astro.rewrite()`; module
   URLs stay fixed.
10. Four decision cards for the owner (section 8): where runtime truth lives, how fresh a save must
    be, how custom page names work, and how vendor-wide ("global") config reaches every client.

---

## 2. Layer model

### 2.1 The four layers

| Layer | Owner | Lives in | Changed by | When it takes effect | Examples |
|---|---|---|---|---|---|
| **L0 kit defaults** ("global_config" in the owner's words) | Vendor | Kit source code, shipped inside the Worker bundle | Kit release (`git push` → deploy) | Next deploy | Every key's default value, min/max, label, description, who may edit it |
| **L1 client_config** (per deployment, boot-time) | Vendor at onboarding; client never edits | `client.config.ts` in the client repo, bundled; a handful mirrored to `[vars]` for cross-checks | Commit in client repo → deploy | Next deploy | Display name, canonical hostname, locales, timezone, enabled modules, branding tokens, page slugs/nav labels, Access AUD |
| **L2 system_config** (runtime-editable) | Client admins, within bounds set by L0/L1 | D1 table (truth) → KV snapshot → isolate memory | Settings page / API, with audit row | ≤60 s everywhere; instantly for the saver (section 4.4) | Toggles, limits, thresholds, provider choice (Brevo vs Resend), retention days, alert recipients |
| **L3 secrets** | Vendor or client owner | `wrangler secret` (Worker secret) or Secrets Store binding | `wrangler secret put` / Secrets Store UI or API | Secret changes do not need a code deploy | Provider API keys, signing keys, tokens |

Precedence for a key: **L2 over L1 over L0**, but a definition can mark a key `locked` (only L1/L0 may
set it: hostname, client id, Access AUD) so no runtime write can override it. L3 is never merged into
the config object; config may hold *which* provider is selected, never its key.

**Boot-time constants vs runtime-editable.** Boot-time = anything needed before the first KV/D1
read succeeds, or that must not change without a deploy: client id, hostname, Access AUD, default
locale, the branding needed to render an error page, the list of enabled modules (because it decides
which routes exist). Runtime-editable = anything a client admin may reasonably change on a Tuesday
afternoon without the vendor: toggles, limits, thresholds, texts, recipients, provider choice.

**Where "global_config" goes.** With one Worker per client account there is no store shared across
clients. Vendor-wide settings therefore reach clients either as kit defaults in a release, or by the
vendor editing each client's L2 through the admin API. A vendor-hosted endpoint that every client
Worker polls would be a new outside service (Golden Rule 6 territory) and is a decision card
(section 8, card 4).

### 2.2 How mature systems do it (what to borrow)

| System | Pattern | Source (read 2026-10-18) | Borrow? |
|---|---|---|---|
| 12-factor | Config in the environment, strict separation from code; no grouping into "environments" | <https://12factor.net/config> | Yes for secrets and deploy-time identity (L1/L3). No for runtime settings: 12-factor predates edge runtimes where env is immutable per deploy |
| Spring Boot | A fixed 15-level precedence order (defaults → properties files → profiles → env vars → command line) | <https://docs.spring.io/spring-boot/reference/features/external-config.html> | Yes: an explicit, documented precedence list, written once |
| Rails credentials | Encrypted credentials file in repo + master key outside it | **GAP**: the Rails guide fetch returned the Security guide, not the credentials guide; description from general knowledge | Partly: "encrypted config in repo, key elsewhere" maps to Secrets Store, not to our config |
| Vercel Edge Config (now "Global Config") | One read-optimised store per project, ≤1 MB, propagation ≤10 s, reads "under 15 ms p99, often <1 ms", backups 7/90/365 days by plan | <https://vercel.com/docs/edge-config-limits> | Yes in shape: one small snapshot, read-optimised, versioned with backups. This is exactly the KV-snapshot layer |
| LaunchDarkly | Flags pushed into **Workers KV** by an integration; Worker reads KV locally | <https://launchdarkly.com/docs/integrations/cloudflare> | Confirms "push a snapshot into KV, read it locally" is the industry pattern on Cloudflare |
| Unleash Edge | In-memory cache in front of the API, polling or streaming, serves last cache when upstream is down | <https://docs.getunleash.io/unleash-edge> | Yes: "serve the last good snapshot when the source is down" |
| Flagsmith Edge Proxy | Polls every 10 s, local evaluation, ~2,000 RPS at ~7 ms, default flags as fallback | <https://docs.flagsmith.com/performance/edge-proxy> | Yes: short polling interval + defaults fallback |
| OpenFeature | Vendor-neutral flag evaluation API: typed getters (`getBooleanValue`, `getStringValue`, `getNumberValue`, `getObjectValue`) with a default, `*Details` variants returning `value`, `variant`, `reason`, `errorCode`; providers; hooks; evaluation context | **GAP**: `openfeature.dev` did not resolve through the proxy (Exa: CRAWL_NOT_FOUND; WebFetch: ENOTFOUND). Shape described from general knowledge; exact spec requirement numbers unverified | Borrow the **shape**, not the SDK (below) |
| Shopify / Stripe per-tenant | Per-shop / per-account settings objects, exposed through a settings API with audit | **GAP**: not fetched in this session | Audit on every change; settings API, not direct table edits |

**OpenFeature verdict.** Adopt the *evaluation API shape*: a typed getter that always has a default,
plus a `details()` form that says where the value came from (`default`, `client`, `system`) and how
fresh it is (`fresh`, `stale`, `fallback`). Do **not** adopt the OpenFeature SDK: it is built around
per-user targeting context and a provider ecosystem, neither of which has a D1/KV provider; it adds
bundle weight; and its server SDK targets Node (Workers compatibility: **GAP**). A ~60-line in-house
`config.get()` with the same vocabulary gives the benefit without the machinery.

Illustrative shape (self-written):

```ts
const v = config.get("email.provider");            // "brevo" | "resend", typed from the definition
const d = config.details("email.daily_limit");    // { value: 500, source: "system", version: 42, freshness: "fresh" }
```

---

## 3. Store comparison on Cloudflare

Limits below are the official figures. "Per 1,000 page requests" assumes one config read per request
with no isolate cache, to show why the cache is mandatory.

| Store | Read latency | Consistency / propagation | Free quota cost per 1,000 page requests | CPU to read + parse | Size limits | When it is down | Fit |
|---|---|---|---|---|---|---|---|
| **(a) `[vars]` in `wrangler.toml`** (strings or JSON objects) | In-memory, ~0 | Changes only by deploy; `vars` are **non-inheritable** per `[env.*]` | 0 | ~0 (already an object) | **5 KB per var, 64 vars free / 128 paid** (errors 10054/10055) <https://developers.cloudflare.com/workers/platform/limits/> | Cannot be down | Good for a few boot-time identity values. Not for the whole client_config (5 KB cap, deploy to change) |
| **(b) bundled JSON/TS module** (`client.config.ts`) | In-memory, ~0 | Changes by deploy | 0 | ~0 | Worker bundle **64 MiB uncompressed**, no compressed limit <https://developers.cloudflare.com/workers/platform/limits/> | Cannot be down | **Best home for L0 and L1**: typed, versioned in git, zero runtime cost |
| **(c) Workers Static Assets** (`env.ASSETS.fetch(new URL("https://assets.local/config.json"))`) | One internal fetch per read (ms-range, **GAP** exact) | Changes by deploy | Static asset requests are free and unlimited (pricing footnote) <https://developers.cloudflare.com/workers/platform/pricing/> ; whether a binding fetch counts toward the 50 subrequests/request: **GAP** | fetch + `JSON.parse` | 20,000 files, 25 MiB each (free) <https://developers.cloudflare.com/workers/platform/limits/> | Cannot be down independently of the Worker | No advantage over (b) for config; useful only if a non-code process must edit a JSON file at build time |
| **(d) KV, one snapshot key** | Hottest keys (<100 KB) served from in-memory per colo "<1 ms"; p90 of KV Workers "<12 ms" <https://blog.cloudflare.com/faster-workers-kv/> (2024-09-26); 2025-08-22 changelog: p95 ~150→~50 ms, p99 ~350→~250 ms for cold/regional reads <https://developers.cloudflare.com/changelog/> | **Eventual, up to 60 s** (longer if `cacheTtl` is higher); `cacheTtl` min 30 s (changelog 2026-01-30), default 60 s <https://developers.cloudflare.com/kv/api/read-key-value-pairs/> ; 1 write/s per key | **1,000 reads = 1% of 100k/day** → 100k req/day without cache = 100% <https://developers.cloudflare.com/kv/platform/limits/> ; 1,000 writes/day | `JSON.parse` of the blob (≈0.3 ms at 53 KB, section 4.3) | Key 512 B, value 25 MiB, metadata 1,024 B, 1,000 ops/invocation <https://developers.cloudflare.com/kv/platform/limits/> | Reads fail → must fall back to isolate copy or defaults | **Best distribution layer** for L2, behind an isolate cache |
| **(d') KV Instant** (private beta) | **p99 1.62 ms** vs classic cached p99 160 ms / all 287 ms <https://blog.cloudflare.com/workers-kv-instant/> (2026-10-01) | Write replication median 107 ms, p95 181 ms, **p99 256 ms** (classic p99 4.38 s) | Same read/write quota model as KV: **GAP** (beta pricing not stated) | same | **1 MB per namespace, 10,000 keys, 300 B key, no metadata**, 1 write/s <https://blog.cloudflare.com/workers-kv-instant/> | same | Docs describe its target as "small, read-heavy application configuration values that update infrequently": the ideal future home. Create with `--experimental-mode instant` once admitted |
| **(e) D1, row per key** (`admin_portal_settings` style) | Indexed point read "<1 ms" inside D1 <https://developers.cloudflare.com/d1/platform/limits/> ; round trip from Worker to the DB's location adds **GAP** (not published); read replication beta reduces it | Strong (single primary); replicas eventual, Sessions API gives bookmarks | **Rows read = rows scanned.** 400 rows × 1,000 requests = 400,000 of 5M/day → quota exhausted at ~12,500 req/day <https://developers.cloudflare.com/d1/platform/pricing/> ; 100k rows written/day; 50 queries/invocation free | Query + object assembly | 500 MB per DB, 10 DBs, 100 KB statement, 100 params <https://developers.cloudflare.com/d1/platform/limits/> | Queries **fail** at the daily limit since 2026-09-01 (changelog) | **Best truth store** (audit, history, Time Travel 7 d free / 30 d paid). Never the per-request read path |
| **(e') D1, one JSON document row** | as above | as above | 1,000 rows read per 1,000 requests (0.02% of quota); but one network round trip per request | `JSON.parse` | Row ≤2 MB | as above | Acceptable as truth; loses per-key history unless history is a separate table |
| **(f) In-isolate memory cache** (module scope / `globalThis`) | ~0 | Per isolate; isolates "are not necessarily long-lived", evicted on redeploy, memory pressure, inactivity, Worker runtime updates <https://developers.cloudflare.com/workers/reference/how-workers-works/> ; a binding-only change may **reuse** isolates, so derived globals go stale <https://developers.cloudflare.com/workers/runtime-apis/bindings/> | 0 | 0 | 128 MB per isolate <https://developers.cloudflare.com/workers/platform/limits/> | Lost silently on eviction → design for a cold fill on every request | **Mandatory hot path.** Official errors page shows the sanctioned `let cachedData` pattern; lifetime figure: **GAP** (none published) |
| **(g) Cache API** (`caches.default`) | ms-range per colo | Per data centre only, no tiered cache | 50 cache calls/request free | — | — | — | **Unavailable: "For Workers fronted by Cloudflare Access, the Cache API is not currently available"** <https://developers.cloudflare.com/workers/runtime-apis/cache/> . The new Workers Caching (`[cache] enabled = true`, wrangler ≥4.69.0, `ctx.cache`) is a read-through response cache that bypasses on `Authorization`/`Set-Cookie`, not a config store <https://developers.cloudflare.com/workers/cache/> |
| **(h) Durable Object (SQLite) as config broker** | One RPC per read (single global location) | Strong, single writer | **1,000 DO requests per 1,000 page requests → 100k/day free = 100% at 100k req/day** <https://developers.cloudflare.com/durable-objects/platform/pricing/> ; 13,000 GB-s/day | RPC + parse | 5M rows read / 100k written per day; 10 GB per object | Hibernates after 10 s idle, evicted after 70–140 s <https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/> | Good as a **write serialiser / version counter**, not as a per-request read |
| **(i) Secrets Store** (beta) | `await env.X.get()` per call; latency **GAP** | Account-level, no deploy to rotate | **GAP** (no quota published) | async get | **100 secrets per account, one store, ≤65,536 bytes each** <https://developers.cloudflare.com/secrets-store/manage-secrets/> ; binding `[[secrets_store_secrets]] binding/store_id/secret_name`, scope `workers` <https://developers.cloudflare.com/secrets-store/integrations/workers/> | `get()` fails → provider call fails | L3 only. Whether a Secrets Store binding counts toward the 64-var cap: **GAP** (test by deploying a Worker at 63 vars + 2 bindings, or ask support). Local dev cannot read production secrets |

**`astro:env` fit.** Astro's typed schema (`envField.string/number/boolean/enum`, `context: "server" |
"client"`, `access: "public" | "secret"`, `astro:env/server`, `getSecret()`) validates environment
variables at build/start <https://docs.astro.build/en/guides/environment-variables/> , and the
Cloudflare adapter is "compatible with the astro:env API" reading from `cloudflare:workers`
<https://docs.astro.build/en/guides/integrations-guide/cloudflare/> . It supports only four scalar types,
so it fits the handful of **L1 scalars mirrored into `[vars]`** (client id, hostname, Access AUD), not
nested client_config and not L2. Keep the full L1 in a typed TS module and use `astro:env` only as a
boot-time guard that the `[vars]` match the bundle (section 6.1).

**On "dev.vars JSON in prod".** `.dev.vars` and `.env` are read by `wrangler dev` only
<https://developers.cloudflare.com/workers/configuration/environment-variables/> . Production has three
JSON-ish mechanisms, all deploy-bound: `[vars]` may hold a JSON object (`[vars.SERVICE_X_DATA]`
example in the docs, 5 KB cap), `wrangler secret bulk` takes a JSON file of up to 100 operations with
`null` to delete (changelog 2026-06-03), and `wrangler deploy --secrets-file` / `--keep-vars` manage
secrets alongside a deploy. `secrets.required` in the config declares which secrets must exist
(changelog 2026-03-24). None of these is a runtime config store.

---

## 4. Recommended read path

### 4.1 Diagram

```mermaid
sequenceDiagram
    participant R as Request
    participant M as Isolate memory (L0+L1 bundled, L2 cache)
    participant KV as KV snapshot key (config:v)
    participant D1 as D1 settings table (truth)
    R->>M: config.get(key)
    alt cache fresh (age < TTL)
        M-->>R: value (0 ms)
    else cache stale or empty
        alt stale copy exists
            M-->>R: stale value now
            M->>KV: ctx.waitUntil(getWithMetadata)
        else cold isolate
            M->>KV: await getWithMetadata (hot: <1–12 ms)
            KV-->>M: {snapshot, metadata.version}
            M-->>R: value
        end
    end
    Note over M,KV: KV read fails or snapshot invalid → keep last good copy, else L0+L1 defaults; log; waitUntil rebuild
    Note over D1,KV: On save: D1 write + history row → rebuild snapshot → KV put (1 write) → in-isolate update → response carries version
```

### 4.2 Quantified cost (free plan, 400 setting rows, ~50 KB snapshot)

Assumptions: isolate cache TTL 60 s; the portal is used from one or two regions, so a handful of
isolates are warm at any time (count: **GAP**, Cloudflare publishes none; measure with a
`CF_VERSION_METADATA`-tagged counter). Each warm isolate refreshes at most once per TTL
(86,400 / 60 = 1,440 reads/day). A cold isolate reads once on its first request.

| Traffic | KV reads/day (no isolate cache) | KV reads/day (with 60 s isolate cache) | D1 rows read/day | KV writes/day |
|---|---|---|---|---|
| 1,000 req/day | 1,000 (1% of quota) | ≤1,000; realistically far fewer since many requests hit a warm isolate | 400 × saves | 1 per save |
| 10,000 req/day | 10,000 (10%) | ≈ warm isolates × 1,440; with 3 isolates ≈ 4,300 (4%) | 400 × saves | 1 per save |
| 100,000 req/day | **100,000 (100%: quota exhausted)** | ≈ 4,300–7,200 with 3–5 isolates (4–7%) | 400 × saves | 1 per save |

KV quotas: 100,000 reads, 1,000 writes per day <https://developers.cloudflare.com/kv/platform/limits/> .
D1 quota: 5,000,000 rows read per day <https://developers.cloudflare.com/d1/platform/pricing/> . With
10 saves/day D1 reads for config are ~4,000 rows (0.08%).

Put the version in the KV **metadata** (≤1,024 B) of the one snapshot key and read with
`getWithMetadata`: one KV write per save, one KV read per refresh, no second "version pointer" key.

### 4.3 Added latency and CPU

- Warm isolate, fresh cache: no I/O; a property lookup. CPU ≈ 0.
- Warm isolate, stale cache: the request is answered from the stale copy; the KV read happens in
  `ctx.waitUntil` after the response.
- Cold isolate: one KV read on the request path. Hot key in-colo: "<1 ms" for the hottest keys,
  p90 "<12 ms" <https://blog.cloudflare.com/faster-workers-kv/> (2024-09-26); cold/regional p95 ~50 ms,
  p99 ~250 ms (changelog 2025-08-22). Then `JSON.parse`.
- `JSON.parse` measured locally (Node v22.22.0, this container, **not** the Workers runtime, 2,000
  iterations, object of 400 keys each `{value, type, updatedAt, by}`): **5.2 KB → 0.024 ms; 53 KB →
  0.33 ms; 216 KB → 1.38 ms.** Reference throughput for V8's parser: 0.16–0.61 GB/s on a 2018 laptop
  <https://github.com/tian2008/simdjson_nodejs> (table in README), which puts 53 KB at roughly
  0.1–0.3 ms. Against the 10 ms free CPU budget <https://developers.cloudflare.com/workers/platform/limits/>
  this is noise; an SSR page is already quoted at 10–20 ms on the same page, which is the real budget
  problem and belongs to another topic.
- Schema validation of 400 keys with Zod/Valibot per request: **GAP** (not measured); Zod 4 claims
  6.5× faster object parsing than v3 <https://zod.dev/v4> but the absolute figure for this shape is
  unknown. Design so it never runs on the request path: validate on save (per key) and once per cache
  fill (whole snapshot), and store the already-typed object.

### 4.4 Read-your-writes for the admin who just saved

Classic KV gives no guarantee for up to 60 s <https://developers.cloudflare.com/kv/concepts/how-kv-works/> .
Three measures, cheapest first:

1. **Same isolate:** the save handler updates the in-isolate cache before responding, so the admin's
   next request on the same isolate sees the new value immediately.
2. **Version cookie:** the save response sets a short-lived cookie `cfg_v=<version>` (≤90 s). Any
   request whose cookie version is newer than the isolate's snapshot version reads the **D1 document
   directly** (one indexed read, counted as one row) and refreshes the isolate. Only admins who just
   saved pay this, only for ≤60 s.
3. **Settings pages read D1 directly** regardless: they are admin-only, low-traffic, and must never
   show a stale value. Everything else reads the snapshot.

When KV Instant opens (replication p99 256 ms <https://blog.cloudflare.com/workers-kv-instant/> ), measure
2 can be dropped.

### 4.5 Cross-colo invalidation

There is no push invalidation in classic KV; every colo converges by TTL. Keep `cacheTtl` at its
minimum, 30 s (changelog 2026-01-30), or the default 60 s, and the isolate TTL at the same value, so
the worst case is TTL + TTL ≈ 60–120 s. A Durable Object could serialise writes and hold the
authoritative version number, but reading it per refresh costs a DO request per isolate per TTL,
which is fine (thousands/day) while reading it per request is not (section 3 h). It is an optional
refinement, not a requirement.

### 4.6 Corrupt or missing snapshot

On cache fill: `JSON.parse` in `try/catch`, then validate against the snapshot schema (section 5),
then check `schema_version`. On any failure: keep the **last good in-isolate copy** if one exists;
otherwise serve **L0 + L1** (bundled, always valid) with `freshness: "fallback"`; log one Sentry event
per isolate per version; `ctx.waitUntil` a rebuild from D1 and a KV put. Unleash Edge and Flagsmith
both do the same ("serve last cache", "default flags").

### 4.7 Schema evolution

- The snapshot carries `schema_version` and `config_version` (monotonic counter from D1).
- Config migrations are pure functions in the kit (`v3 → v4`), run on cache fill when the snapshot's
  `schema_version` is older than the code's, and once for real when the new code first saves.
- **Unknown keys** (present in D1, absent from the definitions) are kept in D1, excluded from the
  snapshot, and listed on the Settings page as "no longer used" so an admin can delete them. A removed
  key never breaks boot.
- **New keys** are absent from old snapshots and fall through to their L0 default: adding a key never
  needs a migration.
- A key that changes type gets a new name; the old one becomes an unknown key.

### 4.8 Audit trail and rollback

- D1 holds `settings` (current) and `settings_history` (one row per change: key, old, new, actor,
  time, `config_version`, Worker version id from the `CF_VERSION_METADATA` binding
  <https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/> ). If the kit
  already has an audit-log table, reuse it (Golden Rule 6) and add nothing.
- **Rollback = forward write:** "restore version N" re-applies the values of version N as a new
  version N+k with a history row. No snapshot is ever edited in place.
- Disaster fallback: D1 Time Travel restores the whole database to any minute in the last **7 days
  (free) / 30 days (paid)** <https://developers.cloudflare.com/d1/platform/limits/> .
- Previous snapshots can be kept as `config:v<N>` keys in KV for cheap diffing, but each costs a KV
  write (1,000/day): keep only the last 5.

### 4.9 Preview vs production

- Wrangler environments: `[env.preview]` with its own `vars`, KV namespace id and D1 database id;
  `vars` and bindings are **non-inheritable**, so every binding must be repeated per environment
  <https://developers.cloudflare.com/workers/wrangler/configuration/> . Workers Builds runs
  `wrangler deploy` on the production branch and `npx wrangler preview` on others; using Wrangler
  environments in Builds needs one Worker per environment and `--env`
  <https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/> .
- Consequence: a preview that **shares** production bindings sees production config (and could write
  it). Give preview its own D1 and KV (10 D1 databases per account on free
  <https://developers.cloudflare.com/d1/platform/limits/> ), and make the save handler refuse to write
  when `client_config.environment !== "production"` unless the binding ids match the preview set.
- `.dev.vars` is for local only; the snapshot path works unchanged against a local D1/KV
  (`wrangler dev`).

---

## 5. Validation and typing

### 5.1 Library comparison

| Library | Bundle (gzip, as published) | Parse speed | Startup cost | JSON Schema export | Standard Schema | Notes (read 2026-10-18) |
|---|---|---|---|---|---|---|
| **Zod 4** (classic) | Core **5.36 kB** gzip (v3: 12.47 kB) <https://zod.dev/v4> ; Valibot's login-form benchmark: **17.7 kB** with esbuild <https://valibot.dev/guides/comparison/> | 14× faster string, 7× array, 6.5× object parsing than v3 <https://zod.dev/v4> | Schema objects built at module load (eager) | **Native** `z.toJSONSchema()` with targets, `.meta()`/registries for title/description/examples; list of unrepresentable types documented; `z.fromJSONSchema` experimental <https://zod.dev/json-schema> | Yes (Zod ≥3.24) <https://standardschema.dev/schema> | Largest, best-known, best ecosystem (Hono validators, form libs) |
| **Zod 4 Mini** (`zod/mini`) | Login form **6.88 kB** esbuild / **3.94 kB** Rolldown <https://valibot.dev/guides/comparison/> | Same engine as Zod 4 | Same | Same `toJSONSchema` and `.meta()` | Yes | Functional API, tree-shakeable; same core |
| **Valibot** | Login form **1.37 kB** <https://valibot.dev/guides/comparison/> | "Approximately the same" as Zod 4 per Valibot's own comparison; far slower than TypeBox/Typia | Modular, tree-shaken | Via a separate package (`@valibot/to-json-schema`): **GAP** (package coverage not re-verified today) | Yes (≥1.0) | Smallest; metadata via `v.title`/`v.description` actions |
| **ArkType** | **GAP** (bundle figure not fetched) | Claims very fast runtime (JIT-free optimised) | **GAP** | Has JSON Schema generation: **GAP** (`arktype.io/docs/json-schema` returned CRAWL_NOT_FOUND) | Yes, co-author of the spec <https://arktype.io/docs/integrations> | Type-syntax strings; composes other Standard Schema validators |
| **TypeBox** | **GAP** | Fastest with its JIT compiler (`TypeCompiler`); JIT uses dynamic code generation, which the Workers runtime disallows (`eval`/`new Function` are blocked; **GAP**: cite the Workers security-model page when verifying), so only the slower `Value.Check` path applies | Eager | **Native:** schemas *are* JSON Schema <https://github.com/sinclairzx81/typebox> | **No** native support; maintainer declined, adapter via TypeMap <https://github.com/sinclairzx81/typebox/discussions/1152> | Best if JSON Schema is the source of truth; weakest DX for TS-first |

Standard Schema (`~standard` interface) is implemented by Zod 3.24+, Valibot 1.0+, ArkType 2.0+,
Effect 3.13+ (adapter), yup 1.7+, joi 18+, typia 9.2+ among others <https://standardschema.dev/schema> ,
and Standard JSON Schema adds `jsonSchema.input/output({target})` <https://standardschema.dev/> . Hono's
`@hono/standard-validator` accepts any of them, so the choice does not lock the API layer.

### 5.2 Recommendation: Zod 4 Mini

Reasons: (1) one definition yields the TypeScript type, the runtime check **and** JSON Schema without
a second package; (2) `.meta()` carries `title`/`description` and arbitrary fields into JSON Schema,
which is what the Settings page, the docs generator and an AI agent need; (3) 3.9–6.9 kB is within
noise for an SSR Worker; (4) validation runs on save and on cache fill, so Valibot's smaller size and
TypeBox's speed buy little; (5) Standard Schema keeps Hono and forms neutral. Choose Valibot only if
bundle size turns out to be the deciding constraint elsewhere in the kit; it is a one-day swap under
Standard Schema.

### 5.3 Every key self-describing

One registry in the kit, one entry per key. Everything else is generated from it.

```ts
defineSetting({
  key: "email.daily_limit",
  schema: z.number().int().min(0).max(10_000).meta({ title: "Daily email limit",
    description: "Hard cap on emails sent per UTC day. 0 disables sending." }),
  default: 500,
  layer: "system",            // "client" = boot-time (L1), "system" = runtime (L2)
  editableBy: "owner",        // "vendor" | "owner" | "admin"
  takesEffect: "immediately", // or "next-deploy"
  module: "email",
  sensitive: false,
});
```

From this one list the kit renders: the Settings form (grouped by `module`, control chosen by
schema type, disabled when `editableBy` excludes the viewer, badge when `takesEffect` is
`next-deploy`); the D1 seed of defaults; the snapshot validator (`z.object` built from the registry);
the JSON Schema document (`z.toJSONSchema`) published at an authenticated `/api/config/schema` for
tooling and AI agents; and a Markdown reference page generated at build time so docs and code cannot
drift. The `docs_check`-style gate the repos already run can assert that the generated page is current.

---

## 6. Per-client identity

### 6.1 How the Worker knows which client it is

One Worker per client account means the Worker never *discovers* its client: the client **is** the
deployment. Make it explicit and self-checking:

- `client.config.ts` in the client repo (generated by the vendor's onboarding tool, committed, typed
  by the kit's `ClientConfig` schema, validated at build). This is L1.
- Two or three `[vars]` mirror the identity (`CLIENT_ID`, `PUBLIC_HOST`, `ENVIRONMENT`) and are
  checked on boot via `astro:env`; a mismatch with the bundle is a hard error. `[vars]` are 5 KB each,
  64 free <https://developers.cloudflare.com/workers/platform/limits/> , so keep them to identity only.
- The `CF_VERSION_METADATA` binding (`id`, `tag`, `timestamp`)
  <https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/> stamps every
  snapshot and audit row, so "which build produced this" is always answerable.
- A `client_id` column in every D1 table is unnecessary with one database per client; one
  `meta` row holding `client_id` protects against pointing a Worker at the wrong database.

### 6.2 Custom domain / subdomain: what `custom_domain = true` does and does not do

- `[[routes]] pattern = "admin.client.com", custom_domain = true` makes Cloudflare create the DNS
  record and an Advanced Certificate automatically; the hostname must be in an **active zone in the
  same account** and must not already have a CNAME; `previews_enabled` / `enabled` toggles exist
  <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/> . For most clients
  this is enough.
- A **wildcard** (`*.client.com/*`) needs a classic route with `zone_name` plus a proxied placeholder
  record (`AAAA 100::`) — more steps, only for "any subdomain" designs (same page).
- **Cloudflare Access is a separate object**: an Access application for the hostname must exist, and
  since the 2026-08-14 change Workers can read the identity with `ctx.access.getIdentity()` and use
  an `access.dev` block for local development
  <https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/> . Whether the Wrangler
  config can *create* the Access application (so onboarding is one deploy): **GAP**; check the Workers
  Access configuration reference, otherwise script it with the Access API at onboarding.
- Zone ownership: the client's zone must be in the client's Cloudflare account (the kit's model). A
  vendor-owned "clients.vendor.com" subdomain scheme would need the vendor zone in every client
  account, which is not possible, so vendor-branded subdomains imply a different deployment model.

### 6.3 Page names and nav labels as data without breaking Astro routing

Astro routes are files. Three ways to let each client have its own page names:

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Fixed URLs, custom labels** | Module pages keep kit URLs (`/m/email/...`); `client_config.nav` maps each page to a label per locale | Zero routing risk; links in emails and docs never break | URLs are the vendor's words, not the client's |
| **B. Custom slugs by rewrite** | One SSR catch-all `src/pages/[...slug].astro` looks the slug up in `client_config.routes` (or a small `pages` table) and calls `Astro.rewrite("/m/email/...")` (available since Astro 4.13) <https://docs.astro.build/en/guides/routing/> ; old slugs go through configured `redirects` | Client-chosen URLs; module code untouched; change without touching page files | One extra lookup per page (in-memory, from L1); only one rest parameter per on-demand filename, so the catch-all must sit at the root; care with precedence against real files |
| **C. Build-time routes** | An Astro integration calls `injectRoute({ pattern, entrypoint, prerender })` once per entry in `client_config.routes` <https://docs.astro.build/en/reference/integrations-reference/> | Real routes, no runtime lookup, type-checkable | Needs a deploy to rename a page (fine for L1); more build complexity |

Recommendation: **A + B**. Canonical module routes stay fixed and are what the modules link to
internally; the client's slugs are L1 data (`routes: { "correo": "/m/email", "equipo": "/m/users" }`)
served by the catch-all with a rewrite, and `nav` labels are L1 data too. Because slugs are L1 they
change by deploy, which also means an admin cannot break their own portal from the Settings page.
Option C is the upgrade path if the rewrite's precedence rules ever bite.

---

## 7. Pitfalls

| Pitfall | Figures | Mitigation |
|---|---|---|
| **KV 1,000 writes/day vs frequent edits** | 1,000 writes and 1,000 deletes per day on free; 1 write/s per key <https://developers.cloudflare.com/kv/platform/limits/> | One snapshot key, one write per save (version in metadata). Debounce bulk saves (one "Save all" → one write). Keep ≤5 historical snapshot keys. Alert at 500 writes/day |
| **KV eventual consistency confuses admins** | Up to 60 s <https://developers.cloudflare.com/kv/concepts/how-kv-works/> ; `cacheTtl` ≥30 s | Settings pages read D1; version cookie (4.4); show "applied everywhere within about a minute" in the UI; KV Instant later (p99 replication 256 ms) |
| **D1 cold latency / single-threaded primary** | Point read "<1 ms" in-engine but one primary location per DB; D1 is single-threaded per database <https://developers.cloudflare.com/d1/platform/limits/> | Never on the request path (snapshot); Sessions API if replicas are enabled; keep the settings query indexed on `key` |
| **D1 row accounting** | `SELECT *` on 400 rows = 400 rows read; 5M/day free; queries fail at the limit since 2026-09-01 <https://developers.cloudflare.com/d1/platform/pricing/> | Read the whole table only on rebuild; use indexes; watch the Metrics tab |
| **`[vars]` changes require a deploy and are capped** | 5 KB per var, 64 per Worker, non-inheritable per env <https://developers.cloudflare.com/workers/platform/limits/> | Only identity in `[vars]`; everything else in the bundle (L1) or D1 (L2) |
| **Secrets Store beta** | 100 secrets/account, one store, 64 KB each; local dev cannot read production secrets; CI token needs "Account Secrets Store Edit" <https://developers.cloudflare.com/secrets-store/manage-secrets/> | Use Worker secrets by default; Secrets Store when rotation across Workers matters; count toward 64 vars: **GAP** |
| **10 ms CPU and parsing** | 53 KB `JSON.parse` ≈ 0.33 ms locally (4.3); SSR page 10–20 ms CPU typical <https://developers.cloudflare.com/workers/platform/limits/> | Parse once per cache fill; never validate per request; keep the snapshot under ~100 KB so KV's in-memory hot path applies (blog threshold <100 KB) |
| **Worker bundle size** | 64 MiB uncompressed, no compressed limit; 1 s startup limit (changelog 2025-10-10) <https://developers.cloudflare.com/workers/platform/limits/> | Config adds kilobytes; the real risk is the SSR framework, tracked elsewhere |
| **Isolate eviction under memory pressure** | 128 MB per isolate; over-limit → in-flight requests finish, a new isolate starts <https://developers.cloudflare.com/workers/platform/limits/> ; isolates "not necessarily long-lived" | Design every request to tolerate a cold fill; never rely on a warm cache for correctness |
| **Binding-only redeploy keeps the isolate** | Documented: a binding change may reuse isolates, so values derived from `env` at module scope go stale <https://developers.cloudflare.com/workers/runtime-apis/bindings/> | Read `env` per request or re-derive when the snapshot version changes; key the memory cache by `config_version` |
| **Cache API absent behind Access** | Official limitation <https://developers.cloudflare.com/workers/runtime-apis/cache/> | Do not design around `caches.default`; isolate memory + KV only |
| **Preview shares production bindings** | Builds previews use `wrangler preview`; environments need separate Workers <https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/> | Separate D1/KV ids per `[env.preview]`; write guard on environment mismatch |
| **Hostname has an existing CNAME / zone not active** | Custom Domains refuse both <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/> | Onboarding checklist step before the first deploy |

---

## 8. Decision cards for the owner

### Card 1. Where does the "live" list of settings that admins can change actually live?

- **Option A (recommended): a table in the client's D1 database, with a small copy in KV that the
  site reads.** Every change is recorded with who and when, old values can be brought back, and reads
  cost nothing on the free plan.
- **Option B: KV only, no D1.** Simpler, but there is no change history, no "undo", and a mistaken save
  cannot be traced.
- **Option C: a Durable Object that owns the settings.** Strongly consistent, but every page view would
  need to ask it, and the free allowance (100,000 asks per day) runs out at the same time the site's
  own request allowance does.

Recommendation: **A.** It is the only option that gives history and rollback for free.

### Card 2. When an admin saves a setting, how quickly must every visitor see it?

- **Option A (recommended): the admin sees it at once; everyone else within about a minute.** No
  extra moving parts; the Settings page says so in one line.
- **Option B: everyone sees it within a second.** Needs Cloudflare's new "KV Instant", which is still
  invitation-only; until then it means a slower, costlier read on every page.
- **Option C: changes apply at the next deploy only.** Simplest of all, but then client admins cannot
  change anything without the vendor.

Recommendation: **A now, B when KV Instant opens** (the design swaps the store, nothing else).

### Card 3. Can each client name and address its pages its own way?

- **Option A: fixed web addresses, client-chosen menu names.** Safe and simple; the address bar still
  shows the kit's words.
- **Option B (recommended): client-chosen addresses too, set at onboarding and changed by a deploy.**
  The client's language in the address bar; a rename is a vendor task, so an admin cannot lock
  themselves out.
- **Option C: client admins rename pages themselves from Settings.** Most flexible, but a bad rename
  can break saved links and emails instantly, with no deploy to catch it.

Recommendation: **B** (built on A).

### Card 4. How does a vendor-wide change (a new default, a safer limit) reach every client?

- **Option A (recommended): with the next kit release.** Each client gets it when their portal is
  redeployed; nothing new to run or secure.
- **Option B: the vendor edits each client's settings through that client's own admin API.** Works
  today, but it is one action per client and leaves the change in the client's history as a vendor
  action (which is honest, but visible).
- **Option C: every client portal calls a vendor server for its defaults.** One switch for all
  clients, but it adds a new service that must be always up and trusted by every client, against the
  "reuse before you create" rule.

Recommendation: **A, with B for urgent single-client fixes.** Revisit C only if the number of clients
makes releases too slow.

---

## 9. Open GAPs (what to check, in order of impact)

1. **Secrets Store bindings vs the 64-variable cap** — deploy a test Worker with 63 `[vars]` plus two
   `secrets_store_secrets` bindings, or ask Cloudflare support.
2. **KV Instant access and pricing** — request the private beta; confirm reads/writes count like
   classic KV.
3. **Warm isolate count for a small portal** — add a `CF_VERSION_METADATA`-tagged counter for one
   week; it fixes the KV read estimate in 4.2.
4. **D1 round-trip latency from the Worker** — measure p50/p95 for one indexed read from the client's
   region; not published.
5. **Whether Wrangler config can create the Access application** — check the Workers Access
   configuration reference after the 2026-08-14 change.
6. **OpenFeature specification details** — `openfeature.dev` unreachable through the proxy; shape
   described from memory, numbers omitted.
7. **ArkType bundle size and JSON Schema export; Valibot's JSON Schema package coverage** — fetch
   their docs from a network that resolves them.
8. **Zod validation CPU for a 400-key object on Workers** — measure once in `wrangler dev` with
   `performance.now()`; expected low single-digit ms, so keep it off the request path regardless.
9. **Workers runtime disallows `eval`/`new Function`** (affects TypeBox's JIT) — confirm on the
   Workers security-model page.

---

*Sources were read on 2026-10-18 through the Cloudflare docs MCP tool, direct fetches and Exa; the
local benchmark ran in Node v22.22.0 on this container and is labelled as such wherever quoted.*

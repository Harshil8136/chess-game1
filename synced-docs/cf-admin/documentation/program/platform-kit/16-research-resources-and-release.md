---
title: "Platform kit research: one-of-each resources, tokens and release engineering"
status: historical
audience: [owner, ai, technical]
last_verified: 2026-10-18
verified_against: [web-sources]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, research, snapshot]
---

> **Research snapshot, read on 2026-10-18.** Written by a research pass for the platform kit plan ([`01-plan.md`](01-plan.md)). Figures carry their source URL and the date read; anything unverified is marked **GAP**. Paths named here describe other repositories or a proposed design, not files in this repository. Kept as a dated record and not updated in place.

# Platform kit: resources and release engineering

Research memo for the design plan. Read 2026-10-18. Every figure carries its source; anything I could not confirm is marked **GAP**. No repository code was used; the only repository material referenced is the published `main.md` contracts, which describe today's estate (4 D1 databases, 3 KV namespaces, 6 or more R2 buckets, 4 queues, three migration series feeding one ledger with 26 colliding numbers).

---

## 1. Summary

1. **One of each per client, in the client's own Cloudflare account**: one Worker, one D1, one R2 bucket (prefixes), one KV namespace (key prefixes), one typed event queue plus its dead-letter queue, one Durable Object class for coordination, one Workflow for long jobs, one cron trigger that reads a schedule table, Static Assets for the Astro client build. The free plan allows far more of each, so the cap is a discipline we enforce with a `kit manifest` gate in `npm run verify`, not a platform limit.
2. **Correction to a figure we were given**: on the Workers Free plan a D1 database is capped at **500 MB**, not 10 GB; 10 GB per database is the Paid figure. Free also caps the account at 10 databases and 5 GB total, and Time Travel keeps **7 days** (30 on Paid). Source: <https://developers.cloudflare.com/d1/platform/limits/> (read 2026-10-18).
3. **One Worker per client, not several.** Service-binding calls count as Worker requests, Previews cannot follow a service binding to a preview of the other Worker, and the 64 MiB bundle, 1 s startup and 64-variable caps leave ample room for a Hono app with all modules. Split only for a different jurisdiction, a public asset bucket, or a client who pays for isolation.
4. **Tokens: from "10+" to one or two stored tokens per client.** Workers Builds deploys with a token Cloudflare generates and keeps inside the client's account. The only token we store is one account-owned `cfat_` token, scoped to D1 and R2 on that account, kept as a Worker secret for the nightly export. Nothing Cloudflare-related is stored in GitHub.
5. **Pipeline: Shape A (Workers Builds runs `verify`, then deploys), with Previews for branches.** At 30 pushes a month it uses roughly 150 of the client account's 3,000 free build minutes and zero GitHub Actions minutes. GitHub Actions is kept for things that are not deploys.
6. **Branch model: the owner keeps pushing to `main`; a red `verify` fails the build and blocks the deploy.** For large changes, a short branch gets a Preview URL from the same builder before it is merged.
7. **Upgrades: the kit is a versioned set of npm packages (Changesets, semver, pnpm catalog), clients pin a kit version, Renovate opens the upgrade PR, `kit upgrade` runs a doctor, kit migrations carry a reserved number range and a single ledger table, destructive steps ship one release later (expand, then contract).**
8. **Backups: Time Travel (always on, free) for the first 7 days; a nightly Workflow exports D1 through the REST API, encrypts, and writes to the `backups/` prefix of the one bucket, which carries a bucket lock and a lifecycle rule.** No GitHub Actions, no second account, no S3 keys by default.
9. **Testing needs a second D1 only for migration rehearsal**: Time Travel cannot fork a database yet, so a staging copy is made by export and import, and it counts toward the 10 databases and 5 GB.
10. **Open items (GAPs):** whether `age-encryption` runs on Workers (X25519 is in Workers Web Crypto, the package lists Workers as "unknown"), whether Secrets Store bindings count toward the 64-variable cap, R2 event-notification rule limits per bucket, Durable Objects' free-plan compute numbers, and whether vitest-pool-workers runs inside the Workers Builds container.

---

## 2. Per-client resource manifest

All limits below are **Workers Free** unless marked Paid. Sources: Workers limits <https://developers.cloudflare.com/workers/platform/limits/> ; D1 <https://developers.cloudflare.com/d1/platform/limits/> ; KV (table seen on the KV limits and Workers pricing pages) ; Queues <https://developers.cloudflare.com/queues/platform/limits/> and <https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/> ; R2 <https://developers.cloudflare.com/r2/platform/limits/> ; Workflows <https://developers.cloudflare.com/workflows/reference/limits/> ; Durable Objects <https://developers.cloudflare.com/durable-objects/platform/pricing/> . All read 2026-10-18.

| Binding (wrangler name) | What it is | What goes in it | Relevant free-plan limits | Rule for adding one more, enforced by the `kit manifest` gate |
|---|---|---|---|---|
| `DB` | D1 database `<client>-kit` | Every module's tables, each with a module prefix (`core_`, `users_`, `email_`, `backup_`, `health_`, `vps_`), plus `kit_migrations` (the one ledger), `kit_settings` (all toggles and thresholds), `kit_schedule` (what the tick runs), `kit_events_log`. | 10 databases/account, **500 MB per database**, 5 GB per account, 5 M rows read and 100 k rows written per day (enforced with errors since 2026-09-01: <https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/>), 100 columns per table, 100 bound parameters, 100 KB statement, 50 queries per invocation, Time Travel 7 days. Paid: 10 GB per database, 1 TB per account, 30 days. | `d1_databases.length === 1`. A new table needs a registered module prefix and a kit migration. A second database is allowed only when the size cap is within reach (alarm at 300 MB) or a client pays for a separate jurisdiction. Mirrors today's "RULE #0.9". |
| `STORE` | R2 bucket `<client>-kit` | Prefixes: `backups/` (locked), `uploads/`, `exports/`, `logs/`, `assets/`. Lifecycle rules per prefix (`wrangler r2 bucket lifecycle add <BUCKET> [NAME] [PREFIX] --expire-days N`). Event notifications per prefix into `EVENTS` (`wrangler r2 bucket notification create <BUCKET> --event-types object-create --prefix uploads/ --queue <q>`). Bucket lock on `backups/` (`wrangler r2 bucket lock add ... --prefix backups/`). | 1,000,000 buckets/account, 100 custom domains per bucket, 5 TiB per object, REST API 1,200 requests per 5 minutes per account. `r2.dev` is not for production (rate limited). Free 10 GB storage (figure given by the caller, not re-verified). | `r2_buckets.length === 1`. New data kind = new prefix registered in `kit.manifest.json`, with its lifecycle rule. A second bucket only for a public, custom-domain asset bucket or a different jurisdiction. Prefix limits per bucket for notifications: **GAP** (wrangler accepts prefix and suffix filters; a per-bucket rule cap was not found). |
| `CACHE` | KV namespace `<client>-kit` | Key prefixes `sess:`, `flag:`, `cache:`, `rl:`, each with a TTL. Nothing authoritative lives here; flags and settings are D1 rows with a KV cache in front. | 1,000 namespaces/account, 100,000 reads/day, 1,000 writes/day, 1,000 list/day, 1 GB stored. | `kv_namespaces.length === 1`. Keys are built by one `kvKey(prefix, id)` helper and a unit test rejects unregistered prefixes. The 1,000 writes/day budget is the real constraint: sessions must be write-once with sliding TTL, not refreshed on every request. |
| `EVENTS` + `EVENTS_DLQ` | Queue `<client>-kit-events` with producer and consumer in the same Worker; `<client>-kit-dlq` as `dead_letter_queue` | One typed envelope `{ type, v, payload, idempotencyKey }`; the consumer dispatches on `type` (`email.send`, `backup.run`, `webhook.deliver`, `audit.write`, `r2.object-create`...). R2 and other Cloudflare event subscriptions land here too. | Free since 2026-02-04: 10,000 operations/day across reads, writes and deletes, 10,000 queues, retention fixed at 24 h on Free (up to 14 days Paid). All plans: 128 KB message, 100 messages per batch, 100 retries, `delaySeconds` up to 24 h, one consumer Worker per queue, 25 GB backlog. | `queues.consumers.length <= 2`. A new event is a new `type` in the TypeScript union, never a new queue. A second business queue is allowed only when a module needs a different batch/retry profile **and** the owner says yes. Watch the shared 10 k ops/day: a batch of 100 is roughly 1 write op per message plus reads; email bursts must be batched. |
| `COORD` | Durable Object class `KitCoordinator` (SQLite backend, `new_sqlite_classes`) | Named singletons for cross-request state: migration lock, backup-run lock, live operations view, account-wide counters. Preview deployments get their own namespace automatically. | Free plan allows only SQLite-backed objects; 10 GB per object; point-in-time recovery to any point in the past 30 days; rows read/written share the D1-style daily budgets (5 M / 100 k) and 5 GB total SQL storage on Free. Free compute requests/duration per day: **GAP** (the pricing page states daily limits exist and reset 00:00 UTC; the numbers were not captured). | `durable_objects.bindings.length <= 2`. A new class needs a dated spec. |
| `JOBS` | Workflow `kit-jobs`, class `KitJobs` | Long or multi-step work: nightly backup, exports, `kit upgrade` post-deploy checks, restore drills. The backup schedule lives on the Workflow (`schedules: ["0 3 * * *"]`), which does **not** consume a cron trigger. | Free: 100,000 executions/day shared with Workers, 100 concurrent instances, 1,024 steps per Workflow, 10 ms compute per step, 3 days state retention, 100 `schedules` per account. Billing for steps and storage applies from 2026-08-10 (Paid). | `workflows.length === 1`. New job = new `kind` handled by the same class. |
| `triggers.crons` | exactly one: `*/5 * * * *` | The "tick": reads `kit_schedule` in D1 and dispatches due work to `EVENTS` or `JOBS`. Everything time-based in every module registers a row, not a cron. | 5 cron triggers per account on Free (250 Paid). | `triggers.crons.length === 1`. This leaves 4 of the client's 5 account-wide triggers untouched. |
| `ASSETS` | Static Assets | The Astro client build (Preact islands, CSS, fonts). | 20,000 files per version (100,000 Paid), 25 MiB per file, requests to assets are free and unlimited. | Size budget check in `verify` (fail above 15,000 files). |
| `RATE_LIMITER` | `ratelimits` binding, `namespace_id` 1, `simple: { limit, period: 10 \| 60 }` | Per-colo limits for sign-in, API tokens, webhooks. Account-wide limits go through `COORD`. | GA; limits are per Cloudflare location, not global (configuration page, read 2026-10-18). | One binding; new limits are new `namespace_id` values declared in the manifest. |
| `secrets.required` | Worker secrets | `SESSION_KEY`, `KIT_OPS_TOKEN` (the `cfat_` token for D1 export), `EMAIL_PROVIDER_KEY`, `ACCESS_AUD`, optional `BACKUP_PUBLIC_KEY`. Declared in wrangler config so `wrangler deploy` fails when one is missing (<https://developers.cloudflare.com/changelog/post/2026-03-24-secrets-config-property/>). | 64 variables per Worker (secrets + text), 5 KB each; 128 on Paid. | `secrets.required.length <= 12` and `vars` must be empty: every non-secret setting is a `kit_settings` row. Same intent as today's RULE #0.8. |
| Access | One Access application on the portal hostname, one Allow policy for people, one Service Auth policy for machines (the VPS agent) | The door. | Zero Trust Free covers 50 users (Cloudflare plans page, via web search, read 2026-10-18). Organizations created on or after 2026-10-05 have strict service-token authentication on and cannot turn it off (<https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/>). | One app per client Worker; service tokens only when a machine must call in. |

**How the gate works.** `kit.manifest.json` in each client repo lists the allowed bindings, prefixes, event types and schedule kinds. `npm run verify` runs `kit manifest check`, which parses `wrangler.jsonc`, compares counts and names, scans the code for `env.<BINDING>` uses not in the manifest, and fails with the sentence "adding a resource needs a manifest entry and the owner's yes". The same check runs as the first step of the Workers Builds build command, so a drive-by `r2_buckets` entry can never deploy.

**Capacity reality check on Free.** A per-client admin portal with a few staff users sits far below 100,000 requests/day and 5 M row reads; the two numbers to watch are **KV writes (1,000/day)** and **Queue operations (10,000/day)**. The manifest therefore forbids per-request KV writes and requires queue batching.

---

## 3. One Worker or several

**Recommendation: one Worker per client.** Reasons, each with its source (read 2026-10-18):

- **Room.** A Worker may be 64 MiB uncompressed on every plan (the compressed 3 MB/10 MB limits were removed on 2026-09-04: <https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/>), must start its global scope within 1 second, and holds 64 variables. An Astro SSR + Hono bundle is a few MB. `wrangler check startup` (wrangler 4.116.0+) reports bundle size and startup CPU so the gate can fail on regressions: <https://developers.cloudflare.com/workers/wrangler/commands/workers/#startup>.
- **Service bindings are not free in requests.** The pricing page's footnote 4 counts worker-to-worker invocations as requests; on Free that is the shared 100,000/day. Splitting a portal into front and back Workers roughly doubles request consumption for every page that calls the back half. <https://developers.cloudflare.com/workers/platform/pricing/>
- **Previews break across Workers.** "If Worker A has a service binding to Worker B and you deploy a Preview of Worker A, the Preview of Worker A can only bind to the production Worker B." The docs suggest `ctx.exports` for same-Worker calls instead. <https://developers.cloudflare.com/workers/previews/resources/#limitations>
- **Workers count is not the constraint**: 100 Workers per account on Free, 500 Paid, but one Worker is what Access, Builds, Previews and the token model all assume.
- **Private surfaces do not need a private Worker.** Today's private cf-backup Worker exists to have no public route. In the kit the same property comes from Access in front of the one Worker plus Hono route guards; the backup console is `/backup/*` behind the same door. A Worker with no public route and only a service binding remains the right shape **only** when a different team or a different account must own it.
- **Service bindings and RPC stay in the toolbox** for the cases that do justify a second Worker: a client who buys a separately billed module, a module needing a different compatibility date or flags, or a public asset host. Service bindings add "zero overhead or added latency; both Workers run on the same thread of the same Cloudflare server" (<https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/>). Named entrypoints (`WorkerEntrypoint`) give typed RPC.
- **The VPS agent is not a Worker**; it runs on the server and calls the portal through Access with a service token (strict mode: Service Auth policy only, 401/403 on failure, no cookie).
- **A docs/architecture explorer** (today a separate static Worker) becomes a route under `/docs` served from Static Assets of the same Worker.

**Within the one Worker** the module boundary is a folder and a Hono sub-router: `modules/<name>/{routes.ts, schema.sql.d/, events.ts, jobs.ts, ui/}`, each registering its routes, event types and schedule kinds in the manifest. Shared code (`@kit/core`: auth, sessions, permissions, settings, tick, backups) is a package; modules are packages; the client repo is wrangler config, manifest, migrations folder and branding.

---

## 4. Token inventory, before and after

"Before" is the owner's description ("10+ API tokens") plus what the published contracts describe; the exact count is the owner's to confirm. "After" is the design.

| Purpose | Before (today's estate) | After (kit, per client account) | Scope of the token that remains |
|---|---|---|---|
| Deploy on push | Workers Builds per Worker, 6 Workers across the platform, each with a Cloudflare-generated build token; some repos also carry GitHub Actions deploy steps | **Workers Builds, one Worker.** "By default, Cloudflare will automatically generate an API token for your account when using Workers Builds" (<https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token>). It lives inside the client's account. | None stored by us. |
| Developer deploy from a laptop | `wrangler login` OAuth per developer, per account | Same: `wrangler login` with the owner's user, who is a member of each client account. OAuth, not a stored token. | None stored. |
| Create the resources for a new client | By hand in the dashboard, or ad hoc tokens | **`kit setup`** runs `wrangler deploy` with bindings declared **without IDs**; wrangler provisions KV, R2, D1 and Queues automatically (wrangler 4.45.0+, beta; `--no-x-provision` to disable): <https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning> and <https://developers.cloudflare.com/changelog/post/2025-10-24-automatic-resource-provisioning/> . Creating a new Worker needs product-level **Workers Admin**; after that **Editor** on the one Worker is enough to deploy, including its bindings ("you do not need separate permissions on the bound resources"): <https://developers.cloudflare.com/workers/authorization/> | The developer's OAuth session during setup. If an unattended setup is ever needed, one account-owned token with Workers Admin + Developer Platform Admin, deleted after setup. |
| Nightly D1 export | A D1 REST token held by the backup Worker; GitHub Actions secrets for the engine; S3 credentials for R2 uploads; a Supabase token | **One account-owned token `KIT_OPS_TOKEN`** (`cfat_` prefix, account-owned "service principal" token, needs the API Token Provisioning capability or Super Administrator to create: <https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/>), stored with `wrangler secret put`, used only by the `JOBS` Workflow to call `POST /accounts/{id}/d1/database/{id}/export` and the Time Travel endpoints. R2 writes go through the `STORE` binding, so no S3 keys. | Account: D1 Edit; optionally Workers R2 Storage Edit for lifecycle/lock management from `kit setup`. One client account only. |
| Secrets Store bindings | Not used | Optional later; deploying a Worker with a Secrets Store binding needs **Account Secrets Store Edit** on the deploy token (<https://developers.cloudflare.com/secrets-store/integrations/workers/>), the store is in beta with 100 secrets per account and one store per account (<https://developers.cloudflare.com/secrets-store/manage-secrets/>). Whether a Secrets Store binding counts toward the 64 variables: **GAP**. | None by default. |
| GitHub to Cloudflare | GitHub App "Cloudflare Workers and Pages" per repo, plus PATs in `sync-docs.yml` workflows for the public docs mirror | **GitHub App only**, installed on the client repo (<https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/>). Docs mirroring, if kept, uses the repository's own `GITHUB_TOKEN` or a GitHub App installation token (expires after 1 hour) rather than a personal access token (web search, read 2026-10-18; the 1-hour figure comes from a third-party source and should be checked against GitHub's docs: **GAP**). | None for Cloudflare. |
| Dependency updates | None automated | Renovate GitHub App. | None. |
| Publishing the kit packages | Not applicable today | npm trusted publishing (OIDC, `id-token: write`) from the kit monorepo's release workflow, or one `NPM_TOKEN` if trusted publishing is not available for the registry (web search, read 2026-10-18). | Zero or one, owner-wide, not per client. |
| Machines calling the portal (VPS agent) | Signed actor headers and a console signing key between Workers | One Access **service token** per agent, Service Auth policy, strict mode. | Client ID and secret on the server only. |
| Observability (Sentry, PostHog) | DSNs and project tokens per repo | Unchanged in kind; a DSN is a public identifier, not an API token. Kept to one per client as `kit_settings` rows. | Not counted. |

**Net effect:** per client, **one** stored Cloudflare token (`KIT_OPS_TOKEN`, scoped to one account) plus **zero or one** Access service token per machine. Owner-wide: zero or one npm token. Compared with today's many per-repo tokens, the count no longer grows with the number of modules or Workers, only with the number of clients, and every token lives inside the account it belongs to.

### Infrastructure-as-code options for `kit setup`

| Option | What it does well | Where it falls short for us | Verdict |
|---|---|---|---|
| **Wrangler only** (bindings without IDs, `wrangler deploy`, `wrangler d1 migrations apply`, `wrangler r2 bucket lifecycle/lock/notification`) | Zero extra tools, zero extra tokens, the config file is the record, auto-provisioning covers KV, R2, D1 and Queues. | Access applications, service tokens, custom hostnames and account-level settings are not in wrangler. Auto-provisioning is beta. | **Default for everything wrangler can do.** |
| **Cloudflare TypeScript SDK inside `kit setup`** (`cloudflare` npm package: `zero_trust.access.applications.create`, `zero_trust.access.service_tokens.create`, R2 lifecycle, D1 time travel) | One TypeScript program, runs with the developer's token during setup, no state file, idempotent by name lookups. | We write the idempotency ourselves. | **Use for the Access door and anything wrangler lacks.** (SDK method path confirmed by web search, read 2026-10-18.) |
| **Terraform or Pulumi** (Cloudflare provider has Access application and policy resources, granular Worker roles are "configurable with Terraform": <https://developers.cloudflare.com/changelog/post/2026-09-15-granular-worker-permissions/>) | Drift detection, a plan to review, mature for Access. | A state backend per client (another bucket or a SaaS), a provider token per client (the token zoo again), and two sources of truth with wrangler. | **Not now.** Revisit if clients demand audited infrastructure changes. |

---

## 5. Test-before-production: pipeline shapes compared

Assumptions for the minutes: the owner's `verify` chain takes about 3 minutes on a laptop (the cf-admin contract says so); the Astro build and `wrangler deploy` add about 2 minutes; 30 pushes to `main` a month; Previews for branches add one build each. Workers Builds minutes are **per Cloudflare account**, so each client has its own 3,000-minute pool; GitHub Actions minutes are **per GitHub account or organization**, so all client repos under the owner's organization share one 2,000-minute pool (private repositories; public repositories are unlimited). Sources: <https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/> (Free: 3,000 build minutes/month, 1 concurrent build, 20 minute timeout, 2 vCPU, 8 GB memory, 20 GB disk, 64 build variables; Paid: 6,000 minutes then $0.005/minute, 6 concurrent, 4 vCPU) and GitHub's plans page via web search (2,000 minutes/month on the Free plan for private repositories), both read 2026-10-18.

| Shape | What happens on a push to `main` | Minutes per month (30 pushes) | Tokens stored outside the client account | Gates production? | Fits "owner tests on a phone"? |
|---|---|---|---|---|---|
| **A. Workers Builds only.** Build command `npm run verify && npm run build`, deploy command `npx wrangler deploy`. Preview builds on for branches (`npx wrangler preview`). | Cloudflare clones, runs verify, builds, deploys. Red verify = failed build = no deploy, and the owner gets the build failure. | About 150 Builds minutes of 3,000 per client account; 0 GitHub minutes. Add about 5 per branch push for Previews. | **None.** | **Yes**, fail-closed inside the account. | Yes: production or a Preview URL to open on the phone. |
| **B. GitHub Actions verify, Workers Builds deploy.** CI runs `verify` on push and PR; Builds deploys on push to `main` with build command `npm run build`. | Two systems start at the same time. Builds deploys in 1 to 3 minutes whether or not Actions is green, unless branch protection forces PRs and required checks. | About 100 Builds minutes per client; about 120 to 150 GitHub minutes **per client** out of the owner's shared 2,000 (8 clients would exhaust it). | None for Cloudflare (tests run on Miniflare). | **No** for direct pushes to `main`; yes only with PRs and required checks. | Yes. |
| **C. GitHub Actions does everything** with `cloudflare/wrangler-action@v4` (<https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/>). | Actions runs verify, build, deploy. | About 150 to 180 GitHub minutes per client from the shared 2,000; 0 Builds minutes. Faster runners (4 vCPU). | **One `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` per client stored in GitHub** (exactly the token zoo the owner wants to end). | Yes. | Yes. |

**Recommendation: Shape A**, for three reasons: it is the only shape with zero stored Cloudflare tokens, it gates fail-closed on a direct push to `main` (the owner's working style), and its minutes come out of each client's own account rather than one shared GitHub pool. Shape A's limits: one build at a time on Free (pushes queue), a 20-minute timeout, and 2 vCPU/8 GB. Keep `verify` under 10 minutes and the gate is comfortable.

Two things to confirm on the first client (**GAP**): that `@cloudflare/vitest-plugin` (the Vite-plugin successor to `vitest-pool-workers` 0.x, which runs a local workerd) starts inside the Workers Builds container, and that the Node version there (Node 24 is the default since 2026-07-30: <https://developers.cloudflare.com/changelog/post/2026-07-30-workers-builds-nodejs-24/>) matches the kit's `engines`.

**Branch model.** Keep "work on `main`, push to `main`" as the owner's daily habit; the builder is the gate. Add one escape hatch for big changes: a short-lived branch pushed to the same repository gets a **Preview** (Worker Previews, GA 2026-09-22, wrangler 4.135.0+: <https://developers.cloudflare.com/changelog/post/2026-09-22-worker-previews/>). A Preview "runs under the same Worker with its own code, configuration, URL, and observability", gets its own Durable Object namespace automatically, and binds KV, D1 and R2 to whatever the `previews` block names (a shared staging D1 for all branches, with `wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc` run before deploying the Preview: <https://developers.cloudflare.com/workers/previews/resources/>). Preview limitations to respect: queue consumers cannot target a Preview, cron triggers and routes target production, a Workflow binding runs the existing deployed Workflow, Preview URLs are public by default and should sit behind Access (<https://developers.cloudflare.com/workers/previews/>). Limits: 100 Previews per Worker and 100 deployments per Preview on Free. The owner opens the Preview URL on the phone, then merges with a fast-forward push to `main`.

**Rollback.** Any of the 100 most recent versions can be promoted again (`wrangler rollback`, Editor role suffices): <https://developers.cloudflare.com/changelog/post/2025-09-11-increased-version-rollback-limit/> . Gradual deployments can split traffic between two versions for a careful release. Neither touches D1, which is why migrations are additive first (section 6).

**Where GitHub Actions still belongs:** the kit monorepo's release (Changesets "Version Packages" PR and publish), Renovate is a GitHub App and uses no minutes, and nothing per client.

---

## 6. Upgrades and big changes

**Versioning the kit.** The kit is a pnpm workspace: `@kit/core`, `@kit/ui`, `@kit/module-email`, `@kit/module-users`, `@kit/module-backup`, `@kit/module-health`, `@kit/module-vps`, `@kit/cli`. Inside the workspace a **pnpm catalog** (`catalog:` protocol in `pnpm-workspace.yaml`) pins each third-party dependency once, so wrangler, Astro, Preact and Hono have exactly one version across all packages (web search, read 2026-10-18). **Changesets** gives semver bumps with human-written notes: a contributor adds a `.changeset/*.md`, the `changesets/action` opens a "Version Packages" PR, merging it publishes the bumped packages (web search, read 2026-10-18). Major = a kit migration that is not purely additive or a config change the client must make; minor = new module or feature; patch = fixes.

**What a client repo contains**: `package.json` pinning `@kit/*` to one version, `wrangler.jsonc`, `kit.manifest.json`, `migrations/`, `branding/`, `.changeset/` for its own notes, and nothing else. **Renovate** (GitHub App) opens one grouped PR per kit release, with `minimumReleaseAge` of a few days so a bad release can be pulled before it reaches clients, and automerge for patch releases once the Workers Builds Preview is green (Renovate's cooldown is a "pending" status check until the age is reached; web search, read 2026-10-18). Majors are never automerged.

**Kit migrations with one ledger.** D1 migrations are numbered SQL files; wrangler records them in a table whose name, directory and discovery glob are configurable per binding (`migrations_table`, `migrations_dir`, `migrations_pattern`: <https://developers.cloudflare.com/workers/wrangler/configuration/>). The rule set that avoids today's duplicate-number problem:

1. Kit migrations live in `@kit/core/migrations/` numbered `0001`–`4999`; `kit upgrade` copies the new ones into the client's `migrations/` folder, and the gate fails if two files share a number or if a kit file was edited after it shipped (checksum in `kit.manifest.json`).
2. Client-specific migrations use `5000` and up.
3. One ledger table, `kit_migrations` (`migrations_table`), in the one D1. No second series, no second repo writing to the same ledger.
4. **Expand, then contract.** Release N adds tables and columns (`CREATE TABLE IF NOT EXISTS`, new nullable columns) and ships code that writes both shapes; release N+1 drops the old shape. SQLite has no `ADD COLUMN IF NOT EXISTS`, so a kit migration never `ALTER`s a table another package owns; it creates its own.
5. Applied **before** the code that needs it: Workers Builds' deploy command for the kit is `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy` so the order is fixed in one place and recorded in the ledger. A destructive migration goes in a later release, never in the same push as the code that stops using it.

**Feature flags.** A flag is a `kit_settings` row (read through the KV cache), so a module can ship dark and be switched on per client from the portal, without a deploy or an environment variable.

**`kit upgrade` (the doctor).** Before anything else it checks: wrangler and Node versions against the kit's `engines`; `compatibility_date` against the kit's policy; pending kit migrations and duplicate numbers; `secrets.required` all present on the Worker; `kit.manifest.json` against `wrangler.jsonc`; a `wrangler deploy --dry-run --outdir .kit/bundle` for size (<https://developers.cloudflare.com/workers/platform/limits/#worker-size>) and `wrangler check startup` for the 1-second startup rule; then prints the release notes that apply to this client's enabled modules. It writes nothing until the doctor is green.

**Compatibility date policy.** The kit sets `compatibility_date` in its release; clients inherit it on upgrade. Dates of 2026-08-04 or later make `nodejs_compat` the default, so the flag is dropped from new configs (<https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/>). Bump at most monthly, always through a kit minor release, always tested in a Preview first.

**Rehearsing a major upgrade against real data.** Time Travel cannot fork or clone a database yet ("in the future, Time Travel will allow you to fork (clone)": <https://developers.cloudflare.com/d1/reference/time-travel/>). The rehearsal path is: `wrangler d1 export <prod> --remote --output dump.sql` (confirmation prompt, and "a running export will block other database requests": <https://developers.cloudflare.com/d1/best-practices/import-export-data/>), `wrangler d1 execute <staging> --remote --file dump.sql` (5 GiB file limit), bind the Preview's `DB` to the staging database, apply the new kit migrations there, deploy the Preview, test on the phone. The staging database counts toward the client's 10 databases and 5 GB total on Free, so it is created for the rehearsal and deleted after.

**Testing the kit itself.** `@cloudflare/vitest-plugin` v1 (the 0.13 rearchitecture around a Vite plugin) runs tests inside workerd with per-file storage isolation and `readD1Migrations()`/`applyD1Migrations()` for schema setup (<https://developers.cloudflare.com/workers/testing/vitest-integration/>). Each module package tests against the kit's migrations, so a module cannot ship a query the schema does not support.

---

## 7. Backups without a token zoo

| Layer | What | Cost and limits (read 2026-10-18) | Needs a token? |
|---|---|---|---|
| **Time Travel** | Always on, restores the D1 database in place to any minute: 7 days on Free, 30 on Paid; 10 restores per 10 minutes per database. Restore is destructive and cancels in-flight queries; the response includes the previous bookmark to undo. REST: `GET .../time_travel/bookmark`, `POST .../time_travel/restore`. <https://developers.cloudflare.com/d1/reference/time-travel/> and <https://developers.cloudflare.com/d1/platform/limits/> | Free. | Only for restores through the API; `wrangler d1 time-travel restore` with the developer's login otherwise. |
| **Nightly export to the one bucket** | The `JOBS` Workflow, on `schedules: ["0 3 * * *"]`, calls `POST /accounts/{id}/d1/database/{id}/export` with `output_format: "polling"`, keeps `at_bookmark`, polls until `signed_url` appears (valid one hour), streams the dump into `STORE` under `backups/d1/<date>.sql.age`, records a row in `backup_runs`. This is Cloudflare's own documented pattern: <https://developers.cloudflare.com/workflows/examples/backup-d1/> and <https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/> . Caveat from the API reference: the database is unavailable to serve queries while the export runs and an export that is not polled is cancelled, so schedule it at the quiet hour; an admin portal's database exports in seconds. | Workflow steps on Free; R2 Class A writes. | **Yes: `KIT_OPS_TOKEN`**, the one account-owned token, as a Worker secret. |
| **Encryption** | Encrypt before writing to R2 so a bucket leak is not a data leak. Workers Web Crypto supports **X25519** (`generateKey`, `deriveBits`, import/export) and Ed25519 (<https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>), which is what `age` uses. The `age-encryption` npm/JSR package (TypeScript age) uses Web Crypto when available with a `@noble/curves` fallback, but its listing says Cloudflare Workers support is "unknown" (web search, read 2026-10-18): **GAP, needs a ten-line test in the first client Worker**. If it fails, the kit writes its own age-compatible or AES-GCM-plus-X25519 envelope with Web Crypto alone. Only the public key is in the Worker (`BACKUP_PUBLIC_KEY`, not even a secret); the private key stays with the owner, offline. | Free. | No. |
| **Retention and tamper protection** | On `backups/`: a **bucket lock** rule (retention 35 days, prefix `backups/`) so nothing can delete or overwrite a fresh backup, plus a **lifecycle** rule expiring objects after, say, 400 days. Both are per prefix: `wrangler r2 bucket lock add` and `wrangler r2 bucket lifecycle add` (<https://developers.cloudflare.com/workers/wrangler/commands/r2/>). Lock rules: 1,000 per bucket (changelog 2025-03-06). | Storage only. | Set once at `kit setup`. |
| **Restore drill** | Monthly job: download the newest dump, decrypt locally or in the Workflow, `wrangler d1 execute <scratch> --remote --file`, run the kit's smoke queries, delete the scratch database. Recorded in `backup_runs`. | Counts against 10 databases/5 GB while the scratch database exists. | Developer login. |
| **KV and R2 themselves** | KV holds only sessions, caches and flag caches: nothing to back up. R2 `uploads/` and `exports/`: R2 has no native bucket-to-bucket replication; Sippy and Super Slurper are inbound migration tools (<https://developers.cloudflare.com/r2/data-migration/sippy/>). A copy job in the Workflow can mirror `uploads/` into `backups/uploads/` under the lock if a module stores irreplaceable files. Cross-account replication: **GAP, none found**. | Storage. | No. |
| **Off-site copy (optional, decision card 4)** | A Workflow step pushes the encrypted dump to the owner's archive bucket through the S3 API with a write-only key. | Small. | **Yes, one key per client**, in the client's Worker secrets. Not by default. |

What this replaces: the GitHub Actions engine, the GitHub secrets for it, the S3 credentials, the separate backup Worker and its signing key. What stays: the restore documentation and the idea of recorded run evidence, now a D1 table shown in the portal's backup module.

---

## 8. Pitfalls

1. **The 500 MB free database.** Alarm at 300 MB in the health module; the move to Paid ($5/month per account, 10 GB) is the planned answer, not a second database.
2. **KV writes are the scarcest quota (1,000/day).** Sliding-TTL sessions must not rewrite on every request; write once, refresh at most every N minutes, or keep sessions in D1 with a KV read-through cache.
3. **Queue budget is per account (10,000 ops/day), not per queue.** Batch, and never use the queue as a per-request log. Retention is 24 hours on Free: a consumer that is down for a day loses messages; the DLQ and `kit_events_log` in D1 are the safety net.
4. **An export freezes the database.** Keep the admin database small, export at night, poll until done. Never run two exports at once; the `COORD` lock guarantees that.
5. **Time Travel is in place and cannot fork.** A restore replaces production; take a bookmark first (`wrangler d1 time-travel info`), and rehearse upgrades on an exported copy.
6. **Previews are public by default** and inherit nothing from production; the `previews` block must list every binding the code reads or the Preview throws a 1101. Queue consumers, crons and routes never target a Preview. Version URLs (`preview_urls`) are not generated for Workers that implement Durable Objects, so the kit relies on Previews, not Version URLs.
7. **Workers Builds does not read `[build]` from wrangler config** ("Currently, Workers Builds does not honor the configurations set in Custom Builds"): the build command is dashboard state and must be set by `kit setup` through the Builds API (<https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/>) and checked by the doctor.
8. **One build at a time on Free with a 20-minute timeout.** A 15-minute `verify` plus build is a failed deploy. Budget 10 minutes.
9. **Auto-provisioning is beta.** It names resources for you; `kit setup` should pass explicit names (`<client>-kit`) so the manifest and the account agree, and record the IDs wrangler writes back.
10. **Granular Worker roles do not cover other products.** A token with Workers Editor cannot create a KV namespace; `kit setup` runs under the developer's login, and the one stored token is scoped to D1 (and R2 if needed), never Workers.
11. **Strict service tokens.** New Zero Trust organizations cannot turn strict mode off: a machine request that fails gets 401/403, never a login redirect, and Allow policies are ignored for it. The VPS agent needs a Service Auth policy.
12. **Rate-limit bindings are per colo.** Use them for abuse limits, use `COORD` for exact account-wide counters.
13. **Export dumps and 52-bit numbers.** D1's export notes that very large integers may lose precision; store IDs as text.
14. **Secrets Store is beta and one store per account.** Fine to adopt later; not a dependency of the kit's first release.
15. **Deploying migrations in the deploy command** means a failed migration fails the deploy, which is what we want, but the ledger row is written by wrangler, so the kit's `kit_migrations` table name must match `migrations_table` exactly or two ledgers appear.

---

## 9. Decision cards for the owner

### Card 1: Where should the automatic tests run before anything goes live?

**Option A (recommended): inside Cloudflare's own builder, in the client's account.** Every push is tested there; if a test fails nothing is deployed, and no password or token for Cloudflare is stored anywhere outside that account.
**Option B: on GitHub's servers.** The tests run there and Cloudflare deploys separately; with your habit of pushing straight to `main`, a failing test would not stop the deploy, and the free minutes are one shared pool for all clients.
**Option C: GitHub does the tests and the deploy.** Everything in one place, but a Cloudflare key for every client has to be stored in GitHub, which is the token pile you want to end.
**Why A:** fail-closed, zero stored keys, and each client's own free minutes.

### Card 2: How do you push changes?

**Option A (recommended): keep pushing straight to `main`; the builder blocks a bad push.** Fastest for one person; a failed build is a message on your phone, and the fix is another push.
**Option B: every change on a short branch first, with a test link to open on your phone, then merge.** Safer for big changes, a few more clicks per change.
**Recommendation:** A as the habit, B for anything that changes the database or a sign-in flow. The same builder provides the test link, so nothing extra is set up.

### Card 3: Free plan or $5 a month per client?

**Option A (recommended to start): free.** A 500 MB database, 7 days of point-in-time recovery, one build at a time. Enough for a small admin portal for a long time; the health page warns at 300 MB.
**Option B: $5 a month per client from day one.** A 10 GB database, 30 days of recovery, six builds at a time, no daily query cut-off. Costs money for capacity most clients will not use yet.
**Recommendation:** A, with the upgrade to B written into the client agreement as the trigger when their data passes 300 MB or they ask for 30-day recovery.

### Card 4: Where does the backup copy live?

**Option A (recommended): inside the client's own account only.** Encrypted nightly copies in a locked folder of their one bucket, plus Cloudflare's built-in 7-day rewind. No extra keys anywhere.
**Option B: also a copy in your own archive account.** Protects against a client account being closed or hijacked, but means one write-only key per client stored in their portal, and storage in your account that you pay for.
**Option C: a nightly job on GitHub copies it.** The old way; keys in GitHub and minutes from the shared pool.
**Recommendation:** A for every client now; B offered as a paid option in the contract, switched on per client.

---

## 10. Where the figures come from, and what is still open

Every figure above carries its URL inline, all read 2026-10-18. Cloudflare pages were read through the Cloudflare documentation search; GitHub, pnpm, Changesets, Renovate, `age-encryption` and the Cloudflare TypeScript SDK through web search, so those few items rest on secondary pages and are marked as such.

**GAP list in one place:** `age-encryption` on Workers; Secrets Store bindings versus the 64-variable cap; R2 event-notification rules per bucket; Durable Objects free-plan compute numbers; the vitest plugin inside Workers Builds; GitHub App token lifetime from GitHub's own documentation; the R2 free storage figure (10 GB, given by the caller, not re-verified); native R2 cross-account replication (none found).

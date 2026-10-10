---

title: "Operations — Infrastructure, Bindings & Observability"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-04
verified_against: [code, infra, live-mcp]
owner: harshil
tags: [operations, bindings, cloudflare]
---

# Operations — Infrastructure, Bindings & Observability

> **TL;DR (non-technical):** The operations runbook: which Cloudflare resources this Worker binds and what each is for, the free-tier limits that shape the design, the required secrets, and how to build and deploy. (The resource **IDs** live in `wrangler.toml`; they are redacted here because this file is published to a public mirror.)

> **Status:** Production Active
> **Scope:** Cloudflare binding IDs, free tier limits, Sentry observability, build/deploy
>
> **§1 is the single source of truth for production bindings** (`../../RULESAd.md` §12).
> If it disagrees with any other document, §1 wins — and if it disagrees with
> `wrangler.toml`, `wrangler.toml` wins and §1 is the bug. Regenerate it with the
> commands in §1 → "Re-deriving this section" rather than editing from memory.

---

## Verification log

| Date | Method | Result |
|------|--------|--------|
| 2026-10-10 | `scripts/release.mjs` build stage, `scripts/lib/release-guards.mjs` (`buildVerifyStep`); Workers Builds check-run times on three October pushes (`release-and-rollback.md` §1) | §7: the banner said Workers Builds ran its default command (true on 2026-09-19); it runs `build:ci`, which no longer repeats `verify`. Not checked: the dashboard's deploy command |
| 2026-10-08 | `sentry.client.config.ts`, `src/lib/sentry-scrub.ts` (`BROWSER_NETWORK_FAILURES`), `test/sentry-scrub.test.ts`; `@sentry/core`'s `getPossibleEventMessages` (what `ignoreErrors` tests: the value and `<type>: <value>`) | §4.1 "Browser noise filter" added. Not re-checked: the rest of §4 |
| 2026-10-07 | `src/lib/jobs/registry.ts`, `src/workers/scheduled-heartbeat-watchdog.ts`, `wrangler.toml` (`[triggers]` unchanged) | §1 Scheduled triggers: **13 jobs (11+2)** with `heartbeat-watchdog`, its gate in the idle-tick block, the `ASTRO_SERVICE` row's purposes. No binding, secret, variable or cron added; §5 unchanged. Not re-checked: every other row, and nothing live (not deployed) |
| 2026-10-07 | `src/env.d.ts`, `src/lib/github/cache.ts` (the only reader of `GITHUB_READ_TOKEN`) | §5.3 lists `GITHUB_READ_TOKEN`, optional, so `[secrets] required` is unchanged. Not checked: the secret on the Worker (set by the owner) |
| 2026-10-07 | `wrangler.toml` (seven `[[ratelimits]]`, added on 2026-10-04 and absent before) | §3.6's opening sentence said the limits ran on "two things it already had"; the Rate Limiting binding is new, the owner-approved exception, and now says so. Nothing else re-checked |
| 2026-10-04 | `wrangler.toml` (`[[ratelimits]]`, `[observability.*]`, `[secrets] required`); `worker-configuration.d.ts` regenerated with `npm run types`; `src/lib/jobs/registry.ts`; read-only D1 query of the live `cron-control` row; Cloudflare documentation search (traces and logs sampling, Observability pricing) | Resource-usage change ([record](../records/reports/2026-10-04-resource-usage-optimisation.md)): seven `RL_PER_MIN_<n>` Rate Limiting bindings added to §1; **12 jobs (10+2)**, `redis-ttl-hygiene` removed; §3.6 now describes the bindings and the D1 counters, Upstash retired from cf-admin; §4.0 states the logs and traces sampling and why; §5.1 drops the two Upstash names (**22 required**; the two secrets stay set until the owner deletes them, so the live count is still 25); §8 Upstash row. Not re-checked: the Upstash instance itself (no connector reaches it), the Rate Limiting binding's plan availability and price (its documentation page could not be read), every other row |
| 2026-10-03 | `src/lib/auth/security-logging.ts` (`postSecurityEmail`); `wrangler.toml` `[[queues.producers]]` unchanged | The `EMAIL_QUEUE` paragraph now names the security emails and the backup alerts as producers beside the Email Portal. No binding, secret, variable or cron added. Nothing else re-checked |
| 2026-09-30 | `wrangler.toml` `[[services]]`; `worker-configuration.d.ts` regenerated with `npm run types` | `EMAIL_CONSOLE` → `cf-email-api` (entrypoint `Console`) added (a binding, not a var — RULE #0.8's 42 unchanged); deploy-order item in §2 now names cf-email-api. Not re-checked: every other row |
| 2026-09-30 | `wrangler.toml` `[[services]]`; `worker-configuration.d.ts` regenerated with `npm run types` | `VPS` → `cf-vps` added (a binding, not a var — RULE #0.8's 42 unchanged); deploy-order item in §2 now names cf-vps. Not re-checked: every other row |
| 2026-09-27 | Cloudflare trigger events for `*/5 * * * *` and `0 2 * * SUN` (pasted by the owner); `src/lib/jobs/dispatch.ts`; `src/workers/job-runner.ts`; `wrangler.toml` | Both crons ended `exceededCpu` from 2026-09-26 22:45 UTC. The scheduled handler now calls each due job in its own invocation (§1 Scheduled triggers); `enable_ctx_exports` added to `compatibility_flags`; §3.1's CPU row now says per invocation. Not re-checked: every other row |
| 2026-09-23 | `wrangler.toml` `[[services]]`; `src/lib/jobs/registry.ts` | `BACKUP` → `cf-backup` added (chunk CB-2; a binding, not a var — RULE #0.8's 42 unchanged); **12 jobs (10+2)** with `backup-tick`; deploy-order item added to §2. Not re-checked: every other row |
| 2026-09-19 | `wrangler.toml` `[vars]` re-counted; live Worker env read; `src/lib/jobs/registry.ts`; `SELECT setting_key FROM admin_portal_settings` (remote); `ls migrations/` + `d1_migrations`; `src/lib/auth/security-logging.ts`; `src/lib/jobs/telemetry.ts`; Supabase MCP `list_projects`; `grep -rn PUBLIC_SENTRY_DSN src/` | **17 `[vars]` + 25 secrets = 42**, not 40 (15+25); **11 jobs (9+2)**, `cron-usage-probe` was missing; the three idle-tick gate keys **do not exist as rows** — the rollback is an INSERT; `migrations/` holds **33** files to `0055`, not 29 to `0051`; the failed-login alert path is **Brevo**, not Resend; the Sentry cooldown is per call site, not blanket; both Supabase free slots are in use; `PUBLIC_SENTRY_DSN` has no reader. §1, §2, §3.5, §4.1–4.3, §5, §6, §7 and §8 corrected. Not re-checked: §3.6 Upstash limits, §6's token permission tables (dashboard-only), "Account slots: 3 of 5" |
| 2026-08-13 | `wrangler.toml` + `src/env.d.ts` re-read | §1 rebuilt — `SYNC_QUEUE`, the sync DLQ, `CHATBOT_SERVICE`, `ASTRO_SERVICE` and the `AI` binding were all missing from this registry despite being live; cron triggers and the custom-domain route added |
| 2026-08-13 | Cloudflare MCP `d1_database_query` on `sqlite_master` | `madagascar-db` holds **30** application tables |
| 2026-08-13 | Supabase MCP `list_tables` | project `[SUPABASE_PROJECT_REF]` `public` schema holds **20** tables, RLS enabled on all |
| 2026-06-06 | Cloudflare MCP `kv_namespaces_list` | `ADMIN_SESSION` `ba82…`, cf-astro `SESSION` `bee1…`, `ISR_CACHE` `d9ce…` — all match ✅ |
| 2026-06-06 | Cloudflare MCP `d1_databases_list` | `madagascar-db` `[D1_MADAGASCAR_DB_ID]` — match ✅ |
| 2026-06-06 | Supabase MCP `list_projects` | project `[SUPABASE_PROJECT_REF]` ACTIVE_HEALTHY — match ✅ |
| 2026-06-06 | Cloudflare MCP `r2_buckets_list` | not verified — analytics token lacks R2:List scope (R2 referenced by name, no UUID needed) |

---

## 1. Cloudflare Binding ID Registry

> **OPERATIONAL CRITICAL:** Never modify these IDs without verifying against the Cloudflare Dashboard first.
>
> **Incident context (2026-04-20):** ALL binding IDs in both `wrangler.toml` files were discovered pointing at non-existent resources (all 404). This caused the entire CMS image pipeline to silently fail — uploads appeared to succeed but never propagated to the live site. Fix was a config-only correction of the IDs below.

### D1 Database

| Binding | DB Name | Verified UUID |
|---------|---------|---------------|
| `DB` | `madagascar-db` | `[D1_MADAGASCAR_DB_ID]` |

Both `cf-admin` and `cf-astro` share this single D1 database.

**Verification:**

```bash
curl -sH "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/[CF_ACCOUNT_ID]/d1/database/[D1_MADAGASCAR_DB_ID]" | jq .result.name
# Must return: "madagascar-db"
```

### KV Namespaces

| Binding | Title | Verified UUID | Used By |
|---------|-------|---------------|---------|
| `SESSION` (cf-admin) | `ADMIN_SESSION` | `[KV_ADMIN_SESSION_ID]` | cf-admin |
| `SESSION` (cf-astro) | `SESSION` | `[KV_ASTRO_SESSION_ID]` | cf-astro |
| `ISR_CACHE` | `ISR_CACHE` | `[KV_ISR_CACHE_ID]` | cf-astro |

> **✅ VERIFIED (2026-04-28):** All IDs in the table above now match the LIVE Cloudflare environment. `ADMIN_SESSION` is used for isolation in `cf-admin`. `SESSION` is used for `cf-astro`.
>
> **Scope note (2026-09-19):** cf-admin binds exactly **one** namespace —
> `SESSION` → title `ADMIN_SESSION`. The rows for `SESSION` (cf-astro) and
> `ISR_CACHE` are cf-astro's, kept here because the two share an account. The
> account also holds `CHATBOT_CACHE`, `CHATBOT_KV` and `EMAIL_IDEMPOTENCY`,
> which this table does not list — so treat it as *this Worker's* registry plus
> two neighbours, not an account inventory. Enumerate with
> `wrangler kv namespace list`.

### R2 Buckets

R2 buckets are referenced by **name** — stable, no UUID needed.

| Binding | Bucket Name | Used By |
|---------|-------------|---------|
| `IMAGES` | `madagascar-images` | cf-admin, cf-astro |
| `ARCO_DOCS` | `arco-documents` | cf-astro |
| `STAFF_STORAGE` | `madagascar-staff-storage` | cf-admin (created 2026-08-05) — **private, no CDN custom domain** (unlike `IMAGES`). Staff Managed Storage file drive; access only via Worker-issued presigned PUT (aws4fetch, `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` secrets scoped to this bucket only) and Worker-proxied GET. See [`features/STAFF-MANAGED-STORAGE.md`](../features/STAFF-MANAGED-STORAGE.md). |

### Queues

| Binding | Queue Name | Role | Used By |
|---------|------------|------|---------|
| `EMAIL_QUEUE` | `madagascar-emails` | producer | cf-admin, cf-astro |
| `SYNC_QUEUE` | `madagascar-sync-revalidate` | producer **and** consumer | cf-admin |
| — | `madagascar-sync-revalidate-dlq` | consumer (dead-letter) | cf-admin |

`EMAIL_QUEUE` is the producer side of the async email pipeline; the Email Portal
(`/dashboard/emails`) enqueues custom sends onto it, as do the backup scheduler's alerts
and, since 2026-10-03, every security email (`src/lib/auth/security-logging.ts`, with
Brevo directly as the fallback), and the external `cf-astro-email-consumer` worker drains
it. See
[`../features/EMAIL-PORTAL.md`](../features/EMAIL-PORTAL.md).

`SYNC_QUEUE` carries ISR revalidation redrive jobs. This Worker is both its
producer and its consumer (`max_batch_size = 10`, `max_retries = 4`), with
failures spilling into `madagascar-sync-revalidate-dlq`, which this Worker also
consumes (`max_retries = 1`). Provisioned 2026-06-10 — see
[`../reference/SYNC-SYSTEM-REVIEW.md`](../reference/SYNC-SYSTEM-REVIEW.md).

> Both queues must exist **before** the first deploy: `wrangler deploy`
> hard-fails on a consumer that references a non-existent queue. If this Worker
> is ever recreated from scratch, run `wrangler queues create` for
> `madagascar-sync-revalidate` and its `-dlq` first.

### Service Bindings

| Binding | Target Worker | Purpose |
|---------|---------------|---------|
| `CHATBOT_SERVICE` | `cf-chatbot` | Worker-to-Worker calls to the chatbot admin surface, without a public round trip |
| `ASTRO_SERVICE` | `cf-astro` | Worker-to-Worker calls to the public site (ISR revalidation, booking outbox drain poke, edge sync probes, and since 2026-10-07 the `heartbeat-watchdog` job's fallback heartbeat run and outbox drains) |
| `BACKUP` | `cf-backup` | The private backup Worker (no route, no `workers.dev`): the `/dashboard/backup/app/` gateway and the `backup-tick` job. **Deploy cf-backup first** — a deploy that binds a Worker that does not exist fails |
| `VPS` | `cf-vps` | The private server-console Worker (no route, no `workers.dev`): the `/dashboard/vps/app/` gateway, including the browser terminal's WebSocket ([VPS Console](../features/VPS-CONSOLE.md)). **Deploy cf-vps first** — a deploy that binds a Worker that does not exist fails |
| `EMAIL_CONSOLE` | `cf-email-api` (entrypoint `Console`) | The email service's API Worker, admin door only (it has no route from here; its public API is for clients): the `/api/emails/api-*` routes behind the Email API page ([Email API page](../features/EMAIL-API-ACCESS.md)). **Deploy cf-email-api first** — a deploy that binds a Worker that does not exist fails |

### Workers AI

| Binding | Config | Used By |
|---------|--------|---------|
| `AI` | `remote = true` | cf-admin — blog generation and RAG context retrieval |

### Analytics Engine

| Binding | Dataset | Used By |
|---------|---------|---------|
| `ANALYTICS` | `madagascar_analytics` | cf-admin, cf-astro |

### Rate Limiting (one-minute limits)

Seven [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
bindings, `RL_PER_MIN_3`, `_5`, `_10`, `_20`, `_30`, `_60` and `_120`, one per
one-minute limit value in use (`[[ratelimits]]` in `wrangler.toml`; a binding's
limit and period are fixed, so one binding serves every limiter with that number,
keyed `<limiter>:<caller>`). Each `namespace_id` is a number we choose, unique
in the account: cf-admin uses the **2000-2999** range (2000 plus the limit), and no
other Worker may use it, because two bindings with the same id share counters
(cf-astro's own change under the same plan takes 10000 plus the limit).
Hour and day limits cannot be expressed as a binding and are D1 counter rows
(§3.6). Added 2026-10-04, replacing Upstash Redis
([record](../records/reports/2026-10-04-resource-usage-optimisation.md)).
`test/ratelimit-bindings-contract.test.ts` fails when a one-minute limit in
`src/` has no binding.

### Scheduled triggers

**Two** cron expressions on this Worker (`[triggers]` in `wrangler.toml`), fired
through the custom entrypoint `src/workers/cf-entry.ts`. Jobs are no longer
listed inline in the entrypoint — the single list is `src/lib/jobs/registry.ts`,
and each one runs under `runJob` with a declared D1 budget:

**Do not hand-count this list.** [`../../src/lib/jobs/registry.ts`](../../src/lib/jobs/registry.ts)
is the list, and [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md)
is its documentation home; the table below is a pointer that has been wrong
three times. As of 2026-10-07 it is **13 jobs — 11 on `*/5`, 2 on Sunday**
(`FIVE_MIN_JOBS` + `SUNDAY_JOBS`; `redis-ttl-hygiene` left with Upstash on
2026-10-04, `heartbeat-watchdog` joined on 2026-10-07).
Being on `*/5` no longer means running every five minutes: most of these jobs
have an interval in Cron Control (15 or 60 minutes), and `backup-tick`,
`blog-scheduled-publish` and `heartbeat-watchdog` sleep until the time they
report they next have work, never longer than an hour. [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md)
owns how that is decided.

| Cron | Jobs dispatched (`src/lib/jobs/registry.ts`) |
|------|---------|
| `*/5 * * * *` (11) | `cf-access-audit-poll`, `booking-email-retry`, `booking-outbox-poke`, `cf-access-reconcile`, `storage-notifications`; the three folded in from the retired 15-minute trigger — `blog-scheduled-publish`, `gsc-sync`, `pagespeed-sync` (the last two self-gate on their own interval settings); and `cron-usage-probe`, which caches Cloudflare's account-wide D1 usage figure and is what the automatic-shedding decision reads; and `backup-tick`, which lends cf-backup this tick (its schedule, reconciliation and failure alerts — [`../features/BACKUP-CONSOLE.md`](../features/BACKUP-CONSOLE.md)); and `heartbeat-watchdog`, which runs cf-astro's consent & booking heartbeat and drains both outboxes only when the VPS job and GitHub have both missed it ([`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md) §3a) |
| `0 2 * * SUN` (2) | `asset-cleanup`, `staff-storage-reconcile`. (`redis-ttl-hygiene`, the weekly Redis expiry census, was removed on 2026-10-04 when cf-admin stopped using Upstash; its `admin_portal_settings` row `redis-hygiene-mode` is now read by nothing and is left for the owner to delete — [`../MAINTENANCE.md`](../MAINTENANCE.md)) |

> **One invocation per job (2026-09-27).** The scheduled handler no longer runs
> the jobs itself. `dispatchCronJobs` (`src/lib/jobs/dispatch.ts`) reads the
> control document, skips the jobs it holds back without invoking them, and
> calls each due job through the Worker's own `JobRunner` entrypoint
> (`src/workers/job-runner.ts`) over the `ctx.exports` loopback binding, which
> needs the `enable_ctx_exports` compatibility flag in `wrangler.toml`. Each
> job gets a binding of its own, with its id as `ctx.props`, so each call is
> its own invocation with its own 10 ms of CPU (§3.1). The scheduled handler
> and `JobRunner` run Sentry without tracing or log capture. A job that still
> overruns fails alone and shows in Workers Observability as that job's
> `exceededCpu`, not as the whole tick's. Before this change, all ten jobs
> shared the scheduled invocation's 10 ms. The tick measured 22 ms on
> 2026-09-16, and from 22:45 UTC on 2026-09-26 Cloudflare ended every run at
> the limit, so no job ran. See
> [`incidents/2026-09-26-cron-exceeded-cpu.md`](incidents/2026-09-26-cron-exceeded-cpu.md).

> **Every job below can be paused, throttled or run by hand from
> `/dashboard/cron` (2026-09-16; the throttle got a user interface on
> 2026-09-20).** The control plane owns per-job state, criticality tiers, the
> permission matrix and the automatic-shedding rules — see
> [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md), which is their
> single home. It fails open: a missing or unreadable control document runs
> every job exactly as before. *Corrected 2026-09-20 — this said the gate "costs
> +1 row read per tick", which was the same false claim CRON-CONTROL.md §5
> retired on 2026-09-19. `readControl` issues its own `SELECT`, so the real cost
> is two single-row reads per tick: one from `dispatchCronJobs` and one from
> `cron-usage-probe`, which is ungated and re-reads before checking its own
> clock. That document owns the figure.*

> **Idle-tick gates (chunk 8, complete 2026-09-15).** Four of the 5-minute jobs
> decide cheaply before they work, and every gate fails open: `booking-outbox-poke`
> runs only when `booking_attempts` holds a row awaiting replay (one indexed
> `SELECT 1 … LIMIT 1`); `cf-access-reconcile` only when the whitelist hash changed
> or `cf-access-reconcile-max-staleness-hours` (24) has passed; `cf-access-audit-poll`
> still polls every tick but rewrites its watermark only past
> `cf-audit-watermark-max-staleness-minutes` (60); `storage-notifications` runs once
> per `storage-notify-interval-minutes` (60), stamping `storage-notify-last-run` on
> success. *Added 2026-10-07:* `heartbeat-watchdog` runs only when cf-astro's
> `heartbeat-last-run` row is missing, unreadable or older than
> `heartbeat-watchdog-stale-minutes` (70, clamped to 30..1440) — a fifth gate,
> owned by [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md) §3a.
>
> ⚠️ **The three bounds above are code defaults, not rows.** Verified live
> 2026-09-19: `admin_portal_settings` holds 28 keys and **none** of
> `cf-access-reconcile-max-staleness-hours`,
> `cf-audit-watermark-max-staleness-minutes` or
> `storage-notify-interval-minutes` is among them — the 24/60/60 figures come
> from `|| '24'`-style fallbacks in the code. `heartbeat-watchdog-stale-minutes`
> (2026-10-07) is the same: its 70 is a code default, and no row is written for
> it (not checked live: nothing is deployed yet). This block used to say "all four
> bounds are `admin_portal_settings` rows; setting one to `0` restores the
> ungated behaviour". **An `UPDATE` run mid-incident changes zero rows and the
> operator believes the gate is off.** The rollback is an `INSERT`:
>
> ```sql
> -- PK is (setting_key, scope_type, scope_id); the defaults give a global row.
> INSERT INTO admin_portal_settings (setting_key, setting_value, setting_type, category)
> VALUES ('cf-access-reconcile-max-staleness-hours', '0', 'number', 'cron');
> ```
>
> The fourth gate,
> `booking-outbox-poke`, has no setting at all — it is a pure indexed
> `SELECT 1 … LIMIT 1` probe in `registry.ts`, so there is no lever to pull.

> **Account slots: 3 of 5 (chunk 7, 2026-09-10).** Workers Free allows **5 cron
> triggers per account**, not 3 per Worker. The `*/15` trigger was deleted and
> its jobs folded into the `*/5` tick: verified live, all three were no-ops
> (`gsc-sync-enabled` false since 2026-08-26, `pagespeed-check-enabled` false
> since 2026-08-22, zero `scheduled` blog posts), so it fired 96 times a day to
> do nothing while holding a scarce slot. `cf-chatbot` also moved from
> `* * * * *` to `*/5 * * * *` in the same chunk (1,440 → 288 invocations/day).
>
> **Verify the count from the live API, never from config** — config is what
> *should* be deployed, not what is:
>
> ```bash
> curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
>   "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/<name>/schedules"
> ```

**Failures on these paths are never silent.** Every catch on a scheduled-job
path either reports through `reportNonFatal` / `reportOnceCooled` — which write
to **both** Cloudflare Observability and Sentry — or carries an explicit
`// silent-ok: <reason>` annotation. Ratchet metric **A19** fails the build if
anyone adds one that does neither.

**The Sentry cooldown is per call site, not blanket** — corrected 2026-09-19,
this paragraph used to claim "one event per hour per fingerprint" across all
cron paths. There are three regimes, and
[`../runbooks/when-d1-is-unavailable.md`](../runbooks/when-d1-is-unavailable.md)
§1–§2 owns the contract; read it there. In short: only explicit
`reportOnceCooled` call sites are hour-cooled, a **job handler failure** goes
through uncooled `reportNonFatal` on every tick, and a budget overrun uses
`reportOnce`, which dedupes per isolate only. Observability does **not**
receive every occurrence either — since 2026-09-16 it logs `ran`, `failed` and
over-budget ticks only, with `skipped`/`disabled`/`shed` visible in Analytics
Engine instead.

### Re-deriving this section

This registry is the single source of truth named by `../../RULESAd.md` §12, so it
must be regenerated from config rather than edited from memory:

```bash
# Bindings, queues, services, crons, routes — the authoritative declaration
grep -nE '^\[|binding|queue|service|pattern|crons' wrangler.toml

# The typed view the code actually sees: interface __BaseEnv_Env in the
# GENERATED worker-configuration.d.ts (bindings + vars + secrets + services).
# NOT src/env.d.ts — that file declares only the optional extras, and reading
# it as the full picture is how §5.4 came to say 15.
grep -nE '^\s+[A-Z][A-Z0-9_]+\??:' worker-configuration.d.ts

# What is really set in production
wrangler secret list
```

---

## 2. Pre-Flight Deploy Checklist

1. **Diff binding IDs against the account, not against this page.** Every UUID
   in §1 is a redaction placeholder (`[D1_MADAGASCAR_DB_ID]`, `[KV_ADMIN_SESSION_ID]`)
   because this file is published to a public mirror — there is nothing here to
   diff. `wrangler.toml` holds the real IDs; this registry holds names and
   purposes. Compare with `wrangler d1 list` and `wrangler kv namespace list`.
2. **Never `wrangler d1 create`** a new database with the same name — creates a new UUID, leaving `wrangler.toml` pointing at the old one
3. **Never `wrangler kv namespace create`** without updating BOTH projects' `wrangler.toml`
4. **If IDs look wrong** — verify via Cloudflare Dashboard → Workers → KV/D1 → copy UUID from there
5. **Verify required secrets** are set via `wrangler secret list`
6. **Service-binding targets must exist first** — `BACKUP` → `cf-backup`, `VPS` → `cf-vps` and `EMAIL_CONSOLE` → `cf-email-api`: deploy each target Worker before any cf-admin deploy that carries its binding; otherwise the cf-admin deploy fails. Order: cf-backup, cf-vps and cf-email-api (any order), then cf-admin

---

## 3. Free Tier Limits

Every service below is on its free tier, so direct spend is ~$0.50/month (§8 —
which is *not* the cost-to-serve figure; read the note there). These quotas
dictate caching strategies and system design constraints.

### 3.1 Cloudflare Workers

| Metric | Free Limit |
|--------|-----------|
| Requests | 100,000/day |
| CPU time per invocation | **10 ms** ← critical design constraint. An HTTP request, a cron trigger and each Service Binding or RPC call are each an invocation with their own 10 ms; the scheduled handler relies on that (§1 Scheduled triggers) |
| Memory | 128 MB |
| Subrequests per request | 50 |
| Worker bundle size | 64 MiB uncompressed on every plan (Cloudflare changelog 2026-09-04; the 3 MB compressed Free limit this row quoted no longer exists). To measure the current bundle rather than trusting a figure here: `npx wrangler deploy --dry-run --outdir=<tmp>` and read "Total Upload" |

### 3.2 KV (Sessions & Cache)

| Metric | Free Limit |
|--------|-----------|
| Keys read | 100,000/day |
| Keys written | **1,000/day** ← determines session strategy |
| Storage | 1 GB |

### 3.3 D1 Database

| Metric | Free Limit |
|--------|-----------|
| Rows read | 5 million/day |
| Rows written | 100,000/day |
| Storage | 5 GB |

### 3.4 R2 Object Storage

| Metric | Free Limit |
|--------|-----------|
| Storage | 10 GB/month |
| Reads | 10 million/month |
| Writes | 1 million/month |
| Egress | **FREE (always $0)** |

### 3.5 Supabase Free Tier

| Metric | Free Limit |
|--------|-----------|
| Projects | 2 — **both slots in use** (2026-09-19): `Cloudflare` (production, shared by cf-astro + cf-admin) and `supabase-pink-village` (superseded, still `ACTIVE_HEALTHY`, never paused). Decommissioning the second is owned by [`../runbooks/supabase-account-advisor-sweep.md`](../runbooks/supabase-account-advisor-sweep.md) |
| PostgreSQL size | 500 MB |
| Auth MAUs | 50,000 |
| File storage | 1 GB |

### 3.6 Rate limiting: Workers Rate Limiting and D1 (Upstash retired 2026-10-04)

cf-admin's rate limits run on one binding type that is new (the Workers Rate
Limiting binding, the owner-approved exception to "no new services") and on D1,
which it already had, behind the one function every route calls,
`getRateLimiter()` in `src/lib/ratelimit.ts`:

| Window | Where it is counted | Cost |
|---|---|---|
| One minute | A Workers Rate Limiting binding (§1, `RL_PER_MIN_<n>`), keyed `<limiter>:<caller>` | No D1, KV or outside call. Counts are kept per Cloudflare location and are approximate: an abuse guard, not an accounting system |
| One hour, one day | A fixed-window counter row in `admin_portal_settings` (`setting_key` `ratelimit:<limiter>`, `scope_type` `user`, `scope_id` the user's id, category `ratelimit`), written by one atomic upsert in `src/lib/dal/RateLimitRepository.ts` | 1 row read and 1 row written per limited request. These limits sit only on signed-in routes (user management, content and SEO writes, exports, AI generation), each keyed by the user's id |
| Workers AI daily neuron budget | The sum of today's `ai_inference` rows in `admin_audit_log`, which every AI route already writes | 1 indexed read per AI request, over today's rows only |

When a binding or D1 cannot answer, the request is refused with the route's
usual "too many requests" answer, as it was when Upstash could not answer;
sign-out and email unsubscribe proceed instead, because refusing them would
trap a user. The budget read fails open and reports itself degraded on the AI Health
panel. A counter row is overwritten each window and never deleted, so a user has
at most one row per hour/day limiter.

**Upstash.** Until 2026-10-04 all of this was Upstash Redis, through
`@upstash/ratelimit`; critical alerts were also copied to a Redis list nobody
read, and a weekly job (`redis-ttl-hygiene`) checked that every key expired.
All three are gone from cf-admin, with both packages. The instance itself is
shared with cf-astro and cf-chatbot and is **not** cf-admin's to delete
(cf-astro's own change under the same plan moves cf-astro off it separately). The
keys cf-admin used to write all carried an expiry of at most 14 days (the key
table this section held until 2026-10-04 is in git history, and the last
census, after the
[2026-10-02 incident](incidents/2026-10-02-redis-keys-without-expiry.md), found
no key without one), so they age out without anyone acting. This was not
re-checked against the live instance on 2026-10-04: no connector here reaches
it. The two Upstash secrets are still set on the Worker until the owner deletes
them (§5.2). Why the change, with the measurements:
[the change record](../records/reports/2026-10-04-resource-usage-optimisation.md).

---

## 4. Observability — Sentry

**Package:** `@sentry/cloudflare` (`^10.73.0`)
**Where it is initialized:** [`../../src/workers/cf-entry.ts`](../../src/workers/cf-entry.ts) — `Sentry.withSentry()` wraps the whole Worker and builds a client per invocation.

> **Corrected 2026-09-07.** This line read "Config file: `sentry.server.config.ts`" and pointed at the wrong file.
> [`../../sentry.server.config.ts`](../../sentry.server.config.ts) is an intentional **no-op** (`export {}`) whose own
> header says "Do not add `Sentry.init(...)` here" — the Node-based `@sentry/astro` server SDK does not run in workerd.
> Server capture goes through [`../../src/lib/sentry.ts`](../../src/lib/sentry.ts), which re-exports `@sentry/cloudflare`;
> browser capture is configured in [`../../sentry.client.config.ts`](../../sentry.client.config.ts).

### 4.0 Workers Logs and Traces (Cloudflare's own observability)

Set in `wrangler.toml` `[observability]`, separate from Sentry:

| Stream | Sampling | Why |
|---|---|---|
| Logs (`[observability.logs]`, invocation logs on) | **100 %** (`head_sampling_rate = 1`, stated explicitly since 2026-10-04; it was the default before) | They are the only record of a cron tick's outcome and the evidence the sign-in and job forensics read. A sampled log loses exactly the invocation someone later needs |
| Traces (`[observability.traces]`) | **10 %** (`head_sampling_rate = 0.1`, since 2026-10-04; it was the default of 100 % before) | Traces show latency shape, which a one-in-ten sample shows as well. A trace is many spans per request, so it is the larger stream: from 2026-12-01 Cloudflare counts logs and traces against one shared observability allowance (on Free, 0.5 GB of ingestion a day, after which ingestion stops until 00:00 UTC), and sampling traces keeps that room for the logs. Errors still reach Sentry in full (§4.1) |

Source: Cloudflare's Traces, Workers Logs and Observability pricing pages, read
through the documentation search on 2026-10-04 (the sampling defaults of `1` and
the 2026-12-01 allowance are quoted from them).

### 4.1 Architecture

Sentry is integrated at the Cloudflare Edge layer (CDN-native). Key decisions:

- **10% trace sampling** (`tracesSampleRate: 0.1`) — sufficient for performance monitoring without exhausting free tier quota; 100% sampling was excessive and costly
- **`sendDefaultPii: false`** — prevents IP addresses, cookies, and auth headers from being forwarded to Sentry (GDPR/LFPDPPP compliance)
- **No browser integrations — because there are none to disable.** *Corrected 2026-09-19:* this bullet claimed the defaults were switched off. Nothing in `src/workers/cf-entry.ts` sets `integrations: []` or `defaultIntegrations: false`; `@sentry/cloudflare` simply ships no browser integrations, and the init only *adds* `consoleLoggingIntegration`. The underlying rule still stands: Workers run on `workerd`, not a browser, and a browser-targeting integration (`BrowserTracing`, `GlobalHandlers`, `LinkedErrors`) would reference `window`/`document` and throw `ReferenceError: window is not defined` at startup
- **`consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] })`** — console output is forwarded to Sentry, so handlers do not need `Sentry.captureException()` scattered through them. *Corrected 2026-09-07:* this bullet named a "Console Capture integration", which is not what the code configures.
- **`enableLogs: true`, with `beforeSend: scrubEvent` and `beforeSendLog: scrubLog`** — both scrubbers run before anything leaves the Worker; `environment` and `release` are derived per invocation in `cf-entry.ts`
- **Browser noise filter** — `ignoreErrors` in [`../../sentry.client.config.ts`](../../sentry.client.config.ts) drops browser errors with no cause on cf-admin's side: extension and in-app-browser noise, aborted View Transitions, stale chunks after a deploy, and (since 2026-10-08, Sentry CF-ADMIN-1X/1Y) the bare network failure each browser raises when a fetch never completed (`BROWSER_NETWORK_FAILURES` in [`../../src/lib/sentry-scrub.ts`](../../src/lib/sentry-scrub.ts)). Those patterns are anchored to each browser's exact wording, so an HTTP failure the code reports itself still arrives
- **Hardcoded DSN** — Astro's Cloudflare adapter had inconsistent Vite env injection during SSR. DSN is a public routing key, not a secret, so hardcoding is safe and guarantees 100% telemetry uptime

> **workerd Compatibility Rule:** Any future Sentry integration must be validated against `workerd`. Browser-targeting integrations WILL crash the Worker at startup.

### 4.1b `@sentry/cloudflare` has no `init()` — the onboarding snippet is a trap

Verified 2026-09-07 against the installed SDK (10.73.0): the package exports
`withSentry`, `sentryPagesPlugin`, `CloudflareClient`, `setCurrentClient` and
`getClient`, but **no `init`**. Every generic Sentry snippet — including the one
Sentry's own onboarding wizard emits for metrics — opens with
`Sentry.init({ dsn })`. Pasting that anywhere in this repo produces
`TypeError: Sentry.init is not a function` at runtime. Metrics and capture calls
belong **inside** the `withSentry()` wrapper `cf-entry.ts` already establishes.

**Metrics are available and deliberately unused.** `Sentry.metrics.count()`,
`.gauge()` and `.distribution()` exist in 10.73.0, and nothing in `src/` calls
them. That is a decision, not an oversight:

- The wizard's three placeholder metrics — `button_click`, `page_load_time=150`,
  `response_time=200` — **were already in this codebase once**, emitted on every
  call of the health route, and were deleted on 2026-09-02 as fabricated
  telemetry under RULE #0.5 (viability program chunk 3; the history note is in
  [`../../src/pages/api/health.ts`](../../src/pages/api/health.ts)). Do not
  reintroduce them.
- Quota, checked 2026-09-07: application metrics are included on the Developer
  (free) plan, with **5 GB** across plan tiers, and overage is charged only
  against a pay-as-you-go budget. Under ADR-0001's $0 constraint that budget
  stays at zero, so an overage drops metrics rather than generating a bill.

If cf-admin emits metrics later they carry real names measuring real behaviour,
added inside `withSentry`, and recorded here.

### 4.2 SSR Hydration Guard

Owned by [`../runbooks/ssr-silent-blank-screen.md`](../runbooks/ssr-silent-blank-screen.md)
— read it there; this summary is a pointer.

`AdminLayout.astro` loads [`../../public/scripts/error-capture.js`](../../public/scripts/error-capture.js)
(a nonce-carrying `<script is:inline src>`), which registers `error` and
`unhandledrejection` **listeners** — not `window.onerror` handlers, which is
what this section claimed until 2026-09-19. It does **not** itself report to
Sentry: it returns early when `window.Sentry` already exists, otherwise buffers
into `window.__earlyErrors` and drains only if `window.Sentry` appears within
~5 s. **Nothing in this repo assigns `window.Sentry`** (the browser SDK is an
ES-module import), so treat that drain as unproven. The only "recovery UI" is a
one-shot `location.reload()` on a chunk-404.

### 4.3 ErrorBoundary

High-risk Preact components are wrapped in a generic `ErrorBoundary`
(`src/components/ui/ErrorBoundary.tsx`), mounted from **two** files:
`src/components/dashboard/DashboardController.tsx` and
`src/pages/dashboard/bookings/index.astro`. On a rendering exception it logs
`[Preact Island ErrorBoundary Caught …]` to the console and renders a Spanish
fallback — heading `Error en <sectionName>`, the message in a `<pre>`, and a
**`Reintentar componente`** button. There is no "Widget Failure" string
anywhere in the product; searching a log or a screenshot for it finds nothing.
The Sentry call is guarded by `win?.Sentry?.captureException` and carries tags
`preact.island_boundary` / `preact.section_name`, so it shares §4.2's
dependency on a `window.Sentry` global.

---

## 5. Environment registry — secrets and vars (live-derived 2026-09-19)

All secrets are set with `wrangler secret put <KEY>`; vars live in `wrangler.toml [vars]`.

> **RULE #0.8 — env var cap.** The Worker carries **42** env entries: **17 `[vars]`**
> plus **25 secrets** (live Worker read 2026-09-19: 17 `plain_text` + 25 `secret_text`;
> the platform limit is 64 per Worker on Workers Free). *This said "40 (15 + 25)" until
> 2026-09-19; all 17 vars have been in `wrangler.toml` since the initial commit, so the
> 15 was never right. Re-derive with a digit-inclusive pattern —
> `grep -cE '^[A-Z][A-Z0-9_]* *=' wrangler.toml` over the `[vars]` block — and note
> that `RULESAd.md` and `runbooks/public-share-links-domain-isolation.md` each carry
> their own number.* New feature config belongs in `admin_portal_settings`
> (`src/lib/dal/PortalSettingsRepository.ts`); a new env var is the last option.
>
> **How this section is kept true (viability program chunk 2):** the 22 secrets the
> Worker *requires* (24 until 2026-10-04, when the two Upstash names left) are declared in `wrangler.toml` under `[secrets] required`.
> `wrangler deploy` refuses when one is missing on the Worker, and
> `worker-configuration.d.ts` (generated by `npm run types`, checked in CI by
> `npm run types:check`) is the type every `env.X` access is checked against. The
> names below are copied from that block; if they disagree, the toml wins.

### 5.1 Required secrets (`[secrets] required` — deploy fails without them)

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase DB ops — authorization whitelist, bookings, chatbot, consent (no GoTrue) |
| `REVALIDATION_SECRET` | ISR webhook auth (cf-admin → cf-astro) |
| `IP_HASH_SECRET` | Privacy-safe IP hashing in login forensics and audit |
| `HEALTH_CHECK_SECRET` | Authenticates external health probes |
| `CLOUDFLARE_API_TOKEN` | Cloudflare GraphQL analytics + control-plane reads (and cache purge unless `CONTROL_PLANE_CF_TOKEN` overrides) |
| `CLOUDFLARE_ZONE_ID` | Zone id for HTTP metrics and purge |
| `CF_API_TOKEN_READ_LOGS` | Zero Trust audit-log read — 5-minute cron polling (token `cf-admin: Zero Trust Audit Read`) |
| `CF_API_TOKEN_ZT_WRITE` | Zero Trust session revoke — Layer 3 force-kick (token `cf-admin: Zero Trust Session Revoke`) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | S3-compatible credential scoped to `madagascar-staff-storage`; `aws4fetch` presigned uploads (SigV4 needs this shape, no substitute) |
| `BREVO_API_KEY` | Brevo transactional email (primary provider) |
| `BREVO_WEBHOOK_SECRET` | Authenticates Brevo delivery webhooks (`/api/emails/webhook`) |
| `RESEND_API_KEY` | Resend — invite re-send path (`src/pages/api/users/resend-invite.ts`) |
| `CHATBOT_WORKER_URL` / `CHATBOT_ADMIN_API_KEY` | cf-chatbot proxy fallback URL and its admin key (`X-Admin-Key`). The key must be the same value in both Workers: set it with `wrangler secret put CHATBOT_ADMIN_API_KEY` here and in cf-chatbot in the same sitting. *(The `sync:keys` npm script that did this pointed at a Python file outside the repository and was removed on 2026-09-15, assessment D-12.)* |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG_SLUG` / `SENTRY_PROJECT_SLUG` | Sentry API for dashboard metrics and the control plane (build-time source-map upload uses the same token) |
| `POSTHOG_PERSONAL_API_KEY` / `PUBLIC_POSTHOG_PROJECT_ID` | PostHog control-plane reads |
| `GSC_SERVICE_ACCOUNT_JSON` | Google Search Console service-account key (documented RULE #0.8 exception) |
| `PAGESPEED_API_KEY` | PageSpeed Insights API key (documented RULE #0.8 exception) |

### 5.2 Set on the Worker but not required

| Secret | Status |
|--------|--------|
| `RESEND_WEBHOOK_API` | **No reader in `src/`**, and **overdue for deletion**. Chunk 2 shipped 2026-09-02; this was to be retired "one release after". It is still the 25th live secret on 2026-09-19 — 17 days later — and it is one of the 42 entries RULE #0.8 counts. Retire with `wrangler secret delete RESEND_WEBHOOK_API` on owner confirmation, or record a decision to keep it. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **No reader in `src/` since 2026-10-04** (rate limits moved to §1's Rate Limiting bindings and D1, §3.6), and no longer in `[secrets] required`. Still set, and still 2 of the 42 entries RULE #0.8 counts. Owner step, after one release: `wrangler secret delete` both. The Upstash database is not cf-admin's to delete: cf-astro and cf-chatbot shared it, and cf-astro's own change under the same plan moves cf-astro off it separately ([MAINTENANCE](../MAINTENANCE.md) RU-1) |

### 5.3 Optional secrets (not set in production; every reader degrades)

`SENTRY_PROJECT_SLUG_ASTRO`, `SUPABASE_ACCESS_TOKEN`, `POSTHOG_PROJECT_ID`, `POSTHOG_ORG_ID`, `CONTROL_PLANE_CF_TOKEN`, `SECURITY_ALERT_EMAIL`, `ADMIN_API_KEY`, `GITHUB_READ_TOKEN` (the GitHub page, [`features/GITHUB.md`](../features/GITHUB.md); without it the page says "not connected") — typed as optional in `src/env.d.ts`. Dev-only: `LOCAL_DEV_ADMIN_EMAIL` (Cloudflare Access bypass on localhost, `.dev.vars` only).

Removed and gone: `PUBLIC_SUPABASE_ANON_KEY`, `TURNSTILE_SECRET_KEY` (GoTrue and the login form were retired).

### 5.4 Vars (`wrangler.toml [vars]`, 17)

| Var | Purpose |
|-----|---------|
| `SITE_URL` | `https://secure.madagascarhotelags.com` — CSRF origin validation, `__Host-` cookie decision, dev-mode detection |
| `PUBLIC_SUPABASE_URL` | Supabase project URL |
| `PUBLIC_ASTRO_URL` | cf-astro origin for revalidation (never override in `.dev.vars`) |
| `PUBLIC_CDN_URL` | R2 custom domain for CMS images |
| `PUBLIC_SENTRY_DSN` | Browser Sentry DSN (public identifier). **Nothing in `src/` reads it** (2026-09-19) — `sentry.client.config.ts` hardcodes the DSN literal instead (§4.1, "Hardcoded DSN"). A removal candidate under RULE #0.8: it is one of the 17 this cap counts |
| `ADMIN_EMAIL` / `SENDER_EMAIL` | Alert recipient and transactional sender |
| `SESSION_REFRESH_INTERVAL_MS` / `SESSION_MAX_LIFETIME_MS` | Role re-check cadence and hard session expiry |
| `API_DENY_MODE` | `enforce`; only the literal `shadow` relaxes API default-deny |
| `CF_ACCOUNT_ID` / `CF_D1_DATABASE_ID` / `CF_R2_BUCKET_NAME` / `CF_QUEUE_NAME` / `STAFF_STORAGE_BUCKET_NAME` | Account and resource identifiers for analytics and presign |
| `CF_TEAM_NAME` / `CF_ACCESS_AUD` | Zero Trust team and Access application audience for JWT verification |

Local development: copy `.dev.vars.example` to `.dev.vars` and fill the values; with
`[secrets] required` declared, `wrangler dev` loads only the listed secret names.

## 6. Cloudflare API Token Registry

> **Last updated:** 2026-04-30. All tokens created under `[CF_ACCOUNT_EMAIL]'s Account` (ID: `[CF_ACCOUNT_ID]`).
> To view/rotate: Cloudflare Dashboard → My Profile → API Tokens.

### Token: `cf-admin: Zero Trust Audit Read`

**Worker secret:** `CF_API_TOKEN_READ_LOGS`
**Used by:** `src/workers/scheduled-log-sync.ts` — 5-min cron polling of CF Access Audit Log API for failed logins

| Permission | Scope |
|------------|-------|
| Access: Audit Logs | Read |
| Access: SCIM Logs | Read |
| Logs | Read |

**API endpoint:** `GET /accounts/{id}/access/logs/access-requests?since={ts}&until={ts}&limit=100&direction=asc`
— the poller sets `until` as well as `since` and pages forward on `created_at`
(`src/workers/scheduled-log-sync.ts`).

**Email fan-out (2026-05-26 hardening):** For every batch returned by the audit poll, only the first **5 failed-login entries** trigger a `sendSecurityAlertEmail` call (`ALERT_EMAIL_CAP = 5`); the 5th email appends a digest line noting how many additional failures were suppressed (with a pointer to D1 `admin_login_logs` for the complete set). All failures still write to D1 via `logLoginAttempt` regardless of email-cap state. This prevents a misconfigured IdP or password-spraying bot from amplifying one batch into 100+ alert emails and burning the sender's free-tier quota.

> ⚠️ **These alerts go via Brevo, not Resend.** *Corrected 2026-09-19.*
> `sendSecurityAlertEmail` POSTs to `https://api.brevo.com/v3/smtp/email` with
> an `api-key` header ([`../../src/lib/auth/security-logging.ts`](../../src/lib/auth/security-logging.ts)).
> The secret that keeps this path alive is **`BREVO_API_KEY`**; rotating
> `RESEND_API_KEY` mid-incident restores nothing here.

---

### Token: `cf-admin: Zero Trust Session Revoke`

**Worker secret:** `CF_API_TOKEN_ZT_WRITE`
**Used by — three readers** (2026-09-19; this line named only the first, so a
rotation tested on the revoke path alone silently breaks the whitelist sync):

| Reader | What it needs the token for |
|---|---|
| `src/lib/auth/plac.ts` | Layer 3 Ghost Protection force-kick — `POST /accounts/{id}/access/organizations/revoke_user` with `{ email?, user_uid?, devices: true }` |
| `src/lib/auth/cf-access-sync.ts` | The Access **group** sync (the authorized-user whitelist) — needs group write, not just Organizations Revoke |
| `src/pages/api/users/cf-access-audit.ts` | The on-demand Access audit read from the users page |
*Corrected 2026-09-16:* this line documented `DELETE /accounts/{id}/access/users/{cfSubId}/active_sessions`,
which ends the current sessions; the call now revokes the user's Access tokens across devices at the
organization. The `Access: Organizations — Revoke` permission below is what authorises it. Pinned by
`test/plac-revocation.test.ts`, which asserts the URL, the method and the `devices: true` payload.

| Permission | Scope |
|------------|-------|
| Access: Organizations | Write + Read + Revoke |
| Access: Organizations, Identity Providers, and Groups | Write + Read + Revoke |
| Access: Apps and Policies | Write + Read + Revoke |
| Access: Apps | Write + Read + Revoke |
| Access: Users | Write + Read |
| Access: Identity Providers | Write + Read |
| Access: Service Tokens | Write + Read |
| Access: Policies | Write + Read |
| Access: Custom Pages | Write + Read |
| Access: Device Posture | Write |
| Access: Audit Logs | Read |
| Access: Policy Test | Write + Read |
| Zero Trust | Write |
| Zero Trust: Seats | Write |
| Zero Trust: PII | Read |
| Zero Trust Resilience | Write |
| Cloudflare Zero Trust Secure DNS Locations | Write |
| Logs | Write + Read |
| Account Analytics | Read |
| Cloudflare CDS Compute Account | Write + Read |

> **Note:** This token has broad Zero Trust permissions. It is scoped to the `[CF_ACCOUNT_EMAIL]` account only (not zone-level). The critical permission for Layer 3 force-kick is `Access: Organizations Revoke` — it authorises `revoke_user`, which revokes the user's Access tokens **across devices at the organization**, not merely deleting the current sessions (this note said the latter until 2026-09-19; see the 2026-09-16 correction above).

---

## 7. Build & Deploy Commands

> Owner of the release path: [`../runbooks/release-and-rollback.md`](../runbooks/release-and-rollback.md)
> (viability program chunk 3). This section is the command reference only.
>
> **Where each check runs (2026-10-10):** `npm run verify` on the workstation before
> every push, and GitHub's `quality` job after it. Workers Builds runs `build:ci`,
> which only builds since 2026-10-10. Evidence and the deploy stage:
> `release-and-rollback.md` §1. **Apply migrations by hand before pushing.**

```bash
# cf-admin
npm run dev            # Local dev server (Astro on workerd)
npm run verify         # the full gate: run before every push; GitHub `quality` runs it again after
npm run build          # Production build (astro build; offline-safe via .env.build)
npm run release        # preflight → verify → build → drift check (blocking) → migrate → deploy → smoke → tag
npm run build:ci       # Workers Builds build command: astro build only (verify is not repeated there)
npm run deploy:ci      # Workers Builds deploy command (drift check, migrate BEFORE deploy, deploy, smoke)

# D1 migrations — through Wrangler's runner (RULESAd RULE #0.7, corrected 2026-09-02).
# The shared d1_migrations ledger is keyed on FILENAME and holds both repos'
# files; every one of this repo's migrations/*.sql is recorded there. Never
# rename an applied file. Numbers 0033+ belong to this repo (RULE #0.7b).
npx wrangler d1 migrations list  madagascar-db --remote   # what is pending
npx wrangler d1 migrations apply madagascar-db --remote   # release.mjs does this before deploying
node scripts/d1_schema_snapshot.mjs --check               # live schema vs database/schema.snapshot.sql

# State as of 2026-09-19: migrations/ holds 33 files, highest
# 0055_cron_control_plane_subpages.sql (applied 2026-09-16 13:06:50 UTC).
# `0002` appears twice — both applied, never rename. Do not hand-maintain this
# count; `database/migrations.manifest.json` and the query below are the answer.
ls migrations/
npx wrangler d1 execute madagascar-db --remote \
  --command "SELECT name, applied_at FROM d1_migrations ORDER BY applied_at DESC LIMIT 5"

# Secrets management
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put CF_API_TOKEN_READ_LOGS    # see §6 for token permissions
wrangler secret put CF_API_TOKEN_ZT_WRITE     # see §6 for token permissions
wrangler secret list                          # must cover [secrets] required in wrangler.toml

# Verify bindings are live
wrangler d1 list
wrangler kv namespace list
```

### ⚠️ Migration numbering has two colliding series

`migrations/` (0000–0055, **33** `.sql` files — `0002` appears twice and
0009–0032 are unused) and `database/legacy_migrations/` (0001–0043, 44 `.sql` files plus a
README — `0021` appears twice) are **independent numbering series that overlap on 19
numbers** — 0001–0008 and 0033–0043. `migrations/0033_create_blog_and_taxonomy_tables.sql`
and `database/legacy_migrations/0033_create_sync_outbox.sql` are entirely
different migrations that share a prefix.

Consequences to keep in mind:

- **A bare number is ambiguous.** Never write "migration 0033" in a doc, commit
  message or conversation — always give the directory and full filename.
- `migrations/` also contains a **live duplicate**: two files both prefixed
  `0002` (`0002_create_cf_access_sync_log.sql` and `0002_promote_sessions_page.sql`).
- Both series are already applied to `madagascar-db`; `legacy_migrations/` is
  history, not a queue.

> **§5 above is the full secrets + vars reference** — this line used to send
> readers to `SECURITY.md` §9 for it, creating a second home for a fact this
> document owns (`documentation/README.md` assigns the secrets registry here).
> `wrangler.toml`'s `[secrets] required` block is what §5 is copied from; if
> they disagree, the toml wins.

---

## 8. Monthly Cost Reference

**Direct infrastructure spend for this single deployment** — every service below
sits inside its free tier today:

| Service | Cost |
|---------|------|
| Cloudflare Workers | $0 (free tier) |
| D1, KV, R2, Queues, Workers AI | $0 (free tier) |
| Supabase | $0 (free tier) |
| Upstash | $0 (free tier); cf-admin no longer uses it (§3.6). cf-chatbot still does, and so does cf-astro until its own change under the same plan ships |
| Brevo / Resend (email) | $0 (free tier) |
| Anthropic (Claude Haiku fallback) | ~$0.01–0.50/month |
| **Total, direct spend** | **~$0.50/month** |

> **This is not the cost-to-serve, and the two must not be quoted
> interchangeably.** The fully-loaded figure — which adds the paid tiers a real
> client deployment needs, plus operational time — is derived, with its
> assumptions, in
> [`../commercial/analyses/2026-07-26-commercial-model-costing-pricing-and-scale.md`](../commercial/analyses/2026-07-26-commercial-model-costing-pricing-and-scale.md).
> That document owns the cost model: **link it, do not restate its number
> here** (this note used to quote the figure two lines before telling you not
> to). The "$0.00/month" figure that appeared in `RULESAd.md` §15 was this
> table's direct-spend number rounded down, and it was being read as a
> cost-to-serve claim.

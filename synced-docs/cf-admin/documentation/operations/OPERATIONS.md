---

title: "Operations — Infrastructure, Bindings & Observability"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-19
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
(`/dashboard/emails`) enqueues custom sends onto it and the external
`cf-astro-email-consumer` worker drains it. See
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
| `ASTRO_SERVICE` | `cf-astro` | Worker-to-Worker calls to the public site (ISR revalidation, booking outbox drain poke, edge sync probes) |
| `BACKUP` | `cf-backup` | The private backup Worker (no route, no `workers.dev`): the `/dashboard/backup/app/` gateway and the `backup-tick` job. **Deploy cf-backup first** — a deploy that binds a Worker that does not exist fails |

### Workers AI

| Binding | Config | Used By |
|---------|--------|---------|
| `AI` | `remote = true` | cf-admin — blog generation and RAG context retrieval |

### Analytics Engine

| Binding | Dataset | Used By |
|---------|---------|---------|
| `ANALYTICS` | `madagascar_analytics` | cf-admin, cf-astro |

### Scheduled triggers

**Two** cron expressions on this Worker (`[triggers]` in `wrangler.toml`), fired
through the custom entrypoint `src/workers/cf-entry.ts`. Jobs are no longer
listed inline in the entrypoint — the single list is `src/lib/jobs/registry.ts`,
and each one runs under `runJob` with a declared D1 budget:

**Do not hand-count this list.** [`../../src/lib/jobs/registry.ts`](../../src/lib/jobs/registry.ts)
is the list, and [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md)
is its documentation home; the table below is a pointer that has been wrong
three times. As of 2026-09-23 it is **12 jobs — 10 on `*/5`, 2 on Sunday**
(`FIVE_MIN_JOBS` + `SUNDAY_JOBS`).

| Cron | Jobs dispatched (`src/lib/jobs/registry.ts`) |
|------|---------|
| `*/5 * * * *` (10) | `cf-access-audit-poll`, `booking-email-retry`, `booking-outbox-poke`, `cf-access-reconcile`, `storage-notifications`; the three folded in from the retired 15-minute trigger — `blog-scheduled-publish`, `gsc-sync`, `pagespeed-sync` (the last two self-gate on their own interval settings); and `cron-usage-probe`, which caches Cloudflare's account-wide D1 usage figure and is what the automatic-shedding decision reads; and `backup-tick`, which lends cf-backup this tick (its schedule, reconciliation and failure alerts — [`../features/BACKUP-CONSOLE.md`](../features/BACKUP-CONSOLE.md)) |
| `0 2 * * SUN` (2) | `asset-cleanup`, `staff-storage-reconcile` |

> **Every job below can be paused, throttled or run by hand from
> `/dashboard/cron` (2026-09-16; the throttle got a user interface on
> 2026-09-20).** The control plane owns per-job state, criticality tiers, the
> permission matrix and the automatic-shedding rules — see
> [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md), which is their
> single home. It fails open: a missing or unreadable control document runs
> every job exactly as before. *Corrected 2026-09-20 — this said the gate "costs
> +1 row read per tick", which was the same false claim CRON-CONTROL.md §5
> retired on 2026-09-19. `readControl` issues its own `SELECT`, so the real cost
> is two single-row reads per tick: one from `runCronBatch` and one from
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
> success.
>
> ⚠️ **The three bounds above are code defaults, not rows.** Verified live
> 2026-09-19: `admin_portal_settings` holds 28 keys and **none** of
> `cf-access-reconcile-max-staleness-hours`,
> `cf-audit-watermark-max-staleness-minutes` or
> `storage-notify-interval-minutes` is among them — the 24/60/60 figures come
> from `|| '24'`-style fallbacks in the code. This block used to say "all four
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
6. **Service-binding targets must exist first** — `BACKUP` → `cf-backup`: deploy cf-backup before any cf-admin deploy that carries the binding; otherwise the cf-admin deploy fails

---

## 3. Free Tier Limits

Every service below is on its free tier, so direct spend is ~$0.50/month (§8 —
which is *not* the cost-to-serve figure; read the note there). These quotas
dictate caching strategies and system design constraints.

### 3.1 Cloudflare Workers

| Metric | Free Limit |
|--------|-----------|
| Requests | 100,000/day |
| CPU time per request | **10 ms** ← critical design constraint |
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

### 3.6 Upstash (Redis rate limiting)

| Metric | Free Limit |
|--------|-----------|
| Commands/day | 10,000 |
| Max data size | 256 MB |
| Concurrent connections | 10 |

---

## 4. Observability — Sentry

**Package:** `@sentry/cloudflare` (`^10.73.0`)
**Where it is initialized:** [`../../src/workers/cf-entry.ts`](../../src/workers/cf-entry.ts) — `Sentry.withSentry()` wraps the whole Worker and builds a client per invocation.

> **Corrected 2026-09-07.** This line read "Config file: `sentry.server.config.ts`" and pointed at the wrong file.
> [`../../sentry.server.config.ts`](../../sentry.server.config.ts) is an intentional **no-op** (`export {}`) whose own
> header says "Do not add `Sentry.init(...)` here" — the Node-based `@sentry/astro` server SDK does not run in workerd.
> Server capture goes through [`../../src/lib/sentry.ts`](../../src/lib/sentry.ts), which re-exports `@sentry/cloudflare`;
> browser capture is configured in [`../../sentry.client.config.ts`](../../sentry.client.config.ts).

### 4.1 Architecture

Sentry is integrated at the Cloudflare Edge layer (CDN-native). Key decisions:

- **10% trace sampling** (`tracesSampleRate: 0.1`) — sufficient for performance monitoring without exhausting free tier quota; 100% sampling was excessive and costly
- **`sendDefaultPii: false`** — prevents IP addresses, cookies, and auth headers from being forwarded to Sentry (GDPR/LFPDPPP compliance)
- **No browser integrations — because there are none to disable.** *Corrected 2026-09-19:* this bullet claimed the defaults were switched off. Nothing in `src/workers/cf-entry.ts` sets `integrations: []` or `defaultIntegrations: false`; `@sentry/cloudflare` simply ships no browser integrations, and the init only *adds* `consoleLoggingIntegration`. The underlying rule still stands: Workers run on `workerd`, not a browser, and a browser-targeting integration (`BrowserTracing`, `GlobalHandlers`, `LinkedErrors`) would reference `window`/`document` and throw `ReferenceError: window is not defined` at startup
- **`consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] })`** — console output is forwarded to Sentry, so handlers do not need `Sentry.captureException()` scattered through them. *Corrected 2026-09-07:* this bullet named a "Console Capture integration", which is not what the code configures.
- **`enableLogs: true`, with `beforeSend: scrubEvent` and `beforeSendLog: scrubLog`** — both scrubbers run before anything leaves the Worker; `environment` and `release` are derived per invocation in `cf-entry.ts`
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
> **How this section is kept true (viability program chunk 2):** the 24 secrets the
> Worker *requires* are declared in `wrangler.toml` under `[secrets] required`.
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
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Redis rate limiting and AI neuron budget — retired by viability program chunk 16 |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG_SLUG` / `SENTRY_PROJECT_SLUG` | Sentry API for dashboard metrics and the control plane (build-time source-map upload uses the same token) |
| `POSTHOG_PERSONAL_API_KEY` / `PUBLIC_POSTHOG_PROJECT_ID` | PostHog control-plane reads |
| `GSC_SERVICE_ACCOUNT_JSON` | Google Search Console service-account key (documented RULE #0.8 exception) |
| `PAGESPEED_API_KEY` | PageSpeed Insights API key (documented RULE #0.8 exception) |

### 5.2 Set on the Worker but not required

| Secret | Status |
|--------|--------|
| `RESEND_WEBHOOK_API` | **No reader in `src/`**, and **overdue for deletion**. Chunk 2 shipped 2026-09-02; this was to be retired "one release after". It is still the 25th live secret on 2026-09-19 — 17 days later — and it is one of the 42 entries RULE #0.8 counts. Retire with `wrangler secret delete RESEND_WEBHOOK_API` on owner confirmation, or record a decision to keep it. |

### 5.3 Optional secrets (not set in production; every reader degrades)

`SENTRY_PROJECT_SLUG_ASTRO`, `SUPABASE_ACCESS_TOKEN`, `POSTHOG_PROJECT_ID`, `POSTHOG_ORG_ID`, `CONTROL_PLANE_CF_TOKEN`, `SECURITY_ALERT_EMAIL`, `ADMIN_API_KEY` — typed as optional in `src/env.d.ts`. Dev-only: `LOCAL_DEV_ADMIN_EMAIL` (Cloudflare Access bypass on localhost, `.dev.vars` only).

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
> ⚠️ **Workers Builds still runs its default command** (`npx wrangler deploy`),
> verified 2026-09-19. `build:ci` and `deploy:ci` below are the *intended*
> commands, not the live ones, so a push to `main` today deploys without
> `verify`, without the schema drift check, without applying migrations and
> without the smoke probe. **Apply migrations by hand before pushing.** The
> one-time owner step is `release-and-rollback.md` §3.

```bash
# cf-admin
npm run dev            # Local dev server (Astro on workerd)
npm run verify         # the full gate — same set Workers Builds and CI run
npm run build          # Production build (astro build; offline-safe via .env.build)
npm run release        # preflight → verify → build → drift check (blocking) → migrate → deploy → smoke → tag
npm run build:ci       # INTENDED Workers Builds build command  (verify + build)   — NOT YET SWITCHED ON
npm run deploy:ci      # INTENDED Workers Builds deploy command (migrate BEFORE deploy, then smoke) — NOT YET SWITCHED ON

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
| Upstash | $0 (free tier) |
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

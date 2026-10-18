---
title: "Platform kit research: the current estate (what the six repositories do today)"
status: historical
audience: [owner, ai, technical]
last_verified: 2026-10-18
verified_against: [web-sources]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, research, snapshot]
---

> **Research snapshot, read on 2026-10-18.** Written by a research pass for the platform kit plan ([`01-plan.md`](01-plan.md)). Figures carry their source URL and the date read; anything unverified is marked **GAP**. Paths named here describe other repositories or a proposed design, not files in this repository. Kept as a dated record and not updated in place.

# Estate inventory — what exists today across the six repositories (read-only, 2026-10-18)

Scope: `/home/user/cf-admin-madagascar`, `/home/user/cf-astro`, `/home/user/cf-backup`,
`/home/user/cf-vps`, `/home/user/cf-email-consumer`, `/home/user/cf-graph`, all on `main`.
Everything below was read from the checked-out files; nothing was queried live. Where a document
states a live figure, the document and its date are cited. Binding IDs, DSNs and account IDs that
appear in plain text in `wrangler.toml` `[vars]` are deliberately not copied here.

A seventh Worker, **cf-chatbot** (two D1 databases, `CHATBOT_SERVICE` binding, nine admin pages
under `/dashboard/chatbot/`), is part of the platform but is **not checked out**; it is counted
only where cf-admin's docs count it.

---

## 0. Size of the estate (measured)

| Repo | LOC in `src/` (ts/tsx/astro/css) | Test files | API routes | D1 migrations | Workers built |
|---|---:|---:|---:|---:|---|
| cf-admin-madagascar | **155,353** (+33,463 test) | 189 `*.test.ts` | **168** files under `src/pages/api/` | 54 files in `migrations/` (`0000`–`0008` legacy + `0033`–`0076`), 12 Supabase SQL files | 1 (`cf-admin-madagascar`) |
| cf-astro | 31,666 | 42 | 18 | 15 (`db/migrations/0001`–`0015`) + Drizzle for Supabase | 1 (`cf-astro`) |
| cf-backup | 69,205 (src + scripts) | 182 | ~25 route modules in `src/api/` | 0 (by rule) | 1 private (`cf-backup`) |
| cf-vps | 28,985 (src + agent + contract) + 7,826 in `host/` shell | 90 | route table in `contract/` | 0 | 1 private (`cf-vps`) + Node host agent + host modules |
| cf-email-consumer | 8,602 | 23 | public `/v1/*` + Console entrypoint | 8 (`migrations/0001`–`0008`, own DB) | 2 from one `wrangler.toml` (`cf-astro-email-consumer`, `cf-email-api`) |
| cf-graph | small static Astro/React site | 0 (no unit suite; type check, generators, `check:secrets`, `check:mobile`) | 0 | 0 | 1 assets-only Worker |

Totals: roughly **300k lines** of application code, **~525 test files**, 7 Workers (8 with
cf-chatbot), one admin portal with 168 API route files and 21 dashboard module folders.

Env entries per Worker (from `wrangler.toml`/`wrangler.json` and the repos' own inventories):

| Worker | `[vars]` | secrets | Source |
|---|---:|---:|---|
| cf-admin-madagascar | 17 | 22 in `[secrets] required` (RULESAd §0.8 says "42 env entries: 17 vars + 25 secrets", 2026-09-19) | `wrangler.toml`, `RULESAd.md` §0.8 |
| cf-astro | 6 | ~11 (`DATABASE_URL`, `TURNSTILE_SECRET_KEY`, `BETTERSTACK_SOURCE_TOKEN`, `BREVO_WEBHOOK_SECRET`, `REVALIDATION_SECRET`, `HEALTH_CHECK_SECRET`, `ARCO_ADMIN_SECRET`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`, `SENTRY_*`; two listed as read by "Nothing") | `SECURITY.md` §13 |
| cf-backup | 0 | 1 Worker secret + 2 GitHub secrets + Vault login in Hyperdrive ("4 keys"), plus optional `SUPABASE_ACCESS_TOKEN`, `CONSOLE_SIGNING_KEY` | `main.md` §2, RULES.md 3 |
| cf-vps | 0 | `VPS_SIGNING_KEY` required, `CONSOLE_SIGNING_KEY` optional | `wrangler.json` |
| cf-astro-email-consumer | 2 | `BREVO_API_KEY`, `RESEND_API_KEY`, `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `docs/reference/CONFIG.md` |
| cf-email-api | 2 | `CONSOLE_SIGNING_KEY` optional; no provider keys by design | `docs/reference/CONFIG.md` |

---

## 1. Feature inventory

Legend: **CORE** = every client needs it; **OPT** = per client; **MDG** = Madagascar / pet-hotel
business logic. "Owns" lists tables the feature created or is the primary writer of.

### 1a. cf-admin-madagascar (the admin portal, `secure.madagascarhotelags.com`)

| Feature / page | What it does | Key code | Owns (tables) | Bindings | Class |
|---|---|---|---|---|---|
| Auth pipeline (CF Access JWT → KV session → RBAC/PLAC) | Every request classified, CSRF-checked, session resolved, access map decided, audited | `src/middleware.ts`, `src/lib/auth/pipeline.ts`, `src/lib/auth/stages/*`, `src/lib/auth/{rbac,plac,decide-access,routes,session}.ts` | D1 `admin_pages`, `admin_page_overrides`, `admin_login_logs`; Supabase `admin_authorized_users` | `SESSION` KV, `DB`, Supabase REST | CORE |
| Users (`/dashboard/users`) | Invite/change/remove accounts, six role tiers, second-person approvals, CF Access group sync | `src/pages/api/users/*` (18 routes), `src/lib/users/`, `src/lib/auth/cf-access-sync.ts`, `src/lib/approvals/` | Supabase `admin_authorized_users`; D1 `cf_access_sync_log`, `admin_access_requests` | `DB`, `CF_API_TOKEN_ZT_WRITE` | CORE |
| Access Center / Page Registry (`/dashboard/users/[id]/access`, `/dashboard/debug/pages`) | One editor per person over portal pages, server-console caps and backup-console caps; grants with end dates; access requests; quarterly review | `src/lib/access-center/*` (28 files), `src/lib/access-requests/`, `src/lib/access-review/`, `src/pages/api/users/access-*.ts`, `src/pages/api/system/page-access.ts` | D1 `admin_pages`, `admin_page_overrides`, `admin_access_requests`, `admin_portal_settings` rows `vps:access`, `backup:access` | `DB`, `VPS`, `BACKUP` | CORE |
| Sessions (`/dashboard/sessions`) | Who is signed in, sign-in log, bars, sign-in alert emails, alert policy, force-kick, flush | `src/pages/api/sessions/*`, `src/lib/login-alerts/`, `src/lib/auth/session.ts` | D1 `admin_login_logs` | `SESSION`, `DB`, CF Access API | CORE |
| Audit log + daily seal (`/dashboard/logs`) | Ghost Audit: `waitUntil` D1 writes per request; tamper-evident daily seal | `src/lib/audit.ts`, `src/lib/audit-seal/`, `src/pages/api/audit/*` (13 routes), `src/workers/scheduled-audit-seal.ts` | D1 `admin_audit_log` | `DB` | CORE |
| Cron control plane (`/dashboard/cron`) | 17 jobs multiplexed on 2 cron triggers; pause/throttle/halt, query trace, D1 usage | `src/lib/jobs/*` (15 files), `src/workers/job-runner.ts`, `src/workers/scheduled-*.ts` (16), `src/pages/api/cron/*` | D1 `admin_portal_settings` (`cron-control` document), `system_test_results` | `[triggers] crons`, `ctx.exports.JobRunner` | CORE |
| System Health (`/dashboard/health`) | 29 checks over website, email, data, security, server, portal; problems, ack/snooze, heavy runs, test alert | `src/lib/health/*`, `src/pages/api/system-health/*` | D1 (health tables added in `0072`–`0076`), `HealthReadsRepository`, `HealthResultsRepository` | `DB`, provider APIs | CORE |
| Debug / diagnostics (`/dashboard/debug`) | Diagnostics runs and history, page registry checks | `src/pages/dashboard/debug/*`, `src/pages/api/system/*` | D1 `system_test_results` | `DB` | CORE |
| Settings & Configuration (`/dashboard/settings`, `/dashboard/configuration`) | Personal settings (name, theme, your access); portal-wide configuration | `src/lib/configuration.ts`, `src/lib/dal/PortalSettingsRepository.ts`, `UserSettingsRepository.ts`, `src/pages/api/configuration.ts`, `api/settings/*` | D1 `admin_portal_settings`, `admin_user_settings` | `DB` | CORE |
| Platform alerts | Durable dead-letter table for critical alerts; email through the queue | `src/lib/alert-gate.ts`, `src/lib/dal/PlatformAlertsRepository.ts` | D1 `platform_alerts` | `EMAIL_QUEUE` | CORE |
| Dashboard home (`/dashboard`) | Metrics widgets | `src/pages/api/dashboard/metrics.ts`, `src/components/dashboard/` | — | `DB`, `ANALYTICS` | CORE (widgets MDG) |
| Control plane (`/dashboard/control-plane/*`) | Watch/tune Sentry, PostHog, Cloudflare, Supabase live; purge cache; publish config | `src/lib/control-plane/*` (`sentry-admin.ts`, `posthog-admin.ts`, `cloudflare-admin.ts`, `supabase-admin.ts`, `provider-result.ts`), `src/pages/api/control-plane/*` | D1 `service_config`, `service_config_history` | provider API tokens | CORE (per-provider parts OPT) |
| Email Portal (`/dashboard/emails`) | Compose/send from hotel addresses, attachments, templates, drafts, scheduling, delivery board, Brevo controls, suppressions, DNS check, webhook | `src/pages/api/emails/*` (27 routes), `src/lib/email/*`, `src/components/admin/emails/` | D1 `admin_email_templates`, `admin_email_drafts`, `admin_email_suppression`; Supabase `email_audit_logs` | `EMAIL_QUEUE`, `STAFF_STORAGE`, `BREVO_API_KEY` (direct for engine/senders/quota/dns-check) | CORE |
| Email API access (`/dashboard/email-api`) | Tokens, clients, templates, activity, settings of the email service through the Console door | `src/lib/email-console.ts`, `src/lib/email-api-route.ts`, `src/pages/api/emails/api-*.ts` (11) | none here (data in `madagascar-email-db`) | `EMAIL_CONSOLE` service binding | CORE |
| Backup console (`/dashboard/backup`) | Embeds cf-backup's console via gateway; `backup-tick` job drives it | `src/lib/backup-proxy.ts`, `src/lib/backup-section.ts`, `src/pages/dashboard/backup/app/[...path].ts`, `src/workers/scheduled-backup-tick.ts` | D1 `backup_runs` (migration `0057`) | `BACKUP` service binding | CORE |
| VPS console (`/dashboard/vps`) | Embeds cf-vps's console (services, apps, files, jobs, terminal WebSocket); server access notice | `src/lib/vps-proxy.ts`, `src/lib/vps-notice*.ts`, `src/pages/dashboard/vps/app/[...path].ts`, `src/pages/api/vps/notice.ts` | D1 `admin_portal_settings` row `vps:access` | `VPS` service binding | OPT |
| GitHub (`/dashboard/github`) | Read-only view of each repo's commits, releases and checks | `src/lib/github/*` (`client.ts` is the only `api.github.com` caller) | — | GitHub token | CORE |
| Staff Managed Storage (`/dashboard/storage`) | Private file drive, quotas by role, trash, share links, file-request links, reconciliation | `src/lib/storage/`, `src/pages/api/storage/*` (29 routes) | D1 `storage_files`, `storage_file_requests`, `storage_share_access_logs` | `STAFF_STORAGE` R2, `R2_ACCESS_KEY_*` | OPT |
| Privacy / consent / ARCO / retention (`/dashboard/privacy`, `/arco`, `/retention`) | Consent receipts, ARCO (Mexican DSR) requests, retention purge/preview | `src/lib/arco/`, `src/lib/retention-*.ts`, `src/pages/api/arco/*`, `api/retention/*`, `api/audit/consent.ts` | Supabase `consent_records`, `legal_requests`; D1 `consent_attempts` | `DB`, Supabase | CORE as "privacy module"; ARCO wording MDG/MX |
| Inquiries (`/dashboard/inquiries`) | Contact-form inbox: assign, tag, reply, customer-360 | `src/pages/dashboard/inquiries/_components/*`, `src/pages/api/inquiries/*` (11), `InquiryRepository.ts` | Supabase `contact_messages`, `contact_message_comments` | Supabase | OPT (generic inbox) |
| Bookings (`/dashboard/bookings`) | Booking list, state machine, batch | `src/pages/api/bookings/*`, `src/lib/bookings/`, `BookingStateRepository.ts` | D1 `admin_booking_state`, `booking_attempts`; Supabase `bookings`, `booking_pets`, `booking_quality_metadata` | Supabase, `DB` | MDG |
| CMS & blog (`/dashboard/content/*`) | Hero, gallery, reviews, services, FAQ, about, media; blog with AI generation, quality gate, redirects; ISR revalidation of cf-astro | `src/lib/cms/`, `src/lib/blog/`, `src/lib/ai/`, `src/lib/sync-outbox.ts`, `src/workers/sync-revalidate-consumer.ts`, `src/pages/api/content/*` (14), `api/media/*` | D1 `cms_content`, `cms_content_history` (dead), `blog_posts`, `blog_categories`, `blog_posts_history`, `blog_redirects`, `sync_outbox` | `IMAGES` R2, `AI`, `SYNC_QUEUE`, `ASTRO_SERVICE` | CMS core = OPT; hotel content/blog = MDG |
| SEO (`/dashboard/seo`) | GSC sync, IndexNow, PageSpeed, discovery health, review nudges | `src/lib/gsc/*`, `src/lib/pagespeed/*`, `src/lib/seo/`, `src/pages/api/seo/*` (10) | D1 `gsc_index_log` (+ seo settings) | `GSC_SERVICE_ACCOUNT_JSON`, `PAGESPEED_API_KEY` | OPT (website clients) |
| Chatbot admin (`/dashboard/chatbot/*`, 9 pages) | Proxies cf-chatbot admin surface | `src/lib/chatbot-proxy.ts`, `src/pages/api/chatbot/[...path].ts` | cf-chatbot's D1 (`chatbot-kb`, `whatsapp-chatbot`) | `CHATBOT_SERVICE`, `CHATBOT_WORKER_URL`, `CHATBOT_ADMIN_API_KEY` | OPT |
| AI Health (`/api/ai/health`) | Workers AI cost/latency telemetry | `src/lib/ai/telemetry.ts`, `src/lib/ai-pricing.ts` | — | `AI` | OPT |
| Design system "Midnight Slate" + console.css kit + dialog store | Tokens, surfaces, dialogs (`RULESAd.md` §7.8 mandatory) | `src/styles/components/console.css`, `src/stores/dialogStore.ts`, `documentation/reference/DESIGN-SYSTEM.md` | — | — | CORE |

### 1b. cf-astro (public website and booking, `madagascarhotelags.com`)

| Feature | What it does | Key code | Owns | Bindings | Class |
|---|---|---|---|---|---|
| Bilingual marketing site (es/en) | Service pages, zones, franchise, legal, sitemaps, RSS | `src/pages/{es,en}/*`, `src/i18n/`, `src/components/sections` | — | `ISR_CACHE` KV | MDG (content), i18n plumbing CORE |
| Booking flow | Life-safety-adjacent booking with audit-first D1 attempt, Postgres write, replay outbox, queue email | `src/pages/api/booking.ts`, `api/booking/replay.ts`, `src/lib/booking/`, `src/lib/outbox/` | D1 `booking_attempts`; Supabase `bookings`, `booking_pets`, `booking_quality_metadata` | `DB`, `DATABASE_URL`, `EMAIL_QUEUE` | MDG |
| Consent record system | Consent evidence with D1 attempt trail + Supabase truth + replay | `src/pages/api/consent.ts`, `src/lib/consent/` | D1 `consent_attempts`; Supabase `consent_records` | `DB`, Supabase | CORE (privacy module) |
| Contact form, ARCO submit/get-document | Contact inbox and DSR intake with Turnstile | `api/contact.ts`, `api/arco/*`, `src/lib/turnstile.ts` | Supabase `contact_messages`, `legal_requests`; R2 `arco-documents` | `ARCO_DOCS` R2 | contact CORE-ish; ARCO MX-specific |
| CMS consumer + ISR + revalidate | Reads D1 `cms_content`, KV ISR cache, `/api/revalidate` from cf-admin | `src/lib/cms.ts`, `src/lib/isr-*.ts`, `api/revalidate.ts`, `api/cms-status.ts` | reads `cms_content`, `site_settings` | `ISR_CACHE`, `REVALIDATION_SECRET` | OPT |
| Blog rendering | D1 blog tables, tags, RSS | `src/lib/blog*.ts`, `pages/*/blog/*` | reads `blog_*` | `DB` | MDG/OPT |
| Analytics ingest proxy (PostHog) and summary | `/api/ingest/[...path]`, `/api/analytics/*` | `src/scripts/analytics-loader.ts`, `api/ingest/`, `api/analytics/` | — | `ANALYTICS` AE, PostHog host | OPT |
| Health + heartbeat | `/api/health`, `/api/health-analytics`, heartbeat probe drained by cf-vps job / cf-admin watchdog | `src/lib/heartbeat.ts`, `api/health.ts` | — | `HEALTH_CHECK_SECRET` | CORE |
| Brevo webhook receiver | Delivery events → queue `api_delivery` | `api/webhooks/brevo.ts` | — | `BREVO_WEBHOOK_SECRET`, `EMAIL_QUEUE` | CORE (email) |
| MCP / WebMCP / agent skills | `/api/mcp`, `llms-full.txt`, `.well-known/agent-skills` | `api/mcp.ts`, `BaseLayout.astro` | — | — | MDG |
| Rate limiting, security headers, CSRF | 10 Rate Limiting bindings; custom headers; route policy | `src/lib/rate-limit.ts`, `security-headers.ts`, `security.ts`, `route-policy.ts`, `src/middleware.ts` (449 lines) | — | `RL_PER_MIN_*` | CORE |
| Platform alert gate | Own copy of alert gate | `src/lib/alert-gate.ts` (417 lines) | D1 `platform_alerts` | `EMAIL_QUEUE` | CORE (duplicated, see §6) |

### 1c. cf-backup (private Worker + GitHub Actions engine)

| Feature | What it does | Key code | Owns | Bindings | Class |
|---|---|---|---|---|---|
| Console (status, readiness, history, run detail, logs, usage, keys, files, restore tests, access, alerts, diagnostics, targets) | Preact SPA under `/dashboard/backup/app/` | `src/ui/`, `src/api/*` (25 modules), `src/http/router.ts` | D1 `backup_runs` (cf-admin migration `0057`), `admin_portal_settings` rows `backup:*` | `DB`, `BACKUPS` R2, `VAULT_DB` Hyperdrive, `ASSETS` | CORE |
| Gateway contract (actor header, signature, dev actor) | Trusts only cf-admin's binding | `src/gateway/{actor,signature,dev-actor,paths,target}.ts` | — | — | CORE pattern |
| Capability model (32 caps, floors, delegation, temporary powers) | Generated `PERMISSIONS.md`, policy in a settings row | `src/access/{catalog,policy,delegate,diff,validate,source}.ts`, `scripts/permissions-map.ts` | `admin_portal_settings` `backup:access` | `DB` | CORE pattern (duplicated per console) |
| Tick + schedule + notify + digest | `/internal/tick` from cf-admin's `backup-tick`, next-tick contract, alerts returned to cf-admin for queueing | `src/tick/`, `src/schedule/`, `src/notify/`, `src/internal/routes.ts` | `backup_runs` | — | CORE |
| Engine (GitHub Actions) | `secondary-pipeline.yml` dumps D1 + Postgres, `age`-encrypts to R2; `tick-deadman.yml`; `db-backup.yml` disabled | `.github/workflows/*`, `scripts/backup/`, `scripts/secondary-pipeline/` | R2 `madagascar-backups` | GitHub App token, R2 token | CORE |
| Restore tests, diagnostics, usage, readiness | | `src/restore-tests/`, `src/diagnostics/`, `src/usage/`, `src/readiness/` | | | CORE |
| Docs mirror | `sync-docs.yml`, `PUBLISHED_DOCS` allow-list with identifier check | `scripts/backup/lib/docs-mirror.ts` | | | CORE tooling |

### 1d. cf-vps (server layer)

| Feature | What it does | Key code | Owns | Bindings | Class |
|---|---|---|---|---|---|
| Console Worker (host view, logs, files, security, audit, services, packages, apps, jobs, restore tests, terminal, access) | Private Worker, Preact SPA under `/dashboard/vps/app/` | `src/worker.ts`, `src/http/router.ts`, `src/ui/`, `src/gateway/`, `src/access/{policy,delegate,save}.ts` | settings row `vps:access` in cf-admin's D1 | `DB`, `KROWN` VPC service, `VPS_SIGNING_KEY` | OPT |
| Shared contract (25 capabilities, actions, route table, signing, tickets, jobs, terminal) | One file set read by Worker, agent and console | `contract/*.ts` (11 files) | — | — | pattern worth keeping |
| Host agent | Node service on the server verifying Ed25519-signed calls, re-checking caps, own red lines | `agent/src/` | `/var/lib/vps/*` | — | OPT |
| Host modules | Server as code: firewall, audit (auditd/Laurel/tlog→Vector→R2/Sentry), logship, node, tunnel, podman, nginx, postgres, agent, actions, jobs, integrity, probes, terminal | `host/00-baseline` … `host/80-terminal`, `host/push.sh` | — | — | OPT |
| Jobs (admission queue, heartbeat for cf-astro), restore tests, app platform | | `documentation/features/JOBS.md`, `RESTORE-TESTS.md`, `apps/` | | | OPT |
| Minecraft docs | Six documents for a game-server proposal | `documentation/minecraft/*` | | | out of scope for a kit |

### 1e. cf-email-consumer (email service)

| Feature | What it does | Key code | Owns | Bindings | Class |
|---|---|---|---|---|---|
| Queue consumer | Renders purposes (`booking_*`, `contact_form`, `arco_request`, `custom_email`, `inquiry_reply`, `template_email`, `api_email`, `api_cancel`, `hotel_preview`, platform alerts); lease per message; Brevo with Resend failover; dead-letter copy before ack | `src/index.ts`, `src/handlers.ts`, `src/dispatch.ts`, `src/dlq.ts`, `src/lib/providers.ts` (only provider URLs) | D1 `madagascar-email-db`: `sends`, `throttle`; writes shared `booking_attempts`, `admin_email_suppression`; Supabase `email_audit_logs` | `EMAIL_DB`, `DB`, `IMAGES`, `EMAIL_FILES`, queue consumers | CORE (hotel purposes MDG) |
| Hotel templates | Built-in designs + stored templates per purpose | `src/hotel-templates.ts` (612 lines), `src/templates.ts`, `src/hotel-purposes.ts` | `templates`, `template_versions` | — | MDG wording, CORE mechanism |
| Public REST API (`cf-email-api`, `email.madagascarhotelags.com/v1/*`) | Bearer tokens `ems_…`, clients, per-token and shared budgets, attachments, delivery events, webhooks, scheduled sends | `api/src/{index,public,tokens,validate,store,render,ipallow,signature}.ts` | `api_tokens`, `api_clients`, `api_messages`, `api_events`, `policy` | `EMAIL_DB`, `EMAIL_QUEUE`, `EMAIL_FILES`, `LIMITER` | CORE (email-as-a-service) |
| Console door (`Console` entrypoint) | Admin-only via `EMAIL_CONSOLE` binding, `x-email-actor` + signature; tokens, clients, templates, activity, settings, senders sync | `api/src/console.ts`, `api/src/signature.ts` | `policy` rows | — | CORE pattern |
| Public docs site | Static site served by the API Worker | `site/` | — | assets | OPT |

### 1f. cf-graph

| Feature | What it does | Key code | Class |
|---|---|---|---|
| Documentation knowledge graph (6 views) | Parses the public docs mirror of five repos (203 docs, 1,247 links on 2026-10-04) | `scripts/parse-knowledge-base.ts`, `public/knowledge-graph.json` | OPT (internal tooling) |
| Systems view / platform facts | Allow-listed production facts with source and date; latency probe daily in CI | `data/platform-facts.source.ts`, `scripts/check-secrets`, `latency.yml` | OPT |

---

## 2. Data estate

### 2a. Stores and counts

| Kind | Count | Names (from `wrangler.*` and docs) |
|---|---:|---|
| D1 databases | **4** (3 in cf-admin's §0.9 count + the email DB) | `madagascar-db` (shared by cf-admin, cf-astro, cf-backup, cf-vps, cf-email-consumer; 30 tables per `database/schema.snapshot.sql`), `madagascar-email-db` (9 tables), `chatbot-kb` (9), `whatsapp-chatbot` (4) — the last two from `documentation/records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md` §0 |
| Supabase projects | 1 production (plus Vault) | `public` schema: 20 tables on 2026-08-23 (same doc §0); cf-admin domain: `admin_authorized_users`, `email_audit_logs`, `consent_records`, `legal_requests`, `contact_messages`, `contact_message_comments`, `bookings`, `booking_pets`, `booking_quality_metadata`, dead `admin_sessions`, orphan `privacy_requests` (renamed `zz_dead_privacy_requests_20260916`); ~11 chatbot tables (`contacts`, `conversations`, `messages`, `chat_analytics`, …) |
| KV namespaces | **3** | `SESSION` (cf-admin, `ADMIN_SESSION`), `SESSION` (cf-astro), `ISR_CACHE` (cf-astro). cf-email-consumer's ROADMAP lists "delete the unused KV namespace" as an owner step |
| R2 buckets | **6+** | `madagascar-images` (admin, astro, email-consumer), `madagascar-staff-storage` (admin), `arco-documents` (astro), `madagascar-backups` (cf-backup), `madagascar-email-files` (email), plus the cf-vps audit/dump bucket referenced in `documentation/architecture/OVERVIEW.md` "R2 audit bucket" |
| Queues | **4** | `madagascar-emails` (+ `madagascar-emails-dlq`), `madagascar-sync-revalidate` (+ `-dlq`) |
| Cron triggers | **2** (cf-admin only) | `*/5 * * * *` carrying 15 jobs, `0 2 * * SUN` carrying 2 (`src/lib/jobs/registry.ts`). cf-backup/cf-vps/email: zero by rule. GitHub Actions schedules: `secondary-pipeline.yml`, `tick-deadman.yml` (cf-backup), `latency.yml` (cf-graph), `consent-heartbeat.yml` (cf-astro, schedule off), `retention-purge.yml` (cf-astro) |
| Service bindings | **5** from cf-admin | `CHATBOT_SERVICE`, `ASTRO_SERVICE`, `BACKUP`, `VPS`, `EMAIL_CONSOLE` (entrypoint `Console`) |
| Other bindings | | `AI` (Workers AI), `ANALYTICS` (Analytics Engine, shared dataset `madagascar_analytics`), `VAULT_DB` Hyperdrive (cf-backup), `KROWN` VPC service (cf-vps), 7 + 10 + 1 Rate Limiting bindings, `CF_VERSION` version metadata |

### 2b. `madagascar-db` tables (30, `database/schema.snapshot.sql`)

`admin_access_requests admin_audit_log admin_booking_state admin_email_drafts admin_email_suppression
admin_email_templates admin_login_logs admin_page_overrides admin_pages admin_portal_settings
admin_user_settings backup_runs blog_categories blog_posts blog_posts_history blog_redirects
booking_attempts cf_access_sync_log cms_content cms_content_history consent_attempts gsc_index_log
platform_alerts service_config service_config_history storage_file_requests storage_files
storage_share_access_logs sync_outbox system_test_results` (+ health tables from `0072`–`0076`
if the snapshot predates them; `admin_feature_flags` appears in migrations and the 2026-08-06 audit).

### 2c. Duplication and structural problems in the data estate

1. **One D1 database, three migration series, silent number collisions.** `RULESAd.md` RULE #0.7b:
   91 `d1_migrations` rows on 2026-09-18 with **26 duplicated numbers**; cf-astro `db/migrations/`
   owns `0001`–`0032`, cf-admin `migrations/` owns `0033`+, and cf-admin's inert
   `database/legacy_migrations/` is a third series; `0001`–`0008` carry three entries each. SQLite has
   no `ADD COLUMN IF NOT EXISTS`, so cross-repo structures are declared with `CREATE TABLE IF NOT
   EXISTS` rather than `ALTER`.
2. **Same tables created by two repos.** `blog_posts`, `blog_categories`, `blog_posts_history`,
   `blog_redirects` are created by cf-astro `0010`/`0011` **and** cf-admin `0033`/`0034`;
   `platform_alerts` by cf-astro `0012` **and** cf-admin `0048` (grep of `CREATE TABLE` in both trees).
3. **Three config mechanisms in one database.** `admin_portal_settings` (general, typed, scoped),
   `service_config` + `service_config_history` (control plane), `admin_feature_flags` (boolean) —
   named as a recurring anti-pattern in the 2026-08-06 audit §3. cf-astro adds a fourth store,
   `site_settings` (`db/migrations/0001`), and cf-email-consumer a fifth, `policy` in its own DB.
4. **Two audit/ledger families for email.** Supabase `email_audit_logs` is the send ledger; D1
   `madagascar-email-db.sends` is the lease/state table; cf-admin's `admin_audit_log` records portal
   actions; cf-email-api's `api_events` records API events. Four places answer "what happened to
   this email".
5. **Two suppression stores.** `admin_email_suppression` (shared D1, written by cf-admin and the
   consumer) is the live one; cf-admin migration `0008_email_suppression` and the consumer's
   `checkSendable` both read it, but cf-email-api keeps its own copy of senders
   (`api_sender_identities` policy row, "not a setting: written only by the senders sync").
6. **Dead or orphaned tables documented but still present:** `cms_content_history` (zero writers),
   Supabase `admin_sessions` (28 leftover rows), `privacy_requests` (still declared in cf-astro
   `src/lib/db/schema.ts` though renamed live), `admin_feature_flags` (2 rows, redundant).
7. **Attempt + truth split pattern** (`consent_attempts`/`consent_records`,
   `booking_attempts`/`bookings`) is deliberate (audit-first, replay outbox) but means every
   life-safety write exists in two stores with a replay job — good design, but a kit must provide it
   once, not per feature.
8. **The settings table is cross-tenant plumbing:** cf-backup's config, access policy and skips, and
   cf-vps's access policy all live as JSON documents in cf-admin's `admin_portal_settings`
   (`backup:*`, `vps:access`), with compare-and-swap on a revision. Good reuse, but it couples three
   repos to one table's shape.

---

## 3. Identity and permissions today

### 3a. How sign-in works (`documentation/architecture/PERMISSIONS-SYSTEM.md`, §1–§7, §11)

- **Identity**: Cloudflare Access in front of the only ingress (`workers_dev = false`,
  `preview_urls = false`, custom domain). JWT verified against JWKS (cached module-scope).
- **Directory**: Supabase `admin_authorized_users` holds who may enter and their role; read on cold
  login (~240 ms), every 30 minutes (`stages/refresh-role.ts`) and on an `authz-changed` mark.
- **Session**: KV record (`SESSION`) carrying the resolved access map + revocation flags; 4 KV reads
  on the warm path; 24 h hard expiry; `__Host-` cookie; CSRF by Origin/Referer (`src/lib/csrf.ts`).
- **Revocation**: three layers including a Cloudflare Access API call to kill the edge cookie
  (§11); the 5-minute `cf-access-reconcile` job mirrors the user list into an Access group
  (`src/lib/auth/cf-access-sync.ts`).
- **Login forensics / alerts**: `admin_login_logs`, new-place alerts (`src/lib/login-alerts/decide.ts`), bars.

### 3b. The three-layer model

| Layer | Store | Meaning |
|---|---|---|
| RBAC | Supabase `admin_authorized_users.role` | Six fixed tiers: `vendor_support(0) > owner(1) > admin(2) > manager(3) > staff(4) > viewer(5)` (`src/lib/auth/rbac.ts`). Stored values are still the old vocabulary (`dev`, `owner`, `super_admin`, `admin`, `staff`, `viewer`); `normalizeRole`/`toStoredRole` translate behind `ROLE_VOCABULARY` because the rename collides (`admin` means level 3 before and level 2 after). Tracked as MAINTENANCE C-11. |
| ACM | D1 `admin_pages` (117 rows live on 2026-10-16) | The page registry: `path`, `required_role` (CHECK admits only the five legacy names), `is_active`, `parent_path`, `category` (seven in `src/lib/access-center/categories.ts`), label/icon/sort. **Sub-features are hash-fragment keys** such as `/dashboard/sessions#revoke` — the "`#` key". A new page = a migration (RULE #0.7's three artefacts). |
| PLAC | D1 `admin_page_overrides` | Per-user grant/deny per page key, with `granted_by`, `reason`, `expires_at` (since `0070`, ≤366 days; default 90 days for grants above role). Resolution: owner/vendor bypass → explicit deny → explicit grant → role baseline (`src/lib/auth/decide-access.ts`, `plac.ts`). Live: 4 overrides, 1 deny (§6.3) — "near-unexercised". |

- **API authz**: `src/lib/auth/routes.ts` `API_PAGE_MAPPING` maps route prefixes to page keys,
  longest-prefix-first; unmapped = default deny (403 since `API_DENY_MODE = enforce`, 2026-08-12).
  Per-handler `placDenyResponse()` from `guard.ts` is a second, independent check.
  `test/api-authz-inventory.test.ts` fails CI on an unmapped route (SEC-06 in `rules_check`).
- **Floors**: `src/lib/auth/page-floors.ts` — Page Registry is grant-only and opens for the owner
  only when vendor support gives it (2026-10-15/17).
- **Provisioning gates** (§10): Access Center save and Page Registry save run five gates per change;
  grants capped at the actor's own clearance; self-modification refused; access requests
  (`admin_access_requests`), access-change emails, fresh sign-in for dangerous actions
  (`src/lib/auth/fresh-sign-in.ts`, 10 minutes), quarterly access review job, second-person approval
  for a few changes (`src/lib/approvals/`), last-Owner guard.
- **Temporary powers**: `src/lib/access-center/temporary.ts`; cf-backup and cf-vps honour "a power
  given for a while (at most 90 days, asked for and approved in cf-admin)".

### 3c. How the consoles receive identity

Each embedded console is reached only through a service binding; cf-admin's gateway strips any
browser-sent header and injects `x-<console>-actor` (base64url JSON, `v: 1`, who/role/caps/sign-in
time), `x-<console>-request-id`, and since 2026-10-16 `x-<console>-signature` (HMAC with the shared
`CONSOLE_SIGNING_KEY`, 60-second window; `src/lib/console-signature.ts`). Three near-identical
gateways: `src/lib/backup-proxy.ts` (382 lines), `src/lib/vps-proxy.ts` (476), `src/lib/email-console.ts`
(385). Three near-identical receivers: `cf-backup/src/gateway/{actor,signature}.ts`,
`cf-vps/src/gateway/{actor,signature}.ts`, `cf-email-consumer/api/src/{console,signature}.ts`.

Each console then has **its own capability catalog and policy engine**:

| Console | Catalog | Count | Policy store | Delegation |
|---|---|---:|---|---|
| cf-backup | `src/access/catalog.ts`, generated `docs/reference/PERMISSIONS.md` | 32 caps, classes Read/Operate/Admin/Secret, floors | `admin_portal_settings` `backup:access` | `access.delegate`, grants belong to one cf-admin account |
| cf-vps | `contract/capabilities.ts`, `documentation/security/PERMISSIONS.md` | 25 caps, classes read/operate/admin, floors | `admin_portal_settings` `vps:access` | `access.delegate`; agent re-checks from the signed list; root unit needs a ticket |
| cf-email-api | caps inside `x-email-actor`, checked in `api/src/console.ts` | implicit (tokens.*, clients.*, templates.*, settings.*, senders.*) | `policy` table | none |
| cf-admin portal | page keys (`admin_pages`) | 117 keys | `admin_page_overrides` | none for pages (§2 "no delegation of page access") |

cf-admin's Access Center then **re-aggregates** all four into one editor (`src/lib/access-center/
{backup,vps,consoles,your-consoles}.ts`), which is the only place a person's whole access is visible.

### 3d. Strengths

- Identity centralised, decision edge-local: O(1) warm path, measured and documented (§13).
- Default-deny API inventory enforced by test; two independent guard mechanisms.
- Deny wins; grants capped at actor's ceiling; self-modification refused; fresh sign-in for
  dangerous actions; second-person approvals; last-Owner guard; audited everything.
- Check-in-layers for the consoles (gateway → Worker → agent → root ticket), each hop re-verifying.
- Generated permission docs that fail the build when they drift (`cf-backup/test/route-permissions.test.ts`).
- Grants with end dates and automatic clean-up.

### 3e. Structural weaknesses for a large organisation

- **Fixed six-tier ladder with integer ranks**; two tiers (`vendor_support`, `owner`) bypass
  everything (ADR-0002). No groups, no teams, no org units, no object-level permissions ("user X may
  edit document Y"), no relationship graph (§2, §15, §16).
- **Role vocabulary is still the legacy one in both databases** (C-11), with translation code and
  ~49 deprecated-alias call sites (`E1` in `.ratchet.json`).
- **Pages and sub-features are string keys in a D1 table that needs a migration per page**
  (`admin_pages` CHECK constraint hard-codes the five role names; `API_PAGE_MAPPING` is a hard-coded
  list in code; `src/lib/audit.ts` has a hard-coded module enum). Adding a module touches the
  "baseplate" in three places (ARCHITECTURE §5).
- **Four separate permission models** (portal pages, backup caps, vps caps, email caps), each with
  its own catalog, policy JSON, delegation rules and docs, stitched together only in the Access
  Center UI. Each console repeats the actor/signature/dev-actor code.
- **A grant belongs to one cf-admin account id**, not to an identity — a second account with the
  same email starts from zero (cf-backup PERMISSIONS "How access is decided" 8).
- **Identity directory is a single Supabase table** read by REST with a service-role key; no SCIM,
  no IdP groups beyond the one Access group mirror; "a `dev`-baseline registry row cannot be
  delegated by the owner" (§16).
- **Revoking one session revokes all devices** (D8). Cold login 240 ms to Supabase.
- cf-admin `pipeline.ts` is 620 lines against a 600-line warning (C-19).

---

## 4. Providers and how hard-coded they are

| Provider | Where the provider-specific code lives | Abstraction? |
|---|---|---|
| **Brevo** (primary email) | cf-email-consumer `src/lib/providers.ts` (only file with `api.brevo.com` there) and `src/handlers.ts`; **cf-admin calls Brevo directly** in `src/pages/api/emails/{engine,senders,quota,dns-check}.ts`, `src/lib/dal/EmailTemplateRepository.ts`, `src/lib/auth/security-logging.ts`, `src/lib/health/catalog.ts`, `src/lib/analytics/providers/external.ts`; webhook receivers in cf-astro `api/webhooks/brevo.ts` and cf-admin `api/emails/webhook.ts`. 53 cf-admin files mention "brevo". | Consumer has a thin provider switch with failover; cf-admin bypasses it for account/sender/quota operations. MAINTENANCE E-9: `brevo_api_key` dead D1 read on six routes. |
| **Resend** (failover) | consumer `src/lib/providers.ts`; cf-admin health catalog; 37 cf-admin files mention it (quota cache in Supabase migration `supabase_0003_resend_quota_cache.sql`) | Same switch; API mail has **no** failover by design. |
| **PostHog** | cf-astro `src/scripts/analytics-loader.ts`, `api/ingest/[...path].ts` (reverse proxy), `BaseLayout.astro`; cf-admin `src/lib/control-plane/posthog-admin.ts`, `api/audit/enrich.ts`, `api/control-plane/posthog.ts`; 21 cf-admin files | `ProviderResult<T>` discriminated result (`src/lib/control-plane/provider-result.ts`) is the only generic layer; provider calls are bespoke. |
| **Sentry** | every repo: cf-admin `sentry.client/server.config.ts`, `src/lib/sentry.ts`, `sentry-scrub.ts`, `control-plane/sentry-admin.ts` (101 files mention sentry); cf-astro `src/lib/sentry-shared.ts` (DSN "read by nothing since 2026-10-10"); consumer `SENTRY_DSN` var; cf-vps agent and host audit pipeline ship to Sentry | No abstraction; DSNs sit in `[vars]`. |
| **Cloudflare API** (Access, Zero Trust groups, cache purge, logs, D1 usage, GraphQL) | cf-admin `src/lib/auth/cloudflare-access.ts`, `cf-access-sync.ts`, `cf-access-reconcile.ts`, `control-plane/cloudflare-admin.ts`, `jobs/health.ts`, `health/catalog.ts` (11 files hit `api.cloudflare.com`); cf-backup runner usage snapshot; cf-astro `api/revalidate.ts` | None; three different API tokens (`CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN_READ_LOGS`, `CF_API_TOKEN_ZT_WRITE`). |
| **Cloudflare Access** (auth) | cf-admin `src/lib/auth/stages/bootstrap.ts`, `assertion.ts`, `CF_ACCESS_AUD`/`CF_TEAM_NAME` vars | Pipeline stages are modular, but Access is the only IdP implemented. |
| **Supabase** (directory, Postgres, Vault, advisors) | cf-admin `src/lib/supabase.ts`, `dal/AuthorizedUserRepository.ts`, `control-plane/supabase-admin.ts` (119 files mention supabase); cf-astro Drizzle `src/lib/db/`; consumer ledger via REST; cf-backup Vault via Hyperdrive and runner | DAL repositories hide SQL but not the vendor. |
| **GitHub** | cf-admin `src/lib/github/client.ts` (single caller), `GITHUB.md`; cf-backup GitHub App dispatch (`src/github/`); every repo's `sync-docs.yml` | Small, isolated. |
| **Google Search Console / PageSpeed / IndexNow** | cf-admin `src/lib/gsc/*`, `src/lib/pagespeed/*`, `src/lib/seo/`, jobs `gsc-sync`, `pagespeed-sync` (tier idle, off at source) | Isolated under `lib/gsc`, `lib/pagespeed`. |
| **Oracle VPS** (the server) | cf-vps `host/*`, `agent/`, `documentation/records/2026-09-29-oci-setup.md`; VPC service binding `KROWN` | Host modules are provider-agnostic shell; OCI only in setup record. |
| **Statuspage / provider status** | cf-admin `src/lib/health/{catalog,probes,readings}.ts` (`providers` probe) | Part of the health catalog. |
| **Workers AI / OpenAI pricing** | cf-admin `src/lib/ai/inference.ts`, `ai-pricing.ts`, `AI` binding | Model ladder in chatbot doc; pricing table hard-coded. |
| **Turnstile** | cf-astro `src/lib/turnstile.ts`, only on `/api/arco/submit` (AGENTS.md: no CAPTCHA on booking) | — |
| **BetterStack** | cf-astro `src/lib/logger.ts` | — |
| **Upstash Redis** | removed from cf-admin 2026-10-04; 4 files still mention it (`ratelimit.ts`, `RateLimitRepository.ts`, `alert-gate.ts`, `jobs/registry.ts` comment) | residue |

Summary: the only generic seam is `ProviderResult<T>` in the control plane and the consumer's
`providers.ts` switch. Everything else is provider code called from feature code, and the admin
portal talks to Brevo/Resend directly in parallel with the email service.

---

## 5. Cross-cutting plumbing a kit would need (what exists, where)

| Concern | Today | Evidence |
|---|---|---|
| **Settings store** | D1 `admin_portal_settings` via `src/lib/dal/PortalSettingsRepository.ts`; typed/scoped (`0037`); shared by cf-backup (`backup:*`), cf-vps (`vps:access`), cf-astro (RULES #0.8 points at it). Competes with `service_config`, `admin_feature_flags`, cf-astro `site_settings`, email `policy`. `GLOBAL-CONFIG.md` is still "a proposal". | RULE #0.8; 2026-08-06 audit §3 |
| **Audit log** | `admin_audit_log` written `waitUntil` after response (`src/lib/audit.ts`), daily seal (`audit-seal/`), export, enrich. cf-backup has its own `src/lib/audit.ts` writing into the same table via cf-admin; cf-vps writes to the server's audit plane (auditd/Laurel/tlog → Vector → R2) plus cf-admin `vps-audit.ts`; email API has `api_events`. | `plac-and-audit.md`; cf-vps `AUDIT-PIPELINE.md` |
| **Alerts** | `platform_alerts` table + `alert-gate.ts` — **two divergent copies** (cf-admin 270 lines, cf-astro 417 lines); email through the queue; `platform_alert_email` policy row in the consumer is **off** until the owner switches it on. cf-backup returns alerts to cf-admin's tick for queueing (it has no queue binding). | `src/lib/alert-gate.ts` both repos; consumer `CONFIG.md` |
| **Jobs / cron platform** | cf-admin's job registry + tiers + budgets + leases + control plane, 17 jobs on 2 triggers, `ctx.exports.JobRunner` loopback for per-job CPU budget; cf-vps has a second job runner (admission queue on the server); cf-backup has the tick/next-tick contract; GitHub Actions carries the heavy work. | `src/lib/jobs/*`, `CRON-CONTROL.md`, cf-vps `JOBS.md` |
| **Health checks** | cf-admin System Health (29 checks, lanes website/email/data/security/server/portal, ack/snooze, heavy runs), cf-astro `/api/health` + heartbeat probe, cf-backup readiness/diagnostics, cf-vps probes module (`host/72-probes`), cf-graph latency probe, cf-backup `tick-deadman.yml`. Five health systems. | `src/lib/health/catalog.ts`; `WHERE-THE-DATA-LIVES.md` |
| **Design system / dialogs** | "Midnight Slate" (`documentation/reference/DESIGN-SYSTEM.md`), `src/styles/components/console.css` kit, `dialogStore.ts`, RULESAd §7.8 mandatory dialog rules. cf-backup and cf-vps each keep their own `DESIGN-SYSTEM.md` and their own Preact UI trees (`src/ui/`), plus a copied `docs/reference/cf-admin/DESIGN-SYSTEM.md` in cf-backup. Three design-system documents, three component sets. | file list in §1 |
| **Docs gates** | cf-admin: `scripts/docs_check.py` (front matter, index drift, links, stale, code paths, routes, root docs), `rules_check.py`, `ratchet.py` (20 counters, e.g. A1=467 lint, A6=680 inline styles, A2=87 raw `.prepare` outside DAL, A15=142,738 lines under src), `a11y_check.py`, `audit_gate.py`, `scripts/lib/verify-runner.mjs`. cf-astro: ratchet + Prettier + a11y. cf-backup/cf-vps/email: docs-mirror identifier checks, published-docs allow-lists, route-permissions test. Each repo re-implements its own verify chain and docs mirror (`sync-docs.yml` in 4 repos; email's not set up). | `scripts/`, each `main.md` §2 |
| **Gateway / service-binding pattern** | cf-admin page + `[...path].ts` gateway → private Worker with `assets.run_worker_first`, actor header + request id + HMAC signature, dev-only mock actor, next-tick contract. Implemented three times (§3c). | `backup-proxy.ts`, `vps-proxy.ts`, `email-console.ts`, `console-signature.ts`, `CONSOLE-SIGNATURE.md` |
| **CSRF / CSP / security headers** | cf-admin: `middleware.ts` (sentry boundary → `securityHeaders` with nonce CSP → auth), `csrf.ts`, `security/csp.ts` (`'unsafe-inline'` removal blocked on operator check, C-3). cf-astro: own `security-headers.ts`, `security.ts` (386 lines), 449-line middleware. cf-backup/cf-vps: own `http/responses.ts` (strict headers, strip `Set-Cookie`, `no-store`). cf-email-api: `problem.ts`. Five implementations. | §4 table of line counts |
| **Rate limiting** | Cloudflare Rate Limiting bindings per fixed limit: 7 in cf-admin, 10 in cf-astro, 1 in cf-email-api; plus D1 `RateLimitRepository` after the Upstash removal. | wrangler configs |
| **i18n** | cf-astro: `src/i18n/{config.ts,translations/{es,en}.json}`, locale-prefixed routes. cf-admin: none (55 files mention "locale" only for date formatting). Consoles: English/Spanish wording hard-coded in templates (`hotel-templates.ts`). | file list |
| **Email templates** | Four places: cf-admin `email-templates/*.html` (Supabase auth templates), cf-admin `src/lib/email/templates/invite-template.ts`, consumer `hotel-templates.ts`/`templates.ts`/`templates-contact.ts` (991 lines), consumer stored `templates`/`template_versions` tables, cf-admin `admin_email_templates`. | file list |
| **Outbox / replay** | cf-admin `sync-outbox.ts` + `SYNC_QUEUE`; cf-astro `src/lib/outbox/` for consent and booking replay; consumer lease table and DLQ handler. Three outbox implementations. | file list |
| **Rules contract for agents** | `main.md` cloned into six repos with per-repo text; `RULESAd.md`/`RULES.md` long rule books; `AGENTS.md` invariants in cf-astro. | repo roots |

---

## 6. Pain points (cited)

### Scattering and duplication
- **Email is split across three repos**: cf-admin's portal sends through the queue but also calls
  Brevo directly for engine/senders/quota/DNS (`src/pages/api/emails/engine.ts` etc.); cf-astro hosts
  the Brevo webhook; the consumer renders hotel purposes and the API renders API mail. cf-admin's
  `EMAIL-PORTAL.md` once documented a `POST /api/emails/cancel` that "does not exist" (C-17).
- `alert-gate.ts` and `sync-contract.ts` exist in both cf-admin and cf-astro and have diverged
  (270 vs 417 lines; 84 differing lines after whitespace strip). cf-astro TODO 0d: the `arco` rate-limit
  key is unused and "cf-admin's mirror of the contract would have to drop it too".
- Three gateways, three actor receivers, three capability catalogs, three design-system docs, five
  security-header implementations, five health systems, three outboxes (§5).
- Plan-of-record docs for cf-backup live canonically in **cf-admin** (`documentation/program/cf-backup/`)
  and are copied into cf-backup via `scripts/sync-reference-docs.mjs` (`docs/reference/SYNC.md`);
  cf-backup also carries copies of cf-admin's `RULESAd.md`, `PERMISSIONS-SYSTEM.md`, `DESIGN-SYSTEM.md`.
- Blog and platform-alert tables are created by two repos' migrations (§2c.2).

### Inconsistency
- Role names: code vs database vocabulary (C-11); `admin_pages.required_role` CHECK hard-codes five
  legacy names; Viewer cannot be a page default.
- Migration numbering shared across three series with 26 collisions (RULE #0.7b).
- Three config tables plus `site_settings` plus `policy` (§2c.3).
- Doc-stated counts drift repeatedly; `ARCHITECTURE.md` and `PERMISSIONS-SYSTEM.md` carry long
  "corrected on …" trails (e.g. ARCHITECTURE §1, §2, §5, §8, §10 all corrected 2026-09-19).
- cf-astro binding calls from cf-admin without the trailing slash Astro requires
  (`trailingSlash: 'always'`) — "not settled in production" (cf-astro TODO 0c).

### Dead code / dead data
- `cms_content_history` zero writers; Supabase `admin_sessions` 28 leftover rows; `privacy_requests`
  still declared in cf-astro schema; `admin_feature_flags` redundant (2026-08-06 audit).
- E-8: email branding settings "written but read by nothing"; E-9: `brevo_api_key` dead D1 read on six routes.
- cf-astro `DATABASE_URL_ADMIN` and `SENTRY_DSN` secrets "read by nothing" (`SECURITY.md` §13).
- consumer `mailroom_key` "unused since 2026-10-14"; unused KV namespace and `DATABASE_URL` secret
  awaiting deletion (ROADMAP owner steps). cf-vps Mailroom built 2026-10-10 and retired 2026-10-14.
- Upstash references remain in 4 cf-admin files after removal.
- `cf-backup/.github/workflows/db-backup.yml` disabled but present.
- cf-admin `documentation/architecture/GLOBAL-CONFIG.md` is a proposal doc kept as active.

### Security weak spots noted by the repos themselves
Ten items were listed here on 2026-10-18, taken from the private documents that own them: cf-admin
`MAINTENANCE.md` (C-3, C-6, C-7, C-8, S-2), cf-astro's backlog (0c) and its architecture document
§10, the committed `wrangler.toml` variables, the consumer's CPU owner step in its roadmap, and
cf-graph `main.md` §5. The list was removed from this copy the same day, when the folder was
published to the public docs mirror at the owner's request: a known weakness stays in the private
document that owns it, with at most a pointer (CONTRIBUTING-DOCS). The private repository's history
before that commit keeps the list.

### Kit-relevant backlog items already written down
- **M-1 "Fleet tooling does not exist.** No `wrangler.template.toml`, no provisioning script, no fleet
  migration runner, no version/drift inventory … The binding constraint on the business."
- **M-3 "Pet-hotel domain not extracted from the framework.** `booking_pets`/`booking_quality_metadata`
  schema, hardcoded copy, `madagascar-*` binding names. Every new client deployment inherits tables it
  does not need." (`documentation/MAINTENANCE.md`, Commercial follow-ups 2026-07-26)
- M-6: D1 storage is per account (5 GB across the whole fleet).
- `documentation/reference/DYNAMIC-ROLES-PBAC-DESIGN.md`, `RBAC-AT-SCALE.md`,
  `PERMISSION-ARCHITECTURE-ASSESSMENT.md`, `commercial-readiness-checklist.md` already exist as design
  studies for a multi-client permission model.

---

## 7. What is good and worth carrying forward as design

1. **Audit-first writes with a replay outbox** for life-safety data (`consent_attempts`→`consent_records`,
   `booking_attempts`→`bookings`), drained by a job and watched by a heartbeat.
2. **Identity centralised, decision edge-local**: resolve once into a flat access map inside the
   session record; revocation flags beside it; `authz-changed` mark instead of forced logout.
3. **Default-deny API inventory enforced by a test** (`API_PAGE_MAPPING` + `test/api-authz-inventory.test.ts`),
   and two independent guard mechanisms per route.
4. **Private consoles behind one gateway**: no route, no `workers.dev`, no previews; service binding
   only; signed actor header with request id and 60-second HMAC; dev-only mock actor stripped from
   production builds; `assets.run_worker_first`.
5. **Check in layers** (gateway → Worker → agent → root ticket), each hop re-verifying from signed facts;
   fail-closed rules written down (cf-vps OVERVIEW "Fail-closed rules").
6. **One contract file read by every party** (`cf-vps/contract/*`), with a route-table fingerprint test.
7. **Capability catalog with class (read/operate/admin), floors, defaults per role, personal
   grants with end dates, delegation capped at the delegator's own holdings, generated permissions
   doc that fails the build on drift** (cf-backup `PERMISSIONS.md`, cf-vps `PERMISSIONS.md`).
8. **Fresh sign-in for dangerous actions, second-person approvals, last-Owner guard, hourly per-person
   limits for the riskiest actions.**
9. **The job registry with criticality tiers in code, budgets, leases, next-tick contract, and a
   per-job loopback invocation** (`enable_ctx_exports`, `JobRunner`) to live inside the Free-plan CPU budget.
10. **Settings as a typed, scoped, revisioned document store** (`admin_portal_settings`, compare-and-swap)
    rather than env vars (RULE #0.8) — generalise it, then retire the four competitors.
11. **`ProviderResult<T>`**: never throw across the provider boundary; map misconfiguration to 4xx, outage to 502.
12. **Two-provider rule for backups** (encrypted data at Cloudflare, key in Supabase Vault, meeting only
    inside a private Worker); `age` public-key encryption; restore tests as a first-class feature.
13. **Public-docs mirror by allow-list with an identifier scanner that fails closed**; "describe posture,
    not gaps"; every published fact carries source and observation date (cf-graph §5).
14. **The documentation contract**: front matter, `last_verified`, verification logs, index-drift and
    link checks, "one fact, one home", code paths that must exist; ratchet counters that may only fall.
15. **Rules enforced by gates, not prose**: `worker-entry-contract.test.ts` (queue/scheduled exports),
    `public-surface.test.ts` (no public address), `dependencies.test.ts`, `migrations-guard.test.ts`,
    `binding-only-secrets.test.ts`.
16. **"Lean Edge"** budget discipline: measured KV/D1 operations per request, Free-plan ceilings documented.
17. Design-system tokens (OKLCH, surface elevation) and the mandatory dialog rules (§7.8) — keep the
    rules, build the components once.

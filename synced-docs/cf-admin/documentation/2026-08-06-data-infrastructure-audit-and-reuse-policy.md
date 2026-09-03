---

title: "Data Infrastructure Audit & Reuse-Before-Creation Policy"
status: active
audience: [ai, technical, owner]
last_verified: 2026-08-23
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/dal/PortalSettingsRepository.ts, src/lib/dal/FeatureFlagRepository.ts, src/lib/retention-tables.ts, src/pages/api/arco/requests.ts]
related_docs: [reference/coding-standards.md, architecture/GLOBAL-CONFIG.md, reference/RBAC-AT-SCALE.md, MAINTENANCE.md]
tags: [d1, supabase, kv, governance, audit, cleanup, reuse]
---

# Data Infrastructure Audit & Reuse-Before-Creation Policy

> **TL;DR (non-technical):** A live count of every table in the shared D1 and
> Supabase databases, which ones are actually dead versus just new/low-volume, and
> the pattern behind why dead tables accumulate: new features tend to get a new
> table rather than checking whether one already fits. This document records what
> was found today and sets a standing check — read before creating any new table,
> KV namespace, or bespoke service — that's also pointed to from `main.md`,
> `RULESAd.md`, and the equivalent files in `cf-astro`.

## Context / Scope

Triggered by a direct question: across D1 (`madagascar-db`, shared with cf-astro)
and Supabase (`[SUPABASE_PROJECT_REF]`, shared across cf-admin/cf-astro/cf-chatbot),
how much of the schema is actually used, and how should future feature work decide
between reusing something that exists, adopting a free/already-integrated service,
or building new infrastructure? This is a live audit (numbers will drift — re-run
the queries in §1/§2 rather than trusting these numbers past a few months) plus the
policy that came out of it (§4, intended to stay current).

---

## 0. Live totals (re-verified 2026-08-23 via Cloudflare + Supabase MCP)

The three-app production estate is **41 env vars** (cf-admin's Worker: 17 `[vars]` +
24 secrets — see `wrangler.toml`) and **63 database tables**:

| Store | Tables | Apps |
|---|---:|---|
| D1 `madagascar-db` | 30 | cf-admin + cf-astro (shared) |
| D1 `chatbot-kb` | 9 | cf-chatbot |
| D1 `whatsapp-chatbot` | 4 | cf-chatbot |
| Supabase `public` (production project) | 20 | cf-admin + cf-astro (shared) |
| **Total** | **63** | |

> **Corrected 2026-08-23.** The per-store cells previously read 31 / 9 / 4 / 19.
> The total was right, but two cells were wrong in opposite directions and
> cancelled out: `madagascar-db` was counted **including** `d1_migrations`, which
> the counting SQL in `RULESAd.md` §0.9 excludes, and Supabase `public` was one
> short. Re-queried live: `sqlite_master` gives 30 / 9 / 4 with the `d1_%`
> exclusion applied, and Supabase `list_tables` gives 20. `RULESAd.md` §0.9 —
> the owner of this figure — already carried the correct breakdown; this table
> is now consistent with it. **Count the same way every time, or two errors will
> agree on a total again.**

`chatbot-kb` and `whatsapp-chatbot` were not in scope of the 2026-08-06 audit below
(that pass only covered cf-admin's own D1 + the shared Supabase project) — they're
added here so RULE #0.8/#0.9's "41 env vars / 63 tables" figures in `main.md` have a
single documented source. A second Supabase project (`[SUPABASE_PROJECT_REF]`,
37 tables) also exists on the account but is the legacy/superseded project referenced
in `runbooks/supabase-account-advisor-sweep.md` — not part of the current three-app
system, deliberately excluded from this total.

**2026-08-12 correction:** `platform_alerts` (migration `0048_platform_alerts.sql`,
shipped 2026-08-07 — a durable dead-letter table for critical system alerts, written
by `src/lib/alert-gate.ts`) had a real, in-use table that was missing from this
inventory and the `29`/`61` totals. Added to §1 below; D1 `madagascar-db` went 29→30
and the full-estate total went 61→62. The migration file itself was also renumbered
from `0042` to `0048` on 2026-08-12 to resolve a duplicate-`0042` filename collision
with `0042_create_storage_file_requests.sql` (renumbered to `0047` was tried first,
but a concurrently-added `0047_create_gsc_index_log_and_seo_settings.sql` claimed
that number in the same window, so `0048` is the actual next-free slot) — see
`RULESAd.md` changelog.

**Same-day follow-up:** that `0047` migration is real — it ships `gsc_index_log`
(durable call log for the new Google Search Console indexing automation; see
`src/lib/gsc/sync.ts`) plus two seed rows in the existing `admin_portal_settings`
table (no new table for those, per RULE #0.9). `gsc_index_log` takes D1
`madagascar-db` from 30→31 and the full-estate total from 62→**63**. The feature also
adds one new Worker secret, `GSC_SERVICE_ACCOUNT_JSON`, taking cf-admin from 40→**41**
env vars — a documented, signed-off exception to RULE #0.8's hard cap (a bootstrap-time
external OAuth credential for the Google Search Console API; no dynamic-config
alternative exists for an external auth credential). Both new-infrastructure
justifications: `gsc_index_log` was evaluated against `cf_access_sync_log` (wrong
schema — CF-Access-specific columns) and `admin_audit_log` (`user_id`/`user_role`
`NOT NULL`, requires a real human actor — an autonomous cron process has neither)
before concluding neither existing table fits.

**This is a hard cap, not a target to approach.** Per RULE #0.8/#0.9, a new env var
or a new table is the last option on the table — proposed only once every reuse path
in §4 below has been checked and genuinely doesn't fit.

---

## 1. D1 `madagascar-db` — live table inventory (queried 2026-08-06 via `wrangler d1 execute --remote`; total re-verified 2026-08-12)

31 real tables (excluding `sqlite_master`/`d1_migrations` bookkeeping) — 28 as of the
2026-08-06 audit below, +1 (`storage_file_requests`, migration `0042`, shipped
2026-08-09 — see `features/STAFF-MANAGED-STORAGE.md`), +1 (`platform_alerts`,
migration `0048` — renumbered 2026-08-12 from a duplicate `0042` — shipped
2026-08-07, added to this inventory 2026-08-12), +1 (`gsc_index_log`, migration
`0047`, shipped 2026-08-12 alongside the Google Search Console indexing automation):

| Table | Rows | Status |
|---|---:|---|
| `gsc_index_log` | 0 (new table, not yet applied — see migration status) | Live once migration `0047` is applied — durable log of every Google Search Console API call (sitemap submit + URL inspection), one row per call, written by `src/lib/gsc/sync.ts` |
| `platform_alerts` | — (not re-queried; see verification log) | Live (added 2026-08-07 — durable dead-letter table for critical alerts, survives Sentry/BetterStack/email outages; written by `src/lib/alert-gate.ts` via `PlatformAlertsRepository.ts`; mirrors the same table in cf-astro for platform-wide alerting parity) |
| `storage_file_requests` | 2 | Live (added 2026-08-09, after this audit's original pass — File Request Links sub-feature) |
| `admin_audit_log` | 2,042 | Live, high-volume (expected — every request writes here) |
| `cf_access_sync_log` | 3,766 | Live, high-volume (5-minute cron self-heal, expected) |
| `admin_login_logs` | 251 | Live |
| `consent_attempts` | 243 | Live |
| `system_test_results` | 102 | Live |
| `admin_pages` | 85 | Live (page/PLAC registry) |
| `service_config_history` | 30 | Live |
| `booking_attempts` | 25 | Live |
| `service_config` | 25 | Live — **but see §3, a near-duplicate of `admin_portal_settings`** |
| `admin_user_settings` | 6 | Live (matches current headcount) |
| `admin_access_requests` | 5 | Live, low-volume — confirmed wired (`AccessRequestRepository.ts`) |
| `admin_booking_state` | 4 | Live |
| `storage_files` | 4 | Live |
| `admin_email_templates` | 8 | Live |
| `admin_portal_settings` | 8 | Live (matches the 8 `KNOWN_SETTING_KEYS`, exactly as expected) |
| `cms_content` | 3 | Live |
| `admin_email_drafts` | 3 | Live |
| `storage_share_access_logs` | 2 | Live |
| `admin_feature_flags` | 2 | Live — **but see §3, largely redundant with `admin_portal_settings`** |
| `admin_page_overrides` | 1 | Live — low count is *correct*, not a red flag (PLAC overrides are deltas; most users have none, exactly as designed) |
| `admin_email_suppression` | 0 | **Correctly empty** — verified working (MAINTENANCE.md C-4: full round-trip tested, sentinel row removed); 0 rows means no one has unsubscribed yet, not that it's unused |
| `sync_outbox` | 0 | **Correctly empty** — an outbox-pattern table (`src/lib/sync-outbox.ts`, `sync-revalidate-consumer.ts`); empty is the healthy steady state, not evidence of disuse |
| `blog_posts` | 0 | Wired (`BlogRepository.ts`, `api/content/blog.ts`) but **zero content published yet** — a real, recently-shipped feature pre-launch, not dead code |
| `blog_categories` | 0 | Same as above |
| `blog_posts_history` | 0 | Same as above |
| `blog_redirects` | 0 | Same as above |
| `cms_content_history` | 0 | **Confirmed dead** — already flagged in `MAINTENANCE.md` ("dead table, zero writers"); re-verified live today, still 0 rows, still no writer in `src/` |

**One confirmed genuinely-dead D1 table: `cms_content_history`.** Everything else at
0 rows has an honest explanation (correctly-empty-by-design, or pre-launch with real
code already wired to it) — the lesson isn't "0 rows = delete it," it's "0 rows means
go check why, and the answer is usually more specific than 'nobody built this.'"

---

## 2. Supabase `[SUPABASE_PROJECT_REF]` (`public` schema) — live inventory (queried 2026-08-06 via Supabase MCP)

19 tables. The chat/contact-domain tables (`contacts`, `conversations`, `messages`,
`chat_analytics`, `intent_events`, `kb_gaps`, `conversation_metrics`,
`feedback_events`, `contact_messages`, `contact_message_comments`,
`tool_call_events`) belong primarily to cf-chatbot, which this session did not
review in depth — their row counts (1 to 629) look consistent with a live,
lower-volume-so-far product, not something to flag without reviewing that codebase
directly. The two clear findings from cf-admin's own domain:

| Table | Rows | Status |
|---|---:|---|
| `admin_sessions` | **28** | **Confirmed dead.** The only reference to it anywhere in `src/` is a comment in `src/pages/api/audit/sessions.ts`: *"Replaces the defunct Supabase `admin_sessions` table (removed with GoTrue)... Sessions are now managed in KV."* The 28 rows are leftover data from before the GoTrue removal — nothing reads or writes this table today. |
| `privacy_requests` | 0 | **Confirmed orphaned** — the codebase's own comment in `src/pages/api/arco/requests.ts` calls it exactly that: *"the orphaned `/api/privacy/arco`/`privacy_requests`..."*, superseded by `legal_requests` (which is the live, actively-read/written ARCO channel — 0 rows currently, but real code, not dead). |
| `legal_requests` | 0 | **Not dead** — actively wired (`arco/requests.ts`, `arco/requests/[id].ts`); 0 rows simply means no ARCO request has arrived yet. |

**Two confirmed genuinely-dead/orphaned Supabase tables: `admin_sessions` (has
actual leftover data) and `privacy_requests`.** Both are already self-documented as
retired *inside code comments* — meaning the knowledge already existed, just not
anywhere someone deciding whether to reuse-or-create would naturally look first.

---

## 3. The recurring pattern: near-duplicate config mechanisms, not (yet) consolidated

This is the more important finding than any single dead table, because it's
*already been identified once before and wasn't fully acted on* —
`documentation/reference/coding-standards.md` §8 already says, in its own words:

> `service_config` (migration `0028`) is a second, older generic config table
> already in this codebase, used by the cf-astro/cf-chatbot control plane. The two
> are not yet consolidated — that's a separate cleanup, not something to solve by
> picking whichever one is more convenient in the moment.

Today's audit adds a **third** mechanism to that same list that wasn't in that
section yet: `admin_feature_flags` (2 rows) is a narrower, boolean-only version of
what `admin_portal_settings` (which supports `setting_type = 'json'` and per-scope
overrides) can already do. None of these three are wrong on their own — the pattern
worth naming is: **each was added when a feature needed config, without first
checking whether an existing general-purpose config table already covered it.**
That's the exact behavior this document's policy (§4) exists to interrupt, and it's
already visibly happened three times in one codebase, not hypothetically.

---

## 4. The policy: three questions, in order, before adding new infrastructure

This is the standing check — pointed to from `main.md`, `RULESAd.md`
(RULE #0.6), and the equivalent files in `cf-astro`. Apply it before creating a new
D1 table, a new KV namespace, a new Supabase table, or a new external service
integration.

### Question 1 — Does something that already exists cover this?

Check, in this order: `coding-standards.md` §8 (config), this document's table
inventory (§1/§2, but re-verify live — it drifts), and a grep across `src/` for
related table/repository names. `admin_portal_settings` already covers most
"global/per-role/per-user config" needs (see `GLOBAL-CONFIG.md` for a worked
example of extending it rather than adding a new table for session timing and page
notices). An entity that isn't config — a real registry of distinct records (files,
bookings, users) — still gets its own table; that was never in question, and this
policy doesn't change it.

### Question 2 — If nothing existing fits, does a free/open-source/already-integrated service solve this better than building it?

Worked examples from recent decisions, shown so the reasoning is concrete rather
than a slogan:

| Need | Considered | Verdict | Why |
|---|---|---|---|
| Boolean/rollout feature flags | PostHog Feature Flags (already integrated — the `claude.ai PostHog` connector is active for this project's org) | **Worth adopting the next time flags need real targeting** (percentage rollouts, per-role/cohort targeting) — not urgent for the current 2 boolean flags | Free tier is 1M flag requests/month; PostHog's own docs specifically recommend caching flag definitions in **Cloudflare KV** for edge/Workers use rather than their stateful SDK's local-evaluation mode — meaning the KV-cache architecture already designed for `GLOBAL_CONFIG` is the *same shape* PostHog itself recommends, so adopting it later is a source-of-truth swap, not a rearchitecture. |
| Fine-grained resource-sharing permissions (ReBAC) | OpenFGA / SpiceDB / Ory Keto (Zanzibar-derived, open-source) | **Not adopted** — build a hand-rolled relationship-tuple table in D1 instead, for now | All three require **hosting a separate service plus its own backing database** — real new infrastructure and on-call surface, not a drop-in library. Reserve for the day relationships need genuine deep/recursive graph traversal (see `RBAC-AT-SCALE.md` §4.5/§4.6). |
| System-wide dynamic config (session timing, theme default, page notices) | A generic OSS config-management service | **Not adopted** — extend `admin_portal_settings` + a KV cache layer instead | This is app-specific operational config, not a category a third-party config SaaS models naturally; the existing D1 table plus the KV+D1 pattern already proven twice in this codebase (`plac.ts`, `KV-RESILIENCE.md`) is the leaner fit (see `GLOBAL-CONFIG.md`). |

The pattern across all three: **the answer isn't "always reuse a service" or "never
adopt one" — it's evaluate each concern on its own, and be honest about the actual
trade (hosting burden, fit for the specific need, whether it's already paid for and
integrated) rather than defaulting to either extreme.**

### Question 3 — If building new infrastructure is genuinely the right call, say why in the PR/commit, not just build it

A one-line justification ("checked `admin_portal_settings`/`service_config`/
PostHog; none fit because X") costs nothing to write and is the entire mechanism
that prevents this list from needing a fourth entry next quarter.

---

## 5. What to actually do with the confirmed-dead tables found today

Recorded here as findings, not yet actioned (this document doesn't implement
anything — flagged for a decision):

- **`admin_sessions` (Supabase, 28 rows):** safe to archive/drop — zero functional
  references, already self-documented as defunct in code. Export the 28 rows first
  if there's any chance they're wanted for a historical record; otherwise drop.
- **`privacy_requests` (Supabase, 0 rows):** safe to drop — zero rows means no
  export decision to make.
- **`cms_content_history` (D1, 0 rows):** `MAINTENANCE.md` already poses the choice
  correctly — either ship the version-history feature this table was built for
  (writers + UI + trigger) or drop the migration. Still unresolved as of this audit;
  not a new finding, just re-confirmed live.
- **`service_config` vs `admin_portal_settings`, and `admin_feature_flags` vs
  `admin_portal_settings`:** not dead, but worth a deliberate consolidation
  decision rather than leaving three mechanisms live indefinitely. Out of scope for
  this document to resolve unilaterally — flagged for the owner to prioritize
  against other backlog items in `MAINTENANCE.md`.

---

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-08-06 | claude | `wrangler d1 execute madagascar-db --remote` (table list + batched row counts) | Live D1 inventory in §1, cross-checked against `wrangler whoami` (authenticated, OAuth) |
| 2026-08-06 | claude | Supabase MCP `list_tables` on `[SUPABASE_PROJECT_REF]` | Live Supabase inventory in §2 |
| 2026-08-06 | claude | Grep across `cf-admin/src` for every ambiguous/zero-row table name, read matching call sites in full | Distinguished genuinely-dead tables from correctly-empty or pre-launch ones — see per-row citations in §1/§2 |
| 2026-08-06 | claude | Web search: PostHog feature-flag pricing, edge/Workers evaluation guidance | 1M free requests/month confirmed; PostHog's own docs recommend Cloudflare KV as the edge cache layer for flag definitions — see §4 |
| 2026-08-12 | claude | Cloudflare MCP `d1_database_query` (table count, all 3 D1 databases) + Supabase MCP `list_tables` (both projects) + manual count of `wrangler.toml` `[vars]`/documented secrets | Top-line totals only (§0): D1 `madagascar-db` now 29 (was 28, +`storage_file_requests`), `chatbot-kb` 9, `whatsapp-chatbot` 4, Supabase `public` still 19 — 61-table full-estate total added; cf-admin env var count confirmed at 40 (17 vars + 23 secrets). Per-row detail in §1/§2 below is otherwise still the 2026-08-06 pass — re-run before trusting individual row counts. |
| 2026-08-12 (later same day) | claude | Grep of `migrations/*.sql` and `database/legacy_migrations/*.sql` for `CREATE TABLE`, cross-checked against this document's own inventory | Found `platform_alerts` (migration `0042_platform_alerts.sql`) was a real, actively-referenced table (`src/lib/alert-gate.ts`, `PlatformAlertsRepository.ts`, `src/pages/api/alerts/bulk-resolve.ts`) missing from §0/§1. Added it; D1 `madagascar-db` corrected 29→30, full-estate total corrected 61→62. The migration file was also renumbered to resolve a duplicate-`0042` collision with `0042_create_storage_file_requests.sql`: `0047` was picked first as the next-free slot, but a concurrently-added `0047_create_gsc_index_log_and_seo_settings.sql` (not present at the start of this review) claimed that number in the same window, so the file landed at `0048` instead. Row count not re-queried live in this pass — treat as unknown until the next `wrangler d1 execute --remote` sweep. |

## Related

- [`reference/coding-standards.md`](reference/coding-standards.md) §8 — the existing (now broadened) config-table-reuse rule this document builds on.
- [`architecture/GLOBAL-CONFIG.md`](architecture/GLOBAL-CONFIG.md) — the worked example of extending `admin_portal_settings` instead of creating a new table.
- [`reference/RBAC-AT-SCALE.md`](reference/RBAC-AT-SCALE.md) §4.5/§4.6 — the ReBAC build-vs-adopt reasoning referenced in §4's table.
- [`MAINTENANCE.md`](MAINTENANCE.md) — `cms_content_history` was already tracked here; this document re-verifies it live and adds the `admin_sessions`/`privacy_requests` findings.

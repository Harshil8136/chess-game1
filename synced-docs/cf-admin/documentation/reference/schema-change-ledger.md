---

title: "Schema Change Ledger"
status: active
audience: [ai, technical]
last_verified: 2026-09-20
verified_against: [code, infra]
owner: harshil
related_docs: [../../RULESAd.md, ../records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md]
tags: [d1, supabase, migrations, governance]
---

# Schema Change Ledger

> **TL;DR (non-technical):** A one-line-per-migration record of every database
> schema change applied to this project — what changed, when, and by whom —
> so there's a single place to check "has this migration actually run?"
> without querying the live database. Complete and **test-enforced** for the
> D1 migrations in `migrations/`; the Supabase and cf-astro rows are kept by
> convention from 2026-08-12 and are not checked by anything.

## Context / Scope

RULE #0.7 in `RULESAd.md` requires three artifacts per schema change: the
schema TS/DDL, the generated migration file, and an applied-ledger entry. The
first two have always existed (the `migrations/` and `database/legacy_migrations/`
trees). This ledger is the third artifact — it did not exist anywhere in the
repo until 2026-08-12, when a docs-consistency review found RULE #0.7
referencing it while nothing implemented it (unlike RULE #0.6/#0.9, which
point at the real, live
[`../records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](../records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md)).

**Backfilled 2026-09-15 (viability program chunk 5).** Every file in
`migrations/` has a row; the 24 rows for files applied before this ledger
existed take their date from the live `d1_migrations.applied_at` and say
"unrecorded" for who ran them. This ledger is the change *history*; for what
exists **today**, read `database/schema.snapshot.sql` (the DDL truth) and
`RULESAd.md` RULE #0.9 (the estate counts the rules depend on). The 2026-08-06
audit linked above remains the *reuse analysis* — why the estate looks the way
it does — not a current inventory.
Add a row whenever a new migration file lands in `migrations/` (D1) or
`supabase/migrations/` (Supabase) — `test/migrations-guard.test.ts` fails the
build when a D1 file has no row.

**Scope, precisely.** `migrations/` (D1, cf-admin) is complete and enforced:
33 files today, 33 rows. Supabase (`supabase/migrations/`, 11 files) and
cf-astro rows are added by convention only from 2026-08-12 onward, so earlier
Supabase files have no row here by design. `database/legacy_migrations/`
(44 files, consolidated into `migrations/0000_baseline.sql`) is deliberately
not itemised.

## Ledger

| Migration file | Date applied | Applied by | Description |
|---|---|---|---|
| `migrations/0000_baseline.sql` | 2026-07-13 | unrecorded (runner; date from `d1_migrations`) | Consolidated schema baseline generated from production; every `CREATE` is `IF NOT EXISTS`, so it is a no-op on production and provisions a fresh local database in one step. |
| `migrations/0001_add_privacy_delete_action.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Registers the PLAC action for deleting privacy records (`INSERT OR IGNORE` since 2026-07-29: the row predates the baseline). |
| `migrations/0002_create_cf_access_sync_log.sql` | 2026-07-24 | unrecorded (runner; date from `d1_migrations`) | Creates `cf_access_sync_log`, the durable record of every whitelist → Cloudflare Access group sync. |
| `migrations/0002_promote_sessions_page.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Promotes session management from `/dashboard/users/sessions` to the top-level `/dashboard/sessions` under "Security" and re-points per-user PLAC overrides. Shares its number with the row above: frozen history from before RULE #0.7b. |
| `migrations/0003_granular_audit_log.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Neutralised 2026-07-29 — intentionally a no-op (it used to drop and recreate `admin_audit_log`); kept under its name so the applied ledger stays consistent. |
| `migrations/0004_add_arco_queue_page.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Registers the ARCO data-subject-request queue page in the PLAC registry. |
| `migrations/0005_add_retention_review_page.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Registers the owner-gated Retention Review / Purge tool in the PLAC registry. |
| `migrations/0006_rename_privacy_page_label.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Renames the `/dashboard/privacy` sidebar label to "Consent Records" (label only). |
| `migrations/0007_add_privacy_forensics_plac.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Adds the PLAC actions for viewing privacy forensics and exporting reports (renamed from a second `0005` on 2026-07-19 — the collision RULE #0.7b now guards against). |
| `migrations/0008_email_suppression.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Creates `admin_email_suppression`, the CAN-SPAM / CASL suppression list checked before every enqueue. |
| `migrations/0033_create_blog_and_taxonomy_tables.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Creates `blog_categories`, `blog_posts` (with `cover_image_alt` and `published_at` declared here since 2026-08-30, RULE #0.7b), `blog_posts_history`, and the blog PLAC rows. |
| `migrations/0034_blog_quality_gate_and_redirects.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Creates `blog_redirects` and back-fills `published_at`; the two columns its description promises live in `0033` (its header records the 2026-08-30 fix). |
| `migrations/0035_retention_plac_and_flags.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Registers the granular Retention Review sub-actions in `admin_pages`. |
| `migrations/0036_retention_export_plac.sql` | 2026-08-04 | unrecorded (runner; date from `d1_migrations`) | Registers the Retention Export sub-action in `admin_pages`. |
| `migrations/0037_widen_admin_portal_settings_scoped.sql` | 2026-08-06 | unrecorded (runner; date from `d1_migrations`) | Widens `admin_portal_settings` into the scoped config store (`scope_type`/`scope_id`) every later feature reuses (RULE #0.9). |
| `migrations/0038_create_storage_files.sql` | 2026-08-06 | unrecorded (runner; date from `d1_migrations`) | Creates `storage_files`, the one new table of Staff Managed Storage. |
| `migrations/0039_seed_storage_config_and_plac.sql` | 2026-08-06 | unrecorded (runner; date from `d1_migrations`) | Seeds the storage defaults row in `admin_portal_settings` and the storage PLAC rows. |
| `migrations/0040_audit_log_target_index.sql` | 2026-08-06 | unrecorded (runner; date from `d1_migrations`) | Adds `idx_audit_target` on `admin_audit_log` for the per-target activity timeline. |
| `migrations/0041_create_storage_share_access_logs.sql` | 2026-08-06 | unrecorded (runner; date from `d1_migrations`) | Creates `storage_share_access_logs` (per-attempt telemetry for external share links). |
| `migrations/0042_create_storage_file_requests.sql` | 2026-08-09 | unrecorded (runner; date from `d1_migrations`) | Creates `storage_file_requests` and its PLAC rows (tokenised upload links). |
| `migrations/0043_add_blog_bypass_quality_gate_plac.sql` | 2026-08-13 | unrecorded (runner; date from `d1_migrations`) | Adds the PLAC action to bypass the blog quality-gate audit. |
| `migrations/0044_add_blog_ai_prompt_plac_and_settings.sql` | 2026-08-13 | unrecorded (runner; date from `d1_migrations`) | Adds the edit-AI-prompts PLAC action and seeds the default blog AI prompt setting. |
| `migrations/0045_widen_storage_share_logs_attempt_status.sql` | 2026-08-12 | unrecorded (runner; date from `d1_migrations`) | Rebuilds `storage_share_access_logs` so the `attempt_status` CHECK admits `FILE_TOO_LARGE` and `DISALLOWED_EXTENSION` (SQLite cannot alter a CHECK). |
| `migrations/0046_add_storage_files_replaces_file_id.sql` | 2026-08-12 | unrecorded (runner; date from `d1_migrations`) | Adds nullable `storage_files.replaces_file_id` for "Replace this file" provenance. |
| `migrations/0047_create_gsc_index_log_and_seo_settings.sql` | 2026-08-12 | (unrecorded — this ledger began 2026-08-12; seed/example row, added retroactively same-day) | Adds `gsc_index_log` (durable audit log of every Google Search Console API call made by the indexing-automation sync — sitemap submits, URL inspections) and seeds two dynamic `admin_portal_settings` rows (enable/disable master switch, sweep interval in hours) per RULE #0.8's dynamic-config-first pattern. |
| `migrations/0048_platform_alerts.sql` | 2026-08-12 | harshil | Creates `platform_alerts` D1 table and indexes for durable local dead-letter alerting surviving multi-service outages. |
| `migrations/0049_add_seo_dashboard_page.sql` | 2026-08-12 | harshil | Registers `/dashboard/seo` ('Search Console Sync') under `admin_pages` with `required_role = 'super_admin'` (canonical Admin) and sort order 19. |
| `migrations/0050_gsc_index_log_pagespeed_and_richresults.sql` | 2026-08-13 | harshil | Widens `gsc_index_log` with `mobile_usability_verdict`, `rich_results_verdict`, and `service` discriminator (RULE #0.9 reuse for PageSpeed Insights); seeds `pagespeed-check-enabled` and `pagespeed-check-interval-hours` in `admin_portal_settings`. |
| `migrations/0051_blog_suggestions_and_schema_ownership.sql` | 2026-08-30 | claude (blog-system remediation) | Adds `entry_type` + `status` discriminators to `blog_posts_history` so it doubles as the Suggestional Edit store (RULE #0.9 reuse — no new table, same pattern as 0050's `service` column); adds `idx_history_post_entry_status`; registers PLAC capability `/dashboard/content/blog#review-suggestions`. |
| `migrations/0052_hot_query_indexes.sql` | 2026-09-15 | claude (viability program chunk 8b) — applied through the Cloudflare API with the `d1_migrations` row written by hand (id 88), because the sandbox has no `wrangler login`; the runner therefore reports nothing pending | Adds `idx_login_logs_success_created (success, created_at DESC)` on `admin_login_logs` (the stats-bar counts and the recent-logins page were full scans: 319 rows read to return one number) and seeds `admin_portal_settings.seo-validation-readiness-latest` from the newest readiness audit row so `getLatestValidationReadinessReport` reads one row instead of a leading-wildcard `LIKE` over `gsc_index_log` (565:1). Additive; no `ALTER`. |
| `migrations/0053_storage_notification_partial_indexes.sql` | 2026-09-16 | claude (CF-ADMIN-1S follow-up) — applied with `npx wrangler d1 migrations apply madagascar-db --local` then `--remote` | Adds two **partial** indexes on `storage_files` so the `storage-notifications` cron cost tracks live state instead of cumulative file history: `idx_storage_files_live_usage (owner_user_id, size_bytes) WHERE is_deleted = 0` (covering — the per-owner `SUM` no longer needs a table lookup) and `idx_storage_files_live_share_expiry (share_expires_at_ms) WHERE is_deleted = 0 AND share_token_hash IS NOT NULL`. Neither query was missing an index; both were served by indexes spanning every row the table has ever held (4 of the 4 share-token entries existed, 3 of them soft-deleted). Measured live before/after: usage scan 6 -> 2 rows read, share scan 4 -> 1. Additive; no `ALTER`. |
| `migrations/0054_cron_control_plane_pages.sql` | 2026-09-16 | claude (cron control plane, stage C) — `npx wrangler d1 migrations apply madagascar-db --local` then `--remote` | Registers `/dashboard/cron` in `admin_pages` (`required_role` `super_admin`, sidebar-visible at depth 2). **Partially applied:** its three hash-fragment rows passed `NULL` for `icon`, which is `TEXT NOT NULL`, and because the statement was `INSERT OR IGNORE` SQLite discarded them silently while the migration reported success. Repaired by `0055`; not edited, because it is already in the shared `d1_migrations` ledger and editing an applied file is the drift RULE #0.7b forbids. |
| `migrations/0055_cron_control_plane_subpages.sql` | 2026-09-16 | claude (cron control plane, stage C) — same command | Adds the three sub-permission rows `0054` dropped: `/dashboard/cron#pause` (`owner`), `#trigger` (`dev`), `#configure` (`dev`), each with a non-null icon and `parent_path = '/dashboard/cron'`. These rows are load-bearing: `resolveAccess` returns `unknown` for a key the registry does not define and `requirePageAccess` refuses only an explicit deny, so `placDenyResponse` on a fragment permits every role until its row exists. Verified live: four rows at `sort_order` 85-88. |
| `migrations/0056_cron_action_roles.sql` | 2026-09-20 | claude (cron control plane improvement plan, phase 0) — **pending**, applies with `npx wrangler d1 migrations apply madagascar-db --local` then `npm run release` | Moves `/dashboard/cron#trigger` and `#configure` from the `dev` baseline to `owner`. Gate D in `src/pages/api/users/access.ts` refuses a grant when `ROLE_LEVEL[actor] > ROLE_LEVEL[page.required_role]`; `dev` normalises to `vendor_support` (level 0) and the owner is level 1, so `1 > 0` refused every grant the owner attempted and only vendor support could delegate either action — contradicting `features/CRON-CONTROL.md` §2. No baseline decision changes for any role (an admin is level 2 and fails `2 <= 1` either way); only the owner's ability to write an override does. Verified live 2026-09-20: no `admin_page_overrides` row names a cron key. Data only, no `ALTER`. |
| `cf-astro/db/migrations/0015_booking_replay_outbox.sql` | 2026-09-03 | claude/gemini (outbox unblocking remediation) | Adds `replay_payload`, `replay_attempts`, `replayed_at`, `next_replay_at`, and partial index `idx_booking_attempts_pending_replay` to `booking_attempts` in D1 (`madagascar-db`), activating the durable booking replay outbox and resolving 5-min `no such column: replay_payload` cron errors. |
| `cf-admin/supabase/migrations/20260909000001_enhance_contact_messages.sql` | 2026-09-09 | antigravity | Widens `public.contact_messages` in Supabase with `consent_id` FK (`consent_records.id`), `priority`, `assigned_to`, `tags`, `metadata`, and performance indexes for admin inquiries CRM overhaul (RULE #0.9 schema reuse). |
| `cf-admin/supabase/migrations/20260916000000_supabase_objects_chunk_14a.sql` | 2026-09-16 | claude (viability program chunk 14a) — via the Supabase connector `apply_migration`, recorded in `supabase_migrations` under the same name | Adds the two missing FK indexes on `tool_call_events`; removes the five never-used indexes no query path can use (`idx_authorized_users_cf_sub_id`, `idx_bookings_owner_email`, `idx_contact_messages_email`, `idx_legal_requests_email`, `idx_privacy_requests_email`); renames the two dead tables to `zz_dead_admin_sessions_20260916` and `zz_dead_privacy_requests_20260916` (removal = D-15, after the first green backup); removes the `cf_astro_writer_insert` policy on the quarantined table; replaces `purge_expired_privacy_data()` without its `privacy_requests` block. Rollback statements in the chunk record §9. |

### Out-of-band data corrections (not migrations)

Applied via the Cloudflare D1 MCP connector against `madagascar-db`, recorded
here because RULE #0.7's spirit is "no unrecorded change to the live database",
even when the change is data rather than schema.

| Date | Applied by | Change | Why |
|---|---|---|---|
| 2026-08-30 | claude | `blog_posts` → set `status='archived'` on `why-chose-us` (`en`) | The post's `body` was the model's raw JSON envelope wrapped in a `<p>` tag, produced by the fabricated-article fallback in `ai-generate-stream.ts` (removed the same day). It was published and had been pushed to five search engines via IndexNow. Archived rather than deleted so it stays editable in the Studio. |
| 2026-08-30 | claude | `blog_redirects` → insert `why-chose-us`/`en` → `/en/blog/` | Archiving alone makes the URL 404 (`[slug].astro` rewrites to /404 when D1, static and redirect all miss). A 301 to the blog index is the honest retirement for a URL already submitted to search engines. |
| 2026-08-30 | claude | `blog_redirects` → repoint `welcome`/`es` from `/es/blog/why-chose-us/` to `/es/blog/` | The original row was written by the `recordRedirect` locale bug (fixed in `BlogRepository.updatePost` the same day): it used `existing.locale` for the target path after the post's locale had flipped `es`→`en`, so the redirect pointed at an ES URL that never existed. |
| 2026-08-30 | claude | `blog_posts` → imported 14 legacy static Markdown posts (7 EN + 7 ES) via `scripts/import_legacy_blog_posts.py` | The posts existed only as Markdown files in cf-astro's content collection, with no D1 row, so the admin Blog Studio — which reads only D1 — could not list, open or edit any of them. Row ids are UUIDv5 over (locale, slug) and the script emits `INSERT OR IGNORE`, so it is safe to re-run and can never clobber a later edit. Markdown files retained on disk as a cold fallback. All 14 import with `cover_image` NULL (the front-matter has none): they are genuinely published so they import as `published`, but re-publishing any of them from the Studio will require a real cover to satisfy the quality gate. |

## Operational notes

- **Format:** one row per migration file, oldest first. Keep descriptions to
  one line — link to the migration file's own header comment for full
  reasoning (most migrations in this repo already document their RULE #0.9
  reuse-check inline, e.g. `migrations/0047_create_gsc_index_log_and_seo_settings.sql`'s
  header).
- **Dates are UTC** — the `applied_at` value from `d1_migrations`, not local
  time. Two rows had slipped a day against it and were corrected on 2026-09-20
  (`0049` 08-13 → **08-12**, applied `2026-08-12 23:32:43`; cf-astro `0015`
  09-02 → **09-03**, applied `2026-09-03 03:31:32`). Late-evening local
  migrations land on the next UTC day; read the number off `d1_migrations`
  rather than off your clock.
- **"Applied by"** should name the developer or agent session that ran the
  migration once that's reliably capturable; until then, note it as
  unrecorded rather than guessing.
- **Completeness is enforced** since 2026-09-15: `test/migrations-guard.test.ts`
  (part of `npm run verify`) fails when a file in `migrations/` has no row
  here. The same test freezes applied files through
  `database/migrations.manifest.json` (an edit or rename of a frozen file
  fails; a new file must be added with `node scripts/migrations_manifest.mjs`)
  and enforces RULE #0.7b numbering (new files `0033`+, one file per number).
  Rows for Supabase and cf-astro files are recorded here by convention but
  not checked.
- A new D1 migration's row is written in the same commit as the file, with the
  date the deploy that carries it will apply it; `release.mjs` applies pending
  files before the code deploys, so the date is the push date.

## Related

- [`../../RULESAd.md`](../../RULESAd.md) RULE #0.7 — the rule this ledger satisfies.
- `database/schema.snapshot.sql` — the current DDL, and `RULESAd.md` RULE #0.9 for the estate counts. **This is what "exists today" means**; the ledger is the change history, not the inventory.
- [`../records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](../records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md) — the 2026-08-06 reuse analysis (why the estate looks the way it does). A dated audit, not a live inventory.

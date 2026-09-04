---

title: "Schema Change Ledger"
status: active
audience: [ai, technical]
last_verified: 2026-08-24
verified_against: [code, infra]
owner: harshil
related_docs: [../../RULESAd.md, ../2026-08-06-data-infrastructure-audit-and-reuse-policy.md]
tags: [d1, supabase, migrations, governance]
---

# Schema Change Ledger

> **TL;DR (non-technical):** A one-line-per-migration record of every database
> schema change applied to this project — what changed, when, and by whom —
> so there's a single place to check "has this migration actually run?"
> without querying the live database.

## Context / Scope

RULE #0.7 in `RULESAd.md` requires three artifacts per schema change: the
schema TS/DDL, the generated migration file, and an applied-ledger entry. The
first two have always existed (the `migrations/` and `database/legacy_migrations/`
trees). This ledger is the third artifact — it did not exist anywhere in the
repo until 2026-08-12, when a docs-consistency review found RULE #0.7
referencing it while nothing implemented it (unlike RULE #0.6/#0.9, which
point at the real, live
[`../2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](../2026-08-06-data-infrastructure-audit-and-reuse-policy.md)).

**Not backfilled.** Migrations applied before 2026-08-12 are not retroactively
listed here — the live table inventory in the audit doc above is the source of
truth for what currently exists. This ledger only tracks changes from
2026-08-12 forward. Add a row here whenever a new migration file lands in
`migrations/` (D1) or `supabase/migrations/` (Supabase).

## Ledger

| Migration file | Date applied | Applied by | Description |
|---|---|---|---|
| `migrations/0047_create_gsc_index_log_and_seo_settings.sql` | 2026-08-12 | (unrecorded — this ledger began 2026-08-12; seed/example row, added retroactively same-day) | Adds `gsc_index_log` (durable audit log of every Google Search Console API call made by the indexing-automation sync — sitemap submits, URL inspections) and seeds two dynamic `admin_portal_settings` rows (enable/disable master switch, sweep interval in hours) per RULE #0.8's dynamic-config-first pattern. |
| `migrations/0048_platform_alerts.sql` | 2026-08-12 | harshil | Creates `platform_alerts` D1 table and indexes for durable local dead-letter alerting surviving multi-service outages. |
| `migrations/0049_add_seo_dashboard_page.sql` | 2026-08-13 | harshil | Registers `/dashboard/seo` ('Search Console Sync') under `admin_pages` with `required_role = 'super_admin'` (canonical Admin) and sort order 19. |
| `migrations/0050_gsc_index_log_pagespeed_and_richresults.sql` | 2026-08-13 | harshil | Widens `gsc_index_log` with `mobile_usability_verdict`, `rich_results_verdict`, and `service` discriminator (RULE #0.9 reuse for PageSpeed Insights); seeds `pagespeed-check-enabled` and `pagespeed-check-interval-hours` in `admin_portal_settings`. |
| `migrations/0051_blog_suggestions_and_schema_ownership.sql` | 2026-08-30 | claude (blog-system remediation) | Adds `entry_type` + `status` discriminators to `blog_posts_history` so it doubles as the Suggestional Edit store (RULE #0.9 reuse — no new table, same pattern as 0050's `service` column); adds `idx_history_post_entry_status`; registers PLAC capability `/dashboard/content/blog#review-suggestions`. |
| `cf-astro/db/migrations/0015_booking_replay_outbox.sql` | 2026-09-02 | claude/gemini (outbox unblocking remediation) | Adds `replay_payload`, `replay_attempts`, `replayed_at`, `next_replay_at`, and partial index `idx_booking_attempts_pending_replay` to `booking_attempts` in D1 (`madagascar-db`), activating the durable booking replay outbox and resolving 5-min `no such column: replay_payload` cron errors. |

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
- **"Applied by"** should name the developer or agent session that ran the
  migration once that's reliably capturable; until then, note it as
  unrecorded rather than guessing.
- This is a manually-maintained table, not a CI-enforced gate. There is no
  `db:check` script — RULE #0.7 asked for one for months and it was never
  written; the rule now points at `wrangler d1 migrations apply` and
  `npm run verify` instead. Nothing validates ledger completeness automatically. Treat gaps here as a documentation debt to close
  opportunistically, not a build-blocking violation.

## Related

- [`../../RULESAd.md`](../../RULESAd.md) RULE #0.7 — the rule this ledger satisfies.
- [`../2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](../2026-08-06-data-infrastructure-audit-and-reuse-policy.md) — live table inventory (the source of truth for what exists today; this ledger is the change history, not the inventory).

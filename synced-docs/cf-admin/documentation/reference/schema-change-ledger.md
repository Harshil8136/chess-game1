---

title: "Schema Change Ledger"
status: active
audience: [ai, technical]
last_verified: 2026-08-12
verified_against: [code]
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

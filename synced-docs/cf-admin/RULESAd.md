# CF-ADMIN PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Version: v5.1 · Last Updated: 2026-09-19** — correction pass. This
> one version number governs the whole file; per-section version tags have been
> removed, because they had drifted to four different values (header v4.9, §9.0
> "v4.8", §9.1 "v4.5", root `README.md` "v4.7") and a reader had no way to tell
> which was current.
>
> **v5.1 changes (2026-09-19):** RULE #0.8's env figure corrected to **42**
> (17 `[vars]` + 25 secrets) along with the counting command that undercounted
> it; RULE #0.7 now points at the release pipeline instead of a hand-run
> `--remote` apply; §7.3's whitelist re-derived against `package.json`
> (`@preact/signals` removed, `aws4fetch` added) and labelled as unenforced;
> §9.0 no longer claims blanket CI enforcement — each rule names what really
> backs it; §12 corrected: Workers Builds is **still on its default command**,
> so the push does *not* run `verify` or apply migrations; §7.6's
> `LOCAL_DEV_ADMIN_EMAIL` note reversed (it belongs in `.dev.vars`); §9.1's
> "all functions hardened" claim corrected against a live query; §2's KV table,
> §7.6's secret list and §13's folder tree replaced with pointers to their
> owners. Open items: [`documentation/MAINTENANCE.md`](./documentation/MAINTENANCE.md).
>
> Change history lives in git — this header records the current version and the
> reason for it, not a running changelog.

> **Research Sources:** Cloudflare Docs MCP, Supabase MCP, Cloudflare Bindings MCP, Official Documentation

---

## 🛡️ RULE #0 — THE ABSOLUTE LAW (NEVER VIOLATE)

**cf-admin is the Cloudflare-native version of admin-app. We can deeply review, understand how everything looks, works, and is designed in admin-app — however, WE NEVER, like NEVER, copy any single file or code from there.**

This is the **STRICTEST** rule and MUST be followed at ALL times:

- ✅ **ALLOWED:** Reference admin-app to understand features, flows, UX patterns, business logic concepts
- ✅ **ALLOWED:** Use MCP tools (Cloudflare Docs, Supabase, Tavily) and SKILLs to find the best Cloudflare-native approach
- ✅ **ALLOWED:** Build equivalent functionality from scratch using Cloudflare-optimized patterns
- ❌ **FORBIDDEN:** Copy-pasting any file, component, function, hook, schema, or code block from admin-app
- ❌ **FORBIDDEN:** Duplicating CSS, design tokens, or configuration verbatim from admin-app
- ❌ **FORBIDDEN:** Using admin-app files as templates with "find and replace" modifications

**Every line of code in cf-admin must be written fresh, optimized for the Cloudflare + Astro + Preact stack.**

---

## 🛡️ RULE #0.5 — NO FAKE DATA OR PLACEHOLDERS

**ALL data and presented information MUST be real and accurate, sourced from active databases (Supabase/D1) or actual API telemetry (Cloudflare Analytics/Resend/etc).**

- ❌ **FORBIDDEN:** Randomly generated chart data (e.g. `Math.random()`), hardcoded dashboard metrics (`sessionCount = 24`), or mock user activity logs.
- ❌ **FORBIDDEN:** "Under Construction" placeholder pages masking incomplete features.
- If a feature requires data that cannot be currently provided by the backend, the feature MUST NOT be built with mock data. Instead, either:
  1. Omit the feature entirely from the UI, OR
  2. Implement the full backend pipeline to fetch the real data.
- If real data cannot be provided even when explicitly requested by the USER, the AI agent MUST provide a documented explanation and refuse to implement the mock data solution.

---

## 🛡️ RULE #0.6 — REUSE BEFORE CREATION (D1/Supabase/KV/services)

**Before creating a new D1 table, a new Supabase table, a new KV namespace, or integrating a new external service, three questions must be answered, in order — see [`documentation/records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](./documentation/records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md) for the full live audit and reasoning this rule is based on.**

This exists because the pattern has already recurred: `service_config` → `admin_portal_settings` → `admin_feature_flags` are three separate, never-consolidated mechanisms for the same general idea, and a live audit on 2026-08-06 found two confirmed-dead Supabase tables (`admin_sessions`, `privacy_requests`) that existed only because nobody checked for an existing fit before adding the next one.

> **Hard cap, not a guideline.** The counts that define these caps live in
> **RULE #0.8** (env vars) and **RULE #0.9** (tables) below — this rule does not
> restate them, because restating them is exactly how they drifted: until
> 2026-08-13 this paragraph said "40 env vars / 62 tables", #0.8 said "41", and
> #0.9 said "63", all in the same file. A new environment variable or a new
> database table is the **last option on the table**, proposed only after every
> reuse path below has been checked and genuinely doesn't fit — never the first
> thing reached for.

1. **Does something that already exists cover this?** Check [`documentation/reference/coding-standards.md`](./documentation/reference/coding-standards.md) §8 (config tables — `admin_portal_settings` covers most global/per-role/per-user config needs already), the audit doc's live table inventory, and a grep of `src/` for related repository/table names.
2. **If nothing existing fits, does a free, open-source, or already-integrated service solve this better than bespoke infrastructure?** This project already has active connectors for Cloudflare, Supabase, Sentry, and PostHog — evaluate honestly per-case (the audit doc has three worked examples: adopt PostHog for feature flags needing real targeting; don't adopt a hosted ReBAC/graph-auth engine for permissions this project doesn't need yet; don't adopt a third-party config SaaS for system settings that already have a home in D1).
3. **If new infrastructure is genuinely the right call, say why in one line in the PR/commit.** That's the entire mechanism that prevents this list from needing a fourth entry.

- ❌ **FORBIDDEN:** Creating a new table/namespace/service integration without first checking for an existing one that already fits.
- ✅ **ALLOWED, and expected:** Creating new infrastructure when the check comes back negative — this rule is about checking first, not about never building anything new.

---

## 🛡️ RULE #0.7 — SCHEMA CHANGE LEDGER (3 ARTIFACTS PER CHANGE)

**Every schema change requires 3 artifacts** (and two more the build demands —
see the note under artifact 3):

1. **Schema TS/DDL** — the `CREATE`/`ALTER` statement itself, in a new file under `migrations/` (D1) or `supabase/migrations/` (Supabase).
2. **Applied migration** — for D1, **let the release pipeline apply it**:
   `npm run release` (alias `npm run cf:deploy`) runs `scripts/release.mjs`,
   which regenerates and diffs `database/schema.snapshot.sql` for drift,
   refuses a destructive migration that carries no `-- contract:` marker, and
   applies pending migrations immediately before the new code deploys — see
   [`documentation/runbooks/release-and-rollback.md`](./documentation/runbooks/release-and-rollback.md).
   For local work: `npx wrangler d1 migrations apply madagascar-db --local`.
   > *Corrected 2026-09-19:* this rule used to tell readers to run
   > `npx wrangler d1 migrations apply madagascar-db --remote` for production.
   > A hand-run remote apply skips all three guards above, so a contract
   > migration can land under the code that is still running. Keep `--remote`
   > only as the documented break-glass step (the runbook's rollback path), and
   > say in the commit why the pipeline was bypassed.
   >
   > **Corrected 2026-09-02.** This rule previously said "do NOT use
   > `wrangler d1 migrations apply` on `madagascar-db`" because the database's
   > `d1_migrations` table "tracks cf-astro's history". A live query of that
   > table shows it is keyed on **filename** and holds both repos' files
   > interleaved — every one of this repo's `migrations/*.sql` files is
   > recorded there, applied by exactly this runner (the pipeline calls it).
   > What the filename key does imply: **never rename an applied migration file**
   > (the runner would re-apply it) and never reuse a number the other repo
   > owns (RULE #0.7b). Supabase changes use the Supabase migration tooling as
   > normal.
3. **Applied ledger entry** — one row in [`documentation/reference/schema-change-ledger.md`](./documentation/reference/schema-change-ledger.md) recording the migration file, date applied, who/what applied it, and a one-line description.

> *Corrected 2026-09-19 — "3 artifacts" is the reviewable minimum, not the full
> set the build enforces.* Two more are mechanical: the file must be frozen in
> `database/migrations.manifest.json` (add it with
> `node scripts/migrations_manifest.mjs`; `test/migrations-guard.test.ts` fails
> `npm run verify` otherwise), and the deploy regenerates
> `database/schema.snapshot.sql` and fails on drift (`scripts/release.mjs`).

**Verify the change landed** by querying the live schema — there is no
`npm run db:check` script in `package.json` (this rule asked for one for months;
it never existed):

```bash
wrangler d1 execute madagascar-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

> **Status note (2026-08-12):** artifact 3 (the ledger) did not exist anywhere in this
> repo until today — this rule referenced it while nothing implemented it, unlike
> RULE #0.6/#0.9 below, which point at the real, live
> `documentation/records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`. The ledger
> is now a real, lightweight doc, seeded with one example row; it is **not** backfilled
> for migrations applied before this date — treat it as an ongoing practice starting
> now, not a complete history.
>
> **Update (2026-09-15, viability program chunk 5):** backfilled to every file in
> `migrations/` (dates from the live `d1_migrations`), and completeness is
> now enforced — `test/migrations-guard.test.ts` fails `npm run verify` when a D1
> migration file has no ledger row. The same test freezes applied files
> (`database/migrations.manifest.json`; add a file with
> `node scripts/migrations_manifest.mjs`). *Corrected 2026-09-19: this said
> "30 of 30"; `migrations/` holds 33 files today, up to
> `0055_cron_control_plane_subpages.sql`. Count it, don't quote it —
> `ls migrations/*.sql | wc -l`.*

---

## 🛡️ RULE #0.7b — SHARED D1 MIGRATION NUMBER OWNERSHIP

**`madagascar-db` is one database with one `d1_migrations` ledger, written to by BOTH this repo and cf-astro.**

> Added here 2026-09-14. RULE #0.7 above and `documentation/operations/OPERATIONS.md`
> §7 already cited "RULE #0.7b", but its only home was `main.md` — the file that is
> supposed to summarise this one, not own a rule. This is now the full text;
> `main.md` links here.

The ledger keys on filename, not number, so duplicate numbers collide *silently* —
**26 numbers** (`0001`–`0015`, `0021`, `0033`–`0042`) already appear more than once in
the live ledger (re-counted against `d1_migrations` on 2026-09-18: **91 rows**, 26
duplicated numbers; `0015` joined the list when cf-astro's
`0015_booking_replay_outbox.sql` was applied on 2026-09-03). Three series feed that
one ledger, not two — cf-astro's `db/migrations/`,
this repo's `migrations/`, and this repo's inert `database/legacy_migrations/` — so
`0001`–`0008` each carry three entries and `0002` carries four. Re-derive both
figures rather than quoting them:

```bash
wrangler d1 execute madagascar-db --remote --json \
  --command="SELECT COUNT(*) AS rows FROM d1_migrations;"
wrangler d1 execute madagascar-db --remote --json \
  --command="SELECT substr(name,1,4) n, COUNT(*) c FROM d1_migrations
             GROUP BY n HAVING c > 1 ORDER BY n;"
```

The number space is owned:

- **cf-astro owns `0001`–`0032`** (`cf-astro/db/migrations/`)
- **cf-admin owns `0033`+** (`migrations/`)

- ❌ **FORBIDDEN:** Taking a number cf-astro owns for a new file in `migrations/`.
- ❌ **FORBIDDEN:** A migration that depends on a column the other repo's migration
  adds. Either repo may be migrated first on a from-scratch rebuild, and SQLite has
  no `ADD COLUMN IF NOT EXISTS` — declare the column in your own
  `CREATE TABLE IF NOT EXISTS` (a no-op if the other repo got there first) rather
  than as an `ALTER`.
- ❌ **FORBIDDEN:** Renaming an applied migration file — the filename key means the
  runner would apply it again (RULE #0.7).

> **Enforced since 2026-09-15** (viability program chunk 5) by
> `test/migrations-guard.test.ts`: a new file in `migrations/` numbered below `0033`,
> two files sharing a number, or an edit/rename of a frozen file fails the build. The
> "declare, never `ALTER`, a column the other repo's migration adds" clause is not
> machine-checked — it is still a reading rule.
>
> *Added 2026-09-19:* `migrations/` already contains ten files numbered
> `0000`–`0008` (including the `0002` pair) from before the ownership split.
> They are frozen history, exempt by name in
> `scripts/lib/migration-guards.mjs` (`HISTORICAL_LOW_NUMBERED`) — seeing them
> does not mean the rule is broken or that the range is open again.

> **This bit production once.** `migrations/0034_blog_quality_gate_and_redirects.sql`
> does `UPDATE blog_posts SET published_at = …` for a column that only cf-astro's
> `cf-astro/db/migrations/0011_blog_quality_gate_and_redirects.sql` created, and
> survived purely because `0011` ran four hours earlier; in the reverse order the
> `UPDATE` fails and wrangler aborts the batch, silently skipping every later
> migration. Closed 2026-08-30 by declaring `published_at` (and `cover_image_alt`)
> in `migrations/0033_create_blog_and_taxonomy_tables.sql`'s `CREATE TABLE`, the
> only order-independent home for them — the header of `0034` records why.

---

## 🛡️ RULE #0.8 — ENV VAR CAP & DYNAMIC CONFIG FIRST (HARD STOP, WE ARE NOT ADDING MORE)

cf-admin's production Worker carries **42 env entries** (17 `[vars]` + 25 secrets),
live-counted on 2026-09-18 against the deployed Worker. The platform limit is
**64 per Worker on Workers Free** (128 on Paid) — this rule's cap is a *policy*
choice about where configuration belongs, not a platform ceiling, and it used
to be stated as if it were one. Re-derive with:

```bash
grep -cE '^[A-Z0-9_]+ = ' wrangler.toml   # the [vars] block (17)
wrangler secret list                       # the authoritative secret count (25)
```

> *Corrected 2026-09-19.* This rule read "**40** (15 `[vars]` + 25 secrets)" and
> shipped a command that reproduced the wrong half of it: the character class
> `[A-Z_]*` has no digits, so `CF_D1_DATABASE_ID` and `CF_R2_BUCKET_NAME` were
> skipped and the grep returned 15. The live Worker reports 17 `plain_text` +
> 25 `secret_text`. A cap whose own re-derivation under-counts is worse than no
> cap: it tells the next reader there are two slots free that do not exist.
> [`documentation/program/DEBT-REGISTRY.md`](./documentation/program/DEBT-REGISTRY.md)
> C5 carries the same command and the same 15 — fix it there too.

Since viability program chunk 2 the 24 secrets the Worker *requires* are
declared in `wrangler.toml` under `[secrets] required`: `wrangler deploy`
refuses when one is missing, and `worker-configuration.d.ts` (generated by
`npm run types`, verified in CI by `npm run types:check`) is the type every
`env.X` access is checked against — there is no index signature any more. The
25th secret, `RESEND_WEBHOOK_API`, has no reader and is scheduled for removal.
`GSC_SERVICE_ACCOUNT_JSON` and `PAGESPEED_API_KEY` remain the documented
exceptions to this rule (bootstrap-time external credentials with no
dynamic-config alternative, see
[`documentation/records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](./documentation/records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md)).

This is a hard cap, not a soft target. Do NOT introduce new environment variables
(`env.VAR_NAME`, `.dev.vars`, or `wrangler.toml` `[vars]`/bindings) for feature toggles,
limits, or operational settings. All application toggles, operational thresholds, and
non-secret runtime configs MUST be managed dynamically via D1 —
`admin_portal_settings`, through `src/lib/dal/PortalSettingsRepository.ts` — the pattern
every recent feature (Staff Managed Storage, Blog AI, Control Plane connectors) has
already followed. *Corrected 2026-08-23:* this rule also named a `CONFIG_KV` binding as
an alternative. No such binding exists — `wrangler.toml` declares exactly one KV
namespace, `SESSION`, and `CONFIG_KV` appears nowhere in `src/`. D1 is the mechanism.

A new env var is the **last option on the table, not the first** — propose
one only after showing every dynamic-config route was checked and genuinely doesn't
fit (e.g. a bootstrap-time platform credential needed before any D1/KV read is
possible), and say why in the PR/commit. Even then it requires explicit architectural
signoff.

---

## 🛡️ RULE #0.9 — MIGRATION-MINIMAL DATA DESIGN & SCHEMA REUSE (HARD STOP, WE ARE NOT ADDING MORE)

The live production estate is **63 tables** across all three apps, re-counted
against the live databases on 2026-08-13 and again on 2026-09-18, unchanged
(**61 live since 2026-09-16**: viability
program chunk 14a quarantined `admin_sessions` and `privacy_requests` under
`zz_dead_*` names; they are dropped by D-15 after the first green backup):

| Store | Tables | How counted |
|---|---:|---|
| D1 `madagascar-db` [cf-admin + cf-astro] | 30 | `sqlite_master` query below |
| D1 `chatbot-kb` [cf-chatbot] | 9 | same |
| D1 `whatsapp-chatbot` [whatsapp-chatbot Worker] | 4 | same |
| Supabase `public` [cf-admin + cf-astro] | 20 | Supabase MCP `list_tables` |
| **Total** | **63** | |

```sql
-- Run per D1 database; excludes SQLite/D1 internal bookkeeping tables.
SELECT COUNT(*) FROM sqlite_master
 WHERE type='table' AND name NOT LIKE 'sqlite_%'
   AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%';
```

> **Pending, 2026-09-23 (cf-backup, chunk CB-2):** `migrations/0057_backup_runs.sql`
> adds a 31st `madagascar-db` table, `backup_runs` — one row per backup,
> restore-drill or prune attempt. The owner accepted exactly one new table for
> cf-backup on 2026-09-23; the reuse proof is the migration's own header. It is
> not applied yet (an owner release step), so the counts above are still the
> live ones; after the release they become 31 / 64 (62 live). Re-count, don't add.

> The 2026-08-12 breakdown recorded 31 D1 / 19 Supabase. The **total was right**
> and the split was wrong; the live query above is now the derivation, so the
> next reader can re-check it in one command instead of trusting the number.
> A second Supabase project (`supabase-pink-village`, 37 tables) belongs to the
> retired `admin-app` and is deliberately **excluded** — see RULE #0.

See [`documentation/records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](./documentation/records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md)
for the per-table inventory and reuse analysis.
Do NOT create new D1/Supabase tables or write migration scripts when an existing table
can fulfill the requirement. Leverage key-value repositories, generic config columns,
or structured JSON/JSONB payload fields in active tables (`admin_portal_settings`,
`cms_content`, `service_config`, etc.) to store feature state — Staff Managed Storage
(2026-08-05) is the reference case: **3** new tables shipped instead of the 6
originally planned (*corrected 2026-09-19: this said "1 new table". `0038` and
`0041` landed on 2026-08-05 and `0042` on 2026-08-09; halving a proposal is
still the point, but quote the real number in a HARD STOP rule*).
A new table is the **last option on the table, not the first** — a proposed
schema migration MUST formally prove why existing infrastructure cannot house the data
model without structural changes before it's written, not after.

---

## PROJECT MISSION — SECURE ADMIN PORTAL, $0 INFRASTRUCTURE

**cf-admin is a production-ready, commercial-grade administrative portal built entirely on FREE tier services.** Designed to:

- ✅ Manage content, bookings, users, and site settings via secure dashboard
- ✅ Enforce multi-level RBAC (`vendor_support` > `owner` > `admin` > `manager` > `staff` > `viewer`) on every route — 6-tier hierarchy, renamed 2026-07-27; the authoritative model (ladder, PLAC, API authz, revocation) is [PERMISSIONS-SYSTEM.md](./documentation/architecture/PERMISSIONS-SYSTEM.md); [USER-MANAGEMENT.md](./documentation/features/USER-MANAGEMENT.md) owns the account lifecycle
- ✅ Authenticate via Cloudflare Zero Trust Access (identity providers are owned by [CFZT-EDGE-AUTHENTICATION.md](./documentation/features/CFZT-EDGE-AUTHENTICATION.md) — no Supabase GoTrue)
- ✅ Block ALL unauthorized access — identity at CF edge, authorization whitelist in Supabase
- ✅ Role re-check every 30 minutes against the Supabase whitelist, and immediately when an `authz-changed` mark is set; hard-expire sessions at 24 hours (KV TTL + CF session duration + createdAt guard). *Corrected 2026-09-19: this said "D1 re-fetch" — the 30-minute re-check reads Supabase `admin_authorized_users` (`src/lib/auth/stages/refresh-role.ts`); only the hourly PLAC map recompute reads D1 (`src/lib/auth/stages/access-map.ts`).*
- ✅ Run 24/7 at **~$0.50/month** direct infrastructure spend (§15 — everything is on a free tier; the only line item is the chatbot's model fallback). Cost-to-serve is a different number and is owned by the commercial model, not by this file
- ✅ Deliver premium, animated, dark-themed admin experience
- ✅ Meet professional security, accessibility, and performance standards
- ⚠️ Enforce **3-layer defense-in-depth** on Supabase: zero table grants + zero RLS policies for `anon` — both verified live 2026-09-19. The third layer is **not** complete: 2 of the 6 `public` functions (`increment_conversation_metrics`, `purge_expired_privacy_data`) are still `EXECUTE`-able by `anon`, `authenticated` and `PUBLIC` (see §9.1)
- ✅ **Fail-secure** dev mode detection — missing `SITE_URL` defaults to production mode, never bypasses auth

**Every architectural decision optimizes for: maximum security + maximum quality + exactly ZERO ongoing cost.**

---

## 1. PROJECT IDENTITY

| Property | Value |
|----------|-------|
| **Name** | cf-admin (Madagascar Pet Hotel — Admin Portal) |
| **Purpose** | Cloudflare-native admin portal equivalent to admin-app |
| **Framework** | Astro **7.3.2** with `@astrojs/cloudflare` **14.3.1** and `@astrojs/preact` **6.0.5** (resolved versions, 2026-09-18 — `package.json` is the machine-readable source; this row said 7.1.6/14.1.7/6.0.2) |
| **Rendering** | Full SSR (`output: 'server'`) — every route requires auth |
| **UI Islands** | Preact (3KB, React-compatible) for interactive components |
| **Hosting** | Cloudflare Workers |
| **Auth** | Cloudflare Zero Trust Access — CF edge identity; the live provider list is owned by [CFZT-EDGE-AUTHENTICATION.md](./documentation/features/CFZT-EDGE-AUTHENTICATION.md) (Google Workspace + Email OTP) |
| **Database** | Supabase PostgreSQL (shared project `[SUPABASE_PROJECT_REF]`) |
| **Session Store** | Cloudflare KV — custom session records written by `src/lib/auth/session.ts`. An Astro session driver is configured in `astro.config.ts`, but nothing reads `Astro.session` (*corrected 2026-09-19: this row said "via Astro Sessions API"*) |
| **Cache** | Upstash Redis (free tier — **500K commands/month**, 256 MB; *corrected 2026-09-19: this said 10K commands/day*) |
| **Storage** | Cloudflare R2 (CMS image uploads — `madagascar-images` bucket → `cdn.madagascarhotelags.com`) |
| **CSS** | Tailwind CSS v4 via `@tailwindcss/vite` |
| **Design System** | "Midnight Slate" — dark-first with Blue-500 primary accents |
| **Domain** | `secure.madagascarhotelags.com` (`SITE_URL` wrangler.toml var) |
| **GitHub** | `mascotasmadagascar-cmd/cf-admin-madagascar` (private) |
| **Worker Name** | `cf-admin-madagascar` (Mascotas Cloudflare account) |

---

## 2. STRICT HTTP SECURITY HEADERS & CSP

**EDGE-INJECTED SECURITY:** The dashboard enforces strict HTTP security headers injected globally at the edge via Astro middleware `sequence`.

- **Content-Security-Policy (CSP):** Nonce-based `script-src` — `'self' 'nonce-<per-request>'` + a small host allowlist (Sentry, CF Insights, jsDelivr, Google Accounts). `'unsafe-eval'` is forbidden and absent (SEC-01, no exemptions). `'unsafe-inline'` is **still present on the enforcing policy**; a `Content-Security-Policy-Report-Only` canary ships the hardened directive without it, pinned by SEC-01b, and is promoted once it reports clean (blocked on operator verification of Cloudflare Rocket Loader — see MAINTENANCE.md). `'strict-dynamic'` is off for the same reason. `style-src` still uses `'unsafe-inline'` — Preact hydration and Astro scoped styles require it. Also sets COOP, CORP and `X-Robots-Tag`. `public/_headers` exists and carries four static-asset headers and **no CSP** — the `/api/*` rules and the drifted CSP it used to hold were removed on 2026-09-02 (MAINTENANCE C-12, closed). *Corrected 2026-09-19: this line still warned that `public/_headers` carried `'unsafe-eval'`.* `src/lib/security/csp.ts` is the only file to read for the live policy.
- **X-Frame-Options: DENY** (Blocks Clickjacking) — with one path-scoped exception since 2026-09-23: responses under `/dashboard/backup/app/` (the embedded backup console) carry `SAMEORIGIN` and `frame-ancestors 'self'`, guard-tested in `test/csp.test.ts` so no other path can lose `DENY`
- **X-Content-Type-Options: nosniff** (Prevents MIME-sniffing)
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Strict-Transport-Security: max-age=63072000; includeSubDomains; preload** (2 years; set in `src/lib/security/csp.ts:78` — corrected 2026-07-29, previously documented here as `31536000`)

→ See [SECURITY.md](./documentation/security/SECURITY.md) for the full security architecture.

## 2b. RELATIONSHIP TO OTHER PROJECTS

> *Renumbered 2026-09-19:* this was a second `## 2.`, so "RULESAd §2" was
> ambiguous. The two docs that cite §2 mean the CSP section above, so this one
> takes the `2b` suffix (as RULE #0.7b does) and keeps its place in the
> reading order. Section numbering in this file is otherwise historical — it
> skips 5, 6 and 16, and "§6 — Binding IDs" is a subsection of §12.

| Project | Role | Relationship |
|---------|------|-------------|
| **cf-astro** | Main customer-facing website | Shares Supabase project, D1 database, R2 bucket. Connects to Postgres directly over `DATABASE_URL` (postgres.js + Drizzle) — *corrected 2026-09-19: this said "uses Hyperdrive"; cf-astro removed Hyperdrive* |
| **cf-chatbot** | Cloudflare Workers AI Bot | Operates autonomously on Edge natively interacting with WhatsApp/Web. `cf-admin` serves as its secure configuration proxy and analytics Dashboard. |
| **admin-app** | Legacy admin portal (Next.js) | Reference for UX/features only — **NEVER copy code** |
| **nextjs-app** | Legacy main site (Next.js) | Reference only — no code sharing |

### Shared Resources

- **Supabase Project:** `[SUPABASE_PROJECT_REF]` (same PostgreSQL instance)
- **D1 Database:** `madagascar-db` (ID: `[D1_MADAGASCAR_DB_ID]`) — shared between both projects
- **R2 Bucket:** `madagascar-images` → `cdn.madagascarhotelags.com` (CMS images, shared read/write)
- **Analytics Engine:** `ANALYTICS` binding → dataset `madagascar_analytics` (shared, both projects)
- **Queue:** `EMAIL_QUEUE` → `madagascar-emails` (async email dispatch)
- **Cloudflare Account:** Mascotas Madagascar (ID: `[CF_ACCOUNT_ID]`)

### KV Namespaces (Isolated per project)

The namespace registry — live titles, IDs and which project binds each one — is
owned by [`documentation/operations/OPERATIONS.md`](./documentation/operations/OPERATIONS.md)
§1, which §12 below already names as the single source of truth for bindings.

> *Corrected 2026-09-19.* A table here listed the namespaces as
> `cf-admin-session`, `cf-astro-session` and `cf-astro-isr-cache`. No namespace
> carries those titles: the live ones are **ADMIN_SESSION** (bound here as
> `SESSION`), **SESSION** (cf-astro) and **ISR_CACHE**. Two documents naming the
> same three namespaces differently is how a reader ends up editing the wrong
> one, so the copy is gone and the owner is linked instead.

### Isolation Rules

- Admin tables use `admin_` prefix to avoid collision with cf-astro tables
- cf-admin has its own KV namespace for sessions, separate from cf-astro's
- cf-admin has its own Worker deployment (not shared with cf-astro)
- Each project has its own `wrangler.toml`, `.dev.vars`, and deployment pipeline

---

## 3. RBAC — ROLE-BASED ACCESS CONTROL

**Current model (renamed 2026-07-27):** a 6-tier ladder, lower number = higher privilege —
`vendor_support(0) > owner(1) > admin(2) > manager(3) > staff(4) > viewer(5)`. The database
still stores the pre-rename values (`dev`, `owner`, `super_admin`, `admin`, `staff`) and
`normalizeRole()`/`toStoredRole()` translate at the D1/Supabase boundary — see
`plac-and-audit.md` §1.2 for the full translation table and the collision warning
(`super_admin`→`admin` and `admin`→`manager` means a bare stored `"admin"` is ambiguous
without translation).

→ See [PERMISSIONS-SYSTEM.md](./documentation/architecture/PERMISSIONS-SYSTEM.md) for the canonical role table, the PLAC resolution algorithm, API authorization and revocation — it is the authoritative permission model (`documentation/README.md`). *Corrected 2026-09-19: this line sent readers to `plac-and-audit.md`, which is authoritative for the Ghost Audit engine only.*
→ See [USER-MANAGEMENT.md](./documentation/features/USER-MANAGEMENT.md) for the user lifecycle, ghost protection, and hidden accounts.
→ See [plac-and-audit.md](./documentation/architecture/plac-and-audit.md) §1.2 for the stored-value translation table and the Ghost Audit engine.

---

## 4. INFRASTRUCTURE FREE TIER LIMITS

→ See [OPERATIONS.md](./documentation/operations/OPERATIONS.md) for Cloudflare binding IDs, free tier quotas, and the pre-flight deploy checklist.

---

## 7. TECHNOLOGY STACK

> 🛡️ **THE WHITELIST ARCHITECTURE POLICY:** We employ a strict "whitelisting" approach to technology additions. Anything not explicitly listed in this document is considered **BLACKLISTED** by default to protect our <50KB "Lean Edge" budget. If an AI agent or developer wishes to introduce a new library (e.g., React 19, Recharts, shadcn/ui, Hono), it must be explicitly proposed with a strong "why it's needed" justification. The new dependency can ONLY be used if the USER explicitly approves the proposal.

### 7.1 Framework: Astro 7.x (Full SSR for Admin)

- `output: 'server'` — ALL routes are server-rendered (auth check required)
- Cloudflare adapter with native binding access
- Sessions are custom KV records written by `src/lib/auth/session.ts` (the configured Astro session driver is unused — see §1)
- No static pages — admin portal has zero public content
- ❌ **FORBIDDEN:** `export const prerender = true` on ANY page under `src/pages/dashboard/**`
  - Reason: Pre-rendering a dashboard page means Astro builds it as a static file served directly
    from the Cloudflare edge cache, **bypassing the auth middleware entirely**. This strips
    `Astro.locals.user`, `Astro.locals.cspNonce`, and the PLAC access check — making the page
    unauthenticated and breaking CSP nonce injection. Use `prerender = false` (or omit the export).
  - **Enforcement:** `eslint.config.js` contains a `no-restricted-syntax` rule that hard-errors on this.

### 7.2 UI: Preact Islands

- Preact 10.29.7 for all interactive components — React-compatible, no React overhead
- Islands hydrate with `client:load` (immediate) or `client:idle` (deferred)
- Cross-island state via the in-repo store `src/lib/signals.ts` (over `src/lib/signalsCore.ts`); no global event bus needed at current scale. *Corrected 2026-09-19: this said `@preact/signals` (pinned 2.10.0). The package was dropped from `dependencies` on 2026-09-02; only an `overrides` pin and an `astro.config.ts` alias remain, for the copy `@astrojs/preact` pulls in.*

### 7.3 Approved Dependency Whitelist

All packages below are **explicitly approved**. Anything NOT listed here is blacklisted by default.

**`package.json` `dependencies` is the approved list.** This table is a reading
aid that names why each entry is there; the versions are the ones resolved on
2026-09-18. When the two disagree, `package.json` wins and this table is the
bug — nothing compares them automatically (see the enforcement note below).

| Package | Version | Purpose |
|---------|---------|---------|
| `astro` | `7.3.2` | Framework (SSR, Workers adapter) |
| `@astrojs/cloudflare` | `14.3.1` | Cloudflare adapter — binding access |
| `@astrojs/preact` | `6.0.5` | Preact island integration |
| `preact` | `10.29.7` | UI islands |
| `lucide-preact` | `1.26.0` | Icon library (Preact-native, no extra weight) |
| `zod` | `4.4.3` | Runtime schema validation in API routes |
| `@upstash/ratelimit` | `2.0.8` | Edge-compatible rate limiting |
| `@upstash/redis` | `1.38.3` | Redis client for Upstash |
| `@supabase/supabase-js` | `2.110.8` | Supabase client (service_role only) |
| `@sentry/astro` | `10.73.0` | Error tracking (browser/client SDK only — its server SDK does not run in workerd) |
| `@sentry/cloudflare` | `10.73.0` | Error tracking (Workers runtime, V8 workerd only). Exports **no** `init()` — see OPERATIONS.md §4.1b |
| `tailwindcss` + `@tailwindcss/vite` | `4.3.3` | Tailwind CSS v4 via Vite plugin |
| `aws4fetch` | `1.0.20` | SigV4 signing for R2 presigned URLs (`src/pages/api/storage/presign.ts`) |

> *Corrected 2026-09-19.* The table listed `@preact/signals` (removed from
> `dependencies` on 2026-09-02) and omitted `aws4fetch`, which has been in
> production since 2026-08-05, plus `astro`, the two `@astrojs/*` adapters and
> `tailwindcss`. Five versions were stale. A whitelist that does not list what
> ships cannot be the thing a reviewer checks against.

> **Enforcement: none.** "Anything not listed is blacklisted" is a **reading
> rule** — no script compares `package.json` to this table, and a new
> dependency will not fail `npm run verify` or CI. It holds because a reviewer
> applies it. Do not cite it as a gate.

> **Icon usage:** Always import from `lucide-preact` (NOT `lucide-react`). The package is Preact-native — importing from the wrong package will cause hydration mismatches.

### 7.6 Environment Variables

**Two lists, each with one home — this section keeps neither of them:**

- **Secrets (`.dev.vars` locally, `wrangler secret put <KEY>` in production).**
  Names only: `.dev.vars.example` at the repo root, which `wrangler.toml`
  `[secrets] required` mirrors (a deploy refuses when one is missing). The
  annotated registry is
  [OPERATIONS.md §5](./documentation/operations/OPERATIONS.md).
- **Non-secret config (`wrangler.toml` `[vars]`).** `wrangler.toml` itself is
  the list; RULE #0.8 above owns the count and the cap.

> *Corrected 2026-09-19.* This section used to inline both lists. The secret
> list was missing 11 of the 24 required names, and a note told readers to put
> `LOCAL_DEV_ADMIN_EMAIL` in `wrangler.toml` `[vars]` and "do **not** put them
> in `.dev.vars`" — the exact reverse of `wrangler.toml`'s own comment and
> `.dev.vars.example`. Following it would commit a personal email address to a
> tracked file, add an 18th production var (breaking RULE #0.8) and still not
> work, because `isLocalDev()` needs the `SITE_URL` override that only
> `.dev.vars` provides. **`LOCAL_DEV_ADMIN_EMAIL` is dev-only and belongs in
> `.dev.vars`.** Copies of a list drift; the two homes above do not.

Local setup: `cp .dev.vars.example .dev.vars` and fill in the values. Never set
`PUBLIC_ASTRO_URL` in `.dev.vars` — it causes a CMS revalidation loop (§12).

### 7.7 The "Module Manifest" Pattern

To prevent architectural entropy as `cf-admin` grows, every new feature area must be encapsulated using the **Module Manifest** pattern. Code should be organized into self-contained vertical slices.

**Directory Structure (as it actually is — corrected 2026-09-19):**

```
src/
  ├── pages/dashboard/[module]/     # SSR routes: index.astro + nested routes
  ├── pages/api/[module]/           # the module's API endpoints
  ├── components/admin/[module]/    # the module's Preact islands
  └── styles/pages/[module].css     # page-level CSS, imported by the route
```

> The old version of this block described `src/pages/[module_name]/` with a
> `_components/` subfolder and `src/styles/[module_name]/`. No module is laid
> out that way; an agent following it would create a second, parallel tree.

**Implementation Rules:**

1. **Entry Point (`index.astro`):** Must wrap content in `<AdminLayout title="ModuleName">` and call `requireAuth(Astro)`.
2. **Dynamic Sidebar Auto-Registry:** A module is ONLY visible in the sidebar if its path exists in the D1 `admin_pages` table and the user's role has PLAC authorization. You do NOT hardcode nav links in the UI.
3. **CSS Code Splitting & Scoping:** Keep new styles in the module's own file under `src/styles/pages/` or in a component `<style>` block. *Corrected 2026-09-19: this rule said monolithic global CSS "is strictly forbidden" and told readers to scope styles through a `DashboardStyles.astro` component — which was itself a 1,195-line global stylesheet, and was deleted on 2026-09-15. Meanwhile `src/styles/global.css` does exist and is load-bearing — §7.8 Bug #1's `astro-island { display: contents }` fix lives in it. The rule that still holds: do not add to `global.css` for one module's styling.*
4. **Data Access Layer (DAL):** Never write raw D1 SQL queries directly inside `.astro` frontmatter. All data fetching must go through Repository classes (e.g. `src/lib/dal/PortalSettingsRepository.ts`; count them with `ls src/lib/dal/*Repository.ts` rather than quoting a number — this rule said 18, there are 19) to ensure separation of concerns, security, and testability. Pass the fetched static initial state to Preact islands as props. **Not machine-checked for pages:** SEC-04's sibling rule SEC-03 globs `src/pages/api/**` only, and `src/pages/dashboard/inquiries/index.astro` still calls `db.prepare(` in frontmatter.

### 7.8 Modals, Dialogs & The "Squished Card" Bug — MANDATORY READING

> 🔴 **READ THIS ENTIRE SECTION before building ANY modal, dialog, popup, overlay, empty-state card, or full-screen panel inside a Preact island.**

There are **FOUR** separate CSS bugs that can squish modals/dialogs/cards inside Preact islands. Each has a different root cause. You must defend against ALL four simultaneously.

---

#### Bug #1: The `<astro-island>` Inline Display Bug

**Root Cause:** Astro wraps every `client:load` / `client:idle` component in a custom `<astro-island>` element. Browsers default custom elements to `display: inline`, which causes block children (`w-full`, flexbox containers) to shrink-wrap to their text content width (~100-200px).

**Our Global Fix:** We apply `astro-island, astro-slot { display: contents; }` in `src/styles/global.css` (line 183). This removes the `<astro-island>` from the layout tree, so its children inherit the parent's full width. This fix is already in place — **do NOT re-apply it or add redundant overrides.** (Three pages currently do anyway, forcing `astro-island { display: block !important }`; nothing enforces this rule, so it is a reading rule with three live exceptions.)

---

#### Bug #2: The `overflow` Containing-Block Trap

**Root Cause:** `.admin-main-content` has `overflow-y: auto` (in `AdminLayout.css`), which creates a new CSS **containing block** for `position: fixed` descendants. Any `<div className="fixed inset-0 ...">` overlay rendered inside this scroll container will be **clipped to the scroll container's bounds**, not the viewport. It may appear to work on large screens but will break on smaller viewports or deeply nested components.

**Why `<dialog open>` DOES NOT fix this:** The declarative `<dialog open>` attribute simply makes the dialog visible in-place (like `display: block`). It does **NOT** use the browser's Top Layer. The element stays trapped inside the scroll container's containing block.

**The ONLY reliable fix:** Use `dialog.showModal()` (imperative JavaScript), which promotes the `<dialog>` element into the browser's **Top Layer** — a rendering layer that sits above ALL other content, ignoring ALL containing blocks, overflow clips, stacking contexts, and z-index hierarchies.

---

#### Bug #3: Tailwind v4 `@layer` vs Browser UA Specificity (The Silent Width Killer)

**Observed behaviour:** Tailwind width utilities (`w-full`, `max-w-2xl`) applied via `className` on a `<dialog>` do not take effect; the dialog shrink-wraps to its content. Inline `style={{ }}` on the same element works.

> *Corrected 2026-09-19 — the stated root cause is wrong.* This section said
> `@layer utilities` has "lower cascade priority than unlayered UA defaults".
> Origin precedes layers in the cascade: any author declaration, layered or
> not, beats a normal user-agent declaration. So layer order is **not** why
> `w-full` loses here. The real mechanism is unresolved — candidates are the UA
> `dialog:modal` sizing rules (`max-width: calc(100% - 6px - 2em)` and
> friends), which are not plain `width`, and unlayered author CSS. **The
> empirical fix below still holds and is still mandatory**; only the
> explanation was fiction. Re-derive it before writing a new rationale here.

**The fix:** Use **inline `style={{ }}` attributes** for ALL layout-critical properties on the `<dialog>` element itself.

> **Cost of this mandate:** every dialog written this way raises ratchet metric
> A6 (`inline style={`), a count that may only fall. §8.1 and this section
> therefore pull in opposite directions, and the A6 baseline carries "inline
> styles are MANDATED by RULESAd 7.8" as the reason for a recorded rise.
> Resolving it (a dialog-sizing class, or exempting `<dialog>` from A6) is an
> open item, not something to solve by quietly ignoring one of the two.

---

#### Bug #4: Flexbox Auto-Margin Min-Content Collapse (The Vertical Text Wrapping Trap)

**Root Cause:** In CSS Flexbox (W3C CSS Flexible Box Layout Module Level 1 §8.1), when a parent container uses `flex flex-col items-center` (`align-items: center`), cross-axis alignment calculates free space BEFORE flex item sizing. If a direct flex child element (e.g. `<p>` or `<div>`) has `max-w-md` (`max-width: 28rem`) combined with `mx-auto` (`margin-left: auto; margin-right: auto;`), the browser flexbox engine distributes all horizontal space to the auto margins first. This forces the child element's width box to collapse down to its intrinsic **`min-content` width** — which is the width of the single longest word in the text (e.g. *"generate"* or *"toolbar"*). As a result, every single word in the paragraph is forced to wrap onto its own vertical line!

**The fix:** NEVER place `max-w-*` and `mx-auto` directly on text `<p>` elements that are direct children of a `flex-col items-center` container. Always wrap empty-state text elements in a dedicated block container with explicit inline width styling:
`<div style={{ width: '100%', maxWidth: '448px', margin: '0 auto', textAlign: 'center' }}>`.

---

#### ✅ THE CORRECT PATTERN (MANDATORY)

Every modal/dialog in a Preact island **MUST** follow this exact pattern. Reference implementations: `ConfirmDialog.tsx`, `InviteUserModal.tsx` (`TemplatesPanel.tsx` was a third until 2026-09-14, when it was deleted as dead code left behind by the Emails portal overhaul).

```tsx
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

function MyModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open: ALWAYS use showModal() — NEVER use <dialog open> or toggle className
  const openDialog = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  // Close: ALWAYS use .close()
  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // Handle native Escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => { e.preventDefault(); closeDialog(); };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [closeDialog]);

  // Click-outside (backdrop click)
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === dialogRef.current) closeDialog();
  };

  return (
    <>
      {/* Backdrop styling — MUST use unique ID selector */}
      <style>{`
        #myModalId::backdrop {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
      `}</style>

      {/* DIALOG — inline style is MANDATORY for width/maxWidth/padding/margin.
          aria-labelledby is MANDATORY too: a11y_check.py A11Y-03 is blocking,
          and a <dialog> with no accessible name fails `npm run verify`.
          Point it at the heading inside the modal (or use aria-label). */}
      <dialog
        id="myModalId"
        aria-labelledby="myModalTitle"
        ref={dialogRef}
        onClick={handleBackdropClick}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          padding: 0,
          margin: 'auto',
          width: '100%',
          maxWidth: '672px',   // Adjust per use case
          zIndex: 99999,
          outline: 'none',
        }}
      >
        {/* Inner visual container — Tailwind classes are safe HERE */}
        <div
          className="bg-[var(--theme-surface)] border border-[var(--theme-border-subtle)] w-full rounded-2xl shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="myModalTitle">Modal title</h2>
          {/* Modal content goes here */}
        </div>
      </dialog>
    </>
  );
}
```

#### 🚫 BANNED PATTERNS (Will cause squished modals or vertical text collapse)

| ❌ BANNED | Why It Fails |
|-----------|-------------|
| `<dialog open className="w-full max-w-2xl">` | `open` attr = no Top Layer; Tailwind `w-full` loses to UA `fit-content` |
| `<dialog open className="fixed inset-0">` | Same: not in Top Layer, trapped in scroll container |
| `<div className="fixed inset-0 z-50">` as overlay | Trapped by `overflow-y: auto` containing block |
| `className="w-full"` on `<dialog>` | Tailwind v4 `@layer` loses to UA specificity |
| `<p className="w-full max-w-md mx-auto">` inside `flex flex-col items-center` | Flexbox auto-margins absorb cross-axis space, forcing text box to `min-content` width (every word wraps vertically) |
| `setIsOpen(true)` + conditional `{isOpen && <div>...}` | No Top Layer escape, no native focus trap |

#### ✅ REQUIRED CHECKLIST (Before merging any modal)

- [ ] Uses `<dialog>` element (not a `<div>`)
- [ ] Has an accessible name — `aria-labelledby` pointing at the modal's heading, or `aria-label` (**A11Y-03 is blocking in `npm run verify`**; the template above omitted this until 2026-09-19, so copying it failed the gate)
- [ ] Opens via `dialogRef.current?.showModal()` (not `<dialog open>`)
- [ ] Closes via `dialogRef.current?.close()` (not DOM removal)
- [ ] Width/maxWidth set via **inline `style={{ }}`** (not Tailwind className)
- [ ] Has `::backdrop` styling via `<style>` tag with unique ID
- [ ] Handles `cancel` event (Escape key)
- [ ] Handles backdrop click (`e.target === dialogRef.current`)
- [ ] Inner content div uses `onClick={e => e.stopPropagation()}`

> ⚠️ **CRITICAL DEV WORKFLOW:** If you change a component's architecture from `.tsx` to `.astro` to fix layout bugs, Vite's Hot Module Replacement (HMR) will often cache the old ghost `.tsx` component in memory. **You MUST instruct the user to kill and restart the dev server (`npm run dev`) and hard-refresh the browser for the structural fix to appear.**

---

## 8. CODE QUALITY RULES & ARCHITECTURAL GUARDRAILS

### 8.1 File Size & Complexity Limits (Anti-Bloat)

To keep the architecture lightweight and fast, `cf-admin` aims at strict file
size limits. **Read this section as intent plus current enforcement — they are
not the same thing, and this section used to state only the intent as if it were
the enforcement.**

**Intent:** ~200 lines for components (`coding-standards.md`), 500 as the outer
bound for any file. If a file grows past that, extract logic into modules
(routing constants, security headers, sub-components) rather than disabling the
rule.

**What is actually enforced today (verified 2026-09-02, viability program chunk 4):**

| Scope | Rule | Effect |
|---|---|---|
| All `.ts`/`.tsx`/`.astro` | `'max-lines': 'off'` in `eslint.config.js` | Nothing is enforced by ESLint itself. Marked `TEMP` pending the god-file split pass (chunks 10 and 13.x). |
| 3 named files (`auth/session.ts`, `users/sessions/*.tsx`, `InquiriesDashboard.tsx`) | `['warn', { max: 600 }]` | Warning only. `auth/pipeline.ts` left the list on 2026-09-02 when chunk 10 split it into `src/lib/auth/stages/` (77-line orchestrator; largest stage today is `bootstrap.ts` at 128 lines). |
| `src/pages/dashboard/**/*.astro` | `no-restricted-syntax` on `export const prerender = true` | **Hard error** — this one is real |
| Whole repository | **`scripts/ratchet.py` against `.ratchet.json`** — blocking in `npm run verify` and in the `quality` workflow | **20 counts are pinned** (A1, A1b, A1c, A2–A10, A12–A15, A17–A19, E1): `no-explicit-any`, the two type-aware promise rules, raw `.prepare(` outside the DAL and in API routes, `console.*`, inline `style={`, raw hex, hand-written `try` in routes, Supabase `.from(` outside the DAL, `createAdminClient(` sites, `getRateLimiter(` sites, hand-rolled backoffs, files over 600 lines, lines under `src/`, dead files (A17), uncalled API routes (A18), unreported catches on job paths (A19), deprecated role-alias call sites (E1). **Any change fails, in either direction** — a rise needs `python scripts/ratchet.py --update --reason "…"` committed with it; a fall needs `--update` to lock the new floor. `.ratchet.json` holds the current numbers; do not quote them here. |

`any` is still `'warn'` in ESLint and still forbidden by `coding-standards.md`
for new code; the difference since chunk 4 is that the count is **held** (count
with `npx eslint . -f json`, not by grepping). The same holds for the two
type-aware promise rules enabled the same day and for the files over 600 lines.
Each vertical slice (chunk 13.x) lowers its own share and commits the new
baseline. Do not cite any of these limits as an ESLint `error` until the count
reaches zero and the rule is flipped.

> *Corrected 2026-09-19.* This paragraph quoted `any` as "493 … it cannot go
> up", the promise counts as 114/215 and the 600-line files as 21, and the row
> above said "17 counts may only fall". `.ratchet.json` tracks 20 metrics, A1
> has risen through `--reason` more than once (it is 545 today, and
> `coding-standards.md` already said 547), and `scripts/ratchet.py` fails on a
> **fall** too — an unlocked fall is how a cleanup pass gets reverted by the
> next `--update`. Read `.ratchet.json` and
> [`documentation/program/DEBT-REGISTRY.md`](./documentation/program/DEBT-REGISTRY.md)
> for the numbers; this file owns the mechanism, not the values.

→ See [CODING-STANDARDS.md](./documentation/reference/coding-standards.md) for the full code quality and architecture standards.

---

## 9. SECURITY RULES

### 9.0 Enforced Compliance Rules (code-anchored, CI-blocking)

Each rule below is checked by `scripts/rules_check.py`, which runs in
`npm run verify` and in `.github/workflows/security.yml`. A push that violates
one turns that workflow red.

> **Read what each guard actually matches — they are greps, not analyses.**
> *Corrected 2026-09-19: this paragraph said every rule is "mechanically
> enforced" and that "a PR that violates any rule fails CI". Three things were
> wrong with that as a blanket claim.* (1) There is no PR gate: `main` is
> unprotected and pushes go straight to it (§12). (2) A red `security.yml` does
> **not** stop the deploy — Workers Builds deploys independently (§12). (3) The
> guards are line-regex rules with exemption lists; several are far narrower
> than their one-line summary reads. SEC-02 matches only the literal
> `SameSite=Lax`, so the Astro cookie form `sameSite: 'lax'` passes. SEC-04
> matches one hardcoded array literal (see its row). SEC-06 is satisfied by the
> token `locals.user` appearing anywhere in the file. SEC-03 globs
> `src/pages/api/**` only, so raw D1 in `.astro` frontmatter is invisible to
> it. Treat the table as "this specific pattern is blocked", not "this property
> is guaranteed" — and when you touch a rule, add its negative test in
> `scripts/tests/`.

Compliance mappings link to the OWASP ASVS v4.0.3 matrix in
`documentation/security/compliance/ASVS-L2.md`.

| ID | Rule | Anchor | CI guard | Compliance |
|----|------|--------|----------|------------|
| SEC-01 | `script-src` MUST NOT contain `'unsafe-eval'` — **no exemptions** | `src/lib/security/csp.ts` (`SCRIPT_SRC_ENFORCING`) | `rules_check.py::SEC-01` | ASVS 14.4.3 |
| SEC-01b | The Report-Only canary `script-src` MUST stay free of `'unsafe-inline'`/`'unsafe-eval'` | `src/lib/security/csp.ts` (`SCRIPT_SRC_CANARY`) | `rules_check.py::SEC-01b` | ASVS 14.4.3 |
| SEC-02 | All cookies MUST be `SameSite=Strict` (never `Lax`) | any `SameSite=` in `src/**` | `rules_check.py::SEC-02` | ASVS 3.4.3 |
| SEC-03 | API handlers MUST use a DAL repository (`src/lib/dal/*`), never raw D1 — `.prepare(` or `.batch(` on **any** binding alias. Until 2026-09-02 only the literal `env.DB.prepare(` was matched and 17 files went unseen; the 18 files that call D1 directly today are named in the rule's `exempt` list as the burn-down list (each 13.x slice deletes its own line), and a 19th file is blocked | `src/pages/api/**/*.ts` | `rules_check.py::SEC-03` (negative test: `scripts/tests/test_rules_check.py`) | ASVS 5.3.4 |
| SEC-04 | Use the rank helpers in `src/lib/auth/rbac.ts` — `isManagerOrAbove()`, `isAdminOrAbove()`, `isOwnerOrVendor()`, `isVendorSupport()` — never hardcoded role arrays. `isAdmin()`/`isSuperAdmin()` are `@deprecated` aliases and their call sites are ratchet debt (E1) | `src/pages/api/**/*.ts` | `rules_check.py::SEC-04` — **narrow:** the regex matches one literal array, `['dev','owner','super_admin','admin']`. Live arrays such as `['vendor_support','owner','admin'].includes(user.role)` in `src/pages/api/settings/portal.ts` pass it | ASVS 4.1.3 |
| SEC-05 | Workers runtime has no `process.env` — use `getEnv(context)` from `src/lib/env.ts` | `src/**/*.{ts,tsx,astro}` | `rules_check.py::SEC-05` | ASVS 14.1.1 |
| SEC-06 | Every API handler MUST gate on `requireAuth()`, `placDenyResponse()`, or `locals.user` — no unauthenticated endpoints outside `PUBLIC_API_ROUTES` / `WEBHOOK_ROUTES` | `src/pages/api/**/*.ts` | `rules_check.py::SEC-06` | ASVS 4.1.1 |
| SEC-07 | Every `/api/*` route MUST resolve via `resolveApiAuthz()` — `API_PAGE_MAPPING` prefix or an explicit `PUBLIC_API_*`/`WEBHOOK` allowlist. Default-deny is enforced at runtime by `API_DENY_MODE` | `src/lib/auth/routes.ts`, `src/pages/api/**/*.ts` | `rules_check.py::SEC-07` ✅ implemented 2026-07-25 | ASVS 4.1.5 |
| SEC-08 | `dangerouslySetInnerHTML` MUST receive pre-sanitized content only (`sanitizeHtml`, `escapeHtml`, template literal) | `src/**/*.{ts,tsx,astro}` | `rules_check.py::SEC-08` | ASVS 5.2.6 |
| SEC-09 | Every table with `ENABLE ROW LEVEL SECURITY` MUST also declare at least one `CREATE POLICY` in the same migration | `supabase/migrations/**/*.sql` | `rules_check.py::SEC-09` | ASVS 5.3.4 |
| SEC-10 | Use Web Crypto `crypto.subtle.digest(...)`, never Node's `crypto.createHash(...)` | `src/**/*.{ts,tsx}` | `rules_check.py::SEC-10` | ASVS 6.2.1 |

**Roll-out policy:** New rules ship in `--warn-only` mode for ~1 week
(prints violations, exits 0) so existing tech-debt can burn down without
blocking merges. Once the tree is clean for a given rule, remove `--warn-only`
in `.github/workflows/security.yml`.

**Status (re-run 2026-09-19): `rules_check.py` is BLOCKING** — 11 rules,
0 violations. `a11y_check.py` is also blocking — 6 rules, 0 findings. (The
file counts both scripts print change with the tree; run them, don't quote
them.)

> **This line is a snapshot, not a guarantee — re-run before citing it.** On
> 2026-08-13 it read "0 violations" while the tree actually had 5 (SEC-03 ×4 in
> the new Search Console routes, SEC-08 ×1) and `a11y_check.py` had 7, so
> `npm run verify` was red while three documents said it was green. The SEC-03
> debt this section calls "fully burned down" was reintroduced by the very next
> feature; it has since been re-fixed by moving the queries into
> `src/lib/dal/GscIndexLogRepository.ts`. A burn-down is a state, not a
> milestone.

> ⚠️ **An exemption that is disabled by the condition it detects is worse than
> no rule.** SEC-01 previously carried `exempt_line=r"unsafe-eval"`, rationalised
> as sparing a local-dev branch that did not exist. Because the repo has exactly
> one `script-src` — the production one — that exemption swallowed the only line
> the rule guarded, and *adding* `'unsafe-eval'` is what silenced the
> `'unsafe-inline'` beside it. The guard reported "0 violations" against a CSP
> with both. When adding an exemption, first prove the rule still fails without
> it. **Corrected 2026-09-02:** this sentence used to say every rule in the
> table has a negative test; no test file for the gates existed until
> viability program chunk 4 added `scripts/tests/` (run with
> `npm run test:gates`). SEC-03 has one; add one for every rule you touch.

**Accessibility rules (A11Y-01…06)** live in `scripts/a11y_check.py` and run in
`.github/workflows/quality.yml`, blocking since 2026-09-14 (0 findings) — see
`documentation/security/compliance/ACCESSIBILITY.md`.

### 9.1 Security Invariants (historical — superseded by §9.0)

1. **Supabase `anon` role has ZERO table access** — no table grants, no RLS policies granting it anything (both re-verified live 2026-09-19). Function `EXECUTE` is the exception, see item 5.
2. **Default privileges locked** — `ALTER DEFAULT PRIVILEGES` prevents future tables from auto-granting to `anon`.
3. **All 3 apps use `service_role` or direct PG** — `cf-admin` and `cf-chatbot` use `SUPABASE_SERVICE_ROLE_KEY`; `cf-astro` uses `DATABASE_URL` via Drizzle.
4. **Fail-secure dev detection** — `isLocalDev()` returns `false` unless `SITE_URL` explicitly contains a local dev domain.
5. **4 of 6 functions hardened** — `search_path` pinned on all six; `EXECUTE` revoked from `anon`, `authenticated` and `PUBLIC` on `get_command_center_analytics`, `get_kb_clusters`, `get_usage_metrics` and `rls_auto_enable`.
   > *Corrected 2026-09-19.* This line read "6 functions hardened — EXECUTE
   > revoked … on all public schema functions", and this file is published to
   > the public docs mirror. A live `has_function_privilege` read on
   > 2026-09-19 shows `increment_conversation_metrics` and
   > `purge_expired_privacy_data` still `EXECUTE = true` for `anon`,
   > `authenticated` and `PUBLIC`. Both are `SECURITY INVOKER` and `anon` holds
   > no table grants, so the gap is not exploitable on its own — but a control
   > we claim and do not have is the worst kind of documentation. Fix forward
   > (`REVOKE EXECUTE … FROM anon, authenticated, PUBLIC` on both) or keep this
   > correction. The same sentence appears in `security/SECURITY.md`,
   > `security/THREAT-MODEL.md` and `security/RoPA.md`.

→ See [SECURITY.md](./documentation/security/SECURITY.md) for the full security architecture, CSRF, cookie policy, RLS matrix, defense-in-depth, and Ghost Protection.
→ See [ASVS-L2.md](./documentation/security/compliance/ASVS-L2.md) for the full OWASP ASVS v4.0.3 Level 2 verification matrix.

---

## 10. DESIGN SYSTEM — "MIDNIGHT SLATE"

The dashboard uses a unified premium dark UI with Blue-500 primary accents, 5-level surface elevation, OKLCH color tokens, and component-scoped CSS. Both dark and light themes are fully supported.

→ See [DESIGN-SYSTEM.md](./documentation/reference/DESIGN-SYSTEM.md) for design tokens, login portal spec, sidebar mechanics, component patterns, animation, accessibility, and responsive layout.

---

## 11. DYNAMIC CMS & ISR ARCHITECTURE (cf-admin ↔ cf-astro)

cf-admin securely mutates content for cf-astro via a 2-tier KV injection pipeline. All revalidation goes through `revalidateAstro(env, basePaths, cmsData?, maxRetries?)` in `src/lib/cms/revalidate.ts`: up to 3 attempts with a **linear** backoff (`attempt * 300` ms) and a 5 s timeout, then a `SYNC_QUEUE` outbox redrive. *Corrected 2026-09-19: this said "3× exponential backoff" and omitted the 4th parameter and the outbox.*

→ See [CMS.md](./documentation/features/CMS.md) for the full ISR architecture, KV injection strategy, upload flow, and configuration constraints.

---

## 12. DEPLOYMENT RULES

### Build & Deploy

```bash
# Development
npm run dev              # Astro dev server on workerd: `dotenv -e .dev.vars -- astro dev
                         #   --force`, behind scripts/predev-guard.mjs. NOT wrangler dev.
npm run cf:dev           # `wrangler dev` — full CF runtime with R2 simulation (image uploads)

# Type & Dependency Check
npm run typecheck        # astro check — TypeScript validation
npm run lint             # ESLint
npm run knip             # Dead-code sweep, run through `npx --yes knip` (the
                         # package is not a devDependency; chunk 4's proposal
                         # still awaits owner approval). knip.json has carried
                         # `entry` config since chunk 4, so pages are no longer
                         # false positives. Not in `verify` — read its output
                         # rather than quoting a past run's figures. It joins
                         # `verify` the day it is clean.
                         # Dead files and uncalled routes have their own pinned
                         # counts: `python scripts/ratchet.py --list A17` (files
                         # nothing imports), `--list A18` (routes nothing calls),
                         # `--list A19` (catches that report nowhere).

# The full gate — run this before any commit (see "Git & deployment protocol")
npm run verify           # typecheck → ratchet → test:run → test:gates → rules_check
                         #   → docs_check → lint:md → a11y_check → audit_gate (all blocking).
                         # package.json owns this chain. `types:check` is NOT in it.
                         # ESLint *is* gated: scripts/ratchet.py runs `eslint . -f json`
                         # and exits 2 on any error, so `npm run lint` is only a
                         # faster way to see the same failures.

# Release (viability program chunk 3 — documentation/runbooks/release-and-rollback.md)
npm run release          # preflight → verify → build → drift check → MIGRATE
                         #   → wrangler deploy → smoke → tag   (local; cf:deploy is an alias)
npm run build:ci         # the build command Workers Builds is MEANT to run
npm run deploy:ci        # the deploy command Workers Builds is MEANT to run
                         #   (migrate → deploy → smoke). See the correction below:
                         #   neither is configured in the dashboard today.
```

### Git & deployment protocol

This is the authoritative statement of the deploy protocol for this repo. It
absorbs the rules previously kept in a monorepo-root git-rules file, which is
not part of this repository and is no longer referenced anywhere — the repo is
now standalone, so a pointer outside it can never resolve.

- **Verify the working directory before every push** — `git remote -v` must show
  this repo. Pushing cf-admin changes from a sibling checkout is the single
  easiest way to deploy the wrong Worker.
- **Push directly to `origin main`.** There is no pull-request gate and no branch
  protection; `main` auto-deploys **through Cloudflare Workers Builds** (the
  dashboard-side GitHub connection — no workflow in `.github/` runs
  `wrangler deploy`). The quality/security workflows run on the same push and
  do **not** gate that deploy. (An agent working on an assigned feature branch
  follows its own instructions and pushes there instead.)
- 🔴 **Nothing gates the deploy today — corrected 2026-09-19.** This section
  said the gate was the Builds **build command** running `npm run build:ci` and
  the **deploy command** running `npm run deploy:ci`. Workers Builds is still
  on its **default** command: it does not run `verify` and does not apply
  migrations. Evidence: migrations `0054`/`0055` were applied to production at
  13:05:09 and 13:06:50 UTC on 2026-09-16, before the commit that added them
  was authored at 13:08:06; commit-to-deploy measures 78–110 s against the
  ~4–6 min `verify` takes; and `.github/workflows/quality.yml` still states in
  its own header that its jobs do not gate the deploy. Consequences to plan
  around: the schema-drift check, migrate-before-deploy and the blocking budget
  test are **inert in production**, and a doc that trips the 45-day staleness
  gate reddens local `verify` and the `Docs Quality` workflow only. Switching
  the dashboard commands to `npm run build:ci` / `npm run deploy:ci`
  (`scripts/release.mjs`, viability program chunk 3) is the fix, per
  [`documentation/runbooks/release-and-rollback.md`](./documentation/runbooks/release-and-rollback.md)
  §3 — until an operator does it, read every claim of an automated gate in this
  repo as aspirational. Compliance docs record this as a machine approval
  rather than a second pair of human eyes — see
  [`documentation/security/compliance/SOC2-TSC-mapping.md`](./documentation/security/compliance/SOC2-TSC-mapping.md)
  CC8.1, which needs the same correction.
- **Run `npm run verify` before every push.** With the default Builds command in
  place, that local run is the only gate there is. When the push carries a
  migration, releasing it deliberately from a workstation (`npm run release`)
  is what applies it — the push will not.

#### §6 — Binding IDs are never invented

[`documentation/operations/OPERATIONS.md`](./documentation/operations/OPERATIONS.md)
§1 is the **single source of truth for production bindings** (D1/KV/R2 IDs, queue
names, service bindings). Never hand-edit or guess a binding UUID: a wrong ID
**fails silently** rather than erroring, and did cause a real CMS outage in April
2026. Read the value from `wrangler.toml` or the Cloudflare dashboard, and update
the registry in the same change. Docs elsewhere cite this rule as "§6".

### Environment

- `wrangler.toml` — Cloudflare bindings (D1, KV, R2, Queues)
- `.dev.vars` — Local secrets (gitignored) — **never set `PUBLIC_ASTRO_URL` here** (causes CMS revalidation loop)
- `wrangler secret put <KEY>` — Production secrets

→ See [OPERATIONS.md](./documentation/operations/OPERATIONS.md) for binding IDs, secrets checklist, and deploy verification steps.

---

## 13. DOCUMENTATION ARCHITECTURE

| File | Purpose |
|------|---------|
| `RULESAd.md` | This file — operational rules and quick-reference pointers |
| `README.md` | Quick start guide for developers |
| `main.md` | AI entry pointer into `documentation/` |
| `AI_CODE_MAINTENANCE.md` | AI agent maintenance guidelines |
| `documentation/` | All detailed technical documentation (governed tree — see [`documentation/README.md`](./documentation/README.md)) |

> **Single source of truth for the doc map:** [`documentation/README.md`](./documentation/README.md)
> is the authoritative, always-current index (CI enforces index ↔ filesystem
> parity). Naming and front-matter rules live in
> [`documentation/CONTRIBUTING-DOCS.md`](./documentation/CONTRIBUTING-DOCS.md).

### Documentation Folder Structure

The folder map is owned by
[`documentation/CONTRIBUTING-DOCS.md`](./documentation/CONTRIBUTING-DOCS.md) §2,
and the file-by-file index by
[`documentation/README.md`](./documentation/README.md).

> *Corrected 2026-09-19.* A copy of the tree lived here and had gone stale in
> both directions — it omitted `commercial/`, `program/`, `records/` and
> `security/compliance/`, and named 6 of the 15 feature docs. Two trees is one
> too many; the copy is gone.

---

## 14. VERIFYING CLAIMS AGAINST LIVE INFRASTRUCTURE

Connectors vary by agent and by session, so this file does not keep a roster of
them — one went stale here for months, naming skills that are not installed and
a `RULES.md` that does not exist.

The rule that does not change: **verify an infrastructure claim against the
live estate before writing it into a document.** Read-only calls against
Cloudflare (bindings, D1), Supabase (schema, advisors), Sentry and PostHog are
cheap; a figure copied from another document is how every count in this repo
drifted. Cite the command or `file:line` you used, so the next reader can
re-run it instead of trusting you. Prefer whatever is free and already
connected; anything metered is a last resort, after the free paths are
exhausted.

---

## 15. DIRECT INFRASTRUCTURE SPEND — ~$0.50/month

> **This is direct spend on this one deployment, not cost-to-serve.** The two
> were being quoted interchangeably: this section said "$0.00" while
> `OPERATIONS.md` §8 said "~$0.50" and the commercial analysis gives a fully
> loaded per-client figure many times either. All were "right" about different
> things, which made every one of them misleading on its own.
>
> - **Direct spend (this table):** what leaves the bank account today, with
>   everything on a free tier.
> - **Cost-to-serve (the number for any commercial conversation):**
>   [`documentation/commercial/analyses/2026-07-26-commercial-model-costing-pricing-and-scale.md`](./documentation/commercial/analyses/2026-07-26-commercial-model-costing-pricing-and-scale.md)
>   owns it, including the paid tiers a real client deployment needs and the
>   share of it that is operational time. **Never quote this table to a
>   client.**
>
> *Corrected 2026-09-19: the per-client cost and the operations-share
> percentage used to be spelled out here. This file is copied verbatim to the
> public docs mirror, and `commercial/` is not — a negotiating position does
> not belong in the one file that is published.*

| Service | What We Use | Monthly Cost |
|---------|------------|-------------|
| Cloudflare Workers | Hosting + SSR | **$0** |
| Cloudflare KV | Session storage & ISR Cache | **$0** |
| Cloudflare D1 | Operational data & CMS content | **$0** |
| Cloudflare R2 | CMS image storage (10GB free) | **$0** |
| Cloudflare Queues | Async email delivery | **$0** |
| Supabase | PostgreSQL (shared) — no GoTrue auth, see §1 | **$0** |
| Upstash | Redis (rate limiting) | **$0** |
| Cloudflare Workers AI | Blog generation + RAG | **$0** (free tier) |
| GitHub | Source control | **$0** |
| Anthropic (Claude Haiku fallback) | Chatbot fallback only | ~$0.01–0.50 |
| | **TOTAL, direct spend** | **~$0.50** |

### Only Paid Services

| Service | Cost | Note |
|---------|------|------|
| Domain name | ~$10-15/year | One-time, shared with cf-astro |
| Anthropic (Claude Haiku fallback) | ~$0.01-0.50/month | Chatbot fallback only |
| Perplexity MCP | Per-query | Minimize usage |

---

## 17. ASYNC EMAIL QUEUES & AUDIT ARCHITECTURE

Both `cf-admin` and `cf-astro` utilize a decoupled Cloudflare Queues architecture to dispatch emails asynchronously.

- **Queue Binding:** `EMAIL_QUEUE` (mapped to `madagascar-emails`)
- **Producer:** API Routes push a JSON payload with a unique `trackingId` to the queue and respond immediately.
- **Consumer:** A standalone Cloudflare Worker — deployed as **`cf-astro-email-consumer`**, from the sibling directory `cf-email-consumer/` — consumes the queue batches, renders HTML from **template-literal functions** in `cf-email-consumer/src/templates.ts`, and calls the provider REST API out of band of the user request. Bloated Node.js SDKs (like `resend` and React Email) are strictly forbidden in the consumer worker. *Corrected 2026-09-19: this named the Worker `cf-email-consumer` (that is the folder, not the deployed name — `wrangler.toml` line 253 here already says "Consumed by cf-astro-email-consumer") and credited templating to **Eta**, which the consumer does not depend on.*
- **Providers — Brevo primary, Resend failover.** Re-derived from code 2026-09-19:
  - `cf-admin` sends **directly via Brevo** (`https://api.brevo.com/v3/smtp/email`) — security alerts, retention notices, storage notifications, GSC ops alerts — **with one exception**: `src/pages/api/users/resend-invite.ts` POSTs to `https://api.resend.com/emails` with `RESEND_API_KEY`. *Corrected 2026-09-19: this bullet said there is "no `api.resend.com` call anywhere in `cf-admin/src/`". There has been one since 2026-07-20; retiring `RESEND_API_KEY` on the strength of the old sentence would have broken admin invite re-sends. `documentation/MAINTENANCE.md` repeats the old claim.*
  - The queue consumer calls Brevo first and falls back to `https://api.resend.com/emails`.
  - The `resend_id` column and `resend_*` field names in `email_audit_logs` are **legacy names retained for schema stability**, not evidence of an active Resend path. Do not infer the provider from a column name.
  > Four documents previously gave four different answers here (Resend-only, split-by-role, Brevo-primary-with-failover, and Brevo-only). This bullet is the reconciled version; if it disagrees with another doc, this one was re-derived from code.
- **Audit Logs:** All email payloads, transmission statuses, and provider webhook delivery events are chronologically mapped in the Supabase PostgreSQL table `email_audit_logs`. This table relies exclusively on `service_role` edge requests and has Row Level Security (RLS) entirely locking out public access.
  - **Referential Integrity:** The `booking_id` foreign key constraint enforces `ON DELETE CASCADE`, ensuring that atomic "Hard Wipes" of bookings cleanly and automatically purge associated audit records without referential blocking errors.

> 📎 **Full detailed documentation and Webhook setup guide:** See [`../cf-email-consumer/README.md`](../cf-email-consumer/README.md).

---

*End of Rules. These constraints must be acknowledged and followed for every task in cf-admin.*

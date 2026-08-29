{% raw %}
# CF-ASTRO PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Last Updated:** 2026-07-06

## 🏢 PROJECT MISSION — COMMERCIAL-GRADE, $0 INFRASTRUCTURE

**cf-astro is a production-ready, commercial-grade pet hotel website built entirely on FREE tier services.** This is a real business application designed to:

- Handle real customer bookings with email confirmations
- Run 24/7 at **$0/month** total infrastructure cost
- Deliver Lighthouse 95+ performance on mobile
- Meet professional SEO, accessibility, and security standards

Every architectural decision optimizes for one goal: maximum professional quality at exactly ZERO ongoing cost. We combine Cloudflare's free tier (Workers, D1, R2, KV, Pages) with Brevo (+ Resend failover), Supabase, Upstash, PostHog, and Sentry free tiers.

---

## 🚨 RULE #0 — THE ABSOLUTE LAW (NEVER VIOLATE)

**cf-astro is the Cloudflare-native version of nextjs-app. WE NEVER, like NEVER, copy any single file or code from there.**

- ✅ **ALLOWED:** Reference nextjs-app to understand features, flows, UX patterns, business logic concepts
- ✅ **ALLOWED:** Build equivalent functionality from scratch using Cloudflare-optimized patterns
- ❌ **FORBIDDEN:** Copy-pasting any file, component, function, hook, schema, or code block from nextjs-app
- ❌ **FORBIDDEN:** Duplicating CSS, translations, or configuration verbatim from nextjs-app
- ❌ **FORBIDDEN:** Using nextjs-app files as templates with "find and replace" modifications

**Every line of code in cf-astro must be written fresh, optimized for the Cloudflare + Astro + Preact stack.**

---

## 🎯 RULE #0.5 — REAL DATA ONLY

**Never build mock data, `Math.random()` features, or placeholder UI pages.** All data presented in the UI must be real and sourced from active endpoints/databases.

- ❌ **FORBIDDEN:** Fake or randomized stats, placeholder testimonials, mock booking data, or any UI page whose content isn't backed by a real endpoint or database record.
- ✅ **ALLOWED:** Loading states, skeletons, and empty states while real data loads — as long as the final rendered content is real.

---

## 🛡️ RULE #0.6 — REUSE BEFORE CREATION (D1/Supabase/KV/services)

**Before creating a new D1 table, a new Supabase table, a new KV namespace, or integrating a new external service, three questions must be answered, in order.** This applies with extra force here because `madagascar-db` (D1) and the Supabase project are **shared with cf-admin** — a table added carelessly from this repo is exactly as much clutter as one added from cf-admin's.

1. **Does something that already exists cover this?** Check `cf-admin/documentation/reference/coding-standards.md` §8 (the config-table reuse rule — `admin_portal_settings` is the general-purpose config store both projects should prefer) and `cf-admin/documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md` (the live table inventory for the shared databases — re-verify it live, it drifts). A 2026-08-06 audit already found three never-consolidated config mechanisms and two confirmed-dead Supabase tables in this shared infrastructure, purely from not checking first.
2. **If nothing existing fits, does a free, open-source, or already-integrated service solve this better than bespoke infrastructure?** Active connectors exist for Cloudflare, Supabase, Sentry, and PostHog — evaluate honestly per-case rather than defaulting either direction (see the audit doc §4 for three worked examples).
3. **If new infrastructure is genuinely the right call, say why in one line in the PR/commit.**

- ❌ **FORBIDDEN:** Creating a new table/namespace/service integration in the shared D1/Supabase infrastructure without first checking for an existing one that already fits.

---

## 🗄️ RULE #0.7 — A SCHEMA CHANGE IS THREE ARTEFACTS, NOT ONE

**A migration file in this repo is NOT evidence that the migration was applied. The database's own ledger is.**

On 2026-08-07 a column was added to `src/lib/db/schema.ts`, a migration was hand-written for it, and it was never journalled and never applied. CI was green. The deploy succeeded. Every consent write then failed in production with Postgres `42703` for ~7h45m (2026-08-07 18:33 UTC → 2026-08-08 02:20 UTC), silently discarding legal consent evidence, and no alert fired. See `Documentation/INCIDENT-2026-08-07-CONSENT-OUTAGE.md`.

A schema change is complete only when **all three** exist:

1. The change in `src/lib/db/schema.ts` (Postgres) or the D1 DDL.
2. A migration **generated**, never hand-written — `npm run db:generate` — committed together with its `drizzle/meta/NNNN_snapshot.json` **and** its `drizzle/meta/_journal.json` entry.
3. The migration **applied**, and confirmed present in `supabase_migrations.schema_migrations` (Postgres) or `d1_migrations` (D1).

- ❌ **FORBIDDEN:** Hand-writing any `.sql` file into `drizzle/`. Without the paired snapshot and journal entry Drizzle cannot see it, and neither can the drift guard.
- ❌ **FORBIDDEN:** Committing a `src/lib/db/schema.ts` change without running `npm run db:check`.
- ❌ **FORBIDDEN:** Treating a merged PR as "the migration is live". Nothing in CI or the deploy path applies migrations — application is a manual step that must be verified against the ledger.

**Enforcement:** `npm run db:check` guards artefacts 1-2 in CI with no database access. `GET /api/health/?probe=consent` guards artefact 3 against production hourly, by performing a real rolled-back INSERT. Both are required; neither is sufficient alone.

- ✅ **ALLOWED, and expected:** Creating new infrastructure when the check comes back negative.

---

## 🧮 RULE #0.8 — ENV VAR CAP & DYNAMIC CONFIG FIRST (HARD STOP, WE ARE NOT ADDING MORE)

**cf-astro's own Pages/Worker deployment carries ~21 env vars** (7 `[vars]` + ~14 secrets — recounted 2026-08-28 against `wrangler.toml` and `env.d.ts`, reconciling this with `main.md`, which had said ~21 while this file said ~22; the `[vars]` count of 7 is exact, but the secret count is approximate because `wrangler.toml`'s comment registry, `env.d.ts`, and the auto-generated `worker-configuration.d.ts` don't fully agree with each other — `worker-configuration.d.ts` in particular still lists `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, which were removed 2026-08-08; treat `env.d.ts` + `wrangler.toml`'s hand-maintained comment blocks as the live source, not that file). **This is a hard cap, not a soft target.**

- ❌ **FORBIDDEN:** Introducing new environment variables for feature toggles, limits, or operational settings.
- ✅ **REQUIRED INSTEAD:** Use D1 (`admin_portal_settings`, owned by cf-admin but shared) or the site-settings pattern already in use.
- A new env var is the **last option on the table, not the first.**

---

## 🗂️ RULE #0.9 — MIGRATION-MINIMAL DATA DESIGN & SCHEMA REUSE (HARD STOP, WE ARE NOT ADDING MORE)

**Do NOT create new D1/Supabase tables when an existing one can fulfill the requirement** — of the 51 tables shared with cf-admin (31 D1 + 20 Supabase `public`, verified live 2026-08-28) (see RULE #0.6 above), or **64** counting cf-chatbot's separate `chatbot-kb`/`whatsapp-chatbot` D1 databases across the full three-app estate.

- ❌ **FORBIDDEN:** Writing a new-table migration without first proving why existing infrastructure can't house the data model. A new table is the **last option on the table, not the first.**
- See `cf-admin/main.md` RULE #0.9 and the `Shared Data Audit` (`cf-admin/documentation/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`) for the full breakdown — this is the same estate, not a separate one, since both apps write to the same `madagascar-db` and the same Supabase project.

---

## 1. PROJECT IDENTITY

| Property           | Value                                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**      | Astro 7.1+ with `@astrojs/cloudflare` adapter                                                                                                                                                                                |
| **UI Islands**     | Preact (3KB, React-compatible) for interactive components                                                                                                                                                                    |
| **Hosting**        | Cloudflare Pages (unlimited bandwidth, free)                                                                                                                                                                                 |
| **Database**       | Cloudflare D1 (SQLite) + Supabase PostgreSQL (Direct connection 5432)                                                                                                                                                        |
| **Cache**          | Cloudflare KV + Upstash Redis                                                                                                                                                                                                |
| **Storage**        | Cloudflare R2 (images/assets) + Supabase Storage (private/auth-gated)                                                                                                                                                        |
| **Email**          | Async via Cloudflare Queue → shared `cf-astro-email-consumer` worker. Brevo is primary for every send (cf-astro and cf-admin alike); Resend is an automatic same-request failover if Brevo throws — not a per-project split. |
| **Bot Protection** | Cloudflare Turnstile (free, unlimited challenges)                                                                                                                                                                            |
| **Analytics**      | PostHog (reverse-proxied) + Cloudflare Web Analytics + Analytics Engine                                                                                                                                                      |
| **Error Tracking** | Sentry (`@sentry/browser` + `@sentry/cloudflare` distributed tracing)                                                                                                                                                        |
| **Logging**        | BetterStack (`@logtail/edge`, server-side structured logging)                                                                                                                                                                |
| **i18n**           | Astro built-in (es/en with prefix routing)                                                                                                                                                                                   |
| **CSS**            | Tailwind CSS **v4** via `@tailwindcss/vite` Vite plugin                                                                                                                                                                      |

---

## 2. ARCHITECTURAL PATTERNS

- **Edge-First**: The application is designed to execute as close to the user as possible using Cloudflare Workers.
- **Failover / Resiliency**: We use D1 as a dead-letter/audit queue for bookings. If Supabase fails, data is retained in D1 for delayed execution.
- **Islands Architecture**: We limit client-side JS by utilizing Astro islands with Preact only where interactivity is required.
- **Hybrid-SMTP Async Email**: All email dispatch (from both cf-astro and cf-admin) is non-blocking via one shared Cloudflare Queue (`madagascar-emails`) consumed by one shared worker, `cf-astro-email-consumer`. **Brevo is the primary provider for every send regardless of `projectSource`**; **Resend is wired in only as an automatic same-request failover** if the Brevo call throws — there is no per-project routing split.

> For historical constraints and deprecated patterns, see `Documentation/ARCHIVE-RULES-HISTORY.md`.

{% endraw %}

---
title: "cf-backend — Plan of Record (overview and decisions)"
status: draft
audience: [owner, ai, technical, operator]
owner: harshil
related_docs: [01-architecture.md, 02-admin-integration-contract.md, 03-backup-pipeline.md, 04-staff-storage-move.md, 05-security-and-compliance.md, 06-roadmap.md, ../adr/ADR-0001-program-constraints.md]
tags: [program, cf-backend, backups, storage, architecture, plan]
---

# cf-backend — Plan of Record

> **Status: draft for owner review (2026-09-21).** Nothing here is built. Every
> decision below is a **default** that can be reversed at review. Facts marked
> *measured* were checked against live infrastructure on 2026-09-21. Facts marked
> *to verify* are open questions for Phase 0/1.
>
> **Revised the same day after a deep review** ([07-factor-register.md](07-factor-register.md)):
> OD-1 flipped to two Workers; OD-11 to OD-13 added; the Supabase dump method, the
> `chatbot-kb` export path and the restore drill image all changed because of
> confirmed vendor limits.
>
> **Revised again: processes adopted from the existing workflow** ([08](08-existing-backup-workflow.md) →
> [03 §10](03-backup-pipeline.md#10-operating-principles-adopted-from-the-existing-workflow)):
> 22 operating principles (P-1…P-22), OD-14 (readiness panel) and OD-15 (tiered drills) added.
>
> **Revised a third time: key management** ([09](09-key-management.md)): two-provider custody, where backups sit at Cloudflare and the key in Supabase Vault, with Owner/Vendor-only access and one-click rotation. OD-13 revised; OD-16 (`age`) and OD-17 (GitHub App) added.
>
> **Free-tier audit** ([10](10-free-tier-feasibility.md)): everything fits; Actions minutes are the binding limit (one job per run); run folders split into `full/` and `daily/` with their own lock periods (OD-5).

## What cf-backend is, in one paragraph

`cf-backend` is a new private repository and a new Cloudflare Worker. It becomes the
**operations plane** of the platform: it holds the sensitive machinery (database backups,
staff file storage, signing keys, GitHub automation) that cf-admin currently carries or
lacks. There is **no admin login and no admin HTTP API**. Its management surface is a
typed RPC entrypoint that **only cf-admin can call**, through a Cloudflare service binding.
The one thing the internet can reach is a deliberately narrow public surface on
`storage.madagascarhotelags.com`, serving share-link downloads and file-request uploads
for external vendors. Heavy work that a 10 ms Worker cannot do (`pg_dump`) runs on
**GitHub Actions in the cf-backend repo**, and only cf-backend can dispatch it. cf-admin
remains the only place a human operates anything. It renders cf-backend's capabilities
from a versioned manifest, so a new backend job appears in the dashboard without a
cf-admin release.

## Reading order

| # | Document | Answers |
|---|---|---|
| 1 | [01-architecture.md](01-architecture.md) | What runs where, trust boundaries, bindings, what moves out of cf-admin |
| 2 | [02-admin-integration-contract.md](02-admin-integration-contract.md) | How cf-admin "loads" cf-backend without ever breaking: manifest, RPC, versioning, permissions, cron page changes |
| 3 | [03-backup-pipeline.md](03-backup-pipeline.md) | The weekly full-architecture backup: scope, R2 layout, encryption, verification, run ledger, alerts |
| 4 | [04-staff-storage-move.md](04-staff-storage-move.md) | Moving Staff Managed Storage to cf-backend and `storage.*` without breaking a single live link |
| 5 | [05-security-and-compliance.md](05-security-and-compliance.md) | Threat model, secrets inventory, GitHub Free limits, OIDC, LFPDPPP/RoPA updates |
| 6 | [06-roadmap.md](06-roadmap.md) | Phases → stages → tasks, exit criteria, owner steps, rollback per phase |
| 7 | [07-factor-register.md](07-factor-register.md) | The deep review: 40 factors (limits, backup correctness, integration, security, recovery time), each confirmed / to verify / design, and where it changed the plan |
| 8 | [08-existing-backup-workflow.md](08-existing-backup-workflow.md) | **Start here if you only read one thing about backups today:** the existing cf-admin `backups.yml`, job by job; why it has never produced a backup; its 14 gaps; the 15-minute path to a first real backup this week |
| 9 | [09-key-management.md](09-key-management.md) | How the backup key works: stored in Supabase Vault, away from the Cloudflare-stored backups; Owner/Vendor only; generate a new one on the spot; weekly automatic key check; recovery kit; the what-if table; compliance text to add once built |
| 10 | [10-free-tier-feasibility.md](10-free-tier-feasibility.md) | **Is all of it free?** Yes: a per-service verdict, the GitHub Actions budget against the under-1,000-minute target, years of old backups in R2, key rotation and re-keying old backups at $0, six Phase 0 checks, and tripwires |

## Verdict on the original idea

The idea is sound, and most of it survives. This table records what was kept, changed or dropped, and why.

| Original proposal | Verdict | Why |
|---|---|---|
| Backups in R2, weekly, via a scheduled job | **Keep** | R2 free tier is 10 GB-month. The measured payload is ~5 MB per run, so decades of weekly runs fit |
| Do the dump on Vercel (Hobby) | **Drop** | Vercel Hobby is for personal, non-commercial use, and this is a commercial business. It would also add a fourth platform and a fourth secret store. GitHub Actions gives a full VM with native `pg_dump`, and a working `backups.yml` already exists in cf-admin |
| Do the dump in a Worker | **Drop for Postgres, partial for D1** | Workers Free allows **10 ms CPU per invocation** (*measured*: CF docs). I/O wait does not count, so *streaming* a D1 export into R2 would fit, but gzip/encryption in-Worker would not. `pg_dump` cannot run in a Worker at all |
| GitHub Actions as the runner | **Keep, moved to the cf-backend repo** | 2,000 free minutes/month on a private repo; a run is ~2–4 min. The existing cf-admin `backups.yml` (D1 export, restore drills, GPG) is the starting point, not a rewrite |
| A new D1 table `backup_logs` | **Replace** | RULE #0.9 caps tables. Instead, the run ledger lives in R2 as immutable `manifest.json` files, the current status is one `admin_portal_settings` row, triggers go to `admin_audit_log`, and metrics go to Analytics Engine. **0 new tables, 0 new KV namespaces** |
| GitHub Copilot CLI "AI audit" of logs | **Drop from the backup path** | It needs a paid Copilot seat, gives non-deterministic verdicts in a disaster-recovery record, and sends logs to a third party. It is replaced by **deterministic checks**: restore drill, row-count diff, schema fingerprint diff and size-anomaly rules. An optional Workers AI summary of the PII-free manifest can come later (Phase 5) |
| Write the result row with raw SQL via the D1 REST API | **Drop** | The draft interpolated values into SQL (injection-prone) and needed a D1-write token in GitHub. Instead, cf-backend *pulls* the manifest from R2, so GitHub never writes to D1 |
| Email via Resend directly from the workflow | **Replace** | Reuse the existing `madagascar-emails` queue → `cf-astro-email-consumer` (Brevo primary). cf-backend enqueues; no mail key lives in GitHub |
| GPG symmetric passphrase | **Upgrade** | Use **public-key** encryption. The runner holds only the *public* key and the private key is held in Supabase Vault, away from the Cloudflare-stored backups (doc 09), so a leaked GitHub secret cannot decrypt any backup |
| Lifecycle rule auto-deleting after 60–90 days | **Replace** | The owner rule is "retention is fully manual" (ADR-0001). Use an **R2 bucket lock** instead, so nothing can delete a backup early, not even a leaked token. Pruning is an owner-only, audited action in cf-admin |
| Daily cron for better RPO | **Adopt for Supabase only** | D1 already has 7-day Time Travel (point-in-time) on Free; Supabase Free has **no** backups or PITR. So: weekly full backup of everything, plus a daily Supabase-only dump (~45 min/month of Actions) |
| `cf-backend` UI "synced" into cf-admin | **Keep, as server-driven UI with a closed vocabulary** | cf-backend describes capabilities and views; cf-admin renders them with its own components. No remote JavaScript is ever loaded into the admin origin. See doc 02 |
| Storage on `storage.madagascarhotelags.com` | **Keep** | A separate *Worker* owning its own hostname avoids the route contention that retired `share.madagascarhotelags.com` on 2026-08-06 (that was two hostnames on *one* Worker). It also lets `secure.*` drop its Access bypass for `/api/storage/*` |

Defects in the draft workflow worth knowing, because they would have shipped:

- `--exclude "raw.sql"` does not match `supabase_raw.sql`, so the unencrypted raw dump would have been uploaded.
- It computed "free tier remaining" from *dump* size. D1 and Postgres limits apply to database size, not dump size.
- It listed the whole bucket every run (Class A operations) to compute usage.
- It interpolated `${{ }}` values into shell and SQL, the classic GitHub Actions script-injection shape.

## Owner decisions (defaults — reverse any at review)

| ID | Decision | Default | Alternative |
|---|---|---|---|
| OD-1 | Name and shape | **Revised:** one repo `cf-backend`, **two Workers**. `cf-backend` is private: RPC only, no routes, and holds the GitHub token, backups and management. `cf-backend-edge` is public on `storage.*` and holds only what serving links needs (factor D1) | One Worker with both surfaces: one deploy fewer, but the internet-facing code shares an isolate with the most sensitive credentials |
| OD-2 | Backup bucket | **New dedicated bucket `madagascar-backups`**, so credentials can be scoped to it alone | A `system/backups/` prefix inside `madagascar-staff-storage`: one bucket fewer, but any storage token could then reach the backups |
| OD-3 | Cadence | Weekly full backup (Sun 09:17 UTC = 03:17 Aguascalientes) **plus** daily Supabase-only dump | Weekly only (as originally asked): RPO for Supabase becomes 7 days |
| OD-4 | Encryption | Public-key encryption: the runner holds only public keys, and private keys are held in Supabase Vault, a different provider from the backups (full design in [09-key-management.md](09-key-management.md)) | Symmetric passphrase (existing workflow): simpler, but the runner can decrypt |
| OD-5 | Early-deletion guard | R2 bucket locks: `v1/runs/full/` 90 days, `v1/runs/daily/` 30 days, so the suggested prune schedule stays possible ([10](10-free-tier-feasibility.md) §3) | No lock: a leaked writer token could wipe history |
| OD-6 | "Non-triggerable" | The backup is **never** run by the `*/5` Workers tick and uses **no** Cloudflare cron trigger. The GitHub schedule owns it. cf-admin can Enable/Disable it, and **Run now is owner-only** with a 6 h cooldown and typed confirmation | Fully schedule-only: no Run now at all |
| OD-7 | Completion signal | **Pull**: the workflow writes a manifest to R2; a daily cf-admin job asks cf-backend to reconcile. No inbound webhook exists | Push: a GitHub OIDC-verified callback on the public host (faster status, but one more public route) |
| OD-8 | UI model | Server-driven UI: cf-backend's manifest composes cf-admin-owned primitives | Keep hand-built pages in cf-admin per feature (more work, no auto-sync) |
| OD-9 | Storage tables | Stay in `madagascar-db`; ownership moves to cf-backend (no data migration) | A separate D1 for storage: cleaner, but adds a database and a migration |
| OD-10 | Deploy gate | Workers Builds for cf-backend runs `npm run verify` **from day one** (the step cf-admin never completed) | Default build command (not recommended) |
| OD-11 | Migrations for tables cf-backend owns | Stay authored in **cf-admin `migrations/`** (the `0033`+ band); cf-backend never runs `d1 migrations apply` (factor C6) | Give cf-backend its own number band: a third ledger writer, more RULE #0.7b risk |
| OD-12 | Second provider | Every encrypted run is also a **GitHub artifact, 14-day retention**, so losing the Cloudflare account does not lose every copy (factor B8) | R2 only: simpler, but a single provider holds production and backups |
| OD-13 | Key custody | **Two-provider custody (doc 09):** private keys in **Supabase Vault**, backups in Cloudflare R2; only **Owner and Vendor support** can rotate (one click, on the spot), reveal or download, with a fresh sign-in, audit and an email to both; one offline **recovery kit** each, for the case where Supabase itself is lost | Offline-only keys with paper Shamir shares (the earlier draft): the key never touches an online system, but ceremonies and manual proofs are a lot to operate |
| OD-14 | Readiness visibility | The GitHub App also gets **Secrets: read** so cf-admin's readiness panel lists secret *names and dates* (never values), token and key expiry, and last-success age. This is the failure mode that left the existing workflow silently broken for six days (03 §10 P-14) | A `doctor` job only: problems surface on the next run, not before it |
| OD-15 | Drill tiers | Every run drills locally (`sqlite3`, `supabase/postgres`); **monthly** a real-path drill into a temporary D1 (ADR-0001), with its own D1 Edit token; **twice a year** a human decrypt-and-restore rehearsal (03 §10 P-13) | A real D1 drill every week, as chunk 6 does: the most realistic option, but a D1 Edit token on every run |
| OD-16 | Encryption tool | **`age`** instead of GPG: small X25519 keys that Workers can generate natively (`node:crypto`), multiple recipients if ever needed, fewer footguns | GPG: already on the runner, but heavier keys and more ways to misconfigure |
| OD-17 | GitHub credential | A **GitHub App** instead of a fine-grained PAT: the Worker mints 1-hour installation tokens, and nothing expires on a calendar or depends on one person's account (doc 09 §8) | A fine-grained PAT with an expiry date and a rotation reminder |

## Budget check (Workers Free, $0 hard constraint)

| Resource | Today (measured 2026-09-21) | After cf-backend |
|---|---|---|
| Cron triggers (account cap 5) | cf-admin uses 2 expressions (`*/5`, `0 2 * * SUN`); owner reports 4/5 account-wide | **+0.** cf-backend has no cron triggers |
| D1 tables (RULE #0.9) | 30 in `madagascar-db` | **+0** |
| KV namespaces | 3 | **+0** |
| cf-admin env vars (RULE #0.8, 42 live) | 17 vars + 25 secrets | **−2 to −4** (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, possibly the two bucket-name vars move out). The service binding is not an env var |
| R2 storage (10 GB-month free) | 3 buckets | +1 bucket, ~5 MB/run → ~0.5 GB/year with the daily Supabase dump |
| GitHub Actions (2,000 min/month, **shared by all private repos**; each job rounds up to a minute) | 1,275 min/month (cf-admin 936 + cf-astro 339, owner's figures 2026-09-22), before the CI consolidation lands | +~130–190 min/month with **one job per run**; the combined target is **under 1,000**; see [10](10-free-tier-feasibility.md) §2 |
| Workers requests/logs | shared 100k req/day, 200k logs/day **account-wide** | RPC calls cost no extra requests (confirmed). Public downloads do count, so a WAF rate-limit rule guards `storage.*` (factor A5) |
| Workers Builds (Free: **1 concurrent build account-wide**, 3,000 min/month) | cf-admin + cf-astro (+ cf-chatbot) | +2 Worker projects; builds queue, so the deploy runbook serializes them (factor A6) |
| Supabase egress (5 GB/month free) | app traffic | +~0.5 GB/month from the daily dump (factor A10) |

Sizes measured 2026-09-21: `madagascar-db` 2.2 MB, `chatbot-kb` 216 KB, `whatsapp-chatbot` 76 KB, and Supabase 17 MB on Postgres **17.6**.

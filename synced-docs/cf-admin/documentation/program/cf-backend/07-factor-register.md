---
title: "cf-backend — 07 Factor register (deep review, 2026-09-21)"
status: draft
audience: [owner, ai, technical]
owner: harshil
related_docs: [README.md, 01-architecture.md, 02-admin-integration-contract.md, 03-backup-pipeline.md, 04-staff-storage-move.md, 05-security-and-compliance.md, 06-roadmap.md]
tags: [program, cf-backend, review, risks]
---

# 07 — Factor register

The second pass over the plan asked: *what would make this fail in production, in a
restore, in an audit, or in two years?* Every factor below has a status:

- **Confirmed**: checked against vendor docs or live infrastructure on 2026-09-21, with the source named.
- **To verify**: plausible and material, but not yet proven. It is assigned to a phase.
- **Design**: a reasoning finding with no external fact to check.

The **Applied in** column says which document changed because of it.

## A. Platform limits that bind the design

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| A1 | **D1 export fails on any database with a virtual table.** `chatbot-kb` has `kb_search` (FTS) | Confirmed (CF D1 import/export docs; live `sqlite_master`) | `wrangler d1 export chatbot-kb` cannot work | Query-based exporter for `chatbot-kb`: `SELECT` each base table (FTS shadow tables excluded), then rebuild `kb_search` on restore. Never drop the FTS table in production to export | 03 §2, §9 |
| A2 | **A running D1 export blocks other requests** to that database | Confirmed (same page) | The booking path writes to D1 *first* (audit-first), so a long export would stall bookings | Export at minute `:17` (between `*/5` ticks, 03:17 local); each database exported separately; export duration recorded in the manifest with an alert above 30 s | 03 §3 |
| A3 | D1 export passes numbers through JavaScript (52-bit precision) | Confirmed (same page) | An `int64` above 2^53 would restore slightly wrong, and a row count would not notice | One-time audit query for integer columns above 2^53 in all three databases (Phase 1); if any exist, the drill adds a per-column checksum | 03 §9 |
| A4 | **Service-binding calls cost no extra requests, but CPU is summed across both Workers**; each call is a subrequest (50/request on Free); max 32 Worker invocations per request | Confirmed (CF pricing + service-bindings docs) | A cf-admin page making many small RPC calls can hit 10 ms CPU or 50 subrequests | Coarse-grained RPC: **one call per user action or page load**, batching inside cf-backend; no RPC from inside loops; a test counts RPC calls per route | 02 §3 |
| A5 | **Workers Free daily request limit (100k) is account-wide** and shared by cf-astro, cf-admin, cf-chatbot and cf-backend | Confirmed (CF limits) | A leaked or scraped share link can burn the quota and take the **public booking site** down with it | A WAF rate-limiting rule on `storage.*` that blocks *before* the Worker runs (blocked requests do not invoke the Worker); a per-token download cap; per-IP `[[ratelimits]]` in the Worker as a second layer. Free-plan WAF rule allowance **to verify** in Phase 0 | 04 §5, 05 §1 |
| A6 | **Workers Builds Free: 1 concurrent build account-wide**, 3,000 build minutes/month, 20 min timeout | Confirmed (Builds limits page) | cf-backend builds queue behind cf-admin/cf-astro; "backend first, then admin" deploys serialize; `verify` inside the build spends shared minutes | Deploy runbook waits for the backend build to finish before pushing cf-admin; keep cf-backend `verify` under ~3 min; track monthly build minutes on the backend console | 06 P1 |
| A7 | R2 bucket locks block **deletion and overwrite**, per prefix, up to 1,000 rules | Confirmed (CF changelog 2025-03-06) | Anything rewritten (`state/latest.json`, `catalog/`) must live outside the locked prefix | Already so in layout v1; a test asserts the writer never PUTs into `v1/runs/` twice for the same key | 03 §4 |
| A8 | GitHub dispatch API returns `workflow_run_id` | Confirmed (GitHub changelog 2026-02-19; REST API version 2026-03-10 always returns it) | Spike S-5 resolved; no `run-name` correlation hack | Store `workflow_run_id` in the audit row and the status row | 03 §9 |
| A9 | GitHub Free private repos: no protected branches, no required reviewers, no enforced CODEOWNERS, no deployment protection rules | Confirmed (GitHub plans doc) | Controls cannot rely on repo settings | Already designed around (doc 05 §3) | 05 §3 |
| A10 | Supabase egress (Free 5 GB/month) counts the daily dump | Design (17 MB × 30 ≈ 0.5 GB) | ~10% of egress for backups | Acceptable; the budget table tracks it; revisit if the database passes ~100 MB | README budget |
| A11 | **GitHub Actions minutes are the binding free limit**: 2,000/month shared by all private repos; each job rounds up to a minute; the owner's target is a combined total under 1,000 | Confirmed (owner's figures + the 2026-09-22 consolidation report; GitHub's per-run billing field returns 0, *measured*) | Extra jobs, not extra work, are what exhaust it | One job per backup run; single-job CI; levers L1–L3 outside cf-backend; a minutes line on the readiness panel | 10 §2 |

## B. Correctness of the backups themselves

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| B1 | **Raw `pg_dump` is the wrong tool for Supabase.** It includes Supabase internals and fails on restore with permission errors | Confirmed (Supabase "Backup and restore using the CLI" + "Restore to self-hosted") | The existing workflow's method would produce backups that do not restore cleanly | Use `supabase db dump` three times (`--role-only`, schema, `--data-only --use-copy`) plus the `supabase_migrations` history pair; restore with `psql --single-transaction`, `session_replication_role = replica` | 03 §2 |
| B2 | Those dumps expect Supabase's roles and extensions | Confirmed (same) | A drill into plain `postgres:17` would fail or pass misleadingly | The drill runs in the **`supabase/postgres` image pinned to the project's version** (17.6.x), not plain Postgres | 03 §3 |
| B3 | **Login-role passwords are not in any dump**: this includes `cf_astro_writer` | Confirmed (Supabase restore notes) + memory of the role's existence | After a restore, cf-astro's `DATABASE_URL` stops working until the password is reset and the secret updated | Restore runbook step: reset every custom `LOGIN` role, update secrets in each consumer Worker | 03 §8 |
| B4 | Vault secrets and pgsodium root key | Confirmed (Supabase docs: column-encryption key copied via Management API) | Encrypted columns or vault secrets would be unreadable after restore | Document which (if any) are used; the restore runbook includes the pgsodium key copy step if column encryption is ever enabled | 03 §2 |
| B5 | Auth and storage schema customisations are restored separately (`supabase db diff --schema auth,storage`) | Confirmed (Supabase docs) | Custom triggers/RLS on `auth`/`storage` would silently vanish | Phase 1 checks for any; if present, the pipeline stores the diff as a run artefact | 03 §2 |
| B6 | **Cross-store consistency**: D1 and Postgres are dumped minutes apart | Design | A booking may exist in one store and not the other at restore time | Restore order: Postgres, then D1; then run the existing booking/consent replay outboxes from D1 to close the gap (raw bodies are PII-redacted, so reconstruction is partial, and this is documented, not hidden) | 03 §8 |
| B7 | A backup that restores is not proof its data is *right* | Design | Row counts miss silent corruption | Keep the schema-hash and size-anomaly rules; add per-table `COUNT` + max(id)/max(updated_at) fingerprints to the manifest | 03 §5 |
| B8 | **All copies with one provider**: R2 and D1 are both Cloudflare | Design | Losing the Cloudflare account (lockout, billing, abuse flag) loses production *and* backups | Second provider: each encrypted run is also uploaded as a GitHub artifact with **14-day retention** (~40 MB, well under the 500 MB Free artifact storage); optional monthly owner download to offline storage (OD-12) | 03 §3, README |
| B9 | Runner cannot decrypt, so it cannot prove the ciphertext is usable | Design | A wrong public key would produce unopenable backups for months | One recipient stanza per file; the manifest records the fingerprint; cf-admin's weekly key check matches it against the Vault-held key and derives the active public key (doc 09 §4) | 03 §3, 09 |

## C. Integration and "never break"

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| C1 | **Fail-closed PLAC keys contradict "new capabilities appear automatically"**: a new key without an `admin_pages` row would be hidden until a cf-admin migration | Design | Either auto-sync breaks or permissions loosen | **Role floors by danger level, enforced in cf-admin**: `read` → admin, `action` → owner, `confirm-typed` → owner; the manifest may *raise* a floor, never lower it. Per-user delegation of a capability needs an `admin_pages` row, created by an owner click ("Allow delegation") in the console, not a migration | 02 §4 |
| C2 | Moved jobs lose cf-admin's D1 metering (the proxy cannot see another Worker's queries) | Design | Budgets silently stop being monitored (the CF-ADMIN-1Q/1S class) | Every `invoke` envelope carries `meter: { queries, rowsRead, rowsWritten }` summed from D1 `meta`; cf-admin's runner records it against the existing budgets | 02 §3 |
| C3 | Local development and tests need the binding | Design; Astro/miniflare multi-Worker dev **to verify** | Without a plan, dev servers and tests break the day the binding lands | cf-admin tests stub `BACKEND` with a miniflare service binding returning fixture envelopes; local dev runs cf-backend in its own `wrangler dev` and cf-admin resolves it through the dev registry (verify in Phase 2a) | 02 §6 |
| C4 | Deploying cf-admin with a binding to a Worker that does not exist yet | To verify | A failed deploy or runtime errors | Rule stands: cf-backend first. Verify the exact behaviour in Phase 1a with a scratch Worker | 06 P1 |
| C5 | Manifest fetched on every page view | Design | An extra RPC call (A4) on every load | Cache the manifest per isolate for 60 s, keyed by `build.sha` | 02 §3 |
| C6 | **Migration ownership for storage tables** once cf-backend owns them | Design | A third writer to the shared `d1_migrations` ledger multiplies RULE #0.7b collisions | D1 schema changes stay authored in **cf-admin `migrations/`** (the `0033`+ band), even for tables cf-backend owns; cf-backend never runs `d1 migrations apply` (OD-11) | README, 04 §2 |
| C7 | Queue messages from a new producer | To verify (cf-email-consumer is a separate repo) | If the consumer validates `projectSource`, cf-backend's alerts are dropped | Cross-repo task: add `cf-backend` to the consumer's accepted sources before the first alert ships | 06 P2 |
| C8 | Audit rows written by the public surface (successful downloads land in `admin_audit_log` today) | Design | cf-backend would bypass cf-admin's redaction chokepoint | Port the row builder and the SEC-12 coverage guard into cf-backend with a contract test on the row shape | 04 §5 |

## D. Security, privacy and operations

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| D1 | **Blast radius of one Worker**: the internet-facing router would share an isolate with the GitHub token and the backups binding | Design | A logic bug on the public path could reach the most sensitive credentials | **OD-1 revised: one repo, two Workers.** `cf-backend` (private, RPC only, no routes) holds GitHub, backups and management; `cf-backend-edge` (public, `storage.*`) holds only what serving links needs | README OD-1, 01 §2 |
| D2 | **Email link scanners** (Outlook Safe Links and similar) fetch URLs automatically | Design | They could consume download caps, record fake consent, or trip rate limits | Link GET renders a landing page only; the download is a POST after the consent/passcode step; scanners never trigger a counted download | 04 §5 |
| D3 | Uploaded files served from the admin origin | Design | An uploaded HTML/SVG opened inline could run script where the admin session lives | The move itself fixes it (files leave `secure.*`); `storage.*` serves files with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox` | 04 §5 |
| D4 | Tokens in URL paths leak into logs and `Referer` | Design | Anyone with log access, or a third-party page, could replay a link | Log only a token hash prefix; `Referrer-Policy: no-referrer`; `X-Robots-Tag: noindex, nofollow` on `storage.*` | 04 §5 |
| D5 | GitHub Actions log retention (private repos default 90 days) and visibility to collaborators | Design | Logs linger longer than needed | Set repo log/artifact retention to 14 days; logs carry counts only (doc 05 §4) | 05 §4 |
| D6 | **Key custody and bus factor**: one person holding the only key | Design | If that person is unavailable, backups are unopenable | Two-provider custody: the key lives in Supabase Vault, and Owner and Vendor each hold a recovery kit; either can rotate or restore alone, and every action emails the other (OD-13, doc 09) | 05 §2, 09 |
| D7 | Token and credential expiry | Design | Silent failure months later | Expiry calendar in `backend:secrets-calendar`, surfaced 14 days ahead (already in doc 05 §4); includes the Supabase DB password, since a rotation silently breaks `SUPABASE_DB_URL` | 05 §4 |
| D8 | Sensitive personal data (staff health, payroll) once the R2 mirror lands | Design; **legal review recommended** | Under Mexican data-protection law, sensitive data carries stricter duties, including breach notification if a backup leaks | Mirror (P5) stays behind an explicit owner decision and a RoPA entry; encryption mandatory | 05 §5 |
| D9 | Wildcard Cloudflare Access apps | To verify | A `*.madagascarhotelags.com` Access app would wall off `storage.*`; conversely nothing must expose the private Worker | Phase 0 lists Access apps; the private Worker has no route at all | 06 P0 |
| D10 | cf-backend's own error tracking | Design | Errors invisible across the boundary | Separate Sentry project in the same org, `release = cf-backend@<sha>`; the correlation id travels in `Actor.sessionId` + a request id | 02 §3 |

## E. Lessons from the existing workflow's history

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| E1 | GitHub schedules drift by hours: run `35580420378` started at 08:55 UTC for a 03:17 slot | Confirmed (`gh run view`, 2026-09-21) | Exact start times cannot be assumed | Record `timing.delaySeconds`; dead-man's switch tolerates ≥ 12 h; out-of-window starts flagged, not skipped | 03 §10 P-17 |
| E2 | A local `sqlite3` drill cannot reveal D1-specific import failures or D1's real restore speed | Design | A weekly-local-only drill would certify backups the real restore path might reject | Tiered drills: monthly real-path drill into a temporary D1 | README OD-15, 03 rule 2 |
| E3 | Secret rot spans workflows: `production-tests.yml` references the same missing Cloudflare secrets and has never run green | Confirmed (chunk 6 record §11) | A workflow can rot silently for months | Cross-workflow secret-reference guard in CI; readiness panel | 03 §10 P-16, 02 §5.1 |
| E4 | Operational failure, not design failure: six days with no backup and no signal | Confirmed (run history + `gh secret list`) | The biggest risk to cf-backend is the same one | Readiness panel + `doctor` + owner steps tracked as visible pending rows | README OD-14, 03 §10 P-14/P-21 |
| E5 | Measured numbers copied by hand into docs go stale | Design (the chunk 6 record asks for exactly that) | The runbook would drift from reality | Numbers flow manifest → status row → console; docs keep targets and link out | 03 §10 P-18 |

## F. Recovery time (what a real restore costs)

| Scenario | Path | Realistic RTO | Why |
|---|---|---|---|
| Bad write in D1, noticed within 7 days | `wrangler d1 time-travel restore` **in place** | Minutes | Same database id, so no binding changes. **Always prefer this** |
| D1 lost beyond 7 days | New D1 from the export → update bindings in cf-admin, cf-astro, cf-backend (and cf-chatbot for its databases) → deploy each | 1–2 h | Builds run one at a time (A6) |
| Supabase data loss | Restore into a new project (or a wiped one) → reset `LOGIN` role passwords (B3) → update secrets in each consumer Worker → re-run D1 replay outboxes (B6) | 2–4 h | Free orgs have a small active-project allowance; the dormant second project may need pausing first (**to verify**) |
| Cloudflare account lost | Rebuild from the GitHub artifact copy (B8) in a new account | Day(s) | Only possible because of B8 |

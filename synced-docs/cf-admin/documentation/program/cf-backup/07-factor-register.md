---
title: "cf-backup — 07 Factor register (deep review)"
status: draft
audience: [owner, ai, technical]
owner: harshil
related_docs: [README.md, 01-architecture.md, 02-admin-integration-contract.md, 03-backup-pipeline.md, 05-security-and-compliance.md, 06-roadmap.md, 11-run-evidence-and-usage.md]
tags: [program, cf-backup, review, risks]
---

# 07 — Factor register

The review asked: *what would make this fail in production, in a restore, in an audit, or
in two years?* It was first run on 2026-09-21 and extended on 2026-09-22, when the plan
became backup-only with an embedded console and a run evidence policy. Every factor has
a status:

- **Confirmed**: checked against vendor docs or live infrastructure, with the source named.
- **To verify**: plausible and material, but not yet proven. It is assigned to a phase.
- **Design**: a reasoning finding with no external fact to check.
- **Parked**: belonged to the Staff Storage move, which is out of scope (doc 04).
- **Superseded**: belonged to the first draft's design and no longer applies; the row says what replaced it.

The **Applied in** column says which document changed because of it.

## A. Platform limits that bind the design

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| A1 | **D1 export fails on any database with a virtual table.** `chatbot-kb` has `kb_search` (FTS) | Confirmed (CF D1 import/export docs; live `sqlite_master`) | `wrangler d1 export chatbot-kb` cannot work | Query-based exporter for `chatbot-kb`: `SELECT` each base table (FTS shadow tables excluded), then rebuild `kb_search` on restore. Never drop the FTS table in production to export | 03 §2, §9 |
| A2 | **A running D1 export blocks other requests** to that database | Confirmed (same page) | The booking path writes to D1 *first* (audit-first), so a long export would stall bookings | Export at minute `:17` (between `*/5` ticks, 03:17 local); each database exported separately; export duration recorded, with a warning above 30 s | 03 §3 |
| A3 | D1 export passes numbers through JavaScript (52-bit precision) | Confirmed (same page) | An `int64` above 2^53 would restore slightly wrong, and a row count would not notice | One-time audit query for integer columns above 2^53 in all three databases (Phase 0); if any exist, the drill adds a per-column checksum | 03 §9 |
| A4 | **Service-binding calls cost no extra requests, but CPU is summed across both Workers**; each call is a subrequest (50/request on Free); max 32 Worker invocations per request | Confirmed (CF pricing + service-bindings docs); whether the callee shares the caller's subrequest budget is *to verify* | The gateway makes one binding call per browser request; reconcile and the meter make many external calls | The gateway never loops; jobs batch (≤ 20 runs per meter call); one GraphQL request carries several datasets | 02 §3, §8; 11 §5.5 |
| A5 | Workers Free daily request limit (100k) is account-wide | Confirmed (CF limits) | **Parked:** the risk was a scraped public storage link. cf-backup has no public surface; the console adds a handful of cf-admin requests a day | — | README budget |
| A6 | **Workers Builds Free: 1 concurrent build account-wide**, 3,000 build minutes/month, 20 min timeout | Confirmed (Builds limits page) | cf-backup builds queue behind cf-admin/cf-astro; "cf-backup first, then cf-admin" deploys serialize | Deploy runbook waits for the cf-backup build before pushing cf-admin; keep cf-backup `verify` under ~3 min | 06 P1 |
| A7 | R2 bucket locks block **deletion and overwrite**, per prefix, up to 1,000 rules | Confirmed (CF changelog 2025-03-06) | Anything rewritten (`indexes/`) must live outside the locked prefixes | Layout v1 keeps `indexes/` unlocked; a test asserts the writer never PUTs the same locked key twice. Creating *new* keys under a lock: see H3 | 03 §4 |
| A8 | GitHub dispatch API returns `workflow_run_id` | Confirmed (GitHub changelog 2026-02-19; REST API version 2026-03-10 always returns it) | Spike S-5 resolved; no `run-name` correlation hack | Store `workflow_run_id` in the audit row and the `ops/events` dispatch record | 03 §9, 11 §3 |
| A9 | GitHub Free private repos: no protected branches, no required reviewers, no enforced CODEOWNERS, no deployment protection rules | Confirmed (GitHub plans doc) | Controls cannot rely on repo settings | Already designed around (doc 05 §3) | 05 §3 |
| A10 | Supabase egress (Free 5 GB/month) counts the daily dump | Design (17 MB × 30 ≈ 0.5 GB) | ~10% of egress for backups | Acceptable; **each run now measures its own pooler egress** (doc 11 §5.2); revisit if the database passes ~100 MB | README budget, 11 §5 |
| A11 | **GitHub Actions minutes are the binding free limit**: 2,000/month shared by all private repos; each job rounds up to a minute; the owner's target is a combined total under 1,000 | Confirmed (owner's figures + the 2026-09-22 consolidation report; GitHub's per-run billing field returns 0, *measured*) | Extra jobs, not extra work, are what exhaust it | One job per backup run; single-job CI; levers L1–L3 outside cf-backup; the minutes meter (the GitHub App's read-only tokens) shows the month-to-date total in the console | 10 §2, 11 §5.4 |

## B. Correctness of the backups themselves

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| B1 | **Raw `pg_dump` is the wrong tool for Supabase.** It includes Supabase internals and fails on restore with permission errors | Confirmed (Supabase "Backup and restore using the CLI" + "Restore to self-hosted") | The existing workflow's method would produce backups that do not restore cleanly | Use `supabase db dump` three times (`--role-only`, schema, `--data-only --use-copy`) plus the `supabase_migrations` history pair; restore with `psql --single-transaction`, `session_replication_role = replica` | 03 §2 |
| B2 | Those dumps expect Supabase's roles and extensions | Confirmed (same) | A drill into plain `postgres:17` would fail or pass misleadingly | The drill runs in the **`supabase/postgres` image pinned to the project's version** (17.6.x) | 03 §3 |
| B3 | **Login-role passwords are not in any dump**: this includes `cf_astro_writer` | Confirmed (Supabase restore notes) | After a restore, cf-astro's `DATABASE_URL` stops working until the password is reset and the secret updated | Restore runbook step: reset every custom `LOGIN` role, update secrets in each consumer Worker | 03 §8 |
| B4 | Vault secrets and pgsodium root key | Confirmed (Supabase docs) | Encrypted columns or vault secrets would be unreadable after restore | Document which are used; the backup keys' own path is the recovery kit (doc 09) | 03 §2, 09 §6 |
| B5 | Auth and storage schema customisations are restored separately (`supabase db diff --schema auth,storage`) | Confirmed (Supabase docs) | Custom triggers/RLS on `auth`/`storage` would silently vanish | Phase 1 checks for any; if present, the pipeline stores the diff in the run folder | 03 §2 |
| B6 | **Cross-store consistency**: D1 and Postgres are dumped minutes apart | Design | A booking may exist in one store and not the other at restore time | Restore order: Postgres, then D1; then run the booking/consent replay outboxes from D1 to close the gap (partial, documented) | 03 §8 |
| B7 | A backup that restores is not proof its data is *right* | Design | Row counts miss silent corruption | Schema-hash and size-anomaly rules, plus per-table count + max(id)/max(updated_at) fingerprints (`verify/fingerprints.json`) | 03 §4.3, §5 |
| B8 | **All copies with one provider**: R2 and D1 are both Cloudflare | Design | Losing the Cloudflare account loses production *and* backups | Each run folder is also a GitHub artifact with **14-day retention** (OD-12) | 03 §3, README |
| B9 | Runner cannot decrypt, so it cannot prove the ciphertext is usable | Design | A wrong public key would produce unopenable backups for months | One recipient stanza per file; the manifest records the fingerprint; the weekly key check matches it against the Vault-held key (doc 09 §4) | 03 §3, 09 |

## C. Integration and "never break"

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| C1 | Fail-closed page keys contradicted "new capabilities appear automatically" | **Superseded** (2026-09-22) | — | The embedded console needs no per-capability keys: one `/dashboard/backup` row gates entry and cf-backup enforces action floors itself (doc 02 §6) | 02 §6 |
| C2 | Jobs run in another Worker escape cf-admin's D1 metering | Design | Budgets silently stop being monitored (the CF-ADMIN-1Q/1S class) | Every job reply carries `meter: { queries, rowsRead, rowsWritten }` summed from D1 `meta`; cf-admin's runner records it against the job's budget | 02 §8 |
| C3 | Local development and tests need the binding | **Confirmed** (CF multi-Worker development docs: separate dev commands reach each other through service bindings); under cf-admin's Astro dev server **to verify** in Phase 2a | Without a plan, dev servers and tests break the day the binding lands | Standalone mode with a local-only actor; integrated mode through the dev registry; a fixture Worker in cf-admin's tests | 02 §9 |
| C4 | Deploying cf-admin with a binding to a Worker that does not exist yet | To verify | A failed deploy or runtime errors | Rule stands: cf-backup first. Verify the exact behaviour in Phase 1a with a scratch Worker | 06 P1 |
| C5 | Manifest fetched on every page view | **Superseded** (no manifest) | — | — | — |
| C6 | A third writer to the shared `d1_migrations` ledger | **Superseded** | — | cf-backup owns no tables and runs no migrations (OD-11) | README |
| C7 | Queue messages from a new producer | To verify (cf-email-consumer is a separate repo) | If the consumer validates `projectSource`, cf-backup's alerts are dropped | Cross-repo task: add `cf-backup` to the consumer's accepted sources before the first alert ships | 06 P2 |
| C8 | Audit rows written by a public storage surface | **Parked** | — | — | — |
| C9 | **cf-admin refuses to be framed at all**: `X-Frame-Options: DENY` and `frame-ancestors 'none'` on every response; `frame-src 'self'` already allowed | Confirmed (*measured*: `src/lib/security/csp.ts:73`, `:119`, `:120`) | A same-origin frame of the console would be refused | Exception for `/dashboard/backup/app/` only (`SAMEORIGIN`, `frame-ancestors 'self'`), pinned by a guard test (OD-18) | 02 §5 |
| C10 | **Nested dashboard paths inherit the nearest ancestor's page key** | Confirmed (*measured*: `src/lib/auth/decide-access.ts:41`) | One page row can gate every console page and API call | Seed only `/dashboard/backup` | 02 §3, §6 |
| C11 | A binding-only Worker can serve its UI's static files | Confirmed (CF service-binding RPC docs: `env.ASSETS.fetch()` from inside the Worker; only the path matters) | The console needs no public host to serve its bundle | Assets fetched explicitly by the Worker | 01 §4 |
| C12 | A same-origin frame's code can read the parent page | Design | cf-backup's browser code has admin-origin trust | T18 controls: no public surface, owner-approved dependencies, strict CSP, private repo with `verify` in the build | 02 §5, 05 T18 |
| C13 | Session expiry inside a frame | Design | A sign-in flow inside a frame is fragile, and whether Access allows its login page to be framed should not be relied on | The frame never navigates to sign-in; on a 401 or redirect the app reloads the parent page | 02 §7 |
| C14 | The gateway could leak cf-admin's credentials to cf-backup, or pass a forged identity | Design | cf-backup would hold a session cookie or an Access token it never needs, or trust a browser's claim | Header allow-list; drop `Cookie`, `Authorization`, the Access JWT and every client `X-Backup-*`; add the actor last; tests | 02 §3, §4 |

## D. Security, privacy and operations

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| D1 | Blast radius of one Worker with an internet-facing router | **Superseded** | — | With no public surface, one private Worker suffices (OD-1) | README OD-1, 01 §3 |
| D2 | Email link scanners fetch share URLs | **Parked** | — | — | — |
| D3 | Uploaded files served from the admin origin | **Parked** — already mitigated today: cf-admin serves storage downloads with `Content-Disposition: attachment` and `nosniff` (*measured*: `src/pages/api/storage/share/[token].ts:342`, `src/pages/api/storage/[id]/download.ts:71`) | — | — | README verdict |
| D4 | Share tokens in URL paths leak into logs and `Referer` | **Parked** | — | — | — |
| D5 | GitHub Actions log retention (private repos default 90 days) and visibility to collaborators | Design | Logs linger longer than needed; and the retention window is also the deadline for fetching GitHub's archive | Repo log/artifact retention 14 days; cf-backup fetches the archive within a day (H6) | 05 §4, 11 §3 |
| D6 | **Key custody and bus factor**: one person holding the only key | Design | If that person is unavailable, backups are unopenable | The key lives in Supabase Vault, and Owner and Vendor each hold a recovery kit; either can rotate or restore alone, and every action emails the other (OD-13, doc 09) | 05 §2, 09 |
| D7 | Token and credential expiry | Design | Silent failure months later | Expiry calendar in `backup:secrets-calendar`, surfaced 14 days ahead; includes the Supabase DB password and the usage token | 05 §4 |
| D8 | Sensitive personal data (staff health, payroll) once the R2 mirror lands | Design; **legal review recommended** | Under Mexican data-protection law, sensitive data carries stricter duties, including breach notification if a backup leaks | The mirror (P4) stays behind an explicit owner decision and a RoPA entry; encryption mandatory | 05 §5 |
| D9 | Wildcard Cloudflare Access apps covering a new hostname | **Parked** (no new hostname) | — | — | — |
| D10 | cf-backup's own error tracking | Design | Errors invisible across the boundary | Separate Sentry project in the same org, `release = cf-backup@<sha>`; the gateway's `X-Backup-Request-Id` travels into cf-backup's events and evidence | 02 §3 |

## E. Lessons from the existing workflow's history

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| E1 | GitHub schedules drift by hours: run `35580420378` started at 08:55 UTC for a 03:17 slot | Confirmed (`gh run view`, 2026-09-21) | Exact start times cannot be assumed | Record `timing.delaySeconds`; dead-man's switch tolerates ≥ 12 h; out-of-window starts flagged, not skipped | 03 §10 P-17 |
| E2 | A local `sqlite3` drill cannot reveal D1-specific import failures or D1's real restore speed | Design | A weekly-local-only drill would certify backups the real restore path might reject | Tiered drills: monthly real-path drill into a temporary D1 | README OD-15, 03 rule 2 |
| E3 | Secret rot spans workflows: `production-tests.yml` references the same missing Cloudflare secrets and has never run green | Confirmed (chunk 6 record §11) | A workflow can rot silently for months | Cross-workflow secret-reference guard in CI; readiness panel | 03 §10 P-16 |
| E4 | Operational failure, not design failure: six days with no backup and no signal | Confirmed (run history + `gh secret list`) | The biggest risk to cf-backup is the same one | Readiness panel + `doctor` + owner steps tracked as visible pending rows | README OD-14, 03 §10 P-14/P-21 |
| E5 | Measured numbers copied by hand into docs go stale | Design | The runbook would drift from reality | Numbers flow run folder → indexes → status row → console; docs keep targets and link out | 03 §10 P-18 |

## F. Recovery time (what a real restore costs)

| Scenario | Path | Realistic RTO | Why |
|---|---|---|---|
| Bad write in D1, noticed within 7 days | `wrangler d1 time-travel restore` **in place** | Minutes | Same database id, so no binding changes. **Always prefer this** |
| D1 lost beyond 7 days | New D1 from the export → update bindings in cf-admin, cf-astro and cf-backup (and cf-chatbot for its databases) → deploy each | 1–2 h | Builds run one at a time (A6) |
| Supabase data loss | Restore into a new project (or a wiped one) → reset `LOGIN` role passwords (B3) → update secrets in each consumer Worker → re-run D1 replay outboxes (B6) | 2–4 h | Free orgs have a small active-project allowance; the second project may need pausing first (S-7) |
| Cloudflare account lost | Rebuild from the GitHub artifact copy (B8) in a new account | Day(s) | Only possible because of B8 |

## H. Evidence, logs and usage (added 2026-09-22)

| # | Factor | Status | Impact | Decision | Applied in |
|---|---|---|---|---|---|
| H1 | **A GitHub re-run keeps the run id** and increments `run_attempt` | Confirmed (GitHub Actions context: `github.run_attempt`) | A re-run writing to the same folder would hit the lock, and every upload would be refused | The run key carries the attempt: `<date>_<scope>_gh<id>a<attempt>` | 03 §4.2 |
| H2 | The runner's own log dies with the runner | Design | A timed-out or crashed run would leave no explanation | cf-backup fetches **GitHub's archive** into `postrun/` for every finished run, including ones with no manifest | 11 §3 |
| H3 | R2 locks refuse delete and overwrite; creating **new** keys under a locked prefix is not described as blocked | To verify (Phase 0, spike S-9) | `postrun/` is written into a locked run folder after the run | Prove it in Phase 0; fallback is an unlocked sibling prefix | 03 §7, §9 |
| H4 | GitHub masks secrets in its own log, **not in files a step writes** | Design (GitHub masking applies to the log it displays) | The runner's evidence files could carry an unmasked value | In-runner redactor using the secret values themselves plus patterns; residue check fails closed | 11 §4 |
| H5 | Workers Logs keeps **3 days** on Free (200k events/day) | Confirmed (Workers Logs pricing) | cf-backup's own execution history would vanish in 3 days | Anything worth keeping is an R2 `ops/` record | 11 §1, §3 |
| H6 | GitHub's run logs last only as long as the repo's log retention (14 days, D5) | Design | Miss the window and the archive is gone | Reconcile runs daily; a miss is recorded as `unavailable (expired)` | 11 §3 |
| H7 | **Supabase organisation usage (egress) is not readable without an account-wide Management API token** | Confirmed (Supabase docs: the org usage page; Management API endpoints need an access token) | The monthly egress figure cannot be automated at acceptable risk | Measure each run's own pooler egress exactly; org total `unavailable` with a link (OD-23) | 11 §5.4 |
| H8 | GitHub App permissions apply to every repo an installation covers | Design (the App permission model) | Installing the one App on cf-admin/cf-astro to read their minutes gives it the same Actions and Variables write there | **Revised 2026-09-22 (one GitHub key):** accepted with containment, see H17. The separate meter App (OD-22) is withdrawn | 05 §3, 12 §6 |
| H9 | Vendor analytics are aggregated and lag by minutes | Design | Subtracting two account readings would not give a run's own consumption | A run's share comes from its own meter; each account reading carries its own time | 11 §5.1 |
| H10 | 50 external subrequests per invocation on Free | Confirmed (CF limits); sharing across a binding chain *to verify* (A4) | A meter pass over a month of CI runs could exceed it | Batches of ≤ 20 runs per call, hourly until caught up; one GraphQL call for several datasets | 11 §5.5 |
| H11 | **D1 writes are the scarcer daily resource**, and run logs exceed 100 KB | Confirmed (*measured* 2026-09-10: writes peak 15% of the daily allowance, reads 3.6%) | Logs in D1 would spend the scarcest allowance and break RULE #0.9 | Evidence in R2; D1 holds only small settings rows, never evidence (RE-5) | 11 §1 |
| H12 | A runaway step could print an enormous log | Design | Storage and console load | gzip always; above 50 MB uncompressed, keep the first and last 20 MB with a marker, and flag it in the manifest | 11 §2 RE-2 |
| H13 | **`pg_read_all_data` reads every schema, Vault included**, and a per-object `REVOKE` does not subtract from it | Design (Postgres predefined-role semantics). **Verified 2026-09-23: it does** — the reader read `vault.decrypted_secrets`, so the grant was replaced by per-schema grants | The dump credential in GitHub could read the backup private keys, defeating the encryption | Every run's `doctor` proves the reader is refused on `vault.decrypted_secrets`; otherwise per-schema grants | 12 §5 |
| H14 | **R2 S3 keys can be derived from a Cloudflare API token**: key id = token id, secret = SHA-256 of the value | Confirmed (R2 API tokens docs) | Separate R2 writer keys are unnecessary | One Cloudflare token for D1, analytics and R2 | 12 §4.5 |
| H15 | **Bucket-scoped R2 item permissions work only through the S3 API**, not the Cloudflare REST API | Confirmed (same) | The runner must upload through S3, not `wrangler r2 object put` | S3 PUTs with the derived keys, for data, evidence and heartbeats | 12 §4.1, 14 §5 |
| H16 | **Account API tokens are durable service principals**, not tied to a person | Confirmed (account API tokens docs); per-service support *to verify* | A user token would stop working when its person leaves | Key 1 is an account token where the services support it | 12 §4.2 |
| H17 | **One GitHub App on three repos** has the same permissions on each | Design | A stolen key could act on cf-admin's and cf-astro's workflows and variables (no code) | No Contents/Workflows/Administration; tokens narrowed per call; the recipient check refuses a swapped `BACKUP_AGE_RECIPIENT` | 12 §6 |
| H18 | **The runner cannot reach cf-backup**, which has no public route | Design | Live progress cannot be pushed to the Worker | R2 is the mailbox: heartbeats every 5 s; the console polls through the gateway | 14 §2, §3 |
| H19 | **Guards that fail open on a missing registry row** (found by the 2026-09-20 cron review) | Confirmed (that review) | A new capability could be open to everyone | Unknown capability = deny; known-but-unstored = its code default | 13 §3 |
| H20 | **A permission change locked out the only Owner for 14 hours** (2026-09-16) | Confirmed (that incident's design record) | The access policy could repeat it | Last-holder guard on `access.manage` and `keys.rotate` | 13 §3 |
| H21 | **`admin_audit_log` lives in D1** (`madagascar-db`) | Confirmed (*measured*: `migrations/0000_baseline.sql`, `src/lib/dal/AuditLogRepository.ts`) | cf-backup can read the gateway's audit rows through its existing `DB` binding | The activity timeline merges them read-only; no copy is kept | 13 §6 |

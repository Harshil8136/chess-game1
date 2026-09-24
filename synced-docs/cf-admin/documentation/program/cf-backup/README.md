---
title: "cf-backup — Plan of Record (overview and decisions)"
status: draft
audience: [owner, ai, technical, operator]
owner: harshil
related_docs: [01-architecture.md, 02-admin-integration-contract.md, 03-backup-pipeline.md, 05-security-and-compliance.md, 06-roadmap.md, 11-run-evidence-and-usage.md, ../adr/ADR-0001-program-constraints.md]
tags: [program, cf-backup, backups, architecture, plan]
---

<!-- docs-check: proposed-paths -->
<!-- Built and deployed 2026-09-23/24; the "As built" notes record where the build differs from the plan. It names routes, files and folders in cf-backup's repository, not cf-admin's. -->

# cf-backup — Plan of Record

> **Status: draft for owner review.** Nothing here is built. Every decision below is a
> **default** that can be reversed at review. Facts marked *measured* were checked against
> live infrastructure; facts marked *to verify* are open questions for Phase 0/1.
>
> **2026-09-22: re-scoped from "cf-backend" to "cf-backup" (owner decision).** Three changes:
>
> 1. **Backups only.** The Staff Storage move is **parked**. [04-staff-storage-move.md](04-staff-storage-move.md) is kept as the analysis, marked historical. With it went the second Worker, the public `storage.*` host, the 301 shim, the WAF rule and two whole phases. cf-backup has **no public surface at all**.
> 2. **An embedded app instead of a server-driven UI.** cf-backup ships its own console (screens, features, design) and runs on its own dev server. In production, cf-admin shows it at `/dashboard/backup` inside a same-origin frame, forwarding every request over the private service binding ([02](02-admin-integration-contract.md)). The first draft's manifest, view primitives, form generator and contract machinery are gone.
> 3. **A run evidence policy.** Every execution leaves a complete, redacted, write-once evidence bundle in R2: full logs, GitHub's own log archive, database-side figures, errors, file sizes, and a resource receipt against every free allowance. **None of it goes into D1** ([11](11-run-evidence-and-usage.md)).
>
> **Later the same day (owner requirements):** the keys were cut to **four secrets from three providers, none in cf-admin** ([12](12-keys-and-secrets.md)); the console gained **fine-grained access control**, activity logs and a global config ([13](13-access-control.md)); and a **live operations view** shows every running process in near real time ([14](14-live-operations-view.md)).
>
> Earlier revisions: the deep review ([07](07-factor-register.md)), processes adopted from the existing workflow ([08](08-existing-backup-workflow.md) → [03 §10](03-backup-pipeline.md#10-operating-principles-adopted-from-the-existing-workflow)), key management ([09](09-key-management.md)) and the free-tier audit ([10](10-free-tier-feasibility.md)).

## What cf-backup is, in one paragraph

`cf-backup` is a new private repository and **one** new Cloudflare Worker. Its only job is the
platform's backups: taking them, proving they restore, keeping them safe, and recording
everything about every run. The Worker has **no route, no `workers.dev` address and no
preview URLs**; the only way in is the service binding in cf-admin. The heavy work
(`supabase db dump`, D1 exports, restore drills, encryption) runs on **GitHub Actions in the
cf-backup repo**, which only the Worker dispatches and watches. cf-backup owns its whole
console and can be run on its own for development. In production cf-admin shows it at
`/dashboard/backup`, in a frame served through cf-admin's own gateway, so a new backup
feature appears in the portal as soon as cf-backup deploys. That takes no cf-admin release, and cf-backup never gets a public address.

## Reading order

| # | Document | Answers |
|---|---|---|
| 1 | [01-architecture.md](01-architecture.md) | What runs where, the one Worker, bindings, what changes in cf-admin, failure isolation |
| 2 | [02-admin-integration-contract.md](02-admin-integration-contract.md) | How cf-admin embeds cf-backup safely: the gateway, the actor header, the frame-header exception, permissions, audit, local development, never-break rules |
| 3 | [03-backup-pipeline.md](03-backup-pipeline.md) | The backup itself: scope, workflow, **R2 bucket and run-folder layout**, encryption, verification, retention, restore |
| 4 | [04-staff-storage-move.md](04-staff-storage-move.md) | **Parked** (historical): the storage move analysis, kept in case it is ever revived as its own project |
| 5 | [05-security-and-compliance.md](05-security-and-compliance.md) | Threat model, secrets inventory, GitHub Free limits, LFPDPPP/RoPA updates |
| 6 | [06-roadmap.md](06-roadmap.md) | Phases → stages → tasks, exit criteria, owner steps, rollback per phase |
| 7 | [07-factor-register.md](07-factor-register.md) | The deep review: every factor (limits, backup correctness, integration, security, evidence), each confirmed / to verify / design / parked |
| 8 | [08-existing-backup-workflow.md](08-existing-backup-workflow.md) | **Start here if you only read one thing about backups today:** the existing cf-admin `backups.yml`, why it has never produced a backup, and the 15-minute bridge to a first real one |
| 9 | [09-key-management.md](09-key-management.md) | How the backup key works: Supabase Vault, Owner/Vendor only, one-click rotation, weekly automatic key check, recovery kit |
| 10 | [10-free-tier-feasibility.md](10-free-tier-feasibility.md) | **Is all of it free?** Yes: per-service verdict, the GitHub Actions budget, years of backups in R2, Phase 0 checks, tripwires |
| 11 | [11-run-evidence-and-usage.md](11-run-evidence-and-usage.md) | **The run evidence policy:** what every run records (logs, errors, sizes, resources, allowances), who writes it, how secrets stay out, how it feeds a viability view |
| 12 | [12-keys-and-secrets.md](12-keys-and-secrets.md) | **Every API key, where it lives and exactly how to set it:** four secrets, three providers, none in cf-admin; permissions, creation steps, rotation, what a leak could do |
| 13 | [13-access-control.md](13-access-control.md) | **Who may do what in the console:** the 23-capability catalog, role defaults, per-person grants, safety floors, activity logs and exports, the global config |
| 14 | [14-live-operations-view.md](14-live-operations-view.md) | **The live view:** what is running right now, step by step, with the live log, metrics and usage; how duplicates are prevented; what it costs |

## Verdict on the original idea

The idea is sound, and most of it survives. This table records what was kept, changed or dropped, and why.

| Original proposal | Verdict | Why |
|---|---|---|
| Backups in R2, weekly, via a scheduled job | **Keep** | R2 free tier is 10 GB-month. The measured payload is ~5 MB per run, so decades of weekly runs fit |
| Do the dump on Vercel (Hobby) | **Drop** | Vercel Hobby is for personal, non-commercial use, and this is a commercial business. It would also add a fourth platform and a fourth secret store. GitHub Actions gives a full VM with native `pg_dump`, and a working `backups.yml` already exists in cf-admin |
| Do the dump in a Worker | **Drop for Postgres, partial for D1** | Workers Free allows **10 ms CPU per invocation** (*measured*: CF docs). I/O wait does not count, so *streaming* a D1 export into R2 would fit, but gzip/encryption in-Worker would not. `pg_dump` cannot run in a Worker at all |
| GitHub Actions as the runner | **Keep, in the cf-backup repo** | 2,000 free minutes/month shared by private repos; a run is ~2–4 min. The existing cf-admin `backups.yml` is the starting point, not a rewrite |
| A new D1 table `backup_logs` | **Replace** | RULE #0.9 caps tables, and run logs routinely exceed 100 KB. The run record is an evidence bundle in R2 ([11](11-run-evidence-and-usage.md)); the current status is one `admin_portal_settings` row; who pressed what goes to `admin_audit_log`. **0 new tables, 0 new KV namespaces** |
| GitHub Copilot CLI "AI audit" of logs | **Drop from the backup path** | It needs a paid Copilot seat, gives non-deterministic verdicts in a disaster-recovery record, and sends logs to a third party. It is replaced by **deterministic checks**: restore drill, row-count diff, schema fingerprint diff and size-anomaly rules. An optional Workers AI summary of the PII-free evidence can come later (Phase 4) |
| Write the result row with raw SQL via the D1 REST API | **Drop** | The draft interpolated values into SQL (injection-prone) and needed a D1-write token in GitHub. Instead, cf-backup *pulls* the run folder from R2, so GitHub never writes to D1 |
| Email via Resend directly from the workflow | **Replace** | Reuse the existing `madagascar-emails` queue → `cf-astro-email-consumer` (Brevo primary). cf-backup enqueues; no mail key lives in GitHub |
| GPG symmetric passphrase | **Upgrade** | Use **public-key** encryption (`age`). The runner holds only the *public* key and the private key is held in Supabase Vault, away from the Cloudflare-stored backups (doc 09), so a leaked GitHub secret cannot decrypt any backup |
| Lifecycle rule auto-deleting after 60–90 days | **Replace** | The owner rule is "retention is fully manual" (ADR-0001). Use **R2 bucket locks** instead, so nothing can delete a run early, not even a leaked token. Pruning is an owner-only, audited action in the console |
| Daily cron for better RPO | **Adopt for Supabase only** | D1 already has 7-day Time Travel (point-in-time) on Free; Supabase Free has **no** backups or PITR. So: weekly full backup of everything, plus a daily Supabase-only dump |
| Backend UI "synced" into cf-admin | **Keep, as an embedded app through cf-admin's gateway** (revised 2026-09-22) | cf-backup ships its own console; cf-admin frames it same-origin and forwards requests over the service binding. Safe because cf-backup has no public address, and simpler than the first draft's server-driven UI. See doc 02 |
| Storage on `storage.madagascarhotelags.com` | **Parked** (2026-09-22) | It was an improvement project, not a fix, and it carried most of the plan's risk. Its main security gain already exists: cf-admin serves storage downloads as `attachment` with `nosniff`. Backing up the storage *files* stays in scope (Phase 4 mirror); owning storage does not |
| Detailed logs and usage figures for every run | **Adopt, in R2** (2026-09-22) | Owner requirement: full logs, GitHub's own logs, database figures, errors, sizes and a resource receipt against every free allowance, kept per run. R2, not D1; write-once and bucket-locked ([11](11-run-evidence-and-usage.md)) |

Defects in the draft workflow worth knowing, because they would have shipped:

- `--exclude "raw.sql"` does not match `supabase_raw.sql`, so the unencrypted raw dump would have been uploaded.
- It computed "free tier remaining" from *dump* size. D1 and Postgres limits apply to database size, not dump size. (Doc 11 measures database size on the server.)
- It listed the whole bucket every run (Class A operations) to compute usage.
- It interpolated `${{ }}` values into shell and SQL, the classic GitHub Actions script-injection shape.

## Owner decisions (defaults — reverse any at review)

| ID | Decision | Default | Alternative |
|---|---|---|---|
| OD-1 | Name and shape | **Accepted 2026-09-22:** repo `cf-backup`, **one** private Worker: no route, `workers_dev = false`, `preview_urls = false`, reachable only through cf-admin's service binding. The storage move is parked | The earlier two-Worker cf-backend (private + public `storage.*`) |
| OD-2 | Backup bucket | **Accepted 2026-09-23 (owner: "select all best choices").** New dedicated bucket `madagascar-backups`, so credentials can be scoped to it alone | A prefix inside an existing bucket: one bucket fewer, but other tokens could then reach the backups |
| OD-3 | Cadence | **Accepted 2026-09-23 (owner: "select all best choices"); as built:** weekly full (Sun 09:17 UTC) plus daily Supabase-only dump, now computed from `backup:config.schedule` (default matches this cadence) and dispatched by cf-admin's `backup-tick` job (D-4); `db-backup.yml`'s own weekly `schedule:` line survives only as the D-5 fallback | Weekly only: RPO for Supabase becomes 7 days |
| OD-4 | Encryption | **Accepted 2026-09-23 (owner: "select all best choices"); as built (D-9):** `age`-format X25519 key pairs, generated with WebCrypto inside the cf-backup Worker; the runner holds only the public recipient | Symmetric passphrase (existing workflow): simpler, but the runner can decrypt |
| OD-5 | Early-deletion guard | **Accepted 2026-09-23 (owner: "select all best choices").** R2 bucket locks: `v1/runs/full/` 90 days, `v1/runs/daily/` 30 days, `v1/ops/` 90 days (doc 03 §4); creating the bucket and its locks stays an owner step (doc 06) | No lock: a leaked writer token could wipe history and evidence |
| OD-6 | "Non-triggerable" | **Accepted 2026-09-23 (owner: "select all best choices"), refined by D-4.** The half about the GitHub schedule alone owning it is superseded: cf-admin's *existing* five-minute tick gained one job, `backup-tick`, which computes due slots from `backup:config.schedule` and dispatches through the GitHub App — there is still **no Cloudflare cron trigger of cf-backup's own** (the account stays at 5/5). `db-backup.yml` keeps one weekly `schedule:` line only as the D-5 fallback. The console can enable/disable the schedule; Run now needs the `runs.run` capability (Owner/Vendor by default, doc 13), a cooldown and typed confirmation | Fully schedule-only: no Run now at all |
| OD-7 | Completion signal | **Accepted 2026-09-23 (owner: "select all best choices"); as built:** still pull, but reconcile is no longer a once-daily job — it is one of the chores `POST /internal/tick` runs on every five-minute call, budget-limited (C3); the runner also writes `backup_runs` transitions directly (D-6), so the row stays truthful between ticks. No inbound webhook exists | Push: a GitHub OIDC-verified callback, which would need a public route |
| OD-8 | UI model | **Accepted 2026-09-22:** an **embedded app**. cf-backup owns its console; cf-admin frames it same-origin at `/dashboard/backup` through a gateway route (doc 02) | Server-driven UI from a manifest (first draft), or a hand-built cf-admin page over RPC |
| OD-9 | ~~Storage tables~~ | **Withdrawn** with the storage move | — |
| OD-10 | Deploy gate | **Accepted 2026-09-23:** Workers Builds for cf-backup runs `npm run verify` **from day one** (the step cf-admin never completed) | Default build command (not recommended) |
| OD-11 | Migrations | **Accepted 2026-09-23 (owner: "select all best choices"); now: one table.** cf-backup itself still **owns no tables and runs no migrations of its own**; the schema artefacts are cf-admin's migration `0057` (the new `backup_runs` table, D-1/C1, plus the `/dashboard/backup` page row) and the Supabase migration for the three backup-key functions | — |
| OD-12 | Second provider | **Accepted 2026-09-23 (owner: "select all best choices").** Every run folder is also a **GitHub artifact, 14-day retention**, so losing the Cloudflare account does not lose every copy (factor B8) | R2 only |
| OD-13 | Key custody | **Accepted 2026-09-23 (owner: "select all best choices"); as built via OD-24** (the `VAULT_DB` Hyperdrive binding since 2026-09-24): private keys in **Supabase Vault**, backups in R2; only **Owner and Vendor support** can rotate, reveal or download, with a fresh sign-in, audit and a notice to the alert recipients (Settings → Alerts; both people's addresses belong there, doc 09 K-4); one offline **recovery kit** each | Offline-only keys with paper Shamir shares (earlier draft) |
| OD-14 | Readiness visibility | **Accepted 2026-09-23 (owner: "select all best choices"); as built:** the GitHub App gets **Secrets: read**, and every run's `doctor` writes `env/doctor.json` (`{schema, checks: [{id, name, ok, detail}]}`, doc 11), which the readiness panel and its System map read alongside the App's own secret-name listing | A `doctor` job only: problems surface on the next run, not before it |
| OD-15 | Drill tiers | **Accepted 2026-09-23 (owner: "select all best choices"); as built:** the local drill uses Node's built-in **`node:sqlite`** (not the `sqlite3` CLI) and `supabase/postgres:17.6.1.104` pinned by digest; **monthly** a real-path drill into a temporary D1 (`mode=drill` requires `scope=full`), with key 1's D1 access; **twice a year** a human decrypt-and-restore rehearsal stays an owner step | A real D1 drill every week |
| OD-16 | Encryption tool | **Accepted 2026-09-23 (owner: "select all best choices"); as built:** `age`-format X25519 keys, generated with WebCrypto in the Worker (D-9) | GPG |
| OD-17 | GitHub credential | **Accepted 2026-09-23 (owner: "select all best choices"); as built (D-10):** the App client lives in the Worker (`src/github/`), signs its own JWT RS256 from a PKCS#8 key, discovers the installation via `GET /app/installations`, mints tokens narrowed per call and caches each in memory for at most 50 minutes; the App id and repo coordinates are editable in the console (`backup:config.github`) | A fine-grained PAT with an expiry date; or two Apps (one more key) |
| OD-18 | Frame-header exception | **Accepted 2026-09-22 with OD-8:** responses under `/dashboard/backup/app/` carry `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`; every other cf-admin response keeps `DENY` / `'none'`. A cf-admin guard test fails if the exception ever widens | No frame: a hand-built cf-admin page (loses the standalone console) |
| OD-19 | Run evidence | **Accepted 2026-09-22 (owner requirement), reaffirmed 2026-09-23 (owner: "select all best choices"); RE-5 amended (D-2):** every execution leaves a complete, redacted, write-once evidence bundle in R2; D1 holds the settings rows **plus one small summary row per operation** in `backup_runs` (pointers, figures, a one-line error) — never the evidence or logs themselves ([11](11-run-evidence-and-usage.md)) | Summary-only records |
| OD-20 | Log readability | **Accepted 2026-09-23 (owner: "select all best choices").** Logs are stored **redacted, in plain text** (gzip), so the console can show them; the redactor also catches a registered secret embedded inside a longer base64/base64url blob (three byte-offsets, both alphabets), not only at offset 0. The backup *data* is always encrypted | Encrypt logs too: safer against a redaction miss, but only Owner/Vendor could read them, after a key reveal |
| OD-21 | Account usage source | **Accepted 2026-09-23 (owner: "select all best choices"); as built (D-12):** no Cloudflare token in the Worker. Four sources feed the usage figures: the runner's per-run meter; the runner's account snapshot with key 1 (Workers, R2, D1 datasets via GraphQL) to `usage/account.json` and `v1/usage/latest.json`; the Worker's read of cf-admin's existing hourly D1 reading (`cron-control` row); and GitHub Actions minutes **derived** from the durations of cf-backup's own job runs, because GitHub's billing API refuses App tokens. Supabase egress stays `unavailable` (OD-23) | A read-only Cloudflare token in the Worker: fresher figures, one more key |
| OD-22 | ~~A second, read-only meter App~~ | **Withdrawn 2026-09-22:** merged into OD-17's one App (narrowed read-only tokens for the meter), to keep one GitHub key | — |
| OD-23 | Supabase usage | **No account-wide Supabase token.** Each run measures database size and its own dump egress exactly; the organisation's monthly egress is recorded as *unavailable*, with a link to the usage page | A Management API token: org-wide usage, but account-wide power in a Worker |
| OD-24 | Vault access for the key screens | **Accepted 2026-09-23 (owner: "select all best choices"): the `postgres` driver over a Worker secret. Superseded as built on 2026-09-24:** a Worker cannot verify Supabase's private root CA, so key 4 (doc 12 §7) is a Hyperdrive config, `cf-backup-vault` (`sslmode verify-full` against that CA, caching off), bound as `VAULT_DB` and reached with `pg` (exact pin 8.16.3). The role still can **only EXECUTE the three backup-key functions**, over the Supavisor **transaction pooler** (port 6543) | Run on three keys, with key work done by hand (doc 12 §7.1); or a Supabase secret API key with service-role power |
| OD-25 | The key set | **Accepted 2026-09-23:** Four secrets, three providers, none in cf-admin (doc 12): one Cloudflare token in GitHub (R2 S3 keys derived from it), one Supabase reader URL in GitHub, one GitHub App key and one Supabase key-holder URL in the Worker | One token per job: narrower each, but seven or more keys |
| OD-26 | Live view transport | **Accepted 2026-09-23 (owner: "select all best choices"); as built (C7):** the runner writes a **heartbeat to R2 every 5 s** (and at every step boundary); GitHub supplies queue and step status; the console **polls** through the gateway (2 s while active, 15 s idle, paused when hidden) (doc 14) | A held-open stream (would pin two Workers per viewer and die on every deploy), or a Durable Object (needs a route the runner can reach) |
| OD-27 | Access control inside the console | **Accepted 2026-09-23 (owner: "select all best choices"); as built, with one addition:** a **23-capability catalog** in cf-backup, role defaults plus per-person grants and denies with optional expiry, in one row `backup:access`, managed by Owner/Vendor; **plus a per-person daily limit on `runs.run`** (`runGuards.manualRunsPerPersonPerDay`, default 6, bounds 1–24, doc 13 §7). **Floors:** the secret class, `keys.status`, `runs.download` and `access.manage` stay Owner/Vendor-only; audit always on; last-holder guard (doc 13) | Role floors only, no per-person grants; or cf-admin page-fragment keys (one permission system, but a cf-admin migration per new capability) |

## Decisions from the full build (2026-09-23)

These are not owner-review defaults from the original plan (the OD table above) — they are
the build's own reversible defaults (design `docs/specs/2026-09-23-full-build-design.md`
D-n), recorded here because they change what the OD table describes.

| # | Decision | Why |
|---|---|---|
| D-1 | **One new D1 table, `backup_runs`**, owned by cf-admin migration `0057` (see OD-11) | An atomic single-active-run lock, scheduled-slot idempotency, cooldowns and per-person limits by query, and a fast Runs list — none of which a settings row can give |
| D-4 | **Scheduling rides cf-admin's existing five-minute tick.** A new job, `backup-tick`, calls cf-backup `POST /internal/tick`, which computes due slots from `backup:config.schedule` and dispatches through the GitHub App. No new cron trigger (see OD-6) | The owner asked for "like Cron Control"; the account stays at 5/5 |
| D-5 | **A weekly GitHub `schedule:` fallback** (Monday 12:43 UTC) in `db-backup.yml`, which exits in seconds if a good full backup ran in the last 8 days, otherwise runs one with trigger `fallback` | Belt-and-braces against a failed cf-admin, cf-backup or GitHub App path; costs about 4 billed minutes a month |
| D-11 | **Alerts go out through the tick, not from cf-backup.** `/internal/tick` returns `alerts[]`; cf-admin's `backup-tick` job enqueues each on its existing `EMAIL_QUEUE` (`purpose: 'custom_email'`, `projectSource: 'cf-admin'`) and then acknowledges the ids that sent. cf-backup keeps **no** `EMAIL_QUEUE` binding of its own | No new binding on either side; reuses the queue and consumer cf-admin already has |
| — | **`keys.rekey` (the header re-wrap of old backups) is out of this build.** It needs ChaCha20-Poly1305, which WebCrypto lacks, so it answers **501 `not_implemented`** with that reason; retired keys stay in Vault, so old backups remain decryptable | Documented as not built, not faked |

## Budget check (Workers Free, $0 hard constraint)

| Resource | Today (measured 2026-09-21/22) | After cf-backup |
|---|---|---|
| Cron triggers (account cap 5) | cf-admin uses 2 expressions (`*/5`, `0 2 * * SUN`) | **+0.** GitHub owns the backup schedule; cf-admin's existing tick calls reconcile and the meter |
| D1 tables (RULE #0.9) | 30 in `madagascar-db` | **+0** (one `admin_pages` row and one `admin_portal_settings` row) |
| KV namespaces | 3 | **+0** |
| cf-admin env vars (RULE #0.8, 42 live) | 17 vars + 25 secrets | **±0.** The storage secrets stay (storage is not moving); the service binding is infrastructure, like `ASTRO_SERVICE`, not configuration |
| R2 storage (10 GB-month free) | 3 buckets | +1 bucket: backups ~1.3 GB/year if nothing is pruned, plus evidence ~0.1 GB/year ([10](10-free-tier-feasibility.md) §3) |
| GitHub Actions (2,000 min/month, shared by all private repos; each job rounds up to a minute) | 1,275 min/month month-to-date (owner's figures 2026-09-22), before the CI consolidation lands | +~130–190 min/month with **one job per run**; the combined target is **under 1,000**; see [10](10-free-tier-feasibility.md) §2 |
| Workers requests/logs | shared 100k req/day, 200k log events/day **account-wide** | Console page loads, one daily reconcile and the live view: about 12 live polls a minute per viewer while a run is active (the default 5 s refresh), each a `304` with no body when nothing changed, plus a log request only when the runner wrote new lines ([14](14-live-operations-view.md) §10); no public traffic at all |
| Secrets | — | **4 in total, 0 in cf-admin** ([12](12-keys-and-secrets.md)) |
| Workers Builds (Free: **1 concurrent build account-wide**, 3,000 min/month) | cf-admin + cf-astro (+ cf-chatbot) | +1 Worker project |
| Supabase egress (5 GB/month free) | app traffic | +~0.5 GB/month from the daily dump, measured per run ([11](11-run-evidence-and-usage.md)) |
| WAF rate-limit rule (1 free per zone) | — | **Not needed.** No public surface |

Sizes measured 2026-09-21: `madagascar-db` 2.2 MB, `chatbot-kb` 216 KB, `whatsapp-chatbot` 76 KB, and Supabase 17 MB on Postgres **17.6**.

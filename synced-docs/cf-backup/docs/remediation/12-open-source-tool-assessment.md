---
title: "cf-backup remediation — 12 Open-source tool assessment (adopt a tool, or remediate cf-backup)"
status: active
audience: [owner, ai, technical]
last_verified: 2026-09-27
verified_against: [code, research, live-mcp]
owner: harshil
related_code: [.github/workflows/db-backup.yml, scripts/backup/cli.ts, sql/supabase/01_backup_reader.sql]
related_docs: [README.md, 05-options-analysis.md, 07-decision-log.md, 08-industry-practice-review.md, 09-secondary-pipeline-specification.md, 11-terminology-standard.md, 13-engine-consolidation-plan.md]
tags: [cf-backup, remediation, open-source, build-vs-adopt, supabase, d1, decision]
---

# 12 — Open-source tool assessment: adopt a tool, or remediate cf-backup

> **TL;DR (non-technical):** The Owner asked whether an existing open-source project could export
> Supabase and D1 often enough to replace cf-backup, instead of repairing it. The short answer:
> **for Supabase, yes; several small projects do it. For D1, no; no maintained open-source tool
> does more than call Cloudflare's own export command.** None of them does all three things
> cf-backup needs (encryption to a key held offline, a restore check, and R2 under the existing
> secrets). Every one of them is a thin wrapper around two vendor commands: `pg_dump` and
> `wrangler d1 export`. **Recommendation: do not adopt a third-party repository as the engine.
> Build the Secondary Pipeline ([09](09-secondary-pipeline-specification.md)), about 200 lines
> that take the proven parts of these projects, and make it the permanent engine. Stop repairing
> the 8,662-line Primary Pipeline runner. Keep the console, and have it read the Secondary
> Pipeline's results.**

> **Status: decided 2026-09-27.** The Owner settled RD-15 on its default, option B
> ([07](07-decision-log.md) §0): the Secondary Pipeline is the permanent engine, and the Primary
> Pipeline's runner is retired after acceptance. The §8 questions are answered below. The work is
> [13](13-engine-consolidation-plan.md). Terms follow [11](11-terminology-standard.md).

## 1. The question and the requirements

**Question:** can an existing open-source project export Supabase PostgreSQL and Cloudflare D1
(SQLite) frequently, so that cf-backup does not have to be repaired?

Requirements are taken from the plan of record and the remediation program. They are what any
candidate has to meet:

| # | Requirement | Source |
|---|---|---|
| R1 | Supabase `public` and `supabase_migrations`, plus the 6 authentication records later (Stage 3) | [07](07-decision-log.md) RD-1 |
| R2 | All three D1 databases, including `chatbot-kb`, which contains an FTS5 (full-text) table that D1's export refuses | [09](09-secondary-pipeline-specification.md) §3.2 step 4 |
| R3 | Encryption to the **public** age key; the private key stays offline | Plan of record 09, 12; `RULES.md` rule 0.9 |
| R4 | A restore check in every run (row counts match the source) | [02](02-root-cause-analysis.md) §4 principle 1 |
| R5 | An off-site copy in R2, plus a second copy | [08](08-industry-practice-review.md) §4.1 (3-2-1) |
| R6 | $0: GitHub Actions free minutes, no always-on server | [05](05-options-analysis.md) §1 |
| R7 | The existing secrets only (`CLOUDFLARE_API_TOKEN`, `SUPABASE_DB_URL`); no S3 access keys | `RULES.md` rule 0.8 |
| R8 | The read-only export role (`backup_reader`), never `postgres` in CI | [05](05-options-analysis.md) §2.5; plan of record 12 §5 |
| R9 | Fails loudly; never reports a pass for work it did not do | [02](02-root-cause-analysis.md) P7 |

## 2. What cannot work on these platforms

Most of the well-known PostgreSQL tools need access the managed platforms do not give. They are
ruled out, whatever their quality:

| Tool | Why it cannot be used |
|---|---|
| **pgBackRest, WAL-G, Barman** | Physical backups and WAL archiving need filesystem or `archive_command` access to the server. Supabase manages the server; on the Free plan there is no way to configure WAL shipping. (Supabase itself uses WAL-G internally for its paid-plan backups.) |
| **Litestream, LiteFS, sqlite3 `.backup`, gobackup's SQLite source** | They copy or stream a SQLite **file**. D1 has no file you can reach: the only ways out are the export API (`wrangler d1 export`) and SQL queries. |
| **Supabase platform backups and PITR** | Paid plans only ($25/month and up), and the copies stay inside Supabase, so not off-site ([05](05-options-analysis.md) §2.5). |
| **D1 Time Travel** | Already active (7 days on Free). It restores in place in the same account; it is not an off-site copy ([08](08-industry-practice-review.md) §1.2 item 4). It stays as the first thing to use for an "undo" within 7 days. |

So for both stores the only realistic path is a **logical export**: `pg_dump` for PostgreSQL and
the D1 export API for D1. Every candidate below is a wrapper around those two.

## 3. Candidates

Surveyed on 2026-09-26. Star counts and activity were not recorded, because they change; check
them before adopting anything. "Fit" is against §1.

### 3.1 Supabase or PostgreSQL to R2

| Project | Shape | Encryption | Restore check | Runs in Actions ($0) | Auth / secrets | Fit |
|---|---|---|---|---|---|---|
| [backupdrill/cli](https://github.com/backupdrill/cli) | Node CLI plus an example Actions workflow; `pg_dump` (checks the major version), checksummed `manifest.json`; can also copy Storage files | **No** | **Yes**: `drill` restores into a throwaway Postgres in Docker | Yes | Needs S3 access keys (R7 ✗). Its README says a custom role "errors on any RLS-enabled table"; ours has `BYPASSRLS`, so it may work, **not tested** | **Best Supabase-only candidate.** Missing encryption and D1 |
| [cucoleadan/supabase-to-r2-backup](https://github.com/cucoleadan/supabase-to-r2-backup), [omerkaracay/supabase-to-r2-backup](https://github.com/omerkaracay/supabase-to-r2-backup) | ~55-line workflow: Supabase CLI trio (roles, schema, data), zip, `aws s3 cp` | No | No | Yes | S3 keys (R7 ✗); the Supabase CLI issues `SET ROLE postgres` (R8 ✗, defect T5) | Template only |
| [Supabase's own Actions guide](https://supabase.com/docs/guides/deployment/ci/backups) | ~30 lines; CLI trio committed to the repository | No | No | Yes | `postgres` (R8 ✗); commits plain data to git | Template only |
| [kadeksuryam/db-backup](https://github.com/kadeksuryam/db-backup) | Python; pluggable engines, stores and encryptors; **age supported**; GFS retention; download-and-verify after upload | **Yes (age)** | Checksum only, no restore | Possible (made for a container or cron) | S3 keys (R7 ✗) | Good design, small and young project; PostgreSQL only |
| [gobackup/gobackup](https://github.com/gobackup/gobackup) | Go single binary, YAML config; PostgreSQL, SQLite (file copy), 20+ stores including R2; notifiers | OpenSSL passphrase (not age) | No | Possible with `gobackup perform` | S3 keys (R7 ✗) | Mature, but its SQLite support cannot reach D1 (§2), and no restore check |
| Self-hosted UIs: Databasus (formerly Postgresus), pgbackweb, `tiredofit/docker-db-backup`, `ferdn4ndo/s3-postgres-backup`, `BigDaddyAman/pg-r2-backup` | Docker services with a scheduler, often a web UI | Some (passphrase) | No | **No**: they need an always-on host (R6 ✗) | S3 keys | Not usable at $0 without a server. Details not verified here |
| [FogMoe/supabase-r2-backup](https://github.com/FogMoe/supabase-r2-backup) | Bash plus systemd timers; manifest, checksums, read-back from R2 | No (says so) | Archive checks, no restore | No (needs a Linux host) | rclone keys | Good ideas (read-back, pinned image digest); wrong host model |

### 3.2 D1 to R2

| Project | Shape | Handles FTS5 (`chatbot-kb`) | Encryption | Fit |
|---|---|---|---|---|
| [Cloudflare's Workflow example](https://developers.cloudflare.com/workflows/examples/backup-d1/) | A Worker Workflow that calls the export API and streams the dump into R2 | No (export API refuses virtual tables) | No | Reference only; it needs a Workflow `schedules` entry, which is a Cloudflare cron (`RULES.md` rule 0.7 ✗) |
| [AutumnsGrove/Patina](https://github.com/AutumnsGrove/Patina) | A Worker with cron triggers; its own SQL exporter through bindings; 12 databases; retention | Probably, since it reads with SQL, **not verified** | No | Cron triggers (rule 0.7 ✗); an exporter written by one person is the same risk class as ours |
| [neverinfamous/d1-manager](https://github.com/neverinfamous/d1-manager) | A full D1 admin web app with scheduled R2 backups (Durable Object plus cron) | **No**, per its own wiki | No | Far too large to adopt for exports |
| [qaz741wsd856/warden-worker](https://github.com/qaz741wsd856/warden-worker) (`docs/db-backup-recovery.md`) | Actions workflow: `wrangler d1 export`, gzip, optional AES, upload to S3 or WebDAV | No | Passphrase | Template only. **Its warning is worth adopting:** keep a copy outside the Cloudflare account, since a suspended account loses the database and the R2 copy together |
| [oliwebd/d1-backup](https://github.com/oliwebd/d1-backup), [OdatNurd/sekurkopio](https://github.com/OdatNurd/sekurkopio) | Shell wrapper around the export API; a small Worker | No | No | Too small to be worth a dependency |

**The D1 conclusion:** no maintained project does more than `wrangler d1 export` already does.
The one hard case, `chatbot-kb`'s FTS5 table, is not solved by any tool that uses the export API.
The SQL-based exporters that could handle it are single-author code, which is the risk we already
have.

## 4. Why no candidate should be the engine

1. **No candidate covers both stores.** Adopting tools means one for Supabase plus a script for D1.
   The D1 part is the same ~20 lines whichever way we go.
2. **Every candidate breaks the secret model.** They all upload with S3 access keys, which adds two
   new secrets (R7). `wrangler r2 object put` uses the Cloudflare token we already have.
3. **None encrypts to an offline age key** except kadeksuryam/db-backup. Adding age is one line
   (`age -r "$BACKUP_AGE_RECIPIENT"`), so this does not justify a dependency.
4. **Almost none checks a restore** (only backupdrill). Our Primary Pipeline's restore check is one
   of the few parts that **worked** in run 5 ([01](01-post-incident-review.md) §4).
5. **Most run as `postgres`**, which we refused by design (R8). The one hidden `SET ROLE postgres`
   inside the Supabase CLI is defect T5.
6. **A dependency adds a supply chain to a job holding production secrets.** A 55-line workflow we
   own is reviewable in five minutes. A third-party CLI pulled at run time is not, unless it is
   pinned to a reviewed commit.
7. **Our failures were not "missing features".** They were a missing `mkdir -p`, D1's 5-term
   compound `SELECT` limit, and the CLI's `SET ROLE` ([02](02-root-cause-analysis.md) T1, T2, T5).
   An adopted tool would not have prevented any of them: the cure is small code run against the
   real tools, which a tool does not give us for free.

Where a candidate is still useful: **as a second, independent check.** For example, backupdrill's
`drill` could restore-test a copy once a week, from code no one on this project wrote. This is
optional and would need its own two S3 keys (§7, RD-15 option c).

## 5. What to reuse from them

The Secondary Pipeline specification ([09](09-secondary-pipeline-specification.md)) already has
most of these. The rest are small additions:

| Idea | From | In [09](09-secondary-pipeline-specification.md)? |
|---|---|---|
| `pg_dump` whose major version is at least the server's, checked before running | backupdrill, voxtranslate's workflow | Yes: the pinned 17 image (N7) |
| Session pooler (5432), never the IPv6 direct host | every Supabase repository | Yes |
| Integrity gate before upload (`pg_restore --list`, or a real restore) | voxtranslate, backupdrill | Yes: a full restore, stronger |
| Read back from R2 and compare checksums | FogMoe, kadeksuryam | Yes: step 7 |
| Checksummed manifest | backupdrill, FogMoe | Yes: `SHA256SUMS` plus `counts.json` |
| `PRAGMA foreign_keys=OFF;` before importing a `wrangler d1 export` file (tables can come out in the wrong order for their foreign keys) | warden-worker | **Add** to the D1 restore check and to `docs/RESTORE.md` |
| A copy outside the Cloudflare account | warden-worker | Partly: a 14-day GitHub artifact (the repository's maximum retention). **Consider** a third copy (Google Drive, B2) for account-loss risk |
| Supabase Storage files, not only their metadata | backupdrill | **Not in scope yet.** Supabase restores only `storage.objects` rows, not the files. Check whether staff storage still uses Supabase Storage (plan of record 04) |
| GFS retention (daily, weekly, monthly) | kadeksuryam | Covered by R2 lifecycle and lock rules (RD-12) |

## 6. Remediate the Primary Pipeline, or replace its runner?

The Owner has plans to fix the Primary Pipeline. That can be done: the defects are known and small
([04](04-defect-register.md)). The question is whether it is worth it.

| | A. Remediate the Primary Pipeline (current plan, Stage 2) | B. The Secondary Pipeline becomes the engine; retire the runner (proposed) | C. Adopt open-source tools |
|---|---|---|---|
| Code to own | 8,662 runner lines plus ~35,400 test lines, plus Pre-production Validation | ~200 lines of workflow YAML and shell, plus a small reader in the Worker | Tool config plus a D1 script plus glue |
| External programs | wrangler, Supabase CLI (to be removed), docker, `pg_dump`, age, `apt-get` | wrangler, docker (`pg_dump` in the pinned image), age | The tool, plus wrangler, age |
| Time to a daily recovery point | 3 to 5 days after the Secondary Pipeline | 1 to 2 days (the same Secondary Pipeline) | 1 to 2 days |
| New secrets | 0 (a test token for validation) | 0 | 2 (S3 keys) |
| Console | Unchanged | Reads `secondary/` in R2; "Run now" dispatches the new workflow | Would need rebuilding around the tool's output |
| Main risk | More untested layers; the cycle that failed six times | Losing console features that depend on the runner's evidence format (heartbeats, live logs, per-stage meters) | The tool's own defects; a second supply chain |
| Matches what comparable teams run ([08](08-industry-practice-review.md) §2) | No: 70 to 280 times larger | Yes, plus encryption and a restore check | Partly |

**Recommendation: B.** The data is 17 MB of PostgreSQL and 2.5 MB of D1. A ~200-line pipeline
with a real restore check is the industry norm plus two safeguards most teams skip, and it is the
part of the plan that produces a recovery point soonest. After 30 days of passing runs, the
Primary Pipeline runner (`scripts/backup/**`, `db-backup.yml`) is retired rather than repaired.
The console, the key custody, the Scheduler, the alerts and `backup_runs` stay, because they
work. They are pointed at the new workflow's results.

**When A is still the better choice:** if the Owner treats cf-backup as a product (sold to other
clients, several tenants, a per-stage evidence trail that auditors need), the runner's richer
evidence may be worth its cost. In that case, follow [06](06-remediation-plan.md) Stage 2 as
written: the Secondary Pipeline runs next to it, and nothing is retired until Pre-production
Validation passes.

**Either way, the next step is the same:** Stage 0 (the key check, stopping the failing
schedules, one manual export), then the Secondary Pipeline. Neither A nor B nor C should begin
before a verified recovery point exists.

### 6.1 Migration path for B

| Step | Change | Exit criterion |
|---|---|---|
| B0 | Stage 0 and Stage 1 exactly as in [06](06-remediation-plan.md) | A scheduled Secondary Pipeline run passes; the Owner decrypts one file |
| B1 | The Secondary Pipeline writes one `backup_runs` row at start and at finish through `wrangler d1 execute` (the table exists; migration `0057` in cf-admin) | The console's run list shows Secondary Pipeline runs |
| B2 | The console's recovery point list and freshness read `secondary/pipeline/` in R2 | Recovery Point Actual (RPA) on the console matches the bucket |
| B3 | The Scheduler's "Run now" and scheduled dispatch point at `secondary-pipeline.yml`; its own `schedule:` stays as the fallback | A dispatch from the console runs it |
| B4 | 30 days of passing scheduled runs; one restore from the bucket by a person ([06](06-remediation-plan.md) §9) | Acceptance criteria met |
| B5 | Delete `db-backup.yml`, `scripts/backup/**` and their tests; remove the console screens that only showed runner internals (heartbeat, per-stage meters); rename the workflow if RD-14 applies | `npm run verify` passes; the console shows no dead screens |

B1 to B3 relax two of [09](09-secondary-pipeline-specification.md)'s hard limits ("no console
integration", "no `backup_runs` row"). They were set to keep the interim pipeline independent,
so they should only be lifted **after** B0 passes, and each change must keep the workflow's
restore check untouched.

## 7. Proposed decision

| # | Decision | Default proposed | Alternatives | Stage |
|---|---|---|---|---|
| RD-15 | Build or adopt, and the long-term engine | **Adopt no third-party tool as the engine. The Secondary Pipeline becomes the permanent engine (§6.1, B); the Primary Pipeline runner is retired at day 30 instead of being remediated.** Changes RD-11's default ("retain both") to its "consolidate" alternative, and makes Stage 2's validation work unnecessary | (a) Keep RD-11 as it is and remediate the Primary Pipeline (§6, A). (b) Adopt backupdrill for Supabase plus a D1 script (§6, C): two new secrets. (c) B, plus backupdrill's `drill` once a week as an independent restore check from third-party code: two new secrets | Stage 5 (the day-30 decision) |

**Decided 2026-09-27: option B, the default** ([07](07-decision-log.md) §0). RD-11 moves to its
"consolidate" alternative, and Stage 2's Pre-production Validation is not built.
[13](13-engine-consolidation-plan.md) replaces [06](06-remediation-plan.md) Stages 2 to 5 and
refines §6.1 above.

## 8. Open questions (answered 2026-09-27)

1. Does anything still use Supabase **Storage** (files)? **No.** Live check: 0 buckets and 0
   objects, so nothing outside the database needs a copy. Revisit if files ever move there.
2. Is a copy **outside the Cloudflare account** wanted? **The 14-day GitHub artifact is that copy**,
   encrypted like the rest. A third location would need an account and two secrets; not now.
3. How often is "frequently"? **Daily** (RPO 24 hours). Measured runs take about 2 minutes, so
   about 60 minutes a month.

## 9. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-26 | claude | Read the remediation program 01 to 11, `main.md`, `RULES.md` | Requirements in §1 |
| 2026-09-26 | claude | Web research: the READMEs of every project in §3; Cloudflare's D1 Workflow example | §3. Not verified: star counts, the Databasus and pgbackweb details, Patina's FTS5 handling, whether backupdrill works with `backup_reader` |
| 2026-09-26 | claude | No commands run against live infrastructure | Nothing in this document comes from live checks |
| 2026-09-27 | claude | RD-15 decided; Supabase `storage.buckets` and `storage.objects` counted through the Supabase connector | §7 and §8 |

## 10. Related

- [05-options-analysis.md](05-options-analysis.md): the options already assessed. This document
  adds "adopt an open-source tool".
- [08-industry-practice-review.md](08-industry-practice-review.md) §2: the first survey of
  reference implementations.
- [09-secondary-pipeline-specification.md](09-secondary-pipeline-specification.md): the pipeline
  recommended here as the engine.
- [13-engine-consolidation-plan.md](13-engine-consolidation-plan.md): the work option B starts.

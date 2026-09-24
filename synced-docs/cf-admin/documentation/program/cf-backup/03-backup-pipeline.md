---
title: "cf-backup — 03 Backup pipeline"
status: draft
audience: [ai, technical, owner, operator]
owner: harshil
related_docs: [README.md, 02-admin-integration-contract.md, 05-security-and-compliance.md, 11-run-evidence-and-usage.md, ../../runbooks/disaster-recovery.md]
tags: [program, cf-backup, backups, r2, disaster-recovery]
---

<!-- docs-check: proposed-paths -->
<!-- This is a plan: nothing in it is built yet. It names routes, files and folders that do not exist yet, in cf-admin and in the future cf-backup repo. -->

# 03 — The backup pipeline

> **Revised 2026-09-22.** R2 layout reorganised around the run evidence policy
> ([11](11-run-evidence-and-usage.md)): each run folder now separates the backup
> (`data/`) from its proof (`verify/`), its logs (`logs/`), its resource figures
> (`usage/`), its environment (`env/`) and what cf-backup adds after the run
> (`postrun/`). Run keys carry the attempt number, so a GitHub re-run cannot collide
> with a locked folder.

## 1. Starting point (measured 2026-09-21)

cf-admin already has `.github/workflows/backups.yml`: a D1 export plus restore drill, a
Supabase `pg_dump` (Postgres 17 client, session pooler) plus restore drill, and
encryption. **It has never produced a backup.** Both runs (2026-09-15 manual, 2026-09-21
scheduled) failed because `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are unset; the
repo's only secret is `PERSONAL_PAT`. On 2026-09-22 it was rebuilt as **one job** with the
bridge fixes applied ([08](08-existing-backup-workflow.md) §8a). Output goes to GitHub
artifacts, not R2.

We **move and upgrade** this workflow; we do not rewrite from scratch. The full as-is
analysis (every job and step, run history, secrets state, the 14 gaps G1–G14, and the
bridge that gets a real backup running before cf-backup exists) is in
[08-existing-backup-workflow.md](08-existing-backup-workflow.md).

## 2. Scope: "the full DB architecture"

| Store | Size (measured) | What is captured | Notes |
|---|---|---|---|
| D1 `madagascar-db` | 2.2 MB | Full SQL export (schema + data), `d1_migrations` included | Export briefly blocks the DB. At 2.2 MB that is seconds, which is why the schedule is 03:17 local |
| D1 `chatbot-kb` | 216 KB | **Query-based export** (factor A1): `SELECT` each base table through the D1 query API, excluding the FTS table `kb_search` and its shadow tables; `kb_search` is rebuilt on restore | **Confirmed:** D1 export does not support databases containing virtual tables. Never drop the FTS table in production to make the export work |
| D1 `whatsapp-chatbot` | 76 KB | Full export | — |
| Supabase Postgres 17 | 17 MB | **`supabase db dump`, not raw `pg_dump`** (factor B1): `roles.sql` (`--role-only`), `schema.sql`, `data.sql` (`--data-only --use-copy`), plus the `supabase_migrations` schema and data pair. Includes `auth.users`, RLS policies, functions, triggers and pg_cron job definitions | **Confirmed** from Supabase's own backup/restore guides: raw `pg_dump` pulls in Supabase internals and fails on restore. Customisations to `auth`/`storage` are captured by `supabase db diff --schema auth,storage` if any exist (factor B5) |
| Supabase `vault` | — | **Excluded, documented.** Vault secrets are encrypted with a Supabase-managed key that is not in any dump, so a restore cannot decrypt them | Re-enter those secrets manually after a restore; list them in the DR runbook. The backup keys' own recovery path is doc 09 |
| KV (`ADMIN_SESSION`, `SESSION`, `ISR_CACHE`) | — | **Excluded by design.** Sessions and caches rebuild themselves | Documented so nobody "fixes" the gap |
| R2 `madagascar-staff-storage` | to measure | **Phase 4:** incremental mirror into `madagascar-backups/v1/mirror/staff-storage/` | Payroll and medical records, currently with no copy at all (MAINTENANCE S-2). Backing up the files needs no storage move |
| R2 `madagascar-images`, `arco-documents` | to measure | Phase 4 candidates (`arco-documents` is legal evidence) | — |

## 3. The workflow (`cf-backup/.github/workflows/db-backup.yml`)

> **As built (full build, 2026-09-23, C6).** The workflow has **one** trigger family, not
> two GitHub schedules: **`workflow_dispatch`**, always dispatched by the cf-backup Worker
> (manual runs and scheduled slots alike — D-4), plus **one** weekly `schedule:` line as the
> D-5 fallback. `runs-on: ubuntu-24.04`; `timeout-minutes: 90`; the pipeline's own logic is
> **TypeScript run directly by Node 24** (type stripping, no build step, D-8), under
> `scripts/backup/`.

**One job per run** ([10](10-free-tier-feasibility.md) §2.2), with independent steps:

```mermaid
flowchart TB
  T{{workflow_dispatch: scope, mode, request_id, trigger<br/>· or the D-5 weekly schedule fallback}} --> P[plan: resolve scope, run key,<br/>pinned tool versions, start the logger, meter and live heartbeat;<br/>write the backup_runs row to 'running' (D-6)]
  P --> DOC[doctor: every secret present,<br/>every credential proves itself]
  DOC --> D1S[d1 steps<br/>wrangler export ×2 + query export for chatbot-kb<br/>→ node:sqlite drill → integrity_check → compare]
  DOC --> PGS[supabase steps<br/>supabase db dump roles/schema/data<br/>→ drill in supabase/postgres:17.6.1.104 → compare]
  D1S --> SEAL["seal — always runs<br/>gzip → age-encrypt data → redact + gzip logs<br/>→ sizes, usage, env → upload to R2 run folder<br/>write the row to 'sealing' (D-6)"]
  PGS --> SEAL
  SEAL --> MAN[manifest.json + report.md<br/>written LAST: its presence means the runner finished]
  MAN --> END((done — the row's final status<br/>and figures are written; no email from GitHub))
```

Rules baked into the workflow:

1. **A missing secret is a red run, never a warning.** Every step fails fast on missing configuration.
2. **Restore drills run on the plaintext before encryption, inside the runner, in three tiers** (OD-15):
   - **Every run:** D1 into a local database opened with Node's built-in **`node:sqlite`** (as built — not the external `sqlite3` CLI; same SQLite engine family, nothing extra to install on the runner or a Windows break-glass machine, and FTS5/shadow-table introspection is verified against it), which needs no D1 write permission and makes no D1 writes. Postgres goes into a **`supabase/postgres` container pinned to the project's version by digest (`17.6.1.104`)**, because the dump expects Supabase's roles and extensions; a plain `postgres:17` drill would fail or pass misleadingly (factor B2).
   - **Monthly (first scheduled full of the month, `backup:config.schedule.drillMonthly`):** the **real-path drill**, restoring into a temporary D1 named `drill-<db>-<run id>`, created and always deleted, exactly as ADR-0001 requires. Local SQLite cannot reveal D1-specific import failures or D1's real import speed. It uses key 1 ([12](12-keys-and-secrets.md) §4), whose D1 Edit permission exists for exactly this. **As built:** the workflow input `mode=drill` requires `scope=full` — the real-path drill is a D1 drill, and `plan` rejects any other combination by name.
   - **Twice a year:** a human decrypts and restores end to end (§8 step 7, doc 09 §4).
3. **The runner holds only the public key** (OD-4). Once encrypted, even the runner cannot read its own output. Plaintext data never leaves the VM.
4. **`permissions: {}` at the top**, granted per job; third-party actions **pinned by SHA**; no `${{ inputs.* }}` inside `run:` (inputs go through `env:`); `concurrency: db-backup` so two runs never overlap.
5. **Manifest last.** Every other file uploads first, then `manifest.json`. A run folder without a manifest is by definition incomplete, and reconcile reports it as such.
6. **The cadence, dispatched, one workflow** (OD-3, superseded by D-4/D-5): `backup:config.schedule` defaults to full on `[0]` (Sunday) and Supabase-only on `[1..6]` (Mon–Sat), both at `09:17` UTC — cf-admin's `backup-tick` computes the due slot every five minutes and dispatches `workflow_dispatch` with `scope` and `request_id` set; the workflow itself no longer reads `github.event.schedule` to decide scope. `db-backup.yml` keeps exactly **one** GitHub `schedule:` line, `43 12 * * 1` (Monday), as the D-5 fallback: its first step checks D1 for an `ok` full backup in the last 8 days and exits in seconds if one exists, otherwise runs a full backup with `trigger=fallback`. Minute `:17` falls between cf-admin's `*/5` ticks, and Mexico has had no daylight saving time since 2022, so 09:17 UTC is always 03:17 in Aguascalientes.
7. **Short, separate D1 exports** (factor A2). A running export blocks that database, and the booking path writes to D1 first. Each database is exported on its own, the duration is recorded, and anything above 30 s raises a warning.
8. **Second provider** (OD-12, factor B8). The whole run folder is also uploaded as a GitHub artifact with `retention-days: 14`.
9. **`doctor` runs first, every run** (§10 P-14/P-15). It checks that every required secret exists, then proves each credential works with one harmless call: the Cloudflare token-verify endpoint, `select 1` through the pooler, an R2 `HEAD` on the bucket, the GitHub API. It also checks that `BACKUP_AGE_RECIPIENT` is a well-formed `age` recipient **and is the active key registered in `backup:key-registry`**, and that the Supabase reader **cannot** read Vault (doc 12 §5, §6). Any failure stops the run with a message naming the exact fix.
10. **`seal` always runs** (`if: always()`), so a partial failure still produces a manifest recording which path failed and why. There is never a silent half-run.
11. **Prove the ciphertext is decryptable by the right key without decrypting it** (factor B9). Each file header must carry exactly one recipient stanza, and the manifest records the recipient fingerprint. The weekly key check (doc 09 §4) confirms that fingerprint has its private key in Vault.
12. **Every step runs under the logger and the meter** ([11](11-run-evidence-and-usage.md) §3). A wrapper captures each step's full output with timestamps, its exit code, wall and CPU time and peak memory. It also records what the step consumed: D1 rows from each query's `meta`, R2 operations and bytes, and Supabase bytes received. Nothing is printed that the redactor cannot remove, and no step ever echoes row data. The same wrapper feeds the **live heartbeat** ([14](14-live-operations-view.md) §5): every 5 s and at every step change it writes the current state and a redacted log chunk to `v1/live/<runKey>/`.
13. **The runner writes its own `backup_runs` row transitions** (D-6, C1): `running` in `plan`, `sealing` at the start of `seal`, and the final status with its figures once the manifest is built — each write best-effort with retries, and each guarded so a write that already advanced the row is a no-op. **As built:** these go through the **D1 REST query endpoint** (`POST /accounts/{id}/d1/database/{db}/query`) with key 1, not `wrangler d1 execute` — same credential and permission, but parameters are bound (no SQL-literal escaping), `meta.rows_read` feeds the meter, and there is no per-query process spawn. `wrangler` itself is still used for `d1 export` and `d1 execute --file` (import, in the monthly real-path drill). A **fallback** run (D-5) or a **local break-glass** run (P-19) inserts its own row (`trigger='fallback'` / `'local'`, `gh_run_id` NULL for local), since no tick request created one first.
14. **Every export is checked for its FTS virtual table**, confirmed working end to end: `chatbot-kb`'s query-based exporter (factor A1, §2) excludes `kb_search` and its shadow tables, and the local drill (`node:sqlite`) rebuilds `kb_search` and proves it works before the run is called `ok`.

## 4. R2 layout (`madagascar-backups`, OD-2)

### 4.1 The bucket

```text
madagascar-backups/
├── README.txt                                   what this bucket is; points to the DR runbook
└── v1/                                          layout version: a v2 can coexist; readers pick
    ├── runs/                                    ── one folder per run, write-once
    │   ├── full/2026/10/<runKey>/               weekly full runs            LOCKED 90 days
    │   └── daily/2026/10/<runKey>/              Mon–Sat Supabase-only runs  LOCKED 30 days
    ├── ops/                                     ── cf-backup's own executions, write-once
    │   ├── days/2026/10/04.json                 one per UTC day: what reconcile did + account usage snapshot
    │   └── events/2026/10/04/<ts>_<kind>_<id>.json   dispatch, dispatch failure, rotate, reveal, prune, download, enable/disable
    │                                            LOCKED 90 days
    ├── indexes/                                 ── derived, rebuilt by reconcile, NOT locked
    │   ├── runs-2026.json                       one line per run: headline figures for history and charts
    │   ├── usage-2026.json                      one line per day: headline allowance figures, for trends and forecasts
    │   └── latest.json                          pointer to the newest complete run of each scope
    ├── live/<runKey>/                           ── heartbeats while a run is active (doc 14), NOT locked, deleted 7 days after the run's evidence is complete
    │   ├── state.json
    │   └── log/<cursor>.jsonl.gz
    ├── exports/activity/<timestamp>/            ── activity-log exports (doc 13 §6), NOT locked, prunable
    └── mirror/                                  Phase 4: staff-storage copies, own lock rule
```

- **Partitioned by year and month.** A console listing or a prune touches one month (one Class A `list`), and manual inspection in the dashboard stays obvious.
- **`indexes/` is derived.** It can always be rebuilt from `runs/` and `ops/`, which is why only those two are locked. The console reads one index file for a year of history instead of hundreds of folders.
- **Lock rules must match the prune schedule** ([10](10-free-tier-feasibility.md) §3): full runs 90 days, daily runs 30 days, ops records 90 days.
- **Every object carries custom metadata** (`runKey`, `kind`, `sha256`, `encrypted`, and the recipient fingerprint for data) and a correct `Content-Type`. Any file can be identified without its manifest.

### 4.2 The run key

`<YYYY-MM-DD>_<scope>_gh<run id>a<attempt>`, for example
`2026-10-04_full_gh12345678901a1`.

- **The date is the run's UTC start date** (`run_started_at` from the GitHub API). Both the runner and cf-backup can derive it, so reconcile can build the key for a run that died before writing anything.
- **The attempt number is required.** A GitHub "Re-run" keeps the run id and increments `run_attempt`. Without it, a re-run would try to write into a locked folder, and every upload would be refused.
- Keys sort chronologically within a month folder, and are unique.

### 4.3 One run folder

Each file has **one writer and is written once** ([11](11-run-evidence-and-usage.md) §2): the runner writes everything except `postrun/`, and cf-backup writes `postrun/` once, after the run.

```text
<runKey>/
├── manifest.json            index of every file below + outcomes + verdict (runner, LAST)
├── report.md                human summary, same renderer as the GitHub job summary (P-9)
├── checksums.sha256         for `sha256sum -c` on an offline restore machine
├── data/                    THE BACKUP — every file age-encrypted, nothing else in here
│   ├── d1/
│   │   ├── madagascar-db.sql.gz.age
│   │   ├── madagascar-db.schema.sql.gz.age        schema-only copy (P-5)
│   │   ├── chatbot-kb.sql.gz.age                  query-based export (factor A1)
│   │   ├── chatbot-kb.schema.sql.gz.age
│   │   ├── whatsapp-chatbot.sql.gz.age
│   │   └── whatsapp-chatbot.schema.sql.gz.age
│   └── postgres/
│       ├── roles.sql.gz.age                       supabase db dump --role-only
│       ├── schema.sql.gz.age
│       ├── data.sql.gz.age                        --data-only --use-copy
│       └── migrations-history.sql.gz.age          supabase_migrations schema + data
├── verify/                  proof the backup restores
│   ├── source-counts.json   per table, from the live source at dump time (P-3)
│   ├── restored-counts.json what the drill got back
│   ├── fingerprints.json    per table: count, max(id), max(updated_at) (factor B7)
│   ├── schema-hashes.json   per database, for the drift rule
│   └── drill.json           tier, engine, seconds (the measured RTO), problems
├── logs/                    everything that happened — redacted (doc 11 §4)
│   ├── run.log.gz           full stdout+stderr of every step, timestamped, in order
│   ├── events.jsonl.gz      one structured record per event: step start/end, warning, error, success
│   └── steps.json           per step: start, end, seconds, exit code, outcome, CPU, peak memory
├── usage/                   what this run consumed, and where the account stood (doc 11 §5)
│   ├── run-meter.json       D1 rows per query, R2 ops and bytes, Supabase bytes received, runner CPU/RAM/network/disk
│   ├── sizes.json           per file: raw, gzip and encrypted bytes, ratio, rows, tables; per database: size on the server
│   ├── supabase.json        database size against its allowance, per-table sizes, server version, connections in use
│   └── account.json         Cloudflare and Supabase allowances at the end of the run: limit, used, remaining, this run's share
├── env/
│   ├── doctor.json          pre-flight results (secret names and checks, never values)
│   └── tools.json           runner image and version, vCPUs, RAM, disk; versions of wrangler, Supabase CLI, pg_dump, age, sqlite3; container image digest
└── postrun/                 written ONCE by cf-backup after the run completes (never by the runner)
    ├── github-run.json      run, attempts, jobs and steps from the API: queue delay, durations, billed minutes (rounded up)
    ├── github-logs.zip      GitHub's own complete log archive for the run, as GitHub stores it
    ├── github-usage.json    Actions minutes and artifact storage month to date, across the private repos (doc 11 §5)
    └── postrun.json         what reconcile did, when, and anything it could not fetch (with the reason)
```

`manifest.json` (abridged):

```json
{
  "schema": "cf-backup/manifest@1",
  "layout": "v1",
  "runKey": "2026-10-04_full_gh12345678901a1",
  "scope": "full",
  "trigger": { "event": "schedule", "correlationId": null, "actor": null },
  "source": { "repoSha": "abc123", "workflow": "db-backup.yml", "runnerImage": "ubuntu-24.04/20261001.1" },
  "jobs": {
    "d1:madagascar-db": { "outcome": "ok", "tables": 30, "rows": 2425, "schemaHash": "…", "drill": "passed", "exportSeconds": 3.2 },
    "d1:chatbot-kb": { "outcome": "ok", "method": "query-export", "drill": "passed" },
    "postgres": { "outcome": "ok", "tables": 20, "schemaHash": "…", "drill": "passed" }
  },
  "files": [
    { "path": "data/d1/madagascar-db.sql.gz.age", "kind": "data", "encrypted": true, "bytes": 312004, "sha256": "…", "recipient": "age1…fp8" },
    { "path": "logs/run.log.gz", "kind": "log", "encrypted": false, "bytes": 48211, "sha256": "…", "redaction": "passed" }
  ],
  "expectedFiles": 27, "presentFiles": 27,
  "timing": { "scheduledFor": "2026-10-04T09:17:00Z", "startedAt": "2026-10-04T09:17:03Z", "delaySeconds": 3, "finishedAt": "2026-10-04T09:19:41Z" },
  "drill": { "tier": "weekly-local", "d1Seconds": 4.1, "postgresSeconds": 38.6, "problems": [] },
  "verdict": { "level": "ok", "reasons": [] }
}
```

Row counts, sizes and hashes only: **never row data**.

## 5. Verification: deterministic, replacing the "AI audit"

> **As built (full build, 2026-09-23, Ruling 11).** The runner's own verdict implements the
> 14 rows below **minus Freshness** (13 checks), plus **Export duration** and **Encryption**
> from §3 rules 7 and 11, plus `cancelled` → `failed`. **Freshness is the Worker's dead-man's
> switch**, computed from `backup_runs` on every tick (Track W), not something the runner
> itself can see; the runner's own D-5 freshness check exists only inside the fallback
> workflow step, to decide whether to run at all (§3 rule 6).

| Check | Rule | Verdict if it trips |
|---|---|---|
| Restore drill | Dump restores cleanly into an empty engine of the same major version | `failed` |
| Integrity | `PRAGMA integrity_check` = `ok` (D1); restore exits 0 with no errors (Postgres) | `failed` |
| Row-count fidelity | Restored count lies in the live `[before, after]` bracket taken around the export/dump, not a guessed hot-table tolerance | `failed` outside the bracket |
| Fingerprints | Per-table max(id)/max(updated_at) match between source and restore (factor B7) | `failed` |
| Size anomaly | Compressed size drops >30% vs the last `ok` run | `warning` (possible upstream data loss) |
| Schema drift | `schemaHash` differs from the last run | `info`, with a diff summary in `report.md` (expected after migrations) |
| Coverage | Every table in the source catalog appears in the dump | `failed` |
| Freshness | **The Worker's dead-man's switch** (Track W, every tick): no `succeeded`/`warning` `backup_runs` row of kind `backup` or `drill` within 8 days (full) / 36 h (supabase) | alert, via `/internal/tick`'s `alerts[]` (D-11) |
| Expected outputs (P-8) | Every file listed in `files[]` exists in the run folder | `failed` |
| Redaction (doc 11 §4) | The residue check finds a secret value in a log | `warning`; the log is withheld and a placeholder records why |
| Drill speed (P-4) | Drill seconds > 2× the median of the last 8 runs | `warning` (RTO regression) |
| Readiness (P-14) | `doctor` found a secret missing, a credential failing its check, or a key within 30 days of expiry | `failed` (missing / invalid) or `warning` (expiring) |
| Allowance pressure (doc 11 §5) | Any tracked allowance at ≥ 80% of its period | `warning` (never fails a backup) |
| Lateness (P-17) | `timing.delaySeconds` > 6 h, or the start fell outside 00:00–06:00 local | `info` |
| **Export duration** (§3 rule 7, as built) | A single D1 export takes > 30 s | `warning` |
| **Encryption** (§3 rule 11, as built) | A data file's header does not carry exactly one X25519 recipient stanza | `failed` |
| **Cancelled** (as built) | The run was cancelled (`runs.cancel`) | `failed` |

## 6. Status, history and alerts: one small table, everything else in R2

> **As built (RE-5 amended, D-1/D-2).** The owner accepted exactly **one** new D1 table,
> `backup_runs` (migration `0057`, C1), for the one thing R2 cannot give: an atomic
> single-active-run lock, unique schedule slots, cooldowns and per-person history by query.
> It holds one small summary row per attempt (pointers, figures, a one-line error) — never
> the evidence or logs themselves, which stay in R2 exactly as designed below.

| Need | Where it lives |
|---|---|
| Full run record | The run folder in R2: data, proof, logs, usage, environment, postrun (immutable) |
| **One row per attempt** (lane lock, transitions, figures) | **`backup_runs`** in D1 (C1) |
| What cf-backup itself did (dispatch, reconcile, key actions, prunes, failures) | `v1/ops/` in R2 (immutable) |
| History and charts | `v1/indexes/runs-<year>.json` and `usage-<year>.json` (derived, one read each) |
| "Current state" for the console and the dead-man's switch | `admin_portal_settings` key `backup:status` (one JSON row: last run, last ok, verdict, next expected, cooldown timestamps, pending/sent alerts) |
| Who pressed Run / Enable / Disable / Prune / Download / Rotate | `admin_audit_log`, written by cf-admin's gateway |
| Alerts | **As built (D-11):** cf-backup never sends mail. `/internal/tick` returns `alerts[]`; cf-admin's `backup-tick` job enqueues each on its own `EMAIL_QUEUE` and acks the ids that sent. GitHub's own failed-workflow email to the repo owner is a free second channel |

**As built:** reconcile is no longer a once-daily job — it is one of the chores that
`POST /internal/tick` runs every five minutes, inside its budget (C3). For every
`backup_runs` row without a `postrun/`, it fetches GitHub's run, job and log data and
writes `postrun/` once. It then updates `backup:status`, rebuilds the indexes, writes the
day's `ops/days` record (the once-a-day chore) and returns any alerts. The whole pass costs
a few list and get operations per tick, negligible against the Class A/B allowances.

## 7. Retention (manual, by owner rule)

- **Bucket locks** on `v1/runs/full/` (90 days), `v1/runs/daily/` (30 days) and `v1/ops/` (90 days): nothing, not even a leaked token, can delete or overwrite a run or an evidence record early. **To verify in Phase 0:** a new object can still be *created* under a locked prefix. `postrun/` depends on it (factor H3).
- Nothing auto-deletes. The console shows bucket usage (from the usage snapshot, not by listing) and offers **Prune runs older than N days**: owner-only, typed confirmation, audited, and it never touches the newest 4 `ok` full runs. A run is pruned as a whole folder, so its evidence goes with its data.
- Capacity: ~4 MB per full run and ~3.5 MB per daily run of data, plus ~0.1–0.3 MB of evidence per run. That is **~1.4 GB/year if nothing is pruned**, against 10 GB free ([10](10-free-tier-feasibility.md) §3).

## 8. Restore (summary; the runbook lands in Phase 1)

1. Pick a run in the console → **Download** (Owner/Vendor; the encrypted files stream from R2; nothing is decrypted server-side).
2. Decrypt offline with the private key (doc 09 §5); verify `checksums.sha256`.
3. D1: restore into a **new** database (never over production), point a preview binding at it, verify, then swap bindings. Postgres: restore into a new project or a local container first. For point-in-time D1 within 7 days, prefer **Time Travel** over the export.
4. **Postgres specifics** (factors B3, B6): restore with `psql --single-transaction --variable ON_ERROR_STOP=1` and `SET session_replication_role = replica` for the data file. Then reset the password of every custom `LOGIN` role, including `cf_astro_writer`, because passwords are not in any dump. Then update the secrets in each consumer Worker: cf-astro `DATABASE_URL`, and cf-admin and cf-chatbot Supabase URL/keys if the project changed. Restore Postgres before D1, then run the D1 booking/consent replay outboxes to close the gap between the two dump times. Raw bodies are PII-redacted, so that reconstruction is partial.
5. Re-apply the erasure log (`legal_requests`) to restored data before it serves traffic (doc 05 §5).
6. Realistic recovery times per scenario are in [07-factor-register.md](07-factor-register.md) §F; D1 Time Travel (in place, minutes) always beats a restore from export.
7. **Twice-yearly rehearsal**: the Owner or Vendor restores the latest run end to end every six months and records it; an untested key is no key.

## 9. Open spikes (Phase 1, before building)

| Spike | Question | Fallback |
|---|---|---|
| S-1 | ~~Does D1 export work for `chatbot-kb` with its FTS virtual table?~~ **Answered 2026-09-21: no.** The query-based exporter is the design (§2); the spike becomes "build and drill it" | — |
| S-2 | Minimum Cloudflare API token permission for D1 export | Use D1 Edit on the account; compensate with short token expiry + rotation |
| S-3 | Can a dedicated `backup_reader` role get `pg_read_all_data` on Supabase, including `auth` and `cron`? | Dump with the `postgres` role via the pooler; keep the URL only in GitHub secrets |
| S-4 | Real compressed sizes, durations and evidence sizes | Measure from the bridge and the first two runs; adjust thresholds (P-22) |
| S-5 | ~~Does the dispatch API return the run id?~~ **Answered 2026-09-21: yes**, `workflow_run_id` | — |
| S-6 | Any integer column above 2^53 in the three D1 databases (factor A3)? | If yes, add a per-column checksum to the drill |
| S-7 | Supabase project slots for a restore (2 of 2 active today) | Pause the dormant project during a restore, or restore into a wiped existing project |
| S-8 | Is **D1 Read** enough for `wrangler d1 export`? | If not, the weekly token needs D1 Edit too, and least privilege relies on its expiry and scope |
| S-9 | Does an R2 bucket lock allow **creating** a new key under a locked prefix while refusing overwrite and delete? | **Resolved by design (D-7), coded either way:** `postrun/` is written inside the run folder as designed; the reconciler falls back to the unlocked sibling prefix `v1/postrun/<class>/<YYYY>/<MM>/<runKey>/` on a 403/412, so the answer does not block the build. Still owner-verified on the real bucket (doc 06 P0.3) |
| S-10 | Can the Vite-plugin build expose job methods on the Worker's entrypoint alongside `fetch`? | **Resolved (Track W/A):** no — cf-backup exposes `/internal/tick` and `/internal/alerts/ack` as internal HTTP paths outside the gateway prefix (doc 02 §8), reached over the same `fetch` binding as the console, gated to the `backup-tick` system actor |
| S-11 | Can one account API token combine D1 Edit, Account Analytics Read and bucket-scoped R2 item write (doc 12 §4.1)? | Create it through the API with policies; if a service refuses account tokens, a user token with the same permissions |
| S-12 | Do the S3 keys derived from that token (token id + SHA-256 of its value) work for uploads to the scoped bucket, and does the verify endpoint return the id? | The R2 dashboard's own token flow, which shows the S3 pair directly (still one token) |

## 10. Operating principles adopted from the existing workflow

The chunk 6 workflow ([08-existing-backup-workflow.md](08-existing-backup-workflow.md))
never produced a backup, but not because its design was wrong. Its failure was purely
operational: secrets never set, nobody told, six silent days. So its good processes
carry over, and its failure mode drives a set of new ones. Each principle below says
where it came from.

| # | Principle | Origin | Kind | How cf-backup applies it |
|---|---|---|---|---|
| P-1 | **Error messages are instructions.** A failed check names the missing thing and the exact dashboard path to fix it | chunk 6 pre-check | as-is | Every `doctor` and step failure message follows the pattern: *what is missing → where to set it → what to re-run* |
| P-2 | **Thin YAML, tested scripts.** All logic lives in pure functions under `scripts/backup/`, with unit tests; the workflow only orchestrates | `backup_drill.mjs` + `test/backup-guards.test.ts` | as-is | `parseExportTables`, `compareCounts`, `drillSummary` are ported first, then extended: manifest builder, verdict rules, the step logger and meter, the redactor, the evidence writer (doc 11) |
| P-3 | **Counts from the live source at dump time, compared after restore; counts, not byte diffs** (D1 export promises no row order) | `backup_drill.mjs` header | as-is | `verify/source-counts.json` vs `verify/restored-counts.json` in every run folder |
| P-4 | **RTO is measured every run, not stated** | chunk 6 job summaries | as-is | `drill.d1Seconds` / `drill.postgresSeconds` in the manifest; the console charts them; a drill slower than 2× its 8-run median is a `warning` |
| P-5 | **A schema-only copy next to every full export** | `--no-data` export | as-is | `data/d1/*.schema.sql.gz.age`: the schema-drift diff reads these, and a structure-only restore needs no data |
| P-6 | **Independent paths per store** | D1 and Supabase jobs never block each other | adapted | Independent *steps* in **one job** (`continue-on-error` per store, `seal` with `if: always()`): the same resilience without paying a rounded-up minute per extra job |
| P-7 | **Cleanup always runs and prints its own manual fallback** | `d1-drill` delete step | as-is | Every temporary resource (monthly drill D1, containers) is deleted in an `always()` step that prints the exact command if it fails |
| P-8 | **A missing expected file is a failure** | `if-no-files-found: error` | adapted | The manifest's `files[]` is the expected list; `seal` fails the verdict when any is absent |
| P-9 | **One renderer, two sinks.** The job summary *is* the report | chunk 6 `$GITHUB_STEP_SUMMARY` tables | adapted | `report.md` and the GitHub job summary are rendered by the same function from the manifest, so they cannot disagree |
| P-10 | **Explicit time budgets** | `timeout-minutes` 15/30/20 | as-is | `timeout-minutes` per step + `concurrency: db-backup` |
| P-11 | **Temporary resources carry the run id and are never standing** | ADR-0001 + `madagascar-db-drill-<run>` | as-is | Monthly real-path drill `drill-<db>-<run id>` (rule 2) |
| P-12 | **The "why" lives in the file header** (PG17 client, IPv4 pooler, row order) | `backups.yml` header | as-is | Same header discipline in `db-backup.yml` and every script |
| P-13 | **Tiered drills**: weekly local, monthly real-path, twice-yearly human | the chunk 6 drill measured the *real* D1 import path | adapted | Rule 2 (OD-15). One Cloudflare token for both (doc 12 §1: the price of fewer keys, contained per §4.6) |
| P-14 | **Readiness is observable before a run fails.** Required secret *names* and their last-updated dates, token expiry, key-check age, bucket-lock presence and last-success age are shown in the console | the repo held only `PERSONAL_PAT` for six days and nobody could see it | new | `doctor` (rule 9) + the console's readiness panel (OD-14) |
| P-15 | **Existence is not validity.** Each credential proves itself with one harmless call before any dump | a set-but-wrong token would fail exactly like a missing one, one step later | new | Rule 9 |
| P-16 | **Every secret a workflow references must exist** | `production-tests.yml` names the same missing secrets and has never run green | new | A CI guard lists `secrets.X` references across all workflows and compares them with the repo's secret names; cf-admin can adopt the same guard today |
| P-17 | **Lateness is recorded, not assumed away** | the first scheduled run started 5 h 38 min late | new | `timing.delaySeconds` in the manifest; the dead-man's switch tolerates ≥ 12 h; a run starting outside 00:00–06:00 local is flagged |
| P-18 | **Measured numbers flow to their one home automatically** | the chunk 6 record asks a human to copy numbers into the runbook | new | Run folder → indexes → `backup:status` → console. The DR runbook states *targets* and links to the console for *measurements* |
| P-19 | **Break-glass from a laptop** | the same scripts are "runnable locally with a wrangler login" | adapted | `npm run backup:local -- --scope full` runs the identical pipeline on the owner's machine, encrypted to the same key, and writes the same run folder shape (trigger `local`) |
| P-20 | **The workflow itself is tested** | chunk 6 tested the helpers but not the YAML | new | Guard tests parse `db-backup.yml`: `timeout-minutes` on every step, top-level `permissions: {}`, actions pinned by SHA, no `${{ inputs.* }}` inside `run:`, `doctor` first, `seal` always, every step wrapped by the logger |
| P-21 | **Owner steps are tracked, not assumed** | chunk 6's blocker lived in a doc table row for six days | new | Every phase is a program chunk with a CHUNK-TEMPLATE record; pending owner steps appear as verification-log rows *and* on the readiness panel |
| P-22 | **The bridge's first real numbers become the baselines** | the bridge (doc 08 §7) will be the first measured run | new | Its sizes, durations and RTOs seed the size-anomaly, slow-drill and export-duration thresholds instead of guessed values |

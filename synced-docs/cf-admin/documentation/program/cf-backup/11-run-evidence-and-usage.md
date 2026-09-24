---
title: "cf-backup — 11 Run evidence, logs and usage telemetry"
status: draft
audience: [owner, ai, technical, operator]
owner: harshil
related_docs: [README.md, 03-backup-pipeline.md, 05-security-and-compliance.md, 10-free-tier-feasibility.md, 02-admin-integration-contract.md]
tags: [program, cf-backup, logs, evidence, usage, free-tier, observability]
---

# 11 — Run evidence, logs and usage telemetry

> **TL;DR (owner requirement, 2026-09-22).** Every execution leaves a **complete evidence
> bundle in R2**. That covers a scheduled or manual backup run, a local break-glass run,
> and every job or action cf-backup performs itself. The bundle holds:
>
> - the full log of every step, and **GitHub's own complete log archive**;
> - the database-side figures, and every error, warning and success;
> - the size of every file, and the resources the run consumed;
> - a snapshot of **every free allowance**: the limit, how much is used, how much is left, and this run's share.
>
> It is **redacted** (no secrets, no personal data, no row data), **written once** and
> **bucket-locked**. **None of it goes into D1.** The same data feeds a viability view that
> shows how long each free allowance will last at the current growth.

## 1. Why this exists, and why not in D1

- **Nothing else keeps it.** GitHub keeps run logs only for the repo's log retention (14 days, factor D5). Workers Logs keeps **3 days** on Workers Free (*confirmed*, Workers Logs pricing). After that, a failed run would be a red dot with no explanation.
- **A backup you cannot explain is a backup you cannot trust.** A restore drill passes or fails; the log says *why*. The resource figures say whether next year's run still fits the free tiers.
- **It is the kind of record an auditor asks for**: dated proof that backups ran, were tested and were protected. That is not a compliance claim, only the raw material for one.
- **D1 is the wrong store.** Run logs routinely exceed 100 KB. D1's write allowance is the scarcer daily resource here (peak 15% of the allowance against 3.6% for reads, *measured* 2026-09-10, per `src/workers/scheduled-usage-probe.ts`). RULE #0.9 also forbids a new table where another store fits. R2 fits: large objects, 10 GB free, and bucket locks that make the record tamper-evident.

## 2. The policy

| # | Rule |
|---|---|
| RE-1 | **Every execution leaves evidence.** Scheduled run, manual run, local break-glass run (P-19), daily reconcile, minutes meter, key rotation or reveal, prune, encrypted download, schedule enable/disable, and any dispatch that failed before a run existed |
| RE-2 | **Complete.** Every step's full stdout and stderr, exit code, timings, tool versions, warnings, errors and successes. Nothing is dropped to save space: logs are gzip-compressed instead. A single log above 50 MB uncompressed keeps its first and last 20 MB, with a marker saying what was cut, and the manifest flags it |
| RE-3 | **Nothing sensitive.** Never row data, secret values, connection strings, tokens, personal data or IP addresses (§4) |
| RE-4 | **One writer per file, written once.** The runner writes the run folder; cf-backup writes a run's `postrun/` once and each `ops/` record once. Only `indexes/` is ever rewritten. Bucket locks enforce it (doc 03 §4) |
| RE-5 | **Amended 2026-09-23 (D-2).** D1 holds the settings rows (`backup:status`, `backup:config`, `backup:access`, `backup:key-registry`, `backup:secrets-calendar`) **plus one small summary row per operation** in the new `backup_runs` table (D-1/C1): pointers (`r2_prefix`, `run_key`, `gh_run_id`), headline figures (`data_bytes`, `evidence_bytes`, `seconds`, `billed_minutes`), and a one-line, already-redacted `error_message` — never the full evidence or logs, which stay in R2 exactly as designed. cf-admin's gateway writes `admin_audit_log` for human actions, as for every portal action. No evidence goes to KV or Analytics Engine |
| RE-6 | **Every number says how it was obtained**: `measured` (read from an API, a meter or the database), `derived` (computed from measured values, with the formula named), `estimated` (with its basis) or `unavailable` (with the reason). A gap is recorded as a gap, never as zero |
| RE-7 | **Every allowance is recorded with its reading**: limit, unit, period, reset time, source URL and the date the limit was last verified, so history stays true when a vendor changes a limit |
| RE-8 | **Versioned schemas.** Every JSON file carries `"schema": "cf-backup/<name>@<major>"`. Readers accept the majors they know; changes within a major are additive |
| RE-9 | **Failure is recorded as completely as success.** `seal` always runs. If the runner dies before `seal`, reconcile still stores GitHub's archive for that run. A dispatch that fails becomes an `ops/events` record |
| RE-10 | **Readable and downloadable.** The console renders events, steps and figures, and raw logs and GitHub's archive download as files |
| RE-11 | **Evidence reports its own cost.** Each run records how many bytes and R2 operations its evidence used (§5.2) |
| RE-12 | **Evidence is pruned only with its run**, as a whole folder, never on its own |

## 3. What is recorded, and who writes it

The folder layout is owned by [03 §4](03-backup-pipeline.md#4-r2-layout-madagascar-backups-od-2); this table says what each file holds.

| File | Writer | When | Holds |
|---|---|---|---|
| `logs/run.log.gz` | runner | `seal` | Every step's full output in order, each line timestamped, with step markers |
| `logs/events.jsonl.gz` | runner | `seal` | One JSON record per event: `run.start`, `step.start`, `step.end`, `check.pass`, `check.fail`, `warn`, `error`, `upload`, `run.end` |
| `logs/steps.json` | runner | `seal` | Per step: name, start, end, seconds, exit code, outcome, CPU seconds, peak memory |
| `verify/*` | runner | `seal` | Source and restored counts, fingerprints, schema hashes, the drill record (doc 03 §5) |
| `usage/run-meter.json` | runner | `seal` | This run's own consumption, per service (§5.2) |
| `usage/sizes.json` | runner | `seal` | Every file's raw, compressed and encrypted size, rows and tables; every database's size on the server (§5.3) |
| `usage/supabase.json` | runner | `seal` | Database size against its allowance, per-table sizes, server version, connections in use, the database-side work the dump caused |
| `usage/account.json` | runner | `seal` | The account snapshot for the Cloudflare and Supabase allowances (§5.4), taken with key 1 |
| `env/doctor.json`, `env/tools.json` | runner | `seal` | Pre-flight results (names, never values); runner image, hardware and every tool version. **As built (X4), `doctor.json`'s shape:** `{ schema: 'cf-backup/doctor@1', checks: Array<{ id: string; name: string; ok: boolean; detail: string \| null }> }` — a plain, versioned list, one entry per credential or precondition `doctor` proved (§10 P-14/P-15); readers accept exactly those four fields and ignore any additive extra (`status`, `fix`) |
| `manifest.json`, `report.md` | runner | **last** | The index of every file, outcomes, verdict; the human summary (planned run files, written into each run folder) |
| `postrun/github-run.json` | cf-backup | first reconcile after the run finishes | Run, attempts, jobs and steps from the GitHub API: queue delay, durations, **billed minutes** (rounded up per job) |
| `postrun/github-logs.zip` | cf-backup | same | **GitHub's complete log archive** for the run, stored as GitHub produced it |
| `postrun/github-usage.json` | cf-backup | same | Actions minutes and artifact storage month to date, across the private repos (§5.4) |
| `postrun/postrun.json` | cf-backup | same, last in `postrun/` | What reconcile did, and anything it could not fetch, with the reason |
| `ops/days/<date>.json` | cf-backup | daily reconcile, once per UTC day | What the day's reconcile did (runs ingested, alerts sent, key-check result, errors) + the latest account figures (from that day's run, the minutes meter and cf-admin's hourly D1 reading) |
| `ops/events/<date>/<ts>_<kind>_<id>.json` | cf-backup | at each state-changing action or failure | Dispatch (with `workflow_run_id`), dispatch failure, rotate, reveal, prune, download, enable/disable, reconcile error. Built from typed fields, never from a raw request body |
| `indexes/*` | cf-backup | every reconcile (rewritten) | Headline figures per run and per day (§6) |

**Why two log sources for the same run.** The runner's own log is available the moment
the run ends, and it is scrubbed using the secret values themselves, which only the runner
knows. But it dies with the runner. GitHub's archive is the authoritative record as GitHub
saw it, including set-up and clean-up lines. It survives a crashed or timed-out runner,
already has registered secrets masked by GitHub, and costs **0 Actions minutes**, because
cf-backup fetches it, not the runner. It must be fetched before the repo's log retention
expires (14 days); **as built,** reconcile is one of the chores `/internal/tick` runs every
five minutes rather than once a day, so in practice it is fetched within minutes of the run
finishing, not after up to a day's delay. If it is ever missed, `postrun.json` records
`githubLogs: unavailable (expired)`.

**The live log, while a run is active, is a different set of files** (doc 14 §5, C7):
`v1/live/<runKey>/log/<cursor>.jsonl.gz`, redacted before upload exactly like the final
evidence. **As built (Ruling X1):** `<cursor>` is the zero-padded 8-digit cursor of the
chunk's **last** line — the same number the heartbeat's `logCursor` carries once that chunk
has uploaded — so the console can fetch only the chunks after a given cursor with one list
call (`startAfter`). Line cursors are global, 1-based and sequential across the whole run. A
chunk whose own residue check fails is replaced by one placeholder line carrying that
chunk's last cursor, so the sequence never has a gap the console cannot explain.

An event record:

```json
{"schema":"cf-backup/event@1","ts":"2026-10-04T09:17:41.203Z","level":"info","step":"d1:madagascar-db:export","event":"step.end","exit":0,"seconds":3.2,"data":{"bytes":2201600}}
```

## 4. Keeping secrets and personal data out

1. **Nothing prints data.** Dumps and exports write to files; no step prints SQL; drills print counts only. The P-20 guard tests fail on a step that pipes a dump to stdout.
2. **GitHub masks registered secrets** in its own log display and archive. Every *derived* sensitive value (for example the host or password parsed out of the database URL, a token minted mid-run) is registered with `::add-mask::` the moment it exists.
3. **Our own log files are not masked by GitHub.** Masking applies to what GitHub displays, not to files a step writes. So the runner's redactor processes every evidence file before upload:
   - it replaces each secret value in the job's environment with `***`, including its URL-encoded and base64 forms;
   - it scrubs patterns: credentials inside URLs (`scheme://user:pass@`), `Bearer` values, JWT-shaped strings, `age` secret keys, email addresses, IPv4 and IPv6 addresses;
   - **it checks for residue, and fails closed.** It searches the scrubbed file for every secret value again. On any hit, the file is **withheld** and replaced by a placeholder saying why; the manifest records `redaction: failed` and the run verdict gets a `warning`.
4. **The redactor has its own tests**, with canary secrets in every form it claims to catch (P-2).
5. **GitHub's archive is stored as GitHub produced it.** It holds nothing GitHub itself does not already keep for 14 days. It is download-only in the console, for Admin and above.
6. Logs are stored **redacted in plain text** so the console can show them (OD-20). The backup *data* is always encrypted.

## 5. Usage and allowances

### 5.1 Two kinds of figure

| Kind | Question it answers | Taken by | Exact? |
|---|---|---|---|
| **This run's consumption** | "What did this backup cost?" | The runner, with its own meter | Yes: counted as it happens |
| **Where the account stands** | "How much of each free allowance is used and left this period?" | The runner, with key 1, at the end of every run (Cloudflare, Supabase), and a run happens every day; cf-backup for GitHub minutes (hourly) and cf-admin's hourly D1 reading (live) | As exact as the vendor's analytics, which lag by minutes; each reading carries its own time |

The run's share of an account figure comes from the run's own meter, **never** from
subtracting two account readings: analytics are aggregated and delayed, and a difference
would mix in every other Worker's traffic.

### 5.2 What the run measures about itself (`usage/run-meter.json`)

| Service | Figures | How |
|---|---|---|
| GitHub runner | Wall seconds per step and in total; CPU user/system seconds; peak memory; network bytes in and out; peak disk use; container image pull size and seconds | GNU `time -v` around each step; `/proc/net/dev` and `df` before and after |
| D1 | Rows read, rows written, query count and duration, per query and per database | The `meta` block every D1 query API call returns |
| D1 export | Seconds, bytes, database size before the export | `wrangler` output and the D1 database info call. Rows read *by the export itself*: `derived` (equal to the total rows) until checked once against that day's analytics (§9) |
| Supabase | Bytes received through the pooler (this run's pooler egress), seconds, connections in use, database size before, database-side work (`pg_stat_database` counters before and after) | Measured on the runner; `pg_database_size`; `pg_stat_activity`; `pg_stat_database` |
| R2 | PUT, HEAD and GET counts (Class A and B), objects and bytes written | Counted by the uploader |
| GitHub artifacts | Bytes uploaded as the second copy (OD-12) | The upload step |
| Evidence overhead | Bytes of logs, usage, env and verify files next to the data bytes | Computed at `seal` (RE-11) |

### 5.3 Sizes (`usage/sizes.json`)

- **Per file:** logical name, raw (uncompressed) bytes, gzip bytes, encrypted bytes, compression ratio, rows, tables, sha256.
- **Per database:** size on the server (D1 database info; `pg_database_size`), tables, total rows, and the ten largest tables by size and by rows.
- **Totals:** data bytes, evidence bytes, whole-folder bytes.

### 5.4 The account snapshot (`usage/account.json`, `postrun/github-usage.json`, `ops/days/<date>.json`)

**Which allowances are tracked, and how each is read.** The limit *values* live in one
place: cf-backup's allowance catalog in code (each entry with its source URL and
verified-on date), mirrored for humans by [10 §1](10-free-tier-feasibility.md). They are
not restated here.

| Service | Allowance | Period | How it is read |
|---|---|---|---|
| D1 | Rows read, rows written (account) | UTC day | GraphQL `d1AnalyticsAdaptiveGroups`, the query cf-admin's usage probe already runs hourly (`src/workers/scheduled-usage-probe.ts`) |
| D1 | Storage per database and account total | total | D1 analytics or database info (*to verify*) |
| R2 | Storage per bucket and account total | month (GB-month) | The R2 bucket usage endpoint, already used by cf-admin's analytics provider (`src/lib/analytics/providers/cloudflare.ts`). This also replaces the `wrangler r2 bucket info` figure that reads 0 B (doc 10 §3) |
| R2 | Class A and Class B operations | month | GraphQL R2 operations dataset (*to verify*) |
| Workers | Requests (account), errors, CPU per Worker | UTC day | GraphQL Workers invocations dataset, as cf-admin's analytics provider already queries it |
| Workers KV | Reads, writes, deletes, lists | UTC day | GraphQL KV operations dataset (*to verify*). Writes are the scarcest KV allowance |
| Queues | Operations | UTC day | Queues metrics endpoint, already used by cf-admin's analytics provider |
| Workers AI | Neurons | UTC day | *To verify* |
| Workers Builds | Build minutes | month | *To verify* whether an API exposes it; otherwise `unavailable` |
| GitHub Actions | Minutes per repo and account total, against the 2,000 allowance and the under-1,000 target | billing month | The GitHub App's tokens narrowed to Actions: read (doc 12 §6): per-job durations rounded up, the way GitHub bills; the per-run billing field returns 0 (*measured*, doc 10 §2.4) |
| GitHub artifacts | Storage used | account | The same tokens: sum of unexpired artifact sizes across repos |
| Supabase | Database size | total | `pg_database_size` from the latest run's `usage/supabase.json` |
| Supabase | Egress | billing month | **`unavailable` by design** (OD-23): each run's own pooler egress is measured (§5.2); the organisation's total lives on the Supabase usage page, which needs an account-wide token to read |

Each entry has the same shape. **As built (Ruling X3): `readings[].used` is in the unit of
the matching allowance's own entry in cf-backup's planned allowance catalog**
(`src/usage/allowances.ts`, cf-backup repo, not this one) — for example GB for R2 storage,
MB for Supabase database size, raw counts (rows, operations, minutes) everywhere else —
never a unit the reader has to infer:

```json
{
  "service": "cloudflare.d1", "metric": "rowsWritten", "scope": "account",
  "limit": { "value": 100000, "unit": "rows", "period": "day-utc", "resetsAt": "2026-10-05T00:00:00Z",
             "source": "https://developers.cloudflare.com/d1/platform/limits/", "verifiedOn": "2026-09-21" },
  "used": 6480, "remaining": 93520, "percent": 6.5,
  "thisRun": 0,
  "how": "measured", "readAt": "2026-10-05T02:10:04Z",
  "status": "ok"
}
```

`status` is `ok` below 60%, `watch` from 60%, `alert` from 80%. An `alert` on any
allowance is a run warning and an email (doc 03 §5). It never fails a backup.

### 5.5 Staying inside Free limits while measuring

- **One GraphQL request carries several datasets** (D1, R2, Workers, KV together), so a snapshot is a handful of calls.
- **The minutes meter works in batches** of at most 20 runs per invocation, hourly, until it has caught up, because a Worker invocation on Free gets 50 external subrequests. A running monthly tally lives in `indexes/`.
- **The account snapshot is taken once per run, by the runner** (a run happens every day). Console page views and the live view read the latest figures; they never trigger a snapshot.

## 6. Indexes, trends and the viability view

- `indexes/runs-<year>.json`: one line per run, with run key, scope, verdict, data and evidence bytes, rows, step and drill seconds (RTO), billed minutes and start delay.
- `indexes/usage-<year>.json`: one line per day, with each allowance's used, percent and status.
- **The viability view** (console, Phase 3) is computed on read from those two files, and needs no new storage:
  - each allowance's trend, and the date it would reach 80% at its last 30-day and 90-day growth rate;
  - database growth and backup-size growth;
  - Actions minutes month to date against the under-1,000 target;
  - R2 bytes against 10 GB.
- The tripwires in [10 §6](10-free-tier-feasibility.md) become computed warnings instead of things someone has to remember to check.

## 7. What the console shows

Access floors from [02 §6](02-admin-integration-contract.md#6-permissions-cf-admin-opens-the-door-cf-backup-decides-the-action) apply: all of this is Admin and above; encrypted data downloads are Owner/Vendor only.

| Screen | Content |
|---|---|
| Run detail | Verdict and reasons; file table (sizes, ratio, rows); drill and RTO; step timeline; **resource receipt** (this run's consumption beside the account's position at the time); log viewer (events filtered by level and step, raw log download, GitHub archive download) |
| Usage | Every tracked allowance as a bar, with its period, reset time, status colour and source label (`measured` / `derived` / `estimated` / `unavailable`) |
| Live | What is running right now, step by step, with the live log ([14](14-live-operations-view.md)) |
| Operations | Daily records and events: what cf-backup did, when, and for whom |
| Viability (Phase 3) | §6 |

## 8. What all this costs

| Resource | Cost | Basis |
|---|---|---|
| R2 storage | ~0.1–0.3 MB of evidence per run → ~35–100 MB/year; ops records ~5 MB/year; indexes under 1 MB | Estimates until the first runs measure them (S-4, P-22) |
| R2 operations | ~25 Class A per run + a few per day → ~10k/year, against 1M/month free | Uploads, `postrun/` writes, reconcile |
| GitHub Actions minutes | Seconds per run for the logger, meter and redactor | GitHub's archive and the account snapshot are fetched by cf-backup, not the runner |
| Workers | One daily reconcile and a few hourly meter calls | I/O-bound: streamed files and small JSON |
| D1 | One row written per reconcile (`backup:status`) | RE-5 |

## 9. To verify when building

- GraphQL dataset names and fields for R2 operations, KV operations, D1 storage, Workers AI neurons and Workers Builds minutes. Only the D1 analytics query is proven in this codebase today.
- Whether a D1 export's own reads appear in the day's rows-read figure, and how many. Measure once and record it.
- Whether a service-binding call shares its caller's subrequest budget (factor A4). The batch sizes above assume it might.
- The size of GitHub's log archive for a one-job run, and that `run_started_at` is present on the run object (doc 03 §4.2).
- That GNU `time` is on the runner image (install it if not).
- That the R2 lock lets `postrun/` be created under a locked run folder (doc 03 spike S-9).

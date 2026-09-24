# Diagnostics, pre-flight checks and a simpler storage layout

- **Status:** Approved 2026-09-24; being built (see Build log). It is built in four stages, in the order of B8. Until the Build log at the end of this document says a stage has shipped, that stage is **not built yet**. "How it works today" describes the live system; every other section describes the plan.
- **Who it is for:** Part A is for everyone, including staff who do not write code. Part B is for engineers and gives the exact technical design.
- **Where it came from:** the owner asked for three things:
  1. a way to test every step of the backup flow and see each part's health, response time and result;
  2. a pre-flight check that stops a backup or drill as soon as anything is wrong;
  3. fewer, better-organised folders in the backup storage.

---

## Part A: for everyone

### A1. The problems in one paragraph each

**We cannot test the system on demand.** The console's Readiness page shows whether each part looks ready. It reuses results for up to a minute (five for the key vault), times nothing, and has no "test it now" button. The only way to prove the whole chain works today is a real run.

**A broken run is caught too late.** A run happens in two places:
- the backup service (a Cloudflare Worker) decides to start it;
- GitHub's computers (the "runner") do the work.

The runner checks its own access at the start, but by then GitHub has already started the job and counted its minutes. On 2026-09-24 a drill stopped after 47 seconds because the encryption key was not set. The failure was correct, but it still used an Actions minute and left 17 files in a folder that cannot be deleted for 90 days. The Worker could have spotted the missing key before asking GitHub to start anything.

**The storage has too many folders.** One backup file sits eight folders deep, for example:
`v1 / runs / full / 2026 / 09 / <run> / data / d1 / madagascar-db.sql.gz.age`.
The top level has eight folders. Each run adds five more inside it.

### A2. How a backup travels today

| # | Step | What happens | Who does it |
|---|---|---|---|
| 1 | Trigger | A scheduled slot comes due (a 5-minute timer run by the admin app), or a person presses **Run now** | Admin app, a person |
| 2 | Guards | Checks the person's permission, the 6-hour cooldown between manual backups, the limit of 6 manual runs per person per day, and that no other run is active | Worker |
| 3 | Dispatch | Asks GitHub, through the GitHub App, to start the backup workflow | Worker, GitHub |
| 4 | Runner start | GitHub starts a machine, which plans the run and installs its tools | GitHub runner |
| 5 | Doctor | The runner checks its access: the Cloudflare token, the D1 databases, R2 storage, the Supabase database, that the key vault refuses it, the key list, and the tools | GitHub runner |
| 6 | D1 export | Copies the three D1 databases (weekly full backup only) | GitHub runner |
| 7 | Restore drill | In drill mode, restores the copy into a scratch database and compares the two | GitHub runner |
| 8 | Supabase export | Copies the Supabase database: roles, structure, data and migration history | GitHub runner |
| 9 | Seal | Encrypts the copies to the backup key, uploads them with the evidence, and writes the checksums and, last of all, the `manifest.json` that marks the run complete | GitHub runner |
| 10 | Reconcile | The 5-minute timer reads the manifest and records the result and its verdict | Worker |
| 11 | After-run copy | Copies GitHub's own record of the run (details, usage, logs) into the run's folder | Worker |
| 12 | Alerts | Raises alerts. The admin app sends the emails. | Worker, admin app |
| 13 | Console | The Live, Runs, Files, Usage and Alerts pages show the result | Worker |

A **weekly full** backup copies D1 and Supabase. A **daily** backup (Monday to Saturday) copies Supabase only. A **drill** adds step 7. A **check** runs every export and drill but keeps no data and never counts as a backup.

### A3. What will change

#### A3.1 A Diagnostics page

A new page, **Diagnostics**, in the backup console at `/dashboard/backup/diagnostics`:

- **Layout:** it follows the steps of the table above, in order. Under each step is a list of tests.
- **Each test shows:**
  - a result: **Pass** (green), **Warn** (amber), **Fail** (red) or **Skipped** (grey, with the reason);
  - the **response time** in milliseconds, coloured amber when slower than normal;
  - a one-line **result**, for example "HTTP 200 · workflow active" or "key f782… active";
  - for a Warn or Fail, **what went wrong** and a **How to fix** line;
  - a **Details** button that opens the full response, with secrets hidden.
- **Run all** runs every test, and each step also has its own **Run again** button. Results fill in step by step as they arrive.
- **Steps only a real run can prove** (exporting, encrypting, the drill) show that step's result from the most recent run, with its date. A button starts a real test when you want one.
- **History:** the page keeps the last 20 test runs and shows a small response-time trend for each test, so a service getting slower is visible before it fails.
- **Activity:** every test run is recorded in Activity: who ran it and when.
- **Nothing on a timer:** tests run only when someone presses a button, or automatically just before a real run (see A3.2). Nothing on the page runs every minute.

**Three test levels**, so each question costs no more than it needs:

| Level | What it proves | Cost | How long |
|---|---|---|---|
| **Quick test** | every service the Worker talks to: D1, R2 (writes, reads back and deletes a small test file), the key vault, the GitHub App (sign-in, workflow, key variable, secrets present, permissions), the 5-minute timer, the email records | free | about 2 to 4 seconds |
| **Runner test** | what only GitHub's machine can reach: the Cloudflare token and the D1 export, the Supabase login, uploading to R2, the encryption key, the tools | about 1 of the 2,000 free GitHub minutes a month | about 1 minute |
| **Full check** (exists today) | every export and restore drill, with no data kept | about 6 GitHub minutes | about 6 minutes |

#### A3.2 Pre-flight: a run stops at the first sign of trouble

**Before GitHub is asked to start anything** (Run now and scheduled runs alike), the Worker runs the relevant quick tests:
- a backup key is active;
- GitHub's key variable matches that key;
- both GitHub secrets exist;
- the GitHub App has the permissions it needs;
- the workflow is switched on;
- enough GitHub minutes and storage remain for this kind of run;
- storage accepts writes;
- no other run is active.

**If any test fails, the run does not start and no GitHub minute is used.**
- With Run now, the dialog shows which test failed and how to fix it.
- With a scheduled run, an alert appears on the dashboard and is emailed, the same as a failed backup.

**On GitHub's machine**, the doctor step becomes the **runner pre-flight**. By default, any failed check stops the whole run before a single database is copied, as the owner asked. A setting can switch back to today's behaviour, "skip only the broken part". That way, when Supabase is unreachable, the D1 databases are still backed up.

**A run stopped by the runner pre-flight writes only three small files** (its record, the pre-flight results and its log), not 17.

**Warnings never stop a run.** A slow response, or an allowance above 80%, is shown in the results and the run continues.

#### A3.3 Simpler storage folders

**Today:**
```
v1/
├── runs/full/2026/09/<run>/            (plus runs/daily/…)
│   ├── manifest.json, report.md, checksums.sha256
│   ├── data/d1/…   data/postgres/…     (the encrypted backup)
│   ├── verify/  logs/  usage/  env/  postrun/
├── checks/2026/09/<run>/
├── ops/days/2026/09/…   ops/events/2026/09/24/…
├── indexes/  live/  usage/  postrun/  exports/
```

**Proposed:**
```
backups/
├── full/2026-09/<run>/                 kept 90 days, cannot be deleted sooner
└── daily/2026-09/<run>/                kept 30 days, cannot be deleted sooner
checks/2026-09/<run>/                   checks and runner tests (never backups)
ops/2026-09/24/                         the day's record and events, kept 90 days
system/                                 working files: live view, caches, exports, test files

inside every <run>/:
    manifest.json   report.md   checksums.sha256
    data/        every encrypted backup file, no subfolders
    evidence/    everything else (checks, logs, counts, usage, GitHub's record), no subfolders
```

- **Fewer levels:** a backup file goes from **8 folder levels to 5**, and the top level from **8 folders to 4**.
- **Three separations stay, on purpose:**
  - **full vs daily**, because they are kept for different lengths of time;
  - **`data/`**, because it holds the only encrypted files and downloading them needs a separate permission;
  - **the month folder**, so the console reads one month at a time and not the whole bucket.
- **Nothing needs moving.** No real backup exists yet: both runs so far were test drills that stopped early.
  - The old `v1/` folder stays readable as "Old layout" until its protection ends (about late December 2026), and is then removed.
  - Runs already recorded keep working, because each run's record stores its own folder.

### A4. What it costs

Everything stays inside the free allowances:

| Allowance | Free limit | What this design uses |
|---|---|---|
| GitHub Actions minutes | 2,000 a month, shared by the three repositories | Runner test: about 1 minute each time you press it. The pre-flight inside a real run adds seconds, not minutes, because it is a step in the same job. |
| Worker external calls | 50 per call to the Worker | Each Diagnostics step is its own call, and the largest (GitHub) needs about 8 |
| Worker calls to Cloudflare services (D1, R2, key vault) | 1,000 per call to the Worker | A few per step |
| Key vault connection (Hyperdrive) | 100,000 queries a day | 2 or 3 per quick test |
| R2 operations | 1 million writes/lists and 10 million reads a month | A handful per test |
| GitHub API | 5,000 requests an hour for the App | About 8 per quick test |

### A5. What people need to do

- **Owner:** approve this design. Afterwards:
  - review the written plan;
  - allow three new storage-protection rules to be added before the new layout is switched on (Claude runs the commands);
  - press **Run all** once on the new page.
- **Staff with the new permission:** use **Run all** when something looks wrong, and read the red rows' **How to fix** lines. Without the permission, you can still see the results.
- **Nobody** needs to change anything in GitHub, Supabase or Cloudflare for Diagnostics or pre-flight.

### A6. Questions people will ask

- **Can a test delete or change a backup?** No. The only file a test writes is a small test file in `system/`, which it deletes straight away. Backups sit under storage rules that block deletion, even by the system itself.
- **Will testing use up our free allowance?** The quick test is free. The runner test uses about one GitHub minute each time. It is limited to a few a day, and the page says what it costs before you press it.
- **What if GitHub or Supabase is down?** That step shows Fail with the reason, and the other steps still run. A scheduled backup that stops at pre-flight raises an alert, and the next slot tries again.
- **Why not test every few minutes automatically?** It would spend the free allowances on nothing and hit rate limits. The test that matters runs automatically, right before every real run.
- **Will the old folders disappear?** Yes, but only once their protection period ends (about late December 2026). Until then they appear in Files as "Old layout".

### A7. Words used here

- **Worker:** the backup service that runs on Cloudflare. It starts runs, reads results and serves the console.
- **Runner:** the GitHub machine that does the heavy work of a run: exporting, encrypting and uploading.
- **D1:** Cloudflare's databases; three are backed up.
- **Supabase:** the main Postgres database; it is backed up.
- **R2:** Cloudflare's file storage, where backups are kept.
- **Key vault (Vault):** where the private half of the backup key is stored. It is reached through **Hyperdrive**, Cloudflare's secure database connection.
- **Lock (protection rule):** an R2 rule that blocks deleting or overwriting files in a folder for a set number of days.
- **Manifest:** the file written last in a run. When it is present, the run finished and every file is listed in it.
- **Pre-flight:** tests that run before the real work and stop it if something is wrong.
- **Drill:** a practice restore that proves a backup can be restored.
- **Check:** a full run that keeps no data; it proves the pipeline works.
- **Actions minute:** a unit of GitHub's free monthly allowance. Each job is rounded up to the next whole minute.

---

## Part B: for engineers

### B1. Findings about the current system (2026-09-24)

**Readiness** (`src/readiness/*`, `GET /api/readiness`, capability `usage.view`):
- live checks are wrapped in `cachedCheck()`, with `CHECK_TTL_MS = 60_000` and `VAULT_CHECK_TTL_MS = 300_000`;
- `?refresh=1` is throttled to once every 10 s per isolate;
- the System map is a pure builder over the checks;
- the connector board reads doctor history and 7 days of ops events;
- the GitHub App permission self-check is `app-permissions.ts`;
- **no check records a duration**: only `checkedAt`.

**Subrequest budgeting:**
- `src/tick/budget.ts` has `TICK_WALL_MS = 20_000`, `TICK_EXTERNAL = 30` and `HARD_EXTERNAL = 45`, plus an internal budget;
- only the tick uses it; the API path relies on caches.

**Dispatch guards** (`src/backups/start.ts`), in order:
1. capability (router);
2. configuration (App key, BACKUPS, DB);
3. body validation;
4. cooldown: `runGuards.runNowCooldownHours`, default 6, backups only;
5. per-person daily limit: `manualRunsPerPersonPerDay`, default 6, with a separate counter for checks;
6. lane lock (D1 partial-unique-index insert);
7. `workflow_dispatch`;
8. ops event.

The business-hours window only shows a notice in the dialog; the server does not enforce it.
- **Scheduled path** (`src/tick/schedule.ts`): with no active key, Supabase slots are skipped and the weekly full slot becomes `mode=check`.
- **Manual path:** has no equivalent key guard.

**Runner pipeline** (`scripts/backup/lib/pipeline.ts`):
- **Steps:** `plan → tools → doctor → d1 → d1-real-drill → postgres → seal → cleanup`, in one job (`.github/workflows/db-backup.yml`, 90-minute timeout).
- **Doctor:** `scripts/backup/lib/doctor.ts` computes per-stage gates (`d1`, `postgres`, `encrypt`, `upload`). It does not halt the whole run, which is deliberate: a Supabase outage still lets D1 back up.
- **Check mode:** doctor downgrades encrypt-only failures to warnings.
- **Seal:** uploads `manifest.json` last, as the completion signal.

**How the Worker learns the result:** `src/tick/reconcile.ts` uses, in order of preference:
1. the manifest;
2. a fresh heartbeat;
3. the GitHub API.

A run is lost when GitHub has finished but no manifest appears within 30 minutes, or after 6 hours with no contact. `src/tick/postrun.ts` copies GitHub's record once the run has finished.

**Evidence from production:**
- **The 2026-09-24 05:12Z drill** ended with `doctor_failed`: "variable BACKUP_AGE_RECIPIENT: not set". It took 47 s and was billed 1 minute. It left 17 of 27 expected files under `v1/runs/full/…`, where they are locked for 90 days.
- **The 04:00Z drill** ended `no_manifest` (lost).
- **Correction (2026-09-24):** an earlier draft reported a text-encoding bug in those failure reasons. There is none. D1 stores the section sign as the bytes `C2 A7`, which is correct UTF-8; the garbled text came from a Windows terminal decoding the query output.

**Layout code:**
- **Run folders:** `src/backups/run.ts` (`runFolder`, `checkFolder`, `parseRunKey`, `folderForRow`). The runner imports this file directly.
- **File list:** `src/backups/wire.ts` (`expectedRunFiles`).
- **Files browser rules:** `src/files/keys.ts` and `src/files/layout.ts` (`folderMeaning`, `DOCUMENTED_LOCK_RULES`).
- **Other prefixes** are built in `src/lib/ops.ts`, `src/tick/postrun.ts`, `src/report/cache.ts`, `src/backups/prune.ts`, `src/tick/usage-meter.ts`, `src/tick/daily.ts`, `src/api/activity-export.ts` and `src/tick/live-cleanup.ts`.
- **Duplicates:**
  - `liveStateKey` is defined twice;
  - the usage key has two names;
  - the `v1/live/` literal appears three times.
- **Tests that pin the layout:**
  - `test/files-layout.test.ts`, `test/files-keys.test.ts`, `test/ui-files-route.test.ts`;
  - `test/runner/restore-doc.test.ts`, which checks that `docs/RESTORE.md` names every data path;
  - `test/runner/check-mode.test.ts`.
- **cf-admin:** `backup_runs.r2_prefix` is free text with no constraint, and cf-admin never parses it. The one coupling is the 80-character, one-segment `SUB` pattern for Files deep links, which `src/ui/files-route.ts` mirrors.

**Lock rules live today** (from `wrangler r2 bucket lock list`):
- `v1/ops/`: 90 days;
- `v1/runs/daily/`: 30 days;
- `v1/runs/full/`: 90 days.

The only lifecycle rule aborts incomplete multipart uploads after 7 days.

**Platform facts this design relies on:**
- **Workers Free:**
  - 50 external subrequests and 1,000 subrequests to Cloudflare services per invocation. D1, R2, Hyperdrive and service bindings all count against the 1,000.
  - CPU: 10 ms per request.
  - `Date.now()` and `performance.now()` advance only across I/O. Bracketing an awaited call therefore measures its latency accurately in production, but not in `wrangler dev`.
- **Hyperdrive Free:** 100,000 queries a day, resetting at 00:00 UTC. Every statement counts, and the first query after idle pays a pool warm-up.
- **R2:**
  - LIST, PUT and COPY are Class A: 1 million free a month. GET and HEAD are Class B: 10 million free a month.
  - There are no real folders: the "folders" are prefixes shown with a delimiter.
  - There is no rename: a rename is copy then delete.
  - Bucket locks are prefix rules. They also apply to objects written before the rule existed, and they block delete and overwrite.
- **GitHub Actions:**
  - Billing is per job, rounded up to the whole minute, so a separate pre-flight job costs at least one extra minute. A first step in the same job costs seconds.
  - A GitHub App installation gets 5,000 requests an hour or more.
  - `::error::` annotates but does not fail a step; the step must exit non-zero.

### B2. The probe library (one source of truth)

**Module:** `src/diagnostics/`. Three consumers use it:
- the Diagnostics API;
- the Worker pre-flight gate;
- Readiness, which may show a probe's last latency.

```ts
type ProbeStatus = 'pass' | 'warn' | 'fail' | 'skipped';
type FlowStep =
  | 'trigger' | 'guards' | 'dispatch' | 'runner' | 'doctor' | 'd1' | 'drill'
  | 'postgres' | 'seal' | 'reconcile' | 'after-run' | 'alerts' | 'console';

interface ProbeResult {
  id: string;            // stable, e.g. 'r2.canary'
  step: FlowStep;
  status: ProbeStatus;
  ms: number | null;     // latency of the awaited I/O, measured with Date.now() around it
  summary: string;       // one line, e.g. 'HTTP 200 · workflow active'
  detail?: unknown;      // redacted response excerpt (never a secret, key, token or connection string)
  fix?: string;          // one line: what to do when status is warn or fail
  at: string;            // ISO time
}

interface Probe {
  id: string;
  step: FlowStep;
  label: string;                  // plain words shown in the UI
  cost: { external: number; internal: number };
  warnMs: number;                 // latency above this reads Warn
  run(ctx: ProbeContext, signal: AbortSignal): Promise<Omit<ProbeResult, 'at'>>;
}
```

**Rules:**
- **Timeout:** every probe gets an `AbortSignal` with an 8 s timeout. When it trips, the probe fails with "no answer within 8 s".
- **Retries:** a network error (not an HTTP 4xx) is retried once before the probe reads Fail, so one dropped packet cannot halt a scheduled backup.
- **Latency** is measured around the awaited I/O only, never around CPU work.
- **Redaction:** detail excerpts pass through one function that removes:
  - tokens and JWTs;
  - `Bearer` values;
  - connection strings;
  - age secret keys;
  - anything matching the docs-mirror credential patterns.
- **Budgets:** each step runs in its own Worker invocation and declares its cost. A step whose declared external cost is over 20 is rejected at build time, by a unit test over the catalogue.
- **Default latency thresholds** (`warnMs`):
  - D1: 300 ms;
  - R2: 500 ms;
  - key vault: 1,000 ms (it includes the pool warm-up);
  - GitHub: 1,500 ms;
  - the service-binding round trip: 300 ms.

  These are code defaults, shown on the page next to each probe.

### B3. Probe catalogue

**Costs:** "ext" counts external subrequests and "int" counts calls to Cloudflare services. Every GitHub call is external.

| id | Step | What it calls | Pass means | Warn | Fail | ext / int |
|---|---|---|---|---|---|---|
| `tick.age` | trigger | D1: `backup:status.lastTickAt` | tick within 15 min | 15–60 min | older than 60 min | 0 / 1 |
| `schedule.next` | trigger | config + clock | next slot computed | schedule off | config unreadable | 0 / 1 |
| `d1.ping` | guards | D1 `SELECT 1` | answers | slow | error | 0 / 1 |
| `d1.settings` | guards | the 5 `backup:*` setting rows | all parse | a row missing (code defaults in use) | a row unparseable | 0 / 1 |
| `d1.lane` | guards | `backup_runs` active rows | none active | a run is active (on the Diagnostics page) | a run is active (in a pre-flight) | 0 / 1 |
| `keys.active` | guards | D1 `backup:key-registry` | one active key | kit not confirmed recently | no active key (backup and drill) | 0 / 1 |
| `vault.list` | guards | Hyperdrive: `backup_key_list()` | answers, and the active key is listed | slow | error, or the active key is missing from Vault | 0 / 1 |
| `vault.refusal` | guards | Hyperdrive: read `vault.decrypted_secrets` | refused (42501) | — | readable (a privilege leak) | 0 / 1 |
| `gh.token` | dispatch | mint the installation token | token minted | slow | error | 1 / 0 |
| `gh.workflow` | dispatch | `GET …/actions/workflows/db-backup.yml` | `state: active` | — | missing or disabled | 1 / 0 |
| `gh.permissions` | dispatch | installation permissions | all needed are granted | an extra permission is granted | a needed one is missing | 1 / 0 |
| `gh.recipient` | dispatch | `GET …/actions/variables/BACKUP_AGE_RECIPIENT` | equals the active key's recipient | — | not set, or does not match | 1 / 0 |
| `gh.secrets` | dispatch | `GET …/actions/secrets` (names and dates only) | both present | one updated over 11 months ago | one missing | 1 / 0 |
| `gh.runs` | runner | the last 5 workflow runs | reachable | the last run failed | error | 1 / 0 |
| `gh.minutes` | runner | the meter tally in R2 + config | enough left for this run type | over 80% used | not enough for this run | 0 / 1 |
| `gh.rate` | dispatch | `GET /rate_limit` (free) | over 20% remaining | under 20% | under 2% | 1 / 0 |
| `r2.list` | seal | list `backups/` (limit 1) | answers | slow | error | 0 / 1 |
| `r2.canary` | seal | PUT, HEAD, GET, compare, DELETE `system/diagnostics/canary-<id>` | round trip matches | slow | any step fails | 0 / 4 |
| `r2.headroom` | seal | usage readings vs the 10 GB free tier | room for 3 more runs of this kind | under 3 | under 1 | 0 / 1 |
| `runner.last` | doctor, d1, drill, postgres, seal | the latest run's `evidence/doctor.json` and `steps.json` | the steps passed | the steps warned | the steps failed (with date) | 0 / 2 |
| `reconcile.last` | reconcile | `backup_runs` newest row | finalised with a verdict | still running for longer than expected | lost or stuck | 0 / 1 |
| `postrun.last` | after-run | newest run's after-run files | present | not yet (still in its window) | missing after its window | 0 / 1 |
| `alerts.delivery` | alerts | D1 `email_audit_logs`, newest alert rows | delivered | accepted, not yet delivered | bounced or refused | 0 / 1 |
| `binding.roundtrip` | console | measured by the browser | answers | slow | error | — |

**What the probes cover:**
- **The whole GitHub step** costs about 8 external subrequests.
- **Runner-only facts** (Cloudflare token validity, D1 export permission, Supabase login, the runner's R2 credentials, the encrypt trial) are reported by `runner.last` from the most recent run, or proven now by the runner test (B6).
- **The Worker never holds** `CLOUDFLARE_API_TOKEN` or `SUPABASE_DB_URL`. It can see only that they exist and when they were last updated.

### B4. Diagnostics API and page

**Routes:**
- `GET /api/diagnostics`: capability `usage.view`, the same as Readiness. Returns the probe catalogue (labels, steps, thresholds, costs) and the last 20 stored runs.
- `POST /api/diagnostics/run`: body `{ step: FlowStep }`, capability `diagnostics.run`. Runs one step's probes and returns their `ProbeResult[]`.
  - **Throttle:** once every 15 s per person per step, on top of the router's usual limits.
  - **Audit:** `diagnostics.run`, recording the step and the counts of pass, warn and fail.
- `POST /api/diagnostics/runner`: capability `diagnostics.run`. Dispatches the runner test (B6).
  - **Limits:** it uses the check-mode counter and the per-person daily limit, and is capped at 5 a day overall.
  - **Refused** while any run is active.

**New capability:** `diagnostics.run`, class `operate`, "Run diagnostics tests (the runner test uses about one GitHub Actions minute)". It is in the Owner and Vendor support defaults. It is added to the catalogue with its `known` handling, so stored policies treat it as a new id.

**History:**
- It is stored in a new settings row, `backup:diagnostics`, holding the last 20 runs.
- Each run is compact: `{at, by, steps: {step: [{id, s, ms}]}, errors: [{id, summary}]}`. That is well under 64 KB.
- `BackupSettingKey` and the readiness key list gain this key.

**Page layout:**

```
Diagnostics                                   [Run all]  [Runner test · ~1 min]
Last run 11:42 by owner · 21 pass · 1 warn · 0 fail · 3.1 s total

▸ 1 Trigger            ● pass   2 tests    18 ms                          [Run again]
▾ 3 Dispatch           ▲ warn   6 tests   1.9 s                           [Run again]
    ● GitHub sign-in (installation token)   412 ms   token minted
    ● Workflow db-backup.yml                  201 ms   active
    ▲ Secrets present                         188 ms   CLOUDFLARE_API_TOKEN updated 11 months ago
         How to fix: rotate the Cloudflare token (Settings → Secrets calendar shows its date)
    ● Key variable matches the active key     176 ms   f782… = f782…
    …   ▁▂▂▃▂▂▁ trend of the last 20 runs
▸ 6 D1 export          ● pass   last run 2026-09-28 04:03 (from the run's evidence)
…
```

**UI rules:**
- **Existing components:** the page uses the console's cards, the StatePill tones (pass, warn, fail and skipped), the data table, and `NotAvailable` for anything unmeasurable. No new design system.
- **Section registration:** it registers like every section, in `SECTIONS`, `TAB_CAPABILITY` (`usage.view`) and the routing. Its URL is `/dashboard/backup/diagnostics`.
- **Real data only:**
  - a step never run shows "Not tested yet";
  - a probe that cannot run shows Skipped with the reason;
  - no placeholder numbers.

### B5. Worker pre-flight gate

**Where:** in `src/backups/start.ts`, **after body validation, cooldown and the daily limit, and before the lane-lock insert**. A refused run therefore never takes the lane.

**The probes by mode:**

| Mode | Probes |
|---|---|
| backup (daily, full) | `keys.active`, `vault.list`, `gh.token`, `gh.workflow`, `gh.permissions`, `gh.recipient`, `gh.secrets`, `gh.minutes`, `r2.canary`, `r2.headroom`, `d1.lane` |
| drill | the backup list, with `r2.headroom` for a full run |
| check | the backup list without `keys.active`, `vault.list` and `gh.recipient`, because a check encrypts nothing |

**Outcomes:**
- **Only `fail` halts.** `warn` results travel with the run: they are shown in the dialog, and recorded in the ops event.
- **A halted manual run** returns `409 { code: 'preflight_failed', failed: ProbeResult[] }`, and the Run now dialog lists each failure with its fix.
- **A halted scheduled run:**
  - writes the ops event `preflight.halted`;
  - raises the existing "Failed, missed or undispatched backups" alert, which cannot be switched off;
  - retries at the next slot.
- **No `backup_runs` row is created for a halted run.** This matches today's refused dispatch.
- **Cost:** about 8 external subrequests. The scheduled path runs inside the tick's `Budget`. When the tick lacks the budget, it defers the slot to the next tick; it does not skip the pre-flight.
- **This closes the manual path's missing key guard.**

### B6. Runner pre-flight and the runner test

**Policy setting:** `runGuards.preflightPolicy`, either `'halt'` (the default) or `'skip-part'`.
- **`halt`:** any doctor `fail` sets every gate to false:
  - no export runs;
  - `seal` writes only `manifest.json` (status failed, `error_code: preflight_failed`), `evidence/preflight.json` and `evidence/run.log.gz`;
  - the job exits non-zero, so GitHub marks it failed.
- **`skip-part`:** today's per-stage gates.

**Doctor gains four checks:**
1. **The trial encrypt:** age-encrypt a 32-byte random buffer to the recipient, and check the output header.
2. **The R2 canary with the runner's own credentials:** PUT, HEAD and DELETE `system/preflight/canary-<runKey>`.
3. **`pg_dump` version:** its major version must be at least the server's.
4. **Free disk space:** at least 3 times the previous run's data size.

**The runner test:** a new `mode=preflight` for `db-backup.yml`.
- It runs `plan → tools → doctor → seal(minimal)`, writes to `checks/<YYYY-MM>/<runKey>/`, and takes about 1 billed minute.
- It never counts as a backup or a check for freshness, cooldown or prune.
- **Recording:** its `backup_runs` row is marked by its `r2_prefix`, the same way checks are, until cf-admin adds a `kind` value for it. It shows in Runs as "runner test (no data)".

**No encoding fix is needed:** see the correction in B1.

### B7. Storage layout v2

**Prefixes:**

| Prefix | Content | Written by | Lock |
|---|---|---|---|
| `backups/full/<YYYY-MM>/<runKey>/` | weekly full backups and drills | runner (+ Worker after-run files) | 90 days (new rule) |
| `backups/daily/<YYYY-MM>/<runKey>/` | daily Supabase backups | runner (+ Worker) | 30 days (new rule) |
| `checks/<YYYY-MM>/<runKey>/` | checks and runner tests | runner (+ Worker) | none |
| `ops/<YYYY-MM>/<DD>/` | `day.json` + `events/…json` | Worker | 90 days (new rule) |
| `system/live/<runKey>/` | live state and log pages | runner, Worker | none (7-day cleanup) |
| `system/indexes/…` | report caches, prune plans, minutes tally | Worker | none (rebuildable) |
| `system/usage/latest.json` | the runner's account snapshot | runner | none |
| `system/exports/activity/…` | Activity exports | Worker | none |
| `system/postrun-fallback/…` | after-run files when a run folder refuses them | Worker | none |
| `system/diagnostics/`, `system/preflight/` | canaries, deleted at once | Worker, runner | none |

**Inside a run folder:**
- the root holds `manifest.json`, `report.md` and `checksums.sha256`;
- **`data/`** has no subfolders:
  - `d1-<db>.sql.gz.age`;
  - `d1-<db>.schema.sql.gz.age`;
  - `postgres-roles.sql.gz.age`;
  - `postgres-schema.sql.gz.age`;
  - `postgres-data.sql.gz.age`;
  - `postgres-migrations-history.sql.gz.age`;
- **`evidence/`** has no subfolders. It holds everything the runner wrote under `verify/`, `logs/`, `usage/` and `env/`, plus the Worker's after-run files, under their existing names.
  - Where two names would collide, a name gains a prefix, for example `github-run.json`.
  - Each file still has exactly one writer (RE-4).

**Code changes:**
- **One layout module** `src/backups/layout.ts` builds every prefix. It replaces the builders listed in B1 and removes the duplicates (`liveStateKey`, the usage key, the `v1/live/` literals).
- `run.ts`, `wire.ts`, `seal.ts`, `files/keys.ts` and `files/layout.ts` import it.
- `isBackupDataKey` keys off `/data/` under `backups/` (and `v1/runs/` for old runs).
- `isCheckPrefix` and `NOT_A_CHECK_SQL` match both `checks/` and `v1/checks/`.
- `folderMeaning` keeps its `v1/` rules under an "Old layout" label, and gains the v2 rules.
- **Readers** already use `backup_runs.r2_prefix` per row, so old runs open as before.

**Switch-over, in order:**
1. Add the three lock rules, `backups/full/` for 90 days, `backups/daily/` for 30 days and `ops/` for 90 days, with `wrangler r2 bucket lock add`. Confirm them with `wrangler r2 bucket lock list`.
2. Deploy the new writer while no run is active. The first run after the deploy writes v2.
3. Update `docs/RESTORE.md`: the `PREFIX=` line and every data path. Extend `test/runner/restore-doc.test.ts` so it also checks the `PREFIX=` line against `layout.ts`. Today that line is untested.
4. Update the stale plan-of-record docs 03 §4 and 11 §2–3 to the real layout, including `checks/` and `system/`.
5. From about 2026-12-23, when the last `v1/` lock ends, prune `v1/` and remove its three lock rules.

**Out of scope:** copying the old objects. They are test drills, not backups, and copying locked objects would only duplicate them.

### B8. Rollout order and risks

**Order:**
1. **Probe library and Diagnostics page** (B2 to B4).
2. **Worker pre-flight gate** (B5).
3. **Runner pre-flight policy, the runner test and the encoding fix** (B6).
4. **Layout v2** (B7), after the Files-page work that is in progress has landed. Both touch `src/files/*`.

**Each stage** passes `npm run verify` and is deployed by Workers Builds before the next starts.

| Risk | Mitigation |
|---|---|
| A transient network error halts a scheduled backup | one retry per probe; only `fail` halts; the next slot retries; the alert says which probe failed |
| The pre-flight itself exceeds the tick budget | the declared costs are summed against `Budget` before running; a slot without budget is deferred, never skipped silently |
| Runner tests spend the minutes allowance | a cap of 5 a day; the cost is shown on the button; the minutes appear on the Usage page |
| The key vault query budget | 2 to 3 queries per quick test, against 100,000 a day |
| The new layout goes live before its lock rules | switch-over step 1 comes first, and the deploy note names it; the Readiness lock row lists the documented rules for comparison |
| `RESTORE.md` falls out of date | the extended restore-doc test fails `verify` when a path or the prefix drifts |
| Two editors working in the same checkout | commits stage explicit paths only; a failure in files outside this work is reported, not edited |

### B9. Tests

- **Every probe:**
  - pass, warn, fail, timeout and one-retry paths, against the existing fakes (`test/fakes/{d1,r2,github,vault}.ts`);
  - redaction of each credential shape in `detail`.
- **Catalogue:** each step's declared external cost is at most 20, and every probe has a label, a step and a threshold.
- **Pre-flight gate:**
  - a single `fail` refuses dispatch with `409 preflight_failed` and takes no lane lock;
  - `warn` still dispatches;
  - the per-mode probe lists are as in B5;
  - on the scheduled path, a halted slot raises the undispatched alert.
- **Runner:**
  - `halt` gates every stage false on any doctor fail, and seal writes exactly the three files;
  - `skip-part` keeps today's behaviour;
  - `mode=preflight` writes under `checks/`;
  - the workflow guard tests cover the new mode input.
- **Layout:**
  - `expectedRunFiles` under v2;
  - `folderMeaning` for both layouts;
  - `isBackupDataKey` at every depth in both;
  - the check SQL matches both prefixes;
  - the restore-doc test covers the `PREFIX=` line.
- **UI:**
  - the Diagnostics section renders stored results only;
  - a run with no data shows "Not tested yet";
  - the CSS coverage test includes the new classes.

### B10. Defaults chosen (the owner can change any)

| Decision | Default | Alternative |
|---|---|---|
| Runner pre-flight policy | halt the whole run on any fail | skip only the affected part |
| Latency warn thresholds | D1 300 ms, R2 500 ms, Vault 1 s, GitHub 1.5 s, binding 300 ms | settings-configurable later |
| Probe timeout | 8 s, one retry on network errors | — |
| Runner tests per day | 5 | — |
| History kept | last 20 test runs | — |
| Run permission | `diagnostics.run`, Owner and Vendor support | grant it per person on the Access page |
| View permission | `usage.view` (same as Readiness) | — |
| Layout top level | `backups/`, `checks/`, `ops/`, `system/` (no version folder; the format version lives in `manifest.json`) | keep a `v2/` folder |

---

## Build log

### Stage 1: the probe library and the Diagnostics page (2026-09-24, commits `5491f72` and `7159680`)

The second commit is the review's fix round: reasons and fixes are now stored, and the page words below match it.

Built: B2, B3 and B4, less the runner test. Not built yet: the pre-flight gate (Stage 2), the runner test and the runner pre-flight (Stage 3), and the new storage folders (Stage 4).

#### For everyone

- **Where it is:** the backup console's **Diagnostics** section, between Readiness and Access, at `/dashboard/backup/diagnostics`. The Readiness page links to it: "Test every step now → Diagnostics". Anyone who can open Readiness can open Diagnostics.
- **How to use it:**
  - **Run all** tests the eight steps of the backup flow, one after another. Each step's results appear as soon as that step answers. It takes a few seconds.
  - **Run again**, on each step, tests that step alone. One person can test the same step about once every 15 seconds.
  - Only one test runs at a time: while Run all or Run again is working, every button waits, and the steps still to come say "Waiting its turn in Run all".
  - If Run all loses its connection part-way (a network error, or an error page from the gateway), it stops there and says "Run all stopped at <step>; the steps after it were not tested." Each later step then says its result is older and was not tested by that run.
  - Both buttons need the **Run Diagnostics tests** permission (`diagnostics.run`). Owner and Vendor support have it. Without it you see every stored result, with its reason and How to fix line, but no buttons.
  - A step with a warning or a failure opens by itself. Click a step's name to open or close it.
- **Reading a row:**
  - **Result:** a shape and a word, never colour alone: ✓ **Passed** (green), **!** **Warning** (amber), ✕ **Failed** (red), **?** **Skipped** (grey, and the row says why). A step's own pill shows its worst test.
  - **Response time:** in milliseconds. An answer slower than that test's set limit is amber and says "slow", with the limit.
  - **What it found:** the one-line answer. **Details** opens the full answer, with secrets removed.
  - **How to fix:** a line under a warning, a failure or a skip, when the test knows the fix.
  - **Trend:** a small line of that test's last 20 response times, so a service that is slowing down shows before it fails.
  - **Not tested yet:** nobody has tested that step yet. It is never shown as a pass.
- **What Run all costs:** nothing. It uses no GitHub Actions minutes, and it stays well inside the free Cloudflare and GitHub allowances (about 8 GitHub API calls). It writes one small test file in storage, away from the backups, and deletes it at once.
- **Nothing runs by itself.** The page only reads until someone presses a button. Every test run is recorded in Activity as `diagnostics.run`: who ran which step, and how many tests passed, warned or failed.
- **The summary line** at the top counts the latest result of each step, and says how old the newest and oldest of them are. They can come from different runs.
- **What is kept, and for how long:**
  - **Stored for everyone who can open the page** (the last 20 runs of each step): each test's result and time, and for every test that did not pass (a warning, a failure or a skip) its reason and its How to fix line. So these are still there after a reload, and people without the run permission see them too. A very long reason or fix is cut to 300 characters.
  - **Kept only in the browser tab that ran the test:** the one-line answer of a test that passed, and **Details**. They stay while you move between sections, and are gone after a page reload.
- **If the page cannot read the latest stored results,** it keeps showing what it had, with a note saying so.
- **Two more cards:**
  - **Last pre-flight of a real run:** empty until Stage 2 ships.
  - **Console connection:** how long this page's own request took, there and back, measured by your browser. It is only that number: the page does not judge it slow or normal.

#### For engineers

- **Routes:**
  - `GET /api/diagnostics`, capability `usage.view`: returns `DiagnosticsView`, which holds the steps, the probe catalogue (label, step, `warnMs`, cost), the stored history, `lastPreflight` (null until Stage 2) and `canRun`.
  - `POST /api/diagnostics/run { step }`, capability `diagnostics.run`: runs that step's probes one after another and returns `DiagnosticsStepResult` (`results: ProbeResult[]` and `saved`). It is audited as `diagnostics.run` with the step and the pass, warn, fail and skipped counts.
  - **Throttle:** the same person asking for the same step again within 15 s gets `429 rate_limited`. It is best effort: the mark lives in the memory of one Worker instance, so a request served by another instance is not throttled.
- **Permission:** `diagnostics.run`, class `operate`, in the Owner and Vendor support defaults. Viewing needs `usage.view`, the same as Readiness.
- **History:**
  - It is stored in the settings row `backup:diagnostics` (schema `cf-backup/diagnostics@1`).
  - Each entry is one step run: `{ at, by, step, results: [{ id, s, ms }], errors: [{ id, summary, fix? }] }`.
  - `errors` holds every result that is not a pass (warn, fail and skipped), with its summary and, when the probe gave one, its fix. Both are already redacted, and each is cut to 300 characters (`STORED_TEXT_MAX`); the response keeps the whole text. A pass's summary and every `detail` are not stored.
  - `fix` is optional, so rows written before it existed still parse; the schema stays `@1`.
  - Entries are newest first, at most 20 per step.
  - They are appended by a fail-soft compare-and-swap: a lost entry never fails the step, and `saved` says whether it was kept.
- **Probe rules:**
  - an 8 s timeout, and one retry on a network error or a 5xx;
  - a pass slower than the probe's `warnMs` becomes a warn;
  - every summary, fix and detail goes through `redactText`, and the detail is capped at 2 KB;
  - each step declares at most 20 external subrequests.
- **The page:** `src/ui/screens/DiagnosticsScreen.tsx`, with `ProbeRow`, `LatencyTrend` and the pure helpers in `src/ui/diagnostics-view.ts`.
  - This visit's live answers, the per-step notes, what is running and where the last Run all stopped live in the console state (`useConsole`), not in the screen, so a section switch keeps them.
  - One action at a time: `runExclusive` sets an in-flight flag before the first request, so a second Run all or Run again answers `busy` without sending anything.
  - Run all calls the steps in sequence, so the history row's compare-and-swap never races itself, and reads the history once at the end. An answer with no error code (the session ended, no connection, a gateway error page) stops it; a refusal with a code, such as `rate_limited`, does not; `runStepsInOrder` returns the step it stopped at and the steps it did not test.
  - A failed re-read of `GET /api/diagnostics` keeps the previous answer on screen, with a note; only a first read that fails shows an error.
  - The Console connection card times `GET /api/diagnostics` with `performance.now()` and shows only that number.
- **The probes, by step, and what a pass proves:**

| Step | Probe | A pass proves |
|---|---|---|
| Trigger | `tick.age` | the 5-minute tick has run recently |
| Trigger | `schedule.next` | the schedule reads and has a next slot (warn: every slot is off) |
| Guards | `d1.ping` | D1 answers (warn over 300 ms) |
| Guards | `d1.settings` | every `backup:*` settings row is stored (warn: one is missing and code defaults are in use) |
| Guards | `d1.lane` | no run is active (on this page an active run is a warn) |
| Guards | `keys.active` | one backup key is active (warn: its recovery kit was not confirmed recently) |
| Guards | `vault.list` | the key vault answers through Hyperdrive and holds the active key (warn over 1 s) |
| Guards | `vault.refusal` | the key holder cannot read other vault secrets (a fail means a privilege leak) |
| Dispatch | `gh.token` | the GitHub App can get an installation token (warn over 1.5 s) |
| Dispatch | `gh.workflow` | the backup workflow exists and is active |
| Dispatch | `gh.permissions` | the App holds every permission the console needs |
| Dispatch | `gh.recipient` | the repository's encryption-recipient variable matches the active key |
| Dispatch | `gh.secrets` | the runner's repository secrets exist, by name and date only (warn: one is old) |
| Dispatch | `gh.rate` | over 20% of the GitHub API hourly allowance is left |
| Runner | `gh.runs` | GitHub's newest backup run is reachable and did not fail |
| Runner | `runner.last` | the runner's last doctor record passed |
| Runner | `gh.minutes` | this month's Actions minutes cover a run (warn: 80% used) |
| Storage | `r2.list` | R2 answers (warn over 500 ms) |
| Storage | `r2.canary` | a small test file is written, read back byte for byte and deleted |
| Storage | `r2.headroom` | the bucket has room for 3 more runs within the 10 GB free tier (from the last Usage reading) |
| Reconcile | `reconcile.last` | the newest run was finalised, or is still in contact |
| After-run | `postrun.last` | the newest GitHub run's after-run copy was written |
| Alerts | `alerts.delivery` | the last alert email was delivered |

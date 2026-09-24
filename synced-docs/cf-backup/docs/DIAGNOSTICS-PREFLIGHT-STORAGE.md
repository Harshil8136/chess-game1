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
| **Runner test** | what only GitHub's machine can reach: the Cloudflare token and the D1 export, the Supabase login, uploading to R2, the encryption key, the tools | about 1–2 of the 2,000 free GitHub minutes a month (to be measured) | about 1–2 minutes |
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
| GitHub Actions minutes | 2,000 a month, shared by the three repositories | Runner test: about 1–2 minutes each time you press it (to be measured). The pre-flight inside a real run adds seconds, not minutes, because it is a step in the same job. |
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
- **Will testing use up our free allowance?** The quick test is free. The runner test uses about 1–2 GitHub minutes each time. It is limited to a few a day, and the page says what it costs before you press it.
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
- **Doctor:** `scripts/backup/lib/doctor.ts` computes per-stage gates (`d1`, `postgres`, `encrypt`, `upload`). Since Stage 3 (see the Build log), any failed check stops every store by default, before a byte is exported. The setting `runGuards.preflightPolicy: 'skip-part'` keeps the per-stage gates, under which a Supabase outage still lets D1 back up; until Stage 3 that was the only behaviour.
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

**New capability:** `diagnostics.run`, class `operate`, "Run diagnostics tests (the runner test uses about 1–2 GitHub Actions minutes)". It is in the Owner and Vendor support defaults. It is added to the catalogue with its `known` handling, so stored policies treat it as a new id.

**History:**
- It is stored in a new settings row, `backup:diagnostics`, holding the last 20 runs.
- Each run is compact: `{at, by, steps: {step: [{id, s, ms}]}, errors: [{id, summary}]}`. That is well under 64 KB.
- `BackupSettingKey` and the readiness key list gain this key.

**Page layout:**

```
Diagnostics                                   [Run all]  [Runner test · ~1–2 min]
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

| Mode | Probes, asked in this order |
|---|---|
| backup (daily, full) | `d1.lane`, `keys.active`, `vault.list`, `gh.token`, `gh.workflow`, `gh.permissions`, `gh.recipient`, `gh.secrets`, `gh.minutes`, `r2.canary`, `r2.headroom` |
| drill | the backup list (a drill is a full backup plus one step) |
| check | the backup list without `keys.active`, `vault.list` and `gh.recipient`, because a check encrypts nothing, and without `r2.headroom`, because it keeps no data |

**Outcomes:**
- **Only `fail` halts.** `warn` results travel with the run: they are shown in the dialog, and recorded in the ops event.
- **A halted manual run** returns `409 { ok: false, code: 'preflight_failed', message, details: { failed, warned } }`: the lists are under `details.failed` and `details.warned`, each a `ProbeResult` with its label. The Run now dialog lists each failure with its fix.
- **A halted scheduled run:**
  - writes the ops event `preflight-halted`, once per slot;
  - raises one alert per slot, `preflight:<slot>`, of the "Failed, missed or undispatched backups" type, which cannot be switched off. It stays open until the slot starts or is recorded as skipped;
  - is retried at every tick while its grace window lasts, not at the next slot. If the window ends first, the usual skip record and alert carry the last pre-flight's reason.
- **A busy lane is not a halt** on the scheduled path: the tick checks the lane before the pre-flight, and the slot waits (`busy-retry`) as it always has, with no alert.
- **No `backup_runs` row is created for a halted run.** This matches today's refused dispatch.
- **Cost:** the declared cost is 17 for a backup or a drill (12 for a check), because the code declares each D1 and R2 call as external too; of those, about 8 are real GitHub subrequests, plus one Vault connection for a backup or a drill. The scheduled path weighs the declared sum against the tick's `Budget`. When the tick lacks the budget, it defers the slot to the next tick; it does not skip the pre-flight.
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
3. **Runner pre-flight policy and the runner test** (B6). There is no encoding fix: see the correction in B1.
4. **Layout v2** (B7), after the Files-page work that is in progress has landed. Both touch `src/files/*`.

**Each stage** passes `npm run verify` and is deployed by Workers Builds before the next starts.

| Risk | Mitigation |
|---|---|
| A transient network error halts a scheduled backup | one retry per probe; only `fail` halts; the next tick retries while the slot's grace window lasts; the alert says which probe failed |
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

### Stage 2: the Worker pre-flight gate (2026-09-24, commits `623c92a`, `d7c9791`, `04edc96` and `3b97b10`)

The first commit puts the gate on runs started by hand, and the second is the review's fix round for it. The third puts the same gate on scheduled slots, and the fourth is that part's fix round: the Alerts page now tracks a stopped slot's alert until the slot starts or is skipped, and each stopped slot writes one ops record, not one per tick.

Built: B5. Not built yet: the runner test and the runner pre-flight (Stage 3), and the new storage folders (Stage 4).

#### For everyone

- **What it does:** before cf-backup asks GitHub to start a backup, a restore drill or a check, it runs the quick tests that kind of run needs. If one fails, nothing starts: no GitHub minute is used and no file is written. This happens for runs started by hand (Run now, Run now without the cooldown, Start drill, and Run now's Check only) and for scheduled runs alike.
- **What stops a backup or a restore drill:**
  - no backup key is active;
  - the key vault cannot be reached, or does not hold the active key;
  - GitHub's key variable (`BACKUP_AGE_RECIPIENT`) is not set, or does not match the active key;
  - one of the two repository secrets is missing;
  - the GitHub App cannot get a token, or lacks a permission it needs;
  - the backup workflow is switched off, or missing;
  - not enough GitHub Actions minutes are left this month for this run;
  - storage does not accept a small test write;
  - storage has no room left for another run of this kind;
  - another run is still active.
- **What stops a check:** the same list without the key, key vault, key variable and storage-room tests. A check encrypts nothing and keeps no data.
- **What you see when a run you started is stopped:**
  - the dialog stays open and says "Pre-flight stopped this run before GitHub was asked to start it. Nothing started, and no GitHub minute was used.";
  - it lists each failed test with a **✕ Failed** mark, its name, what it found and a **How to fix** line;
  - warnings found at the same time are listed under the failures;
  - an **Open Diagnostics** button takes you to the full tests.
- **Warnings never stop a run.** A secret that is getting old, or minutes over 80% used, is a warning. When a run starts with one, a card under the Now bar says "Started with pre-flight warnings" and lists them, until you dismiss it.
- **When a scheduled run is stopped:**
  - it is not started, and it is tried again at every tick (every 5 minutes) until its grace window ends (6 hours by default). Once the problem is fixed, the next tick starts it as usual;
  - **one alert per slot** is emailed, however many ticks it is stopped: "Scheduled … did not start: pre-flight failed". It names each failed test, what it found and how to fix it. It is a "Failed, missed or undispatched backups" alert, which cannot be switched off;
  - the **Alerts** page shows that alert as open, "retried at each tick until the slot's grace window ends", until the slot either starts or is recorded as skipped. Either way it then says which, and the run's own alerts, or the skip alert, take over;
  - if the grace window ends while it is still stopped, the slot is recorded as skipped and alerted, as before. That alert also gives the reason from the last pre-flight, when the newest pre-flight cf-backup ran (by hand or by the schedule) was this slot's own. If another pre-flight ran after it, the skip alert does not repeat the reason, which the slot's own pre-flight alert already gave;
  - a slot that finds another run still active simply waits, as it always has. That is not a pre-flight failure, and it raises no alert.
- **The time limit:** the whole pre-flight stops after **7 seconds**, so a refusal reaches the console well before its connection gives up. A test it did not reach in time counts as failed: "ran out of time".
- **The Diagnostics page** now fills its **Last pre-flight of a real run** card. It shows the newest pre-flight, by hand or by the schedule, whether it passed, and each test that failed or warned. A scheduled slot stopped by pre-flight says the schedule tries again while its grace window lasts.
- **What it costs:** no GitHub minutes. A pre-flight makes about 8 GitHub API calls, opens the key vault once (not for a check), reads the database a few times, and writes one small test file to storage and deletes it at once.

#### For engineers

- **Where:**
  - `startManualRun` (`src/backups/start.ts`): after the cooldown and the daily limit, before the lane-lock insert;
  - `dueSlot` (`src/tick/schedule.ts`): after the lane check and the run kind, before the insert.
  - Both call `runPreflight` (`src/diagnostics/preflight.ts`) with their ready GitHub client, so the pre-flight shares its App instance and token cache with the dispatch. In the tick, that is the budget-counted client.
- **Probe lists (`PREFLIGHT_PROBES`), asked one after another in this order:**
  - backup and drill: `d1.lane`, `keys.active`, `vault.list`, `gh.token`, `gh.workflow`, `gh.permissions`, `gh.recipient`, `gh.secrets`, `gh.minutes`, `r2.canary`, `r2.headroom`;
  - check: the same, without `keys.active`, `vault.list`, `gh.recipient` and `r2.headroom`.
- **Bounds:** `PREFLIGHT_DEADLINE_MS` is 7 s for the whole pre-flight. Each probe's timeout is cut to the time left, and a probe never reached is a `fail`. A failed `d1.lane` ends it at once. After a failed `gh.token`, the other App probes are `skipped` without a call.
- **A refused manual start:**
  - `409 preflight_failed`, with the lists under `details.failed` and `details.warned` (each a `ProbeResult` with its `label`);
  - the ops event `preflight-halted` (probe ids only, comma-separated);
  - the route's own audit action, with `preflight=failed`.
  - A start that goes ahead with warnings answers `DispatchResult.preflightWarnings`, and its ops event carries `warned`.
- **A halted scheduled slot:**
  - its `TickResult.scheduled` entry is the new outcome `preflight-halted`, with the pre-flight message as its detail (cf-admin's job counts outcomes by name, so it needed no change);
  - no `backup_runs` row, so the next tick retries it while the slot is due;
  - the alert `preflight:<slot>`, kind `failed`, deduped by id against pending and sent alerts: one per slot;
  - the ops event `preflight-halted`, with `mode`, `scope`, `slot`, `failed` and `warned`, written once per slot, with the alert, in the tick that first halts it (fix round 1: the ticks that retry it add none, so the daily digest counts halted slots, not ticks);
  - in the Alerts section (`GET /api/alerts`), `preflight:<slot>` is open while the slot has no `backup_runs` row. The detail gives the grace end, computed with the schedule's current `graceHours`. It resolves once the slot has a row, started or skipped, and says which. A scheduled row of the same scope on the same UTC day counts too, as it does for the tick;
  - `lastPreflight` is written with trigger `schedule` and the slot.
  - When the grace window ends, the skipped row's `error_message` ends "Last pre-flight: <test> — <what it found>" if `lastPreflight` is that slot's and failed. It is read before the tick's own pre-flights. `scheduledFailureAlert` reads it back, so an alert raised again from the row reads word for word the same.
- **The lane comes first on the scheduled path:** the tick reads the lane before the pre-flight, and a busy lane stays `busy-retry`, naming the run, exactly as before. A `d1.lane` failure inside the pre-flight (a run started in between) is a `busy-retry` too. Without this, every busy lane, such as two slots due together, would be a halt and an alert.
- **The tick budget:** `canAfford(preflightCost(mode), PREFLIGHT_WALL_MS)`, where `PREFLIGHT_WALL_MS` is 10 s: the 7 s deadline, plus room for the insert and the dispatch inside the tick's 20 s.
  - The declared cost is 17 for a backup or a drill, and 12 for a check, because the code declares D1 and R2 calls as external too.
  - About 8 of them are real GitHub subrequests, plus the Vault socket, which is counted with `countConnect`.
  - Short of budget, the entry is `busy-retry` ("tick budget: the pre-flight needs N calls; …"), and no probe runs.
- **The record:** `backup:diagnostics.lastPreflight` is `{ at, by, trigger, slot, mode, scope, ok, failed, warned }`. It holds ids and summaries only, never a detail, and is written by a fail-soft compare-and-swap.
- **The console:**
  - `PreflightFailures` shows the refusal in the Run, bypass and drill dialogs;
  - `PreflightStartWarnings` is a card under the Now bar (`.preflight-start-warnings`), not the bar's pill, whose full radius clipped a list of more than one line;
  - the Diagnostics card shows the last pre-flight.

### Diagnostics fix, 2026-09-24

A fix after Stage 2, for a problem the owner found on the live page.

#### For everyone

- **What went wrong:** the owner pressed **Run all**. Seven of the eight steps were saved, but **Guards** was not.
  - Guards tests the key vault, and the vault had stopped answering. Its database ran each request and finished it, but the answer never came back.
  - The console's connection to cf-backup gives up after 10 seconds. When it gives up, the step's result is lost, and nothing is saved.
- **What we know about why:** cf-backup reaches the vault through Cloudflare Hyperdrive, which keeps its own pool of database connections. It was set up to go through Supabase's transaction pooler (port 6543), a second pool in front of the database.
  - What was seen: the database finished each query, but the answer did not reach cf-backup.
  - Cloudflare's Supabase guide advises against giving Hyperdrive a pooled connection.
  - Switching to Supabase's session pooler is expected to fix it. A re-test after the switch will confirm it.
- **What changed:**
  - **Each Diagnostics step now has 7 seconds in all.** A test that does not answer in time fails and says so. Any test after it in the same step fails with "Diagnostics ran out of time (7 s) before this test ran", and its How to fix line names the slow test. The step's result is saved, unless the settings write itself fails. The page then says "This result could not be added to the stored history."
  - **A key rotation now has time limits:**
    - **A late vault stops it before GitHub.** If the vault answers more than 6 seconds into the request, the rotation stops before GitHub is asked, and says so. The new key stays unused in the vault, nothing else changes, and trying again is safe.
    - **A late GitHub change is set back.** If GitHub does not confirm the key change by 8 seconds, the rotation counts it as failed and sets it back, as for any GitHub failure. A change not yet sent by then is never sent.
    - **A late change that GitHub confirms raises the alert.** If GitHub confirms a change after it was set back, the key-mismatch alert says so. That needs GitHub's answer to arrive while cf-backup is still running; if it never does, the backup run's own checks and the weekly key check are what catch it. The same alert goes out if setting it back does not answer by 9 seconds. On the very first rotation there is nothing to set back to, and the alert says that instead.
  - **The rest of the console gives up on the vault after 7 seconds too:** Keys → Rotate and Reveal, Readiness, and the pre-flight. You get a plain failure instead of a lost answer.
  - **The fix is spelled out.** When the vault does not answer, the How to fix line and the Keys error say that the vault connection should use Supabase's session pooler (port 5432) or direct connection, not the transaction pooler (port 6543). They point to the owner's setup guide.
  - **Setting it up again will not bring the problem back:** the setup script now makes the vault connection on the session pooler.
- **What the owner must do:** switch the vault connection to session mode, by running the setup script's vault part once more. The owner's private setup guide, section 5, has the steps. Until then, while the vault hangs:
  - the two vault tests in Guards fail after 7 seconds;
  - key rotation and reveal fail after 7 seconds;
  - backups and restore drills stop at their pre-flight, as they already did. A check does not use the vault.

#### For engineers

- **The step deadline:** `STEP_DEADLINE_MS` is 7 s (`src/diagnostics/probe.ts`), for one `POST /api/diagnostics/run`.
  - `runStep` passes the deadline to `runProbe`. Each probe keeps its 8 s cap, cut to the time left.
  - A probe the deadline never reached is a `fail` with `ms: null`, the summary "Diagnostics ran out of time (7 s) before this test ran", and a fix naming the slowest test that ran.
  - The pre-flight keeps its own `PREFLIGHT_DEADLINE_MS`. Both build their not-run results with `notRun` and `ranOutOfTime`.
  - Neither starts a probe with less than `MIN_TIME_LEFT_MS` (50 ms) left (`pastDeadline`). A probe stopped at the deadline can wake a millisecond before `Date.now()` reaches it, and CI once saw the pre-flight start the next probe with about 1 ms left.
- **The Vault deadline:** `vaultFor(deps, { deadlineMs })` opens Vault with `VAULT_CONSOLE_DEADLINE_MS` (7 s) unless told otherwise.
  - That covers Keys, the Diagnostics Vault probes, the pre-flight's `vault.list` (by hand and scheduled) and Readiness.
  - `ApiDeps.openVault(url, { deadlineMs })` takes the deadline as a required option, so the tick's budget-counting wrapper cannot drop it.
  - `openPostgresVault` hands it to `createVault`, and `pgOptions` cuts `pg`'s 10 s connect timeout to it.
  - Only the weekly key check keeps `VAULT_CALL_DEADLINE_MS` (15 s). cf-admin waits 25 s for a tick, and the check's own 8 s slot abandons a slow call first, so a hang there is a budget stop that runs again later, not a key problem.
- **The rotation's time marks** (`src/keys/operations.ts`, fix round), measured from the request's start (`deps.now`) by `deps.clock`:
  - `ROTATE_VAULT_BUDGET_MS` (6 s): Vault answered later than this, so stop before GitHub with a retry-safe 502, the key unused.
  - `ROTATE_GITHUB_BY_MS` (8 s): the `BACKUP_AGE_RECIPIENT` change must answer by then. A later answer counts as a failure, and the existing compensation sets it back.
  - `ROTATE_SET_BACK_BY_MS` (9 s): any setting back must answer by then, or the mismatch alert goes out.
  - Without these, the gateway could cut a rotation off between GitHub's change and the registry write, leaving the variable on an unrecorded key with no compensation, alert or audit.
  - A late answer is raced (`answerWithin`). Stopping to wait does not stop the call, so two things make it harmless (round 2):
    - The call's `AbortSignal` is aborted. `GitHubApp.setVariable(…, { signal })` checks it in `#repoCall` before minting and again right before the request, so a call still minting its token never sends its PATCH. A request already sent is not cut.
    - The stopped first change is watched under `waitUntil`. If GitHub confirms it after all, possibly after the set-back, the `key:mismatch:<fp>` alert goes out, with a `rotate-failed` ops event carrying `lateChange: true`, stamped when it landed. A late refusal alerts nobody.
    - The watch waits for the compensation's decision, so the alert names the key it tried to set back to, or, on the first rotation, says there was none (round 3).
    - This depends on GitHub's answer arriving while the Worker is still alive (`waitUntil` has limits). The fallbacks are the runner's doctor, which refuses an unregistered recipient, and the weekly key check.
    - Existing callers pass no signal and are unchanged.
- **The guidance:** `vaultDidNotAnswer(e)` is true for a `VaultError` from the connect stage, or one that timed out.
  - `vault.list` and `vault.refusal` then show `VAULT_NO_ANSWER_FIX`. It is also their `timeoutFix` (a new optional `Probe` field), used when the probe's own time runs out first.
  - Rotate's and Reveal's 502 message ends with the same pointer (`VAULT_POOLER_HINT`).
- **Setup:** `scripts/setup/owner-secrets.mjs --only=vault` now signs in and builds the Hyperdrive origin on port 5432, Supavisor's session mode, with the same host and user format. It also passes `--origin-connection-limit 5`: a session-mode pooler holds one server connection per client connection, and the free tier's pool is small. Updating an existing config keeps its id, so no binding change or deploy is needed.
- **Tests:**
  - a Guards run through the router, against a Vault whose queries never answer (on a fake clock), answers within 7 s and stores its history entry. `vault.list` shows "no answer within 7 s", and `vault.refusal` ran out of time;
  - Rotate and Reveal against the same Vault answer 502 with the pointer;
  - the tick's pre-flight asks Vault for 7 s, and the weekly key check asks for 15 s.

### Stage 3: the runner pre-flight and the runner test (2026-09-24, commits `75348f3`, `bc7dfd7`, `0196e2c`, `634ff52`, `f510f73` and `d6695bc`)

The first two commits are the halt policy and its fix round, the next two the three new runner checks and their fix round, and the last two the runner test and its fix round: the cost stated as 1–2 minutes until measured, the refusal naming the active run, and the Runner step's last doctor record passing a clean runner test.

Built: B6. Not built yet: the new storage folders (Stage 4).

#### For everyone

- **A run now stops at the first sign of trouble on GitHub's machine.** Before it copies anything, the runner's doctor step checks its access. By default, if any check fails, the whole run stops before a single database is copied, as the owner asked.
  - **Where to change it:** Settings → Run guards → "When the runner pre-flight finds a problem". "Stop the whole run (nothing is exported)" is the default. "Skip only the broken part (the rest is backed up)" goes back to the old behaviour: for example, the D1 databases are still backed up while Supabase is unreachable.
  - If the settings cannot be read, or hold a value that is neither choice, the run stops, as with the default.
- **What a stopped run leaves behind:** three small files, and nothing else. They are its record (`manifest.json`), the doctor step's results (`env/doctor.json`) and its log (`logs/run.log.gz`).
  - The run shows as **failed**. Its reasons start with "pre-flight stopped the run before any export", followed by each failed check and what it found. GitHub marks the run failed too.
  - It **never counts toward Run now's cooldown or the daily limit**: it made no backup, so a setup mistake does not lock Run now for 6 hours.
  - **When storage itself failed its check,** the three files are not uploaded, because every upload would fail. They stay on the runner, and the run's GitHub artifact keeps them for 14 days. The run's reasons say so.
- **Three new checks on the runner,** each before anything is copied:
  - **Trial encryption:** the runner encrypts 32 random bytes to the backup key, with the same tool a backup uses. A check and the runner test skip it, because they encrypt nothing.
  - **Storage test file:** the runner writes a small file to storage with its own credentials, reads it back and deletes it. So a backup that could not upload its files is caught before it starts, not at the end.
  - **Disk space:** the runner's disk needs at least 1 GiB free, or three times the size of the last good backup when that is more.
  - When one fails, the run report gives its cause and how to fix it.
- **The break-glass local run still works.** `npm run backup:local -- --no-upload` (docs/RESTORE.md) skips the storage checks instead of failing them, so the halt never stops the one run meant for a storage outage.
- **The runner test.** Diagnostics has a new button, **Runner test (about 1–2 GitHub Actions minutes)**, for people with the Run Diagnostics tests permission. A short dialog says what it does and costs before anything starts.
  - **What it does:** it starts the backup workflow on GitHub in a test mode. The runner installs its tools and runs doctor's checks, then writes the same three small files as a stopped run. It exports nothing and keeps no data, so it is never a backup.
  - **What it proves:** that GitHub starts the workflow, and that on GitHub's own machine the Cloudflare token works, every database answers, storage accepts the test file, Supabase answers, the backup key's settings are in place and the disk has room. The quick Diagnostics steps cannot prove this, because only the runner has those credentials.
  - **What it costs:** about 1–2 GitHub Actions minutes of the 2,000 free each month. GitHub bills the whole job: it checks out the code, sets up Node, and the tools step downloads the Postgres image that doctor's checks use, before doctor and the small seal run. This figure is an estimate: the measured one will be recorded here after the first live runner test.
  - **Limits:** at most **5 a day** (UTC), for everyone together, including any that doctor failed (they still used their minutes). Each also counts toward the person's own checks for the day, unless doctor failed it. It has no cooldown. It cannot start while another run is active: it is refused at once, with the run that is active named.
  - **Before it starts,** it runs the same quick pre-flight as other runs, without the backup key tests and without the two storage tests (the test file and the room left). The runner writes its own storage test file anyway, from GitHub's machine. A failure stops it in the dialog, and no GitHub minute is used.
  - **Its result:** it is a normal run, so watch it in Live. In Runs it reads "runner test (no data)", and its detail says "a runner test: doctor only, never a backup". It passes when every check passes, passes with warnings when one warns, and fails when one fails. When it has finished, run the Runner step again: its test "The runner's last doctor record" then shows this run's checks.
  - **With no backup key yet,** the runner test reports that as a warning, "a backup would stop here", as a check does. It is not a failure, because the test encrypts nothing.
  - **A failed runner test** emails "Runner test failed". The alert is answered when a later runner test, full check or full backup succeeds. A runner test never answers a failed check's alert, because it proves no export.
- **Corrections to the plan in B6:**
  - A stopped run records the error code `doctor_failed`, not `preflight_failed`. That code already keeps a setup mistake out of Run now's cooldown; a new code would have locked Run now for 6 hours after every stopped run.
  - The three files keep today's folder names (`manifest.json`, `env/doctor.json`, `logs/run.log.gz`). Stage 4 moves them to the new layout.
  - The storage test file is written under `v1/indexes/` until Stage 4 moves it to `system/preflight/`.
  - The fourth check B6 planned, the `pg_dump` version, was not added. The existing drill-image check already compares the Postgres version the backup's tools use with the server's, and the dump runs in that same image.
  - No text-encoding fix was needed: see the correction in B1.

#### For engineers

- **The policy:** `runGuards.preflightPolicy`, `'halt'` (the default) or `'skip-part'`.
  - Under `halt`, doctor's `applyPolicy` closes the `d1`, `postgres` and `encrypt` gates, naming the failing check ids and then `preflight-halt`, and sets `DoctorReport.halted: { by }`. The `upload` gate stays as `computeGates` left it: closed only by an R2 failure.
  - Anything but a stored `'skip-part'` is `'halt'`, including unreadable settings. Check mode's softening of key-only failures to warnings comes first, so a check with no key never halts.
- **The minimal seal** (`sealMinimal`, `scripts/backup/lib/seal.ts`), for a halted run and for the runner test:
  - it writes only `MINIMAL_RUN_FILES` (`src/backups/wire.ts`), `manifest.json` last, with no encryption and no verify, usage or other evidence. `report.md` is the GitHub job summary only;
  - a halted run's verdict is failed, first reason `pre-flight stopped the run before any export: <ids>`, every data check `skipped`; the row gets `error_code: doctor_failed`, which `COUNTS_AS_A_RUN` exempts from the cooldown and the daily limit; it always exits 1;
  - with the upload gate closed it makes no PUT: the files stay in the run folder on the runner, which the artifact step uploads, and the row keeps `doctor_failed`, never `manifest_upload_failed`.
- **Scrubbing, on both seal paths:** verdict reasons, finding messages, each job's `problems` and the drill's `problems` are scrubbed of the run's registered secrets and of any user name and password written into a URL, before `manifest.json` and the row are written.
- **The new doctor checks** (`scripts/backup/lib/doctor.ts`):
  - `age-trial` ("Trial encryption (age)"): seal's own `encryptFile` on 32 random bytes, passing on the `age-encryption.org/v1` header, with a 30 s timeout. It closes `encrypt`. It is skipped in modes `check` and `preflight`, and when `age-recipient` already failed;
  - `r2-canary` ("R2 write, read and delete"): PUT, HEAD and DELETE of `v1/indexes/preflight-canary-<runKey>`, naming the first verb that failed; the DELETE is always tried. It closes `upload`. It is skipped with `--no-upload`, with no R2 client, and when `r2` already failed;
  - `disk-space` ("Runner disk space"): the free bytes of the run's work directory against `max(1 GiB, 3 × the last good run's data_bytes)`. It closes `d1` and `postgres`, and is skipped when the free space cannot be read;
  - with `--no-upload`, `r2` and `r2-canary` are `skipped`, never failed;
  - `src/report/diagnose.ts` has a cause rule for each (`RULES_VERSION` 3), tried before the generic R2 write rule so a refused canary is named as the canary.
- **The runner test, Worker side:**
  - `POST /api/diagnostics/runner`: capability `diagnostics.run`, audit `run.drill` with `mode=preflight`; no body. It calls `startRunnerTest` (`src/backups/start.ts`).
  - The guards are a check's (no cooldown; the person's check count against `manualRunsPerPersonPerDay`, which, like every run count, leaves out one doctor failed), then `RUNNER_TESTS_PER_DAY` (5): rows carrying the runner-test reason requested since 00:00 UTC, by anyone. A `dispatch_failed` one is not counted, since it used no minute; one doctor failed still is, since it did.
  - Then a lane read: any active run answers `409 already_running`, naming it as what it is ("The runner test is running…", "A full check is running…", else "A full backup is running…"; the lane lock's own refusal uses the same words), before the pre-flight asks GitHub anything. A run started after that read still meets the lane lock at the insert.
  - Then the pre-flight list `preflight`: `d1.lane`, `gh.token`, `gh.workflow`, `gh.permissions`, `gh.secrets` and `gh.minutes`, with `lastPreflight.mode` `'preflight'`.
  - The row is a check row (`r2_prefix` `v1/checks/`) whose `reason` is `RUNNER_TEST_REASON`, "Runner test (pre-flight only, no data)" (`src/backups/run.ts`). `isRunnerTest(row)` is the check prefix and that reason together. A person cannot type it: `startFromBody` refuses it as a reason.
  - It is dispatched with `mode: 'preflight'` (`DispatchRow.mode`, which `modeForRow` returns when set). `db-backup.yml`'s `mode` choice gains `preflight`, and the workflow guard pins the four options.
- **The runner test, runner side:**
  - `plan` accepts `IN_MODE=preflight` for either scope, files the run under `v1/checks/<YYYY>/<MM>/<runKey>/`, moves the check row to running, plans the steps `plan`, `tools`, `doctor`, `verify`, `seal` and `manifest`, and gives no ETA (a backup's duration is not a runner test's);
  - `doctor` closes `d1`, `postgres` and `encrypt` with `mode:preflight`, which names the mode, not a failure; the halt policy does not apply, so `halted` stays unset; key-only failures are softened to warnings, as in a check;
  - `seal` takes the minimal path, with the verdict from doctor alone: `ok` when every check passes, `warning` with a warning, `failed` with a failure (`doctor_failed`). It exits 1 only when failed;
  - `manifest.json` has `mode: 'preflight'`. The Worker's manifest and heartbeat readers accept it, and finalisation keeps the check folder.
- **Labels:** `RunSummary.runnerTest`; `LiveRun.mode` `'preflight'` reads "Runner test (no data)"; the run alert is "Runner test failed"; Activity and the daily digest name it; `lastGoodCheck` leaves runner tests out unless asked, so only a runner test's own alert is answered by one.
- **`runner.last`** (fix round 1): the doctor record says which kind of run it came from. A check and a runner test skip their trial encryption by design, so that skip is counted as "not needed in a runner test" (or "in a check") and never warns: a clean runner test or check reads as a pass. Any other skipped check still warns.
- **The minutes estimate:** the `gh.minutes` pre-flight probe counts a runner test as 2 minutes, the top of its stated 1–2, until a live one is measured.
- **The page:** the Diagnostics header's button opens the shared `Modal`; a pre-flight refusal shows in it with `PreflightFailures`. Once started, the page says to watch Live, offers a button to it, and names the Runner step's `runner.last` test.
- **Tests:** `test/runner/doctor-policy.test.ts`, `test/runner/doctor-checks.test.ts`, `test/runner/seal.test.ts` and `test/runner/preflight-mode.test.ts` on the runner side; `test/runner-test-api.test.ts` for the route, the guards, the manifest reader and every label; `test/report-diagnose.test.ts` for the cause rules; `test/ui-diagnostics.test.ts` for the button and the dialog.

### Final fix wave, 2026-09-24

Fixes from the final review of Stages 1–3, made before Stage 4 starts.

#### For everyone

- **One retry now really happens.** Part B2 promised that a network blip is retried once before a test reads Fail. The GitHub tests did this, but the vault, storage and database tests did not, so one blip could stop a scheduled backup and send a "did not start" email. Now:
  - the vault tests retry when the vault could not be reached at all;
  - the storage tests (and the Actions-minutes test, which reads storage) retry the two errors storage's own documentation says to retry: an internal error and "service temporarily unavailable";
  - the database tests retry the short-lived errors the database's documentation lists, such as a lost network connection or an internal error.
  - An answer is still an answer: a refused permission, a missing table or a wrong password is never retried. When the retry fails too, the test keeps its How to fix line.
- **A wrong vault password is named as one.** When the vault refuses the key holder's password, or the saved connection string is not valid, the How to fix line now says so and points to the setup script's vault part. It no longer shows the pooler advice, which is only for a vault that does not answer. Such a refusal is not retried.
- **"The runner's last doctor record" tells the truth after a prune, a skipped slot or a refused start.** It now reads the newest finished run that went to GitHub, not just the newest row. When that run left no doctor record (for example a runner test whose upload was refused), the test says which run and why, instead of "no run has reached doctor yet". Readiness reads the same record the same way.
- **Readiness and Diagnostics agree on a clean runner test or check.** The trial encryption such a run skips on purpose is counted as "not needed" on both pages, never as a warning.
- **The key test judges each person's recovery kit,** as Keys and the weekly key check do. One person's recent confirmation no longer covers someone else's overdue one.
- **GitHub's last run is named as what it was:** cancelled, timed out, skipped or failed to start. Only a real failure reads "failed".
- **Starting a run while another is active** now answers "already running", naming the active run, for every kind of start (Run now, without the cooldown, a drill, a check), as the runner test already did. It no longer counts as a failed pre-flight, so it writes no pre-flight record and no "pre-flight stopped" event.
- **The pre-flight's 7 seconds count from the start of the request,** not from the start of the pre-flight, so the checks before it cannot push the answer past the console's 10-second limit.
- **A test the pre-flight had no time for** now says which test used the time, as a Diagnostics step does.
- **App permissions in a pre-flight:** a start is stopped only by a permission that run needs (starting the workflow, reading the repository, reading its secrets and, for a backup or a drill, reading the backup key variable). A shortfall that only other features need, such as changing that variable during a key rotation, is a warning that travels with the run. The Diagnostics page still judges every permission the console needs.
- **The storage write test's "slow" mark is now 2 seconds.** It makes four trips to storage one after another, so it gets the usual half second for each. The owner's two stored runs took about a third of a second for all four.
- **A stopped run keeps its "stopped by the pre-flight" code** even when GitHub's machine could not record its own result and the 5-minute check finishes it from its record instead. So it still never counts toward Run now's cooldown or the daily limit.

#### For engineers

- The retry list is kept short and named in the probe core: storage's two retryable error codes, and the database's documented retryable messages. A test that hands a short-lived error back for the retry gives its own How to fix line if the retry fails too.
- The retries fit the tick's subrequest budget: each pre-flight's declared cost already counts the database and storage calls, which do not use that budget, so a vault retry's one extra connection is covered.
- The halted message is now shared by the runner and the Worker from one place, so the 5-minute check recognises a halted run by the runner's own words.
- Tests: the probe core, the platform, record and GitHub tests, the pre-flight and manual-run tests, and the reconcile tests each gained cases for these fixes.

## Decisions made during the build

The design above left some questions open, and building it raised a few more. Claude decided each one so the work would not stall, and the owner can reverse any of them. Each entry gives what was decided, why, and what it would cost if it turns out wrong.

### Changes to what the design said
- **The Diagnostics steps are grouped as the page shows them** (trigger, guards, dispatch, runner, storage, reconcile, after-run, alerts). This keeps every step a real test the Worker can run.
  - Stages only a real run can prove (exporting, encrypting, the drill) appear inside the runner step, from the latest run's record. The browser measures the console connection itself.
  - *If wrong:* the page has fewer headings than the table in B3.
- **No text-encoding fix.** The stored text was correct, and a Windows terminal had garbled it. *If wrong:* nothing.
- **No separate `pg_dump` version check.** The existing drill-image check already compares versions. *If wrong:* one duplicate check is missing.
- **A check's pre-flight skips the storage-room test**, because a check keeps no data. *If wrong:* a check could start while storage is nearly full.
- **History keeps the last 20 results for each step**, rather than 20 in total, so every test has its own trend. *If wrong:* the stored history is a little larger.
- **A halted run is recorded as `doctor_failed`, not `preflight_failed`.** The Run-now cooldown already lets `doctor_failed` runs off, so a new code would have locked the owner out for 6 hours after every halt. *If wrong:* only the wording differs from the design.
- **The runner test is shown as costing about 1–2 GitHub minutes**, not 1. The tools step downloads the Postgres image, and the real figure will be recorded after the first live runner test. *If wrong:* the stated cost is higher than it really is.

### Places where the plan's own numbers or code were wrong
- **The redaction step itself threw an error** on detail text between 500 and 2,048 characters. It now redacts field by field. *If wrong:* nothing; the stored shape is the same.
- **The storage-room test divided by three times the run size**, understating free space about three times. It now counts how many runs fit and passes at 3 or more. *If wrong:* the thresholds are looser than the plan's literal wording.
- **The first version of the one-retry rule never actually retried** the Vault, storage or database tests. The final fix wave corrected this. *If wrong:* nothing.

### Safety and truthfulness rulings
- **Every place a test, verdict or error message is stored or shown strips secrets.** That covers tokens, connection-string passwords and fields with secret-sounding names. It includes the run record and `manifest.json`, which had a gap on normal runs from before this work. *If wrong:* nothing; this only removes text.
- **Anything the page, an alert or a public doc says must be true.** Several findings rated minor were fixed under this rule. For example:
  - an untested "normal" response time was removed;
  - a summary line that credited one run with every step's result was reworded;
  - a runner test is never called a backup or a check;
  - a clean runner test no longer shows amber.

  *If wrong:* nothing.
- **Time limits keep every console action inside cf-admin's 10-second gateway limit.** Diagnostics steps and pre-flights stop at 7 seconds. Rotate stops before GitHub if Vault answers after 6 seconds, and bounds its GitHub change at 8 seconds and any set-back at 9. *If wrong:* a slow but healthy service can make a person press again.
- **A rotation cannot silently finish only half its steps.** A late GitHub change that was never sent is never sent. One that lands later still raises the key-mismatch alert. *If wrong:* an unneeded "may" alert after a very slow rotation.
- **A scheduled slot stopped by pre-flight raises exactly one alert.** It is tried again at each tick until its grace window ends, and its alert stays open until the slot starts or is skipped. *If wrong:* an alert may close before a later failure of the same run, which raises its own alert.
- **A busy run lane is reported as "already running"**, not as a pre-flight failure, for every way a run can start. *If wrong:* nothing.
- **In a pre-flight, the GitHub permission test fails only on permissions that run needs.** A permission only Rotate uses gives a warning. *If wrong:* a run could start while Rotate would fail; the Diagnostics page still shows it.
- **When R2 itself fails the runner pre-flight, the three evidence files stay on GitHub's machine**, where GitHub's run artifact keeps them, and the run keeps `doctor_failed`. *If wrong:* that halted run has no copy in R2.
- **The documented `--no-upload` emergency run still works.** Its R2 tests are skipped instead of halting it. *If wrong:* nothing.

### Infrastructure changes (approved by the owner)
- **Vault's database connection.** The Hyperdrive config moved from Supabase's transaction pooler (port 6543) to the session pooler (port 5432), with a limit of 5 connections. The Vault login's own connection limit went from 3 to 5.
  - Before: every Vault query hung.
  - After: 14 of 14 queries answered in 30–90 ms.
  - *If wrong:* switch back in the Hyperdrive settings.
- **A local-only placeholder database address was added**, so `npm run dev` starts again. Deployments never use it. *If wrong:* nothing.

### Small items recorded for the close-out (Task 17)
- **The wording of a few rare error messages:**
  - an R2 test that "failed twice" when it had no time to retry;
  - the pre-flight permission summary;
  - a rotation message's "only … seconds into this request";
  - Rotate showing no specific hint after a wrong Vault password.
- **A test file that could be left behind:** a 32-byte R2 test file can be left behind if its delete fails once, while the test still passes. Stage 4 moves these files and should make that case show amber.
- **A very narrow race:** a run that starts between two checks gets a pre-flight refusal instead of "already running".
- **Two gaps in the tests:**
  - the storage-room test rarely runs inside the 5-minute timer;
  - the runner result covers the doctor checks only, not each export.

  Decide these in the close-out.

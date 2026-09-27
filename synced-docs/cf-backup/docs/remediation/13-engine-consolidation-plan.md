---
title: "cf-backup remediation — 13 Engine consolidation plan (one engine: the Secondary Pipeline)"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-09-27
verified_against: [code, infra, live-mcp]
owner: harshil
related_code: [.github/workflows/secondary-pipeline.yml, scripts/secondary-pipeline/verify.ts, src/secondary/pipeline.ts, src/secondary/record.ts, src/tick/secondary-runs.ts, src/tick/reconcile.ts, .github/workflows/db-backup.yml, scripts/backup/lib/workflow-guards.ts, scripts/backup/lib/pins.ts, scripts/backup/lib/docs-mirror.ts]
related_docs: [README.md, 06-remediation-plan.md, 07-decision-log.md, 09-secondary-pipeline-specification.md, 11-terminology-standard.md, 12-open-source-tool-assessment.md]
tags: [cf-backup, remediation, plan, consolidation, secondary-pipeline]
---

# 13 — Engine consolidation plan

> **TL;DR (non-technical):** On 2026-09-27 the Owner chose one backup engine instead of two
> ([07](07-decision-log.md) §0, RD-15). The small Secondary Pipeline, which has produced verified
> backups since 2026-09-26, becomes the only one. The console is taught to show its runs, to warn
> only when its backups are really missing, and to start it with "Run now". Once it has run for 30
> days without a miss and a person has restored from it, the old Primary Pipeline, about 44,000
> lines that never produced a backup, is deleted. This document is the plan of record from that
> day, and replaces Stages 2 to 5 of [06](06-remediation-plan.md).

## 1. Where things stand (2026-09-27, 09:30 UTC)

> **Update, 15:00 UTC.** The first scheduled run started at 14:16 UTC, 5 h 35 min late, and passed;
> a manual run passed at 14:50. Both are verified recovery points for 2026-09-27. Why backups still
> looked "failing": the engine's only trigger was GitHub's schedule, and the console could start
> only the retired Primary Pipeline. B3 below is the permanent fix ([07](07-decision-log.md) §0.1).

| Part | State |
|---|---|
| Secondary Pipeline | Commissioned: three passing manual runs on 2026-09-26, authentication records included. The first scheduled run was due at 08:41 UTC and had not started at 09:30: GitHub starts this repository's scheduled runs 4 to 5 hours late |
| Primary Pipeline | Disabled on GitHub; both schedule settings off. Seven runs, no recovery point |
| Console | Knows only the Primary Pipeline. Its staleness alerts report "no successful backup" every day although the Secondary Pipeline backs up daily, and Diagnostics warns about the Primary Pipeline's last failure |
| Offline recovery keys | 0 confirmations: the one gap the Owner must close ([README](README.md) §7) |

## 2. Target state

- **One engine:** `.github/workflows/secondary-pipeline.yml`, exporting every store daily, restoring
  each export in the same run, then encrypting, archiving and reading back.
- **The console describes that engine:** its run list shows Secondary Pipeline runs, freshness and
  the staleness alerts come from its recovery points, "Run now" and the Scheduler dispatch it, and
  Diagnostics checks it.
- **The Primary Pipeline's runner is gone:** `db-backup.yml`, `scripts/backup/**` and the console
  screens that only showed its internals.

**What stays, because it works:** the console, key custody (the Vault, the key registry, the
recovery kit), the Scheduler in cf-admin's five-minute tick, the alerts and their delivery records,
`backup_runs`, and Diagnostics.

**One rule carries over from [09](09-secondary-pipeline-specification.md) §2:** the workflow never
calls the Worker. The Worker reads what the workflow already produces (its GitHub run and its files
in R2) and records it. A defect in the Worker can hide a run from the console, but can never stop
or change one.

## 3. Steps

### B0 — Prove the engine

| # | Task | Owner | State |
|---|---|---|---|
| B0.1 | A run **started by the schedule** passes ([06](06-remediation-plan.md) 1.6) | Engineering | **done** 2026-09-27: run 36325294293, started 14:16 UTC |
| B0.2 | The Owner decrypts one file from the bucket with the offline recovery key ([06](06-remediation-plan.md) 1.3) | Owner | not started |
| B0.3 | Bucket lock (30 days) and lifecycle (35 days) rules on `secondary/` (RD-12) | Owner | not started |
| B0.4 | External heartbeat (RD-9): the workflow pings `HEARTBEAT_PING_URL` after a passing verdict, and skips the step while the secret is absent. Engineering adds the step after B0.1; the Owner creates the check and the secret | Both | step **built** with B3 (C2); the check and the secret are the Owner's |
| B0.5 | A failure notification from GitHub has reached the Owner ([06](06-remediation-plan.md) §4) | Owner | not started |

**Gates, refined from [12](12-open-source-tool-assessment.md) §6.1:**

- **Worker-only steps (B1, B2) may land before B0.1.** They only read what the workflow already
  produces, and they change what the console shows, never what is exported or how it is
  encrypted. Landing B1 first means the console records the first scheduled run itself.
- **No workflow change before B0.1.** A scheduled run executes whatever is on `main` when it
  starts, so the first scheduled run must meet the commissioned workflow. B3 and B0.4 change the
  workflow, so they wait. *Met 2026-09-27 at 14:18 UTC; C2 changed the workflow after it.*
- **B0.2 gates B5:** nothing is deleted while no one has proven the offline key opens a recovery
  point.

### B1 — Run records (built 2026-09-27)

**What it does.** A tick chore, `secondary-runs` (`src/tick/secondary-runs.ts`), runs every third
five-minute tick. It asks GitHub for `secondary-pipeline.yml`'s finished runs of the last week (one
request, five runs), and records each run it has not seen as one finished `backup_runs` row. The
pure part lives in `src/secondary/pipeline.ts`.

| Column | Value |
|---|---|
| `kind`, `scope`, `lane` | `backup`, `full`, `actions` |
| `trigger`, `requested_by` | GitHub's schedule: `fallback`, `fallback` (as the Primary Pipeline's own cron runs were). Started by hand on GitHub: `manual`, `github:<login>` |
| `status`, `verdict` | `succeeded`, `ok` **only** when GitHub's conclusion is `success`, every file `SHA256SUMS` names is in the folder, and `manifest.json` reports all five stores verified. Otherwise `failed` (or `cancelled`), `failed`, with each reason in `verdict_reasons` and an `error_code` of `run_failed`, `archive_incomplete`, `nothing_archived` or `cancelled` |
| `run_key`, `r2_prefix` | `<start day>_full_gh<run>a<attempt>`, and the folder `secondary/pipeline/<upload day>/<run>-<attempt>/`. A run that archived nothing records the folder it would have written, so every row of this engine is found by its `secondary/` prefix |
| sizes | `data_bytes` from the `.age` files, `evidence_bytes` from `manifest.json` and `SHA256SUMS`, and the file counts |

The insert is one statement that does nothing when the run key is already recorded, so two ticks
can never record a run twice. Runs started before 2026-09-26 22:48 UTC are not recorded: they
predate `postgres-auth`, and are in [09](09-secondary-pipeline-specification.md) §7.

**What follows from the row, unchanged:** the daily staleness check counts a succeeded row as a
good backup (so the false "no successful backup" emails stop); a failed row raises the usual run
alert; `postrun` files GitHub's run, jobs and logs into the run's folder; Diagnostics' `gh.runs`,
`reconcile.last`, `postrun.last` and `r2.headroom` read it. The one exception is the runner's
doctor record (`runner.last`), which only the Primary Pipeline writes; its lookup skips these rows.

Now that a good backup is on record, the daily check sends its half-yearly "no backup has been
decrypted yet" reminder. That is correct (no decryption is recorded), and B2 makes it answerable.

**Exit:** the console lists the scheduled runs of B0.1 onward with the right verdict.

### B2 — Freshness, run detail and restore proof

The staleness alerts already follow from B1's rows. B2 finishes the reading side:

| Part | State |
|---|---|
| Run detail: each store's restore verification (source counts before and after, restored count), and the folder's files with the checksums `SHA256SUMS` recorded | **built** 2026-09-27 (`src/api/runs.ts` `secondaryDetail`, `src/ui/screens/RunsScreen.tsx`) |
| Keys → Restore proof accepts a recorded Secondary Pipeline run; no key fingerprint is claimed, because the engine's manifest lists no recipients | **works as built**, pinned by a test |
| Files: `secondary/` and each level below it are described, and its run folders count as backup data | **built** 2026-09-27 (`src/files/layout.ts`) |
| Diagnostics: `runner.last` ("The backup engine's last run") reports the Secondary Pipeline's newest recorded run: pass when it verified every store within 26 hours, warn when older, fail when it failed. It falls back to the old doctor record only before the first recorded run | **built** 2026-09-27 (`src/diagnostics/probes-records.ts`) |

While a verified recovery point is under 26 hours old, no staleness alert is raised.

**Exit:** a day with a passing run raises no staleness alert; a day without one raises exactly one.

### B3 — Dispatch

"Run now" and the Scheduler dispatch `secondary-pipeline.yml`. Its own `schedule:` stays as the
fallback: when a run has already archived a recovery point that day, the fallback exits after one
check, in under a minute. The console's schedule settings are re-enabled only when a dispatch from
the console has passed.

Design, decided 2026-09-27 ([07](07-decision-log.md) §0.1). Each commit is deployable on its own:

| Part | What | State |
|---|---|---|
| C1 Worker, recording | A row whose `r2_prefix` is under `secondary/pipeline/` is this engine's. Reconcile follows such a row by GitHub's run alone (no heartbeat, no manifest@1): a request not confirmed in 10 minutes is matched by the request id in the run's name; queued and running are tracked; a completed run is judged from its folder exactly as B1's chore judges one (`src/secondary/record.ts`); 6 hours without contact is `lost`. The chore never records a run that already has a row (by run id and attempt, or by the request id while GitHub has not numbered it), and records a fallback that stood down as one `skipped` row that never alerts. Diagnostics' "last run" ignores skips | **built** (`41c219d`) |
| C2 Workflow | `run-name: secondary-pipeline ${{ inputs.request_id \|\| github.event_name }}` and one optional input, `request_id`; cron `41 11 * * *`; step 0 `fallback guard` (on GitHub's schedule only: one request for the day's successful runs; any → the export steps do not run and the verdict passes; GitHub unreachable → back up anyway); the `heartbeat` step (B0.4); job permissions `contents: read, actions: read`. The guard enforces each part and the 320-line limit | **built** (`c15b190`); proven by run 36328312053 (dispatched by hand, passed 15:08 UTC) |
| C3 Worker, dispatch | The engine is a code constant (`githubFor` sets `secondary-pipeline.yml`), not the stored `github.workflow`, so dispatch, correlation and Diagnostics' workflow test all follow it. "Run now" (full only) and the Scheduler insert a row holding the bare `secondary/pipeline/` root and dispatch the workflow with only `request_id` (`GitHubApp.dispatchSecondary`). Drill, check, Supabase-only and the runner test answer 501 with the reason until B5 deletes them; the Scheduler reports a Supabase-only slot as disabled and has no monthly drill and no check. Saving the schedule refuses Supabase-only and the monthly drill. A backup's pre-flight no longer opens the Vault; its minutes estimate is 3. Console: "Run now" offers Full only, no drill, check or runner-test buttons | **built** |
| Live settings | Claude writes `backup:config` (Owner's decision): full backup daily, Supabase-only off, grace 2 hours, monthly drill off; first a slot about 20 minutes ahead to prove a Scheduler dispatch the same day, then 09:17 UTC. A notice alert records each change | pending, after C3 |

The two triggers are independent: if Cloudflare's cron stops, GitHub's schedule still backs up; if
GitHub drops its schedule, the Scheduler has already backed up. If GitHub's schedule never fires for
two days, the Owner disables and re-enables the workflow on GitHub (Actions → secondary-pipeline →
⋯), which registers its schedule again.

**Exit:** a "Run now" from the console runs the Secondary Pipeline and appears in the run list; a
run the Scheduler dispatched passes (the re-scoped B0.1); the next day's fallback is recorded as
`skipped` without an alert.

### B4 — Acceptance (30 days)

Unattended daily runs, measured against §4. The feature freeze (RD-4) lifts after 7 consecutive
passing scheduled runs; acceptance needs all of §4.

### B5 — Retirement

1. **Inventory:** list everything that imports from `scripts/backup/` or reads the Primary
   Pipeline's outputs.
2. **Move what is shared first:** the Secondary Pipeline's CI guard
   (`checkSecondaryPipelineWorkflow` in `scripts/backup/lib/workflow-guards.ts`), the image pins
   (`scripts/backup/lib/pins.ts`) and the docs mirror's allow-list
   (`scripts/backup/lib/docs-mirror.ts`, named in `sync-docs.yml`).
3. **Delete** `db-backup.yml`, the rest of `scripts/backup/**` and their tests, and the console
   screens that only showed the runner's internals (heartbeat, per-stage meters).
4. **Prove it:** `npm run verify` passes, and one manual Secondary Pipeline run passes afterwards.

**Gate:** §4 met, and B0.2 done.

## 4. Acceptance criteria (replaces [06](06-remediation-plan.md) §9)

All true at the same time:

1. **Recovery Point Actual (RPA)** under 26 hours for every store (RPO 24 hours), shown by the
   console from the Secondary Pipeline's recovery points (B2).
2. **30 consecutive days** without a missed or failed scheduled run. Any failure restarts the
   count after its cause is fixed.
3. **One recovery test by a person** from the archive bucket with an offline recovery key, on a
   machine other than the runner, following `docs/RESTORE.md`. Row counts match the run's
   `manifest.json` for every store, authentication records included. Recorded under Keys → Restore
   proof.
4. **Two offline-recovery-key confirmations**, each key having decrypted a real recovery point.
5. **The console tells the truth about the engine:** its run list, freshness, staleness alerts,
   "Run now" and Diagnostics all describe the Secondary Pipeline (B1 to B3).
6. **The external heartbeat** (RD-9) has pinged for at least 7 consecutive days.
7. `docs/RESTORE.md` and `docs/OWNER-SETUP.md` describe what was actually done.

On acceptance the feature freeze lifts (RD-4) and B5 may begin.

What is no longer required, and why:

| [06](06-remediation-plan.md) §9 criterion | Why not |
|---|---|
| 7 passing Primary Pipeline runs | The Primary Pipeline is retired (RD-15) |
| Pre-production Validation required and passing | Not built (RD-2, RD-6). Each Secondary Pipeline run is its own validation: a real restore, row counts against the source and a checksum read-back from R2. CI's `checkSecondaryPipelineWorkflow` guards the workflow's shape, and any change to it is proven by a manual run the same day |
| Weekly restore verification and monthly live restore test | Every daily run already restores every export and counts every table. Under RD-3 no key is in GitHub, so the ciphertext is proven by the daily checksum read-back, and decryption by a person (monthly for 3 months, then quarterly) |

## 5. What happens to the rest of [06](06-remediation-plan.md)

| [06](06-remediation-plan.md) | Here |
|---|---|
| Stage 0 Containment | Unchanged; done except the key confirmations |
| Stage 1 Interim protection | Unchanged; it is B0 |
| Stage 2 Primary Pipeline remediation (2.1–2.20) | Not done; the runner is retired in B5 |
| 2.21–2.22 Nomenclature (RD-14) | Narrowed: console labels and living documents only, in B2 and B3 |
| Stage 3 Authentication records | Done in the Secondary Pipeline. 3.4's monthly full-stack restore is replaced by the person's recovery test (criterion 3), which loads the records into a real Auth service |
| Stage 4 Restore verification decoupling | Not needed: the in-run restore takes about a minute |
| Stage 5 Stabilization and acceptance | B4, against §4 above |

## 6. Budget (GitHub Actions minutes a month)

| Item | Runs | Minutes each | Total |
|---|---|---|---|
| Secondary Pipeline, daily (measured: 1 min 44 s to 2 min 3 s across the three commissioning runs) | 30 | 2 to 3 | 60 to 90 |
| The fallback schedule when the Scheduler already ran that day (B3: exits after one check) | 30 | under 1 | about 15 |
| Manual runs after changes and "Run now" | about 5 | 2 to 3 | about 15 |
| **Total** | | | **about 90 to 120**, against the 400-minute ceiling (RD-7) |

R2 holds a few megabytes a day, deleted after 35 days (RD-12). D1 reads are a few thousand rows a
day, against 5 million.

## 7. Risks

| Risk | Mitigation |
|---|---|
| GitHub starts or drops a scheduled run late | The Scheduler dispatches on time from cf-admin's five-minute tick (B3); the workflow's own schedule is the fallback; the staleness alert (B2) and the external heartbeat (RD-9) report a missed day |
| One engine means no second path | Each run restores its own exports before anything is uploaded, so a broken run fails loudly instead of archiving bad data. The previous 35 days stay locked in R2, and a 14-day copy stays in GitHub |
| The console integration couples the engine to the Worker | The workflow never calls the Worker, and the Worker only reads what the workflow already produces. A Worker defect can hide a run from the console but cannot stop or change one |
| Deleting the runner removes something still in use | B5 starts with an inventory; the three shared files move first; `npm run verify` and one manual run must pass after the deletion |
| An offline recovery key is lost | Two keys, and B5 waits for both confirmations |
| A leaked token deletes recovery points | Bucket locks on `secondary/` (RD-12, Owner task) and on `backups/` and `ops/` (in place) |

## 8. Status

| Step | State | Evidence |
|---|---|---|
| Decisions | **settled** 2026-09-27 | [07](07-decision-log.md) §0 |
| B0.1 First scheduled run | **done** 2026-09-27 | Run 36325294293: due 08:41 UTC, started 14:16 UTC, passed 14:18; recorded 14:30 as `succeeded`, 8 of 8 files. Manual run 36327225356 passed 14:50 |
| B0.2 to B0.5 | not started | Owner tasks, [README](README.md) §7 |
| B1 Run records | **built and live** 2026-09-27 | `src/tick/secondary-runs.ts`, `src/secondary/pipeline.ts`; `test/secondary-runs.test.ts`. Production, 13:15 UTC: run `2026-09-26_full_gh36277447136a1` recorded as `succeeded`, 8 of 8 files, 908,022 bytes of data; postrun filed in the same tick (2 billed minutes) |
| B2 | **built** 2026-09-27: run detail, restore proof, Files, Diagnostics | Tests in `test/reads-runs.test.ts`, `test/restore-proof.test.ts`, `test/files-layout.test.ts`, `test/diagnostics-records.test.ts` |
| B3 | **in progress**: C1 built (`41c219d`), C2 built; C3 and the live settings pending | §3 B3 |
| B4, B5 | not started | |

## 9. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-27 | claude | Written from [07](07-decision-log.md) §0 and [12](12-open-source-tool-assessment.md) §6.1; live checks at 09:30 UTC: workflow states in both repositories, `backup:config`, `backup_runs`, the key registry, Supabase Storage, and the start times of this repository's scheduled runs; commissioning run durations from GitHub | §1 to §8 |
| 2026-09-27 | claude | A map of every console path that assumes the Primary Pipeline (staleness, run list and detail, dispatch and reconcile, Diagnostics, `backup_runs` writers, the Secondary Pipeline's R2 output); B1 built against it | §3 B1, B2; §8 |
| 2026-09-27 | claude | GitHub's record of runs 36325294293 and 36327225356; `backup_runs` in production; `npm run verify` for C1 and C2 | §1 update, §3 B0, B3; §8 |

## 10. Related

- [07-decision-log.md](07-decision-log.md) §0: the decisions this plan carries out.
- [12-open-source-tool-assessment.md](12-open-source-tool-assessment.md) §6: why one engine, and which.
- [09-secondary-pipeline-specification.md](09-secondary-pipeline-specification.md): the engine itself.
- [06-remediation-plan.md](06-remediation-plan.md): Stages 0 and 1, still in force.
- [11-terminology-standard.md](11-terminology-standard.md): the labels the console uses.

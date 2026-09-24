---
title: "cf-backup — 10 Free-tier feasibility and budget"
status: draft
audience: [owner, ai, technical, operator]
owner: harshil
related_docs: [README.md, 03-backup-pipeline.md, 06-roadmap.md, 09-key-management.md, 11-run-evidence-and-usage.md, ../../records/reports/2026-09-22-ci-workflow-consolidation.md]
tags: [program, cf-backup, free-tier, budget, github-actions, r2]
---

# 10 — Can all of this run on free tiers?

> **TL;DR: yes.** Cloudflare and Supabase have large headroom for everything in this
> plan, including years of old backups, their evidence bundles in R2, and key rotation with
> re-keying of old backups. **GitHub Actions minutes are the one binding limit.** They are
> shared by every private repo on the account, and the owner's target is a combined total
> **under 1,000 minutes a month**, half the free 2,000. The plan fits that target if the
> backup workflow is written as **one job per run** *and* cf-astro's hourly heartbeat
> moves off GitHub Actions (lever L1, §2.3). Without L1 the total lands near 1,200.
>
> **Revised 2026-09-22:** with the storage move parked, cf-backup is one Worker with no
> public surface, so the zone's single free rate-limit rule is no longer needed. The
> run evidence policy (doc 11) adds ~0.1 GB a year of R2 and a few seconds per run.
> Its account snapshot turns this document's figures into live readings in the console.

## 1. Verdict per service

*Measured* = checked live on 2026-09-21/22. *Docs* = vendor documentation read those days.
Other figures are standard plan limits, to be re-confirmed in Phase 0. This table is the
human-readable home of the limit values; cf-backup's allowance catalog in code is the
machine one (doc 11 §5.4), and each snapshot records the value it used.

| Service | What the plan uses | Free limit | Plan's use | Verdict |
|---|---|---|---|---|
| Workers requests | console page loads and the live view through cf-admin; one daily reconcile; hourly meter calls | 100k/day, account-wide (*docs*) | A few hundred a day; ~30 a minute per viewer while a run is active, mostly `304`s (doc 14 §10). Service-binding calls are **not** billed as extra requests (*docs*) | ✅ |
| Workers CPU | key generation, key check, manifest and index reads, header re-wrap, streaming | 10 ms/invocation; I/O wait excluded (*docs*) | each well under 1 ms; streams pass through untouched; the console is a static bundle | ✅ |
| Subrequests | reconcile, meter, snapshot, re-key batches | 50 external / 1,000 to Cloudflare services per invocation (*docs*) | batches capped at 20 runs or files; one GraphQL call carries several datasets | ✅ |
| Cron triggers | none new | 5/account (*docs*, **measured 2026-09-23: 5 of 5 already in use**) | **+0**: one new **job** (`backup-tick`), not a new trigger, rides cf-admin's existing `*/5` tick; it computes due schedule slots, dispatches, reconciles and meters (D-4) | ✅ |
| Workers | `cf-backup` | 100/account (*docs*) | +1 | ✅ |
| Workers Builds | 1 new Worker project | 3,000 build min/month, **1 concurrent** (*docs*) | ~3 min per build | ✅ Builds queue behind other repos' |
| Workers Logs | cf-backup's own log lines | 200k events/day, **3-day retention** (*docs*) | low; anything worth keeping is an R2 evidence record (doc 11) | ✅ |
| R2 storage | backups + evidence + staff storage + images + ARCO | 10 GB-month, account-wide | ~1.4 GB/year if nothing is pruned, ~0.4 GB steady on the suggested schedule (§3) | ✅ For years |
| R2 operations | uploads, live heartbeats, lists, `postrun/`, indexes, re-key | 1M Class A / 10M Class B per month | ~4,000 Class A per month (heartbeats ~3,000) | ✅ |
| R2 bucket locks | `v1/runs/full/` (90 d), `v1/runs/daily/` (30 d), `v1/ops/` (90 d) | available (*docs*; plan tier and new-key behaviour **to verify**, §5 check 5) | 3 rules | ✅ |
| D1 | a few small settings rows; **the new `backup_runs` table** (D-1, ~2–10 rows/day, kept indefinitely — about 400/year); monthly temporary drill DB | 5M reads / 100k writes per day, enforced since 2026-09-01 (*docs*) | `backup-tick` reads `backup_runs` and the settings rows every 5 minutes (its own real-path test proves **0 rows** against cf-admin's own budget, since the reads happen inside cf-backup, not cf-admin); drill writes ~2,425 rows/month (*measured*) | ✅ |
| Queues | backup alerts | 10,000 ops/day, 24 h retention (*docs*) | a few/week | ✅ |
| Cloudflare analytics APIs | the account usage snapshot | free with an API token; rate-limited (*to verify* the exact limit) | a few calls per run, by the runner with key 1 | ✅ |
| WAF rate limiting | — | 1 rule per zone (*docs*) | **Not needed** (no public surface) | ✅ The rule stays free for other uses |
| Supabase database | backups read it | 500 MB | 17 MB (*measured*) | ✅ |
| Supabase egress | dumps | 5 GB/month | ~0.5 GB/month with daily dumps, **measured per run** from now on (doc 11 §5.2) | ✅ ~10% |
| Supabase projects | a restore target | 2 active per free org | **2 of 2 active** (*measured*: `Cloudflare` + `supabase-pink-village`) | ⚠️ A restore into a new project needs a slot (§5 check 3) |
| Supabase Vault | backup private keys | included; extension on by default (*docs*) | a few 74-character secrets | ✅ |
| GitHub Actions minutes | backup runs + cf-backup CI | 2,000/month, shared by all private repos; each **job** rounds up to a whole minute | ~130–190 min/month (§2) | ⚠️ Within the < 1,000 target **only with one job per run and lever L1**; measured pace today ~1,739 |
| GitHub artifacts | 14-day second copy | 500 MB, shared | ~60 MB; 21.4 MB used today (*measured*) | ✅ |
| GitHub App, variables, secrets | dispatch, recipients, readiness, the minutes meter | free | one App | ✅ |
| Password managers | recovery kits | free individual plans | 2 people | ✅ |
| Brevo email | alerts | 300/day | a few/week | ✅ |
| Sentry | cf-backup errors | Developer plan, shared quota | low | ✅ |

## 2. GitHub Actions: the one binding constraint

**Today** (owner's figures, 2026-09-22, month to date): cf-admin **936 min**, cf-astro **339 min**, so
**1,275 of 2,000** used. **Measured over a rolling 30 days** (per-job durations, rounded up
the way GitHub bills, 2026-08-23 → 2026-09-22): cf-admin **~1,173**, cf-astro **~566**,
**~1,739 total**. That is the same pace (1,275 × 30/22 ≈ 1,739). Of cf-astro's 566, **~436 is
the hourly heartbeat** (two workflow names, 2 jobs per run). Both repositories are private (*measured*), so they share the
account's allowance. **Target: combined under 1,000 min/month.**

**What the 2026-09-22 consolidation changes** ([report](../../records/reports/2026-09-22-ci-workflow-consolidation.md)):
cf-admin's push CI went from 8 jobs (~15–20 min per push) to **1 job (~2–2.5 min)**,
with stale runs cancelled. At the last 30 days' ~116 pushes, that is roughly **290 min**
plus the weekly audit, instead of the majority of today's 936.

### 2.1 Budget

| Line | Estimate after changes | Basis |
|---|---|---|
| cf-admin push CI (`quality.yml`) | ~370 | Measured full run ~5 min (first run 2026-09-22); ~half of ~116 pushes documentation-only at ~1 min; + weekly audit |
| cf-admin `sync-docs.yml` | ~80 | ~81 runs/month, 1 job each (30-day count, 2026-09-21) |
| cf-admin `backups.yml` (bridge, until P1 retires it) | ~30 | one job weekly, ~6–8 min with its drills |
| cf-astro (all workflows) | **~570**, or **~130 with L1** | Measured 30 days: heartbeat ~436, CI ~86, security ~32, sync ~12 |
| **cf-backup `db-backup.yml`** | **~110–130**, **+~4 for the D-5 fallback** | one job per run: Mon–Sat Supabase-only ~4 min × 26, Sunday full ~6 min × 4, monthly real-path drill +2; the evidence steps add seconds, not minutes. **As built:** the fallback's own weekly `schedule:` run costs one job that exits in seconds on almost every Monday (a good full backup already ran) and a full run's worth of minutes on the rare Monday it does not — averaged, about 4 billed minutes a month (D-5) |
| **cf-backup CI** | **~20–60** | one job per push, like cf-admin's `quality.yml`; high while building, low at steady state |
| **Total** | **~1,184–1,244 without L1 · ~744–804 with L1** | **L1 is required** to meet the under-1,000 target |

### 2.2 Design rules that keep cf-backup inside the budget

1. **One job per backup run.** GitHub bills per job, rounded up (consolidation report §2), so each extra job costs at least a minute plus its own setup. `doctor` → per-store steps → `seal` run as **steps in one job**. Each store step uses `continue-on-error`, and `seal` uses `if: always()`, so a store's failure never costs the other its backup.
2. **Pull the Supabase Postgres Docker image once per run** and use it for both `supabase db dump` and the drill.
3. **No setup that isn't needed:** install `wrangler` and the Supabase CLI alone, not a full `npm ci`.
4. **Anything a Worker can do costs 0 minutes.** GitHub's log archive, job timings and the account usage snapshot are fetched by cf-backup after the run (doc 11 §3), not by the runner.
5. **CI is one job with `concurrency: cancel-in-progress`**; docs-only changes skip the build and test steps.
6. **Daily Supabase dumps are the biggest line (~100 min).** If the budget ever tightens, OD-3's alternative (weekly only) halves cf-backup's cost, at the price of Supabase's recovery point going from 24 h to 7 days.

### 2.3 Levers outside cf-backup (ranked by minutes saved)

| # | Lever | Saves | Cost |
|---|---|---|---|
| L1 | **Move cf-astro's hourly heartbeat off GitHub Actions**, into cf-admin's existing `*/5` tick, calling cf-astro through the `ASTRO_SERVICE` binding that already exists | **~436** (measured: the heartbeat's 30-day total) | 24 service-binding calls/day: no extra requests, no new cron trigger |
| L2 | Merge cf-astro's `security.yml` into its `ci.yml` (consolidation report §7 already names it) | ~30 | none |
| L3 | Batch `sync-docs.yml` to once a day instead of per push | ~60 | the public docs mirror lags up to a day |

With L1, the combined total drops to roughly **770 min/month**, under 40% of the free allowance. L2 and L3 would take it near 680.

### 2.4 Keeping it visible

The console's Usage screen carries a **minutes line** (doc 11 §5.4). The GitHub App,
through tokens narrowed to Actions: read (doc 12 §6), sums per-job durations, rounded up the way GitHub bills, across the account's
private repos. It shows the month-to-date total against the 1,000 target and alerts at
80%. GitHub's own per-run billing field now returns 0 (*measured*), so the sum is computed
from job start and end times instead.

## 3. Old backups and their evidence in R2: room for years

Sizes are estimated until the bridge's first run measures them (P-22). A full run is
about 4 MB of data (three D1 exports ~0.5 MB + Supabase ~3.5 MB); a daily Supabase run is
about 3.5 MB. Evidence adds ~0.1–0.3 MB per run (logs, GitHub's archive, usage, proof).

| Retention the owner applies (manual, suggested by the console) | Backup storage |
|---|---|
| Keep everything | ~1.4 GB per year, evidence included |
| **Suggested:** dailies 30 days · weekly fulls 1 year · first full of each month forever | ~0.4 GB steady, **+~55 MB per year** |

- The 10 GB is **account-wide**: images, staff storage and ARCO documents share it. `wrangler r2 bucket info` reported **0 B** for all three existing buckets (*measured*), which contradicts live usage. The usage snapshot reads the R2 usage endpoint instead (doc 11 §5.4); until then take the baseline from the dashboard (§5 check 6).
- **Lock rules must match the prune schedule.** A 90-day lock on everything would block the 30-day daily prune, so the layout separates run classes: `v1/runs/full/` (90 days), `v1/runs/daily/` (30 days) and `v1/ops/` (90 days). See doc 03 §4.
- Nothing deletes itself (owner rule). The console proposes prune candidates from the schedule; the Owner or Vendor confirms; it is audited, a run's evidence goes with it, and the newest 4 good fulls are never offered.

## 4. Keys and old backups: rotation at $0

| Action | What happens | Cost |
|---|---|---|
| **Rotate the key** (routine) | New key into Vault, public half to GitHub, registry updated (doc 09 §3). **Old backups are not touched**: their key stays in Vault | 1 Vault insert, 1 GitHub API call, 1 settings row |
| **Re-key old backups** (optional; after a suspected leak, or to retire an old key for good) | **Header re-wrap**: an `age` file is a small header holding the file's own key, wrapped to the recipient, followed by the encrypted payload. cf-backup reads just the header, unwraps it with the old key from Vault, wraps it to the new key and recomputes the header MAC, then writes a new object: the new header followed by the **untouched** payload, streamed from R2 to R2 | Microseconds of CPU and 3 R2 operations per file. A year of backups (~2,000 files) takes ~6,000 operations of the 11M monthly allowance, processed 20 files per call, so about 8 hours on an hourly job |
| **Retire the old key completely** | Once re-keyed copies exist and the old copies' locks have expired, the owner prunes the old copies; the weekly key check (doc 09 §4) confirms nothing needs the old key; it is deleted from Vault | Free |

Notes:

- **Bucket locks forbid overwriting**, so re-keyed copies are *new* objects next to the originals (for example `…/data.sql.gz.<new-fp8>.age`); a `postrun/rekey-<date>.json` sidecar lists them.
- **What re-wrap does and does not protect.** It keeps the file's inner key. So someone who *already* used a leaked key to open a file header learned that file's key. Re-wrap protects against a leaked key being used *later*, which, combined with revoking storage access, is the realistic case. Files under a few MB (all of them today) can instead be fully re-encrypted if an incident calls for it.
- **To verify when building:** `chacha20-poly1305` availability in the Workers `node:crypto` (documented as fully supported; `x448`/`ed448` are the only named gaps). The fallback is a small audited pure-JavaScript library, which needs owner approval under the dependency policy.

## 5. Phase 0 checks: conditions that must hold

| # | Check | Why it matters | How |
|---|---|---|---|
| 1 | **Actions minutes after the consolidation** settle under target | The only binding limit | Owner: GitHub → Settings → Billing, for the full month after 2026-09-22; decide lever L1 |
| 2 | **Key 1 can do everything doc 12 §4.1 lists**: read every tracked analytics dataset, export D1, write to the backups bucket only | The usage screen and the pipeline depend on it | Create key 1 (doc 12) and run each call once; record which datasets answer and which are `unavailable`; confirm a write to another bucket is refused |
| 3 | **A Supabase project slot for restores**: both are active today | A restore into a new project needs a slot | Decide: pause `supabase-pink-village` when a restore needs the slot, or restore into a wiped existing project |
| 4 | **The Supabase org is managed through the Vercel Marketplace** (id prefix `vercel_icfg_`, plan `free`, *measured*) | The production database's account lifecycle is tied to a Vercel integration | Confirm what removing or changing the Vercel integration does to the projects, and whether the org can move to direct Supabase management at no cost |
| 5 | **Bucket locks work on this account's R2 tier**, refuse delete and overwrite, and **accept a new key under a locked prefix** | OD-5, and `postrun/` (spike S-9) | `wrangler r2 bucket lock add` on the new bucket, then try a delete, an overwrite and a new key |
| 6 | **Real R2 usage baseline** | The wrangler figure (0 B) is not trustworthy | Dashboard → R2 → per-bucket metrics, until the usage snapshot takes over |

## 6. Tripwires: what would push toward a paid plan, and the $0 answer first

The usage snapshot (doc 11) computes these as warnings; the viability view (Phase 3)
shows when each would be reached at the current growth.

| Tripwire | $0 answer |
|---|---|
| Combined Actions minutes pass 1,000 | Levers L1–L3; then OD-3's weekly-only Supabase dumps |
| R2 passes 8 GB account-wide | Apply the suggested prune schedule; move rarely-read staff files to the monthly mirror only |
| D1 daily write limit approached | Real-path drill moves from monthly to quarterly |
| Supabase database passes ~400 MB or egress passes ~4 GB | Weekly-only dumps; the next step would be a paid plan, a decision for the owner, not a default |

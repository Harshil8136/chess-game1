---
title: "cf-backend — 10 Free-tier feasibility and budget"
status: draft
audience: [owner, ai, technical, operator]
owner: harshil
related_docs: [README.md, 03-backup-pipeline.md, 06-roadmap.md, 09-key-management.md, ../../records/reports/2026-09-22-ci-workflow-consolidation.md]
tags: [program, cf-backend, free-tier, budget, github-actions, r2]
---

# 10 — Can all of this run on free tiers?

> **TL;DR: yes.** Cloudflare and Supabase have large headroom for everything in this
> plan, including years of old backups in R2 and key rotation with re-keying of old
> backups. **GitHub Actions minutes are the one binding limit.** They are shared by
> every private repo on the account, and the owner's target is a combined total
> **under 1,000 minutes a month**, half the free 2,000. The plan fits that target if the
> backup workflow is written as **one job per run** *and* cf-astro's hourly heartbeat
> moves off GitHub Actions (lever L1, §2.3). Without L1 the total lands near 1,100. Six things must be checked in
> Phase 0 (§5), including one hidden dependency: the Supabase organisation is
> **managed through Vercel**.

## 1. Verdict per service

*Measured* = checked live on 2026-09-21. *Docs* = vendor documentation read that day.
Other figures are standard plan limits, to be re-confirmed in Phase 0.

| Service | What the plan uses | Free limit | Plan's use | Verdict |
|---|---|---|---|---|
| Workers requests | edge Worker downloads; RPC calls | 100k/day, account-wide (*docs*) | RPC is **not** billed as extra requests (*docs*); a handful of downloads/day | ✅ Large headroom; guarded against scraping (§5 check 2) |
| Workers CPU | key generation, key check, manifest reads, header re-wrap | 10 ms/invocation; I/O wait excluded (*docs*) | each well under 1 ms; streams pass through untouched | ✅ |
| Subrequests | reconcile, re-key batches | 50 external / 1,000 to Cloudflare services (*docs*) | batches capped at 20 files | ✅ |
| Cron triggers | none new | 5/account (*docs*) | **+0**: GitHub owns the backup schedule; cf-admin's tick runs the rest | ✅ |
| Workers | `cf-backend` + `cf-backend-edge` | 100/account (*docs*) | +2 | ✅ |
| Workers Builds | 2 new Worker projects | 3,000 build min/month, **1 concurrent** (*docs*) | ~3 min per build; build watch paths so only the touched Worker builds | ✅ Builds queue behind other repos' |
| R2 storage | backups + staff storage + images + ARCO | 10 GB-month, account-wide | ~0.35–1.3 GB/year of backups (§3) | ✅ For years, with a manual prune schedule |
| R2 operations | uploads, lists, re-key | 1M Class A / 10M Class B per month | hundreds per month | ✅ |
| R2 bucket locks | `v1/runs/full/` (90 d) and `v1/runs/daily/` (30 d) | available (*docs*; plan tier **to verify** by creating one, §5) | 2 rules | ✅ |
| D1 | shared DB, monthly temporary drill DB | 5M reads / 100k writes per day, enforced since 2026-09-01 (*docs*) | drill writes ~2,425 rows/month (*measured*) | ✅ |
| Queues | backup alerts | 10,000 ops/day, 24 h retention (*docs*) | a few/week | ✅ |
| WAF rate limiting | guard for `storage.*` | **1 rule per zone**, 10 s window, IP, block (*docs*); zone is on the Free plan (*measured*) | 1 rule | ⚠️ **Only if that one rule is not already used** (§5 check 2) |
| Supabase database | backups read it | 500 MB | 17 MB (*measured*) | ✅ |
| Supabase egress | dumps | 5 GB/month | ~0.5 GB/month with daily dumps | ✅ ~10% |
| Supabase projects | a restore target | 2 active per free org | **2 of 2 active** (*measured*: `Cloudflare` + `supabase-pink-village`) | ⚠️ A restore into a new project needs a slot (§5 check 3) |
| Supabase Vault | backup private keys | included; extension on by default (*docs*) | a few 74-character secrets | ✅ |
| GitHub Actions minutes | backup runs + cf-backend CI | 2,000/month, shared by all private repos; each **job** rounds up to a whole minute | ~130–190 min/month (§2) | ⚠️ Within the < 1,000 target **only with one job per run and lever L1**; measured pace today ~1,739 |
| GitHub artifacts | 14-day second copy | 500 MB, shared | ~60 MB; 21.4 MB used today (*measured*) | ✅ |
| GitHub App, variables, secrets | dispatch, recipients, readiness | free | — | ✅ |
| Password managers | recovery kits | free individual plans | 2 people | ✅ |
| Brevo email | alerts | 300/day | a few/week | ✅ |
| Sentry | cf-backend errors | Developer plan, shared quota | low | ✅ |

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
| cf-admin push CI (`quality.yml`) | ~370 | Measured full run ~5 min (first run 2026-09-22); ~half of ~116 pushes documentation-only at ~1 min; + weekly audit. Replaces the measured 485 (`quality`) + 354 (`security`) + 249 (`Docs Quality`) |
| cf-admin `sync-docs.yml` | ~80 | ~81 runs/month, 1 job each (30-day count, 2026-09-21) |
| cf-admin `backups.yml` (bridge, until P1 retires it) | ~30 | 4 jobs weekly |
| cf-astro (all workflows) | **~570**, or **~130 with L1** | Measured 30 days: heartbeat ~436, CI ~86, security ~32, sync ~12 |
| **cf-backend `db-backup.yml`** | **~110–130** | one job per run: Mon–Sat Supabase-only ~4 min × 26, Sunday full ~6 min × 4, monthly real-path drill +2 |
| **cf-backend CI** | **~20–60** | one job per push, like cf-admin's consolidated `quality.yml`; high while building, low at steady state |
| **Total** | **~1,180–1,240 without L1 · ~740–800 with L1** | **L1 is required** to meet the under-1,000 target |

### 2.2 Design rules that keep cf-backend inside the budget

1. **One job per backup run.** GitHub bills per job, rounded up (consolidation report §2), so each extra job costs at least a minute plus its own setup. `doctor` → per-store steps → `seal` run as **steps in one job**. Each store step uses `continue-on-error`, and `seal` uses `if: always()`, so a store's failure still never costs the other its backup. P-6's independence is kept at the step level, and P-10's timeouts become `timeout-minutes` per step.
2. **Pull the Supabase Postgres Docker image once per run** (planned) and use it for both `supabase db dump` and the drill.
3. **No setup that isn't needed:** install `wrangler` and the Supabase CLI alone, not a full `npm ci`.
4. **CI is one job with `concurrency: cancel-in-progress`**, like cf-admin's `quality.yml`; docs-only changes skip the build and test steps.
5. **Daily Supabase dumps are the biggest line (~100 min).** If the budget ever tightens, OD-3's alternative (weekly only) halves cf-backend's cost, at the price of Supabase's recovery point going from 24 h to 7 days.

### 2.3 Levers outside cf-backend (ranked by minutes saved)

| # | Lever | Saves | Cost |
|---|---|---|---|
| L1 | **Move cf-astro's hourly heartbeat off GitHub Actions**, into cf-admin's existing `*/5` tick, calling cf-astro through the `ASTRO_SERVICE` binding that already exists | **~436** (measured: the heartbeat's 30-day total) | 24 service-binding calls/day: no extra requests, no new cron trigger |
| L2 | Merge cf-astro's `security.yml` into its `ci.yml` (consolidation report §7 already names it) | ~30 | none |
| L3 | Batch `sync-docs.yml` to once a day instead of per push | ~60 | the public docs mirror lags up to a day |

With L1, the combined total drops to roughly **770 min/month**, under 40% of the free allowance. L2 and L3 would take it near 680.

### 2.4 Keeping it visible

The readiness panel (doc 02 §5.1) gains a **minutes line**. Weekly, cf-backend sums
per-job durations (rounded up, the way GitHub bills) across the account's private repos
through the Actions API, using the GitHub App with read-only Actions access. It shows
the month-to-date total against the 1,000 target and alerts at 80%. GitHub's own
per-run billing field now returns 0 (*measured*), so the sum is computed from job
start and end times instead.

## 3. Old backups in R2: room for years

Sizes are estimated until the bridge's first run measures them (P-22). A full run is
about 4 MB (three D1 exports ~0.5 MB + Supabase ~3.5 MB); a daily Supabase run is
about 3.5 MB.

| Retention the owner applies (manual, suggested by the console) | Backup storage |
|---|---|
| Keep everything | ~1.3 GB per year |
| **Suggested:** dailies 30 days · weekly fulls 1 year · first full of each month forever | ~0.35 GB steady, **+~50 MB per year** |

- The 10 GB is **account-wide**: images, staff storage and ARCO documents share it. `wrangler r2 bucket info` reported **0 B** for all three existing buckets (*measured*), which contradicts live usage, so take the real baseline from the dashboard (§5 check 6).
- **Lock rules must match the prune schedule.** A 90-day lock on everything would block the 30-day daily prune. The layout therefore separates run classes: `v1/runs/full/` (locked 90 days) and `v1/runs/daily/` (locked 30 days). See doc 03 §4.
- Nothing deletes itself (owner rule). The console proposes prune candidates from the schedule; the owner or vendor confirms; it is audited, and the newest 4 good fulls are never offered.

## 4. Keys and old backups: rotation at $0

| Action | What happens | Cost |
|---|---|---|
| **Rotate the key** (routine) | New key into Vault, public half to GitHub, registry updated (doc 09 §3). **Old backups are not touched**: their key stays in Vault | 1 Vault insert, 1 GitHub API call, 1 settings row |
| **Re-key old backups** (optional; after a suspected leak, or to retire an old key for good) | **Header re-wrap**: an `age` file is a small header holding the file's own key, wrapped to the recipient, followed by the encrypted payload. cf-admin reads just the header, unwraps it with the old key from Vault, wraps it to the new key and recomputes the header MAC. cf-backend then writes a new object: the new header followed by the **untouched** payload, streamed from R2 to R2. The old private key never leaves cf-admin, and cf-backend never sees a key | Microseconds of CPU and 3 R2 operations per file. A year of backups (~2,000 files) takes ~6,000 operations of the 11M monthly allowance, processed 20 files per cf-admin tick, so about 8 hours |
| **Retire the old key completely** | Once re-keyed copies exist and the old copies' locks have expired, the owner prunes the old copies; coverage (doc 09 §4) confirms nothing needs the old key; it is deleted from Vault | Free |

Notes:

- **Bucket locks forbid overwriting**, so re-keyed copies are *new* objects next to the originals (for example `…/data.sql.gz.<new-fp8>.age`); the manifest's sidecar `rekey.json` lists them.
- **What re-wrap does and does not protect.** It keeps the file's inner key. So someone who *already* used a leaked key to open a file header learned that file's key. Re-wrap protects against a leaked key being used *later*, which, combined with revoking storage access, is the realistic case. Files under a few MB (all of them today) can instead be fully re-encrypted in the Worker if an incident calls for it.
- **To verify when building:** `chacha20-poly1305` availability in the Workers `node:crypto` (documented as fully supported; `x448`/`ed448` are the only named gaps). The fallback is a small audited pure-JavaScript library, which needs owner approval under the dependency policy.

## 5. Phase 0 checks: conditions that must hold

| # | Check | Why it matters | How |
|---|---|---|---|
| 1 | **Actions minutes after the consolidation** settle under target | The only binding limit | Owner: GitHub → Settings → Billing, for the full month after 2026-09-22; decide lever L1 |
| 2 | **The zone's single free rate-limit rule is unused**, and how many free custom WAF rules are left | The `storage.*` scrape guard needs that rule. A custom rule can also block every path outside the allow-list before the Worker runs, so scanners cost no requests | Dashboard → Security rules (the stored API token cannot read them, *measured*) |
| 3 | **A Supabase project slot for restores**: both are active today | A restore into a new project needs a slot | Decide: pause `supabase-pink-village` when a restore needs the slot, or restore into a wiped existing project |
| 4 | **The Supabase org is managed through the Vercel Marketplace** (id prefix `vercel_icfg_`, plan `free`, *measured*) | The production database's account lifecycle is tied to a Vercel integration | Confirm what removing or changing the Vercel integration does to the projects, and whether the org can move to direct Supabase management at no cost |
| 5 | **Bucket locks work on this account's R2 tier** | OD-5 depends on it | `wrangler r2 bucket lock add` on the new bucket, then try a delete |
| 6 | **Real R2 usage baseline** | The wrangler figure (0 B) is not trustworthy | Dashboard → R2 → per-bucket metrics |

## 6. Tripwires: what would push toward a paid plan, and the $0 answer first

| Tripwire | $0 answer |
|---|---|
| Combined Actions minutes pass 1,000 | Levers L1–L3; then OD-3's weekly-only Supabase dumps |
| R2 passes 8 GB account-wide | Apply the suggested prune schedule; move rarely-read staff files to the monthly mirror only |
| A leaked link is scraped | The zone rate-limit rule + per-token caps (no paid plan needed) |
| D1 daily write limit approached | Real-path drill moves from monthly to quarterly |
| Supabase database passes ~400 MB or egress passes ~4 GB | Weekly-only dumps; the next step would be a paid plan, a decision for the owner, not a default |

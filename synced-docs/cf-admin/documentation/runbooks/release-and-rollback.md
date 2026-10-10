---

title: "Release & Rollback Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-10-10
verified_against: [code, infra]
owner: harshil
related_code: [scripts/release.mjs, scripts/lib/release-guards.mjs, scripts/d1_schema_snapshot.mjs, src/pages/api/health.ts, package.json, .githooks/pre-push]
related_docs: [../operations/OPERATIONS.md, disaster-recovery.md, ../reference/schema-change-ledger.md, ../program/ROADMAP.md]
tags: [release, deploy, rollback, workers-builds, migrations, runbook]
---

# Release & Rollback Runbook

> **TL;DR (non-technical):** A push to `main` goes live automatically through
> Cloudflare. The checks run twice: on the computer that pushes (`npm run
> verify`, required before every push) and in GitHub's `quality` job after the
> push. Cloudflare only builds and deploys; since 2026-10-10 it no longer runs
> the checks a third time, which had made every deploy wait 4-6 extra minutes.
> Database changes are applied first, by hand, because rolling back code does
> not roll back the database. This page says what happens on a push and what
> to do when a release goes wrong.

## 1. The path (viability program chunk 3)

> **Where each check runs (2026-10-10).** The Workers Builds build command
> runs `npm run build:ci`: the owner switched it on after 2026-09-19, when this
> page recorded the default command. Since then a build took 6-10 minutes from
> the push (check-run completion against push time on `4b166d6`, `42e421f` and
> `ab6b0c7`, 2026-10-08 and 2026-10-09; a documentation-only push took 8
> minutes) against 1-3 minutes before, and the owner reports the build log
> running the tests. That was `verify` running a third time, after the
> workstation and before GitHub's `quality` job, so on 2026-10-10
> `release.mjs build --ci` became build-only (`buildVerifyStep` in
> `scripts/lib/release-guards.mjs`). The dashboard's deploy command cannot be
> read from here; `npm run deploy:ci` is the command it is meant to run.
> **Apply migrations by hand before you push** either way.

```text
git push origin main
  ├─ before the push (workstation): npm run verify   ← the only check that runs before the code is live
  ├─ Cloudflare Workers Builds (dashboard-side GitHub connection)
  │    ├─ build command   npm run build:ci   →  node scripts/release.mjs build --ci
  │    │      npm run build   (astro build; verify is NOT repeated here since 2026-10-10)
  │    └─ deploy command  npm run deploy:ci  →  node scripts/release.mjs deploy --ci
  │           schema drift check   node scripts/d1_schema_snapshot.mjs --check   (BLOCKING since chunk 5: exit 2 = drift → deploy stops; exit 1 = live schema unreadable → 3 tries, then deploy with a warning)
  │           migrations           wrangler d1 migrations list/apply madagascar-db --remote   ← BEFORE the code
  │           deploy               wrangler deploy   (refuses if a [secrets] required name is missing)
  │           smoke                GET /api/health through an Access service token; expects status ok and release == commit
  └─ GitHub Actions `quality` (after the push; does not stop the deploy)
         the verify chain, types:check, build, SBOM; documentation-only pushes skip the code steps
```

`npm run verify` is, at the time of writing:
`typecheck → ratchet → test:run → test:gates → rules_check.py → docs_check.py →
lint:md → a11y_check.py → audit_gate.py`. **`package.json` owns that chain** —
read it there rather than trusting this line. (Note what is *not* in it:
`types:check` is a separate step in `quality.yml`, and plain `lint` is
subsumed by the ratchet.)

Locally the same script runs the whole path with two extra stages:
`npm run release` = preflight (right remote, on `main`, clean tree, Node ≥ 22.12)
→ build (verify first, then `astro build`) → deploy → tag `release/<yyyymmdd>-<sha7>`.
Flags: `--skip-verify`, `--allow-dirty` (local only). `npm run cf:deploy` is an alias.

> `--ci` is also switched on implicitly by `CI=true` or `WORKERS_CI=1`
> (`scripts/release.mjs`), which is how a runner skips preflight, verify and
> tagging without anyone passing a flag.

**Why migrate before deploy.** Two production incidents in Sentry
(`no such table: blog_posts`, `no such table: storage_share_access_logs`) were
new code reaching users before its migration ran. The script makes that order
structural.

**Why the release id is the commit.** `astro.config.ts` sets `__BUILD_ID__`
to the commit SHA (`WORKERS_CI_COMMIT_SHA` on Builds, `GITHUB_SHA` on Actions,
`git rev-parse HEAD` locally). Sentry events carry `cf-admin@<sha>`, and
`GET /api/health` reports the same value, so "which commit is live?" has one
answer. Until 2026-09-02 the id was `Date.now()`, different on every build of
the same source.

## 2. Expand / contract — the rule every migration follows

`wrangler rollback` restores the previous Worker **code**; it never touches
D1. So a migration must be one the *currently running* code tolerates:

- **Expand** (add a table, add a nullable column, add an index, backfill) —
  ships freely.
- **Contract** (`DROP`, `ALTER … DROP|RENAME`, `TRUNCATE`) — only one release
  *after* the code stopped depending on it, and only with a header line
  `-- contract: <why this is safe for the running version>` plus a row in
  [`../reference/schema-change-ledger.md`](../reference/schema-change-ledger.md).
  `scripts/release.mjs` refuses to apply a destructive migration without the
  marker (guards in `scripts/lib/release-guards.mjs`, tested in `test/release-guards.test.ts`).

## 3. One-time switch-on (owner, dashboard)

The build command (step 2) has been set: see §1 for the evidence. The rest is
recorded here for a rebuild of the project or a check of the settings.

1. **Build token — grant D1.** Cloudflare dashboard → **Workers & Pages** →
   `cf-admin-madagascar` → **Settings** → **Build** → **API token**. The
   auto-generated token has Workers Scripts / KV / R2 edit but **no D1**;
   `deploy:ci` runs `wrangler d1 migrations apply --remote` and would fail.
   Either edit that user token (My Profile → API Tokens) to add
   **Account → D1 → Edit**, or create a token with: Account Settings *Read*,
   Workers Scripts *Edit*, Workers KV Storage *Edit*, Workers R2 Storage
   *Edit*, **D1 *Edit***, Zone → Workers Routes *Edit*; select it in Builds.
2. **Commands.** Same **Build** settings page: Build command `npm run build:ci`,
   Deploy command `npm run deploy:ci`. Root directory stays `/`. Node is
   pinned by `.nvmrc` (22), matching CI. Since 2026-10-10 the build stage runs
   no Python (it no longer runs `verify`).
3. **Smoke probe (optional, recommended).** Zero Trust → **Access** →
   **Service Auth** → create a service token named `cf-admin-release-smoke`;
   on the `cf-admin` Access application add a **Service Auth** policy for it.
   Then Builds → **Build variables and secrets**: `CF_ACCESS_CLIENT_ID` and
   `CF_ACCESS_CLIENT_SECRET` (as secrets). Without them the smoke stage logs a
   warning and is skipped — it never blocks a deploy on its own absence.
4. **Local pre-push gate (optional).** `git config core.hooksPath .githooks`
   runs `npm run verify` before every push (`git push --no-verify` to skip once).

## 4. Reading a release

**Nothing verifies what is live after a push today.** The smoke stage exists
only inside `deploy:ci`/`npm run release`, which production does not run (§1),
and it is skipped anyway without `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET`
— no such repository secret exists (Builds variables are dashboard-side and not
readable from a checkout). So the checks below are the **manual substitute**,
and somebody has to actually run them.

- **Did a commit deploy?** GitHub shows a check named
  `Workers Builds: cf-admin-madagascar` on every commit
  (`gh api repos/mascotasmadagascar-cmd/cf-admin-madagascar/commits/<sha>/check-runs`)
  with success/failure and a link to the build log.
- **What is live?** `GET https://secure.madagascarhotelags.com/api/health` (with
  a session, or an Access service token) → `release` is the commit SHA prefix.
  Anonymous callers get the liveness answer only (`status`, `release`,
  `timestamp`; no binding is touched). With a session or `X-Health-Key:
  <HEALTH_CHECK_SECRET>` the dependency checks (D1, R2, KV, Supabase) run.
- **Sentry**: events are tagged `cf-admin@<sha>`.

## 5. Rollback

| Situation | Do | Do not |
|---|---|---|
| Bad code, schema unchanged | `npx wrangler rollback` (or dashboard → Deployments → roll back) — instant, keeps secrets and bindings | re-deploy an older commit by hand from a laptop |
| Bad code after an **expand** migration | `wrangler rollback` — the old code ignores the new table/column by definition of expand | drop the new objects; the fix-forward commit may need them |
| Bad code after a **contract** migration | fix forward: a new migration that re-adds what was dropped, then deploy | `wrangler rollback` alone — the old code would hit the missing column |
| Wrong data written by a migration | a corrective forward migration (record it in the ledger) | D1 Time Travel, unless the damage is broad — the database is shared with cf-astro and Time Travel rewinds *everything* (7-day window on Workers Free; see [`disaster-recovery.md`](disaster-recovery.md) §2) |
| Deploy refused: "required secret missing" | `npx wrangler secret put <NAME>` then re-run the build | remove the name from `[secrets] required` to make it pass |
| Deploy refused: "live schema differs from database/schema.snapshot.sql" | production's schema is not what the tests ran against: `node scripts/d1_schema_snapshot.mjs`, commit the regenerated snapshot, push again | never edit the snapshot by hand — a hand edit in `8fcc3d6` left a stale header count that the drift check then flagged |
| Deploy refused: "migration blocked (contract)" | add the `-- contract:` line with the reason and the ledger row, or split the destructive step into a later migration | delete the guard |

## 6. Verification log

| Date | Checked by | Method | Result |
|------------|-----------|-------------------------------|------------------------|
| 2026-09-02 | claude | `node scripts/release.mjs preflight` (refuses a dirty tree; `--allow-dirty` passes), `node scripts/release.mjs migrate` against production (drift check clean, nothing pending), `test/release-guards.test.ts` (12), `test/api-health.test.ts` (4) | pass; Builds commands not yet switched (owner step §3) |
| 2026-09-19 | claude | `package.json` `verify`/`build:ci`/`deploy:ci` read; `.github/workflows/quality.yml` lines 9-16; Workers Builds vs `quality` check-run durations on `a9dd974` and `67a5cf6`; `d1_migrations` applied-at vs commit author times for `0052`/`0053`/`0054`; repository Actions secrets listed | **Builds still on its default command** — §1 rewritten with a banner and a target-state diagram; the `verify` chain, the Python-gate count, the `--ci` env triggers and the §5 snapshot row corrected. Not readable from here: the Build settings in the Cloudflare dashboard (the three lines above are inference from observable behaviour) |
| 2026-10-10 | claude | Workers Builds check-run completion vs push time on `4b166d6` (6 m 44 s), `42e421f` (8 m 04 s, docs only) and `ab6b0c7` (10 m 10 s); GitHub `quality` run durations on the same pushes (4-6.5 min, 25-35 s docs only); `scripts/release.mjs` build stage; `test/release-guards.test.ts` (14) | Build command is `build:ci` (inferred from durations and the owner's report of tests in the build log; the dashboard is not readable from here); `build --ci` made build-only; §1 banner and diagram rewritten. Not re-checked: the deploy command, the build token's D1 grant, the smoke token |

## 7. Related

- [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §7 — the command reference this runbook expands
- [`disaster-recovery.md`](disaster-recovery.md) — when a release is not the problem
- [`../reference/schema-change-ledger.md`](../reference/schema-change-ledger.md) — the third artifact of every schema change
- [`../program/ROADMAP.md`](../program/ROADMAP.md) — chunk 5 (drift check blocking since 2026-09-15) and chunk 6 (backups)

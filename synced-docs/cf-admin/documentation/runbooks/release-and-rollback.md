---

title: "Release & Rollback Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_code: [scripts/release.mjs, scripts/lib/release-guards.mjs, scripts/d1_schema_snapshot.mjs, src/pages/api/health.ts, package.json, .githooks/pre-push]
related_docs: [../operations/OPERATIONS.md, disaster-recovery.md, ../reference/schema-change-ledger.md, ../program/ROADMAP.md]
tags: [release, deploy, rollback, workers-builds, migrations, runbook]
---

# Release & Rollback Runbook

> **TL;DR (non-technical):** A push to `main` goes live automatically. There is
> a scripted path that would check everything, apply any database change,
> deploy, and then confirm the live site reports the commit just pushed — but
> **it is not switched on yet**, so today a push deploys the code and nothing
> else. Database changes must be applied by hand, first, because rolling back
> code does not roll back the database. This page says what actually happens
> today, what to click once to switch the full path on, and what to do when a
> release goes wrong.

## 1. The path (viability program chunk 3)

> 🚨 **Not switched on. Read this before the diagram.** Workers Builds is still
> running its **default** command (`npx wrangler deploy`). A push to `main`
> therefore deploys **without** `npm run verify`, **without** the schema drift
> check, **without** applying migrations, and **without** the smoke probe. The
> one-time owner step in §3 is what turns the diagram below into reality; §6
> records that it has not been taken.
>
> Evidence, three independent lines (2026-09-19):
>
> - `.github/workflows/quality.yml` lines 9-16 at HEAD still say these jobs "do
>   NOT gate that deploy" and name the switch as future work.
> - Workers Builds finishes 58 s–2 m 50 s after a push, while the `quality` job
>   (`npm ci` + `verify` — strictly less work than `build:ci`) takes 4 m 18 s–4 m 42 s
>   on the same commits.
> - Migrations `0052`, `0053` and `0054` were applied to production **3–17
>   minutes before the commits that introduced them were authored** — i.e. by
>   hand. `deploy:ci` would have applied them after.
>
> **Until the switch is taken: apply migrations by hand before you push**
> (`npx wrangler d1 migrations apply madagascar-db --remote`), and run
> `npm run verify` locally or rely on the pre-push hook (§3 step 4).

```text
git push origin main
  └─ Cloudflare Workers Builds (dashboard-side GitHub connection)
       │
       ├─ TODAY:  default command  npx wrangler deploy      ← no verify, no migrate, no smoke
       │
       └─ TARGET STATE (after the owner step in §3):
            ├─ build command   npm run build:ci   →  node scripts/release.mjs build --ci
            │      npm run verify  (the chain lives in package.json; do not restate it)
            │      npm run build   (astro build)
            └─ deploy command  npm run deploy:ci  →  node scripts/release.mjs deploy --ci
                   schema drift check   node scripts/d1_schema_snapshot.mjs --check   (BLOCKING since chunk 5: exit 2 = drift → deploy stops; exit 1 = live schema unreadable → 3 tries, then deploy with a warning)
                   migrations           wrangler d1 migrations list/apply madagascar-db --remote   ← BEFORE the code
                   deploy               wrangler deploy   (refuses if a [secrets] required name is missing)
                   smoke                GET /api/health through an Access service token; expects status ok and release == commit
```

`npm run verify` is, at the time of writing:
`typecheck → ratchet → test:run → test:gates → rules_check.py → docs_check.py →
lint:md → a11y_check.py → audit_gate.py`. **`package.json` owns that chain** —
read it there rather than trusting this line. (Note what is *not* in it:
`types:check` is a separate step in `quality.yml`, and plain `lint` is
subsumed by the ratchet.)

Locally the same script runs the whole path with two extra stages:
`npm run release` = preflight (right remote, on `main`, clean tree, Node ≥ 22.12)
→ build → deploy → tag `release/<yyyymmdd>-<sha7>`. Flags: `--skip-verify`,
`--allow-dirty` (local only). `npm run cf:deploy` is an alias.

> `--ci` is also switched on implicitly by `CI=true` or `WORKERS_CI=1`
> (`scripts/release.mjs`), which is how a runner skips preflight and tagging
> without anyone passing a flag.

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

Nothing changes until these are set; until then Builds keeps its default
`npx wrangler deploy` and the script is only used locally.

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
   pinned by `.nvmrc` (22), matching CI; the build image ships Python 3.13,
   which the Python gates in `verify` need (there are six entry points —
   `ratchet.py`, the `unittest` gate self-tests, `rules_check.py`,
   `docs_check.py`, `a11y_check.py`, `audit_gate.py`).
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

## 7. Related

- [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §7 — the command reference this runbook expands
- [`disaster-recovery.md`](disaster-recovery.md) — when a release is not the problem
- [`../reference/schema-change-ledger.md`](../reference/schema-change-ledger.md) — the third artifact of every schema change
- [`../program/ROADMAP.md`](../program/ROADMAP.md) — chunk 5 (drift check blocking since 2026-09-15) and chunk 6 (backups)

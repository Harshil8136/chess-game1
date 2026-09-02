---

title: "Release & Rollback Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-09-02
verified_against: [code, infra]
owner: harshil
related_code: [scripts/release.mjs, scripts/lib/release-guards.mjs, scripts/d1_schema_snapshot.mjs, src/pages/api/health.ts, package.json, .githooks/pre-push]
related_docs: [../operations/OPERATIONS.md, disaster-recovery.md, ../reference/schema-change-ledger.md, ../program/ROADMAP.md]
tags: [release, deploy, rollback, workers-builds, migrations, runbook]
---

# Release & Rollback Runbook

> **TL;DR (non-technical):** A push to `main` becomes the live portal through
> one scripted path: check everything, apply any database change, deploy the
> code, then probe the live site and confirm it reports the commit that was
> just pushed. Database changes go first because rolling back code does not
> roll back the database — so every change must be one the old code can live
> with. This page says how that path works, what to click once to switch it
> on, and what to do when a release goes wrong.

## 1. The path (viability program chunk 3)

```text
git push origin main
  └─ Cloudflare Workers Builds (dashboard-side GitHub connection)
       ├─ build command   npm run build:ci   →  node scripts/release.mjs build --ci
       │      npm run verify  (types:check → typecheck → lint → tests → rules_check → docs_check → a11y_check → audit_gate)
       │      npm run build   (astro build)
       └─ deploy command  npm run deploy:ci  →  node scripts/release.mjs deploy --ci
              schema drift check   node scripts/d1_schema_snapshot.mjs --check   (warn-only until chunk 5)
              migrations           wrangler d1 migrations list/apply madagascar-db --remote   ← BEFORE the code
              deploy               wrangler deploy   (refuses if a [secrets] required name is missing)
              smoke                GET /api/health through an Access service token; expects status ok and release == commit
```

Locally the same script runs the whole path with two extra stages:
`npm run release` = preflight (right remote, on `main`, clean tree, Node ≥ 22.12)
→ build → deploy → tag `release/<yyyymmdd>-<sha7>`. Flags: `--skip-verify`,
`--allow-dirty` (local only). `npm run cf:deploy` is an alias.

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
   which the four Python gates need.
3. **Smoke probe (optional, recommended).** Zero Trust → **Access** →
   **Service Auth** → create a service token named `cf-admin-release-smoke`;
   on the `cf-admin` Access application add a **Service Auth** policy for it.
   Then Builds → **Build variables and secrets**: `CF_ACCESS_CLIENT_ID` and
   `CF_ACCESS_CLIENT_SECRET` (as secrets). Without them the smoke stage logs a
   warning and is skipped — it never blocks a deploy on its own absence.
4. **Local pre-push gate (optional).** `git config core.hooksPath .githooks`
   runs `npm run verify` before every push (`git push --no-verify` to skip once).

## 4. Reading a release

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
| Deploy refused: "migration blocked (contract)" | add the `-- contract:` line with the reason and the ledger row, or split the destructive step into a later migration | delete the guard |

## 6. Verification log

| Date | Checked by | Method | Result |
|------------|-----------|-------------------------------|------------------------|
| 2026-09-02 | claude | `node scripts/release.mjs preflight` (refuses a dirty tree; `--allow-dirty` passes), `node scripts/release.mjs migrate` against production (drift check clean, nothing pending), `test/release-guards.test.ts` (12), `test/api-health.test.ts` (4) | pass; Builds commands not yet switched (owner step §3) |

## 7. Related

- [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §7 — the command reference this runbook expands
- [`disaster-recovery.md`](disaster-recovery.md) — when a release is not the problem
- [`../reference/schema-change-ledger.md`](../reference/schema-change-ledger.md) — the third artifact of every schema change
- [`../program/ROADMAP.md`](../program/ROADMAP.md) — chunks 5 (drift check becomes blocking) and 6 (backups)

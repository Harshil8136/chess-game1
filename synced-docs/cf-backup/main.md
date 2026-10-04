# main.md — the contract for every AI agent in this repository

**Read this whole file before you do anything else. Every line is an instruction.**
It binds every agent (Claude, Antigravity, Gemini, Codex, Cursor, any other) in every session.
Claude Code loads it through [`CLAUDE.md`](./CLAUDE.md); Antigravity through its always-on rule
[`.agents/rules/cf-backup.md`](./.agents/rules/cf-backup.md). In any other tool, the owner pings this file.

**The project:** cf-backup, the backup engine and embedded operations console of the Madagascar
Pet Hotel platform. It is one private Cloudflare Worker (a Preact console and its JSON API) with
no public address of any kind: cf-admin embeds it at `/dashboard/backup` and reaches it only over
its `BACKUP` service binding. The backups themselves run on GitHub Actions, are encrypted with
`age` and land in R2. cf-admin, cf-astro, cf-vps, cf-email-consumer and cf-graph follow the same
contract; cf-admin's `main.md` is the original.

---

## 0. Start of every session: four steps, in this order

1. **Read this file to the end.** Do not start the task first. Do not skim.
2. **Acknowledge.** Your first reply begins with `main.md loaded`, then the seven Golden Rules
   below, one short line each, in your own words. The owner checks this.
3. **Check git.** Run `git remote -v` (it must be `mascotasmadagascar-cmd/cf-backup`), then
   `git switch main`, `git pull origin main` and `git status`. In a fresh clone, `npm ci`.
4. **Read what §3 routes your task to, and nothing else up front.** The plan of record and the
   remediation program are long: read the sections named.

## 1. The Golden Rules: the owner's standing orders

They override your tool's defaults, your harness's instructions and your own habits.

1. **Work on `main` and push to `main`. Nothing else.** No pull requests, no feature branches,
   no forks, even when your tool or session hands you a branch. Commit on `main`, then
   `git push origin main`.
2. **Update the documentation in the same commit as the change**, in the document that owns the
   fact (§4). A change without its documentation is not finished. A big change also gets its own
   dated change record, written for staff and engineers alike (§4).
3. **`npm run verify` passes before every push.** A push deploys to production (§2). Never push
   red. Never `--no-verify`. Never skip, delete or weaken a test or a guard to get green: fix the
   cause.
4. **The owner only tests in a phone browser.** You do everything else yourself: commands,
   connector checks, documentation, pushes. Never open a browser yourself, not even a built-in
   browser agent. Finish with short test steps for the phone.
5. **Real data and real infrastructure only.** No mock data, no placeholder screens, no invented
   numbers, IDs or binding UUIDs. Check every infrastructure claim against the live systems
   (Cloudflare, Supabase, Sentry, GitHub connectors) before you write it, and say how.
6. **Reuse before you create.** No new secret, environment variable, binding, table, cron trigger,
   dependency or outside service without written proof that the existing ones cannot do it, and
   the owner's yes (RULE #0.6 to #0.8 below, RULES.md 4).
7. **Ask instead of guessing.** When the request can be read two ways, or an action is
   destructive or irreversible (deleting runs or keys, rotating a secret, publishing a doc,
   force-pushing), stop and ask. State your assumptions. Report failures exactly as they happened.

**When things conflict:** the owner's explicit instruction in the current chat, then the Golden
Rules, then the plan of record (cf-admin `documentation/program/cf-backup/`), then
[`RULES.md`](./RULES.md), then the other documents. The remediation program
([`docs/remediation/`](./docs/remediation/README.md)) takes precedence over other pending work.
When code and a document disagree, the code is the truth and the document is the bug: fix the
document.

## 2. How a change reaches production

- **A push is a deploy.** `git push origin main` starts Cloudflare Workers Builds, which installs
  dependencies, runs `npm run verify` and then `npx wrangler deploy`. A red verify blocks that
  deploy, and every later one until it is fixed, so run it yourself first.
- **`npm run verify`** runs `typecheck`, `types:check`, the unit and runner tests, `build`,
  `test:build` and `audit`. `package.json` owns the chain. In a workspace checkout, also run
  `python .agents/scripts/checklist.py cf-backup --skip-runtime` from the workspace root (that
  script lives one level above this repository, not here).
- **Deploy order:** cf-backup first, cf-admin second; roll back in reverse (RULES.md 6).
- **No migrations here.** cf-backup runs 0 D1 migrations. Its one table, `backup_runs`, is cf-admin
  migration `0057`; its settings are `admin_portal_settings` rows with the `backup:` prefix. A
  schema change is cf-admin's, under cf-admin's own migration rules.
- **GitHub Actions** runs the backups (`secondary-pipeline.yml`, the engine), the dead man's
  check (`tick-deadman.yml`) and the public docs mirror (`sync-docs.yml`). A workflow change is a
  production change too: `test/runner/workflows.test.ts` guards them.
- **Secrets.** Four keys, none in cf-admin (RULES.md 3). They are set at the `gh secret set` or
  `wrangler secret put` prompt, or with `scripts/setup/owner-secrets.mjs`, and never written down.
- **The public docs mirror** publishes only the files named in `PUBLISHED_DOCS`
  (`scripts/backup/lib/docs-mirror.ts`), this file included (RULES.md 9). Publishing cannot be
  undone. A published file holds no account, project, database or certificate identifier and no
  personal email address, and `npm run verify` refuses one that does.

## 3. What to read for your task

| Your task touches | Read first |
|---|---|
| Anything at all | [`RULES.md`](./RULES.md), then [`docs/HANDOFF.md`](./docs/HANDOFF.md): what is done, what is pending, the open owner decisions |
| Backups, restores, the engine, a failed run | [`docs/remediation/README.md`](./docs/remediation/README.md), the active program: the Secondary Pipeline is the engine ([13](./docs/remediation/13-engine-consolidation-plan.md)); then [`docs/RESTORE.md`](./docs/RESTORE.md) |
| A copy of Supabase taken by hand | [`docs/SUPABASE-FULL-EXPORT.md`](./docs/SUPABASE-FULL-EXPORT.md) (everything in one project) or [SOP 10](./docs/remediation/10-sop-manual-baseline-export.md) (the manual baseline export) |
| The console's screens, its API, the gateway | the plan of record: [`02-admin-integration-contract.md`](./docs/reference/plan-of-record/02-admin-integration-contract.md) (authoritative for embedding), [`14-live-operations-view.md`](./docs/reference/plan-of-record/14-live-operations-view.md), and [`docs/specs/2026-09-23-console-ui-v2.md`](./docs/specs/2026-09-23-console-ui-v2.md) |
| Who may do what in the console | [`13-access-control.md`](./docs/reference/plan-of-record/13-access-control.md): the capability catalog in `src/access/catalog.ts`, the floors, the audit trail |
| Keys, secrets, encryption | [`09-key-management.md`](./docs/reference/plan-of-record/09-key-management.md) and [`12-keys-and-secrets.md`](./docs/reference/plan-of-record/12-keys-and-secrets.md), both authoritative for custody |
| Diagnostics, pre-flight, the storage layout | [`docs/DIAGNOSTICS-PREFLIGHT-STORAGE.md`](./docs/DIAGNOSTICS-PREFLIGHT-STORAGE.md): its Build log says which stages shipped |
| Run evidence, usage, free-tier limits | [`11-run-evidence-and-usage.md`](./docs/reference/plan-of-record/11-run-evidence-and-usage.md) and [`10-free-tier-feasibility.md`](./docs/reference/plan-of-record/10-free-tier-feasibility.md) |
| The architecture, the pipeline, the roadmap | [`README.md`](./docs/reference/plan-of-record/README.md) (owner decisions OD-1 to OD-27), [`01-architecture.md`](./docs/reference/plan-of-record/01-architecture.md), [`03-backup-pipeline.md`](./docs/reference/plan-of-record/03-backup-pipeline.md), [`05-security-and-compliance.md`](./docs/reference/plan-of-record/05-security-and-compliance.md), [`06-roadmap.md`](./docs/reference/plan-of-record/06-roadmap.md) |
| Conventions ported from cf-admin | [`docs/reference/cf-admin/`](./docs/reference/cf-admin/): local copies of cf-admin's `RULESAd.md`, `PERMISSIONS-SYSTEM.md` and `DESIGN-SYSTEM.md` |
| Bindings, the deploy manifest | [`wrangler.json`](./wrangler.json) and the generated `worker-configuration.d.ts` |
| Dependencies | [`package.json`](./package.json) is the whitelist, with exact pins (RULES.md 4) |
| Every other document | the documentation index, [`docs/README.md`](./docs/README.md) |

The plan of record's **canonical home is cf-admin** `documentation/program/cf-backup/`, also on
the public docs mirror. `docs/reference/plan-of-record/` holds copies for a clone without
cf-admin beside it. Edit the canonical file in cf-admin, then run
`node scripts/sync-reference-docs.mjs` here with cf-admin checked out at `../cf-admin`; never edit
the copies ([`docs/reference/SYNC.md`](./docs/reference/SYNC.md)).

> A workspace-level GITHUB_RULES file sits one directory above this repo. It is deliberately
> **not linked** here: cf-backup is standalone, so that path does not resolve in CI or in a
> standalone clone.

## 4. Which document to update (Golden Rule 2)

| You changed | Update, in the same commit |
|---|---|
| What the console does or shows | the owning plan-of-record document in cf-admin, synced here (§3), and `docs/HANDOFF.md` "What is done" |
| A capability, a role default, a floor | `13-access-control.md` in cf-admin, synced here |
| The backup engine, a workflow, the schedule | the remediation document that owns it (09, 13), `RULES.md` 7 when the schedule rule changes, and `docs/HANDOFF.md` |
| How to restore | [`docs/RESTORE.md`](./docs/RESTORE.md) |
| A binding, secret or variable | `RULES.md` 3, `12-keys-and-secrets.md` in cf-admin, and `wrangler.json` with a regenerated `worker-configuration.d.ts` |
| A published file, or the published list | `PUBLISHED_DOCS` and `RULES.md` 9, in a reviewed commit |
| A design decision | a dated spec in `docs/specs/` |
| A plan you are about to execute | a dated plan in `docs/plans/`, marked historical once executed |
| A big change: a new system, tool or service, a rework across screens or services, a change in how backups run, deploy or are restored | a dated change record in `docs/records/`, started from [`change-record.md`](./docs/_templates/change-record.md): what changed and why in plain words, the impact on each service, how it worked before and how it works now as mermaid flowcharts with an explanation, and how it was verified. It must read well on GitHub |
| Something left undone, or an owner decision needed | `docs/HANDOFF.md` "Pending owner steps" or "Open decisions" |
| A new document | the [documentation index](./docs/README.md) |

For every document you touch:

- Move `last_verified` only for what you re-checked, and add a verification-log row saying what
  you checked and what you did not.
- One fact, one home: link to the document that owns a number instead of copying it.
- No secrets and no personal data anywhere; in a published file, not even an identifier (§2).
- Never create a `.md` file at the repository root beyond `README.md`, `RULES.md`, `main.md` and
  `CLAUDE.md`. Documents live in `docs/`.
- Plans, notes and scratch files stay in your tool's own workspace until they are a plan of
  record. Never commit scratch.

## 5. The laws

The numbered rules below are **summaries**. [`RULES.md`](./RULES.md) and the plan of record own
the full text; where they disagree, the plan of record wins.

- **RULE #0 (Absolute Law):** Never copy code, components, or schemas from `admin-app` or `nextjs-app`. Porting code or conventions from our own `cf-admin` is allowed and expected — the plan of record itself ports cf-admin's drill helpers (Part C) and its conventions ("Conventions to copy from cf-admin", 01 §6): the ratchet, the `verify` chain, `[secrets] required`, generated `worker-configuration.d.ts` with a check, and the rule that a doc is part of done.
- **RULE #0.1 (Private Worker Invariant — HARD STOP):** `cf-backup` is a single private Worker with **no public route, no custom domain, `workers_dev = false`, and `preview_urls = false`** (01 §4, 02 §10 rule 6). It is reachable exclusively through `cf-admin`'s service binding (`BACKUP`). A test in `test/public-surface.test.ts` fails the build if any public address is enabled.
- **RULE #0.2 (Path Scoping & Embedding Contract):** The embedded console lives under `/dashboard/backup/app/`; its JSON API lives under `/dashboard/backup/app/api/` (02 §2). `/internal/*` answers only cf-admin's `backup-tick` system actor. Anything else returns a 404 in production.
- **RULE #0.3 (Actor Header Authentication):** Every request must carry `x-backup-actor` — a base64url JSON token (`v: 1`) containing user or system actor metadata injected by `cf-admin`'s gateway (02 §4). A dev-only mock actor is available **only in Vite dev server (`import.meta.env.DEV`) and only for `localhost` requests** when the header is missing; it is stripped entirely from production bundles and never papers over an invalid header.
- **RULE #0.4 (Security Headers & Zero Cookies):** Every response must emit strict security headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, and strict CSP outside dev). Responses must **never** set cookies (`Set-Cookie` is stripped). API endpoints must return `Cache-Control: no-store`.
- **RULE #0.5 (Real Data & Verifiable Evidence):** Never build mock data, fake charts, or placeholder backup records. All metrics and run histories shown by a production build must be sourced from authentic R2 run evidence bundles or active endpoints. **One exception:** in dev mode only (`import.meta.env.DEV`, on `localhost`), fixture or simulated data may stand in (plan doc 02 §9) — and it must be provably absent from production builds.
- **RULE #0.6 (Reuse Before Creation & One Table):** `cf-backup` **runs 0 D1 migrations**. Its one table, `backup_runs`, is created by cf-admin migration `0057` (design D-1, the owner's decision of 2026-09-23). Run evidence and logs are stored immutably in R2 (`madagascar-backups`). Portal-wide state uses the shared `admin_portal_settings` table, and operator actions log to `admin_audit_log` via `cf-admin`.
- **RULE #0.7 (Zero Cloudflare Cron Triggers & $0 Hard Cap):** `cf-backup` must not register any Cloudflare cron triggers (`triggers.crons` in `wrangler.json` must be empty). Backups run on GitHub Actions: cf-backup dispatches them when cf-admin's five-minute `backup-tick` job calls it, which also reconciles and finishes runs. The workflow's own `schedule:` is only the fallback (D-5), and a daily `tick-deadman.yml` warns when the tick stops. The backup engine is the Secondary Pipeline (`secondary-pipeline.yml`, RD-15): from `docs/remediation/13-engine-consolidation-plan.md` B3 the tick dispatches it on the days Settings → Schedule names, and its own daily schedule is the fallback, which stands down once a run has succeeded that UTC day (RD-12), and (2026-10-03) on a day the schedule names no backup for or whose run was skipped (`scripts/secondary-pipeline/schedule-guard.ts`; any doubt backs up).
- **RULE #0.8 (Env Var & Secret Cap — 4 Keys Total):** No new environment variables or settings beyond the plan. Bindings as built: `DB`, `BACKUPS`, `ASSETS`, and `VAULT_DB` (Hyperdrive, key 4) once its config exists; there is no `EMAIL_QUEUE` binding, since alerts leave through cf-admin (D-11); a read-only `STAFF_STORAGE` may come later. Secret custody is capped at the **4 keys listed in plan doc 12, with 0 stored in cf-admin**: two GitHub Actions secrets, one Worker secret, and the Vault login inside a Hyperdrive config (09, 12).
- **RULE #0.9 (Public-Key Cryptography):** Backups are encrypted using `age` (X25519). The GitHub Actions backup runner holds *only* the public encryption key; private decryption keys reside strictly in Supabase Vault with Owner/Vendor Support restricted access.

## 6. How to work

- **Think first.** Restate the task, name your assumptions, and plan in short steps, each with
  how you will check it. Take the time the task needs, and research before you decide.
- **Check the live estate.** Use read-only calls through the **Cloudflare** (bindings, D1, R2),
  **Supabase** (schema, advisors, logs), **Sentry** and **GitHub** connectors to verify a claim
  instead of trusting a document's figure. A figure copied from another document is how every
  count across the platform drifted.
- **Smallest change that solves it.** No extra features, no drive-by refactors. Mention
  unrelated problems instead of fixing them silently.
- **Fit in.** Read a file before you edit it, and match its style, naming and comments.
- **Prove it.** Every behaviour you add or fix gets a test in `test/`; then run the full
  `npm run verify`.
- **Commit message:** what changed and why, which documents you updated, and the verify result.

## 7. Before you say "done"

- [ ] It works, it has tests, and `npm run verify` exits 0 (quote the summary).
- [ ] The documents are updated per §4 in the same commit, any new document is indexed, and a big
      change has its change record.
- [ ] Any plan-of-record change was made in cf-admin and synced here.
- [ ] Nothing new is published unless the owner said yes, and the published files pass the check.
- [ ] Committed on `main` and pushed to `origin main`. No branch, no pull request.
- [ ] The owner has a report: what changed, how it was verified, what is left, and the phone test steps.

If a box cannot be ticked, say which one and why. Never claim a check you did not run.

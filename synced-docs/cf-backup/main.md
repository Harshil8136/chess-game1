# Start Here (AI & Contributor Entry Point)

This repository is **cf-backup** — the Cloudflare-native backup engine and embedded operations console for the Madagascar Pet Hotel platform. Read the documentation and architecture specifications before changing code.

## Read these first, in order

0. [`docs/remediation/README.md`](./docs/remediation/README.md) — **the active data protection
   remediation program** (2026-09-25): no recovery point exists yet; its plan and decisions take
   precedence over other pending work.
1. [`docs/HANDOFF.md`](./docs/HANDOFF.md) — read this first when resuming: what is done,
   what is pending, the rulings made along the way, and the open decisions for the owner.
2. [`docs/plans/2026-09-23-start-p0-p1a.md`](./docs/plans/2026-09-23-start-p0-p1a.md) — the Start Plan (Phase 0 unblock, Phase 1a skeleton, Part B build tasks). Historical: that build is done and deployed; `docs/HANDOFF.md` holds the current state.
3. The **Plan of Record & Architecture Specifications**. Copied locally under
   [`docs/reference/plan-of-record/`](./docs/reference/plan-of-record/) for a clone that
   does not have `cf-admin` checked out beside it; the **canonical home is cf-admin**
   `documentation/program/cf-backup/` (also published on the public docs mirror). If you
   have `cf-admin` beside this repo, re-run `node scripts/sync-reference-docs.mjs` to
   refresh the local copies from it.
   - [`README.md`](./docs/reference/plan-of-record/README.md) — the executive plan of record, owner decisions table (OD-1…OD-27), and $0 budget ledger.
   - [`01-architecture.md`](./docs/reference/plan-of-record/01-architecture.md) — the private Worker architecture, service bindings, failure isolation, and runtime lifecycle.
   - [`02-admin-integration-contract.md`](./docs/reference/plan-of-record/02-admin-integration-contract.md) — **authoritative** for the embedding contract: the cf-admin gateway, `X-Backup-Actor` header schema, same-origin iframe embedding, frame-header exception, and local dev actor protocol.
   - [`03-backup-pipeline.md`](./docs/reference/plan-of-record/03-backup-pipeline.md) — the backup pipeline: D1/Supabase/R2 scope, R2 bucket layout, bucket lock policies, and verification drills.
   - [`05-security-and-compliance.md`](./docs/reference/plan-of-record/05-security-and-compliance.md) — threat model, secrets inventory, GitHub Actions free limits, and data protection compliance.
   - [`06-roadmap.md`](./docs/reference/plan-of-record/06-roadmap.md) — full rollout roadmap (Phases P0 through P4) and rollback strategies.
   - [`08-existing-backup-workflow.md`](./docs/reference/plan-of-record/08-existing-backup-workflow.md) — historical analysis of the legacy backup workflow and the Phase 0 bridge.
   - [`09-key-management.md`](./docs/reference/plan-of-record/09-key-management.md) & [`12-keys-and-secrets.md`](./docs/reference/plan-of-record/12-keys-and-secrets.md) — **authoritative** for secret custody: the 4-secret architecture, `age` public-key encryption, and Supabase Vault custody.
   - [`10-free-tier-feasibility.md`](./docs/reference/plan-of-record/10-free-tier-feasibility.md) — free-tier feasibility ledger and quota tripwires.
   - [`11-run-evidence-and-usage.md`](./docs/reference/plan-of-record/11-run-evidence-and-usage.md) — the run evidence policy: write-once R2 evidence bundles and resource receipts; evidence stays in R2, and the one D1 table is `backup_runs`.
   - [`13-access-control.md`](./docs/reference/plan-of-record/13-access-control.md) — the console's capability catalog (25 as built, with the Files section's two), role floors, and audit trails.
   - [`14-live-operations-view.md`](./docs/reference/plan-of-record/14-live-operations-view.md) — live operations view, R2 heartbeats, and polling transports.
4. [`RULES.md`](./RULES.md) — the repo's own rules file; where it and the plan of record
   disagree, the plan wins.
5. [`docs/reference/cf-admin/`](./docs/reference/cf-admin/) — local copies of cf-admin's
   own `RULESAd.md`, `PERMISSIONS-SYSTEM.md` and `DESIGN-SYSTEM.md`, for the conventions
   this repo ports from cf-admin (RULE #0 below).
6. [`wrangler.json`](./wrangler.json) — the Worker deployment manifest (defines assets binding, `workers_dev: false`, `preview_urls: false`, single-page application handling).
7. [`package.json`](./package.json) — script runner, dependency pins, and verification chain.

> A workspace-level GITHUB_RULES file sits one directory above this repo. It is
> deliberately **not linked** here: cf-backup is standalone, so that path does not
> resolve in CI or standalone clones. cf-backup is built and deployed independently
> via Cloudflare Workers Builds.

## Working agreement

The numbered rules below are **summaries**. The Plan of Record in `cf-admin` owns the full text; where they disagree, the Plan of Record wins.

- **RULE #0 (Absolute Law):** Never copy code, components, or schemas from `admin-app` or `nextjs-app`. Porting code or conventions from our own `cf-admin` is allowed and expected — the plan of record itself ports cf-admin's drill helpers (Part C) and its conventions ("Conventions to copy from cf-admin", 01 §6): the ratchet, the `verify` chain, `[secrets] required`, generated `worker-configuration.d.ts` with a check, and the rule that a doc is part of done.
- **RULE #0.1 (Private Worker Invariant — HARD STOP):** `cf-backup` is a single private Worker with **no public route, no custom domain, `workers_dev = false`, and `preview_urls = false`** (01 §4, 02 §10 rule 6). It is reachable exclusively through `cf-admin`'s service binding (`BACKUP`). A test in `test/public-surface.test.ts` fails the build if any public address is enabled.
- **RULE #0.2 (Path Scoping & Embedding Contract):** The embedded console lives under `/dashboard/backup/app/`; its JSON API lives under `/dashboard/backup/app/api/` (02 §2). `/internal/*` answers only cf-admin's `backup-tick` system actor. Anything else returns a 404 in production.
- **RULE #0.3 (Actor Header Authentication):** Every request must carry `x-backup-actor` — a base64url JSON token (`v: 1`) containing user or system actor metadata injected by `cf-admin`'s gateway (02 §4). A dev-only mock actor is available **only in Vite dev server (`import.meta.env.DEV`) and only for `localhost` requests** when the header is missing; it is stripped entirely from production bundles and never papers over an invalid header.
- **RULE #0.4 (Security Headers & Zero Cookies):** Every response must emit strict security headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, and strict CSP outside dev). Responses must **never** set cookies (`Set-Cookie` is stripped). API endpoints must return `Cache-Control: no-store`.
- **RULE #0.5 (Real Data & Verifiable Evidence):** Never build mock data, fake charts, or placeholder backup records. All metrics and run histories shown by a production build must be sourced from authentic R2 run evidence bundles or active endpoints. **One exception:** in dev mode only (`import.meta.env.DEV`, on `localhost`), fixture or simulated data may stand in (plan doc 02 §9) — and it must be provably absent from production builds.
- **RULE #0.6 (Reuse Before Creation & One Table):** `cf-backup` **runs 0 D1 migrations**. Its one table, `backup_runs`, is created by cf-admin migration `0057` (design D-1, the owner's decision of 2026-09-23). Run evidence and logs are stored immutably in R2 (`madagascar-backups`). Portal-wide state uses the shared `admin_portal_settings` table, and operator actions log to `admin_audit_log` via `cf-admin`.
- **RULE #0.7 (Zero Cloudflare Cron Triggers & $0 Hard Cap):** `cf-backup` must not register any Cloudflare cron triggers (`triggers.crons` in `wrangler.json` must be empty). Backups run on GitHub Actions: cf-backup dispatches them when cf-admin's five-minute `backup-tick` job calls it, which also reconciles and finishes runs. The workflow's own `schedule:` is only the fallback (D-5), and a daily `tick-deadman.yml` warns when the tick stops.
- **RULE #0.8 (Env Var & Secret Cap — 4 Keys Total):** No new environment variables or settings beyond the plan. Bindings as built: `DB`, `BACKUPS`, `ASSETS`, and `VAULT_DB` (Hyperdrive, key 4) once its config exists; there is no `EMAIL_QUEUE` binding, since alerts leave through cf-admin (D-11); a read-only `STAFF_STORAGE` may come later. Secret custody is capped at the **4 keys listed in plan doc 12, with 0 stored in cf-admin**: two GitHub Actions secrets, one Worker secret, and the Vault login inside a Hyperdrive config (09, 12).
- **RULE #0.9 (Public-Key Cryptography):** Backups are encrypted using `age` (X25519). The GitHub Actions backup runner holds *only* the public encryption key; private decryption keys reside strictly in Supabase Vault with Owner/Vendor Support restricted access.
- Prefer understanding via the documentation; consult the codebase for implementation specifics.
- Available MCP connectors for verification/research: **Cloudflare** (bindings, D1 queries, docs), **Supabase** (schema, advisors, logs), **Sentry** (issues, events), and **GitHub**. Use read-only calls to verify claims against live infrastructure rather than trusting a doc's stated figure.
- **Do not open a browser to test** — request that the maintainer run manual browser checks and report back.
- **Pre-Flight Verification:** Before declaring any task finished, execute both verification gates:
  1. **In-Repo Verification:** `npm run verify` from `cf-backup/` (runs `typecheck`, `types:check`, `test` [unit], `build`, `test:build`, and `audit`).
  2. **Workspace Pre-Flight Checklist** (workspace checkouts only): `python .agents/scripts/checklist.py cf-backup --skip-runtime` from the workspace root (`Madagascar Project/`).

> [!IMPORTANT]
> **Research & Reasoning Protocol:**
> For any task or plan: take as long as needed, think deeply, and research extensively.
> Verify infrastructure claims against the live estate through the MCP connectors listed
> above before writing them into a document — a figure copied from another document is
> how every count across the platform drifted.

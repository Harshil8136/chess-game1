---
title: "cf-backend — 05 Security and compliance"
status: draft
audience: [owner, ai, technical]
owner: harshil
related_docs: [README.md, 01-architecture.md, 03-backup-pipeline.md]
tags: [program, cf-backend, security, compliance, secrets]
---

# 05 — Security and compliance

A backup system concentrates **all** the platform's personal data in one place. It is
the most valuable target we will build, so this document is not optional reading.

## 1. Threat model

| # | Threat | Control |
|---|---|---|
| T1 | Internet caller reaches operational functions | No HTTP route to `BackendRPC`; `workers_dev`/preview URLs off; public router is a closed table with a test (doc 02 §6 rule 7) |
| T2 | A compromised or buggy cf-admin route abuses cf-backend | cf-backend re-checks `minRole`, cooldowns and idempotency per capability; destructive capabilities (prune, revoke-all) need typed confirmation and are owner-only |
| T3 | Leaked GitHub secret | Every GitHub secret is scoped to one job's need (§2). The R2 token reaches only `madagascar-backups`, and the bucket lock stops deletion. The runner never holds a decryption key |
| T4 | Leaked backup artefact | Public-key encrypted; the private key lives in Supabase Vault, a different provider (doc 09). Downloads are Owner/Vendor-only, audited, and streamed encrypted |
| T5 | Script injection in the workflow | No `${{ }}` inside `run:`; inputs via `env:`; `workflow_dispatch` inputs validated against an enum; actions pinned by SHA; `permissions: {}` default |
| T6 | Malicious PR runs the workflow with secrets | Private repo, owner-only write access, **no `pull_request_target`**, and secrets are unavailable to fork PRs anyway. The backup workflow triggers only on `schedule` and `workflow_dispatch` |
| T7 | GitHub credential misuse | A **GitHub App** installed on the `cf-backend` repo only, with Actions r/w, Variables r/w and Secrets: read (names only); its tokens live one hour (OD-17) |
| T8 | Public storage surface abuse (enumeration, brute force) | HMAC tokens (unguessable), per-token passcode, per-IP rate limit, attempt logging, instant revocation; its own strict CSP |
| T9 | Backups silently stop | Dead-man's switch (doc 03 §6); GitHub failure emails as a second channel |
| T10 | Backups silently wrong | Restore drill + row-count fidelity + coverage checks every run (doc 03 §5) |
| T11 | Restored data resurrects erased personal data | Erasure log re-applied before a restore serves traffic (§5) |
| T12 | Repeat of the cf-chatbot pattern (a shared literal header as "auth") | Forbidden by design: the service binding is the auth. Add a `rules_check` in cf-backend that fails on any `X-Internal-*` header comparison |
| T13 | A bug on the public path reaches operational credentials | Two Workers (OD-1 revised): the edge Worker holds no GitHub token and no backups binding |
| T14 | A leaked link is scraped until the account's 100k/day request quota is gone, taking the public booking site with it | WAF rate-limit rule on `storage.*` (runs before the Worker), per-token caps, per-IP `[[ratelimits]]` (factor A5) |
| T15 | Email security scanners trigger downloads or consent | GET renders a landing page only; download is a POST (factor D2) |
| T16 | Uploaded HTML/SVG executes | Separate origin + `attachment` + `nosniff` + `CSP: sandbox` (factor D3) |
| T17 | Cloudflare account loss takes production and backups together | GitHub artifact second copy, 14 days (OD-12) |

## 2. Secrets inventory, by where they live

| Secret | Lives in | Scope | Replaces |
|---|---|---|---|
| `GITHUB_APP_PRIVATE_KEY` | cf-backend Worker | GitHub App (OD-17) on the `cf-backend` repo only: Actions r/w (dispatch, enable/disable), Variables r/w (`BACKUP_AGE_RECIPIENT`), Secrets: read (names and dates, OD-14); mints 1-hour tokens | A fine-grained PAT |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | cf-backend Worker | R2 token scoped to `madagascar-staff-storage`, Object r/w (presign) | The same pair in cf-admin (removed there) |
| Share-token signing key(s) | cf-backend Worker | — | Moved from cf-admin |
| `CLOUDFLARE_API_TOKEN` | GitHub (cf-backend repo) | **D1 Read**: export and the query-based `chatbot-kb` export (spike S-8), expiry set; used by every run | The unset secret in cf-admin's repo |
| `CLOUDFLARE_DRILL_TOKEN` | GitHub (cf-backend repo) | **D1 Edit**: referenced **only** by the monthly real-path drill job, which creates and deletes `drill-<db>-<run id>` (OD-15, P-13) | The same D1 Edit token cf-admin's drill needed every week |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub **variable** (not secret) | — | — |
| `SUPABASE_DB_URL` | GitHub (cf-backend repo) | Session pooler URL for a read-only `backup_reader` role (spike S-3) | — |
| `R2_BACKUP_WRITER_KEY_ID` / `_SECRET` | GitHub (cf-backend repo) | R2 token scoped to `madagascar-backups` only, Object r/w; lock prevents deletes | — |
| `BACKUP_AGE_RECIPIENT` | GitHub **variable** (public by nature) | The active backup **public** key; set by cf-backend on rotation (doc 09 §3) | `BACKUP_PASSPHRASE` (symmetric) |
| Backup **private** keys | **Supabase Vault** (`backup-key:<fingerprint>`), reachable only by `service_role` through three locked-down functions; retired keys kept | Decrypt; Owner/Vendor only, via cf-admin (doc 09) | `BACKUP_PASSPHRASE` |
| Recovery kit | Offline: the Owner's and the Vendor's own password managers (shown once at each rotation) | Only if the Supabase project is lost | — |

Key custody, one-click rotation, the weekly automatic key check and the loss playbook: see [09-key-management.md](09-key-management.md).

Net for cf-admin (RULE #0.8): **−2 secrets** (the R2 pair) and possibly −2 vars
(`CF_R2_BUCKET_NAME`, `STAFF_STORAGE_BUCKET_NAME`, confirmed in Phase 0), and **+0**
for the service binding.

## 3. GitHub Free on a personal account: what we can and cannot rely on

The owner account `mascotasmadagascar-cmd` is a GitHub **User** account and the repos
are **private** (*measured*). **Confirmed 2026-09-21** (GitHub plans documentation): on
GitHub Free, private repositories do **not** get protected branches, required pull
request reviewers, enforced code owners, or deployment protection rules. So we **do
not** design on them. Instead:

- Write access is the owner only; 2FA is required on the account.
- Nothing is triggered by `push` except `ci.yml` (verify), which holds **no secrets**.
- Backup secrets are referenced only by `db-backup.yml`, which runs only on `schedule` / `workflow_dispatch`.
- A `CODEOWNERS` file documents intent, but is not an enforcement mechanism on this plan.
- Scheduled workflows auto-disable after 60 days of inactivity only in **public** repositories (*to verify*). The dead-man's switch covers it either way.

## 4. Operational hygiene

- **Token rotation calendar** stored as dates (never values) in `backend:secrets-calendar`; cf-admin shows "expires in N days" and alerts at 14 days.
- **Redaction:** workflow logs never print connection strings (`::add-mask::` for derived values); the planned `report.md` and `manifest.json` run artefacts carry counts and hashes, never rows.
- **Observability budget:** cf-backend shares the account's 200k logs/day and, from 2026-10-01, trace spans. Default `head_sampling_rate` well below 1 for the public router; errors always logged.
- **Dependency policy:** same as cf-admin: every new package needs owner approval, `audit_gate` in `verify`, and a lockfile regenerated in isolation.

## 5. Compliance: LFPDPPP and internal records

Backups are a **processing activity** over personal data (customer names, emails and
phones, pet records, consent evidence, staff accounts, admin login IPs), and after
Phase 5 also over payroll and medical files. Before the first real backup lands in R2:

| Document | Update |
|---|---|
| `security/RoPA.md` | New activity "Disaster-recovery backups": categories, purpose, retention (manual, bucket-locked 30 days (daily) / 90 days (full) minimum), location (Cloudflare R2; GitHub-hosted runners in the US process data in transit), safeguards (public-key encryption, offline key) |
| `runbooks/disaster-recovery.md` | Replace the Pro-only Supabase restore path and the non-existent `--dry-run` flag with doc 03 §8; state the real RPO (24 h Supabase, 7 days' point-in-time D1 via Time Travel, weekly full) |
| Privacy notice (cf-astro) | Category-level only (AGENTS.md invariant 9): "backup and disaster-recovery providers", US transfer already disclosed as a category. **No vendor names** |
| Erasure procedure (ARCO) | Add: a restored backup is re-scrubbed against `legal_requests` before serving; backups beyond the lock window are pruned on the owner's schedule so erased data does not live forever |
| `security/THREAT-MODEL.md` | Add T1–T17 above |

**Offering this to clients (Velox):** each client platform is a single-tenant
deployment, so a client can receive their own **report** (a PII-free health summary)
and, on request, their own **encrypted** dump with their own key. Never share an
infrastructure dump across tenants. Never email dumps. Never send raw logs.

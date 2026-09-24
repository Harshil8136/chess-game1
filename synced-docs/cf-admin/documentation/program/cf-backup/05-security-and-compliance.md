---
title: "cf-backup — 05 Security and compliance"
status: draft
audience: [owner, ai, technical]
owner: harshil
related_docs: [README.md, 01-architecture.md, 02-admin-integration-contract.md, 03-backup-pipeline.md, 09-key-management.md, 11-run-evidence-and-usage.md]
tags: [program, cf-backup, security, compliance, secrets]
---

# 05 — Security and compliance

A backup system concentrates **all** the platform's personal data in one place. It is
the most valuable target we will build, so this document is not optional reading.

> **Revised 2026-09-22.** Storage threats T8 and T13–T16 are parked with the storage move.
> T1 is stronger: cf-backup has no public surface at all. New threats cover the embedded
> console (T18), log redaction (T19), evidence tampering (T20) and the actor header (T21).

## 1. Threat model

| # | Threat | Control |
|---|---|---|
| T1 | Internet caller reaches cf-backup | **Nothing to reach.** No route, no custom domain, `workers_dev = false`, `preview_urls = false`; the only ingress is cf-admin's service binding. A public-surface test fails the build if that ever changes (doc 02 §10 rule 6) |
| T2 | A compromised or buggy cf-admin route abuses cf-backup | cf-backup enforces role floors, cooldowns and idempotency on every action itself; destructive actions (prune, rotate) need typed confirmation and are owner-only or Owner/Vendor-only |
| T3 | Leaked GitHub secret | Two secrets only (doc 12). The Cloudflare token's R2 access (**as built: Item Read and Write**, Ruling 18 — Read alone answers `doctor`'s bucket `HEAD` and the previous-manifest `GET`s) reaches only `madagascar-backups`, where locks stop deletion and overwrite; its D1 Edit is the accepted price, contained per doc 12 §4.6. The Supabase reader is proven on every run to be unable to read Vault — **as built, `backup_reader` also carries `BYPASSRLS`** (Ruling 19: `pg_read_all_data` alone does not bypass row-level security, and `pg_dump` refuses an RLS-protected table it cannot read), which widens what a leaked key 2 can read but not what it can write or decrypt. The runner never holds a decryption key |
| T4 | Leaked backup artefact | Public-key encrypted; the private key lives in Supabase Vault, a different provider (doc 09). Downloads are Owner/Vendor-only, audited, and streamed encrypted |
| T5 | Script injection in the workflow | No `${{ }}` inside `run:`; inputs via `env:`; `workflow_dispatch` inputs validated against an enum; actions pinned by SHA; `permissions: {}` default |
| T6 | Malicious PR runs the workflow with secrets | Private repo, owner-only write access, **no `pull_request_target`**. The backup workflow triggers only on `schedule` and `workflow_dispatch` |
| T7 | GitHub credential misuse | **One GitHub App** with no Contents, Workflows or Administration permission, so it cannot change code or workflows. Every 1-hour token is narrowed to the repos and permissions of its call. Its most dangerous move, pointing `BACKUP_AGE_RECIPIENT` at an attacker's key, is refused by every run's `doctor` (the recipient must be the active registered key) and caught by the weekly key check (doc 12 §6) |
| T8 | ~~Public storage surface abuse~~ | **Parked** with the storage move (doc 04) |
| T9 | Backups silently stop | Dead-man's switch in reconcile (doc 03 §6); GitHub failure emails as a second channel |
| T10 | Backups silently wrong | Restore drill + row-count fidelity + fingerprints + coverage checks every run (doc 03 §5) |
| T11 | Restored data resurrects erased personal data | Erasure log re-applied before a restore serves traffic (§5) |
| T12 | Repeat of the cf-chatbot pattern (a shared literal header as "auth") | Forbidden by design: the service binding is the auth, and the actor header is trusted only because nothing else can reach the Worker (T21). A `rules_check` in cf-backup fails on any comparison of an `X-Internal-*`-style shared header |
| T13–T16 | ~~Public-path threats of the storage Worker~~ | **Parked** with the storage move |
| T17 | Cloudflare account loss takes production and backups together | Each run folder also kept as a GitHub artifact for 14 days (OD-12) |
| T18 | **The embedded console runs with admin-origin trust.** Its browser code can read the parent page, because they share an origin | cf-backup has no public surface (T1); a private repo with owner-only write and `verify` in the build; a small, owner-approved dependency list with `audit_gate`; its own strict CSP (`script-src 'self'`, no inline scripts); the frame exception limited to `/dashboard/backup/app/` by a cf-admin guard test (OD-18) |
| T19 | **Logs leak a secret or personal data** | Nothing prints data; GitHub masks registered and `::add-mask::` values in its own log; the runner's redactor scrubs every evidence file with the secret values themselves plus patterns, then **fails closed** on any residue (doc 11 §4). **As built:** a secret registered only at byte offset 0 of its base64/base64url encoding would evade both the scrub and the residue check if it appeared *inside* a longer encoded blob (for example a Basic-auth `user:token` pair) at offset 1 or 2 — fixed by registering each secret's encoding at all three byte offsets, both alphabets, with tests at all three offsets inside a longer buffer |
| T21′ | **A forged or malformed path reaches a route it should not** | The gateway and cf-backup's own router each independently reject `//`, backslashes and encoded slash/dot-segments outside the exact `/dashboard/backup/app/` (or `/internal/*`) prefix, answering `bad_path` 404 (doc 02 §3). **Known limitation:** neither check can see a *pure* encoded dot-segment once the URL parser has already collapsed it before either side inspects the path — accepted because routing beyond that point is exact-segment and capability-checked on every request, never inferred from the path string; a future file-serving path must not rely on the path alone |
| T20 | **Evidence is altered or deleted** to hide a failure | One writer per file, written once; `runs/` and `ops/` bucket-locked; the manifest's sha256 for every file; `admin_audit_log` for every human action, in a different store |
| T21 | **A forged actor header** claims to be the Owner | The gateway drops any `X-Backup-*` header the browser sent before adding its own; cf-backup is unreachable except through the binding; tests on both sides (doc 02 §4). The standalone dev actor exists only when the site URL is `localhost` |
| T22 | **The live view leaks a secret**: heartbeat log chunks are written while the run is still going | Every chunk passes the same redactor and residue check as the final evidence **before** upload; a failing chunk becomes a placeholder; `v1/live/` is readable only through cf-backup, and each run's live folder is deleted 7 days after its evidence is complete (doc 14 §5) |
| T23 | **Privilege escalation through the access policy** | `access.manage` is an Owner/Vendor floor; the secret class, `keys.status` and `runs.download` cannot be granted below Owner; deny beats allow; unknown capabilities are denied; compare-and-swap writes; every change audited and emailed to both (doc 13 §3) |
| T24 | **A lockout through the access policy** (the 2026-09-16 lesson) | The last-holder guard refuses any change that leaves no active holder of `access.manage` or `keys.rotate`; Vendor support stays above Owner in cf-admin's ladder (doc 13 §3) |
| T25 | **The dump credential can read backup keys** (`pg_read_all_data` reads every schema, including Vault) | Every run's `doctor` proves the reader is refused on `vault.decrypted_secrets` and stops the run otherwise; the fix is per-schema grants instead (doc 12 §5) |

## 2. Secrets inventory, by where they live

**Four secrets from three providers, none in cf-admin.** The full list, the exact
permissions, how to create and store each one, rotation and what a leak could do are
owned by [12-keys-and-secrets.md](12-keys-and-secrets.md); this is the summary.

| # | Secret | Lives in | Scope |
|---|---|---|---|
| 1 | `CLOUDFLARE_API_TOKEN` | GitHub (cf-backup repo) | D1 Edit, Account Analytics Read, **R2 item Read and Write** on `madagascar-backups` only (as built, Ruling 18: Read is needed for `doctor`'s bucket check and the previous-manifest reads the size-anomaly and drill-speed verdicts use); R2 S3 keys derived from it |
| 2 | `SUPABASE_DB_URL` | GitHub (cf-backup repo) | Read-only `backup_reader` (**as built: with `BYPASSRLS`**, Ruling 19), proven unable to read Vault |
| 3 | `GITHUB_APP_PRIVATE_KEY` | cf-backup Worker | The one GitHub App: Actions, Variables, Secrets metadata; no code |
| 4 | `SUPABASE_KEYS_URL` | cf-backup Worker | `EXECUTE` on the three backup-key functions only |

Not secrets: `CLOUDFLARE_ACCOUNT_ID` and `BACKUP_AGE_RECIPIENT` (GitHub variables),
`GITHUB_APP_ID` (Worker var). The backup **private** keys live only in Supabase Vault,
with a recovery kit in each of the Owner's and the Vendor's password managers (doc 09).

**Net for cf-admin (RULE #0.8): ±0.** The storage secrets stay, because storage is not
moving. The `BACKUP` service binding is infrastructure (like `ASTRO_SERVICE`), not
configuration.

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
- **GitHub App permissions are app-wide.** An installation gets all of the App's permissions on every repo it is installed on. The one App is therefore limited to Actions, Variables and secret *names* (no code), and every token it mints is narrowed per call (doc 12 §6).

## 4. Operational hygiene

- **Token rotation calendar** stored as dates (never values) in `backup:secrets-calendar`; the console shows "expires in N days" and alerts 30 days ahead (doc 12 §9).
- **Redaction and evidence** follow doc 11 §4: nothing prints data, every evidence file is scrubbed and residue-checked, and the backup data is always encrypted.
- **Observability budget:** cf-backup shares the account's 200k log events/day and, from 2026-10-01, trace spans. Workers Logs keeps 3 days on Free, so anything worth keeping is an R2 evidence record (doc 11), not a log line.
- **Dependency policy:** same as cf-admin: every new package needs owner approval, `audit_gate` in `verify`, and a lockfile regenerated in isolation (doc 01 §6 lists the proposed set).

## 5. Compliance: LFPDPPP and internal records

Backups are a **processing activity** over personal data (customer names, emails and
phones, pet records, consent evidence, staff accounts, admin login IPs), and after
Phase 4 also over payroll and medical files. Before the first real backup lands in R2:

| Document | Update |
|---|---|
| `security/RoPA.md` | New activity "Disaster-recovery backups": categories, purpose, retention (manual, bucket-locked 30 days (daily) / 90 days (full) minimum), location (Cloudflare R2; GitHub-hosted runners in the US process data in transit), safeguards (public-key encryption, key held at a second provider). Run evidence is PII-free by policy (doc 11 §4) |
| `runbooks/disaster-recovery.md` | Replace the Pro-only Supabase restore path and the non-existent `--dry-run` flag with doc 03 §8; state the real RPO (24 h Supabase, 7 days' point-in-time D1 via Time Travel, weekly full) |
| Privacy notice (cf-astro) | Category-level only (cf-astro AGENTS.md invariant 9): "backup and disaster-recovery providers", US transfer already disclosed as a category. **No vendor names** |
| Erasure procedure (ARCO) | Add: a restored backup is re-scrubbed against `legal_requests` before serving; backups beyond the lock window are pruned on the owner's schedule so erased data does not live forever |
| `security/THREAT-MODEL.md` | Add T1–T21 above, once built |

**Offering this to clients (Velox):** each client platform is a single-tenant
deployment, so a client can receive their own **report** (a PII-free health summary
built from the evidence bundle) and, on request, their own **encrypted** dump with their
own key. Never share an infrastructure dump across tenants. Never email dumps. Never send
raw logs.

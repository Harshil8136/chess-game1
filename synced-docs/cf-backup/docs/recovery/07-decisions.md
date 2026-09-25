---
title: "cf-backup recovery — 07 Decisions for the owner (RD-1 to RD-13)"
status: draft
audience: [owner, ai, technical]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp]
owner: harshil
related_docs: [README.md, 05-options.md, 06-plan.md, 09-lifeboat-spec.md]
tags: [cf-backup, recovery, decisions, owner]
---

# 07 — Decisions for the owner

> **TL;DR (non-technical):** Thirteen choices only the owner can make. Each has a recommended
> default, and work goes ahead on the default if the owner says nothing. Three block work now:
> how to back up sign-in accounts (RD-1), the test resources for the rehearsal (RD-2), and a
> feature freeze until backups are proven (RD-4). Every default can be changed later.

## 1. Decision table (defaults: reverse any at review)

| ID | Decision | Default (applies if the owner says nothing) | Alternative | Blocks |
|---|---|---|---|---|
| RD-1 | How to back up sign-in accounts (`auth.users`, `auth.identities`) | **Read-only views owned by `postgres`** that only the backup role may read; the Vault stays refused. Details in §2 | Back up as `postgres`; the Auth Admin API; accept the gap | Stage 3 |
| RD-2 | Test resources for the rehearsal job | **A 4th D1 database and a second, small R2 bucket with no locks**, with a test token scoped to only those two. Postgres runs in a container on the runner | An unlocked prefix in the backup bucket: cheaper, but the rehearsal token could reach real backups | Stage 2 |
| RD-3 | May a key that decrypts backups live in GitHub? | **No.** The weekly drill checks the downloaded ciphertext (header, size, checksum) and restores the plain files exported in the same run. A person proves decryption with the recovery kit, monthly for 3 months, then quarterly | A second "drill" key in GitHub: stronger proof every week, but whoever holds it and can read the bucket can read backups | Stage 4 |
| RD-4 | Feature freeze on cf-backup | **Yes.** No new console, diagnostics or layout work until the definition of done ([06](06-plan.md) §9). Only defects that block a backup are fixed. May be lifted after 7 green scheduled days, with the soak continuing | No freeze | All stages |
| RD-5 | Pause the schedules until the main pipeline is fixed | **Yes**, by turning the schedule flags off **and then** disabling `db-backup.yml` in GitHub. *Corrected 2026-09-25: the first plan said to comment out the fallback cron, which fails CI* | Keep the failing runs going | Stage 0 |
| RD-6 | Rehearsal as staging | **The rehearsal job serves as cf-backup's staging** (the owner decided earlier: no staging). It uses test resources and costs no money | A real staging environment | — |
| RD-7 | GitHub Actions budget for cf-backup | **A ceiling of 400 minutes a month** (estimate 330 to 380, falling to 250 to 300; [06](06-plan.md) §10). Over it: the rehearsal drops its weekly run, then runs only on runner changes | No ceiling | — |
| RD-8 | cf-admin's older `backups.yml` | **Disable it now; delete it in a cf-admin commit after the lifeboat is green.** If the lifeboat slips past 48 hours, the fallback is to add its four secrets to cf-admin and run it as it is | Keep it | Stage 0 |
| RD-9 | A dead-man's switch outside GitHub and Cloudflare | **Yes:** a free healthchecks.io check pinged by the lifeboat (and later the main run) on success; it emails if a day passes without a ping. It costs one more secret (the ping URL), outside the four keys | Rely on GitHub's failure email and the tick's stale alerts only | Stage 1 |
| RD-10 | `pg_read_all_data` for the backup role, to read `auth` | **No**, unless a test in the drill image shows the Vault stays refused | Grant it | — |
| RD-11 | Day 30: the future of the two paths | **Keep both; the lifeboat goes weekly** (about 12 minutes a month) as a second code path | Converge: the main runner's store steps call the lifeboat's commands and the rest is deleted; or retire the lifeboat | Stage 5 |
| RD-12 | The lifeboat as a second scheduled workflow | **Allow it**, recorded in `RULES.md` rule 7 as an exception until RD-11. `lifeboat/` gets a 30-day bucket lock and a 35-day lifecycle rule | Keep "the only schedule is the fallback" | Stage 1 |
| RD-13 | Pre-flight policy (N5) | **Per store:** a store's own failed check stops that store only; checks every store needs (the key, R2) still stop everything | `halt` (today): one failed check stops every store | Stage 2 |

## 2. RD-1 in detail: sign-in accounts

Today 6 accounts and 12 identities are in **no** backup. After a disaster, everyone who signs in
to the admin would have to be invited again. Until Stage 3, the owner's weekly manual backup
([10](10-manual-backup-runbook.md)) is their only copy.

| Choice | What it means | Restores passwords? | Keeps the Vault refused? | Owner effort |
|---|---|---|---|---|
| **a. Read-only views owned by `postgres` (default)** | A small schema of views over `auth.users` and `auth.identities`; only the backup role may read them | Yes (password hashes included) | Yes | Run one SQL file once |
| b. Back up as `postgres` | Put the `postgres` connection string in GitHub | Yes | **No**: the runner could read the Vault | Change one secret |
| c. Auth Admin API | The runner lists users with the service key | **No**: everyone resets their password | Yes, but a service key goes to GitHub | Add one secret |
| d. `pg_read_all_data` (RD-10) | Grant the built-in read-everything role | Yes | **Probably not**; untested | One SQL line |
| e. Accept the gap | Re-invite everyone after a disaster | — | Yes | None |

The views hold password hashes, so the backup files hold them too. They are encrypted like
everything else.

## 3. RD-2 and RD-6 in detail: where the rehearsal writes

The rehearsal needs somewhere to write that is not production. The default adds a 4th D1 database
(free; 10 allowed) and a second bucket (free up to 10 GB-month in total; the rehearsal uses
kilobytes), reached by a test token scoped to only those two. It is not a copy of production, and
it is the only place where the main pipeline runs for real before production does.

## 4. RD-8 in detail: why retire cf-admin's `backups.yml`

It is a good design (it already avoids T1, T5 and L3), and its shape lives on in the lifeboat. But
running it needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_DB_URL` and
`BACKUP_PASSPHRASE` in cf-admin: production secrets where the plan of record says there are none,
and a fifth secret. It also covers only `madagascar-db` and keeps only GitHub artifacts. The
lifeboat does the same job in cf-backup with the secrets it already has.

## 5. Not decisions, but owed by the owner

| When | What | Time |
|---|---|---|
| Today | Confirm the recovery kit; ask the Vendor to confirm theirs ([06](06-plan.md) 0.1, 0.2). **Nothing else in this plan can make up for a lost key** | 20 min |
| Today | Stop the failing runs, in order ([06](06-plan.md) 0.3) | 5 min |
| Today, then weekly | The manual backup ([10](10-manual-backup-runbook.md)) | 45 min |
| Stage 1 | Decrypt one lifeboat file; add the lock and lifecycle rules | 15 min |
| Stage 2 | Create the test resources; re-enable the workflow; one runner test and one full backup | 20 min |
| Stage 3 | Run one SQL file in the Supabase SQL editor | 5 min |
| Stage 5 | One restore by hand from the bucket with the recovery kit | 1 hour |

## 6. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | First review: RD-1 to RD-7 drafted | Defaults as in §1 |
| 2026-09-25 | claude | Second review: live schedule, key registry, cf-admin's `backups.yml`, workflow guards, pre-flight policy | RD-5 corrected; RD-8 to RD-13 added |
| 2026-09-25 | claude | Live Supabase grants and project list | RD-1 choices and the no-spare-project fact |

## 7. Related

- [05-options.md](05-options.md): why these are the choices.
- [06-plan.md](06-plan.md): where each decision is used.

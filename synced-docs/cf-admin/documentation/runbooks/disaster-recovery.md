---

title: "Disaster Recovery & Backup Restore Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-11-03
verified_against: [code, config, infra, live-mcp]
owner: harshil
related_docs: [incident-response.md, ../operations/OPERATIONS.md, ../architecture/KV-RESILIENCE.md, ../security/compliance/SOC2-TSC-mapping.md]
tags: [disaster-recovery, backup, rto, rpo, soc2, iso22301, runbook]
---

# Disaster Recovery & Backup Restore Runbook

> **TL;DR (non-technical):** How to get the platform back if data is lost or a
> service fails — which button restores what, and how much data you would lose
> in each case. Read the honest caveat first: **the restore procedures below
> have never been executed against the production services.** Backup files
> exist since 2026-09-26 (cf-backup, see the next note: 25 good backups by
> 2026-11-01), each one restore-checked in a scratch database when it was made,
> and since 2026-10-08 whole copies are rebuilt and checked on the server
> (§8). A full recovery of production has still never been rehearsed, so the
> recovery times are estimates, not measurements.

> **Superseded for backups, 2026-09-27.** `.github/workflows/backups.yml` was
> deleted (cf-backup remediation decision RD-8): it never produced a backup.
> Supabase Postgres (with its authentication records) and the three D1
> databases are now backed up by the cf-backup repository's backup engine,
> `secondary-pipeline.yml`: each store is exported, restored into a scratch
> database and row-counted against the source, then encrypted and archived to
> R2 (`secondary/pipeline/`), with a 14-day copy in GitHub. cf-backup's tick
> starts it on the days the backup console's Settings → Schedule names (read
> 2026-11-03: a full backup on Sundays and Wednesdays at 09:17 UTC, the
> Supabase-only backup off), and
> GitHub's own daily schedule is the fallback, which stands down on a day that
> already has a good backup or names none. How to restore from it: cf-backup
> `docs/remediation/09-secondary-pipeline-specification.md` §5, and its
> `docs/RESTORE.md` "Recovery points from the Secondary Pipeline". §0, §1, §2.1,
> §3 and §8 were rewritten for it on 2026-11-03; the retired workflow's plan is
> in git history and in
> `../records/reports/2026-09-22-ci-workflow-consolidation.md` (private).
> `scripts/backup_drill.mjs` still works locally.

## 0. Owner actions still open (re-checked 2026-11-03)

The three secrets this section once listed (`CLOUDFLARE_API_TOKEN`,
`SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`) belonged to the deleted `backups.yml`
and are no longer needed here: cf-backup holds its own keys (cf-backup
`RULES.md` 3). What is still open:

| # | Action | Why it matters | State |
|---|---|---|---|
| 1 | Decide owner decision **D-13** (§5; `../MAINTENANCE.md` S-2) | `madagascar-images`, `madagascar-staff-storage` and `arco-documents` have no backup at all | Open since 2026-09-15 |
| 2 | Lock the activity log's copies in R2 (`../MAINTENANCE.md` AL-1) | A copy can be deleted as easily as an entry | Owner step |
| 3 | Run the incident-response tabletop and one timed recovery (`../MAINTENANCE.md` C-6) | SOC 2 A1.3 asks for evidence that recovery works, not only that copies open | Never run |

## Context / Scope

Closes gap **G3** from
`../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md` (private),
and addresses SOC 2 **A1.2/A1.3** and the underlying control behind ISO 22301
(full 22301 certification is out of scope — see that audit §4.6).

**Covers:** data loss and service failure across D1, Supabase, KV, R2 and the
Worker deployment — the stores this Worker binds. `arco-documents`
(`ARCO_DOCS`, bound by cf-astro, holding ARCO identity documents) is **not**
covered here and no document covers it; it carries the same unbacked-up gap as
the two R2 buckets in §5, on the highest-sensitivity content on the platform.
Raise it with the R2 decision in §5.

**Does NOT cover:** security incidents — see
[`incident-response.md`](incident-response.md). A ransomware or malicious-
deletion event is *both*; run the incident runbook first, this one second.

## 1. Recovery objectives — targets, not measurements

**The recovery times in this table have not been measured on production.**
The data-loss figures follow from the backup schedule (§0's note above: full
backups on Sundays and Wednesdays, so at most four days apart) and from D1
Time Travel's window.

| Store | What lives there | RPO (data loss) | RTO (time to restore) | Mechanism |
|---|---|---|---|---|
| **D1** `madagascar-db` | Audit log, page registry, bookings state, login logs, email drafts | **~0** within 7 days (Time Travel). **Up to 4 days** beyond that: the last cf-backup copy | Time Travel: minutes, per Cloudflare's documentation; never drilled on production, by design. From a copy: not measured on production; the restore tests' rebuild times are on the backup console's Restore tests page | Time Travel, **7-day window on Workers Free**; cf-backup's encrypted copy in R2 (`madagascar-backups`, `secondary/pipeline/`), and for 14 days on GitHub (§2.1) |
| **Supabase Postgres** | Users, ARCO tickets, consent records, email ledger, inquiries | **Up to 4 days**: the last cf-backup copy. The organisation is still on the **free** plan (read 2026-11-03), so Supabase itself keeps no backup and there is no Dashboard restore (§3) | Not measured on production (§3.1) | cf-backup's encrypted copy of the `public` and `supabase_migrations` schemas and the authentication records, in R2 and for 14 days on GitHub |
| **KV** `ADMIN_SESSION` (binding `SESSION`) | Sessions, sign-out marks, caches | N/A — by design | ~0 | Not backed up (§4); losing it lifts the last 24 hours' sign-out blocks |
| **R2** `madagascar-images` | CMS images, email attachments | **No backup** | Unbounded | See §5 — real gap |
| **R2** `madagascar-staff-storage` | Staff drive files — **including payroll and medical records** | **No backup** | Unbounded | See §5 — same gap, higher-sensitivity data |
| **Worker** | Application code | 0 | ~5 min | `git` + redeploy |

> **What is proven, and what is not.** Every backup is restored into a scratch
> database and row-counted when it is made, and restore tests rebuild a whole
> copy on the server and score it (§8). That proves a copy opens and is
> complete. It does not prove how long putting production back would take: no
> full recovery has been timed (§0 item 3). The honest external answer is
> *"backups twice a week, each restore-checked, copies test-restored; recovery
> time a documented estimate."* R2 and KV are policies (§4, §5), not estimates.

## 2. D1 — point-in-time recovery

D1 Time Travel keeps a continuous **7-day** window at no cost on the Workers
Free plan (30 days on Workers Paid — this runbook said 30 until 2026-09-02),
so RPO is effectively zero within that window. **Beyond seven days there is
nothing**: the weekly export (§2.1) is the intended answer and it has never
produced an artifact (§0).

```bash
# 1. Find the current restore point
wrangler d1 time-travel info madagascar-db

# 2. Resolve the bookmark for the moment BEFORE the damage, and confirm the
#    timestamp is inside the window. This is the only read-only step there is.
wrangler d1 time-travel info madagascar-db --timestamp=<UNIX_TS_OR_RFC3339>

# 3. Restore — THIS COMMITS. There is no preview, and no undo beyond a second
#    restore forward. Read the shared-database warning below first.
wrangler d1 time-travel restore madagascar-db --bookmark=<BOOKMARK_FROM_STEP_2>
```

> 🚫 **`wrangler d1 time-travel restore` has no `--dry-run`.** This runbook told
> you to run one until 2026-09-19; wrangler 4.128.0 answers
> `Unknown arguments: dry-run, dryRun` and its only options are `--bookmark`,
> `--timestamp` and `--json` (`npx wrangler d1 time-travel restore --help`).
> Do **not** "fix" the error by dropping the flag — that performs a real,
> immediate, whole-database restore. `time-travel info` is the read-only half;
> restore is not.

### 2.1 Beyond seven days — restore from a cf-backup copy

Each cf-backup run holds `d1-<database>.sql.gz.age` per D1 database, in
`madagascar-backups` under `secondary/pipeline/<date>/<run>/`, checked by its
`SHA256SUMS`. The procedure, and the private key it needs, are cf-backup's:
`docs/remediation/09-secondary-pipeline-specification.md` §5 step 4 (fetch,
check, decrypt, then `wrangler d1 create` and `wrangler d1 execute --file`). The
export **creates tables**, so it cannot be imported into the live database:
restore into a fresh one and point **both** repos at it, `database_id` in
cf-admin's and cf-astro's `wrangler.toml` `[[d1_databases]]`, then deploy each
(RULESAd §12: a wrong binding UUID fails silently, so copy it from
`wrangler d1 list`).

Each run already restores its own export into a scratch database and compares
the row counts, and the restore tests rebuild whole copies (§8), so the files
are known to open. How long the steps take against production has not been
measured.

> 🚨 **`madagascar-db` is SHARED with `cf-astro`.** A Time Travel restore rolls
> back the ENTIRE database, not the `admin_*` tables. Restoring to undo an
> admin-side mistake will also silently revert every `cf-astro` write since that
> timestamp. Before restoring: confirm the blast radius, and prefer a targeted
> row-level repair when the damage is narrow. Binding IDs in
> [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §1.

## 3. Supabase Postgres — restore from a cf-backup copy

> 🚨 **Corrected 2026-09-19. This section previously opened with "Dashboard →
> Database → Backups → pick the most recent good day → Restore" and an RPO of
> ≤24 h. Neither exists on this account.** Supabase backs up **Pro, Team and
> Enterprise** projects daily; free-plan projects are told to take their own
> `supabase db dump`/`pg_dump` copies, and any platform-side backup only
> becomes reachable *after* an upgrade. Verified 2026-09-19: organisation
> `Mascotas Madagascar's projects` → `"plan": "free"`. An operator who opens
> the dashboard mid-incident expecting that button will not find it.

**Today's Postgres RPO is the last cf-backup copy**: at most four days old
(the schedule in the note at the top). Supabase keeps nothing of its own on
this plan.

Recovery options, in the order to try them:

1. **Nothing has been deleted yet?** Stop writing and take a copy now: Run now
   in the backup console, or the hand-taken full export (cf-backup
   `docs/SUPABASE-FULL-EXPORT.md`). A copy of what survives is worth taking
   before any restore.
2. **Restore the last good copy** — §3.1.
3. **The project itself is gone** — restore into a new project (§3.1), and
   open a Supabase support ticket; free-plan recovery is discretionary, not
   contractual.

After any restore, verify in this order — highest compliance value first:

```sql
SELECT COUNT(*) FROM legal_requests   WHERE status IN ('PENDING','IN_PROGRESS');
SELECT COUNT(*) FROM admin_authorized_users WHERE is_active = true;
SELECT COUNT(*) FROM consent_records;
```

Then re-run `get_advisors` (Supabase MCP) — a restore can reintroduce RLS drift
that was previously fixed.

**On PITR.** This section used to call PITR "a paid add-on (~$25/mo) and the
single cheapest improvement available to the RPO". It is neither: Supabase
prices 7-day PITR at roughly **$100/month**, and it requires the Pro plan
(~$25) *plus* at least a Small compute add-on — about **$130/month** all in,
which breaks the $0 constraint in ADR-0001. The $0 alternative is the one in
place since 2026-09-26: cf-backup's copies, twice a week.

### 3.1 From a cf-backup copy

Each run holds `postgres-schema.sql.gz.age`, `postgres-data.sql.gz.age` and
`postgres-auth.sql.gz.age` (the authentication records). The procedure is
cf-backup's `docs/remediation/09-secondary-pipeline-specification.md` §5 step 3:
create the roles the schema grants to (`cf_astro_writer`, `backup_reader`),
load the schema, the authentication records and the data into the new
project in one transaction, then set the roles' passwords and grants. Restore
PostgreSQL before D1. Then run the three compliance counts above, and compare
each table with the run's `manifest.json`.

> **Open ARCO tickets are the priority check.** Losing one loses a statutory
> deadline the data subject is still owed (GDPR Art. 15–17 / LFPDPPP), and the
> loss is invisible unless someone counts.

## 4. KV — deliberately not backed up

`ADMIN_SESSION` (the namespace behind the `SESSION` binding) holds short-lived
state only:

| What | Keys | If it is lost |
|---|---|---|
| Sessions, each with its access map | `session:`, `user-session:` | Everyone is signed out. They sign in again through Cloudflare Access, and the access map is rebuilt from D1 at sign-in |
| Sign-out marks | `revoked:<userId>` (24 hours), `revoked-session:<sessionId>` | **A person signed out in the last 24 hours can sign in again at once**, unless their account is suspended: the `revoked:` mark is what refused their new sign-in (`src/lib/auth/stages/bootstrap.ts`). A lost `revoked-session:` mark changes nothing, since its session is gone too |
| Access-change marks | `authz-changed:<userId>` | Nothing: they tell a live session to re-check its access, and no session survives the loss |
| Caches | the dashboard numbers, the GitHub page snapshot | Refilled from their sources on the next request |

**After a loss during an incident**, sign out again, or better suspend, anyone
signed out in the last 24 hours who must stay out
([`incident-response.md`](incident-response.md) §4 steps 1 and 2). The activity
log names them: its `force_logout` rows, and its `revoke_access` rows of module
`auth`. Sessions → **Sign-in blocks** will say no one is blocked, because it
reads the lost marks.

Apart from that, **no backup is needed and none exists**: this is a design
decision, not an oversight. See
[`../architecture/KV-RESILIENCE.md`](../architecture/KV-RESILIENCE.md).

## 5. R2 — the real gap

`madagascar-images` has **no backup, no versioning and no replication**. A
deletion — accidental or malicious — is permanent. It holds CMS images and
email attachments.

Partially mitigating: the weekly `scheduled-asset-cleanup` worker excludes the
`email-attachments/` prefix unconditionally, so the automated sweep cannot
delete attachments (MAINTENANCE.md E-1).

**`madagascar-staff-storage` has the identical gap and arguably needs the fix
more.** It is the private bucket behind the Staff Managed Storage feature and
can hold payroll and medical records — a permanent, unrecoverable deletion
here is a materially worse outcome than losing a CMS image. The bucket does
have a soft-delete layer above R2 (`storage_files.is_deleted` + a 30-day Trash
window, `TRASH_RETENTION_DAYS`), which covers accidental *application-level*
deletes, but nothing protects against a direct R2-level deletion (compromised
API token, `wrangler r2 object delete`, a reconciliation-cron bug) or against
overwrite-in-place data loss (a same-key upload has no prior version to
recover). Trash closes neither.

> **Corrected 2026-09-02.** Earlier revisions recommended "enable R2 object
> versioning". Cloudflare R2 does not offer per-object versioning; it offers
> **bucket locks** (a retention policy that blocks deletes and overwrites for a
> period). A lock would also block the application's own 30-day Trash
> hard-delete and the weekly reconciliation cron, so it is a design decision,
> not a toggle. It is taken in viability program chunk 6.

Options, none yet implemented:

| Option | Protects against | Leaves open | Cost |
|---|---|---|---|
| Bucket lock on `madagascar-staff-storage`, `--retention-days N` | deletes/overwrites of objects younger than N days | everything older than N days; also blocks the app's own Trash hard-delete for young objects | $0 |
| Weekly `rclone sync` to a backup bucket from a scheduled job (first planned in the `backups` workflow, deleted on 2026-09-27), with an R2 S3 token as its secret | loss of any object, up to a week of lag | a token that can delete the copy too | $0 within the free tier |
| **Both — the copy, plus an indefinite lock on the backup bucket** (recommended, chunk 6 §3.4) | both | nothing known | $0 |
| Accept the risk, document it | — | everything | current state |

**Owner decision D-13 (opened 2026-09-15), not yet taken.** The recommended row
needs a backup bucket and a scoped R2 token that only the owner can create.

**The activity log's copies (2026-10-16).** The same bucket holds, under
`audit-log/`, one copy a day of the activity log's rows, written by the `audit-seal`
job ([`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) §3.6).
Each copy holds the rows exactly as stored, so a lost or rewritten day of
`admin_audit_log` older than Time Travel's 7 days can be read back from it. The lock
proposed for them (`../MAINTENANCE.md` AL-1) covers only that prefix, so it blocks
neither the Trash hard-delete nor the weekly reconciliation, which lists
`staff-storage/` only.

## 6. Worker / application

Code recovery is `git`; the deployment is reproducible.

```bash
git log --oneline -20
git revert <sha> && git push origin main    # main auto-deploys through Workers Builds
npx wrangler rollback                       # instant: previous Worker code, same bindings/secrets
# or roll back in the Cloudflare dashboard → Workers → Deployments
```

> Code rolls back; **schema does not**. Which of the two you need — and when a
> rollback is the wrong move after a contract migration — is the table in
> [`release-and-rollback.md`](release-and-rollback.md) §5.
>
> **A revert deploys without gates.** Workers Builds does not run `verify`
> (it only builds), so a `git revert` push deploys the reverted code unchecked
> and applies **no** compensating migration — you must run
> `wrangler d1 migrations apply madagascar-db --remote` yourself. See
> [`release-and-rollback.md`](release-and-rollback.md) §1.

**Binding IDs are the real risk here, not the code.** A `wrangler.toml`
pointing at a non-existent KV/D1 UUID fails silently — this caused a production
CMS outage in April 2026 (`RULESAd.md` §12). Verify against
`../operations/OPERATIONS.md` §1 before any recovery deploy.

## 7. Scenario playbooks

| Scenario | First action | Then |
|---|---|---|
| Accidental `retention/purge` on the wrong table | Do **not** re-run anything | D1 → Time Travel to just before. **Postgres → take a copy of what survives (§3 option 1), then restore the rows from the last cf-backup copy (§3.1)** |
| Supabase project deleted | Open a Supabase support ticket immediately | Free-plan recovery is discretionary (§3); rotate `SUPABASE_SERVICE_ROLE_KEY` |
| D1 corruption | `time-travel info` to resolve a bookmark | Check the `cf-astro` blast radius, then restore — the restore commits, there is no preview (§2) |
| R2 objects deleted (`madagascar-images` or `madagascar-staff-storage`) | Stop the cleanup cron | **Unrecoverable today** (§5). For staff-storage, first check whether the file is still in Trash (`is_deleted=1`, within 30 days) — that path is recoverable via `POST /api/storage/[id]/restore` even though the R2-level gap remains |
| Bad deploy | Cloudflare dashboard rollback | Then `git revert` so `main` matches production |
| Cloudflare account compromise | Incident runbook §4 | Rotate every token; audit Zero Trust policies |

## 8. The drill — restore tests since 2026-10-08

**This runbook owns the drill cadence.** Any other document stating a restore
cadence should link here rather than restate it.

Two checks run without anyone asking:

- **Every backup run** restores each export into a scratch database and
  compares the row counts with the source before it seals the copy (cf-backup
  `secondary-pipeline.yml`).
- **Restore tests** (backup console → Restore tests, since 2026-10-08) rebuild a
  chosen copy on the server in a sealed container with no network, check it in
  ten groups, score it and delete it ([`../features/BACKUP-CONSOLE.md`](../features/BACKUP-CONSOLE.md)).
  Read 2026-11-03: nine tests from 2026-10-08 to 2026-10-25, seven with a
  verdict. The copies of 2026-10-08, 2026-10-18 and 2026-10-25 scored 100
  ("Ready to restore"), those of 2026-10-07 and 2026-10-14 88 and 94 (ready,
  with notes). The first two tests, of 2026-10-07's copy, failed on a false
  finding fixed the same day (`../MAINTENANCE.md` RT-3). Run one after a change
  to the backup engine, and at least once a quarter.

Still manual, quarterly, ~30 minutes:

1. Confirm KV loss is non-destructive (log out, log back in).
2. Redeploy the Worker from a clean checkout. *(The release smoke stage that
   would measure propagation only runs inside `deploy:ci`, which production
   does not use — see `release-and-rollback.md` §1.)*
3. `wrangler d1 time-travel info madagascar-db` — read-only, to keep the
   bookmark lookup familiar. **Do not rehearse `restore` against production:**
   there is no read-only form of it, and the database is shared with cf-astro.
   Rehearse the restore path with a restore test instead.

Never run yet: a timed recovery of production from a copy, and the incident
tabletop (§0 item 3). Record the quarterly results in `../security/reviews/` as
a dated snapshot.

## 9. Verification log

| Date | Method | Result |
|---|---|---|
| 2026-11-03 | claude: D1 `backup_runs` (25 succeeded backups, 2026-09-26 to 2026-11-01), `backup:config` schedule and `backup:restore-tests` verdicts and scores read through the D1 connector (no names or keys); Supabase `get_organization` (plan `free`); cf-backup `docs/RESTORE.md` and remediation 09 §5 | §0, §1, §2.1, §3, §3.1, §7's first row and §8 rewritten from the deleted `backups.yml` to cf-backup's copies and the restore tests. Not checked: §4, §5 beyond D-13's state, §6, a timed recovery (none exists) |
| 2026-10-17 | claude: `backup_runs` grouped by kind and status (D1 connector: 19 successful backups, 2026-09-26 to 2026-10-14) | The TL;DR still said there was no backup file to restore from. Corrected. Not checked: anything in §1–§8 |
| 2026-10-16 | claude: `backup:config`'s schedule read live (D1 connector: full backups on weekdays 0 and 3 at 09:17 UTC, the daily Supabase-only backup off); cf-backup `.github/workflows/secondary-pipeline.yml` (its daily fallback and when it stands down) | The superseded banner said backups ran daily at 09:17 UTC; it now names the schedule's days and the fallback. Not re-checked: the rest of the banner |
| 2026-10-16 | claude: `src/lib/auth/plac.ts` (`forceLogoutUser`, `revokeSingleSession`), `src/lib/auth/stages/session-stage.ts` and `bootstrap.ts` (where the marks are read), `src/lib/auth/authz-signal.ts`, `src/lib/auth/session.ts`, `src/lib/github/cache.ts`, `src/lib/analytics/providers/index.ts`, `src/pages/api/sessions/active-revocations.ts`, `src/components/admin/users/sessions/BlocksPanel.tsx`; every `SESSION` key prefix in `src/` listed; the links in this runbook resolved | §4 rewritten as a table of what the namespace holds and what losing each part means: the sign-out marks are the one loss that matters, and the step after it; §1's KV row says so. The §0–§3 backup status, §5 and §8 not re-checked |
| 2026-10-16 | `src/lib/audit-seal/seal.ts` (`copyKey`, `copyBody`), `src/workers/scheduled-audit-seal.ts`, `src/workers/scheduled-asset-cleanup.ts` (`reconcileStaffStorage` lists `staff-storage/`) | §5's new paragraph on the activity log's copies only. The rest of the runbook was not re-checked; its backup status (§0, §2) predates the backups that have run since 2026-09-26 |
| 2026-09-19 | `npx wrangler d1 time-travel restore --help` and `info --help` (wrangler 4.128.0); Supabase MCP `get_organization`; `.github/workflows/backups.yml` read; repository Actions secrets/variables/environments listed; `scripts/backup_drill.mjs` read | `--dry-run` does not exist on `restore`; org plan is `free`; the workflow needs four secrets and the repository has only `PERSONAL_PAT`; one workflow run ever, failed. §0 added; §1, §2, §3, §4, §7 and §8 rewritten. `scripts/backup_drill.mjs` and the §2.1 `wrangler d1 create/execute` flags re-checked and correct |

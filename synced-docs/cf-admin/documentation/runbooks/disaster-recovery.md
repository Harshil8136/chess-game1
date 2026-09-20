---

title: "Disaster Recovery & Backup Restore Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-09-19
verified_against: [code, config, infra, live-mcp]
owner: harshil
related_docs: [incident-response.md, ../operations/OPERATIONS.md, ../architecture/KV-RESILIENCE.md, ../security/compliance/SOC2-TSC-mapping.md]
tags: [disaster-recovery, backup, rto, rpo, soc2, iso22301, runbook]
---

# Disaster Recovery & Backup Restore Runbook

> **TL;DR (non-technical):** How to get the platform back if data is lost or a
> service fails — which button restores what, and how much data you would lose
> in each case. Read the honest caveat first: **the restore procedures below
> have never been executed, and there is no backup file to restore from yet.**
> The recovery targets are estimates derived from vendor documentation, not
> measurements from a real drill.

## 0. Blocking prerequisites — owner actions, none taken (verified 2026-09-19)

**Nothing in §1's "from the export / from the dump" column works until these
are done.** Every claim in this runbook that depends on a backup artifact is,
today, a description of a mechanism that has never produced one.

| # | Action | Why it blocks | Verified state |
|---|---|---|---|
| 1 | Add repository Actions secrets `CLOUDFLARE_API_TOKEN` (account → D1 Edit) and `CLOUDFLARE_ACCOUNT_ID` | `.github/workflows/backups.yml` fails the `d1-export` job on purpose without them, so no D1 artifact is ever produced and both drills are skipped | The repository holds exactly **one** Actions secret, `PERSONAL_PAT`. No repository variables, no environments |
| 2 | Add `SUPABASE_DB_URL` (session pooler URI, port 5432 — the direct host is IPv6-only and unreachable from GitHub runners) | Without it the `supabase-dump` job skips every step with a warning; there is **no** Postgres backup of any kind | Not set |
| 3 | Add `BACKUP_PASSPHRASE` | Without it both artifacts upload **unencrypted**, and they contain login logs, consent evidence and bookings | Not set |
| 4 | Decide owner decision **D-13** (§5) | R2 has no backup at all | Open since 2026-09-15 |

**The `backups` workflow has run once, ever:** a manual `workflow_dispatch` on
2026-09-15 that **failed after 41 seconds** (`d1-export` failed at the
credentials check; both drills skipped; `supabase-dump` skipped everything).
No scheduled run has fired. Until prerequisite 1 is done, the Monday run will
fail exactly the same way.

**Consequence for any external statement:** there is no evidence artifact for
SOC 2 A1.3 today, because no run has produced a summary. Claiming a rehearsed
restore on the strength of an automated workflow that has never succeeded is an
audit finding, not evidence.

## Context / Scope

Closes gap **G3** from
[`../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md),
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

**Nothing in this table has been measured.** The figures are what the
mechanisms promise, read from vendor documentation. Read §0 first: the only
figure with anything behind it today is D1 Time Travel, which is a platform
feature that needs no artifact.

| Store | What lives there | RPO (data loss) | RTO (time to restore) | Mechanism |
|---|---|---|---|---|
| **D1** `madagascar-db` | Audit log, page registry, bookings state, login logs, email drafts | **~0** within 7 days (Time Travel). **Unbounded beyond 7 days** — the weekly export has never produced an artifact (§0) | Time Travel: minutes, per Cloudflare's documentation; never drilled on production, by design. From the export: unknown, and unmeasurable until §0 item 1 | Time Travel, **7-day window on Workers Free**; weekly `wrangler d1 export` artifact, 90 days (`backups` workflow, chunk 6) — **not yet producing artifacts** |
| **Supabase Postgres** | Users, ARCO tickets, consent records, email ledger, inquiries | **Unbounded.** The organisation is on the **free** plan: Supabase backs up Pro/Team/Enterprise projects daily, not free ones, and there is no Dashboard restore here (§3). The weekly `pg_dump` has never run (§0 item 2) | n/a — there is nothing to restore from | Self-service `pg_dump` only. **This is the platform's single largest recovery gap.** |
| **KV** `ADMIN_SESSION` (binding `SESSION`) | Sessions, access maps | N/A — by design | ~0 | Not backed up (§4) |
| **R2** `madagascar-images` | CMS images, email attachments | **No backup** | Unbounded | See §5 — real gap |
| **R2** `madagascar-staff-storage` | Staff drive files — **including payroll and medical records** | **No backup** | Unbounded | See §5 — same gap, higher-sensitivity data |
| **Worker** | Application code | 0 | ~5 min | `git` + redeploy |

> **The drill is automated but has never succeeded.** `.github/workflows/backups.yml`
> is written to rehearse both restores every Monday and print the elapsed time
> and a row-count verdict in its job summary (Actions → backups → latest run).
> That summary is what SOC 2 A1.3 asks for — and it does not exist, because the
> workflow's one run failed (§0). Until the first green run of each half, the
> honest external answer for D1-beyond-7-days and for Postgres is *"documented
> targets, drill automated, **no result yet, and the automation is blocked on an
> owner action**."* R2 and KV are policies (§4, §5), not estimates.

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

### 2.1 Beyond seven days — restore from the weekly export

The `backups` workflow is written to keep a full `wrangler d1 export` (schema +
data) for 90 days as artifact `d1-madagascar-db-<run id>` (a `.tar.gz.gpg` when
`BACKUP_PASSPHRASE` is set; **unencrypted otherwise, and it is not set** — §0
item 3). No such artifact exists yet (§0). The export **creates tables**, so it cannot be
imported into the live database; restore into a fresh one and swap the binding:

```bash
# 1. Download the artifact (Actions → backups → run → Artifacts) and unpack
# 2. Fresh database, import, verify every table's row count against the export's source-counts.json
npx wrangler d1 create madagascar-db-restore-$(date +%Y%m%d) --location enam
npx wrangler d1 execute madagascar-db-restore-YYYYMMDD --remote --yes --file madagascar-db.sql
node scripts/backup_drill.mjs counts madagascar-db-restore-YYYYMMDD madagascar-db.sql restored.json
node scripts/backup_drill.mjs compare source-counts.json restored.json
# 3. Point BOTH repos at it: database_id in cf-admin wrangler.toml [[d1_databases]] and
#    cf-astro's, then release each (RULESAd §12: a wrong binding UUID fails silently — copy it from `wrangler d1 list`)
```

This is what the weekly drill is written to rehearse (into
`madagascar-db-drill-<run>`, deleted afterwards). It has not run successfully
yet (§0), so the duration is **not** known before it is needed — treat the
steps as untested.

> 🚨 **`madagascar-db` is SHARED with `cf-astro`.** A Time Travel restore rolls
> back the ENTIRE database, not the `admin_*` tables. Restoring to undo an
> admin-side mistake will also silently revert every `cf-astro` write since that
> timestamp. Before restoring: confirm the blast radius, and prefer a targeted
> row-level repair when the damage is narrow. Binding IDs in
> [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §1.

## 3. Supabase Postgres — there is no restore path today

> 🚨 **Corrected 2026-09-19. This section previously opened with "Dashboard →
> Database → Backups → pick the most recent good day → Restore" and an RPO of
> ≤24 h. Neither exists on this account.** Supabase backs up **Pro, Team and
> Enterprise** projects daily; free-plan projects are told to take their own
> `supabase db dump`/`pg_dump` copies, and any platform-side backup only
> becomes reachable *after* an upgrade. Verified 2026-09-19: organisation
> `Mascotas Madagascar's projects` → `"plan": "free"`. An operator who opens
> the dashboard mid-incident expecting that button will not find it.

**Today's real Postgres RPO is unbounded**: no platform backup, and the weekly
`pg_dump` has never run (§0 item 2). If the data is lost, it is lost.

Recovery options, in the order to try them:

1. **Nothing has been deleted yet?** Stop writing and take a dump immediately —
   `pg_dump --schema=public --format=custom` through the session pooler URI.
   Doing this by hand once is strictly better than the zero copies that exist.
2. **A dump artifact exists** (only once §0 item 2 is done) — §3.1.
3. **The project itself is gone** — open a Supabase support ticket; free-plan
   recovery is discretionary, not contractual.

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
which breaks the $0 constraint in ADR-0001. The cheap improvement is §0 item 2:
a weekly `pg_dump` in a workflow that already exists, for $0.

### 3.1 From the weekly dump

Artifact `supabase-madagascar-<run id>` holds `madagascar-public.dump`
(`pg_dump --schema=public --format=custom`, Postgres 17 client) and
`source-counts.csv`. To restore into a new Supabase project or branch:

```bash
pg_restore --dbname "<session pooler URI of the target>" --no-owner --no-privileges madagascar-public.dump
# then the three compliance counts above, and compare every table with source-counts.csv
```

The dump exists only once the `SUPABASE_DB_URL` secret is set (the **session
pooler** URI — the direct host is IPv6-only and unreachable from GitHub
runners); until then the workflow skips this half with a warning on every run.
**It is not set** (§0 item 2), so there is no dump to restore from and this
subsection describes a procedure, not an option.

> **Open ARCO tickets are the priority check.** Losing one loses a statutory
> deadline the data subject is still owed (GDPR Art. 15–17 / LFPDPPP), and the
> loss is invisible unless someone counts.

## 4. KV — deliberately not backed up

`ADMIN_SESSION` (the namespace behind the `SESSION` binding — there is no
namespace called `cf-admin-session`, which is what this line said until
2026-09-19) holds only sessions and cached access maps. Total loss logs
everyone out; they re-authenticate through Cloudflare Access and the access map
rebuilds from D1 on the next request. **No backup is needed and none exists** —
this is a design decision, not an oversight. See
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
| Weekly `rclone sync` to a backup bucket from the `backups` workflow (R2 S3 token as secrets) | loss of any object, up to a week of lag | a token that can delete the copy too | $0 within the free tier |
| **Both — the copy, plus an indefinite lock on the backup bucket** (recommended, chunk 6 §3.4) | both | nothing known | $0 |
| Accept the risk, document it | — | everything | current state |

**Owner decision D-13 (opened 2026-09-15), not yet taken.** The recommended row
needs a backup bucket and a scoped R2 token that only the owner can create.

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
> **A revert deploys without gates.** Workers Builds still runs its default
> command, so a `git revert` push deploys the reverted code with no `verify`
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
| Accidental `retention/purge` on the wrong table | Do **not** re-run anything | D1 → Time Travel to just before. **Postgres → nothing to restore from (§3); take a dump of what survives before doing anything else** |
| Supabase project deleted | Open a Supabase support ticket immediately | Free-plan recovery is discretionary (§3); rotate `SUPABASE_SERVICE_ROLE_KEY` |
| D1 corruption | `time-travel info` to resolve a bookmark | Check the `cf-astro` blast radius, then restore — the restore commits, there is no preview (§2) |
| R2 objects deleted (`madagascar-images` or `madagascar-staff-storage`) | Stop the cleanup cron | **Unrecoverable today** (§5). For staff-storage, first check whether the file is still in Trash (`is_deleted=1`, within 30 days) — that path is recoverable via `POST /api/storage/[id]/restore` even though the R2-level gap remains |
| Bad deploy | Cloudflare dashboard rollback | Then `git revert` so `main` matches production |
| Cloudflare account compromise | Incident runbook §4 | Rotate every token; audit Zero Trust policies |

## 8. The drill — automated 2026-09-15, first measurement still pending

**This runbook owns the drill cadence.** Any other document stating a restore
cadence should link here rather than restate it.

`.github/workflows/backups.yml` (every Monday 03:17 UTC, and on demand from the
Actions tab) is written to restore the D1 export into
`madagascar-db-drill-<run id>`, check every table's row count against the
source, delete the database, and do the same for the Supabase dump in a
`postgres:17` container. Each run's summary is meant to state the elapsed
seconds and the verdict.

**Status, verified 2026-09-19: one run ever — manual, 2026-09-15, failed after
41 s. Zero successful runs, zero summaries, zero measurements.** It is blocked
on §0 items 1–3 and will keep failing the same way until they are done.

Still manual, quarterly, ~30 minutes:

1. Confirm KV loss is non-destructive (log out, log back in).
2. Redeploy the Worker from a clean checkout. *(The release smoke stage that
   would measure propagation only runs inside `deploy:ci`, which production
   does not use — see `release-and-rollback.md` §1.)*
3. `wrangler d1 time-travel info madagascar-db` — read-only, to keep the
   bookmark lookup familiar. **Do not rehearse `restore` against production:**
   there is no read-only form of it, and the database is shared with cf-astro.
   Rehearse the restore path by importing an export into a throw-away database
   (§2.1), which is what the automated drill does.

Record the quarterly results in `../security/reviews/` as a dated snapshot.

## 9. Verification log

| Date | Method | Result |
|---|---|---|
| 2026-09-19 | `npx wrangler d1 time-travel restore --help` and `info --help` (wrangler 4.128.0); Supabase MCP `get_organization`; `.github/workflows/backups.yml` read; repository Actions secrets/variables/environments listed; `scripts/backup_drill.mjs` read | `--dry-run` does not exist on `restore`; org plan is `free`; the workflow needs four secrets and the repository has only `PERSONAL_PAT`; one workflow run ever, failed. §0 added; §1, §2, §3, §4, §7 and §8 rewritten. `scripts/backup_drill.mjs` and the §2.1 `wrangler d1 create/execute` flags re-checked and correct |

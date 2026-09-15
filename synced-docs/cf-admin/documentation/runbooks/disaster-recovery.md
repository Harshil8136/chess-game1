---

title: "Disaster Recovery & Backup Restore Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-09-15
verified_against: [code, config, infra]
owner: harshil
related_docs: [incident-response.md, ../operations/OPERATIONS.md, ../architecture/KV-RESILIENCE.md, ../security/compliance/SOC2-TSC-mapping.md]
tags: [disaster-recovery, backup, rto, rpo, soc2, iso22301, runbook]
---

# Disaster Recovery & Backup Restore Runbook

> **TL;DR (non-technical):** How to get the platform back if data is lost or a
> service fails — which button restores what, and how much data you would lose
> in each case. Read the honest caveat first: **the restore procedures below
> have never been executed.** The recovery targets are therefore estimates
> derived from vendor documentation, not measurements from a real drill.

## Context / Scope

Closes gap **G3** from
[`../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md),
and addresses SOC 2 **A1.2/A1.3** and the underlying control behind ISO 22301
(full 22301 certification is out of scope — see that audit §4.6).

**Covers:** data loss and service failure across D1, Supabase, KV, R2 and the
Worker deployment.

**Does NOT cover:** security incidents — see
[`incident-response.md`](incident-response.md). A ransomware or malicious-
deletion event is *both*; run the incident runbook first, this one second.

## 1. Recovery objectives — measured weekly since 2026-09-15

| Store | What lives there | RPO (data loss) | RTO (time to restore) | Mechanism |
|---|---|---|---|---|
| **D1** `madagascar-db` | Audit log, page registry, bookings state, login logs, email drafts | **~0** within 7 days (Time Travel); **≤ 7 days** beyond that (weekly export) | Time Travel: minutes (never drilled on production, by design). From the export: **measured by the weekly drill** — see the latest `backups` run summary; the first figure is in the chunk 6 record §11 | Time Travel, **7-day window on Workers Free**; weekly `wrangler d1 export` artifact, 90 days (`backups` workflow, chunk 6) |
| **Supabase Postgres** | Users, ARCO tickets, consent records, email ledger, inquiries | **≤24h** (free tier daily); **≤ 7 days** from the weekly dump | Dashboard restore: not measurable without a paid PITR/branch. From the dump: **measured by the weekly drill** once `SUPABASE_DB_URL` is set (chunk 6 §10) | Daily backup restore; weekly `pg_dump` artifact, 90 days |
| **KV** `cf-admin-session` | Sessions, access maps | N/A — by design | ~0 | Not backed up (§4) |
| **R2** `madagascar-images` | CMS images, email attachments | **No backup** | Unbounded | See §5 — real gap |
| **R2** `madagascar-staff-storage` | Staff drive files — **including payroll and medical records** | **No backup** | Unbounded | See §5 — same gap, higher-sensitivity data |
| **Worker** | Application code | 0 | ~5 min | `git` + redeploy |

> **Since 2026-09-15 the `backups` workflow rehearses both restores every Monday**
> and prints the elapsed time and a row-count verdict in its job summary
> (Actions → backups → latest run). That summary is the evidence SOC 2 A1.3 asks
> for; copy the numbers here when they change materially. Until the first green
> run of each half, the honest external answer for that store is *"documented
> targets, drill automated, first result pending."* R2 and KV are policies (§4,
> §5), not estimates.

## 2. D1 — point-in-time recovery

D1 Time Travel keeps a continuous **7-day** window at no cost on the Workers
Free plan (30 days on Workers Paid — this runbook said 30 until 2026-09-02),
so RPO is effectively zero within that window and **up to seven days beyond
it**, from the weekly export (§2.1).

```bash
# 1. Find a restore point BEFORE the damage
wrangler d1 time-travel info madagascar-db

# 2. Inspect without committing — always do this first
wrangler d1 time-travel restore madagascar-db --timestamp=<UNIX_TS> --dry-run

# 3. Restore
wrangler d1 time-travel restore madagascar-db --timestamp=<UNIX_TS>
```

### 2.1 Beyond seven days — restore from the weekly export

The `backups` workflow keeps a full `wrangler d1 export` (schema + data) for 90
days as artifact `d1-madagascar-db-<run id>` (a `.tar.gz.gpg` when
`BACKUP_PASSPHRASE` is set). The export **creates tables**, so it cannot be
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

This is exactly what the weekly drill rehearses (into `madagascar-db-drill-<run>`,
deleted afterwards), so the steps and their duration are known before they are
needed.

> 🚨 **`madagascar-db` is SHARED with `cf-astro`.** A Time Travel restore rolls
> back the ENTIRE database, not the `admin_*` tables. Restoring to undo an
> admin-side mistake will also silently revert every `cf-astro` write since that
> timestamp. Before restoring: confirm the blast radius, and prefer a targeted
> row-level repair when the damage is narrow. Binding IDs in
> [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §1.

## 3. Supabase Postgres

Free tier provides daily backups with **no point-in-time recovery**, so the
worst case is 24 hours of loss. PITR is a paid add-on (~$25/mo) and is the
single cheapest improvement available to the RPO in this table.

1. Dashboard → Database → Backups → pick the most recent good day → Restore.
2. Verify afterwards, in this order — highest compliance value first:

   ```sql
   SELECT COUNT(*) FROM legal_requests   WHERE status IN ('PENDING','IN_PROGRESS');
   SELECT COUNT(*) FROM admin_authorized_users WHERE is_active = true;
   SELECT COUNT(*) FROM consent_records;
   ```

3. Re-run `get_advisors` (Supabase MCP) — a restore can reintroduce RLS drift
   that was previously fixed.

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

> **Open ARCO tickets are the priority check.** Losing one loses a statutory
> deadline the data subject is still owed (GDPR Art. 15–17 / LFPDPPP), and the
> loss is invisible unless someone counts.

## 4. KV — deliberately not backed up

`cf-admin-session` holds only sessions and cached access maps. Total loss logs
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

**Binding IDs are the real risk here, not the code.** A `wrangler.toml`
pointing at a non-existent KV/D1 UUID fails silently — this caused a production
CMS outage in April 2026 (`RULESAd.md` §12). Verify against
`../operations/OPERATIONS.md` §1 before any recovery deploy.

## 7. Scenario playbooks

| Scenario | First action | Then |
|---|---|---|
| Accidental `retention/purge` on the wrong table | Do **not** re-run anything | D1 → Time Travel to just before; Postgres → daily backup (≤24h loss) |
| Supabase project deleted | Open a Supabase support ticket immediately | Restore from backup; rotate `SUPABASE_SERVICE_ROLE_KEY` |
| D1 corruption | `time-travel info` | Dry-run, then restore — check `cf-astro` blast radius first |
| R2 objects deleted (`madagascar-images` or `madagascar-staff-storage`) | Stop the cleanup cron | **Unrecoverable today** (§5). For staff-storage, first check whether the file is still in Trash (`is_deleted=1`, within 30 days) — that path is recoverable via `POST /api/storage/[id]/restore` even though the R2-level gap remains |
| Bad deploy | Cloudflare dashboard rollback | Then `git revert` so `main` matches production |
| Cloudflare account compromise | Incident runbook §4 | Rotate every token; audit Zero Trust policies |

## 8. The drill — weekly and automated since 2026-09-15

`.github/workflows/backups.yml` (every Monday 03:17 UTC, and on demand from the
Actions tab) restores the D1 export into `madagascar-db-drill-<run id>`, checks
every table's row count against the source, deletes the database, and does the
same for the Supabase dump in a `postgres:17` container. Each run's summary
states the elapsed seconds and the verdict — that summary is the dated evidence
SOC 2 A1.3 asks for.

Still manual, quarterly, ~30 minutes:

1. Confirm KV loss is non-destructive (log out, log back in).
2. Redeploy the Worker from a clean checkout — the release smoke stage already
   measures propagation (`release-and-rollback.md`).
3. `wrangler d1 time-travel info` and a `--dry-run` restore on production —
   read-only, to keep the command familiar.

Record the quarterly results in `../security/reviews/` as a dated snapshot.

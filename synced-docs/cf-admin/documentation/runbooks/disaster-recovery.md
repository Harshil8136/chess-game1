---

title: "Disaster Recovery & Backup Restore Runbook"
status: active
audience: [operator, technical, ai, owner]
last_verified: 2026-08-12
verified_against: [code, config]
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

## 1. Recovery objectives — stated, not yet proven

| Store | What lives there | RPO (data loss) | RTO (time to restore) | Mechanism |
|---|---|---|---|---|
| **D1** `madagascar-db` | Audit log, page registry, bookings state, login logs, email drafts | **~0** (continuous) | ~15–30 min est. | Time Travel, 30-day window |
| **Supabase Postgres** | Users, ARCO tickets, consent records, email ledger, inquiries | **≤24h** (free tier daily) | ~30–60 min est. | Daily backup restore |
| **KV** `cf-admin-session` | Sessions, access maps | N/A — by design | ~0 | Not backed up (§4) |
| **R2** `madagascar-images` | CMS images, email attachments | **No backup** | Unbounded | See §5 — real gap |
| **R2** `madagascar-staff-storage` | Staff drive files — **including payroll and medical records** | **No backup** | Unbounded | See §5 — same gap, higher-sensitivity data |
| **Worker** | Application code | 0 | ~5 min | `git` + redeploy |

> ⚠️ **Every RTO above is an estimate from vendor documentation.** None has been
> measured. SOC 2 A1.3 asks for evidence of *tested* recovery; that evidence
> does not exist yet. The drill in §8 is the outstanding action, and until it
> runs the honest external answer is *"documented targets, first drill
> scheduled"* — never *"proven RTO/RPO."*

## 2. D1 — point-in-time recovery

D1 Time Travel keeps a continuous 30-day window at no cost, so RPO is
effectively zero within that window.

```bash
# 1. Find a restore point BEFORE the damage
wrangler d1 time-travel info madagascar-db

# 2. Inspect without committing — always do this first
wrangler d1 time-travel restore madagascar-db --timestamp=<UNIX_TS> --dry-run

# 3. Restore
wrangler d1 time-travel restore madagascar-db --timestamp=<UNIX_TS>
```

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
recover). Versioning closes both; Trash closes neither.

Options, none yet implemented:

| Option | Cost | Effort |
|---|---|---|
| Enable R2 object versioning (both buckets — prioritise `madagascar-staff-storage`) | Storage delta only | Low — **recommended first step** |
| Scheduled `rclone` copy to a second bucket | ~$0 within free tier | Medium |
| Accept the risk, document it | $0 | Current state |

## 6. Worker / application

Code recovery is `git`; the deployment is reproducible.

```bash
git log --oneline -20
git revert <sha> && git push origin main    # main auto-deploys
# or roll back in the Cloudflare dashboard → Workers → Deployments
```

**Binding IDs are the real risk here, not the code.** A `wrangler.toml`
pointing at a non-existent KV/D1 UUID fails silently — this caused a production
CMS outage in April 2026 (`GITHUB_RULES.md` §6). Verify against
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

## 8. The drill — outstanding

**Never performed.** Until it is, §1 contains estimates.

Planned quarterly drill, ~2 hours, on non-production data:

1. `wrangler d1 time-travel info` and a `--dry-run` restore — **measure** it.
2. Supabase restore into a throwaway branch — **measure** it.
3. Confirm KV loss is non-destructive (log out, log back in).
4. Redeploy the Worker from a clean checkout — **measure** it.
5. Replace every estimate in §1 with the measured number and update
   `last_verified`.

Record results in `../security/reviews/` as a dated snapshot. That artefact,
not this document, is what satisfies SOC 2 A1.3.

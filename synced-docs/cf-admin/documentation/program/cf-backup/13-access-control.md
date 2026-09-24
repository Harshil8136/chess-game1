---
title: "cf-backup — 13 Access control, activity logs and global config"
status: draft
audience: [owner, ai, technical, operator]
owner: harshil
related_docs: [README.md, 02-admin-integration-contract.md, 09-key-management.md, 11-run-evidence-and-usage.md, 12-keys-and-secrets.md, 14-live-operations-view.md, ../../architecture/PERMISSIONS-SYSTEM.md]
tags: [program, cf-backup, permissions, rbac, audit, config]
---

<!-- docs-check: proposed-paths -->
<!-- This is a plan: nothing in it is built yet. It names routes, settings keys and screens that do not exist yet. -->

# 13 — Access control, activity logs and global config

> **TL;DR (owner requirement, 2026-09-22).** Two layers.
>
> - **cf-admin** decides who may **open** the console: one page row, `/dashboard/backup`, managed in cf-admin exactly as today.
> - **cf-backup** decides what each person may **do** inside it: view, run, cancel, bypass a cooldown, edit settings, delete old runs, export activity logs, see or rotate keys, and more. It works from a **closed catalog of 23 capabilities**. Every role has defaults, individual people can be granted or denied capabilities (optionally until a date), and the Owner or Vendor manages it all on the console's **Access** screen.
>
> The policy is **one JSON row** (`backup:access`); there is no new table. Every check runs on the server. Deny beats allow; an unknown capability is denied. Three safety floors cannot be granted away.

## 1. The two layers

| Layer | Question | Decided by | Managed in |
|---|---|---|---|
| 1. The door | "Can this person open `/dashboard/backup` at all?" | cf-admin: session, role, the `/dashboard/backup` page row (nested paths inherit it, `decide-access.ts:41`) | cf-admin's existing page and user administration, unchanged |
| 2. The actions | "Can this person run a backup, see logs, rotate the key…?" | cf-backup, against the actor cf-admin's gateway attaches to every request (doc 02 §4) | The console's **Access** screen (§5) |

cf-admin's permission model stays the authority for identity and entry
([PERMISSIONS-SYSTEM.md](../../architecture/PERMISSIONS-SYSTEM.md)). cf-backup's catalog
is a feature-level layer *behind* that door, the same shape as cf-admin's own split keys
for the cron page. It lives next to the code it protects, so a new capability ships with
the feature that needs it and needs no cf-admin migration.

## 2. The capability catalog

Classes decide the guards. **Read** capabilities show things. **Operate** capabilities
change what the system does. **Destructive** ones remove or take data out. **Secret** ones
touch the backup key. **Admin** changes who may do what.

| Capability | Allows | Class | Guards | Default roles |
|---|---|---|---|---|
| `console.view` | Open the console; see status and **what is running now** (doc 14) | read | — | Admin, Owner, Vendor |
| `runs.view` | Run history and run detail | read | — | Admin, Owner, Vendor |
| `logs.view` | Logs, the **live log**, live metrics, GitHub's archive viewer | read | — | Admin, Owner, Vendor |
| `usage.view` | Usage, allowances, the viability view | read | — | Admin, Owner, Vendor |
| `activity.view` | Who did what, when (§6) | read | — | Admin, Owner, Vendor |
| `config.view` | Read the global config (§7) | read | — | Admin, Owner, Vendor |
| `access.view` | See who holds which capabilities | read | — | Owner, Vendor |
| `keys.status` | Key fingerprints, dates, key-check results (no key material) | read | — | Owner, Vendor (**floor**) |
| `runs.annotate` | Add or edit a note on a run ("restored from this on …") | operate | — | Admin, Owner, Vendor |
| `logs.download` | Download raw logs and GitHub's archive | operate | audited | Admin, Owner, Vendor |
| `activity.export` | **Generate an activity log** export (CSV + JSON) for a date range | operate | audited | Admin, Owner, Vendor |
| `runs.run` | **Run now** (full, or Supabase-only) | operate | typed confirmation; cooldown; **a per-person daily limit** (`runGuards.manualRunsPerPersonPerDay`, default 6, bounds 1–24, doc 13 §7, Ruling R-4); refused while a run is active (doc 14 §6) | Owner, Vendor |
| `runs.cancel` | Cancel a queued or running backup | operate | confirmation; reason | Owner, Vendor |
| `runs.bypass-cooldown` | **Bypass** the Run-now cooldown | operate | reason required; both notified | Owner, Vendor |
| `runs.drill` | Start a real-path restore drill now | operate | typed confirmation | Owner, Vendor |
| `schedule.toggle` | Enable or disable the GitHub schedule | operate | confirmation; reason; both notified | Owner, Vendor |
| `config.edit` | **Change global config** (§7) | operate | a diff shown before saving; audited | Owner, Vendor |
| `runs.prune` | **Delete** runs older than N days (never the newest 4 good full runs; never inside a lock) | destructive | typed confirmation; reason; both notified | Owner, Vendor |
| `runs.download` | Download a run's **encrypted data** | destructive | fresh sign-in ≤ 10 min; both notified | Owner, Vendor (**floor**) |
| `keys.reveal` | **View / download the backup key** (the recovery kit) | secret | fresh sign-in; typed confirmation; ≤ 3/day per person; both notified | Owner, Vendor (**floor**) |
| `keys.rotate` | **Generate a new key** and make it active; also confirm a recovery kit | secret | fresh sign-in; typed confirmation; ≤ 1/day; both notified | Owner, Vendor (**floor**) |
| `keys.rekey` | Re-key old runs to the current key (doc 10 §4) | secret | fresh sign-in; typed confirmation; both notified | Owner, Vendor (**floor**) |
| `access.manage` | Change role defaults and per-person grants | admin | a diff shown before saving; both notified | Owner, Vendor (**floor**) |

"Both notified" means an email to the Owner and to Vendor support, plus an `ops/events`
record (doc 11). **As built (Ruling R-1):** these are alerts of kind `notice` on
`backup:status.pendingAlerts`, queued through `/internal/tick` like every other alert
(D-11) — there is no separate mail path for "both notified" actions. "Fresh sign-in" comes
from the gateway's `signedInAt` (doc 02 §4).
Staff, Manager and Viewer get nothing by default. They cannot open the page until
cf-admin's page row lets their role in, and even then only what the policy (§4) grants.

> **As built in Phase 1a (2026-09-23):**
>
> - **System actors hold no console capability.** cf-admin's jobs (the `system` actor
>   kind, doc 02 §8) get 403 on every console endpoint, including `/api/health`.
>   Capabilities belong to people (floor K-3); the jobs reach cf-backup through internal
>   paths or RPC outside the gateway prefix, never through the console API.
> - **The typed-confirmation dialogs** (`runs.run`, `runs.drill`, `runs.prune`,
>   `keys.rotate`, `keys.reveal`, `keys.rekey`) require typing one of three words —
>   `RUN`, `ROTATE` or `REVEAL` — matching the action underway.
> - **The action paths** (the plan named only `POST /api/runs` and the live endpoints):
>   `runs/bypass-cooldown`, `runs/cancel`, `runs/drill`, `runs/prune`,
>   `runs/:key/annotate`, `runs/:key/download` (**POST**, so the gateway's audit
>   chokepoint records it — doc 02 §3 rule 7), `schedule`, `keys/rotate|reveal|rekey`,
>   `activity/export`, and `POST` on `access` and `config`.

> **As built in the full build (2026-09-23), superseding the three-word list above:**
>
> - **`runs.prune` gets its own word, `PRUNE`** (Ruling R-6): typing `RUN` to delete data
>   invited a slip, so the confirmation dialogs now check **one of four words** — `RUN`,
>   `ROTATE`, `REVEAL` or `PRUNE` — matching the action underway. `keys.rekey` and
>   `keys.confirm-kit` have no `x-backup-audit` action of their own (C5 lists neither); both
>   are audited as `keys.rotate op=rekey` / `op=confirm-kit`, landing on cf-admin's
>   `backup_key_action` without the "unrecognised action" Sentry warning (Ruling R-3).
> - **`keys.rekey` answers 501 `not_implemented`.** The header re-wrap it would need
>   (ChaCha20-Poly1305) is outside WebCrypto's coverage, so this build documents it as not
>   built rather than faking it (README "Decisions from the full build"); the capability and
>   its floor still exist for when it is.

## 3. The rules

1. **The server enforces; the UI only mirrors.** Every console API endpoint declares exactly one capability. A test fails the build if an endpoint declares none. The UI hides or disables what the person lacks, which is convenience, never protection.
2. **Deny beats allow.** A per-person deny overrides that person's role default.
3. **Unknown means deny.** A capability id the running code does not know is refused. (The 2026-09-20 cron review found guards that failed *open* on a missing registry row; this rule exists so that cannot recur here.) A capability the code knows but the stored policy has never mentioned gets its **code default**, so new features work on the day they ship with safe defaults.
4. **Three floors that no policy can cross** (OD-27; reversible only by a code change the owner approves):
   - the **secret** class, `keys.status`, `runs.download` and `access.manage` belong to **Owner and Vendor support only**. The policy may take them *away* from one of those two, but never give them to Admin or below (doc 09 K-3);
   - **audit is always on**: no setting turns off `ops/events`, the gateway's audit row or the notifications;
   - the **locks, redaction and the recipient check** are not configurable.
5. **Last-holder guard.** A change that would leave **no active person** holding `access.manage` or `keys.rotate` is refused. (The 2026-09-16 incident locked the only Owner out for 14 hours; this is the same lesson applied here.)
6. **Time-boxed grants.** A per-person grant can carry `expiresAt`, for example "let this admin run backups this week". Expiry is checked on every request; nothing needs cleaning up.
7. **Effect is prompt.** The policy row is read at most every 30 s per isolate, so a change applies within half a minute. *(As built in Phase 1a, 2026-09-23: the D1 read paths for `backup:access` and `backup:config` exist, but this 30 s cache is not built yet — each request re-reads D1 directly.)*
8. **Every change is recorded** (§6): who, when, the before/after diff, and the reason if one was given.

## 4. Where the policy lives

One row in `admin_portal_settings`, key `backup:access`. That is the dynamic-config store
RULE #0.8 points to, so no table, env var or KV namespace is added. Writes use
compare-and-swap on `rev`, the pattern cf-admin's cron control row already uses, so two
people saving at once cannot overwrite each other.

```json
{
  "schema": "cf-backup/access@1",
  "rev": 7,
  "roles": {
    "admin":  ["console.view", "runs.view", "logs.view", "usage.view", "activity.view", "config.view",
               "runs.annotate", "logs.download", "activity.export"],
    "owner":  ["…every capability…"],
    "vendor_support": ["…every capability…"]
  },
  "people": {
    "<sign-in email, lowercase>": {
      "allow": ["runs.run"], "deny": [],
      "expiresAt": "2026-10-31T23:59:59Z", "note": "covering the owner's leave",
      "grantedBy": "<email>", "grantedAt": "2026-10-01T15:04:00Z"
    }
  },
  "updatedBy": "<email>", "updatedAt": "2026-10-01T15:04:00Z"
}
```

People are keyed by their sign-in email, which is what the gateway's actor carries. A grant
for someone who has never signed in simply waits until they do.

> **As built in Phase 1a (2026-09-23):** the stored row also carries an additive
> `known: string[]` field — the capability ids the policy was last saved against. It lets
> rule 3 above tell *a capability never mentioned* (which still gets its code default)
> apart from *a capability the owner deliberately removed from a role* (which the stored
> row now says explicitly), once a save has happened. Additive within the schema's major
> version (RE-8).

## 5. What the Access screen shows

- **A matrix:** roles down the side, capabilities across, grouped by class. Floors show as locked cells with the reason on hover.
- **Who can open the page** at all, read from cf-admin's `/dashboard/backup` page row (read-only, same D1). A warning appears when a capability is granted to a role that cannot get through the door.
- **People with grants or denies**, each with its expiry and note. Adding one means typing an email and ticking capabilities.
- **Save** shows a plain-language diff ("Admin gains *Run now*; Maria loses *Cancel*"), then writes.
- **History:** the last changes with who, when and the diff; any version can be restored.
- **Reset to defaults** (confirmation required).

## 6. Activity logs

**`activity.view`** shows one merged timeline:

| Source | What it contributes | Store |
|---|---|---|
| cf-backup's own records | Dispatches, cancels, prunes, key actions, config and access changes, reconcile and key-check results, failures | R2 `v1/ops/` (doc 11) |
| cf-admin's gateway audit rows | Every change request a person made through the console, with actor, path and outcome | `admin_audit_log` in D1, read-only, filtered to `/dashboard/backup/` |
| Run lifecycle | Queued, started, sealed, verdict, and who started it or which schedule did | Run folders and indexes |

Filters: person, action, capability class, run, date range, outcome.

**`activity.export`** ("generate activity logs") writes a CSV and a JSON file for the chosen
date range and filters to `v1/exports/activity/<timestamp>/`. That prefix is unlocked and
prunable. The files are offered for download immediately, and the export is itself an
audited event. Exports carry staff identities (sign-in emails), as `admin_audit_log`
already does, and **never** customer data, secrets or row data.

## 7. Global config (`backup:config`)

Everything operational that is not a key and not a floor. It is one JSON row in
`admin_portal_settings`, validated on save with bounds, compare-and-swap on `rev`, and each
change recorded with its diff. The runner reads it once at the start of each run through
key 1's D1 access, so the thresholds it applies are always the saved ones.

| Group | Settings | Bounds |
|---|---|---|
| Alerts | Recipients; which events email (failed, warning, stale, allowance ≥ 80%); quiet hours | recipients must be staff addresses; `failed` and `stale` cannot be switched off |
| Verification | Size-anomaly drop %, slow-drill multiplier, export-duration warning, freshness windows (full, daily) | within the ranges in doc 03 §5 |
| Run guards | Run-now cooldown (hours); business-hours warning window; **`manualRunsPerPersonPerDay`** (as built, Ruling R-4) | cooldown 1–24 h; per-person daily limit 1–24, default 6 |
| Live view | Refresh while active, refresh while idle, pause after inactivity (doc 14 §3) | active refresh ≥ 2 s |
| Evidence | Log cap and the head/tail kept (doc 11 RE-2) | redaction cannot be switched off |
| Retention suggestions | Daily-run days, weekly-full months, keep-first-of-month | suggestions only; locks still apply |
| Keys | Rotation reminder (months), recovery-kit confirmation interval | reveal and rotate rate limits can be tightened, never loosened past §2 |

The schedule itself (the cron times) lives in the workflow file, so changing it is a
commit. The console can only enable or disable it (`schedule.toggle`).

## 8. Tests that hold all this in place

- Every console endpoint declares a capability (build fails otherwise).
- An unknown capability is denied; a known-but-unstored one gets its code default.
- The floors: a policy granting a secret-class capability to Admin is rejected on save *and* ignored on read.
- The last-holder guard refuses a change that would leave `access.manage` or `keys.rotate` with no active holder.
- An expired grant stops working at its `expiresAt`.
- Deny beats allow, for every capability.
- Concurrent saves: the second compare-and-swap fails with a clear "someone else changed this, reload" message.

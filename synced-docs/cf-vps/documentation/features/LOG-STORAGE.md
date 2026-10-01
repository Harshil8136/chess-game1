---
title: "Log Storage: Retention and Deletion"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_code: [contract/logstore.ts, agent/src/collectors/logstore.ts, host/20-audit/files/opt/vps/lib/retention-keys.sh, host/20-audit/files/opt/vps/bin/vps-audit-maintain, host/65-actions/files/opt/vps/bin/vps-act-purge, host/65-actions/files/opt/vps/bin/vps-act-retention, host/65-actions/files/opt/vps/bin/vps-act-journal-vacuum, src/ui/screens/LogStorage.tsx, test/logstore.test.ts, test/host-units.test.ts]
related_docs: [../security/AUDIT-PIPELINE.md, ACTIONS.md, ../security/PERMISSIONS.md, ../specs/2026-09-30-log-storage-design.md]
tags: [feature, logs, retention, purge, zstd]
---

# Log Storage: Retention and Deletion

> **TL;DR (non-technical):** The server's logs grow every day. This feature shows how much
> space they use, lets the owner decide how long each kind is kept, and lets the owner delete
> old logs on purpose. Deleting is previewed first, needs a typed confirmation and a recent
> sign-in, is recorded in three places, and can never touch today's logs or the locked
> off-server copy.

The design and reasoning are in the dated spec
[`../specs/2026-09-30-log-storage-design.md`](../specs/2026-09-30-log-storage-design.md),
now `historical`. This page describes what shipped.

## Retention per kind

The nightly cleanup (`vps-audit-maintain`) removes whole past days of each kind after its
retention. Settings live in `/etc/vps/retention.conf` (`key=days`); a missing or out-of-range
line means the default. The table is repeated in `host/20-audit/files/opt/vps/lib/retention-keys.sh`
for the host scripts, and `test/logstore.test.ts` fails if it differs from `RETENTION`.
Limits apply to automatic expiry and to `retention.set`; an explicit purge may remove any
past day.

| Key | Covers | Default (days) | Min | Max |
|---|---|---|---|---|
| `session`, `command`, `privilege`, `config`, `security` | Logins, commands, sudo, config and security events | 180 | 30 | 365 |
| `sudo_io` | sudo terminal output | 180 | 30 | 365 |
| `recording` | The audit record's copy of session output | 90 | 14 | 365 |
| `journal` | The system journal, which Recordings replays from | 90 | 14 | 365 |
| `process_exit`, `system`, `pipeline`, `canary`, `probe` | Exit codes and platform chatter | 30 | 3 | 365 |
| `service_command` | Commands run by services and timers | 14 | 3 | 365 |
| `acct` | The process-accounting pipe file (also copied into `process_exit`) | 3 | 1 | 30 |

The journal is aged by journald (`MaxRetentionSec`), not by the cleanup script.

## What is stored where

| Store | Where | Notes |
|---|---|---|
| Audit record | `/srv/audit/raw/YYYY/MM/DD/<kind>.jsonl` | Past days compressed with zstd level 19; older `.gz` days stay readable; a day can hold plain, `.gz` and `.zst` parts |
| Process accounting | `/srv/audit/acct/` | Kept by its own key |
| sudo output | `/srv/audit/sudo-io/` | A session is dated by its newest file |
| Laurel and auditd working files | Their own folders | Capped by generation count, not by retention |
| System journal | The system journal | Age and size capped |
| R2 audit bucket | Off the server | Security classes only; locked 90 days; never touched by this feature |

## The console page

Security, **Log storage** (`security.view` to open; route `logstore/usage`):

- Audit disk usage, daily growth and an estimate of days until full at that rate.
- Per kind: bytes stored, the oldest and newest day, and retention (editable with
  `retention.manage`); the last 30 days as bytes per kind; the journal's size and oldest entry.
- Delete panel (`logs.purge`) in three modes: **By date** (`mode=range`), **Free up space**
  (`mode=size`, oldest complete days first until the bytes are reached, counted as stored),
  and **Older than** for the journal (`logs.vacuum`). Kinds are grouped as low value,
  activity, security and config, and recordings.
- **Preview** (`logstore/preview`, `logs.purge`) lists the exact files, totals and the largest
  files. The delete then runs with exactly that selection. A kind the agent cannot read
  (sudo output) is deleted too but not counted in the preview.
- Logs, Recordings and Timeline show a retention line ("kept N days") with a link here.

## How a delete stays safe

| Rule | Where enforced |
|---|---|
| Both `logs.purge` and `retention.manage` are floor capabilities: owner and vendor only, and either can be denied for one person | `contract/capabilities.ts` |
| Needs a sign-in from the last 10 minutes and the typed word `delete` (retention edits need the sign-in, and the console asks for a typed confirmation when shortening) | Worker, console |
| Whole past days only: never today, from before to, at most 400 days, known kinds, no repeats | `parsePurgeTarget` in the Worker and agent; the root script validates again |
| Never a file changed in the last hour; never R2 | `vps-act-purge` |
| Preview and purge use one rule, kept identical in the agent's `purgeFiles` and the root script | `test/host-units.test.ts` checks they agree |
| Purge and nightly cleanup share one lock, so they never interleave | `vps-audit-maintain`, `vps-act-purge` |
| A failed retention write keeps the old value; a missing config file falls back to defaults, never to zero | `vps-act-retention`, `readRetention` |
| The journal can be cut only by age, because journald cannot remove a middle range | `logs.vacuum` |

Every change is recorded before it runs: a cf-admin activity-log row (`vps_logs_purge` or
`vps_retention_change`), a host journal line (`vps-purge` or `vps-retention`) and, for a
purge, a Sentry warning (`log_purge`). A retention change is also seen by the config watch.
Shortening retention or deleting logs is the classic way to hide tracks, so none of it is
silent.

## Key code paths

- Kinds, retention table, target parsers: `contract/logstore.ts`
- Usage and preview (read-only): `agent/src/collectors/logstore.ts`
- Nightly compress and expire: `host/20-audit/files/opt/vps/bin/vps-audit-maintain`
- Root scripts: `host/65-actions/files/opt/vps/bin/vps-act-purge`, `vps-act-retention`,
  `vps-act-journal-vacuum`
- Page: `src/ui/screens/LogStorage.tsx`

## Related

- [AUDIT-PIPELINE](../security/AUDIT-PIPELINE.md): what the logs hold and where they go.
- [ACTIONS](ACTIONS.md): the three storage actions and the enforcement chain.

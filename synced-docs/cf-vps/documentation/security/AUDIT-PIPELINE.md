---
title: "Forensic Audit Pipeline"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-08
verified_against: [code]
owner: harshil
related_code: [host/20-audit/files/etc/audit/rules.d/50-vps.rules, host/25-logship/files/etc/vector/conf.d/10-sources.yaml, host/25-logship/files/etc/vector/conf.d/20-transforms.yaml, host/25-logship/files/etc/vector/conf.d/30-sinks.yaml, host/25-logship/files/opt/vps/bin/vps-r2-upload, host/25-logship/files/opt/vps/bin/vps-heartbeat, host/20-audit/files/opt/vps/bin/vps-audit-maintain]
related_docs: [../features/LOG-STORAGE.md, ../features/RESTORE-TESTS.md, ../architecture/OVERVIEW.md, ../operations/HOST-MODULES.md, PERMISSIONS.md]
tags: [security, audit, forensics, vector, r2, sentry]
---

# Forensic Audit Pipeline

> **TL;DR (non-technical):** The server keeps a detailed diary of who logged in, what they
> ran and what they changed. A copy of the important parts is sent off the server to a
> storage bucket that cannot be altered for 90 days, so the diary survives even if the
> server is broken into. Only real problems become alerts; everything else is just recorded.

## What is recorded

| Source | Captures | Module |
|---|---|---|
| Kernel audit (auditd) read by Laurel as JSON | Every command run by a logged-in person (the login id survives sudo), commands run by services and containers, changes to watched config paths, kernel modules, clock changes, mounts, ptrace, and changes to the audit rules themselves | `20-audit` |
| System journal | SSH logins and failures, sudo, a per-login session record, terminal recordings (tlog), terminal certificates, integrity scan results, site probes, console purge and retention lines, pipeline chatter | `20-audit`, `25-logship` |
| Process accounting | The exit code or signal of every process | `20-audit` |
| sudo I/O | The terminal output of sudo sessions | `20-audit` |

The audit rules are locked (`-e 2`) after P1, so a rule change needs a reboot; see
[`../runbooks/audit-rule-change.md`](../runbooks/audit-rule-change.md). The login id is
immutable, so a person cannot hide behind `su` or `sudo`.

Vector (`25-logship`) normalises everything to one schema (`ts`, `host`, `source`, `class`,
`summary`, `alert`, `alert_key`, `event`) and assigns a **class**:

| Class | Holds | Leaves the server |
|---|---|---|
| `session` | Logins, logouts, session records | yes |
| `command` | Commands run by a logged-in person | yes |
| `privilege` | sudo | yes |
| `config` | Changes to watched config paths (SSH, sudoers, PAM, accounts, cron, boot, polkit, units, firewall, platform files) | yes |
| `security` | Failed logins, kernel module, clock, mount and ptrace events, audit-rule changes, terminal certificates, integrity findings, log deletion and retention changes | yes |
| `probe` | External site checks (down, back up, certificate expiry), every server job run, every job control from the console (cancelled, paused, resumed, blocked, unblocked, limits and schedule changes, none of them alerted) and a job going quiet ([JOBS](../features/JOBS.md)) | yes |
| `service_command` | Commands run by services, daemons and containers | no |
| `recording` | Terminal session recordings | no |
| `process_exit` | Process exit records | no |
| `pipeline` | auditd, Laurel, Vector and heartbeat messages | no |
| `canary` | The heartbeat's test record | yes, separately |
| `system` | Everything else in the journal | no |

## Where it goes

1. **Local record.** Every event is written, unredacted, to
   `/srv/audit/raw/YYYY/MM/DD/<class>.jsonl` on a fixed-size audit disk, so it is readable at
   once with ordinary tools. The console reads it through the agent.
2. **Compression and expiry.** `vps-audit-maintain` runs daily at 00:23 UTC. It compresses
   past days with zstd level 19 (files quiet for an hour; today's stay plain) and expires each
   class after its own retention. See [LOG-STORAGE](../features/LOG-STORAGE.md).
3. **Off-server copy.** The six leaving classes are redacted, then written to one outbox
   file per minute. `vps-r2-upload` runs every minute, compresses each finished file, uploads
   it with a unique key, and deletes it locally only after R2 answers 200. A failed upload
   stays and is retried. Vector holds no R2 credentials; only the uploader does, through
   systemd credentials. The bucket is locked for 90 days, so nothing can be overwritten or
   deleted in that window, including by the console.
4. **Redaction.** Before leaving, text matching password, secret, token, API-key,
   authorization or bearer assignments, GitHub tokens, JWTs, private key headers, AWS key ids
   and `sk-` keys is replaced. The local record is not redacted.
5. **Sentry.** A small subset of alerts, below.

Why an outbox and not Vector's own S3 sink: the sink's checksum headers are rejected by R2
(`30-sinks.yaml` records the reason).

## What reaches Sentry

An event gets an `alert` type in the transforms. The `alerts` filter then sends it to Sentry
only if it passes this rule:

- it has an alert, and
- it is not `deploy` or `retention_change` (cf-admin's activity log already records those), and
- a `config_change` is sent only for the watched places where a backdoor lives: SSH keys,
  sudoers and privilege, PAM, accounts, SSH config, cron, boot and polkit.

| Alert | Raised when | Level |
|---|---|---|
| `config_change` | A logged-in person changed a watched path (see above) | warning |
| `audit_change` | A logged-in person changed the audit rules | error |
| `security` | A person loaded a kernel module or set the clock; root mounted or ptraced (routine container and systemd mounts are not alerted) | warning |
| `auth_failure` | A real account ran out of SSH attempts (root and scanners are recorded only) | warning |
| `terminal_admin` | A certificate was issued for the sudo-capable terminal account | warning |
| `integrity` | AIDE or debsums found files changed outside a package or deploy | warning |
| `probe_down` | A public site is down twice in a row | error |
| `job_failed` | A server job's run failed (after its retries), keyed by job | error |
| `job_missed` | A server job waited longer than its own limit and did not run, keyed by job | warning |
| `job_quiet` | A scheduled server job has not succeeded for longer than its `quiet_after`, or its schedule is off though nobody paused or blocked it (the agent's 5-minute check, one line when it turns quiet), keyed by job | warning |
| `tls_expiring` | A certificate is close to expiry | warning |
| `log_purge` | The console deleted logs or vacuumed the journal | warning |

Volume limits: one alert per key every 10 minutes, one `auth_failure` per account per hour,
and at most 30 alerts an hour overall. Anything dropped by a limit is still in the local
record and, for the leaving classes, in R2. The Sentry sink has a 256 MB disk buffer and drops
the newest events when full. Every alert also appears on the console's Alerts page.

A backup restore test is a server job, so it alerts the same way: `job_failed` when it fails,
including a run whose cleanup could not be proven (`CLEANUP FAILED`), and `job_missed` when it
waited too long. Its output stays in the run's folder on the server, not in the journal: the
checker prints names, counts and timings only, and the runner withholds any output line shaped
like an email address or phone number. Staging a copy, starting and cancelling a test are
logged by the agent with the person's email, like every console change (`restore.stage`,
`restore.start`, `restore.cancel`, which cf-admin's activity log records as
`vps_restore_test`); see [RESTORE-TESTS](../features/RESTORE-TESTS.md).

A release switch under the platform folder is recorded as a `deploy` info event, not sent;
unpacking a release or pruning an old one is recorded and not alerted.

## The heartbeat

`vps-heartbeat` runs every 5 minutes. It checks that auditd is enabled, Laurel and Vector are
running, the audit disk is not filling and the clock is in sync. It then proves delivery end
to end: the canary it emitted last time must be in R2 and under 15 minutes old. It reports to a
Sentry cron monitor, and sends a Sentry event only when the set of problems changes, with a
reminder every 6 hours while it lasts.

## Who can read it

| Capability | Reads |
|---|---|
| `audit.view` | The timeline of sessions, commands, sudo and config changes |
| `sessions.replay` | Terminal recordings |
| `security.view` | Alerts, posture, login sources in Logs, log storage usage |

Reads of files, logs and the audit record are logged to the journal with the person's email.

## Related

- [LOG-STORAGE](../features/LOG-STORAGE.md): retention, deletion, compression.
- [HOST-MODULES](../operations/HOST-MODULES.md): the modules that install this.
- Runbooks (private): `disk-full.md` when the audit disk fills, `audit-rule-change.md` after the lock.

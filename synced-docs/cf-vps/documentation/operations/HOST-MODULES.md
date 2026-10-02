---
title: "Host Modules"
status: active
audience: [operator, ai, technical]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_code: [host, host/push.sh, host/lib/install.sh]
related_docs: [DEPLOY.md, ../security/AUDIT-PIPELINE.md, ../features/ACTIONS.md, ../architecture/OVERVIEW.md]
tags: [operations, host, modules, apply]
---

# Host Modules

> **TL;DR (non-technical):** Everything installed or configured on the server is kept as
> code in the `host/` folder, in numbered modules. Each module is applied one small step at a
> time and can be re-run safely. The server can be rebuilt from these files.

## How a module works

- `host/NN-name/apply.sh <step>` is the entry point; `files/` mirrors the target paths on the
  server. Run as root from the pushed copy: `sudo bash /tmp/vps-host/<module>/apply.sh <step>`
  after `bash host/push.sh`.
- Steps are idempotent. They source `host/lib/install.sh`, which skips unchanged files so a
  re-run does not raise an audit alert.
- An unknown step exits with status 2 and the usage line. Run one step, read it, then run the next.
- Many modules have a `test` step; `host/lib/test.sh` tests the shared install helper itself.
- Numbers set the order of first use. Gaps leave room for later modules.

## Modules and steps

| Module | Purpose | Steps |
|---|---|---|
| `00-baseline` | Safety baseline: accounts and the SSH group, a break-glass account, GRUB menu for serial recovery, rpcbind masked, base tools, folder layout, four resource slices, hardened `sshd`, log rotation, removal of the legacy shared key. `slim` purges what a cloud VM never uses (a mail server that listened on port 25, firmware, disk and modem daemons, VMware tools) and leaves Oracle's agents alone. `tidy` is housekeeping you can rerun: the apt cache, old snap revisions, and upgrade leftovers in `/etc`, except in the paths that alert | `accounts`, `grub`, `rpcbind`, `tools`, `layout`, `slices`, `keys <file>`, `sshd`, `logrotate`, `lock-legacy`, `slim`, `tidy` |
| `15-firewall` | Loopback owner-match rules so only named service users reach local ports; the provider's own rules are left untouched | `apply`, `status`, `test` |
| `20-audit` | The forensic recording layer: audit disk image, journald limits, auditd rules, Laurel, process accounting, sudo I/O, per-login session record, terminal recording (tlog), retention table and nightly maintenance, rule lock | `fs`, `journald`, `auditd`, `laurel`, `acct`, `sudo`, `session`, `tools`, `tlog-install`, `tlog-testuser`, `tlog-enable-ubuntu`, `tlog-disable-ubuntu`, `lock`, `status`, `test` |
| `25-logship` | Vector (normalise, route, redact), the R2 outbox uploader and the heartbeat | `vector`, `upload`, `heartbeat`, `status`, `test` |
| `30-node` | Node 24 from the vendor's signed apt repository (key fingerprint checked), plus automatic patch updates of that major only | `install` (includes `autoupdate`), `autoupdate` |
| `40-tunnel` | `cloudflared` as its own user over QUIC; the connector token is stored first by `scripts/setup/tunnel-token.mjs` | `install`, `start`, `status` |
| `50-podman` | Rootful Podman with Quadlet for apps: own user namespace per app, read-only root, no capabilities, loopback-only port; app firewall | `install`, `fw`, `status`, `test` |
| `55-nginx` | nginx as the single app ingress on a loopback port; the client address comes from the Cloudflare header, trusted from loopback only | `install`, `config`, `status`, `test` |
| `57-postgres` | PostgreSQL 18 from the vendor repository: socket only, SCRAM passwords, a resource slice, nightly dumps kept 7 days. After every dump, each new one is encrypted to the platform's backup key (public half only on the server) and sent to the R2 audit bucket under `backups/postgres/`, locked 30 days and expired at 35; the upload is checked against R2's MD5, and a failure alerts in Sentry | `install`, `config`, `dumps`, `offbox`, `offbox-test` (end to end with a throwaway database), `status`, `test` |
| `60-agent` | The host agent as a hardened systemd service: user, unit (with the `StateDirectory` that holds the metrics history), Worker public keys, the `vps` CLI, release install and rollback | `user`, `unit`, `keys`, `cli`, `install <tarball> <version>`, `rollback`, `status`; `test.sh` runs install and rollback in a temp folder |
| `65-actions` | The console's controlled actions: fixed root oneshot units, the polkit rule, the service allow-list, the log storage scripts | `install`, `status`, `test` |
| `70-integrity` | Hardening score and file integrity: Lynis weekly, AIDE nightly, debsums weekly; results feed the console's Posture page | `install`, `init`, `run`, `status` |
| `72-probes` | Public-site checks every 5 minutes from the server: HTTP status and redirects, TLS expiry; state changes go to the journal | `install`, `run`, `status`, `test` |
| `80-terminal` | The browser terminal's host side: the unprivileged and sudo-capable accounts (certificates only), an SSH certificate authority, the root-side signer, sshd on a loopback port, a reaper that ends old admin sessions | `install` (runs accounts, CA, signer, sshd), `status`, `test` |

Other items under `host/`:

| Path | What it is |
|---|---|
| `host/push.sh` | Copies `host/` (without `.md` files) to a temporary folder on the server |
| `host/lib/` | `install.sh` (a quiet `install` that leaves unchanged files alone) and its `test.sh` |
| `host/apps/` | Example app manifest consumed by `vps app apply` |

## Order of a first build

Baseline, audit and log shipping first (so everything after is recorded), then the tunnel and
firewall, then the agent, then Podman, nginx, PostgreSQL, actions, integrity, probes and the
terminal; run each module's `test` step after it. The detailed order and its reasons are in
[DEPLOY](DEPLOY.md). The audit rules are locked once the pipeline is proven, and a later
change then needs a reboot.

## Where to look

- What the audit modules record and ship: [AUDIT-PIPELINE](../security/AUDIT-PIPELINE.md)
- What `65-actions` allows: [ACTIONS](../features/ACTIONS.md)
- How the pieces connect: [OVERVIEW](../architecture/OVERVIEW.md)

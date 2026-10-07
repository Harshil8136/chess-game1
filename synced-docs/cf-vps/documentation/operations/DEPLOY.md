---
title: "Deploying cf-vps"
status: active
audience: [operator, ai, technical]
last_verified: 2026-10-07
verified_against: [code]
owner: harshil
related_code: [package.json, scripts/deploy-agent.mjs, host/push.sh, host/60-agent/apply.sh, host/66-jobs/apply.sh, wrangler.json, scripts/setup]
related_docs: [HOST-MODULES.md, ../architecture/OVERVIEW.md, ../security/PERMISSIONS.md]
tags: [operations, deploy, rollback, workers-builds]
---

# Deploying cf-vps

> **TL;DR (non-technical):** cf-vps has three parts that deploy three different ways: the
> private Worker deploys itself when code is pushed to `main`; the host agent is installed
> with one command that rolls itself back if the new version does not start; and the
> server's own configuration is applied one small step at a time. When a change spans parts,
> the server side goes first.

## The three parts

| Part | How it deploys | Checked by | Rollback |
|---|---|---|---|
| Worker and console UI | Push to `main`; Workers Builds runs the build and deploy | `npm run verify` as the build command | Roll the Worker back to the previous version in Cloudflare, or revert and push |
| Host agent (`agent/`) | `npm run agent:deploy` from a developer machine | A health check on the new release | Automatic on a failed health check; `60-agent apply.sh rollback` by hand |
| Host modules (`host/NN-*`) | `bash host/push.sh`, then one `apply.sh <step>` at a time | The module's `test` step where it has one | Re-apply the previous version of the module from git; no automatic rollback |

## Order for a change that spans parts

1. **cf-admin first** if the change adds an action id. cf-admin accepts only a closed list of
   action names in its activity log, so it must know a new one before the console offers it.
2. **Agent**, so it can answer a new route before anything asks for it.
3. **Host modules**, when the change needs new units, scripts or config.
4. **Worker**, by pushing to `main`.

A new server job (`host/66-jobs`) follows the same order, with its steps in this sequence:
`install` (files only, nothing runs yet), `image` (builds what the manifest names
`localhost/…`), then each of its secrets with `scripts/setup/job-secret.mjs`, then `enable`
(switches the timers on). `test` runs each job once. Doing `enable` before the image and the
secrets exist makes the first run fail for a reason the Jobs page then shows
([JOBS](../features/JOBS.md)).

The route table in `contract/capabilities.ts` is shared. The Worker refuses a route that is not
in its copy, and the agent answers 404 for one that is not in its own, so a Worker newer than
the agent shows errors on new pages; an agent newer than the Worker shows nothing. The console
compares the table's fingerprint (`ROUTE_TABLE_ID`) with the Worker's and says when they differ.

## The Worker

- `main` is `src/worker.ts`; static assets are the built console (`vite build`).
- Workers Builds settings: root `/`, branch `main`, build command `npm run verify`, deploy
  command `npx wrangler deploy`. A push therefore runs the tests, then deploys.
- `npm run verify` runs, in order: `typecheck` (Worker, Node tests, UI, agent, agent tests),
  `types:check` (`wrangler types --check`), `test` (unit and agent projects), `build`,
  `test:build` (the built output, including that no dev-only code remains), and `audit`
  (`npm audit --audit-level=high`). Run it locally before every push.
- A new advisory turns `audit` red with no code change (it did on 2026-10-06), and then every
  push is refused until it is fixed. When the direct packages do not carry the fixed version
  yet, pin it under `overrides` in `package.json` and remove the pin once they do. Never lower
  the audit level, and never take `npm audit fix --force` when it offers a downgrade. Current
  pin: `sharp` 0.35.5, which miniflare (under wrangler and the Vite plugin) still holds at
  0.35.4 (GHSA-wq5f-xc86-pv6w).
- Bindings: the shared D1 database (`DB`), the VPC service (`KROWN`), the assets binding.
  The required secret `VPS_SIGNING_KEY` must exist or `wrangler deploy` is refused.
- The build token needs permission to edit Worker scripts, read D1 and bind to the
  connectivity directory. Build secrets are visible to install scripts, so keep none there.
- The Worker has no public route. After a deploy, check the console through the portal.

## The agent

`npm run agent:deploy [-- <ssh-host>]` (`scripts/deploy-agent.mjs`):

1. Builds the agent with `tsc` and writes `VERSION` (`<git sha>[-dirty]-<timestamp>`).
2. Packs a tarball and copies it with `host/lib`, `00-baseline`, `30-node` and `60-agent` to a
   temporary folder on the server over SSH.
3. Runs `60-agent apply.sh install <tarball> <version>` as root. It unpacks the release
   outside the audited folder, renames it into `/opt/vps/agent/releases/<version>`, switches
   the `current` link, restarts the agent and polls the health endpoint (up to 20 tries, half
   a second apart). On failure it switches back to the previous release, removes the bad one
   and exits non-zero. It keeps the newest five releases.

Manual rollback: `sudo bash /tmp/vps-host/60-agent/apply.sh rollback` switches to the newest
release other than the current one, and refuses if that one fails its health check. Use
`status` to see the current release. `npm run test:host` runs the module's checks, including
rollback safety. The agent's public keys (`worker-signing.pub`) are installed by the `keys`
step, not by an agent release.

The unit file is not part of a release either. `60-agent apply.sh unit` installs it and
reloads systemd, but the running agent keeps its old settings until it restarts. When an
agent release needs a unit change (for example the `StateDirectory` the metrics history writes
to), apply `unit` first, then deploy the agent, whose install restarts it.

## Host modules

```
bash host/push.sh                                       # copy host/ (without .md files) to the server
sudo bash /tmp/vps-host/<module>/apply.sh <step>        # on the server, one step at a time
```

Every step is idempotent and reads `host/lib/install.sh`, which does not rewrite an unchanged
file, so a re-run raises no audit alert. Run one step, read the output, then the next. Destructive
steps run alone. A first-time build follows the numbering of [HOST-MODULES](HOST-MODULES.md):
baseline, firewall, audit, log shipping, Node, tunnel, Podman, nginx, PostgreSQL, agent,
actions, jobs, integrity, probes, terminal. The firewall step skips rules for a user that does not
exist yet (the tunnel and agent users) and says so; apply it again after those modules.

After the audit rules are locked, new rules load only at boot; follow the runbook for that
(private: `runbooks/audit-rule-change.md`).

## Secrets and keys

| Secret | Where it lives | Made by |
|---|---|---|
| Worker signing key (private) | The Worker secret `VPS_SIGNING_KEY` | `scripts/setup/signing-key.mjs`; the public half is committed to `host/60-agent/files/etc/vps/` |
| Tunnel connector token | The server only | `scripts/setup/tunnel-token.mjs` |
| R2 upload key pair | The server only, as systemd credentials | `scripts/setup/r2-audit-creds.mjs` |
| A job's own secrets | The server only, as the systemd credential `job-<job>.<ENV_NAME>` | `scripts/setup/job-secret.mjs <job> <NAME>` (typed at a prompt, never echoed) |

These scripts print no secret. Rotation steps are in the private runbook `key-rotation.md`.

## Local development

`npm run dev` opens an SSH forward to the agent and serves the console locally with a dev
key limited to reads. A preview started before a route existed will show errors on it;
restart it.

## Related

- [HOST-MODULES](HOST-MODULES.md): every module and its steps.
- [OVERVIEW](../architecture/OVERVIEW.md): how the parts connect.
- Private: [`OWNER-SETUP.md`](OWNER-SETUP.md) for the steps only the owner can do;
  [`../program/HANDOFF.md`](../program/HANDOFF.md) for current state.

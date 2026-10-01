---
title: "cf-vps Architecture Overview"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_code: [src/worker.ts, src/http/router.ts, src/agent/proxy.ts, src/gateway/actor.ts, contract/capabilities.ts, contract/signing.ts, agent/src/server.ts, agent/src/auth.ts, wrangler.json]
related_docs: [../security/PERMISSIONS.md, ../security/AUDIT-PIPELINE.md, ../features/ACTIONS.md, ../operations/DEPLOY.md, ../reference/API-ROUTES.md]
tags: [architecture, worker, agent, tunnel, trust]
---

# cf-vps Architecture Overview

> **TL;DR (non-technical):** cf-vps lets approved people look after one rented server from
> inside the admin portal. The portal checks who you are, a private service decides what you
> may do, and a small program on the server does the work. Nothing on the server is open to
> the internet, every request is signed, and every sensitive step leaves a record.

## Components

| Part | Where it runs | What it does |
|---|---|---|
| cf-admin gateway | The admin portal's Worker | Authenticates the person, then forwards `/dashboard/vps/app/` to cf-vps through a service binding with an actor header |
| cf-vps Worker | Cloudflare, private (`workers_dev` and preview URLs off, no route) | Serves the console and its API, resolves the person's capabilities, signs each agent call |
| Console UI | Static assets in the Worker (`src/ui`, Preact) | One page per area; shows only what the person may open |
| Workers VPC binding + tunnel | Cloudflare and the server | Carries the Worker's calls to the agent over an outbound-only Cloudflare Tunnel; no inbound port is open |
| Host agent | The server, Node, runs as an unprivileged user | Reads host state, enforces capabilities again, starts controlled actions |
| Host modules | `host/NN-name/` | Everything installed on the server, as code, applied over SSH |
| Audit plane | The server | auditd, Laurel, tlog, sudo I/O and process accounting into Vector, then local storage, R2 and Sentry |
| App platform | The server | Rootful Podman apps behind one nginx ingress, PostgreSQL on a socket |

## Request path

```
Browser
  -> cf-admin: Access login, portal role, page permission
  -> service binding, header x-vps-actor (email, role, signed-in time, request id)
  -> cf-vps Worker: parse actor, load access policy, compute capabilities,
     refuse early (403 + the capability needed), Ed25519-sign path, query,
     body hash, actor and capability list
  -> Workers VPC binding -> Cloudflare Tunnel (outbound from the server)
  -> host agent on loopback: verify signature, re-check the route's capability
  -> read from the host, or start a fixed root unit through polkit
```

The Worker handles everything under `/dashboard/vps/app/` (`BASE_PATH`); the API lives under
`/dashboard/vps/app/api/`. Paths with `//`, backslashes or encoded slashes or dots are refused
before routing. Routes in `AGENT_ROUTE_CAPS` are the only ones that can reach the agent, so
the Worker cannot be used as a general proxy onto the host.

## Trust boundaries

| Boundary | What is trusted across it | How it is protected |
|---|---|---|
| Browser to cf-admin | Nothing; the person logs in | Cloudflare Access, cf-admin roles and page permissions |
| cf-admin to Worker | The actor header | The Worker has no public route; only the service binding reaches it. cf-admin drops any header a browser sent. Missing or invalid header gives `bad_actor` |
| Worker to agent | The signed capability list | Ed25519 signature over method, path, query, timestamp, single-use nonce, body hash, actor and capabilities. 60-second skew. The agent holds public keys only |
| Agent to root | Nothing beyond named units | polkit lets the agent start only the fixed `vps-act-*` units; each root script validates its target again |
| Terminal | A 30-second ticket | The Worker mints it, the root-side signer verifies it, and issues a 60-second SSH certificate for one account |

Fail-closed rules: no signing key in the Worker answers 503; no public key on the agent answers
401 on every signed route; an invalid stored access policy errors rather than falling back to
open; an unknown route is 404; the agent answers only loopback `Host` names.

## Data stores

| Store | Holds | Notes |
|---|---|---|
| cf-admin's D1 database (binding `DB`) | One settings row, `vps:access`: role defaults and per-person grants | cf-vps owns no tables. Compare-and-swap on a revision; read cached 30 s per isolate |
| Worker secret `VPS_SIGNING_KEY` | The Ed25519 private key | Deploys are refused without it (`secrets.required`) |
| Host config in `/etc/vps` | Retention table, service allow-list, Worker public keys | Written by host modules |
| Audit disk | `/srv/audit`: the forensic record | A fixed-size image, so a full audit disk cannot fill the system disk |
| System journal | Service logs and terminal recordings | Age-limited by retention |
| R2 audit bucket | Off-server copy of security classes | Locked for 90 days; see [AUDIT-PIPELINE](../security/AUDIT-PIPELINE.md) |
| Sentry | Alerts for real problems only | Not a record |
| Agent releases | `/opt/vps/agent/releases/<version>`, `current` link | Rollback switches the link |
| App data | `/srv/apps`, `/srv/share`, PostgreSQL dumps kept 7 days | Apps run with a read-only root and no capabilities |

## Agent hardening

The agent runs as its own user with no capabilities, `ProtectSystem=strict`, `ProtectHome`, a
256 MB memory cap, and writes only to the app and share folders. It reads logs and the audit
record through supplementary groups, not root. Reads of files, logs and the audit record are
written to the journal with the person's email.

## Related

- [PERMISSIONS](../security/PERMISSIONS.md): who may do what.
- [ACTIONS](../features/ACTIONS.md): the controlled changes.
- [API-ROUTES](../reference/API-ROUTES.md): the route table.
- [DEPLOY](../operations/DEPLOY.md) and [HOST-MODULES](../operations/HOST-MODULES.md).
- Plan of record: [`../specs/2026-09-29-cf-vps-design.md`](../specs/2026-09-29-cf-vps-design.md).

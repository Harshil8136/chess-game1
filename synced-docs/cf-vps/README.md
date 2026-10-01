# cf-vps

The Madagascar platform's VPS layer: the host `krown` (Oracle Cloud A1, Ubuntu 26.04 arm64) managed as code, its forensic audit trail, its app platform, and a private Cloudflare Worker that serves the VPS console embedded in cf-admin.

**Documentation:** start at [`documentation/README.md`](documentation/README.md) (index of every doc). Conventions: [`documentation/CONTRIBUTING-DOCS.md`](documentation/CONTRIBUTING-DOCS.md). Current state and what to resume: [`documentation/program/HANDOFF.md`](documentation/program/HANDOFF.md). AI tools: [`main.md`](main.md).

| Folder | What it holds |
|---|---|
| `host/` | Everything installed on the server, as idempotent modules (`NN-name/apply.sh <step>` plus `files/`). The server can be rebuilt from it. |
| `agent/` | The host agent (Node), deployed with `npm run agent:deploy`. |
| `src/`, `contract/` | The Worker, the console UI, and the contract (capabilities, actions, route table) the Worker, agent and UI share. |
| `documentation/` | All docs. Some are published to the public mirror (see `scripts/docs-mirror.mjs`); the rest are private. |

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Live console on your PC, reading the server through SSH (needs Node 22.13 or newer and working `ssh krown`; open <http://localhost:5173/dashboard/vps/app/>) |
| `npm run verify` | Typecheck, tests, build, build-output test, audit. Run before every commit; Workers Builds runs it on push to `main` |
| `npm run agent:deploy` | Build the agent and install it on the server as a new release (health-checked; rolls back on failure) |
| `node scripts/docs-mirror.mjs check` | Check that every published doc is free of identifiers and credentials |

Run a host step one at a time and read its output before the next:

```bash
bash host/push.sh                                   # copy host/ to krown:/tmp/vps-host
ssh krown 'sudo bash /tmp/vps-host/00-baseline/apply.sh accounts'
```

Details: [`documentation/operations/DEPLOY.md`](documentation/operations/DEPLOY.md) and [`documentation/operations/HOST-MODULES.md`](documentation/operations/HOST-MODULES.md).

## Local preview notes

`npm run dev` opens an SSH forward to the agent (`127.0.0.1:7070` on the server), waits for it to answer, and starts the console. A dropped forward reopens by itself within 1 to 30 seconds. Ctrl+C stops everything.

The preview signs with a dev key that reads everything (host, logs, files, security, the audit timeline, replays) and changes nothing: downloads, file changes, actions and the terminal work only in the console inside cf-admin.

Two local files are git-ignored: `.dev.vars` (the dev signing key, made by `node scripts/setup/signing-key.mjs`) and `dev.local.json` (per-machine settings; copy `dev.local.example.json`, for example to use another ssh alias).

A console message `Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.` comes from a browser extension, not from the console.

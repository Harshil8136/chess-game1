# Start Here (AI & Contributor Entry Point)

This repository is **cf-vps**: the Madagascar platform's server layer. It holds the host configuration as code (`host/`), a Node host agent (`agent/`), a private Cloudflare Worker with a Preact console (`src/`), and the contract they share (`contract/`). Read the docs before changing code.

## Read these first, in order

1. [`documentation/README.md`](./documentation/README.md): the index of every doc, grouped by folder.
2. [`documentation/architecture/OVERVIEW.md`](./documentation/architecture/OVERVIEW.md): components, request path, trust boundaries and data stores.
3. [`documentation/security/PERMISSIONS.md`](./documentation/security/PERMISSIONS.md): the capability catalog, roles, floors and fresh sign-in. Read it before touching access or adding a route or action.

Then, as the task requires:

- [`documentation/program/HANDOFF.md`](./documentation/program/HANDOFF.md): current state and what to resume. Private.
- [`documentation/operations/DEPLOY.md`](./documentation/operations/DEPLOY.md) and [`HOST-MODULES.md`](./documentation/operations/HOST-MODULES.md): how each part ships.
- [`documentation/features/ACTIONS.md`](./documentation/features/ACTIONS.md): the controlled changes and their enforcement chain.
- [`documentation/security/AUDIT-PIPELINE.md`](./documentation/security/AUDIT-PIPELINE.md): what is recorded, retained and alerted.
- [`documentation/runbooks/README.md`](./documentation/runbooks/README.md): what to do when something breaks.

For documentation conventions (folders, front-matter, what is published), see [`documentation/CONTRIBUTING-DOCS.md`](./documentation/CONTRIBUTING-DOCS.md).

## Working agreement

- **One contract.** Capabilities, the agent route table and the action list live in `contract/`. Change them there; the Worker, agent and console read the same file. Add a test, and expect the route-table fingerprint to change.
- **Check in layers.** The Worker refuses early, the agent re-checks from the signed capability list, and the root script validates its own target. Do not weaken one layer because another exists.
- **Host changes go through `host/` modules.** Apply one step at a time and read its output before the next. Run destructive steps alone. Never `ufw`; the firewall module edits the provider's iptables rules in a marked block.
- **Deploys.** The Worker deploys on push to `main` (Workers Builds runs `npm run verify` then `npx wrangler deploy`). The agent deploys with `npm run agent:deploy`. When a change spans parts, the agent and host go first.
- **Verify before you push.** `npm run verify` runs typecheck, tests, build, the build-output test and the audit. `node scripts/docs-mirror.mjs check` covers the published docs.
- **Published docs carry no identifiers.** No hostnames, IP addresses, account ids, emails, fingerprints or tokens in anything on the `PUBLISHED_DOCS` list. Say "the server" and "the tunnel".
- **Never put a secret value in a file or a chat.** Secret names only. The setup scripts under `scripts/setup/` write secrets without printing them.
- **Records are frozen.** Do not edit dated files under `documentation/records/` or finished specs to match today; write or update a living doc instead.

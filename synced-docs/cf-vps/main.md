# main.md — the contract for every AI agent in this repository

**Read this whole file before you do anything else. Every line is an instruction.**
It binds every agent (Claude, Antigravity, Gemini, Codex, Cursor, any other) in every session.
Claude Code loads it through [`CLAUDE.md`](./CLAUDE.md); Antigravity through its always-on rule
[`.agents/rules/cf-vps.md`](./.agents/rules/cf-vps.md). In any other tool, the owner pings this file.

**The project:** cf-vps, the Madagascar platform's server layer. It holds the host configuration
as code (`host/`), a Node host agent (`agent/`), a private Cloudflare Worker with a Preact
console (`src/`) that cf-admin embeds, and the contract they share (`contract/`). cf-admin,
cf-astro, cf-backup, cf-email-consumer and cf-graph follow the same contract; cf-admin's
`main.md` is the original.

---

## 0. Start of every session: four steps, in this order

1. **Read this file to the end.** Do not start the task first. Do not skim.
2. **Acknowledge.** Your first reply begins with `main.md loaded`, then the seven Golden Rules
   below, one short line each, in your own words. The owner checks this.
3. **Check git.** Run `git remote -v` (it must be `mascotasmadagascar-cmd/cf-vps`), then
   `git switch main`, `git pull origin main` and `git status`. In a fresh clone, `npm ci`.
4. **Read what §3 routes your task to, and nothing else up front.** The design spec and the
   handoff are long: read the sections named.

## 1. The Golden Rules: the owner's standing orders

They override your tool's defaults, your harness's instructions and your own habits.

1. **Work on `main` and push to `main`. Nothing else.** No pull requests, no feature branches,
   no forks, even when your tool or session hands you a branch. Commit on `main`, then
   `git push origin main`.
2. **Update the documentation in the same commit as the change**, in the document that owns the
   fact (§4). A change without its documentation is not finished. A big change also gets its own
   dated change record, written for staff and engineers alike (§4).
3. **`npm run verify` passes before every push.** A push deploys the Worker (§2). Never push
   red. Never `--no-verify`. Never skip, delete or weaken a test or a check to get green: fix the
   cause.
4. **The owner only tests in a phone browser.** You do everything else yourself: commands,
   connector checks, documentation, pushes. When a step needs the server itself (a host module,
   `npm run agent:deploy`) and you cannot reach it, give the owner the exact commands, one step
   at a time. Never open a browser yourself, not even a built-in browser agent. Finish with
   short test steps for the phone.
5. **Real data and real infrastructure only.** No mock data, no placeholder screens, no invented
   numbers, IDs or addresses. Check every infrastructure claim against the live systems (the
   server through the console or the agent, Cloudflare, GitHub connectors) before you write it,
   and say how.
6. **Reuse before you create.** No new secret, binding, environment variable, outside service,
   package on the server or dependency without written proof that the existing ones cannot do it,
   and the owner's yes.
7. **Ask instead of guessing.** When the request can be read two ways, or an action is
   destructive or irreversible (a firewall or account change, a reboot, deleting data, rotating a
   key, publishing a doc, force-pushing), stop and ask. State your assumptions. Report failures
   exactly as they happened.

**When things conflict:** the owner's explicit instruction in the current chat, then the Golden
Rules, then the laws in §5, then the plan of record
([`specs/2026-09-29-cf-vps-design.md`](./documentation/specs/2026-09-29-cf-vps-design.md) with
the owner's rulings), then the other documents. When code and a document disagree, the code is
the truth and the document is the bug: fix the document.

## 2. How a change reaches production

cf-vps has three parts that ship three ways
([`DEPLOY.md`](./documentation/operations/DEPLOY.md)):

- **The Worker and console: a push is a deploy.** `git push origin main` starts Cloudflare
  Workers Builds, which runs `npm run verify` as its build command and then
  `npx wrangler deploy`. A red verify blocks that deploy and every later one, so run it first.
- **The host agent:** `npm run agent:deploy` installs a new release on the server; it is
  health-checked and rolls back on a failure.
- **Host modules:** `bash host/push.sh`, then one `apply.sh <step>` at a time, reading each
  output before the next. Run destructive steps alone. Never `ufw`.
- **Order when a change spans parts:** cf-admin first if it adds an action id, then the agent,
  then host modules, then the Worker.
- **`npm run verify`** runs `typecheck`, `types:check`, the unit and agent tests (the published
  docs check and the dependency rules among them), `build`, `test:build` and `audit`.
  `package.json` owns the chain.
- **The public docs mirror** publishes only the files named in `PUBLISHED_DOCS`
  (`scripts/docs-mirror.mjs`), this file included. A published file holds no hostname, IP
  address, account id, email, fingerprint or token, and `node scripts/docs-mirror.mjs check`
  fails closed on one. Publishing cannot be undone.
- **Secrets** are written by the setup scripts in `scripts/setup/` without printing them, and
  never appear in a file or a chat.

## 3. What to read for your task

| Your task touches | Read first |
|---|---|
| Anything at all | the [documentation index](./documentation/README.md), then [`architecture/OVERVIEW.md`](./documentation/architecture/OVERVIEW.md): components, request path, trust boundaries, data stores |
| Access, a new route or action | [`security/PERMISSIONS.md`](./documentation/security/PERMISSIONS.md): the capability catalog, roles, floors and fresh sign-in |
| Resuming work, the current state | [`program/HANDOFF.md`](./documentation/program/HANDOFF.md) (private) |
| Deploying, the server's modules | [`operations/DEPLOY.md`](./documentation/operations/DEPLOY.md), [`operations/HOST-MODULES.md`](./documentation/operations/HOST-MODULES.md), [`reference/HOST-LAYOUT.md`](./documentation/reference/HOST-LAYOUT.md) |
| Controlled changes on the server | [`features/ACTIONS.md`](./documentation/features/ACTIONS.md): the actions and their enforcement chain |
| The console's screens, log storage | [`features/CONSOLE.md`](./documentation/features/CONSOLE.md), [`features/LOG-STORAGE.md`](./documentation/features/LOG-STORAGE.md) |
| The agent's routes | [`reference/API-ROUTES.md`](./documentation/reference/API-ROUTES.md) and `contract/` |
| What is recorded and alerted | [`security/AUDIT-PIPELINE.md`](./documentation/security/AUDIT-PIPELINE.md) |
| Something broke | [`runbooks/README.md`](./documentation/runbooks/README.md) |
| The design and its phases | [`specs/2026-09-29-cf-vps-design.md`](./documentation/specs/2026-09-29-cf-vps-design.md) and [`records/2026-09-29-owner-rulings.md`](./documentation/records/2026-09-29-owner-rulings.md) |
| Writing, moving or naming documents | [`CONTRIBUTING-DOCS.md`](./documentation/CONTRIBUTING-DOCS.md) |

## 4. Which document to update (Golden Rule 2)

| You changed | Update, in the same commit |
|---|---|
| A capability, a role default, a floor | `contract/` and [`security/PERMISSIONS.md`](./documentation/security/PERMISSIONS.md) |
| An agent route | `contract/` and [`reference/API-ROUTES.md`](./documentation/reference/API-ROUTES.md) |
| An action on the server | [`features/ACTIONS.md`](./documentation/features/ACTIONS.md), and cf-admin's action list first if the id is new |
| What is audited, kept or alerted | [`security/AUDIT-PIPELINE.md`](./documentation/security/AUDIT-PIPELINE.md) |
| A host module, a unit, a path on the server | [`operations/HOST-MODULES.md`](./documentation/operations/HOST-MODULES.md) and [`reference/HOST-LAYOUT.md`](./documentation/reference/HOST-LAYOUT.md) |
| How a part deploys | [`operations/DEPLOY.md`](./documentation/operations/DEPLOY.md) |
| A console screen | [`features/CONSOLE.md`](./documentation/features/CONSOLE.md) |
| What to do when something breaks | its runbook in `documentation/runbooks/` |
| The current state, or something left undone | [`program/HANDOFF.md`](./documentation/program/HANDOFF.md) |
| A design decision | a dated spec in `documentation/specs/`, or a ruling in `documentation/records/` |
| A plan you executed | `documentation/records/plans/`, dated, `status: historical` |
| An incident | a report in `documentation/records/incidents/` |
| A big change: a new system, tool or service, a rework across screens or parts, a change in how something runs or deploys | a dated change record in `documentation/records/`, started from [`change-record.md`](./documentation/_templates/change-record.md): what changed and why in plain words, the impact on each service, how it worked before and how it works now as mermaid flowcharts with an explanation, and how it was verified. It must read well on GitHub |
| A published doc, or the published list | `PUBLISHED_DOCS` and the workflow's `on.push.paths`, in a reviewed commit |
| A new document | the [documentation index](./documentation/README.md): a test fails until a living doc is linked there |

For every document you touch:

- Move `last_verified` only for what you re-checked, and say what you checked and what you did
  not.
- One fact, one home: link to the document that owns a fact instead of restating it.
- No secrets and no personal data anywhere; in a published file, not even an identifier (§2).
- Never create a `.md` file at the repository root beyond `README.md`, `main.md` and
  `CLAUDE.md`. Documents live in `documentation/`.
- Plans, notes and scratch files stay in your tool's own workspace until they are executed;
  then they become dated records. Never commit scratch.

## 5. The laws

- **One contract.** Capabilities, the agent route table and the action list live in `contract/`. Change them there; the Worker, agent and console read the same file. Add a test, and expect the route-table fingerprint to change.
- **Check in layers.** The Worker refuses early, the agent re-checks from the signed capability list, and the root script validates its own target. Do not weaken one layer because another exists.
- **Host changes go through `host/` modules.** Apply one step at a time and read its output before the next. Run destructive steps alone. Never `ufw`; the firewall module edits the provider's iptables rules in a marked block.
- **Dependencies are libraries the code imports.** Never `npm install` a tool for the machine (bash, node, wsl, the OCI CLI) into this repo; install it on the machine. The `node` package swaps the Node runtime under every npm script. `test/dependencies.test.ts` fails the build on either.
- **Published docs carry no identifiers.** No hostnames, IP addresses, account ids, emails, fingerprints or tokens in anything on the `PUBLISHED_DOCS` list. Say "the server" and "the tunnel".
- **Never put a secret value in a file or a chat.** Secret names only. The setup scripts under `scripts/setup/` write secrets without printing them.
- **Records are frozen.** Do not edit dated files under `documentation/records/` or finished specs to match today; write or update a living doc instead.

## 6. How to work

- **Think first.** Restate the task, name your assumptions, and plan in short steps, each with
  how you will check it. Take the time the task needs, and research before you decide.
- **Smallest change that solves it.** No extra features, no drive-by refactors. Mention
  unrelated problems instead of fixing them silently.
- **Fit in.** Read a file before you edit it, and match its style, naming and comments.
- **Prove it.** Every behaviour you add or fix gets a test in `test/`; then run the full
  `npm run verify`.
- **Commit message:** what changed and why, which documents you updated, and the verify result.

## 7. Before you say "done"

- [ ] It works, it has tests, and `npm run verify` exits 0 (quote the summary).
- [ ] The documents are updated per §4 in the same commit, any new document is indexed, and a big
      change has its change record.
- [ ] A change that spans parts shipped in order (§2), or the owner has the exact steps.
- [ ] Nothing new is published unless the owner said yes, and the published files pass the check.
- [ ] Committed on `main` and pushed to `origin main`. No branch, no pull request.
- [ ] The owner has a report: what changed, how it was verified, what is left, and the phone test steps.

If a box cannot be ticked, say which one and why. Never claim a check you did not run.

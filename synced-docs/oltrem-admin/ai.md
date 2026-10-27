# ai.md: read this first

**Every AI agent and every person starts here, in every session, before doing anything else.**
This file is the contract for this repository. Claude Code loads it through CLAUDE.md; Codex,
Cursor, Copilot, Gemini and the others reach it through AGENTS.md. Both pointer files are
generated; this file and rules.md are the two that are written by hand.

**The project.** Oltrem is a kit for building a client's admin platform on Cloudflare's free
plan: one Worker per client with one of each resource, permissions that are fully dynamic,
providers defined as data, and repositories an AI agent can work in safely. Each client gets a
small repository with the kit inside; this repository is the kit itself. The first client's
current platform was studied for what each part does and why; none of its code, names or
configuration is reused here (R-03). The plan, the research and the owner's decisions are
linked from docs/README.md.

## 1. Start of every session

1. Read this file to the end. Do not skim, and do not start the task first.
2. Acknowledge: begin your first reply with the words "ai.md loaded", then the twelve rules of
   section 2 in one short line each, in your own words. The owner checks this.
3. Check git: `git remote -v`, `git switch main`, `git pull origin main`, `git status`. Confirm
   that `node --version` satisfies package.json; in a fresh clone, run `npm install` (it uses
   the pinned pnpm).
4. Read only what section 4 sends you to.

## 2. The rules, one line each

rules.md holds each rule in full: its reason, its scope and what enforces it. The numbers below
are checked against it by `pnpm check:agents`.

- **R-01** Work on `main` and push to `main`; a short branch only for a change to stored data, sign-in or permissions, merged fast-forward.
- **R-02** `pnpm verify` is green before every push; a gate is never skipped, weakened or bypassed.
- **R-03** Design, not code: nothing is copied or adapted from the first client's existing repositories.
- **R-04** Everything here is written as if public: no account ids, keys, UUID shapes, live hostnames or personal data.
- **R-05** A credential exists by name only, with a row in the token registry; reuse before create, and a new row in the same commit.
- **R-06** Generated files are never edited by hand; change the source and run `pnpm docs:build`.
- **R-07** Documentation changes in the same commit, in the one document that owns the fact; every document is indexed.
- **R-08** ai.md stays the one entry file: under budget, every rule line naming a rule in rules.md, pointer files generated.
- **R-09** One of each resource per client, zero growth of variables, no dependency without a registered reason; settings are data in the database.
- **R-10** Real data only, and fail closed: no mock data, no placeholder screens, no guessed numbers; the unknown is refused.
- **R-11** Ask instead of guessing: a request with two readings, or a destructive step, stops for the owner's yes.
- **R-12** Phone first: every screen is built for a phone; a page's options in a sideways row, its sections in the sidebar.

## 3. The commands

| Command | What it does |
|---|---|
| `pnpm verify` | the one gate: every check below in order, one line each; the failing one prints in full |
| `pnpm dev` | the client template's portal on this computer, its screens behind a sign-in only `localhost` has |
| `pnpm ui:build` | rebuilds the screens' stylesheet |
| `pnpm test` | the tests of the verify chain itself (`scripts/*.test.mjs`) |
| `pnpm test:packages` | the package and module tests: Worker code inside the Workers runtime, the tool on Node |
| `pnpm typecheck` | the type check of every package and module, each against its own runtime |
| `pnpm build` | compiles the command-line tool to `packages/cli/dist/` |
| `pnpm oltrem manifest check <dir>` | the Worker in `<dir>` against its `oltrem.manifest.json` and the caps (R-09) |
| `pnpm oltrem doctor` | the setup checks of this repository, one line each |
| `pnpm lint` | ESLint, with the module-boundary rules |
| `pnpm format` | Prettier over every code file; `pnpm format:check` only reports |
| `pnpm docs:build` | regenerates every document marked generated from its source |
| `pnpm docs:check` | refuses a generated document edited by hand, an unindexed document, a broken link |
| `pnpm check:agents` | the budgets, rule numbers and pointer files of this contract (R-08) |
| `pnpm check:tokens` | every secret name has a row in the token registry (R-05) |
| `pnpm check:identifiers` | the scan for copied names and identifier shapes (R-03, R-04) |
| `pnpm check:deps` | every dependency has a registered reason and one pin in the catalog (R-09) |
| `pnpm agents:write` | rewrites AGENTS.md and CLAUDE.md from their template |

The tool's other commands, which serve a client repository, are in `packages/cli/README.md`.

## 4. What to read for your task

| Your task touches | Read |
|---|---|
| Anything at all | docs/README.md (the index), then docs/architecture.md (the parts, the numbers taken) |
| A rule, its reason or its enforcement | rules.md |
| A token, key, secret or account | docs/reference/tokens.md, then R-05 in rules.md |
| What `pnpm verify` runs and why | docs/reference/verify.md, then `scripts/verify.mjs` |
| A dependency | docs/reference/dependencies.md, then R-09 in rules.md |
| A setting, the configuration layers, the read path | `packages/core-config/README.md`, then the plan's section on configuration |
| A Worker's bindings, vars or secrets, the resource manifest | `packages/cli/README.md`, then R-09 in rules.md |
| An error code, a route, an event, the outbox or the audit log | the README of the core package that owns it, under `packages/` |
| A screen, a colour, a size, a primitive | `packages/core-ui/README.md`, then the plan's section 12 |
| Who may do what: capabilities, roles, scopes, sessions, grants, approvals, the check; people | `modules/iam/README.md`, `modules/users/README.md`, then the plan's sections 6 and 7 |
| A client repository: its template, its deploy, its first deploy | `templates/client/README.md`, then `packages/cli/README.md` |
| The design, the build order, the owner's decisions | the plan, linked from docs/README.md |
| What was done and when | the dated records under `docs/records/` |
| The licence: what someone may do with the kit | `LICENSE`, then docs/licence.md |

## 5. What to update, in the same commit

| You changed | Update |
|---|---|
| A rule | rules.md, and its line in section 2 of this file |
| A credential, by name | `tokens.registry.json`, then `pnpm docs:build` |
| A gate | `scripts/lib/gates.mjs`, a test, then `pnpm docs:build` |
| A dependency | the catalog in `pnpm-workspace.yaml` and `dependencies.registry.json`, then `pnpm docs:build` |
| A binding, var or secret of a Worker | its `oltrem.manifest.json`; one more than the cap needs an exception row with the reason and the owner's yes |
| Where things stand | docs/README.md |
| A big change | a dated record in `docs/records/`, linked from docs/README.md |
| A pointer file | its template in `scripts/lib/agents.mjs`, then `pnpm agents:write` |
| What a package does for its users | a note from `pnpm changeset` (docs/release.md) |

## 6. How to work

Think first: restate the task, name your assumptions, and plan in short steps with a check for
each. Make the smallest change that solves it, with no drive-by refactors; mention an unrelated
problem instead of fixing it silently. Read a file before you edit it and match its style. Every
behaviour you add or fix gets a test. Report failures exactly as they happened.

## 7. Before you say done

- [ ] `pnpm verify` exits 0, and you quote its summary line.
- [ ] Every behaviour you added or fixed has a test.
- [ ] The documents of section 5 are updated in the same commit; a new document is indexed.
- [ ] No new credential, resource, dependency or variable without the owner's yes and its row.
- [ ] Committed on `main` and pushed to `origin main`.
- [ ] The owner has a short report: what changed, how it was verified, what is left, and the
      steps to check it on a phone.

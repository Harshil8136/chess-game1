---
title: 'Two review agents taken from ECC, and the rest left out (2026-11-14)'
status: record
owner: vendor
last_verified: 2026-11-14
sources: [.claude/agents/typescript-reviewer.md; .claude/agents/silent-failure-hunter.md; .claude/agents/LICENSE-ECC.txt; the npm package ecc-universal 2.2.3, read unpacked]
---

# Two review agents taken from ECC, and the rest left out

> **In plain words.** The owner asked about installing ECC ("Everything Claude Code", the npm
> package `ecc-universal`), a large outside pack of agents, skills, hooks and rules for coding
> assistants, and then asked for the recommended pieces only, in this repository only. Its
> installer was **not run**. The package was unpacked into an empty folder and read. Two review
> agents were taken, rewritten for this kit, and placed in `.claude/agents/`, where every
> Claude Code session here finds them. Everything else was left out.

## What was added

| File | What it does |
|---|---|
| `.claude/agents/typescript-reviewer.md` | reviews a change for type safety, async mistakes on a Worker, D1 and free-plan costs, unescaped HTML, string-built SQL and missing permission checks; reports only |
| `.claude/agents/silent-failure-hunter.md` | looks for swallowed errors, fallbacks that hide a fault, work under `waitUntil` nobody watches, and sends or jobs that can fail unseen; reports only |
| `.claude/agents/LICENSE-ECC.txt` | ECC's MIT licence notice, which its terms ask to keep with adapted copies |

Both agents read and run checks (`pnpm typecheck`, `pnpm lint`, `git diff`) and never edit, commit
or push. They name `model: sonnet`, as ECC did, so a review costs less than the main session.
They add no hook, setting, dependency, credential or resource, and the kit's packed client
template is unchanged.

## What was left out, and why

| Left out | Why |
|---|---|
| All 24 hooks | each runs a Node script on nearly every tool call and at session start and end; they track spending, send desktop notifications, probe MCP servers, or format and type-check after every edit. Too much weight and reach for a gain `pnpm verify` already gives |
| The rules (`common`, `typescript`, `web`) | `rules.md` and `ai.md` already hold this repository's rules; ECC's git rules use branches and pull requests, which R-01 does not |
| The 94 commands | many open pull requests, plan across several models, or repeat what Claude Code has built in (`/code-review`, `/security-review`, `/simplify`) |
| The security and database reviewers | the first repeats `/security-review` and is written for Express and Node; the second is for PostgreSQL and Supabase, not D1 |
| The other 64 agents | written for other languages and frameworks, or for marketing, autonomous loops and multi-model work |
| All 293 skills | mostly written for other languages, frameworks and trades, or for multi-model and paid-service work; `search-first` reaches for outside packages, against R-09 |
| The installer, the dashboards, the memory server | they write into the user's own Claude Code folder and run long-lived processes |

## How it was checked

- The package was downloaded from the npm registry into its own empty folder and unpacked
  without installing, so none of its scripts ran. Its licence is MIT.
- The two agents were read whole before adapting; neither contains a network call or a command
  that changes anything.
- Every path the agents name was checked to exist in this repository.
- `pnpm verify` ran once before the push.

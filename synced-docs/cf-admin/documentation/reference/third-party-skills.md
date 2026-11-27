---
title: "Third-party agent skills"
status: active
audience: [ai, technical, owner]
last_verified: 2026-11-27
verified_against: [code]
owner: harshil
related_code: [.claude/skills/]
related_docs: [../../main.md, ../records/reports/2026-11-27-shared-agent-skills.md]
tags: [ai, skills, tooling, supply-chain]
---

# Third-party agent skills

The owner asked on 2026-11-27 for five outside Claude skills to be available to every thread in
the project. This page owns what was taken, from where, what was left out and why.

## Where they live and how threads get them

They live in this repository's `.claude/skills/`, one folder per skill. Every cloud thread of the
project clones this repository, and Claude Code lists the skills of every cloned repository, so
one copy serves every thread whatever repository it works in. A copy in a second repository
would list each skill twice, so there is none. On the owner's computer they appear in a session
opened in this repository.

They are instructions plus, for three founder skills, small Python scripts that use only the
standard library and read and write local files. No hook, background service, installer,
settings change, telemetry or network call was added. main.md wins over any skill.

## What was taken

| Asked for | Source, pinned commit, licence | Taken | Left out |
|---|---|---|---|
| founder-skill | Jakeschincariol/founder-skill `fd9385b`, MIT | the 11 `founder-*` skills, with their scripts and examples, unchanged except a project note: run only when asked, work in `/mnt/project-files/founder/`, never in a repository | the plugin manifest, the tests |
| ponytail | DietrichGebert/ponytail `ebd8654` (v5.3.3), MIT | `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, unchanged except a project note | its hooks, the status band, the per-turn ledger and the optional webhook, the benchmarks, the installers for other tools, `ponytail-gain` (a benchmark scoreboard) and `ponytail-help` (about the band) |
| napkin | blader/napkin `27fa60a`, MIT | rewritten as `napkin`: the same curation rules (a dated rule with a "Do instead" line, at most 10 a heading, prune on every write), kept in the project memory's gotcha notes | a `.claude/napkin.md` in each repository, read and rewritten every session: the project memory already carries these notes across threads, and a repository file would be scratch the rules forbid committing |
| awesome-design-md | VoltAgent/awesome-design-md `fcc7028`, MIT | `design-md`: how to fetch one product's DESIGN.md at the pinned commit, read as data, with the rules that the house design system wins and no brand identity is copied | the 84 DESIGN.md files themselves (2.4 MB), fetched one at a time when needed |
| claude-mem | thedotmack/claude-mem | nothing | everything: it installs hooks on every session and tool call, runs a background worker with a local database, its installer fetches Bun and uv, it calls an AI model to compress each session, and its installer can send a sign-up and an account login to its maker's service. Cloud threads would also lose its database when they end. The project memory does this job; the owner chose on 2026-11-27 to skip it |

The licence of each source sits beside the skills as `LICENSE-<name>.txt`.

## Updating a skill

Read the new commit the way the log below describes, copy only the skill folders, keep the
project notes, and update the table and the log.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-11-27 | Each source cloned at the commit above and read: every `SKILL.md` taken; every script taken (standard-library imports only, local file reads and writes, no network or shell calls); the ponytail and claude-mem plugin manifests and hook files, where the hooks, the webhook and the installer's calls to its maker were found; the 84 DESIGN.md files searched for embedded commands (only an `npx` lint step, which `design-md` says to skip). The skills were listed by a cloud thread right after they were written | The founder skills' answers in use; the sources' later commits; a session on the owner's computer |

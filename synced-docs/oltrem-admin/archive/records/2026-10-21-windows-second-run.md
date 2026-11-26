---
title: "Working on Windows: the second run and pnpm dev (2026-10-21)"
status: record
owner: vendor
last_verified: 2026-10-21
sources: [the owner's second run of the kit on a Windows computer, on a fresh copy; this repository]
---

# Working on Windows: the second run and pnpm dev

> **In plain words.** After [the first fix](2026-10-21-windows.md), the owner made a fresh copy
> on Windows and ran it again. Eleven of the twelve checks passed. Two tests failed because
> Windows writes folder paths with `\`, and the install printed two warnings. The owner also
> asked for `pnpm dev`, which did not exist. All four are fixed: `pnpm dev` now runs the portal's
> Worker on the computer itself.

## What happened

| What the owner saw | Why |
|---|---|
| `pnpm verify` failed at `packages`: two tests in `packages/cli/test/checks.test.ts` expected `.github/workflows/deploy.yml:12` and got `.github\workflows\deploy.yml:12` | `oltrem check tokens` named the file where it found a secret with Node's `relative()`, which uses `\` on Windows. |
| `pnpm install` warned that it could not create the `oltrem` command (`dist\bin.js`) | The command pointed at the built tool, which does not exist until the first build. pnpm on Windows will not link a file that is not there yet. |
| `pnpm install` listed esbuild and workerd under "Ignored build scripts" | Their install scripts only fetch a binary when the package made for the system is missing. pnpm installs that package itself, so the scripts are not needed, but pnpm asked about them on every install. |
| `pnpm dev`: `Command "dev" not found` | There was no such command. |

## What changed

- **`packages/cli/src/tokens.ts`**: the file a finding names is always written with `/`.
- **`packages/cli/bin/oltrem.js`**: the `oltrem` command is now a small file that is always in
  the repository and starts the built tool, or says how to build it when it is not built yet.
- **`pnpm-workspace.yaml`**: esbuild and workerd are listed under `ignoredBuiltDependencies`, so
  pnpm does not run their install scripts and does not ask about them.
- **`pnpm dev`**: in a client repository it applies the migrations to a local database, then
  runs the Worker on the computer with a local database, key-value store, bucket and queue
  (`wrangler dev`). In the kit's repository the same command runs the client template's.
  Nothing reaches Cloudflare. `ai.md` lists it in both places.

## Decisions

- **What `pnpm dev` shows today.** There are no screens yet: they wait for the sandbox
  measurement, the owner's answer of 2026-10-21. So `http://localhost:8787/healthz` answers with
  the mounted modules, and every other route answers "Not signed in", because the portal only
  trusts the Access door and the computer has none. The kit does not add a way around that door
  for local work: one that exists can be left switched on.

## How it was verified

- The twelve gates pass locally.
- `pnpm dev` from the kit's root: the six migrations applied to the local database, the Worker
  ready on port 8787 with the four resources local, `/healthz` answering 200 with
  `{"ok":true,"modules":["health"]}`, and `/` and an API route answering 401 with the kit's
  "Not signed in" error.
- A fresh install in a separate copy prints no "Ignored build scripts" box and leaves the
  lockfile unchanged.
- Not verified here: a run on Windows itself. The owner's next `git pull`, `pnpm install`,
  `pnpm verify` and `pnpm dev` are that run.

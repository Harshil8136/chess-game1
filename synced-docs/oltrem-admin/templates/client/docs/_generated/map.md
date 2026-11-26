---
title: "Repository map"
status: generated
source: the files that exist
---

# Repository map

> Written by `oltrem docs` from the files named above; never edited by hand. `oltrem docs --check` in verify refuses a stale copy.

| File | What it holds |
|---|---|
| `ai.md` | the contract every agent and person reads first |
| `oltrem.config.ts` | who this client is: id, name, locale, owner, brand, modules, settings |
| `wrangler.jsonc` | the Worker's configuration: resources by name, no ids |
| `oltrem.manifest.json` | the resource list the manifest check enforces |
| `migrations/` | the kit's migrations (copied) and this client's own (5000 and up) |
| `src/index.ts` | the Worker: one call that builds it from the kit |
| `src/modules.ts` | this client's own modules, listed by `oltrem new module`; never edited by hand |
| `test/` | the Worker's tests, inside the Workers runtime |
| `.github/workflows/deploy.yml` | the deploy: the checks, verify, then the release |
| `.github/workflows/operations.yml` | the operations menu: one fixed job on the live portal, from main |
| `.claude/settings.json` | the files no AI agent edits: the kit's own and the generated ones |
| `tokens.registry.json` | every credential, by name |
| `docs/_generated/` | this reference, written by `oltrem docs` |

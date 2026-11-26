---
title: "The generated reference"
status: generated
source: oltrem docs
---

# The generated reference

> **In plain words.** These pages are written by `oltrem docs` from the files of this repository,
> never by hand. `oltrem docs --check` runs in verify and refuses a stale copy, so what is written
> here is what the repository holds.

| Page | Made from |
|---|---|
| [Resources](resources.md) | `oltrem.manifest.json` and the Worker configuration |
| [Migrations](migrations.md) | `migrations/` and its `kit.json` |
| [Tokens](tokens.md) | `tokens.registry.json` |
| [Modules](modules.md) | `src/modules.ts` and the manifests it lists: routes, capabilities, jobs, checks, migrations, settings, errors |
| [capabilities.json](capabilities.json) | each module's capabilities under its version, as data; a change under the same version is refused until the version is bumped |
| [Key recipes](secrets.md) | `src/index.ts` and the modules it mounts: every Worker secret, how to make, test and rotate it, and what happens without it |
| [Repository map](map.md) | the files that exist |

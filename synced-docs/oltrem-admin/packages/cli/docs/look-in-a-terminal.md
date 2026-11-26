---
title: "@oltrem/cli: the look in a terminal, manifest check, migrations"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/look/index.js, packages/cli/src/manifest.ts, manifest-check.ts, migrations.ts]
---

# @oltrem/cli: the look in a terminal, manifest check, migrations

> Part of [the @oltrem/cli README](../README.md).

## The look in a terminal

Every command a person runs (`npm install`, `npm run dev`, `npm run update`, `npm run deploy` in
the kit; `oltrem deploy`, `oltrem upgrade` in a client repository) looks the same. The look is
`look/index.js`, plain JavaScript with no dependency and its types in `look/index.d.ts`, so the
kit's scripts use it before any build and a client through `@oltrem/cli/look`.

```text
┌  Oltrem deploy
│  Puts this portal on Cloudflare in seven steps.
│
◆  Step 5 of 7 · Put the portal on Cloudflare
│  ✔ The database is up to date  12 s
◒  Putting the portal on Cloudflare · 9.4 s
│
└  Done: open https://portal.example.workers.dev and sign in at the door
```

| Part | What it is for |
|---|---|
| The rail | `┌` title, `◆` a step or question, `│` what belongs to it, `└` how it ended |
| Colour | Cyan a step or number to act on, green done, yellow a warning, red a stop, grey skimmable. Off outside a terminal or with `NO_COLOR`; on with `FORCE_COLOR` |
| Long work | A spinner with what, how far and how long, then one line with the time taken; outside a terminal, a line before and after |
| A tool's output | Kept in `.oltrem/<command>.log` (git-ignored). On failure its last 12 lines show under the stop with the log's path; once it asks something or names a link, its output shows as it is |
| Old Windows console | PowerShell 5's console gets `●`, `√`, `×` and a `\|/-\` spinner (the `is-unicode-supported` test); other terminals the full set |

`runTool` runs a tool this way; `runToolSync` does it for a caller that cannot wait, through
`look/run.js`. In a workflow, wrangler's output prints as it is.

## `oltrem manifest check [dir...]`

Compares the Worker's `wrangler.jsonc` (or `.json`), its `oltrem.manifest.json` and the code's
`env.NAME` uses, and fails on any disagreement or cap, with the rule: **adding a resource needs a
manifest entry and the owner's yes.** Several directories run in turn; the worst exit wins. It is
`pnpm verify`'s `manifest` gate.

It refuses:

- a binding, queue, Durable Object class, cron, var or required secret in one file and not the
  other, or a binding whose kind differs;
- more of a kind than its cap, without an exception;
- a kind the kit does not use (a service binding, Hyperdrive, Vectorize, AI, Browser Rendering,
  mTLS, a dispatch namespace, Secrets Store, Pipelines and the rest);
- named environments (`env`), and a `wrangler.toml`;
- an `env.NAME` or `env['NAME']` in the code the manifest does not list. The scan is textual and
  skips `process.env`, `import.meta.env`, tests, `*.d.ts`, `node_modules`, `dist`, `.wrangler`; a
  comment counts.

**The manifest** is JSONC, and every list may be empty. The client template's:

```jsonc
{
  "version": 1,
  "bindings": {
    "DB": "d1", "CACHE": "kv", "FILES": "r2", "EVENTS": "queue",
    "JOBS": "workflow", "LIMITS": "ratelimit", "METRICS": "analytics_engine"
  },
  "queues": ["oltrem-client-events", "oltrem-client-events-dlq"],
  "durableObjectClasses": [],
  "crons": ["* * * * *"],
  "vars": ["CLIENT_ID", "PUBLIC_HOST", "ENVIRONMENT"],
  "secrets": ["ACCESS_AUD", "BACKUP_PUBLIC_KEY", "KEK", "KIT_OPS_TOKEN"],
  "exceptions": []
}
```

**The caps** (`CAPS`, plan 9.1) are ceilings; the free plan allows more:

| Kind | Cap | Kind | Cap |
|---|---|---|---|
| `d1`, `r2`, `kv` | 1 each | `workflow`, `assets`, `ratelimit` | 1 each |
| `queue` (producers) | 2 | `queue_name` (all queues) | 2 |
| `durable_object` | 2 | `durable_object_class` | 2 |
| `send_email` (Mail's `EMAIL`, [`oltrem mail`](oltrem-mail.md#oltrem-mail)) | 1 | `analytics_engine` (System status's request figures) | 1 |
| `cron` | 1 | `var` | 3 |
| `secret` (`secrets.required`) | 12 | | |

**Exceptions.** Each row lifts one kind's cap by one and needs the kind, a reason and the date of
the owner's yes; a row missing either stops the check:
`{ "kind": "r2", "reason": "a public asset host", "approved": "2026-10-20" }`.

Output: a line of counts, a line per problem on stderr, the rule. Exit `0` agrees, `1` a problem,
`3` could not run (a missing or unparsable file, an invalid manifest).

## `oltrem migrations sync [dir] [--check]`

Copies every installed `@oltrem/*` package's `migrations/*.sql` into the client's `migrations/`
and writes `migrations/kit.json` (each file with a `sha256-` base64 checksum, and the kit versions
`oltrem upgrade` recorded, which it keeps). A second run copies nothing. `--check` writes nothing
and fails on a missing copy or stale `kit.json`; a client's verify runs it so.

It refuses a copy that differs from the package's (ship a new number instead), two packages with
one number, a kit number of `5000` or more, and a client file below `5000` or not named
`NNNN_name.sql`. Exit `0` current, `1` a problem, `3` no installed package has migrations.

## `oltrem migrations apply [dir]`

Runs the migrations on the account before the deploy, so they are live before the code. The one
D1 database is found by `database_name` (no id in the repository); on the first deploy it is made
with `wrangler d1 create`. Then `wrangler d1 migrations apply <binding> --remote`, with
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the workflow, or a signed-in wrangler
through `npm run deploy`. `wrangler deploy` makes the other resources from their names. Exit `0`
applied, `1` create or apply failed (wrangler's message above), `3` no `wrangler.jsonc` or not
exactly one D1 database.

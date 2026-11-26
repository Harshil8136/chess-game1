---
title: "@oltrem/cli: The look in a terminal and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src; split from packages/cli/README.md]
---

# @oltrem/cli: The look in a terminal and more

> Part of [the @oltrem/cli README](../README.md).

## The look in a terminal

Every command a person runs at a terminal shows itself the same way: `npm install`, `npm run dev`,
`npm run update` and `npm run deploy` in the kit, `oltrem deploy` and `oltrem upgrade` in a client
repository. The look is `look/index.js` here, plain JavaScript with its types beside it
(`look/index.d.ts`), so the kit's scripts use it before anything is built and a client
repository's through `@oltrem/cli/look`. It has no dependency.

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
| The rail | `┌` a command's title, `◆` a step or a question, `│` what belongs to it, `└` how it ended |
| Colour | one meaning each: cyan a step and a number to act on, green done, yellow a warning, red a stop, grey what may be skimmed. Off when the output is not a terminal or `NO_COLOR` is set; on with `FORCE_COLOR` |
| Long work | a spinner with what it is doing, how far (pnpm's packages, wrangler's migrations) and for how long, then one line saying what was done and how long it took. Only in a terminal; elsewhere a line before and a line after |
| A tool's own output | kept in `.oltrem/<command>.log` beside the code (git ignores the folder). When the tool fails, its last twelve lines are shown under the stop, with the log's path. When it asks something or names a link to open, its output is shown as it is from then on |
| The old Windows console | the console PowerShell 5 opens by itself cannot draw every symbol, so it gets `●`, `√`, `×` and a `|/-\` spinner, which its fonts carry; Windows Terminal, VS Code's terminal and the others get the full set (the same test as `is-unicode-supported`) |

`runTool` runs a tool this way; `runToolSync` does the same for a caller that cannot wait, through
a Node process of its own (`look/run.js`) that draws while the caller waits. The `wranglerRunner`
`oltrem deploy` uses shows wrangler's long steps this way when a label names them; in a workflow,
where nobody watches, wrangler's output is printed as it is.

## `oltrem manifest check [dir...]`

Reads the Worker's `wrangler.jsonc` (or `wrangler.json`) and its `oltrem.manifest.json` in
`dir` (the current directory by default), scans the code there for `env.NAME` uses, and fails
when the three disagree or a cap is exceeded, with the plan's sentence: **adding a resource
needs a manifest entry and the owner's yes.** Several directories run one after the other,
each line then names its directory, and the worst exit code wins. It runs as the `manifest`
gate of `pnpm verify` on the kit's own test Worker configurations, and will be the first step
of a client repository's verify and deploy workflows.

What it refuses:

- a binding, queue, Durable Object class, cron, var or required secret in the configuration that
  the manifest does not list, and a manifest entry the configuration does not have;
- a binding whose kind differs between the two files;
- more of a kind than its cap allows (below), unless the manifest carries an exception for it;
- a binding kind the kit does not use (a service binding, Hyperdrive, Vectorize, AI, Browser
  Rendering, Analytics Engine, Email, mTLS, a dispatch namespace, Secrets Store, Pipelines and
  the others);
- named environments (`env`): one Worker per client, one configuration;
- an `env.NAME` or `env['NAME']` in the code that the manifest lists under neither bindings,
  vars nor secrets. The scan is textual and skips `process.env`, `import.meta.env`, test
  directories, `*.test.*` and `*.d.ts` files, `node_modules`, `dist` and `.wrangler`. A mention
  in a comment counts, so write `env.` followed by a capitalised name only for a real use;
- a `wrangler.toml`: the kit writes its configuration as JSONC.

### The manifest

`oltrem.manifest.json` is the one place a client's resources are listed. It is read as JSONC,
so comments are allowed.

```jsonc
{
  "version": 1,
  "bindings": {
    "DB": "d1",
    "STORE": "r2",
    "CACHE": "kv",
    "EVENTS": "queue",
    "COORD": "durable_object",
    "JOBS": "workflow",
    "ASSETS": "assets",
    "RATE_LIMITER": "ratelimit"
  },
  "queues": ["client-oltrem-events", "client-oltrem-events-dlq"],
  "durableObjectClasses": ["KitCoordinator"],
  "crons": ["* * * * *"],
  "vars": ["CLIENT_ID", "PUBLIC_HOST", "ENVIRONMENT"],
  "secrets": ["SESSION_KEY", "KEK", "KIT_OPS_TOKEN", "ACCESS_AUD"],
  "exceptions": []
}
```

Every list may be empty; a package whose test Worker has only a database and a KV namespace
lists those two bindings and nothing else (see `packages/core-config/oltrem.manifest.json`).

### The caps

The caps are the kit's law from the plan's section 9.1: the free plan allows more of each, the
cap is the discipline. Each is a ceiling; a configuration may have fewer.

| Kind | Cap | What it counts |
|---|---|---|
| `d1` | 1 | D1 database bindings |
| `r2` | 1 | R2 bucket bindings |
| `kv` | 1 | KV namespace bindings |
| `queue` | 2 | queue producer bindings |
| `queue_name` | 2 | distinct queue names across producers, consumers and dead-letter queues |
| `durable_object` | 2 | Durable Object bindings |
| `durable_object_class` | 2 | distinct Durable Object classes |
| `workflow` | 1 | workflow bindings |
| `assets` | 1 | assets bindings |
| `ratelimit` | 1 | rate limiter bindings |
| `send_email` | 1 | email sending bindings: Oltrem Mail's `EMAIL`, only while it is installed ([`oltrem mail`](oltrem-mail.md#oltrem-mail)) |
| `cron` | 1 | cron triggers |
| `var` | 3 | `vars` (the three identity values) |
| `secret` | 12 | names in `secrets.required` |

### Exceptions

One more of a kind needs an exception row in the manifest: the kind, the written reason, and
the date of the owner's yes. Each row lifts that kind's cap by one. A row missing its reason or
its date stops the check before it runs.

```jsonc
"exceptions": [
  { "kind": "r2", "reason": "a public asset host on its own domain", "approved": "2026-10-20" }
]
```

### Output and exit codes

One line of counts, then one line per problem on stderr, then the rule. `--json` prints
`{ ok, ran, exitCode, problems, notes }` for agents. Exit `0` when everything agrees, `1` on a
problem, `3` when the check could not run (no manifest, no configuration, a file that does not
parse, an invalid manifest).

## `oltrem migrations sync [dir] [--check]`

A client repository runs the kit's migrations from its own `migrations/` folder, so that the
deploy workflow needs nothing but the repository. This command copies every `migrations/*.sql`
of every installed `@oltrem/*` package into `migrations/` and writes `migrations/kit.json`, the
list of those files with a checksum each (`sha256-` then base64, the notation browsers use for
integrity), and, once `oltrem upgrade` has run, the kit versions it took, which this command
keeps. It is idempotent: a second run copies nothing. With `--check` it writes nothing and
fails when a copy is missing or `kit.json` is stale; a client's `pnpm verify` runs it that way.

What it refuses, in either mode:

- a copy that differs from the package's file: an applied migration is never edited; take the
  package's file back, or ship the change as a new number;
- two kit packages shipping the same number, and a kit package shipping a number `5000` or
  higher, which the client owns;
- a client file (one no kit package ships) numbered below `5000`, or not named `NNNN_name.sql`.

Exit `0` when the folder is current, `1` on a problem or a missing copy, `3` when no installed
package has migrations (run `pnpm install` first). `--json` prints the outcome for agents.

## `oltrem migrations apply [dir]`

Runs the migrations on the client's Cloudflare account, before the deploy, so a migration is
live before the code that needs it. The client's one D1 database is found by the
`database_name` in `wrangler.jsonc` (no id in the repository, plan 9.2); when it does not
exist yet, the very first deploy, the command creates it with `wrangler d1 create`, then runs
`wrangler d1 migrations apply <binding> --remote` either way. It runs the repository's own
wrangler, which reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment:
the deploy workflow passes the two repository secrets, and a person runs it from a signed-in
wrangler through `npm run deploy` (`oltrem deploy`). The Worker's other resources (the KV namespace, the bucket, the
queues) are created by `wrangler deploy` itself from their names.

Exit `0` when the migrations are applied, `1` when the database could not be created or the
apply failed (wrangler's own message is printed above), `3` when `wrangler.jsonc` is missing or
declares anything but exactly one D1 database.

# @oltrem/cli

The kit's command-line tool, `oltrem`. Today it has two commands: the **resource manifest
check** that keeps a client's Worker at one of each resource (plan 9.1, R-09), and the
**doctor** with its first checks (plan 15.3). `setup`, `dev` and the rest of the doctor's
checks come later in phase 1. The tool runs on Node and has no runtime dependency.

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
  "crons": ["*/5 * * * *"],
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

## `oltrem doctor`

Runs the check registry against the repository in the current directory and prints one line
per check: `pass`, `fail`, `warn` or `skip`, the check's id, a one-line summary, and for a
failure the exact command that fixes it. No check prints a secret value.

| Id | Check | Fix printed |
|---|---|---|
| `NODE-01` | the running Node satisfies `engines.node` of package.json (a `>=version` floor) | the install command for that version |
| `PM-01` | the installed pnpm is the one `packageManager` names | the corepack or npm command for that version |
| `MANIFEST-01` | the Worker here matches its manifest (the check above); skipped where there is no manifest | the rule, or the file to fix |

Flags: `--json` prints `{ ok, exitCode, checks, problem }`; `--only ID` runs one check;
`--list-checks` names them. Exit codes, as the plan sets them: `0` every check passed or was
skipped, `1` a check failed, `2` warnings only, `3` the doctor itself could not run (an unknown
id, a check that threw). The registry is data (`src/checks.ts`), so the portal's Setup page and
the docs can render the same checks later; the ids are stable from here on.

## In the kit repository

`pnpm build` compiles the tool to `packages/cli/dist/`; `pnpm oltrem …` runs it from there.
`pnpm verify` builds it and runs `oltrem manifest check` on the three packages that declare a
test Worker with a binding (`core-config`, `core-outbox`, `core-audit`) as its `manifest` gate. The tool is typed against Node (`tsconfig.json` here extends the shared
`tsconfig.base.json`) and its tests run on Node with Vitest, against a sample client Worker in
`test/fixtures/client-ok/` that has exactly one of each resource.

# @oltrem/cli

The kit's command-line tool, `oltrem`, for a client repository. Its commands: the **resource
manifest check** that keeps a client's Worker at one of each resource (plan 9.1, R-09),
**`migrations sync`** and **`migrations apply`** for the kit's migrations (plan 10), **`setup`**
for the steps a new client repository needs (plan 15.3), **`docs`** for the generated reference
(plan 15.5), **`check agents`** and **`check tokens`** for the instruction files and the token
registry (plan 15.1, 9.4), the **doctor** with its eight checks, and, since phase 3,
**`new module`**, which writes a complete module into a client repository from the kit's module
template (plan 4.3 and 18). The tool runs on Node and has no runtime dependency.

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

## `oltrem migrations sync [dir] [--check]`

A client repository runs the kit's migrations from its own `migrations/` folder, so that the
deploy workflow needs nothing but the repository. This command copies every `migrations/*.sql`
of every installed `@oltrem/*` package into `migrations/` and writes `migrations/kit.json`, the
list of those files with a checksum each (`sha256-` then base64, the notation browsers use for
integrity). It is idempotent: a second run copies nothing. With `--check` it writes nothing and
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
wrangler through `pnpm deploy`. The Worker's other resources (the KV namespace, the bucket, the
queues) are created by `wrangler deploy` itself from their names.

Exit `0` when the migrations are applied, `1` when the database could not be created or the
apply failed (wrangler's own message is printed above), `3` when `wrangler.jsonc` is missing or
declares anything but exactly one D1 database.

## `oltrem setup [dir]`

The steps a new client repository needs that need no account, in one idempotent command: copy
the kit's migrations (as `migrations sync` does), confirm the deploy workflow
`.github/workflows/deploy.yml` is in place, print the template for the one Cloudflare API token
and the two `gh secret set` commands that store it and the account id as repository secrets,
write the pointer files `AGENTS.md` and `CLAUDE.md` where they are missing or differ, write the
generated reference (as `docs` does), and run the doctor. The token itself is created by hand in the client's dashboard, since a token
cannot create itself; its scopes are the five the deploy needs, on that account only. Exit
codes are the doctor's, or `1` when the migrations folder has a problem and `3` when the kit
packages are not installed.

## `oltrem new module <name> [dir]`

Writes a complete module into the client repository in `dir` (the current directory by default),
copied from the kit's module template (`templates/module` in the kit; beside the tool once it is
published) with the name written in wherever it goes: as the id (`pet-food`), as a table prefix
(`pet_food`) and as a title (`Pet food`). The module gets one of each part the manifest knows: a
route, a daily job, a health check, a migration, a setting and an error code, plus its own test
and its how-to (`modules/<name>/README.md`). The migration is written into the client's
`migrations/` folder at the next free number of the client's own series (5000 and up), and the
module's error codes take the next free hundred from 5000 (`KIT-E-5001`, then `KIT-E-5101` for
the second module), read from the modules already there. Then `src/modules.ts` is rewritten to
list every module under `modules/` in name order (the client template's Worker mounts that list
beside the kit's modules, so the file is never edited by hand) and the generated reference is
refreshed, as `docs` does. The new module deploys with no edits: `pnpm verify` type-checks it,
runs its test inside the Workers runtime and finds the reference current.

A name is lower-case letters and digits, words joined by single dashes; the kit's own module ids
(`iam`, `users`, `health`, `email` and the rest of plan 4.4) are refused, as is a name whose
folder exists. The generator is deterministic, and the kit's own test holds the template to it:
generating `sample-notes` reproduces `templates/module` byte for byte, so what the generator
writes is the code the kit type-checks and tests on every verify. `--json` prints
`{ ok, exitCode, ran, written, problems }`. Exit `0` when written, `1` when the name is refused,
`3` when `dir` is not a client repository or the template is not installed.

## `oltrem docs [dir] [--check]`

Writes the generated reference of the client repository in `dir` (the current directory by
default) to `docs/_generated/`, from the repository's own files and never by hand (R-06): an
index, **Resources** from `oltrem.manifest.json` and the wrangler file (every binding, queue,
class, cron, var and secret name, and any exception to the caps), **Migrations** from
`migrations/` and its `kit.json` (the kit's files with their checksums, the client's own, the
ledger table), **Tokens** from `tokens.registry.json` (one small table per credential, by name
only, sorted), **Modules** from `src/modules.ts` (for each of the client's own modules: its
capabilities, routes with their capability, jobs, checks, migrations, settings with their
defaults and errors with their text) and a **Repository map** of the files that exist. The key
recipes join the list with the providers module.

The Modules page is read from the code: the command imports `src/modules.ts` in a child Node
process with type stripping and takes each manifest as data; no handler, job or check runs. A
module must therefore load in Node, which means no Workers-only global at module scope; the kit's
own packages respect this. A `src/modules.ts` Node cannot load is reported as a problem that
names the first error, and nothing is written. A client without the file has no module yet.

`--check` renders in memory and compares: a page whose committed copy is missing or differs, or
a stray `.md` file in the folder, is reported with the command to run, and nothing is written.
Without `--check`, the stale pages are written and a stray file is removed. The registry is
validated first, by the kit's own rules (every field present, the name in upper snake case, a
known status, no duplicate): a bad row is refused with its row number and nothing is written.
`--json` prints `{ ok, exitCode, ran, written, stale, problems }`.

Exit `0` when the pages are current (or were just written), `1` when `--check` found a stale or
stray page or the registry is missing or invalid, `3` when there is no manifest or no wrangler
file to generate from. The client template's `verify` runs `oltrem docs --check`, and the kit's
own tests hold the template's committed copy to what the command renders.

## `oltrem check agents [dir]`

The instruction files of a client repository (plan 15.1, R-08): `ai.md` exists and is under
8 KB; the pointer files `AGENTS.md` and `CLAUDE.md` match the tool's template byte for byte
(`setup` writes them); the always-loaded files together stay under 24 KB so no tool truncates;
and no instruction file carries a copied fact (a count next to table, migration, route or
binding, a UUID shape, a hostname), which belongs in the generated reference. When the
repository has a `rules.md` (under 32 KB), every `R-NN` named in ai.md has a heading there and
every heading is summarised in ai.md; without one, the rule lines refer to the kit's rules and
the check says so. Exit `0`, `1` on a problem, `3` when there is no ai.md.

## `oltrem check tokens [dir]`

The token registry of a client repository (plan 9.4, R-05): every row of `tokens.registry.json`
is complete (the fields, the name in upper snake case, a known status, no duplicate), and every
secret name the repository uses has a row: the Worker's `secrets.required`, a workflow's
`secrets.NAME`, and a `wrangler secret put` command naming it in any text file (`node_modules`,
`dist`, `.wrangler` and `docs/_generated` excepted). A missing row is reported with where the
name is used and the rule: read the registry, reuse or widen a row, or add one with its reason.
Exit `0`, `1` on a problem, `3` when there is no registry. `--json` prints the outcome as data
for both `check` commands.

## `oltrem doctor`

Runs the check registry against the repository in the current directory and prints one line
per check: `pass`, `fail`, `warn` or `skip`, the check's id, a one-line summary, and for a
failure the exact command that fixes it. No check prints a secret value.

| Id | Check | Fix printed |
|---|---|---|
| `NODE-01` | the running Node satisfies `engines.node` of package.json (a `>=version` floor) | the install command for that version |
| `PM-01` | the installed pnpm is the one `packageManager` names | the corepack or npm command for that version |
| `MANIFEST-01` | the Worker here matches its manifest (the check above); skipped where there is no manifest | the rule, or the file to fix |
| `MIG-01` | every kit migration is copied into `migrations/`, unchanged, with a current `kit.json`; skipped where there is no manifest or no installed kit package | `oltrem migrations sync` |
| `WF-01` | the deploy workflow `.github/workflows/deploy.yml` is in place | copy it from the client template |
| `TOKEN-01` | every secret name the repository uses (as `check tokens` finds them) has a row in `tokens.registry.json`; skipped where there is no registry | add the row, with the reason it cannot be an existing token |
| `AGENTS-01` | the instruction files pass `check agents`; skipped where there is no ai.md | `oltrem setup` for a pointer file, or move the fact to the generated reference |
| `DOCS-01` | the generated reference in `docs/_generated/` is what `oltrem docs` renders now, with no stray file; skipped where there is no manifest | `oltrem docs`, or the registry file to fix |

Flags: `--json` prints `{ ok, exitCode, checks, problem }`; `--only ID` runs one check;
`--list-checks` names them. Exit codes, as the plan sets them: `0` every check passed or was
skipped, `1` a check failed, `2` warnings only, `3` the doctor itself could not run (an unknown
id, a check that threw). The registry is data (`src/checks.ts`), so the portal's Setup page and
the docs can render the same checks later; the ids are stable from here on.

## In the kit repository

`pnpm build` compiles the tool to `packages/cli/dist/`; `pnpm oltrem …` runs it from there.
`pnpm verify` builds it and runs `oltrem manifest check` on the client template and the three
packages that declare a test Worker with a binding (`core-config`, `core-outbox`, `core-audit`)
as its `manifest` gate. The tool is typed against Node (`tsconfig.json` here extends the shared
`tsconfig.base.json`) and its tests run on Node with Vitest, against a sample client Worker in
`test/fixtures/client-ok/` that has exactly one of each resource, with fake installed kit
packages for the migration commands and a fake wrangler for `migrations apply`.

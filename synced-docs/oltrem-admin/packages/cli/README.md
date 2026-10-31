# @oltrem/cli

The kit's command-line tool, `oltrem`, for a client repository. Its commands: the **resource
manifest check** that keeps a client's Worker at one of each resource (plan 9.1, R-09),
**`migrations sync`** and **`migrations apply`** for the kit's migrations (plan 10), **`setup`**
for the steps a new client repository needs (plan 15.3), **`docs`** for the generated reference
(plan 15.5), **`check agents`** and **`check tokens`** for the instruction files and the token
registry (plan 15.1, 9.4), the **doctor** with its ten checks, and, since phase 3,
**`new module`**, which writes a complete module into a client repository from the kit's module
template (plan 4.3 and 18), and, since phase 5, **`backup setup`**, what the nightly backup
needs on the account after the first deploy, **`backup drill`**, the monthly restore drill
(plan 9.3), **`github report`**, the deploy workflow's report for the GitHub module (plan
4.4), and **`vendor set`**, which writes the Vendor's address after the first deploy (plan 7.4),
and, since phase 6, **`upgrade`**, the step after a new kit version (plan 14.3), and
**`check files`**, **`check modules`**, **`check packages`**, **`check secrets`** and
**`check budgets`**, which keep a client's code out of the kit's files, inside its own modules,
on the kit's packages, free of keys and within the Worker's limits (research 18), and
**`release`**, the deploy workflow's release on `main` with its health check and step back, and
**`operate`**, the jobs of the operations menu (research 18 §3.5).
The tool runs on Node and has no runtime dependency.

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

## `oltrem deploy [dir]`

The first deploy and every later one from a person's computer, as one command (`npm run deploy`
in a client repository), for someone who has never used Cloudflare. Each step looks first and
only adds, so a run that stopped carries on the next time. The terminal shows seven titled steps
in [the kit's look](#the-look-in-a-terminal) as they happen, each question after what it is and why
it is needed (the door, the ops token); wrangler's sign-in, database and deploy run behind a spinner,
their output in `.oltrem/deploy.log`, and the last line names the `workers.dev` address the deploy
printed:

1. **Sign in.** `wrangler whoami`; when it is not signed in, `wrangler login` opens the browser.
   Then the account (`src/cloudflare.ts` reads it from `wrangler whoami --json`): the one the
   sign-in reaches, or, when it reaches several, the one picked from their names. The pick goes to
   wrangler as `CLOUDFLARE_ACCOUNT_ID` for the rest of the run, never into a file, so wrangler has
   no account to ask about later.
2. **The sign-in email.** The Vendor's address, read from the database when it has one ("you sign
   in as …"), asked first while it has none or before the first deploy has made it. It is written
   in step 7, and step 6 names it among the addresses the door lets in, so the two cannot differ.
3. **The address.** Asked once, while `vars.PUBLIC_HOST` is empty and `workers_dev` is off. When
   the sign-in can read the account's active domains (`wrangler auth token`, then Cloudflare's
   zones list), they are offered as choices beside the free address, and a domain is followed by
   the name before it (Enter for `portal`); otherwise the address is typed. An
   empty answer serves the portal on its free `workers.dev` address (`workers_dev` turned on);
   an address on a domain of the same Cloudflare account becomes `PUBLIC_HOST` and a `routes`
   entry making it the Worker's custom domain. `wrangler.jsonc` is written only once every answer
   is good, just before the database and the deploy; the person commits it.
4. **The secrets** `secrets.required` names, only those `wrangler secret list` does not show. The
   KEK and the backup's age key pair are made here and kept in `oltrem-keys.txt` (git ignores it),
   which the Vendor moves into a password manager: the KEK because a rotation needs it again and
   Cloudflare never shows a secret back, the private key because no copy opens without it. The
   file is an age identity, so `oltrem backup drill --key oltrem-keys.txt` reads it. A run that
   stopped before the deploy uses the keys it kept. `ACCESS_AUD` is set to `worker` with nothing
   asked (step 6 says why). The ops token comes after the steps that make it, and without echo:
   the first step is a link to Cloudflare's token form with the name and both permissions filled
   in (D1 Edit, Account Analytics Read). The pasted key is checked with Cloudflare at once (active,
   on the account or as a person's key, and allowed D1 on the account) and asked again, up to three
   times, with what is wrong; when Cloudflare cannot be reached it is used as pasted.
   When the Worker exists but its secrets cannot be listed, the command stops rather than send a
   new KEK, which would leave every stored provider key unreadable.
5. **The database, the migrations** (as `migrations apply` does) **and `wrangler deploy`**,
   carrying the new secrets in a file (`--secrets-file`) that is removed right after. The
   migrations and the deploy are tried once more, five seconds later, when what failed reads as a
   passing network or Cloudflare error (a reset connection, a timeout, a 502).
6. **The door**, once the deploy has made the Worker (an empty account has nothing to protect):
   the steps that turn Access on for it (the Worker's Access tab, Protect this Worker behind
   Access, All traffic, the allowed emails, the sign-in email first), the first one a link to the
   account's own Workers page, then Enter. The command checks the portal's address from outside
   every few seconds while it waits: once the address sends people to the Access sign-in
   (`*.cloudflareaccess.com`), the step ends by itself, and a door already on is not asked about at
   all. Nothing is copied back: `ACCESS_AUD`
   `worker` makes the portal trust the sign-in the runtime vouches for (`ctx.access`), and until
   the door is on no request carries it, so the portal refuses everyone. A client with a hostname
   Access application instead sets its tag with `wrangler secret put ACCESS_AUD`.
7. **The Vendor's address** from step 2, written while the database has none, as `vendor set` does;
   then `backup setup`; last, the one door step left for later: a self-hosted Access application
   on the address's `hooks`, `healthz` and `account` paths with a Bypass policy, needed once a
   website's form posts to the portal, an email provider sends delivery reports, the release
   checks the portal's health, or customers sign in at `/account` (`@oltrem/customers`), on a
   custom domain and on `workers.dev` alike.

Exit `0` when it is deployed and set up, `1` when a step failed or an answer was refused, `3`
when it could not start (not signed in, no `wrangler.jsonc`, an unreadable secrets list).

### `oltrem deploy [dir] --page`

The same seven steps, with their questions and their progress in a page in the browser
(`npm run setup` at the kit's root; `npm run deploy -- --page` in a client repository). The page
is drawn in the portal's look, from `@oltrem/core-ui`'s theme tokens (a test fails when the two
differ), light and dark, as an app shell since 2026-10-31: on a computer (960 px and wider) a
sidebar of sections, the seven steps under **Put it on Cloudflare** each with its state (waiting,
in progress, needs you, done, stopped), and a main area up to 1200 px; on a phone the sidebar is a
sideways row of chips under the top bar. All seven steps show from the start (their names are the
deploy's own titles; a test compares them with `deploy.ts`), with a bar of seven for the progress.

A `Step n of 7: …` title line starts a step, and every later line, question and tool run belongs
to it, sorted into parts: what it is (`text` lines), **What to do** (`do` lines, a numbered
checklist to tick), the **Question** and then its answer, **What happened** (`ok`, warnings, each
tool's run with a spinner, what it says right now and the time it took), **What went wrong**
(`cause` lines: the deploy's plain-words diagnosis of a failed tool, also a warning in the
terminal) and **Tool output**, a console of everything the tools printed, folded until a tool
fails. On a wide screen what it is and what to do sit beside the question and what happened. A
finished step folds to its title and time; a stop is a callout in its step with **Try again** and
**Copy the details**. When a step starts, a question appears or a run stops, the page scrolls to
it (the step's top too when both fit) and puts the cursor in the question's first field, unless
the person scrolled by hand in the last eight seconds: then a **Jump to the current step** button
appears instead. An `https` address (or this computer's own) is a link; nothing else in a line is
turned into a control, and every text is put in the page as text. When wrangler's sign-in does not
open the browser by itself, the step shows a button to its sign-in page. The terminal shows the
same steps in the kit's look and says where the page is, in case the browser did not open.

Two processes (`src/setup-page.ts`), because the deploy's tools hold their process while they
run: this one serves the page on `127.0.0.1` and stays free to answer it, and a second one, the
same command with `--from-page`, runs the deploy and sends each line, question and tool run as an
event over Node's IPC channel. The page reads the events as a stream of JSON lines (a page opened
again gets every event so far) and sends each answer back. Only this computer reaches it: the
server refuses any other `Host`, every call but the page itself needs the key that follows the `#`
in the address the terminal opens (so it is never in a request line or a `Referer`), and the page's
policy allows only its own script and style. A pasted secret goes to the deploy and nowhere else:
the page's record of the answer is empty. The run starts when the page first opens; the command
ends when the deploy has ended well, after ten minutes without the page ever opening, or when the
page has been closed for a minute while the deploy waits on it (never in the middle of a tool's
run). The second process's own output is in `.oltrem/setup.log`, wrangler's in
`.oltrem/deploy.log`.

A question with choices (the account, the domain) is a grid of cards, label and hint, the one
given before (`value`) or the first chosen already, arrow keys between them; a question may carry
`value` (the answer filled in) and `help` (more lines under it). A question with `list`
(`{ placeholder?, min?, roles?: { value, label }[] }`) takes several entries: one row each, with a
role to pick per row when it has `roles`, a remove button and **Add another**; Enter adds a row and
Enter on an empty row sends it, pasted lines become one row each, and it is not sent with fewer than
`min` entries or one entry twice. It starts from `value` (one entry per line, `entry<TAB>role`) and
answers the same way: the filled rows, one per line, the role after a tab when there are roles.
The page's rules for these are plain functions (`SETUP_PAGE_RULES`) the tests run in Node.
The key's box has a **Paste** button (Ctrl+V still works when the browser refuses it); the door's question says it is
checking by itself, and is marked "Noticed by itself" when it is. When the page closes while a
question waits, the browser is opened on it again once. When the page cannot start at all (no free
port, a refused socket), the same deploy runs in the terminal instead.

### The start page

`servePage(null, { menu, status })` serves the same page as a dashboard instead of one run (since
2026-10-29): `status` (`StartStatus`) is what the start made ready (the kit's commit, what an
update brought in or why it was held, Node, the doctor's checks, where the portal is set up to
live), sent first to every page that connects, before the choices; a `status` event from a run
(**Check again**, `run.mjs check`) replaces it. Its sections: **Overview** (what runs now, with a
way to it, and a tile each for this computer, the portal here and Cloudflare), **This computer**
(the kit: its state, commit, day, latest change, Node, what an update brought in; beside it the
checks: each one that needs a look with its title, summary and fix, a fix that is a command, or a
few joined by "or", a box with **Copy**; **Check again** in the section's corner), **Try it here**
(the choices whose id starts with `dev`, as cards with their label and hint, and **Start**; while
one runs, its address with **Open** and **Stop**), **Put it on Cloudflare** (where the portal
lives, **Put it live** or **Update it**, and the seven steps as above), **More** (any other choice,
a card each) and **Help & details**. A choice runs as a second process whose lines come over IPC
as the deploy's do (the kit's look sends them when `OLTREM_PAGE` is set and the process has an IPC
channel), drawn in its own section as a card with one part per title line, cleared with
**Clear**; wrangler's error lines (`✘ [ERROR]`, `[wrangler:error]`) gather in their own console in
that card, an error seen again counted (×6) rather than repeated. The template's dev script sends a
`serving` event with its address. The sidebar marks each section's state (the checks, the portal
running, Cloudflare live, working, needing you or stopped) and the section being read. The page was
remade compact on 2026-10-31 ([record](../../docs/records/2026-10-31-start-page-remake.md)), then
as an app shell the same day.
A choice marked stoppable (the portal on this computer) has a **Stop** button, which
asks the process over IPC to stop what it started, then ends it three seconds later, with every
process it started (`stopTree` in the look: `taskkill /T` on Windows, where a plain kill would leave
wrangler's runtime holding the port). The kit's root runs it as `npm start` and from its one-click
files; see the root README.

A running step shows what its tool says right now under its label: the look sends a task's
progress as an event when it changes, a few times a second at most. When a run stops with a
problem, the server writes its details to the `reportFile` it was given (`.oltrem/report.txt`),
names that file in the page and the terminal, and serves the same text at `/report` (with the
key) for the page's **Copy the details** button; when the browser refuses the clipboard, the text
is shown selected for Ctrl+C. The details (`reportText`) carry what ran, the computer (system,
version, Node), the `about` lines the caller gives (the kit's commit, the folder), every line the
page showed with each task's last progress, and the last 80 lines of each of the run's logs, all
passed through `redact`, which hides an age secret key, a sign-in address's query, a value named
like a key and any long run of letters and digits that holds both.

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
(`pet_food`) and as a title (`Pet food`). The module gets one of each part the manifest knows: two
capabilities, two routes, a page in the sidebar, a daily job, a health check, a migration, a
setting and an error code, plus its own test and its how-to (`modules/<name>/README.md`). Its
capabilities sit on the next free bit plane from 100 (the kit's own modules take the planes
below), so the permission model knows them and the Owner holds them from the next start. The migration is written into the client's
`migrations/` folder at the next free number of the client's own series (5000 and up), and the
module's error codes take the next free hundred from 5000 (`KIT-E-5001`, then `KIT-E-5101` for
the second module), read from the modules already there. Then `src/modules.ts` is rewritten to
list every module under `modules/` in name order, each joined to its pages (the client template's
Worker mounts that list beside the kit's modules, so the file is never edited by hand), and
`test/pages-types.ts` to hold each module's page types to its pages; the pages reach the Worker
through the `#modules/*/pages` import in the client's `package.json`. The generated reference is
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
defaults and errors with their text), **`capabilities.json`**, the same modules' bit plane and
capabilities as data under their version, **Key recipes** from `src/index.ts` (every Worker secret
the mounted modules need, the kit's included: its purpose, how to make, test and rotate it, and
what the portal does without it), and a **Repository map** of the files that exist.

The Modules and Key recipes pages are read from the code: the command imports `src/modules.ts`
and `src/index.ts` (its `modules` export is every module the Worker mounts) in a child Node
process with type stripping and takes each manifest as data; no handler, job or check runs. A
module and the Worker file must therefore load in Node, which means no Workers-only global or
import at module scope; the kit's own packages respect this. Two imports are stood in for while
the files load: `cloudflare:workers`, whose classes a Worker file extends, and `@oltrem/screens`,
whose pages are JSX, which Node does not strip; neither is ever run there. A file Node cannot load is reported
as a problem that names it and its first error, and nothing is written. A client without
`src/modules.ts` has no module yet; a `src/index.ts` with no `modules` export leaves the Key
recipes page saying so.

`capabilities.json` is also a gate. The Worker registers a module's capabilities once per version
(`@oltrem/iam`), so a capability added, removed or changed under the same version would never
reach the permission model. On every run the command compares each module's bit plane and
capabilities with the committed file and refuses a change under an unchanged version, naming the
module and the bump to make; nothing is written until the version moves. A module the file does
not know is new and needs no bump. A file that is not the list the command writes is reported with
the repair: delete it and run `oltrem docs`.

`--check` renders in memory and compares: a file whose committed copy is missing or differs, or
a stray `.md` or `.json` file in the folder, is reported with the command to run, and nothing is
written.
Without `--check`, the stale pages are written and a stray file is removed. The registry is
validated first, by the kit's own rules (every field present, the name in upper snake case, a
known status, no duplicate): a bad row is refused with its row number and nothing is written.
`--json` prints `{ ok, exitCode, ran, written, stale, problems }`.

Exit `0` when the files are current (or were just written), `1` when `--check` found a stale or
stray file, a module changed its capabilities under the same version, or the registry is missing
or invalid, `3` when there is no manifest or no wrangler
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
for every `check` command.

## `oltrem check files [dir]`

The kit's own files in a client repository (research 18, check 1): the deploy workflow,
`src/index.ts`, the kit's tests and configuration, `ai.md`, the pointer files and the Claude Code
settings, each equal by checksum to the copy of the kit version installed. The list travels with
the tool as `kit-files.json`, which the kit's `pnpm docs:build` generates from its client
template. A missing or changed kit file is refused: the change belongs in a module under
`modules/` or in `oltrem.config.ts`, and an upgrade rewrites the kit's files whole. The
template's `.claude/settings.json` denies Claude Code an edit of the same files. Exit `0`, `1` on
a problem, `3` when there is no `oltrem.manifest.json`.

## `oltrem check modules [dir]`

A client's own modules, each within its walls (research 18, checks 3 and 4):

- each folder under `modules/` has a module name that is not a kit module's, and its
  `src/module.ts` declares that id; `src/modules.ts` and `test/pages-types.ts` are exactly what
  `new module` writes for them; each module's bit plane is its own, from 100;
- a module's files import nothing outside its folder, only packages `package.json` lists, and a
  kit package only through an entry point its `exports` names;
- its error codes sit in one hundred of its own, from `KIT-E-5000`;
- each client migration (`5000` and up) is named for a module (`<number>_<module>.sql`, or with
  more after a dash), is in that module's manifest, and only adds to tables named for the module:
  `CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`, `ALTER TABLE … ADD
  COLUMN` that is nullable or has a default (never a key or unique), and `INSERT OR IGNORE`.

Any other statement is refused unless its file carries a `-- contract: <why>` line; such a file
is reported as a removal step, which waits for the owner and ships in a later release than the
code that stops using what it removes, so the previous code still runs on the new database. Exit
`0`, `1` on a problem, `3` when there is no `oltrem.manifest.json`.

## `oltrem check packages [dir]`

Every package `package.json` names (dependencies of every kind) is a kit package (`@oltrem/…`) or
one the kit registered with its reason in its dependency registry (research 18, check 6). The list
travels with the tool in `kit-files.json`. Any other package is refused: the owner adds it to the
kit's registry, with its reason, in a kit release. Exit `0`, `1` on a problem, `3` when there is
no `oltrem.manifest.json`.

## `oltrem check secrets [dir]`

No key or id is written into a file Git would commit (research 18, check 8): a UUID, 32 or more
hex characters, a Cloudflare account token, a GitHub, AWS, Slack or Stripe key, an age or other
private key. A Worker's resources are found by their names and its keys are secrets, so each of
these is a mistake. Files Git ignores (the keys file, `.dev.vars`) are left alone; outside a Git
repository the plain names `.gitignore` lists are. Lockfiles and files over 1 MiB or holding a
null byte are not read. Exit `0`, `1` on a problem, `3` when there is no `oltrem.manifest.json`.

## `oltrem check budgets [dir]`

The upgrade's size and startup measure on every change (research 18, check 7): wrangler's
dry-run build, its size without source maps, and its startup time from `wrangler check startup`,
against the limits the upgrade uses. Past 70 % of either it warns; past either it refuses. The
client template's `verify` runs it in place of a plain dry-run build. Exit `0` (warnings
included), `1` past a limit, `3` when there is no `oltrem.manifest.json`.

## `oltrem release [dir]`

The client template's deploy workflow runs it on `main` after its checks and `verify` (research
18 §3.4); no person types it. In order:

1. **A restore point:** the database's Time Travel bookmark, printed in the run's log. A restore
   to it is never automatic: it waits for the owner's yes, then runs from the operations menu
   (`operate`).
2. **The version running now**, from `wrangler deployments status`: the one carrying most traffic.
3. **The migrations**, as `migrations apply` runs them (the database created on the first deploy).
   A failed migration stops the release: no new code deploys.
4. **The deploy.**
5. **The health check:** `/healthz` on the portal's address (`PUBLIC_HOST`, or the workers.dev
   address wrangler printed), up to six reads five seconds apart. The Worker answers it before its
   own sign-in check; the door must let the path through, as it does `/hooks` (`oltrem deploy`
   prints the step).
6. **The step back:** when the new version never answers `ok`, `wrangler rollback` returns to the
   version noted in step 2, at once. The database is left as it is, which is safe because a
   client's migrations only add (`check modules`).

When the door or a bot challenge answers in the Worker's place (a redirect to the door's sign-in,
or a `cf-mitigated` header), the release cannot see the Worker: it keeps the new version and says
how to let `/healthz` through. The token is the workflow's `CLOUDFLARE_API_TOKEN`, whose Workers
Scripts and D1 permissions cover every step. Exit `0` when the release is live (or could not be
seen), `1` when it stopped or stepped back, `3` when there is no wrangler configuration.

## `oltrem operate <operation> [dir] [--target X] [--confirm X]`

One job of the operations menu (research 18 §3.5). The client template's operations workflow runs
it with the release key, from `main` only, and offers exactly these five as its choices; no person
types it. Each operation is fixed: there is no free command against production.

| Operation | What it does | Target |
|---|---|---|
| `check the setup` | Only reads: the version running, the five latest versions (the ids a step back takes), the database's restore point now, any migration waiting, the required secrets set, `/healthz` on `PUBLIC_HOST` | none |
| `apply waiting migrations` | Runs the migrations not yet applied, as `migrations apply` does, without a deploy | none |
| `replace a Worker secret` | Sets one of the Worker's `secrets.required` to a new value, handed to wrangler on standard input, never as an argument. The workflow reads the value from a repository secret of the same name, which the owner adds first and deletes after | the secret's name |
| `step back the code` | `wrangler rollback` to the version given, or the one before; the database is left as it is | a version id, or none |
| `restore the database` | Time Travel restore to a bookmark (from a release's log) or a time (RFC 3339, or seconds since 1970); prints the bookmark that undoes it | the restore point |

The last two replace what runs. They start only after the owner's yes in the thread, and refuse to
run unless `--confirm` repeats the operation's name, which the workflow asks for in its
confirmation box. A failed step says what still runs. Exit `0` when the job is done, `1` on a
problem, `3` when it was refused before it ran (an unknown operation, a missing target or
confirmation, no wrangler configuration).

## `oltrem backup setup [dir]`

Run once, from a computer with wrangler signed in to the client's account, after the first deploy
has made the database and the bucket (plan 9.3, 11). Each step looks first and only adds, so
running it again changes nothing:

| Step | What happens |
|---|---|
| The account | `CLOUDFLARE_ACCOUNT_ID`, or the one account `wrangler whoami --json` reaches; with several and no variable it stops |
| The database id | `wrangler d1 info <database_name> --json`, for the name `wrangler.jsonc` declares |
| The two settings | `backup.account_id` and `backup.database_id` are written into the settings store, each only while it is empty, the way the Worker's own save writes one: a new configuration version, the row and its history row, by `vendor`. A setting that holds another value is left as it is and reported |
| The cached copy | after a write, `wrangler kv key delete cfg:snapshot --binding <kv> --remote`, so the Worker rereads its settings from D1 within a minute |
| The bucket lock | the rule `oltrem-backups-lock` on `backups/`: no copy can be deleted or overwritten for 35 days |
| The expiry | the lifecycle rule `oltrem-backups-expire` on `backups/`: a copy is deleted 90 days after it was written |

A rule is looked for by its name in `wrangler r2 bucket lock|lifecycle list` and added with
`add ... --force` when missing; a rule already there, and any rule of another name, is left as
it is. Exit `0` when everything is in place, `1` when a setting holds another value or a step
failed, `3` when it could not start: no account, a configuration without one D1 database, one KV
namespace and one R2 bucket, or a database wrangler cannot find or read.

## `oltrem backup drill [dir] --key <file>`

The restore drill (plan 9.3), run by the vendor once a month from a signed-in wrangler, with the
private age key the backups are encrypted to (`--key`, the file `age-keygen` wrote) and the
`age` tool installed. It proves the newest backup copy can be restored, without touching the
client's database:

| Step | What happens |
|---|---|
| The newest copy | read from `backup_runs` in the database `wrangler.jsonc` declares: the newest export that finished ok |
| Download and open | `wrangler r2 object get` from the one bucket into a private temporary folder, then `age -d` with the key; each size must be the one the run recorded |
| Read the copy | its tables and the rows it inserts into each; the migrations table and `backup_runs` must be there, or it is not this client's database |
| Load | a scratch database, `<database>-drill-<date>-<time>`, made with `wrangler d1 create` and loaded with `wrangler d1 execute --file` |
| Check | every table of the copy has exactly its rows in the scratch database |
| Clean up | the scratch database is deleted and the temporary folder with the opened copy removed, whatever happened; a scratch database that could not be deleted is named with the command to delete it |
| Record | one `drill` row in `backup_runs`, `ok` or `failed` with the reason, which the backup page lists and the `backup.drill` health check reads |

Exit `0` when the drill passed and was recorded, `1` when it failed or something could not be
cleaned up or recorded, `3` when it could not start: no key, no `age` tool, or a configuration
without exactly one D1 database and one R2 bucket. `--json` prints the steps and problems as
data, with `ok` true when the copy opened and loaded. The scratch database counts against the
account's databases for the minutes it exists.

## `oltrem github report [dir] --outcome <success|failure|cancelled>`

The last step of a client's deploy workflow on main (plan 4.4), run whatever happened before it
with `job.status` as the outcome. It writes one row about the run into `github_runs` with
`wrangler d1 execute <binding> --remote`, using the deploy token the workflow already holds, so
the GitHub module needs no GitHub token (plan 9.2). The row holds the repository, the commit,
the branch, the outcome and the link to the run, read from GitHub's own variables
(`GITHUB_REPOSITORY`, `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`,
`GITHUB_SERVER_URL`); the kit version installed in `node_modules` (`@oltrem/core-http`); and the
newest published one, from `pnpm view @oltrem/core-http version`. A version it cannot learn is
recorded as unknown.

Exit `0` when the row is written, `1` when the write failed, `3` when it could not start: an
outcome it does not know, a run outside GitHub Actions, or a configuration without exactly one
D1 database. The workflow step carries `continue-on-error`, so a report never fails a deploy.

## `oltrem vendor set <email> [dir]`

Run once, from a computer with wrangler signed in to the client's account, after the first deploy
has applied the IAM migrations (plan 7.4). Migration `0004` makes the Vendor's row with no
address, so nobody can sign in until this runs; the address goes into that row and into no file
(R-04). It reads the row with `wrangler d1 execute <binding> --remote --json`, then writes the
address only when the row has none. The same address again changes nothing; another one is
refused, since changing the Vendor's address is not this command's to do.

Exit `0` when the address is written or already the same, `1` when another one is set or the
write failed, `3` when it could not start: no address, an address with a quote or a space, a
configuration without exactly one D1 database, a database wrangler cannot read, or one with no
Vendor row yet.

## The door and settings from this computer (`src/door.ts`, `src/settings-write.ts`)

The deploy's helpers for the door, which the Worker keeps in step from then on (`@oltrem/iam`,
"The door, kept in step"). The portal's key needs four permissions, `OPS_TOKEN_PERMISSIONS`:
`d1` edit, `account_analytics` read, and for the door `access` edit ("Access: Apps and
Policies") and `access_acct` edit ("Access: Organizations, Identity Providers, and Groups");
`opsTokenForm()` is the account-token form opened with them chosen. wrangler's sign-in has no
Access permission, so the key does it.

| Export | What it does |
|---|---|
| `checkKey` (`src/cloudflare.ts`) | A good key also says `door: 'yes' \| 'no' \| 'unknown'` (`keyKeepsDoor`: it may read Access applications and logins) |
| `doorReadiness(fetch, token, account)` | `{ key, zeroTrust }`: whether the key may keep the door, and whether Zero Trust is set up (`zeroTrustOf`) |
| `workerIdOf(fetch, signInToken, account, name)` | The Worker's id, which Access names, read with the sign-in's own token |
| `writeDoorSettings(dir, run, { workerId?, extras? })` | Writes `iam.door_worker_id` and `iam.door_extra_emails` (`doorEntries`: addresses and `@domain`s, lower case, each once) |
| `askDoorSync(fetch, base)` | `POST /hooks/iam/door`: the Worker syncs now and answers its outcome word (`DOOR_ANSWERS` says each in plain words) |
| `checkDoor(fetch, url)` | `{ on, answer, right }`: Access answers in front of the portal, and the Worker says it set the door right |
| `zeroTrustSteps(account)`, `doorManualSteps({ account, worker, emails, domains })` | The one step a person does per account (team name, Free plan), and the door by hand for a key without Access: One-time PIN and an email list, never "Cloudflare account" members |

`writeSettings(dir, run, writes, { reason })` (and `writeSetting` for one) writes live settings
the way the Worker's own save does: per setting, `oltrem_meta`'s `config_version` moves up, the row
takes that version and a history row records who (`vendor`) and why; then the settings snapshot
(`cfg:snapshot` in KV) is removed, so the Worker reads them within a minute. Keys are checked
against the setting key shape and values are JSON, quoted for SQLite, so nothing else reaches the
SQL. Tested in `test/door.test.ts` against SQLite holding the real settings migration.

## `oltrem parts list [dir]`, `set <ids...>`, `preset everything|email [dir]`

Which parts of the portal (its modules) are switched off: the live setting `settings.parts_off`
of `@oltrem/core-config`, which the Vendor also changes on the portal's Parts page. `list` prints
each kit part `on`, `off` or `always on` with what it needs; `set` switches off exactly the parts
named, every other one on, in the repository here; `preset email` keeps email, its providers and
the core, `preset everything` switches every part on. The deploy calls the same exports from
`src/parts.ts`:

| Export | What it is |
|---|---|
| `PARTS: PartChoice[]` | the catalogue, `{ id, label, description, core, requires }` per kit part, a copy of `KIT_PARTS` held equal by `test/parts.test.ts` |
| `PART_PRESETS` | `{ id: 'everything' \| 'email', label, off: string[] }` |
| `PARTS_KEY` | `'settings.parts_off'` |
| `partsRefusal(off)` | why a list cannot be written (a bad name, a core part, a part one left on needs), or null |
| `readParts(dir, run)` | `{ off?: string[], problem?: string }`, through `wrangler d1 execute --remote --json`; `[]` before anything is written |
| `writeParts(dir, off, run, now?)` | `{ ran, written, off, steps, problems }`: refused before any read when the rule says no; nothing written when the list is already stored; otherwise `writeSetting` (above: the version moves up, a history row, the cached settings cleared) |
| `partsLines(off)` | the lines `list` prints |

Exit `0` when written or already so, `1` when a write failed, `3` when it could not run (a list
the rule refuses, a database wrangler cannot read).

## `oltrem upgrade [dir]`

Run after the client repository installs a new kit version, before its verify (plan 14.3). It is
a doctor first, and it writes nothing until every check passes:

| Id | Check |
|---|---|
| the doctor's | `NODE-01`, `PM-01`, `MANIFEST-01`, `WF-01`, `CF-SEC-02`, `TOKEN-01` and `AGENTS-01`, as `oltrem doctor` runs them |
| `UP-KIT-01` | the kit's floor, from the `engines` and `oltrem` fields of the installed `@oltrem/core-http`: this Node, the installed wrangler, and the `compatibility_date` of `wrangler.jsonc` |
| `UP-MIG-01` | the kit migrations can be copied: no edited copy, no shared number, no kit number in a client file |
| `UP-SEC-01` | every name in `secrets.required` is set on the deployed Worker (`wrangler secret list`); a warning when wrangler cannot list them |
| `UP-SIZE-01` | the bundle `wrangler deploy --dry-run` builds, against 64 MiB, and the startup `wrangler check startup` measures on this computer, against 1 s; a warning from 70 % |

When none fails, it copies the new kit migrations, writes the generated reference, and records
the installed kit versions in `migrations/kit.json`. It prints each installed `@oltrem/*`
package's release notes, from its `CHANGELOG.md`, since the version recorded last; on the first
run, the installed version's own. In [the kit's look](#the-look-in-a-terminal): the checks that
did not pass, each with its id and fix, then how many passed; the notes of the packages that have
some, and one line counting those without. Then run `pnpm verify`, commit and push.

Exit `0` when it wrote, `2` when it wrote with warnings, `1` when a check failed and nothing was
written, `3` when it could not start: no wrangler configuration, or no kit package installed.

## `oltrem doctor`

Runs the check registry against the repository in the current directory and prints one line
per check: `pass`, `fail`, `warn` or `skip`, the check's id, a one-line summary, and for a
failure the exact command that fixes it. No check prints a secret value.

| Id | Check | Fix printed |
|---|---|---|
| `NODE-01` | the running Node satisfies `engines.node` of package.json (a `>=version` floor) | the install command for that version |
| `PM-01` | the installed pnpm is the one `packageManager` names, or, with none installed, the pnpm npx fetched to run this check is | `npm install -g pnpm@<version>`, one command on every Node the kit supports (Node 25 no longer ships Corepack) |
| `MANIFEST-01` | the Worker here matches its manifest (the check above); skipped where there is no manifest | the rule, or the file to fix |
| `MIG-01` | every kit migration is copied into `migrations/`, unchanged, with a current `kit.json`; skipped where there is no manifest or no installed kit package | `oltrem migrations sync` |
| `WF-01` | the deploy workflow `.github/workflows/deploy.yml` is in place | copy it from the client template |
| `CF-SEC-02` | the Worker's `secrets.required` names exactly the key recipes of the modules `src/index.ts` mounts, so wrangler refuses a deploy with one missing; skipped where there is no manifest or no `modules` export | the two blocks to write, for the wrangler file and the manifest, with the names |
| `TOKEN-01` | every secret name the repository uses (as `check tokens` finds them) has a row in `tokens.registry.json`; skipped where there is no registry | add the row, with the reason it cannot be an existing token |
| `AGENTS-01` | the instruction files pass `check agents`; skipped where there is no ai.md | `oltrem setup` for a pointer file, or move the fact to the generated reference |
| `DOCS-01` | the generated reference in `docs/_generated/` is what `oltrem docs` renders now, with no stray file; skipped where there is no manifest | `oltrem docs`, or the registry file to fix |
| `GH-MIN-01` | the month's GitHub Actions minutes of the account that owns the `origin` repository, from GitHub's usage summary through the GitHub CLI, against the 2,000 free minutes: a warning from 70 %, a failure from 90 %; skipped where there is no GitHub remote, no signed-in `gh`, or no billing access | before the minutes run out: a self-hosted runner, public client repositories, or paid minutes (plan 14.1); for a skip, `gh auth login` or `gh auth refresh -h github.com -s user` |

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
packages for the migration commands and a fake wrangler for `migrations apply`. The drill's
tests run wrangler's D1 commands against SQLite databases in memory (Node's own `node:sqlite`)
and a copy written in the format `wrangler d1 export` writes; the run report's tests run its D1
command against the GitHub module's real migration the same way.

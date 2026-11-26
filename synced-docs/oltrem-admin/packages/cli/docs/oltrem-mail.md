---
title: "@oltrem/cli: `oltrem mail`; `oltrem upgrade [dir]`; `oltrem doctor`; In the kit repository"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src; split from packages/cli/README.md]
---

# @oltrem/cli: `oltrem mail`; `oltrem upgrade [dir]`; `oltrem doctor`; In the kit repository

> Part of [the @oltrem/cli README](../README.md).

## `oltrem mail`

Oltrem Mail (the `@oltrem/mail` add-on: sending through Cloudflare, the Mail setup page, and the
inbox for mail sent to the business's own addresses) put into a portal or taken out of it, in a client repository or in the kit's own template
(`src/mail.ts`). A portal without it sends through its providers, with Write, Sent and Campaigns:
today's email. The first deploy asks the same question (step 4 above).

| Command | What it does |
|---|---|
| `oltrem mail status [dir]` | one line per fact: in or not, where the package comes from, and what is half in with its fix; exit `1` when something is half in |
| `oltrem mail add [dir] [--from <folder>]` | puts the five parts in (below), runs `pnpm install` in a client repository, then the kit migrations and the reference (as `oltrem setup`), and prints what is left: `pnpm verify` and a commit, `pnpm dev` to try it, the key's rights, `npm run deploy`. It runs again safely and finishes a half-done add |
| `oltrem mail remove [dir] --confirm remove` | takes the five parts out and Mail's migration files with their `kit.json` entries, then installs and refreshes the reference as `add` does. Its data stays in the database and the inbox's mail in the bucket, and adding it back applies nothing twice; meanwhile the portal refuses mail to every address. Email Routing and the key's rights stay on Cloudflare until a person changes them, and it says how |
| `oltrem mail try [dir] [--port 8787] [--to <address>]` | one test email into the portal `pnpm dev` runs on this computer, through wrangler's local address (`/cdn-cgi/local/email`, never the internet), from `someone@example.org` to `hello@example.com` by default. The Worker's `email` handler hands it to the inbox, which keeps it only for a mailbox's address: a refused address says to add a mailbox on the Inbox page, then try again with `--to`. A Worker without the handler (a kit older than Mail's inbox) is told to upgrade, and how to try sending meanwhile |

**The five parts.** Mail is in when all five are: `package.json` names `@oltrem/mail` (in a
client repository only: the kit's template always does, for its own lockfile and checks);
`src/mail.ts` hands `createMail` and Mail's pages to the Worker, which builds Mail when it is
there and leaves it out when it is not; `wrangler.jsonc` has the `send_email` binding `EMAIL`;
`oltrem.manifest.json` names it; and the `KIT_OPS_TOKEN` row of `tokens.registry.json` lists the
three rights Mail adds to the portal's key (Zone, DNS, Edit; Zone, Email Routing Rules, Edit;
Account, Email Routing Addresses, Edit). Some in and some out is "half in": the deploy stops,
and the doctor's `MAIL-01` fails, each naming the command that fixes it.

**Where the package comes from.** In a client repository, from its own `kit/`, which every new
client gets with Mail's packed file whether or not Mail is chosen. `--from <folder>` takes a
newer build instead (oltrem-mail's `pnpm mail:pack`): all three of its packages (`@oltrem/email`,
`@oltrem/campaigns`, `@oltrem/mail`) replace the older files in `kit/`, each checked against the
fingerprint in the folder's `oltrem-mail.json` first. In the kit's template the package comes
from `vendor/mail/`, so `--from` is refused there. A repository whose `src/index.ts` does not
mount `src/mail.ts` has a kit older than Mail and is refused, with the upgrade to take.

Every edit is worked out before any file is written, so a refusal changes nothing. `--json`
prints `{ ok, exitCode, ran, written, removed, steps, problems, next }` (`status`: the state's
facts). Exit `0` when done or already so, `1` on a problem after the files were written (an
install that failed: the files stay, and running `pnpm install` by hand finishes it), `3` when it
could not run.

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

When none fails, it takes the kit's `assets` line of 2026-11-03 out of `wrangler.jsonc` (a Worker
with static assets is not handed the Access sign-in; another `assets` is reported to take out by
hand), copies the new kit migrations, writes the
generated reference, and records
the installed kit versions in `migrations/kit.json`. It prints each installed `@oltrem/*`
package's release notes, from its `CHANGELOG.md`, since the version recorded last; on the first
run, the installed version's own. In [the kit's look](look-in-a-terminal.md#the-look-in-a-terminal): the checks that
did not pass, each with its id and fix, then how many passed; the notes of the packages that have
some, and one line counting those without. Then run `pnpm verify`, commit and push.

Exit `0` when it wrote, `2` when it wrote with warnings, `1` when a check failed and nothing was
written, `3` when it could not start: no wrangler configuration, or no kit package installed.

### `oltrem upgrade [dir] --from <folder>`

The step before, for a repository with the kit vendored in `kit/`: it takes a newer packed kit
(`pnpm kit:pack` in the kit) from the folder. `kit/` then holds exactly those files, one per kit
package, the older ones removed, and `package.json` names them: each `file:./kit/` dependency
and every kit override. A folder missing a package, or holding two of one, changes nothing. It
installs nothing: run `pnpm install`, then `oltrem upgrade` again, which checks and takes the
migrations and the reference as above. The kit's own files (the deploy workflow, `src/index.ts`
and the rest) are not rewritten by it yet. `--json` prints `{ ok, exitCode, written, removed,
problems }`. Exit `0` when taken, `1` on a problem.

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
| `MAIL-01` | Oltrem Mail is all in or all out: its five parts (below, [`oltrem mail`](#oltrem-mail)) agree, and a package that package.json names is installed; skipped where there is no manifest | `oltrem mail add` to finish it or `oltrem mail remove --confirm remove` to take it out; `pnpm install` |
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
Packed (`pnpm pack`, which `pnpm kit:pack` runs for every package), the tool carries `dist/`,
`bin/`, `look/`, `kit-files.json` and the two templates, which its prepack places beside it and its
postpack removes again (`scripts/package.mjs`); npm leaves a `.gitignore` out of a package, so the
client template's travels as `_gitignore` and `oltrem new client` gives it its name back.
`pnpm verify` builds it and runs `oltrem manifest check` as its `manifest` gate on the client
template, the module template, the core packages that declare a test Worker with a binding, and
every module folder with a manifest, read from the disk (`scripts/lib/gates.mjs`). The tool is typed against Node (`tsconfig.json` here extends the shared
`tsconfig.base.json`) and its tests run on Node with Vitest, against a sample client Worker in
`test/fixtures/client-ok/` that has exactly one of each resource, with fake installed kit
packages for the migration commands and a fake wrangler for `migrations apply`. The drill's
tests run wrangler's D1 commands against SQLite databases in memory (Node's own `node:sqlite`)
and a copy written in the format `wrangler d1 export` writes, and in the SQLite tool's format
with an FTS5 table; the run report's tests run its D1
command against the GitHub module's real migration the same way.

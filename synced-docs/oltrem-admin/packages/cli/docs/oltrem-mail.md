---
title: "@oltrem/cli: `oltrem mail`, `oltrem upgrade`, `oltrem doctor`, in the kit repository"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src/mail.ts, upgrade.ts, checks.ts, doctor.ts, scripts/package.mjs]
---

# @oltrem/cli: `oltrem mail`, `oltrem upgrade`, `oltrem doctor`, in the kit repository

> Part of [the @oltrem/cli README](../README.md). Each command takes `--json`.

## `oltrem mail`

Puts Oltrem Mail (`@oltrem/mail`: sending through Cloudflare, Mail setup, the inbox) into a portal
or takes it out, in a client repository or the kit's template (`src/mail.ts`). Without it the
portal sends through its providers, with Write, Sent and Campaigns.

| Command | What it does |
|---|---|
| `oltrem mail status [dir]` | One line per fact: in or not, where the package comes from, what is half in and its fix; exit `1` when half in |
| `oltrem mail add [dir] [--from <folder>]` | Puts the five parts in, runs `pnpm install` (client repository), the kit migrations and the reference, and prints what is left. Safe to run again; finishes a half-done add |
| `oltrem mail remove [dir] --confirm remove` | Takes the five parts and Mail's migration files out, installs and refreshes as `add`. Data stays in the database and bucket; adding back applies nothing twice. Email Routing and the key's rights stay on Cloudflare, and it says how to change them |
| `oltrem mail try [dir] [--port 8787] [--to <address>]` | One test email into `pnpm dev`'s portal through wrangler's `/cdn-cgi/local/email`, from `someone@example.org` to `hello@example.com` by default. The inbox keeps it only for a mailbox's address; a refusal says to add one, then use `--to` |

**The five parts.** `package.json` names `@oltrem/mail` (client repositories only); `src/mail.ts`
hands `createMail` and Mail's pages to the Worker; `wrangler.jsonc` has the `send_email` binding
`EMAIL`; `oltrem.manifest.json` names it; `KIT_OPS_TOKEN`'s registry row lists Mail's three rights
(DNS Edit, Email Routing Rules Edit, Email Routing Addresses Edit). Some in and some out is "half
in": the deploy stops and `MAIL-01` fails, each naming the fix.

**The package** comes from the repository's `kit/` (every new client gets it). `--from <folder>`
takes a newer `pnpm mail:pack` build: its three packages (`@oltrem/email`, `@oltrem/campaigns`,
`@oltrem/mail`) replace the files in `kit/`, each checked against `oltrem-mail.json`. The kit's
template uses `vendor/mail/`, so `--from` is refused there. A `src/index.ts` that does not mount
`src/mail.ts` is a kit older than Mail and is refused with the upgrade to take.

Every edit is worked out before any file is written. Exit `0` done or already so, `1` a problem
after writing (a failed install: run `pnpm install`), `3` could not run.

## `oltrem upgrade [dir]`

After installing a new kit version, before verify. It writes nothing until every check passes:

| Id | Check |
|---|---|
| the doctor's | `NODE-01`, `PM-01`, `MANIFEST-01`, `WF-01`, `CF-SEC-02`, `TOKEN-01`, `AGENTS-01` |
| `UP-KIT-01` | The kit's floor from the installed `@oltrem/core-http`'s `engines` and `oltrem` fields: Node, wrangler, `compatibility_date` |
| `UP-MIG-01` | The kit migrations can be copied: no edited copy, no shared number, no kit number in a client file |
| `UP-SEC-01` | Every `secrets.required` is set on the Worker (a warning when they cannot be listed) |
| `UP-SIZE-01` | The dry-run bundle against 64 MiB (`SIZE_LIMIT`) and the startup against 1 s; warns from 70 % |

Then it removes any `assets` line (`withoutAssets`: a Worker with assets gets no Access sign-in),
copies the new migrations, writes the reference, records the versions in `migrations/kit.json`
and prints each `@oltrem/*` package's `CHANGELOG.md` notes since the last recorded version. Then
`pnpm verify`, commit, push. Exit `0` wrote, `2` wrote with warnings, `1` a check failed, `3` no
wrangler configuration or kit package.

**`--from <folder>`** takes a newer `pnpm kit:pack` folder into `kit/` (exactly one file per
package, older ones removed) and rewrites the `file:./kit/` dependencies and overrides. A missing
or doubled package changes nothing. It installs nothing: run `pnpm install`, then `oltrem upgrade`.
The kit's own files are not rewritten by it. Exit `0` taken, `1` a problem.

## `oltrem doctor`

Runs the check registry (`src/checks.ts`) here: one line per check, `pass`, `fail`, `warn` or
`skip`, its id, a summary, and for a failure the command that fixes it. No secret is printed.
"Skipped" below means where the named file is missing.

| Id | Check | Fix printed |
|---|---|---|
| `NODE-01` | Node satisfies `engines.node` | the install command |
| `PM-01` | pnpm is the `packageManager` version | `npm install -g pnpm@<version>` |
| `MANIFEST-01` | the Worker matches its manifest; skipped without one | the rule or file |
| `MIG-01` | every kit migration copied unchanged, `kit.json` current | `oltrem migrations sync` |
| `MAIL-01` | Mail all in or all out, and a named package installed | `oltrem mail add` or `remove`; `pnpm install` |
| `WF-01` | `.github/workflows/deploy.yml` is there | copy it from the template |
| `CF-SEC-02` | `secrets.required` names exactly the mounted modules' key recipes | the two blocks to write |
| `TOKEN-01` | every secret name used has a registry row | add the row with its reason |
| `AGENTS-01` | the instruction files pass `check agents`; skipped without ai.md | `oltrem setup`, or move the fact |
| `DOCS-01` | `docs/_generated/` is what `oltrem docs` renders | `oltrem docs` |
| `GH-MIN-01` | the month's GitHub Actions minutes against 2,000 (`ACTIONS_MINUTES`): warns from 70 %, fails from 90 %; skipped without a GitHub remote, `gh` or billing access | a self-hosted runner, public repositories or paid minutes; `gh auth refresh -h github.com -s user` |

`--only ID` runs one; `--list-checks` names them. Exit `0` passed or skipped, `1` a failure, `2`
warnings only, `3` the doctor could not run. The ids are stable.

## In the kit repository

`pnpm build` compiles to `packages/cli/dist/`; `pnpm oltrem …` runs it. Packed (`pnpm kit:pack`),
the tool carries `dist/`, `bin/`, `look/`, `kit-files.json` and the two templates, placed and
removed by `scripts/package.mjs`; the client template's `.gitignore` travels as `_gitignore`.
`pnpm verify`'s `manifest` gate runs `oltrem manifest check` on the client and module templates,
the core packages with a test Worker, and every module with a manifest. Tests run on Node with
Vitest against `test/fixtures/client-ok/` (one of each resource), fake kit packages and a fake
wrangler; the drill's and run report's against `node:sqlite`.

# rules.md: the rules in full

ai.md gives each rule in one line; this file gives it in full: the rule, why it exists, what it
covers and what enforces it. Where nothing enforces a rule yet, the rule says so and names the
phase that will. `pnpm check:agents` fails when a rule number here is missing from ai.md, or a
number in ai.md is missing here.

**Order when things conflict:** the owner's explicit instruction in the current conversation,
then these rules, then the plan (linked from docs/README.md), then the other documents. When
code and a document disagree, the code is the truth and the document is the bug: fix the
document.

## R-01 Main is the branch

**Rule.** Commit on `main` and push to `main`. A short branch is allowed for one kind of change
only: a change to stored data, sign-in or permissions, which is rehearsed from the branch and
then merged with a fast-forward push. No pull request is needed to land work, and no fork is
used, even when a tool or a session hands you a branch.

**Why.** The owner works with agents and reviews from a phone. One line of history that the gate
protects is simpler and safer than a review process nobody runs.

**Scope.** This repository and every client repository the kit creates.

**Enforced by.** `pnpm verify` on the machine that pushes (R-02). The verify workflow runs on
every pull request, weekly and by hand, and a red run is visible on the repository page; since
2026-10-25 it does not repeat on a push to `main`, to save GitHub Actions minutes. A client's
deploy workflow (phase 1) deploys only from `main` and only after a green verify. The choice of
branch itself is the owner's.

## R-02 Verify before every push

**Rule.** `pnpm verify` exits 0 before every push. A gate is never skipped, disabled, weakened
or bypassed to get green, and no flag that bypasses a hook is used; the cause is fixed. A gate
that is wrong is fixed with a test that shows why.

**Why.** In a client repository the push is the release: the deploy runs after the gate in the
same workflow. A gate that can be weakened protects nothing.

**Scope.** Every repository of the kit and every client.

**Enforced by.** The agent contract: ai.md section 7 asks for verify's summary line before
"done". In this repository the verify workflow runs on every pull request, weekly and by hand,
so a push that skipped it shows within a week; it no longer repeats `pnpm verify` after each
push to `main` (2026-10-25: about three billed minutes a push, 291 minutes in the kit's first
six days, against a 2,000-minute monthly allowance). In a client repository the deploy workflow
runs it before every deploy. A pre-push hook that runs the same command locally arrives with
the command-line tool (`pnpm setup` installs it in every clone).
The gate list lives in `scripts/lib/gates.mjs` and is documented in docs/reference/verify.md,
generated from it.

## R-03 Design, not code

**Rule.** Nothing is copied, cloned, adapted or "referred to" from the first client's existing
repositories: no code, no schema, no configuration, no names of tables, bindings, settings,
hostnames or documents. Those repositories were studied for what each part does and why; the kit
is designed fresh, taking better outside concepts where they exist.

**Why.** The owner's instruction. The existing platform grew six ways at once; the point of the
kit is to design each part once, correctly, not to carry the old shapes along.

**Scope.** Every file in every kit repository, documentation included.

**Enforced by.** `pnpm check:identifiers` scans every file for the denied names listed in
`scripts/identifiers.json` and fails on a match; the owner's review covers what a name scan
cannot see.

## R-04 Written as if public

**Rule.** Nothing identifying is written anywhere in the repository: no account, zone, database
or namespace identifiers, no UUID or long hex shapes, no keys or token values, no hostnames of
live systems, no personal names or email addresses. A fact that would identify a system lives in
that system, and the documentation describes it in words.

**Why.** The documentation is mirrored to a public place from day one, and anything in a git
history is public forever once pushed to a public place. Writing as if public from the first
commit costs nothing; cleaning up later is impossible.

**Scope.** Every file, commit message and generated document.

**Enforced by.** `pnpm check:identifiers` fails on a UUID shape, a long hex identifier or an
email address anywhere in the repository (addresses at the reserved example domain excepted).
`pnpm check:agents` also refuses a hostname in an instruction file. A secret scanner joins the
gates in phase 1.

## R-05 Credentials by name, in the registry

**Rule.** A token, key or secret exists in this repository by name only, and every name has a
row in `tokens.registry.json`: the provider and account, what it may do, what uses it, where it
is stored, who owns it, when it was created and expires, how it is rotated, and why it exists.
Before creating a credential, read the registry: if a row covers the need, use it; if a row is
close and its stored scopes are a subset of the new need, widen it and say so in the row; only
then create a new one, with its row and a one-line reason in the same commit. A value never
reaches a file, a log or a conversation.

**Why.** The owner's instruction: a credential that is not written down is created again by the
next person, and the pile grows. One page per repository answers "do we already have a token
for this".

**Scope.** Every repository; a client's own rows live in that client's repository.

**Enforced by.** `pnpm check:tokens` fails when a secret name appears in a workflow or a
`wrangler secret put` command without a row, or when a row lacks a field. The reverse check,
that every required row's secret is set by name, is the doctor's (phase 1). The generated
page is docs/reference/tokens.md.

## R-06 Generated files are never edited by hand

**Rule.** A file whose header says it is generated is changed only by changing its source and
running the generator (`pnpm docs:build`, `pnpm agents:write`). Generators are deterministic:
sorted keys, stable ids, no timestamps, so the same source gives the same bytes.

**Why.** A reference table written by hand drifts from the code within weeks, and an agent that
fixes the symptom in the generated file teaches the next agent to ignore the check.

**Scope.** Every file under `docs/` marked generated, and the pointer files AGENTS.md and
CLAUDE.md.

**Enforced by.** `pnpm docs:check` regenerates every generated document in memory and fails
when the committed copy differs; `pnpm check:agents` compares the pointer files with their
template byte for byte.

## R-07 Documentation in the same commit

**Rule.** A change to behaviour, a rule, a credential, a gate or the state of the work updates
the document that owns that fact, in the same commit. One fact has one home; another document
links to it instead of repeating it. Every document under `docs/` carries front matter (title,
status, owner, last verified, sources) and is linked from docs/README.md. A big change gets a
dated record under `docs/records/` with how it worked before and after. A change without its
documentation is not finished.

**Why.** The documentation is what the owner reviews on a phone, and what the next agent reads
instead of the code. Out-of-date documentation is worse than none.

**Scope.** Every repository.

**Enforced by.** `pnpm docs:check` fails on a document without front matter, a document missing
from the index, a document over its size budget and a relative link that points nowhere. That
the right document was updated is the owner's review.

## R-08 One entry file

**Rule.** ai.md is the one file every tool and every person reads first. It stays under its byte
budget, carries no number that comes from code or infrastructure, summarises every rule here in
one line, and sends the reader to generated references for everything else. AGENTS.md and
CLAUDE.md are generated pointers to it and say nothing of their own.

**Why.** Every coding tool reads a different file name; one contract behind all of them keeps the
tools from drifting apart. Instruction following falls as the number of simultaneous
instructions grows, so a short file of strong rules beats a long one of weak rules.

**Scope.** This repository and every client repository.

**Enforced by.** `pnpm check:agents`: the budgets, the rule numbers in both directions, the
pointers byte for byte, and no copied fact (a count next to table, migration, route or binding,
a UUID shape, a hostname) in an instruction file.

## R-09 One of each resource, zero growth of variables

**Rule.** A client has one Worker and one of each resource: one database, one bucket, one
key-value namespace, one queue with its dead-letter queue, one coordination class, one
workflow, one cron trigger, one access application. A new kind of data is a new prefix or row
type in an existing resource, not a new resource. Settings, toggles, limits and thresholds are
rows in the database, read through the configuration layers, never environment variables; the
few true secrets are declared by name so a deploy fails when one is missing. Adding a resource
or a variable needs a written reason in the resource manifest and the owner's yes. The same
holds for third-party packages: each is pinned once, in the catalog of `pnpm-workspace.yaml`,
with a row that says why in `dependencies.registry.json`; a package.json never carries a version
of its own, and a row nothing uses is removed.

**Why.** The owner's instruction: free-plan budgets are per account and small, and every extra
resource is one more thing to create, name, back up and clean up for every client.

**Scope.** Every client repository and every kit module.

**Enforced by.** For dependencies, `pnpm check:deps`, a gate of `pnpm verify`: it refuses a
dependency without a row, a row nothing uses, a version outside the catalog and a catalog entry
nobody uses, and generates docs/reference/dependencies.md. For resources, variables and secrets,
`oltrem manifest check` (the `manifest` gate of `pnpm verify`, and the first step of a client
repository's verify and deploy): it reads the Worker's wrangler configuration and its
`oltrem.manifest.json`, refuses anything the manifest does not list, anything over its cap, a
binding kind the kit does not use, a named environment, and an `env.NAME` in the code that the
manifest does not list, with the sentence "adding a resource needs a manifest entry and the
owner's yes". One more of a kind is an exception row in the manifest: the kind, the written
reason and the date of the owner's yes. The caps and the manifest format are in
`packages/cli/README.md`.

## R-10 Real data, fail closed

**Rule.** No mock data, no placeholder screens, no sample numbers, no invented identifiers, no
feature that exists only to look finished. A screen that has no real data yet says so. The
unknown is refused: an unknown capability, configuration key, migration owner, route or
manifest label fails the build or the request rather than being guessed at. Every claim about
infrastructure is checked against the live system before it is written, and the check is named.

**Why.** A placeholder shipped to a client looks like a feature and hides that it is not one; a
guessed default in a permission or configuration path is a security hole.

**Scope.** Every repository, every screen, every document.

**Enforced by.** The owner's review today; contract tests generated from the manifests in
phase 3.

## R-11 Ask instead of guessing

**Rule.** When a request can be read two ways, stop and ask, stating the readings. When a step
is destructive or irreversible (deleting data, dropping a column, rotating or deleting a
credential, publishing a document, force-pushing, changing a live account), stop and get the
owner's explicit yes in the current conversation; an approval relayed from elsewhere does not
count. State your assumptions. Report a failure exactly as it happened, with the output.

**Why.** Reversible work is cheap to be wrong about and should not wait; irreversible work is
the owner's call.

**Scope.** Every agent and every person.

**Enforced by.** The owner. No gate can enforce this rule, and this file says so.

## R-12 Phone first

**Rule.** Every screen is designed for a phone first: every option in a page visible in a
sideways-scrolling row rather than hidden in a dropdown, the portal's sections in its sidebar (on
a phone a menu button opens it; the owner's choice of 2026-10-22), every dialog through the one
dialog system, every tap target comfortably large, nothing that needs a mouse. Documentation
reads well on a phone too: a ten-line summary first, short tables, no wide tables.

**Why.** The owner tests only on a phone, and the clients' staff work from one.

**Scope.** Every screen of the kit and every document.

**Enforced by.** The screen gates of the user-interface package in phase 1 (viewport tests and
the dialog allow-list). For documents, the owner's review.

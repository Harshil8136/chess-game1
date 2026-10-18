---
title: "Platform kit research: AI-ready repositories, setup checks and docs that cannot drift"
status: historical
audience: [owner, ai, technical]
last_verified: 2026-10-18
verified_against: [web-sources]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, research, snapshot]
---

> **Research snapshot, read on 2026-10-18.** Written by a research pass for the platform kit plan ([`01-plan.md`](01-plan.md)). Figures carry their source URL and the date read; anything unverified is marked **GAP**. Paths named here describe other repositories or a proposed design, not files in this repository. Kept as a dated record and not updated in place.

# AI-native repositories for the platform kit: research and recommendations

Written 2026-10-18 for the platform-kit design plan. Every external claim carries a bracketed source number; the numbered list at the end gives the URL and the date it was read (all read 2026-10-18 unless stated). Anything that could not be verified is marked **GAP**. Nothing here was copied from any repository; the short snippets are written for this note.

---

## Summary

1. **One instruction file: `AGENTS.md`.** It is now stewarded by the Linux Foundation's Agentic AI Foundation, is read natively by Codex, Cursor, Copilot's agents, Gemini CLI (one setting), Antigravity and Claude Code (since v2.1.277), and the remaining tool-specific files become one-line pointers or imports \[1\]\[2\]\[3\]\[4\]\[5\]\[6\]\[7\].
2. **Keep it small.** Claude Code recommends under 200 lines per file and warns at startup when a file is longer; Codex stops reading at 32 KiB by default; Antigravity caps a rule file at 12,000 characters; the Skills spec recommends under 5,000 tokens per skill body. Published studies show compliance falls as the number of simultaneous instructions grows \[2\]\[3\]\[7\]\[8\]\[9\]\[10\].
3. **Rules are context, not enforcement.** Anthropic's own docs say so and point to hooks for hard blocks. The kit should therefore split: short rules in `AGENTS.md`, procedures in Skills, hard blocks in hooks plus `pnpm verify` \[2\]\[11\].
4. **Skills pay off, MCP later, llms.txt cheap.** Agent Skills is an open spec with 40+ clients listed on its showcase; Cloudflare already ships skills that `wrangler --install-skills` installs for detected agents. A repo-local MCP server is only worth it once `kit doctor --json` and the manifests exist, because an MCP server is just a thin wrapper around them \[12\]\[13\]\[14\]\[15\].
5. **Docs cannot drift if they are generated and gated.** The pattern Wrangler itself uses (`wrangler types --check` exits non-zero when generated types are stale) is the model for `kit docs:check` over routes, settings keys, error codes, resources and the migration ledger \[16\].
6. **`kit doctor` is a thin shell over commands that already exist** (`wrangler whoami --json`, `wrangler secret list --format json` which returns names only, `wrangler d1 migrations list --remote`, `wrangler check startup`, the `secrets.required` block) plus provider probes, with the same JSON rendered in the CLI, the portal Setup page and the generated docs \[17\]\[18\]\[19\]\[20\]\[21\].
7. **Guardrails that catch AI failure modes:** boundaries and dependency rules (eslint-plugin-boundaries, dependency-cruiser), dead code (knip), packaging (publint, arethetypeswrong), type tests (expect-type via Vitest), Workers-runtime tests (`@cloudflare/vitest-plugin`, the renamed pool-workers), a "no hand-edited generated files" gate, a secret scan, all behind one `pnpm verify`. Skip mutation testing and heavy pre-commit hooks for now \[22\]–\[33\].
8. **Monorepo: pnpm workspaces + Turborepo.** Remote caching is free on Vercel on all plans and self-hostable; Nx is heavier and its cloud free tier is credit-capped; moon's hosted cache was shut down \[34\]\[35\]\[36\]\[37\].
9. **Distribution: publish `@kit/*` to the public npm registry** with trusted publishing (zero long-lived tokens). GitHub Packages requires a classic PAT even for public packages, which multiplies into roughly 2 + 3 per client secrets to rotate. The code becomes world-readable; the licence decides what others may do with it \[38\]\[39\]\[40\].
10. **Open scope works if "core" has no HTTP, no HTML and no "site" words:** a client repo is a manifest plus bindings plus a composition file; a headless client ships only `scheduled`/`queue` handlers, which Workers support natively \[41\].

---

## 1. Agent instruction files (state as of 2026-10-18)

| Tool | Native file(s) | Reads `AGENTS.md`? | Size and nesting rules | Notes |
|---|---|---|---|---|
| **AGENTS.md (the format)** | `AGENTS.md`, nested per package | — | No required fields; nearest file wins; chat prompt overrides everything | Stewarded by the Agentic AI Foundation under the Linux Foundation; the site claims 60k+ projects; listed adopters include Codex, Amp, Jules, Cursor, Factory, Aider, goose, opencode, Zed, Warp, RooCode, Gemini CLI, Kilo Code, Semgrep, Windsurf, Ona \[1\]. AAIF was formed 2025-12-09 with AGENTS.md, MCP and goose as founding projects \[42\]. |
| **Claude Code** | `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/*.md` | Yes, natively since v2.1.277 when no `CLAUDE.md` is on the path; `@AGENTS.md` import works everywhere | Target under 200 lines per file; warning at startup past that; `@path` imports expand at launch to a depth of four hops and do not reduce context cost; files over 4 MiB skipped; `.claude/rules/` files can be path-scoped | "Claude treats them as context, not enforced configuration. To block an action… use a PreToolUse hook." Contradictory instructions may be "picked arbitrarily". `/doctor prompt-audit` audits the files; `/import` copies another tool's config once \[2\]. |
| **Codex (OpenAI)** | `AGENTS.md`, `AGENTS.override.md`, `~/.codex/AGENTS.md` | Yes (its native format) | Walks from repo root to cwd, one file per directory, concatenated root-down; stops at `project_doc_max_bytes` = 32 KiB by default; `project_doc_fallback_filenames` can add names | Advice in the docs: "Keep rules concise… reserve formatting and lint checks for CI" \[3\]. |
| **Cursor** | `.cursor/rules/*.mdc` (frontmatter `alwaysApply`/`description`/`globs`), User rules, Team rules | Yes, as a fourth rule type: "Simple alternative to `.cursor/rules`" | Plain `.md` in `.cursor/rules` is ignored; scoped rules load by glob or on demand | Also has `hooks.json` and can load Claude Code hooks \[4\]\[43\]. Root `.cursorrules` still read but third-party guides call it legacy (**GAP**: no official deprecation statement retrieved). |
| **GitHub Copilot** | `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md` | Yes: coding agent and code review read `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` (review also `REVIEW.md`); VS Code Chat reads `AGENTS.md`; Copilot Chat on GitHub.com reads only `copilot-instructions.md` | Path-specific files apply by `applyTo` | Both root `AGENTS.md` and `copilot-instructions.md` are used when both exist; conflicts are resolved non-deterministically (per search summary of GitHub docs) \[5\]\[44\]. |
| **Gemini CLI** | `GEMINI.md` hierarchy, `@file.md` imports | Yes with `"context": {"fileName": ["AGENTS.md","GEMINI.md"]}` in `.gemini/settings.json` | Global, workspace and just-in-time files are concatenated | Docs page notes that for unpaid and Google One users "Gemini CLI was replaced by Antigravity CLI on June 18th, 2026" \[6\]. |
| **Antigravity (Google)** | `AGENTS.md` or `GEMINI.md` in any directory, `.agents/AGENTS.md`, `.agents/rules/*.md` (frontmatter `trigger:` required, else silently discarded), `.agents/skills/*/SKILL.md` | Yes, natively, always-on per directory | Rule files limited to 12,000 characters each; `.agents/rules/` scanned flat unless `.agents/rules.json` registers nested files; `@[label](path)` inlines a file | Its docs draw the same line the kit should: "Write a rule for constraints and invariants… Write a skill for multi-step workflows" \[7\]\[45\]. |

### Recommendation: `AGENTS.md` is the source of truth; everything else points to it

- **Root `AGENTS.md`** (≤ 8 KB, ≤ ~150 lines): what the project is, the five commands (`pnpm setup`, `pnpm doctor`, `pnpm verify`, `pnpm dev`, `pnpm docs:check`), the non-negotiables (main-only, verify before push, no invented IDs, generated files are read-only, ask when unsure), and a routing table "task → which doc/skill to open". No numbers that come from code or infrastructure.
- **Nested `AGENTS.md`** in each `packages/*` and `modules/*` directory (≤ 3 KB): the package's purpose, its public surface file, its tests, its one or two local rules. Every tool above reads the nearest file.
- **Pointers, generated by `kit init` and checked by `kit check:agents`:**
  - `CLAUDE.md` = one line `@AGENTS.md` plus, at most, Claude-only lines below it (keeps working in sessions that cannot load `AGENTS.md` directly; the import is never double-loaded) \[2\].
  - `.github/copilot-instructions.md` = three lines: "Instructions live in AGENTS.md" plus the two commands. Needed only because Copilot Chat on GitHub.com does not read `AGENTS.md` \[5\].
  - `.gemini/settings.json` with `context.fileName` including `AGENTS.md`; no `GEMINI.md` \[6\].
  - `.cursor/rules/` only for path-scoped `.mdc` rules that a nested `AGENTS.md` cannot express; otherwise empty \[4\].
  - `.agents/rules/` only for Antigravity glob-triggered rules; keep `trigger:` frontmatter valid \[7\].
  - `.claude/rules/` only for path-scoped rules; `.claude/settings.json` holds hooks.
- **`kit check:agents`** (part of `pnpm verify`): asserts the root file exists and is under budget; asserts `CLAUDE.md` starts with `@AGENTS.md`; asserts pointer files match the template byte-for-byte; asserts no nested `AGENTS.md` exceeds budget; greps `AGENTS.md` for forbidden "copied facts" (digits followed by table/migration/route/binding words, UUID shapes, hostnames) and fails with "move this fact to the generated reference and link it"; asserts the sum of all always-loaded files (root `AGENTS.md`, `CLAUDE.md`, `.claude/rules/*` without `paths`) stays under 24 KB so Codex never truncates \[3\].

### What belongs in it, and what models actually follow

- Facts an agent needs every session: commands, layout, "always/never" rules, where to look. Procedures go to Skills; part-of-codebase rules go to path-scoped files \[2\].
- Evidence on length: WildIFEval reports that "handling instructions with multiple constraints remains a significant challenge" and analyses degradation by number and type of constraint \[8\]; ManyIFEval/StyleMBPP (EMNLP Findings 2025) found that across ten LLMs "performance consistently degrades as the number of instructions increases" and that instruction count alone predicts compliance within about 10% \[9\]. AgentIF (NeurIPS 2025) reports sharp declines past roughly 3,000 tokens and 40 constraints (per slides summarised in search results; **GAP**: not read directly) \[10\].
- Practical reading: ten strong rules beat fifty weak ones. The current vendor platform's `main.md` has seven Golden Rules plus a long §2–§7; the kit should keep the seven and move the rest into generated docs and skills.

### Anti-patterns (all observed in the vendor's current platform or warned against by the tools)

1. **Walls of rules** and multi-page "laws" sections: lowers adherence, hits Codex's 32 KiB cap silently \[3\]\[9\].
2. **Duplicated numbers** ("26 duplicate migration numbers", "env-var cap is N"): the current repos admit these drifted. Numbers live in generated reference files; the instruction file links.
3. **Telling the agent in words to read a file**: Anthropic notes the agent "sees AGENTS.md only if it decides to open the file"; use `@import` or native loading \[2\].
4. **A SessionStart hook that prints the rules**: double-loads context once native reading exists \[2\].
5. **Contradictions between nested files**: resolved arbitrarily \[2\]\[5\].
6. **Symlinked `CLAUDE.md` → `AGENTS.md`**: breaks on Windows clones; use the import \[2\].
7. **Ritual acknowledgements** ("reply begins with `main.md loaded` plus seven lines"): cheap insurance, but `/context` and `/memory` in Claude Code show which files loaded; keep the acknowledgement to one line.

---

## 2. Skills, hooks, MCP, llms.txt, repo map: what pays off

| Mechanism | State (2026-10-18) | Payoff for a small vendor | Verdict |
|---|---|---|---|
| **Agent Skills (`SKILL.md`)** | Open spec at agentskills.io: folder with `SKILL.md`, frontmatter `name` (≤ 64 chars, must equal folder name) and `description` (≤ 1,024 chars), optional `license`, `compatibility`, `metadata`, experimental `allowed-tools`; progressive disclosure: ~100 tokens of metadata at startup, body loaded on activation (< 5,000 tokens recommended), `scripts/`, `references/`, `assets/` on demand \[12\]. Client showcase lists Claude Code, Claude, ChatGPT & Codex, Gemini CLI, Cursor, GitHub Copilot, VS Code, OpenCode, Goose, Kiro, Factory, Amp, Junie, Roo Code, Mistral Vibe, Databricks, Snowflake and more; a third party counted 46 entries on 2026-08-20 \[13\]\[46\]. Antigravity reads `.agents/skills/*/SKILL.md` \[45\]. Cloudflare publishes `cloudflare/skills` (Apache-2.0) and Wrangler has a global `--install-skills` flag that installs them "for detected AI coding agents" \[14\]\[15\]. | High. Procedures ("add a module", "run a migration", "rotate a key", "release the kit") become one skill each, portable across every agent the owner may switch to. | **Adopt now.** One `skills/` directory in the kit, published as a package the client repo copies into `.agents/skills`, `.claude/skills`, `.cursor/skills`, `.codex/skills` via `kit init` (same content, four paths). |
| **Claude Code hooks** | Events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `PreCompact`, `InstructionsLoaded`, `FileChanged` and more; types `command`, `http`, `mcp_tool`, `prompt`, `agent`; exit code 2 blocks; `PreToolUse` can `deny`, `ask` or rewrite input; configured in `.claude/settings.json` (committable) \[11\]. | Medium-high for the three failure modes rules cannot stop: editing `docs/_generated/**`, running `git push --no-verify` or `wrangler deploy` directly, writing a secret-shaped string. | **Adopt a minimal set (3–4 hooks).** Cursor reads `.cursor/hooks.json` and "supports loading hooks from third-party tools like Claude Code", so one hook script serves two tools \[43\]. Codex, Gemini CLI and Antigravity have no equivalent in the docs read (**GAP**), so the same checks must also live in `pnpm verify` and lefthook `pre-push`. |
| **Repo-local MCP server** | MCP spec (page dated 2026-07-28): JSON-RPC, servers expose Resources, Prompts, Tools; extensions include Tasks, "Skills over MCP" and MCP Apps \[47\]. Cloudflare states "Every agent listed supports Skills and MCP" on its agent-setup page \[48\]. Knip ships `@knip/mcp` as an example of a tool-local server \[26\]. | Medium, later. Agents read files well; an MCP server adds value only for live or computed data: `kit doctor --json`, manifest queries ("which module owns settings key X"), portal state, D1 read-only queries. | **Phase 2.** Build it as a 200-line wrapper over the same CLI once doctor and manifests exist. Not before. |
| **`llms.txt` / `llms-full.txt`** | Proposal v2 (updated 2026-08-10): `/llms.txt` at root or any path, `.md` twin for each page, `Link:` headers `rel="alternate" type="text/markdown"` and `rel="describedby"`; Chrome Lighthouse audits for it; OpenAI, Anthropic and Gemini publish one \[49\]. Adoption still thin: about 36k sites by May 2026 with "evidence that AI systems are reading them… close to zero" per one crawl; 8.7% of the top 1,000 sites in June 2026 \[50\]\[51\]. Cloudflare docs expose `/llms.txt`, per-page `/index.md` and "Copy as Markdown" \[52\]; Turborepo docs expose `/llms.txt` and `/agents.md` \[53\]. | Low cost, modest payoff: our docs are Markdown already, so the public docs mirror can emit `llms.txt` (index) for free. Skip `llms-full.txt` (a 1 MB blob agents will not fit in context). | **Adopt the index only**, generated by the docs build. |
| **Repo map** | Aider sends a ranked map of files and key symbols, default 1k tokens, built from a dependency graph \[54\]. | High for AI-written code in a multi-package kit: the biggest failure mode is re-implementing something that exists. | **Adopt as a generated file**, `docs/_generated/repo-map.md` (≤ 8 KB): one line per package and module with purpose, entry file and exported names; regenerated by `kit docs:build`; linked from `AGENTS.md`. |

**Minimal set:** `AGENTS.md` + nested `AGENTS.md`; 6–10 skills; 3–4 hooks (Claude + Cursor); generated repo map; `llms.txt` on the mirror. MCP in phase 2.

---

## 3. Docs that cannot drift

### Patterns

1. **Generate every reference from the thing it describes, then gate.** Routes (from the Hono router; `@hono/zod-openapi` emits OpenAPI at `/doc` from the same Zod schemas \[55\]), capabilities (from the permission manifest), settings keys (from the settings schema), error codes (from the error registry), resource manifest (from `wrangler.toml` plus the module manifests), migration ledger (from `migrations/` and `wrangler d1 migrations list --remote` \[19\]), key recipes (from `recipes/*.json`). `kit docs:build` writes `docs/_generated/**`; `kit docs:check` rebuilds to a temp dir and diffs; a difference fails `pnpm verify` exactly as `wrangler types --check` fails CI when generated types are stale \[16\].
2. **Diátaxis** for the hand-written part: tutorials (first client in 30 minutes), how-to (one task each), reference (all generated), explanation (why D1-only, why Access door). Cloudflare used it as the "north star" for its docs rework \[56\].
3. **MADR** for decisions (4.0.0 released 2024-09-17; "bare" and "minimal" templates) in `docs/decisions/NNNN-title.md`, immutable once accepted \[57\].
4. **Front-matter** on every hand-written page: `title`, `owner` (package or module name, never a person), `status` (draft/living/historical), `last_verified` (date), `sources` (paths or URLs the page restates), `audience` (human/agent/both). A 60-line script validates it against a JSON schema; a `last_verified` older than 180 days on a `living` page is a warning, older than 365 a failure.
5. **One fact, one home.** The generated reference owns every number and identifier; hand-written pages link with a stable anchor. `docs:check` greps hand-written pages for UUID shapes, binding names and digit+noun patterns and fails on a match that is not a link.
6. **Size budget per page: 24 KB (~6k tokens) hard, 12 KB soft.** Rationale: Codex truncates instruction chains at 32 KiB \[3\]; Claude's own auto-memory index is cut at 25 KB \[2\]; a skill body should stay under ~5k tokens \[12\]. Generated references may exceed 24 KB only when split by domain (`routes/users.md`, `routes/email.md`) with a small index.
7. **Link checking** with lychee (Rust, Apache-2.0, nightly builds in Oct 2026; v0.24.2 changelog noted) on every build, offline mode for internal links in `verify`, online weekly in CI \[58\]. Markdown lint with markdownlint-cli2 0.23.3 (2026-09-20) \[59\].
8. **Docs index twice:** `docs/index.json` (machine: path, title, owner, status, size, hash, audience) and `docs/README.md` rendered from it. Agents load the JSON, people read the Markdown. The JSON is also what the MCP server serves later.
9. **Changelogs via Changesets** (`@changesets/cli` 3.0.3, 2026-09-14; v3 is the development line, v2 on a maintenance branch): each change carries a `.changeset/*.md`; the "Version Packages" PR aggregates per-package CHANGELOG.md \[60\]\[61\]. Agents are good at writing changesets when the skill shows the format.
10. **Public mirror with allow-list and scan.** The mirror workflow copies only paths listed in `docs/PUBLISHED.json`; before copying it runs the identifier scan (account/zone/database/namespace IDs, Access AUD, DSNs, hostnames, emails) and a secrets scanner; a hit fails the workflow. The current platform already does this per repo; the kit makes it one shared script. For the scanner: gitleaks is "feature complete… security patches only" (v8.30.1, 2026-03-21) and its author moved to Betterleaks (v2.0.0-rc.2 pre-release 2026-10-07; v1.x on a maintenance branch) \[31\]\[32\]\[62\]. Use gitleaks today, plan the swap when Betterleaks v2 is stable.

### Directory layout: the kit monorepo

```
kit/
  AGENTS.md                 # ≤ 8 KB, routing table, no copied facts
  CLAUDE.md                 # "@AGENTS.md" + nothing else
  .github/copilot-instructions.md   # 3-line pointer
  .gemini/settings.json     # context.fileName: ["AGENTS.md"]
  .claude/settings.json     # hooks (shared script in tools/hooks/)
  .cursor/hooks.json        # same hooks, Cursor format
  pnpm-workspace.yaml       # packages/*, modules/*, apps/*, tools/*; catalog: pins
  turbo.json
  package.json              # scripts: setup, doctor, verify, docs:build, docs:check
  packages/
    core-identity/  core-config/  core-modules/  core-ui/  core-providers/
    core-health/    core-jobs/    core-errors/   cli/      # @kit/cli = kit doctor|setup|init|docs
    <each>: AGENTS.md, package.json, src/, test/, manifest.ts, CHANGELOG.md
  modules/
    email/ users/ sessions/ backup/ health/ vps/ github/
    <each>: AGENTS.md, manifest.ts (routes, settings keys, capabilities, error codes,
            resources, key recipes), src/, test/, docs/ (how-to + explanation only)
  skills/                   # SKILL.md folders, copied into client repos by kit init
    add-module/ run-migration/ rotate-key/ release-kit/ write-changeset/ triage-doctor/
  recipes/                  # one JSON per external key: provider, create URL, scopes, probe
  docs/
    README.md  index.json   PUBLISHED.json
    tutorials/  how-to/  explanation/  decisions/ (MADR)
    _generated/             # routes, settings, errors, resources, migrations, repo-map, recipes
  tools/
    docs-build.ts docs-check.ts check-agents.ts identifier-scan.ts hooks/
  .changeset/
```

### Directory layout: a client repo

```
acme-portal/
  AGENTS.md                 # ≤ 4 KB: client name, which modules, the five commands, link to kit docs
  CLAUDE.md                 # "@AGENTS.md"
  .github/copilot-instructions.md  .gemini/settings.json  .claude/settings.json  .cursor/hooks.json
  .agents/skills/ .claude/skills/ .cursor/skills/ .codex/skills/   # copies written by kit init
  package.json              # depends on @kit/* with exact versions; scripts proxy to kit CLI
  kit.config.ts             # the composition: modules on/off, settings schema overrides, theme
  wrangler.toml             # bindings + [secrets] required = [...] generated from manifests
  migrations/               # client-owned numbers only; kit migrations ship inside modules
  src/
    index.ts                # 10 lines: createApp(config) from @kit/core-modules
    custom/                 # client-specific module(s), same manifest shape
  docs/
    README.md index.json  _generated/   # same generators, run against this repo
    how-to/  decisions/
  .changeset/  (optional, if the client repo publishes anything)
```

The client repo has no hand-written reference docs; the generators produce them from the composed manifests, so client docs and kit docs cannot disagree on a route or a key.

---

## 4. `kit doctor` and `kit setup`

### What the reference tools teach

- **`brew doctor`:** "Will exit with a non-zero status if any potential problems are found"; `--list-checks` lists checks that can be run individually; a hidden `--json` prints `{tier, findings}`; slow checks run last; success prints one line, "Your system is ready to brew." \[63\].
- **`flutter doctor`:** no JSON mode; `diagnose` returns a boolean that is false only on `missing` or `crash`; `partial` and `notAvailable` count as "issues" but not failures; `-v` adds timings and informational lines \[64\].
- **`expo-doctor`:** 20+ named checks run in parallel; per check `✔/✖ description`, then yellow issue lines and green `Advice:` lines; spinner-free output when non-interactive so CI logs stay readable; env switches to skip or soften specific checks (`EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK`, `EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS`) \[65\]\[66\]. Exit code semantics: **GAP** (not visible in the part read).
- **`nx report`:** prints Node, OS, native target, package manager and version, daemon state, and the versions of every relevant package and plugin, "for adding to an Nx issue report" \[67\].
- **Rails `bin/setup`:** "idempotent, so that you can run it at any time and get an expectable outcome"; `bundle check || bundle install`; `db:prepare`; `--reset` and `--skip-server` flags; ends by starting the dev server \[68\].
- **`supabase`:** global `-o env|pretty|json|toml|yaml` output selector, `--create-ticket` on any error, login token in the OS credential store with `SUPABASE_ACCESS_TOKEN` for CI \[69\].
- **Wrangler:** `whoami --json` "Exits with a non-zero status if not authenticated", `--account` shows membership; `auth token --json`; `login --device` for machines without a browser, `--use-keyring` for encrypted storage; `secret list --format json` returns `[{name, type}]`, names only; `d1 list --json`, `d1 info --json`, `d1 migrations list --remote`; `deploy --dry-run` compiles without deploying; `check startup` reports bundle size and a local CPU startup profile (Wrangler ≥ 4.116.0); `types --check` fails CI on stale types; the `[secrets] required = [...]` block makes `wrangler deploy` fail listing missing secrets and becomes the source of truth for type generation; `--install-skills` installs Cloudflare skills for detected agents \[17\]\[18\]\[19\]\[20\]\[21\]\[16\]\[70\]\[15\].

### Design

- **`kit doctor [--json] [--fix] [--only id,id] [--strict] [--list-checks]`.** Human output follows expo-doctor (one line per check, then issues and advice); `--json` follows brew's `{tier, findings}` shape extended per check. Exit codes: `0` all pass; `1` at least one FAIL; `2` only WARNs (`--strict` turns WARN into FAIL for CI); `3` doctor itself could not run (no network, no config). Each check has a stable id (`DOC-NODE-01`), a severity, a one-line summary, details, and a `remediation` with exact commands, a docs anchor and a portal path. Never prints a secret value; checks report presence by name only.
- **`kit setup`** is idempotent in the Rails sense: install (`pnpm install --frozen-lockfile`), generate (`wrangler types`, docs), create missing local files (`.dev.vars` template with names only), then run `kit doctor`. `--reset` wipes local D1 state; `--ci` disables prompts and interactive logins and prints the device-login URL instead \[17\].
- **Same checks, three surfaces.** The check registry is data (`id`, `title`, `how`, `remediation`, `recipe?`). The CLI runs it with Node and Wrangler; the portal's **System health → Setup** page runs the subset that can run inside the Worker (bindings present, migrations applied, secrets present by name, provider probes) and shows for each missing key: provider, where to create it (`createUrl`), which scopes, a **Test** button that calls the probe; the docs generator renders `docs/_generated/setup.md` and `docs/_generated/recipes/*.md` from the same registry and recipes. The AI reads the same text the owner sees.
- **Key recipe** (one JSON per external secret, in `recipes/`): `name`, `provider`, `purpose`, `createUrl`, `scopes[]`, `probe` (HTTP method, URL, success predicate, no body logged), `rotation` (how, how often), `fallbackMode` (what the kit does without it), `docs` anchor. `wrangler.toml [secrets] required` is generated from the recipes of enabled modules so Wrangler itself refuses a deploy with a missing key \[21\].

### Check table

| Id | Check | How (read-only) | FAIL / WARN | Remediation printed | `--fix` |
|---|---|---|---|---|---|
| NODE-01 | Node version matches `engines.node` and `devEngines.runtime` | `process.version` vs `package.json`; pnpm enforces project `engines` at install \[71\] | FAIL | `pnpm env use --global <ver>` or `pnpm add node@tool:<ver>` (pnpm 12 records `engines.runtime`) \[72\] | no |
| PM-01 | pnpm version matches `packageManager`; Corepack not required | compare `pnpm -v`; `pmOnFail` setting present | WARN | set `pmOnFail: download` in `pnpm-workspace.yaml` (pnpm ≥ 11; replaces `managePackageManagerVersions`) \[71\]\[73\]; Corepack docs were removed from Node (2025-03-28) and 2026 guides report it is no longer shipped from Node 25 (**GAP** on an official Node release note) \[74\]\[75\] | yes |
| LOCK-01 | Lockfile in sync | `pnpm install --frozen-lockfile --offline` dry | FAIL | `pnpm install` | yes |
| CF-AUTH-01 | Wrangler authenticated | `wrangler whoami --json` exit code \[17\] | FAIL | `npx wrangler login --device` (no local callback needed) \[17\] | no |
| CF-ACCT-01 | Account id in config matches the logged-in account | `whoami --json` account list vs `account_id` in `wrangler.toml` \[17\] | FAIL | edit `account_id`; Wrangler's own `account_id` failsafe prevents wrong-account deploys \[76\] | no |
| CF-BIND-01..n | Every binding in the manifest exists remotely and ids match | `wrangler d1 list --json`, `kv namespace list`, `r2 bucket list`, `queues list` vs `wrangler.toml` \[19\] | FAIL | `wrangler d1 create <name> --update-config` etc. (the `--update-config` flag writes the id so nobody types one) \[19\] | yes, create-only, with confirmation |
| CF-SEC-01..n | Every required secret present by name | `wrangler secret list --format json` vs recipes \[18\] | FAIL (required) / WARN (optional) | `npx wrangler secret put <NAME>` plus recipe `createUrl` and scopes | no |
| CF-SEC-02 | `[secrets] required` block equals recipes of enabled modules | diff generated vs committed \[21\] | FAIL | `kit docs:build` | yes |
| CF-ACCESS-01 | Access application covers the Worker or its custom domain | Cloudflare API `GET /accounts/{id}/access/apps` (needs token with "Access: Apps Read") \[77\]\[78\] | FAIL in `access` mode, WARN in `own-account` fallback | dashboard path Zero Trust → Access → Applications, or Worker → Access tab (since 2026-08-14 a Worker or all Workers can be protected at once) \[78\]\[79\] | no |
| CF-DNS-01 | Custom domain route exists and resolves | `routes[].custom_domain` in config; API route list; DNS lookup | WARN | Cloudflare creates DNS and certificates for Custom Domains; cannot attach where a CNAME already exists \[80\] | no |
| D1-MIG-01 | All migrations applied remotely | `wrangler d1 migrations list --remote` \[19\] | FAIL | `wrangler d1 migrations apply <db> --remote` | yes, with confirmation |
| CFG-01 | `kit.config.ts` valid against schema; no unknown keys | Zod parse | FAIL | print path and expected type | no |
| PROV-01..n | Provider key works | recipe probe (e.g. email provider "account" endpoint) with 3 s timeout | FAIL if module enabled and no fallback; WARN if fallback mode exists | recipe steps | no |
| TIME-01 | Clock within 60 s of a trusted source | compare local time to `Date` header of a HEAD request | WARN | enable NTP; Access JWT and signed URLs depend on it | no |
| GH-APP-01 | GitHub App installed on the client repo (if GitHub module enabled) | API with the app's JWT | WARN | install URL from recipe | no |
| DOCS-01 | Generated docs fresh | `kit docs:check` \[16\] pattern | FAIL | `kit docs:build` | yes |
| AGENTS-01 | Instruction files in sync and under budget | `kit check:agents` | FAIL | regenerate pointers | yes |
| CPU-01 | Startup profile within budget | `wrangler check startup` bundle size \[20\] | WARN | names the largest imports | no |

---

## 5. Fallbacks, degraded modes and error design

Principle: a missing key or binding degrades a feature, never the portal. Each degraded mode is declared in the module manifest, surfaced by `kit doctor`, shown as a banner in the portal, and documented from the same data.

| Missing or down | Degraded mode | What the owner sees | What the agent is told |
|---|---|---|---|
| Email provider key | Messages are written to the `outbox` table with status `held`; a job retries when the key appears; nothing is lost | Banner "Email is on hold: no provider key. Add it in Setup." with count of held messages | doctor `PROV-EMAIL-01 WARN`, recipe steps |
| Secondary email provider down | Primary stays; if primary fails, queue retries with backoff then fails over; dead letters recorded | Health card shows provider state and last success | error code with provider name, no body |
| Cloudflare Access not configured | **Own-account sign-in only**: the owner's single account (set at `kit setup`) may sign in with a magic link; all other sign-ins refused; portal shows "Access door not configured" | Setup page step with the Access create link | `CF-ACCESS-01 WARN`, mode `own-account` |
| KV namespace missing | Config and session caches fall back to D1 reads with short TTL; a `WARN` because latency rises | Banner "Cache is off: KV binding missing" | `CF-BIND-KV WARN` |
| Queue binding missing | Jobs run inline inside the request with a hard time budget, or are stored and run by the cron tick | Banner | `CF-BIND-QUEUE WARN` |
| D1 migrations pending | Read-only mode for the affected module; write routes return a problem with code and the exact `apply` command | Banner with the command | `D1-MIG-01 FAIL` |
| R2 missing | Backup and uploads disabled; module hidden from nav | Banner | WARN |
| Provider rate-limited or 5xx | Queue + exponential backoff; circuit opens after N failures; health card shows "degraded" | Health card | error code |

**Error design.** Every error the kit raises has a stable code (`KIT-E-1203`), a one-sentence meaning, a "what to do now" and a docs URL; the registry is a TypeScript file in `@kit/core-errors`, and `docs/_generated/errors.md` is generated from it. API responses use RFC 9457 Problem Details: `type` is the docs URL for the code, `title` the meaning, `detail` the instance, plus `code` and `requestId` extensions; RFC 9457 obsoletes 7807 and exists precisely so "non-human consumers of HTTP APIs" can act on errors \[81\]. HTML error pages show the same code, the meaning, the "what to do now" and a link; for the owner on a phone the code is enough to paste into a chat and the agent can look it up in the generated docs. Logs carry the code and `requestId`, never the message body.

---

## 6. Guardrails for AI-written code

| Guardrail | Tool (version, last publish) | Failure mode it catches | Adopt? |
|---|---|---|---|
| Module boundaries | eslint-plugin-boundaries 7.2.0 (2026-08-09) \[22\]; dependency-cruiser 18.6.0 (2026-10-11) \[23\] | A module importing another module's internals; core importing a module; UI importing providers | **Adopt both**: boundaries in ESLint for fast feedback while editing; dependency-cruiser in `verify` for cycles and a committed rule file that doubles as architecture doc (it can also draw the graph for the explanation page) |
| TypeScript project references | `tsc --build`, `references`, `composite` \[82\] | Hidden cross-package imports via relative paths | **Adopt**: one `tsconfig` per package, root `tsconfig.json` with references; `verify` runs `tsc -b` |
| Dead code and unused deps | knip 6.41.0 (~2026-10-12), 190+ plugins including Astro and Vitest, 40M downloads/month \[26\]\[83\] | Silent duplication (a second helper nobody imports), stale dependencies after an AI refactor | **Adopt** in `verify`, fail on unused exports in `packages/*` |
| Package correctness | publint 0.3.25 (2026-10-01) \[24\]; @arethetypeswrong/cli 0.18.5 (2026-07) \[25\] | Broken `exports`, wrong types resolution for ESM | **Adopt** in the kit's release job only (needs a build first) |
| Bundle budget | size-limit 14.2.0 (2026-10-07) \[27\] | A new dependency blowing the 10 ms CPU budget | **Adopt** for each Worker entry with a byte limit; pair with `wrangler check startup` in doctor \[20\] |
| Type tests | expect-type 1.4.0 (2026-06-25), built into Vitest as `expectTypeOf` \[28\] | Manifest or config types silently widened to `any` | **Adopt** a `types.test-d.ts` per core package |
| Contract tests from manifests | generated Vitest files: every route in the manifest answers, every settings key has a default and a schema, every error code has docs | A route added without a manifest entry, or vice versa | **Adopt**; the generator lives in `tools/` |
| Workers-runtime tests | `@cloudflare/vitest-plugin` 1.4.4 (2026-10-16): runs Vitest inside workerd via Miniflare, isolated per-file storage; renamed from `@cloudflare/vitest-pool-workers` on 2026-08-19/20 with a codemod `npx @cloudflare/codemods vitest:pool-workers-to-vitest-plugin` \[29\]\[30\] | Tests passing in Node but failing in the Worker | **Adopt**; the owner's brief names the old package: use the new name from day one |
| Coverage thresholds | Vitest coverage per package | Skipped tests | **Adopt lightly**: 80% lines on `packages/core-*`, no global threshold on modules; what matters more is the "every PR touches a test file" rule below |
| Mutation testing | StrykerJS `@stryker-mutator/core` 10.0.0 (2026-08-14) \[33\]\[84\] | Assertion-free tests | **Skip for now**: slow and noisy for a small team; revisit for `core-identity` only once stable |
| Git hooks | lefthook 2.2.2 (2026-10-13), single Go binary, parallel, also an npm package \[31\]\[85\] | Pushing red | **Adopt `pre-push` only** (runs `pnpm verify`); no `pre-commit` beyond a 1-second secret scan, so agents are not slowed down and cannot be tempted to `--no-verify`. CI re-runs `verify` regardless |
| Conventional commits | @commitlint/cli 21.2.3 (2026-09-19) \[86\] | Unreadable history | **Adopt in CI only**, with Changesets for release notes; do not block local commits |
| One entry point | `pnpm verify` = quick gates (agents sync, docs check, generated-files check, markdown lint, identifier scan, secret scan) then typecheck, lint, boundaries, knip, tests, size-limit | "I ran the tests" without running the gates | **Adopt**; print one line per gate and the full output of the failing one (the current platform's `verify-runner` pattern is right) |
| Deterministic generators | generators sort keys, use stable ids, no timestamps in output | Spurious diffs that teach agents to ignore `docs:check` | **Adopt**; a test regenerates twice and asserts byte equality |
| File size caps and naming | ESLint `max-lines` 300 for `src/**` (tests exempt), one exported component per file, `kebab-case.ts`, manifest always `manifest.ts`, tests `*.test.ts` beside source | Models lose precision editing long files; predictable names let them find things without searching | **Adopt** (Cursor's own example rules use a 200-line component cap \[4\]) |
| No hand-edited generated files | `docs/_generated/**`, `worker-configuration.d.ts`, `*.generated.ts` carry a header; `verify` rebuilds and diffs; a `PreToolUse` hook denies edits to those paths \[11\] | An agent "fixing" the symptom in the generated file | **Adopt** |
| Secret scanning | gitleaks v8.30.1 (feature-complete, security patches only) now; Betterleaks when v2 is stable \[32\]\[62\]; GitHub push protection for users is on by default for public repos, repository-level needs the paid Secret Protection \[87\] | A real key pasted into a doc or test | **Adopt** in `verify` and the mirror workflow |
| Invented IDs | identifier scan plus the rule that only `wrangler … --update-config` writes an id \[19\] | UUID-shaped strings in code or docs | **Adopt** |
| Scope creep | PR template plus a Stop hook asking "does the diff touch files outside the task's named packages?"; `knip` catches orphan additions | Drive-by refactors | **Adopt the hook**; keep the human rule in `AGENTS.md` |

Skip list: mutation testing, pre-commit formatting hooks, Nx-style generators and conformance rules, a second linter (Biome) alongside ESLint, Husky (lefthook is faster and has no Node dependency).

---

## 7. Monorepo tooling and distribution

### Task runner

| Option | Version, licence, scale | Caching and cost | AI familiarity | Fit |
|---|---|---|---|---|
| **pnpm workspaces + Turborepo** | turbo 2.11.9 (2026-10-16), MIT, ~29.9M weekly downloads; markets itself as "the build system for coding agents"; docs expose `/llms.txt` and `/agents.md` \[34\]\[53\] | Local cache; "Remote Caching is free"; "Vercel Remote Cache is free to use on all plans, even if you do not host your applications on Vercel"; open artifact API so self-hosting works (third-party server exists); HMAC-SHA256 artifact signing \[35\]\[88\] | Highest: one `turbo.json`, uses the `package.json` scripts agents already know | **Recommend** |
| pnpm + Nx | nx 23.3.0 (~2026-10-08), ~3.7M weekly \[89\] | Nx Cloud Hobby: free, 50,000 credits/month, 5 contributors, 10 concurrent CI connections; Team $29/month + $19 per contributor; self-hosted cache adapters free but need an activation key (per Nx docs via search) \[36\]\[90\] | High, but generators, plugins and `project.json` add vocabulary agents must learn | Too heavy for ~15 packages and one vendor |
| pnpm + moon | @moonrepo/cli 2.6.2 (2026-10-14), MIT, ~252K weekly \[91\] | Hosted moonbase was sunset; remote cache is self-hosted via the Bazel Remote Execution API (bazel-remote) or Depot Cache; integrated toolchain is a plus \[37\]\[92\] | Lower: fewer examples in training data | Interesting toolchain pinning, but the kit gets that from pnpm 12 (`node@tool:`) \[72\] |
| pnpm alone | pnpm 12.14.0 (~2026-10-16) \[93\] | `catalog:` pins one version per dependency across the workspace \[94\]; no task cache | Highest | Fine until `verify` passes two minutes; add Turborepo then |

### Versioning

Changesets (`@changesets/cli` 3.0.3) with a fixed group for `@kit/core-*` (one version) and independent versions for modules; the "Version Packages" PR is the release; publish with npm trusted publishing (OIDC from GitHub Actions, npm CLI ≥ 11.5.1, Node ≥ 22.14) so no publish token exists anywhere \[60\]\[40\].

### How a client repo consumes `@kit/*`

| Channel | Read tokens needed (honest count) | Upgrade friction | If the vendor's GitHub org is unavailable | Code visibility | Verdict |
|---|---|---|---|---|---|
| **GitHub Packages (npm registry)** | "You need an access token to publish, install, and delete private, internal, and public packages" and it "only supports authentication using a personal access token (classic)"; `GITHUB_TOKEN` works in Actions only if the package grants that repo read access \[38\]. Count for C client repos and A agent sandboxes: 1 PAT per human machine + C CI secrets (or package-access grants if the client repos sit in the vendor's org) + C Cloudflare Workers Builds build secrets (Workers Builds installs dependencies; it supports "Build variables and secrets… accessible only to your build" and the documented `.npmrc` with `${TOKEN}` pattern) \[95\]\[96\] + A×C sandbox secrets. With 5 clients and 3 agents: about 26 copies of a classic PAT tied to one person's account. | Low (semver) | **Everything stops**: installs fail in CI, Workers Builds and agent sandboxes; only machines with a warm pnpm store keep working | Private | Reject for a vendor with phone-only operations |
| **Public npm, scoped org** | **Zero** read tokens; publish via OIDC, zero long-lived tokens \[40\]; npm Teams would be $7/user/month only if private packages were wanted \[39\] | Low (semver, Changesets) | Unaffected: npm is independent of GitHub; only new releases pause | **World-readable**; licence governs reuse (below) | **Recommend** |
| JSR | No private packages ("not possible to publish private packages to JSR"); npm-compatible read endpoint `npm.jsr.io`; pnpm can install from it \[97\]\[98\] | Low | Unaffected | Public | No advantage over npm for a Workers/Node kit |
| Git tag dependencies | pnpm supports `owner/repo#semver:^2.0.0` and `#path:/packages/x`; v12 resolves GitHub over HTTPS and never records SSH; private repos need a Git credential on **every** machine and runner; a source-only repo must be "prepared" (deps installed, build run) with the dependency's own package manager at install time \[99\]\[100\] | Medium: lockfile churn, slow installs | Stops | Private | Reject: slow in Workers Builds, same token sprawl as GitHub Packages |
| Vendored copy (`vendor/@kit/*` committed, updated by `kit vendor <version>`) | Zero | High: diffs are large, `knip`/boundaries must treat `vendor/` as external | **Unaffected** | Mirrors the kit into every client repo | Keep as an **escape hatch**: `kit vendor` exists for a client who insists on no outside registry |

**Licence options for a public kit.** MIT or Apache-2.0 (permissive; Apache adds a patent grant); Business Source License 1.1 (source-available, production use needs the licensor's Additional Use Grant or a commercial licence, and each version converts to the Change License after at most four years) \[101\]; PolyForm family (Noncommercial, Internal Use, Small Business, Shield "permits uses other than those that compete with the provider", Perimeter) \[102\]. For a service vendor whose revenue is composition and operation rather than the kit itself, Apache-2.0 is the lowest-friction choice; PolyForm Shield or BUSL-1.1 if the owner wants to stop a competitor from reselling the kit as-is. Note that most clients' lawyers accept Apache-2.0 without review; the others may trigger questions.

---

## 8. Open scope: keeping "website" out of the core

**Core (`@kit/core-*`) may know about:** identities, roles and capabilities; configuration schema and D1-backed settings; the module contract (manifest, lifecycle, health, jobs); providers as interfaces (email sender, object store, secret probe) with Cloudflare implementations; the error registry; the UI kit as a *library of Preact components* with no pages. Core must not import Astro, must not define a route, a layout or a nav, and must not assume a browser, a domain or a "visitor".

**Modules own:** routes (Hono), pages (Astro, optional), tables and migrations, settings keys, jobs, provider needs (recipes), capabilities they introduce, docs. A module declares `surfaces: ["api", "ui", "jobs"]`; the composer only mounts what the client asks for.

**The thin client repo must contain, at minimum:** `kit.config.ts` (modules enabled, identity mode `access` or `own-account`, provider selection, settings overrides), `wrangler.toml` (bindings and generated `[secrets] required`), `src/index.ts` (one call that builds the Worker's handler object), `AGENTS.md`, the pointer files and the generated docs. Everything else is optional.

**Four shapes the same kit powers:**

| Shape | Modules | Handlers exported | UI |
|---|---|---|---|
| Admin portal (today's cf-admin) | users, sessions, email, backup, health | `fetch` (Astro SSR + Hono under `/api`), `scheduled`, `queue` | Preact islands |
| Internal tool with forms | users, sessions, a custom module | same | yes |
| Data pipeline console | health, jobs, a custom "pipeline" module; no sessions if behind Access | `fetch` (Hono only, JSON), `scheduled`, `queue` | optional tiny status page |
| Device fleet dashboard | health, a "fleet" module ingesting via `fetch` or Queues | `fetch`, `queue`, `scheduled` | yes |
| **Pure API or headless worker** | health, jobs, email | `scheduled`, `queue`, optionally `fetch` for `/healthz` only | **none**: the UI module is simply not enabled; Workers support `fetch`, `scheduled`, `queue`, `email`, `alarm`, `tail` and `connect` handlers independently \[41\] |

A headless client's `src/index.ts` exports the handlers the composer returns; because Hono "works on any JavaScript runtime" and Astro is an optional module, nothing in the dependency graph pulls a renderer into a headless build, and `size-limit` proves it \[103\]. The health module always exposes `/healthz` (RFC 9457 problems on failure) so the portal of another client, or a monitor, can read it. The System health → Setup page is itself a module, so a headless client gets the same checks through `kit doctor --json` and, in phase 2, the MCP server.

---

## 9. Decision cards for the owner

**Card 1: Where do the kit's packages live?**
- *A. Public npm under your own scope (recommended).* Anyone can read the code; nobody needs a password to install it; your phone-only operation never has to rotate tokens. You choose a licence that says what others may do with it.
- *B. GitHub Packages (private).* Nobody outside sees the code, but every laptop, every client's CI, every Cloudflare build and every AI sandbox needs a copy of a personal token that expires and belongs to one person; when GitHub is down nothing installs.
- *C. Copy the kit into every client repo.* Works even if every service is down, but each upgrade is a big manual merge and the repos drift apart.
- **Recommendation:** A, with C kept as an emergency command.

**Card 2: What licence goes on the public kit?**
- *A. Apache-2.0 (recommended).* Anyone may use it, including competitors; clients' lawyers accept it without discussion; contributions and forks are easy.
- *B. PolyForm Shield.* Anyone may use it except to compete with you; some clients' lawyers will ask questions; forks by others are unlikely.
- *C. Business Source License 1.1.* Production use needs your permission for up to four years, then it becomes open; the most protective, the most friction.
- **Recommendation:** A unless the kit itself becomes the product.

**Card 3: How much do we lean on one AI vendor's features?**
- *A. Portable only (recommended).* One `AGENTS.md`, Skills in the open format, checks in `pnpm verify` and CI; works the same in Claude Code, Codex, Cursor, Copilot, Gemini, Antigravity and whatever comes next.
- *B. Portable plus Claude and Cursor hooks.* Adds hard blocks (no edits to generated files, no bypassing verify) in the two tools that support them today; other tools rely on verify and CI.
- *C. Deep integration (repo MCP server, tool-specific plugins) from day one.* Most convenient for one tool, most to maintain, and premature until the manifests and doctor exist.
- **Recommendation:** B now, the MCP part of C in phase 2.

**Card 4: How strict is the quality gate for AI-written code?**
- *A. Standard gate (recommended).* Types, lint, boundaries, dead-code, tests in the Workers runtime, size budget, generated-docs check, secret scan; about two to three minutes; runs before every push and in CI.
- *B. Standard plus mutation testing.* Catches tests that assert nothing, at the cost of 10–30 minutes per run and a steady stream of noise to triage.
- *C. Lighter gate (types, lint, tests only).* Faster, but it is exactly the drift, duplication and invented-ID problems the current platform suffered from that it stops catching.
- **Recommendation:** A, with B considered later for the identity package only.

---

## Gaps and caveats

- **GAP:** no official Cursor statement on `.cursorrules` deprecation was retrieved; the official rules page positions `.cursor/rules` and `AGENTS.md` as the formats \[4\].
- **GAP:** AgentIF numbers come from a search summary of NeurIPS slides, not from the paper \[10\].
- **GAP:** expo-doctor's exit-code behaviour was not visible in the fetched source \[66\].
- **GAP:** Node's own release notes for 25.0.0 were read but do not list Corepack in "Notable Changes"; the removal of Corepack docs (2025-03-28) is confirmed, the "no longer shipped" claim rests on 2026 secondary guides \[74\]\[75\].
- **GAP:** hook support in Codex, Gemini CLI and Antigravity was not found in the pages read; treat hooks as Claude Code and Cursor only.
- Nx self-hosted cache "free but activation key" is from Nx docs surfaced in search results, not read directly \[90\].
- Adoption counts (AGENTS.md 60k projects, Skills 46 clients, llms.txt 36k sites) are the publishers' own figures.

---

## Sources (all read 2026-10-18)

1. <https://agents.md/>
2. <https://code.claude.com/docs/en/memory.md>
3. <https://developers.openai.com/codex/guides/agents-md>
4. <https://cursor.com/docs/context/rules>
5. <https://docs.github.com/en/copilot/reference/custom-instructions-support>
6. <https://geminicli.com/docs/cli/gemini-md/> (page last updated 2026-06-18)
7. <https://antigravity.google/docs/rules/>
8. <https://arxiv.org/abs/2503.06573> (WildIFEval, v2 2025-10-07)
9. <https://aclanthology.org/2025.findings-emnlp.896/> (ManyIFEval)
10. <https://neurips.cc/media/neurips-2025/Slides/121761_ZNf6mF5.pdf> (AgentIF, via search summary)
11. <https://code.claude.com/docs/en/hooks.md>
12. <https://agentskills.io/specification>
13. <https://agentskills.io/clients> and <https://github.com/agentskills/agentskills/blob/5d4c1fda/docs/snippets/clients.jsx>
14. <https://github.com/cloudflare/skills>
15. <https://developers.cloudflare.com/workers/wrangler/commands/> (global `--install-skills`, page updated 2026-04-23) and <https://developers.cloudflare.com/workers/wrangler/commands/workers/> (updated 2026-10-09)
16. <https://developers.cloudflare.com/changelog/post/2026-01-11-wrangler-types-check/>
17. <https://developers.cloudflare.com/workers/wrangler/commands/general/> (updated 2026-09-02; `whoami`, `login --device`, `--use-keyring`, `auth token`)
18. <https://developers.cloudflare.com/workers/wrangler/commands/workers/> (`secret list --format json`, via Cloudflare docs search)
19. <https://developers.cloudflare.com/workers/wrangler/commands/d1/> (updated 2026-04-23)
20. <https://developers.cloudflare.com/changelog/post/2026-07-31-wrangler-startup-profile-summary/>
21. <https://developers.cloudflare.com/workers/wrangler/configuration/> (`secrets.required`, via Cloudflare docs search)
22. <https://www.npmjs.com/package/eslint-plugin-boundaries> and <https://github.com/javierbrea/eslint-plugin-boundaries>
23. <https://www.npmjs.com/package/dependency-cruiser> and <https://github.com/sverweij/dependency-cruiser>
24. <https://www.npmjs.com/package/publint> and <https://publint.dev/docs/>
25. <https://www.npmjs.com/package/@arethetypeswrong/cli> and <https://github.com/arethetypeswrong/arethetypeswrong.github.io>
26. <https://www.npmjs.com/package/knip>
27. <https://www.npmjs.com/package/size-limit> and <https://github.com/ai/size-limit>
28. <https://www.npmjs.com/package/expect-type> and <https://github.com/mmkal/expect-type>
29. <https://www.npmjs.com/package/@cloudflare/vitest-plugin> and <https://developers.cloudflare.com/workers/testing/vitest-integration/> (updated 2026-08-20)
30. <https://developers.cloudflare.com/changelog/post/2026-08-19-vitest-plugin/> and <https://github.com/cloudflare/workers-sdk/releases/tag/@cloudflare/vitest-plugin@1.0.0>
31. <https://www.npmjs.com/package/lefthook> and <https://github.com/evilmartians/lefthook>
32. <https://github.com/gitleaks/gitleaks> and <https://github.com/gitleaks/gitleaks/releases> (v8.30.1, 2026-03-21)
33. <https://www.npmjs.com/package/@stryker-mutator/core>
34. <https://www.npmjs.com/package/turbo>
35. <https://turborepo.com/docs/core-concepts/remote-caching>
36. <https://nx.dev/pricing>
37. <https://moonrepo.dev/blog/moonbase-sunset> and <https://moonrepo.dev/docs/guides/remote-cache>
38. <https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry>
39. <https://npmjs.com/pricing> (via search summary: Teams $7/user/month, public free)
40. <https://docs.npmjs.com/trusted-publishers/>
41. <https://developers.cloudflare.com/workers/runtime-apis/handlers/> (updated 2026-04-23)
42. <https://openai.com/blog/agentic-ai-foundation> and <https://infoq.com/news/2025/12/agentic-ai-foundation/> (via search summary)
43. <https://cursor.com/docs/agent/hooks>
44. <https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions>
45. <https://antigravity.google/docs/commands/learn/> and <https://antigravity.google/docs/rules-workflows/> (12,000-character limit)
46. <https://www.skillsboard.sh/agent-skills-support> (46 entries on 2026-08-20)
47. <https://modelcontextprotocol.io/specification/latest> (page dated 2026-07-28)
48. <https://developers.cloudflare.com/agent-setup/>
49. <https://llmstxt.org/> (v2, updated 2026-08-10)
50. <https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/>
51. <https://www.rankability.com/data/llms-txt-adoption/>
52. <https://developers.cloudflare.com/agent-setup/opencode> (via search summary: `/index.md`, `/llms.txt`)
53. <https://turborepo.com/docs>
54. <https://aider.chat/docs/repomap.html>
55. <https://hono.dev/examples/zod-openapi>
56. <https://diataxis.fr/>
57. <https://adr.github.io/madr/>
58. <https://github.com/lycheeverse/lychee> and <https://github.com/lycheeverse/lychee/releases>
59. <https://www.npmjs.com/package/markdownlint-cli2>
60. <https://www.npmjs.com/package/@changesets/cli> and <https://github.com/changesets/changesets>
61. <https://blog.vercel.com/academy/production-monorepos/changesets-versioning.md> (via search summary)
62. <https://github.com/betterleaks/betterleaks> and <https://github.com/betterleaks/betterleaks/releases>
63. <https://github.com/Homebrew/brew/blob/main/Library/Homebrew/cmd/doctor.rb> and <https://docs.brew.sh/Troubleshooting>
64. <https://raw.githubusercontent.com/flutter/flutter/master/packages/flutter_tools/lib/src/doctor.dart>
65. <https://github.com/expo/expo/tree/main/packages/expo-doctor/src/checks>
66. <https://github.com/expo/expo/blob/main/packages/expo-doctor/src/doctor.ts> and <https://github.com/expo/expo/blob/main/packages/expo-doctor/README.md>
67. <https://github.com/nrwl/nx/blob/master/packages/nx/src/command-line/report/report.ts>
68. <https://github.com/rails/rails/blob/main/railties/lib/rails/generators/rails/app/templates/bin/setup.tt>
69. <https://supabase.com/docs/reference/cli/supabase-status>
70. <https://developers.cloudflare.com/workers/wrangler/commands/workers/> (`deploy --dry-run`)
71. <https://pnpm.io/settings/cli> (`engineStrict`, `pmOnFail`, `nodeVersion`)
72. <https://pnpm.io/cli/add> (`pnpm add node@tool:22`, pnpm 12)
73. <https://github.com/pnpm/pnpm/commit/cee550a57d24c45d8c9de07bae63932f80505697> (2026-04-16) and <https://pnpm.io/migration>
74. <https://github.com/nodejs/node/commit/fa834896c8> (2025-03-28, "doc: remove Corepack documentation")
75. <https://nodejs.org/en/blog/release/v25.0.0> (2025-10-15) and <https://blog.openreplay.com/manage-package-managers-node-corepack/> (secondary)
76. <https://developers.cloudflare.com/workers/wrangler/profiles/>
77. <https://developers.cloudflare.com/fundamentals/api/reference/permissions/> ("Access: Apps Read")
78. <https://developers.cloudflare.com/workers/configuration/cloudflare-access/> (updated 2026-10-12)
79. <https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/>
80. <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/> (updated 2026-09-29)
81. <https://www.rfc-editor.org/rfc/rfc9457.html>
82. <https://www.typescriptlang.org/docs/handbook/project-references.html>
83. <https://knip.dev/>
84. <https://stryker-mutator.io/docs/>
85. <https://github.com/evilmartians/lefthook> (v2.2.2)
86. <https://www.npmjs.com/package/@commitlint/cli>
87. <https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection>
88. <https://computingforgeeks.com/self-hosted-turborepo-remote-cache/> (third party; ducktors/turborepo-remote-cache)
89. <https://www.npmjs.com/package/nx>
90. <https://nx.dev/recipes/running-tasks/self-hosted-caching> (via search summary)
91. <https://www.npmjs.com/package/@moonrepo/cli>
92. <https://moonrepo.dev/blog/moon-v1.30> and <https://moonrepo.dev/blog/moon-v1.32> (via search summary)
93. <https://www.npmjs.com/package/pnpm>
94. <https://pnpm.io/catalogs>
95. <https://developers.cloudflare.com/workers/ci-cd/builds/configuration/> (updated 2026-09-22)
96. <https://developers.cloudflare.com/pages/how-to/npm-private-registry/> (updated 2026-09-04)
97. <https://jsr.io/docs/private-registries>
98. <https://jsr.io/docs/npm-compatibility> (via search summary)
99. <https://pnpm.io/package-sources>
100. <https://pnpm.io/blog/whats-different-in-pnpm-12>
101. <https://mariadb.com/bsl11/>
102. <https://polyformproject.org/licenses/>
103. <https://www.npmjs.com/package/hono> (4.13.13) and <https://www.npmjs.com/package/astro> (7.4.0)

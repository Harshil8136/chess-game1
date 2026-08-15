---

title: "Documentation Conventions & Governance"
status: active
audience: [ai, technical]
last_verified: 2026-08-13
verified_against: [code]
owner: harshil
related_docs: [README.md,_templates/doc-template.md,commercial/MODULE-PRICING-CATALOG.md]
tags: [meta, governance, conventions]
---

# Documentation Conventions & Governance

> **TL;DR (non-technical):** This page is the rulebook for the project's docs. It
> explains where each kind of document lives, how to name it, and what header
> every doc must carry so that humans and AI tools can find and trust it.

## 1. One docs root

All documentation lives under **`documentation/`**. The legacy `docs/` tree has
been removed and must not be recreated. (It re-accumulated 4 working-plan files
between the original removal and 2026-08-12; re-verified and re-removed on that
date — the still-relevant one was moved into
[`reference/control-plane-design/VISUAL-OVERHAUL-PLAN.md`](reference/control-plane-design/VISUAL-OVERHAUL-PLAN.md)
and indexed below, the other three had already shipped and were deleted. If
`docs/` reappears again, apply the same triage: move what's still open into
`documentation/` with front-matter and an index entry, delete what's done.)
The only Markdown files that stay at the repository root are entry/discoverability files:

| Root file | Why it stays at root |
|-----------|----------------------|
| `README.md` | Repo entry point (humans + AI IDEs look here first) |
| `RULESAd.md` | Operational Rules Bible + policy contract; the public-docs sync workflow targets this exact path |
| `main.md` | AI entry pointer into `documentation/` |
| `AI_CODE_MAINTENANCE.md` | AI-agent maintenance rules (referenced by `RULESAd.md`) |

> **`GITHUB_RULES.md` is not one of them — corrected 2026-08-13.** This table
> listed it as a cf-admin root file. It actually lives one level up, at the
> **monorepo** root (`../GITHUB_RULES.md`), because its rules govern every repo
> in the workspace, not just this one. The stray local copy was deleted on
> 2026-08-12 and `RULESAd.md` §12 links to `../GITHUB_RULES.md`. It stays in
> `docs_check.py`'s `ROOT_EXEMPT` set only so that a future local copy would not
> trip the front-matter rule.

## 2. Folder map

| Folder | Holds |
|--------|-------|
| `documentation/architecture/` | System architecture, request lifecycle, PLAC/audit internals, KV resilience |
| `documentation/security/` | Current security posture, privacy, login forensics |
| `documentation/security/reviews/` | Dated, point-in-time security audit snapshots (historical) |
| `documentation/features/` | Per-feature docs (dashboard, users, CMS, chatbot, control-plane) |
| `documentation/commercial/` | Cross-repo pricing/commercial reference docs (module catalog, buy-vs-build, billing model) — evergreen, not dated, since they're maintained as pricing/research evolves. Dated point-in-time commercial *analyses* (e.g. `2026-07-26-commercial-model-costing-pricing-and-scale.md`) stay at the `documentation/` root per §3's specs/reviews rule; this folder is for the living reference material that supersedes/extends them |
| `documentation/operations/` | Binding IDs, limits, secrets registry, deploy, dev tools |
| `documentation/reference/` | Coding standards, design system, deep design docs |
| `documentation/specs/` | Dated design specs (append-only) |
| `documentation/runbooks/` | Operational error playbooks |
| `documentation/archive/` | Superseded status/tracking docs, kept verbatim |
| `documentation/_templates/` | The canonical doc template |

## 3. File naming

- **Evergreen topic docs:** `UPPER-KEBAB.md` (e.g. `USER-MANAGEMENT.md`, `SECURITY.md`).
- **Specs & reviews:** `YYYY-MM-DD-slug.md`. Use the file's **git first-commit
  date** (`git log --diff-filter=A --format=%ad --date=short -- <file>`), not the
  date you happen to be editing.
- **No spaces**, no mixed casing within a category, no Windows-style paths in content.

## 4. Required front-matter

Every non-archive doc starts with the YAML block from
[`_templates/doc-template.md`](_templates/doc-template.md):

```yaml
---
title: <Human title>
status: active            # active | historical | draft | deprecated
audience: [ai, technical] # add 'operator'/'non-technical' only where relevant
last_verified: YYYY-MM-DD # bump whenever claims are re-checked vs code/infra
verified_against: [code, infra]
owner: harshil            # redacted to [DEVELOPER_EMAIL] by the public-docs sync
related_code: [src/...]   # source paths this doc describes
related_docs: [...]       # repo-relative, case-exact links
tags: [...]
---
```

`status: historical` is used for archived/dated snapshots; `last_verified` is not
enforced on those.

## 5. Cross-references

- Links between docs are **repo-relative** and **case-exact** (the filesystem and
  CI are case-sensitive — `coding-standards.md` ≠ `CODING-STANDARDS.md`).
- Mirror important links in the `related_docs` front-matter for machine parsing.

## 6. Secrets & PII

- Never put secret **values** (tokens, keys, connection strings) in any doc —
  names only. The public-docs sync redacts developer email PII but does **not**
  scrub secrets; treat every doc as potentially public.
- **"Potentially public" is literal.** `sync-docs.yml` copies *every* `.md` under
  `documentation/` to a public repo on each push to `main`, and its secret scan
  is **warning-only** with patterns that only match token shapes — a bare
  hostname or endpoint sails through. A live Upstash endpoint sat in
  `reference/control-plane-design/PLAN.md` for exactly that reason.

## 7. Adding or moving a doc

1. Start from `_templates/doc-template.md`.
2. Place it in the correct folder (§2) with a conforming name (§3).
3. Add an entry to the index in [`README.md`](README.md) — CI fails if a doc is
   missing from the index (index-drift check).
4. Use `git mv` when relocating so history is preserved.

## 8. What `docs_check.py` enforces

Structure was never the problem — a doc can be perfectly well-formed and still
wrong. These checks were added on 2026-08-13 after a pass found ~29 contradictions
between documents that were all `status: active` and all passing CI.

| Check | Level | What it means for you |
|---|---|---|
| Front-matter, links, index drift | blocking | Unchanged. |
| **Staleness** | blocking | An `active` doc older than **45 days** fails. `active` is a promise that the claims were re-checked — if you cannot re-check them, set `status: historical` instead. |
| **Code paths** | blocking | Backticked `src/…`, `migrations/…`, `scripts/…` references must resolve. This is where dead references actually hide; the link check never saw them. |
| **Mojibake** | blocking | Double-encoded UTF-8. The sync workflow runs `ftfy` on the *published copy* only, so the source could stay corrupt indefinitely. |
| **Batch stamps** | warning | Many docs sharing one `last_verified` — the signature of a date applied rather than earned. |

Three escape hatches exist. Each is visible in the source so it can be reviewed:

- `<!-- docs-check: stale-exempt -->` — for a doc that makes no claim needing
  re-verification (the front-matter template). Not for a doc you'd rather not update.
- `<!-- docs-check: proposed-paths -->` — for a **design or plan** document whose
  file references are proposals. Never put this in a doc describing behaviour.
- An **absence cue on the same line** (or within the preceding few lines) —
  "deleted", "removed", "no longer", "proposed", "→", and similar. Naming a file
  in order to say it was deleted or moved is good documentation, and the check
  is built to allow it rather than push you into erasing history.

Migration references may use numeric shorthand (`migrations/0037`); the check
resolves it against the directory. Note that `migrations/` and
`database/legacy_migrations/` are **separate series overlapping on 19 numbers**,
so always give the directory too — see `operations/OPERATIONS.md` §7.

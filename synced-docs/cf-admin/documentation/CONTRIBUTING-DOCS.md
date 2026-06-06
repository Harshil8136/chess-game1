---
title: "Documentation Conventions & Governance"
status: active
audience: [ai, technical]
last_verified: 2026-06-06
verified_against: [code]
owner: harshil
related_docs: [README.md, _templates/doc-template.md]
tags: [meta, governance, conventions]
---

# Documentation Conventions & Governance

> **TL;DR (non-technical):** This page is the rulebook for the project's docs. It
> explains where each kind of document lives, how to name it, and what header
> every doc must carry so that humans and AI tools can find and trust it.

## 1. One docs root

All documentation lives under **`documentation/`**. The legacy `docs/` tree has
been removed and must not be recreated. The only Markdown files that stay at the
repository root are entry/discoverability files:

| Root file | Why it stays at root |
|-----------|----------------------|
| `README.md` | Repo entry point (humans + AI IDEs look here first) |
| `RULESAd.md` | Operational Rules Bible + policy contract; the public-docs sync workflow targets this exact path |
| `main.md` | AI entry pointer into `documentation/` |
| `AI_CODE_MAINTENANCE.md` | AI-agent maintenance rules (referenced by `RULESAd.md`) |
| `GITHUB_RULES.md` | Git workflow rules (referenced by `RULESAd.md` §12) |

## 2. Folder map

| Folder | Holds |
|--------|-------|
| `documentation/architecture/` | System architecture, request lifecycle, PLAC/audit internals, KV resilience |
| `documentation/security/` | Current security posture, privacy, login forensics |
| `documentation/security/reviews/` | Dated, point-in-time security audit snapshots (historical) |
| `documentation/features/` | Per-feature docs (dashboard, users, CMS, chatbot, control-plane) |
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

## 7. Adding or moving a doc

1. Start from `_templates/doc-template.md`.
2. Place it in the correct folder (§2) with a conforming name (§3).
3. Add an entry to the index in [`README.md`](README.md) — CI fails if a doc is
   missing from the index (index-drift check).
4. Use `git mv` when relocating so history is preserved.

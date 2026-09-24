---

title: "Documentation Conventions & Governance"
status: active
audience: [ai, technical]
last_verified: 2026-09-19
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

> **Enforced since 2026-09-19.** `docs_check.py` now fails when a `.md` appears
> at the repository root that is not in this table. It was a convention with
> nothing behind it, and a fifth root doc (`cron-visual-redesign.md`, moved to
> `specs/2026-09-16-cron-dashboard-visual-redesign.md` on 2026-09-19) sat there
> unnoticed, with no front-matter and no index entry.

> **There is no fifth root file — corrected 2026-08-23.** This table once listed
> a git-rules file as a cf-admin root doc. It never lived here: it sat at the
> **monorepo** root, and this repo is now standalone, so every reference to it
> was a link that could not resolve. The rules still in force — verify the
> working directory before pushing, push directly to `origin main`, and never
> invent a binding UUID — now live in `RULESAd.md` §12 "Git & deployment
> protocol", which is the authority those docs cite. Do not reintroduce a
> pointer to a file outside this repository.

## 2. Folder map

**Living documentation vs records (2026-09-19).** A *living* document describes
the system as it is now and is kept true: architecture, security, features,
operations, reference, runbooks. A *record* is a dated snapshot of a moment —
a review, a work report, a design spec, a chunk record — and is frozen once
written. A record is superseded by a newer record or by a living document; it is
never edited to match today, and its `status` is `historical`. Records live in
`records/`, `specs/`, `security/reviews/`, `operations/incidents/` and
`program/chunks/`, never at the `documentation/` root.

| Folder | Holds |
|--------|-------|
| `documentation/architecture/` | System architecture, request lifecycle, PLAC/audit internals, KV resilience |
| `documentation/security/` | Current security posture, privacy, login forensics |
| `documentation/security/reviews/` | Dated, point-in-time security audit snapshots (historical) |
| `documentation/security/compliance/` | Framework statements a buyer or auditor reads (ASVS, SOC 2, CAIQ, ISO, accessibility, AI governance, data residency) |
| `documentation/records/reviews/` | Dated technical/compliance reviews. **Not published** |
| `documentation/records/reports/` | Dated work and session reports — what a pass changed, and what it found. **Not published** |
| `documentation/commercial/` | Evergreen commercial reference (module pricing, buy-vs-build, billing model). **Not published** |
| `documentation/commercial/analyses/` | Dated commercial analyses (cost model, GTM, viability). **Not published** |
| `documentation/operations/incidents/` | Dated incident post-mortems |
| `documentation/features/` | Per-feature docs (dashboard, users, CMS, chatbot, control-plane) |
| `documentation/operations/` | Binding IDs, limits, secrets registry, deploy, dev tools |
| `documentation/program/` | The long-term viability program (started 2026-09-02): the evergreen roadmap and debt registry, a chunk-record template, dated chunk records under `program/chunks/`, decision records under `program/adr/`, executable task plans under `program/plans/` (added to this map 2026-09-14; the folder dates from 2026-09-10), and dated per-target assessment records under `program/assessments/` (the written case for a feature or service, produced before its first chunk — see ADR-0002). Chunk and assessment records follow §3's dated naming and move `draft` → `active` → `historical` as they ship (see `program/CHUNK-TEMPLATE.md`). Excluded from the public docs mirror by decision ADR-0001, except `program/cf-backup/` (the cf-backup plan of record, named `program/cf-backend/` until it was re-scoped the same day), which the owner carved back in on 2026-09-22 — see `SYNC_INCLUDE_PREFIXES` in `sync-docs.yml`. Anything added under `program/cf-backup/` is public from its next sync |
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

**Every** `.md` under `documentation/` starts with the YAML block from
[`_templates/doc-template.md`](_templates/doc-template.md) — archive included.
*Corrected 2026-09-19: this said "every non-archive doc". `docs_check.py`'s
front-matter check has always covered `archive/` too, so a doc written to the
old wording turned the local `verify` gate red.*

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
- **"Potentially public" is literal.** `sync-docs.yml` copies the *living*
  documentation under `documentation/` to a public repo on each push to `main`,
  and its secret scan is **warning-only** with patterns that only match token
  shapes — a bare hostname or endpoint sails through. A live Upstash endpoint sat
  in `archive/control-plane-design/PLAN.md` for exactly that reason.
- **What is not published** (`SYNC_EXCLUDE_PREFIXES`, set 2026-09-19): `program/`,
  `records/`, `commercial/`, `MAINTENANCE.md`, the access-revocation design and
  plan, `runbooks/supabase-account-advisor-sweep.md`,
  `reference/commercial-readiness-checklist.md` and `reference/RBAC-AT-SCALE.md`.
  The rule behind the list: publish how the system works, not the list of what is
  wrong with it, and not what it costs to run or sell.
- **Publishing cannot be undone.** The public repo keeps its git history, so a
  value that shipped in an earlier sync stays reachable after the source is
  redacted. Treat an accidental publish as a rotation, not an edit.

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

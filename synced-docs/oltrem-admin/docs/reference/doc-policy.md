---
title: "How documents are written and sized"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [scripts/lib/doc-budget.mjs; scripts/lib/docs.mjs; docs-budget.json; rules.md R-07]
---

# How documents are written and sized

> **In plain words.** Every document is short enough for an agent to read whole and says only
> what is true now. History lives in the records, outside `docs/`. The docs gate holds the sizes,
> so the documents stay light however many changes land.

## The sizes (enforced by `pnpm docs:check`)

| What | Cap | Where the number lives |
|---|---|---|
| `ai.md`, read every session | 8 KB | `scripts/lib/agents.mjs` |
| A living document: anything in `docs/`, a README, a skill, an agent | 16 KB | `docs-budget.json` `perDoc` |
| All living documents together | the sum + 32 KB of room | `docs-budget.json` `total` |
| A dated record (`archive/records/`, after 2026-11-26) | 4 KB | `scripts/lib/docs.mjs` |

A document still over 16 KB holds an allowance in `docs-budget.json`: its size, rounded up, plus
1 KB. An allowance only comes down. After trimming, run `pnpm docs:lower`, which lowers every
allowance and the total, and never raises one. Raising a number needs the owner's yes.

Not living documents: `archive/` (the records and old proposals), `vendor/mail/published/` (a
copy of Oltrem Mail's documents), `.agents/` (generated copies of `.claude/`) and `.changeset/`.
Search tools skip all but `.changeset/` (`.ignore`).

The phone-test lists name each test's source once, as a "From" line over its rows, not in a
column on every row.

## The shape

- Front matter, a title, then a summary of three lines at most.
- A contents list once the document passes about 100 lines.
- Tables and short bullets before paragraphs. One idea per line.
- One fact, one home: link to the document that owns it instead of repeating it.
- Current truth only. No "since 2026-…", "used to", "now" or the story of a fix: the record holds
  that, and the living document links it at most once.
- Over the cap: split by section into documents one level down, each linked from the parent.
  Never squeeze the prose until it is hard to read.

## A record

A record is history, written once and frozen: what changed, why, before and after, how it was
checked, and what was not. That **Checked.** line and the commit message are the only log of
verification. The template is at the top of [the records' index](../../archive/records/README.md).
Detail (routes, tables, numbers) goes in the living document that owns it.

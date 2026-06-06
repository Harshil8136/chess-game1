---
title: "Documentation Template"
status: active
audience: [ai, technical]
last_verified: 2026-06-06
verified_against: [code]
owner: harshil
related_docs: [../CONTRIBUTING-DOCS.md]
tags: [meta, template]
---

# <Document Title>

> **TL;DR (non-technical):** Two to four plain-language sentences describing what
> this document covers and why it matters. This is the only "soft" block in an
> otherwise technical document — keep it jargon-free.

## Context / Scope

What this document covers, and what it deliberately does **not** cover.

## Architecture / How it works

Precise, code-referenced explanation. Reference exact files, functions, and
Cloudflare bindings (e.g. `src/middleware.ts`, the `SESSION` KV binding).

## Key code paths

A bulleted map of doc-claim → source location:

- `<claim>` → `src/path/file.ts:functionName`

## Configuration / Bindings

Environment variables, Cloudflare bindings, and secret **names only** — never
secret values, tokens, or keys.

## Operational notes / Runbook

Failure modes, recovery steps, cron behaviour, gotchas.

## Verification log

| Date       | Checked by | Method                        | Result                 |
|------------|-----------|-------------------------------|------------------------|
| 2026-06-06 | claude    | code read / live MCP check    | <pass / needs-review>  |

## Related

Cross-links to related docs (mirror these in the `related_docs` front-matter so
agents can parse them).

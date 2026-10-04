---
title: "Documentation Conventions"
status: active
audience: [ai, technical]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_code: [scripts/docs-mirror.mjs, .github/workflows/sync-docs.yml, test/docs-mirror.test.ts]
related_docs: [README.md, _templates/doc-template.md]
tags: [meta, governance, conventions]
---

# Documentation Conventions

> **TL;DR (non-technical):** This page is the rulebook for the project's docs: where each
> kind of document lives, what header it carries, and which ones are copied to the public
> docs mirror. It is modelled on cf-admin's rulebook, in a shorter form.

## 1. One docs root

All documentation lives under `documentation/`. The old `docs/` folder was moved here on
2026-10-01 and must not come back. Only entry files stay at the repository root:

| Root file | Why it stays |
|---|---|
| `README.md` | Repo entry point; points at `documentation/README.md` |
| `main.md` | The contract for every AI agent and contributor: session start, the Golden Rules, what to read, which document to update |
| `CLAUDE.md` | Loads `main.md` in Claude Code |

## 2. Folder map

A **living** document describes the system as it is now and is kept true. A **record** is a
dated snapshot (a plan that was executed, a ruling, a superseded draft). Records are frozen
and never edited to match today; their status is `historical`.

| Folder | Holds | Kind | Published |
|---|---|---|---|
| `architecture/` | How the parts fit and where trust changes | living | yes |
| `security/` | Permissions and the audit pipeline | living | yes |
| `features/` | One document per feature (console, actions, log storage) | living | yes |
| `operations/` | Deploy and host modules (public); owner setup (private) | living | partly |
| `reference/` | Lookup tables, such as the agent route table | living | yes |
| `runbooks/` | What to do when something breaks | living | no |
| `program/` | Current status and what to resume (`HANDOFF.md`) | living | no |
| `specs/` | Dated design specs; `active` while it is the plan of record | spec | no |
| `records/` | Dated, frozen records, with executed plans in `records/plans/`, incident reports in `records/incidents/`, and a change record for every big change (`main.md` §4, from 2026-10-04) | record | no |
| `_templates/` | The doc template and the change-record template | meta | no |

The rule behind "published": publish how the system works, not the state of it. Runbooks,
owner steps and the handoff carry operational identifiers, so they stay private.

## 3. File naming

- Evergreen docs: `UPPER-KEBAB.md` (`OVERVIEW.md`, `API-ROUTES.md`).
- Specs, plans and records: `YYYY-MM-DD-slug.md`, dated by the day the file was first committed.
- No spaces, no Windows paths in content.

## 4. Front-matter

Every `.md` under `documentation/` starts with the block from
[`_templates/doc-template.md`](_templates/doc-template.md). Required for living docs and
specs: `title`, `status`, `last_verified`. Records may carry a minimal header
(`status: historical`).

| Field | Meaning |
|---|---|
| `status` | `active`, `historical`, `draft` or `deprecated` |
| `last_verified` | The day the claims were last checked against code. Bump it only when you re-check. |
| `verified_against` | What was checked: `code`, `infra`, `owner-approval` |
| `related_code` | Source paths the doc describes |
| `related_docs` | Repo-relative, case-exact links |

Files moved here on 2026-10-01 from `docs/` carry their last commit date as `last_verified`.
That date says when they last changed, not that they were re-checked.

## 5. Writing rules

- Plain English first: a TL;DR for non-technical readers, then precise detail.
- One fact, one home. Link to the doc that owns a fact instead of restating it.
- Names of secrets only, never values. Capability, action and route ids are code names and are fine.
- Links are repo-relative and case-exact. Add `related_docs` for machine readers.

## 6. Published docs (the public mirror)

`scripts/docs-mirror.mjs` holds `PUBLISHED_DOCS`, the allow-list. Deny by default: a new doc
is private until it is added there, in a reviewed commit. The mirror's git history keeps
every copy, so a leak is a rotation, not an edit.

Published docs must contain **no** hostnames, IP addresses, account or resource ids, emails,
key fingerprints or tokens. Say "the server", "the tunnel", "the R2 audit bucket", "the
loopback address". `node scripts/docs-mirror.mjs check` fails closed on these shapes:

- UUIDs and 32- or 64-character hex ids
- email addresses (except `example.*` and no-reply addresses)
- IPv4 addresses, and hostnames under the business domain or the Access domain
- worker, R2, Sentry and Supabase host names; connection strings with passwords
- private key blocks, JWTs, GitHub, Slack, AWS and `sk-` keys, bearer tokens, SSH key fingerprints

The check names the file, line and kind of match, never the matched text.

`.github/workflows/sync-docs.yml` runs `check`, then `stage`, then copies the staged tree to
the public mirror under `synced-docs/cf-vps` on a push to `main` that touches a published doc.
Only the publish step sees the `PERSONAL_PAT` secret. To publish a doc: add it to
`PUBLISHED_DOCS` and to `on.push.paths` in the workflow (`test/docs-mirror.test.ts` fails
until the two match).

## 7. Adding or moving a doc

1. Copy `_templates/doc-template.md` and fill the header; a big change's dated record starts
   from `_templates/change-record.md` instead.
2. Put it in the right folder (section 2) with a conforming name (section 3).
3. Add one line to [`README.md`](README.md). A test fails if a living doc is not linked there.
4. Use `git mv` when relocating, and fix every old path.

## 8. What the tests enforce

`test/docs-mirror.test.ts` checks that: the workflow's push paths equal `PUBLISHED_DOCS` plus
the script; every published file exists and passes `check`; every doc outside `records/` and
`_templates/` has `title`, `status` and `last_verified`; and `README.md` links every living doc.
It does not check that a claim is true. That is what `last_verified` is for.

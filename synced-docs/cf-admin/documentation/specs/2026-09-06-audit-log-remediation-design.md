---

title: "Audit & Activity Log — Remediation and Hardening Design"
status: draft
audience: [ai, technical, owner, operator]
last_verified: 2026-09-06
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/audit.ts, src/lib/audit-helpers.ts, src/lib/dal/AuditLogRepository.ts, src/lib/auth/decide-access.ts]
related_docs: [../architecture/plac-and-audit.md, ../MAINTENANCE.md, ../program/ROADMAP.md, ../operations/OPERATIONS.md]
tags: [audit, logging, security, design]
---

<!-- docs-check: proposed-paths -->
<!-- This is a design record. It names files that later stages will create;
     the code-path check is opted out here and enforced on each stage's own
     record once that stage ships. -->

# Audit & Activity Log — Remediation and Hardening Design

> **TL;DR (non-technical):** The portal keeps a log of who changed what. A review
> on 2026-09-06 found fourteen problems with it: some actions are never recorded,
> the log can be deleted, an export of it is untracked, and a new "hide passwords"
> feature prints the hidden value in the panel right beside it. This document is
> the agreed plan to fix all of that, in three stages, smallest risk first.

## Context and scope

This design closes the findings from the 2026-09-06 audit of the audit/activity
log subsystem. It covers the Ghost Audit Engine, the `/api/audit/*` routes, the
`admin_audit_log` read paths, and the logs UI.

It deliberately does **not** cover: the unified cross-source event feed, the
structured operational logger (roadmap chunk 17), or audit-log tamper-evidence
(chunk 19). Those were considered and declined for this pass.

## Evidence the design is built on

Queried live against `madagascar-db` on 2026-09-06 (`wrangler d1 execute --remote`):

| Fact | Value |
|---|---|
| `admin_audit_log` rows, total | 26 |
| Oldest / newest row | 2026-09-01 02:27:31 / 2026-09-06 04:37:50 |
| Rows in the last 24 h | 6 |
| Rows that are the pipeline's own `api_mutation_attempt` | 13 of 26 |
| Rows with `session_id IS NULL` | 8 of 26 (31 %) |
| Rows with `details IS NULL` | 0 |
| Largest `details` payload | 26,104 bytes |
| Rows for `export`, `login`, `role_change` | 0 |

The log begins on 2026-09-01 because of a single event recorded in it: at
`2026-09-01 02:27:31` the owner account bulk-deleted **40 rows** through
`DELETE /api/audit/logs`. The snapshot of those rows was retained (26,104 bytes,
valid JSON), so the evidence mechanism worked at that size. The oldest surviving
row is the record of its own deletion.

Two consequences for this design:

1. **Index write amplification is not a problem and is not addressed here.** At
   ~6 writes/day, the seven indexes on `admin_audit_log` cost roughly 48 row
   writes a day against a 100,000/day free-tier budget. A finding was raised and
   is closed by measurement.
2. **Deletion is not hypothetical.** The append-only decision below is a response
   to an event that already happened in production, not a precaution.

## Decisions taken

| Decision | Answer |
|---|---|
| Vehicle | Staged. Not a single chunk; see "Stages" below |
| Deletion policy | Append-only, plus one gated erasure path |
| "Logging wide" | Coverage only — nothing mutating goes unlogged |
| Visual scope | Finish and harden the in-flight detail panel |
| Coverage enforcement | Sweep, then a CI grep guard (`SEC-12`) |
| Redaction location | One chokepoint in `buildAuditDetails` |

Rejected: enforcing audit writes in the auth pipeline (puts D1 writes on the hot
path, reopens the pipeline chunk 10 stabilised); enforcing at the DAL type level
(~180 call sites, and chunk 12 rebuilds that boundary anyway).

## Stages

Ordering is set by the working tree, not by severity. 32 uncommitted files touch
`logs.ts`, `audit-helpers.ts` and nine mutation routes; a security pass written
first would conflict with all of them, and two blocking defects live inside that
work.

- **Stage 1 — harden and land the in-flight detail-panel work.**
- **Stage 2 — the security and correctness pass, on top of it.**
- **Stage 3 — deferred to chunk 13.2**, once chunks 11 and 12 land the API
  baseplate and DAL v2 that per-route migration depends on (ADR-0002 lane).

Each stage is its own push, with `npm run verify` green locally, the Workers
Builds run green, and Sentry clean for 24 h before the next stage starts.

## Design

### 1. Engine core

`auditLog()` and `createAuditLogger()` collapse onto one internal
`writeAuditRow()`. Both public signatures are preserved, so none of the ~180 call
sites change; they become thin wrappers over the shared body.

The v1 INSERT fallback is deleted. It triggers on
`err.message.includes('has no column')` and silently drops `session_id`,
`request_method`, `request_path`, `cf_ray_id` and `correlation_id`. The live
schema carries every v2 column, so the branch is unreachable, and its only
possible behaviour is quiet data loss. Schema drift is already caught by
`node scripts/d1_schema_snapshot.mjs --check` in the release path.

`getSafeDetails()`'s 500,000-character truncation is replaced by a structured
overflow envelope. Today it appends `... [TRUNCATED]` to a JSON string and
produces something that no longer parses; the replacement emits a valid document
recording that truncation occurred and what was omitted. **Invariant: the engine
never writes a `details` value that is not parseable JSON.**

The session cookie name is single-sourced. `src/lib/auth/session.ts` decides it
from `import.meta.env.PROD`; `audit-helpers.ts` independently decides it from
`url.protocol === 'https:'`. They disagree for a production build served over
http, which is `wrangler dev` / `npm run cf:dev`, and 31 % of production rows
currently have no `session_id`. The name is exported from `session.ts` and
imported; the protocol sniff is deleted.

### 2. Redaction, at one chokepoint

Redaction moves out of `computeDiff()` and into `buildAuditDetails()` — the only
function that sees `diff` and `context` together.

This is the fix for the most serious in-flight defect. `control-plane/config.ts`
redacts old/new inside `diff` and then writes the same values unredacted into
`context: { old, new }`; `settings/portal.ts` does the same with `setting_value`;
and the detail modal renders `context` as a raw `JSON.stringify` dump directly
beside the masked field. The mask is cosmetic. Moving redaction up one level
makes the contradiction structurally impossible rather than a rule to remember.

Matching changes from substring to word-boundary, with an explicit
`redact: ['key']` opt-in at the call site. The current pattern matches `author`,
`author_name`, `is_authorized`, `auth_method` and `hashtag` — `author` is a real
`blog_posts` column. `computeDiff`'s overloaded third parameter (labels-or-options,
disambiguated by sniffing for key names) collapses to a single options object;
`label` stops being stored when identical to `field`; `created_at` becomes an
opt-out rather than an unconditional drop.

Tests gain the assertion the current suite lacks: a benign field survives
redaction.

### 3. Coverage, made CI-blocking

> **Partially shipped 2026-09-08 (`d7d3dc6`), ahead of the rest of Stage 2.**
> `api/audit/export.ts` now writes an `'export'` row recording actor, source and
> row count, and finding 2 is closed for all three export routes: escaping moved
> to one chokepoint, `src/lib/csv.ts`, which neutralises a leading `=`, `+`, `-`,
> `@`, tab or CR before quoting. `SEC-12`, `seo/settings.ts` and the rest of the
> coverage work below remain open — this was two self-contained security defects
> taken early, not the start of Stage 2.

Audit writes are added to the CSV export (giving the declared `'export'` action
its first writer, recording row count and active filters), to `seo/settings.ts`
(which mutates settings today while its two siblings audit the identical action),
and to the remaining genuinely-unaudited mutating routes. That list is not
enumerated here on purpose: Stage 2 begins by landing `SEC-12` in `--warn-only`
mode and taking its output as the definitive list, because a hand-maintained list
in a design document is exactly the artifact that goes stale. The audit found 26
candidates, of which the AI routes and `users/cf-resync.ts` are already known to
be false positives.

The `AuditAction` union is reconciled against reality. `role_change` gains a real
writer where a role actually changes — role changes are currently recorded as
`update`, while the UI offers a `role_change` filter that can only ever return
nothing. `api_read` is removed. `login` is also removed from the union, and the
asymmetry it exposes is resolved by decision rather than by symmetry:
authentication events belong to `admin_login_logs`, which already carries the
richer forensic schema, while `logout` stays in `admin_audit_log` because it is an
action an operator takes inside the portal rather than an edge authentication
event. Both surfaces cross-reference each other so a reader is never left
wondering where sign-ins went.

`SEC-12` is added to `scripts/rules_check.py`: a route exporting
`POST`/`PUT`/`PATCH`/`DELETE` must contain an audit write. Exemptions are named
only for genuine indirect cases — the AI routes that audit through
`src/lib/ai/telemetry.ts`, and `users/cf-resync.ts` which writes to
`cf_access_sync_log`. Per RULESAd §9.0, each exemption ships with a negative test
proving the rule still fails without it.

### 4. Deletion becomes append-only

`DELETE /api/audit/logs`, the `admin_audit_log` paths of `delete-targeted.ts`,
and `prune.ts` cease to be interactive endpoints. Rows leave two ways:

- **Retention** — age-based, through the existing Retention Review tool, where
  `admin_audit_log` is already registered.
- **Erasure** — one endpoint requiring a linked `legal_requests`/ARCO request id,
  which writes a complete manifest to R2 before deleting anything, then records an
  audit row referencing the manifest key.

Writing the manifest to R2 rather than into `details` removes the truncation
problem from the evidence path entirely. It needs no new table (RULE #0.9) and no
new environment variable (RULE #0.8).

This replaces three inconsistent evidence policies: a full snapshot that silently
becomes invalid JSON above 500 KB, a `snapshotSample` of the first 10 rows, and
`prune.ts`, which retains nothing and discards `res.meta.changes` so its own audit
row cannot even say how many rows it removed.

`TargetedDeleteModal.tsx` becomes the erasure request form. MAINTENANCE item #13
closes with the decision recorded, and the SOC 2 / ASVS mappings are updated to
describe the new posture.

### 5. Detail panel

The redaction fix lands here without further work: the panel renders whatever
`buildAuditDetails()` produced, and that is now consistent. Beyond that, the diff
becomes the primary object, and `context` renders as typed key/value rows —
collapsed by default — instead of a raw JSON dump. The treatment is applied to all five tabs in
`ActivityCenter` — activity, email, consent, login forensics and access
requests — rather than only to activity.

`AuditDiffModal.tsx` was checked against RULESAd §7.8 and already complies:
`<dialog>`, `showModal()`, `.close()`, a unique-ID `::backdrop`, and inline styles
for layout-critical properties. No change needed.

### 6. Search

`details LIKE '%…%'` cannot use any of the seven indexes, and the page-1
`COUNT(*)` repeats the scan. At 26 rows this is free; the fix is cheap and the
table grows, so search narrows to `target_label`/`target_id`, with `details`
search behind an explicit deep-search toggle that requires a date bound. No FTS5
virtual table — that is a new table, and RULE #0.9 requires proving the existing
infrastructure cannot serve first.

### 7. Enforcement and metrics

Two new ratchet counts: hand-rolled `accessMap[...]` resolvers (12 → 0, held at
zero), and mutating routes with no audit write (0).

The twelve hand-rolled resolvers are replaced by the canonical
`decideAccess` / `isExplicitlyDenied` from `src/lib/auth/decide-access.ts`. The
local copies diverge from it in two documented ways: they have no
owner/vendor-support bypass, contradicting ADR-0002 decision 2, and they match
exact keys only, with no ancestor inheritance. In `audit/logs.ts` an owner
carrying an explicit deny is refused by the local check before `placDenyResponse`,
which would have allowed them, ever runs. This is a behaviour change and is
pinned by characterization tests first, per roadmap principle 7.

The five ratchet counts raised by the in-flight work (A1, A1b, A4, A6, A15) are
paid down rather than re-baselined: the new `any` and the new floating promise are
removed, and A15 falls with the engine consolidation. The one-line reason recorded
against each of those entries is rewritten to state what changed, since a feature
description does not justify a new `any` under `reference/coding-standards.md`.

## Finding-to-stage map

| # | Finding | Stage |
|---|---|---|
| 1, 10 | Export and `seo/settings.ts` unaudited | 2 — **export half shipped early, 2026-09-08 (`d7d3dc6`)**; `seo/settings.ts` still open |
| 2 | CSV formula injection (three export routes) | 2 — **shipped early, 2026-09-08 (`d7d3dc6`)** |
| 3, 4 | Deletion paths → append-only + erasure | 2 |
| 5 | Twelve hand-rolled PLAC resolvers | 2 |
| 6 | Cookie-name split, 31 % null `session_id` | 2 |
| 7 | Dead audit vocabulary | 2 |
| 8 | Engine duplication, v1 fallback, truncation | 2 |
| 9 | Index write amplification | Closed by measurement — no work |
| 11, 12, 14b | Redaction chokepoint and `computeDiff` API | 1 |
| 13 | Search scan strategy | 1 |
| 14 | Ratchet debt paid down | 1 |
| — | Unified feed, structured logger, tamper-evidence | Deferred: 13.2, 17, 19 |

## Non-goals

- No new D1 or Supabase table, KV namespace, or environment variable.
- No schema migration. The erasure manifest lives in R2 and keys to the existing
  `legal_requests` record.
- No change to the auth pipeline stabilised by chunk 10.
- No browser testing by the agent; the Stage 1 panel work ends with an owner
  check.

## Verification

Every stage: `npm run verify` green locally, then
`python .agents/scripts/checklist.py cf-admin` from the workspace root, then the
Workers Builds run green on the push, then Sentry `is:unresolved` at 0 for 24 h.

Stage-specific evidence, re-queried live rather than asserted:

- Stage 1 — the five raised ratchet counts are at or below their pre-work values;
  a benign-field redaction test passes.
- Stage 2 — `python scripts/rules_check.py` reports 0 violations across 12 rules
  including the new `SEC-12`; the hand-rolled-resolver count is 0; a post-deploy
  query shows `export` rows appearing where previously there were none.

## Related

- [`../MAINTENANCE.md`](../MAINTENANCE.md) — items #13, C-9 and C-13
- [`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) — the engine this design changes
- [`../program/ROADMAP.md`](../program/ROADMAP.md) — chunks 11, 12, 13.2, 17, 19
- [`../program/adr/ADR-0002-feature-first-sequencing.md`](../program/adr/ADR-0002-feature-first-sequencing.md) — the sequence Stage 3 defers to

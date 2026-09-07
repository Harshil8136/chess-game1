---

title: "Audit-Log Hardening, Sentry Truth Pass, and the Dev-Server Root Cause"
status: active
audience: [owner, non-technical, technical, operator, ai]
last_verified: 2026-09-07
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/audit.ts, src/lib/audit-helpers.ts, src/pages/api/audit/logs.ts, src/components/admin/logs/AuditDiffModal.tsx, src/workers/cf-entry.ts, vitest.config.ts]
related_docs: [specs/2026-09-06-audit-log-remediation-design.md, runbooks/dev-server-optimize-deps-missing.md, operations/OPERATIONS.md, MAINTENANCE.md, program/ROADMAP.md]
tags: [audit, logging, security, sentry, dev-server, session-record]
---

# Audit-Log Hardening, Sentry Truth Pass, and the Dev-Server Root Cause

> **TL;DR (non-technical):** One working session on 2026-09-06/07 that did three
> things. It reviewed the portal's "who changed what" log and found fourteen
> problems, then fixed the urgent half. It corrected documentation that would
> have led the next person to break the error-reporting setup. And it found the
> real cause of the local dev server failing for months — which turned out to
> have nothing to do with the thing the error message blamed.
>
> Fourteen commits. Everything is committed locally and **not yet deployed**; a
> browser check by the owner is the remaining gate.

## Why this record exists

Three separate pieces of work landed in one session and they interlock: the
audit-log findings drove a design, the design drove an implementation pass, and
the dev server had to work before the owner could verify any of it. Splitting
them across three documents would hide that. Commits `8f0e108..b21797d`,
43 files, +3,799 / −485.

---

## Part 1 — The audit

### What was reviewed

The audit/activity-log subsystem: the Ghost Audit Engine
(`src/lib/audit.ts`, `src/lib/audit-helpers.ts`), the `/api/audit/*` routes, the
`admin_audit_log` read paths, and the logs UI. The engine is small — 254 + 237
lines — but is called from roughly 180 files.

### What the live database said

Queried against production D1 on 2026-09-06. These numbers changed the plan, so
they are recorded rather than summarised:

| Fact | Value |
|---|---|
| `admin_audit_log` rows, total | 26 |
| Oldest / newest | 2026-09-01 02:27:31 / 2026-09-06 04:37:50 |
| Rows in the last 24 h | 6 |
| Rows that are the pipeline's own `api_mutation_attempt` | 13 of 26 |
| Rows with `session_id IS NULL` | 8 of 26 (31 %) |
| Largest `details` payload | 26,104 bytes |
| Rows for `export`, `login`, `role_change` | 0 |

**The log begins on 2026-09-01 because of an event recorded inside it.** At
`2026-09-01 02:27:31` the owner account bulk-deleted **40 rows** through
`DELETE /api/audit/logs`. The oldest surviving row is the record of its own
deletion. The snapshot of the deleted rows was retained (26,104 bytes, valid
JSON), so the evidence mechanism worked at that size.

Two consequences. First, a finding about index write amplification was **closed
by measurement, not by code**: at ~6 writes/day the seven indexes on
`admin_audit_log` cost roughly 48 row-writes a day against a 100,000/day free
tier. Second, deletion of the audit trail is not hypothetical here, which is why
the append-only decision below is a response rather than a precaution.

### The fourteen findings

| # | Finding | Where | Outcome |
|---|---|---|---|
| 1 | The CSV export of the audit log writes **no audit entry**; `'export'` is a declared action with no writer anywhere | `src/pages/api/audit/export.ts` | Stage 2 |
| 2 | CSV formula injection — escaping covers `,"` and newline but not a leading `=`, `+`, `-`, `@`; `target_label` carries user-supplied blog titles | 3 export routes | Stage 2 |
| 3 | Three deletion paths, three different evidence policies: a full snapshot silently truncated into invalid JSON above 500 KB, a 10-row `snapshotSample`, and a prune that retains nothing and discards its own row count | `audit/logs.ts`, `audit/delete-targeted.ts`, `audit/prune.ts` | Stage 2 |
| 4 | Deleting a `consent_records` forensic record writes no audit entry at all | `src/pages/api/audit/delete.ts` | Stage 2 |
| 5 | **Twelve files hand-roll the PLAC check** that chunk 10 centralised; the local copies have no owner/vendor-support bypass (contradicting ADR-0002) and no ancestor inheritance | `src/pages/api/audit/*`, `src/pages/dashboard/*` | Stage 2 |
| 6 | The session cookie name is decided two different ways — `import.meta.env.PROD` in one file, request protocol in another — which nulls `session_id` for a production build served over http | `src/lib/auth/session.ts`, `src/lib/audit-helpers.ts` | Stage 2 |
| 7 | Four declared audit actions are never written; `logout` is audited and `login` is not, so the activity log shows every sign-out and no sign-in | `src/lib/audit.ts` | Stage 2 |
| 8 | `auditLog` and `createAuditLogger` duplicate the same body, including a v1 INSERT fallback that silently drops five columns and is unreachable against the live schema | `src/lib/audit.ts` | Stage 2 |
| 9 | Seven indexes on the highest-write-rate table | — | **Closed by measurement** |
| 10 | `seo/settings.ts` mutates settings with no audit while its two siblings audit the identical action | `src/pages/api/seo/settings.ts` | Stage 2 |
| 11 | **Redaction defeated by the field beside it** — values masked in `diff` were written unredacted into `context`, and the detail modal rendered `context` as a raw JSON dump under the mask | `control-plane/config.ts`, `settings/portal.ts` | **Fixed** |
| 12 | The credential pattern matched substrings, so `author`, `author_name`, `is_authorized`, `auth_method` and `hashtag` were treated as secrets | `src/lib/audit-helpers.ts` | **Fixed** |
| 13 | The log search ran `details LIKE '%…%'` — unindexable, on a column holding up to the overflow cap — and the page-1 `COUNT(*)` repeated the scan | `src/pages/api/audit/logs.ts` | **Fixed** |
| 14 | Five ratchet counts were raised with one feature description reused as the justification for each | `.ratchet.json` | **Fixed** |

### Checked and found sound

Worth recording so nobody re-audits them: `delete-targeted.ts`'s interpolated
`${tableName}` is a closed ternary over a union and is not injectable;
`withETag` sets `Cache-Control: private, no-cache`, so there is no shared-cache
exposure; the AI routes *do* audit, indirectly through `src/lib/ai/telemetry.ts`;
`users/cf-resync.ts` writes to `cf_access_sync_log` rather than nowhere; and
`admin_audit_log` is already registered in the Retention Review tool.

---

## Part 2 — The decisions

Four owner decisions shaped the work. They are recorded in full, with the
rejected alternatives, in
[`specs/2026-09-06-audit-log-remediation-design.md`](specs/2026-09-06-audit-log-remediation-design.md).

| Decision | Answer | Why |
|---|---|---|
| Vehicle | Staged, not one chunk | 13.x depends on chunks 11 and 12 in the ADR-0002 lane; security fixes should not wait on an API baseplate, and route work should not be done twice |
| Deletion policy | **Append-only plus one gated erasure path** | The product is sold on audit guarantees, and `audit.ts` already carries the reasoning for why write-side suppression was removed. Deletion is the read-side equivalent |
| "Logging wide" | Coverage only — nothing mutating goes unlogged | Scoped deliberately; the unified feed and structured logger were considered and declined |
| Coverage enforcement | Sweep, then a CI grep guard (`SEC-12`) | Matches the idiom every other invariant in this repo uses, and costs nothing at runtime |

**Ordering was set by the working tree, not by severity.** 32 uncommitted files
touched the same area, and two blocking defects lived inside them, so Stage 1
hardens and lands that work and Stage 2 does the security pass on top.

---

## Part 3 — What shipped (Stage 1)

Fourteen commits, `8f0e108..b21797d`.

**Separating the tree first.** The uncommitted work was split into three commits
rather than one: an unrelated Vite config change (`b5f7909`), the audit-diff
feature as a labelled baseline (`94380eb`), and the hardening on top — so the
hardening reads as its own reviewable diff and roadmap principle 10 holds.

| Commit | What it does |
|---|---|
| `8f0e108` | The design record; re-statuses the 2026-07-22 framework audit as `historical` (it crossed the 45-day staleness rule on its own and had turned `docs_check` red, blocking every push) |
| `b5f7909` | The unrelated Vite `optimizeDeps` change, committed separately |
| `94380eb` | Baseline of the audit detail-panel feature, with its known defects named in the message |
| `3d78d13` | `computeDiff` takes one options object; `label` is no longer stored when it would repeat `field`; `created_at` becomes opt-out |
| `24afca0` | **Redaction moves into `buildAuditDetails`**, the only function that sees `diff` and `context` together, with segment-based matching |
| `7f031b6` | The two dynamic-key routes stop duplicating mutation values into `context` |
| `6d74d11` | The detail modal is typed against `AuditDetailsV2`; `context` renders as a collapsed definition list instead of a JSON dump |
| `c6f6f45` | The clipboard copy affordance handles its own rejection |
| `3be891a` | The detail dialog gets an accessible name (A11Y-03 was failing and blocks `verify`) |
| `8cc9ffb` | Search bounded: `target_label`/`target_id` by default, `details` behind an opt-in that requires a date; the duplicate count scan is skipped |
| `df866dd` | LLM token metadata exempted from redaction; ratchet reconciled |
| `cd2f8d0` | The Sentry documentation corrections (Part 5) |
| `d78dcac` | The dev-server fix (Part 6) |
| `b21797d` | The dev-server runbook |

### Why redaction moved

This is the change worth understanding. Redaction used to live inside
`computeDiff`, which sees only the diff. Callers then passed the same values
into `context` beside it, and `AuditDiffModal` rendered `context` as raw JSON
directly under the masked field. The mask was **cosmetic** — the real value sat
one key away in the same panel and the same CSV export.

Moving redaction up to `buildAuditDetails` makes the contradiction structurally
impossible rather than a rule to remember: when the diff redacts a field, the
context keys carrying that mutation's values are redacted with it.

---

## Part 4 — What execution found that the plan did not

Recorded because each was invisible to the tooling that should have caught it.

**A trap TypeScript cannot see.** Four call sites passed a *computed-key* label
map — `{ [setting_key]: setting_key }`. Excess-property checking cannot inspect a
computed key, so these were silently read as `ComputeDiffOptions` rather than
labels, and `users/access.ts` was quietly losing its label. A setting literally
named `ignoreFields` would have been read as configuration.

**The fix reproduced the bug it was fixing.** The full suite caught
`token_source` in the AI telemetry context being redacted — it carries a `token`
segment but records whether an LLM token *count* was reported or estimated. Same
false-positive class as `author` and `hashtag`. Now an explicit benign set,
pinned by a test.

**The security scan was right.** It flagged `api_key: 'sk_live_old123'` in a test
fixture. `sk_live_` is the literal shape of a Stripe live key, so that is correct
scanner behaviour. The test is now built from a field list — a test about key
names never needed literal credential pairs. The shared scanner in `.agents/` was
deliberately **not** modified; it is used by every repo in the workspace.

**A11Y-03 was already failing.** The new dialog had no accessible name, and
`a11y_check` blocks `verify`, so this would have stopped a push regardless.

---

## Part 5 — Sentry

Triggered by the metrics onboarding wizard. Checking its snippet against the code
found three documentation drifts, one of which was actively dangerous.

**`OPERATIONS.md` pointed at the wrong file.** It named
`sentry.server.config.ts` as the Sentry config file. That file is an intentional
no-op whose own header reads *"Do not add `Sentry.init(...)` here"* — the
Node-based `@sentry/astro` server SDK does not run in workerd. The Worker is
initialized by `withSentry()` in `src/workers/cf-entry.ts`. A reader following the
old pointer would have put a broken Node client into the Worker, which is exactly
what the wizard's snippet invites.

**`@sentry/cloudflare` exports no `init()`.** Verified against 10.73.0: it
exports `withSentry`, `sentryPagesPlugin`, `CloudflareClient`, `setCurrentClient`
and `getClient`. Every generic Sentry snippet opens with `Sentry.init({ dsn })`,
which throws here. This is now §4.1b of `OPERATIONS.md`.

**The wizard's metrics were already in this repo once.** `button_click`,
`page_load_time=150` and `response_time=200` were emitted on every call of the
health route and were deleted on 2026-09-02 as fabricated telemetry under
RULE #0.5, in viability program chunk 3. They must not come back. Verification
metrics for the wizard were therefore emitted from a throwaway script tagged
`environment=development`, never wired into `src/`.

**Quota, for the $0 constraint:** application metrics are included on the
Developer plan with 5 GB across tiers, and overage is charged only against a
pay-as-you-go budget. Under ADR-0001 that budget stays at zero, so an overage
drops metrics rather than generating a bill.

Versions were corrected from `^10.51.0` to `^10.73.0` in `RULESAd.md` §7.3 and
`architecture/ARCHITECTURE.md`, matching `package.json` and the lockfile.

---

## Part 6 — The dev server

Failing intermittently for months with a Vite error blaming dependency
incompatibility. Full diagnosis and reproduction steps are in
[`runbooks/dev-server-optimize-deps-missing.md`](runbooks/dev-server-optimize-deps-missing.md).

**Root cause:** neither `astro.config.ts` nor `vitest.config.ts` set `cacheDir`,
so the Astro dev server, `vitest run`, and the always-on Vitest Explorer
extension all shared `node_modules/.vite`. The `predev` script recursively
deleted that entire directory on every `npm run dev`. On Windows, removing a tree
while another process holds handles inside it fails partway and `rmSync`'s
`force: true` swallows the error, leaving a half-deleted cache.

**The error message pointed the wrong way.** Vite suggests
`optimizeDeps.exclude`; five packages were added to that list chasing this before
the real cause was found, each time surfacing a different dependency name.

**Fix:** `astro dev --force` already rebuilds the optimizer cache in-process, so
`predev` now clears only `dist` and `.astro`. `vitest` gets its own `cacheDir` as
defense in depth.

---

## Verification

Both gates green at `b21797d`:

```text
npm run verify            EXIT=0   735 tests / 53 files, typecheck 0 errors,
                                   ratchet matches, rules_check 11 rules 0 violations,
                                   docs_check passed, a11y 0 findings, audit_gate clean
checklist.py cf-admin     8 passed | 0 failed
dev server                HTTP 200, 394,789 bytes, 0 error-overlay markers,
                                   with a vitest run active concurrently
```

Ratchet: A1 486 → **485** and A1b 114 → **113**, both back to their pre-feature
baseline rather than re-baselined; A6 933 → 931. A15 rose, and the five entries
that shared one feature description as their justification were rewritten to say
what actually changed.

## What is still open

1. **Owner browser check at `/dashboard/logs`** — the gate on deploying Stage 1.
   The diff must render first with context collapsed; a settings change must show
   `[REDACTED]` in the diff **and** no raw value in the expanded context; Deep
   Search must be disabled until a From date is chosen.
2. **Nothing is pushed.** All fourteen commits are local.
3. **Stage 2 has no plan yet** — findings 1–8 and 10. Part of its task list
   derives from what `SEC-12` reports against the shipped tree, so it is written
   after Stage 1 deploys.
4. **The five `optimizeDeps.exclude` entries** in `astro.config.ts` were added
   chasing the dev-server error and are believed inert. Removing them belongs in
   its own commit so it is cheap to revert.

## Related

- [`specs/2026-09-06-audit-log-remediation-design.md`](specs/2026-09-06-audit-log-remediation-design.md) — the design and the full decision record
- [`runbooks/dev-server-optimize-deps-missing.md`](runbooks/dev-server-optimize-deps-missing.md) — the dev-server playbook
- [`operations/OPERATIONS.md`](operations/OPERATIONS.md) §4 — Sentry, corrected here
- [`MAINTENANCE.md`](MAINTENANCE.md) — items #13, C-9, C-13 that Stage 2 closes
- [`program/ROADMAP.md`](program/ROADMAP.md) — chunks 11, 12, 13.2, 17, 19

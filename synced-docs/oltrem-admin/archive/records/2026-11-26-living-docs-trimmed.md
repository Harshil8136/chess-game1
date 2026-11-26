---
title: "Living documents trimmed: proposals, the log and done work out"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit; the docs review of 2026-11-26]
---

# Living documents trimmed: proposals, the log and done work out

**Changed.** Seven proposals and earlier plans moved to `archive/proposals/`; the verification
log retired into its last record; the status page cut to what still waits (the full table frozen
in a record); the roadmap's history sections gone; each phone-test list names a test's source
once over its rows; `.agents/` left out of the living set and searches; four wrong names fixed
(`AllSections`, `ToastRegion`, `VariantProps`, `developer.jobs`) and the migration numbers row
pointed at the generated list. **Why.** The living set held about 150 KB that no task needs.

**Before → after.** 118 living documents, 1.58 MB → 106, 1.36 MB.
**Checked.** `pnpm verify` (summary in the commit); no page changed, so no phone test. Not
checked: the big READMEs, which the next batches compress.

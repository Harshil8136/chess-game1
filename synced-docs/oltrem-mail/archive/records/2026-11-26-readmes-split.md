---
title: "Module READMEs split into pages, dated history stripped"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit]
---

# Module READMEs split into pages, dated history stripped

**Changed.** The three module READMEs (102, 53 and 34 KB) are split by section into 22 pages in
`docs/` beside each, listed in a Contents table in the README, shipped in the package and in the
pack. Dated asides are stripped from every living document (about 4 KB). The docs gate checks
each page's title and its link from the README. **Why.** An agent reads one page of at most 16 KB
for a task.

**Before → after.** Largest living document 102 KB → 16 KB; 6 over the cap → 3 (plan, setup,
inbox).
**Checked.** `pnpm verify` (summary in the commit). Not checked: the pages' content against the
code; the split moved text, it did not re-verify it.

---
title: "Big READMEs split into pages, dated history stripped"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit]
---

# Big READMEs split into pages, dated history stripped

**Changed.** The 16 READMEs over 16 KB are split by section into pages in `docs/` beside each
(67 pages), listed in a Contents table that stays in the README; each page ships in its package.
Dated asides ("(2026-11-08: …)", "since 2026-11-12", "(the owner: …)") are stripped from 46
living documents (about 15 KB). The docs gate checks each page's title and its link from the
README; the mirror copies the pages. **Why.** An agent now reads one page of at most 16 KB for a
task instead of a README of up to 104 KB.

**Before → after.** 27 documents over the cap → 10 (the phone-test lists, the token registry,
the design skill, the roadmap); largest README 104 KB → 3 KB, largest page 16 KB.
**Checked.** `pnpm verify` (summary in the commit). Not checked: the pages' content against the
code; the split moved text, it did not re-verify it.

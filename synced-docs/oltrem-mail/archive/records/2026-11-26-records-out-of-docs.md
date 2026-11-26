---
title: "Records moved out of docs/, and kept short"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit; scripts/lib/docs.mjs; scripts/mail-pack.mjs]
---

# Records moved out of docs/, and kept short

**Changed.** Mail's 28 dated records moved from `docs/records/` to `archive/records/`, with their
own index (the 28 rows that sat in the docs index) and every link and path rewritten. `.ignore`
hides `archive/` from search tools; the pack still publishes it, so the mirror keeps it.
**Why.** An agent reading `docs/` loaded history it never needed for a task (the owner's ask,
2026-11-26; the kit moved its records the same day).

**Before → after.** A record: in `docs/`, any length up to 32 KB → in `archive/records/`, 4 KB
at most from the template in [the index](README.md); one left in `docs/records/` is refused.

**Checked.** `pnpm verify`; a new test of where a record may be and how long a new one may be,
and the pack test (archive/records/ published). Not checked: the kit's mirror run with this pack.

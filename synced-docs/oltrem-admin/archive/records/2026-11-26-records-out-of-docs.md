---
title: "Records moved out of docs/, and kept short"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit; scripts/lib/docs.mjs; rules.md R-07]
---

# Records moved out of docs/, and kept short

**Changed.** The 303 dated records (1.65 MB, about 410k tokens) moved from `docs/records/` to
`archive/records/`, with every link and path that named them rewritten. `.ignore` hides
`archive/` from search tools; the mirror still publishes it. **Why.** An agent reading or
searching `docs/` loaded history it never needed for a task (the owner's ask, 2026-11-26).

**Before → after.**

| | Before | After |
|---|---|---|
| Files under `docs/` | about 330, 302 of them records | 27 living documents |
| A new record | any length up to 32 KB | 4 KB at most, from the template in [the index](README.md) |
| A file left in `docs/records/` | indexed there | refused, with the folder to move it to |

**Checked.** `pnpm verify` before the push; two new docs-gate tests (a file in the old folder, a
long record after 2026-11-26 refused while an older one is frozen as written). Not checked: the
mirror's first run with `archive/`, which happens on the push.

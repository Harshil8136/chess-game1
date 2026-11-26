---
title: "A Checkup page that checks every connection daily"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit]
---

# A Checkup page that checks every connection daily

**Changed.** Status, Checkup lists every outside connection of every kind with its last check,
the failing first, and Check every connection now. An hourly job checks three connections not
checked for 20 hours, asks a passing failure (no answer, 429, 5xx) once more, and writes each
result to the audit log; a provider's `Sunset` or `Deprecation` header marks its API as retiring.
**Why.** The owner's pick on 26 November: a Vendor checkup of every provider, fixed by itself
where it can, every result logged.
**Before → after.** Each part checked its own connections, out of sight, and nothing noticed a
retiring API → one page for all of them, a daily check for each, and a retiring API named.
**Checked.** `pnpm verify` green; phone tests P1003-P1007. Not checked: a real provider sending
a `Sunset` header (none of the connected ones does today).

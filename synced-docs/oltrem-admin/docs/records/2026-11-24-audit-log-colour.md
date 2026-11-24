---
title: "The Audit log in colour, and sign-ins by browser (2026-11-24)"
status: record
owner: vendor
last_verified: 2026-11-24
sources: [packages/screens/src/audit-log.tsx; packages/screens/src/screens.tsx; packages/core-ui/src/theme.css; packages/screens/test/audit-log.test.ts]
---

# The Audit log in colour, and sign-ins by browser

> **In plain words.** The owner said (24 November evening) that pages looked bland, with no
> colour coding. On the Audit log, each row's section now shows in its sidebar colour (a dot and
> its name), a refused row carries a red edge and a failed one an amber edge, and a sign-in names
> its browser in a few words ("Safari on iPhone") instead of the browser's long description.

| Part | Before | Now |
|---|---|---|
| Section under a row | grey words | a dot and the name in the section's sidebar colour |
| Refused or failed row | red words in its line | also a red (refused) or amber (failed) edge down the row |
| Sign-in's browser | the browser's long description, or nothing | "Chrome on Windows", the same words as Sessions |

The filters' layout is the page frame's and stays with the design rethink. Checked by the page's
tests (the colour and the browser's words) and `pnpm verify` (its summary in the commit). Not run
on a phone: P565-P566 in [their own list](../phone-tests-system.md).

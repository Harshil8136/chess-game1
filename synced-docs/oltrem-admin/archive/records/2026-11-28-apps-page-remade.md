---
title: "The Apps page remade on the twenty UX laws"
status: record
owner: vendor
last_verified: 2026-11-28
sources: [modules/connect/src/pages.tsx, packages/core-ui/src/theme.css, .claude/skills/ui-design-system/ux-laws.md]
---

# The Apps page remade on the twenty UX laws

**Changed.** Integrations, Apps (`/connect`) was remade: a find box beside the kinds (with a way on
when nothing matches), each card one compact row with the same press pill, the app's colour on its
edge under the pointer, a lift and a press, a connected card marked by its edge and a health dot,
kinds under headings in their own colour, and Connected sorted failing first. The twenty laws are
now a file of the design skill (`ux-laws.md`) that every screen follows. **Why.** The owner asked
on 28 November to transform the page and to follow the laws everywhere.

**Before → after.** Tall cards with the logo on top, four across, a plain word on the right, no
search → one-row cards, three across at 1440 px and four from about 1800 px, a pill, a find box.

**Trade-off.** Three columns at 1440 px (each name on one line, less to read) over four (more apps
at once).

**Checked.** `pnpm verify` (in the commit); screenshots at 390, 1440 and 1840 px, light and dark,
with a connected app and the find box empty and with no match. Phone tests P1120-P1122. Not
checked: a real failing connection on the live portal.

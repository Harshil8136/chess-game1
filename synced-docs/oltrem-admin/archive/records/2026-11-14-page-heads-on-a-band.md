---
title: 'Every page head on a band, tabs with icons, filters in trays (2026-11-14)'
status: record
owner: vendor
last_verified: 2026-11-14
sources: [packages/core-ui/src/theme.css; packages/core-ui/src/primitives/navigation.tsx; packages/core-ui/src/primitives/chip-row.tsx; packages/core-ui/src/page.tsx; packages/screens/src/layout.tsx; packages/screens/src/people.tsx; packages/screens/src/forms.tsx; packages/core-ui/test/theme.test.ts; packages/core-ui/test/primitives.test.tsx; packages/screens/test/css.test.ts]
---

# Every page head on a band, tabs with icons, filters in trays

> **In plain words.** The owner's screenshot of Users: every part of the page looked merged
> into one, Invite people took a line of its own, the head did not look modern, and the tabs all
> looked the same. The fix is in the shared pieces, so it reaches every page: the head and its
> tabs now sit on a band in the section's colour with a hairline under it, the page's main button
> sits on the head's line, each tab has its section's icon, each group of filters is a tray of
> its own with counts as badges, and each section heading has a colour mark and its count.

## What changed

| Part | Before | Now |
|---|---|---|
| Head | A soft colour wash that faded into the page, so the head, the tabs and the content read as one | A band from the page's top and left edge across the whole width, the section's colour at 7% on the surface, a hairline under it (`--band`; a spread shadow clipped to the page, so no wrapper changed any page's markup) |
| Main button | On a page of a set (Users) under the tabs, on a line of its own | On the head's line, above the tabs, as on a page without tabs |
| Tabs | Words alike on an underline | Each with its section's icon; the marked one has its icon in the colour, a tinted pill and the underline (never bold, so no label moves) |
| Filters | Chips like `Everyone · 2`, two rows that ran together | From 640 px each row is a tray (border, faint fill) with its choices flat inside it, the picked one in the colour; `count` draws a badge (`Chip.count`) |
| Sections | A large heading | `Section` draws a 16 px heading with a 3 px mark in the colour and an optional `count` badge, and starts 8 px further down after other parts |

## How it was verified

- Tests: the band, the trays, the command on the head's line and the section mark
  (`theme.test.ts`); a tab's icon, a chip's and a section's count (`primitives.test.tsx`);
  the stylesheet cap at 172 KiB, the owner's yes on 2026-11-14 (`css.test.ts`).
- In a browser at 1850 px dark, 1440 px light and 390 px light and dark: Users, Records,
  Settings, System status, Email, Home and Invite people. The band and the tabs read as one
  head, set apart from the content; Invite people beside the bell; on a phone the head is the
  compact title row on the band, the filters stay sideways chips.
- `pnpm verify` green before the push.
- Not verified: on a real phone (P210 to P212).

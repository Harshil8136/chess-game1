---
title: "@oltrem/screens: the pages, settings, alerts, audit log"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src/forms.tsx, marks.tsx, alerts.tsx, audit-log.tsx, audit-words.ts]
---

# @oltrem/screens: the pages, settings, alerts, audit log

> Part of [the @oltrem/screens README](../README.md).

## The pages, continued

| Path | Shows | Reads |
| --- | --- | --- |
| `/settings?show=changed&q=` | Only what is company-wide: **Name and icon**, **Colours for everyone**, the Settings module's rows and Security, then **Each section's settings** (a row per section tab the person may open, with its count); every other setting is on its section's tab. Figures at the top; sections with icon, colour and counts, a list down the left on a wide screen and chips on a phone; All, Changed chips and search. Each row: title, line, a control of its type; one Save bar with Discard once anything changed; a changed row marked on its edge with its default, last change and Reset to default. Only rows the person may change, and a count of the rest; the Vendor also sees keys. Settings sharing a name (currencies, time zones) get one form setting them all. **Colours for everyone** (whoever may change `settings.look`): 24 palettes and 7 backgrounds as tiles. **Name and icon** (an Owner, the Vendor): the name (40 letters, empty for the client file's) and the tile: Initials, 32 icons (`MARK_ICONS`) or Picture, which the script draws at 128 px as WebP; `pictureOf` takes WebP, PNG or JPEG by its bytes up to `MARK_BYTES` (48 KB), kept in the bucket by its SHA-256 prefix as `picture:<file>`; saved as `settings.portal_name` and `settings.portal_mark` | `/api/settings/values` |
| `/alerts` | Open alerts with their email's fate and who is on each, then recently resolved | `/api/alerts/items` |
| `/audit?q=&range=&who=&module=&outcome=&actor=&target=&day=&ip=&asn=&key=&session=&signal=&before=` | Search beside Export; chips for When (24 hours, 7, 30 or 90 days; 30 default), Everyone, People, Automatic or API keys, result and section; a line with counts, the tamper check and the time zone; signals (Refused, API key calls, Downloads, New places) as tappable counts; from 7 days, a strip of a column a day (`day=`). Rows under their days in the viewer's clock, each one sentence (`audit-words.ts`) with section colour, browser, country, a refusal in red, an unusual sign-in in amber, repeats folded ("3 times"), API key calls and files named. A row opens to What changed (before muted, after green, "Not kept"), why refused, who and how, where from, how (request, answer, time, file, calls held back), its fingerprint and the entry, with links to everything by that person, sign-in, key, record, address and network. Older; the daily seals and the export | `/api/audit/entries` with `since` (or a day's `since` and `until`), `count=1`, `offset`, `countSince`; `seals` |

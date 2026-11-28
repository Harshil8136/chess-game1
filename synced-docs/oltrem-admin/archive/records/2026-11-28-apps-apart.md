---
title: "Reports' Website tab shows one analytics app at a time, each by its logo"
status: record
owner: vendor
last_verified: 2026-11-28
sources: [this commit]
---

# Reports' Website tab shows one analytics app at a time, each by its logo

**Changed.** The Website tab no longer lays every connected app's board on one page: with no app
picked it opens the first app on its own. The Apps row shows each app by its service's logo, its
full name on hover; the app shown, and two apps that share a logo, keep their names in words.
**Why.** The owner, 2026-11-28: "make sure we are not merging all analytics in 1 place ...
cloudflare, posthog etc are to be kept seperate", and logos instead of full names.
**Before → after.** Before, `?tab=website` read every app's report (`GET /web`) and stacked their
boards, with an All apps chip and a Full view button on each board. Now it asks only the list
(`GET /api/analytics/apps`, no figures read) and reads the first app alone; All apps and Full view
are gone. Money's funnel still reads `GET /web`. A black logo turns light on the dark theme.
**Checked.** `pnpm verify`; phone tests P1087-P1089.

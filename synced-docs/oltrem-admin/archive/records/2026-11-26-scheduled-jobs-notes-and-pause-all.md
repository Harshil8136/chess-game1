---
title: "Scheduled jobs: a reason with each change, Pause all, live countdowns"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [modules/jobs/src/control.ts; modules/jobs/src/module.ts; modules/jobs/src/pages.tsx; packages/screens/src/client/frame.js; the owner's message of 26 November, 07:28 UTC]
---

# Scheduled jobs: a reason with each change, Pause all, live countdowns

**Changed.** Run now, Pause and Resume take an optional Why (at most 200 letters), kept in the
audit row's details and shown in History, a job's Runs tab and a paused job's card. **Pause all**
and **Resume all (N)** sit in the page's head for whoever may pause jobs (`POST /api/jobs/pause-all`
and `/resume-all`, `jobs.manage`), each job audited as its own change. The frame script counts
`data-count-to` times down each second, so Next tick and a job due within the hour stay current.
**Why.** The owner asked for the next improvements, researched against common job schedulers.

**Before → after.**

| | Before | After |
|---|---|---|
| A change by hand | who and when | who, when and why |
| Stopping every job | open each job and pause it | one Pause all, one Resume all |
| Next tick | fixed when the page loaded | counts down each second |

No table, setting or permission changed; Pause all is one write per job.

**Checked.** The jobs tests (the note and its limit, every job paused and resumed and each
audited, refused without the permission), the page tests, the frame test (the countdown and the
tick), the local portal in a headless browser at 390 and 1440 px (no sideways scroll, no script
errors), then `pnpm verify`; phone tests P967-P969. Not checked on the live portal.

---
title: "An analytics app's full view on Reports"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# An analytics app's full view on Reports

**Changed.** Each analytics app connected on Apps has its own full view on Reports, Website
(`?tab=website&app=`): a row to move between the apps, the app's own pages (Overview, and Settings
for its key and Reconnect), its board read with every call of the request instead of a share, a
chart of visitors or page views against the period before as a dashed line, and PostHog's right
now read again every 30 seconds. Each board on the Website tab and the connection's page on Apps
open it. A day with no views no longer turns the board's chart from visitors to page views.
**Why.** The owner: "posthog is no where close to anything to what I expected and it does close to
nothing in" the connection's page; the first of four batches toward a PostHog and Cloudflare view
on the level of the first client's own portal, taken as a design only (R-03).
**Before → after.** PostHog's figures question gains the days before, day for day (one more leg,
no more calls). Right now is asked on its own in one HogQL question by `GET /api/analytics/web/:id/live`,
which the frame's live block reads from a lighter page every 30 seconds while the tab is open.
**Checked.** `pnpm verify`; phone tests P1034-P1037.
**Left.** PostHog's free allowance needs a PostHog permission the sign-in does not ask for (only
project and query read); batches 2 to 4: recordings, errors with events and visitors, Cloudflare's
own pages.

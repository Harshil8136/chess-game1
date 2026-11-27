---
title: "PostHog's recordings in an app's full view"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# PostHog's recordings in an app's full view

**Changed.** A PostHog app's full view on Reports gains Recordings (`&part=recordings`): the
latest 50 visits of the window, narrowed by a row of chips (All visits, With errors, Stuck taps,
Over a minute active, On a phone, and Left before the last step when the funnel has two steps or
more). Each visit is one sentence (device, country, pages, time active, errors, stuck taps, where
it started and ended) with its recording one tap away in PostHog. Opening a visit shows what
happened, in order: pages opened, taps, taps where nothing happened, the same tap over and over,
forms sent, errors met, the app's own events and where the visitor left.
**Why.** The owner: PostHog "does close to nothing" on the connection's page; the second of four
batches toward a PostHog and Cloudflare view on the level of the first client's own portal, taken
as a design only (R-03).
**Before → after.** Before, the board showed five recordings worth watching. Now
`GET /api/analytics/web/:id/recordings` asks two HogQL questions side by side (the list from
`session_replay_events` joined with each visit's events, and one visit's first 200 events), read
fresh on each open, no cache. A visit's id is checked by shape before it is written into the
question. Addresses are shown by their path only; no address, browser string or name is asked for.
**Checked.** `pnpm verify`; both questions run read-only on the owner's PostHog project; phone
tests P1047-P1050.
**Left.** Playing a recording inside the portal waits on the owner's pick (a player needs a
dependency and a larger size budget); batches 3 and 4: errors with events and visitors, Cloudflare's own pages.

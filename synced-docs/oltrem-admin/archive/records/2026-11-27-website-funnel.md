---
title: "PostHog on the Website board: recordings, errors and a funnel"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# PostHog on the Website board: recordings, errors and a funnel

**Changed.** PostHog's board on Reports, Website gains three parts. **Recordings worth watching**:
the five visits with the most errors, then the most clicks, each opening its recording in PostHog.
**Errors visitors met**: the five errors met most, as PostHog groups them, each opening the error
in PostHog's Error tracking. **Funnel**: two to five steps, each a page (a trailing `*` for every
page under it) or an event, picked in a pop-up and kept on the connection; the board counts the
people who reached each step in order, each within a day of the one before. All three ride in the
fourth question PostHog is already asked, so a report makes no more calls.
**Why.** The owner: PostHog had "close to no stats, metrics, data that we can use", with links
that redirect to the app.
**Before → after.** Counts of recordings and errors only → the ones worth opening, one tap away,
and a funnel of the steps that matter to the company.
**Checked.** `pnpm verify`; each HogQL question run on a live PostHog project first
(`session_replay_events`, `$exception` with its issue id, `windowFunnel`); a step with a quote is
refused before it reaches a question; phone tests P1021-P1024.
**Left.** A person who may read Reports but not manage apps sees Pick the steps, and saving says
they may not.

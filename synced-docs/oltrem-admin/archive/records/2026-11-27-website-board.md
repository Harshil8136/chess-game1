---
title: "Website tab remade as a full board, PostHog read in full"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# Website tab remade as a full board, PostHog read in full

**Changed.** The Website tab on Reports is now a board per connected analytics app: figures with
their moves (events, errors, stuck taps and recordings added), "In plain words", each day, when
visitors come on the company's clock, right now, kinds of source with bounce and visit length,
entry and exit pages, regions and cities, systems, campaigns, page speed graded against Google's
limits, where visitors got stuck, and events. Each part opens the app's own page for it. PostHog
is asked four questions, two at a time, instead of one; a part it does not answer is named and the
rest stands. The last good report is kept a day: shown at once while a new one is read, and shown
with why when the app does not answer.
**Why.** The owner: "PostHog have close to no stats ... make similar or better" than the first
client's board, "remember to set fallback, redirection links".
**Before → after.** Totals and six top-10 lists, nothing when the app failed → about 15 parts,
each linked, with a kept copy as the fallback.
**Checked.** `pnpm verify`; the four questions run first on the owner's PostHog project through
its connector; phone tests P1011-P1016. The other six apps fill the same parts in the next batch.

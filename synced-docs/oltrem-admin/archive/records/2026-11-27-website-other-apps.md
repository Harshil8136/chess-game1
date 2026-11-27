---
title: "The other six website apps fill the board too"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# The other six website apps fill the board too

**Changed.** Plausible, Umami, Google Analytics, Matomo, Fathom and Cloudflare Web Analytics now
fill the same Website board parts as PostHog where their APIs allow: kinds of source with bounce
and visit length, hours of the week, entry and exit pages, right now, regions, cities, systems,
campaigns and goals; Cloudflare also gives page speed per device. Each part opens the app's own
report where it has one. A report's calls are shared: 40 of the 50 a free-plan request may make,
split evenly between the apps connected, each asking its other parts in order of worth while its
share lasts. Hours an app keeps on its own clock are said to be on it.
**Why.** The owner: "See what other connectors support same things and configure all of them
same way".
**Before → after.** Totals and six lists for those six apps → up to 15 parts each, within one
request's calls.
**Checked.** `pnpm verify`; Cloudflare's GraphQL fields and units (microseconds, ISO hours) read
on a live account; Plausible's report paths, Umami's Sunday-first week and Fathom's fields from
their own sources and docs; phone tests P1017-P1020.
